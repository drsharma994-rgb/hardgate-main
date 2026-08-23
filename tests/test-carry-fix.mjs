/* HARDGATE — carry-fix data-layer tests (Node 18+, builtins only, OFFLINE).
   Covers the AGENT CARRY changes:
     1) binanceFundingInfo()  — /fapi/v1/fundingInfo parsing (1h/4h/8h
        intervals, cap/floor decimal -> percent, invalid rows omitted),
        10-min cache, never-throw discipline
     2) binanceTopLSAccounts() — /futures/data/topLongShortAccountRatio
        parsing (same shape family as binanceLongShort, distinct cache)
     3) binanceBasis() — /futures/data/basis parsing (rates decimal ->
        percent), default args pair=BTCUSDT/CURRENT_QUARTER/1h/limit=1
     4) carry.js pure core — carrySpread UNCHANGED, carryAnnualize both
        intervals (0.01% @8h -> 10.95% APR; @4h -> 21.9% APR), carrySpreadInt
   Every network call is stubbed; no live requests. Run: node tests/test-carry-fix.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_SRC = readFileSync(path.join(root, 'binance.js'), 'utf8');
const CARRY_SRC = readFileSync(path.join(root, 'carry.js'), 'utf8');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function approx(a, b, eps, msg){
  assert(isFinite(a) && Math.abs(a - b) <= eps, msg + ' (got ' + a + ', want ~' + b + ')');
}

/* fresh vm context per test group -> fresh module caches (no cross-test leakage) */
function makeBinCtx(routes, counter){
  const calls = counter || { n: 0, urls: [] };
  const fetchStub = async function(url){
    calls.n++; calls.urls.push(String(url));
    for (const r of routes){
      if (String(url).indexOf(r.match) >= 0){
        if (r.fail) return { ok: false, status: 500, json: async function(){ return null; } };
        if (r.throw) throw new Error('network boom');
        const body = (typeof r.body === 'function') ? r.body(url) : r.body;
        return { ok: true, status: 200, json: async function(){ return body; } };
      }
    }
    return { ok: false, status: 404, json: async function(){ return null; } };
  };
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    AbortController: AbortController,
    fetch: fetchStub
  }));
  vm.runInContext(BIN_SRC, ctx, { filename: 'binance.js' });
  return { ctx: ctx, calls: calls };
}
function makeCarryCtx(){
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout
  }));
  vm.runInContext(CARRY_SRC, ctx, { filename: 'carry.js' });
  return ctx.window;
}

/* ---------------- synthetic wire data (shapes curl-verified 2026) ---------------- */
const FUNDING_INFO = [
  { symbol: 'AAAUSDT', adjustedFundingRateCap: '0.00750000', adjustedFundingRateFloor: '-0.00750000', fundingIntervalHours: 4, disclaimer: false, updateTime: 1752854309429 },
  { symbol: 'BBBUSDT', adjustedFundingRateCap: '0.02000000', adjustedFundingRateFloor: '-0.02000000', fundingIntervalHours: 8, disclaimer: false, updateTime: 1758377721362 },
  { symbol: 'CCCUSDT', adjustedFundingRateCap: '0.00100000', adjustedFundingRateFloor: '-0.00100000', fundingIntervalHours: 1, disclaimer: false, updateTime: 1750000000000 },
  { symbol: 'BADUSDT', adjustedFundingRateCap: '0.02', adjustedFundingRateFloor: '-0.02', fundingIntervalHours: 0 },   // invalid interval -> omitted
  { symbol: 'NANUSDT', adjustedFundingRateCap: '0.02', adjustedFundingRateFloor: '-0.02' },                                // missing interval -> omitted
  { symbol: 'ZZZUSDT', adjustedFundingRateCap: 'oops', adjustedFundingRateFloor: null, fundingIntervalHours: 8 }           // bad cap -> NaN capPct, kept
];
const TOP_LS_ACCOUNTS = [ // intentionally unsorted timestamps
  { symbol: 'BTCUSDT', longAccount: '0.6000', shortAccount: '0.4000', longShortRatio: '1.5000', timestamp: 1700003600000 },
  { symbol: 'BTCUSDT', longAccount: '0.6238', shortAccount: '0.3762', longShortRatio: '1.6582', timestamp: 1700000000000 }
];
const GLOBAL_LS = [
  { symbol: 'BTCUSDT', longAccount: '0.5100', shortAccount: '0.4900', longShortRatio: '1.0408', timestamp: 1700000000000 }
];
const BASIS = [
  { indexPrice: '64121.44217391', contractType: 'CURRENT_QUARTER', basisRate: '0.0071',
    futuresPrice: '64577.1', annualizedBasisRate: '0.0377', basis: '455.65782609',
    pair: 'BTCUSDT', timestamp: 1784390400000 }
];

