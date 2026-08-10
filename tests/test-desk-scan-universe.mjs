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

assert(G.hgDeskVenueChipHTML({ exchange: 'delta' }).indexOf('DELTA') > 0, 'venue chip for delta');
assert(G.hgDeskVenueChipHTML({ exchange: 'binance' }) === '', 'no chip for binance primary');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL DESK-SCAN-UNIVERSE TESTS PASSED');
