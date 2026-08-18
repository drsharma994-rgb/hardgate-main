/* =========================================================================
HARDGATE — binance.js
Binance USD-M futures (fapi.binance.com) public data layer.
CORS-open (Access-Control-Allow-Origin: *), no API key required.

Classic script: every top-level function below becomes a global.
Discipline:
  - never throw: every public function resolves null/[] on any failure
  - every fetch carries a 10s AbortController timeout
  - results cached 60s in-memory, keyed by fn+args, so scanners can
    re-poll without hammering the API
  - makeTokenBucket(ratePerSec, burst): generic client-side rate limiter,
    exported as a global (the extracted candles.js module builds its
    apiBucket from it). take() returns 0 when a token was consumed,
    else the ms to wait for the next token.

Candle rows everywhere in HARDGATE: {t:<unix seconds>, o,h,l,c,v},
sorted ascending by t — binanceKlines() normalizes to exactly that.
========================================================================= */
'use strict';

function makeTokenBucket(ratePerSec, burst){
  ratePerSec = Math.max(0.1, ratePerSec || 1);
  burst = Math.max(1, burst || 1);
  let tokens = burst, lastTs = Date.now();
  return {
    take: function(){
      const now = Date.now();
      tokens = Math.min(burst, tokens + (now - lastTs)/1000*ratePerSec);
      lastTs = now;
      if (tokens >= 1){ tokens -= 1; return 0; }
      return Math.ceil((1 - tokens)/ratePerSec*1000);
    }
  };
}

const BINANCE_FAPI = 'https://fapi.binance.com';
const BINANCE_SPOT = 'https://api.binance.com';
const __binBucket = makeTokenBucket(6, 6); // gentle smoothing; fapi allows far more
const __BIN_CACHE = new Map();
const BIN_CACHE_MS = 60*1000;

/* GEO-BLOCK FALLBACK.

   Binance answers HTTP 451 to browsers in several countries. This file used
   to fetch directly, get a 451, return null, and say nothing — so every
   Binance-dependent read went quietly dark: the regime gauges reported "every
   gauge source failed", and the perp gates printed "OI not published for this
   contract", which blames the venue for a block that has nothing to do with
   the contract.

   The app already ships a same-origin proxy, and the server it runs on is in
   Singapore where these hosts resolve normally. It simply was not in the
   proxy's allowlist and this file never tried it.

   Sticky, because the answer does not change within a session: once a direct
   call is refused, every later call goes straight to the proxy rather than
   paying for a doomed request first. __hgBinanceVia records which path is in
   use so the UI can say "geo-blocked, routed via proxy" instead of inventing
   a reason. */
const __BIN_VIA = { mode: 'unknown' };      /* unknown | direct | proxy | blocked */
function __binVia(){ return __BIN_VIA.mode; }
function __binProxied(url){ return '/api/proxy?url=' + encodeURIComponent(url); }

async function __binOneFetch(url, ctrl){
  const res = await fetch(url, { signal: ctrl.signal });
  if (res.status === 418 || res.status === 429){
    try{
      var root = (typeof globalThis !== 'undefined') ? globalThis : window;
      if (root && root.S) root.S.binanceBackoffUntil = Date.now() + 90000;
    }catch(e){}
    return { rateLimited: true };
  }
  if (!res.ok) return { status: res.status };
  return { json: await res.json() };
}

