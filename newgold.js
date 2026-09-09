/* =========================================================================
HARDGATE — newgold.js (v690)
NEW GOLD tab: XAUUSD triple-confirmation setups from the user-supplied Pine
script "Triple Confirmation: SMC + ML + Momentum".

The Pine script combines:
  1. SMC: Fair Value Gap (FVG) mitigation zones
  2. ML proxy: VWMA-50 baseline as bullish/bearish regime
  3. Momentum: RSI(14) crossing its own SMA(9) as trigger

Long fires when: price is inside a bull FVG AND VWMA-50 baseline is above
price ceiling AND RSI crosses ABOVE its 9-SMA. Short: mirror.

Scan surface: XAUUSD 1H + XAUUSD 4H (user asked for both). Entry MARKET at
close, stop at FVG opposite edge, T1 = 1.5R, T2 = 2.5R (user picked the
tighter TP ladder).

Every card flows through hgPlanFromRisk (v681 ATR floor), gets graded via
hgSolidityGrade with tab='NEWGOLD:1H'|'NEWGOLD:4H' and kind='TRIPLE-CONF',
records to the forward log so v685 veto / v687 PRIME / v689 kill-list all
apply automatically.

Registers window.HG_tabs so the shell can render it.

Feature-checked throughout: missing getXAUCandles, missing plans helpers,
missing solidity — all degrade gracefully rather than crashing the tab.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* --- constants (mirror the Pine script) ------------------------------- */
var ML_LOOKBACK = 50;      /* VWMA-50 baseline */
var RSI_LEN     = 14;      /* RSI(14) momentum */
var RSI_SMA_LEN = 9;       /* SMA(9) of RSI */
var FVG_MAX_AGE = 30;      /* Bars to keep an unfilled FVG alive; older FVGs
                               are considered stale and no longer valid
                               mitigation targets. Pine keeps them until
                               overwritten; we cap to avoid ancient gaps. */
var KL_LIMIT    = 300;     /* Enough for ML_LOOKBACK (50) + FVG history */
var MIN_RR      = 1.5;     /* T1 floor (user chose 1.5R / 2.5R ladder) */
var T1_R        = 1.5;
var T2_R        = 2.5;

var HORIZONS = [
  { tf: '1h', label: '1H' },
  { tf: '4h', label: '4H' }
];

/* v691: auto-refresh cadence. RSI cross detection lives entirely on
   closed-bar semantics but intra-bar price motion still moves through
   FVG zones and updates the ML baseline, so a 5-minute re-scan keeps
   the trigger window responsive without waiting for a full 1H/4H bar
   close. Pattern mirrors omnigold's __og.__uniTimer (mount-time only,
   never module load) so Node test processes never hang on a stray
   interval. */
var NG_AUTO_REFRESH_MS = 5 * 60 * 1000;

/* --- state ------------------------------------------------------------ */
var __ng = { busy: false, snap: null, at: 0, __timer: null, __mountEl: null };

