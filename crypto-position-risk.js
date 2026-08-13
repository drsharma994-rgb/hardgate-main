/* HARDGATE — browser bridge for lib/crypto-position-risk.mjs (Pack 18). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function num(v){
  var n = (typeof v === 'number') ? v : parseFloat(v);
  return (v === undefined || v === null || v === '' || !isFinite(n)) ? null : n;
}

var HG_CRYPTO_MMR_DEFAULT = 0.005;
var HG_CRYPTO_LIQ_CLEARANCE_MIN = 1.5;
var HG_FEE_TAKER_PCT = 0.05;
var HG_FEE_MAKER_PCT = 0.02;
var HG_FEE_GST_MULT = 1.18;
var HG_NET_R_FLOOR = 1.5;

function normDir(d){
  var s = String(d || 'long').toLowerCase();
  return s === 'short' || s === 'sell' || s === 'bear' ? 'short' : 'long';
}

function hgCryptoFeeRates(){
  try{
    if (typeof G.hgFeeRates === 'function') return G.hgFeeRates();
  }catch(e0){}
  return { taker: HG_FEE_TAKER_PCT, maker: HG_FEE_MAKER_PCT, gst: HG_FEE_GST_MULT };
}

function hgCryptoRoundTripPct(entrySide, exitSide){
  var f = hgCryptoFeeRates();
  var side = function(s){ return s === 'taker' ? f.taker : f.maker; };
  return (side(entrySide || 'maker') + side(exitSide || 'taker')) * f.gst;
}

function hgCryptoCostR(entry, stop, entrySide, exitSide){
  if (typeof G.hgCostR === 'function'){
    try{ return G.hgCostR(entry, stop, entrySide, exitSide); }catch(e1){}
  }
  var e = num(entry), st = num(stop);
  if (e === null || !(e > 0) || st === null) return 0;
  var riskPct = Math.abs(e - st) / e * 100;
  if (!(riskPct > 0)) return 0;
  return hgCryptoRoundTripPct(entrySide, exitSide) / riskPct;
}

function hgCryptoNetRAtTarget(entry, stop, t1, dir){
  var e = num(entry), st = num(stop), tp = num(t1);
  if (e === null || st === null || tp === null) return null;
  var risk = Math.abs(e - st);
  if (!(risk > 0)) return null;
  var d = normDir(dir);
  var gross = d === 'long' ? (tp - e) / risk : (e - tp) / risk;
  return gross - hgCryptoCostR(e, st, 'maker', 'maker');
}

function hgCryptoBreakevenWinRate(grossR, costR){
  grossR = num(grossR);
  costR = num(costR) || 0;
  if (grossR === null || !(grossR > 0)) return null;
  var need = (1 + costR) / (grossR + 1);
  return Math.max(0.01, Math.min(0.99, need));
}

function hgCryptoMaxSurvivableLev(entry, stop, mmr, clearance){
  var e = num(entry), st = num(stop);
  if (e === null || st === null || !(e > 0) || e === st) return null;
  var sd = Math.abs(e - st) / e;
  var m = num(mmr) != null && num(mmr) > 0 ? num(mmr) : HG_CRYPTO_MMR_DEFAULT;
  var buf = num(clearance) != null && num(clearance) > 0 ? num(clearance) : HG_CRYPTO_LIQ_CLEARANCE_MIN;
  return Math.max(1, Math.min(100, Math.floor(1 / (sd * buf + m))));
}

function hgCryptoLiqPrice(entry, lev, mmr, dir){
  var e = num(entry), lv = num(lev);
  if (e === null || !(e > 0) || lv === null || !(lv >= 1)) return null;
  var m = num(mmr) != null && num(mmr) > 0 ? num(mmr) : HG_CRYPTO_MMR_DEFAULT;
  var d = normDir(dir);
  return d === 'long' ? e * (1 - 1 / lv + m) : e * (1 + 1 / lv - m);
}

function hgCryptoLiqClearance(entry, stop, liq){
  var e = num(entry), st = num(stop), l = num(liq);
  if (e === null || st === null || l === null) return null;
  var sd = Math.abs(e - st) / e;
  if (!(sd > 0)) return null;
  return Math.abs(e - l) / e / sd;
}

function hgCryptoFixedRiskSize(balance, riskPct, entry, stop, precision){
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
  return {
    riskAmountUSD: riskAmountUSD,
    stopDistanceUSD: stopDist,
    positionSizeUnits: Math.round(qty * factor) / factor,
    notionalUSD: Math.round(notional * 100) / 100,
    impliedLeverage: Math.round((notional / bal) * 1000) / 1000
  };
}

function hgCryptoMeasuredWinRate(sym, dir){
  try{
    if (typeof G.hgScoreRecords !== 'function') return null;
    var recs = G.hgScoreRecords().filter(function(r){
      return r && r.status === 'settled' && isFinite(+r.r)
        && String(r.sym || '').toUpperCase() === String(sym || '').toUpperCase()
        && String(r.dir || '').toLowerCase() === normDir(dir);
    });
    if (recs.length < 3) return null;
    var wins = recs.filter(function(r){ return +r.r > 0; }).length;
    return wins / recs.length;
  }catch(e){ return null; }
}

function hgCryptoDefaultBalance(){
  return num(G.__ssDefaultBalance) != null && num(G.__ssDefaultBalance) > 0 ? num(G.__ssDefaultBalance)
    : (num(G.__hgDefaultBalance) != null ? num(G.__hgDefaultBalance) : 1000);
}

function hgCryptoDefaultRiskPct(){
  return num(G.__ssDefaultRiskPct) != null && num(G.__ssDefaultRiskPct) > 0 ? num(G.__ssDefaultRiskPct) : 1;
}

function hgCryptoPositionRisk(plan, ctx){
  ctx = ctx || {};
  plan = plan || {};
  var e = num(plan.entry), st = num(plan.stop), tp = num(plan.t1);
  var bal = num(ctx.balance) != null && num(ctx.balance) > 0 ? num(ctx.balance) : hgCryptoDefaultBalance();
  var rp = num(ctx.riskPct) != null && num(ctx.riskPct) > 0 ? num(ctx.riskPct) : hgCryptoDefaultRiskPct();
  var dir = normDir(plan.dir);
  var mmr = num(ctx.mmr) != null && num(ctx.mmr) > 0 ? num(ctx.mmr) : HG_CRYPTO_MMR_DEFAULT;

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
  var costR = hgCryptoCostR(e, st, 'maker', 'taker');
  var netR = tp != null ? hgCryptoNetRAtTarget(e, st, tp, dir) : null;
  var breakeven = grossR != null ? hgCryptoBreakevenWinRate(grossR, costR) : null;
  var measured = num(ctx.measuredWinRate);
  if (measured === null && plan.sym) measured = hgCryptoMeasuredWinRate(plan.sym, dir);

  var liqPass = clearance != null && clearance >= HG_CRYPTO_LIQ_CLEARANCE_MIN - 0.05;
  var netFloor = num(ctx.netRFloor) != null ? num(ctx.netRFloor) : HG_NET_R_FLOOR;
  var style = String(plan.style || plan.scanner || 'swing').toLowerCase();
  var netPass = netR === null || style.indexOf('scalp') < 0 ? true : (netR >= netFloor);

  var reasons = [];
  if (!liqPass) reasons.push('Liq clearance ' + (clearance != null ? clearance.toFixed(2) : '?') + '× < ' + HG_CRYPTO_LIQ_CLEARANCE_MIN + '×');
  if (!netPass && netR !== null) reasons.push('Net R @ T1 ' + netR.toFixed(2) + ' < ' + netFloor);
  if (ceilingLev != null && impliedLev > ceilingLev + 0.01){
    reasons.push('Implied ' + impliedLev.toFixed(1) + 'x > ceiling ' + ceilingLev + 'x');
  }

  return {
    ok: true,
    pass: liqPass && netPass && !(ceilingLev != null && impliedLev > ceilingLev + 0.01),
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
    breakevenWinRate: breakeven != null ? Math.round(breakeven * 1000) / 1000 : null,
    measuredWinRate: measured,
    reasons: reasons,
    mmr: mmr
  };
}

function hgCryptoAttachPositionSize(setup, balance, riskPct, ctx){
  if (!setup || typeof setup !== 'object') return setup;
  var entry = num(setup.entry) != null ? setup.entry
    : (setup.levels && num(setup.levels.entry) != null ? setup.levels.entry : NaN);
  var stop = num(setup.stop) != null ? setup.stop
    : (setup.levels && num(setup.levels.stopLoss) != null ? setup.levels.stopLoss : NaN);
  var risk = hgCryptoPositionRisk({
    dir: setup.dir || setup.side,
    entry: entry,
    stop: stop,
    t1: setup.t1 || setup.tp,
    sym: setup.sym || setup.symbol,
    style: setup.style || setup.scanner
  }, Object.assign({}, ctx || {}, { balance: balance, riskPct: riskPct }));
  if (risk && risk.positionSizeUnits != null){
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

function hgCryptoRiskGate(risk){
  if (!risk) return { pass: false, reasons: ['no risk worksheet'] };
  return { pass: !!risk.pass, reasons: risk.reasons || [] };
}

function hgCryptoRiskChipHTML(plan){
  try{
    plan = plan || {};
    var e = num(plan.entry), st = num(plan.stop);
    if (e === null || st === null || !(e > 0) || e === st) return '';
    var risk = hgCryptoPositionRisk(plan, plan.ctx || {});
    if (!risk || !risk.impliedLeverage) return '';

    var col = risk.pass ? '#2EE6A8' : '#F5C542';
    if (!risk.pass && risk.reasons && risk.reasons.length) col = '#e4586b';

    var lotTxt = '';
    if (plan.sym && typeof G.hgQtyToContracts === 'function' && typeof G.hgContractSpec === 'function'){
      try{
        if (typeof G.hgEnsureContractSpecs === 'function') G.hgEnsureContractSpecs();
        var lots = G.hgQtyToContracts(plan.sym, risk.positionSizeUnits);
        if (lots && lots.lots >= 0) lotTxt = lots.lots + ' lots · ';
      }catch(eL){}
    }

    var liqTxt = risk.liqPrice != null ? (' · liq≈' + risk.liqPrice.toFixed(risk.liqPrice >= 100 ? 2 : 4)) : '';
    var netTxt = risk.netR != null ? (' · net ' + risk.netR.toFixed(2) + 'R') : '';
    var needTxt = risk.breakevenWinRate != null
      ? (' · need ' + Math.round(risk.breakevenWinRate * 100) + '% win'
        + (risk.measuredWinRate != null ? (' (ledger ' + Math.round(risk.measuredWinRate * 100) + '%)') : ''))
      : '';

    return '<div class="note hg-risk-line" style="margin-top:6px;font-size:11px;color:' + col + '" title="Risk-first sizing @ '
      + risk.riskPct + '% of $' + risk.balance + ' — implied lev is derived from qty, not a dial. Ceiling '
      + (risk.ceilingLeverage != null ? risk.ceilingLeverage + 'x' : '?')
      + ' is max survivable (verify liq vs Delta UI).">'
      + '<b>SIZE</b> ' + lotTxt + risk.positionSizeUnits + ' coin · implied <b>' + risk.impliedLeverage.toFixed(1) + 'x</b>'
      + ' · ceiling <b>' + (risk.ceilingLeverage != null ? risk.ceilingLeverage + 'x' : '—') + '</b>'
      + (risk.liqClearance != null ? (' · liq ' + risk.liqClearance.toFixed(1) + '× stop') : '')
      + liqTxt + netTxt + needTxt
      + (!risk.pass && risk.reasons && risk.reasons.length ? (' · <span style="color:#e4586b">' + risk.reasons[0] + '</span>') : '')
      + '</div>';
  }catch(e){ return ''; }
}

/** Drop-in for planBlock — replaces hgSafeLevChip hero number with full risk line. */
function hgSetupRiskChip(meta){
  meta = meta || {};
  if (typeof hgCryptoRiskChipHTML !== 'function') return hgSafeLevChipLegacy(meta.entry, meta.stop);
  return hgCryptoRiskChipHTML({
    entry: meta.entry,
    stop: meta.stop,
    dir: meta.dir,
    sym: meta.sym,
    t1: meta.t1,
    style: meta.style || meta.scanner,
    ctx: meta.ctx
  });
}

