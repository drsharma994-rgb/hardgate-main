/* v673: hgOmniSessionTimingScore DST-aware rewrite (mirrors omnigold v667/v668).

   Prior to v673 the session score:
     1. Assumed a fixed IST offset with hard-coded windows that were labelled
        as London/NY sessions but were ~5 hours OFF the real session hours.
     2. Was DST-blind: London swings 07:00 <-> 08:00 UTC across BST and NY
        swings 13:30 <-> 14:30 UTC across EDT/EST.
     3. Used Date.now() rather than the setup's bar timestamp \u2014 a swing
        setup detected on a 4h close six hours ago was scored against the
        operator's current wall clock.

   Fix (v673):
     * New hgOmniLocalHour(t, tz) helper delegating to shared hgOgLocalHour
       (v668 in omnigold) with a local Intl fallback.
     * Windows resolved in true LOCAL hours per session (London, NY).
     * Uses setup.hit.t / setup.bar.t / setup.rows tail before Date.now(). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');

/* --- rationale --- */
assert.ok(/v673: DST-aware Europe\/London \+ America\/New_York rewrite/.test(src),
  'v673 rationale must be present in hgOmniSessionTimingScore');

/* --- new helper --- */
assert.ok(/function hgOmniLocalHour\(t, tz\)\{/.test(src),
  'hgOmniLocalHour must be defined');
assert.ok(/W\.hgOgLocalHour/.test(src),
  'hgOmniLocalHour must prefer the shared hgOgLocalHour (v668)');
assert.ok(/timeZone: tz, hour: '2-digit'/.test(src),
  'fallback must use Intl.DateTimeFormat with the tz');

/* --- bar-timestamp preference --- */
assert.ok(/if \(setup\.hit && isFinite\(fin\(setup\.hit\.t\)\)\) sec = fin\(setup\.hit\.t\);/.test(src),
  'must prefer setup.hit.t');
assert.ok(/else if \(setup\.bar && isFinite\(fin\(setup\.bar\.t\)\)\) sec = fin\(setup\.bar\.t\);/.test(src),
  'must fall back to setup.bar.t');
assert.ok(/setup\.rows\[setup\.rows\.length - 1\]/.test(src),
  'must fall back to the setup rows tail');
assert.ok(/if \(!isFinite\(sec\)\) sec = Math\.floor\(Date\.now\(\) \/ 1000\);/.test(src),
  'Date.now must be a last resort');

/* --- windows in local hours --- */
assert.ok(/lonHour = hgOmniLocalHour\(sec, 'Europe\/London'\);/.test(src),
  'must resolve London hour');
assert.ok(/nyHour = hgOmniLocalHour\(sec, 'America\/New_York'\);/.test(src),
  'must resolve NY hour');
assert.ok(/isOverlap = \(lonHour >= 13 && lonHour < 16\) && \(nyHour >= 8 && nyHour < 11\);/.test(src),
  'overlap = London 13..16 AND NY 08..11');
assert.ok(/isLondon\s+= !isOverlap && \(lonHour >= 7 && lonHour < 13\);/.test(src),
  'london = London 7..13 (excluding overlap)');
assert.ok(/isNy\s+= !isOverlap && !isLondon && \(nyHour >= 9 && nyHour < 16\);/.test(src),
  'ny = NY 9..16 (excluding overlap and london)');

/* --- stale hard-coded IST windows must be gone --- */
assert.ok(!/var londonOpen = 5;/.test(src),
  'stale IST londonOpen = 5 must be gone');
assert.ok(!/var londonNyOverlap = 13;/.test(src),
  'stale IST londonNyOverlap = 13 must be gone');
assert.ok(!/var nyOpen = 20\.5;/.test(src),
  'stale IST nyOpen = 20.5 must be gone');
assert.ok(!/sessionLabel = 'UNDEFINED';/.test(src),
  'stale UNDEFINED gap must be gone (v673 falls to OFF-SESSION or QUIET)');

/* --- runtime demonstration: extract hgOmniLocalHour and driver logic ---
   Extract the helper only and drive it directly to prove DST correctness. */
const helperMatch = src.match(/function hgOmniLocalHour\(t, tz\)\{[\s\S]*?\n  \}/);
assert.ok(helperMatch, 'hgOmniLocalHour body must be extractable');
const wrap = new Function('W',
  'var isFinite = Number.isFinite;\n' +
  helperMatch[0] + '\nreturn hgOmniLocalHour;');
const hgOmniLocalHour = wrap({});

/* Case A: EDT midsummer \u2014 NY 09:00 = UTC 13:00 */
{
  const s = Date.UTC(2026, 6, 1, 13, 0, 0) / 1000;
  assert.equal(hgOmniLocalHour(s, 'America/New_York'), 9, 'EDT 13 UTC = NY 09');
  assert.equal(hgOmniLocalHour(s, 'Europe/London'), 14, 'BST 13 UTC = London 14');
}
/* Case B: EST midwinter \u2014 NY 09:00 = UTC 14:00 */
{
  const s = Date.UTC(2026, 0, 15, 14, 0, 0) / 1000;
  assert.equal(hgOmniLocalHour(s, 'America/New_York'), 9, 'EST 14 UTC = NY 09');
  assert.equal(hgOmniLocalHour(s, 'Europe/London'), 14, 'GMT 14 UTC = London 14');
}

/* --- behavioural: verify overlap classification works across DST ---
   Reproduce the window predicate from the source and drive it. */
function classify(s){
  const lonHour = hgOmniLocalHour(s, 'Europe/London');
  const nyHour = hgOmniLocalHour(s, 'America/New_York');
  const isOverlap = (lonHour >= 13 && lonHour < 16) && (nyHour >= 8 && nyHour < 11);
  const isLondon = !isOverlap && (lonHour >= 7 && lonHour < 13);
  const isNy = !isOverlap && !isLondon && (nyHour >= 9 && nyHour < 16);
  if (isOverlap) return 'OVERLAP';
  if (isLondon) return 'LONDON';
  if (isNy) return 'NY';
  return 'OTHER';
}

/* Case C: EDT midsummer 14:00 UTC = London 15 & NY 10 => OVERLAP */
{
  const s = Date.UTC(2026, 6, 1, 14, 0, 0) / 1000;
  assert.equal(classify(s), 'OVERLAP',
    'EDT summer 14 UTC (London 15 + NY 10) must classify as OVERLAP');
}
/* Case D: EST midwinter 15:00 UTC = London 15 & NY 10 => OVERLAP */
{
  const s = Date.UTC(2026, 0, 15, 15, 0, 0) / 1000;
  assert.equal(classify(s), 'OVERLAP',
    'EST winter 15 UTC (London 15 + NY 10) must classify as OVERLAP');
}
/* Case E: BST midsummer 07:00 UTC = London 08 & NY 03 => LONDON */
{
  const s = Date.UTC(2026, 6, 1, 7, 0, 0) / 1000;
  assert.equal(classify(s), 'LONDON',
    'BST 07 UTC (London 08 + NY 03) must classify as LONDON');
}
/* Case F: GMT midwinter 08:00 UTC = London 08 & NY 03 => LONDON */
{
  const s = Date.UTC(2026, 0, 15, 8, 0, 0) / 1000;
  assert.equal(classify(s), 'LONDON',
    'GMT 08 UTC (London 08 + NY 03) must classify as LONDON');
}
/* Case G: EST 13:00 UTC = London 13 & NY 08 => OVERLAP (both windows begin here) */
{
  const s = Date.UTC(2026, 0, 15, 13, 0, 0) / 1000;
  assert.equal(classify(s), 'OVERLAP',
    'EST 13 UTC (London 13 + NY 08) enters OVERLAP at exact edge');
}
/* Case H: pre-v673 IST-labeled "LONDON OPEN" at 05:00 IST = 23:30 UTC prev day
   \u2014 that was FAR from London open in reality (23:30 UTC = London ~23:30
   GMT or ~00:30 BST, i.e. late-night). Under v673 that maps to OTHER (not
   any active session). */
{
  const s = Date.UTC(2026, 0, 15, 23, 30, 0) / 1000;
  const cls = classify(s);
  assert.ok(cls === 'OTHER',
    'pre-v673 mislabelled \"LONDON OPEN\" (23:30 UTC) correctly classifies as OTHER (saw ' + cls + ')');
}

/* --- version --- */
assert.ok(/^hg-v(?:673|67[4-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v673',
  'HG_VER must be >= hg-v673 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omniroute\\.js\\?v=' + qv).test(idx),
  'index.html omniroute.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v673: hgOmniSessionTimingScore is DST-aware');
console.log('  * hgOmniLocalHour delegates to shared hgOgLocalHour (v668)');
console.log('  * setup.hit.t / setup.bar.t / setup.rows tail preferred over Date.now');
console.log('  * OVERLAP requires London 13..16 AND NY 08..11 (both DST regimes)');
console.log('  * EDT 14 UTC and EST 15 UTC both classify as OVERLAP');
console.log('  * BST 07 UTC and GMT 08 UTC both classify as LONDON');
console.log('  * pre-v673 mislabelled \"LONDON OPEN\" (23:30 UTC) now classifies OTHER');
console.log('  * version bumped to ' + HG_VER);
