/* =========================================================================
HARDGATE — goldscalp.js
GOLD SCALP tab: expert gold scalping engine. RUN SCAN pulls multi-timeframe
gold klines (15m/1h/4h) from every available venue, composes PER-STRATEGY
candidates via goldind.js (window.goldScalpSetups — liquidity-sweep reversal,
order-block/breaker retest, FVG fill, session-VWAP bounce/rejection, EMA
20/50/200 ribbon pullback, Asian-range 00:00-07:00 GMT breakout, modified-RSI
75/25 divergence), ranks them all with a transparent human-readable
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
     demoted (can never be MOST PROBABLE, stamped OFF-SESSION) and must clear
     tally >= +2 (normal render bar 0 + 2) to render at all. The Asian-range
     breakout strategy is allowed its own 00:00-07:00 GMT session.
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
                  'twelvedata': 'TWELVE DATA XAU/USD', 'yahoo': 'YAHOO GC=F' };
function venueLabel(src){ return SRC_LABEL[src] || 'PAXGUSDT · BINANCE'; }

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
      arm.push({ strategy: w0.strategy || null, venue: w0.venue || null,
                 state: (w0.state === 'armed') ? 'armed' : 'idle',
                 level: (typeof w0.level === 'number' && isFinite(w0.level)) ? w0.level : null,
                 condition: w0.condition || '', reason: w0.reason || null });
    }
    __scanSnap = { cands: cands, bestId: best ? (best.id || null) : null, history: hist, rejected: rej,
                   armed: arm, whySilent: (typeof whySilent === 'string' && whySilent) ? whySilent : null, at: at };
  }catch(e){ /* snapshotting must never break the scan */ }
}

