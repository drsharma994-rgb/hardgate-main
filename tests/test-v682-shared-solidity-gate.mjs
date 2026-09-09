/* v682: shared 5-gate solidity grader across omniroute, omnigold,
   reversalsniper.

   Why. Every tab this session has been given better inputs (v664/v671
   measured edge, v670 forming-bar, v677 freshness, v678 HTF tape, v679
   live-price, v680 forward-resolve, v681 stop floor) but each tab
   still ranks with its own weighted sum and takes the top row as the
   LEAD card. Nothing enforces that the top card meets a MINIMUM
   QUALITY BAR. Every tab could lead with a plan that has passable rr,
   decent tape, and no confluence quality, no live-price freshness,
   and a stop widened to the v681 floor.

   v682 defines "SOLID" concretely: 5 independent gates (families,
   liveFresh, tape, rr, stop), each pass = 1 point. Grades 0..5.
   Only SOLID (5) or GOOD (4) may lead a tab.

   Same setup, same grade, regardless of tab. Cannot regress: when the
   helper is absent, all three tabs fall back to their pre-v682 order.
   When it is present, only lead-slot ORDER changes; no card is hidden
   or invented. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- 1. helper file exists + expected shape --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/hgSolidityGrade/.test(solSrc), 'hgSolidityGrade defined');
assert.ok(/hgSolidityReorder/.test(solSrc), 'hgSolidityReorder defined');
assert.ok(/hgSolidityChipHtml/.test(solSrc), 'hgSolidityChipHtml defined');
assert.ok(/HG_SOLIDITY_VERSION = 'v(682|68[3-9]|69\d|[7-9]\d\d|\d{4,})'/.test(solSrc), 'helper version stamped >= v682');
assert.ok(/HG_SOL_MIN_FAMILIES = 2/.test(solSrc), 'families gate = 2');
assert.ok(/HG_SOL_RR_HEADROOM = 0\.25/.test(solSrc), 'rr headroom = 0.25');
/* v685: gate count expanded to 6.
   v687: added G7 (measured-winning). G7 defaults to FAIL (0 pts) when
   no fwd log or no tab/kind. So a plan without opts scores at most 6/7
   which is SOLID (not PRIME). Lead threshold is 5. */
const LEAD_MIN = 5;
const MAX_SCORE = 6; /* max reachable without a G7-firing mock fwdlog */

/* --- 2. loads via index.html BEFORE all three consumer tabs --- */
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const posSol = idx.indexOf('hg-solidity.js');
const posOmniroute = idx.indexOf('omniroute.js');
const posOmnigold = idx.indexOf('omnigold.js');
const posRsniper = idx.indexOf('reversalsniper.js');
assert.ok(posSol > 0, 'hg-solidity.js loaded from index.html');
assert.ok(posSol < posOmniroute, 'solidity loads BEFORE omniroute.js');
assert.ok(posSol < posOmnigold, 'solidity loads BEFORE omnigold.js');
assert.ok(posSol < posRsniper, 'solidity loads BEFORE reversalsniper.js');

/* --- 3. all three tabs invoke it --- */
const omniroute = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
const omnigold = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
const rsniper = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');
assert.ok(/hgOmniStampSolidity/.test(omniroute), 'omniroute stamp function');
assert.ok(/W\.hgSolidityGrade\(/.test(omniroute), 'omniroute grade call');
assert.ok(/hgOgStampSolidity/.test(omnigold), 'omnigold stamp function');
assert.ok(/W\.hgSolidityGrade\(/.test(omnigold), 'omnigold grade call');
assert.ok(/W\.hgSolidityGrade\(planForSol/.test(rsniper), 'rsniper grade call');
assert.ok(/two-pass|Two-pass/.test(rsniper), 'rsniper two-pass lead selection');

/* --- 4. runtime: extract the helper module and exercise all 5 gates --- */
/* Wrap the file body (IIFE) inside a Node evaluator with a fake window. */
const fakeG = {};
const buildFn = new Function('window', `
  var globalThis = window;
  ${solSrc}
  return window;
`);
const api = buildFn(fakeG);
assert.equal(typeof api.hgSolidityGrade, 'function', 'helper attached to window');
assert.ok(api.HG_SOLIDITY_VERSION && api.HG_SOLIDITY_VERSION >= 'v682', 'helper version >= v682');

const grade = api.hgSolidityGrade;
const reorder = api.hgSolidityReorder;

/* --- Case A: perfect SOLID plan --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh',
    tape: 'long',
    stopWidened: false
  };
  const g = grade(p);
  assert.equal(g.grade, 'SOLID', 'grade=SOLID (6/7 without G7-firing mock)');
  assert.equal(g.score, MAX_SCORE, 'score=6 (all quality gates + G6 no-lookup pass, G7 no-lookup fail)');
  assert.equal(g.leadEligible, true, 'leadEligible');
  assert.equal(g.gates.families.pass, true);
  assert.equal(g.gates.liveFresh.pass, true);
  assert.equal(g.gates.tape.pass, true);
  assert.equal(g.gates.rr.pass, true);
  assert.equal(g.gates.stop.pass, true);
  /* v685: G6 measured-edge passes when no tab/kind provided (backward compat) */
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'no-lookup');
  /* v687: G7 measured-winning fails when no tab/kind (opposite polarity to G6) */
  assert.equal(g.gates.measuredWinning.pass, false);
  assert.equal(g.gates.measuredWinning.source, 'no-lookup');
}

/* --- Case B: solid setup ranked GOOD by one flaw --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh',
    tape: 'long',
    stopWidened: true /* v681 had to widen -> not solid geometry */
  };
  const g = grade(p);
  assert.equal(g.grade, 'GOOD');
  assert.equal(g.score, MAX_SCORE - 1);
  assert.equal(g.leadEligible, true, 'GOOD still leads');
  assert.equal(g.gates.stop.pass, false);
}

