/* HARDGATE — conditional edge lookup by setup fingerprint (fix pack 15). */

import { blankBucket, accBucket, edgeStats } from './edge-table.mjs';
import { fingerprint, fingerprintCoarse } from './setup-fingerprint.mjs';
import { hgEventsFromRecords, hgEffectiveN } from './sample-uniqueness.mjs';

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function settledWithR(records) {
  const out = [];
  for (const raw of Array.isArray(records) ? records : []) {
    if (!raw || raw.status !== 'settled') continue;
    const R = num(raw.r ?? raw.R ?? raw.realizedR);
    if (R === null) continue;
    out.push(raw);
  }
  return out;
}

function aggregate(list, pred) {
  const a = blankBucket();
  for (const raw of list) {
    if (pred && !pred(raw)) continue;
    accBucket(a, {
      R: num(raw.r ?? raw.R) ?? 0,
      maeR: num(raw.maeR),
      mfeR: num(raw.mfeR),
    });
  }
  return a;
}

function tierFrom(expR, wilsonLB, effN) {
  if (effN >= 8 && expR < -0.15) return 'PROVEN-BAD';
  if (effN >= 8 && wilsonLB > 0) return 'PROVEN-GOOD';
  return 'UNPROVEN';
}

/**
 * hgEdgeFor(cand, records, cfg) -> conditional expectancy for an archetype.
 * Records without fpKey are excluded from lookups (never backfilled).
 */
export function hgEdgeFor(cand = {}, records = [], cfg = {}) {
  const minFull = num(cfg.minFull) ?? 8;
  const minCoarse = num(cfg.minCoarse) ?? 20;
  const priorWeight = num(cfg.priorWeight) ?? 12;

  const settled = settledWithR(records);
  const noFingerprint = settled.filter((r) => !r.fpKey).length;
  const list = settled.filter((r) => r.fpKey);

  const fp = fingerprint(cand);
  const coarseKey = fingerprintCoarse(cand);

  const allAgg = aggregate(list);
  const globalExp = allAgg.n ? allAgg.sumR / allAgg.n : 0;

  const coarseAgg = aggregate(list, (r) => r.fpCoarse === coarseKey);
  const coarseRow = edgeStats(coarseAgg, globalExp, priorWeight);

  const exactAgg = aggregate(list, (r) => r.fpKey === fp.key);
  const exactPrior = coarseAgg.n ? coarseRow.expShrunk ?? coarseRow.expR ?? globalExp : globalExp;
  const exactRow = edgeStats(exactAgg, exactPrior, priorWeight);

  let row;
  let source;
  let bucketRecs;
  if (exactAgg.n >= minFull) {
    row = exactRow;
    source = 'exact';
    bucketRecs = list.filter((r) => r.fpKey === fp.key);
  } else if (coarseAgg.n >= minCoarse) {
    row = coarseRow;
    source = 'coarse';
    bucketRecs = list.filter((r) => r.fpCoarse === coarseKey);
  } else {
    row = edgeStats(allAgg, globalExp, 0);
    source = 'prior';
    bucketRecs = list;
  }

  const effN = hgEffectiveN(hgEventsFromRecords(bucketRecs));
  const expR = row.expShrunk ?? row.expR ?? globalExp;
  const wilsonLB = row.expLB ?? 0;
  const tier = tierFrom(expR, wilsonLB, effN);

  let note = '';
  if (source === 'prior') note = 'prior — insufficient bucket sample (exact/coarse below minFull/minCoarse)';
  if (noFingerprint > 0) note = (note ? note + ' · ' : '') + noFingerprint + ' settled without fingerprint (excluded)';

  return {
    n: row.n,
    effN: Math.round(effN * 1000) / 1000,
    expR,
    wilsonLB,
    maeR: row.avgMaeR,
    mfeR: row.avgMfeR,
    tier,
    source,
    noFingerprint,
    note,
  };
}

export function hgEdgeArchetypeLine(edge) {
  if (!edge || !edge.n) return '';
  const lb = Number.isFinite(edge.wilsonLB) ? ((edge.wilsonLB >= 0 ? '+' : '') + edge.wilsonLB.toFixed(2) + 'R') : '—';
  const exp = Number.isFinite(edge.expR) ? ((edge.expR >= 0 ? '+' : '') + edge.expR.toFixed(2) + 'R') : '—';
  const mae = Number.isFinite(edge.maeR) ? ('MAE p75 ' + edge.maeR.toFixed(1) + 'R') : '';
  return 'this archetype: ' + edge.n + '/' + (edge.effN ? Math.round(edge.effN) : edge.n)
    + ' · exp ' + exp + ' · LB ' + lb + (mae ? ' · ' + mae : '');
}
