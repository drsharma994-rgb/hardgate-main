/* v675: plans.js direction-safety guards.

   Two closely-related direction-safety defects were found by the plans.js
   audit; v675 fixes both at their earliest layer:

   D1: hgPlanFromRisk accepted opts.t2Hint values that were on the correct
       side of entry but CLOSER to entry than t1. That shipped an inverted
       target ladder \u2014 T2 advertised as \"further\" than T1 while T2 actually
       paid less R. Downstream ledgers closing at T2 realised less R than
       the card claimed. Fix: require rew2 > rew1, otherwise fall through
       to the R-multiple policy target.

   D2: hgSetupHasLevels checked only finite/positive/non-equal levels \u2014 not
       direction geometry. A mislabelled row (long with stop above entry,
       or short with t1 below entry) could propagate through the funnel
       hgPickMostProbable uses to select the desk leader. That card, once
       placed, would either auto-fill (stop is on the reward side) or
       auto-stop (t1 is on the loss side). Fix: extend hgSetupHasLevels
       with the direction assertion (same one hgSwingHitToPlan and
       hgSwingPostEnrichValid enforce further downstream). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'plans.js'), 'utf8');

/* --- D1: rationale + widened predicate --- */
assert.ok(/v675: also require rew2 > rew1/.test(src),
  'D1 v675 rationale must be present in hgPlanFromRisk');
