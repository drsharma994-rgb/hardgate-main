/* v689: KILL-LIST for proven-losing kinds across all three tabs.

   Symmetric to the v685/v687 veto/promotion machinery but with stricter
   thresholds and destructive effect: kinds with 30+ recorded outcomes
   AND expR < -0.5R are REMOVED from the visible list entirely instead of
   merely demoted.

   Thresholds are deliberately more conservative than G6 veto because
   the effect is destructive:
     * 30 samples (vs G6's 20): stricter statistical evidence
     * -0.5R (vs G6's -0.25R): only egregiously losing kinds get killed

   Recovery is automatic: if new samples land and expR recovers above
   -0.5R (or through the stale-sample decay in hgFwdStats), the kind
   reappears on the next scan. Nothing needs manual unkilling.

   The tab renders a KILLED note listing how many setups were hidden and
   which kinds so the filter action is transparent. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- structural: hg-solidity.js has the kill machinery --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/function hgSolidityIsKilled\(tab, kind\)/.test(solSrc),
  'hgSolidityIsKilled defined');
assert.ok(/var HG_SOL_KILL_MIN_SAMPLES = 30;/.test(solSrc),
  'kill sample threshold = 30');
assert.ok(/var HG_SOL_KILL_EDGE_FLOOR = -0\.5;/.test(solSrc),
  'kill expR floor = -0.5');
assert.ok(/G\.hgSolidityIsKilled = hgSolidityIsKilled/.test(solSrc),
  'hgSolidityIsKilled exposed on globalThis');
assert.ok(/G\.hgSolidityKilledNoteHtml = hgSolidityKilledNoteHtml/.test(solSrc),
  'hgSolidityKilledNoteHtml exposed');
assert.ok(/G\.hgSolidityLastKilled = hgSolidityLastKilled/.test(solSrc),
  'hgSolidityLastKilled exposed');
assert.ok(/HG_SOLIDITY_VERSION = 'v689'/.test(solSrc),
  'helper stamped v689');

/* --- structural: omniroute + omnigold pass tab to reorder --- */
const omniroute = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
const omnigold = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
const rsniper = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');
assert.ok(/hgSolidityReorder\(sorted, \{ tab: 'OMNIROUTE' \}\)/.test(omniroute),
  'omniroute reorder passes tab');
assert.ok(/hgSolidityReorder\(sorted, \{ tab: 'OMNIGOLD' \}\)/.test(omnigold),
  'omnigold reorder passes tab');

/* --- structural: killed-note rendered in each tab --- */
assert.ok(/v689: KILLED note/.test(omniroute), 'omniroute renders KILLED note');
assert.ok(/hgSolidityLastKilled\('OMNIROUTE'\)/.test(omniroute),
  'omniroute reads OMNIROUTE killed stats');
assert.ok(/v689: KILLED note/.test(omnigold), 'omnigold renders KILLED note');
assert.ok(/hgSolidityLastKilled\('OMNIGOLD'\)/.test(omnigold),
  'omnigold reads OMNIGOLD killed stats');
assert.ok(/v689: kill-list/.test(rsniper), 'rsniper filters killed results');
assert.ok(/W\.__hgSolKillLast\['REVERSALSNIPER'\]/.test(rsniper),
  'rsniper stashes killed stats under REVERSALSNIPER key');
