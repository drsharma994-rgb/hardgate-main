/* HARDGATE — hgOmniDerivePlan must never let the wrapper's R:R through.

   This function exists because live OMNIROUTE cards showed R:R 14.72 / 11.35
   / 9.57 whose true value was 2.00 in every case — the plan wrapper's `risk`
   field is stale with respect to the entry it reports. The fix derived R:R
   from entry and stop instead. It closed the common path and left the
   degenerate one open:

       for (k in plan) out[k] = plan[k];        // copies stale rr1/rr2/risk
       var risk = Math.abs(entry - stop);
       if (isFinite(risk) && risk > 0){
         if (isFinite(t1)) out.rr1 = ...        // only overwritten HERE
       }
       return out;                               // else the stale copy survives

   So whenever the geometry was degenerate — entry equal to stop, or a target
   the plan did not supply — the wrapper's original overstated R:R passed
   straight through, while the comment above it claimed the values were
   "recomputed unconditionally". They are now.

   OMNIGOLD calls the same function through window, so both desks are covered.

   Run: node tests/test-omni-rr-derive.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const ctx = {
  console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
  Number, String, Promise, RegExp, setTimeout, clearTimeout
};
ctx.window = ctx; ctx.globalThis = ctx;
ctx.document = { createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }), head: { appendChild(){} }, documentElement: {} };
ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
ctx.HG_tabs = [];
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8'), ctx, { filename: 'omniroute.js' });

const derive = ctx.hgOmniDerivePlan;

console.log('== the function is exported for OMNIGOLD to share ==');
ok(typeof derive === 'function', 'hgOmniDerivePlan on window (OMNIGOLD reads it from there)');

console.log('\n== a normal plan derives from the levels the card prints ==');
{
  const out = derive({ dir: 'long', entry: 100, stop: 98, t1: 104, t2: 107, rr1: 14.72, rr2: 11.35, risk: 0.27 });
  ok(near(out.rr1, 2), 'rr1 is 2.00, not the wrapper 14.72');
  ok(near(out.rr2, 3.5), 'rr2 derived from t2');
  ok(near(out.risk, 2), 'risk is |entry - stop|, not the wrapper 0.27');
  ok(near(out.riskPct, 2), 'riskPct derived from the same risk');
  ok(out.entry === 100 && out.stop === 98, 'the levels themselves are untouched');
}

console.log('\n== THE HOLE: a degenerate plan must not leak the wrapper R:R ==');
{
  /* entry === stop, so risk is 0 and the old guard skipped every assignment. */
  const out = derive({ dir: 'long', entry: 100, stop: 100, t1: 104, rr1: 14.72, rr2: 11.35, risk: 0.27, riskPct: 0.27 });
  ok(out.rr1 === null, 'rr1 is cleared, not left at the wrapper 14.72');
  ok(out.rr2 === null, 'rr2 is cleared');
  ok(out.risk === null, 'risk is cleared, not left at 0.27');
  ok(out.riskPct === null, 'riskPct is cleared');
}

console.log('\n== a target the plan did not supply clears only its own leg ==');
{
  const out = derive({ dir: 'long', entry: 100, stop: 98, t1: 104, t2: null, rr1: 9.57, rr2: 9.57 });
  ok(near(out.rr1, 2), 'rr1 still derived');
  ok(out.rr2 === null, 'rr2 cleared rather than kept at 9.57');
}

console.log('\n== a null level is not price zero ==');
{
  /* num(null) is 0, so a null stop used to give risk = |100 - 0| = 100 and a
     confident, entirely invented R:R. */
  const out = derive({ dir: 'long', entry: 100, stop: null, t1: 104, rr1: 5 });
  ok(out.rr1 === null, 'a null stop clears rr1 instead of pricing it at zero');
  ok(out.risk === null, 'and clears risk rather than reporting 100');
  const out2 = derive({ dir: 'long', entry: null, stop: 98, t1: 104, rr1: 5 });
  ok(out2.rr1 === null && out2.risk === null, 'a null entry does the same');
}

console.log('\n== the input is never mutated ==');
{
  const src = { dir: 'long', entry: 100, stop: 100, t1: 104, rr1: 14.72, risk: 0.27 };
  derive(src);
  ok(src.rr1 === 14.72 && src.risk === 0.27, 'the caller\'s plan object is left alone');
}

console.log('\n== a cleared R:R never renders as a confident 0.00 ==');
{
  /* isFinite(null) is true and (+null).toFixed(2) is "0.00" — the formatter
     would have printed a measured-looking zero for every value this fix
     clears. */
  const src = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  ok(/function fmt\(n, d\)\{ var v = fin\(n\)/.test(src), 'omniroute fmt converts through fin first');
  const gold = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/function fmt\(n, d\)\{ var v = fin\(n\)/.test(gold), 'omnigold fmt converts through fin first');
  ok(/function fmtPx\(n\)\{ var v = fin\(n\)/.test(gold), 'omnigold fmtPx too — a null price is not $0.00');
  ok(!/isFinite\(num\(plan\.rr1\)\)/.test(gold), 'omnigold reads plan R:R with the strict helper');
  ok(!/isFinite\(num\(plan\.risk\)\)/.test(gold), 'omnigold reads plan risk with the strict helper');
}

console.log('\n== ranking sinks an unknown R:R below every known one ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  ok(/var ar = isFinite\(fin\(a\.rr\)\)/.test(src), 'the sort converts through fin before testing');

  /* A null rr must sort BELOW a real 1R, not tie with a real 0R. */
  const rank = ctx.hgOmniRank;
  if (typeof rank === 'function'){
    const mk = (base, rr) => ({ base, rr, grade: { ticket: true, evaluated: 5 } });
    const out = rank([mk('AAA', null), mk('BBB', 1)]);
    ok(out[0].base === 'BBB', 'the setup with a real 1R ranks above the one with no R:R');
  } else {
    ok(false, 'hgOmniRank should be reachable for this check');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNI R:R DERIVATION TESTS PASSED');
