/* HARDGATE — ask Binance for dated contracts only where dated contracts exist.

   THE DEFECT THIS GUARDS.
   Binance lists quarterly futures for exactly two pairs — BTCUSDT and
   ETHUSDT. Verified against live /fapi/v1/exchangeInfo: 698 PERPETUAL and
   170 TRADIFI_PERPETUAL symbols, but only 2 CURRENT_QUARTER and 2
   NEXT_QUARTER.

   binanceBasis asked for CURRENT_QUARTER / NEXT_QUARTER on whatever pair it
   was handed, and the TERM BASIS tab handed it the top twelve perps by
   turnover. Ten of those twelve have no quarterlies, so each cost two
   requests Binance can only answer

       400 {"code":-4104,"msg":"Invalid contract type."}

   — twenty dead requests per scan. The tab then counted those ten pairs as
   "incomplete", which reads as the venue being flaky rather than as the tab
   asking for contracts that were never listed. SOLUSDT was hardcoded in
   SEED_PAIRS and could never have produced a row.

   Neither binanceBasis nor universePairs had a single test, which is how it
   survived. Both are covered here.
   Run: node tests/test-dated-futures-gate.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* The real shape of /fapi/v1/exchangeInfo, trimmed: dated symbols carry a
   `pair` plus a contractType, and the perps far outnumber them. */
const EXCHANGE_INFO = { symbols: [
  { symbol: 'BTCUSDT',        pair: 'BTCUSDT', contractType: 'PERPETUAL',       quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'ETHUSDT',        pair: 'ETHUSDT', contractType: 'PERPETUAL',       quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'SOLUSDT',        pair: 'SOLUSDT', contractType: 'PERPETUAL',       quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'XRPUSDT',        pair: 'XRPUSDT', contractType: 'PERPETUAL',       quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'XAUUSDT',        pair: 'XAUUSDT', contractType: 'TRADIFI_PERPETUAL', quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'BTCUSDT_260327', pair: 'BTCUSDT', contractType: 'CURRENT_QUARTER', quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'ETHUSDT_260327', pair: 'ETHUSDT', contractType: 'CURRENT_QUARTER', quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'BTCUSDT_260626', pair: 'BTCUSDT', contractType: 'NEXT_QUARTER',    quoteAsset: 'USDT', status: 'TRADING' },
  { symbol: 'ETHUSDT_260626', pair: 'ETHUSDT', contractType: 'NEXT_QUARTER',    quoteAsset: 'USDT', status: 'TRADING' }
]};

const BASIS_ROW = [{
  indexPrice: '75645.6', contractType: 'CURRENT_QUARTER', basisRate: '0.0038',
  futuresPrice: '75930.7', annualizedBasisRate: '0.0377', basis: '285.1',
  pair: 'BTCUSDT', timestamp: 1787299200000
}];

/* The live 400 body, so the test fails the way production did if the gate
   ever comes off. */
const INVALID_CONTRACT = { code: -4104, msg: 'Invalid contract type.' };

function loadBinance(fetchStub){
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, AbortController, Promise, Date, Math, JSON,
    window: {}, fetch: fetchStub
  }));
  vm.runInContext(fs.readFileSync(path.join(root, 'binance.js'), 'utf8'), ctx, { filename: 'binance.js' });
  return ctx;
}

/* Records every URL. exchangeInfo answers; a basis call for a pair with no
   dated contract answers 400 exactly as Binance does. */
function recorder(opts){
  opts = opts || {};
  const urls = [];
  const fn = function(url){
    const u = String(url);
    urls.push(u);
    if (u.indexOf('exchangeInfo') >= 0){
      if (opts.exchangeInfoDown) return Promise.resolve({ ok: false, status: 500, json: async () => null });
      return Promise.resolve({ ok: true, status: 200, json: async () => EXCHANGE_INFO });
    }
    if (u.indexOf('futures/data/basis') >= 0){
      const pair = (u.match(/pair=([A-Z0-9]+)/) || [])[1];
      const type = (u.match(/contractType=([A-Z_]+)/) || [])[1];
      const dated = type !== 'PERPETUAL';
      if (dated && pair !== 'BTCUSDT' && pair !== 'ETHUSDT'){
        return Promise.resolve({ ok: false, status: 400, json: async () => INVALID_CONTRACT });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => BASIS_ROW });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => null });
  };
  fn.urls = urls;
  fn.basisCalls = function(){ return urls.filter(u => u.indexOf('futures/data/basis') >= 0); };
  return fn;
}

/* ======================================================================
   1) binanceDeliveryPairs reads the dated contracts out of exchangeInfo
   ====================================================================== */
{
  const f = recorder();
  const ctx = loadBinance(f);
  const cur = await ctx.binanceDeliveryPairs('CURRENT_QUARTER');
  assert(!!cur && cur.BTCUSDT === true && cur.ETHUSDT === true,
    'delivery pairs: BTCUSDT and ETHUSDT carry a current quarterly');
  assert(!cur.SOLUSDT && !cur.XRPUSDT,
    'delivery pairs: a perpetual-only pair is not listed as dated');
  assert(!cur.XAUUSDT,
    'delivery pairs: TRADIFI_PERPETUAL is a perp, not a quarterly');

  const nxt = await ctx.binanceDeliveryPairs('NEXT_QUARTER');
  assert(!!nxt && nxt.BTCUSDT === true && Object.keys(nxt).length === 2,
    'delivery pairs: NEXT_QUARTER is read separately from CURRENT_QUARTER');

  const before = f.urls.filter(u => u.indexOf('exchangeInfo') >= 0).length;
  await ctx.binanceDeliveryPairs('CURRENT_QUARTER');
  assert(f.urls.filter(u => u.indexOf('exchangeInfo') >= 0).length === before,
    'delivery pairs: the map is cached — no second exchangeInfo request');
}