async function __binFetchJson(url, timeoutMs){
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 10000);
  try{
    const w = __binBucket.take();
    if (w > 0) await new Promise(function(r){ setTimeout(r, Math.min(w, 2000)); });

    /* Already known blocked: do not pay for the direct call again. */
    if (__BIN_VIA.mode !== 'proxy'){
      let direct = null;
      try { direct = await __binOneFetch(url, ctrl); }
      catch (e) { direct = { threw: true }; }
      if (direct && direct.rateLimited) return null;
      if (direct && direct.json !== undefined){
        if (__BIN_VIA.mode === 'unknown') __BIN_VIA.mode = 'direct';
        return direct.json;
      }
      /* 451 geo-block, 403, or a CORS/network throw — all mean "not from this
         browser", and all are worth one proxy attempt. */
    }

    let viaProxy = null;
    try { viaProxy = await __binOneFetch(__binProxied(url), ctrl); }
    catch (e) { viaProxy = { threw: true }; }
    if (viaProxy && viaProxy.json !== undefined){
      __BIN_VIA.mode = 'proxy';
      return viaProxy.json;
    }
    /* Neither path worked. Say so once rather than letting each caller invent
       an explanation. */
    if (__BIN_VIA.mode !== 'direct') __BIN_VIA.mode = 'blocked';
    return null;
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

function __binCacheGet(key){
  const h = __BIN_CACHE.get(key);
  return (h && (Date.now() - h.at) < BIN_CACHE_MS) ? h.val : undefined;
}
function __binCachePut(key, val){
  const bad = (val === null || val === undefined) || (Array.isArray(val) && val.length === 0);
  if (!bad) __BIN_CACHE.set(key, { at: Date.now(), val: val }); // only cache successes
  return val;
}

/* GET /fapi/v1/klines -> [{t(sec),o,h,l,c,v}] ascending */
async function binanceKlines(symbol, interval, limit){
  try{
    if (!symbol) return [];
    interval = interval || '1h';
    limit = Math.max(1, Math.min(1500, limit || 500));
    const key = 'klines|' + symbol + '|' + interval + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/fapi/v1/klines?symbol=' + encodeURIComponent(symbol) +
                '&interval=' + encodeURIComponent(interval) + '&limit=' + limit;
    const raw = await __binFetchJson(url);
    if (!Array.isArray(raw)) return [];
    const rows = raw.map(function(k){
      return { t: Math.floor((+k[0])/1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] };
    }).filter(function(r){
      return isFinite(r.t) && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c);
    }).sort(function(a,b){ return a.t - b.t; });
    return __binCachePut(key, rows);
  }catch(e){ return []; }
}

/* GET /fapi/v1/exchangeInfo -> USDT-margined PERPETUAL symbols with status TRADING */
async function binancePerpUniverse(){
  try{
    const key = 'universe';
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const j = await __binFetchJson(BINANCE_FAPI + '/fapi/v1/exchangeInfo');
    if (!j || !Array.isArray(j.symbols)) return [];
    const out = j.symbols.filter(function(s){
      return s && s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL' && s.status === 'TRADING';
    }).map(function(s){ return s.symbol; });
    return __binCachePut(key, out);
  }catch(e){ return []; }
}

/* GET /fapi/v1/ticker/24hr -> map symbol -> {symbol, mark, chg24, turnoverUsd} */
async function binanceTickers24h(){
  try{
    const key = 'tickers24h';
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const raw = await __binFetchJson(BINANCE_FAPI + '/fapi/v1/ticker/24hr');
    if (!Array.isArray(raw)) return null;
    const map = {};
    for (let i = 0; i < raw.length; i++){
      const d = raw[i];
      if (!d || !d.symbol) continue;
      map[d.symbol] = {
        symbol: d.symbol,
        mark: +d.lastPrice,
        chg24: +d.priceChangePercent,
        turnoverUsd: +d.quoteVolume
      };
    }
    return __binCachePut(key, map);
  }catch(e){ return null; }
}

/* GET /fapi/v1/premiumIndex -> {fundingPct (percent units), markPrice, nextFundingTime} */
async function binanceFunding(symbol){
  try{
    if (!symbol) return null;
    const key = 'funding|' + symbol;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const j = await __binFetchJson(BINANCE_FAPI + '/fapi/v1/premiumIndex?symbol=' + encodeURIComponent(symbol));
    if (!j || j.lastFundingRate === undefined) return null;
    return __binCachePut(key, {
      fundingPct: (+j.lastFundingRate)*100, // decimal rate -> percent units (0.00002095 -> 0.002095)
      markPrice: +j.markPrice,
      nextFundingTime: +j.nextFundingTime // ms epoch
    });
  }catch(e){ return null; }
}

/* GET /fapi/v1/openInterest (+ premiumIndex mark) -> {oiContracts, oiUsd} */
async function binanceOI(symbol){
  try{
    if (!symbol) return null;
    const key = 'oi|' + symbol;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const j = await __binFetchJson(BINANCE_FAPI + '/fapi/v1/openInterest?symbol=' + encodeURIComponent(symbol));
    if (!j || j.openInterest === undefined) return null;
    const oiContracts = +j.openInterest;
    let oiUsd = null;
    const p = await __binFetchJson(BINANCE_FAPI + '/fapi/v1/premiumIndex?symbol=' + encodeURIComponent(symbol));
    if (p && isFinite(+p.markPrice)) oiUsd = oiContracts * (+p.markPrice);
    return __binCachePut(key, { oiContracts: oiContracts, oiUsd: oiUsd });
  }catch(e){ return null; }
}

