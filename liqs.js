/* =========================================================================
HARDGATE — liqs.js
LIQS tab: real-time liquidation intelligence over Binance USDT-M perps.

Source: wss://fstream.binance.com/ws/!forceOrder@arr — public, no auth.
Every message is a forced-order event:
  { o: { s: symbol, S: 'BUY'|'SELL', p: price, q: qty, T: time } }
  S='BUY'  = a SHORT was liquidated (forced buy)  -> side 'short'
  S='SELL' = a LONG  was liquidated (forced sell) -> side 'long'
  USD value = p x q.

Features:
  - START/STOP buttons driving the socket: reconnect with exponential
    backoff 1s -> 30s + 30% jitter, clean close on STOP, feature-checks
    WebSocket before anything else.
  - TAPE: last 15 prints >= $100K (symbol, LONG LIQ / SHORT LIQ tag,
    $ value, age) updating live; single prints >= $2M are spike-
    highlighted and fire sendAlertPush('LIQ SPIKE', ...) when the global
    exists.
  - Aggregates since start + rolling 1h window: per-symbol totals table
    (long-liq $, short-liq $, count, biggest print) sorted by total.
  - IMBALANCE GAUGE: 1h long-liq$ vs short-liq$ as a two-tone bar with
    interpretation (LONG FLUSH / SHORT FLUSH / balanced).
  - FLUSH-REVERSAL SETUPS: when the 1h imbalance flushes >= 2x AND the
    flushed side contains an extreme single print (>= spikeUsd) inside the
    window, a fade-the-flush setup card is emitted — direction opposite the
    flushed side, ENTRY = current mark, STOP beyond the flush candle's wick
    (+/- 0.5xATR14, documented % fallback), T1 = 2R, T2 = 3.5R. Levels come
    from getCandles/atr when those globals exist and are never fabricated.
  - Status line: connection state, prints seen, session duration.
  - Honest scope note: WS-only — history starts when the tab is opened
    (Binance exposes no free REST liquidation history).

PURE EXPORTS (so tests can drive synthetic prints without a socket):
  window.liqParse(raw)  -> normalized print {sym, side, usd, t} | null
                           (array input -> array of valid prints)
  window.liqAgg(opts?)  -> { add(print), snapshot(now?) }
    opts: { windowMs, spikeUsd, topN, flushRatio }
    add(print) -> { print, spike } | null (invalid prints are dropped)
    snapshot() -> { since, window, imbalance, perSymbol, top, spikes, ... }
  window.liqFlushSetup(snap, rowsOpt, opts?) -> fade-the-flush setup | null
    (see the full contract above the function)

Classic script, no build step. Loads any time; only needs index.html
formatters when present (fallbacks included). Never throws at load time.
Registers via window.HG_tabs.push({id:'liqs', label:'LIQS', mount, refresh})
— refresh reconnects a dead/errored socket (bounded backoff, never against
an explicit STOP) and always recomputes the panels from the current buffer;
'skipped: not run yet' when the tape was never started.

The BRAIN warm-up hook (window.HG_warmups id 'liqs') starts the stream
itself through the very same starter the START button uses — never a
second socket, never against an explicit STOP, honest status strings only
('socket started…' / 'socket live — N events in window' with N the REAL
rolling-window count / 'skipped: …' naming why). Never throws.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables (per brief) ---------------- */
var WS_URL       = 'wss://fstream.binance.com/ws/!forceOrder@arr';
var TAPE_MIN_USD = 100e3;      // tape shows prints >= $100K
var TAPE_MAX     = 15;         // tape rows kept
var SPIKE_USD    = 2e6;        // single print >= $2M = spike
var WINDOW_MS    = 3600e3;     // rolling imbalance window (1h)
var FLUSH_RATIO  = 2.0;        // >= 2x dominant side = flush
var TOP_N        = 10;         // biggest prints kept by the aggregator
var TABLE_MAX    = 25;         // per-symbol rows rendered
var BACKOFF_MIN  = 1000;       // reconnect backoff 1s -> 30s + jitter
var BACKOFF_MAX  = 30000;
var TICK_MS      = 1000;       // status/age refresh cadence while live

/* flush-reversal setup tunables (house convention) */
var SETUP_RR1          = 2;      // T1 = 2R
var SETUP_RR2          = 3.5;    // T2 = 3.5R
var SETUP_WICK_ATR     = 0.5;    // stop buffer = 0.5 x ATR14 beyond the flush wick
var SETUP_FALLBACK_PCT = 0.005;  // stop buffer fallback = 0.5% of entry when ATR unavailable
var SETUP_CANDLES_N    = 60;     // 1h candles pulled for the setup symbol
var SETUP_ROWS_MS      = 60000;  // setup candle cache freshness

