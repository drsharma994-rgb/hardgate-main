/* HARDGATE — browser bridges for fix pack 13 pure modules. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/* --- reliability --- */
function relPredicted(rec){
  var rr1 = fin(rec && rec.rr1);
  if (rr1 === null || rr1 <= 0){
    var entry = fin(rec && rec.entry), stop = fin(rec && rec.stop), t1 = fin(rec && rec.t1);
    if (entry !== null && stop !== null && t1 !== null && entry !== stop){
      rr1 = Math.abs(t1 - entry) / Math.abs(entry - stop);
    }
  }
  if (rr1 === null || !(rr1 > 0)) return null;
  return 1 / (1 + rr1);
}

function settledRecords(records){
  var out = [];
  for (var i = 0; i < (records || []).length; i++){
    var r = records[i];
    if (r && r.status === 'settled' && isFinite(+r.r)) out.push(r);
  }
  return out;
}

function relBuckets(records){
  var list = settledRecords(records);
  var byTier = {}, byGateCount = {}, byLayer = {};
  function touch(map, key){
    if (!map[key]) map[key] = { n: 0, wins: 0, sumR: 0, sumNetR: 0, nNet: 0, predSum: 0, predN: 0 };
    return map[key];
  }
  function gateBucket(n){
    if (n <= 2) return '1-2';
    if (n <= 4) return '3-4';
    if (n <= 6) return '5-6';
    return '7+';
  }
  for (var i = 0; i < list.length; i++){
    var rec = list[i], win = rec.r > 0 ? 1 : 0, rn = fin(rec.rNet), pred = relPredicted(rec);
    var tier = (rec.tier && String(rec.tier).trim()) ? String(rec.tier).trim().toUpperCase() : 'UNTIERED';
    var tb = touch(byTier, tier);
    tb.n++; tb.sumR += rec.r; if (win) tb.wins++;
    if (rn !== null){ tb.nNet++; tb.sumNetR += rn; }
    if (pred !== null){ tb.predSum += pred; tb.predN++; }
    var gc = gateBucket((rec.layers || []).length);
    var gb = touch(byGateCount, gc);
    gb.n++; gb.sumR += rec.r; if (win) gb.wins++;
    if (rn !== null){ gb.nNet++; gb.sumNetR += rn; }
    if (pred !== null){ gb.predSum += pred; gb.predN++; }
    var layers = rec.layers || [];
    for (var li = 0; li < layers.length; li++){
      var ln = String(layers[li] || '').trim().toUpperCase();
      if (!ln) continue;
      var lb = touch(byLayer, ln);
      lb.n++; lb.sumR += rec.r; if (win) lb.wins++;
      if (rn !== null){ lb.nNet++; lb.sumNetR += rn; }
      if (pred !== null){ lb.predSum += pred; lb.predN++; }
    }
  }
  function finishMap(map){
    var out = {};
    for (var k in map){
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      var b = map[k];
      if (b.n < 8){ out[k] = { enough: false, n: b.n }; continue; }
      out[k] = {
        enough: true, n: b.n, wins: b.wins,
        realized: b.wins / b.n,
        predicted: b.predN ? b.predSum / b.predN : null,
        avgR: b.sumR / b.n,
        avgNetR: b.nNet ? b.sumNetR / b.nNet : null,
      };
    }
    return out;
  }
  return { byTier: finishMap(byTier), byGateCount: finishMap(byGateCount), byLayer: finishMap(byLayer) };
}

function relBrier(records){
  var list = settledRecords(records);
  var pairs = [], wins = 0;
  for (var i = 0; i < list.length; i++){
    var pred = relPredicted(list[i]);
    if (pred === null) continue;
    var outcome = list[i].r > 0 ? 1 : 0;
    if (outcome) wins++;
    pairs.push({ pred: pred, outcome: outcome });
  }
  if (pairs.length < 20) return null;
  var n = pairs.length, baseRate = wins / n, brier = 0, brierBaseline = 0;
  for (var j = 0; j < pairs.length; j++){
    var d = pairs[j].pred - pairs[j].outcome;
    brier += d * d;
    var db = baseRate - pairs[j].outcome;
    brierBaseline += db * db;
  }
  brier /= n; brierBaseline /= n;
  return { brier: brier, n: n, baseRate: baseRate, skill: brierBaseline > 0 ? 1 - brier / brierBaseline : 0 };
}

