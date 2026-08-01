/* =========================================================================
HARDGATE — execute.js
TRADE PLAN bracket execution — same-origin /api/execute proxy on Render,
optional desk override via localStorage or window.HG_EXECUTE_BACKEND_OVERRIDE.

Exports on window:
  executeBackendReady()
  executeTrade(plan)
  hgRefreshExecuteCap()
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;
var __cap = { ready: false, mode: 'none', proxyPath: '/api/execute' };
var LS_KEY = 'hg_execute_backend_url';

function deskOverride(){
  try{
    if (typeof W.HG_EXECUTE_BACKEND_OVERRIDE === 'string' && W.HG_EXECUTE_BACKEND_OVERRIDE
      && W.HG_EXECUTE_BACKEND_OVERRIDE.indexOf('your-secure-backend.com') < 0){
      return W.HG_EXECUTE_BACKEND_OVERRIDE;
    }
    var local = localStorage.getItem(LS_KEY) || '';
    if (local && local.indexOf('your-secure-backend.com') < 0) return local;
  }catch(e){}
  return '';
}

function proxyUrl(){
  if (__cap.ready && __cap.mode === 'proxy') return __cap.proxyPath || '/api/execute';
  return '';
}

function executeBackendReady(){
  var override = deskOverride();
  if (override) return true;
  return !!proxyUrl();
}

function resolvePostUrl(){
  return deskOverride() || proxyUrl();
}

function buildPayload(plan){
  if (!plan || plan.vetoed) return null;
  if (!plan.sym || !plan.side || !(plan.qty > 0)) return null;
  var ts = (typeof W.nowSec === 'function') ? W.nowSec() : Math.floor(Date.now() / 1000);
  return {
    symbol: plan.sym,
    side: plan.side,
    qty: +plan.qty,
    leverage: isFinite(plan.lev) ? +plan.lev : undefined,
    bracket: { stop: +plan.stop, takeProfit: +plan.t1 },
    timestamp: ts,
    source: 'hardgate-trade-plan',
  };
}

async function hgRefreshExecuteCap(){
  if (typeof W.hgApiAvailable === 'function' && !W.hgApiAvailable()) return __cap;
  try{
    var r = await fetch('/api/execute/capabilities');
    var j = await r.json();
    if (j && j.ok) __cap = j;
  }catch(e){}
  return __cap;
}

async function executeTrade(plan){
  if (!plan || plan.vetoed){
    try{ alert('Cannot execute a vetoed plan.'); }catch(e){}
    return { ok: false, reason: 'vetoed' };
  }
  var url = resolvePostUrl();
  if (!url){
    try{ alert('EXECUTE BRACKET unavailable — set EXECUTE_BACKEND_URL on Render or save a backend URL in Settings.'); }catch(e2){}
    return { ok: false, reason: 'not configured' };
  }
  var payload = buildPayload(plan);
  if (!payload) return { ok: false, reason: 'invalid plan' };
  if (!confirm('Send this bracket?\n\n' + JSON.stringify(payload, null, 2))) return { ok: false, reason: 'cancelled' };
  try{
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(url.indexOf('/api/execute') >= 0 ? { plan: payload } : payload),
    });
    var j = null;
    try{ j = await res.json(); }catch(e3){}
    if (!res.ok){
      var msg = (j && j.reason) || (j && j.response) || ('HTTP ' + res.status);
      try{ alert('Execution failed: ' + msg); }catch(e4){}
      return { ok: false, status: res.status, json: j };
    }
    try{ alert('Bracket sent (HTTP ' + res.status + ').'); }catch(e5){}
    return { ok: true, status: res.status, json: j };
  }catch(e){
    try{ alert('Execution request failed: ' + ((e && e.message) || e)); }catch(e6){}
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

function saveExecuteBackendUrl(){
  try{
    var el = document.getElementById('executeBackendUrl');
    var stat = document.getElementById('executeBackendStat');
    var v = el ? String(el.value || '').trim() : '';
    if (v) localStorage.setItem(LS_KEY, v);
    else localStorage.removeItem(LS_KEY);
    if (stat) stat.textContent = v ? 'saved' : 'cleared (using Render proxy if set)';
  }catch(e){}
}

function initExecuteSettings(){
  try{
    var el = document.getElementById('executeBackendUrl');
    if (!el) return;
    var v = localStorage.getItem(LS_KEY) || '';
    if (v) el.value = v;
  }catch(e){}
}

W.executeBackendReady = executeBackendReady;
W.executeTrade = executeTrade;
W.hgRefreshExecuteCap = hgRefreshExecuteCap;
W.saveExecuteBackendUrl = saveExecuteBackendUrl;
W.hgExecuteCapabilities = function(){ return __cap; };

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){
    hgRefreshExecuteCap();
    initExecuteSettings();
  });
} else {
  hgRefreshExecuteCap();
  initExecuteSettings();
}

})();
