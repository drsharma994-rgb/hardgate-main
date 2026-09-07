/* HARDGATE — Deribit options-derived vol/skew/gamma (pure). */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

export function deribitDvolSlope(dvol, dvolPrev){
  var now = fin(dvol), prev = fin(dvolPrev);
  if (now === null || prev === null) return { slope: null, stamp: 'NA', score: 0 };
  var chg = now - prev;
  if (chg > 2) return { slope: 'RISING', chg: chg, stamp: 'BEAR', score: -1, note: 'DVOL rising — expansion risk' };
  if (chg < -2) return { slope: 'FALLING', chg: chg, stamp: 'BULL', score: 1, note: 'DVOL falling — vol compressing' };
  return { slope: 'FLAT', chg: chg, stamp: 'NA', score: 0, note: 'DVOL flat' };
}

/** 25-delta risk reversal = call IV − put IV (percent points). */
export function deribitRiskReversal(callIv, putIv){
  var c = fin(callIv), p = fin(putIv);
  if (c === null || p === null) return null;
  var rr = c - p;
  var extreme = Math.abs(rr) >= 8;
  var bias = rr > 0 ? 'CALLS RICH' : (rr < 0 ? 'PUTS RICH' : 'NEUTRAL');
  return { rr25d: rr, callIv: c, putIv: p, extreme: extreme, bias: bias };
}

/** Find nearest gamma flip from strike-level net gamma map. */
export function deribitGammaFlip(gammaByStrike, spot){
  spot = fin(spot);
  if (!gammaByStrike || spot === null) return null;
  var keys = Object.keys(gammaByStrike).map(Number).filter(isFinite).sort(function(a, b){ return a - b; });
  if (keys.length < 2) return null;
  var best = null, bestD = Infinity;
  for (var i = 1; i < keys.length; i++){
    var k0 = keys[i - 1], k1 = keys[i];
    var g0 = fin(gammaByStrike[k0]), g1 = fin(gammaByStrike[k1]);
    if (g0 === null || g1 === null) continue;
    if (g0 * g1 < 0 || (g0 <= 0 && g1 >= 0)){
      var flip = k0 + (k1 - k0) * (Math.abs(g0) / (Math.abs(g0) + Math.abs(g1) || 1));
      var d = Math.abs(flip - spot) / spot;
      if (d < bestD){ bestD = d; best = flip; }
    }
  }
  if (best === null) return null;
  return {
    level: best,
    distPct: bestD * 100,
    nearFlip: bestD <= 0.01,
    note: 'gamma flip ~' + best.toFixed(0) + ' (' + (bestD * 100).toFixed(2) + '% from spot)',
  };
}
