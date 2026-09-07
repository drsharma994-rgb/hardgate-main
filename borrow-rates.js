/* =========================================================================
HARDGATE — borrow-rates.js
Spot borrow rates: Binance margin + DeFiLlama lend/borrow.
Never throws; 10m cache. Exposes window.borrowRateForBase / borrowRatesWarm.
========================================================================= */
'use strict';

var __brCache = new Map();
var BR_CACHE_MS = 10 * 60 * 1000;

function __brGet(key){
  var h = __brCache.get(key);
  return (h && (Date.now() - h.at) < BR_CACHE_MS) ? h.val : undefined;
}
function __brPut(key, val){
  if (val !== null && val !== undefined) __brCache.set(key, { at: Date.now(), val: val });
  return val;
}

async function __fetchJson(url, timeoutMs){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 12000);
  try{
    var res = null;
    try { res = await fetch(url, { signal: ctrl.signal }); } catch (e) { res = null; }
    if (res && res.ok) return await res.json();
    var prox = await fetch('/api/proxy?url=' + encodeURIComponent(url), { signal: ctrl.signal });
    if (prox && prox.ok) return await prox.json();
    return null;
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

/** Binance cross-margin daily interest → APR %. */
async function borrowBinanceRate(base){
  try{
    base = String(base || '').toUpperCase();
    var key = 'bin|' + base;
    var hit = __brGet(key);
    if (hit !== undefined) return hit;
    var url = 'https://api.binance.com/sapi/v1/margin/interestRateHistory?asset='
      + encodeURIComponent(base) + '&vipLevel=0&limit=1';
    var j = await __fetchJson(url);
    if (!Array.isArray(j) || !j.length || !j[0]) return null;
    var daily = +j[0].dailyInterestRate;
    if (!isFinite(daily)) return null;
    var aprPct = daily * 365 * 100;
    var out = { base: base, aprPct: aprPct, dailyRate: daily, source: 'binance-margin' };
    return __brPut(key, out);
  }catch(e){ return null; }
}

/** DeFiLlama pooled borrow APR for major assets (Aave v3 eth pool proxy). */
async function borrowDefiLlamaRates(){
  try{
    var key = 'dl';
    var hit = __brGet(key);
    if (hit !== undefined) return hit;
    var j = await __fetchJson('https://yields.llama.fi/pools');
    if (!j || !Array.isArray(j.data)) return null;
    var out = {};
    for (var i = 0; i < j.data.length; i++){
      var p = j.data[i];
      if (!p || !p.symbol) continue;
      var sym = String(p.symbol).toUpperCase();
      var borrow = +p.apyBorrow;
      if (!isFinite(borrow) || borrow <= 0) continue;
      if (/^(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|AVAX|LINK|DOT)$/.test(sym)){
        if (!out[sym] || borrow > out[sym].aprPct){
          out[sym] = { base: sym, aprPct: borrow, source: 'defillama-' + (p.project || 'pool') };
        }
      }
    }
    return __brPut(key, out);
  }catch(e){ return null; }
}

async function borrowRateForBase(base){
  try{
    base = String(base || '').toUpperCase().replace(/USDT$/, '');
    var key = 'best|' + base;
    var hit = __brGet(key);
    if (hit !== undefined) return hit;
    var bin = await borrowBinanceRate(base);
    var dl = await borrowDefiLlamaRates();
    var aave = dl ? dl[base] : null;
    var apr = null, source = null;
    if (bin && isFinite(bin.aprPct)) { apr = bin.aprPct; source = bin.source; }
    if (aave && isFinite(aave.aprPct)){
      if (apr === null || aave.aprPct > apr){ apr = aave.aprPct; source = aave.source; }
    }
    if (apr === null) return null;
    var out = { base: base, aprPct: apr, source: source, binance: bin, defi: aave };
    return __brPut(key, out);
  }catch(e){ return null; }
}

async function borrowRatesWarm(){
  try{
    var b = await borrowRateForBase('BTC');
    return b ? ('BTC borrow ~' + b.aprPct.toFixed(1) + '% APR') : 'borrow dark';
  }catch(e){ return 'borrow error'; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.borrowBinanceRate = borrowBinanceRate;
W.borrowRateForBase = borrowRateForBase;
W.borrowRatesWarm = borrowRatesWarm;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'borrow', label: 'BORROW', run: borrowRatesWarm });
