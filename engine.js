/* =========================================================================
HARDGATE — engine.js
EXECUTE tab: the MASTER GATE ENGINE. Answers the only question that matters:
"should I go long or short, and exactly where do I enter, stop, and take
profit." Philosophy: GATES, NOT SCORES — a single VETO kills the trade and
every card shows its full PASS/VETO/N-A trail. Conviction is a count of
gates passed (STRONG = 6/6, MODERATE = 4-5/6), never a fabricated number.

THE 6-STAGE FUNNEL (pure: gateCandidate(inp) -> {pass, dir, trail, plan}):
  G0 UNIVERSE      symbol + >=210 4h bars (EMA200 warmup). Stage-0 precedence
                   (first available wins): (1) fresh scanner results (existing
                   contract below) -> (2) window.xuUniverse() COMBINED Delta
                   India + CoinDCX futures list (ALL contracts, deduplicated
                   by base asset, NO count cap — liquidity is enforced by G4,
                   never by silent truncation) -> (3) Binance top-24 USDT
                   perps by 24h turnover (legacy fallback).
  G1 STRUCTURE     4H EMA9/21/50 cascade -> dir (mixed = chop veto), spread
                   |E21-E50| >= 0.25xATR (anti-chop), close vs EMA200 (HTF
                   side). Optional window.hgStructure(rows4h) ->
                   {dir,bos,choch}: CHoCH against the cascade VETOES,
                   agreeing BOS strengthens the note. Mirrors swing G1/G2.
  G2 MOMENTUM      RSI14 extreme veto (long >70 / short <30), volZ(20) > 0.5,
                   close-position-in-bar >= 0.60 long / <= 0.40 short.
                   Mirrors swing G3/G5.
  G3 POSITIONING   funding: |fr| >= 0.05%/8h veto; long && fr >= +0.04 veto;
                   short && fr <= -0.04 veto (mirrors swing G4). Then
                   window.smartClassify({chg24,oiChgPct,fundingPct,
                   retailLongPct,topLongPct,takerRatio}) when present: an
                   opposing majority with score >= 2 VETOES; agreement
                   strengthens. Both legs missing => N/A, never fabricated.
  G4 LIQUIDITY/VOL ATR(4h) sanity (0.05%..25% of price), 24h turnover floor
                   (gateCandidate default $10M; the EXECUTE tab's MIN TURNOVER
                   select — $0.5M/$1M/$10M/$50M, default $1M — overrides it at
                   scan time via inp.minTurnover; CoinDCX turnover UNKNOWN =
                   never auto-vetoed: G4 passes with 'turnover unverified —
                   size down' and the suggested risk fraction is halved),
                   price <= 1.5xATR from EMA21 (anti-chase anchor, mirrors
                   swing).
  G5 NEWS RISK     inp.news or window.hgNewsRisk(sym) ->
                   {blackout|veto:true, event, until} VETOES with the event
                   name shown. Module absent => N/A with an honest note.

COMBINED-UNIVERSE CONTRACT (xuniverse.js, feature-checked — when absent the
engine behaves EXACTLY as before: scanner results, else Binance top-24):
  window.xuUniverse(force) -> Promise<[ { sym, base, exchange, turnoverUsd,
                   mark, fundingPct, alsoOn } ]> — every Delta India + CoinDCX
                   futures contract, deduped by base asset. exchange is
                   normalized to 'delta' | 'cdcx' ('coindcx' accepted).
  window.xuCandles(item, tf, n) -> Promise<rows> — candle rows for THAT item
                   (exchange-aware symbol routing lives inside xuniverse.js);
                   window.getCandles(sym, tf, n) is the fallback when
                   xuCandles is absent or returns nothing. Rows are sanitized
                   to {t,o,h,l,c,v} numbers, time-sorted, still-forming bar
                   dropped (gates only ever see closed candles).
  STAGED FETCHING (the combined list can run 300-600 symbols): only 4h
  candles are fetched up front; gateCandidate runs the cheap G0-G2 gates
  (structure + momentum need nothing else); 1h candles are fetched ONLY for
  candidates that PASS the full funnel (plan quality) — dead candidates never
  cost a second request. CHUNK concurrency and per-symbol catch isolation
  are unchanged; the progress line reports 'X/Y · delta n · cdcx m · failed
  k' and the WHY ASIDE header tallies rejections per exchange.
  UI CONFIG ROW (EXECUTE tab, persisted in localStorage): VENUE select
  ALL/DELTA/CDCX pre-filters the xu universe (an emptied filter is reported
  honestly, never silently replaced by the Binance fallback) and MIN
  TURNOVER select sets the G4 floor at runtime. window.engineConfig(set?) is
  the pure getter/setter (vm-testable): engineConfig() -> {venue,
  minTurnover}; engineConfig({venue, minTurnover}) merges, validates and
  persists (localStorage 'hgEngineVenue' / 'hgEngineMinTurn', try-caught).

SURVIVORS render as execution cards: big LONG/SHORT verdict, conviction,
ENTRY/STOP/T1/T2 via window.smartSetup, backed by the MANDATORY
window.hgPlanLevels(rows4h) fallback (normalized to type LEVELS with
rr/risk%/confirmed derived, never fabricated) when smartSetup declines —
the combined-mode norm, since null positioning legs make smartClassify
yield cls.dir = null and smartSetup's own guard bow out. Only when the
fallback module is absent or itself fails does the card show the honest
'levels unavailable — size down' block; never a bare card. (smartSetup
absent as a global -> local ATR fallback, vm/standalone only.) R:R,
suggested risk fraction (policy: STRONG 1% / MODERATE 0.5% of equity,
unconfirmed setups halved), and a SEND TO TRADE PLAN button
(window.toTrade, feature-checked). WHY ASIDE lists every rejected
candidate with the exact gate that killed it.

QUICK RESCAN (button beside RUN): reuses the last full scan's cached
universe + verdicts — never a forced universe refetch (the list comes
from xuUniverse(false), cache-served; on failure the cached list is
reused with an honest note). Re-gates ONLY last scan's survivors + new
listings on fresh candles (same staged 4h->1h pipeline); every other
candidate keeps its prior verdict + age. Flipped survivors move to WHY
ASIDE with their new veto; delisted survivors keep their verdict,
flagged. Stat: 'quick rescan: N checked · M unchanged'. The pure target
diff is exported as window.engineQuickTargets.

Scanner-results contract checked in order (first fresh non-empty wins):
  window.HG_oiflowResults / oiflowResults / HG_squeezeResults /
  squeezeResults / HG_smartResults / smartResults / HG_scannerResults
  = ['BTCUSDT', ...] | [{sym|symbol, ...}] | {syms:[...], at:<epochMs>}
  Entries stamped older than 10 minutes are treated as stale and skipped.

Classic script, no build step. Loads AFTER binance.js, indicators.js and the
scanner modules — INTEGRATOR: register engine.js LAST (after oiflow.js,
squeeze.js, strats.js etc.) so Stage-0 can see their published results, and
map the tab: HG_TAB_GROUP['execute'] = 'overview' (suggested). xuniverse.js
is optional — every reference to window.xuUniverse / window.xuCandles is
feature-checked (typeof === 'function') and timeout-wrapped (12s), so the
engine is byte-for-byte the old behavior when the module is missing.
Registers itself via window.HG_tabs.push({id:'execute', label:'EXECUTE',
mount, refresh}). Never throws at load; every optional global is
feature-checked.
No global intervals — the RUN button and the hard-refresh contract are the
only triggers. refresh() (⟳ HARD REFRESH, index.html hardRefreshAll): async,
NEVER throws, returns a terse status string — 'busy' while a scan is running
(overlapping calls never double-fetch), 'skipped: not run yet' before the
first user run (a global refresh must never trigger an expensive first-time
full-universe scan), otherwise it re-runs the same funnel the RUN button
triggers and returns 'refreshed'. tests/test-engine.mjs drives gateCandidate
and the refresh contract with stubbed globals.

BRAIN STATE CONTRACT — after each SUCCESSFUL scan the funnel output is
cached in a module-local snapshot and exposed as window.engineState() for
the BRAIN meta-engine. Zero-arg, NEVER throws (try-catch -> null), returns
null before the first successful scan, otherwise a DEEP-FROZEN deep copy:
  { survivors: [ { sym, dir, conviction, plan: {entry,stop,t1,t2} | null,
                   gatesPassed } ],
    rejected:  [ { sym, vetoGate, dir, gatesPassed } ],
    at: <epochMs> }
rejected rows keep the evidence the funnel already computed: dir = the G1
cascade side that was under evaluation when the veto hit ('long'/'short',
null when the kill came at G0/G1 — before any side was committed), and
gatesPassed = count of fully-passed gates (N/A gates never count).
survivors mirror the execution cards rendered (plan null when the setup
builder declined — direction real, levels not fabricated). An aborted or
failed re-run keeps the PREVIOUS good snapshot with its original `at` —
good data is never replaced by a failed run.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables ---------------- */
var MIN_ROWS_4H      = 210;      // swing-scan history floor (EMA200 warmup)
var MIN_TURNOVER     = 10e6;     // $10M 24h quote turnover floor — gateCandidate DEFAULT when inp.minTurnover is absent
var MAX_UNIVERSE     = 24;       // fallback universe cap (top-N by turnover)
var SCANNER_FRESH_MS = 10*60*1000;
var SPREAD_MIN_ATR   = 0.25;     // |E21-E50| >= 0.25xATR (swing G1)
var VOLZ_MIN         = 0.5;      // volume z floor (swing G5)
var CLOSEPOS_LONG    = 0.60;     // close >= 60% up the bar for longs
var CLOSEPOS_SHORT   = 0.40;     // close <= 40% up the bar for shorts
var FUND_HARD        = 0.05;     // |funding %/8h| hard veto (swing G4)
var FUND_DIR         = 0.04;     // funding against dir veto (swing G4)
var ATRPCT_MIN       = 0.05;     // ATR < 0.05% of price = dead book
var ATRPCT_MAX       = 25;       // ATR > 25% of price = untradeable
var ANCHOR_MAX_ATR   = 1.5;      // max distance from EMA21 in ATRs (swing)
var CHUNK            = 6;
var CHUNK_SLEEP_MS   = 100;
var ASIDE_MAX        = 40;
var XU_TIMEOUT_MS    = 12000;    // xuUniverse() / xuCandles() abort budget

