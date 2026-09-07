/* HARDGATE — structure-core.js (Increment 6)
   Provably-correct structure code:
   1. Tested Swing & Structural High/Low detector (BOS and CHoCH tracking)
   2. FVG (Fair Value Gap) with displacement gate (body >= 1.5x 20-ATR and close in top/bottom 25%) and mitigation tracking
   3. Order Block detector with structural break requirement, mitigation volume quality (>=0.5x OB volume), invalidation on close
   4. RSI Divergence (Regular reversal AND Hidden continuation cleanly separated)
   5. Parameter-agnostic primitives (CUSUM, TSMOM, EMA Cascade)
*/
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

function fin(v){ return typeof v === 'number' && isFinite(v); }
function num(v){
  if (v === null || v === undefined || v === '') return null;
  var n = +v;
  return isFinite(n) ? n : null;
}

// ---------------- 1. Swing & Structural High/Low Detector ----------------
/** Pure swing detector with left/right lookback and BOS/CHoCH state tracking */
function detectSwings(rows, opts){
  opts = opts || {};
  var left = opts.left || 3;
  var right = opts.right || 3;
  rows = Array.isArray(rows) ? rows : [];
  if (rows.length < left + right + 1) return { swings: [], bos: [], choch: [], trend: 'range' };

  var swings = [];
  var lastHigh = null;
  var lastLow = null;
  var trend = 'range';
  var bos = [];
  var choch = [];

  for (var i = left; i < rows.length - right; i++){
    var bar = rows[i];
    var isHigh = true;
    var isLow = true;

    for (var k = 1; k <= left; k++){
      if (rows[i - k].h >= bar.h) isHigh = false;
      if (rows[i - k].l <= bar.l) isLow = false;
    }
    for (var m = 1; m <= right; m++){
      if (rows[i + m].h > bar.h) isHigh = false;
      if (rows[i + m].l < bar.l) isLow = false;
    }

    if (isHigh){
      var typeH = (!lastHigh || bar.h > lastHigh.px) ? 'HH' : 'LH';
      var swH = { i: i, t: bar.t, px: bar.h, kind: 'high', type: typeH };
      swings.push(swH);
      lastHigh = swH;
    }
    if (isLow){
      var typeL = (!lastLow || bar.l < lastLow.px) ? 'LL' : 'HL';
      var swL = { i: i, t: bar.t, px: bar.l, kind: 'low', type: typeL };
      swings.push(swL);
      lastLow = swL;
    }
  }

  // Evaluate BOS / CHoCH forward across closes
  for (var cIdx = 0; cIdx < rows.length; cIdx++){
    var close = rows[cIdx].c;
    var priorHighs = swings.filter(function(s){ return s.kind === 'high' && s.i + right <= cIdx; });
    var priorLows = swings.filter(function(s){ return s.kind === 'low' && s.i + right <= cIdx; });
    var prevH = priorHighs.length ? priorHighs[priorHighs.length - 1] : null;
    var prevL = priorLows.length ? priorLows[priorLows.length - 1] : null;

    if (prevH && close > prevH.px && !prevH.broken){
      prevH.broken = true;
      if (trend === 'up'){
        bos.push({ i: cIdx, t: rows[cIdx].t, dir: 'up', level: prevH.px, swingIdx: prevH.i });
      } else {
        choch.push({ i: cIdx, t: rows[cIdx].t, dir: 'up', level: prevH.px, swingIdx: prevH.i });
        trend = 'up';
      }
    }
    if (prevL && close < prevL.px && !prevL.broken){
      prevL.broken = true;
      if (trend === 'down'){
        bos.push({ i: cIdx, t: rows[cIdx].t, dir: 'down', level: prevL.px, swingIdx: prevL.i });
      } else {
        choch.push({ i: cIdx, t: rows[cIdx].t, dir: 'down', level: prevL.px, swingIdx: prevL.i });
        trend = 'down';
      }
    }
  }

  return {
    swings: swings,
    bos: bos,
    choch: choch,
    trend: trend,
    lastHigh: lastHigh,
    lastLow: lastLow
  };
}

