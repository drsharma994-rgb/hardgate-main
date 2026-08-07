/* =========================================================================
HARDGATE — deribit-vol.js
Deribit public DVOL (volatility index) — no API key.
BTC/ETH implied-vol regime for BRAIN context votes. Never throws; caches 5m.
========================================================================= */
'use strict';

var DERIBIT_API = 'https://www.deribit.com/api/v2/public';
var __DV_CACHE = new Map();
var DV_CACHE_MS = 5 * 60 * 1000;
var __dvSnap = null;

async function __dvFetchJson(path, timeoutMs){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 12000);
  try{
    if (typeof fetch !== 'function') return null;
    var res = await fetch(DERIBIT_API + path, { signal: ctrl.signal });
    if (!res.ok) return null;
    var j = await res.json();
    if (!j || j.error) return null;
    return j.result;
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

function __dvCacheGet(key){
  var h = __DV_CACHE.get(key);
  return (h && (Date.now() - h.at) < DV_CACHE_MS) ? h.val : undefined;
}
function __dvCachePut(key, val){
  if (val !== null && val !== undefined) __DV_CACHE.set(key, { at: Date.now(), val: val });
  return val;
}

/** Classify DVOL level — pure, never throws. */
function deribitVolClassify(dvol){
  try{
    var v = +dvol;
    if (!isFinite(v) || v <= 0) return null;
    if (v >= 85) return 'extreme';
    if (v >= 65) return 'high';
    if (v <= 40) return 'low';
    return 'normal';
  }catch(e){ return null; }
}

/** Fetch latest DVOL + prior print for BTC or ETH. */
async function deribitVolSnapshot(currency){
  try{
    currency = (currency || 'BTC').toUpperCase();
    if (currency !== 'BTC' && currency !== 'ETH') currency = 'BTC';
    var key = 'dvol|' + currency;
    var hit = __dvCacheGet(key);
    if (hit !== undefined) return hit;

    var now = Date.now();
    var start = now - 48 * 3600 * 1000;
    var path = '/get_volatility_index_data?currency=' + encodeURIComponent(currency)
      + '&start_timestamp=' + start + '&end_timestamp=' + now + '&resolution=3600';
    var r = await __dvFetchJson(path);
    if (!r || !Array.isArray(r.data) || !r.data.length) return null;

    var data = r.data.slice().sort(function(a, b){ return a[0] - b[0]; });
    var last = data[data.length - 1];
    var prev = data.length >= 2 ? data[data.length - 2] : null;
    var dvol = isFinite(+last[4]) ? +last[4] : (isFinite(+last[1]) ? +last[1] : NaN);
    var dvolPrev = prev ? (isFinite(+prev[4]) ? +prev[4] : +prev[1]) : null;
    if (!isFinite(dvol)) return null;

    var out = {
      currency: currency,
      dvol: dvol,
      dvolPrev: isFinite(+dvolPrev) ? +dvolPrev : null,
      regime: deribitVolClassify(dvol),
      at: Date.now()
    };
    __dvSnap = out;
    return __dvCachePut(key, out);
  }catch(e){ return null; }
}

/** BRAIN-readable frozen snapshot (BTC primary). */
function deribitVolState(){
  try{
    if (!__dvSnap) return null;
    return Object.freeze({
      currency: __dvSnap.currency,
      dvol: __dvSnap.dvol,
      dvolPrev: __dvSnap.dvolPrev,
      regime: __dvSnap.regime,
      at: __dvSnap.at
    });
  }catch(e){ return null; }
}

async function deribitVolWarm(){
  try{
    var s = await deribitVolSnapshot('BTC');
    return s ? ('dvol ' + s.dvol.toFixed(1) + ' (' + s.regime + ')') : 'dvol dark';
  }catch(e){ return 'dvol error'; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.deribitVolSnapshot = deribitVolSnapshot;
W.deribitVolState = deribitVolState;
W.deribitVolClassify = deribitVolClassify;
W.deribitVolWarm = deribitVolWarm;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'dvol', label: 'DVOL', run: deribitVolWarm });
