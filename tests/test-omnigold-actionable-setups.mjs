/* HARDGATE — OMNIGOLD actionable gold-engine fallback in MOST PROBABLE.

   Run: node tests/test-omnigold-actionable-setups.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

console.log('== grade gate for engine promotion ==');
{
  const W = boot();
  ok(W.hgOgGoldEngineGradeOk({ dir: 'long', entry: 1, stop: 0.9, t1: 1.2, grade: 'A' }), 'grade A passes');
  ok(!W.hgOgGoldEngineGradeOk({ dir: 'long', entry: 1, stop: 0.9, t1: 1.2, grade: 'C' }), 'grade C blocked');
  ok(!W.hgOgGoldEngineGradeOk({ dir: 'long', entry: 1, stop: 0.9, t1: 1.2, grade: 'A', vetoed: true }), 'vetoed blocked');
  ok(W.hgOgGoldEngineGradeOk({ dir: 'long', entry: 1, stop: 0.9, t1: 1.2, grade: 'B', tally: 6 }, { allowB: true }),
     'grade B with tally on swing');
}

console.log('\n== bridge setup converts to MP pick ==');
{
  const W = boot();
  const pick = W.hgOgBridgeSetupToPick({
    dir: 'short', strategy: 'LIQUIDITY SWEEP REVERSAL', stratKey: 'sweep',
    entry: 2600, stop: 2610, t1: 2585, grade: 'A', tally: 7
  }, 'SCALP');
  ok(pick && pick.enginePick, 'enginePick flag');
  ok(pick.plan && pick.plan.entry === 2600, 'levels carried');
  ok(pick.engineGrade === 'A', 'grade carried');
}

console.log('\n== pick gold engine respects tape (aligned first) ==');
{
  const W = boot();
  const bridge = {
    ok: true,
    scalp: {
      ranked: [
        { dir: 'long', strategy: 'ORB BREAK', entry: 1, stop: 0.9, t1: 1.2, grade: 'A', tally: 5 },
        { dir: 'short', strategy: 'SWEEP', entry: 1, stop: 1.1, t1: 0.8, grade: 'A', tally: 8 }
      ],
      best: { dir: 'short', strategy: 'SWEEP', entry: 1, stop: 1.1, t1: 0.8, grade: 'A', tally: 8 }
    },
    swing: { ranked: [], best: null }
  };
  const shortPick = W.hgOgPickGoldEngineFor(bridge, 'SCALP', 'short');
  ok(shortPick && shortPick.dir === 'short', 'tape-aligned short');
  const longPick = W.hgOgPickGoldEngineFor(bridge, 'SCALP', 'long');
  ok(longPick && longPick.dir === 'long', 'tape-aligned long wins over higher-tally opposite');
}

console.log('\n== demoted grade B never leads ENGINE MP (hg-v574) ==');
{
  const W = boot();
  /* Replay EDGE DEMOTE + demoted flag: demoted ENGINE setups never become
     MOST PROBABLE (aligned or against-tape). XM venue so stop floor is not
     the refusal reason — demotion/edge is. */
  W.HG_OG_VENUE = 'XM';
  const bridge = {
    ok: true,
    scalp: {
      ranked: [{
        dir: 'short', strategy: 'LIQUIDITY SWEEP REVERSAL', stratKey: 'sweep',
        entry: 4628, stop: 4640, t1: 4610,
        grade: 'B', tally: 6, demoted: true, stamps: ['EDGE DEMOTE']
      }],
      best: { dir: 'short', strategy: 'LIQUIDITY SWEEP REVERSAL', stratKey: 'sweep',
        entry: 4628, stop: 4640, t1: 4610,
        grade: 'B', tally: 6, demoted: true, stamps: ['EDGE DEMOTE'] }
    },
    swing: { ranked: [], best: null }
  };
  const pick = W.hgOgPickGoldEngineFor(bridge, 'SCALP', 'long');
  ok(pick === null, 'demoted EDGE DEMOTE sweep never leads against-tape MP');
  /* Against-tape still works for a clean (non-demoted, non-toxic) kind. */
  const bridge2 = {
    ok: true,
    scalp: {
      ranked: [{
        dir: 'short', strategy: 'RSI 75/25 DIVERGENCE', stratKey: 'rsidiv',
        entry: 4628, stop: 4640, t1: 4610, grade: 'B', tally: 6
      }],
      best: null
    },
    swing: { ranked: [], best: null }
  };
  const pick2 = W.hgOgPickGoldEngineFor(bridge2, 'SCALP', 'long');
  ok(pick2 && pick2.dir === 'short', 'against-tape short when tape is long (clean kind)');
  ok(pick2.engineAgainstTape, 'flagged against tape');
  const html = W.hgOgMostProbablePanelHtml(null, null, 'long', null, null, null, pick2, null);
  ok(/AGAINST GOLD TAPE/.test(html), 'against-tape label in MP');
  ok(/RSI/.test(html), 'strategy in MP');
}

