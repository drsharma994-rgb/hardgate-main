/* HARDGATE — xuniverse.js unit tests (Node 18+, builtins only).
   Loads xuniverse.js as a classic script inside a vm context with a
   `window` stub (exactly like the browser's <script> globals) and asserts:
     1) xuNormDelta / xuNormCdcx payload normalization with the REAL field
        names from index.html (mark_price, funding_rate percent units,
        turnover_usd/turnover fallback, B-XXX_USDT symbol format)
     2) xuMerge cross-exchange dedupe by base asset, turnover precedence,
        alsoOn tagging, unknown-turnover delta preference, nothing dropped
     3) xuUniverse end-to-end with stubbed fetch: direct Delta URL,
        /api/proxy-wrapped CoinDCX URL, 15-min cache + force bypass,
        per-leg allSettled degradation, total-outage honesty, busy-guard
     4) xuCandles routing per exchange incl. proxy URL construction,
        resolution maps, ms->s time conversion, failure tolerance
     4b) xuCandles Binance fallback: venue failure/thin rows -> base's
        USDT-perp klines, contract intact, perp-universe session cache,
        honest empty when the base is not on Binance
     5) load-time safety: no fetch/AbortController -> module still loads,
        every export callable, nothing throws.
   Run: node tests/test-xuniverse.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(root, 'xuniverse.js'), 'utf8');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- context / stub factories ---------------- */
function makeCtx(extra){
  const base = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
    // NOTE: no fetch / AbortController unless `extra` adds them — load-time
    // feature-checks get exercised on the bare context too.
  };
  return vm.createContext(Object.assign(Object.create(null), base, extra || {}));
}
function loadModule(ctx){
  vm.runInContext(SRC, ctx, { filename: 'xuniverse.js' });
  return ctx.window;
}
/* fetch stub that records URLs and serves routed bodies (or fails them) */
function fetchRecorder(routes){
  const urls = [];
  const fn = async function(url){
    urls.push(String(url));
    const raw = String(url);
    const dec = (function(){ try{ return decodeURIComponent(raw); }catch(e){ return raw; } })();
    for (const r of routes){
      if (raw.indexOf(r.match) >= 0 || dec.indexOf(r.match) >= 0){
        if (r.fail) throw new Error(r.failMsg || 'network down');
        if (r.httpFail) return { ok: false, status: r.httpFail, json: async function(){ return null; } };
        const body = (typeof r.body === 'function') ? r.body(url) : r.body;
        return { ok: true, status: 200, json: async function(){ return body; } };
      }
    }
    return { ok: false, status: 404, json: async function(){ return null; } };
  };
  fn.urls = urls;
  return fn;
}
/* window stubs for the Binance candle fallback: binancePerpUniverse serves
   a fixed perp list (throws when perpList === 'THROW'), binanceKlines
   serves fixed rows. Both record every call. */
function binanceStubs(perpList, klineRows){
  const calls = { perp: 0, klines: [] };
  const win = {
    binancePerpUniverse: async function(){
      calls.perp++;
      if (perpList === 'THROW') throw new Error('binance down');
      return perpList;
    },
    binanceKlines: async function(sym, interval, limit){
      calls.klines.push([sym, interval, limit]);
      if (klineRows === 'THROW') throw new Error('klines down');
      return klineRows;
    }
  };
  return { win: win, calls: calls };
}

/* ---------------- fixtures: REAL field names from index.html ---------------- */
const DELTA_BODY = { result: [
  { symbol: 'BTCUSD',  mark_price: '60000.5', close: '60000',   open: '59000', funding_rate: '0.05',  turnover_usd: '2500000000', oi_value_usd: '900000000', oi_contracts: '15000' },
  { symbol: 'ETHUSD',  mark_price: '3000.25', close: '3000',    open: '3050',  funding_rate: '-0.02', turnover_usd: '1200000000', oi_value_usd: '500000000', oi: '166666.0000' }, // oi fallback (no oi_contracts)
  { symbol: 'SOLUSD',  mark_price: '150.5',   close: '150',     open: '148',   funding_rate: '0.01',  turnover: '800000000' },          // turnover fallback field; no OI -> nulls
  { symbol: 'XAUTUSD', mark_price: '4000',    close: '4000',    open: '3990',  funding_rate: '0.00',  turnover_usd: '5000000' },        // gold token
  { symbol: 'DOGEUSD', close: '0.12',         open: '0.11' },                                                                            // no mark_price -> close; no funding/turnover -> nulls
  { symbol: 'BADUSD',  mark_price: 'not-a-number', close: '' }                                                                           // unparseable -> mark null, row KEPT
] };
const CDCX_BODY = [ 'B-BTC_USDT', 'B-ETH_USDT', 'B-XRP_USDT', 'B-DOGE_USDT', { symbol: 'B-ADA_USDT' }, { symbol: 'B-MATIC_USDT' } ];
const CDCX_BODY_OBJFORM = { instruments: ['B-BTC_USDT', 'B-SOL_USDT'] };
/* REAL shape of CoinDCX GET /market_data/v3/current_prices/futures/rt
   (verified live): per-pair mp=mark, ls=last, v=24h USDT turnover, fr raw. */
const CDCX_MARKS_BODY = { ts: 1784547924253, vs: 346946280, prices: {
  'B-BTC_USDT':  { fr: 0.00005278, h: 65084.6, l: 63736.1, v: 6999746971.98, ls: 64845.3, pc: 0.529, mkt: 'BTCUSDT', mp: 64845.3 },
  'B-ETH_USDT':  { fr: 0.00002124, h: 1894.6,  l: 1841.84, v: 6492470405.67, ls: 1887.46, pc: 0.742, mkt: 'ETHUSDT', mp: 1887.47 },
  'B-XRP_USDT':  { v: '125000000', ls: '0.62' },                                                        // mp absent -> ls fallback
  'B-DOGE_USDT': { mp: 'not-a-number', v: 'junk' },                                                     // unparseable -> row untouched
  'B-PAXG_USDT': { mp: 4025.06597958, v: 40660403.7375 }                                                // not in instrument list -> ignored
} };