/* ---------------- formatters: reuse index.html helpers when present ---------------- */
function _fmtFb(n, d){ d = (d === undefined) ? 2 : d; return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
var FMT = (typeof fmt === 'function') ? fmt : _fmtFb;
var PX  = (typeof px === 'function') ? px : _fmtFb;

function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function fmtUsd(n){
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  if (a >= 1e6) return '$' + FMT(n/1e6, 2) + 'M';
  if (a >= 1e3) return '$' + FMT(n/1e3, 1) + 'K';
  return '$' + FMT(n, 0);
}
function fmtRatio(r){
  if (r === null || r === undefined) return '—';
  if (!isFinite(r)) return '∞';
  return r.toFixed(1);
}
function ago(t, now){
  var s = Math.max(0, Math.round((now - t)/1000));
  if (s < 60) return s + 's';
  var m = Math.floor(s/60);
  if (m < 60) return m + 'm';
  return Math.floor(m/60) + 'h';
}
function fmtDur(ms){
  var s = Math.max(0, Math.floor(ms/1000));
  var h = Math.floor(s/3600), m = Math.floor((s % 3600)/60), ss = s % 60;
  function pad(x){ return (x < 10 ? '0' : '') + x; }
  return h > 0 ? h + ':' + pad(m) + ':' + pad(ss) : m + ':' + pad(ss);
}

/* =========================================================================
PURE PARSER — forceOrder event -> {sym, side, usd, t} | null.
Accepts a raw JSON string or an already-parsed object; array input returns
an array with all invalid entries dropped. Never throws.
========================================================================= */
function liqParseOne(m){
  if (!m || typeof m !== 'object') return null;
  var o = m.o;
  if (!o || typeof o !== 'object') return null;
  var sym  = (typeof o.s === 'string' && o.s) ? o.s : null;
  var side = (o.S === 'BUY') ? 'short' : ((o.S === 'SELL') ? 'long' : null);
  var p = +o.p, q = +o.q, t = +o.T;
  if (!sym || !side || !isFinite(p) || !isFinite(q) || p <= 0 || q <= 0) return null;
  if (!isFinite(t) || t <= 0) t = Date.now();
  return { sym: sym, side: side, usd: p*q, t: t };
}
function liqParse(raw){
  try{
    var m = raw;
    if (typeof raw === 'string') m = JSON.parse(raw);
    if (Array.isArray(m)){
      var out = [];
      for (var i = 0; i < m.length; i++){
        var p = liqParseOne(m[i]);
        if (p) out.push(p);
      }
      return out;
    }
    return liqParseOne(m);
  }catch(e){ return null; }
}

/* =========================================================================
PURE AGGREGATOR — liqAgg(opts) -> {add, snapshot}.
  since      : totals since the factory was created
  window     : rolling sums over the last windowMs (pruned on add/snapshot)
  imbalance  : window long-liq$ / short-liq$ ratio + flush classification
               (>= flushRatio -> 'long-flush', <= 1/flushRatio -> 'short-flush')
  perSymbol  : totals per symbol, sorted by total desc
  top        : biggest prints (desc, max topN)
All inputs validated; malformed prints are dropped (add returns null).
========================================================================= */
function liqAgg(opts){
  opts = opts || {};
  var WINDOW = (isFinite(opts.windowMs)   && opts.windowMs   > 0) ? opts.windowMs        : WINDOW_MS;
  var SPIKE  = (isFinite(opts.spikeUsd)   && opts.spikeUsd   > 0) ? opts.spikeUsd        : SPIKE_USD;
  var TOPN   = (isFinite(opts.topN)       && opts.topN       > 0) ? Math.floor(opts.topN): TOP_N;
  var FLUSH  = (isFinite(opts.flushRatio) && opts.flushRatio > 1) ? opts.flushRatio      : FLUSH_RATIO;

  var since = { longUsd: 0, shortUsd: 0, count: 0 };
  var win = [];            /* {side, usd, t} chronological */
  var syms = {};           /* sym -> {sym, longUsd, shortUsd, count, biggestUsd} */
  var top = [];            /* prints, desc by usd, max TOPN */
  var spikes = 0;

  function prune(now){
    var cut = now - WINDOW, i = 0;
    while (i < win.length && win[i].t <= cut) i++;
    if (i > 0) win.splice(0, i);
  }

  function add(print){
    if (!print || typeof print !== 'object') return null;
    var sym  = (typeof print.sym === 'string' && print.sym) ? print.sym : null;
    var side = (print.side === 'long') ? 'long' : ((print.side === 'short') ? 'short' : null);
    var usd  = +print.usd;
    var t    = (isFinite(+print.t) && +print.t > 0) ? +print.t : Date.now();
    if (!sym || !side || !isFinite(usd) || usd < 0) return null;
    var p = { sym: sym, side: side, usd: usd, t: t };

    win.push({ side: side, usd: usd, t: t });
    prune(t); /* keep the window honest even when prints arrive out of order */

    if (side === 'long') since.longUsd += usd; else since.shortUsd += usd;
    since.count++;

    var s = syms[sym] || (syms[sym] = { sym: sym, longUsd: 0, shortUsd: 0, count: 0, biggestUsd: 0 });
    if (side === 'long') s.longUsd += usd; else s.shortUsd += usd;
    s.count++;
    if (usd > s.biggestUsd) s.biggestUsd = usd;

    var spike = usd >= SPIKE;
    if (spike) spikes++;
    if (top.length < TOPN || usd > top[top.length - 1].usd){
      top.push(p);
      top.sort(function(a, b){ return b.usd - a.usd; });
      if (top.length > TOPN) top.length = TOPN;
    }
    return { print: p, spike: spike };
  }

  function snapshot(now){
    now = (isFinite(+now) && +now > 0) ? +now : Date.now();
    prune(now);
    var wl = 0, ws = 0, i;
    for (i = 0; i < win.length; i++){
      if (win[i].side === 'long') wl += win[i].usd; else ws += win[i].usd;
    }
    var ratio = null;
    if (wl > 0 && ws > 0) ratio = wl/ws;
    else if (wl > 0)      ratio = Infinity;
    else if (ws > 0)      ratio = 0;
    var cls = 'balanced';
    if (ratio !== null){
      if (ratio >= FLUSH) cls = 'long-flush';
      else if (ratio <= 1/FLUSH) cls = 'short-flush';
    }
    var text;
    if (cls === 'long-flush')
      text = 'LONG FLUSH ' + fmtRatio(ratio) + '× — forced selling dominant, capitulation conditions';
    else if (cls === 'short-flush')
      text = 'SHORT FLUSH ' + fmtRatio(ratio === 0 ? Infinity : 1/ratio) + '× — forced buying dominant, short-squeeze conditions';
    else
      text = (ratio === null)
        ? 'BALANCED — no liquidation prints in the window yet'
        : 'BALANCED ' + fmtRatio(ratio) + '× — no dominant flush side';

    var perSymbol = [];
    for (var k in syms){ if (Object.prototype.hasOwnProperty.call(syms, k)) perSymbol.push(syms[k]); }
    perSymbol.sort(function(a, b){
      return ((b.longUsd + b.shortUsd) - (a.longUsd + a.shortUsd)) || (b.count - a.count);
    });

    return {
      since:     { longUsd: since.longUsd, shortUsd: since.shortUsd, count: since.count },
      window:    { longUsd: wl, shortUsd: ws, count: win.length, ms: WINDOW },
      imbalance: { ratio: ratio, cls: cls, text: text, flushRatio: FLUSH },
      perSymbol: perSymbol,
      top:       top.slice(),
      spikes:    spikes,
      spikeUsd:  SPIKE
    };
  }

  function replay(prints){
    if (!Array.isArray(prints)) return 0;
    var n = 0, i;
    for (i = 0; i < prints.length; i++) if (add(prints[i])) n++;
    return n;
  }

  return { add: add, snapshot: snapshot, replay: replay };
}

/* =========================================================================
PURE FLUSH-REVERSAL SETUP — liqFlushSetup(snap, rowsOpt, opts?).

Trigger (BOTH required — a real capitulation, not a slow bleed):
  1. the rolling-window imbalance is a flush per the snapshot's own
     classification (dominant side >= flushRatio x, default 2x);
  2. the flushed side is EXTREME: at least one single print >= spikeUsd
     (the snapshot's own spike threshold, default $2M) on the flushed
     side inside the rolling window.

Setup (fade the flushed side):
  dir        = OPPOSITE the flushed side (long flush -> short, short flush -> long)
  ENTRY      = current mark = last close of rowsOpt
  STOP       = beyond the flush candle's adverse wick extreme:
               short -> flush-candle HIGH + 0.5xATR14, long -> flush-candle
               LOW - 0.5xATR14; when atr (indicators.js) is unavailable the
               buffer degrades to 0.5% of entry (documented fallback)
  T1 = 2R, T2 = 3.5R (house convention)

snap     : a liqAgg().snapshot() object (uses imbalance, window.ms, top, spikeUsd)
rowsOpt  : optional kline rows [{t,o,h,l,c,v}] for the spike symbol — t may be
           seconds (index.html convention) or ms; candles with non-finite
           h/l/c are dropped
opts     : { now, minSpikeUsd } — test hooks, both default sensibly

Returns null when there is no tradeable flush. Otherwise returns
  { type:'FLUSH-REVERSAL', dir, flushSide, sym, ratio, flushUsd, spikeUsd,
    entry, stop, t1, t2, rr1, rr2, riskPct, note }
with entry/stop/t1/t2/riskPct = null (and an honest note) when kline context
is missing or degenerate — levels are never fabricated. Never throws.
========================================================================= */
function liqFlushRows(rowsOpt){
  if (!Array.isArray(rowsOpt)) return [];
  var out = [];
  for (var i = 0; i < rowsOpt.length; i++){
    var r = rowsOpt[i];
    if (!r || typeof r !== 'object') continue;
    var h = +r.h, l = +r.l, c = +r.c;
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
    out.push(r);
  }
  return out;
}
function liqFlushCandle(rows, spikeT){
  /* candle whose interval contains the spike; falls back to the last row */
  if (!isFinite(spikeT) || !rows.length) return rows[rows.length - 1];
  var ms = [], i;
  for (i = 0; i < rows.length; i++){
    var t = +rows[i].t;
    ms.push(isFinite(t) ? (t < 1e12 ? t*1000 : t) : NaN);
  }
  var dur = 3600e3; /* 1h default */
  for (i = ms.length - 1; i > 0; i--){
    if (isFinite(ms[i]) && isFinite(ms[i-1]) && ms[i] > ms[i-1]){ dur = ms[i] - ms[i-1]; break; }
  }
  for (i = ms.length - 1; i >= 0; i--){
    if (isFinite(ms[i]) && ms[i] <= spikeT && spikeT < ms[i] + dur) return rows[i];
  }
  return rows[rows.length - 1];
}
function liqFlushSetup(snap, rowsOpt, opts){
  try{
    opts = opts || {};
    if (!snap || typeof snap !== 'object' || !snap.imbalance) return null;
    var cls = snap.imbalance.cls;
    if (cls !== 'long-flush' && cls !== 'short-flush') return null;
    var flushSide = (cls === 'long-flush') ? 'long' : 'short';
    var dir = (flushSide === 'long') ? 'short' : 'long';

    var spikeUsd = (isFinite(+opts.minSpikeUsd) && +opts.minSpikeUsd > 0) ? +opts.minSpikeUsd
                 : (isFinite(+snap.spikeUsd) && +snap.spikeUsd > 0) ? +snap.spikeUsd : SPIKE_USD;
    var now   = (isFinite(+opts.now) && +opts.now > 0) ? +opts.now : Date.now();
    var winMs = (snap.window && isFinite(+snap.window.ms) && +snap.window.ms > 0) ? +snap.window.ms : WINDOW_MS;
    var cut = now - winMs;

    var biggest = 0, biggestT = NaN, sym = null;
    var top = Array.isArray(snap.top) ? snap.top : [];
    for (var i = 0; i < top.length; i++){
      var p = top[i];
      if (!p || p.side !== flushSide) continue;
      var usd = +p.usd, t = +p.t;
      if (!isFinite(usd) || !isFinite(t) || t <= cut) continue;
      if (usd > biggest){ biggest = usd; biggestT = t; sym = (typeof p.sym === 'string' && p.sym) ? p.sym : null; }
    }
    if (!(biggest >= spikeUsd)) return null;

    var rawRatio = snap.imbalance.ratio;
    var ratio = (typeof rawRatio === 'number' && (isFinite(rawRatio) || rawRatio === Infinity)) ? rawRatio : null;
    var setup = {
      type: 'FLUSH-REVERSAL',
      dir: dir, flushSide: flushSide, sym: sym,
      ratio: ratio,
      flushUsd: biggest, spikeUsd: spikeUsd,
      entry: null, stop: null, t1: null, t2: null,
      rr1: SETUP_RR1, rr2: SETUP_RR2, riskPct: null,
      note: ''
    };

    /* ---- plan levels (need klines; never fabricated) ---- */
    var rows = liqFlushRows(rowsOpt);
    if (!rows.length){
      setup.note = 'flush is real but kline context unavailable (getCandles absent/failed) — no ENTRY/STOP levels emitted';
      return setup;
    }
    var entry = +rows[rows.length - 1].c;
    var fc = liqFlushCandle(rows, biggestT);
    var wick = (dir === 'short') ? +fc.h : +fc.l;

    var a14 = NaN;
    if (typeof atr === 'function'){
      try{
        var arr = atr(rows, 14);
        var lv = (Array.isArray(arr) && arr.length) ? +arr[arr.length - 1] : NaN;
        if (isFinite(lv) && lv > 0) a14 = lv;
      }catch(e){ a14 = NaN; }
    }
    var buffer, bufNote;
    if (isFinite(a14)){
      buffer = SETUP_WICK_ATR * a14;
      bufNote = 'stop = flush-candle ' + (dir === 'short' ? 'high' : 'low') + ' ' + (dir === 'short' ? '+' : '-') + ' 0.5xATR14';
    }else{
      buffer = SETUP_FALLBACK_PCT * entry;
      bufNote = 'stop = flush-candle ' + (dir === 'short' ? 'high' : 'low') + ' ' + (dir === 'short' ? '+' : '-') + ' ' + (SETUP_FALLBACK_PCT*100).toFixed(1) + '% of entry (ATR unavailable — % fallback)';
    }
    var stop = (dir === 'short') ? wick + buffer : wick - buffer;
    var risk = Math.abs(entry - stop);
    var sane = isFinite(entry) && entry > 0 && isFinite(stop) && isFinite(risk) && risk > 0
            && (dir === 'short' ? stop > entry : stop < entry);
    if (!sane){
      setup.note = 'candle data degenerate (non-finite or crossed levels) — no plan emitted';
      return setup;
    }
    setup.entry = entry;
    setup.stop  = stop;
    setup.t1    = (dir === 'short') ? entry - SETUP_RR1*risk : entry + SETUP_RR1*risk;
    setup.t2    = (dir === 'short') ? entry - SETUP_RR2*risk : entry + SETUP_RR2*risk;
    setup.riskPct = risk/entry*100;
    setup.note  = bufNote + ' · ENTRY = last 1h close (current mark)';
    return setup;
  }catch(e){ return null; }
}

/* =========================================================================
Tab state + socket layer — one logical stream shared by the mounted pane.
========================================================================= */
var LIQS_LS_KEY = 'hg_liqs_session_v1';
var __liqsSaveTimer = null;

function __liqsStorage(){
  try{
    var ls = (typeof G !== 'undefined' && G && G.localStorage) ? G.localStorage : null;
    if (!ls && typeof localStorage !== 'undefined') ls = localStorage;
    return (ls && typeof ls.getItem === 'function') ? ls : null;
  }catch(e){ return null; }
}
function __liqsLsRead(){
  try{
    var localStorage = __liqsStorage();
    if (!localStorage) return null;
    var raw = localStorage.getItem(LIQS_LS_KEY);
    if (!raw) return null;
    var j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || !Array.isArray(j.prints)) return null;
    return j;
  }catch(e){ return null; }
}
function __liqsLsWrite(data){
  try{
    var localStorage = __liqsStorage();
    if (!localStorage || typeof localStorage.setItem !== 'function') return;
    localStorage.setItem(LIQS_LS_KEY, JSON.stringify(data));
  }catch(e){}
}
function __liqsLsClear(){
  try{
    var localStorage = __liqsStorage();
    if (!localStorage || typeof localStorage.removeItem !== 'function') return;
    localStorage.removeItem(LIQS_LS_KEY);
  }catch(e){}
}
function __liqsPersistPayload(){
  var prints = S.persistPrints || [];
  var cut = Date.now() - WINDOW_MS;
  prints = prints.filter(function(p){ return p && isFinite(p.t) && p.t > cut; });
  S.persistPrints = prints;
  return { v: 1, at: Date.now(), manualClose: !!S.manualClose, prints: prints };
}
function __liqsSaveSession(){
  try{ __liqsLsWrite(__liqsPersistPayload()); }catch(e){}
}
function __liqsSaveSessionThrottled(){
  if (__liqsSaveTimer) return;
  __liqsSaveTimer = setTimeout(function(){
    __liqsSaveTimer = null;
    __liqsSaveSession();
  }, 5000);
}
function __liqsHydrateSession(){
  try{
    var j = __liqsLsRead();
    if (!j) return;
    if (j.manualClose) S.manualClose = true;
    var cut = Date.now() - WINDOW_MS;
    var prints = (j.prints || []).filter(function(p){
      return p && p.sym && (p.side === 'long' || p.side === 'short') && isFinite(p.usd) && isFinite(p.t) && p.t > cut;
    });
    S.persistPrints = prints.slice();
    if (prints.length && S.agg && typeof S.agg.replay === 'function') S.agg.replay(prints);
  }catch(e){}
}

