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
     Standard scalp execution in Asia is rejected unless the tape violently
     sweeps the Asian High/Low (sweep strat). London 08:00 GMT and NY overlap
     12:00–16:00 GMT are priority-weighted on the tally.
  2) COUNTER-TREND — longs below a FALLING 200-EMA-15m with a bearish 4H
     EMA50/200 stack (mirrored for shorts) are demoted; a confirmed
     liquidity-sweep trigger (MSS + displacement + IFVG) is the only
     sanctioned counter-trend play (exempt).
  3) MIN R:R — after TP1 snaps to the nearest opposing structure, a realized
     TP1 < 1.2R drops the candidate to a 'structure too close — R:R
     insufficient' reason line.
  4) CHOP — Kaufman ER(20) < 0.25 on 15m closes demotes mean-reversion
     retests (VWAP bounce, OB retest, FVG fill); breakout triggers exempt.
  5) NEWS-WINDOW VETO — tier-1 US prints (CPI / NFP / FOMC / GDP) lock new
     convictions 30 min before and 15 min after the release ('NEWS GATE —
     no new entries' reason line). Other high-impact events still fade the
     grade via the ±30-min caution window. Already-live convictions keep
     running untouched.
  6) V2 VOLUME TRIGGERS (goldind.js) — liquidity sweeps require a volume
     climax on the sweep bar; FVG fills require HVN structural support when
     the session volume profile has enough range (>=2.5×ATR). Rejected setups
     name the V2 gate on the .rejected side-channel.
  7) SMC SWEEP CONFIRM — a liquidity sweep alone is not a setup. The 15m
     execution tape must print MSS + displacement (≥1.5×ATR) + IFVG/FVG
     imbalance before the entry gate unlocks.
  8) VOLUME-WEIGHTED OB — displacement-bar volume must exceed the prior
     5-bar average or the block is an OB TRAP.
  9) MACRO CONVICTION LOCK — gold longs are killed when DXY and TNX are
     both bullish (close > EMA50 / RISING). Missing feeds fail-open. This
     kills the signal; it does not mint a booked conviction-lock.js record.
 10) SPREAD LOCK — live bid/ask wider than 250 points / 2.5 pips ($0.25)
     locks the entry gate regardless of setup strength. Missing quotes fail-open.
 11) MTF CONFLUENCE — scalp longs require H4 and Daily both bullish
     (price > EMA20 > EMA50). HTF conflict (Daily bull / H4 bear or the
     reverse) locks the entire scalp desk and leaves Gold Wing open.
     Missing H4 or Daily fail-open.
 12) STOP-WIDTH FLOOR (goldind hgGoldScalpStopFloor) — engine plan overrides
     can no longer ship a stop tighter than the 1.5×ATR(15m) contract: a
     valid-side tight stop is re-anchored to the floor (rr re-priced), and a
     floored TP1 < 1.2R drops the candidate with a named reason. The GOLD
     SCALP replay (scripts/backtest-goldscalp.mjs) measured the sub-floor
     cohort at −1.17R/trade net of XM costs, stops down to 0.03×ATR.
 13) COST-HEAVY (goldind hgGoldScalpCostGate) — a stop distance under 8× the
     venue round-trip cost (XM XAUUSD 0.020% RT ⇒ 0.16% of entry; fees
     ≥0.125R) demotes the card: it paints but can never lead. Replay measured
     that cohort gross-positive but net-negative — real setups, unpayable
     geometry.

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

var KL_15M = 240, KL_1H = 200, KL_4H = 220, KL_1D = 260;

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
/** Same CONFIRMED COMBINED SETUP card as GOLD SWING / OMNIGOLD. */
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
    return htmlFn(compose(cands || [], { rows: rows, horizon: horizon || 'SCALP', tape: tape }));
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
    ? '<span class="gpip ok"' + gsxPipAttr(true) + '>WITH GOLD TAPE</span>'
    : '<span class="gpip"' + gsxPipAttr(false) + '>AGAINST GOLD TAPE · HELD</span>';
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

/* Exported so OMNIGOLD can say how far its feed sits from real spot. It was
   a private helper here while the gold desk two tabs over was quoting levels
   from a Binance perp and calling them gold. One definition, both users. */
