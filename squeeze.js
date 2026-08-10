/* =========================================================================
HARDGATE — squeeze.js
SQUEEZE tab: TTM-squeeze + Donchian-breakout scanner on the full combined
universe (Delta + CoinDCX + Binance via xuniverse.js, ≥ $5M turnover, no cap).

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

BRAIN STATE CONTRACT — after each SUCCESSFUL scan the result list is cached
in a module-local snapshot, exposed as window.squeezeState() for the BRAIN
meta-engine AND published to window.HG_squeezeResults (the key engine.js's
Stage-0 universe contract already feature-checks — its {syms, at} form is
filled alongside `results` so the master gate engine can consume the scan
without a parse change):
  window.squeezeState()     -> { results: [ { sym, dir: 'long'|'short'|null
                                 (null on BUILDING watch cards), kind:
                                 'fired'|'break'|'build' } ],
                                 at: <epochMs> } | null
  window.HG_squeezeResults = { results: <same rows>, syms: [sym, ...], at }
The getter is zero-arg, NEVER throws (try-catch -> null), returns null before
the first successful scan, and otherwise hands out a DEEP-FROZEN deep copy.
An aborted/failed re-run keeps the PREVIOUS good snapshot with its original
`at` — good data is never replaced by a failed run.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

/* ---------------- thresholds / tuning ---------------- */
var FIRE_WINDOW   = 3;      // a fire counts if it happened within the last 3 bars (firedAgo 0..2)
var BUILD_MIN_ON  = 3;      // consecutive squeeze-on bars required for BUILDING
var VOL_CONFIRM_Z = 0.5;    // fire-bar participation confirm (soft, never a veto)
var VOLZ_LOOK     = 20;
var DC_LEN        = 20;     // donchian length
var DC_BREAK_Z    = 1;      // current-bar volume z required for a donchian breakout
var ATR_LEN       = 14;
var STOP_ATR      = 1.5, T1_R = 2, T2_R = 3.5;
var MIN_TURNOVER  = (typeof W.hgDeskMinTurnover === 'function') ? W.hgDeskMinTurnover() : 5e6;
var KL_4H_LIMIT   = 220, KL_1D_LIMIT = 120, KL_1H_LIMIT = 120;
var CHUNK         = 5, CHUNK_SLEEP_MS = 120;