/* =========================================================================
   1) LOAD-TIME SAFETY (bare context: no fetch, no AbortController)
========================================================================= */
{
  const w = loadModule(makeCtx());
  assert(typeof w.xuUniverse === 'function', 'load: xuUniverse exported on window with no fetch present');
  assert(typeof w.xuCandles === 'function', 'load: xuCandles exported');
  assert(typeof w.xuMerge === 'function', 'load: xuMerge exported');
  assert(typeof w.xuNormDelta === 'function', 'load: xuNormDelta exported');
  assert(typeof w.xuNormCdcx === 'function', 'load: xuNormCdcx exported');
  assert(typeof w.xuState === 'function', 'load: xuState exported');
  assert(typeof w.xuUniverseNote === 'function', 'load: xuUniverseNote exported');
  assert(typeof w.xuMergeCdcxMarks === 'function', 'load: xuMergeCdcxMarks exported');
  assert(typeof w.xuPositioning === 'function', 'load: xuPositioning exported');
  assert(w.xuPositioning('BTC') === null && w.xuPositioning('B-BTC_USDT') === null,
         'load: xuPositioning null before any fetch (no cache, never throws)');
  assert(w.xuState() === null, 'load: xuState() null before any fetch attempt');
  assert(w.xuUniverseNote() === null, 'load: xuUniverseNote() null before any fetch attempt');
  assert(w.HG_tabs === undefined, 'load: library module registers NO tab');
  const rows = await w.xuUniverse();
  assert(Array.isArray(rows) && rows.length === 0, 'load: xuUniverse with fetch missing -> [] (never throws)');
  assert(typeof w.xuUniverseNote() === 'string' && w.xuUniverseNote().indexOf('failed') >= 0,
         'load: total outage sets an honest note, got "' + w.xuUniverseNote() + '"');
  const candles = await w.xuCandles({ sym: 'BTCUSD', exchange: 'delta' }, '1h', 5);
  assert(Array.isArray(candles) && candles.length === 0, 'load: xuCandles with fetch missing -> [] (never throws)');
}

/* =========================================================================
   2) xuNormDelta — real Delta field names
========================================================================= */
{
  const w = loadModule(makeCtx());
  const rows = w.xuNormDelta(DELTA_BODY);
  assert(rows.length === 6, 'normDelta: all 6 rows kept, none dropped silently (got ' + rows.length + ')');
  const btc = rows.filter(function(r){ return r.base === 'BTC'; })[0];
  assert(btc && btc.sym === 'BTCUSD', 'normDelta: BTCUSD symbol preserved');
  assert(btc.exchange === 'delta' && btc.alsoOn === null, 'normDelta: exchange tagged delta, alsoOn null');
  assert(btc.mark === 60000.5, 'normDelta: mark parsed from mark_price string');
  assert(btc.fundingPct === 0.05, 'normDelta: funding_rate kept in percent units (0.05, NO *100) — got ' + btc.fundingPct);
  assert(btc.turnoverUsd === 2.5e9, 'normDelta: turnover_usd string parsed to number');
  const sol = rows.filter(function(r){ return r.base === 'SOL'; })[0];
  assert(sol && sol.turnoverUsd === 8e8, 'normDelta: falls back to turnover field when turnover_usd absent');
  const doge = rows.filter(function(r){ return r.base === 'DOGE'; })[0];
  assert(doge && doge.mark === 0.12, 'normDelta: mark falls back to close when mark_price absent');
  assert(doge && doge.fundingPct === null && doge.turnoverUsd === null, 'normDelta: missing funding/turnover -> honest nulls');
  const xaut = rows.filter(function(r){ return r.sym === 'XAUTUSD'; })[0];
  assert(xaut && xaut.base === 'XAUT', 'normDelta: XAUTUSD -> base XAUT (USD suffix strip)');
  const bad = rows.filter(function(r){ return r.base === 'BAD'; })[0];
  assert(bad && bad.mark === null, 'normDelta: unparseable mark -> null, row kept (not silently dropped)');
  assert(w.xuNormDelta(null).length === 0 && w.xuNormDelta({}).length === 0 && w.xuNormDelta('junk').length === 0,
         'normDelta: garbage input -> [] without throwing');
  assert(w.xuNormDelta({ result: [] }).length === 0, 'normDelta: empty result -> []');
  const bare = w.xuNormDelta(DELTA_BODY.result);
  assert(bare.length === 6, 'normDelta: accepts a bare array as well as {result:[...]}');
}

/* =========================================================================
   3) xuNormCdcx — real CoinDCX shapes
========================================================================= */
{
  const w = loadModule(makeCtx());
  const rows = w.xuNormCdcx(CDCX_BODY);
  assert(rows.length === 6, 'normCdcx: all 6 instruments parsed (strings + {symbol} objects), got ' + rows.length);
  const btc = rows.filter(function(r){ return r.base === 'BTC'; })[0];
  assert(btc && btc.sym === 'B-BTC_USDT', 'normCdcx: B-BTC_USDT symbol preserved verbatim');
  assert(btc && btc.exchange === 'coindcx', 'normCdcx: exchange tagged coindcx');
  assert(btc && btc.turnoverUsd === null && btc.mark === null && btc.fundingPct === null,
         'normCdcx: no mark/funding/turnover on this endpoint -> honest nulls, never fabricated');
  const ada = rows.filter(function(r){ return r.sym === 'B-ADA_USDT'; })[0];
  assert(ada && ada.base === 'ADA', 'normCdcx: {symbol} object items supported');
  const obj = w.xuNormCdcx(CDCX_BODY_OBJFORM);
  assert(obj.length === 2 && obj[1].sym === 'B-SOL_USDT' && obj[1].base === 'SOL',
         'normCdcx: {instruments:[...]} envelope supported');
  assert(w.xuNormCdcx(null).length === 0 && w.xuNormCdcx(42).length === 0, 'normCdcx: garbage input -> [] without throwing');
}