function relGateLift(records){
  var list = settledRecords(records);
  var layerSet = {};
  for (var i = 0; i < list.length; i++){
    var layers = list[i].layers || [];
    for (var j = 0; j < layers.length; j++){
      var ln = String(layers[j] || '').trim().toUpperCase();
      if (ln) layerSet[ln] = true;
    }
  }
  var out = [];
  for (var layer in layerSet){
    if (!Object.prototype.hasOwnProperty.call(layerSet, layer)) continue;
    var withN = 0, withoutN = 0, withW = 0, withoutW = 0, withSum = 0, withoutSum = 0;
    for (var k = 0; k < list.length; k++){
      var rec = list[k], has = false;
      var ls = rec.layers || [];
      for (var m = 0; m < ls.length; m++){
        if (String(ls[m] || '').trim().toUpperCase() === layer){ has = true; break; }
      }
      var win = rec.r > 0 ? 1 : 0;
      if (has){ withN++; withSum += rec.r; if (win) withW++; }
      else { withoutN++; withoutSum += rec.r; if (win) withoutW++; }
    }
    var avgRWith = withN ? withSum / withN : null;
    var avgRWithout = withoutN ? withoutSum / withoutN : null;
    var liftR = (avgRWith !== null && avgRWithout !== null) ? avgRWith - avgRWithout : null;
    var verdict = 'UNPROVEN';
    if (withN >= 12 && liftR !== null){
      if (liftR >= 0.15) verdict = 'CARRIES';
      else if (liftR <= -0.15) verdict = 'DRAG';
      else verdict = 'NEUTRAL';
    }
    out.push({
      layer: layer, nWith: withN, nWithout: withoutN,
      winWith: withN ? withW / withN : null, winWithout: withoutN ? withoutW / withoutN : null,
      lift: (withN && withoutN) ? (withW / withN - withoutW / withoutN) : null,
      avgRWith: avgRWith, avgRWithout: avgRWithout, liftR: liftR, verdict: verdict,
    });
  }
  out.sort(function(a, b){ return ((b.liftR == null ? -1e9 : b.liftR) - (a.liftR == null ? -1e9 : a.liftR)); });
  return out;
}

function relReliabilityCurve(records, bins){
  bins = bins > 0 ? bins : 5;
  var pairs = [];
  var list = settledRecords(records);
  for (var i = 0; i < list.length; i++){
    var pred = relPredicted(list[i]);
    if (pred !== null) pairs.push({ pred: pred, outcome: list[i].r > 0 ? 1 : 0 });
  }
  if (!pairs.length) return [];
  pairs.sort(function(a, b){ return a.pred - b.pred; });
  var perBin = Math.max(1, Math.ceil(pairs.length / bins));
  var out = [];
  for (var b = 0; b < bins; b++){
    var slice = pairs.slice(b * perBin, (b + 1) * perBin);
    if (!slice.length) continue;
    var sumP = 0, sumO = 0;
    for (var j = 0; j < slice.length; j++){ sumP += slice[j].pred; sumO += slice[j].outcome; }
    out.push({
      binLo: slice[0].pred, binHi: slice[slice.length - 1].pred, nInBin: slice.length,
      meanPredicted: sumP / slice.length, meanRealized: sumO / slice.length,
    });
  }
  return out;
}

function relNoPredictedCount(records){
  var n = 0;
  var list = settledRecords(records);
  for (var i = 0; i < list.length; i++){ if (relPredicted(list[i]) === null) n++; }
  return n;
}

/* --- cost model --- */
var HG_FEE_DELTA = 5, HG_FEE_BINANCE = 4, HG_FEE_COINDCX = 5;
var HG_COST_K = 0.35, HG_COST_CEIL = 250, HG_SLIP_DEG = 5;

