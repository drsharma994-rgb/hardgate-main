/* v686: extend the v685 measured-edge veto (G6) to the omnigold tab.

   Why. v685 wired G6 into omniroute and reversalsniper but explicitly
   skipped omnigold. That left omnigold cards receiving G6 pass=true
   unconditionally (source='no-lookup'), so a repeatedly-losing gold
   mechanic could still lead the tab.

   Wiring. omnigold records forward-log entries with:
     tab: 'OMNIGOLD:' + cfg.label   (e.g. OMNIGOLD:SWING, OMNIGOLD:SCALP)
     mechanic: c.kind

   The solidity stamper on the SAME tab must look up under the SAME key,
   or the lookup misses and G6 silently passes even when the log has
   plenty of matched samples. This test locks in that the stamper builds
   tab='OMNIGOLD:'+c.horizon and passes kind=c.kind. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- structural: omnigold stamper passes tab + kind --- */
const omnigold = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
assert.ok(/v686: pass tab \+ kind so the measured-edge veto/.test(omnigold),
  'v686 rationale present at stamp site');
assert.ok(/var ogTab = c\.horizon \? \('OMNIGOLD:' \+ String\(c\.horizon\)\) : 'OMNIGOLD';/.test(omnigold),
  'omnigold builds tab key OMNIGOLD:<horizon> with defensive fallback');
assert.ok(/tab: ogTab,\s*\n\s*kind: c\.kind/.test(omnigold),
  'omnigold forwards tab + kind to the solidity grader');

/* --- structural: tab key matches the tab written into the fwd log --- */
/* The record site writes 'OMNIGOLD:' + cfg.label with mechanic: c.kind.
   Confirm both sites still exist and use compatible shapes so the lookup
   won't silently miss. */
assert.ok(/tab: 'OMNIGOLD:' \+ cfg\.label, mechanic: c\.kind/.test(omnigold),
  'record site writes matching key shape (OMNIGOLD:<label>, c.kind)');

/* --- helper version bumped --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/HG_SOLIDITY_VERSION = 'v(686|68[7-9]|69\d|[7-9]\d\d|\d{4,})'/.test(solSrc),
  'helper version stamped >= v686');

/* --- runtime: simulate omnigold plan through the grader with a mock\n   forward log that returns MEASURED-LOSING for one specific (tab, kind)\n   pair. G6 must fail for that pair and pass for a different one. */
const fakeG = {};
/* Mock hgFwdStats: only 'OMNIGOLD:SWING' × 'MSS-LONG' is losing */
fakeG.hgFwdStats = function(tab, kind, ticketOnly){
  if (tab === 'OMNIGOLD:SWING' && kind === 'MSS-LONG') return { samples: 47, expR: -0.31 };
  if (tab === 'OMNIGOLD:SCALP' && kind === 'REV-SNIPER') return { samples: 60, expR: 0.15 };
  return { samples: 0, expR: NaN };
};
const buildFn = new Function('window', `
  var globalThis = window;
  ${solSrc}
  return window;
`);
const api = buildFn(fakeG);

const basePlan = {
  dir: 'long', rr1: 3.0, minRr: 2.0,
  consensus: { nAgree: 3 },
  liveGrade: 'fresh', tape: 'long', stopWidened: false
};

/* --- Case A: losing kind vetoed --- */
{
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG' });
  assert.equal(g.gates.measuredEdge.pass, false, 'losing kind fails G6');
  assert.equal(g.gates.measuredEdge.source, 'measured');
  assert.equal(g.gates.measuredEdge.expR, -0.31);
  assert.equal(g.gates.measuredEdge.samples, 47);
  assert.equal(g.score, 5, 'other five gates pass');
  assert.equal(g.grade, 'GOOD', 'GOOD (still leads but chip warns)');
}

/* --- Case B: winning kind on a different horizon passes --- */
{
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIGOLD:SCALP', kind: 'REV-SNIPER' });
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.expR, 0.15);
  assert.equal(g.score, 6);
  assert.equal(g.grade, 'SOLID');
}

/* --- Case C: same kind but on a horizon with no recorded data passes --- */
{
  /* MSS-LONG under OMNIGOLD:SCALP returns 0 samples in our mock; G6 passes */
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIGOLD:SCALP', kind: 'MSS-LONG' });
  assert.equal(g.gates.measuredEdge.pass, true);
  assert.equal(g.gates.measuredEdge.source, 'too-few-samples');
}

/* --- Case D: absent horizon falls back to bare 'OMNIGOLD' key --- */
/* Verify the runtime effect: build a lookup that only responds to bare\n   'OMNIGOLD' and confirm the stamper wiring pattern (from the source) is\n   compatible \u2014 a card with no c.horizon should still receive a G6\n   lookup rather than skipping G6 entirely. */
{
  const fakeG2 = {};
  fakeG2.hgFwdStats = function(tab, kind){
    if (tab === 'OMNIGOLD') return { samples: 30, expR: 0.4 };
    return { samples: 0 };
  };
  const api2 = new Function('window', `
    var globalThis = window;
    ${solSrc}
    return window;
  `)(fakeG2);
  const g = api2.hgSolidityGrade(basePlan, { tab: 'OMNIGOLD', kind: 'ANY-KIND' });
  assert.equal(g.gates.measuredEdge.source, 'measured', 'bare tab still triggers lookup');
  assert.equal(g.gates.measuredEdge.pass, true);
}

/* --- Case E: tooltip reasons include the omnigold-specific data --- */
{
  const g = api.hgSolidityGrade(basePlan, { tab: 'OMNIGOLD:SWING', kind: 'MSS-LONG' });
  const r = api.hgSolidityReasons(g);
  assert.ok(/\u2717 measured-edge: measured -0\.31R over 47 samples/.test(r),
    'reasons line shows omnigold veto detail');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:686|68[7-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v686',
  'HG_VER must be >= hg-v686');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omnigold\\.js\\?v=' + qv).test(idx));

console.log('OK - v686: measured-edge veto extended to omnigold');
console.log('  * A: OMNIGOLD:SWING × MSS-LONG losing -> G6 fails, chip GOOD');
console.log('  * B: OMNIGOLD:SCALP × REV-SNIPER winning -> G6 passes, SOLID');
console.log('  * C: MSS-LONG on different horizon -> too-few-samples, pass');
console.log('  * D: bare OMNIGOLD tab (no horizon) still triggers lookup');
console.log('  * E: tooltip shows omnigold-specific veto detail');
console.log('  * version bumped to ' + HG_VER);