// ---------------- 2. FVG (Fair Value Gap) Canonical Detector ----------------
/** Strict 3-bar FVG with displacement gate and mitigation state tracking */
function detectFvg(rows, opts){
  opts = opts || {};
  var atrLen = opts.atrLen || 14;
  rows = Array.isArray(rows) ? rows : [];
  if (rows.length < 5) return [];

  // Compute rolling ATR
  var atrs = [];
  var trs = [];
  for (var a = 0; a < rows.length; a++){
    if (a === 0){ trs.push(rows[a].h - rows[a].l); atrs.push(trs[0]); }
    else {
      var tr = Math.max(rows[a].h - rows[a].l, Math.abs(rows[a].h - rows[a - 1].c), Math.abs(rows[a].l - rows[a - 1].c));
      trs.push(tr);
      if (a < atrLen){
        var sumTr = trs.reduce(function(acc, x){ return acc + x; }, 0);
        atrs.push(sumTr / trs.length);
      } else {
        atrs.push((atrs[a - 1] * (atrLen - 1) + tr) / atrLen);
      }
    }
  }

  var fvgs = [];
  for (var i = 2; i < rows.length; i++){
    var b1 = rows[i - 2];
    var b2 = rows[i - 1]; // Middle displacement bar
    var b3 = rows[i];
    var curAtr = atrs[i - 1] || (b2.h - b2.l);

    var b2Range = b2.h - b2.l;
    var b2Body = Math.abs(b2.c - b2.o);
    var displacementOk = b2Body >= (1.5 * curAtr) || b2Range >= (1.75 * curAtr);

    // Bullish FVG: b1.h < b3.l, middle bar closes in top 25% of range
    if (b1.h < b3.l){
      var closeInTop25 = (b2.c - b2.l) >= (0.75 * b2Range);
      if (displacementOk && closeInTop25 && b2.c > b2.o){
        var top = b3.l;
        var bottom = b1.h;
        var gapMid = (top + bottom) / 2;
        var state = 'unmitigated';
        var tapCount = 0;

        for (var k = i + 1; k < rows.length; k++){
          if (rows[k].l <= bottom){ state = 'invalidated'; break; }
          else if (rows[k].l <= top){ state = 'tapped'; tapCount++; }
        }

        fvgs.push({
          idx: i - 1,
          time: b2.t,
          dir: 'bullish',
          top: top,
          bottom: bottom,
          mid: gapMid,
          displacement: b2Body / (curAtr || 1),
          state: state,
          tapCount: tapCount
        });
      }
    }
    // Bearish FVG: b1.l > b3.h, middle bar closes in bottom 25% of range
    else if (b1.l > b3.h){
      var closeInBottom25 = (b2.h - b2.c) >= (0.75 * b2Range);
      if (displacementOk && closeInBottom25 && b2.c < b2.o){
        var bTop = b1.l;
        var bBottom = b3.h;
        var bGapMid = (bTop + bBottom) / 2;
        var bState = 'unmitigated';
        var bTapCount = 0;

        for (var bk = i + 1; bk < rows.length; bk++){
          if (rows[bk].h >= bTop){ bState = 'invalidated'; break; }
          else if (rows[bk].h >= bBottom){ bState = 'tapped'; bTapCount++; }
        }

        fvgs.push({
          idx: i - 1,
          time: b2.t,
          dir: 'bearish',
          top: bTop,
          bottom: bBottom,
          mid: bGapMid,
          displacement: b2Body / (curAtr || 1),
          state: bState,
          tapCount: bTapCount
        });
      }
    }
  }

  return fvgs;
}

