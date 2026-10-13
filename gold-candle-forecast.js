/* =========================================================================
HARDGATE — gold-candle-forecast.js (hg-v1314)
CANDLE FORECAST tab for the GOLD group.

hg-v1314 extends the hg-v1306 engine from an EMA9-slope read into three
legs: (1) advanced candlestick pattern recognition (16 patterns), (2)
structural reads (BOS/CHoCH, FVG, OB, equal highs/lows, trend direction),
(3) full gold-tab confluence — hgGoldFreeFeedVerdicts (free feeds),
hgGoldIndicatorReads + hgGoldIndicatorMarks (18 indicators),
pineGoldLayerStates + pineGoldPineMarks (Pine states), hgGoldFormingRegime
(ER / vol / DXY / yield). A SETUP forms when patterns + structure +
confluence agree. A LEAN forms on patterns + structure alone. CONFLICT
when confluence opposes. NEUTRAL otherwise.

DOCTRINE (hg-v966 / hg-v955): DISPLAY tool, not a gate. No setup leaves
any board on it. No forward-ledger mark. No threshold moves. Confluence
counts marks that the gold readers *already* produce on every scan — it
adds no new weight to any desk.
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
    +   '<h2>Candle Forecast <span id="cfVersion" class="verbadge">v1314</span></h2>'
    +   '<div class="row" style="margin-bottom:12px">'
    +     '<button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>'
    +     '<span class="note" id="cfStatus" style="margin-left:8px;font-weight:700">Ready</span>'
    +   '</div>'
    +   '<div id="cfResultArea" class="empty">'
    +     'No forecast yet. Click <b>SCAN NEXT CANDLE</b> to run 16 candlestick patterns, structural reads (BOS/FVG/OB), and the full gold-tab confluence (free feeds, 18 indicators, Pine states, regime) on the next 15m gold candle. This is a display tool — nothing is gated on it.'
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

async function gatherContext(rows){
  /* collect ctx fields that the gold confluence readers consume. Every
     call is a soft read: a failure or missing helper reads NEITHER on
     that leg (hg-v989 third state), never a guessed value. */
  var ctx = { macro: null, rows1d: null, spot: null, fundingRate: null, fng: null };
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
  return ctx;
}

async function runForecast(container){
  var statusEl = container.querySelector('#cfStatus');
  var resultArea = container.querySelector('#cfResultArea');
  if (!statusEl || !resultArea) return 'no-ui';
  statusEl.textContent = 'Analyzing...';
  resultArea.className = 'empty';
  resultArea.innerHTML = 'Fetching gold feed and running the forecast...';
  try{
    var rows = null;
    if (typeof G.getXAUCandles === 'function'){
      rows = await G.getXAUCandles('15m', 60);
    }
    if (!Array.isArray(rows) || rows.length < 20){
      resultArea.innerHTML = '<span class="note warn">Gold feed is thin or unavailable — need ≥20 closed 15m bars; got ' + ((rows && rows.length) || 0) + '.</span>';
      statusEl.textContent = 'Waiting';
      return 'thin-feed';
    }
    if (typeof G.goldCandleForecast !== 'function'){
      resultArea.innerHTML = '<span class="note warn">Forecast engine not loaded — goldind.js may still be loading.</span>';
      statusEl.textContent = 'Failed';
      return 'no-engine';
    }
    var ctx = await gatherContext(rows);
    var f = G.goldCandleForecast(rows, ctx);
    if (!f){
      resultArea.innerHTML = 'No forecast available — engine returned null (thin tape, missing indicators, or an unreadable last bar).';
      statusEl.textContent = 'Ready';
      return 'no-signal';
    }
    renderResult(resultArea, statusEl, f);
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
    return '<span class="' + cls + '" style="margin-right:4px;margin-bottom:2px" title="' + esc(k) + '"><b>' + esc(k.replace(/^(free:|ind:|pine:)/, '')) + '</b> ' + tag + '</span>';
  }).join('');
  return '<div style="margin-top:6px"><b>' + esc(group) + ':</b> ' + cells + '</div>';
}

