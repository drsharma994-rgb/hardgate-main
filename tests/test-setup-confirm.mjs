/* HARDGATE — SETUP CONFIRM tab tests.
   Run: node tests/test-setup-confirm.mjs */
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
  for (const f of ['plans.js', 'setup-confirm.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  if (extra && extra.hgTripleStackMatch) ctx.hgTripleStackMatch = extra.hgTripleStackMatch;
  return ctx;
}

console.log('== aggregate confirmation ==');
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
  const bag = W.hgConfirmHarvest();
  ok(bag.length >= 4, 'harvests multiple desk rows');
  const groups = W.hgConfirmAggregate(bag);
  const sol = groups.filter(g => g.sym === 'SOLUSD' && g.dir === 'long')[0];
  ok(sol && (sol.tier === 'CONFIRMED' || sol.tier === 'PRIME'), 'SOL long confirmed when swing+edge spine + 4 desks — got ' + (sol && sol.tier));
  ok(sol && sol.sourceCount >= 4, 'counts independent sources');
  ok(sol && sol.triple, 'TRIPLE STACK bonus applies');
}

console.log('== blockers ==');
{
  const W = boot({
    swingScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'PEPEUSD', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, clean: true, gatesPassed: 7 }]
    }),
    edgeScan: () => ({
      at: Date.now(),
      cands: [{ sym: 'PEPEUSD', dir: 'short', entry: 1, stop: 1.1, t1: 0.8, clean: true, gatesPassed: 7 }]
    }),
    hgMacroAllowsCrypto: () => ({ allow: true })
  });
  const groups = W.hgConfirmAggregate(W.hgConfirmHarvest());
  const blocked = groups.filter(g => g.tier === 'BLOCKED');
  ok(blocked.length >= 2, 'both LONG and SHORT groups blocked on conflict');
  ok(blocked.some(g => g.blockers.some(b => /conflict/i.test(b))), 'names direction conflict');
}

console.log('== spine gate ==');
{
  const W = boot({
    swingScan: () => ({ at: Date.now(), cands: [] }),
    edgeScan: () => ({ at: Date.now(), cands: [] }),
    bestScan: () => ({ at: Date.now(), clean: [] }),
    __hgSmartResults: {
      at: Date.now(),
      results: [{ sym: 'DOGEUSD', setup: { dir: 'long', confirmed: true, entry: 1, stop: 0.9, t1: 1.1 } }]
    },
    squeezeState: () => ({
      at: Date.now(),
      results: [{ sym: 'DOGEUSD', dir: 'long', kind: 'fired', entry: 1, stop: 0.9, t1: 1.1 }]
    }),
    hgMacroAllowsCrypto: () => ({ allow: true })
  });
  const g = W.hgConfirmAggregate(W.hgConfirmHarvest()).filter(x => x.sym.indexOf('DOGE') >= 0)[0];
  ok(g && g.tier !== 'CONFIRMED' && g.tier !== 'PRIME', 'no structural spine → not CONFIRMED (got ' + (g && g.tier) + ')');
  ok(g && g.needs && g.needs.some(n => /SWING\+EDGE|structural/i.test(n)), 'names missing spine');
}

console.log('== overextension block ==');
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
  const g = W.hgConfirmAggregate(W.hgConfirmHarvest()).filter(x => x.sym.indexOf('PEPE') >= 0 && x.dir === 'long')[0];
  ok(g && g.tier === 'BLOCKED', 'overextended +19.5% blocks long chase');
}

console.log('== wiring ==');
{
  const W = boot();
  ok(W.HG_tabs.some(t => t.id === 'setupconfirm'), 'HG_tabs registers setupconfirm');
  const html = read('index.html');
  const sw = read('sw.js');
  ok(/setup-confirm\.js/.test(html), 'index loads setup-confirm.js');
  ok(/setupconfirm/.test(html), 'nav includes setupconfirm');
  ok(/\.\/setup-confirm\.js/.test(sw), 'sw precaches setup-confirm.js');
  ok(/const HG_CACHE = 'hg-v616'/.test(sw) || /const HG_CACHE = 'hg-v617'/.test(sw), 'sw HG_CACHE current');
  ok(/setupconfirm:\s*'cfCards'/.test(read('setup-ui.js')), 'HG_MP_HOST maps setupconfirm');
}

console.log('\npassed: ' + passed);