/* EXECUTE-tab config row (venue + min-turnover), persisted in localStorage.
   Scan-time defaults: venue ALL, G4 floor $1M (the long tail is judged by
   structure first; G4 still vetoes verified-illiquid picks with the reason
   shown). gateCandidate itself keeps the $10M default when no per-call
   minTurnover is supplied — purity preserved for direct/vm callers. */
var LS_VENUE         = 'hgEngineVenue';
var LS_TURN          = 'hgEngineMinTurn';
var CFG_DEFAULTS     = { venue: 'all', minTurnover: 1000000 };
var __cfg            = { venue: CFG_DEFAULTS.venue, minTurnover: CFG_DEFAULTS.minTurnover };

var GATES = [ ['G0','UNIVERSE'], ['G1','STRUCTURE'], ['G2','MOMENTUM'],
              ['G3','POSITIONING'], ['G4','LIQUIDITY/VOL'], ['G5','NEWS RISK'] ];

/* ---------------- formatters: reuse index.html helpers when present ---------------- */
function _fmtFb(n, d){ d = (d === undefined) ? 2 : d; return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
function _pxFb(n){ if (n === null || n === undefined || !isFinite(n)) return '—'; var a = Math.abs(n); var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8; return Number(n).toLocaleString('en-US', { maximumFractionDigits: d }); }
function _pctFb(n, d){ d = (d === undefined) ? 3 : d; return isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) + '%' : '—'; }
var PX    = (typeof px    === 'function') ? px    : _pxFb;
var FMT   = (typeof fmt   === 'function') ? fmt   : _fmtFb;
var PCT   = (typeof pct   === 'function') ? pct   : _pctFb;
var SLEEP = (typeof sleep === 'function') ? sleep : function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

function __last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }
function n2(x, d){ d = (d === undefined) ? 2 : d; return isFinite(x) ? Number(x).toFixed(d) : 'n/a'; }
function sp(x, d){ d = (d === undefined) ? 2 : d; return isFinite(x) ? (x >= 0 ? '+' : '') + Number(x).toFixed(d) : 'n/a'; }
function numOrNull(x){ return (typeof x === 'number' && isFinite(x)) ? x : null; }
function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* $ formatting for floors/turnovers that can dip below $1M (9e6 -> '9M',
   2.5e6 -> '2.5M', 4e5 -> '400k') — keeps G4 reasons readable at any floor. */
function moneyM(x){ x = +x; if (!isFinite(x)) return 'n/a'; var m = x/1e6;
  if (m >= 1){ var r = Math.round(m*10)/10; return n2(r, (r === Math.round(r)) ? 0 : 1) + 'M'; }
  return n2(Math.round(x/1e3), 0) + 'k'; }

/* Abort budget for external xu* legs: resolves to `fallback` after ms unless
   the promise settles first. Never rejects — pairs with leg() isolation. */
function raceTimeout(p, ms, fallback){
  return new Promise(function(res){
    var done = false;
    var t = setTimeout(function(){ if (!done){ done = true; res(fallback); } }, ms);
    Promise.resolve(p).then(
      function(v){ if (!done){ done = true; clearTimeout(t); res(v); } },
      function(){ if (!done){ done = true; clearTimeout(t); res(fallback); } });
  });
}

/* ---------------- EXECUTE config (venue + min-turnover) ----------------
   Pure getter/setter, exported as window.engineConfig. getCfg() overlays
   localStorage on the module vars on every read so a stored choice survives
   reloads and direct storage edits are honored at the next scan. */
function getCfg(){
  var c = { venue: __cfg.venue, minTurnover: __cfg.minTurnover };
  try{
    if (typeof localStorage !== 'undefined' && localStorage){
      var v = localStorage.getItem(LS_VENUE);
      if (v === 'all' || v === 'delta' || v === 'cdcx') c.venue = v;
      var t = parseFloat(localStorage.getItem(LS_TURN));
      if (isFinite(t) && t > 0) c.minTurnover = t;
    }
  }catch(e){ /* storage blocked -> module defaults */ }
  return c;
}
function engineConfig(set){
  try{
    if (set && typeof set === 'object'){
      if (set.venue === 'all' || set.venue === 'delta' || set.venue === 'cdcx') __cfg.venue = set.venue;
      var t = numOrNull(set.minTurnover);
      if (t !== null && t > 0) __cfg.minTurnover = t;
      try{
        if (typeof localStorage !== 'undefined' && localStorage){
          localStorage.setItem(LS_VENUE, __cfg.venue);
          localStorage.setItem(LS_TURN, String(__cfg.minTurnover));
        }
      }catch(e){ /* persistence best-effort */ }
    }
    var c = getCfg();
    return { venue: c.venue, minTurnover: c.minTurnover };
  }catch(e){ return { venue: CFG_DEFAULTS.venue, minTurnover: CFG_DEFAULTS.minTurnover }; }
}

/* gateRow markup — reuse the global from index.html when present so the
   ledger looks identical everywhere; local copy keeps the module standalone
   (and testable) when it is not. state: 'pass'|'veto'|'na'. */
function gateRowHTML(id, name, state, detail){
  if (typeof gateRow === 'function'){
    try{ return gateRow(id, name, state, detail); }catch(e){ /* fall through to local */ }
  }
  return '<div class="lrow"><span class="gid">' + esc(id) + '</span><span class="gname">' + esc(name) + '</span>'
    + '<span class="gdetail">' + (detail || '') + '</span>'
    + '<span class="stamp ' + state + '">' + (state === 'pass' ? 'PASS' : state === 'veto' ? 'VETO' : 'N/A') + '</span></div>';
}
function trailState(ok){ return ok === true ? 'pass' : (ok === false ? 'veto' : 'na'); }

/* =========================================================================
PLAN BUILDERS
========================================================================= */
/* 4h EMA20/50 cascade agreement — the `confirmed` flag shared by every
   plan builder (smartSetup computes its own; the fallbacks use this). */
function planConfirmed(dir, rows4h){
  try{
    if (typeof ema !== 'function' || !rows4h || rows4h.length < 60) return false;
    var c4 = rows4h.map(function(r){ return r.c; });
    var e20 = __last(ema(c4, 20)), e50 = __last(ema(c4, 50));
    return isFinite(e20) && isFinite(e50) && (dir === 'long' ? e20 > e50 : e20 < e50);
  }catch(e){ return false; }
}

/* Local ATR fallback, mirrors oiflow.js: entry = last 4h close, stop =
   1.5xATR14(4h) against dir, T1 = 2R, T2 = 3.5R; confirmed = 4h EMA20/50
   cascade on the side of dir. Null when atr is missing or inputs are bad. */
function atrFallbackPlan(dir, rows4h){
  try{
    if (typeof atr !== 'function' || !rows4h || !rows4h.length) return null;
    var entry = +rows4h[rows4h.length - 1].c;
    var a4 = __last(atr(rows4h, 14));
    if (!isFinite(entry) || entry <= 0 || !isFinite(a4) || a4 <= 0) return null;
    var risk = 1.5 * a4;
    return {
      type: 'ATR', dir: dir, entry: entry,
      stop:   dir === 'long' ? entry - risk     : entry + risk,
      t1:     dir === 'long' ? entry + 2*risk   : entry - 2*risk,
      t2:     dir === 'long' ? entry + 3.5*risk : entry - 3.5*risk,
      rr1: 2, rr2: 3.5, riskPct: risk/entry*100,
      confirmed: planConfirmed(dir, rows4h), note: 'local ATR fallback (smartSetup unavailable)'
    };
  }catch(e){ return null; }
}

/* window.hgPlanLevels (index.html universal fallback) — feature-checked on
   both the bare global and window, exactly like the xu* lookups. */
function hgPlanLevelsFn(){
  if (typeof hgPlanLevels === 'function') return hgPlanLevels;
  if (G && typeof G.hgPlanLevels === 'function') return G.hgPlanLevels;
  if (typeof globalThis !== 'undefined' && typeof globalThis.hgPlanLevels === 'function') return globalThis.hgPlanLevels;
  return null;
}

/* hgPlanLevels returns {dir, entry, stop, t1, t2, risk, note} — normalize it
   into the engine plan shape (type/rr1/rr2/riskPct/confirmed) so downstream
   rendering, sizing and the BRAIN snapshot see one consistent contract. */
function normalizeHgPlan(pl, dir, rows4h){
  if (!pl || typeof pl !== 'object') return null;
  var e = +pl.entry, s = +pl.stop, t1 = +pl.t1, t2 = +pl.t2;
  if (!isFinite(e) || !isFinite(s) || !isFinite(t1) || !isFinite(t2) || e <= 0) return null;
  var risk = Math.abs(e - s);
  if (!(risk > 0)) return null;
  return {
    type: 'LEVELS', dir: dir, entry: e, stop: s, t1: t1, t2: t2,
    rr1: Math.abs(t1 - e)/risk, rr2: Math.abs(t2 - e)/risk, riskPct: risk/e*100,
    confirmed: planConfirmed(dir, rows4h),
    note: (pl.note ? String(pl.note) + ' · ' : '') + 'hgPlanLevels fallback (setup builder declined)'
  };
}

/* Every plan is sanity-checked: stop on the correct side of entry, targets
   beyond entry on the side of dir. */
function sanePlanSides(plan, dir){
  return !!plan && isFinite(plan.entry) && isFinite(plan.stop) && isFinite(plan.t1) && isFinite(plan.t2)
    && (dir === 'long'
        ? (plan.stop < plan.entry && plan.t1 > plan.entry && plan.t2 > plan.entry)
        : (plan.stop > plan.entry && plan.t1 < plan.entry && plan.t2 < plan.entry));
}

/* smartSetup (index.html) first. When it declines (returns null) or throws —
   the combined-mode norm, since the positioning legs are null there so the
   real smartClassify yields cls.dir = null and smartSetup's own guard bows
   out — the window.hgPlanLevels(rows4h) fallback is MANDATORY: a survivor
   card must never render bare. Only when the fallback module is absent or
   itself fails does the plan stay null (the card then shows the honest
   'levels unavailable — size down' block). When smartSetup is absent as a
   global, the local ATR fallback handles it (never happens in the browser —
   index.html defines smartSetup inline — kept for standalone/vm use). */