assert.ok(/#rsKilledNote/.test(rsniper), 'rsniper has KILLED note DOM slot');
assert.ok(/refreshKilledNote\(\)/.test(rsniper), 'rsniper refreshes KILLED note');

/* --- runtime: hgSolidityIsKilled behavior --- */
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

/* --- Case A: no tab or no kind -> not killed (no-lookup) --- */
{
  const api = buildHelper(function(){ return { samples: 100, expR: -0.9 }; });
  assert.equal(api.hgSolidityIsKilled(null, 'K').killed, false);
  assert.equal(api.hgSolidityIsKilled('T', null).killed, false);
  assert.equal(api.hgSolidityIsKilled(null, null).source, 'no-lookup');
}

/* --- Case B: no fwd log -> not killed (no-fwdlog) --- */
{
  const api = buildHelper(null);
  const k = api.hgSolidityIsKilled('OMNIROUTE', 'FVG');
  assert.equal(k.killed, false);
  assert.equal(k.source, 'no-fwdlog');
}

/* --- Case C: 30+ samples AND expR < -0.5 -> KILLED --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: -0.7 }; });
  const k = api.hgSolidityIsKilled('OMNIROUTE', 'FVG');
  assert.equal(k.killed, true);
  assert.equal(k.source, 'measured');
  assert.equal(k.samples, 40);
  assert.equal(k.expR, -0.7);
  assert.equal(k.threshold, -0.5);
}

/* --- Case D: exactly at kill floor (-0.5) -> NOT killed (< is exclusive) --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: -0.5 }; });
  const k = api.hgSolidityIsKilled('OMNIROUTE', 'FVG');
  assert.equal(k.killed, false, 'at floor: not killed');
}

/* --- Case E: below kill floor by 0.001 -> KILLED --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: -0.501 }; });
  assert.equal(api.hgSolidityIsKilled('OMNIROUTE', 'FVG').killed, true);
}

/* --- Case F: too few samples -> NOT killed (need >=30) --- */
{
  const api = buildHelper(function(){ return { samples: 25, expR: -0.9 }; });
  const k = api.hgSolidityIsKilled('OMNIROUTE', 'FVG');
  assert.equal(k.killed, false);
  assert.equal(k.source, 'too-few-samples');
  assert.equal(k.samples, 25);
}

/* --- Case G: fwd log throws -> NOT killed (contained) --- */
{
  const api = buildHelper(function(){ throw new Error('boom'); });
  const k = api.hgSolidityIsKilled('OMNIROUTE', 'FVG');
  assert.equal(k.killed, false);
  assert.equal(k.source, 'fwdlog-error');
}

/* --- Case H: NaN expR -> NOT killed (no data to punish on) --- */
{
  const api = buildHelper(function(){ return { samples: 40, expR: NaN }; });
  const k = api.hgSolidityIsKilled('OMNIROUTE', 'FVG');
  assert.equal(k.killed, false);
  assert.equal(k.source, 'expR-nan');
}

/* --- Case I: hgSolidityGrade attaches killed flag when kind is killed --- */
{
  const api = buildHelper(function(tab, kind){
    if (kind === 'BAD') return { samples: 40, expR: -0.7 };
    return { samples: 0, expR: NaN };
  });
  const p = {
    dir: 'long', rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 }, liveGrade: 'fresh', tape: 'long', stopWidened: false
  };
  const bad = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'BAD' });
  assert.equal(bad.killed, true, 'BAD kind is killed');
  assert.equal(bad.killReason.samples, 40);
  const good = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'GOOD' });
  assert.equal(good.killed, false, 'GOOD kind not killed');
}

/* --- Case J: hgSolidityReorder filters killed cards + reports stats --- */
{
  const api = buildHelper(function(tab, kind){
    if (kind === 'BAD') return { samples: 40, expR: -0.7 };
    return { samples: 0, expR: NaN };
  });
  const cards = [
    { id: 'a', kind: 'GOOD', solidity: api.hgSolidityGrade(
      { dir: 'long', rr1: 3, minRr: 2, consensus: { nAgree: 3 },
        liveGrade: 'fresh', tape: 'long', stopWidened: false },
      { tab: 'OMNIROUTE', kind: 'GOOD' }
    ) },
    { id: 'b', kind: 'BAD', solidity: api.hgSolidityGrade(
      { dir: 'long', rr1: 3, minRr: 2, consensus: { nAgree: 3 },
        liveGrade: 'fresh', tape: 'long', stopWidened: false },
      { tab: 'OMNIROUTE', kind: 'BAD' }
    ) },
    { id: 'c', kind: 'BAD', solidity: api.hgSolidityGrade(
      { dir: 'long', rr1: 3, minRr: 2, consensus: { nAgree: 3 },
        liveGrade: 'fresh', tape: 'long', stopWidened: false },
      { tab: 'OMNIROUTE', kind: 'BAD' }
    ) },
    { id: 'd', kind: 'GOOD', solidity: api.hgSolidityGrade(
      { dir: 'long', rr1: 3, minRr: 2, consensus: { nAgree: 3 },
        liveGrade: 'fresh', tape: 'long', stopWidened: false },
      { tab: 'OMNIROUTE', kind: 'GOOD' }
    ) }
  ];
  const out = api.hgSolidityReorder(cards, { tab: 'OMNIROUTE' });
  assert.equal(out.length, 2, 'two killed cards filtered out');
  assert.deepEqual(out.map(c => c.id), ['a', 'd']);
  assert.equal(out.killedCount, 2);
  assert.equal(out.killedKinds.BAD, 2);
}

