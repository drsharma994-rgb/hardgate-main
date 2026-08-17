/* HARDGATE — the GOLD COINT tab reported a statistic on invented data.

   goldcoint.js is one of the modules no test executes. Reading how it builds
   its series found the worst instance of this session's theme: the XAU and
   XAG inputs were MANUFACTURED.

     var gj = await fetch('https://api.gold-api.com/price/XAU') ...
     for (i = 0; i < 150; i++) gold.unshift(+gj.price * (1 + (i - 75) * 0.0001));

   One spot price per metal, expanded into 150 "historical" points by a fixed
   linear ramp. Two straight lines are trivially cointegrated, so hgCoint
   returned, on the real constants above:

     cointegrated: true, adfStat: -10.31, halfLifeBars: 0.38, n: 150

   A confident cointegration result measuring the two multipliers in the
   source, not the metals — printed as the XAU / XAG row beside rows built
   from real Binance klines, indistinguishable from them.

   The estimator was not at fault and is not "fixed" here: fed those ramps it
   still says cointegrated, correctly, because they are. The input is what had
   to change. Real daily history from the same routed sources macro-feeds.js
   uses, or an empty series and an honest "insufficient data" row.

   A second, quieter defect in hgCoint itself: the two series were filtered
   for finite values INDEPENDENTLY and then truncated to a common length, so
   three gaps in one feed paired every observation three bars apart for the
   whole series. Gaps are dropped pairwise now.

   Run: node tests/test-gold-coint.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'fixpack14-core.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.hgCoint;

/* The exact ramps the tab used to build. */
function fabricated(){
  const gold = [], silver = [];
  for (let i = 0; i < 150; i++) gold.unshift(3350.25 * (1 + (i - 75) * 0.0001));
  for (let j = 0; j < 150; j++) silver.unshift(41.80 * (1 + (j - 75) * 0.00015));
  return { gold, silver };
}
/* A random-walking pair sharing a stochastic trend. */
function walkPair(n){
  const a = [], b = [];
  let p = 3300, resid = 0;
  for (let i = 0; i < n; i++){
    p = p * (1 + Math.sin(i * 1.7) * 0.004 + Math.cos(i * 0.9) * 0.002);
    resid = resid * 0.85 + Math.sin(i * 3.1) * 0.04;   /* mean-reverting spread */
    a.push(p);
    b.push(p / 80 + resid);
  }
  return { a, b };
}

console.log('== the estimator is reachable ==');
{
  ok(typeof C === 'function', 'hgCoint is exported');
  ok(typeof ctx.hgCointHalfLifeVeto === 'function', 'hgCointHalfLifeVeto is exported');
}

