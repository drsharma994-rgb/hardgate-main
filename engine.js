/* =========================================================================
HARDGATE — engine.js
EXECUTE tab: the MASTER GATE ENGINE. Answers the only question that matters:
"should I go long or short, and exactly where do I enter, stop, and take
profit." Philosophy: GATES, NOT SCORES — a single VETO kills the trade and
every card shows its full PASS/VETO/N-A trail. Conviction is a count of
gates passed (STRONG = 6/6, MODERATE = 4-5/6), never a fabricated number.

THE 6-STAGE FUNNEL (pure: gateCandidate(inp) -> {pass, dir, trail, plan}):
  G0 UNIVERSE      symbol + >=210 4h bars (EMA200 warmup). Candidates come
                   from whichever scanners published fresh results (see
                   contract below) else top-24 USDT perps by 24h turnover.
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
  G4 LIQUIDITY/VOL ATR(4h) sanity (0.05%..25% of price), 24h turnover >= $10M
                   floor (unknown = noted, not vetoed), price <= 1.5xATR from
                   EMA21 (anti-chase anchor, mirrors swing).
  G5 NEWS RISK     inp.news or window.hgNewsRisk(sym) ->
                   {blackout|veto:true, event, until} VETOES with the event
                   name shown. Module absent => N/A with an honest note.

SURVIVORS render as execution cards: big LONG/SHORT verdict, conviction,
ENTRY/STOP/T1/T2 via window.smartSetup (local ATR fallback when it is absent
— entry=last 4h close, stop 1.5xATR14, T1 2R, T2 3.5R; a smartSetup NULL is
respected as "structure broken", never fabricated around), R:R, suggested
risk fraction (policy: STRONG 1% / MODERATE 0.5% of equity, unconfirmed
setups halved), and a SEND TO TRADE PLAN button (window.toTrade,
feature-checked). WHY ASIDE lists every rejected candidate with the exact
gate that killed it.

Scanner-results contract checked in order (first fresh non-empty wins):
  window.HG_oiflowResults / oiflowResults / HG_squeezeResults /
  squeezeResults / HG_smartResults / smartResults / HG_scannerResults
  = ['BTCUSDT', ...] | [{sym|symbol, ...}] | {syms:[...], at:<epochMs>}
  Entries stamped older than 10 minutes are treated as stale and skipped.

Classic script, no build step. Loads AFTER binance.js, indicators.js and the
scanner modules — INTEGRATOR: register engine.js LAST (after oiflow.js,
squeeze.js, strats.js etc.) so Stage-0 can see their published results, and
map the tab: HG_TAB_GROUP['execute'] = 'overview' (suggested). Registers
itself via window.HG_tabs.push({id:'execute', label:'EXECUTE', mount,
refresh}). Never throws at load; every optional global is feature-checked.
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
    rejected:  [ { sym, vetoGate } ],
    at: <epochMs> }
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
var MIN_TURNOVER     = 10e6;     // $10M 24h quote turnover floor (G4)
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
var CHUNK            = 4;
var CHUNK_SLEEP_MS   = 150;
var ASIDE_MAX        = 40;

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
    var confirmed = false;
    if (typeof ema === 'function' && rows4h.length >= 60){
      var c4 = rows4h.map(function(r){ return r.c; });
      var e20 = __last(ema(c4, 20)), e50 = __last(ema(c4, 50));
      confirmed = isFinite(e20) && isFinite(e50) && (dir === 'long' ? e20 > e50 : e20 < e50);
    }
    return {
      type: 'ATR', dir: dir, entry: entry,
      stop:   dir === 'long' ? entry - risk     : entry + risk,
      t1:     dir === 'long' ? entry + 2*risk   : entry - 2*risk,
      t2:     dir === 'long' ? entry + 3.5*risk : entry - 3.5*risk,
      rr1: 2, rr2: 3.5, riskPct: risk/entry*100,
      confirmed: confirmed, note: 'local ATR fallback (smartSetup unavailable)'
    };
  }catch(e){ return null; }
}

/* smartSetup (index.html) first; when it is absent, the ATR fallback; when it
   RETURNS null, respect the decline (broken structure) — never fabricate
   around it. Every plan is sanity-checked: stop on the correct side of
   entry, targets beyond entry on the side of dir. */