assert.ok(/if \(!\(isFinite\(t2\) && rew2 > 0 && rew2 > rew1\)\)\{/.test(src),
  'D1: t2Hint acceptance predicate must also require rew2 > rew1');
assert.ok(!/if \(!\(isFinite\(t2\) && rew2 > 0\)\)\{[\s\S]{0,60}t2 = \(dir === 'long'\)/.test(src.replace(/v675[\s\S]{0,600}?rew2 > rew1\)\)\{/, '')),
  'stale rew2 > 0 (only) predicate must be gone from the t2Hint branch');

/* --- D2: rationale + direction-geometry check --- */
assert.ok(/v675: also reject wrong-side plan geometry/.test(src),
  'D2 v675 rationale must be present at hgSetupHasLevels');
assert.ok(/if \(dir === 'long'\)\{\s*if \(!\(s < e && t1 > e\)\) return false;/.test(src),
  'D2: long path must require stop < entry AND t1 > entry');
assert.ok(/\} else if \(dir === 'short'\)\{\s*if \(!\(s > e && t1 < e\)\) return false;/.test(src),
  'D2: short path must require stop > entry AND t1 < entry');
assert.ok(/if \(isFinite\(\+row\.t2\) && \+row\.t2 > 0 && !\(\+row\.t2 > e\)\) return false;/.test(src),
  'D2: long optional t2 must sit above entry when present');
assert.ok(/if \(isFinite\(\+row\.t2\) && \+row\.t2 > 0 && !\(\+row\.t2 < e\)\) return false;/.test(src),
  'D2: short optional t2 must sit below entry when present');

/* --- runtime demonstration: extract hgSetupHasLevels stand-alone --- */
const hasMatch = src.match(/function hgSetupHasLevels\(row\)\{[\s\S]*?\n\}/);
assert.ok(hasMatch, 'hgSetupHasLevels body must be extractable');
const wrap = new Function('isFinite',
  hasMatch[0] + '\nreturn hgSetupHasLevels;');
const hgSetupHasLevels = wrap(Number.isFinite);

/* Case A: valid long \u2014 accepted */
assert.equal(hgSetupHasLevels({ dir: 'long',  entry: 100, stop: 95,  t1: 110 }), true,
  'valid long is accepted');
/* Case B: valid short \u2014 accepted */
assert.equal(hgSetupHasLevels({ dir: 'short', entry: 100, stop: 105, t1: 90  }), true,
  'valid short is accepted');
/* Case C: long with stop ABOVE entry \u2014 rejected (D2 kill) */
assert.equal(hgSetupHasLevels({ dir: 'long',  entry: 100, stop: 105, t1: 110 }), false,
  'long with wrong-side stop must be rejected');
/* Case D: long with t1 BELOW entry \u2014 rejected */
assert.equal(hgSetupHasLevels({ dir: 'long',  entry: 100, stop: 95,  t1: 90  }), false,
  'long with wrong-side t1 must be rejected');
/* Case E: short with stop BELOW entry \u2014 rejected */
assert.equal(hgSetupHasLevels({ dir: 'short', entry: 100, stop: 95,  t1: 90  }), false,
  'short with wrong-side stop must be rejected');
/* Case F: short with t1 ABOVE entry \u2014 rejected */
assert.equal(hgSetupHasLevels({ dir: 'short', entry: 100, stop: 105, t1: 110 }), false,
  'short with wrong-side t1 must be rejected');
/* Case G: long with wrong-side t2 \u2014 rejected */
assert.equal(hgSetupHasLevels({ dir: 'long',  entry: 100, stop: 95,  t1: 110, t2: 95 }), false,
  'long with t2 on loss side must be rejected');
/* Case H: short with wrong-side t2 \u2014 rejected */
assert.equal(hgSetupHasLevels({ dir: 'short', entry: 100, stop: 105, t1: 90,  t2: 110 }), false,
  'short with t2 on loss side must be rejected');
/* Case I: unknown dir \u2014 falls through the direction check (returns true if base gate passes) */
assert.equal(hgSetupHasLevels({ dir: '',      entry: 100, stop: 105, t1: 110 }), true,
  'unknown dir passes (downstream classifies later)');
/* Case J: base gate still enforced (non-positive stop) */
assert.equal(hgSetupHasLevels({ dir: 'long',  entry: 100, stop: -5, t1: 110 }), false,
  'base gate: stop <= 0 still rejects');
/* Case K: base gate: entry === stop */
assert.equal(hgSetupHasLevels({ dir: 'long',  entry: 100, stop: 100, t1: 110 }), false,
  'base gate: entry === stop still rejects');

/* --- runtime demonstration: extract hgPlanFromRisk and prove D1 --- */
const pfrMatch = src.match(/function hgPlanFromRisk\(dir, entry, stop, opts\)\{[\s\S]*?\n\}/);
assert.ok(pfrMatch, 'hgPlanFromRisk body must be extractable');
const pfrWrap = new Function('isFinite', 'HG_T1_R', 'HG_T2_R', 'HG_MIN_RR_DEFAULT',
  pfrMatch[0] + '\nreturn hgPlanFromRisk;');
const hgPlanFromRisk = pfrWrap(Number.isFinite, 2, 3.5, 1.5);

/* Case L: long with t2Hint BEYOND t1 \u2014 accepted verbatim */
{
  const p = hgPlanFromRisk('long', 100, 95, { t1Hint: 110, t2Hint: 120 });
  assert.equal(p.t1, 110);
  assert.equal(p.t2, 120, 'valid t2Hint beyond t1 is used verbatim');
  assert.equal(p.rr2, 4, 'rr2 = (120-100)/5 = 4');
}
/* Case M: long with t2Hint BETWEEN entry and t1 (correct side but too close)
   \u2014 must fall through to R-multiple policy target (2 * 3.5 = 7 -> t2 = 100 + 3.5*5 = 117.5) */
{
  const p = hgPlanFromRisk('long', 100, 95, { t1Hint: 110, t2Hint: 105 });
  assert.equal(p.t1, 110);
  assert.equal(p.t2, 100 + 3.5 * 5, 'inverted t2Hint (rew2 < rew1) falls back to t2R policy');
  assert.equal(p.rr2, 3.5, 'rr2 = 3.5 (default t2R)');
}
/* Case N: short with t2Hint BEYOND t1 (further from entry) \u2014 accepted */
{
  const p = hgPlanFromRisk('short', 100, 105, { t1Hint: 90, t2Hint: 80 });
  assert.equal(p.t1, 90);
  assert.equal(p.t2, 80, 'valid short t2Hint beyond t1 is used verbatim');
  assert.equal(p.rr2, 4);
}
/* Case O: short with t2Hint BETWEEN entry and t1 \u2014 falls back */
{
  const p = hgPlanFromRisk('short', 100, 105, { t1Hint: 90, t2Hint: 95 });
  assert.equal(p.t1, 90);
  assert.equal(p.t2, 100 - 3.5 * 5, 'inverted short t2Hint falls back to t2R policy');
  assert.equal(p.rr2, 3.5);
}
/* Case P: t2Hint on the wrong side entirely \u2014 falls back (rew2 <= 0) */
{
  const p = hgPlanFromRisk('long', 100, 95, { t1Hint: 110, t2Hint: 90 });
  assert.equal(p.t2, 100 + 3.5 * 5, 'wrong-side t2Hint falls back');
}

/* --- version --- */
assert.ok(/^hg-v(?:675|67[6-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v675',
  'HG_VER must be >= hg-v675 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('plans\\.js\\?v=' + qv).test(idx),
  'index.html plans.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v675: plans.js direction-safety guards');
console.log('  * D1: t2Hint requires rew2 > rew1 (no more inverted ladders)');
console.log('  * D2: hgSetupHasLevels enforces long: s<e<t1 and short: s>e>t1');
console.log('  * long/short valid geometries accepted; wrong-side cases rejected');
console.log('  * optional t2 on wrong side rejected');
console.log('  * hgPlanFromRisk: t2Hint beyond t1 used verbatim, between entry and t1 falls back');
console.log('  * wrong-side t2Hint falls back to R-multiple policy target');
console.log('  * unknown dir passes the geometry check (downstream classifies)');
console.log('  * version bumped to ' + HG_VER);
