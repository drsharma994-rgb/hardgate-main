#!/usr/bin/env node
/* hg-v988 — which signal-time read on OMNIPRESENT actually separates winners,
   on the desk's own replay, across DISJOINT windows.

   OMNIPRESENT tickets only a TRIGGERED zone that clears two HARD gates —
   confluence >= 3 zone sources and >= 2 pieces of exhaustion evidence
   (hg-v421: "the tab already claimed this") — and its replay stamped both
   verdicts, the zone sources, the evidence read, the distance to the zone,
   the score and the cost on all 8,502 walked trades, whatever the gates
   said. So the gates the desk forms on can be asked whether they separate.

   Method: the one core this repo keeps (scripts/factor-sep-core.mjs, the
   hg-v920 rule through hg-v984's `separate`): four windows that share no
   trade, the cohort against its complement on win rate AND gross R AND net R;
   a VERDICT needs all four to agree on all three. A LEAN is net unanimous
   while win or gross is not — reported as a separate field, never a verdict.

   One fill bound, said: the artifact carries no same-bar ambiguity flag. And
   this desk enters at the live print after the rejection (8,426 of 8,502
   rows filled on bar one), so the fill model has little to add here.

   Usage: node scripts/omnipresent-factor-separation.mjs [--json] [--write] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFactors, literalFor, spliceBetween, cliTail, printRows, WINDOWS, MIN_SIDE } from './factor-sep-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT = path.join(HERE, 'backtest-omnipresent-results.json');
export const TARGET = path.join(HERE, '..', 'omnipresent.js');
export const BEGIN = '/* --- BEGIN GENERATED HG_OP_FACTOR_SEP (scripts/omnipresent-factor-separation.mjs) ---';
export const END = '/* --- END GENERATED HG_OP_FACTOR_SEP --- */';
export { WINDOWS, MIN_SIDE };

const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : NaN;
const stopPct = (r) => (num(r.entry) > 0 && isFinite(num(r.stop))) ? Math.abs(r.entry - r.stop) / r.entry * 100 : NaN;
const hourUtc = (r) => parseInt(String(r.tISO).slice(11, 13), 10);
const hasSrc = (r, s) => Array.isArray(r.srcs) && r.srcs.indexOf(s) >= 0;
const hasEv = (r, prefix) => Array.isArray(r.evidence) && r.evidence.some(e => String(e).indexOf(prefix) === 0);

export function loadRows(file){
  const a = JSON.parse(fs.readFileSync(file || ARTIFACT, 'utf8'));
  const tr = Array.isArray(a.trades) ? a.trades : [];
  return tr.filter(r => r && r.tISO && r.dir && r.outcome && Array.isArray(r.srcs) && Array.isArray(r.evidence));
}

/* the zone sources and evidence kinds are DERIVED from the rows, not typed:
   every source the replay ever clustered and every evidence family it ever
   read is a factor, so a re-bake that adds one adds a row here. */
export function inventory(rows){
  const srcs = {}, evs = {};
  for (const r of rows){
    for (const s of r.srcs) srcs[s] = (srcs[s] || 0) + 1;
    for (const e of r.evidence){
      /* the family is the text before the first digit or dash: "volume climax — 3.3σ ..." -> "volume climax",
         "stretched -1.6xATR below EMA21" -> "stretched" */
      const fam = String(e).split(/\s[—-]\s|\s[-+]?\d/)[0].trim();
      if (fam) evs[fam] = (evs[fam] || 0) + 1;
    }
  }
  return { srcs: Object.keys(srcs).sort((a, b) => srcs[b] - srcs[a]), evs: Object.keys(evs).sort((a, b) => evs[b] - evs[a]), srcN: srcs, evN: evs };
}