function hgCostBps(input){
  input = input || {};
  var spreadBps = fin(input.spreadBps);
  var depthUsd = fin(input.depthUsd);
  var notionalUsd = fin(input.notionalUsd);
  var atrPct = fin(input.atrPct);
  var venue = String(input.venue || 'delta').toLowerCase();
  var feeBps = venue.indexOf('binance') >= 0 ? HG_FEE_BINANCE : (venue.indexOf('coindcx') >= 0 ? HG_FEE_COINDCX : HG_FEE_DELTA);
  var degraded = false, note = 'depth-modelled';
  if (!(notionalUsd > 0)) notionalUsd = 1000;
  var halfSpread = (spreadBps !== null && spreadBps >= 0) ? spreadBps / 2 : null;
  var impactBps;
  if (depthUsd === null || !(depthUsd > 0)){
    degraded = true; note = 'depth unavailable — ATR proxy';
    var atr = (atrPct > 0) ? atrPct : 2;
    impactBps = Math.min(HG_COST_CEIL, HG_COST_K * Math.sqrt(notionalUsd / 50000) * 100 * (atr / 2));
    if (halfSpread === null) halfSpread = Math.max(2, atr * 3);
  } else {
    impactBps = HG_COST_K * Math.sqrt(notionalUsd / Math.max(depthUsd, 1)) * 100;
    if (halfSpread === null) halfSpread = 2;
  }
  var slipBps = Math.min(HG_COST_CEIL, Math.max(halfSpread, impactBps));
  if (degraded) slipBps = Math.max(slipBps, HG_SLIP_DEG);
  return { feeBps: feeBps, slipBps: slipBps, roundTripBps: (feeBps + slipBps) * 2, note: note, degraded: degraded };
}

function hgCostVeto(input){
  input = input || {};
  var roundTripBps = fin(input.roundTripBps);
  var entry = fin(input.entry), stop = fin(input.stop);
  if (roundTripBps === null || entry === null || stop === null || !(entry > 0)){
    return { veto: false, costFrac: null, rDistBps: null, reason: 'cost inputs incomplete' };
  }
  var rDistBps = Math.abs(entry - stop) / entry * 10000;
  if (!(rDistBps > 0)) return { veto: false, costFrac: null, rDistBps: rDistBps, reason: 'zero R distance' };
  var costFrac = roundTripBps / rDistBps;
  var reason = 'cost ' + Math.round(roundTripBps) + ' bps = ' + Math.round(costFrac * 100) + '% of a ' + Math.round(rDistBps) + ' bps R';
  return { veto: costFrac > 0.15, costFrac: costFrac, rDistBps: rDistBps, reason: (costFrac > 0.15 ? 'VETO — ' : '') + reason };
}

var __depthCache = {};
function hgCostDepthCached(sym, fetchFn){
  var key = String(sym || '').toUpperCase();
  var hit = __depthCache[key];
  if (hit && (Date.now() - hit.at) < 60000) return Promise.resolve(hit.val);
  return Promise.resolve(typeof fetchFn === 'function' ? fetchFn(sym) : null).then(function(val){
    __depthCache[key] = { at: Date.now(), val: val };
    return val;
  }, function(){ return null; });
}

function hgPlanCostCheck(plan, ctx){
  ctx = ctx || {};
  if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop)) return { ok: true };
  var depthUsd = ctx.depthUsd;
  var spreadBps = ctx.spreadBps;
  var atrPct = ctx.atrPct;
  if (depthUsd == null && ctx.sym && typeof G.hgCostDepthForSym === 'function'){
    /* sync path when depth already warmed */
    var d = G.hgCostDepthForSym(ctx.sym);
    if (d) { depthUsd = d.depthUsd; spreadBps = d.spreadBps; }
  }
  var cost = hgCostBps({ spreadBps: spreadBps, depthUsd: depthUsd, notionalUsd: ctx.notionalUsd, atrPct: atrPct, venue: ctx.venue });
  var veto = hgCostVeto({ roundTripBps: cost.roundTripBps, entry: +plan.entry, stop: +plan.stop });
  if (veto.veto) return { ok: false, veto: true, reason: veto.reason, cost: cost, costFrac: veto.costFrac };
  return { ok: true, cost: cost, costFrac: veto.costFrac, chip: 'COST ' + Math.round(cost.roundTripBps) + 'bps · ' + Math.round(veto.costFrac * 100) + '% of R' + (cost.degraded ? ' · degraded' : '') };
}

/* --- regime thresholds --- */
var HG_REGIME_BASE = { minRR: 2.0, fundingZCap: 2.5, maxConcurrent: 4, vetoCounterTrend: false };

