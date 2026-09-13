/* =========================================================================
   HARDGATE Order Flow Layer — Decorrelate voting via market microstructure

   Measures: Buyer/seller pressure, liquidation risk, order imbalances
   Independent of price technicals — detects whale accumulation, capitulation

   Public API:
   - hgOrderFlowScore(symbol, rows15m, rows1h) → {score: 0-1, votes: []}
   - hgLiquidationRisk(symbol) → {cascade: bool, level: 'low'|'medium'|'high'}
   - hgOrderBlockProximity(symbol, price) → distance to nearest block
   - hgSweepPattern(rows) → detected sweep signals
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_ORDER_FLOW = {
  cache: {},
  liquidationAlerts: {},  // Real-time liquidation data
  whaleAlerts: {}          // Whale transfer tracking
};

/**
 * Calculate bid-ask imbalance (requires order book data or delta API).
 * Simplified: Use volume profile — more volume at bid = buying pressure.
 *
 * Returns: score -1 to +1 (positive = buying pressure)
 */
function hgBidAskImbalance(rows) {
  if (!rows || rows.length < 20) return 0;

  var recent = rows.slice(-20);  // Last 20 candles
  var buyVolume = 0, sellVolume = 0;

  for (var i = 0; i < recent.length; i++){
    var row = recent[i];
    var close = row.c || 0;
    var open = row.o || 0;
    var vol = row.v || 0;

    /* Green candle = more buying; red = more selling */
    if (close > open) buyVolume += vol;
    else if (close < open) sellVolume += vol;
    else {
      /* Doji: split evenly */
      buyVolume += vol * 0.5;
      sellVolume += vol * 0.5;
    }
  }

  if (buyVolume + sellVolume === 0) return 0;
  var ratio = (buyVolume - sellVolume) / (buyVolume + sellVolume);
  return Math.max(-1, Math.min(1, ratio));
}

/**
 * Volume-Weighted Average Price divergence.
 * If price > VWAP: price pulling away from equilibrium (strength)
 * If price < VWAP: price below equilibrium (weakness / opportunity)
 *
 * Returns: score -1 to +1 (positive = institutional support above)
 */
function hgVWAPDivergence(rows) {
  if (!rows || rows.length < 50) return 0;

  var sumVW = 0, sumV = 0;
  for (var i = 0; i < rows.length; i++){
    var row = rows[i];
    var price = (row.h + row.l + row.c) / 3;
    var vol = row.v || 0;
    sumVW += price * vol;
    sumV += vol;
  }

  if (sumV === 0) return 0;
  var vwap = sumVW / sumV;
  var currentPrice = rows[rows.length - 1].c || 0;
  var divergence = (currentPrice - vwap) / vwap;

  return Math.max(-1, Math.min(1, divergence * 10));  /* Amplify signal */
}

/**
 * Liquidation cascade detection.
 * Simplified: High volume + extreme move = potential cascade
 *
 * Returns: {cascade: bool, level: 'low'|'medium'|'high'}
 */
function hgLiquidationRisk(symbol) {
  /* TODO: Integrate with real liquidation API (Coinglass, Bybit, Deribit) */
  /* For now: return neutral — this will be populated by sentiment engine */
  return {
    cascade: false,
    level: 'low',
    volume: 0,
    lastUpdate: null
  };
}

/**
 * Order block proximity detection.
 * Checks if price is within 1-2% of recent support/resistance (order blocks).
 * Order blocks are price levels where institutional order flow was absorbed.
 *
 * Returns: {distance: pct, type: 'support'|'resistance', strength: 'weak'|'medium'|'strong'}
 */
function hgOrderBlockProximity(rows, price) {
  if (!rows || rows.length < 50) return { distance: null, type: null, strength: 'weak' };

  /* Find recent highs and lows (order blocks) */
  var highs = [], lows = [];
  for (var i = Math.max(0, rows.length - 50); i < rows.length; i++){
    highs.push(rows[i].h || 0);
    lows.push(rows[i].l || 0);
  }

  var recentHigh = Math.max.apply(null, highs);
  var recentLow = Math.min.apply(null, lows);

  /* Check proximity */
  var distanceToHigh = Math.abs((recentHigh - price) / price);
  var distanceToLow = Math.abs((recentLow - price) / price);
  var minDistance = Math.min(distanceToHigh, distanceToLow);

  if (minDistance < 0.01){
    return {
      distance: minDistance,
      type: distanceToLow < distanceToHigh ? 'support' : 'resistance',
      strength: 'strong'
    };
  }
  if (minDistance < 0.02){
    return {
      distance: minDistance,
      type: distanceToLow < distanceToHigh ? 'support' : 'resistance',
      strength: 'medium'
    };
  }

  return { distance: minDistance, type: null, strength: 'weak' };
}

/**
 * Sweep pattern detection (ICT, SMC liquidity sweeps).
 * Pattern: High volume candle, quick reversal, often taking out previous highs/lows
 *
 * Returns: {detected: bool, type: 'bull-sweep'|'bear-sweep', confidence: 0-1}
 */
