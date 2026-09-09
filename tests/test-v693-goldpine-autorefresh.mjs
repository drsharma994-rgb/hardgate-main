/* v693: GOLD PINE tab auto-refreshes every 5 minutes while mounted.

   Mirrors the v691 NEW GOLD auto-refresh pattern precisely:
   * Cadence constant GOLDPINE_AUTO_REFRESH_MS = 5 * 60 * 1000
   * Timer + mountEl stored on module state (__goldPineTab)
   * Timer starts only on MOUNT (never module load) so Node test
     processes never hang on a stray interval.
   * Second mount clears the prior timer instead of stacking.
   * Self-heals when mount element leaves document.body.
   * Tick calls the SAME runScan the button uses. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- structural asserts --- */
const src = readFileSync(resolve(ROOT, 'goldpine.js'), 'utf8');
assert.ok(/var GOLDPINE_AUTO_REFRESH_MS = 5 \* 60 \* 1000;/.test(src),
  '5-minute refresh cadence constant');
assert.ok(/v693: auto-refresh cadence for GOLD PINE/.test(src),
  'v693 rationale comment at cadence constant');
assert.ok(/__timer: null, __mountEl: null/.test(src),
  'timer + mountEl fields on __goldPineTab state');
assert.ok(/v693: auto-refresh every 5 minutes while the tab is mounted/.test(src),
  'v693 mount rationale comment');
assert.ok(/setInterval\(function\(\)\{/.test(src),
  'setInterval wired at mount');
assert.ok(/clearInterval\(__goldPineTab\.__timer\)/.test(src),
  'clearInterval used to prevent timer stacking');
assert.ok(/document\.body\.contains\(__goldPineTab\.__mountEl\)/.test(src),
  'self-heal on unmount: check document.body.contains');
assert.ok(/typeof setInterval === 'function'/.test(src),
  'setInterval feature-checked (works in Node harness without DOM)');

/* --- self-healing pattern: check the timer clears + nulls both fields --- */
assert.ok(
  /if \(__goldPineTab\.__mountEl && !document\.body\.contains\(__goldPineTab\.__mountEl\)\)\{[\s\S]{0,500}?clearInterval\(__goldPineTab\.__timer\);\s*\n\s*__goldPineTab\.__timer = null;\s*\n\s*__goldPineTab\.__mountEl = null;/.test(src),
  'self-heal: clear interval + null both fields on unmount detection');

/* --- calls the SAME runScan as the button --- */
assert.ok(/try \{ runScan\(\); \} catch\(eTick\)\{\}/.test(src),
  'tick calls same runScan as button click');

/* --- guard: setInterval only appears inside mount() body --- */
{
  const setIntervalCount = (src.match(/setInterval/g) || []).length;
  /* One typeof check + one setInterval call = 2 mentions inside mount. */
  assert.ok(setIntervalCount <= 3,
    'setInterval only appears in mount() flow (' + setIntervalCount + ' mentions)');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:693|69[4-9]|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v693',
  'HG_VER must be >= hg-v693');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('goldpine\\.js\\?v=' + qv).test(idx),
  'index.html goldpine.js cache-buster = ?v=' + qv);

console.log('OK - v693: GOLD PINE auto-refresh every 5 minutes on mount');
console.log('  * cadence constant GOLDPINE_AUTO_REFRESH_MS = 5 * 60 * 1000');
console.log('  * timer + mountEl fields on __goldPineTab');
console.log('  * setInterval only inside mount()');
console.log('  * clearInterval prevents timer stacking on remount');
console.log('  * self-heals when mount element leaves DOM');
console.log('  * tick calls the same runScan as manual click');
console.log('  * version bumped to ' + HG_VER);