function hgRegimeAdjust(baseThresholds, regimeScore, lane){
  var base = Object.assign({}, HG_REGIME_BASE, baseThresholds || {});
  if (regimeScore === null || regimeScore === undefined || !isFinite(+regimeScore)){
    return {
      thresholds: { minRR: base.minRR, fundingZCap: base.fundingZCap, maxConcurrent: base.maxConcurrent, vetoCounterTrend: !!base.vetoCounterTrend },
      regimeLabel: 'NEUTRAL', applied: ['regime dark — base thresholds unchanged'], regimeScore: 0,
    };
  }
  var out = { minRR: base.minRR, fundingZCap: base.fundingZCap, maxConcurrent: base.maxConcurrent, vetoCounterTrend: !!base.vetoCounterTrend };
  var applied = [];
  var score = +regimeScore;
  var damp = (String(lane || '').toLowerCase() === 'gold') ? 0.5 : 1;
  var label = score >= 3 ? 'RISK-ON' : (score <= -3 ? 'RISK-OFF' : 'NEUTRAL');
  if (score >= 3){
    out.minRR = 2.0; out.fundingZCap = 2.5; out.maxConcurrent = 4; out.vetoCounterTrend = false;
  } else if (score <= -3){
    out.minRR = 2.0 + 0.6 * damp; out.fundingZCap = 2.5 - 1.0 * damp;
    out.maxConcurrent = Math.max(2, Math.round(4 - 2 * damp)); out.vetoCounterTrend = damp >= 1;
    applied.push('minRR ' + out.minRR.toFixed(1) + ' (RISK-OFF)');
    applied.push('fundingZ cap ' + out.fundingZCap.toFixed(1));
    applied.push('maxConcurrent ' + out.maxConcurrent);
    if (out.vetoCounterTrend) applied.push('counter-trend veto ON');
  } else {
    out.minRR = 2.0 + 0.2 * damp; out.fundingZCap = 2.5 - 0.5 * damp;
    out.maxConcurrent = Math.max(3, Math.round(4 - 1 * damp));
    applied.push('minRR ' + out.minRR.toFixed(1) + ' (NEUTRAL)');
    applied.push('fundingZ cap ' + out.fundingZCap.toFixed(1));
    applied.push('maxConcurrent ' + out.maxConcurrent);
  }
  return { thresholds: out, regimeLabel: label, applied: applied, regimeScore: score };
}

function hgRegimeResolveState(){
  try{
    var st = (typeof G.regimeState === 'function') ? G.regimeState() : null;
    if (!st || !isFinite(+st.score)) return { score: 0, label: 'NEUTRAL', dark: true, raw: st };
    var score = +st.score;
    return { score: score, label: score >= 3 ? 'RISK-ON' : (score <= -3 ? 'RISK-OFF' : 'NEUTRAL'), dark: false, raw: st };
  }catch(e){ return { score: 0, label: 'NEUTRAL', dark: true, raw: null }; }
}

/* --- stand down --- */
var HG_STANDDOWN_DEFAULTS = { maxConsecutiveLosses: 3, maxDailyLossR: -3, maxWeeklyLossR: -6 };
var HG_STANDDOWN_LS = 'hg_standdown_cfg';

function hgStandDownCfgLoad(){
  try{
    var raw = localStorage.getItem(HG_STANDDOWN_LS);
    if (!raw) return Object.assign({}, HG_STANDDOWN_DEFAULTS);
    var o = JSON.parse(raw);
    return Object.assign({}, HG_STANDDOWN_DEFAULTS, o || {});
  }catch(e){ return Object.assign({}, HG_STANDDOWN_DEFAULTS); }
}

function hgStandDownCfgSave(cfg){
  try{ localStorage.setItem(HG_STANDDOWN_LS, JSON.stringify(Object.assign({}, HG_STANDDOWN_DEFAULTS, cfg || {}))); return true; }
  catch(e){ return false; }
}

