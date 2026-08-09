/* HARDGATE — OpenBB desk macro browser bridge for formation + FTS stack.
   Fetches /api/openbb/desk and exposes sync getters for scans. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __deskSnap = null;
var __deskBusy = false;
var __deskAt = 0;
var DESK_TTL = 5 * 60 * 1000;

function num(v){
  var n = +v;
  return (v === undefined || v === null || v === '' || !isFinite(n)) ? null : n;
}

function obbRiskOnScore(desk){
  if (!desk) return 0;
  var s = 0;
  var spx = desk.spx || desk.spy;
  if (spx && spx.trend20 === 'RISING') s += 25;
  else if (spx && spx.trend20 === 'FALLING') s -= 25;
  var vix = desk.vix;
  if (vix && isFinite(+vix.last)){
    if (+vix.last >= 28) s -= 20;
    else if (+vix.last >= 22) s -= 10;
    else if (+vix.last <= 14) s += 10;
  }
  if (vix && vix.trend20 === 'RISING') s -= 8;
  else if (vix && vix.trend20 === 'FALLING') s += 8;
  var dxy = desk.dxyOfficial || desk.dxy;
  if (dxy && dxy.trend20 === 'RISING') s -= 15;
  else if (dxy && dxy.trend20 === 'FALLING') s += 15;
  if (desk.realYieldTrend === 'RISING') s -= 8;
  else if (desk.realYieldTrend === 'FALLING') s += 8;
  var btc = desk.btc;
  if (btc && btc.trend20 === 'RISING') s += 12;
  else if (btc && btc.trend20 === 'FALLING') s -= 12;
  return Math.max(-100, Math.min(100, Math.round(s)));
}

function obbDeskFormationBoost(dir, desk){
  desk = desk || __deskSnap;
  if (!desk) return 0;
  var side = String(dir || 'long').toLowerCase();
  var score = desk.riskOnScore != null ? +desk.riskOnScore : obbRiskOnScore(desk);
  if (side === 'long'){
    if (score >= 40) return 12;
    if (score >= 20) return 7;
    if (score >= 8) return 3;
    if (score <= -40) return -12;
    if (score <= -20) return -7;
    if (score <= -8) return -3;
    return 0;
  }
  if (score <= -40) return 12;
  if (score <= -20) return 7;
  if (score <= -8) return 3;
  if (score >= 40) return -12;
  if (score >= 20) return -7;
  if (score >= 8) return -3;
  return 0;
}

function getDeskMacroCached(){
  try{
    if (__deskSnap) return JSON.parse(JSON.stringify(__deskSnap));
    if (typeof G.getGoldMacroCached === 'function'){
      var gm = G.getGoldMacroCached();
      if (gm) return gm;
    }
    return null;
  }catch(e){ return null; }
}

async function refreshDeskMacro(force){
  if (__deskBusy) return __deskSnap;
  if (!force && __deskSnap && (Date.now() - __deskAt) < DESK_TTL) return __deskSnap;
  __deskBusy = true;
  try{
    var gm = null;
    if (typeof G.getGoldMacro === 'function'){
      try{ gm = await G.getGoldMacro(); }catch(eG){}
    }
    var res = await fetch('/api/openbb/desk' + (force ? '?refresh=1' : ''), { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __deskSnap = Object.assign({}, gm || {}, j.desk, {
        realRateHint: (gm && gm.realRateHint) || j.desk.realRateHint,
        dxyOfficial: (gm && gm.dxyOfficial) || j.desk.dxyOfficial,
        realYield10Y: (gm && gm.realYield10Y) != null ? gm.realYield10Y : j.desk.realYield10Y,
        realYieldTrend: (gm && gm.realYieldTrend) || j.desk.realYieldTrend,
      });
      if (__deskSnap.riskOnScore == null) __deskSnap.riskOnScore = obbRiskOnScore(__deskSnap);
      if (!__deskSnap.riskOnLabel){
        var rs = __deskSnap.riskOnScore;
        __deskSnap.riskOnLabel = rs >= 35 ? 'RISK-ON' : (rs <= -35 ? 'RISK-OFF' : 'MIXED');
      }
      __deskAt = Date.now();
      return __deskSnap;
    }
    if (gm){ __deskSnap = gm; __deskAt = Date.now(); return gm; }
    return __deskSnap;
  }catch(e){
    return __deskSnap;
  }finally{
    __deskBusy = false;
  }
}

function hgOpenbbDeskPanelHtml(){
  var d = getDeskMacroCached();
  if (!d) return '<div class="note">OpenBB desk — loading… run refresh or open REGIME</div>';
  var h = '<div class="hg-panel__legend" style="margin-top:10px">OpenBB desk · cross-asset context</div>';
  h += '<div class="note">Risk-on score <span class="hg-num">' + (d.riskOnScore != null ? d.riskOnScore : 'n/a')
    + '</span> · ' + (d.riskOnLabel || 'MIXED') + '</div>';
  h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>leg</th><th>last</th><th>20d</th></tr></thead><tbody>';
  function leg(name, o){
    if (!o) return;
    h += '<tr><td>' + name + '</td><td class="hg-num">' + (o.last != null ? (+o.last).toFixed(2) : '—')
      + '</td><td>' + (o.trend20 || '—') + '</td></tr>';
  }
  leg('SPY', d.spx || d.spy);
  leg('QQQ', d.qqq);
  leg('VIX', d.vix);
  leg('BTC', d.btc);
  h += '</tbody></table>';
  return h;
}

G.getDeskMacroCached = getDeskMacroCached;
G.refreshDeskMacro = refreshDeskMacro;
G.hgDeskFormationBoost = obbDeskFormationBoost;
G.hgOpenbbDeskPanelHtml = hgOpenbbDeskPanelHtml;
G.obbRiskOnScore = obbRiskOnScore;

try{
  refreshDeskMacro(false);
}catch(e){}

})();
