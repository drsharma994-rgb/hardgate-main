/* HARDGATE Fix Pack 9 — funding in net R + Wilson on scorecard board.
   Run: node tests/test-fix-pack-9.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const S = html.indexOf('const HG_FEE_TAKER_PCT');
const E = html.indexOf("const LOG_KEY='hardgate_log_v1';");
if (S < 0 || E < 0 || E < S) throw new Error('FAIL: cost/stats helper block not found');
const ctx = { console, Math, isFinite, parseFloat, localStorage: { getItem: () => null } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(html.slice(S, E), ctx, { filename: 'cost-block' });

console.log('== hgFundingCostR models 8h settlements in R ==');
{
  /* entry 100, stop 99.65 -> 0.35% risk; 16h hold = 2 settlements */
  const cost = ctx.hgFundingCostR(100, 99.65, 'long', 0.01, 16 * 3600);
  ok(cost > 0, 'long pays positive funding');
  ok(near(cost, 0.01 * 2 / 0.35, 0.001), 'two 8h intervals at 0.01%/8h ≈ ' + cost.toFixed(4) + 'R');
  const rebate = ctx.hgFundingCostR(100, 99.65, 'short', 0.01, 16 * 3600);
  ok(rebate < 0, 'short receives when funding is positive');
  ok(near(rebate, -cost, 1e-9), 'short rebate mirrors long cost');
  ok(ctx.hgFundingCostR(100, 99.65, 'long', 0.01, 3600) > 0, 'partial interval counts one settlement (ceil)');
}

console.log('== hgNetR subtracts funding from settled log rows ==');
{
  const base = { status: 'tp', rr: 2, entry: 100, stop: 99.65, dir: 'long',
    filledTs: 1000, doneTs: 1000 + 16 * 3600, fundingPct: 0.01 };
  const noFund = ctx.hgNetR(Object.assign({}, base, { fundingPct: null }));
  const withFund = ctx.hgNetR(base);
  ok(withFund < noFund, 'funding drag lowers net TP (' + withFund.toFixed(4) + ' vs ' + noFund.toFixed(4) + 'R)');
  ok(ctx.hgNetR(Object.assign({}, base, { status: 'open' })) === 0, 'open rows still 0');
}

console.log('== scorecard net R includes funding when model is loaded ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8');
  const scCtx = vm.createContext({
    window: {
      hgCostR: ctx.hgCostR,
      hgFundingCostR: ctx.hgFundingCostR,
      hgWilson: ctx.hgWilson
    },
    console, setTimeout, clearTimeout, Promise
  });
  vm.runInContext(SRC, scCtx, { filename: 'scorecard.js' });
  const w = scCtx.window;
  const rec = { entry: 100, stop: 99.65, dir: 'long', fundingPct: 0.01, at: 1e12 };
  const closedAt = rec.at / 1000 + 16 * 3600;
  const gross = 2;
  const netNoFund = w.hgScoreNetR(Object.assign({}, rec, { fundingPct: null }), 'T1', gross, closedAt);
  const netFund = w.hgScoreNetR(rec, 'T1', gross, closedAt);
  ok(netFund !== null && netNoFund !== null, 'net R computed');
  ok(netFund < netNoFund, 'scorecard net includes funding drag');
}

console.log('== scorecard board shows Wilson CI when hgWilson is loaded ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8');
  const scCtx = vm.createContext({
    window: { hgWilson: ctx.hgWilson },
    console, setTimeout, clearTimeout, Promise
  });
  vm.runInContext(SRC, scCtx, { filename: 'scorecard.js' });
  const st = scCtx.window.hgScoreStats([
    { status: 'settled', r: 2, rNet: 1.8, dir: 'long', tier: 'PRIME' },
    { status: 'settled', r: -1, rNet: -1.1, dir: 'long', tier: 'PRIME' },
    { status: 'settled', r: 2, rNet: 1.7, dir: 'long', tier: 'HIGH' },
    { status: 'settled', r: 2, rNet: 1.9, dir: 'short', tier: 'PRIME' },
    { status: 'settled', r: -1, rNet: -1.2, dir: 'short', tier: 'HIGH' },
  ]);
  const board = scCtx.window.hgScoreBoardHtml(st);
  ok(board.indexOf('95% CI') >= 0, 'board HTML includes Wilson CI');
  ok(board.indexOf('the CI is the verdict') >= 0, 'board nudges toward CI over point estimate');
  ok(board.indexOf('after Delta fees + funding') >= 0, 'NET note mentions funding');
}

console.log('== sw cache bumped for fix pack 9 ==');
{
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/hg-v175/.test(sw), 'sw cache hg-v175');
}

console.log('\n' + passed + ' passed, 0 failed');
