#!/usr/bin/env node
/* hg-v987 — which signal-time read on OMNIROUTE actually separates winners,
   on the desk's own replay, across DISJOINT windows.

   The standing crypto instruction asks for more indicators and strategies in
   setup formation. Before adding one, the question is which of the reads the
   desk ALREADY scores by carry any out-of-sample information on its own book:
   the 18 solidity pillars, the solidity gates (families, live-fresh, tape,
   agreement count), the HTF alignment tags, the session, the same-bar cluster
   tag, the conviction cert, the live-price grade at signal, and the stop
   width. The v701 replay stamped every one of them on all 2,833 walked trades.

   Method: the hg-v920 rule, through the one implementation this repo keeps
   (scripts/omniroute-regime-separation.mjs `separate`): rows sorted by signal
   time, cut into FOUR windows that share no trade, each cohort compared
   against its complement in each window on win rate, gross R and net R. A
   VERDICT needs all four windows to agree in the same direction on all three
   figures. A LEAN is net unanimous while win or gross is not — reported as a
   separate field, because a lean is not a verdict (hg-v945) and net moves
   with stop width by cost arithmetic alone (hg-v922).

   One fill bound, said: this artifact carries no same-bar ambiguity flag, so
   the as-recorded end is the only one available here.

   The replay's stamps were starved of inputs the live desk has (hg-v533):
   five pillars are constant across every row and are listed as STARVED,
   never as "no separation".

   kindDemoted is measured beside the rest on purpose: the module's own baked
   demotion was FITTED on an overlapping window (v531 roster bake), so it is
   flagged inSample and offered as no confirmation — it shows the method is
   not blind on this book.

   Usage: node scripts/omniroute-factor-separation.mjs [--json] [--write]
     --write rewrites the HG_OMNI_FACTOR_SEP literal in omniroute.js between
     its markers; without it the script is a read-only drift check that exits
     1 on drift (the hg-v921 rule: generated literals write themselves). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFactors, literalFor, spliceBetween, cliTail, printRows, WINDOWS as CORE_WINDOWS, MIN_SIDE as CORE_MIN_SIDE } from './factor-sep-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT = path.join(HERE, 'backtest-omniroute-v701-results.json');
export const TARGET = path.join(HERE, '..', 'omniroute.js');
export const WINDOWS = CORE_WINDOWS;
export const MIN_SIDE = CORE_MIN_SIDE;
export const BEGIN = '/* --- BEGIN GENERATED HG_OMNI_FACTOR_SEP (scripts/omniroute-factor-separation.mjs) ---';
export const END = '/* --- END GENERATED HG_OMNI_FACTOR_SEP --- */';

const r3 = (x) => Math.round(x * 1000) / 1000;
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : NaN;

export function loadRows(file){
  const a = JSON.parse(fs.readFileSync(file || ARTIFACT, 'utf8'));
  const tr = Array.isArray(a.trades) ? a.trades : [];
  return tr.filter(r => r && r.tISO && r.dir && r.outcome && r.pillarBreakdown && r.solGates);
}

/* pillars are derived from the rows, not typed: a pillar whose score never
   moves across the whole replay is STARVED (the replay could not score it),
   and is reported as such rather than measured. */
export function pillarInventory(rows){
  const names = Object.keys(rows[0].pillarBreakdown);
  const out = { varying: [], starved: [], max: {} };
  for (const p of names){
    const vals = rows.map(r => num(r.pillarBreakdown[p]));
    const mx = Math.max.apply(null, vals);
    out.max[p] = mx;
    if (new Set(vals).size < 2) out.starved.push(p); else out.varying.push(p);
  }
  return out;
}

