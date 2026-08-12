/* HARDGATE — reliability / calibration measurement (pure, no DOM, no network). */

import { hgEventsFromRecords, hgEffectiveN } from './sample-uniqueness.mjs';

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function settledRecords(records){
  var out = [];
  var arr = Array.isArray(records) ? records : [];
  for (var i = 0; i < arr.length; i++){
    var r = arr[i];
    if (!r || r.status !== 'settled') continue;
    if (typeof r.r !== 'number' || !isFinite(r.r)) continue;
    out.push(r);
  }
  return out;
}

export function relPredicted(rec){
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

function bucketFinish(n, wins, sumR, sumNetR, nNet){
  if (n < 8) return { enough: false, n: n };
  var realized = n ? wins / n : null;
  return {
    enough: true, n: n, wins: wins,
    realized: realized,
    predicted: null,
    avgR: n ? sumR / n : null,
    avgNetR: nNet ? sumNetR / nNet : null,
  };
}

function gateCountBucket(n){
  if (n <= 2) return '1-2';
  if (n <= 4) return '3-4';
  if (n <= 6) return '5-6';
  return '7+';
}

export function relBuckets(records, opts){
  opts = opts || {};
  var list = settledRecords(records);
  var byTier = {}, byGateCount = {}, byLayer = {};
  var predSum = { tier: {}, gateCount: {}, layer: {} };

  function touch(map, key){
    if (!map[key]) map[key] = { n: 0, wins: 0, sumR: 0, sumNetR: 0, nNet: 0, predSum: 0, predN: 0 };
    return map[key];
  }

  for (var i = 0; i < list.length; i++){
    var rec = list[i];
    var win = rec.r > 0 ? 1 : 0;
    var rn = fin(rec.rNet);
    var pred = relPredicted(rec);

    var tier = (typeof rec.tier === 'string' && rec.tier.trim())
      ? rec.tier.trim().toUpperCase() : 'UNTIERED';
    var tb = touch(byTier, tier);
    tb.n++; tb.sumR += rec.r; if (win) tb.wins++;
    if (rn !== null){ tb.nNet++; tb.sumNetR += rn; }
    if (pred !== null){ tb.predSum += pred; tb.predN++; }

    var gc = gateCountBucket((Array.isArray(rec.layers) ? rec.layers.length : 0));
    var gb = touch(byGateCount, gc);
    gb.n++; gb.sumR += rec.r; if (win) gb.wins++;
    if (rn !== null){ gb.nNet++; gb.sumNetR += rn; }
    if (pred !== null){ gb.predSum += pred; gb.predN++; }

    var layers = Array.isArray(rec.layers) ? rec.layers : [];
    for (var li = 0; li < layers.length; li++){
      var ln = String(layers[li] == null ? '' : layers[li]).trim().toUpperCase();
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
      var row = bucketFinish(b.n, b.wins, b.sumR, b.sumNetR, b.nNet);
      if (row.enough && b.predN > 0) row.predicted = b.predSum / b.predN;
      out[k] = row;
    }
    return out;
  }

  return {
    byTier: finishMap(byTier),
    byGateCount: finishMap(byGateCount),
    byLayer: finishMap(byLayer),
  };
}

export function relBrier(records){
  var list = settledRecords(records);
  var pairs = [];
  var wins = 0;
  for (var i = 0; i < list.length; i++){
    var pred = relPredicted(list[i]);
    if (pred === null) continue;
    var outcome = list[i].r > 0 ? 1 : 0;
    if (outcome) wins++;
    pairs.push({ pred: pred, outcome: outcome });
  }
  var n = pairs.length;
  var effN = hgEffectiveN(hgEventsFromRecords(list));
  if (n < 20 || effN < 12) return null;
  var baseRate = wins / n;
  var brier = 0, brierBaseline = 0;
  for (var j = 0; j < pairs.length; j++){
    var d = pairs[j].pred - pairs[j].outcome;
    brier += d * d;
    var db = baseRate - pairs[j].outcome;
    brierBaseline += db * db;
  }
  brier /= n;
  brierBaseline /= n;
  var skill = brierBaseline > 0 ? 1 - brier / brierBaseline : 0;
  return { brier: brier, n: n, effectiveN: effN, baseRate: baseRate, skill: skill };
}

export function relGateLift(records){
  var list = settledRecords(records);
  var layerSet = {};
  for (var i = 0; i < list.length; i++){
    var layers = Array.isArray(list[i].layers) ? list[i].layers : [];
    for (var j = 0; j < layers.length; j++){
      var ln = String(layers[j] == null ? '' : layers[j]).trim().toUpperCase();
      if (ln) layerSet[ln] = true;
    }
  }
  var out = [];
  for (var layer in layerSet){
    if (!Object.prototype.hasOwnProperty.call(layerSet, layer)) continue;
    var withN = 0, withoutN = 0, withW = 0, withoutW = 0, withSum = 0, withoutSum = 0;
    for (var k = 0; k < list.length; k++){
      var rec = list[k];
      var has = false;
      var ls = Array.isArray(rec.layers) ? rec.layers : [];
      for (var m = 0; m < ls.length; m++){
        if (String(ls[m] || '').trim().toUpperCase() === layer){ has = true; break; }
      }
      var win = rec.r > 0 ? 1 : 0;
      if (has){
        withN++; withSum += rec.r; if (win) withW++;
      } else {
        withoutN++; withoutSum += rec.r; if (win) withoutW++;
      }
    }
    var winWith = withN ? withW / withN : null;
    var winWithout = withoutN ? withoutW / withoutN : null;
    var avgRWith = withN ? withSum / withN : null;
    var avgRWithout = withoutN ? withoutSum / withoutN : null;
    var lift = (winWith !== null && winWithout !== null) ? winWith - winWithout : null;
    var liftR = (avgRWith !== null && avgRWithout !== null) ? avgRWith - avgRWithout : null;
    var verdict = 'UNPROVEN';
    if (withN >= 12 && liftR !== null){
      if (liftR >= 0.15) verdict = 'CARRIES';
      else if (liftR <= -0.15) verdict = 'DRAG';
      else verdict = 'NEUTRAL';
    }
    out.push({
      layer: layer, nWith: withN, nWithout: withoutN,
      winWith: winWith, winWithout: winWithout,
      lift: lift, avgRWith: avgRWith, avgRWithout: avgRWithout,
      liftR: liftR, verdict: verdict,
    });
  }
  out.sort(function(a, b){
    var ar = (a.liftR === null) ? -Infinity : a.liftR;
    var br = (b.liftR === null) ? -Infinity : b.liftR;
    return br - ar;
  });
  return out;
}

export function relReliabilityCurve(records, bins){
  bins = (bins > 0) ? bins : 5;
  var list = settledRecords(records);
  var pairs = [];
  for (var i = 0; i < list.length; i++){
    var pred = relPredicted(list[i]);
    if (pred === null) continue;
    pairs.push({ pred: pred, outcome: list[i].r > 0 ? 1 : 0 });
  }
  if (!pairs.length) return [];
  pairs.sort(function(a, b){ return a.pred - b.pred; });
  var perBin = Math.max(1, Math.ceil(pairs.length / bins));
  var out = [];
  for (var b = 0; b < bins; b++){
    var slice = pairs.slice(b * perBin, (b + 1) * perBin);
    if (!slice.length) continue;
    var nInBin = slice.length, sumP = 0, sumO = 0;
    for (var j = 0; j < slice.length; j++){ sumP += slice[j].pred; sumO += slice[j].outcome; }
    out.push({
      binLo: slice[0].pred,
      binHi: slice[slice.length - 1].pred,
      nInBin: nInBin,
      meanPredicted: sumP / nInBin,
      meanRealized: sumO / nInBin,
    });
  }
  return out;
}

export function relNoPredictedCount(records){
  var list = settledRecords(records);
  var n = 0;
  for (var i = 0; i < list.length; i++){
    if (relPredicted(list[i]) === null) n++;
  }
  return n;
}

function rankTransform(xs){
  var indexed = [];
  for (var i = 0; i < xs.length; i++){
    if (fin(xs[i]) === null) return null;
    indexed.push({ v: xs[i], i: i });
  }
  indexed.sort(function(a, b){ return a.v - b.v; });
  var ranks = new Array(xs.length);
  var j = 0;
  while (j < indexed.length){
    var k = j;
    while (k + 1 < indexed.length && indexed[k + 1].v === indexed[j].v) k++;
    var avg = (j + k + 2) / 2;
    for (var m = j; m <= k; m++) ranks[indexed[m].i] = avg;
    j = k + 1;
  }
  return ranks;
}

function pearson(xs, ys){
  var n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  var mx = 0, my = 0;
  for (var i = 0; i < n; i++){ mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  var num = 0, dx = 0, dy = 0;
  for (var j = 0; j < n; j++){
    var a = xs[j] - mx, b = ys[j] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  var den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : null;
}

/** Spearman rho with average ranks for ties. Returns null below n=12. */
export function relSpearman(xs, ys){
  var ax = Array.isArray(xs) ? xs : [];
  var ay = Array.isArray(ys) ? ys : [];
  var n = Math.min(ax.length, ay.length);
  if (n < 12) return null;
  var rx = rankTransform(ax.slice(0, n));
  var ry = rankTransform(ay.slice(0, n));
  if (!rx || !ry) return null;
  var rho = pearson(rx, ry);
  if (rho === null) return null;
  return { rho: rho, n: n };
}

/** Gate strength vs realized R information coefficient. */
export function relGateIC(records){
  var list = settledRecords(records);
  var layerSet = {};
  var noStrength = 0;
  for (var i = 0; i < list.length; i++){
    var rec = list[i];
    var layers = Array.isArray(rec.layers) ? rec.layers : [];
    var vals = (rec.layerVals && typeof rec.layerVals === 'object') ? rec.layerVals : null;
    if (!vals){
      if (layers.length) noStrength += layers.length;
      continue;
    }
    for (var j = 0; j < layers.length; j++){
      var ln = String(layers[j] == null ? '' : layers[j]).trim().toUpperCase();
      if (!ln) continue;
      layerSet[ln] = true;
      var key = ln;
      var alt = String(layers[j] || '').trim();
      if (fin(vals[key]) === null && fin(vals[alt]) !== null) key = alt;
      if (fin(vals[key]) === null) noStrength++;
    }
  }
  var out = [];
  for (var layer in layerSet){
    if (!Object.prototype.hasOwnProperty.call(layerSet, layer)) continue;
    var xs = [], ys = [];
    for (var k = 0; k < list.length; k++){
      var r = list[k];
      var ls = Array.isArray(r.layers) ? r.layers : [];
      var has = false;
      for (var m = 0; m < ls.length; m++){
        if (String(ls[m] || '').trim().toUpperCase() === layer){ has = true; break; }
      }
      if (!has) continue;
      var lv = null;
      if (r.layerVals && typeof r.layerVals === 'object'){
        lv = fin(r.layerVals[layer]);
        if (lv === null){
          for (var mk in r.layerVals){
            if (String(mk).trim().toUpperCase() === layer){ lv = fin(r.layerVals[mk]); break; }
          }
        }
      }
      if (lv === null){
        lv = 1;
      }
      xs.push(lv);
      ys.push(r.r);
    }
    var sp = relSpearman(xs, ys);
    if (!sp) continue;
    var ic = sp.rho;
    var n = sp.n;
    var denom = 1 - ic * ic;
    var tStat = (n > 2 && denom > 1e-9) ? ic * Math.sqrt(n - 2) / Math.sqrt(denom) : null;
    var verdict = (tStat !== null && Math.abs(tStat) >= 2 && n >= 20) ? 'PREDICTIVE' : 'NOISE';
    out.push({ layer: layer, ic: ic, n: n, tStat: tStat, verdict: verdict });
  }
  out.sort(function(a, b){ return Math.abs(b.ic) - Math.abs(a.ic); });
  out.noStrength = noStrength;
  return out;
}
