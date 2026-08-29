(function (global) {
  'use strict';

  const WEIGHTS = Object.freeze({
    htfTrendStructure: 25,
    setupLocation: 20,
    confirmationVolume: 15,
    riskRewardInvalidation: 15,
    liquidityExecution: 15,
    marketRegimeAlignment: 10
  });

  const HARD_GATES = Object.freeze([
    ['invalidationBreached', 'Invalidation has already been breached'],
    ['insufficientLiquidity', 'Insufficient liquidity for the intended order size'],
    ['excessiveSpreadOrSlippage', 'Spread or estimated slippage exceeds the execution limit'],
    ['wrongHigherTimeframeRegime', 'Higher-timeframe regime is not bullish'],
    ['missingRequiredConfirmation', 'Required close/volume confirmation is missing'],
    ['staleOrMissingMarketData', 'Live market data is stale or unavailable']
  ]);

  function clamp(value, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  }

  function scoreBullSetup(input) {
    const setup = input || {};
    const vetoes = HARD_GATES.filter(function (gate) { return Boolean(setup[gate[0]]); })
      .map(function (gate) { return gate[1]; });

    const components = {
      htfTrendStructure: clamp(setup.htfTrendStructure, WEIGHTS.htfTrendStructure),
      setupLocation: clamp(setup.setupLocation, WEIGHTS.setupLocation),
      confirmationVolume: clamp(setup.confirmationVolume, WEIGHTS.confirmationVolume),
      riskRewardInvalidation: clamp(setup.riskRewardInvalidation, WEIGHTS.riskRewardInvalidation),
      liquidityExecution: clamp(setup.liquidityExecution, WEIGHTS.liquidityExecution),
      marketRegimeAlignment: clamp(setup.marketRegimeAlignment, WEIGHTS.marketRegimeAlignment)
    };
    const score = Object.keys(components).reduce(function (sum, key) { return sum + components[key]; }, 0);
    const hardGated = vetoes.length > 0;
    let tier = 'NOT RECOMMENDED';
    let action = 'BUILDING — NO ORDER';

    if (!hardGated) {
      if (score >= 85) { tier = 'SUPERB'; action = setup.inEntryZone ? 'ENTER ONLY INSIDE ENTRY ZONE' : 'WAIT FOR VALUE ZONE'; }
      else if (score >= 70) { tier = 'GOOD'; action = setup.confirmed ? 'ENTER ONLY INSIDE ENTRY ZONE' : 'WAIT FOR CLOSE + VOLUME'; }
      else if (score >= 60) { tier = 'FAIR'; action = 'WAIT FOR VALUE ZONE'; }
    }

    return {
      hardGated: hardGated,
      vetoes: vetoes,
      score: score,
      tier: tier,
      action: action,
      components: components,
      weights: WEIGHTS,
      display: {
        priceSource: 'CoinDCX Spot Last where applicable',
        executionWarning: 'TP/SL trigger and execution price can differ during fast markets or thin liquidity.'
      }
    };
  }

  global.HGBullsRubric = Object.freeze({ WEIGHTS: WEIGHTS, HARD_GATES: HARD_GATES, score: scoreBullSetup });
})(window);