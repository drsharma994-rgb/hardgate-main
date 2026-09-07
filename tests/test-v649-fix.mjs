/* v649: swingTryNear and scalpTryNear now propagate gateMeta onto NEAR
   objects. Without this, cswing/cscalp SIGNAL LOG rows arrived with
   empty NOTE columns because c.gateMeta was undefined and c.strategy /
   c.stratKey are absent on NEAR rows. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const cg = readFileSync(resolve(ROOT, 'cryptogates.js'), 'utf8');

/* Extract swingTryNear and check gateMeta present in its returned near */
const swingNearBlock = cg.match(/function swingTryNear\([\s\S]{0,3000}?\n  \}/);
assert.ok(swingNearBlock, 'could not extract swingTryNear');
assert.ok(/gateMeta:\s*m\.gateMeta/.test(swingNearBlock[0]),
  'swingTryNear near object must include gateMeta: m.gateMeta');

/* Extract scalpTryNear and check gateMeta present */
const scalpNearBlock = cg.match(/function scalpTryNear\([\s\S]{0,3000}?\n  \}/);
assert.ok(scalpNearBlock, 'could not extract scalpTryNear');
assert.ok(/gateMeta:\s*m\.gateMeta/.test(scalpNearBlock[0]),
  'scalpTryNear near object must include gateMeta: m.gateMeta');

/* version */
assert.ok(/^hg-v(?:649|65\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v649 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const cacheRx = new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'");
assert.ok(cacheRx.test(sw), 'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK — v649: NEAR objects propagate gateMeta');
console.log('  * swingTryNear now sets gateMeta: m.gateMeta');
console.log('  * scalpTryNear now sets gateMeta: m.gateMeta');
console.log('  * SIGNAL LOG cswing/cscalp NOTE columns will finally show gate summaries');
console.log('  * version bumped to ' + HG_VER);
