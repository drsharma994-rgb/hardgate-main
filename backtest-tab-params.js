/* HARDGATE — backtest-tab-params.js
   Loads data/desk-tab-params.json + param-drift and exposes hgDeskParam / hgGlobalParam
   for all scanning tabs (backtest-tightened thresholds, never loosens G1–G7). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __desk = null;
var __loadedAt = 0;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/* GOLD DESK ALIASES (hg-v698).

   data/desk-tab-params.json carries measured rows for `gold-swing`
   (minRR 1.5) and `gold-scalp` (minRR 1.2) and NOTHING for omnigold,
   omnigold1 or newgold. Those three desks address themselves by their own
   tab keys — 'OMNIGOLD:SWING', 'OMNIGOLD:SCALP', 'omnigold1', 'NEWGOLD:1H',
   'NEWGOLD:4H' — so every hgDeskParam call from a gold desk missed the tab
   row entirely and fell through to the crypto global rrMin 2.0. Three gold
   desks were reading a crypto default while the measured gold rows sat in
   the same file unread.

   The mapping is by HORIZON, because that is what the two measured rows are
   split on: 4H / SWING work routes to gold-swing, 1H / 15m / SCALP work to
   gold-scalp. No new numbers are introduced — each desk simply reaches the
   gold row that was already measured for its horizon. */
function normGoldTab(tab){
  /* SWING-horizon gold: 4H structure. */
  if (tab === 'omnigold:swing' || tab === 'omnigold1:swing' || tab === 'newgold:4h'
      || tab === 'newgold:omni-4h') return 'gold-swing';
  /* SCALP-horizon gold: 1H / 15m execution. */
  if (tab === 'omnigold:scalp' || tab === 'omnigold1:scalp' || tab === 'newgold:1h'
      || tab === 'newgold:omni-15m') return 'gold-scalp';
  /* Horizon-less desk keys. omnigold1 records BOTH horizons into one forward
     pool ('omnigold1'), and its default horizon is SWING (omnigold1.js:171
     `up(inp.horizon) === 'SCALP' ? 'SCALP' : 'SWING'`), so the swing row is
     the honest default rather than the crypto global. */
  if (tab === 'omnigold' || tab === 'omnigold1' || tab === 'newgold') return 'gold-swing';
  return null;
}

function normTab(tab){
  tab = String(tab || 'swing').toLowerCase();
  if (tab === 'divergence') return 'div';
  if (tab === 'goldswing') return 'gold-swing';
  if (tab === 'goldscalp') return 'gold-scalp';
  if (tab === 'reversalsniper' || tab === 'sniper') return 'reversalsniper';
  var gold = normGoldTab(tab);
  if (gold) return gold;
  return tab;
}

async function hgBacktestParamsLoad(force){
  if (!force && __desk && (Date.now() - __loadedAt) < 300000) return __desk;
  try{
    if (typeof G.hgInc34LoadConfigs === 'function') await G.hgInc34LoadConfigs(force);
  }catch(e){}
  var desk = { global: {}, tabs: {} };
  try{
    if (typeof fetch === 'function'){
      var r = await fetch('./data/desk-tab-params.json', { cache: 'no-store' });
      if (r.ok) desk = await r.json();
    }
  }catch(e){}
  __desk = desk;
  __loadedAt = Date.now();
  try{ G.HG_DESK_TAB_PARAMS = desk; }catch(e){}
  return desk;
}

function hgGlobalParam(key, fallback){
  fallback = fin(fallback);
  if (fallback === null && key === 'rrMin') fallback = 2.0;
  if (typeof G.hgInc34Param === 'function'){
    var v = G.hgInc34Param(key, fallback);
    if (v !== null && v !== undefined && isFinite(+v)) return +v;
  }
  var packG = __desk || G.HG_DESK_TAB_PARAMS || null;
  if (packG && packG.global && packG.global[key] != null){
    var g = fin(packG.global[key]);
    if (g !== null) return g;
  }
  return fallback;
}

function hgDeskParam(tab, key, fallback){
  tab = normTab(tab);
  key = String(key || '');
  var pack = __desk || G.HG_DESK_TAB_PARAMS || null;
  var tabRow = (pack && pack.tabs) ? pack.tabs[tab] : null;
  if (tabRow && tabRow[key] != null){
    var tv = fin(tabRow[key]);
    if (tv !== null) return tv;
    if (typeof tabRow[key] === 'boolean' || typeof tabRow[key] === 'string') return tabRow[key];
  }
  if (key === 'minRR' || key === 'rrMin'){
    var g = hgGlobalParam('rrMin', fin(fallback) || 2.0);
    if (tab === 'scalp') return Math.max(g + 0.25, fin(fallback) || 2.25);
    return g;
  }
  if (key === 'timeStopBars'){
    if (tab === 'scalp' || tab === 'gold-scalp') return hgGlobalParam('timeStopScalpBars', fin(fallback) || 12);
    return hgGlobalParam('timeStopSwingBars', fin(fallback) || 60);
  }
  if (key === 'atrStopMult') return hgGlobalParam('atrStopMult', fin(fallback) || 1.5);
  return fallback;
}

function hgDeskParamsForTab(tab){
  tab = normTab(tab);
  var base = (__desk && __desk.tabs && __desk.tabs[tab]) ? Object.assign({}, __desk.tabs[tab]) : {};
  if (base.minRR == null) base.minRR = hgDeskParam(tab, 'minRR', tab === 'scalp' ? 2.25 : 2.0);
  return base;
}

function hgDeskBacktestBannerHtml(tab){
  tab = normTab(tab);
  var row = (__desk && __desk.tabs) ? __desk.tabs[tab] : null;
  if (!row || !row.backtestWorst) return '';
  var w = row.backtestWorst;
  var esc = function(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
  return '<div class="note warn" style="margin:6px 0;font-size:11px"><b>BACKTEST TIGHTEN</b> · '
    + esc(w.kind) + ' net ' + w.net.toFixed(2) + 'R (n=' + w.n + ') · min R:R '
    + (row.minRR != null ? row.minRR : '—') + '</div>';
}

G.hgBacktestParamsLoad = hgBacktestParamsLoad;
G.hgNormDeskTab = normTab;      /* hg-v698: exported so the gold aliases are testable */
G.hgGlobalParam = hgGlobalParam;
G.hgDeskParam = hgDeskParam;
G.hgDeskParamsForTab = hgDeskParamsForTab;
G.hgDeskBacktestBannerHtml = hgDeskBacktestBannerHtml;

try{
  if (G.document){
    var boot = function(){ hgBacktestParamsLoad(); };
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
}catch(e){}
})();