var S = {
  agg:        liqAgg(),
  tape:       [],        /* last TAPE_MAX prints >= TAPE_MIN_USD */
  persistPrints: [],
  ws:         null,
  status:     'idle',    /* idle | connecting | live | reconnecting | stopped | error */
  startedAt:  null,
  prints:     0,
  ignored:    0,
  backoff:    BACKOFF_MIN,
  retryTimer: null,
  tickTimer:  null,
  manualClose: false,
  el:         null,
  setupRows:  null,      /* {sym, rows, at} 1h candles for the current setup symbol */
  setupFetchKey: null    /* symbol with an in-flight setup candle fetch */
};
__liqsHydrateSession();

function q(sel){ return (S.el && typeof S.el.querySelector === 'function') ? S.el.querySelector(sel) : null; }

function onSpike(p){
  try{
    if (typeof sendAlertPush === 'function'){
      sendAlertPush('LIQ SPIKE',
        p.sym + ' ' + (p.side === 'long' ? 'LONG' : 'SHORT') + ' LIQ ' + fmtUsd(p.usd)
        + ' — single forced print ≥ ' + fmtUsd(SPIKE_USD));
    }
  }catch(e){ /* push layer is best-effort */ }
}

function ingest(parsed){
  var list = Array.isArray(parsed) ? parsed : [parsed];
  var got = false;
  for (var i = 0; i < list.length; i++){
    var res = S.agg.add(list[i]);
    if (!res){ S.ignored++; continue; }
    S.prints++;
    got = true;
    var p = res.print;
    if (p.usd >= TAPE_MIN_USD){
      S.tape.unshift({ sym: p.sym, side: p.side, usd: p.usd, t: p.t, spike: res.spike });
      if (S.tape.length > TAPE_MAX) S.tape.length = TAPE_MAX;
    }
    if (res.spike) onSpike(p);
    S.persistPrints = S.persistPrints || [];
    S.persistPrints.push({ sym: p.sym, side: p.side, usd: p.usd, t: p.t });
    var cutP = Date.now() - WINDOW_MS;
    if (S.persistPrints.length > 400){
      S.persistPrints = S.persistPrints.filter(function(x){ return x && x.t > cutP; });
    }
    __liqsSaveSessionThrottled();
  }
  return got;
}

