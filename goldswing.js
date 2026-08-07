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
1.5R / 2.5R / 4R. News windows never veto minting at swing horizon (the
entry zone persists for days) — they cost -2 tally and carry a NEWS-FADE
stamp instead.

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

var SRC_LABEL = { 'binance-xau': 'BINANCE XAUUSDT', 'binance-paxg': 'BINANCE PAXGUSDT',
                  'twelvedata': 'TWELVE DATA XAU/USD', 'yahoo': 'YAHOO GC=F' };
function venueLabel(src){ return SRC_LABEL[src] || 'PAXGUSDT · BINANCE'; }

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
    rr3: (risk > 0 && isFinite(rec.t3)) ? Math.abs(rec.t3 - rec.entry) / risk : NaN
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
+ '#tab_goldswing .gsw-banner{position:relative;border-radius:12px;padding:3px;margin:16px 0 18px;'
+ 'background:linear-gradient(120deg,#A67C12,#E8B42A 25%,#059669 50%,#C9921A 75%,#A67C12);'
+ 'box-shadow:0 12px 32px -12px rgba(5,150,105,.22)}'
+ '#tab_goldswing .gsw-banner-in{background:linear-gradient(180deg,#FFFFFF,#F8FAFC);border-radius:10px;padding:16px 18px;color:#020617}'
+ '#tab_goldswing .gsw-eye{font-size:10px;letter-spacing:.3em;color:#A67C12;font-weight:800}'
+ '#tab_goldswing .gsw-dir{font-family:var(--disp,inherit);font-size:26px;font-weight:800;letter-spacing:.06em;margin-top:4px}'
+ '#tab_goldswing .gsw-dir.long{color:#047857;text-shadow:none}'
+ '#tab_goldswing .gsw-dir.short{color:#B91C1C;text-shadow:none}'
+ '#tab_goldswing .gsw-dir span{display:block;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.14em;color:#334155;margin-top:4px}'
+ '#tab_goldswing .gsw-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0 4px}'
+ '#tab_goldswing .gsw-plan>div{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:9px 11px}'
+ '#tab_goldswing .gsw-plan i{display:block;font-style:normal;font-size:9px;letter-spacing:.16em;color:#475569;font-weight:700}'
+ '#tab_goldswing .gsw-plan b{display:block;font-size:16px;color:#047857;font-weight:800;margin:3px 0}'
+ '#tab_goldswing .gsw-plan u{text-decoration:none;font-size:10px;color:#334155;opacity:1;font-weight:500;line-height:1.45}'
+ '#tab_goldswing .gsw-why{font-size:11px;margin-top:8px;color:#334155;font-weight:600}'
+ '#tab_goldswing .gsw-why b{color:#A67C12;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '#tab_goldswing .gsw-tally{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}'
+ '#tab_goldswing .gsw-tp{font-size:9px;letter-spacing:.03em;padding:3px 8px;border-radius:4px;border:1px solid;font-weight:600}'
+ '#tab_goldswing .gsw-tp.pos{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '#tab_goldswing .gsw-tp.neg{color:#B91C1C;border-color:rgba(220,38,38,.40);background:rgba(220,38,38,.08)}'
+ '#tab_goldswing .gsw-inv{font-size:11px;color:#334155;margin-top:8px;line-height:1.55;font-weight:500}'
+ '#tab_goldswing .gsw-inv b{color:#B91C1C;letter-spacing:.12em;font-size:10px;font-weight:800}'
+ '#tab_goldswing .gsw-lock{margin-top:10px;font-size:10px;letter-spacing:.08em;color:#047857;font-weight:600;border-top:1px dashed #BBF7D0;padding-top:8px}'
+ '#tab_goldswing .gsw-lock.new{color:#475569}'
+ '#tab_goldswing .gsw-card.long{border-left:4px solid #059669;background:linear-gradient(180deg,rgba(5,150,105,.06),transparent 42%),#FFFFFF}'
+ '#tab_goldswing .gsw-card.short{border-left:4px solid #DC2626;background:linear-gradient(180deg,rgba(220,38,38,.05),transparent 42%),#FFFFFF}'
+ '#tab_goldswing .gsw-card.best{box-shadow:0 0 0 2px rgba(5,150,105,.35),0 12px 28px -14px rgba(5,150,105,.18)}'
+ '#tab_goldswing .gsw-strat{color:#A67C12;font-size:10px;font-weight:800;letter-spacing:.12em}'
+ '#tab_goldswing .gsw-grade{font-weight:800}'
+ '#tab_goldswing .gsw-grade.A{color:#047857}'
+ '#tab_goldswing .gsw-grade.B{color:#0891B2}'
+ '#tab_goldswing .gsw-grade.C{color:#475569}'
+ '#tab_goldswing .gsw-tallynum{font-weight:800}'
+ '#tab_goldswing .gsw-tallynum.up{color:#047857}'
+ '#tab_goldswing .gsw-tallynum.dn{color:#B91C1C}'
+ '#tab_goldswing .gsw-lockline{font-size:9px;color:#047857;letter-spacing:.1em;margin-top:6px;font-weight:700}'
+ '#tab_goldswing .gsw-whyline{font-size:11px;color:#020617;margin-top:8px;line-height:1.6;font-weight:500}'
+ '#tab_goldswing .gsw-invline{font-size:10px;color:#334155;margin-top:5px;line-height:1.55;font-weight:500}'
+ '#tab_goldswing .gsw-invline b{color:#B91C1C;letter-spacing:.08em;font-weight:800}'
+ '#tab_goldswing .gsw-hist{margin-top:18px}'
+ '#tab_goldswing .gsw-hhead{font-size:10px;letter-spacing:.2em;color:#475569;margin-bottom:6px;font-weight:700}'
+ '#tab_goldswing .gsw-hrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_goldswing .gsw-hrow.stopped{border-left-color:#DC2626}'
+ '#tab_goldswing .gsw-hrow.target{border-left-color:#059669}'
+ '#tab_goldswing .gsw-hrow.expired{border-left-color:#A67C12}'
+ '#tab_goldswing .gsw-hrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '#tab_goldswing .gsw-hrow.rej{border-left-color:#EA580C}'
+ '#tab_goldswing .gsw-wrow{font-size:10px;padding:6px 10px;border-left:3px solid #E2E8F0;margin-bottom:4px;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_goldswing .gsw-wrow b{letter-spacing:.08em;font-weight:700;color:#020617}'
+ '#tab_goldswing .gsw-wrow.armed{border-left-color:#059669;color:#020617;background:rgba(5,150,105,.05)}'
+ '#tab_goldswing .gsw-wst{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '#tab_goldswing .gsw-wrow.armed .gsw-wst{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '#tab_goldswing .gsw-wrow.idle .gsw-wst{color:#475569;border-color:#E2E8F0;background:#F8FAFC}'
+ '#tab_goldswing .gsw-silent{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:9px 11px;margin:12px 0;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '#tab_goldswing .gsw-silent b{letter-spacing:.12em;font-weight:800;color:#9A3412}';