function buildPlan(dir, cls, rows4h, rows1h){
  if (typeof smartSetup === 'function'){
    var c = cls || { dir: dir, longEv: [], shortEv: [], regime: [], score: 0, total: 0 };
    var plan = null;
    try{ plan = smartSetup(c, rows4h, rows1h) || null; }catch(e){ plan = null; }
    if (plan && sanePlanSides(plan, dir)) return plan;
    var hpl = hgPlanLevelsFn();
    if (hpl){
      var fb = null;
      try{ fb = normalizeHgPlan(hpl(dir, rows4h), dir, rows4h); }catch(e){ fb = null; }
      if (fb && sanePlanSides(fb, dir)) return fb;
    }
    return null;
  }
  var plan2 = atrFallbackPlan(dir, rows4h);
  return (plan2 && sanePlanSides(plan2, dir)) ? plan2 : null;
}

/* Fixed sizing policy (percent of equity), clearly labelled in the UI:
   STRONG conviction 1.0%, MODERATE 0.5%, unconfirmed setups halved. */
function suggestedRiskPct(conviction, plan){
  var base = conviction === 'STRONG' ? 1.0 : 0.5;
  if (plan && plan.confirmed === false) base = base / 2;
  return Math.round(base*100)/100;
}

/* =========================================================================
PURE GATE ENGINE — gateCandidate(inp) -> {pass, dir, trail, plan, ...}
inp = { sym, source, rows4h, rows1h, chg24, turnoverUsd, fundingPct,
        oiChgPct, retailLongPct, topLongPct, takerRatio, news }
Every field nullable; absent optional globals degrade the matching gate to
N/A (or an honest veto for core indicator layers) — never a throw, never a
fabricated pass. trail = 6 entries, one per gate, in G0..G5 order; stages
after the killing veto are {ok:null, note:'not reached'}.
========================================================================= */
function gateCandidate(inp){
  inp = inp || {};
  var trail = [];
  var res = { pass: false, dir: null, trail: trail, plan: null,
              conviction: null, gatesPassed: 0, vetoGate: null, riskPct: null };
  function countTrue(){ var n = 0; for (var i = 0; i < trail.length; i++) if (trail[i].ok === true) n++; return n; }
  function note_(idx, ok, note){ trail.push({ gate: GATES[idx][0], name: GATES[idx][1], ok: ok, note: note }); }
  function skipRest(from){ for (var i = from; i < GATES.length; i++) trail.push({ gate: GATES[i][0], name: GATES[i][1], ok: null, note: 'not reached' }); }
  function die(idx, note){
    note_(idx, false, note);
    skipRest(idx + 1);
    res.vetoGate = GATES[idx][0];
    res.gatesPassed = countTrue();
    return res;
  }

  /* ---------- G0 UNIVERSE ---------- */
  var sym = (typeof inp.sym === 'string' && inp.sym) ? inp.sym : null;
  if (!sym) return die(0, 'no symbol — candidate never entered the funnel');
  var rows4h = (inp.rows4h && inp.rows4h.length) ? inp.rows4h : null;
  if (!rows4h) return die(0, 'no 4h klines (data leg failed) — cannot gate what we cannot see');
  if (rows4h.length < MIN_ROWS_4H)
    return die(0, '4h history thin — ' + rows4h.length + ' bars < ' + MIN_ROWS_4H + ' needed (EMA200 warmup)');
  note_(0, true, sym + ' · ' + rows4h.length + 'x 4h bars' + (inp.source ? ' · ' + inp.source : ''));

  /* ---------- G1 STRUCTURE ---------- */
  var _ema = (typeof ema === 'function') ? ema : null;
  var _atr = (typeof atr === 'function') ? atr : null;
  if (!_ema || !_atr) return die(1, 'indicator layer not loaded (ema/atr missing) — structure unreadable, standing aside');
  var c4 = rows4h.map(function(r){ return +r.c; });
  var p = c4[c4.length - 1];
  if (!isFinite(p) || p <= 0) return die(1, 'bad 4h closes — structure unreadable');
  var e9 = __last(_ema(c4, 9)), e21 = __last(_ema(c4, 21)), e50 = __last(_ema(c4, 50)), e200 = __last(_ema(c4, 200));
  if (!isFinite(e9) || !isFinite(e21) || !isFinite(e50)) return die(1, 'EMA cascade not warmed up');
  var dir = (e9 > e21 && e21 > e50) ? 'long' : ((e9 < e21 && e21 < e50) ? 'short' : null);
  if (!dir) return die(1, 'EMA9/21/50 mixed — chop. Standing aside IS the position.');
  var a4 = __last(_atr(rows4h, 14));
  if (!isFinite(a4) || a4 <= 0) return die(1, 'ATR(4h) not computable — cascade spread cannot be verified');
  var spreadX = Math.abs(e21 - e50)/a4;
  if (spreadX < SPREAD_MIN_ATR)
    return die(1, 'cascade spread ' + n2(spreadX) + 'xATR < ' + SPREAD_MIN_ATR + ' — anti-chop (swing G1)');
  if (!isFinite(e200)) return die(1, 'EMA200 not warmed up');
  if (dir === 'long' && !(p > e200))
    return die(1, 'close below 4H EMA200 — longs need the high-timeframe side (swing G2)');
  if (dir === 'short' && !(p < e200))
    return die(1, 'close above 4H EMA200 — shorts need the high-timeframe side (swing G2)');
  var hsNote = '';
  if (typeof hgStructure === 'function'){
    var hs = null, hsErr = false;
    try{ hs = hgStructure(rows4h); }catch(e){ hsErr = true; }
    if (hsErr) hsNote = ' · hgStructure errored (ignored)';
    else if (hs && typeof hs === 'object'){
      if (hs.choch === true && hs.dir && hs.dir !== dir)
        return die(1, 'CHoCH ' + String(hs.dir).toUpperCase() + ' against the ' + dir.toUpperCase()
                     + ' cascade — structure broken (hgStructure)');
      if (hs.bos === true && hs.dir === dir) hsNote = ' · BOS confirms ' + dir.toUpperCase() + ' (hgStructure)';
      else hsNote = ' · hgStructure: no opposing read';
    }
  }
  res.dir = dir;
  note_(1, true, '4H cascade ' + dir.toUpperCase() + ' · spread ' + n2(spreadX) + 'xATR · close '
        + (dir === 'long' ? 'above' : 'below') + ' EMA200' + hsNote);

  /* ---------- G2 MOMENTUM ---------- */
  var _rsi = (typeof rsi === 'function') ? rsi : null;
  var _volZ = (typeof volZ === 'function') ? volZ : null;
  if (!_rsi || !_volZ) return die(2, 'momentum indicators missing (rsi/volZ) — participation unverifiable');
  var r14 = __last(_rsi(c4, 14));
  if (!isFinite(r14)) return die(2, 'RSI(4h) not warmed up');
  if (dir === 'long' && r14 > 70)
    return die(2, 'RSI ' + n2(r14, 1) + ' > 70 — never chase an overbought cascade (swing G3)');
  if (dir === 'short' && r14 < 30)
    return die(2, 'RSI ' + n2(r14, 1) + ' < 30 — never chase an oversold cascade (swing G3)');
  var vz = _volZ(rows4h, 20);
  if (!(vz > VOLZ_MIN))
    return die(2, 'volume z ' + (isFinite(vz) ? sp(vz) : 'n/a') + ' <= ' + VOLZ_MIN + ' — no participation behind the close (swing G5)');
  var cb = rows4h[rows4h.length - 1], range = (+cb.h) - (+cb.l);
  var closePos = range > 0 ? ((+cb.c) - (+cb.l))/range : 0.5;
  if (dir === 'long' && closePos < CLOSEPOS_LONG)
    return die(2, 'close ' + Math.round(closePos*100) + '% up the bar < 60% — sellers hit the close (swing G5)');
  if (dir === 'short' && closePos > CLOSEPOS_SHORT)
    return die(2, 'close ' + Math.round(closePos*100) + '% up the bar > 40% — buyers hit the close (swing G5)');
  note_(2, true, 'RSI ' + n2(r14, 1) + ' · vol z ' + sp(vz) + ' · close ' + Math.round(closePos*100) + '% of bar');

  /* ---------- G3 POSITIONING ---------- */
  var fr = numOrNull(inp.fundingPct);
  var scFn = (typeof smartClassify === 'function') ? smartClassify : null;
  var cls = null;
  if (fr === null && !scFn){
    note_(3, null, 'no positioning legs (funding n/a, smartClassify absent) — gate cannot evaluate');
  }else{
    if (fr !== null){
      if (Math.abs(fr) > FUND_HARD - 1e-9)
        return die(3, 'funding ' + sp(fr, 4) + '%/8h — |fr| >= 0.05, book crowded both ways (swing G4)');
      if (dir === 'long' && fr >= FUND_DIR)
        return die(3, 'funding ' + sp(fr, 4) + '%/8h >= +0.04 — longs paying to hold, crowded side (swing G4)');
      if (dir === 'short' && fr <= -FUND_DIR)
        return die(3, 'funding ' + sp(fr, 4) + '%/8h <= -0.04 — shorts paying to hold, crowded side (swing G4)');
    }
    var scNote = 'smartClassify unavailable — funding-only read';
    if (scFn){
      try{
        cls = scFn({ chg24: numOrNull(inp.chg24), oiChgPct: numOrNull(inp.oiChgPct), fundingPct: fr,
                     retailLongPct: numOrNull(inp.retailLongPct), topLongPct: numOrNull(inp.topLongPct),
                     takerRatio: numOrNull(inp.takerRatio) }) || null;
      }catch(e){ cls = null; scNote = 'smartClassify errored — funding-only read'; }
      if (cls && cls.dir){
        var scScore = (typeof cls.score === 'number' && isFinite(cls.score)) ? cls.score : 0;
        if (cls.dir !== dir){
          if (scScore >= 2){
            var against = (cls.dir === 'long' ? cls.longEv : cls.shortEv) || [];
            return die(3, 'smart $ ' + scScore + 'v' + Math.max(0, (cls.total || 0) - scScore) + ' AGAINST — '
                        + (against[0] || 'positioning evidence opposes'));
          }
          scNote = 'smart $ mildly against (' + scScore + ' evidence) — noted, not a veto';
        }else{
          scNote = 'smart $ confirms ' + dir.toUpperCase() + ' (' + scScore + ' evidence)';
        }
      }else if (cls){ scNote = 'smart $ split — no majority'; }
    }
    note_(3, true, (fr !== null ? 'funding ' + sp(fr, 4) + '%/8h ok' : 'funding n/a')
          + (numOrNull(inp.oiChgPct) !== null ? ' · OI Δ24h ' + sp(inp.oiChgPct, 1) + '%' : '')
          + ' · ' + scNote);
  }

  /* ---------- G4 LIQUIDITY / VOL ---------- */
  var atrPct = a4/p*100;
  if (!(atrPct >= ATRPCT_MIN))
    return die(4, 'ATR ' + n2(atrPct, 3) + '% of price < ' + ATRPCT_MIN + '% — dead book, stops are meaningless');
  if (!(atrPct <= ATRPCT_MAX))
    return die(4, 'ATR ' + n2(atrPct, 1) + '% of price > ' + ATRPCT_MAX + '% — untradeable volatility');
  var to = numOrNull(inp.turnoverUsd);
  var floor = numOrNull(inp.minTurnover);   /* scan-time select overrides; default $10M */
  if (!(floor > 0)) floor = MIN_TURNOVER;
  if (to !== null && to < floor)
    return die(4, '24h turnover $' + moneyM(to) + ' < $' + moneyM(floor) + ' floor — slippage risk');
  var anchorX = Math.abs(p - e21)/a4;
  if (!(anchorX <= ANCHOR_MAX_ATR))
    return die(4, 'price ' + n2(anchorX) + 'xATR from EMA21 > ' + ANCHOR_MAX_ATR + ' — too extended, wait for the pullback (swing anchor)');
  /* turnover UNKNOWN (CoinDCX exposes no turnover field): never an auto-veto,
     but conviction-backed sizing is halved and the card says why */
  var toNote = (to !== null) ? 'turnover $' + moneyM(to) : 'turnover n/a — turnover unverified — size down';
  if (to === null) res.turnoverUnverified = true;
  note_(4, true, 'ATR ' + n2(atrPct, 2) + '% of price · ' + toNote
        + ' · ' + n2(anchorX) + 'xATR off EMA21');

  /* ---------- G5 NEWS RISK ---------- */
  var news = (inp.news !== undefined) ? inp.news : undefined, newsNA = null, newsClear = false;
  if (news === undefined){
    if (typeof hgNewsRisk === 'function'){
      try{ news = hgNewsRisk(sym); newsClear = true; }
      catch(e){ news = null; newsNA = 'hgNewsRisk errored (' + (e && e.message ? e.message : e) + ') — treated as no read; check the calendar manually'; }
    }else{
      newsNA = 'hgNewsRisk not loaded — news blackout unverified; check the calendar manually';
    }
  }else{ newsClear = true; }
  if (news && (news.blackout === true || news.veto === true))
    return die(5, 'NEWS BLACKOUT — ' + (news.event || 'high-impact event inside the window')
                + (news.until ? ' · until ' + news.until : ''));
  if (newsNA) note_(5, null, newsNA);
  else note_(5, true, newsClear && news ? 'no high-impact events inside the blackout window' : 'news calendar clear');

  /* ---------- SURVIVOR ---------- */
  res.pass = true;
  res.gatesPassed = countTrue();
  res.conviction = res.gatesPassed >= GATES.length ? 'STRONG' : 'MODERATE';
  res.plan = buildPlan(dir, cls, rows4h, inp.rows1h);
  res.riskPct = suggestedRiskPct(res.conviction, res.plan);
  if (res.turnoverUnverified === true && typeof res.riskPct === 'number' && isFinite(res.riskPct))
    res.riskPct = Math.round(res.riskPct/2 * 10000)/10000;   /* halved: turnover unverified — size down */
  return res;
}

