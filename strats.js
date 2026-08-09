/* =========================================================================
HARDGATE — strats.js
STRATEGY LAB (tab id 'strats'): three classic, fully-documented backtests the
user can point at any Binance USDT-M perp on 4h or 1d:

  1. EMA CROSS 9/21 ....... trend-follow. crossOver/crossUnder(ema9, ema21) at
                            bar close with an rsi14 filter (>50 long / <50
                            short). Stop 1.5×ATR14; exit on opposite cross,
                            stop, or 2.5R target. Stop checked FIRST each bar
                            (conservative).
  2. CONNORS RSI-2 ........ mean reversion (Larry Connors). Regime filter:
                            close > sma200 for longs, < for shorts. Entry at
                            bar close when rsi2 < 10 (long) / > 90 (short).
                            Exit when rsi2 > 60 (long) / < 40 (short), after
                            7 bars, or on a 1×ATR14 stop.
  3. DONCHIAN 20 BREAKOUT . trend-follow (Turtle-style). Entry on close beyond
                            donchian(20) — the channel EXCLUDES the current
                            bar (indicators2.js), so a close past it is a true
                            breakout — with an atr14/sma(atr14,50) >= 0.8
                            volatility filter. Stop 2×ATR14; exit on a
                            donchian(10) opposite-band touch, the stop, or
                            after 40 bars.

Conventions (all three): long AND short, symmetric; signals on CLOSED bars
only; entries at the signal bar's close; one position at a time; stops fill
at the stop price, or the bar open when gapped through (conservative);
R = signed (exit-entry) / |entry-stop|. NO fees/slippage — real results
will be worse.

Visuals: each strategy panel shows a real equity chart (cumulative-R line +
drawdown histogram, 0R reference, best/worst markers) via lightweight-charts
when index.html provides it — feature-checked at call time; the legacy
~60-div strip is the exact fallback. A comparison strip on top ranks the
strategies by expectancy (best = gold border). Stats also expose
avgWinR / avgLossR / maxLoseStreak so the payoff ratio and losing-run risk
are visible next to win%.

Classic-script IIFE, no build step. Loads after indicators.js /
indicators2.js / binance.js. Exposes window.btEmaCross / btConnorsRsi2 /
btDonchian (pure; NEVER throw — degenerate input returns zeroed stats) plus
window.HG_strats helpers, and registers on window.HG_tabs. Never throws at
load time; every external global is feature-checked before use; every fetch
carries a 10s AbortController timeout and resolves [] on failure.

Hard refresh (index.html hardRefreshAll): the registration carries refresh()
per the house contract — async, NEVER throws, terse status string. It replays
the LAST backtest configuration the user ran (symbol/tf/strategy chips are
snapshotted at run time); before the first user run it reports
'skipped: not run yet' instead of triggering an expensive first-time scan,
and while a run is in flight it reports 'busy' (overlaps never double-fetch).
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window :
        (typeof globalThis !== 'undefined') ? globalThis : this;

/* ---------------- tiny self-contained helpers ---------------- */

function sgEsc(s){
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function sgSleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

/* Adaptive price format, self-contained (index.html's px() is NOT required
   here — the pure backtests must stay test-deterministic). */
function sgPx(n){
  n = +n;
  if (!isFinite(n)) return 'n/a';
  var a = Math.abs(n);
  var d = (a >= 1000 ? 1 : (a >= 100 ? 2 : (a >= 1 ? 3 : 5)));
  return n.toLocaleString('en-US', { maximumFractionDigits: d });
}
function sgR(n){
  n = +n;
  if (!isFinite(n)) return 'n/a';
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}
function sgTime(t){
  var d = new Date(t * 1000);
  return isFinite(+d) ? d.toISOString().slice(5, 16).replace('T', ' ') : 'n/a';
}

/* Validate/normalize candle rows: keep only bars with finite o/h/l/c.
   Returns null for non-arrays. Never throws. */
function sgClean(rows){
  if (!Array.isArray(rows)) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var o = +r.o, h = +r.h, l = +r.l, c = +r.c;
    if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
    out.push({ t: isFinite(+r.t) ? +r.t : i, o: o, h: h, l: l, c: c, v: isFinite(+r.v) ? +r.v : 0 });
  }
  return out;
}
function sgCloses(rows){
  var out = new Array(rows.length);
  for (var i = 0; i < rows.length; i++) out[i] = rows[i].c;
  return out;
}

/* ---------------- stats ---------------- */

function sgZeroStats(){
  return { n: 0, winPct: 0, avgR: 0, expectR: 0, profitFactor: 0, maxDD: 0, exposurePct: 0,
           avgWinR: 0, avgLossR: 0, maxLoseStreak: 0 };
}
function sgZeroResult(){
  return { trades: [], stats: sgZeroStats() };
}

/* Stats from a trade list. trades: [{r, bars, ...}], R-multiples only.
   winPct   = wins / n * 100 (win = r > 0)
   avgR     = mean r over all trades
   expectR  = classic expectancy  p*avgWinR + (1-p)*avgLossR  (== avgR; both
              shown because the expectancy decomposition is the standard way
              traders sanity-check a system's edge)
   profitFactor = gross win R / gross loss R (∞ when no losing R)
   maxDD    = worst peak-to-trough drawdown of the cumulative-R equity curve
   exposurePct = bars-in-market / totalBars * 100
   avgWinR / avgLossR = mean winning / losing R (avgLossR <= 0; their ratio
              is the payoff half of the edge, shown next to win%)
   maxLoseStreak = longest run of consecutive non-winning trades (r <= 0)  */
