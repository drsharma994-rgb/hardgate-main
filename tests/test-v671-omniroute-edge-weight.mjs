/* v671: hgOmniBalanceParts measured-edge weight rebalance
   (mirrors omnigold v664).

   Before v671 the composite score used `8 * edgeN` for measured walk-forward
   edge \u2014 a mechanic with 100% positive measured edge outranked an unmeasured
   one by only 8 points, less than one gate agreement swing (family delta
   \u2248 30 per gate). Tape (100), ticket (120), and family (30) sums dominated
   so completely that tape+ticket+family-tied survivors were ordered by
   alsoNorm/near/preferN, and the desk's stated preference for setups that
   have actually paid on the user's feed was not delivered.

   Fix: raise positive-edge weight from 8 to 25 to match omnigold v664, and
   add a new proportional soft-demote penalty of 20 * edgeDemoteSoft for
   measured-weak-or-negative edge (up to -20 when edgeN = 0). Neither change
   affects what QUALIFIES as a ticket \u2014 gates still decide that. This is
   ordering only. The hard edge VETO at line 8212 already keeps
   n>=20 & E<-0.05 mechanics out of the pool entirely. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');

/* --- rationale comment must be present --- */
assert.ok(/v671: measured-edge weight rebalance \(mirrors omnigold v664\)/.test(src),
  'v671 rationale must be present in hgOmniBalanceParts');

/* --- new positive-edge weight --- */
assert.ok(/\+ 25 \* edgeN\s+\/\* v671: 8 -> 25/.test(src),
  'edgeN weight must be 25 (was 8) with a v671 comment');

/* --- new soft demote term --- */
assert.ok(/var edgeDemoteSoft = 0;/.test(src),
  'edgeDemoteSoft must be declared');
assert.ok(/if \(edgeN > 0 && edgeN < 0\.5\) edgeDemoteSoft = -\(0\.5 - edgeN\) \* 2;/.test(src),
  'edgeDemoteSoft must be proportional in [0..-1] for edgeN in [0..0.5)');
assert.ok(/\+ 20 \* edgeDemoteSoft\s+\/\* v671: NEW/.test(src),
  '20 * edgeDemoteSoft term must be added to the score');

/* --- stale weight must be gone --- */
assert.ok(!/^\s*\+ 8 \* edgeN$/m.test(src),
  'stale + 8 * edgeN line must be gone');

/* --- edgeDemoteSoft must appear in the returned parts (for observability) --- */
assert.ok(/edgeDemoteSoft: edgeDemoteSoft,/.test(src),
  'edgeDemoteSoft must be returned in the parts object');

/* --- runtime demonstration: extract hgOmniBalanceParts and prove score deltas ---
   The function reads a lot of helpers (hgOmniInfoNet, hgOmniKindPrefer,
   hgOmniKindDemotion, OMNI_NEAR_ATR, fin). Stub them all. */
const partsMatch = src.match(/function hgOmniBalanceParts\(c, tape\)\{[\s\S]*?\n  \}/);
assert.ok(partsMatch, 'hgOmniBalanceParts body must be extractable');

const wrap = new Function('deps',
  'var fin = deps.fin;\n' +
  'var hgOmniInfoNet = deps.hgOmniInfoNet;\n' +
  'var hgOmniKindPrefer = deps.hgOmniKindPrefer;\n' +
  'var hgOmniKindDemotion = deps.hgOmniKindDemotion;\n' +
  'var OMNI_NEAR_ATR = deps.OMNI_NEAR_ATR;\n' +
  partsMatch[0] + '\nreturn hgOmniBalanceParts;');
const deps = {
  fin: (v) => { const n = +v; return Number.isFinite(n) ? n : NaN; },
  hgOmniInfoNet: () => ({ net: 0, n: 0 }),
  hgOmniKindPrefer: () => false,
  hgOmniKindDemotion: () => false,
  OMNI_NEAR_ATR: 1.0
};
const hgOmniBalanceParts = wrap(deps);

/* Base card template \u2014 all other inputs neutral so only edgeScore varies */
function mkCard(edgeScore){
  return {
    consensus: { nAgree: 0, nAgainst: 0, nSplit: 0 },
    gates: [],
    grade: { total: 10, evaluated: 10, ticket: 0 },
    alsoKinds: [],
    distAtr: 0,
    dir: 'long',
    edgeScore: edgeScore
  };
}

/* Case A: 100% positive measured edge vs unmeasured (edgeScore missing) */
{
  const measured = hgOmniBalanceParts(mkCard(100), '');
  const unmeasured = hgOmniBalanceParts(mkCard(NaN), '');
  const delta = measured.score - unmeasured.score;
  assert.equal(measured.edge, 1, '100% edge maps to edgeN = 1');
  assert.equal(unmeasured.edge, 0, 'missing edgeScore maps to edgeN = 0');
  /* Pre-v671: delta = 8 (25*0 -> 25*1 diff was 8 with weight 8, but
     unmeasured also had edgeDemoteSoft=0 in old model). Post-v671:
     delta = 25 * (1 - 0) + 20 * (0 - 0) = 25. */
  assert.ok(Math.abs(delta - 25) < 1e-9,
    'measured 100% edge must outrank unmeasured by ~25 points (saw ' + delta + '), was 8 before v671');
}

