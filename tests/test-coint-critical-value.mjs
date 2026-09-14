/* HARDGATE — hgCoint must use the RESIDUAL-based critical value, not the DF one.

   Run: node tests/test-coint-critical-value.mjs

   THE BUG THIS PINS
   -----------------
   hgCoint gated on `adf <= -2.86`. That is the Dickey-Fuller 5% value for a
   unit-root test on an OBSERVED series. The spread it tests is not observed —
   beta was fitted on the same data, and OLS by construction picks the beta that
   makes the residual look as stationary as it can. So the statistic's null
   distribution is shifted left and -2.86 rejects far too often. Measured over
   this exact arithmetic: 13-15% rejection against a nominal 5%, flat in n
   because it is an asymptotic error, not a small-sample one. On the four rows
   GOLD COINT renders, that is a ~48% chance of at least one false COINT per
   refresh versus 19% at a correct gate.

   The correct residual-based (Engle-Granger / MacKinnon, one regressor with a
   constant) 5% value is -3.34. Engle-Granger step 2 — the error-correction
   check that the adjustment coefficient is negative — was also missing entirely.

   WHY THE MAIN TEST IS A MONTE CARLO
   ----------------------------------
   The defect is a RATE, not a single value, so the honest test measures the
   rate. The PRNG is seeded, so this is deterministic and reproducible despite
   being a simulation — it will give the same answer on every machine and every
   run. Reverting the threshold to -2.86 pushes the measured rate back to ~13%
   and this test goes red. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'fixpack14-core.js']){
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) { try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch(e){} }
  }
  return ctx;
}
const W = boot();

/* seeded xorshift so the simulation is deterministic */
function prng(seed){
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function gaussFrom(rnd){
  return () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
}
function walk(n, p0, g){ const out = [p0]; for (let i = 1; i < n; i++) out.push(out[i - 1] * Math.exp(0.002 * g())); return out; }

console.log('== the estimator is reachable and reports its step-2 result ==');
ok(typeof W.hgCoint === 'function', 'hgCoint exported');
ok(typeof W.hgCointHalfLifeVeto === 'function', 'hgCointHalfLifeVeto exported');

console.log('== false-positive rate under the null (two INDEPENDENT random walks) ==');
{
  const TRIALS = 1200;
  for (const n of [150, 300]){
    const rnd = prng(12345), g = gaussFrom(rnd);
    let coint = 0, wouldPassOldAdf = 0;
    for (let t = 0; t < TRIALS; t++){
      const a = walk(n, 2000, g), b = walk(n, 30, g);
      const r = W.hgCoint(a, b);
      if (r && r.cointegrated) coint++;
      if (r && r.adfStat !== null && r.adfStat <= -2.86) wouldPassOldAdf++;
    }
    const rate = coint / TRIALS, oldRate = wouldPassOldAdf / TRIALS;

    /* the headline assertion: at or near nominal 5%, nowhere near 13% */
    ok(rate <= 0.08,
       'n=' + n + ': gate rejects ' + (rate * 100).toFixed(1) + '% of unrelated pairs (nominal 5%, must stay <=8%)');

    /* and the old threshold really was as loose as claimed — if this stops
       holding, the premise of the fix has changed and someone should look */
    ok(oldRate >= 0.10,
       'n=' + n + ': the old -2.86 threshold alone would have passed ' + (oldRate * 100).toFixed(1) + '% — the defect was real');

    ok(rate < oldRate / 1.8,
       'n=' + n + ': the fix roughly halves-or-better the false-positive rate (' + (oldRate * 100).toFixed(1) + '% -> ' + (rate * 100).toFixed(1) + '%)');
  }
}

console.log('== a genuinely mean-reverting pair still passes ==');
{
  /* b is a random walk; a tracks it with an OU error that pulls back, so the
     pair IS cointegrated and the gate must not reject it */
  /* b needs enough range that the cointegrating relation dominates the OU
     noise, or beta is estimated off a signal barely larger than its error and
     the recovery assertion below is measuring the fixture, not the estimator */
  const rnd = prng(777), g = gaussFrom(rnd);
  const n = 300, b = [100], a = [];
  for (let i = 1; i < n; i++) b.push(b[i - 1] * Math.exp(0.012 * g()));
  let err = 0;
  for (let i = 0; i < n; i++){ err = 0.85 * err + 0.4 * g(); a.push(2.5 * b[i] + 10 + err); }
  const r = W.hgCoint(a, b);
  ok(r && r.cointegrated === true, 'a true cointegrated pair is still accepted — note: ' + (r && r.note));
  ok(r && r.ecmAdj !== null && r.ecmAdj < 0, 'adjustment coefficient is negative (' + (r && r.ecmAdj != null ? r.ecmAdj.toFixed(4) : 'null') + ') — genuine error correction');
  ok(r && r.ecmAdjT !== null && r.ecmAdjT < -2, 'and its t-statistic clears the ECM bar (' + (r && r.ecmAdjT != null ? r.ecmAdjT.toFixed(2) : 'null') + ')');
  ok(Math.abs(r.beta - 2.5) < 0.15, 'hedge ratio recovered (' + r.beta.toFixed(3) + ' vs 2.5 built in)');
}

console.log('== every rejection says WHICH test failed ==');
{
  /* Swept over seeds rather than branched on one, so there is no path where
     this block passes without asserting anything — the suite has a guard
     against exactly that (tests/test-suite-not-vacuous.mjs) and it is right to. */
  const rejected = [];
  for (let seed = 4242; seed < 4262; seed++){
    const g = gaussFrom(prng(seed));
    const r = W.hgCoint(walk(200, 2000, g), walk(200, 30, g));
    if (r && !r.cointegrated) rejected.push(r);
  }
  ok(rejected.length > 0, 'independent walks produce rejections to inspect (' + rejected.length + '/20 seeds)');
  ok(rejected.every(r => /ADF|half-life|ECM/.test(r.note)),
     'every rejection names the failing test — e.g. "' + rejected[0].note + '"');
  ok(rejected.every(r => r.note !== 'not cointegrated'),
     'none falls back to a bare "not cointegrated"');
  ok(rejected.every(r => 'ecmAdj' in r && 'ecmAdjT' in r),
     'the step-2 result is reported on the object, not just used internally');
}

console.log('== the veto helper passes the diagnosis through ==');
{
  const vetoed = [];
  for (let seed = 99; seed < 119; seed++){
    const g = gaussFrom(prng(seed));
    const r = W.hgCoint(walk(200, 2000, g), walk(200, 30, g));
    if (r && !r.cointegrated) vetoed.push(W.hgCointHalfLifeVeto(r, 42));
  }
  ok(vetoed.length > 0, 'rejections reach the veto helper (' + vetoed.length + ' of 20 seeds)');
  ok(vetoed.every(v => v && v.veto === true), 'every non-cointegrated pair is vetoed');
  ok(vetoed.every(v => v.reason !== 'not cointegrated'),
     'the veto reason carries the detail — e.g. "' + vetoed[0].reason + '"');
}

console.log('== degenerate input still degrades cleanly ==');
{
  const flat = new Array(200).fill(100);
  const r = W.hgCoint(flat, flat);
  ok(r === null || r.cointegrated === false, 'a series against itself is refused or declined, never a confident yes');
  ok(W.hgCoint([1, 2, 3], [1, 2, 3]) === null, 'too few points returns null rather than a verdict');
  const mismatched = W.hgCoint(new Array(150).fill(1), new Array(140).fill(1));
  ok(mismatched && mismatched.cointegrated === false && mismatched.n === 0,
     'mismatched lengths are declined, not guessed');
}

console.log('\ntest-coint-critical-value: ' + passed + ' assertions passed');
