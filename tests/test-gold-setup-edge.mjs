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
/* hg-v700: the swing sweep prefer (bridge-era n=5) was REFUTED by the tab's
   own 4h replay — n=14 gross −0.11 / net −0.13 at XM -> demote. */
ok(edgeJson.swing && edgeJson.swing.sweep.action === 'demote', 'evidence: swing sweep demote (n=5 prefer refuted at n=14, hg-v700)');
ok(edgeJson.swing.weekly.action === 'prefer', 'evidence: swing weekly prefer (confirmed n=32, hg-v700)');
ok(edgeJson.swing.p9volbar.action === 'prefer', 'evidence: swing p9volbar prefer (n=44, hg-v700)');
ok(edgeJson.swing.ribbon.action === 'neutral', 'evidence: swing ribbon neutral (old n=4 demote contradicted at n=23, hg-v700)');
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

/* SCALP ORB demote (hg-v626: paint + OMNIGOLD eligible, never ENGINE lead) */
{
  const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'openrange', strategy: 'OPENING RANGE BREAKOUT' };
  W.hgGoldSetupEdgeApply(c, { scalp: true });
  ok(c.demoted === true && !c.dropped, 'ORB demoted — never MOST PROBABLE / ENGINE lead');
  ok((c.stamps || []).indexOf('EDGE DEMOTE') >= 0, 'ORB EDGE DEMOTE stamp');
}

/* hg-v699: measured-negative scalp kinds, re-baked from the GOLD SCALP tab's
   OWN 15m replay at the desk venue cost (XM XAUUSD 0.020% RT; see
   scripts/gold-setup-edge.json). Gross-positive-but-cost-eaten kinds stay
   demote (paint, never lead); gross-NEGATIVE kinds with n>=50 are suppress. */
{
  const demoteKeys = [
    ['bosalign', 'BOS ALIGNMENT'],
    ['asian', 'ASIAN RANGE BREAKOUT'],
    ['ob', 'ORDER BLOCK RETEST'],
    ['rsidiv', 'MODIFIED RSI 75/25 DIVERGENCE'],
    ['hvn', 'HVN RETEST'],
    ['ribbon', 'EMA RIBBON PULLBACK']
  ];
  for (const [key, lab] of demoteKeys){
    const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: key, strategy: lab };
    W.hgGoldSetupEdgeApply(c, { scalp: true });
    ok(c.demoted === true && !c.dropped, 'SCALP ' + key + ' demoted — never MOST PROBABLE / ENGINE lead');
    ok((c.stamps || []).indexOf('EDGE DEMOTE') >= 0, key + ' EDGE DEMOTE stamp');
  }
  const suppressKeys = [
    ['sweep', 'LIQUIDITY SWEEP REVERSAL', /n=74/],
    ['vwap', 'SESSION VWAP BOUNCE', /n=132/],
    ['nyexh', 'NY VOLUME EXHAUSTION', /n=167/],
    ['liqsweep', 'GOLD SWEEP ENGINE', /n=97/]
  ];
  for (const [key, lab, nRe] of suppressKeys){
    const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: key, strategy: lab };
    W.hgGoldSetupEdgeApply(c, { scalp: true });
    ok(c.dropped === true, 'SCALP ' + key + ' suppressed — gross-negative at the venue in the tab replay');
    ok((c.stamps || []).indexOf('EDGE SUPPRESS') >= 0 && nRe.test(c.reason || ''),
       key + ' EDGE SUPPRESS stamp + measured n on the reason line');
  }
  const preferKeys = [
    ['p6fail', 'S30 FAILED-BREAK REVERSAL'],
    ['p9volbar', 'S62 VOLUME-BAR S0 SWEEP']
  ];
  for (const [key, lab] of preferKeys){
    const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: key, strategy: lab };
    W.hgGoldSetupEdgeApply(c, { scalp: true });
    ok(!c.dropped && !c.demoted && c.edgeBoost >= 2, 'SCALP ' + key + ' prefer — measured fee-survivor rank boost');
    ok((c.stamps || []).indexOf('EDGE PREFER') >= 0, key + ' EDGE PREFER stamp');
  }
  /* sweepob sat one settle short of the prefer bar (n=49) — deliberately NO row */
  {
    const c = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'sweepob', strategy: 'ADVANCED SWEEP→OB' };
    W.hgGoldSetupEdgeApply(c, { scalp: true });
    ok(!c.dropped && !c.demoted && !(c.edgeBoost >= 2), 'sweepob neutral — n=49 is one settle short of the prefer bar');
  }
}

