/* HARDGATE — adverse/favourable excursion, heat profile, and the stop sweep.
   WHAT WAS MISSING. Every measurement in this repo so far answers "did the
   setup work". None answered "was the stop in the right place" — and that is
   the lever that moves a win rate. The ledger recorded entry, stop, target and
   outcome, but never how much heat a trade took on its way to that outcome.
   Two pairs are recorded, and mixing them up would break both tools:
     maeR / mfeR          up to the actual exit — describes trades AS TAKEN,
                          and drives the heat profile
     maeFullR / mfeFullR  over the whole settlement window, ignoring the exit —
                          the counterfactual, and drives the stop sweep
   The full-window pair is what makes the sweep two-sided. A trade that was
   stopped at -1R may have run to +3R afterwards; only the full-window numbers
   can see that. A sweep built on to-exit data alone can only show which
   winners a TIGHTER stop would have killed, never which losers a WIDER one
   would have saved, so it always argues for wider stops.
   And a wider stop is not free: R rescales with it. A loss is still exactly
   -1R by definition, but a target that paid +2R now pays +2/k R, because the
   same price move is a smaller multiple of a bigger risk.
   Run: node tests/test-excursions.mjs                                        */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout,
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  document: { getElementById: () => null, addEventListener(){} },
  fetch: () => Promise.reject(new Error('no net')) };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8'), ctx, { filename: 'scorecard.js' });
