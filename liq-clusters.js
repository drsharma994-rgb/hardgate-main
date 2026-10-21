/**
 * HARDGATE liquidation-band estimate. A null price returns null.
 * The dollars are an estimate from open interest, not a printed exchange map.
 */
(function (root) {
  'use strict';
  function LiqClusterEstimator(){}
  LiqClusterEstimator.prototype.estimateClusters = function(currentPrice, openInterestUsd, recentHigh, recentLow){
    if (!(currentPrice > 0) || !(openInterestUsd > 0) || !(recentHigh > 0) || !(recentLow > 0)) return null;
    var tiers = [
      { leverage: 100, bufferPct: 0.008 },
      { leverage: 50, bufferPct: 0.018 },
      { leverage: 25, bufferPct: 0.038 }
    ];
    var shortClusters = [], longClusters = [], i, tier, est;
    for (i = 0; i < tiers.length; i++){
      tier = tiers[i];
      est = (openInterestUsd * 0.15) / tiers.length;
      longClusters.push({ leverage: tier.leverage + 'x', price: +(recentLow * (1 - tier.bufferPct)).toFixed(4), estimatedUsd: +est.toFixed(0), side: 'LONG_LIQ' });
      shortClusters.push({ leverage: tier.leverage + 'x', price: +(recentHigh * (1 + tier.bufferPct)).toFixed(4), estimatedUsd: +est.toFixed(0), side: 'SHORT_LIQ' });
    }
    return { currentPrice: currentPrice, shortClusters: shortClusters, longClusters: longClusters, estimated: true };
  };
  root.HG_LiqClusterEstimator = LiqClusterEstimator;
})(typeof globalThis !== 'undefined' ? globalThis : this);