/* ============================ CONVICTION LOCK ============================
   localStorage 'hgGoldscalpConviction' -> { v, live: {id: rec}, history:
   [rec] } where rec = { id, dir, strategy, entry, stop, t1, t2, venue, sym,
   issuedAt, tally }. A re-scan NEVER re-picks levels for a live conviction:
   the stored entry/stop/t1/t2 are restored verbatim with an 'as of HH:MM'
   stamp. Transitions only on invalidation against the latest 15m close:
   beyond stop -> STOPPED (slot reopens), TP1 reached -> TARGET HIT, older
   than 6h -> EXPIRED. Closed records move to a capped history — never
   silently dropped. localStorage is probed softly; without it the lock is
   memory-only for the scan (still never throws). */
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
  var store = loadConvictions(), transitions = [];
  try{
    var id, rec, i;
    /* 1) invalidation transitions on live convictions */
    for (id in store.live){
      if (!Object.prototype.hasOwnProperty.call(store.live, id)) continue;
      rec = store.live[id];
      if (!rec || (rec.dir !== 'long' && rec.dir !== 'short') || !isFinite(rec.stop)
          || !isFinite(rec.t1) || !isFinite(rec.issuedAt)){
        delete store.live[id];
        continue;
      }
      var status = null, lastClose = NaN;
      var vr = venueRows ? venueRows[rec.venue] : null;
      if (vr && vr.rows15m && vr.rows15m.length){
        var lc = vr.rows15m[vr.rows15m.length - 1];
        if (lc && isFinite(lc.c)) lastClose = lc.c;
      }
      if (isFinite(lastClose)){
        if (rec.dir === 'long'){
          if (lastClose < rec.stop) status = 'STOPPED';
          else if (lastClose >= rec.t1) status = 'TARGET HIT';
        } else {
          if (lastClose > rec.stop) status = 'STOPPED';
          else if (lastClose <= rec.t1) status = 'TARGET HIT';
        }
      }
      if (!status && (nowMs - rec.issuedAt) > CONVICTION_TTL_MS) status = 'EXPIRED';
      if (status){
        rec.status = status;
        rec.closedAt = nowMs;
        if (isFinite(lastClose)) rec.closePrice = lastClose;
        store.history.unshift(rec);
        delete store.live[id];
        transitions.push(rec);
      }
    }
    if (store.history.length > CONVICTION_HIST) store.history = store.history.slice(0, CONVICTION_HIST);

    /* 2) restore live conviction levels verbatim / issue new convictions */
    for (i = 0; i < ranked.length; i++){
      var c = ranked[i];
      if (!c || !c.id) continue;
      rec = store.live[c.id];
      if (rec){
        c.entry = rec.entry; c.stop = rec.stop; c.t1 = rec.t1; c.t2 = rec.t2;
        var risk = Math.abs(rec.entry - rec.stop);
        if (risk > 0){
          c.rr = Math.abs(rec.t1 - rec.entry)/risk;
          c.rr2 = Math.abs(rec.t2 - rec.entry)/risk;
        }
        c.venue = rec.venue; c.sym = rec.sym;
        c.locked = true; c.issuedAt = rec.issuedAt;
      } else {
        /* duplicate-conviction merge: same symbol+direction, structure anchor
           within 0.5×ATR of a live conviction -> merge, never double-issue */
        var mr = null;
        if (isFinite(c.anchor) && isFinite(c.atr) && c.atr > 0){
          for (var mid in store.live){
            if (!Object.prototype.hasOwnProperty.call(store.live, mid)) continue;
            var mr0 = store.live[mid];
            if (!mr0 || mr0.dir !== c.dir || mr0.sym !== c.sym || !isFinite(mr0.anchor)) continue;
            if (Math.abs(c.anchor - mr0.anchor) <= 0.5*c.atr){ mr = mr0; break; }
          }
        }
        if (mr){
          mr.lastConfirmedAt = nowMs;      /* refresh 'last confirmed at' */
          c.entry = mr.entry; c.stop = mr.stop; c.t1 = mr.t1; c.t2 = mr.t2;
          var mrisk = Math.abs(mr.entry - mr.stop);
          if (mrisk > 0){
            c.rr = Math.abs(mr.t1 - mr.entry)/mrisk;
            c.rr2 = Math.abs(mr.t2 - mr.entry)/mrisk;
          }
          c.venue = mr.venue; c.sym = mr.sym;
          c.locked = true; c.issuedAt = mr.issuedAt;
          c.merged = true; c.mergedInto = mr.id; c.mergedAt = nowMs;
        } else if (noMint){
          c.vetoed = true;   /* news window — held back, nothing minted */
        } else {
          rec = { id: c.id, dir: c.dir, strategy: c.strategy, entry: c.entry, stop: c.stop,
                  t1: c.t1, t2: c.t2, venue: c.venue, sym: c.sym, issuedAt: nowMs,
                  tally: isFinite(c.tally) ? c.tally : 0,
                  anchor: isFinite(c.anchor) ? c.anchor : null };
          store.live[c.id] = rec;
          c.locked = false; c.issuedAt = nowMs;
        }
      }
      try{ c.asOf = isFinite(c.issuedAt) ? new Date(c.issuedAt).toISOString().slice(11, 16) + ' UTC' : ''; }
      catch(eD){ c.asOf = ''; }
    }
    saveConvictions(store);
  }catch(e){}
  return { store: store, transitions: transitions };
}