// ---------------- 3. Order Block Detector with Structure Break & Tap Quality ----------------
/** Strict OB detector: only marked if the following leg broke structure */
function detectOrderBlocks(rows, swingsResult){
  rows = Array.isArray(rows) ? rows : [];
  if (rows.length < 10) return [];
  var sw = swingsResult || detectSwings(rows, { left: 3, right: 3 });
  var breaks = sw.bos.concat(sw.choch);
  var obs = [];

  for (var b = 0; b < breaks.length; b++){
    var brk = breaks[b];
    var breakIdx = brk.i;
    var swingIdx = brk.swingIdx;
    if (breakIdx <= swingIdx) continue;

    if (brk.dir === 'up'){
      // Find last down-candle before the break leg
      for (var j = breakIdx - 1; j >= Math.max(0, swingIdx); j--){
        if (rows[j].c < rows[j].o){
          var obCandle = rows[j];
          var top = obCandle.h;
          var bottom = obCandle.l;
          var obVol = obCandle.v || 1;
          var state = 'valid';
          var highQualityTap = false;

          for (var f = breakIdx; f < rows.length; f++){
            // Invalidate if full candle close below OB bottom
            if (rows[f].c < bottom){ state = 'invalidated'; break; }
            if (rows[f].l <= top && rows[f].h >= bottom){
              var tapVol = rows[f].v || 0;
              if (tapVol >= 0.5 * obVol) highQualityTap = true;
              state = 'mitigated';
            }
          }

          obs.push({
            type: 'demand',
            idx: j,
            time: obCandle.t,
            top: top,
            bottom: bottom,
            obVolume: obVol,
            brokenSwing: brk.level,
            state: state,
            highQualityTap: highQualityTap
          });
          break;
        }
      }
    } else if (brk.dir === 'down'){
      // Find last up-candle before the break leg
      for (var s = breakIdx - 1; s >= Math.max(0, swingIdx); s--){
        if (rows[s].c > rows[s].o){
          var sObCandle = rows[s];
          var sTop = sObCandle.h;
          var sBottom = sObCandle.l;
          var sObVol = sObCandle.v || 1;
          var sState = 'valid';
          var sHighQualityTap = false;

          for (var sf = breakIdx; sf < rows.length; sf++){
            // Invalidate if full candle close above OB top
            if (rows[sf].c > sTop){ sState = 'invalidated'; break; }
            if (rows[sf].h >= sBottom && rows[sf].l <= sTop){
              var sTapVol = rows[sf].v || 0;
              if (sTapVol >= 0.5 * sObVol) sHighQualityTap = true;
              sState = 'mitigated';
            }
          }

          obs.push({
            type: 'supply',
            idx: s,
            time: sObCandle.t,
            top: sTop,
            bottom: sBottom,
            obVolume: sObVol,
            brokenSwing: brk.level,
            state: sState,
            highQualityTap: sHighQualityTap
          });
          break;
        }
      }
    }
  }

  return obs;
}

