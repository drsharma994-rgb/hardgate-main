/* HARDGATE — plan enrichers must not ship new levels with old ratios.

   Found by sweeping for the SHAPE rather than by reading: every object in the
   app whose .entry/.stop is assigned at one brace depth while its .rr* is
   assigned deeper is a candidate for the defect fixed four times already —
   levels replaced outside a guard, ratios replaced inside one. The sweep
   returned three sites. formation.js was already fixed; the other two are
   these, both in plans.js and both exported:

   hgEnrichGenericExact builds `out` by spreading `plan`, so it arrives with
   the caller's t1/t2/rr1/rr2 measured against the OLD entry and stop. It then
   sets the new entry and stop unconditionally but refreshes the legs only
   `if (pr)`. Worse, the swing-targets block replaces t2 while refreshing only
   rr1 — leaving rr2 pointing at the target it just discarded, every time that
   block runs.

   hgEnrichSmartPlan has the same shape — entry moved to the EMA21 outside the
   guard, stop and every target inside `if (st)` — and it mutates the CALLER's
   object rather than a copy. Scope stated honestly: I could NOT construct data
   that reaches that path, because hgStructureStop returned a stop for every
   series tried. That fix is hardening; the hgEnrichGenericExact one above is a
   demonstrated fault.

   Run: node tests/test-plan-enrich-rr.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

function load(plansSrc, tag){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(plansSrc, ctx, { filename: tag });
  return ctx;
}

const PLANS = fs.readFileSync(path.join(ROOT, 'plans.js'), 'utf8');
const W = load(PLANS, 'plans.js');

/* The pre-fix build, reconstructed from shipped source by removing the two
   unconditional derivations. If these markers ever move the test says so
   rather than silently comparing a build to itself. */
function preFixSource(){
  let s = PLANS;
  const a = s.indexOf('    hgSyncPlanRatios(out);\n    return out;');
  const b = s.indexOf('    hgSyncPlanRatios(plan);\n    return plan;');
  if (a < 0 || b < 0) return null;
  s = s.replace('    hgSyncPlanRatios(out);\n    return out;', '    return out;');
  s = s.replace('    hgSyncPlanRatios(plan);\n    return plan;', '    return plan;');
  return s;
}

function rows(n, start, step){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step + Math.sin(i / 8) * step * 3;
    out.push({ t: 1700000000 + i * 14400, o: c, h: c + step * 3, l: c - step * 3, c: c, v: 800 + i });
  }
  return out;
}

function invariant(p, label){
  const entry = p.entry, stop = p.stop;
  const risk = (typeof entry === 'number' && typeof stop === 'number') ? Math.abs(entry - stop) : NaN;
  for (const [tk, rk] of [['t1', 'rr1'], ['t2', 'rr2']]){
    const t = p[tk], r = p[rk];
    if (r === null || r === undefined) continue;
    ok(isFinite(risk) && risk > 0, label + ': ' + rk + ' only with a real risk distance');
    ok(typeof t === 'number' && isFinite(t), label + ': ' + rk + ' only with a real ' + tk);
    ok(near(r, Math.abs(t - entry) / risk), label + ': ' + rk + ' equals |' + tk + ' - entry| / risk');
  }
}

console.log('== the enrichers and the new helper are exported ==');
{
  ok(typeof W.hgEnrichGenericExact === 'function', 'hgEnrichGenericExact exported');
  ok(typeof W.hgEnrichSmartPlan === 'function', 'hgEnrichSmartPlan exported');
  ok(typeof W.hgSyncPlanRatios === 'function', 'hgSyncPlanRatios exported');
}

console.log('\n== hgSyncPlanRatios derives and clears, never inherits ==');
{
  const p = { entry: 100, stop: 98, t1: 104, t2: 107, rr1: 99, rr2: 99, riskPct: 99 };
  W.hgSyncPlanRatios(p);
  ok(near(p.rr1, 2) && near(p.rr2, 3.5), 'both legs derived from the levels');
  ok(near(p.riskPct, 2), 'riskPct derived from the same risk');

  const degenerate = { entry: 100, stop: 100, t1: 104, rr1: 9, rr2: 9, riskPct: 9 };
  W.hgSyncPlanRatios(degenerate);
  ok(degenerate.rr1 === null && degenerate.rr2 === null && degenerate.riskPct === null,
    'zero risk clears all three rather than leaving 9R standing');

  const noT2 = { entry: 100, stop: 98, t1: 104, t2: null, rr2: 9 };
  W.hgSyncPlanRatios(noT2);
  ok(near(noT2.rr1, 2) && noT2.rr2 === null, 'an absent T2 clears only its own leg');

  const nullStop = { entry: 100, stop: null, t1: 104, rr1: 9 };
  W.hgSyncPlanRatios(nullStop);
  ok(nullStop.rr1 === null, 'a null stop is not price zero');
}

