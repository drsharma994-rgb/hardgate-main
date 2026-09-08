/* v669: hgOgWeekOpenPx uses the FX/gold trading-week open (Sunday 17:00 NY),
   not Monday 00:00 UTC.

   The FX week opens at Sunday 17:00 New_York:
     * Under EST (winter): Sunday 22:00 UTC
     * Under EDT (summer): Sunday 21:00 UTC

   Prior to v669 the code took `weekStart = Monday 00:00 UTC` and picked
   the first row at-or-after that instant. Two failure modes:
     * The Sunday 21:00 or 22:00 UTC bar (the true weekly-open bar) was
       excluded from consideration.
     * From Monday 00:00 UTC through Monday morning, the "weekly open" was
       read off the Monday-00:00 hourly bar even though price had already
       moved 4+ hours since the real week open.

   Fix: walk back day-by-day to the most recent Sunday, then use
   hgOgLocalHour(cand, 'America/New_York') to find the UTC instant that
   corresponds to 17:00 NY on that Sunday. Fall back to Sunday 21:00 UTC
   when Intl is absent (correct under EDT, one hour early under EST but
   still much better than Monday 00:00 UTC). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- rationale comment must be present --- */
assert.ok(/v669: FX\/gold trading week opens at 17:00 NEW YORK time on Sunday/.test(src),
  'v669 rationale comment must be present');

/* --- new implementation shape --- */
assert.ok(/dow = new Date\(stepStart \* 1000\)\.getUTCDay\(\); \/\* 0 = Sunday \*\//.test(src),
  'week-open walker must look for Sunday (dow === 0)');
assert.ok(/hgOgLocalHour\(cand, 'America\/New_York'\)/.test(src),
  'week-open resolver must use America/New_York via hgOgLocalHour');
assert.ok(/if \(isFinite\(nhr\) && nhr === 17\)\{ picked = cand; break; \}/.test(src),
  'week-open must pick the Sunday hour that maps to 17 NY');
assert.ok(/weekOpenT = stepStart \+ 21 \* 3600;/.test(src),
  'fallback week-open must be Sunday 21:00 UTC (EDT-correct, EST-off-by-one)');

/* --- stale Monday-00:00-UTC implementation must be gone --- */
assert.ok(!/var fromMon = \(dow \+ 6\) % 7;/.test(src),
  'stale Monday-based week-start (fromMon) must be gone');
assert.ok(!/var weekStart = dayStart - fromMon \* 86400;/.test(src),
  'stale Monday-based weekStart calculation must be gone');

/* --- runtime demonstration: extract hgOgWeekOpenPx and hgOgLocalHour --- */
const woMatch = src.match(/function hgOgWeekOpenPx\(rows\)\{[\s\S]*?\n  \}/);
assert.ok(woMatch, 'hgOgWeekOpenPx body must be extractable');
const lhMatch = src.match(/function hgOgLocalHour\(t, tz\)\{[\s\S]*?\n  \}/);
assert.ok(lhMatch, 'hgOgLocalHour must be extractable');

const body = lhMatch[0] + '\n' + woMatch[0];
const wrap = new Function('num', 'isFinite',
  body + '\nreturn hgOgWeekOpenPx;');
const hgOgWeekOpenPx = wrap(
  (v) => { var n = +v; return Number.isFinite(n) ? n : NaN; },
  Number.isFinite
);

/* helper: build a rows array of hourly bars across a week window */
function mkHourlyRows(startUtcSec, hours, priceFn){
  const rows = [];
  for (let i = 0; i < hours; i++){
    const t = startUtcSec + i * 3600;
    const p = priceFn(i);
    rows.push({ t: t, o: p, h: p + 0.5, l: p - 0.5, c: p });
  }
  return rows;
}

/* Case A: EST winter week
   Sunday 2026-01-11 22:00 UTC = Sunday 17:00 EST NY (true weekly open).
   Build bars from Sunday 20:00 UTC through the following Tuesday 12:00 UTC.
   Set bar-open price = 2001 exactly on Sunday 22:00 UTC bar and different
   prices elsewhere. hgOgWeekOpenPx must return 2001, NOT the Monday-00 price. */
{
  const sundayNoonUtc = Date.UTC(2026, 0, 11, 0, 0, 0) / 1000; /* 2026-01-11 00 UTC */
  const start = sundayNoonUtc + 20 * 3600;                     /* Sun 20:00 UTC */
  const rows = mkHourlyRows(start, 40, (i) => {
    /* Sunday 22:00 UTC is index 2 (start=20, +2 hours = 22) */
    if (i === 2) return 2001;   /* the true weekly open under EST */
    if (i === 4) return 2100;   /* Monday 00:00 UTC \u2014 what the OLD code returned */
    return 2050 + i;            /* everything else */
  });
  const wo = hgOgWeekOpenPx(rows);
  assert.equal(wo, 2001,
    'EST week: weekly open must come from Sun 22:00 UTC bar (= Sun 17:00 EST), not Mon 00:00 UTC');
}

