/* =========================================================================
HARDGATE — gold-candle-forecast.js (hg-v1315)
CANDLE FORECAST tab for the GOLD group.

hg-v1315 extends hg-v1314 with three concrete additions:
  (A) FURTHER patterns — hgCfAdvancedPatterns adds 15 more candlestick
      patterns beyond the hg-v1314 16 (abandoned baby, three inside/outside
      up/down, belt hold, harami cross, spinning top, high wave,
      rising/falling three methods, mat hold, separating lines, three line
      strike, tri-star, stick sandwich, deliberation, breakaway), each ATR
      gated the same way.
  (B) EVERY gold tab as confluence — hgCfGoldDeskReads adds three more
      directional readers (hgGoldSevenStep, hgGoldSweepOb, pineGoldConfluence)
      on top of the hg-v1314 four. Plus a BOTH-ways news-lock read and four
      informational desks for the card (forming stack, inst filter, catalog
      USED count, VP targets).
  (C) SCALP + SWING setups — the engine takes ctx.mode ('scalp' | 'swing').
      This module fetches BOTH the 15m feed (scalp) and the 4h feed
      (swing), runs the engine on each, and renders two cards side by
      side.

DOCTRINE (hg-v966 / hg-v955): DISPLAY tool, not a gate. No setup leaves
any board on it. No forward-ledger mark. No threshold moves. Confluence
counts marks that the gold readers *already* produce on every scan — no
new weight is added to any desk.
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fmtF(n){
  try{
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toFixed(2);
  }catch(e){ return '—'; }
}
function esc(x){ return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* Idempotency on MODULE STATE, not a DOM query. A stub shell's
   querySelector returns a truthy element for ANY selector, so a
   DOM-query guard fires on the FIRST mount and the tab renders
   nothing — the hg-v955 shape and the hg-v1313 lesson. */
var __cfMounted = null;    /* the container reference the module last mounted into */

function mount(container){
  if (!container) return;
  if (__cfMounted === container) return;   /* second mount of the SAME pane is a no-op */
  __cfMounted = container;
  container.innerHTML = ''
    + '<div class="panel">'
    +   '<h2>Candle Forecast <span id="cfVersion" class="verbadge">v1315</span></h2>'
    +   '<div class="hg-lead" style="margin-bottom:10px">'
    +     'SCALP (15m) and SWING (4h) forecasts side by side. Each card runs 31 candlestick patterns + 8 structural reads + every gold-tab reader'
    +     ' (free feeds, 18 indicators, Pine states, regime, Playbook 1-9 bias, sweep→OB, Pine confluence, news gate, inst filter, catalog, forming stack).'
    +     ' DISPLAY only — nothing is gated on this.'
    +   '</div>'
    +   '<div class="row" style="margin-bottom:12px">'
    +     '<button class="btn" id="cfRunBtn">SCAN SCALP + SWING</button>'
    +     '<span class="note" id="cfStatus" style="margin-left:8px;font-weight:700">Ready</span>'
    +   '</div>'
    +   '<div id="cfResultArea" class="empty">'
    +     'No forecast yet. Click <b>SCAN SCALP + SWING</b> to run both engines on the latest gold candles.'
    +   '</div>'
    + '</div>';
  var btn = container.querySelector('#cfRunBtn');
  if (btn) btn.addEventListener('click', function(){ runForecast(container); });
}

function refresh(){
  var host = (G.document && G.document.getElementById) ? G.document.getElementById('tab_candle-forecast') : null;
  if (!host) return 'no-host';
  return runForecast(host);
}