/* =========================================================================
   4) xuMerge — dedupe by base across venues
========================================================================= */
{
  const w = loadModule(makeCtx());
  const d = w.xuNormDelta(DELTA_BODY);
  const c = w.xuNormCdcx(CDCX_BODY);
  const m = w.xuMerge(d, c);
  // bases: BTC ETH SOL XAUT DOGE BAD (delta) + BTC ETH XRP DOGE ADA MATIC (cdcx) = 9 unique
  assert(m.length === 9, 'merge: union of both venues by base = 9 unique assets, nothing dropped (got ' + m.length + ')');
  const btc = m.filter(function(r){ return r.base === 'BTC'; })[0];
  assert(btc && btc.exchange === 'delta' && btc.sym === 'BTCUSD', 'merge: BTCUSD and B-BTC_USDT are the same asset; delta wins on known turnover');
  assert(btc && btc.alsoOn === 'B-BTC_USDT', 'merge: alsoOn carries the other venue symbol (B-BTC_USDT)');
  assert(btc.turnoverUsd === 2.5e9, 'merge: primary keeps its real turnover');
  const xrp = m.filter(function(r){ return r.base === 'XRP'; })[0];
  assert(xrp && xrp.exchange === 'coindcx' && xrp.alsoOn === null, 'merge: cdcx-only contract kept with alsoOn null');
  const matic = m.filter(function(r){ return r.base === 'MATIC'; })[0];
  assert(matic && matic.sym === 'B-MATIC_USDT', 'merge: smallest cdcx-only contract survives — no silent truncation');
  const doge = m.filter(function(r){ return r.base === 'DOGE'; })[0];
  assert(doge && doge.exchange === 'delta' && doge.alsoOn === 'B-DOGE_USDT',
         'merge: turnover unknown on BOTH venues -> delta preferred, cdcx tagged as alsoOn');
  assert(m[0].base === 'BTC' && m[1].base === 'ETH' && m[2].base === 'SOL',
         'merge: sorted turnover-desc (BTC 2.5B > ETH 1.2B > SOL 0.8B)');
  assert(m[m.length-1].turnoverUsd === null && m[3].turnoverUsd !== null,
         'merge: unknown-turnover entries sort last, known ones first');
  // higher-turnover venue wins even when it is CoinDCX
  const m2 = w.xuMerge(
    w.xuNormDelta({ result: [{ symbol: 'BTCUSD', mark_price: '1', turnover_usd: '100' }] }),
    [{ sym: 'B-BTC_USDT', base: 'BTC', exchange: 'coindcx', turnoverUsd: 500, mark: 1, fundingPct: null, alsoOn: null }]
  );
  assert(m2.length === 1 && m2[0].exchange === 'coindcx' && m2[0].sym === 'B-BTC_USDT' && m2[0].alsoOn === 'BTCUSD',
         'merge: higher-turnover venue wins even when it is CoinDCX; delta becomes alsoOn');
  // known turnover beats unknown
  const m3 = w.xuMerge(
    w.xuNormDelta({ result: [{ symbol: 'LTCUSD', mark_price: '1' }] }),
    [{ sym: 'B-LTC_USDT', base: 'LTC', exchange: 'coindcx', turnoverUsd: 10, mark: null, fundingPct: null, alsoOn: null }]
  );
  assert(m3.length === 1 && m3[0].exchange === 'coindcx' && m3[0].alsoOn === 'LTCUSD',
         'merge: known turnover beats unknown (cdcx $10 primary over delta unknown)');
  // within-exchange duplicate base keeps higher turnover
  const m4 = w.xuMerge(w.xuNormDelta({ result: [
    { symbol: 'BTCUSD', mark_price: '1', turnover_usd: '100' },
    { symbol: 'BTCUSDT', mark_price: '2', turnover_usd: '999' }
  ] }), []);
  assert(m4.length === 1 && m4[0].sym === 'BTCUSDT' && m4[0].turnoverUsd === 999 && m4[0].alsoOn === null,
         'merge: same-venue duplicate base dedupes to the higher-turnover row, alsoOn stays null');
  assert(w.xuMerge([], []).length === 0 && w.xuMerge(null, undefined).length === 0, 'merge: empty/garbage inputs -> []');
}

