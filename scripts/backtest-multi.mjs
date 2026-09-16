#!/usr/bin/env node
/* HARDGATE — pool the walk across symbols, because one symbol cannot prove
   anything in a human timeframe.
   =====================================================================

   THE ARITHMETIC THAT MOTIVATES THIS. The sequential book — one position
   at a time, which is what a person runs — takes 0.63 trades a day on
   PAXG with a per-trade standard deviation of 1.394R. Detecting a real
   edge at 80% power, two-sided 5%:

       edge      trades needed     one symbol     eight symbols
      +0.05R          6,103         26.6 years        3.3 years
      +0.10R          1,526          6.6 years       10 months
      +0.15R            679          3.0 years        4 months
      +0.20R            382          1.7 years        2 months

   That is the entire case. No indicator added to gold can be validated on
   a six-month single-symbol walk — you would be fitting noise and would
   not find out for years. More INDEPENDENT BETS is the only lever that
   moves the left column, and it moves it linearly.

   WHAT POOLING DOES AND DOES NOT BUY. Eight symbols multiply the sample
   only to the extent they are independent. Gold, silver and platinum move
   together; pooling them is closer to two bets than three. This script
   REPORTS the correlation of the per-symbol daily R series and discounts
   the pooled effective sample by it, rather than quoting a row count that
   assumes independence — which is precisely the error corrected in
   hgOgEffN for the single-symbol case.

   Run:
     node scripts/backtest-multi.mjs --symbols=PAXGUSDT,XAUTUSDT --run
     node scripts/backtest-multi.mjs --symbols=PAXGUSDT,XAUTUSDT

   Without --run it pools whatever per-symbol artifacts already exist and
   says which are missing. With --run it drives backtest-omnigold.mjs once
   per symbol first, which needs network access to Binance klines.
*/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isProvableFill } from '../lib/unprovable-fill.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(name + '='));
  return a ? a.split('=')[1] : dflt;
};

const SYMBOLS = String(opt('--symbols', 'PAXGUSDT')).split(',')
  .map(s => s.trim().toUpperCase()).filter(Boolean);
const RUN = has('--run');
const SMOKE = has('--smoke');
const JSON_OUT = has('--json');

const artifactFor = sym => path.join(ROOT, 'scripts',
  sym === 'PAXGUSDT' ? 'backtest-omnigold-results.json'
                     : 'backtest-omnigold-results-' + sym.toLowerCase() + '.json');

const s = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? s(a) / a.length : NaN;
const sd = a => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(s(a.map(x => (x - m) * (x - m))) / (a.length - 1));
};

/* one position at a time, per symbol — the only book a person can run */
function sequential(trades){
  const rows = (trades || [])
    /* symmetric unprovable-fill exclusion — see lib/unprovable-fill.mjs */
    .filter(r => typeof r.rMultiple === 'number' && isProvableFill(r) && r.tISO && r.exitISO)
    .sort((a, b) => new Date(a.tISO) - new Date(b.tISO));
  const out = [];
  let freeAt = 0;
  for (const r of rows){
    const t = +new Date(r.tISO);
    if (t < freeAt) continue;
    out.push(r); freeAt = +new Date(r.exitISO);
  }
  return out;
}

/* daily R per symbol, so the cross-symbol correlation can be measured on a
   common calendar rather than assumed */
function dailySeries(rows){
  const g = {};
  for (const r of rows){ const d = r.tISO.slice(0, 10); g[d] = (g[d] || 0) + r.rMultiple; }
  return g;
}

function correlation(a, b){
  const days = Object.keys(a).filter(d => Object.prototype.hasOwnProperty.call(b, d));
  if (days.length < 10) return null;          /* too few shared days to claim one */
  const xs = days.map(d => a[d]), ys = days.map(d => b[d]);
  const mx = mean(xs), my = mean(ys);
  const num = s(days.map((_, i) => (xs[i] - mx) * (ys[i] - my)));
  const den = Math.sqrt(s(xs.map(x => (x - mx) * (x - mx))) * s(ys.map(y => (y - my) * (y - my))));
  return den > 0 ? +(num / den).toFixed(3) : null;
}

