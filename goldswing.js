/* =========================================================================
HARDGATE — goldswing.js
GOLD SWING tab: swing-horizon (4h/1d) gold setups, same architecture family
as goldscalp.js. RUN SCAN pulls 4h + 1d gold klines from every available
venue, composes PER-STRATEGY swing candidates from real candle/indicator
math, ranks them with a transparent human-readable confluence tally, crowns
the #1 with a MOST PROBABLE SETUP banner (full execution plan), and pins
every issued setup under a CONVICTION LOCK (localStorage
'hgGoldswingConviction'): re-running the scan restores the ORIGINAL levels
verbatim with an 'as of HH:MM' stamp — levels are never re-picked for a
live conviction. Transitions only on invalidation against the latest 4h
close: beyond stop -> STOPPED, TP1 reached -> TARGET HIT, structure older
than 5 days -> EXPIRED. Closed setups render as a small history line — they
never vanish silently.

STRATEGY CANDIDATES (each names its evidence; a candidate needs its trigger
PLUS >=2 independent agreeing reads, strictly more than opposing — a trigger
without confluence is held back on the .rejected side-channel with the
reason named, never silently dropped):
  1) 4H TREND PULLBACK (EMA50/200) — 4h trend stack (price beyond EMA50,
     EMA50 beyond EMA200) pulling back into the 50-EMA value zone (within
     0.75xATR of EMA50). Stop anchored beyond the 200-EMA.
  2) WEEKLY RANGE BREAKOUT — prior ISO week's high/low (computed from real
     1d bars) either SWEPT + RECLAIMED on a 4h close (mean-reversion) or
     BROKEN WITH DISPLACEMENT (latest 4h bar closes beyond the level with a
     >=1.5xATR range — range expansion). Stop anchored beyond the level.
  3) 4H ORDER BLOCK RETEST — structure-aligned retest via goldOrderBlockRetest
     (active unmitigated zones + fractal trend); legacy goldOrderBlocks
     proximity fallback when structure is neutral. Stop anchored beyond the OB edge.
  4) MACRO-ALIGNED TREND CONTINUATION — a REAL daily trend stack (EMA50/200
     on 1d) aligned with getGoldMacro's realRateHint (TAILWIND favors longs,
     HEADWIND favors shorts). Macro NEVER fabricates a setup: no daily
     trend stack or a NEUTRAL/absent hint -> no candidate.

RANKING TALLY (shown on every card — same pattern as GOLD SCALP; ICT
killzone session weights are intraday-only and deliberately NOT a swing
tally leg, the detected session is shown as context on the card instead):
  +N    independent agreeing reads (the candidate's own ledger)
  -2    high-impact news window (+/-30 min, goldNewsCaution / hgNewsState)
  +/-2  fundamentals tilt (getGoldMacro realRateHint: TAILWIND favors
        longs, HEADWIND favors shorts; DXY/US10Y trends quoted in the label)
  +/-1  positioning (window.goldspotState PAXG basis verdict)
  +1    seasonality (goldSeason STRONG bias behind a long)
  +1    crypto risk sentiment (lexical global S.fng — feature-checked
        softly, skipped when absent)

SWING RISK MODEL (all from real values, nothing fabricated): stop 1.5-2x
ATR14(4h), never tighter, extended to sit beyond the structure (OB edge /
range edge / 200-EMA) when that is wider, capped at 2x; targets at
1.5R / 2.5R / 4R. Generic high-impact news still NEWS-FADE (−2 tally).
Tier-1 US prints (CPI / NFP / FOMC / GDP) lock NEW swing minting 30 min
before and 15 min after the release (spread-expansion window). Already-live
convictions keep running. A live bid/ask wider than 250 points / 2.5 pips
($0.25) also locks the entry gate. HTF conflict does not block Gold Wing.

goldind.js detector layer is consumed READ-ONLY and every export is
feature-checked (gfn): goldSweeps / goldOrderBlocks / goldFVG / goldVWAP /
goldVolumeSpike / goldVolumeProfile / goldSweepV2 / goldFVGV2 (V2 triggers:
volume-validated sweeps + HVN-backed FVG when goldind.js is loaded).
goldKillzone (session context only) / goldNewsCaution / goldSeason. ATR +
EMA are taken from indicators.js globals (atr/ema) when loaded, with local
copies identical to goldind.js's own fallbacks otherwise (goldind.js does
not export an ATR — the local copy is the honest degradation). getGoldMacro
(macro.js) is async + optional. A missing detector simply removes its
evidence line and says so in the scan stat / card notes.

Feeds (in preference order):
  1) window.getGoldCandles (macro.js) — XAUUSDT TradFi perp first, PAXGUSDT
     fallback, then Twelve Data / Yahoo.
  2) binanceKlines('PAXGUSDT') — deepest free gold-proxy feed (fallback).
  3) Delta's XAUTUSD perp, when window.xuUniverse + window.xuCandles exist
     and XAUT is listed — scanned as a SECOND venue with its own candidates.

Classic script, no build step, loads AFTER goldind.js + binance.js (+macro.js
/xuniverse.js/news.js/goldspot.js when present). Never throws at load, mount,
scan or refresh: every external global is feature-checked (gfn), every
network leg is async with its own try/catch, localStorage is probed softly,
and every failure degrades to an honest stat line / empty state.

Registers window.HG_tabs.push({id:'goldswing', label:'GOLD SWING', mount,
refresh}) — refresh(): async, never throws, 'busy' | 'skipped: not run yet' |
'refreshed' | 'error: …', busy-guarded, and never triggers a first-time scan
on its own. Warm-up: window.HG_warmups.push({id:'goldswing', run}) — 'fresh'
when a state snapshot exists, else a headless scan against inert stub
elements (oiflow.js oiflowWarm pattern) -> 'warmed' | 'busy' | 'unavailable: …'.

BRAIN STATE CONTRACT — after each SUCCESSFUL scan the qualifying setups are
cached module-locally and exposed as window.goldswingState() for the BRAIN:
  { results: [{ venue, sym, dir, grade, strategy }], at } | null
Zero-arg getter, never throws, deep-frozen copies; a failed re-run keeps the
previous good snapshot with its original `at`.

DIAGNOSTIC SURFACE — window.goldswingScan(): the last successful scan in
full (deep-frozen, never throws, null before the first scan):
  { cands: [{ id, venue, sym, dir, strategy, stratKey, grade, entry, stop,
             t1, t2, t3, rr, rr2, rr3, tally, tallyParts, agree, oppose,
             session, atr, locked, issuedAt, asOf, why, invalidates, anchor }],
    bestId, history: [{ id, dir, strategy, venue, sym, entry, stop, t1, t2,
                        t3, status, issuedAt, closedAt, closePrice }],
    rejected: [{ id, strategy, stratKey, dir, venue, sym, reason }], at } | null
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var KL_4H = 220, KL_1D = 260;
var MIN_4H = 60;          /* bars needed for stable ATR + detector windows */

/* ---------------- tiny helpers ---------------- */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pxF(n){
  if (typeof px === 'function'){ try{ return px(n); }catch(e){} }
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function'){ try{ return fmt(n, d); }catch(e){} }
  return (n === null || n === undefined || !isFinite(n)) ? '—'
       : Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name]; }catch(e){}
  return null;
}
/** Same CONFIRMED COMBINED SETUP card as GOLD SCALP / OMNIGOLD. */
function goldUniformTapeOf(rows){
  var tapeFn = gfn('hgGoldUniformTape');
  return tapeFn ? tapeFn(rows) : '';
}
function goldUniformPanelHtml(cands, rows, horizon, tape){
  try{
    var compose = gfn('hgGoldUniformCompose');
    var htmlFn = gfn('hgGoldUniformHtml');
    if (!compose || !htmlFn) return '';
    if (tape == null) tape = goldUniformTapeOf(rows);
    return htmlFn(compose(cands || [], { rows: rows, horizon: horizon || 'SWING', tape: tape }));
  }catch(e){ return ''; }
}
function goldTapeAlignedBest(displayBest, display, tape){
  var alignFn = gfn('hgGoldUniformAlignedBest');
  if (!tape || !alignFn) return displayBest;
  var aligned = alignFn(display || [], tape);
  if (displayBest && String(displayBest.dir || '').toLowerCase() !== String(tape).toLowerCase())
    return aligned || null;
  if (!displayBest) return aligned || null;
  return displayBest;
}
function goldStampTape(display, tape){
  var t = String(tape || '').toLowerCase();
  var i;
  if (!Array.isArray(display)) return;
  for (i = 0; i < display.length; i++){
    if (display[i]) display[i].goldTape = t;
  }
}
function goldTapeChipHtml(c, tape){
  var t = String(tape || (c && c.goldTape) || '').toLowerCase();
  var d = String(c && c.dir || '').toLowerCase();
  if ((t !== 'long' && t !== 'short') || (d !== 'long' && d !== 'short')) return '';
  return d === t
    ? '<span class="gpip ok"' + gswPipAttr(true) + '>WITH GOLD TAPE</span>'
    : '<span class="gpip"' + gswPipAttr(false) + '>AGAINST GOLD TAPE · HELD</span>';
}

var SRC_LABEL = { 'binance-xau': 'BINANCE XAUUSDT', 'binance-paxg': 'BINANCE PAXGUSDT',
                  'twelvedata': 'TWELVE DATA XAU/USD', 'yahoo': 'YAHOO GC=F',
                  'delta-xaut': 'DELTA XAUTUSD', 'xm-xauusd': 'XM XAUUSD' };
var ST_GOLD_SYM = 'XAUUSD';
function venueLabel(src){ return SRC_LABEL[src] || 'PAXGUSDT · BINANCE'; }
function stGoldVenueLabel(goldSource){
  try{
    if (goldSource === 'xm-xauusd') return 'XM ' + ST_GOLD_SYM;
    if (goldSource && SRC_LABEL[goldSource]) return 'STAR TRADER ' + ST_GOLD_SYM + ' · ' + SRC_LABEL[goldSource];
  }catch(e){}
  return 'STAR TRADER ' + ST_GOLD_SYM;
}
function stGoldBasisHtml(){
  try{
    if (typeof S !== 'undefined' && S && S.goldDataSource === 'delta-xaut'){
      var fn = gfn('hgGoldBasisNoteHtml');
      if (fn) return fn() || '';
    }
  }catch(e){}
  return '';
}

var XAUT_SPOT_BASIS_WARN_PCT = 0.35;
var XAUT_SPOT_BEST_MAX_BASIS = 0.5;
var GOLD_SPOT_DRIFT_PURGE_PCT = 1.0;

function goldSpotDriftPct(entry, spot){
  if (!isFinite(entry) || !isFinite(spot) || !(spot > 0)) return NaN;
  return Math.abs(entry / spot - 1) * 100;
}

function goldScaleOneCandidate(c, fromRef, liveRef){
  if (!c || !isFinite(fromRef) || !isFinite(liveRef) || !(fromRef > 0)) return;
  var ratio = liveRef / fromRef;
  if (Math.abs(ratio - 1) * 100 < 0.35) return;
  var keys = ['entry', 'stop', 't1', 't2', 't3', 'anchor'];
  for (var k = 0; k < keys.length; k++){
    if (isFinite(c[keys[k]])) c[keys[k]] = c[keys[k]] * ratio;
  }
  if (c.zone){
    if (isFinite(c.zone.lo)) c.zone.lo *= ratio;
    if (isFinite(c.zone.hi)) c.zone.hi *= ratio;
  }
  var risk = Math.abs(c.entry - c.stop);
  if (risk > 0){
    if (isFinite(c.t1)) c.rr = Math.abs(c.t1 - c.entry) / risk;
    if (isFinite(c.t2)) c.rr2 = Math.abs(c.t2 - c.entry) / risk;
    if (isFinite(c.t3)) c.rr3 = Math.abs(c.t3 - c.entry) / risk;
  }
  c.spotRealigned = true;
  c.spotAlignRatio = ratio;
}

function goldSpotRefFromRows(rows){
  if (!rows || !rows.length) return NaN;
  var lc = rows[rows.length - 1];
  return (lc && isFinite(lc.c)) ? +lc.c : NaN;
}

function goldAnnotateXautBasis(cands, spotRef){
  if (!Array.isArray(cands) || !isFinite(spotRef) || !(spotRef > 0)) return;
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (!c || c.sym !== 'XAUTUSD' || !isFinite(c.entry)) continue;
    c.spotRef = spotRef;
    c.xautBasisPct = (c.entry / spotRef - 1) * 100;
  }
}

function goldPickSpotAlignedBest(ranked, spotRef){
  if (!Array.isArray(ranked) || !ranked.length) return null;
  var xautFallback = null;
  for (var i = 0; i < ranked.length; i++){
    var bc = ranked[i];
    if (!bc || bc.demoted || bc.vetoed) continue;
    var isXaut = bc.sym === 'XAUTUSD' || (bc.venue && /XAUT/i.test(bc.venue));
    if (!isXaut) return bc;
    if (isFinite(spotRef) && isFinite(bc.entry)){
      var basis = Math.abs(bc.entry / spotRef - 1) * 100;
      if (basis <= XAUT_SPOT_BEST_MAX_BASIS) return bc;
    }
    if (!xautFallback) xautFallback = bc;
  }
  return null;
}

async function goldLiveSpotRef(klineHint){
  try{
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 10000);
    var r = await fetch('https://api.gold-api.com/price/XAU', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return NaN;
    var j = await r.json();
    var p = j && +j.price;
    if (!(isFinite(p) && p > 0)) return NaN;
    if (isFinite(klineHint) && klineHint > 0 && Math.abs(p / klineHint - 1) * 100 > 8) return NaN;
    return p;
  }catch(e){ return NaN; }
}

function goldPurgeBadGeometry(store){
  if (!store || !store.live) return 0;
  var sidesFn = (typeof W !== 'undefined' && typeof W.hgGoldPlanSidesOk === 'function')
    ? W.hgGoldPlanSidesOk : null;
  if (!sidesFn) return 0;
  var n = 0, id, rec, chk;
  for (id in store.live){
    if (!Object.prototype.hasOwnProperty.call(store.live, id)) continue;
    rec = store.live[id];
    if (!rec) continue;
    chk = sidesFn({ dir: rec.dir, entry: rec.entry, stop: rec.stop, t1: rec.t1 });
    if (!chk || !chk.ok){
      delete store.live[id];
      n++;
    }
  }
  return n;
}
function goldPurgeStaleConvictions(store, liveSpot){
  if (!store || !store.live || !isFinite(liveSpot) || !(liveSpot > 0)) return 0;
  var n = 0;
  for (var id in store.live){
    if (!Object.prototype.hasOwnProperty.call(store.live, id)) continue;
    var rec = store.live[id];
    if (!rec || !isFinite(rec.entry)) continue;
    if (rec.sym === 'XAUTUSD' || (rec.venue && /XAUT/i.test(rec.venue))){
      delete store.live[id]; n++; continue;
    }
    var drift = goldSpotDriftPct(rec.entry, liveSpot);
    if (isFinite(drift) && drift > GOLD_SPOT_DRIFT_PURGE_PCT){
      delete store.live[id]; n++;
    }
  }
  return n;
}

function goldSpotGuardAfterLock(store, ranked, liveSpot){
  if (!isFinite(liveSpot) || !(liveSpot > 0)) return 0;
  var n = goldPurgeStaleConvictions(store, liveSpot);
  for (var i = 0; i < (ranked || []).length; i++){
    var c = ranked[i];
    if (!c || !isFinite(c.entry)) continue;
    var drift = goldSpotDriftPct(c.entry, liveSpot);
    if (!isFinite(drift)) continue;
    if (drift > GOLD_SPOT_DRIFT_PURGE_PCT){
      if (c.locked){
        c.vetoed = true;
        c.locked = false;
        c.why = 'levels cleared — ' + drift.toFixed(1) + '% off live spot ~$' + pxF(liveSpot) + ' (re-scan for fresh setup)';
      }
      if (store && store.live && c.id){
        if (store.live[c.id]) delete store.live[c.id];
        else if (c.venue && store.live[c.venue + '|' + c.id]) delete store.live[c.venue + '|' + c.id];
      }
      n++;
    } else if (drift >= 0.35){
      goldScaleOneCandidate(c, c.entry, liveSpot);
    }
  }
  return n;
}

function goldAlignLevelsToSpot(cands, klineRef, liveRef){
  if (!Array.isArray(cands) || !isFinite(klineRef) || !isFinite(liveRef) || !(klineRef > 0)) return;
  var ratio = liveRef / klineRef;
  if (Math.abs(ratio - 1) * 100 < 0.35) return;
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (!c || c.sym === 'XAUTUSD') continue;
    var keys = ['entry', 'stop', 't1', 't2', 't3', 'anchor'];
    for (var k = 0; k < keys.length; k++){
      if (isFinite(c[keys[k]])) c[keys[k]] = c[keys[k]] * ratio;
    }
    if (c.zone){
      if (isFinite(c.zone.lo)) c.zone.lo *= ratio;
      if (isFinite(c.zone.hi)) c.zone.hi *= ratio;
    }
    c.spotAligned = true;
    c.spotAlignRatio = ratio;
  }
}

/* ---------------- local indicator fallbacks (identical math to indicators.js
   / goldind.js's own local copies — goldind.js does NOT export an ATR, so
   the honest degradation is the same local copy it uses itself) ---------------- */
function __emaLocal(vals, p){
  var out = new Array(vals.length).fill(NaN);
  if (!vals || vals.length < p) return out;
  var k = 2/(p+1), sum = 0, i;
  for (i = 0; i < p; i++) sum += vals[i];
  var e = sum/p;
  out[p-1] = e;
  for (i = p; i < vals.length; i++){ e = vals[i]*k + e*(1-k); out[i] = e; }
  return out;
}
function __atrLocal(rows, p){
  p = p || 14;
  var out = new Array(rows.length).fill(NaN), a = null;
  for (var i = 1; i < rows.length; i++){
    var r = rows[i], q = rows[i-1];
    if (!r || !q) continue;
    var tr = Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
    if (!isFinite(tr)) continue;
    if (a === null){
      if (i >= p){
        var s = 0, ok = true;
        for (var k = i-p+1; k <= i; k++){
          var rk = rows[k], rj = rows[k-1];
          if (!rk || !rj){ ok = false; break; }
          var tk = Math.max(rk.h - rk.l, Math.abs(rk.h - rj.c), Math.abs(rk.l - rj.c));
          if (!isFinite(tk)){ ok = false; break; }
          s += tk;
        }
        if (ok){ a = s/p; out[i] = a; }
      }
    } else { a = (a*(p-1) + tr)/p; out[i] = a; }
  }
  return out;
}
var _ema = (typeof ema === 'function') ? ema : __emaLocal;
var _atr = (typeof atr === 'function') ? atr : __atrLocal;

function __rows(rows){
  if (!Array.isArray(rows) || !rows.length) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (r && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c)) out.push(r);
  }
  return out.length ? out : null;
}
function __closes(rows){ return rows.map(function(r){ return r.c; }); }
function __last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }

/* ---------------- ISO-week helpers (UTC Monday boundary) ---------------- */
function __weekStartSec(t){                    /* t: unix seconds */
  var d = Math.floor(t/86400)*86400;
  var dow = new Date(d*1000).getUTCDay();      /* 0 = Sunday */
  var back = (dow + 6) % 7;                    /* days since Monday */
  return d - back*86400;
}
function __weekAnchorIndex(rows4){
  /* first 4h bar of the last bar's current UTC week (weekly VWAP anchor) */
  try{
    var n = rows4.length, tl = rows4[n-1].t;
    if (!isFinite(tl)) return -1;
    var ws = __weekStartSec(tl);
    for (var i = n - 1; i >= 0; i--){
      var t = rows4[i].t;
      if (!isFinite(t) || t < ws) return i + 1;
    }
    return 0;
  }catch(e){ return -1; }
}
function __weeklyRange(rows1d){
  /* prior COMPLETED ISO week's high/low from real daily bars */
  try{
    rows1d = __rows(rows1d);
    if (!rows1d || rows1d.length < 5) return null;
    var n = rows1d.length, tl = rows1d[n-1].t;
    if (!isFinite(tl)) return null;
    var prev = __weekStartSec(tl) - 7*86400;
    var hi = -Infinity, lo = Infinity, bars = 0;
    for (var i = 0; i < n; i++){
      var t = rows1d[i].t;
      if (!isFinite(t) || __weekStartSec(t) !== prev) continue;
      if (rows1d[i].h > hi) hi = rows1d[i].h;
      if (rows1d[i].l < lo) lo = rows1d[i].l;
      bars++;
    }
    if (bars < 3 || !(hi > lo)) return null;
    return { hi: hi, lo: lo, bars: bars };
  }catch(e){ return null; }
}

/* ---------------- BRAIN state snapshot ---------------- */
var __snap = null;
function __stateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = __stateView(v[k]);
  }
  Object.freeze(out);
  return out;
}
function publishState(cands){
  try{
    var rows = [];
    for (var i = 0; i < cands.length; i++){
      var c = cands[i];
      if (!c || !c.dir) continue;
      rows.push({ venue: c.venue, sym: c.sym, dir: c.dir, grade: c.grade, strategy: c.strategy });
    }
    __snap = { results: rows, at: Date.now() };
  }catch(e){ /* snapshotting must never break the scan */ }
}

/* ---------------- diagnostic surface (full last scan) ---------------- */
var __scanSnap = null;
function publishScan(ranked, best, history, at, rejected, armed, whySilent){
  try{
    var cands = [];
    for (var i = 0; i < ranked.length; i++){
      var c = ranked[i];
      if (!c || !c.dir) continue;
      cands.push({
        id: c.id || null, venue: c.venue || null, sym: c.sym || null,
        dir: c.dir, strategy: c.strategy || null, stratKey: c.stratKey || null,
        grade: c.grade || null, entry: c.entry, stop: c.stop,
        t1: c.t1, t2: c.t2, t3: c.t3, rr: c.rr, rr2: c.rr2, rr3: c.rr3,
        tally: isFinite(c.tally) ? c.tally : null,
        tallyParts: Array.isArray(c.tallyParts)
          ? c.tallyParts.map(function(p){ return { label: p && p.label, pts: p && p.pts }; }) : [],
        agree: isFinite(c.agree) ? c.agree : null, oppose: isFinite(c.oppose) ? c.oppose : null,
        session: c.session || null, atr: isFinite(c.atr) ? c.atr : null,
        locked: !!c.locked, issuedAt: isFinite(c.issuedAt) ? c.issuedAt : null,
        asOf: c.asOf || null, why: c.why || null, invalidates: c.invalidates || null,
        anchor: isFinite(c.anchor) ? c.anchor : null,
        zone: (c.zone && isFinite(c.zone.lo) && isFinite(c.zone.hi)) ? { lo: c.zone.lo, hi: c.zone.hi } : null
      });
    }
    /* FORWARD LOG, split by STRATEGY. This desk runs several distinct setups
       — trend pullback, range breakout, order-block retest, macro-aligned
       continuation — and until now nothing could say which of them pays. The
       conviction lock means a candidate keeps its original levels across
       re-scans, and the log keys on the bar, so a locked setup is recorded
       once rather than re-counted every time the desk repaints.
       XAUUSD is the symbol regardless of venue: the venue affects execution,
       not whether the setup resolved. */
    try {
      if (typeof W.hgFwdRecordScan === 'function' && cands.length){
        W.hgFwdRecordScan('GOLDSWING', '4h', cands.filter(function(c){
          return c && c.dir && isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1);
        }).map(function(c){
          return { sym: 'XAUUSD', dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
                   mechanic: String(c.stratKey || c.strategy || 'UNKNOWN').toUpperCase().slice(0, 28),
                   ticket: (c.grade === 'A' || c.grade === 'clean' || !!c.locked) };
        }), { horizonBars: 20 });
      }
    } catch (eFwd) { try { if (typeof window.hgFwdWarn === "function") window.hgFwdWarn("goldswing", eFwd); } catch (eW) {} }
    var hist = [];
    for (var j = 0; j < (history || []).length; j++){
      var h = history[j];
      if (!h) continue;
      hist.push({ id: h.id || null, dir: h.dir || null, strategy: h.strategy || null,
                  venue: h.venue || null, sym: h.sym || null,
                  entry: h.entry, stop: h.stop, t1: h.t1, t2: h.t2, t3: h.t3,
                  status: h.status || null, issuedAt: isFinite(h.issuedAt) ? h.issuedAt : null,
                  closedAt: isFinite(h.closedAt) ? h.closedAt : null,
                  closePrice: isFinite(h.closePrice) ? h.closePrice : null });
    }
    var rej = [];
    for (var q = 0; q < (rejected || []).length; q++){
      var r0 = rejected[q];
      if (!r0) continue;
      rej.push({ id: r0.id || null, strategy: r0.strategy || null, stratKey: r0.stratKey || null,
                 dir: r0.dir || null, venue: r0.venue || null, sym: r0.sym || null,
                 reason: r0.reason || null });
    }
    /* additive: FORMING-NOW watch items + the WHY SILENT line (zero-candidate
       scans). Existing fields above are untouched. */
    var arm = [];
    for (var wq = 0; wq < (armed || []).length; wq++){
      var w0 = armed[wq];
      if (!w0) continue;
      var wSt = (w0.state === 'promoted') ? 'promoted' : ((w0.state === 'armed') ? 'armed' : 'idle');
      arm.push({ strategy: w0.strategy || null, venue: w0.venue || null,
                 state: wSt,
                 level: (typeof w0.level === 'number' && isFinite(w0.level)) ? w0.level : null,
                 condition: w0.condition || '', reason: w0.reason || null,
                 promoteNote: w0.promoteNote || null });
    }
    __scanSnap = { cands: cands, bestId: best ? (best.id || null) : null, history: hist, rejected: rej,
                   armed: arm, whySilent: (typeof whySilent === 'string' && whySilent) ? whySilent : null, at: at };
  }catch(e){ /* snapshotting must never break the scan */ }
}