async function gatherContext(opts){
  /* collect ctx fields that the gold confluence readers consume. Every
     call is a soft read: a failure or missing helper reads NEITHER on
     that leg (hg-v989 third state), never a guessed value. */
  var ctx = { macro: null, rows1d: null, spot: null, fng: null, news: null, now: null };
  try{
    if (typeof G.getGoldMacro === 'function'){
      var p = G.getGoldMacro();
      ctx.macro = (p && typeof p.then === 'function') ? (await p.catch(function(){ return null; })) : p;
    } else if (typeof G.getGoldMacroCached === 'function'){
      ctx.macro = G.getGoldMacroCached() || null;
    }
  }catch(e){ ctx.macro = null; }
  try{
    if (typeof G.getXAUCandles === 'function'){
      ctx.rows1d = await G.getXAUCandles('1d', 90).catch(function(){ return null; });
    }
  }catch(e){ ctx.rows1d = null; }
  try{
    if (G.S && G.S.fng) ctx.fng = G.S.fng;
    else if (typeof G.hgFng === 'function') ctx.fng = G.hgFng();
  }catch(e){}
  try{
    if (G.S && G.S.goldSpot) ctx.spot = G.S.goldSpot;
  }catch(e){}
  try{
    /* news snapshot for the hg-v1315 news-lock read; the gate itself fails
       open with a null snapshot (hg-v992 'unchecked' state). */
    if (G.S && G.S.news) ctx.news = G.S.news;
    else if (G.hgNewsState) ctx.news = G.hgNewsState;
  }catch(e){}
  try{
    /* a scan clock keeps every reader on the same instant — the hg-v952
       drift fix in a smaller form. Default to the last 15m bar when
       available, falling back to the wall clock. */
    if (opts && Array.isArray(opts.rows15m) && opts.rows15m.length){
      var last = opts.rows15m[opts.rows15m.length - 1];
      if (last && isFinite(+last.t)) ctx.now = (+last.t) * (last.t < 1e12 ? 1000 : 1);
    }
    if (!isFinite(ctx.now)) ctx.now = Date.now();
  }catch(e){ ctx.now = null; }
  return ctx;
}

async function runForecast(container){
  var statusEl = container.querySelector('#cfStatus');
  var resultArea = container.querySelector('#cfResultArea');
  if (!statusEl || !resultArea) return 'no-ui';
  statusEl.textContent = 'Analyzing...';
  resultArea.className = 'empty';
  resultArea.innerHTML = 'Fetching gold feed (15m + 4h) and running both engines...';
  try{
    if (typeof G.getXAUCandles !== 'function'){
      resultArea.innerHTML = '<span class="note warn">Gold feed chain not loaded.</span>';
      statusEl.textContent = 'Failed';
      return 'no-feed';
    }
    /* fetch both feeds in parallel. A failed leg returns null and that
       card prints a 'Waiting' state. */
    var p15 = G.getXAUCandles('15m', 60).catch(function(){ return null; });
    var p4h = G.getXAUCandles('4h', 90).catch(function(){ return null; });
    var pair = await Promise.all([p15, p4h]);
    var rows15m = pair[0];
    var rows4h = pair[1];
    if ((!Array.isArray(rows15m) || rows15m.length < 20) && (!Array.isArray(rows4h) || rows4h.length < 20)){
      resultArea.innerHTML = '<span class="note warn">Gold feed is thin or unavailable on both timeframes — need ≥20 closed bars.</span>';
      statusEl.textContent = 'Waiting';
      return 'thin-feed';
    }
    if (typeof G.goldCandleForecast !== 'function'){
      resultArea.innerHTML = '<span class="note warn">Forecast engine not loaded — goldind.js may still be loading.</span>';
      statusEl.textContent = 'Failed';
      return 'no-engine';
    }
    var ctx = await gatherContext({ rows15m: rows15m });
    /* run both engines. A thin single-feed scenario still renders the
       other side (never both-or-nothing). */
    var fScalp = (Array.isArray(rows15m) && rows15m.length >= 20)
      ? G.goldCandleForecast(rows15m, Object.assign({}, ctx, { mode: 'scalp' }))
      : null;
    var fSwing = (Array.isArray(rows4h) && rows4h.length >= 20)
      ? G.goldCandleForecast(rows4h, Object.assign({}, ctx, { mode: 'swing' }))
      : null;
    if (!fScalp && !fSwing){
      resultArea.innerHTML = 'No forecast available — engine returned null on both feeds (thin tapes, missing indicators, or unreadable last bars).';
      statusEl.textContent = 'Ready';
      return 'no-signal';
    }
    renderDual(resultArea, statusEl, fScalp, fSwing, {
      scalpBars: Array.isArray(rows15m) ? rows15m.length : 0,
      swingBars: Array.isArray(rows4h) ? rows4h.length : 0
    });
    return 'ok';
  }catch(e){
    try{ console.error('[CandleForecast]', e); }catch(_){}
    resultArea.innerHTML = '<span class="note warn">Forecast failed: ' + esc(e && e.message ? e.message : e) + '.</span>';
    statusEl.textContent = 'Failed';
    return 'error';
  }
}