console.log('\n== MOST PROBABLE panel shows engine tier ==');
{
  const W = boot();
  const eng = W.hgOgBridgeSetupToPick({
    dir: 'long', strategy: 'FVG FILL', entry: 100, stop: 99, t1: 102, grade: 'A', tally: 6
  }, 'SCALP');
  const html = W.hgOgMostProbablePanelHtml(null, null, 'long', null, null, null, eng, null);
  ok(/data-tier="engine"/.test(html), 'engine tier');
  ok(/GOLD ENGINE/.test(html), 'engine label');
  ok(/ACTIONABLE/.test(html), 'actionable chip');
  ok(/FVG FILL/.test(html), 'strategy named');
}

console.log('\n== engine beats veto watch in MP horizon ==');
{
  const W = boot();
  const eng = W.hgOgBridgeSetupToPick({
    dir: 'short', strategy: 'SWEEP', entry: 50, stop: 51, t1: 48, grade: 'A', tally: 5
  }, 'SCALP');
  const watch = { dir: 'short', kind: 'ORB', plan: { entry: 49, stop: 52, t1: 46 },
    grade: { ticket: false, evaluated: 3, total: 10 }, gates: [] };
  const hz = W.hgOgMpHorizonHtml('SCALP', null, 'short', watch, null, eng);
  ok(/GOLD ENGINE/.test(hz), 'engine shown over veto watch');
  ok(/SWEEP/.test(hz), 'engine strategy in horizon row');
}

console.log('\n== grade C fallback when no A/B ==');
{
  const W = boot();
  /* hg-v533: same venue declaration as the demoted-grade-B block above —
     the 11-point stop on 4627 (0.24% stop) only forms at XM costs; the
     grade-C fallback mechanics are what this block is about.
     hg-v574: use a non-EDGE-toxic kind (not FVG FILL suppress / not demoted). */
  W.HG_OG_VENUE = 'XM';
  const bridge = {
    ok: true,
    scalp: {
      ranked: [{
        dir: 'short', strategy: 'RSI 75/25 DIVERGENCE', stratKey: 'rsidiv',
        entry: 4627, stop: 4638, t1: 4612,
        grade: 'C', tally: 4
      }],
      best: { dir: 'short', strategy: 'RSI 75/25 DIVERGENCE', stratKey: 'rsidiv',
        entry: 4627, stop: 4638, t1: 4612,
        grade: 'C', tally: 4 }
    },
    swing: { ranked: [], best: null }
  };
  const pick = W.hgOgPickGoldEngineForMp(bridge, 'SCALP', 'long');
  ok(pick && pick.engineLowGrade, 'grade C fallback');
  ok(pick.dir === 'short', 'best grade C picked');
  const html = W.hgOgMostProbablePanelHtml(null, null, 'long', null, null, null, pick, null);
  ok(/FORMING/.test(html), 'forming tier in MP');
  ok(/need tally/.test(html), 'explains B threshold');
  const panel = W.hgOgGoldEnginesPanelHtml(bridge);
  ok(/og-grade-chip og-grade-a/.test(panel), 'engines panel explains missing A/B with chips');
}
console.log('\n== grade chips ==');
{
  const W = boot();
  const chipA = W.hgOgGradeChipHtml('A', { large: true });
  ok(/og-grade-chip og-grade-a og-grade-lg/.test(chipA), 'large grade A chip');
  ok(/og-grade-c/.test(W.hgOgGradeChipHtml('C')), 'grade C chip');
  ok(/og-grade-d/.test(W.hgOgGradeChipHtml('D')), 'grade D chip');
  const eng = W.hgOgBridgeSetupToPick({
    dir: 'short', strategy: 'FVG FILL', entry: 4627, stop: 4638, t1: 4612,
    grade: 'C', tally: 4
  }, 'SCALP');
  eng.engineLowGrade = true;
  const html = W.hgOgMostProbablePanelHtml(null, null, 'long', null, null, null, eng, null);
  ok(/og-grade-chip og-grade-c/.test(html), 'MP panel renders grade chip');
  const panel = W.hgOgGoldEnginesPanelHtml({
    ok: true,
    scalp: { ranked: [{ dir: 'short', strategy: 'FVG FILL', entry: 1, stop: 2, t1: 0.5, grade: 'C', tally: 4 }],
      best: { dir: 'short', strategy: 'FVG FILL', entry: 1, stop: 2, t1: 0.5, grade: 'C', tally: 4 }, rejected: [] },
    swing: { ranked: [], best: null, rejected: [] }
  });
  ok(/og-grade-lg/.test(panel), 'engines panel large grade chip');
}

