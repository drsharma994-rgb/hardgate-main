/* HARDGATE — THE MEASUREMENTS THAT WERE ON DISK AND NEVER REACHED THE DESK.

   Every gold tab that forms a scalp or swing setup runs its candidates
   through hgGoldSetupEdgeApply, which looks the mechanic up in
   HG_GOLD_SETUP_EDGE and suppresses, demotes or prefers it on measured
   evidence. The table is a transcription of scripts/gold-setup-edge.json,
   which is itself baked from the replays.

   MEASURED. Cross-referencing the applied table against the replay analysis
   it is baked from — the FLOOR twin, which is the one the existing scalp rows
   match 24 of 25 times. An interim draft of this pack read the non-floor file
   instead and derived p6comp as n=29 -0.074; the row-by-row source check
   below caught it, and the row is n=28 -0.039:

     scripts/gold-scalp-bt-analysis-floor.json byStrategy  25 mechanics measured
     applied scalp table (before this pack)               15 of them had a row
                                                          10 carried NOTHING

   Two of those ten are measured NEGATIVE at the desk's own venue and clear
   this table's OWN documented demote bar (netXm < 0):

     p5drive  S24 THREE-DRIVE EXHAUSTION      n=17  gross -0.045  netXm -0.224
     p6comp   S30 SESSION-COMPOSITE PULLBACK  n=28  gross +0.121  netXm -0.039

   Together they are 45 of the 2,193 settled scalp trades (2.1%) and -4.90R
   net at XM, and they were free to lead the board. No new threshold is
   introduced here: the bar is the one the table already documents, applied
   to rows that were simply left out of the transcription.

   THE OTHER FOURTEEN CLEARED NO BAR, and that is the second half. An absent
   row used to mean two different things — a mechanic measured 49 times and
   mildly positive, and a mechanic nobody has ever measured — and neither the
   desk nor a reader could tell them apart. They are now 'neutral' rows that
   CARRY the measurement and change nothing about rank or eligibility.

   WHAT IS DELIBERATELY NOT DONE:
     - no prefer boost is invented. sweepob (n=49, +0.162) misses the n>=50
       prefer bar by a single settle and is not boosted for it.
     - vpbook (n=1, -0.011) and swing p6zfade (n=2, -0.753) are negative and
       are NOT demoted. The swing demote bar carries an n>=12 floor; the
       scalp bar carries none, so acting on one or two settles would be the
       table demoting on a coin flip.
     - nothing is re-baked. The replay cannot be re-run in this environment
       (the bar sources are refused at the gateway), so every number here is
       transcribed from a committed file, never recomputed and never typed.

   Run: node tests/test-gold-edge-unapplied.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b) => Math.abs((+a) - (+b)) <= 0.0011;

const SCALP_AN = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/gold-scalp-bt-analysis-floor.json'), 'utf8')).byStrategy;
const SWING_AN = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/backtest-goldswing-results.json'), 'utf8')).aggregates.byStrategy;
const BAKE = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/gold-setup-edge.json'), 'utf8'));

const ctx = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, Date, Intl, RegExp,
              parseFloat, parseInt, console: { log(){}, warn(){}, error(){} } };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'goldind.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const APPLY = ctx.hgGoldSetupEdgeApply;

function run(stratKey, swing){
  const c = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: stratKey, strategy: '' };
  APPLY(c, { swing: !!swing });
  return c;
}
const verdict = c => c.dropped ? 'suppress'
  : c.demoted ? 'demote'
  : (c.edgeBoost >= 2) ? 'prefer'
  : c.edgeMeasured ? 'neutral'
  : 'no row';

console.log('== the two rows are MEASURED NEGATIVE, and clear the table\'s own bar ==');
{
  for (const [k, lane] of [['p5drive', SCALP_AN], ['p6comp', SCALP_AN]]){
    const a = lane[k];
    ok(a && a.n > 0, `${k} is measured in the replay analysis (n=${a.n})`);
    ok(a.avgR_net_xm < 0, `${k} is negative at the desk venue (netXm ${a.avgR_net_xm})`);
    /* The bar the table documents for a scalp demote is net < 0. Asserted
       against the SOURCE number, so a re-bake that turns one positive makes
       this fail rather than quietly leaving a stale demote in place. */
    const c = run(k, false);
    ok(verdict(c) === 'demote', `${k} now demotes — paints, never leads`);
    ok(c.edge && c.edge.n === a.n && near(c.edge.net, a.avgR_net_xm),
       `and it carries the SOURCE numbers (n=${a.n}, net ${a.avgR_net_xm}) rather than retyped ones`);
    ok(!c.dropped, `${k} is demoted, not suppressed — it does not clear the suppress bar (n>=50 AND gross<=0 AND net<=-0.20)`);
  }
  /* The size of it, so "2.7%" is checked rather than asserted in prose. */
  const tot = Object.values(SCALP_AN).reduce((s, v) => s + v.n, 0);
  const add = SCALP_AN.p5drive.n + SCALP_AN.p6comp.n;
  const addR = SCALP_AN.p5drive.sumR_net_xm + SCALP_AN.p6comp.sumR_net_xm;
  ok(tot === 2193, `the measured scalp book is ${tot} settled trades`);
  ok(add === 45 && Math.abs(addR + 4.90) < 0.01,
     `and these two are ${add} of them (${(100 * add / tot).toFixed(1)}%), worth ${addR.toFixed(2)}R net at XM`);
}

