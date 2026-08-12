/* HARDGATE — bet sizing from meta-label probability (AFML ch.10). Pure. */

export const HG_META_FLOOR_REF = 0.52;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** Abramowitz-Stegun rational approximation for standard normal CDF. */
export function cdfNorm(z){
  if (!isFinite(z)) return null;
  var t = 1 / (1 + 0.2316419 * Math.abs(z));
  var d = 0.3989423 * Math.exp(-z * z / 2);
  var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - p : p;
}

/**
 * Map calibrated probability to suggested R fraction (never above maxR).
 * @returns {{ sizeR:number, z:number|null, capped:boolean, reason:string }}
 */
export function hgBetSize(input){
  input = input || {};
  var prob = fin(input.prob);
  var floor = fin(input.floor);
  if (floor === null) floor = HG_META_FLOOR_REF;
  var maxR = fin(input.maxR);
  if (maxR === null || maxR <= 0) maxR = 1.0;
  maxR = Math.min(maxR, 1.0);

  if (prob === null || prob <= 0 || prob >= 1){
    return { sizeR: 0, z: null, capped: false, reason: 'probability missing or degenerate' };
  }
  if (prob < floor){
    return { sizeR: 0, z: null, capped: false, reason: 'below meta floor ' + floor.toFixed(2) };
  }
  var z = (prob - 0.5) / Math.sqrt(prob * (1 - prob));
  var raw = 2 * cdfNorm(z) - 1;
  if (!isFinite(raw) || raw < 0) raw = 0;
  var sizeR = Math.min(maxR, raw * maxR);
  var capped = raw > maxR;
  return {
    sizeR: Math.round(sizeR * 1000) / 1000,
    z: Math.round(z * 1000) / 1000,
    capped: capped,
    reason: capped ? 'capped at maxR=' + maxR : 'suggested from meta p=' + prob.toFixed(2),
  };
}