function buildPlan(dir, cls, rows4h, rows1h){
  var plan = null;
  if (typeof smartSetup === 'function'){
    var c = cls || { dir: dir, longEv: [], shortEv: [], regime: [], score: 0, total: 0 };
    try{ plan = smartSetup(c, rows4h, rows1h) || null; }catch(e){ plan = null; }
    if (!plan) return null;
  }else{
    plan = atrFallbackPlan(dir, rows4h);
  }
  if (!plan) return null;
  var ok = isFinite(plan.entry) && isFinite(plan.stop) && isFinite(plan.t1) && isFinite(plan.t2)
    && (dir === 'long'
        ? (plan.stop < plan.entry && plan.t1 > plan.entry && plan.t2 > plan.entry)
        : (plan.stop > plan.entry && plan.t1 < plan.entry && plan.t2 < plan.entry));
  return ok ? plan : null;
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
  if (to !== null && to < MIN_TURNOVER)
    return die(4, '24h turnover $' + n2(to/1e6, 0) + 'M < $' + n2(MIN_TURNOVER/1e6, 0) + 'M floor — slippage risk');
  var anchorX = Math.abs(p - e21)/a4;
  if (!(anchorX <= ANCHOR_MAX_ATR))
    return die(4, 'price ' + n2(anchorX) + 'xATR from EMA21 > ' + ANCHOR_MAX_ATR + ' — too extended, wait for the pullback (swing anchor)');
  note_(4, true, 'ATR ' + n2(atrPct, 2) + '% of price · ' + (to !== null ? 'turnover $' + n2(to/1e6, 0) + 'M' : 'turnover n/a')
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

async function collectUniverse(){
  var ticks = null;
  if (typeof binanceTickers24h === 'function'){
    try{ ticks = await binanceTickers24h(); }catch(e){ ticks = null; }
  }
  var fromScanners = readScannerResults();
  if (fromScanners) return { syms: fromScanners.syms, source: fromScanners.source, ticks: ticks };
  if (typeof binancePerpUniverse === 'function' && ticks){
    var perps = [];
    try{ perps = await binancePerpUniverse() || []; }catch(e){ perps = []; }
    var uni = perps.filter(function(s){ return ticks[s] && ticks[s].turnoverUsd >= MIN_TURNOVER; })
                   .sort(function(a, b){ return ticks[b].turnoverUsd - ticks[a].turnoverUsd; })
                   .slice(0, MAX_UNIVERSE);
    return { syms: uni, source: 'fallback: top ' + MAX_UNIVERSE + ' USDT perps by 24h turnover (≥$' + n2(MIN_TURNOVER/1e6, 0) + 'M)', ticks: ticks };
  }
  return { syms: [], source: 'none — no scanner results published and binance.js unavailable', ticks: ticks };
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

function cardHTML(r){
  var res = r.res, dir = res.dir, s = res.plan;
  var symHtml = esc(r.sym);
  var badge = s ? ' <span class="gpip ok">' + s.type + '</span> <span class="gpip' + (s.confirmed ? ' ok' : '') + '">'
      + (s.confirmed ? 'CONFIRMED' : 'UNCONFIRMED') + '</span>' : '';
  var verdict = '<div class="verdict ' + dir + '"><div class="vword">' + dir.toUpperCase() + '</div>'
    + '<div class="vwhy"><b>' + res.conviction + ' CONVICTION</b> — ' + res.gatesPassed + ' of 6 gates passed'
    + ' · suggested risk <b>' + FMT(res.riskPct, 2) + '%</b> of equity'
    + (s ? ' · ' + s.type + (s.confirmed ? ' CONFIRMED' : ' UNCONFIRMED') : ' · no executable plan') + '</div></div>';
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
    ? '<div class="plan">' + planText(s) + '</div>'
    : '<div class="plan">All 6 gates passed but no executable plan — the setup builder declined (broken structure) or is unavailable. Direction is real; levels are not. Do not improvise them.</div>';
  var chartBox = s ? '<div class="engineChart" data-sym="' + symHtml + '" style="height:180px;margin-top:8px"></div>' : '';
  var tradeBtn = (s && typeof toTrade === 'function')
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  return '<div class="card ' + dir + '">'
    + '<div class="chead"><span class="sym">' + symHtml + '</span><span class="dir">' + dir.toUpperCase() + ' · EXECUTE' + badge + '</span></div>'
    + verdict + mini + trailHtml + planHtml + chartBox + tradeBtn
    + '</div>';
}

function asideHTML(rejected){
  var rows = rejected.slice(0, ASIDE_MAX).map(function(r){
    var kill = null;
    for (var i = 0; i < r.res.trail.length; i++) if (r.res.trail[i].ok === false){ kill = r.res.trail[i]; break; }
    if (!kill) return '';
    return gateRowHTML(kill.gate, kill.name + ' · ' + r.sym, 'veto', esc(kill.note));
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
var __hasRun = false; // true once a scan attempt has completed (user run or honest abort)
var __el = null;      // last mounted pane, so refresh() can re-run without a click

/* ---------------- BRAIN state snapshot (window.engineState) ----------------
   Last SUCCESSFUL scan's funnel output, cached for the BRAIN meta-engine.
   Aborted/failed re-runs never touch it — the previous good snapshot keeps
   its original `at`. The getter below hands out DEEP-FROZEN deep copies so
   callers can never mutate module state, and never throws. */
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
      rj.push({ sym: rec.sym, vetoGate: (typeof res.vetoGate === 'string') ? res.vetoGate : null });
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
  var optional = ['smartClassify', 'smartSetup', 'hgStructure', 'hgNewsRisk', 'toTrade', 'hgMiniChart'];
  var optMissing = [];
  for (var j = 0; j < optional.length; j++) if (typeof root[optional[j]] !== 'function') optMissing.push(optional[j]);
  return { missing: missing, optMissing: optMissing };
}

async function runScan(el){
  if (__busy) return;
  var btn = el.querySelector('#engineRun'), stat = el.querySelector('#engineStat'),
      cards = el.querySelector('#engineCards'), empty = el.querySelector('#engineEmpty'),
      asidePanel = el.querySelector('#engineAside'), asideList = el.querySelector('#engineAsideList'),
      asideCount = el.querySelector('#engineAsideCount');
  if (!btn || !stat || !cards || !empty) return;
  __busy = true;
  btn.disabled = true; cards.innerHTML = ''; empty.style.display = 'none';
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
    for (var ci = 0; ci < uni.syms.length; ci += CHUNK){
      var chunk = uni.syms.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(sym, k){
        var i = ci + k;
        setProg(el, (i + 1)/uni.syms.length);
        stat.textContent = 'gating ' + (i + 1) + '/' + uni.syms.length + ' · ' + sym;
        try{
          var inp = await gatherSymbol(sym, uni.ticks ? uni.ticks[sym] : null, uni.source);
          var res = gateCandidate(inp);
          var rec = { sym: sym, res: res, rows4h: inp.rows4h,
                      mark: inp.mark, chg24: inp.chg24, fundingPct: inp.fundingPct,
                      oiChgPct: inp.oiChgPct, turnoverUsd: inp.turnoverUsd };
          if (res.pass) survivors.push(rec); else rejected.push(rec);
        }catch(e){ failed++; }
      }));
      await SLEEP(CHUNK_SLEEP_MS);
    }
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
    cards.innerHTML = survivors.map(cardHTML).join('');
    paintCharts(cards, survivors);
    if (asidePanel && asideList){
      asideList.innerHTML = asideHTML(rejected);
      if (asideCount) asideCount.textContent = rejected.length + ' rejected';
      asidePanel.style.display = rejected.length ? 'block' : 'none';
    }
    var nStrong = 0, nPlan = 0;
    for (var ri = 0; ri < survivors.length; ri++){
      if (survivors[ri].res.conviction === 'STRONG') nStrong++;
      if (survivors[ri].res.plan) nPlan++;
    }
    stat.textContent = 'done · ' + survivors.length + ' executions (' + nStrong + ' STRONG · ' + nPlan + ' with plans)'
      + ' · ' + rejected.length + ' aside · universe ' + uni.syms.length + ' (' + uni.source + ')'
      + (failed ? ' · ' + failed + ' symbols failed (skipped)' : '')
      + ' · ' + ((Date.now() - t0)/1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    if (!survivors.length) empty.style.display = 'block';
    setSnapshot(survivors, rejected);   /* BRAIN: cache the successful scan (aborts above never reach here) */
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'engine scan failed: ' + (e && e.message ? e.message : e);
  }finally{
    setProg(el, null);
    btn.disabled = false;
    __hasRun = true;
    __busy = false;
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
      + '<span class="note" id="engineStat"></span></div>'
      + '<div class="note" id="engineDeps" style="margin-top:8px"></div>'
      + '<div class="note" style="margin-top:8px">'
      + '<b>G0 UNIVERSE</b> (scanner results, else top perps by turnover) → <b>G1 STRUCTURE</b> (4H EMA cascade + anti-chop spread + EMA200 side) → '
      + '<b>G2 MOMENTUM</b> (RSI extremes · volume z · close position) → <b>G3 POSITIONING</b> (funding crowding · smart-$ divergence) → '
      + '<b>G4 LIQUIDITY/VOL</b> (ATR sanity · turnover floor · EMA21 anchor) → <b>G5 NEWS RISK</b> (blackout veto). '
      + 'One VETO kills the trade — the trail is printed on every card, and every kill lands in WHY ASIDE. '
      + 'Conviction = gates passed: STRONG 6/6, MODERATE 4-5/6. Suggested risk: STRONG 1% / MODERATE 0.5% of equity, unconfirmed setups halved. '
      + 'Levels come from the SMART $ setup builder with a local ATR fallback; a declined setup is never fabricated around. '
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
    if (__busy) return 'busy';
    if (!__hasRun || !__el) return 'skipped: not run yet';
    await runScan(__el);
    return 'refreshed';
  }catch(e){
    return 'error: ' + (e && e.message ? e.message : String(e));
  }
}

/* ---------------- registration ---------------- */
G.gateCandidate = gateCandidate;
G.engineState = function(){
  try{ return __snap ? __stateView(__snap) : null; }catch(e){ return null; }
};
G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'execute', label: 'EXECUTE', mount: function(el){ mount(el); }, refresh: refresh });

})();
