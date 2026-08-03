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

function pivotHighAt(highs, confirmIdx, left, right){
  var p = confirmIdx - right;
  if (p < left || confirmIdx >= highs.length) return NaN;
  var pv = highs[p];
  for (var j = p - left; j <= p + right; j++){
    if (j < 0 || j >= highs.length) return NaN;
    if (highs[j] > pv) return NaN;
  }
  return pv;
}

function pivotLowAt(lows, confirmIdx, left, right){
  var p = confirmIdx - right;
  if (p < left || confirmIdx >= lows.length) return NaN;
  var pv = lows[p];
  for (var j = p - left; j <= p + right; j++){
    if (j < 0 || j >= lows.length) return NaN;
    if (lows[j] < pv) return NaN;
  }
  return pv;
}

/** Pine: MSB + Order Block — market structure break with OB limit entry/stop. */
function pineMsbOb(rows, opts){
  opts = opts || {};
  var left = opts.leftBars || 5;
  var right = opts.rightBars || 5;
  try{
    if (!rows || rows.length < left + right + 10) return null;
    var highs = rows.map(function(r){ return r.h; });
    var lows = rows.map(function(r){ return r.l; });
    var n = rows.length;

    var lastSh = NaN, lastSl = NaN, trend = 0;
    var lastBearHigh = NaN, lastBearLow = NaN, lastBullHigh = NaN, lastBullLow = NaN;
    var prevBullMsb = false, prevBearMsb = false;
    var lastResult = null;

    for (var bi = 0; bi < n; bi++){
      var r = rows[bi];
      var o = r.o, h = r.h, l = r.l, c = r.c;
      var ph = pivotHighAt(highs, bi, left, right);
      var pl = pivotLowAt(lows, bi, left, right);
      if (isFinite(ph)) lastSh = ph;
      if (isFinite(pl)) lastSl = pl;

      if (c < o){
        lastBearHigh = h;
        lastBearLow = l;
      }
      if (c > o){
        lastBullHigh = h;
        lastBullLow = l;
      }

      var prevC = bi > 0 ? rows[bi - 1].c : c;
      var bullMsb = isFinite(lastSh) && prevC <= lastSh && c > lastSh && trend !== 1;
      var bearMsb = isFinite(lastSl) && prevC >= lastSl && c < lastSl && trend !== -1;

      if (bullMsb) trend = 1;
      if (bearMsb) trend = -1;

      var newLong = bullMsb && !prevBullMsb;
      var newShort = bearMsb && !prevBearMsb;
      var dir = newLong ? 'long' : (newShort ? 'short' : null);
      var entry = NaN, stop = NaN;
      if (newLong && isFinite(lastBearHigh) && isFinite(lastBearLow)){
        entry = lastBearHigh;
        stop = lastBearLow;
      } else if (newShort && isFinite(lastBullLow) && isFinite(lastBullHigh)){
        entry = lastBullLow;
        stop = lastBullHigh;
      }

      if (bi === n - 1){
        var risk = isFinite(entry) && isFinite(stop) ? Math.abs(entry - stop) : NaN;
        lastResult = {
          dir: dir,
          trend: trend,
          newLong: newLong,
          newShort: newShort,
          bullMsb: bullMsb,
          bearMsb: bearMsb,
          price: c,
          entry: entry,
          stop: stop,
          t1: (isFinite(risk) && risk > 0 && dir === 'long') ? entry + 2 * risk
            : (isFinite(risk) && risk > 0 && dir === 'short') ? entry - 2 * risk : NaN,
          t2: (isFinite(risk) && risk > 0 && dir === 'long') ? entry + 3.5 * risk
            : (isFinite(risk) && risk > 0 && dir === 'short') ? entry - 3.5 * risk : NaN,
          lastSh: lastSh,
          lastSl: lastSl,
          leftBars: left,
          rightBars: right
        };
      }

      prevBullMsb = bullMsb;
      prevBearMsb = bearMsb;
    }
    return lastResult;
  }catch(e){ return null; }
}

G.pineMsbOb = pineMsbOb;
G.pinePivotHighAt = pivotHighAt;
G.pinePivotLowAt = pivotLowAt;