function sgComputeStats(trades, totalBars){
  var z = sgZeroStats();
  if (!Array.isArray(trades) || !trades.length) return z;
  var n = 0, sumR = 0, nW = 0, nL = 0, sumW = 0, sumL = 0;
  var eq = 0, peak = 0, mdd = 0, barsIn = 0;
  var loseRun = 0, maxLoseRun = 0;
  for (var i = 0; i < trades.length; i++){
    var r = +trades[i].r;
    if (!isFinite(r)) continue;
    n++; sumR += r;
    if (r > 0){ nW++; sumW += r; loseRun = 0; }
    else { nL++; sumL += r; loseRun++; if (loseRun > maxLoseRun) maxLoseRun = loseRun; }
    eq += r;
    if (eq > peak) peak = eq;
    var dd = peak - eq;
    if (dd > mdd) mdd = dd;
    barsIn += Math.max(0, +trades[i].bars || 0);
  }
  if (!n) return z;
  var winFrac = nW / n;
  var avgW = nW ? sumW / nW : 0;
  var avgL = nL ? sumL / nL : 0;
  z.n = n;
  z.winPct = 100 * winFrac;
  z.avgR = sumR / n;
  z.expectR = winFrac * avgW + (1 - winFrac) * avgL;
  z.profitFactor = (sumL < 0) ? sumW / Math.abs(sumL) : (sumW > 0 ? Infinity : 0);
  z.maxDD = mdd;
  z.exposurePct = (totalBars > 0) ? Math.min(100, 100 * barsIn / totalBars) : 0;
  z.avgWinR = avgW;
  z.avgLossR = avgL;
  z.maxLoseStreak = maxLoseRun;
  return z;
}
var SG_FEE_BPS = 5;
var SG_SLIP_BPS = 5;

function sgCostAdjustR(r){
  if (!isFinite(r)) return r;
  var rt = (SG_FEE_BPS + SG_SLIP_BPS) / 10000;
  return r - rt * 2;
}
function sgResult(trades, totalBars){
  return { trades: trades, stats: sgComputeStats(trades, totalBars) };
}

/* ---------------- generic single-position backtest loop ----------------
   sigAt(i)  -> null | {dir:'long'|'short', stop:<price>}  at close of bar i
   exitAt(j, pos) -> null | {px, reason}                   on bar j (> entry)
   Exit checks MUST test the stop first (conservative same-bar resolution).
   After an exit at bar j, signals are re-evaluated at bar j (a close-based
   exit may itself be a fresh entry signal).                              */
function sgRunLoop(rows, sigAt, exitAt){
  var trades = [], n = rows.length, i = 0;
  while (i < n - 1){
    var sig = sigAt(i);
    if (sig){
      var entry = rows[i].c;
      var risk = (sig.dir === 'long') ? (entry - sig.stop) : (sig.stop - entry);
      if (isFinite(risk) && risk > 0){
        var j = i + 1, exitPx = null, reason = 'eod';
        for (; j < n; j++){
          var x = exitAt(j, { dir: sig.dir, entry: entry, stop: sig.stop, risk: risk, entryIdx: i });
          if (x && isFinite(x.px)){ exitPx = x.px; reason = x.reason; break; }
        }
        if (exitPx === null){ j = n - 1; exitPx = rows[j].c; reason = 'eod'; }
        var pnl = (sig.dir === 'long') ? (exitPx - entry) : (entry - exitPx);
        var r = pnl / risk;
        if (isFinite(r)){
          r = sgCostAdjustR(r);
          trades.push({
            t: rows[i].t, tExit: rows[j].t, dir: sig.dir,
            entry: entry, exit: exitPx, stop: sig.stop,
            r: r, reason: reason, bars: j - i
          });
        }
        i = j;
        continue;
      }
    }
    i++;
  }
  return trades;
}

/* ---------------- strategy 1: EMA CROSS 9/21 ----------------
   Entry  : crossOver(ema9,ema21) & rsi14 > 50 -> long at close;
            crossUnder(ema9,ema21) & rsi14 < 50 -> short at close.
   Stop   : 1.5 × ATR14 (signal bar).
   Exit   : stop (checked FIRST each bar, fills at open if gapped through),
            2.5R target, or opposite cross at bar close.                  */
function btEmaCross(rows){
  var zero = sgZeroResult();
  try{
    rows = sgClean(rows);
    if (!rows || rows.length < 40) return zero;
    if (typeof ema !== 'function' || typeof rsi !== 'function' || typeof atr !== 'function' ||
        typeof crossOver !== 'function' || typeof crossUnder !== 'function') return zero;
    var c = sgCloses(rows);
    var e9 = ema(c, 9), e21 = ema(c, 21), r14 = rsi(c, 14), a14 = atr(rows, 14);
    var xo = crossOver(e9, e21), xu = crossUnder(e9, e21);

    function sigAt(i){
      if (!isFinite(a14[i]) || a14[i] <= 0 || !isFinite(r14[i])) return null;
      var risk = 1.5 * a14[i];
      if (xo[i] && r14[i] > 50) return { dir: 'long',  stop: c[i] - risk };
      if (xu[i] && r14[i] < 50) return { dir: 'short', stop: c[i] + risk };
      return null;
    }
    function exitAt(j, pos){
      var bar = rows[j];
      if (pos.dir === 'long'){
        if (bar.l <= pos.stop) return { px: Math.min(pos.stop, bar.o), reason: 'stop' };
        if (bar.h >= pos.entry + 2.5 * pos.risk) return { px: pos.entry + 2.5 * pos.risk, reason: 'target' };
        if (xu[j]) return { px: bar.c, reason: 'cross' };
      } else {
        if (bar.h >= pos.stop) return { px: Math.max(pos.stop, bar.o), reason: 'stop' };
        if (bar.l <= pos.entry - 2.5 * pos.risk) return { px: pos.entry - 2.5 * pos.risk, reason: 'target' };
        if (xo[j]) return { px: bar.c, reason: 'cross' };
      }
      return null;
    }
    return sgResult(sgRunLoop(rows, sigAt, exitAt), rows.length);
  }catch(e){ return zero; }
}