/* Shared parser for the /futures/data long-short family */
function __binParseLS(raw, tsKey){
  if (!Array.isArray(raw)) return null;
  const series = raw.map(function(d){
    const longPct = (+d.longAccount)*100, shortPct = (+d.shortAccount)*100;
    return {
      longPct: longPct,
      shortPct: shortPct,
      ratio: +d.longShortRatio,
      t: Math.floor((+d[tsKey || 'timestamp'])/1000)
    };
  }).filter(function(r){ return isFinite(r.t); })
    .sort(function(a,b){ return a.t - b.t; });
  if (!series.length) return null;
  return { latest: series[series.length - 1], series: series };
}

/* GET /futures/data/globalLongShortAccountRatio -> {latest, series} of {longPct, shortPct, ratio, t} */
async function binanceLongShort(symbol, period, limit){
  try{
    if (!symbol) return null;
    period = period || '1h'; limit = Math.max(1, Math.min(500, limit || 30));
    const key = 'ls|' + symbol + '|' + period + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/futures/data/globalLongShortAccountRatio?symbol=' + encodeURIComponent(symbol) +
                '&period=' + encodeURIComponent(period) + '&limit=' + limit;
    return __binCachePut(key, __binParseLS(await __binFetchJson(url)));
  }catch(e){ return null; }
}

/* GET /futures/data/topLongShortPositionRatio (top trader positions) -> same shape as binanceLongShort */
async function binanceTopTraders(symbol, period, limit){
  try{
    if (!symbol) return null;
    period = period || '1h'; limit = Math.max(1, Math.min(500, limit || 30));
    const key = 'top|' + symbol + '|' + period + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/futures/data/topLongShortPositionRatio?symbol=' + encodeURIComponent(symbol) +
                '&period=' + encodeURIComponent(period) + '&limit=' + limit;
    return __binCachePut(key, __binParseLS(await __binFetchJson(url)));
  }catch(e){ return null; }
}

/* GET /futures/data/takerlongshortRatio -> {latest, series} of {buySellRatio, t} */
async function binanceTakerRatio(symbol, period, limit){
  try{
    if (!symbol) return null;
    period = period || '1h'; limit = Math.max(1, Math.min(500, limit || 30));
    const key = 'taker|' + symbol + '|' + period + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/futures/data/takerlongshortRatio?symbol=' + encodeURIComponent(symbol) +
                '&period=' + encodeURIComponent(period) + '&limit=' + limit;
    const raw = await __binFetchJson(url);
    if (!Array.isArray(raw)) return null;
    const series = raw.map(function(d){
      return { buySellRatio: +d.buySellRatio, t: Math.floor((+d.timestamp)/1000) };
    }).filter(function(r){ return isFinite(r.t); })
      .sort(function(a,b){ return a.t - b.t; });
    if (!series.length) return null;
    return __binCachePut(key, { latest: series[series.length - 1], series: series });
  }catch(e){ return null; }
}

/* GET /fapi/v1/fundingInfo -> map symbol -> {intervalHours, capPct, floorPct}.
   Binance perps do NOT all settle funding 3x/day: fundingIntervalHours is
   per-symbol (1h/4h/8h live), so APR must annualize with
   (24/intervalHours)*365 — a hardcoded 3*365 is wrong on every non-8h perp.
   capPct/floorPct are the adjusted funding rate cap/floor in PERCENT units
   (wire decimals 0.02/-0.02 -> 2/-2). Symbols with a missing/invalid
   fundingIntervalHours are omitted entirely, so callers can tell "unknown
   interval" apart from a verified 8h and label it '(assumed 8h)'.
   Exchange metadata moves slowly -> cached 10 min, not the default 60s. */
