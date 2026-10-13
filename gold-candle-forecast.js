/* =========================================================================
HARDGATE — gold-candle-forecast.js (hg-v1306)
CANDLE FORECAST tab for the GOLD group. Reads the shell's gold feed chain
(getXAUCandles → XM / Delta XAUT / PAXG, hg-v1161 anchored) and prints the
next-candle direction, expected range, TP1/TP2 and SL on ATR + EMA9 slope.

DOCTRINE (hg-v966 / hg-v955):
- This is a DISPLAY tool, not a gate. No setup leaves any board on it, no
  threshold moves, no forward ledger reads a mark from it. The forecast
  is a projection, not a measurement of accuracy.
- The engine (window.goldCandleForecast) is bar-only pure math — ATR and
  the sign of the EMA9 slope on the last closed bar. It fails open on a
  thin tape (<20 rows), on a non-finite ATR, or on a feed that threw.

The user previously saw "Waiting for data..." with v14-1 chip. That inline
HTML (the pane's default content) was the problem: the module's mount
replaces it, but the mount cannot run until the user opens the tab. The
module is now registered through window.HG_tabs so bootHgTabs picks it up,
and the tab is listed in HG_NAV_GROUPS so it renders in the GOLD group.
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

function mount(container){
  if (!container) return;
  /* idempotent mount — a second showTab click must not re-paint */
  if (container.querySelector('#cfRunBtn')) return;
  container.innerHTML = ''
    + '<div class="panel">'
    +   '<h2>Candle Forecast <span id="cfVersion" class="verbadge">v1306</span></h2>'
    +   '<div class="row" style="margin-bottom:12px">'
    +     '<button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>'
    +     '<span class="note" id="cfStatus" style="margin-left:8px;font-weight:700">Ready</span>'
    +   '</div>'
    +   '<div id="cfResultArea" class="empty">'
    +     'No forecast yet. Click <b>SCAN NEXT CANDLE</b> to project the next 15m gold candle from ATR and the EMA9 slope. This is a display tool — nothing is gated on it.'
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
      rows = await G.getXAUCandles('15m', 50);
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
    var f = G.goldCandleForecast(rows);
    if (!f || !f.dir){
      resultArea.innerHTML = 'No clear signal on this bar — the EMA9 slope and ATR did not agree. The forecast abstains rather than guess.';
      statusEl.textContent = 'Ready';
      return 'no-signal';
    }
    renderResult(resultArea, statusEl, f);
    return 'ok';
  }catch(e){
    try{ console.error('[CandleForecast]', e); }catch(_){}
    resultArea.innerHTML = '<span class="note warn">Forecast failed: ' + (e && e.message ? e.message : e) + '.</span>';
    statusEl.textContent = 'Failed';
    return 'error';
  }
}

function renderResult(container, statusEl, f){
  var dirClass = (f.dir === 'BULL') ? 'long' : 'short';
  var dirLabel = (f.dir === 'BULL') ? 'LONG CANDLE' : 'SHORT CANDLE';
  var color = (f.dir === 'BULL') ? '#15803d' : '#dc262c';
  container.className = '';
  container.innerHTML = ''
    + '<div class="omni-side ' + dirClass + '" style="margin:0;border-left-width:4px">'
    +   '<div class="omni-side-call">' + dirLabel + ' · CANDLE FORECAST</div>'
    +   '<ul class="lst">'
    +     '<li><b>Expected Range:</b> <span style="font-weight:700">' + fmtF(f.expectedLow) + ' — ' + fmtF(f.expectedHigh) + '</span></li>'
    +     '<li><b>Target 1 (TP1):</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.tp1) + '</span></li>'
    +     '<li><b>Target 2 (TP2):</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.tp2) + '</span></li>'
    +     '<li><b>Stop Loss (SL):</b> <span style="color:' + color + ';font-weight:700">' + fmtF(f.sl) + '</span></li>'
    +   '</ul>'
    +   '<div class="note" style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px">'
    +     'Vol. normalisation: ' + Math.round((f.confidence || 0) * 100) + '% · ATR/price ratio, not a hit-rate claim · DISPLAY ONLY — no setup is gated on this.'
    +   '</div>'
    + '</div>';
  statusEl.textContent = 'Done';
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
