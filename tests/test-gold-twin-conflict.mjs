/* HARDGATE — when two measured records of the SAME mechanic disagree in sign.

   Several mechanics on GOLD SCALP / GOLD SWING are wired OMNIGOLD mechanics:
   the same detector, registered deliberately (hg-v567/568/569/570/571/575/576).
   Each therefore carries TWO records, and nothing had ever compared them.

   For two of them the records disagree IN SIGN, and the tab holds the smaller
   sample:

     p8range  tab n=91 +0.038R -> neutral    twin P8-RANGE  n=323 -0.613R z=-3.81
     p9volbar tab n=72 +0.155R -> PREFER +2  twin P9-VOLBAR n=274 -0.499R z=-2.97

   Both twins sit past OMNIGOLD's EDGE_VETO_Z of -2 — the bar at which OMNIGOLD
   refuses to ticket a mechanic at all. hg-v934 refused to port PIVOT-REJECT on
   exactly that reasoning and applied it only to a NEW port; the tabs' own
   mechanics were never checked.

   WHAT THIS PINS, INCLUDING WHAT IT MUST NOT DO:
     - the two records measure DIFFERENT POPULATIONS, so the twin's verdict is
       NOT imported: nothing is demoted or suppressed on it (hg-v923/v920);
     - what IS withheld is the active +2 rank boost — promoting on the smaller
       of two contradicting samples is the thing to refuse;
     - a neutral row has no boost to withhold, so it only discloses;
     - LOOSE ANALOGIES ARE NOT TWINS (nyexh is not NY-OPEN-DRIVE, liqsweep is
       not PDL-SWEEP) — a record is borrowable only for the same mechanic;
     - the z is OMNIGOLD's own CLUSTER-CORRECTED statistic, not the naive one
       that would overstate this by two sigma;
     - it fails open, and hgGoldSetTwinCheck(false) reverses it.

   Run: node tests/test-gold-twin-conflict.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };
const src = f => fs.readFileSync(root + f, 'utf8');

const ctx = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
  Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
  console: { log(){}, warn(){}, error(){} }, setTimeout: () => 0, clearTimeout(){},
  localStorage: (() => { const s = {}; return { getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; })(),
  document: { getElementById: () => null,
    createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                            querySelector: () => null, querySelectorAll: () => [] }),
    querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){} } });
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
for (const f of ['indicators.js', 'indicators2.js', 'hg-mechanics.js', 'hg-forward.js',
                 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
                 'best-levels.js', 'regime.js', 'omniroute.js', 'omnigold.js', 'goldind.js']){
  try { vm.runInContext(src(f), ctx, { filename: f }); } catch (e) {}
}
const VERDICT = ctx.hgGoldTwinVerdict;
const NOTE    = ctx.hgGoldTwinConflictNote;
const APPLY   = ctx.hgGoldSetupEdgeApply;
const SETCHK  = ctx.hgGoldSetTwinCheck;

/* a long candidate with valid plan sides, so hgGoldPlanSidesOk passes and the
   action branch is actually reached */
const cand = (key) => ({ stratKey: key, strategy: key, dir: 'long',
                         entry: 4500, stop: 4480, t1: 4540, t2: 4560,
                         stamps: [], gateNotes: [] });

console.log('\n1. the bar is OMNIGOLD\'s, not a second copy');
{
  const og = src('omnigold.js');
  const ogZ = /var EDGE_VETO_Z = (-?\d+(?:\.\d+)?)/.exec(og);
  ok(!!ogZ, 'omnigold.js declares EDGE_VETO_Z');
  ok(Number(ogZ[1]) === ctx.HG_GOLD_TWIN_VETO_Z,
     'HG_GOLD_TWIN_VETO_Z equals it exactly (' + ctx.HG_GOLD_TWIN_VETO_Z + ') — one bar, two readers');
  ok(Math.abs(ctx.HG_GOLD_TWIN_BE - 1 / 3) < 1e-12,
     'breakeven is 1/3 — the twin\'s record was measured on OMNIGOLD\'s 2R plans');
  /* the desk's own breakeven is 40% at R:R 1.5; using it here would judge a
     foreign record against this desk's target and flatter it */
  ok(Math.abs(ctx.HG_GOLD_TWIN_BE - 0.40) > 0.05,
     '  and NOT this desk\'s 1.5R breakeven, which would be the wrong target');
}

