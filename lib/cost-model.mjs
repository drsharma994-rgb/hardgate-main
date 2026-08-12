/* HARDGATE — liquidity-aware cost model (pure). */

export const HG_FEE_BPS_DELTA = 5;
export const HG_FEE_BPS_BINANCE = 4;
export const HG_FEE_BPS_COINDCX = 5;
export const HG_SLIP_DEGRADED_BPS = 5;
export const HG_COST_IMPACT_K = 0.35;
export const HG_COST_SLIP_CEIL_BPS = 250;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function feeForVenue(venue){
  var v = String(venue || 'delta').toLowerCase();
  if (v.indexOf('binance') >= 0) return HG_FEE_BPS_BINANCE;
  if (v.indexOf('coindcx') >= 0) return HG_FEE_BPS_COINDCX;
  return HG_FEE_BPS_DELTA;
}

export function hgCostBps(input){
  input = input || {};
  var spreadBps = fin(input.spreadBps);
  var depthUsd = fin(input.depthUsd);
  var notionalUsd = fin(input.notionalUsd);
  var atrPct = fin(input.atrPct);
  var venue = input.venue || 'delta';
  var feeBps = feeForVenue(venue);
  var degraded = false;
  var note = 'depth-modelled';

  if (notionalUsd === null || !(notionalUsd > 0)) notionalUsd = 1000;

  var halfSpread = (spreadBps !== null && spreadBps >= 0) ? spreadBps / 2 : null;
  var impactBps = null;

  if (depthUsd === null || !(depthUsd > 0)){
    degraded = true;
    note = 'depth unavailable — ATR proxy';
    var atr = (atrPct !== null && atrPct > 0) ? atrPct : 2;
    impactBps = Math.min(HG_COST_SLIP_CEIL_BPS, HG_COST_IMPACT_K * Math.sqrt(notionalUsd / 50000) * 100 * (atr / 2));
    if (halfSpread === null) halfSpread = Math.max(2, atr * 3);
  } else {
    impactBps = HG_COST_IMPACT_K * Math.sqrt(notionalUsd / Math.max(depthUsd, 1)) * 100;
    if (halfSpread === null) halfSpread = 2;
  }

  var slipBps = Math.min(HG_COST_SLIP_CEIL_BPS, Math.max(halfSpread, impactBps));
  if (degraded && depthUsd === null) slipBps = Math.max(slipBps, HG_SLIP_DEGRADED_BPS);

  var roundTripBps = (feeBps + slipBps) * 2;
  return { feeBps: feeBps, slipBps: slipBps, roundTripBps: roundTripBps, note: note, degraded: degraded };
}

export function hgCostVeto(input){
  input = input || {};
  var roundTripBps = fin(input.roundTripBps);
  var entry = fin(input.entry);
  var stop = fin(input.stop);
  if (roundTripBps === null || entry === null || stop === null || !(entry > 0)){
    return { veto: false, costFrac: null, rDistBps: null, reason: 'cost inputs incomplete' };
  }
  var rDistBps = Math.abs(entry - stop) / entry * 10000;
  if (!(rDistBps > 0)){
    return { veto: false, costFrac: null, rDistBps: rDistBps, reason: 'zero R distance' };
  }
  var costFrac = roundTripBps / rDistBps;
  var veto = costFrac > 0.15;
  var reason = 'cost ' + Math.round(roundTripBps) + ' bps = ' + Math.round(costFrac * 100) + '% of a ' + Math.round(rDistBps) + ' bps R';
  if (veto) reason = 'VETO — ' + reason;
  return { veto: veto, costFrac: costFrac, rDistBps: rDistBps, reason: reason };
}