function pineSma(arr, len){
  if (typeof G.sma === 'function') return G.sma(arr, len);
  var out = new Array(arr.length).fill(NaN);
  for (var i = len - 1; i < arr.length; i++){
    var sum = 0, ok = true;
    for (var k = i - len + 1; k <= i; k++){
      if (!isFinite(arr[k])){ ok = false; break; }
      sum += arr[k];
    }
    if (ok) out[i] = sum / len;
  }
  return out;
}

function pineStdev(arr, len){
  if (typeof G.stdev === 'function') return G.stdev(arr, len);
  var out = new Array(arr.length).fill(NaN);
  for (var i = len - 1; i < arr.length; i++){
    var sum = 0, ok = true;
    for (var k = i - len + 1; k <= i; k++){
      if (!isFinite(arr[k])){ ok = false; break; }
      sum += arr[k];
    }
    if (!ok) continue;
    var m = sum / len, sq = 0;
    for (var j = i - len + 1; j <= i; j++) sq += Math.pow(arr[j] - m, 2);
    out[i] = Math.sqrt(sq / len);
  }
  return out;
}

function pineHighest(arr, len){
  if (typeof G.highest === 'function') return G.highest(arr, len);
  var out = new Array(arr.length).fill(NaN);
  for (var i = len - 1; i < arr.length; i++){
    var m = -Infinity, ok = true;
    for (var k = i - len + 1; k <= i; k++){
      if (!isFinite(arr[k])){ ok = false; break; }
      if (arr[k] > m) m = arr[k];
    }
    if (ok) out[i] = m;
  }
  return out;
}

function pineLowest(arr, len){
  if (typeof G.lowest === 'function') return G.lowest(arr, len);
  var out = new Array(arr.length).fill(NaN);
  for (var i = len - 1; i < arr.length; i++){
    var m = Infinity, ok = true;
    for (var k = i - len + 1; k <= i; k++){
      if (!isFinite(arr[k])){ ok = false; break; }
      if (arr[k] < m) m = arr[k];
    }
    if (ok) out[i] = m;
  }
  return out;
}

