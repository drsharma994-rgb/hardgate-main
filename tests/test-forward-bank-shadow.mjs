/* HARDGATE — the bank-half-at-+1R shadow: out-of-sample evidence, not a fit.

   THE QUESTION IT ACCUMULATES EVIDENCE FOR. In-sample, 48% of stopped gold
   scalps had FIRST reached +1R — a partial would have banked them. That is
   the strongest unexploited signal found in the formation audit, and exactly
   the kind of thing this repo refuses to act on from one instrument's
   in-sample history. So the forward log now settles every record BOTH ways:
   as traded, and under "bank half at +1R, stop the rest to breakeven". In a
   few weeks the panel can say which policy paid, on trades recorded before
   their outcomes existed.

   WHAT THIS FILE PINS — each one a way the shadow could flatter itself:

     1. AMBIGUITY GOES AGAINST THE SHADOW. A bar touching both +1R and the
        stop is a STOP for both policies. A post-bank bar touching both
        breakeven and T1 banks only the half. If either broke, the shadow
        would win comparisons by construction and the evidence would be
        worthless.
     2. MATCHED PAIRS ONLY. Records without a shadow (expired, or T1 inside
        +1R) contribute to NEITHER column. Comparing the shadow against a
        different population than the actual is the fill-modelling mistake —
        counted trades that were never taken — wearing a new coat.
     3. PRUNING FOLDS THE SHADOW. The record list is capped; the aggregate
        must carry bankN/bankSum/bankActualSum or the long-run evidence this
        exists to build is destroyed by its own housekeeping.

   Run: node tests/test-forward-bank-shadow.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
              Number, String, Promise, RegExp, setTimeout, clearTimeout, Infinity, NaN };
ctx.window = ctx; ctx.globalThis = ctx;
ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });

const settle = ctx.hgFwdSettleOne || (ctx.window && ctx.window.hgFwdSettleOne);
ok(typeof settle === 'function', 'hgFwdSettleOne is exported');
/* hgFwdStats on window is the localStorage-backed wrapper (tab, mechanic,
   ticketOnly); the PURE core is exported as hgFwdStatsOf. Calling the wrong
   one silently matches nothing — the array lands in the tab slot. */
ok(typeof ctx.hgFwdStatsOf === 'function', 'hgFwdStatsOf (the pure core) is exported');
ok(typeof ctx.hgFwdFold === 'function', 'hgFwdFold is exported');

const T0 = 1700000000;
const bar = (i, h, l) => ({ t: T0 + (i + 1) * 3600, o: (h + l) / 2, h, l, c: (h + l) / 2, v: 1 });
/* a live long: entry 100, stop 90 (risk 10), T1 120 (2R). +1R = 110. */
const REC = () => ctx.hgFwdNormalize({ tab: 'T', mechanic: 'M', sym: 'X', tf: '1h', dir: 'long',
  entry: 100, stop: 90, t1: 120, barT: T0, horizonBars: 6 });

console.log('\n== the straightforward paths ==');
{
  /* reaches +1R, then T1: shadow banks half at +1R, rest rides to T1 */
  let r = settle(REC(), [bar(0, 111, 101), bar(1, 121, 111)]);
  ok(r.state === 't1', 'actual: T1');
  ok(r.oneR === true, '+1R was recorded as reached');
  ok(Math.abs(r.bankR - 1.5) < 1e-9, 'shadow = 0.5 + 0.5*2R = +1.5R (worse than the +2R ridden — the cost of banking)');

  /* reaches +1R, then falls back to entry, then to the old stop:
     actual = -1; shadow banked half and stopped flat = +0.5 */
  r = settle(REC(), [bar(0, 111, 101), bar(1, 105, 100), bar(2, 95, 89)]);
  ok(r.state === 'stop', 'actual: stopped after the retrace');
  ok(r.oneR === true, 'but +1R had traded first');
  ok(Math.abs(r.bankR - 0.5) < 1e-9, 'shadow = +0.5 — the 48% case this measurement exists for');

  /* straight to the stop: both policies lose 1R */
  r = settle(REC(), [bar(0, 105, 89)]);
  ok(r.state === 'stop' && r.oneR === false && Math.abs(r.bankR + 1) < 1e-9,
     'no +1R first: shadow loses the same -1R (bar high 105 < 110)');
}

