/* HARDGATE — startrader.js + xuniverse Startrader/Binance-ext legs */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function makeCtx(extra){
  return vm.createContext(Object.assign(Object.create(null), {
    window: {}, console, setTimeout, clearTimeout
  }, extra || {}));
}
function load(pathRel, ctx){
  vm.runInContext(readFileSync(path.join(root, pathRel), 'utf8'), ctx, { filename: pathRel });
  return ctx.window;
}

{
  const w = load('startrader.js', makeCtx());
  ok(typeof w.startraderCatalog === 'function' && w.startraderCatalog().length >= 40,
     'catalog: 40+ STARTRADER USD crypto CFDs');
  ok(w.startraderBaseOf('DOGUSD') === 'DOGE', 'base map: DOGUSD -> DOGE');
  ok(w.startraderBinanceSym('LINK') === 'LINKUSDT', 'binance sym: LINK -> LINKUSDT');
  const rows = w.startraderNormRows({ BTCUSDT: { mark: 65000, turnoverUsd: 9e9 } });
  const btc = rows.filter(function(r){ return r.base === 'BTC'; })[0];
  ok(btc && btc.exchange === 'startrader' && btc.sym === 'BTCUSD' && btc.turnoverUsd === 9e9,
     'norm: BTC enriched from Binance tickers map');
}

{
  const XU = readFileSync(path.join(root, 'xuniverse.js'), 'utf8');
  const ST = readFileSync(path.join(root, 'startrader.js'), 'utf8');
  const ctx = makeCtx({ fetch: async function(){ return { ok: false, status: 500, json: async function(){ return null; } }; },
    AbortController: AbortController });
  vm.runInContext(ST, ctx, { filename: 'startrader.js' });
  vm.runInContext(XU, ctx, { filename: 'xuniverse.js' });
  const w = ctx.window;
  const tickers = { FOOUSDT: { mark: 1, turnoverUsd: 5000000 }, BTCUSDT: { mark: 2, turnoverUsd: 1e9 } };
  const ext = w.xuNormBinanceExt(tickers, { BTC: true });
  ok(ext.length === 1 && ext[0].base === 'FOO' && ext[0].exchange === 'binance',
     'binance ext: skips covered bases, keeps FOO');
  const merged = w.xuMergeLegs(
    [{ sym: 'DOGEUSD', base: 'DOGE', exchange: 'delta', turnoverUsd: 100, mark: 1, fundingPct: 0.01, oiUsd: null, oiContracts: null, alsoOn: null }],
    [{ sym: 'DOGUSD', base: 'DOGE', exchange: 'startrader', turnoverUsd: 50, mark: 2, fundingPct: null, oiUsd: null, oiContracts: null, alsoOn: null }]
  );
  ok(merged.length === 1 && merged[0].exchange === 'delta' && merged[0].alsoOn === 'DOGUSD',
     'merge legs: delta wins turnover; startrader sym in alsoOn');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
