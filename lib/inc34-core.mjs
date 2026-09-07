/* HARDGATE — Increment 3 adaptive-learning core (pure, Node-testable). */

import { wfExpectancy } from './walkforward.mjs';

export const PD_BASELINES = {
  rrMin: { baseline: 2.0, unit: 'R', label: 'Minimum R:R to T1' },
  timeStopScalpBars: { baseline: 12, unit: 'bars', label: 'Scalp time-stop bars' },
  timeStopSwingBars: { baseline: 60, unit: 'bars', label: 'Swing time-stop bars' },
  macroVetoAbs: { baseline: 3, unit: 'score', label: 'Macro veto |score| threshold' },
  atrStopMult: { baseline: 1.5, unit: 'xATR', label: 'Vol-adaptive stop multiplier' },
};

const PD_STEPS = [-0.2, -0.1, 0, 0.1, 0.2];
const PD_ADOPT_MIN_WEEKS = 2;
const PD_ADOPT_MIN_DELTA = 0.1;
const PD_MAX_DRIFT = 0.4;

export function pdSweepValue(baseline, stepFrac){
  return baseline * (1 + stepFrac);
}

export function pdPickParamStep(records, paramKey, baseline){
  baseline = +baseline;
  if (!(baseline > 0)) return { value: baseline, step: 0, expectancy: null };
  var best = { value: baseline, step: 0, expectancy: -Infinity };
  for (var i = 0; i < PD_STEPS.length; i++){
    var step = PD_STEPS[i];
    var val = pdSweepValue(baseline, step);
    var exp = wfExpectancy(records.map(function(r){ return r.r; })).expectancy;
    if (exp > best.expectancy) best = { value: val, step: step, expectancy: exp };
  }
  if (!isFinite(best.expectancy)) best.expectancy = 0;
  return best;
}

export function pdClampDrift(baseline, proposed){
  baseline = +baseline;
  proposed = +proposed;
  if (!(baseline > 0)) return proposed;
  var lo = baseline * (1 - PD_MAX_DRIFT);
  var hi = baseline * (1 + PD_MAX_DRIFT);
  return Math.max(lo, Math.min(hi, proposed));
}

export function pdRecalibrate(closedTrades, state){
  state = state || {};
  var records = (Array.isArray(closedTrades) ? closedTrades : []).filter(function(r){
    return r && isFinite(+r.r);
  });
  var baselines = state.baselines || PD_BASELINES;
  var current = state.params || {};
  var history = Array.isArray(state.adoptionHistory) ? state.adoptionHistory.slice() : [];
  var proposed = {};
  var provenance = {};
  Object.keys(baselines).forEach(function(key){
    var meta = baselines[key];
    var base = meta && meta.baseline != null ? meta.baseline : meta;
    var cur = current[key] != null ? +current[key] : base;
    var pick = pdPickParamStep(records, key, base);
    var clamped = pdClampDrift(base, pick.value);
    proposed[key] = Math.round(clamped * 1000) / 1000;
    provenance[key] = { baseline: base, sweepBest: pick, adopted: cur, proposed: proposed[key] };
  });
  var weekKey = state.weekKey || new Date().toISOString().slice(0, 10);
  var adopted = {};
  Object.keys(proposed).forEach(function(key){
    var meta = baselines[key];
    var base = meta && meta.baseline != null ? meta.baseline : meta;
    var prop = proposed[key];
    var cur = current[key] != null ? +current[key] : base;
    var delta = Math.abs(prop - base) / base;
    if (delta < PD_ADOPT_MIN_DELTA){ adopted[key] = cur; return; }
    var dir = prop > cur ? 1 : (prop < cur ? -1 : 0);
    var recent = history.filter(function(h){ return h.key === key; }).slice(-PD_ADOPT_MIN_WEEKS);
    var sameDir = recent.length >= PD_ADOPT_MIN_WEEKS - 1 && recent.every(function(h){ return h.dir === dir; });
    if (sameDir && dir !== 0){
      adopted[key] = prop;
      history.push({ key: key, weekKey: weekKey, dir: dir, value: prop });
    } else {
      adopted[key] = cur;
      if (dir !== 0) history.push({ key: key, weekKey: weekKey, dir: dir, value: prop, pending: true });
    }
  });
  return {
    updatedAt: Date.now(),
    weekKey: weekKey,
    tradeCount: records.length,
    params: adopted,
    proposed: proposed,
    provenance: provenance,
    adoptionHistory: history.slice(-200),
    baselines: baselines,
  };
}

