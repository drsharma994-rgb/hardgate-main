/* HARDGATE — a gate that could not run must never read as a gate that passed.

   Every post-gate in plans.js used to end in `catch(e){ return { ok: true } }`.
   That is the app's own honesty rule inverted: a network hiccup in the flow
   assessor, or thin candles, produced a setup presented as having CLEARED the
   quality gate when the gate never ran at all. Worse, hgFilterGoldPostGate
   wrapped its whole loop in one try — so a single throwing candidate silently
   skipped the gate for EVERY candidate after it, with nothing recorded.

   These tests pin the corrected contract:
     - could-not-check reports `unchecked`, never a bare pass
     - a throw on candidate 0 does not disarm the gate for candidates 1..N
     - an unchecked candidate is marked, NOT demoted (an unrunnable check is
       not evidence against a trade, only absence of evidence for it)

   Run: node tests/test-gate-unchecked.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const W = ctx;

/* A trending series long enough for the stale-momentum check to actually run. */
function rows(n, start, step){
  step = step === undefined ? 0.15 : step;
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    out.push({ t: i * 14400, o: c, h: c + 0.4, l: c - 0.4, c: c, v: 1000 });
  }
  return out;
}

console.log('== new contract is exported ==');
{
  ok(typeof W.hgUncheckedGate === 'function', 'hgUncheckedGate exported');
  ok(typeof W.hgMarkGateUnchecked === 'function', 'hgMarkGateUnchecked exported');
  const u = W.hgUncheckedGate('because');
  ok(u.veto === false && u.unchecked === true, 'unchecked gate does not veto but flags itself');
  ok(u.uncheckedReason === 'because', 'unchecked gate carries its reason');
}

console.log('\n== stale-momentum: thin data is UNCHECKED, not a pass ==');
{
  const thin = W.hgStaleMomentumVeto(rows(20, 100), 'long', 103);
  ok(thin.veto === false, 'thin data does not veto');
  ok(thin.unchecked === true, 'thin data reports UNCHECKED (was a silent pass)');
  ok(/20 bars, needs 60/.test(thin.uncheckedReason || ''), 'reason names the actual shortfall');

  const noDir = W.hgStaleMomentumVeto(rows(80, 100), null, 103);
  ok(noDir.unchecked === true, 'missing direction reports UNCHECKED');

  const real = W.hgStaleMomentumVeto(rows(120, 100), 'long', 100 + 119 * 0.15);
  ok(real.unchecked !== true, 'a check that genuinely ran is not marked unchecked');
  ok(real.veto === true || real.checked === true, 'a check that ran returns a real verdict');
}

console.log('\n== stale-momentum: a throw is UNCHECKED, not a pass ==');
{
  const boom = W.hgStaleMomentumVeto({ length: 80, map(){ throw new Error('kaboom'); } }, 'long', 100);
  ok(boom.veto === false, 'a throwing check does not fabricate a veto');
  ok(boom.unchecked === true, 'a throwing check reports UNCHECKED (was `ok`)');
  ok(/kaboom/.test(boom.uncheckedReason || ''), 'the thrown message is preserved, not swallowed');
}

/* hgAssessFlowTrap is reached through its internal binding, so it cannot be
   stubbed from outside. It does not need to be: with no Binance helpers in
   this context it takes its own flowNA path — which is exactly the real-world
   case this fix is about, the flow half of the gate never running. */
console.log('\n== gold post-gate: flow unavailable is UNCHECKED, not clean ==');
{
  const qv = await W.hgPostGateGoldVeto(
    { sym: 'XAUUSDT' }, { dir: 'long', entry: 3300, stop: 3280, t1: 3340 },
    null, rows(120, 3300, 0.4), 'gold-swing'
  );
  ok(qv.ok === true, 'an unrunnable gate does not veto the trade');
  ok(qv.unchecked === true, 'flow N/A reports UNCHECKED (was a bare ok:true)');
  ok((qv.uncheckedReasons || []).some(r => /flow trap/.test(r)), 'the flow detail reaches the reason list');
  ok(qv.flowNA === true, 'flowNA still propagates for existing consumers');
}

console.log('\n== gold post-gate: a genuine throw inside the gate is UNCHECKED ==');
{
  /* A candidate whose own field access throws — the fault class that used to
     be answered with a clean ok:true. */
  const landmine = { get sym(){ throw new Error('cand exploded'); } };
  const qv = await W.hgPostGateGoldVeto(
    landmine, { dir: 'long', entry: 3300, stop: 3280, t1: 3340 },
    null, rows(120, 3300, 0.4), 'gold-swing'
  );
  ok(qv.ok === true, 'a throwing gate does not fabricate a veto');
  ok(qv.unchecked === true, 'a throwing gate reports UNCHECKED');
  ok((qv.uncheckedReasons || []).some(r => /cand exploded/.test(r)), 'the thrown message survives');
}