/* ---------------- strategy 2: CONNORS RSI-2 MEAN REVERSION ----------------
   Regime : close > sma200 -> longs only; close < sma200 -> shorts only.
   Entry  : rsi2 < 10 (long) / rsi2 > 90 (short) at bar close.
   Stop   : 1 × ATR14 (signal bar), checked FIRST each bar.
   Exit   : rsi2 > 60 (long) / < 40 (short) at bar close, or 7-bar cap.   */
function btConnorsRsi2(rows){
  var zero = sgZeroResult();
  try{
    rows = sgClean(rows);
    if (!rows || rows.length < 210) return zero;
    if (typeof rsi !== 'function' || typeof sma !== 'function' || typeof atr !== 'function') return zero;
    var c = sgCloses(rows);
    var r2 = rsi(c, 2), s200 = sma(c, 200), a14 = atr(rows, 14);

    function sigAt(i){
      if (!isFinite(a14[i]) || a14[i] <= 0 || !isFinite(r2[i]) || !isFinite(s200[i])) return null;
      if (c[i] > s200[i] && r2[i] < 10) return { dir: 'long',  stop: c[i] - a14[i] };
      if (c[i] < s200[i] && r2[i] > 90) return { dir: 'short', stop: c[i] + a14[i] };
      return null;
    }
    function exitAt(j, pos){
      var bar = rows[j];
      if (pos.dir === 'long'){
        if (bar.l <= pos.stop) return { px: Math.min(pos.stop, bar.o), reason: 'stop' };
        if (isFinite(r2[j]) && r2[j] > 60) return { px: bar.c, reason: 'rsi' };
      } else {
        if (bar.h >= pos.stop) return { px: Math.max(pos.stop, bar.o), reason: 'stop' };
        if (isFinite(r2[j]) && r2[j] < 40) return { px: bar.c, reason: 'rsi' };
      }
      if (j - pos.entryIdx >= 7) return { px: bar.c, reason: 'time' };
      return null;
    }
    return sgResult(sgRunLoop(rows, sigAt, exitAt), rows.length);
  }catch(e){ return zero; }
}

/* ---------------- strategy 3: DONCHIAN 20 BREAKOUT ----------------
   Entry  : close > donchian(20).up -> long / close < donchian(20).lo ->
            short at bar close (channel EXCLUDES the current bar), only
            when atr14 / sma(atr14,50) >= 0.8 (vol filter).
   Stop   : 2 × ATR14 (signal bar), checked FIRST each bar.
   Exit   : donchian(10) opposite-band touch (fills at open if gapped
            through), the stop, or a 40-bar cap.                          */
function btDonchian(rows){
  var zero = sgZeroResult();
  try{
    rows = sgClean(rows);
    if (!rows || rows.length < 80) return zero;
    if (typeof donchian !== 'function' || typeof atr !== 'function' || typeof sma !== 'function') return zero;
    var c = sgCloses(rows);
    var dc20 = donchian(rows, 20), dc10 = donchian(rows, 10);
    var a14 = atr(rows, 14), a50 = sma(a14, 50);

    function volOk(i){
      return isFinite(a14[i]) && a14[i] > 0 && isFinite(a50[i]) && a50[i] > 0 &&
             (a14[i] / a50[i]) >= 0.8;
    }
    function sigAt(i){
      if (!volOk(i)) return null;
      var risk = 2 * a14[i];
      if (isFinite(dc20.up[i]) && c[i] > dc20.up[i]) return { dir: 'long',  stop: c[i] - risk };
      if (isFinite(dc20.lo[i]) && c[i] < dc20.lo[i]) return { dir: 'short', stop: c[i] + risk };
      return null;
    }
    function exitAt(j, pos){
      var bar = rows[j];
      if (pos.dir === 'long'){
        if (bar.l <= pos.stop) return { px: Math.min(pos.stop, bar.o), reason: 'stop' };
        if (isFinite(dc10.lo[j]) && bar.l <= dc10.lo[j])
          return { px: (bar.o <= dc10.lo[j]) ? bar.o : dc10.lo[j], reason: 'band' };
      } else {
        if (bar.h >= pos.stop) return { px: Math.max(pos.stop, bar.o), reason: 'stop' };
        if (isFinite(dc10.up[j]) && bar.h >= dc10.up[j])
          return { px: (bar.o >= dc10.up[j]) ? bar.o : dc10.up[j], reason: 'band' };
      }
      if (j - pos.entryIdx >= 40) return { px: bar.c, reason: 'time' };
      return null;
    }
    return sgResult(sgRunLoop(rows, sigAt, exitAt), rows.length);
  }catch(e){ return zero; }
}

/* ---------------- LIVE LEVELS (SL/TP audit) ----------------
   Evaluate ONE strategy's entry rules on the LAST bar of the given rows and
   return exact execution levels, or null when no setup is active right now.
   The signal math is identical to the backtests (every indicator used is
   causal, so a slice ending at bar i reproduces the backtest's view of bar i
   exactly — this is asserted in tests against real backtest trades).
     ema      — stop 1.5xATR14 · T1 = 2.5R (the native target) · T2 = 3.5R
     connors  — stop 1xATR14   · T1 = 2R · T2 = 3.5R (native exits are rsi2/time)
     donchian — stop 2xATR14   · T1 = 2R · T2 = 3.5R (native exit is the dc10 band)
   Never throws; degenerate input -> null. */