if (typeof window !== 'undefined') window.hgGoldLiveSpot = goldLiveSpotRef;

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
var __lastDeskTape = '';
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
        /* the mark this candidate was sized against — lost downstream if it
           does not travel, same reason .smc does */
        mark: isFinite(c.mark) ? c.mark : null,
        zone: (c.zone && isFinite(c.zone.lo) && isFinite(c.zone.hi)) ? { lo: c.zone.lo, hi: c.zone.hi } : null,
        demoted: !!c.demoted,
        stamps: Array.isArray(c.stamps) ? c.stamps.slice() : [],
        vetoed: !!c.vetoed, merged: !!c.merged,
        locked: !!c.locked, issuedAt: isFinite(c.issuedAt) ? c.issuedAt : null,
        asOf: c.asOf || null, why: c.why || null, invalidates: c.invalidates || null,
        /* v731: carry the SMC read across the publish boundary. Consumers that
           re-rank these cands (super-gold.js absorbSnap -> goldRankSetups) have
           no candles of their own, so without this the grade is neither
           inheritable nor recomputable, and their solidity scores silently
           differ from this desk's. Counts only — .smc holds no bars. */
        smc: (c.smc && typeof c.smc === 'object') ? c.smc : null
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
      /* hg-v899: the TIMEFRAME IS 15m, because that is what the setup is made
         of. goldScalpSetups reads inp.rows15m, takes its entry from the last
         15m close and sizes every stop off ATR14 on 15m (goldind.js: `var rows
         = __rows(inp.rows15m) ... var a15 = __last(_atr(rows, 14))`). Recording
         it as 1h was a label that contradicted the maths behind it, and since
         hg-v898 the label is also what decides which candles settle the record.

         THE WALL-CLOCK WINDOW IS UNCHANGED: 24 bars of 1h was a day, and 96
         bars of 15m is the same day. Measured over 800 tapes with the desk's
         own 1.5xATR15 stop, settling that same 24-hour window on 15m bars
         rather than 1h bars gave an identical verdict every single time, so
         this corrects the label without moving the evidence. (For the record,
         on those tapes 75% of scalps resolved within six hours and 99% within
         the day -- whether a day is the right horizon for a 15m scalp is a
         calibration question, not this change.) */
      if (typeof W.hgFwdRecordScan === 'function' && cands.length){
        W.hgFwdRecordScan('GOLDSCALP', '15m', cands.filter(function(c){
          return c && c.dir && isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1);
        }).map(function(c){
          /* hg-v955: carry the hg-v953 mint mark onto the ledger row. This
             map REBUILDS the record, so the field the mint sets was dropped
             here -- the third place the same defect was found in one pass. */
          return { sym: 'XAUUSD', dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
                   goldShut: c.goldShut,
                   mechanic: String(c.stratKey || c.strategy || 'UNKNOWN').toUpperCase().slice(0, 28),
                   ticket: (c.grade === 'A' || c.grade === 'clean' || !!c.locked) };
        }), { horizonBars: 96 });   /* 96 x 15m = the same 24 hours as 24 x 1h */
      }
    } catch (eFwd) { try { if (typeof window.hgFwdWarn === "function") window.hgFwdWarn("goldscalp", eFwd); } catch (eW) {} }
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
    __scanSnap = { cands: cands, bestId: best ? (best.id || null) : null, history: hist, rejected: rej, tape: __lastDeskTape || '',
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
+ '.gsx-coverage{font-size:11px;color:#475569;border:1px dashed rgba(71,85,105,.35);border-radius:6px;padding:9px 11px;margin:8px 0 12px;line-height:1.55;background:rgba(71,85,105,.04)}'
+ '.gsx-fsep{font-size:11px;color:#475569;border:1px dashed rgba(71,85,105,.35);border-radius:6px;padding:9px 11px;margin:8px 0 12px;line-height:1.55;background:rgba(71,85,105,.04)}'
+ '.gsx-fsep-tbl{margin:7px 0 0;display:grid;grid-template-columns:auto auto auto auto auto auto auto;gap:2px 10px;font-variant-numeric:tabular-nums}'
+ '.gsx-fsep-row{display:contents}'
+ '.gsx-fsep-row>span{padding:1px 0}'
+ '.gsx-fsep-f{font-weight:600}'
+ '.gsx-fsep-n,.gsx-fsep-v{text-align:right}'
+ '.gsx-fsep-q{text-align:right;opacity:.7}'
+ '.gsx-fsep-verdict{text-align:right;font-weight:600}'
+ '.gsx-fsep-better>span{color:#166534}'
+ '.gsx-fsep-worse>span{color:#9a3412}'
+ '.gsx-fsep-foot{margin-top:7px;opacity:.9}'
+ '.gsx-walkage{font-size:11px;color:#7c2d12;border:1px dashed rgba(180,83,9,.4);border-radius:6px;padding:9px 11px;margin:8px 0 12px;line-height:1.55;background:rgba(180,83,9,.05)}'
+ '.gsx-retune{font-size:11px;color:#7c2d12;border:1px solid rgba(180,83,9,.5);border-left:3px solid #b45309;border-radius:6px;padding:9px 11px;margin:8px 0 12px;line-height:1.55;background:rgba(180,83,9,.07)}'
+ '.gsx-retune-tbl{margin:6px 0 0;font-variant-numeric:tabular-nums}'
+ '.gsx-rrsf{font-size:11px;color:#334155;border:1px dashed rgba(51,65,85,.35);border-radius:6px;padding:8px 10px;margin:7px 0 2px;line-height:1.5;background:rgba(51,65,85,.03)}'
+ '.gsx-rrsf-head{font-weight:600;letter-spacing:.02em}'
+ '.gsx-rrsf-spread{margin:3px 0 5px;font-variant-numeric:tabular-nums}'
+ '.gsx-rrsf-tbl{display:grid;grid-template-columns:auto auto auto;gap:1px 10px;font-variant-numeric:tabular-nums;justify-content:start}'
+ '.gsx-rrsf-row{display:contents}'
+ '.gsx-rrsf-n,.gsx-rrsf-p{text-align:right}'
+ '.gsx-rrsf-p{opacity:.7}'
+ '.gsx-rrsf-other{margin-top:5px;opacity:.9}'
+ '.gsx-rrsf-foot{margin-top:6px;opacity:.9}'
+ '.gsx-oneat{font-size:11px;color:#134E4A;border:1px solid #0F766E;border-left:3px solid #0F766E;border-radius:6px;padding:9px 11px;margin:10px 0 12px;line-height:1.55;background:rgba(15,118,110,.07)}'
+ '.gsx-oneat-head{font-weight:800;letter-spacing:.04em;margin-bottom:4px}'
+ '.gsx-oneat-why{margin-top:5px}'
+ '.gsx-oneat-limit{margin-top:5px;opacity:.88}'
+ '.gsx-heldone{margin-top:6px;color:#0F766E!important;border-top:1px dashed rgba(15,118,110,.45);padding-top:6px}'
+ '.gsx-be{font-size:11px;border-radius:6px;padding:9px 11px;margin:10px 0 12px;line-height:1.55;border:1px solid;border-left-width:3px}'
+ '.gsx-be-ok{color:#14532D;border-color:#15803D;background:rgba(21,128,61,.07)}'
+ '.gsx-be-warn{color:#7C2D12;border-color:#B45309;background:rgba(180,83,9,.07)}'
+ '.gsx-be-bad{color:#7F1D1D;border-color:#B91C1C;background:rgba(185,28,28,.07)}'
+ '.gsx-be-head{font-weight:800;letter-spacing:.03em;margin-bottom:4px}'
+ '.gsx-be-line{margin-top:4px}'
+ '.gsx-be-foot{margin-top:6px;opacity:.9}'
+ '.card.gsx-card .gsx-heldone{color:#5EEAD4!important}'
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

/* WHICH TIMEFRAMES WERE ACTUALLY READ.

   fetchGoldKlines walks a cascade of providers per timeframe and every leg is
   wrapped in its own bare catch, so a 4H fetch that fails leaves rows4h empty
   and says nothing. gold.src already records the source of each leg that
   SUCCEEDED, so the absence is knowable — it was simply never reported.

   It is worth reporting, because the 4H leg changes the board. Measured over
   600 synthetic scans, dropping it:

     - moved 46 of 485 setup identities (about 9.5%): 22 appeared only without
       the leg, 24 only with it;
     - took COUNTER-TREND demotions from 16 to 44, because that gate reads
       `D.stack4 !== 'bull'` and an absent 4H stack counts as not-disagreeing,
       so it demotes. That is deliberate and fail-closed, and it means a silent
       4H failure quietly triples the demotions without ever saying why.

   The count of live setups barely moves (485 vs 483) and the direction is not
   one-way, so this is NOT a claim that a missing leg inflates the board. It is
   a claim that the reader cannot tell what the board was scored on. */
function gsFeedLegs(gold){
  var want = ['15m', '1h', '4h'];
  var out = { read: [], missing: [], ok: true };
  var src = (gold && gold.src) || {};
  var rowsOf = { '15m': 'rows15m', '1h': 'rows1h', '4h': 'rows4h' };
  for (var i = 0; i < want.length; i++){
    var tf = want[i];
    var rows = gold && gold[rowsOf[tf]];
    if (rows && rows.length){ out.read.push(tf); }
    else { out.missing.push(tf); out.ok = false; }
  }
  out.src = src;
  return out;
}

function gsFeedLegNote(gold){
  /* No feed object at all is not an unread leg — it means the scan never ran,
     and the desk says that in its own status line. Warning here would put a
     feed caveat on a board that has no feeds to caveat. */
  if (!gold) return '';
  var legs = gsFeedLegs(gold);
  if (legs.ok) return '';
  /* 15m is the execution timeframe — without it there is no scan at all, and
     the desk already says so elsewhere. This line is about the HTF legs. */
  var htfMissing = legs.missing.filter(function(tf){ return tf !== '15m'; });
  if (!htfMissing.length) return '';
  var was = htfMissing.join(' and ');
  var plural = htfMissing.length > 1;
  return '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #F59E0B;border-radius:6px">'
    + '<b>HTF LEG' + (plural ? 'S' : '') + ' UNREAD</b> — the ' + esc(was) + ' feed'
    + (plural ? 's did' : ' did') + ' not come back, so every setup below was '
    + 'scored on ' + esc(legs.read.join(' + ')) + ' alone. '
    + (htfMissing.indexOf('4h') >= 0
        ? 'The 4H stack is what the counter-trend gate checks, and an absent stack counts as '
          + 'not-disagreeing — so it demotes more, not less. '
        : '')
    + 'Measured over 600 scans, dropping the 4H leg moved about one setup in ten and took '
    + 'COUNTER-TREND demotions from 16 to 44. Nothing here is wrong; you simply cannot read it '
    + 'as a full-stack scan.</div>';
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
    /* hg-v911: the sentence above says why this card leads. This says what
       the desk's own replay measured about leading being worth anything —
       MOST PROBABLE ran -0.231R against -0.154R for the rest over 2,445
       settled scalp trades, at t=-0.74, which clears 95% in NEITHER
       direction. The banner still leads the board; it no longer reads as a
       measured claim. */
    + (typeof W.hgGoldRankEvidenceNote === 'function' ? W.hgGoldRankEvidenceNote('scalp', 'mp') : '')
    + tallyChips(best)
    + '<div class="gsx-whyline">' + esc(best.why || '') + '</div>'
    + '<div class="gsx-inv"><b>INVALIDATION</b> — ' + esc(best.invalidates || 'a 15m close beyond the stop') + '. Hard stop $' + pxF(best.stop) + ' — never widen it.</div>'
    + lock
    + '</div></div>';
}

/* PRICE MAY HAVE WALKED THROUGH THIS PLAN ALREADY — see gswGeoLine in
   goldswing.js. hgPlanMarketGeometry (hg-plan.js) is the shared rule; this
   renders its verdict, and stays silent when the mark or the rule is
   unreachable rather than claiming the plan is fine. */
function gsxGeoLine(c){
  try{
    var fn = (typeof W !== 'undefined' && W && W.hgPlanGeometryLineHtml)
      || (typeof window !== 'undefined' && window && window.hgPlanGeometryLineHtml) || null;
    if (typeof fn !== 'function' || !c) return '';
    return fn({ dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1 },
              c.mark, { cls: 'gsx-geoline note warn', style: 'margin-top:4px' }) || '';
  }catch(e){ return ''; }
}

function cardHTML(c, isBest, season, tape){
  tape = tape || (c && c.goldTape) || '';
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
  var tradeOnclick = (c.sym && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(c.sym, c.dir, c.entry, c.stop, c.t1, { t2: c.t2, stack: c.stack, scanner: 'goldscalp', strategy: 'goldscalp' })
      : ('toTrade(' + JSON.stringify(c.sym) + ',' + JSON.stringify(c.dir) + ',' + c.entry + ',' + c.stop + ',' + c.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  /* hg-v930: a hold that leaves the buttons live is a suggestion, not a hold.
     hg-v611 learned this the expensive way — a demote stamp with ADD TO BOOK
     still on the card was four stop-outs. Both CTAs go, and the space says
     why rather than going blank. */
  var heldOne = !!c.heldOneAtATime;
  var heldOneLine = heldOne
    ? '<div class="note gsx-heldone"><b>HELD &mdash; ONE POSITION AT A TIME</b> &middot; a gold '
      + 'conviction is already live, so this setup cannot be booked or sent to TRADE PLAN. '
      + 'Its levels and reasoning stand; it is released when the book is flat.</div>' : '';
  var tradeBtn = (tradeOnclick && !heldOne)
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function' && c.sym && !heldOne)
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
  var smcChip = '';
  try{ if (typeof W.hgSmcChipHtml === 'function') smcChip = W.hgSmcChipHtml(c) || ''; }catch(eSmcC){ smcChip = ''; }
  return '<div class="card gsx-card ' + c.dir + (isBest ? ' best' : '') + '"' + gsxSt(GSX_CARD) + '>'
    + '<div class="chead"><span class="sym"' + gsxSt(GSX_SYM) + '>' + esc(c.venue) + '</span>'
    + '<span class="dir">' + dirUp + ' · <span class="gsx-grade ' + esc(c.grade) + '">GRADE ' + esc(c.grade) + '</span></span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(c.sym, c.dir, { scanner: 'goldscalp', strategy: 'goldscalp', klass: 'metals', fund: 'gold' }) : '')
    + smcChip
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
    + goldTapeChipHtml(c, tape)
    + chips + metaChips
    + '</div>'
    + tallyChips(c)
    + '<div class="plan"' + gsxSt(GSX_PLAN) + '>' + (c.dir === 'long' ? 'BUY' : 'SELL') + ' <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.zone ? c.zone.lo : c.entry) + '–$' + pxF(c.zone ? c.zone.hi : c.entry) + '</b>'
    + ' · ENTRY <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.entry) + '</b>'
    + ' · STOP <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.stop) + '</b>'
    + ' · TP1 <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.t1) + '</b> (' + fmtF(c.rr, 1) + 'R)'
    + ' · TP2 <b' + gsxSt(GSX_PLAN_B) + '>$' + pxF(c.t2) + '</b> (' + fmtF(c.rr2, 1) + 'R)'
    + '</div>'
    + gsxGeoLine(c)
    + ((typeof hgStrategyTradeDetailHtml === 'function') ? hgStrategyTradeDetailHtml(c) : '')
    + mgmtBlock + guideBlock
    + (c.why ? '<div class="gsx-whyline"' + gsxSt(GSX_WHY) + '>' + esc(c.why) + '</div>' : '')
    + visionLine
    + (c.invalidates ? '<div class="gsx-invline"><b>INVALIDATES:</b> ' + esc(c.invalidates) + '</div>' : '')
    + gateLine
    + rrNoteLine
    + heldOneLine
    + uncheckedLine
    + xautBasisLine
    + lockLine
    + newsBanner + notes + seasonLine
    + stackHtml
    + tradeBtn
    + bookBtn
    + '</div>';
}

/* WHICH GATE IS ACTUALLY BINDING.

   Every held-back setup already names its reason, and the list below prints
   every one of them — nothing is hidden and that stays true. But a reason
   names an INSTANCE ("opposing structure caps TP1 at 2403.87"), and a reader
   staring at an empty GOLD SCALP wants the GATE. Measured over 600 synthetic
   scans: 1,518 rejections, and collapsing the prices out of them leaves just
   NINE distinct gates — of which two account for 90% (structure-too-close
   58.6%, sweep-without-volume-climax 31.6%). A flat list made the reader
   count that for themselves across a thousand rows.

   This counts; it does not gate. No setup is held back or released by
   anything here, and the per-instance list is rendered underneath unchanged. */
function gsGateFamily(reason){
  return String(reason == null ? '' : reason)
    .replace(/[\u2212-]?\d+(?:[.,]\d+)?/g, '#')   /* prices, counts, ratios -> # */
    .replace(/\s+/g, ' ')
    .trim();
}

function gsRejectFunnel(rejected){
  var out = [], byGate = {}, order = [], i, r, k, total = 0;
  if (!rejected || !rejected.length) return out;
  for (i = 0; i < rejected.length; i++){
    r = rejected[i];
    if (!r) continue;
    k = gsGateFamily(r.reason || 'failed a quality gate');
    if (!k) continue;
    total++;
    if (!byGate[k]){ byGate[k] = { gate: k, n: 0, example: r.reason || '', kinds: {} }; order.push(k); }
    byGate[k].n++;
    var kind = r.strategy || r.stratKey || null;
    if (kind) byGate[k].kinds[kind] = (byGate[k].kinds[kind] || 0) + 1;
  }
  for (i = 0; i < order.length; i++){
    var g = byGate[order[i]];
    g.pct = total ? (100 * g.n / total) : 0;
    g.total = total;
    /* the setup kinds this gate stopped, commonest first */
    var names = Object.keys(g.kinds);
    names.sort(function(a, b){ return g.kinds[b] - g.kinds[a]; });
    g.kindList = names;
    out.push(g);
  }
  out.sort(function(a, b){
    if (b.n !== a.n) return b.n - a.n;
    return String(a.gate).localeCompare(String(b.gate));
  });
  return out;
}

/* hg-v903: what never reached a gate at all.

   __gsCand ends a strategy attempt before any named gate when the evidence is
   too thin (fewer than two agreeing reads) or when the desk's own ledger
   OUTVOTES it (opposing reads >= agreeing ones). Measured over 600 scans:
   2,667 attempts, 937 ended here — 378 thin, 559 outvoted.

   The thin ones are honestly silent: no setup formed, and naming every
   strategy that did not trigger would bury the ones that did. The outvoted
   ones are a different thing entirely — the desk had a directional read and
   its own book went against it — and the funnel's "N held back across M
   gates" gave no hint that a larger set never got that far. */
function gsPreGateLine(preGate){
  if (!preGate) return '';
  var out = Math.max(0, +preGate.outvoted || 0);
  var thin = Math.max(0, +preGate.thin || 0);
  if (!out && !thin) return '';
  var attempts = Math.max(0, +preGate.attempts || 0);
  var bits = [];
  if (out) bits.push(out + ' outvoted by the desk\'s own evidence book (opposing reads matched or beat the agreeing ones)');
  if (thin) bits.push(thin + ' with fewer than two agreeing reads, so no setup formed');
  /* TWO POPULATIONS, NOT TWO PARTS OF ONE.

     hg-v903 printed this as "and N strategy attempts never reached a gate",
     directly under "N setups held back across M gates". The `and` reads as a
     sum, and it is not one: __gsTally counts entries into __gsCand, the
     strategy-candidate builder, while the ranked gates above also hold back
     setups minted by the ENGINE DETECTORS — liqsweep, sweepob, p6fail,
     p8range and the rest — which never pass through that counter at all.
     Measured over 400 scans: 1,962 builder attempts, but candidates plus
     ranked rejections plus this tally came to 2,306, overshooting on 317 of
     the 400 because the gate count spans mint paths the attempt count does
     not. So the line names its own denominator and says what it excludes. */
  return '<div class="gsx-hrow" style="color:#64748B">'
    + 'separately, of ' + (attempts ? attempts + ' ' : '')
    + 'strategy-builder attempt' + (attempts === 1 ? '' : 's') + ', '
    + (out + thin) + ' never reached a gate — ' + esc(bits.join('; '))
    + '. The gates above also cover setups from the engine detectors, which do not pass '
    + 'through this counter, so these two are separate tallies rather than parts of one.'
    + '</div>';
}

/* IS THIS TAPE EVEN A TAPE?

   goldScalpSetups checks that it has at least 30 bars, that ATR came out
   positive and that the entry is a positive number. It never checks that the
   BARS are well formed, and a feed can deliver ones that are not: a high
   below its own low, a range that does not contain the body, a non-finite
   price, a timestamp that goes backwards or repeats.

   Those are not edge cases in the maths — they are impossible candles, and
   every level the desk draws from them is drawn from something that never
   happened. MEASURED: feed a tape where one bar in twenty arrives with its
   high and low swapped, which is what a proxy glitch or a bad merge looks
   like, and over 300 scans the STOP moved on 36.7% of them while the ENTRY
   moved on only 4.7%. That is the worse half to lose: the stop is the risk
   distance every size, every R and every target on the ladder is measured
   against. The desk never said a word about it.

   This reports; it does not gate. A malformed bar is disclosed, not dropped:
   deciding which bars to discard is a data-repair policy, and inventing one
   here would be the kind of silent correction this desk exists to avoid.
   Bounded at BAD_CAP so a wholly broken feed cannot cost a scan its time. */
function gsTapeSanity(rows){
  /* The rule moved to gold-tape-sanity.js in pack 907, because seven other
     gold tabs needed it and two copies of a rule are two things to drift.
     Absent shared file, this reports nothing rather than guessing — a desk
     that cannot check its tape must not claim the tape is clean. */
  if (typeof W.hgGoldTapeSanity === 'function') return W.hgGoldTapeSanity(rows);
  return { bars: 0, bad: 0, inverted: 0, bodyOutside: 0, nonFinite: 0, timeOrder: 0, ok: true };
}

/* Pack 908 gave the tape a SECOND question — is it continuous? — so the desk
   now asks both in one call and takes ROWS rather than an already-built
   report. The old shape took a report, which could only answer the first
   question; an interim draft of 908 kept that signature and reached for a
   rows field on the report that does not exist. */
function gsTapeNotes(rows){
  if (typeof W.hgGoldTapeNotes === 'function') return W.hgGoldTapeNotes(rows, '15m');
  if (typeof W.hgGoldTapeSanityNote === 'function' && typeof W.hgGoldTapeSanity === 'function')
    return W.hgGoldTapeSanityNote(W.hgGoldTapeSanity(rows), '15m');
  return '';
}

/* THE MARK EVERY CARD ON THIS BOARD IS JUDGED AGAINST.

   Live goldspot when the feed is up, else the last CLOSED 15m close — the bar
   the scalp gates already judged. Named once because it now has two callers:
   the venue loop, which stamps freshly built candidates, and the merge below,
   which brings LOCKED convictions back from the lock store. Two copies of this
   rule would be two things to drift. */
function gsDeskMark(ctx, gold){
  try{
    var sp = ctx && ctx.spot && +ctx.spot.spotPx;
    if (isFinite(sp) && sp > 0) return sp;
    if (gold && gold.rows15m && gold.rows15m.length){
      var lc = gold.rows15m[gold.rows15m.length - 1];
      if (lc && isFinite(+lc.c)) return +lc.c;
    }
  }catch(e){}
  return NaN;
}

/* A LOCKED CONVICTION IS THE CARD MOST LIKELY TO BE STALE, and it was the one
   card that could not say so.

   convictionCardFromLiveRec rebuilds a card from the stored record with its
   entry, stop, targets, anchor and atr — but no mark, because the record has
   no idea what price is now. mergeLiveConvictionCards then pushes it into the
   display AFTER the venue loop that stamps marks, so it arrived with
   mark === undefined.

   gsxGeoLine hands that to hgPlanGeometryLineHtml, which deliberately "stays
   silent when the mark is unreachable rather than claiming the plan is fine".
   Correct on its own terms, and the result was that TARGET BEHIND PRICE and
   its siblings never appeared on a locked card — on exactly the setups that
   have survived rescans while price walked away from them.

   Verified on the real merge: a stored record for entry 2400 / stop 2394 /
   T1 2412 came back with mark undefined and a geometry line of "". Given a
   mark of 2415 the same plan reads "TARGET BEHIND PRICE: T1 2412 sits between
   the market and the entry — the retest crosses TP1 before the fill".

   This stamps; it does not gate. A card with no finite desk mark is left
   exactly as it was, still silent, because an invented mark would be worse
   than none. */
function gsStampMergedMarks(display, mark){
  if (!Array.isArray(display) || !isFinite(mark) || !(mark > 0)) return 0;
  var n = 0, i, c;
  for (i = 0; i < display.length; i++){
    c = display[i];
    if (!c || isFinite(+c.mark)) continue;
    c.mark = mark;
    n++;
  }
  return n;
}

function gsRejectFunnelHTML(rejected, preGate){
  var rows = gsRejectFunnel(rejected);
  if (!rows.length) return gsPreGateLine(preGate)
    ? '<div class="gsx-hist"><div class="gsx-hhead">WHY NOTHING LED</div>' + gsPreGateLine(preGate) + '</div>'
    : '';
  var total = rows[0].total, i, g, h;
  var lead = rows[0];
  var leadPct = Math.round(lead.pct);
  h = '<div class="gsx-hist"><div class="gsx-hhead">WHY NOTHING LED — '
    + total + ' setup' + (total === 1 ? '' : 's') + ' held back across '
    + rows.length + ' gate' + (rows.length === 1 ? '' : 's')
    + (rows.length > 1 ? ' · binding gate: ' + esc(gsGateShort(lead.gate)) + ' (' + leadPct + '%)' : '')
    + '</div>';
  for (i = 0; i < rows.length; i++){
    g = rows[i];
    var pct = Math.round(g.pct);
    h += '<div class="gsx-hrow rej" style="display:flex;gap:8px;align-items:baseline">'
      + '<b style="min-width:3.2em;text-align:right">' + g.n + '</b>'
      + '<span style="min-width:3em;color:#64748B">' + pct + '%</span>'
      + '<span>' + esc(gsGateShort(g.gate))
      + (g.kindList.length ? ' <span style="color:#64748B">· ' + esc(g.kindList.slice(0, 3).join(', '))
          + (g.kindList.length > 3 ? ' +' + (g.kindList.length - 3) : '') + '</span>' : '')
      + '</span></div>';
  }
  h += gsRrShortfallHTML(rejected);
  h += gsPreGateLine(preGate);
  h += '</div>';
  return h;
}

/* the gate without its trailing detail — the clause before the first em dash,
   which is where these reasons put the gate name */
function gsGateShort(gate){
  var s = String(gate || '');
  var cut = s.indexOf(' — ');
  if (cut > 8) s = s.slice(0, cut);
  return s.length > 90 ? s.slice(0, 89) + '…' : s;
}

/* hg-v929 — HOW FAR UNDER THE FLOOR, not merely which gate.

   gsRejectFunnelHTML names the binding gate and its share. On a quiet tape
   that is almost always "structure too close - R:R insufficient", and a
   reader who gets that far asks the obvious next question: is the floor
   shaving off trades that nearly made it, or are these setups nowhere near?
   The funnel could not say, so the honest-looking answer -- LOWER THE FLOOR
   -- was available with nothing to argue against it.

   MEASURED, 120 consecutive synthetic scans through the real goldScalpSetups
   (scratch harness, not the committed replay, and labelled as such):
   294 of 385 rejections were this gate, and 94.9% of them capped TP1 below
   0.80R against a 1.20R floor. Dropping the floor to 1.00R would have
   returned SIX of 294. To 0.80R, fifteen. The floor is not what empties the
   board; opposing structure is.

   AND THE FIRST ATTEMPT AT THAT MEASUREMENT WAS ITSELF WRONG, which is the
   sharpest argument for the numeric field. Binning the rejects by parsing
   their sentences gave 92.8% below 0.80R and EIGHT returned at a 0.80R
   floor. The sentence prints lv.rr.toFixed(1), so every value was rounded to
   one decimal first: an 0.96R cap reads as "1.0R". On the true floats the
   same 294 rows are 94.9% and FIFTEEN. A prose parse is not merely fragile,
   it is LOSSY, and it published a wrong figure in the session that built
   this panel.

   That is a synthetic tape, so NO NUMBER FROM IT IS BAKED HERE. Every figure
   this panel prints is computed from the scan in front of the reader, at
   render time, from the numeric rr / rrFloor the reject carries.

   TWO THINGS IT MUST NOT OVERSTATE, both rendered:

   1. A setup dropped at this gate RETURNED BEFORE the later gates ran. So
      "lowering the floor to X passes N" is the MOST a lower floor could give
      back, never what it would give back. It is an upper bound and says so.

   2. A lower floor does not only add trades, it adds worse ones: the same
      stop bought for a smaller first target. Counting the trades a threshold
      would return without saying what they would be worth is how a loosening
      argument gets made by arithmetic alone.

   THIS COUNTS; IT DOES NOT GATE. The 1.2R floor is untouched. */
var GS_RR_STEPS = [0.1, 0.2, 0.3, 0.4, 0.6, 0.8];

function gsRrFmt(x){ return (Math.round(x * 100) / 100).toFixed(2); }

function gsRrShortfall(rejected){
  if (!rejected || !rejected.length) return null;
  var byFloor = {}, i, j, r, k;
  for (i = 0; i < rejected.length; i++){
    r = rejected[i];
    if (!r) continue;
    /* NUMERIC fields only. A prose parse would bind this readout to the
       wording of a sentence and go quietly blank when that changed. */
    if (!isFinite(r.rr) || !isFinite(r.rrFloor) || !(r.rrFloor > 0)) continue;
    if (!(+r.rr < +r.rrFloor)) continue;
    k = String(+r.rrFloor);
    if (!byFloor[k]) byFloor[k] = { floor: +r.rrFloor, rr: [] };
    byFloor[k].rr.push(+r.rr);
  }
  var keys = Object.keys(byFloor);
  if (!keys.length) return null;
  /* The largest group leads and ANY OTHER FLOOR IS NAMED, never merged into
     it: two different floors averaged into one distribution is a number that
     describes neither gate. Ties break on the floor so renders are stable. */
  keys.sort(function(a, b){
    var d = byFloor[b].rr.length - byFloor[a].rr.length;
    return d || (byFloor[a].floor - byFloor[b].floor);
  });
  var lead = byFloor[keys[0]];
  var rr = lead.rr.slice().sort(function(a, b){ return a - b; });
  var n = rr.length;
  var steps = [];
  for (i = 0; i < GS_RR_STEPS.length; i++){
    var f = lead.floor - GS_RR_STEPS[i];
    if (!(f > 0)) continue;
    var c = 0;
    for (j = 0; j < n; j++) if (rr[j] >= f) c++;
    steps.push({ floor: f, n: c, pct: n ? (100 * c / n) : 0 });
  }
  var others = [];
  for (i = 1; i < keys.length; i++){
    others.push({ floor: byFloor[keys[i]].floor, n: byFloor[keys[i]].rr.length });
  }
  var mid = (n % 2) ? rr[(n - 1) / 2] : (rr[n / 2 - 1] + rr[n / 2]) / 2;
  return { floor: lead.floor, n: n, steps: steps, others: others,
           worst: rr[0], median: mid, best: rr[n - 1] };
}

function gsRrShortfallHTML(rejected){
  var sf = gsRrShortfall(rejected);
  if (!sf || !sf.n) return '';
  var i, h = '<div class="gsx-rrsf">'
    + '<div class="gsx-rrsf-head">R:R SHORTFALL — how far under the '
    + gsRrFmt(sf.floor) + 'R floor these ' + sf.n + ' sit</div>'
    + '<div class="gsx-rrsf-spread">nearest miss <b>' + gsRrFmt(sf.best)
    + 'R</b> · middle <b>' + gsRrFmt(sf.median) + 'R</b> · furthest <b>'
    + gsRrFmt(sf.worst) + 'R</b></div>';
  h += '<div class="gsx-rrsf-tbl">';
  for (i = 0; i < sf.steps.length; i++){
    var st = sf.steps[i];
    h += '<div class="gsx-rrsf-row"><span>floor ' + gsRrFmt(st.floor) + 'R</span>'
      + '<span class="gsx-rrsf-n">' + st.n + ' of ' + sf.n + '</span>'
      + '<span class="gsx-rrsf-p">' + (Math.round(st.pct * 10) / 10) + '%</span></div>';
  }
  h += '</div>';
  for (i = 0; i < sf.others.length; i++){
    h += '<div class="gsx-rrsf-other">' + sf.others[i].n + ' further row'
      + (sf.others[i].n === 1 ? '' : 's') + ' were held at a different floor ('
      + gsRrFmt(sf.others[i].floor) + 'R) and are counted separately — '
      + 'two floors averaged into one distribution would describe neither.</div>';
  }
  h += '<div class="gsx-rrsf-foot">UPPER BOUND: a setup dropped here returned '
    + 'before the later gates ran, so these are the most a lower floor could '
    + 'give back, not what it would. And a lower floor does not only add '
    + 'trades — it adds the same stop bought for a smaller first target. '
    + 'Counted here, not acted on: the floor is unchanged.</div>';
  return h + '</div>';
}

/* hg-v930 — ONE POSITION AT A TIME, on this desk too.

   hg-v926 measured the only read in the whole gold evidence base that is
   positive at BOTH fill bounds: taken one at a time the SCALP ticket book is
   +0.1484R (n=73, conservative bound) and +0.4155R (n=54, the other), against
   -0.1160R for the all-at-once book (n=8132, XM costs). The walk publishes
   59.4 plans a day on ONE instrument and holds 57 at once, which is not 57
   bets, it is one bet on gold at 57x size.

   THE FIX WENT IN ON OMNIGOLD AND STOPPED THERE. hgOgOneAtATimeGate reads
   BOTH booking stores -- 'hgGoldscalpConviction' and 'hgGoldswingConviction'
   -- so OMNIGOLD held itself back while GOLD SCALP was in a trade, and GOLD
   SCALP went on stacking. The desk whose ticket book supplied the measurement
   was the one still exposed to it, and the asymmetry ran for four packs.

   WHAT HOLDING MEANS HERE. This desk has no gate ledger to push a row
   through, so the hold is expressed in the desk's own vocabulary: a held card
   is DEMOTED, which is already understood everywhere -- it still paints, it
   keeps its levels and its whole tally, and it can never lead. The leader
   pickers (goldPickSpotAlignedBest, the naive scan and the display fallback)
   all skip demoted rows, so MOST PROBABLE empties without a second code path.

   AND THE HANDOFF IS THE ACTUAL ENFORCEMENT. A demote alone does not remove
   ADD TO BOOK or SEND TO TRADE PLAN -- hg-v611 had to add a suppress verdict
   for exactly that reason, after a demote stamp left four stop-outs bookable.
   A hold that leaves the button live is a suggestion, not a hold, so
   cardHTML drops both CTAs on a held card and says why in their place.

   TWO THINGS IT DOES NOT DO.
   The position you are ALREADY IN keeps running: a row carrying c.locked is
   skipped, never demoted, so a live conviction still leads and still shows
   its exits. Holding an open trade off its own card would be the opposite of
   the intent.
   It FAILS OPEN. gsOpenGoldConvictions delegates to OMNIGOLD's reader so one
   definition of "an open gold conviction" serves both desks; when omnigold.js
   is absent or the store cannot be read, that is 0 open and every setup
   stands. Refusing to trade because localStorage threw would be a gate
   nobody chose.

   THE LIMIT, STATED WHEREVER THE CLAIM IS. n=73 at +1.16 sigma is positive
   and NOT SIGNIFICANT -- it clears not even an uncorrected single test, let
   alone the family bar this desk holds a mechanic to. SWING disagrees between
   the bounds (-0.2399 / +0.3166) and carries no verdict at all. What is not
   statistical is the concentration: 57 simultaneous positions on one metal is
   arithmetic, and that is the half this acts on.

   No threshold moved. G1-G7, the 1.2R floor, the stop floors, the cost
   ceilings and every hg-v925 / v928 / v929 switch are untouched. */
var GS_ONE_AT_A_TIME_LS_KEY = 'hg_gs_one_at_a_time';
var GS_ONE_AT_A_TIME_DEFAULT = true;
var GS_ONE_AT_A_TIME = GS_ONE_AT_A_TIME_DEFAULT;
var GS_HELD_STAMP = 'HELD · ONE AT A TIME';

function gsOneAtATimeInit(){
  try{
    var ovr = (typeof W !== 'undefined' && W) ? W.HG_GS_ONE_AT_A_TIME : undefined;
    if (ovr === true || ovr === false){ GS_ONE_AT_A_TIME = ovr; return GS_ONE_AT_A_TIME; }
    var stored = null;
    try { stored = localStorage.getItem(GS_ONE_AT_A_TIME_LS_KEY); } catch (eL) { stored = null; }
    if (stored === '1' || stored === 'true') GS_ONE_AT_A_TIME = true;
    else if (stored === '0' || stored === 'false') GS_ONE_AT_A_TIME = false;
    else GS_ONE_AT_A_TIME = GS_ONE_AT_A_TIME_DEFAULT;
  }catch(e){ GS_ONE_AT_A_TIME = GS_ONE_AT_A_TIME_DEFAULT; }
  return GS_ONE_AT_A_TIME;
}

function gsSetOneAtATime(on){
  GS_ONE_AT_A_TIME = (on === true);
  try { localStorage.setItem(GS_ONE_AT_A_TIME_LS_KEY, GS_ONE_AT_A_TIME ? '1' : '0'); } catch (eS) {}
  return GS_ONE_AT_A_TIME;
}

/* ONE definition of an open gold conviction, borrowed rather than copied:
   a second parser here would drift from OMNIGOLD's the first time either
   store changed shape, and the two desks would disagree about whether you
   are in a trade. reader is carried so the panel can say which answered.
   NEVER THROWS; an absent reader is 0 open, which fails OPEN. */
function gsOpenGoldConvictions(){
  try{
    var f = (typeof W !== 'undefined' && W) ? W.hgOgOpenGoldConvictions : null;
    if (typeof f !== 'function') return { n: 0, keys: [], reader: null };
    var o = f();
    var n = (o && isFinite(+o.n)) ? Math.max(0, +o.n) : 0;
    return { n: n, keys: (o && o.keys) ? o.keys.slice() : [],
             rows: (o && o.rows) ? o.rows.slice() : [],
             reader: 'hgOgOpenGoldConvictions' };
  }catch(e){ return { n: 0, keys: [], reader: null }; }
}

/* PURE apart from the rows it is handed: marks what it holds and reports
   what it did, so the panel and the tests read the same object the scan
   acted on rather than recomputing it. Returns null when nothing is held —
   the guard off, no open conviction, or nothing to hold. */
function gsApplyOneAtATime(ranked, open){
  if (!GS_ONE_AT_A_TIME) return null;
  if (!Array.isArray(ranked) || !ranked.length) return null;
  var o = open || gsOpenGoldConvictions();
  if (!o || !(+o.n > 0)) return null;
  var held = 0, running = 0, i, c;
  for (i = 0; i < ranked.length; i++){
    c = ranked[i];
    if (!c || c.dropped || c.vetoed) continue;
    /* the trade you are IN is not a new entry — it keeps running and can
       still lead, which is the whole point of holding the others */
    if (c.locked){ running++; continue; }
    c.heldOneAtATime = true;
    c.demoted = true;
    if (!Array.isArray(c.stamps)) c.stamps = [];
    if (c.stamps.indexOf(GS_HELD_STAMP) < 0) c.stamps.push(GS_HELD_STAMP);
    held++;
  }
  if (!held) return null;
  return { n: +o.n, keys: o.keys || [], rows: o.rows || [], held: held, running: running,
           reader: o.reader || null };
}

/* Renders only while something is actually held. A standing lecture about
   concentration on a flat book is noise, and noise is what gets scrolled
   past on the day it matters. */
/* hg-v931: the breakeven readout lives in goldind.js so ONE literal serves
   both gold desks — two copies would drift the first time either was re-baked.
   Absent goldind is '' here, never a throw: a missing panel is a missing
   panel, but a throw would take the whole card grid with it. */
function gsBreakevenHtml(){
  try{
    var f = (typeof W !== 'undefined' && W) ? W.hgGoldBreakevenHtml : null;
    return (typeof f === 'function') ? (f('scalp') || '') : '';
  }catch(e){ return ''; }
}

/* hg-v941: name what is holding, with an age on each line. The hold used to
   be a bare count, so a record that COULD NOT EXPIRE \u2014 its venue had left the
   feed chain, and the 6h TTL was unreachable without a bar for that venue \u2014
   held this desk, GOLD SWING and OMNIGOLD while reading exactly like a
   position someone had just taken. Delegates to OMNIGOLD's renderer so one
   definition serves both panels; an absent renderer is '', never a throw. */
function gsHoldingRowsHtml(res){
  try{
    var f = (typeof W !== 'undefined' && W) ? W.hgOgHoldingRowsHtml : null;
    if (typeof f !== 'function') return '';
    return f(res) || '';
  }catch(e){ return ''; }
}

function gsOneAtATimeHtml(res){
  if (!res || !(res.held > 0)) return '';
  var n = res.n, held = res.held;
  return '<div class="gsx-oneat">'
    + '<div class="gsx-oneat-head">ONE POSITION AT A TIME &mdash; ' + n + ' gold conviction'
    + (n === 1 ? ' is' : 's are') + ' live, so ' + held + ' new setup'
    + (held === 1 ? ' is' : 's are') + ' HELD</div>'
    + '<div>Held cards keep their levels, their tally and every reason on them. None is '
    + 'hidden and no threshold moved &mdash; they simply cannot lead, and their '
    + '<b>ADD TO BOOK</b> and <b>SEND TO TRADE PLAN</b> handoffs are off until the book is flat.'
    + (res.running > 0
        ? ' The ' + res.running + ' conviction' + (res.running === 1 ? '' : 's')
          + ' you are already in ' + (res.running === 1 ? 'keeps' : 'keep')
          + ' running and can still lead.'
        : '')
    + '</div>'
    + '<div class="gsx-oneat-why">This walk publishes <b>59.4 plans a day</b> on one instrument '
    + 'and holds <b>57 at once</b> &mdash; not 57 bets, one bet on gold at 57&times; size. Taken '
    + 'one at a time the SCALP ticket book is <b>+0.148R</b> at the conservative fill bound and '
    + '<b>+0.416R</b> at the other, against <b>&minus;0.116R</b> all at once. It is the only read '
    + 'in this desk&rsquo;s evidence positive at <b>both</b> bounds.</div>'
    + '<div class="gsx-oneat-limit">The limit, stated: that is <b>n=73 at +1.16&sigma;</b> &mdash; '
    + 'positive, <b>not significant</b>, clearing not even an uncorrected single test. SWING '
    + 'disagrees between the bounds (&minus;0.240 / +0.317) and carries no verdict. What is not '
    + 'statistical is the concentration, and that is the half this acts on. '
    + '<code>gsSetOneAtATime(false)</code> turns it off.</div>'
    + gsHoldingRowsHtml(res)
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
  if (o.newsVeto) lead = 'NEWS GATE — no new entries 30 min before / 15 min after CPI·NFP·FOMC·GDP' + (o.newsVetoTitle ? ' — ' + o.newsVetoTitle : '')
    + ': new convictions held, issuance resumes after the window';
  else if (o.feedsFailed) lead = 'feeds failed — no 15m klines from any source (macro chain + PAXGUSDT + Delta all quiet)';
  else if (o.asiaSession) lead = 'ASIA SESSION (00:00–07:00 GMT) — only ASIAN RANGE breakout or a violent AH/AL sweep may lead; other strategies are demoted (ASIA SESSION) and cannot lead';
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
/* hg-v920 — AN EMPTY LEADER BOARD IS THE DESIGNED OUTCOME, AND NOTHING SAID SO.

   Reported as a fault: the desk "only shows weak setups". It is not the tape.
   Measured on this desk's own replay, of everything it forms: 21.6% is
   suppressed and never becomes a card, 62.9% is DEMOTED — it paints, and can
   never be MOST PROBABLE — and 15.5% can lead. 94.1% of settled rows carry a
   demote, and the six highest-volume detectors (HVN, opening range, BOS
   align, NY exhaustion, EMA ribbon, Asian breakout) are every one of them
   demote or suppress. MOST PROBABLE fired 111 times in 5,760 scans: once in
   51.

   A reader cannot tell that from silence, so they read "broken". The counts
   are baked, not computed from the current scan — they describe the policy,
   which is what the silence is caused by, not today's board.

   Three attempts to justify unblocking any of it were tested and failed; the
   refusals are recorded in goldind.js above HG_GOLD_SETUP_EDGE. Nothing here
   loosens anything — it states the arithmetic that produces the quiet. */
function goldCoverageNoteHTML(){
  /* TWO DENOMINATORS, KEPT APART. 84.5% is the share of formed VOLUME that
     cannot lead (62.9 demote + 21.6 suppress). 94.1% is the share of SETTLED
     rows carrying a demote — a different population, because suppressed kinds
     settle in a shadow ledger rather than the main book. Adding them together
     was the first draft of this line and it was nonsense. */
  /* hg-v928 MOVED THESE NUMBERS and they are the headline of that pack, so
     both readings are printed rather than the old one silently replaced.
     Recomputed on the same population the guard uses (non-shadow rows of the
     committed replay, n=2,283) under each set of verdicts. */
  var retuned = (typeof HG_GOLD_EDGE_RETUNE !== 'undefined') ? !!HG_GOLD_EDGE_RETUNE : true;
  if (retuned){
    return '<div class="gsx-coverage"><b>WHY SO FEW LEADERS</b> — '
      + '<b>69.3%</b> of what this desk forms can never be MOST PROBABLE: 59.2% is demoted '
      + '(it paints, it cannot lead) and 10.1% is suppressed (it never becomes a card). '
      + '<b>Before the hg-v928 hand-tune that was 84.5%</b> — 62.9% demoted and 21.6% suppressed — '
      + 'so four verdicts moving on instruction freed 15.2 points of formed volume to lead. '
      + 'The six highest-volume detectors are still mostly demote or suppress, each on its own '
      + 'measured record at the venue. On the replay MOST PROBABLE fired <b>once in 51 scans</b>, '
      + 'and that figure predates the retune. A quiet board is policy, not a fault. '
      + '<code>hgGoldSetEdgeRetune(false)</code> puts the original verdicts back.</div>';
  }
  return '<div class="gsx-coverage"><b>WHY SO FEW LEADERS</b> — '
    + '<b>84.5%</b> of what this desk forms can never be MOST PROBABLE: 62.9% is demoted '
    + '(it paints, it cannot lead) and 21.6% is suppressed (it never becomes a card). '
    + 'The six highest-volume detectors — HVN, opening range, BOS align, NY exhaustion, '
    + 'EMA ribbon, Asian breakout — are every one of them demote or suppress, each on its own '
    + 'measured record at the venue. On the replay MOST PROBABLE fired <b>once in 51 scans</b>. '
    + 'A quiet board is that policy working, not a fault. Three ways of arguing the policy is '
    + 'too strict were tested and none survived out of sample.</div>';
}

function whySilentHTML(ws){
  return '<div class="gsx-silent"><b>WHY SILENT</b> — ' + esc(ws) + '</div>'
    + goldCoverageNoteHTML()
    /* hg-v922: the coverage note above says how little can lead. This says
       that what decides WHICH rows lead — the tally — does not separate
       outcomes on four disjoint windows. Both belong on the same panel. */
    + (typeof hgGoldFactorSepHtml === 'function' ? hgGoldFactorSepHtml() : '')
    /* hg-v944: and that the factor which decides WHO MAY LEAD at all — the
       off-session demote — withholds 56.8% of the formed book and separates
       nothing on the same four disjoint windows. It belongs beside the tally
       panel above, because together they are the whole ranking story. */
    + (typeof hgGoldSessionSepPanelHtml === 'function' ? hgGoldSessionSepPanelHtml() : '')
    /* hg-v927: and how old the walk behind all of it is. Last, because it
       qualifies every number in the two panels above it. */
    + (typeof hgGoldEdgeWalkAgeNote === 'function' ? hgGoldEdgeWalkAgeNote() : '')
    /* hg-v928: and that the verdicts above were hand-tuned on instruction */
    + (typeof hgGoldEdgeRetuneNote === 'function' ? hgGoldEdgeRetuneNote() : '');
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
  var out = { rows15m: [], rows1h: [], rows4h: [], rows1d: [], src: {}, mixed: false, source: null, xmSymbol: null };
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
    if (!out.rows1d.length){
      try{
        var xd = await xgc('1d', KL_1D);
        if (xd && xd.rows && xd.rows.length) srcSet('1d', xd.source || 'xm-xauusd', 'rows1d', xd.rows);
      }catch(eXm4){}
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
    if (!out.rows1d.length){
      try{ var d = await ggc('1d', KL_1D);  if (d && d.rows && d.rows.length) srcSet('1d', d.source, 'rows1d', d.rows); }catch(e3d){}
    }
  }
  if (!out.rows15m.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length) srcSet('15m', 'binance-paxg', 'rows15m', p); }catch(e4){}
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) srcSet('1h', 'binance-paxg', 'rows1h', q); }catch(e5){}
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length) srcSet('4h', 'binance-paxg', 'rows4h', z); }catch(e6){}
      try{ var zd = await bk('PAXGUSDT', '1d', KL_1D); if (zd && zd.length) srcSet('1d', 'binance-paxg', 'rows1d', zd); }catch(e6d){}
    }
  }
  if (!out.rows1d.length){
    var bk1d = gfn('binanceKlines');
    if (bk1d){
      try{ var z1 = await bk1d('PAXGUSDT', '1d', KL_1D); if (z1 && z1.length) srcSet('1d', 'binance-paxg', 'rows1d', z1); }catch(e1d){}
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
        /* hg-v903: the pre-gate tally rides the same side-channel as .rejected */
        if (got.preGate){
          out.preGate = out.preGate || { attempts: 0, thin: 0, outvoted: 0 };
          out.preGate.attempts += (+got.preGate.attempts || 0);
          out.preGate.thin     += (+got.preGate.thin || 0);
          out.preGate.outvoted += (+got.preGate.outvoted || 0);
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
    /* Keep last cards while rescanning — wiping #gsCards at start left a blank
       desk for the whole macro+klines wait (and hardRefresh races looked empty). */
    var hadCards = !!(ui && ui.cards && ui.cards.innerHTML && ui.cards.innerHTML.length);
    if (ui && ui.empty) ui.empty.style.display = 'none';
    setProg(ui, 0);
    var setupsFn = gfn('goldScalpSetups'), setupFn = gfn('goldScalpSetup');
    var rankFn = gfn('goldRankSetups');
    if (!setupsFn && !setupFn){ setStat(ui, 'goldind.js not loaded — the detector engine is missing (check script order).', true); return 'error: goldind missing'; }

    setStat(ui, hadCards ? 'rescanning… previous results still showing' : 'pulling gold klines 15m/1h/4h…');
    var now = Date.now();
    var news = null;
    var ns = gfn('hgNewsState');
    if (ns){ try{ news = ns(); }catch(eN){ news = null; } }
    var seasonFn = gfn('goldSeason');
    var season = seasonFn ? seasonFn(now) : null;

    /* ranking context legs — every one optional, every one catch-isolated */
    var ctx = { now: now, news: news, season: season, macro: null, spot: null, fng: null, style: 'goldscalp',
                perpNative: null };
    var gm = gfn('getGoldMacro');
    if (gm){
      setStat(ui, 'reading macro tilt (DXY · US10Y · gold/silver ratio)…');
      try{
        ctx.macro = await Promise.race([
          Promise.resolve().then(function(){ return gm(); }),
          new Promise(function(r){ setTimeout(function(){ r(null); }, 12000); })
        ]);
      }catch(eM){ ctx.macro = null; }
    }
    /* Delta OI/funding history + Fed FOMC calendar (public, same-origin APIs) */
    try{
      var loadP = gfn('hgGoldLoadDeltaPerp');
      var loadF = gfn('hgGoldLoadFedCalendar');
      var mergeF = gfn('hgGoldMergeFedFomc');
      var waits = [];
      if (loadP){
        waits.push(Promise.resolve().then(function(){ return loadP({ symbol: 'XAUTUSD', resolution: '1h' }); })
          .then(function(j){
            ctx.perpNative = j;
            /* hg-v968: the spread lock has never fired, because nothing in this
               repo ever wrote the quote globals it reads. The quote was already
               on this wire -- Delta's ticker carries best_bid / best_ask and the
               parser dropped them. One shared reader turns the response into a
               quote, and the VENUE travels with it so a gold-proxy spread is
               reported rather than dropped against a broker-quote bar. */
            try{
              var qf = gfn('hgGoldQuoteFromPerp');
              var q = qf ? qf(j, 'delta-xaut') : null;
              if (q){
                if (isFinite(q.spreadUsd)) ctx.spreadUsd = q.spreadUsd;
                if (isFinite(q.bid)) ctx.bid = q.bid;
                if (isFinite(q.ask)) ctx.ask = q.ask;
                ctx.spreadVenue = q.venue || null;
              }
            }catch(eQ){ /* a quote that cannot be read is no quote */ }
          }).catch(function(){}));
      }
      if (loadF){
        waits.push(Promise.resolve().then(function(){ return loadF(); })
          .then(function(j){
            if (mergeF && j && j.ok) news = mergeF(news || {}, j);
            ctx.news = news;
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

    var cands = [], legs = [], venueRows = {}, rejectedAll = [], i;
    /* hg-v903: summed across venues — attempts that never reached a named gate */
    var preGateAll = { attempts: 0, thin: 0, outvoted: 0 };
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
    /* Deeper 1H leg for the 7-step engine (400 × 1H) when the scalp feed carried
       fewer — catch-isolated, 8s cap, never blocks the 15m scan. */
    try{
      var load1h = gfn('hgGoldSevenStepLoad1h');
      if (load1h && (!gold.rows1h || gold.rows1h.length < 400)){
        var leg1h = await Promise.race([
          Promise.resolve().then(function(){ return load1h(400); }),
          new Promise(function(r){ setTimeout(function(){ r(null); }, 8000); })
        ]);
        if (leg1h && leg1h.rows && leg1h.rows.length > (gold.rows1h ? gold.rows1h.length : 0)){
          gold.rows1h = leg1h.rows;
          if (gold.src) gold.src['1h'] = leg1h.source;
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
      /* v898: each timeframe against ITS OWN bars. This used to pass rows4h
         with a null timeframe, which settled every open XAUUSD record on any
         timeframe against 4H candles -- and this desk records on 1h, so its
         own horizon ran four times too long. */
      if (typeof W.hgFwdResolveMulti === 'function'){
        W.hgFwdResolveMulti('XAUUSD', { '15m': gold && gold.rows15m,
                                        '1h':  gold && gold.rows1h,
                                        '4h':  gold && gold.rows4h });
      } else if (typeof W.hgFwdResolve === 'function' && gold && gold.rows1h && gold.rows1h.length){
        W.hgFwdResolve('XAUUSD', '1h', gold.rows1h);
      }
    } catch (eRes) { try { if (typeof window.hgFwdWarn === "function") window.hgFwdWarn("goldscalp", eRes); } catch (eW) {} }
    try{
      if (typeof W.hgVolFromCloses === 'function' && gold.rows4h && gold.rows4h.length >= 30){
        W.__hgGoldVolPack = W.hgVolFromCloses(gold.rows4h.map(function(r){ return r.c; }));
      }
    }catch(eVol){}
    setProg(ui, 0.45);
    var scalpBundle = {};
    if (ctx.macro) scalpBundle.macro = ctx.macro;
    if (ctx.macro && ctx.macro.us10yCandles) scalpBundle.us10yCandles = ctx.macro.us10yCandles;
    if (typeof W !== 'undefined' && W){
      if (W.__hgGoldTickBuffer) scalpBundle.tickBuffer = W.__hgGoldTickBuffer;
      if (W.__hgGoldL2Book) scalpBundle.l2OrderBook = W.__hgGoldL2Book;
    }
    if (gold && gold.rows1d && gold.rows1d.length) scalpBundle.dailyCandles = gold.rows1d;
    if (typeof W !== 'undefined' && W && isFinite(W.__hgGoldSpreadUsd)) scalpBundle.spreadUsd = W.__hgGoldSpreadUsd;
    if (typeof W !== 'undefined' && W && W.__hgGoldQuote){
      if (isFinite(W.__hgGoldQuote.bid)) scalpBundle.bid = W.__hgGoldQuote.bid;
      if (isFinite(W.__hgGoldQuote.ask)) scalpBundle.ask = W.__hgGoldQuote.ask;
      if (isFinite(W.__hgGoldQuote.spreadUsd)) scalpBundle.spreadUsd = W.__hgGoldQuote.spreadUsd;
    }
    if (gold.src && gold.src['15m']) scalpBundle.candleSource = gold.src['15m'];
    else if (gold.source) scalpBundle.candleSource = gold.source;
    if (ctx.perpNative && ctx.perpNative.ok){
      scalpBundle.perpNative = ctx.perpNative;
      scalpBundle.oiRows = ctx.perpNative.oi;
      scalpBundle.fundingRows = ctx.perpNative.funding;
    }
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
      /* the mark this candidate was sized against — live goldspot when the
         feed is up, else the last CLOSED 15m close, which is the bar the
         scalp gates above already judged. Lets the card ask
         hgPlanMarketGeometry whether price walked through the plan. */
      var __gsxMark = gsDeskMark(ctx, gold);
      for (i = 0; i < got.length; i++){
        if (got[i] && isFinite(__gsxMark) && !isFinite(+got[i].mark)) got[i].mark = __gsxMark;
        cands.push(got[i]);
      }
      for (i = 0; i < (got.rejected || []).length; i++) rejectedAll.push(got.rejected[i]);
      if (got.preGate){
        preGateAll.attempts += (+got.preGate.attempts || 0);
        preGateAll.thin     += (+got.preGate.thin || 0);
        preGateAll.outvoted += (+got.preGate.outvoted || 0);
      }
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
    if (purged) saveConvictions(convPre);
    if (purged) legs.push('cleared ' + purged + ' stale conviction' + (purged === 1 ? '' : 's') + ' (XAUT / off-spot locks)');
    var cvFn = gfn('goldCrossVenueMap');
    if (cvFn) ctx.crossVenue = cvFn(cands);
    /* hg-v700: feed the confluence scorer its inputs. The ranking ctx used to
       carry no candle rows, so hgGoldApplyConfluence's HTF/location/momentum/
       vol legs read defaults and the score CEILINGED AT 54 — below the 65
       WATCH bar — which, now that CONF NO TRADE demotes (measured: the swing
       MP cohort it crowned ran −0.21R/trade), would have blanked MOST
       PROBABLE forever through data starvation rather than measurement (the
       v532 solidity lesson). The scorer derives structure/ribbon/VWAP/ADX/RSI
       from these rows itself; cards that clear the bar with real data can
       lead again. */
    ctx.rows15m = gold.rows15m;
    ctx.rows1h = gold.rows1h;
    ctx.rows4h = gold.rows4h;
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
      }catch(ePg){
        /* The whole post-gate never ran. Every candidate is unchecked, not
           clean — mark them so the card cannot imply a gate that passed. */
        var mkFn = gfn('hgMarkGateUnchecked');
        var pgWhy = 'post-gate filter threw: ' + ((ePg && ePg.message) ? ePg.message : String(ePg));
        for (var pgI = 0; pgI < ranked.length; pgI++){
          if (mkFn) mkFn(ranked[pgI], [pgWhy]);
        }
        try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('GOLDSCALP', pgWhy); }catch(ePg2){}
      }
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

    /* (5) NEWS-GATE VETO — tier-1 US prints (CPI/NFP/FOMC/GDP) lock new
       convictions 30 min before / 15 min after; already-live keep running */
    var newsVeto = false, newsVetoTitle = null;
    var ngFn = gfn('hgGoldNewsGate');
    var ncFn = gfn('goldNewsCaution');
    if (ngFn && news){
      try{
        var ng = ngFn(news, now);
        if (ng && ng.lock){ newsVeto = true; newsVetoTitle = ng.title || null; }
      }catch(eV){ newsVeto = false; }
    } else if (ncFn && news){
      try{
        var nc2 = ncFn(news, now);
        if (nc2 && nc2.caution){ newsVeto = true; newsVetoTitle = nc2.title || null; }
      }catch(eV2){ newsVeto = false; }
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
                           reason: 'NEWS GATE — no new entries, wait 15 min after release'
                                   + (newsVetoTitle ? ' (' + newsVetoTitle + ')' : '') });
      } else if (vc) cards.push(vc);
    }
    if (newsVeto) legs.push('NEWS GATE — new convictions held (existing ones keep running)');

    /* hg-v930: ONE POSITION AT A TIME. Applied HERE and nowhere earlier —
       after applyConviction has stamped c.locked (so the trade you are in is
       recognised and left alone) and after goldWatchPromote has had its say,
       but BEFORE the leader is picked. Every picker below skips demoted rows,
       so this empties MOST PROBABLE without a second code path. */
    var oneAtATime = null;
    /* resolved per scan rather than at mount: headless warms never mount, and
       a persisted gsSetOneAtATime(false) has to reach them too */
    try{ gsOneAtATimeInit(); }catch(eOaI){}
    try{ oneAtATime = gsApplyOneAtATime(ranked, null); }catch(eOaT){ oneAtATime = null; }
    if (oneAtATime && oneAtATime.held > 0){
      legs.push('ONE AT A TIME — ' + oneAtATime.n + ' gold conviction'
                + (oneAtATime.n === 1 ? '' : 's') + ' live, ' + oneAtATime.held + ' new setup'
                + (oneAtATime.held === 1 ? '' : 's') + ' held');
    }

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
    /* hg-v905: locked convictions arrive from the store without a mark — give
       them the SAME one the fresh candidates got, so the geometry line can
       speak on the cards most likely to be stale. */
    gsStampMergedMarks(display, gsDeskMark(ctx, gold));
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
    /* hg-v699: the "crown display[0] anyway" fallback is GONE. It promoted a
       demoted card to MOST PROBABLE whenever nothing was lead-eligible — the
       replay measured that banner cohort at −1.49R/trade net of XM costs,
       the exact TOP-SETUP-widget defect class (fabricated lead from a
       measured-negative board). An all-demoted board now has NO banner. */
    var uniRows = gold.rows15m.length ? gold.rows15m : (gold.rows1h || []);
    var deskTape = goldUniformTapeOf(uniRows);
    __lastDeskTape = deskTape || '';   /* published with the scan snapshot so OMNIGOLD holds the same side */
    displayBest = goldTapeAlignedBest(displayBest, display, deskTape);
    /* LEAD INVARIANT (fail closed): whatever path proposed the lead —
       ranking, spot alignment, tape alignment (hgGoldUniformAlignedBest can
       return its demoted fallback) — a demoted or vetoed card can never be
       MOST PROBABLE. goldRankSetups holds this rule; the desk holds it too. */
    if (displayBest && (displayBest.demoted || displayBest.vetoed)) displayBest = null;
    goldStampTape(display, deskTape);
    /* hg-v731: Smart Money Concepts context on the finished cards — DISPLAY ONLY
       at this point. Runs after every level engine, the spot alignment, the
       conviction lock and the lead invariant, so it reads the exact objects
       cardHTML paints. THIS call only attaches c.smc and records an SMC_CONTEXT
       signal; it never touches tally, grade, demotion, veto or the lead.
       Ordering upstream is no longer SMC-free though: goldRankSetups scores an
       SMC read into solidityScore, which is its third sort tiebreaker. */
    try{
      if (typeof W.hgSmcEnrich === 'function'){
        var smcTab = (scanSt && scanSt.deskTab) || 'GOLD SCALP';
        for (var smcI = 0; smcI < display.length; smcI++){
          var smcC = display[smcI];
          if (!smcC || !smcC.dir) continue;
          var smcVr = venueRows ? venueRows[smcC.venue] : null;
          W.hgSmcEnrich(smcC, {
            rows: (smcVr && smcVr.rows15m && smcVr.rows15m.length) ? smcVr.rows15m : gold.rows15m,
            tab: smcTab
          });
        }
      }
    }catch(eSmc){}

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
      var kzW = null, kzL = null, asiaSession = false;
      var kzFn2 = gfn('goldKillzone');
      if (kzFn2){
        try{
          var kz2 = kzFn2(now);
          if (kz2){ kzW = kz2.weight; kzL = kz2.label; asiaSession = kz2.zone === 'ASIAN'; }
        }catch(eK2){}
      }
      whySilent = whySilentText({
        newsVeto: newsVeto, newsVetoTitle: newsVetoTitle,
        feedsFailed: !gold.rows15m.length,
        asiaSession: asiaSession,
        kzWeight: kzW, kzLabel: kzL,
        liveN: liveN, armed: armedAll, watchMeta: watchMeta
      });
    }

    var basisHtml = stRoute ? stGoldBasisHtml() : '';
    /* hg-v901: the unread-HTF-leg line rides with the mixed-feed banner, so
       both feed caveats reach every render path the banner already reaches. */
    /* hg-v913: this desk reads the records it writes. */
    var fwdNote = (typeof W.hgGoldFwdNote === 'function' ? W.hgGoldFwdNote('goldscalp') : '');
    var mixedBanner = fwdNote + gsTapeNotes(gold && gold.rows15m)
      + gsFeedLegNote(gold) + goldMixedFeedBannerHtml(gold);
    var uniHtml = goldUniformPanelHtml(display, uniRows, 'SCALP', deskTape);
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
    function sevenStepHtml(){
      /* Gold Playbook 7-step readout — 4H context, 1H execution, closed bars only.
         Same desk tape as the uniform card: against-tape candidates stay HELD. */
      try{
        var sevenFn = gfn('hgGoldSevenStepPanel');
        if (!sevenFn) return '';
        var feed1h = (gold.src && (gold.src['1h'] || gold.src['15m'])) || gold.source || 'unavailable';
        var basis = NaN;
        try{ if (typeof S !== 'undefined' && S && isFinite(+S.goldBasisPct)) basis = +S.goldBasisPct; }catch(eB){}
        return sevenFn({
          rows1h: gold.rows1h || [], rows15m: gold.rows15m, rows4h: gold.rows4h, now: now,
          feed: feed1h, venue: (feed1h === 'delta-xaut') ? 'analysis feed' : 'Delta XAUTUSD', basisPct: basis,
          macro: ctx.macro, dxyRows: ctx.macro && ctx.macro.dxyRows, news: ctx.news,
          perpNative: ctx.perpNative, fundingRate: ctx.fundingRate, tape: deskTape
        });
      }catch(eSeven){ return ''; }
    }
    function formingLayersHtml(){
      /* two independent panels — a throw in one must not blank the other */
      var seven = sevenStepHtml();
      var forming = '';
      try{
        var fsFn = gfn('hgGoldFormingStack');
        var fhFn = gfn('hgGoldFormingStackHtml');
        if (fsFn && fhFn) forming = fhFn(fsFn({
          rows15m: gold.rows15m, rows4h: gold.rows4h, macro: ctx.macro,
          dxyRows: ctx.macro && ctx.macro.dxyRows, now: now,
          perpNative: ctx.perpNative,
          oiRows: ctx.perpNative && ctx.perpNative.oi,
          fundingRows: ctx.perpNative && ctx.perpNative.funding
        })) || '';
      }catch(eFs){ forming = ''; }
      return seven + forming;
    }
    if (ui && ui.cards && ui.empty){
      if (display.length){
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = basisHtml + mixedBanner + aplusPack.panel + uniHtml
          + gsOneAtATimeHtml(oneAtATime) + gsBreakevenHtml() + bannerHTML(displayBest, display)
          + display.map(function(c){ return cardHTML(c, !!(displayBest && c.id === displayBest.id), season && season.note, deskTape); }).join('')
          + formingLayersHtml()
          + formingNowHTML(armedAll)
          + gsRejectFunnelHTML(rejectedAll, preGateAll)
          + rejectedHTML(rejectedAll)
          + historyHTML(lock.store.history);
      } else if (rejectedAll.length || armedAll.length){
        /* zero qualifying candidates but something to show: WHY SILENT leads,
           then the watch panel, then the held-back reason lines */
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = basisHtml + mixedBanner + uniHtml + gsOneAtATimeHtml(oneAtATime)
          + gsBreakevenHtml()
          + (whySilent ? whySilentHTML(whySilent) : '')
          + formingLayersHtml()
          + gsRejectFunnelHTML(rejectedAll, preGateAll)
          + rejectedHTML(rejectedAll)
          + formingNowHTML(armedAll)
          + historyHTML(lock.store.history);
      } else {
        /* feeds failed: cards stay empty (no fabricated setups);
           the 7-step readout still prints — NO SETUP or DATA_UNAVAILABLE is
           itself the answer the playbook asks for. Catalog lives on empty. */
        ui.cards.innerHTML = basisHtml + uniHtml + sevenStepHtml();
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
              basisHtml: basisHtml + mixedBanner + aplusPack.panel + uniHtml, bannerHTML: bannerHTML, cardHTML: cardHTML,
              formingNowHTML: formingNowHTML, rejectedHTML: rejectedHTML, historyHTML: historyHTML,
              formingLayersHTML: formingLayersHtml,
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
    /* hg-v968: stamp the completion, so an auto refresh is VISIBLE. Written in
       the finally, so a failed scan stamps too -- "last attempt 14:32, it
       failed" is information; a frozen clock is not. */
    try{ scanSt.lastScanAt = Date.now(); gsPaintAutoStamp(ui, scanSt); }catch(eST){}
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
      /* hg-v968: THE AUTO-REFRESH YOU COULD NOT SEE.
         hg-v965 put GOLD SCALP on a 3-minute clock and hg-v967 fixed the
         resolution that stopped it firing -- and this tab showed NO last-scan
         time anywhere, so a working refresh and a dead one looked identical.
         Asked for three times, and the first two answers changed a timer the
         desk owner had no way to observe. This line is how you tell. */
      + '<div class="note" id="' + p + 'AutoStamp" style="margin-top:4px;opacity:.85"></div>'
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
    try{ ui.autoStamp = el.querySelector('#' + p + 'AutoStamp'); }catch(eAS){ ui.autoStamp = null; }
    scanSt.ui = ui;
    /* hg-v968: the countdown ticker starts when the tab is MOUNTED, never at
       module load -- see the note beside the export. Idempotent: a second mount
       installs no second timer. */
    try{ gsAutoStampInit(); gsPaintAutoStamp(ui, scanSt); }catch(eSI){}
    scanSt.useStartraderRouting = !!cfg.useStartraderRouting;
    scanSt.deskTab = cfg.deskTab || 'GOLD SCALP';   /* same bucket label hgSetupPaintDesk uses below */

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
      var catFnM = gfn('hgGoldCatalogEngine');
      var catHtmlM = gfn('hgGoldCatalogHtml');
      if (ui.cards && catFnM && catHtmlM) ui.cards.innerHTML = catHtmlM(catFnM([], {}));
    }catch(eCatM){}
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

/* BRAIN warm-up hook — headless scan against inert stub elements (oiflow.js
   oiflowWarm pattern). Shares __scan.busy with the mounted scan. Never throws. */
function __gsWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}

/* hg-v968 -- the visible half of the 3-minute clock.

   Renders "AUTO 3m - last scan HH:MM:SS - next in M:SS" on the tab. The next
   time is read from the shell's own timer (__hgGoldScalpAutoNext) rather than
   recomputed here, so the line cannot drift from the clock it describes; with
   the shell absent it simply omits that half rather than inventing one. */
function gsFmtClock(ms){
  try{
    var d = new Date(ms);
    var p2 = function(n){ return (n < 10 ? '0' : '') + n; };
    return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }catch(e){ return '--:--:--'; }
}
function gsFmtLeft(ms){
  var sec = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
}
function gsAutoStampText(scanSt, nowMs, nextMs, everyMs){
  var bits = [];
  if (isFinite(everyMs) && everyMs > 0) bits.push('AUTO ' + Math.round(everyMs / 60000) + 'm');
  else bits.push('AUTO off');
  if (scanSt && isFinite(scanSt.lastScanAt) && scanSt.lastScanAt > 0)
    bits.push('last scan ' + gsFmtClock(scanSt.lastScanAt));
  else bits.push('no scan yet');
  if (isFinite(nextMs) && nextMs > 0 && isFinite(nowMs))
    bits.push('next in ' + gsFmtLeft(nextMs - nowMs));
  return bits.join(' · ');
}
function gsPaintAutoStamp(ui, scanSt){
  try{
    var node = ui && ui.autoStamp;
    if (!node) return '';
    var every = (typeof W !== 'undefined' && W && isFinite(W.HG_GOLDSCALP_AUTO_MS))
      ? W.HG_GOLDSCALP_AUTO_MS : NaN;
    var next = (typeof W !== 'undefined' && W && isFinite(W.__hgGoldScalpAutoNext))
      ? W.__hgGoldScalpAutoNext : NaN;
    var txt = gsAutoStampText(scanSt || __scan, Date.now(), next, every);
    node.textContent = txt;
    return txt;
  }catch(e){ return ''; }
}
var __gsStampTimer = null;
function gsAutoStampInit(){
  try{
    if (__gsStampTimer !== null) return 'already';       /* one page, one clock (hg-v958) */
    if (typeof setInterval !== 'function') return 'no timer';
    __gsStampTimer = setInterval(function(){
      try{ if (__scan && __scan.ui) gsPaintAutoStamp(__scan.ui, __scan); }catch(e){}
    }, 1000);
    return 'armed';
  }catch(e){ __gsStampTimer = null; return 'error'; }
}

async function goldscalpRefresh(){
  try{
    if (__scan.busy) return 'busy';
    var ui = __scan.ui;
    if (!ui){
      ui = { btn: __gsWarmShim(), stat: __gsWarmShim(), prog: __gsWarmShim(),
             cards: __gsWarmShim(), empty: __gsWarmShim() };
    }
    return await runScan(ui, __scan);
  }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
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
/* gsGateFamily and gsGateShort stay INTERNAL. They normalise a reason string,
   so String(junk) of an object is "[object Object]" by definition — correct for
   a normaliser, and exactly what test-gold-render-integrity.mjs rightly refuses
   to let a gold tab expose, since anything reachable on window is fuzzed as a
   renderer. The funnel and its HTML are the surface; the test lifts the two
   helpers out of the source to check them directly. */
W.gsTapeSanity = gsTapeSanity;
W.gsDeskMark = gsDeskMark;
W.gsStampMergedMarks = gsStampMergedMarks;
W.gsFeedLegs = gsFeedLegs;
W.gsRejectFunnel = gsRejectFunnel;
W.gsRejectFunnelHTML = gsRejectFunnelHTML;
W.gsRrShortfall = gsRrShortfall;
W.gsRrShortfallHTML = gsRrShortfallHTML;
W.gsOneAtATimeInit = gsOneAtATimeInit;
W.gsSetOneAtATime = gsSetOneAtATime;
W.gsOpenGoldConvictions = gsOpenGoldConvictions;
W.gsApplyOneAtATime = gsApplyOneAtATime;
W.gsOneAtATimeHtml = gsOneAtATimeHtml;
W.gsBreakevenHtml = gsBreakevenHtml;
/* the leader picker itself — exported so a guard can assert that a held row
   really stops leading, against the SHIPPED function rather than a copy of
   its logic that would agree with a broken one */
W.goldPickSpotAlignedBest = goldPickSpotAlignedBest;

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
/* hg-v967: DELIBERATELY NOT EXPORTED ON WINDOW, and the reason matters because
   the obvious fix was to export it.

   hg-v965 added a 3-minute clock in index.html that read
   window.goldscalpRefresh, which this file never set -- the function existed
   only as the .refresh property of the HG_tabs entry below -- so every tick
   resolved undefined and the refresh never ran once.

   Exporting it fixes that and costs two things. It puts a function that STARTS
   A NETWORK SCAN on the global object, reachable by anything; and
   test-gold-render-integrity.mjs fuzzes every module-scope export of the gold
   tabs precisely because this file keeps a small surface -- adding to it
   weakens a guard to fix a caller.

   So the HG_tabs registration stays the single route, and index.html's
   hgGoldScalpRefreshFn RESOLVES through it. That is the mechanism the shell's
   own sweep already uses. Do not 'helpfully' add the global here. */
/* hg-v968 -- and this pack's first cut then did exactly that, two lines below
   the warning: exporting gsAutoStampText and gsAutoStampInit took this file from
   19 to 21 module-scope functions and turned the same guard red. Both now
   travel on the HG_tabs registration, the one route hg-v967 established. */
/* hg-v968: DELIBERATELY NOT ARMED AT MODULE LOAD.
   The first cut called gsAutoStampInit() here. In a browser that is harmless;
   in Node it installs a REAL 1-second setInterval that is never cleared, so the
   event loop never drains and the process never exits -- every test that boots
   this file hangs forever, and the full suite stalled on
   test-conviction-orphan-expiry for exactly that reason. The gate caught it.
   It is armed from the MOUNT instead, which is also the correct lifecycle: a
   countdown for a tab nobody has opened has nothing to paint. */
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldscalp', label: 'GOLD SCALP', mount: mount, refresh: goldscalpRefresh,
                 autoStampText: gsAutoStampText, autoStampInit: gsAutoStampInit });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldscalp', label: 'GOLD SCALP', run: gsWarm });
})();
