/* HARDGATE — the ledger could not see the stop it was judging.

   Asked to check the OMNIROUTE setup formation. Tracing it turned up an
   ordering problem: plan was derived AFTER the gates ran, so not one gate
   could say anything about the stop. A live scan printed

     EDEN  ENTRY 0.05747 · STOP 0.04981 · R:R 2.00 · risk 13.33%
     TSMB  ENTRY 423.31  · STOP 426.96  · R:R 2.00 · risk  0.86%

   in identical weight. Both say "2R" and they are not remotely the same
   trade: the first needs a 26.7% move before T1 pays and sizes to a position
   fifteen times smaller at the same account risk.

   Gold has computed the plan before the gates since the cost-drag gate landed,
   for exactly this reason. OMNIROUTE does now too, and both desks carry a
   stop-width read.

   INFO, not a veto, and deliberately. A wide stop on a volatile alt is often
   the correct stop, and the v351 gold work established that truncating one to
   make the number look better does not reduce risk — it relocates it, and
   makes the R ladder a measurement against a stop the idea never needed. This
   states the consequence; it does not overrule the structure.

   Run: node tests/test-stop-width.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

function boot(extra){
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
                   'hg-forward.js', 'hg-gates.js', 'omniroute.js'].concat(extra || [])){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 14400);
const ROWS = (() => {
  const out = []; let p = 60000;
  for (let i = 0; i < 200; i++){ p = p * (1 + Math.sin(i / 9) * 0.004);
    out.push({ t: T0 + i * 14400, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1000 }); }
  return out;
})();
const HIT = { kind: 'ORB', dir: 'long', level: 60000, why: 't' };
const swOf = (plan, minRr) => W.hgOmniGates(ROWS, HIT, null,
  { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: minRr || 2, plan })
  .filter(g => g.key === 'stop-width')[0];

console.log('== the ordering defect ==');
{
  /* The plan must exist before the ledger runs, or no gate can judge it. */
  const evalSrc = ROUTE.slice(ROUTE.indexOf('function hgOmniEvaluate'), ROUTE.indexOf('function hgOmniDerivePlan'));
  const planAt = evalSrc.indexOf('plan = planFn(');
  const gatesAt = evalSrc.indexOf('var gates = hgOmniGates(');
  ok(planAt > 0 && gatesAt > 0, 'both the plan and the gate call were found');
  ok(planAt < gatesAt, 'the plan is derived BEFORE the gates run');
  ok(/exForHit\.plan = plan;/.test(ROUTE), 'and is handed to the ledger');
  /* And it must be the DERIVED plan, or rr1/riskPct would be missing. */
  const deriveAt = evalSrc.indexOf('hgOmniDerivePlan(plan)');
  ok(deriveAt > 0 && deriveAt < gatesAt, 'the derived plan, not the raw wrapper output');
  ok((ROUTE.match(/if \(plan\) plan = hgOmniDerivePlan\(plan\);/g) || []).length === 1,
     'and it is derived exactly once — the old second call is gone');
}

console.log('\n== THE LIVE CARDS: two trades that both said 2R ==');
{
  const eden = swOf({ entry: 0.05747, stop: 0.04981, t1: 0.07279 });
  ok(eden.pass === false, 'EDEN at 13.33% is flagged');
  ok(/13\.33% from entry/.test(eden.why), 'stating the stop width (' + eden.why.slice(0, 46) + ')');
  ok(/26\.7% move/.test(eden.why), 'and the move T1 actually needs — 26.7%, not "2R"');
  ok(/very wide stop/.test(eden.why), 'in plain words');

  const tsmb = swOf({ entry: 423.31, stop: 426.9633, t1: 416.0033 });
  ok(tsmb.pass === true, 'TSMB at 0.86% passes');
  ok(/0\.86% from entry/.test(tsmb.why), 'with its own width stated');
  ok(/1\.7% move/.test(tsmb.why), 'and its own required move — the two now read differently');

  /* The point of the whole gate: same R:R, different trade. */
  ok(eden.why !== tsmb.why, 'two "2R" setups no longer produce the same sentence');
}

console.log('\n== both tails, and the middle ==');
{
  ok(swOf({ entry: 100, stop: 97.8, t1: 104.4 }).pass === true, 'a 2.2% stop is ordinary');
  ok(swOf({ entry: 100, stop: 92, t1: 116 }).pass === false, 'an 8% stop is flagged as wide');
  const tight = swOf({ entry: 100, stop: 99.9, t1: 100.2 });
  ok(tight.pass === false, 'a 0.1% stop is flagged as too tight');
  ok(/noise and spread/.test(tight.why), 'because noise takes it out before the idea fails');
  /* Boundaries state the rule rather than hiding it. */
  ok(swOf({ entry: 100, stop: 92.1, t1: 115.8 }).pass === true, 'just under 8% still passes');
  ok(swOf({ entry: 100, stop: 99.74, t1: 100.52 }).pass === true, 'just over 0.25% still passes');
}

