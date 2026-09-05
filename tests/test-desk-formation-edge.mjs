/* HARDGATE — desk formation edge from OMNIROUTE v531 + BEST kinds. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error,
    setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  vm.runInContext(read('desk-formation-edge.js'), ctx, { filename: 'desk-formation-edge.js' });
  return ctx;
}

console.log('== table covers the named desks ==');
{
  const W = boot();
  const ids = [
    'swing', 'scalp', 'edge', 'smart', 'squeeze', 'reversalsniper',
    'smc', 'ob', 'trap', 'divergence', 'coil', 'apex',
    'oiflow', 'liqs', 'onchain', 'chartvision', 'carry', 'venueprem', 'termbasis'
  ];
  for (const id of ids){
    const row = W.hgDeskFormationEdgeLookup(id);
    ok(!!row, id + ' has a desk row');
  }
  ok(W.HG_DESK_FORMATION_EDGE.bestKinds.join(',') ===
    'AVWAP-RECLAIM,CUSUM-SHIFT,DONCHIAN-DRIVE,MMOVE,NR7-BREAK',
    'BEST kinds match OMNIROUTE prefer list');
}

console.log('== toxic analogues suppress / demote ==');
{
  const W = boot();
  const div = W.hgDeskFormationEdgeApply({ dir: 'long', entry: 100, stop: 98, t1: 104, tier: 'clean' }, { tab: 'divergence' });
  ok(div.deskEdgeAction === 'suppress', 'DIVERGENCE → RSI-DIVERGE suppress');
  ok(div.demoted === true && div.tier === 'near', 'suppress strips CLEAN to NEAR');
  ok(div.stamps.indexOf('REPLAY SUPPRESS') >= 0, 'suppress stamp');
  ok(W.hgDeskFormationEdgeTradeable(div, true) === false, 'suppress is not tradeable');

  const smc = W.hgDeskFormationEdgeApply({ dir: 'short', tier: 'clean' }, { tab: 'smc' });
  ok(smc.deskEdgeAction === 'suppress', 'SMC FVG → FVG-FILL suppress');

  const trap = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: 'trap' });
  ok(trap.deskEdgeAction === 'demote', 'TRAP → sweep family demote');
  ok(trap.demoted === true && trap.tier === 'near', 'demote never stays CLEAN');
  ok(W.hgDeskFormationEdgeTradeable(trap, true) === false, 'demote is not MOST PROBABLE / tradeable');

  const sniper = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: 'reversalsniper' });
  ok(sniper.deskEdgeAction === 'suppress', 'SNIPER → PIN-REJECT suppress');
  ok(W.hgDeskFormationEdgeTradeable(sniper, true) === false, 'SNIPER suppress is not tradeable');
}

console.log('== fail-open desks do not invent suppress ==');
{
  const W = boot();
  for (const id of ['swing', 'edge', 'smart', 'oiflow', 'liqs', 'carry', 'termbasis', 'apex', 'onchain']){
    const c = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: id });
    ok(c.deskEdgeAction !== 'suppress' && c.deskEdgeAction !== 'demote',
      id + ' fail-open (no toxic analogue)');
  }
}

console.log('== scalp / coil-expansion prefer NR7; squeeze stays watch ==');
{
  const W = boot();
  const scalp = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: 'scalp' });
  ok(scalp.deskEdgeAction === 'prefer' && scalp.edgeBoost === true, 'SCALP prefers NR7 analogue');
  const coilX = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: 'coil-expansion' });
  ok(coilX.deskEdgeAction === 'prefer', 'coil expansion prefers NR7-BREAK');
  const sq = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: 'squeeze' });
  ok(sq.deskEdgeAction === 'watch', 'SQUEEZE-FIRE near-even stays watch');
  ok(sq.tier === 'clean', 'watch does not strip CLEAN');
}

console.log('== BEST confirm boosts fail-open, never un-suppresses ==');
{
  const W = boot();
  W.hgMechRunAll = function(){
    return [{ kind: 'MMOVE', dir: 'long' }, { kind: 'FVG-FILL', dir: 'long' }];
  };
  const swing = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean', rows: [{ c: 1 }] }, { tab: 'swing', rows: [{ c: 1 }] });
  ok(swing.deskEdgeBest === true && swing.edgeBoost === true, 'SWING + MMOVE gets BEST confirm');
  ok(swing.deskEdgeBestKinds.indexOf('MMOVE') >= 0, 'BEST kinds named');
  ok(swing.deskEdgeAction !== 'suppress', 'BEST confirm does not invent a ticket');

  const div = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean', rows: [{ c: 1 }] }, { tab: 'divergence', rows: [{ c: 1 }] });
  ok(div.deskEdgeAction === 'suppress', 'BEST confirm does not un-suppress RSI-DIVERGE');
}

console.log('== never loosens / no probability language ==');
{
  const W = boot();
  const html = W.hgDeskFormationEdgeBannerHtml('divergence');
  ok(/OMNIROUTE BEST/.test(html), 'banner names OMNIROUTE BEST');
  ok(/DIVERGENCE/.test(html), 'banner names the desk');
  ok(!/% chance|win rate|probability/i.test(html), 'banner has no probability language');
  ok(/never loosens G1/i.test(html), 'banner keeps G1–G7 closed');
  const loose = W.hgDeskFormationEdgeApply({ dir: 'short', minRisk: 1, tier: 'clean' }, { tab: 'divergence' });
  ok(loose.deskEdgeAction === 'suppress', 'apply cannot loosen a toxic desk');
}

console.log('== aliases + nightly aside tightens ==');
{
  const W = boot();
  ok(W.hgDeskFormationResolveTab('liq-trap') === 'trap', 'liq-trap alias');
  ok(W.hgDeskFormationResolveTab('div') === 'divergence', 'div alias');
  ok(W.hgDeskFormationResolveTab('REVERSALSNIPER') === 'reversalsniper', 'sniper alias');
  W.hgOmniNightlyAside = function(kind){ return String(kind) === 'SQUEEZE-FIRE' ? { kind: kind } : null; };
  const sq = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean' }, { tab: 'squeeze' });
  ok(sq.deskEdgeAction === 'suppress', 'nightly aside of SQUEEZE-FIRE tightens watch → suppress');

  W.hgOmniNightlyAside = function(kind){ return String(kind) === 'MMOVE' ? { kind: kind } : null; };
  W.hgDeskNightlyBestKinds = function(){ return ['AVWAP-RECLAIM', 'CUSUM-SHIFT', 'DONCHIAN-DRIVE', 'NR7-BREAK']; };
  W.hgMechRunAll = function(){ return [{ kind: 'MMOVE', dir: 'long' }]; };
  const swing = W.hgDeskFormationEdgeApply({ dir: 'long', tier: 'clean', rows: [{ c: 1 }] }, { tab: 'swing', rows: [{ c: 1 }] });
  ok(swing.deskEdgeBest !== true, 'BEST confirm skips a day-aside MMOVE');
}

console.log('== wiring + stamp ==');
{
  const html = read('index.html');
  ok(/desk-formation-edge\.js\?v=/.test(html), 'index loads desk-formation-edge.js');
  ok(html.indexOf('desk-formation-edge.js') > html.indexOf('omniroute.js'),
     'overlay loads after OMNIROUTE');
  ok(/hgDeskFormationEdgeApply/.test(html), 'cardHTML / scan path calls apply');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches ' + HG_VER);
  ok(/desk-formation-edge\.js/.test(read('sw.js')), 'sw.js precaches desk-formation-edge.js');
  ok(/deskEdgeAction/.test(read('plans.js')), 'ranker honours desk-edge demote');
}

console.log('\nall ok —', pass, 'assertions');
