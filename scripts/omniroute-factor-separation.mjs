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
import { separate } from './omniroute-regime-separation.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT = path.join(HERE, 'backtest-omniroute-v701-results.json');
export const TARGET = path.join(HERE, '..', 'omniroute.js');
export const WINDOWS = 4;
export const MIN_SIDE = 20;
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
  const out = [];
  for (const f of F){
    const s = separate(sorted, f.pick, WINDOWS, MIN_SIDE);
    const w = s.whole;
    const row = {
      f: f.key, group: f.group, label: f.label,
      n: w.in ? w.in.n : 0,
      win: w.in ? r3(w.in.win) : null, gross: w.in ? r3(w.in.gross) : null, net: w.in ? r3(w.in.net) : null,
      outWin: w.out ? r3(w.out.win) : null, outNet: w.out ? r3(w.out.net) : null,
      /* windows where the cohort was BETTER than its complement, win/gross/net */
      q: s.better.win + '/' + s.better.gross + '/' + s.better.net,
      thin: s.thin,
      verdict: (s.verdict === 'none') ? null : s.verdict
    };
    /* a lean: net unanimous (all judged windows one way) while the verdict
       did not form — win or gross disagreed somewhere */
    /* (a count can only reach WINDOWS when every window was judged, so a
       thin window rules a lean out by arithmetic — no second guard) */
    if (!row.verdict){
      if (s.better.net === WINDOWS) row.lean = 'better';
      else if (s.worse.net === WINDOWS) row.lean = 'worse';
    }
    /* a cohort that is the whole book (or none of it) has no complement to
       be compared against: that is a degenerate read, not a thin one */
    if (!w.in || !w.out) row.degenerate = true;
    if (f.inSample) row.inSample = true;
    out.push(row);
  }
  return {
    artifact: path.basename(ARTIFACT), n: sorted.length, windows: WINDOWS, minSide: MIN_SIDE,
    span: [sorted[0].tISO.slice(0, 10), sorted[sorted.length - 1].tISO.slice(0, 10)],
    bound: 'as-recorded only — the artifact carries no same-bar ambiguity flag, so the lower bound cannot be read here',
    starved: inventory.starved,
    rows: out,
    verdicts: out.filter(r => r.verdict && !r.inSample).map(r => r.f),
    leans: out.filter(r => r.lean && !r.inSample).map(r => r.f),
    inSampleVerdicts: out.filter(r => r.verdict && r.inSample).map(r => r.f)
  };
}

export function literal(res){
  const R = res || run();
  const rows = R.rows.map(r => {
    const parts = ['f: ' + JSON.stringify(r.f), 'g: ' + JSON.stringify(r.group), 'n: ' + r.n,
      'win: ' + r.win, 'gross: ' + r.gross, 'net: ' + r.net, 'outWin: ' + r.outWin, 'outNet: ' + r.outNet,
      'q: ' + JSON.stringify(r.q), 'verdict: ' + JSON.stringify(r.verdict)];
    if (r.thin) parts.push('thin: ' + r.thin);
    if (r.degenerate) parts.push('degenerate: true');
    if (r.lean) parts.push('lean: ' + JSON.stringify(r.lean));
    if (r.inSample) parts.push('inSample: true');
    return '      { ' + parts.join(', ') + ' }';
  });
  return [
    BEGIN,
    '     Re-derive with `node scripts/omniroute-factor-separation.mjs --write`. Do not',
    '     hand-edit — generated literals write themselves (hg-v921). Every figure is',
    '     read off ' + R.artifact + '; the guard re-runs the generator and fails on drift. */',
    '  var HG_OMNI_FACTOR_SEP = {',
    '    artifact: ' + JSON.stringify(R.artifact) + ', n: ' + R.n + ', windows: ' + R.windows + ', minSide: ' + R.minSide + ',',
    '    span: ' + JSON.stringify(R.span) + ',',
    '    bound: ' + JSON.stringify(R.bound) + ',',
    '    starved: ' + JSON.stringify(R.starved) + ',',
    '    verdicts: ' + JSON.stringify(R.verdicts) + ',',
    '    leans: ' + JSON.stringify(R.leans) + ',',
    '    inSampleVerdicts: ' + JSON.stringify(R.inSampleVerdicts) + ',',
    '    rows: [',
    rows.join(',\n'),
    '    ]',
    '  };',
    '  ' + END
  ].join('\n');
}

/* write the literal between the markers; a marker that cannot be found is
   fatal, never skipped */
export function splice(src, lit){
  const i = src.indexOf(BEGIN);
  if (i < 0) throw new Error('BEGIN marker not found in omniroute.js — fatal, never skipped');
  const j = src.indexOf(END, i);
  if (j < 0) throw new Error('END marker not found in omniroute.js — fatal, never skipped');
  return src.slice(0, i) + lit.slice(0, lit.length - END.length) + src.slice(j);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const res = run();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else {
    console.log(`OMNIROUTE ${res.artifact}: ${res.n} walked rows, ${res.span[0]} -> ${res.span[1]}, ${res.windows} disjoint windows (min ${res.minSide} a side)`);
    console.log(`starved in the replay (constant on every row): ${res.starved.join(', ')}`);
    for (const r of res.rows){
      const pc = (x) => (typeof x === 'number') ? (100 * x).toFixed(1) + '%' : '—';
      const sR = (x) => (typeof x === 'number') ? ((x >= 0 ? '+' : '') + x.toFixed(3)) : '—';
      console.log(`  ${r.f.padEnd(34)} n=${String(r.n).padStart(4)} win ${pc(r.win)} net ${sR(r.net)} | out win ${pc(r.outWin)} net ${sR(r.outNet)} | better w/g/n ${r.q}${r.thin ? ' thin ' + r.thin : ''} -> ${r.verdict ? r.verdict.toUpperCase() : (r.lean ? 'lean ' + r.lean : (r.degenerate ? 'no complement' : '-'))}${r.inSample ? '  [IN-SAMPLE]' : ''}`);
    }
    console.log(`\nverdicts (out of sample): ${res.verdicts.length ? res.verdicts.join(', ') : 'NONE'}`);
    console.log(`leans (net unanimous, win or gross not): ${res.leans.join(', ') || 'none'}`);
    console.log(`in-sample verdicts (fitted on this window, no confirmation): ${res.inSampleVerdicts.join(', ') || 'none'}`);
  }
  const src = fs.readFileSync(TARGET, 'utf8');
  const next = splice(src, literal(res));
  if (next === src){ console.log('\nHG_OMNI_FACTOR_SEP: zero drift'); }
  else if (process.argv.includes('--write')){ fs.writeFileSync(TARGET, next); console.log('\nHG_OMNI_FACTOR_SEP written'); }
  else { console.log('\nDRIFT — run with --write'); process.exitCode = 1; }
}