/* =========================================================================
Stage 0 — universe collection (scanner results first, turnover fallback)
========================================================================= */
var SCAN_KEYS = ['HG_oiflowResults', 'oiflowResults', 'HG_squeezeResults', 'squeezeResults',
                 'HG_smartResults', 'smartResults', 'HG_scannerResults'];
function readScannerResults(){
  for (var i = 0; i < SCAN_KEYS.length; i++){
    var v = G[SCAN_KEYS[i]];
    if (!v) continue;
    var syms = null, at = null;
    if (Array.isArray(v)) syms = v;
    else if (typeof v === 'object' && Array.isArray(v.syms)){ syms = v.syms; at = v.at || null; }
    if (!syms || !syms.length) continue;
    if (at && isFinite(at) && (Date.now() - at) > SCANNER_FRESH_MS) continue; // stale
    var out = [];
    for (var j = 0; j < syms.length && out.length < MAX_UNIVERSE; j++){
      var s = (typeof syms[j] === 'string') ? syms[j]
            : (syms[j] && (syms[j].sym || syms[j].symbol));
      if (typeof s === 'string' && s && out.indexOf(s) < 0) out.push(s);
    }
    if (out.length)
      return { syms: out, source: 'scanner results · ' + SCAN_KEYS[i] + (at ? ' · ' + new Date(at).toTimeString().slice(0, 5) : ' · unstamped') };
  }
  return null;
}

/* ---------------- combined delta+coindcx universe (xuniverse.js) ----------------
   Every reference feature-checked: when window.xuUniverse is absent the
   engine behaves EXACTLY as before (scanner results -> Binance top-24). */
function xuUniverseFn(){
  if (typeof G.xuUniverse === 'function') return G.xuUniverse;
  if (typeof globalThis !== 'undefined' && typeof globalThis.xuUniverse === 'function') return globalThis.xuUniverse;
  return null;
}
function xuCandlesFn(){
  if (typeof G.xuCandles === 'function') return G.xuCandles;
  if (typeof globalThis !== 'undefined' && typeof globalThis.xuCandles === 'function') return globalThis.xuCandles;
  return null;
}
function normXuItem(raw){
  if (!raw || typeof raw !== 'object') return null;
  var sym = (typeof raw.sym === 'string' && raw.sym) ? raw.sym
          : ((typeof raw.symbol === 'string' && raw.symbol) ? raw.symbol : null);
  if (!sym) return null;
  var ex = String(raw.exchange || '').toLowerCase();
  var exk = (ex === 'delta') ? 'delta' : ((ex === 'coindcx' || ex === 'cdcx') ? 'cdcx' : 'other');
  return {
    sym: sym,
    base: (typeof raw.base === 'string' && raw.base) ? raw.base : null,
    exchange: exk,            /* normalized key for the venue filter + tallies */
    raw: raw,                 /* ORIGINAL row — xuCandles routes on raw.exchange ('coindcx'), never pass it the normalized key */
    turnoverUsd: numOrNull(raw.turnoverUsd),
    mark: numOrNull(raw.mark),
    fundingPct: numOrNull(raw.fundingPct),
    alsoOn: Array.isArray(raw.alsoOn) ? raw.alsoOn.slice() : ((typeof raw.alsoOn === 'string' && raw.alsoOn) ? [raw.alsoOn] : [])
  };
}
/* rows -> clean {t,o,h,l,c,v} numbers, time-sorted; null when nothing usable.
   Accepts both {t,o,h,l,c,v} and {time,open,high,low,close,volume} shapes. */
function sanitizeXuRows(rows){
  if (!rows || !rows.length) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i]; if (!r) continue;
    var t = +((r.t !== undefined) ? r.t : r.time);
    var o = +((r.o !== undefined) ? r.o : r.open);
    var h = +((r.h !== undefined) ? r.h : r.high);
    var l = +((r.l !== undefined) ? r.l : r.low);
    var c = +((r.c !== undefined) ? r.c : r.close);
    var v = +((r.v !== undefined) ? r.v : r.volume);
    if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
    out.push({ t: isFinite(t) ? t : 0, o: o, h: h, l: l, c: c, v: isFinite(v) ? v : 0 });
  }
  if (!out.length) return null;
  out.sort(function(a, b){ return a.t - b.t; });
  return out;
}
/* gates only ever see CLOSED candles — a still-forming bar repaints */
function dropFormingXu(rows, tf){
  var sec = (tf === '4h') ? 14400 : (tf === '1h' ? 3600 : 0);
  if (!sec || !rows || !rows.length) return rows;
  var lastT = rows[rows.length - 1].t;
  if (lastT > 1e12) lastT = Math.floor(lastT/1000);
  if (lastT <= 0) return rows;
  return ((Date.now()/1000) - lastT < sec) ? rows.slice(0, -1) : rows;
}
/* one candle leg for an xu item: xuCandles(item,tf,n) first (12s budget),
   getCandles(sym,tf,n) as the fallback; leg-isolated, sanitized, forming bar
   dropped. Returns null when both sources fail — G0 then vetoes honestly. */
async function xuCandleLeg(item, tf, n){
  var fn = xuCandlesFn();
  var rows = null;
  if (fn){
    /* pass the ORIGINAL universe row: xuCandles routes on raw.exchange */
    var target = (item && item.raw) ? item.raw : item;
    rows = await leg(function(){
      return raceTimeout(Promise.resolve().then(function(){ return fn(target, tf, n); }), XU_TIMEOUT_MS, null);
    }, null);
  }
  if ((!rows || !rows.length) && typeof getCandles === 'function'){
    rows = await leg(function(){ return getCandles(item.sym, tf, n); }, null);
  }
  var clean = sanitizeXuRows(rows);
  return clean ? dropFormingXu(clean, tf) : null;
}

/* raw xu rows -> normalized, venue-filtered, base-asset-deduped item list +
   tallies. Shared by collectUniverse (full scan) and quickRescan (new-listing
   detection on the cached list). */
function normalizeXuList(raw, cfg){
  var items = [], seen = {}, tallies = { delta: 0, cdcx: 0, other: 0 }, dropped = 0, valid = 0;
  for (var i = 0; i < raw.length; i++){
    var it = null;
    try{ it = normXuItem(raw[i]); }catch(e){ it = null; }
    if (!it){ dropped++; continue; }
    valid++;
    if (cfg.venue !== 'all' && it.exchange !== cfg.venue){ dropped++; continue; }
    var key = it.exchange + '|' + (it.base || it.sym);   /* dedup by base asset per venue */
    if (seen[key]){ dropped++; continue; }
    seen[key] = true;
    tallies[it.exchange]++;
    items.push(it);
  }
  return { items: items, tallies: tallies, dropped: dropped, valid: valid };
}