console.log('\n== it uses the plan\'s OWN target, not an assumed multiple ==');
{
  /* A plan whose T1 is not 2R must report ITS move, not 2x the stop. */
  const odd = swOf({ entry: 100, stop: 98, t1: 110 });   /* 5R, not 2R */
  ok(/10\.0% move/.test(odd.why), 'a 5R target reports a 10% move (' + odd.why + ')');
  const noT1 = swOf({ entry: 100, stop: 98 });
  ok(/4\.0% move/.test(noT1.why), 'and with no T1 it falls back to the R floor (' + noT1.why + ')');
}

console.log('\n== degenerate plans never throw and never guess ==');
{
  for (const plan of [null, undefined, {}, { entry: null, stop: null },
                      { entry: 0, stop: 1 }, { entry: 100, stop: 100 },
                      { entry: 'x', stop: 'y' }, { entry: 100, stop: null, t1: 110 }]){
    let threw = null, g = null;
    try { g = swOf(plan); } catch (e) { threw = e; }
    ok(!threw, 'plan ' + JSON.stringify(plan) + ' does not throw');
    ok(g && typeof g.why === 'string' && g.why.length > 0, 'and still states a reason');
    ok(!/NaN|undefined|Infinity/.test(g.why), 'with nothing broken on the card (' + g.why.slice(0, 44) + ')');
  }
  ok(swOf(null).pass === null, 'no plan reads UNCHECKED rather than passing');
  /* entry === stop is zero risk: not a wide stop, not a tight one, unusable. */
  ok(swOf({ entry: 100, stop: 100 }).pass === null, 'a zero-width stop cannot be judged, and says so');
}

console.log('\n== it argues, it does not veto ==');
{
  const gs = W.hgOmniGates(ROWS, HIT, null, { stats: { samples: 400, hit: 0.46, expR: 0.3 },
    minRr: 2, plan: { entry: 0.05747, stop: 0.04981, t1: 0.07279 } });
  const g = gs.filter(x => x.key === 'stop-width')[0];
  ok(g.info === true, 'stop-width is an INFO gate');
  const grade = W.hgOmniGrade(gs);
  ok(grade.vetoes.indexOf('stop-width') === -1, 'so a wide stop never vetoes the ticket');
  ok(grade.notes.indexOf('stop-width') >= 0, 'it lands in notes, where the card names it under "against"');
  /* Truncating the stop to score better is the failure this must not
     encourage — v351 established that it relocates risk rather than reducing
     it. Checked behaviourally: the gate must not touch the plan it is given. */
  const plan = { entry: 0.05747, stop: 0.04981, t1: 0.07279 };
  const before = JSON.stringify(plan);
  W.hgOmniGates(ROWS, HIT, null, { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, plan });
  ok(JSON.stringify(plan) === before, 'the ledger leaves the plan exactly as it found it');
  ok(plan.stop === 0.04981, 'the stop is not re-priced to make the gate pass');
}

console.log('\n== gold has it too, with a threshold that suits gold ==');
{
  const G = boot(['omnigold.js']);
  const grows = (() => { const o = []; let p = 3350;
    for (let i = 0; i < 200; i++){ p = p * (1 + Math.sin(i / 9) * 0.002);
      o.push({ t: T0 + i * 3600, o: p, h: p * 1.001, l: p * 0.999, c: p, v: 1000 }); } return o; })();
  const gsw = plan => G.hgOgGates(grows, { kind: 'ORB', dir: 'long', level: 3350, why: 't' },
    { stats: { samples: 200, hit: 0.5, expR: 0.3 }, minRr: 1.5, plan }).filter(x => x.key === 'stop-width')[0];
  ok(!!gsw({ entry: 3350, stop: 3330, t1: 3380 }), 'stop-width is on the gold ledger');
  ok(gsw({ entry: 3350, stop: 3330, t1: 3380 }).pass === true, 'a 0.6% gold stop is ordinary');
  ok(gsw({ entry: 3350, stop: 3200, t1: 3575 }).pass === false, 'a 4.5% gold stop is flagged');
  /* Gold is not an alt: 3% here is very large, where on a crypto perp it is not. */
  ok(/swPct >= 3/.test(GOLD), 'gold flags at 3%, not the 8% the crypto desk uses');
  ok(/swPct >= 8/.test(ROUTE), 'and crypto keeps 8%, because an alt genuinely moves that far');
  ok(gsw(null).pass === null, 'and no plan still reads UNCHECKED');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL STOP WIDTH TESTS PASSED');
