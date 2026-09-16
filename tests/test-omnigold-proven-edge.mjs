/* HARDGATE — PROVEN EDGE: the forward bar that can actually be cleared.

   WHY THIS TEST EXISTS. OMNIGOLD's headline promotion used to be SETTLED
   EXECUTE: a settled forward record with Wilson 95% lower bound >= 95%. That
   bar is unreachable by construction, not merely strict. The Wilson lower
   bound converges UPWARD to the true win rate, so requiring lo >= 95% is a
   claim about the TRUE rate — it needs a mechanic that wins ~97% of the time.
   Gold's own grids peak near 54%, where the bound converges to ~53.7% and
   never clears at any sample size. The tier could never fire and the panel
   told the reader to keep scanning towards it.

   PROVEN EDGE replaces it as the headline: the lower bound must clear the win
   rate the plan needs to BREAK EVEN, which is 1/(1+avgRr) at the reward
   multiple the winners actually carried. That is a real statistical bar — it
   still refuses thin and losing records — but a genuine 54% mechanic can
   reach it, which is the whole point.

   Run: node tests/test-omnigold-proven-edge.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  ctx.hgWilson = (wins, n, z) => {
    z = z || 1.96; const p = wins / n, z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p: p };
  };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const wilson = W.hgWilson;
/* evidence fixture: wins/n at a stated reward multiple */
const ev = (wins, n, avgRr) => ({ wins, samples: n, hit: wins / n, avgRr,
                                  wilson: wilson(wins, n), source: 'test' });

console.log('== breakeven is the reward multiple, never an assumption ==');
{
  ok(near(W.hgOgBreakevenHit(1.5), 0.4), '1.5R needs 40% to break even');
  ok(near(W.hgOgBreakevenHit(1), 0.5), '1R needs 50%');
  ok(near(W.hgOgBreakevenHit(3), 0.25), '3R needs 25%');
  /* the null-formatting discipline applied to a gate: an unknown reward
     multiple must not become a breakeven, because a made-up one promotes */
  ok(!isFinite(W.hgOgBreakevenHit(NaN)), 'unknown R is NaN, not a number');
  ok(!isFinite(W.hgOgBreakevenHit(0)), 'zero R is NaN, not 100%');
  ok(!isFinite(W.hgOgBreakevenHit(null)), 'null R is NaN, not 100%');
}

console.log('\n== the bar promotes a real edge and refuses the rest ==');
{
  /* 60/110 at 54.5% on 1.5R: lower bound 45.2% vs 40% breakeven */
  ok(W.hgOgProvenEdgeOk(ev(60, 110, 1.5)), '54.5% on 110 trades at 1.5R is a proven edge');
  /* 30/55 — same hit rate, half the sample: bound 41.5%, clears by only 1.5pt */
  ok(!W.hgOgProvenEdgeOk(ev(30, 55, 1.5)), 'same rate on 55 trades clears by too little');
  /* 12/20 at 60%: bound 38.7%, BELOW the 40% breakeven despite the high hit */
  ok(!W.hgOgProvenEdgeOk(ev(12, 20, 1.5)), '60% hit on 20 trades is still below breakeven');
  /* perfect but thin: 20 < the 25-trade minimum */
  ok(!W.hgOgProvenEdgeOk(ev(20, 20, 1.5)), '20/20 is too thin to promote');
  /* a losing mechanic never promotes, however many trades it settles */
  ok(!W.hgOgProvenEdgeOk(ev(390, 1000, 1.5)), '39% at 1.5R never promotes — it loses');
  /* no reward multiple -> no breakeven -> silent, not promoted */
  ok(!W.hgOgProvenEdgeOk(ev(60, 110, NaN)), 'unknown R cannot promote');
}

console.log('\n== THE POINT: a real edge clears PROVEN and never the 95% ceiling ==');
{
  const real = ev(550, 1000, 1.5);          /* 55% hit, 1000 settled trades */
  ok(W.hgOgProvenEdgeOk(real), '55% on 1000 trades is proven profitable');
  ok(!W.hgOgSettledExecuteOk(real, 0.95, 15), '…and still cannot clear the 95% bar');
  /* and it never will: the bound converges upward to the true rate */
  const huge = ev(55000, 100000, 1.5);
  ok(!W.hgOgSettledExecuteOk(huge, 0.95, 15), '100,000 trades at 55% still cannot');
  ok(huge.wilson.lo < 0.56, 'the bound converges to the true rate, not to 1');
}

