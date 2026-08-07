/* HARDGATE Fix Pack 11 — vol mesh. Run: node tests/test-fix-pack-11.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== deribit vol classify ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'deribit-vol.js'), 'utf8');
  const ctx = vm.createContext({ window: {}, console, Math, Date, fetch: null });
  vm.runInContext(src, ctx, { filename: 'deribit-vol.js' });
  const W = ctx.window;
  ok(W.deribitVolClassify(35) === 'low', 'DVOL 35 → low');
  ok(W.deribitVolClassify(55) === 'normal', 'DVOL 55 → normal');
  ok(W.deribitVolClassify(70) === 'high', 'DVOL 70 → high');
  ok(W.deribitVolClassify(90) === 'extreme', 'DVOL 90 → extreme');
}

console.log('== spot-perp divergence pure ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'spot-perp.js'), 'utf8');
  const ctx = vm.createContext({ window: {}, console, Math });
  vm.runInContext(src, ctx, { filename: 'spot-perp.js' });
  const W = ctx.window;
  const mk = (r) => Array.from({ length: 16 }, (_, i) => ({ buySellRatio: r, t: i }));
  const trapLong = W.spotPerpDivergence(mk(1.2), mk(0.85));
  ok(trapLong.trap === true && trapLong.reason.indexOf('SPOT-PERP') >= 0, 'perp long + spot sell → trap');
  const align = W.spotPerpDivergence(mk(1.08), mk(1.05));
  ok(align.confirms === true, 'both legs aligned → confirms');
  const assess = W.spotPerpFlowAssess(mk(1.2), mk(0.85), 'long');
  ok(assess.veto === true, 'spotPerpFlowAssess vetoes misaligned long');
}

console.log('== flowTrapAssess spot-perp 4th arg ==');
{
  const brainSrc = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');
  const spotSrc = fs.readFileSync(path.join(ROOT, 'spot-perp.js'), 'utf8');
  const ctx = vm.createContext({ window: {}, console, Math, Date, JSON, Array, Object, Number, String, isFinite, parseFloat, setTimeout, Promise });
  vm.runInContext(spotSrc, ctx, { filename: 'spot-perp.js' });
  vm.runInContext(brainSrc, ctx, { filename: 'brain.js' });
  const W = ctx.window;
  const perp = Array.from({ length: 20 }, () => ({ buySellRatio: 1.2 }));
  const spot = Array.from({ length: 20 }, () => ({ buySellRatio: 0.85 }));
  const ft = W.hgFlowTrapAssess(perp, null, 'long', spot);
  ok(ft.veto === true && ft.reason.indexOf('SPOT-PERP') >= 0, 'flowTrapAssess merges spot-perp veto');
}

console.log('== brain stables + dvol votes ==');
{
  const brainSrc = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');
  const ctx = vm.createContext({ window: {}, console, Math, Date, JSON, Array, Object, Number, String, isFinite, parseFloat, setTimeout, Promise });
  vm.runInContext(brainSrc, ctx, { filename: 'brain.js' });
  const W = ctx.window;
  const col = W.brainCollect({
    sym: 'BTCUSDT', lane: 'crypto',
    news: { risk: 'low' },
    regime: { label: 'MIXED', score: 0, playbook: { bias: 'BOTH' } },
    stables: { totalUSD: 200e9, delta7dUSD: 2e9, delta7dPct: 1.0, usdtUSD: 120e9, usdcUSD: 40e9 },
    dvol: { dvol: 72, regime: 'high' },
    rotation: { season: 'btc', altPct: 45 },
    onchain: { bias: 'neutral' },
    engine: { at: Date.now(), survivors: [], rejected: [] },
    oiflow: { results: [] },
    squeeze: { results: [] },
    tape: {},
    fng: { v: 50 }
  });
  const stVote = col.votes.find(v => v.layer === 'stables');
  const dvVote = col.votes.find(v => v.layer === 'dvol');
  ok(stVote && stVote.vote === 'long', 'stables inflow → long context');
  ok(dvVote && dvVote.caution === true, 'high DVOL → caution chip');
}

console.log('== regime stable components ==');
{
  const regimeSrc = fs.readFileSync(path.join(ROOT, 'regime.js'), 'utf8');
  const ctx = vm.createContext({
    window: { document: { createElement: () => ({ style: {} }) } },
    console, Math, Date, JSON, fetch: null, Promise, setTimeout, clearTimeout,
    Object, Array, Number, String, isFinite, parseFloat
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'binance.js'), 'utf8'), ctx, { filename: 'binance.js' });
  vm.runInContext(regimeSrc, ctx, { filename: 'regime.js' });
  const W = ctx.window;
  const verdict = W.regimeVerdict({
    stable: { totalUSD: 150e9, delta7dUSD: 1e9, usdtUSD: 90e9, usdcUSD: 30e9 },
    btc: { close: 100, ema50: 99, ema200: 90 },
    ethbtc: { ema20Now: 0.05, ema20Prev: 0.04 },
    btcd: { pct: 52 },
    fng: { value: 50 },
    dxy: { value: 104, trend20: 'FLAT' },
    us10y: { value: 4, trend: 'FLAT' },
    gold: { close: 2000, ema200: 1950 }
  });
  const r8 = verdict.rows.find(r => r.id === 'R8');
  ok(r8 && r8.stamp === 'BULL', 'R8 scores inflow when 7d delta > 0.5%');
}

console.log('== sw cache bumped for fix pack 11 ==');
{
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/const HG_CACHE = 'hg-v177'/.test(sw), 'sw cache hg-v177');
  ok(sw.indexOf('deribit-vol.js') >= 0 && sw.indexOf('spot-perp.js') >= 0, 'HG_SHELL includes new modules');
}

console.log('\n' + passed + ' passed, 0 failed');
