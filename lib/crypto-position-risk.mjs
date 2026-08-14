/**
 * HARDGATE — crypto position risk engine (Pack 18).
 * Risk-first sizing: qty = risk$ / stopDist; leverage is derived, not chosen.
 * Pure — never throws. Browser bridge: crypto-position-risk.js
 */

export const HG_CRYPTO_MMR_DEFAULT = 0.005;
export const HG_CRYPTO_LIQ_CLEARANCE_MIN = 1.5;
export const HG_FEE_TAKER_PCT = 0.05;
export const HG_FEE_MAKER_PCT = 0.02;
export const HG_FEE_GST_MULT = 1.18;
export const HG_NET_R_FLOOR = 1.5;
export const HG_INDIA_VDA_TAX_RATE = 0.30;
export const HG_INDIA_VDA_CESS = 0.04;
export const HG_INDIA_TDS_RATE = 0.01;
export const HG_FUNDING_8H_DEFAULT = 0.0001;

function num(v){
  var n = (typeof v === 'number') ? v : parseFloat(v);
  return (v === undefined || v === null || v === '' || !isFinite(n)) ? null : n;
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function normDir(d){
  var s = String(d || 'long').toLowerCase();
  return s === 'short' || s === 'sell' || s === 'bear' ? 'short' : 'long';
}

/** Funding drag in R for a hold across 8h settlement periods (notional-weighted). */
export function hgCryptoFundingCostR(notionalUSD, riskAmountUSD, holdHours, fundingRate8h){
  var n = num(notionalUSD), risk = num(riskAmountUSD);
  var hrs = num(holdHours);
  var rate = num(fundingRate8h) != null ? num(fundingRate8h) : HG_FUNDING_8H_DEFAULT;
  if (n === null || risk === null || !(risk > 0) || hrs === null || !(hrs > 0)) return 0;
  var periods = hrs / 8;
  var costUsd = n * rate * periods;
  return costUsd / risk;
}

/** Approximate India VDA tax + TDS drag on a winning T1 in R (profit tax + 1% TDS on exit notional). */
export function hgCryptoIndiaTaxDragR(grossR, costR, entry, stop, notionalUSD, riskAmountUSD, opts){
  opts = opts || {};
  if (!opts.indiaTax) return 0;
  grossR = num(grossR);
  costR = num(costR) || 0;
  var risk = num(riskAmountUSD);
  var notional = num(notionalUSD);
  if (grossR === null || risk === null || !(risk > 0)) return 0;
  var netWinR = grossR - costR;
  if (!(netWinR > 0)) return 0;
  var taxRate = num(opts.indiaTaxRate) != null ? num(opts.indiaTaxRate) : HG_INDIA_VDA_TAX_RATE;
  var cess = num(opts.indiaCess) != null ? num(opts.indiaCess) : HG_INDIA_VDA_CESS;
  var tds = num(opts.indiaTds) != null ? num(opts.indiaTds) : HG_INDIA_TDS_RATE;
  var profitUsd = netWinR * risk;
  var taxUsd = profitUsd * (taxRate + cess);
  var tdsUsd = notional != null ? notional * tds : 0;
  return (taxUsd + tdsUsd) / risk;
}

export function hgCryptoRoundTripPct(entrySide, exitSide, feeRates){
  feeRates = feeRates || {};
  var taker = num(feeRates.taker) != null ? feeRates.taker : HG_FEE_TAKER_PCT;
  var maker = num(feeRates.maker) != null ? feeRates.maker : HG_FEE_MAKER_PCT;
  var gst = num(feeRates.gst) != null ? feeRates.gst : HG_FEE_GST_MULT;
  var side = function(s){ return s === 'taker' ? taker : maker; };
  return (side(entrySide || 'maker') + side(exitSide || 'taker')) * gst;
}

export function hgCryptoCostR(entry, stop, entrySide, exitSide, feeRates){
  var e = num(entry), st = num(stop);
  if (e === null || !(e > 0) || st === null) return 0;
  var riskPct = Math.abs(e - st) / e * 100;
  if (!(riskPct > 0)) return 0;
  return hgCryptoRoundTripPct(entrySide, exitSide, feeRates) / riskPct;
}

/** Gross R at T1 minus round-trip cost in R (limit entry, limit TP). */
export function hgCryptoNetRAtTarget(entry, stop, t1, dir, feeRates){
  var e = num(entry), st = num(stop), tp = num(t1);
  if (e === null || st === null || tp === null) return null;
  var risk = Math.abs(e - st);
  if (!(risk > 0)) return null;
  var d = normDir(dir);
  var gross = d === 'long' ? (tp - e) / risk : (e - tp) / risk;
  if (!isFinite(gross)) return null;
  var costR = hgCryptoCostR(e, st, 'maker', 'maker', feeRates);
  return gross - costR;
}

/** Breakeven win rate for target gross R after cost in R. */
export function hgCryptoBreakevenWinRate(grossR, costR){
  grossR = num(grossR);
  costR = num(costR) || 0;
  if (grossR === null || !(grossR > 0)) return null;
  var need = (1 + costR) / (grossR + 1);
  return clamp(need, 0.01, 0.99);
}

/** Max survivable leverage — ceiling only (liquidation ≥ clearance × stop). */
export function hgCryptoMaxSurvivableLev(entry, stop, mmr, clearance){
  var e = num(entry), st = num(stop);
  if (e === null || st === null || !(e > 0) || e === st) return null;
  var sd = Math.abs(e - st) / e;
  var m = num(mmr) != null && num(mmr) > 0 ? num(mmr) : HG_CRYPTO_MMR_DEFAULT;
  var buf = num(clearance) != null && num(clearance) > 0 ? num(clearance) : HG_CRYPTO_LIQ_CLEARANCE_MIN;
  return Math.max(1, Math.min(100, Math.floor(1 / (sd * buf + m))));
}

/** Isolated-margin liq approximation — verify against Delta UI. */
export function hgCryptoLiqPrice(entry, lev, mmr, dir){
  var e = num(entry), lv = num(lev);
  if (e === null || !(e > 0) || lv === null || !(lv >= 1)) return null;
  var m = num(mmr) != null && num(mmr) > 0 ? num(mmr) : HG_CRYPTO_MMR_DEFAULT;
  var d = normDir(dir);
  return d === 'long' ? e * (1 - 1 / lv + m) : e * (1 + 1 / lv - m);
}

export function hgCryptoLiqClearance(entry, stop, liq){
  var e = num(entry), st = num(stop), l = num(liq);
  if (e === null || st === null || l === null) return null;
  var sd = Math.abs(e - st) / e;
  if (!(sd > 0)) return null;
  return Math.abs(e - l) / e / sd;
}

/** Jesse-style risk_to_qty. */
export function hgCryptoFixedRiskSize(balance, riskPct, entry, stop, precision){
  var bal = num(balance), rp = num(riskPct), e = num(entry), st = num(stop);
  if (bal === null || !(bal > 0) || rp === null || !(rp > 0) || e === null || !(e > 0) || st === null){
    return { error: 'Invalid inputs' };
  }
  var riskAmountUSD = bal * (rp / 100);
  var stopDist = Math.abs(e - st);
  if (!(stopDist > 0)) return { error: 'Entry and stop cannot be equal' };
  var qty = riskAmountUSD / stopDist;
  var dp = (num(precision) != null && precision >= 0) ? Math.floor(precision) : 6;
  var factor = Math.pow(10, dp);
  var notional = qty * e;
  var impliedLev = notional / bal;
  return {
    riskAmountUSD: riskAmountUSD,
    stopDistanceUSD: stopDist,
    positionSizeUnits: Math.round(qty * factor) / factor,
    notionalUSD: Math.round(notional * 100) / 100,
    impliedLeverage: Math.round(impliedLev * 1000) / 1000
  };
}

/**
 * Full worksheet for one crypto setup.
 * @param {object} plan — dir, entry, stop, t1, sym, style
 * @param {object} ctx — balance, riskPct, mmr, feeRates, measuredWinRate, netRFloor
 */
export function hgCryptoPositionRisk(plan, ctx){
  ctx = ctx || {};
  plan = plan || {};
  var e = num(plan.entry), st = num(plan.stop), tp = num(plan.t1);
  var bal = num(ctx.balance) != null && num(ctx.balance) > 0 ? num(ctx.balance) : 1000;
  var rp = num(ctx.riskPct) != null && num(ctx.riskPct) > 0 ? num(ctx.riskPct) : 1;
  var dir = normDir(plan.dir);
  var mmr = num(ctx.mmr) != null && num(ctx.mmr) > 0 ? num(ctx.mmr) : HG_CRYPTO_MMR_DEFAULT;
  var feeRates = ctx.feeRates || null;

  if (e === null || st === null || !(e > 0) || e === st){
    return { ok: false, reason: 'invalid entry/stop' };
  }

  var size = hgCryptoFixedRiskSize(bal, rp, e, st, ctx.precision);
  if (size.error) return { ok: false, reason: size.error };

  var ceilingLev = hgCryptoMaxSurvivableLev(e, st, mmr, ctx.clearance);
  var impliedLev = size.impliedLeverage;
  var levForLiq = Math.max(1, Math.min(impliedLev, ceilingLev != null ? ceilingLev : impliedLev));
  var liq = hgCryptoLiqPrice(e, levForLiq, mmr, dir);
  var clearance = liq != null ? hgCryptoLiqClearance(e, st, liq) : null;

  var grossR = tp != null ? (dir === 'long' ? (tp - e) / Math.abs(e - st) : (e - tp) / Math.abs(e - st)) : null;
  var costR = hgCryptoCostR(e, st, 'maker', 'taker', feeRates);
  var netR = tp != null ? hgCryptoNetRAtTarget(e, st, tp, dir, feeRates) : null;

  var holdHours = num(ctx.holdHours);
  var fundingRate8h = num(ctx.fundingRate8h) != null ? num(ctx.fundingRate8h) : HG_FUNDING_8H_DEFAULT;
  var fundingCostR = (holdHours != null && holdHours > 0)
    ? hgCryptoFundingCostR(size.notionalUSD, size.riskAmountUSD, holdHours, fundingRate8h)
    : 0;
  var netRAfterFunding = netR != null ? netR - fundingCostR : null;

  var taxDragR = hgCryptoIndiaTaxDragR(grossR, costR, e, st, size.notionalUSD, size.riskAmountUSD, {
    indiaTax: !!ctx.indiaTax,
    indiaTaxRate: ctx.indiaTaxRate,
    indiaCess: ctx.indiaCess,
    indiaTds: ctx.indiaTds
  });
  var netRAfterTax = netRAfterFunding != null ? netRAfterFunding - taxDragR : null;

  var breakeven = grossR != null ? hgCryptoBreakevenWinRate(grossR, costR + fundingCostR + taxDragR) : null;
  var measured = num(ctx.measuredWinRate);

  var liqPass = clearance != null && clearance >= HG_CRYPTO_LIQ_CLEARANCE_MIN - 0.05;
  var netFloor = num(ctx.netRFloor) != null ? num(ctx.netRFloor) : HG_NET_R_FLOOR;
  var style = String(plan.style || plan.scanner || 'swing').toLowerCase();
  var netPass = netR === null || style === 'swing' ? true : (netR >= netFloor);
  if (style === 'scalp' && netR !== null && netR < netFloor) netPass = false;
  var fundingHoldPass = !(holdHours != null && holdHours > 0 && netRAfterFunding != null && netRAfterFunding < netFloor);
  var indiaTaxPass = !(ctx.indiaTax && netRAfterTax != null && netRAfterTax < netFloor);

  var reasons = [];
  if (!liqPass) reasons.push('Liq clearance ' + (clearance != null ? clearance.toFixed(2) : '?') + '× < ' + HG_CRYPTO_LIQ_CLEARANCE_MIN + '× stop');
  if (!netPass && netR !== null) reasons.push('Net R @ T1 ' + netR.toFixed(2) + ' < ' + netFloor + ' after fees');
  if (!fundingHoldPass){
    reasons.push('Funding hold ' + holdHours + 'h eats net R → ' + (netRAfterFunding != null ? netRAfterFunding.toFixed(2) : '?') + 'R');
  }
  if (!indiaTaxPass){
    reasons.push('India tax/TDS drag → net ' + (netRAfterTax != null ? netRAfterTax.toFixed(2) : '?') + 'R after hold');
  }
  if (ceilingLev != null && impliedLev > ceilingLev + 0.01){
    reasons.push('Implied lev ' + impliedLev.toFixed(1) + 'x > ceiling ' + ceilingLev + 'x — size down or widen stop');
  }

  return {
    ok: liqPass && netPass && fundingHoldPass && indiaTaxPass && !(ceilingLev != null && impliedLev > ceilingLev + 0.01),
    pass: liqPass && netPass && fundingHoldPass && indiaTaxPass,
    dir: dir,
    sym: plan.sym || null,
    balance: bal,
    riskPct: rp,
    riskAmountUSD: size.riskAmountUSD,
    positionSizeUnits: size.positionSizeUnits,
    notionalUSD: size.notionalUSD,
    impliedLeverage: impliedLev,
    ceilingLeverage: ceilingLev,
    liqPrice: liq,
    liqClearance: clearance,
    grossR: grossR != null ? Math.round(grossR * 1000) / 1000 : null,
    costR: Math.round(costR * 10000) / 10000,
    netR: netR != null ? Math.round(netR * 1000) / 1000 : null,
    holdHours: holdHours,
    fundingRate8h: fundingRate8h,
    fundingCostR: Math.round(fundingCostR * 10000) / 10000,
    netRAfterFunding: netRAfterFunding != null ? Math.round(netRAfterFunding * 1000) / 1000 : null,
    indiaTax: !!ctx.indiaTax,
    taxDragR: Math.round(taxDragR * 10000) / 10000,
    netRAfterTax: netRAfterTax != null ? Math.round(netRAfterTax * 1000) / 1000 : null,
    breakevenWinRate: breakeven != null ? Math.round(breakeven * 1000) / 1000 : null,
    measuredWinRate: measured,
    reasons: reasons,
    mmr: mmr
  };
}

export function hgCryptoAttachPositionSize(setup, balance, riskPct, ctx){
  if (!setup || typeof setup !== 'object') return setup;
  var entry = num(setup.entry) != null ? setup.entry
    : (setup.levels && num(setup.levels.entry) != null ? setup.levels.entry : NaN);
  var stop = num(setup.stop) != null ? setup.stop
    : (setup.levels && num(setup.levels.stopLoss) != null ? setup.levels.stopLoss : NaN);
  var plan = {
    dir: setup.dir || setup.side,
    entry: entry,
    stop: stop,
    t1: setup.t1 || setup.tp,
    sym: setup.sym || setup.symbol,
    style: setup.style || setup.scanner
  };
  var risk = hgCryptoPositionRisk(plan, Object.assign({}, ctx || {}, { balance: balance, riskPct: riskPct }));
  if (risk && risk.ok !== false && risk.positionSizeUnits != null){
    setup.positionSize = {
      riskAmountUSD: risk.riskAmountUSD,
      stopDistanceUSD: Math.abs(entry - stop),
      positionSizeUnits: risk.positionSizeUnits,
      notionalValueUSD: risk.notionalUSD,
      impliedLeverage: risk.impliedLeverage,
      ceilingLeverage: risk.ceilingLeverage,
      liqPrice: risk.liqPrice,
      liqClearance: risk.liqClearance,
      netR: risk.netR,
      breakevenWinRate: risk.breakevenWinRate
    };
    setup.positionRisk = risk;
  }
  return setup;
}

export function hgCryptoRiskInlineText(risk){
  if (!risk || risk.ok === false && !risk.impliedLeverage) return '';
  var parts = [];
  if (risk.positionSizeUnits != null) parts.push('qty ' + risk.positionSizeUnits);
  if (risk.impliedLeverage != null) parts.push('implied ' + risk.impliedLeverage.toFixed(1) + 'x');
  if (risk.ceilingLeverage != null) parts.push('ceiling ' + risk.ceilingLeverage + 'x');
  if (risk.liqClearance != null) parts.push('liq ' + risk.liqClearance.toFixed(1) + '× stop');
  if (risk.netR != null) parts.push('net ' + risk.netR.toFixed(2) + 'R');
  if (risk.breakevenWinRate != null){
    var b = Math.round(risk.breakevenWinRate * 100);
    parts.push('need ' + b + '% win');
    if (risk.measuredWinRate != null) parts.push('you ' + Math.round(risk.measuredWinRate * 100) + '%');
  }
  return parts.join(' · ');
}

export function hgCryptoRiskGate(risk){
  if (!risk) return { pass: false, reasons: ['no risk worksheet'] };
  return { pass: !!risk.pass, reasons: risk.reasons || [] };
}
