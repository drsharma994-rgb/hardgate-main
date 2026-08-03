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
var EXEC_RETRY = 1;

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

function executeIdempotencyKey(plan){
  if (plan && plan.idempotencyKey) return String(plan.idempotencyKey);
  var bucket = Math.floor(Date.now() / 60000);
  var raw = [plan.sym, plan.side, plan.qty, plan.stop, plan.t1, plan.t2, plan.positionId || '', bucket].join('|');
  var h = 0;
  for (var i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  return 'hgx-' + Math.abs(h).toString(36) + '-' + bucket;
}

function buildPayload(plan){
  if (!plan || plan.vetoed) return null;
  if (!plan.sym || !plan.side || !(plan.qty > 0)) return null;
  if (!isFinite(plan.stop) || !isFinite(plan.t1)) return null;
  var ts = (typeof W.nowSec === 'function') ? W.nowSec() : Math.floor(Date.now() / 1000);
  var idem = executeIdempotencyKey(plan);
  var bracket = { stop: +plan.stop, takeProfit: +plan.t1 };
  if (isFinite(plan.t2)) bracket.takeProfit2 = +plan.t2;
  return {
    symbol: plan.sym,
    side: plan.side,
    qty: +plan.qty,
    leverage: isFinite(plan.lev) ? +plan.lev : undefined,
    bracket: bracket,
    timestamp: ts,
    source: plan.source || 'hardgate-trade-plan',
    idempotencyKey: idem,
    positionId: plan.positionId || undefined,
    entry: isFinite(plan.entry) ? +plan.entry : undefined,
  };
}

function sleep(ms){
  return new Promise(function(resolve){ setTimeout(resolve, ms); });
}

async function recordExecuteBlotter(plan, payload, result){
  try{
    if (typeof W.hgApiAvailable !== 'function' || !W.hgApiAvailable()) return;
    if (typeof W.bookFundBody !== 'function') return;
    var body = W.bookFundBody({
      fund: plan.fund || undefined,
      ok: !!(result && result.ok),
      sym: plan.sym,
      dir: plan.side,
      qty: plan.qty,
      status: result && result.status,
      note: (result && result.json && (result.json.response || result.json.reason)) || result.reason || '',
      idempotencyKey: payload && payload.idempotencyKey,
      positionId: plan.positionId,
    });
    await fetch('/api/book/execute-blotter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (typeof W.bookRefresh === 'function') W.bookRefresh();
  }catch(e){}
}

function parseExecuteFill(plan, result){
  if (!plan || !plan.positionId || !result || !result.ok) return null;
  var j = result.json || {};
  var src = j.fill || null;
  if (!src && j.response){
    try{
      var parsed = JSON.parse(j.response);
      if (parsed && parsed.fill) src = parsed.fill;
      else if (parsed && (parsed.filledQty || parsed.filled_qty || parsed.filled)) src = parsed;
    }catch(e2){}
  }
  if (!src || !(src.filledQty > 0 || src.filled_qty > 0 || src.filled > 0)) return null;
  return {
    positionId: plan.positionId,
    fund: plan.fund,
    filledQty: +(src.filledQty != null ? src.filledQty : (src.filled_qty != null ? src.filled_qty : src.filled)),
    qty: src.qty != null ? +src.qty : (plan.qty > 0 ? +plan.qty : undefined),
    avgPrice: src.avgPrice != null ? +src.avgPrice : (src.avg_price != null ? +src.avg_price : undefined),
    note: src.note || 'auto from execute response',
  };
}

async function recordExecuteFill(plan, fill){
  try{
    if (!fill || !fill.positionId) return;
    if (typeof W.hgApiAvailable !== 'function' || !W.hgApiAvailable()) return;
    if (typeof W.bookFundBody !== 'function') return;
    var body = W.bookFundBody(Object.assign({ fund: plan.fund }, fill));
    await fetch('/api/book/execute-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (typeof W.bookRefresh === 'function') W.bookRefresh();
  }catch(e){}
}

async function postExecute(url, payload){
  var body = url.indexOf('/api/execute') >= 0 ? { plan: payload, idempotencyKey: payload.idempotencyKey } : payload;
  var last = { ok: false, status: 0, json: null, reason: 'network error' };
  for (var attempt = 0; attempt <= EXEC_RETRY; attempt++){
    if (attempt) await sleep(500);
    try{
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var j = null;
      try{ j = await res.json(); }catch(e2){}
      last = { ok: res.ok, status: res.status, json: j };
      if (res.ok || (res.status !== 502 && res.status !== 503 && res.status !== 504)) break;
    }catch(e){
      last = { ok: false, status: 0, reason: (e && e.message) || String(e) };
    }
  }
  return last;
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

async function executeTrade(plan, opts){
  opts = (opts && typeof opts === 'object') ? opts : {};
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
  if (!opts.skipConfirm){
    if (!confirm('Send this bracket?\n\n' + JSON.stringify(payload, null, 2))) return { ok: false, reason: 'cancelled' };
  }
  var result = await postExecute(url, payload);
  await recordExecuteBlotter(plan, payload, result);
  if (result.ok){
    var autoFill = parseExecuteFill(plan, result);
    if (autoFill) await recordExecuteFill(plan, autoFill);
  }
  if (!result.ok){
    var msg = (result.json && result.json.reason) || (result.json && result.json.response) || result.reason || ('HTTP ' + result.status);
    try{ alert('Execution failed: ' + msg); }catch(e4){}
    return { ok: false, status: result.status, json: result.json, reason: msg };
  }
  if (!opts.skipConfirm){
    try{ alert('Bracket sent (HTTP ' + result.status + ').'); }catch(e5){}
  }
  return { ok: true, status: result.status, json: result.json, idempotencyKey: payload.idempotencyKey };
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
W.hgExecuteIdempotencyKey = executeIdempotencyKey;

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
