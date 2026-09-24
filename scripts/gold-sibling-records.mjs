#!/usr/bin/env node
/* HARDGATE — hg-v934: write HG_GOLD_SIBLING_RECORD from the committed walk.

   WHY THIS IS GENERATED AND NOT TYPED. hg-v909 shipped a hand-transcribed
   evidence block taken from the wrong file, and hg-v921 answered it by making
   every derived literal write itself from the artifact. This is the same rule
   for the sibling records: the numbers on a GOLD SCALP card that name an
   OMNIGOLD mechanic's measured history must BE that history, not a copy of it
   that a later re-bake silently invalidates.

   WHICH RECORD. sequentialBake.formedByKind — the GATE-CLEAR population, what
   actually cleared OMNIGOLD's stack. hg-v917 measured that this is worse than
   the unscoped perKind line for 42 of 54 mechanics, and it is the honest one:
   a firing the gates rejected is not a trade the desk would have shown.

   Default run is a DRIFT CHECK and writes nothing. --write rewrites the block.
   A twin named in the source with no record in the artifact is FATAL, never
   skipped — a missing record silently becomes "no evidence", which is exactly
   the false statement this pack exists to remove. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'gold-extra-strategies.js');
export const ART = path.join(ROOT, 'scripts', 'omnigold-replay-evidence.json');

export const BEGIN = '/* --- BEGIN GENERATED HG_GOLD_SIBLING_RECORD';
export const END = '/* --- END GENERATED HG_GOLD_SIBLING_RECORD --- */';

/** The planned R:R the measured-edge gate judges against (omnigold.js minRr). */
export const MIN_RR = 2;

/** Twin names read FROM THE SOURCE, so the map and the records cannot drift
    apart. Parsing beats a second hardcoded list for the same reason the
    records are generated at all. */
export function readTwins(src){
  const m = src.match(/var HG_GOLD_SIBLING_TWIN = \{([\s\S]*?)\n\};/);
  if (!m) throw new Error('HG_GOLD_SIBLING_TWIN not found in ' + SRC);
  const out = {};
  for (const line of m[1].split('\n')){
    const t = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(?:'([^']*)'|null)\s*,?/);
    if (t) out[t[1]] = t[2] === undefined ? null : t[2];
  }
  if (!Object.keys(out).length) throw new Error('HG_GOLD_SIBLING_TWIN parsed empty');
  /* hg-v945: gold-extra-strategies.js folds HG_GOLD_ROSTER_HOME into the twin
     map at load (a home IS the twin for the three homed roster kinds), so the
     generator has to read the same second list or it writes a literal the
     runtime then looks past -- which is how hgGoldSiblingRecord('smcliq') came
     back null with the twin correctly mapped. Missing map is FATAL, never
     skipped: a silently-absent home is a record nobody notices is gone. */
  const h = src.match(/var HG_GOLD_ROSTER_HOME = \{([\s\S]*?)\n\};/);
  if (!h) throw new Error('HG_GOLD_ROSTER_HOME not found in ' + SRC);
  let homes = 0;
  for (const line of h[1].split('\n')){
    const t = line.match(/^\s*'([A-Z0-9-]+)'\s*:\s*'([a-z0-9]+)'/);
    if (!t) continue;
    homes++;
    if (out[t[2]] === undefined) out[t[2]] = t[1];
  }
  if (!homes) throw new Error('HG_GOLD_ROSTER_HOME parsed empty');
  return out;
}

/** Significance of a hit rate against the breakeven its own R:R demands. The
    same arithmetic omnigold.js runs in the measured-edge gate — win rate alone
    says nothing without the bar the target implies. */
export function zBreakeven(winRate, settled, minRr = MIN_RR){
  const pBreak = 1 / (1 + minRr);
  const n = Math.max(1, settled);
  const se = Math.sqrt(pBreak * (1 - pBreak) / n);
  if (!(se > 0)) return 0;
  return (winRate - pBreak) / se;
}