function listCell(label, items, cls){
  if (!items || !items.length) return '<li><b>' + label + ':</b> <span class="note">none on this bar</span></li>';
  var html = items.map(function(p){ return '<span class="chip ' + cls + '" style="margin-right:4px">' + esc(p) + '</span>'; }).join('');
  return '<li><b>' + label + ':</b> ' + html + '</li>';
}

function marksBlock(marks, group){
  var keys = Object.keys(marks || {});
  if (!keys.length) return '';
  var cells = keys.map(function(k){
    var v = marks[k];
    var cls = v === true ? 'chip ok' : (v === false ? 'chip no' : 'chip');
    var tag = v === true ? 'WITH' : (v === false ? 'AGAINST' : 'UNREAD');
    return '<span class="' + cls + '" style="margin-right:4px;margin-bottom:2px" title="' + esc(k) + '"><b>' + esc(k.replace(/^(free:|ind:|pine:|desk:)/, '')) + '</b> ' + tag + '</span>';
  }).join('');
  return '<div style="margin-top:6px"><b>' + esc(group) + ':</b> ' + cells + '</div>';
}

function deskInfoLine(f){
  /* informational desks that don't vote on direction. Printed on the card
     so a reader sees that the forming stack, inst filter and catalog ran. */
  if (!f || !f.deskReads) return '';
  var d = f.deskReads;
  var bits = [];
  if (d.newsLock){
    if (d.newsLock.lock) bits.push('<span class="chip warn">NEWS LOCK · ' + esc(d.newsLock.title || 'tier-1 window') + '</span>');
    else if (d.newsLock.unchecked) bits.push('<span class="chip">news: UNCHECKED</span>');
    else bits.push('<span class="chip ok">news: clear</span>');
  }
  if (d.instFilter){
    bits.push('<span class="chip ' + (d.instFilter.ok ? 'ok' : 'no') + '">inst filter: ' + (d.instFilter.ok ? 'PASS' : 'reject') + (d.instFilter.reason ? ' · ' + esc(String(d.instFilter.reason).slice(0, 60)) : '') + '</span>');
  }
  if (d.sweepOb && d.sweepOb.tier){
    bits.push('<span class="chip">sweep→OB: ' + esc(d.sweepOb.dir || 'none') + ' · ' + esc(d.sweepOb.tier) + '</span>');
  }
  if (d.sevenStep && d.sevenStep.bias){
    bits.push('<span class="chip">Playbook bias: ' + esc(d.sevenStep.bias) + '</span>');
  }
  if (d.pineConf){
    bits.push('<span class="chip">Pine confluence: L' + (d.pineConf.longPass ? '✓' : '·') + ' S' + (d.pineConf.shortPass ? '✓' : '·') + '</span>');
  }
  if (d.catalogUsed){
    bits.push('<span class="chip">catalog: ' + d.catalogUsed.usedN + ' USED · ' + d.catalogUsed.uncheckedN + ' UNCHECKED</span>');
  }
  if (!bits.length) return '';
  return '<div class="note" style="margin-top:6px"><b>Desk readers:</b> ' + bits.join(' ') + '</div>';
}