/* ================================================================
   0) LOAD DISCIPLINE
================================================================ */
console.log('--- load discipline ---');
{
  let threw = false;
  try{
    const ctx = vm.createContext(Object.assign(Object.create(null), { console: console }));
    vm.runInContext(BIN_SRC, ctx, { filename: 'binance.js' }); // no fetch/AbortController at all
  }catch(e){ threw = true; }
  assert(!threw, 'binance.js loads without throwing in a bare context (no fetch layer)');
  const bare = vm.createContext(Object.assign(Object.create(null), { console: console }));
  vm.runInContext(BIN_SRC, bare, { filename: 'binance.js' });
  assert(typeof bare.binanceFundingInfo === 'function', 'binanceFundingInfo is a global');
  assert(typeof bare.binanceTopLSAccounts === 'function', 'binanceTopLSAccounts is a global');
  assert(typeof bare.binanceBasis === 'function', 'binanceBasis is a global');
}

/* ================================================================
   1) binanceFundingInfo — parsing
================================================================ */
console.log('--- binanceFundingInfo: parsing ---');
{
  const { ctx, calls } = makeBinCtx([{ match: '/fapi/v1/fundingInfo', body: FUNDING_INFO }]);
  const map = await ctx.binanceFundingInfo();
  assert(map && typeof map === 'object', 'returns a symbol map');
  assert(map.AAAUSDT && map.AAAUSDT.intervalHours === 4, '4h perp parsed (fundingIntervalHours 4)');
  assert(map.BBBUSDT && map.BBBUSDT.intervalHours === 8, '8h perp parsed');
  assert(map.CCCUSDT && map.CCCUSDT.intervalHours === 1, '1h perp parsed');
  approx(map.AAAUSDT.capPct, 0.75, 1e-12, 'cap decimal 0.0075 -> 0.75 percent units');
  approx(map.AAAUSDT.floorPct, -0.75, 1e-12, 'floor decimal -0.0075 -> -0.75 percent units');
  approx(map.BBBUSDT.capPct, 2, 1e-12, 'cap decimal 0.02 -> 2 percent units');
  assert(!('BADUSDT' in map), 'fundingIntervalHours 0 -> symbol omitted (caller assumes 8h)');
  assert(!('NANUSDT' in map), 'missing fundingIntervalHours -> symbol omitted');
  assert(map.ZZZUSDT && map.ZZZUSDT.intervalHours === 8 && !isFinite(map.ZZZUSDT.capPct),
    'unparseable cap kept as NaN capPct (caller guards isFinite), symbol not dropped');
  assert(calls.n === 1 && calls.urls[0].indexOf('/fapi/v1/fundingInfo') >= 0,
    'exactly one fetch to /fapi/v1/fundingInfo');
}

console.log('--- binanceFundingInfo: 10-min cache ---');
{
  const { ctx, calls } = makeBinCtx([{ match: '/fapi/v1/fundingInfo', body: FUNDING_INFO }]);
  const a = await ctx.binanceFundingInfo();
  const b = await ctx.binanceFundingInfo();
  assert(a === b, 'second call within the TTL returns the cached map object');
  assert(calls.n === 1, 'second call within 10 min does NOT re-fetch');
}

console.log('--- binanceFundingInfo: failure tolerance ---');
{
  const httpFail = makeBinCtx([{ match: 'fundingInfo', fail: true }]);
  assert(await httpFail.ctx.binanceFundingInfo() === null, 'HTTP 500 -> resolves null');
  const thrown = makeBinCtx([{ match: 'fundingInfo', throw: true }]);
  assert(await thrown.ctx.binanceFundingInfo() === null, 'fetch throw -> resolves null (never rejects)');
  const wrongShape = makeBinCtx([{ match: 'fundingInfo', body: { not: 'an array' } }]);
  assert(await wrongShape.ctx.binanceFundingInfo() === null, 'non-array body -> null');
  /* A retry must re-fetch rather than serve a cached failure. NOT a hardcoded
     count: since the geo-block fallback landed, one logical attempt makes up
     to TWO fetches — direct, then the same-origin proxy — so counting raw
     fetches measures the transport, not the caching. What matters is that the
     second attempt went to the network at all. */
  const beforeRetry = httpFail.calls.n;
  const miss = await httpFail.ctx.binanceFundingInfo();
  assert(miss === null, 'a repeated failure still resolves null');
  assert(httpFail.calls.n > beforeRetry, 'failures are NOT cached (retry re-fetches)');
}