function hgStandDownState(records, cfg){
  cfg = Object.assign({}, HG_STANDDOWN_DEFAULTS, cfg || {});
  var list = (records || []).filter(function(r){ return r && r.status === 'settled'; })
    .sort(function(a, b){
      var ta = fin(a.closedAt) || fin(a.settledAt) || fin(a.at) || 0;
      var tb = fin(b.closedAt) || fin(b.settledAt) || fin(b.at) || 0;
      return tb - ta;
    });
  function rOf(rec){
    var rn = fin(rec.rNet);
    return rn !== null ? rn : fin(rec.r);
  }
  function dayKey(ms){
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + d.getUTCMonth() + '-' + d.getUTCDate();
  }
  function weekKey(ms){
    var d = new Date(ms);
    var day = d.getUTCDay();
    var diff = (day === 0 ? -6 : 1) - day;
    var mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
    return mon.getUTCFullYear() + '-W' + Math.floor((mon - new Date(Date.UTC(mon.getUTCFullYear(), 0, 1))) / 604800000);
  }
  var consecutiveLosses = 0;
  for (var i = 0; i < list.length; i++){
    var rv = rOf(list[i]);
    if (rv === null) continue;
    if (rv < 0) consecutiveLosses++; else break;
  }
  var now = Date.now(), today = dayKey(now), thisWeek = weekKey(now), dayR = 0, weekR = 0;
  for (var j = 0; j < list.length; j++){
    var rec = list[j], r = rOf(rec);
    if (r === null) continue;
    var tms = fin(rec.closedAt) || fin(rec.settledAt) || fin(rec.at);
    if (tms === null) continue;
    if (dayKey(tms) === today) dayR += r;
    if (weekKey(tms) === thisWeek) weekR += r;
  }
  var reasons = [];
  if (consecutiveLosses >= cfg.maxConsecutiveLosses) reasons.push(consecutiveLosses + ' consecutive losses');
  if (dayR <= cfg.maxDailyLossR) reasons.push(dayR.toFixed(1) + 'R today');
  if (weekR <= cfg.maxWeeklyLossR) reasons.push(weekR.toFixed(1) + 'R this week');
  return {
    tripped: reasons.length > 0, reasons: reasons,
    consecutiveLosses: consecutiveLosses,
    dayR: Math.round(dayR * 100) / 100, weekR: Math.round(weekR * 100) / 100,
    clearsAt: reasons.length ? (function(){ var t = new Date(now); t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(0,0,0,0); return t.getTime(); })() : null,
  };
}

/* --- gold COT --- */
function goldCotParse(rows){
  var out = [];
  for (var i = 0; i < (rows || []).length; i++){
    var r = rows[i];
    if (!r) continue;
    var name = String(r.market_and_exchange_names || r.market_name || '').toUpperCase();
    if (name.indexOf('GOLD') < 0) continue;
    var specL = fin(r.noncomm_positions_long_all), specS = fin(r.noncomm_positions_short_all);
    var oi = fin(r.open_interest_all);
    if (specL === null || specS === null || !(oi > 0)) continue;
    var d = r.report_date_as_yyyy_mm_dd || r.report_date;
    out.push({ date: d ? Date.parse(String(d)) : null, specNet: specL - specS, oi: oi, specNetPctOi: (specL - specS) / oi });
  }
  out.sort(function(a, b){ return (b.date || 0) - (a.date || 0); });
  return out;
}

function goldCotAssess(series){
  series = series || [];
  if (!series.length) return { crowding: 'N/A', note: 'no COT rows' };
  var latest = series[0];
  var hist = series.slice(0, 156).map(function(s){ return s.specNetPctOi; });
  var sorted = hist.slice().sort(function(a, b){ return a - b; });
  var below = 0;
  for (var i = 0; i < sorted.length; i++){ if (sorted[i] <= latest.specNetPctOi) below++; }
  var pct = sorted.length ? below / sorted.length : null;
  var crowding = 'NEUTRAL';
  if (pct !== null && pct >= 0.9) crowding = 'SPEC CROWDED LONG';
  else if (pct !== null && pct <= 0.1) crowding = 'SPEC CROWDED SHORT';
  return {
    specNetPctOi: latest.specNetPctOi, percentile: pct, crowding: crowding,
    wow: series.length >= 2 ? latest.specNetPctOi - series[1].specNetPctOi : null,
    reportDate: latest.date, note: 'CFTC managed money · weekly Tue as-of',
  };
}

G.hgRelBuckets = relBuckets;
G.hgRelBrier = relBrier;
G.hgRelGateLift = relGateLift;
G.hgRelReliabilityCurve = relReliabilityCurve;
G.hgRelNoPredictedCount = relNoPredictedCount;
G.hgCostBps = hgCostBps;
G.hgCostVeto = hgCostVeto;
G.hgCostDepthCached = hgCostDepthCached;
G.hgPlanCostCheck = hgPlanCostCheck;
G.hgRegimeAdjust = hgRegimeAdjust;
G.hgRegimeResolveState = hgRegimeResolveState;
G.hgStandDownState = hgStandDownState;
G.hgStandDownCfgLoad = hgStandDownCfgLoad;
G.hgStandDownCfgSave = hgStandDownCfgSave;
G.hgGoldCotParse = goldCotParse;
G.hgGoldCotAssess = goldCotAssess;

})();
