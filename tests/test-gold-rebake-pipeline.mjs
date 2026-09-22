/**
 * hg-v921 — the re-bake is runnable and writes its own literals.
 *
 * Two things stopped a re-bake being one command. The harnesses hardcoded
 * api.binance.com, which AGENTS.md documents many hosts cannot reach (HTTP
 * 451); and five literal blocks across goldind.js and omnigold.js had to be
 * hand-transcribed afterwards, which is how hg-v909 shipped a block derived
 * from the wrong analysis file.
 *
 * This guard pins the route helper's composition, and — the load-bearing part
 * — proves the writer round-trips the committed literals exactly and repairs
 * drift, by corrupting a copy and rebuilding it.
 */
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { klinesUrl, klinesRouteNote, DEFAULT_BASE } from '../lib/klines-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

/* ---- 1. the route is a parameter, and defaults to today's behaviour ---- */
console.log('1. the klines route');
{
  const P = { symbol: 'PAXGUSDT', interval: '1h', limit: 5 };
  const d = klinesUrl(P, {});
  eq(d.url, DEFAULT_BASE + '/api/v3/klines?symbol=PAXGUSDT&interval=1h&limit=5',
     'unset, the URL is byte-identical to the hardcoded one');
  eq(DEFAULT_BASE, 'https://api.binance.com', 'and the default origin is unchanged');
  const b = klinesUrl(P, { HG_KLINES_BASE: 'https://data-api.binance.vision' });
  ok(b.url.startsWith('https://data-api.binance.vision/api/v3/klines?'), 'a base override redirects the origin');
  ok(!b.url.includes('api.binance.com'), 'and does not also hit the default');
  const pr = klinesUrl(P, { HG_KLINES_PROXY: 'https://site.example' });
  ok(pr.url.startsWith('https://site.example/api/proxy?url='), 'a proxy wraps it in /api/proxy');
  ok(pr.url.includes(encodeURIComponent(DEFAULT_BASE)), 'carrying the upstream URL encoded');
  /* the two compose rather than fight */
  const both = klinesUrl(P, { HG_KLINES_BASE: 'https://mirror.example/', HG_KLINES_PROXY: 'https://site.example/' });
  ok(both.url.startsWith('https://site.example/api/proxy?url='), 'both set: the proxy is the outer hop');
  ok(both.url.includes(encodeURIComponent('https://mirror.example/api/v3/klines')), 'and the mirror is the inner one');
  ok(!both.url.includes('//api/v3'), 'a trailing slash on the base does not double up');
  /* absent params are omitted rather than sent empty */
  ok(!klinesUrl({ symbol: 'X', interval: '1h', limit: 2, endTime: undefined }, {}).url.includes('endTime'),
     'an absent endTime is omitted, not sent blank');
  ok(klinesUrl({ symbol: 'X', interval: '1h', limit: 2, endTime: 123 }, {}).url.includes('endTime=123'),
     'and a present one is sent');
  /* the note tells a blocked reader what to set */
  ok(/HG_KLINES_BASE/.test(klinesRouteNote({})) && /geo-blocked/.test(klinesRouteNote({})),
     'the default note names the escape hatch and why it exists');
  ok(/overridden/.test(klinesRouteNote({ HG_KLINES_BASE: 'https://x' })), 'an override says so');
}