console.log('\n== FORMATION floor at PAXG default refuses the tight-stop engine pick (hg-v533) ==');
{
  /* The same fixture the demoted-grade-B block declares XM for: at the
     conservative PAXG default (0.26% RT) a 0.26% stop pays 1.0R of 1R in
     fees — the pick gate must refuse it as a ticket. The engine row still
     prints the catalog ENTRY / STOP / T1 so the reader can see the plan,
     labeled not a ticket / not bookable. */
  const W = boot();
  const row = { dir: 'short', strategy: 'LIQUIDITY SWEEP REVERSAL', entry: 4628, stop: 4640, t1: 4610,
    grade: 'B', tally: 6, demoted: true };
  const bridge = { ok: true, scalp: { ranked: [row], best: row }, swing: { ranked: [], best: null } };
  ok(W.hgOgPickGoldEngineFor(bridge, 'SCALP', 'long') === null,
     'PAXG default: 0.26% stop does not form as an engine pick');
  const fm = W.hgOgFormation(row);
  ok(fm && fm.formed === false && /stop inside 8x the venue round-trip/.test(fm.reasons.join(' ')),
     'formation names the 8x venue round-trip floor');
  const rowHtml = W.hgOgGoldEngineRowHtml(row, 'best', 'SCALP');
  ok(/did not FORM/.test(rowHtml), 'engine row stays visible and names the formation miss');
  ok(/ENTRY/.test(rowHtml) && /4628\.00/.test(rowHtml) && /4640\.00/.test(rowHtml) && /4610\.00/.test(rowHtml),
     'existing engine ENTRY / STOP / T1 still print — not invented, not hidden');
  ok(/not a ticket/.test(rowHtml) && /not bookable/.test(rowHtml),
     'levels are labeled not a ticket / not bookable');
  ok(!/bookBtn|ADD TO BOOK|SEND TO TRADE/.test(rowHtml),
     'unformed engine row does not hand off to book');
  const noLv = W.hgOgGoldEngineRowHtml({ dir: 'long', strategy: 'FVG FILL', grade: 'A', tally: 8 }, 'best', 'SCALP');
  ok(/FVG FILL/.test(noLv) && !/<i>ENTRY<\/i>/.test(noLv),
     'no levels invented when the engine plan has none');
}

console.log('\n== wiring exports ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/hgOgApplyBridgeBestLevels/.test(SRC), 'best-levels batch in bridge');
  ok(/hgOgPickGoldEngineForMp/.test(SRC), 'MP engine pick helper');
  ok(/hgOgRunGoldTabEngines\(shared, res\.scalp\.rows/.test(SRC), 'bridge runs before MP paint');
}

console.log('\nomnigold actionable setups: ' + passed + ' checks passed');