/* =========================================================================
   5) xuUniverse end-to-end: URLs, cache, force, degradation
========================================================================= */
{
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', body: DELTA_BODY },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(uni.length === 9, 'universe: combined deduped list = 9 contracts (got ' + uni.length + ')');
  assert(f.urls.length === 3, 'universe: three network legs fired (delta + cdcx instruments + cdcx marks companion)');
  assert(f.urls[0].indexOf('/api/proxy?url=') === 0, 'universe: Delta leg routed through same-origin /api/proxy');
  assert(decodeURIComponent(f.urls[0]).indexOf('https://api.india.delta.exchange/v2/tickers?contract_types=perpetual_futures') >= 0,
         'universe: proxy wraps the real Delta tickers endpoint');
  assert(f.urls[1].indexOf('/api/proxy?url=') === 0, 'universe: CoinDCX leg routed through the same-origin /api/proxy');
  const dec = decodeURIComponent(f.urls[1]);
  assert(dec.indexOf('https://api.coindcx.com/exchange/v1/derivatives/futures/data/active_instruments') >= 0 &&
         dec.indexOf('margin_currency_short_name[]=USDT') >= 0,
         'universe: proxy wraps the real CoinDCX active_instruments USDT endpoint');
  assert(f.urls[2].indexOf('/api/proxy?url=') === 0 &&
         decodeURIComponent(f.urls[2]).indexOf('https://public.coindcx.com/market_data/v3/current_prices/futures/rt') >= 0,
         'universe: companion marks leg wraps the CoinDCX current_prices/futures/rt endpoint');
  const st = w.xuState();
  assert(st && st.count === 9 && st.delta === 6 && st.cdcx === 6 && typeof st.at === 'number',
         'universe: xuState reports {count:9, delta:6, cdcx:6, at}');
  assert(st.note === null && w.xuUniverseNote() === null, 'universe: healthy run -> note null (marks stub has no prices map -> merges nothing, not a failure)');
  const uni2 = await w.xuUniverse();
  assert(f.urls.length === 3 && uni2 === uni, 'universe: second call within 15 min served from cache (no new fetch, same array)');
  const uni3 = await w.xuUniverse(true);
  assert(f.urls.length === 6 && uni3.length === 9, 'universe: force=true bypasses the cache and refetches all three legs');
  // every entry carries the full contract shape
  const okShape = uni3.every(function(r){
    return typeof r.sym === 'string' && typeof r.base === 'string' &&
           (r.exchange === 'delta' || r.exchange === 'coindcx' || r.exchange === 'startrader' || r.exchange === 'binance') &&
           (r.turnoverUsd === null || typeof r.turnoverUsd === 'number') &&
           (r.mark === null || typeof r.mark === 'number') &&
           (r.fundingPct === null || typeof r.fundingPct === 'number') &&
           (r.oiUsd === null || typeof r.oiUsd === 'number') &&
           (r.oiContracts === null || typeof r.oiContracts === 'number') &&
           (r.alsoOn === null || typeof r.alsoOn === 'string');
  });
  assert(okShape, 'universe: every entry matches {sym, base, exchange, turnoverUsd|null, mark|null, fundingPct|null, oiUsd|null, oiContracts|null, alsoOn|null}');
}
{
  /* CoinDCX leg down -> Delta-only list with honest note */
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', body: DELTA_BODY },
    { match: '/api/proxy?url=', fail: true, failMsg: 'proxy 502' }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(uni.length === 6, 'degrade: cdcx leg down -> the 6 Delta contracts still returned');
  assert(w.xuUniverseNote().indexOf('coindcx leg failed') === 0, 'degrade: honest note names the failed leg, got "' + w.xuUniverseNote() + '"');
  const st = w.xuState();
  assert(st.cdcx === 0 && st.delta === 6, 'degrade: xuState counts the failed leg as 0');
}
{
  /* Delta leg down -> CoinDCX-only list with honest note */
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', httpFail: 503 },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(uni.length === 6 && uni.every(function(r){ return r.exchange === 'coindcx'; }),
         'degrade: delta leg HTTP 503 -> the 6 CoinDCX contracts still returned');
  assert(w.xuUniverseNote().indexOf('delta leg failed') === 0, 'degrade: note names the delta leg');
}
{
  /* total outage with no cache -> [] + honest note; with cache -> stale rows kept */
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange', fail: true, failMsg: 'dns' },
    { match: '/api/proxy?url=', fail: true, failMsg: 'proxy down' }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(Array.isArray(uni) && uni.length === 0, 'outage: both legs down, no cache -> [] (never throws, nothing fabricated)');
  assert(w.xuUniverseNote().indexOf('both exchange legs failed') === 0, 'outage: note states both legs failed');
  assert(w.xuState().count === 0, 'outage: xuState reports an empty universe honestly');
}
{
  /* good cache survives a later forced total outage (good data never replaced) */
  const good = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', body: DELTA_BODY },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const ctx = makeCtx({ fetch: good, AbortController: AbortController });
  const w = loadModule(ctx);
  await w.xuUniverse();
  ctx.fetch = fetchRecorder([
    { match: 'api.india.delta.exchange', fail: true, failMsg: 'dns' },
    { match: '/api/proxy?url=', fail: true, failMsg: 'proxy down' }
  ]);
  const uni = await w.xuUniverse(true);
  assert(uni.length === 9, 'outage: forced refetch during total outage keeps the last good 9-contract universe');
  assert(w.xuUniverseNote().indexOf('last good universe') >= 0, 'outage: note says the data is stale, got "' + w.xuUniverseNote() + '"');
}
{
  /* busy-guard: concurrent calls share one in-flight fetch */
  let release;
  const gate = new Promise(function(r){ release = r; });
  const f = async function(url){
    f.urls.push(String(url));
    await gate;
    if (String(url).indexOf('delta.exchange') >= 0) return { ok: true, status: 200, json: async function(){ return DELTA_BODY; } };
    return { ok: true, status: 200, json: async function(){ return CDCX_BODY; } };
  };
  f.urls = [];
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const p1 = w.xuUniverse(), p2 = w.xuUniverse();
  release();
  const r = await Promise.all([p1, p2]);
  assert(f.urls.length === 3 && r[0].length === 9 && r[1].length === 9,
         'busy-guard: overlapping xuUniverse calls share one fetch round (3 URLs, not 6)');
}

/* =========================================================================
   6) xuCandles — per-exchange routing
========================================================================= */
const DELTA_CANDLES = { result: [
  { time: 1700003600, open: '101', high: '105', low: '100', close: '104', volume: '11' },
  { time: 1700000000, open: '100', high: '102', low: '99',  close: '101', volume: '10' }
] };
const CDCX_CANDLES = { data: [
  { time: 1700003600000, open: '201', high: '205', low: '200', close: '204', volume: '21' },
  { time: 1700000000000, open: '200', high: '202', low: '199', close: '201' }
] };
/* already in the exact consumer contract: {t(sec),o,h,l,c,v} ascending —
   binanceKlines() normalizes to this shape in production */
