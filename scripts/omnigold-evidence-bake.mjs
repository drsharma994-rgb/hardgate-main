#!/usr/bin/env node
/* HARDGATE — re-bake OMNIGOLD's evidence over trades a person could take.
   ======================================================================

   HG_OG_REPLAY_EVIDENCE quotes its record over EVERY plan the scan forms.
   On this walk that is 59.4 plans a day on one instrument, 9.34 per 4h
   bar, with a time-weighted mean of 57 positions open at once and a peak
   of 109.

   Two things follow, and both of them make the numbers on the cards wrong
   in the same direction — too confident.

   1. POPULATION. A person holds one gold position, not 57. The record of
      "every plan formed" describes trades nobody took. The SEQUENTIAL book
      below is the honest one: walk the plans in time order, take one when
      flat, hold it to its own exit, skip everything that fires while it
      runs. Same plans, same exits, no lookahead — just the constraint a
      human actually has.

      It is not a small difference. Priced at XM, every plan formed nets
      -0.252R a trade; ticket-only, one at a time, it nets +0.030R.

   2. INDEPENDENCE. Every Wilson interval and z-score on a card assumes n
      independent trades. Fifty-seven simultaneous positions on one
      instrument is one bet repeated, so the real information content is
      far below the row count. Clustering the per-trade R by firing day
      deflates t by ~1.8x; by week, more. This bake reports an EFFECTIVE
      sample size — the n that would produce the observed clustered
      standard error if the trades really were independent — so an
      interval can be widened to what the evidence supports.

      effN is never allowed to exceed n. A clustering that happens to come
      out tighter than independence is sampling noise, not extra
      information, and rounding it up would hand back exactly the
      overconfidence this exists to remove.

   Writes scripts/omnigold-replay-evidence.json (adding `sequential` and
   `effective`) and prints a paste-ready block for the constant in
   omnigold.js. Never invents a row: a cohort with no settled trades is
   omitted, not zero-filled.

   Run: node scripts/omnigold-evidence-bake.mjs [--write] [--json]
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const JSON_OUT = argv.includes('--json');

const WALK = path.join(ROOT, 'scripts', 'backtest-omnigold-results.json');
if (!fs.existsSync(WALK)){ console.error('no walk at ' + WALK); process.exit(1); }
const walk = JSON.parse(fs.readFileSync(WALK, 'utf8'));
const PAXG = (walk.meta && walk.meta.fees && walk.meta.fees.roundTripFrac) || 0.0026;
const XM = 0.0002;

const s = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? s(a) / a.length : NaN;
const riskOf = r => Math.abs(r.entry - r.stop);
const costR = (r, frac) => r.entry * frac / riskOf(r);
const isWin = r => r.outcome === 'win';
const isLoss = r => String(r.outcome).startsWith('loss');
const settledRow = r => typeof r.rMultiple === 'number';

/* the ambiguous same-bar wins are dropped everywhere: the bar spanned both
   levels and the walk resolved it optimistically. 462 of them, 18.7% of all
   wins, worth 0.12R a trade of flattery. */
const formed = (walk.trades || []).filter(r => settledRow(r) && !r.ambiguousSameBarWin);

/* ---------- the sequential book ---------- */
function sequential(pool){
  const rows = pool.filter(r => r.exitISO && r.tISO)
    .slice().sort((a, b) => new Date(a.tISO) - new Date(b.tISO));
  const out = [];
  let freeAt = 0;
  for (const r of rows){
    const t = +new Date(r.tISO);
    if (t < freeAt) continue;            /* a position is already running */
    out.push(r);
    freeAt = +new Date(r.exitISO);
  }
  return out;
}

/* ---------- clustered standard error, and the effective n it implies ---- */
function clusterKey(r, width){
  if (width === 'week'){
    const d = new Date(r.tISO);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  }
  return r.tISO.slice(0, 10);            /* day */
}

function effective(rows, width){
  const xs = rows.map(r => r.rMultiple);
  const n = xs.length;
  if (n < 2) return { n, effN: n, tNaive: NaN, tCluster: NaN, clusters: n };
  const mu = mean(xs);
  const sd = Math.sqrt(s(xs.map(x => (x - mu) * (x - mu))) / (n - 1));
  const seNaive = sd / Math.sqrt(n);
  const g = {};
  for (const r of rows){ const k = clusterKey(r, width); (g[k] = g[k] || []).push(r.rMultiple - mu); }
  const groups = Object.values(g);
  const meat = s(groups.map(v => s(v) * s(v)));
  const seCluster = Math.sqrt(meat) / n;
  /* effN solves sd/sqrt(effN) = seCluster */
  let effN = (seCluster > 0) ? (sd * sd) / (seCluster * seCluster) : n;
  /* NEVER above n: a cluster SE tighter than independence is noise, and
     rounding it up would hand back the overconfidence this removes. */
  effN = Math.max(1, Math.min(n, effN));
  return {
    n, effN: +effN.toFixed(1), clusters: groups.length,
    tNaive: +(mu / seNaive).toFixed(2),
    tCluster: +(mu / seCluster).toFixed(2),
    inflation: +(Math.abs((mu / seNaive) / (mu / seCluster)) || 1).toFixed(2)
  };
}

