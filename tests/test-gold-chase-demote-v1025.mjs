/* HARDGATE — hg-v1025: THE ANTI-CHASE (WALK-AWAY) DEMOTION.

   A pending plan can be a flawless 2.0R and still be dead on arrival: price
   already through the stop, or the target already behind the entry. Entering
   either is chasing a move that has left. hgPlanChaseVerdict (hg-plan.js) is
   the shared rule; goldRankSetups (goldind.js) demotes a chased plan so it can
   never lead, and stamps it; the forward ledger carries the `chased` +
   `chaseCode` read-marks so the cohort is MEASURED, not assumed.

   Contracts held:
     - chased is true ONLY for an explicit bad geometry (stop-breached /
       target-crossed); an unjudgeable plan stands aside (fail-open).
     - the demotion is a named stamp; a chased plan demotes, never drops.
     - the ledger marks are three-state (true / undefined), never a coerced
       'not chased'.

   Run: node tests/test-gold-chase-demote-v1025.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } };

function bootGeometry(){
  const s = { console, Math, isFinite, isNaN, parseFloat, Number, String, Object, Array, JSON };
  s.window = s; s.globalThis = s; s.self = s;
  vm.createContext(s);
  for (const f of ['indicators.js', 'plans.js', 'hg-plan.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), s, { filename: f });
  }
  return s;
}
const G = bootGeometry();
const CH = G.hgPlanChaseVerdict;

console.log('== hgPlanChaseVerdict: the rule ==');
ok(typeof CH === 'function', 'hgPlanChaseVerdict exported');

/* stop-breached: a short whose stop is already below the mark */
{
  const v = CH({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 }, 4330.00);
  ok(v.chased === true && v.code === 'stop-breached', 'price through the stop → chased (stop-breached)');
}
/* target-crossed: the reported 2.0R whose target sits behind price */
{
  const v = CH({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 }, 4282.70);
  ok(v.chased === true && v.code === 'target-crossed', 'target behind price → chased (target-crossed)');
}
/* long mirror */
ok(CH({ dir: 'long', entry: 4280, stop: 4270, t1: 4300 }, 4310).chased === true, 'long target behind price → chased');
ok(CH({ dir: 'long', entry: 4280, stop: 4270, t1: 4300 }, 4265).chased === true, 'long stop breached → chased');

/* healthy plans are NOT chased */
ok(CH({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4280 }, 4300).chased === false, 'a short with target below mark → not chased');
ok(CH({ dir: 'long', entry: 4280, stop: 4270, t1: 4300 }, 4275).chased === false, 'a long with target ahead of mark → not chased');

/* unjudgeable → not chased (fail-open) */
ok(CH(null, 4282.70).chased === false, 'null plan → not chased');
ok(CH({ dir: 'short', entry: 4316.20 }, NaN).chased === false, 'no mark → not chased');
ok(CH({ dir: 'short', entry: 4316.20 }, 0).chased === false, 'zero mark → not chased');
ok(CH({ dir: '', entry: 4316.20 }, 4282.70).chased === false, 'no direction → not chased');

/* pure: never throws, never mutates */
{
  const p = { dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 };
  const before = JSON.stringify(p);
  const v = CH(p, 4282.70);
  ok(JSON.stringify(p) === before, 'the plan is left untouched');
  ok(v.why && v.why.length > 0, 'and the verdict names the geometry in words');
}

console.log('== the ranker demotes + stamps (source contract) ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  ok(/rc\.chased\s*=\s*true/.test(src), 'goldRankSetups sets rc.chased = true');
  ok(/rc\.chaseCode\s*=\s*gGeo\.code/.test(src), 'and records the geometry code');
  ok(/rc\.demoted\s*=\s*true/.test(src), 'a chased plan demotes (can never lead)');
  ok(/anti-chase walk-away/.test(src), 'and it is a named stamp, not a silent demotion');
  ok(/hgPlanMarketGeometry/.test(src), 'it reads the shared geometry rule, not a local copy');
}

console.log('== the forward ledger carries the mark (three-state) ==');
{
  const s = {};
  const C = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON,
              Date, parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map };
  C.window = C; C.globalThis = C; C.self = C; C.HG_tabs = [];
  C.setTimeout = f => 0; C.clearTimeout = () => {}; C.setInterval = () => 0; C.clearInterval = () => {};
  C.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){} }), head: { appendChild(){} } };
  C.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  C.location = { href: 'https://x/', search: '', protocol: 'https:' };
  vm.createContext(C);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), C, { filename: f });
  }
  const norm = C.hgFwdNormalize;
  ok(typeof norm === 'function', 'hgFwdNormalize exported');
  const base = { tab: 'GOLDSCALP', mechanic: 'X', sym: 'XAUUSD', tf: '15m', dir: 'long',
                 entry: 100, stop: 99, t1: 101.5, barT: Date.now()/1000 };
  ok(norm(Object.assign({}, base, { chased: true, chaseCode: 'stop-breached' })).chased === true, 'chased:true → chased true');
  ok(norm(Object.assign({}, base, { chased: true, chaseCode: 'stop-breached' })).chaseCode === 'stop-breached', 'and the code is kept');
  ok(norm(base).chased === undefined, 'absent → undefined (NOT RECORDED, never coerced)');
  ok(norm(Object.assign({}, base, { chased: false, chaseCode: 'stop-breached' })).chased === undefined, 'chased:false → undefined (three-state, not a coerced "not chased")');
  ok(norm(Object.assign({}, base, { chased: true, chaseCode: 'bogus' })).chaseCode === undefined, 'unknown code → undefined (only the two real geometries)');
}

/* the record carries it on the two desks that measure PERFECT */
{
  const sw = fs.readFileSync(path.join(ROOT, 'goldswing.js'), 'utf8');
  const sx = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  ok(/chased:\s*c\.chased/.test(sw), 'GOLD SWING forwards chased on its forward row');
  ok(/chased:\s*c\.chased/.test(sx), 'GOLD SCALP forwards chased on its forward row (property access, lifted-map-safe)');
  ok(/chaseCode:\s*c\.chaseCode/.test(sx), 'and the code travels too');
}

console.log('\n' + (fail === 0 ? ('ALL ' + pass + ' passed') : (fail + ' FAILED / ' + pass + ' passed')));
process.exit(fail === 0 ? 0 : 1);
