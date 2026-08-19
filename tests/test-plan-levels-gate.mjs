/* HARDGATE — a TICKET with nothing to place.

   Reported from a live scan: "the ticket setup doesn't show entry, tp and sl".
   The desk's single ticket read:

     GOLD · SCALP · AVWAP-RECLAIM LONG   TICKET 29/32 checks
     reclaimed the VWAP anchored to the swing low at 4378.03
     no plan — structure could not clear the R floor, so no levels are shown.
     ...
     UNCHECKED cost-drag    no plan risk to cost
     UNCHECKED stop-width   no plan yet — stop width cannot be judged

   The plan engine returned null, the card said so plainly in its own subtitle,
   and the ledger graded it TICKET anyway. Thirty-two gates and not one asked
   whether there was a trade to take. Two of them NOTICED — cost-drag and
   stop-width both reported that no plan existed — and both are soft, so their
   UNCHECKED could not block anything.

   A ticket is this desk saying "this cleared, act on it". With no entry, no
   stop and no target there is nothing to act on. It is the worst output the
   ledger can produce: every other veto tells you why to stand aside, and this
   one invited you in with no levels to place.

   THREE STATES, deliberately distinguished:

     plan present and complete  -> PASS
     plan explicitly null       -> VETO. The engine ran and produced nothing;
                                   that is a decision, not a gap.
     no plan key at all         -> UNCHECKED and soft. The caller never offered
                                   one, so the gate has nothing to judge and
                                   must not invent a veto — which also keeps
                                   every harness that grades without a plan
                                   working.

   Run: node tests/test-plan-levels-gate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');
const ROUTE = read('omniroute.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

function tape(n, seed){
  const out = []; let p = 4350, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p*(1+(rnd()-0.48)*0.003);
    const r = p*0.0014*(0.5+rnd());
    out.push({ t: 1700000000+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v:1000 });
  }
  return out;
}
const ROWS = tape(400, 7);
const HIT = { dir:'long', kind:'ORB', mech:'ORB' };
const gate = (ex) => W.hgOgGates(ROWS, HIT, ex).filter(g => g && g.key === 'plan-levels')[0];
const GOODPLAN = { entry: 4350, stop: 4330, t1: 4390, t2: 4410, risk: 20 };

console.log('== THE DEFECT: a planless card could be a TICKET ==');
{
  const g = gate({ plan: null });
  ok(!!g, 'the plan-levels gate is on the ledger');
  ok(g.pass === false, 'an explicit null plan is a VETO');
  ok(/NO LEVELS/.test(g.why), 'and says so: ' + g.why);
  ok(/nothing to place/.test(g.why), 'naming what is missing in words a trader uses');
  /* The behavioural claim: it must actually stop the ticket. */
  const graded = W.hgOmniGrade(W.hgOgGates(ROWS, HIT, { plan: null }));
  ok(graded.ticket === false, 'a card with no plan can no longer grade to TICKET');
  ok(graded.vetoes.indexOf('plan-levels') >= 0, 'plan-levels is named in the vetoes');
  ok(/VETO — plan-levels/.test(graded.verdict), 'and leads the verdict: ' + graded.verdict.slice(0, 40));
}

console.log('\n== a complete plan passes and blocks nothing ==');
{
  const g = gate({ plan: GOODPLAN });
  ok(g.pass === true, 'entry, stop and target present is a PASS');
  ok(/entry, stop and target all present/.test(g.why), 'with a plain reason');
  const graded = W.hgOmniGrade(W.hgOgGates(ROWS, HIT, { plan: GOODPLAN }));
  ok(graded.vetoes.indexOf('plan-levels') < 0, 'and it never appears among the vetoes');
}

