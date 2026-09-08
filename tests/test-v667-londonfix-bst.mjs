/* v667: LONDON-FIX mechanic must fire during BST too.

   The London PM Fix is 15:00 LONDON local time. Prior to v667 the
   mechanic hard-coded hr === 15 || hr === 16 in UTC. That works
   during GMT (winter, London = UTC), but under BST (roughly late
   March to late October) London = UTC+1, so the 15:00 London fix
   bar lands at 14:00 UTC. Under BST hr === 14 in UTC, hr !== 15 &&
   hr !== 16 was true, and the mechanic returned null.

   Result: LONDON-FIX silently didn't fire for ~7 months of the year.

   Fix: resolve the LONDON local hour from the timestamp using
   Intl.DateTimeFormat (Europe/London). DST-aware in every modern
   runtime. Feature-checked with a widened UTC fallback (14..16). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- rationale comment must be present --- */
assert.ok(/v667: London PM Fix is 15:00 LONDON local time/.test(src),
  'v667 rationale comment must be present');
/* --- London-hour helper must be defined --- */
assert.ok(/function hgOgLondonHour\(t\)\{/.test(src),
  'hgOgLondonHour helper must be defined');
/* v668: helper delegates through hgOgLocalHour(t, tz); accept either the
   original inline shape ('Europe/London' literal) OR the delegated shape
   (a call like hgOgLocalHour(t, 'Europe/London')). Either way, Europe/London
   must appear somewhere in the source. */
assert.ok(/'Europe\/London'/.test(src),
  'source must reference Europe/London (inline or delegated)');
assert.ok(/parts\[i\]\.type === 'hour'/.test(src),
  'source must extract the hour part from formatToParts (in the helper or its delegate)');

/* --- hgOgLondonFix uses the LONDON hour first, then falls back --- */
assert.ok(/var lhr = hgOgLondonHour\(t\);/.test(src),
  'hgOgLondonFix must call hgOgLondonHour first');
assert.ok(/if \(isFinite\(lhr\)\)\{\s*inWindow = \(lhr === 15 \|\| lhr === 16\);/.test(src),
  'when London hour resolves, window is lhr === 15 || 16');
/* fallback widens the UTC window to 14..16 (was 15..16) */
assert.ok(/inWindow = \(uhr === 14 \|\| uhr === 15 \|\| uhr === 16\);/.test(src),
  'fallback UTC window must include 14 (BST fix hour) alongside 15, 16');

/* --- old strict UTC guard must be gone --- */
assert.ok(!/if \(hr !== 15 && hr !== 16\) return null;/.test(src),
  'stale strict UTC guard must be removed');

/* --- runtime demonstration: extract hgOgLondonHour and prove BST vs GMT.
   v668: hgOgLondonHour delegates to hgOgLocalHour, so if the delegated form
   is present we must also pull hgOgLocalHour into the extracted sandbox. */
const londonMatch = src.match(/function hgOgLondonHour\(t\)\{[\s\S]*?\n  \}/);
assert.ok(londonMatch, 'hgOgLondonHour body must be extractable');
const localMatch = src.match(/function hgOgLocalHour\(t, tz\)\{[\s\S]*?\n  \}/);
/* if the source has the delegate, include it in the sandbox */
const body = (localMatch ? (localMatch[0] + '\n') : '') + londonMatch[0];
const wrap = new Function('num', 'isFinite',
  body + '\nreturn hgOgLondonHour;');
const hgOgLondonHour = wrap(
  (v) => { var n = +v; return Number.isFinite(n) ? n : NaN; },
  Number.isFinite
);

/* Case A: BST midsummer \u2014 2026-07-01 14:00 UTC == 15:00 BST London */
{
  const utcMs = Date.UTC(2026, 6, 1, 14, 0, 0);  /* July 1 14:00 UTC */
  const lhr = hgOgLondonHour(utcMs / 1000);
  assert.equal(lhr, 15, 'July 1 14:00 UTC must be 15:00 London (BST)');
}
/* Case B: GMT midwinter \u2014 2026-01-15 15:00 UTC == 15:00 GMT London */
{
  const utcMs = Date.UTC(2026, 0, 15, 15, 0, 0);
  const lhr = hgOgLondonHour(utcMs / 1000);
  assert.equal(lhr, 15, 'Jan 15 15:00 UTC must be 15:00 London (GMT)');
}
/* Case C: BST 15:00 UTC == 16:00 London (still in the fix window) */
{
  const utcMs = Date.UTC(2026, 6, 1, 15, 0, 0);
  const lhr = hgOgLondonHour(utcMs / 1000);
  assert.equal(lhr, 16, 'July 1 15:00 UTC must be 16:00 London (BST)');
}
/* Case D: GMT 14:00 UTC == 14:00 London (OUT of the fix window in GMT) */
{
  const utcMs = Date.UTC(2026, 0, 15, 14, 0, 0);
  const lhr = hgOgLondonHour(utcMs / 1000);
  assert.equal(lhr, 14, 'Jan 15 14:00 UTC must be 14:00 London (GMT) \u2014 outside fix window');
}
/* Case E: non-finite t returns NaN */
{
  assert.ok(Number.isNaN(hgOgLondonHour(NaN)), 'NaN input returns NaN');
  assert.ok(Number.isNaN(hgOgLondonHour(null)), 'null input returns NaN');
}

/* --- Prove the window predicate matches the fix (behavioral) --- */
function inWindow(t){
  const lhr = hgOgLondonHour(t);
  if (Number.isFinite(lhr)) return lhr === 15 || lhr === 16;
  const uhr = Math.floor((t % 86400) / 3600);
  return uhr === 14 || uhr === 15 || uhr === 16;
}
/* BST 14:00 UTC MUST now qualify (pre-v667 did not) */
assert.ok(inWindow(Date.UTC(2026, 6, 1, 14, 0, 0) / 1000),
  'BST 14:00 UTC (= 15:00 London) MUST now qualify \u2014 the whole point of v667');
/* GMT 15:00 UTC still qualifies (regression) */
assert.ok(inWindow(Date.UTC(2026, 0, 15, 15, 0, 0) / 1000),
  'GMT 15:00 UTC (= 15:00 London) still qualifies');
/* GMT 14:00 UTC (= 14:00 London) must NOT qualify (correct: before fix window) */
assert.ok(!inWindow(Date.UTC(2026, 0, 15, 14, 0, 0) / 1000),
  'GMT 14:00 UTC (= 14:00 London) must not qualify \u2014 too early');
/* BST 17:00 UTC (= 18:00 London) must NOT qualify (after window) */
assert.ok(!inWindow(Date.UTC(2026, 6, 1, 17, 0, 0) / 1000),
  'BST 17:00 UTC (= 18:00 London) must not qualify \u2014 too late');

/* --- version --- */
assert.ok(/^hg-v(?:667|66[8-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v667',
  'HG_VER must be >= hg-v667 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v667: LONDON-FIX fires under BST too');
console.log('  * hgOgLondonHour resolves the London local hour via Intl (Europe/London)');
console.log('  * fires when London hour === 15 or 16 (was UTC hour === 15 or 16)');
console.log('  * fallback widens UTC window to 14..16 when Intl is absent');
console.log('  * runtime: BST 14:00 UTC now qualifies; GMT 15:00 UTC still qualifies');
console.log('  * runtime: BST 15:00 UTC = 16:00 London (edge of window, still qualifies)');
console.log('  * runtime: GMT 14:00 UTC does NOT qualify (before fix)');
console.log('  * version bumped to ' + HG_VER);
