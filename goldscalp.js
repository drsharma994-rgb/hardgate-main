/* =========================================================================
HARDGATE — goldscalp.js
GOLD SCALP tab: expert gold scalping engine. RUN SCAN pulls multi-timeframe
gold klines (15m/1h/4h) from every available venue, composes PER-STRATEGY
candidates via goldind.js (window.goldScalpSetups — liquidity-sweep reversal,
order-block/breaker retest (active-zone + structure-aligned robust trigger,
legacy proximity fallback), FVG fill, session-VWAP bounce/rejection, EMA
20/50/200 ribbon pullback, Asian-range breakout (volume-validated via detectAsianBreakout),
ADR exhaustion fade (detectADRFade + VWAP bands), modified-RSI
75/25 divergence; microstructure via HardgateGoldEngine.evaluateScalp / evaluateSwing), ranks them all with a transparent human-readable
confluence tally (window.goldRankSetups), crowns the #1 with a MOST PROBABLE
SETUP banner (full execution guidance), and pins every issued setup under a
CONVICTION LOCK (localStorage 'hgGoldscalpConviction'): re-running the scan
restores the ORIGINAL levels verbatim with an 'as of HH:MM' stamp — levels
are never re-picked for a live conviction. A new setup whose direction AND
symbol match a live conviction and whose structure anchor sits within
0.5×ATR of the live anchor MERGES into it (lastConfirmedAt refreshes, the
original levels and id stand, card reads 'conviction re-confirmed ·
original levels stand') instead of double-issuing. Transitions only on
invalidation against the latest 15m close: beyond stop -> STOPPED, TP1
reached -> TARGET HIT, structure older than 6h -> EXPIRED. Closed setups
render as a small history line — they never vanish silently. Every card
carries a compact TRADE MANAGEMENT block (At TP1: close 50%, move stop to
breakeven; runner targets TP2 — with the card's real values) and an ENTRY
GUIDANCE line (price in zone — market entry valid / price outside zone —
limit order at zone edge <price>).

RANKING TALLY (shown on every card):
  +N    independent agreeing reads (the candidate's own ledger)
  +0..3 ICT killzone weight (London/NY overlap 13:00-17:00 GMT highest)
  -2    high-impact news window (+/-30 min, window.hgNewsState)
  +/-2  fundamentals tilt (window.getGoldMacro realRateHint: TAILWIND favors
        longs, HEADWIND favors shorts)
  +/-1  positioning (window.goldspotState PAXG basis verdict)
  +1    seasonality (window.goldSeason STRONG bias behind a long)
  +1    crypto risk sentiment (lexical global S.fng — feature-checked softly,
        skipped when absent)

QUALITY GATES (win-rate first; every gate names its reason on the card or on
a small reason line — nothing is dropped silently):
  1) OFF-SESSION — detected outside every ICT killzone (killzone weight 0):
     demoted (can never be MOST PROBABLE, stamped OFF-SESSION). The render bar
     uses STRUCTURAL confluence only (agreeing reads + killzone weight >= +2);
     macro/news penalties shrink the displayed tally but never suppress the card.
     The Asian-range breakout strategy is allowed its own 00:00-07:00 GMT session.
  2) COUNTER-TREND — longs below a FALLING 200-EMA-15m with a bearish 4H
     EMA50/200 stack (mirrored for shorts) are demoted; a liquidity-sweep
     trigger is the only sanctioned counter-trend play (exempt).
  3) MIN R:R — after TP1 snaps to the nearest opposing structure, a realized
     TP1 < 1.2R drops the candidate to a 'structure too close — R:R
     insufficient' reason line.
  4) CHOP — Kaufman ER(20) < 0.25 on 15m closes demotes mean-reversion
     retests (VWAP bounce, OB retest, FVG fill); breakout triggers exempt.
  5) NEWS-WINDOW VETO — inside a high-impact ±30-min window NO new conviction
     is issued ('NEWS WINDOW — no new entries' reason line); already-live
     convictions keep running untouched.
  6) V2 VOLUME TRIGGERS (goldind.js) — liquidity sweeps require a volume
     climax on the sweep bar; FVG fills require HVN structural support when
     the session volume profile has enough range (>=2.5×ATR). Rejected setups
     name the V2 gate on the .rejected side-channel.

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
and every failure degrades to an honest stat line / empty state — nothing is
fabricated (levels always come from structure + ATR).

Registers window.HG_tabs.push({id:'goldscalp', label:'GOLD SCALP', mount,
refresh}) — refresh(): async, never throws, 'busy' | 'skipped: not run yet' |
'refreshed' | 'error: …', busy-guarded, and never triggers a first-time scan
on its own. Warm-up: window.HG_warmups.push({id:'goldscalp', run}) — 'fresh'
when a state snapshot exists, else a headless scan against inert stub
elements (oiflow.js oiflowWarm pattern) -> 'warmed' | 'busy' | 'unavailable: …'.

BRAIN STATE CONTRACT — after each SUCCESSFUL scan the qualifying setups are
cached module-locally and exposed as window.goldscalpState() for the BRAIN:
  { results: [{ venue, sym, dir, grade, strategy }], at } | null
Zero-arg getter, never throws, deep-frozen copies; a failed re-run keeps the
previous good snapshot with its original `at`. (Byte-compatible with the
pre-rework contract — one row per qualifying candidate.)

DIAGNOSTIC SURFACE — window.goldscalpScan(): the last successful scan in
full (deep-frozen, never throws, null before the first scan):
  { cands: [{ id, venue, sym, dir, strategy, grade, entry, stop, t1, t2, rr,
             rr2, tally, tallyParts, agree, oppose, killzone, atr, anchor,
             zone, demoted, stamps, vetoed, merged, locked, issuedAt, asOf,
             why, invalidates }],
    bestId, history: [{ id, dir, strategy, venue, sym, entry, stop, t1, t2,
                        status, issuedAt, closedAt, closePrice }],
    rejected: [{ id, strategy, stratKey, dir, venue, sym, reason }], at } | null
  (cands = rendered/actionable only; vetoed news-window setups live in
  rejected with their reason, bestId = first non-demoted, non-vetoed id.)
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var KL_15M = 240, KL_1H = 200, KL_4H = 220;

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
function signed(n, d){ return (n > 0 ? '+' : '') + fmtF(n, d); }

/* local ATR copy (identical math to goldind.js's own fallback — goldind.js
   does NOT export an ATR; used here only to express watch-trigger distances
   in ATR units, the same honest degradation goldswing.js uses) */
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
var _atr = (typeof atr === 'function') ? atr : __atrLocal;

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
        grade: c.grade || null, entry: c.entry, stop: c.stop, t1: c.t1, t2: c.t2,
        rr: c.rr, rr2: c.rr2,
        tally: isFinite(c.tally) ? c.tally : null,
        tallyParts: Array.isArray(c.tallyParts)
          ? c.tallyParts.map(function(p){ return { label: p && p.label, pts: p && p.pts }; }) : [],
        agree: isFinite(c.agree) ? c.agree : null, oppose: isFinite(c.oppose) ? c.oppose : null,
        killzone: c.killzone || null, atr: isFinite(c.atr) ? c.atr : null,
        anchor: isFinite(c.anchor) ? c.anchor : null,
        zone: (c.zone && isFinite(c.zone.lo) && isFinite(c.zone.hi)) ? { lo: c.zone.lo, hi: c.zone.hi } : null,
        demoted: !!c.demoted,
        stamps: Array.isArray(c.stamps) ? c.stamps.slice() : [],
        vetoed: !!c.vetoed, merged: !!c.merged,
        locked: !!c.locked, issuedAt: isFinite(c.issuedAt) ? c.issuedAt : null,
        asOf: c.asOf || null, why: c.why || null, invalidates: c.invalidates || null
      });
    }
    var hist = [];
    for (var j = 0; j < (history || []).length; j++){
      var h = history[j];
      if (!h) continue;
      hist.push({ id: h.id || null, dir: h.dir || null, strategy: h.strategy || null,
                  venue: h.venue || null, sym: h.sym || null,
                  entry: h.entry, stop: h.stop, t1: h.t1, t2: h.t2,
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
   'hgGoldscalpConviction' -> { v, live: {id: rec}, history: [rec] }.
   See conviction-lock.js for merge, invalidation (STOPPED / TARGET HIT /
   EXPIRED), and anti-repaint restore semantics. */
var CONVICTION_KEY = 'hgGoldscalpConviction';
var CONVICTION_TTL_MS = 6*60*60*1000;
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

/* venueRows: { venueLabel: { rows15m } } — latest 15m closes per venue for
   invalidation checks. Mutates the ranked candidates (restores levels).
   noMint (NEWS-WINDOW VETO): inside a high-impact ±30-min window NO new
   conviction is issued — unmatched candidates are flagged c.vetoed and
   render as reason lines; already-live convictions keep running untouched
   (transitions + verbatim restore still apply).
   DUPLICATE-CONVICTION MERGE: a candidate whose direction AND symbol match
   a live locked conviction and whose structure anchor sits within 0.5×ATR
   of that conviction's anchor merges into it — the conviction's
   lastConfirmedAt refreshes, its ORIGINAL levels and id stand, and the
   candidate renders 'conviction re-confirmed · original levels stand'
   instead of minting a second overlapping card. Different direction, or an
   anchor beyond 0.5×ATR, is a normal new evaluation. A merge is a
   re-confirmation, not an issuance, so it also applies during a news veto. */
function applyConviction(ranked, venueRows, nowMs, noMint){
  var store = loadConvictions();
  var lockFn = (typeof applyHardgateConvictionLock === 'function')
    ? applyHardgateConvictionLock
    : ((typeof W !== 'undefined' && W) ? W.applyHardgateConvictionLock : null);
  if (lockFn){
    var got = lockFn(store, ranked, venueRows, nowMs, {
      type: 'scalp',
      rowKey: 'rows15m',
      historyLimit: CONVICTION_HIST,
      noMint: noMint,
      venueScopedKeys: false,
      expiryMs: CONVICTION_TTL_MS
    });
    saveConvictions(got.store);
    return got;
  }
  return { store: store, transitions: [] };
}

/* ---------------- pane-scoped styles (injected from here ONLY) ---------------- */
var GS_CSS = ''
+ '.gsx-banner{position:relative;border-radius:12px;padding:3px;margin:16px 0 18px;'
+ 'background:linear-gradient(120deg,#A67C12,#F5D77A 25%,#EA580C 50%,#E8B42A 75%,#A67C12);'
+ 'box-shadow:0 12px 32px -12px rgba(201,146,26,.28)}'
+ '.gsx-banner-in{background:linear-gradient(180deg,#FFFFFF,#FFFBEB);border-radius:10px;padding:16px 18px;color:#020617}'
+ '.gsx-eye{font-size:10px;letter-spacing:.3em;color:#A67C12;font-weight:800}'
+ '.gsx-dir{font-family:var(--disp,inherit);font-size:26px;font-weight:800;letter-spacing:.06em;margin-top:4px}'
+ '.gsx-dir.long{color:#047857;text-shadow:none}'
+ '.gsx-dir.short{color:#B91C1C;text-shadow:none}'
+ '.gsx-dir span{display:block;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.14em;color:#0F172A;margin-top:4px}'
+ '.gsx-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:12px 0 4px}'
+ '.gsx-plan>div{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:9px 11px}'
+ '.gsx-plan i{display:block;font-style:normal;font-size:9px;letter-spacing:.16em;color:#1E293B;font-weight:700}'
+ '.gsx-plan b{display:block;font-size:16px;color:#A67C12;font-weight:800;margin:3px 0}'
+ '.gsx-plan u{text-decoration:none;font-size:10px;color:#0F172A;opacity:1;font-weight:500;line-height:1.45}'
+ '.gsx-why{font-size:11px;margin-top:8px;color:#0F172A;font-weight:600}'
+ '.gsx-why b{color:#A67C12;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '.gsx-tally{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}'
+ '.gsx-tp{font-size:9px;letter-spacing:.03em;padding:3px 8px;border-radius:4px;border:1px solid;font-weight:600}'
+ '.gsx-tp.pos{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '.gsx-tp.neg{color:#B91C1C;border-color:rgba(220,38,38,.40);background:rgba(220,38,38,.08)}'
+ '.gsx-inv{font-size:11px;color:#0F172A;margin-top:8px;line-height:1.55;font-weight:500}'
+ '.gsx-inv b{color:#B91C1C;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '.gsx-lock{margin-top:10px;font-size:10px;letter-spacing:.08em;color:#A67C12;font-weight:600;border-top:1px dashed #FDE68A;padding-top:8px}'
+ '.gsx-lock.new{color:#1E293B}'
+ '.gsx-card.long{border-left:4px solid #059669;background:linear-gradient(180deg,rgba(5,150,105,.14),transparent 48%),rgba(15,23,42,.94);color:#F1F5F9}'
+ '.gsx-card.short{border-left:4px solid #DC2626;background:linear-gradient(180deg,rgba(220,38,38,.12),transparent 48%),rgba(15,23,42,.94);color:#F1F5F9}'
+ '.gsx-card.best{box-shadow:0 0 0 2px rgba(201,146,26,.40),0 12px 28px -14px rgba(201,146,26,.20)}'
+ '.card.gsx-card{color:#F1F5F9!important}'
+ '.card.gsx-card .sym{color:#F8FAFC!important;font-weight:800}'
+ '.card.gsx-card .dir{text-shadow:none!important}'
+ '.card.gsx-card .mini{color:#E2E8F0!important}'
+ '.card.gsx-card .mini .k{color:#94A3B8!important;font-weight:700}'
+ '.card.gsx-card .mini span:not(.k){color:#F8FAFC!important;font-weight:600}'
+ '.card.gsx-card .gpip{background:rgba(30,41,59,.75)!important;border-color:#475569!important;color:#CBD5E1!important}'
+ '.card.gsx-card .gpip.ok{background:rgba(52,211,153,.14)!important;border-color:rgba(52,211,153,.5)!important;color:#6EE7B7!important;font-weight:700}'
+ '.card.gsx-card .plan{background:rgba(30,41,59,.8)!important;border-color:#475569!important;color:#E2E8F0!important}'
+ '.card.gsx-card .plan b{color:#67E8F9!important}'
+ '.card.gsx-card .note{color:#CBD5E1!important}'
+ '.card.gsx-card .gsx-strat{color:#FBBF24!important}'
+ '.card.gsx-card .gsx-whyline{color:#E2E8F0!important}'
+ '.card.gsx-card .gsx-invline{color:#CBD5E1!important}'
+ '.card.gsx-card .gsx-lockline{color:#FDE68A!important}'
+ '.card.gsx-card .toTrade{color:#67E8F9!important;border-color:#38BDF8!important;background:rgba(34,211,238,.08)!important}'
+ '.card.gsx-card .toBook{color:#67E8F9!important;border-color:#0891B2!important;background:rgba(8,145,178,.08)!important}'
+ '.gsx-strat{color:#A67C12;font-size:10px;font-weight:800;letter-spacing:.12em}'
+ '.gsx-grade{font-weight:800}'
+ '.gsx-grade.A{color:#A67C12}'
+ '.gsx-grade.B{color:#047857}'
+ '.gsx-grade.C{color:#1E293B}'
+ '.gsx-tallynum{font-weight:800}'
+ '.gsx-tallynum.up{color:#047857}'
+ '.gsx-tallynum.dn{color:#B91C1C}'
+ '.gsx-lockline{font-size:9px;color:#A67C12;letter-spacing:.1em;margin-top:6px;font-weight:700}'
+ '.gsx-whyline{font-size:11px;color:#020617;margin-top:8px;line-height:1.6;font-weight:500}'
+ '.gsx-invline{font-size:10px;color:#0F172A;margin-top:5px;line-height:1.55;font-weight:500}'
+ '.gsx-invline b{color:#B91C1C;letter-spacing:.08em;font-weight:800}'
+ '.gsx-hist{margin-top:18px}'
+ '.gsx-hhead{font-size:10px;letter-spacing:.2em;color:#1E293B;margin-bottom:6px;font-weight:700}'
+ '.gsx-hrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#0F172A;line-height:1.55;font-weight:500}'
+ '.gsx-hrow.stopped{border-left-color:#DC2626}'
+ '.gsx-hrow.target{border-left-color:#059669}'
+ '.gsx-hrow.expired{border-left-color:#A67C12}'
+ '.gsx-hrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '.gsx-hrow.rej{border-left-color:#EA580C}'
+ '.gsx-gateline{font-size:10px;color:#9A3412;letter-spacing:.04em;margin-top:8px;'
+ 'border:1px solid rgba(234,88,12,.30);border-radius:6px;padding:6px 9px;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '.gsx-gateline b{letter-spacing:.12em;font-weight:800;color:#9A3412}'
+ '.gsx-mgmt{font-size:10px;margin-top:8px;padding:6px 9px;border-radius:6px;line-height:1.55;'
+ 'color:#020617;border:1px dashed #FDE68A;background:#FFFBEB;font-weight:500}'
+ '.gsx-mgmt b{color:#A67C12;letter-spacing:.12em;font-size:9px;font-weight:800}'
+ '.gsx-guide{font-size:10px;margin-top:6px;letter-spacing:.03em;color:#0F172A;line-height:1.55;font-weight:500}'
+ '.gsx-guide b{letter-spacing:.12em;font-size:9px;font-weight:800}'
+ '.gsx-guide.in{color:#047857;font-weight:600}'
+ '.gsx-guide.out{color:#9A3412;font-weight:600}'
+ '.gsx-wrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#0F172A;line-height:1.55;font-weight:500}'
+ '.gsx-wrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '.gsx-wrow.armed{border-left-color:#C9921A;color:#020617;background:#FFFBEB}'
+ '.gsx-wst{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '.gsx-wrow.armed .gsx-wst{color:#A67C12;border-color:rgba(201,146,26,.45);background:rgba(201,146,26,.12)}'
+ '.gsx-wrow.promoted{border-left-color:#0891B2;background:rgba(8,145,178,.06)}'
+ '.gsx-wrow.promoted .gsx-wst{color:#0891B2;border-color:rgba(8,145,178,.45);background:rgba(8,145,178,.10)}'
+ '.gsx-wrow.idle .gsx-wst{color:#1E293B;border-color:#E2E8F0;background:#F8FAFC}'
+ '.gsx-silent{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:9px 11px;margin:12px 0;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '.gsx-silent b{letter-spacing:.12em;font-weight:800;color:#9A3412}'
+ '.gsx-weekend-wrap,.gsx-weekend-wrap{margin:0 0 12px}'
+ '.gsx-weekend,.gsx-weekend{font-size:11px;border-radius:8px;padding:10px 12px;line-height:1.55;margin:12px 0;border:1px solid}'
+ '.gsx-weekend b,.gsx-weekend b{letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '.gsx-weekend-detail,.gsx-weekend-detail{margin-top:6px;font-weight:500}'
+ '.gsx-weekend-ok,.gsx-weekend-ok{border-color:#BBF7D0;background:#F0FDF4;color:#047857}'
+ '.gsx-weekend-muted,.gsx-weekend-muted{border-color:#E2E8F0;background:#F8FAFC;color:#1E293B}'
+ '.gsx-weekend-caution,.gsx-weekend-caution{border-color:#FDE68A;background:#FFFBEB;color:#92400E}'
+ '.gsx-weekend-warn,.gsx-weekend-warn{border-color:rgba(220,38,38,.35);background:#FEF2F2;color:#B91C1C}';

function gsxSt(s){ return ' style="' + s + '"'; }
var GSX_CARD = 'background:#0F172A!important;color:#F8FAFC!important;border-color:#334155!important';
var GSX_SYM = 'color:#F8FAFC!important;font-weight:800';
var GSX_STRAT = 'color:#FBBF24!important;font-weight:800';
var GSX_MINI = 'color:#E2E8F0!important';
var GSX_K = 'color:#94A3B8!important;font-weight:700';
var GSX_V = 'color:#F8FAFC!important;font-weight:600';
var GSX_PLAN = 'background:#1E293B!important;border:1px solid #475569!important;color:#E2E8F0!important';
var GSX_PLAN_B = 'color:#67E8F9!important';
var GSX_NOTE = 'color:#CBD5E1!important';
var GSX_GPIP = 'background:rgba(30,41,59,.85)!important;border:1px solid #475569!important;color:#CBD5E1!important';
var GSX_GPIP_OK = 'background:rgba(52,211,153,.18)!important;border:1px solid rgba(52,211,153,.55)!important;color:#6EE7B7!important';
var GSX_WHY = 'color:#E2E8F0!important';
function gsxPipAttr(ok){ return gsxSt(ok ? GSX_GPIP_OK : GSX_GPIP); }

(function hgInjectGsCss(){
  try{
    if (typeof document === 'undefined') return;
    var id = 'hg-gsx-styles';
    if (document.getElementById(id)) return;
    var el = document.createElement('style');
    el.id = id;
    el.textContent = GS_CSS;
    (document.head || document.documentElement).appendChild(el);
  }catch(e){}
})();

/* ---------------- renderers ---------------- */
function tallyChips(c){
  if (!Array.isArray(c.tallyParts) || !c.tallyParts.length) return '';
  var audit = (typeof W !== 'undefined' && W) ? W.__hgGoldTallyAudit : null;
  return '<div class="gsx-tally">' + c.tallyParts.map(function(p){
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
        meas = ' <span class="gsx-measured">[measured: ' + (leg2.liftR >= 0 ? '+' : '') + leg2.liftR.toFixed(2) + 'R over ' + leg2.nWith + ' — ' + leg2.verdict + ']</span>';
      }
    }
    return '<span class="gsx-tp ' + (p.pts >= 0 ? 'pos' : 'neg') + '"' + strike + '>' + (p.pts >= 0 ? '+' : '') + p.pts + ' · ' + esc(p.label) + meas + '</span>';
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

function goldApplyBestLevelsBatch(ranked, venueRows, gold, atrW, now){
  var applyBlFn = gfn('hgApplyGoldBestLevels');
  var postFn = gfn('hgGoldPostApplyRefresh');
  if (!applyBlFn) return;
  for (var fi = 0; fi < ranked.length; fi++){
    var gc = ranked[fi];
    if (!gc || gc.vetoed || gc.locked) continue;
    var vrF = venueRows[gc.venue];
    var rF = (vrF && vrF.rows15m && vrF.rows15m.length) ? vrF.rows15m : gold.rows15m;
    try{
      applyBlFn(gc, {
        style: 'gold-scalp',
        rows: rF,
        rows15m: rF,
        rows1h: gold.rows1h,
        rows4h: gold.rows4h,
        atrW: atrW,
        nowMs: now,
        rankBoost: (gc.agree || 0) + (gc.killzoneWeight || 0),
        vision: gc.vision,
      });
      if (postFn){
        postFn(gc, {
          style: 'gold-scalp',
          rows: rF,
          rows15m: rF,
          rows1h: gold.rows1h,
          rows4h: gold.rows4h,
        });
      }
    }catch(eGf){}
  }
}

function goldBuildAPlusCtx(ctx, gold, now, news){
  var out = { style: 'goldscalp', news: news, newsCaution: !!(news && news.caution), mixedFeed: !!(gold && gold.mixed) };
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
    if (typeof W !== 'undefined' && W && typeof W.hgScoreRecords === 'function' && typeof W.hgEdgeFor === 'function'){
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
  var h = '<div class="gsx-aplus note" style="margin:8px 0;padding:10px 12px;border:1px solid #B45309;border-radius:6px">';
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
    ? '<div class="gsx-lock">⬤ CONVICTION LOCK — issued as of ' + esc(best.asOf || '') + '; entry/stop/targets held verbatim, never re-picked on re-scans.</div>'
    : '<div class="gsx-lock new">○ NEW CONVICTION — issued this scan at ' + esc(best.asOf || '') + '; these levels are now locked until invalidated.</div>';
  return '<div class="gsx-banner"><div class="gsx-banner-in">'
    + '<div class="gsx-eye">MOST PROBABLE SETUP</div>'
    + '<div class="gsx-dir ' + best.dir + '">' + dirUp
    + '<span>' + esc(best.strategy) + ' · ' + esc(best.venue) + (best.sym ? ' (' + esc(best.sym) + ')' : '')
    + ' · GRADE ' + esc(best.grade) + ' · ' + esc(best.killzone || '') + '</span></div>'
    + '<div class="gsx-plan">'
    + '<div><i>' + act + '</i><b>$' + pxF(best.zone ? best.zone.lo : best.entry) + ' – $' + pxF(best.zone ? best.zone.hi : best.entry) + '</b><u>entry $' + pxF(best.entry) + '</u></div>'
    + '<div><i>STOP</i><b>$' + pxF(best.stop) + '</b><u>15m close beyond it kills the idea</u></div>'
    + '<div><i>TP1</i><b>$' + pxF(best.t1) + '</b><u>' + fmtF(best.rr, 1) + 'R — trim / de-risk</u></div>'
    + '<div><i>TP2</i><b>$' + pxF(best.t2) + '</b><u>' + fmtF(best.rr2, 1) + 'R — runner</u></div>'
    + '</div>'
    + '<div class="gsx-why"><b>WHY THIS ONE LEADS</b> — ' + esc(tallyTxt) + '.</div>'
    + tallyChips(best)
    + '<div class="gsx-whyline">' + esc(best.why || '') + '</div>'
    + '<div class="gsx-inv"><b>INVALIDATION</b> — ' + esc(best.invalidates || 'a 15m close beyond the stop') + '. Hard stop $' + pxF(best.stop) + ' — never widen it.</div>'
    + lock
    + '</div></div>';
}

function cardHTML(c, isBest, season){
  var dirUp = c.dir.toUpperCase();
  var gradeCls = c.grade === 'A' ? 'ok' : '';
  var chips = (c.confluence || []).map(function(x){ return '<span class="gpip ok"' + gsxPipAttr(true) + '>' + esc(x) + '</span>'; }).join('');
  if (c.oppose > 0) chips += '<span class="gpip"' + gsxPipAttr(false) + '>' + c.oppose + ' opposing read' + (c.oppose === 1 ? '' : 's') + ' on the books</span>';
  var newsBanner = c.newsCaution
    ? '<div class="note warn" style="margin-top:8px">NEWS-FADE — ' + esc(c.newsStamp || '') + '</div>' : '';
  var notes = (c.notes && c.notes.length)
    ? '<div class="note" style="margin-top:6px">' + c.notes.map(esc).join(' · ') + '</div>' : '';
  var seasonLine = season ? '<div class="note" style="margin-top:6px">' + esc(season) + '</div>' : '';
  var tallyNum = isFinite(c.tally)
    ? '<span class="gsx-tallynum ' + (c.tally >= 0 ? 'up' : 'dn') + '">tally ' + (c.tally > 0 ? '+' : '') + c.tally + '</span>' : '';
  var lockLine;
  if (c.merged){
    var mAt = '';
    try{ mAt = new Date(c.mergedAt).toISOString().slice(11, 16) + ' UTC'; }catch(eM){}
    lockLine = '<div class="gsx-lockline">⬤ conviction re-confirmed · original levels stand'
      + ' <span style="opacity:.65">(issued ' + esc(c.asOf || '') + (mAt ? ' · re-confirmed ' + esc(mAt) : '') + ')</span></div>';
  } else {
    lockLine = c.locked
      ? '<div class="gsx-lockline">⬤ CONVICTION LOCK — levels as of ' + esc(c.asOf || '') + ' (restored verbatim)</div>'
      : '<div class="gsx-lockline" style="color:#1E293B">○ new conviction issued ' + esc(c.asOf || '') + '</div>';
  }
  /* trade-management block + entry guidance — compact, under the levels,
     always built from THIS card's real TP1/TP2/zone values */
  var mgmtBlock = (isFinite(c.t1) && isFinite(c.t2) && isFinite(c.entry))
    ? '<div class="gsx-mgmt"><b>TRADE MANAGEMENT</b> · At TP1 $' + pxF(c.t1)
      + ': close 50%, move stop to breakeven ($' + pxF(c.entry) + '). Runner targets TP2 $' + pxF(c.t2) + '.</div>'
    : '';
  var guideBlock = '';
  if (c.zone && isFinite(c.zone.lo) && isFinite(c.zone.hi) && isFinite(c.pxNow)){
    var inZone = c.pxNow >= c.zone.lo && c.pxNow <= c.zone.hi;
    guideBlock = '<div class="gsx-guide ' + (inZone ? 'in' : 'out') + '"><b>ENTRY GUIDANCE</b> · '
      + (inZone ? 'price in zone — market entry valid'
                : 'price outside zone — limit order at zone edge $' + pxF(c.pxNow > c.zone.hi ? c.zone.hi : c.zone.lo))
      + '</div>';
  }
  var gateLine = (c.demoted && Array.isArray(c.stamps) && c.stamps.length)
    ? '<div class="gsx-gateline"><b>⚠ ' + esc(c.stamps.join(' · ')) + '</b> — '
      + esc((Array.isArray(c.gateNotes) ? c.gateNotes : []).join(' · '))
      + ' — demoted by quality gate: can never be MOST PROBABLE.</div>' : '';
  var xautBasisLine = (c.sym === 'XAUTUSD' && isFinite(c.spotRef) && isFinite(c.xautBasisPct)
    && Math.abs(c.xautBasisPct) > XAUT_SPOT_BASIS_WARN_PCT)
    ? '<div class="note warn" style="margin-top:6px;color:#FBBF24!important">XAUT instrument ~$' + pxF(c.entry)
      + ' vs spot XAU ~$' + pxF(c.spotRef) + ' (' + (c.xautBasisPct >= 0 ? '+' : '') + fmtF(c.xautBasisPct, 2)
      + '%). Levels valid on <b>Delta XAUTUSD</b> only — not spot/StarTrader XAUUSD.</div>' : '';
  var tradeOnclick = (c.sym && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(c.sym, c.dir, c.entry, c.stop, c.t1, { t2: c.t2, stack: c.stack, scanner: 'goldscalp', strategy: 'goldscalp' })
      : ('toTrade(' + JSON.stringify(c.sym) + ',' + JSON.stringify(c.dir) + ',' + c.entry + ',' + c.stop + ',' + c.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var tradeBtn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function' && c.sym)
    ? bookBtnHTML(c.sym, c.dir, c.entry, c.stop, c.t1, { scanner: 'goldscalp', strategy: 'goldscalp', klass: 'metals', fund: 'gold', t2: c.t2, stack: c.stack }) : '';
  var stackHtml = (c.stack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(c.stack) : '';
  var metaChips = '';
  if (isFinite(c.formationScore)) metaChips += '<span class="gpip ok"' + gsxPipAttr(true) + '>formation ' + c.formationScore + '</span>';
  if (isFinite(c.fillProb)) metaChips += '<span class="gpip"' + gsxPipAttr(false) + '>fill ~' + Math.round(c.fillProb * 100) + '%</span>';
  if (c.goldProChip) metaChips += '<span class="gpip ok"' + gsxPipAttr(true) + '>' + esc(c.goldProChip) + '</span>';
  if (c.visionChip) metaChips += '<span class="gpip ok"' + gsxPipAttr(true) + '>' + esc(c.visionChip) + '</span>';
  if (isFinite(c.goldMinRr)) metaChips += '<span class="gpip"' + gsxPipAttr(false) + '>min ' + fmtF(c.goldMinRr, 1) + 'R</span>';
  if (c.planSrc) metaChips += '<span class="gpip"' + gsxPipAttr(false) + '>' + esc(String(c.planSrc).split(' · ')[0]) + '</span>';
  if (c.goldRegime) metaChips += '<span class="gpip"' + gsxPipAttr(false) + '>' + esc(c.goldRegime) + '</span>';
  if (c.entryType) metaChips += '<span class="gpip"' + gsxPipAttr(false) + '>' + esc(c.entryType) + '</span>';
  var visionText = [c.visionNextBar || c.visionNextMove, c.visionPrediction].filter(function(v, i, a){
    if (!v) return false;
    if (i > 0 && v === a[0]) return false;
    return true;
  }).join(' · ');
  var visionLine = visionText
    ? '<div class="gsx-whyline"><b>VISION:</b> ' + esc(visionText) + '</div>' : '';
  return '<div class="card gsx-card ' + c.dir + (isBest ? ' best' : '') + '"' + gsxSt(GSX_CARD) + '>'
    + '<div class="chead"><span class="sym"' + gsxSt(GSX_SYM) + '>' + esc(c.venue) + '</span>'
    + '<span class="dir">' + dirUp + ' · <span class="gsx-grade ' + esc(c.grade) + '">GRADE ' + esc(c.grade) + '</span></span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(c.sym, c.dir, { scanner: 'goldscalp', strategy: 'goldscalp', klass: 'metals', fund: 'gold' }) : '')
    + '</div>'
    + '<div class="gsx-strat"' + gsxSt(GSX_STRAT) + '>' + esc(c.strategy) + (isBest ? ' · ★ MOST PROBABLE' : '') + '</div>'
    + '<div class="mini"' + gsxSt(GSX_MINI) + '>'
    + '<span class="k"' + gsxSt(GSX_K) + '>venue</span><span' + gsxSt(GSX_V) + '>' + esc(c.venue) + (c.sym ? ' · ' + esc(c.sym) : '') + '</span>'
    + '<span class="k"' + gsxSt(GSX_K) + '>reads</span><span' + gsxSt(GSX_V) + '>' + c.reads.long + ' long / ' + c.reads.short + ' short · ' + tallyNum + '</span>'
    + '<span class="k"' + gsxSt(GSX_K) + '>killzone</span><span' + gsxSt(GSX_V) + '>' + esc(c.killzone) + '</span>'
    + '<span class="k"' + gsxSt(GSX_K) + '>ATR14 15m</span><span' + gsxSt(GSX_V) + '>' + pxF(c.atr) + '</span>'
    + '<span class="k"' + gsxSt(GSX_K) + '>R:R</span><span' + gsxSt(GSX_V) + '>1 : ' + fmtF(c.rr, 1) + ' (T1) · 1 : ' + fmtF(c.rr2, 1) + ' (T2)</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ' + gradeCls + '"' + gsxPipAttr(gradeCls === 'ok') + '>GRADE ' + c.grade + '</span>'
    + '<span class="gpip"' + gsxPipAttr(false) + '>' + esc(c.killzone) + '</span>'
    + chips + metaChips
    + '</div>'
    + tallyChips(c)
    + '<div class="plan"' + gsxSt(GSX_PLAN) + '>' + (c.dir === 'long' ? 'BUY' : 'SELL') + ' <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.zone ? c.zone.lo : c.entry) + '–$' + pxF(c.zone ? c.zone.hi : c.entry) + '</b>'
    + ' · ENTRY <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.entry) + '</b>'
    + ' · STOP <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.stop) + '</b>'
    + ' · TP1 <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.t1) + '</b> (' + fmtF(c.rr, 1) + 'R)'
    + ' · TP2 <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.t2) + '</b> (' + fmtF(c.rr2, 1) + 'R)'
    + '</div>'
    + mgmtBlock + guideBlock
    + (c.why ? '<div class="gsx-whyline"' + gsxSt(GSX_WHY) + '>' + esc(c.why) + '</div>' : '')
    + visionLine
    + (c.invalidates ? '<div class="gsx-invline"><b>INVALIDATES:</b> ' + esc(c.invalidates) + '</div>' : '')
    + gateLine
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
    return '<div class="gsx-hrow rej"><b>✕ HELD BACK</b> · ' + esc(r.strategy || 'SETUP')
      + (r.dir ? ' · ' + esc(String(r.dir).toUpperCase()) : '')
      + (r.venue ? ' · ' + esc(r.venue) : '')
      + ' — ' + esc(r.reason || 'failed a quality gate') + '</div>';
  }).join('');
  return '<div class="gsx-hist"><div class="gsx-hhead">QUALITY GATES — setups held back, every reason named (never silently dropped)</div>' + rows + '</div>';
}

function historyHTML(history){
  if (!history || !history.length) return '';
  var rows = history.map(function(h){
    if (!h) return '';
    var icon = h.status === 'STOPPED' ? '✕' : (h.status === 'TARGET HIT' ? '✓' : '⏱');
    var cls = h.status === 'STOPPED' ? 'stopped' : (h.status === 'TARGET HIT' ? 'target' : 'expired');
    var when = '';
    try{ when = new Date(h.closedAt || h.issuedAt).toISOString().slice(11, 16) + ' UTC'; }catch(e){}
    return '<div class="gsx-hrow ' + cls + '"><b>' + icon + ' ' + esc(h.status) + '</b> · '
      + esc(String(h.dir || '').toUpperCase()) + ' · ' + esc(h.strategy || '') + ' · ' + esc(h.venue || '')
      + ' · entry $' + pxF(h.entry) + ' · stop $' + pxF(h.stop) + ' · TP1 $' + pxF(h.t1)
      + (isFinite(h.closePrice) ? ' · closed near $' + pxF(h.closePrice) : '')
      + ' · ' + esc(when) + '</div>';
  }).join('');
  return '<div class="gsx-hist"><div class="gsx-hhead">CONVICTION HISTORY — closed setups, never silently dropped</div>' + rows + '</div>';
}

/* FORMING NOW — what the engine is watching: per-strategy per-venue
   ARMED/IDLE rows with the exact live trigger condition + real level from
   goldind.js's goldWatch. Armed setups are watch items, NOT entries. */
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
    return '<div class="gsx-wrow ' + cls + '">'
      + '<span class="gsx-wst">' + (w.state === 'promoted' ? 'PROMOTED' : (st ? 'ARMED' : 'IDLE')) + '</span>'
      + '<b>' + esc(w.strategy || 'SETUP') + '</b>'
      + (w.venue ? ' · ' + esc(w.venue) : '')
      + (lvlNum ? ' · $' + pxF(w.level) : '')
      + ' — ' + esc(w.state === 'promoted' ? (w.promoteNote || 'trigger fired — see candidate card')
              : (st ? (w.condition || 'watching') : (w.reason || w.condition || 'no trigger in range')))
      + '</div>';
  }).join('');
  return '<div class="gsx-hist gsx-watch"><div class="gsx-hhead">FORMING NOW — what the engine is watching'
    + ' <span style="opacity:.65">(armed setups are watch items, not entries)</span></div>' + rows + '</div>';
}

/* nearest armed trigger across venues, distance in $ and ATR(15m) */
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
   candidates. Precedence: news window > feeds failed > outside killzones >
   live convictions > nearest armed trigger. The nearest-armed tail is
   appended whenever it isn't itself the lead and watch data exists. */
function whySilentText(o){
  var lead = null;
  if (o.newsVeto) lead = 'high-impact news window ±30 min' + (o.newsVetoTitle ? ' — ' + o.newsVetoTitle : '')
    + ': new convictions held, issuance resumes after the window';
  else if (o.feedsFailed) lead = 'feeds failed — no 15m klines from any source (macro chain + PAXGUSDT + Delta all quiet)';
  else if (o.kzWeight === 0) lead = 'outside every ICT killzone (' + (o.kzLabel || 'OFF-HOURS')
    + ') — detections are demoted by the off-session gate and held to a +2 tally bar';
  else if (o.liveN > 0) lead = o.liveN + ' live conviction' + (o.liveN === 1 ? '' : 's')
    + ' already locked — re-confirmations, not new issuance';
  var near = nearestArmed(o.armed, o.watchMeta);
  var tail = null;
  if (near){
    tail = 'nearest armed trigger: ' + near.strategy + (near.venue ? ' (' + near.venue + ')' : '')
      + ' at $' + pxF(near.level) + ' — $' + pxF(near.dist)
      + (isFinite(near.distAtr) ? ' (' + fmtF(near.distAtr, 1) + '×ATR(15m)) away' : ' away');
  }
  if (!lead) lead = tail ? tail : 'no qualifying setups — the board is flat';
  else if (tail) lead = lead + ' · ' + tail;
  return lead;
}
function whySilentHTML(ws){
  return '<div class="gsx-silent"><b>WHY SILENT</b> — ' + esc(ws) + '</div>';
}

function goldWeekendPanelHTML(ro){
  if (!ro || (!ro.headline && !ro.detail)) return '';
  var lvl = ro.level || 'muted';
  return '<div class="gsx-weekend gsx-weekend-' + lvl + '"><b>WEEKEND EXPOSURE</b> — ' + esc(ro.headline)
    + (ro.detail ? '<div class="gsx-weekend-detail">' + esc(ro.detail) + '</div>' : '') + '</div>';
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
  var out = { rows15m: [], rows1h: [], rows4h: [], src: {}, mixed: false, source: null, xmSymbol: null };
  var srcSet = function(tf, source, rowsKey, rows){
    if (typeof hgGoldSrcAssign === 'function'){ hgGoldSrcAssign(out, tf, source, rowsKey, rows); return; }
    if (!rows || !rows.length || !source) return;
    out[rowsKey] = rows;
    out.src[tf] = source;
  };
  var xgc = gfn('getXmGoldCandles');
  if (xgc){
    try{
      var xa = await xgc('15m', KL_15M);
      if (xa && xa.rows && xa.rows.length){ srcSet('15m', xa.source || 'xm-xauusd', 'rows15m', xa.rows); out.xmSymbol = xa.symbol || 'XAUUSD'; }
    }catch(eXm){}
    if (!out.rows1h.length){
      try{
        var xb = await xgc('1h', KL_1H);
        if (xb && xb.rows && xb.rows.length) srcSet('1h', xb.source || 'xm-xauusd', 'rows1h', xb.rows);
      }catch(eXm2){}
    }
    if (!out.rows4h.length){
      try{
        var xc = await xgc('4h', KL_4H);
        if (xc && xc.rows && xc.rows.length) srcSet('4h', xc.source || 'xm-xauusd', 'rows4h', xc.rows);
      }catch(eXm3){}
    }
  }
  var ggc = gfn('getGoldCandles');
  if (ggc){
    if (!out.rows15m.length){
      try{ var a = await ggc('15m', KL_15M); if (a && a.rows && a.rows.length) srcSet('15m', a.source, 'rows15m', a.rows); }catch(e){}
    }
    if (!out.rows1h.length){
      try{ var b = await ggc('1h', KL_1H);  if (b && b.rows && b.rows.length) srcSet('1h', b.source, 'rows1h', b.rows); }catch(e2){}
    }
    if (!out.rows4h.length){
      try{ var c = await ggc('4h', KL_4H);  if (c && c.rows && c.rows.length) srcSet('4h', c.source, 'rows4h', c.rows); }catch(e3){}
    }
  }
  if (!out.rows15m.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length) srcSet('15m', 'binance-paxg', 'rows15m', p); }catch(e4){}
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) srcSet('1h', 'binance-paxg', 'rows1h', q); }catch(e5){}
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length) srcSet('4h', 'binance-paxg', 'rows4h', z); }catch(e6){}
    }
  }
  if (typeof hgGoldSrcFinalize === 'function') return hgGoldSrcFinalize(out, '15m');
  var prov = [];
  Object.keys(out.src).forEach(function(k){ if (out.src[k] && prov.indexOf(out.src[k]) < 0) prov.push(out.src[k]); });
  out.mixed = prov.length > 1;
  out.source = out.src['15m'] || out.src['4h'] || prov[0] || null;
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
  var out = { rows15m: [], rows1h: [], rows4h: [], item: null };
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
  try{ var a = await xc(item, '15m', KL_15M); if (a && a.length) out.rows15m = a; }catch(e2){}
  try{ var b = await xc(item, '1h', KL_1H);  if (b && b.length) out.rows1h = b; }catch(e3){}
  try{ var c = await xc(item, '4h', KL_4H);  if (c && c.length) out.rows4h = c; }catch(e4){}
  return out;
}

/* per-venue candidate composition (multi-strategy first, composite fallback).
   Hard-gated setups ride the .rejected side-channel so the scan can render
   named reason lines — nothing is dropped silently. */
function buildCandidates(leg, now, news, venue, sym, bundleExtra){
  var out = [];
  out.rejected = [];
  try{
    var setupsFn = gfn('goldScalpSetups');
    if (setupsFn){
      var got = null;
      var inp = { rows15m: leg.rows15m, rows1h: leg.rows1h, rows4h: leg.rows4h, now: now, news: news };
      bundleExtra = bundleExtra || {};
      var bk;
      for (bk in bundleExtra){
        if (Object.prototype.hasOwnProperty.call(bundleExtra, bk)) inp[bk] = bundleExtra[bk];
      }
      try{ got = setupsFn(inp); }
      catch(e){ got = null; }
      if (Array.isArray(got)){
        for (var i = 0; i < got.length; i++){
          var c = got[i];
          if (!c || !c.dir) continue;
          c.venue = venue; c.sym = sym;
          out.push(c);
        }
        var rej = got.rejected || [];
        for (var rj = 0; rj < rej.length; rj++){
          var rc0 = rej[rj];
          if (!rc0) continue;
          out.rejected.push({ id: rc0.id || null, strategy: rc0.strategy || null, stratKey: rc0.stratKey || null,
                              dir: rc0.dir || null, venue: venue, sym: sym,
                              reason: rc0.reason || 'failed a quality gate' });
        }
      }
      return out;
    }
    /* legacy fallback: the single composite wrapped as one candidate */
    var setupFn = gfn('goldScalpSetup');
    if (!setupFn) return out;
    var s = null;
    try{ s = setupFn({ rows15m: leg.rows15m, rows1h: leg.rows1h, rows4h: leg.rows4h, now: now, news: news }); }
    catch(e2){ s = null; }
    if (s){
      out.push({
        id: 'blend|' + s.dir + '|' + Math.round(s.entry),
        strategy: s.strategy, stratKey: 'blend', dir: s.dir,
        entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2, rr: s.rr, rr2: s.rr2,
        grade: s.grade, confluence: s.confluence || [],
        agree: (s.dir === 'long') ? s.reads.long : s.reads.short,
        oppose: (s.dir === 'long') ? s.reads.short : s.reads.long,
        reads: s.reads, killzone: s.killzone, killzoneWeight: s.killzoneWeight,
        newsCaution: s.newsCaution, newsStamp: s.newsStamp, atr: s.atr,
        zone: { lo: s.entry - 0.25*s.atr, hi: s.entry + 0.25*s.atr },
        why: 'composite confluence blend — every agreeing read behind one plan',
        invalidates: 'a 15m close beyond the stop',
        notes: s.notes || [], venue: venue, sym: sym
      });
    }
  }catch(e3){}
  return out;
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
    if (ui && ui.cards) ui.cards.innerHTML = '';
    if (ui && ui.empty) ui.empty.style.display = 'none';
    setProg(ui, 0);
    var setupsFn = gfn('goldScalpSetups'), setupFn = gfn('goldScalpSetup');
    var rankFn = gfn('goldRankSetups');
    if (!setupsFn && !setupFn){ setStat(ui, 'goldind.js not loaded — the detector engine is missing (check script order).', true); return 'error: goldind missing'; }

    setStat(ui, 'pulling gold klines 15m/1h/4h…');
    var now = Date.now();
    var news = null;
    var ns = gfn('hgNewsState');
    if (ns){ try{ news = ns(); }catch(eN){ news = null; } }
    var seasonFn = gfn('goldSeason');
    var season = seasonFn ? seasonFn(now) : null;

    /* ranking context legs — every one optional, every one catch-isolated */
    var ctx = { now: now, news: news, season: season, macro: null, spot: null, fng: null, style: 'goldscalp' };
    var gm = gfn('getGoldMacro');
    if (gm){
      setStat(ui, 'reading macro tilt (DXY · US10Y · gold/silver ratio)…');
      try{ ctx.macro = await gm(); }catch(eM){ ctx.macro = null; }
    }
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

    var cands = [], legs = [], venueRows = {}, rejectedAll = [], i;
    var armedAll = [], watchMeta = {};
    var watchFn = gfn('goldWatch');
    function collectWatch(rows15m, rows1h, rows4h, venue){
      try{
        if (rows15m && rows15m.length){
          var lc = rows15m[rows15m.length - 1];
          var aArr = _atr(rows15m, 14);
          watchMeta[venue] = { atr: (aArr && aArr.length) ? aArr[aArr.length - 1] : NaN,
                               lastClose: (lc && isFinite(lc.c)) ? lc.c : NaN };
        }
        if (!watchFn) return;
        var wl = watchFn({ rows15m: rows15m, rows1h: rows1h, rows4h: rows4h, now: now, tf: '15m' });
        for (var wi = 0; wi < (wl || []).length; wi++){
          if (wl[wi]){ wl[wi].venue = venue; armedAll.push(wl[wi]); }
        }
      }catch(eW){}
    }

    var stRoute = !!(scanSt && scanSt.useStartraderRouting);
    /* leg 1: primary gold feed */
    var gold = stRoute ? await fetchStartraderGoldKlines() : await fetchGoldKlines();
    try{
      if (typeof W.hgVolFromCloses === 'function' && gold.rows4h && gold.rows4h.length >= 30){
        W.__hgGoldVolPack = W.hgVolFromCloses(gold.rows4h.map(function(r){ return r.c; }));
      }
    }catch(eVol){}
    setProg(ui, 0.45);
    var scalpBundle = {};
    if (ctx.macro && ctx.macro.us10yCandles) scalpBundle.us10yCandles = ctx.macro.us10yCandles;
    if (typeof W !== 'undefined' && W){
      if (W.__hgGoldTickBuffer) scalpBundle.tickBuffer = W.__hgGoldTickBuffer;
      if (W.__hgGoldL2Book) scalpBundle.l2OrderBook = W.__hgGoldL2Book;
    }
    if (gold && gold.rows1d && gold.rows1d.length) scalpBundle.dailyCandles = gold.rows1d;
    if (gold.src && gold.src['15m']) scalpBundle.candleSource = gold.src['15m'];
    else if (gold.source) scalpBundle.candleSource = gold.source;
    if (gold.rows15m.length){
      var v = (gold.source === 'xm-xauusd') ? venueLabel(gold.source)
        : (stRoute ? stGoldVenueLabel(gold.source) : venueLabel(gold.source));
      var sym1 = (gold.source === 'xm-xauusd' || stRoute) ? ST_GOLD_SYM
        : ((gold.source === 'binance-paxg') ? 'PAXGUSDT' : 'XAUUSDT');
      var zonesFn = gfn('goldUpdateActiveZones');
      var evalFn = gfn('HardgateGoldEngine');
      if (zonesFn){
        try{
          var zOut = zonesFn(gold.rows15m);
          if (typeof W !== 'undefined' && W) W.hgActiveOrderBlocks = zOut && zOut.activeOrderBlocks ? zOut.activeOrderBlocks : [];
        }catch(eZ){ if (typeof W !== 'undefined' && W) W.hgActiveOrderBlocks = []; }
      }
      if (evalFn && typeof evalFn.evaluateScalp === 'function'){
        try{
          var aArr = _atr(gold.rows15m, 14);
          var a15x = (aArr && aArr.length) ? aArr[aArr.length - 1] : NaN;
          if (typeof W !== 'undefined' && W){
            W.hgLastScalpEval = evalFn.evaluateScalp(gold.rows15m, { atr15: a15x });
          }
        }catch(eEv){ if (typeof W !== 'undefined' && W) W.hgLastScalpEval = null; }
      }
      venueRows[v] = { rows15m: gold.rows15m };
      var got = buildCandidates(gold, now, news, v, sym1, scalpBundle);
      collectWatch(gold.rows15m, gold.rows1h, gold.rows4h, v);
      for (i = 0; i < got.length; i++) cands.push(got[i]);
      for (i = 0; i < (got.rejected || []).length; i++) rejectedAll.push(got.rejected[i]);
      legs.push(v + ': ' + gold.rows15m.length + ' 15m bars — '
        + (got.length ? got.length + ' strategy candidate' + (got.length === 1 ? '' : 's') : 'no qualifying confluence'));
      if (gold.mixed){
        var mixTxt = (typeof hgGoldSrcMixedLabel === 'function') ? hgGoldSrcMixedLabel(gold.src) : '';
        legs.push('MIXED FEED — ' + mixTxt + ' · cross-timeframe alignment is comparing two different markets');
      }
    } else {
      legs.push('primary gold feed: no 15m klines from any source (macro chain + PAXGUSDT both failed)');
    }

    /* Delta XAUTUSD leg removed — XAUT ~4330 vs broker/XM spot ~4397; not comparable. */
    legs.push('DELTA XAUTUSD: skipped — gold scalp uses broker-aligned XAUUSD spot only');

    /* ranking: transparent confluence tally across ALL venues */
    var ranked = cands, best = null;
    var klineSpot = goldSpotRefFromRows(gold.rows15m);
    var liveSpot = await goldLiveSpotRef(klineSpot);
    var spotRef = (isFinite(liveSpot) && liveSpot > 0) ? liveSpot : klineSpot;
    if (isFinite(liveSpot) && isFinite(klineSpot) && Math.abs(klineSpot / liveSpot - 1) * 100 > 0.5){
      legs.push('spot anchor ~$' + pxF(liveSpot) + ' (klines ~$' + pxF(klineSpot) + ') — levels scaled to live spot');
      goldAlignLevelsToSpot(cands, klineSpot, liveSpot);
    } else if (isFinite(liveSpot)){
      legs.push('spot anchor ~$' + pxF(liveSpot) + ' (gold-api.com)');
    }
    var convPre = loadConvictions();
    var purged = goldPurgeStaleConvictions(convPre, liveSpot);
    if (purged) saveConvictions(convPre);
    if (purged) legs.push('cleared ' + purged + ' stale conviction' + (purged === 1 ? '' : 's') + ' (XAUT / off-spot locks)');
    var cvFn = gfn('goldCrossVenueMap');
    if (cvFn) ctx.crossVenue = cvFn(cands);
    if (rankFn){
      var rk = null;
      try{ rk = rankFn(cands, ctx); }catch(eR){ rk = null; }
      if (rk && Array.isArray(rk.ranked)){
        ranked = rk.ranked; best = rk.best;
        for (i = 0; i < (rk.rejected || []).length; i++) rejectedAll.push(rk.rejected[i]);
      }
    } else {
      var gOrd = { A: 0, B: 1, C: 2 };
      ranked = cands.slice().sort(function(x, y){
        var gx = (gOrd[x.grade] === undefined) ? 9 : gOrd[x.grade];
        var gy = (gOrd[y.grade] === undefined) ? 9 : gOrd[y.grade];
        if (gx !== gy) return gx - gy;
        return (isFinite(y.killzoneWeight) ? y.killzoneWeight : 0) - (isFinite(x.killzoneWeight) ? x.killzoneWeight : 0);
      });
      best = ranked.length ? ranked[0] : null;
      legs.push('goldRankSetups unavailable — ordered by grade/killzone only');
    }
    goldAnnotateXautBasis(ranked, spotRef);

    var filterFn = gfn('hgFilterGoldPostGate');
    if (filterFn){
      try{
        ranked = await filterFn(ranked, venueRows, gold.rows4h, 'gold-scalp');
      }catch(ePg){}
    }
    var atrW = NaN;
    if (gold.rows4h && gold.rows4h.length){
      try{
        var aArrW0 = _atr(gold.rows15m.length ? gold.rows15m : gold.rows4h, 14);
        atrW = (aArrW0 && aArrW0.length) ? aArrW0[aArrW0.length - 1] : NaN;
      }catch(eA){}
    }
    var wkFn = gfn('hgApplyGoldWeekendDemotes');
    if (wkFn && gold.rows4h && gold.rows4h.length){
      try{
        wkFn(ranked, gold.rows4h, atrW, now);
      }catch(eWk){}
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
    if (applyBlFn){
      goldApplyBestLevelsBatch(ranked, venueRows, gold, atrW, now);
    } else {
    var formFn = gfn('hgFormTicket');
    if (formFn){
      for (var fi2 = 0; fi2 < ranked.length; fi2++){
        var gc2 = ranked[fi2];
        if (!gc2 || gc2.demoted || gc2.vetoed) continue;
        var vrF2 = venueRows[gc2.venue];
        var rF2 = (vrF2 && vrF2.rows15m && vrF2.rows15m.length) ? vrF2.rows15m : gold.rows15m;
        try{
          var gHit2 = Object.assign({}, gc2, {
            mark: gc2.pxNow || (rF2.length ? rF2[rF2.length - 1].c : gc2.entry),
            structStop: gc2.structStop || gc2.anchor
          });
          var gfm2 = formFn(gHit2, { rows: rF2, style: 'gold-scalp', a4: atrW, m15: rF2,
            rankBoost: (gc2.agree || 0) + (gc2.killzoneWeight || 0) });
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
              if (isFinite(gfm2.hit.t3)) gc2.t3 = gfm2.hit.t3;
            }
            var rskF2 = Math.abs(gc2.entry - gc2.stop);
            if (rskF2 > 0){
              if (isFinite(gc2.t1)) gc2.rr = Math.abs(gc2.t1 - gc2.entry) / rskF2;
              if (isFinite(gc2.t2)) gc2.rr2 = Math.abs(gc2.t2 - gc2.entry) / rskF2;
              if (isFinite(gc2.t3)) gc2.rr3 = Math.abs(gc2.t3 - gc2.entry) / rskF2;
            }
          }
        }catch(eGf2){}
      }
    }
    }

    /* (5) NEWS-WINDOW VETO — inside a high-impact ±30-min window NO new
       conviction is issued; already-live convictions keep running untouched */
    var newsVeto = false, newsVetoTitle = null;
    var ncFn = gfn('goldNewsCaution');
    if (ncFn && news){
      try{
        var nc2 = ncFn(news, now);
        if (nc2 && nc2.caution){ newsVeto = true; newsVetoTitle = nc2.title || null; }
      }catch(eV){ newsVeto = false; }
    }

    /* CONVICTION LOCK — restore issued levels verbatim; transitions only on
       invalidation against the latest 15m close (STOPPED / TARGET HIT /
       EXPIRED); never re-pick levels for a live conviction */
    var lock = applyConviction(ranked, venueRows, now, newsVeto);
    if (isFinite(liveSpot) && liveSpot > 0){
      var guarded = goldSpotGuardAfterLock(lock.store, ranked, liveSpot);
      if (guarded){
        saveConvictions(lock.store);
        legs.push('spot guard — cleared/realigned ' + guarded + ' off-spot conviction' + (guarded === 1 ? '' : 's'));
      }
    }

    /* split: vetoed candidates render as named reason lines, not cards */
    var cards = [], i2;
    for (i2 = 0; i2 < ranked.length; i2++){
      var vc = ranked[i2];
      if (vc){
        var vr2 = venueRows ? venueRows[vc.venue] : null;   /* current 15m close for entry guidance */
        if (vr2 && vr2.rows15m && vr2.rows15m.length){
          var lc2 = vr2.rows15m[vr2.rows15m.length - 1];
          if (lc2 && isFinite(lc2.c)) vc.pxNow = lc2.c;
        }
      }
      if (vc && vc.vetoed){
        rejectedAll.push({ id: vc.id || null, strategy: vc.strategy || null, stratKey: vc.stratKey || null,
                           dir: vc.dir, venue: vc.venue || null, sym: vc.sym || null,
                           reason: 'NEWS WINDOW — no new entries, wait 15–30 min after release'
                                   + (newsVetoTitle ? ' (' + newsVetoTitle + ')' : '') });
      } else if (vc) cards.push(vc);
    }
    if (newsVeto) legs.push('high-impact news window — new convictions held (existing ones keep running)');

    /* MOST PROBABLE = spot-aligned leader when XAUT basis is wide vs spot ref */
    var naiveBest = null;
    for (i2 = 0; i2 < ranked.length; i2++){
      var nbc = ranked[i2];
      if (nbc && !nbc.demoted && !nbc.vetoed){ naiveBest = nbc; break; }
    }
    best = goldPickSpotAlignedBest(ranked, spotRef);
    if (naiveBest && best && naiveBest.sym === 'XAUTUSD' && best.sym !== 'XAUTUSD' && isFinite(spotRef)){
      legs.push('MOST PROBABLE: ' + best.venue + ' ~$' + pxF(best.entry)
        + ' (spot ref ~$' + pxF(spotRef) + ') — not Delta XAUTUSD ~$' + pxF(naiveBest.entry)
        + ' (XAUT trades at a discount to spot)');
    }

    var mergeFn = (typeof mergeLiveConvictionCards === 'function') ? mergeLiveConvictionCards
      : ((typeof W !== 'undefined' && W) ? W.mergeLiveConvictionCards : null);
    var display = mergeFn ? mergeFn(cards, lock.store, { strategyDefault: 'SCALP SETUP' }) : cards.slice();
    if (isFinite(liveSpot) && liveSpot > 0 && display.length){
      goldSpotGuardAfterLock(lock.store, display, liveSpot);
      display = display.filter(function(c){ return c && !c.vetoed; });
    }
    var displayBest = best;
    if (!displayBest && display.length){
      for (var db = 0; db < display.length; db++){
        var dc0 = display[db];
        if (dc0 && !dc0.demoted && !dc0.vetoed){ displayBest = dc0; break; }
      }
    }
    if (!displayBest && display.length) displayBest = display[0];

    if (lock.transitions.length){
      legs.push(lock.transitions.length + ' conviction' + (lock.transitions.length === 1 ? '' : 's')
        + ' closed (' + lock.transitions.map(function(t){ return t.status; }).join(', ').toLowerCase() + ')');
    }
    var liveN = 0;
    for (var k in lock.store.live){ if (Object.prototype.hasOwnProperty.call(lock.store.live, k)) liveN++; }

    /* WHY SILENT — the honest lead reason when zero candidates qualify.
       Session context for the killzone case (same goldKillzone the gates use). */
    var whySilent = null;
    if (!display.length){
      var kzW = null, kzL = null;
      var kzFn2 = gfn('goldKillzone');
      if (kzFn2){
        try{
          var kz2 = kzFn2(now);
          if (kz2){ kzW = kz2.weight; kzL = kz2.label; }
        }catch(eK2){}
      }
      whySilent = whySilentText({
        newsVeto: newsVeto, newsVetoTitle: newsVetoTitle,
        feedsFailed: !gold.rows15m.length,
        kzWeight: kzW, kzLabel: kzL,
        liveN: liveN, armed: armedAll, watchMeta: watchMeta
      });
    }

    var basisHtml = stRoute ? stGoldBasisHtml() : '';
    var mixedBanner = goldMixedFeedBannerHtml(gold);
    var wkRows = gold.rows4h.length ? gold.rows4h : gold.rows15m;
    paintGoldWeekendPanel(ui, wkRows, now, displayBest);
    var aplusCtx = goldBuildAPlusCtx(ctx, gold, now, news);
    var aplusPack = goldEvalAPlusBatch(ranked, aplusCtx);
    try{
      var auditFn = gfn('hgTallyLegAudit');
      if (auditFn && typeof W !== 'undefined' && W && typeof W.hgScoreRecords === 'function'){
        W.__hgGoldTallyAudit = auditFn(W.hgScoreRecords().filter(function(r){ return r && r.lane === 'gold'; }));
      }
    }catch(eAu){}
    /* render */
    if (ui && ui.cards && ui.empty){
      if (display.length){
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = basisHtml + mixedBanner + aplusPack.panel + bannerHTML(displayBest, display)
          + display.map(function(c){ return cardHTML(c, !!(displayBest && c.id === displayBest.id), season && season.note); }).join('')
          + formingNowHTML(armedAll)
          + rejectedHTML(rejectedAll)
          + historyHTML(lock.store.history);
      } else if (rejectedAll.length || armedAll.length){
        /* zero qualifying candidates but something to show: WHY SILENT leads,
           then the watch panel, then the held-back reason lines */
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = basisHtml + mixedBanner + (whySilent ? whySilentHTML(whySilent) : '')
          + rejectedHTML(rejectedAll)
          + formingNowHTML(armedAll)
          + historyHTML(lock.store.history);
      } else {
        /* literally nothing (feeds failed): the empty state carries the reason */
        ui.cards.innerHTML = basisHtml;
        if (whySilent) ui.empty.innerHTML = '<b>WHY SILENT</b> — ' + esc(whySilent);
        ui.empty.style.display = 'block';
      }
    }
    var secs = ((Date.now() - t0)/1000).toFixed(1);
    setStat(ui, legs.join(' · ') + ' · ' + liveN + ' live conviction' + (liveN === 1 ? '' : 's')
            + ' · ' + secs + 's · ' + new Date().toISOString().slice(11, 19) + ' UTC',
            !gold.rows15m.length);
    setProg(ui, null);
    if (gold.rows15m.length){
      publishState(display);
      publishScan(display, displayBest, lock.store.history, now, rejectedAll, armedAll, whySilent);
      var visionEnrich = gfn('hgChartVisionEnrichSetups');
      var visionRefresh = gfn('hgChartVisionRefreshGoldCards');
      if (visionEnrich && display.length && ui && ui.cards){
        visionEnrich(display, function(c){
          var vr = venueRows[c.venue];
          return (vr && vr.rows15m && vr.rows15m.length) ? vr.rows15m : gold.rows15m;
        }, { limit: 3 }).then(function(){
          if (scanSt.visionGen !== visionGen) return;
          if (typeof visionRefresh === 'function'){
            visionRefresh({
              scanSt: scanSt, scanGen: visionGen, ui: ui, display: display, displayBest: displayBest,
              basisHtml: basisHtml, bannerHTML: bannerHTML, cardHTML: cardHTML,
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
function goldscalpMountInto(el, scanSt, cfg){
  cfg = cfg || {};
  if (!el || !scanSt) return null;
  var p = cfg.prefix || 'gs';
  var h2 = cfg.heading || 'GOLD SCALP';
  var span = cfg.subheading || 'multi-strategy SMC/ICT engine · 15m execution · 1H/4H context · conviction-locked levels';
  var statIdle = cfg.statIdle || 'idle — composes per-strategy candidates on 15m/1h/4h, ranks them by a transparent tally, and locks issued levels.';
  var deskNote = cfg.showDeskNote !== false
    ? ('<div class="note" style="margin-top:8px">Desk note: gold respects levels. The engine composes ONE candidate per '
      + 'strategy trigger — <b>liquidity-sweep reversal</b>, <b>order-block/breaker retest</b>, <b>FVG fill</b>, '
      + '<b>session-VWAP bounce/rejection</b>, <b>EMA 20/50/200 ribbon pullback</b>, <b>Asian-range breakout</b> '
      + '(00:00–07:00 GMT box) and <b>RSI 75/25 divergence</b> — each needing its trigger plus ≥2 independent agreeing '
      + 'reads. Every candidate is ranked by a visible <b>confluence tally</b>: agreeing reads + ICT killzone weight '
      + '(London/NY overlap highest) − high-impact news-window penalty ± macro tilt (DXY/US10Y) ± PAXG-basis '
      + 'positioning + seasonality + fear&amp;greed. The leader gets the <b>MOST PROBABLE SETUP</b> banner. Stops are '
      + '1.5–2× ATR14(15m), never tighter; targets 1.5R / 2.5R snapped to opposing structure. Issued setups are '
      + '<b>CONVICTION-LOCKED</b>: re-scans restore the original levels verbatim — they only move on invalidation '
      + '(15m close beyond stop → STOPPED, TP1 → TARGET HIT, 6h → EXPIRED), and closed setups stay visible as history. '
      + '<b>QUALITY GATES</b> cut low-probability setups before they lead: off-session detections (outside every ICT '
      + 'killzone) are demoted and held to a +2 tally bar, counter-trend entries against a sloping 200-EMA-15m/4H stack '
      + 'are demoted unless they are sweep-reclaims, a realized TP1 under 1.2R after structure-snapping drops the setup, '
      + 'Kaufman-ER chop (&lt; 0.25) demotes mean-reversion retests, and a high-impact news window vetoes NEW convictions '
      + '— every gate names its reason on the card or on a held-back line below.</div>')
    : '';
  var emptyMsg = cfg.emptyMsg || 'no A-grade confluence right now — gold respects levels; wait for the sweep.';
  try{
    el.innerHTML =
      '<style>' + GS_CSS + '</style>'
      + '<div class="panel">'
      + '<h2>' + h2 + ' <span>' + span + '</span></h2>'
      + '<div class="row"><button class="btn" id="' + p + 'Run">RUN SCAN</button>'
      + '<span class="note" id="' + p + 'Stat">' + statIdle + '</span></div>'
      + deskNote
      + '<div class="prog" id="' + p + 'Prog"><i></i></div>'
      + '</div>'
      + '<div id="' + p + 'Weekend" class="gsx-weekend-wrap" style="display:none"></div>'
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
    if (!gfn('goldScalpSetups') && !gfn('goldScalpSetup')) missing.push('goldScalpSetups/goldScalpSetup (goldind.js)');
    if (cfg.useStartraderRouting){
      if (!gfn('getXAUCandles') && !gfn('startraderCandles')) missing.push('XAUUSD candles (getXAUCandles / startraderCandles)');
    } else if (!gfn('getGoldCandles') && !gfn('binanceKlines')){
      missing.push('gold klines (macro.js getGoldCandles / binance.js binanceKlines)');
    }
    if (missing.length) setStat(ui, 'missing: ' + missing.join(', ') + ' — check script load order.', true);

    if (ui.btn) ui.btn.addEventListener('click', function(){ return runScan(ui, scanSt); });
    try{
      if (typeof hgSetupPaintDesk === 'function'){
        hgSetupPaintDesk(p + 'Desk', { kind: cfg.deskKind || 'goldscalp', tab: cfg.deskTab || 'GOLD SCALP',
          note: cfg.deskNote || 'Grade-A 15m candidates = CLEAN. FORMING NOW = armed ICT watches, not entries.' });
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
  try{ goldscalpMountInto(el, __scan, { prefix: 'gs', showDeskNote: true }); }catch(e){ /* never throw at mount */ }
}

async function goldscalpRefresh(){
  try{
    if (__scan.busy) return 'busy';
    if (!__scan.hasRun || !__scan.ui) return 'skipped: not run yet';
    return await runScan(__scan.ui, __scan);
  }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
}

/* BRAIN warm-up hook — headless scan against inert stub elements (oiflow.js
   oiflowWarm pattern). Shares __scan.busy with the mounted scan. Never throws. */
function __gsWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}
async function gsWarm(){
  try{
    if (W.goldscalpState && W.goldscalpState()) return 'fresh';
  }catch(e0){}
  if (__scan.busy) return 'busy';
  if (!gfn('goldScalpSetups') && !gfn('goldScalpSetup')) return 'unavailable: goldind.js not loaded';
  if (!gfn('getGoldCandles') && !gfn('binanceKlines')) return 'unavailable: gold klines layer not loaded';
  var stubUi = { btn: __gsWarmShim(), stat: __gsWarmShim(), prog: __gsWarmShim(),
                 cards: __gsWarmShim(), empty: __gsWarmShim() };
  await runScan(stubUi);
  return (W.goldscalpState && W.goldscalpState()) ? 'warmed'
       : 'unavailable: scan did not complete (no gold klines from any source)';
}

/* ---------------- registration ---------------- */
W.goldscalpState = function(){
  try{ return __snap ? __stateView(__snap) : null; }catch(e){ return null; }
};
W.goldscalpScan = function(){
  try{ return __scanSnap ? __stateView(__scanSnap) : null; }catch(e){ return null; }
};
W.goldscalpMountSection = function(el, opts){
  opts = opts || {};
  var scanSt = { busy: false, hasRun: false, ui: null };
  return goldscalpMountInto(el, scanSt, Object.assign({
    prefix: 'stGs',
    heading: 'GOLD SCALP',
    subheading: 'XAUUSD · XM MT5 prices when configured · else spot proxy chain',
    statIdle: 'idle — XAUUSD 15m/1h/4h scalp engine (identical strategy logic to the GOLD SCALP tab)',
    showDeskNote: false,
    useStartraderRouting: true,
    deskKind: 'goldscalp',
    deskTab: 'STAR TRADER · GOLD SCALP'
  }, opts));
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldscalp', label: 'GOLD SCALP', mount: mount, refresh: goldscalpRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldscalp', label: 'GOLD SCALP', run: gsWarm });
})();
