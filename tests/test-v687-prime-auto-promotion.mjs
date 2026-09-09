/* v687: PRIME auto-promotion via G7 measured-winning gate + omnigold
   tape-override.

   Two changes ship together:

   1) G7 MEASURED-WINNING gate. Symmetric to v685's G6 veto: same 20-
      sample floor, same lookup, opposite polarity. Fires (pass=true)
      only when the log has 20+ observations AND measured expR >= +0.5R.
      Unlike G6 which defaults to pass when data is missing (innocent
      until proven guilty), G7 defaults to FAIL when data is missing
      (proven-innocent bonus). A card that passes all 7 gates is PRIME.

   2) omnigold tape-override. When opts.tapeOverride === true AND G7
      passes AND G3 (tape) fails, an additional virtual point is added
      to the composite score, pushing it to 8 and keeping the grade as
      PRIME. The tape gate STILL fails in the tooltip (\u2717 tape: short)
      so the trader sees the honest risk; only the composite score and
      lead ordering get promoted, plus a \u2605 tape-override marker on
      its own line.

   Why the override is honest.
     * The override only fires when the log has REAL evidence (20+
       samples with expR >= +0.5R) that this specific kind works.
     * The tooltip shows both the ✓ measured-winning and the \u2717 tape
       lines so the trader sees the tension explicitly.
     * The override is per-tab opt-in; only omnigold enables it. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- structural: hg-solidity.js has G7 defined and wired --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/function hgSolGateMeasuredWinning\(plan, opts\)/.test(solSrc),
  'hgSolGateMeasuredWinning defined');
assert.ok(/var HG_SOL_EDGE_PRIME = 0\.5;/.test(solSrc),
  'prime edge floor is 0.5R');
assert.ok(/G\.hgSolGateMeasuredWinning = hgSolGateMeasuredWinning/.test(solSrc),
  'G7 exposed on globalThis');
assert.ok(/'PRIME'/.test(solSrc), 'PRIME label defined in HG_SOL_LABELS');
assert.ok(/HG_SOL_PRIME_MIN = 7/.test(solSrc),
  'HG_SOL_PRIME_MIN = 7');
assert.ok(/HG_SOLIDITY_VERSION = 'v(687|68[8-9]|69\d|[7-9]\d\d|\d{4,})'/.test(solSrc),
  'helper version stamped >= v687');

/* --- structural: omnigold opts into tape-override --- */
const omnigold = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
assert.ok(/tapeOverride: true \/\* v687 omnigold-only opt-in \*\//.test(omnigold),
  'omnigold passes tapeOverride: true');

/* --- structural: omniroute + rsniper do NOT opt into tape-override --- */
const omniroute = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
const rsniper = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');
assert.ok(!/tapeOverride:\s*true/.test(omniroute),
  'omniroute must NOT opt into tape override');
assert.ok(!/tapeOverride:\s*true/.test(rsniper),
  'reversalsniper must NOT opt into tape override');

/* --- runtime: build helper with mockable fwdlog --- */
function buildHelper(fwdStatsFn){
  const fakeG = {};
  if (fwdStatsFn) fakeG.hgFwdStats = fwdStatsFn;
  const fn = new Function('window', `
    var globalThis = window;
    ${solSrc}
    return window;
  `);
  return fn(fakeG);
}

const basePlan = {
  dir: 'long',
  rr1: 3.0, minRr: 2.0,
  consensus: { nAgree: 3 },
  liveGrade: 'fresh',
  tape: 'long',
  stopWidened: false
};

/* --- Case A: G7 defaults to FAIL when no tab/kind (no-lookup) --- */
{
  const api = buildHelper(null);
  const g = api.hgSolidityGrade(basePlan);
  assert.equal(g.gates.measuredWinning.pass, false, 'G7 fails without lookup');
  assert.equal(g.gates.measuredWinning.source, 'no-lookup');
  assert.equal(g.score, 6, '6/7 = SOLID (all quality + G6 no-lookup pass, G7 no-lookup fail)');
  assert.equal(g.grade, 'SOLID');
  assert.equal(g.primeEligible, false);
}

