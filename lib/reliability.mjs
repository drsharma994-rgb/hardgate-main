/* HARDGATE — reliability / calibration measurement (pure, no DOM, no network). */

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
  if (n < 20) return null;
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
  return { brier: brier, n: n, baseRate: baseRate, skill: skill };
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
