/* =========================================================================
HARDGATE — oiflow.js
OI FLOW tab: deep positioning / squeeze scanner over the top 40 Binance
USDT-M perps by 24h turnover (>= $30M).

Per symbol it gathers:
  - current funding, percent units (binanceFunding -> lastFundingRate*100)
  - funding-rate z-score: fapi /fapi/v1/fundingRate?symbol=..&limit=90 ->
    zscoreLast(rates*100, 90) (zscoreLast comes from indicators2.js)
  - OI 24h % change (binanceOIHistory '1h' x25, first-to-last finite print)
  - price 24h % change (binanceTickers24h map, chg24)
  - taker buy/sell 24h mean (binanceTakerRatio '1h' x24)
  - retail long% (binanceLongShort '1h' x1, globalLongShortAccountRatio)

Classification is a PURE function —
  window.oiflowClassify({fundingZ, oiChg, pxChg, takerAvg, longPct})
    -> {dir:'LONG'|'SHORT'|null, score, evidence:[strings]}
so tests/test-oiflow.mjs can drive synthetic data through every branch.

Every candidate card (dir + >=2 evidence) then gets a trade plan:
  - binanceKlines 4h/1h x120 (catch-isolated per leg; failure = context-only
    card, never kills the scan)
  - smartSetup(cls, rows4h, rows1h) from index.html when present (cls adapted
    to the smartClassify shape, dir lowercased); otherwise a local ATR14(4h)
    fallback: entry = last close, stop = 1.5xATR against dir, T1 = 2R, T2 = 3.5R
  - plan block ENTRY/STOP/T1/T2 + risk, setup-type + CONFIRMED pips, a
    SEND TO TRADE PLAN button (global toTrade, feature-checked) and a
    hgMiniChart container under the plan (feature-checked, null-safe contract)
Sort: confirmed setups -> unconfirmed setups -> context cards; score then
turnover inside a tier.

Classic script, no build step. Loads AFTER binance.js and indicators2.js.
Never throws at load time; every external global is feature-checked and the
tab degrades to a graceful .note when the data layer is missing.
Registers itself via window.HG_tabs.push({id:'oiflow', label:'OI FLOW', mount, refresh})
— an integrator builds the nav button + pane and calls mount(el) once; the
global HARD REFRESH button awaits refresh() (house contract: async, never
throws, returns 'refreshed' | 'skipped: not run yet' | 'busy', busy-guarded,
and never triggers a first-time full-universe scan on its own).

BRAIN STATE CONTRACT — after each SUCCESSFUL scan the candidate list is
cached in a module-local snapshot, exposed as window.oiflowState() for the
BRAIN meta-engine AND published to window.HG_oiflowResults (the key
engine.js's Stage-0 universe contract already feature-checks — its
{syms, at} form is filled alongside `results` so the master gate engine can
consume the scan without a parse change):
  window.oiflowState()    -> { results: [ { sym, dir, evidence: <number —
                              agreeing-read count>, cls: <string — classifier
                              regime label, else the lead evidence string> } ],
                              at: <epochMs> } | null
  window.HG_oiflowResults = { results: <same rows>, syms: [sym, ...], at }
The getter is zero-arg, NEVER throws (try-catch -> null), returns null before
the first successful scan, and otherwise hands out a DEEP-FROZEN deep copy.
An aborted/failed re-run keeps the PREVIOUS good snapshot with its original
`at` — good data is never replaced by a failed run.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables (per brief) ---------------- */
var MIN_TURNOVER     = 30e6;    // $30M 24h quote turnover floor
var MAX_UNIVERSE     = 40;      // top N symbols by turnover
var PX_DEADZONE      = 0.5;     // |pxChg %| below this = dead
var OI_DEADZONE      = 2.0;     // |oiChg %| below this = dead
var FUND_Z_EXTREME   = 2.0;     // |fundingZ| >= this = crowded
var RETAIL_MAX_LONG  = 65;      // >= => retail max long (fade)
var RETAIL_MAX_SHORT = 35;      // <= => retail max short (fade)
var TAKER_BUY        = 1.05;    // >= => aggressive buyers
var TAKER_SELL       = 0.95;    // <= => aggressive sellers
var MIN_EVIDENCE     = 2;       // >=2 agreeing reads to emit a card
var FUND_HIST_LIMIT  = 90;      // funding prints in the z-score window
var CACHE_MS         = 60*1000;
var CHUNK            = 5;
var CHUNK_SLEEP_MS   = 120;
var FUND_HIST_URL    = 'https://fapi.binance.com/fapi/v1/fundingRate';

