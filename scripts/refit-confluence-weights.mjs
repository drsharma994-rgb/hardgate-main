#!/usr/bin/env node
// refit-confluence-weights.mjs — zero-dep ESM.
// 1) SCAN-only logistic fit of P(win) on available per-trade numeric features
//    (chronological 60/40 split, test AUC + decile lift, verdict).
// 2) Replay evidence table from ALL settled trades -> omnigold-replay-evidence.json.
//
// NOTE ON FEATURES: the trade records carry NO per-factor confluence breakdown —
// only the total `confluence` score, plus gateConf / checksPass integers and
// horizon/dir categories. So this is a fit on the aggregate score (plus dummies),
// which is the honest test of "does the score rank outcomes", not a re-weighting
// of individual confluence factors (impossible with this data).

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(HERE, 'backtest-omnigold-results.json');
const OUT = path.join(HERE, 'omnigold-replay-evidence.json');

const data = JSON.parse(readFileSync(IN, 'utf8'));
const trades = data.trades;

const SETTLED = new Set(['win', 'loss', 'loss (both-touch)', 'timeout']);
const settled = trades.filter(t => SETTLED.has(t.outcome));
const isWin = t => t.outcome === 'win';
// costR per trade: netR = rMultiple - costR  (verified vs feeModel: entry*0.0026/|stop-entry|)
const costR = t => t.rMultiple - t.netR;

console.log(`records=${trades.length} settled=${settled.length} (unfilled=${trades.length - settled.length})`);

// ---------------------------------------------------------------- utilities
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const median = a => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r3 = v => Math.round(v * 1000) / 1000;
const r4 = v => Math.round(v * 10000) / 10000;

// ------------------------------------------------- 1) SCAN logistic refit
const scan = settled.filter(t => t.source === 'SCAN')
  .sort((a, b) => a.tISO < b.tISO ? -1 : a.tISO > b.tISO ? 1 : 0);

const FEATURES = [
  { name: 'confluence', get: t => t.confluence },
  { name: 'gateConf',   get: t => (typeof t.gateConf === 'number' ? t.gateConf : 0) },
  { name: 'checksPass', get: t => (typeof t.checksPass === 'number' ? t.checksPass : 0) },
  { name: 'horizonSWING', get: t => t.horizon === 'SWING' ? 1 : 0 },
  { name: 'dirShort',     get: t => t.dir === 'short' ? 1 : 0 },
];

const X = scan.map(t => FEATURES.map(f => f.get(t)));
const y = scan.map(t => (isWin(t) ? 1 : 0));

const nTrain = Math.floor(scan.length * 0.6);
const Xtr = X.slice(0, nTrain), ytr = y.slice(0, nTrain);
const Xte = X.slice(nTrain),   yte = y.slice(nTrain);

// standardize on TRAIN stats only
const k = FEATURES.length;
const mu = Array(k).fill(0), sd = Array(k).fill(0);
for (let j = 0; j < k; j++) {
  const col = Xtr.map(r => r[j]);
  mu[j] = mean(col);
  sd[j] = Math.sqrt(mean(col.map(v => (v - mu[j]) ** 2))) || 1;
}
const z = (row) => row.map((v, j) => (v - mu[j]) / sd[j]);
const Ztr = Xtr.map(z), Zte = Xte.map(z);

// logistic regression, gradient descent w/ small L2
function fitLogistic(Z, yy, { iters = 4000, lr = 0.1, l2 = 1e-4 } = {}) {
  const n = Z.length, m = Z[0].length;
  let w = Array(m).fill(0), b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = Array(m).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      let s = b;
      for (let j = 0; j < m; j++) s += w[j] * Z[i][j];
      const p = 1 / (1 + Math.exp(-s));
      const e = p - yy[i];
      for (let j = 0; j < m; j++) gw[j] += e * Z[i][j];
      gb += e;
    }
    for (let j = 0; j < m; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
  }
  return { w, b };
}
const { w, b } = fitLogistic(Ztr, ytr);
const predict = Zrow => 1 / (1 + Math.exp(-(b + Zrow.reduce((s, v, j) => s + v * w[j], 0))));
const pte = Zte.map(predict);

// AUC via rank statistic (ties get average rank)
function auc(scores, labels) {
  const idx = scores.map((s, i) => i).sort((a, c) => scores[a] - scores[c]);
  const ranks = Array(scores.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
    const avg = (i + j + 2) / 2;
    for (let q = i; q <= j; q++) ranks[idx[q]] = avg;
    i = j + 1;
  }
  let nPos = 0, nNeg = 0, sumPos = 0;
  for (let q = 0; q < labels.length; q++) {
    if (labels[q] === 1) { nPos++; sumPos += ranks[q]; } else nNeg++;
  }
  if (!nPos || !nNeg) return NaN;
  return (sumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg);
}
const testAUC = auc(pte, yte);

// decile lift on the test set (by predicted P, decile 10 = highest)
const order = pte.map((p, i) => i).sort((a, c) => pte[a] - pte[c]);
const overallWR = mean(yte);
const deciles = [];
for (let d = 0; d < 10; d++) {
  const lo = Math.floor(d * order.length / 10), hi = Math.floor((d + 1) * order.length / 10);
  const ids = order.slice(lo, hi);
  const wr = mean(ids.map(i => yte[i]));
  deciles.push({ decile: d + 1, n: ids.length, winRate: r4(wr), lift: r3(wr / overallWR) });
}
const topDecile = deciles[9], bottomDecile = deciles[0];
const decileLift = topDecile.lift; // top-decile winRate / overall test winRate

const verdict = testAUC >= 0.55 ? 'predictive' : testAUC >= 0.52 ? 'weak' : 'not-predictive';