/* ---------------- pane-scoped styles (injected from here ONLY) ---------------- */
var GS_CSS = ''
+ '#tab_goldscalp .gsx-banner{position:relative;border-radius:12px;padding:3px;margin:16px 0 18px;'
+ 'background:linear-gradient(120deg,#A67C12,#F5D77A 25%,#EA580C 50%,#E8B42A 75%,#A67C12);'
+ 'box-shadow:0 12px 32px -12px rgba(201,146,26,.28)}'
+ '#tab_goldscalp .gsx-banner-in{background:linear-gradient(180deg,#FFFFFF,#FFFBEB);border-radius:10px;padding:16px 18px;color:#020617}'
+ '#tab_goldscalp .gsx-eye{font-size:10px;letter-spacing:.3em;color:#A67C12;font-weight:800}'
+ '#tab_goldscalp .gsx-dir{font-family:var(--disp,inherit);font-size:26px;font-weight:800;letter-spacing:.06em;margin-top:4px}'
+ '#tab_goldscalp .gsx-dir.long{color:#047857;text-shadow:none}'
+ '#tab_goldscalp .gsx-dir.short{color:#B91C1C;text-shadow:none}'
+ '#tab_goldscalp .gsx-dir span{display:block;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.14em;color:#334155;margin-top:4px}'
+ '#tab_goldscalp .gsx-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:12px 0 4px}'
+ '#tab_goldscalp .gsx-plan>div{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:9px 11px}'
+ '#tab_goldscalp .gsx-plan i{display:block;font-style:normal;font-size:9px;letter-spacing:.16em;color:#475569;font-weight:700}'
+ '#tab_goldscalp .gsx-plan b{display:block;font-size:16px;color:#A67C12;font-weight:800;margin:3px 0}'
+ '#tab_goldscalp .gsx-plan u{text-decoration:none;font-size:10px;color:#334155;opacity:1;font-weight:500;line-height:1.45}'
+ '#tab_goldscalp .gsx-why{font-size:11px;margin-top:8px;color:#334155;font-weight:600}'
+ '#tab_goldscalp .gsx-why b{color:#A67C12;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '#tab_goldscalp .gsx-tally{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}'
+ '#tab_goldscalp .gsx-tp{font-size:9px;letter-spacing:.03em;padding:3px 8px;border-radius:4px;border:1px solid;font-weight:600}'
+ '#tab_goldscalp .gsx-tp.pos{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '#tab_goldscalp .gsx-tp.neg{color:#B91C1C;border-color:rgba(220,38,38,.40);background:rgba(220,38,38,.08)}'
+ '#tab_goldscalp .gsx-inv{font-size:11px;color:#334155;margin-top:8px;line-height:1.55;font-weight:500}'
+ '#tab_goldscalp .gsx-inv b{color:#B91C1C;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '#tab_goldscalp .gsx-lock{margin-top:10px;font-size:10px;letter-spacing:.08em;color:#A67C12;font-weight:600;border-top:1px dashed #FDE68A;padding-top:8px}'
+ '#tab_goldscalp .gsx-lock.new{color:#475569}'
+ '#tab_goldscalp .gsx-card.long{border-left:4px solid #059669;background:linear-gradient(180deg,rgba(5,150,105,.06),transparent 42%),#FFFFFF}'
+ '#tab_goldscalp .gsx-card.short{border-left:4px solid #DC2626;background:linear-gradient(180deg,rgba(220,38,38,.05),transparent 42%),#FFFFFF}'
+ '#tab_goldscalp .gsx-card.best{box-shadow:0 0 0 2px rgba(201,146,26,.40),0 12px 28px -14px rgba(201,146,26,.20)}'
+ '#tab_goldscalp .gsx-strat{color:#A67C12;font-size:10px;font-weight:800;letter-spacing:.12em}'
+ '#tab_goldscalp .gsx-grade{font-weight:800}'
+ '#tab_goldscalp .gsx-grade.A{color:#A67C12}'
+ '#tab_goldscalp .gsx-grade.B{color:#047857}'
+ '#tab_goldscalp .gsx-grade.C{color:#475569}'
+ '#tab_goldscalp .gsx-tallynum{font-weight:800}'
+ '#tab_goldscalp .gsx-tallynum.up{color:#047857}'
+ '#tab_goldscalp .gsx-tallynum.dn{color:#B91C1C}'
+ '#tab_goldscalp .gsx-lockline{font-size:9px;color:#A67C12;letter-spacing:.1em;margin-top:6px;font-weight:700}'
+ '#tab_goldscalp .gsx-whyline{font-size:11px;color:#020617;margin-top:8px;line-height:1.6;font-weight:500}'
+ '#tab_goldscalp .gsx-invline{font-size:10px;color:#334155;margin-top:5px;line-height:1.55;font-weight:500}'
+ '#tab_goldscalp .gsx-invline b{color:#B91C1C;letter-spacing:.08em;font-weight:800}'
+ '#tab_goldscalp .gsx-hist{margin-top:18px}'
+ '#tab_goldscalp .gsx-hhead{font-size:10px;letter-spacing:.2em;color:#475569;margin-bottom:6px;font-weight:700}'
+ '#tab_goldscalp .gsx-hrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_goldscalp .gsx-hrow.stopped{border-left-color:#DC2626}'
+ '#tab_goldscalp .gsx-hrow.target{border-left-color:#059669}'
+ '#tab_goldscalp .gsx-hrow.expired{border-left-color:#A67C12}'
+ '#tab_goldscalp .gsx-hrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '#tab_goldscalp .gsx-hrow.rej{border-left-color:#EA580C}'
+ '#tab_goldscalp .gsx-gateline{font-size:10px;color:#9A3412;letter-spacing:.04em;margin-top:8px;'
+ 'border:1px solid rgba(234,88,12,.30);border-radius:6px;padding:6px 9px;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '#tab_goldscalp .gsx-gateline b{letter-spacing:.12em;font-weight:800;color:#9A3412}'
+ '#tab_goldscalp .gsx-mgmt{font-size:10px;margin-top:8px;padding:6px 9px;border-radius:6px;line-height:1.55;'
+ 'color:#020617;border:1px dashed #FDE68A;background:#FFFBEB;font-weight:500}'
+ '#tab_goldscalp .gsx-mgmt b{color:#A67C12;letter-spacing:.12em;font-size:9px;font-weight:800}'
+ '#tab_goldscalp .gsx-guide{font-size:10px;margin-top:6px;letter-spacing:.03em;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_goldscalp .gsx-guide b{letter-spacing:.12em;font-size:9px;font-weight:800}'
+ '#tab_goldscalp .gsx-guide.in{color:#047857;font-weight:600}'
+ '#tab_goldscalp .gsx-guide.out{color:#9A3412;font-weight:600}'
+ '#tab_goldscalp .gsx-wrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_goldscalp .gsx-wrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '#tab_goldscalp .gsx-wrow.armed{border-left-color:#C9921A;color:#020617;background:#FFFBEB}'
+ '#tab_goldscalp .gsx-wst{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '#tab_goldscalp .gsx-wrow.armed .gsx-wst{color:#A67C12;border-color:rgba(201,146,26,.45);background:rgba(201,146,26,.12)}'
+ '#tab_goldscalp .gsx-wrow.idle .gsx-wst{color:#475569;border-color:#E2E8F0;background:#F8FAFC}'
+ '#tab_goldscalp .gsx-silent{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:9px 11px;margin:12px 0;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '#tab_goldscalp .gsx-silent b{letter-spacing:.12em;font-weight:800;color:#9A3412}';