function scheduleRetry(){
  clearTimeout(S.retryTimer);
  var d = S.backoff + Math.random() * S.backoff * 0.3; /* +30% jitter */
  S.backoff = Math.min(S.backoff * 2, BACKOFF_MAX);
  render();
  S.retryTimer = setTimeout(function(){
    if (!S.manualClose) connect();
  }, d);
}

function connect(){
  if (typeof WebSocket !== 'function'){
    S.status = 'error';
    render();
    return;
  }
  S.status = S.startedAt ? 'reconnecting' : 'connecting';
  render();
  var ws;
  try{ ws = new WebSocket(WS_URL); }
  catch(e){ scheduleRetry(); return; }
  S.ws = ws;
  ws.onopen = function(){
    S.status = 'live';
    S.backoff = BACKOFF_MIN;
    if (!S.startedAt) S.startedAt = Date.now();
    render();
  };
  ws.onmessage = function(ev){
    var parsed = liqParse(ev && ev.data);
    if (!parsed || (Array.isArray(parsed) && !parsed.length)){ S.ignored++; return; }
    if (ingest(parsed)) render();
  };
  ws.onerror = function(){ /* onclose drives the retry */ };
  ws.onclose = function(){
    S.ws = null;
    if (S.manualClose){ S.status = 'stopped'; render(); return; }
    S.status = 'reconnecting';
    scheduleRetry();
  };
}