console.log('\n== ranking is by edge over breakeven, not by hit rate ==');
{
  const highHit = ev(60, 110, 1.5);   /* 54.5% hit, breakeven 40% -> ~5.2pt  */
  const bigPay  = ev(160, 300, 3);    /* 53.3% hit, breakeven 25% -> ~22.7pt */
  ok(bigPay.hit < highHit.hit, 'the payoff mechanic has the LOWER hit rate');
  ok(W.hgOgEdgeMargin(bigPay) > W.hgOgEdgeMargin(highHit),
     '…and still carries more edge, because its plan needs less to break even');
  ok(!isFinite(W.hgOgEdgeMargin(ev(60, 110, NaN))), 'margin is NaN when R is unknown');
}

console.log('\n== the panel no longer sells an unreachable bar ==');
{
  const html = W.hgOgSettledExecutePanelHtml({
    execute: [], proven: [], best: [],
    minLo: 0.95, minN: 15, edgeMinN: 25, edgeMargin: 0.02
  });
  ok(/PROVEN EDGE/.test(html), 'proven edge leads the panel');
  ok(/NEAR-CERTAINTY CEILING/.test(html), 'the 95% bar is labelled a ceiling');
  ok(/expected to stay so/.test(html), 'it says the ceiling is expected to stay empty');
  ok(/97%/.test(html), 'it states the true win rate the ceiling would need');
  ok(!/keep scanning to build the forward log/.test(html),
     'it no longer tells the reader to scan towards an unreachable bar');
}

console.log('\n== a plan that is a clean 2R and still nonsense against spot ==');
{
  /* Reported from the desk, XAUUSD SHORT SWING / THREE-BAR:
       market 4282.70   entry 4316.20   stop 4326.05   T1 4296.51
     The arithmetic is right — risk is 9.85, and 4316.20 - 2(9.85) = 4296.50,
     so T1 really is 2.0R and the "20 pts · 0.46%" readout matches. What is
     wrong is WHERE it sits: the entry is a retest 34 pts ABOVE the market, and
     T1 lands BETWEEN market and entry. Price climbing to the entry must cross
     TP1 on the way, so the target is behind price rather than ahead of it.

     hgOgEntryMarketNote has named that geometry since v697, but the settled-
     evidence row never called it, so this panel was the one place that printed
     such a plan with no warning at all. */
  const entry = 4316.20, stop = 4326.05, t1 = 4296.51, mkt = 4282.70;
  const risk = stop - entry;
  ok(Math.abs((entry - t1) / risk - 2) < 0.01, 'the plan really is 2.0R — the arithmetic was never the bug');
  ok(t1 > mkt && t1 < entry, 'and T1 sits between the market and the entry');

  const note = W.hgOgEntryMarketNote({ dir: 'short', livePx: mkt }, { entry, stop, t1 });
  ok(/crosses TP1 before fill/.test(note), 'the detector names it: the retest crosses TP1 before fill');

  const row = {
    horizon: 'SWING', kind: 'THREE-BAR', dir: 'short', livePx: mkt,
    grade: { ticket: true }, plan: { entry, stop, t1 },
    settledEv: { source: 'OMNIGOLD:SWING:THREE-BAR', wins: 1, samples: 1, hit: 1,
                 avgRr: 2.0, wilson: wilson(1, 1) }
  };
  const html = W.hgOgSettledExecutePanelHtml({
    execute: [], proven: [], best: [row], minLo: 0.95, minN: 15, edgeMinN: 25, edgeMargin: 0.02
  });
  ok(/crosses TP1 before fill/.test(html), 'and the settled-evidence row now carries that warning');
  ok(/limit retest/.test(html), 'along with the fact that it is a retest, not a market short');

  /* a plan whose T1 is genuinely ahead of price must NOT be flagged */
  const clean = W.hgOgEntryMarketNote({ dir: 'short', livePx: 4320.00 },
                                      { entry: 4316.20, stop: 4326.05, t1: 4296.51 });
  ok(!/crosses TP1/.test(clean), 'a target still ahead of price raises no warning');
}

console.log('\n== source still carries the old names for the wired-in checks ==');
{
  const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/Wilson 95% lower bound/.test(GOLD), 'the bar is still stated in full');
  ok(/OG_EDGE_MIN_N/.test(GOLD), 'the proven-edge minimum is a named constant');
}

console.log('\nomnigold proven edge: ' + passed + ' checks passed');