function sqVenueChip(item){
  return (typeof W.hgDeskVenueChipHTML === 'function') ? W.hgDeskVenueChipHTML(item) : '';
}
function sqRowVenue(r){
  return r && r.exchange ? String(r.exchange).toLowerCase() : 'binance';
}

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
      var swBias = (typeof hgConfirmedCascade === 'function') ? hgConfirmedCascade(rows4h, 'swing') : null;
      if (swBias && swBias.dir === 'short'){ out.state = 'NONE'; return out; }
      out.state = 'FIRED_LONG';
      out.trendAgree = (trend === null) ? null : (trend === 'UP');
    } else if (isFinite(mom) && mom < 0){
      var swBiasS = (typeof hgConfirmedCascade === 'function') ? hgConfirmedCascade(rows4h, 'swing') : null;
      if (swBiasS && swBiasS.dir === 'long'){ out.state = 'NONE'; return out; }
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
  if (typeof hgStructureStop === 'function'){
    var st = hgStructureStop(dir, entry, rows, { atrLen: ATR_LEN, look: 30 });
    if (st) return { stop: st.stop, note: st.note };
  }
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

function sqMinRr(){
  try{
    if (typeof W !== 'undefined' && typeof W.CG_SWING_RR_MIN === 'number') return W.CG_SWING_RR_MIN;
  }catch(e){}
  return 2.0;
}

function sqValidSetup(s){
  if (!validSetup(s)) return false;
  var rr = isFinite(s.rr1) ? s.rr1 : Math.abs(s.t1 - s.entry) / Math.abs(s.entry - s.stop);
  return isFinite(rr) && rr >= sqMinRr() - 1e-9;
}

function squeezeTicker(inp){
  inp = inp || {};
  var mark = (inp.rows4h && inp.rows4h.length) ? inp.rows4h[inp.rows4h.length - 1].c : null;
  return { symbol: inp.sym, fundingPct: (inp.tick && inp.tick.fundingPct), mark: mark };
}

function squeezeGateEval(inp, dir){
  try{
    if (!dir || !inp || !inp.rows4h || !inp.rows4h.length) return null;
    var ticker = squeezeTicker(inp);
    var out = {
      gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false,
      hit: null, label: 'squeeze only', veto: null
    };
    if (typeof swingTryClean === 'function'){
      var clean = swingTryClean(inp.rows4h, ticker);
      if (clean && clean.dir === dir){
        out.hit = clean;
        out.clean7 = clean.clean === true || (+clean.passed >= 7);
        out.gatesPassed = clean.passed != null ? +clean.passed : 7;
        out.label = out.clean7 ? '7/7 CLEAN' : (out.gatesPassed + '/7');
        out.nearClean = !out.clean7 && out.gatesPassed >= 6;
        return out;
      }
    }
    if (typeof swingTryNear === 'function'){
      var near = swingTryNear(inp.rows4h, ticker);
      if (near && near.dir === dir){
        out.hit = near;
        out.nearClean = true;
        out.gatesPassed = near.passed != null ? +near.passed : 6;
        out.label = out.gatesPassed + '/7 NEAR';
        return out;
      }
    }
    if (typeof hgSwingParity === 'function'){
      var par = hgSwingParity(inp.rows4h, ticker, dir);
      if (par && par.aligned){
        out.gatesPassed = par.passed || 0;
        out.clean7 = par.clean === true;
        out.nearClean = !par.clean && par.passed >= 6;
        out.label = par.label || (par.passed + '/7');
      }
    }
    return out;
  }catch(e){ return null; }
}

function sqAttachMeta(plan, gate, extra){
  if (!plan) return plan;
  if (gate){
    plan.gatesPassed = gate.gatesPassed;
    plan.clean7 = gate.clean7;
    plan.nearClean = gate.nearClean;
    plan.gateLabel = gate.label;
  }
  if (extra && extra.formationScore != null) plan.formationScore = extra.formationScore;
  if (!plan.planSrc) plan.planSrc = 'squeeze';
  return plan;
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
    var gate = inp.gate || squeezeGateEval(inp, dir);
    var ticker = squeezeTicker(inp);

    if (gate && gate.hit && !gate.veto && typeof hgFormTicket === 'function'){
      try{
        var fm = hgFormTicket(gate.hit, {
          rows: rows, style: 'swing', a4: gate.hit.a4,
          rows1h: inp.rows1h, ticker: ticker
        });
        if (fm && fm.ok && fm.hit && sqValidSetup(fm.hit)){
          return sqAttachMeta(_squeezeAttachStack(fm.hit, inp), gate, { formationScore: fm.formationScore });
        }
      }catch(eForm){}
    }

    if (typeof hgSwingCleanPlan === 'function'){
      try{
        var sc = hgSwingCleanPlan(rows, ticker, dir);
        if (sqValidSetup(sc)) return sqAttachMeta(_squeezeAttachStack(sc, inp), gate);
      }catch(eSc){}
    }

    if (typeof hgPlanLevelsCore === 'function'){
      try{
        var pl = hgPlanLevelsCore(dir, rows, null, { minRr: sqMinRr(), style: 'swing', type: 'SQUEEZE' });
        if (sqValidSetup(pl)) return sqAttachMeta(_squeezeAttachStack(pl, inp), gate);
      }catch(ePl){}
    }

    /* preferred: index.html SMART $ setup builder */
    if (typeof smartSetup === 'function'){
      try{
        var c = (inp.cls && typeof inp.cls === 'object') ? inp.cls : {};
        var s = smartSetup({ dir: dir, longEv: c.longEv, shortEv: c.shortEv,
                             regime: c.regime, score: c.score, total: c.total },
                           rows, inp.rows1h);
        if (sqValidSetup(s)){
          if (typeof hgApplyExactEntry === 'function'){
            s = hgApplyExactEntry(s, rows, { rows1h: inp.rows1h, style: s.type || 'swing', preferEdge: true }) || s;
          }
          return sqAttachMeta(_squeezeAttachStack(s, inp), gate);
        }
      }catch(eSmart){ /* a broken smartSetup degrades to the house fallback */ }
    }

    /* house fallback: trigger/last close + lastSwing or 1.5×ATR, 2R / 3.5R */
    var entry = +((inp.entry !== undefined && inp.entry !== null) ? inp.entry : lastBar.c);
    var a = (typeof atr === 'function') ? atr(rows, ATR_LEN)[rows.length - 1] : NaN;
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    var st = fallbackStop(dir, entry, a, rows);
    var risk = Math.abs(entry - st.stop);
    if (!(risk > 0)) return null;
    var fb = {
      type: 'ATR', dir: dir, entry: entry, stop: st.stop,
      t1: (dir === 'long') ? entry + T1_R * risk : entry - T1_R * risk,
      t2: (dir === 'long') ? entry + T2_R * risk : entry - T2_R * risk,
      rr1: T1_R, rr2: T2_R, riskPct: risk / entry * 100,
      confirmed: null, note: st.note
    };
    if (!sqValidSetup(fb)) return null;
    return sqAttachMeta(_squeezeAttachStack(fb, inp), gate);
  }catch(e){ return null; }
}

