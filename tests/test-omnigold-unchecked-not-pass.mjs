/* HARDGATE — a check that could not run is not a check that passed.

   The whole gate ledger rests on a three-state distinction that this file's
   comments state over and over: pass, veto, UNCHECKED. hgOmniGrade is built
   for it — pass===false vetoes, pass===null lands in `degraded` (soft) or
   `unknown` (hard), and `evaluated` counts only rows where pass !== null, so
   the card can say "a ticket resting on 4 evaluated gates is far weaker
   evidence than one resting on 12".

   One row broke it. The institutional gold filter pushed pass:true whenever
   it could not be evaluated, with a why line that admitted as much:

     {"key":"inst-filter","hard":false,"pass":true,"why":"inst filter threw — fail-open"}

   The intent was right — do not veto a setup because a module is missing —
   but the shape was not. Its comment framed the choice as "fail-open PASS
   (not UNCHECKED-hard)", and those are not the only two: pass:null with
   hard:false is UNCHECKED-SOFT, which does not veto either and tells the
   truth about what ran.

   It matters because `pass === true` is what every consumer counts. A
   throwing filter and a clean institutional check were indistinguishable,
   and the card's checks badge read the same 35 of 57 either way.

   goldind.js IS loaded in the app, so the absent branch is rare. The THROW
   branch is live on any exception inside the filter.

   Run: node tests/test-omnigold-unchecked-not-pass.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} },
                                        appendChild(){}, setAttribute(){} }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
                   'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}
const T = 1700000000 - (1700000000 % 86400);
const mk = (n, seed) => {
  let p = 4000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 + rnd() * 900 });
  }
  return o;
};
const ROWS = mk(400, 7);
const HIT = { kind: 'ROUND-MAGNET', dir: 'long', level: 4000 };
const EXTRA = { livePx: 4000, nowSec: T + 400 * 3600 };
const gatesOf = (C) => C.hgOgGates(ROWS, HIT, EXTRA) || [];
const gate = (C, key) => gatesOf(C).filter(g => g && g.key === key)[0] || null;

console.log('== the grader is built for three states, and this proves it ==');
{
  const C = boot();
  ok(typeof C.hgOmniGrade === 'function', 'hgOmniGrade is available');
  const g = (over) => C.hgOmniGrade([Object.assign({ key: 'k', hard: false }, over)]);
  ok(g({ pass: true }).evaluated === 1, 'a pass counts as evaluated');
  ok(g({ pass: false }).vetoes.length === 1, 'a fail vetoes');
  const soft = g({ pass: null, hard: false });
  ok(soft.evaluated === 0, 'an UNCHECKED-SOFT row does not count as evaluated');
  ok(soft.vetoes.length === 0 && soft.unknown.length === 0 && soft.degraded.length === 1,
     'and does not veto — it lands in degraded, which is exactly the shape this fix needed');
  const hard = g({ pass: null, hard: true });
  ok(hard.unknown.length === 1 && hard.ticket === false,
     'while UNCHECKED-HARD does block a ticket, which is the option the old comment weighed against PASS');
}

console.log('\n== the institutional filter, in its three states ==');
{
  const clean = boot();
  ok(typeof clean.hgGoldInstFilter === 'function',
     'goldind.js is loaded, so the filter genuinely runs here');
  const okGate = gate(clean, 'inst-filter');
  ok(okGate && okGate.pass === true, `a filter that runs and finds nothing reports PASS (${okGate.why})`);
  ok(okGate.hard === true, 'as a HARD row, because it really was checked');

  const thrown = boot();
  thrown.hgGoldInstFilter = function(){ throw new Error('boom'); };
  const tGate = gate(thrown, 'inst-filter');
  ok(tGate && tGate.pass === null,
     `a filter that THROWS now reports UNCHECKED (${JSON.stringify(tGate.pass)}), not PASS`);
  ok(tGate.hard === false, 'soft, so it still does not veto the setup');
  ok(/not checked/.test(tGate.why) && !/fail-open/.test(tGate.why),
     `and says so plainly: "${tGate.why}"`);

  const absent = boot();
  absent.hgGoldInstFilter = undefined;
  const aGate = gate(absent, 'inst-filter');
  ok(aGate && aGate.pass === null && aGate.hard === false,
     'an absent module reads the same way');
  ok(/not loaded/.test(aGate.why), `naming which of the two it was: "${aGate.why}"`);

  /* A REAL DROP STILL VETOES. The fix must not have bought silence. */
  const dropped = boot();
  dropped.hgGoldInstFilter = function(cand){ cand.dropped = true; cand.reason = 'spread too wide'; return cand; };
  const dGate = gate(dropped, 'inst-filter');
  ok(dGate && dGate.pass === false && dGate.hard === true,
     'a filter that genuinely rejects still vetoes, hard');
  ok(/spread too wide/.test(dGate.why), 'carrying its own reason');
}