/* ---------------- renderers ---------------- */
function tallyChips(c){
  if (!Array.isArray(c.tallyParts) || !c.tallyParts.length) return '';
  return '<div class="gsw-tally">' + c.tallyParts.map(function(p){
    if (!p) return '';
    return '<span class="gsw-tp ' + (p.pts >= 0 ? 'pos' : 'neg') + '">' + (p.pts >= 0 ? '+' : '') + p.pts + ' · ' + esc(p.label) + '</span>';
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
    ? '<span class="gsw-tallynum ' + (c.tally >= 0 ? 'up' : 'dn') + '">tally ' + (c.tally > 0 ? '+' : '') + c.tally + '</span>' : '';
  var lockLine = c.locked
    ? '<div class="gsw-lockline">⬤ CONVICTION LOCK — levels as of ' + esc(c.asOf || '') + ' (restored verbatim)</div>'
    : '<div class="gsw-lockline" style="color:#475569">○ new conviction issued ' + esc(c.asOf || '') + '</div>';
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
  return '<div class="card gsw-card ' + c.dir + (isBest ? ' best' : '') + '">'
    + '<div class="chead"><span class="sym">' + esc(c.venue) + '</span>'
    + '<span class="dir">' + dirUp + ' · <span class="gsw-grade ' + esc(c.grade) + '">GRADE ' + esc(c.grade) + '</span></span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(c.sym, c.dir, { scanner: 'goldswing', strategy: 'goldswing', klass: 'metals', fund: 'gold' }) : '')
    + '</div>'
    + '<div class="gsw-strat">' + esc(c.strategy) + (isBest ? ' · ★ MOST PROBABLE' : '') + '</div>'
    + '<div class="mini">'
    + '<span class="k">venue</span><span>' + esc(c.venue) + (c.sym ? ' · ' + esc(c.sym) : '') + '</span>'
    + '<span class="k">reads</span><span>' + c.reads.long + ' long / ' + c.reads.short + ' short · ' + tallyNum + '</span>'
    + '<span class="k">session</span><span>' + esc(c.session || 'n/a') + ' (context — swing entries are not session-gated)</span>'
    + '<span class="k">ATR14 4h</span><span>' + pxF(c.atr) + '</span>'
    + '<span class="k">R:R</span><span>1 : ' + fmtF(c.rr, 1) + ' (T1) · 1 : ' + fmtF(c.rr2, 1) + ' (T2) · 1 : ' + fmtF(c.rr3, 1) + ' (T3)</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ' + gradeCls + '">GRADE ' + c.grade + '</span>'
    + chips
    + '</div>'
    + tallyChips(c)
    + '<div class="plan">' + (c.dir === 'long' ? 'BUY' : 'SELL') + ' <b>$' + pxF(c.zone ? c.zone.lo : c.entry) + '–$' + pxF(c.zone ? c.zone.hi : c.entry) + '</b>'
    + ' · ENTRY <b>$' + pxF(c.entry) + '</b>'
    + ' · STOP <b>$' + pxF(c.stop) + '</b>'
    + ' · TP1 <b>$' + pxF(c.t1) + '</b> (' + fmtF(c.rr, 1) + 'R)'
    + ' · TP2 <b>$' + pxF(c.t2) + '</b> (' + fmtF(c.rr2, 1) + 'R)'
    + ' · TP3 <b>$' + pxF(c.t3) + '</b> (' + fmtF(c.rr3, 1) + 'R)'
    + '</div>'
    + (c.why ? '<div class="gsw-whyline">' + esc(c.why) + '</div>' : '')
    + (c.invalidates ? '<div class="gsw-invline"><b>INVALIDATES:</b> ' + esc(c.invalidates) + '</div>' : '')
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
    var st = w.state === 'armed';
    var lvlNum = (typeof w.level === 'number' && isFinite(w.level));
    return '<div class="gsw-wrow ' + (st ? 'armed' : 'idle') + '">'
      + '<span class="gsw-wst">' + (st ? 'ARMED' : 'IDLE') + '</span>'
      + '<b>' + esc(w.strategy || 'SETUP') + '</b>'
      + (w.venue ? ' · ' + esc(w.venue) : '')
      + (lvlNum ? ' · $' + pxF(w.level) : '')
      + ' — ' + esc(st ? (w.condition || 'watching') : (w.reason || w.condition || 'no trigger in range'))
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

/* ---------------- data legs (each catch-isolated) ---------------- */
async function fetchGoldKlines(){
  var out = { rows4h: [], rows1d: [], source: null };
  var ggc = gfn('getGoldCandles');
  if (ggc){
    try{ var a = await ggc('4h', KL_4H); if (a && a.rows && a.rows.length){ out.rows4h = a.rows; out.source = a.source; } }catch(e){}
    try{ var b = await ggc('1d', KL_1D); if (b && b.rows && b.rows.length){ out.rows1d = b.rows; if (!out.source) out.source = b.source; } }catch(e2){}
  }
  if (!out.rows4h.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '4h', KL_4H); if (p && p.length){ out.rows4h = p; out.source = 'binance-paxg'; } }catch(e3){}
      try{ var q = await bk('PAXGUSDT', '1d', KL_1D); if (q && q.length) out.rows1d = q; }catch(e4){}
    }
  }
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
  macro:    'MACRO-ALIGNED TREND CONTINUATION'
};
var SW_NEWS_STAMP = 'NEWS WINDOW — expect a fade around the release; swing levels unchanged (size accordingly)';