async function collectUniverse(){
  var cfg = getCfg();
  var ticks = null;
  if (typeof binanceTickers24h === 'function'){
    try{ ticks = await binanceTickers24h(); }catch(e){ ticks = null; }
  }
  var fromScanners = readScannerResults();
  if (fromScanners) return { mode: 'legacy', syms: fromScanners.syms, source: fromScanners.source, ticks: ticks, cfg: cfg };
  /* (2) combined Delta India + CoinDCX universe — ALL contracts, no count
     cap; liquidity is enforced at G4, never by truncation. */
  var xu = xuUniverseFn();
  if (xu){
    var raw = null;
    try{ raw = await raceTimeout(Promise.resolve().then(function(){ return xu(false); }), XU_TIMEOUT_MS, null); }
    catch(e){ raw = null; }
    if (raw && raw.length){
      var norm = normalizeXuList(raw, cfg);
      var items = norm.items, tallies = norm.tallies, dropped = norm.dropped, valid = norm.valid;
      if (items.length){
        var src = 'combined delta+coindcx universe · delta ' + tallies.delta + ' · cdcx ' + tallies.cdcx
          + (tallies.other ? ' · other ' + tallies.other : '')
          + ' · ALL contracts (liquidity gated at G4, never truncated)'
          + (cfg.venue !== 'all' ? ' · venue ' + cfg.venue.toUpperCase() + ' (' + dropped + ' filtered out)' : '');
        return { mode: 'xu', syms: items.map(function(x){ return x.sym; }), items: items,
                 tallies: tallies, source: src, ticks: ticks, cfg: cfg };
      }
      if (valid > 0){
        /* the venue filter emptied the combined list — say so, do NOT
           silently substitute the Binance fallback for a filtered-out venue */
        return { mode: 'legacy', syms: [], ticks: ticks, cfg: cfg,
                 source: 'combined universe held ' + valid + ' contracts but venue ' + cfg.venue.toUpperCase()
                       + ' filtered every one out — widen the VENUE select to scan them' };
      }
      /* raw list unusable (nothing parseable) — fall through to Binance */
    }
    /* xu unavailable / errored / timed out / empty — fall through to Binance */
  }
  /* (3) legacy Binance fallback */
  if (typeof binancePerpUniverse === 'function' && ticks){
    var perps = [];
    try{ perps = await binancePerpUniverse() || []; }catch(e){ perps = []; }
    var floor = cfg.minTurnover;
    var uni = perps.filter(function(s){ return ticks[s] && ticks[s].turnoverUsd >= floor; })
                   .sort(function(a, b){ return ticks[b].turnoverUsd - ticks[a].turnoverUsd; })
                   .slice(0, MAX_UNIVERSE);
    return { mode: 'legacy', syms: uni, ticks: ticks, cfg: cfg,
             source: 'fallback: top ' + MAX_UNIVERSE + ' USDT perps by 24h turnover (≥$' + moneyM(floor) + ')' };
  }
  return { mode: 'legacy', syms: [], ticks: ticks, cfg: cfg,
           source: 'none — no scanner results published, combined universe module absent, binance.js unavailable' };
}

/* ---------------- per-symbol data gathering (every leg feature-checked) ---------------- */
/* leg(): one fetch leg, fully isolated — a sync throw OR a rejection degrades
   just that leg to its fallback. It can never kill the sibling legs or reject
   the surrounding Promise.all (error sweep: no unhandled rejections here). */
function leg(fn, fallback){
  try{ return Promise.resolve(fn()).catch(function(){ return fallback; }); }
  catch(e){ return Promise.resolve(fallback); }
}
async function gatherSymbol(sym, tick, source){
  var k = (typeof binanceKlines === 'function') ? binanceKlines : null;
  var legs = await Promise.all([
    k ? leg(function(){ return binanceKlines(sym, '4h', 260); }, []) : Promise.resolve([]),
    k ? leg(function(){ return binanceKlines(sym, '1h', 120); }, []) : Promise.resolve([]),
    (typeof binanceFunding    === 'function') ? leg(function(){ return binanceFunding(sym); }, null)             : Promise.resolve(null),
    (typeof binanceOIHistory  === 'function') ? leg(function(){ return binanceOIHistory(sym, '1h', 25); }, null) : Promise.resolve(null),
    (typeof binanceLongShort  === 'function') ? leg(function(){ return binanceLongShort(sym, '1h', 2); }, null)  : Promise.resolve(null),
    (typeof binanceTopTraders === 'function') ? leg(function(){ return binanceTopTraders(sym, '1h', 2); }, null) : Promise.resolve(null),
    (typeof binanceTakerRatio === 'function') ? leg(function(){ return binanceTakerRatio(sym, '1h', 2); }, null) : Promise.resolve(null)
  ]);
  var rows4h = legs[0] || [], rows1h = legs[1] || [], fnd = legs[2], oih = legs[3], ls = legs[4], top = legs[5], tk = legs[6];
  var oiChgPct = null;
  if (oih && oih.series && oih.series.length >= 2){
    var first = null, lastOi = null;
    for (var i = 0; i < oih.series.length; i++){
      if (isFinite(oih.series[i].oi)){ if (first === null) first = oih.series[i].oi; lastOi = oih.series[i].oi; }
    }
    if (first !== null && first > 0 && lastOi !== null) oiChgPct = (lastOi/first - 1)*100;
  }
  return {
    sym: sym, source: source,
    rows4h: rows4h.length ? rows4h : null,
    rows1h: rows1h.length ? rows1h : null,
    chg24:        (tick && isFinite(tick.chg24))       ? tick.chg24       : null,
    turnoverUsd:  (tick && isFinite(tick.turnoverUsd)) ? tick.turnoverUsd : null,
    fundingPct:   (fnd && isFinite(fnd.fundingPct)) ? fnd.fundingPct
                : ((tick && isFinite(tick.fundingPct)) ? tick.fundingPct : null),
    oiChgPct:     oiChgPct,
    retailLongPct:(ls  && ls.latest  && isFinite(ls.latest.longPct))        ? ls.latest.longPct        : null,
    topLongPct:   (top && top.latest && isFinite(top.latest.longPct))       ? top.latest.longPct       : null,
    takerRatio:   (tk  && tk.latest  && isFinite(tk.latest.buySellRatio))   ? tk.latest.buySellRatio   : null,
    mark:         (fnd && isFinite(fnd.markPrice)) ? fnd.markPrice
                : ((tick && isFinite(tick.mark)) ? tick.mark : NaN)
  };
}

/* =========================================================================
Rendering
========================================================================= */
function planText(s){
  return 'ENTRY <b>' + PX(s.entry) + '</b> · STOP <b>' + PX(s.stop) + '</b>'
    + ' · T1 ' + PX(s.t1) + ' (' + FMT(s.rr1, 1) + 'R) · T2 ' + PX(s.t2) + ' (' + FMT(s.rr2, 1) + 'R)'
    + ' · risk ' + FMT(s.riskPct, 2) + '%' + (s.note ? ' — ' + s.note : '');
}

/* Max-safe leverage chip on EXECUTE cards — identical formula to the BRAIN
   planner: floor(1 / (stop distance ×1.5 + 0.5% MMR)), liquidation
   clearance ≥1.5× the stop. The owner's stop-out fix, on every card. */
function safeLevChipHtml(entry, stop){
  try{
    entry = +entry; stop = +stop;
    if (!(isFinite(entry) && isFinite(stop)) || entry <= 0 || entry === stop) return '';
    var sd = Math.abs(entry - stop) / entry;
    var lev = Math.max(1, Math.min(100, Math.floor(1 / (sd * 1.5 + 0.005))));
    var col = lev >= 20 ? '#2EE6A8' : (lev >= 10 ? '#F5C542' : '#8B9CC4');
    return ' · <span style="font-weight:700;color:' + col + '" title="max safe leverage — floor(1 / (stop distance ×1.5 + 0.5% MMR)) — liquidation clearance ≥1.5× the stop. Trading above this is how accounts die.">'
      + lev + 'x SAFE</span>'
      + (lev >= 20 && sd <= 0.03 ? ' <span style="font-weight:700;color:#2EE6A8" title="stop distance ≤3% — meets the 20x SNIPER discipline">· SNIPER GRADE</span>' : '');
  }catch(e){ return ''; }
}

function cardHTML(r){
  var res = r.res, dir = res.dir, s = res.plan;
  var symHtml = esc(r.sym);
  var badge = s ? ' <span class="gpip ok">' + s.type + '</span> <span class="gpip' + (s.confirmed ? ' ok' : '') + '">'
      + (s.confirmed ? 'CONFIRMED' : 'UNCONFIRMED') + '</span>' : '';
  var verdict = '<div class="verdict ' + dir + '"><div class="vword">' + dir.toUpperCase() + '</div>'
    + '<div class="vwhy"><b>' + res.conviction + ' CONVICTION</b> — ' + res.gatesPassed + ' of 6 gates passed'
    + ' · suggested risk <b>' + FMT(res.riskPct, 2) + '%</b> of equity'
    + (res.turnoverUnverified ? ' · turnover unverified — size down' : '')
    + (s ? ' · ' + s.type + (s.confirmed ? ' CONFIRMED' : ' UNCONFIRMED') : ' · levels unavailable — size down') + '</div></div>';
  var mini = '<div class="mini">'
    + '<span class="k">mark</span><span>' + PX(r.mark) + '</span>'
    + '<span class="k">24h change</span><span>' + (r.chg24 !== null ? PCT(r.chg24, 2) : '—') + '</span>'
    + '<span class="k">funding 8h</span><span>' + (r.fundingPct !== null ? FMT(r.fundingPct, 4) + '%' : 'n/a') + '</span>'
    + '<span class="k">OI 24h Δ</span><span>' + (r.oiChgPct !== null ? PCT(r.oiChgPct, 1) : 'n/a') + '</span>'
    + '<span class="k">turnover 24h</span><span>' + (r.turnoverUsd !== null ? '$' + FMT(r.turnoverUsd/1e6, 0) + 'M' : '—') + '</span>'
    + '<span class="k">conviction</span><span>' + res.conviction + ' · ' + res.gatesPassed + '/6 gates</span>'
    + '</div>';
  var trailHtml = '<div class="ledger">' + res.trail.map(function(t){
      return gateRowHTML(t.gate, t.name, trailState(t.ok), esc(t.note));
    }).join('') + '</div>';
  var planHtml = s
    ? '<div class="plan">' + planText(s) + safeLevChipHtml(s.entry, s.stop) + '</div>'
    : '<div class="plan">Levels unavailable — size down. All 6 gates passed but neither the setup builder nor the universal hgPlanLevels fallback could compute levels from the 4h structure. Direction is real; levels are not. Do not improvise them.</div>';
  var chartBox = s ? '<div class="engineChart" data-sym="' + symHtml + '" style="height:180px;margin-top:8px"></div>' : '';
  var tradeBtn = (s && typeof toTrade === 'function')
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  return '<div class="card ' + dir + '">'
    + '<div class="chead"><span class="sym">' + symHtml + '</span><span class="dir">' + dir.toUpperCase() + ' · EXECUTE'
    + (r.exchange ? ' <span class="gpip">' + esc(String(r.exchange).toUpperCase()) + '</span>' : '') + badge
    + (typeof hgSessionChip === 'function' ? hgSessionChip() : '') + '</span></div>'
    + verdict + mini + trailHtml + planHtml + chartBox + tradeBtn
    + '</div>';
}

