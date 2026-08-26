/* HARDGATE — the fill-risk read: a limit away from market is not a position.

   WHY IT EXISTS. Replaying every gold setup the desk forms and asking whether
   price ever traded the plan's entry inside the horizon: about one in ten
   shown setups never fills at all, and past 0.25R from market it is one in
   five (SCALP 21.3%, SWING 18.7%), one in three past 1R. Nothing on the card
   said so.

   The same replay is why this is disclosure and not decoration: counting
   away-limits as if they always filled flipped a -0.285R population to
   +0.401R on paper — the limits that never fill are disproportionately the
   trades where price ran off favourably without you. Any measurement or
   reader that assumes fills is optimistic in exactly the flattering
   direction.

   INFO, NEVER A VETO. Fill risk is a property of the ORDER, not the setup —
   the setup may be excellent and simply require missing it one time in five.
   And it must ABSTAIN at or through market: an order that fills immediately
   has no fill risk to argue about, and counting that as agreement would pad
   every at-market setup's indicator tally with a free vote.

   Run: node tests/test-omnigold-fill-risk.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

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
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','structure-levels.js','best-levels.js',
                   'gold-best-levels.js','regime.js','goldind.js','pinegoldmath.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
ok(typeof W.hgOgGates === 'function', 'hgOgGates is exported');

const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c) => ({ t: T0 + i * 3600, o, h, l, c, v: 1000 });
const rows = [];
{ let p = 2000; for (let i = 0; i < 120; i++){ p += 1.1; rows.push(B(i, p, p + 2, p - 2, p)); } }
const px = rows[rows.length - 1].c;

const gate = (plan, livePx, dir) => (W.hgOgGates(rows,
  { kind: 'ORB', dir: dir || 'long', level: px, why: 't' },
  { nowSec: rows[rows.length - 1].t, livePx: livePx, plan: plan }) || [])
  .filter(g => g && g.key === 'fill-risk')[0];

console.log('\n== declaration ==');
{
  const g = gate({ entry: px, stop: px - 10, t1: px + 20 }, px);
  ok(!!g, 'the fill-risk gate is on the ledger');
  ok(g.hard === false && g.info === true, 'it is soft and info — it argues, it never vetoes');
}

console.log('\n== at or through market: ABSTAIN, not a free vote ==');
{
  const at = gate({ entry: px, stop: px - 10 }, px);
  ok(at.pass === null || at.pass === undefined, 'entry at market abstains');
  ok(/fills immediately/.test(at.why), 'and says why (' + at.why + ')');
  const through = gate({ entry: px + 2, stop: px - 8 }, px, 'long');
  ok(through.pass === null || through.pass === undefined,
     'a long limit ABOVE market (fills on touch, price is already past it) abstains too');
}

console.log('\n== near limit: pass, with the measured caveat ==');
{
  /* risk 10, entry 2 below market = 0.20R away */
  const g = gate({ entry: px - 2, stop: px - 12 }, px, 'long');
  ok(g.pass === true, 'a limit 0.20R away reads as near');
  ok(/0\.20R/.test(g.why), 'the distance is stated in R (' + g.why + ')');
  ok(/1 in 10/.test(g.why), 'with the measured near-miss rate, not a promise of a fill');
}

console.log('\n== far limit: argues against, scaled to the measurement ==');
{
  /* 0.50R away -> the one-in-five band */
  const mid = gate({ entry: px - 5, stop: px - 15 }, px, 'long');
  ok(mid.pass === false, 'a limit 0.50R away argues against');
  ok(/1 in 5/.test(mid.why), 'quoting the one-in-five band (' + mid.why + ')');
  /* 1.5R away -> the one-in-three band */
  const far = gate({ entry: px - 15, stop: px - 25 }, px, 'long');
  ok(far.pass === false, 'a limit 1.5R away argues against');
  ok(/1 in 3/.test(far.why), 'quoting the one-in-three band (' + far.why + ')');
  ok(/may simply not happen/.test(far.why), 'and says plainly that the trade may not happen');
}

console.log('\n== shorts mirror ==');
{
  const g = gate({ entry: px + 5, stop: px + 15 }, px, 'short');
  ok(g.pass === false, 'a short limit 0.50R ABOVE market is away, and argues against');
  const thr = gate({ entry: px - 3, stop: px + 7 }, px, 'short');
  ok(thr.pass === null || thr.pass === undefined, 'a short limit below market fills on touch — abstains');
}

console.log('\n== degrades honestly ==');
{
  const noPlan = (W.hgOgGates(rows, { kind:'ORB', dir:'long', level: px, why:'t' },
    { nowSec: rows[rows.length-1].t, livePx: px }) || []).filter(g => g.key === 'fill-risk')[0];
  ok(noPlan && (noPlan.pass === null || noPlan.pass === undefined), 'no plan supplied — unchecked, never a guess');
  const declined = gate(null, px);
  ok(declined && (declined.pass === null || declined.pass === undefined), 'a declined plan has nothing to fill');
  ok(/nothing to fill/.test(declined.why), 'and says so');
  const noPx = (W.hgOgGates(rows, { kind:'ORB', dir:'long', level: px, why:'t' },
    { nowSec: rows[rows.length-1].t, plan: { entry: px - 2, stop: px - 12 } }) || []).filter(g => g.key === 'fill-risk')[0];
  ok(noPx && (noPx.pass === null || noPx.pass === undefined), 'no live price — unchecked rather than fabricated');
}

console.log('\nomnigold fill-risk: ' + passed + ' checks passed');