/* --- Case B: expR >= +0.5R -> G7 fires, PRIME grade --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: 0.72 }; });
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG' });
  assert.equal(g.gates.measuredWinning.pass, true, 'G7 fires at expR 0.72');
  assert.equal(g.gates.measuredWinning.expR, 0.72);
  assert.equal(g.gates.measuredWinning.samples, 40);
  assert.equal(g.score, 7, '7/7 = PRIME');
  assert.equal(g.grade, 'PRIME');
  assert.equal(g.primeEligible, true);
  assert.equal(g.leadEligible, true);
}

/* --- Case C: expR at +0.5 floor -> G7 fires (inclusive) --- */
{
  const api = buildHelper(function(){ return { samples: 25, expR: 0.5 }; });
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredWinning.pass, true, 'at prime floor -> pass');
}

/* --- Case D: expR 0.49 -> G7 misses --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: 0.49 }; });
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredWinning.pass, false, 'just below floor -> G7 fail');
  assert.equal(g.grade, 'SOLID', 'SOLID not PRIME');
}

/* --- Case E: too few samples for G7 (even winning) --- */
{
  const api = buildHelper(function(){ return { samples: 8, expR: 2.0 }; });
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredWinning.pass, false, 'too few samples -> G7 fail');
  assert.equal(g.gates.measuredWinning.source, 'too-few-samples');
  assert.equal(g.grade, 'SOLID', 'need real sample size for PRIME');
}

/* --- Case F: omnigold tape-override -> against-tape PRIME still leads --- */
{
  const api = buildHelper(function(){ return { samples: 60, expR: 1.2 }; });
  const againstTape = Object.assign({}, basePlan, { tape: 'short' });
  const g = api.hgSolidityGrade(againstTape, {
    tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG',
    tapeOverride: true /* omnigold opt-in */
  });
  /* G3 tape fails (dir=long, tape=short); G7 fires (60 samples, +1.2R).
     Base score: 5 quality gates pass + G3 fail + G6 pass + G7 pass = 6.
     tapeOverride adds virtual point: 7 = PRIME. Effective score = 7,
     grade = PRIME, leadEligible + primeEligible = true. */
  assert.equal(g.gates.tape.pass, false, 'tape gate still fails honestly');
  assert.equal(g.gates.measuredWinning.pass, true, 'G7 fires');
  assert.equal(g.rawScore, 6, 'raw score before override = 6');
  assert.equal(g.score, 7, 'effective score after override = 7 = PRIME');
  assert.equal(g.grade, 'PRIME');
  assert.equal(g.tapeOverridden, true);
  assert.equal(g.primeEligible, true);
  assert.equal(g.leadEligible, true, 'against-tape PRIME still leads on omnigold');
}

/* --- Case G: same setup WITHOUT tapeOverride -> no override --- */
{
  const api = buildHelper(function(){ return { samples: 60, expR: 1.2 }; });
  const againstTape = Object.assign({}, basePlan, { tape: 'short' });
  const g = api.hgSolidityGrade(againstTape, {
    tab: 'OMNIROUTE', kind: 'FVG'
    /* NO tapeOverride flag */
  });
  assert.equal(g.tapeOverridden, false, 'no override without opt-in');
  assert.equal(g.score, 6, 'raw score preserved: 5 quality pass + G6 pass + G7 pass - G3 fail = 6');
  assert.equal(g.grade, 'SOLID', 'omniroute against-tape stays SOLID (not PRIME)');
  assert.equal(g.primeEligible, false, 'omniroute cannot PRIME against tape');
}

/* --- Case H: tapeOverride but G7 fails -> no override --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: -0.5 }; });
  const againstTape = Object.assign({}, basePlan, { tape: 'short' });
  const g = api.hgSolidityGrade(againstTape, {
    tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG',
    tapeOverride: true
  });
  /* G7 fails because expR -0.5 is way below +0.5 prime floor. Override
     doesn't fire even though flag is on. */
  assert.equal(g.gates.measuredWinning.pass, false);
  assert.equal(g.tapeOverridden, false, 'no override when G7 does not pass');
}

/* --- Case I: tapeOverride when tape ALREADY passes -> no override --- */
{
  const api = buildHelper(function(){ return { samples: 60, expR: 1.2 }; });
  const g = api.hgSolidityGrade(basePlan, {
    tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG',
    tapeOverride: true
  });
  /* Tape already passes so no override needed; grade is normal PRIME. */
  assert.equal(g.gates.tape.pass, true);
  assert.equal(g.gates.measuredWinning.pass, true);
  assert.equal(g.tapeOverridden, false, 'override skipped when tape passes');
  assert.equal(g.score, 7, 'normal 7/7 PRIME');
  assert.equal(g.grade, 'PRIME');
}

