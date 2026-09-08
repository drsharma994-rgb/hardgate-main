/* v668: London range + NY-open-drive session windows are DST-aware.

   Two OMNIGOLD mechanics hard-coded UTC hours as if they were local
   session hours:

     hgOgLondonRange: UTC 07..13 (correct under GMT, wrong under BST)
     hgOgNyOpenDrive: UTC 13..16 (correct under EDT, wrong under EST)

   So each mechanic silently skipped ~half the year on the wrong side
   of the DST boundary. London range mis-shifted by an hour under BST;
   NY-open-drive missed the entire EST morning window.

   Fix: new hgOgLocalHour(t, tz) resolves the local hour in an IANA tz
   via Intl.DateTimeFormat (DST-aware). London uses Europe/London,
   NY-open-drive uses America/New_York. Both mechanics keep a widened
   UTC fallback when Intl is absent. v667's hgOgLondonHour is preserved
   but now delegates to hgOgLocalHour. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- rationale comment must be present --- */
assert.ok(/v668: generalized version of v667's London-hour helper/.test(src),
  'v668 rationale comment on the helper must be present');

/* --- generalized hgOgLocalHour(t, tz) helper --- */
assert.ok(/function hgOgLocalHour\(t, tz\)\{/.test(src),
  'hgOgLocalHour(t, tz) must be defined');
assert.ok(/if \(!isFinite\(t\) \|\| !tz\) return NaN;/.test(src),
  'helper must guard both t and tz');
assert.ok(/timeZone: tz,/.test(src),
  'helper must pass tz through to Intl.DateTimeFormat');

/* --- v667 hgOgLondonHour still exists but now delegates --- */
assert.ok(/function hgOgLondonHour\(t\)\{[\s\S]{0,300}return hgOgLocalHour\(t, 'Europe\/London'\);/.test(src),
  'hgOgLondonHour must delegate to hgOgLocalHour with Europe/London');

/* --- hgOgLondonRange uses London local hour + falls back to UTC 6..13 --- */
assert.ok(/v668: London session range measured in LONDON local hours/.test(src),
  'hgOgLondonRange must carry the v668 rationale');
assert.ok(/lhr = hgOgLocalHour\(t, 'Europe\/London'\);/.test(src),
  'hgOgLondonRange must resolve London hour first');
assert.ok(/if \(!\(lhr >= 7 && lhr < 13\)\) continue;/.test(src),
  'when London hour resolves, window is lhr 7..13');
assert.ok(/if \(!\(uhr >= 6 && uhr < 13\)\) continue;/.test(src),
  'fallback UTC window widens to 6..13 (was 7..13) to cover BST');

/* --- hgOgNyOpenDrive uses NY local hour + falls back to UTC 13..17 --- */
assert.ok(/v668: NY-open-drive window measured in NEW YORK local hours/.test(src),
  'hgOgNyOpenDrive must carry the v668 rationale');
assert.ok(/nhr = hgOgLocalHour\(t, 'America\/New_York'\);/.test(src),
  'hgOgNyOpenDrive must resolve NY local hour first');
assert.ok(/inWindow = \(nhr >= 9 && nhr < 12\);/.test(src),
  'when NY hour resolves, window is nhr 9..12');
assert.ok(/inWindow = \(uhr >= 13 && uhr < 17\);/.test(src),
  'fallback UTC window widens to 13..17 (was 13..16) to cover EST');

/* --- stale hard-coded UTC windows must be gone --- */
/* Old NY guard was `if (!(hr >= 13 && hr < 16)) return null;` on a bare
   local var hr; check with contextual pattern to avoid matching other files. */
assert.ok(!/var hr = hgOgBarHour\(last\);\s+if \(!\(hr >= 13 && hr < 16\)\) return null;/.test(src),
  'stale NY guard hr >= 13 && hr < 16 (bare UTC) must be gone');
/* Old London guard checked hr>=7 && hr<13 inside the loop; regex over the
   old form (loop, hr = hgOgBarHour, then `if (!(hr >= 7 && hr < 13))`) */
assert.ok(!/hr = hgOgBarHour\(rows\[i\]\);\s+if \(!\(hr >= 7 && hr < 13\)\) continue;/.test(src),
  'stale London hour guard (bare UTC) must be gone');

/* --- runtime demonstration: extract hgOgLocalHour and prove DST correctness --- */
const helperMatch = src.match(/function hgOgLocalHour\(t, tz\)\{[\s\S]*?\n  \}/);
assert.ok(helperMatch, 'hgOgLocalHour body must be extractable');
const wrap = new Function('num', 'isFinite',
  helperMatch[0] + '\nreturn hgOgLocalHour;');
const hgOgLocalHour = wrap(
  (v) => { var n = +v; return Number.isFinite(n) ? n : NaN; },
  Number.isFinite
);

/* Case A: BST midsummer \u2014 2026-07-01 06:00 UTC = 07:00 London (session open) */
{
  const s = Date.UTC(2026, 6, 1, 6, 0, 0) / 1000;
  const lhr = hgOgLocalHour(s, 'Europe/London');
  assert.equal(lhr, 7, 'BST 06:00 UTC = 07:00 London (open)');
}
/* Case B: BST midsummer \u2014 2026-07-01 12:00 UTC = 13:00 London (session close) */
{
  const s = Date.UTC(2026, 6, 1, 12, 0, 0) / 1000;
  const lhr = hgOgLocalHour(s, 'Europe/London');
  assert.equal(lhr, 13, 'BST 12:00 UTC = 13:00 London (close boundary)');
}
/* Case C: GMT midwinter \u2014 2026-01-15 07:00 UTC = 07:00 London */
{
  const s = Date.UTC(2026, 0, 15, 7, 0, 0) / 1000;
  const lhr = hgOgLocalHour(s, 'Europe/London');
  assert.equal(lhr, 7, 'GMT 07:00 UTC = 07:00 London (open)');
}

/* Case D: EDT midsummer \u2014 2026-07-01 13:00 UTC = 09:00 New_York (NY open) */
{
  const s = Date.UTC(2026, 6, 1, 13, 0, 0) / 1000;
  const nhr = hgOgLocalHour(s, 'America/New_York');
  assert.equal(nhr, 9, 'EDT 13:00 UTC = 09:00 NY (open)');
}
/* Case E: EST midwinter \u2014 2026-01-15 14:00 UTC = 09:00 New_York (NY open) */
{
  const s = Date.UTC(2026, 0, 15, 14, 0, 0) / 1000;
  const nhr = hgOgLocalHour(s, 'America/New_York');
  assert.equal(nhr, 9, 'EST 14:00 UTC = 09:00 NY (open)');
}
/* Case F: EST midwinter \u2014 2026-01-15 13:00 UTC = 08:00 New_York (before NY open) */
{
  const s = Date.UTC(2026, 0, 15, 13, 0, 0) / 1000;
  const nhr = hgOgLocalHour(s, 'America/New_York');
  assert.equal(nhr, 8, 'EST 13:00 UTC = 08:00 NY (pre-open) \u2014 was firing under pre-v668 as "NY open"');
}

/* Guards */
assert.ok(Number.isNaN(hgOgLocalHour(NaN, 'Europe/London')), 'NaN t returns NaN');
assert.ok(Number.isNaN(hgOgLocalHour(1_700_000_000, '')), 'empty tz returns NaN');
assert.ok(Number.isNaN(hgOgLocalHour(1_700_000_000, null)), 'null tz returns NaN');

/* --- Behavioural: NY-open-drive window predicate under the fix --- */
function nyInWindow(t){
  const nhr = hgOgLocalHour(t, 'America/New_York');
  if (Number.isFinite(nhr)) return nhr >= 9 && nhr < 12;
  const uhr = Math.floor((t % 86400) / 3600);
  return uhr >= 13 && uhr < 17;
}
/* EST 14:00 UTC = 09:00 NY: MUST now qualify (pre-v668 did not, since 14 UTC != 13..16) */
assert.ok(nyInWindow(Date.UTC(2026, 0, 15, 14, 0, 0) / 1000),
  'EST 14:00 UTC (= 09:00 NY) MUST now qualify \u2014 the whole point of the NY fix');
/* EDT 13:00 UTC = 09:00 NY: still qualifies */
assert.ok(nyInWindow(Date.UTC(2026, 6, 1, 13, 0, 0) / 1000),
  'EDT 13:00 UTC (= 09:00 NY) still qualifies');
/* EST 13:00 UTC = 08:00 NY: MUST NOT qualify (pre-open) */
assert.ok(!nyInWindow(Date.UTC(2026, 0, 15, 13, 0, 0) / 1000),
  'EST 13:00 UTC (= 08:00 NY) must not qualify \u2014 pre-open');
/* EDT 17:00 UTC = 13:00 NY: MUST NOT qualify (after morning window) */
assert.ok(!nyInWindow(Date.UTC(2026, 6, 1, 17, 0, 0) / 1000),
  'EDT 17:00 UTC (= 13:00 NY) must not qualify \u2014 after morning window');

/* --- Behavioural: London range window predicate --- */
function londonInWindow(t){
  const lhr = hgOgLocalHour(t, 'Europe/London');
  if (Number.isFinite(lhr)) return lhr >= 7 && lhr < 13;
  const uhr = Math.floor((t % 86400) / 3600);
  return uhr >= 6 && uhr < 13;
}
/* BST 06:00 UTC = 07:00 London: MUST now qualify (pre-v668 did not) */
assert.ok(londonInWindow(Date.UTC(2026, 6, 1, 6, 0, 0) / 1000),
  'BST 06:00 UTC (= 07:00 London) MUST now qualify \u2014 the whole point of the London fix');
/* GMT 07:00 UTC = 07:00 London: still qualifies */
assert.ok(londonInWindow(Date.UTC(2026, 0, 15, 7, 0, 0) / 1000),
  'GMT 07:00 UTC (= 07:00 London) still qualifies');
/* BST 13:00 UTC = 14:00 London: MUST NOT qualify (session closed) */
assert.ok(!londonInWindow(Date.UTC(2026, 6, 1, 13, 0, 0) / 1000),
  'BST 13:00 UTC (= 14:00 London) must not qualify \u2014 session closed');

/* --- version --- */
assert.ok(/^hg-v(?:668|66[9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v668',
  'HG_VER must be >= hg-v668 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v668: OMNIGOLD session windows DST-aware');
console.log('  * hgOgLocalHour(t, tz) generalizes v667 London-only helper');
console.log('  * hgOgLondonRange uses Europe/London hours (was UTC 07..13)');
console.log('  * hgOgNyOpenDrive uses America/New_York hours (was UTC 13..16)');
console.log('  * fallback UTC windows widened to cover both DST regimes');
console.log('  * runtime: BST 06:00 UTC now qualifies as London open');
console.log('  * runtime: EST 14:00 UTC now qualifies as NY 09:00 open');
console.log('  * version bumped to ' + HG_VER);