export function factors(rows){
  const inv = pillarInventory(rows);
  const F = [];
  for (const p of inv.varying){
    const half = inv.max[p] / 2;
    F.push({ key: 'pillar:' + p + ':half', group: 'pillar', label: p + ' scored ≥ half its max (' + half + ')', pick: r => num(r.pillarBreakdown[p]) >= half });
  }
  F.push({ key: 'gate:families', group: 'gate', label: 'solidity gate: ≥2 families agree', pick: r => r.solGates.families === true });
  F.push({ key: 'gate:liveFresh', group: 'gate', label: 'solidity gate: live price still fresh at signal', pick: r => r.solGates.liveFresh === true });
  F.push({ key: 'gate:tape', group: 'gate', label: 'solidity gate: with the tape', pick: r => r.solGates.tape === true });
  F.push({ key: 'gate:nAgree1', group: 'gate', label: '≥1 agreeing read (nAgree ≥ 1)', pick: r => num(r.solGates.nAgree) >= 1 });
  F.push({ key: 'gate:nAgree2', group: 'gate', label: '≥2 agreeing reads (nAgree ≥ 2)', pick: r => num(r.solGates.nAgree) >= 2 });
  F.push({ key: 'grade:good', group: 'grade', label: 'solidity grade GOOD (lead-eligible)', pick: r => r.solGrade === 'GOOD' });
  F.push({ key: 'grade:tierFair', group: 'grade', label: 'legacy tier FAIR or better', pick: r => r.tier !== 'weak' });
  F.push({ key: 'grade:liveFresh', group: 'grade', label: 'live-price grade FRESH at signal', pick: r => r.liveGradeAtSignal === 'fresh' });
  F.push({ key: 'grade:pastEntry', group: 'grade', label: 'live-price grade PAST-ENTRY at signal', pick: r => r.liveGradeAtSignal === 'past-entry' });
  F.push({ key: 'trend:withTrend', group: 'trend', label: '1h + daily trend aligned (withTrend)', pick: r => r.withTrend === true });
  F.push({ key: 'trend:h1', group: 'trend', label: '1h trend aligned with direction', pick: r => (r.dir === 'long') === (r.h1Up === true) });
  F.push({ key: 'trend:daily', group: 'trend', label: 'daily trend aligned with direction', pick: r => (r.dir === 'long') === (r.dailyUp === true) });
  F.push({ key: 'pop:cluster', group: 'population', label: 'same-bar cluster (≥2 mechanic kinds)', pick: r => r.cluster === true });
  F.push({ key: 'pop:conviction', group: 'population', label: 'carries a conviction cert', pick: r => r.hasConviction === true });
  F.push({ key: 'pop:long', group: 'population', label: 'long side', pick: r => r.dir === 'long' });
  F.push({ key: 'geom:band20x', group: 'geometry', label: 'stop inside the 20× band (stopBand20x)', pick: r => r.stopBand20x === true });
  F.push({ key: 'geom:stopLt05', group: 'geometry', label: 'stop < 0.5% of entry', pick: r => num(r.stopDistPct) < 0.5 });
  F.push({ key: 'geom:stopGe1', group: 'geometry', label: 'stop ≥ 1% of entry', pick: r => num(r.stopDistPct) >= 1.0 });
  F.push({ key: 'geom:stopGe2', group: 'geometry', label: 'stop ≥ 2% of entry', pick: r => num(r.stopDistPct) >= 2.0 });
  for (const s of ['ASIA', 'LONDON OPEN', 'LONDON/NY OVERLAP', 'NY OPEN', 'QUIET HOURS', 'OFF-SESSION']){
    F.push({ key: 'session:' + s, group: 'session', label: 'session ' + s, pick: r => r.session === s });
  }
  F.push({ key: 'insample:kindDemoted', group: 'in-sample', label: 'mechanic demoted by the module own baked table', pick: r => r.kindDemoted === true, inSample: true });
  return { factors: F, inventory: inv };
}

export function run(rows){
  rows = rows || loadRows();
  const sorted = rows.slice().sort((a, b) => (a.tISO < b.tISO ? -1 : a.tISO > b.tISO ? 1 : 0));
  const { factors: F, inventory } = factors(sorted);
  const R = runFactors(sorted, F);
  delete R.sorted;
  return Object.assign({ artifact: path.basename(ARTIFACT) }, R, {
    bound: 'as-recorded only — the artifact carries no same-bar ambiguity flag, so the lower bound cannot be read here',
    starved: inventory.starved
  });
}

export function literal(res){
  const R = res || run();
  return literalFor('HG_OMNI_FACTOR_SEP', R, { begin: BEGIN, end: END, script: 'scripts/omniroute-factor-separation.mjs',
    extra: { bound: R.bound, starved: R.starved } });
}

/* write the literal between the markers; a marker that cannot be found is
   fatal, never skipped (the core rule, named for this file) */
export function splice(src, lit){ return spliceBetween(src, lit, BEGIN, END, 'omniroute.js'); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const res = run();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else {
    console.log(`OMNIROUTE ${res.artifact}: ${res.n} walked rows, ${res.span[0]} -> ${res.span[1]}, ${res.windows} disjoint windows (min ${res.minSide} a side)`);
    console.log(`starved in the replay (constant on every row): ${res.starved.join(', ')}`);
    printRows(res);
  }
  cliTail(res, literal(res), TARGET, 'omniroute.js', { begin: BEGIN, end: END, literal: 'HG_OMNI_FACTOR_SEP' });
}