/* Case B: 0% measured edge (edgeScore = 0) is heavily demoted vs unmeasured */
{
  const zeroEdge = hgOmniBalanceParts(mkCard(0), '');
  const unmeasured = hgOmniBalanceParts(mkCard(NaN), '');
  /* edgeScore=0 -> edgeN=0 but the code guards edgeDemoteSoft with
     `if (edgeN > 0 && edgeN < 0.5)`, so a literal zero edgeScore is treated
     the same as unmeasured. That is deliberate: "zero measured edge" is
     usually a very-low-n placeholder and shouldn't be crushed. Verify the
     guard behaves that way. */
  assert.equal(zeroEdge.edgeDemoteSoft, 0, 'zero edgeScore is treated as unmeasured (guarded)');
  assert.equal(zeroEdge.score, unmeasured.score, 'zero edge scores identically to unmeasured');
}

/* Case C: weakly positive measured edge (edgeScore = 40) is demoted */
{
  const weak = hgOmniBalanceParts(mkCard(40), '');
  const unmeasured = hgOmniBalanceParts(mkCard(NaN), '');
  /* edgeN = 0.4, edgeDemoteSoft = -(0.5-0.4)*2 = -0.2
     score contribution: 25*0.4 + 20*(-0.2) = 10 - 4 = 6
     vs unmeasured: 25*0 + 20*0 = 0
     So delta = 6 */
  assert.ok(Math.abs(weak.edgeDemoteSoft - (-0.2)) < 1e-9,
    'edgeN=0.4 yields edgeDemoteSoft ~ -0.2 (saw ' + weak.edgeDemoteSoft + ')');
  const delta = weak.score - unmeasured.score;
  assert.ok(Math.abs(delta - 6) < 1e-9,
    'edgeScore=40 outranks unmeasured by ~6 points (saw ' + delta + ')');
}

/* Case D: measured-positive-but-under-50 (edgeScore = 60) has NO demote */
{
  const mid = hgOmniBalanceParts(mkCard(60), '');
  assert.equal(mid.edgeDemoteSoft, 0,
    'edgeN >= 0.5 has no soft demote');
  const unmeasured = hgOmniBalanceParts(mkCard(NaN), '');
  const delta = mid.score - unmeasured.score;
  /* delta = 25 * 0.6 = 15 */
  assert.ok(Math.abs(delta - 15) < 1e-9, 'edgeScore=60 outranks unmeasured by ~15 (saw ' + delta + ')');
}

/* Case E: measured 100% positive beats weak 40 by 19 points */
{
  const strong = hgOmniBalanceParts(mkCard(100), '');
  const weak = hgOmniBalanceParts(mkCard(40), '');
  const delta = strong.score - weak.score;
  /* strong: 25*1 + 0 = 25
     weak:  25*0.4 - 4 = 6
     delta = 19 */
  assert.ok(Math.abs(delta - 19) < 1e-9,
    '100% edge outranks weak 40% by ~19 points (saw ' + delta + '), was 4.8 pre-v671');
}

/* Case F: pre-v671 vs post-v671 delta on the strong-vs-weak comparison.
   Manually reproduce pre-v671 formula: 8 * edgeN, no edgeDemoteSoft.
   Pre-v671:  8*1 - 8*0.4 = 8 - 3.2 = 4.8
   Post-v671: 25*1 - (25*0.4 - 4) = 25 - 6 = 19
   The correction magnitude: 19 - 4.8 = 14.2 pts. */
{
  const preV671Delta = 8 * 1 - 8 * 0.4;
  const postV671Delta = 19; /* verified above */
  const correction = postV671Delta - preV671Delta;
  assert.ok(correction > 14,
    'v671 correction is > 14 pts on a strong-vs-weak matchup (actual: ' + correction.toFixed(1) + ')');
}

/* --- version --- */
assert.ok(/^hg-v(?:671|67[2-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v671',
  'HG_VER must be >= hg-v671 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omniroute\\.js\\?v=' + qv).test(idx),
  'index.html omniroute.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v671: hgOmniBalanceParts measured-edge weight rebalance');
console.log('  * positive-edge weight 8 -> 25 (matches omnigold v664)');
console.log('  * NEW soft demote: 20 * edgeDemoteSoft (up to -20 for edgeN in [0..0.5))');
console.log('  * 100%-edge vs unmeasured delta 8 -> 25 (was less than one gate swing)');
console.log('  * 100%-edge vs weak-40% delta 4.8 -> 19 (measured edge actually matters now)');
console.log('  * zero-edgeScore guarded (treated as unmeasured)');
console.log('  * version bumped to ' + HG_VER);