/* Case B: EDT summer week
   Sunday 2026-07-05 21:00 UTC = Sunday 17:00 EDT NY (true weekly open).
   The Sun 22:00 UTC bar is NOT the weekly open under EDT. */
{
  const sundayZeroUtc = Date.UTC(2026, 6, 5, 0, 0, 0) / 1000;  /* 2026-07-05 00 UTC */
  const start = sundayZeroUtc + 19 * 3600;                     /* Sun 19:00 UTC */
  const rows = mkHourlyRows(start, 40, (i) => {
    /* start = Sun 19 UTC. Sun 21 UTC = index 2 (true EDT open). */
    if (i === 2) return 2010;   /* the true weekly open under EDT */
    if (i === 3) return 2020;   /* Sun 22 UTC \u2014 wrong under EDT */
    if (i === 5) return 2200;   /* Mon 00 UTC \u2014 the OLD wrong answer */
    return 2100 + i;
  });
  const wo = hgOgWeekOpenPx(rows);
  assert.equal(wo, 2010,
    'EDT week: weekly open must come from Sun 21:00 UTC bar (= Sun 17:00 EDT), not Mon 00:00 UTC');
}

/* Case C: mid-week Wednesday lookup still returns the prior Sunday's open */
{
  const sundayZeroUtc = Date.UTC(2026, 0, 11, 0, 0, 0) / 1000;   /* Sun 2026-01-11 */
  const start = sundayZeroUtc + 21 * 3600;                       /* Sun 21 UTC */
  /* Sun 22 UTC = index 1 = true EST open */
  const rows = mkHourlyRows(start, 120, (i) => {                 /* through Fri */
    if (i === 1) return 2001;
    return 2100 + i;
  });
  /* lastT is now well past Wednesday, but weekly open is still Sunday 22:00 UTC */
  const wo = hgOgWeekOpenPx(rows);
  assert.equal(wo, 2001, 'mid-week lookup returns the Sun-17-NY bar open');
}

/* Case D: OLD-code counterexample \u2014 confirm the OLD behavior would have
   returned Mon 00 UTC, and NEW behavior returns Sun 22 UTC.
   Under the OLD algorithm, weekStart = Mon 00 UTC and the first bar
   at-or-after weekStart is picked. */
{
  const sundayZeroUtc = Date.UTC(2026, 0, 11, 0, 0, 0) / 1000;
  const start = sundayZeroUtc + 20 * 3600;                       /* Sun 20 UTC */
  const rows = mkHourlyRows(start, 40, (i) => {
    if (i === 2) return 1999;   /* Sun 22 UTC \u2014 NEW result */
    if (i === 4) return 2222;   /* Mon 00 UTC \u2014 OLD result */
    return 2100 + i;
  });
  const woNew = hgOgWeekOpenPx(rows);
  assert.equal(woNew, 1999, 'NEW: Sun 22 UTC open (EST week)');
  assert.notEqual(woNew, 2222, 'NEW MUST NOT match the old Mon 00 UTC bar');
}

/* Case E: no bars at all */
{
  assert.ok(!isFinite(hgOgWeekOpenPx([])), 'empty rows returns NaN');
  assert.ok(!isFinite(hgOgWeekOpenPx(null)), 'null rows returns NaN');
}

/* Case F: mid-Sunday (before Sun 17 NY) rolls back to the prior week open.
   This is the correct behavior — during Sunday 00..17 NY the trading week
   has not yet re-opened, so "week open" refers to the prior Sunday. */
{
  const sundayZeroUtc = Date.UTC(2026, 0, 11, 0, 0, 0) / 1000; /* Sun 2026-01-11 */
  const start = sundayZeroUtc + 12 * 3600;                     /* Sun 12 UTC */
  const rows = mkHourlyRows(start, 5, (i) => 2000 + i);
  const wo = hgOgWeekOpenPx(rows);
  /* Prior Sunday is 2026-01-04. No rows exist that far back, but rows[0]
     (Sun 12 UTC current) is >= prior Sun 22 UTC, so first = rows[0].
     Result: 2000 (the earliest bar available). Correct: mid-Sunday queries
     roll back to the prior week open. */
  assert.equal(wo, 2000, 'mid-Sunday query rolls back to prior week open');
}

/* --- version --- */
assert.ok(/^hg-v(?:669|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v669',
  'HG_VER must be >= hg-v669 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v669: hgOgWeekOpenPx uses Sun 17:00 NY (FX week), not Mon 00 UTC');
console.log('  * EST week: Sun 22 UTC bar is the weekly open');
console.log('  * EDT week: Sun 21 UTC bar is the weekly open');
console.log('  * mid-week lookup still returns the Sunday-17-NY bar open');
console.log('  * fallback to Sun 21 UTC when Intl is absent');
console.log('  * version bumped to ' + HG_VER);
