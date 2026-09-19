/* =========================================================================
   HARDGATE Liquidation Intelligence — cascade detection + whale tracking

   NOTHING IN THIS FILE IS WIRED TO A FEED YET. Every leaf reader below is an
   integration point that returns a neutral placeholder, and the two readers
   built on top of them inherit it, so the whole layer is a constant:

     hgExternalRiskScore(sym) over BTCUSDT, ETHUSDT, DOGEUSDT, B-PEPE_USDT,
     XAUTUSD, '', 'nonsense', null, undefined and {} — ten inputs, ONE
     distinct result:
       { riskScore: 0, cascadeImminent: false, whaleActive: false,
         fundingExtreme: false, flowAbnormal: false, recommendation: 'OK' }

   That is not a finding of low risk. It is the absence of a measurement, and
   it used to be indistinguishable from one: CRYPTO SCAN's cascade veto, its
   whale penalty and its CASCADE / WHALE / FUNDING card flags are all reachable
   only through these values, so all three were dead, silently. Every reader
   now reports measured:false and unchecked:true, the aggregate names which
   sources are missing, and the tab prints the layer as UNCHECKED instead of
   showing nothing. The gates keep failing OPEN, which is this repo's rule for
   a missing feed — an absent reader must not veto any more than it may clear.

   Each reader also takes an optional injected dependency, so the logic above
   the feed is exercised and provably works the day one is wired, rather than
   being discovered broken then. hgWhaleSentiment's distribution branch was
   already unreachable for a second reason and is fixed here.

   Sources to wire: Coinglass API, on-chain transfers, funding rates, exchange flows
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
function hgLiquidationRisk(symbol, deps) {
  /* INTEGRATION POINT — Coinglass liquidation heatmap by price level. Every
     signal below reads one of the three placeholder readers, so the cascade
     verdict is a constant false until they are wired. `deps` injects them,
     which is how the arithmetic below is proven to still work. */
  deps = deps || {};
  var funding = deps.funding || hgFundingRateRisk(symbol);
  var risk = 0;

  /* Signal 1: Extreme funding rates = overleveraged side at risk */
  if (Math.abs(funding.imbalance) > 0.7){
    risk += 0.3;  /* High risk */
  } else if (Math.abs(funding.imbalance) > 0.4){
    risk += 0.15; /* Medium risk */
  }

  /* Signal 2: Whale activity + price movement toward them = cascade risk */
  var whale = deps.whale || hgWhaleSentiment(symbol);
  if (whale.score < -0.5){
    /* Bearish whale activity + overly long funding = liquidation risk */
    if (funding.imbalance > 0.5) risk += 0.35;
  }

  /* Signal 3: Exchange flow patterns (coins leaving = OTC accumulation, not exchange pressure) */
  var flow = deps.flow || hgExchangeFlow(symbol);
  if (flow.inflow > 0.6){
    /* Heavy inflow to exchanges = preparation for dump = cascade setup */
    risk += 0.25;
  }

  var level = risk > 0.6 ? 'high' : risk > 0.35 ? 'medium' : 'low';
  var cascade = risk > 0.5;

  /* "low" is only a reading when something was read. */
  var unchecked = (funding.measured === false) && (whale.measured === false)
                  && (flow.measured === false);
  return {
    cascade: cascade,
    level: level,
    score: Math.min(1, risk),
    measured: !unchecked,
    unchecked: unchecked,
    source: 'liquidation',
    reason: unchecked ? 'UNCHECKED — no liquidation, whale or flow feed wired'
          : cascade ? 'Liquidation cascade risk detected' : 'Liquidation risk low',
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
function hgWhaleSentiment(symbol, flowIn) {
  /* INTEGRATION POINT — Whale Alert API / Glassnode whale tracking. Derived
     entirely from exchange flow, so while that is unwired this is too.
     `flowIn` injects a flow reading; it is how the branches below are tested
     and how a real feed will arrive. */
  var flow = flowIn || hgExchangeFlow(symbol);
  var baseScore = 0;

  /* Pattern 1: Large buy orders + price not moving = accumulation */
  /* (Would require order book data from exchange API) */

  /* Pattern 2: Supply on exchanges increasing + price falling = distribution.
     The guard here used to read `flow.inflow > 0.7 && baseScore < 0`, and
     baseScore is initialised to 0 two lines up and never touched before it —
     so this branch could not fire even with a live feed. */
  if (flow.inflow > 0.7){
    baseScore = -0.6; /* Dump phase */
  }

  /* Pattern 3: Supply leaving exchanges + price stable = accumulation */
  if (flow.inflow < -0.6){
    baseScore = 0.5; /* Accumulation phase */
  }

  return {
    measured: flow.measured !== false,
    unchecked: flow.measured === false,
    source: 'whale',
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
  /* INTEGRATION POINT — Binance / Bybit / Deribit funding rate APIs.
     Until one is wired this is a placeholder, and it says so rather than
     reporting a balanced book it never looked at. */
  return {
    imbalance: 0,  /* -1 = all shorts, +1 = all longs */
    longs_overlevered: false,
    shorts_overlevered: false,
    rate_long: 0.0001,  /* 0.01% per 8h */
    rate_short: -0.00005,
    measured: false,
    unchecked: true,
    source: 'funding',
    reason: 'UNCHECKED — no funding-rate feed wired (Binance / Bybit / Deribit)'
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
  /* INTEGRATION POINT — Glassnode / Santiment / CryptoQuant exchange flow. */
  return {
    inflow: 0,  /* -1 = all outflow (accumulation), +1 = all inflow (distribution) */
    accumulation_phase: false,
    net_flow_24h: 0,
    exchange_balance: 0,
    measured: false,
    unchecked: true,
    source: 'flow',
    reason: 'UNCHECKED — no exchange-flow feed wired (Glassnode / Santiment / CryptoQuant)'
  };
}

/**
 * Combined Risk Score (all four external signals)
 * Used by sentiment layer to gate trades
 */
function hgExternalRiskScore(symbol, deps) {
  deps = deps || {};
  var funding = deps.funding || hgFundingRateRisk(symbol);
  var flow = deps.flow || hgExchangeFlow(symbol);
  var whale = deps.whale || hgWhaleSentiment(symbol, flow);
  var liq = deps.liq || hgLiquidationRisk(symbol, { funding: funding, whale: whale, flow: flow });

  /* Average all signals */
  var riskScore = 0;
  riskScore += (liq.score * 0.3);      /* Liquidation risk 30% */
  riskScore += (Math.abs(whale.score) * 0.3);  /* Whale activity 30% */
  riskScore += (Math.abs(funding.imbalance) * 0.2); /* Funding imbalance 20% */
  riskScore += (Math.abs(flow.inflow) * 0.2);  /* Exchange flow 20% */

  /* Which of the four actually looked. An unchecked source contributes 0 to
     riskScore above, which is indistinguishable from a source that looked and
     found nothing — so say which it was, here, once, and let the callers and
     the card read it. The verdict fields stay fail-open. */
  var missing = [];
  if (liq.measured === false) missing.push('liquidation');
  if (whale.measured === false) missing.push('whale');
  if (funding.measured === false) missing.push('funding');
  if (flow.measured === false) missing.push('flow');

  return {
    riskScore: Math.min(1, riskScore),
    cascadeImminent: liq.cascade,
    whaleActive: whale.activity !== 'neutral',
    fundingExtreme: Math.abs(funding.imbalance) > 0.5,
    flowAbnormal: Math.abs(flow.inflow) > 0.6,
    measured: missing.length === 0,
    unchecked: missing.length > 0,
    uncheckedSources: missing,
    why: missing.length
      ? 'EXTERNAL RISK UNCHECKED — no ' + missing.join(' / ') + ' feed wired'
      : null,
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