/* ---------------- formatters: reuse index.html helpers when present ---------------- */
function _fmtFb(n, d){ d = (d === undefined) ? 2 : d; return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
function _pxFb(n){ if (n === null || n === undefined || !isFinite(n)) return '—'; var a = Math.abs(n); var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8; return Number(n).toLocaleString('en-US', { maximumFractionDigits: d }); }
function _pctFb(n, d){ d = (d === undefined) ? 3 : d; return isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) + '%' : '—'; }
var PX    = (typeof px    === 'function') ? px    : _pxFb;
var FMT   = (typeof fmt   === 'function') ? fmt   : _fmtFb;
var PCT   = (typeof pct   === 'function') ? pct   : _pctFb;
var SLEEP = (typeof sleep === 'function') ? sleep : function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

function __last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }

/* ---------------- tiny fetch/cache layer (binance.js discipline) ---------------- */
var __bucket = (typeof makeTokenBucket === 'function') ? makeTokenBucket(6, 6) : { take: function(){ return 0; } };
var __cache = new Map();

function __cacheGet(key){
  var h = __cache.get(key);
  return (h && (Date.now() - h.at) < CACHE_MS) ? h.val : undefined;
}
function __cachePut(key, val){
  if (val !== null && val !== undefined) __cache.set(key, { at: Date.now(), val: val }); // only cache successes
  return val;
}