/* ============================ CONVICTION LOCK ============================
   Delegates to conviction-lock.js (ConvictionLockManager) — localStorage
   'hgGoldswingConviction'. See conviction-lock.js for lifecycle semantics. */
var CONVICTION_KEY = 'hgGoldswingConviction';
var CONVICTION_TTL_MS = 5*24*60*60*1000;       /* 5-day expiry */
var CONVICTION_HIST = 8;

function __lsRead(){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    return localStorage.getItem(CONVICTION_KEY);
  }catch(e){ return null; }
}
function __lsWrite(s){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.setItem(CONVICTION_KEY, s);
  }catch(e){}
}
function loadConvictions(){
  var fresh = { v: 1, live: {}, history: [] };
  try{
    var raw = __lsRead();
    if (!raw) return fresh;
    var j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return fresh;
    if (!j.live || typeof j.live !== 'object') j.live = {};
    if (!Array.isArray(j.history)) j.history = [];
    return j;
  }catch(e){ return fresh; }
}
function saveConvictions(store){
  try{ __lsWrite(JSON.stringify({ v: 1, live: store.live, history: store.history })); }catch(e){}
}

/* venueRows: { venueLabel: { rows4h } } — latest 4h closes per venue for
   invalidation checks. Mutates the ranked candidates (restores levels). */
function applyConviction(ranked, venueRows, nowMs){
  var store = loadConvictions();
  var lockFn = (typeof applyHardgateConvictionLock === 'function')
    ? applyHardgateConvictionLock
    : ((typeof W !== 'undefined' && W) ? W.applyHardgateConvictionLock : null);
  if (lockFn){
    var got = lockFn(store, ranked, venueRows, nowMs, {
      type: 'swing',
      rowKey: 'rows4h',
      historyLimit: CONVICTION_HIST,
      venueScopedKeys: true,
      expiryMs: CONVICTION_TTL_MS
    });
    saveConvictions(got.store);
    return got;
  }
  return { store: store, transitions: [] };
}

/* When a scan finds zero new qualifying candidates but live convictions remain
   in localStorage, still render the locked card(s) — the stat already names
   "N live conviction(s)" and WHY SILENT must not be the only surface. */
function __cardFromLiveRec(rec){
  if (!rec || !rec.id || (rec.dir !== 'long' && rec.dir !== 'short')) return null;
  if (!isFinite(rec.entry) || !isFinite(rec.stop) || !isFinite(rec.t1)) return null;
  if (typeof W !== 'undefined' && typeof W.hgGoldPlanSidesOk === 'function'){
    var sides = W.hgGoldPlanSidesOk(rec);
    if (!sides || !sides.ok) return null;
  }
  var risk = Math.abs(rec.entry - rec.stop);
  var card = {
    id: rec.id,
    dir: rec.dir,
    strategy: rec.strategy || 'SWING SETUP',
    stratKey: String(rec.id).split('|')[0] || 'live',
    entry: rec.entry, stop: rec.stop, t1: rec.t1, t2: rec.t2, t3: rec.t3,
    venue: rec.venue || null, sym: rec.sym || null,
    locked: true, issuedAt: rec.issuedAt,
    grade: rec.grade || 'B',
    agree: isFinite(rec.agree) ? rec.agree : 2,
    oppose: isFinite(rec.oppose) ? rec.oppose : 0,
    tally: isFinite(rec.tally) ? rec.tally : 0,
    tallyParts: Array.isArray(rec.tallyParts) ? rec.tallyParts : [],
    why: rec.why || 'conviction locked — original levels restored verbatim on re-scan',
    invalidates: rec.invalidates || 'a 4h close beyond the stop',
    session: rec.session || 'n/a',
    anchor: isFinite(rec.anchor) ? rec.anchor : rec.entry,
    zone: (rec.zone && isFinite(rec.zone.lo) && isFinite(rec.zone.hi))
      ? rec.zone : { lo: rec.entry - 1, hi: rec.entry + 1 },
    notes: [],
    newsCaution: !!rec.newsCaution,
    newsStamp: rec.newsStamp || null,
    confluence: Array.isArray(rec.confluence) ? rec.confluence : [],
    reads: (rec.reads && typeof rec.reads === 'object')
      ? rec.reads
      : { long: (rec.dir === 'long') ? (isFinite(rec.agree) ? rec.agree : 2) : 0,
          short: (rec.dir === 'short') ? (isFinite(rec.agree) ? rec.agree : 2) : 0 },
    atr: isFinite(rec.atr) ? rec.atr : NaN,
    rr: risk > 0 ? Math.abs(rec.t1 - rec.entry) / risk : NaN,
    rr2: risk > 0 && isFinite(rec.t2) ? Math.abs(rec.t2 - rec.entry) / risk : NaN,
    rr3: (risk > 0 && rec.t3 !== null && rec.t3 !== undefined && isFinite(rec.t3))
      ? Math.abs(rec.t3 - rec.entry) / risk : null
  };
  try{
    card.asOf = isFinite(card.issuedAt)
      ? new Date(card.issuedAt).toISOString().slice(11, 16) + ' UTC' : '';
  }catch(eA){ card.asOf = ''; }
  return card;
}
function mergeLiveDisplayCards(ranked, store){
  var out = ranked.slice(), seen = {}, i;
  for (i = 0; i < out.length; i++){
    if (!out[i] || !out[i].id) continue;
    if (out[i].venue) seen[out[i].venue + '|' + out[i].id] = true;
    seen[out[i].id] = true;
  }
  if (!store || !store.live) return out;
  for (var k in store.live){
    if (!Object.prototype.hasOwnProperty.call(store.live, k)) continue;
    if (seen[k]) continue;
    var rec = store.live[k];
    if (rec && rec.id && seen[rec.id]) continue;
    var card = __cardFromLiveRec(rec);
    if (card){ out.push(card); seen[k] = true; if (card.id) seen[card.id] = true; }
  }
  return out;
}