console.log('\n== every applied row traces to a committed measurement ==');
{
  /* The strongest claim in this file: no number in the table is typed. Each
     row present in BOTH the bake and an analysis file must agree with it. */
  const problems = [], lanes = [['scalp', SCALP_AN], ['swing', SWING_AN]];
  let checked = 0;
  for (const [lane, an] of lanes){
    for (const [k, row] of Object.entries(BAKE[lane])){
      const a = an[k];
      if (!a) continue;                 /* older rows came from a different bake; the sync test guards those */
      checked++;
      if (row.n !== a.n) problems.push(`${lane}.${k} n: bake ${row.n} vs analysis ${a.n}`);
      if (!near(row.gross, a.avgR_gross)) problems.push(`${lane}.${k} gross: bake ${row.gross} vs analysis ${a.avgR_gross}`);
      if (!near(row.netXm, a.avgR_net_xm)) problems.push(`${lane}.${k} netXm: bake ${row.netXm} vs analysis ${a.avgR_net_xm}`);
    }
  }
  ok(checked >= 20, `${checked} baked rows appear in a replay analysis and were compared field by field`);
  ok(problems.length === 0,
     'and every one matches its source exactly' + (problems.length ? ('\n      ' + problems.slice(0, 6).join('\n      ')) : ''));

  /* The loop above compares the BAKE to the analysis. What the desk actually
     runs is the APPLIED table in goldind.js, and a number can drift there
     alone — a mutation run proved it, by reverting swing bos to the stale
     pre-v700 figure and passing this file. So the applied value is walked
     back to the analysis too, through the real applier. */
  const applied = [];
  for (const [lane, an, swing] of [['scalp', SCALP_AN, false], ['swing', SWING_AN, true]]){
    for (const k of Object.keys(BAKE[lane])){
      const a = an[k];
      if (!a) continue;
      const c = run(k, swing);
      if (!c.edge) { applied.push(`${lane}.${k} carries no edge at all though the bake has a row`); continue; }
      if (c.edge.n !== a.n) applied.push(`${lane}.${k} applied n ${c.edge.n} vs analysis ${a.n}`);
      if (!near(c.edge.net, a.avgR_net_xm)) applied.push(`${lane}.${k} applied net ${c.edge.net} vs analysis ${a.avgR_net_xm}`);
      if (!near(c.edge.gross, a.avgR_gross)) applied.push(`${lane}.${k} applied gross ${c.edge.gross} vs analysis ${a.avgR_gross}`);
    }
  }
  ok(applied.length === 0,
     'and the numbers the DESK runs match the analysis too, not just the bake'
     + (applied.length ? ('\n      ' + applied.slice(0, 6).join('\n      ')) : ''));
}