function sgLive(strat, dir, entry, stop, m1, m2, note){
  var risk = (dir === 'long') ? (entry - stop) : (stop - entry);
  if (!(isFinite(entry) && entry > 0 && isFinite(risk) && risk > 0)) return null;
  return {
    strat: strat, dir: dir, entry: entry, stop: stop,
    t1: (dir === 'long') ? entry + m1 * risk : entry - m1 * risk,
    t2: (dir === 'long') ? entry + m2 * risk : entry - m2 * risk,
    rr1: m1, rr2: m2, riskPct: risk / entry * 100, note: note
  };
}
function sgLiveLevels(stratId, rows){
  try{
    rows = sgClean(rows);
    if (!rows || !rows.length) return null;
    var n = rows.length, i = n - 1;
    var c = sgCloses(rows);
    if (stratId === 'ema'){
      if (n < 36) return null;   // warmup floor: ema21 + cross pair + rsi14
      if (typeof ema !== 'function' || typeof rsi !== 'function' || typeof atr !== 'function' ||
          typeof crossOver !== 'function' || typeof crossUnder !== 'function') return null;
      var e9 = ema(c, 9), e21 = ema(c, 21), r14 = rsi(c, 14), a14 = atr(rows, 14);
      var xo = crossOver(e9, e21), xu = crossUnder(e9, e21);
      if (!isFinite(a14[i]) || a14[i] <= 0 || !isFinite(r14[i])) return null;
      var riskE = 1.5 * a14[i];
      if (xo[i] && r14[i] > 50) return sgLive('ema', 'long', c[i], c[i] - riskE, 2.5, 3.5,
        'native exits: 2.5R target / opposite cross / stop (checked first)');
      if (xu[i] && r14[i] < 50) return sgLive('ema', 'short', c[i], c[i] + riskE, 2.5, 3.5,
        'native exits: 2.5R target / opposite cross / stop (checked first)');
      return null;
    }
    if (stratId === 'connors'){
      if (n < 200) return null;  // warmup floor: sma200
      if (typeof rsi !== 'function' || typeof sma !== 'function' || typeof atr !== 'function') return null;
      var r2 = rsi(c, 2), s200 = sma(c, 200), a14c = atr(rows, 14);
      if (!isFinite(a14c[i]) || a14c[i] <= 0 || !isFinite(r2[i]) || !isFinite(s200[i])) return null;
      if (c[i] > s200[i] && r2[i] < 10) return sgLive('connors', 'long', c[i], c[i] - a14c[i], 2, 3.5,
        'native exits: rsi2 > 60 / 7-bar cap / 1×ATR stop');
      if (c[i] < s200[i] && r2[i] > 90) return sgLive('connors', 'short', c[i], c[i] + a14c[i], 2, 3.5,
        'native exits: rsi2 < 40 / 7-bar cap / 1×ATR stop');
      return null;
    }
    if (stratId === 'donchian'){
      if (n < 64) return null;   // warmup floor: atr14 (bar 14) + sma(atr,50) (bar 63)
      if (typeof donchian !== 'function' || typeof atr !== 'function' || typeof sma !== 'function') return null;
      var dc20 = donchian(rows, 20), a14d = atr(rows, 14), a50 = sma(a14d, 50);
      var volOk = isFinite(a14d[i]) && a14d[i] > 0 && isFinite(a50[i]) && a50[i] > 0 &&
                  (a14d[i] / a50[i]) >= 0.8;
      if (!volOk) return null;
      var riskD = 2 * a14d[i];
      if (isFinite(dc20.up[i]) && c[i] > dc20.up[i]) return sgLive('donchian', 'long', c[i], c[i] - riskD, 2, 3.5,
        'native exit: donchian(10) lower-band touch / 40-bar cap / stop');
      if (isFinite(dc20.lo[i]) && c[i] < dc20.lo[i]) return sgLive('donchian', 'short', c[i], c[i] + riskD, 2, 3.5,
        'native exit: donchian(10) upper-band touch / 40-bar cap / stop');
      return null;
    }
    return null;
  }catch(e){ return null; }
}

/* 'LIVE LEVELS' footer for each strategy panel: exact ENTRY/STOP/T1/T2 when a
   setup is active on the freshest closed bar, else an honest 'no live setup'
   line stamped with the last historical signal time. Pure string builder;
   never fabricates (no rows/no signal -> no levels). */
function sgLiveFooter(stratId, rows, trades){
  var lv = sgLiveLevels(stratId, rows);
  if (lv){
    return '<div class="plan">LIVE LEVELS · ' + lv.dir.toUpperCase()
      + ' — ENTRY <b>' + sgPx(lv.entry) + '</b>'
      + ' · STOP <b>' + sgPx(lv.stop) + '</b>'
      + ' · T1 ' + sgPx(lv.t1) + ' (' + lv.rr1.toFixed(1) + 'R)'
      + ' · T2 ' + sgPx(lv.t2) + ' (' + lv.rr2.toFixed(1) + 'R)'
      + ' · risk ' + lv.riskPct.toFixed(2) + '%'
      + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(lv.entry, lv.stop) : '')
      + (lv.note ? ' — ' + sgEsc(lv.note) : '') + '</div>';
  }
  var lastT = (Array.isArray(trades) && trades.length) ? trades[trades.length - 1].t : null;
  return '<div class="plan">LIVE LEVELS · no live setup'
    + (lastT !== null ? ' — last signal ' + sgTime(lastT) + ' UTC' : ' — no signals in this history')
    + '</div>';
}

var __sgBucket = (typeof makeTokenBucket === 'function') ? makeTokenBucket(2, 2) : null;

/* Older klines page: binanceKlines() has no endTime param (recent page only),
   so the ~3000-bar history needs one direct call for the OLDER chunk. Same
   endpoint, same row shape, same never-throw discipline. */