/* swing risk model: stop 1.5-2x ATR14(4h), never tighter, extended beyond
   the structure when wider (capped 2x); targets fixed at 1.5R / 2.5R / 4R. */
function __swLevels(dir, entry, a4, structStop){
  var stopDist = 1.5*a4, stopNote = 'stop 1.5×ATR14(4h)';
  if (isFinite(structStop)){
    var d = (dir === 'long') ? (entry - structStop) : (structStop - entry);
    if (d > 0){
      var want = d + 0.25*a4;
      if (want > 2*a4) want = 2*a4;
      if (want > stopDist){
        stopDist = want;
        stopNote = 'stop beyond structure ' + structStop.toFixed(2) + ' (' + (stopDist/a4).toFixed(2) + '×ATR14(4h), capped 2×)';
      }
    }
  }
  var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
  var risk = stopDist;
  var gT1 = (typeof HG_GOLD_T1_R === 'number') ? HG_GOLD_T1_R : 1.5;
  var gT2 = (typeof HG_GOLD_T2_R === 'number') ? HG_GOLD_T2_R : 2.5;
  var gT3 = (typeof HG_GOLD_T3_R === 'number') ? HG_GOLD_T3_R : 4.0;
  return { stop: stop,
           t1: (dir === 'long') ? entry + gT1*risk : entry - gT1*risk,
           t2: (dir === 'long') ? entry + gT2*risk : entry - gT2*risk,
           t3: (dir === 'long') ? entry + gT3*risk : entry - gT3*risk,
           rr: gT1, rr2: gT2, rr3: gT3, stopNote: stopNote, targetPolicy: 'gold ladder ' + gT1 + 'R/' + gT2 + 'R/' + gT3 + 'R' };
}

