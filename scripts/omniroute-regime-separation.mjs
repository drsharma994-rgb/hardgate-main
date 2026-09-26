#!/usr/bin/env node
/* hg-v984 — does OMNIROUTE's crypto REGIME read separate outcomes on the
   desk's own replay?

   The nearest measured crypto-macro gate in the repo is OMNIROUTE's `regime`
   row (RISK-ON / MIXED / RISK-OFF from regime.js, soft since hg-v698), and the
   v701 replay recorded its verdict on every one of the 2,833 filled trades it
   walked -- pass / adverse-info / adverse-veto -- whatever the gate said.
   That is the one place the question "does a crypto macro read separate
   winners from losers on a crypto desk?" can be asked against settled trades
   today. The macro alt filter itself (hgMacroAllowsCrypto) is recorded on no
   artifact at all, which is why hg-v984 marks it on the live ledger instead.

   Method: the hg-v920 rule. Rows sorted by signal time, cut into FOUR windows
   that share no trade, the cohort compared against its complement in each on
   win rate, gross R and net R. A verdict needs all four to agree in the same
   direction on all three figures. The count of agreeing windows is reported,
   never a pooled read alone.

   kindDemoted is measured beside it on purpose: the module's own baked
   demotion DOES separate 4/4 here, which shows the method is not blind on
   this book -- and that verdict was FITTED on an overlapping window (the v531
   roster bake), so it is flagged inSample and offered as no confirmation.

   Read-only. Prints JSON; writes nothing.
   Usage: node scripts/omniroute-regime-separation.mjs [--json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitDisjoint } from './disjoint-windows.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT = path.join(HERE, 'backtest-omniroute-v701-results.json');
export const WINDOWS = 4;

/* The cohorts. Each is {key, label, pick(row) -> boolean, inSample?} */
export const COHORTS = [
  { key: 'regimeAdverseVeto', label: 'regime gate read adverse and stood (adverse-veto)',
    pick: r => r.regimeGate === 'adverse-veto' },
  { key: 'regimeAdverseAny', label: 'regime gate read adverse (veto or demoted-to-info)',
    pick: r => r.regimeGate === 'adverse-info' || r.regimeGate === 'adverse-veto' },
  { key: 'againstRegimeLabel', label: 'against the regime label (RISK-OFF long or RISK-ON short)',
    pick: r => (r.regimeLabel === 'RISK-OFF' && r.dir === 'long') || (r.regimeLabel === 'RISK-ON' && r.dir === 'short') },
  { key: 'withTrendFalse', label: 'symbol own 1h+daily trend NOT aligned (withTrend=false)',
    pick: r => r.withTrend === false },
  { key: 'kindDemoted', label: 'mechanic demoted by the module own baked table (kindDemoted)',
    pick: r => r.kindDemoted === true, inSample: true }
];

function stat(rows){
  const n = rows.length;
  if (!n) return null;
  let w = 0, g = 0, net = 0;
  for (const r of rows){
    if (r.outcome === 'target') w++;
    g += (r.outcome === 'target') ? (+r.rMultiple || 0) : (r.outcome === 'stop' ? -1 : 0);
    net += (+r.netR || 0);
  }
  return { n, win: w / n, gross: g / n, net: net / n };
}

/* One cohort against its complement on K disjoint windows. `worse` counts the
   windows where the cohort is worse than its complement on each figure; a
   verdict is 'worse' or 'better' only when all K agree on all three. */
export function separate(rows, pick, k, minN){
  k = k || WINDOWS; minN = minN || 20;
  const sorted = rows.slice().sort((a, b) => (a.tISO < b.tISO ? -1 : a.tISO > b.tISO ? 1 : 0));
  const wins = splitDisjoint(sorted, k);
  const per = [];
  let worse = { win: 0, gross: 0, net: 0 }, better = { win: 0, gross: 0, net: 0 }, thin = 0;
  for (const w of wins){
    const A = stat(w.filter(pick)), B = stat(w.filter(r => !pick(r)));
    if (!A || !B || A.n < minN || B.n < minN){ per.push({ thin: true, inN: A ? A.n : 0, outN: B ? B.n : 0 }); thin++; continue; }
    const d = { win: A.win - B.win, gross: A.gross - B.gross, net: A.net - B.net };
    for (const f of ['win', 'gross', 'net']){ if (d[f] < 0) worse[f]++; else if (d[f] > 0) better[f]++; }
    per.push({ in: A, out: B, delta: d });
  }
  const judged = k - thin;
  const allWorse = judged === k && worse.win === k && worse.gross === k && worse.net === k;
  const allBetter = judged === k && better.win === k && better.gross === k && better.net === k;
  return {
    windows: k, judged, thin, per, worse, better,
    whole: { in: stat(sorted.filter(pick)), out: stat(sorted.filter(r => !pick(r))) },
    verdict: allWorse ? 'worse' : allBetter ? 'better' : 'none'
  };
}

export function report(rows, k){
  const out = { artifact: path.basename(ARTIFACT), rows: rows.length, windows: k || WINDOWS,
                span: rows.length ? [rows.reduce((a, r) => (r.tISO < a ? r.tISO : a), rows[0].tISO),
                                     rows.reduce((a, r) => (r.tISO > a ? r.tISO : a), rows[0].tISO)] : null,
                cohorts: {} };
  for (const c of COHORTS){
    const s = separate(rows, c.pick, k || WINDOWS);
    out.cohorts[c.key] = Object.assign({ label: c.label, inSample: !!c.inSample }, s);
    /* a verdict fitted on the window it is judged on is no verdict */
    if (c.inSample && s.verdict !== 'none') out.cohorts[c.key].verdictNote = 'fitted on an overlapping window (v531 roster bake) -- not offered as out-of-sample';
  }
  return out;
}

export function loadRows(file){
  const a = JSON.parse(fs.readFileSync(file || ARTIFACT, 'utf8'));
  const tr = Array.isArray(a.trades) ? a.trades : [];
  /* every walked row, whatever the gate said -- that is what makes the
     question askable. Timeouts stay (they are 0R in gross and their netR). */
  return tr.filter(r => r && r.tISO && r.dir && r.outcome);
}

function fmtR(v){ return (v >= 0 ? '+' : '') + v.toFixed(3) + 'R'; }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const rows = loadRows();
  const rep = report(rows);
  if (process.argv.includes('--json')){ console.log(JSON.stringify(rep, null, 2)); }
  else {
    console.log(`OMNIROUTE ${rep.artifact}: ${rep.rows} walked rows, ${rep.span[0]} -> ${rep.span[1]}, ${rep.windows} disjoint windows`);
    for (const k of Object.keys(rep.cohorts)){
      const c = rep.cohorts[k];
      const w = c.whole;
      console.log(`\n${c.label}${c.inSample ? '  [IN-SAMPLE]' : ''}`);
      console.log(`  whole  IN n=${w.in.n} win ${(100 * w.in.win).toFixed(1)}% net ${fmtR(w.in.net)} | OUT n=${w.out.n} win ${(100 * w.out.win).toFixed(1)}% net ${fmtR(w.out.net)}`);
      console.log(`  windows where IN is worse (win/gross/net): ${c.worse.win}/${c.worse.gross}/${c.worse.net} of ${c.windows}${c.thin ? ` (${c.thin} thin)` : ''}  -> verdict: ${c.verdict.toUpperCase()}${c.verdictNote ? ' -- ' + c.verdictNote : ''}`);
    }
  }
}
