/* HARDGATE — a venue dropping one candle silently cost the whole contract.

   Found by fuzzing every exported function with FEED-SHAPED input, rather
   than by reading. Of 199 exported hg* functions, 24 threw on a rows array
   with a null entry in it — a dropped bar, which is an ordinary thing for a
   venue to return. hgOmniDetect was one of them.

   Pass 1 wraps each contract in a catch, so the sweep survived. What did not
   survive was the contract: it was counted as FAILED and produced no card at
   all. One missing candle, and a name vanished from the scan with no
   explanation on screen.

   Fixed at the single ingestion point rather than in 24 detectors. A hole in
   the data is a data problem; it is not something each detector should have
   an opinion about, and twenty-four guards would be twenty-four chances to
   get it subtly different.

   The first version of that fix used num() — and num(null) is 0, because
   +null is 0 and isFinite(0) is true. So a bar with a null CLOSE was admitted
   at the price zero: the exact trap this audit was sweeping for, written into
   the sweep's own fix. It uses fin() now.

   Run: node tests/test-feed-holes.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  const el = () => ({ style: {}, innerHTML: '', textContent: '', id: '', appendChild(){},
                      setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] });
  ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
                   querySelectorAll: () => [], head: { appendChild(){} }, body: el(),
                   documentElement: el(), addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const TF_SEC = 14400;
const T0 = 1700000000 - (1700000000 % TF_SEC);
const GOOD = (() => {
  const out = []; let p = 60000;
  for (let i = 0; i < 300; i++){ p = p * (1 + Math.sin(i / 9) * 0.004);
    out.push({ t: T0 + i * TF_SEC, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1000 }); }
  return out;
})();
/* nowSec far enough ahead that the last bar is closed and nothing is dropped
   for being forming — this test is about holes, not about the forming bar. */
const NOW = T0 + 300 * TF_SEC + 1;
const drop = rows => W.hgOmniDropForming(rows, '4h', NOW);

const CASES = {
  'one dropped bar mid-series': GOOD.map((r, i) => i === 150 ? null : r),
  'dropped bar at the END':     GOOD.map((r, i) => i === 299 ? null : r),
  'dropped bar at the START':   GOOD.map((r, i) => i === 0 ? null : r),
  'three dropped bars':         GOOD.map((r, i) => [50, 150, 250].includes(i) ? null : r),
  'bar with a null close':      GOOD.map((r, i) => i === 150 ? { ...r, c: null } : r),
  'empty object for a bar':     GOOD.map((r, i) => i === 150 ? {} : r),
  'undefined entry':            GOOD.map((r, i) => i === 150 ? undefined : r),
  'a string where a bar goes':  GOOD.map((r, i) => i === 150 ? 'n/a' : r)
};

console.log('== THE DEFECT: one missing candle used to cost the whole contract ==');
{
  /* Direct, bypassing ingestion — this is what the 24 functions do, and it is
     why the guard belongs at the door rather than in each of them. */
  let threwRaw = 0;
  for (const rows of Object.values(CASES)){
    try { W.hgOmniDetect(rows); } catch (e) { threwRaw++; }
  }
  ok(threwRaw > 0, 'raw hole-punched input still throws in the detectors (' + threwRaw + ' of '
    + Object.keys(CASES).length + ') — which is why ingestion must clean it');
}

console.log('\n== through the ingestion point, every one of them survives ==');
{
  for (const [name, rows] of Object.entries(CASES)){
    let threw = null, hits = null, kept = 0;
    try { const clean = drop(rows); kept = clean.length; hits = W.hgOmniDetect(clean); }
    catch (e) { threw = e; }
    ok(!threw, name + ' does not throw' + (threw ? ' — ' + threw.message : ''));
    ok(Array.isArray(hits), name + ' still produces a result (' + kept + ' bars kept)');
  }
}

