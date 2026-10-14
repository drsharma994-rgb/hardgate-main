/* =========================================================================
HARDGATE — candlestick_patterns.js
Advanced Candlestick Pattern Recognition Engine.
Provides detection of classic and advanced formations for confluence.
========================================================================= */
(function(){
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalthis;

  /**
   * Detects candlestick patterns on a series of OHLC bars.
   * @param {Array} rows - Array of {o, h, l, c} objects.
   * @returns {Object} Object with bullVotes, bearVotes, bullNames, bearNames.
   */
  function detectPatterns(rows) {
    var res = {
      bullVotes: 0,
      bearVotes: 0,
      bullNames: [],
      bearNames: []
    };

    if (!rows || rows.length < 3) return res;
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
        res.bullVotes++;
        res.bullNames.push('Bullish Engulfing');
      } else if (curr.c < curr.o && prev.c > prev.o && curr.c <= prev.l && curr.o >= prev.h) {
        res.bearVotes++;
        res.bearNames.push('Bearish Engulfing');
      }

      // 2. Hammer / Shooting Star (using body/wick ratio)
      var lowerWick = Math.min(curr.c, curr.o) - curr.l;
      var upperWick = curr.h - Math.max(curr.c, curr.o);
      if (lowerWick > bodyCurr * 2 && upperWick < bodyCurr * 0.5) {
        res.bullVotes++;
        res.bullNames.push('Hammer');
      } else if (upperWick > bodyCurr * 2 && lowerWick < bodyCurr * 0.5) {
        res.bearVotes++;
        res.bearNames.push('Shooting Star');
      }

      // 3. Doji
      if (bodyCurr <= rangeCurr * 0.1) {
        res.bullVotes++; // Neutral/Doji can be considered a vote for both or neutral
        res.bearVotes++;
        res.bullNames.push('Doji');
        res.bearNames.push('Doji');
      }

      // 4. Morning / Evening Star
      if (prev.c < prev.o && next.c > next.o && Math.abs(curr.c - curr.o) < rangeCurr * 0.3) {
        res.bullVotes++;
        res.bullNames.push('Morning Star');
      } else if (prev.c > prev.o && next.c < next.o && Math.abs(curr.c - curr.o) < rangeCurr * 0.3) {
        res.bearVotes++;
        res.bearNames.push('Evening Star');
      }

      // 5. Marubozu (very small body relative to range)
      if (bodyCurr > rangeCurr * 0.9) {
        if (curr.c > curr.o) {
          res.bullVotes++;
          res.bullNames.push('Marubozu');
        } else {
          res.bearVotes++;
          res.bearNames.push('Marubozu');
        }
      }

      // 6. Tweezer Tops/Bottoms
      var isTweezerTop = Math.abs(curr.h - next.h) < (rangeCurr * 0.1) && Math.abs(prev.h - curr.h) < (rangePrev * 0.1);
      if (isTweezerTop) {
        res.bearVotes++;
        res.bearNames.push('Tweezer Top');
      }

      var isTweezerBottom = Math.abs(curr.l - next.l) < (rangeCurr * 0.1) && Math.abs(prev.l - curr.l) < (rangePrev * 0.1);
      if (isTweezerBottom) {
        res.bullVotes++;
        res.bullNames.push('Tweezer Bottom');
      }
    }

    return res;
  }

  // Expose to global scope for the shared engine
  W.hgCfCandlePatterns = detectPatterns;
  W.hgCfAdvancedPatterns = detectPatterns;

})();