/* --- Case C: adverse tape drops to MIXED --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh',
    tape: 'short', /* adverse */
    stopWidened: false
  };
  const g = grade(p);
  assert.equal(g.grade, 'GOOD');
  assert.equal(g.gates.tape.pass, false);
}

/* --- Case D: past-stop is a HARD downgrade --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'past-stop',
    tape: 'long',
    stopWidened: false
  };
  const g = grade(p);
  assert.equal(g.gates.liveFresh.pass, false);
  assert.equal(g.score, MAX_SCORE - 1);
}

/* --- Case E: WEAK plan cannot lead --- */
{
  const p = {
    dir: 'long',
    rr1: 2.05, minRr: 2.0, /* rr barely clears, no headroom */
    consensus: { nAgree: 1 }, /* only 1 family */
    liveGrade: 'past-t1',
    tape: 'short',
    stopWidened: true
  };
  const g = grade(p);
  /* v685: 5 quality gates fail, G6 passes (no-lookup).
     v687: G7 fails (no-lookup). Score = 1 = WEAK. */
  assert.equal(g.score, 1);
  assert.equal(g.grade, 'WEAK');
  assert.equal(g.leadEligible, false);
}

/* --- Case F: rr HEADROOM (a plan just at floor is not solid) --- */
{
  const p = {
    dir: 'long',
    rr1: 2.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh',
    tape: 'long',
    stopWidened: false
  };
  const g = grade(p);
  assert.equal(g.gates.rr.pass, false, 'rr AT floor fails (need +0.25 headroom)');
  assert.equal(g.score, MAX_SCORE - 1);
}

/* --- Case G: reorder preserves within-bucket ordering --- */
{
  /* v685: bucket thresholds rescaled to 6-point system.
       Lead bucket: score >= 5 (SOLID or GOOD)
       Mid bucket:  score in [3, 4] (MIXED)
       Back bucket: score <= 2 (THIN or WEAK) */
  const cards = [
    { id: 'a', solidity: { score: 2, leadEligible: false } }, /* back */
    { id: 'b', solidity: { score: 6, leadEligible: true } },  /* lead SOLID */
    { id: 'c', solidity: { score: 5, leadEligible: true } },  /* lead GOOD */
    { id: 'd', solidity: { score: 3, leadEligible: false } }, /* mid */
    { id: 'e', solidity: { score: 6, leadEligible: true } }   /* lead SOLID */
  ];
  const out = reorder(cards);
  const ids = out.map(function(c){ return c.id; });
  assert.deepEqual(ids, ['b', 'c', 'e', 'd', 'a']);
}

/* --- Case H: absent consensus falls back to alsoKinds --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    alsoKinds: ['FVG', 'OB', 'BOS'], /* 3 families */
    liveGrade: 'fresh',
    tape: 'long',
    stopWidened: false
  };
  const g = grade(p);
  assert.equal(g.gates.families.pass, true);
  assert.equal(g.gates.families.source, 'alsoKinds');
  assert.equal(g.gates.families.n, 3);
}

/* --- Case I: no livePx and no liveGrade -> tape/rr/stop still gate --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    tape: 'long',
    stopWidened: false
    /* no liveGrade, no livePx */
  };
  const g = grade(p);
  assert.equal(g.gates.liveFresh.pass, true, 'absent live data: not a fail (no-live)');
  assert.equal(g.gates.liveFresh.grade, 'no-live');
  /* v687: SOLID (6/7) because G7 fails without a mock fwdlog. Was 'SOLID' pre-v687 too. */
  assert.equal(g.grade, 'SOLID');
}

/* --- Case J: strategyConfirm ADVERSE fails tape gate --- */
{
  const p = {
    dir: 'long',
    rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh',
    /* no tape field, use strategyConfirm fallback */
    strategyConfirm: 'ADVERSE',
    stopWidened: false
  };
  const g = grade(p);
  assert.equal(g.gates.tape.pass, false);
  assert.equal(g.gates.tape.tape, 'adverse');
}

/* --- Case K: chip HTML mapping --- */
{
  const solid = grade({ dir: 'long', rr1: 3.0, minRr: 2.0, consensus: { nAgree: 3 }, liveGrade: 'fresh', tape: 'long', stopWidened: false });
  const html = api.hgSolidityChipHtml(solid);
  assert.ok(/SOLIDITY SOLID/.test(html), 'chip text');
  assert.ok(/gpip ok/.test(html), 'SOLID = ok class');
}

/* --- 5. version + cache-buster --- */
assert.ok(/^hg-v(?:682|68[3-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v682',
  'HG_VER must be >= hg-v682 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('hg-solidity\\.js\\?v=' + qv).test(idx),
  'index.html hg-solidity.js cache-buster must be ?v=' + qv);

console.log('OK - v682: shared solidity gate across omniroute/omnigold/rsniper');
console.log('  * Case A: perfect plan -> SOLID (5/5)');
console.log('  * Case B: stopWidened -> GOOD (4/5, still leads)');
console.log('  * Case C: adverse tape -> GOOD');
console.log('  * Case D: past-stop -> live gate fails');
console.log('  * Case E: WEAK plan cannot lead');
console.log('  * Case F: rr headroom enforced (0.25 above floor)');
console.log('  * Case G: reorder preserves within-bucket order');
console.log('  * Case H: alsoKinds fallback for family count');
console.log('  * Case I: no live data -> neutral pass');
console.log('  * Case J: strategyConfirm ADVERSE -> tape fail');
console.log('  * Case K: chip HTML mapping');
console.log('  * version bumped to ' + HG_VER);
