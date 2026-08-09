/* HARDGATE — World Monitor desk bridge for crypto + gold formation knowledge.
   Fetches /api/worldmonitor/desk (WM API or local fallback). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __wmSnap = null;
var __wmBusy = false;
var __wmAt = 0;
var WM_TTL = 5 * 60 * 1000;

function wmMacroBoost(dir, macro){
  if (!macro || macro.unavailable) return 0;
  var side = String(dir || 'long').toLowerCase();
  var v = String(macro.verdict || '').toUpperCase();
  if (v === 'BUY') return side === 'long' ? 10 : -8;
  if (v === 'CASH') return side === 'long' ? -5 : 4;
  return 0;
}

function wmStressBoost(dir, stress){
  if (!stress || !stress.label) return 0;
  var side = String(dir || 'long').toLowerCase();
  var lbl = String(stress.label);
  if (lbl === 'Critical' || lbl === 'Severe') return side === 'long' ? -10 : 6;
  if (lbl === 'Elevated') return side === 'long' ? -6 : 3;
  if (lbl === 'Low') return side === 'long' ? 4 : -2;
  return 0;
}

function wmGoldBoost(dir, gold){
  if (!gold || gold.unavailable) return 0;
  var side = String(dir || 'long').toLowerCase();
  var boost = 0;
  if (gold.etfFlows && isFinite(+gold.etfFlows.changeW1Tonnes)){
    var w1 = +gold.etfFlows.changeW1Tonnes;
    if (w1 > 0 && side === 'long') boost += 6;
    else if (w1 < 0 && side === 'short') boost += 4;
    else if (w1 < 0 && side === 'long') boost -= 5;
  }
  if (isFinite(+gold.goldChangePct)){
    if (+gold.goldChangePct > 0.5 && side === 'long') boost += 2;
    if (+gold.goldChangePct < -0.5 && side === 'short') boost += 2;
  }
  return Math.max(-12, Math.min(12, boost));
}

function wmHlBoost(dir, sym, hl){
  if (!hl || !hl.assets || !hl.assets.length) return 0;
  var side = String(dir || 'long').toLowerCase();
  var u = String(sym || '').toUpperCase();
  var want = /ETH/.test(u) ? 'ETH' : (/XAU|XAUT|GOLD|PAXG/.test(u) ? 'PAXG' : 'BTC');
  var leg = null;
  for (var i = 0; i < hl.assets.length; i++){
    if (hl.assets[i] && hl.assets[i].symbol === want){ leg = hl.assets[i]; break; }
  }
  if (!leg && /GOLD|XAU/.test(u)){
    for (var j = 0; j < hl.assets.length; j++){
      if (hl.assets[j] && hl.assets[j].symbol === 'xyz:GOLD'){ leg = hl.assets[j]; break; }
    }
  }
  if (!leg || !isFinite(+leg.score)) return 0;
  var boost = +leg.score >= 60 ? -7 : (+leg.score >= 40 ? -3 : 0);
  var fr = leg.fundingRate != null ? +leg.fundingRate : null;
  if (fr != null){
    if (side === 'long' && fr > 0.0003) boost -= 4;
    if (side === 'long' && fr < -0.0001) boost += 3;
  }
  return Math.max(-12, Math.min(12, boost));
}

function wmDeskFormationBoost(dir, sym, desk, asset){
  desk = desk || __wmSnap;
  asset = asset || (/(XAU|XAUT|GOLD|PAXG)/i.test(sym) ? 'gold' : 'crypto');
  var total = wmMacroBoost(dir, desk.macro) + wmStressBoost(dir, desk.stress);
  if (asset === 'gold') total += wmGoldBoost(dir, desk.gold);
  if (desk.hyperliquid) total += wmHlBoost(dir, sym, desk.hyperliquid);
  return Math.max(-12, Math.min(12, total));
}

function getWorldMonitorDeskCached(){
  try{
    if (__wmSnap) return JSON.parse(JSON.stringify(__wmSnap));
    return null;
  }catch(e){ return null; }
}

async function refreshWorldMonitorDesk(force){
  if (__wmBusy) return __wmSnap;
  if (!force && __wmSnap && (Date.now() - __wmAt) < WM_TTL) return __wmSnap;
  __wmBusy = true;
  try{
    var url = '/api/worldmonitor/desk' + (force ? '?refresh=1' : '');
    var res = await fetch(url, { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __wmSnap = j.desk;
      __wmAt = Date.now();
    }
  }catch(e){}
  finally{ __wmBusy = false; }
  return __wmSnap;
}

function hgWorldMonitorDeskPanelHtml(){
  var d = getWorldMonitorDeskCached();
  if (!d){
    return '<div class="note" style="margin-top:10px">World Monitor desk — loading… '
      + '<button type="button" class="btn ghost" style="padding:2px 8px;font-size:11px" onclick="refreshWorldMonitorDesk(true).then(function(){location.reload()})">REFRESH</button></div>';
  }
  var h = '<div class="hg-panel__legend" style="margin-top:10px">World Monitor · macro + gold + perp context</div>';
  h += '<div class="note" style="line-height:1.55">Knowledge score <span class="hg-num">' + (d.knowledgeScore != null ? d.knowledgeScore : '—')
    + '</span> · source <b>' + (d.source || 'local') + '</b> · '
    + '<button type="button" class="btn ghost" style="padding:2px 8px;font-size:11px;vertical-align:baseline" onclick="refreshWorldMonitorDesk(true).then(function(){location.reload()})">REFRESH</button></div>';

  if (d.macro && !d.macro.unavailable){
    h += '<div class="note">Macro verdict <b class="' + (d.macro.verdict === 'BUY' ? 'pos' : '') + '">' + (d.macro.verdict || '—')
      + '</b> · ' + (d.macro.bullishCount || 0) + '/' + (d.macro.totalCount || 0) + ' bullish signals';
    if (d.macro.fearGreed && d.macro.fearGreed.value != null){
      h += ' · F&amp;G <span class="hg-num">' + d.macro.fearGreed.value + '</span>';
    }
    h += '</div>';
    if (d.macro.signals && d.macro.signals.length){
      h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>signal</th><th>status</th></tr></thead><tbody>';
      for (var si = 0; si < d.macro.signals.length; si++){
        var sg = d.macro.signals[si];
        h += '<tr><td>' + (sg.name || '—') + '</td><td>' + (sg.status || '—') + '</td></tr>';
      }
      h += '</tbody></table>';
    }
  }

  if (d.stress && d.stress.label){
    h += '<div class="note" style="margin-top:8px">Economic stress <b>' + d.stress.label + '</b>'
      + (d.stress.vix != null ? ' · VIX ' + (+d.stress.vix).toFixed(1) : '')
      + (d.stress.t10y2y != null ? ' · 10Y-2Y ' + (+d.stress.t10y2y).toFixed(2) : '')
      + '</div>';
  }

  if (d.gold && !d.gold.unavailable){
    h += '<div class="note" style="margin-top:8px">Gold <span class="hg-num">' + (d.gold.goldPrice != null ? (+d.gold.goldPrice).toFixed(2) : '—')
      + '</span>'
      + (d.gold.goldChangePct != null ? ' · ' + ((+d.gold.goldChangePct >= 0 ? '+' : '') + (+d.gold.goldChangePct).toFixed(2) + '%') : '')
      + (d.gold.etfFlows && d.gold.etfFlows.changeW1Tonnes != null ? ' · GLD w/w ' + (+d.gold.etfFlows.changeW1Tonnes).toFixed(1) + 't' : '')
      + '</div>';
  }

  if (d.hyperliquid && d.hyperliquid.assets && d.hyperliquid.assets.length){
    h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>HL perp</th><th>fund</th><th>stress</th></tr></thead><tbody>';
    for (var hi = 0; hi < d.hyperliquid.assets.length; hi++){
      var a = d.hyperliquid.assets[hi];
      h += '<tr><td>' + (a.display || a.symbol) + '</td><td class="hg-num">'
        + (a.fundingRate != null ? ((+a.fundingRate) * 100).toFixed(4) + '%' : '—')
        + '</td><td class="hg-num">' + (a.score != null ? a.score : '—')
        + (a.alert ? ' <span class="neg">ALERT</span>' : '') + '</td></tr>';
    }
    h += '</tbody></table>';
  }

  h += '<div class="note" style="margin-top:6px;font-size:11px">Methodology aligned with '
    + '<a href="https://github.com/koala73/worldmonitor" target="_blank" rel="noopener">worldmonitor</a>'
    + ' · set <code>WORLDMONITOR_API_KEY</code> on Render for live API desk</div>';
  return h;
}

G.getWorldMonitorDeskCached = getWorldMonitorDeskCached;
G.refreshWorldMonitorDesk = refreshWorldMonitorDesk;
G.wmDeskFormationBoost = wmDeskFormationBoost;
G.hgWorldMonitorDeskPanelHtml = hgWorldMonitorDeskPanelHtml;

try{
  if (typeof G.addEventListener === 'function'){
    G.addEventListener('load', function(){
      setTimeout(function(){ refreshWorldMonitorDesk(false); }, 1800);
    });
  }
}catch(e){}

})();
