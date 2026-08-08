/* =========================================================================
HARDGATE — scorecard.js
SCORECARD tab: outcome tracking that proves (or disproves) the engine with
real numbers. Philosophy: gates, not scores — evidence, not signals. Every
PRIME/HIGH setup the BRAIN / EXECUTE scans surface can be logged here,
walked forward against 1h candles, and settled to an honest R-multiple.
The per-layer breakdown is the point: which voting layers actually make
money, measured — never assumed.

CALLERS (brain.js / engine.js, both feature-check first):
  window.hgScoreRecord({source:'brain'|'execute', sym, dir, tier,
                        entry, stop, t1, t2, layers:[names], at})
    -> {ok:true, record, persisted, note?} | {ok:false, reason, dupOf?}
    Validates the plan (dir long|short; long: stop<entry<t1; short mirrors;
    t1 required; wrong-side/missing t2 -> null, never invented), DEDUPES
    (same sym+dir within 24h -> {ok:false, reason:'duplicate: ...'}), then
    persists to localStorage 'hg_score_v1' (cap: last 200 records — oldest
    SETTLED evicted first so live trades are never silently dropped; quota
    failures keep the ledger in memory and say so). NEVER throws.

SETTLEMENT (walk rules — the whole honesty of the ledger lives here):
  window.hgScoreSettle(fetchCandles) -> Promise<{settled, open, failed, notes}>
    For every OPEN record: rows = await fetchCandles(record) (per-record
    catch isolation — one symbol's failure never stops the loop and leaves
    an honest note ON the record), then hgScoreWalk. fetchCandles injected
    (tests); when omitted, the module's feature-checked default route runs
    (gold lane -> getXAUCandles; else xuUniverse+xuCandles matched by
    sym/base; else inline getCandles; no route -> every record fails
    honestly, nothing is marked).

  window.hgScoreWalk(record, rows) -> {state, r, bars, closedAt} — PURE.
    rows = ascending 1h candles [{t(seconds),o,h,l,c}]. The walk starts at
    the first bar whose window [t, t+dur) extends PAST record.at (dur from
    row spacing, default 3600s) — the bar containing the entry fill is
    included; earlier bars are ignored. The settlement window is
    [at, at+14d): the first bar opening at or after the 14-day mark ends
    the trade. SAME-BAR RULE: a bar touching both stop and a target counts
    the STOP first (intra-bar order is unknowable — always conservative).
    R LADDER (r(level) = dirSign*(level-entry)/|entry-stop|; engine plans
    are exactly 2R/3.5R so these reproduce the house numbers, non-house
    plans score their ACTUAL multiple — never a fabricated one):
      stop first .................. 'SL'      r = -1 (exactly, by construction)
      t1 first, then t2 ........... 'T2'      r = r(t2)   ("T1-then-T2 = full")
      t1 first, then stop ......... 'T1S'     r = r(t1) * scalePct/100
                                      (partial-bank at t1; default 50% =
                                      TRADE PLAN tScale when recorded)
      t1+t2 spanned by ONE bar .... 'T2' (no stop in that bar -> fill-through)
      t1 first, 14d window ends ... 'T1'      r = r(t1)
      nothing touched in 14d ...... 'EXPIRED' r = mark-to-market at last close
      limit never traded .......... 'UNFILLED' r = null (NOT a trade; excluded
                                      from every expectancy figure, but counted
                                      so a high rate is visible — it means the
                                      limit entries sit too far from the tape)
      rows end before 14d ......... 'OPEN'    r = live mark-to-market
                                      (provisional; closedAt=null)
      malformed record ............ 'INVALID' r = null (zero risk, wrong-side
                                      stop/t1, missing dir/at — never scored)

STATS (pure): window.hgScoreStats(records) -> {
  open, settled, wins, losses, counted, winRate, avgR, expectancy,
  enoughData, byTier:{PRIME:{n,wins,winRate,avgR},HIGH:{...},...},
  byLane:{crypto:{...},gold:{...}}, byDir:{long:{...},short:{...}},
  byLayer:{NAME:{n,wins,winRate,avgR}} }

PROFIT RANK (pure): window.hgProfitRankHint({sym, dir, tier, layers, lane, rr1})
  -> {boost, enough, expectancy, parts} — settled-ledger expectancy as a small
  sort boost (±25 cap). Unproven buckets = boost 0; never throws.
  Settled records WITHOUT a finite R (e.g. EXPIRED with no candle data)
  count in `settled` but are excluded from every rate/average — never
  silently folded in. expectancy = mean R per settled trade (the per-trade
  edge; identical to avgR by construction, kept separate for the header).
  enoughData = settled >= 5 — below that the UI says 'not enough data'.

TAB: window.HG_tabs.push({id:'scorecard', label:'SCORECARD', mount, refresh})
  (STRATEGIES group — nav group wiring lives in index.html, not here.)
  Header scoreboard (win rate / avg R / expectancy / settled+open counts,
  honest 'not enough data' below 5 settled), BY-TIER + BY-LANE/BY-DIR +
  BY-LAYER tables, OPEN table (live mark-to-market, time in trade),
  SETTLED history (last 50, colored outcome pips). Mount renders the stored
  ledger with NO network; RE-SETTLE NOW runs settlement on demand.
  refresh() contract: async, NEVER throws, terse status — 'busy' while a
  settlement is in flight, 'skipped: not run yet' before the first user
  settle (a global refresh must never trigger an expensive first-time
  candle sweep on its own), 'refreshed' after a re-settle.

Classic script, IIFE, no build step. Loads any time after xuniverse.js
(absence of every candle route degrades honestly). Never throws at load.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

/* ---------------- constants ---------------- */
var LS_KEY     = 'hg_score_v1';
var CAP        = 200;                    /* max stored records */
var DEDUPE_MS  = 24 * 3600 * 1000;       /* same sym+dir inside 24h -> duplicate */
var EXPIRE_MS  = 14 * 86400 * 1000;      /* 14-day settlement window */
var MIN_DATA   = 5;                      /* 'not enough data' below this many settled */
var SETTLE_TF  = '1h';
var SETTLE_SEC = 3600;
/* A HARDGATE entry is a LIMIT (EMA21/EMA9 for swings, the sweep level for
   scalps), so it sits AWAY from the mark. A plan whose entry price never
   traded is not a trade — it must never be scored. Without this, an unfilled
   long-limit that ran straight to T1 was booked as a T1/T2 WIN, and the bias
   is one-directional: an unfilled long-limit that runs DOWN has to pass back
   through the entry to reach the stop, so it fills. Only the winners were
   phantom. FILL_BARS matches the LOG's fill window in index.html. */
var FILL_BARS = 12;
var MAX_BARS   = 500;                    /* candle fetch cap (> 14d of 1h bars) */

/* ---------------- module state ---------------- */
var store = [];
var storageNote = null;   /* unreadable existing ledger (load-time), shown in UI */
var persistNote = null;   /* last save failure note (quota), shown in UI */
var idCounter = 0;
var __sc = { busy: false, ranOnce: false, ui: null };

