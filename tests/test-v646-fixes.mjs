/* v646: three post-verification fixes
   1) signallog.js now pulls crypto SWING/SCALP (was only pulling GOLD variants)
   2) BIAS runBias() auto-normalises Delta<->CoinDCX sym on wrong exchange
   3) api/proxy.js geo-fallback tries a list of mirrors + treats Binance -1003
      "IP banned" body as a rate-ban that should serve stale cache */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* --- Fix 1: signallog crypto pullers --- */
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');
/* v648 reordered SOURCES so crypto comes first (brain moved to last). Just
   assert both cswing and cscalp are present anywhere in the list. */
assert.ok(/'cswing'/.test(sl) && /'cscalp'/.test(sl),
  "signallog SOURCES must include 'cswing' and 'cscalp'");
assert.ok(/pullScan\('swingScan'\)/.test(sl),
  "signallog must call pullScan('swingScan') for crypto SWING");
assert.ok(/pullScan\('scalpScan'\)/.test(sl),
  "signallog must call pullScan('scalpScan') for crypto SCALP");
assert.ok(/sl-badge\.cswing/.test(sl) && /sl-badge\.cscalp/.test(sl),
  'signallog CSS must include cswing/cscalp badge styles');

/* --- Fix 2: BIAS symbol normalization --- */
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
assert.ok(/DELTA_TO_CDCX\s*=\s*\{[^}]*'BTCUSD'\s*:\s*'B-BTC_USDT'/.test(idx),
  'runBias must have a Delta->CoinDCX inline map');
assert.ok(/CDCX_TO_DELTA\s*=\s*\{[^}]*'B-BTC_USDT'\s*:\s*'BTCUSD'/.test(idx),
  'runBias must have a CoinDCX->Delta inline map');
assert.ok(/if \(S\.exchange === 'coindcx' && DELTA_TO_CDCX\[sym\]\)/.test(idx),
  'runBias must translate Delta syms to CoinDCX when on CoinDCX');
assert.ok(/1D=\$\{d1\.length\}, 4H=\$\{h4\.length\}/.test(idx),
  'runBias must surface the actual candle counts in the error string');

/* --- Fix 3: proxy geo-fallback list + banned-body detection --- */
const proxy = readFileSync(resolve(ROOT, 'api/proxy.js'), 'utf8');
assert.ok(/mirrorList = String\(process\.env\.HG_GEO_FALLBACK_HOST/.test(proxy),
  'api/proxy.js must read HG_GEO_FALLBACK_HOST as a comma-separated list');
assert.ok(/for \(let mi = 0; mi < mirrorList\.length; mi\+\+\)/.test(proxy),
  'api/proxy.js must iterate the mirror list');
assert.ok(/-1003\|IP\\\(\.\*\\\) banned/.test(proxy),
  'api/proxy.js must skip a mirror whose body reports Binance -1003 rate-ban');
assert.ok(/binanceBanned = \/\(\^\|\\\.\)binance\\.com\$\/\.test\(target\.hostname\) && \/"code":\\s\*-1003\//.test(proxy),
  'api/proxy.js must detect Binance -1003 banned body on ok=true responses');
assert.ok(/if \(upstream\.ok && !binanceBanned\) cacheSet/.test(proxy),
  'api/proxy.js must NOT cache a Binance -1003 banned body');

/* --- version bumps --- */
const stamp = readFileSync(resolve(ROOT, 'build-stamp.js'), 'utf8');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
/* v647: read through the helper so version bumps don't break this suite. */
const { HG_VER } = await import('./helpers/build-version.mjs');
assert.ok(/^hg-v(?:646|64[7-9]|65\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  `build-stamp.js version must be ≥ hg-v646 (saw ${HG_VER})`);
const cacheRx646 = new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'");
assert.ok(cacheRx646.test(sw), `sw.js HG_CACHE must match build-stamp version ${HG_VER}`);
const qv = HG_VER.replace(/^hg-v/, '');
const cbRx = new RegExp('build-stamp\\.js\\?v=' + qv);
assert.ok(cbRx.test(idx), `index.html cache-buster must be ?v=${qv}`);

console.log('OK \u2014 v646 post-verification fixes verified');
console.log('  * signallog now pulls crypto SWING/SCALP so gate summaries can surface');
console.log('  * runBias auto-normalizes Delta<->CoinDCX symbols + surfaces exact counts');
console.log('  * api/proxy.js geo-fallback tries multiple mirrors + detects -1003 rate-bans');
console.log('  * version on ' + HG_VER + ' (≥ hg-v646 for these fixes)');