/* reconnect NOW on demand (hard refresh): detach the stale socket's handlers
   (so its belated onclose can't schedule a ghost retry), drop it, reset the
   bounded backoff and open one fresh connection. A single immediate attempt —
   if it fails, connect()'s onclose/ctor-catch falls back to the existing
   bounded scheduleRetry (1s -> 30s + jitter; never an unbounded loop).
   Never throws. */
function reconnectNow(){
  try{
    clearTimeout(S.retryTimer);
    S.retryTimer = null;
    S.backoff = BACKOFF_MIN;
    var ws = S.ws;
    S.ws = null;
    if (ws){
      try{ ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; }catch(eH){}
      if (typeof ws.close === 'function'){ try{ ws.close(); }catch(eC){} }
    }
    connect();
  }catch(e){ S.status = 'error'; render(); }
}

function startStream(){
  try{
    if (S.status === 'live' || S.status === 'connecting' || S.status === 'reconnecting') return;
    if (typeof WebSocket !== 'function'){
      S.status = 'error';
      render();
      return;
    }
    /* explicit START = fresh session */
    S.agg = liqAgg();
    S.tape = [];
    S.prints = 0;
    S.ignored = 0;
    S.startedAt = null;
    S.backoff = BACKOFF_MIN;
    S.setupRows = null;
    S.setupFetchKey = null;
    S.persistPrints = [];
    __liqsLsClear();
    S.manualClose = false;
    clearTimeout(S.retryTimer);
    clearInterval(S.tickTimer);
    S.tickTimer = setInterval(render, TICK_MS);
    connect();
  }catch(e){ S.status = 'error'; render(); }
}

function stopStream(){
  try{
    S.manualClose = true;
    clearTimeout(S.retryTimer);
    clearInterval(S.tickTimer);
    S.tickTimer = null;
    var ws = S.ws;
    S.ws = null;
    if (ws && typeof ws.close === 'function'){
      try{ ws.close(); }catch(e){}
    }
    S.status = 'stopped';
    __liqsSaveSession();
    render();
  }catch(e){ /* never throw from a button */ }
}

