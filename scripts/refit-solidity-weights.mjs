#!/usr/bin/env node
// refit-solidity-weights.mjs
// Zero-dependency logistic regression refit of OMNIROUTE solidity pillar weights.
// Chronological 60/40 train/test split, honest out-of-sample evaluation.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, 'backtest-omniroute-results.json');
const OUTPUT = path.join(__dirname, 'solidity-refit.json');

const EPS_VAR = 1e-9;

// ---------- Load ----------
const raw = JSON.parse(readFileSync(INPUT, 'utf8'));
const trades = raw.trades.slice();
if (!Array.isArray(trades) || trades.length === 0) {
  throw new Error('No trades found in ' + INPUT);
}

// Chronological order (input is NOT sorted). Stable sort by trade time.
trades.sort((a, b) => Date.parse(a.tISO) - Date.parse(b.tISO));

// ---------- Pillar inventory ----------
const pillarNames = Object.keys(trades[0].pillarBreakdown);

function variance(xs) {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  return xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n;
}

const dropped = [];
const pillarsUsed = [];
for (const p of pillarNames) {
  const col = trades.map(t => Number(t.pillarBreakdown[p] ?? 0));
  const v = variance(col);
  if (v < EPS_VAR) {
    dropped.push({ pillar: p, reason: `constant across all trades (variance=${v.toExponential(2)} < ${EPS_VAR})`, constantValue: col[0] });
  } else {
    pillarsUsed.push(p);
  }
}

// ---------- Design matrix ----------
const X = trades.map(t => pillarsUsed.map(p => Number(t.pillarBreakdown[p] ?? 0)));
const yWin = trades.map(t => (t.outcome === 'target' ? 1 : 0));
const yNetR = trades.map(t => (t.netR > 0 ? 1 : 0));
const netR = trades.map(t => Number(t.netR));

// Chronological split: first 60% train, last 40% test. NO shuffling.
const n = trades.length;
const trainN = Math.floor(n * 0.6);
const testN = n - trainN;

// Standardize using TRAIN statistics only (no test leakage).
const k = pillarsUsed.length;
const means = new Array(k).fill(0);
const sds = new Array(k).fill(0);
for (let j = 0; j < k; j++) {
  let s = 0;
  for (let i = 0; i < trainN; i++) s += X[i][j];
  means[j] = s / trainN;
  let ss = 0;
  for (let i = 0; i < trainN; i++) { const d = X[i][j] - means[j]; ss += d * d; }
  sds[j] = Math.sqrt(ss / trainN);
  if (sds[j] < 1e-12) sds[j] = 1; // guard: constant-in-train feature
}
const Z = X.map(row => row.map((x, j) => (x - means[j]) / sds[j]));

// ---------- Logistic regression via plain full-batch gradient descent ----------
function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function fitLogistic(Ztr, ytr, { lr = 0.1, iters = 20000, tol = 1e-10 } = {}) {
  const m = Ztr.length, d = Ztr[0].length;
  let w = new Array(d).fill(0);
  let b = 0;
  let prevLoss = Infinity;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(d).fill(0);
    let gb = 0, loss = 0;
    for (let i = 0; i < m; i++) {
      let z = b;
      const row = Ztr[i];
      for (let j = 0; j < d; j++) z += w[j] * row[j];
      const p = sigmoid(z);
      const err = p - ytr[i];
      for (let j = 0; j < d; j++) gw[j] += err * row[j];
      gb += err;
      const pc = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
      loss -= ytr[i] * Math.log(pc) + (1 - ytr[i]) * Math.log(1 - pc);
    }
    loss /= m;
    for (let j = 0; j < d; j++) w[j] -= (lr / m) * gw[j];
    b -= (lr / m) * gb;
    if (Math.abs(prevLoss - loss) < tol) break;
    prevLoss = loss;
  }
  return { w, b, finalLoss: prevLoss };
}

function predict(Zrows, w, b) {
  return Zrows.map(row => {
    let z = b;
    for (let j = 0; j < row.length; j++) z += w[j] * row[j];
    return sigmoid(z);
  });
}