/* per-venue candidate composition. Every detector is feature-checked and
   read-only; triggers without enough agreement ride the .rejected side-
   channel with the reason named. */
function buildCandidates(leg, nowMs, newsC, macro, sessionTxt, venue, sym){
  var out = [];
  out.rejected = [];
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
    var ms4 = null, obRetest4 = null;
    var engFn = gfn('HardgateGoldEngine');
    if (engFn && typeof engFn.evaluateSwing === 'function'){
      try{
        var swingEval = engFn.evaluateSwing(rows4, { atr4: a4, nearestStructure: null, entry: entry });
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
        var lv = __swLevels(dir, entry, a4, structStop);
        if (lv.rr < 1.2){
          return { dropped: true, id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
                   venue: venue, sym: sym,
                   reason: 'structure too close — R:R insufficient (' + lv.rr.toFixed(1) + 'R < 1.2R minimum)' };
        }
        var grade = (L.mine.length >= 5) ? 'A' : ((L.mine.length >= 3) ? 'B' : 'C');
        if (newsC && newsC.caution) grade = (grade === 'A') ? 'B' : 'C';
        var conf = [];
        for (var j = 0; j < L.mine.length; j++) conf.push(L.mine[j].label);
        return {
          id: id, strategy: SW_NAME[key], stratKey: key, dir: dir,
          entry: entry, stop: lv.stop, t1: lv.t1, t2: lv.t2, t3: lv.t3,
          rr: lv.rr, rr2: lv.rr2, rr3: lv.rr3,
          grade: grade, confluence: conf, agree: L.mine.length, oppose: L.oppose,
          reads: L.counts,
          session: sessionTxt || 'n/a',
          newsCaution: !!(newsC && newsC.caution),
          newsStamp: (newsC && newsC.caution) ? SW_NEWS_STAMP + (newsC.title ? ' (' + newsC.title + ')' : '') : null,
          atr: a4, anchor: anchor,
          zone: zone || { lo: entry - 0.25*a4, hi: entry + 0.25*a4 },
          why: why, invalidates: invalidates,
          notes: notes.concat([lv.stopNote]),
          venue: venue, sym: sym
        };
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
  var t0 = Date.now();
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    if (ui && ui.cards) ui.cards.innerHTML = '';
    if (ui && ui.empty) ui.empty.style.display = 'none';
    setProg(ui, 0);
    if (!gfn('getGoldCandles') && !gfn('binanceKlines')){
      setStat(ui, 'gold klines layer missing — macro.js getGoldCandles / binance.js binanceKlines not loaded (check script order).', true);
      return 'error: no klines layer';
    }

    setStat(ui, 'pulling gold klines 4h/1d…');
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
                fundingRate: null, style: 'goldswing' };
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

    /* leg 1: primary gold feed (getGoldCandles chain -> PAXGUSDT fallback) */
    var gold = await fetchGoldKlines();
    setProg(ui, 0.45);
    if (gold.rows4h.length){
      var v = venueLabel(gold.source);
      var sym1 = (gold.source === 'binance-paxg') ? 'PAXGUSDT' : 'XAUUSDT';
      venueRows[v] = { rows4h: gold.rows4h };
      var got = buildCandidates(gold, now, newsC, ctx.macro, sessionTxt, v, sym1);
      collectWatch(gold, v);
      for (i = 0; i < got.length; i++) cands.push(got[i]);
      for (i = 0; i < (got.rejected || []).length; i++) rejectedAll.push(got.rejected[i]);
      legs.push(v + ': ' + gold.rows4h.length + ' 4h bars — '
        + (got.length ? got.length + ' strategy candidate' + (got.length === 1 ? '' : 's') : 'no qualifying confluence'));
    } else {
      legs.push('primary gold feed: no 4h klines from any source (macro chain + PAXGUSDT both failed)');
    }

    /* leg 2: Delta XAUTUSD perp (best-effort second venue) */
    setStat(ui, 'checking Delta XAUTUSD perp…');
    var dx = await fetchDeltaXaut();
    setProg(ui, 0.75);
    if (dx.item && dx.rows4h.length){
      venueRows['DELTA XAUTUSD'] = { rows4h: dx.rows4h };
      var got2 = buildCandidates(dx, now, newsC, ctx.macro, sessionTxt, 'DELTA XAUTUSD', 'XAUTUSD');
      collectWatch(dx, 'DELTA XAUTUSD');
      for (i = 0; i < got2.length; i++) cands.push(got2[i]);
      for (i = 0; i < (got2.rejected || []).length; i++) rejectedAll.push(got2.rejected[i]);
      legs.push('DELTA XAUTUSD: ' + dx.rows4h.length + ' 4h bars — '
        + (got2.length ? got2.length + ' strategy candidate' + (got2.length === 1 ? '' : 's') : 'no qualifying confluence'));
    } else if (dx.item){
      legs.push('DELTA XAUTUSD: listed but candles unavailable');
    } else {
      legs.push(gfn('xuUniverse') ? 'DELTA XAUTUSD: not listed in the cross-venue universe' : 'DELTA XAUTUSD: xuniverse layer not loaded');
    }

    /* ranking: transparent confluence tally across ALL venues */
    var rk = rankSetups(cands, ctx);
    var ranked = rk.ranked, best = rk.best;
    for (i = 0; i < (rk.rejected || []).length; i++) rejectedAll.push(rk.rejected[i]);

    /* CONVICTION LOCK — restore issued levels verbatim; transitions only on
       invalidation against the latest 4h close (STOPPED / TARGET HIT /
       EXPIRED after 5 days); never re-pick levels for a live conviction */
    var lock = applyConviction(ranked, venueRows, now);

    var display = mergeLiveDisplayCards(ranked, lock.store);
    var displayBest = best;
    if (!displayBest && display.length) displayBest = display[0];
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
        feedsFailed: !gold.rows4h.length && !dx.rows4h.length,
        liveN: liveN, armed: armedAll, watchMeta: watchMeta
      });
    }

    /* render */
    if (ui && ui.cards && ui.empty){
      if (display.length){
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = bannerHTML(displayBest, display)
          + display.map(function(c){ return cardHTML(c, !!(displayBest && c.id === displayBest.id), season && season.note); }).join('')
          + formingNowHTML(armedAll)
          + rejectedHTML(rejectedAll)
          + historyHTML(lock.store.history);
      } else if (rejectedAll.length || armedAll.length){
        /* zero qualifying candidates but something to show: WHY SILENT leads,
           then the watch panel, then the held-back reason lines */
        ui.empty.style.display = 'none';
        ui.cards.innerHTML = (whySilent ? whySilentHTML(whySilent) : '')
          + rejectedHTML(rejectedAll)
          + formingNowHTML(armedAll)
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
            !gold.rows4h.length && !dx.rows4h.length);
    setProg(ui, null);
    if (gold.rows4h.length || dx.rows4h.length){
      publishState(display);                        /* only a real data run overwrites the snapshots */
      publishScan(display, displayBest, lock.store.history, now, rejectedAll, armedAll, whySilent);
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
      + '<div id="' + p + 'Desk"></div>'
      + '<div class="cards" id="' + p + 'Cards"></div>'
      + '<div class="empty" id="' + p + 'Empty" style="display:none">' + emptyMsg + '</div>';

    var ui = {
      btn:   el.querySelector('#' + p + 'Run'),
      stat:  el.querySelector('#' + p + 'Stat'),
      prog:  el.querySelector('#' + p + 'Prog'),
      cards: el.querySelector('#' + p + 'Cards'),
      empty: el.querySelector('#' + p + 'Empty')
    };
    scanSt.ui = ui;

    var missing = [];
    if (!gfn('getGoldCandles') && !gfn('binanceKlines')) missing.push('gold klines (macro.js getGoldCandles / binance.js binanceKlines)');
    if (!gfn('goldSweeps') && !gfn('goldOrderBlocks') && !gfn('goldFVG') && !gfn('goldVWAP'))
      missing.push('goldind.js detectors (sweep/OB/FVG/VWAP evidence offline — trend-pullback, weekly-range and macro strategies still run on local math)');
    if (missing.length) setStat(ui, 'missing: ' + missing.join(', ') + '.', true);

    if (ui.btn) ui.btn.addEventListener('click', function(){ return runScan(ui, scanSt); });
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

async function goldswingRefresh(){
  try{
    if (__scan.busy) return 'busy';
    if (!__scan.hasRun || !__scan.ui) return 'skipped: not run yet';
    return await runScan(__scan.ui, __scan);
  }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
}

/* BRAIN warm-up hook — headless scan against inert stub elements (oiflow.js
   oiflowWarm pattern). Shares __scan.busy with the mounted scan. Never throws. */
function __gwWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
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
    subheading: 'same engine as the GOLD SWING tab · XAU feeds via STAR TRADER routing',
    statIdle: 'idle — 4h/1d multi-strategy swing engine (identical logic to the GOLD SWING tab)',
    showDeskNote: false,
    deskKind: 'goldswing',
    deskTab: 'STAR TRADER · GOLD SWING'
  }, opts));
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldswing', label: 'GOLD SWING', mount: mount, refresh: goldswingRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldswing', label: 'GOLD SWING', run: gwWarm });
})();