/* ---- 2. both harnesses use it ---- */
console.log('2. the harnesses are wired');
for (const f of ['scripts/backtest-goldscalp.mjs', 'scripts/backtest-omnigold.mjs']){
  const s = readFileSync(join(ROOT, f), 'utf8');
  ok(/from '\.\.\/lib\/klines-source\.mjs'/.test(s), f + ' imports the route helper');
  ok(/klinesUrl\(\{ symbol:/.test(s), f + ' builds its URL through it');
  ok(!/'https:\/\/api\.binance\.com\/api\/v3\/klines/.test(s), f + ' no longer hardcodes the origin');
  ok(/klinesRouteNote\(\)/.test(s), f + ' prints which route it used');
}

/* ---- 3. THE WRITER: round-trips the committed literals, and repairs drift ---- */
console.log('3. the literal writer');
{
  /* a. on the committed tree it must report no drift — which means it
     reproduces every block that was hand-transcribed into place */
  const clean = execFileSync(process.execPath, [join(ROOT, 'scripts/rebake-gold-literals.mjs')],
    { encoding: 'utf8', cwd: ROOT });
  ok(/every baked literal already equals its artifact/.test(clean),
     'the committed literals already equal the artifacts');
  ok(!/DIFFERS/.test(clean), 'and nothing is reported as drifted');

  /* b. corrupt a copy of the tree and require an exact rebuild. This is the
     real test: detection alone would pass while the write mangled the file. */
  const dir = mkdtempSync(join(tmpdir(), 'hg-v921-'));
  const keep = {};
  try {
    for (const f of ['goldind.js', 'omnigold.js']){
      keep[f] = join(dir, f.replace('/', '_'));
      copyFileSync(join(ROOT, f), keep[f]);
    }
    let gi = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
    const giBefore = gi;
    gi = gi.replace(/live: \{ n: 263, net: -0\.049, oosHeld: \d, oosBroke: \d \}/,
                    'live: { n: 999, net: 0.5, oosHeld: 0, oosBroke: 0 }');
    ok(gi !== giBefore, 'the goldind fixture actually corrupted a live block');
    writeFileSync(join(ROOT, 'goldind.js'), gi);

    let og = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
    const ogBefore = og;
    og = og.replace("'SCALP/FAIR': { lo: [210, 0.2414, -0.3434], hi: [156, 0.404, 0.1449] }",
                    "'SCALP/FAIR': { lo: [1, 0.1, -9.9], hi: [1, 0.1, 9.9] }");
    ok(og !== ogBefore, 'the omnigold fixture actually corrupted a cell');
    writeFileSync(join(ROOT, 'omnigold.js'), og);

    const dirty = execFileSync(process.execPath, [join(ROOT, 'scripts/rebake-gold-literals.mjs')],
      { encoding: 'utf8', cwd: ROOT });
    ok(/goldind\.js[^\n]*DIFFERS/.test(dirty), 'the drift is detected in goldind.js');
    ok(/omnigold\.js[^\n]*DIFFERS/.test(dirty), 'and in omnigold.js');
    ok(/run with --write/.test(dirty), 'and it writes nothing without --write');
    /* without --write the files must be untouched */
    eq(readFileSync(join(ROOT, 'goldind.js'), 'utf8'), gi, 'a dry run leaves goldind.js exactly as it found it');

    execFileSync(process.execPath, [join(ROOT, 'scripts/rebake-gold-literals.mjs'), '--write'],
      { encoding: 'utf8', cwd: ROOT });


    for (const f of ['goldind.js', 'omnigold.js'])
      eq(readFileSync(join(ROOT, f), 'utf8'), readFileSync(keep[f], 'utf8'),
         f + ' is rebuilt BYTE-IDENTICAL to the committed file');

    /* c. A BLOCK IT CANNOT FIND MUST BE FATAL, not skipped. Every block is
       present today, so that branch never fires and a mutation removing it
       survives — exercise it by renaming one, because silently skipping a
       block a future rename breaks is how a literal goes stale while the
       writer reports success. */
    const renamed = readFileSync(join(ROOT, 'omnigold.js'), 'utf8')
      .replace('\n    stopBandGross: {', '\n    stopBandGrossRenamed: {');
    ok(renamed !== readFileSync(join(ROOT, 'omnigold.js'), 'utf8'), 'the rename fixture applied');
    writeFileSync(join(ROOT, 'omnigold.js'), renamed);
    let threw = false, msg = '';
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts/rebake-gold-literals.mjs')],
        { encoding: 'utf8', cwd: ROOT, stdio: 'pipe' });
    } catch (e) { threw = true; msg = String((e && e.stderr) || e); }
    ok(threw, 'a block it cannot locate is FATAL, not skipped');
    ok(/could not locate stopBandGross/.test(msg), 'and it names the block it could not find');
    ok(/refusing to guess/.test(msg), 'and says it will not guess');
  } finally {
    /* restore whatever happened — a guard must not leave the tree edited */
    for (const f of ['goldind.js', 'omnigold.js'])
      if (keep[f]) copyFileSync(keep[f], join(ROOT, f));
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ---- 4. the chain is one command, in the right order ---- */
console.log('4. the pipeline');
{
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const chain = pkg.scripts['gold:rebake'];
  ok(chain, 'npm run gold:rebake exists');
  const steps = ['backtest-goldscalp', 'backtest-omnigold', 'omnigold-evidence-bake',
                 'rebake-gold-literals', 'npm test'];
  let at = -1;
  for (const s of steps){
    const i = chain.indexOf(s);
    ok(i > at, 'the chain runs ' + s + ' after the step before it');
    at = i;
  }
  ok(/rebake-gold-literals\.mjs --write/.test(chain), 'the literal write is the step before the gate');
  ok(chain.trim().endsWith('npm test'), 'and the suite is last, so a bad bake cannot land quietly');
  ok(pkg.scripts['gold:literals'] && !/--write/.test(pkg.scripts['gold:literals']),
     'gold:literals is the read-only drift check');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
