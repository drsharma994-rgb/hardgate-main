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

    /* hg-v1343 fix: this engine used to loop over EVERY bar of the tape and
       accumulate votes across all history — 18 permissive patterns over 120
       bars meant both sides always carried votes, and the doji rule added a
       vote to BOTH sides per doji, so the desk's tie check landed on CLASH
       for nearly every row (160 clashed on the live board). The contract the
       candle desk reads is the NEWEST 3-bar shape — one triad, one read:
       prev / curr / next, with curr = the last CLOSED bar's predecessor... i
       is the triad's middle bar, so the newest complete triad is i = n - 2. */
    var i = n - 2;
    /* a one-iteration loop: the triad is evaluated once, and the pattern
       bodies keep their original continue-based guards. */
    for (i = n - 2; i === n - 2; i++) {
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

      // 3. Doji — hg-v1343 fix: a doji is INDECISION, not a vote for both
      // sides. The old paired vote (+1 bull AND +1 bear per doji) guaranteed
      // exact ties, and the desk's tie check reports a CLASH — so a tape with
      // a single doji could never form a setup. A doji is the quiet bar of
      // patterns: it votes neither side and is named nowhere.

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

      // 6. Tweezer Tops/Bottoms — hg-v1343 fix: the tweezers used to fire on
      // ANY three similar bars, both sides at once (a tweezer bottom AND a
      // tweezer top on the same triad = an instant tie = an instant CLASH).
      // A tweezer is a DEFENDED level: the bottom needs a bullish close off
      // the matched low, the top needs a bearish close off the matched high.
      var isTweezerTop = Math.abs(curr.h - next.h) < (rangeCurr * 0.1) && Math.abs(prev.h - curr.h) < (rangePrev * 0.1) && curr.c < curr.o;
      if (isTweezerTop) {
        res.bearVotes++;
        res.bearNames.push('Tweezer Top');
      }

      var isTweezerBottom = Math.abs(curr.l - next.l) < (rangeCurr * 0.1) && Math.abs(prev.l - curr.l) < (rangePrev * 0.1) && curr.c > curr.o;
      if (isTweezerBottom) {
        res.bullVotes++;
        res.bullNames.push('Tweezer Bottom');
      }
    }

    return res;
  }

  /* The gold candle forecast already owns these two names (goldind.js).
     This reader does not return .names, so replacing them made every
     readable tape throw and the tab report that no verdict came back.
     Install only when that engine is absent. The newest-triad reader
     stays available as hgCandleDeskPatterns either way. */
  W.hgCandleDeskPatterns = detectPatterns;
  if (typeof W.hgCfCandlePatterns !== 'function') W.hgCfCandlePatterns = detectPatterns;
  if (typeof W.hgCfAdvancedPatterns !== 'function') W.hgCfAdvancedPatterns = detectPatterns;

})();