/* ---------------- small pure helpers ---------------- */
function errMsg(e){ return (e && e.message) ? e.message : String(e); }
function scaleFrac(rec){
  var sp = fin(rec && rec.scalePct);
  if (sp === null || sp <= 0) return 0.5;
  if (sp > 100) return 1;
  return sp / 100;
}
function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}
function hgScoreNetR(rec, state, grossR, closedAtSec){
  try{
    var W2 = (typeof window !== 'undefined') ? window : null;
    if (!W2 || typeof W2.hgCostR !== 'function') return null;
    if (typeof grossR !== 'number' || !isFinite(grossR)) return null;
    var exitSide = (state === 'SL' || state === 'EXPIRED') ? 'taker' : 'maker';
    var cost = W2.hgCostR(rec.entry, rec.stop, 'maker', exitSide);
    if (typeof cost !== 'number' || !isFinite(cost)) return null;
    var net = grossR - cost;
    var fp = fin(rec && rec.fundingPct);
    var atMs = fin(rec && rec.at);
    var closed = fin(closedAtSec);
    if (closed === null && rec && rec.closedAt != null) closed = fin(rec.closedAt);
    /* Charge funding from the FILL, not from the signal. With the fill gate in
       place a plan can sit unfilled for hours, and funding accrues on a
       position, not on an intention. filledAt comes from hgScoreWalk. */
    var fillSec = fin(rec && rec.filledAt);
    if (fillSec === null && atMs !== null) fillSec = atMs / 1000;
    if (fp !== null && fillSec !== null && closed !== null && typeof W2.hgFundingCostR === 'function'){
      if (closed > fillSec){
        var fund = W2.hgFundingCostR(rec.entry, rec.stop, rec.dir, fp, fillSec, closed);
        if (typeof fund === 'number' && isFinite(fund)) net -= fund;
      }
    }
    return net;
  }catch(e){ return null; }
}
function round4(x){
  return (typeof x === 'number' && isFinite(x)) ? Math.round(x * 10000) / 10000 : null;
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
/* mirror of xuniverse.js baseOf for BOTH venues ('BTCUSD'/'BTCUSDT'/
   'B-BTC_USDT' -> 'BTC') so records from either scan mode find their
   candle route */
function baseOfSym(sym){
  return String(sym == null ? '' : sym).toUpperCase()
    .replace(/^B-/, '').replace(/_USDT$/, '').replace(/USD(T)?$/, '');
}
function laneOf(sym, hint){
  if (hint === 'gold' || hint === 'crypto') return hint;
  return (/XAU|PAXG|GOLD/.test(String(sym == null ? '' : sym).toUpperCase())) ? 'gold' : 'crypto';
}
function sanitizeLayers(x){
  try{
    if (!Array.isArray(x)) return [];
    var seen = {}, out = [];
    for (var i = 0; i < x.length; i++){
      var s = String(x[i] == null ? '' : x[i]).trim();
      if (!s) continue;
      s = s.slice(0, 32);
      var k = s.toUpperCase();
      if (seen[k]) continue;
      seen[k] = 1; out.push(s);
    }
    return out;
  }catch(e){ return []; }
}

/* ---------------- formatters (display only; null -> honest dash) ---------------- */
function pad(n){ return (n < 10 ? '0' : '') + n; }
function timeStr(){ try{ return new Date().toTimeString().slice(0, 8); }catch(e){ return ''; } }
function dstr(ms){
  try{
    var d = new Date(ms);
    if (!isFinite(d.getTime())) return '—';
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }catch(e){ return '—'; }
}
function ageStr(ms){
  try{
    if (!isFinite(ms) || ms < 0) return '—';
    var h = Math.floor(ms / 3600000);
    if (h < 1) return '<1h';
    if (h < 48) return h + 'h';
    var d = Math.floor(h / 24);
    return d + 'd ' + (h % 24) + 'h';
  }catch(e){ return '—'; }
}
function fmtR(r){
  if (typeof r !== 'number' || !isFinite(r)) return '—';
  return (r > 0 ? '+' : '') + r.toFixed(2) + 'R';
}
function pct(x){
  return (typeof x === 'number' && isFinite(x)) ? (x * 100).toFixed(0) + '%' : '—';
}
function fmtPx(p){
  if (typeof p !== 'number' || !isFinite(p)) return '—';
  var a = Math.abs(p);
  if (a >= 1000) return p.toFixed(1);
  if (a >= 100) return p.toFixed(2);
  if (a >= 1) return p.toFixed(3);
  return p.toPrecision(3);
}

/* ---------------- storage ----------------
   Every access try-caught: localStorage can be absent (vm tests), blocked
   (privacy mode) or full (quota). Failures degrade to in-memory with an
   honest note — the ledger NEVER throws and never lies about persistence. */
function validStoredRecord(r){
  try{
    if (!r || typeof r !== 'object') return false;
    if (typeof r.sym !== 'string' || !r.sym) return false;
    if (r.dir !== 'long' && r.dir !== 'short') return false;
    if (fin(r.entry) === null || fin(r.stop) === null || fin(r.at) === null) return false;
    return true;
  }catch(e){ return false; }
}
function loadStore(){
  store = [];
  storageNote = null;
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    var raw = null;
    try{ raw = localStorage.getItem(LS_KEY); }catch(e){
      storageNote = 'stored ledger unreadable (localStorage access failed) — using an empty in-memory ledger';
      return;
    }
    if (!raw) return;
    var parsed;
    try{ parsed = JSON.parse(raw); }catch(e){
      storageNote = 'stored ledger is corrupt (JSON parse failed) — starting fresh; the raw value was left untouched under ' + LS_KEY;
      return;
    }
    if (!Array.isArray(parsed)){
      storageNote = 'stored ledger is not an array — starting fresh; the raw value was left untouched under ' + LS_KEY;
      return;
    }
    var dropped = 0;
    for (var i = 0; i < parsed.length; i++){
      var r = parsed[i];
      if (!validStoredRecord(r)){ dropped++; continue; }
      if (r.status !== 'settled') r.status = 'open';
      if (!Array.isArray(r.layers)) r.layers = [];
      store.push(r);
    }
    if (dropped) storageNote = 'dropped ' + dropped + ' corrupt entr' + (dropped === 1 ? 'y' : 'ies') + ' from the stored ledger';
    if (store.length > CAP) enforceCap();
  }catch(e){
    store = [];
    storageNote = 'ledger load failed: ' + errMsg(e) + ' — using an empty in-memory ledger';
  }
}
function saveStore(){
  persistNote = null;
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return { ok: false, note: 'localStorage unavailable — ledger kept in memory only' };
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(store));
      return { ok: true };
    }catch(e){
      persistNote = 'localStorage write failed (quota?) — ledger kept in memory only, NOT persisted';
      return { ok: false, note: persistNote };
    }
  }catch(e){
    persistNote = 'ledger save failed: ' + errMsg(e);
    return { ok: false, note: persistNote };
  }
}
/* cap: last 200 records — oldest SETTLED evicted first; a live (open)
   trade is only ever dropped when the store is 200 deep in open trades. */
function enforceCap(){
  try{
    while (store.length > CAP){
      var idx = -1, bestAt = Infinity;
      for (var i = 0; i < store.length; i++){
        if (store[i] && store[i].status === 'settled' && store[i].at < bestAt){ bestAt = store[i].at; idx = i; }
      }
      if (idx < 0){
        for (var j = 0; j < store.length; j++){
          if (store[j] && store[j].at < bestAt){ bestAt = store[j].at; idx = j; }
        }
      }
      if (idx < 0) break;
      store.splice(idx, 1);
    }
  }catch(e){ /* capping is best-effort; the store stays honest either way */ }
}

/* ================= the walk (PURE — vm-testable, no DOM, no network) =================
   record: {dir:'long'|'short', entry, stop, t1, t2?, at(ms)}
   rows:   ascending candles [{t(seconds),o,h,l,c}] (unsorted/gappy input is
           sorted+filtered defensively; duplicates kept in time order).
   Rules (see header for the full contract):
     - the first walked bar is the first bar whose window [t, t+dur) extends
       PAST record.at (dur inferred from row spacing, default 1h) — the bar
       containing the entry fill is included, earlier bars ignored;
     - the settlement window is [at, at+14d): the first bar opening at or
       after the 14-day mark ends the trade (EXPIRED/T1);
     - same-bar stop + target -> the STOP counts (conservative);
     - after t1 is touched, the walk keeps watching the SAME fixed levels
       (no stop-management simulation): stop -> 'T1S' at r(t1)/2, t2 -> 'T2'
       at r(t2) ("T1-then-T2 = full"). */
/* ===================== ADVERSE / FAVOURABLE EXCURSION =====================
   MAE (how far a trade went AGAINST you before it resolved) and MFE (how far
   it went FOR you) are the two numbers a discretionary book is tuned on, and
   this ledger had neither. Everything measured so far answers "did the setup
   work"; MAE/MFE answer "was the stop in the right place" — which is the
   lever that actually moves a win rate.
   Both are reported TWICE:
     maeR / mfeR          up to the actual exit — what the trade really did
     maeFullR / mfeFullR  over the whole settlement window, ignoring the exit
                          — what the trade WOULD have done on a wider stop
   The second pair is what makes the stop sweep honest. Without it you can only
   see which winners a tighter stop would have killed, never which losers a
   wider one would have saved, and a one-sided sweep always argues for wider
   stops. Both branches are observable here because the walk already holds
   every bar in the window.
   All values are in R of the ORIGINAL plan, so they stay comparable across
   symbols and position sizes. */