function hgSweepPattern(rows) {
  if (!rows || rows.length < 5) return { detected: false, type: null, confidence: 0 };

  var last = rows[rows.length - 1];
  var prev1 = rows[rows.length - 2];
  var prev2 = rows[rows.length - 3];

  /* Look for: high volume, body reversal, extreme wick */
  var lastVol = last.v || 0;
  var avgVol = 0;
  for (var i = Math.max(0, rows.length - 20); i < rows.length - 1; i++){
    avgVol += (rows[i].v || 0);
  }
  avgVol /= Math.min(20, rows.length - 1);

  var volRatio = lastVol / avgVol;
  if (volRatio < 1.5) return { detected: false, type: null, confidence: 0 };

  /* Body reversal: last close opposite to prev open */
  var bullSweep = (last.c > last.o) && (prev1.c < prev1.o) && (last.h > prev2.h);
  var bearSweep = (last.c < last.o) && (prev1.c > prev1.o) && (last.l < prev2.l);

  if (bullSweep){
    return { detected: true, type: 'bull-sweep', confidence: Math.min(1, volRatio / 3) };
  }
  if (bearSweep){
    return { detected: true, type: 'bear-sweep', confidence: Math.min(1, volRatio / 3) };
  }

  return { detected: false, type: null, confidence: 0 };
}

/**
 * Aggregate order flow score across all reads.
 * Returns: {score: -1 to +1, votes: [{read, value, vote, why}], direction: 'long'|'short'|'neutral'}
 */
function hgOrderFlowScore(symbol, rows15m, rows1h) {
  var votes = [];
  var scores = [];

  if (!rows15m || rows15m.length < 30) return { score: 0, votes: [], direction: 'neutral' };

  /* Read 1: Bid-Ask Imbalance (15m) */
  var ba15 = hgBidAskImbalance(rows15m);
  votes.push({
    read: 'Bid-Ask Imbalance (15m)',
    value: ba15.toFixed(2),
    vote: ba15 > 0.2 ? 'LONG' : ba15 < -0.2 ? 'SHORT' : 'neutral',
    why: ba15 > 0.2 ? 'Buying pressure' : ba15 < -0.2 ? 'Selling pressure' : 'Balanced'
  });
  if (Math.abs(ba15) > 0.2) scores.push(ba15);

  /* Read 2: VWAP Divergence (15m) */
  var vwap15 = hgVWAPDivergence(rows15m);
  votes.push({
    read: 'VWAP Divergence (15m)',
    value: vwap15.toFixed(2),
    vote: vwap15 > 0.1 ? 'LONG' : vwap15 < -0.1 ? 'SHORT' : 'neutral',
    why: vwap15 > 0.1 ? 'Institutional support above' : vwap15 < -0.1 ? 'Below institutional equilibrium' : 'At equilibrium'
  });
  if (Math.abs(vwap15) > 0.1) scores.push(vwap15);

  /* Read 3: Sweep Pattern (15m) */
  var sweep15 = hgSweepPattern(rows15m);
  if (sweep15.detected){
    var sweepVote = sweep15.type === 'bull-sweep' ? 'LONG' : 'SHORT';
    votes.push({
      read: 'Sweep Pattern (15m)',
      value: sweep15.confidence.toFixed(2),
      vote: sweepVote,
      why: sweep15.type === 'bull-sweep' ? 'Bullish liquidity sweep' : 'Bearish liquidity sweep'
    });
    scores.push(sweep15.type === 'bull-sweep' ? sweep15.confidence : -sweep15.confidence);
  }

  /* Read 4: Bid-Ask Imbalance (1h) */
  if (rows1h && rows1h.length >= 30){
    var ba1h = hgBidAskImbalance(rows1h);
    votes.push({
      read: 'Bid-Ask Imbalance (1h)',
      value: ba1h.toFixed(2),
      vote: ba1h > 0.2 ? 'LONG' : ba1h < -0.2 ? 'SHORT' : 'neutral',
      why: ba1h > 0.2 ? 'Higher TF buying' : ba1h < -0.2 ? 'Higher TF selling' : 'Balanced'
    });
    if (Math.abs(ba1h) > 0.2) scores.push(ba1h * 0.8);  /* Weight 1h slightly less */
  }

  /* Aggregate */
  if (scores.length === 0) return { score: 0, votes: votes, direction: 'neutral' };

  var aggregated = scores.reduce(function(a, b){ return a + b; }) / scores.length;
  var direction = aggregated > 0.2 ? 'long' : aggregated < -0.2 ? 'short' : 'neutral';

  return {
    score: Math.max(-1, Math.min(1, aggregated)),
    votes: votes,
    direction: direction,
    confidence: Math.abs(aggregated)
  };
}

/* Export */
G.HG_ORDER_FLOW = HG_ORDER_FLOW;
G.hgOrderFlowScore = hgOrderFlowScore;
G.hgBidAskImbalance = hgBidAskImbalance;
G.hgVWAPDivergence = hgVWAPDivergence;
G.hgLiquidationRisk = hgLiquidationRisk;
G.hgOrderBlockProximity = hgOrderBlockProximity;
G.hgSweepPattern = hgSweepPattern;
