/* =========================================================================
HARDGATE — gold_confluence_engine.js
Ultimate AI Confluence Engine for Candle Forecasting.
Combines candlestick patterns, indicators, macro, and multi-timeframe setups.
========================================================================= */
(function(){
  'use strict';

  /**
   * Builds a setup (entry, stop, TP) based on confluence of multiple factors.
   */
  window.hgCfBuildSetup = function(candles, options, forecast) {
    if (!candles || candles.length < 20) return null;
    const tf = options.tf || '15m';
    const dir = forecast.dir === 'BULL' ? 'long' : (forecast.dir === 'BEAR' ? 'short' : null);
    if (!dir) return null;

    // 1. Candlestick Pattern Confluence
    let patternConfluence = 0;
    const patterns = window.hgCfCandlePatterns ? window.hgCfCandlePatterns(candles) : [];
    patterns.forEach(p => {
      if (p.dir === dir || p.dir === null) patternConfluence += 1;
    });

    // 2. Indicator Confluence (EMA/RSI/Supertrend - simplified for this implementation)
    let indicatorConfluence = 0;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    if ((dir === 'long' && last.c > last.o && prev.c <= prev.o) || (dir === 'short' && last.c < last.o && prev.c >= prev.o)) {
      indicatorConfluence += 1;
    }

    // 3. Macro/News Confluence
    let macroConfluence = 0;
    if (forecast.macroRead) macroConfluence += 1;

    const totalScore = patternConfluence + indicatorConfluence + macroConfluence;
    if (totalScore < 2) return null; // Require at least 2 factors for a "real" setup

    // Calculate levels based on ATR-like volatility
    const atr = calculateATR(candles, 14);
    const entry = last.c;
    const stop = dir === 'long' ? entry - (atr * 2) : entry + (atr * 2);
    const t1 = dir === 'long' ? entry + (atr * 3) : entry - (atr * 3);

    return {
      dir: dir,
      entry: entry,
      stop: stop,
      t1: t1,
      score: totalScore,
      confluence: totalScore / 5, // Normalized score
      patterns: patterns.filter(p => p.i === candles.length - 1),
      note: `Confluence Score: ${totalScore}/5 (${patternConfluence} Patterns, ${indicatorConfluence} Indicators, ${macroConfluence} Macro)`
    };
  };

  function calculateATR(candles, period) {
    if (candles.length < period) return 0;
    let sum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i-1];
      sum += Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c));
    }
    return sum / period;
  }

  /**
   * Ultimate Confluence: Combines Scalp and Swing setups into one high-conviction signal.
   */
  window.hgCfUltimateConfluence = function(scalp, swing) {
    if (!scalp || !swing) return null;
    const dirMatch = scalp.dir === swing.dir;
    const scoreMatch = Math.abs(scalp.score - swing.score) < 2;

    return {
      agreement: dirMatch && scoreMatch,
      direction: scalp.dir,
      confidence: (scalp.score + swing.score) / 10,
      note: dirMatch ? 'Scalp and Swing in alignment' : 'Divergent horizons detected',
      timestamp: Date.now()
    };
  };

  window.hgCfMeasure = function(scalp, swing, candles) {
    if (!scalp || !swing) return null;
    return {
      volatility: calculateATR(candles, 14),
      trendStrength: scalp.score / (swing.score || 1)
    };
  };

  window.hgCfDaySwings = function(c4, options) {
    if (!c4 || c4.length < 30) return { ok: false, setups: [], why: 'Insufficient data' };
    return { ok: true, setups: [] }; // Placeholder for day swings logic
  };

})();