async function sgKlinesBefore(symbol, interval, endTimeMs, limit){
  try{
    if (typeof fetch !== 'function') return [];
    limit = Math.max(1, Math.min(1500, limit || 1500));
    var url = 'https://fapi.binance.com/fapi/v1/klines?symbol=' + encodeURIComponent(symbol) +
              '&interval=' + encodeURIComponent(interval) + '&limit=' + limit +
              '&endTime=' + Math.floor(endTimeMs);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 10000);
    try{
      if (__sgBucket){
        var w = __sgBucket.take();
        if (w > 0) await sgSleep(Math.min(w, 2000));
      }
      var res = await fetch(url, { signal: ctrl.signal });
      if (!res || !res.ok) return [];
      var raw = await res.json();
      if (!Array.isArray(raw)) return [];
      return raw.map(function(k){
        return { t: Math.floor((+k[0]) / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] };
      }).filter(function(r){
        return isFinite(r.t) && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c);
      }).sort(function(a, b){ return a.t - b.t; });
    } finally { clearTimeout(timer); }
  }catch(e){ return []; }
}

/* ---------------- UI ---------------- */

var SG_STRATS = [
  { id: 'ema',      name: 'EMA CROSS 9/21',       fn: btEmaCross,
    desc: 'trend · ema9/21 cross + rsi14 filter · 1.5×ATR stop · 2.5R target · opposite-cross exit' },
  { id: 'connors',  name: 'CONNORS RSI-2',        fn: btConnorsRsi2,
    desc: 'mean reversion · sma200 regime · rsi2 <10/>90 entry · rsi2 exit · 7-bar cap · 1×ATR stop' },
  { id: 'donchian', name: 'DONCHIAN 20 BREAKOUT', fn: btDonchian,
    desc: 'trend · close beyond dc20 + vol filter · 2×ATR stop · dc10 opposite-band exit · 40-bar cap' }
];

function sgSetProg(el, f){
  if (!el) return;
  el.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && el.firstElementChild) el.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
}

function sgKv(k, v, cls){
  return '<div class="kv"><span class="k">' + k + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>';
}

/* Cumulative-R equity as a row of ~60 tiny div bars (no chart lib): bar
   height = equity level, green when the step rose, red when it fell. */
function sgEquityStrip(trades){
  if (!trades || !trades.length) return '';
  var pts = [], eq = 0, i;
  for (i = 0; i < trades.length; i++){ eq += trades[i].r; pts.push(eq); }
  var idx = [];
  if (pts.length <= 60){
    for (i = 0; i < pts.length; i++) idx.push(i);
  } else {
    for (i = 0; i < 60; i++) idx.push(Math.floor(i * pts.length / 60));
    idx[59] = pts.length - 1;
  }
  var min = Math.min.apply(null, pts.concat([0]));
  var max = Math.max.apply(null, pts.concat([0]));
  var range = (max - min) || 1;
  var html = '<div style="display:flex;align-items:flex-end;gap:1px;height:34px;margin-top:10px">';
  var prev = 0;
  for (i = 0; i < idx.length; i++){
    var v = pts[idx[i]];
    var h = 3 + 28 * (v - min) / range;
    var col = (v >= prev) ? 'var(--long)' : 'var(--short)';
    html += '<div title="trade #' + (idx[i] + 1) + ' · cum ' + sgR(v) + 'R" style="flex:1;min-width:2px;height:' +
            h.toFixed(1) + 'px;background:' + col + '"></div>';
    prev = v;
  }
  return html + '</div>';
}

/* lightweight-charts is loaded by index.html (agent A). Feature-check at CALL
   time (never at load time): any absence/failure falls back to the div strip. */
function sgChartLib(){
  try{
    if (typeof LightweightCharts !== 'undefined' && LightweightCharts &&
        typeof LightweightCharts.createChart === 'function') return LightweightCharts;
  }catch(e){}
  return null;
}

/* ~220px real equity chart: gold cumulative-R line + red drawdown histogram
   (<= 0 vs running peak), dashed 0R reference line, markers on the best and
   worst trade. X axis = trade index mapped to synthetic integer seconds (the
   lib needs ascending times; trade chronology is all we plot).
   Returns true when the chart was actually created. NEVER throws. */
function sgEquityChart(el, trades){
  var LC = sgChartLib();
  if (!LC || !el || !Array.isArray(trades) || !trades.length) return false;
  try{
    var T0 = 1700000000, STEP = 86400; // synthetic seconds: one "day" per trade
    var eq = [], dd = [], cum = 0, peak = 0;
    var best = 0, worst = 0;
    for (var i = 0; i < trades.length; i++){
      var r = +trades[i].r;
      if (!isFinite(r)) r = 0;
      cum += r;
      if (cum > peak) peak = cum;
      eq.push({ time: T0 + i * STEP, value: cum });
      dd.push({ time: T0 + i * STEP, value: cum - peak });
      if ((+trades[i].r || 0) > (+trades[best].r || 0)) best = i;
      if ((+trades[i].r || 0) < (+trades[worst].r || 0)) worst = i;
    }
    var chart = LC.createChart(el, {
      height: 220,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#334155', attributionLogo: false },
      grid: { vertLines: { color: 'rgba(226,232,240,.9)' }, horzLines: { color: 'rgba(226,232,240,.9)' } },
      rightPriceScale: { borderColor: '#E2E8F0' },
      timeScale: { borderColor: '#E2E8F0', timeVisible: false },
      crosshair: { mode: 0 }
    });
    if (!chart || typeof chart.addLineSeries !== 'function' ||
        typeof chart.addHistogramSeries !== 'function') return false;
    var eqS = chart.addLineSeries({ color: '#D9A441', lineWidth: 2, priceLineVisible: false, title: 'cum R' });
    var ddS = chart.addHistogramSeries({ color: 'rgba(228,88,107,.5)', priceLineVisible: false, title: 'drawdown' });
    if (!eqS || !ddS) return false;
    eqS.setData(eq);
    ddS.setData(dd);
    try{
      if (typeof eqS.createPriceLine === 'function'){
        eqS.createPriceLine({ price: 0, color: '#334155', lineWidth: 1,
          lineStyle: (LC.LineStyle && isFinite(+LC.LineStyle.Dashed)) ? +LC.LineStyle.Dashed : 2,
          axisLabelVisible: true, title: '0R' });
      }
    }catch(e1){}
    try{
      if (typeof eqS.setMarkers === 'function'){
        var marks = [{ time: T0 + best * STEP, position: 'aboveBar', color: '#35C08E',
                       shape: 'arrowUp', text: 'BEST ' + sgR(+trades[best].r || 0) }];
        if (worst !== best){
          marks.push({ time: T0 + worst * STEP, position: 'belowBar', color: '#E4586B',
                       shape: 'arrowDown', text: 'WORST ' + sgR(+trades[worst].r || 0) });
        }
        marks.sort(function(a, b){ return a.time - b.time; }); // lib requires time order
        eqS.setMarkers(marks);
      }
    }catch(e2){}
    try{ if (typeof chart.timeScale === 'function') chart.timeScale().fitContent(); }catch(e3){}
    return true;
  }catch(e){ return false; }
}

