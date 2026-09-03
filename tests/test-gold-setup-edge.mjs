/* HARDGATE — gold setup edge bake (replay suppress/demote/prefer + plan sides). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..') + path.sep;
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function loadGoldind(){
  globalThis.window = globalThis.window || {};
  /* Minimal stubs goldind may touch at load. */
  if (!globalThis.window.EMA) globalThis.window.EMA = function(){ return []; };
  vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
  vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  return globalThis.window;
}

console.log('== gold setup edge bake ==');

const edgeJson = JSON.parse(fs.readFileSync(root + 'scripts/gold-setup-edge.json', 'utf8'));
ok(edgeJson.scalp && edgeJson.scalp.fvg.action === 'suppress', 'evidence: scalp FVG suppress');
ok(edgeJson.swing && edgeJson.swing.sweep.action === 'prefer', 'evidence: swing sweep prefer');
ok(edgeJson.swing.weekly.action === 'prefer', 'evidence: swing weekly prefer');
ok(Array.isArray(edgeJson.omnigoldPrefer) && edgeJson.omnigoldPrefer.length >= 5, 'omnigoldPrefer survivors listed');

const W = loadGoldind();
ok(typeof W.hgGoldSetupEdgeApply === 'function', 'hgGoldSetupEdgeApply export');
ok(typeof W.hgGoldPlanSidesOk === 'function', 'hgGoldPlanSidesOk export');
ok(typeof W.hgGoldTakeEnginePlan === 'function', 'hgGoldTakeEnginePlan export');
ok(typeof W.hgGoldBindEnginePlan === 'function', 'hgGoldBindEnginePlan export');
ok(W.HG_GOLD_SETUP_EDGE && W.HG_GOLD_SETUP_EDGE.scalp.fvg.action === 'suppress', 'HG_GOLD_SETUP_EDGE table');

/* Plan sides: SHORT stop below entry is illegal. */
{
  const bad = { dir: 'short', entry: 2650, stop: 2640, t1: 2630, stratKey: 'silverb', strategy: 'SESSION SILVER BULLET' };
  W.hgGoldSetupEdgeApply(bad, { scalp: true });
  ok(bad.dropped === true, 'SHORT stop below entry → dropped');
  ok(String(bad.reason || '').indexOf('ABOVE') >= 0, 'reason mentions stop ABOVE entry');
  ok((bad.stamps || []).indexOf('BAD PLAN SIDES') >= 0, 'BAD PLAN SIDES stamp');
}

/* SCALP FVG suppress */
{
  const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'fvg', strategy: 'FVG FILL' };
  W.hgGoldSetupEdgeApply(c, { scalp: true });
  ok(c.dropped === true, 'scalp FVG FILL suppressed');
  ok((c.stamps || []).indexOf('EDGE SUPPRESS') >= 0, 'EDGE SUPPRESS stamp');
}

/* SCALP ORB demote (not suppress) */
{
  const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'openrange', strategy: 'OPENING RANGE BREAKOUT' };
  W.hgGoldSetupEdgeApply(c, { scalp: true });
  ok(!c.dropped, 'ORB not suppressed');
  ok(c.demoted === true, 'ORB demoted');
  ok((c.stamps || []).indexOf('EDGE DEMOTE') >= 0, 'EDGE DEMOTE stamp');
}

/* SWING sweep prefer */
{
  const c = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'sweep', strategy: '4H LIQUIDITY SWEEP REVERSAL' };
  W.hgGoldSetupEdgeApply(c, { swing: true });
  ok(!c.dropped && !c.demoted, 'swing sweep not demoted');
  ok(c.edgeBoost >= 2, 'swing sweep edgeBoost');
  ok((c.stamps || []).indexOf('EDGE PREFER') >= 0, 'EDGE PREFER stamp');
}

/* SWING weekly via wkbreak alias */
{
  const c = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'wkbreak', strategy: 'WEEKLY RANGE BREAKOUT' };
  W.hgGoldSetupEdgeApply(c, { swing: true });
  ok(c.edgeBoost >= 2, 'wkbreak → weekly prefer');
}