function hgSafeLevChipLegacy(entry, stop){
  try{
    entry = +entry; stop = +stop;
    if (!(isFinite(entry) && isFinite(stop)) || entry <= 0 || entry === stop) return '';
    var sd = Math.abs(entry - stop) / entry;
    var lev = Math.max(1, Math.min(100, Math.floor(1 / (sd * 1.5 + 0.005))));
    return ' · <span style="font-weight:700;color:#8B9CC4" title="ceiling only — use SIZE line for implied lev">'
      + lev + 'x ceiling</span>';
  }catch(e){ return ''; }
}

G.hgCryptoPositionRisk = hgCryptoPositionRisk;
G.hgCryptoAttachPositionSize = hgCryptoAttachPositionSize;
G.hgCryptoFixedRiskSize = hgCryptoFixedRiskSize;
G.hgCryptoMaxSurvivableLev = hgCryptoMaxSurvivableLev;
G.hgCryptoLiqPrice = hgCryptoLiqPrice;
G.hgCryptoLiqClearance = hgCryptoLiqClearance;
G.hgCryptoCostR = hgCryptoCostR;
G.hgCryptoNetRAtTarget = hgCryptoNetRAtTarget;
G.hgCryptoBreakevenWinRate = hgCryptoBreakevenWinRate;
G.hgCryptoRiskGate = hgCryptoRiskGate;
G.hgCryptoRiskChipHTML = hgCryptoRiskChipHTML;
G.hgSetupRiskChip = hgSetupRiskChip;
G.hgSafeLevChipLegacy = hgSafeLevChipLegacy;
G.HG_CRYPTO_MMR_DEFAULT = HG_CRYPTO_MMR_DEFAULT;
G.HG_CRYPTO_LIQ_CLEARANCE_MIN = HG_CRYPTO_LIQ_CLEARANCE_MIN;
G.HG_NET_R_FLOOR = HG_NET_R_FLOOR;

})();