/* ---------------- renderers ---------------- */
function tallyChips(c){
  if (!Array.isArray(c.tallyParts) || !c.tallyParts.length) return '';
  return '<div class="gsx-tally">' + c.tallyParts.map(function(p){
    if (!p) return '';
    return '<span class="gsx-tp ' + (p.pts >= 0 ? 'pos' : 'neg') + '">' + (p.pts >= 0 ? '+' : '') + p.pts + ' · ' + esc(p.label) + '</span>';
  }).join('') + '</div>';
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
  var chips = (c.confluence || []).map(function(x){ return '<span class="gpip ok">' + esc(x) + '</span>'; }).join('');
  if (c.oppose > 0) chips += '<span class="gpip">' + c.oppose + ' opposing read' + (c.oppose === 1 ? '' : 's') + ' on the books</span>';
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
      : '<div class="gsx-lockline" style="color:#475569">○ new conviction issued ' + esc(c.asOf || '') + '</div>';
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
  var tradeBtn = (typeof toTrade === 'function' && c.sym)
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(c.sym) + ',' + JSON.stringify(c.dir) + ',' + c.entry + ',' + c.stop + ',' + c.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function' && c.sym)
    ? bookBtnHTML(c.sym, c.dir, c.entry, c.stop, c.t1, { strategy: 'goldscalp', klass: 'metals', fund: 'gold' }) : '';
  return '<div class="card gsx-card ' + c.dir + (isBest ? ' best' : '') + '">'
    + '<div class="chead"><span class="sym">' + esc(c.venue) + '</span>'
    + '<span class="dir">' + dirUp + ' · <span class="gsx-grade ' + esc(c.grade) + '">GRADE ' + esc(c.grade) + '</span></span></div>'
    + '<div class="gsx-strat">' + esc(c.strategy) + (isBest ? ' · ★ MOST PROBABLE' : '') + '</div>'
    + '<div class="mini">'
    + '<span class="k">venue</span><span>' + esc(c.venue) + (c.sym ? ' · ' + esc(c.sym) : '') + '</span>'
    + '<span class="k">reads</span><span>' + c.reads.long + ' long / ' + c.reads.short + ' short · ' + tallyNum + '</span>'
    + '<span class="k">killzone</span><span>' + esc(c.killzone) + '</span>'
    + '<span class="k">ATR14 15m</span><span>' + pxF(c.atr) + '</span>'
    + '<span class="k">R:R</span><span>1 : ' + fmtF(c.rr, 1) + ' (T1) · 1 : ' + fmtF(c.rr2, 1) + ' (T2)</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ' + gradeCls + '">GRADE ' + c.grade + '</span>'
    + '<span class="gpip">' + esc(c.killzone) + '</span>'
    + chips
    + '</div>'
    + tallyChips(c)
    + '<div class="plan">' + (c.dir === 'long' ? 'BUY' : 'SELL') + ' <b>$' + pxF(c.zone ? c.zone.lo : c.entry) + '–$' + pxF(c.zone ? c.zone.hi : c.entry) + '</b>'
    + ' · ENTRY <b>$' + pxF(c.entry) + '</b>'
    + ' · STOP <b>$' + pxF(c.stop) + '</b>'
    + ' · TP1 <b>$' + pxF(c.t1) + '</b> (' + fmtF(c.rr, 1) + 'R)'
    + ' · TP2 <b>$' + pxF(c.t2) + '</b> (' + fmtF(c.rr2, 1) + 'R)'
    + '</div>'
    + mgmtBlock + guideBlock
    + (c.why ? '<div class="gsx-whyline">' + esc(c.why) + '</div>' : '')
    + (c.invalidates ? '<div class="gsx-invline"><b>INVALIDATES:</b> ' + esc(c.invalidates) + '</div>' : '')
    + gateLine
    + lockLine
    + newsBanner + notes + seasonLine
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
  if (!armed || !armed.length) return '';
  var rows = armed.map(function(w){
    if (!w) return '';
    var st = w.state === 'armed';
    var lvlNum = (typeof w.level === 'number' && isFinite(w.level));
    return '<div class="gsx-wrow ' + (st ? 'armed' : 'idle') + '">'
      + '<span class="gsx-wst">' + (st ? 'ARMED' : 'IDLE') + '</span>'
      + '<b>' + esc(w.strategy || 'SETUP') + '</b>'
      + (w.venue ? ' · ' + esc(w.venue) : '')
      + (lvlNum ? ' · $' + pxF(w.level) : '')
      + ' — ' + esc(st ? (w.condition || 'watching') : (w.reason || w.condition || 'no trigger in range'))
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

/* ---------------- data legs (each catch-isolated) ---------------- */
async function fetchGoldKlines(){
  var out = { rows15m: [], rows1h: [], rows4h: [], source: null };
  var ggc = gfn('getGoldCandles');
  if (ggc){
    try{ var a = await ggc('15m', KL_15M); if (a && a.rows && a.rows.length){ out.rows15m = a.rows; out.source = a.source; } }catch(e){}
    try{ var b = await ggc('1h', KL_1H);  if (b && b.rows && b.rows.length){ out.rows1h = b.rows; if (!out.source) out.source = b.source; } }catch(e2){}
    try{ var c = await ggc('4h', KL_4H);  if (c && c.rows && c.rows.length){ out.rows4h = c.rows; if (!out.source) out.source = c.source; } }catch(e3){}
  }
  if (!out.rows15m.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length){ out.rows15m = p; out.source = 'binance-paxg'; } }catch(e4){}
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) out.rows1h = q; }catch(e5){}
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length) out.rows4h = z; }catch(e6){}
    }
  }
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
function buildCandidates(leg, now, news, venue, sym){
  var out = [];
  out.rejected = [];
  try{
    var setupsFn = gfn('goldScalpSetups');
    if (setupsFn){
      var got = null;
      try{ got = setupsFn({ rows15m: leg.rows15m, rows1h: leg.rows1h, rows4h: leg.rows4h, now: now, news: news }); }
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

async function runScan(ui){
  if (__scan.busy) return 'busy';
  __scan.busy = true;
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
    var ctx = { now: now, news: news, season: season, macro: null, spot: null, fng: null };
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

    /* leg 1: primary gold feed (getGoldCandles chain -> PAXGUSDT fallback) */
    var gold = await fetchGoldKlines();
    setProg(ui, 0.45);
    if (gold.rows15m.length){
      var v = venueLabel(gold.source);
      var sym1 = (gold.source === 'binance-paxg') ? 'PAXGUSDT' : 'XAUUSDT';
      venueRows[v] = { rows15m: gold.rows15m };
      var got = buildCandidates(gold, now, news, v, sym1);
      collectWatch(gold.rows15m, gold.rows1h, gold.rows4h, v);
      for (i = 0; i < got.length; i++) cands.push(got[i]);
      for (i = 0; i < (got.rejected || []).length; i++) rejectedAll.push(got.rejected[i]);
      legs.push(v + ': ' + gold.rows15m.length + ' 15m bars — '
        + (got.length ? got.length + ' strategy candidate' + (got.length === 1 ? '' : 's') : 'no qualifying confluence'));
    } else {
      legs.push('primary gold feed: no 15m klines from any source (macro chain + PAXGUSDT both failed)');
    }

    /* leg 2: Delta XAUTUSD perp (best-effort second venue) */
    setStat(ui, 'checking Delta XAUTUSD perp…');
    var dx = await fetchDeltaXaut();
    setProg(ui, 0.75);
    if (dx.item && dx.rows15m.length){
      venueRows['DELTA XAUTUSD'] = { rows15m: dx.rows15m };
      var got2 = buildCandidates(dx, now, news, 'DELTA XAUTUSD', 'XAUTUSD');
      collectWatch(dx.rows15m, dx.rows1h, dx.rows4h, 'DELTA XAUTUSD');
      for (i = 0; i < got2.length; i++) cands.push(got2[i]);
      for (i = 0; i < (got2.rejected || []).length; i++) rejectedAll.push(got2.rejected[i]);
      legs.push('DELTA XAUTUSD: ' + dx.rows15m.length + ' 15m bars — '
        + (got2.length ? got2.length + ' strategy candidate' + (got2.length === 1 ? '' : 's') : 'no qualifying confluence'));
    } else if (dx.item){
      legs.push('DELTA XAUTUSD: listed but candles unavailable');
    } else {
      legs.push(gfn('xuUniverse') ? 'DELTA XAUTUSD: not listed in the cross-venue universe' : 'DELTA XAUTUSD: xuniverse layer not loaded');
    }

    /* ranking: transparent confluence tally across ALL venues */
    var ranked = cands, best = null;
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

    /* MOST PROBABLE = first non-demoted, non-vetoed candidate (may be null —
       an honest 'nothing leads' when every setup is gate-demoted) */
    best = null;
    for (i2 = 0; i2 < ranked.length; i2++){
      var bc = ranked[i2];
      if (bc && !bc.demoted && !bc.vetoed){ best = bc; break; }
    }
    if (lock.transitions.length){
      legs.push(lock.transitions.length + ' conviction' + (lock.transitions.length === 1 ? '' : 's')
        + ' closed (' + lock.transitions.map(function(t){ return t.status; }).join(', ').toLowerCase() + ')');
    }
    var liveN = 0;
    for (var k in lock.store.live){ if (Object.prototype.hasOwnProperty.call(lock.store.live, k)) liveN++; }

    /* WHY SILENT — the honest lead reason when zero candidates qualify.
       Session context for the killzone case (same goldKillzone the gates use). */
    var whySilent = null;
    if (!cards.length){
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
        feedsFailed: !gold.rows15m.length && !dx.rows15m.length,
        kzWeight: kzW, kzLabel: kzL,
        liveN: liveN, armed: armedAll, watchMeta: watchMeta
      });
    }

    /* render */
    if (ui && ui.cards && ui.empty){
      if (cards.length){
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = bannerHTML(best, cards)
          + cards.map(function(c){ return cardHTML(c, !!(best && c.id === best.id), season && season.note); }).join('')
          + formingNowHTML(armedAll)
          + rejectedHTML(rejectedAll)
          + historyHTML(lock.store.history);
      } else if (rejectedAll.length || armedAll.length){
        /* zero qualifying candidates but something to show: WHY SILENT leads,
           then the watch panel, then the held-back reason lines */
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = (whySilent ? whySilentHTML(whySilent) : '')
          + formingNowHTML(armedAll)
          + rejectedHTML(rejectedAll)
          + historyHTML(lock.store.history);
      } else {
        /* literally nothing (feeds failed): the empty state carries the reason */
        ui.cards.innerHTML = '';
        if (whySilent) ui.empty.innerHTML = '<b>WHY SILENT</b> — ' + esc(whySilent);
        ui.empty.style.display = 'block';
      }
    }
    var secs = ((Date.now() - t0)/1000).toFixed(1);
    setStat(ui, legs.join(' · ') + ' · ' + liveN + ' live conviction' + (liveN === 1 ? '' : 's')
            + ' · ' + secs + 's · ' + new Date().toISOString().slice(11, 19) + ' UTC',
            !gold.rows15m.length && !dx.rows15m.length);
    setProg(ui, null);
    if (gold.rows15m.length || dx.rows15m.length){
      publishState(cards);                        /* only a real data run overwrites the snapshots */
      publishScan(cards, best, lock.store.history, now, rejectedAll, armedAll, whySilent);
    }
    return 'refreshed';
  }catch(e){
    setStat(ui, 'scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    __scan.busy = false;
    __scan.hasRun = true;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
    setProg(ui, null);
  }
}

/* ---------------- mount / refresh / warm-up ---------------- */
function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<style>' + GS_CSS + '</style>'
      + '<div class="panel">'
      + '<h2>GOLD SCALP <span>multi-strategy SMC/ICT engine · 15m execution · 1H/4H context · conviction-locked levels</span></h2>'
      + '<div class="row"><button class="btn" id="gsRun">RUN SCAN</button>'
      + '<span class="note" id="gsStat">idle — composes per-strategy candidates on 15m/1h/4h, ranks them by a transparent tally, and locks issued levels.</span></div>'
      + '<div class="note" style="margin-top:8px">Desk note: gold respects levels. The engine composes ONE candidate per '
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
      + '— every gate names its reason on the card or on a held-back line below.</div>'
      + '<div class="prog" id="gsProg"><i></i></div>'
      + '</div>'
      + '<div class="cards" id="gsCards"></div>'
      + '<div class="empty" id="gsEmpty" style="display:none">no A-grade confluence right now — gold respects levels; wait for the sweep.</div>';

    var ui = {
      btn:   el.querySelector('#gsRun'),
      stat:  el.querySelector('#gsStat'),
      prog:  el.querySelector('#gsProg'),
      cards: el.querySelector('#gsCards'),
      empty: el.querySelector('#gsEmpty')
    };
    __scan.ui = ui;

    var missing = [];
    if (!gfn('goldScalpSetups') && !gfn('goldScalpSetup')) missing.push('goldScalpSetups/goldScalpSetup (goldind.js)');
    if (!gfn('getGoldCandles') && !gfn('binanceKlines')) missing.push('gold klines (macro.js getGoldCandles / binance.js binanceKlines)');
    if (missing.length) setStat(ui, 'missing: ' + missing.join(', ') + ' — check script load order.', true);

    if (ui.btn) ui.btn.addEventListener('click', function(){ return runScan(ui); });
  }catch(e){ /* never throw at mount */ }
}

async function goldscalpRefresh(){
  try{
    if (__scan.busy) return 'busy';
    if (!__scan.hasRun || !__scan.ui) return 'skipped: not run yet';
    return await runScan(__scan.ui);
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
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldscalp', label: 'GOLD SCALP', mount: mount, refresh: goldscalpRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldscalp', label: 'GOLD SCALP', run: gsWarm });
})();
