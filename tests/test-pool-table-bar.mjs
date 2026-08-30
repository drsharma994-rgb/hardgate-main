/* HARDGATE — the summary table and the ledger judged the same number against
   two different bars, and the table used the looser one.

   The pooled table printed "has paid" in green at +2.00 sigma. The
   measured-edge gate credits a mechanic only at the FAMILY-WISE bar — +2.96
   sigma across 33 crypto mechanics (27 before the conviction roster landed
   six more), +2.97 across 34 gold ones — and says so on every card:

     "34 mechanics scanned, so +2.97σ is the bar before one this good means
      anything"

   So a mechanic sitting between +2.00 and +2.97 was reported as PAID in the
   summary the reader looks at first, while the ledger refused to credit it.
   That is exactly the contradiction fixed in v377 for the negative direction
   — the table read "has not paid" while the gate printed PASS — and this is
   its mirror image, left behind at the time.

   The "needs ~N" column was the worse half, because it is advice. It solved
   n = z^2 * p(1-p) / edge^2 for z = 2. Aiming at 2.00 instead of 2.97
   understates the required sample by 2.2x, so a live gold row read

     AVWAP-RECLAIM  29 samples (needs ~42)  55% T1-first  +1.67σ

   when this desk will not credit it before ~94. The column was coaching the
   reader toward a bar the desk does not accept — the precise
   multiple-comparisons error the whole design exists to prevent, printed in
   its own summary.

   Both now take the bar the gate uses, and a desk that supplies none gets the
   family-wise bar rather than the lone 5% threshold.

   Run: node tests/test-pool-table-bar.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
                   head:{appendChild(){}}, body:{appendChild(){}},
                   documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js',
                   'hg-forward.js','plans.js', 'hg-gates.js', 'hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
const GOLD = read('omnigold.js');
const ROUTE = read('omniroute.js');

/* The Sidak bar, recomputed here independently of the app so the test does
   not simply agree with whatever the app happens to do. */
const erf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
  const t = 1/(1+p*x);
  return s * (1 - ((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)); };
const norm = z => 0.5*(1+erf(z/Math.SQRT2));
function famZ(m){ let lo=0, hi=6; const target = Math.pow(0.95, 1/m);
  for (let i=0;i<200;i++){ const mid=(lo+hi)/2; (norm(mid) < target) ? lo=mid : hi=mid; }
  return (lo+hi)/2; }

console.log('== the app agrees with an independent Sidak computation ==');
{
  for (const m of [6, 22, 27, 34]){
    ok(Math.abs(W.hgOmniFamilyZ(m) - famZ(m)) < 0.02,
       m + ' mechanics -> +' + W.hgOmniFamilyZ(m).toFixed(2) + 'σ (independent: +' + famZ(m).toFixed(2) + 'σ)');
  }
  ok(famZ(34) > 2.9 && famZ(34) < 3.05, 'the gold bar is near +2.97σ, well above the +2.00σ the table used');
}

console.log('\n== THE DEFECT: "has paid" fired below the bar the gate requires ==');
{
  const bar = W.hgOmniFamilyZ(34);
  /* Construct a pool landing between +2.00 and the family-wise bar: the exact
     window where the table and the card used to disagree. */
  const pBreak = 1 / (1 + 1.5);                 /* gold scalp, 1.5R -> 40% */
  const nFor = z => Math.ceil(z*z*pBreak*(1-pBreak)/(0.12*0.12));
  const n = Math.round((nFor(2) + nFor(bar)) / 2);
  const pool = { samples: n, hit: pBreak + 0.12, expR: 0 };
  const v = W.hgOmniPoolRead(pool, 1.5, 20, bar);
  ok(v.z > 2, 'this pool reads +' + v.z.toFixed(2) + 'σ — above the old +2.00σ threshold');
  ok(v.z < bar, 'and below the +' + bar.toFixed(2) + 'σ the ledger requires');
  ok(v.read !== 'has paid', 'the table no longer calls it PAID (' + v.read + ')');
  ok(v.read === 'within noise', 'it reads "within noise", which is what it is');
  ok(v.cls !== 'ok', 'and is not rendered in the green class');
  /* Prove the OLD behaviour would have disagreed with the card. */
  const old = W.hgOmniPoolRead(pool, 1.5, 20, 2);
  ok(old.read === 'has paid', 'at the old +2.00σ bar the same pool read "has paid" — the contradiction');
}

