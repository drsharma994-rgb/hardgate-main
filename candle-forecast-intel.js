/* =========================================================================
HARDGATE — candle-forecast-intel.js (hg-v1357)
The Candle Forecast intelligence layer. PURE COMPUTATION ONLY: this module
owns no DOM, no timers and no network. gold-candle-forecast.js hands it
closed, prepared bars and renders what it returns.

Every function fails closed and says why:
  - a missing helper is UNREAD, never agreement
  - a thin tape is named, never padded
  - in-sample frequencies are labelled in-sample and are not probabilities
  - no price is invented anywhere: every level quoted here already exists on
    the forecast or on the tape

Surface (window.hgCfIntel):
  tfDir(rows, tf)            one timeframe's closed-bar direction read
  fiveTf(tapes)              5m trigger / 15m setup / 1h confirm / 4h direction / 1d regime
  structure(rows, opts)      liquidity, sweeps, FVG, order blocks, day/week levels (hgSmc at call time)
  volRegime(rows)            compression / normal / expansion / extreme from ATR vs its own median
  news()                     the shared calendar read as an execution-risk state (never a vote)
  feedQuality(legs, tfSec)   cross-feed agreement: deviation, stale bars, duplicates, thin legs
  patternPerf(rows, opts)    in-sample next-candle outcome per named pattern on THIS tape
  executionCard(forecast)    WAIT / ARMED / TRIGGERED / NO-TRADE from the formed brackets
  blockers(forecast, intel)  the exact list of what refused a setup
========================================================================= */
(function () {
  'use strict';
  var G = (typeof window !== 'undefined') ? window : globalThis;

  var CF_INTEL_MIN_BARS = 30;

  function _f(x) { x = +x; return isFinite(x) ? x : NaN; }
  function _arr(x) { return Array.isArray(x) ? x : []; }

  /* Self-contained EMA/ATR so this module can be measured standalone in
     tests. The tab still uses the shared helpers for its own read; these
     exist so an intel answer never depends on load order. */
  function _ema(vals, n) {
    var out = new Array(vals.length).fill(NaN);
    if (!(n > 0) || vals.length < n) return out;
    var k = 2 / (n + 1), i, s = 0;
    for (i = 0; i < n; i++) s += vals[i];
    var e = s / n;
    out[n - 1] = e;
    for (i = n; i < vals.length; i++) { e = vals[i] * k + e * (1 - k); out[i] = e; }
    return out;
  }
  function _atr(rows, n) {
    n = n || 14;
    if (!Array.isArray(rows) || rows.length < n + 1) return NaN;
    var trs = [];
    for (var i = 1; i < rows.length; i++) {
      var h = _f(rows[i].h), l = _f(rows[i].l), pc = _f(rows[i - 1].c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    if (trs.length < n) return NaN;
    var a = 0;
    for (var j = 0; j < n; j++) a += trs[j];
    a /= n;
    for (var k = n; k < trs.length; k++) a = (a * (n - 1) + trs[k]) / n;
    return a;
  }
  function _atrSeries(rows, n) {
    n = n || 14;
    var out = [];
    if (!Array.isArray(rows) || rows.length < n + 1) return out;
    for (var i = n; i < rows.length; i++) {
      var a = _atr(rows.slice(0, i + 1), n);
      if (isFinite(a)) out.push(a);
    }
    return out;
  }
  function _median(xs) {
    var v = xs.filter(isFinite).slice().sort(function (a, b) { return a - b; });
    if (!v.length) return NaN;
    var m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* ---------- one timeframe's direction ----------
     Closed bars only (the tab prepares them). BULL needs the fast EMA above
     the slow AND the last three closes rising; BEAR the mirror; anything
     mixed is NEUTRAL; a thin tape is UNREAD. Two conditions, both named. */
  function tfDir(rows, tf) {
    var out = { tf: tf, dir: 'UNREAD', why: '' };
    rows = _arr(rows);
    if (rows.length < CF_INTEL_MIN_BARS) {
      out.why = rows.length + ' closed bars — the read needs ' + CF_INTEL_MIN_BARS;
      return out;
    }
    var closes = rows.map(function (r) { return _f(r.c); }).filter(isFinite);
    if (closes.length < CF_INTEL_MIN_BARS) {
      out.why = 'closes are not numeric';
      return out;
    }
    var e9 = _ema(closes, 9), e21 = _ema(closes, 21);
    var f = e9[e9.length - 1], s = e21[e21.length - 1];
    if (!isFinite(f) || !isFinite(s)) {
      out.why = 'the EMA pair could not be measured';
      return out;
    }
    var c0 = closes[closes.length - 1], c1 = closes[closes.length - 2], c2 = closes[closes.length - 3];
    var rising = c0 > c1 && c1 > c2, falling = c0 < c1 && c1 < c2;
    var above = f > s, below = f < s;
    if (above && rising) { out.dir = 'BULL'; out.why = 'EMA9 above EMA21 and three closes rising'; }
    else if (below && falling) { out.dir = 'BEAR'; out.why = 'EMA9 below EMA21 and three closes falling'; }
    else {
      out.dir = 'NEUTRAL';
      out.why = (above ? 'EMA9 above EMA21' : (below ? 'EMA9 below EMA21' : 'EMAs flat'))
        + ' but closes ' + (rising ? 'rising' : (falling ? 'falling' : 'not a run'));
    }
    return out;
  }

  /* ---------- the five-timeframe matrix ----------
     5m trigger, 15m setup, 1h confirm, 4h direction, 1d regime. Each row is
     tfDir's own read; an unread row is named, never counted. */
  function fiveTf(tapes) {
    tapes = tapes || {};
    var defs = [
      ['5m', 'TRIGGER', tapes.rows5m],
      ['15m', 'SETUP', tapes.rows15m],
      ['1h', 'CONFIRM', tapes.rows1h],
      ['4h', 'DIRECTION', tapes.rows4h],
      ['1d', 'REGIME', tapes.rows1d]
    ];
    var rows = defs.map(function (d) {
      var r = tfDir(d[2], d[0]);
      return { tf: d[0], role: d[1], dir: r.dir, why: r.why };
    });
    var bull = 0, bear = 0, unread = 0;
    rows.forEach(function (r) {
      if (r.dir === 'BULL') bull++;
      else if (r.dir === 'BEAR') bear++;
      else if (r.dir === 'UNREAD') unread++;
    });
    var aligned = 'NONE';
    if (bull >= 4 && bear === 0) aligned = 'BULL';
    else if (bear >= 4 && bull === 0) aligned = 'BEAR';
    return {
      rows: rows, bull: bull, bear: bear, unread: unread, aligned: aligned,
      why: aligned !== 'NONE'
        ? (aligned === 'BULL' ? bull : bear) + ' of 5 timeframes read ' + aligned + ' with none against'
        : (bull + ' bull / ' + bear + ' bear / ' + unread + ' unread — no four-of-five agreement')
    };
  }

  /* ---------- structure and liquidity ----------
     hgSmc is read AT CALL TIME: index.html loads smc-lib.js after this tab's
     script, so a module-scope capture would be undefined forever. Every leg
     is optional and a missing helper names itself instead of pretending the
     tape has no structure. */
  function structure(rows, opts) {
    opts = opts || {};
    var out = { ok: false, items: [], why: '' };
    rows = _arr(rows);
    if (rows.length < CF_INTEL_MIN_BARS) {
      out.why = rows.length + ' closed bars — structure needs ' + CF_INTEL_MIN_BARS;
      return out;
    }
    var last = rows[rows.length - 1];
    var close = _f(last.c);
    var atr = _atr(rows, 14);
    if (!isFinite(close) || !isFinite(atr) || !(atr > 0)) {
      out.why = 'the last close or ATR could not be measured';
      return out;
    }
    var smc = G.hgSmc;
    if (!smc) {
      out.why = 'the shared SMC reader (hgSmc) is not loaded';
      return out;
    }
    var near = atr * 2; /* "at a meaningful location" = within 2 ATR of price */
    function distOf(px) { var d = _f(px) - close; return isFinite(d) ? d : NaN; }
    function push(kind, label, px, extra) {
      var d = isFinite(_f(px)) ? distOf(px) : NaN;
      out.items.push({
        kind: kind, label: label, px: isFinite(_f(px)) ? +px : null,
        dist: isFinite(d) ? d : null,
        near: isFinite(d) ? Math.abs(d) <= near : false,
        extra: extra || ''
      });
    }
    /* equal highs / lows + sweeps, from the swing reader */
    try {
      if (typeof smc.swingHighsLows === 'function') {
        var sw = smc.swingHighsLows(rows, 3) || {};
        var highs = _arr(sw.highs), lows = _arr(sw.lows);
        var i, j;
        for (i = 0; i < highs.length; i++) {
          for (j = i + 1; j < highs.length; j++) {
            var ha = _f(highs[i].price != null ? highs[i].price : highs[i]);
            var hb = _f(highs[j].price != null ? highs[j].price : highs[j]);
            if (isFinite(ha) && isFinite(hb) && Math.abs(ha - hb) <= atr * 0.25) {
              push('liquidity', 'equal highs (buy-side liquidity)', (ha + hb) / 2);
              break;
            }
          }
        }
        for (i = 0; i < lows.length; i++) {
          for (j = i + 1; j < lows.length; j++) {
            var la = _f(lows[i].price != null ? lows[i].price : lows[i]);
            var lb = _f(lows[j].price != null ? lows[j].price : lows[j]);
            if (isFinite(la) && isFinite(lb) && Math.abs(la - lb) <= atr * 0.25) {
              push('liquidity', 'equal lows (sell-side liquidity)', (la + lb) / 2);
              break;
            }
          }
        }
        if (highs.length) push('level', 'last swing high', _f(highs[highs.length - 1].price != null ? highs[highs.length - 1].price : highs[highs.length - 1]));
        if (lows.length) push('level', 'last swing low', _f(lows[lows.length - 1].price != null ? lows[lows.length - 1].price : lows[lows.length - 1]));
      } else {
        out.items.push({ kind: 'unread', label: 'swing reader not loaded', px: null, dist: null, near: false, extra: '' });
      }
    } catch (eSw) { out.items.push({ kind: 'unread', label: 'swing read failed: ' + (eSw && eSw.message), px: null, dist: null, near: false, extra: '' }); }
    /* fair value gaps still open */
    try {
      if (typeof smc.fvg === 'function') {
        var gaps = _arr(smc.fvg(rows));
        var open = gaps.filter(function (g) {
          var top = _f(g && (g.top != null ? g.top : g.high));
          var bot = _f(g && (g.bottom != null ? g.bottom : g.low));
          return isFinite(top) && isFinite(bot);
        }).slice(-3);
        open.forEach(function (g) {
          var top = _f(g.top != null ? g.top : g.high);
          var bot = _f(g.bottom != null ? g.bottom : g.low);
          var bullGap = (g.dir === 'bull' || g.bullish === true || top > close);
          push('fvg', (bullGap ? 'bullish' : 'bearish') + ' fair value gap', (top + bot) / 2,
            'span ' + bot.toFixed(2) + ' – ' + top.toFixed(2));
        });
        if (!open.length) push('fvg', 'no open fair value gap on this tape', null);
      }
    } catch (eF) { out.items.push({ kind: 'unread', label: 'FVG read failed: ' + (eF && eF.message), px: null, dist: null, near: false, extra: '' }); }
    /* order blocks */
    try {
      if (typeof smc.ob === 'function') {
        var obs = _arr(smc.ob(rows));
        var lastOb = obs.length ? obs[obs.length - 1] : null;
        if (lastOb) {
          var obTop = _f(lastOb.top != null ? lastOb.top : lastOb.high);
          var obBot = _f(lastOb.bottom != null ? lastOb.bottom : lastOb.low);
          if (isFinite(obTop) && isFinite(obBot)) {
            push('ob', (lastOb.dir === 'bull' || lastOb.bullish === true ? 'bullish' : 'bearish') + ' order block', (obTop + obBot) / 2,
              'span ' + obBot.toFixed(2) + ' – ' + obTop.toFixed(2));
          }
        } else {
          push('ob', 'no fresh order block on this tape', null);
        }
      }
    } catch (eO) { out.items.push({ kind: 'unread', label: 'order-block read failed: ' + (eO && eO.message), px: null, dist: null, near: false, extra: '' }); }
    /* previous day / week levels */
    try {
      if (typeof smc.previousHighLow === 'function') {
        var pd = smc.previousHighLow(rows, '1d') || {};
        var pw = smc.previousHighLow(rows, '1w') || {};
        if (isFinite(_f(pd.high))) push('level', 'previous day high', _f(pd.high));
        if (isFinite(_f(pd.low))) push('level', 'previous day low', _f(pd.low));
        if (isFinite(_f(pw.high))) push('level', 'previous week high', _f(pw.high));
        if (isFinite(_f(pw.low))) push('level', 'previous week low', _f(pw.low));
      }
    } catch (eP) { /* day/week levels need day-stamped bars; a 15m-only tape may not have them */ }
    out.ok = true;
    var nearCount = out.items.filter(function (it) { return it.near; }).length;
    out.close = close;
    out.atr = atr;
    out.why = out.items.length
      ? (nearCount + ' of ' + out.items.length + ' marked structure within 2 ATR of price')
      : 'no structure read on this tape';
    return out;
  }

  /* ---------- volatility regime ----------
     ATR(14) now against the median ATR of this same tape. No external
     baseline, so the regime is about THIS market's own recent behaviour. */
  function volRegime(rows) {
    var out = { ok: false, regime: 'UNREAD', atrNow: NaN, atrMed: NaN, ratio: NaN, why: '' };
    rows = _arr(rows);
    var now = _atr(rows, 14);
    var series = _atrSeries(rows.slice(0, -1), 14).slice(-60);
    var med = _median(series);
    if (!isFinite(now) || !isFinite(med) || !(med > 0)) {
      out.why = 'the tape is too thin to measure a volatility regime';
      return out;
    }
    var ratio = now / med;
    var regime = ratio < 0.70 ? 'COMPRESSION'
      : ratio < 1.30 ? 'NORMAL'
      : ratio < 2.00 ? 'EXPANSION' : 'EXTREME';
    out.ok = true;
    out.regime = regime;
    out.atrNow = now; out.atrMed = med; out.ratio = ratio;
    out.why = 'ATR ' + now.toFixed(2) + ' vs tape median ' + med.toFixed(2)
      + ' (' + ratio.toFixed(2) + 'x) — ' + regime.toLowerCase()
      + (regime === 'COMPRESSION' ? '. A breakout read here carries extra failure risk; size expects less.'
        : regime === 'EXTREME' ? '. Stops measured in a normal regime are too tight here.'
        : regime === 'EXPANSION' ? '. Moves are travelling further than usual.'
        : '. Nothing unusual about the range.');
    return out;
  }

  /* ---------- news as execution risk ----------
     The calendar never votes on direction here. It answers one question: is
     it safe to EXECUTE right now. unchecked is named, never treated as a
     clear calendar (the hg-v992 lesson). */
  function news() {
    var out = { ok: false, state: 'UNCHECKED', risk: 'low', blackout: false, note: '' };
    try {
      if (typeof G.hgNewsRisk !== 'function') {
        out.note = 'the shared news reader is not loaded';
        return out;
      }
      var r = G.hgNewsRisk('XAUUSD');
      if (!r || typeof r !== 'object') {
        out.note = 'the shared news reader returned nothing';
        return out;
      }
      if (r.unchecked) {
        out.note = String(r.note || 'news calendar unchecked — blackout unverified');
        return out;
      }
      out.ok = true;
      out.risk = String(r.risk || 'low');
      out.blackout = r.blackout === true;
      out.state = out.blackout ? 'BLACKOUT' : (out.risk === 'high' ? 'CAUTION' : 'NORMAL');
      out.note = out.blackout
        ? 'a high-impact event is inside the blackout window — new entries stand down'
        : (out.state === 'CAUTION'
          ? 'high-impact events are near — spreads and slippage risk are elevated'
          : 'no high-impact event inside the window');
      var ev = _arr(r.events).slice(0, 3).map(function (e) {
        return String((e && (e.title || e.name)) || '').trim();
      }).filter(Boolean);
      if (ev.length) out.note += ' · near: ' + ev.join(', ');
      return out;
    } catch (e) {
      out.note = 'news read failed: ' + (e && e.message);
      return out;
    }
  }

  /* ---------- cross-feed quality ----------
     legs: [{name, rows}] of the SAME timeframe from different sources. The
     first leg with bars is the reference. A leg is stale when its newest
     bar is older than one full timeframe; deviation is the last-close
     distance from the reference close, in percent and in ATR of the
     reference tape. Nothing is averaged into a price: the reads are
     reported, not merged. */
  function feedQuality(legs, tfSec, nowMs) {
    var out = { ok: false, legs: [], worst: 'UNREAD', why: '' };
    legs = _arr(legs);
    tfSec = _f(tfSec) > 0 ? +tfSec : 900;
    var nowSec = isFinite(_f(nowMs)) ? _f(nowMs) / 1000 : (Date.now() / 1000);
    var ref = null;
    var report = legs.map(function (leg) {
      var rows = _arr(leg && leg.rows);
      var entry = { name: String((leg && leg.name) || 'feed'), bars: rows.length, lastClose: NaN, ageSec: NaN, dupes: 0, devPct: NaN, state: 'UNREAD', note: '' };
      if (!rows.length) { entry.note = 'returned no candles'; return entry; }
      var seen = {}, dup = 0;
      for (var i = 0; i < rows.length; i++) {
        var k = String(rows[i] && rows[i].t);
        if (seen[k]) dup++; else seen[k] = true;
      }
      entry.dupes = dup;
      var last = rows[rows.length - 1];
      entry.lastClose = _f(last.c);
      entry.ageSec = isFinite(_f(last.t)) ? Math.max(0, nowSec - _f(last.t)) : NaN;
      if (!ref && isFinite(entry.lastClose)) ref = entry;
      return entry;
    });
    report.forEach(function (entry) {
      if (!isFinite(entry.lastClose)) { entry.state = 'UNREAD'; return; }
      if (ref && entry !== ref) {
        entry.devPct = Math.abs(entry.lastClose - ref.lastClose) / ref.lastClose * 100;
      } else entry.devPct = 0;
      var stale = isFinite(entry.ageSec) && entry.ageSec > tfSec * 1.5;
      if (stale) { entry.state = 'STALE'; entry.note = 'newest bar is ' + Math.round(entry.ageSec / 60) + 'm old'; }
      else if (entry.devPct > 0.5) { entry.state = 'DIVERGED'; entry.note = entry.devPct.toFixed(3) + '% off the reference feed'; }
      else if (entry.dupes > 0) { entry.state = 'CAUTION'; entry.note = entry.dupes + ' duplicate bar time' + (entry.dupes === 1 ? '' : 's'); }
      else { entry.state = 'OK'; entry.note = entry !== ref && isFinite(entry.devPct) ? (entry.devPct.toFixed(3) + '% off reference') : 'reference leg'; }
    });
    var worstRank = { OK: 0, CAUTION: 1, STALE: 2, DIVERGED: 3, UNREAD: 4 };
    var worst = 'OK';
    report.forEach(function (entry) {
      if ((worstRank[entry.state] || 0) > (worstRank[worst] || 0)) worst = entry.state;
    });
    out.ok = report.some(function (e) { return e.state === 'OK' || e.state === 'CAUTION'; });
    out.legs = report;
    out.worst = out.ok ? worst : 'UNREAD';
    out.lock = worst === 'DIVERGED';
    out.why = out.lock
      ? 'feeds diverge beyond 0.5% — a setup on one feed may not exist on another. Execution is locked, not forbidden.'
      : (worst === 'STALE' ? 'at least one leg is stale — read the levels against the fresh leg only'
        : (out.ok ? 'the readable feeds agree within tolerance' : 'no feed could be read'));
    return out;
  }

  /* ---------- pattern performance on THIS tape ----------
     In-sample. For each closed window the shared engine reads, the named
     patterns and the call are logged; the NEXT closed bar settles the
     direction. This is a frequency count on the loaded tape, not a forward
     result and not a probability — the forward ledger is the out-of-sample
     test. */
  function patternPerf(rows, opts) {
    opts = opts || {};
    var out = { ok: false, label: 'in-sample on this tape only. Not a forward result and not a probability.', windows: 0, calls: 0, correct: 0, byPattern: {}, why: '' };
    rows = _arr(rows);
    if (rows.length < 45) {
      out.why = 'the tape is too thin to walk (' + rows.length + ' bars). Nothing was counted.';
      return out;
    }
    if (typeof G.goldCandleForecast !== 'function') {
      out.why = 'the candle engine is not loaded. Nothing was counted.';
      return out;
    }
    var engine = G.goldCandleForecast;
    var start = Math.max(CF_INTEL_MIN_BARS, rows.length - (isFinite(+opts.windows) ? +opts.windows : 40));
    var end = rows.length - 2; /* the last closed bar has no next bar to settle against */
    var prevT = -Infinity;
    for (var i = 0; i < rows.length; i++) {
      var t = _f(rows[i].t);
      if (!isFinite(t) || t <= prevT) {
        out.why = 'bar times are not strictly increasing — a walk that can see the future counts nothing.';
        return out;
      }
      prevT = t;
    }
    for (i = start; i <= end; i++) {
      var slice = rows.slice(0, i + 1);
      var fc = null;
      try { fc = engine(slice, null, null); } catch (eFc) { fc = null; }
      if (!fc) continue;
      out.windows++;
      var dir = fc.dir;
      if (dir !== 'BULL' && dir !== 'BEAR') continue;
      var nxt = rows[i + 1];
      var move = _f(nxt.c) - _f(slice[slice.length - 1].c);
      if (!isFinite(move)) continue;
      var right = (dir === 'BULL' && move > 0) || (dir === 'BEAR' && move < 0);
      out.calls++;
      if (right) out.correct++;
      var names = _arr(fc.patterns).concat(_arr(fc.advancedPatterns));
      if (!names.length) names = ['(no named pattern)'];
      names.forEach(function (nm) {
        nm = String(nm);
        var b = out.byPattern[nm] || (out.byPattern[nm] = { n: 0, right: 0, totMove: 0 });
        b.n++;
        if (right) b.right++;
        b.totMove += Math.abs(move);
      });
    }
    out.ok = true;
    out.why = out.calls
      ? (out.calls + ' directional calls across ' + out.windows + ' windows, ' + out.correct + ' settled right on the next bar. ' + out.label)
      : ('the engine named no directional call inside this window. Nothing was counted. ' + out.label);
    return out;
  }

  /* ---------- the execution card ----------
     A state machine over the formed brackets, nothing more:
       NO-TRADE  no side on either horizon
       WAIT      a side exists but no confluence ticket formed
       ARMED     a ticket exists and price has not reached the entry
       TRIGGERED price has traded at or through the entry
     The levels quoted are the bracket's own. Nothing is priced here. */
  function executionCard(forecast) {
    var out = { state: 'NO-TRADE', horizon: '', dir: '', entry: NaN, stop: NaN, tp1: NaN, tp2: NaN, rr: null, why: '' };
    forecast = forecast || {};
    var cands = [];
    ['scalp', 'swing'].forEach(function (h) {
      var b = forecast[h];
      if (!b || b.ok === false) return;
      if (b.dir !== 'BULL' && b.dir !== 'BEAR') return;
      var e = _f(b.entry), s = _f(b.stop), t1 = _f(b.tp1);
      if (!(isFinite(e) && isFinite(s) && isFinite(t1))) return;
      if (!(Math.abs(e - s) > 0)) return;
      cands.push({ h: h, b: b, entry: e, stop: s, tp1: t1, tp2: _f(b.tp2), formed: b.formed === true, ticket: b.ticket === true });
    });
    if (!cands.length) {
      out.why = 'neither horizon named a settleable side';
      return out;
    }
    /* the ticketed swing outranks the ticketed scalp; a ticketed read
       outranks an unticketed one on the same horizon */
    cands.sort(function (a, b) {
      var aw = (a.ticket ? 2 : 0) + (a.h === 'swing' ? 1 : 0);
      var bw = (b.ticket ? 2 : 0) + (b.h === 'swing' ? 1 : 0);
      return bw - aw;
    });
    var pick = cands[0];
    var close = _f(forecast.close);
    out.horizon = pick.h.toUpperCase();
    out.dir = pick.b.dir;
    out.entry = pick.entry; out.stop = pick.stop; out.tp1 = pick.tp1; out.tp2 = pick.tp2;
    var risk = Math.abs(pick.entry - pick.stop);
    out.rr = (risk > 0 && isFinite(pick.tp1)) ? +(Math.abs(pick.tp1 - pick.entry) / risk).toFixed(2) : null;
    if (!pick.ticket && !pick.formed) {
      out.state = 'WAIT';
      out.why = 'the ' + pick.h + ' read named a side but no confluence ticket — this is a watch, not a trade';
      return out;
    }
    if (isFinite(close)) {
      var through = pick.b.dir === 'BULL' ? close <= pick.entry : close >= pick.entry;
      out.state = through ? 'TRIGGERED' : 'ARMED';
      out.why = through
        ? 'price has traded at the ' + pick.h + ' entry — the bracket is live, manage it on its own stop'
        : 'the ' + pick.h + ' ticket is formed and price has not reached the entry — the order waits';
    } else {
      out.state = 'ARMED';
      out.why = 'the ' + pick.h + ' ticket is formed; the last close is unread so the trigger is unchecked';
    }
    return out;
  }

  /* ---------- why nothing formed ----------
     Every refusal path in one list, so a NO-TRADE card can say exactly what
     refused instead of shrugging. */
  function blockers(forecast, intel) {
    var list = [];
    forecast = forecast || {};
    intel = intel || {};
    if (forecast.dir !== 'BULL' && forecast.dir !== 'BEAR') {
      list.push('the 15m candle engine named no side (' + String(forecast.dir || 'UNREAD') + ')');
    }
    var named = _arr(forecast.patterns).concat(_arr(forecast.advancedPatterns));
    if (!named.length) list.push('no named candlestick pattern on the latest bars');
    var cfl = forecast.confluence;
    if (cfl && cfl.ok && !cfl.ticket) {
      list.push('confluence short of a ticket: ' + String(cfl.why || 'not enough families with the call'));
    } else if (!cfl || !cfl.ok) {
      list.push('the confluence read was not available: ' + String((cfl && cfl.why) || 'unavailable'));
    }
    var sw = forecast.swing;
    if (sw && sw.ok === false && sw.why) list.push('swing: ' + String(sw.why));
    var fq = intel.feedQuality;
    if (fq && fq.lock) list.push('feeds diverged — execution locked: ' + String(fq.why));
    if (fq && fq.worst === 'STALE') list.push('a feed leg is stale — levels may not match the broker');
    var nw = intel.news;
    if (nw && nw.blackout) list.push('news blackout — new entries stand down');
    if (nw && !nw.ok) list.push('news calendar unchecked: ' + String(nw.note || 'blackout unverified'));
    var ft = intel.fiveTf;
    if (ft && ft.aligned === 'NONE') list.push('no four-of-five timeframe agreement: ' + String(ft.why || ''));
    var vr = intel.volRegime;
    if (vr && vr.ok && vr.regime === 'EXTREME') list.push('volatility is extreme — normal-regime stops are too tight here');
    if (!list.length) list.push('no blocker — the reads that formed are on the card');
    return list;
  }

  G.hgCfIntel = {
    version: 'hg-v1357',
    MIN_BARS: CF_INTEL_MIN_BARS,
    tfDir: tfDir,
    fiveTf: fiveTf,
    structure: structure,
    volRegime: volRegime,
    news: news,
    feedQuality: feedQuality,
    patternPerf: patternPerf,
    executionCard: executionCard,
    blockers: blockers
  };
})();
