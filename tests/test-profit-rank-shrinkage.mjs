/* HARDGATE — the profit-rank boost must not promote noise.
   THE DEFECT. hgProfitRankHint turns settled-ledger expectancy into a sort
   boost, and in index.html:5536 that boost is the PRIMARY sort key for BEST —
   ahead of famScore, robScore and R:R. HINT_MIN_N was 3, so three settled
   trades could reorder the whole ranking.
   Fed ledgers with EXACTLY ZERO true edge (2R target at a 33.3% hit rate, so
   expectancy is 0 by construction), measured on the real function:
       n     mean|boost|   P(>= +10)   P(<= -10)   max     min
       3        6.05        25.6%       29.9%     +20.0   -10.0
      80        1.29         0.0%        0.0%      +6.5    -4.8
   And the consequence that matters, two CLEAN candidates where the weaker one
   simply has three lucky trades behind it:
       BEFORE: the 3-trade lucky symbol outranks the stronger setup 25.1%
       AFTER:  0.0%
   THE FIX is empirical-Bayes shrinkage, not just a higher threshold. A hard
   floor is a cliff — n=9 counts for nothing, n=10 counts fully. Shrinking by
   n/(n+k) with k = sigma^2/tau^2 degrades smoothly, keeps most of a real edge
   at large n, and keeps almost none of a small-sample one. sigma is measured
   from the ledger's own R spread; tau is the prior spread of a genuine edge.
   Run: node tests/test-profit-rank-shrinkage.mjs                             */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const SRC = fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8');
function rng(seed){ let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
/* p = hit rate on a 2R target. expectancy = 3p - 1, so p = 1/3 is EXACTLY zero edge. */
function ledger(n, seed, p, sym){
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++){
    const win = r() < p;
    out.push({ id: sym + i, sym, dir: 'long', tier: 'PRIME', lane: 'crypto', layers: ['SWING'],
               status: 'settled', outcome: win ? 'T2' : 'SL', r: win ? 2 : -1, rNet: win ? 2 : -1,
               entry: 100, stop: 99, t1: 102, at: Date.now() - i * 86400000 });
  }
  return out;
}
function ctxWith(recs){
  const store = { hg_score_v1: JSON.stringify(recs) };
  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout,
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, addEventListener(){} }, fetch: () => Promise.reject(new Error('x')) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'scorecard.js' });
  return ctx;
}
const boostOf = (recs, sym) => ctxWith(recs)
  .hgProfitRankHint({ sym, dir: 'long', tier: 'PRIME', lane: 'crypto', layers: ['SWING'], rr1: 2 }).boost || 0;
console.log('== the shrink weight is derived, not guessed ==');
{
  const c = ctxWith([]);
  ok(typeof c.hgHintShrink === 'function' && typeof c.hgHintSigma === 'function', 'both helpers are exported');
  const sig = 1.4, k = (sig * sig) / (0.30 * 0.30);   /* ~21.8 */
  ok(Math.abs(c.hgHintShrink(k, sig) - 0.5) < 1e-9, 'n = k keeps exactly half the estimate');
  ok(c.hgHintShrink(3, sig) < 0.13, 'n=3 keeps under 13% — three trades are nearly no information');
  ok(c.hgHintShrink(100, sig) > 0.80, 'n=100 keeps over 80% — a real sample mostly survives');
  ok(c.hgHintShrink(0, sig) === 0 && c.hgHintShrink(-5, sig) === 0, 'zero or negative n keeps nothing');
  let prev = -1;
  [1, 5, 10, 25, 50, 100, 400].forEach(n => {
    const w = c.hgHintShrink(n, sig);
    ok(w > prev, 'shrink rises monotonically at n=' + n + ' (' + w.toFixed(3) + ')');
    prev = w;
  });
  ok(c.hgHintShrink(1e9, sig) < 1, 'and never reaches 1 — no sample is perfect');
}
console.log('== sigma is measured from the ledger, not assumed ==');
{
  const c = ctxWith([]);
  ok(c.hgHintSigma([]) === 1.40, 'an empty ledger falls back to the documented 1.40');
  ok(c.hgHintSigma(ledger(4, 11, 1 / 3, 'X')) === 1.40, 'under 8 settled rows still falls back');
  const wide = c.hgHintSigma(ledger(200, 11, 1 / 3, 'X'));
  ok(wide > 1.2 && wide < 1.6, 'a 2R/-1R book measures ~1.4 (' + wide.toFixed(3) + ')');
  const flat = c.hgHintSigma(new Array(50).fill(0).map((_, i) => ({ r: 0.5 })));
  ok(flat === 1.40, 'a zero-variance ledger falls back rather than dividing by ~0');
}
console.log('== a ZERO-edge ledger no longer moves the ranking ==');
{
  let big = 0, mx = 0;
  const T = 400;
  for (let t = 0; t < T; t++){
    const b = boostOf(ledger(3, 7919 * t + 5, 1 / 3, 'AAAUSD'), 'AAAUSD');
    if (Math.abs(b) >= 10) big++;
    if (Math.abs(b) > mx) mx = Math.abs(b);
  }
  ok(big === 0, 'n=3 never produces a |boost| >= 10 (it did 55.5% of the time before)');
  ok(mx === 0, 'n=3 produces no boost at all — below HINT_MIN_N it is not evidence');
}
console.log('== a REAL edge still gets promoted, just proportionately ==');
{
  const avg = (p, n) => {
    let s = 0; const T = 200;
    for (let t = 0; t < T; t++) s += boostOf(ledger(n, 7919 * t + 13, p, 'AAAUSD'), 'AAAUSD');
    return s / T;
  };
  const none = avg(1 / 3, 100), real = avg(0.45, 100), strong = avg(0.50, 100);
  ok(Math.abs(none) < 0.5, 'no edge at n=100 averages ~0 (' + none.toFixed(2) + ')');
  ok(real > 2.0, 'a real +0.35R edge at n=100 still earns a meaningful boost (' + real.toFixed(2) + ')');
  ok(strong > real, 'and a stronger edge earns more (' + strong.toFixed(2) + ')');
  ok(avg(0.45, 30) < real, 'the SAME edge on 30 trades earns less than on 100 — sample size is priced in');
  ok(avg(0.45, 30) > 0.8, 'but 30 trades of a real edge is not thrown away either');
}
console.log('== proven-negative still demotes ==');
{
  let s = 0; const T = 200;
  for (let t = 0; t < T; t++) s += boostOf(ledger(100, 7919 * t + 31, 0.20, 'AAAUSD'), 'AAAUSD');
  ok(s / T < -1.5, 'a genuinely losing bucket is demoted, not merely ignored (' + (s / T).toFixed(2) + ')');
}
console.log('== the floor and the cap still hold ==');
{
  const src = SRC;
  ok(/var HINT_MIN_N\s*=\s*10;/.test(src), 'HINT_MIN_N is 10, raised from 3');
  ok(/var HINT_EDGE_PRIOR_R\s*=\s*0\.30;/.test(src), 'tau is stated as a constant, not inlined');
  ok(/shrink: Math\.round/.test(src), 'the shrink weight is reported in parts[] so the boost is auditable');
  let mx = 0;
  for (let t = 0; t < 200; t++){
    const b = boostOf(ledger(400, 7919 * t + 3, 0.60, 'AAAUSD'), 'AAAUSD');
    if (Math.abs(b) > mx) mx = Math.abs(b);
  }
  ok(mx <= 25, 'even a huge sample with a huge edge respects HINT_BOOST_CAP (' + mx.toFixed(1) + ')');
}
console.log('\n' + passed + ' passed, 0 failed');
