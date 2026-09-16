/* HARDGATE — a plan can be a flawless 2.0R and still be behind price.

   hgPlanLevels sizes entry, stop and T1 against each OTHER. None of that
   arithmetic knows where price is now, which is how this reached the desk:

     XAUUSD SHORT SWING   mark 4282.70  entry 4316.20  stop 4326.05  T1 4296.51

   risk = 4326.05 - 4316.20 = 9.85, and 4316.20 - 2(9.85) = 4296.50, so T1 is
   a true 2.0R. But it sits BETWEEN the mark and the entry: price climbing to
   fill the short crosses TP1 on the way up. The target is behind price.

   omnigold named that geometry in its own renderer (hgOgEntryMarketNote), so
   goldswing, goldscalp, goldultra, goldpro, newgold, golddirection,
   super-gold and omnigold1 all sized plans blind to it. hgPlanMarketGeometry
   puts the rule in the shared layer those desks already call.

   Run: node tests/test-plan-market-geometry.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const ctx = { console, Math, isFinite, isNaN, parseFloat, Number, String, Object, Array, JSON };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'plans.js', 'hg-plan.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const geo = ctx.hgPlanMarketGeometry;

console.log('== the plan that was reported ==');
{
  const plan = { dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 };
  const risk = plan.stop - plan.entry;
  ok(Math.abs((plan.entry - plan.t1) / risk - 2) < 0.01, 'it really is 2.0R — the sizing was never wrong');

  const g = geo(plan, 4282.70);
  ok(g && g.code === 'target-crossed', 'and the shared layer calls it target-crossed');
  ok(g.ok === false, 'so it is not ok');
  ok(/between the market and the entry/.test(g.why), 'and says why in words a reader can act on');
}

console.log('\n== the same geometry, long side ==');
{
  /* mirror: price already ABOVE a long target that sits above the entry */
  const g = geo({ dir: 'long', entry: 4280.00, stop: 4270.00, t1: 4300.00 }, 4310.00);
  ok(g && g.code === 'target-crossed', 'a long whose T1 is behind price is caught too');
  const fine = geo({ dir: 'long', entry: 4280.00, stop: 4270.00, t1: 4300.00 }, 4275.00);
  ok(fine && fine.code === 'ok', 'and the same plan is fine while price is still below T1');
}

console.log('\n== a breached stop outranks everything ==');
{
  /* short whose stop is already below the mark: the trade lost before it filled */
  const g = geo({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 }, 4330.00);
  ok(g && g.code === 'stop-breached', 'price through the short stop is stop-breached');
  ok(/already through the stop/.test(g.why), 'and says so plainly');

  const gl = geo({ dir: 'long', entry: 4280.00, stop: 4270.00, t1: 4300.00 }, 4265.00);
  ok(gl && gl.code === 'stop-breached', 'the long mirror is caught as well');
}

console.log('\n== plans that are genuinely still ahead of price ==');
{
  /* a short retest whose target is BELOW the mark — the normal, good case */
  ok(geo({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4280.00 }, 4300.00).code === 'ok',
     'a short whose target is below the mark is ok');
  /* at-market entry: no retest, so the crossing rule does not apply */
  ok(geo({ dir: 'short', entry: 4300.00, stop: 4310.00, t1: 4290.00 }, 4300.00).code === 'ok',
     'an at-market short is ok');
  /* entry already passed in the trade direction — not this rule to judge */
  ok(geo({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 }, 4320.00).code === 'ok',
     'a short whose mark is above the entry but below the stop is ok');
}

console.log('\n== an unjudgeable plan is never "ok" ==');
{
  ok(geo(null, 4282.70) === null, 'no plan is null');
  ok(geo({ dir: 'short', entry: 4316.20 }, NaN) === null, 'no mark is null');
  ok(geo({ dir: 'short', entry: 4316.20 }, 0) === null, 'a zero mark is null, not ok');
  ok(geo({ dir: '', entry: 4316.20 }, 4282.70) === null, 'no direction is null');
  ok(geo({ dir: 'short', entry: NaN }, 4282.70) === null, 'no entry is null');
  /* a plan with no stop and no t1 cannot be faulted, but is still judged */
  const bare = geo({ dir: 'short', entry: 4316.20 }, 4282.70);
  ok(bare && bare.code === 'ok', 'a bare entry-only plan judges as ok, not null');
}

console.log('\n== it is pure — no DOM, no globals, never throws ==');
{
  ok(geo({ dir: 'short', entry: 'x', stop: {}, t1: [] }, 'y') === null, 'garbage in returns null');
  const p = { dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 };
  const before = JSON.stringify(p);
  geo(p, 4282.70);
  ok(JSON.stringify(p) === before, 'and the plan it was handed is left untouched');
}

console.log('\nplan market geometry: ' + passed + ' checks passed');