export function stAssignTier(stats){
  stats = stats || {};
  var n = stats.n || 0;
  var wr = stats.wr;
  var exp = stats.expectancy;
  var struct = stats.structureRespect;
  if (n < 8) return { tier: 'B', reason: 'insufficient sample (' + n + ')' };
  if (n >= 15 && (wr !== null && wr < 0.45 || (exp !== null && exp < 0))){
    return { tier: 'C', reason: 'hit rate low or negative expectancy' };
  }
  if (n >= 20 && wr !== null && wr >= 0.55 && (struct === null || struct >= 0.5) && (exp === null || exp > 0)){
    return { tier: 'A', reason: 'hit rate ' + (wr * 100).toFixed(0) + '%' };
  }
  return { tier: 'B', reason: 'middle tier' };
}

export function stBuildTiers(records){
  var bySym = {};
  (records || []).forEach(function(r){
    if (!r || !r.sym) return;
    var sym = String(r.sym).toUpperCase();
    if (!bySym[sym]) bySym[sym] = { n: 0, wins: 0, sumR: 0, slHits: 0, tpHits: 0 };
    var b = bySym[sym];
    b.n += 1;
    var rv = +r.r;
    if (isFinite(rv)){ b.sumR += rv; if (rv > 0) b.wins += 1; }
    var out = String(r.outcome || '').toLowerCase();
    if (out.indexOf('sl') >= 0 || out.indexOf('stop') >= 0) b.slHits += 1;
    if (out.indexOf('t1') >= 0 || out.indexOf('tp') >= 0) b.tpHits += 1;
  });
  var tiers = {};
  Object.keys(bySym).forEach(function(sym){
    var b = bySym[sym];
    var wr = b.n ? b.wins / b.n : null;
    var exp = b.n ? b.sumR / b.n : null;
    var struct = (b.slHits + b.tpHits) > 0 ? b.tpHits / (b.slHits + b.tpHits) : null;
    var t = stAssignTier({ n: b.n, wr: wr, expectancy: exp, structureRespect: struct });
    tiers[sym] = { tier: t.tier, reason: t.reason, n: b.n, wr: wr, expectancy: exp };
  });
  return { updatedAt: Date.now(), symbols: tiers };
}

export function stGateForTier(tier, gatesPassed, gatesTotal){
  tier = String(tier || 'B').toUpperCase();
  gatesPassed = +gatesPassed || 0;
  gatesTotal = +gatesTotal || 7;
  if (tier === 'C') return { pass: false, veto: true, note: 'Tier C symbol — veto new entries' };
  if (tier === 'B' && gatesPassed < gatesTotal){
    return { pass: false, veto: true, note: 'Tier B requires +1 confluence (' + gatesPassed + '/' + gatesTotal + ')' };
  }
  return { pass: true, veto: false, note: tier === 'A' ? 'Tier A' : 'Tier B ok' };
}

