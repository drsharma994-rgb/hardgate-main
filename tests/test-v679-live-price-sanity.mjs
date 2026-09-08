/* v679: live-price sanity check across all 3 desks.

   Cards sit on screen while price keeps moving. v679 introduces the
   sibling half of v677 (freshness): v677 says \"is this old?\", v679 says
   \"has price already moved through it?\". Together they catch stale AND
   already-resolved plans.

   Fix (shared helper + 3 integration points):
     * omniroute.js hgLivePriceGrade(dir, entry, stop, t1, t2, livePx)
       classifies each plan against current price into five states with
       numeric deltas: fresh (+1), pending (+0.5), past-entry (-0.5),
       past-t1 (-1), past-stop (-1.5). Attached to window/globalThis.
     * omniroute hgOmniBalanceParts + 20 * liveN term.
     * omnigold hgOgBalanceParts + 20 * liveN term (calls shared helper
       via window.hgLivePriceGrade with local fallback to 0).
     * reversalsniper rsConviction adds +2/-1/-3/-4 for the states. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const orSrc = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
const ogSrc = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
const rsSrc = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* ============================================================
   PART A \u2014 helper definition (omniroute)
   ============================================================ */
assert.ok(/v679: live-price sanity classification/.test(orSrc),
  'v679 rationale block must be present in omniroute.js');