/* ======================================================================
   2) binanceBasis does not ask where the contract does not exist
   ====================================================================== */
{
  const f = recorder();
  const ctx = loadBinance(f);

  const sol = await ctx.binanceBasis('SOLUSDT', 'CURRENT_QUARTER', '1h', 1);
  assert(sol === null, 'basis: a pair with no quarterly yields null');
  assert(f.basisCalls().length === 0,
    'basis: and costs ZERO requests — the 400 -4104 is never provoked, got ' + f.basisCalls().length);

  const btc = await ctx.binanceBasis('BTCUSDT', 'CURRENT_QUARTER', '1h', 1);
  assert(!!btc && !!btc.latest, 'basis: a listed pair still returns its curve leg');
  assert(Math.abs(btc.latest.annualizedBasisPct - 3.77) < 1e-9,
    'basis: wire decimal 0.0377 -> 3.77 percent units, contract unchanged');
  assert(f.basisCalls().length === 1, 'basis: exactly one request for the listed pair');

  /* PERPETUAL exists for every listed perp — it must never be gated away */
  const perp = await ctx.binanceBasis('SOLUSDT', 'PERPETUAL', '1h', 1);
  assert(!!perp && !!perp.latest, 'basis: PERPETUAL is not gated — every perp has one');
  assert(f.basisCalls().length === 2, 'basis: the perpetual leg did go out');

  /* lower case in, same answer — the gate compares uppercase */
  const lower = await ctx.binanceBasis('solusdt', 'current_quarter', '1h', 1);
  assert(lower === null, 'basis: a lower-case pair is gated too, not waved through');
}

/* exchangeInfo unreachable: attempt the call rather than invent "not listed" */
{
  const f = recorder({ exchangeInfoDown: true });
  const ctx = loadBinance(f);
  await ctx.binanceBasis('SOLUSDT', 'CURRENT_QUARTER', '1h', 1);
  assert(f.basisCalls().length === 1,
    'basis: with exchangeInfo down the call is attempted — an outage is not a verdict');
}

/* ======================================================================
   3) the TERM BASIS universe only offers pairs that can produce a curve
   ====================================================================== */
{
  const f = recorder();
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, AbortController, Promise, Date, Math, JSON,
    fetch: f
  }));
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'binance.js'), 'utf8'), ctx, { filename: 'binance.js' });
  ctx.binanceTickers24h = async function(){
    return {
      BTCUSDT: { symbol: 'BTCUSDT', turnoverUsd: 900e6 },
      ETHUSDT: { symbol: 'ETHUSDT', turnoverUsd: 400e6 },
      SOLUSDT: { symbol: 'SOLUSDT', turnoverUsd: 300e6 },
      XRPUSDT: { symbol: 'XRPUSDT', turnoverUsd: 200e6 }
    };
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'termbasis.js'), 'utf8'), ctx, { filename: 'termbasis.js' });

  const uni = await ctx.termBasisUniversePairs();
  assert(Array.isArray(uni.pairs), 'universe: returns a pairs array');
  assert(uni.pairs.length === 2 && uni.pairs.indexOf('BTCUSDT') >= 0 && uni.pairs.indexOf('ETHUSDT') >= 0,
    'universe: only the two pairs with BOTH quarterlies are scanned, got ' + JSON.stringify(uni.pairs));
  assert(uni.pairs.indexOf('SOLUSDT') < 0,
    'universe: SOLUSDT is dropped — it was a hardcoded seed that could never curve');
  assert(uni.filtered === 2 && uni.known === true,
    'universe: the dropped pairs are counted and reported, not silently lost');
}

/* exchangeInfo unreachable: keep the old behaviour rather than empty the tab */
{
  const f = recorder({ exchangeInfoDown: true });
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, AbortController, Promise, Date, Math, JSON,
    fetch: f
  }));
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'binance.js'), 'utf8'), ctx, { filename: 'binance.js' });
  ctx.binanceTickers24h = async function(){
    return { BTCUSDT: { symbol: 'BTCUSDT', turnoverUsd: 900e6 }, SOLUSDT: { symbol: 'SOLUSDT', turnoverUsd: 300e6 } };
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'termbasis.js'), 'utf8'), ctx, { filename: 'termbasis.js' });

  const uni = await ctx.termBasisUniversePairs();
  assert(uni.known === false, 'universe: an exchangeInfo outage is reported as unknown, never guessed');
  assert(uni.pairs.indexOf('SOLUSDT') >= 0 && uni.filtered === 0,
    'universe: with the listing unknown nothing is filtered — degrade, do not empty the tab');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL DATED-FUTURES GATE TESTS PASSED');
