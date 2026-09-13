/* =========================================================================
   HARDGATE Order Block Detection — Smart Money Entry Zones

   Identifies institutional order blocks, liquidity voids (FVG), breaker blocks
   Integration: Feeds into GOLD ULTRA confidence scoring
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* Fair Value Gap (FVG) detection: price zone with no recent trading */
function hgDetectFVG(candles, index){
  if (!candles || candles.length < 3 || index < 2) return null;
  try{
    var c1 = candles[index - 2];
    var c2 = candles[index - 1];
    var c3 = candles[index];

    /* Bullish FVG: c1 low > c3 high (gap up) */
    if (c1.low > c3.high){
      return {
        type: 'BULLISH_FVG',
        top: c1.low,
        bottom: c3.high,
        gapSize: c1.low - c3.high,
        strength: 'MITIGATED' /* if c3 didn't fill it */
      };
    }

    /* Bearish FVG: c1 high < c3 low (gap down) */
    if (c1.high < c3.low){
      return {
        type: 'BEARISH_FVG',
        top: c3.low,
        bottom: c1.high,
        gapSize: c3.low - c1.high,
        strength: 'MITIGATED'
      };
    }

    return null;
  }catch(e){ return null; }
}

/* Order block detection: rejection candle after swing high/low */
function hgDetectOrderBlock(candles, index){
  if (!candles || candles.length < 5 || index < 4) return null;
  try{
    var current = candles[index];
    var prev1 = candles[index - 1];
    var prev2 = candles[index - 2];
    var prev3 = candles[index - 3];

    /* Bullish OB: Rejection after swing low (strong close in candle + next candle reverses) */
    if (current.close > current.open && /* bullish candle */
        prev1.close < prev1.open && /* previous was bearish */
        current.high > prev1.high){ /* broke higher */
      return {
        type: 'BULLISH_OB',
        blockHigh: current.high,
        blockLow: current.low,
        blockZone: { high: current.high, low: Math.min(current.low, prev1.low) },
        strength: 'INSTITUTIONAL_ENTRY'
      };
    }

    /* Bearish OB: Rejection after swing high */
    if (current.close < current.open && /* bearish candle */
        prev1.close > prev1.open && /* previous was bullish */
        current.low < prev1.low){ /* broke lower */
      return {
        type: 'BEARISH_OB',
        blockHigh: current.high,
        blockLow: current.low,
        blockZone: { high: Math.max(current.high, prev1.high), low: current.low },
        strength: 'INSTITUTIONAL_ENTRY'
      };
    }

    return null;
  }catch(e){ return null; }
}

/* Breaker block: entry point where institutional traders entered, now resistance/support */
function hgDetectBreakerBlock(candles, index){
  if (!candles || candles.length < 8 || index < 7) return null;
  try{
    var current = candles[index];
    var swingRef = candles[index - 4];

    /* Bullish breaker: Price broke below swing low, then recovered above it = breaker block */
    if (current.close > swingRef.low && 
        candles[index - 1].low < swingRef.low){
      return {
        type: 'BULLISH_BREAKER',
        breakerLevel: swingRef.low,
        direction: 'LONG_ENTRY',
        confluenceStrength: 'HIGH'
      };
    }

    /* Bearish breaker: Price broke above swing high, then fell below it */
    if (current.close < swingRef.high && 
        candles[index - 1].high > swingRef.high){
      return {
        type: 'BEARISH_BREAKER',
        breakerLevel: swingRef.high,
        direction: 'SHORT_ENTRY',
        confluenceStrength: 'HIGH'
      };
    }

    return null;
  }catch(e){ return null; }
}

/* Liquidity void: area where price hasn't traded, likely target for institutional orders */
function hgDetectLiquidityVoid(candles, highestHigh, lowestLow){
  if (!candles || candles.length < 20) return null;
  try{
    var voids = [];
    var priceRange = highestHigh - lowestLow;
    var voidThreshold = priceRange * 0.02;  /* 2% of range */

    for (var i = 5; i < candles.length - 1; i++){
      var gap = candles[i].low - candles[i - 1].high;
      if (gap > voidThreshold){
        voids.push({
          type: 'LIQUIDITY_VOID_UP',
          top: candles[i].low,
          bottom: candles[i - 1].high,
          voidSize: gap,
          likelihood: 'PRICE_ATTRACTION'
        });
      }
      gap = candles[i - 1].low - candles[i].high;
      if (gap > voidThreshold){
        voids.push({
          type: 'LIQUIDITY_VOID_DOWN',
          top: candles[i - 1].low,
          bottom: candles[i].high,
          voidSize: gap,
          likelihood: 'PRICE_ATTRACTION'
        });
      }
    }

    return voids.length > 0 ? voids : null;
  }catch(e){ return null; }
}

/* Smart money composite: order blocks + FVG + liquidity voids */
function hgDetectSmartMoneyZones(candles){
  if (!candles || candles.length < 5) return { zones: [], count: 0 };
  try{
    var zones = [];
    var index = candles.length - 1;

    /* Recent order block */
    var ob = hgDetectOrderBlock(candles, index);
    if (ob) zones.push(ob);

    /* Recent FVG */
    var fvg = hgDetectFVG(candles, index);
    if (fvg) zones.push(fvg);

    /* Recent breaker block */
    var bb = hgDetectBreakerBlock(candles, index);
    if (bb) zones.push(bb);

    /* Liquidity voids */
    var highest = Math.max.apply(null, candles.map(function(c){ return c.high; }));
    var lowest = Math.min.apply(null, candles.map(function(c){ return c.low; }));
    var voids = hgDetectLiquidityVoid(candles, highest, lowest);
    if (voids) zones = zones.concat(voids);

    return {
      zones: zones,
      count: zones.length,
      smartMoneyConfidence: zones.length > 2 ? 0.8 : zones.length > 0 ? 0.5 : 0.2,
      institutionalSetup: zones.length > 2
    };
  }catch(e){
    return { zones: [], count: 0, smartMoneyConfidence: 0 };
  }
}

G.hgDetectFVG = hgDetectFVG;
G.hgDetectOrderBlock = hgDetectOrderBlock;
G.hgDetectBreakerBlock = hgDetectBreakerBlock;
G.hgDetectLiquidityVoid = hgDetectLiquidityVoid;
G.hgDetectSmartMoneyZones = hgDetectSmartMoneyZones;