/* ================================================================
   2) binanceTopLSAccounts — parsing, sort, cache separation
================================================================ */
console.log('--- binanceTopLSAccounts ---');
{
  const { ctx, calls } = makeBinCtx([
    { match: 'topLongShortAccountRatio', body: TOP_LS_ACCOUNTS },
    { match: 'globalLongShortAccountRatio', body: GLOBAL_LS }
  ]);
  const r = await ctx.binanceTopLSAccounts('BTCUSDT');
  assert(r && r.latest && Array.isArray(r.series), '{latest, series} shape');
  approx(r.latest.longPct, 60, 1e-12, 'longAccount 0.60 -> longPct 60 (percent units)');
  approx(r.latest.shortPct, 40, 1e-12, 'shortAccount 0.40 -> shortPct 40');
  approx(r.latest.ratio, 1.5, 1e-12, 'longShortRatio passthrough');
  assert(r.latest.t === 1700003600, 'timestamp ms -> seconds');
  assert(r.series.length === 2 && r.series[0].t < r.series[1].t && r.series[0].longPct === 62.38,
    'series sorted ascending by t (wire order was reversed)');
  /* Not urls[0] any more: every per-symbol fapi reader first asks exchangeInfo
     so it can resolve Binance's 1000x contracts (SHIBUSDT -> 1000SHIBUSDT).
     Find the endpoint rather than assuming its slot. */
  const tlsUrl = calls.urls.filter(function(u){ return u.indexOf('/futures/data/topLongShortAccountRatio') >= 0; })[0] || '';
  assert(tlsUrl.indexOf('symbol=BTCUSDT') >= 0 &&
         tlsUrl.indexOf('period=1h') >= 0 && tlsUrl.indexOf('limit=30') >= 0,
    'default args: period=1h, limit=30');

  const g = await ctx.binanceLongShort('BTCUSDT');
  approx(g.latest.longPct, 51, 1e-12, 'binanceLongShort still hits the GLOBAL ratio endpoint...');
  approx(r.latest.longPct, 60, 1e-12, '...while top accounts keeps its own value (distinct cache keys)');

  const again = await ctx.binanceTopLSAccounts('BTCUSDT');
  assert(again === r, 'repeat call served from cache');

  const f = makeBinCtx([{ match: 'topLongShortAccountRatio', fail: true }]);
  assert(await f.ctx.binanceTopLSAccounts('BTCUSDT') === null, 'HTTP failure -> null');
  const empty = makeBinCtx([{ match: 'topLongShortAccountRatio', body: [] }]);
  assert(await empty.ctx.binanceTopLSAccounts('BTCUSDT') === null, 'empty array -> null');
  assert(await ctx.binanceTopLSAccounts('') === null, 'missing symbol -> null, no fetch');
}

/* ================================================================
   3) binanceBasis — parsing + default args
================================================================ */
console.log('--- binanceBasis ---');
{
  const { ctx, calls } = makeBinCtx([{ match: '/futures/data/basis', body: BASIS }]);
  const r = await ctx.binanceBasis(); // all defaults
  /* Not urls[0] any more: a non-PERPETUAL request first asks exchangeInfo
     whether the pair even has that dated contract (Binance lists quarterlies
     for two pairs, and asking anywhere else earns a 400 -4104). This mock
     routes only /futures/data/basis, so exchangeInfo 404s, the listing reads
     as UNKNOWN and the call is attempted — which is the degradation this
     assertion should see. Find the basis URL rather than assume its slot. */
  const u = calls.urls.filter(function(x){ return x.indexOf('/futures/data/basis') >= 0; })[0] || '';
  assert(u.indexOf('pair=BTCUSDT') >= 0 && u.indexOf('contractType=CURRENT_QUARTER') >= 0 &&
         u.indexOf('period=1h') >= 0 && u.indexOf('limit=1') >= 0,
    "default args -> pair=BTCUSDT&contractType=CURRENT_QUARTER&period=1h&limit=1");
  assert(r && r.latest && r.series.length === 1, '{latest, series} with one point');
  approx(r.latest.annualizedBasisPct, 3.77, 1e-12, 'annualizedBasisRate 0.0377 -> 3.77 percent units');
  approx(r.latest.basisRatePct, 0.71, 1e-12, 'basisRate 0.0071 -> 0.71 percent units');
  approx(r.latest.basis, 455.65782609, 1e-9, 'basis in quote ccy passthrough');
  approx(r.latest.futuresPrice, 64577.1, 1e-12, 'futuresPrice parsed');
  approx(r.latest.indexPrice, 64121.44217391, 1e-9, 'indexPrice parsed');
  assert(r.latest.t === 1784390400, 'timestamp ms -> seconds');

  const f = makeBinCtx([{ match: '/futures/data/basis', fail: true }]);
  assert(await f.ctx.binanceBasis('ETHUSDT') === null, 'HTTP failure -> null');
  const empty = makeBinCtx([{ match: '/futures/data/basis', body: [] }]);
  assert(await empty.ctx.binanceBasis('ETHUSDT') === null, 'empty array -> null');
}

