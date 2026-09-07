/* HARDGATE — portfolio-allocation.js (Increment 7)
   Portfolio construction & dynamic allocation engine:
   1. Rolling Sharpe per strategy family (SWING, SCALP, EDGE, SMC, OB, GS, TRAP, DIV) & allocation weights (floor 5%, ceiling 35%)
   2. Correlation-adjusted fractional Kelly sizing across active portfolio positions
   3. Regime-conditional strategy activation & pauses
   4. Dynamic risk-per-trade based on rolling peak drawdown (anti-martingale ruin prevention)
   5. Multi-fund segregation math (independent equities, DD state, heat caps)
   6. Live vs paper execution reconciliation math (slippage, fee drift, execution decay vs signal decay)
*/
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

function fin(v){ return typeof v === 'number' && isFinite(v); }
function num(v){
  if (v === null || v === undefined || v === '') return null;
  var n = +v;
  return isFinite(n) ? n : null;
}

// ---------------- 1. Strategy Rolling Sharpe & Allocation Weights ----------------
/** Computes allocation weights from strategy Sharpe ratios.
    base_weight[s] = max(0, Sharpe[s]) ^ 1.5; floor 0.05, ceiling 0.35. */
function hgCalcStrategyWeights(strategySharpes){
  strategySharpes = strategySharpes || {};
  var keys = Object.keys(strategySharpes);
  if (!keys.length) return {};

  var baseWeights = {};
  var sumBase = 0;
  for (var i = 0; i < keys.length; i++){
    var k = keys[i];
    var s = num(strategySharpes[k]) || 0;
    var bw = s > 0 ? Math.pow(s, 1.5) : 0;
    baseWeights[k] = bw;
    sumBase += bw;
  }

  var weights = {};
  var floor = 0.05;
  var ceiling = 0.35;
  
  if (sumBase <= 0){
    var even = 1 / keys.length;
    for (var j = 0; j < keys.length; j++) weights[keys[j]] = Math.min(ceiling, Math.max(floor, even));
    return weights;
  }

  // First pass: normalize
  var rawSum = 0;
  for (var m = 0; m < keys.length; m++){
    var sk = keys[m];
    var norm = baseWeights[sk] / sumBase;
    var clamped = Math.min(ceiling, Math.max(floor, norm));
    weights[sk] = clamped;
    rawSum += clamped;
  }

  // Renormalize to sum to 1.0
  var finalWeights = {};
  for (var r = 0; r < keys.length; r++){
    var rk = keys[r];
    finalWeights[rk] = +(weights[rk] / rawSum).toFixed(4);
  }

  return finalWeights;
}

// ---------------- 2. Correlation-Adjusted Kelly Sizing ----------------
/** Calculates quarter-Kelly sizing adjusted for portfolio pairwise correlation */
function hgCorrelationKellySize(newTrade, activePositions, correlationMatrix, opts){
  opts = opts || {};
  var baseFraction = opts.baseFraction || 0.25; // Quarter-Kelly
  var winRate = num(newTrade.winRate) || 0.5;
  var winLossRatio = num(newTrade.winLossRatio) || 2.0; // b = avg_win / avg_loss
  
  // Standard Kelly f* = (b*p - q) / b
  var p = winRate;
  var q = 1 - p;
  var b = winLossRatio;
  var rawKelly = (b * p - q) / b;
  if (!(rawKelly > 0)) return { targetRiskPct: 0.25, kellyMultiplier: 0.25, note: 'negative expected edge' };

  var unadjustedFraction = rawKelly * baseFraction;

  activePositions = Array.isArray(activePositions) ? activePositions : [];
  if (!activePositions.length || !correlationMatrix){
    return {
      targetRiskPct: Math.min(2.5, Math.max(0.25, unadjustedFraction * 100)),
      fractionalKelly: unadjustedFraction,
      correlationDiscount: 1.0,
      note: 'unhedged single position'
    };
  }

  // Average correlation of proposed asset with current book
  var newSym = String(newTrade.sym || '').toUpperCase();
  var sumCorr = 0;
  var count = 0;
  for (var i = 0; i < activePositions.length; i++){
    var posSym = String(activePositions[i].sym || '').toUpperCase();
    var pairKey = [newSym, posSym].sort().join(':');
    var corr = (correlationMatrix[pairKey] !== undefined) ? correlationMatrix[pairKey] : (newSym === posSym ? 1.0 : 0.7);
    
    // Direction adjustment: opposing positions act as hedge
    var sameDir = String(newTrade.dir).toLowerCase() === String(activePositions[i].dir).toLowerCase();
    var signedCorr = sameDir ? corr : -corr;
    sumCorr += signedCorr;
    count++;
  }

  var avgCorr = count ? (sumCorr / count) : 0;
  // If highly positively correlated with open book, downscale size: sqrt(1 - corr^2) style damping
  /* Portfolio Kelly dampener: closed-form 2-asset style 1/(1+ρ) with negative-ρ relief */
  var corrDampener = avgCorr > 0 ? (1 / (1 + avgCorr)) : (1 + Math.abs(avgCorr) * 0.25);
  var adjustedFraction = unadjustedFraction * corrDampener;
  var portfolioKellyCap = unadjustedFraction * 3.0;
  adjustedFraction = Math.min(adjustedFraction, portfolioKellyCap);
  var finalPct = Math.min(2.5, Math.max(0.25, adjustedFraction * 100));

  return {
    targetRiskPct: +finalPct.toFixed(2),
    rawKelly: +rawKelly.toFixed(4),
    fractionalKelly: +adjustedFraction.toFixed(4),
    avgCorrelation: +avgCorr.toFixed(2),
    correlationDiscount: +corrDampener.toFixed(2),
    note: avgCorr > 0.6 ? 'sized down due to high book correlation (' + avgCorr.toFixed(2) + ')' : 'normal / diversified size'
  };
}

