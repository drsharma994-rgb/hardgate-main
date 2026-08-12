/* HARDGATE — Hurst + sample entropy strategy-family router (Hurst 1951; Richman & Moorman 2000). Pure. */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function mean(a){
  if (!a.length) return null;
  var s = 0;
  for (var i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function linReg(xs, ys){
  var n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  var mx = mean(xs.slice(0, n)), my = mean(ys.slice(0, n));
  var num = 0, den = 0, ssTot = 0, ssRes = 0;
  for (var i = 0; i < n; i++){
    var dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    den += dx * dx;
    ssTot += dy * dy;
  }
  if (!(den > 0)) return null;
  var slope = num / den;
  var intercept = my - slope * mx;
  for (var j = 0; j < n; j++){
    var pred = intercept + slope * xs[j];
    ssRes += (ys[j] - pred) * (ys[j] - pred);
  }
  var r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
  return { slope: slope, intercept: intercept, r2: r2, n: n };
}

/** Rescaled-range Hurst via dyadic windows (log-log slope). */
export function hgHurstRS(closes, minWindow){
  minWindow = (minWindow >= 4) ? minWindow : 8;
  var arr = (Array.isArray(closes) ? closes : []).map(Number).filter(function(x){ return isFinite(x); });
  var n = arr.length;
  if (n < 128) return null;

  var xs = [], ys = [];
  for (var w = minWindow; w <= Math.floor(n / 4); w *= 2){
    var chunks = Math.floor(n / w);
    if (chunks < 2) break;
    var rsSum = 0, rsN = 0;
    for (var c = 0; c < chunks; c++){
      var seg = arr.slice(c * w, (c + 1) * w);
      var m = mean(seg);
      if (m === null) continue;
      var cum = 0, minC = 0, maxC = 0;
      for (var i = 0; i < seg.length; i++){
        cum += seg[i] - m;
        if (cum < minC) minC = cum;
        if (cum > maxC) maxC = cum;
      }
      var r = maxC - minC;
      var v = 0;
      for (var j = 0; j < seg.length; j++) v += (seg[j] - m) * (seg[j] - m);
      var s = Math.sqrt(v / seg.length);
      if (s > 0 && r > 0){ rsSum += r / s; rsN++; }
    }
    if (rsN > 0){
      xs.push(Math.log(w));
      ys.push(Math.log(rsSum / rsN));
    }
  }
  if (xs.length < 3) return null;
  var fit = linReg(xs, ys);
  if (!fit) return null;
  var hurst = fit.slope;
  var note = 'H=' + hurst.toFixed(2);
  if (fit.r2 !== null && fit.r2 < 0.9) note += ' · low R² — unreliable';
  return { hurst: hurst, n: n, r2: fit.r2, note: note };
}

function chebyshevDist(a, b, m, r){
  var d = 0;
  for (var i = 0; i < m; i++){
    var diff = Math.abs(a[i] - b[i]);
    if (diff > d) d = diff;
  }
  return d <= r;
}

/** Sample entropy (m=2 default, r as fraction of std). */
export function hgSampleEntropy(series, m, rFrac){
  m = (m >= 1) ? m : 2;
  rFrac = (rFrac > 0) ? rFrac : 0.2;
  var arr = (Array.isArray(series) ? series : []).map(Number).filter(function(x){ return isFinite(x); });
  var n = arr.length;
  if (n < m + 2) return null;
  var sd = Math.sqrt(sampleVar(arr) || 0);
  if (!(sd > 0)) return null;
  var r = rFrac * sd;

  function countMatches(len){
    var c = 0, tot = 0;
    for (var i = 0; i < n - len; i++){
      for (var j = i + 1; j < n - len; j++){
        tot++;
        if (chebyshevDist(arr.slice(i, i + len), arr.slice(j, j + len), len, r)) c++;
      }
    }
    return { c: c, tot: tot };
  }
  var a = countMatches(m + 1);
  var b = countMatches(m);
  if (!b.c || !a.c) return { sampEn: null, n: n, note: 'degenerate matches' };
  var sampEn = -Math.log(a.c / b.c);
  return { sampEn: sampEn, n: n, m: m, r: r };
}

function sampleVar(xs){
  var m = mean(xs);
  if (m === null) return null;
  var v = 0;
  for (var i = 0; i < xs.length; i++) v += (xs[i] - m) * (xs[i] - m);
  return v / xs.length;
}

/** @returns {{ favour:'TREND'|'MEANREV'|'NEITHER', confidence:number, evidence:string[] }} */
export function hgFamilyRouter(input){
  input = input || {};
  var hurst = input.hurst;
  var sampEn = input.sampEn;
  var adx = fin(input.adx);
  var evidence = [];
  var confidence = 0.3;

  if (hurst && isFinite(hurst.hurst)){
    evidence.push('H=' + hurst.hurst.toFixed(2) + (hurst.r2 != null && hurst.r2 < 0.9 ? ' (unreliable R²)' : ''));
    if (hurst.hurst > 0.55){
      evidence.push('persistent / trending');
    } else if (hurst.hurst < 0.45){
      evidence.push('anti-persistent / mean-reverting');
    } else {
      evidence.push('random-walk band');
    }
  } else {
    evidence.push('Hurst unavailable');
  }

  if (sampEn && isFinite(sampEn.sampEn)){
    evidence.push('SampEn=' + sampEn.sampEn.toFixed(2));
    if (sampEn.sampEn > 1.5) confidence *= 0.7;
  }

  if (adx !== null) evidence.push('ADX=' + adx.toFixed(0));

  var favour = 'NEITHER';
  if (hurst && isFinite(hurst.hurst)){
    if (hurst.hurst > 0.55 && (!hurst.r2 || hurst.r2 >= 0.9)){
      favour = 'TREND';
      confidence = Math.min(0.9, 0.5 + (hurst.hurst - 0.55) * 2);
    } else if (hurst.hurst < 0.45 && (!hurst.r2 || hurst.r2 >= 0.9)){
      favour = 'MEANREV';
      confidence = Math.min(0.9, 0.5 + (0.45 - hurst.hurst) * 2);
    } else {
      favour = 'NEITHER';
      confidence = 0.35;
    }
  }

  if (favour === 'NEITHER'){
    evidence.unshift('no family edge — H≈0.5 (random walk)');
  }

  return {
    favour: favour,
    confidence: Math.round(confidence * 100) / 100,
    evidence: evidence,
  };
}