console.log('\n== the checks badge stops counting a check that never ran ==');
{
  const clean = boot();
  const thrown = boot();
  thrown.hgGoldInstFilter = function(){ throw new Error('boom'); };
  const gc = clean.hgOmniGrade(gatesOf(clean));
  const gt = thrown.hgOmniGrade(gatesOf(thrown));
  ok(gc.total === gt.total, `both ledgers carry ${gc.total} rows`);
  ok(gc.evaluated === gt.evaluated + 1,
     `the clean run evaluates ${gc.evaluated} and the throwing one ${gt.evaluated} — one fewer, `
     + 'where before they read the same number');
  ok(gt.degraded.indexOf('inst-filter') >= 0, 'with the row named among the degraded');
  ok(gt.vetoes.indexOf('inst-filter') < 0 && gt.unknown.indexOf('inst-filter') < 0,
     'and not among the vetoes or the hard unknowns — the non-veto intent is preserved');

  /* THE OLD SHAPE, reimplemented, so the indistinguishability is shown */
  const oldRow = { key: 'inst-filter', hard: false, pass: true, why: 'inst filter threw — fail-open' };
  const cleanRow = { key: 'inst-filter', hard: true, pass: true, why: 'institutional gold filter OK' };
  ok(oldRow.pass === cleanRow.pass,
     'under the old shape a throwing filter and a clean check both read pass:true — '
     + 'indistinguishable to every consumer that counts them');
}

console.log('\n== and no ledger row claims a pass it did not earn ==');
{
  /* THE STANDING GUARD. Not the one row — the doctrine. A gate whose own
     `why` admits it could not be evaluated must not be reporting PASS. */
  const words = /not loaded|not checked|unavailable|unread|could not|cannot|threw|fail-open|no data|absent/i;
  let checked = 0, offenders = [];
  const contexts = [];
  {
    const c1 = boot(); contexts.push(['everything loaded', c1]);
    const c2 = boot(); c2.hgGoldInstFilter = function(){ throw new Error('boom'); };
    contexts.push(['inst filter throws', c2]);
    const c3 = boot();
    for (const k of ['hgGoldInstFilter', 'goldKillzone', 'hgAtrPercentile', 'calculateGoldSpotBasis',
                     'detectRegime', 'goldMarketStructure', 'hgCoint', 'volumeProfile'])
      c3[k] = undefined;
    contexts.push(['several engines absent', c3]);
  }
  for (const [nm, C] of contexts){
    for (const g of gatesOf(C)){
      if (!g) continue;
      checked++;
      if (g.pass === true && words.test(String(g.why || '')))
        offenders.push(nm + ' :: ' + g.key + ' — ' + String(g.why).slice(0, 70));
    }
  }
  ok(checked > 120, `${checked} ledger rows inspected across three degraded contexts`);
  ok(offenders.length === 0,
     'not one reports PASS while its own why line says it could not be evaluated'
     + (offenders.length ? ('\n      ' + offenders.join('\n      ')) : ''));

  /* and the sweep is not passing because everything went UNCHECKED */
  const live = gatesOf(boot()).filter(g => g && g.pass === true).length;
  ok(live > 20, `${live} rows in the clean context do report a real PASS, so the guard is not vacuous`);
}

console.log('\n' + passed + ' passed, 0 failed');