function hgScoreExcursions(bars, startIdx, entry, stop, dir, deadline){
  var out = { maeR: 0, mfeR: 0, maeFullR: 0, mfeFullR: 0 };
  try{
    var risk = Math.abs(entry - stop);
    if (!(risk > 0) || !Array.isArray(bars)) return out;
    var sign = (dir === 'long') ? 1 : -1;
    for (var i = startIdx; i < bars.length; i++){
      var b = bars[i];
      if (!b || b.t * 1000 >= deadline) break;
      if (b.h === null || b.l === null) continue;
      /* favourable = the best price seen in the trade's direction */
      var fav = sign * ((sign > 0 ? b.h : b.l) - entry) / risk;
      var adv = -sign * ((sign > 0 ? b.l : b.h) - entry) / risk;
      if (fav > out.mfeFullR) out.mfeFullR = fav;
      if (adv > out.maeFullR) out.maeFullR = adv;
    }
    return out;
  }catch(e){ return out; }
}
function hgScoreWalk(record, rows){
  var INVALID = { state: 'INVALID', r: null, bars: 0, closedAt: null };
  try{
    var rec = record || {};
    var dir = (rec.dir === 'long' || rec.dir === 'short') ? rec.dir : null;
    var entry = fin(rec.entry), stop = fin(rec.stop), t1 = fin(rec.t1), t2 = fin(rec.t2);
    var at = fin(rec.at);
    if (!dir || entry === null || stop === null || at === null) return INVALID;
    if (entry === stop) return INVALID;                       /* zero risk: no R unit */
    var sign = (dir === 'long') ? 1 : -1;
    if (dir === 'long'  && !(stop < entry)) return INVALID;   /* wrong-side stop */
    if (dir === 'short' && !(stop > entry)) return INVALID;
    if (t1 !== null && sign * (t1 - entry) <= 0) return INVALID;  /* wrong-side t1 */
    if (t2 !== null && sign * (t2 - entry) <= 0) t2 = null;       /* degenerate t2 ignored */
    var risk = Math.abs(entry - stop);
    function rOf(level){ return sign * (level - entry) / risk; }

    /* defensive copy: keep bars with a finite time, sort ascending */
    var bars = [];
    if (Array.isArray(rows)){
      for (var i = 0; i < rows.length; i++){
        var b = rows[i];
        if (!b) continue;
        var t = fin(b.t);
        if (t === null) continue;
        bars.push({ t: t, h: fin(b.h), l: fin(b.l), c: fin(b.c) });
      }
      bars.sort(function(a, b2){ return a.t - b2.t; });
    }
    var dur = SETTLE_SEC;
    if (bars.length >= 2){
      var d = bars[1].t - bars[0].t;
      if (isFinite(d) && d > 0) dur = d;
    }
    var deadline = at + EXPIRE_MS;
    var touchedT1 = false, walked = 0, lastClose = null, lastT = null, expired = false;
    var filled = false, fillWait = 0, sawBars = 0, filledAt = null, fillIdx = -1;
    var maeR = 0, mfeR = 0;
    var exSign = (dir === 'long') ? 1 : -1;
    function noteExcursion(b){
      if (!b || b.h === null || b.l === null || !(risk > 0)) return;
      var fav = exSign * ((exSign > 0 ? b.h : b.l) - entry) / risk;
      var adv = -exSign * ((exSign > 0 ? b.l : b.h) - entry) / risk;
      if (fav > mfeR) mfeR = fav;
      if (adv > maeR) maeR = adv;
    }
    function ex(){
      var full = hgScoreExcursions(bars, fillIdx < 0 ? 0 : fillIdx, entry, stop, dir, deadline);
      return { maeR: Math.round(maeR * 1000) / 1000, mfeR: Math.round(mfeR * 1000) / 1000,
               maeFullR: Math.round(full.maeFullR * 1000) / 1000,
               mfeFullR: Math.round(full.mfeFullR * 1000) / 1000 };
    }
    for (var k = 0; k < bars.length; k++){
      var bar = bars[k];
      if ((bar.t + dur) * 1000 <= at) continue;      /* closed at/before entry -> pre-entry */
      if (bar.t * 1000 >= deadline){ expired = true; break; }
      sawBars++;
      /* FILL GATE — the plan is only live once price actually trades to the
         limit. Evaluate the fill bar itself for stop/target too: a bar that
         reaches the entry can also reach a level in the same bar. */
      if (!filled){
        var touched = (bar.l !== null && bar.h !== null)
          && (dir === 'long' ? bar.l <= entry : bar.h >= entry);
        if (touched){ filled = true; filledAt = bar.t; fillIdx = k; }
        else {
          fillWait++;
          if (fillWait >= FILL_BARS){
            return { state: 'UNFILLED', r: null, bars: fillWait, closedAt: bar.t };
          }
          continue;
        }
      }
      walked++;
      noteExcursion(bar);
      lastT = bar.t;
      if (bar.c !== null) lastClose = bar.c;
      var stopHit = (bar.l !== null && bar.h !== null)
        && (dir === 'long' ? bar.l <= stop : bar.h >= stop);
      var t1Hit = (t1 !== null && bar.l !== null && bar.h !== null)
        && (dir === 'long' ? bar.h >= t1 : bar.l <= t1);
      var t2Hit = (t2 !== null && bar.l !== null && bar.h !== null)
        && (dir === 'long' ? bar.h >= t2 : bar.l <= t2);
      if (!touchedT1){
        if (stopHit) return Object.assign({ state: 'SL', r: -1, bars: walked, closedAt: bar.t, filledAt: filledAt }, ex());
        if (t1Hit){
          if (t2Hit) return Object.assign({ state: 'T2', r: rOf(t2), bars: walked, closedAt: bar.t, filledAt: filledAt }, ex());
          touchedT1 = true;
          continue;
        }
        if (t2Hit) return Object.assign({ state: 'T2', r: rOf(t2), bars: walked, closedAt: bar.t, filledAt: filledAt }, ex());
      }else{
        if (stopHit) return Object.assign({ state: 'T1S', r: rOf(t1) * scaleFrac(rec), bars: walked, closedAt: bar.t, filledAt: filledAt }, ex());
        if (t2Hit) return Object.assign({ state: 'T2', r: rOf(t2), bars: walked, closedAt: bar.t, filledAt: filledAt }, ex());
      }
    }
    if (touchedT1){
      if (expired) return Object.assign({ state: 'T1', r: rOf(t1), bars: walked, closedAt: lastT, filledAt: filledAt }, ex());
      return Object.assign({ state: 'OPEN', r: (lastClose !== null ? rOf(lastClose) : null), bars: walked, closedAt: null, filledAt: filledAt }, ex());
    }
    if (!filled){
      /* NO DATA is not the same as NOT FILLED. When zero in-window bars were
         inspected we know nothing about the fill, so fall through to the
         pre-existing OPEN / EXPIRED behaviour rather than asserting a fill
         verdict we cannot support. Only claim PENDING_FILL / UNFILLED when
         bars were actually examined and none of them reached the limit. */
      if (sawBars > 0){
        if (expired) return { state: 'UNFILLED', r: null, bars: fillWait, closedAt: lastT };
        return { state: 'PENDING_FILL', r: null, bars: fillWait, closedAt: null, filledAt: filledAt };
      }
    }
    if (expired) return Object.assign({ state: 'EXPIRED', r: (lastClose !== null ? rOf(lastClose) : null), bars: walked, closedAt: lastT, filledAt: filledAt }, ex());
    return Object.assign({ state: 'OPEN', r: (lastClose !== null ? rOf(lastClose) : null), bars: walked, closedAt: null, filledAt: filledAt }, ex());
  }catch(e){ return INVALID; }
}

/* ================= stats (PURE — vm-testable) =================
   Buckets count SETTLED records with a finite R only; null-R settlements
   stay visible in `settled` but never leak into a rate or average. */
function hgScoreStats(records){
  var empty = { open: 0, settled: 0, wins: 0, losses: 0, counted: 0, countedNet: 0,
                winRate: null, avgR: null, avgNetR: null,
                expectancy: null, expectancyNet: null, enoughData: false,
                byTier: { PRIME: { n: 0, wins: 0, winRate: null, avgR: null },
                          HIGH:  { n: 0, wins: 0, winRate: null, avgR: null } },
                byLane: { crypto: { n: 0, wins: 0, winRate: null, avgR: null },
                          gold:   { n: 0, wins: 0, winRate: null, avgR: null } },
                byDir:  { long:  { n: 0, wins: 0, winRate: null, avgR: null },
                          short: { n: 0, wins: 0, winRate: null, avgR: null } },
                byLayer: {} };
  try{
    var list = Array.isArray(records) ? records : [];
    var rs = [];      /* settled with finite r — the only r-math basis */
    var settled = 0, open = 0;
    for (var i = 0; i < list.length; i++){
      var r = list[i];
      if (!r || typeof r !== 'object') continue;
      if (r.status === 'settled'){
        settled++;
        if (typeof r.r === 'number' && isFinite(r.r)) rs.push(r);
      }else{
        open++;
      }
    }
    function bucket(){ return { n: 0, wins: 0, sumR: 0, nNet: 0, sumNet: 0 }; }
    function finish(b){
      return { n: b.n, wins: b.wins,
               winRate: b.n ? b.wins / b.n : null,
               avgR: b.n ? b.sumR / b.n : null,
               /* null when the cost model was unavailable — never a gross
                  number wearing a net label */
               avgNetR: b.nNet ? b.sumNet / b.nNet : null, nNet: b.nNet };
    }
    function addNet(b, rn){ if (typeof rn === 'number' && isFinite(rn)){ b.nNet++; b.sumNet += rn; } }
    var byTier = { PRIME: bucket(), HIGH: bucket() };
    var byLane = { crypto: bucket(), gold: bucket() };
    var byDir = { long: bucket(), short: bucket() };
    var byLayer = {};
    var wins = 0, losses = 0, sumR = 0, nNetAll = 0, sumNetAll = 0;
    for (var j = 0; j < rs.length; j++){
      var rec = rs[j], rr = rec.r;
      var rn = (typeof rec.rNet === 'number' && isFinite(rec.rNet)) ? rec.rNet : null;
      if (rr > 0) wins++; else if (rr < 0) losses++;
      sumR += rr;
      if (rn !== null){ nNetAll++; sumNetAll += rn; }
      var tier = (typeof rec.tier === 'string' && rec.tier) ? rec.tier.toUpperCase() : 'UNTIERED';
      if (!byTier[tier]) byTier[tier] = bucket();
      byTier[tier].n++; byTier[tier].sumR += rr; if (rr > 0) byTier[tier].wins++; addNet(byTier[tier], rn);
      var lane = (rec.lane === 'gold') ? 'gold' : 'crypto';
      byLane[lane].n++; byLane[lane].sumR += rr; if (rr > 0) byLane[lane].wins++; addNet(byLane[lane], rn);
      var dir = (rec.dir === 'short') ? 'short' : 'long';
      byDir[dir].n++; byDir[dir].sumR += rr; if (rr > 0) byDir[dir].wins++; addNet(byDir[dir], rn);
      var layers = Array.isArray(rec.layers) ? rec.layers : [];
      for (var li = 0; li < layers.length; li++){
        var ln = String(layers[li] == null ? '' : layers[li]).trim().toUpperCase();
        if (!ln) continue;
        if (!byLayer[ln]) byLayer[ln] = bucket();
        byLayer[ln].n++; byLayer[ln].sumR += rr; if (rr > 0) byLayer[ln].wins++; addNet(byLayer[ln], rn);
      }
    }
    var counted = rs.length;
    var avgR = counted ? sumR / counted : null;
    var out = {
      open: open, settled: settled, wins: wins, losses: losses, counted: counted,
      winRate: counted ? wins / counted : null,
      avgR: avgR,
      avgNetR: nNetAll ? sumNetAll / nNetAll : null,
      countedNet: nNetAll,
      expectancy: avgR,   /* mean R per settled trade — the per-trade edge, GROSS */
      expectancyNet: nNetAll ? sumNetAll / nNetAll : null,  /* the one that decides */
      enoughData: settled >= MIN_DATA,
      byTier: {}, byLane: {}, byDir: {}, byLayer: {}
    };
    for (var tk in byTier) out.byTier[tk] = finish(byTier[tk]);
    for (var lk in byLane) out.byLane[lk] = finish(byLane[lk]);
    for (var dk in byDir) out.byDir[dk] = finish(byDir[dk]);
    for (var nk in byLayer) out.byLayer[nk] = finish(byLayer[nk]);
    return out;
  }catch(e){ return empty; }
}

