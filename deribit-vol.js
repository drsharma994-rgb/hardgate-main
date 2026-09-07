/* =========================================================================
HARDGATE — deribit-vol.js
Deribit public DVOL + 25Δ risk reversal + gamma flip levels.
BTC/ETH implied-vol regime for REGIME / SMART $ / TRADE PLAN. Never throws.
========================================================================= */
'use strict';

var DERIBIT_API = 'https://www.deribit.com/api/v2/public';
var __DV_CACHE = new Map();
var DV_CACHE_MS = 5 * 60 * 1000;
var __dvSnap = null;
var __optSnap = null;

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

/** Options chain snapshot: 25Δ RR + gamma-by-strike. */
async function deribitOptionsSnapshot(currency){
  try{
    currency = (currency || 'BTC').toUpperCase();
    var key = 'opt|' + currency;
    var hit = __dvCacheGet(key);
    if (hit !== undefined) return hit;

    var dvol = await deribitVolSnapshot(currency);
    var idx = await __dvFetchJson('/get_index_price?index_name=' + encodeURIComponent(currency.toLowerCase() + '_usd'));
    var spot = idx && isFinite(+idx.index_price) ? +idx.index_price : null;
    var books = await __dvFetchJson('/get_book_summary_by_currency?currency=' + encodeURIComponent(currency) + '&kind=option');
    if (!Array.isArray(books) || !books.length) return null;

    var bestCall = null, bestPut = null, gammaByStrike = {};
    for (var i = 0; i < books.length; i++){
      var b = books[i];
      if (!b || !b.instrument_name) continue;
      var name = String(b.instrument_name);
      var isCall = name.indexOf('-C') >= 0 || name.endsWith('C');
      var isPut = name.indexOf('-P') >= 0 || name.endsWith('P');
      var iv = isFinite(+b.mark_iv) ? +b.mark_iv : null;
      var delta = isFinite(+b.delta) ? Math.abs(+b.delta) : null;
      var strike = isFinite(+b.underlying_price) ? null : (function(){
        var parts = name.split('-');
        return parts.length >= 3 ? +parts[2] : NaN;
      })();
      if (!isFinite(strike)){
        var m = name.match(/-(\d+(?:\.\d+)?)-[CP]$/);
        strike = m ? +m[1] : NaN;
      }
      var oi = isFinite(+b.open_interest) ? +b.open_interest : 0;
      if (isFinite(strike)){
        gammaByStrike[strike] = (gammaByStrike[strike] || 0) + (isCall ? oi : -oi);
      }
      if (iv !== null && delta !== null && delta >= 0.2 && delta <= 0.35){
        if (isCall && (!bestCall || Math.abs(delta - 0.25) < Math.abs(bestCall.delta - 0.25))){
          bestCall = { iv: iv, delta: delta, strike: strike };
        }
        if (isPut && (!bestPut || Math.abs(delta - 0.25) < Math.abs(bestPut.delta - 0.25))){
          bestPut = { iv: iv, delta: delta, strike: strike };
        }
      }
    }

    var rr = null;
    if (typeof deribitRiskReversal === 'function' && bestCall && bestPut){
      rr = deribitRiskReversal(bestCall.iv, bestPut.iv);
    } else if (bestCall && bestPut){
      rr = { rr25d: bestCall.iv - bestPut.iv, callIv: bestCall.iv, putIv: bestPut.iv };
    }

    var gamma = null;
    if (typeof deribitGammaFlip === 'function'){
      gamma = deribitGammaFlip(gammaByStrike, spot);
    }

    var slope = (typeof deribitDvolSlope === 'function' && dvol)
      ? deribitDvolSlope(dvol.dvol, dvol.dvolPrev)
      : null;

    var out = {
      currency: currency,
      spot: spot,
      dvol: dvol,
      rr25d: rr,
      gammaFlip: gamma,
      dvolSlope: slope,
      at: Date.now(),
    };
    __optSnap = out;
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

function deribitOptionsState(){
  try{
    if (!__optSnap) return null;
    return Object.freeze({
      currency: __optSnap.currency,
      spot: __optSnap.spot,
      rr25d: __optSnap.rr25d,
      gammaFlip: __optSnap.gammaFlip,
      dvolSlope: __optSnap.dvolSlope,
      at: __optSnap.at,
    });
  }catch(e){ return null; }
}

async function deribitVolWarm(){
  try{
    var s = await deribitOptionsSnapshot('BTC');
    if (!s || !s.dvol) return 'dvol dark';
    var line = 'dvol ' + s.dvol.dvol.toFixed(1);
    if (s.rr25d && isFinite(s.rr25d.rr25d)) line += ' · 25Δ RR ' + s.rr25d.rr25d.toFixed(1);
    return line;
  }catch(e){ return 'dvol error'; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.deribitVolSnapshot = deribitVolSnapshot;
W.deribitVolState = deribitVolState;
W.deribitVolClassify = deribitVolClassify;
W.deribitOptionsSnapshot = deribitOptionsSnapshot;
W.deribitOptionsState = deribitOptionsState;
W.deribitVolWarm = deribitVolWarm;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'dvol', label: 'DVOL', run: deribitVolWarm });