/* hg-v700: SWING sweep is DEMOTE — the bridge-era n=5 prefer did not survive
   the tab's own 140-day 4h replay (n=14 gross −0.11 / net −0.13 at XM,
   scripts/backtest-goldswing-results.json byStrategy.sweep). */
{
  const c = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'sweep', strategy: '4H LIQUIDITY SWEEP REVERSAL' };
  W.hgGoldSetupEdgeApply(c, { swing: true });
  ok(c.demoted === true && !c.dropped, 'swing sweep demoted — measured-negative at real n (hg-v700)');
  ok(!(c.edgeBoost >= 2) && (c.stamps || []).indexOf('EDGE DEMOTE') >= 0, 'swing sweep prefer boost gone; EDGE DEMOTE stamp');
}

/* hg-v700: swing p9volbar prefer (n=44 +0.19 at XM); ribbon + ob NEUTRAL
   (old n=4/n=1 demotes contradicted at n=23/+0.23 and n=4/+0.22). */
{
  const p = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'p9volbar', strategy: 'S62 VOLUME-BAR S0 SWEEP' };
  W.hgGoldSetupEdgeApply(p, { swing: true });
  ok(!p.dropped && !p.demoted && p.edgeBoost >= 2, 'swing p9volbar prefer — fee-survivor on both desks (hg-v700)');
  const r = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'ribbon', strategy: '4H EMA RIBBON PULLBACK' };
  W.hgGoldSetupEdgeApply(r, { swing: true });
  ok(!r.dropped && !r.demoted && !(r.edgeBoost >= 2) && !r.edge, 'swing ribbon NEUTRAL — old demote contradicted, under the prefer bar (hg-v700)');
  const pb = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'pullback', strategy: '4H TREND PULLBACK' };
  W.hgGoldSetupEdgeApply(pb, { swing: true });
  ok(pb.demoted === true && !pb.dropped, 'swing pullback demoted on its OWN row (n=18 −0.27 at XM, hg-v700)');
}

/* SWING weekly via wkbreak alias */
{
  const c = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'wkbreak', strategy: 'WEEKLY RANGE BREAKOUT' };
  W.hgGoldSetupEdgeApply(c, { swing: true });
  ok(c.edgeBoost >= 2, 'wkbreak → weekly prefer');
}

/* hg-v700: SWING bos is NEUTRAL. The inline 'bos' prefer pseudo-row quoted
   numbers (n=2 net 1.2) no baked table row backed — a boost fabricated in
   code. The 140-day swing replay measured bos n=8 +0.542R/trade net XM
   (scripts/backtest-goldswing-results.json byStrategy.bos): positive but far
   too thin for an honest prefer bar — no row, no boost, no demote, no drop. */
{
  const c = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'bos', strategy: '4H BOS bullish at 2640 with EMA stack' };
  W.hgGoldSetupEdgeApply(c, { swing: true });
  ok(!c.dropped && !c.demoted && !(c.edgeBoost >= 2) && !c.edge,
    'swing bos stratKey is NEUTRAL — fabricated prefer pseudo-row removed (hg-v700)');
  const cl = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'engbridge', strategy: '4H BOS ALIGNMENT' };
  W.hgGoldSetupEdgeApply(cl, { swing: true });
  ok(!cl.dropped && !cl.demoted && !(cl.edgeBoost >= 2) && !cl.edge,
    'swing "4H BOS" engine label maps to NO row (scalp bosalign demote not inherited)');
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

