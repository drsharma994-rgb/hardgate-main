/* HARDGATE — COMBI tab tests.
   Run: node tests/test-combi.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout,
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }) }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  for (const f of ['plans.js', 'setup-confirm.js', 'combi.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

console.log('== harvest + group ==');
{
  const W = boot({
    swingScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'SOLUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean: true, gatesPassed: 7 }]
    }),
    scalpScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'SOLUSD', dir: 'long', entry: 100, stop: 95, t1: 108, clean: true, gatesPassed: 7 }]
    }),
    edgeScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'SOLUSD', dir: 'long', entry: 101, stop: 96, t1: 112, clean: true, gatesPassed: 7 }]
    }),
    bestScan: () => ({
      at: Date.now(),
      clean: [{ sym: 'SOLUSD', dir: 'long', entry: 100, stop: 94, t1: 115, rr: 2.5 }]
    }),
    __hgBrainLast: () => ({
      at: Date.now(),
      rows: [{ sym: 'SOLUSD', dir: 'long', tier: 'HIGH', plan: { entry: 100, stop: 95, t1: 110 } }]
    }),
    hgMacroAllowsCrypto: () => ({ allow: true }),
    hgTripleStackMatch: () => ({ swing: true, edge: true, brain: true }),
    bookBtnHTML: () => '<button>BOOK</button>'
  });
  const bag = W.hgCombiHarvest();
  ok(bag.length >= 4, 'harvests multiple desk rows');
  const groups = W.hgCombiGroup(bag);
  const sol = groups.filter(g => g.sym === 'SOLUSD' && g.dir === 'long')[0];
  ok(sol && sol.sourceCount >= 4, 'SOL long grouped with 4+ desks');
  ok(sol && (sol.badge === 'STRONG' || sol.combiTier === 'PRIME' || sol.combiTier === 'CONFIRMED'),
    'multi-desk badge/tier — got ' + (sol && (sol.combiTier || sol.badge)));
  ok(sol && sol.spine, 'SOL has structural spine');
  ok(sol && sol.tradeable, 'SOL is tradeable');
  const pick = W.hgCombiPickGlobal(groups, bag);
  ok(pick && pick.row && pick.row.sym === 'SOLUSD', 'global pick is SOL long');
}

console.log('== overextension blocks tradeable ==');
{
  const W = boot({
    swingScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'PEPEUSD', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, clean: true, gatesPassed: 7 }]
    }),
    edgeScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'PEPEUSD', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, clean: true, gatesPassed: 7 }]
    }),
    bestScan: () => ({
      at: Date.now(),
      clean: [{ sym: 'PEPEUSD', dir: 'long', entry: 1, stop: 0.9, t1: 1.2 }]
    }),
    __hgBrainLast: () => ({
      at: Date.now(),
      rows: [{ sym: 'PEPEUSD', dir: 'long', tier: 'HIGH', plan: { entry: 1, stop: 0.9, t1: 1.2 } }]
    }),
    S: { tickers: [{ symbol: 'PEPEUSD', chg24: 19.5 }] },
    hgMacroAllowsCrypto: () => ({ allow: true }),
    hgTripleStackMatch: () => null
  });
  const bag = W.hgCombiHarvest();
  const groups = W.hgCombiGroup(bag);
  const pepe = groups.filter(g => g.sym.indexOf('PEPE') >= 0 && g.dir === 'long')[0];
  ok(pepe && pepe.combiTier === 'BLOCKED', 'overextended PEPE blocked');
  ok(pepe && !pepe.tradeable, 'overextended PEPE not tradeable');
  ok(!W.hgCombiPickGlobal(groups, bag), 'no global pick when only blocked chase');
}

console.log('== inline snap harvest ==');
{
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout,
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }) }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  vm.createContext(ctx);
  vm.runInContext(read('plans.js'), ctx, { filename: 'plans.js' });
  vm.runInContext(read('setup-ui.js'), ctx, { filename: 'setup-ui.js' });
  vm.runInContext(read('combi.js'), ctx, { filename: 'combi.js' });
  ctx.hgMpNoteCard('PEPEUSD', 'long', 1, 0.9, 1.2, { scanner: 'smc', tier: 'clean' });
  const snapBag = ctx.hgMpSnapHarvest();
  ok(snapBag.length === 1 && snapBag[0].source === 'smc', 'hgMpSnapHarvest captures inline SMC card');
}

console.log('== wiring ==');
{
  const W = boot();
  ok(W.HG_tabs.some(t => t.id === 'combi'), 'HG_tabs registers combi');
  const html = read('index.html');
  const sw = read('sw.js');
  ok(/combi\.js/.test(html), 'index loads combi.js');
  ok(/'combi'/.test(html), 'nav includes combi');
  ok(/\.\/combi\.js/.test(sw), 'sw precaches combi.js');
  ok(/const HG_CACHE = 'hg-v619'/.test(sw), 'sw HG_CACHE current');
  ok(/combi:\s*'combiCards'/.test(read('setup-ui.js')), 'HG_MP_HOST maps combi');
}

console.log('\npassed: ' + passed);
