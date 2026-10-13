/* =========================================================================
HARDGATE — candle-confluence.js  (ULTIMATE AI CONFLUENCE)
============================================================================
WHY THIS EXISTS
The v14-3 forecaster checked FOUR reads and required two of them to agree
before it would name a direction. On a mid-range 15m bar that is common, so
the tab kept answering "NO DIRECTIONAL CALL" and printed no target and no
stop.

This engine widens the evidence and always hands back a bracket.

WHAT IT IS, SAID PLAINLY
A confluence tally. Fifteen independent reads of the same tape, each voting
-1 / 0 / +1, summed into one score. It is NOT a model that has been trained,
it is NOT a probability, and it makes NO accuracy claim. What it does is
count evidence and say how much of it points the same way -- and, when the
count is too thin to name a side, it still prints the levels so the reader
has a bracket rather than a shrug.

LEVELS
entry = last close
risk  = max(ATR14, half the last bar's range)   -- a floor, never a cap
TP1   = entry +/- 1R      TP2 = entry +/- 2R
SL    = entry -/+ 1R
The band (one ATR around the last close) is printed beside them. Every level
is ATR-DERIVED; none of them is a measured edge.

READS (equal weight -- the weights are NOT fitted, and the card says so)
   1 EMA stack 9/21/50      9 close position in bar
   2 EMA9 slope, 3 bars    10 one-sided wick rejection
   3 RSI(14) level         11 volume trend (5 vs 20)
   4 RSI slope             12 ROC(10) momentum
   5 MACD histogram        13 mean-reversion z (ATR units)
   6 MACD slope            14 ATR expansion
   7 Stochastic %K/%D      15 close run (consecutive bars)
   8 Bollinger %B
Plus, when the repo's Pine ports are loaded, their votes join the tally
through the existing one-home readers (never a second copy).
======================================================================== */
(function (root) {
  'use strict';

  function num(v){ return (typeof v === 'number' && isFinite(v)) ? v : NaN; }
  function last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }

  function ema(vals, p){
    var out = new Array(vals.length); out[0] = vals[0];
    var k = 2 / (p + 1);
    for (var i = 1; i < vals.length; i++) out[i] = vals[i] * k + out[i - 1] * (1 - k);
    return out;
  }
  function sma(vals, p, i){
    if (i + 1 < p) return NaN;
    var s = 0;
    for (var j = i - p + 1; j <= i; j++) s += vals[j];
    return s / p;
  }
  function stdev(vals, p, i){
    if (i + 1 < p) return NaN;
    var m = sma(vals, p, i), s = 0;
    for (var j = i - p + 1; j <= i; j++) s += (vals[j] - m) * (vals[j] - m);
    return Math.sqrt(s / p);
  }
  function atrSeries(rows, p){
    var trs = [];
    for (var i = 0; i < rows.length; i++){
      if (!i){ trs.push(rows[i].h - rows[i].l); continue; }
      var pc = rows[i - 1].c;
      trs.push(Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - pc), Math.abs(rows[i].l - pc)));
    }
    var out = [], s = 0;
    for (var j = 0; j < trs.length; j++){
      s += trs[j];
      if (j >= p) s -= trs[j - p];
      out.push(j >= p - 1 ? s / p : trs[j]);
    }
    return out;
  }
  function rsi(closes, p){
    var out = new Array(closes.length).fill(NaN);
    if (closes.length <= p) return out;
    var g = 0, l = 0, i;
    for (i = 1; i <= p; i++){
      var d = closes[i] - closes[i - 1];
      if (d >= 0) g += d; else l -= d;
    }
    g /= p; l /= p;
    out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (i = p + 1; i < closes.length; i++){
      var d2 = closes[i] - closes[i - 1];
      g = (g * (p - 1) + (d2 > 0 ? d2 : 0)) / p;
      l = (l * (p - 1) + (d2 < 0 ? -d2 : 0)) / p;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  }

  /* ---- the fifteen reads. Each returns { id, label, vote, note } ------- */
  function readAll(rows){
    var out = [], n = rows.length;
    var closes = rows.map(function(r){ return r.c; });
    var vols = rows.map(function(r){ return num(r.v) || 0; });
    var i = n - 1, b = rows[i];
    var atr = atrSeries(rows, 14), a = last(atr);

    /* 1 EMA stack */
    var e9 = ema(closes, 9), e21 = ema(closes, 21), e50 = ema(closes, Math.min(50, n - 1));
    var stackUp = e9[i] > e21[i] && e21[i] > e50[i];
    var stackDn = e9[i] < e21[i] && e21[i] < e50[i];
    out.push({ id: 'emastack', label: 'EMA stack 9/21/50', vote: stackUp ? 1 : (stackDn ? -1 : 0),
      note: stackUp ? 'stacked up' : (stackDn ? 'stacked down' : 'not stacked') });

    /* 2 EMA9 slope over three bars */
    var d3 = e9[i] - e9[i - 3];
    var thr = (isFinite(a) ? a : 0) * 0.10;
    out.push({ id: 'emaslope', label: 'EMA9 slope (3 bars)', vote: d3 > thr ? 1 : (d3 < -thr ? -1 : 0),
      note: 'moved ' + (isFinite(d3) ? d3.toFixed(2) : 'n/a') });

    /* 3 RSI level */
    var r = rsi(closes, 14), rv = r[i];
    out.push({ id: 'rsi', label: 'RSI(14)', vote: rv > 55 ? 1 : (rv < 45 ? -1 : 0),
      note: isFinite(rv) ? rv.toFixed(1) : 'n/a' });

    /* 4 RSI slope */
    var rd = rv - r[i - 3];
    out.push({ id: 'rsislope', label: 'RSI slope (3 bars)', vote: rd > 2 ? 1 : (rd < -2 ? -1 : 0),
      note: isFinite(rd) ? (rd > 0 ? '+' : '') + rd.toFixed(1) : 'n/a' });

    /* 5/6 MACD histogram + slope */
    var e12 = ema(closes, 12), e26 = ema(closes, 26), macd = [], sig = [];
    for (var k = 0; k < n; k++) macd.push(e12[k] - e26[k]);
    var s9 = ema(macd, 9);
    for (var k2 = 0; k2 < n; k2++) sig.push(macd[k2] - s9[k2]);
    var h = sig[i], hp = sig[i - 1];
    out.push({ id: 'macd', label: 'MACD histogram', vote: h > 0 ? 1 : (h < 0 ? -1 : 0),
      note: isFinite(h) ? h.toFixed(3) : 'n/a' });
    out.push({ id: 'macdslope', label: 'MACD slope (1 bar)', vote: h > hp ? 1 : (h < hp ? -1 : 0),
      note: h > hp ? 'rising' : 'falling' });

    /* 7 Stochastic %K vs %D */
    var hh = -Infinity, ll = Infinity;
    for (var m = i - 13; m <= i; m++){ if (rows[m].h > hh) hh = rows[m].h; if (rows[m].l < ll) ll = rows[m].l; }
    var kNow = hh > ll ? (b.c - ll) / (hh - ll) * 100 : 50;
    var kVals = [];
    for (var q = Math.max(0, i - 16); q <= i; q++){
      var h2 = -Infinity, l2 = Infinity;
      for (var p2 = Math.max(0, q - 13); p2 <= q; p2++){ if (rows[p2].h > h2) h2 = rows[p2].h; if (rows[p2].l < l2) l2 = rows[p2].l; }
      kVals.push(h2 > l2 ? (rows[q].c - l2) / (h2 - l2) * 100 : 50);
    }
    var dNow = last(kVals);
    out.push({ id: 'stoch', label: 'Stochastic %K/%D', vote: kNow > dNow && kNow > 50 ? 1 : (kNow < dNow && kNow < 50 ? -1 : 0),
      note: 'K ' + kNow.toFixed(0) + ' / D ' + dNow.toFixed(0) });

    /* 8 Bollinger %B */
    var m20 = sma(closes, 20, i), sd20 = stdev(closes, 20, i);
    var pb = (sd20 > 0) ? (b.c - (m20 - 2 * sd20)) / (4 * sd20) : 0.5;
    out.push({ id: 'bb', label: 'Bollinger %B', vote: pb > 0.6 ? 1 : (pb < 0.4 ? -1 : 0),
      note: pb.toFixed(2) });

    /* 9 close position in the bar */
    var rng = b.h - b.l;
    var pos = rng > 0 ? (b.c - b.l) / rng : 0.5;
    out.push({ id: 'closepos', label: 'Close position in bar', vote: pos > 0.66 ? 1 : (pos < 0.34 ? -1 : 0),
      note: pos > 0.66 ? 'top third' : (pos < 0.34 ? 'bottom third' : 'mid-range') });

    /* 10 one-sided wick */
    var upW = b.h - Math.max(b.o, b.c), dnW = Math.min(b.o, b.c) - b.l;
    var wv = 0, wn = 'balanced';
    if (rng > 0){
      if (dnW > rng * 0.5 && upW < rng * 0.2){ wv = 1; wn = 'long lower wick (buyers stepped in)'; }
      else if (upW > rng * 0.5 && dnW < rng * 0.2){ wv = -1; wn = 'long upper wick (sellers stepped in)'; }
    }
    out.push({ id: 'wick', label: 'One-sided wick', vote: wv, note: wn });

    /* 11 volume trend: last 5 vs prior 20 */
    var v5 = 0, v20 = 0, c5 = 0, c20 = 0;
    for (var v1 = i; v1 > i - 25 && v1 >= 0; v1--){
      if (v1 > i - 5){ v5 += vols[v1]; c5++; } else { v20 += vols[v1]; c20++; }
    }
    var av5 = c5 ? v5 / c5 : 0, av20 = c20 ? v20 / c20 : 0;
    var volUp = av20 > 0 && av5 > av20 * 1.15;
    out.push({ id: 'volume', label: 'Volume trend (5 vs 20)', vote: volUp ? (b.c >= b.o ? 1 : -1) : 0,
      note: volUp ? 'expanding with the bar' : 'flat' });

    /* 12 ROC(10) */
    var roc = (i >= 10 && closes[i - 10] > 0) ? (closes[i] / closes[i - 10] - 1) * 100 : NaN;
    out.push({ id: 'roc', label: 'ROC(10)', vote: roc > 0.1 ? 1 : (roc < -0.1 ? -1 : 0),
      note: isFinite(roc) ? roc.toFixed(2) + '%' : 'n/a' });

    /* 13 mean-reversion z in ATR units */
    var z = (isFinite(a) && a > 0 && isFinite(m20)) ? (b.c - m20) / a : 0;
    out.push({ id: 'zscore', label: 'Mean-reversion z (ATR)', vote: z < -1.5 ? 1 : (z > 1.5 ? -1 : 0),
      note: isFinite(z) ? z.toFixed(2) + ' ATR from the 20-SMA' : 'n/a' });

    /* 14 ATR expansion */
    var aPrev = atr[i - 5];
    var expanding = isFinite(a) && isFinite(aPrev) && a > aPrev * 1.1;
    out.push({ id: 'atr', label: 'ATR expansion', vote: expanding ? (b.c >= b.o ? 1 : -1) : 0,
      note: expanding ? 'volatility expanding' : 'volatility steady' });

    /* 15 close run */
    var run = 0, dir0 = b.c >= b.o ? 1 : -1;
    for (var w = i; w > 0 && w > i - 6; w--){
      var dd = rows[w].c >= rows[w].o ? 1 : -1;
      if (dd !== dir0) break;
      run++;
    }
    out.push({ id: 'run', label: 'Close run', vote: run >= 3 ? dir0 : 0,
      note: run >= 3 ? run + ' consecutive ' + (dir0 > 0 ? 'up' : 'down') : 'no run' });

    /* the repo's Pine ports, through their existing one home (never a copy) */
    try {
      var ports = [
        ['pineSqueezeMomentum', 'Squeeze Momentum'],
        ['pineHalfTrend', 'HalfTrend'],
        ['pineSmartMoneyFlow', 'Smart Money Flow'],
        ['pineVumanchuCipher', 'VuManChu Cipher'],
        ['pineLorentzianKernel', 'Lorentzian'],
        ['pineRangeFilter', 'Range Filter'],
        ['pineSmcCore', 'SMC Core']
      ];
      for (var pi = 0; pi < ports.length; pi++){
        var fn = root[ports[pi][0]];
        if (typeof fn !== 'function') continue;
        var res = null;
        try { res = fn(rows, {}); } catch (eP) { res = null; }
        if (!res || !res.dir) continue;
        var v = String(res.dir).toLowerCase() === 'long' ? 1 : (String(res.dir).toLowerCase() === 'short' ? -1 : 0);
        if (!v) continue;
        out.push({ id: ports[pi][0], label: ports[pi][1] + ' (Pine)', vote: v,
          note: 'port says ' + String(res.dir) });
      }
    } catch (ePorts) { /* a missing port is unread, never a guess */ }

    return { reads: out, atr: a, close: b.c, bar: b };
  }

  /* ---- the engine ------------------------------------------------------ */
  function hgUltimateConfluence(rows, opts){
    try {
      opts = opts || {};
      if (!Array.isArray(rows) || rows.length < 30) return null;
      var R = readAll(rows);
      var reads = R.reads;
      var score = 0, agree = 0, oppose = 0, checked = reads.length;
      for (var i = 0; i < reads.length; i++){
        score += reads[i].vote;
        if (reads[i].vote > 0) agree++;
        else if (reads[i].vote < 0) oppose++;
      }
      var bullish = score > 0 ? agree : oppose;   /* votes on the leading side */
      var quorum = isFinite(opts.quorum) ? opts.quorum : 3;
      var dir = (Math.abs(score) >= quorum) ? (score > 0 ? 'BULL' : 'BEAR') : 'NO CALL';
      var grade = 'NO EDGE';
      if (dir !== 'NO CALL'){
        var mag = Math.abs(score);
        grade = mag >= 6 ? 'ULTIMATE' : (mag >= 5 ? 'STRONG' : 'MODERATE');
      } else if (Math.abs(score) === 2) grade = 'LEAN ONLY';

      /* the levels: ATR-derived, ALWAYS emitted so a reader has a bracket */
      var a = R.atr, b = R.bar, close = R.close;
      var risk = isFinite(a) && a > 0 ? a : (b.h - b.l);
      risk = Math.max(risk, (b.h - b.l) * 0.5);
      var longSide = dir !== 'BEAR';                 /* NO CALL -> show the long bracket first */
      var mk = function(side){
        var s = side === 'long' ? 1 : -1;
        return {
          side: side,
          entry: +close.toFixed(2),
          sl: +(close - s * risk).toFixed(2),
          tp1: +(close + s * risk).toFixed(2),
          tp2: +(close + s * risk * 2).toFixed(2)
        };
      };
      return {
        id: 'ultimate-confluence',
        dir: dir,
        grade: grade,
        score: score,
        checked: checked,
        agree: agree,
        oppose: oppose,
        abstain: checked - agree - oppose,
        reads: reads,
        atr: isFinite(a) ? +a.toFixed(2) : null,
        close: +close.toFixed(2),
        bandLow: isFinite(a) ? +(close - a).toFixed(2) : null,
        bandHigh: isFinite(a) ? +(close + a).toFixed(2) : null,
        bracket: mk(dir === 'BEAR' ? 'short' : 'long'),
        bothBrackets: dir === 'NO CALL' ? [mk('long'), mk('short')] : null,
        note: 'Confluence tally of ' + checked + ' independent reads. Equal weight, no fitted '
            + 'parameters, NOT a probability and NOT a backtested edge. Levels are ATR-derived.'
      };
    } catch (e) { return null; }
  }

  root.hgUltimateConfluence = hgUltimateConfluence;
  if (typeof module !== 'undefined' && module.exports) module.exports = { hgUltimateConfluence: hgUltimateConfluence };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