console.log('\n== ambiguity resolves AGAINST the shadow ==');
{
  /* one bar spans stop AND +1R AND T1: stop wins for both policies */
  let r = settle(REC(), [bar(0, 121, 89)]);
  ok(r.state === 'stop', 'actual: the spanning bar is a STOP');
  ok(Math.abs(r.bankR + 1) < 1e-9, 'shadow: also -1 — it may not claim the bank on an unorderable bar');
  ok(r.oneR === false, 'and +1R is not credited on that bar');

  /* the +1R bar also touches entry: bank, then breakeven — never the ride */
  r = settle(REC(), [bar(0, 111, 99), bar(1, 121, 111)]);
  ok(r.state === 't1', 'actual: T1 on the second bar');
  ok(Math.abs(r.bankR - 0.5) < 1e-9,
     'shadow: +0.5 only — the bank bar touched entry, so the rest is assumed stopped flat');

  /* post-bank bar touches breakeven AND T1: the half is flat first */
  r = settle(REC(), [bar(0, 111, 101), bar(1, 121, 99)]);
  ok(r.state === 't1', 'actual: T1');
  ok(Math.abs(r.bankR - 0.5) < 1e-9, 'shadow: breakeven checked before T1 on the ambiguous bar — +0.5');
}

console.log('\n== no banking opportunity means identical policies, not a free pair ==');
{
  /* T1 inside +1R (rr = 0.8): the shadow IS the actual */
  const near = ctx.hgFwdNormalize({ tab:'T', mechanic:'M', sym:'X', tf:'1h', dir:'long',
    entry: 100, stop: 90, t1: 108, barT: T0, horizonBars: 6 });
  let r = settle(near, [bar(0, 109, 101)]);
  ok(r.state === 't1' && Math.abs(r.bankR - r.rr) < 1e-9, 'rr<=1 win: shadow equals the actual');
  const near2 = ctx.hgFwdNormalize({ tab:'T', mechanic:'M', sym:'X', tf:'1h', dir:'long',
    entry: 100, stop: 90, t1: 108, barT: T0, horizonBars: 6 });
  r = settle(near2, [bar(0, 105, 89)]);
  ok(r.state === 'stop' && Math.abs(r.bankR + 1) < 1e-9, 'rr<=1 loss: shadow equals the actual');

  /* expiry: no outcome for either policy — bankR stays null */
  r = settle(REC(), [bar(0,105,99),bar(1,105,99),bar(2,105,99),bar(3,105,99),bar(4,105,99),bar(5,105,99)]);
  ok(r.state === 'expired' && r.bankR === null, 'expired: no shadow sample is invented');
}

console.log('\n== shorts mirror ==');
{
  const sh = () => ctx.hgFwdNormalize({ tab:'T', mechanic:'M', sym:'X', tf:'1h', dir:'short',
    entry: 100, stop: 110, t1: 80, barT: T0, horizonBars: 6 });   /* +1R = 90 */
  let r = settle(sh(), [bar(0, 99, 89), bar(1, 100, 99), bar(2, 111, 95)]);
  ok(r.state === 'stop' && r.oneR === true && Math.abs(r.bankR - 0.5) < 1e-9,
     'short reaches +1R then stops: shadow +0.5');
  r = settle(sh(), [bar(0, 99, 89), bar(1, 90, 79)]);
  ok(r.state === 't1' && Math.abs(r.bankR - 1.5) < 1e-9, 'short rides to T1: shadow +1.5');
}

console.log('\n== matched pairs in the stats ==');
{
  const recs = [
    settle(REC(), [bar(0, 111, 101), bar(1, 121, 111)]),                  /* t1, shadow 1.5 */
    settle(REC(), [bar(0, 111, 101), bar(1, 105, 100), bar(2, 95, 89)]),  /* stop, shadow 0.5 */
    settle(REC(), [bar(0, 105, 89)]),                                     /* stop, shadow -1 */
    settle(REC(), [bar(0,105,99),bar(1,105,99),bar(2,105,99),bar(3,105,99),bar(4,105,99),bar(5,105,99)]) /* expired, no pair */
  ];
  const st = ctx.hgFwdStatsOf(recs, 'T', 'M', false);
  ok(st.samples === 3, 'three settled (expired excluded, as ever)');
  ok(st.bankN === 3, 'three matched pairs — the expired record contributes to NEITHER column');
  ok(Math.abs(st.bankActualExpR - (2 - 1 - 1) / 3) < 1e-9, 'as-traded over the pairs: 0.00R');
  ok(Math.abs(st.bankExpR - (1.5 + 0.5 - 1) / 3) < 1e-9, 'shadow over the same pairs: +0.33R');
}