function logReturns(closes){
  var out = [];
  if (!Array.isArray(closes) || closes.length < 2) return out;
  for (var i = 1; i < closes.length; i++){
    var a = +closes[i - 1], b = +closes[i];
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

export function cmPairCorr(a, b){
  var ra = logReturns(a), rb = logReturns(b);
  var m = Math.min(ra.length, rb.length);
  if (m < 20) return null;
  ra = ra.slice(-m); rb = rb.slice(-m);
  var meanA = 0, meanB = 0, i;
  for (i = 0; i < m; i++){ meanA += ra[i]; meanB += rb[i]; }
  meanA /= m; meanB /= m;
  var cov = 0, varA = 0, varB = 0;
  for (i = 0; i < m; i++){
    var da = ra[i] - meanA, db = rb[i] - meanB;
    cov += da * db; varA += da * da; varB += db * db;
  }
  if (!(varA > 0) || !(varB > 0)) return null;
  return cov / Math.sqrt(varA * varB);
}

export function cmRollingMatrix(seriesBySym){
  seriesBySym = seriesBySym || {};
  var syms = Object.keys(seriesBySym);
  var mat = {};
  for (var i = 0; i < syms.length; i++){
    mat[syms[i]] = {};
    for (var j = 0; j < syms.length; j++){
      if (i === j){ mat[syms[i]][syms[j]] = 1; continue; }
      mat[syms[i]][syms[j]] = cmPairCorr(seriesBySym[syms[i]], seriesBySym[syms[j]]);
    }
  }
  return mat;
}

export function cmClusterIds(syms, matrix, threshold){
  threshold = threshold > 0 ? threshold : 0.7;
  syms = syms || [];
  var clusters = {};
  var id = 0;
  for (var i = 0; i < syms.length; i++){
    var s = syms[i];
    if (clusters[s] !== undefined) continue;
    clusters[s] = id;
    for (var j = i + 1; j < syms.length; j++){
      var t = syms[j];
      var corr = matrix && matrix[s] ? matrix[s][t] : null;
      if (corr !== null && Math.abs(corr) >= threshold) clusters[t] = id;
    }
    id += 1;
  }
  return clusters;
}

export function cmDedupeCandidates(candidates, seriesBySym, opts){
  opts = opts || {};
  var threshold = opts.corrThr > 0 ? opts.corrThr : 0.7;
  var list = Array.isArray(candidates) ? candidates.slice() : [];
  if (list.length < 2) return list;
  var syms = [];
  list.forEach(function(c){ if (c.sym && syms.indexOf(c.sym) < 0) syms.push(c.sym); });
  var mat = cmRollingMatrix(seriesBySym);
  var clusters = cmClusterIds(syms, mat, threshold);
  var best = {};
  list.forEach(function(c){
    var cl = clusters[c.sym];
    var dir = String(c.dir || '').toLowerCase();
    var key = cl + '|' + dir;
    var score = c.score != null ? +c.score : (c.famScore != null ? +c.famScore : (c.rr != null ? +c.rr : 0));
    var liq = c.turnoverUsd || (c.t && c.t.turnoverUsd) || 0;
    if (!best[key] || score > best[key].score || (score === best[key].score && liq > best[key].liq)){
      best[key] = { c: c, score: score, liq: liq };
    }
  });
  return Object.keys(best).map(function(k){ return best[k].c; });
}

export function rfAdjustEntry(dir, entry){
  entry = +entry;
  if (!(entry > 0)) return entry;
  dir = String(dir || '').toLowerCase();
  if (dir === 'long') return entry * 1.0005;
  if (dir === 'short') return entry * 0.9995;
  return entry;
}

export function rfRealisticPnl(position, opts){
  opts = opts || {};
  position = position || {};
  var dir = String(position.dir || '').toLowerCase();
  var entry = +position.entry;
  var mark = +position.mark;
  var stop = +position.stop;
  var notional = +position.notionalUsd;
  var atr = +opts.atr;
  if (!(entry > 0) || !(notional > 0) || !isFinite(mark)) return { idealUsd: 0, realisticUsd: 0, dragUsd: 0 };
  var adjEntry = rfAdjustEntry(dir, entry);
  var idealRet = dir === 'short' ? (entry - mark) / entry : (mark - entry) / entry;
  var realRet = dir === 'short' ? (adjEntry - mark) / adjEntry : (mark - adjEntry) / adjEntry;
  var feeBps = opts.feeBps != null ? +opts.feeBps : 4;
  var fee = notional * (feeBps / 10000) * 2;
  var idealUsd = notional * idealRet;
  var realisticUsd = notional * realRet - fee;
  var stopped = (dir === 'long' && isFinite(stop) && mark <= stop) || (dir === 'short' && isFinite(stop) && mark >= stop);
  if (stopped && isFinite(atr) && atr > 0) realisticUsd -= notional * ((0.25 * atr) / entry);
  return {
    idealUsd: idealUsd,
    realisticUsd: realisticUsd,
    dragUsd: idealUsd - realisticUsd,
    idealR: position.r,
    realisticR: position.r != null && idealUsd !== 0 ? position.r * (realisticUsd / idealUsd) : position.r,
  };
}

export function rfExecutionDragProfile(trades){
  var bySetup = {};
  (trades || []).forEach(function(t){
    var k = String(t.setupKind || t.strategy || 'unknown').toLowerCase();
    if (!bySetup[k]) bySetup[k] = { ideal: [], realistic: [] };
    if (isFinite(t.idealR)) bySetup[k].ideal.push(+t.idealR);
    if (isFinite(t.realisticR)) bySetup[k].realistic.push(+t.realisticR);
  });
  var out = {};
  Object.keys(bySetup).forEach(function(k){
    var b = bySetup[k];
    var idealExp = b.ideal.length ? b.ideal.reduce(function(a, c){ return a + c; }, 0) / b.ideal.length : null;
    var realExp = b.realistic.length ? b.realistic.reduce(function(a, c){ return a + c; }, 0) / b.realistic.length : null;
    out[k] = {
      n: b.ideal.length,
      idealExpectancy: idealExp,
      realisticExpectancy: realExp,
      executionDrag: (idealExp !== null && realExp !== null) ? idealExp - realExp : null,
      suspend: idealExp > 0 && realExp !== null && realExp < 0,
    };
  });
  return out;
}

export function apBucketKey(setup, regime, tier){
  return String(setup || 'unknown').toLowerCase() + '|' + String(regime || 'mixed').toUpperCase() + '|' + String(tier || 'clean').toLowerCase();
}

export function apRecordOutcome(store, bucket, outcome){
  store = store || {};
  if (!store[bucket]) store[bucket] = { fired: 0, wins: 0, losses: 0, precision: null };
  var b = store[bucket];
  b.fired += 1;
  if (outcome > 0) b.wins += 1;
  else b.losses += 1;
  b.precision = b.fired ? b.wins / b.fired : null;
  return b;
}

export function apRouteDecision(precision){
  if (precision === null || !isFinite(precision)) return { route: 'neutral', note: 'no precision history' };
  if (precision < 0.4) return { route: 'block', note: 'precision ' + (precision * 100).toFixed(0) + '% < 40%' };
  if (precision > 0.6) return { route: 'promote', note: 'precision ' + (precision * 100).toFixed(0) + '% > 60%' };
  return { route: 'neutral', note: 'precision ' + (precision * 100).toFixed(0) + '%' };
}

export function rtPushScore(history, score, at){
  history = Array.isArray(history) ? history.slice() : [];
  history.push({ at: at || Date.now(), score: +score });
  return history.slice(-30);
}

export function rtScoreSlope(history, days){
  days = days > 0 ? days : 5;
  var cutoff = Date.now() - days * 86400000;
  var pts = (history || []).filter(function(h){ return h && h.at >= cutoff; });
  if (pts.length < 2) return null;
  return (pts[pts.length - 1].score - pts[0].score) / days;
}

export function rtDetectTransition(history, prevSlope){
  var slope = rtScoreSlope(history, 5);
  if (slope === null) return { active: false, slope: null };
  var crossed = (prevSlope !== null && prevSlope !== undefined && prevSlope * slope < 0);
  var active = crossed || Math.abs(slope) >= 0.5;
  return { active: active, crossed: crossed, slope: slope, tag: active ? 'REGIME TRANSITION' : null, sessionsRemaining: active ? 3 : 0 };
}

export function rtModifiers(active){
  if (!active) return { tightenRr: 0, halveTimeStop: false, requireCrossVenue: false, meanRevBonus: false };
  return { tightenRr: 0.5, halveTimeStop: true, requireCrossVenue: true, meanRevBonus: true, minRr: 2.5,
    note: 'REGIME TRANSITION — tighten R:R ≥2.5, halve time stops, cross-venue required' };
}
