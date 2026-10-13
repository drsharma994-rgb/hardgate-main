/* =========================================================================
HARDGATE — candle-confluence.js   (ULTIMATE AI CONFLUENCE  ·  v2)
============================================================================
WHAT THIS IS
One engine that reads a gold tape three ways and fuses them:

  A. FIFTEEN INDICATOR READS  (EMA stack/slope, RSI + slope, MACD + slope,
     Stochastic, Bollinger %B, close position, wick, volume trend, ROC,
     mean-reversion z in ATR units, ATR expansion, close run)
  B. CANDLESTICK PATTERNS     (18 classic formations, ATR-normalised, each
     carrying location context — see hgCandlePatterns below)
  C. THE GOLD DESKS' OWN EVIDENCE, through their existing one-home readers:
        pineGoldLayerStates    -> the twenty-seven gold Pine layer states
        hgGoldFreeFeedVerdicts -> the free internet feeds (DXY, yields, silver,
                                  VIX, GLD, TLT, UUP, AUD, F&G, funding, basis)
        hgNewsRisk             -> the news blackout gate
     A reader that is absent is UNREAD. Nothing is re-implemented here: this
     file calls the homes that already own those derivations, so a gold desk
     and this tab can never disagree about what a layer says.

OUTPUT
  { scalp, swing, ... }  -- each with dir, grade, tally, bracket, patterns
  plus the gold-desk evidence breakdown.

HONESTY
  A confluence COUNT, not a probability. No fitted weights, no accuracy claim.
  Levels are ATR-derived. When the tally is too thin to name a side, BOTH
  brackets are printed rather than a direction being invented.
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
    for (i = 1; i <= p; i++){ var d = closes[i] - closes[i - 1]; if (d >= 0) g += d; else l -= d; }
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
  function shape(b){
    var rng = b.h - b.l;
    var body = Math.abs(b.c - b.o);
    var top = Math.max(b.o, b.c), bot = Math.min(b.o, b.c);
    return {
      rng: rng, body: body,
      upWick: rng > 0 ? (b.h - top) / rng : 0,
      dnWick: rng > 0 ? (bot - b.l) / rng : 0,
      bodyPct: rng > 0 ? body / rng : 0,
      bull: b.c > b.o, bear: b.c < b.o,
      topThird: rng > 0 ? (b.c - b.l) / rng > 0.66 : false,
      botThird: rng > 0 ? (b.c - b.l) / rng < 0.34 : false
    };
  }

  /* =====================================================================
     B. CANDLESTICK PATTERNS
     Eighteen classic formations read on the LAST CLOSED bar. Each is
     ATR-normalised, so a pattern only counts when it is large against the
     tape's own volatility, and each carries a `where` note saying what the
     bar sat on (the 20-EMA, or how far from it in ATR units).
     A pattern is a SHAPE, not a forecast: it votes, it does not decide.
     ===================================================================== */
  function hgCandlePatterns(rows, opts){
    try {
      if (!Array.isArray(rows) || rows.length < 30) return { patterns: [], atr: NaN };
      var n = rows.length, i = n - 1;
      var a = last(atrSeries(rows, 14));
      var atr = isFinite(a) && a > 0 ? a : (rows[i].h - rows[i].l);
      var closes = rows.map(function(r){ return r.c; });
      var e20 = ema(closes, 20);
      var b = rows[i], p1 = rows[i - 1], p2 = rows[i - 2];
      var s = shape(b), s1 = shape(p1), s2 = shape(p2);
      var out = [];
      var minBody = atr * 0.25;

      var where = (function(){
        if (!isFinite(e20[i])) return '';
        var d = b.c - e20[i];
        if (Math.abs(d) <= atr * 0.25) return ' — at the 20-EMA';
        return (d > 0 ? ' — above' : ' — below') + ' the 20-EMA by ' + (Math.abs(d) / atr).toFixed(2) + ' ATR';
      })();

      function add(id, label, dir, strength, note){
        out.push({ id: id, label: label, dir: dir, strength: strength, note: note + where });
      }

      if (s1.bear && s.bull && b.c >= p1.o && b.o <= p1.c && s.body >= minBody){
        add('engulf-bull', 'Bullish engulfing', 'long', Math.min(3, 1 + s.bodyPct * 2), 'the body swallowed the prior down bar');
      }
      if (s1.bull && s.bear && b.c <= p1.o && b.o >= p1.c && s.body >= minBody){
        add('engulf-bear', 'Bearish engulfing', 'short', Math.min(3, 1 + s.bodyPct * 2), 'the body swallowed the prior up bar');
      }
      if (s1.bear && s.bull && b.c > (p1.o + p1.c) / 2 && b.c < p1.o && s.body >= minBody){
        add('piercing', 'Piercing line', 'long', 2, 'closed back above the midpoint of the prior down bar');
      }
      if (s1.bull && s.bear && b.c < (p1.o + p1.c) / 2 && b.c > p1.o && s.body >= minBody){
        add('darkcloud', 'Dark cloud cover', 'short', 2, 'closed back below the midpoint of the prior up bar');
      }
      if (p1.h <= p2.h && p1.l >= p2.l){
        add('inside', 'Inside bar (compression)', null, 1, 'range inside the prior bar — expansion pending');
      }
      if (b.h > p1.h && b.l < p1.l && s.body >= minBody){
        add('outside', 'Outside bar (engulfing range)', s.bull ? 'long' : 'short', 2, 'range took both sides of the prior bar');
      }
      if (Math.abs(b.l - p1.l) <= atr * 0.05 && s.bull && s1.bear){
        add('tweezer-bot', 'Tweezer bottom', 'long', 2, 'two bars defended the same low');
      }
      if (Math.abs(b.h - p1.h) <= atr * 0.05 && s.bear && s1.bull){
        add('tweezer-top', 'Tweezer top', 'short', 2, 'two bars rejected the same high');
      }
      if (s.dnWick >= 0.5 && s.bodyPct <= 0.35 && s.topThird){
        add('hammer', 'Hammer / pin bar', 'long', 2 + (s.dnWick >= 0.66 ? 1 : 0), 'long lower wick with the close in the top third');
      }
      if (s.upWick >= 0.5 && s.bodyPct <= 0.35 && s.botThird){
        add('shooting', 'Shooting star / pin bar', 'short', 2 + (s.upWick >= 0.66 ? 1 : 0), 'long upper wick with the close in the bottom third');
      }
      if (s.bodyPct <= 0.1 && s.rng >= atr * 0.5){
        add('doji', 'Doji (indecision)', null, 1, 'open and close nearly equal after a real range');
      }
      if (s.bodyPct >= 0.9 && s.rng >= atr * 0.5){
        add('marubozu', 'Marubozu', s.bull ? 'long' : 'short', 2, 'no meaningful wicks — one side owned the bar');
      }
      if (s2.bear && s1.bodyPct <= 0.35 && s.bull && b.c > (p2.o + p2.c) / 2){
        add('morning', 'Morning star', 'long', 3, 'down bar, indecision, then a close back over the first bar midpoint');
      }
      if (s2.bull && s1.bodyPct <= 0.35 && s.bear && b.c < (p2.o + p2.c) / 2){
        add('evening', 'Evening star', 'short', 3, 'up bar, indecision, then a close back under the first bar midpoint');
      }
      if (s.bull && s1.bull && s2.bull && b.c > p1.c && p1.c > p2.c && s.bodyPct >= 0.5 && s1.bodyPct >= 0.5){
        add('three-white', 'Three white soldiers', 'long', 3, 'three rising bullish closes');
      }
      if (s.bear && s1.bear && s2.bear && b.c < p1.c && p1.c < p2.c && s.bodyPct >= 0.5 && s1.bodyPct >= 0.5){
        add('three-black', 'Three black crows', 'short', 3, 'three falling bearish closes');
      }
      return { patterns: out, atr: atr };
    } catch (e){ return { patterns: [], atr: NaN }; }
  }

  /* =====================================================================
     A. THE FIFTEEN INDICATOR READS
     ===================================================================== */
  function readAll(rows){
    var out = [], n = rows.length;
    var closes = rows.map(function(r){ return r.c; });
    var vols = rows.map(function(r){ return num(r.v) || 0; });
    var i = n - 1, b = rows[i];
    var atr = atrSeries(rows, 14), a = last(atr);

    var e9 = ema(closes, 9), e21 = ema(closes, 21), e50 = ema(closes, Math.min(50, n - 1));
    var stackUp = e9[i] > e21[i] && e21[i] > e50[i];
    var stackDn = e9[i] < e21[i] && e21[i] < e50[i];
    out.push({ id: 'emastack', label: 'EMA stack 9/21/50', vote: stackUp ? 1 : (stackDn ? -1 : 0),
      note: stackUp ? 'stacked up' : (stackDn ? 'stacked down' : 'not stacked') });

    var d3 = e9[i] - e9[i - 3], thr = (isFinite(a) ? a : 0) * 0.10;
    out.push({ id: 'emaslope', label: 'EMA9 slope (3 bars)', vote: d3 > thr ? 1 : (d3 < -thr ? -1 : 0),
      note: 'moved ' + (isFinite(d3) ? d3.toFixed(2) : 'n/a') });

    var r = rsi(closes, 14), rv = r[i];
    out.push({ id: 'rsi', label: 'RSI(14)', vote: rv > 55 ? 1 : (rv < 45 ? -1 : 0), note: isFinite(rv) ? rv.toFixed(1) : 'n/a' });
    var rd = rv - r[i - 3];
    out.push({ id: 'rsislope', label: 'RSI slope (3 bars)', vote: rd > 2 ? 1 : (rd < -2 ? -1 : 0),
      note: isFinite(rd) ? (rd > 0 ? '+' : '') + rd.toFixed(1) : 'n/a' });

    var e12 = ema(closes, 12), e26 = ema(closes, 26), macd = [];
    for (var k = 0; k < n; k++) macd.push(e12[k] - e26[k]);
    var s9 = ema(macd, 9), h = macd[i] - s9[i], hp = macd[i - 1] - s9[i - 1];
    out.push({ id: 'macd', label: 'MACD histogram', vote: h > 0 ? 1 : (h < 0 ? -1 : 0), note: isFinite(h) ? h.toFixed(3) : 'n/a' });
    out.push({ id: 'macdslope', label: 'MACD slope (1 bar)', vote: h > hp ? 1 : (h < hp ? -1 : 0), note: h > hp ? 'rising' : 'falling' });

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

    var m20 = sma(closes, 20, i), sd20 = stdev(closes, 20, i);
    var pb = (sd20 > 0) ? (b.c - (m20 - 2 * sd20)) / (4 * sd20) : 0.5;
    out.push({ id: 'bb', label: 'Bollinger %B', vote: pb > 0.6 ? 1 : (pb < 0.4 ? -1 : 0), note: pb.toFixed(2) });

    var rng = b.h - b.l, pos = rng > 0 ? (b.c - b.l) / rng : 0.5;
    out.push({ id: 'closepos', label: 'Close position in bar', vote: pos > 0.66 ? 1 : (pos < 0.34 ? -1 : 0),
      note: pos > 0.66 ? 'top third' : (pos < 0.34 ? 'bottom third' : 'mid-range') });

    var upW = b.h - Math.max(b.o, b.c), dnW = Math.min(b.o, b.c) - b.l, wv = 0, wn = 'balanced';
    if (rng > 0){
      if (dnW > rng * 0.5 && upW < rng * 0.2){ wv = 1; wn = 'long lower wick'; }
      else if (upW > rng * 0.5 && dnW < rng * 0.2){ wv = -1; wn = 'long upper wick'; }
    }
    out.push({ id: 'wick', label: 'One-sided wick', vote: wv, note: wn });

    var v5 = 0, v20 = 0, c5 = 0, c20 = 0;
    for (var v1 = i; v1 > i - 25 && v1 >= 0; v1--){
      if (v1 > i - 5){ v5 += vols[v1]; c5++; } else { v20 += vols[v1]; c20++; }
    }
    var av5 = c5 ? v5 / c5 : 0, av20 = c20 ? v20 / c20 : 0;
    var volUp = av20 > 0 && av5 > av20 * 1.15;
    out.push({ id: 'volume', label: 'Volume trend (5 vs 20)', vote: volUp ? (b.c >= b.o ? 1 : -1) : 0,
      note: volUp ? 'expanding with the bar' : 'flat' });

    var roc = (i >= 10 && closes[i - 10] > 0) ? (closes[i] / closes[i - 10] - 1) * 100 : NaN;
    out.push({ id: 'roc', label: 'ROC(10)', vote: roc > 0.1 ? 1 : (roc < -0.1 ? -1 : 0),
      note: isFinite(roc) ? roc.toFixed(2) + '%' : 'n/a' });

    var z = (isFinite(a) && a > 0 && isFinite(m20)) ? (b.c - m20) / a : 0;
    out.push({ id: 'zscore', label: 'Mean-reversion z (ATR)', vote: z < -1.5 ? 1 : (z > 1.5 ? -1 : 0),
      note: isFinite(z) ? z.toFixed(2) + ' ATR from the 20-SMA' : 'n/a' });

    var aPrev = atr[i - 5], expanding = isFinite(a) && isFinite(aPrev) && a > aPrev * 1.1;
    out.push({ id: 'atr', label: 'ATR expansion', vote: expanding ? (b.c >= b.o ? 1 : -1) : 0,
      note: expanding ? 'volatility expanding' : 'volatility steady' });

    var run = 0, dir0 = b.c >= b.o ? 1 : -1;
    for (var w = i; w > 0 && w > i - 6; w--){
      var dd = rows[w].c >= rows[w].o ? 1 : -1;
      if (dd !== dir0) break;
      run++;
    }
    out.push({ id: 'run', label: 'Close run', vote: run >= 3 ? dir0 : 0,
      note: run >= 3 ? run + ' consecutive ' + (dir0 > 0 ? 'up' : 'down') : 'no run' });

    return { reads: out, atr: a, close: b.c, bar: b };
  }

  /* =====================================================================
     C. THE GOLD DESKS' OWN EVIDENCE — through their existing homes
     ===================================================================== */
  function goldDeskEvidence(rows){
    var ev = { layers: null, feeds: null, news: null, votes: [], notes: [] };
    try {
      if (typeof root.pineGoldLayerStates === 'function'){
        var st = root.pineGoldLayerStates(rows);
        if (st && st.states && typeof st.states === 'object'){
          var L = 0, S = 0, U = 0, key;
          for (key in st.states){
            if (!Object.prototype.hasOwnProperty.call(st.states, key)) continue;
            var v = st.states[key];
            if (v === 'long') L++;
            else if (v === 'short') S++;
            else U++;
          }
          ev.layers = { long: L, short: S, unread: U, total: L + S + U };
          var net = L - S;
          if (L + S > 0){
            ev.votes.push({ id: 'goldlayers', label: 'Gold Pine layers (' + (L + S) + ' reading)',
              vote: net > 0 ? 1 : (net < 0 ? -1 : 0), note: L + ' long / ' + S + ' short / ' + U + ' unread' });
          } else {
            ev.notes.push('the gold Pine layer reader returned no directional states');
          }
        }
      } else ev.notes.push('gold Pine layer reader absent');
    } catch (eL){ ev.notes.push('gold Pine layers unread'); }

    try {
      if (typeof root.hgGoldFreeFeedVerdicts === 'function'){
        var fv = root.hgGoldFreeFeedVerdicts({ rows: rows }, null);
        if (fv && typeof fv === 'object'){
          var fl = 0, fs = 0, fk;
          for (fk in fv){
            if (!Object.prototype.hasOwnProperty.call(fv, fk)) continue;
            if (fv[fk] === true) fl++;
            else if (fv[fk] === false) fs++;
          }
          ev.feeds = { with: fl, against: fs };
          if (fl + fs > 0){
            ev.votes.push({ id: 'freefeeds', label: 'Free feeds (' + (fl + fs) + ' reading)',
              vote: fl > fs ? 1 : (fs > fl ? -1 : 0), note: fl + ' read with / ' + fs + ' against' });
          }
        }
      } else ev.notes.push('free-feed reader absent');
    } catch (eF){ ev.notes.push('free feeds unread'); }

    try {
      if (typeof root.hgNewsRisk === 'function'){
        var nr = root.hgNewsRisk();
        if (nr && typeof nr === 'object'){
          ev.news = { blackout: nr.blackout === true, why: nr.why || '' };
          if (nr.blackout === true) ev.notes.push('NEWS BLACKOUT — ' + (nr.why || 'high-impact event window'));
        }
      } else ev.notes.push('news gate absent');
    } catch (eN){ ev.notes.push('news gate unread'); }
    return ev;
  }

  /* =====================================================================
     THE FUSION
     ===================================================================== */
  function buildOne(rows, opts){
    if (!Array.isArray(rows) || rows.length < 30) return null;
    var R = readAll(rows);
    if (!R) return null;
    var P = hgCandlePatterns(rows, opts);
    var G = goldDeskEvidence(rows);

    var votes = R.reads.slice(), i;
    /* a candle pattern votes with its strength, capped at 2 so a single bar
       can never outweigh a stack of indicators */
    for (i = 0; i < (P.patterns || []).length; i++){
      var pt = P.patterns[i];
      if (pt.dir !== 'long' && pt.dir !== 'short') continue;
      votes.push({ id: 'pat:' + pt.id, label: pt.label + ' (candle)',
        vote: (pt.dir === 'long' ? 1 : -1) * Math.min(2, Math.max(1, Math.round(pt.strength))),
        note: pt.note });
    }
    for (i = 0; i < G.votes.length; i++) votes.push(G.votes[i]);

    var score = 0, agree = 0, oppose = 0;
    for (i = 0; i < votes.length; i++){
      score += votes[i].vote;
      if (votes[i].vote > 0) agree++;
      else if (votes[i].vote < 0) oppose++;
    }
    var checked = votes.length;
    var quorum = (opts && isFinite(opts.quorum)) ? opts.quorum : 3;
    var dir = (Math.abs(score) >= quorum) ? (score > 0 ? 'BULL' : 'BEAR') : 'NO CALL';
    var grade = 'NO EDGE';
    if (dir !== 'NO CALL'){
      var mag = Math.abs(score);
      grade = mag >= 8 ? 'ULTIMATE' : (mag >= 6 ? 'STRONG' : 'MODERATE');
    } else if (Math.abs(score) === 2) grade = 'LEAN ONLY';

    var a = R.atr, b = R.bar, close = R.close;
    var risk = isFinite(a) && a > 0 ? a : (b.h - b.l);
    risk = Math.max(risk, (b.h - b.l) * 0.5);
    var mk = function(side){
      var s = side === 'long' ? 1 : -1;
      return {
        side: side, entry: +close.toFixed(2),
        sl: +(close - s * risk).toFixed(2),
        tp1: +(close + s * risk).toFixed(2),
        tp2: +(close + s * risk * 2).toFixed(2)
      };
    };
    return {
      dir: dir, grade: grade, score: score, checked: checked,
      agree: agree, oppose: oppose, abstain: checked - agree - oppose,
      votes: votes, patterns: P.patterns || [], gold: G,
      atr: isFinite(a) ? +a.toFixed(2) : null,
      close: +close.toFixed(2),
      bandLow: isFinite(a) ? +(close - a).toFixed(2) : null,
      bandHigh: isFinite(a) ? +(close + a).toFixed(2) : null,
      bracket: mk(dir === 'BEAR' ? 'short' : 'long'),
      bothBrackets: dir === 'NO CALL' ? [mk('long'), mk('short')] : null,
      note: 'Confluence of ' + checked + ' votes: 15 indicator reads, '
          + (P.patterns || []).length + ' candlestick patterns, and the gold desks\' own '
          + 'layer / feed / news evidence. Equal weight, no fitted parameters, NOT a '
          + 'probability and NOT a backtested edge. Levels are ATR-derived.'
    };
  }

  /* scalp = the 15m tape; swing = the 4h tape when one is handed in */
  function hgUltimateConfluence(rows, opts){
    try {
      opts = opts || {};
      var scalp = buildOne(rows, opts);
      var swing = null;
      if (Array.isArray(opts.swingRows) && opts.swingRows.length >= 30){
        swing = buildOne(opts.swingRows, opts);
        if (swing) swing.timeframe = '4h';
      }
      if (scalp) scalp.timeframe = '15m';
      if (!scalp && !swing) return null;
      var src = scalp || swing;
      var out = {
        scalp: scalp, swing: swing,
        dir: src.dir, grade: src.grade, score: src.score, checked: src.checked,
        agree: src.agree, oppose: src.oppose, abstain: src.abstain,
        reads: src.votes, patterns: src.patterns, gold: src.gold,
        atr: src.atr, close: src.close, bandLow: src.bandLow, bandHigh: src.bandHigh,
        bracket: src.bracket, bothBrackets: src.bothBrackets, note: src.note
      };
      return out;
    } catch (e){ return null; }
  }

  root.hgUltimateConfluence = hgUltimateConfluence;
  root.hgCandlePatterns = hgCandlePatterns;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