/* ---------------- renderers ---------------- */
function renderStat(){
  var stat = q('#liqsStat'); if (!stat) return;
  var sess = S.startedAt ? fmtDur(Date.now() - S.startedAt) : '—';
  var txt;
  if (S.status === 'live'){
    stat.className = 'note';
    txt = '● LIVE — prints ' + FMT(S.prints, 0) + ' · session ' + sess
        + (S.ignored ? ' · ' + S.ignored + ' malformed ignored' : '');
  }else if (S.status === 'connecting' || S.status === 'reconnecting'){
    stat.className = 'note warn';
    txt = S.status + ' — reconnect backoff up to 30s · prints ' + FMT(S.prints, 0) + ' · session ' + sess;
  }else if (S.status === 'error'){
    stat.className = 'note warn';
    txt = 'WebSocket unavailable in this browser — live tape disabled';
  }else if (S.status === 'stopped'){
    stat.className = 'note';
    txt = 'stopped — prints ' + FMT(S.prints, 0) + ' kept until next START (START resets the session)';
  }else{
    stat.className = 'note';
    txt = 'idle — press START to open the liquidation stream';
  }
  stat.textContent = txt;
}

/* START reflects the stream state too: a socket that is already connecting/
   live — however it was started, tab click OR brain warm-up auto-start —
   shows as already-running (disabled), never a second socket. */
function renderButtons(){
  var bStart = q('#liqsStart'); if (!bStart) return;
  var noWS = (typeof WebSocket !== 'function');
  var running = (S.status === 'live' || S.status === 'connecting' || S.status === 'reconnecting');
  bStart.disabled = noWS || running;
  bStart.textContent = (S.status === 'live') ? 'RUNNING'
                     : (running ? 'CONNECTING…' : 'START');
}

function renderTape(){
  var box = q('#liqsTape'); if (!box) return;
  var now = Date.now();
  if (!S.tape.length){
    box.innerHTML = '<div class="empty">No prints ≥ ' + fmtUsd(TAPE_MIN_USD)
      + ' yet' + ((S.status === 'live') ? ' — listening…' : ' — press START.') + '</div>';
    return;
  }
  var rows = S.tape.map(function(p){
    return '<div class="lrow"' + (p.spike ? ' style="box-shadow:inset 0 0 0 1px var(--gold);background:rgba(217,164,65,.06)"' : '') + '>'
      + '<span class="gid" style="width:96px">' + esc(p.sym) + '</span>'
      + '<span class="gname ' + (p.side === 'long' ? 'neg' : 'pos') + '">'
      + (p.side === 'long' ? 'LONG LIQ' : 'SHORT LIQ') + (p.spike ? ' ⚡' : '') + '</span>'
      + '<span class="gdetail">' + ago(p.t, now) + ' ago</span>'
      + '<span class="stamp ' + (p.side === 'long' ? 'veto' : 'pass') + '">' + fmtUsd(p.usd) + '</span>'
      + '</div>';
  });
  box.innerHTML = '<div class="ledger">' + rows.join('') + '</div>';
}

function renderGauge(snap){
  var box = q('#liqsGauge'), imb = q('#liqsImb'); if (!box) return;
  var wl = snap.window.longUsd, ws = snap.window.shortUsd, tot = wl + ws;
  if (tot <= 0){
    box.innerHTML = '<div class="empty">no liquidation prints inside the 1h window yet</div>';
    if (imb){ imb.className = 'note'; imb.textContent = snap.imbalance.text; }
    return;
  }
  var lp = wl/tot*100, sp = 100 - lp;
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--mut);margin-bottom:4px">'
    + '<span>LONG LIQ ' + fmtUsd(wl) + ' (' + lp.toFixed(0) + '%)</span>'
    + '<span>SHORT LIQ ' + fmtUsd(ws) + ' (' + sp.toFixed(0) + '%)</span></div>'
    + '<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;border:1px solid var(--line);background:var(--panel2)">'
    + '<i style="display:block;width:' + lp.toFixed(2) + '%;background:var(--short)"></i>'
    + '<i style="display:block;width:' + sp.toFixed(2) + '%;background:var(--long)"></i>'
    + '</div>';
  if (imb){
    imb.className = (snap.imbalance.cls === 'balanced') ? 'note' : 'note warn';
    imb.textContent = snap.imbalance.text + ' · window ' + FMT(snap.window.count, 0) + ' prints';
  }
}

function renderTable(snap){
  var box = q('#liqsSyms'); if (!box) return;
  if (!snap.perSymbol.length){
    box.innerHTML = '<div class="empty">nothing liquidated since start</div>';
    return;
  }
  var list = snap.perSymbol.slice(0, TABLE_MAX);
  var h = '<table><thead><tr><th>SYMBOL</th><th>LONG LIQ $</th><th>SHORT LIQ $</th><th>PRINTS</th><th>BIGGEST</th></tr></thead><tbody>';
  for (var i = 0; i < list.length; i++){
    var r = list[i];
    h += '<tr><td>' + esc(r.sym) + '</td>'
      + '<td class="neg">' + fmtUsd(r.longUsd) + '</td>'
      + '<td class="pos">' + fmtUsd(r.shortUsd) + '</td>'
      + '<td>' + FMT(r.count, 0) + '</td>'
      + '<td>' + fmtUsd(r.biggestUsd) + '</td></tr>';
  }
  h += '</tbody></table>';
  if (snap.perSymbol.length > TABLE_MAX)
    h += '<div class="note" style="margin-top:6px">top ' + TABLE_MAX + ' of ' + snap.perSymbol.length + ' symbols by total liquidated</div>';
  h += '<div class="note" style="margin-top:6px">since start: long liq ' + fmtUsd(snap.since.longUsd)
    + ' · short liq ' + fmtUsd(snap.since.shortUsd) + ' · ' + FMT(snap.since.count, 0) + ' prints'
    + (snap.spikes ? ' · ' + snap.spikes + ' spike' + (snap.spikes === 1 ? '' : 's') + ' ≥ ' + fmtUsd(snap.spikeUsd) : '')
    + '</div>';
  box.innerHTML = h;
}