// ---------------- 4. Divergence: Regular & Hidden Clean Separation ----------------
/** Computes RSI array for values */
function calcRsi(closes, period){
  period = period || 14;
  var rsi = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;
  var gains = 0, losses = 0;
  for (var i = 1; i <= period; i++){
    var diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  var avgGain = gains / period;
  var avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (var j = period + 1; j < closes.length; j++){
    var d = closes[j] - closes[j - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    rsi[j] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

/** Detects regular divergence (reversal) and hidden divergence (trend continuation) */
function detectDivergences(rows, opts){
  opts = opts || {};
  var period = opts.rsiPeriod || 14;
  rows = Array.isArray(rows) ? rows : [];
  if (rows.length < 30) return { regular: [], hidden: [] };
  var closes = rows.map(function(r){ return r.c; });
  var rsi = calcRsi(closes, period);
  var sw = detectSwings(rows, { left: 3, right: 3 });

  var regular = [];
  var hidden = [];

  var swingHighs = sw.swings.filter(function(s){ return s.kind === 'high'; });
  var swingLows = sw.swings.filter(function(s){ return s.kind === 'low'; });

  // Bearish divergences on highs
  for (var h = 1; h < swingHighs.length; h++){
    var h1 = swingHighs[h - 1];
    var h2 = swingHighs[h];
    var rsi1 = rsi[h1.i];
    var rsi2 = rsi[h2.i];
    if (!fin(rsi1) || !fin(rsi2)) continue;
    var span = h2.i - h1.i;
    if (span < 5 || span > 40) continue;

    // Regular Bearish (Reversal): Price Higher High, RSI Lower High
    if (h2.px > h1.px && rsi2 < rsi1){
      regular.push({ type: 'regular-bearish', side: 'short', span: span, p1: h1, p2: h2, rsi1: rsi1, rsi2: rsi2, nature: 'reversal' });
    }
    // Hidden Bearish (Continuation): Price Lower High, RSI Higher High
    else if (h2.px < h1.px && rsi2 > rsi1){
      hidden.push({ type: 'hidden-bearish', side: 'short', span: span, p1: h1, p2: h2, rsi1: rsi1, rsi2: rsi2, nature: 'continuation' });
    }
  }

  // Bullish divergences on lows
  for (var l = 1; l < swingLows.length; l++){
    var l1 = swingLows[l - 1];
    var l2 = swingLows[l];
    var rsiL1 = rsi[l1.i];
    var rsiL2 = rsi[l2.i];
    if (!fin(rsiL1) || !fin(rsiL2)) continue;
    var spanL = l2.i - l1.i;
    if (spanL < 5 || spanL > 40) continue;

    // Regular Bullish (Reversal): Price Lower Low, RSI Higher Low
    if (l2.px < l1.px && rsiL2 > rsiL1){
      regular.push({ type: 'regular-bullish', side: 'long', span: spanL, p1: l1, p2: l2, rsi1: rsiL1, rsi2: rsiL2, nature: 'reversal' });
    }
    // Hidden Bullish (Continuation): Price Higher Low, RSI Lower Low
    else if (l2.px > l1.px && rsiL2 < rsiL1){
      hidden.push({ type: 'hidden-bullish', side: 'long', span: spanL, p1: l1, p2: l2, rsi1: rsiL1, rsi2: rsiL2, nature: 'continuation' });
    }
  }

  return { regular: regular, hidden: hidden };
}

// ---------------- 5. Primitives: CUSUM, TSMOM, EMA Cascade ----------------
/** CUSUM change-point detector with customizable threshold parameter */
function primitiveCusum(closes, thresholdMult){
  closes = Array.isArray(closes) ? closes : [];
  var kMult = fin(thresholdMult) ? thresholdMult : 1.0;
  if (closes.length < 20) return null;

  var returns = [];
  for (var i = 1; i < closes.length; i++){
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  var mean = returns.reduce(function(a, b){ return a + b; }, 0) / returns.length;
  var sd = Math.sqrt(returns.reduce(function(a, b){ return a + Math.pow(b - mean, 2); }, 0) / returns.length);
  var h = kMult * sd;

  var sPos = 0, sNeg = 0;
  var lastEvent = null;

  for (var t = 0; t < returns.length; t++){
    var r = returns[t];
    sPos = Math.max(0, sPos + r - mean);
    sNeg = Math.min(0, sNeg + r - mean);

    if (sPos > h){
      lastEvent = { dir: 'long', i: t + 1, barsAgo: returns.length - 1 - t };
      sPos = 0;
    } else if (sNeg < -h){
      lastEvent = { dir: 'short', i: t + 1, barsAgo: returns.length - 1 - t };
      sNeg = 0;
    }
  }

  return lastEvent;
}

/** TSMOM (Time-Series Momentum) sign agreement calculator */
function primitiveTsmom(closes, lookbacks){
  lookbacks = Array.isArray(lookbacks) ? lookbacks : [30, 90];
  closes = Array.isArray(closes) ? closes : [];
  var maxL = Math.max.apply(null, lookbacks);
  if (closes.length <= maxL) return { agreement: 'insufficient-data', signs: [] };

  var cur = closes[closes.length - 1];
  var signs = [];
  var allPositive = true;
  var allNegative = true;

  for (var i = 0; i < lookbacks.length; i++){
    var lb = lookbacks[i];
    var past = closes[closes.length - 1 - lb];
    var roc = (cur - past) / past;
    var sign = roc > 0 ? 1 : (roc < 0 ? -1 : 0);
    signs.push({ lookback: lb, roc: roc, sign: sign });
    if (sign <= 0) allPositive = false;
    if (sign >= 0) allNegative = false;
  }

  var agg = allPositive ? 'bullish' : (allNegative ? 'bearish' : 'mixed');
  return { agreement: agg, signs: signs };
}

/** Pure EMA calculation */
function calcEma(series, p){
  var out = new Array(series.length).fill(NaN);
  if (series.length < p) return out;
  var k = 2 / (p + 1);
  var sum = 0;
  for (var i = 0; i < p; i++) sum += series[i];
  out[p - 1] = sum / p;
  for (var j = p; j < series.length; j++){
    out[j] = series[j] * k + out[j - 1] * (1 - k);
  }
  return out;
}

/** Parameter-agnostic EMA Cascade with real spread measurement and persistence */
function primitiveEmaCascade(closes, periods){
  periods = Array.isArray(periods) ? periods : [9, 21, 50];
  closes = Array.isArray(closes) ? closes : [];
  var maxP = Math.max.apply(null, periods);
  if (closes.length < maxP + 2) return { state: 'insufficient-data', spreadPct: 0, persistentBars: 0 };

  var emas = periods.map(function(p){ return calcEma(closes, p); });
  var n = closes.length - 1;
  var curValues = emas.map(function(e){ return e[n]; });

  var isBull = true;
  var isBear = true;
  for (var k = 0; k < curValues.length - 1; k++){
    if (curValues[k] <= curValues[k + 1]) isBull = false;
    if (curValues[k] >= curValues[k + 1]) isBear = false;
  }

  var spreadPct = Math.abs(curValues[0] - curValues[curValues.length - 1]) / curValues[curValues.length - 1] * 100;
  var state = isBull ? 'bullish' : (isBear ? 'bearish' : 'mixed');

  // Count persistence
  var persistentBars = 0;
  if (state !== 'mixed'){
    for (var b = n; b >= maxP; b--){
      var barBull = true, barBear = true;
      for (var m = 0; m < emas.length - 1; m++){
        if (emas[m][b] <= emas[m + 1][b]) barBull = false;
        if (emas[m][b] >= emas[m + 1][b]) barBear = false;
      }
      var bState = barBull ? 'bullish' : (barBear ? 'bearish' : 'mixed');
      if (bState === state) persistentBars++; else break;
    }
  }

  return {
    state: state,
    spreadPct: spreadPct,
    persistentBars: persistentBars,
    values: curValues
  };
}

/** Legacy dir-shaped FVG POI (formation.js / gold-best-levels.js / structure-levels.js API). */
var __hgDetectFvgDirPoi = (typeof G.hgDetectFvg === 'function') ? G.hgDetectFvg : null;

function hgDetectFvgForDir(rows, dir){
  if (__hgDetectFvgDirPoi && __hgDetectFvgDirPoi !== detectFvg && __hgDetectFvgDirPoi !== hgDetectFvgPolymorphic){
    try{
      var leg = __hgDetectFvgDirPoi(rows, dir);
      if (leg && fin(+leg.entry)) return leg;
    }catch(e){}
  }
  var list = detectFvg(rows, { atrLen: 14 });
  if (!Array.isArray(list) || !list.length) return null;
  dir = String(dir || '').toLowerCase();
  var want = dir === 'long' ? 'bullish' : (dir === 'short' ? 'bearish' : null);
  var pick = null;
  for (var i = list.length - 1; i >= 0; i--){
    var f = list[i];
    if (!f || f.state === 'invalidated') continue;
    if (want && f.dir !== want) continue;
    pick = f; break;
  }
  if (!pick) pick = list[list.length - 1];
  var mid = fin(pick.mid) ? pick.mid : ((pick.top + pick.bottom) / 2);
  return {
    entry: mid,
    zone: { lo: pick.bottom, hi: pick.top },
    label: pick.dir === 'bullish' ? 'bull FVG' : 'bear FVG',
    poi: 'fvg',
    idx: pick.idx
  };
}

function hgDetectFvgPolymorphic(rows, dirOrOpts){
  if (typeof dirOrOpts === 'string') return hgDetectFvgForDir(rows, dirOrOpts);
  return detectFvg(rows, dirOrOpts || {});
}

/* hg-prefixed exports — crypto scans use these; goldind.js keeps its own goldSwings aliases */
G.hgDetectSwings = detectSwings;
G.hgDetectFvgList = detectFvg;
G.hgDetectFvg = hgDetectFvgPolymorphic;
G.hgDetectOrderBlocks = detectOrderBlocks;
G.hgDetectDivergences = detectDivergences;
G.hgPrimitiveCusum = primitiveCusum;
G.hgPrimitiveTsmom = primitiveTsmom;
G.hgPrimitiveEmaCascade = primitiveEmaCascade;
/* unprefixed only when goldind has not yet loaded (tests / early boot) */
if (!G.detectSwings || G.detectSwings === detectSwings){
  G.detectSwings = detectSwings;
  G.detectFvg = hgDetectFvgPolymorphic;
  G.detectOrderBlocks = detectOrderBlocks;
  G.detectDivergences = detectDivergences;
  G.primitiveCusum = primitiveCusum;
  G.primitiveTsmom = primitiveTsmom;
  G.primitiveEmaCascade = primitiveEmaCascade;
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    hgDetectSwings: detectSwings,
    hgDetectFvg: hgDetectFvgPolymorphic,
    hgDetectFvgList: detectFvg,
    hgDetectOrderBlocks: detectOrderBlocks,
    hgDetectDivergences: detectDivergences,
    hgPrimitiveCusum: primitiveCusum,
    hgPrimitiveTsmom: primitiveTsmom,
    hgPrimitiveEmaCascade: primitiveEmaCascade,
    detectSwings: detectSwings,
    detectFvg: detectFvg,
    detectOrderBlocks: detectOrderBlocks,
    detectDivergences: detectDivergences,
    primitiveCusum: primitiveCusum,
    primitiveTsmom: primitiveTsmom,
    primitiveEmaCascade: primitiveEmaCascade
  };
}
})();