// ---------- AUC (Mann-Whitney with tie correction via average ranks) ----------
function auc(scores, labels) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[a] - scores[b]);
  const ranks = new Array(scores.length);
  let i = 0;
  while (i < idx.length) {
    let jEnd = i;
    while (jEnd + 1 < idx.length && scores[idx[jEnd + 1]] === scores[idx[i]]) jEnd++;
    const avgRank = (i + jEnd) / 2 + 1; // 1-based average rank
    for (let q = i; q <= jEnd; q++) ranks[idx[q]] = avgRank;
    i = jEnd + 1;
  }
  let nPos = 0, nNeg = 0, sumRanksPos = 0;
  for (let q = 0; q < labels.length; q++) {
    if (labels[q] === 1) { nPos++; sumRanksPos += ranks[q]; }
    else nNeg++;
  }
  if (nPos === 0 || nNeg === 0) return NaN;
  return (sumRanksPos - nPos * (nPos + 1) / 2) / (nPos * nNeg);
}

// ---------- Decile lift on TEST ----------
function decileLift(probs, labels, netRs) {
  const order = probs.map((p, i) => i).sort((a, b) => probs[a] - probs[b]); // ascending
  const m = order.length;
  const deciles = [];
  for (let dIdx = 0; dIdx < 10; dIdx++) {
    const lo = Math.floor(dIdx * m / 10);
    const hi = Math.floor((dIdx + 1) * m / 10);
    const ids = order.slice(lo, hi);
    const cnt = ids.length;
    const wins = ids.reduce((s, i) => s + labels[i], 0);
    const sumR = ids.reduce((s, i) => s + netRs[i], 0);
    const pMin = probs[ids[0]], pMax = probs[ids[ids.length - 1]];
    deciles.push({
      decile: dIdx + 1, // 1 = lowest predicted P(win), 10 = highest
      n: cnt,
      pMin: +pMin.toFixed(4),
      pMax: +pMax.toFixed(4),
      winRate: +(wins / cnt).toFixed(4),
      avgNetR: +(sumR / cnt).toFixed(4),
    });
  }
  return deciles;
}

// ---------- Run: primary target = win (outcome === 'target') ----------
const Ztrain = Z.slice(0, trainN);
const Ztest = Z.slice(trainN);
const yWinTrain = yWin.slice(0, trainN);
const yWinTest = yWin.slice(trainN);
const netRTest = netR.slice(trainN);

const winModel = fitLogistic(Ztrain, yWinTrain);
const winProbsTest = predict(Ztest, winModel.w, winModel.b);
const testAUC = auc(winProbsTest, yWinTest);
const lift = decileLift(winProbsTest, yWinTest, netRTest);

// Coefficients back on the raw pillar-point scale.
const coefficientsPerStandardizedUnit = {};
const coefficientsRaw = {};
let interceptRaw = winModel.b;
pillarsUsed.forEach((p, j) => {
  coefficientsPerStandardizedUnit[p] = winModel.w[j];
  coefficientsRaw[p] = winModel.w[j] / sds[j];
  interceptRaw -= winModel.w[j] * means[j] / sds[j];
});

// ---------- Secondary target: P(netR > 0) — only if it differs from the win flag ----------
let netRModelOut = null;
const differs = yWin.some((v, i) => v !== yNetR[i]);
if (differs) {
  const yTrain2 = yNetR.slice(0, trainN);
  const yTest2 = yNetR.slice(trainN);
  const m2 = fitLogistic(Ztrain, yTrain2);
  const probs2 = predict(Ztest, m2.w, m2.b);
  const auc2 = auc(probs2, yTest2);
  const lift2 = decileLift(probs2, yTest2, netRTest);
  const coefStd2 = {};
  pillarsUsed.forEach((p, j) => { coefStd2[p] = m2.w[j]; });
  netRModelOut = {
    note: 'Secondary model: target is netR > 0 (differs from outcome==target on ' +
      yWin.reduce((s, v, i) => s + (v !== yNetR[i] ? 1 : 0), 0) + ' trades, mostly positive-netR timeouts)',
    testAUC: auc2,
    coefficientsPerStandardizedUnit: coefStd2,
    intercept: m2.b,
    decileLift: lift2,
  };
}