/* ---------------- flush-reversal setup card ---------------- */
function maybeFetchSetupRows(sym){
  try{
    if (!sym || typeof getCandles !== 'function') return;
    var fresh = S.setupRows && S.setupRows.sym === sym && (Date.now() - S.setupRows.at) < SETUP_ROWS_MS;
    if (fresh || S.setupFetchKey === sym) return;
    S.setupFetchKey = sym;
    getCandles(sym, '1h', SETUP_CANDLES_N).then(function(rows){
      if (S.setupFetchKey === sym) S.setupFetchKey = null;
      if (rows && rows.length){
        S.setupRows = { sym: sym, rows: rows, at: Date.now() };
        render();
      }
    }).catch(function(){ if (S.setupFetchKey === sym) S.setupFetchKey = null; });
  }catch(e){ S.setupFetchKey = null; }
}

function setupCardHTML(setup){
  var dirUp = setup.dir.toUpperCase();
  var flushX = (setup.flushSide === 'long')
    ? setup.ratio
    : (setup.ratio && setup.ratio > 0 ? 1/setup.ratio : (setup.ratio === 0 ? Infinity : null));
  var hasPlan = setup.entry !== null;
  var planTxt = hasPlan
    ? 'ENTRY <b>' + PX(setup.entry) + '</b> · STOP <b>' + PX(setup.stop) + '</b>'
      + ' · T1 ' + PX(setup.t1) + ' (' + FMT(setup.rr1, 1) + 'R) · T2 ' + PX(setup.t2) + ' (' + FMT(setup.rr2, 1) + 'R)'
      + ' · risk ' + FMT(setup.riskPct, 2) + '%'
      + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(setup.entry, setup.stop) : '')
      + (setup.note ? ' — ' + esc(setup.note) : '')
    : 'no tradeable levels — ' + esc(setup.note);
  var tradeBtn = (hasPlan && setup.sym && typeof toTrade === 'function')
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(setup.sym) + ',' + JSON.stringify(setup.dir) + ',' + setup.entry + ',' + setup.stop + ',' + setup.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  return '<div class="card ' + setup.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(setup.sym || 'MULTI') + '</span>'
    + '<span class="dir">' + dirUp + ' · FADE THE FLUSH</span></div>'
    + '<div class="mini">'
    + '<span class="k">flushed side</span><span>' + setup.flushSide.toUpperCase() + 'S LIQUIDATED</span>'
    + '<span class="k">1h imbalance</span><span>' + fmtRatio(flushX) + '×</span>'
    + '<span class="k">capitulation print</span><span>' + fmtUsd(setup.flushUsd) + '</span>'
    + '<span class="k">spike floor</span><span>' + fmtUsd(setup.spikeUsd) + '</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ok">' + setup.flushSide.toUpperCase() + ' FLUSH ' + fmtRatio(flushX) + '×</span>'
    + '<span class="gpip ok">EXTREME SPIKE ≥ ' + fmtUsd(setup.spikeUsd) + '</span>'
    + '<span class="gpip">fade → ' + dirUp + '</span>'
    + '</div>'
    + '<div class="plan">' + planTxt + '</div>'
    + tradeBtn
    + '</div>';
}

function renderSetups(snap){
  var box = q('#liqsSetups'); if (!box) return;
  /* probe without rows first — the trigger never depends on klines, so this
     identifies the flush (and its symbol) even before candles arrive */
  var probe = liqFlushSetup(snap, null, { now: Date.now() });
  if (!probe){
    box.innerHTML = '<div class="empty">no flush-reversal setup — needs a ≥' + FLUSH_RATIO
      + '× 1h imbalance with a single print ≥ ' + fmtUsd(SPIKE_USD) + ' on the flushed side inside the window</div>';
    return;
  }
  var rows = (S.setupRows && S.setupRows.sym === probe.sym) ? S.setupRows.rows : null;
  var setup = rows ? liqFlushSetup(snap, rows, { now: Date.now() }) : probe;
  if (!setup){ box.innerHTML = '<div class="empty">no flush-reversal setup right now</div>'; return; }
  maybeFetchSetupRows(setup.sym); /* no-op without getCandles / while fresh / in-flight */
  box.innerHTML = setupCardHTML(setup);
}

function render(){
  try{
    if (!S.el) return;
    var snap = S.agg.snapshot();
    renderStat();
    renderButtons();
    renderTape();
    renderGauge(snap);
    renderTable(snap);
    renderSetups(snap);
  }catch(e){ /* render must never break the stream */ }
}