/* ================================================================
   4) carry.js pure core — carrySpread UNCHANGED + interval APR math
================================================================ */
console.log('--- carrySpread: unchanged legacy behavior ---');
{
  const w = makeCarryCtx();
  const cs = w.carrySpread;
  const r = cs(0.05, 0.01);
  approx(r.deltaAPR, 54.75, 1e-9, 'legacy deltaAPR = 0.05 * 3 * 365');
  approx(r.binanceAPR, 10.95, 1e-9, 'legacy binanceAPR = 0.01 * 3 * 365');
  approx(r.spreadAPR, 43.8, 1e-9, 'legacy spreadAPR');
  assert(r.shortVenue === 'delta' && r.longVenue === 'binance', 'legacy venue assignment');
  assert(JSON.stringify(Object.keys(r).sort()) ===
    JSON.stringify(['binanceAPR', 'deltaAPR', 'longVenue', 'shortVenue', 'spreadAPR']),
    'legacy result still has exactly the five contracted keys');
  assert(cs('0.05', 0.01) === null && cs(NaN, 1) === null && cs(1, Infinity) === null,
    'legacy invalid-input guards unchanged');
}

console.log('--- carryAnnualize: APR math on both funding intervals ---');
{
  const w = makeCarryCtx();
  const ca = w.carryAnnualize;
  assert(typeof ca === 'function', 'window.carryAnnualize exported');
  approx(ca(0.01, 8), 10.95, 1e-9, '0.01% per print @ 8h -> 0.01 * 3 * 365 = 10.95% APR');
  approx(ca(0.01, 4), 21.9, 1e-9, '0.01% per print @ 4h -> 0.01 * 6 * 365 = 21.9% APR');
  approx(ca(0.01, 1), 87.6, 1e-9, '0.01% per print @ 1h -> 0.01 * 24 * 365 = 87.6% APR');
  assert(ca(0, 8) === 0, 'zero rate annualizes to zero, not null');
  assert(ca(0.01, 0) === null && ca(0.01, -4) === null, 'non-positive interval -> null');
  assert(ca(NaN, 8) === null && ca(0.01, NaN) === null, 'NaN -> null');
  assert(ca('0.01', 8) === null && ca(0.01, '8') === null, 'strings rejected (strict number typing)');
}

console.log('--- carrySpreadInt: interval-aware classifier ---');
{
  const w = makeCarryCtx();
  const ci = w.carrySpreadInt, cs = w.carrySpread;
  assert(typeof ci === 'function', 'window.carrySpreadInt exported');

  const a = ci(0.05, 0.01, 8), b = cs(0.05, 0.01);
  assert(a.deltaAPR === b.deltaAPR && a.binanceAPR === b.binanceAPR && a.spreadAPR === b.spreadAPR &&
         a.shortVenue === b.shortVenue && a.longVenue === b.longVenue,
    'carrySpreadInt(a, b, 8) === carrySpread(a, b) — 8h case identical');

  const r4 = ci(0.05, 0.01, 4);
  approx(r4.binanceAPR, 21.9, 1e-9, '4h binance leg annualizes 0.01 * 6 * 365 = 21.9');
  approx(r4.spreadAPR, 32.85, 1e-9, 'spread shrinks vs the wrong 8h assumption (|54.75 - 21.9|)');
  assert(r4.shortVenue === 'delta', 'venue direction still by higher APR');

  const flip = ci(0.03, 0.02, 4);
  approx(flip.deltaAPR, 32.85, 1e-9, 'delta leg fixed at 3 * 365');
  approx(flip.binanceAPR, 43.8, 1e-9, '4h binance leg 0.02 * 6 * 365 = 43.8');
  assert(flip.shortVenue === 'binance' && flip.longVenue === 'delta',
    'interval-aware APR can flip the venue assignment vs the 8h bug (0.02@4h > 0.03@8h)');

  assert(ci(0.05, 0.01, 0) === null && ci(0.05, 0.01, -8) === null && ci(0.05, 0.01, NaN) === null,
    'invalid interval -> null');
  assert(ci(null, 0.01, 8) === null && ci(0.05, NaN, 8) === null, 'invalid rates -> null');
}

/* ---------------- summary ---------------- */
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0){ process.exitCode = 1; }