console.log('\n== an INCOMPLETE plan is caught too, and named precisely ==');
{
  const cases = [
    [{ stop: 4330, t1: 4390 }, 'no entry'],
    [{ entry: 4350, t1: 4390 }, 'no stop'],
    [{ entry: 4350, stop: 4330 }, 'no target'],
    [{ entry: 4350, stop: 4350, t1: 4390 }, 'entry equals stop'],
    [{ entry: NaN, stop: 4330, t1: 4390 }, 'no entry'],
    [{ entry: 4350, stop: null, t1: 4390 }, 'no stop']
  ];
  for (const [plan, expect] of cases){
    const g = gate({ plan: plan });
    ok(g.pass === false, JSON.stringify(plan).slice(0, 40) + ' is a veto');
    ok(new RegExp(expect).test(g.why), '   naming it exactly: ' + expect);
    ok(/INCOMPLETE LEVELS/.test(g.why), '   and marking it incomplete rather than absent');
  }
  /* null stop must not read as price zero — the isFinite(null) trap. */
  ok(/no stop/.test(gate({ plan: { entry: 4350, stop: null, t1: 4390 } }).why),
     'a null stop is missing, not a stop at zero');
}

console.log('\n== no plan KEY at all is UNCHECKED and soft ==');
{
  /* The distinction that keeps every existing harness working: a caller that
     never offered a plan is not the same as an engine that produced none. */
  const g = gate({});
  ok(g.pass === null, 'an absent plan key reads UNCHECKED');
  ok(/not judged here/.test(g.why), 'and says the gate had nothing to judge');
  ok(g.hard !== true, 'the gate is soft, so UNCHECKED blocks nothing');
  const graded = W.hgOmniGrade(W.hgOgGates(ROWS, HIT, {}));
  ok(graded.unknown.indexOf('plan-levels') < 0, 'it is not counted as a hard unknown');
  ok(graded.degraded.indexOf('plan-levels') >= 0, 'it is counted as degraded, which is honest');
  ok(typeof graded.ticket === 'boolean', 'and the ledger still grades normally');
}

console.log('\n== both desks got it ==');
{
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(src.indexOf("key:'plan-levels'") > 0, n + ' pushes a plan-levels gate');
    ok(/a TICKET with nothing to place is not a ticket/.test(src), n + ' records why');
    ok(/hasOwnProperty\.call\(x, 'plan'\)/.test(src),
       n + ' distinguishes an absent key from a null plan');
    ok(/key:'plan-levels', hard:false/.test(src), n + ' keeps it soft, so only a real null vetoes');
  }
  /* Both desks build the plan BEFORE the gates, so x.plan is always supplied
     on the live path — which is what makes the null case reachable. */
  ok(/ex\.plan = plan;/.test(GOLD), 'omnigold supplies the plan to the ledger');
  ok(/exForHit\.plan = plan;/.test(ROUTE), 'omniroute supplies it too');
}

console.log('\n== the gates that NOTICED are still soft, and that is why this was needed ==');
{
  /* cost-drag and stop-width both reported the missing plan on the live card
     and neither could act. They must stay soft — this gate is what acts. */
  const gs = W.hgOgGates(ROWS, HIT, { plan: null });
  const byKey = k => gs.filter(g => g && g.key === k)[0];
  for (const k of ['cost-drag', 'stop-width']){
    const g = byKey(k);
    ok(!!g, k + ' is still on the ledger');
    ok(g.pass === null, k + ' still reads UNCHECKED with no plan');
    ok(g.hard !== true, k + ' is still soft — it reports, it does not block');
  }
  ok(byKey('plan-levels').pass === false, 'and plan-levels is the one that blocks');
}

console.log('\n== degenerate input never throws ==');
{
  for (const ex of [{ plan: 0 }, { plan: '' }, { plan: false }, { plan: [] }, { plan: 'x' }]){
    let threw = null, g = null;
    try { g = gate(ex); } catch (e){ threw = e; }
    ok(!threw, 'plan=' + JSON.stringify(ex.plan) + ' does not throw');
    ok(g && g.pass === false, '   and is treated as no levels');
    ok(g && !/undefined|NaN/.test(String(g.why)), '   with no undefined or NaN in the reason');
  }
  let threw = null;
  try { W.hgOgGates(ROWS, HIT, null); } catch (e){ threw = e; }
  ok(!threw, 'a null extras object does not throw');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PLAN-LEVELS GATE TESTS PASSED');