function asideHTML(rejected){  var rows = rejected.slice(0, ASIDE_MAX).map(function(r){
    var kill = null;
    for (var i = 0; i < r.res.trail.length; i++) if (r.res.trail[i].ok === false){ kill = r.res.trail[i]; break; }
    if (!kill) return '';
    return gateRowHTML(kill.gate, kill.name + ' · ' + r.sym + (r.exchange ? ' · ' + r.exchange : ''), 'veto', esc(kill.note));
  }).join('');
  if (rejected.length > ASIDE_MAX)
    rows += gateRowHTML('…', (rejected.length - ASIDE_MAX) + ' more rejections', 'na', 'list capped at ' + ASIDE_MAX);
  return rows;
}

function paintCharts(cardsEl, survivors){
  try{
    if (typeof hgMiniChart !== 'function' || !cardsEl || typeof cardsEl.querySelectorAll !== 'function') return;
    if (typeof hgChartAvailable === 'function' && !hgChartAvailable()) return;
    var nodes = cardsEl.querySelectorAll('.engineChart');
    if (!nodes || !nodes.length) return;
    var bySym = {};
    for (var i = 0; i < survivors.length; i++) bySym[survivors[i].sym] = survivors[i];
    for (var k = 0; k < nodes.length; k++){
      try{
        var r = bySym[nodes[k].getAttribute('data-sym')];
        if (!r || !r.res.plan || !r.rows4h || !r.rows4h.length) continue;
        hgMiniChart(nodes[k], r.rows4h, { dir: r.res.plan.dir, entry: r.res.plan.entry, stop: r.res.plan.stop, t1: r.res.plan.t1, t2: r.res.plan.t2 });
      }catch(e){ /* one chart failing never kills the rest */ }
    }
  }catch(e){ /* charting is best-effort */ }
}

/* ---------------- tab UI ---------------- */
var __busy = false;   // module-local re-entry guard — no global timers anywhere
var __busySince = 0;  /* watchdog: an await that never settles (hung fetch —
                         no timeout) keeps the promise pending forever, finally
                         never runs, and the layer stays dark PERMANENTLY (the
                         2026-07-24 all-ASIDE outage). A scan older than
                         BUSY_STUCK_MS is declared stuck and the guard is
                         force-released; the in-flight corpse can only write to
                         its (usually inert) pane — harmless next to a dead layer. */
var BUSY_STUCK_MS = 10*60*1000;
var ENGINE_FRESH_MS = 30*60*1000;  /* warm-hook TTL: older survivors re-scan */
function busyStuck(){
  return !!__busy && __busySince > 0 && (Date.now() - __busySince) > BUSY_STUCK_MS;
}
function busyAcquire(){
  if (__busy && !busyStuck()) return false;
  __busy = true; __busySince = Date.now(); return true;
}
function busyRelease(){ __busy = false; __busySince = 0; }
var __hasRun = false; // true once a scan attempt has completed (user run or honest abort)
var __el = null;      // last mounted pane, so refresh() can re-run without a click

/* ---------------- BRAIN state snapshot (window.engineState) ----------------
   Last SUCCESSFUL scan's funnel output, cached for the BRAIN meta-engine.
   Aborted/failed re-runs never touch it — the previous good snapshot keeps
   its original `at`. The getter below hands out DEEP-FROZEN deep copies so
   callers can never mutate module state, and never throws.
   rejected rows = {sym, vetoGate, dir, gatesPassed} — dir/gatesPassed are
   the funnel's own evidence at kill time (dir null for G0/G1 vetoes, where
   no side was ever committed); additive-only, sym/vetoGate untouched. */
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
function setSnapshot(survivors, rejected){
  try{
    var sv = [], i, rec, res, plan;
    for (i = 0; i < survivors.length; i++){
      rec = survivors[i]; res = rec && rec.res;
      if (!rec || !res) continue;
      plan = null;
      if (res.plan && isFinite(res.plan.entry) && isFinite(res.plan.stop)
          && isFinite(res.plan.t1) && isFinite(res.plan.t2))
        plan = { entry: res.plan.entry, stop: res.plan.stop, t1: res.plan.t1, t2: res.plan.t2 };
      sv.push({ sym: rec.sym, dir: res.dir, conviction: res.conviction, plan: plan,
                gatesPassed: (typeof res.gatesPassed === 'number' && isFinite(res.gatesPassed)) ? res.gatesPassed : 0 });
    }
    var rj = [];
    for (i = 0; i < rejected.length; i++){
      rec = rejected[i]; res = rec && rec.res;
      if (!rec || !res) continue;
      rj.push({ sym: rec.sym, vetoGate: (typeof res.vetoGate === 'string') ? res.vetoGate : null,
                dir: (res.dir === 'long' || res.dir === 'short') ? res.dir : null,   /* G1 lean under evaluation at kill time; null pre-G1-commit */
                gatesPassed: (typeof res.gatesPassed === 'number' && isFinite(res.gatesPassed)) ? res.gatesPassed : 0 });
    }
    __snap = { survivors: sv, rejected: rj, at: Date.now() };
  }catch(e){ /* snapshotting must never break the scan */ }
}

function setProg(el, f){
  var p = el.querySelector('#engineProg');
  if (!p) return;
  p.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && p.firstElementChild) p.firstElementChild.style.width = (f*100).toFixed(1) + '%';
}

function depStatus(){
  var root = (typeof globalThis !== 'undefined') ? globalThis : G;
  var need = ['binancePerpUniverse', 'binanceTickers24h', 'binanceKlines', 'binanceFunding',
              'binanceOIHistory', 'binanceLongShort', 'binanceTopTraders', 'binanceTakerRatio',
              'ema', 'rsi', 'atr', 'volZ'];
  var missing = [];
  for (var i = 0; i < need.length; i++) if (typeof root[need[i]] !== 'function') missing.push(need[i]);
  var optional = ['smartClassify', 'smartSetup', 'hgPlanLevels', 'hgStructure', 'hgNewsRisk', 'toTrade', 'hgMiniChart',
                  'xuUniverse', 'xuCandles'];
  var optMissing = [];
  for (var j = 0; j < optional.length; j++) if (typeof root[optional[j]] !== 'function') optMissing.push(optional[j]);
  return { missing: missing, optMissing: optMissing };
}

/* ---------------- shared per-candidate gating (full scan + QUICK RESCAN) ---------------- */
/* xu mode, STAGED: 4h first, full funnel on it; 1h ONLY for passers (plan
   quality). Dead candidates never cost a second request. */
async function gateXuCandidate(item, cfg){
  var src = item.exchange + (item.alsoOn.length ? ' (also on ' + item.alsoOn.join('/') + ')' : '')
          + ' · combined universe';
  var rows4h = await xuCandleLeg(item, '4h', 260);
  var inp = { sym: item.sym, source: src, rows4h: rows4h, rows1h: null,
              chg24: null, turnoverUsd: item.turnoverUsd, fundingPct: item.fundingPct,
              oiChgPct: null, retailLongPct: null, topLongPct: null, takerRatio: null,
              minTurnover: cfg.minTurnover };
  var res = gateCandidate(inp);
  if (res.pass){
    var rows1h = await xuCandleLeg(item, '1h', 120);
    if (rows1h && rows1h.length){ inp.rows1h = rows1h; res = gateCandidate(inp); }
  }
  return { sym: item.sym, exchange: item.exchange, res: res, rows4h: rows4h,
           mark: item.mark, chg24: null, fundingPct: item.fundingPct,
           oiChgPct: null, turnoverUsd: item.turnoverUsd };
}
async function gateLegacyCandidate(sym, ticks, source, cfg){
  var inp = await gatherSymbol(sym, ticks ? ticks[sym] : null, source);
  inp.minTurnover = cfg.minTurnover;
  var res = gateCandidate(inp);
  return { sym: sym, res: res, rows4h: inp.rows4h,
           mark: inp.mark, chg24: inp.chg24, fundingPct: inp.fundingPct,
           oiChgPct: inp.oiChgPct, turnoverUsd: inp.turnoverUsd };
}

function sortResults(survivors, rejected){
  survivors.sort(function(a, b){
    var ca = a.res.conviction === 'STRONG' ? 0 : 1, cb2 = b.res.conviction === 'STRONG' ? 0 : 1;
    var fa = (a.res.plan && a.res.plan.confirmed) ? 0 : 1, fb = (b.res.plan && b.res.plan.confirmed) ? 0 : 1;
    var pa = a.res.plan ? 0 : 1, pb = b.res.plan ? 0 : 1;
    return (ca - cb2) || (pa - pb) || (fa - fb)
      || (b.res.gatesPassed - a.res.gatesPassed)
      || ((b.turnoverUsd || 0) - (a.turnoverUsd || 0));
  });
  rejected.sort(function(a, b){
    var ia = a.res.vetoGate ? +a.res.vetoGate.slice(1) : -1, ib = b.res.vetoGate ? +b.res.vetoGate.slice(1) : -1;
    return (ib - ia) || (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0);
  });
}