console.log('\n== THE DEFECT: the fabricated series really did read as cointegrated ==');
{
  /* Kept as a live check, because it is the reason the tab had to change. The
     estimator is right; the input was not. */
  const { gold, silver } = fabricated();
  const r = C(gold, silver);
  ok(r && r.cointegrated === true, 'two straight lines report cointegrated:true — as they genuinely are');
  ok(r.n === 150, 'over all 150 fabricated points');
  ok(Math.abs(r.adfStat) > 5, 'with a large ADF statistic (' + r.adfStat.toFixed(2) + ') — high confidence in nothing');
  ok(r.halfLifeBars < 1, 'and a sub-bar half-life (' + r.halfLifeBars.toFixed(2) + '), which no real metal pair has');

  /* And the tab no longer builds them. */
  const src = fs.readFileSync(path.join(ROOT, 'goldcoint.js'), 'utf8');
  ok(!/gold\.unshift\(\+gj\.price/.test(src), 'the gold ramp is gone from goldcoint.js');
  ok(!/silver\.unshift\(\+sj\.price/.test(src), 'the silver ramp is gone too');
  ok(!/api\.gold-api\.com/.test(src), 'and the single-spot-price fetch it was built from');
  ok(/getGoldCandles\('1d', 150\)/.test(src), 'real daily gold candles are requested instead');
  ok(/getSilverCandles\('1d', 150\)/.test(src), 'and real daily silver candles');
  ok(/insufficient data/.test(src), 'with an honest row when they cannot be had');
}

console.log('\n== gaps are dropped in PAIRS, so the series stay aligned ==');
{
  const { a, b } = walkPair(150);
  const clean = C(a, b);
  ok(clean !== null, 'a 150-bar pair produces a result');
  ok(clean.n === 150, 'over all 150 bars');

  const gappy = a.slice();
  gappy[10] = NaN; gappy[40] = NaN; gappy[90] = NaN;
  const g = C(gappy, b);
  ok(g !== null, 'three gaps in one series still produces a result');
  ok(g.n === 147, 'over 147 pairs — the partner bars were dropped too (' + g.n + ')');

  /* The old code filtered each side alone, so `a` lost 3 and `b` lost 0, then
     both were sliced to 147 — pairing a[i] with b[i+3] for the whole series.
     Reproduce that here so the difference is measured, not asserted. */
  const oldA = gappy.filter(x => isFinite(x)).slice(-147);
  const oldB = b.filter(x => isFinite(x)).slice(-147);
  let drift = 0;
  for (let i = 0; i < 147; i++) if (oldA[i] !== a.filter(x => isFinite(x))[i]) { drift++; }
  ok(oldB[0] !== b[0], 'the pre-fix pairing really did shift one side (b[0] ' + b[0].toFixed(4)
    + ' vs paired ' + oldB[0].toFixed(4) + ')');

  /* +null and +'' are both 0, so a coercion before the finite test lets a
     missing price through AS ZERO — a fabricated observation in a regression,
     which is worse than a dropped bar. My first version of the pairwise loop
     did exactly that and this assertion caught it. */
  const nullsBoth = a.slice();
  nullsBoth[5] = null;
  const nb = C(nullsBoth, b);
  ok(nb.n === 149, 'a null is dropped as a pair, not read as price zero (' + nb.n + ')');
  const emptyStr = a.slice();
  emptyStr[7] = '';
  ok(C(emptyStr, b).n === 149, 'an empty string is dropped too, not read as zero');
  const undef = a.slice();
  undef[9] = undefined;
  ok(C(undef, b).n === 149, 'and undefined');
}

console.log('\n== unalignable input is declined, not guessed ==');
{
  const { a, b } = walkPair(150);
  const short = C(a, b.slice(0, 140));
  ok(short && short.cointegrated === false, 'series of different lengths are not called cointegrated');
  ok(/lengths differ/.test(short.note), 'and the note says why (' + short.note + ')');
  ok(short.n === 0, 'with no sample count claimed');

  ok(C([], []) === null, 'empty series yield null');
  ok(C(null, null) === null, 'null input does not throw');
  const tooShort = walkPair(60);
  ok(C(tooShort.a, tooShort.b) === null, 'fewer than 120 bars yields null rather than a thin verdict');
}

console.log('\n== the half-life veto reads the estimate honestly ==');
{
  const V = ctx.hgCointHalfLifeVeto;
  const fast = V({ cointegrated: true, halfLifeBars: 5, spreadZ: 2.5 }, 42);
  ok(fast && typeof fast.veto === 'boolean', 'a fast-reverting pair gets a boolean verdict');
  const slow = V({ cointegrated: true, halfLifeBars: 400, spreadZ: 2.5 }, 42);
  ok(slow && slow.veto === true, 'a half-life far beyond the barrier is vetoed (' + slow.reason + ')');
  const none = V({ cointegrated: false, halfLifeBars: null, spreadZ: null }, 42);
  ok(none && typeof none.reason === 'string', 'a non-cointegrated pair still returns a stated reason');
  let threw = null;
  try { V(null, 42); } catch (e) { threw = e; }
  ok(!threw, 'a null estimate does not throw');
}

console.log('\n== the tab declines rather than inventing a row ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldcoint.js'), 'utf8');
  ok(/gold\.length >= 120 && silver\.length >= 120/.test(src), 'the XAU/XAG row needs 120 real bars on both sides');
  ok(/need ≥120 bars/.test(src), 'and says so when it does not have them');
  ok(/fixpack14-core not loaded/.test(src), 'a missing estimator is reported rather than skipped silently');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GOLD COINT TESTS PASSED');
