/* HARDGATE — pinemath.js
   Pure Pine-ported Lorentzian KNN + Gaussian kernel smoothing.
   No DOM. Never throws. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function last(arr){
  if (!arr || !arr.length) return NaN;
  return arr[arr.length - 1];
}

function rsi(vals, p){
  p = p || 14;
  if (typeof G.rsi === 'function') return G.rsi(vals, p);
  var out = new Array(vals.length).fill(NaN);
  if (vals.length < p + 1) return out;
  for (var i = p; i < vals.length; i++){
    var g = 0, l = 0;
    for (var j = i - p + 1; j <= i; j++){
      var d = vals[j] - vals[j - 1];
      if (d >= 0) g += d; else l -= d;
    }
    out[i] = l === 0 ? 100 : 100 - (100 / (1 + g / l));
  }
  return out;
}

function cci(rows, p){
  p = p || 20;
  if (typeof G.cci === 'function') return G.cci(rows, p);
  var out = new Array(rows.length).fill(NaN);
  var tp = rows.map(function(r){ return (r.h + r.l + r.c) / 3; });
  for (var i = p - 1; i < rows.length; i++){
    var slice = tp.slice(i - p + 1, i + 1);
    var m = slice.reduce(function(a, b){ return a + b; }, 0) / slice.length;
    var md = slice.reduce(function(a, b){ return a + Math.abs(b - m); }, 0) / slice.length;
    out[i] = md > 0 ? (tp[i] - m) / (0.015 * md) : NaN;
  }
  return out;
}

function mfi(rows, p){
  p = p || 14;
  if (typeof G.mfi === 'function') return G.mfi(rows, p);
  var tp = rows.map(function(r){ return (r.h + r.l + r.c) / 3; });
  var out = new Array(rows.length).fill(NaN);
  var posFlow = 0, negFlow = 0;
  for (var i = 1; i < rows.length; i++){
    var rawMF = tp[i] * (rows[i].v || 0);
    if (tp[i] > tp[i - 1]) posFlow += rawMF;
    else if (tp[i] < tp[i - 1]) negFlow += rawMF;
    if (i >= p){
      var ratio = posFlow / (negFlow || 1e-12);
      out[i] = isFinite(ratio) ? 100 - 100 / (1 + ratio) : NaN;
      var oldMF = tp[i - p + 1] * (rows[i - p + 1].v || 0);
      if (tp[i - p + 1] > tp[i - p]) posFlow -= oldMF;
      else if (tp[i - p + 1] < tp[i - p]) negFlow -= oldMF;
    }
  }
  return out;
}

function mlScoreAtBar(rows, f1, f2, f3, bi, k, lookback){
  var distances = [];
  var directions = [];
  for (var i = 4; i <= lookback; i++){
    var idx = bi - i;
    if (idx < 0 || bi - i - 4 < 0) continue;
    if (!isFinite(f1[bi]) || !isFinite(f1[idx]) || !isFinite(f2[bi]) || !isFinite(f2[idx]) || !isFinite(f3[bi]) || !isFinite(f3[idx])) continue;
    var dist = Math.log(1 + Math.abs(f1[bi] - f1[idx]))
      + Math.log(1 + Math.abs(f2[bi] - f2[idx]))
      + Math.log(1 + Math.abs(f3[bi] - f3[idx]));
    var histDir = rows[bi - i - 4].c > rows[bi - i].c ? 1 : -1;
    distances.push(dist);
    directions.push(histDir);
  }
  if (distances.length < k) return 0;
  var order = distances.map(function(d, ix){ return { d: d, ix: ix }; });
  order.sort(function(a, b){ return a.d - b.d; });
  var bull = 0, bear = 0;
  for (var j = 0; j < k && j < order.length; j++){
    var vote = directions[order[j].ix];
    if (vote === 1) bull++;
    else if (vote === -1) bear++;
  }
  return bull - bear;
}

function gaussianKernelSmooth(scores, bandwidth){
  var n = scores.length;
  if (!n) return 0;
  var wSum = 0, wScore = 0;
  for (var i = 0; i < n; i++){
    var w = Math.exp(-(Math.pow(i, 2)) / (2 * Math.pow(bandwidth, 2)));
    var sc = scores[n - 1 - i];
    if (!isFinite(sc)) sc = 0;
    wScore += sc * w;
    wSum += w;
  }
  return wSum > 0 ? wScore / wSum : 0;
}

/** Pine: ML Lorentzian + Kernel on closed bars. Returns signal on latest bar. */
function pineLorentzianKernel(rows, opts){
  opts = opts || {};
  var k = opts.kNeighbors || 8;
  var lookback = opts.lookback || 250;
  var scoreLimit = opts.scoreLimit || 2;
  var kernelLookback = opts.kernelLookback || 8;
  var bandwidth = opts.kernelBandwidth || 3;
  try{
    if (!rows || rows.length < lookback + 10) return null;
    var closes = rows.map(function(r){ return r.c; });
    var f1 = rsi(closes, 14);
    var f2 = cci(rows, 20).map(function(v){ return isFinite(v) ? v + 100 : NaN; });
    var f3 = mfi(rows, 14);
    var bi = rows.length - 1;
    var mlHist = [];
    for (var b = Math.max(lookback, bi - kernelLookback + 1); b <= bi; b++){
      mlHist.push(mlScoreAtBar(rows, f1, f2, f3, b, k, lookback));
    }
    var smoothed = gaussianKernelSmooth(mlHist, bandwidth);
    var prevSmoothed = null;
    if (rows.length > lookback + kernelLookback + 2){
      var prevHist = [];
      var pbi = bi - 1;
      for (var pb = Math.max(lookback, pbi - kernelLookback + 1); pb <= pbi; pb++){
        prevHist.push(mlScoreAtBar(rows, f1, f2, f3, pb, k, lookback));
      }
      prevSmoothed = gaussianKernelSmooth(prevHist, bandwidth);
    }
    var longSig = smoothed >= scoreLimit && !(prevSmoothed >= scoreLimit);
    var shortSig = smoothed <= -scoreLimit && !(prevSmoothed <= -scoreLimit);
    var dir = longSig ? 'long' : (shortSig ? 'short' : null);
    return {
      mlScore: mlHist.length ? mlHist[mlHist.length - 1] : 0,
      smoothedScore: smoothed,
      prevSmoothed: prevSmoothed,
      dir: dir,
      longCondition: smoothed >= scoreLimit,
      shortCondition: smoothed <= -scoreLimit,
      newLong: longSig,
      newShort: shortSig,
      price: closes[bi],
      scoreLimit: scoreLimit
    };
  }catch(e){ return null; }
}

G.pineLorentzianKernel = pineLorentzianKernel;
G.pineMlScoreAtBar = mlScoreAtBar;

})();