// ---------------- 3. Regime-Conditional Strategy Activation ----------------
/** Checks whether a strategy family is paused under current market regime */
function hgCheckStrategyRegimeActive(strategy, regimeState, regimeExpectancies){
  strategy = String(strategy || '').toUpperCase();
  regimeState = String(regimeState || 'MIXED').toUpperCase();
  regimeExpectancies = regimeExpectancies || {};

  var key = strategy + ':' + regimeState;
  var exp = regimeExpectancies[key];
  if (exp === undefined && regimeExpectancies[strategy] && typeof regimeExpectancies[strategy] === 'object'){
    exp = regimeExpectancies[strategy][regimeState];
  }
  if (exp !== undefined && exp < 0){
    return {
      active: false,
      status: 'REGIME PAUSED',
      reason: strategy + ' has negative expectancy (' + exp + 'R) in ' + regimeState + ' regime'
    };
  }
  return { active: true, status: 'ACTIVE', reason: 'eligible in ' + regimeState };
}

// ---------------- 4. Dynamic Risk-per-trade Based on Drawdown ----------------
/** Anti-martingale risk scalar: scales down risk during deep drawdown to prevent ruin */
function hgDynamicDrawdownRisk(currentEquity, peakEquity, baseRiskPct){
  baseRiskPct = num(baseRiskPct) || 1.0;
  currentEquity = num(currentEquity) || 10000;
  peakEquity = Math.max(currentEquity, num(peakEquity) || currentEquity);

  var ddPct = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;

  if (ddPct < 3.0){
    return { riskPct: baseRiskPct, ddPct: ddPct, state: 'NORMAL', allowedNewEntries: true };
  } else if (ddPct < 7.0){
    // Scale linearly: 3% DD -> 1.0R, 5% DD -> 0.7R, 7% DD -> 0.4R
    var scaled = baseRiskPct - ((ddPct - 3.0) / 4.0) * (baseRiskPct * 0.6);
    return { riskPct: +scaled.toFixed(2), ddPct: ddPct, state: 'PROTECTIVE DOWNSCALE', allowedNewEntries: true };
  } else {
    return { riskPct: 0, ddPct: ddPct, state: 'MAX DRAWDOWN HALT (>7%)', allowedNewEntries: false };
  }
}

// ---------------- 5. Multi-Fund Segregation Math ----------------
/** Resolves segregated fund risk budgets without cross-fund risk contamination */
function hgSegregatedFundLimits(fundConfig, fundState){
  fundConfig = fundConfig || {};
  fundState = fundState || {};
  var equity = num(fundState.equity) || 10000;
  var heatCap = num(fundConfig.heatCapPct) || 0.06;
  var currentHeatUsd = num(fundState.currentHeatUsd) || 0;
  var maxHeatUsd = equity * heatCap;
  var availableHeatUsd = Math.max(0, maxHeatUsd - currentHeatUsd);

  return {
    fundId: fundConfig.fundId || 'default',
    equity: equity,
    maxHeatUsd: maxHeatUsd,
    currentHeatUsd: currentHeatUsd,
    availableHeatUsd: availableHeatUsd,
    allowedStrategies: fundConfig.allowedStrategies || [],
    canOpenTrade: availableHeatUsd > (equity * 0.005)
  };
}

