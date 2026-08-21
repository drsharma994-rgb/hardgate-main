/* HARDGATE — in-flight request coalescing + the FRED "not configured" latch.

   THE DEFECT THIS GUARDS.
   Every candle cache in the app was checked BEFORE its await and written
   AFTER it, so it only ever deduplicated requests that were already
   sequential. A BRAIN synthesis fans dozens of candidates out at once, every
   one of them missed the still-empty cache, and the identical URL went out
   two or three times in the same millisecond. Measured on the live desk:
   SAHARAUSD, SOPHUSD, ALTUSD and SKLUSD each requested three times back to
   back; the answers were Binance -1003 ("Way too many requests; IP banned")
   and a wall of 429s from the Delta proxy.

   Separately, /api/fred answers 503 when the server holds no FRED_API_KEY.
   That answer was never remembered, so five call sites re-asked on every warm
   and one page load fired ~25 requests at an endpoint that had already said
   no — burying real console errors underneath.

   These tests assert the collapse happens, that it is IN-FLIGHT ONLY (never a
   stale-candle cache), and that each caller still owns its own rows array.
   Run: node tests/test-request-coalescing.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* A fetch stub that counts calls per URL and resolves on a later turn, so a
   burst of callers is genuinely concurrent and the in-flight window is real. */
function slowFetch(bodyFor){
  const urls = [];
  const fn = function(url){
    urls.push(String(url));
    return new Promise(function(resolve){
      setTimeout(function(){
        const b = bodyFor(String(url));
        if (b === null){ resolve({ ok: false, status: 500, json: async function(){ return null; } }); return; }
        resolve({ ok: true, status: 200, json: async function(){ return b; } });
      }, 5);
    });
  };
  fn.urls = urls;
  fn.count = function(needle){
    return urls.filter(function(u){
      const d = (function(){ try{ return decodeURIComponent(u); }catch(e){ return u; } })();
      return u.indexOf(needle) >= 0 || d.indexOf(needle) >= 0;
    }).length;
  };
  return fn;
}

function makeCtx(extra){
  return vm.createContext(Object.assign(Object.create(null), {
    console: console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    AbortController: AbortController, Promise: Promise, Date: Date, Math: Math, JSON: JSON
  }, extra || {}));
}

