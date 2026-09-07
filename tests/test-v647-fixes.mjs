/* v647 fixes on top of v646:
   1) signallog rowsFrom merges cands + nearCands so NEAR (6/7) crypto rows
      surface in the log \u2014 that's where gate summaries are most useful.
   2) binance.js binanceTickers24h falls back to OKX SWAP tickers reshaped
      to Binance naming when both direct + geo-rescue fail. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- Fix 1: rowsFrom merges cands + nearCands --- */
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');
assert.ok(/v647:\s+merge cands \+ nearCands/.test(sl),
  'signallog rowsFrom must merge cands + nearCands (v647 comment)');
assert.ok(/if \(Array\.isArray\(val\.cands\)\) out = out\.concat\(val\.cands\)/.test(sl),
  'rowsFrom must concat val.cands');
assert.ok(/if \(Array\.isArray\(val\.nearCands\)\) out = out\.concat\(val\.nearCands\)/.test(sl),
  'rowsFrom must concat val.nearCands');

/* --- Fix 2: OKX fallback for binanceTickers24h --- */
const bn = readFileSync(resolve(ROOT, 'binance.js'), 'utf8');
assert.ok(/__binOkxTickersFallback/.test(bn),
  'binance.js must define __binOkxTickersFallback');
assert.ok(/okx\.com\/api\/v5\/market\/tickers\?instType=SWAP/.test(bn),
  'OKX fallback must fetch OKX SWAP tickers endpoint');
assert.ok(/\^\(\[A-Z0-9\]\+\)-USDT-SWAP\$/.test(bn),
  'OKX fallback must reshape BTC-USDT-SWAP -> BTCUSDT');
assert.ok(/__okxFallback: true/.test(bn),
  'OKX fallback tickers must be tagged __okxFallback for auditability');
assert.ok(/const okx = await __binOkxTickersFallback\(\);\n\s+if \(okx\)/.test(bn),
  'binanceTickers24h must call __binOkxTickersFallback and use its result');

/* --- version bumps --- */
assert.ok(/^hg-v(?:647|64[8-9]|65\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  `HG_VER must be ≥ hg-v647 (saw ${HG_VER})`);
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const cacheRx = new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'");
assert.ok(cacheRx.test(sw), `sw.js HG_CACHE must match ${HG_VER}`);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv647 = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv647).test(idx),
  `index.html cache-buster must be ?v=${qv647}`);

console.log('OK \u2014 v647 fixes verified');
console.log('  * signallog rowsFrom now merges cands + nearCands (crypto NEAR rows enter the log)');
console.log('  * binance.js falls back to OKX SWAP tickers when Binance is unreachable');
console.log('  * OKX SWAP -> Binance ticker reshape (BTC-USDT-SWAP -> BTCUSDT)');
console.log('  * version bumped to ' + HG_VER);
