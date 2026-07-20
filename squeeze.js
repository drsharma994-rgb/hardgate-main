/* =========================================================================
HARDGATE — squeeze.js
SQUEEZE tab: TTM-squeeze + Donchian-breakout scanner on the Binance perp
universe (4H signals, 1D trend filter).

Classic-script module, no build step. Loads AFTER indicators.js,
indicators2.js and binance.js; registers itself on window.HG_tabs — an
integrator creates the nav button + pane and calls mount(el) once, and the
global HARD REFRESH button awaits the registered refresh() (house contract:
async, never throws, returns 'refreshed' | 'skipped: not run yet' | 'busy',
busy-guarded, and never triggers a first-time full-universe scan on its own).

Strategy
  PRIMARY  — ttmSqueeze(4h):
             (a) fired within the last 3 bars (firedAgo 0..2) + momentum
                 sign => FIRED_LONG / FIRED_SHORT candidate, only full
                 marks when the 1D trend agrees (close vs ema20 AND ema20
                 vs ema50 side; disagreement marks the card AGAINST TREND
                 and ranks it lower) and the fire-bar participation
                 volZ(4h,20) >= 0.5 (noted if unmet, never a hard veto);
             (b) squeeze ON for >= 3 consecutive bars right now =>
                 BUILDING watchlist card (no direction).
  SECONDARY— Donchian(20) 4h breakout on the last bar:
             close[n-1] > donchian.up[n-2] (LONG) / < donchian.lo[n-2]
             (SHORT) with current-bar volZ >= 1 => breakout card.
  PLAN     — every directional card gets ENTRY/STOP/T1/T2 from the pure
             window.squeezePlan: window.smartSetup (index.html SMART $
             builder, fed the card's direction + 4h/1h rows) when present
             and returning sane levels, else the house fallback — entry =
             trigger/last close, stop = lastSwing(4h,30) structure buffered
             0.25xATR when it sits within 2.5xATR, else 1.5xATR against dir;
             T1 = 2R, T2 = 3.5R. Levels are never fabricated: unusable
             rows/ATR print an honest 'levels unavailable' note. Directional
             candidates also pull 1H klines x120 (catch-isolated; failure
             just means the 4H-only plan) so smartSetup can use its SCALP
             branch. BUILDING cards have no direction, so they show the
             direction-free levels instead (Donchian trigger band + ATR
             stop distance).

Network discipline: all data via binance.js globals (10s AbortController
timeout + 60s cache inside that layer, so this module adds no cache of its
own); per-symbol failures are counted and skipped; symbols are fetched in
chunks of 5 with a small sleep between chunks.

Pure classifier exposed as window.squeezeClassify(rows4h, rows1d) =>
  { state:'FIRED_LONG'|'FIRED_SHORT'|'BUILDING'|'NONE',
    firedAgo,        // bars since the most recent fire inside the 3-bar window; null if none
    momentum,        // ttm momentum at the fire bar (fired) / last bar (building) / NaN
    trendAgree,      // true | false | null (1d trend unknown or no direction)
    volZ,            // volume z at the fire bar (fired) / current bar (building,
                     // donchian-break results) / NaN otherwise
    donchianBreak }  // 'LONG' | 'SHORT' | null (price break + current-bar volZ >= 1)
Never throws; unknown/short/degenerate input => state 'NONE'.
========================================================================= */
(function(){
'use strict';

/* ---------------- thresholds / tuning ---------------- */
var FIRE_WINDOW   = 3;      // a fire counts if it happened within the last 3 bars (firedAgo 0..2)
var BUILD_MIN_ON  = 3;      // consecutive squeeze-on bars required for BUILDING
var VOL_CONFIRM_Z = 0.5;    // fire-bar participation confirm (soft, never a veto)
var VOLZ_LOOK     = 20;
var DC_LEN        = 20;     // donchian length
var DC_BREAK_Z    = 1;      // current-bar volume z required for a donchian breakout
var ATR_LEN       = 14;
var STOP_ATR      = 1.5, T1_R = 2, T2_R = 3.5;
var MIN_TURNOVER  = 30e6;   // $30M 24h quote-volume floor
var MAX_UNIVERSE  = 60;
var KL_4H_LIMIT   = 220, KL_1D_LIMIT = 120, KL_1H_LIMIT = 120;
var CHUNK         = 5, CHUNK_SLEEP_MS = 120;

/* ---------------- tiny local helpers (no DOM touched at load time) ---------------- */
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
/* px/fmt live in index.html inline code; resolve lazily, fall back locally. */
function pxF(n){
  if (typeof px === 'function') return px(n);
  if (n === null || n === undefined || isNaN(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function') return fmt(n, d);
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}

/* ---------------- pure classification ---------------- */
/* 1D trend side: close vs ema20 AND ema20 vs ema50.
   Returns 'UP' | 'DOWN' | 'MIXED' | null (unknown / insufficient data). */
function dailyTrend(rows1d){
  if (typeof ema !== 'function') return null;
  if (!Array.isArray(rows1d) || rows1d.length < 2) return null;
  var closes = new Array(rows1d.length);
  for (var i = 0; i < rows1d.length; i++){
    var r = rows1d[i];
    closes[i] = (r && isFinite(r.c)) ? r.c : NaN;
  }
  var e20 = ema(closes, 20), e50 = ema(closes, 50);
  var k = closes.length - 1, c = closes[k];
  if (!isFinite(c) || !isFinite(e20[k]) || !isFinite(e50[k])) return null;
  if (c > e20[k] && e20[k] > e50[k]) return 'UP';
  if (c < e20[k] && e20[k] < e50[k]) return 'DOWN';
  return 'MIXED';
}

function noneResult(dBreak){
  return { state:'NONE', firedAgo:null, momentum:NaN, trendAgree:null, volZ:NaN,
           donchianBreak: (dBreak === undefined ? null : dBreak) };
}

function squeezeClassify(rows4h, rows1d){
  if (typeof ttmSqueeze !== 'function' || typeof donchian !== 'function' ||
      typeof volZ !== 'function' || typeof ema !== 'function') return noneResult();
  if (!Array.isArray(rows4h) || rows4h.length < 2) return noneResult();
  var n = rows4h.length;
  var last = rows4h[n-1];
  if (!last || !isFinite(last.c)) return noneResult();

  var ttm = ttmSqueeze(rows4h);

  /* most recent fire inside the last FIRE_WINDOW bars (indices n-FIRE_WINDOW .. n-1) */
  var firedIdx = -1;
  for (var i = Math.max(0, n - FIRE_WINDOW); i < n; i++){ if (ttm.fired[i]) firedIdx = i; }
  var firedAgo = (firedIdx >= 0) ? (n - 1 - firedIdx) : null;

  /* donchian breakout on the last bar, gated by current-bar participation */
  var dBreak = null;
  var vzNow = volZ(rows4h, VOLZ_LOOK);
  var dc = donchian(rows4h, DC_LEN);
  if (isFinite(dc.up[n-2]) && isFinite(dc.lo[n-2]) && isFinite(vzNow) && vzNow >= DC_BREAK_Z){
    if (last.c > dc.up[n-2]) dBreak = 'LONG';
    else if (last.c < dc.lo[n-2]) dBreak = 'SHORT';
  }

  var trend = dailyTrend(rows1d);

  /* (a) fired within the window + momentum sign => directional candidate.
     Fire takes precedence over BUILDING when both are present. */
  if (firedIdx >= 0){
    var mom = ttm.momentum[firedIdx];
    var out = { state:'NONE', firedAgo:firedAgo, momentum:mom, trendAgree:null,
                volZ: volZ(rows4h.slice(0, firedIdx+1), VOLZ_LOOK), donchianBreak:dBreak };
    if (isFinite(mom) && mom > 0){
      out.state = 'FIRED_LONG';
      out.trendAgree = (trend === null) ? null : (trend === 'UP');
    } else if (isFinite(mom) && mom < 0){
      out.state = 'FIRED_SHORT';
      out.trendAgree = (trend === null) ? null : (trend === 'DOWN');
    }
    /* momentum exactly 0 / NaN: directionless fire -> state stays NONE,
       but firedAgo/momentum are still reported for observability. */
    return out;
  }

  /* (b) squeeze ON now for >= BUILD_MIN_ON consecutive bars => BUILDING */
  if (ttm.on[n-1]){
    var run = 0;
    for (var j = n - 1; j >= 0 && ttm.on[j]; j--) run++;
    if (run >= BUILD_MIN_ON){
      return { state:'BUILDING', firedAgo:null, momentum:ttm.momentum[n-1], trendAgree:null,
               volZ: vzNow, donchianBreak:dBreak };
    }
  }

  var none = noneResult(dBreak);
  if (dBreak) none.volZ = vzNow; /* breakout volume context */
  return none;
}

/* ---------------- universal trade plan (SL/TP levels) ---------------- */
/* window.squeezePlan({sym?, dir, cls?, rows4h, rows1h?, entry?}) -> plan|null.

   Levels: window.smartSetup (index.html SMART $ builder) is preferred
   whenever a direction and usable 4h rows exist — it speaks the
   smartClassify shape with lowercase 'long'/'short', so the card's
   classification is adapted; rows4h are the scan's own candles, rows1h is
   optional extra context (enables smartSetup's SCALP branch). House
   fallback otherwise: entry = caller trigger or last close, stop =
   lastSwing(4h,30) structure buffered 0.25xATR when it lands on the
   correct side within 2.5xATR, else 1.5xATR against dir; T1 = 2R,
   T2 = 3.5R.

   Pure: no DOM, no network, every global feature-checked, never throws —
   directionless/malformed input or uncomputable levels => null and the UI
   prints an honest 'levels unavailable' note instead of numbers. */
function fallbackStop(dir, entry, a, rows){
  var stop = NaN, note = '';
  var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, 30) : NaN;
  if (isFinite(sw)){
    var s = (dir === 'long') ? sw - 0.25 * a : sw + 0.25 * a;
    var r = (dir === 'long') ? entry - s : s - entry;
    if (r > 0 && r <= 2.5 * a){ stop = s; note = 'stop: lastSwing(4h,30) structure buffered 0.25×ATR' + ATR_LEN; }
    else if (r > 2.5 * a) note = 'stop capped: structure beyond 2.5×ATR — ' + STOP_ATR + '×ATR' + ATR_LEN + ' used';
  }
  if (!isFinite(stop)){
    stop = (dir === 'long') ? entry - STOP_ATR * a : entry + STOP_ATR * a;
    if (!note) note = 'stop: ' + STOP_ATR + '×ATR' + ATR_LEN + ' (lastSwing unavailable)';
  }
  return { stop: stop, note: note };
}

function validSetup(s){
  return !!(s && isFinite(s.entry) && s.entry > 0 && isFinite(s.stop)
            && isFinite(s.t1) && isFinite(s.t2) && Math.abs(s.entry - s.stop) > 0);
}

function squeezePlan(inp){
  try{
    inp = inp || {};
    var dir = (typeof inp.dir === 'string') ? inp.dir.toLowerCase() : null;
    if (dir !== 'long' && dir !== 'short') return null;
    var rows = inp.rows4h;
    if (!Array.isArray(rows) || !rows.length) return null;
    var lastBar = rows[rows.length - 1];
    if (!lastBar) return null;

    /* preferred: index.html SMART $ setup builder */
    if (typeof smartSetup === 'function'){
      try{
        var c = (inp.cls && typeof inp.cls === 'object') ? inp.cls : {};
        var s = smartSetup({ dir: dir, longEv: c.longEv, shortEv: c.shortEv,
                             regime: c.regime, score: c.score, total: c.total },
                           rows, inp.rows1h);
        if (validSetup(s)) return s;
      }catch(eSmart){ /* a broken smartSetup degrades to the house fallback */ }
    }

    /* house fallback: trigger/last close + lastSwing or 1.5×ATR, 2R / 3.5R */
    var entry = +((inp.entry !== undefined && inp.entry !== null) ? inp.entry : lastBar.c);
    var a = (typeof atr === 'function') ? atr(rows, ATR_LEN)[rows.length - 1] : NaN;
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    var st = fallbackStop(dir, entry, a, rows);
    var risk = Math.abs(entry - st.stop);
    if (!(risk > 0)) return null;
    return {
      type: 'ATR', dir: dir, entry: entry, stop: st.stop,
      t1: (dir === 'long') ? entry + T1_R * risk : entry - T1_R * risk,
      t2: (dir === 'long') ? entry + T2_R * risk : entry - T2_R * risk,
      rr1: T1_R, rr2: T2_R, riskPct: risk / entry * 100,
      confirmed: null, note: st.note
    };
  }catch(e){ return null; }
}

/* plan line, same markup as oiflow.js:
   ENTRY <b>..</b> · STOP <b>..</b> · T1 <b>..</b> (xR) · T2 <b>..</b> (xR) · risk ..% */
function squeezePlanHTML(s){
  if (!s) return '';
  var risk = (isFinite(s.entry) && isFinite(s.stop)) ? Math.abs(s.entry - s.stop) : NaN;
  var rr1 = isFinite(s.rr1) ? s.rr1 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t1 - s.entry) / risk : NaN);
  var rr2 = isFinite(s.rr2) ? s.rr2 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t2 - s.entry) / risk : NaN);
  return 'ENTRY <b>' + pxF(s.entry) + '</b> · STOP <b>' + pxF(s.stop) + '</b>'
    + ' · T1 <b>' + pxF(s.t1) + '</b> (' + fmtF(rr1, 1) + 'R)'
    + ' · T2 <b>' + pxF(s.t2) + '</b> (' + fmtF(rr2, 1) + 'R)'
    + (isFinite(s.riskPct) ? ' · risk ' + fmtF(s.riskPct, 2) + '%' : '')
    + (s.note ? ' — ' + esc(s.note) : '');
}