console.log('\n=== SCAN logistic fit (P(win); win = outcome "win"; timeouts count as non-win) ===');
console.log(`SCAN settled: ${scan.length}  train: ${nTrain}  test: ${Xte.length}  (chronological 60/40)`);
console.log('Per-factor confluence breakdowns are NOT present in the records; fit uses the');
console.log('aggregate confluence score + gateConf + checksPass + horizon/dir dummies only.');
console.log('coefficients (standardized):');
FEATURES.forEach((f, j) => console.log(`  ${f.name.padEnd(14)} ${w[j] >= 0 ? '+' : ''}${w[j].toFixed(4)}`));
console.log(`  intercept      ${b.toFixed(4)}`);
console.log(`test AUC: ${testAUC.toFixed(4)}   overall test winRate: ${(overallWR * 100).toFixed(2)}%`);
console.log('decile  n     winRate   lift');
for (const d of deciles) console.log(`  ${String(d.decile).padStart(2)}   ${String(d.n).padStart(4)}  ${(d.winRate * 100).toFixed(2).padStart(6)}%  ${d.lift.toFixed(3)}`);
console.log(`top-decile lift: ${decileLift}  bottom-decile lift: ${bottomDecile.lift}`);
console.log(`VERDICT: ${verdict}  (thresholds: >=0.55 predictive / 0.52-0.55 weak / <0.52 not-predictive)`);

// ------------------------------------------------- 2) replay evidence table
function agg(rows) {
  return {
    n: rows.length,
    winRate: r4(rows.filter(isWin).length / rows.length),
    avgNetR: r3(mean(rows.map(t => t.netR))),
    avgGrossR: r3(mean(rows.map(t => t.rMultiple))),
    medianCostR: r3(median(rows.map(costR))),
  };
}

// per-kind (all settled, n >= 40)
const byKind = new Map();
for (const t of settled) {
  if (!byKind.has(t.kind)) byKind.set(t.kind, []);
  byKind.get(t.kind).push(t);
}
const perKind = {};
for (const [kind, rows] of byKind) if (rows.length >= 40) perKind[kind] = agg(rows);

// engine grades
const byGrade = new Map();
for (const t of settled) {
  if (t.source !== 'ENGINE' || !t.engineGrade) continue;
  if (!byGrade.has(t.engineGrade)) byGrade.set(t.engineGrade, []);
  byGrade.get(t.engineGrade).push(t);
}
const engineGrades = {};
for (const [g, rows] of byGrade) {
  engineGrades[g] = { n: rows.length, winRate: r4(rows.filter(isWin).length / rows.length), avgNetR: r3(mean(rows.map(t => t.netR))) };
}

// source:horizon cohorts
const byCohort = new Map();
for (const t of settled) {
  const key = `${t.source}:${t.horizon}`;
  if (!byCohort.has(key)) byCohort.set(key, []);
  byCohort.get(key).push(t);
}
const cohorts = {};
for (const [key, rows] of byCohort) cohorts[key] = agg(rows);

const evidence = {
  fitVerdict: verdict,
  testAUC: r4(testAUC),
  decileLift,
  fitNotes: {
    cohort: 'SCAN settled only; chronological 60/40 split; win = outcome "win", timeouts = non-win',
    features: FEATURES.map(f => f.name),
    perFactorBreakdown: false,
    note: 'records carry only the aggregate confluence score - no per-factor components exist to re-weight',
    coefficientsStandardized: Object.fromEntries(FEATURES.map((f, j) => [f.name, r4(w[j])])),
    intercept: r4(b),
    testDeciles: deciles,
  },
  perKind,
  engineGrades,
  cohorts,
  costModel: { rtCostPct: 0.26 },
  window: '2026-03-15..2026-08-29',
  barBasis: 'PAXGUSDT 1h proxy',
};
writeFileSync(OUT, JSON.stringify(evidence, null, 2));

// ------------------------------------------------------------- print tables
const kindRows = Object.entries(perKind).sort((a, c) => c[1].avgGrossR - a[1].avgGrossR);
const fmtRow = ([kind, s]) => `  ${kind.padEnd(22)} n=${String(s.n).padStart(4)}  WR=${(s.winRate * 100).toFixed(1).padStart(5)}%  grossR=${s.avgGrossR.toFixed(3).padStart(7)}  netR=${s.avgNetR.toFixed(3).padStart(7)}  medCostR=${s.medianCostR.toFixed(3)}`;

console.log(`\n=== PER-KIND (all settled, n>=40; ${kindRows.length} kinds) — sorted by avgGrossR ===`);
console.log('--- 10 BEST ---');
kindRows.slice(0, 10).forEach(r => console.log(fmtRow(r)));
console.log('--- 10 WORST ---');
kindRows.slice(-10).forEach(r => console.log(fmtRow(r)));

console.log('\n=== ENGINE GRADES ===');
for (const [g, s] of Object.entries(engineGrades).sort((a, c) => c[1].n - a[1].n)) {
  console.log(`  ${g.padEnd(12)} n=${String(s.n).padStart(3)}  WR=${(s.winRate * 100).toFixed(1).padStart(5)}%  netR=${s.avgNetR.toFixed(3)}`);
}

console.log('\n=== SOURCE:HORIZON COHORTS ===');
for (const [key, s] of Object.entries(cohorts)) {
  console.log(`  ${key.padEnd(14)} n=${String(s.n).padStart(4)}  WR=${(s.winRate * 100).toFixed(1).padStart(5)}%  grossR=${s.avgGrossR.toFixed(3)}  netR=${s.avgNetR.toFixed(3)}  medCostR=${s.medianCostR.toFixed(3)}`);
}

console.log(`\nwrote ${OUT}`);