export function buildRecords(twins, artifact){
  const formed = (artifact.sequentialBake && artifact.sequentialBake.formedByKind) || {};
  const perKind = artifact.perKind || {};
  const out = {};
  const missing = [];
  for (const kind of Object.keys(twins)){
    const twin = twins[kind];
    if (!twin) continue;                      /* declared as having no twin */
    const f = formed[twin];
    if (!f || !isFinite(+f.settled)){
      /* Never observed in the walk. That is a real state (24 of 78 mechanics
         are in it) and it is NOT an error — but it must not silently become a
         record of zeros, so it is left out and the note falls back to the
         honest empty line. */
      if (!perKind[twin]) continue;
      missing.push(twin);
      continue;
    }
    out[twin] = {
      n: +f.n,
      settled: +f.settled,
      winRate: +(+f.winRate).toFixed(4),
      grossR: +(+f.grossR).toFixed(4),
      netXm: +(+f.netR_xm).toFixed(4),
      tCluster: +(+f.effective.tCluster).toFixed(2),
      zBreakeven: +zBreakeven(+f.winRate, +f.settled).toFixed(2),
      minRr: MIN_RR,
      breakevenPct: +(100 / (1 + MIN_RR)).toFixed(1)
    };
  }
  if (missing.length){
    throw new Error('twin observed in perKind but absent from formedByKind: ' + missing.join(', '));
  }
  return out;
}

export function renderBlock(records){
  const keys = Object.keys(records).sort();
  const lines = keys.map(k => {
    const r = records[k];
    return "  '" + k + "': { n: " + r.n + ', settled: ' + r.settled
      + ', winRate: ' + r.winRate + ', grossR: ' + r.grossR
      + ', netXm: ' + r.netXm + ', tCluster: ' + r.tCluster
      + ', zBreakeven: ' + r.zBreakeven + ', minRr: ' + r.minRr
      + ', breakevenPct: ' + r.breakevenPct + ' }';
  });
  return 'var HG_GOLD_SIBLING_RECORD = {\n' + lines.join(',\n') + '\n};';
}

export function splice(src, body){
  const i = src.indexOf(BEGIN);
  const j = src.indexOf(END);
  if (i < 0 || j < 0 || j < i) throw new Error('generated block markers not found in ' + SRC);
  const headEnd = src.indexOf('*/', i);
  if (headEnd < 0 || headEnd > j) throw new Error('generated block header unterminated');
  return src.slice(0, headEnd + 2) + '\n' + body + '\n' + src.slice(j);
}

export function run(write){
  const src = fs.readFileSync(SRC, 'utf8');
  const art = JSON.parse(fs.readFileSync(ART, 'utf8'));
  const records = buildRecords(readTwins(src), art);
  const next = splice(src, renderBlock(records));
  const drift = next !== src;
  if (write && drift) fs.writeFileSync(SRC, next);
  return { records, drift, wrote: !!(write && drift) };
}

/* basename, not endsWith: tests/test-gold-sibling-records.mjs ends with this
   filename too, and an endsWith guard made importing the module run the CLI
   and set process.exitCode from inside someone else's test. */
if (process.argv[1] && path.basename(process.argv[1]) === 'gold-sibling-records.mjs'){
  const write = process.argv.includes('--write');
  const r = run(write);
  const names = Object.keys(r.records).sort();
  console.log('window        ' + JSON.parse(fs.readFileSync(ART, 'utf8')).window);
  console.log('twins with a record  ' + names.length);
  for (const n of names){
    const x = r.records[n];
    console.log('  ' + n.padEnd(14) + 'settled ' + String(x.settled).padStart(4)
      + '  win ' + (x.winRate * 100).toFixed(1) + '%'
      + '  gross ' + (x.grossR >= 0 ? '+' : '') + x.grossR.toFixed(4)
      + '  netXM ' + (x.netXm >= 0 ? '+' : '') + x.netXm.toFixed(4)
      + '  z ' + (x.zBreakeven >= 0 ? '+' : '') + x.zBreakeven.toFixed(2)
      + (x.zBreakeven <= -2 ? '   <-- MEASURED FAILURE, not portable' : ''));
  }
  console.log(r.wrote ? 'WROTE gold-extra-strategies.js'
    : (r.drift ? 'DRIFT — run with --write' : 'no drift'));
  if (r.drift && !write) process.exitCode = 1;
}