const BINANCE_CANDLES = [
  { t: 1700000000, o: 100, h: 102, l: 99,  c: 101, v: 10 },
  { t: 1700003600, o: 101, h: 105, l: 100, c: 104, v: 11 },
  { t: 1700007200, o: 104, h: 106, l: 103, c: 105, v: 12 },
  { t: 1700010800, o: 105, h: 107, l: 104, c: 106, v: 13 },
  { t: 1700014400, o: 106, h: 108, l: 105, c: 107, v: 14 }
];
{
  const f = fetchRecorder([
    { match: 'delta.exchange/v2/history/candles', body: DELTA_CANDLES },
    { match: '/api/proxy?url=', body: CDCX_CANDLES }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));

  const dItem = { sym: 'BTCUSD', base: 'BTC', exchange: 'delta' };
  const rows = await w.xuCandles(dItem, '4h', 50);
  assert(rows.length === 2, 'candles: delta rows returned');
  assert(rows[0].t === 1700000000 && rows[1].t === 1700003600, 'candles: delta t kept in SECONDS and sorted ascending');
  assert(rows[0].o === 100 && rows[0].h === 102 && rows[0].l === 99 && rows[0].c === 101 && rows[0].v === 10,
         'candles: delta {t,o,h,l,c,v} mapped from {time,open,high,low,close,volume} strings');
  const du = f.urls[0];
  assert(du.indexOf('/api/proxy?url=') === 0, 'candles: delta routed via same-origin proxy');
  const duDec = decodeURIComponent(du);
  assert(duDec.indexOf('https://api.india.delta.exchange/v2/history/candles') >= 0, 'candles: proxy wraps delta candles URL');
  assert(duDec.indexOf('resolution=4h') >= 0 && duDec.indexOf('symbol=BTCUSD') >= 0, 'candles: delta DELTA_RES 4h->4h and symbol in query');
  const m = /[?&]start=(\d+)&end=(\d+)/.exec(duDec);
  assert(m && (+m[2] - +m[1]) === 14400 * 53, 'candles: delta window = secPer(4h) * (n+3) = 14400*53s');

  const cItem = { sym: 'B-BTC_USDT', base: 'BTC', exchange: 'coindcx' };
  const crows = await w.xuCandles(cItem, '1h', 10);
  assert(crows.length === 2, 'candles: cdcx rows returned');
  assert(crows[0].t === 1700000000 && crows[1].t === 1700003600, 'candles: cdcx time ms -> floored to seconds, ascending');
  assert(crows[1].v === 21 && crows[0].v === 0, 'candles: cdcx volume parsed, missing volume -> 0');
  const cu = decodeURIComponent(f.urls[1]);
  assert(f.urls[1].indexOf('/api/proxy?url=') === 0, 'candles: cdcx routed via the same-origin proxy');
  assert(cu.indexOf('https://public.coindcx.com/market_data/candlesticks') >= 0 &&
         cu.indexOf('pair=B-BTC_USDT') >= 0 && cu.indexOf('resolution=60') >= 0 && cu.indexOf('pcode=f') >= 0,
         'candles: cdcx CDCX_RES 1h->60, pair and pcode=f in proxied URL');
  const cm = /[?&]from=(\d+)&to=(\d+)/.exec(cu);
  assert(cm && (+cm[2] - +cm[1]) === 3600 * 13, 'candles: cdcx window = secPer(1h) * (n+3)');

  /* resolution maps verbatim for the other timeframes */
  await w.xuCandles(dItem, '15m', 5); assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=15m') >= 0, 'candles: delta 15m->15m');
  await w.xuCandles(dItem, '2h', 5);  assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=2h') >= 0, 'candles: delta 2h->2h');
  await w.xuCandles(dItem, '1d', 5);  assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=1d') >= 0, 'candles: delta 1d->1d');
  await w.xuCandles(cItem, '15m', 5); assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=15') >= 0, 'candles: cdcx 15m->15');
  await w.xuCandles(cItem, '2h', 5);  assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=120') >= 0, 'candles: cdcx 2h->120');
  await w.xuCandles(cItem, '4h', 5);  assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=240') >= 0, 'candles: cdcx 4h->240');
  await w.xuCandles(cItem, '1d', 5);  assert(decodeURIComponent(f.urls[f.urls.length-1]).indexOf('resolution=1D') >= 0, 'candles: cdcx 1d->1D');

  /* failure + nonsense tolerance — never throws */
  const bad = await w.xuCandles(dItem, '3h', 5);
  assert(Array.isArray(bad) && bad.length === 0, 'candles: unsupported tf -> [] (never throws)');
  const noex = await w.xuCandles({ sym: 'X', exchange: 'binance' }, '1h', 5);
  assert(Array.isArray(noex) && noex.length === 0, 'candles: unknown exchange -> [] (never throws)');
  const noitem = await w.xuCandles(null, '1h', 5);
  assert(Array.isArray(noitem) && noitem.length === 0, 'candles: null item -> [] (never throws)');
}
{
  const f = fetchRecorder([
    { match: 'delta.exchange', fail: true, failMsg: 'timeout' },
    { match: '/api/proxy?url=', httpFail: 500 }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const d = await w.xuCandles({ sym: 'BTCUSD', exchange: 'delta' }, '1h', 5);
  const c = await w.xuCandles({ sym: 'B-BTC_USDT', exchange: 'coindcx' }, '1h', 5);
  assert(d.length === 0 && c.length === 0, 'candles: network failure on either route -> [] per leg, never throws');
}

/* =========================================================================
   7) Delta native positioning — OI/funding parsing incl. missing fields
========================================================================= */
{
  const w = loadModule(makeCtx());
  const rows = w.xuNormDelta(DELTA_BODY);
  const btc = rows.filter(function(r){ return r.base === 'BTC'; })[0];
  assert(btc.oiUsd === 9e8, 'deltaOI: oi_value_usd string parsed to number (900000000)');
  assert(btc.oiContracts === 15000, 'deltaOI: oi_contracts parsed to number');
  const eth = rows.filter(function(r){ return r.base === 'ETH'; })[0];
  assert(eth.oiUsd === 5e8 && eth.oiContracts === 166666, 'deltaOI: oi field is the fallback when oi_contracts absent');
  const sol = rows.filter(function(r){ return r.base === 'SOL'; })[0];
  assert(sol.oiUsd === null && sol.oiContracts === null, 'deltaOI: OI absent from payload -> honest nulls, never 0 or fabricated');
  const xaut = rows.filter(function(r){ return r.sym === 'XAUTUSD'; })[0];
  assert(xaut.fundingPct === 0, 'deltaOI: funding 0.00 stays numeric 0 — distinct from null (a real print, not missing data)');
  const f1 = w.xuNormDelta({ result: [{ symbol: 'LTCUSD', mark_price: '100', oi_value: '12345.5' }] });
  assert(f1[0].oiUsd === 12345.5, 'deltaOI: oi_value is the fallback when oi_value_usd absent (mirrors loadTickersDelta precedence)');
  const f2 = w.xuNormDelta({ result: [{ symbol: 'OIBADUSD', mark_price: '1', oi_value_usd: 'junk', oi_contracts: 'NaNish' }] });
  assert(f2[0].oiUsd === null && f2[0].oiContracts === null, 'deltaOI: unparseable OI fields -> null, row kept');
}

/* =========================================================================
   8) xuMerge carries OI through dedupe (replace + honest gap-fill)
========================================================================= */
{
  const w = loadModule(makeCtx());
  const m = w.xuMerge(w.xuNormDelta(DELTA_BODY), w.xuNormCdcx(CDCX_BODY));
  const btc = m.filter(function(r){ return r.base === 'BTC'; })[0];
  assert(btc.oiUsd === 9e8 && btc.oiContracts === 15000, 'mergeOI: delta primary keeps its native OI through the merge');
  const sol = m.filter(function(r){ return r.base === 'SOL'; })[0];
  assert(sol.oiUsd === null, 'mergeOI: missing OI stays null after merge — nothing fabricated');
  /* secondary venue fills OI gaps honestly */
  const m2 = w.xuMerge(
    [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta', turnoverUsd: null, mark: 1, fundingPct: null, oiUsd: null, oiContracts: null, alsoOn: null }],
    [{ sym: 'B-BTC_USDT', base: 'BTC', exchange: 'coindcx', turnoverUsd: null, mark: 2, fundingPct: null, oiUsd: 777, oiContracts: 3, alsoOn: null }]
  );
  assert(m2.length === 1 && m2[0].exchange === 'delta' && m2[0].oiUsd === 777 && m2[0].oiContracts === 3,
         'mergeOI: OI gap on the primary filled from the secondary venue');
  /* winner replaces OI with its own values */
  const m3 = w.xuMerge(
    [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta', turnoverUsd: 100, mark: 1, fundingPct: 0.01, oiUsd: 900, oiContracts: 10, alsoOn: null }],
    [{ sym: 'B-BTC_USDT', base: 'BTC', exchange: 'coindcx', turnoverUsd: 500, mark: 2, fundingPct: null, oiUsd: 123, oiContracts: 4, alsoOn: null }]
  );
  assert(m3[0].exchange === 'coindcx' && m3[0].oiUsd === 123 && m3[0].oiContracts === 4,
         'mergeOI: higher-turnover winner carries its own OI (delta OI still reachable via xuPositioning)');
}

/* =========================================================================
   9) xuMergeCdcxMarks — pure companion merge, failure tolerance
========================================================================= */
{
  const w = loadModule(makeCtx());
  const base = w.xuNormCdcx(CDCX_BODY);
  const res = w.xuMergeCdcxMarks(base, CDCX_MARKS_BODY);
  const btc = res.rows.filter(function(r){ return r.sym === 'B-BTC_USDT'; })[0];
  assert(btc.mark === 64845.3, 'cdcxMarks: mark merged from mp');
  assert(btc.turnoverUsd === 6999746971.98, 'cdcxMarks: 24h USDT turnover merged from v');
  assert(btc.fundingPct === null, 'cdcxMarks: fundingPct untouched — rt fr units unverified, never converted or invented');
  const xrp = res.rows.filter(function(r){ return r.sym === 'B-XRP_USDT'; })[0];
  assert(xrp.mark === 0.62 && xrp.turnoverUsd === 125000000, 'cdcxMarks: mp absent -> ls fallback; string v parsed');
  const doge = res.rows.filter(function(r){ return r.sym === 'B-DOGE_USDT'; })[0];
  assert(doge.mark === null && doge.turnoverUsd === null, 'cdcxMarks: unparseable mp+v -> row keeps honest nulls');
  const ada = res.rows.filter(function(r){ return r.sym === 'B-ADA_USDT'; })[0];
  assert(ada.mark === null, 'cdcxMarks: symbol absent from prices map -> nulls preserved');
  assert(res.count === 3, 'cdcxMarks: count reports exactly the 3 rows actually enriched (BTC, ETH, XRP — DOGE junk skipped), got ' + res.count);
  assert(base.filter(function(r){ return r.sym === 'B-BTC_USDT'; })[0].mark === null,
         'cdcxMarks: input rows never mutated (pure function)');
  /* bare string/number price form */
  const s = w.xuMergeCdcxMarks(w.xuNormCdcx(['B-ETH_USDT']), { 'B-ETH_USDT': '1887.5' });
  assert(s.rows[0].mark === 1887.5 && s.rows[0].turnoverUsd === null && s.count === 1,
         'cdcxMarks: bare string price per symbol accepted as mark');
  /* garbage bodies -> rows unchanged, never throws */
  const g1 = w.xuMergeCdcxMarks(base, ['not', 'a', 'map']);
  const g2 = w.xuMergeCdcxMarks(base, null);
  assert(g1.count === 0 && g2.count === 0 && g1.rows.length === base.length && g2.rows.length === base.length,
         'cdcxMarks: array/null body -> rows pass through unchanged (never throws)');
}

/* =========================================================================
   10) universe end-to-end with the marks companion leg
========================================================================= */
{
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', body: DELTA_BODY },
    { match: 'current_prices', body: CDCX_MARKS_BODY },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(f.urls.length === 3 && f.urls[1].indexOf('active_instruments') >= 0 && f.urls[2].indexOf('current_prices') >= 0,
         'marksE2E: instruments list fetched before the marks companion leg');
  const xrp = uni.filter(function(r){ return r.base === 'XRP'; })[0];
  assert(xrp && xrp.mark === 0.62 && xrp.turnoverUsd === 125000000,
         'marksE2E: cdcx-only contract lands with REAL mark+turnover instead of blind nulls');
  assert(xrp.oiUsd === null && xrp.fundingPct === null, 'marksE2E: cdcx OI/funding stay honest nulls even with marks merged');
  const btc = uni.filter(function(r){ return r.base === 'BTC'; })[0];
  assert(btc.exchange === 'coindcx' && btc.alsoOn === 'BTCUSD' && btc.turnoverUsd === 6999746971.98,
         'marksE2E: real cdcx turnover ($7B > delta $2.5B) wins primary honestly; delta becomes alsoOn');
  const st = w.xuState();
  assert(st.cdcxMarks === 3 && st.note === null, 'marksE2E: xuState.cdcxMarks counts enriched rows; healthy run note null');
  const okShape = uni.every(function(r){
    return (r.oiUsd === null || typeof r.oiUsd === 'number') && (r.oiContracts === null || typeof r.oiContracts === 'number');
  });
  assert(okShape, 'marksE2E: merged universe carries the additive oiUsd/oiContracts fields on every row');
}
{
  /* marks leg down -> universe unaffected, honest note, nulls preserved */
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', body: DELTA_BODY },
    { match: 'current_prices', fail: true, failMsg: 'rt 502' },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(uni.length === 9, 'marksFail: marks leg down NEVER blocks or shrinks the universe (still 9 contracts)');
  const xrp = uni.filter(function(r){ return r.base === 'XRP'; })[0];
  assert(xrp.mark === null && xrp.turnoverUsd === null, 'marksFail: cdcx rows keep honest nulls when marks fail');
  assert(w.xuUniverseNote().indexOf('marks leg failed') >= 0 && w.xuUniverseNote().indexOf('nulls') >= 0,
         'marksFail: visible honest note names the failed marks leg, got "' + w.xuUniverseNote() + '"');
  assert(w.xuState().cdcxMarks === 0, 'marksFail: xuState.cdcxMarks 0 when the leg failed');
}
{
  /* marks failure + delta failure: primary leg note still leads */
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', httpFail: 503 },
    { match: 'current_prices', fail: true, failMsg: 'rt 502' },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  const uni = await w.xuUniverse();
  assert(uni.length === 6 && w.xuUniverseNote().indexOf('delta leg failed') === 0 &&
         w.xuUniverseNote().indexOf('marks leg failed') >= 0,
         'marksFail: combined failure note names BOTH failed legs, primary leg first');
}

/* =========================================================================
   11) xuPositioning — per-venue native positioning from the cache
========================================================================= */
{
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange/v2/tickers', body: DELTA_BODY },
    { match: 'current_prices', body: CDCX_MARKS_BODY },
    { match: '/api/proxy?url=', body: CDCX_BODY }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  await w.xuUniverse();
  const p1 = w.xuPositioning('BTC');
  assert(p1 && p1.exchange === 'delta' && p1.fundingPct === 0.05 && p1.oiUsd === 9e8 && p1.mark === 60000.5,
         'positioning: base "BTC" -> DELTA-native {fundingPct, oiUsd, mark} even when cdcx won the merged primary');
  const p2 = w.xuPositioning('B-BTC_USDT');
  assert(p2 && p2.exchange === 'delta' && p2.oiUsd === 9e8 && p2.sym === 'BTCUSD',
         'positioning: CoinDCX sym "B-BTC_USDT" resolves to the same Delta-native positioning');
  const p3 = w.xuPositioning('BTCUSD');
  assert(p3 && p3.exchange === 'delta' && p3.fundingPct === 0.05, 'positioning: Delta sym "BTCUSD" resolves too');
  const px = w.xuPositioning('XRP');
  assert(px && px.exchange === 'coindcx' && px.mark === 0.62 && px.fundingPct === null && px.oiUsd === null,
         'positioning: cdcx-only asset answers mark-only with funding/OI honestly null');
  assert(w.xuPositioning('NOPE') === null && w.xuPositioning('') === null && w.xuPositioning(null) === null,
         'positioning: unknown/empty/garbage lookup -> null (never throws, never fabricates)');
  /* cache interplay: positioning survives a later forced total outage (stale kept) */
  const ctx = makeCtx({ fetch: f, AbortController: AbortController });
  const w2 = loadModule(ctx);
  await w2.xuUniverse();
  ctx.fetch = fetchRecorder([
    { match: 'api.india.delta.exchange', fail: true, failMsg: 'dns' },
    { match: '/api/proxy?url=', fail: true, failMsg: 'proxy down' }
  ]);
  const uni = await w2.xuUniverse(true);
  const pst = w2.xuPositioning('BTC');
  assert(uni.length === 9 && pst && pst.oiUsd === 9e8 && w2.xuUniverseNote().indexOf('last good universe') >= 0,
         'positioning: stale cache keeps positioning available after a forced total outage — honestly labeled stale');
}
{
  /* empty-cache outage -> positioning null, never throws */
  const f = fetchRecorder([
    { match: 'api.india.delta.exchange', fail: true, failMsg: 'dns' },
    { match: '/api/proxy?url=', fail: true, failMsg: 'proxy down' }
  ]);
  const w = loadModule(makeCtx({ fetch: f, AbortController: AbortController }));
  await w.xuUniverse();
  assert(w.xuPositioning('BTC') === null && w.xuState().cdcxMarks === 0,
         'positioning: total outage with no cache -> null positioning + cdcxMarks 0, honestly empty');
}

/* =========================================================================
   12) xuCandles Binance fallback — venue legs that fail or come back too
       thin reroute to the base asset's USDT perp; contract intact; rows
       never fabricated; perp universe fetched at most once per session
========================================================================= */
{
  /* (a) venue OK (rows >= requested) -> Binance NEVER consulted */
  const f = fetchRecorder([{ match: 'delta.exchange/v2/history/candles', body: DELTA_CANDLES }]);
  const bs = binanceStubs(['BTCUSDT'], BINANCE_CANDLES);
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const rows = await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1h', 2);
  assert(rows.length === 2 && rows[0].t === 1700000000 && rows[1].c === 104,
         'fallback: sufficient venue rows pass through untouched');
  assert(bs.calls.perp === 0 && bs.calls.klines.length === 0,
         'fallback: venue OK -> Binance never consulted (no perp lookup, no kline call)');
  assert(w.xuCandles.lastSource === 'delta', 'fallback: lastSource tags the venue route on a healthy leg');
}
{
  /* (b) venue empty + base on Binance -> Binance rows, exact same shape */
  const f = fetchRecorder([{ match: 'delta.exchange/v2/history/candles', body: { result: [] } }]);
  const bs = binanceStubs(['BTCUSDT', 'XRPUSDT'], BINANCE_CANDLES);
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const rows = await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '4h', 5);
  assert(rows.length === 5 && rows[0].t === 1700000000 && rows[4].c === 107,
         'fallback: venue empty + base on Binance -> Binance rows returned');
  const okShape = rows.every(function(r, i){
    return Object.keys(r).sort().join(',') === 'c,h,l,o,t,v' &&
           isFinite(r.t) && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c) && isFinite(r.v) &&
           (i === 0 || r.t > rows[i-1].t) && r.t < 1e12;
  });
  assert(okShape, 'fallback: rows keep the exact {t(seconds),o,h,l,c,v} ascending contract — bare rows, no extra fields');
  assert(bs.calls.perp === 1 && bs.calls.klines.length === 1, 'fallback: one perp-universe lookup, one kline call');
  assert(bs.calls.klines[0][0] === 'BTCUSDT' && bs.calls.klines[0][1] === '4h' && bs.calls.klines[0][2] === 5,
         'fallback: kline args = base+USDT, venue tf passed through (4h is Binance-native, no remap), requested count');
  assert(w.xuCandles.lastSource === 'binance-fallback',
         'fallback: source tagged on xuCandles.lastSource, return shape unchanged');
  /* interval passthrough pins: every module tf is Binance-native 1:1 */
  await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '15m', 5);
  assert(bs.calls.klines[bs.calls.klines.length-1][1] === '15m', 'fallback: 15m -> Binance 15m (identity)');
  await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '2h', 5);
  assert(bs.calls.klines[bs.calls.klines.length-1][1] === '2h', 'fallback: 2h -> Binance 2h (identity)');
  await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1d', 5);
  assert(bs.calls.klines[bs.calls.klines.length-1][1] === '1d', 'fallback: 1d -> Binance 1d (identity)');
}
{
  /* (b2) venue THIN (fewer rows than requested) -> deeper Binance series wins;
     base derived from sym per module convention when item.base is absent */
  const f = fetchRecorder([{ match: 'candlesticks', body: CDCX_CANDLES }]); // 2 venue rows
  const bs = binanceStubs(['XRPUSDT'], BINANCE_CANDLES);
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const rows = await w.xuCandles({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }, '1h', 5);
  assert(rows.length === 5 && rows[4].c === 107,
         'fallback: thin venue (2 < 5 requested) -> deeper Binance series wins');
  assert(bs.calls.klines[0][0] === 'XRPUSDT', 'fallback: B-XRP_USDT base -> XRPUSDT');
  assert(w.xuCandles.lastSource === 'binance-fallback', 'fallback: thin-venue reroute tagged binance-fallback');
  const rows2 = await w.xuCandles({ sym: 'B-XRP_USDT', exchange: 'coindcx' }, '1h', 5); // no item.base
  assert(rows2.length === 5 && bs.calls.klines[bs.calls.klines.length-1][0] === 'XRPUSDT',
         'fallback: missing item.base -> base derived from sym via module convention (B-XRP_USDT -> XRP)');
}
{
  /* Binance series NOT deeper than the venue's -> native venue rows kept */
  const f = fetchRecorder([{ match: 'candlesticks', body: CDCX_CANDLES }]); // 2 venue rows
  const bs = binanceStubs(['XRPUSDT'], [BINANCE_CANDLES[0]]);              // only 1 Binance row
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const rows = await w.xuCandles({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }, '1h', 5);
  assert(rows.length === 2 && rows[0].t === 1700000000 && rows[1].t === 1700003600,
         'fallback: Binance not deeper -> native venue rows kept (fallback never downgrades)');
  assert(w.xuCandles.lastSource === 'coindcx', 'fallback: venue-kept result tagged to its venue');
}
{
  /* (c) venue empty + base NOT on Binance -> honest empty, never fabricated */
  const f = fetchRecorder([{ match: 'delta.exchange/v2/history/candles', body: { result: [] } }]);
  const bs = binanceStubs(['ETHUSDT'], BINANCE_CANDLES); // no BTCUSDT in the perp universe
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const rows = await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1h', 5);
  assert(Array.isArray(rows) && rows.length === 0,
         'fallback: base NOT a Binance perp -> honest [], never fabricated');
  assert(bs.calls.perp === 1 && bs.calls.klines.length === 0,
         'fallback: verified non-member -> no wasted kline call');
  assert(w.xuCandles.lastSource === 'delta', 'fallback: empty venue result still tagged to its venue route');
}
{
  /* (d) both down -> honest empty, never throws. Perp universe throwing
     degrades to direct-kline-attempt mode; empty klines = not on Binance. */
  const f = fetchRecorder([{ match: 'delta.exchange', fail: true, failMsg: 'timeout' }]);
  const bs = binanceStubs('THROW', []);
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const rows = await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1h', 5);
  assert(Array.isArray(rows) && rows.length === 0,
         'fallback: venue down + Binance down -> honest [], never throws');
  assert(bs.calls.perp === 1 && bs.calls.klines.length === 1,
         'fallback: perp universe unavailable -> membership probed by one direct kline attempt');
  /* klines itself throwing -> still honest [] */
  const f2 = fetchRecorder([{ match: 'delta.exchange', httpFail: 500 }]);
  const bs2 = binanceStubs(['BTCUSDT'], 'THROW');
  const w2 = loadModule(makeCtx({ window: bs2.win, fetch: f2, AbortController: AbortController }));
  const rows2 = await w2.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1h', 5);
  assert(Array.isArray(rows2) && rows2.length === 0,
         'fallback: venue HTTP 500 + throwing binanceKlines -> honest [], never throws');
}
{
  /* (e) binancePerpUniverse called AT MOST ONCE across two fallbacks —
     sequential AND concurrent (in-flight attempt is shared) */
  const f = fetchRecorder([
    { match: 'delta.exchange/v2/history/candles', body: { result: [] } },
    { match: 'candlesticks', body: { data: [] } }
  ]);
  const bs = binanceStubs(['BTCUSDT', 'XRPUSDT'], BINANCE_CANDLES);
  const w = loadModule(makeCtx({ window: bs.win, fetch: f, AbortController: AbortController }));
  const r1 = await w.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1h', 5);
  const r2 = await w.xuCandles({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }, '1h', 5);
  assert(r1.length === 5 && r2.length === 5, 'fallback: both venue-empty legs reroute to Binance');
  assert(bs.calls.perp === 1,
         'fallback: binancePerpUniverse called at most once across two sequential fallbacks (session cache), got ' + bs.calls.perp);
  assert(bs.calls.klines.length === 2 && bs.calls.klines[1][0] === 'XRPUSDT',
         'fallback: one kline call per disappointed leg; second leg maps B-XRP_USDT -> XRPUSDT');
  /* concurrent fallbacks share the single in-flight universe fetch */
  const f3 = fetchRecorder([
    { match: 'delta.exchange/v2/history/candles', body: { result: [] } },
    { match: 'candlesticks', body: { data: [] } }
  ]);
  const bs3 = binanceStubs(['BTCUSDT', 'XRPUSDT'], BINANCE_CANDLES);
  const w3 = loadModule(makeCtx({ window: bs3.win, fetch: f3, AbortController: AbortController }));
  const rr = await Promise.all([
    w3.xuCandles({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }, '1h', 5),
    w3.xuCandles({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }, '1h', 5)
  ]);
  assert(rr[0].length === 5 && rr[1].length === 5 && bs3.calls.perp === 1,
         'fallback: concurrent fallbacks share ONE perp-universe fetch (in-flight guard), got ' + bs3.calls.perp);
}

/* ---------------- summary ---------------- */
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0){ process.exitCode = 1; }