// ---------- Verdict (primary win model, TEST only) ----------
const topDec = lift[9], botDec = lift[0];
const gapPositive = topDec.winRate - botDec.winRate > 0;
let verdict;
if (testAUC >= 0.55 && gapPositive) verdict = 'predictive';
else if (testAUC >= 0.52) verdict = 'weak';
else verdict = 'not-predictive';

// ---------- Output JSON ----------
const out = {
  generatedAt: new Date().toISOString(),
  input: path.basename(INPUT),
  target: "P(win) where win = (outcome === 'target')",
  split: 'chronological by tISO: first 60% train, last 40% test (no shuffling)',
  trainPeriod: { from: trades[0].tISO, to: trades[trainN - 1].tISO },
  testPeriod: { from: trades[trainN].tISO, to: trades[n - 1].tISO },
  pillarsUsed,
  dropped,
  coefficientsRaw,
  coefficientsPerStandardizedUnit,
  intercept: winModel.b,
  interceptRaw,
  means: Object.fromEntries(pillarsUsed.map((p, j) => [p, means[j]])),
  sds: Object.fromEntries(pillarsUsed.map((p, j) => [p, sds[j]])),
  trainN,
  testN,
  trainWinRate: +(yWinTrain.reduce((s, v) => s + v, 0) / trainN).toFixed(4),
  testWinRate: +(yWinTest.reduce((s, v) => s + v, 0) / testN).toFixed(4),
  testAUC,
  decileLift: lift,
  netRPositiveModel: netRModelOut,
  verdict,
  verdictRule: "predictive: testAUC>=0.55 AND top-vs-bottom decile win-rate gap>0; weak: AUC 0.52-0.55; not-predictive: AUC<0.52",
};
writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

// ---------- Console report ----------
const pad = (s, w) => String(s).padStart(w);
console.log(`\n=== OMNIROUTE solidity refit — chronological OOS test ===`);
console.log(`Trades: ${n}  |  train: ${trainN} (${trades[0].tISO} .. ${trades[trainN - 1].tISO})`);
console.log(`               |  test:  ${testN} (${trades[trainN].tISO} .. ${trades[n - 1].tISO})`);
console.log(`Pillars used: ${pillarsUsed.length}  |  dropped as constant: ${dropped.length} (${dropped.map(d => d.pillar).join(', ')})`);
console.log(`Train win rate: ${(out.trainWinRate * 100).toFixed(1)}%  |  Test win rate: ${(out.testWinRate * 100).toFixed(1)}%`);
console.log(`\nTEST AUC (P(win)): ${testAUC.toFixed(4)}`);
console.log(`\nDecile lift table (TEST, decile 1 = lowest fitted P(win)):`);
console.log(` dec |   n  |  P(win) range   | winRate | avgNetR`);
console.log(`-----+------+-----------------+---------+--------`);
for (const d of lift) {
  console.log(` ${pad(d.decile, 3)} | ${pad(d.n, 4)} | ${d.pMin.toFixed(3)} - ${d.pMax.toFixed(3)} | ${pad((d.winRate * 100).toFixed(1) + '%', 7)} | ${pad(d.avgNetR.toFixed(3), 7)}`);
}
console.log(`\nTop decile:    winRate ${(topDec.winRate * 100).toFixed(1)}%, avgNetR ${topDec.avgNetR}`);
console.log(`Bottom decile: winRate ${(botDec.winRate * 100).toFixed(1)}%, avgNetR ${botDec.avgNetR}`);
if (netRModelOut) {
  console.log(`\nSecondary model P(netR>0): test AUC ${netRModelOut.testAUC.toFixed(4)}`);
}
const ranked = pillarsUsed
  .map(p => [p, coefficientsPerStandardizedUnit[p]])
  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
console.log(`\nTop 5 pillars by |standardized coefficient| (P(win) model):`);
for (const [p, c] of ranked.slice(0, 5)) console.log(`  ${p.padEnd(22)} ${c >= 0 ? '+' : ''}${c.toFixed(4)}`);
console.log(`\nVERDICT: ${verdict}`);
console.log(`Written: ${OUTPUT}\n`);