async function __fetchJson(url, timeoutMs){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 12000);
  try{
    var w = __bucket.take();
    if (w > 0) await new Promise(function(r){ setTimeout(r, Math.min(w, 2000)); });
    var res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

/* Funding-rate z-score over the last 90 prints (percent units). Null when
   the history is unavailable/empty, zscoreLast is not loaded, or the window
   is not computable (NaN). Cached 60s per symbol. */
async function fundingZscore(sym){
  try{
    if (typeof zscoreLast !== 'function') return null;
    var key = 'fundhist|' + sym;
    var hit = __cacheGet(key); if (hit !== undefined) return hit;
    var raw = await __fetchJson(FUND_HIST_URL + '?symbol=' + encodeURIComponent(sym) + '&limit=' + FUND_HIST_LIMIT);
    if (!Array.isArray(raw) || !raw.length) return null;
    var rates = raw.map(function(r){ return (+r.fundingRate)*100; })
                   .filter(function(x){ return isFinite(x); });
    if (!rates.length) return null;
    var z = zscoreLast(rates, FUND_HIST_LIMIT);
    return __cachePut(key, isFinite(z) ? z : null);
  }catch(e){ return null; }
}

/* =========================================================================
PURE CLASSIFIER — the only export besides the HG_tabs registration.
Every field nullable; null/NaN/non-number inputs simply do not fire.
Deadzones: price ±0.5% / OI ±2% (inclusive thresholds fire).
Returns {dir, score, evidence, longEv, shortEv, regime, total}:
  dir      = majority side ('LONG'|'SHORT'|null on tie or no reads)
  score    = count of agreeing (majority-side) evidence
  evidence = majority-side evidence strings (exact spec labels first)
========================================================================= */
function oiflowClassify(d){
  d = d || {};
  function num(x){ return (typeof x === 'number' && isFinite(x)) ? x : null; }
  var fundingZ = num(d.fundingZ), oiChg = num(d.oiChg), pxChg = num(d.pxChg),
      takerAvg = num(d.takerAvg), longPct = num(d.longPct);
  var longEv = [], shortEv = [], regime = null;

  /* price x OI quadrant — both legs must be outside their deadzones */
  if (pxChg !== null && oiChg !== null){
    var up = pxChg >= PX_DEADZONE, dn = pxChg <= -PX_DEADZONE;
    var oiUp = oiChg >= OI_DEADZONE, oiDn = oiChg <= -OI_DEADZONE;
    var qdetail = ' · px ' + PCT(pxChg, 1) + ' / OI ' + PCT(oiChg, 1);
    if (up && oiUp){ regime = 'NEW LONGS (trend fuel)';        longEv.push(regime + qdetail); }
    else if (up && oiDn){ regime = 'SHORT COVERING (weak rally)'; shortEv.push(regime + qdetail); }
    else if (dn && oiUp){ regime = 'NEW SHORTS (trend fuel)';   shortEv.push(regime + qdetail); }
    else if (dn && oiDn){ regime = 'LONG FLUSH (capitulation)'; longEv.push(regime + qdetail); }
  }

  /* funding z-score crowding — fade the crowded side */
  if (fundingZ !== null){
    if (fundingZ >= FUND_Z_EXTREME)
      shortEv.push('CROWDED LONG (squeeze-down risk) · funding z +' + fundingZ.toFixed(2));
    else if (fundingZ <= -FUND_Z_EXTREME)
      longEv.push('CROWDED SHORT (squeeze-up risk) · funding z ' + fundingZ.toFixed(2));
  }

  /* retail positioning — contrarian fade */
  if (longPct !== null){
    if (longPct >= RETAIL_MAX_LONG)
      shortEv.push('RETAIL MAX LONG (fade) · ' + longPct.toFixed(1) + '% long');
    else if (longPct <= RETAIL_MAX_SHORT)
      longEv.push('RETAIL MAX SHORT (fade) · ' + longPct.toFixed(1) + '% long');
  }

  /* taker flow imbalance */
  if (takerAvg !== null){
    if (takerAvg >= TAKER_BUY)
      longEv.push('AGGRESSIVE BUYERS · taker ' + takerAvg.toFixed(3));
    else if (takerAvg <= TAKER_SELL)
      shortEv.push('AGGRESSIVE SELLERS · taker ' + takerAvg.toFixed(3));
  }

  var dir = longEv.length > shortEv.length ? 'LONG'
          : (shortEv.length > longEv.length ? 'SHORT' : null);
  var score = dir === 'LONG' ? longEv.length : (dir === 'SHORT' ? shortEv.length : 0);
  var evidence = dir === 'LONG' ? longEv.slice() : (dir === 'SHORT' ? shortEv.slice() : []);
  return {
    dir: dir, score: score, evidence: evidence,
    longEv: longEv, shortEv: shortEv, regime: regime,
    total: longEv.length + shortEv.length
  };
}

/* =========================================================================
Data gathering — per symbol, all legs in parallel, never throws.
Returns null only on TOTAL leg failure (caller counts + skips).
========================================================================= */
async function oiflowScanSymbol(sym, tick){
  try{
    var legs = await Promise.all([
      (typeof binanceFunding   === 'function') ? binanceFunding(sym)              : Promise.resolve(null),
      fundingZscore(sym),
      (typeof binanceOIHistory  === 'function') ? binanceOIHistory(sym, '1h', 25) : Promise.resolve(null),
      (typeof binanceTakerRatio === 'function') ? binanceTakerRatio(sym, '1h', 24): Promise.resolve(null),
      (typeof binanceLongShort  === 'function') ? binanceLongShort(sym, '1h', 1)  : Promise.resolve(null)
    ]);
    var fnd = legs[0], fz = legs[1], oih = legs[2], tk = legs[3], ls = legs[4];
    if (!fnd && fz === null && !oih && !tk && !ls) return null;

    /* OI 24h: pct change first-to-last finite print */
    var oiChg = null;
    if (oih && oih.series && oih.series.length >= 2){
      var first = null, last = null;
      for (var i = 0; i < oih.series.length; i++){
        if (isFinite(oih.series[i].oi)){
          if (first === null) first = oih.series[i].oi;
          last = oih.series[i].oi;
        }
      }
      if (first !== null && first > 0 && last !== null) oiChg = (last/first - 1)*100;
    }

    /* taker: mean buySellRatio over the 24 hourly prints */
    var takerAvg = null;
    if (tk && tk.series && tk.series.length){
      var s = 0, n = 0;
      for (var j = 0; j < tk.series.length; j++){
        var b = +tk.series[j].buySellRatio;
        if (isFinite(b)){ s += b; n++; }
      }
      if (n > 0) takerAvg = s/n;
    }

    return {
      sym: sym,
      price:      (fnd && isFinite(fnd.markPrice)) ? fnd.markPrice
                : ((tick && isFinite(tick.mark)) ? tick.mark : NaN),
      fundingPct: (fnd && isFinite(fnd.fundingPct)) ? fnd.fundingPct : null,
      fundingZ:   fz,
      oiChg:      oiChg,
      pxChg:      (tick && isFinite(tick.chg24)) ? tick.chg24 : null,
      takerAvg:   takerAvg,
      longPct:    (ls && ls.latest && isFinite(ls.latest.longPct)) ? ls.latest.longPct : null,
      turnoverUsd:(tick && isFinite(tick.turnoverUsd)) ? tick.turnoverUsd : null
    };
  }catch(e){ return null; }
}

/* ---------------- one-line trade plan, keyed off the lead evidence ---------------- */
function oiflowPlan(r){
  var ev = (r.cls.evidence && r.cls.evidence.length) ? r.cls.evidence[0] : '';
  var stopShort = 'stop above 24h high', stopLong = 'stop below 24h low';
  if (ev.indexOf('CROWDED LONG') === 0 || ev.indexOf('RETAIL MAX LONG') === 0)
    return 'fade crowd: short with ' + stopShort + ' — squeeze-down setup; size small until funding resets.';
  if (ev.indexOf('CROWDED SHORT') === 0 || ev.indexOf('RETAIL MAX SHORT') === 0)
    return 'fade crowd: long with ' + stopLong + ' — squeeze-up setup; size small until funding resets.';
  if (ev.indexOf('NEW LONGS') === 0)
    return 'trend fuel: long the next pullback with ' + stopLong + ' — OI confirms real positioning behind the move.';
  if (ev.indexOf('NEW SHORTS') === 0)
    return 'trend fuel: short the next rally with ' + stopShort + ' — OI confirms real positioning behind the move.';
  if (ev.indexOf('SHORT COVERING') === 0)
    return 'fade weak rally: short strength with ' + stopShort + ' — covering rallies run out of fuel.';
  if (ev.indexOf('LONG FLUSH') === 0)
    return 'capitulation watch: long only after a 1h base forms, ' + stopLong + '.';
  if (ev.indexOf('AGGRESSIVE BUYERS') === 0)
    return 'follow flow: long with ' + stopLong + ' — buyers in control of the tape.';
  if (ev.indexOf('AGGRESSIVE SELLERS') === 0)
    return 'follow flow: short with ' + stopShort + ' — sellers in control of the tape.';
  return (r.cls.dir === 'SHORT')
    ? 'short bias — confirm 4H structure first, ' + stopShort + '.'
    : 'long bias — confirm 4H structure first, ' + stopLong + '.';
}

/* ---------------- setup building: klines -> smartSetup / ATR fallback ---------------- */

/* 4h + 1h x120 for one candidate. Each leg catch-isolated; a failed leg is
   null (context-only card) and never kills the scan. */
async function fetchSetupKlines(sym){
  var out = { rows4h: null, rows1h: null };
  if (typeof binanceKlines !== 'function') return out;
  try{ var r4 = await binanceKlines(sym, '4h', 120); out.rows4h = (r4 && r4.length) ? r4 : null; }catch(e){ out.rows4h = null; }
  try{ var r1 = await binanceKlines(sym, '1h', 120); out.rows1h = (r1 && r1.length) ? r1 : null; }catch(e){ out.rows1h = null; }
  return out;
}

/* Prefer the SMART $ builder from index.html (smartSetup speaks the
   smartClassify shape with lowercase 'long'/'short' — oiflowClassify emits
   LONG/SHORT, so adapt). When it is unavailable, fall back locally:
   entry = last 4h close, stop = 1.5xATR14(4h) against dir, T1 = 2R, T2 = 3.5R.
   Returns the smartSetup-shaped object or null (=> context-only card). */
function oiflowSetup(cls, rows4h, rows1h){
  try{
    if (!cls || !cls.dir) return null;
    var dirLow = String(cls.dir).toLowerCase();
    if (dirLow !== 'long' && dirLow !== 'short') return null;
    if (typeof smartSetup === 'function'){
      var setup = smartSetup({ dir: dirLow, longEv: cls.longEv, shortEv: cls.shortEv,
                          regime: cls.regime, score: cls.score, total: cls.total },
                        rows4h, rows1h) || null;
      if (setup && typeof hgApplyExactEntry === 'function'){
        setup = hgApplyExactEntry(setup, rows4h, { rows1h: rows1h, style: setup.type || 'swing', preferEdge: true }) || setup;
      }
      return setup;
    }
    if (typeof hgPlanLevelsCore === 'function'){
      var pl = hgPlanLevelsCore(dirLow, rows4h, null, { minRr: 2 });
      if (pl){
        var cc = (typeof hgConfirmedCascade === 'function') ? hgConfirmedCascade(rows4h, 'smart') : null;
        return {
          type: 'SWING', dir: dirLow, entry: pl.entry, stop: pl.stop, t1: pl.t1, t2: pl.t2,
          rr1: pl.rr1, rr2: pl.rr2, riskPct: pl.riskPct,
          confirmed: cc ? (cc.confirmed && cc.dir === dirLow) : false,
          note: pl.note || 'hgPlanLevelsCore fallback', planSrc: pl.planSrc, targetPolicy: pl.targetPolicy
        };
      }
    }
    if (typeof atr !== 'function' || !rows4h || !rows4h.length) return null;
    var entry = +rows4h[rows4h.length - 1].c;
    var a4 = __last(atr(rows4h, 14));
    if (!isFinite(entry) || entry <= 0 || !isFinite(a4) || a4 <= 0) return null;
    var risk = 1.5 * a4;
    /* confirmed = 4h EMA20/50 cascade on the side of dir (same rule as smartSetup) */
    var confirmed = false;
    if (typeof ema === 'function' && rows4h.length >= 60){
      var c4 = rows4h.map(function(r){ return r.c; });
      var e20 = __last(ema(c4, 20)), e50 = __last(ema(c4, 50));
      confirmed = isFinite(e20) && isFinite(e50) && (dirLow === 'long' ? e20 > e50 : e20 < e50);
    }
    return {
      type: 'ATR', dir: dirLow, entry: entry,
      stop:   dirLow === 'long' ? entry - risk     : entry + risk,
      t1:     dirLow === 'long' ? entry + 2*risk   : entry - 2*risk,
      t2:     dirLow === 'long' ? entry + 3.5*risk : entry - 3.5*risk,
      rr1: 2, rr2: 3.5, riskPct: risk/entry*100,
      confirmed: confirmed, note: 'local ATR fallback (smartSetup unavailable)'
    };
  }catch(e){ return null; }
}

/* Best-effort mini charts under setup cards. hgMiniChart (index.html, another
   module owns it) is contracted to return null without throwing; absence of
   the whole charting layer is tolerated the same way. */
function paintCharts(cardsEl, results){
  try{
    if (typeof hgMiniChart !== 'function' || !cardsEl || typeof cardsEl.querySelectorAll !== 'function') return;
    var nodes = cardsEl.querySelectorAll('.oiflowChart');
    if (!nodes || !nodes.length) return;
    var bySym = {};
    for (var i = 0; i < results.length; i++) bySym[results[i].sym] = results[i];
    for (var k = 0; k < nodes.length; k++){
      try{
        var r = bySym[nodes[k].getAttribute('data-sym')];
        if (!r || !r.setup) continue;
        var rows = (r.rows4h && r.rows4h.length) ? r.rows4h : r.rows1h;
        if (!rows || !rows.length) continue;
        hgMiniChart(nodes[k], rows, { dir: r.setup.dir, entry: r.setup.entry, stop: r.setup.stop, t1: r.setup.t1, t2: r.setup.t2 });
      }catch(e){ /* one chart failing never kills the rest */ }
    }
  }catch(e){ /* charting is best-effort */ }
}

/* ---------------- card renderer (scanner-cards pattern) ---------------- */
function cardHTML(r){
  var cls = r.cls;
  var dirLow = cls.dir.toLowerCase();
  var fundTxt = (r.fundingPct !== null) ? FMT(r.fundingPct, 4) + '%' : 'n/a';
  if (r.fundingZ !== null) fundTxt += ' · z ' + (r.fundingZ >= 0 ? '+' : '') + r.fundingZ.toFixed(2);
  var contra = cls.dir === 'LONG' ? cls.shortEv : cls.longEv;
  var s = r.setup || null;
  var tier = s ? (s.confirmed ? 'clean' : 'near') : 'forming';
  var tierCls = tier === 'near' ? ' tier-near' : (tier === 'forming' ? ' tier-forming' : '');
  var tierLabel = (typeof hgSetupTierLabel === 'function') ? hgSetupTierLabel(tier) : (tier === 'near' ? 'NEAR' : 'CLEAN');
  /* setup badge in the chead, same shape as the SMART $ cards */
  var badge = s ? ' <span class="gpip ok">' + s.type + '</span> <span class="gpip' + (s.confirmed ? ' ok' : '') + '">'
      + (s.confirmed ? 'CONFIRMED' : 'UNCONFIRMED') + '</span>' : '';
  var planTxt = s
    ? 'ENTRY <b>' + PX(s.entry) + '</b> · STOP <b>' + PX(s.stop) + '</b>'
      + ' · T1 ' + PX(s.t1) + ' (' + FMT(s.rr1, 1) + 'R) · T2 ' + PX(s.t2) + ' (' + FMT(s.rr2, 1) + 'R)'
      + ' · risk ' + FMT(s.riskPct, 2) + '%'
      + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(s.entry, s.stop) : '')
      + (s.note ? ' — ' + s.note : '')
    : oiflowPlan(r);
  var tradeOnclick = (s && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, s.dir, s.entry, s.stop, s.t1, { t2: s.t2, stack: s.stack, scanner: 'oiflow', strategy: 'oiflow' })
      : ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var tradeBtn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (s && typeof bookBtnHTML === 'function')
    ? bookBtnHTML(r.sym, s.dir, s.entry, s.stop, s.t1, { scanner: 'oiflow', strategy: 'oiflow', t2: s.t2, stack: s.stack }) : '';
  var stackHtml = (s && s.stack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(s.stack) : '';
  var chartBox = s ? '<div class="oiflowChart" data-sym="' + r.sym + '" style="height:180px;margin-top:8px"></div>' : '';
  return '<div class="card ' + dirLow + tierCls + '">'
    + '<div class="chead"><span class="sym">' + r.sym + '</span><span class="dir">' + cls.dir + ' · ' + cls.score + ' EVIDENCE · ' + tierLabel + badge + '</span></div>'
    + '<div class="mini">'
    + '<span class="k">mark</span><span>' + PX(r.price) + '</span>'
    + '<span class="k">24h change</span><span>' + (r.pxChg !== null ? PCT(r.pxChg, 2) : '—') + '</span>'
    + '<span class="k">funding 8h</span><span>' + fundTxt + '</span>'
    + '<span class="k">OI 24h Δ</span><span>' + (r.oiChg !== null ? PCT(r.oiChg, 1) : 'n/a') + '</span>'
    + '<span class="k">taker 24h avg</span><span>' + (r.takerAvg !== null ? FMT(r.takerAvg, 3) : 'n/a') + '</span>'
    + '<span class="k">retail long</span><span>' + (r.longPct !== null ? FMT(r.longPct, 1) + '%' : 'n/a') + '</span>'
    + '<span class="k">turnover 24h</span><span>' + (r.turnoverUsd !== null ? '$' + FMT(r.turnoverUsd/1e6, 0) + 'M' : '—') + '</span>'
    + '</div>'
    + '<div class="gates">'
    + cls.evidence.map(function(g){ return '<span class="gpip ok">' + g + '</span>'; }).join('')
    + contra.map(function(g){ return '<span class="gpip">' + g + '</span>'; }).join('')
    + '</div>'
    + '<div class="plan">' + planTxt + '</div>'
    + stackHtml
    + chartBox
    + tradeBtn
    + bookBtn
    + '</div>';
}

/* ---------------- tab UI ---------------- */
function setProg(el, f){
  var p = el.querySelector('#oiflowProg');
  if (!p) return;
  p.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && p.firstElementChild) p.firstElementChild.style.width = (f*100).toFixed(1) + '%';
}

