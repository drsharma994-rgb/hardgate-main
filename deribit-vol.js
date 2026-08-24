/* =========================================================================
HARDGATE — deribit-vol.js
Deribit public DVOL (volatility index) + option put/call flow — no API key.
BTC/ETH implied-vol regime and call-vs-put volume for setup evidence.
Never throws; caches 5m. Never prints ENTRY / STOP / T1.
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

/* ---- option flow (public put/call volume + OI) ---------------------
   Deribit book summary, no API key. Classifies call-heavy vs put-heavy.
   Never prints ENTRY / STOP / T1. Silent book → null. */

var __ofSnap = null;

function deribitOptionNameSide(name){
  var s = String(name || '');
  if (/-C$/i.test(s) || /-CALL$/i.test(s)) return 'C';
  if (/-P$/i.test(s) || /-PUT$/i.test(s)) return 'P';
  return '';
}

function deribitOptionFlowClassify(input){
  try{
    if (!input || typeof input !== 'object') return null;
    var cv = +input.callVol, pv = +input.putVol;
    var co = +input.callOi, po = +input.putOi;
    if (!isFinite(cv) || cv < 0) cv = 0;
    if (!isFinite(pv) || pv < 0) pv = 0;
    if (cv + pv <= 0) return null;
    var pc = pv / Math.max(cv, 1e-12);
    var bias = 'neutral';
    if (pc >= 1.4) bias = 'bearish';
    else if (pc <= 0.7) bias = 'bullish';
    var out = { bias: bias, putCallVol: pc, callVol: cv, putVol: pv };
    if (isFinite(co) && co >= 0) out.callOi = co;
    if (isFinite(po) && po >= 0) out.putOi = po;
    return out;
  }catch(e){ return null; }
}

async function deribitOptionFlowSnapshot(currency){
  try{
    currency = (currency || 'BTC').toUpperCase();
    if (currency !== 'BTC' && currency !== 'ETH') currency = 'BTC';
    var key = 'optflow|' + currency;
    var hit = __dvCacheGet(key);
    if (hit !== undefined) return hit;

    var r = await __dvFetchJson('/get_book_summary_by_currency?currency='
      + encodeURIComponent(currency) + '&kind=option');
    if (!Array.isArray(r) || !r.length) return null;

    var callVol = 0, putVol = 0, callOi = 0, putOi = 0, n = 0, i, row, side, vol, oi;
    for (i = 0; i < r.length; i++){
      row = r[i];
      if (!row) continue;
      side = deribitOptionNameSide(row.instrument_name);
      if (!side) continue;
      vol = +row.volume; if (!isFinite(vol) || vol < 0) vol = 0;
      oi = +row.open_interest; if (!isFinite(oi) || oi < 0) oi = 0;
      if (side === 'C'){ callVol += vol; callOi += oi; }
      else { putVol += vol; putOi += oi; }
      n++;
    }
    if (!n) return null;
    var cls = deribitOptionFlowClassify({
      callVol: callVol, putVol: putVol, callOi: callOi, putOi: putOi
    });
    if (!cls) return null;
    cls.currency = currency;
    cls.at = Date.now();
    cls.n = n;
    __ofSnap = cls;
    return __dvCachePut(key, cls);
  }catch(e){ return null; }
}

function deribitOptionFlowState(){
  try{
    if (!__ofSnap) return null;
    return Object.freeze({
      currency: __ofSnap.currency,
      bias: __ofSnap.bias,
      putCallVol: __ofSnap.putCallVol,
      callVol: __ofSnap.callVol,
      putVol: __ofSnap.putVol,
      callOi: __ofSnap.callOi,
      putOi: __ofSnap.putOi,
      n: __ofSnap.n,
      at: __ofSnap.at
    });
  }catch(e){ return null; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.deribitVolSnapshot = deribitVolSnapshot;
W.deribitVolState = deribitVolState;
W.deribitVolClassify = deribitVolClassify;
W.deribitVolWarm = deribitVolWarm;
W.deribitOptionFlowClassify = deribitOptionFlowClassify;
W.deribitOptionFlowSnapshot = deribitOptionFlowSnapshot;
W.deribitOptionFlowState = deribitOptionFlowState;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'dvol', label: 'DVOL', run: deribitVolWarm });
