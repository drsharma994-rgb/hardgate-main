/* =========================================================================
   HARDGATE Liquidation Intelligence — Real-time cascade detection + whale tracking

   Sources: Coinglass API, on-chain transfers, funding rates, exchange flows
   Detects: Liquidation cascades, whale accumulation, institutional exits

   Public API:
   - hgLiquidationRisk(symbol) → {cascade: bool, level: 'low'|'medium'|'high', reason}
   - hgWhaleSentiment(symbol) → {buying: bool, accumulation: bool, score: -1 to +1}
   - hgFundingRateRisk(symbol) → {imbalance: score, longs_overlevered: bool}
   - hgExchangeFlow(symbol) → {inflow: score, accumulation_phase: bool}
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_LIQUIDATION = {
  cascadeCache: {},
  whaleCache: {},
  fundingCache: {},
  lastUpdate: null
};

/**
 * Liquidation Cascade Detection
 *
 * Indicators of imminent cascade:
 * 1. High open interest at key price levels
 * 2. Rapid price movement toward liquidation cluster
 * 3. Volume spike (margin calls triggering)
 * 4. Funding rates at extremes (long/short leverage imbalance)
 *
 * Returns: {cascade: bool, level: 'low'|'medium'|'high', reason: string, confidence: 0-1}
 */
function hgLiquidationRisk(symbol) {
  /* Real integration: Coinglass API (liquidation heatmap by price level)
     For now: Calculate from funding rates + volume patterns */

  var funding = hgFundingRateRisk(symbol);
  var risk = 0;

  /* Signal 1: Extreme funding rates = overleveraged side at risk */
  if (Math.abs(funding.imbalance) > 0.7){
    risk += 0.3;  /* High risk */
  } else if (Math.abs(funding.imbalance) > 0.4){
    risk += 0.15; /* Medium risk */
  }

  /* Signal 2: Whale activity + price movement toward them = cascade risk */
  var whale = hgWhaleSentiment(symbol);
  if (whale.score < -0.5){
    /* Bearish whale activity + overly long funding = liquidation risk */
    if (funding.imbalance > 0.5) risk += 0.35;
  }

  /* Signal 3: Exchange flow patterns (coins leaving = OTC accumulation, not exchange pressure) */
  var flow = hgExchangeFlow(symbol);
  if (flow.inflow > 0.6){
    /* Heavy inflow to exchanges = preparation for dump = cascade setup */
    risk += 0.25;
  }

  var level = risk > 0.6 ? 'high' : risk > 0.35 ? 'medium' : 'low';
  var cascade = risk > 0.5;

  return {
    cascade: cascade,
    level: level,
    score: Math.min(1, risk),
    reason: cascade ? 'Liquidation cascade risk detected' : 'Liquidation risk low',
    confidence: Math.abs(funding.imbalance)
  };
}

/**
 * Whale Sentiment Detection
 *
 * Detects: Large transfers, accumulation phases, distribution dumps
 * Data: On-chain whale alerts (Santiment, Glassnode, Whale Alert API)
 *
 * Returns: {buying: bool, accumulating: bool, score: -1 to +1, activity: 'dump'|'accumulation'|'neutral'}
 */
function hgWhaleSentiment(symbol) {
  /* Real integration: Whale Alert API, Glassnode whale tracking
     MVP: Simulate from market data patterns */

  var baseScore = 0;

  /* Pattern 1: Large buy orders + price not moving = accumulation */
  /* (Would require order book data from exchange API) */

  /* Pattern 2: Supply on exchanges increasing + price falling = distribution */
  var flow = hgExchangeFlow(symbol);
  if (flow.inflow > 0.7 && baseScore < 0){
    baseScore = -0.6; /* Dump phase */
  }

  /* Pattern 3: Supply leaving exchanges + price stable = accumulation */
  if (flow.inflow < -0.6){
    baseScore = 0.5; /* Accumulation phase */
  }

  return {
    buying: baseScore > 0,
    accumulating: baseScore > 0.3,
    distributing: baseScore < -0.3,
    score: baseScore,
    activity: baseScore > 0.3 ? 'accumulation' : baseScore < -0.3 ? 'dump' : 'neutral',
    confidence: Math.abs(baseScore)
  };
}

/**
 * Funding Rate Risk Analysis
 *
 * Extreme funding rates = overleveraged traders at risk of cascade
 * Long funding > 0.1% per day = longs overlevered (dump risk)
 * Short funding < -0.1% per day = shorts overlevered (spike risk)
 *
 * Returns: {imbalance: -1 to +1, longs_overlevered: bool, shorts_overlevered: bool}
 */
function hgFundingRateRisk(symbol) {
  /* Real integration: Binance, Bybit, Deribit funding rate APIs
     MVP: Return neutral position */

  return {
    imbalance: 0,  /* -1 = all shorts, +1 = all longs */
    longs_overlevered: false,
    shorts_overlevered: false,
    rate_long: 0.0001,  /* 0.01% per 8h */
    rate_short: -0.00005,
    reason: 'Balanced'
  };
}

/**
 * Exchange Inflow/Outflow Detection
 *
 * Coins flowing TO exchanges = preparation for selling (bearish)
 * Coins flowing FROM exchanges = moving to self-custody (bullish, accumulation)
 *
 * Returns: {inflow: -1 to +1, accumulation_phase: bool}
 */
function hgExchangeFlow(symbol) {
  /* Real integration: Glassnode, Santiment, CryptoQuant exchange flow APIs
     MVP: Return neutral */

  return {
    inflow: 0,  /* -1 = all outflow (accumulation), +1 = all inflow (distribution) */
    accumulation_phase: false,
    net_flow_24h: 0,
    exchange_balance: 0,
    reason: 'Neutral flow'
  };
}

/**
 * Combined Risk Score (all four external signals)
 * Used by sentiment layer to gate trades
 */
function hgExternalRiskScore(symbol) {
  var liq = hgLiquidationRisk(symbol);
  var whale = hgWhaleSentiment(symbol);
  var funding = hgFundingRateRisk(symbol);
  var flow = hgExchangeFlow(symbol);

  /* Average all signals */
  var riskScore = 0;
  riskScore += (liq.score * 0.3);      /* Liquidation risk 30% */
  riskScore += (Math.abs(whale.score) * 0.3);  /* Whale activity 30% */
  riskScore += (Math.abs(funding.imbalance) * 0.2); /* Funding imbalance 20% */
  riskScore += (Math.abs(flow.inflow) * 0.2);  /* Exchange flow 20% */

  return {
    riskScore: Math.min(1, riskScore),
    cascadeImminent: liq.cascade,
    whaleActive: whale.activity !== 'neutral',
    fundingExtreme: Math.abs(funding.imbalance) > 0.5,
    flowAbnormal: Math.abs(flow.inflow) > 0.6,
    recommendation: liq.cascade ? 'AVOID_LONGS' : (whale.distributing ? 'CAUTION_LONGS' : 'OK')
  };
}

/* Export */
G.HG_LIQUIDATION = HG_LIQUIDATION;
G.hgLiquidationRisk = hgLiquidationRisk;
G.hgWhaleSentiment = hgWhaleSentiment;
G.hgFundingRateRisk = hgFundingRateRisk;
G.hgExchangeFlow = hgExchangeFlow;
G.hgExternalRiskScore = hgExternalRiskScore;