/* cards + charts + WHY ASIDE + empty state; returns the stat tallies.
   Shared by runScan (full) and quickRescan (cached-universe re-gate). */
function paintResults(el, survivors, rejected, isXu){
  var cards = el.querySelector('#engineCards'), empty = el.querySelector('#engineEmpty'),
      asidePanel = el.querySelector('#engineAside'), asideList = el.querySelector('#engineAsideList'),
      asideCount = el.querySelector('#engineAsideCount');
  if (cards){
    cards.innerHTML = survivors.map(cardHTML).join('');
    paintCharts(cards, survivors);
  }
  if (asidePanel && asideList){
    asideList.innerHTML = asideHTML(rejected);
    if (asideCount){
      var acTxt = rejected.length + ' rejected';
      if (isXu){
        var rd = 0, rc = 0, ro = 0;
        for (var ai = 0; ai < rejected.length; ai++){
          var ex2 = rejected[ai].exchange;
          if (ex2 === 'delta') rd++; else if (ex2 === 'cdcx') rc++; else ro++;
        }
        acTxt += ' · delta ' + rd + ' · cdcx ' + rc + (ro ? ' · other ' + ro : '');
      }
      asideCount.textContent = acTxt;
    }
    asidePanel.style.display = rejected.length ? 'block' : 'none';
  }
  if (empty) empty.style.display = survivors.length ? 'none' : 'block';
  var nStrong = 0, nPlan = 0;
  for (var ri = 0; ri < survivors.length; ri++){
    if (survivors[ri].res.conviction === 'STRONG') nStrong++;
    if (survivors[ri].res.plan) nPlan++;
  }
  return { nStrong: nStrong, nPlan: nPlan };
}

/* ---------------- QUICK RESCAN ----------------
   Pure target diff, exported as window.engineQuickTargets for vm tests.
   prevCandidates/prevSurvivors/curr are symbol arrays; returns
   {recheck, newListings, unchanged, gone}:
     recheck     = prior survivors still listed (re-gated on fresh candles)
     newListings = symbols in the current universe never gated before
     unchanged   = prior non-survivor candidates (keep prior verdict + age)
     gone        = prior survivors no longer listed (verdict kept, flagged) */
function engineQuickTargets(prevCandidates, prevSurvivors, curr){
  try{
    prevCandidates = Array.isArray(prevCandidates) ? prevCandidates : [];
    prevSurvivors  = Array.isArray(prevSurvivors)  ? prevSurvivors  : [];
    curr           = Array.isArray(curr)           ? curr           : [];
    var inCurr = {}, inPrev = {}, inSurv = {}, i;
    for (i = 0; i < curr.length; i++) inCurr[curr[i]] = true;
    for (i = 0; i < prevCandidates.length; i++) inPrev[prevCandidates[i]] = true;
    for (i = 0; i < prevSurvivors.length; i++) inSurv[prevSurvivors[i]] = true;
    var recheck = [], newListings = [], unchanged = [], gone = [];
    for (i = 0; i < curr.length; i++){
      var s = curr[i];
      if (inSurv[s]) recheck.push(s);
      else if (!inPrev[s]) newListings.push(s);
    }
    for (i = 0; i < prevCandidates.length; i++){
      var s2 = prevCandidates[i];
      if (inSurv[s2]){ if (!inCurr[s2]) gone.push(s2); }
      else unchanged.push(s2);
    }
    return { recheck: recheck, newListings: newListings, unchanged: unchanged, gone: gone };
  }catch(e){ return { recheck: [], newListings: [], unchanged: [], gone: [] }; }
}

/* last SUCCESSFUL full scan — the universe + verdicts QUICK RESCAN reuses.
   Set exactly where setSnapshot is (aborted/failed runs never touch it). */
var __lastScan = null;

function setScanButtons(el, disabled){
  var b1 = el.querySelector('#engineRun'), b2 = el.querySelector('#engineQuick');
  if (b1) b1.disabled = disabled;
  if (b2) b2.disabled = disabled;
}

async function runScan(el){
  if (!busyAcquire()) return;
  var btn = el.querySelector('#engineRun'), stat = el.querySelector('#engineStat'),
      cards = el.querySelector('#engineCards'), empty = el.querySelector('#engineEmpty'),
      asidePanel = el.querySelector('#engineAside'), asideList = el.querySelector('#engineAsideList'),
      asideCount = el.querySelector('#engineAsideCount');
  if (!btn || !stat || !cards || !empty){ busyRelease(); return; }
  setScanButtons(el, true); cards.innerHTML = ''; empty.style.display = 'none';
  if (asidePanel) asidePanel.style.display = 'none';
  stat.className = 'note';
  var t0 = Date.now();
  try{
    stat.textContent = 'collecting universe…';
    var uni = await collectUniverse();
    if (!uni.syms.length){
      stat.className = 'note warn';
      stat.textContent = 'empty universe — ' + uni.source;
      empty.style.display = 'block';
      return;
    }
    var survivors = [], rejected = [], failed = 0;
    var isXu = (uni.mode === 'xu');
    var cands = isXu ? uni.items : uni.syms;
    var proc = { delta: 0, cdcx: 0, other: 0 };   /* gated-per-exchange tallies */
    for (var ci = 0; ci < cands.length; ci += CHUNK){
      var chunk = cands.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(cand, k){
        var i = ci + k;
        var sym = isXu ? cand.sym : cand;
        setProg(el, (i + 1)/cands.length);
        stat.textContent = 'gating ' + (i + 1) + '/' + cands.length + ' · ' + sym
          + (isXu ? ' · delta ' + proc.delta + ' · cdcx ' + proc.cdcx + ' · failed ' + failed : '');
        try{
          var rec = isXu ? await gateXuCandidate(cand, uni.cfg)
                         : await gateLegacyCandidate(sym, uni.ticks, uni.source, uni.cfg);
          if (isXu) proc[cand.exchange]++;
          if (rec.res.pass) survivors.push(rec); else rejected.push(rec);
        }catch(e){ failed++; }
      }));
      await SLEEP(CHUNK_SLEEP_MS);
    }
    sortResults(survivors, rejected);
    var counts = paintResults(el, survivors, rejected, isXu);
    stat.textContent = 'done · ' + survivors.length + ' executions (' + counts.nStrong + ' STRONG · ' + counts.nPlan + ' with plans)'
      + ' · ' + rejected.length + ' aside · universe ' + uni.syms.length + ' (' + uni.source + ')'
      + (failed ? ' · ' + failed + ' symbols failed (skipped)' : '')
      + ' · ' + ((Date.now() - t0)/1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    setSnapshot(survivors, rejected);   /* BRAIN: cache the successful scan (aborts above never reach here) */
    __lastScan = { uni: uni, survivors: survivors, rejected: rejected, at: Date.now() };   /* QUICK RESCAN cache */
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'engine scan failed: ' + (e && e.message ? e.message : e);
  }finally{
    setProg(el, null);
    setScanButtons(el, false);
    __hasRun = true;
    busyRelease();
  }
}

/* ---------------- QUICK RESCAN ----------------
   Reuses the last full scan's cached universe + verdicts — never a forced
   universe refetch. Re-gates ONLY last scan's survivors + new listings on
   fresh candles; every other candidate keeps its prior verdict + age. Stat
   shape: 'quick rescan: N checked · M unchanged …'. Never throws; a failure
   leaves the prior verdicts rendered with an honest warn. */