/* ===================== HEAT PROFILE (PURE) =====================
   The two questions a stop and a target should be set from, answered off your
   own ledger instead of an ATR multiple:
     MAE on WINNERS  how much heat did the trades that WORKED take first?
                     If p90 sits at 0.9R against a 1.0R stop, you are keeping
                     your winners by 0.1R and ordinary noise will start taking
                     them.
     MFE on LOSERS   how far did the trades that FAILED run in your favour
                     before turning? If the median loser reached +0.7R, a
                     partial there converts a chunk of full losses into
                     scratches without touching entry selection at all.
   Both use the TO-EXIT pair, because this describes trades as they were
   actually taken. The sweep uses the full-window pair; they are different
   questions and must not be mixed. */
function hgHeatProfile(records){
  var out = { winners: null, losers: null, nWin: 0, nLoss: 0, stopMarginR: null, note: '' };
  try{
    var list = Array.isArray(records) ? records : [];
    var winMae = [], lossMfe = [];
    for (var i = 0; i < list.length; i++){
      var r = list[i];
      if (!r || r.status !== 'settled') continue;
      if (typeof r.r !== 'number' || !isFinite(r.r)) continue;
      if (r.r > 0 && typeof r.maeR === 'number' && isFinite(r.maeR)) winMae.push(r.maeR);
      if (r.r < 0 && typeof r.mfeR === 'number' && isFinite(r.mfeR)) lossMfe.push(r.mfeR);
    }
    function pct(arr, q){
      if (!arr.length) return null;
      var a = arr.slice().sort(function(x, y){ return x - y; });
      var idx = Math.min(a.length - 1, Math.max(0, Math.floor(a.length * q)));
      return Math.round(a[idx] * 1000) / 1000;
    }
    out.nWin = winMae.length; out.nLoss = lossMfe.length;
    if (winMae.length) out.winners = { p50: pct(winMae, 0.50), p75: pct(winMae, 0.75), p90: pct(winMae, 0.90), max: pct(winMae, 1) };
    if (lossMfe.length) out.losers  = { p50: pct(lossMfe, 0.50), p75: pct(lossMfe, 0.75), p90: pct(lossMfe, 0.90), max: pct(lossMfe, 1) };
    /* the stop sits at exactly 1.0R by definition — margin is what is left
       above the heat your winners actually take */
    if (out.winners) out.stopMarginR = Math.round((1 - out.winners.p90) * 1000) / 1000;
    var n = Math.min(winMae.length, lossMfe.length);
    out.note = (n < 20)
      ? 'thin sample (' + winMae.length + ' winners, ' + lossMfe.length + ' losers) — shape only, not a decision'
      : winMae.length + ' winners, ' + lossMfe.length + ' losers';
    return out;
  }catch(e){ return out; }
}
/* ===================== STOP-DISTANCE SWEEP (PURE) =====================
   The question no ledger in this app could answer before: IS THE STOP IN THE
   RIGHT PLACE?
   For a stop multiplier k, R itself rescales. Risk becomes k times larger, so
   a loss is still exactly -1R by definition, but a target that paid +2R now
   pays +2/k R because the same price move is a smaller multiple of a bigger
   risk. That is the trade-off a wider stop actually makes, and it is why
   "wider stops win more" is only half an argument.
   A trade's fate under multiplier k is read off its FULL-WINDOW excursions:
     stopped   if maeFullR >= k          (it went that far against you)
     otherwise it reaches whatever mfeFullR it reached, capped at its own
     target in R, and pays that divided by k
   Using maeFullR / mfeFullR — not the to-exit pair — is what makes this
   two-sided: a trade that really got stopped at -1R may have run to +3R
   afterwards, and only the full-window numbers can see it. A sweep built on
   to-exit data alone can only ever show you which winners a tighter stop
   would have killed, so it always argues for wider stops.
   This is descriptive, not predictive. It reports what the recorded tape
   would have paid. It cannot know how a different stop would have changed
   your own behaviour, and with a small ledger the differences between
   multipliers are inside the noise — which is why every row reports n. */
function hgStopSweep(records, multipliers){
  var out = { n: 0, rows: [], best: null, note: '' };
  try{
    var ks = Array.isArray(multipliers) && multipliers.length
      ? multipliers.slice() : [0.6, 0.8, 1.0, 1.25, 1.5, 2.0];
    var list = Array.isArray(records) ? records : [];
    var usable = [];
    for (var i = 0; i < list.length; i++){
      var r = list[i];
      if (!r || r.status !== 'settled') continue;
      if (typeof r.maeFullR !== 'number' || !isFinite(r.maeFullR)) continue;
      if (typeof r.mfeFullR !== 'number' || !isFinite(r.mfeFullR)) continue;
      /* target in R of the ORIGINAL plan */
      var tgt = null;
      var e = fin(r.entry), st = fin(r.stop), t1 = fin(r.t1);
      if (e !== null && st !== null && t1 !== null && Math.abs(e - st) > 0){
        tgt = Math.abs(t1 - e) / Math.abs(e - st);
      }
      if (tgt === null || !(tgt > 0)) continue;
      usable.push({ mae: r.maeFullR, mfe: r.mfeFullR, tgt: tgt });
    }
    out.n = usable.length;
    if (!usable.length){
      out.note = 'no settled record carries full-window excursions yet — they are '
        + 'written from fix pack 15 onward, so this fills in as trades settle';
      return out;
    }
    for (var a = 0; a < ks.length; a++){
      var k = ks[a];
      if (!(k > 0)) continue;
      var sum = 0, wins = 0, stopped = 0;
      for (var b = 0; b < usable.length; b++){
        var u = usable[b];
        if (u.mae >= k){ sum += -1; stopped++; continue; }
        /* survived: it pays the smaller of what it reached and its own target */
        var reached = Math.min(u.mfe, u.tgt);
        if (reached <= 0){ sum += 0; continue; }
        sum += reached / k;
        if (reached >= u.tgt) wins++;
      }
      out.rows.push({
        k: k, n: usable.length,
        stoppedPct: stopped / usable.length,
        hitPct: wins / usable.length,
        expectancyR: sum / usable.length
      });
    }
    var best = null;
    for (var c = 0; c < out.rows.length; c++){
      if (!best || out.rows[c].expectancyR > best.expectancyR) best = out.rows[c];
    }
    out.best = best;
    out.note = (usable.length < 30)
      ? 'n=' + usable.length + ' — the gaps between multipliers here are inside the noise; read this as a shape, not a decision'
      : 'n=' + usable.length + ' settled trades with full-window excursions';
    return out;
  }catch(e){ return out; }
}
/* Live stop width from settled-ledger stop sweep (Fix Pack 15 → tickets). */
function hgLiveStopScale(){
  try{
    if (typeof hgScoreRecords !== 'function' || typeof hgStopSweep !== 'function') return 1;
    var recs = hgScoreRecords() || [];
    var sw = hgStopSweep(recs);
    if (sw && sw.best && sw.n >= 30 && isFinite(sw.best.k) && sw.best.k > 0){
      return Math.max(0.6, Math.min(2.0, sw.best.k));
    }
    return 1;
  }catch(e){ return 1; }
}

/* ================= profit rank hint (PURE — live-ranking seam) =================
   Turns settled-ledger evidence into a small sort boost for BRAIN tickets, BEST
   cascade, and gold ranker. Unproven buckets contribute 0 — never penalize
   absence. Proven-negative expectancy demotes; proven-positive promotes.
   boost is in rank points on brain's ~0–3050 scale (capped ±25). */
/* ================= WHY THIS IS SHRUNK, NOT JUST THRESHOLDED =================
   HINT_MIN_N used to be 3. Fed a ledger with EXACTLY ZERO true edge (2R target
   at a 33.3% hit rate, so expectancy is 0 by construction), the real
   hgProfitRankHint returned a boost of +/-10 or more 55.5% of the time:
       n     mean|boost|   P(>= +10)   P(<= -10)   max     min
       3        6.05        25.6%       29.9%     +20.0   -10.0
       5        5.23         4.6%       12.9%     +20.0   -10.0
      10        3.76         2.6%        1.8%     +14.0   -10.0
      20        2.54         0.2%        0.0%     +12.5    -8.5
      80        1.29         0.0%        0.0%      +6.5    -4.8
   That is the app promoting noise into its own live ranking, from a ledger the
   ranking then feeds. A hard threshold alone is a cliff — n=9 counts for
   nothing and n=10 counts fully — so the estimate is SHRUNK toward zero in
   proportion to its own unreliability instead.
       weight = n / (n + k),   k = sigma^2 / tau^2
   sigma is measured from the ledger's own settled R spread, not assumed. tau
   is the prior spread of a genuinely real per-trade edge: 0.30R. A bucket with
   n = k contributes half its estimate; n >> k contributes nearly all of it.
   Standard empirical-Bayes shrinkage, and it degrades smoothly. */