console.log('\n== measured-and-flat no longer reads as never-measured ==');
{
  const NEUTRAL_SCALP = ['sweepob', 'p8range', 'p5vwap', 'p5wyck', 'p8vpinbo', 'p7scalp', 'vpbook', 'adrfade'];
  const NEUTRAL_SWING = ['ribbon', 'ob', 'bos', 'p8range', 'p5wyck', 'p5turt', 'p5vwap', 'p6zfade'];
  for (const [k, swing] of NEUTRAL_SCALP.map(k => [k, false]).concat(NEUTRAL_SWING.map(k => [k, true]))){
    const c = run(k, swing);
    const lane = swing ? 'swing' : 'scalp';
    ok(verdict(c) === 'neutral', `${lane}.${k} reads measured-neutral`);
    ok(c.edge && c.edge.n > 0 && typeof c.edge.net === 'number',
       `  and carries its measurement (n=${c.edge && c.edge.n}, net ${c.edge && c.edge.net})`);
    ok(!c.dropped && !c.demoted && !(c.edgeBoost >= 2),
       '  while changing nothing about rank or eligibility — that is the point');
  }
}

console.log('\n== a mechanic nobody has measured still carries nothing ==');
{
  /* Without this the pack would have replaced one silence with a blanket
     claim of evidence. These mint live tickets (AGENTS.md Part8/Part9) and
     are genuinely absent from every analysis file. */
  for (const k of ['p9prem', 'p8geo', 'p8resid', 'p5news', 'p5turt']){
    if (SCALP_AN[k]) continue;
    const c = run(k, false);
    ok(verdict(c) === 'no row' && !c.edge,
       `scalp.${k} is never-measured and carries no edge at all — the distinction is real, not cosmetic`);
  }
  const c = run('zzz_not_a_mechanic', false);
  ok(verdict(c) === 'no row' && !c.edge, 'and an unknown key is not given one either');
}

console.log('\n== nothing was invented: no boost, and no demote on a coin flip ==');
{
  const sw = run('sweepob', false);
  ok(!(sw.edgeBoost >= 2),
     'sweepob (n=49, +0.162) misses the n>=50 prefer bar by ONE settle and gets no boost for it');
  ok(BAKE.scalp.sweepob.n === 49 && BAKE.scalp.sweepob.n < 50,
     'and the bake records the n that misses the bar, so the miss is checkable rather than remembered');

  const vp = run('vpbook', false);
  ok(SCALP_AN.vpbook.n === 1 && SCALP_AN.vpbook.avgR_net_xm < 0,
     'vpbook is measured NEGATIVE on a single settle');
  ok(verdict(vp) === 'neutral' && !vp.demoted,
     'and is NOT demoted — one settled trade is noise, and the scalp demote bar has no n floor to stop that');

  const zf = run('p6zfade', true);
  ok(SWING_AN.p6zfade.n === 2 && SWING_AN.p6zfade.avgR_net_xm < 0,
     'swing p6zfade is measured negative on two settles');
  ok(verdict(zf) === 'neutral' && !zf.demoted,
     'and is NOT demoted either — the swing bar carries an n>=12 floor and two is nowhere near it');

  const tu = run('p5turt', true);
  ok(SWING_AN.p5turt.n === 2 && SWING_AN.p5turt.avgR_net_xm > 3,
     'and the mirror case: swing p5turt shows +3.09R on two settles');
  ok(!(tu.edgeBoost >= 2),
     'which buys it no boost whatsoever — a large number on no sample is still no sample');
}

console.log('\n== the rows already in the table are untouched ==');
{
  /* A pack that adds rows must not move existing ones. These four are the
     load-bearing verdicts on the scalp lane. */
  for (const [k, want] of [['fvg', 'suppress'], ['hvn', 'demote'], ['p6fail', 'prefer'], ['p9volbar', 'prefer']]){
    ok(verdict(run(k, false)) === want, `scalp.${k} is still ${want}`);
  }
  for (const [k, want] of [['pullback', 'demote'], ['weekly', 'prefer'], ['p9volbar', 'prefer'], ['p6comp', 'demote']]){
    ok(verdict(run(k, true)) === want, `swing.${k} is still ${want}`);
  }
  const wk = run('wkbreak', true);
  ok(wk.edgeBoost >= 2, 'and the wkbreak -> weekly alias still reaches the prefer row');
}

console.log(`\n${passed} passed, 0 failed`);
