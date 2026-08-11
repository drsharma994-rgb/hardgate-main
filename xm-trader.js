/* =========================================================================
HARDGATE — xm-trader.js
XM broker XAUUSD/GOLD candles via same-origin /api/xm (MT5 REST bridge).
Used by GOLD SCALP / GOLD SWING / StarTrader XAUUSD routing.

EXPORTS:
  getXmGoldCandles(res, count) -> Promise<{ rows, source, symbol?, reason? }>
  xmGoldConfigured() -> Promise<boolean>
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

var __xmCfg = null;
var __xmCfgAt = 0;

async function xmLoadStatus(){
  if (__xmCfg && (Date.now() - __xmCfgAt) < 120000) return __xmCfg;
  try{
    var r = await fetch('/api/xm/status', { cache: 'no-store' });
    if (!r.ok){ __xmCfg = { configured: false }; __xmCfgAt = Date.now(); return __xmCfg; }
    __xmCfg = await r.json();
    __xmCfgAt = Date.now();
    return __xmCfg;
  }catch(e){
    __xmCfg = { configured: false };
    __xmCfgAt = Date.now();
    return __xmCfg;
  }
}

async function xmGoldConfigured(){
  var st = await xmLoadStatus();
  return !!(st && st.configured);
}

async function getXmGoldCandles(res, count){
  try{
    res = res || '15m';
    count = Math.max(10, Math.min(5000, +(count || 200)));
    var url = '/api/xm/candles?tf=' + encodeURIComponent(res) + '&count=' + count;
    var r = await fetch(url, { cache: 'no-store' });
    var j = null;
    try{ j = await r.json(); }catch(e2){ j = null; }
    if (!j){
      return { rows: [], source: null, reason: 'invalid json from /api/xm/candles' };
    }
    if (j.ok && j.rows && j.rows.length){
      return { rows: j.rows, source: j.source || 'xm-xauusd', symbol: j.symbol || 'XAUUSD' };
    }
    return { rows: [], source: null, reason: j.reason || ('HTTP ' + r.status) };
  }catch(e){
    return { rows: [], source: null, reason: (e && e.message) || 'xm fetch failed' };
  }
}

G.getXmGoldCandles = getXmGoldCandles;
G.xmGoldConfigured = xmGoldConfigured;
})();