var HINT_MIN_N   = 10;
var HINT_BOOST_CAP = 25;
var HINT_EDGE_PRIOR_R = 0.30;   /* tau — what a genuinely good edge looks like */
var HINT_SIGMA_FALLBACK = 1.40; /* SD of a 2R/-1R book; used only when the ledger is too thin to measure */
/* Per-trade R spread, measured from the settled ledger itself. */
function hintSigma(records){
  try{
    var rs = [], i;
    for (i = 0; i < records.length; i++){
      var v = records[i] && records[i].r;
      if (typeof v === 'number' && isFinite(v)) rs.push(v);
    }
    if (rs.length < 8) return HINT_SIGMA_FALLBACK;
    var mu = 0, j;
    for (j = 0; j < rs.length; j++) mu += rs[j];
    mu /= rs.length;
    var ss = 0;
    for (j = 0; j < rs.length; j++) ss += (rs[j] - mu) * (rs[j] - mu);
    var sd = Math.sqrt(ss / rs.length);
    return (isFinite(sd) && sd > 0.05) ? sd : HINT_SIGMA_FALLBACK;
  }catch(e){ return HINT_SIGMA_FALLBACK; }
}
/* Empirical-Bayes weight in [0,1): how much of this bucket's estimate survives. */
function hintShrink(n, sigma){
  var tau = HINT_EDGE_PRIOR_R;
  var k = (sigma * sigma) / (tau * tau);
  if (!(isFinite(k) && k > 0) || !(n > 0)) return 0;
  return n / (n + k);
}

function hgProfitRankHint(input){
  var zero = { boost: 0, enough: false, expectancy: null, parts: [] };
  try{
    var inp = (input && typeof input === 'object') ? input : {};
    var parts = [], sumW = 0, sumE = 0;

    function addBucket(label, bucket){
      if (!bucket || bucket.n < HINT_MIN_N || bucket.avgR === null || !isFinite(bucket.avgR)) return;
      /* Weight by NET expectancy when the cost model is loaded. This boost
         feeds back into ranking, so scoring it gross would tune the app to
         maximise pre-fee edge — which is how a setup family that dies after
         costs keeps getting promoted. Falls back to gross only when the cost
         model is genuinely unavailable. */
      var useR = (bucket.nNet >= HINT_MIN_N && typeof bucket.avgNetR === 'number' && isFinite(bucket.avgNetR))
        ? bucket.avgNetR : bucket.avgR;
      /* shrink toward zero by this bucket's own reliability before it votes */
      var shrink = hintShrink(bucket.n, sigma);
      var shrunkR = useR * shrink;
      var w = Math.min(bucket.n, 20);
      parts.push({ label: label, n: bucket.n, avgR: bucket.avgR, avgNetR: bucket.avgNetR,
                   shrink: Math.round(shrink * 1000) / 1000, usedR: shrunkR, w: w });
      sumW += w;
      sumE += shrunkR * w;
    }

    var st = hgScoreStats(store);
    var sigma = hintSigma(store);
    var sym = String(inp.sym == null ? '' : inp.sym).toUpperCase().trim();
    var dir = (inp.dir === 'short') ? 'short' : ((inp.dir === 'long') ? 'long' : null);
    var tier = String(inp.tier == null ? '' : inp.tier).toUpperCase().trim();
    var lane = laneOf(sym, inp.lane);

    if (sym && dir){
      var sb = { n: 0, sumR: 0 };
      for (var i = 0; i < store.length; i++){
        var rec = store[i];
        if (!rec || rec.status !== 'settled' || typeof rec.r !== 'number' || !isFinite(rec.r)) continue;
        if (rec.sym === sym && rec.dir === dir){ sb.n++; sb.sumR += rec.r; }
      }
      if (sb.n >= HINT_MIN_N) addBucket(sym + ' ' + dir, { n: sb.n, avgR: sb.sumR / sb.n });
    }

    if (tier && st.byTier[tier]) addBucket('tier ' + tier, st.byTier[tier]);
    if (dir && st.byDir[dir]) addBucket('dir ' + dir, st.byDir[dir]);
    if (st.byLane[lane]) addBucket('lane ' + lane, st.byLane[lane]);

    var layers = Array.isArray(inp.layers) ? inp.layers : [];
    var bestLayer = null, bestN = 0;
    for (var li = 0; li < layers.length; li++){
      var ln = String(layers[li] == null ? '' : layers[li]).trim().toUpperCase();
      if (!ln || !st.byLayer[ln]) continue;
      var lb = st.byLayer[ln];
      if (lb.n >= HINT_MIN_N && lb.n > bestN){ bestLayer = ln; bestN = lb.n; }
    }
    if (bestLayer) addBucket('layer ' + bestLayer, st.byLayer[bestLayer]);

    if (!sumW) return zero;

    var expectancy = sumE / sumW;
    var boost = Math.max(-HINT_BOOST_CAP, Math.min(HINT_BOOST_CAP, expectancy * 10));
    return {
      boost: Math.round(boost * 100) / 100,
      enough: true,
      expectancy: Math.round(expectancy * 10000) / 10000,
      parts: parts
    };
  }catch(e){ return zero; }
}

/* ================= record ================= */
function hgScoreRecord(input){
  try{
    var inp = (input && typeof input === 'object') ? input : {};
    var sym = String(inp.sym == null ? '' : inp.sym).toUpperCase().trim();
    if (!sym) return { ok: false, reason: 'sym required' };
    var dir = String(inp.dir == null ? '' : inp.dir).toLowerCase().trim();
    if (dir !== 'long' && dir !== 'short') return { ok: false, reason: 'dir must be long|short (got "' + String(inp.dir) + '")' };
    var entry = fin(inp.entry), stop = fin(inp.stop), t1 = fin(inp.t1), t2raw = fin(inp.t2);
    if (entry === null || stop === null || !(entry > 0)) return { ok: false, reason: 'entry/stop must be finite positive numbers' };
    if (entry === stop) return { ok: false, reason: 'entry equals stop — zero risk, cannot score R' };
    if (dir === 'long'  && !(stop < entry)) return { ok: false, reason: 'long stop must be below entry' };
    if (dir === 'short' && !(stop > entry)) return { ok: false, reason: 'short stop must be above entry' };
    if (t1 === null) return { ok: false, reason: 't1 required (finite number)' };
    if (dir === 'long'  && !(t1 > entry)) return { ok: false, reason: 'long t1 must be above entry' };
    if (dir === 'short' && !(t1 < entry)) return { ok: false, reason: 'short t1 must be below entry' };
    var t2 = null;
    if (t2raw !== null && ((dir === 'long' && t2raw > entry) || (dir === 'short' && t2raw < entry))) t2 = t2raw;
    var scaleRaw = fin(inp.scalePct);
    var scalePct = (scaleRaw !== null && scaleRaw > 0 && scaleRaw <= 100) ? scaleRaw : 50;
    /* wrong-side/non-finite t2 -> dropped to null, never invented */
    var at = fin(inp.at);
    at = (at !== null && at > 0) ? Math.floor(at) : Date.now();
    for (var i = 0; i < store.length; i++){
      var e = store[i];
      if (e && e.sym === sym && e.dir === dir && Math.abs(e.at - at) < DEDUPE_MS){
        return { ok: false, reason: 'duplicate: ' + sym + ' ' + dir + ' already recorded within 24h', dupOf: e.id };
      }
    }
    var fpIn = fin(inp.fundingPct);
    var rec = {
      id: 'sc_' + at.toString(36) + '_' + (idCounter++).toString(36) + '_' + sym,
      source: (typeof inp.source === 'string' && inp.source.trim()) ? inp.source.trim().toLowerCase().slice(0, 24) : 'unknown',
      sym: sym, dir: dir,
      tier: (typeof inp.tier === 'string' && inp.tier.trim()) ? inp.tier.trim().toUpperCase().slice(0, 16) : null,
      lane: laneOf(sym, inp.lane),
      entry: entry, stop: stop, t1: t1, t2: t2, scalePct: scalePct,
      fundingPct: fpIn,
      layers: sanitizeLayers(inp.layers),
      at: at,
      status: 'open',
      outcome: null, r: null, bars: 0, closedAt: null, settledAt: null,
      mtm: null, lastCheck: null, note: null
    };
    store.push(rec);
    enforceCap();
    var saved = saveStore();
    var out = { ok: true, record: rec, persisted: saved.ok };
    if (saved.note) out.note = saved.note;
    return out;
  }catch(e){
    return { ok: false, reason: 'record failed: ' + errMsg(e) };
  }
}

/* ================= settle ================= */
function barsNeeded(at){
  try{
    var ageMs = Date.now() - at;
    var n = Math.ceil(ageMs / 3600000) + 4;
    if (!isFinite(n) || n < 50) n = 50;
    return Math.min(n, MAX_BARS);
  }catch(e){ return 340; }
}
function matchXu(list, sym){
  try{
    if (!Array.isArray(list)) return null;
    var base = baseOfSym(sym);
    var s = String(sym || '').toUpperCase();
    for (var i = 0; i < list.length; i++){
      var it = list[i];
      if (!it || !it.sym) continue;
      if (String(it.sym).toUpperCase() === s) return it;
    }
    for (var j = 0; j < list.length; j++){
      var it2 = list[j];
      if (!it2 || !it2.sym) continue;
      if (it2.alsoOn && String(it2.alsoOn).toUpperCase() === s) return it2;
    }
    for (var k = 0; k < list.length; k++){
      var it3 = list[k];
      if (!it3 || !it3.sym) continue;
      if (it3.base === base || baseOfSym(it3.sym) === base) return it3;
    }
    return null;
  }catch(e){ return null; }
}
function hasCandleRoute(){
  try{
    return (typeof G.xuUniverse === 'function' && typeof G.xuCandles === 'function')
        || (typeof G.getCandles === 'function')
        || (typeof G.getXAUCandles === 'function');
  }catch(e){ return false; }
}
/* default candle route (feature-checked at every step; per-record failures
   reject and are catch-isolated by hgScoreSettle) */