/* ======================================================================
   1) xuCandles — the venue candle router
   ====================================================================== */
{
  const SRC = readFileSync(path.join(root, 'xuniverse.js'), 'utf8');
  const CANDLES = [
    { time: 1700000000000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    { time: 1700014400000, open: 1.5, high: 2.5, low: 1, close: 2, volume: 11 },
    { time: 1700028800000, open: 2, high: 3, low: 1.5, close: 2.5, volume: 12 }
  ];
  const f = slowFetch(function(u){
    if (u.indexOf('candlesticks') >= 0 || u.indexOf('/api/coindcx/') >= 0) return { data: CANDLES };
    return null;
  });
  const ctx = makeCtx({ window: {}, fetch: f });
  vm.runInContext(SRC, ctx, { filename: 'xuniverse.js' });
  const W = ctx.window;
  /* no binanceKlines on the window -> the thin-rows fallback stays a no-op,
     so every fetch counted below belongs to the CoinDCX leg itself */
  const item = { sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' };

  const burst = await Promise.all([
    W.xuCandles(item, '4h', 3),
    W.xuCandles(item, '4h', 3),
    W.xuCandles(item, '4h', 3)
  ]);
  assert(f.count('pair=B-XRP_USDT') === 1,
    'xuCandles: three concurrent callers for the same contract share ONE fetch, got ' + f.count('pair=B-XRP_USDT'));
  assert(burst[0].length === 3 && burst[1].length === 3 && burst[2].length === 3,
    'xuCandles: every coalesced caller still receives the full row set');
  assert(burst[0][0].t === 1700000000 && burst[0][0].c === 1.5,
    'xuCandles: coalescing leaves the {t(seconds),o,h,l,c,v} contract untouched');

  /* each caller owns its array — strats.js pops the unclosed tail bar off the
     rows it receives, and one layer trim must never shorten another */
  assert(burst[0] !== burst[1] && burst[1] !== burst[2],
    'xuCandles: coalesced callers get separate array objects, not one shared array');
  burst[0].pop();
  assert(burst[1].length === 3 && burst[2].length === 3,
    'xuCandles: one caller trimming its rows does not shorten another caller');

  /* in-flight ONLY: once settled the next call must go back to the network,
     because candles have to stay live */
  await W.xuCandles(item, '4h', 3);
  assert(f.count('pair=B-XRP_USDT') === 2,
    'xuCandles: a call AFTER the burst settles refetches — in-flight guard, never a stale cache');

  /* different contracts are never confused for one another */
  const other = { sym: 'B-SOL_USDT', base: 'SOL', exchange: 'coindcx' };
  await Promise.all([W.xuCandles(item, '4h', 3), W.xuCandles(other, '4h', 3)]);
  assert(f.count('pair=B-XRP_USDT') === 3 && f.count('pair=B-SOL_USDT') === 1,
    'xuCandles: two different contracts in the same instant stay two separate fetches');

  /* same contract, different timeframe = different series */
  const before = f.count('pair=B-XRP_USDT');
  await Promise.all([W.xuCandles(item, '4h', 3), W.xuCandles(item, '1h', 3)]);
  assert(f.count('pair=B-XRP_USDT') - before === 2,
    'xuCandles: same contract on two timeframes is not collapsed into one');
}

/* ======================================================================
   2) binance.js — __binFetchJson, every fapi read in the app
   ====================================================================== */
{
  const SRC = readFileSync(path.join(root, 'binance.js'), 'utf8');
  const KL = [[1700000000000, '1', '2', '0.5', '1.5', '10', 0, 0, 0, 0, 0, 0]];
  const f = slowFetch(function(u){ return u.indexOf('/klines') >= 0 ? KL : null; });
  const ctx = makeCtx({ window: {}, fetch: f });
  vm.runInContext(SRC, ctx, { filename: 'binance.js' });

  const rows = await Promise.all([
    ctx.binanceKlines('BTCUSDT', '4h', 5),
    ctx.binanceKlines('BTCUSDT', '4h', 5),
    ctx.binanceKlines('BTCUSDT', '4h', 5)
  ]);
  assert(f.count('symbol=BTCUSDT') === 1,
    'binanceKlines: three concurrent callers share ONE fapi request, got ' + f.count('symbol=BTCUSDT'));
  assert(rows[0].length === 1 && rows[0][0].t === 1700000000 && rows[0][0].c === 1.5,
    'binanceKlines: the coalesced answer keeps the row contract');

  /* two different symbols in the same instant must stay two requests —
     the guard keys on the URL, it does not merge unrelated reads */
  await Promise.all([
    ctx.binanceKlines('ETHUSDT', '4h', 5),
    ctx.binanceKlines('SOLUSDT', '4h', 5)
  ]);
  assert(f.count('symbol=ETHUSDT') === 1 && f.count('symbol=SOLUSDT') === 1,
    'binanceKlines: different symbols are never collapsed into one another');
}

/* ======================================================================
   3) macro.js — /api/fred 503 latches for the session
   ====================================================================== */
{
  const SRC = readFileSync(path.join(root, 'macro.js'), 'utf8');
  let hits = 0;
  const ctx = makeCtx({
    window: {},
    fetch: function(url){
      if (String(url).indexOf('/api/fred') < 0){
        return Promise.resolve({ ok: false, status: 404, json: async function(){ return null; } });
      }
      hits++;
      return Promise.resolve({ ok: false, status: 503, json: async function(){ return { error: 'fred not configured' }; } });
    }
  });
  vm.runInContext(SRC, ctx, { filename: 'macro.js' });

  const first = await ctx.__fredSeries('DGS10', 30);
  assert(first === null, 'fred: an unconfigured server yields null — never a fabricated series');
  assert(hits === 1, 'fred: the first call does ask, got ' + hits);

  await ctx.__fredSeries('DGS10', 30);
  await ctx.__fredSeries('DTWEXBGS', 30);
  await ctx.__fredSeries('DFII10', 30);
  await ctx.__fredSeries('T10YIE', 30);
  assert(hits === 1,
    'fred: 503 latches for the session — four later series ask ZERO times, got ' + (hits - 1) + ' extra');
}

/* a NON-503 failure must NOT latch: that one is transient and the next warm
   should try again */
{
  const SRC = readFileSync(path.join(root, 'macro.js'), 'utf8');
  let hits = 0;
  const ctx = makeCtx({
    window: {},
    fetch: function(url){
      if (String(url).indexOf('/api/fred') < 0){
        return Promise.resolve({ ok: false, status: 404, json: async function(){ return null; } });
      }
      hits++;
      return Promise.resolve({ ok: false, status: 502, json: async function(){ return null; } });
    }
  });
  vm.runInContext(SRC, ctx, { filename: 'macro.js' });
  await ctx.__fredSeries('DGS10', 30);
  await ctx.__fredSeries('DTWEXBGS', 30);
  assert(hits === 2,
    'fred: a transient 502 does NOT latch — the next series still asks, got ' + hits + ' calls');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL REQUEST-COALESCING TESTS PASSED');
