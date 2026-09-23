#!/usr/bin/env node
/* HARDGATE — hg-v936: the MILLI GOLD roster, generated from the walk.

   ASKED FOR: a tab that forms gold setups from ONLY the indicators and
   strategies that measured profitable across the gold desks.

   THE ROSTER IS DERIVABLE AND IS DERIVED HERE. A mechanic is on it when its
   GATE-CLEAR record — the population that actually cleared OMNIGOLD's stack,
   which hg-v917 showed is the honest line and is worse than the unscoped one
   for 42 of 54 mechanics — is net-positive at XM on at least MIN_N firings.
   Nine of 54 qualify. Generated, never typed: hg-v909 shipped a
   hand-transcribed evidence block from the wrong file and hg-v921 answered it
   by making the literals write themselves, and a roster is the last place a
   stale number should live, because it decides what the tab forms at all.

   WHAT THIS ROSTER IS NOT, AND THE TAB SAYS SO IN ITS FIRST PANEL.

   hg-v935 tested this exact selection procedure out of sample — four disjoint
   windows, the mechanics ranked on the other three each time — and "keep the
   net-positive mechanics" scored 13-14 of 16. NEVER UNANIMOUS. So the +0.0565R
   this cohort shows is what it did IN THE BOOK IT WAS CHOSEN FROM, and is an
   upper bound on what it should be expected to do, not a forecast. Every one
   of the nine also sits inside the noise on its own: the largest cluster-robust
   t is about 1.55, against a family bar above 3.1.

   That does not make the tab dishonest; it makes the disclosure mandatory.
   The roster is the best available reading of which mechanics have paid, and
   the panel states, from these same generated numbers, exactly how much
   weight that reading carries.

   Default run is a DRIFT CHECK and writes nothing. --write rewrites the block.
   Re-derive: node scripts/milli-gold-roster.mjs   (npm run gold:milli)
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ART = join(HERE, 'omnigold-replay-evidence.json');
export const SRC = join(HERE, '..', 'milligold.js');

export const BEGIN = '/* --- BEGIN GENERATED HG_MILLI_ROSTER';
export const END = '/* --- END GENERATED HG_MILLI_ROSTER --- */';

/** Firings a mechanic needs before its sign is read at all. MIN_SAMPLES in
    omnigold.js is 20 and this is deliberately the same number: a roster that
    used a looser floor than the desk's own evidence gate would be admitting
    mechanics the gate itself calls too thin to judge. */
export const MIN_N = 20;
export const MIN_RR = 2;

const r4 = (x) => Math.round(x * 10000) / 10000;

export function buildRoster(artifact){
  const formed = (artifact.sequentialBake && artifact.sequentialBake.formedByKind) || {};
  const rows = [];
  for (const kind of Object.keys(formed)){
    const f = formed[kind];
    if (!f || !isFinite(+f.settled) || !(+f.settled > 0)) continue;
    if (!(+f.n >= MIN_N)) continue;
    if (!(+f.netR_xm > 0)) continue;
    rows.push({
      kind, n: +f.n, settled: +f.settled,
      winRate: r4(+f.winRate), grossR: r4(+f.grossR), netXm: r4(+f.netR_xm),
      tCluster: +(+f.effective.tCluster).toFixed(2)
    });
  }
  rows.sort((a, b) => b.netXm - a.netXm || a.kind.localeCompare(b.kind));
  return rows;
}

/** The cohort's own pooled record, weighted by settled trades — the number the
    panel quotes, and the one hg-v935 says is an upper bound. */
export function cohort(rows){
  const n = rows.reduce((a, r) => a + r.settled, 0);
  if (!n) return { n: 0, gross: 0, net: 0, mechanics: 0, maxAbsT: 0 };
  return {
    n, mechanics: rows.length,
    gross: r4(rows.reduce((a, r) => a + r.grossR * r.settled, 0) / n),
    net: r4(rows.reduce((a, r) => a + r.netXm * r.settled, 0) / n),
    maxAbsT: Math.max(...rows.map((r) => Math.abs(r.tCluster)))
  };
}

export function renderBlock(rows, co, artifact){
  const lines = rows.map((r) => "    { kind: '" + r.kind + "', n: " + r.n
    + ', settled: ' + r.settled + ', winRate: ' + r.winRate + ', grossR: ' + r.grossR
    + ', netXm: ' + r.netXm + ', tCluster: ' + r.tCluster + ' }').join(',\n');
  return 'var HG_MILLI_ROSTER = {\n'
    + "    window: '" + String(artifact.window) + "', minN: " + MIN_N + ', minRr: ' + MIN_RR + ',\n'
    + '    cohortN: ' + co.n + ', cohortGross: ' + co.gross + ', cohortNet: ' + co.net + ',\n'
    + '    maxAbsT: ' + co.maxAbsT + ',\n'
    + '    kinds: [\n' + lines + '\n    ]\n  };';
}

export function splice(src, body){
  const i = src.indexOf(BEGIN), j = src.indexOf(END);
  if (i < 0 || j < 0 || j < i) throw new Error('HG_MILLI_ROSTER markers not found in milligold.js');
  const headEnd = src.indexOf('*/', i);
  if (headEnd < 0 || headEnd > j) throw new Error('HG_MILLI_ROSTER header unterminated');
  return src.slice(0, headEnd + 2) + '\n  ' + body + '\n  ' + src.slice(j);
}

export function run(write){
  const art = JSON.parse(readFileSync(ART, 'utf8'));
  const rows = buildRoster(art);
  if (!rows.length) throw new Error('roster is EMPTY — refusing to write a tab that forms nothing');
  const co = cohort(rows);
  const src = readFileSync(SRC, 'utf8');
  const next = splice(src, renderBlock(rows, co, art));
  const drift = next !== src;
  if (write && drift) writeFileSync(SRC, next);
  return { rows, cohort: co, drift, wrote: !!(write && drift) };
}

if (process.argv[1] && basename(process.argv[1]) === 'milli-gold-roster.mjs'){
  const write = process.argv.includes('--write');
  const r = run(write);
  console.log('MILLI GOLD roster — net-positive at XM on the gate-clear population, n >= ' + MIN_N);
  for (const x of r.rows){
    console.log('  ' + x.kind.padEnd(15) + 'n=' + String(x.n).padStart(4)
      + '  settled=' + String(x.settled).padStart(4)
      + '  win ' + (x.winRate * 100).toFixed(1) + '%'
      + '  gross +' + x.grossR.toFixed(4) + '  net +' + x.netXm.toFixed(4)
      + '  t ' + (x.tCluster >= 0 ? '+' : '') + x.tCluster.toFixed(2));
  }
  console.log('\ncohort: ' + r.cohort.mechanics + ' mechanics, ' + r.cohort.n
    + ' settled trades, gross +' + r.cohort.gross.toFixed(4)
    + 'R, net +' + r.cohort.net.toFixed(4) + 'R at XM');
  console.log('largest |t| on the roster: ' + r.cohort.maxAbsT.toFixed(2)
    + ' — none of these is individually significant');
  console.log('hg-v935: this selection scored 13-14/16 out of sample, NEVER unanimous,');
  console.log('so the cohort net above is an UPPER BOUND, not a forecast.');
  console.log(r.wrote ? 'WROTE milligold.js' : (r.drift ? 'DRIFT — run with --write' : 'no drift'));
  if (r.drift && !write) process.exitCode = 1;
}