function depStatus(){
  var root = (typeof globalThis !== 'undefined') ? globalThis : G;
  var need = ['binancePerpUniverse', 'binanceTickers24h', 'binanceFunding', 'binanceKlines',
              'binanceOIHistory', 'binanceTakerRatio', 'binanceLongShort', 'zscoreLast'];
  var missing = [];
  for (var i = 0; i < need.length; i++){
    if (typeof root[need[i]] !== 'function') missing.push(need[i]);
  }
  return missing;
}

/* ---------------- hard-refresh contract state ----------------
   The registration carries refresh() alongside mount() for the global HARD
   REFRESH button. refresh() never throws, returns a short status string,
   busy-guards overlapping invocations, and never fires a first-time
   full-universe scan on its own — a global refresh must stay cheap for tabs
   the user has never run (skip instead). */
var __scanning = false;   /* a scan is in flight (RUN button or refresh) */
var __hasRun    = false;  /* at least one scan attempt finished since mount */
var __mountedEl = null;   /* pane element from the latest mount() */

/* ---------------- BRAIN state snapshot (window.oiflowState + HG_oiflowResults)
   Last SUCCESSFUL scan's candidate rows, cached for the BRAIN meta-engine and
   published on the key engine.js's Stage-0 already reads. Aborted/failed
   re-runs never touch them — the previous good snapshot keeps its original
   `at`. The getter hands out DEEP-FROZEN deep copies and never throws. */