function _squeezeAttachStack(s, inp){
  try{
    if (!s || s.stack || typeof hgSetupStackAttachPlan !== 'function') return s;
    var rows = inp.rows4h;
    var cls = inp.cls || {};
    var trendAgree = cls.trendAgree;
    var positioning = null;
    if (trendAgree === false){
      positioning = { items: [{ label: '1D trend', detail: 'against squeeze direction', align: 'caution' }] };
    } else if (trendAgree === true){
      positioning = { items: [{ label: '1D trend', detail: 'agrees with squeeze', align: 'with' }] };
    }
    hgSetupStackAttachPlan(s, {
      sym: inp.sym, style: 'squeeze', rows4h: rows, rows1h: inp.rows1h,
      clean: inp.kind === 'fired' && cls.trendAgree !== false,
      nearClean: inp.kind === 'break' || cls.trendAgree === false,
      gatesPassed: (inp.kind === 'fired' && cls.trendAgree !== false) ? 7 : 6,
      gatesTotal: 7, positioning: positioning
    });
  }catch(e){}
  return s;
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
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(s.entry, s.stop) : '')
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
  var tradeOnclick = (s && inp && inp.sym && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(inp.sym, s.dir, s.entry, s.stop, s.t1, { t2: s.t2, stack: s.stack, scanner: 'squeeze', strategy: 'squeeze' })
      : ('toTrade(' + JSON.stringify(inp.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var btn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (s && typeof bookBtnHTML === 'function' && inp && inp.sym)
    ? bookBtnHTML(inp.sym, s.dir, s.entry, s.stop, s.t1, { scanner: 'squeeze', strategy: 'squeeze', t2: s.t2, stack: s.stack }) : '';
  var stackHtml = (s && s.stack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(s.stack) : '';
  return '<div class="plan">' + inner + '</div>' + stackHtml + btn + bookBtn;
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
/* ---------------- desk helpers (advanced tab UI) ---------------- */
function sqVolOk(cls){
  return cls && isFinite(cls.volZ) && cls.volZ >= VOL_CONFIRM_Z;
}

function sqPrimeFired(r){
  return r && r.kind === 'fired' && r.cls && r.cls.trendAgree === true && sqVolOk(r.cls);
}

function sqRowTier(r){
  if (!r) return 'forming';
  if (r.kind === 'build') return 'forming';
  if (!r.dir) return 'forming';
  var plan = squeezePlan({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind, gate: r.gate, tick: r.tick });
  if (r.gate && r.gate.veto) return 'forming';
  if (plan && sqValidSetup(plan) && r.gate && r.gate.clean7) return 'clean';
  if (r.kind === 'fired' && r.cls && r.cls.trendAgree === false) return 'near';
  if (r.kind === 'fired' && !sqVolOk(r.cls)) return 'near';
  if (r.gate && r.gate.nearClean) return 'near';
  if (r.kind === 'break') return (plan && sqValidSetup(plan) && r.gate && r.gate.clean7) ? 'clean' : 'near';
  return 'forming';
}

function sqSummaryLine(results){
  results = results || [];
  var fired = 0, brk = 0, build = 0, clean = 0, near = 0, prime = 0;
  for (var i = 0; i < results.length; i++){
    var r = results[i];
    if (!r) continue;
    if (r.kind === 'fired') fired++;
    else if (r.kind === 'break') brk++;
    else if (r.kind === 'build') build++;
    if (sqPrimeFired(r)) prime++;
    var tier = sqRowTier(r);
    if (tier === 'clean') clean++;
    else if (tier === 'near') near++;
  }
  return 'scanned ' + results.length + ' · fired ' + fired + ' · breakouts ' + brk
    + ' · building ' + build + ' · prime fired ' + prime + ' · CLEAN ' + clean + ' · NEAR ' + near;
}

function sqSignalPipsHtml(r){
  if (!r || !r.cls) return '';
  var cls = r.cls;
  var chips = '';
  if (r.kind === 'fired') chips += '<span class="gpip ok" title="TTM fired">FIR</span>';
  else if (r.kind === 'break') chips += '<span class="gpip ok" title="Donchian break">DC</span>';
  else if (r.kind === 'build') chips += '<span class="gpip" title="Squeeze building">BLD</span>';
  if (cls.trendAgree === true) chips += '<span class="gpip ok" title="1D trend agree">1D</span>';
  else if (cls.trendAgree === false) chips += '<span class="gpip bad" title="Against 1D trend">1D</span>';
  if (sqVolOk(cls)) chips += '<span class="gpip ok" title="Volume confirm">VOL</span>';
  else if (isFinite(cls.volZ)) chips += '<span class="gpip" title="Weak volume">VOL</span>';
  if (cls.donchianBreak) chips += '<span class="gpip ok" title="Donchian break">DC</span>';
  return chips;
}

function sqFiredDeskHTML(items){
  items = (items || []).slice(0, 4);
  if (!items.length) return '';
  var cards = '';
  for (var i = 0; i < items.length; i++){
    var r = items[i], plan = squeezePlan({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind, gate: r.gate, tick: r.tick });
    if (!plan) continue;
    var col = r.dir === 'long' ? '#047857' : '#dc2626';
    var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, r.dir, plan.entry, plan.stop, plan.t1, { t2: plan.t2, stack: plan.stack, scanner: 'squeeze', strategy: 'squeeze-fired' }) : '';
    cards += '<div style="flex:1 1 280px;max-width:380px;border:1px solid rgba(5,150,105,.45);border-left:4px solid ' + col + ';border-radius:8px;padding:12px;background:rgba(5,150,105,.06)">'
      + '<div><b>' + esc(r.sym) + '</b> · ' + r.dir.toUpperCase() + ' · <span class="stamp pass">SQZ FIRED</span></div>'
      + '<div style="font-size:22px;font-weight:800;color:' + col + ';margin:6px 0">' + pxF(plan.entry) + '</div>'
      + '<div class="plan">' + squeezePlanHTML(plan) + '</div>'
      + (tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '')
      + '</div>';
  }
  if (!cards) return '';
  return '<div class="panel tier-clean" style="margin:12px 0"><h2>🔥 FIRED DESK <span>TTM squeeze fire + 1D trend agree + volume confirm · prime entries</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div></div>';
}

function sqLimitBoardHTML(results){
  var cands = [];
  for (var i = 0; i < results.length; i++){
    var r = results[i];
    if (!r || !r.dir || r.kind === 'build') continue;
    if (r.gate && r.gate.veto) continue;
    var plan = squeezePlan({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind, gate: r.gate, tick: r.tick });
    if (!sqValidSetup(plan)) continue;
    if (!(sqPrimeFired(r) || (r.gate && r.gate.clean7))) continue;
    cands.push({ row: r, plan: plan, dir: r.dir, rank: (r.gate && r.gate.clean7 ? 1000 : 0) + (sqPrimeFired(r) ? 500 : 0) + (r.tick ? r.tick.turnoverUsd / 1e8 : 0) });
  }
  cands.sort(function(a, b){ return b.rank - a.rank; });
  cands = cands.slice(0, 8);
  if (!cands.length) return '';
  var cards = cands.map(function(item){
    var p = item.plan, r = item.row, dir = item.dir;
    var col = dir === 'long' ? '#047857' : '#dc2626';
    var stHtml = '';
    if (typeof hgLimitState === 'function'){
      var a = (r.rows4h && typeof atr === 'function') ? atr(r.rows4h, ATR_LEN) : null;
      var atrL = (a && a.length) ? a[a.length - 1] : NaN;
      var st = hgLimitState(p, r.rows4h[r.rows4h.length - 1].c, atrL);
      if (st && st.label) stHtml = '<span class="stamp" style="margin-left:6px">' + esc(st.label) + '</span>';
    }
    var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, dir, p.entry, p.stop, p.t1, { t2: p.t2, stack: p.stack, scanner: 'squeeze', strategy: 'squeeze' }) : '';
    return '<div style="flex:1 1 260px;max-width:360px;border:1px solid #E2E8F0;border-left:3px solid ' + col + ';border-radius:8px;padding:10px 12px;background:#fff">'
      + '<div><b>' + esc(r.sym) + '</b>' + sqVenueChip(r) + ' · ' + dir.toUpperCase() + stHtml + '</div>'
      + '<div style="font-size:18px;font-weight:800;color:' + col + ';margin:4px 0">' + pxF(p.entry) + '</div>'
      + '<div class="note">' + squeezePlanHTML(p) + '</div>'
      + (tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '')
      + '</div>';
  }).join('');
  return '<div class="panel" style="margin:12px 0"><h2>LIMIT BOARD <span>CLEAN + prime fired rows · exact resting limits</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div></div>';
}

function sqSetupCardHTML(r, tier){
  if (tier === 'forming' || r.kind === 'build') return cardHTML(r);
  var dir = r.dir;
  if (!dir) return cardHTML(r);
  var plan = squeezePlan({ sym: r.sym, dir: dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind, gate: r.gate, tick: r.tick });
  if (typeof hgSetupCardHTML === 'function' && tier === 'clean' && plan){
    var mini = [
      ['KIND', r.kind === 'fired' ? 'SQZ FIRED' : 'DC BREAK'],
      ['ENTRY', pxF(plan.entry)], ['R:R', fmtF(plan.rr1, 1) + 'R']
    ];
    var gates = r.gate ? [[r.gate.label, r.gate.clean7 && !r.gate.veto]] : [];
    return hgSetupCardHTML({
      sym: r.sym, dir: dir, tier: tier, mini: mini, gates: gates,
      plan: squeezePlanHTML(plan), entry: plan.entry, stop: plan.stop, t1: plan.t1,
      chartId: 'sq_' + String(r.sym).replace(/[^A-Za-z0-9]/g, ''),
      stack: plan.stack,
      bookMeta: { scanner: 'squeeze', strategy: 'squeeze', t2: plan.t2,
        venue: (typeof W.hgDeskVenueLabel === 'function') ? W.hgDeskVenueLabel(r.exchange) : 'BINANCE' },
      note: tier === 'near' ? 'NEAR — against trend, weak vol, or 6/7 gates — watch only.' : null
    });
  }
  return cardHTML(r);
}

function sqPaintMiniCharts(el, rows){
  try{
    if (!el || typeof hgMiniChart !== 'function') return;
    var nodes = el.querySelectorAll('.hgchart');
    for (var i = 0; i < nodes.length; i++){
      var node = nodes[i], id = node.id || '', symGuess = id.replace(/^sq_/, ''), row = null;
      for (var j = 0; j < rows.length; j++){
        if (rows[j] && String(rows[j].sym).replace(/[^A-Za-z0-9]/g, '') === symGuess){ row = rows[j]; break; }
      }
      if (!row || !row.rows4h) continue;
      var plan = squeezePlan({ sym: row.sym, dir: row.dir, cls: row.cls, rows4h: row.rows4h, rows1h: row.rows1h, kind: row.kind, gate: row.gate, tick: row.tick });
      hgMiniChart(node, row.rows4h, { dir: row.dir, entry: plan ? plan.entry : null, stop: plan ? plan.stop : null, t1: plan ? plan.t1 : null, t2: plan ? plan.t2 : null });
    }
  }catch(e){}
}

function sqPaintDeskSections(refs, results, filterFn){
  results = results || [];
  if (refs.summary) refs.summary.textContent = results.length ? sqSummaryLine(results) : 'Idle — run a scan to build the desk.';
  var prime = results.filter(sqPrimeFired).sort(function(a, b){ return rankOf(a) - rankOf(b); });
  if (refs.firedDesk) refs.firedDesk.innerHTML = sqFiredDeskHTML(prime);
  var clean = [], near = [], forming = [];
  for (var i = 0; i < results.length; i++){
    var r = results[i], tier = sqRowTier(r);
    if (tier === 'clean') clean.push(r);
    else if (tier === 'near') near.push(r);
    else forming.push(r);
  }
  clean.sort(function(a, b){ return rankOf(a) - rankOf(b); });
  near.sort(function(a, b){ return rankOf(a) - rankOf(b); });
  if (refs.cards){
    var shown = clean.filter(filterFn || function(){ return true; });
    if (!shown.length){
      refs.cards.innerHTML = (typeof hgSetupEmptyHTML === 'function')
        ? hgSetupEmptyHTML({ title: 'No CLEAN squeeze tickets right now.', body: 'Prime fired desk + limit board surface the best rows. NEAR and BUILDING sections are watch-only.' })
        : '<div class="empty">No CLEAN tickets.</div>';
    } else {
      refs.cards.innerHTML = '<div class="note" style="margin:0 0 10px"><b>CLEAN TICKETS</b> — 7/7 gates + valid plan + min R:R ' + sqMinRr() + '.</div>'
        + shown.map(function(r){ return sqSetupCardHTML(r, 'clean'); }).join('');
      sqPaintMiniCharts(refs.cards, shown);
    }
  }
  if (refs.near){
    var nearShown = near.filter(filterFn || function(){ return true; });
    refs.near.innerHTML = nearShown.length
      ? ((typeof hgSetupNearHeaderHTML === 'function' ? hgSetupNearHeaderHTML(nearShown.length, 'squeeze') : '')
        + nearShown.slice(0, 8).map(function(r){ return sqSetupCardHTML(r, 'near'); }).join(''))
      : '';
  }
  if (refs.forming){
    var formShown = forming.filter(filterFn || function(){ return true; });
    refs.forming.innerHTML = formShown.length
      ? (formShown.map(function(r){
          if (r.kind === 'build') return cardHTML(r);
          return sqSetupCardHTML(r, 'forming');
        }).join(''))
      : ((typeof hgFormingWatchHTML === 'function')
        ? hgFormingWatchHTML([], { title: 'FORMING · SQUEEZE BUILD', subtitle: 'compression without a fire yet', idleText: 'Run FIND SQUEEZES — building rows appear when BB inside KC for ≥3 bars.' })
        : '');
  }
  if (refs.limit) refs.limit.innerHTML = sqLimitBoardHTML(results);
}

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
    return '<div class="card tier-forming">'
      + '<div class="chead"><span class="sym">' + esc(r.sym) + sqVenueChip(r) + '</span><span class="dir">BUILDING · FORMING</span></div>'
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
      + '<div class="chead"><span class="sym">' + esc(r.sym) + sqVenueChip(r) + '</span><span class="dir">' + dirUp + ' · SQZ FIRED'
      + (cls.trendAgree === false ? ' · AGAINST TREND' : '') + '</span>'
      + (typeof hgBookStampChip === 'function' ? hgBookStampChip(r.sym, r.dir, { scanner: 'squeeze', strategy: 'squeeze' }) : '')
      + '</div>'
      + '<div class="mini">'
      + '<span class="k">last</span><span>' + pxF(lastC) + '</span>'
      + '<span class="k">fired</span><span>' + cls.firedAgo + ' bar' + (cls.firedAgo === 1 ? '' : 's') + ' ago</span>'
      + '<span class="k">momentum @fire</span><span class="' + (cls.momentum > 0 ? 'pos' : 'neg') + '">' + fmtF(cls.momentum, 1) + '</span>'
      + '<span class="k">vol z @fire</span><span>' + (isFinite(cls.volZ) ? fmtF(cls.volZ, 2) : '—') + '</span>'
      + '<span class="k">1d trend</span><span>' + trendTxt + '</span>'
      + '<span class="k">turnover 24h</span><span>' + turnover + '</span>'
      + '</div>'
      + '<div class="gates">' + chips + '</div>'
      + squeezePlanBlock({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind }, notes.join('; '))
      + '</div>';
  }

  /* kind === 'break' */
  var dUp = cls.donchianBreak === 'LONG';
  return '<div class="card ' + r.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + sqVenueChip(r) + '</span><span class="dir">' + dirUp + ' · DC' + DC_LEN + ' BREAKOUT</span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(r.sym, r.dir, { scanner: 'squeeze', strategy: 'squeeze' }) : '')
    + '</div>'
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
    + squeezePlanBlock({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind }, 'Donchian breakout — momentum continuation')
    + '</div>';
}

