/* HARDGATE — "why doesn't any of it work?"

   The pooled table measures every mechanic at ONE setting: a 2R target with a
   20-bar horizon, because that is what MIN_RR and the scan config say.
   Twenty-two mechanics all sitting at breakeven there is not twenty-two
   broken mechanics — twenty-two independent things do not fail in one tidy
   gradient. It is one frame applied to all of them.

   Swept on synthetic tapes, the SAME six original detectors ran from
   -18.7 sigma at 3R/10 bars to +2.5 sigma at 1.5R/40 bars. Nothing about the
   detectors changed between those numbers; target and horizon did all the
   work. This runs that sweep on the REAL bars a scan just fetched.

   WHAT IT IS NOT: a recommendation. Every figure is in-sample and gross, and
   the best of twelve cells is the best of twelve searches — the same
   multiple-comparisons bar that applies to picking a mechanic applies to
   picking a parameter set. The panel says so; this file asserts it says so,
   because a grid that quietly implies "switch to 1R" would be the most
   expensive thing in the app.

   Two shapes it had to be forced into. Running all twenty-two mechanics
   twelve times took 197 SECONDS on twenty-five contracts — a frozen tab, not
   a button — so the grid holds the six core detectors fixed, which is also
   what makes the rows comparable. And a single synchronous pass blocked the
   thread for the whole run, so it yields between cells: 6.2s total at
   production shape with no block longer than ~1.4s.

   Run: node tests/test-parameter-grid.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  const el = () => ({ style: {}, innerHTML: '', textContent: '', id: '', appendChild(){},
                      setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] });
  ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
                   querySelectorAll: () => [], head: { appendChild(){} }, body: el(),
                   documentElement: el(), addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'hg-gates.js', 'omniroute.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 14400);
function tape(n, seed, mode){
  const out = []; let p = 60000, s = seed, d = 0;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    d = mode === 'trend' ? 0.10 : mode === 'range' ? Math.sin(i / 40) * 0.25 : 0;
    p = p * (1 + (rnd() - 0.48 + d) * 0.006);
    const r = p * 0.0025 * (0.5 + rnd());
    out.push({ t: T0 + i * 14400, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1500 });
  }
  return out;
}
/* Production shape: BARS = 180, GRID_SAMPLE = 25, mixed market types. */
const ROWSLIST = [];
for (let k = 0; k < 25; k++) ROWSLIST.push(tape(180, k + 1, ['trend', 'range', 'chop'][k % 3]));

console.log('== one cell answers one question ==');
{
  ok(typeof W.hgOmniGridRun === 'function', 'hgOmniGridRun is exported');
  const c = W.hgOmniGridRun(ROWSLIST, 2, 20);
  ok(!!c, 'the live setting produces a cell');
  ok(c.settled > 100, 'with a real sample behind it (' + c.settled + ' settled)');
  ok(Math.abs(c.be - 1 / 3) < 1e-9, 'breakeven for a 2R target is 33.3% (' + (c.be * 100).toFixed(1) + '%)');
  ok(c.hit >= 0 && c.hit <= 1, 'the hit rate is a proportion of settled trades (' + (c.hit*100).toFixed(1) + '%)');
  ok(Math.abs(c.expR - (c.hit * 2 - (1 - c.hit))) < 1e-9, 'expectancy is hit*R - (1-hit), not an assumption');
  /* Breakeven must move with the target, or every row would be judged against
     the same bar and the grid would say nothing. */
  ok(Math.abs(W.hgOmniGridRun(ROWSLIST, 1, 20).be - 0.5) < 1e-9, 'a 1R target breaks even at 50%');
  ok(Math.abs(W.hgOmniGridRun(ROWSLIST, 3, 20).be - 0.25) < 1e-9, 'a 3R target at 25%');
}

console.log('\n== THE FINDING: the parameters move the result, the mechanics do not change ==');
{
  /* Same detectors, same bars, same stop model in every cell. */
  const at = (r, h) => W.hgOmniGridRun(ROWSLIST, r, h);
  const worst = at(3, 10), live = at(2, 20), longer = at(2, 40);
  ok(worst.z < live.z, '3R/10 is worse than the live 2R/20 (' + worst.z.toFixed(2) + ' vs ' + live.z.toFixed(2) + ')');
  ok(longer.z > live.z, 'and 2R/40 is better than it (' + longer.z.toFixed(2) + ')');
  ok(worst.z < -5, 'the worst corner is decisively negative (' + worst.z.toFixed(2) + ')');
  /* The gradient must be monotone in R at a fixed horizon — that is the shape
     that says "one frame applied to all of them" rather than noise. */
  const h20 = [1, 1.5, 2, 3].map(r => at(r, 20).z);
  let monotone = true;
  for (let i = 1; i < h20.length; i++) if (h20[i] > h20[i - 1] + 0.5) monotone = false;
  ok(monotone, 'sigma falls as the target rises at a fixed horizon (' + h20.map(z => z.toFixed(1)).join(' > ') + ')');
  /* And longer horizons help at a fixed target. */
  const r2 = [10, 20, 40].map(h => at(2, h).z);
  ok(r2[2] > r2[0], 'and rises with the horizon at a fixed target (' + r2.map(z => z.toFixed(1)).join(' < ') + ')');
}

