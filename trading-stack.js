/* HARDGATE — trading-stack browser bridge (ccxt + OpenBB + Freqtrade + XM status).
   Warms public desks and surfaces unified stack panel in SCORECARD / formation instr. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __stackSnap = null;
var __stackAt = 0;
var STACK_TTL = 2 * 60 * 1000;

function lamp(on, label){
  var cls = on ? 'hg-lamp--pass' : 'hg-lamp--veto';
  return '<span class="hg-lamp ' + cls + '" title="' + label + '">' + label + '</span>';
}

async function refreshTradingStack(force){
  if (!force && __stackSnap && (Date.now() - __stackAt) < STACK_TTL) return __stackSnap;
  try{
    var r = await fetch('/api/trading-stack/status', { cache: 'no-store' });
    if (!r.ok) return __stackSnap;
    __stackSnap = await r.json();
    __stackAt = Date.now();
    return __stackSnap;
  }catch(e){
    return __stackSnap;
  }
}

function hgTradingStackPanelHtml(){
  var st = __stackSnap;
  if (!st) return '';
  var h = '<div class="hg-panel" style="margin:10px 0 4px">'
    + '<div class="hg-panel__legend">Trading stack · best-repo patterns</div>';
  if (st.repos && st.repos.length){
    h += '<div class="note" style="line-height:1.6;margin-bottom:6px">';
    for (var i = 0; i < st.repos.length; i++){
      var rp = st.repos[i];
      h += (i ? ' · ' : '') + '<b>' + (rp.repo || rp.id) + '</b>';
    }
    h += '</div>';
  }
  h += '<div class="hg-gaterow hg-gaterow--wrap" style="margin-bottom:6px">';
  h += lamp(!!(st.ccxt && st.ccxt.configured !== false), 'CCXT');
  h += lamp(!!(st.openbb && (st.openbb.openbbBackend || st.openbb.url)), 'OpenBB+');
  h += lamp(!!(st.openbb && st.openbb.ok), 'MACRO');
  h += lamp(!!(st.xm && st.xm.configured), 'XM');
  h += lamp(!!(st.execute && st.execute.ready), 'EXEC');
  if (st.freqtrade){
    h += lamp(!!st.freqtrade.edgeGate, 'FT-EDGE');
    h += lamp(!!st.freqtrade.protectGate, 'FT-PROT');
  }
  if (st.halt) h += lamp(false, 'HALT');
  if (st.dryRun) h += '<span class="hg-lamp hg-lamp--veto" title="daemon dry run">DRY</span>';
  h += '</div>';
  if (st.ccxt && st.ccxt.marketExchange){
    h += '<div class="note">CCXT desk · ' + st.ccxt.marketExchange
      + (st.ccxt.symbols && st.ccxt.symbols.length ? ' · ' + st.ccxt.symbols.join(', ') : '')
      + '</div>';
  }
  if (st.xm){
    h += '<div class="note">Gold broker · XM ' + (st.xm.configured ? ('configured · ' + (st.xm.symbol || 'XAUUSD')) : 'not configured — set XM_MT5_URL on Render') + '</div>';
  }
  if (st.execute){
    h += '<div class="note">Execute · mode ' + (st.execute.mode || 'none')
      + (st.execute.ready ? ' · ready' : ' · keys/backend unset') + '</div>';
  }
  if (st.gates){
    h += '<div class="note" style="margin-top:4px">Daemon gates · FQS ' + (st.gates.fqs ? 'ON' : 'off')
      + ' · EDGE ' + (st.gates.edge ? 'ON' : 'off')
      + ' · FT edge ' + (st.gates.ftEdge ? 'ON' : 'off')
      + ' · FT protect ' + (st.gates.ftProtect ? 'ON' : 'off') + '</div>';
  }
  h += '</div>';
  return h;
}

async function warmTradingStackDesks(){
  var jobs = [refreshTradingStack(true)];
  if (typeof G.refreshDeskMacro === 'function') jobs.push(G.refreshDeskMacro(true));
  if (typeof G.refreshCcxtDesk === 'function') jobs.push(G.refreshCcxtDesk(true));
  await Promise.allSettled(jobs);
}

try{
  G.refreshTradingStack = refreshTradingStack;
  G.hgTradingStackPanelHtml = hgTradingStackPanelHtml;
  G.warmTradingStackDesks = warmTradingStackDesks;
  if (typeof document !== 'undefined'){
    document.addEventListener('DOMContentLoaded', function(){
      warmTradingStackDesks().catch(function(){});
    });
  }
}catch(e){}

})();