var __oiSnap = null;
function __oiStateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = __oiStateView(v[k]);
  }
  Object.freeze(out);
  return out;
}
function publishOiflowState(results){
  try{
    var rows = [], syms = [], i, r, clsTxt;
    for (i = 0; i < results.length; i++){
      r = results[i];
      if (!r || !r.cls) continue;
      clsTxt = (typeof r.cls.regime === 'string' && r.cls.regime) ? r.cls.regime
             : ((r.cls.evidence && r.cls.evidence.length) ? String(r.cls.evidence[0]) : '');
      rows.push({ sym: r.sym, dir: r.cls.dir,
                  evidence: (typeof r.cls.score === 'number' && isFinite(r.cls.score)) ? r.cls.score : 0,
                  cls: clsTxt });
      syms.push(r.sym);
    }
    var at = Date.now();
    __oiSnap = { results: rows, at: at };
    /* engine.js Stage-0 contract reads {syms, at} from this key; `results`
       mirrors window.oiflowState() for the BRAIN. */
    G.HG_oiflowResults = { results: rows, syms: syms, at: at };
  }catch(e){ /* state publishing must never break the scan */ }
}

async function oiflowRefresh(){
  try{
    if (__scanning) return 'busy';
    if (!__hasRun || !__mountedEl) return 'skipped: not run yet';
    await runScan(__mountedEl);
    return 'refreshed';
  }catch(e){ return 'error'; }
}

