/* HARDGATE — venuepremium.js — Delta India vs Binance PRICE premium tab. */
(function(){
'use strict';
var CACHE_MS = 5 * 60 * 1000;
var __snap = null;
var __busy = false;

function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function gfn(n){
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[n] === 'function') return globalThis[n]; }catch(e){}
  try{ if (typeof window !== 'undefined' && window && typeof window[n] === 'function') return window[n]; }catch(e){}
  return null;
}
function lsKey(sym){ return 'hgVenuePremHist_' + String(sym || 'BTC').toUpperCase(); }
function loadHist(sym){
  try{ return JSON.parse(localStorage.getItem(lsKey(sym)) || '[]'); }catch(e){ return []; }
}
function saveHist(sym, arr){
  try{ localStorage.setItem(lsKey(sym), JSON.stringify(arr.slice(-300))); }catch(e){}
}

function venuePremiumState(){
  try{
    if (!__snap) return null;
    return JSON.parse(JSON.stringify(__snap));
  }catch(e){ return null; }
}

async function scanVenuePremium(sym){
  sym = String(sym || 'BTCUSDT').toUpperCase();
  var xuFn = gfn('xuState');
  var xuPos = gfn('xuPositioning');
  var deltaMark = null, binanceMark = null;
  if (xuPos){
    try{
      var dp = await Promise.resolve(xuPos(sym.replace(/USDT$/, '')));
      if (dp && isFinite(dp.mark)) deltaMark = dp.mark;
    }catch(e){}
  }
  var bf = gfn('binanceFunding');
  if (bf){
    try{
      var bp = await bf(sym);
      if (bp && isFinite(bp.markPrice)) binanceMark = bp.markPrice;
    }catch(e){}
  }
  var premFn = gfn('hgVenuePremium');
  var prem = premFn ? premFn({ deltaMark: deltaMark, binanceMark: binanceMark }) : null;
  var hist = loadHist(sym);
  if (prem && isFinite(prem.premBps)){
    hist.push(prem.premBps);
    while (hist.length > 300) hist.shift();
    saveHist(sym, hist);
  }
  var zFn = gfn('hgVenuePremiumZ');
  var zRead = zFn ? zFn(hist, 240, prem ? prem.premBps : null) : null;
  __snap = {
    sym: sym, at: Date.now(), deltaMark: deltaMark, binanceMark: binanceMark,
    prem: prem, z: zRead,
    note: 'Z-score vs rolling mean — a persistent Delta premium may be structural funding/access, not positioning'
  };
  return __snap;
}

function renderCard(snap){
  if (!snap) return '<div class="empty">No venue premium read yet — RUN SCAN.</div>';
  var p = snap.prem;
  var z = snap.z || {};
  var h = '<div class="card"><div class="chead"><span class="k">DELTA vs BINANCE PRICE</span></div>';
  if (typeof hgDeskFormationEdgeBannerHtml === 'function'){
    h += hgDeskFormationEdgeBannerHtml('venueprem');
  }
  h += '<div class="note warn" style="margin-bottom:8px">PRICE premium on the venue you trade by hand — separate from CARRY (funding). '
    + esc(snap.note) + '</div>';
  h += '<div class="kv"><span class="k">Symbol</span><span class="v">' + esc(snap.sym) + '</span></div>';
  h += '<div class="kv"><span class="k">Delta mark</span><span class="v">' + (isFinite(snap.deltaMark) ? snap.deltaMark : '—') + '</span></div>';
  h += '<div class="kv"><span class="k">Binance mark</span><span class="v">' + (isFinite(snap.binanceMark) ? snap.binanceMark : '—') + '</span></div>';
  if (p){
    h += '<div class="kv"><span class="k">Premium</span><span class="v">' + p.premBps.toFixed(1) + ' bps</span></div>';
  }
  if (z && z.z != null){
    h += '<div class="kv"><span class="k">Z-score</span><span class="v">' + z.z.toFixed(2)
      + (z.stretched ? ' · STRETCHED' : '') + ' (n=' + z.n + ')</span></div>';
  }
  h += '<div class="note" style="margin-top:8px">See also: <b>CARRY</b> tab for funding spread (delta-neutral, not hand-executable).</div></div>';
  return h;
}

function mountVenuePremium(panel){
  if (!panel || panel.__hgVenueMounted) return;
  panel.__hgVenueMounted = true;
  panel.innerHTML = '<div class="note">Delta India vs Binance <b>price</b> premium — local positioning pressure.</div>'
    + '<div style="margin:8px 0"><label>Symbol <input id="hgVenueSym" value="BTCUSDT" style="width:100px"/></label> '
    + '<button id="hgVenueRun" class="btn">RUN VENUE PREMIUM</button></div>'
    + '<div id="hgVenueStat" class="note"></div><div id="hgVenueCards"></div>';
  var btn = panel.querySelector('#hgVenueRun');
  var cards = panel.querySelector('#hgVenueCards');
  var stat = panel.querySelector('#hgVenueStat');
  if (btn) btn.onclick = async function(){
    if (__busy) return;
    __busy = true;
    stat.textContent = 'fetching marks…';
    try{
      var sym = panel.querySelector('#hgVenueSym').value || 'BTCUSDT';
      var snap = await scanVenuePremium(sym);
      cards.innerHTML = renderCard(snap);
      try { if (typeof globalThis.hgMpPin === 'function') globalThis.hgMpPin('venueprem', snap, null, cards); } catch (eMp) {}
      stat.textContent = 'updated ' + new Date(snap.at).toLocaleTimeString();
    }catch(e){ stat.textContent = 'error: ' + e.message; }
    finally{ __busy = false; }
  };
}

async function refreshVenuePremium(){
  try{
    if (__busy) return 'busy';
    if (!__snap) return 'skipped: not run yet';
    await scanVenuePremium(__snap.sym);
    return 'refreshed';
  }catch(e){ return 'error'; }
}

window.venuePremiumState = venuePremiumState;
window.HG_tabs = window.HG_tabs || [];
window.HG_tabs.push({ id: 'venueprem', label: 'VENUE', mount: mountVenuePremium, refresh: refreshVenuePremium });

})();
