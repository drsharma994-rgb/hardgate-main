/* HARDGATE — cross-venue funding arb signal desk (Hummingbot-style, signal-only). */
import { ccxtFundingAnnualPct } from './ccxt-market-core.mjs';

/** Score funding spread between two legs; positive = long pays less on legA vs legB. */
export function hgFundingArbSignal(legA, legB){
  if (!legA || !legB || legA.fundingRate == null || legB.fundingRate == null) return null;
  var spread = (+legA.fundingRate) - (+legB.fundingRate);
  var annA = ccxtFundingAnnualPct(legA.fundingRate);
  var annB = ccxtFundingAnnualPct(legB.fundingRate);
  var annSpread = (annA != null && annB != null) ? annA - annB : null;
  var label = 'NEUTRAL';
  if (annSpread != null){
    if (annSpread >= 15) label = 'HARVEST-LONG-A';
    else if (annSpread <= -15) label = 'HARVEST-SHORT-A';
    else if (Math.abs(annSpread) >= 8) label = 'CARRY-SKEW';
  }
  return {
    spread: spread,
    annSpread: annSpread,
    label: label,
    legA: legA.symbol,
    legB: legB.symbol,
    at: Date.now(),
  };
}

export function hgFundingArbDeskFromLegs(legs){
  legs = legs || {};
  var btc = legs['BTC/USDT:USDT'] || legs.btc;
  var eth = legs['ETH/USDT:USDT'] || legs.eth;
  var signals = [];
  if (btc && eth){
    var s = hgFundingArbSignal(btc, eth);
    if (s) signals.push(Object.assign({ pair: 'BTC-ETH' }, s));
  }
  return { signals: signals, at: Date.now(), source: 'ccxt-funding-arb' };
}
