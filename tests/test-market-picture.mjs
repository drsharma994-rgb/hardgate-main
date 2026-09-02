#!/usr/bin/env node
/* HARDGATE — MARKET PICTURE venue fallback (hg-v580)
   BTC/ETH/SOL 4H cascade must not die as :err when Delta candles abort.
   CoinDCX / xuCandles / Binance are honest fallbacks. Frames never invent a lean. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const stamp = fs.readFileSync(path.join(root, 'build-stamp.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

console.log('== source ==');
assert(/function hgMarketPictureBars\(/.test(html), 'index.html defines hgMarketPictureBars');
assert(/function hgMarketPictureLean\(/.test(html), 'index.html defines hgMarketPictureLean');
assert(/function marketPictureCheck\(/.test(html), 'index.html still owns marketPictureCheck');
assert(/hgMarketPictureBars\(label,\s*sym\)/.test(html), 'marketPictureCheck reads via hgMarketPictureBars');
assert(/getCandlesFor\(\s*['"]delta['"]/.test(html.match(/async function hgMarketPictureBars[\s\S]*?\nasync function marketPictureCheck/)?.[0] || html),
       'bars helper still tries Delta first');
assert(/exchange:\s*['"]coindcx['"]/.test(html.match(/async function hgMarketPictureBars[\s\S]*?\nasync function marketPictureCheck/)?.[0] || ''),
       'bars helper falls back to CoinDCX xuCandles');
assert(/B-['"]\s*\+\s*base\s*\+\s*['"]_USDT/.test(html) || /B-'\s*\+\s*base\s*\+\s*'_USDT'/.test(html),
       'CoinDCX twin is B-<BASE>_USDT');
assert(/binanceKlines/.test(html.match(/async function hgMarketPictureBars[\s\S]*?\nasync function marketPictureCheck/)?.[0] || ''),
       'bars helper falls back to Binance klines last');
assert(/:unread/.test(html.match(/async function marketPictureCheck[\s\S]*?\nasync function runMarketPictureUI/)?.[0] || ''),
       'unread tape is labelled :unread, not a silent invented lean');
assert(!/label\s*\+\s*':err'/.test(html.match(/async function marketPictureCheck[\s\S]*?\nasync function runMarketPictureUI/)?.[0] || 'label+\':err\''),
       'BTC:err Chromium/Delta miss is gone from MARKET PICTURE');

console.log('== lean (pure) ==');
{
  const m = html.match(/function hgMarketPictureLean\(closes\)\{[\s\S]*?\n\}/);
  assert(!!m, 'lean function extracts from index.html');
  const ind = fs.readFileSync(path.join(root, 'indicators.js'), 'utf8');
  const ctx = vm.createContext({ console });
  vm.runInContext(ind, ctx, { filename: 'indicators.js' });
  vm.runInContext(m[0], ctx, { filename: 'lean.js' });
  const lean = ctx.hgMarketPictureLean;
  assert(lean([]) === null && lean(null) === null, 'lean: empty/null -> null (never invents)');
  const shortN = [];
  for (let i = 0; i < 40; i++) shortN.push(100 + i);
  assert(lean(shortN) === null, 'lean: fewer than 50 closes -> null');
  const up = [];
  for (let i = 0; i < 80; i++) up.push(100 + i);
  assert(lean(up) === 'long', 'lean: rising cascade -> long (got ' + lean(up) + ')');
  const down = [];
  for (let i = 0; i < 80; i++) down.push(200 - i);
  assert(lean(down) === 'short', 'lean: falling cascade -> short (got ' + lean(down) + ')');
  const flat = [];
  for (let i = 0; i < 80; i++) flat.push(100);
  assert(lean(flat) === 'mixed', 'lean: flat tape (no cascade) -> mixed (got ' + lean(flat) + ')');
}

console.log('== bars fallback ==');
{
  const block = html.match(/async function hgMarketPictureBars\(label, deltaSym\)\{[\s\S]*?\n\}\n\nasync function marketPictureCheck/);
  assert(!!block, 'bars function extracts as a single block');
  const rows = [];
  const t0 = 1_700_000_000;
  for (let i = 0; i < 80; i++){
    rows.push({ t: t0 + i * 14400, o: 100, h: 101, l: 99, c: 100 + i * 0.1, v: 10 });
  }
  const calls = { delta: 0, xu: [], cdcx: 0, bin: 0 };
  const ctx = vm.createContext({
    console,
    getCandlesFor: async function(ex, sym){
      if (ex === 'delta'){ calls.delta++; throw new Error('signal is aborted without reason'); }
      if (ex === 'coindcx'){ calls.cdcx++; return rows; }
      return [];
    },
    xuCandles: async function(item){
      calls.xu.push(item && item.exchange);
      return [];
    },
    binanceKlines: async function(){ calls.bin++; return []; }
  });
  vm.runInContext('var window = this;\n' + block[0].replace(/\nasync function marketPictureCheck[\s\S]*$/, ''),
    ctx, { filename: 'bars.js' });
  const out = await ctx.hgMarketPictureBars('BTC', 'BTCUSD');
  assert(Array.isArray(out) && out.length >= 50, 'bars: Delta abort + CoinDCX rows -> bars returned');
  assert(calls.delta >= 1, 'bars: Delta was attempted first');
  assert(calls.cdcx >= 1, 'bars: CoinDCX getCandlesFor ran after Delta/xu miss');
  assert(calls.bin === 0, 'bars: Binance not consulted once CoinDCX filled');
}
{
  const block = html.match(/async function hgMarketPictureBars\(label, deltaSym\)\{[\s\S]*?\n\}\n\nasync function marketPictureCheck/);
  const calls = { n: 0 };
  const ctx = vm.createContext({
    console,
    getCandlesFor: async function(){ calls.n++; throw new Error('timeout'); },
    xuCandles: async function(){ calls.n++; return []; },
    binanceKlines: async function(){ calls.n++; throw new Error('451'); }
  });
  vm.runInContext('var window = this;\n' + block[0].replace(/\nasync function marketPictureCheck[\s\S]*$/, ''),
    ctx, { filename: 'bars.js' });
  const out = await ctx.hgMarketPictureBars('ETH', 'ETHUSD');
  assert(out === null, 'bars: every venue down -> null, never fabricated rows');
  assert(calls.n >= 3, 'bars: walked more than one venue before standing aside');
}

console.log('== stamp ==');
{
  const m = stamp.match(/version:\s*'([^']+)'/);
  assert(m && m[1] === HG_VER, 'build-stamp matches helper (' + HG_VER + ')');
  assert(swCacheOk(sw), 'sw.js HG_CACHE matches ' + HG_VER);
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
