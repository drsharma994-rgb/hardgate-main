/* HARDGATE — Engle–Granger cointegration desk (textbook; Arbitragelab concept). Pure. */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function mean(a){
  if (!a.length) return 0;
  var s = 0;
  for (var i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function ols(y, x){
  var n = Math.min(y.length, x.length);
  if (n < 5) return null;
  var mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  var num = 0, den = 0;
  for (var i = 0; i < n; i++){
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) * (x[i] - mx);
  }
  if (!(den > 0)) return null;
  var beta = num / den;
  var alpha = my - beta * mx;
  return { alpha: alpha, beta: beta, n: n };
}

function spreadSeries(a, b, fit){
  var out = [];
  for (var i = 0; i < fit.n; i++){
    out.push(a[i] - fit.beta * b[i] - fit.alpha);
  }
  return out;
}

function adfStat(spread){
  var n = spread.length;
  if (n < 20) return null;
  var dy = [], lag = [];
  for (var i = 1; i < n; i++){
    dy.push(spread[i] - spread[i - 1]);
    lag.push(spread[i - 1]);
  }
  var mY = mean(dy), mX = mean(lag);
  var num = 0, den = 0;
  for (var j = 0; j < dy.length; j++){
    num += (lag[j] - mX) * (dy[j] - mY);
    den += (lag[j] - mX) * (lag[j] - mX);
  }
  if (!(den > 0)) return null;
  var b = num / den;
  var resid = 0;
  for (var k = 0; k < dy.length; k++){
    var e = dy[k] - (mY + b * (lag[k] - mX));
    resid += e * e;
  }
  var se = Math.sqrt(resid / Math.max(1, dy.length - 2) / den);
  return se > 0 ? b / se : null;
}

function halfLifeBars(spread){
  var y = [], x = [];
  for (var i = 1; i < spread.length; i++){
    y.push(spread[i]);
    x.push(spread[i - 1]);
  }
  var fit = ols(y, x);
  if (!fit) return null;
  var phi = fit.beta;
  if (!(phi > 0 && phi < 1)) return null;
  return -Math.log(2) / Math.log(phi);
}

function spreadZ(spread){
  var m = mean(spread);
  var v = 0;
  for (var i = 0; i < spread.length; i++) v += (spread[i] - m) * (spread[i] - m);
  var sd = Math.sqrt(v / spread.length);
  if (!(sd > 0)) return null;
  return (spread[spread.length - 1] - m) / sd;
}

/** Engle–Granger cointegration test on aligned price series. */
export function hgCoint(seriesA, seriesB){
  var a = (Array.isArray(seriesA) ? seriesA : []).map(Number).filter(function(x){ return isFinite(x); });
  var b = (Array.isArray(seriesB) ? seriesB : []).map(Number).filter(function(x){ return isFinite(x); });
  var n = Math.min(a.length, b.length);
  if (n < 120) return null;
  a = a.slice(-n);
  b = b.slice(-n);
  var fit = ols(a, b);
  if (!fit) return null;
  var spread = spreadSeries(a, b, fit);
  var adf = adfStat(spread);
  var hl = halfLifeBars(spread);
  var z = spreadZ(spread);
  var adfCrit = -2.86;
  var cointegrated = adf !== null && adf <= adfCrit && hl !== null && isFinite(hl) && hl > 0 && hl < 500;
  return {
    beta: fit.beta,
    alpha: fit.alpha,
    adfStat: adf,
    halfLifeBars: hl,
    spreadZ: z,
    cointegrated: cointegrated,
    n: n,
    note: cointegrated
      ? 'cointegrated · HL ' + Math.round(hl) + ' bars · z ' + (z != null ? z.toFixed(2) : '—')
      : 'not cointegrated · ADF ' + (adf != null ? adf.toFixed(2) : '—'),
  };
}

/** Veto CONTEXT chip when half-life exceeds setup time barrier. */
export function hgCointHalfLifeVeto(coint, timeBarrierBars){
  timeBarrierBars = fin(timeBarrierBars);
  if (!coint || !coint.cointegrated) return { veto: true, reason: 'not cointegrated' };
  var hl = fin(coint.halfLifeBars);
  if (hl === null || !(hl > 0)) return { veto: true, reason: 'half-life unavailable' };
  if (timeBarrierBars !== null && hl > timeBarrierBars){
    return {
      veto: true,
      reason: 'half-life ' + Math.round(hl) + ' bars exceeds time barrier ' + Math.round(timeBarrierBars),
    };
  }
  return { veto: false, reason: 'half-life ' + Math.round(hl) + ' bars tradeable' };
}