console.log('\n== a genuine edge is still credited ==');
{
  const bar = W.hgOmniFamilyZ(34);
  const v = W.hgOmniPoolRead({ samples: 4000, hit: 0.50, expR: 0.25 }, 1.5, 20, bar);
  ok(v.z >= bar, 'a large, real edge clears the bar (+' + v.z.toFixed(2) + 'σ)');
  ok(v.read === 'has paid', 'and the table says so');
  ok(v.cls === 'ok', 'in green');
  ok(v.need === null, 'with no sample target, because it is already there');
}

console.log('\n== a losing mechanic is unaffected ==');
{
  const bar = W.hgOmniFamilyZ(34);
  const v = W.hgOmniPoolRead({ samples: 300, hit: 0.25, expR: -0.45 }, 1.5, 20, bar);
  ok(v.read === 'has not paid', 'the negative side still reads "has not paid"');
  ok(v.cls === 'bad', 'in the bad class');
  ok(v.need === null, 'and is given no sample target');
  const thin = W.hgOmniPoolRead({ samples: 8, hit: 0.9, expR: 1.2 }, 1.5, 20, bar);
  ok(thin.read === 'too few to judge', 'and a thin pool is still too few to judge, however good it looks');
}

console.log('\n== "needs ~N" now solves for the bar the desk actually uses ==');
{
  const bar = W.hgOmniFamilyZ(34);
  /* The live gold row: AVWAP-RECLAIM, 29 samples, 55% T1-first at 1.5R. */
  const pool = { samples: 29, hit: 0.55, expR: 0.66 };
  const v = W.hgOmniPoolRead(pool, 1.5, 20, bar);
  const pBreak = 1/(1+1.5), edge = 0.55 - pBreak;
  const nAt = z => Math.ceil(z*z*pBreak*(1-pBreak)/(edge*edge));
  ok(Math.abs(v.z - 1.67) < 0.1, 'it reads +' + v.z.toFixed(2) + 'σ, matching the live card');
  ok(v.need === nAt(bar), 'needs ~' + v.need + ' samples — solved for the family-wise bar');
  ok(v.need > nAt(2), 'which is more than the ~' + nAt(2) + ' the old column printed');
  ok(v.need / nAt(2) > 2, 'by a factor of ' + (v.need / nAt(2)).toFixed(1) + 'x');
  /* This is the number the live table printed. It must be gone. */
  ok(v.need !== 42 && v.need !== 43, 'the ~42 the live table showed is no longer what it says');
}

console.log('\n== a desk that supplies no bar gets the family-wise one, not +2.00σ ==');
{
  /* The dangerous default. Falling back to 2 would keep the defect alive for
     any future caller that forgets the argument. */
  const pool = { samples: 200, hit: 0.42, expR: 0.05 };
  const dflt = W.hgOmniPoolRead(pool, 2, 20);
  const two  = W.hgOmniPoolRead(pool, 2, 20, 2);
  ok(isFinite(dflt.bar), 'the reader reports which bar it used (' + dflt.bar.toFixed(2) + 'σ)');
  ok(dflt.bar > 2.5, 'and with no argument it is the family-wise bar, not +2.00σ');
  ok(Math.abs(dflt.bar - W.hgOmniFamilyZ(33)) < 0.01, 'specifically the crypto mechanic count (33 with the conviction roster)');
  ok(dflt.read !== two.read || dflt.z < 2 || dflt.z >= dflt.bar,
     'so the default is at least as strict as the explicit loose one');
}

