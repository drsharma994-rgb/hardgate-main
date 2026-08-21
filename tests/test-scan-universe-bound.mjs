/* HARDGATE — dual venue is both exchanges at the configured depth, not
   "scan every name on both books".

   THE DEFECT THIS GUARDS.
   hgScanWholeExchange ORed hgDualScanEnabled(), which is on by default, and
   SCAN WHOLE EXCHANGE was checked in the SWING / SCALP / BEST markup. Opening
   any of those tabs therefore fetched ~220 Delta + ~500 CoinDCX candles per
   scan (and CoinDCX tickers carried turnoverUsd: 0, so even an unchecked box
   never sliced). The 5-minute all-tab refresh restarted that work before
   FORMING NOW / WHY EMPTY could paint. The reader saw "zero setups" on
   SWING, SCALP, EDGE and BEST even when the tape had 5/7 watch rows.

   G1–G7 are not loosened here. A finished top-N scan may still print 0 CLEAN.
   What it must not do is refuse to finish.

   Run: node tests/test-scan-universe-bound.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const HTML = read('index.html');
const EDGE = read('edge.js');

function extractFn(src, name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced ' + name);
}

function bootBound(){
  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String };
  ctx.window = ctx;
  ctx.localStorage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  vm.runInContext(
    extractFn(HTML, 'hgDualScanEnabled') + '\n'
    + extractFn(HTML, 'hgBoundScanUniverse') + '\n'
    + extractFn(HTML, 'hgScanWholeExchange') + '\n',
    ctx
  );
  return ctx;
}

console.log('== dual venue is not whole-exchange ==');
{
  ok(/function hgBoundScanUniverse\(/.test(HTML), 'hgBoundScanUniverse exists');
  const fn = extractFn(HTML, 'hgScanWholeExchange');
  ok(!/hgDualScanEnabled\(\)/.test(fn),
     'hgScanWholeExchange does not treat dual-scan as scan-all');
  ok(/forceScanAll/.test(fn) && /checkboxEl/.test(fn),
     'whole-exchange is still opt-in via checkbox or forceScanAll');
  ok(/function hgDualScanEnabled\(/.test(HTML), 'dual-scan helper still exists');
  ok(/HG_DUAL_CRYPTO_EX = \['delta', 'coindcx'\]/.test(HTML),
     'default dual venue is still Delta + CoinDCX');
}

console.log('== SCAN WHOLE EXCHANGE is off until the reader asks ==');
{
  ok(!/<input id="swingAll"[^>]*checked/.test(HTML), 'SWING whole-exchange default off');
  ok(!/<input id="scalpAll"[^>]*checked/.test(HTML), 'SCALP whole-exchange default off');
  ok(!/<input id="bestAll"[^>]*checked/.test(HTML), 'BEST whole-exchange default off');
  ok(/forceScanAll: true/.test(HTML), 'alert warm still covers the full book');
}

console.log('== bound universe: top N even when CoinDCX turnover is unknown ==');
{
  const W = bootBound();
  ok(W.hgDualScanEnabled() === true, 'dual scan defaults ON (no localStorage override)');
  ok(W.hgScanWholeExchange({}, { checked: false }) === false,
     'dual-scan ON + unchecked box is NOT whole-exchange');
  ok(W.hgScanWholeExchange({}, { checked: true }) === true,
     'checked box still scans the whole book');
  ok(W.hgScanWholeExchange({ forceScanAll: true }, { checked: false }) === true,
     'forceScanAll still wins (alert warm)');

  const cdcx = [];
  for (let i = 0; i < 120; i++){
    cdcx.push({ symbol: 'B-X' + i + '_USDT', turnoverUsd: 0, mark: NaN });
  }
  const sliced = W.hgBoundScanUniverse(cdcx, { scanAll: false, n: 20, exchange: 'coindcx' });
  ok(sliced.length === 20, 'CoinDCX with all-zero turnover still caps at N (got ' + sliced.length + ')');

  const delta = [
    { symbol: 'ILLIQUSD', turnoverUsd: 1000 },
    { symbol: 'BTCUSD', turnoverUsd: 2e9 },
    { symbol: 'ETHUSD', turnoverUsd: 1e9 },
    { symbol: 'SOLUSD', turnoverUsd: 5e8 }
  ];
  const top = W.hgBoundScanUniverse(delta, { scanAll: false, n: 5, minTurn: 200000, exchange: 'delta' });
  ok(top.length === 3 && top[0].symbol === 'BTCUSD' && top[1].symbol === 'ETHUSD'
     && !top.some(function(t){ return t.symbol === 'ILLIQUSD'; }),
     'Delta !scanAll is turnover-desc and respects minTurn (N floor is 5)');

  const all = W.hgBoundScanUniverse(delta, { scanAll: true, n: 2, minTurn: 200000, exchange: 'delta' });
  ok(all.length === 4 && all[0].symbol === 'BTCUSD',
     'scanAll keeps the full Delta book, still sorted');
}

console.log('== SWING/SCALP/BEST actually call the bound helper ==');
{
  ok(/hgBoundScanUniverse\(S\.tickers/.test(HTML), 'scan legs bound S.tickers through the helper');
  ok(/loadTickersCdcx[\s\S]{0,800}xuMergeCdcxMarks/.test(HTML)
     || /xuMergeCdcxMarks[\s\S]{0,400}loadTickersCdcx/.test(HTML)
     || /function loadTickersCdcx\(\)\{[\s\S]*xuMergeCdcxMarks/.test(HTML),
     'CoinDCX ticker load merges marks so top-N is by turnover');
}

console.log('== EDGE is capped so a $5M floor cannot dump 250+ names ==');
{
  const m = EDGE.match(/var MAX_UNIVERSE\s*=\s*(\d+)/);
  ok(m && +m[1] >= 40 && +m[1] <= 120,
     'EDGE MAX_UNIVERSE is a liquid cap (40–120), not 0=unlimited (got ' + (m && m[1]) + ')');
  ok(/if \(maxN > 0\) list = list\.slice\(0, maxN\)/.test(EDGE),
     'edgeScanList still slices when maxN is set');
}

console.log('== G1–G7 floors are untouched ==');
{
  const gates = read('cryptogates.js');
  ok(/var CG_SWING_RR_MIN = 2\.0;/.test(gates), 'swing R:R floor still 2.0');
  ok(/var CG_G1_SPREAD_ATR = 0\.25;/.test(gates), 'G1 spread still 0.25×ATR');
  ok(/var CG_G5_VZ_MIN = 0\.5;/.test(gates), 'G5 volZ still 0.5');
  ok(/var CG_SWING_ANCHOR_ATR = 1\.5;/.test(gates), 'anchor still 1.5×ATR');
}

console.log('== stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\n' + passed + ' assertions');