// ---------------- 6. Live vs Paper Reconciliation Math ----------------
/** Analyzes execution decay vs signal decay across trades */
function hgReconcileTrades(paperLogs, liveFills){
  paperLogs = Array.isArray(paperLogs) ? paperLogs : [];
  liveFills = Array.isArray(liveFills) ? liveFills : [];

  var liveMap = {};
  for (var i = 0; i < liveFills.length; i++){
    var lf = liveFills[i];
    if (lf && lf.id) liveMap[lf.id] = lf;
  }

  var diffs = [];
  var totalSlippageUsd = 0;
  var totalFeeDriftUsd = 0;
  var weeklyByStrat = {};

  for (var j = 0; j < paperLogs.length; j++){
    var pl = paperLogs[j];
    var match = liveMap[pl.id || pl.tradeId];
    if (!match) continue;

    var pEntry = num(pl.entry);
    var lEntry = num(match.entry);
    var pExit = num(pl.exit);
    var lExit = num(match.exit);
    var slippagePct = (fin(pEntry) && fin(lEntry) && pEntry > 0) ? ((lEntry - pEntry) / pEntry) * 100 : 0;
    var exitSlippagePct = (fin(pExit) && fin(lExit) && pExit > 0) ? ((lExit - pExit) / pExit) * 100 : null;
    var feeDrift = (num(match.feesUsd) || 0) - (num(pl.expectedFeesUsd) || 0);
    var strat = String(pl.strategy || 'unknown').toUpperCase();
    var weekKey = pl.closedAt ? new Date(pl.closedAt).toISOString().slice(0, 10) : 'unknown';

    diffs.push({
      tradeId: pl.id,
      sym: pl.sym,
      strategy: pl.strategy,
      slippagePct: slippagePct,
      exitSlippagePct: exitSlippagePct,
      feeDrift: feeDrift
    });
    totalSlippageUsd += (num(match.slippageUsd) || 0);
    totalFeeDriftUsd += feeDrift;
    var wk = weekKey + '|' + strat;
    if (!weeklyByStrat[wk]) weeklyByStrat[wk] = { week: weekKey, strategy: strat, slippageUsd: 0, feeDriftUsd: 0, n: 0 };
    weeklyByStrat[wk].slippageUsd += (num(match.slippageUsd) || 0);
    weeklyByStrat[wk].feeDriftUsd += feeDrift;
    weeklyByStrat[wk].n += 1;
  }

  var weekly = Object.keys(weeklyByStrat).map(function(k){ return weeklyByStrat[k]; });
  var degraded = (Math.abs(totalSlippageUsd) > 500 || totalFeeDriftUsd > 100);

  return {
    reconciledCount: diffs.length,
    diffs: diffs,
    weeklyByStrategy: weekly,
    totalSlippageUsd: totalSlippageUsd,
    totalFeeDriftUsd: totalFeeDriftUsd,
    executionHealth: degraded ? 'DEGRADED_EXECUTION' : 'HEALTHY_EXECUTION',
    alert: degraded ? { push: true, title: 'HARDGATE RECON DEGRADED', body: 'Execution drift slippage $' + totalSlippageUsd.toFixed(0) + ' fee $' + totalFeeDriftUsd.toFixed(0) } : null
  };
}

G.hgCalcStrategyWeights = hgCalcStrategyWeights;
G.hgCorrelationKellySize = hgCorrelationKellySize;
G.hgCheckStrategyRegimeActive = hgCheckStrategyRegimeActive;
G.hgDynamicDrawdownRisk = hgDynamicDrawdownRisk;
G.hgSegregatedFundLimits = hgSegregatedFundLimits;
G.hgReconcileTrades = hgReconcileTrades;

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    hgCalcStrategyWeights: hgCalcStrategyWeights,
    hgCorrelationKellySize: hgCorrelationKellySize,
    hgCheckStrategyRegimeActive: hgCheckStrategyRegimeActive,
    hgDynamicDrawdownRisk: hgDynamicDrawdownRisk,
    hgSegregatedFundLimits: hgSegregatedFundLimits,
    hgReconcileTrades: hgReconcileTrades
  };
}
})();
