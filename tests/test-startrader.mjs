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

{
  const ctx = makeCtx();
  load('startrader.js', ctx);
  const all = ctx.window.startraderAllContracts();
  ok(all.length >= 100, 'full catalog: crypto + metals + commodities + indices + fx + etf + shares (got ' + all.length + ')');
  ok(ctx.window.startraderContract('XAUUSD').klass === 'metal', 'XAUUSD tagged metal');
  ok(ctx.window.startraderContract('USOIL').klass === 'commodity', 'USOIL tagged commodity');
  ok(ctx.window.startraderContract('SPY').klass === 'etf', 'SPY tagged etf');
  ok(ctx.window.startraderContract('AAPL').klass === 'share', 'AAPL tagged share');
  ok(typeof ctx.window.startraderKlassGroups === 'function', 'startraderKlassGroups exported');
}

{
  const TAB = readFileSync(path.join(root, 'startradertab.js'), 'utf8');
  const IND = readFileSync(path.join(root, 'indicators.js'), 'utf8');
  const CG = readFileSync(path.join(root, 'cryptogates.js'), 'utf8');
  const ctx = makeCtx();
  vm.runInContext(IND, ctx, { filename: 'indicators.js' });
  vm.runInContext(CG, ctx, { filename: 'cryptogates.js' });
  ok(TAB.indexOf('stEdgeRun') > 0 && TAB.indexOf('stEdgeScanList') > 0,
    'startradertab: EDGE panel with local scan fallback');
  vm.runInContext(readFileSync(path.join(root, 'edge.js'), 'utf8'), ctx, { filename: 'edge.js' });
  vm.runInContext(TAB, ctx, { filename: 'startradertab.js' });
  const w = ctx.window;
  ok(typeof w.stSynthesize === 'function', 'stSynthesize exported');
  w.swingTryClean = function(){ return { dir: 'long', entry: 110, stop: 105, t1: 120, t2: 125, rr: 2 }; };
  w.scalpTryClean = function(){ return { dir: 'long', entry: 110, stop: 108, t1: 114, t2: 118, rr: 1.6 }; };
  var rows = [];
  for (var i = 0; i < 240; i++){
    var c = 100 + i * 0.05;
    rows.push({ t: 1700000000 + i * 14400, o: c, h: c + 0.2, l: c - 0.2, c: c, v: 1000 });
  }
  var setup = w.stSynthesize({ sym: 'BTCUSD', base: 'BTC', klass: 'crypto', label: 'Bitcoin' },
    rows, rows.slice(-120), rows.slice(-80), { symbol: 'BTCUSD', fundingPct: 0.01, mark: 110 });
  ok(setup && setup.dir === 'long' && setup.tier === 'HIGH', 'stSynthesize: mocked swing+scalp plans -> HIGH long');
  ok(w.stTierRank('PRIME') > w.stTierRank('WATCH'), 'stTierRank ordering');
  delete w.edgeScanList;
  delete w.edgeCardHTML;
  ok(w.stEdgeHasCore(), 'stEdgeHasCore true when edge primitives exist');
  ok(typeof w.stEdgeScanList === 'function', 'stEdgeScanList exported for fallback');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