/* ---------------- hard-refresh contract state ----------------
   The registration carries refresh() alongside mount() for the global HARD
   REFRESH button. runScan lives inside mount (it closes over the pane nodes),
   so mount publishes it here. refresh() never throws, returns a short status
   string, busy-guards overlapping invocations, and never fires a first-time
   full-universe scan on its own — a global refresh must stay cheap for tabs
   the user has never run (skip instead). */
var __scan = { run: null, busy: false, hasRun: false, mountEl: null };
var __sqScanSnap = null;

/* ---------------- BRAIN state snapshot (window.squeezeState + HG_squeezeResults)
   Last SUCCESSFUL scan's result rows, cached for the BRAIN meta-engine and
   published on the key engine.js's Stage-0 already reads. Aborted/failed
   re-runs never touch them — the previous good snapshot keeps its original
   `at`. The getter (registration block below) hands out DEEP-FROZEN deep
   copies and never throws. W is assigned at module load; the publisher only
   ever runs inside a scan, long after that. */
var __sqSnap = null;
function __sqStateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = __sqStateView(v[k]);
  }
  Object.freeze(out);
  return out;
}
function publishSqueezeState(results){
  try{
    var rows = [], syms = [], i, r;
    for (i = 0; i < results.length; i++){
      r = results[i];
      if (!r) continue;
      var row = {
        sym: r.sym,
        dir: (r.dir === 'long' || r.dir === 'short') ? r.dir : null,
        kind: r.kind
      };
      if ((r.kind === 'fired' || r.kind === 'break') && row.dir){
        try{
          var pubPlan = squeezePlan({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h, kind: r.kind });
          if (pubPlan && isFinite(+pubPlan.entry) && isFinite(+pubPlan.stop) && isFinite(+pubPlan.t1)){
            row.entry = +pubPlan.entry;
            row.stop = +pubPlan.stop;
            row.t1 = +pubPlan.t1;
            if (isFinite(+pubPlan.t2)) row.t2 = +pubPlan.t2;
          }
        }catch(ePub){}
      }
      rows.push(row);
      syms.push(r.sym);
    }
    var at = Date.now();
    __sqSnap = { results: rows, at: at };
    /* engine.js Stage-0 contract reads {syms, at} from this key; `results`
       mirrors window.squeezeState() for the BRAIN. */
    W.HG_squeezeResults = { results: rows, syms: syms, at: at };
    /* ALERT seam: actionable squeezes (fired / Donchian break with a
       direction) pushed to hgalert's SQUEEZE class. Levels attached when
       this publisher holds the candles (mounted scan); honestly null from
       sqWarm — the alert text then points at the SQUEEZE tab. */
    try{
      if (typeof W.hgAlertSqueeze === 'function'){
        var hits = [];
        for (i = 0; i < results.length; i++){
          r = results[i];
          if (!r || (r.kind !== 'fired' && r.kind !== 'break')) continue;
          if (r.dir !== 'long' && r.dir !== 'short') continue;
          var p = null;
          try{ p = squeezePlan({ dir: r.dir, rows4h: r.rows4h, rows1h: r.rows1h, cls: r.cls }); }catch(ep){ p = null; }
          hits.push({ sym: r.sym, dir: r.dir, kind: r.kind,
                      entry: (p && isFinite(p.entry)) ? p.entry : null,
                      stop:  (p && isFinite(p.stop))  ? p.stop  : null,
                      t1:    (p && isFinite(p.t1))    ? p.t1    : null });
        }
        W.hgAlertSqueeze(hits);
      }
    }catch(eA){ /* alerting never breaks the scan */ }
  }catch(e){ /* state publishing must never break the scan */ }
}