function defaultFetchCandles(rec){
  try{
    var n = barsNeeded(rec.at);
    if (rec.lane === 'gold' && typeof G.getXAUCandles === 'function'){
      return G.getXAUCandles(SETTLE_TF, n);
    }
    if (typeof G.xuUniverse === 'function' && typeof G.xuCandles === 'function'){
      return G.xuUniverse(false).then(function(list){
        var item = matchXu(list, rec.sym);
        if (item) return G.xuCandles(item, SETTLE_TF, n);
        throw new Error('no combined-universe match for ' + rec.sym);
      });
    }
    if (typeof G.getCandles === 'function'){
      return G.getCandles(rec.sym, SETTLE_TF, n);
    }
    if (typeof G.getXAUCandles === 'function'){
      return G.getXAUCandles(SETTLE_TF, n);
    }
    return Promise.reject(new Error('no candle route (xuCandles/getCandles absent)'));
  }catch(e){
    return Promise.reject(e);
  }
}
async function hgScoreSettle(fetchCandles){
  var out = { settled: 0, open: 0, failed: 0, notes: [] };
  try{
    var fn = (typeof fetchCandles === 'function') ? fetchCandles
           : (hasCandleRoute() ? defaultFetchCandles : null);
    if (!fn) out.notes.push('no candle route available — xuniverse/getCandles absent');
    for (var i = 0; i < store.length; i++){
      var rec = store[i];
      if (!rec || rec.status !== 'open') continue;
      try{
        if (!fn){ rec.note = 'no candle route — settlement unavailable'; out.failed++; continue; }
        var rows = await fn(rec);
        if (!Array.isArray(rows) || !rows.length){
          rec.note = 'no candle data returned — still open, unsettled';
          rec.lastCheck = Date.now();
          out.open++;
          continue;
        }
        var w = hgScoreWalk(rec, rows);
        rec.lastCheck = Date.now();
        if (w.state === 'INVALID'){
          rec.note = 'record failed validation at settlement — left open, never scored';
          out.failed++;
          continue;
        }
        rec.bars = w.bars;
        if (w.state === 'PENDING_FILL'){
          rec.mtm = null;
          rec.note = 'limit not reached yet (' + w.bars + ' bars) — not a trade until it fills';
          out.open++;
        }else if (w.state === 'OPEN'){
          rec.mtm = round4(w.r);
          rec.note = null;
          out.open++;
        }else if (w.state === 'UNFILLED'){
          rec.status = 'settled';
          rec.outcome = 'UNFILLED';
          rec.r = null;                 /* null => excluded from every avgR/winRate */
          rec.closedAt = w.closedAt;
          rec.settledAt = Date.now();
          rec.mtm = null;
          rec.note = 'limit never traded — excluded from expectancy';
          out.unfilled = (out.unfilled || 0) + 1;
          out.settled++;
        }else{
          rec.status = 'settled';
          rec.outcome = w.state;
          rec.r = round4(w.r);
          rec.filledAt = (w.filledAt != null) ? w.filledAt : null;
          rec.maeR = (w.maeR != null) ? w.maeR : null;
          rec.mfeR = (w.mfeR != null) ? w.mfeR : null;
          rec.maeFullR = (w.maeFullR != null) ? w.maeFullR : null;
          rec.mfeFullR = (w.mfeFullR != null) ? w.mfeFullR : null;
          rec.rNet = round4(hgScoreNetR(rec, w.state, w.r, w.closedAt));
          rec.bars = w.bars;
          rec.closedAt = w.closedAt;
          rec.settledAt = Date.now();
          rec.mtm = null;
          rec.note = null;
          out.settled++;
        }
      }catch(e){
        try{ rec.note = 'settlement failed for ' + rec.sym + ': ' + errMsg(e); }catch(e2){}
        out.failed++;
      }
    }
    saveStore();
    return out;
  }catch(e){
    out.notes.push('settle loop failed: ' + errMsg(e));
    return out;
  }
}

/* ================= UI (DOM — every render failure leaves an honest note) ================= */
function outcomePip(outcome){
  var o = String(outcome || '');
  if (o === 'T2' || o === 'T1') return '<span class="gpip ok">' + o + '</span>';
  if (o === 'T1S') return '<span class="gpip" style="color:var(--gold);border-color:var(--gold-dim);background:rgba(217,164,65,.08)">T1S</span>';
  if (o === 'SL') return '<span class="gpip" style="color:var(--short);border-color:rgba(228,88,107,.5);background:rgba(228,88,107,.08)">SL</span>';
  if (o === 'EXPIRED') return '<span class="gpip">EXPIRED</span>';
  return '<span class="gpip">' + esc(o || '?') + '</span>';
}
function rCell(r){
  if (typeof r !== 'number' || !isFinite(r)) return '<span>—</span>';
  return '<span class="' + (r > 0 ? 'pos' : (r < 0 ? 'neg' : '')) + '">' + fmtR(r) + '</span>';
}
function boardHtml(st){
  var W2 = (typeof window !== 'undefined') ? window : null;
  var ci = null;
  if (W2 && typeof W2.hgWilson === 'function' && st.counted > 0){
    ci = W2.hgWilson(st.wins, st.counted);
  }
  var ciTxt = (ci && typeof ci.lo === 'number' && typeof ci.hi === 'number')
    ? ' · 95% CI <b>' + (ci.lo * 100).toFixed(1) + '–' + (ci.hi * 100).toFixed(1) + '%</b>'
    : '';
  var honesty = st.settled === 0
    ? '<div class="note warn" style="margin-top:8px">no settled trades yet — the engine has no track record to show. Run BRAIN/EXECUTE scans, let the setups live, then RE-SETTLE.</div>'
    : (!st.enoughData
      ? '<div class="note warn" style="margin-top:8px">not enough data — ' + st.settled + ' settled (need ≥ ' + MIN_DATA + '). Below that, win rate and expectancy are anecdote, not evidence.</div>'
      : (ci ? '<div class="note" style="margin-top:8px;color:var(--gold)">the CI is the verdict, not the point estimate</div>' : ''));
  return '<div class="card"><div class="chead"><span class="k" style="color:var(--mut);font-size:10px;letter-spacing:.14em">SETTLED</span></div>'
    + '<div class="big">' + st.settled + '</div>'
    + '<div class="note">open ' + st.open + ' · wins ' + st.wins + ' · losses ' + st.losses + '</div></div>'
    + '<div class="card"><div class="chead"><span class="k" style="color:var(--mut);font-size:10px;letter-spacing:.14em">WIN RATE</span></div>'
    + '<div class="big">' + pct(st.winRate) + '</div>'
    + '<div class="note">r-scored ' + st.counted + ' of ' + st.settled + ' settled' + ciTxt + '</div></div>'
    + '<div class="card"><div class="chead"><span class="k" style="color:var(--mut);font-size:10px;letter-spacing:.14em">AVG R</span></div>'
    + '<div class="big">' + (st.expectancyNet !== null ? fmtR(st.expectancyNet) : fmtR(st.avgR)) + '</div>'
    + '<div class="note">'
      + (st.expectancyNet !== null
          ? 'NET expectancy per settled trade (after Delta fees + funding) · gross ' + fmtR(st.avgR)
          : 'expectancy ' + fmtR(st.expectancy) + ' per settled trade · <b>GROSS</b> — cost model not loaded')
      + '</div></div>'
    + honesty;
}
function statTableHtml(title, sub, rows, emptyNote){
  var h = '<div class="note" style="margin:10px 0 4px"><b>' + esc(title) + '</b>' + (sub ? ' <span>' + esc(sub) + '</span>' : '') + '</div>';
  if (!rows.length) return h + '<div class="empty" style="padding:12px">' + esc(emptyNote || 'no settled data') + '</div>';
  h += '<table><tr><th></th><th>n</th><th>win%</th><th>avg R</th></tr>';
  for (var i = 0; i < rows.length; i++){
    h += '<tr><td>' + esc(rows[i][0]) + '</td><td>' + rows[i][1] + '</td><td>' + pct(rows[i][2]) + '</td><td>' + fmtR(rows[i][3]) + '</td></tr>';
  }
  return h + '</table>';
}
function breakdownsHtml(st){
  var tierRows = [];
  var tierOrder = ['PRIME', 'HIGH'];
  for (var tk in st.byTier) if (tierOrder.indexOf(tk) < 0) tierOrder.push(tk);
  for (var ti = 0; ti < tierOrder.length; ti++){
    var b = st.byTier[tierOrder[ti]];
    if (b) tierRows.push([tierOrder[ti], b.n, b.winRate, b.avgR]);
  }
  var laneRows = [['CRYPTO'].concat([st.byLane.crypto.n, st.byLane.crypto.winRate, st.byLane.crypto.avgR]),
                  ['GOLD'].concat([st.byLane.gold.n, st.byLane.gold.winRate, st.byLane.gold.avgR])];
  var dirRows = [['LONG'].concat([st.byDir.long.n, st.byDir.long.winRate, st.byDir.long.avgR]),
                 ['SHORT'].concat([st.byDir.short.n, st.byDir.short.winRate, st.byDir.short.avgR])];
  var left = statTableHtml('BY TIER', 'conviction tier at record time', tierRows, 'nothing settled yet');
  var right = statTableHtml('BY LANE', 'crypto vs gold', laneRows, 'nothing settled yet')
            + statTableHtml('BY DIRECTION', '', dirRows, 'nothing settled yet');
  var layerRows = [];
  for (var lk in st.byLayer){
    var lb = st.byLayer[lk];
    layerRows.push([lk, lb.n, lb.winRate, lb.avgR]);
  }
  layerRows.sort(function(a, b){ return (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1); });
  var layer = statTableHtml('BY LAYER — the per-layer edge meter',
    'outcome attribution: every layer that voted for a settled setup carries that result',
    layerRows, 'no settled trades with layer attribution yet');
  return '<div class="grid2"><div>' + left + '</div><div>' + right + '</div></div>' + layer;
}
function layersPips(layers){
  if (!Array.isArray(layers) || !layers.length) return '';
  var h = '<div class="gates" style="margin-top:4px">';
  for (var i = 0; i < layers.length; i++) h += '<span class="gpip">' + esc(layers[i]) + '</span>';
  return h + '</div>';
}
function openHtml(records){
  var opens = [];
  for (var i = 0; i < records.length; i++) if (records[i] && records[i].status === 'open') opens.push(records[i]);
  opens.sort(function(a, b){ return b.at - a.at; });
  var h = '<div class="note" style="margin:10px 0 4px"><b>OPEN</b> <span>live mark-to-market from the last settlement · time in trade from record time</span></div>';
  if (!opens.length) return h + '<div class="empty" style="padding:12px">no open trades right now — nothing the engine is currently answerable for.</div>';
  h += '<table><tr><th>sym</th><th>dir</th><th>tier</th><th>src</th><th>entry</th><th>stop</th><th>t1</th><th>t2</th><th>age</th><th>mtm R</th><th>note</th></tr>';
  var now = Date.now();
  for (var j = 0; j < opens.length; j++){
    var r = opens[j];
    h += '<tr><td><b>' + esc(r.sym) + '</b>' + layersPips(r.layers) + '</td>'
      + '<td class="' + (r.dir === 'long' ? 'pos' : 'neg') + '">' + esc(r.dir.toUpperCase()) + '</td>'
      + '<td>' + esc(r.tier || '—') + '</td>'
      + '<td>' + esc(r.source || '—') + '</td>'
      + '<td>' + fmtPx(r.entry) + '</td><td>' + fmtPx(r.stop) + '</td>'
      + '<td>' + fmtPx(r.t1) + '</td><td>' + fmtPx(r.t2) + '</td>'
      + '<td>' + ageStr(now - r.at) + '</td>'
      + '<td>' + rCell(r.mtm) + '</td>'
      + '<td style="color:var(--mut)">' + esc(r.note || '') + '</td></tr>';
  }
  return h + '</table>';
}
function settledHtml(records){
  var done = [];
  for (var i = 0; i < records.length; i++) if (records[i] && records[i].status === 'settled') done.push(records[i]);
  done.sort(function(a, b){ return (b.settledAt || 0) - (a.settledAt || 0); });
  var h = '<div class="note" style="margin:10px 0 4px"><b>SETTLED</b> <span>last 50 · SL −1R · T1 +2R · T2 +3.5R · T1S partial at scalePct (default 50%, from TRADE PLAN tScale) · EXPIRED marked to market</span></div>';
  if (!records.length){
    return h + '<div class="empty">No setups recorded yet — the BRAIN and EXECUTE tabs log their PRIME/HIGH setups here after each scan. This ledger stays empty until real setups exist; nothing is backfilled or simulated.</div>';
  }
  if (!done.length) return h + '<div class="empty" style="padding:12px">no settled trades yet — ' + records.length + ' open. Let them play out, then RE-SETTLE.</div>';
  if (done.length > 50) done = done.slice(0, 50);
  h += '<table><tr><th>settled</th><th>sym</th><th>dir</th><th>tier</th><th>src</th><th>outcome</th><th>R</th><th>bars</th><th>held</th></tr>';
  for (var j = 0; j < done.length; j++){
    var r = done[j];
    var held = (r.closedAt && isFinite(r.closedAt)) ? ageStr(r.closedAt * 1000 - r.at) : '—';
    h += '<tr><td>' + dstr(r.settledAt) + '</td>'
      + '<td><b>' + esc(r.sym) + '</b></td>'
      + '<td class="' + (r.dir === 'long' ? 'pos' : 'neg') + '">' + esc(r.dir.toUpperCase()) + '</td>'
      + '<td>' + esc(r.tier || '—') + '</td>'
      + '<td>' + esc(r.source || '—') + '</td>'
      + '<td>' + outcomePip(r.outcome) + '</td>'
      + '<td>' + rCell(r.r) + '</td>'
      + '<td>' + (isFinite(r.bars) ? r.bars : '—') + '</td>'
      + '<td>' + held + '</td></tr>';
  }
  return h + '</table>';
}
function render(ui){
  try{
    if (!ui) return;
    var st = hgScoreStats(store);
    if (ui.board) ui.board.innerHTML = boardHtml(st);
    if (ui.breaks){
      var breaks = '';
      if (typeof G.hgValidationPanelHtml === 'function') breaks += G.hgValidationPanelHtml(store);
      breaks += breakdownsHtml(st);
      ui.breaks.innerHTML = breaks;
    }
    if (ui.openWrap) ui.openWrap.innerHTML = openHtml(store);
    if (ui.settledWrap) ui.settledWrap.innerHTML = settledHtml(store);
  }catch(e){
    try{ if (ui && ui.settledWrap) ui.settledWrap.innerHTML = '<div class="empty">scorecard render failed: ' + esc(errMsg(e)) + '</div>'; }catch(e2){}
  }
}

