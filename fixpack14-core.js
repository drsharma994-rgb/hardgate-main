/* HARDGATE — browser bridges for fix pack 14 pure modules. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/* --- sample uniqueness --- */
function hgConcurrency(events){
  var arr = Array.isArray(events) ? events : [];
  var points = {};
  for (var i = 0; i < arr.length; i++){
    var e = arr[i];
    if (!e) continue;
    var a = fin(e.tStart), b = fin(e.tEnd);
    if (a === null || b === null) continue;
    if (b < a){ var tmp = a; a = b; b = tmp; }
    points[a] = (points[a] || 0) + 1;
    points[b + 1] = (points[b + 1] || 0) - 1;
  }
  var keys = Object.keys(points).map(Number).sort(function(x, y){ return x - y; });
  var out = {}, cur = 0;
  for (var k = 0; k < keys.length; k++){
    cur += points[keys[k]];
    if (cur > 0) out[keys[k]] = cur;
  }
  return out;
}

function uniqAt(concMap, tStart, tEnd){
  var keys = Object.keys(concMap).map(Number).sort(function(x, y){ return x - y; });
  var sum = 0, n = 0;
  for (var i = 0; i < keys.length; i++){
    var t = keys[i];
    if (t < tStart) continue;
    if (t > tEnd) break;
    var c = concMap[t];
    if (c > 0){ sum += 1 / c; n++; }
  }
  if (!n){ var c0 = concMap[tStart]; return (c0 > 0) ? 1 / c0 : 1; }
  return sum / n;
}

function hgAvgUniqueness(events){
  var arr = Array.isArray(events) ? events : [];
  var conc = hgConcurrency(arr);
  var out = [];
  for (var i = 0; i < arr.length; i++){
    var e = arr[i];
    if (!e) continue;
    var a = fin(e.tStart), b = fin(e.tEnd);
    if (a === null || b === null) continue;
    if (b < a){ var tmp = a; a = b; b = tmp; }
    out.push({ index: i, uniqueness: uniqAt(conc, a, b) });
  }
  return out;
}

function hgEffectiveN(events){
  var u = hgAvgUniqueness(events);
  var sum = 0;
  for (var i = 0; i < u.length; i++) sum += u[i].uniqueness;
  return sum;
}

function hgEventsFromRecords(records){
  var out = [];
  for (var i = 0; i < (records || []).length; i++){
    var r = records[i];
    if (!r || r.status !== 'settled') continue;
    var tStart = fin(r.at);
    if (tStart === null) continue;
    var tEnd = fin(r.closedAt);
    if (tEnd !== null && tEnd < 1e12) tEnd *= 1000;
    if (tEnd === null) tEnd = fin(r.settledAt);
    if (tEnd === null){
      var bars = fin(r.bars);
      tEnd = tStart + ((bars !== null && bars > 0) ? bars : 24) * 3600000;
    }
    if (tEnd < tStart) tEnd = tStart + 3600000;
    out.push({ tStart: tStart, tEnd: tEnd, index: i, sym: r.sym });
  }
  return out;
}

function hgRecordEffectiveN(records){
  var events = hgEventsFromRecords(records);
  return { raw: events.length, effectiveN: hgEffectiveN(events), events: events };
}

/* --- bet size --- */
function cdfNorm(z){
  if (!isFinite(z)) return null;
  var t = 1 / (1 + 0.2316419 * Math.abs(z));
  var d = 0.3989423 * Math.exp(-z * z / 2);
  var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - p : p;
}

function hgBetSize(input){
  input = input || {};
  var prob = fin(input.prob);
  var floor = fin(input.floor);
  if (floor === null) floor = (typeof G.HG_META_FLOOR === 'number') ? G.HG_META_FLOOR : 0.52;
  var maxR = fin(input.maxR);
  if (maxR === null || maxR <= 0) maxR = 1.0;
  maxR = Math.min(maxR, 1.0);
  if (prob === null || prob <= 0 || prob >= 1) return { sizeR: 0, z: null, capped: false, reason: 'probability missing' };
  if (prob < floor) return { sizeR: 0, z: null, capped: false, reason: 'below meta floor ' + floor.toFixed(2) };
  var z = (prob - 0.5) / Math.sqrt(prob * (1 - prob));
  var raw = 2 * cdfNorm(z) - 1;
  if (!isFinite(raw) || raw < 0) raw = 0;
  var sizeR = Math.min(maxR, raw * maxR);
  return { sizeR: Math.round(sizeR * 1000) / 1000, z: Math.round(z * 1000) / 1000, capped: raw > maxR,
    reason: 'suggested from meta p=' + prob.toFixed(2) };
}

