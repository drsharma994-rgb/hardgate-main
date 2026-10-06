#!/usr/bin/env node
/* hg-v1160 -- which signal-time read on TREND MATRIX separates winners, on the
   desk's own replay (scripts/backtest-trendmx.mjs), across DISJOINT windows.

   A config over the one core this repo keeps (scripts/factor-sep-core.mjs,
   hg-v988): the window rule, the lean / degenerate classification, the
   literal writer and the marker splice are written once there; this file says
   which reads this desk's replay rows carry. The reads are the hg-v1159 marks
   the live desk records on every forward record -- the five composite legs,
   the ADX bar, the fresh cross, the momentum, volume and trend-quality
   witnesses -- plus the gate tally, the tier, the ticket claim, PERFECT, the
   direction, the plan geometry and the session. Every three-state read is two
   factors (WITH against the rest, AGAINST against the rest), because the
   complement of true includes absent and absent is not a verdict.

   WHEN THERE IS NO ARTIFACT the literal reads `measured: false` with an empty
   row set and a note that says the walk has not run (the hg-v990 shape):
   nothing here invents a verdict a machine with market access has not made.
   The committed tree carries exactly that today -- every route out of the
   environment that wrote it answered 403, and no bar was fetched.

   Usage: node scripts/trendmx-factor-separation.mjs [--json] [--write] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFactors, literalFor, spliceBetween, cliTail, printRows, WINDOWS, MIN_SIDE } from './factor-sep-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT = path.join(HERE, 'backtest-trendmx-results.json');
export const TARGET = path.join(HERE, '..', 'trendtable.combined.js');
export const BEGIN = '/* --- BEGIN GENERATED HG_TM_FACTOR_SEP (scripts/trendmx-factor-separation.mjs) ---';
export const END = '/* --- END GENERATED HG_TM_FACTOR_SEP --- */';
export const TAB = 'TRENDMX';
export { WINDOWS, MIN_SIDE };

const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : NaN;
const stopPct = (r) => (num(r.entry) > 0 && isFinite(num(r.stop))) ? Math.abs(r.entry - r.stop) / r.entry * 100 : NaN;
const hourUtc = (r) => parseInt(String(r.tISO).slice(11, 13), 10);

/* rows the core can judge: settled on price or time, with the fields separate() reads */
export function loadRows(file){
  const f = file || ARTIFACT;
  if (!fs.existsSync(f)) return null;
  const a = JSON.parse(fs.readFileSync(f, 'utf8'));
  const tr = Array.isArray(a.trades) ? a.trades : [];
  return tr.filter(r => r && r.tISO && r.dir && (r.outcome === 'target' || r.outcome === 'stop' || r.outcome === 'timeout') && isFinite(num(r.netR)));
}

/* the read keys are DERIVED from the rows: every mark the replay ever stamped is a factor pair */
export function inventory(rows){
  const keys = {};
  for (const r of rows){
    if (!r.reads || typeof r.reads !== 'object') continue;
    for (const k of Object.keys(r.reads)){ if (typeof r.reads[k] === 'boolean') keys[k] = (keys[k] || 0) + 1; }
  }
  return { reads: Object.keys(keys).sort(), readN: keys };
}