/* full block: <div class="plan"> line (+ optional extra note) plus the
   one-tap SEND TO TRADE PLAN handoff (toTrade feature-checked, escaped —
   same shape as oiflow.js). */
function squeezePlanBlock(inp, extra){
  var s = squeezePlan(inp);
  var inner = s
    ? squeezePlanHTML(s)
    : 'levels unavailable — need a direction, 4h history and a computable ATR' + ATR_LEN + '; nothing is estimated.';
  if (extra) inner += '. ' + extra + '.';
  var btn = (s && typeof toTrade === 'function' && inp && inp.sym)
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(inp.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  return '<div class="plan">' + inner + '</div>' + btn;
}

/* BUILDING cards carry no direction, so an ENTRY/STOP pair would be a
   fabrication — show the direction-free levels that pre-plan the fire bar
   instead: the Donchian trigger band and the ATR stop distance. */
function squeezeLevelsNote(rows4h){
  try{
    if (typeof donchian !== 'function' || !Array.isArray(rows4h) || rows4h.length < DC_LEN + 2) return '';
    var n = rows4h.length;
    var dc = donchian(rows4h, DC_LEN);
    var up = dc.up[n - 2], lo = dc.lo[n - 2];
    if (!isFinite(up) || !isFinite(lo)) return '';
    var txt = 'Levels — trigger LONG &gt; <b>' + pxF(up) + '</b> · trigger SHORT &lt; <b>' + pxF(lo) + '</b> (DC' + DC_LEN + ', prior bar)';
    var a = (typeof atr === 'function') ? atr(rows4h, ATR_LEN)[n - 1] : NaN;
    if (isFinite(a) && a > 0)
      txt += ' · ATR' + ATR_LEN + ' ' + pxF(a) + ' → on a fire: stop ≈ ' + pxF(STOP_ATR * a) + ' (' + STOP_ATR + '×ATR) against the direction, T1 2R · T2 3.5R';
    return '<div class="plan">' + txt + '</div>';
  }catch(e){ return ''; }
}

/* ---------------- scanner (UI) ---------------- */
/* sort: fired+trend-agree+vol-confirm first, then other fired, then building,
   then donchian breakouts (secondary strategy ranks last). */
function rankOf(r){
  if (r.kind === 'fired'){
    var volOk = isFinite(r.cls.volZ) && r.cls.volZ >= VOL_CONFIRM_Z;
    return (r.cls.trendAgree === true && volOk) ? 0 : 1;
  }
  if (r.kind === 'build') return 2;
  return 3;
}

function cardHTML(r){
  var cls = r.cls, tick = r.tick;
  var turnover = tick ? '$' + fmtF(tick.turnoverUsd / 1e6, 0) + 'M' : '—';
  var lastC = r.rows4h[r.rows4h.length - 1].c;

  if (r.kind === 'build'){
    return '<div class="card">'
      + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span><span class="dir">BUILDING · WATCH</span></div>'
      + '<div class="mini">'
      + '<span class="k">last</span><span>' + pxF(lastC) + '</span>'
      + '<span class="k">squeeze on-bars</span><span>' + r.onRun + '</span>'
      + '<span class="k">momentum (now)</span><span>' + (isFinite(cls.momentum) ? fmtF(cls.momentum, 1) : '—') + '</span>'
      + '<span class="k">vol z (now)</span><span>' + (isFinite(cls.volZ) ? fmtF(cls.volZ, 2) : '—') + '</span>'
      + '<span class="k">turnover 24h</span><span>' + turnover + '</span>'
      + '</div>'
      + '<div class="gates"><span class="gpip ok">BB INSIDE KC ×' + r.onRun + '</span>'
      + (cls.donchianBreak ? '<span class="gpip ok">DC' + DC_LEN + ' BREAK ' + cls.donchianBreak + '</span>' : '')
      + '</div>'
      + '<div class="plan">Squeeze building — Bollinger inside Keltner for ' + r.onRun
      + ' consecutive 4H bars. No direction yet; wait for the fire bar + momentum sign.</div>'
      + squeezeLevelsNote(r.rows4h)
      + '</div>';
  }

  var dirUp = r.dir.toUpperCase();

  if (r.kind === 'fired'){
    var volOk = isFinite(cls.volZ) && cls.volZ >= VOL_CONFIRM_Z;
    var chips = '<span class="gpip ok">FIRED ' + cls.firedAgo + 'B AGO</span>'
      + '<span class="gpip ok">MOM ' + (cls.momentum > 0 ? '+' : '-') + '</span>';
    var notes = [];
    if (cls.trendAgree === true) chips += '<span class="gpip ok">1D TREND AGREE</span>';
    else if (cls.trendAgree === false){ chips += '<span class="gpip">AGAINST TREND</span>'; notes.push('1D trend disagrees — size down or skip'); }
    else chips += '<span class="gpip">1D TREND N/A</span>';
    if (volOk) chips += '<span class="gpip ok">VOL CONFIRM z=' + fmtF(cls.volZ, 2) + '</span>';
    else { chips += '<span class="gpip">VOL WEAK z=' + (isFinite(cls.volZ) ? fmtF(cls.volZ, 2) : 'n/a') + '</span>'; notes.push('participation below z=' + VOL_CONFIRM_Z + ' on the fire bar'); }
    if (cls.donchianBreak) chips += '<span class="gpip ok">DC' + DC_LEN + ' BREAK ' + cls.donchianBreak + '</span>';
    var trendTxt = cls.trendAgree === true ? 'agree' : (cls.trendAgree === false ? 'AGAINST' : 'n/a');
    return '<div class="card ' + r.dir + '">'
      + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span><span class="dir">' + dirUp + ' · SQZ FIRED'
      + (cls.trendAgree === false ? ' · AGAINST TREND' : '') + '</span></div>'
      + '<div class="mini">'
      + '<span class="k">last</span><span>' + pxF(lastC) + '</span>'
      + '<span class="k">fired</span><span>' + cls.firedAgo + ' bar' + (cls.firedAgo === 1 ? '' : 's') + ' ago</span>'
      + '<span class="k">momentum @fire</span><span class="' + (cls.momentum > 0 ? 'pos' : 'neg') + '">' + fmtF(cls.momentum, 1) + '</span>'
      + '<span class="k">vol z @fire</span><span>' + (isFinite(cls.volZ) ? fmtF(cls.volZ, 2) : '—') + '</span>'
      + '<span class="k">1d trend</span><span>' + trendTxt + '</span>'
      + '<span class="k">turnover 24h</span><span>' + turnover + '</span>'
      + '</div>'
      + '<div class="gates">' + chips + '</div>'
      + squeezePlanBlock({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h }, notes.join('; '))
      + '</div>';
  }

  /* kind === 'break' */
  var dUp = cls.donchianBreak === 'LONG';
  return '<div class="card ' + r.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span><span class="dir">' + dirUp + ' · DC' + DC_LEN + ' BREAKOUT</span></div>'
    + '<div class="mini">'
    + '<span class="k">last</span><span>' + pxF(lastC) + '</span>'
    + '<span class="k">broke</span><span>' + (dUp ? 'above' : 'below') + ' ' + pxF(r.dcLevel) + '</span>'
    + '<span class="k">vol z (now)</span><span>' + (isFinite(cls.volZ) ? fmtF(cls.volZ, 2) : '—') + '</span>'
    + '<span class="k">turnover 24h</span><span>' + turnover + '</span>'
    + '</div>'
    + '<div class="gates"><span class="gpip ok">CLOSE ' + (dUp ? '&gt;' : '&lt;') + ' DC' + DC_LEN + ' ' + (dUp ? 'UP' : 'LO') + '</span>'
    + '<span class="gpip ok">VOL z≥' + DC_BREAK_Z + '</span>'
    + (cls.state === 'BUILDING' ? '<span class="gpip">SQZ BUILDING</span>' : '')
    + '</div>'
    + squeezePlanBlock({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h }, 'Donchian breakout — momentum continuation')
    + '</div>';
}

/* ---------------- hard-refresh contract state ----------------
   The registration carries refresh() alongside mount() for the global HARD
   REFRESH button. runScan lives inside mount (it closes over the pane nodes),
   so mount publishes it here. refresh() never throws, returns a short status
   string, busy-guards overlapping invocations, and never fires a first-time
   full-universe scan on its own — a global refresh must stay cheap for tabs
   the user has never run (skip instead). */
var __scan = { run: null, busy: false, hasRun: false };

async function squeezeRefresh(){
  try{
    if (__scan.busy) return 'busy';
    if (!__scan.hasRun || typeof __scan.run !== 'function') return 'skipped: not run yet';
    await __scan.run();
    return 'refreshed';
  }catch(e){ return 'error'; }
}

function mount(el){
  if (!el) return;
  var missing = [];
  if (typeof binancePerpUniverse !== 'function') missing.push('binancePerpUniverse');
  if (typeof binanceTickers24h !== 'function') missing.push('binanceTickers24h');
  if (typeof binanceKlines !== 'function') missing.push('binanceKlines');
  if (typeof ttmSqueeze !== 'function') missing.push('ttmSqueeze');
  if (typeof donchian !== 'function') missing.push('donchian');
  if (typeof volZ !== 'function') missing.push('volZ');
  if (typeof ema !== 'function') missing.push('ema');
  if (typeof atr !== 'function') missing.push('atr');

  el.innerHTML = '<div class="panel">'
    + '<h2>Squeeze Scanner <span>TTM squeeze 4H · fired + building · Donchian ' + DC_LEN + ' breakout · 1D trend filter</span></h2>'
    + '<div class="row"><button class="btn" id="sqRun">FIND SQUEEZES</button>'
    + '<span class="note" id="sqStat">idle — Binance perps ≥ $' + fmtF(MIN_TURNOVER / 1e6, 0) + 'M turnover, top ' + MAX_UNIVERSE + '</span></div>'
    + '<div class="prog" id="sqProg"><i></i></div>'
    + '<div class="cards" id="sqCards"></div>'
    + '<div class="empty" id="sqEmpty" style="display:none">No squeezes fired, building, or Donchian breakouts right now.</div>'
    + '</div>';

  var btn = el.querySelector('#sqRun'), statEl = el.querySelector('#sqStat'),
      progEl = el.querySelector('#sqProg'), cardsEl = el.querySelector('#sqCards'),
      emptyEl = el.querySelector('#sqEmpty');
  if (!btn || !statEl || !progEl || !cardsEl || !emptyEl) return;

  function setStat(t, warn){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; }
  function setProg(f){
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  if (missing.length){
    setStat('missing data/indicator layer: ' + missing.join(', ') + ' — check script load order', true);
    btn.disabled = true;
    return;
  }

  btn.addEventListener('click', function(){ runScan(); });
  __scan.run = runScan;   /* publish for the hard-refresh contract */

  async function runScan(){
    if (__scan.busy) return;              /* busy guard — never double-fetch */
    __scan.busy = true;
    var t0 = Date.now();
    try{
      btn.disabled = true;
      cardsEl.innerHTML = '';
      emptyEl.style.display = 'none';
      setProg(0);
      setStat('loading Binance perp universe…');
      var res = await Promise.all([binancePerpUniverse(), binanceTickers24h()]);
      var perps = res[0] || [], ticks = res[1];
      if (!perps.length || !ticks){ setStat('Binance universe unavailable (network issue?)', true); return; }
      var uni = perps.filter(function(s){ return ticks[s] && ticks[s].turnoverUsd >= MIN_TURNOVER; })
                     .sort(function(a,b){ return ticks[b].turnoverUsd - ticks[a].turnoverUsd; })
                     .slice(0, MAX_UNIVERSE);
      if (!uni.length){ setStat('no perps above $' + fmtF(MIN_TURNOVER / 1e6, 0) + 'M 24h turnover', true); return; }

      var results = [], failed = 0, started = 0;
      for (var ci = 0; ci < uni.length; ci += CHUNK){
        var chunk = uni.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(sym){
          var my = ++started;
          try{
            setStat('scanning ' + my + '/' + uni.length + ' · ' + sym);
            /* kline legs individually catch-isolated: a 4h outage skips the
               symbol; a 1d outage just means trend unknown — neither kills
               the scan or rejects the chunk. */
            var rows4h = null, rows1d = [];
            try{ rows4h = await binanceKlines(sym, '4h', KL_4H_LIMIT); }catch(e4){ rows4h = null; }
            if (!rows4h || !rows4h.length){ failed++; return; }
            try{ rows1d = await binanceKlines(sym, '1d', KL_1D_LIMIT); }catch(e1d){ rows1d = []; }
            rows1d = rows1d || []; /* empty 1d is tolerated: trend simply unknown */
            var cls = squeezeClassify(rows4h, rows1d);
            var r = null;
            if (cls.state === 'FIRED_LONG' || cls.state === 'FIRED_SHORT'){
              r = { sym: sym, kind: 'fired', dir: cls.state === 'FIRED_LONG' ? 'long' : 'short',
                    cls: cls, rows4h: rows4h, tick: ticks[sym] };
            } else if (cls.donchianBreak){
              var dcn = donchian(rows4h, DC_LEN);
              r = { sym: sym, kind: 'break', dir: cls.donchianBreak === 'LONG' ? 'long' : 'short',
                    cls: cls, rows4h: rows4h, tick: ticks[sym],
                    dcLevel: cls.donchianBreak === 'LONG' ? dcn.up[rows4h.length - 2] : dcn.lo[rows4h.length - 2] };
            } else if (cls.state === 'BUILDING'){
              var tt = ttmSqueeze(rows4h), run = 0;
              for (var k = rows4h.length - 1; k >= 0 && tt.on[k]; k--) run++;
              r = { sym: sym, kind: 'build', dir: null, cls: cls, rows4h: rows4h, tick: ticks[sym], onRun: run };
            }
            if (r && r.kind !== 'build'){
              /* 1H context for the SMART $ setup builder (SCALP branch) —
                 catch-isolated: failure just means the 4H-only plan. */
              try{
                var r1h = await binanceKlines(sym, '1h', KL_1H_LIMIT);
                r.rows1h = (r1h && r1h.length) ? r1h : null;
              }catch(e1){ r.rows1h = null; }
            }
            if (r) results.push(r);
          }catch(e){ failed++; }
        }));
        setProg(Math.min(1, (ci + chunk.length) / uni.length));
        if (ci + CHUNK < uni.length) await sleep(CHUNK_SLEEP_MS);
      }

      results.sort(function(a,b){
        var ra = rankOf(a), rb = rankOf(b);
        if (ra !== rb) return ra - rb;
        var ta = a.tick ? a.tick.turnoverUsd : 0, tb = b.tick ? b.tick.turnoverUsd : 0;
        return tb - ta;
      });

      var nFired = 0, nBuild = 0, nBreak = 0;
      results.forEach(function(r){
        if (r.kind === 'fired') nFired++;
        else if (r.kind === 'build') nBuild++;
        else nBreak++;
      });

      if (!results.length) emptyEl.style.display = 'block';
      else cardsEl.innerHTML = results.map(cardHTML).join('');

      var secs = ((Date.now() - t0) / 1000).toFixed(1);
      setStat('universe ' + uni.length + ' · fired ' + nFired + ' · building ' + nBuild
              + ' · breakouts ' + nBreak + ' · failed ' + failed + ' · ' + secs + 's');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
    }finally{
      __scan.busy = false;
      __scan.hasRun = true;
      try{ btn.disabled = false; }catch(e2){}
      setProg(null);
    }
  }
}

/* ---------------- registration ---------------- */
var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};
W.squeezeClassify = squeezeClassify;
W.squeezePlan = squeezePlan;
W.squeezePlanHTML = squeezePlanHTML;
W.squeezePlanBlock = squeezePlanBlock;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'squeeze', label: 'SQUEEZE', mount: mount, refresh: squeezeRefresh });
})();
