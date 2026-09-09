/* v685: MEASURED-EDGE veto as the 6th solidity gate for omniroute and
   reversalsniper.

   Why. Every ship this session gave the tabs better inputs and better
   ranking, but nothing FILTERED cards whose (tab, kind) pair had been
   measured as losing over the accumulated forward log. rsniper's
   rsConviction used bt.expR as a +3 bonus but no code path DEMOTED a
   card whose kind had been running at negative expectancy for enough
   samples to matter. This ship closes that gap.

   G6 reads hgFwdStats(tab, kind). When samples >= 20 AND expR < -0.25
   the gate fails; the card drops one solidity point, which flips a
   would-be GOOD into MIXED and removes the lead slot.

   Innocent until proven guilty: unmeasured setups pass. Feature-checked
   so a missing forward log (test harness, load failure) never penalizes
   anything. Only setups the log has ACTUALLY MEASURED as losing get
   demoted. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- structural asserts --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/function hgSolGateMeasuredEdge\(plan, opts\)/.test(solSrc),
  'hgSolGateMeasuredEdge defined');
assert.ok(/HG_SOL_MIN_EDGE_SAMPLES = 20/.test(solSrc), 'sample floor is 20');
assert.ok(/HG_SOL_EDGE_FLOOR = -0\.25/.test(solSrc), 'expR floor is -0.25');
assert.ok(/HG_SOL_LEAD_MIN = 5/.test(solSrc), 'lead threshold raised to 5');
assert.ok(/HG_SOLIDITY_VERSION = 'v(685|68[6-9]|69\d|[7-9]\d\d|\d{4,})'/.test(solSrc), 'helper version stamped >= v685');
assert.ok(/G\.hgSolGateMeasuredEdge = hgSolGateMeasuredEdge/.test(solSrc),
  'G6 gate exposed on globalThis');

/* --- omniroute passes tab+kind to solidity grader --- */
const omniroute = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
assert.ok(/tab: 'OMNIROUTE',\s*\n\s*kind: c\.kind/.test(omniroute),
  'omniroute forwards tab+kind to solidity grader');

/* --- reversalsniper passes tab+kind --- */
const rsniper = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');
assert.ok(/tab: 'REVERSALSNIPER',\s*\n\s*kind: 'SNIPER-BOUNCE'/.test(rsniper),
  'reversalsniper forwards tab+kind to solidity grader');

/* --- runtime: exercise the G6 gate through hgSolidityGrade --- */
/* Build helper with a mock hgFwdStats attached to fake window. */
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

const p = {
  dir: 'long',
  rr1: 3.0, minRr: 2.0,
  consensus: { nAgree: 3 },
  liveGrade: 'fresh',
  tape: 'long',
  stopWidened: false
};

/* --- Case A: no fwd log helper -> G6 passes (no-fwdlog source) --- */
{
  const api = buildHelper(null);
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'no-fwdlog');
  assert.equal(g.score, 6, 'perfect plan still 6/6');
  assert.equal(g.grade, 'SOLID');
}

/* --- Case B: enough samples, expR ABOVE floor -> G6 passes (measured) --- */
{
  const api = buildHelper(function(tab, kind, ticketOnly){
    return { samples: 50, expR: 0.15 };
  });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'measured');
  assert.equal(g.gates.measuredEdge.expR, 0.15);
  assert.equal(g.gates.measuredEdge.samples, 50);
  assert.equal(g.score, 6);
}

/* --- Case C: enough samples, expR BELOW floor -> G6 fails (veto) --- */
{
  const api = buildHelper(function(tab, kind, ticketOnly){
    return { samples: 47, expR: -0.31 };
  });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredEdge.pass, false, 'measured-losing -> fail');
  assert.equal(g.gates.measuredEdge.source, 'measured');
  assert.equal(g.gates.measuredEdge.expR, -0.31);
  assert.equal(g.gates.measuredEdge.samples, 47);
  assert.equal(g.score, 5, '5 other gates pass, G6 fails -> 5');
  assert.equal(g.grade, 'GOOD', 'still leads via GOOD but chip warns');
  assert.equal(g.leadEligible, true, 'GOOD >= 5 = leadEligible');
}

/* --- Case D: expR exactly AT floor -> pass (>= is inclusive) --- */
{
  const api = buildHelper(function(){ return { samples: 25, expR: -0.25 }; });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'OB' });
  assert.equal(g.gates.measuredEdge.pass, true, 'at floor -> pass');
}