console.log('\n== both desks pass their OWN mechanic count ==');
{
  ok(/hgOmniPoolRead\(p, MIN_RR, MIN_SAMPLES, hgOmniFamilyZ\(OMNI_ALL_MECHANICS\.length\)\)/.test(ROUTE),
     'omniroute passes its own mechanic-count bar (33 with the conviction roster)');
  ok(/hgOmniPoolRead\(p, minRr, MIN_SAMPLES, hgOgFamilyZ\(OG_MECHANICS\.length\)\)/.test(GOLD),
     'omnigold passes its 34-mechanic bar — judging a gold row by the crypto count would be wrong');
  ok(!/z >= 2 \? 'has paid'/.test(ROUTE), 'the hard-coded +2.00σ threshold is gone');
  ok(!/4 \* pBreak \* \(1 - pBreak\)/.test(ROUTE), 'and so is the z=2 sample formula');
  ok(/bar \* bar \* pBreak/.test(ROUTE), 'the sample target squares the actual bar');
  /* Gold and crypto counts genuinely differ, so this is not cosmetic. The
     crypto roster grew from 27 to 33 when the conviction roster landed, so
     the two bars are numerically close now — the point is that each desk
     derives its bar from its OWN count, not that the numbers are far apart. */
  ok(W.hgOmniFamilyZ(34) > W.hgOmniFamilyZ(33) && W.hgOmniFamilyZ(33) > W.hgOmniFamilyZ(27),
     'the bar is strictly monotone in the mechanic count (+' + W.hgOmniFamilyZ(34).toFixed(2)
     + 'σ at 34, +' + W.hgOmniFamilyZ(33).toFixed(2) + 'σ at 33, +'
     + W.hgOmniFamilyZ(27).toFixed(2) + 'σ at 27)');
}

console.log('\n== the table says which bar it is quoting ==');
{
  ok(/significance bar/.test(GOLD), 'the gold caption names the significance bar');
  ok(/not a lone 5% threshold/.test(GOLD), 'and says it is not a lone 5% threshold');
  ok(/same bar the measured-edge gate uses/.test(GOLD), 'tying it to the gate the reader sees on each card');
}

console.log('\n== gold stopped printing a sample size nobody can act on ==');
{
  ok(typeof W.hgOmniNeedText === 'function', 'needText is shared rather than copied');
  ok(/edge too small to confirm/.test(W.hgOmniNeedText(90000)), 'a huge target says so instead of printing a number');
  ok(/needs ~120/.test(W.hgOmniNeedText(120)), 'an actionable target still prints');
  ok(W.hgOmniNeedText(null) === '', 'and no target prints nothing');
  ok(/hgOmniNeedText/.test(GOLD), 'gold uses it — raising the bar made those numbers 2.2x larger');
}

console.log('\n== degenerate input never throws and never invents a verdict ==');
{
  for (const bad of [null, undefined, {}, { samples: 0 }, { samples: 5, hit: NaN }]){
    let threw = null, v = null;
    try { v = W.hgOmniPoolRead(bad, 1.5, 20, 2.97); } catch (e){ threw = e; }
    ok(!threw, 'hgOmniPoolRead(' + JSON.stringify(bad) + ') does not throw');
    ok(v && typeof v.read === 'string', 'and returns a verdict string (' + (v && v.read) + ')');
    ok(v.need === null || isFinite(v.need), 'with a finite or absent sample target');
  }
  for (const badBar of [null, undefined, 0, -1, NaN, 'x']){
    const v = W.hgOmniPoolRead({ samples: 200, hit: 0.45, expR: 0.1 }, 2, 20, badBar);
    ok(isFinite(v.bar) && v.bar > 2, 'a bad bar argument falls back to the family-wise one, never to +2.00σ');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL POOL TABLE BAR TESTS PASSED');