console.log('\n== it holds the mechanic set FIXED, which is what makes rows comparable ==');
{
  ok(/var GRID_MECHS = \['SPRING', 'PO3', 'ORB', 'ABSORB', 'VALUE', 'MMOVE'\]/.test(SRC),
     'the grid runs the six core detectors');
  ok(/197 SECONDS/.test(SRC), 'and records why it is not all twenty-two');
  /* Every cell must measure the SAME detectors, or the rows compare different
     things and the gradient means nothing. */
  const a = W.hgOmniGridRun(ROWSLIST, 1, 20);
  const b = W.hgOmniGridRun(ROWSLIST, 3, 20);
  ok(a.settled > 0 && b.settled > 0, 'both extremes produce samples');
  ok(a.settled >= b.settled, 'a nearer target settles at least as often (' + a.settled + ' vs ' + b.settled + ')');
}

console.log('\n== the panel refuses to read as a recommendation ==');
{
  const html = W.hgOmniGridHTML(ROWSLIST.slice(0, 4));
  ok(/diagnostic, not a recommendation/.test(html), 'it says so in bold');
  ok(/IN-SAMPLE/.test(html) && /GROSS/.test(html), 'and that the figures are in-sample and gross');
  ok(/best of 12 cells is the best of 12 searches/.test(html),
     'and that picking a parameter set is itself a search');
  ok(/multiple-comparisons bar/.test(html), 'naming the correction that applies');
  ok(/only after the forward log has measured it/.test(html),
     'and refuses to sanction a change on in-sample evidence');
  ok(/&larr; live/.test(html), 'the live setting is marked so the reader can locate themselves');
  ok(/Strongest cell on this window/.test(html), 'the best cell is named rather than left to be eyeballed');
  ok(/Live is 2R \/ 20 bars/.test(html), 'next to what is actually being traded');
}

console.log('\n== degenerate input never throws and never invents a cell ==');
{
  ok(/No bars retained/.test(W.hgOmniGridHTML([])), 'no bars says run a scan first');
  ok(/No bars retained/.test(W.hgOmniGridHTML(null)), 'and so does null');
  for (const bad of [[[]], [null], [[null, null]], [ROWSLIST[0].slice(0, 3)]]){
    let threw = null, out = null;
    try { out = W.hgOmniGridHTML(bad); } catch (e) { threw = e; }
    ok(!threw, 'grid over ' + JSON.stringify(bad).slice(0, 22) + ' does not throw');
    ok(typeof out === 'string' && out.length > 0, 'and still returns a panel');
    ok(!/NaN|undefined/.test(out), 'with no NaN in it');
  }
  const thin = W.hgOmniGridHTML([tape(60, 1, 'chop')]);
  ok(/no settled samples at this setting/.test(thin) || /SETTLED/.test(thin),
     'a window too short to settle anything says so rather than printing zeros');
}

console.log('\n== it yields between cells instead of freezing the tab ==');
{
  ok(/function hgOmniGridProgressive/.test(SRC), 'there is a progressive runner');
  ok(/setTimeout\(step, 0\)/.test(SRC), 'which yields between cells');
  ok(/hgOmniGridProgressive\(__omni\.gridRows/.test(SRC), 'and the button uses it, not the blocking build');
  ok(/var GRID_SAMPLE = 25;/.test(SRC), 'with the sample capped so the whole run stays in seconds');
  ok(/__omni\.gridRows = meritOrder\.slice\(0, GRID_SAMPLE\)/.test(SRC),
     'bars are retained from the scan, so the grid costs no network');
}

console.log('\n== the progressive runner produces the same table as the blocking one ==');
await new Promise((resolve) => {
  const small = ROWSLIST.slice(0, 4);
  const sync = W.hgOmniGridHTML(small);
  let progressCalls = 0;
  W.hgOmniGridProgressive(small,
    () => { progressCalls++; },
    (html) => {
      ok(progressCalls === 12, 'it reported progress once per cell (' + progressCalls + ')');
      const strip = s => s.replace(/measuring[\s\S]*?settings<\/div>/g, '');
      ok(strip(html) === strip(sync), 'and the finished table matches the synchronous build exactly');
      resolve();
    });
});

console.log('\n== an empty list is handled by the progressive path too ==');
await new Promise((resolve) => {
  W.hgOmniGridProgressive([], () => { ok(false, 'should not report progress'); },
    (html) => { ok(/No bars retained/.test(html), 'no bars short-circuits to the same message'); resolve(); });
});

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PARAMETER GRID TESTS PASSED');