console.log('\n== the hole is REMOVED, not passed through as a zero ==');
{
  /* num(null) is 0 because +null is 0, so a num()-based guard admits a null
     close at price zero — which would put a real bar at 0 into every level
     calculation downstream. */
  const nullClose = drop(CASES['bar with a null close']);
  ok(nullClose.length === 299, 'the null-close bar is dropped, not kept (' + nullClose.length + ' of 300)');
  ok(nullClose.every(r => r && isFinite(+r.c) && +r.c > 0), 'and no bar survives at price zero');

  const clean = drop(CASES['one dropped bar mid-series']);
  ok(clean.length === 299, 'a null entry is dropped (' + clean.length + ')');
  ok(clean.every(r => r && typeof r === 'object'), 'every survivor is an object');
  ok(clean.indexOf(null) < 0 && clean.indexOf(undefined) < 0, 'with no holes left');

  ok(drop(CASES['a string where a bar goes']).length === 299, 'a non-object entry is dropped too');
  ok(drop(CASES['empty object for a bar']).length === 299, 'and a bar with no close at all');
}

console.log('\n== a clean feed is untouched ==');
{
  const out = drop(GOOD);
  ok(out.length === GOOD.length, 'nothing is dropped from a clean series (' + out.length + ')');
  ok(out[0] === GOOD[0] && out[out.length - 1] === GOOD[GOOD.length - 1],
     'and the bars are the same objects — the guard filters, it does not rebuild');
}

console.log('\n== the forming-bar rule still works after sanitising ==');
{
  /* The sanitise runs FIRST, so the forming-bar check must still see the real
     last bar — if a null tail were left in place it would test the hole. */
  const nowInsideLastBar = T0 + 299 * TF_SEC + 60;
  const withForming = W.hgOmniDropForming(GOOD, '4h', nowInsideLastBar);
  ok(withForming.length === 299, 'a still-forming last bar is dropped (' + withForming.length + ')');

  /* With the null TAIL removed, the new last bar is bar 298 — which closed a
     full period ago, so it is NOT forming and must be kept. 299, not 298:
     sanitising first changes which bar the forming test is asked about, and
     that is the correct order. Dropping a second bar here would silently cost
     a closed candle on every feed with a hole at the end. */
  const holedTail = GOOD.map((r, i) => i === 299 ? null : r);
  const both = W.hgOmniDropForming(holedTail, '4h', nowInsideLastBar);
  ok(both.length === 299, 'the hole goes and the newly-last bar is kept because it HAS closed ('
    + both.length + ')');
  ok(both.every(r => r && isFinite(+r.c)), 'leaving only real bars');
  ok(both[both.length - 1].t === T0 + 298 * TF_SEC, 'and the last bar is the real one, not the hole');

  /* But a genuinely forming bar behind a hole must still go. */
  const holeThenForming = GOOD.concat([{ t: T0 + 300 * TF_SEC, o: 1, h: 1, l: 1, c: 1, v: 1 }])
                              .map((r, i) => i === 299 ? null : r);
  const r3 = W.hgOmniDropForming(holeThenForming, '4h', T0 + 300 * TF_SEC + 60);
  ok(r3.length === 299, 'a hole plus a genuinely forming tail drops both (' + r3.length + ')');
}

console.log('\n== the source says fin(), not num() ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  const gold = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/if \(!isFinite\(fin\(r\.c\)\)\) continue;/.test(src), 'omniroute guards with fin()');
  ok(/if \(!isFinite\(fin\(rr\.c\)\)\) continue;/.test(gold), 'omnigold guards with fin()');
  ok(!/isFinite\(num\(r\.c\)\)/.test(src), 'and num() is gone from the omniroute guard');
  ok(!/isFinite\(num\(rr\.c\)\)/.test(gold), 'and from the omnigold one');
}

console.log('\n== gold sanitises even without omniroute loaded ==');
{
  /* omnigold takes its drop function from omniroute by feature-check. If that
     is absent it must still not ingest a hole-punched array. */
  const gold = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  const guardAt = gold.indexOf('okRows.push(rr)');
  const dropAt = gold.indexOf('if (dropFn) rows = dropFn(rows, cfg.tf);');
  ok(guardAt > 0, 'omnigold has its own row guard');
  ok(guardAt < dropAt, 'and it runs BEFORE the feature-checked dropFn, so it applies either way');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FEED HOLE TESTS PASSED');