console.log('\n2. the two real cells, and only those');
{
  const bad = ['p8range', 'p9volbar'];
  for (const k of bad){
    const v = VERDICT(k);
    ok(v && v.vetoed === true, k + ' twin ' + (v && v.twin) + ' is past the bar (z='
       + (v && v.z.toFixed(2)) + ', n=' + (v && v.n) + ')');
    ok(v && v.netXm < 0, '  and its net at XM is negative (' + (v && v.netXm) + ')');
  }
  for (const k of ['p6fail', 'p5drive', 'p5vwap', 'p5wyck', 'p4laf', 'p6comp', 'p7scalp']){
    const v = VERDICT(k);
    ok(v && v.vetoed === false, k + ' twin ' + (v && v.twin) + ' is INSIDE the bar (z='
       + (v && v.z.toFixed(2)) + ') — untouched');
  }
}

console.log('\n3. loose analogies are not twins');
{
  for (const k of ['nyexh', 'liqsweep', 'silverb', 'hvn', 'ribbon', 'asian', 'openrange']){
    ok(VERDICT(k) === null, k + ' has no twin record — it is a different mechanic');
    ok(ctx.HG_GOLD_EXACT_TWIN[k] === undefined, '  and is absent from the exact-wire map');
  }
}

console.log('\n4. the z is the CLUSTER-CORRECTED one, not the naive one');
{
  const e = ctx.hgOgReplayEvidence('P8-RANGE');
  const f = e.formed;
  const BE = 1 / 3;
  const naive = (f.winRate - BE) / Math.sqrt(BE * (1 - BE) / f.n);
  const v = VERDICT('p8range');
  ok(Math.abs(v.z - ctx.hgOgReplayZ([f.n, f.winRate], BE)) < 1e-9,
     'the verdict z IS hgOgReplayZ — OMNIGOLD\'s own statistic, reused not reimplemented');
  ok(naive < v.z - 1.5,
     'the naive z (' + naive.toFixed(2) + ') is more than 1.5 sigma harsher than the '
     + 'corrected one (' + v.z.toFixed(2) + ') — quoting it would overstate the case');
  ok(v.z <= -2, '  and the corrected z still clears the bar, which is why this ships');
}

console.log('\n5. a PREFER row whose twin is vetoed loses the boost — and nothing else');
{
  SETCHK(true);
  const c = APPLY(cand('p9volbar'), {});
  ok(!(c.edgeBoost > 0), 'no +2 rank boost is applied');
  ok(c.edgeTwinConflict && c.edgeTwinConflict.heldBoost === 2,
     '  and the card records that a boost of 2 was withheld');
  ok(c.stamps.some(s => /PREFER HELD/.test(s)), '  stamped PREFER HELD');
  ok(c.dropped !== true, 'it is NOT dropped — the twin verdict is not imported');
  ok(c.demoted !== true, 'it is NOT demoted — the setup can still lead on its own merits');
  ok((c.gateNotes || []).some(n => /TWO RECORDS DISAGREE/.test(n)),
     'and the conflict is on the card');
}

console.log('\n6. a PREFER row whose twin is clean keeps its boost');
{
  const c = APPLY(cand('p6fail'), {});
  ok(c.edgeBoost === 2, 'p6fail (twin z=+0.73) still gets its +2');
  ok(!c.edgeTwinConflict, '  and carries no conflict record');
  ok(c.stamps.indexOf('EDGE PREFER') >= 0, '  stamped EDGE PREFER as before');
}

console.log('\n7. a NEUTRAL row has no boost to withhold, so it only discloses');
{
  const c = APPLY(cand('p8range'), {});
  ok(c.edgeTwinConflict && c.edgeTwinConflict.heldBoost === 0,
     'nothing was withheld — neutral never boosted');
  ok(!(c.edgeBoost > 0), '  and it still has no boost');
  ok(c.dropped !== true && c.demoted !== true,
     '  and its eligibility is completely unchanged');
  ok((c.gateNotes || []).some(n => /TWO RECORDS DISAGREE/.test(n)),
     '  but the reader is now told the second record exists');
}

