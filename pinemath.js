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

function pineEma(arr, len){
  if (typeof G.ema === 'function') return G.ema(arr, len);
  var out = new Array(arr.length).fill(NaN);
  if (arr.length < len) return out;
  var k = 2 / (len + 1);
  var sum = 0;
  for (var i = 0; i < len; i++) sum += arr[i];
  var e = sum / len;
  out[len - 1] = e;
  for (var j = len; j < arr.length; j++){
    e = arr[j] * k + e * (1 - k);
    out[j] = e;
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

function pineAtr(rows, len){
  if (typeof G.atr === 'function') return G.atr(rows, len);
  var out = new Array(rows.length).fill(NaN);
  var a = null;
  for (var i = 1; i < rows.length; i++){
    var tr = Math.max(rows[i].h - rows[i].l,
      Math.abs(rows[i].h - rows[i - 1].c),
      Math.abs(rows[i].l - rows[i - 1].c));
    if (a === null){
      if (i >= len){
        var s = 0;
        for (var k = i - len + 1; k <= i; k++){
          s += Math.max(rows[k].h - rows[k].l,
            Math.abs(rows[k].h - rows[k - 1].c),
            Math.abs(rows[k].l - rows[k - 1].c));
        }
        a = s / len;
        out[i] = a;
      }
    } else {
      a = (a * (len - 1) + tr) / len;
      out[i] = a;
    }
  }
  return out;
}

/** Pine: HalfTrend state machine — trend flip signals with trailing halftrend line. */
function pineHalfTrend(rows, opts){
  opts = opts || {};
  var amplitude = opts.amplitude || 2;
  var atrMult = opts.atrMult || 2.0;
  var atrLen = opts.atrLen || 100;
  try{
    if (!rows || rows.length < atrLen + amplitude + 5) return null;
    var n = rows.length;
    var closes = rows.map(function(r){ return r.c; });
    var highs = rows.map(function(r){ return r.h; });
    var lows = rows.map(function(r){ return r.l; });
    var atrArr = pineAtr(rows, atrLen);
    var highPrice = pineHighest(highs, amplitude);
    var lowPrice = pineLowest(lows, amplitude);

    var ht = lows[0];
    var trend = 1;
    var trendHist = [1];

    for (var i = 1; i < n; i++){
      var prevHt = ht;
      var c = closes[i];
      var atrBand = isFinite(atrArr[i]) ? atrArr[i] * (atrMult / 2) : 0;
      var hp = highPrice[i];
      var lp = lowPrice[i];
      if (trend === 1){
        if (c < prevHt){
          trend = -1;
          ht = (isFinite(hp) ? hp : c) + atrBand;
        } else {
          ht = Math.max(prevHt, (isFinite(lp) ? lp : c) - atrBand);
        }
      } else {
        if (c > prevHt){
          trend = 1;
          ht = (isFinite(lp) ? lp : c) - atrBand;
        } else {
          ht = Math.min(prevHt, (isFinite(hp) ? hp : c) + atrBand);
        }
      }
      trendHist.push(trend);
    }

    var bi = n - 1;
    if (!isFinite(atrArr[bi]) || !isFinite(ht)) return null;
    var prevTrend = trendHist.length > 1 ? trendHist[bi - 1] : trend;
    var newLong = trend === 1 && prevTrend === -1;
    var newShort = trend === -1 && prevTrend === 1;
    var dir = newLong ? 'long' : (newShort ? 'short' : null);
    var stop = ht;
    var entry = closes[bi];
    var risk = Math.abs(entry - stop);
    return {
      dir: dir,
      trend: trend,
      prevTrend: prevTrend,
      halftrend: ht,
      trailingStop: ht,
      newLong: newLong,
      newShort: newShort,
      longCondition: newLong,
      shortCondition: newShort,
      price: entry,
      stop: stop,
      entry: entry,
      t1: (risk > 0 && dir === 'long') ? entry + 2 * risk : (risk > 0 && dir === 'short') ? entry - 2 * risk : NaN,
      t2: (risk > 0 && dir === 'long') ? entry + 3.5 * risk : (risk > 0 && dir === 'short') ? entry - 3.5 * risk : NaN,
      amplitude: amplitude,
      atrMult: atrMult,
      atrLen: atrLen
    };
  }catch(e){ return null; }
}

G.pineHalfTrend = pineHalfTrend;

/** Pine: SMC Core — fractal swings, FVG zones, CHoCH limit entry. */
function pineSmcCore(rows, opts){
  opts = opts || {};
  var pivotLen = opts.pivotLength || 5;
  var atrLen = opts.atrLen || 14;
  try{
    if (!rows || rows.length < pivotLen * 2 + 10) return null;
    var n = rows.length;
    var highs = rows.map(function(r){ return r.h; });
    var lows = rows.map(function(r){ return r.l; });
    var closes = rows.map(function(r){ return r.c; });
    var atrArr = pineAtr(rows, atrLen);

    var lastSh = NaN, lastSl = NaN, trend = 1;
    var bullFvgTop = NaN, bullFvgBot = NaN, bearFvgTop = NaN, bearFvgBot = NaN;
    var signal = null;

    for (var i = 0; i < n; i++){
      var ph = pivotHighAt(highs, i, pivotLen, pivotLen);
      var pl = pivotLowAt(lows, i, pivotLen, pivotLen);
      if (isFinite(ph)) lastSh = ph;
      if (isFinite(pl)) lastSl = pl;

      if (i >= 2){
        if (lows[i] > highs[i - 2]){
          bullFvgTop = lows[i];
          bullFvgBot = highs[i - 2];
        }
        if (highs[i] < lows[i - 2]){
          bearFvgTop = lows[i - 2];
          bearFvgBot = highs[i];
        }
      }

      var prevC = i > 0 ? closes[i - 1] : closes[i];
      var c = closes[i];
      var atr = isFinite(atrArr[i]) ? atrArr[i] : 0;
      var bullChoch = isFinite(lastSh) && prevC <= lastSh && c > lastSh && trend === -1;
      var bearChoch = isFinite(lastSl) && prevC >= lastSl && c < lastSl && trend === 1;

      if (bullChoch){
        trend = 1;
        var limitEntry = bullFvgTop;
        var stopLoss = isFinite(bullFvgBot) ? bullFvgBot - atr : NaN;
        if (i === n - 1 && isFinite(limitEntry) && isFinite(stopLoss) && limitEntry !== stopLoss){
          var riskL = Math.abs(limitEntry - stopLoss);
          signal = {
            dir: 'long',
            newLong: true,
            newShort: false,
            entry: limitEntry,
            stop: stopLoss,
            zoneEntry: limitEntry,
            zoneTop: bullFvgTop,
            zoneBot: bullFvgBot,
            t1: limitEntry + 2 * riskL,
            t2: limitEntry + 3.5 * riskL,
            price: c,
            lastSh: lastSh,
            lastSl: lastSl,
            pivotLength: pivotLen
          };
        }
      }
      if (bearChoch){
        trend = -1;
        var limitEntryS = bearFvgBot;
        var stopLossS = isFinite(bearFvgTop) ? bearFvgTop + atr : NaN;
        if (i === n - 1 && isFinite(limitEntryS) && isFinite(stopLossS) && limitEntryS !== stopLossS){
          var riskS = Math.abs(limitEntryS - stopLossS);
          signal = {
            dir: 'short',
            newLong: false,
            newShort: true,
            entry: limitEntryS,
            stop: stopLossS,
            zoneEntry: limitEntryS,
            zoneTop: bearFvgTop,
            zoneBot: bearFvgBot,
            t1: limitEntryS - 2 * riskS,
            t2: limitEntryS - 3.5 * riskS,
            price: c,
            lastSh: lastSh,
            lastSl: lastSl,
            pivotLength: pivotLen
          };
        }
      }
    }

    if (!signal) return null;
    return signal;
  }catch(e){ return null; }
}

G.pineSmcCore = pineSmcCore;

/** Pine: VuManChu Cipher B — WaveTrend + zero-lag divergence (bull_div / bear_div). */
function pineVumanchuCipher(rows, opts){
  opts = opts || {};
  var wtN1 = opts.wtChannelLen || 9;
  var wtN2 = opts.wtAvgLen || 21;
  var osLevel = opts.osLevel !== undefined ? +opts.osLevel : -53;
  var obLevel = opts.obLevel !== undefined ? +opts.obLevel : 53;
  try{
    if (!rows || rows.length < wtN2 + wtN1 + 10) return null;
    var n = rows.length;
    var ap = rows.map(function(r){ return (r.h + r.l + r.c) / 3; });
    var esa = pineEma(ap, wtN1);
    var dSrc = ap.map(function(v, i){ return isFinite(esa[i]) ? Math.abs(v - esa[i]) : NaN; });
    var dArr = pineEma(dSrc, wtN1);
    var ci = ap.map(function(v, i){
      if (!isFinite(esa[i]) || !isFinite(dArr[i]) || dArr[i] === 0) return NaN;
      return (v - esa[i]) / (0.015 * dArr[i]);
    });
    var wt1 = pineEma(ci, wtN2);
    var wt2 = pineSma(wt1, 4);

    var lastSwingLowPrice = NaN, lastSwingLowWt = NaN;
    var lastSwingHighPrice = NaN, lastSwingHighWt = NaN;
    var signal = null;

    for (var i = 1; i < n; i++){
      var w1 = wt1[i], w2 = wt2[i];
      var w1p = wt1[i - 1], w2p = wt2[i - 1];
      if (!isFinite(w1) || !isFinite(w2) || !isFinite(w1p) || !isFinite(w2p)) continue;

      var greenDot = w1p <= w2p && w1 > w2;
      var redDot = w1p >= w2p && w1 < w2;

      if (i >= 2){
        var gdPrev = isFinite(wt1[i - 2]) && isFinite(wt2[i - 2])
          && wt1[i - 2] <= wt2[i - 2] && wt1[i - 1] > wt2[i - 1];
        var rdPrev = isFinite(wt1[i - 2]) && isFinite(wt2[i - 2])
          && wt1[i - 2] >= wt2[i - 2] && wt1[i - 1] < wt2[i - 1];
        if (gdPrev){
          lastSwingLowPrice = rows[i - 1].l;
          lastSwingLowWt = wt1[i - 1];
        }
        if (rdPrev){
          lastSwingHighPrice = rows[i - 1].h;
          lastSwingHighWt = wt1[i - 1];
        }
      }

      var lo = rows[i].l, hi = rows[i].h, cl = rows[i].c;
      var bullDiv = greenDot && w1 <= osLevel
        && isFinite(lastSwingLowPrice) && isFinite(lastSwingLowWt)
        && lo < lastSwingLowPrice && w1 > lastSwingLowWt;
      var bearDiv = redDot && w1 >= obLevel
        && isFinite(lastSwingHighPrice) && isFinite(lastSwingHighWt)
        && hi > lastSwingHighPrice && w1 < lastSwingHighWt;

      if (i === n - 1 && bullDiv){
        signal = {
          dir: 'long',
          signalType: 'bull_div',
          newLong: true,
          newShort: false,
          wt1: w1,
          wt2: w2,
          osLevel: osLevel,
          obLevel: obLevel,
          lastSwingLowPrice: lastSwingLowPrice,
          lastSwingLowWt: lastSwingLowWt,
          price: cl
        };
      } else if (i === n - 1 && bearDiv){
        signal = {
          dir: 'short',
          signalType: 'bear_div',
          newLong: false,
          newShort: true,
          wt1: w1,
          wt2: w2,
          osLevel: osLevel,
          obLevel: obLevel,
          lastSwingHighPrice: lastSwingHighPrice,
          lastSwingHighWt: lastSwingHighWt,
          price: cl
        };
      }
    }

    if (!signal) return null;
    return signal;
  }catch(e){ return null; }
}

G.pineVumanchuCipher = pineVumanchuCipher;

/** Pine: Range Filter — regime flip on adaptive range band (per 100, mult 3). */
function pineRangeFilter(rows, opts){
  opts = opts || {};
  var per = opts.period || 100;
  var mult = opts.mult !== undefined ? +opts.mult : 3.0;
  try{
    if (!rows || rows.length < per * 2 + 5) return null;
    var n = rows.length;
    var source = rows.map(function(r){ return r.c; });
    var absDiff = new Array(n).fill(NaN);
    for (var j = 1; j < n; j++){
      absDiff[j] = Math.abs(source[j] - source[j - 1]);
    }
    var smrng = pineEma(absDiff, per);
    var rngEma = pineEma(smrng, per);
    var rngArr = rngEma.map(function(v){ return isFinite(v) ? v * mult : NaN; });

    var rfArr = new Array(n).fill(NaN);
    var trendArr = new Array(n).fill(0);
    rfArr[0] = source[0];
    var src0 = source[0], rf0 = rfArr[0];
    trendArr[0] = src0 > rf0 ? 1 : (src0 < rf0 ? -1 : 0);

    for (var i = 1; i < n; i++){
      var src = source[i];
      var rng = rngArr[i];
      var rfPrev = isFinite(rfArr[i - 1]) ? rfArr[i - 1] : src;
      var rfVal;
      if (!isFinite(rng)){
        rfVal = rfPrev;
      } else if (src > rfPrev){
        rfVal = (src - rng) < rfPrev ? rfPrev : (src - rng);
      } else {
        rfVal = (src + rng) > rfPrev ? rfPrev : (src + rng);
      }
      rfArr[i] = rfVal;
      if (src > rfVal) trendArr[i] = 1;
      else if (src < rfVal) trendArr[i] = -1;
      else trendArr[i] = trendArr[i - 1];
    }

    var bi = n - 1;
    var trend = trendArr[bi];
    var prevTrend = bi > 0 ? trendArr[bi - 1] : 0;
    var longCondition = trend === 1 && prevTrend === -1;
    var shortCondition = trend === -1 && prevTrend === 1;
    if (!longCondition && !shortCondition) return null;

    return {
      dir: longCondition ? 'long' : 'short',
      newLong: longCondition,
      newShort: shortCondition,
      trend: trend,
      prevTrend: prevTrend,
      filterLevel: rfArr[bi],
      rng: rngArr[bi],
      period: per,
      mult: mult,
      price: source[bi]
    };
  }catch(e){ return null; }
}

G.pineRangeFilter = pineRangeFilter;

})();
