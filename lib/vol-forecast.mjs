/* HARDGATE — EWMA + GARCH-lite volatility forecast (RiskMetrics; Bollerslev 1986). Pure. */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function logReturns(closes){
  var out = [];
  var arr = Array.isArray(closes) ? closes : [];
  for (var i = 1; i < arr.length; i++){
    var a = fin(arr[i - 1]), b = fin(arr[i]);
    if (a === null || b === null || !(a > 0) || !(b > 0)) continue;
    out.push(Math.log(b / a));
  }
  return out;
}

function sampleVar(xs){
  if (!xs.length) return null;
  var mean = 0;
  for (var i = 0; i < xs.length; i++) mean += xs[i];
  mean /= xs.length;
  var v = 0;
  for (var j = 0; j < xs.length; j++) v += (xs[j] - mean) * (xs[j] - mean);
  return v / xs.length;
}

/** RiskMetrics EWMA variance recursion. */
export function hgEwmaVol(returns, lambda){
  lambda = (lambda > 0 && lambda < 1) ? lambda : 0.94;
  var rs = (Array.isArray(returns) ? returns : []).map(Number).filter(function(r){ return isFinite(r); });
  var n = rs.length;
  if (n < 30) return null;
  var seedN = Math.min(20, n);
  var varT = sampleVar(rs.slice(0, seedN));
  if (varT === null || !(varT > 0)) varT = rs[0] * rs[0];
  for (var i = seedN; i < n; i++){
    varT = lambda * varT + (1 - lambda) * rs[i - 1] * rs[i - 1];
  }
  return { sigma: Math.sqrt(varT), n: n, lambda: lambda };
}

/** GARCH(1,1) via moment-matched grid — browser-safe, no MLE. */
export function hgGarchLite(returns, cfg){
  cfg = cfg || {};
  var rs = (Array.isArray(returns) ? returns : []).map(Number).filter(function(r){ return isFinite(r); });
  var n = rs.length;
  if (n < 30) return null;
  var ew = hgEwmaVol(rs, cfg.lambda || 0.94);
  if (!ew) return null;
  var longRun = sampleVar(rs);
  if (!(longRun > 0)) longRun = ew.sigma * ew.sigma;

  var best = null;
  var alphas = [0.05, 0.08, 0.1, 0.12, 0.15];
  var betas = [0.75, 0.82, 0.88, 0.9, 0.92];
  for (var ai = 0; ai < alphas.length; ai++){
    for (var bi = 0; bi < betas.length; bi++){
      var alpha = alphas[ai], beta = betas[bi];
      if (alpha + beta >= 0.999) continue;
      var omega = longRun * (1 - alpha - beta);
      if (!(omega > 0)) continue;
      var varT = ew.sigma * ew.sigma;
      for (var i = 1; i < n; i++){
        varT = omega + alpha * rs[i - 1] * rs[i - 1] + beta * varT;
      }
      if (!best || varT < best.varT) best = { alpha: alpha, beta: beta, omega: omega, varT: varT };
    }
  }
  if (!best){
    return {
      sigma: ew.sigma, omega: null, alpha: null, beta: null,
      persistence: null, converged: false, note: 'grid failed — EWMA fallback',
    };
  }
  var persistence = best.alpha + best.beta;
  var converged = persistence < 0.999 && best.varT > 0;
  return {
    sigma: Math.sqrt(best.varT),
    omega: best.omega,
    alpha: best.alpha,
    beta: best.beta,
    persistence: persistence,
    converged: converged,
    note: converged ? 'GARCH(1,1) grid fit' : 'unstable fit — use EWMA',
  };
}

export function hgVolFromCloses(closes, cfg){
  cfg = cfg || {};
  var rs = logReturns(closes);
  var g = hgGarchLite(rs, cfg);
  var ew = hgEwmaVol(rs, cfg.lambda);
  if (!ew) return null;
  var useG = g && g.converged;
  return {
    returns: rs,
    ewma: ew,
    garch: g,
    sigmaNow: ew.sigma,
    sigmaForecast: useG ? g.sigma : ew.sigma,
    sigmaLongRun: Math.sqrt(sampleVar(rs) || ew.sigma * ew.sigma),
    source: useG ? 'garch' : 'ewma',
  };
}

/** @returns {{ regime:string, ratio:number, note:string }} */
export function hgVolRegime(input){
  input = input || {};
  var sigmaNow = fin(input.sigmaNow);
  var sigmaForecast = fin(input.sigmaForecast);
  var sigmaLongRun = fin(input.sigmaLongRun);
  var ratioThresh = fin(input.ratioThresh);
  if (ratioThresh === null) ratioThresh = 1.15;
  if (sigmaNow === null || sigmaForecast === null || !(sigmaNow > 0)){
    return { regime: 'VOL NORMAL', ratio: null, note: 'insufficient vol inputs' };
  }
  var ratio = sigmaForecast / sigmaNow;
  var lr = (sigmaLongRun > 0) ? sigmaForecast / sigmaLongRun : null;
  var regime = 'VOL NORMAL';
  if (ratio >= ratioThresh || (lr !== null && lr >= ratioThresh)){
    regime = 'VOL EXPANDING';
  } else if (ratio <= (1 / ratioThresh) || (lr !== null && lr <= (1 / ratioThresh))){
    regime = 'VOL CONTRACTING';
  }
  return {
    regime: regime,
    ratio: Math.round(ratio * 1000) / 1000,
    longRunRatio: lr !== null ? Math.round(lr * 1000) / 1000 : null,
    note: regime + ' · forecast/now ' + ratio.toFixed(2) + 'x',
  };
}

/** Stop distance in forecast-sigma units (CONTEXT chip helper). */
export function hgStopVolChip(entry, stop, volPack){
  try{
    if (!volPack || !isFinite(+entry) || !isFinite(+stop)) return null;
    var sigma = fin(volPack.sigmaForecast) || fin(volPack.sigmaNow);
    if (!(sigma > 0) || !(entry > 0)) return null;
    var stopDist = Math.abs(entry - stop) / entry;
    var sigmas = stopDist / sigma;
    var reg = hgVolRegime({
      sigmaNow: volPack.sigmaNow,
      sigmaForecast: volPack.sigmaForecast,
      sigmaLongRun: volPack.sigmaLongRun,
    });
    var tight = sigmas < 1.0;
    return {
      sigmas: Math.round(sigmas * 100) / 100,
      tight: tight,
      chip: (tight ? 'STOP TIGHT — ' : 'STOP OK — ')
        + sigmas.toFixed(1) + ' sigma forecast'
        + (reg.ratio !== null ? ' (' + reg.regime.toLowerCase().replace('vol ', '') + ' ' + reg.ratio + 'x)' : ''),
      regime: reg.regime,
    };
  }catch(e){ return null; }
}