console.log('\n== pruning folds the shadow ==');
{
  const settled = settle(REC(), [bar(0, 111, 101), bar(1, 105, 100), bar(2, 95, 89)]);
  const agg = ctx.hgFwdFold({}, [settled]);
  const a = agg['T|M'];
  ok(a && a.bankN === 1 && Math.abs(a.bankSum - 0.5) < 1e-9 && Math.abs(a.bankActualSum + 1) < 1e-9,
     'the aggregate carries bankN/bankSum/bankActualSum');
  const st = ctx.hgFwdStatsOf([], 'T', 'M', false, agg);
  ok(st.bankN === 1 && Math.abs(st.bankExpR - 0.5) < 1e-9,
     'and stats read the shadow back out of the aggregate after the record itself is pruned');
}

console.log('\n== the panel prints the evidence ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');
  ok(/SHADOW — bank half at \+1R/.test(SRC), 'the forward panel carries the shadow line');
  ok(/Too few pairs to act on/.test(SRC), 'and refuses to recommend on a thin sample');
}

console.log('\n== the grade is recorded so the A/B/C chips can be judged ==');
{
  /* The chips grade by CONFLUENCE COUNT — A means eight or more reads agree.
     Whether that predicts anything on gold is open, and doubtful: eleven gates
     measured backwards on the scalp horizon, and every one of them passes when
     the tape is ACTIVE, which is when a gold move is already largely spent. An
     A chip that is really a C is worse than no chip at all. The grade cannot
     be reconstructed once the outcome is known, so it is written at firing
     time and judged here. */
  const withGrade = (g) => ctx.hgFwdNormalize({ tab:'T', mechanic:'M', sym:'X', tf:'1h', dir:'long',
    entry:100, stop:90, t1:120, barT:T0, horizonBars:6, grade:g });
  ok(withGrade('A').grade === 'A', 'an A grade is kept');
  ok(withGrade('clean').grade === 'A', 'CLEAN normalises to A, matching the chip renderer');
  ok(withGrade('c').grade === 'C', 'lowercase normalises');
  ok(withGrade('').grade === '' && withGrade(undefined).grade === '',
     'an absent grade stays empty — an ungraded setup must not default into A and flatter itself');
  ok(withGrade('X').grade === '', 'a nonsense grade is dropped rather than passed through');

  const g = (grade, rows) => ctx.hgFwdSettleOne(withGrade(grade), rows);
  const recs = [
    g('A', [bar(0, 121, 101)]),
    g('A', [bar(0, 105, 89)]),
    g('C', [bar(0, 121, 101)]),
    g('C', [bar(0,105,99),bar(1,105,99),bar(2,105,99),bar(3,105,99),bar(4,105,99),bar(5,105,99)])
  ];
  const st = ctx.hgFwdStatsOf(recs, 'T', 'M', false);
  ok(st.byGrade.A.n === 2 && st.byGrade.A.w === 1, 'A: 2 settled, 1 win');
  ok(st.byGrade.C.n === 1 && st.byGrade.C.w === 1,
     'C: only the settled one counts — the expired C is excluded, as everywhere else');
  ok(st.byGrade.B.n === 0, 'a grade with no records reads zero rather than going missing');

  const SRC = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');
  ok(/BY GRADE/.test(SRC), 'the forward panel carries the by-grade line');
  ok(/Too few to judge the chips yet/.test(SRC), 'and refuses to judge the chips on a thin sample');
  const OG = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/grade: c\.engineGrade/.test(OG), 'omnigold passes the grade when it records a setup');
}

console.log('\nforward bank shadow: ' + passed + ' checks passed');