console.log('\n8. suppress and demote are untouched by any of this');
{
  const sup = APPLY(cand('fvg'), {});          /* scalp fvg is suppress */
  ok(sup.dropped === true, 'a suppressed row is still dropped');
  const dem = APPLY(cand('hvn'), {});          /* scalp hvn is demote */
  ok(dem.demoted === true, 'a demoted row is still demoted');
  ok(!dem.edgeTwinConflict, '  and neither gains a twin conflict (hvn is not FVG-HVN)');
}

console.log('\n9. the note names both samples and attributes the foreign one');
{
  const n = NOTE('p9volbar', { n: 72, net: 0.155 });
  ok(/72/.test(n), 'names this desk\'s sample (72)');
  ok(/274/.test(n), 'names the twin\'s sample (274)');
  ok(/P9-VOLBAR/.test(n), 'names the twin mechanic');
  ok(/OMNIGOLD/.test(n), 'attributes the foreign record to OMNIGOLD');
  ok(/1h/.test(n), '  and names the horizon it was measured on');
  ok(/neither supersedes/i.test(n),
     'says neither record supersedes the other — this is a conflict, not a correction');
  ok(/larger sample is the one that disagrees/i.test(n),
     '  while naming which way the weight of evidence points');
  ok(/Nothing is demoted/i.test(n), 'and states plainly that nothing is demoted on it');
  ok(NOTE('p6fail', { n: 85, net: 0.182 }) === '', 'a clean twin produces no note');
}

console.log('\n10. it fails open, and it is reversible');
{
  SETCHK(false);
  const off = APPLY(cand('p9volbar'), {});
  ok(off.edgeBoost === 2, 'hgGoldSetTwinCheck(false) restores the boost exactly');
  ok(!off.edgeTwinConflict, '  and the conflict record is gone');
  SETCHK(true);

  const saved = ctx.hgOgReplayEvidence;
  /* assign undefined rather than delete: a vm sandbox does not always
     propagate a delete to the inner global, and a half-removed accessor would
     make this section pass for the wrong reason */
  ctx.hgOgReplayEvidence = undefined;
  ok(typeof ctx.hgOgReplayEvidence !== 'function', 'the accessor is genuinely gone');
  ok(VERDICT('p9volbar') === null, 'no OMNIGOLD: no verdict');
  const noOg = APPLY(cand('p9volbar'), {});
  ok(noOg.edgeBoost === 2, '  and the desk behaves exactly as it did before this pack');
  ctx.hgOgReplayEvidence = () => { throw new Error('boom'); };
  ok(VERDICT('p9volbar') === null, 'a throwing accessor is null, not a throw');
  ok(APPLY(cand('p9volbar'), {}).edgeBoost === 2, '  and still fails open');
  ctx.hgOgReplayEvidence = () => ({ formed: null });
  ok(VERDICT('p9volbar') === null, 'a twin with no gate-clear record is null — never invented');
  ctx.hgOgReplayEvidence = saved;
  ok(VERDICT('p9volbar') !== null, 'restored');
}

console.log('\n11. the read is live, not baked');
{
  /* behavioural: move the twin's record and the verdict must move with it.
     A literal copied into goldind.js would not. */
  const saved = ctx.hgOgReplayEvidence;
  ctx.hgOgReplayEvidence = () => ({ formed: { n: 300, winRate: 0.60, netXm: 0.9, grossR: 1 } });
  const v = VERDICT('p9volbar');
  ok(v && v.vetoed === false && v.n === 300,
     'a twin re-baked to a winning record stops being vetoed — no literal in this file');
  ok(APPLY(cand('p9volbar'), {}).edgeBoost === 2, '  and the boost comes back');
  ctx.hgOgReplayEvidence = saved;
}

console.log('\n' + passed + ' assertions passed');