async function squeezeScanCore(hooks){
  hooks = hooks || {};
  var fetchK = (typeof W.hgDeskFetchKlines === 'function') ? W.hgDeskFetchKlines.bind(W)
    : function(it, tf, n){ return binanceKlines(it.sym || it, tf, n); };
  if (typeof W.hgDeskLoadUniverse !== 'function'
      && (typeof binancePerpUniverse !== 'function' || typeof binanceKlines !== 'function')){
    throw new Error('no universe source (hgDeskLoadUniverse or binancePerpUniverse)');
  }
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: MIN_TURNOVER });
  var uni = uniPack.items || [];
  if (!uni.length) throw new Error('no contracts above turnover floor');
  var results = [], failed = 0;
  for (var ci = 0; ci < uni.length; ci += CHUNK){
    var chunk = uni.slice(ci, ci + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((ci + chunk.length) / uni.length);
    await Promise.all(chunk.map(async function(item){
      var sym = item.sym;
      try{
        var rows4h = null, rows1d = [];
        try{ rows4h = await fetchK(item, '4h', KL_4H_LIMIT); }catch(e4){ rows4h = null; }
        if (!rows4h || !rows4h.length){ failed++; return; }
        try{ rows1d = await fetchK(item, '1d', KL_1D_LIMIT); }catch(e1d){ rows1d = []; }
        rows1d = rows1d || [];
        var cls = squeezeClassify(rows4h, rows1d);
        var tick = {
          turnoverUsd: item.turnoverUsd, mark: item.mark, fundingPct: item.fundingPct,
          chg24: null
        };
        var r = null;
        if (cls.state === 'FIRED_LONG' || cls.state === 'FIRED_SHORT'){
          r = { sym: sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn, xu: item,
                kind: 'fired', dir: cls.state === 'FIRED_LONG' ? 'long' : 'short',
                cls: cls, rows4h: rows4h, tick: tick };
        } else if (cls.donchianBreak){
          var dcn = donchian(rows4h, DC_LEN);
          r = { sym: sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn, xu: item,
                kind: 'break', dir: cls.donchianBreak === 'LONG' ? 'long' : 'short',
                cls: cls, rows4h: rows4h, tick: tick,
                dcLevel: cls.donchianBreak === 'LONG' ? dcn.up[rows4h.length - 2] : dcn.lo[rows4h.length - 2] };
        } else if (cls.state === 'BUILDING'){
          var tt = ttmSqueeze(rows4h), run = 0;
          for (var k = rows4h.length - 1; k >= 0 && tt.on[k]; k--) run++;
          r = { sym: sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn, xu: item,
                kind: 'build', dir: null, cls: cls, rows4h: rows4h, tick: tick, onRun: run };
        }
        if (r && r.kind !== 'build'){
          try{
            var r1h = await fetchK(item, '1h', KL_1H_LIMIT);
            r.rows1h = (r1h && r1h.length) ? r1h : null;
          }catch(e1){ r.rows1h = null; }
          r.gate = squeezeGateEval(r, r.dir);
        }
        if (r) results.push(r);
      }catch(e){ failed++; }
    }));
    if (ci + CHUNK < uni.length) await sleep(CHUNK_SLEEP_MS);
  }
  results.sort(function(a,b){
    var ra = rankOf(a), rb = rankOf(b);
    if (ra !== rb) return ra - rb;
    var ta = a.tick ? a.tick.turnoverUsd : 0, tb = b.tick ? b.tick.turnoverUsd : 0;
    return (tb || 0) - (ta || 0);
  });
  var nFired = 0, nBuild = 0, nBreak = 0;
  results.forEach(function(r){
    if (r.kind === 'fired') nFired++;
    else if (r.kind === 'build') nBuild++;
    else nBreak++;
  });
  return {
    results: results, failed: failed, uniLen: uni.length, fired: nFired, build: nBuild, break: nBreak,
    note: uniPack.note, source: uniPack.source, venueCounts: uniPack.venueCounts
  };
}