/* --- Case E: too few samples -> pass (too-few-samples source) --- */
{
  const api = buildHelper(function(){ return { samples: 8, expR: -0.9 }; });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'BOS' });
  assert.equal(g.gates.measuredEdge.pass, true, 'small sample -> innocent');
  assert.equal(g.gates.measuredEdge.source, 'too-few-samples');
  assert.equal(g.gates.measuredEdge.samples, 8);
}

/* --- Case F: expR NaN -> pass (no data to punish on) --- */
{
  const api = buildHelper(function(){ return { samples: 50, expR: NaN }; });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'expR-nan');
}

/* --- Case G: fwd log throws -> pass (fwdlog-error source) --- */
{
  const api = buildHelper(function(){ throw new Error('boom'); });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'fwdlog-error');
}

/* --- Case H: no tab/kind opts -> pass (no-lookup source, backward compat) --- */
{
  const api = buildHelper(function(){ return { samples: 50, expR: -0.9 }; });
  /* Even with the losing stats, passing no opts skips the lookup. */
  const g = api.hgSolidityGrade(p);
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'no-lookup');
}

/* --- Case I: full veto changes lead-eligibility for a marginal plan --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: -0.5 }; });
  /* A plan that's already GOOD (4/5 on old scale = 5 gates pass): tape
     adverse fails G3, so score = 4 passes + 1 G6 fail = 4. That was GOOD
     before v685; now MIXED = not lead-eligible. */
  const marginal = Object.assign({}, p, { tape: 'short' });
  const g = api.hgSolidityGrade(marginal, { tab: 'OMNIROUTE', kind: 'FVG' });
  assert.equal(g.score, 4, '4 gates pass out of 6');
  assert.equal(g.grade, 'MIXED');
  assert.equal(g.leadEligible, false, 'MIXED cannot lead');
}

/* --- Case J: reasons string shows the measured-edge line --- */
{
  const api = buildHelper(function(){ return { samples: 47, expR: -0.31 }; });
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' });
  const r = api.hgSolidityReasons(g);
  assert.ok(/\u2717 measured-edge: measured -0\.31R over 47 samples/.test(r),
    'reason line shows expR and sample count');
  const lines = r.split('\n');
  assert.equal(lines.length, 6, 'six lines total');
}

/* --- Case K: chip title includes /6 not /5 --- */
{
  const api = buildHelper(null);
  const g = api.hgSolidityGrade(p);
  const html = api.hgSolidityChipHtml(g);
  assert.ok(/Solidity 6\/6/.test(html), 'chip shows /6 (v685 scale)');
}

/* --- Case L: reorder uses new HG_SOL_LEAD_MIN --- */
{
  const api = buildHelper(null);
  const cards = [
    { id: 'weak', solidity: { score: 1 } },
    { id: 'thin', solidity: { score: 2 } },
    { id: 'mixed', solidity: { score: 4 } },
    { id: 'good', solidity: { score: 5 } },
    { id: 'solid', solidity: { score: 6 } }
  ];
  const out = api.hgSolidityReorder(cards);
  const ids = out.map(c => c.id);
  /* Reorder is stable within each bucket, so within the back bucket the
     input order (weak before thin) is preserved. Lead bucket: score>=5 =
     good, solid; mid: 3-4 = mixed; back: <=2 = weak, thin. */
  assert.deepEqual(ids, ['good', 'solid', 'mixed', 'weak', 'thin']);
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:685|68[6-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v685',
  'HG_VER must be >= hg-v685');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('hg-solidity\\.js\\?v=' + qv).test(idx));

console.log('OK - v685: MEASURED-EDGE veto as G6 solidity gate');
console.log('  * A: no fwd log -> pass (no-fwdlog)');
console.log('  * B: measured winning -> pass');
console.log('  * C: measured losing -> fail, GOOD chip, still leads');
console.log('  * D: expR at floor -> pass (inclusive)');
console.log('  * E: too few samples -> pass (innocent)');
console.log('  * F: expR NaN -> pass (no data)');
console.log('  * G: fwd log throws -> pass (error contained)');
console.log('  * H: no tab/kind -> pass (backward compat)');
console.log('  * I: veto flips marginal plan out of lead');
console.log('  * J: reasons string shows measured-edge line');
console.log('  * K: chip title uses /6 scale');
console.log('  * L: reorder uses new lead threshold >=5');
console.log('  * version bumped to ' + HG_VER);
