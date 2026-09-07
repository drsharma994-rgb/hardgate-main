/* =========================================================================
HARDGATE — coinglass.js
Cross-venue liquidation clusters via /api/coinglass.
Never throws; 4h cache (free-tier cadence). Exposes window.coinglassClusters.
========================================================================= */
'use strict';

var __cgCache = new Map();
var CG_CACHE_MS = 4 * 60 * 60 * 1000;

function __cgGet(key){
  var h = __cgCache.get(key);
  return (h && (Date.now() - h.at) < CG_CACHE_MS) ? h.val : undefined;
}
function __cgPut(key, val){
  if (val !== null && val !== undefined) __cgCache.set(key, { at: Date.now(), val: val });
  return val;
}

function __coin(sym){
  sym = String(sym || '').toUpperCase();
  return sym.replace(/USDT$/, '');
}

async function __cgFetch(path, params){
  try{
    if (typeof fetch !== 'function') return null;
    var qs = 'path=' + encodeURIComponent(path);
    if (params){
      for (var k in params){
        if (Object.prototype.hasOwnProperty.call(params, k) && params[k] != null){
          qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
        }
      }
    }
    var res = await fetch('/api/coinglass?' + qs);
    if (!res.ok) return null;
    var j = await res.json();
    return j && j.data !== undefined ? j.data : null;
  }catch(e){ return null; }
}

function __parseClusters(payload){
  if (!payload || payload.code !== '0' && payload.code !== 0) return [];
  var data = payload.data;
  if (typeof window !== 'undefined' && typeof window.coinglassParseHeatmap === 'function'){
    var c1 = window.coinglassParseHeatmap(data);
    if (c1.length) return c1;
  }
  if (typeof window !== 'undefined' && typeof window.coinglassParseMap === 'function'){
    return window.coinglassParseMap(data) || [];
  }
  return [];
}

/** Fetch liquidation clusters for a symbol (coin-level aggregated heatmap). */
async function coinglassClusters(sym, range){
  try{
    var coin = __coin(sym);
    range = range || '3d';
    var key = 'liq|' + coin + '|' + range;
    var hit = __cgGet(key);
    if (hit !== undefined) return hit;
    var payload = await __cgFetch('aggregated-heatmap', { symbol: coin, range: range });
    var clusters = __parseClusters(payload);
    if (!clusters.length){
      payload = await __cgFetch('aggregated-map', { symbol: coin, range: range === '3d' ? '7d' : range });
      clusters = __parseClusters(payload);
    }
    var out = { sym: sym, coin: coin, clusters: clusters, range: range, at: Date.now() };
    return __cgPut(key, out);
  }catch(e){ return null; }
}

function coinglassStopWarn(clusters, stop, minUsd){
  if (typeof window !== 'undefined' && typeof window.coinglassStopWarning === 'function'){
    return window.coinglassStopWarning(clusters, stop, minUsd);
  }
  return null;
}

function coinglassConfluence(clusters, level, minUsd){
  if (typeof window !== 'undefined' && typeof window.coinglassConfluenceTag === 'function'){
    return window.coinglassConfluenceTag(clusters, level, minUsd);
  }
  return null;
}

async function coinglassWarm(){
  try{
    var s = await coinglassClusters('BTCUSDT');
    return (s && s.clusters && s.clusters.length)
      ? ('liq clusters ' + s.clusters.length + ' (' + s.coin + ')')
      : 'coinglass dark';
  }catch(e){ return 'coinglass error'; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.coinglassClusters = coinglassClusters;
W.coinglassStopWarn = coinglassStopWarn;
W.coinglassConfluence = coinglassConfluence;
W.coinglassWarm = coinglassWarm;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'coinglass', label: 'LIQ CLUSTERS', run: coinglassWarm });