function renderCard(f, modeLabel, bars){
  if (!f){
    return ''
      + '<div class="omni-side" style="margin:0;border-left-width:4px;flex:1;min-width:300px">'
      +   '<div class="omni-side-call">' + esc(modeLabel) + ' · WAITING</div>'
      +   '<ul class="lst"><li><span class="note">Feed thin or unavailable — need ≥20 closed bars. Got ' + (bars || 0) + '.</span></li></ul>'
      + '</div>';
  }
  var isSetup = f.tier === 'SETUP';
  var isLean = f.tier === 'LEAN';
  var isConflict = f.tier === 'CONFLICT';
  var neutral = f.tier === 'NEUTRAL';
  var dirClass = (f.dir === 'BULL') ? 'long' : (f.dir === 'BEAR' ? 'short' : '');
  var dirLabel = neutral ? (modeLabel + ' · NEUTRAL — NO CLEAR LEAN')
               : isSetup ? (modeLabel + ' · ' + (f.dir === 'BULL' ? 'LONG' : 'SHORT') + ' SETUP')
               : isLean  ? (modeLabel + ' · ' + (f.dir === 'BULL' ? 'LONG' : 'SHORT') + ' LEAN')
               : /* conflict */ (modeLabel + ' · ' + (f.dir === 'BULL' ? 'LONG' : 'SHORT') + ' — CONFLUENCE AGAINST');
  var color = (f.dir === 'BULL') ? '#15803d' : '#dc262c';

  /* confluence summary (hg-v1314 four + hg-v1315 three) */
  var conf = f.confluence || null;
  var desk = f.deskReads || null;
  var confSummary = '';
  if (f.readableN > 0){
    var pct = Math.round(100 * f.withN / f.readableN);
    confSummary = '<li><b>Confluence:</b> <span style="color:' + color + ';font-weight:700">' + f.withN + ' WITH / ' + f.againstN + ' AGAINST</span> of ' + f.readableN + ' readable marks (' + pct + '% WITH)'
      + (conf && conf.regime ? ' · regime: <b>' + esc(conf.regime.style) + '</b>' + (isFinite(conf.regime.er) ? ' (ER ' + conf.regime.er.toFixed(2) + ')' : '') : '')
      + '</li>';
  } else {
    confSummary = '<li><b>Confluence:</b> <span class="note">no gold readers responded on this bar</span></li>';
  }

  /* setup levels block */
  var levelsBlock = '';
  if ((isSetup || isLean) && f.entry != null && f.sl != null){
    var t1Label = 'Target 1 (TP1 · ' + (f.tp1R || 1) + 'R)';
    var t2Label = 'Target 2 (TP2 · ' + (f.tp2R || 2) + 'R)';
    levelsBlock = ''
      + '<li><b>Entry:</b> <span style="font-weight:700">' + fmtF(f.entry) + '</span></li>'
      + '<li><b>Stop:</b> <span style="color:#dc262c;font-weight:700">' + fmtF(f.sl) + '</span> <span class="note">(' + esc(f.slSource) + ', ' + fmtF(f.slDistance) + ' from entry)</span></li>'
      + '<li><b>' + t1Label + ':</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.tp1) + '</span></li>'
      + '<li><b>' + t2Label + ':</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.tp2) + '</span></li>';
  } else if (isConflict && f.entry != null){
    levelsBlock = '<li><b>Entry (confluence against):</b> <span class="note">' + fmtF(f.entry) + ' — levels withheld, tape is not confirming</span></li>';
  }

  var patternsBlock = ''
    + listCell('Bull patterns', (f.patterns && f.patterns.bull) || [], 'ok')
    + listCell('Bear patterns', (f.patterns && f.patterns.bear) || [], 'no')
    + ((f.patterns && f.patterns.neutral && f.patterns.neutral.length) ? listCell('Neutral patterns', f.patterns.neutral, '') : '')
    + listCell('Bull structure', (f.structure && f.structure.bull) || [], 'ok')
    + listCell('Bear structure', (f.structure && f.structure.bear) || [], 'no');

  var marksHtml = '';
  if (conf){
    marksHtml += marksBlock(conf.freeMarks, 'FREE FEEDS (' + conf.freeWith + 'W / ' + conf.freeAgainst + 'A)');
    marksHtml += marksBlock(conf.indMarks, 'INDICATOR STACK (' + conf.indWith + 'W / ' + conf.indAgainst + 'A)');
    marksHtml += marksBlock(conf.pineMarks, 'PINE STATES (' + conf.pineWith + 'W / ' + conf.pineAgainst + 'A)');
  }
  if (desk){
    marksHtml += marksBlock(desk.marks, 'GOLD DESKS (' + desk.withN + 'W / ' + desk.againstN + 'A)');
  }
  var deskInfo = deskInfoLine(f);

  return ''
    + '<div class="omni-side ' + dirClass + '" style="margin:0;border-left-width:4px;flex:1;min-width:300px">'
    +   '<div class="omni-side-call">' + esc(dirLabel) + '</div>'
    +   '<ul class="lst">'
    +     '<li><b>Last close:</b> <span style="font-weight:700">' + fmtF(f.close) + '</span> · ATR ' + fmtF(f.atr) + '</li>'
    +     '<li><b>Next-bar band:</b> ' + fmtF(f.expectedLow) + ' – ' + fmtF(f.expectedHigh) + '</li>'
    +     '<li><b>Bias tally:</b> ' + f.bullBias + ' bull / ' + f.bearBias + ' bear</li>'
    +     confSummary
    +     levelsBlock
    +     patternsBlock
    +   '</ul>'
    +   deskInfo
    +   (marksHtml ? '<div class="note" style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px;font-size:11px">' + marksHtml + '</div>' : '')
    +   '<div class="note" style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px">'
    +     esc(f.note || '')
    +     ' · Vol. normalisation: ' + Math.round((f.confidence || 0) * 100) + '% (ATR/price ratio, not a hit-rate claim) · DISPLAY ONLY — no setup is gated on this.'
    +   '</div>'
    + '</div>';
}