function pineTrSeries(rows){
  var out = new Array(rows.length).fill(NaN);
  for (var i = 0; i < rows.length; i++){
    if (i === 0){ out[i] = rows[i].h - rows[i].l; continue; }
    var h = rows[i].h, l = rows[i].l, pc = rows[i - 1].c;
    out[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  return out;
}

/** Pine ta.linreg(source, length, 0) — regression value at current bar. */
function pineLinreg(source, len){
  if (typeof G.linregCurve === 'function') return G.linregCurve(source, len);
  var out = new Array(source.length).fill(NaN);
  if (len < 2) return out;
  var sx = len * (len - 1) / 2;
  var sxx = len * (len - 1) * (2 * len - 1) / 6;
  var denom = len * sxx - sx * sx;
  for (var i = len - 1; i < source.length; i++){
    var sy = 0, sxy = 0, ok = true;
    for (var k = 0; k < len; k++){
      var y = source[i - len + 1 + k];
      if (!isFinite(y)){ ok = false; break; }
      sy += y;
      sxy += k * y;
    }
    if (!ok) continue;
    var slope = (len * sxy - sx * sy) / denom;
    var intercept = (sy - slope * sx) / len;
    out[i] = intercept + slope * (len - 1);
  }
  return out;
}

/** Pine: Squeeze Momentum (LazyBear BB/KC squeeze fire + linreg momentum). */
function pineSqueezeMomentum(rows, opts){
  opts = opts || {};
  var length = opts.length || 20;
  var bbMult = opts.bbMult || 2;
  var kcMult = opts.kcMult || 1.5;
  try{
    if (!rows || rows.length < length + 5) return null;
    var closes = rows.map(function(r){ return r.c; });
    var highs = rows.map(function(r){ return r.h; });
    var lows = rows.map(function(r){ return r.l; });
    var n = rows.length;

    var basis = pineSma(closes, length);
    var devArr = pineStdev(closes, length);
    var upperBB = new Array(n), lowerBB = new Array(n);
    for (var i = 0; i < n; i++){
      if (!isFinite(basis[i]) || !isFinite(devArr[i])){
        upperBB[i] = lowerBB[i] = NaN;
      } else {
        upperBB[i] = basis[i] + bbMult * devArr[i];
        lowerBB[i] = basis[i] - bbMult * devArr[i];
      }
    }

    var kcBasis = pineSma(closes, length);
    var rangeMa = pineSma(pineTrSeries(rows), length);
    var upperKC = new Array(n), lowerKC = new Array(n);
    for (var j = 0; j < n; j++){
      if (!isFinite(kcBasis[j]) || !isFinite(rangeMa[j])){
        upperKC[j] = lowerKC[j] = NaN;
      } else {
        upperKC[j] = kcBasis[j] + rangeMa[j] * kcMult;
        lowerKC[j] = kcBasis[j] - rangeMa[j] * kcMult;
      }
    }

    var sqzOn = new Array(n);
    for (var s = 0; s < n; s++){
      sqzOn[s] = isFinite(lowerBB[s]) && isFinite(upperBB[s]) && isFinite(lowerKC[s]) && isFinite(upperKC[s])
        && lowerBB[s] > lowerKC[s] && upperBB[s] < upperKC[s];
    }

    var hh = pineHighest(highs, length);
    var ll = pineLowest(lows, length);
    var smaClose = pineSma(closes, length);
    var src = new Array(n);
    for (var x = 0; x < n; x++){
      if (!isFinite(hh[x]) || !isFinite(ll[x]) || !isFinite(smaClose[x]) || !isFinite(closes[x])) src[x] = NaN;
      else src[x] = closes[x] - ((hh[x] + ll[x]) / 2 + smaClose[x]) / 2;
    }
    var momentumArr = pineLinreg(src, length);
    var bi = n - 1;
    var sqzFired = bi > 0 && sqzOn[bi - 1] && !sqzOn[bi];
    var momentum = momentumArr[bi];
    var longCondition = sqzFired && isFinite(momentum) && momentum > 0;
    var shortCondition = sqzFired && isFinite(momentum) && momentum < 0;
    var newLong = longCondition;
    var newShort = shortCondition;
    var dir = newLong ? 'long' : (newShort ? 'short' : null);
    return {
      dir: dir,
      sqzOn: sqzOn[bi],
      sqzFired: sqzFired,
      momentum: momentum,
      longCondition: longCondition,
      shortCondition: shortCondition,
      newLong: newLong,
      newShort: newShort,
      price: closes[bi],
      length: length,
      bbMult: bbMult,
      kcMult: kcMult
    };
  }catch(e){ return null; }
}

G.pineSqueezeMomentum = pineSqueezeMomentum;

/** Pine: Smart Money Flow ratio cross ±threshold. */
function pineSmartMoneyFlow(rows, opts){
  opts = opts || {};
  var length = opts.length || 21;
  var threshold = opts.threshold !== undefined ? +opts.threshold : 0.10;
  try{
    if (!rows || rows.length < length + 2) return null;
    var n = rows.length;
    var mfVol = new Array(n);
    for (var i = 0; i < n; i++){
      var r = rows[i];
      var hl = r.h - r.l;
      var mult = hl !== 0 ? ((r.c - r.l) - (r.h - r.c)) / hl : 0;
      mfVol[i] = mult * (r.v || 0);
    }
    var smfArr = new Array(n).fill(NaN);
    for (var j = length - 1; j < n; j++){
      var sumMf = 0, sumVol = 0;
      for (var k = j - length + 1; k <= j; k++){
        sumMf += mfVol[k] || 0;
        sumVol += rows[k].v || 0;
      }
      smfArr[j] = sumVol !== 0 ? sumMf / sumVol : 0;
    }
    var bi = n - 1;
    var prev = bi > 0 ? smfArr[bi - 1] : NaN;
    var smf = smfArr[bi];
    var longCondition = isFinite(prev) && isFinite(smf) && prev <= threshold && smf > threshold;
    var shortCondition = isFinite(prev) && isFinite(smf) && prev >= -threshold && smf < -threshold;
    var newLong = longCondition;
    var newShort = shortCondition;
    var dir = newLong ? 'long' : (newShort ? 'short' : null);
    return {
      dir: dir,
      smf: smf,
      prevSmf: prev,
      threshold: threshold,
      length: length,
      longCondition: longCondition,
      shortCondition: shortCondition,
      newLong: newLong,
      newShort: newShort,
      price: rows[bi].c
    };
  }catch(e){ return null; }
}

G.pineSmartMoneyFlow = pineSmartMoneyFlow;

})();
