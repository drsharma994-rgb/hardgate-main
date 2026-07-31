/* =========================================================================
HARDGATE — bybit.js
Bybit v5 linear perps public REST (api.bybit.com). No API key.
Mirrors the positioning legs used by SMART $ on Binance so a second
venue can cross-check crowding reads. Never throws; caches 60s.
========================================================================= */
'use strict';

var BYBIT_API = 'https://api.bybit.com';
var __byBucket = (typeof makeTokenBucket === 'function') ? makeTokenBucket(5, 5) : null;
var __BY_CACHE = new Map();
var BY_CACHE_MS = 60 * 1000;

async function __byFetchJson(url, timeoutMs){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 10000);
  try{
    if (__byBucket){
      var w = __byBucket.take();
      if (w > 0) await new Promise(function(r){ setTimeout(r, Math.min(w, 2000)); });
    }
    var res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    var j = await res.json();
    if (!j || j.retCode !== 0) return null;
    return j.result;
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

function __byCacheGet(key){
  var h = __BY_CACHE.get(key);
  return (h && (Date.now() - h.at) < BY_CACHE_MS) ? h.val : undefined;
}
function __byCachePut(key, val){
  if (val !== null && val !== undefined) __BY_CACHE.set(key, { at: Date.now(), val: val });
  return val;
}

/* GET /v5/market/tickers -> funding + mark */
async function bybitFunding(symbol){
  try{
    if (!symbol) return null;
    var key = 'funding|' + symbol;
    var hit = __byCacheGet(key); if (hit !== undefined) return hit;
    var r = await __byFetchJson(BYBIT_API + '/v5/market/tickers?category=linear&symbol=' + encodeURIComponent(symbol));
    var row = (r && Array.isArray(r.list)) ? r.list[0] : null;
    if (!row) return null;
    return __byCachePut(key, {
      fundingPct: isFinite(+row.fundingRate) ? (+row.fundingRate) * 100 : null,
      markPrice: isFinite(+row.lastPrice) ? +row.lastPrice : null
    });
  }catch(e){ return null; }
}

/* GET /v5/market/open-interest -> OI USD + 24h-ish change from series */
async function bybitOIHistory(symbol, limit){
  try{
    if (!symbol) return null;
    limit = Math.max(2, Math.min(50, limit || 25));
    var key = 'oi|' + symbol + '|' + limit;
    var hit = __byCacheGet(key); if (hit !== undefined) return hit;
    var r = await __byFetchJson(BYBIT_API + '/v5/market/open-interest?category=linear&symbol='
      + encodeURIComponent(symbol) + '&intervalTime=1h&limit=' + limit);
    if (!r || !Array.isArray(r.list) || !r.list.length) return null;
    var series = r.list.map(function(d){
      return { oi: +d.openInterest, oiUsd: isFinite(+d.openInterestValue) ? +d.openInterestValue : null,
               t: Math.floor((+d.timestamp) / 1000) };
    }).filter(function(x){ return isFinite(x.oi); }).sort(function(a,b){ return a.t - b.t; });
    if (!series.length) return null;
    var latest = series[series.length - 1];
    var first = series[0];
    var oiChgPct = (first.oi > 0) ? (latest.oi / first.oi - 1) * 100 : null;
    return __byCachePut(key, { latest: latest, series: series, oiChgPct: oiChgPct });
  }catch(e){ return null; }
}

/* GET /v5/market/account-ratio -> retail long % proxy */
async function bybitAccountRatio(symbol, period, limit){
  try{
    if (!symbol) return null;
    period = period || '1h';
    limit = Math.max(2, Math.min(50, limit || 2));
    var key = 'ar|' + symbol + '|' + period + '|' + limit;
    var hit = __byCacheGet(key); if (hit !== undefined) return hit;
    var r = await __byFetchJson(BYBIT_API + '/v5/market/account-ratio?category=linear&symbol='
      + encodeURIComponent(symbol) + '&period=' + period + '&limit=' + limit);
    if (!r || !Array.isArray(r.list) || !r.list.length) return null;
    var series = r.list.map(function(d){
      var buy = +d.buyRatio, sell = +d.sellRatio;
      var longPct = (isFinite(buy) && isFinite(sell) && (buy + sell) > 0) ? (buy / (buy + sell)) * 100 : NaN;
      return { longPct: longPct, t: Math.floor((+d.timestamp) / 1000) };
    }).filter(function(x){ return isFinite(x.longPct); }).sort(function(a,b){ return a.t - b.t; });
    if (!series.length) return null;
    return __byCachePut(key, { latest: series[series.length - 1], series: series });
  }catch(e){ return null; }
}

/* One-shot positioning snapshot for cross-check (same field names as smartScanSymbol). */
async function bybitPositioningSnapshot(symbol){
  try{
    if (!symbol) return null;
    var res = await Promise.all([
      bybitFunding(symbol),
      bybitOIHistory(symbol, 25),
      bybitAccountRatio(symbol, '1h', 2)
    ]);
    var fnd = res[0], oih = res[1], ar = res[2];
    if (!fnd && !oih && !ar) return null;
    return {
      venue: 'bybit',
      sym: symbol,
      fundingPct: fnd ? fnd.fundingPct : null,
      markPrice: fnd ? fnd.markPrice : null,
      oiChgPct: oih ? oih.oiChgPct : null,
      oiUsd: (oih && oih.latest) ? oih.latest.oiUsd : null,
      retailLongPct: (ar && ar.latest) ? ar.latest.longPct : null
    };
  }catch(e){ return null; }
}