const FUNDING_INFO_CACHE_MS = 10*60*1000;
async function binanceFundingInfo(){
  try{
    const key = 'fundingInfo';
    const h = __BIN_CACHE.get(key);
    if (h && (Date.now() - h.at) < FUNDING_INFO_CACHE_MS) return h.val;
    const raw = await __binFetchJson(BINANCE_FAPI + '/fapi/v1/fundingInfo');
    if (!Array.isArray(raw)) return null;
    const map = {};
    for (let i = 0; i < raw.length; i++){
      const d = raw[i];
      if (!d || !d.symbol) continue;
      const hrs = +d.fundingIntervalHours;
      if (!isFinite(hrs) || hrs <= 0) continue; // unknown interval -> omit (caller assumes 8h)
      map[d.symbol] = {
        intervalHours: hrs,
        capPct: (+d.adjustedFundingRateCap)*100,   // decimal -> percent units
        floorPct: (+d.adjustedFundingRateFloor)*100
      };
    }
    return __binCachePut(key, map);
  }catch(e){ return null; }
}

/* GET /futures/data/topLongShortAccountRatio (top trader ACCOUNTS, distinct
   from topLongShortPositionRatio used by binanceTopTraders) -> same parsed
   shape as binanceLongShort: {latest, series} of {longPct, shortPct, ratio, t} */
async function binanceTopLSAccounts(symbol, period, limit){
  try{
    if (!symbol) return null;
    period = period || '1h'; limit = Math.max(1, Math.min(500, limit || 30));
    const key = 'topacct|' + symbol + '|' + period + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/futures/data/topLongShortAccountRatio?symbol=' + encodeURIComponent(symbol) +
                '&period=' + encodeURIComponent(period) + '&limit=' + limit;
    return __binCachePut(key, __binParseLS(await __binFetchJson(url)));
  }catch(e){ return null; }
}

/* GET /futures/data/basis?pair=..&contractType=.. -> {latest, series} of
   {annualizedBasisPct, basisRatePct, basis, futuresPrice, indexPrice, t}.
   Data layer for a future term-structure tab. Wire basisRate/annualizedBasisRate
   are decimal fractions (0.0377 = 3.77%/yr) -> converted to PERCENT units here,
   same convention as binanceFunding. basis itself is quote-ccy (futures - index).
   contractType: CURRENT_QUARTER | NEXT_QUARTER | PERPETUAL. */
async function binanceBasis(pair, contractType, period, limit){
  try{
    pair = pair || 'BTCUSDT';
    contractType = contractType || 'CURRENT_QUARTER';
    period = period || '1h'; limit = Math.max(1, Math.min(500, limit || 1));
    const key = 'basis|' + pair + '|' + contractType + '|' + period + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/futures/data/basis?pair=' + encodeURIComponent(pair) +
                '&contractType=' + encodeURIComponent(contractType) +
                '&period=' + encodeURIComponent(period) + '&limit=' + limit;
    const raw = await __binFetchJson(url);
    if (!Array.isArray(raw)) return null;
    const series = raw.map(function(d){
      return {
        annualizedBasisPct: (+d.annualizedBasisRate)*100, // decimal -> percent units
        basisRatePct: (+d.basisRate)*100,
        basis: +d.basis,
        futuresPrice: +d.futuresPrice,
        indexPrice: +d.indexPrice,
        t: Math.floor((+d.timestamp)/1000)
      };
    }).filter(function(r){ return isFinite(r.t); })
      .sort(function(a,b){ return a.t - b.t; });
    if (!series.length) return null;
    return __binCachePut(key, { latest: series[series.length - 1], series: series });
  }catch(e){ return null; }
}

/* GET /futures/data/openInterestHist -> {latest, series} of {oi, oiUsd, t} */
async function binanceOIHistory(symbol, period, limit){
  try{
    if (!symbol) return null;
    period = period || '1h'; limit = Math.max(1, Math.min(500, limit || 30));
    const key = 'oih|' + symbol + '|' + period + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/futures/data/openInterestHist?symbol=' + encodeURIComponent(symbol) +
                '&period=' + encodeURIComponent(period) + '&limit=' + limit;
    const raw = await __binFetchJson(url);
    if (!Array.isArray(raw)) return null;
    const series = raw.map(function(d){
      return {
        oi: +d.sumOpenInterest,
        oiUsd: (d.sumOpenInterestValue !== undefined) ? +d.sumOpenInterestValue : null,
        t: Math.floor((+d.timestamp)/1000)
      };
    }).filter(function(r){ return isFinite(r.t) && isFinite(r.oi); })
      .sort(function(a,b){ return a.t - b.t; });
    if (!series.length) return null;
    return __binCachePut(key, { latest: series[series.length - 1], series: series });
  }catch(e){ return null; }
}

