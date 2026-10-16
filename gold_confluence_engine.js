/* ==========================================================================
   HARDGATE — gold_confluence_engine.js
   Fallback only. goldind.js owns hgCfBuildSetup, hgCfMeasure and hgCfDaySwings.
   A later script must not replace those. This file fills them in only when
   that engine is absent, and it owns hgCfUltimateConfluence.
   An unread ATR is not a setup. An unread venue spread is named, not zero.
   ========================================================================== */
(function () {
  'use strict';

  var W =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
      ? globalThis
      : this;

  function num(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
    var n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : NaN;
  }

  function barC(b) { return b ? num(b.c !== undefined ? b.c : b.close) : NaN; }
  function barO(b) { return b ? num(b.o !== undefined ? b.o : b.open) : NaN; }
  function barH(b) { return b ? num(b.h !== undefined ? b.h : b.high) : NaN; }
  function barL(b) { return b ? num(b.l !== undefined ? b.l : b.low) : NaN; }

  function calculateATR(candles, period) {
    period = period || 14;
    if (!Array.isArray(candles) || candles.length < 2) return NaN;
    var start = Math.max(1, candles.length - period);
    var sum = 0;
    var count = 0;
    for (var i = start; i < candles.length; i++) {
      var h = barH(candles[i]);
      var l = barL(candles[i]);
      var pc = barC(candles[i - 1]);
      if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(pc)) continue;
      sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      count++;
    }
    return count > 0 ? sum / count : NaN;
  }

  function calculateEMA(candles, period) {
    if (!Array.isArray(candles) || candles.length < period) return NaN;
    var k = 2 / (period + 1);
    var ema = barC(candles[0]);
    if (!Number.isFinite(ema)) return NaN;
    for (var i = 1; i < candles.length; i++) {
      var close = barC(candles[i]);
      if (Number.isFinite(close)) ema = close * k + ema * (1 - k);
    }
    return ema;
  }

  function calculateRSI(candles, period) {
    period = period || 14;
    if (!Array.isArray(candles) || candles.length <= period) return NaN;
    var gains = 0;
    var losses = 0;
    var n = 0;
    for (var i = candles.length - period; i < candles.length; i++) {
      var cur = barC(candles[i]);
      var prev = barC(candles[i - 1]);
      if (!Number.isFinite(cur) || !Number.isFinite(prev)) continue;
      var diff = cur - prev;
      if (diff > 0) gains += diff;
      else losses -= diff;
      n++;
    }
    if (n < period) return NaN;
    if (losses === 0) return gains > 0 ? 100 : NaN;
    var rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  /* |spot - xm| from GOLD SPOT. Missing either leg is unread. */
  function measuredSpread(win) {
    try {
      if (win && typeof win.hgGoldMeasuredSpread === 'function') {
        var named = num(win.hgGoldMeasuredSpread(win));
        if (named >= 0) return named;
      }
      if (!win || typeof win.goldspotState !== 'function') return null;
      var sp = win.goldspotState();
      if (!sp || typeof sp !== 'object') return null;
      var a = num(sp.spot), b = num(sp.xm);
      if (!(a > 0 && b > 0)) return null;
      return +Math.abs(a - b).toFixed(2);
    } catch (e) { return null; }
  }

  function sideOf(raw) {
    var d = String(raw || '').toUpperCase();
    if (d === 'BULL' || d === 'LONG' || d === 'BUY') return 'long';
    if (d === 'BEAR' || d === 'SHORT' || d === 'SELL') return 'short';
    return null;
  }

  function patternPoint(patterns, dir, nBars) {
    if (Array.isArray(patterns)) {
      var hit = 0;
      patterns.forEach(function (p) {
        if (p && (p.dir === dir || p.dir === null || p.dir === undefined)) hit += 1;
      });
      return { points: hit > 0 ? 1 : 0, list: patterns.filter(function (p) {
        return p && (p.i === nBars - 1 || p.i === undefined);
      }) };
    }
    if (patterns && typeof patterns === 'object') {
      var bull = num(patterns.bullVotes);
      var bear = num(patterns.bearVotes);
      var withSide = dir === 'long' ? bull : bear;
      var against = dir === 'long' ? bear : bull;
      if (withSide > 0 && !(against > 0)) return { points: 1, list: [] };
    }
    return { points: 0, list: [] };
  }

  function buildSetup(candles, options, forecast) {
    if (!Array.isArray(candles) || candles.length < 20) return null;
    options = options || {};
    forecast = forecast || {};
    var dir = sideOf(forecast.dir || forecast.side);
    if (!dir) return null;

    var patternConfluence = 0;
    var patternList = [];
    try {
      var raw = typeof W.hgCfCandlePatterns === 'function' ? W.hgCfCandlePatterns(candles) : [];
      var pack = patternPoint(raw, dir, candles.length);
      patternConfluence = pack.points;
      patternList = pack.list;
    } catch (ePat) { patternConfluence = 0; }

    var indicatorConfluence = 0;
    var last = candles[candles.length - 1];
    var prev = candles[candles.length - 2];
    var lastC = barC(last), lastO = barO(last), prevC = barC(prev), prevO = barO(prev);
    if (Number.isFinite(lastC) && Number.isFinite(lastO) && Number.isFinite(prevC) && Number.isFinite(prevO)) {
      if ((dir === 'long' && lastC > lastO && prevC <= prevO) ||
          (dir === 'short' && lastC < lastO && prevC >= prevO)) indicatorConfluence += 1;
    }

    var ema20 = calculateEMA(candles, 20);
    if (Number.isFinite(ema20) && Number.isFinite(lastC) &&
        ((dir === 'long' && lastC > ema20) || (dir === 'short' && lastC < ema20))) {
      indicatorConfluence += 1;
    }

    var rsi14 = calculateRSI(candles, 14);
    if (Number.isFinite(rsi14) &&
        ((dir === 'long' && rsi14 >= 52 && rsi14 <= 72) ||
         (dir === 'short' && rsi14 <= 48 && rsi14 >= 28))) {
      indicatorConfluence += 1;
    }

    var macroConfluence = 0;
    var newsLocked = Boolean(options.newsLock || forecast.newsLock);
    if (!newsLocked && forecast.macroRead) macroConfluence += 1;

    var totalScore = patternConfluence + indicatorConfluence + macroConfluence;
    if (totalScore < 2) return null;

    var atr = calculateATR(candles, 14);
    if (!(atr > 0) || !Number.isFinite(lastC)) return null;

    var entry = Number(lastC.toFixed(2));
    var stop = Number((dir === 'long' ? entry - atr * 2 : entry + atr * 2).toFixed(2));
    var t1 = Number((dir === 'long' ? entry + atr * 3 : entry - atr * 3).toFixed(2));
    var t2 = Number((dir === 'long' ? entry + atr * 4.5 : entry - atr * 4.5).toFixed(2));
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;

    var spread = measuredSpread(W);
    if (!(spread >= 0) && Number.isFinite(num(options.spread)) && num(options.spread) >= 0) {
      spread = num(options.spread);
    }
    var spreadRead = Number.isFinite(spread) && spread >= 0;
    var grossReward = Math.abs(t1 - entry);
    var rr = Number((grossReward / risk).toFixed(2));
    var netRr = null;
    var spreadNote = 'The venue spread was not read.';
    if (spreadRead) {
      netRr = Number((Math.max(0, grossReward - spread) / risk).toFixed(2));
      spreadNote = 'Measured spread $' + spread.toFixed(2) + '.';
    }

    var grade = totalScore >= 4 ? 'A+' : totalScore >= 3 ? 'A' : 'B';
    return {
      side: dir,
      dir: dir,
      entry: entry,
      stop: stop,
      t1: t1,
      t2: t2,
      rr: rr,
      netRr: netRr,
      spread: spreadRead ? Number(spread.toFixed(2)) : null,
      grade: grade,
      crowned: totalScore >= 3,
      qualifies: totalScore >= 3,
      score: totalScore,
      confluence: Math.min(1, totalScore / 5),
      patterns: patternList,
      note: 'Confluence Score: ' + totalScore + '/5 (' + patternConfluence +
        ' Patterns, ' + indicatorConfluence + ' Indicators, ' + macroConfluence +
        ' Macro). ' + spreadNote
    };
  }

  function ultimateConfluence(scalp, swing) {
    if (!scalp || !swing) return null;
    var scalpDir = sideOf(scalp.side || scalp.dir) || (scalp.side === 'long' || scalp.side === 'short' ? scalp.side : null);
    var swingDir = sideOf(swing.side || swing.dir) || (swing.side === 'long' || swing.side === 'short' ? swing.side : null);
    if (!scalpDir && (scalp.dir === 'long' || scalp.dir === 'short')) scalpDir = scalp.dir;
    if (!swingDir && (swing.dir === 'long' || swing.dir === 'short')) swingDir = swing.dir;
    var dirMatch = Boolean(scalpDir && swingDir && scalpDir === swingDir);
    var sScore = num(scalp.score);
    var wScore = num(swing.score);
    var scoreMatch = Number.isFinite(sScore) && Number.isFinite(wScore) && Math.abs(sScore - wScore) <= 2;
    var e1 = num(scalp.entry), e2 = num(swing.entry);
    var s1 = num(scalp.stop), s2 = num(swing.stop);
    var tA = num(scalp.t1 !== undefined ? scalp.t1 : scalp.tp1);
    var tB = num(swing.t1 !== undefined ? swing.t1 : swing.tp1);
    var prices = dirMatch && [e1, e2, s1, s2, tA, tB].every(function (x) { return Number.isFinite(x) && x > 0; });
    return {
      agreement: dirMatch && scoreMatch,
      direction: dirMatch ? scalpDir : null,
      side: dirMatch ? scalpDir : null,
      entry: prices ? Number(((e1 + e2) / 2).toFixed(2)) : null,
      stop: prices ? Number(((s1 + s2) / 2).toFixed(2)) : null,
      t1: prices ? Number(((tA + tB) / 2).toFixed(2)) : null,
      grade: dirMatch && scoreMatch ? 'A' : 'WATCH',
      crowned: dirMatch && scoreMatch,
      confidence: (Number.isFinite(sScore) && Number.isFinite(wScore))
        ? Math.min(1, (sScore + wScore) / 10) : null,
      note: dirMatch ? 'Scalp and Swing in alignment' : 'Divergent horizons detected',
      timestamp: Date.now()
    };
  }

  function measure(scalp, swing, candles) {
    if (!scalp || !swing) return null;
    var atr = calculateATR(candles || [], 14);
    var sScore = num(scalp.score);
    var wScore = num(swing.score);
    return {
      volatility: atr > 0 ? atr : null,
      trendStrength: (Number.isFinite(sScore) && Number.isFinite(wScore) && wScore !== 0) ? sScore / wScore : null,
      horizonAligned: (scalp.side || scalp.dir) === (swing.side || swing.dir) && !!(scalp.side || scalp.dir)
    };
  }

  function daySwings(c4) {
    if (!Array.isArray(c4) || c4.length < 30) {
      return { ok: false, setups: [], why: 'Insufficient data' };
    }
    var atr = calculateATR(c4, 14);
    var ema20 = calculateEMA(c4, 20);
    var rsi14 = calculateRSI(c4, 14);
    var close = barC(c4[c4.length - 1]);
    if (!Number.isFinite(close) || !(atr > 0) || !Number.isFinite(ema20)) {
      return { ok: false, setups: [], why: 'Invalid candle prices' };
    }
    var dir = close >= ema20 ? 'long' : 'short';
    var entry = Number(close.toFixed(2));
    var stop = Number((dir === 'long' ? entry - atr * 1.8 : entry + atr * 1.8).toFixed(2));
    var t1 = Number((dir === 'long' ? entry + atr * 3.0 : entry - atr * 3.0).toFixed(2));
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return { ok: false, setups: [], why: 'Invalid candle prices' };
    var rsiOk = (dir === 'long' && Number.isFinite(rsi14) && rsi14 >= 52) ||
                (dir === 'short' && Number.isFinite(rsi14) && rsi14 <= 48);
    return {
      ok: true,
      setups: [{
        id: 'cf-4h-swing',
        tf: '4H',
        side: dir,
        dir: dir,
        entry: entry,
        stop: stop,
        t1: t1,
        rr: Number((Math.abs(t1 - entry) / risk).toFixed(2)),
        rsi: Number.isFinite(rsi14) ? Number(rsi14.toFixed(1)) : null,
        grade: rsiOk ? 'A' : 'B',
        crowned: rsiOk
      }],
      atr: atr,
      ema20: ema20,
      rsi: Number.isFinite(rsi14) ? rsi14 : null
    };
  }

  if (typeof W.hgCfBuildSetup !== 'function') W.hgCfBuildSetup = buildSetup;
  if (typeof W.hgCfMeasure !== 'function') W.hgCfMeasure = measure;
  if (typeof W.hgCfDaySwings !== 'function') W.hgCfDaySwings = daySwings;
  W.hgCfUltimateConfluence = ultimateConfluence;
})();