async function squeezeScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __sqScanSnap && __sqScanSnap.at && (Date.now() - __sqScanSnap.at) < maxAge) return __sqScanSnap;
  var core = await squeezeScanCore();
  __sqScanSnap = { at: Date.now(), results: core.results, failed: core.failed, uniLen: core.uniLen,
    fired: core.fired, build: core.build, break: core.break, note: core.note, source: core.source,
    venueCounts: core.venueCounts };
  publishSqueezeState(core.results);
  return __sqScanSnap;
}

function hgPaintSqueezeFromSnap(){
  try{
    if (!__sqScanSnap || !__sqScanSnap.results || !__scan.mountEl) return;
    var refs = {
      summary: __scan.mountEl.querySelector('#sqSummary'),
      firedDesk: __scan.mountEl.querySelector('#sqFiredDesk'),
      cards: __scan.mountEl.querySelector('#sqCards'),
      near: __scan.mountEl.querySelector('#sqNear'),
      forming: __scan.mountEl.querySelector('#sqForming'),
      limit: __scan.mountEl.querySelector('#sqLimit'),
      funnel: __scan.mountEl.querySelector('#sqFunnel')
    };
    sqPaintDeskSections(refs, __sqScanSnap.results, __scan._filterFn || null);
    if (refs.funnel && typeof W.hgFunnelPanelHTML === 'function'){
      refs.funnel.innerHTML = W.hgFunnelPanelHTML('WHY EMPTY — SQUEEZE funnel', [
        { k: 'Universe scanned', v: String(__sqScanSnap.uniLen || 0) },
        { k: 'Thin / fetch failed', v: String(__sqScanSnap.failed || 0) },
        { k: 'TTM fired (long+short)', v: String(__sqScanSnap.fired || 0) },
        { k: 'Donchian breakout', v: String(__sqScanSnap.break || 0) },
        { k: 'Building (squeeze on)', v: String(__sqScanSnap.build || 0) }
      ], 'sqFunnelPanel');
    }
  }catch(e){}
}

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
  __scan.mountEl = el;
  var missing = [];
  var hasUniverse = (typeof W.xuUniverse === 'function')
    || (typeof binancePerpUniverse === 'function' && typeof binanceKlines === 'function');
  if (!hasUniverse) missing.push('xuUniverse|binancePerpUniverse');
  if (typeof ttmSqueeze !== 'function') missing.push('ttmSqueeze');
  if (typeof donchian !== 'function') missing.push('donchian');
  if (typeof volZ !== 'function') missing.push('volZ');
  if (typeof ema !== 'function') missing.push('ema');
  if (typeof atr !== 'function') missing.push('atr');

  var floorM = (MIN_TURNOVER / 1e6).toFixed(0);
  el.innerHTML = '<div class="panel hg-panel">'
    + '<h2>SQUEEZE <span>full universe · Delta + CoinDCX + Binance · 4H fire + Donchian ' + DC_LEN + ' break</span></h2>'
    + '<div id="sqDesk"></div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="sqRun">FIND SQUEEZES</button>'
    + '<button class="btn sec" id="sqSync">SYNC DESK</button>'
    + '<span class="spacer"></span>'
    + '<button class="chip on" data-f="ALL">ALL</button>'
    + '<button class="chip" data-f="CL">CLEAN 7/7</button>'
    + '<button class="chip" data-f="NR">NEAR</button>'
    + '<button class="chip" data-f="FR">🔥 FIRED</button>'
    + '<button class="chip" data-f="PR">PRIME FIRED</button>'
    + '<button class="chip" data-f="BR">DC BREAK</button>'
    + '<button class="chip" data-f="BL">BUILDING</button>'
    + '<button class="chip" data-f="LG">LONG</button>'
    + '<button class="chip" data-f="SH">SHORT</button>'
    + '<span class="spacer"></span>'
    + '<button class="chip on" data-v="ALL">ALL VENUES</button>'
    + '<button class="chip" data-v="delta">DELTA</button>'
    + '<button class="chip" data-v="coindcx">COINDCX</button>'
    + '<button class="chip" data-v="binance">BINANCE</button>'
    + '</div>'
    + '<div class="prog" id="sqProg"><i></i></div>'
    + '<div class="note" id="sqSummary" style="margin-top:8px;font-weight:600">Idle — run a scan to build the desk.</div>'
    + '<span class="note" id="sqStat">Full universe ≥ $' + floorM + 'M turnover · Delta + CoinDCX + Binance (no cap)</span>'
    + '</div>'
    + '<div id="sqFiredDesk"></div>'
    + '<div class="cards" id="sqCards"></div>'
    + '<div id="sqNear"></div>'
    + '<div id="sqForming"></div>'
    + '<div id="sqLimit"></div>'
    + '<div id="sqFunnel"></div>'
    + '<div class="empty" id="sqEmpty" style="display:none">No squeezes fired, building, or Donchian breakouts right now.</div>';

  var btn = el.querySelector('#sqRun'), syncBtn = el.querySelector('#sqSync'),
      statEl = el.querySelector('#sqStat'), summaryEl = el.querySelector('#sqSummary'),
      progEl = el.querySelector('#sqProg'), cardsEl = el.querySelector('#sqCards'),
      emptyEl = el.querySelector('#sqEmpty'), funnelEl = el.querySelector('#sqFunnel');
  var refs = {
    summary: summaryEl,
    firedDesk: el.querySelector('#sqFiredDesk'),
    cards: cardsEl,
    near: el.querySelector('#sqNear'),
    forming: el.querySelector('#sqForming'),
    limit: el.querySelector('#sqLimit'),
    funnel: funnelEl
  };
  var chips = Array.prototype.slice.call(el.querySelectorAll('[data-f]'));
  var vChips = Array.prototype.slice.call(el.querySelectorAll('[data-v]'));
  var state = { filter: 'ALL', venue: 'ALL', results: [] };
  __scan._filterFn = function(r){
    if (state.venue && state.venue !== 'ALL' && sqRowVenue(r) !== state.venue) return false;
    return sqPassFilter(r, state.filter);
  };

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

  try{
    if (typeof hgSetupInjectStyles === 'function') hgSetupInjectStyles();
    if (typeof hgSetupPaintDesk === 'function'){
      hgSetupPaintDesk('sqDesk', { kind: 'squeeze', tab: 'SQUEEZE',
        note: 'FIRED + Donchian break + 7/7 gates = CLEAN tickets. BUILDING = FORMING — no direction yet.' });
    }
  }catch(eD){}

  chips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.filter = ch.getAttribute('data-f');
      chips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      sqPaintDeskSections(refs, state.results, __scan._filterFn);
    });
  });
  vChips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.venue = ch.getAttribute('data-v');
      vChips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      sqPaintDeskSections(refs, state.results, __scan._filterFn);
    });
  });

  btn.addEventListener('click', function(){ runScan(); });
  if (syncBtn) syncBtn.addEventListener('click', function(){
    sqPaintDeskSections(refs, state.results, __scan._filterFn);
    setStat('desk repainted from latest scan.');
  });
  __scan.run = runScan;

  function sqFunnelHTML(meta){
    if (!meta || typeof W.hgFunnelPanelHTML !== 'function') return '';
    return W.hgFunnelPanelHTML('WHY EMPTY — SQUEEZE funnel', [
      { k: 'Universe scanned', v: String(meta.uni || 0) },
      { k: 'Thin / fetch failed', v: String(meta.failed || 0) },
      { k: 'TTM fired (long+short)', v: String(meta.fired || 0) },
      { k: 'Donchian breakout', v: String(meta.break || 0) },
      { k: 'Building (squeeze on)', v: String(meta.build || 0) },
      { k: 'Cards shown', v: String(meta.shown || 0) }
    ], 'sqFunnelPanel');
  }

  async function runScan(){
    if (__scan.busy) return;
    __scan.busy = true;
    var t0 = Date.now();
    try{
      btn.disabled = true;
      cardsEl.innerHTML = '';
      emptyEl.style.display = 'none';
      setProg(0.05);
      setStat('loading full universe (≥ $' + floorM + 'M · Delta + CoinDCX + Binance)…');
      var snap = await squeezeScan({ force: true });
      state.results = (snap && snap.results) ? snap.results : [];
      sqPaintDeskSections(refs, state.results, __scan._filterFn);
      if (funnelEl){
        funnelEl.innerHTML = sqFunnelHTML({
          uni: snap.uniLen, failed: snap.failed, fired: snap.fired,
          break: snap.break, build: snap.build,
          shown: state.results.filter(function(r){ return r.kind !== 'build'; }).length
        });
      }
      if (!state.results.length) emptyEl.style.display = 'block';
      var secs = ((Date.now() - t0) / 1000).toFixed(1);
      var vc = snap.venueCounts || {};
      var venNote = ' · Δ' + (vc.delta || 0) + ' CDX' + (vc.coindcx || 0) + ' BN' + (vc.binance || 0);
      setStat('universe ' + (snap.uniLen || 0) + venNote + ' · fired ' + (snap.fired || 0) + ' · building ' + (snap.build || 0)
              + ' · breakouts ' + (snap.break || 0) + ' · failed ' + (snap.failed || 0) + ' · ' + secs + 's'
              + (snap.note ? ' · ' + snap.note : ''));
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
    }finally{
      __scan.busy = false;
      __scan.hasRun = true;
      try{ btn.disabled = false; }catch(e2){}
      setProg(null);
    }
  }

  if (__sqScanSnap && __sqScanSnap.results && __sqScanSnap.results.length &&
      __sqScanSnap.at && (Date.now() - __sqScanSnap.at) < (5 * 60 * 1000)){
    state.results = __sqScanSnap.results;
    __scan.hasRun = true;
    sqPaintDeskSections(refs, state.results, __scan._filterFn);
    setStat('restored from cache · ' + sqSummaryLine(state.results)
      + ' · age ' + Math.round((Date.now() - __sqScanSnap.at) / 1000) + 's');
  }
}

