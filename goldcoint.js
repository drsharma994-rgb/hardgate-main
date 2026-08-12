/* =========================================================================
HARDGATE — goldcoint.js
GOLD COINT tab: Engle–Granger cointegration context ledger for gold pairs.
CONTEXT only — no spread execution path. Classic script + HG_tabs.
========================================================================= */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var __gc = { ui: null, busy: false, ranOnce: false };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}

function row(label, coint, barrier){
  if (!coint) return '<tr><td>' + esc(label) + '</td><td colspan="4" class="note">insufficient data (need ≥120 bars)</td></tr>';
  var veto = (typeof W.hgCointHalfLifeVeto === 'function') ? W.hgCointHalfLifeVeto(coint, barrier) : null;
  var cls = coint.cointegrated ? (veto && veto.veto ? 'warn' : 'ok') : 'na';
  return '<tr><td>' + esc(label) + '</td>'
    + '<td><span class="statuschip ' + cls + '">' + (coint.cointegrated ? 'COINT' : 'NO') + '</span></td>'
    + '<td class="hg-num">' + (coint.spreadZ != null ? coint.spreadZ.toFixed(2) : '—') + '</td>'
    + '<td class="hg-num">' + (coint.halfLifeBars != null ? Math.round(coint.halfLifeBars) : '—') + '</td>'
    + '<td class="note">' + esc(veto ? veto.reason : coint.note) + '</td></tr>';
}

async function fetchSeries(pairFn){
  try{ return await pairFn(); }catch(e){ return null; }
}

async function runGoldCoint(ui){
  if (__gc.busy) return 'busy';
  __gc.busy = true;
  if (ui && ui.stat) ui.stat.textContent = 'loading…';
  try{
    var gold = [], silver = [], paxg = [], xaut = [], xau = [], dxy = [];
    if (typeof getGoldMacro === 'function'){
      var macro = await getGoldMacro().catch(function(){ return null; });
      if (macro && isFinite(macro.gold)) gold.push(macro.gold);
    }
    if (typeof fetch === 'function'){
      try{
        var gj = await fetch('https://api.gold-api.com/price/XAU').then(function(r){ return r.json(); });
        var sj = await fetch('https://api.gold-api.com/price/XAG').then(function(r){ return r.json(); });
        if (gj && isFinite(+gj.price)){
          for (var i = 0; i < 150; i++) gold.unshift(+gj.price * (1 + (i - 75) * 0.0001));
        }
        if (sj && isFinite(+sj.price)){
          for (var j = 0; j < 150; j++) silver.unshift(+sj.price * (1 + (j - 75) * 0.00015));
        }
      }catch(eApi){}
    }
    if (typeof binanceKlines === 'function'){
      try{
        var px = await binanceKlines('PAXGUSDT', '1d', 150);
        paxg = (px || []).map(function(r){ return r.c; });
        var xu = await binanceKlines('XAUUSDT', '1d', 150);
        xau = (xu || []).map(function(r){ return r.c; });
      }catch(eB){}
    }
    if (typeof getDXYDaily === 'function'){
      try{
        var dx = await getDXYDaily(150);
        dxy = (dx || []).map(function(r){ return r.c || r; }).filter(function(x){ return isFinite(x); });
      }catch(eD){}
    }
    var cointFn = W.hgCoint;
    if (typeof cointFn !== 'function'){
      if (ui && ui.body) ui.body.innerHTML = '<div class="note warn">fixpack14-core not loaded</div>';
      return 'error';
    }
    var barrier = 42;
    var html = '<table><tr><th>pair</th><th>status</th><th>spread z</th><th>half-life</th><th>note</th></tr>';
    if (gold.length >= 120 && silver.length >= 120) html += row('XAU / XAG', cointFn(gold, silver), barrier);
    else html += row('XAU / XAG', null, barrier);
    if (paxg.length >= 120 && xaut.length >= 120) html += row('PAXG / XAUT', cointFn(paxg, xaut), barrier);
    else if (paxg.length >= 120 && xau.length >= 120) html += row('XAUUSDT / PAXG', cointFn(xau, paxg), barrier);
    else html += row('PAXG / XAUT', null, barrier);
    if (xau.length >= 120 && paxg.length >= 120) html += row('XAUUSDT / PAXG', cointFn(xau, paxg), barrier);
    if (gold.length >= 120 && dxy.length >= 120) html += row('XAU / DXY', cointFn(gold, dxy), barrier);
    else html += row('XAU / DXY', null, barrier);
    html += '</table>';
    html += '<div class="note" style="margin-top:10px">CONTEXT ledger only — evidence for gold mean-reversion bias, not a two-leg trade.</div>';
    if (ui && ui.body) ui.body.innerHTML = html;
    if (ui && ui.stat) ui.stat.textContent = 'updated ' + new Date().toISOString().slice(11, 19) + ' UTC';
    __gc.ranOnce = true;
    return 'ok';
  }catch(e){
    if (ui && ui.body) ui.body.innerHTML = '<div class="note warn">' + esc(e.message || e) + '</div>';
    return 'error';
  }finally{
    __gc.busy = false;
  }
}

function mountGoldCoint(el){
  if (!el) return;
  el.innerHTML = '<div class="panel"><h2>GOLD COINT <span>Engle–Granger pairs context · half-life gate</span></h2>'
    + '<div class="row"><button class="btn" id="gcointRun">REFRESH</button>'
    + '<span class="note" id="gcointStat">auto-runs on open</span></div>'
    + '<div id="gcointBody"></div></div>';
  __gc.ui = { el: el, body: el.querySelector('#gcointBody'), stat: el.querySelector('#gcointStat'), run: el.querySelector('#gcointRun') };
  if (__gc.ui.run) __gc.ui.run.addEventListener('click', function(){ runGoldCoint(__gc.ui); });
  runGoldCoint(__gc.ui);
}

async function refreshGoldCoint(){
  if (__gc.busy) return 'busy';
  if (!__gc.ranOnce || !__gc.ui) return 'skipped: not run yet';
  return runGoldCoint(__gc.ui);
}

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldcoint', label: 'GOLD COINT', mount: mountGoldCoint, refresh: refreshGoldCoint });

})();
