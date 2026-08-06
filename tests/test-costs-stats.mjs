/* HARDGATE — trading costs, sample statistics, and the directional funding gate.
   Three things this pins:
   1) The LOG used to report ΣR gross. Delta India charges taker 0.05% / maker
      0.02% PLUS 18% GST on the fee, on notional — so cost in R is
      costPct/stopPct and a tight stop is bitten hardest. A 15m scalp book
      reading +0.30R/trade gross at a 0.35% stop is roughly break-even net.
   2) "n < 30" was a threshold, not a measurement. Wilson replaces it.
   3) swing G4 used |funding| <= 0.05, which vetoed a LONG at -0.06% — when
      shorts are PAYING you. Measured: two thirds of the setups where funding
      paid the trade were being blocked.
   Run: node tests/test-costs-stats.mjs                                       */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
/* ---- helper block, lifted out of index.html ---- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const S = html.indexOf('const HG_FEE_TAKER_PCT');
const E = html.indexOf("const LOG_KEY='hardgate_log_v1';");
if (S < 0 || E < 0 || E < S) throw new Error('FAIL: cost/stats helper block not found in index.html');
const ctx = { console, Math, isFinite, parseFloat, localStorage: { getItem: () => null } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(html.slice(S, E), ctx, { filename: 'cost-block' });
console.log('== Delta fee model includes GST and distinguishes maker from taker ==');
{
  ok(near(ctx.hgRoundTripPct('taker', 'taker'), 0.118), 'taker/taker round trip = 0.1180% (0.05x2 x1.18 GST)');
  ok(near(ctx.hgRoundTripPct('maker', 'taker'), 0.0826), 'maker/taker round trip = 0.0826%');
  ok(near(ctx.hgRoundTripPct('maker', 'maker'), 0.0472), 'maker/maker round trip = 0.0472%');
  ok(ctx.hgRoundTripPct('maker', 'maker') < ctx.hgRoundTripPct('taker', 'taker'),
     'a limit exit genuinely costs less — the model does not flatten the two');
}
console.log('== cost in R scales inversely with stop distance ==');
{
  /* entry 100, stop 99.65 -> 0.35% stop, the scalp case */
  const scalp = ctx.hgCostR(100, 99.65, 'maker', 'taker');
  const swing = ctx.hgCostR(100, 97.00, 'maker', 'taker');
  ok(scalp > 0.23 && scalp < 0.25, 'a 0.35% stop costs ~0.236R per round trip');
  ok(swing > 0.027 && swing < 0.029, 'a 3.00% stop costs ~0.028R — a rounding error');
  ok(scalp > swing * 8, 'the tight stop is bitten roughly an order of magnitude harder');
  ok(ctx.hgCostR(100, 100, 'maker', 'taker') === 0, 'zero stop distance returns 0, never Infinity');
  ok(ctx.hgCostR(NaN, 99, 'maker', 'taker') === 0, 'unknown entry returns 0, never a guessed cost');
}
console.log('== net R is gross minus the cost of the side that actually filled ==');
{
  const tp = ctx.hgNetR({ status: 'tp', rr: 2, entry: 100, stop: 99.65 });
  const sl = ctx.hgNetR({ status: 'sl', rr: 2, entry: 100, stop: 99.65 });
  ok(tp < 2 && tp > 1.8, 'a 2R win nets ' + tp.toFixed(3) + 'R, not 2R (limit in, limit out)');
  ok(sl < -1, 'a loss is WORSE than -1R once the market stop exit is paid');
  ok(Math.abs(sl + 1) > Math.abs(tp - 2), 'the SL leg costs more than the TP leg — taker exit');
  ok(ctx.hgNetR({ status: 'open', rr: 2, entry: 100, stop: 99 }) === 0, 'open rows contribute 0');
  /* the headline: a gross-positive scalp book that is negative net */
  const p = 0.45, rr = 2;
  const gross = p * rr - (1 - p);
  const net = p * ctx.hgNetR({ status: 'tp', rr: rr, entry: 100, stop: 99.65 })
            + (1 - p) * ctx.hgNetR({ status: 'sl', rr: rr, entry: 100, stop: 99.65 });
  ok(gross > 0, '45% hit rate on 2R is +' + gross.toFixed(3) + 'R/trade GROSS');
  ok(net < gross, 'the same book is only ' + net.toFixed(3) + 'R/trade NET');
  ok(gross - net > 0.15, 'the drag on a 0.35% stop exceeds 0.15R — not a rounding error');
}
console.log('== Wilson interval replaces the n<30 threshold ==');
{
  const small = ctx.hgWilson(9, 15);
  ok(small.lo < 0.40 && small.hi > 0.75, '9/15 spans ~35-80% — indistinguishable from a coin flip');
  const big = ctx.hgWilson(55, 100);
  ok(big.hi - big.lo < small.hi - small.lo, '55/100 is a materially tighter interval');
  ok(big.lo > 0.44 && big.hi < 0.66, '55/100 spans roughly 45-65%');
  const perfect = ctx.hgWilson(5, 5);
  ok(perfect.hi <= 1 && perfect.lo < 1 && perfect.lo > 0,
     '5/5 does not collapse to 100% — where the normal approximation breaks');
  ok(ctx.hgWilson(0, 0) === null, 'no trades returns null, not NaN');
  ok(ctx.hgWilson(3, 2) === null, 'wins > n is rejected');
}
console.log('== breakeven hit rate moves once costs are counted ==');
{
  const gross = ctx.hgBreakevenHit(2, 0);
  const net = ctx.hgBreakevenHit(2, ctx.hgCostR(100, 99.65, 'maker', 'taker'));
  ok(near(gross, 1 / 3, 1e-9), 'gross breakeven on a 2R target is 33.3%');
  ok(net > 0.40 && net < 0.42, 'net breakeven on a 0.35% stop rises past 41%');
}
console.log('== swing G4 no longer vetoes funding that PAYS the trade ==');
{
  const gctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
  gctx.window = gctx; gctx.globalThis = gctx; gctx.self = gctx;
  vm.createContext(gctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'cryptogates.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), gctx, { filename: f });
  }
  const rows = [];
  let p = 100;
  for (let i = 0; i < 300; i++){
    const o = p; p = o * 1.004;
    rows.push({ t: i * 14400, o, h: Math.max(o, p) * 1.004, l: Math.min(o, p) * 0.996, c: p, v: 1000 + (i % 7) * 100 });
  }
  const g4of = (fr) => {
    const m = gctx.swingGateMatrix(rows, { symbol: 'X', fundingPct: fr });
    const g = m.gates.find(x => String(x[0]).indexOf('G4') === 0);
    return { dir: m.dir, pass: !!(g && g[1]) };
  };
  ok(g4of(0.005).dir === 'long', 'fixture reads a long cascade');
  ok(g4of(-0.06).pass === true, 'LONG at funding -0.06% PASSES — shorts are paying you');
  ok(g4of(-0.20).pass === true, 'LONG at funding -0.20% still passes — size is not a crowd read');
  ok(g4of(0.06).pass === false, 'LONG at funding +0.06% is still vetoed — that runs against you');
  ok(g4of(0.04).pass === false, 'the directional threshold still bites at +0.04%');
  ok(g4of(0.35).pass === false, 'beyond the sanity bound is rejected as a suspect feed');
}
console.log('\n' + passed + ' passed, 0 failed');