function renderDual(container, statusEl, fScalp, fSwing, meta){
  var cardScalp = renderCard(fScalp, 'SCALP · 15m', meta.scalpBars);
  var cardSwing = renderCard(fSwing, 'SWING · 4h', meta.swingBars);
  container.className = '';
  container.innerHTML = ''
    + '<div style="display:flex;gap:12px;flex-wrap:wrap">'
    +   cardScalp
    +   cardSwing
    + '</div>';
  /* status reflects whichever side carries the strongest signal */
  var pri = pickStatus(fScalp, fSwing);
  statusEl.textContent = pri;
}

function pickStatus(fScalp, fSwing){
  var tiers = [fScalp && fScalp.tier, fSwing && fSwing.tier];
  if (tiers.indexOf('SETUP') >= 0) return 'Setup';
  if (tiers.indexOf('LEAN') >= 0) return 'Lean';
  if (tiers.indexOf('CONFLICT') >= 0) return 'Conflict';
  if (tiers.indexOf('NEUTRAL') >= 0) return 'Neutral';
  return 'Ready';
}

/* Register through HG_tabs so bootHgTabs picks it up, mirroring every
   other hg-v9xx+ tab on main-3kk97r (ai-agent, book, brain, carry, …). */
G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'candle-forecast', label: 'CANDLE FORECAST', mount: mount, refresh: refresh });

/* Also directly register on HG_TAB_MODS when it exists already (defensive;
   bootHgTabs copies from HG_tabs on DOMContentLoaded). */
if (G.HG_TAB_MODS){
  G.HG_TAB_MODS['candle-forecast'] = { id: 'candle-forecast', label: 'CANDLE FORECAST', mount: mount, refresh: refresh };
}

G.hgCandleForecastMount = mount;
G.hgCandleForecastRefresh = refresh;
G.hgCandleForecastRunForecast = runForecast;

})();
