/**
 * HARDGATE position size from equity, stop distance, and a round-trip fee.
 * It does not send an order.
 */
(function (root) {
  'use strict';
  function RiskAllocator(accountEquity, riskFraction){
    this.equity = accountEquity > 0 ? accountEquity : 0;
    this.riskFraction = riskFraction > 0 ? riskFraction : 0.01;
    this.feeTierPct = 0.0005;
  }
  RiskAllocator.prototype.calculateSize = function(entryPrice, stopLossPrice, targetPrice){
    if (!(this.equity > 0) || !(entryPrice > 0) || !(stopLossPrice > 0) || entryPrice === stopLossPrice || !(targetPrice > 0)) return null;
    var riskCapital = this.equity * this.riskFraction;
    var distance = Math.abs(entryPrice - stopLossPrice);
    var fee = entryPrice * this.feeTierPct * 2;
    var qty = riskCapital / (distance + fee);
    if (!(qty > 0)) return null;
    var reward = Math.abs(targetPrice - entryPrice) * qty;
    return {
      accountEquity: this.equity,
      riskCapital: +riskCapital.toFixed(2),
      positionQty: +qty.toFixed(4),
      notionalUsd: +(qty * entryPrice).toFixed(2),
      entryPrice: entryPrice,
      stopLoss: stopLossPrice,
      takeProfit2: targetPrice,
      netRR: +(reward / riskCapital).toFixed(2)
    };
  };
  root.HG_RiskAllocator = RiskAllocator;
})(typeof globalThis !== 'undefined' ? globalThis : this);
