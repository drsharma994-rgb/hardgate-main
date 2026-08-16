/* =========================================================================
HARDGATE — spot-perp.js
Spot vs perp taker-flow divergence (Binance spot klines vs fapi taker ratio).
Pure assessors for flowTrapAssess / BEST F8 / EDGE. Never throws.
========================================================================= */
'use strict';

/** Mean buy/sell ratio over the last `n` bars — same shape as cvdAssess input. */
function __spMeanRatio(series, n){
  try{
    if (!Array.isArray(series) || series.length < n) return NaN;
    var sum = 0, c = 0, i;
    for (i = series.length - n; i < series.length; i++){
      var r = +series[i].buySellRatio;
      if (isFinite(r) && r > 0){ sum += r; c++; }
    }
    return c ? sum / c : NaN;
  }catch(e){ return NaN; }
}

/**
 * Spot vs perp CVD divergence — perp may show crowd flow while spot disagrees.
 * @returns {{ diverged, trap, confirms, reason, perpRatio, spotRatio }}
 */
function spotPerpDivergence(perpSeries, spotSeries){
  var out = { diverged: false, trap: false, confirms: false, reason: '',
              perpRatio: NaN, spotRatio: NaN };
  try{
    if (!Array.isArray(perpSeries) || !Array.isArray(spotSeries)) return out;
    if (perpSeries.length < 8 || spotSeries.length < 8) return out;
    var pr = __spMeanRatio(perpSeries, 8);
    var sr = __spMeanRatio(spotSeries, 8);
    out.perpRatio = pr;
    out.spotRatio = sr;
    if (!isFinite(pr) || !isFinite(sr)) return out;

    /* perp long crowd + spot selling = long trap */
    if (pr >= 1.12 && sr <= 0.92){
      out.diverged = true;
      out.trap = true;
      out.reason = 'SPOT-PERP TRAP: Perp takers long but spot selling (perp '
        + pr.toFixed(2) + ' vs spot ' + sr.toFixed(2) + ')';
      return out;
    }
    /* perp short crowd + spot buying = short trap */
    if (pr <= 0.88 && sr >= 1.08){
      out.diverged = true;
      out.trap = true;
      out.reason = 'SPOT-PERP TRAP: Perp takers short but spot buying (perp '
        + pr.toFixed(2) + ' vs spot ' + sr.toFixed(2) + ')';
      return out;
    }
    /* both legs agree with directional bias bands */
    if (pr >= 1.05 && sr >= 1.03){
      out.confirms = true;
      out.reason = 'spot+perp taker flow aligned longish';
    } else if (pr <= 0.95 && sr <= 0.97){
      out.confirms = true;
      out.reason = 'spot+perp taker flow aligned shortish';
    } else if (Math.abs(pr - sr) >= 0.15){
      out.diverged = true;
      out.reason = 'spot-perp flow mismatch (perp ' + pr.toFixed(2) + ' · spot ' + sr.toFixed(2) + ')';
    }
    return out;
  }catch(e){ return out; }
}

/** Directional trap read for flowTrapAssess — extends CVD with spot leg. */
function spotPerpFlowAssess(perpSeries, spotSeries, dir){
  try{
    var base = { veto: false, reason: '', spotPerpAligned: false, diverged: false };
    if (dir !== 'long' && dir !== 'short') return base;
    var sp = spotPerpDivergence(perpSeries, spotSeries);
    base.diverged = sp.diverged;
    if (sp.trap){
      if (dir === 'long' && sp.perpRatio >= 1.12 && sp.spotRatio <= 0.92){
        base.veto = true;
        base.reason = sp.reason;
      } else if (dir === 'short' && sp.perpRatio <= 0.88 && sp.spotRatio >= 1.08){
        base.veto = true;
        base.reason = sp.reason;
      }
    }
    if (!base.veto && sp.confirms){
      if ((dir === 'long' && sp.perpRatio >= 1.05 && sp.spotRatio >= 1.03)
          || (dir === 'short' && sp.perpRatio <= 0.95 && sp.spotRatio <= 0.97)){
        base.spotPerpAligned = true;
      }
    }
    return base;
  }catch(e){
    return { veto: false, unchecked: true, reason: '', spotPerpAligned: false, diverged: false };
  }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.spotPerpDivergence = spotPerpDivergence;
W.spotPerpFlowAssess = spotPerpFlowAssess;