/* --- vol forecast --- */
function logReturns(closes){
  var out = [];
  for (var i = 1; i < (closes || []).length; i++){
    var a = fin(closes[i - 1]), b = fin(closes[i]);
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

function hgEwmaVol(returns, lambda){
  lambda = (lambda > 0 && lambda < 1) ? lambda : 0.94;
  var rs = (returns || []).filter(function(r){ return isFinite(r); });
  if (rs.length < 30) return null;
  var seedN = Math.min(20, rs.length), v = 0;
  for (var i = 0; i < seedN; i++) v += rs[i] * rs[i];
  v /= seedN;
  for (var j = seedN; j < rs.length; j++) v = lambda * v + (1 - lambda) * rs[j - 1] * rs[j - 1];
  return { sigma: Math.sqrt(v), n: rs.length, lambda: lambda };
}

function hgGarchLite(returns, cfg){
  cfg = cfg || {};
  var rs = (returns || []).filter(function(r){ return isFinite(r); });
  if (rs.length < 30) return null;
  var ew = hgEwmaVol(rs, cfg.lambda || 0.94);
  if (!ew) return null;
  var lr = 0;
  for (var i = 0; i < rs.length; i++) lr += rs[i] * rs[i];
  lr /= rs.length;
  var best = null, alphas = [0.05, 0.1, 0.15], betas = [0.82, 0.88, 0.92];
  for (var ai = 0; ai < alphas.length; ai++){
    for (var bi = 0; bi < betas.length; bi++){
      var alpha = alphas[ai], beta = betas[bi];
      if (alpha + beta >= 0.999) continue;
      var omega = lr * (1 - alpha - beta);
      if (!(omega > 0)) continue;
      var varT = ew.sigma * ew.sigma;
      for (var k = 1; k < rs.length; k++) varT = omega + alpha * rs[k - 1] * rs[k - 1] + beta * varT;
      if (!best || varT < best.varT) best = { alpha: alpha, beta: beta, omega: omega, varT: varT };
    }
  }
  if (!best) return { sigma: ew.sigma, converged: false, note: 'grid failed' };
  var pers = best.alpha + best.beta;
  return { sigma: Math.sqrt(best.varT), omega: best.omega, alpha: best.alpha, beta: best.beta,
    persistence: pers, converged: pers < 0.999, note: pers < 0.999 ? 'GARCH grid' : 'unstable' };
}

function hgVolFromCloses(closes, cfg){
  var rs = logReturns(closes);
  var g = hgGarchLite(rs, cfg);
  var ew = hgEwmaVol(rs, cfg && cfg.lambda);
  if (!ew) return null;
  var lr = 0;
  for (var i = 0; i < rs.length; i++) lr += rs[i] * rs[i];
  lr = Math.sqrt(lr / rs.length);
  return { ewma: ew, garch: g, sigmaNow: ew.sigma, sigmaForecast: (g && g.converged) ? g.sigma : ew.sigma,
    sigmaLongRun: lr, source: (g && g.converged) ? 'garch' : 'ewma' };
}

function hgVolRegime(input){
  input = input || {};
  var sigmaNow = fin(input.sigmaNow), sigmaForecast = fin(input.sigmaForecast);
  var ratioThresh = fin(input.ratioThresh) || 1.15;
  if (!(sigmaNow > 0) || sigmaForecast === null) return { regime: 'VOL NORMAL', ratio: null, note: 'missing vol' };
  var ratio = sigmaForecast / sigmaNow;
  var regime = ratio >= ratioThresh ? 'VOL EXPANDING' : (ratio <= 1 / ratioThresh ? 'VOL CONTRACTING' : 'VOL NORMAL');
  return { regime: regime, ratio: ratio, note: regime + ' ' + ratio.toFixed(2) + 'x' };
}

function hgStopVolChip(entry, stop, volPack){
  if (!volPack || !isFinite(+entry) || !isFinite(+stop)) return null;
  var sigma = fin(volPack.sigmaForecast) || fin(volPack.sigmaNow);
  if (!(sigma > 0) || !(entry > 0)) return null;
  var sigmas = Math.abs(entry - stop) / entry / sigma;
  var reg = hgVolRegime({ sigmaNow: volPack.sigmaNow, sigmaForecast: volPack.sigmaForecast, sigmaLongRun: volPack.sigmaLongRun });
  return { sigmas: sigmas, tight: sigmas < 1, chip: (sigmas < 1 ? 'STOP TIGHT — ' : 'STOP OK — ') + sigmas.toFixed(1)
    + ' sigma forecast (' + (reg.regime || 'VOL').toLowerCase().replace('vol ', '') + ' ' + (reg.ratio || 1).toFixed(1) + 'x)' };
}

/* --- reliability IC (extends fixpack13) --- */
function rankTransform(xs){
  var indexed = [];
  for (var i = 0; i < xs.length; i++){
    if (fin(xs[i]) === null) return null;
    indexed.push({ v: xs[i], i: i });
  }
  indexed.sort(function(a, b){ return a.v - b.v; });
  var ranks = new Array(xs.length), j = 0;
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
  var mx = 0, my = 0, i;
  for (i = 0; i < n; i++){ mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  var num = 0, dx = 0, dy = 0;
  for (i = 0; i < n; i++){ var a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  var den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : null;
}

function relSpearman(xs, ys){
  var n = Math.min((xs || []).length, (ys || []).length);
  if (n < 12) return null;
  var rx = rankTransform(xs.slice(0, n)), ry = rankTransform(ys.slice(0, n));
  if (!rx || !ry) return null;
  var rho = pearson(rx, ry);
  return rho === null ? null : { rho: rho, n: n };
}

function settledRecords(records){
  var out = [];
  for (var i = 0; i < (records || []).length; i++){
    var r = records[i];
    if (r && r.status === 'settled' && isFinite(+r.r)) out.push(r);
  }
  return out;
}

function relGateIC(records){
  var list = settledRecords(records);
  var layerSet = {}, noStrength = 0;
  for (var i = 0; i < list.length; i++){
    var rec = list[i], layers = rec.layers || [], vals = rec.layerVals;
    if (!vals){ noStrength += layers.length; continue; }
    for (var j = 0; j < layers.length; j++){
      var ln = String(layers[j] || '').trim().toUpperCase();
      if (!ln) continue;
      layerSet[ln] = true;
      if (fin(vals[ln]) === null && fin(vals[layers[j]]) === null) noStrength++;
    }
  }
  var out = [];
  for (var layer in layerSet){
    if (!Object.prototype.hasOwnProperty.call(layerSet, layer)) continue;
    var xs = [], ys = [];
    for (var k = 0; k < list.length; k++){
      var r = list[k], ls = r.layers || [], has = false;
      for (var m = 0; m < ls.length; m++){
        if (String(ls[m] || '').trim().toUpperCase() === layer){ has = true; break; }
      }
      if (!has) continue;
      var lv = 1;
      if (r.layerVals){
        lv = fin(r.layerVals[layer]);
        if (lv === null){
          for (var mk in r.layerVals){
            if (String(mk).trim().toUpperCase() === layer){ lv = fin(r.layerVals[mk]); break; }
          }
        }
        if (lv === null) lv = 1;
      }
      xs.push(lv); ys.push(r.r);
    }
    var sp = relSpearman(xs, ys);
    if (!sp) continue;
    var ic = sp.rho, n = sp.n, denom = 1 - ic * ic;
    var tStat = (n > 2 && denom > 1e-9) ? ic * Math.sqrt(n - 2) / Math.sqrt(denom) : null;
    out.push({ layer: layer, ic: ic, n: n, tStat: tStat,
      verdict: (tStat !== null && Math.abs(tStat) >= 2 && n >= 20) ? 'PREDICTIVE' : 'NOISE' });
  }
  out.sort(function(a, b){ return Math.abs(b.ic) - Math.abs(a.ic); });
  out.noStrength = noStrength;
  return out;
}

/* --- regime router --- */
function hgHurstRS(closes, minWindow){
  minWindow = minWindow >= 4 ? minWindow : 8;
  var arr = (closes || []).filter(function(x){ return isFinite(x); });
  if (arr.length < 128) return null;
  var xs = [], ys = [];
  for (var w = minWindow; w <= Math.floor(arr.length / 4); w *= 2){
    var chunks = Math.floor(arr.length / w), rsSum = 0, rsN = 0;
    for (var c = 0; c < chunks; c++){
      var seg = arr.slice(c * w, (c + 1) * w), m = 0;
      for (var i = 0; i < seg.length; i++) m += seg[i];
      m /= seg.length;
      var cum = 0, minC = 0, maxC = 0;
      for (i = 0; i < seg.length; i++){ cum += seg[i] - m; if (cum < minC) minC = cum; if (cum > maxC) maxC = cum; }
      var r = maxC - minC, v = 0;
      for (i = 0; i < seg.length; i++) v += (seg[i] - m) * (seg[i] - m);
      var s = Math.sqrt(v / seg.length);
      if (s > 0 && r > 0){ rsSum += r / s; rsN++; }
    }
    if (rsN > 0){ xs.push(Math.log(w)); ys.push(Math.log(rsSum / rsN)); }
  }
  if (xs.length < 3) return null;
  var fit = pearson(xs, ys);
  var mx = 0, my = 0;
  for (var j = 0; j < xs.length; j++){ mx += xs[j]; my += ys[j]; }
  mx /= xs.length; my /= ys.length;
  var num = 0, den = 0, ssTot = 0, ssRes = 0;
  for (j = 0; j < xs.length; j++){
    num += (xs[j] - mx) * (ys[j] - my); den += (xs[j] - mx) * (xs[j] - mx);
    ssTot += (ys[j] - my) * (ys[j] - my);
  }
  var slope = den > 0 ? num / den : null;
  if (slope === null) return null;
  for (j = 0; j < xs.length; j++){
    var pred = my - slope * mx + slope * xs[j];
    ssRes += (ys[j] - pred) * (ys[j] - pred);
  }
  var r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
  return { hurst: slope, n: arr.length, r2: r2, note: 'H=' + slope.toFixed(2) };
}

function hgFamilyRouter(input){
  input = input || {};
  var hurst = input.hurst, evidence = [], confidence = 0.35, favour = 'NEITHER';
  if (hurst && isFinite(hurst.hurst)){
    if (hurst.hurst > 0.55 && (!hurst.r2 || hurst.r2 >= 0.9)){ favour = 'TREND'; confidence = 0.65; }
    else if (hurst.hurst < 0.45 && (!hurst.r2 || hurst.r2 >= 0.9)){ favour = 'MEANREV'; confidence = 0.65; }
    evidence.push('H=' + hurst.hurst.toFixed(2));
  } else evidence.push('Hurst unavailable');
  if (favour === 'NEITHER') evidence.unshift('no family edge — H≈0.5 (random walk)');
  return { favour: favour, confidence: confidence, evidence: evidence };
}

/* --- gold coint --- */
function hgCoint(seriesA, seriesB){
  /* Cointegration is a statement about CONTEMPORANEOUS observations, and
     these are bare number arrays with no timestamps, so the only alignment
     available is position.

     Each series used to be filtered for finite values INDEPENDENTLY and then
     truncated to a common length. If one feed had three gaps and the other
     had none, that silently paired every observation three bars apart for the
     whole series — and the beta, the spread, the half-life and the z-score
     were all computed on mismatched dates. A drifting offset is exactly the
     kind of error that manufactures a relationship.

     Dropping a bar from one series is only safe if the same bar is dropped
     from the other, so gaps are removed PAIRWISE. Where a caller hands in two
     series of different lengths, position cannot be trusted at all and the
     result is declined rather than guessed. */
  var rawA = seriesA || [], rawB = seriesB || [];
  if (rawA.length !== rawB.length){
    return { cointegrated: false, n: 0, note: 'series lengths differ ('
      + rawA.length + ' vs ' + rawB.length + ') — cannot align without timestamps' };
  }
  /* +null and +'' are both 0, so coercing before the finite test would let a
     missing price through AS ZERO — which in a regression is far worse than
     dropping the bar. My first version of this loop did exactly that, and the
     test below caught it. */
  function cnum(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }
  var a = [], b = [];
  for (var k = 0; k < rawA.length; k++){
    var av = cnum(rawA[k]), bv = cnum(rawB[k]);
    if (!isFinite(av) || !isFinite(bv)) continue;   /* drop the PAIR, never one side */
    a.push(av); b.push(bv);
  }
  var n = a.length;
  if (n < 120) return null;
  var mx = 0, my = 0, i;
  for (i = 0; i < n; i++){ mx += b[i]; my += a[i]; }
  mx /= n; my /= n;
  var num = 0, den = 0;
  for (i = 0; i < n; i++){ num += (b[i] - mx) * (a[i] - my); den += (b[i] - mx) * (b[i] - mx); }
  if (!(den > 0)) return null;
  var beta = num / den, alpha = my - beta * mx;
  var spread = [];
  for (i = 0; i < n; i++) spread.push(a[i] - beta * b[i] - alpha);
  var dy = [], lag = [];
  for (i = 1; i < spread.length; i++){ dy.push(spread[i] - spread[i - 1]); lag.push(spread[i - 1]); }
  var mY = 0, mX = 0;
  for (i = 0; i < dy.length; i++){ mY += dy[i]; mX += lag[i]; }
  mY /= dy.length; mX /= dy.length;
  num = 0; den = 0;
  for (i = 0; i < dy.length; i++){ num += (lag[i] - mX) * (dy[i] - mY); den += (lag[i] - mX) * (lag[i] - mX); }
  var bCoef = den > 0 ? num / den : null;
  var adf = null;
  if (bCoef !== null){
    var resid = 0;
    for (i = 0; i < dy.length; i++){ var e = dy[i] - (mY + bCoef * (lag[i] - mX)); resid += e * e; }
    var se = Math.sqrt(resid / Math.max(1, dy.length - 2) / den);
    adf = se > 0 ? bCoef / se : null;
  }
  var phi = bCoef !== null ? 1 + bCoef : null;
  var hl = (phi > 0 && phi < 1) ? -Math.log(2) / Math.log(phi) : null;
  var mS = 0;
  for (i = 0; i < spread.length; i++) mS += spread[i];
  mS /= spread.length;
  var vS = 0;
  for (i = 0; i < spread.length; i++) vS += (spread[i] - mS) * (spread[i] - mS);
  var sd = Math.sqrt(vS / spread.length);
  var z = sd > 0 ? (spread[spread.length - 1] - mS) / sd : null;
  var cointegrated = adf !== null && adf <= -2.86 && hl !== null && hl > 0 && hl < 500;
  return { beta: beta, alpha: alpha, adfStat: adf, halfLifeBars: hl, spreadZ: z, cointegrated: cointegrated, n: n,
    note: cointegrated ? 'cointegrated z=' + (z != null ? z.toFixed(2) : '—') + ' HL=' + Math.round(hl) : 'not cointegrated' };
}

function hgCointHalfLifeVeto(coint, timeBarrierBars){
  timeBarrierBars = fin(timeBarrierBars);
  if (!coint || !coint.cointegrated) return { veto: true, reason: 'not cointegrated' };
  var hl = fin(coint.halfLifeBars);
  if (timeBarrierBars !== null && hl > timeBarrierBars) return { veto: true, reason: 'half-life ' + Math.round(hl) + ' > barrier ' + Math.round(timeBarrierBars) };
  return { veto: false, reason: 'half-life ' + Math.round(hl) + ' bars' };
}

G.hgConcurrency = hgConcurrency;
G.hgAvgUniqueness = hgAvgUniqueness;
G.hgEffectiveN = hgEffectiveN;
G.hgEventsFromRecords = hgEventsFromRecords;
G.hgRecordEffectiveN = hgRecordEffectiveN;
G.hgBetSize = hgBetSize;
G.hgEwmaVol = hgEwmaVol;
G.hgGarchLite = hgGarchLite;
G.hgVolFromCloses = hgVolFromCloses;
G.hgVolRegime = hgVolRegime;
G.hgStopVolChip = hgStopVolChip;
G.hgRelSpearman = relSpearman;
G.hgRelGateIC = relGateIC;
G.hgHurstRS = hgHurstRS;
G.hgFamilyRouter = hgFamilyRouter;
G.hgCoint = hgCoint;
G.hgCointHalfLifeVeto = hgCointHalfLifeVeto;

})();
