/* HARDGATE — per-fingerprint edge table with shrinkage + Wilson lower bound. */

import { fingerprint, fingerprintCoarse } from './setup-fingerprint.mjs';

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function wilsonLB(wins, n, z = 1.96) {
  if (!n || n <= 0) return 0;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - margin) / denom);
}

function blank() {
  return { n: 0, wins: 0, sumR: 0, sumR2: 0, maeSum: 0, maeN: 0, mfeSum: 0, mfeN: 0 };
}

function acc(a, r) {
  a.n += 1;
  if (r.R > 0) a.wins += 1;
  a.sumR += r.R;
  a.sumR2 += r.R * r.R;
  if (r.maeR !== null) { a.maeSum += r.maeR; a.maeN += 1; }
  if (r.mfeR !== null) { a.mfeSum += r.mfeR; a.mfeN += 1; }
}

function stats(a, prior, priorWeight) {
  const expRaw = a.n ? a.sumR / a.n : 0;
  const w = a.n / (a.n + priorWeight);
  const exp = w * expRaw + (1 - w) * prior;
  const mean = expRaw;
  const varR = a.n > 1 ? Math.max(0, a.sumR2 / a.n - mean * mean) : 0;
  const sd = Math.sqrt(varR);
  const se = a.n ? sd / Math.sqrt(a.n) : 0;
  return {
    n: a.n,
    winRate: a.n ? a.wins / a.n : 0,
    winLB: wilsonLB(a.wins, a.n),
    expR: round(expRaw),
    expShrunk: round(exp),
    expLB: round(exp - 1.64 * se),
    sdR: round(sd),
    avgMaeR: a.maeN ? round(a.maeSum / a.maeN) : null,
    avgMfeR: a.mfeN ? round(a.mfeSum / a.mfeN) : null,
    capture: a.mfeN && a.mfeSum > 0 ? round(a.sumR / a.mfeSum) : null,
  };
}

const round = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

export function buildEdgeTable(rows = [], opts = {}) {
  const priorWeight = num(opts.priorWeight) ?? 12;
  const exact = new Map();
  const coarse = new Map();
  let all = blank();

  for (const raw of Array.isArray(rows) ? rows : []) {
    const R = num(raw?.r ?? raw?.R ?? raw?.realizedR ?? raw?.resultR);
    if (R === null) continue;
    const rec = { R, maeR: num(raw?.maeR), mfeR: num(raw?.mfeR) };
    const k = fingerprint(raw).key;
    const c = fingerprintCoarse(raw);
    if (!exact.has(k)) exact.set(k, blank());
    if (!coarse.has(c)) coarse.set(c, blank());
    acc(exact.get(k), rec);
    acc(coarse.get(c), rec);
    acc(all, rec);
  }

  const globalExp = all.n ? all.sumR / all.n : 0;
  const coarseOut = new Map();
  for (const [k, a] of coarse) coarseOut.set(k, stats(a, globalExp, priorWeight));
  const exactOut = new Map();
  for (const [k, a] of exact) {
    const cls = k.split('|').slice(0, 4).join('|');
    const prior = coarseOut.get(cls)?.expR ?? globalExp;
    exactOut.set(k, stats(a, prior, priorWeight));
  }

  return {
    global: stats(all, globalExp, 0),
    exact: exactOut,
    coarse: coarseOut,
    lookup(cand) {
      const k = fingerprint(cand).key;
      const c = fingerprintCoarse(cand);
      const e = exactOut.get(k);
      if (e && e.n >= 4) return { ...e, source: 'exact', key: k };
      const co = coarseOut.get(c);
      if (co && co.n >= 4) return { ...co, source: 'coarse', key: c };
      return { ...stats(all, globalExp, 0), source: 'global', key: 'global' };
    },
  };
}

export function edgeGate(cand, table, cfg = {}) {
  const minN = num(cfg.minN) ?? 8;
  const blockBelow = num(cfg.blockBelowExpLB) ?? -0.15;
  const boostAbove = num(cfg.boostAboveExpLB) ?? 0.35;
  const maxMult = num(cfg.maxMult) ?? 1.25;
  const minMult = num(cfg.minMult) ?? 0.5;
  if (!table || typeof table.lookup !== 'function') {
    return { ok: true, reason: 'no-table', mult: 1, row: null };
  }
  const row = table.lookup(cand);
  if (row.source === 'global' || row.n < minN) {
    return { ok: true, reason: `explore(${row.source},n=${row.n})`, mult: 1, row };
  }
  if (row.expLB !== null && row.expLB <= blockBelow) {
    return { ok: false, reason: `edge-negative(expLB=${row.expLB},n=${row.n})`, mult: 0, row };
  }
  let mult = 1;
  if (row.expLB >= boostAbove) mult = maxMult;
  else if (row.expLB < 0) mult = minMult;
  else if (row.expLB < 0.15) mult = 0.75;
  return { ok: true, reason: `edge-ok(expLB=${row.expLB},n=${row.n})`, mult, row };
}

export function edgeLeaderboard(table, limit = 10) {
  const rows = [...(table?.exact ?? new Map())]
    .map(([key, s]) => ({ key, ...s }))
    .filter((r) => r.n >= 5)
    .sort((a, b) => (b.expLB ?? -9) - (a.expLB ?? -9));
  return { best: rows.slice(0, limit), worst: rows.slice(-limit).reverse() };
}