/* ---------------- pane-scoped styles (injected from here ONLY) ---------------- */
var GW_CSS = ''
+ '.gsw-banner{position:relative;border-radius:12px;padding:3px;margin:16px 0 18px;'
+ 'background:linear-gradient(120deg,#A67C12,#E8B42A 25%,#059669 50%,#C9921A 75%,#A67C12);'
+ 'box-shadow:0 12px 32px -12px rgba(5,150,105,.22)}'
+ '.gsw-banner-in{background:linear-gradient(180deg,#FFFFFF,#F8FAFC);border-radius:10px;padding:16px 18px;color:#020617}'
+ '.gsw-eye{font-size:10px;letter-spacing:.3em;color:#A67C12;font-weight:800}'
+ '.gsw-dir{font-family:var(--disp,inherit);font-size:26px;font-weight:800;letter-spacing:.06em;margin-top:4px}'
+ '.gsw-dir.long{color:#047857;text-shadow:none}'
+ '.gsw-dir.short{color:#B91C1C;text-shadow:none}'
+ '.gsw-dir span{display:block;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.14em;color:#0F172A;margin-top:4px}'
+ '.gsw-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0 4px}'
+ '.gsw-plan>div{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:9px 11px}'
+ '.gsw-plan i{display:block;font-style:normal;font-size:9px;letter-spacing:.16em;color:#1E293B;font-weight:700}'
+ '.gsw-plan b{display:block;font-size:16px;color:#047857;font-weight:800;margin:3px 0}'
+ '.gsw-plan u{text-decoration:none;font-size:10px;color:#0F172A;opacity:1;font-weight:500;line-height:1.45}'
+ '.gsw-why{font-size:11px;margin-top:8px;color:#0F172A;font-weight:600}'
+ '.gsw-why b{color:#A67C12;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '.gsw-tally{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}'
+ '.gsw-tp{font-size:9px;letter-spacing:.03em;padding:3px 8px;border-radius:4px;border:1px solid;font-weight:600}'
+ '.gsw-tp.pos{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '.gsw-tp.neg{color:#B91C1C;border-color:rgba(220,38,38,.40);background:rgba(220,38,38,.08)}'
+ '.gsw-inv{font-size:11px;color:#0F172A;margin-top:8px;line-height:1.55;font-weight:500}'
+ '.gsw-inv b{color:#B91C1C;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '.gsw-lock{margin-top:10px;font-size:10px;letter-spacing:.08em;color:#047857;font-weight:600;border-top:1px dashed #BBF7D0;padding-top:8px}'
+ '.gsw-lock.new{color:#1E293B}'
+ '.gsw-card.long{border-left:4px solid #059669;background:linear-gradient(180deg,rgba(5,150,105,.14),transparent 48%),rgba(15,23,42,.94);color:#F1F5F9}'
+ '.gsw-card.short{border-left:4px solid #DC2626;background:linear-gradient(180deg,rgba(220,38,38,.12),transparent 48%),rgba(15,23,42,.94);color:#F1F5F9}'
+ '.gsw-card.best{box-shadow:0 0 0 2px rgba(5,150,105,.35),0 12px 28px -14px rgba(5,150,105,.18)}'
+ '.card.gsw-card{color:#F1F5F9!important}'
+ '.card.gsw-card .sym{color:#F8FAFC!important;font-weight:800}'
+ '.card.gsw-card .dir{text-shadow:none!important}'
+ '.card.gsw-card .mini{color:#E2E8F0!important}'
+ '.card.gsw-card .mini .k{color:#94A3B8!important;font-weight:700}'
+ '.card.gsw-card .mini span:not(.k){color:#F8FAFC!important;font-weight:600}'
+ '.card.gsw-card .gpip{background:rgba(30,41,59,.75)!important;border-color:#475569!important;color:#CBD5E1!important}'
+ '.card.gsw-card .gpip.ok{background:rgba(52,211,153,.14)!important;border-color:rgba(52,211,153,.5)!important;color:#6EE7B7!important;font-weight:700}'
+ '.card.gsw-card .plan{background:rgba(30,41,59,.8)!important;border-color:#475569!important;color:#E2E8F0!important}'
+ '.card.gsw-card .plan b{color:#67E8F9!important}'
+ '.card.gsw-card .note{color:#CBD5E1!important}'
+ '.card.gsw-card .gsw-strat{color:#FBBF24!important}'
+ '.card.gsw-card .gsw-whyline{color:#E2E8F0!important}'
+ '.card.gsw-card .gsw-invline{color:#CBD5E1!important}'
+ '.card.gsw-card .gsw-lockline{color:#6EE7B7!important}'
+ '.card.gsw-card .toTrade{color:#67E8F9!important;border-color:#38BDF8!important;background:rgba(34,211,238,.08)!important}'
+ '.card.gsw-card .toBook{color:#67E8F9!important;border-color:#0891B2!important;background:rgba(8,145,178,.08)!important}'
+ '.gsw-strat{color:#A67C12;font-size:10px;font-weight:800;letter-spacing:.12em}'
+ '.gsw-grade{font-weight:800}'
+ '.gsw-grade.A{color:#047857}'
+ '.gsw-grade.B{color:#0891B2}'
+ '.gsw-grade.C{color:#1E293B}'
+ '.gsw-tallynum{font-weight:800}'
+ '.gsw-tallynum.up{color:#047857}'
+ '.gsw-tallynum.dn{color:#B91C1C}'
+ '.gsw-lockline{font-size:9px;color:#047857;letter-spacing:.1em;margin-top:6px;font-weight:700}'
+ '.gsw-whyline{font-size:11px;color:#020617;margin-top:8px;line-height:1.6;font-weight:500}'
+ '.gsw-invline{font-size:10px;color:#0F172A;margin-top:5px;line-height:1.55;font-weight:500}'
+ '.gsw-invline b{color:#B91C1C;letter-spacing:.08em;font-weight:800}'
+ '.gsw-hist{margin-top:18px}'
+ '.gsw-hhead{font-size:10px;letter-spacing:.2em;color:#1E293B;margin-bottom:6px;font-weight:700}'
+ '.gsw-hrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#0F172A;line-height:1.55;font-weight:500}'
+ '.gsw-hrow.stopped{border-left-color:#DC2626}'
+ '.gsw-hrow.target{border-left-color:#059669}'
+ '.gsw-hrow.expired{border-left-color:#A67C12}'
+ '.gsw-hrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '.gsw-hrow.rej{border-left-color:#EA580C}'
+ '.gsw-wrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#0F172A;line-height:1.55;font-weight:500}'
+ '.gsw-wrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '.gsw-wrow.armed{border-left-color:#059669;color:#020617;background:rgba(5,150,105,.05)}'
+ '.gsw-wst{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '.gsw-wrow.armed .gsw-wst{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '.gsw-wrow.promoted{border-left-color:#0891B2;background:rgba(8,145,178,.06)}'
+ '.gsw-wrow.promoted .gsw-wst{color:#0891B2;border-color:rgba(8,145,178,.45);background:rgba(8,145,178,.10)}'
+ '.gsw-wrow.idle .gsw-wst{color:#1E293B;border-color:#E2E8F0;background:#F8FAFC}'
+ '.gsw-silent{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:9px 11px;margin:12px 0;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '.gsw-silent b{letter-spacing:.12em;font-weight:800;color:#9A3412}'
+ '.gsw-weekend-wrap,.gsw-weekend-wrap{margin:0 0 12px}'
+ '.gsw-weekend,.gsw-weekend{font-size:11px;border-radius:8px;padding:10px 12px;line-height:1.55;margin:12px 0;border:1px solid}'
+ '.gsw-weekend b,.gsw-weekend b{letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '.gsw-weekend-detail,.gsw-weekend-detail{margin-top:6px;font-weight:500}'
+ '.gsw-weekend-ok,.gsw-weekend-ok{border-color:#BBF7D0;background:#F0FDF4;color:#047857}'
+ '.gsw-weekend-muted,.gsw-weekend-muted{border-color:#E2E8F0;background:#F8FAFC;color:#1E293B}'
+ '.gsw-weekend-caution,.gsw-weekend-caution{border-color:#FDE68A;background:#FFFBEB;color:#92400E}'
+ '.gsw-weekend-warn,.gsw-weekend-warn{border-color:rgba(220,38,38,.35);background:#FEF2F2;color:#B91C1C}';

function gswSt(s){ return ' style="' + s + '"'; }
var GSW_CARD = 'background:#0F172A!important;color:#F8FAFC!important;border-color:#334155!important';
var GSW_SYM = 'color:#F8FAFC!important;font-weight:800';
var GSW_STRAT = 'color:#FBBF24!important;font-weight:800';
var GSW_MINI = 'color:#E2E8F0!important';
var GSW_K = 'color:#94A3B8!important;font-weight:700';
var GSW_V = 'color:#F8FAFC!important;font-weight:600';
var GSW_PLAN = 'background:#1E293B!important;border:1px solid #475569!important;color:#E2E8F0!important';
var GSW_PLAN_B = 'color:#67E8F9!important';
var GSW_GPIP = 'background:rgba(30,41,59,.85)!important;border:1px solid #475569!important;color:#CBD5E1!important';
var GSW_GPIP_OK = 'background:rgba(52,211,153,.18)!important;border:1px solid rgba(52,211,153,.55)!important;color:#6EE7B7!important';
var GSW_WHY = 'color:#E2E8F0!important';
function gswPipAttr(ok){ return gswSt(ok ? GSW_GPIP_OK : GSW_GPIP); }

(function hgInjectGswCss(){
  try{
    if (typeof document === 'undefined') return;
    var id = 'hg-gsw-styles';
    if (document.getElementById(id)) return;
    var el = document.createElement('style');
    el.id = id;
    el.textContent = GSW_CSS;
    (document.head || document.documentElement).appendChild(el);
  }catch(e){}
})();

/* ---------------- renderers ---------------- */
function tallyChips(c){
  if (!Array.isArray(c.tallyParts) || !c.tallyParts.length) return '';
  var audit = (typeof W !== 'undefined' && W) ? W.__hgGoldTallyAudit : null;
  return '<div class="gsw-tally">' + c.tallyParts.map(function(p){
    if (!p) return '';
    var strike = '';
    if (audit && Array.isArray(audit)){
      var leg = audit.find(function(a){ return p.label && String(p.label).toLowerCase().indexOf(String(a.leg).toLowerCase()) >= 0; });
      if (leg && leg.verdict === 'NOISE') strike = ' style="text-decoration:line-through;opacity:.65"';
    }
    var meas = '';
    if (audit && Array.isArray(audit)){
      var leg2 = audit.find(function(a){ return p.label && String(p.label).toLowerCase().indexOf(String(a.leg).toLowerCase()) >= 0; });
      if (leg2 && leg2.liftR !== null && leg2.nWith >= 8){
        meas = ' <span class="gsw-measured">[measured: ' + (leg2.liftR >= 0 ? '+' : '') + leg2.liftR.toFixed(2) + 'R over ' + leg2.nWith + ' — ' + leg2.verdict + ']</span>';
      }
    }
    return '<span class="gsw-tp ' + (p.pts >= 0 ? 'pos' : 'neg') + '"' + strike + '>' + (p.pts >= 0 ? '+' : '') + p.pts + ' · ' + esc(p.label) + meas + '</span>';
  }).join('') + '</div>';
}

function goldMixedFeedBannerHtml(gold){
  try{
    if (!gold || !gold.mixed) return '';
    var mixTxt = (typeof hgGoldSrcMixedLabel === 'function') ? hgGoldSrcMixedLabel(gold.src) : 'per-timeframe sources differ';
    return '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #F59E0B;border-radius:6px">'
      + '<b>MIXED FEED</b> — ' + esc(mixTxt)
      + ' · cross-timeframe alignment may compare two markets; A+ HTF leg is dark until feeds unify.</div>';
  }catch(e){ return ''; }
}

function goldBuildAPlusCtx(ctx, gold, now, newsC){
  var out = { style: 'goldswing', news: newsC, newsCaution: !!(newsC && newsC.caution), mixedFeed: !!(gold && gold.mixed) };
  try{
    if (ctx && ctx.macro){
      out.realRate = (ctx.macro.realRateMeasured && ctx.macro.realRateMeasured.measured)
        ? ctx.macro.realRateMeasured : null;
      if (!out.realRate && ctx.macro.realRateSource !== 'fred-dfii10') out.realRateFallback = ctx.macro.realRateHint;
    }
    var mcFn = gfn('hgMetalsComplex');
    if (mcFn && ctx && ctx.macro){
      out.metalsComplex = mcFn({
        dir: 'long',
        xagTrend: ctx.macro.silver ? null : null,
        dxy: ctx.macro.dxy,
        real10y: out.realRate,
        ratioTrend: ctx.macro.goldSilverRatio ? null : null
      });
    }
    out.cot = (typeof W !== 'undefined' && W) ? W.__hgGoldCot : null;
    var cashOpen = true;
    var wkFn = gfn('hgInGoldWeekend');
    if (wkFn) cashOpen = !wkFn(Math.floor((now || Date.now()) / 1000));
    var gvsFn = gfn('hgGoldVenueSpread');
    if (gvsFn && ctx && ctx.spot){
      out.goldVenueSpread = gvsFn({ spot: ctx.spot.spotPx, paxg: ctx.spot.perpPx, cashOpen: cashOpen });
    }
    if (typeof W !== 'undefined' && W && W.__hgGoldVolPack && typeof W.hgVolRegime === 'function'){
      out.volRegime = W.hgVolRegime(W.__hgGoldVolPack);
    }
    if (typeof W !== 'undefined' && W && typeof W.hgScoreRecords === 'function'){
      out.edgeRecords = W.hgScoreRecords();
    }
  }catch(e){}
  return out;
}

function goldEvalAPlusBatch(ranked, ctxPack){
  var aplusFn = gfn('hgGoldAPlus');
  if (!aplusFn) return { today: 0, nearest: null, panel: '' };
  var today = 0, nearest = null, bestMiss = -1;
  for (var i = 0; i < (ranked || []).length; i++){
    var c = ranked[i];
    if (!c || c.demoted || c.vetoed) continue;
    var edge = null;
    if (ctxPack.edgeRecords && typeof W !== 'undefined' && W.hgEdgeFor){
      edge = W.hgEdgeFor({ symbol: c.sym, side: c.dir, poiKind: c.stratKey, rr: c.rr, ts: Date.now() }, ctxPack.edgeRecords);
    }
    var apCtx = Object.assign({}, ctxPack, { edge: edge });
    c.aplusRead = aplusFn(c, apCtx);
    if (c.aplusRead && c.aplusRead.aplus) today++;
    else if (c.aplusRead && c.aplusRead.passN > bestMiss){
      bestMiss = c.aplusRead.passN;
      nearest = c.aplusRead;
    }
  }
  var panel = goldAPlusPanelHTML(today, nearest, ranked);
  return { today: today, nearest: nearest, panel: panel };
}

function goldAPlusPanelHTML(today, nearest, ranked){
  var nearCount = 0;
  for (var i = 0; i < (ranked || []).length; i++){
    var r = ranked[i] && ranked[i].aplusRead;
    if (r && !r.aplus && r.passN >= 11) nearCount++;
  }
  var h = '<div class="gsw-aplus note" style="margin:8px 0;padding:10px 12px;border:1px solid #B45309;border-radius:6px">';
  h += '<b>GOLD A+</b> · ' + today + ' today · A+ is a ~few-per-month event by construction.';
  if (nearCount) h += ' ' + nearCount + ' candidate' + (nearCount === 1 ? '' : 's') + ' at 11/13+.';
  if (nearest && nearest.soleBlocker){
    h += ' Nearest miss sole blocker: <b>' + esc(nearest.soleBlocker) + '</b>.';
  } else if (nearest && nearest.note){
    h += ' ' + esc(nearest.note);
  }
  h += '</div>';
  return h;
}

function goldApplyBestLevelsBatch(ranked, gold, atrW, now){
  var applyBlFn = gfn('hgApplyGoldBestLevels');
  var postFn = gfn('hgGoldPostApplyRefresh');
  if (!applyBlFn || !gold.rows4h || !gold.rows4h.length) return;
  for (var fi = 0; fi < ranked.length; fi++){
    var gc = ranked[fi];
    if (!gc || gc.vetoed || gc.locked) continue;
    try{
      applyBlFn(gc, {
        style: 'gold-swing',
        rows: gold.rows4h,
        rows4h: gold.rows4h,
        rows1h: gold.rows1h,
        rows1d: gold.rows1d,
        atrW: atrW,
        nowMs: now,
        rankBoost: (gc.agree || 0),
        vision: gc.vision,
      });
      if (postFn){
        postFn(gc, {
          style: 'gold-swing',
          rows: gold.rows4h,
          rows4h: gold.rows4h,
          rows1d: gold.rows1d,
        });
      }
    }catch(eGf){}
  }
}

function bannerHTML(best, ranked){
  if (!best) return '';
  var dirUp = best.dir.toUpperCase();
  var act = best.dir === 'long' ? 'BUY ZONE' : 'SELL ZONE';
  var nextTally = null;
  for (var i = 0; i < ranked.length; i++){
    if (ranked[i] && ranked[i].id !== best.id && isFinite(ranked[i].tally)){ nextTally = ranked[i].tally; break; }
  }
  var tallyTxt = isFinite(best.tally)
    ? ('confluence tally ' + (best.tally > 0 ? '+' : '') + best.tally
       + (nextTally !== null ? (' vs next best ' + (nextTally > 0 ? '+' : '') + nextTally) : ' — only candidate on the board'))
    : 'tally unavailable';
  var lock = best.locked
    ? '<div class="gsw-lock">⬤ CONVICTION LOCK — issued as of ' + esc(best.asOf || '') + '; entry/stop/targets held verbatim, never re-picked on re-scans.</div>'
    : '<div class="gsw-lock new">○ NEW CONVICTION — issued this scan at ' + esc(best.asOf || '') + '; these levels are now locked until invalidated.</div>';
  return '<div class="gsw-banner"><div class="gsw-banner-in">'
    + '<div class="gsw-eye">MOST PROBABLE SETUP</div>'
    + '<div class="gsw-dir ' + best.dir + '">' + dirUp
    + '<span>' + esc(best.strategy) + ' · ' + esc(best.venue) + (best.sym ? ' (' + esc(best.sym) + ')' : '')
    + ' · GRADE ' + esc(best.grade) + '</span></div>'
    + '<div class="gsw-plan">'
    + '<div><i>' + act + '</i><b>$' + pxF(best.zone ? best.zone.lo : best.entry) + ' – $' + pxF(best.zone ? best.zone.hi : best.entry) + '</b><u>entry $' + pxF(best.entry) + '</u></div>'
    + '<div><i>STOP</i><b>$' + pxF(best.stop) + '</b><u>4h close beyond it kills the idea</u></div>'
    + (function(){
      try{
        var vp = W.__hgGoldVolPack;
        if (vp && typeof W.hgStopVolChip === 'function'){
          var vc = W.hgStopVolChip(best.entry, best.stop, vp);
          return vc && vc.chip ? '<div class="note" style="grid-column:1/-1">' + esc(vc.chip) + '</div>' : '';
        }
      }catch(eV){}
      return '';
    })()
    + '<div><i>TP1</i><b>$' + pxF(best.t1) + '</b><u>' + fmtF(best.rr, 1) + 'R — trim / de-risk</u></div>'
    + '<div><i>TP2</i><b>$' + pxF(best.t2) + '</b><u>' + fmtF(best.rr2, 1) + 'R — swing core</u></div>'
    + '<div><i>TP3</i><b>$' + pxF(best.t3) + '</b><u>' + fmtF(best.rr3, 1) + 'R — runner</u></div>'
    + '</div>'
    + '<div class="gsw-why"><b>WHY THIS ONE LEADS</b> — ' + esc(tallyTxt) + '.</div>'
    + tallyChips(best)
    + '<div class="gsw-whyline">' + esc(best.why || '') + '</div>'
    + '<div class="gsw-inv"><b>INVALIDATION</b> — ' + esc(best.invalidates || 'a 4h close beyond the stop') + '. Hard stop $' + pxF(best.stop) + ' — never widen it.</div>'
    + lock
    + '</div></div>';
}

function cardHTML(c, isBest, season, tape){
  tape = tape || (c && c.goldTape) || '';
  var dirUp = c.dir.toUpperCase();
  var gradeCls = c.grade === 'A' ? 'ok' : '';
  var chips = (c.confluence || []).map(function(x){ return '<span class="gpip ok"' + gswPipAttr(true) + '>' + esc(x) + '</span>'; }).join('');
  if (c.oppose > 0) chips += '<span class="gpip"' + gswPipAttr(false) + '>' + c.oppose + ' opposing read' + (c.oppose === 1 ? '' : 's') + ' on the books</span>';
  var newsBanner = c.newsCaution
    ? '<div class="note warn" style="margin-top:8px">NEWS-FADE — ' + esc(c.newsStamp || '') + '</div>' : '';
  var notes = (c.notes && c.notes.length)
    ? '<div class="note" style="margin-top:6px">' + c.notes.map(esc).join(' · ') + '</div>' : '';
  var seasonLine = season ? '<div class="note" style="margin-top:6px">' + esc(season) + '</div>' : '';
  var tallyNum = isFinite(c.tally)
    ? '<span class="gsw-tallynum ' + (c.tally >= 0 ? 'up' : 'dn') + '">tally ' + (c.tally > 0 ? '+' : '') + c.tally + '</span>' : '';
  var lockLine = c.locked
    ? '<div class="gsw-lockline">⬤ CONVICTION LOCK — levels as of ' + esc(c.asOf || '') + ' (restored verbatim)</div>'
    : '<div class="gsw-lockline" style="color:#1E293B">○ new conviction issued ' + esc(c.asOf || '') + '</div>';
  var tradeOnclick = (c.sym && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(c.sym, c.dir, c.entry, c.stop, c.t1, { t2: c.t2, stack: c.stack, scanner: 'goldswing', strategy: 'goldswing' })
      : ('toTrade(' + JSON.stringify(c.sym) + ',' + JSON.stringify(c.dir) + ',' + c.entry + ',' + c.stop + ',' + c.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var tradeBtn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function' && c.sym)
    ? bookBtnHTML(c.sym, c.dir, c.entry, c.stop, c.t1, { scanner: 'goldswing', strategy: 'goldswing', klass: 'metals', fund: 'gold', t2: c.t2, stack: c.stack }) : '';
  var stackHtml = (c.stack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(c.stack) : '';
  var metaChips = '';
  if (isFinite(c.formationScore)) metaChips += '<span class="gpip ok"' + gswPipAttr(true) + '>formation ' + c.formationScore + '</span>';
  if (isFinite(c.fillProb)) metaChips += '<span class="gpip"' + gswPipAttr(false) + '>fill ~' + Math.round(c.fillProb * 100) + '%</span>';
  if (c.goldProChip) metaChips += '<span class="gpip ok"' + gswPipAttr(true) + '>' + esc(c.goldProChip) + '</span>';
  if (c.visionChip) metaChips += '<span class="gpip ok"' + gswPipAttr(true) + '>' + esc(c.visionChip) + '</span>';
  if (isFinite(c.goldMinRr)) metaChips += '<span class="gpip"' + gswPipAttr(false) + '>min ' + fmtF(c.goldMinRr, 1) + 'R</span>';
  if (c.planSrc) metaChips += '<span class="gpip"' + gswPipAttr(false) + '>' + esc(String(c.planSrc).split(' · ')[0]) + '</span>';
  if (c.goldRegime) metaChips += '<span class="gpip"' + gswPipAttr(false) + '>' + esc(c.goldRegime) + '</span>';
  if (c.entryType) metaChips += '<span class="gpip"' + gswPipAttr(false) + '>' + esc(c.entryType) + '</span>';
  var visionText = [c.visionNextBar || c.visionNextMove, c.visionPrediction].filter(function(v, i, a){
    if (!v) return false;
    if (i > 0 && v === a[0]) return false;
    return true;
  }).join(' · ');
  var visionLine = visionText
    ? '<div class="gsw-whyline"><b>VISION:</b> ' + esc(visionText) + '</div>' : '';
  /* A gate that could not be evaluated is shown as UNCHECKED. It is not a
     veto and not a pass — the reader is told the ledger is incomplete. */
  /* When an R:R leg was cleared rather than computed, say why — a blank or an
     em-dash on the card should not leave the reader guessing. */
  var rrNoteLine = c.rrNote
    ? '<div class="note" style="margin-top:6px">R:R &mdash; ' + esc(c.rrNote) + '</div>' : '';
  var uncheckedLine = (c.postGateUnchecked && !c.demoted)
    ? '<div class="note warn" style="margin-top:6px;color:#FBBF24!important"><b>&#9888; POST-GATE UNCHECKED</b> &mdash; '
      + esc((c.postGateUncheckedReasons || ['reason not recorded']).join(' &middot; '))
      + '. This setup was <b>not</b> cleared by the quality gate; it was never tested.</div>'
    : '';
  var xautBasisLine = (c.sym === 'XAUTUSD' && isFinite(c.spotRef) && isFinite(c.xautBasisPct)
    && Math.abs(c.xautBasisPct) > XAUT_SPOT_BASIS_WARN_PCT)
    ? '<div class="note warn" style="margin-top:6px;color:#FBBF24!important">XAUT instrument ~$' + pxF(c.entry)
      + ' vs spot XAU ~$' + pxF(c.spotRef) + ' (' + (c.xautBasisPct >= 0 ? '+' : '') + fmtF(c.xautBasisPct, 2)
      + '%). Levels valid on <b>Delta XAUTUSD</b> only — not spot/StarTrader XAUUSD.</div>' : '';
  return '<div class="card gsw-card ' + c.dir + (isBest ? ' best' : '') + '"' + gswSt(GSW_CARD) + '>'
    + '<div class="chead"><span class="sym"' + gswSt(GSW_SYM) + '>' + esc(c.venue) + '</span>'
    + '<span class="dir">' + dirUp + ' · <span class="gsw-grade ' + esc(c.grade) + '">GRADE ' + esc(c.grade) + '</span></span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(c.sym, c.dir, { scanner: 'goldswing', strategy: 'goldswing', klass: 'metals', fund: 'gold' }) : '')
    + '</div>'
    + '<div class="gsw-strat"' + gswSt(GSW_STRAT) + '>' + esc(c.strategy) + (isBest ? ' · ★ MOST PROBABLE' : '') + '</div>'
    + '<div class="mini"' + gswSt(GSW_MINI) + '>'
    + '<span class="k"' + gswSt(GSW_K) + '>venue</span><span' + gswSt(GSW_V) + '>' + esc(c.venue) + (c.sym ? ' · ' + esc(c.sym) : '') + '</span>'
    + '<span class="k"' + gswSt(GSW_K) + '>reads</span><span' + gswSt(GSW_V) + '>'
      + ((c.reads && isFinite(c.reads.long)) ? c.reads.long : (c.dir === 'long' && isFinite(c.agree) ? c.agree : 0))
      + ' long / '
      + ((c.reads && isFinite(c.reads.short)) ? c.reads.short : (c.dir === 'short' && isFinite(c.agree) ? c.agree : 0))
      + ' short · ' + tallyNum + '</span>'
    + '<span class="k"' + gswSt(GSW_K) + '>session</span><span' + gswSt(GSW_V) + '>' + esc(c.session || 'n/a') + ' (context — swing entries are not session-gated)</span>'
    + '<span class="k"' + gswSt(GSW_K) + '>ATR14 4h</span><span' + gswSt(GSW_V) + '>' + pxF(c.atr) + '</span>'
    + '<span class="k"' + gswSt(GSW_K) + '>R:R</span><span' + gswSt(GSW_V) + '>1 : ' + fmtF(c.rr, 1) + ' (T1) · 1 : ' + fmtF(c.rr2, 1) + ' (T2) · 1 : ' + fmtF(c.rr3, 1) + ' (T3)</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ' + gradeCls + '"' + gswPipAttr(gradeCls === 'ok') + '>GRADE ' + c.grade + '</span>'
    + goldTapeChipHtml(c, tape)
    + chips + metaChips
    + '</div>'
    + tallyChips(c)
    + '<div class="plan"' + gswSt(GSW_PLAN) + '>' + (c.dir === 'long' ? 'BUY' : 'SELL') + ' <b' + gswSt(GSW_PLAN_B) + '>$' + pxF(c.zone ? c.zone.lo : c.entry) + '–$' + pxF(c.zone ? c.zone.hi : c.entry) + '</b>'
    + ' · ENTRY <b' + gswSt(GSW_PLAN_B) + '>$' + pxF(c.entry) + '</b>'
    + ' · STOP <b' + gswSt(GSW_PLAN_B) + '>$' + pxF(c.stop) + '</b>'
    + ' · TP1 <b' + gswSt(GSW_PLAN_B) + '>$' + pxF(c.t1) + '</b> (' + fmtF(c.rr, 1) + 'R)'
    + ' · TP2 <b' + gswSt(GSW_PLAN_B) + '>$' + pxF(c.t2) + '</b> (' + fmtF(c.rr2, 1) + 'R)'
    + ' · TP3 <b' + gswSt(GSW_PLAN_B) + '>$' + pxF(c.t3) + '</b> (' + fmtF(c.rr3, 1) + 'R)'
    + '</div>'
    + ((typeof hgStrategyTradeDetailHtml === 'function') ? hgStrategyTradeDetailHtml(c) : '')
    + (c.why ? '<div class="gsw-whyline"' + gswSt(GSW_WHY) + '>' + esc(c.why) + '</div>' : '')
    + visionLine
    + (c.invalidates ? '<div class="gsw-invline"><b>INVALIDATES:</b> ' + esc(c.invalidates) + '</div>' : '')
    + rrNoteLine
    + uncheckedLine
    + xautBasisLine
    + lockLine
    + newsBanner + notes + seasonLine
    + stackHtml
    + tradeBtn
    + bookBtn
    + '</div>';
}

function rejectedHTML(rejected){
  if (!rejected || !rejected.length) return '';
  var rows = rejected.map(function(r){
    if (!r) return '';
    return '<div class="gsw-hrow rej"><b>✕ HELD BACK</b> · ' + esc(r.strategy || 'SETUP')
      + (r.dir ? ' · ' + esc(String(r.dir).toUpperCase()) : '')
      + (r.venue ? ' · ' + esc(r.venue) : '')
      + ' — ' + esc(r.reason || 'failed a quality gate') + '</div>';
  }).join('');
  return '<div class="gsw-hist"><div class="gsw-hhead">CONFLUENCE GATES — triggers without enough agreement, every reason named (never silently dropped)</div>' + rows + '</div>';
}

function historyHTML(history){
  if (!history || !history.length) return '';
  var rows = history.map(function(h){
    if (!h) return '';
    var icon = h.status === 'STOPPED' ? '✕' : (h.status === 'TARGET HIT' ? '✓' : '⏱');
    var cls = h.status === 'STOPPED' ? 'stopped' : (h.status === 'TARGET HIT' ? 'target' : 'expired');
    var when = '';
    try{ when = new Date(h.closedAt || h.issuedAt).toISOString().slice(11, 16) + ' UTC'; }catch(e){}
    return '<div class="gsw-hrow ' + cls + '"><b>' + icon + ' ' + esc(h.status) + '</b> · '
      + esc(String(h.dir || '').toUpperCase()) + ' · ' + esc(h.strategy || '') + ' · ' + esc(h.venue || '')
      + ' · entry $' + pxF(h.entry) + ' · stop $' + pxF(h.stop) + ' · TP1 $' + pxF(h.t1)
      + (isFinite(h.closePrice) ? ' · closed near $' + pxF(h.closePrice) : '')
      + ' · ' + esc(when) + '</div>';
  }).join('');
  return '<div class="gsw-hist"><div class="gsw-hhead">CONVICTION HISTORY — closed setups, never silently dropped</div>' + rows + '</div>';
}

/* FORMING NOW — what the engine is watching: per-strategy per-venue
   ARMED/IDLE rows with the exact live trigger condition + real level from
   buildWatch (same detector math as the candidates). Armed setups are
   watch items, NOT entries. */
function formingNowHTML(armed){
  if (typeof hgGoldFormingWatchHTML === 'function'){
    return hgGoldFormingWatchHTML(armed);
  }
  if (typeof hgFormingWatchHTML === 'function'){
    var items = (armed || []).map(function(w){
      if (!w) return null;
      return {
        state: w.state,
        sym: w.venue || 'GOLD',
        strategy: w.strategy || 'SETUP',
        condition: w.state === 'armed' ? (w.condition || 'watching') : (w.reason || w.condition || 'no trigger in range'),
        level: w.level
      };
    }).filter(Boolean);
    return hgFormingWatchHTML(items, { title: 'FORMING NOW', subtitle: 'armed setups are watch items, not entries' });
  }
  if (!armed || !armed.length) return '';
  var rows = armed.map(function(w){
    if (!w) return '';
    var st = w.state === 'armed' || w.state === 'promoted';
    var cls = w.state === 'promoted' ? 'promoted' : (st ? 'armed' : 'idle');
    var lvlNum = (typeof w.level === 'number' && isFinite(w.level));
    return '<div class="gsw-wrow ' + cls + '">'
      + '<span class="gsw-wst">' + (w.state === 'promoted' ? 'PROMOTED' : (st ? 'ARMED' : 'IDLE')) + '</span>'
      + '<b>' + esc(w.strategy || 'SETUP') + '</b>'
      + (w.venue ? ' · ' + esc(w.venue) : '')
      + (lvlNum ? ' · $' + pxF(w.level) : '')
      + ' — ' + esc(w.state === 'promoted' ? (w.promoteNote || 'trigger fired — see candidate card')
              : (st ? (w.condition || 'watching') : (w.reason || w.condition || 'no trigger in range')))
      + '</div>';
  }).join('');
  return '<div class="gsw-hist gsw-watch"><div class="gsw-hhead">FORMING NOW — what the engine is watching'
    + ' <span style="opacity:.65">(armed setups are watch items, not entries)</span></div>' + rows + '</div>';
}

/* nearest armed trigger across venues, distance in $ and ATR(4h) */
function nearestArmed(armed, watchMeta){
  var best = null;
  for (var i = 0; i < (armed || []).length; i++){
    var w = armed[i];
    if (!w || w.state !== 'armed' || !(typeof w.level === 'number' && isFinite(w.level))) continue;
    var m = watchMeta ? watchMeta[w.venue] : null;
    if (!m || !isFinite(m.lastClose)) continue;
    var dist = Math.abs(w.level - m.lastClose);
    if (!best || dist < best.dist){
      best = { strategy: w.strategy, venue: w.venue, level: w.level, dist: dist,
               distAtr: (isFinite(m.atr) && m.atr > 0) ? dist/m.atr : NaN };
    }
  }
  return best;
}

/* WHY SILENT — the single honest lead reason a scan produced zero qualifying
   candidates. Precedence: news window > feeds failed > live convictions >
   nearest armed trigger. ICT killzones are deliberately NOT a case here —
   they are intraday context, never a swing gate. The nearest-armed tail is
   appended whenever it isn't itself the lead and watch data exists. */
function whySilentText(o){
  var lead = null;
  if (o.newsCaution) lead = 'high-impact news window ±30 min' + (o.newsTitle ? ' — ' + o.newsTitle : '')
    + ': fade risk — new reads held for the release';
  else if (o.feedsFailed) lead = 'feeds failed — no 4h klines from any source (macro chain + PAXGUSDT + Delta all quiet)';
  else if (o.liveN > 0) lead = o.liveN + ' live conviction' + (o.liveN === 1 ? '' : 's')
    + ' already locked — re-confirmations, not new issuance';
  var near = nearestArmed(o.armed, o.watchMeta);
  var tail = null;
  if (near){
    tail = 'nearest armed trigger: ' + near.strategy + (near.venue ? ' (' + near.venue + ')' : '')
      + ' at $' + pxF(near.level) + ' — $' + pxF(near.dist)
      + (isFinite(near.distAtr) ? ' (' + fmtF(near.distAtr, 1) + '×ATR(4h)) away' : ' away');
  }
  if (!lead) lead = tail ? tail : 'no qualifying setups — the board is flat';
  else if (tail) lead = lead + ' · ' + tail;
  return lead;
}
function whySilentHTML(ws){
  return '<div class="gsw-silent"><b>WHY SILENT</b> — ' + esc(ws) + '</div>';
}

function goldWeekendPanelHTML(ro){
  if (!ro || (!ro.headline && !ro.detail)) return '';
  var lvl = ro.level || 'muted';
  return '<div class="gsw-weekend gsw-weekend-' + lvl + '"><b>WEEKEND EXPOSURE</b> — ' + esc(ro.headline)
    + (ro.detail ? '<div class="gsw-weekend-detail">' + esc(ro.detail) + '</div>' : '') + '</div>';
}
function paintGoldWeekendPanel(ui, rows, nowMs, bestCandidate){
  if (!ui || !ui.weekend) return;
  try{
    var roFn = gfn('hgGoldWeekendReadout');
    if (!roFn || !rows || !rows.length){ ui.weekend.style.display = 'none'; ui.weekend.innerHTML = ''; return; }
    var aArr = _atr(rows, 14);
    var atrVal = (aArr && aArr.length) ? aArr[aArr.length - 1] : NaN;
    var stopAtr = 1.5;
    if (bestCandidate && isFinite(bestCandidate.entry) && isFinite(bestCandidate.stop)
        && isFinite(atrVal) && atrVal > 0){
      stopAtr = Math.abs(bestCandidate.entry - bestCandidate.stop) / atrVal;
    }
    var ro = roFn(rows, atrVal, stopAtr, Math.floor((nowMs || Date.now()) / 1000));
    var html = goldWeekendPanelHTML(ro);
    ui.weekend.innerHTML = html;
    ui.weekend.style.display = html ? '' : 'none';
  }catch(e){
    ui.weekend.style.display = 'none';
    ui.weekend.innerHTML = '';
  }
}

/* ---------------- data legs (each catch-isolated) ---------------- */
async function fetchGoldKlines(){
  var out = { rows4h: [], rows1d: [], src: {}, mixed: false, source: null, xmSymbol: null };
  var srcSet = function(tf, source, rowsKey, rows){
    if (typeof hgGoldSrcAssign === 'function'){ hgGoldSrcAssign(out, tf, source, rowsKey, rows); return; }
    if (!rows || !rows.length || !source) return;
    out[rowsKey] = rows;
    out.src[tf] = source;
  };
  var xgc = gfn('getXmGoldCandles');
  if (xgc){
    try{
      var xa = await xgc('4h', KL_4H);
      if (xa && xa.rows && xa.rows.length){ srcSet('4h', xa.source || 'xm-xauusd', 'rows4h', xa.rows); out.xmSymbol = xa.symbol || 'XAUUSD'; }
    }catch(eXm){}
    if (!out.rows1d.length){
      try{
        var xb = await xgc('1d', KL_1D);
        if (xb && xb.rows && xb.rows.length) srcSet('1d', xb.source || 'xm-xauusd', 'rows1d', xb.rows);
      }catch(eXm2){}
    }
  }
  var ggc = gfn('getGoldCandles');
  if (ggc){
    if (!out.rows4h.length){
      try{ var a = await ggc('4h', KL_4H); if (a && a.rows && a.rows.length) srcSet('4h', a.source, 'rows4h', a.rows); }catch(e){}
    }
    if (!out.rows1d.length){
      try{ var b = await ggc('1d', KL_1D); if (b && b.rows && b.rows.length) srcSet('1d', b.source, 'rows1d', b.rows); }catch(e2){}
    }
  }
  if (!out.rows4h.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '4h', KL_4H); if (p && p.length) srcSet('4h', 'binance-paxg', 'rows4h', p); }catch(e3){}
      try{ var q = await bk('PAXGUSDT', '1d', KL_1D); if (q && q.length) srcSet('1d', 'binance-paxg', 'rows1d', q); }catch(e4){}
    }
  }
  if (typeof hgGoldSrcFinalize === 'function') return hgGoldSrcFinalize(out, '4h');
  var prov = [];
  Object.keys(out.src).forEach(function(k){ if (out.src[k] && prov.indexOf(out.src[k]) < 0) prov.push(out.src[k]); });
  out.mixed = prov.length > 1;
  out.source = out.src['4h'] || out.src['1d'] || prov[0] || null;
  return out;
}

/* StarTrader / XM XAUUSD CFD — XM MT5 bridge first, then spot proxy chain. */
async function fetchStartraderGoldKlines(){
  var out = await fetchGoldKlines();
  if (!out.source) out.source = 'xm-xauusd';
  return out;
}

/* Delta XAUTUSD perp leg — only when the xuniverse layer exists and lists it */
async function fetchDeltaXaut(){
  var out = { rows4h: [], rows1d: [], item: null };
  var xu = gfn('xuUniverse'), xc = gfn('xuCandles');
  if (!xu || !xc) return out;
  var uni = null;
  try{ uni = await xu(); }catch(e){ uni = null; }
  if (!Array.isArray(uni) || !uni.length) return out;
  var item = null;
  for (var i = 0; i < uni.length; i++){
    var it = uni[i];
    if (!it) continue;
    if ((it.base === 'XAUT' || it.sym === 'XAUTUSD') && it.exchange === 'delta'){ item = it; break; }
  }
  if (!item) return out;
  out.item = item;
  try{ var a = await xc(item, '4h', KL_4H); if (a && a.length) out.rows4h = a; }catch(e2){}
  try{ var b = await xc(item, '1d', KL_1D); if (b && b.length) out.rows1d = b; }catch(e3){}
  return out;
}

/* ============================ SWING STRATEGY ENGINE ============================ */
var SW_NAME = {
  pullback: '4H TREND PULLBACK (EMA50/200)',
  wkbreak:  'WEEKLY RANGE BREAKOUT',
  ob:       '4H ORDER BLOCK RETEST',
  macro:    'MACRO-ALIGNED TREND CONTINUATION',
  sweep:    '4H LIQUIDITY SWEEP REVERSAL',
  fvg:      '4H FVG FILL',
  bos:      '4H BOS / CHOCH ALIGNMENT',
  ribbon:   '4H EMA RIBBON PULLBACK',
  vpbook:   'VP PLAYBOOK AMD (ENTER/WAIT)',
  p4nr7:    'S12 NR7 / RANGE CONTRACTION BREAKOUT',
  p4adrx:   'S14 ADR EXHAUSTION FADE (PART4)',
  p4laf:    'S17 LOOK-ABOVE-AND-FAIL',
  p5wyck:   'S19 WYCKOFF SPRING/UPTHRUST TEST',
  p5turt:   'S20 TURTLE-SOUP FAILED EXTREME',
  p5vwap:   'S22 SESSION VWAP 2σ REVERSION',
  p5drive:  'S24 THREE-DRIVE EXHAUSTION',
  p5news:   'S27 POST-NEWS SPIKE FADE',
  p6comp:   'S30 SESSION-COMPOSITE PULLBACK',
  p6zfade:  'S33 Z-SCORE MEAN REVERSION',
  p6smt:    'S36 SMT-CONFIRMED SWEEP (vs DXY)',
  p6fail:   'S37 FAILED-SWEEP CONTINUATION',
  p7ratio:  'S43 GOLD/SILVER RATIO PAIR',
  p7gap:    'S40 MCX OPEN-GAP FADE (MCX-NATIVE)',
  p8resid:  'S51 MACRO-RESIDUAL MOMENTUM',
  p8range:  'S52 RANGE-BAR S0 SWEEP',
  p8geo:    'S53 GEOPOLITICAL SPIKE FADE',
  p8vpinbo: 'S54 VPIN-TIMED CONTRACTION BREAK',
  p9volbar: 'S62 VOLUME-BAR S0 SWEEP',
  p9prem:   'S65 PERP-PREMIUM FADE'
};
var SW_NEWS_STAMP = 'NEWS WINDOW — expect a fade around the release; swing levels unchanged (size accordingly)';

/* swing risk model: stop 1.5-2x ATR14(4h), never tighter, extended beyond
   the structure when wider (capped 2x); targets fixed at 1.5R / 2.5R / 4R. */
/* Gold risk model: the stop goes BEHIND the level that invalidates the idea.

   This used to hard-cap the stop at 2xATR14(4h), whatever the structure said:

     var want = d + 0.25*a;
     if (want > 2*a) want = 2*a;          // truncated, regardless of structure

   Gold routinely travels 2-3 ATR through a session open or a release, so on
   ~71% of setups the cap bound and the stop was placed ~42% short of the
   level that would actually prove the trade wrong — inside ordinary noise.
   The note even read "stop beyond structure ... capped 2x", which describes
   a stop past the structure while placing one in front of it.

   Truncating the stop does not reduce risk, it relocates it: the loss is
   smaller but far likelier, and the 1.5R/2.5R/4R ladder is then measured
   against a risk that never reached invalidation, so the R:R on the card
   overstates the trade.

   The stop now clears the structure. MAX is a sanity ceiling for broken
   structure, not a risk policy — beyond it the geometry is not a stop but a
   different trade, and the R:R gate declines it on its own. Position size
   follows from the wider risk, so the dollars risked are unchanged. */
function __swLevels(dir, entry, a4, structStop, snapLvls){
  var GOLD_STOP_MAX_ATR = 4.0;
  var stopDist = 1.5*a4, stopNote = 'stop 1.5×ATR14(4h)';
  if (isFinite(structStop)){
    var d = (dir === 'long') ? (entry - structStop) : (structStop - entry);
    if (d > 0){
      var want = d + 0.25*a4;
      if (want > GOLD_STOP_MAX_ATR*a4) want = GOLD_STOP_MAX_ATR*a4;
      if (want > stopDist){
        stopDist = want;
        stopNote = 'stop BEHIND structure ' + structStop.toFixed(2) + ' (' + (stopDist/a4).toFixed(2) + '×ATR14(4h))'
          + (want >= GOLD_STOP_MAX_ATR*a4 ? ' — at the ' + GOLD_STOP_MAX_ATR + '× sanity ceiling, structure may be broken' : '');
      }
    }
  }
  var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
  var risk = stopDist;
  var gT1 = (typeof HG_GOLD_T1_R === 'number') ? HG_GOLD_T1_R : 1.5;
  var gT2 = (typeof HG_GOLD_T2_R === 'number') ? HG_GOLD_T2_R : 2.5;
  var gT3 = (typeof HG_GOLD_T3_R === 'number') ? HG_GOLD_T3_R : 4.0;
  var t1 = (dir === 'long') ? entry + gT1*risk : entry - gT1*risk;
  var t2 = (dir === 'long') ? entry + gT2*risk : entry - gT2*risk;
  var t3 = (dir === 'long') ? entry + gT3*risk : entry - gT3*risk;
  if (snapLvls && snapLvls.length){
    var bestLvl = NaN, bestR = Infinity, si;
    for (si = 0; si < snapLvls.length; si++){
      var L = snapLvls[si];
      if (!isFinite(L)) continue;
      var onSide = (dir === 'long') ? (L > entry && L < t1) : (L < entry && L > t1);
      if (!onSide) continue;
      var rL = Math.abs(L - entry)/risk;
      if (rL < bestR){ bestR = rL; bestLvl = L; }
    }
    if (isFinite(bestLvl)){
      t1 = bestLvl;
      stopNote += '; TP1 snapped to opposing structure ' + bestLvl.toFixed(2);
    }
  }
  var rr1 = Math.abs(t1 - entry)/risk;
  return { stop: stop, t1: t1, t2: t2, t3: t3,
           rr: rr1, rr2: Math.abs(t2 - entry)/risk, rr3: Math.abs(t3 - entry)/risk,
           stopNote: stopNote, targetPolicy: 'gold ladder ' + gT1 + 'R/' + gT2 + 'R/' + gT3 + 'R (structure-native TP1)' };
}

function __swSnapLvls(sw, ob, entry, dir){
  var out = [];
  try{
    if (sw){
      var L = (dir === 'long') ? (sw.highSweep ? sw.highSweep.level : NaN)
                               : (sw.lowSweep ? sw.lowSweep.level : NaN);
      if (isFinite(L)) out.push(L);
    }
    if (ob){
      var zones = (dir === 'long') ? ob.bearish : ob.bullish;
      var zi, edge;
      for (zi = 0; zi < zones.length; zi++){
        edge = (dir === 'long') ? zones[zi].bottom : zones[zi].top;
        if (isFinite(edge) && ((dir === 'long' && edge > entry) || (dir === 'short' && edge < entry))) out.push(edge);
      }
    }
  }catch(e){}
  return out;
}

function __swEntryFromZone(dir, mark, zone, anchor){
  try{
    dir = (dir === 'short') ? 'short' : 'long';
    mark = +mark;
    if (!isFinite(mark)) return { entry: NaN, inZone: false };
    var entry = mark, inZone = true;
    if (zone && isFinite(zone.lo) && isFinite(zone.hi)){
      if (mark >= zone.lo && mark <= zone.hi){ entry = mark; inZone = true; }
      else if (isFinite(anchor)){
        entry = anchor;
        if (dir === 'long' && mark > zone.hi) entry = Math.min(anchor, zone.hi);
        else if (dir === 'short' && mark < zone.lo) entry = Math.max(anchor, zone.lo);
        inZone = false;
      } else {
        entry = (dir === 'long') ? (mark > zone.hi ? zone.hi : zone.lo) : (mark < zone.lo ? zone.lo : zone.hi);
        inZone = false;
      }
    }
    return { entry: entry, inZone: inZone };
  }catch(e){ return { entry: mark, inZone: true }; }
}

/* per-venue candidate composition. Every detector is feature-checked and
   read-only; triggers without enough agreement ride the .rejected side-
   channel with the reason named. */
function buildCandidates(leg, nowMs, newsC, macro, sessionTxt, venue, sym, microOpts){
  var out = [];
  out.rejected = [];
  microOpts = microOpts || {};
  try{
    var rows4 = __rows(leg.rows4h);
    if (!rows4 || rows4.length < MIN_4H) return out;
    var n = rows4.length;
    var a4 = __last(_atr(rows4, 14));
    if (!isFinite(a4) || !(a4 > 0)) return out;
    var entry = rows4[n-1].c;
    if (!isFinite(entry) || !(entry > 0)) return out;
    var rows1d = __rows(leg.rows1d);

    /* ---- shared evidence ledger: every read names itself with real numbers ---- */
    var reads = [], notes = [];
    function add(side, tag, label){ reads.push({ side: side, tag: tag, label: label }); }
    var i, z;

    /* 4h trend stack (EMA50/200) */
    var c4 = __closes(rows4);
    var e50_4 = __last(_ema(c4, 50)), e200_4 = __last(_ema(c4, 200));
    var trend4 = null;
    if (isFinite(e50_4) && isFinite(e200_4)){
      if (entry > e50_4 && e50_4 > e200_4) trend4 = 'bull';
      else if (entry < e50_4 && e50_4 < e200_4) trend4 = 'bear';
    }
    if (trend4 === 'bull') add('long', 'trend4h', '4h uptrend — price above EMA50 ' + e50_4.toFixed(2) + ' stacked over EMA200 ' + e200_4.toFixed(2));
    else if (trend4 === 'bear') add('short', 'trend4h', '4h downtrend — price below EMA50 ' + e50_4.toFixed(2) + ' stacked under EMA200 ' + e200_4.toFixed(2));

    /* daily trend stack (1d EMA50/200) */
    var e50_1 = NaN, e200_1 = NaN, trend1 = null;
    if (rows1d && rows1d.length >= 60){
      var c1 = __closes(rows1d);
      e50_1 = __last(_ema(c1, 50)); e200_1 = __last(_ema(c1, 200));
      var dClose = c1[c1.length - 1];
      if (isFinite(e50_1) && isFinite(e200_1) && isFinite(dClose)){
        if (dClose > e50_1 && e50_1 > e200_1) trend1 = 'bull';
        else if (dClose < e50_1 && e50_1 < e200_1) trend1 = 'bear';
      }
      if (trend1 === 'bull') add('long', 'trend1d', 'daily uptrend — EMA50 ' + e50_1.toFixed(2) + ' stacked over EMA200 ' + e200_1.toFixed(2));
      else if (trend1 === 'bear') add('short', 'trend1d', 'daily downtrend — EMA50 ' + e50_1.toFixed(2) + ' stacked under EMA200 ' + e200_1.toFixed(2));
      else if (!isFinite(e200_1)) notes.push('daily context partial (' + rows1d.length + ' 1d bars — 200-EMA needs 200) — swing reads lean on the 4h');
    } else {
      notes.push('daily context unavailable (' + (rows1d ? rows1d.length : 0) + ' 1d bars) — swing reads lean on the 4h alone');
    }

    /* weekly-anchored VWAP on 4h bars (goldind.js, read-only) */
    var vw = null, vwapFn = gfn('goldVWAP');
    if (vwapFn){
      var wAnchor = __weekAnchorIndex(rows4);
      if (wAnchor >= 0 && wAnchor < n){
        try{ vw = vwapFn(rows4, wAnchor); }catch(eV){ vw = null; }
        if (vw){
          if (vw.pos === 'ABOVE') add('long', 'vwapw', 'holding above the week\u2019s anchored VWAP ' + vw.value.toFixed(2));
          else if (vw.pos === 'BELOW') add('short', 'vwapw', 'capped below the week\u2019s anchored VWAP ' + vw.value.toFixed(2));
        }
      }
    } else notes.push('goldVWAP unavailable (goldind.js) — weekly VWAP evidence skipped');

    /* 4h order blocks (goldind.js, read-only) */
    var ob = null, obFn = gfn('goldOrderBlocks');
    if (obFn){ try{ ob = obFn(rows4); }catch(eO){ ob = null; } }
    if (ob){
      var tol = 0.5*a4;
      for (i = 0; i < ob.bullish.length; i++){
        z = ob.bullish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){ add('long', 'ob4h', 'inside the unmitigated bullish 4h order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
      }
      for (i = 0; i < ob.bearish.length; i++){
        z = ob.bearish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){ add('short', 'ob4h', 'inside the unmitigated bearish 4h order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
      }
    } else if (!obFn) notes.push('goldOrderBlocks unavailable (goldind.js) — order-block evidence skipped');

    /* 4h FVG imbalance (goldind.js, read-only) — V2: HVN defends gap when profile is wide */
    var fvg = null, fvgFn = gfn('goldFVG');
    if (fvgFn){ try{ fvg = fvgFn(rows4); }catch(eF){ fvg = null; } }
    var vprof4 = null, hvnFn = gfn('goldFVGHasHVNSupport'), vpFn = gfn('goldVolumeProfile');
    if (vpFn){ try{ vprof4 = vpFn(rows4, 100, 50); }catch(eVp){ vprof4 = null; } }
    var vpOk4 = vprof4 && isFinite(vprof4.maxPrice) && isFinite(vprof4.minPrice)
      && (vprof4.maxPrice - vprof4.minPrice) >= 2.5*a4;
    if (fvg && fvg.length){
      var g = fvg[0];
      if (g.age <= 25){
        var fvgOk = !vpOk4 || (hvnFn && hvnFn(g, vprof4));
        if (fvgOk){
          if (g.dir === 'bullish' && entry >= g.bottom){
            add('long', 'fvg4h', 'unmitigated 4h FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2)
                + ' holding below price' + (vpOk4 ? ' — HVN defends the gap' : ''));
          } else if (g.dir === 'bearish' && entry <= g.top){
            add('short', 'fvg4h', 'unmitigated 4h FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2)
                + ' capping above price' + (vpOk4 ? ' — HVN defends the gap' : ''));
          }
        }
      }
    } else if (!fvgFn) notes.push('goldFVG unavailable (goldind.js) — imbalance evidence skipped');

    /* 4h liquidity sweeps (goldind.js, read-only) — V2: volume climax on sweep bar */
    var sw = null, swFn = gfn('goldSweeps');
    var volFn = gfn('goldVolumeSpike');
    if (swFn){ try{ sw = swFn(rows4); }catch(eS){ sw = null; } }
    if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
      var swIdx4 = n - 1 - sw.barsAgo;
      var swVol4 = !volFn || (swIdx4 >= 0 && volFn(rows4, swIdx4, 20, 1.5));
      if (swVol4){
        if (sw.dir === 'bullish'){
          add('long', 'sweep4h', '4h liquidity sweep of ' + sw.level.toFixed(2) + ' + reclaim (' + sw.barsAgo + 'b ago) — volume-validated');
        } else {
          add('short', 'sweep4h', '4h liquidity sweep of ' + sw.level.toFixed(2) + ' + rejection (' + sw.barsAgo + 'b ago) — volume-validated');
        }
      }
    } else if (!swFn) notes.push('goldSweeps unavailable (goldind.js) — sweep evidence skipped');

    /* 4h fractal BOS / CHOCH + OB zone eval (HardgateGoldEngine.evaluateSwing) */
    var ms4 = null, obRetest4 = null, swingEval = null;
    var engFn = gfn('HardgateGoldEngine');
    if (engFn && typeof engFn.evaluateSwing === 'function'){
      try{
        var swingCtx = { atr4: a4, nearestStructure: null, entry: entry };
        if (microOpts.us10yCandles) swingCtx.us10yCandles = microOpts.us10yCandles;
        if (microOpts.tickBuffer) swingCtx.tickBuffer = microOpts.tickBuffer;
        if (microOpts.l2OrderBook) swingCtx.l2OrderBook = microOpts.l2OrderBook;
        if (isFinite(microOpts.domDepth)) swingCtx.domDepth = microOpts.domDepth;
        swingEval = engFn.evaluateSwing(rows4, swingCtx);
        ms4 = swingEval.structure;
        obRetest4 = swingEval.obSetup;
      }catch(eEng){ /* skip */ }
    } else {
      var swFn2 = gfn('goldSwings'), msFn = gfn('goldMarketStructure');
      var updateFn = gfn('goldUpdateActiveZones'), retestFn = gfn('goldOrderBlockRetest');
      if (swFn2 && msFn){
        try{
          var sw4 = swFn2(rows4, 5, 5);
          ms4 = msFn(rows4, sw4, 5, 5);
          if (updateFn && retestFn){
            updateFn(rows4, n - 1, a4);
            obRetest4 = retestFn(rows4, n - 1, ms4);
          }
        }catch(eMs){ /* skip */ }
      }
    }
    if (ms4 && ms4.bos && isFinite(ms4.level)){
      if (ms4.trend === 'bullish'){
        add('long', 'bos', '4h fractal BOS bullish — close above swing high ' + ms4.level.toFixed(2));
      } else if (ms4.trend === 'bearish'){
        add('short', 'bos', '4h fractal BOS bearish — close below swing low ' + ms4.level.toFixed(2));
      }
    } else if (ms4 && ms4.choch && isFinite(ms4.level)){
      if (ms4.trend === 'bullish'){
        add('long', 'choch', '4h fractal CHOCH bullish — shift above swing high ' + ms4.level.toFixed(2));
      } else if (ms4.trend === 'bearish'){
        add('short', 'choch', '4h fractal CHOCH bearish — shift below swing low ' + ms4.level.toFixed(2));
      }
    }

    /* prior week high/low from real 1d bars */
    var wk = __weeklyRange(rows1d);
    if (!wk) notes.push('prior-week range unavailable (need >=3 daily bars in the prior ISO week) — weekly-breakout strategy offline');

    /* ---- candidate assembly ---- */
    var seen = {};
    function push(c){
      if (!c) return;
      if (c.dropped){ out.rejected.push(c); return; }
      if (!seen[c.id]){ seen[c.id] = true; out.push(c); }
    }
    function bindPart(cand, hit, partLabel){
      var bindFn = gfn('hgGoldBindEnginePlan');
      var bound = bindFn ? bindFn(cand, hit, {
        atr: a4, mark: entry, venue: venue, sym: sym, session: sessionTxt,
        strategy: SW_NAME[hit.key] || hit.key,
        stamps: [partLabel]
      }) : (cand && !cand.dropped ? cand : null);
      if (!bound) return null;
      if (!Array.isArray(bound.stamps)) bound.stamps = [];
      if (bound.stamps.indexOf(partLabel) < 0) bound.stamps.push(partLabel);
      return bound;
    }
    function ledger(dir, triggerRead){
      var longEv = [], shortEv = [], j;
      for (j = 0; j < reads.length; j++) (reads[j].side === 'long' ? longEv : shortEv).push(reads[j]);
      if (triggerRead) (dir === 'long' ? longEv : shortEv).push(triggerRead);
      return { mine: (dir === 'long') ? longEv : shortEv,
               oppose: (dir === 'long') ? shortEv.length : longEv.length,
               counts: { long: longEv.length, short: shortEv.length } };
    }
    function mkCand(key, dir, anchor, structStop, zone, why, invalidates, triggerRead){
      try{
        var L = ledger(dir, triggerRead);
        var id = key + '|' + dir + '|' + Math.round(anchor);
        if (L.mine.length < 2 || L.mine.length <= L.oppose){
          return { dropped: true, id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
                   venue: venue, sym: sym,
                   reason: 'trigger fired but confluence insufficient — ' + L.mine.length + ' agreeing vs '
                           + L.oppose + ' opposing read(s) (need >= 2 agreeing and a majority)' };
        }
        var hint = (macro && typeof macro === 'object') ? macro.realRateHint : null;
        if (hint === 'HEADWIND' && trend1 === 'bull' && dir === 'long'){
          return { dropped: true, id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
                   venue: venue, sym: sym,
                   reason: 'macro headwind against the daily bull stack — long setup suppressed (real-rate backdrop favors shorts)' };
        }
        if (hint === 'TAILWIND' && trend1 === 'bear' && dir === 'short'){
          return { dropped: true, id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
                   venue: venue, sym: sym,
                   reason: 'macro tailwind against the daily bear stack — short setup suppressed (real-rate backdrop favors longs)' };
        }
        var mvFn = gfn('__swMicroVeto');
        if (mvFn){
          var mv = mvFn(dir, key, swingEval, microOpts);
          if (mv){
            return { dropped: true, id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
                     venue: venue, sym: sym, reason: mv.reason || 'microstructure veto' };
          }
        }
        var mark = entry;
        var entRef = __swEntryFromZone(dir, mark, zone, anchor);
        var useEntry = entRef.entry;
        if (!isFinite(useEntry) || !(useEntry > 0)) return null;
        var snapLvls = (key === 'wkbreak' || key === 'macro' || key === 'pullback')
          ? [] : __swSnapLvls(sw, ob, useEntry, dir);
        var lv = __swLevels(dir, useEntry, a4, structStop, snapLvls);
        var swBuildMinRr = 1.2;
        if (lv.rr < swBuildMinRr){
          return { dropped: true, id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
                   venue: venue, sym: sym,
                   reason: 'structure too close — R:R insufficient (' + lv.rr.toFixed(1) + 'R < '
                           + swBuildMinRr.toFixed(1) + 'R minimum)' };
        }
        var gradeFn = gfn('hgGoldGradeFromScore');
        var grade = gradeFn ? gradeFn(L.mine.length, !!(newsC && newsC.caution))
          : ((L.mine.length >= 8) ? 'A' : ((L.mine.length >= 5) ? 'B' : 'C'));
        if (newsC && newsC.caution && !gradeFn){
          if (grade === 'A') grade = 'B';
          else if (grade === 'B') grade = 'C';
        }
        var conf = [];
        for (var j = 0; j < L.mine.length; j++) conf.push(L.mine[j].label);
        var cand = {
          id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
          entry: useEntry, pxNow: mark, mark: mark, stop: lv.stop, t1: lv.t1, t2: lv.t2, t3: lv.t3,
          structStop: structStop, snapLvls: snapLvls,
          rr: lv.rr, rr2: lv.rr2, rr3: lv.rr3,
          grade: grade, confluence: conf, agree: L.mine.length, oppose: L.oppose,
          reads: L.counts,
          session: sessionTxt || 'n/a',
          newsCaution: !!(newsC && newsC.caution),
          newsStamp: (newsC && newsC.caution) ? SW_NEWS_STAMP + (newsC.title ? ' (' + newsC.title + ')' : '') : null,
          atr: a4, anchor: anchor, stopFloorAtr: 1.5,
          zone: zone || { lo: entry - 0.25*a4, hi: entry + 0.25*a4 },
          why: why, invalidates: invalidates,
          notes: notes.concat([lv.stopNote]),
          venue: venue, sym: sym
        };
        var filt = gfn('hgGoldInstFilter');
        if (filt){
          cand = filt(cand, {
            rows: rows4, nowMs: nowMs, scalp: false, hardReject: false,
            macro: macro,
            news: (microOpts && microOpts.news) || null,
            rows4h: rows4,
            rows1d: rows1d,
            l2OrderBook: microOpts && microOpts.l2OrderBook,
            spreadUsd: microOpts && microOpts.spreadUsd,
            bid: microOpts && microOpts.bid,
            ask: microOpts && microOpts.ask
          }) || cand;
        }
        /* Replay edge + plan-side geometry (prefer fee-survivors; demote toxic; reject wrong-side stops). */
        var edgeFn = gfn('hgGoldSetupEdgeApply');
        if (edgeFn) edgeFn(cand, { swing: true });
        return cand;
      }catch(e){ return null; }
    }

    /* 1) 4h trend pullback to the EMA50/EMA200 confluence */
    if (trend4 && isFinite(e50_4) && Math.abs(entry - e50_4) <= 0.75*a4){
      var pdir = (trend4 === 'bull') ? 'long' : 'short';
      push(mkCand('pullback', pdir, e50_4, e200_4,
        { lo: e50_4 - 0.25*a4, hi: e50_4 + 0.25*a4 },
        (pdir === 'long' ? 'uptrend' : 'downtrend') + ' on the 4h (EMA50 ' + e50_4.toFixed(2)
          + (pdir === 'long' ? ' above ' : ' below ') + 'EMA200 ' + e200_4.toFixed(2)
          + ') pulling back into the 50-EMA value zone — trend-continuation entry at the moving-average shelf',
        'a 4h close ' + (pdir === 'long' ? 'below' : 'above') + ' the 200-EMA ' + e200_4.toFixed(2)
          + ' breaks the trend structure that justifies the entry',
        { side: pdir, tag: 'pullback', label: 'pullback into the 4h 50-EMA ' + e50_4.toFixed(2)
          + ' (within 0.75×ATR) inside a ' + trend4.toLowerCase() + ' EMA50/200 stack' }));
    }

    /* 2) weekly-range breakout: prior week high/low swept + reclaimed, or
       broken with displacement */
    if (wk){
      var rec = null;
      var rStart = Math.max(0, n - 11);
      for (i = rStart; i < n; i++){
        var rr2 = rows4[i], ago = n - 1 - i;
        if (rr2.l < wk.lo && rr2.c > wk.lo) rec = { dir: 'long', level: wk.lo, barsAgo: ago, barIndex: i };
        else if (rr2.h > wk.hi && rr2.c < wk.hi) rec = { dir: 'short', level: wk.hi, barsAgo: ago, barIndex: i };
      }
      if (rec){
        var wkVolOk = !volFn || volFn(rows4, rec.barIndex, 20, 1.5);
        if (wkVolOk){
          push(mkCand('wkbreak', rec.dir, rec.level, rec.level, undefined,
            'prior week\u2019s ' + (rec.dir === 'long' ? 'low' : 'high') + ' ' + rec.level.toFixed(2)
              + ' swept and reclaimed ' + (rec.barsAgo === 0 ? 'on the latest 4h close' : rec.barsAgo + ' 4h bar(s) ago')
              + ' — volume-validated stop raid on the weekly range, mean-reversion fuel loaded',
            'a 4h close back ' + (rec.dir === 'long' ? 'below' : 'above') + ' ' + rec.level.toFixed(2)
              + ' (the swept weekly level) negates the reclaim',
            { side: rec.dir, tag: 'wkbreak', label: 'weekly range sweep + reclaim of ' + rec.level.toFixed(2)
              + ' (' + rec.barsAgo + 'b ago) — volume-validated' }));
        } else {
          out.rejected.push({ dropped: true, id: 'wkbreak|' + rec.dir + '|' + Math.round(rec.level),
            strategy: SW_NAME.wkbreak, stratKey: 'wkbreak', dir: rec.dir, venue: venue, sym: sym,
            reason: 'weekly sweep without volume climax — V2 gate requires institutional absorption on the sweep bar' });
        }
      } else {
        var lb = rows4[n-1], rng = lb.h - lb.l;
        if (lb.c > wk.hi && lb.c > lb.o && rng >= 1.5*a4){
          push(mkCand('wkbreak', 'long', wk.hi, wk.hi, undefined,
            'prior week\u2019s high ' + wk.hi.toFixed(2) + ' broken with a displacement 4h close (bar range '
              + (rng/a4).toFixed(2) + '×ATR) — weekly range expansion underway',
            'a 4h close back below the prior week\u2019s high ' + wk.hi.toFixed(2) + ' fails the breakout and traps the breakout buyers',
            { side: 'long', tag: 'wkbreak', label: 'weekly range breakout above prior week\u2019s high ' + wk.hi.toFixed(2) + ' with displacement' }));
        } else if (lb.c < wk.lo && lb.c < lb.o && rng >= 1.5*a4){
          push(mkCand('wkbreak', 'short', wk.lo, wk.lo, undefined,
            'prior week\u2019s low ' + wk.lo.toFixed(2) + ' broken with a displacement 4h close (bar range '
              + (rng/a4).toFixed(2) + '×ATR) — weekly range expansion underway',
            'a 4h close back above the prior week\u2019s low ' + wk.lo.toFixed(2) + ' fails the breakdown and traps the breakdown sellers',
            { side: 'short', tag: 'wkbreak', label: 'weekly range breakout below prior week\u2019s low ' + wk.lo.toFixed(2) + ' with displacement' }));
        }
      }
    }

    /* 3) 4h order-block retest after the structure break (robust active zones
       when fractal structure aligns; legacy proximity fallback otherwise) */
    var obRetestDone = false;
    if (obRetest4 && obRetest4.trigger){
      var swDir = obRetest4.direction;
      var swLo = obRetest4.base, swHi = obRetest4.top, swStp = obRetest4.anchor;
      push(mkCand('ob', swDir, swStp, swStp, { lo: swLo, hi: swHi },
        'structure-aligned 4h OB retest — price inside unmitigated '
          + (swDir === 'long' ? 'bullish' : 'bearish') + ' order block '
          + swLo.toFixed(2) + '–' + swHi.toFixed(2)
          + ' during ' + (ms4 && ms4.trend ? ms4.trend : 'aligned') + ' fractal structure',
        'a 4h close ' + (swDir === 'long' ? 'below the order-block base ' : 'above the order-block top ')
          + swStp.toFixed(2) + ' mitigates the zone',
        { side: swDir, tag: 'ob', label: 'structure-aligned 4h order block retest '
          + swLo.toFixed(2) + '–' + swHi.toFixed(2) }));
      obRetestDone = true;
    }
    if (!obRetestDone && ob){
      var tol2 = 0.5*a4;
      for (i = 0; i < ob.bullish.length; i++){
        z = ob.bullish[i];
        if (entry >= z.bottom - tol2 && entry <= z.top + tol2){
          push(mkCand('ob', 'long', z.bottom, z.bottom, { lo: z.bottom, hi: z.top },
            'price retesting the bullish 4h order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)
              + ' left by the structure-breaking displacement — unmitigated demand at the origin of the break',
            'a 4h close below the order-block base ' + z.bottom.toFixed(2) + ' fails the demand zone (it becomes a breaker)',
            null));
          break;
        }
      }
      for (i = 0; i < ob.bearish.length; i++){
        z = ob.bearish[i];
        if (entry >= z.bottom - tol2 && entry <= z.top + tol2){
          push(mkCand('ob', 'short', z.top, z.top, { lo: z.bottom, hi: z.top },
            'price retesting the bearish 4h order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)
              + ' left by the structure-breaking displacement — unmitigated supply at the origin of the break',
            'a 4h close above the order-block top ' + z.top.toFixed(2) + ' fails the supply zone (it becomes a breaker)',
            null));
          break;
        }
      }
    }

    /* 4) macro-aligned trend continuation — a REAL daily trend stack plus a
       directional real-rate hint agreeing with it; macro never fabricates */
    var hint = (macro && typeof macro === 'object') ? macro.realRateHint : null;
    if (trend1 && (hint === 'TAILWIND' || hint === 'HEADWIND')){
      var mdir = (hint === 'TAILWIND') ? 'long' : 'short';
      if ((mdir === 'long' && trend1 === 'bull') || (mdir === 'short' && trend1 === 'bear')){
        var mWhy = [];
        if (macro.dxy && macro.dxy.trend20) mWhy.push('DXY ' + String(macro.dxy.trend20).toLowerCase());
        if (macro.tnxTrend) mWhy.push('US10Y ' + String(macro.tnxTrend).toLowerCase());
        push(mkCand('macro', mdir, e50_1, e200_1, undefined,
          'daily ' + (trend1 === 'bull' ? 'uptrend' : 'downtrend') + ' (EMA50 ' + e50_1.toFixed(2) + ' vs EMA200 '
            + e200_1.toFixed(2) + ') aligned with a ' + (hint === 'TAILWIND' ? 'falling' : 'rising')
            + ' real-rate backdrop' + (mWhy.length ? ' (' + mWhy.join(', ') + ')' : '')
            + ' — macro ' + hint.toLowerCase() + ' behind ' + mdir + 's',
          'a 4h close ' + (mdir === 'long' ? 'below' : 'above') + ' the daily 200-EMA region ' + e200_1.toFixed(2)
            + ' breaks the macro-aligned trend thesis',
          { side: mdir, tag: 'macro', label: 'macro ' + hint.toLowerCase() + (mWhy.length ? ' (' + mWhy.join(', ') + ')' : '')
            + ' — real-rate backdrop favors ' + mdir + 's' }));
      }
    }

    /* 5) 4h liquidity sweep reversal (volume-validated) */
    if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
      var swVolOk = !volFn || volFn(rows4, n - 1 - sw.barsAgo, 20, 1.5);
      if (swVolOk){
        var sdir = (sw.dir === 'bullish') ? 'long' : 'short';
        push(mkCand('sweep', sdir, sw.level, sw.level, undefined,
          '4h liquidity sweep of ' + sw.level.toFixed(2) + ' + '
            + (sdir === 'long' ? 'reclaim' : 'rejection') + ' (' + sw.barsAgo + 'b ago) — volume-validated stop hunt',
          'a 4h close back ' + (sdir === 'long' ? 'below' : 'above') + ' ' + sw.level.toFixed(2) + ' negates the sweep',
          { side: sdir, tag: 'sweep4h', label: '4h sweep + reclaim at ' + sw.level.toFixed(2) + ' (volume-validated)' }));
      }
    }

    /* 6) 4h FVG fill — HVN-defended when profile is wide */
    if (fvg && fvg.length){
      var gf = fvg[0];
      if (gf.age <= 25){
        var tolF = 0.5 * a4;
        if (entry >= gf.bottom - tolF && entry <= gf.top + tolF){
          var fdir = (gf.dir === 'bullish') ? 'long' : 'short';
          var fStop = fdir === 'long' ? gf.bottom : gf.top;
          push(mkCand('fvg', fdir, fStop, fStop, { lo: gf.bottom, hi: gf.top },
            'price inside unmitigated 4h FVG ' + gf.bottom.toFixed(2) + '–' + gf.top.toFixed(2)
              + (vpOk4 ? ' — HVN defends the gap' : ''),
            'a 4h close ' + (fdir === 'long' ? 'below gap base ' : 'above gap top ') + fStop.toFixed(2) + ' fails the imbalance',
            { side: fdir, tag: 'fvg4h', label: '4h FVG fill ' + gf.bottom.toFixed(2) + '–' + gf.top.toFixed(2) }));
        }
      }
    }

    /* 7) 4h BOS alignment — fresh break with trend stack agreement */
    if (ms4 && ms4.bos && isFinite(ms4.level) && trend4){
      var bdir = (ms4.trend === 'bullish') ? 'long' : ((ms4.trend === 'bearish') ? 'short' : null);
      if (bdir && ((bdir === 'long' && trend4 === 'bull') || (bdir === 'short' && trend4 === 'bear'))
          && Math.abs(entry - ms4.level) <= 0.75 * a4){
        push(mkCand('bos', bdir, ms4.level, ms4.level, undefined,
          '4h fractal BOS ' + ms4.trend + ' — structure break at ' + ms4.level.toFixed(2) + ' with the 4h EMA trend stack',
          'a 4h close back through ' + ms4.level.toFixed(2) + ' negates the break',
          { side: bdir, tag: 'bos', label: '4h BOS ' + ms4.trend + ' at ' + ms4.level.toFixed(2) + ' with EMA stack' }));
      }
    }

    /* 8) 4h EMA ribbon pullback (goldind.js) */
    var ribbonFn = gfn('goldRibbon');
    if (ribbonFn){
      try{
        var rb4 = ribbonFn(rows4);
        if (rb4 && rb4.pullback20 && (rb4.mode === 'BULL' || rb4.mode === 'BEAR')){
          var rdir = (rb4.mode === 'BULL') ? 'long' : 'short';
          if (isFinite(rb4.e20) && Math.abs(entry - rb4.e20) <= 0.75 * a4){
            push(mkCand('ribbon', rdir, rb4.e20, (isFinite(rb4.e50) ? rb4.e50 : rb4.e20),
              { lo: rb4.e20 - 0.25 * a4, hi: rb4.e20 + 0.25 * a4 },
              'pullback into the 4h 20-EMA (' + rb4.e20.toFixed(2) + ') inside a ' + rb4.mode.toLowerCase()
                + ' 20/50/200 ribbon — trend continuation at the moving-average shelf',
              'a 4h close through the 50-EMA ' + (isFinite(rb4.e50) ? rb4.e50.toFixed(2) : 'n/a') + ' breaks the ribbon pullback',
              { side: rdir, tag: 'ribbon', label: '4h ribbon pullback to 20-EMA ' + rb4.e20.toFixed(2) }));
          }
        }
      }catch(eRb){}
    }

    /* 9) VP Playbook §10 — ENTER only (explicit gates replace soft tally) */
    var vpFn = gfn('hgGoldVpPlaybook');
    if (vpFn){
      try{
        var vpb = vpFn(rows4, {
          now: nowMs,
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null,
          rows4h: rows4,
          obOk: !!(obRetest4 && obRetest4.trigger)
        });
        if (vpb && vpb.decision === 'ENTER' && vpb.dir && isFinite(vpb.entry)){
          var vpStop = isFinite(vpb.stop) ? vpb.stop
            : (vpb.dir === 'long' ? vpb.entry - 1.5 * a4 : vpb.entry + 1.5 * a4);
          var vpRisk = Math.abs(vpb.entry - vpStop);
          var vpCand = mkCand('vpbook', vpb.dir, vpStop, vpStop, undefined,
            vpb.why + ' — VP playbook gates ' + vpb.gatesPass + '/12'
              + (vpb.size && vpb.size.pick ? (' · ' + vpb.size.pick) : ''),
            'close beyond stop or acceptance against the swept pool cancels',
            { side: vpb.dir, tag: 'vpbook',
              label: 'VP playbook ' + vpb.decision + ' ' + vpb.gatesPass + '/12' });
          if (!vpCand || vpCand.dropped){
            /* Soft tally may reject a lone ENTER — mint directly: §10 gates
               are the checklist, not agree-count. */
            vpCand = {
              id: 'vpbook|' + vpb.dir + '|' + Math.round(vpb.entry),
              strategy: SW_NAME.vpbook, stratKey: 'vpbook', dir: vpb.dir,
              entry: vpb.entry, pxNow: entry, mark: entry, stop: vpStop,
              t1: isFinite(vpb.t1) ? vpb.t1 : NaN,
              t2: isFinite(vpb.t2) ? vpb.t2 : NaN,
              rr: isFinite(vpb.rr1) ? vpb.rr1
                : (vpRisk > 0 && isFinite(vpb.t1) ? Math.abs(vpb.t1 - vpb.entry) / vpRisk : NaN),
              grade: (vpb.grade && vpb.grade.grade === 'A') ? 'A' : 'B',
              agree: 2, oppose: 0, atr: a4,
              reads: { long: vpb.dir === 'long' ? 2 : 0, short: vpb.dir === 'short' ? 2 : 0 },
              venue: venue, sym: sym, session: sessionTxt || 'n/a',
              why: vpb.why + ' — VP playbook gates ' + vpb.gatesPass + '/12',
              invalidates: 'close beyond ' + vpStop.toFixed(2),
              stamps: ['VP ENTER ' + vpb.gatesPass + '/12'
                + (vpb.halfSize ? ' · HALF' : '')],
              vpPlaybook: vpb,
              demoted: !!vpb.halfSize,
              notes: []
            };
          } else {
            if (isFinite(vpb.entry)) vpCand.entry = vpb.entry;
            if (isFinite(vpb.t1)) vpCand.t1 = vpb.t1;
            if (isFinite(vpb.t2)) vpCand.t2 = vpb.t2;
            if (isFinite(vpb.stop)) vpCand.stop = vpb.stop;
            if (vpb.halfSize) vpCand.demoted = true;
            if (!Array.isArray(vpCand.stamps)) vpCand.stamps = [];
            vpCand.stamps.push('VP ENTER ' + vpb.gatesPass + '/12'
              + (vpb.halfSize ? ' · HALF' : ''));
            vpCand.vpPlaybook = vpb;
          }
          push(vpCand);
        }
      }catch(eVp){}
    }

    /* 10) Part4 S12 / S14 / S17 — mint forming+dir (parity with SCALP) */
    var p4FnCand = gfn('hgGoldPart4Engine');
    var p4FiltCand = gfn('hgGoldPart4ApplyDiscountFilter');
    if (p4FnCand){
      try{
        var p4EngCand = p4FnCand(rows4, {
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null
        });
        if (p4EngCand && p4EngCand.strategies && p4EngCand.strategies.length){
          var p4Live = { p4nr7: 1, p4adrx: 1, p4laf: 1 };
          var p4j, p4hit, p4Stop, p4Cand;
          for (p4j = 0; p4j < p4EngCand.strategies.length; p4j++){
            p4hit = p4EngCand.strategies[p4j];
            if (!p4hit || !p4hit.dir || !p4Live[p4hit.key]) continue;
            /* Ticket mint: confirmed only. Forming stays on the forming panel /
               PART4 stamps — soft-minting forming fabricated quiet-tape cands. */
            if (p4hit.grade !== 'confirmed') continue;
            if (!isFinite(p4hit.level) && !(p4hit.plan && isFinite(p4hit.plan.entry))) continue;
            var p4Entry = isFinite(p4hit.level) ? p4hit.level
              : (p4hit.plan && p4hit.plan.entry);
            p4Stop = (p4hit.plan && isFinite(p4hit.plan.stop)) ? p4hit.plan.stop
              : (p4hit.dir === 'long' ? p4Entry - 1.5 * a4 : p4Entry + 1.5 * a4);
            p4Cand = mkCand(p4hit.key, p4hit.dir, p4Stop, p4Stop, undefined,
              p4hit.why, 'Part4 invalidation — structure break against the setup',
              { side: p4hit.dir, tag: p4hit.key, label: p4hit.why });
            p4Cand = bindPart(p4Cand, p4hit, 'PART4 ' + String(p4hit.key).toUpperCase());
            if (!p4Cand) continue;
            if (p4FiltCand && p4EngCand.pd) p4FiltCand(p4Cand, p4EngCand.pd);
            push(p4Cand);
          }
        }
      }catch(eP4c){}
    }

    /* 11) Part5 S19 / S20 / S22 / S24 / S27 — confirmed-only mint (forming panel) */
    var p5FnCand = gfn('hgGoldPart5Engine');
    var p5RegFilt = gfn('hgGoldPart5ApplyRegimeFilter');
    var p5BiasFilt = gfn('hgGoldPart5ApplyWeeklyBiasFilter');
    if (p5FnCand){
      try{
        var p5EngCand = p5FnCand(rows4, {
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null,
          now: nowMs,
          physical: microOpts && microOpts.physical
        });
        if (p5EngCand && p5EngCand.strategies && p5EngCand.strategies.length){
          var p5Live = { p5wyck: 1, p5turt: 1, p5vwap: 1, p5drive: 1, p5news: 1 };
          var p5j, p5hit, p5Stop, p5Cand, p5Entry;
          for (p5j = 0; p5j < p5EngCand.strategies.length; p5j++){
            p5hit = p5EngCand.strategies[p5j];
            if (!p5hit || !p5hit.dir || !p5Live[p5hit.key]) continue;
            if (p5hit.grade !== 'confirmed') continue;
            if (!isFinite(p5hit.level) && !(p5hit.plan && isFinite(p5hit.plan.entry))) continue;
            p5Entry = isFinite(p5hit.level) ? p5hit.level
              : (p5hit.plan && p5hit.plan.entry);
            p5Stop = (p5hit.plan && isFinite(p5hit.plan.stop)) ? p5hit.plan.stop
              : (p5hit.dir === 'long' ? p5Entry - 1.5 * a4 : p5Entry + 1.5 * a4);
            p5Cand = mkCand(p5hit.key, p5hit.dir, p5Stop, p5Stop, undefined,
              p5hit.why, 'Part5 invalidation — structure break against the setup',
              { side: p5hit.dir, tag: p5hit.key, label: p5hit.why });
            p5Cand = bindPart(p5Cand, p5hit, 'PART5 ' + String(p5hit.key).toUpperCase());
            if (!p5Cand) continue;
            if (p5RegFilt && p5EngCand.ker) p5RegFilt(p5Cand, p5EngCand.ker);
            if (p5BiasFilt && p5EngCand.bias) p5BiasFilt(p5Cand, p5EngCand.bias);
            push(p5Cand);
          }
        }
      }catch(eP5c){}
    }

    /* 12) Part6 S30 / S33 / S36 / S37 — confirmed-only mint */
    var p6FnCand = gfn('hgGoldPart6Engine');
    var p6EvFilt = gfn('hgGoldPart6ApplyEventFilter');
    var p6CorrFilt = gfn('hgGoldPart6ApplyCorrFilter');
    if (p6FnCand){
      try{
        var p6EngCand = p6FnCand(rows4, {
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null,
          now: nowMs,
          dxyRows: microOpts && (microOpts.dxyRows || microOpts.dxyCandles),
          btcRows: microOpts && microOpts.btcRows,
          events: microOpts && microOpts.events
        });
        if (p6EngCand && p6EngCand.strategies && p6EngCand.strategies.length){
          var p6Live = { p6comp: 1, p6zfade: 1, p6smt: 1, p6fail: 1 };
          var p6j, p6hit, p6Stop, p6Cand, p6Entry;
          for (p6j = 0; p6j < p6EngCand.strategies.length; p6j++){
            p6hit = p6EngCand.strategies[p6j];
            if (!p6hit || !p6hit.dir || !p6Live[p6hit.key]) continue;
            if (p6hit.grade !== 'confirmed') continue;
            if (!isFinite(p6hit.level) && !(p6hit.plan && isFinite(p6hit.plan.entry))) continue;
            p6Entry = isFinite(p6hit.level) ? p6hit.level
              : (p6hit.plan && p6hit.plan.entry);
            p6Stop = (p6hit.plan && isFinite(p6hit.plan.stop)) ? p6hit.plan.stop
              : (p6hit.dir === 'long' ? p6Entry - 1.5 * a4 : p6Entry + 1.5 * a4);
            p6Cand = mkCand(p6hit.key, p6hit.dir, p6Stop, p6Stop, undefined,
              p6hit.why, 'Part6 invalidation — structure break against the setup',
              { side: p6hit.dir, tag: p6hit.key, label: p6hit.why });
            p6Cand = bindPart(p6Cand, p6hit, 'PART6 ' + String(p6hit.key).toUpperCase());
            if (!p6Cand) continue;
            if (p6EvFilt && p6EngCand.eventTpl) p6EvFilt(p6Cand, p6EngCand.eventTpl);
            if (p6CorrFilt && p6EngCand.corr) p6CorrFilt(p6Cand, p6EngCand.corr);
            push(p6Cand);
          }
        }
      }catch(eP6c){}
    }

    /* 13) Part7 S43 ratio — confirmed-only; p7scalp is SCALP-module only */
    var p7FnCand = gfn('hgGoldPart7Engine');
    if (p7FnCand){
      try{
        var p7EngCand = p7FnCand(rows4, {
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null,
          now: nowMs,
          silverRows: microOpts && microOpts.silverRows,
          usdInr: microOpts && microOpts.usdInr,
          kToday: microOpts && microOpts.kToday
        });
        if (p7EngCand && p7EngCand.strategies && p7EngCand.strategies.length){
          var p7Live = { p7ratio: 1 };
          var p7j, p7hit, p7Stop, p7Cand, p7Entry;
          for (p7j = 0; p7j < p7EngCand.strategies.length; p7j++){
            p7hit = p7EngCand.strategies[p7j];
            if (!p7hit || !p7hit.dir || !p7Live[p7hit.key]) continue;
            if (p7hit.grade !== 'confirmed') continue;
            if (!isFinite(p7hit.level) && !(p7hit.plan && isFinite(p7hit.plan.entry))) continue;
            p7Entry = isFinite(p7hit.level) ? p7hit.level
              : (p7hit.plan && p7hit.plan.entry);
            p7Stop = (p7hit.plan && isFinite(p7hit.plan.stop)) ? p7hit.plan.stop
              : (p7hit.dir === 'long' ? p7Entry - 1.5 * a4 : p7Entry + 1.5 * a4);
            p7Cand = mkCand(p7hit.key, p7hit.dir, p7Stop, p7Stop, undefined,
              p7hit.why, 'Part7 invalidation — structure break against the setup',
              { side: p7hit.dir, tag: p7hit.key, label: p7hit.why });
            p7Cand = bindPart(p7Cand, p7hit, 'PART7 ' + String(p7hit.key).toUpperCase());
            if (!p7Cand) continue;
            if (p7EngCand.season && p7EngCand.season.active){
              if (!Array.isArray(p7Cand.stamps)) p7Cand.stamps = [];
              p7Cand.stamps.push('S48 SEASONAL');
            }
            push(p7Cand);
          }
        }
      }catch(eP7c){}
    }

    /* 14) Part8 S51/S52/S53/S54 — confirmed-only live tickets + Flow filters */
    var p8FnCand = gfn('hgGoldPart8Engine');
    if (p8FnCand){
      try{
        var p8EngCand = p8FnCand(rows4, {
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null,
          now: nowMs,
          calendarEvent: !!(microOpts && microOpts.calendarEvent),
          headlineCounts: microOpts && microOpts.headlineCounts,
          residSeries: microOpts && microOpts.residSeries,
          rGold: microOpts && microOpts.rGold,
          rDxy: microOpts && microOpts.rDxy,
          weeklyIv: microOpts && microOpts.weeklyIv,
          gvz: microOpts && microOpts.gvz,
          journal: microOpts && microOpts.gateJournal,
          tfHourMult: 1
        });
        var p8Bvc = gfn('hgGoldPart8ApplyBvcBoost');
        var p8Vpin = gfn('hgGoldPart8ApplyVpinFilter');
        var p8Illiq = gfn('hgGoldPart8ApplyIlliqScale');
        var p8Clus = gfn('hgGoldPart8ApplyClusterFilter');
        if (p8EngCand){
          var qi;
          for (qi = 0; qi < out.length; qi++){
            if (!out[qi] || out[qi].dropped) continue;
            if (p8Vpin) p8Vpin(out[qi], p8EngCand.vpin);
            if (p8Illiq) p8Illiq(out[qi], p8EngCand.illiq);
            if (p8Clus) p8Clus(out[qi], p8EngCand.cluster);
            if (p8Bvc && /sweep|p5wyck|p5turt|p6smt|p6fail/.test(String(out[qi].stratKey || ''))){
              var bdiv = out[qi].dir === 'long' ? p8EngCand.bvcDivLong : p8EngCand.bvcDivShort;
              p8Bvc(out[qi], bdiv);
            }
          }
        }
        if (p8EngCand && p8EngCand.strategies && p8EngCand.strategies.length){
          var p8Live = { p8resid: 1, p8range: 1, p8geo: 1, p8vpinbo: 1 };
          var p8j, p8hit, p8Stop, p8Cand, p8Entry;
          for (p8j = 0; p8j < p8EngCand.strategies.length; p8j++){
            p8hit = p8EngCand.strategies[p8j];
            if (!p8hit || !p8hit.dir || !p8Live[p8hit.key]) continue;
            if (p8hit.grade !== 'confirmed') continue;
            if (!isFinite(p8hit.level) && !(p8hit.plan && isFinite(p8hit.plan.entry))) continue;
            p8Entry = isFinite(p8hit.level) ? p8hit.level
              : (p8hit.plan && p8hit.plan.entry);
            p8Stop = (p8hit.plan && isFinite(p8hit.plan.stop)) ? p8hit.plan.stop
              : (p8hit.dir === 'long' ? p8Entry - 1.5 * a4 : p8Entry + 1.5 * a4);
            p8Cand = mkCand(p8hit.key, p8hit.dir, p8Stop, p8Stop, undefined,
              p8hit.why, 'Part8 invalidation — structure break against the setup',
              { side: p8hit.dir, tag: p8hit.key, label: p8hit.why });
            p8Cand = bindPart(p8Cand, p8hit, 'PART8 ' + String(p8hit.key).toUpperCase());
            if (!p8Cand) continue;
            if (p8Vpin) p8Vpin(p8Cand, p8EngCand.vpin);
            if (p8Illiq) p8Illiq(p8Cand, p8EngCand.illiq);
            if (p8Clus) p8Clus(p8Cand, p8EngCand.cluster);
            push(p8Cand);
          }
        }
      }catch(eP8c){}
    }

    /* 15) Part9 S62/S65 — confirmed-only live tickets + trader/SPRT/funding filters */
    var p9FnCand = gfn('hgGoldPart9Engine');
    if (p9FnCand){
      try{
        var p9EngCand = p9FnCand(rows4, {
          newsGate: (microOpts && microOpts.news)
            ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(microOpts.news, nowMs) : null)
            : null,
          now: nowMs,
          venue: venue || 'XAUTUSD',
          fundingRate: microOpts && microOpts.fundingRate,
          traderJournal: microOpts && microOpts.traderJournal,
          sprtHits: microOpts && microOpts.sprtHits,
          rMultiples: microOpts && microOpts.rMultiples,
          premiumSeries: microOpts && microOpts.premiumSeries,
          premium: microOpts && microOpts.premium,
          indexLast: microOpts && microOpts.indexLast,
          indexAtExtreme: !!(microOpts && microOpts.indexAtExtreme),
          plan: microOpts && microOpts.runnerPlan,
          nPayments: microOpts && microOpts.nPayments,
          holdHours: microOpts && microOpts.holdHours
        });
        var p9Tilt = gfn('hgGoldPart9ApplyTraderState');
        var p9Sprt = gfn('hgGoldPart9ApplySprt');
        var p9Fund = gfn('hgGoldPart9ApplyFundingWindow');
        var p9Carry = gfn('hgGoldPart9ApplyCarryGate');
        if (p9EngCand){
          var p9qi;
          for (p9qi = 0; p9qi < out.length; p9qi++){
            if (!out[p9qi] || out[p9qi].dropped) continue;
            if (p9Tilt) p9Tilt(out[p9qi], p9EngCand.trader);
            if (p9Sprt) p9Sprt(out[p9qi], p9EngCand.sprt);
            if (p9Fund) p9Fund(out[p9qi], {
              ok: !!(p9EngCand.funding && p9EngCand.funding.ok),
              fundingRate: microOpts && microOpts.fundingRate,
              venue: venue || 'XAUTUSD',
              nowMs: nowMs
            });
            if (p9Carry && p9EngCand.carry) p9Carry(out[p9qi], p9EngCand.carry);
          }
        }
        if (p9EngCand && p9EngCand.strategies && p9EngCand.strategies.length){
          var p9Live = { p9volbar: 1, p9prem: 1 };
          var p9j, p9hit, p9Stop, p9Cand, p9Entry;
          for (p9j = 0; p9j < p9EngCand.strategies.length; p9j++){
            p9hit = p9EngCand.strategies[p9j];
            if (!p9hit || !p9hit.dir || !p9Live[p9hit.key]) continue;
            if (p9hit.grade !== 'confirmed') continue;
            if (!isFinite(p9hit.level) && !(p9hit.plan && isFinite(p9hit.plan.entry))) continue;
            p9Entry = isFinite(p9hit.level) ? p9hit.level
              : (p9hit.plan && p9hit.plan.entry);
            p9Stop = (p9hit.plan && isFinite(p9hit.plan.stop)) ? p9hit.plan.stop
              : (p9hit.dir === 'long' ? p9Entry - 1.5 * a4 : p9Entry + 1.5 * a4);
            p9Cand = mkCand(p9hit.key, p9hit.dir, p9Stop, p9Stop, undefined,
              p9hit.why, 'Part9 invalidation — structure break against the setup',
              { side: p9hit.dir, tag: p9hit.key, label: p9hit.why });
            p9Cand = bindPart(p9Cand, p9hit, 'PART9 ' + String(p9hit.key).toUpperCase());
            if (!p9Cand) continue;
            if (p9hit.plan && p9hit.plan.halfSize){
              p9Cand.sizeMult = (isFinite(p9Cand.sizeMult) ? p9Cand.sizeMult : 1) * 0.5;
              p9Cand.demoted = true;
            }
            if (p9Tilt) p9Tilt(p9Cand, p9EngCand.trader);
            if (p9Sprt) p9Sprt(p9Cand, p9EngCand.sprt);
            if (p9Fund) p9Fund(p9Cand, {
              ok: !!(p9EngCand.funding && p9EngCand.funding.ok),
              fundingRate: microOpts && microOpts.fundingRate,
              venue: venue || 'XAUTUSD',
              nowMs: nowMs
            });
            push(p9Cand);
          }
        }
      }catch(eP9c){}
    }

    /* Master Catalog v1.0 — verdict stamps; never invents ENTER. */
    try{
      var catFnSw = gfn('hgGoldCatalogEngine');
      var catApplySw = gfn('hgGoldCatalogApplyVerdict');
      if (catFnSw && catApplySw){
        var catEng = catFnSw(rows4, { now: nowMs });
        var csi;
        for (csi = 0; csi < out.length; csi++){
          if (out[csi] && !out[csi].dropped) catApplySw(out[csi], catEng);
        }
      }
    }catch(eCatSw){}
  }catch(e){}
  return out;
}

/* FORMING-NOW WATCH — per-strategy ARMED/IDLE state with the exact live
   trigger condition + the REAL level from the same detector math
   buildCandidates uses (recomputed read-only; nothing fabricated). 'armed'
   is a WATCH ITEM, NOT an entry — a candidate still needs its trigger plus
   >=2 agreeing reads. 'idle' carries the honest reason ('no levels
   available' when the level is uncomputable). Never throws.
   -> [{stratKey, strategy, venue, state, level, condition, reason}] */
function buildWatch(leg, nowMs, macro, venue){
  var out = [];
  function emit(key, state, level, condition, reason){
    out.push({ stratKey: key, strategy: SW_NAME[key] || key, venue: venue || null,
               state: (state === 'armed') ? 'armed' : 'idle',
               level: (typeof level === 'number' && isFinite(level)) ? level : null,
               condition: condition || '', reason: reason || null });
  }
  try{
    var rows4 = __rows(leg.rows4h);
    if (!rows4 || rows4.length < MIN_4H){
      var shortWhy = 'not enough 4h bars (' + (rows4 ? rows4.length : 0) + '/' + MIN_4H + ') — no levels available';
      emit('pullback', 'idle', null, '', shortWhy);
      emit('wkbreak',  'idle', null, '', shortWhy);
      emit('ob',       'idle', null, '', shortWhy);
      emit('macro',    'idle', null, '', shortWhy);
      return out;
    }
    var n = rows4.length;
    var a4 = __last(_atr(rows4, 14));
    var entry = rows4[n-1].c;
    var rows1d = __rows(leg.rows1d);
    var hint = (macro && typeof macro === 'object') ? macro.realRateHint : null;

    /* 4h trend stack (same math as buildCandidates) */
    var c4 = __closes(rows4);
    var e50_4 = __last(_ema(c4, 50)), e200_4 = __last(_ema(c4, 200));
    var trend4 = null;
    if (isFinite(e50_4) && isFinite(e200_4)){
      if (entry > e50_4 && e50_4 > e200_4) trend4 = 'bull';
      else if (entry < e50_4 && e50_4 < e200_4) trend4 = 'bear';
    }

    /* 1) 4h trend pullback — watching the 50-EMA value zone */
    if (trend4 && isFinite(e50_4)){
      emit('pullback', 'armed', e50_4,
        'watching the 4h 50-EMA ' + e50_4.toFixed(2) + ' — fires on a pullback within 0.75×ATR inside the '
          + trend4 + ' EMA50/200 stack', null);
    } else if (!isFinite(e50_4)){
      emit('pullback', 'idle', null, '', 'no levels available (4h EMA50 not computable on ' + n + ' bars)');
    } else {
      emit('pullback', 'idle', null, '', 'no 4h EMA50/200 trend stack right now — nothing to pull back into');
    }

    /* 2) weekly-range breakout — watching the prior week's high/low */
    var wk = __weeklyRange(rows1d);
    if (wk){
      var nearLo = Math.abs(entry - wk.lo) <= Math.abs(wk.hi - entry);
      emit('wkbreak', 'armed', nearLo ? wk.lo : wk.hi,
        'watching the prior week\u2019s ' + (nearLo ? 'low ' + wk.lo.toFixed(2) : 'high ' + wk.hi.toFixed(2))
          + ' (range ' + wk.lo.toFixed(2) + '–' + wk.hi.toFixed(2) + ') — fires on a sweep + reclaim or a ≥1.5×ATR displacement 4h close beyond it', null);
    } else {
      emit('wkbreak', 'idle', null, '', 'prior-week range unavailable (need >=3 daily bars in the prior ISO week) — no levels available');
    }

    /* 3) 4h order-block retest — nearest unmitigated OB within 1.5×ATR */
    var ob = null, obFn = gfn('goldOrderBlocks');
    if (obFn){ try{ ob = obFn(rows4); }catch(eO){ ob = null; } }
    var obZones = [], oi, oz;
    if (ob){
      for (oi = 0; oi < ob.bullish.length; oi++){ oz = ob.bullish[oi]; obZones.push({ dir: 'bullish', top: oz.top, bottom: oz.bottom }); }
      for (oi = 0; oi < ob.bearish.length; oi++){ oz = ob.bearish[oi]; obZones.push({ dir: 'bearish', top: oz.top, bottom: oz.bottom }); }
    }
    if (obZones.length && isFinite(a4) && a4 > 0){
      var obNear = null, obDist = Infinity;
      for (oi = 0; oi < obZones.length; oi++){
        oz = obZones[oi];
        var dz = (entry > oz.top) ? (entry - oz.top) : ((entry < oz.bottom) ? (oz.bottom - entry) : 0);
        if (dz < obDist){ obDist = dz; obNear = oz; }
      }
      if (obNear && obDist <= 1.5*a4){
        var obEdge = (entry >= obNear.bottom && entry <= obNear.top)
          ? ((obNear.dir === 'bullish') ? obNear.bottom : obNear.top)
          : ((entry > obNear.top) ? obNear.top : obNear.bottom);
        emit('ob', 'armed', obEdge,
          'watching the unmitigated ' + obNear.dir + ' 4h order block ' + obNear.bottom.toFixed(2) + '–'
            + obNear.top.toFixed(2) + ' — fires on a retest (price within 0.5×ATR of the zone)', null);
      } else {
        emit('ob', 'idle', null, '', 'no unmitigated 4h order block within 1.5×ATR of price');
      }
    } else if (!obFn){
      emit('ob', 'idle', null, '', 'goldOrderBlocks unavailable (goldind.js) — no levels available');
    } else {
      emit('ob', 'idle', null, '', 'no unmitigated 4h order block on the chart — no levels available');
    }

    /* 4) macro-aligned continuation — watching the daily stack vs the
       real-rate backdrop (macro never fabricates) */
    var e50_1 = NaN, trend1 = null;
    if (rows1d && rows1d.length >= 60){
      var c1 = __closes(rows1d);
      e50_1 = __last(_ema(c1, 50));
      var e200_1 = __last(_ema(c1, 200));
      var dClose = c1[c1.length - 1];
      if (isFinite(e50_1) && isFinite(e200_1) && isFinite(dClose)){
        if (dClose > e50_1 && e50_1 > e200_1) trend1 = 'bull';
        else if (dClose < e50_1 && e50_1 < e200_1) trend1 = 'bear';
      }
    }
    if (trend1 && isFinite(e50_1)){
      var aligned = (hint === 'TAILWIND' && trend1 === 'bull') || (hint === 'HEADWIND' && trend1 === 'bear');
      var opposed = (hint === 'TAILWIND' && trend1 === 'bear') || (hint === 'HEADWIND' && trend1 === 'bull');
      emit('macro', 'armed', e50_1,
        aligned
          ? 'daily ' + trend1 + ' stack aligned with a ' + String(hint).toLowerCase() + ' real-rate backdrop — fires with >=2 independent agreeing reads'
          : (opposed
              ? 'daily ' + trend1 + ' stack fights a ' + String(hint).toLowerCase() + ' real-rate backdrop — no alignment, macro never fabricates'
              : 'daily ' + trend1 + ' stack in place — fires when the real-rate backdrop (now '
                + (hint ? String(hint).toLowerCase() : 'unavailable') + ') aligns'), null);
    } else if (rows1d && rows1d.length >= 60){
      emit('macro', 'idle', null, '', 'no daily EMA50/200 trend stack — macro continuation has no trend to align with');
    } else {
      emit('macro', 'idle', null, '', 'daily context unavailable (' + (rows1d ? rows1d.length : 0) + ' 1d bars) — macro strategy offline');
    }
  }catch(e){}
  return out;
}

/* ---------------- ranking: transparent confluence tally ---------------- */
function goldSwingSetups(inp){
  try{
    inp = inp || {};
    var rows4 = __rows(inp.rows4h);
    if (!rows4 || rows4.length < MIN_4H) return { ranked: [], best: null, rejected: [] };
    var nowMs = inp.now;
    if (!isFinite(nowMs)) nowMs = Date.now();
    var newsC = { caution: false, title: null };
    if (inp.news){
      var ncFn = gfn('goldNewsCaution');
      if (ncFn){ try{ newsC = ncFn(inp.news, nowMs) || newsC; }catch(eN){} }
    }
    var leg = { rows4h: rows4, rows1d: __rows(inp.rows1d) };
    var microOpts = inp.microOpts || {};
    if (inp.us10yCandles) microOpts.us10yCandles = inp.us10yCandles;
    if (inp.news) microOpts.news = inp.news;
    if (isFinite(inp.spreadUsd)) microOpts.spreadUsd = inp.spreadUsd;
    if (inp.l2OrderBook) microOpts.l2OrderBook = inp.l2OrderBook;
    var got = buildCandidates(leg, nowMs, newsC, inp.macro || null, 'n/a', 'INLINE', 'XAUUSD', microOpts);
    var cvFn = gfn('goldCrossVenueMap');
    var ctx = { now: nowMs, news: newsC, macro: inp.macro || null, goldPro: inp.goldPro || null,
                season: inp.season || null, spot: inp.spot || null, fng: inp.fng || null,
                fundingRate: inp.fundingRate, crossVenue: cvFn ? cvFn(got) : null };
    return rankSetups(got, ctx);
  }catch(e){ return { ranked: [], best: null, rejected: [] }; }
}

function rankSetups(cands, ctx){
  try{
    if (typeof window !== 'undefined' && typeof window.goldRankSetups === 'function')
      return window.goldRankSetups(cands, ctx);
  }catch(e){}
  var out = { ranked: [], best: null, rejected: [] };
  try{
    if (!Array.isArray(cands) || !cands.length) return out;
    ctx = ctx || {};
    var news = (ctx.news && typeof ctx.news === 'object') ? ctx.news : { caution: false, title: null };
    var macro = (ctx.macro && typeof ctx.macro === 'object') ? ctx.macro : null;
    var hint = macro ? macro.realRateHint : null;
    var spot = (ctx.spot && typeof ctx.spot === 'object') ? ctx.spot : null;
    var verdict = spot ? spot.verdict : null;
    var basisTxt = (spot && isFinite(spot.basisPct)) ? ((spot.basisPct > 0 ? '+' : '') + Number(spot.basisPct).toFixed(3) + '%') : 'n/a';
    var season = (ctx.season && typeof ctx.season === 'object') ? ctx.season : null;
    var fng = (ctx.fng && typeof ctx.fng === 'object') ? ctx.fng : null;
    var fngV = (fng && isFinite(+fng.v)) ? +fng.v : null;

    var ranked = [], i, k;
    for (i = 0; i < cands.length; i++){
      var c = cands[i];
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
      if (c.dropped){
        out.rejected.push({ id: c.id || null, strategy: c.strategy || null, stratKey: c.stratKey || null,
                            dir: c.dir, venue: c.venue || null, sym: c.sym || null,
                            reason: c.reason || 'failed a quality gate' });
        continue;
      }
      if (typeof W !== 'undefined' && typeof W.hgGoldPlanSidesOk === 'function'
          && isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1)){
        var sideGate = W.hgGoldPlanSidesOk(c);
        if (!sideGate.ok){
          out.rejected.push({ id: c.id || null, strategy: c.strategy || null, stratKey: c.stratKey || null,
                              dir: c.dir, venue: c.venue || null, sym: c.sym || null,
                              reason: sideGate.why || 'plan sides invalid' });
          continue;
        }
      }
      var parts = [], tally = 0;
      var agree = isFinite(c.agree) ? c.agree : 0;
      if (agree > 0){
        parts.push({ label: agree + ' independent agreeing read' + (agree === 1 ? '' : 's'), pts: agree });
        tally += agree;
      }
      if (news.caution){
        parts.push({ label: 'high-impact news window ±30 min' + (news.title ? ' — ' + news.title : '') + ' (fade risk)', pts: -2 });
        tally -= 2;
      }
      if (hint === 'TAILWIND' || hint === 'HEADWIND'){
        var favors = (hint === 'TAILWIND') ? 'long' : 'short';
        var mPts = (c.dir === favors) ? 2 : -2;
        var mWhy = [];
        if (macro.dxy && macro.dxy.trend20) mWhy.push('DXY ' + String(macro.dxy.trend20).toLowerCase());
        if (macro.tnxTrend) mWhy.push('US10Y ' + String(macro.tnxTrend).toLowerCase());
        parts.push({ label: 'macro ' + hint.toLowerCase() + (mWhy.length ? ' (' + mWhy.join(', ') + ')' : '')
                       + ' — ' + (mPts > 0 ? 'favors ' + c.dir + 's' : 'works against ' + c.dir + 's'), pts: mPts });
        tally += mPts;
      }
      if (verdict === 'longs-crowding' || verdict === 'shorts-crowding'){
        var pPts, pLab;
        if (verdict === 'longs-crowding'){
          pPts = (c.dir === 'short') ? 1 : -1;
          pLab = 'PAXG basis ' + basisTxt + ' — leveraged longs crowding (fade risk for longs)';
        } else {
          pPts = (c.dir === 'long') ? 1 : -1;
          pLab = 'PAXG basis ' + basisTxt + ' — shorts crowding (squeeze fuel for longs)';
        }
        parts.push({ label: pLab, pts: pPts });
        tally += pPts;
      }
      if (season && season.bias === 'STRONG' && c.dir === 'long'){
        parts.push({ label: 'seasonal tailwind — Jan–Feb is historically gold\u2019s strongest stretch', pts: 1 });
        tally += 1;
      }
      if (fngV !== null){
        if (fngV <= 25 && c.dir === 'long'){
          parts.push({ label: 'crypto fear & greed ' + fngV + ' — extreme fear, risk-off bid for gold', pts: 1 });
          tally += 1;
        } else if (fngV >= 75 && c.dir === 'short'){
          parts.push({ label: 'crypto fear & greed ' + fngV + ' — extreme greed, risk-on weighs on gold', pts: 1 });
          tally += 1;
        }
      }
      var rc = {};
      for (k in c){ if (Object.prototype.hasOwnProperty.call(c, k)) rc[k] = c[k]; }
      rc.tally = tally;
      rc.tallyParts = parts;
      try{
        var gradeFn = gfn('hgGoldGradeFromScore');
        if (gradeFn){
          rc.grade = gradeFn(tally, !!(news.caution || c.newsCaution));
        } else {
          rc.grade = (tally >= 8) ? 'A' : ((tally >= 5) ? 'B' : 'C');
          if ((news.caution || c.newsCaution) && rc.grade === 'A') rc.grade = 'B';
          else if ((news.caution || c.newsCaution) && rc.grade === 'B') rc.grade = 'C';
        }
      }catch(eGr){}
      if (typeof hgSetupStackFromTallyParts === 'function'){
        try{
          var macroIn = null;
          if (hint === 'TAILWIND' || hint === 'HEADWIND'){
            macroIn = { hint: hint === 'TAILWIND' ? 'tailwind for longs' : 'headwind for longs' };
          }
          var goldPos = null;
          if (verdict === 'longs-crowding' && c.dir === 'long'){
            goldPos = { warn: 'PAXG longs crowding — fade risk' };
          } else if (verdict === 'shorts-crowding' && c.dir === 'short'){
            goldPos = { warn: 'PAXG shorts crowding — squeeze risk' };
          }
          try{
            var cotSt = (typeof window !== 'undefined') ? window.__hgGoldCot : null;
            if (cotSt && cotSt.crowding === 'SPEC CROWDED LONG' && c.dir === 'long'){
              goldPos = goldPos || {};
              goldPos.cot = 'COT spec crowded long — weekly positioning caution';
            } else if (cotSt && cotSt.crowding === 'SPEC CROWDED SHORT' && c.dir === 'short'){
              goldPos = goldPos || {};
              goldPos.cot = 'COT spec crowded short — weekly positioning caution';
            }
          }catch(eC){}
          rc.stack = hgSetupStackFromTallyParts(parts, {
            dir: c.dir, sym: c.sym || 'XAUUSD', style: (ctx.style || 'goldswing'),
            asset: 'gold', tally: tally, grade: c.grade,
            macro: macroIn, goldPositioning: goldPos,
            fng: fng
          });
        }catch(eSt){}
      }
      ranked.push(rc);
    }
    var gOrd = { A: 0, B: 1, C: 2 };
    ranked.sort(function(x, y){
      if (y.tally !== x.tally) return y.tally - x.tally;
      var gx = (gOrd[x.grade] === undefined) ? 9 : gOrd[x.grade];
      var gy = (gOrd[y.grade] === undefined) ? 9 : gOrd[y.grade];
      if (gx !== gy) return gx - gy;
      var ax = isFinite(x.agree) ? x.agree : 0;
      var ay = isFinite(y.agree) ? y.agree : 0;
      return ay - ax;
    });
    out.ranked = ranked;
    out.best = ranked.length ? ranked[0] : null;   /* MOST PROBABLE = highest tally */
    return out;
  }catch(e){ return { ranked: [], best: null, rejected: [] }; }
}

/* ---------------- scan ---------------- */
var __scan = { busy: false, hasRun: false, ui: null };

function setStat(ui, t, warn){
  if (!ui || !ui.stat) return;
  ui.stat.textContent = t;
  ui.stat.className = warn ? 'note warn' : 'note';
}
function setProg(ui, f){
  if (!ui || !ui.prog) return;
  ui.prog.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && ui.prog.firstElementChild) ui.prog.firstElementChild.style.width = (f*100).toFixed(1) + '%';
}

async function runScan(ui, scanSt){
  scanSt = scanSt || __scan;
  if (scanSt.busy) return 'busy';
  scanSt.busy = true;
  scanSt.visionGen = (scanSt.visionGen || 0) + 1;
  var visionGen = scanSt.visionGen;
  var t0 = Date.now();
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    /* Keep last cards while rescanning — same race as GOLD SCALP. */
    var hadCards = !!(ui && ui.cards && ui.cards.innerHTML && ui.cards.innerHTML.length);
    if (ui && ui.empty) ui.empty.style.display = 'none';
    setProg(ui, 0);
    var stRouteEarly = !!(scanSt && scanSt.useStartraderRouting);
    if (stRouteEarly){
      if (!gfn('getXAUCandles') && !gfn('startraderCandles')){
        setStat(ui, 'XAUUSD candle layer missing — getXAUCandles / startraderCandles not loaded (check script order).', true);
        return 'error: no XAUUSD klines layer';
      }
    } else if (!gfn('getGoldCandles') && !gfn('binanceKlines')){
      setStat(ui, 'gold klines layer missing — macro.js getGoldCandles / binance.js binanceKlines not loaded (check script order).', true);
      return 'error: no klines layer';
    }

    setStat(ui, hadCards ? 'rescanning… previous results still showing' : 'pulling gold klines 4h/1d…');
    var now = Date.now();
    var newsRaw = null;
    var ns = gfn('hgNewsState');
    if (ns){ try{ newsRaw = ns(); }catch(eN){ newsRaw = null; } }
    var seasonFn = gfn('goldSeason');
    var season = null;
    if (seasonFn){ try{ season = seasonFn(now); }catch(eSe){ season = null; } }

    /* shared ±30-min high-impact window check (goldind.js export preferred,
       identical local math as the honest fallback) */
    var newsC = { caution: false, title: null };
    var ncFn = gfn('goldNewsCaution');
    if (newsRaw){
      if (ncFn){
        try{ var nc = ncFn(newsRaw, now); if (nc){ newsC.caution = !!nc.caution; newsC.title = nc.title || null; } }catch(eNc){}
      } else {
        try{
          var evs = Array.isArray(newsRaw.events) ? newsRaw.events : [];
          for (var ei = 0; ei < evs.length; ei++){
            var ev = evs[ei];
            if (!ev || ev.impact !== 'high') continue;
            var et = (+ev.t < 1e12) ? (+ev.t)*1000 : +ev.t;
            if (isFinite(et) && Math.abs(et - now) <= 30*60*1000){ newsC.caution = true; newsC.title = ev.title || null; break; }
          }
        }catch(eNc2){}
      }
    }

    /* session context (goldKillzone) — shown on cards, never a swing gate */
    var sessionTxt = 'n/a';
    var kzFn = gfn('goldKillzone');
    if (kzFn){
      try{
        var kz = kzFn(now);
        if (kz && kz.label){
          var hh = isFinite(kz.hourGMT) ? ('0' + kz.hourGMT).slice(-2) + ':00 GMT' : 'n/a';
          sessionTxt = kz.label + ' · ' + hh;
        }
      }catch(eK){}
    }

    /* ranking context legs — every one optional, every one catch-isolated */
    var ctx = { now: now, news: newsC, season: season, macro: null, spot: null, fng: null,
                fundingRate: null, style: 'goldswing', perpNative: null };
    var gm = gfn('getGoldMacro');
    if (gm){
      setStat(ui, 'reading macro tilt (DXY · US10Y · gold/silver ratio)…');
      try{ ctx.macro = await gm(); }catch(eM){ ctx.macro = null; }
    }
    try{
      var loadP = gfn('hgGoldLoadDeltaPerp');
      var loadF = gfn('hgGoldLoadFedCalendar');
      var mergeF = gfn('hgGoldMergeFedFomc');
      var waits = [];
      if (loadP){
        waits.push(Promise.resolve().then(function(){ return loadP({ symbol: 'XAUTUSD', resolution: '1h' }); })
          .then(function(j){ ctx.perpNative = j; }).catch(function(){}));
      }
      if (loadF){
        waits.push(Promise.resolve().then(function(){ return loadF(); })
          .then(function(j){
            if (mergeF && j && j.ok){
              newsRaw = mergeF(newsRaw || {}, j);
              newsC = newsRaw;
              ctx.news = newsC;
            }
          }).catch(function(){}));
      }
      if (waits.length){
        await Promise.race([
          Promise.all(waits),
          new Promise(function(r){ setTimeout(r, 8000); })
        ]);
      }
    }catch(ePerp){}
    var gss = gfn('goldspotState');
    if (gss){ try{ ctx.spot = gss(); }catch(eS0){ ctx.spot = null; } }
    try{ if (typeof S !== 'undefined' && S && S.fng) ctx.fng = S.fng; }catch(eF){ ctx.fng = null; }
    var gps = gfn('goldProState');
    if (gps){ try{ ctx.goldPro = gps(); }catch(eGp){ ctx.goldPro = null; } }
    var bf = gfn('binanceFunding');
    if (bf){
      try{
        var frLeg = await bf('PAXGUSDT');
        if (frLeg && isFinite(frLeg.fundingPct)) ctx.fundingRate = frLeg.fundingPct;
      }catch(eFr){}
    }

    var microOpts = {};
    if (ctx.macro && ctx.macro.us10yCandles) microOpts.us10yCandles = ctx.macro.us10yCandles;
    if (newsRaw) microOpts.news = newsRaw;
    if (ctx.perpNative && ctx.perpNative.ok){
      microOpts.perpNative = ctx.perpNative;
      microOpts.oiRows = ctx.perpNative.oi;
      microOpts.fundingRows = ctx.perpNative.funding;
    }
    if (typeof W !== 'undefined' && W){
      if (W.__hgGoldTickBuffer) microOpts.tickBuffer = W.__hgGoldTickBuffer;
      if (W.__hgGoldL2Book) microOpts.l2OrderBook = W.__hgGoldL2Book;
      if (isFinite(W.__hgGoldDomDepth)) microOpts.domDepth = W.__hgGoldDomDepth;
      if (isFinite(W.__hgGoldSpreadUsd)) microOpts.spreadUsd = W.__hgGoldSpreadUsd;
      if (W.__hgGoldQuote){
        if (isFinite(W.__hgGoldQuote.bid)) microOpts.bid = W.__hgGoldQuote.bid;
        if (isFinite(W.__hgGoldQuote.ask)) microOpts.ask = W.__hgGoldQuote.ask;
        if (isFinite(W.__hgGoldQuote.spreadUsd)) microOpts.spreadUsd = W.__hgGoldQuote.spreadUsd;
      }
    }

    var cands = [], legs = [], venueRows = {}, rejectedAll = [], i;
    var armedAll = [], watchMeta = {};
    function collectWatch(leg, venue){
      try{
        if (leg && leg.rows4h && leg.rows4h.length){
          var lc = leg.rows4h[leg.rows4h.length - 1];
          var aArr = _atr(leg.rows4h, 14);
          watchMeta[venue] = { atr: (aArr && aArr.length) ? aArr[aArr.length - 1] : NaN,
                               lastClose: (lc && isFinite(lc.c)) ? lc.c : NaN };
        }
        var wl = buildWatch(leg, now, ctx.macro, venue);
        for (var wi = 0; wi < wl.length; wi++){ if (wl[wi]) armedAll.push(wl[wi]); }
      }catch(eW){}
    }

    var stRoute = !!(scanSt && scanSt.useStartraderRouting);
    /* leg 1: primary gold feed */
    var gold = stRoute ? await fetchStartraderGoldKlines() : await fetchGoldKlines();
    /* 1H execution leg for the 7-step engine (400 × 1H) — catch-isolated, 8s cap,
       never blocks the 4H swing scan. */
    try{
      var load1h = gfn('hgGoldSevenStepLoad1h');
      if (load1h){
        var leg1h = await Promise.race([
          Promise.resolve().then(function(){ return load1h(400); }),
          new Promise(function(r){ setTimeout(function(){ r(null); }, 8000); })
        ]);
        if (leg1h && leg1h.rows && leg1h.rows.length){
          gold.rows1h = leg1h.rows;
          if (gold.src) gold.src['1h'] = leg1h.source;
          gold.basis1h = leg1h.basisPct;
        }
      }
    }catch(e1h){}
    /* Settle open gold records with the bars just fetched, BEFORE this scan
       records anything — so a setup can never be settled by the bar it was
       written on. Placed here rather than in publishScan because that
       function never receives the candles; the earlier attempt referenced an
       out-of-scope rows4h and would have failed silently inside its own
       try/catch, which is the exact pattern this work is meant to remove. */
    try {
      if (typeof W.hgFwdResolve === 'function' && gold && gold.rows4h && gold.rows4h.length){
        W.hgFwdResolve('XAUUSD', null, gold.rows4h);
      }
    } catch (eRes) { try { if (typeof window.hgFwdWarn === "function") window.hgFwdWarn("goldswing", eRes); } catch (eW) {} }
    try{
      if (typeof W.hgVolFromCloses === 'function' && gold.rows4h && gold.rows4h.length >= 30){
        W.__hgGoldVolPack = W.hgVolFromCloses(gold.rows4h.map(function(r){ return r.c; }));
      }
    }catch(eVol){}
    setProg(ui, 0.45);
    if (gold.src && gold.src['4h']) microOpts.candleSource = gold.src['4h'];
    else if (gold.source) microOpts.candleSource = gold.source;
    if (gold.rows4h.length){
      var v = (gold.source === 'xm-xauusd') ? venueLabel(gold.source)
        : (stRoute ? stGoldVenueLabel(gold.source) : venueLabel(gold.source));
      var sym1 = (gold.source === 'xm-xauusd' || stRoute) ? ST_GOLD_SYM
        : ((gold.source === 'binance-paxg') ? 'PAXGUSDT' : 'XAUUSDT');
      venueRows[v] = { rows4h: gold.rows4h };
      var got = buildCandidates(gold, now, newsC, ctx.macro, sessionTxt, v, sym1, microOpts);
      try{
        var oiFn = gfn('hgGoldOiTrap');
        var fundFn = gfn('hgGoldFundingExtreme');
        var applyP = gfn('hgGoldApplyPerpNative');
        var sweepFn = gfn('hgGoldSweepEngine');
        if (applyP && ctx.perpNative && ctx.perpNative.ok){
          var oiHit = oiFn ? oiFn(gold.rows4h, ctx.perpNative.oi, {}) : null;
          var fundHit = fundFn ? fundFn(ctx.perpNative.funding, {}) : null;
          for (var pi = 0; pi < got.length; pi++) applyP(got[pi], oiHit, fundHit);
        }
        if (sweepFn && got.length){
          var swEng = sweepFn(gold.rows4h, {
            regime: null,
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null
          });
          if (swEng && swEng.dir){
            for (var si = 0; si < got.length; si++){
              if (!got[si]) continue;
              if (!Array.isArray(got[si].stamps)) got[si].stamps = [];
              if (got[si].dir === swEng.dir && (swEng.confirmed || swEng.tier === 'alert')){
                if (got[si].stamps.indexOf('LIQ SWEEP') < 0) got[si].stamps.push('LIQ SWEEP');
                got[si].sweepScore = swEng.score;
              } else if (got[si].dir && swEng.dir && got[si].dir !== swEng.dir && swEng.confirmed){
                got[si].demoted = true;
                if (got[si].stamps.indexOf('SWEEP OPPOSE') < 0) got[si].stamps.push('SWEEP OPPOSE');
              }
            }
          }
        }
        var nyFn = gfn('hgGoldNyExhaustion');
        if (nyFn && got.length){
          var nyEng = nyFn(gold.rows4h, {
            regime: null,
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            now: now
          });
          if (nyEng && nyEng.dir){
            for (var ni = 0; ni < got.length; ni++){
              if (!got[ni]) continue;
              if (!Array.isArray(got[ni].stamps)) got[ni].stamps = [];
              if (got[ni].dir === nyEng.dir && (nyEng.confirmed || nyEng.tier === 'alert')){
                if (got[ni].stamps.indexOf('NY EXHAUSTION') < 0) got[ni].stamps.push('NY EXHAUSTION');
                got[ni].nyExhScore = nyEng.score;
                if (got[ni].stamps.indexOf('CVD PROXY') < 0) got[ni].stamps.push('CVD PROXY');
              } else if (got[ni].dir && nyEng.dir && got[ni].dir !== nyEng.dir && nyEng.confirmed){
                got[ni].demoted = true;
                if (got[ni].stamps.indexOf('NY EXH OPPOSE') < 0) got[ni].stamps.push('NY EXH OPPOSE');
              }
            }
          }
        }
        var sobFn = gfn('hgGoldSweepOb');
        if (sobFn && got.length){
          var sobEng = sobFn(gold.rows4h, {
            regime: null,
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            now: now,
            rows4h: gold.rows4h,
            rows1h: gold.rows1h || gold.rows4h
          });
          if (sobEng && sobEng.dir){
            for (var soi = 0; soi < got.length; soi++){
              if (!got[soi]) continue;
              if (!Array.isArray(got[soi].stamps)) got[soi].stamps = [];
              if (got[soi].dir === sobEng.dir && (sobEng.confirmed || sobEng.tier === 'alert')){
                if (got[soi].stamps.indexOf('SWEEP→OB') < 0) got[soi].stamps.push('SWEEP→OB');
                got[soi].sweepObScore = sobEng.quality ? sobEng.quality.score : sobEng.score;
                got[soi].sweepObMode = sobEng.mode;
              } else if (got[soi].dir && sobEng.dir && got[soi].dir !== sobEng.dir && sobEng.confirmed){
                got[soi].demoted = true;
                if (got[soi].stamps.indexOf('SWEEP→OB OPPOSE') < 0) got[soi].stamps.push('SWEEP→OB OPPOSE');
              }
            }
          }
        }
        var sbFn = gfn('hgGoldSessionBoundSweep');
        if (sbFn && got.length){
          var sbEng = sbFn(gold.rows4h, {
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            now: now
          });
          if (sbEng && sbEng.dir && (sbEng.confirmed || sbEng.reclaimOk)){
            for (var sbi = 0; sbi < got.length; sbi++){
              if (!got[sbi]) continue;
              if (!Array.isArray(got[sbi].stamps)) got[sbi].stamps = [];
              if (got[sbi].dir === sbEng.dir){
                if (got[sbi].stamps.indexOf('SILVER BULLET') < 0) got[sbi].stamps.push('SILVER BULLET');
                got[sbi].silverBWindow = sbEng.window;
              } else if (got[sbi].dir && got[sbi].dir !== sbEng.dir && sbEng.confirmed){
                got[sbi].demoted = true;
                if (got[sbi].stamps.indexOf('SILVER BULLET OPPOSE') < 0)
                  got[sbi].stamps.push('SILVER BULLET OPPOSE');
              }
            }
          }
        }
        var p4Fn = gfn('hgGoldPart4Engine');
        var p4Filt = gfn('hgGoldPart4ApplyDiscountFilter');
        if (p4Fn && got.length){
          var p4Eng = p4Fn(gold.rows4h, {
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null
          });
          if (p4Eng){
            for (var p4si = 0; p4si < got.length; p4si++){
              if (!got[p4si]) continue;
              if (!Array.isArray(got[p4si].stamps)) got[p4si].stamps = [];
              if (p4Filt && p4Eng.pd) p4Filt(got[p4si], p4Eng.pd);
              if (p4Eng.ok && got[p4si].stamps.indexOf('PART4') < 0) got[p4si].stamps.push('PART4');
            }
          }
        }
        var p5Fn = gfn('hgGoldPart5Engine');
        var p5Reg = gfn('hgGoldPart5ApplyRegimeFilter');
        var p5Bias = gfn('hgGoldPart5ApplyWeeklyBiasFilter');
        if (p5Fn && got.length){
          var p5Eng = p5Fn(gold.rows4h, {
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            now: now
          });
          if (p5Eng){
            for (var p5si = 0; p5si < got.length; p5si++){
              if (!got[p5si]) continue;
              if (!Array.isArray(got[p5si].stamps)) got[p5si].stamps = [];
              if (p5Reg && p5Eng.ker) p5Reg(got[p5si], p5Eng.ker);
              if (p5Bias && p5Eng.bias) p5Bias(got[p5si], p5Eng.bias);
              if (p5Eng.ok && got[p5si].stamps.indexOf('PART5') < 0) got[p5si].stamps.push('PART5');
            }
          }
        }
        var p6Fn = gfn('hgGoldPart6Engine');
        var p6Ev = gfn('hgGoldPart6ApplyEventFilter');
        var p6Corr = gfn('hgGoldPart6ApplyCorrFilter');
        if (p6Fn && got.length){
          var p6Eng = p6Fn(gold.rows4h, {
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            now: now
          });
          if (p6Eng){
            for (var p6si = 0; p6si < got.length; p6si++){
              if (!got[p6si]) continue;
              if (!Array.isArray(got[p6si].stamps)) got[p6si].stamps = [];
              if (p6Ev && p6Eng.eventTpl) p6Ev(got[p6si], p6Eng.eventTpl);
              if (p6Corr && p6Eng.corr) p6Corr(got[p6si], p6Eng.corr);
              if (p6Eng.ok && got[p6si].stamps.indexOf('PART6') < 0) got[p6si].stamps.push('PART6');
            }
          }
        }
        var p7Fn = gfn('hgGoldPart7Engine');
        if (p7Fn && got.length){
          var p7Eng = p7Fn(gold.rows4h, {
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            now: now,
            silverRows: microOpts && microOpts.silverRows,
            usdInr: microOpts && microOpts.usdInr
          });
          if (p7Eng){
            for (var p7si = 0; p7si < got.length; p7si++){
              if (!got[p7si]) continue;
              if (!Array.isArray(got[p7si].stamps)) got[p7si].stamps = [];
              if (p7Eng.ok && got[p7si].stamps.indexOf('PART7') < 0) got[p7si].stamps.push('PART7');
              if (p7Eng.season && p7Eng.season.active
                && got[p7si].stamps.indexOf('S48 SEASONAL') < 0)
                got[p7si].stamps.push('S48 SEASONAL');
            }
          }
        }
        var smcHitFn = gfn('hgGoldSmcLiquidityHit');
        if (smcHitFn && got.length){
          var smcHit = smcHitFn(gold.rows4h, { closeBreak: true, maxAge: 12 });
          if (smcHit && smcHit.ok && smcHit.dir){
            for (var smci = 0; smci < got.length; smci++){
              if (!got[smci]) continue;
              if (!Array.isArray(got[smci].stamps)) got[smci].stamps = [];
              if (got[smci].dir === smcHit.dir){
                if (got[smci].stamps.indexOf('SMC LIQ') < 0) got[smci].stamps.push('SMC LIQ');
                got[smci].smcSweptAge = smcHit.sweptAge;
              } else if (got[smci].dir && got[smci].dir !== smcHit.dir){
                got[smci].demoted = true;
                if (got[smci].stamps.indexOf('SMC LIQ OPPOSE') < 0) got[smci].stamps.push('SMC LIQ OPPOSE');
              }
            }
          }
        }
        var vpPbFn = gfn('hgGoldVpPlaybook');
        if (vpPbFn && got.length){
          var vpPb = vpPbFn(gold.rows4h, {
            now: now,
            newsGate: newsRaw ? (gfn('hgGoldNewsGate') ? gfn('hgGoldNewsGate')(newsRaw, now) : null) : null,
            rows4h: gold.rows4h
          });
          if (vpPb && vpPb.ok){
            for (var vpi = 0; vpi < got.length; vpi++){
              if (!got[vpi]) continue;
              if (!Array.isArray(got[vpi].stamps)) got[vpi].stamps = [];
              if (vpPb.decision === 'ENTER' && got[vpi].dir === vpPb.dir){
                if (got[vpi].stamps.indexOf('VP ENTER') < 0) got[vpi].stamps.push('VP ENTER');
                if (vpPb.halfSize) got[vpi].demoted = true;
              } else if (vpPb.decision === 'NO ENTRY' && vpPb.dir && got[vpi].dir === vpPb.dir
                  && vpPb.gatesPass < 8){
                if (got[vpi].stamps.indexOf('VP BLOCK') < 0) got[vpi].stamps.push('VP BLOCK');
              }
            }
          }
        }
      }catch(ePn){}
      collectWatch(gold, v);
      for (i = 0; i < got.length; i++) cands.push(got[i]);
      for (i = 0; i < (got.rejected || []).length; i++) rejectedAll.push(got.rejected[i]);
      legs.push(v + ': ' + gold.rows4h.length + ' 4h bars — '
        + (got.length ? got.length + ' strategy candidate' + (got.length === 1 ? '' : 's') : 'no qualifying confluence'));
      if (gold.mixed){
        var mixTxt = (typeof hgGoldSrcMixedLabel === 'function') ? hgGoldSrcMixedLabel(gold.src) : '';
        legs.push('MIXED FEED — ' + mixTxt + ' · cross-timeframe alignment is comparing two different markets');
      }
    } else {
      legs.push('primary gold feed: no 4h klines from any source (macro chain + PAXGUSDT both failed)');
    }

    legs.push('DELTA XAUTUSD: skipped — gold swing uses broker-aligned XAUUSD spot only');

    /* ranking: transparent confluence tally across ALL venues */
    var cvFn = gfn('goldCrossVenueMap');
    if (cvFn) ctx.crossVenue = cvFn(cands);
    var klineSpot = goldSpotRefFromRows(gold.rows4h);
    var liveSpot = await goldLiveSpotRef(klineSpot);
    var spotRef = (isFinite(liveSpot) && liveSpot > 0) ? liveSpot : klineSpot;
    if (isFinite(liveSpot) && isFinite(klineSpot) && Math.abs(klineSpot / liveSpot - 1) * 100 > 0.5){
      legs.push('spot anchor ~$' + pxF(liveSpot) + ' (klines ~$' + pxF(klineSpot) + ') — levels scaled to live spot');
      /* MOVED: alignment now runs AFTER the best-levels batch below.
         Aligning here was silently undone — hgApplyGoldBestLevels and the
         hgFormTicket fallback both re-derive entry/stop/targets from the
         raw FEED rows, overwriting the spot-scaled levels with feed-priced
         ones for every non-locked candidate. The reader then saw levels
         that matched neither the feed nor the broker. One alignment, last,
         after every engine that rewrites levels has run. */
    } else if (isFinite(liveSpot)){
      legs.push('spot anchor ~$' + pxF(liveSpot) + ' (gold-api.com)');
    }
    var convPre = loadConvictions();
    var purged = goldPurgeStaleConvictions(convPre, liveSpot);
    var geoN = goldPurgeBadGeometry(convPre);
    if (purged || geoN) saveConvictions(convPre);
    if (purged) legs.push('cleared ' + purged + ' stale conviction' + (purged === 1 ? '' : 's') + ' (XAUT / off-spot locks)');
    if (geoN) legs.push('cleared ' + geoN + ' illegal-geometry conviction' + (geoN === 1 ? '' : 's') + ' (TP1 on the risk side)');
    var rk = rankSetups(cands, ctx);
    var ranked = rk.ranked, best = rk.best;
    for (i = 0; i < (rk.rejected || []).length; i++) rejectedAll.push(rk.rejected[i]);
    goldAnnotateXautBasis(ranked, spotRef);
    var naiveBest = best;
    best = goldPickSpotAlignedBest(ranked, spotRef);
    if (naiveBest && best && naiveBest.sym === 'XAUTUSD' && best.sym !== 'XAUTUSD' && isFinite(spotRef)){
      legs.push('MOST PROBABLE: ' + best.venue + ' ~$' + pxF(best.entry)
        + ' (spot ref ~$' + pxF(spotRef) + ') — not Delta XAUTUSD ~$' + pxF(naiveBest.entry)
        + ' (XAUT trades at a discount to spot)');
    }

    var filterFn = gfn('hgFilterGoldPostGate');
    if (filterFn){
      try{
        ranked = await filterFn(ranked, venueRows, gold.rows4h, 'gold-swing');
      }catch(ePg){
        /* The whole post-gate never ran. Every candidate is unchecked, not
           clean — mark them so the card cannot imply a gate that passed. */
        var mkFn = gfn('hgMarkGateUnchecked');
        var pgWhy = 'post-gate filter threw: ' + ((ePg && ePg.message) ? ePg.message : String(ePg));
        for (var pgI = 0; pgI < ranked.length; pgI++){
          if (mkFn) mkFn(ranked[pgI], [pgWhy]);
        }
        try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('GOLDSWING', pgWhy); }catch(ePg2){}
      }
    }
    var wkFn = gfn('hgApplyGoldWeekendDemotes');
    var atrW = NaN;
    if (gold.rows4h && gold.rows4h.length){
      try{
        var aArrW = _atr(gold.rows4h, 14);
        atrW = (aArrW && aArrW.length) ? aArrW[aArrW.length - 1] : NaN;
      }catch(eA){}
    }
    if (wkFn && gold.rows4h && gold.rows4h.length){
      try{ wkFn(ranked, gold.rows4h, atrW, now); }catch(eWk){}
    }
    var promoteFn = gfn('goldWatchPromote');
    if (promoteFn){
      var promoteCands = ranked.filter(function(c){ return c && !c.demoted && !c.vetoed && !c.dropped; });
      armedAll = promoteFn(promoteCands, armedAll);
    }
    if (ctx.goldPro && ctx.goldPro.word){
      for (var gp = 0; gp < ranked.length; gp++){
        var gc0 = ranked[gp];
        if (!gc0) continue;
        var fav = (ctx.goldPro.word === 'STRUCTURAL BULL') ? 'long'
                : ((ctx.goldPro.word === 'STRUCTURAL BEAR') ? 'short' : null);
        if (fav && gc0.dir === fav) gc0.goldProChip = 'GOLD PRO ' + ctx.goldPro.word;
        else if (ctx.goldPro.word !== 'NEUTRAL') gc0.goldProChip = 'GOLD PRO conflict';
      }
    }
    var applyBlFn = gfn('hgApplyGoldBestLevels');
    if (applyBlFn && gold.rows4h && gold.rows4h.length){
      goldApplyBestLevelsBatch(ranked, gold, atrW, now);
    } else {
    var formFn = gfn('hgFormTicket');
    if (formFn && gold.rows4h && gold.rows4h.length){
      for (var fi2 = 0; fi2 < ranked.length; fi2++){
        var gc2 = ranked[fi2];
        if (!gc2 || gc2.demoted || gc2.vetoed) continue;
        try{
          var gHit2 = Object.assign({}, gc2, {
            mark: gc2.pxNow || (gold.rows4h.length ? gold.rows4h[gold.rows4h.length - 1].c : gc2.entry),
            structStop: gc2.structStop || gc2.anchor
          });
          var gfm2 = formFn(gHit2, { rows: gold.rows4h, style: 'gold-swing', a4: atrW,
            rankBoost: (gc2.agree || 0) });
          if (!gfm2.ok){ gc2.demoted = true; gc2.demoteReason = gfm2.reason || 'formation'; continue; }
          if (gfm2.hit){
            gc2.formationScore = gfm2.formationScore;
            gc2.entryType = gfm2.hit.entryType;
            gc2.entryGuidance = gfm2.hit.entryGuidance;
            gc2.fillProb = gfm2.hit.fillProb;
            gc2.fillNote = gfm2.hit.fillNote;
            gc2.planSrc = gfm2.hit.planSrc;
            if (!gc2.locked){
              if (isFinite(gfm2.hit.entry)) gc2.entry = gfm2.hit.entry;
              if (isFinite(gfm2.hit.stop)) gc2.stop = gfm2.hit.stop;
              if (isFinite(gfm2.hit.t1)) gc2.t1 = gfm2.hit.t1;
              if (isFinite(gfm2.hit.t2)) gc2.t2 = gfm2.hit.t2;
            }
            /* Same rule as the best-levels path: R:R is recomputed from the
               levels now on the card, and cleared where it cannot be — never
               left over from the plan these levels replaced. */
            var syncRrFn = gfn('hgSyncPlanRr');
            if (syncRrFn) syncRrFn(gc2);
          }
        }catch(eGf2){}
      }
    }
    }

    /* SPOT ALIGNMENT — LAST. Every engine above re-derives levels from the
       feed rows; running the scale before them meant it was overwritten and
       the card showed feed-basis levels against a broker-basis market. The
       conviction lock below restores its stored spot-basis levels verbatim
       afterward, so locked cards are never double-scaled. */
    if (isFinite(liveSpot) && isFinite(klineSpot) && Math.abs(klineSpot / liveSpot - 1) * 100 > 0.5){
      goldAlignLevelsToSpot(ranked, klineSpot, liveSpot);
    }

    /* CONVICTION LOCK — restore issued levels verbatim; transitions only on
       invalidation against the latest 4h close (STOPPED / TARGET HIT /
       EXPIRED after 5 days); never re-pick levels for a live conviction */
    var lock = applyConviction(ranked, venueRows, now);
    if (isFinite(liveSpot) && liveSpot > 0){
      var guardedSw = goldSpotGuardAfterLock(lock.store, ranked, liveSpot);
      if (guardedSw){
        saveConvictions(lock.store);
        legs.push('spot guard — cleared/realigned ' + guardedSw + ' off-spot conviction' + (guardedSw === 1 ? '' : 's'));
      }
    }

    var display = mergeLiveDisplayCards(ranked, lock.store);
    if (isFinite(liveSpot) && liveSpot > 0 && display.length){
      goldSpotGuardAfterLock(lock.store, display, liveSpot);
      display = display.filter(function(c){ return c && !c.vetoed; });
    }
    var displayBest = best;
    if (!displayBest && display.length) displayBest = display[0];
    var deskTape = goldUniformTapeOf(gold.rows4h);
    displayBest = goldTapeAlignedBest(displayBest, display, deskTape);
    goldStampTape(display, deskTape);
    if (newsC && newsC.caution){
      for (var dix = 0; dix < display.length; dix++){
        var dc = display[dix];
        if (!dc) continue;
        dc.newsCaution = true;
        dc.newsStamp = SW_NEWS_STAMP + (newsC.title ? ' (' + newsC.title + ')' : '');
        if (dc.grade === 'A') dc.grade = 'B';
        else if (dc.grade === 'B') dc.grade = 'C';
      }
    }

    if (lock.transitions.length){
      legs.push(lock.transitions.length + ' conviction' + (lock.transitions.length === 1 ? '' : 's')
        + ' closed (' + lock.transitions.map(function(t){ return t.status; }).join(', ').toLowerCase() + ')');
    }
    var liveN = 0;
    for (var k in lock.store.live){ if (Object.prototype.hasOwnProperty.call(lock.store.live, k)) liveN++; }

    /* WHY SILENT — the honest lead reason when zero candidates qualify */
    var whySilent = null;
    if (!display.length){
      whySilent = whySilentText({
        newsCaution: !!(newsC && newsC.caution), newsTitle: newsC ? newsC.title : null,
        feedsFailed: !gold.rows4h.length,
        liveN: liveN, armed: armedAll, watchMeta: watchMeta
      });
    }

    var basisHtml = stRoute ? stGoldBasisHtml() : '';
    var mixedBanner = goldMixedFeedBannerHtml(gold);
    var uniHtml = goldUniformPanelHtml(display, gold.rows4h, 'SWING', deskTape);
    paintGoldWeekendPanel(ui, gold.rows4h, now, displayBest);
    var aplusCtx = goldBuildAPlusCtx(ctx, gold, now, newsC);
    var aplusPack = goldEvalAPlusBatch(ranked, aplusCtx);
    try{
      var auditFn = gfn('hgTallyLegAudit');
      if (auditFn && typeof W !== 'undefined' && W && typeof W.hgScoreRecords === 'function'){
        W.__hgGoldTallyAudit = auditFn(W.hgScoreRecords().filter(function(r){ return r && r.lane === 'gold'; }));
      }
    }catch(eAu){}
    /* render */
    function sevenStepHtml(){
      /* Gold Playbook 7-step readout — 4H context, 1H execution, closed bars only.
         Feeds the same tape the uniform card uses so an against-tape candidate
         is HELD here exactly as it is there. */
      try{
        var sevenFn = gfn('hgGoldSevenStepPanel');
        if (!sevenFn) return '';
        var feed1h = (gold.src && (gold.src['1h'] || gold.src['4h'])) || gold.source || 'unavailable';
        var basis = NaN;
        try{ if (typeof S !== 'undefined' && S && isFinite(+S.goldBasisPct)) basis = +S.goldBasisPct; }catch(eB){}
        return sevenFn({
          rows1h: gold.rows1h || [], rows4h: gold.rows4h, now: now,
          feed: feed1h, venue: (feed1h === 'delta-xaut') ? 'analysis feed' : 'Delta XAUTUSD', basisPct: basis,
          macro: ctx.macro, dxyRows: ctx.macro && ctx.macro.dxyRows, news: ctx.news,
          perpNative: ctx.perpNative, fundingRate: ctx.fundingRate, tape: deskTape
        });
      }catch(eSeven){ return ''; }
    }
    function formingLayersHtml(){
      try{
        var fsFn = gfn('hgGoldFormingStack');
        var fhFn = gfn('hgGoldFormingStackHtml');
        if (!fsFn || !fhFn) return sevenStepHtml();
        return sevenStepHtml() + fhFn(fsFn({
          rows15m: gold.rows4h, rows4h: gold.rows4h, macro: ctx.macro,
          dxyRows: ctx.macro && ctx.macro.dxyRows, now: now,
          perpNative: ctx.perpNative,
          oiRows: ctx.perpNative && ctx.perpNative.oi,
          fundingRows: ctx.perpNative && ctx.perpNative.funding
        }));
      }catch(eFs){ return ''; }
    }
    if (ui && ui.cards && ui.empty){
      if (display.length){
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = basisHtml + mixedBanner + aplusPack.panel + uniHtml + bannerHTML(displayBest, display)
          + display.map(function(c){ return cardHTML(c, !!(displayBest && c.id === displayBest.id), season && season.note, deskTape); }).join('')
          + formingLayersHtml()
          + formingNowHTML(armedAll)
          + rejectedHTML(rejectedAll)
          + historyHTML(lock.store.history);
      } else if (rejectedAll.length || armedAll.length){
        /* zero qualifying candidates but something to show: WHY SILENT leads,
           then the watch panel, then the held-back reason lines */
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = basisHtml + mixedBanner + uniHtml + (whySilent ? whySilentHTML(whySilent) : '')
          + formingLayersHtml()
          + rejectedHTML(rejectedAll)
          + formingNowHTML(armedAll)
          + historyHTML(lock.store.history);
      } else {
        /* feeds failed: cards stay empty (no fabricated setups); catalog lives on empty */
        ui.cards.innerHTML = basisHtml + uniHtml;
        var catH = '';
        try{
          var cFn = gfn('hgGoldCatalogHtml');
          var cEn = gfn('hgGoldCatalogEngine');
          if (cFn && cEn) catH = cFn(cEn([], {}));
        }catch(eCatE){}
        if (whySilent) ui.empty.innerHTML = '<b>WHY SILENT</b> — ' + esc(whySilent) + catH;
        else if (catH) ui.empty.innerHTML = catH;
        ui.empty.style.display = 'block';
      }
    }
    var secs = ((Date.now() - t0)/1000).toFixed(1);
    setStat(ui, legs.join(' · ') + ' · ' + liveN + ' live conviction' + (liveN === 1 ? '' : 's')
            + ' · ' + secs + 's · ' + new Date().toISOString().slice(11, 19) + ' UTC',
            !gold.rows4h.length);
    setProg(ui, null);
    if (gold.rows4h.length){
      publishState(display);                        /* only a real data run overwrites the snapshots */
      publishScan(display, displayBest, lock.store.history, now, rejectedAll, armedAll, whySilent);
      var visionEnrichGw = gfn('hgChartVisionEnrichSetups');
      var visionRefreshGw = gfn('hgChartVisionRefreshGoldCards');
      if (visionEnrichGw && display.length && ui && ui.cards){
        visionEnrichGw(display, function(c){
          var vr = venueRows[c.venue];
          return (vr && vr.rows4h && vr.rows4h.length) ? vr.rows4h : gold.rows4h;
        }, { limit: 3 }).then(function(){
          if (scanSt.visionGen !== visionGen) return;
          if (typeof visionRefreshGw === 'function'){
            visionRefreshGw({
              scanSt: scanSt, scanGen: visionGen, ui: ui, display: display, displayBest: displayBest,
              basisHtml: basisHtml + mixedBanner + aplusPack.panel + uniHtml, bannerHTML: bannerHTML, cardHTML: cardHTML,
              formingNowHTML: formingNowHTML, rejectedHTML: rejectedHTML, historyHTML: historyHTML,
              armedAll: armedAll, rejectedAll: rejectedAll, history: lock.store.history,
              seasonNote: season && season.note,
            });
          }
        });
      }
    }
    return 'refreshed';
  }catch(e){
    setStat(ui, 'scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    scanSt.busy = false;
    scanSt.hasRun = true;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
    setProg(ui, null);
  }
}

/* ---------------- mount / refresh / warm-up ---------------- */
function goldswingMountInto(el, scanSt, cfg){
  cfg = cfg || {};
  if (!el || !scanSt) return null;
  var p = cfg.prefix || 'gw';
  var h2 = cfg.heading || 'GOLD SWING';
  var span = cfg.subheading || 'multi-strategy 4h/1d swing engine · EMA50/200 pullbacks · weekly-range breaks · OB retests · macro-aligned continuation';
  var statIdle = cfg.statIdle || 'idle — composes per-strategy swing candidates on 4h/1d, ranks them by a transparent tally, and locks issued levels for up to 5 days.';
  var deskNote = cfg.showDeskNote !== false
    ? ('<div class="note" style="margin-top:8px">Desk note: gold respects levels — on the swing horizon it respects them for days. '
      + 'The engine composes ONE candidate per strategy trigger — <b>4h trend pullback</b> into the EMA50/200 confluence, '
      + '<b>weekly-range breakout</b> (prior week\u2019s high/low swept + reclaimed, or broken with displacement), '
      + '<b>4h order-block retest</b> at the origin of a structure break, and <b>macro-aligned trend continuation</b> '
      + '(a real daily EMA50/200 stack aligned with the real-rate backdrop — macro only tilts, it never fabricates a setup). '
      + 'Each candidate needs its trigger plus >=2 independent agreeing reads (strictly more than opposing); triggers without '
      + 'enough agreement are held back with the reason named below. Every candidate is ranked by a visible <b>confluence '
      + 'tally</b>: agreeing reads − high-impact news-window penalty ± macro tilt (DXY/US10Y) ± PAXG-basis positioning + '
      + 'seasonality + fear&amp;greed. The leader gets the <b>MOST PROBABLE SETUP</b> banner. Stops are 1.5–2× ATR14(4h), '
      + 'never tighter, anchored beyond the structure (OB edge / weekly-range edge / 200-EMA); targets 1.5R / 2.5R / 4R. '
      + 'Issued setups are <b>CONVICTION-LOCKED</b>: re-scans restore the original levels verbatim — they only move on '
      + 'invalidation against the latest 4h close (beyond stop → STOPPED, TP1 → TARGET HIT, 5 days → EXPIRED), and closed '
      + 'setups stay visible as history.</div>')
    : '';
  var emptyMsg = cfg.emptyMsg || 'no qualifying 4h/1d swing confluence right now — gold respects levels; let the structure come to you.';
  try{
    el.innerHTML =
      '<style>' + GW_CSS + '</style>'
      + '<div class="panel">'
      + '<h2>' + h2 + ' <span>' + span + '</span></h2>'
      + '<div class="row"><button class="btn" id="' + p + 'Run">RUN SCAN</button>'
      + '<span class="note" id="' + p + 'Stat">' + statIdle + '</span></div>'
      + deskNote
      + '<div class="prog" id="' + p + 'Prog"><i></i></div>'
      + '</div>'
      + '<div id="' + p + 'Weekend" class="gsw-weekend-wrap" style="display:none"></div>'
      + '<div id="' + p + 'Desk"></div>'
      + '<div class="cards" id="' + p + 'Cards"></div>'
      + '<div class="empty" id="' + p + 'Empty" style="display:none">' + emptyMsg + '</div>';

    var ui = {
      btn:   el.querySelector('#' + p + 'Run'),
      stat:  el.querySelector('#' + p + 'Stat'),
      prog:  el.querySelector('#' + p + 'Prog'),
      cards: el.querySelector('#' + p + 'Cards'),
      empty: el.querySelector('#' + p + 'Empty'),
      weekend: el.querySelector('#' + p + 'Weekend')
    };
    scanSt.ui = ui;
    scanSt.useStartraderRouting = !!cfg.useStartraderRouting;

    var missing = [];
    if (cfg.useStartraderRouting){
      if (!gfn('getXAUCandles') && !gfn('startraderCandles')) missing.push('XAUUSD candles (getXAUCandles / startraderCandles)');
    } else if (!gfn('getGoldCandles') && !gfn('binanceKlines')){
      missing.push('gold klines (macro.js getGoldCandles / binance.js binanceKlines)');
    }
    if (!gfn('goldSweeps') && !gfn('goldOrderBlocks') && !gfn('goldFVG') && !gfn('goldVWAP'))
      missing.push('goldind.js detectors (sweep/OB/FVG/VWAP evidence offline — trend-pullback, weekly-range and macro strategies still run on local math)');
    if (missing.length) setStat(ui, 'missing: ' + missing.join(', ') + '.', true);

    if (ui.btn) ui.btn.addEventListener('click', function(){ return runScan(ui, scanSt); });
    try{
      var catFnM = gfn('hgGoldCatalogEngine');
      var catHtmlM = gfn('hgGoldCatalogHtml');
      if (ui.cards && catFnM && catHtmlM) ui.cards.innerHTML = catHtmlM(catFnM([], {}));
    }catch(eCatM){}
    try{
      if (typeof hgSetupPaintDesk === 'function'){
        hgSetupPaintDesk(p + 'Desk', { kind: cfg.deskKind || 'goldswing', tab: cfg.deskTab || 'GOLD SWING',
          note: cfg.deskNote || 'Grade-A 4h/1d candidates = CLEAN. FORMING NOW = armed strategy watches, not entries.' });
      }else if (typeof hgSetupInjectStyles === 'function') hgSetupInjectStyles();
    }catch(eD){}

    return {
      scanSt: scanSt,
      refresh: async function(){
        if (scanSt.busy) return 'busy';
        if (!scanSt.hasRun || !scanSt.ui) return 'skipped: not run yet';
        return runScan(scanSt.ui, scanSt);
      },
      run: function(){ return runScan(ui, scanSt); }
    };
  }catch(e){ return null; }
}

function mount(el){
  if (!el) return;
  try{ goldswingMountInto(el, __scan, { prefix: 'gw', showDeskNote: true }); }catch(e){ /* never throw at mount */ }
}

/* BRAIN warm-up hook — headless scan against inert stub elements (oiflow.js
   oiflowWarm pattern). Shares __scan.busy with the mounted scan. Never throws. */
function __gwWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}

async function goldswingRefresh(){
  try{
    if (__scan.busy) return 'busy';
    var ui = __scan.ui;
    if (!ui){
      ui = { btn: __gwWarmShim(), stat: __gwWarmShim(), prog: __gwWarmShim(),
             cards: __gwWarmShim(), empty: __gwWarmShim() };
    }
    return await runScan(ui, __scan);
  }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
}
async function gwWarm(){
  try{
    if (W.goldswingState && W.goldswingState()) return 'fresh';
  }catch(e0){}
  if (__scan.busy) return 'busy';
  if (!gfn('getGoldCandles') && !gfn('binanceKlines')) return 'unavailable: gold klines layer not loaded';
  var stubUi = { btn: __gwWarmShim(), stat: __gwWarmShim(), prog: __gwWarmShim(),
                 cards: __gwWarmShim(), empty: __gwWarmShim() };
  await runScan(stubUi);
  return (W.goldswingState && W.goldswingState()) ? 'warmed'
       : 'unavailable: scan did not complete (no gold klines from any source)';
}

/* ---------------- registration ---------------- */
W.goldSwingLevels = __swLevels;
W.goldSwingSetups = goldSwingSetups;
W.goldPurgeBadGeometry = goldPurgeBadGeometry;
W.goldSwingCardFromLiveRec = __cardFromLiveRec;
W.goldswingState = function(){
  try{ return __snap ? __stateView(__snap) : null; }catch(e){ return null; }
};
W.goldswingScan = function(){
  try{ return __scanSnap ? __stateView(__scanSnap) : null; }catch(e){ return null; }
};
W.goldswingCollectCandidates = function(leg, ctx){
  try{
    ctx = ctx || {};
    var now = ctx.now || Date.now();
    var newsC = ctx.news || { caution: false, title: null };
    var macro = ctx.macro || null;
    var got = buildCandidates(leg, now, newsC, macro, 'n/a', 'GOLD', 'XAUUSD');
    var cands = [];
    for (var i = 0; i < got.length; i++) cands.push(got[i]);
    var rk = rankSetups(cands, ctx);
    return rk.ranked || cands;
  }catch(e){ return []; }
};
W.goldswingMountSection = function(el, opts){
  opts = opts || {};
  var scanSt = { busy: false, hasRun: false, ui: null };
  return goldswingMountInto(el, scanSt, Object.assign({
    prefix: 'stGw',
    heading: 'GOLD SWING',
    subheading: 'XAUUSD · XM MT5 prices when configured · else spot proxy chain',
    statIdle: 'idle — XAUUSD 4h/1d swing engine (identical strategy logic to the GOLD SWING tab)',
    showDeskNote: false,
    useStartraderRouting: true,
    deskKind: 'goldswing',
    deskTab: 'STAR TRADER · GOLD SWING'
  }, opts));
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldswing', label: 'GOLD SWING', mount: mount, refresh: goldswingRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldswing', label: 'GOLD SWING', run: gwWarm });
})();
