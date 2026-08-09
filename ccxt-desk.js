/* HARDGATE — CCXT public market desk bridge for formation + FTS stack.
   Fetches /api/ccxt/desk (funding + tickers + fundingArb) and exposes sync getters. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __ccxtSnap = null;
var __ccxtBusy = false;
var __ccxtAt = 0;
var CCXT_TTL = 3 * 60 * 1000;

function ccxtFundingAnnualPct(r){
  if (r == null || !isFinite(+r)) return null;
  return Math.round(+r * 3 * 365 * 100 * 100) / 100;
}

function ccxtCarryLabel(rate){
  if (rate == null || !isFinite(+rate)) return '—';
  var ann = ccxtFundingAnnualPct(rate);
  if (ann == null) return '—';
  if (ann >= 35) return 'LONG-PAY';
  if (ann >= 18) return 'CROWDED';
  if (ann <= -35) return 'SHORT-PAY';
  if (ann <= -18) return 'HARVEST';
  return 'NEUTRAL';
}

function ccxtFundingFormationBoost(dir, leg){
  if (!leg || leg.fundingRate == null) return 0;
  var side = String(dir || 'long').toLowerCase();
  var ann = leg.fundingAnnualPct != null ? +leg.fundingAnnualPct : ccxtFundingAnnualPct(leg.fundingRate);
  if (!isFinite(ann)) return 0;
  if (side === 'long'){
    if (ann >= 35) return -12;
    if (ann >= 18) return -7;
    if (ann >= 8) return -3;
    if (ann <= -35) return 12;
    if (ann <= -18) return 7;
    if (ann <= -8) return 3;
    return 0;
  }
  if (ann <= -35) return -12;
  if (ann <= -18) return -7;
  if (ann <= -8) return -3;
  if (ann >= 35) return 12;
  if (ann >= 18) return 7;
  if (ann >= 8) return 3;
  return 0;
}

function legForSym(desk, sym){
  if (!desk) return null;
  if (desk.legs && desk.legs[sym]) return desk.legs[sym];
  var u = String(sym || '').toUpperCase();
  if (/BTC/.test(u)) return desk.btc;
  if (/ETH/.test(u)) return desk.eth;
  return desk.btc || null;
}

function ccxtFundingArbFromDesk(desk){
  if (!desk) return null;
  if (desk.fundingArb && desk.fundingArb.signals) return desk.fundingArb;
  var btc = legForSym(desk, 'BTC/USDT:USDT') || desk.btc;
  var eth = legForSym(desk, 'ETH/USDT:USDT') || desk.eth;
  if (!btc || !eth || btc.fundingRate == null || eth.fundingRate == null) return { signals: [], at: Date.now(), source: 'ccxt-desk-local' };
  var annA = ccxtFundingAnnualPct(btc.fundingRate);
  var annB = ccxtFundingAnnualPct(eth.fundingRate);
  var annSpread = (annA != null && annB != null) ? annA - annB : null;
  var label = 'NEUTRAL';
  if (annSpread != null){
    if (annSpread >= 15) label = 'HARVEST-LONG-A';
    else if (annSpread <= -15) label = 'HARVEST-SHORT-A';
    else if (Math.abs(annSpread) >= 8) label = 'CARRY-SKEW';
  }
  return {
    signals: [{
      pair: 'BTC-ETH',
      spread: (+btc.fundingRate) - (+eth.fundingRate),
      annSpread: annSpread,
      label: label,
      legA: btc.symbol || 'BTC/USDT:USDT',
      legB: eth.symbol || 'ETH/USDT:USDT',
      at: Date.now(),
    }],
    at: Date.now(),
    source: 'ccxt-desk-local',
  };
}

function arbLabelClass(label){
  var l = String(label || '').toUpperCase();
  if (l.indexOf('HARVEST') >= 0) return 'pos';
  if (l === 'CARRY-SKEW') return 'hg-num';
  return '';
}

function getCcxtDeskCached(){
  try{
    if (__ccxtSnap) return JSON.parse(JSON.stringify(__ccxtSnap));
    return null;
  }catch(e){ return null; }
}

async function refreshCcxtDesk(force){
  if (__ccxtBusy) return __ccxtSnap;
  if (!force && __ccxtSnap && (Date.now() - __ccxtAt) < CCXT_TTL) return __ccxtSnap;
  __ccxtBusy = true;
  try{
    var url = '/api/ccxt/desk' + (force ? '?refresh=1' : '');
    var res = await fetch(url, { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __ccxtSnap = j.desk;
      if (!__ccxtSnap.fundingArb) __ccxtSnap.fundingArb = ccxtFundingArbFromDesk(__ccxtSnap);
      __ccxtAt = Date.now();
    }
  }catch(e){}
  finally{ __ccxtBusy = false; }
  return __ccxtSnap;
}

function ccxtDeskFormationBoost(dir, sym, desk){
  desk = desk || __ccxtSnap;
  var leg = legForSym(desk, sym);
  return ccxtFundingFormationBoost(dir, leg);
}

function hgCcxtDeskPanelHtml(){
  var d = getCcxtDeskCached();
  if (!d){
    return '<div class="note" style="margin-top:10px">CCXT desk — loading… refreshes every 3 min · '
      + '<button type="button" class="btn ghost" style="padding:2px 8px;font-size:11px" onclick="refreshCcxtDesk(true).then(function(){location.reload()})">REFRESH</button></div>';
  }
  var h = '<div class="hg-panel__legend" style="margin-top:10px">CCXT desk · perp funding (Binance USD-M)</div>';
  h += '<div class="note" style="line-height:1.55">Public funding rates for formation scoring. '
    + '<button type="button" class="btn ghost" style="padding:2px 8px;font-size:11px;vertical-align:baseline" onclick="refreshCcxtDesk(true).then(function(){if(typeof hgScorecardRepaint===\'function\')hgScorecardRepaint();else location.reload()})">REFRESH</button></div>';
  h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>leg</th><th>mark</th><th>8h fund</th><th>ann %</th><th>carry</th></tr></thead><tbody>';
  function legRow(name, leg){
    if (!leg) return;
    var fr = leg.fundingRate;
    var ann = leg.fundingAnnualPct != null ? leg.fundingAnnualPct : ccxtFundingAnnualPct(fr);
    h += '<tr><td>' + name + '</td><td class="hg-num">' + (leg.mark != null ? (+leg.mark).toFixed(2) : '—')
      + '</td><td class="hg-num">' + (fr != null ? ((+fr) * 100).toFixed(4) + '%' : '—')
      + '</td><td class="hg-num">' + (ann != null ? ann.toFixed(1) : '—')
      + '</td><td>' + ccxtCarryLabel(fr) + '</td></tr>';
  }
  legRow('BTC', d.btc || legForSym(d, 'BTC/USDT:USDT'));
  legRow('ETH', d.eth || legForSym(d, 'ETH/USDT:USDT'));
  h += '</tbody></table>';

  var arb = ccxtFundingArbFromDesk(d);
  h += '<div class="hg-panel__legend" style="margin-top:12px">Funding arb · signal-only</div>';
  h += '<div class="note">BTC vs ETH funding spread — informational; not auto-traded. Verify basis, fees, and hedge legs before acting.</div>';
  if (arb && arb.signals && arb.signals.length){
    h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>pair</th><th>ann spread</th><th>signal</th></tr></thead><tbody>';
    for (var i = 0; i < arb.signals.length; i++){
      var s = arb.signals[i];
      var cls = arbLabelClass(s.label);
      h += '<tr><td>' + (s.pair || '—') + '</td><td class="hg-num">'
        + (s.annSpread != null ? ((+s.annSpread >= 0 ? '+' : '') + (+s.annSpread).toFixed(1) + '%') : '—')
        + '</td><td' + (cls ? ' class="' + cls + '"' : '') + '><b>' + (s.label || 'NEUTRAL') + '</b></td></tr>';
    }
    h += '</tbody></table>';
  } else {
    h += '<div class="note">No BTC+ETH funding pair on desk yet.</div>';
  }
  return h;
}

G.getCcxtDeskCached = getCcxtDeskCached;
G.refreshCcxtDesk = refreshCcxtDesk;
G.ccxtDeskFormationBoost = ccxtDeskFormationBoost;
G.ccxtFundingFormationBoost = ccxtFundingFormationBoost;
G.hgCcxtDeskPanelHtml = hgCcxtDeskPanelHtml;
G.ccxtFundingArbFromDesk = ccxtFundingArbFromDesk;

try{
  if (typeof G.addEventListener === 'function'){
    G.addEventListener('load', function(){
      setTimeout(function(){ refreshCcxtDesk(false); }, 1200);
    });
  }
}catch(e){}

})();