/* --- Case K: hgSolidityLastKilled reads stash back --- */
{
  const api = buildHelper(function(tab, kind){
    if (kind === 'BAD') return { samples: 40, expR: -0.7 };
    return { samples: 0, expR: NaN };
  });
  const cards = [
    { kind: 'BAD', solidity: api.hgSolidityGrade(
      { dir: 'long', rr1: 3, minRr: 2, consensus: { nAgree: 3 },
        liveGrade: 'fresh', tape: 'long', stopWidened: false },
      { tab: 'OMNIROUTE', kind: 'BAD' }
    ) }
  ];
  api.hgSolidityReorder(cards, { tab: 'OMNIROUTE' });
  const stash = api.hgSolidityLastKilled('OMNIROUTE');
  assert.equal(stash.killedCount, 1);
  assert.equal(stash.killedKinds.BAD, 1);
  /* Reading a tab with no reorder happened yet returns null. */
  assert.equal(api.hgSolidityLastKilled('OTHERTAB'), null);
}

/* --- Case L: hgSolidityKilledNoteHtml formats note --- */
{
  const api = buildHelper(null);
  /* Empty -> empty string */
  assert.equal(api.hgSolidityKilledNoteHtml(null), '');
  assert.equal(api.hgSolidityKilledNoteHtml({ killedCount: 0 }), '');
  /* Single killed */
  const single = api.hgSolidityKilledNoteHtml({
    killedCount: 1,
    killedKinds: { 'BAD': 1 }
  });
  assert.ok(/1 proven-losing setup hidden/.test(single), 'singular grammar');
  assert.ok(/\(BAD\)/.test(single), 'kind name in note');
  assert.ok(/30\+ samples/.test(single), 'threshold explained');
  /* Multiple killed with count per kind */
  const multi = api.hgSolidityKilledNoteHtml({
    killedCount: 5,
    killedKinds: { 'BAD': 3, 'WORSE': 2 }
  });
  assert.ok(/5 proven-losing setups hidden/.test(multi), 'plural grammar');
  assert.ok(/BAD \u00d73/.test(multi), 'count next to name');
  assert.ok(/WORSE \u00d72/.test(multi));
  /* Many kinds -> +N more */
  const many = api.hgSolidityKilledNoteHtml({
    killedCount: 10,
    killedKinds: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1 }
  });
  assert.ok(/\+2 more/.test(many), 'truncates kind list with +N more');
}

/* --- Case M: kill threshold is stricter than G6 veto --- */
{
  /* A kind at expR -0.3, samples 25: G6 vetoes (fails) but kill does NOT
     fire because samples < 30 AND expR > -0.5. */
  const api = buildHelper(function(){ return { samples: 25, expR: -0.3 }; });
  const p = {
    dir: 'long', rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 }, liveGrade: 'fresh', tape: 'long', stopWidened: false
  };
  const g = api.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'MARGINAL' });
  /* G6 passes because samples < 20 gate too... let me recompute.
     G6 min samples is 20; here samples=25 which IS enough. expR -0.3 < -0.25 floor.
     So G6 FAILS. */
  assert.equal(g.gates.measuredEdge.pass, false, 'G6 fails at -0.3R, 25 samples');
  assert.equal(g.killed, false, 'but kill does NOT fire (needs 30 samples AND < -0.5R)');
}

/* --- Case N: kill defaults to false when opts not passed (safety) --- */
{
  const api = buildHelper(function(){ return { samples: 100, expR: -1.0 }; });
  const g = api.hgSolidityGrade({ dir: 'long', rr1: 3, minRr: 2 });
  /* No opts.tab/kind -> hgSolidityIsKilled returns { killed: false, source: 'no-lookup' } */
  assert.equal(g.killed, false, 'no opts -> not killed');
  assert.equal(g.killReason.source, 'no-lookup');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:689|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v689',
  'HG_VER must be >= hg-v689');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));

console.log('OK - v689: KILL-LIST for proven-losing kinds');
console.log('  * A: no tab/kind -> not killed (no-lookup)');
console.log('  * B: no fwd log -> not killed (no-fwdlog)');
console.log('  * C: 30+ samples + expR < -0.5 -> KILLED');
console.log('  * D: at kill floor -0.5 -> NOT killed (< is exclusive)');
console.log('  * E: just below floor -0.501 -> KILLED');
console.log('  * F: < 30 samples -> NOT killed (too-few-samples)');
console.log('  * G: fwd log throws -> not killed (contained)');
console.log('  * H: NaN expR -> not killed (no data)');
console.log('  * I: hgSolidityGrade attaches killed flag');
console.log('  * J: hgSolidityReorder filters killed cards + stats');
console.log('  * K: hgSolidityLastKilled reads stash');
console.log('  * L: hgSolidityKilledNoteHtml formats note');
console.log('  * M: kill threshold stricter than G6 veto');
console.log('  * N: kill defaults false without opts');
console.log('  * version bumped to ' + HG_VER);