/* v581 — production GOLD SWING paste: LONG S24 TP1 sat BETWEEN stop and entry.
   abs() printed 0.4R. House T1 must survive; rank must reject the bad card. */
{
  const house = { dir: 'long', entry: 4422.3, stop: 4319.6, t1: 4576.4, t2: 4699.9,
    stratKey: 'p5drive', strategy: 'S24 THREE-DRIVE EXHAUSTION', grade: 'C', agree: 2 };
  const engine = { entry: 4422.3, stop: 4319.6, t1: 4382.4, t2: 4699.9 };
  ok(W.hgGoldPlanSidesOk({ dir: 'long', entry: 4422.3, stop: 4319.6, t1: 4382.4 }).ok === false,
    'user ticket: LONG TP1 below entry is illegal');
  ok(W.hgGoldTakeEnginePlan(house, engine) === false, 'takeEnginePlan refuses wrong-side T1');
  ok(house.t1 === 4576.4, 'house T1 kept when engine T1 is on the risk side');
  const r = W.goldRankSetups([{
    id: 'p5drive|long|4422', dir: 'long', entry: 4422.3, stop: 4319.6, t1: 4382.4,
    stratKey: 'p5drive', strategy: 'S24 THREE-DRIVE EXHAUSTION', grade: 'C',
    agree: 4, oppose: 0, atr: 33
  }], {});
  ok(!r.best, 'wrong-side T1 cannot be MOST PROBABLE');
  ok((r.rejected || []).some(x => /TP1|sides|ABOVE/i.test(String(x.reason || ''))),
    'ranker names the side fault (' + JSON.stringify((r.rejected || [])[0]) + ')');

  const goodHouse = { dir: 'long', entry: 4422.3, stop: 4319.6, t1: 4576.4, t2: 4699.9,
    stratKey: 'p5drive', strategy: 'S24' };
  const bound = W.hgGoldBindEnginePlan(goodHouse, {
    key: 'p5drive', dir: 'long', level: 4422.3, why: 'S24',
    plan: engine
  }, { atr: 33, mark: 4422.3, venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT' });
  ok(bound && bound.t1 === 4576.4, 'bind keeps house T1 when engine T1 is illegal');
  const resurrect = W.hgGoldBindEnginePlan({ dropped: true }, {
    key: 'p5drive', dir: 'long', level: 4422.3, why: 'S24',
    plan: engine
  }, { atr: 33, mark: 4422.3, strategy: 'S24 THREE-DRIVE EXHAUSTION' });
  ok(resurrect == null, 'bind does not resurrect a fallback card with TP1 below entry');
}

/* Demoted never gets prefer boost in goldRankSetups */
{
  const dem = { id: 'd1', dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'openrange',
    strategy: 'OPENING RANGE', grade: 'A', agree: 9, oppose: 0, confluence: ['a','b','c','d','e','f','g','h','i'],
    demoted: true, edgeBoost: 2, stamps: ['EDGE DEMOTE'], atr: 10 };
  const pref = { id: 'p1', dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'sweep',
    strategy: '4H LIQUIDITY SWEEP', grade: 'B', agree: 5, oppose: 0, confluence: ['a','b','c','d','e'],
    edgeBoost: 2, stamps: ['EDGE PREFER'], atr: 20 };
  const r = W.goldRankSetups([dem, pref], {});
  ok(r && r.best && r.best.id === 'p1', 'demoted ORB cannot beat prefer sweep as MOST PROBABLE');
  ok(r.best.demoted !== true, 'best is not demoted');
}

/* Wire: scalp/swing/omnigold call sites */
{
  const scalp = fs.readFileSync(root + 'goldind.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgGoldSetupEdgeApply\(c,\s*\{\s*scalp:\s*true\s*\}\)/.test(scalp), 'SCALP push wires edge apply');
  ok(/hgGoldSetupEdgeApply/.test(swing) && /swing:\s*true/.test(swing), 'SWING mkCand wires edge apply');
  ok(/edgeSuppress|edgeDemote|edgePrefer/.test(og), 'OMNIGOLD formation stamps edge verdict');
  ok(/c\.demoted\s*\|\|\s*c\.dropped/.test(og), 'OMNIGOLD engine pick skips demoted/dropped');
}

/* Stamp */
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  ok(stamp.indexOf("version: '" + HG_VER + "'") >= 0 || stamp.indexOf('version: "' + HG_VER + '"') >= 0,
    'build-stamp readable (' + HG_VER + ')');
  ok(swCacheOk(sw), 'sw.js HG_CACHE matches build-stamp');
  ok(swCacheOk(fs.readFileSync(root + 'sw.js', 'utf8')), 'sw.js HG_CACHE matches build-stamp');
}

console.log('\nPASS ' + pass + ' assertions — gold setup edge');