/* ================= settle run + refresh contract ================= */
async function runSettle(ui){
  if (__sc.busy){
    try{ if (ui && ui.stat) ui.stat.textContent = 'settlement already running…'; }catch(e){}
    return 'busy';
  }
  __sc.busy = true;
  try{
    __sc.ranOnce = true;
    var openN = 0;
    for (var i = 0; i < store.length; i++) if (store[i] && store[i].status === 'open') openN++;
    if (!hasCandleRoute()){
      /* no way to fetch a single candle — say so in the status line instead
         of failing every record one by one (never a silent failure) */
      render(ui);
      var m0 = 'no candle route available (xuCandles/getCandles/getXAUCandles absent) — '
        + openN + ' open record' + (openN === 1 ? '' : 's') + ' left unsettled · ' + timeStr();
      try{ if (ui && ui.stat) ui.stat.textContent = m0; }catch(e){}
      return m0;
    }
    if (ui && ui.stat){
      ui.stat.textContent = openN
        ? 'settling ' + openN + ' open record' + (openN === 1 ? '' : 's') + ' against 1h candles…'
        : 'no open records — rendering the stored ledger…';
    }
    var res = await hgScoreSettle(defaultFetchCandles);
    render(ui);
    var msg = 'settled ' + res.settled + ' · still open ' + res.open + ' · failed ' + res.failed + ' · ' + timeStr();
    if (res.notes && res.notes.length) msg += ' (' + res.notes.join('; ') + ')';
    try{ if (ui && ui.stat) ui.stat.textContent = msg; }catch(e){}
    return msg;
  }catch(e){
    var m = 'error: ' + errMsg(e);
    try{ if (ui && ui.stat) ui.stat.textContent = m; }catch(e2){}
    return m;
  }finally{
    __sc.busy = false;
  }
}
/* hard-refresh contract: async, NEVER throws, terse status. 'busy' while a
   settlement runs; 'skipped: not run yet' before the first user settle (a
   global refresh never fires an expensive first-time candle sweep); after
   the first run it re-settles the same way RE-SETTLE NOW does. */
async function refreshScorecard(){
  try{
    if (__sc.busy) return 'busy';
    if (!__sc.ranOnce || !__sc.ui) return 'skipped: not run yet';
    await runSettle(__sc.ui);
    return 'refreshed';
  }catch(e){
    return 'error: ' + errMsg(e);
  }
}

/* ================= export — one click, paste-ready =================
   Plain-text summary the user can paste anywhere (chat, journal, analyst);
   JSON for the full ledger. Both builders are PURE over the loaded store —
   the wire (clipboard/download) lives in the button handlers, and every
   wire failure falls back honestly instead of dying silently. */