function record(rows, width){
  if (!rows.length) return null;
  const w = rows.filter(isWin).length, l = rows.filter(isLoss).length;
  const eff = effective(rows, width);
  return {
    n: rows.length,
    settled: w + l,
    wins: w,
    winRate: (w + l) ? +(w / (w + l)).toFixed(4) : null,
    grossR: +mean(rows.map(r => r.rMultiple)).toFixed(4),
    netR_paxg: +mean(rows.map(r => r.rMultiple - costR(r, PAXG))).toFixed(4),
    netR_xm: +mean(rows.map(r => r.rMultiple - costR(r, XM))).toFixed(4),
    medianCostR_paxg: (() => {
      const a = rows.map(r => costR(r, PAXG)).sort((x, y) => x - y);
      return +a[Math.floor(a.length / 2)].toFixed(3);
    })(),
    effective: eff
  };
}

function groupBy(rows, keyFn, width, minN){
  const g = {};
  for (const r of rows){ const k = keyFn(r); if (k == null) continue; (g[k] = g[k] || []).push(r); }
  const out = {};
  for (const [k, v] of Object.entries(g)){
    if (v.length < (minN || 1)) continue;   /* omitted, never zero-filled */
    out[k] = record(v, width);
  }
  return out;
}

/* ---------- concurrency, the fact that motivates all of this ---------- */
function concurrency(pool){
  const ev = [];
  for (const r of pool){
    if (!r.exitISO || /unfill/.test(r.outcome)) continue;
    ev.push([+new Date(r.tISO), 1]); ev.push([+new Date(r.exitISO), -1]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0, peak = 0, area = 0, prev = ev.length ? ev[0][0] : 0;
  for (const [t, d] of ev){ area += open * (t - prev); prev = t; open += d; if (open > peak) peak = open; }
  const spanMs = ev.length ? (prev - ev[0][0]) : 0;
  return { peak, meanOpen: spanMs > 0 ? +(area / spanMs).toFixed(1) : null };
}

const WIDTH = 'week';   /* positions run up to 5 days, so day clusters overlap */
const seq = sequential(formed);
const seqTickets = sequential(formed.filter(r => r.ticket));

const bake = {
  generated: new Date().toISOString(),
  src: 'scripts/backtest-omnigold-results.json',
  window: walk.meta && walk.meta.span
    ? (walk.meta.span.from.slice(0, 10) + '..' + walk.meta.span.to.slice(0, 10)) : null,
  barBasis: (walk.meta && walk.meta.universe) || null,
  clusterWidth: WIDTH,
  costModel: { paxgRtFrac: PAXG, xmRtFrac: XM },
  concurrency: concurrency(formed),
  populations: {
    formed: record(formed, WIDTH),
    sequential: record(seq, WIDTH),
    sequentialTickets: record(seqTickets, WIDTH)
  },
  formedByKind: groupBy(formed, r => r.kind, WIDTH, 40),
  sequentialByCell: groupBy(seq, r => r.horizon + '/' + r.tier, WIDTH, 10),
  sequentialByKind: groupBy(seq, r => r.kind, WIDTH, 10)
};

if (JSON_OUT){ console.log(JSON.stringify(bake, null, 2)); process.exit(0); }

const pct = v => (v == null || !isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%';
const r3 = v => (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(3) + 'R';

console.log('OMNIGOLD EVIDENCE — re-baked over trades a person could take');
console.log('============================================================\n');
console.log('  window ' + bake.window + '   clusters: ' + WIDTH);
console.log('  concurrency: peak ' + bake.concurrency.peak + ' open, time-weighted mean '
  + bake.concurrency.meanOpen);
console.log('  -> the shipped constant quotes the FORMED row, which assumes every');
console.log('     one of those simultaneous positions is a separate independent trade.\n');

for (const [label, rec] of Object.entries(bake.populations)){
  if (!rec) continue;
  console.log('  ' + label.padEnd(20)
    + 'n=' + String(rec.n).padStart(5)
    + '  win=' + pct(rec.winRate).padStart(7)
    + '  gross=' + r3(rec.grossR).padStart(8)
    + '  net@XM=' + r3(rec.netR_xm).padStart(8)
    + '  net@PAXG=' + r3(rec.netR_paxg).padStart(8));
  console.log('  ' + ' '.repeat(20)
    + 'effective n=' + String(rec.effective.effN).padStart(7)
    + ' of ' + rec.n
    + '   t naive ' + String(rec.effective.tNaive).padStart(6)
    + ' -> clustered ' + String(rec.effective.tCluster).padStart(6)
    + '  (' + rec.effective.inflation + 'x)');
}

console.log('\n  SEQUENTIAL BOOK BY CELL (one position at a time)');
for (const [k, v] of Object.entries(bake.sequentialByCell).sort((a, b) => b[1].n - a[1].n)){
  console.log('    ' + k.padEnd(14) + 'n=' + String(v.n).padStart(4)
    + '  win=' + pct(v.winRate).padStart(7)
    + '  gross=' + r3(v.grossR).padStart(8)
    + '  net@XM=' + r3(v.netR_xm).padStart(8)
    + '  effN=' + v.effective.effN);
}

if (WRITE){
  const OUT = path.join(ROOT, 'scripts', 'omnigold-replay-evidence.json');
  let prior = {};
  try { prior = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { prior = {}; }
  /* additive: the existing fit study, per-kind rows and cohorts stay. This
     bake answers a different question and must not silently delete the
     answer to the old one. */
  const merged = Object.assign({}, prior, { sequentialBake: bake });
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2));
  console.log('\n  wrote sequentialBake into ' + path.relative(ROOT, OUT)
    + ' (additive — the existing fit study is untouched)');
} else {
  console.log('\n  (dry run — pass --write to update scripts/omnigold-replay-evidence.json)');
}
