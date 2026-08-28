/* build-stamp.js — version visibility + staleness detection.
   The drift guard at the bottom is the important one: it makes it impossible to
   ship a version bump in one file and forget the other. */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

function loadStamp(){
  const ctx = { window: {}, console, Math, JSON, Date, isFinite, String, Object, Array, RegExp, Promise, Error };
  ctx.window.navigator = undefined;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8'), ctx);
  return ctx.window;
}
const G = loadStamp();

/* ---- the stamp exists and is well-formed ---- */
ok(G.HG_BUILD && typeof G.HG_BUILD === 'object', 'HG_BUILD is exported');
ok(/^hg-v\d+$/.test(G.HG_BUILD.version), 'version looks like hg-vNNN — got ' + G.HG_BUILD.version);
ok(typeof G.HG_BUILD.pack === 'string' && G.HG_BUILD.pack, 'pack is a non-empty string');
ok(!isNaN(Date.parse(G.HG_BUILD.built)), 'built is a parseable date — got ' + G.HG_BUILD.built);

/* ---- label ---- */
eq(G.hgBuildLabel({ version: 'hg-v269', pack: 'pack 17' }), 'v269 · pack 17', 'label strips the hg- prefix');
eq(G.hgBuildLabel({ version: 'hg-v269' }), 'v269', 'label omits pack when absent');
eq(G.hgBuildLabel({}), 'unknown build', 'label degrades honestly with no version');

/* ---- version parsing out of source text ---- */
eq(G.hgBuildParseVersion("  version: 'hg-v301',"), 'hg-v301', 'parses single quotes');
eq(G.hgBuildParseVersion('version:"hg-v42"'), 'hg-v42', 'parses double quotes, no spaces');
eq(G.hgBuildParseVersion('nothing here'), null, 'returns null when absent');
eq(G.hgBuildParseVersion(''), null, 'null on empty string');
eq(G.hgBuildParseVersion(null), null, 'null on null — never throws');
eq(G.hgBuildParseVersion(12345), null, 'null on non-string');
/* must find the real stamp inside the actual file */
eq(G.hgBuildParseVersion(fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8')),
   G.HG_BUILD.version, 'parser recovers the version from its own source — this is what the freshness check does');

/* ---- compare ---- */
eq(G.hgBuildCompare('hg-v269', 'hg-v269').state, 'fresh', 'same version -> fresh');
eq(G.hgBuildCompare('hg-v268', 'hg-v269').state, 'stale', 'older loaded -> stale');
eq(G.hgBuildCompare('hg-v269', null).state, 'unknown', 'unreadable live -> unknown, NOT stale');
eq(G.hgBuildCompare(null, 'hg-v269').state, 'unknown', 'unreadable loaded -> unknown');
ok(G.hgBuildCompare('hg-v268', 'hg-v269').reason.indexOf('hg-v269') >= 0, 'stale reason names the server version');

/* ---- distance ---- */
eq(G.hgBuildDistance('hg-v268', 'hg-v269'), 1, 'one build behind');
eq(G.hgBuildDistance('hg-v260', 'hg-v269'), 9, 'nine builds behind');
eq(G.hgBuildDistance('hg-v269', 'hg-v269'), 0, 'level');
eq(G.hgBuildDistance('weird', 'hg-v269'), null, 'null when not comparable');

/* ---- chip state ---- */
const fresh = G.hgBuildChipState({ state: 'fresh', loaded: 'hg-v269', live: 'hg-v269' }, { version: 'hg-v269', pack: 'pack 17' });
eq(fresh.cls, 'ok', 'fresh chip is ok');
ok(fresh.text.indexOf('STALE') < 0, 'fresh chip does not say STALE');

const stale = G.hgBuildChipState({ state: 'stale', loaded: 'hg-v268', live: 'hg-v269', reason: 'r' }, { version: 'hg-v268', pack: 'pack 17' });
eq(stale.cls, 'bad', 'stale chip is bad severity');
ok(stale.text.indexOf('STALE') >= 0, 'stale chip says STALE');
ok(stale.text.indexOf('1 behind') >= 0, 'stale chip counts builds behind — got ' + stale.text);

const unk = G.hgBuildChipState({ state: 'unknown', reason: 'network failed' }, { version: 'hg-v269' });
eq(unk.cls, 'warn', 'unknown is warn, not bad — offline must not scream STALE');
ok(unk.text.indexOf('STALE') < 0, 'unknown chip never claims STALE');

/* ---- freshness over an injected fetch ---- */
const okRes = (body) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });

const r1 = await G.hgBuildFreshness(() => okRes("version: '" + G.HG_BUILD.version + "'"));
eq(r1.state, 'fresh', 'server matching -> fresh');

const r2 = await G.hgBuildFreshness(() => okRes("version: 'hg-v999'"));
eq(r2.state, 'stale', 'server ahead -> stale');
eq(r2.live, 'hg-v999', 'reports the live version it saw');

const r3 = await G.hgBuildFreshness(() => Promise.reject(new Error('offline')));
eq(r3.state, 'unknown', 'network failure -> unknown, never a false STALE');
ok(r3.reason.indexOf('offline') >= 0, 'surfaces the network reason');

const r4 = await G.hgBuildFreshness(() => Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('') }));
eq(r4.state, 'unknown', 'http 503 -> unknown');

const r5 = await G.hgBuildFreshness(() => okRes('garbage with no version'));
eq(r5.state, 'unknown', 'unparseable body -> unknown, not stale');

/* cache-busted and no-store, or the check is worthless */
let seenUrl = null, seenOpts = null;
await G.hgBuildFreshness((u, o) => { seenUrl = u; seenOpts = o; return okRes("version: 'hg-v269'"); });
ok(/[?&]fresh=\d+/.test(seenUrl), 'freshness fetch is cache-busted — got ' + seenUrl);
eq(seenOpts && seenOpts.cache, 'no-store', 'freshness fetch uses cache:no-store');

/* ---- DRIFT GUARD: sw.js cache version must equal the build stamp ---- */
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swVer = (sw.match(/HG_CACHE\s*=\s*'([^']+)'/) || [])[1];
ok(swVer, 'sw.js HG_CACHE is readable');
eq(swVer, G.HG_BUILD.version,
  'sw.js HG_CACHE (' + swVer + ') must match build-stamp version (' + G.HG_BUILD.version + ') — bump BOTH when you ship');

/* ---- DRIFT GUARD: index.html script ?v= pins must match build stamp ---- */
const pin = G.HG_BUILD.version.replace(/^hg-v/, '');
const bustPins = [...new Set([...html.matchAll(/<script[^>]+src="[^"]*\?v=(\d+)"/g)].map(m => m[1]))];
ok(bustPins.length >= 1 && bustPins.every(p => p === pin),
  'every index.html script ?v= matches build-stamp (' + pin + ') — got: ' + bustPins.join(', ') + ' — run: npm run sync:cache');

/* ---- wiring: the file must actually be loaded and precached ---- */
ok(html.indexOf('<script src="build-stamp.js"></script>') >= 0, 'build-stamp.js has a script tag');
ok(html.indexOf('id="chipBuild"') >= 0, 'header has the build chip element');
ok(sw.indexOf("'./build-stamp.js'") >= 0, 'build-stamp.js is in the sw precache list');
/* it must load before anything that might read HG_BUILD */
ok(html.indexOf('build-stamp.js') < html.indexOf('hghost.js'), 'build stamp loads before the rest of the app');

console.log('build stamp: ' + n + ' assertions passed');
