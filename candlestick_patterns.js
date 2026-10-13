/* =========================================================================
HARDGATE — candlestick_patterns.js
Advanced Candlestick Pattern Recognition Engine.
Provides detection of classic and advanced formations for confluence.
========================================================================= */
(function(){
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;

  /**
   * Detects candlestick patterns on a series of OHLC bars.
   * @param {Array} rows - Array of {o, h, l, c} objects.
   * @returns {Array} Array of detected pattern names and their details.
   */
  function detectPatterns(rows) {
    if (!rows || rows.length < 3) return [];
    var patterns = [];
    var n = rows.length;

    for (var i = 1; i < n - 1; i++) {
      var prev = rows[i-1];
      var curr = rows[i];
      var next = rows[i+1];

      // Helper values
      var bodyCurr = Math.abs(curr.c - curr.o);
      var rangeCurr = curr.h - curr.l;
      if (rangeCurr === 0) continue;

      var bodyPrev = Math.abs(prev.c - prev.o);
      var rangePrev = prev.h - prev.l;

      // 1. Engulfing Patterns
      if (curr.c > curr.o && prev.c < prev.o && curr.c >= prev.h && curr.o <= prev.l) {
        patterns.push({ name: 'Bullish Engulfing', dir: 'long', i: i });
      } else if (curr.c < curr.o && prev.c > prev.o && curr.c <= prev.l && curr.o >= prev.h) {
        patterns.push({ name: 'Bearish Engulfing', dir: 'short', i: i });
      }

      // 2. Hammer / Shooting Star (using body/wick ratio)
      var lowerWick = Math.min(curr.c, curr.o) - curr.l;
      var upperWick = curr.h - Math.max(curr.c, curr.o);
      if (lowerWick > bodyCurr * 2 && upperWick < bodyCurr * 0.5) {
        patterns.push({ name: 'Hammer', dir: 'long', i: i });
      } else if (upperWick > bodyCurr * 2 && lowerWick < bodyCurr * 0.5) {
        patterns.push({ name: 'Shooting Star', dir: 'short', i: i });
      }

      // 3. Doji
      if (bodyCurr <= rangeCurr * 0.1) {
        patterns.push({ name: 'Doji', dir: null, i: i });
      }

      // 4. Morning / Evening Star
      if (prev.c < prev.o && next.c > next.o && Math.abs(curr.c - curr.o) < rangeCurr * 0.3) {
        patterns.push({ name: 'Morning Star', dir: 'long', i: i });
      } else if (prev.c > prev.o && next.c < next.o && Math.abs(curr.c - curr.o) < rangeCurr * 0.3) {
        patterns.push({ name: 'Evening Star', dir: 'short', i: i });
      }

      // 5. Marubozu (very small body relative to range)
      if (bodyCurr > rangeCurr * 0.9) {
        patterns.push({ name: 'Marubozu', dir: curr.c > curr.o ? 'long' : 'short', i: i });
      }

      // 6. Tweezer Tops/Bottoms
      var isTweezerTop = Math.abs(curr.h - next.h) < (rangeCurr * 0.1) && Math.abs(prev.h - curr.h) < (rangePrev * 0.1);
      if (isTweezerTop) patterns.push({ name: 'Tweezer Top', dir: 'short', i: i });

      var isTweezerBottom = Math.abs(curr.l - next.l) < (rangeCurr * 0.1) && Math.abs(prev.l - curr.l) < (rangePrev * 0.1);
      if (isTweezerBottom) patterns.push({ name: 'Tweezer Bottom', dir: 'long', i: i });
    }

    return patterns;
  }

  // Expose to global scope for the shared engine
  W.hgCfCandlePatterns = detectPatterns;
  W.hgCfAdvancedPatterns = detectPatterns;

})();