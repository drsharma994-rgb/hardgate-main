/* v648 fixes on top of v647:
   1) api/proxy.js ALLOWED_HOSTS includes www.okx.com so the v647 OKX
      fallback can reach OKX through the same-origin proxy
   2) signallog.js caps brain at 200 rows per snapshot round
   3) signallog SOURCES iteration order puts crypto before brain */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const proxy = readFileSync(resolve(ROOT, 'api/proxy.js'), 'utf8');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* Fix 1 */
assert.ok(proxy.includes("'www.okx.com'"),
  "api/proxy.js ALLOWED_HOSTS must include 'www.okx.com'");
assert.ok(proxy.includes('v648 SMART $ fallback: OKX SWAP'),
  'v648 comment must be present in api/proxy.js');

/* Fix 2 */
assert.ok(/PER_ROUND_CAP\s*=\s*\{\s*brain:\s*200\s*\}/.test(sl),
  'signallog must cap brain at 200 rows per round');
assert.ok(/srcCount\[SOURCES\[s\]\]\s*>=\s*cap/.test(sl),
  'signallog must break loop when source hits its cap');

/* Fix 3 */
assert.ok(/SOURCES\s*=\s*\[\s*'cswing'\s*,\s*'cscalp'/.test(sl),
  "signallog SOURCES must start with cswing, cscalp");
assert.ok(/'brain'\s*\];/.test(sl),
  "signallog SOURCES must end with 'brain'");
assert.ok(/pulls = \[pullScan\('swingScan'\)/.test(sl),
  'pulls[] must start with swingScan (cswing) not pullBrain');
assert.ok(sl.includes('pullBrain()];'),
  'pulls[] must end with pullBrain()');

/* version */
assert.ok(/^hg-v(?:648|64[9]|65\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v648 (saw ' + HG_VER + ')');
const cacheRx = new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'");
assert.ok(cacheRx.test(sw), 'sw.js HG_CACHE must match ' + HG_VER);
const qv648 = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv648).test(idx),
  'index.html cache-buster must be ?v=' + qv648);

console.log('OK — v648 fixes verified');
console.log('  * api/proxy.js allowlist now includes www.okx.com');
console.log('  * signallog caps brain at 200 rows/round');
console.log('  * signallog SOURCES order puts crypto first, brain last');
console.log('  * version bumped to ' + HG_VER);