console.log('\n== THE REGRESSION: one bad candidate must not disarm the gate for the rest ==');
{
  /* hgFilterGoldPostGate reaches the veto through its internal binding, so the
     fault is injected where the LOOP itself touches outside state: the
     venueRows lookup. Before the fix that throw escaped to a single outer try
     and every later candidate was returned ungated and unmarked. */
  const seen = [];
  const mk = (sym) => ({
    sym: sym, venue: sym, dir: 'long', entry: 1, stop: 0.9,
    get t1(){ seen.push(sym); return 1.2; }
  });
  const venueRows = new Proxy({}, {
    get(_t, k){ if (k === 'BOOM') throw new Error('venue rows exploded'); return undefined; }
  });
  const ranked = [mk('BOOM'), mk('B'), mk('C')];
  const out = await W.hgFilterGoldPostGate(ranked, venueRows, rows(120, 100), 'gold-swing');

  ok(seen.join(',') === 'B,C', 'candidates after the throw were still evaluated (was: loop aborted, none reached)');
  ok(out[0].postGateUnchecked === true, 'the failing candidate is marked UNCHECKED');
  ok(out[0].demoted !== true, 'a technical fault does not demote the trade');
  ok((out[0].stamps || []).indexOf('POST-GATE UNCHECKED') >= 0, 'the UNCHECKED stamp reaches the card');
  ok((out[0].postGateUncheckedReasons || []).some(r => /venue rows exploded/.test(r)), 'the fault reason is kept, not swallowed');
  ok(out[1].postGateUnchecked === true && out[2].postGateUnchecked === true,
    'the later candidates carry their own (flow N/A) unchecked mark rather than reading clean');
  ok(!(out[1].postGateUncheckedReasons || []).some(r => /exploded/.test(r)),
    'one candidate fault is not attributed to another');
}

console.log('\n== a gate that genuinely runs is recorded as CHECKED ==');
{
  /* Give hgAssessFlowTrap the Binance helpers it looks for on the global, so
     the flow leg really resolves and flowNA is false. */
  W.hgFlowTrapAssess = () => ({ veto: false, flowOk: true, cvdAligned: true, obiAligned: true, spotPerpAligned: true });
  W.binanceTakerRatio = async () => ({ series: [1, 2, 3] });
  W.binanceDepth = async () => ({ bids: [], asks: [] });

  const ranked = [{ sym: 'XAUUSDT', venue: 'v', dir: 'long', entry: 3300, stop: 3280, t1: 3340 }];
  const out = await W.hgFilterGoldPostGate(ranked, {}, rows(120, 3300, 0.4), 'gold-swing');

  ok(out[0].postGateChecked === true, 'a real pass is recorded as checked');
  ok(out[0].postGateUnchecked !== true, 'a real pass is not flagged unchecked');
  ok((out[0].stamps || []).indexOf('POST-GATE UNCHECKED') < 0, 'no UNCHECKED stamp on a genuine pass');
  ok(typeof out[0].flowDetail === 'string' && /CVD/.test(out[0].flowDetail), 'flow detail still propagates');

  delete W.hgFlowTrapAssess; delete W.binanceTakerRatio; delete W.binanceDepth;
}

console.log('\n== crypto post-gate carries the same contract ==');
{
  const landmine = { get symbol(){ throw new Error('ticker exploded'); } };
  const qv = await W.hgPostGateSetupVeto(
    landmine, { dir: 'long', entry: 100, stop: 98, t1: 106 },
    rows(120, 100), 'swing', null
  );
  ok(qv.ok === true, 'crypto post-gate does not veto on a technical fault');
  ok(qv.unchecked === true, 'crypto post-gate reports UNCHECKED (was a bare ok:true)');
  ok((qv.uncheckedReasons || []).some(r => /ticker exploded/.test(r)), 'crypto keeps the fault reason');

  const na = await W.hgPostGateSetupVeto(
    { symbol: 'ETHUSDT' }, { dir: 'long', entry: 100, stop: 98, t1: 106 },
    rows(120, 100), 'swing', null
  );
  ok(na.ok === true && na.unchecked === true, 'crypto flow N/A is unchecked, not a passed layer');
}

console.log('\n== both gold desks surface UNCHECKED on the card ==');
for (const f of ['goldswing.js', 'goldscalp.js']){
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(/POST-GATE UNCHECKED/.test(src), f + ' renders the UNCHECKED banner');
  ok(/c\.postGateUnchecked && !c\.demoted/.test(src), f + ' shows it only when not already demoted');
  ok(/\+ uncheckedLine/.test(src), f + ' actually emits the line into the card');
  ok(/hgMarkGateUnchecked/.test(src), f + ' marks every candidate when the whole filter throws');
}

console.log('\n== supersetup keeps unchecked out of the passed tally ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'supersetup.js'), 'utf8');
  ok(/hit\.postGate\.ok && hit\.postGate\.unchecked/.test(src), 'unchecked post-gate branches before the pass branch');
  ok(/unchecked\.length \? \(' · ' \+ unchecked\.length \+ ' unchecked'\)/.test(src), 'unchecked count reaches the layer summary');
  const passIdx = src.indexOf("passed.push('post-gate')");
  const unchIdx = src.indexOf('hit.postGate.unchecked');
  ok(unchIdx > 0 && unchIdx < passIdx, 'the unchecked test runs BEFORE the pass test, or it would never be reached');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL UNCHECKED-GATE TESTS PASSED');