function sqPassFilter(r, filter){
  if (filter === 'CL') return sqRowTier(r) === 'clean';
  if (filter === 'NR') return sqRowTier(r) === 'near';
  if (filter === 'FR') return r.kind === 'fired';
  if (filter === 'PR') return sqPrimeFired(r);
  if (filter === 'BR') return r.kind === 'break';
  if (filter === 'BL') return r.kind === 'build';
  if (filter === 'LG') return r.dir === 'long';
  if (filter === 'SH') return r.dir === 'short';
  return true;
}

/* ---------------- registration ---------------- */
W.squeezeClassify = squeezeClassify;
W.squeezeGateEval = squeezeGateEval;
W.squeezePlan = squeezePlan;
W.squeezePlanHTML = squeezePlanHTML;
W.squeezePlanBlock = squeezePlanBlock;
W.squeezeScan = squeezeScan;
W.hgPaintSqueezeFromSnap = hgPaintSqueezeFromSnap;
/* ---------------- BRAIN warm-up hook ----------------
   runScan lives inside mount (it closes over the pane nodes), so the BRAIN
   cannot reuse it unmounted. sqWarm duplicates the scan core headless and
   publishes through the same publishSqueezeState, whose consumers only ever
   read {sym, dir, kind} — the heavy card context (klines, tick) is a
   render-only concern. Shares __scan.busy with the mounted scan so the two
   can never double-fetch. Never throws. */
async function sqWarm(){
  try{
    if (W.squeezeState && W.squeezeState()) return 'fresh';
  }catch(e0){}
  if (__scan.busy) return 'busy';
  if (typeof W.xuUniverse !== 'function'
      && (typeof binancePerpUniverse !== 'function' || typeof W.binanceKlines !== 'function')){
    return 'unavailable: universe layer not loaded';
  }
  __scan.busy = true;
  try{
    var snap = await squeezeScan({ force: true });
    __scan.hasRun = true;
    return 'warmed · ' + ((snap && snap.results) ? snap.results.length : 0) + ' squeezes';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }finally{
    __scan.busy = false;
  }
}

W.squeezeState = function(){
  try{ return __sqSnap ? __sqStateView(__sqSnap) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'squeeze', label: 'SQUEEZE', mount: mount, refresh: squeezeRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'squeeze', label: 'SQUEEZE', run: sqWarm });
})();
