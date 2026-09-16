/* HARDGATE — two holes in the promotion path hg-v758 shipped.

   That release made the horizon's cleared book the reachable route to a
   ticket. It got the population right and the statistics wrong.

   OVERLAP. The pooled book is the most overlapping population this desk
   has: every mechanic firing on the same bar is one trade wearing several
   names. The in-sample replay measures an effective n of 3,111 from 7,670
   rows — a ratio of 0.406 — and z scales with the square root of n. Left
   uncorrected the pooled reading is inflated by about 1.57x, so the +1.96σ
   bar it is tested against is really +1.25σ. hgFwdOverlap already measured
   exactly this, on the log's own records, and the gate never called it.

   SHRINKAGE. Promotion needs 20 pooled records, about three days.
   Condemnation needs 20 for one MECHANIC, about a year. So for the first
   year a clearing pool promoted every mechanic, including one at 0-for-3,
   because nothing could condemn it yet. Each mechanic's rate is now shrunk
   toward the pool with weight n/(n+K) and the shrunken rate must still
   clear breakeven — which bites at an n the per-mechanic veto cannot act on
   for another eleven months.

   Run: node tests/test-omnigold-pool-honesty.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
                   'best-levels.js', 'gold-best-levels.js', 'regime.js', 'goldind.js',
                   'pinegoldmath.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

const T0 = 1700000000 - (1700000000 % 86400);
function tape(seed, n, tfSec){
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const rows = []; let p = 2000 + rnd() * 400;
  for (let i = 0; i < n; i++){
    p += 1.1 + (rnd() - 0.5) * 4;
    const o = p, c = p + (rnd() - 0.5) * 5;
    rows.push({ t: T0 + i * tfSec, o, h: Math.max(o, c) + rnd() * 6, l: Math.min(o, c) - rnd() * 6, c, v: 1200 });
  }
  return rows;
}
const rows = tape(7919, 300, 3600);
const hit = { kind: 'ROUND-MAGNET', dir: 'short', level: rows[rows.length - 1].c, why: 't' };

/* minRr 2 -> breakeven exactly 1/3, so every number below is readable */
const BE = 1 / 3;
const edge = fwd => W.hgOgGates(rows, hit, { stats: null, fwd, minRr: 2 })
  .filter(g => g.key === 'measured-edge')[0];

/* a horizon pool with `n` settled cleared rows at `h`, overlap ratio `ratio` */
const pool = (n, h, ratio, own) => ({
  samples: n, hit: h, open: 0, expR: 0.1,
  ticketOnly: null,
  gateClear: own ? { samples: own.n, hit: own.hit, open: 0, expR: 0 } : null,
  horizonPool: { samples: n, hit: h, open: 0, expR: 0.1 },
  horizonOverlap: (ratio == null) ? null : { n: 1000, effN: 1000 * ratio },
  pooledTabs: ['OMNIGOLD:SCALP', 'GOLDSCALP', 'SUPER:GOLD']
});

const BAR = W.hgOgFamilyZ(W.hgOgHorizonPoolTests());
const zOf = (n, h) => (h - BE) / Math.sqrt(BE * (1 - BE) / n);

console.log('== the bar, and the arithmetic the cases rest on ==');
{
  ok(Math.abs(BAR - 1.955) < 0.01, 'the horizon bar is +' + BAR.toFixed(3) + 'σ');
  ok(zOf(60, 0.47) > BAR, '60 rows at 47% clears it (+' + zOf(60, 0.47).toFixed(2) + 'σ) when rows are independent');
  ok(zOf(24, 0.47) < BAR, 'the same 47% on 24 effective rows does not (+' + zOf(24, 0.47).toFixed(2) + 'σ)');
}

console.log('\n== overlap deflates the pool, and the deflation bites ==');
{
  const clean = edge(pool(60, 0.47, 1.0));
  ok(clean.pass === true, 'a pool of 60 at 47% with NO overlap promotes');
  ok(/effective rows/.test(clean.why), 'and the card reports the effective count');

  /* the same book, with the overlap the in-sample replay actually measures */
  const real = edge(pool(60, 0.47, 0.4));
  ok(real.pass !== true, 'the identical book at a 0.4 overlap ratio does NOT');
  ok(/short of the/.test(real.why), 'and says it fell short rather than going quiet');
}

console.log('\n== an unmeasurable overlap is not an overlap of one ==');
{
  const blind = edge(pool(60, 0.47, null));
  ok(blind.pass !== true, 'a pool whose overlap cannot be measured is never promoted');
  ok(/overlap cannot be measured/.test(blind.why), 'and the card says exactly that');
  ok(/not independent bets/.test(blind.why), 'naming the assumption it refuses to make');
}