export function factors(rows){
  const inv = inventory(rows);
  const F = [];
  F.push({ key: 'pop:clean7', group: 'population', label: 'the 7/7 CLEAN rows (TM-CLEAN7) against the conviction rows', pick: r => r.isClean === true });
  F.push({ key: 'pop:ticket', group: 'population', label: 'the TICKET claim (the board tier is CLEAN, hg-v1159)', pick: r => r.ticket === true });
  F.push({ key: 'pop:held', group: 'population', label: 'held off the desks by a replayable witness (momentum · volume · trend quality)', pick: r => !!r.heldBy });
  F.push({ key: 'pop:perfect', group: 'population', label: 'PERFECT at fire time (hg-v1022)', pick: r => r.perfect === true });
  F.push({ key: 'pop:score5', group: 'population', label: 'composite at ±5 (every leg agreeing)', pick: r => Math.abs(num(r.score)) === 5 });
  F.push({ key: 'pop:gates6', group: 'population', label: 'gate tally ≥ 6/7', pick: r => num(r.gatesPassed) >= 6 });
  F.push({ key: 'pop:long', group: 'population', label: 'long side', pick: r => r.dir === 'long' });
  F.push({ key: 'pop:strong', group: 'population', label: 'STRONG conviction (|composite| ≥ 4)', pick: r => r.convTier === 'STRONG' || Math.abs(num(r.score)) >= 4 });
  for (const k of inv.reads){
    F.push({ key: 'read:' + k + '=with', group: 'read', label: 'the ' + k + ' mark read WITH the row', pick: r => !!(r.reads && r.reads[k] === true) });
    F.push({ key: 'read:' + k + '=against', group: 'read', label: 'the ' + k + ' mark read AGAINST the row', pick: r => !!(r.reads && r.reads[k] === false) });
  }
  F.push({ key: 'geom:limit', group: 'geometry', label: 'a resting (LIMIT) entry rather than the mark', pick: r => r.entryType === 'LIMIT' });
  F.push({ key: 'geom:stopLt1', group: 'geometry', label: 'stop < 1% of entry', pick: r => stopPct(r) < 1.0 });
  F.push({ key: 'geom:stopGe2', group: 'geometry', label: 'stop ≥ 2% of entry', pick: r => stopPct(r) >= 2.0 });
  F.push({ key: 'geom:bothTouch', group: 'geometry', label: 'settled on a bar that touched both levels (the stop-first bound)', pick: r => r.bothTouch === true });
  for (const [a, b, name] of [[0, 8, 'ASIA 00-08'], [8, 13, 'LONDON 08-13'], [13, 17, 'OVERLAP 13-17'], [17, 21, 'NY PM 17-21'], [21, 24, 'LATE 21-24']]){
    F.push({ key: 'session:' + name, group: 'session', label: 'signal bar closed in UTC ' + name, pick: r => { const h = hourUtc(r); return h >= a && h < b; } });
  }
  return { factors: F, inventory: inv };
}

export const NOT_MEASURED_NOTE = 'scripts/backtest-trendmx-results.json does not exist: the TREND MATRIX replay (scripts/backtest-trendmx.mjs) has not run on a machine that can fetch bars. Every read this desk records (hg-v1159) is unmeasured against its complement until it does; the forward ledger is the only evidence this desk has.';

export function run(rows){
  if (rows === undefined) rows = loadRows();
  const base = { artifact: path.basename(ARTIFACT), tab: TAB, forwardOnly: ['takerFlowWith', 'fundWith', 'postgate:veto'] };
  if (!rows){
    return Object.assign(base, { measured: false, n: 0, windows: WINDOWS, minSide: MIN_SIDE, span: null, rows: [], verdicts: [], leans: [], inSampleVerdicts: [], reads: [], note: NOT_MEASURED_NOTE,
      bound: 'no bound: nothing walked' });
  }
  const { factors: F, inventory: inv } = factors(rows);
  const R = runFactors(rows, F);
  delete R.sorted;
  const bt = rows.filter(r => r.bothTouch === true).length;
  return Object.assign(base, { measured: rows.length > 0 }, R, {
    reads: inv.reads,
    note: rows.length ? null : 'the artifact exists and settled no trade: nothing to judge',
    bound: 'stop-first on a both-touch bar (the lower bound, hg-v918): ' + bt + ' of ' + rows.length + ' settled rows touched both levels on one 4h bar; the other bound is not read here'
  });
}

export function literal(res){
  const R = res || run();
  return literalFor('HG_TM_FACTOR_SEP', R, { begin: BEGIN, end: END, script: 'scripts/trendmx-factor-separation.mjs',
    extra: { measured: R.measured, tab: R.tab, forwardOnly: R.forwardOnly, reads: R.reads, bound: R.bound, note: R.note } });
}
export function splice(src, lit){ return spliceBetween(src, lit, BEGIN, END, 'trendtable.combined.js'); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const res = run();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else if (!res.measured){ console.log('TREND MATRIX: NOT MEASURED -- ' + res.note); }
  else {
    console.log(`TREND MATRIX ${res.artifact}: ${res.n} walked positions, ${res.span[0]} -> ${res.span[1]}, ${res.windows} disjoint windows (min ${res.minSide} a side)`);
    printRows(res);
  }
  cliTail(res, literal(res), TARGET, 'trendtable.combined.js', { begin: BEGIN, end: END, literal: 'HG_TM_FACTOR_SEP' });
}