async function quickRescan(el){
  if (!busyAcquire()) return;
  var stat = el.querySelector('#engineStat'), cards = el.querySelector('#engineCards'),
      empty = el.querySelector('#engineEmpty');
  if (!stat || !cards || !empty){ busyRelease(); return; }
  if (!__lastScan || !__lastScan.uni){
    busyRelease();
    stat.className = 'note warn';
    stat.textContent = 'quick rescan: run a full scan first — no cached universe or verdicts yet';
    return;
  }
  setScanButtons(el, true);
  stat.className = 'note';
  var t0 = Date.now();
  try{
    var last = __lastScan, cfg = last.uni.cfg || getCfg();
    var isXu = last.uni.mode === 'xu';
    var currSyms = (last.uni.syms || []).slice();
    var currItems = (isXu && last.uni.items) ? last.uni.items.slice() : null;
    var uniNote = '';
    if (isXu){
      /* new-listing detection from the CACHE-SERVED list (xuUniverse(false)
         never forces a refetch — the 15-min cache answers when fresh) */
      var xu = xuUniverseFn();
      if (xu){
        var raw = await leg(function(){
          return raceTimeout(Promise.resolve().then(function(){ return xu(false); }), XU_TIMEOUT_MS, null);
        }, null);
        if (raw && raw.length){
          var norm = normalizeXuList(raw, cfg);
          if (norm.items.length){
            currItems = norm.items;
            currSyms = norm.items.map(function(x){ return x.sym; });
          }else uniNote = ' · live list filtered empty — cached universe reused';
        }else uniNote = ' · live universe list unavailable — cached universe reused';
      }else uniNote = ' · universe module gone — cached universe reused';
    }else{
      uniNote = ' · legacy universe — new-listing detection needs the combined universe';
    }
    var tg = engineQuickTargets(last.uni.syms, last.survivors.map(function(r){ return r.sym; }), currSyms);
    var toGate = tg.recheck.concat(tg.newListings);
    var unchangedN = tg.unchanged.length + tg.gone.length;
    if (!toGate.length){
      stat.textContent = 'quick rescan: 0 checked · ' + unchangedN + ' unchanged — nothing to re-gate'
        + ' · ' + last.survivors.length + ' executions · ' + last.rejected.length + ' aside'
        + uniNote + ' · full scan ' + new Date(last.at).toTimeString().slice(0, 5);
      return;
    }
    var itemBySym = {};
    if (isXu && currItems) for (var ii = 0; ii < currItems.length; ii++) itemBySym[currItems[ii].sym] = currItems[ii];
    var fresh = [], failed = 0;
    for (var ci = 0; ci < toGate.length; ci += CHUNK){
      var chunk = toGate.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(sym, k){
        var i = ci + k;
        setProg(el, (i + 1)/toGate.length);
        stat.textContent = 'quick rescan · re-gating ' + (i + 1) + '/' + toGate.length + ' · ' + sym;
        try{
          if (isXu){
            var item = itemBySym[sym];
            if (!item){ failed++; return; }
            fresh.push(await gateXuCandidate(item, cfg));
          }else{
            fresh.push(await gateLegacyCandidate(sym, last.uni.ticks, last.uni.source, cfg));
          }
        }catch(e){ failed++; }
      }));
      await SLEEP(CHUNK_SLEEP_MS);
    }
    /* merge: fresh verdicts replace; everything unchecked keeps prior verdict + age */
    var bySym = {}, i2;
    for (i2 = 0; i2 < last.rejected.length; i2++) bySym[last.rejected[i2].sym] = last.rejected[i2];
    for (i2 = 0; i2 < last.survivors.length; i2++) bySym[last.survivors[i2].sym] = last.survivors[i2];
    for (i2 = 0; i2 < fresh.length; i2++) bySym[fresh[i2].sym] = fresh[i2];
    var survivors = [], rejected = [];
    for (var k2 in bySym){
      if (!Object.prototype.hasOwnProperty.call(bySym, k2)) continue;
      if (bySym[k2].res && bySym[k2].res.pass) survivors.push(bySym[k2]); else rejected.push(bySym[k2]);
    }
    sortResults(survivors, rejected);
    var counts = paintResults(el, survivors, rejected, isXu);
    stat.textContent = 'quick rescan: ' + toGate.length + ' checked · ' + unchangedN + ' unchanged'
      + (tg.newListings.length ? ' (' + tg.newListings.length + ' new listing' + (tg.newListings.length > 1 ? 's' : '') + ')' : '')
      + (tg.gone.length ? ' · ' + tg.gone.length + ' delisted (verdict kept)' : '')
      + ' · ' + survivors.length + ' executions (' + counts.nStrong + ' STRONG · ' + counts.nPlan + ' with plans)'
      + ' · ' + rejected.length + ' aside'
      + (failed ? ' · ' + failed + ' failed (skipped)' : '')
      + uniNote
      + ' · full scan ' + new Date(last.at).toTimeString().slice(0, 5)
      + ' · ' + ((Date.now() - t0)/1000).toFixed(0) + 's';
    setSnapshot(survivors, rejected);   /* BRAIN: mirror the merged verdicts */
    __lastScan = { uni: { mode: last.uni.mode, syms: currSyms, items: currItems, tallies: last.uni.tallies,
                          source: last.uni.source, ticks: last.uni.ticks, cfg: cfg },
                   survivors: survivors, rejected: rejected, at: last.at };   /* keep the full-scan age */
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'quick rescan failed: ' + (e && e.message ? e.message : e) + ' — prior verdicts kept';
  }finally{
    setProg(el, null);
    setScanButtons(el, false);
    busyRelease();
  }
}

function mount(el){
  if (!el) return;
  try{
    __el = el;
    el.innerHTML =
      '<div class="panel">'
      + '<h2>EXECUTE — master gate engine <span>6-stage funnel · gates, not scores · every verdict shows its trail</span></h2>'
      + '<div class="row"><button class="btn" id="engineRun">RUN THE GATES</button>'
      + '<button class="btn" id="engineQuick" title="cached universe, no refetch — re-gates only last scan’s survivors + new listings on fresh candles; everything else keeps its verdict">QUICK RESCAN</button>'
      + '<span class="note" id="engineStat"></span></div>'
      + '<div class="row" id="engineCfg" style="margin-top:8px">'
      + '<label class="f">VENUE<select id="engineVenue">'
      + '<option value="all">ALL (Delta + CoinDCX)</option>'
      + '<option value="delta">DELTA only</option>'
      + '<option value="cdcx">CDCX only</option>'
      + '</select></label>'
      + '<label class="f">MIN TURNOVER<select id="engineTurn">'
      + '<option value="500000">$0.5M</option>'
      + '<option value="1000000">$1M</option>'
      + '<option value="10000000">$10M</option>'
      + '<option value="50000000">$50M</option>'
      + '</select></label>'
      + '<span class="note">combined universe only — liquidity is judged at G4, never truncated</span>'
      + '</div>'
      + '<div class="note" id="engineDeps" style="margin-top:8px"></div>'
      + '<div class="note" style="margin-top:8px">'
      + '<b>G0 UNIVERSE</b> (scanner results, else the combined Delta+CoinDCX futures universe — every contract, liquidity gated at G4 not truncated — else top perps by turnover) → <b>G1 STRUCTURE</b> (4H EMA cascade + anti-chop spread + EMA200 side) → '
      + '<b>G2 MOMENTUM</b> (RSI extremes · volume z · close position) → <b>G3 POSITIONING</b> (funding crowding · smart-$ divergence) → '
      + '<b>G4 LIQUIDITY/VOL</b> (ATR sanity · turnover floor · EMA21 anchor · unverified turnover halves size) → <b>G5 NEWS RISK</b> (blackout veto). '
      + 'One VETO kills the trade — the trail is printed on every card, and every kill lands in WHY ASIDE. '
      + 'Conviction = gates passed: STRONG 6/6, MODERATE 4-5/6. Suggested risk: STRONG 1% / MODERATE 0.5% of equity, unconfirmed setups halved. '
      + 'Levels come from the SMART $ setup builder backed by the mandatory hgPlanLevels fallback; when neither can compute levels the card says so (levels unavailable — size down) — never a bare card. '
      + 'QUICK RESCAN reuses the cached universe: survivors + new listings re-gated on fresh candles, everything else keeps its verdict. '
      + 'Standing aside is a position.</div>'
      + '<div class="prog" id="engineProg"><i></i></div>'
      + '</div>'
      + '<div class="cards" id="engineCards"></div>'
      + '<div class="empty" id="engineEmpty" style="display:none">No executions. Standing aside is a position.</div>'
      + '<div class="panel" id="engineAside" style="display:none"><h2>WHY ASIDE — every rejected candidate &amp; the gate that killed it '
      + '<span id="engineAsideCount"></span></h2><div class="ledger" id="engineAsideList"></div></div>';

    var deps = el.querySelector('#engineDeps');
    if (deps){
      var d = depStatus();
      if (d.missing.length){
        deps.className = 'note warn';
        deps.textContent = 'missing globals: ' + d.missing.join(', ') + ' — affected gates veto honestly (load-order issue?).'
          + (d.optMissing.length ? ' optional absent: ' + d.optMissing.join(', ') + ' (their gates degrade to N/A).' : '');
      }else{
        deps.textContent = 'data: binance.js fapi layer (60s cache) · indicators.js math · chunks of ' + CHUNK
          + (d.optMissing.length ? ' · optional absent: ' + d.optMissing.join(', ') + ' (gates degrade to N/A)' : ' · all optional modules present');
      }
    }
    var btn = el.querySelector('#engineRun');
    if (btn) btn.addEventListener('click', function(){ runScan(el).catch(function(){ /* runScan handles its own errors; this only swallows a pre-guard surprise so it never surfaces as an unhandled rejection */ }); });
    var qbtn = el.querySelector('#engineQuick');
    if (qbtn) qbtn.addEventListener('click', function(){ quickRescan(el).catch(function(){ /* same contract: quickRescan handles its own errors */ }); });
    /* config row: reflect the effective config, persist every change */
    var cfgNow = engineConfig();
    var vSel = el.querySelector('#engineVenue'), tSel = el.querySelector('#engineTurn');
    if (vSel){
      try{ vSel.value = cfgNow.venue; }catch(e){}
      vSel.addEventListener('change', function(){ engineConfig({ venue: vSel.value }); });
    }
    if (tSel){
      try{ tSel.value = String(cfgNow.minTurnover); }catch(e){}
      tSel.addEventListener('change', function(){ engineConfig({ minTurnover: parseFloat(tSel.value) }); });
    }
  }catch(e){ /* never throw at mount */ }
}

/* ---------------- hard-refresh contract ----------------
   index.html's ⟳ HARD REFRESH (hardRefreshAll) awaits this for every module
   tab. NEVER throws; returns a terse status string. A global refresh must
   NOT trigger an expensive first-time full-universe scan — before the first
   user run it skips instead. Overlapping invocations never double-fetch: any
   scan already in flight (however it was started) reports 'busy'. The busy
   check and runScan's own guard are atomic (no await between them and
   runScan sets __busy synchronously), so a double-refresh can't slip past. */
async function refresh(){
  try{
    if (__busy && !busyStuck()) return 'busy';
    if (!__hasRun || !__el) return 'skipped: not run yet';
    await runScan(__el);
    return 'refreshed';
  }catch(e){
    return 'error: ' + (e && e.message ? e.message : String(e));
  }
}

/* ---------------- registration ---------------- */
G.gateCandidate = gateCandidate;
G.engineConfig = engineConfig;
G.engineQuickTargets = engineQuickTargets;
G.engineState = function(){
  try{ return __snap ? __stateView(__snap) : null; }catch(e){ return null; }
};
/* ---------------- BRAIN warm-up hook ----------------
   Reuses the real gate scan against an inert pane so the BRAIN can warm this
   layer without mounting the EXECUTE tab. This is the slow leg of a warm-up
   — the BRAIN soft-caps it and says so in its note. Shares the mounted
   tab's busy guard (__busy). Never throws. */
function __engWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}
async function engineWarm(){
  try{
    /* TTL: survivors age — a warm snapshot older than ENGINE_FRESH_MS is NOT
       fresh; stale survivors must not keep voting all day in a long-lived
       tab (spotted during the 2026-07-25 stuck-busy repair) */
    var st = (G.engineState && G.engineState()) || null;
    if (st && isFinite(+st.at) && (Date.now() - +st.at) < ENGINE_FRESH_MS) return 'fresh';
    if (__busy && !busyStuck()) return 'busy';
    await runScan({ querySelector: function(){ return __engWarmShim(); } });
    return (G.engineState && G.engineState()) ? 'warmed' : 'unavailable: gate scan did not complete (network?)';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'execute', label: 'EXECUTE', mount: function(el){ mount(el); }, refresh: refresh });
G.HG_warmups = G.HG_warmups || [];
G.HG_warmups.push({ id: 'engine', label: 'EXECUTE', run: engineWarm });

})();