export function factors(rows){
  const inv = inventory(rows);
  const scores = rows.map(r => num(r.score)).filter(isFinite).sort((a, b) => a - b);
  const medScore = scores.length ? scores[Math.floor(scores.length / 2)] : NaN;
  const F = [];
  F.push({ key: 'gate:confluence3', group: 'gate', label: 'hard gate: confluence ≥ 3 zone sources (hg-v421)', pick: r => r.gateConfluence3 === true });
  F.push({ key: 'gate:evidence2', group: 'gate', label: 'hard gate: ≥ 2 exhaustion reads (hg-v421)', pick: r => r.gateEvidence2 === true });
  F.push({ key: 'gate:both', group: 'gate', label: 'both hard gates clear (the TICKET population)', pick: r => r.gateConfluence3 === true && r.gateEvidence2 === true });
  F.push({ key: 'zone:confluence4', group: 'zone', label: 'confluence ≥ 4 sources', pick: r => num(r.confluence) >= 4 });
  F.push({ key: 'zone:evidence1', group: 'zone', label: '≥ 1 exhaustion read', pick: r => num(r.evidenceN) >= 1 });
  F.push({ key: 'zone:scoreHi', group: 'zone', label: 'score at or above the book median (' + (isFinite(medScore) ? medScore.toFixed(1) : '—') + ')', pick: r => num(r.score) >= medScore });
  F.push({ key: 'zone:distLt025', group: 'zone', label: 'zone < 0.25×ATR from the print at signal', pick: r => num(r.distAtr) < 0.25 });
  F.push({ key: 'zone:distGe1', group: 'zone', label: 'zone ≥ 1×ATR from the print at signal', pick: r => num(r.distAtr) >= 1.0 });
  for (const s of inv.srcs) F.push({ key: 'src:' + s, group: 'source', label: 'zone built on ' + s, pick: r => hasSrc(r, s) });
  for (const e of inv.evs) F.push({ key: 'ev:' + e, group: 'evidence', label: 'exhaustion read: ' + e, pick: r => hasEv(r, e) });
  F.push({ key: 'pop:long', group: 'population', label: 'long side (OP-LOW-REJECT)', pick: r => r.dir === 'long' });
  F.push({ key: 'geom:costGe012', group: 'geometry', label: 'costR ≥ 0.12 (the ceiling in force, hg-v607)', pick: r => num(r.costR) >= 0.12 });
  F.push({ key: 'geom:costGe03', group: 'geometry', label: 'costR ≥ 0.30', pick: r => num(r.costR) >= 0.30 });
  F.push({ key: 'geom:stopLt05', group: 'geometry', label: 'stop < 0.5% of entry', pick: r => stopPct(r) < 0.5 });
  F.push({ key: 'geom:stopGe1', group: 'geometry', label: 'stop ≥ 1% of entry', pick: r => stopPct(r) >= 1.0 });
  for (const [a, b, name] of [[0, 8, 'ASIA 00-08'], [8, 13, 'LONDON 08-13'], [13, 17, 'OVERLAP 13-17'], [17, 21, 'NY PM 17-21'], [21, 24, 'LATE 21-24']]){
    F.push({ key: 'session:' + name, group: 'session', label: 'signal bar closed in UTC ' + name, pick: r => { const h = hourUtc(r); return h >= a && h < b; } });
  }
  return { factors: F, inventory: inv, medScore };
}

export function run(rows){
  rows = rows || loadRows();
  const { factors: F, inventory: inv } = factors(rows);
  const R = runFactors(rows, F);
  delete R.sorted;
  return Object.assign({ artifact: path.basename(ARTIFACT) }, R, {
    tab: 'OMNIPRESENT',   /* hg-v989: the desk whose forward records mark these reads */
    bound: 'as-recorded only — the artifact carries no same-bar ambiguity flag; this desk enters at the live print so the fill model has little to add',
    sources: inv.srcs, evidenceKinds: inv.evs
  });
}

export function literal(res){
  const R = res || run();
  return literalFor('HG_OP_FACTOR_SEP', R, { begin: BEGIN, end: END, script: 'scripts/omnipresent-factor-separation.mjs',
    extra: { tab: R.tab, bound: R.bound, sources: R.sources, evidenceKinds: R.evidenceKinds } });
}

export function splice(src, lit){ return spliceBetween(src, lit, BEGIN, END, 'omnipresent.js'); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const res = run();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else {
    console.log(`OMNIPRESENT ${res.artifact}: ${res.n} walked rows, ${res.span[0]} -> ${res.span[1]}, ${res.windows} disjoint windows (min ${res.minSide} a side)`);
    printRows(res);
  }
  cliTail(res, literal(res), TARGET, 'omnipresent.js', { begin: BEGIN, end: END, literal: 'HG_OP_FACTOR_SEP' });
}