/* GET /fapi/v1/fundingRate?symbol&limit -> [{rate, t}] ascending — the symbol's
   OWN funding history (3 prints/day), free, for z-score reads. null on any
   failure; 60s cached like the rest of the layer. */
async function binanceFundingHist(symbol, limit){
  try{
    if (!symbol) return null;
    limit = Math.max(10, Math.min(1000, limit || 100));
    const key = 'fundhist|' + symbol + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/fapi/v1/fundingRate?symbol=' + encodeURIComponent(symbol) + '&limit=' + limit;
    const raw = await __binFetchJson(url);
    if (!Array.isArray(raw) || raw.length < 10) return null;
    const rows = raw.map(function(d){
      return { rate: +d.fundingRate, t: Math.floor((+d.fundingTime)/1000) };
    }).filter(function(r){ return isFinite(r.rate) && isFinite(r.t); })
      .sort(function(a,b){ return a.t - b.t; });
    if (rows.length < 10) return null;
    return __binCachePut(key, rows);
  }catch(e){ return null; }
}

/* GET /api/v3/klines -> spot taker buy/sell proxy from taker-buy-base volume.
   Same {latest, series:[{buySellRatio,t}]} shape as binanceTakerRatio for
   spot-perp divergence reads. null on failure; 60s cached. */
async function binanceSpotTakerFlow(symbol, interval, limit){
  try{
    if (!symbol) return null;
    interval = interval || '1h';
    limit = Math.max(8, Math.min(500, limit || 25));
    const key = 'spotTaker|' + symbol + '|' + interval + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_SPOT + '/api/v3/klines?symbol=' + encodeURIComponent(symbol)
      + '&interval=' + encodeURIComponent(interval) + '&limit=' + limit;
    const raw = await __binFetchJson(url);
    if (!Array.isArray(raw) || raw.length < 8) return null;
    const series = raw.map(function(d){
      const vol = +d[5], takerBuy = +d[9];
      const sell = vol - takerBuy;
      const ratio = (isFinite(takerBuy) && isFinite(sell) && sell > 0) ? (takerBuy / sell) : NaN;
      return { buySellRatio: ratio, t: Math.floor((+d[0]) / 1000) };
    }).filter(function(r){ return isFinite(r.t) && isFinite(r.buySellRatio) && r.buySellRatio > 0; })
      .sort(function(a,b){ return a.t - b.t; });
    if (series.length < 8) return null;
    return __binCachePut(key, { latest: series[series.length - 1], series: series });
  }catch(e){ return null; }
}

/* GET /fapi/v1/depth?symbol&limit=20 -> {bidUsd, askUsd} top-of-book totals —
   order-book imbalance reads (proxy context for the same asset elsewhere).
   null on any failure; 60s cached. */
async function binanceDepth(symbol, limit){
  try{
    if (!symbol) return null;
    limit = Math.max(5, Math.min(100, limit || 20));
    const key = 'depth|' + symbol + '|' + limit;
    const hit = __binCacheGet(key); if (hit !== undefined) return hit;
    const url = BINANCE_FAPI + '/fapi/v1/depth?symbol=' + encodeURIComponent(symbol) + '&limit=' + limit;
    const j = await __binFetchJson(url);
    if (!j || !Array.isArray(j.bids) || !Array.isArray(j.asks)) return null;
    const tot = function(side){
      let usd = 0;
      for (let i = 0; i < side.length; i++){
        const p = +side[i][0], q = +side[i][1];
        if (isFinite(p) && isFinite(q)) usd += p * q;
      }
      return usd;
    };
    const out = { bidUsd: tot(j.bids), askUsd: tot(j.asks) };
    if (!(out.bidUsd >= 0) || !(out.askUsd >= 0)) return null;
    return __binCachePut(key, out);
  }catch(e){ return null; }
}

/* Which path Binance data is coming in on, for the UI to state plainly rather
   than each gate inventing its own explanation for a null.
     'direct'  — the browser can reach Binance
     'proxy'   — the browser cannot (geo-block), the same-origin proxy can
     'blocked' — neither worked; the data genuinely is not available
     'unknown' — nothing has been fetched yet this session */
(function(){
  var root = (typeof globalThis !== 'undefined') ? globalThis : window;
  root.hgBinanceVia = __binVia;
})();