/* Demoted never gets prefer boost in goldRankSetups.
   hg-v700: a rows-free rank ctx scores BOTH cards CONF NO_TRADE, and the
   stamp now DEMOTES (paints, never leads) — the swing replay measured the MP
   cohort n=100 ALL stamped CONF NO TRADE at −0.209R/trade net XM
   (scripts/backtest-goldswing-results.json). The protective intent stands
   stronger: the demoted ORB still cannot be MOST PROBABLE — nothing on an
   all-demoted board can (v699 bestId-null precedent), and only the
   non-demoted prefer card kept its rank boost. */
{
  const dem = { id: 'd1', dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'openrange',
    strategy: 'OPENING RANGE', grade: 'A', agree: 9, oppose: 0, confluence: ['a','b','c','d','e','f','g','h','i'],
    demoted: true, edgeBoost: 2, stamps: ['EDGE DEMOTE'], atr: 10 };
  const pref = { id: 'p1', dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'sweep',
    strategy: '4H LIQUIDITY SWEEP', grade: 'B', agree: 5, oppose: 0, confluence: ['a','b','c','d','e'],
    edgeBoost: 2, stamps: ['EDGE PREFER'], atr: 20 };
  const r = W.goldRankSetups([dem, pref], {});
  /* hg-v700 refined: a rows-free ctx stamps CONF UNCHECKED and never
     manufactures a no-trade demote, so the non-demoted prefer card leads
     while the pre-demoted ORB still cannot. */
  ok(r && r.ranked.length === 2 && r.best && r.best.id === 'p1',
     'demoted ORB can never lead; the non-demoted prefer card is MOST PROBABLE (hg-v700 refined)');
  ok(r.ranked.find(c => c.id === 'd1').demoted === true
     && r.ranked.every(c => (c.stamps || []).indexOf('CONF UNCHECKED') >= 0),
     'pre-demoted card stays demoted; rows-free re-rank stamps CONF UNCHECKED on both (hg-v700 refined)');
  const demRc = r.ranked.find(c => c.id === 'd1');
  ok(demRc && !demRc.tallyParts.some(p => /EDGE PREFER \+/.test(String(p.label || ''))),
    'pre-demoted card never receives the prefer rank boost');
}

/* Wire: scalp/swing/omnigold call sites */
{
  const scalp = fs.readFileSync(root + 'goldind.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgGoldSetupEdgeApply\(c,\s*\{\s*scalp:\s*true\s*\}\)/.test(scalp), 'SCALP push wires edge apply');
  /* hg-v700: SWING edge apply moved from mkCand to the push() gate stack so
     the VP direct-mint and Part4–9 binds pass it too; the stop floor runs
     BEFORE it (v699 push order), the cost gate after. */
  ok(/hgGoldSetupEdgeApply/.test(swing) && /swing:\s*true/.test(swing), 'SWING push wires edge apply (hg-v700 gate stack)');
  ok(swing.indexOf('hgGoldScalpStopFloor') >= 0 && swing.indexOf('hgGoldScalpCostGate') >= 0
     && swing.indexOf('hgGoldScalpStopFloor') < swing.indexOf("hgGoldSetupEdgeApply');")
     && swing.indexOf('hgGoldScalpCostGate') > swing.indexOf('hgGoldScalpStopFloor'),
    'SWING push order: sides-guarded floor BEFORE edge apply, cost gate after (hg-v700)');
  ok(/edgeSuppress|edgeDemote|edgePrefer/.test(og), 'OMNIGOLD formation stamps edge verdict');
  ok(/c\.demoted\s*\|\|\s*c\.dropped/.test(og), 'OMNIGOLD engine pick skips demoted/dropped');
}

/* hg-v626: edge demote keeps formation eligible (unlike suppress) */
{
  const edgeJson = JSON.parse(fs.readFileSync(root + 'scripts/gold-setup-edge.json', 'utf8'));
  ok(edgeJson.scalp.openrange.action === 'demote', 'evidence json: ORB demote');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/probe\.demoted && probe\.edge && probe\.edge\.action === 'demote'/.test(og),
    'OMNIGOLD formation stamps edge demote');
  ok(!/out\.formed = false;\s*\n\s*out\.edgeDemote/.test(og),
    'edge demote no longer sets formed=false');
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