/* ---------------- optionally drive the walks ---------------- */
if (RUN){
  for (const sym of SYMBOLS){
    console.log('--- walking ' + sym + ' ---');
    try {
      execFileSync(process.execPath,
        [path.join(ROOT, 'scripts', 'backtest-omnigold.mjs'), '--symbol=' + sym]
          .concat(SMOKE ? ['--smoke'] : []),
        { stdio: 'inherit' });
    } catch (e) {
      console.error('  ' + sym + ' walk failed: ' + (e && e.message));
      console.error('  (the walk fetches Binance klines — this needs network access)');
    }
  }
}

/* ---------------- pool ---------------- */
const per = [];
const missing = [];
for (const sym of SYMBOLS){
  const f = artifactFor(sym);
  if (!fs.existsSync(f)){ missing.push({ sym, file: path.relative(ROOT, f) }); continue; }
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { missing.push({ sym, file: path.relative(ROOT, f), reason: 'unreadable' }); continue; }
  const seq = sequential(j.trades);
  if (!seq.length){ missing.push({ sym, file: path.relative(ROOT, f), reason: 'no settled trades' }); continue; }
  const span = (j.meta && j.meta.span) || null;
  per.push({
    sym,
    n: seq.length,
    gross: +mean(seq.map(r => r.rMultiple)).toFixed(4),
    sd: +sd(seq.map(r => r.rMultiple)).toFixed(4),
    daily: dailySeries(seq),
    /* CALENDAR days, not days-with-a-trade. Dividing by the latter would
       report the rate on the days something happened and quietly drop
       every quiet day from the denominator — which flatters the trade
       rate and shortens every "years needed" figure below it. */
    fromMs: span ? +new Date(span.from) : null,
    toMs: span ? +new Date(span.to) : null,
    calendarDays: span ? Math.max(1, (new Date(span.to) - new Date(span.from)) / 864e5) : null,
    span: span ? (span.from.slice(0, 10) + '..' + span.to.slice(0, 10)) : null
  });
}

const pooled = [].concat(...per.map(p => Object.values(p.daily)));
const allN = s(per.map(p => p.n));

/* mean pairwise correlation of the per-symbol daily R series. Only real
   pairs count — a symbol with no overlapping days contributes nothing
   rather than a fabricated zero. */
const pairs = [];
for (let i = 0; i < per.length; i++){
  for (let k = i + 1; k < per.length; k++){
    const c = correlation(per[i].daily, per[k].daily);
    if (c != null) pairs.push({ a: per[i].sym, b: per[k].sym, r: c });
  }
}
const rBar = pairs.length ? mean(pairs.map(p => p.r)) : null;

/* effective number of INDEPENDENT symbols, the standard 1 + (k-1)*rBar
   variance-inflation form. With no measured correlation the honest answer
   is "unknown", not "independent". */
const k = per.length;
const effSymbols = (rBar == null)
  ? null
  : +(k / (1 + (k - 1) * Math.max(0, rBar))).toFixed(2);

const SD_REF = 1.394;   /* per-trade sd measured on the PAXG sequential book */
function needed(edge, sdv){
  return Math.ceil(Math.pow(2.802 * (isFinite(sdv) ? sdv : SD_REF) / edge, 2));
}

const report = {
  generated: new Date().toISOString(),
  symbols: SYMBOLS, missing,
  perSymbol: per.map(p => ({ sym: p.sym, n: p.n, gross: p.gross, sd: p.sd, span: p.span, days: Object.keys(p.daily).length })),
  pooled: {
    trades: allN,
    tradingDays: pooled.length,
    gross: per.length ? +mean(per.map(p => p.gross)).toFixed(4) : null
  },
  correlation: { pairs, mean: rBar == null ? null : +rBar.toFixed(3), effectiveSymbols: effSymbols }
};