/* --- helpers ---------------------------------------------------------- */
function fmtF(n, d){ n = +n; if (!isFinite(n)) return '\u2014'; return n.toFixed(d != null ? d : 2); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function last(arr){ return (arr && arr.length) ? arr[arr.length - 1] : undefined; }

/* --- indicators ------------------------------------------------------- */

/* VWMA over `p` bars. Pine's ta.vwma weighs each close by its volume.
   Gold feeds often lack volume, so degrade to plain SMA when volume is
   absent or zero across the window. That is exactly what ta.vwma reduces
   to when all volumes are equal; it preserves the Pine semantics on
   volume-less feeds instead of returning NaN and killing the signal. */
function vwmaSeries(rows, p){
  if (!Array.isArray(rows) || rows.length < p) return [];
  var out = [];
  for (var i = 0; i < rows.length; i++){
    if (i < p - 1){ out.push(NaN); continue; }
    var sumPV = 0, sumV = 0, sawVol = false, sumC = 0;
    for (var j = i - p + 1; j <= i; j++){
      var c = +rows[j].c;
      var v = +rows[j].v;
      if (isFinite(v) && v > 0){ sumPV += c * v; sumV += v; sawVol = true; }
      sumC += c;
    }
    out.push(sawVol && sumV > 0 ? (sumPV / sumV) : (sumC / p));
  }
  return out;
}

/* RSI(p). Uses the shared W.rsi() when available (indicators.js), else
   Wilder-style computed inline. */
function rsiSeries(rows, p){
  var c = rows.map(function(r){ return +r.c; });
  if (typeof W.rsi === 'function'){
    try { return W.rsi(c, p) || []; } catch(e){}
  }
  /* Fallback inline. */
  if (c.length < p + 1) return c.map(function(){ return NaN; });
  var gains = 0, losses = 0, i, out = [];
  for (i = 1; i <= p; i++){
    var d = c[i] - c[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  var avgGain = gains / p, avgLoss = losses / p;
  for (i = 0; i < p; i++) out.push(NaN);
  out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (i = p + 1; i < c.length; i++){
    var d2 = c[i] - c[i - 1];
    var g = d2 > 0 ? d2 : 0;
    var l = d2 < 0 ? -d2 : 0;
    avgGain = (avgGain * (p - 1) + g) / p;
    avgLoss = (avgLoss * (p - 1) + l) / p;
    out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return out;
}

function smaSeries(vals, p){
  var out = [], i, j, sum;
  for (i = 0; i < vals.length; i++){
    if (i < p - 1){ out.push(NaN); continue; }
    sum = 0;
    for (j = i - p + 1; j <= i; j++){
      if (!isFinite(vals[j])){ sum = NaN; break; }
      sum += vals[j];
    }
    out.push(isFinite(sum) ? sum / p : NaN);
  }
  return out;
}

/* --- FVG detection ---------------------------------------------------- */

/* Bullish FVG (Pine): low[0] > high[2] AND close[1] > open[1].
   The gap is [high[2], low[0]] and is a valid buy zone until mitigated.

   Bearish FVG (Pine): high[0] < low[2] AND close[1] < open[1].
   The gap is [high[0], low[2]] and is a valid sell zone until mitigated.

   Returns { bullTop, bullBot, bearTop, bearBot, bullAge, bearAge } as of
   the LAST bar. Ages are bars-since-formation; FVGs older than
   FVG_MAX_AGE bars are dropped as stale (they've usually been touched by
   noise even if the loose mitigation test disagrees). */
function detectLastFvgs(rows){
  var out = { bullTop: NaN, bullBot: NaN, bearTop: NaN, bearBot: NaN,
              bullAge: NaN, bearAge: NaN };
  if (!Array.isArray(rows) || rows.length < 3) return out;
  var lastIdx = rows.length - 1;
  /* Scan from newest to oldest so we keep the freshest unmitigated FVG. */
  for (var i = lastIdx; i >= 2; i--){
    var r0 = rows[i], r1 = rows[i - 1], r2 = rows[i - 2];
    if (!r0 || !r1 || !r2) continue;
    var age = lastIdx - i;
    if (age > FVG_MAX_AGE) break;
    /* Bull FVG at bar i: low[i] > high[i-2] AND close[i-1] > open[i-1] */
    if (!isFinite(out.bullTop)
        && r0.l > r2.h && r1.c > r1.o){
      out.bullTop = r0.l;
      out.bullBot = r2.h;
      out.bullAge = age;
    }
    /* Bear FVG at bar i: high[i] < low[i-2] AND close[i-1] < open[i-1] */
    if (!isFinite(out.bearTop)
        && r0.h < r2.l && r1.c < r1.o){
      out.bearTop = r2.l;
      out.bearBot = r0.h;
      out.bearAge = age;
    }
    if (isFinite(out.bullTop) && isFinite(out.bearTop)) break;
  }
  return out;
}

/* --- signal assessment ----------------------------------------------- */

/* Given closed rows for a horizon, return a setup object when the triple
   confirmation fires; otherwise null. */
function ngAssess(rows){
  if (!Array.isArray(rows) || rows.length < ML_LOOKBACK + 5) return null;
  var n = rows.length;
  var closes = rows.map(function(r){ return +r.c; });
  var lastClose = closes[n - 1];
  if (!isFinite(lastClose)) return null;

  /* 1. ML baseline regime */
  var ml = vwmaSeries(rows, ML_LOOKBACK);
  var mlLast = ml[n - 1];
  if (!isFinite(mlLast)) return null;
  var isMlBull = lastClose > mlLast;
  var isMlBear = lastClose < mlLast;

  /* 2. FVG zone check */
  var fvgs = detectLastFvgs(rows);
  var inBull = isFinite(fvgs.bullTop) && lastClose <= fvgs.bullTop && lastClose >= fvgs.bullBot;
  var inBear = isFinite(fvgs.bearTop) && lastClose <= fvgs.bearTop && lastClose >= fvgs.bearBot;

  /* 3. RSI momentum crossover */
  var rsi = rsiSeries(rows, RSI_LEN);
  var rsiSma = smaSeries(rsi, RSI_SMA_LEN);
  var rNow = rsi[n - 1], rPrev = rsi[n - 2];
  var sNow = rsiSma[n - 1], sPrev = rsiSma[n - 2];
  var bullCross = isFinite(rNow) && isFinite(rPrev) && isFinite(sNow) && isFinite(sPrev)
    && rPrev <= sPrev && rNow > sNow;
  var bearCross = isFinite(rNow) && isFinite(rPrev) && isFinite(sNow) && isFinite(sPrev)
    && rPrev >= sPrev && rNow < sNow;

  /* Triple-confirmation fire */
  var dir = null, stop = NaN, fvgHi = NaN, fvgLo = NaN, fvgAge = NaN;
  if (isMlBull && inBull && bullCross){
    dir = 'long';
    stop = fvgs.bullBot;
    fvgHi = fvgs.bullTop; fvgLo = fvgs.bullBot; fvgAge = fvgs.bullAge;
  } else if (isMlBear && inBear && bearCross){
    dir = 'short';
    stop = fvgs.bearTop;
    fvgHi = fvgs.bearTop; fvgLo = fvgs.bearBot; fvgAge = fvgs.bearAge;
  }
  if (!dir) return null;
  if (!isFinite(stop)) return null;

  var entry = lastClose;
  /* Pine's stop is the FVG opposite edge exactly. That can be very tight
     if the FVG is narrow. hgPlanFromRisk (v681) will widen to 0.5*ATR
     floor if needed; the flag flows through so the SOLIDITY G5 gate
     sees it. */
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;

  var t1 = dir === 'long' ? entry + T1_R * risk : entry - T1_R * risk;
  var t2 = dir === 'long' ? entry + T2_R * risk : entry - T2_R * risk;

  /* Build a plan through the shared plans layer so it inherits the v681
     ATR-floor stop widening. */
  var plan = null;
  if (typeof W.hgPlanFromRisk === 'function'){
    try {
      plan = W.hgPlanFromRisk(dir, entry, stop, {
        t1R: T1_R, t2R: T2_R, minRr: MIN_RR,
        targetPolicy: 'R-multiples (1.5R/2.5R) \u00b7 FVG stop',
        rows: rows
      });
    } catch(ePl){ plan = null; }
  }
  if (plan){
    entry = plan.entry; stop = plan.stop; t1 = plan.t1; t2 = plan.t2;
  }

  return {
    dir: dir,
    entry: entry, stop: stop, t1: t1, t2: t2,
    rr1: Math.abs(t1 - entry) / risk,
    rr2: Math.abs(t2 - entry) / risk,
    risk: risk, riskPct: risk / entry * 100,
    stopWidened: plan && plan.stopWidened === true,
    fvg: { top: fvgHi, bot: fvgLo, ageBars: fvgAge },
    ml: { baseline: mlLast, regime: isMlBull ? 'bullish' : 'bearish' },
    rsi: { now: rNow, sma: sNow },
    kind: 'TRIPLE-CONF',
    confluenceCount: 3 /* ML + FVG + momentum */
  };
}

/* --- fetch ------------------------------------------------------------ */

function fetchXau(tf, n){
  /* Prefer omnigold's shared fetcher when present, else the raw
     getXAUCandles global. */
  if (typeof W.hgOgFetchRows === 'function'){
    try {
      return W.hgOgFetchRows(tf, n).then(function(pack){
        return { rows: (pack && pack.rows) || [], source: (pack && pack.source) || 'unknown' };
      });
    } catch(e){ /* fall through */ }
  }
  if (typeof W.getXAUCandles === 'function'){
    try {
      return Promise.resolve(W.getXAUCandles(tf, n))
        .then(function(rows){ return { rows: rows || [], source: 'getXAUCandles' }; })
        .catch(function(){ return { rows: [], source: 'error' }; });
    } catch(e){}
  }
  return Promise.resolve({ rows: [], source: 'no-fetcher' });
}

/* --- scan runner ------------------------------------------------------ */

async function ngRunScan(){
  if (__ng.busy) return 'busy';
  __ng.busy = true;
  var results = [];
  var errors = [];
  try {
    for (var hi = 0; hi < HORIZONS.length; hi++){
      var h = HORIZONS[hi];
      var pack;
      try { pack = await fetchXau(h.tf, KL_LIMIT); }
      catch(eF){ pack = { rows: [], source: 'fetch-error' }; errors.push(h.label + ': fetch failed'); }
      var rows = pack && pack.rows ? pack.rows : [];
      if (!rows.length){ errors.push(h.label + ': no bars (source=' + (pack && pack.source) + ')'); continue; }
      var setup = ngAssess(rows);
      var record = {
        horizon: h.label,
        tf: h.tf,
        source: pack.source,
        setup: setup,
        rows: rows
      };
      /* Compute solidity via the shared helper so the same veto/promotion/
         kill pipeline applies. Kind is fixed at TRIPLE-CONF; the tab key
         is per-horizon (NEWGOLD:1H, NEWGOLD:4H) so measured evidence is
         separated by timeframe. */
      if (setup && typeof W.hgSolidityGrade === 'function'){
        try {
          var planForSol = {
            dir: setup.dir,
            entry: setup.entry, stop: setup.stop, t1: setup.t1, t2: setup.t2,
            rr1: setup.rr1, minRr: MIN_RR,
            tape: setup.dir, /* self-consistent \u2014 ML regime = direction */
            stopWidened: setup.stopWidened,
            consensus: { nAgree: setup.confluenceCount },
            liveGrade: 'fresh' /* market fill = fresh by definition */
          };
          record.solidity = W.hgSolidityGrade(planForSol, {
            minRr: MIN_RR,
            tab: 'NEWGOLD:' + h.label,
            kind: 'TRIPLE-CONF'
          });
        } catch(eSol){}
      }
      results.push(record);
    }
    /* Forward log every firing so the accumulated evidence grows. */
    try {
      if (typeof W.hgFwdRecordScan === 'function'){
        for (var ri = 0; ri < results.length; ri++){
          var r = results[ri];
          if (!r.setup) continue;
          W.hgFwdRecordScan('NEWGOLD:' + r.horizon, r.tf, [{
            sym: 'XAUUSD', dir: r.setup.dir,
            entry: r.setup.entry, stop: r.setup.stop, t1: r.setup.t1,
            mechanic: 'TRIPLE-CONF',
            ticket: !!(r.solidity && r.solidity.leadEligible)
          }], { horizonBars: 30 });
        }
        /* Also settle any prior open records for this scan's rows. */
        if (typeof W.hgFwdResolve === 'function'){
          for (var rj = 0; rj < results.length; rj++){
            var rr = results[rj];
            if (!rr.rows || !rr.rows.length) continue;
            try { W.hgFwdResolve('XAUUSD', rr.tf, rr.rows); } catch(eR){}
          }
        }
      }
    } catch(eFwd){ /* silent */ }

    /* Kill-list filter (v689): drop any record whose solidity says killed. */
    var kept = [];
    var killedCount = 0;
    var killedKinds = {};
    for (var kli = 0; kli < results.length; kli++){
      var kr = results[kli];
      if (kr.solidity && kr.solidity.killed === true){
        killedCount++;
        killedKinds['TRIPLE-CONF'] = (killedKinds['TRIPLE-CONF'] || 0) + 1;
        continue;
      }
      kept.push(kr);
    }
    try {
      W.__hgSolKillLast = W.__hgSolKillLast || {};
      W.__hgSolKillLast['NEWGOLD'] = {
        killedCount: killedCount,
        killedKinds: killedKinds,
        at: Date.now()
      };
    } catch(eStash){}
    results = kept;

    __ng.snap = { at: Date.now(), results: results, errors: errors };
    return { status: results.length ? 'refreshed' : 'empty', results: results, errors: errors };
  } catch(e){
    return { status: 'error', results: [], errors: [String(e && e.message || e)] };
  } finally {
    __ng.busy = false;
  }
}

/* --- render ----------------------------------------------------------- */

function cardHtml(r){
  if (!r) return '';
  if (!r.setup){
    return '<div class="card" style="opacity:0.65">'
      + '<div class="chead"><span class="sym">XAUUSD</span>'
      + '<span class="dir">' + esc(r.horizon) + ' \u00b7 no triple-confirmation fire</span></div>'
      + '<div class="mini">'
      + '<span class="k">source</span><span>' + esc(r.source || '\u2014') + '</span>'
      + '<span class="k">wait for</span><span>price inside FVG, RSI cross, ML baseline confirmation</span>'
      + '</div>'
      + '</div>';
  }
  var s = r.setup;
  var solChip = '';
  try {
    if (r.solidity && typeof W.hgSolidityChipHtml === 'function'){
      solChip = W.hgSolidityChipHtml(r.solidity);
    }
  } catch(eSc){}

  var dirLabel = s.dir === 'long' ? 'LONG' : 'SHORT';
  var isBest = r.solidity && r.solidity.leadEligible;

  return '<div class="card ' + (s.dir === 'long' ? 'long' : 'short') + (isBest ? ' best' : '') + '">'
    + '<div class="chead"><span class="sym">XAUUSD</span>'
    + '<span class="dir">' + dirLabel + ' \u00b7 TRIPLE CONF \u00b7 ' + esc(r.horizon) + ' \u00b7 ' + esc(r.source || '') + '</span>'
    + (solChip ? ' ' + solChip : '')
    + '</div>'
    + '<div class="mini">'
    + '<span class="k">ml baseline</span><span>' + fmtF(s.ml.baseline, 2) + ' \u00b7 ' + esc(s.ml.regime) + '</span>'
    + '<span class="k">fvg zone</span><span>' + fmtF(s.fvg.bot, 2) + ' \u2192 ' + fmtF(s.fvg.top, 2) + ' \u00b7 ' + (isFinite(s.fvg.ageBars) ? s.fvg.ageBars + 'b old' : '?') + '</span>'
    + '<span class="k">rsi \u00b7 sma9</span><span>' + fmtF(s.rsi.now, 1) + ' \u00b7 ' + fmtF(s.rsi.sma, 1) + '</span>'
    + '</div>'
    + '<div class="hg-mp-grid">'
    + '<div><i>ENTRY</i><b>' + fmtF(s.entry, 2) + '</b><u>' + (s.dir === 'long' ? 'MARKET BUY' : 'MARKET SELL') + '</u></div>'
    + '<div><i>STOP</i><b>' + fmtF(s.stop, 2) + '</b><u>FVG ' + (s.dir === 'long' ? 'bottom' : 'top') + (s.stopWidened ? ' \u00b7 widened to 0.5\u00d7ATR' : '') + '</u></div>'
    + '<div><i>T1 (1.5R)</i><b>' + fmtF(s.t1, 2) + '</b><u>rr ' + fmtF(s.rr1, 2) + '</u></div>'
    + '<div><i>T2 (2.5R)</i><b>' + fmtF(s.t2, 2) + '</b><u>rr ' + fmtF(s.rr2, 2) + '</u></div>'
    + '</div>'
    + '<div class="note" style="margin-top:6px;font-size:11px;opacity:0.7">Risk ' + fmtF(s.riskPct, 2) + '% \u00b7 not a win probability</div>'
    + '</div>';
}

function refreshKilledNote(el){
  try {
    var noteEl = el.querySelector('#ngKilledNote');
    if (!noteEl) return;
    if (typeof W.hgSolidityLastKilled !== 'function' || typeof W.hgSolidityKilledNoteHtml !== 'function') return;
    noteEl.innerHTML = W.hgSolidityKilledNoteHtml(W.hgSolidityLastKilled('NEWGOLD'));
  } catch(e){}
}

function refreshPerfPanels(el){
  try {
    var panelEl = el.querySelector('#ngPerf');
    if (!panelEl) return;
    if (typeof W.hgPerfPanelHtml !== 'function'){ panelEl.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < HORIZONS.length; i++){
      html += W.hgPerfPanelHtml('NEWGOLD:' + HORIZONS[i].label,
        { title: 'KIND PERFORMANCE \u00b7 NEW GOLD ' + HORIZONS[i].label });
    }
    panelEl.innerHTML = html;
  } catch(e){}
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<div class="panel">'
    + '<h2>New Gold <span>XAUUSD triple confirmation \u00b7 SMC (FVG) + ML (VWMA-50) + Momentum (RSI cross) \u00b7 1H + 4H</span></h2>'
    + '<div class="note" style="margin-bottom:8px">Fires only when all three modules agree: '
    + 'price is inside a fresh FVG mitigation zone, VWMA-50 regime matches direction, and RSI(14) '
    + 'crosses its own 9-SMA in the trade direction. Entry MARKET at close; stop at FVG opposite '
    + 'edge (v681 ATR floor may widen tight stops); T1 = 1.5R, T2 = 2.5R. '
    + 'Cards graded through the shared 7-gate SOLIDITY pipeline; kinds with 30+ samples and expR &lt; -0.5R are auto-killed.</div>'
    + '<div class="row"><button class="btn" id="ngRun">SCAN NEW GOLD</button>'
    + '<span class="note" id="ngStat">idle \u00b7 XAUUSD 1H + 4H</span></div>'
    + '<div class="prog" id="ngProg"><i></i></div>'
    + '<div id="ngKilledNote"></div>'
    + '<div class="cards" id="ngCards"></div>'
    + '<div id="ngPerf"></div>'
    + '<div class="empty" id="ngEmpty" style="display:none">No triple-confirmation fires right now \u2014 wait for price to enter an FVG with ML baseline and RSI cross both aligned.</div>'
    + '</div>';

  var btn = el.querySelector('#ngRun');
  var statEl = el.querySelector('#ngStat');
  var progEl = el.querySelector('#ngProg');
  var cardsEl = el.querySelector('#ngCards');
  var emptyEl = el.querySelector('#ngEmpty');

  function setStat(t, warn){ if (statEl){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; } }
  function setProg(f){
    if (!progEl) return;
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  async function runScan(){
    setStat('scanning XAUUSD 1H + 4H \u2026');
    setProg(0.2);
    if (btn) btn.disabled = true;
    cardsEl.innerHTML = '';
    emptyEl.style.display = 'none';
    var pack = await ngRunScan();
    setProg(1.0);
    setTimeout(function(){ setProg(null); }, 300);
    if (btn) btn.disabled = false;

    var results = pack.results || [];
    var fires = results.filter(function(r){ return r.setup; });
    if (fires.length){
      cardsEl.innerHTML = fires.map(cardHtml).join('');
      setStat(fires.length + ' fire' + (fires.length === 1 ? '' : 's')
        + ' \u00b7 ' + results.length + ' horizon' + (results.length === 1 ? '' : 's') + ' scanned'
        + ' \u00b7 ' + new Date().toISOString().slice(11, 19) + ' UTC');
    } else {
      /* Show the no-fire rows anyway so the user sees which horizons were scanned and why they didn't fire. */
      cardsEl.innerHTML = results.map(cardHtml).join('');
      emptyEl.style.display = results.length ? 'none' : 'block';
      setStat(results.length
        ? (results.length + ' horizon' + (results.length === 1 ? '' : 's') + ' scanned \u00b7 no triple-confirmation fires \u00b7 '
           + new Date().toISOString().slice(11, 19) + ' UTC')
        : 'scan failed \u00b7 ' + (pack.errors || []).join(' \u00b7 '), !results.length);
    }
    if (pack.errors && pack.errors.length){
      var current = statEl ? statEl.textContent : '';
      setStat(current + ' \u00b7 ' + pack.errors.length + ' warning' + (pack.errors.length === 1 ? '' : 's'), pack.errors.length > 0);
    }
    refreshKilledNote(el);
    refreshPerfPanels(el);
  }

  if (btn) btn.addEventListener('click', runScan);
  /* Auto-scan on mount. */
  refreshKilledNote(el);
  refreshPerfPanels(el);
  runScan();

  /* v691: auto-refresh every 5 minutes while the tab is mounted.
     Timer is stored on module state so a subsequent mount (tab close +
     reopen, hot reload) clears the prior timer instead of stacking.
     The interval calls the exact same runScan the button uses, so a
     manual click and an auto-tick are indistinguishable except for
     origin. Also self-heals: if runScan is busy (a slow fetch is in
     flight), the tick becomes a no-op via the __ng.busy guard inside
     ngRunScan; the next tick tries again 5 minutes later. */
  try {
    if (__ng.__timer){
      clearInterval(__ng.__timer);
      __ng.__timer = null;
    }
    __ng.__mountEl = el;
    if (typeof setInterval === 'function'){
      __ng.__timer = setInterval(function(){
        /* If the mount element has been removed from the document
           (user navigated away entirely, tab unmounted), stop ticking
           and clear the timer. Prevents scans on a dead tab. */
        try {
          if (__ng.__mountEl && !document.body.contains(__ng.__mountEl)){
            clearInterval(__ng.__timer);
            __ng.__timer = null;
            __ng.__mountEl = null;
            return;
          }
        } catch(eDoc){}
        try { runScan(); } catch(eTick){}
      }, NG_AUTO_REFRESH_MS);
    }
  } catch(eTimer){}
}

function ngRefresh(){
  var el = document.querySelector('[data-hg-tab="newgold"]');
  if (el) return null;
  /* Refresh path if the tab is already mounted \u2014 delegated to runScan
     via the button click. Callers can trigger via W.ngRunScan directly. */
  return null;
}

/* --- exports ---------------------------------------------------------- */
W.ngAssess = ngAssess;
W.ngRunScan = ngRunScan;
W.newGoldScan = function(){ return __ng.snap; };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'newgold', label: 'NEW GOLD', mount: mount, refresh: ngRefresh });

})();
