/* v656: stop the app-wide hard-coded 10-min auto-refresh.

   Prior state: HG_AUTO_REFRESH_HARDCODED_MS forced the segmented AUTO
   control to 10 minutes on every reload, and rejected any click on
   OFF / 2m / 3m / 5m / 15m via the coercion inside setAutoRefresh().

   Post-v656: HG_AUTO_REFRESH_HARDCODED_MS = 0 disables both behaviors:
     * boot no longer force-enables auto-refresh
     * setAutoRefresh() no longer coerces to the hardcoded value
       (the existing 'if HG_AUTO_REFRESH_HARDCODED_MS > 0' guard now
       evaluates false, so the user's picked ms wins)

   The header chip is updated to reflect the new reality:
     * label 'AUTO 10m' -> 'AUTO'
     * title text no longer claims 'locked at 10 minutes'
     * OFF button carries class="on" so the visual default is OFF
     * 10m button no longer carries class="on"

   ALERTS-forced auto-refresh (HG_ALERTS_FORCED_ON path) is unaffected;
   turning ALERTS on still arms the alert cycle. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* --- hardcoded value must be 0 --- */
assert.ok(/const HG_AUTO_REFRESH_HARDCODED_MS = 0;/.test(idx),
  'HG_AUTO_REFRESH_HARDCODED_MS must be set to 0 to unlock the AUTO control');
/* the intent comment must be preserved so future edits know why */
assert.ok(/v656: user asked to stop the 10-minute auto-refresh/.test(idx),
  'the v656 intent comment must remain so future edits know the rationale');

/* --- HG_GLOBAL_SCAN_MS should still be 10 min (used by ttl + alerts) --- */
assert.ok(/const HG_GLOBAL_SCAN_MS = 10 \* 60 \* 1000;/.test(idx),
  'HG_GLOBAL_SCAN_MS remains 10 min (still used by candle TTL and alerts cadence)');

/* --- header chip label + title updated --- */
assert.ok(/<span class="hgalabel">AUTO<\/span>/.test(idx),
  'label must be "AUTO" (no longer "AUTO 10m")');
assert.ok(!/hgalabel">AUTO 10m/.test(idx),
  'stale "AUTO 10m" label must be gone');
assert.ok(/title="auto hard refresh \u2014 pick a cadence or leave OFF \(v656: no longer locked to 10 min\)/.test(idx),
  'chip title must reflect the unlocked state');
assert.ok(!/locked at 10 minutes/.test(idx),
  '"locked at 10 minutes" wording must be gone');

/* --- OFF button is the visual default (class=on); 10m no longer default --- */
assert.ok(
  /<button id="autoRefOff" class="on" type="button" onclick="setAutoRefresh\('off'\)">OFF<\/button>/.test(idx),
  'OFF button must carry class="on" to reflect the new default');
assert.ok(
  !/<button id="autoRef600000" class="on"/.test(idx),
  '10m button must NOT carry class="on" anymore');

/* --- setAutoRefresh coercion guard still exists (unchanged) --- */
/* The guard checks `HG_AUTO_REFRESH_HARDCODED_MS > 0`; with the value now 0,
   the branch is skipped at runtime but the code shape is unchanged. We only
   assert the guard is still shaped correctly \u2014 no accidental hard delete. */
assert.ok(
  /if \(typeof HG_AUTO_REFRESH_HARDCODED_MS === 'number' && HG_AUTO_REFRESH_HARDCODED_MS > 0\)\{[\s\S]*?ms = HG_AUTO_REFRESH_HARDCODED_MS;/.test(idx),
  'setAutoRefresh coercion guard must be preserved (branch inert while value = 0)');

/* --- ALERTS-forced path is untouched --- */
assert.ok(/if \(HG_ALERTS_FORCED_ON\)\{[\s\S]{0,400}armAlertCycle\(\);/.test(idx),
  'HG_ALERTS_FORCED_ON boot branch must remain \u2014 alerts still auto-arm when turned on');

/* --- version --- */
assert.ok(/^hg-v(?:656|65[7-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v656 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v656: 10-min hardcoded auto-refresh disabled');
console.log('  * HG_AUTO_REFRESH_HARDCODED_MS is 0 (no forced 10m; OFF works)');
console.log('  * boot no longer re-enables auto-refresh on every reload');
console.log('  * header chip label AUTO 10m \u2192 AUTO; title updated');
console.log('  * OFF is the visual default; 10m no longer marked ON');
console.log('  * setAutoRefresh coercion guard preserved (inert at value = 0)');
console.log('  * ALERTS-forced auto-arm path unchanged');
console.log('  * version bumped to ' + HG_VER);