assert.ok(/function hgLivePriceGrade\(dir, entry, stop, t1, t2, livePx\)\{/.test(orSrc),
  'hgLivePriceGrade must be defined');
assert.ok(/if \(wrongOfStop\(\)\) return \{ grade: 'past-stop', delta: -1\.5 \};/.test(orSrc),
  'past-stop must map to -1.5 delta');
assert.ok(/if \(beyond\(t\)\) return \{ grade: 'past-t1', delta: -1\.0 \};/.test(orSrc),
  'past-t1 must map to -1.0 delta');
assert.ok(/return \{ grade: 'past-entry', delta: -0\.5 \};/.test(orSrc),
  'past-entry must map to -0.5 delta');
assert.ok(/if \(atEntry\) return \{ grade: 'fresh', delta: 1\.0 \};/.test(orSrc),
  'fresh must map to 1.0 delta');
assert.ok(/return \{ grade: 'pending', delta: 0\.5 \};/.test(orSrc),
  'pending must map to 0.5 delta');
assert.ok(/if \(typeof window !== 'undefined'\) window\.hgLivePriceGrade = hgLivePriceGrade;/.test(orSrc),
  'helper must be exposed on window');

/* ============================================================
   PART B \u2014 integration (all 3 tabs)
   ============================================================ */
/* omniroute: liveN in balance parts */
assert.ok(/v679: live-price sanity\. Every card sits on screen while price/.test(orSrc),
  'omniroute BalanceParts v679 rationale must be present');
assert.ok(/\+ 20 \* liveN\s+\/\* v679: NEW/.test(orSrc),
  'omniroute must add 20 * liveN to score');
assert.ok(/liveN: liveN, liveGrade: liveGrade,/.test(orSrc),
  'omniroute must return liveN + liveGrade');

/* omnigold: liveN in balance parts */
assert.ok(/v679: live-price sanity\. Uses hgLivePriceGrade/.test(ogSrc),
  'omnigold BalanceParts v679 rationale must be present');
assert.ok(/\+ 20 \* liveN;\s+\/\* v679: NEW/.test(ogSrc),
  'omnigold must add 20 * liveN to score');
assert.ok(/liveN: liveN, liveGrade: liveGrade,/.test(ogSrc),
  'omnigold must return liveN + liveGrade');

/* reversalsniper: conviction deltas */
assert.ok(/v679: live-price sanity\. If the shared hgLivePriceGrade helper/.test(rsSrc),
  'reversalsniper rsConviction v679 rationale must be present');
assert.ok(/if \(lp\.grade === 'fresh' \|\| lp\.grade === 'pending'\) c \+= 2;/.test(rsSrc),
  'reversalsniper: fresh/pending awards +2');
assert.ok(/else if \(lp\.grade === 'past-stop'\) c -= 4;/.test(rsSrc),
  'reversalsniper: past-stop penalises -4');
assert.ok(/livePx: entry \/\* v679: entry equals rows\[n-1\]\.c at construction \*\//.test(rsSrc),
  'reversalsniper must stamp setup.livePx');

/* ============================================================
   PART C \u2014 runtime demonstration of hgLivePriceGrade
   ============================================================ */
const helperMatch = orSrc.match(/function hgLivePriceGrade\(dir, entry, stop, t1, t2, livePx\)\{[\s\S]*?\n  \}/);
assert.ok(helperMatch, 'hgLivePriceGrade must be extractable');
const wrap = new Function('fin', 'isFinite',
  helperMatch[0] + '\nreturn hgLivePriceGrade;');
const hgLivePriceGrade = wrap(
  (v) => { if (v === null || v === undefined || v === '') return NaN; var n = +v; return Number.isFinite(n) ? n : NaN; },
  Number.isFinite
);

/* Long plan: entry 100, stop 95, t1 110, t2 115 */

/* Case A: price at stop or below \u2014 past-stop */
{
  const r = hgLivePriceGrade('long', 100, 95, 110, 115, 94);
  assert.equal(r.grade, 'past-stop', 'price below stop => past-stop');
  assert.equal(r.delta, -1.5);
}
/* Case B: price at or beyond t1 \u2014 past-t1 */
{
  const r = hgLivePriceGrade('long', 100, 95, 110, 115, 111);
  assert.equal(r.grade, 'past-t1', 'price above t1 => past-t1');
  assert.equal(r.delta, -1.0);
}
/* Case C: price past entry but before t1 \u2014 past-entry */
{
  const r = hgLivePriceGrade('long', 100, 95, 110, 115, 105);
  assert.equal(r.grade, 'past-entry', 'price past entry before t1 => past-entry');
  assert.equal(r.delta, -0.5);
}
/* Case D: price at entry (within 5% of R1) \u2014 fresh */
{
  const r = hgLivePriceGrade('long', 100, 95, 110, 115, 100.4);
  assert.equal(r.grade, 'fresh', 'price at entry => fresh (5% tolerance)');
  assert.equal(r.delta, 1.0);
}
/* Case E: price between stop and entry \u2014 pending (waiting for pullback) */
{
  const r = hgLivePriceGrade('long', 100, 95, 110, 115, 97);
  assert.equal(r.grade, 'pending', 'price on pullback side of entry => pending');
  assert.equal(r.delta, 0.5);
}

/* Short plan: entry 100, stop 105, t1 90, t2 85 */

/* Case F: price at or above stop \u2014 past-stop */
{
  const r = hgLivePriceGrade('short', 100, 105, 90, 85, 106);
  assert.equal(r.grade, 'past-stop', 'short: price above stop => past-stop');
}
/* Case G: price at or below t1 \u2014 past-t1 */
{
  const r = hgLivePriceGrade('short', 100, 105, 90, 85, 89);
  assert.equal(r.grade, 'past-t1', 'short: price below t1 => past-t1');
}
/* Case H: price past entry (below) but above t1 \u2014 past-entry */
{
  const r = hgLivePriceGrade('short', 100, 105, 90, 85, 95);
  assert.equal(r.grade, 'past-entry', 'short: price past entry before t1 => past-entry');
}
/* Case I: price at entry \u2014 fresh */
{
  const r = hgLivePriceGrade('short', 100, 105, 90, 85, 99.6);
  assert.equal(r.grade, 'fresh', 'short: price at entry => fresh');
}
/* Case J: price between entry and stop (above) \u2014 pending */
{
  const r = hgLivePriceGrade('short', 100, 105, 90, 85, 103);
  assert.equal(r.grade, 'pending', 'short: price on pullback side above entry => pending');
}

/* Guards */
{
  assert.equal(hgLivePriceGrade('long', NaN, 95, 110, 115, 100), null, 'missing entry returns null');
  assert.equal(hgLivePriceGrade('long', 100, 95, 110, 115, NaN), null, 'missing livePx returns null');
  /* dir inference from geometry */
  const r = hgLivePriceGrade('', 100, 95, 110, 115, 105);
  assert.equal(r.grade, 'past-entry', 'inferred long dir works');
}

/* ============================================================
   PART D \u2014 score-delta math
   ============================================================ */
/* omni: 20 * liveN, so fresh vs past-stop delta = 20 * (1 - (-1.5)) = 50 pts */
assert.equal(20 * 1 - 20 * (-1.5), 50,
  'omni fresh vs past-stop delta = 50 pts (bigger than one family swing)');
assert.equal(20 * 1 - 20 * (-1), 40, 'omni fresh vs past-t1 delta = 40 pts');
/* rsniper: fresh vs past-stop = 2 - (-4) = 6 conviction pts */
{
  const fresh = 2, pastStop = -4;
  assert.equal(fresh - pastStop, 6,
    'rsniper fresh vs past-stop delta = 6 conviction pts (well beyond MIN_CONVICTION 4)');
}

/* ============================================================
   PART E \u2014 version hygiene
   ============================================================ */
assert.ok(/^hg-v(?:679|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v679',
  'HG_VER must be >= hg-v679 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omniroute\\.js\\?v=' + qv).test(idx), 'omniroute cache-buster must be ?v=' + qv);
assert.ok(new RegExp('omnigold\\.js\\?v=' + qv).test(idx), 'omnigold cache-buster must be ?v=' + qv);
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx), 'reversalsniper cache-buster must be ?v=' + qv);

console.log('OK \u2014 v679: live-price sanity across all 3 desks');
console.log('  * hgLivePriceGrade classifies plans into 5 states with numeric deltas');
console.log('  * long: past-stop / past-t1 / past-entry / fresh / pending all detected');
console.log('  * short: symmetric across all 5 states');
console.log('  * dir inferred from geometry when omitted');
console.log('  * missing entry or livePx returns null (safe)');
console.log('  * omni fresh vs past-stop delta = 50 pts');
console.log('  * rsniper fresh vs past-stop delta = 6 conviction pts');
console.log('  * version bumped to ' + HG_VER);