/* ---------------- tab UI ---------------- */
function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<div class="panel">'
      + '<h2>LIQS — real-time liquidation intelligence <span>binance usdt-m force-order stream · live tape · 1h imbalance</span></h2>'
      + '<div class="row"><button class="btn" id="liqsStart">START</button>'
      + '<button class="btn ghost" id="liqsStop">STOP</button>'
      + '<span class="note" id="liqsStat"></span></div>'
      + '<div class="note" style="margin-top:8px">BUY prints = <b>SHORT LIQ</b> (forced buy) · SELL prints = <b>LONG LIQ</b> (forced sell) · '
      + '$ value = price × qty · tape shows prints ≥ ' + fmtUsd(TAPE_MIN_USD) + ' · single prints ≥ ' + fmtUsd(SPIKE_USD)
      + ' are spike-highlighted and push an alert when configured.</div>'
      + '<div class="note warn" style="margin-top:6px">WS-only — history starts when you open this tab '
      + '(Binance exposes no free REST liq history).</div>'
      + '</div>'
      + '<div class="panel">'
      + '<h2>1H IMBALANCE <span>rolling window · long-liq$ vs short-liq$ · ≥' + FLUSH_RATIO + '× = flush</span></h2>'
      + '<div id="liqsGauge"></div>'
      + '<div class="note" id="liqsImb" style="margin-top:6px"></div>'
      + '</div>'
      + '<div class="panel">'
      + '<h2>FLUSH-REVERSAL SETUPS <span>fade the flush · ≥' + FLUSH_RATIO + '× imbalance + extreme spike · T1 2R / T2 3.5R</span></h2>'
      + '<div id="liqsSetups"></div>'
      + '</div>'
      + '<div class="panel">'
      + '<h2>TAPE <span>last ' + TAPE_MAX + ' prints ≥ ' + fmtUsd(TAPE_MIN_USD) + '</span></h2>'
      + '<div id="liqsTape"></div>'
      + '</div>'
      + '<div class="panel">'
      + '<h2>BY SYMBOL <span>since start · sorted by total liquidated</span></h2>'
      + '<div id="liqsSyms"></div>'
      + '</div>';

    S.el = el;
    var bStart = el.querySelector('#liqsStart'), bStop = el.querySelector('#liqsStop');
    if (bStart) bStart.addEventListener('click', startStream);
    if (bStop)  bStop.addEventListener('click', stopStream);
    render();
    if (typeof WebSocket !== 'function'){
      if (bStart) bStart.disabled = true;
      var stat = el.querySelector('#liqsStat');
      if (stat){ stat.className = 'note warn'; stat.textContent = 'WebSocket unavailable in this browser — live tape disabled'; }
    }
  }catch(e){ /* never throw at mount */ }
}

/* ---------------- registration ---------------- */
/* refresh contract (hard refresh): async, NEVER throws, terse status string.
   The tape is a live WS, so refresh:
     - returns 'skipped: not run yet' when the operator never pressed START
       (a global refresh must never OPEN a first-time session);
     - reconnects immediately when the socket is dead (null / CLOSING /
       CLOSED / errored) — but NEVER against an explicit STOP (manualClose);
     - ALWAYS recomputes the aggregate/gauge/flush panels from the current
       tape buffer and returns 'refreshed'. */
async function refreshLiqs(){
  try{
    if (S.status === 'idle' && !S.startedAt) return 'skipped: not run yet';
    var ws = S.ws, rs = -1;
    try{ rs = (ws && isFinite(+ws.readyState)) ? +ws.readyState : -1; }catch(eR){ rs = -1; }
    var dead = (!ws) || (rs === 2) || (rs === 3) || (S.status === 'error');
    if (dead && !S.manualClose && typeof WebSocket === 'function') reconnectNow();
    render(); /* always recompute the panels from the current buffer */
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

G.liqParse = liqParse;
G.liqAgg = liqAgg;
G.liqFlushSetup = liqFlushSetup;
G.liqsState = function liqsState(){
  try{
    if (!S || !S.agg || typeof S.agg.snapshot !== 'function') return null;
    var snap = S.agg.snapshot();
    var hasData = !!(snap && snap.window && snap.window.count > 0);
    var live = (S.status === 'live' || S.status === 'connecting' || S.status === 'reconnecting');
    if (!hasData && !live && !S.startedAt) return null;
    var cls = snap.imbalance && snap.imbalance.cls;
    var setup = null;
    if ((cls === 'long-flush' || cls === 'short-flush') && typeof liqFlushSetup === 'function')
      setup = liqFlushSetup(snap, null) || null;
    return { snap: snap, setup: setup, at: Date.now(), live: live, manualClose: !!S.manualClose };
  }catch(e){ return null; }
};
G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'liqs', label: 'LIQS', mount: function(el){ mount(el); }, refresh: refreshLiqs });
/* BRAIN warm-up hook: this layer is fed by a live websocket only (Binance
   exposes no free REST liquidation history), so warming means STARTING the
   stream — through startStream(), the exact starter the tab's START button
   uses (no duplicated socket logic; its guard makes a connecting/live
   socket a no-op, so warm never opens a second one):
     - no WebSocket in this environment -> honest skip, nothing thrown;
     - explicit operator STOP           -> skipped, the manual close is
       respected (same contract as refresh — never against the operator);
     - status connecting/live but the socket is silently dead (null /
       CLOSING / CLOSED) -> one immediate bounded reconnect (reconnectNow,
       the same path refresh uses);
     - already live                     -> 'socket live — N events in window'
       with N the REAL rolling-window count, never fabricated;
     - otherwise (idle / error)         -> startStream() fresh, then an
       honest verdict: 'socket started…', or a skip naming the failure. */
G.HG_warmups = G.HG_warmups || [];
G.HG_warmups.push({ id: 'liqs', label: 'LIQS', run: async function(){
  try{
    if (typeof WebSocket !== 'function')
      return 'skipped: stream unavailable — no WebSocket in this environment';
    if (S.manualClose || S.status === 'stopped')
      return 'skipped: stream stopped by operator — press START in the LIQS tab to resume';
    var ws = S.ws, rs = -1;
    try{ rs = (ws && isFinite(+ws.readyState)) ? +ws.readyState : -1; }catch(eR){ rs = -1; }
    var running = (S.status === 'live' || S.status === 'connecting' || S.status === 'reconnecting');
    if (running && ((!ws) || rs === 2 || rs === 3)){
      reconnectNow(); /* single immediate attempt; ctor failure falls back to bounded backoff */
      return 'socket reconnecting — restarting the liquidation stream';
    }
    if (S.status === 'live'){
      var n = S.agg.snapshot().window.count;
      return 'socket live — ' + n + ' event' + (n === 1 ? '' : 's') + ' in window';
    }
    if (running) return 'socket ' + S.status + ' — accumulating liquidations';
    startStream(); /* idle or error with a WebSocket available: fresh session */
    if (S.status === 'error')
      return 'skipped: stream start failed in this environment';
    if (!S.ws)
      return 'skipped: stream start failed — socket constructor threw, bounded retry running';
    return 'socket started — accumulating liquidations';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
} });

})();