function exportLine(k, b){
  return String(k).toUpperCase() + '  n=' + b.n
    + '  win ' + pct(b.winRate)
    + '  avgR ' + fmtR(b.avgR)
    + (typeof b.avgNetR === 'number' && isFinite(b.avgNetR) ? '  net ' + fmtR(b.avgNetR) : '');
}
function buildExportText(){
  try{
    var st = hgScoreStats(store);
    var L = [];
    L.push('HARDGATE SCORECARD — exported ' + dstr(Date.now()) + ' ' + timeStr());
    L.push('ledger: ' + st.settled + ' settled · ' + st.open + ' open'
      + ' · win rate ' + pct(st.winRate)
      + ' · avg R ' + fmtR(st.avgR)
      + ' · expectancy ' + fmtR(st.expectancy) + '/trade GROSS'
      + (st.expectancyNet !== null ? ' · ' + fmtR(st.expectancyNet) + '/trade NET' : ' · net n/a'));
    L.push(st.settled === 0
      ? 'evidence: no settled trades yet'
      : (st.enoughData
          ? 'evidence: ENOUGH DATA (>= ' + MIN_DATA + ' settled)'
          : 'evidence: ANECDOTE — ' + st.settled + ' settled, need >= ' + MIN_DATA));
    function section(title, obj){
      var keys = [];
      for (var k in obj){ if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] && obj[k].n > 0) keys.push(k); }
      if (!keys.length) return;
      keys.sort(function(a, b){ return (obj[b].n - obj[a].n) || (a < b ? -1 : 1); });
      L.push(''); L.push(title);
      for (var i = 0; i < keys.length; i++) L.push(exportLine(keys[i], obj[keys[i]]));
    }
    section('BY TIER', st.byTier);
    section('BY DIRECTION', st.byDir);
    section('BY LANE', st.byLane);
    section('BY LAYER — which votes make money', st.byLayer);
    var settled = [], open = [];
    for (var i = 0; i < store.length; i++){
      var r = store[i];
      if (!r || typeof r !== 'object') continue;
      if (r.status === 'settled') settled.push(r); else open.push(r);
    }
    settled.sort(function(a, b){ return (b.closedAt || b.settledAt || b.at || 0) - (a.closedAt || a.settledAt || a.at || 0); });
    open.sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
    if (settled.length){
      L.push(''); L.push('SETTLED LEDGER — newest first');
      for (var s = 0; s < settled.length; s++){
        var r2 = settled[s];
        L.push(dstr(r2.closedAt || r2.settledAt || r2.at) + ' · ' + r2.sym + ' ' + r2.dir + (r2.tier ? ' ' + r2.tier : '')
          + ' · entry ' + fmtPx(r2.entry) + ' stop ' + fmtPx(r2.stop) + ' t1 ' + fmtPx(r2.t1) + (r2.t2 ? ' t2 ' + fmtPx(r2.t2) : '')
          + ' · ' + (r2.outcome || 'settled') + ' ' + fmtR(r2.r)
          + (Array.isArray(r2.layers) && r2.layers.length ? ' · layers: ' + r2.layers.join(',') : ''));
      }
    }
    if (open.length){
      L.push(''); L.push('OPEN — unsettled');
      for (var o = 0; o < open.length; o++){
        var r3 = open[o];
        L.push(r3.sym + ' ' + r3.dir + (r3.tier ? ' ' + r3.tier : '')
          + ' · entry ' + fmtPx(r3.entry) + ' stop ' + fmtPx(r3.stop) + ' t1 ' + fmtPx(r3.t1)
          + ' · opened ' + dstr(r3.at)
          + (typeof r3.mtm === 'number' && isFinite(r3.mtm) ? ' · mtm ' + fmtR(r3.mtm) : ''));
      }
    }
    if (!settled.length && !open.length)
      L.push('', 'no records yet — run the BRAIN tab; every PRIME/HIGH setup lands here automatically.');
    return L.join('\n');
  }catch(e){ return 'HARDGATE SCORECARD export failed: ' + errMsg(e); }
}
function buildExportJson(){
  try{
    return JSON.stringify({ app: 'hardgate-scorecard', version: 1,
      exportedAt: Date.now(), stats: hgScoreStats(store), records: store }, null, 2);
  }catch(e){ return '{"app":"hardgate-scorecard","error":"' + errMsg(e).replace(/"/g, "'") + '"}'; }
}
function copyText(t, cb){
  try{
    if (typeof navigator !== 'undefined' && navigator && navigator.clipboard
        && typeof navigator.clipboard.writeText === 'function'){
      try{
        navigator.clipboard.writeText(t).then(function(){ cb(true); }, function(){ cb(false); });
        return;
      }catch(e){}
    }
  }catch(e){}
  try{
    if (typeof document !== 'undefined' && document && document.body
        && typeof document.createElement === 'function'){
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      try{ ta.focus(); ta.select(); }catch(e){}
      var okc = false;
      try{ okc = !!(document.execCommand && document.execCommand('copy')); }catch(e){}
      try{ document.body.removeChild(ta); }catch(e){}
      cb(okc); return;
    }
  }catch(e){}
  cb(false);
}
function downloadText(filename, text, mime){
  try{
    if (typeof Blob === 'undefined' || typeof URL === 'undefined'
        || typeof URL.createObjectURL !== 'function'
        || typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return false;
    var url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    (document.body || document.documentElement).appendChild(a);
    a.click();
    setTimeout(function(){
      try{ a.parentNode && a.parentNode.removeChild(a); }catch(e){}
      try{ URL.revokeObjectURL(url); }catch(e){}
    }, 100);
    return true;
  }catch(e){ return false; }
}
function exportFilename(ext){
  try{
    var d = new Date();
    return 'hardgate-scorecard-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
      + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.' + ext;
  }catch(e){ return 'hardgate-scorecard.' + ext; }
}
function setStat(ui, msg, warn){
  try{
    if (ui && ui.stat){
      ui.stat.textContent = msg;
      ui.stat.className = warn ? 'note warn' : 'note';
    }
  }catch(e){}
}
/* COPY STATS: clipboard first; a blocked clipboard falls back to a .txt
   download; both blocked says so and points at the on-screen tables. */
function onCopyStats(ui){
  var txt = buildExportText();
  copyText(txt, function(ok){
    if (ok){ setStat(ui, 'stats copied — paste them anywhere (chat, journal, your analyst) · ' + timeStr()); return; }
    var dl = downloadText(exportFilename('txt'), txt, 'text/plain');
    setStat(ui, dl
      ? 'clipboard blocked — downloaded the stats as a .txt instead · ' + timeStr()
      : 'clipboard and download both blocked — the ledger tables above can be selected and copied manually · ' + timeStr(), true);
  });
}
function onExportJson(ui){
  var name = exportFilename('json');
  var ok = downloadText(name, buildExportJson(), 'application/json');
  setStat(ui, ok
    ? 'ledger downloaded: ' + name + ' · ' + timeStr()
    : 'download blocked by the browser — use COPY STATS instead · ' + timeStr(), !ok);
}

/* ================= mount ================= */
function mountScorecard(el){
  try{
    if (!el) return;
    el.innerHTML =
      '<div class="panel">'
      + '<h2>Scorecard — the engine\'s real record <span>gates, not scores · every recorded setup settled against 1h candles · SL −1R · T1 +2R · T2 +3.5R · T1-then-stop +1R · 14-day expiry marked to market</span></h2>'
      + '<div class="note">Evidence, not signals. The BRAIN and EXECUTE tabs log their setups here; this tab walks each one forward on 1h candles and settles it to an honest R-multiple. The BY-LAYER table is the point — which voting layers actually make money, measured. Numbers below 5 settled trades are anecdote, not evidence.</div>'
      + '<div class="note warn" id="scoreWarn" style="display:none;margin-top:6px"></div>'
      + '<div class="note" id="scoreStat" style="margin-top:6px">idle — ledger loaded from this browser; press RE-SETTLE to check open trades against fresh 1h candles.</div>'
      + '<div class="row" style="margin-top:8px"><button class="btn" id="scoreRun">RE-SETTLE NOW</button>'
      + '<button class="btn" id="scoreCopy" title="copy a plain-text stats summary — paste it anywhere">COPY STATS</button>'
      + '<button class="btn" id="scoreExport" title="download the full ledger + stats as JSON">EXPORT JSON</button></div>'
      + '<div class="grid3" style="margin-top:12px" id="scoreBoard"></div>'
      + '<hr class="sep">'
      + '<div id="scoreBreaks"></div>'
      + '<hr class="sep">'
      + '<div id="scoreOpenWrap"></div>'
      + '<div id="scoreSettledWrap"></div>'
      + '</div>';
    var ui = {
      el: el,
      stat: el.querySelector('#scoreStat'),
      warn: el.querySelector('#scoreWarn'),
      btn: el.querySelector('#scoreRun'),
      copyBtn: el.querySelector('#scoreCopy'),
      exportBtn: el.querySelector('#scoreExport'),
      board: el.querySelector('#scoreBoard'),
      breaks: el.querySelector('#scoreBreaks'),
      openWrap: el.querySelector('#scoreOpenWrap'),
      settledWrap: el.querySelector('#scoreSettledWrap')
    };
    __sc.ui = ui;
    var warns = [];
    if (storageNote) warns.push(storageNote);
    if (persistNote) warns.push(persistNote);
    if (!hasCandleRoute()) warns.push('no candle route available (xuCandles/getCandles/getXAUCandles all absent) — the ledger renders, but settlement cannot run');
    if (ui.warn && warns.length){
      ui.warn.textContent = warns.join(' · ');
      ui.warn.style.display = 'block';
    }
    if (ui.btn) ui.btn.addEventListener('click', function(){ return runSettle(ui); });
    if (ui.copyBtn) ui.copyBtn.addEventListener('click', function(){ onCopyStats(ui); });
    if (ui.exportBtn) ui.exportBtn.addEventListener('click', function(){ onExportJson(ui); });
    render(ui);
  }catch(e){
    try{ el.innerHTML = '<div class="empty">scorecard mount failed: ' + esc(errMsg(e)) + '</div>'; }catch(e2){}
  }
}

/* ================= load + exports + registration ================= */
try{ loadStore(); }catch(e){ store = []; storageNote = 'ledger load failed: ' + errMsg(e); }
idCounter = store.length;

try{
  G.hgScoreRecord = hgScoreRecord;
  G.hgScoreSettle = hgScoreSettle;
  G.hgScoreWalk = hgScoreWalk;
  G.hgScoreStats = hgScoreStats;
  G.hgScoreNetR = hgScoreNetR;
  G.hgScoreBoardHtml = boardHtml;
  G.hgProfitRankHint = hgProfitRankHint;
  G.hgStopSweep = hgStopSweep;
  G.hgLiveStopScale = hgLiveStopScale;
  G.hgHeatProfile = hgHeatProfile;
  G.hgScoreExcursions = hgScoreExcursions;
  G.hgHintShrink = hintShrink;
  G.hgHintSigma = hintSigma;
  G.hgScoreExport = function(){ return { text: buildExportText(), json: buildExportJson() }; };
  G.hgScoreRecords = function(){ try{ return store.slice(); }catch(e){ return []; } };
  G.HG_tabs = G.HG_tabs || [];
  G.HG_tabs.push({ id: 'scorecard', label: 'SCORECARD', mount: mountScorecard, refresh: refreshScorecard });
}catch(e){}

})();