console.log('\n== the pool does not carry a mechanic pulling away from it ==');
{
  /* 15 of its own at 10%: w = 15/35 = 0.43, shrunk = 0.43*0.10 + 0.57*0.47
     = 0.31, below the 33.3% breakeven. The per-mechanic veto cannot touch
     this yet — it needs 20 — which is the whole point. */
  const dragging = edge(pool(60, 0.47, 1.0, { n: 15, hit: 0.10 }));
  ok(dragging.pass !== true, 'a mechanic at 10% on 15 of its own is held back');
  ok(/shrunk to/.test(dragging.why), 'and the card shows the shrunken rate');
  ok(/not asked to carry it/.test(dragging.why), 'and says the desk is not carrying it');

  /* with nothing of its own it simply IS the pool — that is what partial
     pooling means, and refusing there would make promotion unreachable */
  const silent = edge(pool(60, 0.47, 1.0, { n: 0, hit: 0 }));
  ok(silent.pass === true, 'a mechanic with no record of its own rides the pool');

  /* and one broadly in line with the pool is not punished for noise */
  const inline = edge(pool(60, 0.47, 1.0, { n: 15, hit: 0.40 }));
  ok(inline.pass === true, 'a mechanic near the pool still promotes');
}

console.log('\n== the guards from hg-v758 still hold ==');
{
  /* a mechanic condemned on its OWN record is never rehabilitated */
  const condemned = edge(Object.assign(pool(60, 0.47, 1.0),
    { ticketOnly: { samples: 40, hit: 0.05, open: 0, expR: -0.8 } }));
  ok(condemned.pass === false, 'a mechanic vetoed on its own record stays vetoed');

  /* and a pool too small to judge promotes nothing */
  const thin = edge(pool(8, 0.60, 1.0));
  ok(thin.pass !== true, 'a pool below FWD_MIN_JUDGE promotes nothing however good it looks');
}

console.log('\n== the overlap measurer can answer for the pooled population ==');
{
  const H = 3600;
  const mk = (i, tab, gc) => W.hgFwdNormalize({
    tab: tab, mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
    entry: 4700, stop: 4670, t1: 4760, barT: T0 + i * H, horizonBars: 24, gateClear: gc
  });
  /* ten records an hour apart, each running 24h — heavily concurrent */
  const list = [];
  for (let i = 0; i < 10; i++) list.push(mk(i, i % 2 ? 'GOLDSCALP' : 'OMNIGOLD:SCALP', i < 6));

  const O = W.hgFwdOverlapOf;
  const oneTab = O(list, 'OMNIGOLD:SCALP', null);
  const pooledTabs = O(list, ['OMNIGOLD:SCALP', 'GOLDSCALP'], null);
  ok(pooledTabs.n > oneTab.n, 'a tab LIST sees more records than one tab (' + pooledTabs.n + ' vs ' + oneTab.n + ')');
  ok(pooledTabs.effN < pooledTabs.n, 'and the pooled book is deflated by its own concurrency');

  const gcOnly = O(list, ['OMNIGOLD:SCALP', 'GOLDSCALP'], null, { gateClear: true });
  ok(gcOnly.n === 6, 'the gate-clear filter narrows it to the population being judged (' + gcOnly.n + ')');
  ok(gcOnly.n < pooledTabs.n, 'which is not the same population as the whole log');

  /* refusing to guess is the contract */
  ok(O([mk(0, 'OMNIGOLD:SCALP', true)], ['OMNIGOLD:SCALP'], null) === null,
     'a single record yields null, not an overlap of 1');
}

console.log('\n== the gate reads it from the log, not from a constant ==');
{
  ok(/hgFwdOverlap\(tabs, null, \{ gateClear: true \}\)/.test(SRC),
     'the overlap is measured on the same population the test runs on');
  /* scoped to the promotion block itself — OG_EFF_N_RATIO is defined
     elsewhere in this file and belongs there; what must not happen is the
     forward path borrowing it */
  const blockStart = SRC.indexOf('PROMOTION RUNS ON');
  const block = SRC.slice(blockStart, SRC.indexOf('HARD when proof is required', blockStart));
  ok(blockStart > 0 && block.length > 500, 'the promotion block is found (' + block.length + ' chars)');
  ok(!/0\.406|OG_EFF_N_RATIO|hgOgEffN/.test(block),
     'and the in-sample overlap constant is never imported into the forward path');
  ok(/hpN \* ovlRatio/.test(SRC), 'the ratio is applied, not the raw effective count');
}

console.log('\n' + passed + ' passed, 0 failed');