/* --- Case J: PRIME cards lead absolute in reorder --- */
{
  const api = buildHelper(null);
  const cards = [
    { id: 'weak', solidity: { score: 1 } },
    { id: 'good', solidity: { score: 5 } },
    { id: 'prime', solidity: { score: 7 } },
    { id: 'solid', solidity: { score: 6 } },
    { id: 'mixed', solidity: { score: 4 } }
  ];
  const out = api.hgSolidityReorder(cards);
  const ids = out.map(c => c.id);
  /* prime bucket: score >= 7 (prime alone).
     lead bucket: score >= 5 & < 7 (good, solid).
     mid bucket: score >= 3 & < 5 (mixed).
     back: score < 3 (weak). */
  assert.deepEqual(ids, ['prime', 'good', 'solid', 'mixed', 'weak']);
}

/* --- Case K: PRIME chip HTML uses ok class + PRIME label --- */
{
  const api = buildHelper(function(){ return { samples: 60, expR: 1.2 }; });
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIROUTE', kind: 'FVG' });
  const html = api.hgSolidityChipHtml(g);
  assert.ok(/SOLIDITY PRIME/.test(html), 'chip text shows PRIME');
  assert.ok(/gpip ok/.test(html), 'PRIME -> ok class');
  assert.ok(/Solidity 7\/7/.test(html), 'chip title 7/7');
}

/* --- Case L: tape-override chip title shows 8/7 (over-max) --- */
{
  const api = buildHelper(function(){ return { samples: 60, expR: 1.2 }; });
  const againstTape = Object.assign({}, basePlan, { tape: 'short' });
  const g = api.hgSolidityGrade(againstTape, {
    tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG',
    tapeOverride: true
  });
  const html = api.hgSolidityChipHtml(g);
  assert.ok(/SOLIDITY PRIME/.test(html));
  /* Score computation with override:
     G1 pass + G2 pass + G3 FAIL (tape short) + G4 pass + G5 pass + G6 pass + G7 pass = 6
     tapeOverride adds virtual +1 -> effective 7. So chip shows 7/7. */
  assert.ok(/Solidity 7\/7/.test(html), 'override PRIME title is 7/7');
}

/* --- Case M: tape-override tooltip has star marker line --- */
{
  const api = buildHelper(function(){ return { samples: 60, expR: 1.2 }; });
  const againstTape = Object.assign({}, basePlan, { tape: 'short' });
  const g = api.hgSolidityGrade(againstTape, {
    tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG',
    tapeOverride: true
  });
  const r = api.hgSolidityReasons(g);
  assert.ok(/\u2717 tape: short/.test(r), 'tape gate still shows honest cross');
  assert.ok(/\u2713 measured-winning: measured 1\.20R over 60 samples/.test(r),
    'G7 line shows the measured win');
  assert.ok(/\u2605 tape-override: PRIME kind overrides adverse tape/.test(r),
    'override marker line present');
  const lines = r.split('\n');
  assert.equal(lines.length, 8, 'seven gate lines + one override marker');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:687|68[8-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v687',
  'HG_VER must be >= hg-v687');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('hg-solidity\\.js\\?v=' + qv).test(idx));
assert.ok(new RegExp('omnigold\\.js\\?v=' + qv).test(idx));

console.log('OK - v687: PRIME auto-promotion + omnigold tape-override');
console.log('  * A: G7 defaults to FAIL without lookup');
console.log('  * B: expR >= +0.5R -> G7 fires -> PRIME');
console.log('  * C: at prime floor -> pass (inclusive)');
console.log('  * D: just below floor -> G7 fail, SOLID');
console.log('  * E: too few samples -> G7 fail, SOLID');
console.log('  * F: omnigold against-tape PRIME leads with override');
console.log('  * G: omniroute against-tape stays SOLID (no override)');
console.log('  * H: override skipped when G7 fails');
console.log('  * I: override skipped when tape already passes');
console.log('  * J: PRIME cards lead absolute in reorder');
console.log('  * K: PRIME chip uses ok class + label');
console.log('  * L: override chip title is 7/7');
console.log('  * M: override tooltip has star marker');
console.log('  * version bumped to ' + HG_VER);
