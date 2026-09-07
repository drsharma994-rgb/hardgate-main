/* HARDGATE — whale_alerts.js (Increment 5 spec module)
   Whale ticker feed helpers + analysis re-export. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function hgWhaleTickerHtml(transfers, limit){
  limit = limit || 12;
  if (typeof G.hgWhaleFlowAnalysis !== 'function') return '';
  var wh = G.hgWhaleFlowAnalysis(transfers || [], null);
  var events = (wh && wh.events) ? wh.events.slice().sort(function(a,b){ return (b.time||0)-(a.time||0); }) : [];
  if (!events.length){
    return '<div class="panel hg-whale-ticker" style="margin-top:10px"><h2>WHALE TICKER <span>≥$10M labeled moves · 24h</span></h2>'
      + '<div class="note">No whale events loaded — configure WHALE_ALERT_API_KEY on server or wait for desk refresh.</div></div>';
  }
  var rows = events.slice(0, limit).map(function(ev){
    var usd = (ev.usd >= 1e9) ? ('$' + (ev.usd/1e9).toFixed(2) + 'B') : ('$' + (ev.usd/1e6).toFixed(1) + 'M');
    return '<div class="lrow"><span class="gname">' + esc(ev.asset || '?') + '</span>'
      + '<span class="gdetail">' + esc(ev.type) + ' · ' + esc(ev.from) + ' → ' + esc(ev.to) + '</span>'
      + '<span class="stamp ' + (ev.type === 'DEPOSIT' ? 'veto' : (ev.type === 'WITHDRAWAL' ? 'pass' : 'na')) + '">' + usd + '</span></div>';
  }).join('');
  return '<div class="panel hg-whale-ticker" style="margin-top:10px"><h2>WHALE TICKER <span>≥$10M labeled moves · 24h</span></h2>'
    + '<div class="ledger">' + rows + '</div></div>';
}

G.hgWhaleTickerHtml = hgWhaleTickerHtml;
G.hgWhaleFlowAnalysis = G.hgWhaleFlowAnalysis || function(){ return { events: [], vetoDistribution: false }; };
})();