const AT = 1754400000000, T0 = AT / 1000;
/* long: entry 100, stop 99 (risk 1.00), t1 102 (= 2R) */
const PLAN = { dir: 'long', entry: 100, stop: 99, t1: 102, t2: 104, at: AT };
const bar = (i, h, l, c) => ({ t: T0 + (i + 1) * 3600, o: c, h, l, c });
console.log('== excursions are measured in R of the original plan ==');
{
  /* fills at 100 on bar 0, dips to 99.4 (0.6R heat), then runs to 102 (2R) */
  /* the last bar must also clear t2, or T1-touched-and-still-running is OPEN
     (correctly) and there is no settled winner to inspect */
  const bars = [bar(0, 100.1, 99.4, 99.8), bar(1, 100.5, 99.7, 100.4), bar(2, 104.2, 100.3, 104.0)];
  const w = ctx.hgScoreWalk(PLAN, bars);
  ok(w.state === 'T1' || w.state === 'T2', 'the trade resolves as a winner (' + w.state + ')');
  ok(Math.abs(w.maeR - 0.6) < 1e-6, 'MAE is 0.60R — the dip to 99.4 on a 1.00 risk');
  ok(w.mfeR >= 2.0, 'MFE reaches at least the 2R target');
  ok(w.maeR < 1, 'and it never reached the stop, or it would not be a winner');
}
console.log('== a short measures heat the other way ==');
{
  const S = { dir: 'short', entry: 100, stop: 101, t1: 98, at: AT };
  const bars = [bar(0, 100.5, 99.8, 100.0), bar(1, 100.2, 97.8, 97.9)];
  const w = ctx.hgScoreWalk(S, bars);
  ok(Math.abs(w.maeR - 0.5) < 1e-6, 'MAE 0.50R — the rally to 100.5 hurts a short');
  ok(w.mfeR >= 2.0, 'MFE 2R+ — the drop to 97.8 helps it');
}
console.log('== full-window excursions keep looking AFTER the exit ==');
{
  /* stopped at 99 on bar 1, but the tape then runs to 104 */
  const bars = [bar(0, 100.2, 99.9, 100.1), bar(1, 100.1, 98.9, 99.0),
                bar(2, 101.5, 99.2, 101.4), bar(3, 104.2, 101.3, 104.0)];
  const w = ctx.hgScoreWalk(PLAN, bars);
  ok(w.state === 'SL' && w.r === -1, 'the trade really was stopped');
  ok(w.mfeR < 1, 'to-exit MFE stays small — it never went anywhere before the stop');
  ok(w.mfeFullR > 3.5, 'but full-window MFE sees the +4R run that followed (' + w.mfeFullR + 'R)');
  ok(w.maeFullR >= 1, 'and full-window MAE still records that it breached the stop');
}
console.log('== heat profile reads the TO-EXIT pair ==');
{
  const recs = [];
  for (let i = 0; i < 12; i++) recs.push({ status: 'settled', r: 2,  maeR: 0.3 + i * 0.05, mfeR: 2.2 });
  for (let i = 0; i < 12; i++) recs.push({ status: 'settled', r: -1, maeR: 1.1, mfeR: 0.4 + i * 0.05 });
  const h = ctx.hgHeatProfile(recs);
  ok(h.nWin === 12 && h.nLoss === 12, 'winners and losers are separated');
  ok(h.winners.p50 > 0.5 && h.winners.p50 < 0.65, 'median winner heat ~0.58R');
  ok(h.winners.p90 > h.winners.p50, 'p90 sits above p50');
  ok(Math.abs(h.stopMarginR - (1 - h.winners.p90)) < 1e-9,
     'stop margin is what is left above p90 winner heat (' + h.stopMarginR + 'R)');
  ok(h.losers.p50 > 0.6, 'median loser ran ' + h.losers.p50 + 'R in favour before failing');
  ok(ctx.hgHeatProfile([]).winners === null, 'an empty ledger reports null, not zero');
  ok(/thin sample/.test(ctx.hgHeatProfile(recs.slice(0, 4)).note), 'a thin sample says so');
}
console.log('== the stop sweep recovers a KNOWN-correct answer ==');
{
  /* Ground truth: winners dip 0.90-1.25R before running to 2R+.
     A 1.0x stop kills them; 1.25x keeps them; wider than that only shrinks R. */
  function rng(seed){ let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  const r = rng(20260806), recs = [];
  for (let i = 0; i < 400; i++){
    const good = r() < 0.55;
    recs.push({ status: 'settled', entry: 100, stop: 99, t1: 102,
                maeFullR: good ? 0.9 + r() * 0.35 : 1.6 + r() * 1.5,
                mfeFullR: good ? 2.0 + r() * 1.5 : 0.2 + r() * 0.5 });
  }
  const sw = ctx.hgStopSweep(recs);
  ok(sw.n === 400, 'all 400 records are usable');
  ok(sw.best.k === 1.25, 'the sweep picks k = 1.25, exactly where the truth sits');
  const at1 = sw.rows.find(x => x.k === 1.0), at125 = sw.rows.find(x => x.k === 1.25);
  ok(at1.expectancyR < 0 && at125.expectancyR > 0, 'a 1.0x stop loses, a 1.25x stop wins');
  const at2 = sw.rows.find(x => x.k === 2.0);
  ok(at2.expectancyR < at125.expectancyR,
     'and going WIDER than needed hurts — R rescales, so the same move pays less');
  ok(at2.stoppedPct < at125.stoppedPct, 'even though a 2.0x stop is hit less often');
}
console.log('== the sweep degrades honestly ==');
{
  const empty = ctx.hgStopSweep([]);
  ok(empty.n === 0 && empty.rows.length === 0, 'no records -> no rows');
  ok(/fills in as trades settle/.test(empty.note), 'and it says why rather than showing zeros');
  const noEx = ctx.hgStopSweep([{ status: 'settled', entry: 100, stop: 99, t1: 102 }]);
  ok(noEx.n === 0, 'a pre-pack-15 record with no excursions is skipped, never defaulted to 0');
  const noTgt = ctx.hgStopSweep([{ status: 'settled', maeFullR: 0.5, mfeFullR: 2 }]);
  ok(noTgt.n === 0, 'a record with no derivable target in R is skipped');
  const thin = ctx.hgStopSweep([{ status: 'settled', entry: 100, stop: 99, t1: 102, maeFullR: 0.5, mfeFullR: 2.5 }]);
  ok(/inside the noise/.test(thin.note), 'a thin sweep warns that the gaps are noise');
}
console.log('\n' + passed + ' passed, 0 failed');