if (JSON_OUT){ console.log(JSON.stringify(report, null, 2)); process.exit(0); }

console.log('\nMULTI-SYMBOL POOLING — the only lever that buys statistical power');
console.log('=================================================================\n');

if (missing.length){
  console.log('  NOT WALKED YET:');
  for (const m of missing) console.log('    ' + m.sym.padEnd(12) + (m.reason || 'no artifact') + '  (' + m.file + ')');
  console.log('    run:  node scripts/backtest-multi.mjs --symbols=' + SYMBOLS.join(',') + ' --run');
  console.log('    (each walk fetches Binance klines and needs network access)\n');
}

if (!per.length){
  console.log('  Nothing pooled. With no per-symbol walk on disk there is no sample to');
  console.log('  report, and quoting one would be inventing it.');
  process.exit(0);
}

console.log('  SEQUENTIAL BOOK PER SYMBOL (one position at a time, EVERY plan eligible)');
console.log('  Filtering to ticket:true thins it further — 105 trades rather than 275 on');
console.log('  PAXG — so the years below are the OPTIMISTIC end of the range.');
for (const p of per){
  console.log('    ' + p.sym.padEnd(12) + 'n=' + String(p.n).padStart(5)
    + '  gross=' + (p.gross >= 0 ? '+' : '') + p.gross.toFixed(3) + 'R'
    + '  sd=' + p.sd.toFixed(3)
    + '  over ' + String(Object.keys(p.daily).length).padStart(4) + ' trading days'
    + (p.span ? '  ' + p.span : ''));
}
console.log('    ' + 'POOLED'.padEnd(12) + 'n=' + String(allN).padStart(5));

console.log('\n  HOW INDEPENDENT ARE THEY?');
if (!pairs.length){
  console.log('    Not measurable: fewer than two symbols with 10+ shared trading days.');
  console.log('    Until it is measured, pooled n is an UPPER BOUND on the real sample.');
} else {
  for (const p of pairs) console.log('    ' + p.a + ' vs ' + p.b + '  daily-R correlation ' + p.r.toFixed(3));
  console.log('    mean ' + rBar.toFixed(3) + '  ->  ' + k + ' symbols carry about '
    + effSymbols + ' independent bets');
  console.log('    Gold, silver and platinum move together. Pooling correlated');
  console.log('    instruments multiplies rows faster than it multiplies evidence.');
}

console.log('\n  WHAT THAT BUYS');
const sdPool = mean(per.map(p => p.sd));
/* symbols are walked over the SAME calendar window concurrently, so the
   pooled denominator is the union span, not the sum of the per-symbol ones */
const froms = per.map(p => p.fromMs).filter(x => isFinite(x));
const tos = per.map(p => p.toMs).filter(x => isFinite(x));
const unionDays = (froms.length && tos.length)
  ? Math.max(1, (Math.max.apply(null, tos) - Math.min.apply(null, froms)) / 864e5)
  : null;
const perDay = unionDays ? (allN / unionDays) : NaN;
if (!isFinite(perDay)){
  console.log('    no calendar span on the artifacts — cannot state a rate, so it is not stated.');
} else {
console.log('    per-trade sd ' + sdPool.toFixed(3) + ', ' + perDay.toFixed(2)
  + ' trades/day pooled over ' + unionDays.toFixed(0) + ' calendar days');
console.log('    edge      trades needed      years at this rate');
for (const e of [0.05, 0.10, 0.15, 0.20]){
  const n = needed(e, sdPool);
  const yrs = n / perDay / 365;
  console.log('    +' + e.toFixed(2) + 'R' + String(n).padStart(16) + String(yrs.toFixed(1)).padStart(22));
}
}
console.log('\n    Those years assume the symbols are independent. Divide the rate by');
console.log('    ' + (effSymbols ? (k / effSymbols).toFixed(2) : '(unmeasured)')
  + ' to price the correlation above, and the years scale up by the same.');
