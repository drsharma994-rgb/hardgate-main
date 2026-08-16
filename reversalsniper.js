/* =========================================================================
HARDGATE — reversalsniper.js
REVERSAL SNIPER tab: long-only bounce setups after a down move on Binance
USDT perps. Composes existing detectors (liquidity sweep reclaim, mean
reversion, RSI stretch) and filters for SNIPER-grade leverage (≥30× max
safe — stop ≤ ~1.9% from entry).

Every card shows exact ENTRY · STOP · TP1 · TP2, a transparent conviction
score, and a per-symbol mini-backtest when mean-reversion rules apply.

Honest mandate: this tab stacks the odds — it does NOT guarantee the stop
never gets hit. Same liquidation-clearance math as BRAIN SNIPER / TRADE PLAN.

Pure exports (never throw):
  rsMaxSafeLev(entry, stop, mmr?)
  rsAssess(rows, opts?) -> setup | null
  rsBacktest(rows) -> { n, winPct, avgR, pf, expR }  (mean-rev long replay)
  rsConviction(setup) -> number

Classic script; loads after indicators.js, indicators2.js, plans.js,
meanrev.js, desk-scan-universe.js, xuniverse.js, binance.js. Registers window.HG_tabs.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

var MIN_LEV         = 30;
var MIN_RR          = 1.5;
var MIN_CONVICTION  = 4;
var MIN_TURNOVER    = 5e6;
var MAX_UNIVERSE    = 0;
var KL_LIMIT        = 300;
var CHUNK           = 4;
var CHUNK_SLEEP_MS  = 150;
var SWING_LOOKBACK  = 30;
var SWING_EXCLUDE   = 4;
var MIN_DRAWDOWN    = 0.02;
var SNIPER_MMR      = 0.005;
var SNIPER_MAX_STOP_PCT = 0.0188;   /* ~1.88% — enables ≥30× max-safe lev */
var RR1             = 2.0;
var RR2             = 3.5;
var ATR_LEN         = 14;
var EXT_LEN         = 5;

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function pxF(n){
  if (typeof px === 'function') return px(n);
  if (n === null || n === undefined || isNaN(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function') return fmt(n, d);
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function fmtSignedR(r){
  if (!isFinite(r)) return '—';
  return (r > 0 ? '+' : '') + r.toFixed(2) + 'R';
}
function fmtPF(pf){
  if (pf === Infinity) return '∞';
  if (!isFinite(pf)) return '—';
  return pf.toFixed(1);
}

function rsMaxSafeLev(entry, stop, mmr){
  try{
    entry = +entry; stop = +stop;
    if (!isFinite(entry) || !isFinite(stop) || entry <= 0 || entry === stop) return 1;
    var sd = Math.abs(entry - stop) / entry;
    var lev = Math.floor(1 / (sd * 1.5 + (isFinite(+mmr) && +mmr > 0 ? +mmr : SNIPER_MMR)));
    return Math.max(1, Math.min(100, lev));
  }catch(e){ return 1; }
}

function rsSwingLow(rows, lookback, excludeRecent){
  try{
    if (!rows || !rows.length) return NaN;
    var n = rows.length;
    var start = Math.max(0, n - (lookback || SWING_LOOKBACK));
    var end = Math.max(start, n - (excludeRecent || SWING_EXCLUDE));
    var lo = Infinity;
    for (var i = start; i < end; i++){
      if (rows[i] && isFinite(rows[i].l) && rows[i].l < lo) lo = rows[i].l;
    }
    return isFinite(lo) ? lo : NaN;
  }catch(e){ return NaN; }
}

function rsDrawdownPct(rows, len){
  try{
    if (!rows || !rows.length) return 0;
    var n = rows.length;
    var k = Math.max(0, n - (len || 20));
    var hi = -Infinity, last = rows[n - 1].c;
    for (var i = k; i < n; i++){
      if (rows[i] && isFinite(rows[i].h) && rows[i].h > hi) hi = rows[i].h;
    }
    if (!isFinite(hi) || !isFinite(last) || !(hi > 0)) return 0;
    return (hi - last) / hi;
  }catch(e){ return 0; }
}

function rsSniperStop(dir, entry, structuralStop){
  try{
    entry = +entry; structuralStop = +structuralStop;
    if (!isFinite(entry) || !isFinite(structuralStop) || !(entry > 0)) return structuralStop;
    var cap = entry * (1 - SNIPER_MAX_STOP_PCT);
    if (dir === 'long') return Math.max(structuralStop, cap);
    var capS = entry * (1 + SNIPER_MAX_STOP_PCT);
    return Math.min(structuralStop, capS);
  }catch(e){ return structuralStop; }
}

function rsBuildPlan(entry, stop, rr1, rr2){
  try{
    entry = +entry; stop = +stop;
    if (!isFinite(entry) || !isFinite(stop) || !(entry > stop)) return null;
    var risk = entry - stop;
    if (!(risk > 0)) return null;
    rr1 = isFinite(rr1) ? rr1 : RR1;
    rr2 = isFinite(rr2) ? rr2 : RR2;
    var t1 = entry + rr1 * risk;
    var t2 = entry + rr2 * risk;
    var lev = rsMaxSafeLev(entry, stop);
    return {
      dir: 'long', entry: entry, stop: stop, t1: t1, t2: t2,
      risk: risk, riskPct: risk / entry * 100,
      rr1: rr1, rr2: rr2, lev: lev
    };
  }catch(e){ return null; }
}

function rsConviction(setup){
  try{
    if (!setup) return 0;
    var c = 0;
    var tr = setup.triggers || [];
    for (var i = 0; i < tr.length; i++){
      if (tr[i] === 'sweep') c += 4;
      else if (tr[i] === 'meanrev') c += 3;
      else if (tr[i] === 'rsi') c += 1;
      else if (tr[i] === 'drawdown') c += 1;
    }
    var rv = setup.rsi2;
    if (isFinite(rv)){
      if (rv <= 2) c += 3;
      else if (rv <= 5) c += 2;
      else if (rv <= 8) c += 1;
    }
    var ddPct = setup.drawdownPct;
    if (isFinite(ddPct)){
      if (ddPct >= 10) c += 2;
      else if (ddPct >= 5) c += 1;
    }
    if (tr.indexOf('rsi') >= 0 && tr.indexOf('drawdown') >= 0) c += 1;
    if (tr.indexOf('sweep') >= 0 && tr.indexOf('drawdown') >= 0) c += 1;
    var bt = setup.bt;
    if (bt && bt.n >= 3){
      if (isFinite(bt.expR) && bt.expR > 0) c += 2;
      if (isFinite(bt.winPct) && bt.winPct >= 50) c += 1;
    }
    return c;
  }catch(e){ return 0; }
}

function rsAssess(rows, opts){
  try{
    opts = opts || {};
    if (!Array.isArray(rows) || rows.length < 60) return null;
    var n = rows.length;
    var last = rows[n - 1];
    var entry = last && isFinite(last.c) ? last.c : NaN;
    if (!isFinite(entry) || !(entry > 0)) return null;

    var dd = rsDrawdownPct(rows, 20);
    if (dd < MIN_DRAWDOWN && !opts.relaxDrawdown) return null;

    var triggers = [];
    if (dd >= MIN_DRAWDOWN) triggers.push('drawdown');

    var atrFn = (typeof atr === 'function') ? atr : null;
    var atArr = atrFn ? atrFn(rows, ATR_LEN) : null;
    var a14 = (atArr && atArr.length) ? atArr[n - 1] : NaN;

    var sweepFn = (typeof W.hgDetectLiquiditySweep === 'function') ? W.hgDetectLiquiditySweep : null;
    var sweepStopFn = (typeof W.hgSweepStop === 'function') ? W.hgSweepStop : null;
    var swingLo = rsSwingLow(rows, SWING_LOOKBACK, SWING_EXCLUDE);
    var sweep = null;
    if (sweepFn && isFinite(swingLo)){
      sweep = sweepFn(rows, n - 1, 'long', swingLo, {});
      if (sweep && sweep.swept) triggers.push('sweep');
    }

    var mrFn = (typeof W.mrSignal === 'function') ? W.mrSignal : null;
    var mr = mrFn ? mrFn(rows) : null;
    if (mr && mr.dir === 'long') triggers.push('meanrev');

    var rsi2Val = NaN;
    if (typeof rsi === 'function'){
      var closes = rows.map(function(r){ return r.c; });
      var r2 = rsi(closes, 2);
      rsi2Val = (r2 && r2.length) ? r2[n - 1] : NaN;
      if (isFinite(rsi2Val) && rsi2Val <= 12) triggers.push('rsi');
    }

    if (!triggers.length) return null;
    if (triggers.indexOf('sweep') < 0 && triggers.indexOf('meanrev') < 0
        && triggers.indexOf('rsi') < 0) return null;

    var plan = null;
    if (sweep && sweep.swept && sweepStopFn && isFinite(a14)){
      var stp = rsSniperStop('long', entry, sweepStopFn('long', sweep.sweepExtreme, a14));
      plan = rsBuildPlan(entry, stp, RR1, RR2);
    }
    if (!plan && mr && mr.dir === 'long' && typeof W.meanrevPlan === 'function'){
      var lo5 = (typeof lowest === 'function') ? lowest(rows.map(function(r){ return r.l; }), EXT_LEN) : null;
      var extreme = (lo5 && lo5.length) ? lo5[n - 1] : NaN;
      var bb = (typeof bollinger === 'function') ? bollinger(rows.map(function(r){ return r.c; }), 20, 2) : null;
      var opp = (bb && bb.upper && bb.upper.length) ? bb.upper[n - 1] : NaN;
      var mrp = W.meanrevPlan({ dir: 'long', entry: mr.entry, extreme: extreme,
                                atr: a14, mean: mr.target, oppBand: opp });
      if (mrp) plan = rsBuildPlan(mrp.entry, rsSniperStop('long', mrp.entry, mrp.stop), mrp.rr1, mrp.rr2);
    }
    if (!plan && triggers.indexOf('rsi') >= 0 && isFinite(a14)){
      var lo5b = (typeof lowest === 'function') ? lowest(rows.map(function(r){ return r.l; }), EXT_LEN) : null;
      var ex = (lo5b && lo5b.length) ? lo5b[n - 1] : NaN;
      if (isFinite(ex)){
        var tightStop = rsSniperStop('long', entry, ex - 1.5 * a14);
        plan = rsBuildPlan(entry, tightStop, RR1, RR2);
      }
    }
    if (!plan) return null;
    if (!(plan.lev >= MIN_LEV)) return null;
    if (!(plan.rr1 >= MIN_RR)) return null;

    var btFn = (typeof W.mrBacktest === 'function') ? W.mrBacktest : null;
    var bt = btFn ? btFn(rows) : { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 };

    var setup = {
      dir: 'long',
      entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      risk: plan.risk, riskPct: plan.riskPct,
      rr1: plan.rr1, rr2: plan.rr2, lev: plan.lev,
      triggers: triggers, drawdownPct: dd * 100, rsi2: rsi2Val,
      sweep: sweep, meanrev: mr, bt: bt
    };

    if (typeof W.hgApplyExactEntry === 'function'){
      var enriched = W.hgApplyExactEntry({
        dir: 'long', entry: setup.entry, stop: setup.stop, t1: setup.t1, t2: setup.t2
      }, rows, { style: 'reversal-sniper', preferEdge: false, skipExact: true });
      if (enriched && isFinite(enriched.entry)){
        if (isFinite(enriched.entry)) setup.entry = enriched.entry;
        if (isFinite(enriched.stop)) setup.stop = enriched.stop;
        if (isFinite(enriched.t1)) setup.t1 = enriched.t1;
        if (isFinite(enriched.t2)) setup.t2 = enriched.t2;
        if (enriched.entryType) setup.entryType = enriched.entryType;
        if (enriched.entryGuidance) setup.entryGuidance = enriched.entryGuidance;
        setup.lev = rsMaxSafeLev(setup.entry, setup.stop);
        setup.riskPct = (setup.entry - setup.stop) / setup.entry * 100;
        if (!(setup.lev >= MIN_LEV)) return null;
      }
    }

    setup.conviction = rsConviction(setup);
    if (setup.conviction < MIN_CONVICTION) return null;
    return setup;
  }catch(e){ return null; }
}

function rsIsDeskVenue(ex){
  ex = String(ex == null ? '' : ex).toLowerCase();
  return ex === 'delta' || ex === 'coindcx' || ex === 'cdcx';
}

async function rsLoadUniverse(force){
  try{
    var loadFn = (typeof W.hgDeskLoadDeltaCoinDCX === 'function') ? W.hgDeskLoadDeltaCoinDCX
      : ((typeof W.hgDeskLoadUniverse === 'function') ? W.hgDeskLoadUniverse : null);
    if (loadFn){
      var u = await loadFn({ force: !!force, minTurnover: MIN_TURNOVER, includeUnknown: true });
      var items = (u.items || []).filter(function(it){ return it && rsIsDeskVenue(it.exchange); });
      if (MAX_UNIVERSE > 0) items = items.slice(0, MAX_UNIVERSE);
      return {
        items: items,
        note: u.note,
        source: u.source || 'xu',
        venueCounts: u.venueCounts || ((typeof W.hgDeskVenueCounts === 'function') ? W.hgDeskVenueCounts(items) : null)
      };
    }
    if (typeof W.xuUniverse === 'function'){
      var raw = await W.xuUniverse(!!force);
      var filtered = (raw || []).filter(function(it){ return it && rsIsDeskVenue(it.exchange); });
      if (MAX_UNIVERSE > 0) filtered = filtered.slice(0, MAX_UNIVERSE);
      return { items: filtered, note: null, source: 'xu', venueCounts: null };
    }
    return { items: [], note: 'xuUniverse / hgDeskLoadUniverse unavailable', source: 'none', venueCounts: null };
  }catch(e){
    return { items: [], note: (e && e.message) ? e.message : 'universe load failed', source: 'error', venueCounts: null };
  }
}

async function rsFetchKlines(item, tf, n){
  try{
    if (typeof W.hgDeskFetchKlines === 'function'){
      return await W.hgDeskFetchKlines(item, tf, n);
    }
    if (typeof W.xuCandles === 'function'){
      return await W.xuCandles(item, tf, n);
    }
    if (typeof binanceKlines === 'function' && item && item.sym){
      return await binanceKlines(item.sym, tf, n);
    }
  }catch(e){}
  return [];
}

function rsBacktest(rows){
  try{
    if (typeof W.mrBacktest === 'function') return W.mrBacktest(rows);
    return { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 };
  }catch(e){ return { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 }; }
}

function triggerChips(triggers){
  var labels = {
    sweep: 'LIQUIDITY SWEEP RECLAIM',
    meanrev: 'MEAN REV STRETCH',
    rsi: 'RSI(2) OVERSOLD',
    drawdown: 'POST-DROPDOWN'
  };
  return (triggers || []).map(function(t){
    return '<span class="gpip ok">' + esc(labels[t] || t) + '</span>';
  }).join('');
}

function cardHTML(r){
  var s = r.setup, bt = s.bt || {};
  var item = r.item || {};
  var symLab = (typeof W.hgDeskSymLabel === 'function') ? W.hgDeskSymLabel(item) : (r.sym || item.sym || '—');
  var venueChip = (typeof W.hgDeskVenueChipHTML === 'function') ? W.hgDeskVenueChipHTML(item) : '';
  var toVal = item.turnoverUsd;
  var turnover = (toVal != null && isFinite(+toVal)) ? ('$' + fmtF(+toVal / 1e6, 0) + 'M') : '—';
  var levCol = s.lev >= MIN_LEV ? '#5fbf8f' : '#d8a24a';
  var record = bt.n >= 3
    ? 'MEAN-REV RECORD: ' + bt.n + ' trades · ' + Math.round(bt.winPct) + '% win · avg '
      + fmtSignedR(bt.expR) + ' · PF ' + fmtPF(bt.pf)
    : (bt.n > 0 ? 'THIN RECORD (n=' + bt.n + ')' : 'NO MEAN-REV HISTORY ON THESE BARS');

  var stackHtml = '';
  if (typeof hgSetupStackMiniHtml === 'function' && typeof hgSetupStackForInlineScan === 'function'){
    try{
      var st = hgSetupStackForInlineScan({ dir: 'long', sym: symLab, rows4h: r.rows, style: 'reversal-sniper',
        ticker: item, clean: true });
      stackHtml = hgSetupStackMiniHtml(st);
    }catch(eSt){}
  }

  var safeChip = (typeof hgSafeLevChip === 'function') ? hgSafeLevChip(s.entry, s.stop) : '';
  var tradeOnclick = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(symLab, 'long', s.entry, s.stop, s.t1, { t2: s.t2, scanner: 'reversalsniper', strategy: 'reversalsniper' })
    : '';
  var tradeBtn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function')
    ? bookBtnHTML(symLab, 'long', s.entry, s.stop, s.t1, { scanner: 'reversalsniper', strategy: 'reversalsniper', t2: s.t2 }) : '';

  return '<div class="card long' + (r.best ? ' best' : '') + '">'
    + '<div class="chead"><span class="sym">' + esc(symLab) + venueChip + '</span>'
    + '<span class="dir">LONG · REVERSAL SNIPER · conviction ' + s.conviction + '</span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(r.sym, 'long', { scanner: 'reversalsniper', strategy: 'reversalsniper' }) : '')
    + '</div>'
    + '<div class="mini">'
    + '<span class="k">drawdown</span><span>' + fmtF(s.drawdownPct, 1) + '% off 20b high</span>'
    + '<span class="k">max safe lev</span><span style="color:' + levCol + ';font-weight:700">' + s.lev + '×</span>'
    + '<span class="k">stop dist</span><span>' + fmtF(s.riskPct, 2) + '%</span>'
    + '<span class="k">turnover 24h</span><span>' + turnover + '</span>'
    + '</div>'
    + '<div class="gates">' + triggerChips(s.triggers)
    + '<span class="gpip ok">CONVICTION ' + s.conviction + '</span>'
    + '<span class="gpip ok">≥' + MIN_LEV + '× SAFE</span></div>'
    + '<div class="plan">BUY · ENTRY <b>' + pxF(s.entry) + '</b> · STOP <b>' + pxF(s.stop) + '</b>'
    + ' · TP1 <b>' + pxF(s.t1) + '</b> (' + fmtF(s.rr1, 1) + 'R) · TP2 <b>' + pxF(s.t2) + '</b> (' + fmtF(s.rr2, 1) + 'R)'
    + safeChip + '</div>'
    + (s.entryGuidance ? '<div class="note">' + esc(s.entryGuidance) + '</div>' : '')
    + stackHtml
    + '<div class="note warn" style="margin-top:6px">SNIPER GRADE — stop ≤ ~1.9% enables ≥30× max-safe leverage. '
    + 'This stacks reversal confluence; <b>stops can still be hit</b>. Size below max safe.</div>'
    + '<div class="plan">' + record + '</div>'
    + tradeBtn + bookBtn
    + '</div>';
}

var __rs = { busy: false, ranOnce: false, run: null, snap: null };

function publishRsDeskSnap(results){
  try{
    var cands = (results || []).map(function(r, i){
      var s = r.setup || {};
      var sym = r.sym || (r.item && r.item.sym) || '—';
      return {
        id: 'rs|' + sym + '|' + i,
        sym: sym,
        dir: 'long',
        entry: s.entry,
        stop: s.stop,
        t1: s.t1,
        t2: s.t2,
        rr: s.rr1,
        rr2: s.rr2,
        conviction: s.conviction,
        lev: s.lev,
        riskPct: s.riskPct,
        triggers: s.triggers,
        rows: r.rows || null,
        venueTag: r.item && r.item.venue ? r.item.venue : null,
        tier: 'clean',
        scanner: 'reversalsniper',
        best: !!r.best
      };
    });
    __rs.snap = {
      at: Date.now(),
      cands: cands,
      stat: cands.length
        ? (cands.length + ' sniper-grade reversals · conviction ranked')
        : '0 sniper setups — post-drop long bounces only'
    };
    W.reversalSniperScan = function(){ return __rs.snap; };
    /* FORWARD LOG. Every sniper candidate is a post-drop long bounce, so the
       mechanic is one thing rather than a family — what accumulates here is
       whether that single claim resolves. Conviction rides in as the ticket
       flag so a high-conviction sniper can later be compared against the rest;
       if they resolve alike, conviction is a label rather than a filter. */
    try {
      if (typeof W.hgFwdRecordScan === 'function' && cands.length){
        var fwd = cands.filter(function(c){
          return c && c.dir && isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1);
        }).map(function(c){
          return { sym: c.sym, dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
                   mechanic: 'SNIPER-BOUNCE', ticket: !!c.conviction };
        });
        if (fwd.length) W.hgFwdRecordScan('REVERSALSNIPER', '4h', fwd, { horizonBars: 20 });
      }
    } catch (eFwd) {}
  }catch(e){}
}

/** Headless scan — works before REVERSAL SNIPER tab is mounted (SUPER SNIPER desk). */
async function rsRunScan(opts){
  opts = opts || {};
  if (__rs.busy) return { status: 'busy', results: [], failed: 0, uniLen: 0 };
  __rs.busy = true;
  __rs.ranOnce = true;
  var onProgress = (typeof opts.onProgress === 'function') ? opts.onProgress : function(){};
  var status = 'refreshed';
  var results = [], failed = 0, uniLen = 0;
  try{
    onProgress({ phase: 'universe', msg: 'loading Delta + CoinDCX universe…' });
    var uniPack = await rsLoadUniverse(true);
    var uni = uniPack.items || [];
    uniLen = uni.length;
    if (!uni.length){
      publishRsDeskSnap([]);
      return { status: 'failed: universe', results: [], failed: 0, uniLen: 0, note: uniPack.note || '' };
    }
    var vc = uniPack.venueCounts || {};
    var venueNote = 'Δ ' + (vc.delta || 0) + ' · CDCX ' + (vc.coindcx || 0);
    var started = 0;
    for (var ci = 0; ci < uni.length; ci += CHUNK){
      var chunk = uni.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(item){
        var my = ++started;
        var symLab = (typeof W.hgDeskSymLabel === 'function') ? W.hgDeskSymLabel(item) : (item.sym || '?');
        onProgress({ phase: 'scan', i: my, total: uni.length, sym: symLab, venueNote: venueNote });
        try{
          var rows = await rsFetchKlines(item, '4h', KL_LIMIT);
          if (!rows || !rows.length){ failed++; return; }
          var setup = rsAssess(rows);
          if (!setup) return;
          results.push({ item: item, sym: symLab, setup: setup, rows: rows, tick: item });
        }catch(e){ failed++; }
      }));
      if (ci + CHUNK < uni.length) await sleep(CHUNK_SLEEP_MS);
    }
    results.sort(function(a, b){ return b.setup.conviction - a.setup.conviction; });
    if (results.length) results[0].best = true;
    publishRsDeskSnap(results);
    status = results.length ? 'refreshed' : 'empty';
    return { status: status, results: results, failed: failed, uniLen: uniLen, venueNote: venueNote };
  }catch(e){
    status = 'error';
    return { status: status, results: [], failed: failed, uniLen: uniLen, error: (e && e.message) ? e.message : String(e) };
  }finally{
    __rs.busy = false;
  }
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<div class="panel">'
    + '<h2>Reversal Sniper <span>long bounces after a down move · Delta India + CoinDCX full universe · '
    + '≥' + MIN_LEV + '× max-safe leverage · 4H</span></h2>'
    + '<div class="note" style="margin-bottom:8px">Scans every Delta India + CoinDCX USDT perpetual (≥ $'
    + fmtF(MIN_TURNOVER / 1e6, 0) + 'M turnover when known). Conviction = agreeing triggers + paying mean-rev backtest. '
    + '<b>Nothing here guarantees the stop holds</b> — use TRADE PLAN clearance gates.</div>'
    + '<div class="row"><button class="btn" id="rsRun">SCAN REVERSALS</button>'
    + '<span class="note" id="rsStat">idle — full Delta + CoinDCX universe · conviction ≥ ' + MIN_CONVICTION
    + ' · lev ≥ ' + MIN_LEV + '×</span></div>'
    + '<div class="prog" id="rsProg"><i></i></div>'
    + '<div class="cards" id="rsCards"></div>'
    + '<div id="rsFwd"></div>'
    + '<div class="empty" id="rsEmpty" style="display:none">No sniper-grade long reversals right now — '
    + 'need a post-drop setup with a stop tight enough for ≥' + MIN_LEV + '×.</div>'
    + '<div class="note" id="rsIdle">Auto-scan starts when you open this tab — or press SCAN REVERSALS.</div>'
    + '</div>';

  var btn = el.querySelector('#rsRun');
  var statEl = el.querySelector('#rsStat');
  var progEl = el.querySelector('#rsProg');
  var cardsEl = el.querySelector('#rsCards');
  var emptyEl = el.querySelector('#rsEmpty');
  var idleEl = el.querySelector('#rsIdle');
  /* Paint the shared forward panel on mount — the tab's accumulated
     out-of-sample record, and the only number here not re-read from the
     current window. */
  try {
    var rsFwdEl = el.querySelector('#rsFwd');
    if (rsFwdEl && typeof W.hgFwdPanelHTML === 'function'){
      rsFwdEl.innerHTML = W.hgFwdPanelHTML('REVERSALSNIPER', { minRr: 2, title: 'FORWARD — has the sniper bounce paid?' });
    }
  } catch (eFwd) {}
  if (!btn || !statEl) return;

  function setStat(t, warn){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; }
  function setProg(f){
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  btn.addEventListener('click', function(){ runScan(); });

  async function runScan(){
    if (__rs.busy) return 'busy';
    btn.disabled = true;
    cardsEl.innerHTML = '';
    emptyEl.style.display = 'none';
    if (idleEl) idleEl.style.display = 'none';
    setProg(0);
    var status = 'refreshed';
    try{
      setStat('loading Delta + CoinDCX universe…');
      var pack = await rsRunScan({
        onProgress: function(p){
          if (p.phase === 'scan'){
            setStat('scanning ' + p.i + '/' + p.total + ' · ' + p.sym + ' (' + p.venueNote + ')');
            setProg(p.i / p.total);
          }
        }
      });
      status = pack.status || status;
      var results = pack.results || [];
      if (results.length){
        cardsEl.innerHTML = '<div class="note ok" style="margin-bottom:8px">★ '
          + esc(results[0].sym) + ' — highest conviction (' + results[0].setup.conviction + ')</div>'
          + results.map(cardHTML).join('');
      } else {
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'No sniper-grade long reversals right now — need post-drop (≥2%) + sweep/mean-rev/RSI(2) confluence, stop tight enough for ≥'
          + MIN_LEV + '× leverage, conviction ≥ ' + MIN_CONVICTION + '. Quiet tape is normal; re-scan after a flush.';
      }
      if (pack.status === 'failed: universe'){
        setStat(pack.note || 'Delta + CoinDCX universe unavailable — check xuniverse.js / network', true);
        return pack.status;
      }
      setStat(results.length + ' sniper-grade reversal' + (results.length === 1 ? '' : 's')
        + ' · ' + (pack.uniLen || 0) + ' contracts scanned (' + (pack.venueNote || '') + ') · '
        + (pack.failed || 0) + ' fetch failures · '
        + new Date().toISOString().slice(11, 19) + ' UTC');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
      status = 'error';
    }finally{
      btn.disabled = false;
      setProg(null);
    }
    return status;
  }

  __rs.run = runScan;
  setTimeout(function(){
    if (!__rs.ranOnce && typeof runScan === 'function') runScan();
  }, 500);
}

async function rsRefresh(){
  try{
    if (__rs.busy) return 'busy';
    if (typeof __rs.run === 'function') return await __rs.run();
    var pack = await rsRunScan({ quiet: true });
    return pack.status || 'refreshed';
  }catch(e){ return 'error'; }
}

W.rsMaxSafeLev = rsMaxSafeLev;
W.rsAssess = rsAssess;
W.rsBacktest = rsBacktest;
W.rsConviction = rsConviction;
W.publishRsDeskSnap = publishRsDeskSnap;
W.rsRunScan = rsRunScan;
W.reversalSniperScan = function(){ return __rs.snap; };
W.rsLoadUniverse = rsLoadUniverse;
W.rsIsDeskVenue = rsIsDeskVenue;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'reversalsniper', label: 'REVERSAL SNIPER', mount: mount, refresh: rsRefresh });

})();