async function runScan(el){
  var btn = el.querySelector('#oiflowRun'), stat = el.querySelector('#oiflowStat'),
      cards = el.querySelector('#oiflowCards'), empty = el.querySelector('#oiflowEmpty');
  if (!btn || !stat || !cards || !empty) return;
  if (__scanning) return;             /* busy guard — never double-fetch */
  __scanning = true;
  var t0 = Date.now();
  try{
    btn.disabled = true; cards.innerHTML = ''; empty.style.display = 'none';
    stat.className = 'note';
    if (typeof binancePerpUniverse !== 'function' || typeof binanceTickers24h !== 'function'){
      stat.className = 'note warn';
      stat.textContent = 'Binance data layer (binance.js) not loaded — check script order.';
      return;
    }
    stat.textContent = 'loading Binance perp universe…';
    var res = await Promise.all([binancePerpUniverse(), binanceTickers24h()]);
    var perps = res[0] || [], ticks = res[1];
    if (!perps.length || !ticks){ stat.textContent = 'Binance universe unavailable (network issue?)'; return; }
    var uni = perps.filter(function(s){ return ticks[s] && ticks[s].turnoverUsd >= MIN_TURNOVER; })
                   .sort(function(a, b){ return ticks[b].turnoverUsd - ticks[a].turnoverUsd; })
                   .slice(0, MAX_UNIVERSE);
    if (!uni.length){
      stat.textContent = 'no perps above $30M 24h turnover right now';
      empty.style.display = 'block';
      return;
    }
    var results = [], failed = 0;
    for (var ci = 0; ci < uni.length; ci += CHUNK){
      var chunk = uni.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(sym, k){
        var i = ci + k;
        try{
          setProg(el, (i+1)/uni.length);
          stat.textContent = 'scanning ' + (i+1) + '/' + uni.length + ' · ' + sym;
          var r = await oiflowScanSymbol(sym, ticks[sym]);
          if (!r){ failed++; return; }
          r.cls = oiflowClassify({ fundingZ: r.fundingZ, oiChg: r.oiChg, pxChg: r.pxChg,
                                   takerAvg: r.takerAvg, longPct: r.longPct });
          if (!(r.cls.dir && r.cls.score >= MIN_EVIDENCE)) return;
          /* candidate: pull 4h/1h for the plan — kline failure = context-only card */
          var kl = await fetchSetupKlines(sym);
          r.rows4h = kl.rows4h; r.rows1h = kl.rows1h;
          r.setup = oiflowSetup(r.cls, r.rows4h, r.rows1h);
          if (r.setup && typeof hgSetupStackAttachPlan === 'function' && !r.setup.stack){
            var oiEv = (r.cls.dir === 'LONG' ? r.cls.longEv : r.cls.shortEv) || [];
            hgSetupStackAttachPlan(r.setup, {
              sym: r.sym, style: 'smart', rows4h: r.rows4h, rows1h: r.rows1h,
              ticker: { fundingPct: r.fundingPct },
              clean: r.setup.confirmed === true, nearClean: r.setup.confirmed !== true,
              gatesPassed: r.setup.confirmed ? 7 : 6, gatesTotal: 7,
              positioning: { items: oiEv.slice(0, 6).map(function(e){ return { label: 'OI evidence', detail: e, align: 'with' }; }) }
            });
          }
          results.push(r);
        }catch(e){ failed++; }
      }));
      await SLEEP(CHUNK_SLEEP_MS);
    }
    /* confirmed setups -> unconfirmed setups -> context cards; score then turnover inside a tier */
    results.sort(function(a, b){
      var ta = a.setup ? (a.setup.confirmed ? 0 : 1) : 2;
      var tb = b.setup ? (b.setup.confirmed ? 0 : 1) : 2;
      return (ta - tb) || (b.cls.score - a.cls.score) || ((b.turnoverUsd || 0) - (a.turnoverUsd || 0));
    });
    cards.innerHTML = results.map(cardHTML).join('');
    paintCharts(cards, results);
    var nSetup = 0, nConf = 0;
    for (var ri = 0; ri < results.length; ri++){
      if (results[ri].setup){ nSetup++; if (results[ri].setup.confirmed) nConf++; }
    }
    stat.textContent = 'done · ' + nSetup + ' setups (' + nConf + ' confirmed) · ' + (results.length - nSetup) + ' context'
      + ' · universe ' + uni.length + ' perps ≥$30M'
      + (failed ? ' · ' + failed + ' symbols failed (skipped)' : '')
      + ' · ' + ((Date.now() - t0)/1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    if (!results.length) empty.style.display = 'block';
    publishOiflowState(results);   /* BRAIN: cache + publish the successful scan (aborts above never reach here) */
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'oiflow scan failed: ' + (e && e.message ? e.message : e);
  }finally{
    __scanning = false;
    __hasRun = true;
    setProg(el, null);
    btn.disabled = false;
  }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<div class="panel">'
      + '<h2>OI FLOW — positioning &amp; squeeze scanner <span>top 40 Binance perps ≥$30M · funding z(90) · OI Δ24h · taker 24h · retail</span></h2>'
      + '<div class="row"><button class="btn" id="oiflowRun">RUN SCAN</button>'
      + '<span class="note" id="oiflowStat"></span></div>'
      + '<div class="note" id="oiflowDeps" style="margin-top:8px"></div>'
      + '<div class="note" style="margin-top:8px">Evidence, not signals. Every card tallies independent positioning reads: '
      + '<b>price×OI quadrant</b> (new longs/shorts = trend fuel · covering/flush = fade), '
      + '<b>funding z-score</b> (|z| ≥ 2 over 90 prints = crowded side, squeeze risk), '
      + '<b>retail contrarian</b> (≥65% / ≤35% long = fade), '
      + '<b>taker imbalance</b> (24h mean ≥1.05 / ≤0.95). '
      + 'Direction = evidence majority, ≥2 agreeing reads required. Deadzones: price ±0.5%, OI ±2% — flat books fabricate nothing. '
      + 'Cards with a readable 4H/1H book get a full plan (ENTRY · STOP · T1 2R · T2 3.5R) from the SMART $ setup builder — local ATR fallback when it is unavailable — plus a chart and one-tap handoff to TRADE PLAN; confirmed setups (4H EMA20/50 cascade) rank first.</div>'
      + '<div class="prog" id="oiflowProg"><i></i></div>'
      + '</div>'
      + '<div id="oiflowDesk"></div>'
      + '<div class="cards" id="oiflowCards"></div>'
      + '<div class="empty" id="oiflowEmpty" style="display:none">No positioning edges right now — books are balanced.</div>';
    __mountedEl = el;
    var deps = el.querySelector('#oiflowDeps');
    if (deps){
      var missing = depStatus();
      if (missing.length){
        deps.className = 'note warn';
        deps.textContent = 'missing globals: ' + missing.join(', ') + ' — those legs will sit out (load-order issue?).';
      }else{
        deps.textContent = 'data: binance.js fapi layer + funding history · zscore via indicators2.js · 60s cache · chunks of 5';
      }
    }
    var btn = el.querySelector('#oiflowRun');
    if (btn) btn.addEventListener('click', function(){ runScan(el); });
    try{
      if (typeof hgSetupPaintDesk === 'function'){
        hgSetupPaintDesk('oiflowDesk', { kind: 'oiflow', tab: 'OI FLOW',
          note: 'CONFIRMED cascade = CLEAN. UNCONFIRMED positioning edge = NEAR watch-only.' });
      }else if (typeof hgSetupInjectStyles === 'function') hgSetupInjectStyles();
    }catch(eD){}
  }catch(e){ /* never throw at mount */ }
}

/* ---------------- registration ---------------- */
G.oiflowClassify = oiflowClassify;
G.oiflowState = function(){
  try{ return __oiSnap ? __oiStateView(__oiSnap) : null; }catch(e){ return null; }
};
/* ---------------- BRAIN warm-up hook ----------------
   Reuses the real runScan against an inert pane (querySelector hands out
   stubs) so the BRAIN can warm this layer without mounting the tab. The
   mounted tab's own busy guard (__scanning) is shared. Never throws. */
function __oiWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}
async function oiflowWarm(){
  try{
    if (G.oiflowState && G.oiflowState()) return 'fresh';
    if (__scanning) return 'busy';
    await runScan({ querySelector: function(){ return __oiWarmShim(); } });
    return (G.oiflowState && G.oiflowState()) ? 'warmed' : 'unavailable: scan did not complete (network?)';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'oiflow', label: 'OI FLOW', mount: function(el){ mount(el); }, refresh: oiflowRefresh });
G.HG_warmups = G.HG_warmups || [];
G.HG_warmups.push({ id: 'oiflow', label: 'OI FLOW', run: oiflowWarm });

})();
