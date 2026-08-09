/* HARDGATE — CCXT market desk core (pure, vm-testable).
   Funding / carry context for formation + FTS stack. Never throws. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, dp = 4) => (Number.isFinite(v) ? Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp) : null);

/** Annualized funding % from 8h rate (standard perp convention). */
export function ccxtFundingAnnualPct(fundingRate){
  var r = num(fundingRate);
  if (r === null) return null;
  return round(r * 3 * 365 * 100, 2);
}

/** Carry label for desk UI. */
export function ccxtCarryLabel(fundingRate){
  var r = num(fundingRate);
  if (r === null) return 'UNKNOWN';
  if (r >= 0.0003) return 'LONG-PAY';
  if (r >= 0.00005) return 'LONG-PAY-LIGHT';
  if (r <= -0.0003) return 'SHORT-PAY';
  if (r <= -0.00005) return 'SHORT-PAY-LIGHT';
  return 'NEUTRAL';
}

/**
 * Participation macro adjustment from funding carry (−12..+12).
 * Longs penalized when funding positive (crowded longs); rewarded when negative.
 */
export function ccxtFundingFormationBoost(dir, leg){
  if (!leg || leg.fundingRate == null) return 0;
  var side = String(dir || 'long').toLowerCase();
  var r = +leg.fundingRate;
  if (!isFinite(r)) return 0;
  var ann = ccxtFundingAnnualPct(r);
  if (ann === null) return 0;
  if (side === 'long'){
    if (ann >= 35) return -12;
    if (ann >= 18) return -7;
    if (ann >= 8) return -3;
    if (ann <= -35) return 12;
    if (ann <= -18) return 7;
    if (ann <= -8) return 3;
    return 0;
  }
  if (ann <= -35) return -12;
  if (ann <= -18) return -7;
  if (ann <= -8) return -3;
  if (ann >= 35) return 12;
  if (ann >= 18) return 7;
  if (ann >= 8) return 3;
  return 0;
}

/** Normalize CCXT funding/ticker leg for desk snapshot. */
export function ccxtNormalizeLeg(symbol, funding, ticker){
  var fr = funding && (funding.fundingRate != null ? funding.fundingRate : funding.info && funding.info.fundingRate);
  var last = ticker && (ticker.last != null ? ticker.last : ticker.close);
  return {
    symbol: symbol,
    fundingRate: num(fr),
    fundingAnnualPct: ccxtFundingAnnualPct(fr),
    carry: ccxtCarryLabel(fr),
    mark: num(last),
    bid: num(ticker && ticker.bid),
    ask: num(ticker && ticker.ask),
    at: Date.now(),
  };
}

/** Finalize multi-symbol CCXT desk snapshot. */
export function ccxtFinalizeDesk(desk){
  desk = desk || {};
  desk.at = desk.at || Date.now();
  desk.source = desk.source || 'ccxt-public';
  var legs = desk.legs || {};
  var btc = legs['BTC/USDT:USDT'] || legs.BTC || Object.values(legs)[0];
  var eth = legs['ETH/USDT:USDT'] || legs.ETH;
  if (btc) desk.btc = btc;
  if (eth) desk.eth = eth;
  if (btc && eth && btc.mark > 0 && eth.mark > 0){
    desk.ethBtcRatio = round(eth.mark / btc.mark, 6);
  }
  return desk;
}
