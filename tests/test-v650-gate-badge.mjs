/* v650: per-gate ledger badge on scan cards.

   Slice 4 exposed the ledger as a NOTE string in SIGNAL LOG. This ships the
   same data as a visible dot row on every SWING/SCALP CLEAN and NEAR card
   (not just the log), so users can see WHICH gates passed and which
   blocked without opening the plan panel. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const setupUi = readFileSync(resolve(ROOT, 'setup-ui.js'), 'utf8');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* --- helper exists + exposed on W --- */
assert.ok(/function hgGateLedgerBadge\(gateMeta, opts\)/.test(setupUi),
  'setup-ui.js must define hgGateLedgerBadge');
assert.ok(/W\.hgGateLedgerBadge = hgGateLedgerBadge/.test(setupUi),
  'hgGateLedgerBadge must be exposed on W');

/* --- helper called from card renderers --- */
assert.ok(/hgGateLedgerBadge\(setup\.gateMeta\)/.test(setupUi),
  'hgSetupCardHTML must call hgGateLedgerBadge(setup.gateMeta)');
assert.ok(/hgGateLedgerBadge\(bookMeta\.gateMeta\)/.test(idx),
  'cardHTML must call hgGateLedgerBadge(bookMeta.gateMeta)');

/* --- SWING/SCALP CLEAN + NEAR renderers propagate gateMeta into bookMeta --- */
assert.ok(idx.includes("/* v650: per-gate ledger badge on CLEAN SWING cards */"),
  'renderSwingCleanCard must include v650 gateMeta on bookMeta');
assert.ok(idx.includes("/* v650: per-gate ledger badge on CLEAN SCALP cards */"),
  'renderScalpCleanCard must include v650 gateMeta on bookMeta');
assert.ok(idx.includes("/* v650: per-gate ledger badge on NEAR cards */"),
  'near-card hgSetupCardHTML call must pass v650 gateMeta');
assert.ok(idx.includes("/* v650: per-gate ledger badge on NEAR fallback cards */"),
  'near-card cardHTML fallback must pass v650 gateMeta');

/* --- CSS classes for the badge --- */
assert.ok(/\.hg-gld\s*\{/.test(idx),  'index.html must define .hg-gld CSS');
assert.ok(/\.hg-gld-dot\s*\{/.test(idx), 'index.html must define .hg-gld-dot CSS');
assert.ok(/\.hg-gld-dot\.pass\s*\{/.test(idx), '.hg-gld-dot.pass CSS required');
assert.ok(/\.hg-gld-dot\.veto\s*\{/.test(idx), '.hg-gld-dot.veto CSS required');
assert.ok(/\.hg-gld-dot\.na\s*\{/.test(idx), '.hg-gld-dot.na CSS required');

/* --- behavioural: helper produces expected HTML --- */
const helperMatch = setupUi.match(/function hgGateLedgerBadge\(gateMeta, opts\)\s*\{[\s\S]*?\n\}/);
assert.ok(helperMatch, 'could not extract hgGateLedgerBadge');
const ctx = { W: {}, suEsc: (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'), out: null };
vm.createContext(ctx);
vm.runInContext(helperMatch[0] + '\nout = hgGateLedgerBadge;', ctx);
const badge = ctx.out;

assert.equal(badge(null), '', 'null gateMeta -> empty');
assert.equal(badge([]), '', 'empty array -> empty');
assert.equal(badge('nope'), '', 'non-array -> empty');

const allPass = [
  {id:'G1',label:'G1 trend',state:'pass',detail:'ok'},
  {id:'G2',label:'G2 sweep',state:'pass',detail:'ok'},
  {id:'G3',label:'G3 RSI',state:'pass',detail:'ok'},
];
const html = badge(allPass);
assert.ok(html.includes('hg-gld'), 'badge must include hg-gld class');
assert.ok(html.includes('3/3'), 'badge summary must say 3/3');
assert.ok(html.includes('hg-gld-dot pass'), 'pass dot class required');
assert.ok(!html.includes('hg-gld-dot veto'), 'no veto class for all-pass input');

const mixed = [
  {id:'G1',label:'G1 trend',state:'pass'},
  {id:'G2',label:'G2 sweep/reclaim',state:'veto',detail:'no trigger'},
  {id:'G3',label:'G3 RSI',state:'na'},
];
const html2 = badge(mixed);
assert.ok(html2.includes('1/3'), 'mixed summary 1/3');
assert.ok(html2.includes('hg-gld-dot pass'), 'has pass dot');
assert.ok(html2.includes('hg-gld-dot veto'), 'has veto dot');
assert.ok(html2.includes('hg-gld-dot na'), 'has na dot');
assert.ok(html2.includes('title="G2 sweep/reclaim &mdash; no trigger (veto)"')
      || html2.includes('title="G2 sweep/reclaim — no trigger (veto)"'),
  'veto dot title must include label + detail');
/* glyph should be '2' for G2 */
assert.ok(/hg-gld-dot veto"[^>]*>2</.test(html2), 'G2 dot glyph must be 2');

/* --- version bump --- */
assert.ok(/^hg-v(?:650|65[1-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v650 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const cacheRx = new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'");
assert.ok(cacheRx.test(sw), 'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

/* --- every local script tag cache-busted --- */
const localSrcs = (idx.match(/src="[^"]+\.js[^"]*"/g) || []).filter(s =>
  !s.includes('http://') && !s.includes('https://') && !s.startsWith('src="//'));
const stamped = localSrcs.filter(s => s.includes('?v=' + qv));
assert.ok(stamped.length === localSrcs.length,
  `every local script tag must be cache-busted with ?v=${qv} (${stamped.length}/${localSrcs.length})`);

console.log('OK — v650: gate ledger badge on scan cards');
console.log('  * hgGateLedgerBadge helper handles null/empty/mixed/na correctly');
console.log('  * SWING CLEAN, SCALP CLEAN, and NEAR cards all propagate gateMeta into bookMeta');
console.log('  * CSS classes (.hg-gld, .hg-gld-dot .pass|.veto|.na) all present');
console.log('  * dot glyph derived from gate id (G2 -> "2"), title carries label + detail');
console.log('  * ' + stamped.length + ' script tags all cache-busted with ?v=' + qv);
console.log('  * version bumped to ' + HG_VER);