function renderResult(container, statusEl, f){
  var isSetup = f.tier === 'SETUP';
  var isLean = f.tier === 'LEAN';
  var isConflict = f.tier === 'CONFLICT';
  var neutral = f.tier === 'NEUTRAL';
  var dirClass = (f.dir === 'BULL') ? 'long' : (f.dir === 'BEAR' ? 'short' : '');
  var dirLabel = neutral ? 'NEUTRAL — NO CLEAR LEAN'
               : isSetup ? ((f.dir === 'BULL' ? 'LONG' : 'SHORT') + ' SETUP')
               : isLean  ? ((f.dir === 'BULL' ? 'LONG' : 'SHORT') + ' LEAN')
               : /* conflict */ ((f.dir === 'BULL' ? 'LONG' : 'SHORT') + ' — CONFLUENCE AGAINST');
  var color = (f.dir === 'BULL') ? '#15803d' : '#dc262c';

  /* confluence summary */
  var conf = f.confluence || null;
  var confSummary = '';
  if (conf && conf.readableN > 0){
    var pct = conf.readableN > 0 ? Math.round(100 * conf.withN / conf.readableN) : 0;
    confSummary = '<li><b>Confluence:</b> <span style="color:' + color + ';font-weight:700">' + conf.withN + ' WITH / ' + conf.againstN + ' AGAINST</span> of ' + conf.readableN + ' readable marks (' + pct + '% WITH)'
      + (conf.regime ? ' · regime: <b>' + esc(conf.regime.style) + '</b>' + (isFinite(conf.regime.er) ? ' (ER ' + conf.regime.er.toFixed(2) + ')' : '') : '')
      + '</li>';
  } else if (conf) {
    confSummary = '<li><b>Confluence:</b> <span class="note">no gold readers responded on this bar</span></li>';
  }

  /* setup levels block — only on SETUP and LEAN; CONFLICT and NEUTRAL
     omit the levels so a reader does not treat the tape as tradeable */
  var levelsBlock = '';
  if ((isSetup || isLean) && f.entry != null && f.sl != null){
    levelsBlock = ''
      + '<li><b>Entry:</b> <span style="font-weight:700">' + fmtF(f.entry) + '</span></li>'
      + '<li><b>Stop:</b> <span style="color:#dc262c;font-weight:700">' + fmtF(f.sl) + '</span> <span class="note">(' + esc(f.slSource) + ', ' + fmtF(f.slDistance) + ' from entry)</span></li>'
      + '<li><b>Target 1 (TP1 · 1R):</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.tp1) + '</span></li>'
      + '<li><b>Target 2 (TP2 · 2R):</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.tp2) + '</span></li>';
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

  container.className = '';
  container.innerHTML = ''
    + '<div class="omni-side ' + dirClass + '" style="margin:0;border-left-width:4px">'
    +   '<div class="omni-side-call">' + esc(dirLabel) + ' · CANDLE FORECAST</div>'
    +   '<ul class="lst">'
    +     '<li><b>Last close:</b> <span style="font-weight:700">' + fmtF(f.close) + '</span> · ATR ' + fmtF(f.atr) + '</li>'
    +     '<li><b>Next-bar band:</b> ' + fmtF(f.expectedLow) + ' – ' + fmtF(f.expectedHigh) + '</li>'
    +     '<li><b>Bias tally:</b> ' + f.bullBias + ' bull / ' + f.bearBias + ' bear</li>'
    +     confSummary
    +     levelsBlock
    +     patternsBlock
    +   '</ul>'
    +   (marksHtml ? '<div class="note" style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px;font-size:11px">' + marksHtml + '</div>' : '')
    +   '<div class="note" style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px">'
    +     esc(f.note || '')
    +     ' · Vol. normalisation: ' + Math.round((f.confidence || 0) * 100) + '% (ATR/price ratio, not a hit-rate claim) · DISPLAY ONLY — no setup is gated on this.'
    +   '</div>'
    + '</div>';
  statusEl.textContent = neutral ? 'Neutral' : (isSetup ? 'Setup' : (isLean ? 'Lean' : 'Conflict'));
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
