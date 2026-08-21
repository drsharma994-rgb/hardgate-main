/* HARDGATE — desk-scan-universe.js unit tests (Node 18+, no network). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = ctx;
vm.runInContext(readFileSync(path.join(root, 'desk-scan-universe.js'), 'utf8'), ctx, { filename: 'desk-scan-universe.js' });
const G = ctx;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

assert(typeof G.hgDeskLoadUniverse === 'function', 'exports hgDeskLoadUniverse');
assert(typeof G.hgDeskLoadDeltaCoinDCX === 'function', 'exports hgDeskLoadDeltaCoinDCX');
assert(G.hgDeskMinTurnover() === 5e6, 'default turnover floor $5M');

/* xu path: no cap, turnover filter */
{
  G.xuUniverse = async function(){
    return [
      { sym: 'BTCUSD', base: 'BTC', exchange: 'delta', turnoverUsd: 100e6 },
      { sym: 'B-ETH_USDT', base: 'ETH', exchange: 'coindcx', turnoverUsd: 50e6 },
      { sym: 'SHIBUSDT', base: 'SHIB', exchange: 'binance', turnoverUsd: 2e6 },
      { sym: 'B-NEW_USDT', base: 'NEW', exchange: 'coindcx', turnoverUsd: null }
    ];
  };
  G.xuUniverseNote = function(){ return null; };
  const pack = await G.hgDeskLoadUniverse({ force: true });
  assert(pack.source === 'xu', 'uses xuUniverse when present');
  assert(pack.filteredLen === 3, 'keeps ≥$5M + unknown-turnover CoinDCX row (3 symbols)');
  assert(pack.venueCounts.delta === 1 && pack.venueCounts.coindcx === 2 && pack.venueCounts.binance === 0,
         'venue counts split correctly (SHIB below floor excluded)');
  const dcx = await G.hgDeskLoadDeltaCoinDCX({ force: true });
  assert(dcx.items.length === 3 && dcx.venueCounts.delta === 1 && dcx.venueCounts.coindcx === 2,
         'hgDeskLoadDeltaCoinDCX keeps only Delta + CoinDCX rows');
}

/* binance fallback when xu absent */
{
  const ctx2 = vm.createContext(Object.create(null));
  ctx2.window = ctx2;
  vm.runInContext(readFileSync(path.join(root, 'desk-scan-universe.js'), 'utf8'), ctx2, { filename: 'desk-scan-universe.js' });
  ctx2.binancePerpUniverse = async function(){ return ['AAAUSDT', 'BBBUSD']; };
  ctx2.binanceTickers24h = async function(){
    return { AAAUSDT: { turnoverUsd: 10e6 }, BBBUSD: { turnoverUsd: 1e6 } };
  };
  const pack2 = await ctx2.hgDeskLoadUniverse();
  assert(pack2.source === 'binance', 'falls back to binance legs');
  assert(pack2.items.length === 1 && pack2.items[0].sym === 'AAAUSDT', 'binance fallback respects turnover floor');
}

/* THE BINANCE LEG MUST SPEAK BINANCE.

   hgDeskFetchKlines prefers xuCandles for any non-Binance row, and falls back
   to Binance when xuCandles has not loaded yet (script order) or when the row
   carries no exchange tag. That fallback used item.sym FIRST and only built
   base+USDT when sym was missing — so a CoinDCX row reaching it asked fapi for
   symbol=B-XRP_USDT, which Binance can never resolve. Observed live on the
   deployed desk: B-XRP_USDT and B-SOL_USDT 4h klines, both dead on arrival.

   item.sym is now used ONLY when the row is already a Binance row. */
{
  assert(G.hgDeskBinanceSym({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }) === 'XRPUSDT',
         'binance leg: CoinDCX row -> XRPUSDT, never the venue code B-XRP_USDT');
  assert(G.hgDeskBinanceSym({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }) === 'BTCUSDT',
         'binance leg: Delta row -> BTCUSDT, never the venue code BTCUSD');
  assert(G.hgDeskBinanceSym({ sym: 'SOLUSDT', base: 'SOL', exchange: 'binance' }) === 'SOLUSDT',
         'binance leg: a Binance row keeps its own symbol');
  assert(G.hgDeskBinanceSym({ sym: 'B-SOL_USDT', exchange: 'coindcx' }) === 'SOLUSDT',
         'binance leg: no base tag -> base derived from the CoinDCX code, not shipped as-is');
  assert(G.hgDeskBinanceSym({ sym: 'BTCUSD' }) === 'BTCUSDT',
         'binance leg: no exchange tag at all -> still mapped, never passed through raw');
  assert(G.hgDeskBinanceSym({}) === null && G.hgDeskBinanceSym(null) === null,
         'binance leg: nothing to map -> null, so no request is made at all');

  /* end to end: the row that caused the live failure, with xuCandles absent
     so the Binance fallback is the path actually taken */
  const ctx3 = vm.createContext(Object.create(null));
  ctx3.window = ctx3;
  vm.runInContext(readFileSync(path.join(root, 'desk-scan-universe.js'), 'utf8'), ctx3, { filename: 'desk-scan-universe.js' });
  const asked = [];
  ctx3.binanceKlines = async function(sym){ asked.push(sym); return [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }]; };
  const out = await ctx3.hgDeskFetchKlines({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }, '4h', 120);
  assert(asked.length === 1 && asked[0] === 'XRPUSDT',
         'binance fallback asks fapi for XRPUSDT, got ' + JSON.stringify(asked));
  assert(out.length === 1, 'binance fallback still returns the rows it received');

  /* the venue leg is preferred and untouched when xuCandles is present */
  const ctx4 = vm.createContext(Object.create(null));
  ctx4.window = ctx4;
  vm.runInContext(readFileSync(path.join(root, 'desk-scan-universe.js'), 'utf8'), ctx4, { filename: 'desk-scan-universe.js' });
  let venueCalls = 0, binCalls = 0;
  ctx4.xuCandles = async function(){ venueCalls++; return [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }]; };
  ctx4.binanceKlines = async function(){ binCalls++; return []; };
  await ctx4.hgDeskFetchKlines({ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'coindcx' }, '4h', 120);
  assert(venueCalls === 1 && binCalls === 0,
         'venue leg still wins when xuCandles is loaded — Binance is never consulted');
}

assert(G.hgDeskVenueChipHTML({ exchange: 'delta' }).indexOf('DELTA') > 0, 'venue chip for delta');
assert(G.hgDeskVenueChipHTML({ exchange: 'binance' }) === '', 'no chip for binance primary');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL DESK-SCAN-UNIVERSE TESTS PASSED');