console.log('\n== REPRODUCTION: hgEnrichGenericExact left rr2 on a discarded target ==');
{
  const src = preFixSource();
  ok(src !== null, 'the pre-fix build could be reconstructed from shipped source');
  const OLD = load(src, 'plans.prefix.js');

  const r = rows(220, 100, 0.4);
  const mark = r[r.length - 1].c;
  const plan = () => ({
    dir: 'long', type: 'SWING', entry: mark, stop: mark - 2,
    t1: mark + 20, t2: mark + 40, rr1: 10, rr2: 20, riskPct: 9,
    mark: mark, poi: 'ema', zone: null
  });

  const before = OLD.hgEnrichGenericExact(plan(), r, { style: 'swing' });
  const after = W.hgEnrichGenericExact(plan(), r, { style: 'swing' });
  ok(before && after, 'both builds returned a plan');

  const risk = Math.abs(after.entry - after.stop);
  if (risk > 0 && typeof after.t2 === 'number'){
    const trueRr2 = Math.abs(after.t2 - after.entry) / risk;
    ok(after.rr2 === null || near(after.rr2, trueRr2), 'post-fix: rr2 matches its own T2 (or is cleared)');
    if (typeof before.rr2 === 'number' && typeof before.t2 === 'number'){
      const bRisk = Math.abs(before.entry - before.stop);
      if (bRisk > 0 && !near(before.rr2, Math.abs(before.t2 - before.entry) / bRisk)){
        ok(true, 'pre-fix: shipped rr2 ' + before.rr2 + ' did not match its own T2 ('
          + (Math.abs(before.t2 - before.entry) / bRisk).toFixed(2) + ')');
      }
    }
  }
  invariant(after, 'hgEnrichGenericExact');
  ok(after.rr1 !== 10 && after.rr2 !== 20, 'no incoming 10R/20R survived enrichment');
}

console.log('\n== REPRODUCTION: hgEnrichSmartPlan moved the entry and kept the ratios ==');
{
  const src = preFixSource();
  const OLD = load(src, 'plans.prefix2.js');
  const r = rows(240, 100, 0.4);
  const mark = r[r.length - 1].c;
  /* hgEnrichSmartPlan returns untouched unless type === 'SWING' — my first
     version of this test omitted it and the enricher never ran. */
  const plan = () => ({
    dir: 'long', type: 'SWING', entry: mark, stop: mark - 2, t1: mark + 20, t2: mark + 40,
    rr1: 10, rr2: 20, riskPct: 9
  });

  const before = OLD.hgEnrichSmartPlan(plan(), r);
  const after = W.hgEnrichSmartPlan(plan(), r);
  ok(before && after, 'both builds returned a plan');
  ok(after.entry !== mark, 'the enricher really did move the entry to the EMA21 ('
    + after.entry.toFixed(2) + ' vs mark ' + mark.toFixed(2) + ')');

  /* Honest scope. This site has the same shape as the one above — entry moved
     outside the guard, stop and every leg inside `if (st)` — but I could not
     construct data that reaches it: hgStructureStop returned a stop for every
     series tried, including flat plateaus of 5 to 31 bars after a trend. So
     this is HARDENING against a path that exists in the code but that I have
     not shown to fire, not a demonstrated fault. The pre-fix build is kept in
     the comparison so that if hgStructureStop ever starts returning null the
     difference shows up here rather than on a card. */
  const bRisk = Math.abs(before.entry - before.stop);
  const bTrue = bRisk > 0 ? Math.abs(before.t1 - before.entry) / bRisk : NaN;
  ok(near(before.rr1, bTrue) || before.rr1 === 10,
    'pre-fix build is either already consistent (structure stop found) or carries the stale 10R');
  invariant(after, 'hgEnrichSmartPlan');
  ok(after.rr1 !== 10 && after.rr2 !== 20, 'no incoming 10R/20R survived enrichment');
}

console.log('\n== the caller\'s object is left consistent, not half-updated ==');
{
  /* hgEnrichSmartPlan mutates in place by design; the point is that what the
     caller is left holding satisfies the invariant. */
  const r = rows(240, 100, 0.4);
  const mark = r[r.length - 1].c;
  const mine = { dir: 'long', type: 'SWING', entry: mark, stop: mark - 2, t1: mark + 20, t2: mark + 40, rr1: 10, rr2: 20 };
  W.hgEnrichSmartPlan(mine, r);
  invariant(mine, 'caller object');
  ok(mine.rr1 !== 10, 'the caller\'s own object no longer holds the pre-enrichment ratio');
}

console.log('\n== every site the sweep found is followed by a derivation ==');
{
  ok(/hgSyncPlanRatios\(out\);\s*\n\s*return out;/.test(PLANS), 'hgEnrichGenericExact derives before returning');
  ok(/hgSyncPlanRatios\(plan\);\s*\n\s*return plan;/.test(PLANS), 'hgEnrichSmartPlan derives before returning');
  const form = fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8');
  ok(/plan\.rr1 = plan\.rr;/.test(form), 'formation.js gold branch derives');
  ok(/var fRisk = /.test(form), 'formation.js crypto branch derives');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PLAN-ENRICH R:R TESTS PASSED');