/* Mount helper: real chart when the lib is there, legacy div strip otherwise
   (exact same strip markup as before — plus its original caption note).
   Returns true when the chart path was used. NEVER throws. */
function sgEquityMount(el, trades){
  if (!el || !Array.isArray(trades) || !trades.length) return false;
  if (sgEquityChart(el, trades)){
    if (typeof document !== 'undefined' && document && typeof document.createElement === 'function'){
      try{
        var n = document.createElement('div');
        n.className = 'note';
        n.style.margin = '3px 0 8px';
        n.textContent = 'cumulative R (gold) + drawdown vs peak (red) · markers = best / worst trade';
        el.appendChild(n);
      }catch(e){}
    }
    return true;
  }
  try{
    el.innerHTML = sgEquityStrip(trades) +
      '<div class="note" style="margin:3px 0 8px">cumulative R equity · one bar per trade step (green = up, red = down)</div>';
  }catch(e){}
  return false;
}

/* Comparison strip: one mini-card per strategy that ran — expectancy R (big),
   PF / maxDD / win% (small). The card with the best expectancy (among those
   that produced trades) gets the gold border + BEST EDGE tag. Empty when
   fewer than two strategies ran (nothing to compare). */
function sgCompareStrip(items){
  if (!Array.isArray(items) || items.length < 2) return '';
  var bestId = null, bestExp = -Infinity, i, s;
  for (i = 0; i < items.length; i++){
    s = items[i] && items[i].res && items[i].res.stats;
    if (s && s.n > 0 && isFinite(s.expectR) && s.expectR > bestExp){
      bestExp = s.expectR;
      bestId = items[i].meta.id;
    }
  }
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:10px">';
  for (i = 0; i < items.length; i++){
    var meta = items[i].meta;
    s = items[i].res.stats;
    var isBest = (bestId !== null && meta.id === bestId);
    var expCol = !s.n ? 'var(--mut)' : (s.expectR >= 0 ? 'var(--long)' : 'var(--short)');
    html += '<div style="background:var(--panel);border:1px solid ' + (isBest ? 'var(--gold)' : 'var(--line)') +
            ';border-radius:8px;padding:12px 14px' + (isBest ? ';box-shadow:0 0 0 1px var(--gold-dim)' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
        '<b style="font-size:12px;letter-spacing:.04em">' + sgEsc(meta.name) + '</b>' +
        (isBest ? '<span style="color:var(--gold);font-size:10px;letter-spacing:.08em;white-space:nowrap">BEST EDGE</span>' : '') +
      '</div>' +
      '<div style="margin-top:6px;font-size:20px;color:' + expCol + '">' +
        (s.n ? sgR(s.expectR) + 'R' : 'n/a') + '</div>' +
      '<div class="mini" style="margin-top:6px;color:var(--mut)">expectancy · PF ' +
        (s.n ? (isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞') : '—') +
        ' · maxDD -' + s.maxDD.toFixed(2) + 'R · win ' + s.winPct.toFixed(0) + '%' +
        (s.n ? '' : ' · no trades') + '</div>' +
      '</div>';
  }
  return html + '</div>';
}

function sgRenderStrat(meta, res, rows){
  var s = res.stats;
  var html = '<div class="panel" style="margin-top:10px"><h2>' + sgEsc(meta.name) +
             ' <span>' + sgEsc(meta.desc) + '</span></h2>';
  if (!s.n){
    return html + '<div class="empty">No trades generated on this data.</div>'
         + sgLiveFooter(meta.id, rows, res.trades) + '</div>';
  }
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0 16px">';
  html += sgKv('TRADES', String(s.n), '');
  html += sgKv('WIN %', s.winPct.toFixed(1) + '%', s.winPct >= 50 ? 'pos' : 'neg');
  html += sgKv('AVG R', sgR(s.avgR), s.avgR >= 0 ? 'pos' : 'neg');
  html += sgKv('EXPECTANCY R', sgR(s.expectR), s.expectR >= 0 ? 'pos' : 'neg');
  html += sgKv('PROFIT FACTOR', isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞', s.profitFactor >= 1 ? 'pos' : 'neg');
  html += sgKv('MAX DD (R)', '-' + s.maxDD.toFixed(2), 'neg');
  html += sgKv('EXPOSURE', s.exposurePct.toFixed(1) + '%', '');
  var wlRatio = (s.avgLossR < 0) ? (s.avgWinR / Math.abs(s.avgLossR)) : (s.avgWinR > 0 ? Infinity : 0);
  html += sgKv('AVG WIN R', sgR(s.avgWinR), s.avgWinR > 0 ? 'pos' : '');
  html += sgKv('AVG LOSS R', sgR(s.avgLossR), s.avgLossR < 0 ? 'neg' : '');
  html += sgKv('WIN/LOSS RATIO', isFinite(wlRatio) ? wlRatio.toFixed(2) : '∞', wlRatio >= 1 ? 'pos' : 'neg');
  html += sgKv('MAX LOSS STREAK', String(s.maxLoseStreak), s.maxLoseStreak >= 3 ? 'neg' : '');
  html += '</div>';
  html += '<div class="sgEq" data-sgid="' + sgEsc(meta.id) + '" style="margin-top:10px"></div>';
  html += '<table><thead><tr><th>TIME (UTC)</th><th>DIR</th><th>ENTRY</th><th>EXIT</th><th>R</th><th>REASON</th></tr></thead><tbody>';
  var last10 = res.trades.slice(-10).reverse();
  for (var i = 0; i < last10.length; i++){
    var tr = last10[i];
    html += '<tr><td>' + sgTime(tr.t) + '</td>' +
            '<td class="' + (tr.dir === 'long' ? 'pos' : 'neg') + '">' + tr.dir.toUpperCase() + '</td>' +
            '<td>' + sgPx(tr.entry) + '</td>' +
            '<td>' + sgPx(tr.exit) + '</td>' +
            '<td class="' + (tr.r >= 0 ? 'pos' : 'neg') + '">' + sgR(tr.r) + '</td>' +
            '<td>' + sgEsc(tr.reason) + '</td></tr>';
  }
  html += '</tbody></table>';
  html += sgLiveFooter(meta.id, rows, res.trades);
  html += '</div>';
  return html;
}

/* ---------------- HARD REFRESH state ----------------
   House refresh contract (index.html hardRefreshAll): busy guard so
   overlapping invocations never double-fetch; ranOnce + a snapshot of the
   last user-run configuration (symbol/tf/strategy chips) so a global
   refresh replays exactly that run — and never triggers a first-time scan
   on its own (it reports 'skipped: not run yet' instead). */
var __sgState = { busy: false, ranOnce: false, els: null, cfg: null };

async function sgRun(els){
  if (!els || !els.out) return 'skipped: no ui';
  if (__sgState.busy) return 'busy';
  __sgState.busy = true;
  els.run.disabled = true;
  sgSetProg(els.prog, 0.06);
  var sym = String((els.sym && els.sym.value) || 'BTCUSDT').trim().toUpperCase() || 'BTCUSDT';
  var tf = els.tf || '4h';
  /* snapshot the exact configuration being run — refresh() replays THIS one */
  __sgState.els = els;
  __sgState.ranOnce = true;
  __sgState.cfg = { sym: sym, tf: tf, sel: {} };
  for (var sc = 0; sc < SG_STRATS.length; sc++) __sgState.cfg.sel[SG_STRATS[sc].id] = !!els.sel[SG_STRATS[sc].id];
  var status = 'refreshed';
  try{
    if (els.stat) els.stat.textContent = 'fetching ' + sym + ' ' + tf + ' klines…';
    var rows = await binanceKlines(sym, tf, 1500);
    if (!rows || !rows.length){
      els.out.innerHTML = '<div class="note warn">No klines for ' + sgEsc(sym) + ' ' + sgEsc(tf) +
        ' — symbol may not exist on Binance USDT-M perps.</div>';
      if (els.stat) els.stat.textContent = 'no data';
      sgSetProg(els.prog, null);
      status = 'failed: no klines for ' + sym;
      return status;
    }
    if (rows.length >= 1490){ // full recent page => older history exists; page 2
      sgSetProg(els.prog, 0.3);
      await sgSleep(250); // gentle pacing between calls
      if (els.stat) els.stat.textContent = 'fetching older page (up to ~3000 bars)…';
      var older = await sgKlinesBefore(sym, tf, rows[0].t * 1000 - 1, 1500);
      if (older && older.length){
        var map = {}, k;
        for (k = 0; k < older.length; k++) map[older[k].t] = older[k];
        for (k = 0; k < rows.length; k++) map[rows[k].t] = rows[k];
        rows = Object.keys(map).map(function(tk){ return map[tk]; }).sort(function(a, b){ return a.t - b.t; });
      }
    }
    /* closed bars only: drop any tail bar whose close time is still ahead */
    var tfSec = (tf === '1d') ? 86400 : 14400;
    var nowSec = Date.now() / 1000;
    while (rows.length && rows[rows.length - 1].t + tfSec > nowSec) rows.pop();
    sgSetProg(els.prog, 0.6);

    var html = '', ran = 0, todo = 0, s;
    var results = [];
    for (s = 0; s < SG_STRATS.length; s++){ if (els.sel[SG_STRATS[s].id]) todo++; }
    if (rows.length < 300){
      html += '<div class="note warn">Only ' + rows.length + ' closed bars — thin history; stats may be meaningless.</div>';
    }
    if (!todo){
      html += '<div class="empty">Select at least one strategy chip.</div>';
    }
    for (s = 0; s < SG_STRATS.length; s++){
      var meta = SG_STRATS[s];
      if (!els.sel[meta.id]) continue;
      /* per-strategy isolation: one throwing strategy can never sink the run
         (the bt* functions already never throw; this is the second belt) */
      var res;
      try{ res = meta.fn(rows); }catch(eBt){ res = sgZeroResult(); }
      results.push({ meta: meta, res: res });
      ran++;
      sgSetProg(els.prog, 0.6 + 0.35 * ran / Math.max(1, todo));
    }
    html += sgCompareStrip(results);
    for (s = 0; s < results.length; s++){
      html += sgRenderStrat(results[s].meta, results[s].res, rows);
    }
    html += '<div class="note" style="margin-top:8px">' + rows.length + ' closed bars · ' +
            sgTime(rows[0].t) + ' → ' + sgTime(rows[rows.length - 1].t) +
            ' UTC · <b>~' + SG_FEE_BPS + '+' + SG_SLIP_BPS + ' bps/side cost model — scorecard funding separate</b> · signals on closed bars only · ' +
            'entries at signal-bar close · stops checked first per bar (conservative).</div>';
    els.out.innerHTML = html;
    /* charts mount only after the DOM exists; fallback strip renders inline */
    for (s = 0; s < results.length; s++){
      if (!results[s].res.stats.n) continue;
      var slot = els.out.querySelector('[data-sgid="' + results[s].meta.id + '"]');
      if (slot) sgEquityMount(slot, results[s].res.trades);
    }
    if (els.stat) els.stat.textContent = sym + ' · ' + tf + ' · ' + rows.length + ' bars · done ' +
      new Date().toISOString().slice(11, 19) + ' UTC';
    sgSetProg(els.prog, 1);
    setTimeout(function(){ sgSetProg(els.prog, null); }, 600);
  }catch(e){
    els.out.innerHTML = '<div class="note warn">backtest failed: ' + sgEsc(e && e.message || e) + '</div>';
    if (els.stat) els.stat.textContent = 'failed';
    sgSetProg(els.prog, null);
    status = 'failed: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    els.run.disabled = false;
    __sgState.busy = false;
  }
  return status;
}

/* House refresh contract: async, NEVER throws, terse status string —
   'busy' while a run is in flight, 'skipped: not run yet' before the first
   user run (a global refresh must never trigger an expensive first-time
   scan on its own), otherwise re-runs the LAST configuration the user ran
   and returns sgRun's own status. */
async function sgRefresh(){
  try{
    if (__sgState.busy) return 'busy';
    if (!__sgState.ranOnce || !__sgState.els || !__sgState.cfg) return 'skipped: not run yet';
    var els = __sgState.els, cfg = __sgState.cfg;
    /* restore the last-run configuration — the user may have edited the
       inputs since; refresh replays what was RUN, not what is typed now */
    try{
      if (els.sym) els.sym.value = cfg.sym;
      els.tf = cfg.tf;
      for (var i = 0; i < SG_STRATS.length; i++) els.sel[SG_STRATS[i].id] = !!cfg.sel[SG_STRATS[i].id];
    }catch(e0){}
    return await sgRun(els);
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

function mountStrats(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">' +
      '<h2>STRATEGY LAB <span>3 classic backtests · any binance perp · closed bars only</span></h2>' +
      '<div class="row">' +
        '<input id="sgSym" value="BTCUSDT" style="width:120px;text-transform:uppercase" spellcheck="false">' +
        '<button class="chip on" data-tf="4h">4H</button>' +
        '<button class="chip" data-tf="1d">1D</button>' +
        '<button class="chip on" data-strat="ema">EMA CROSS</button>' +
        '<button class="chip on" data-strat="connors">RSI-2 REVERSAL</button>' +
        '<button class="chip on" data-strat="donchian">DONCHIAN BO</button>' +
        '<button class="btn" id="sgRun">RUN BACKTEST</button>' +
        '<span class="note" id="sgStat">idle</span>' +
      '</div>' +
      '<div class="prog" id="sgProg"><i></i></div>' +
    '</div>' +
    '<div id="sgOut"></div>';

  var ok = (typeof binanceKlines === 'function') && (typeof ema === 'function') &&
           (typeof sma === 'function') && (typeof rsi === 'function') &&
           (typeof atr === 'function') && (typeof donchian === 'function') &&
           (typeof crossOver === 'function') && (typeof crossUnder === 'function');
  var out = el.querySelector('#sgOut');
  if (!ok){
    if (out) out.innerHTML = '<div class="note warn">Strategy lab dependencies unavailable ' +
      '(needs indicators.js / indicators2.js / binance.js loaded first).</div>';
    return;
  }
  var els = {
    sym:  el.querySelector('#sgSym'),
    run:  el.querySelector('#sgRun'),
    stat: el.querySelector('#sgStat'),
    prog: el.querySelector('#sgProg'),
    out:  out,
    tf: '4h',
    sel: { ema: true, connors: true, donchian: true }
  };
  __sgState.els = els;   // latest mount wins for the hard-refresh contract
  var tfChips = el.querySelectorAll('[data-tf]');
  for (var a = 0; a < tfChips.length; a++){
    (function(chip){
      chip.addEventListener('click', function(){
        els.tf = chip.getAttribute('data-tf');
        for (var b = 0; b < tfChips.length; b++) tfChips[b].classList.remove('on');
        chip.classList.add('on');
      });
    })(tfChips[a]);
  }
  var stChips = el.querySelectorAll('[data-strat]');
  for (var c2 = 0; c2 < stChips.length; c2++){
    (function(chip){
      chip.addEventListener('click', function(){
        var id = chip.getAttribute('data-strat');
        els.sel[id] = !els.sel[id];
        chip.classList.toggle('on', els.sel[id]);
      });
    })(stChips[c2]);
  }
  if (els.run) els.run.addEventListener('click', function(){ sgRun(els); });
  if (els.sym) els.sym.addEventListener('keydown', function(ev){
    if (ev && ev.key === 'Enter') sgRun(els);
  });
}

/* ---------------- exports + tab registration ---------------- */

W.btEmaCross = btEmaCross;
W.btConnorsRsi2 = btConnorsRsi2;
W.btDonchian = btDonchian;
W.sgLiveLevels = sgLiveLevels;
W.HG_strats = { computeStats: sgComputeStats, equityStrip: sgEquityStrip,
                equityMount: sgEquityMount, compareStrip: sgCompareStrip,
                liveLevels: sgLiveLevels, liveFooter: sgLiveFooter };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'strats', label: 'STRATEGY LAB', mount: mountStrats, refresh: sgRefresh });

})();
