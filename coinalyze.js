/* =========================================================================
HARDGATE — coinalyze.js
Aggregated cross-venue OI via /api/coinalyze (Coinalyze free tier).
Never throws; 5m cache. Exposes window.coinalyzeAggOI / coinalyzeOIHistory.
========================================================================= */
'use strict';

var __czCache = new Map();
var CZ_CACHE_MS = 5 * 60 * 1000;

function __czGet(key){
  var h = __czCache.get(key);
  return (h && (Date.now() - h.at) < CZ_CACHE_MS) ? h.val : undefined;
}
function __czPut(key, val){
  if (val !== null && val !== undefined) __czCache.set(key, { at: Date.now(), val: val });
  return val;
}

function __base(sym){
  sym = String(sym || '').toUpperCase();
  return sym.replace(/USDT$/, '');
}

function __czSymbols(base){
  if (typeof window !== 'undefined' && typeof window.coinalyzeSymbolsForBase === 'function'){
    return window.coinalyzeSymbolsForBase(base);
  }
  var sym = base + 'USDT_PERP';
  return [sym + '.A', sym + '.6', sym + '.3', sym + '.2', sym + '.4'];
}

async function __czFetch(path, params){
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
    var res = await fetch('/api/coinalyze?' + qs);
    if (!res.ok) return null;
    var j = await res.json();
    return j && j.data !== undefined ? j.data : null;
  }catch(e){ return null; }
}

function __czMerge(rows){
  if (typeof window !== 'undefined' && typeof window.coinalyzeMergeOI === 'function'){
    return window.coinalyzeMergeOI(rows);
  }
  rows = Array.isArray(rows) ? rows : [];
  var agg = 0, bin = null;
  for (var i = 0; i < rows.length; i++){
    var v = +((rows[i] && rows[i].value) || NaN);
    if (!isFinite(v) || v <= 0) continue;
    agg += v;
    var s = String(rows[i].symbol || '');
    if (s.indexOf('.A') >= 0) bin = v;
  }
  if (!(agg > 0)) return null;
  return { aggOIUsd: agg, binanceOIUsd: bin, venues: rows.length };
}

/** Current aggregated OI snapshot for a USDT perp symbol. */
async function coinalyzeAggOI(sym){
  try{
    sym = String(sym || '').toUpperCase();
    var key = 'oi|' + sym;
    var hit = __czGet(key);
    if (hit !== undefined) return hit;
    var base = __base(sym);
    var symbols = __czSymbols(base).join(',');
    var rows = await __czFetch('open-interest', { symbols: symbols, convert_to_usd: 'true' });
    if (!Array.isArray(rows)) return null;
    var merged = __czMerge(rows);
    if (!merged) return null;
    var out = {
      sym: sym,
      aggOIUsd: merged.aggOIUsd,
      binanceOIUsd: merged.binanceOIUsd,
      venues: merged.venues,
      binanceSharePct: merged.binanceOIUsd ? (merged.binanceOIUsd / merged.aggOIUsd * 100) : null,
      at: Date.now(),
    };
    return __czPut(key, out);
  }catch(e){ return null; }
}

/** 24h aggregated OI % change. */
async function coinalyzeOIChg(sym, hours){
  try{
    hours = (isFinite(+hours) && +hours > 0) ? +hours : 24;
    sym = String(sym || '').toUpperCase();
    var key = 'oichg|' + sym + '|' + hours;
    var hit = __czGet(key);
    if (hit !== undefined) return hit;
    var base = __base(sym);
    var symbols = __czSymbols(base);
    var now = Math.floor(Date.now() / 1000);
    var from = now - hours * 3600;
    var histories = {};
    await Promise.all(symbols.map(async function(s){
      var data = await __czFetch('open-interest-history', {
        symbols: s,
        interval: '1hour',
        from: String(from),
        to: String(now),
        convert_to_usd: 'true',
      });
      if (!Array.isArray(data) || !data.length || !data[0] || !Array.isArray(data[0].history)) return;
      var hist = [];
      for (var i = 0; i < data[0].history.length; i++){
        var p = data[0].history[i];
        if (p && isFinite(p.t) && isFinite(p.c)) hist.push({ t: p.t, v: p.c });
      }
      histories[s] = hist;
    }));
    var chg = null;
    if (typeof window !== 'undefined' && typeof window.coinalyzeOIChgPct === 'function'){
      chg = window.coinalyzeOIChgPct(histories);
    }
    if (!chg) return null;
    var out = { sym: sym, chgPct: chg.chgPct, hours: hours, at: Date.now() };
    return __czPut(key, out);
  }catch(e){ return null; }
}

async function coinalyzeWarm(){
  try{
    var s = await coinalyzeAggOI('BTCUSDT');
    return s ? ('agg OI $' + (s.aggOIUsd / 1e9).toFixed(2) + 'B') : 'coinalyze dark';
  }catch(e){ return 'coinalyze error'; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.coinalyzeAggOI = coinalyzeAggOI;
W.coinalyzeOIChg = coinalyzeOIChg;
W.coinalyzeWarm = coinalyzeWarm;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'coinalyze', label: 'AGG OI', run: coinalyzeWarm });
