/* HARDGATE — SETTLED EXECUTE panel: only TICKET setups whose forward
   settled record clears Wilson 95% lower bound (min 15 trades).

   Run: node tests/test-omnigold-settled-execute.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  /* NO STUB. hgWilson used to live inline in index.html and in no module, so
     this harness hand-wrote one — and the hand-written one dropped the
     `if (!(n > 0) || !(wins >= 0) || wins > n) return null` guard, answering
     {lo:NaN,...} exactly where the shipped function answers null. These
     assertions were checking the tab's promotion rules against a more
     permissive estimator than the tab ships. It is in fixpack14-core.js now,
     which the loader below already reads. */
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

console.log('== Wilson bar rejects thin or mediocre records ==');
{
  const W = boot();
  ok(W.hgOgSettledExecuteOk({ wilson: { lo: 0.96, p: 0.97 }, samples: 20 }, 0.95, 15),
     '20/20 at 97% clears 95% bar');
  ok(!W.hgOgSettledExecuteOk({ wilson: { lo: 0.72, p: 0.80 }, samples: 20 }, 0.95, 15),
     '16/20 at 80% does not');
  ok(!W.hgOgSettledExecuteOk({ wilson: { lo: 0.99, p: 1 }, samples: 10 }, 0.95, 15),
     '10 samples is too thin even at 100%');
}

console.log('\n== pick requires TICKET + tape alignment ==');
{
  const W = boot();
  /* hg-forward.js overwrites hgFwdStats on load — patch after boot */
  W.hgFwdStats = (tab, mech, ticketOnly) => {
    if (ticketOnly) return { samples: 80, wins: 80, hit: 1, expR: 1.5 };
    return { samples: 100, wins: 50, hit: 0.5, expR: 0.1 };
  };
  const ticket = { horizon: 'SWING', kind: 'MMOVE', dir: 'short',
    grade: { ticket: true }, plan: { entry: 1, stop: 2, t1: 3 } };
  const veto = { horizon: 'SWING', kind: 'ORB', dir: 'short',
    grade: { ticket: false, vetoes: ['consensus'] }, plan: { entry: 1, stop: 2, t1: 3 } };
  const bag = W.hgOgPickSettledExecutes([veto, ticket], 'short');
  ok(bag.execute.length === 1 && bag.execute[0].kind === 'MMOVE', 'only TICKET promoted');
}

console.log('\n== panel wired in mount ==');
{
  const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/id="ogSettledExec"/.test(GOLD), 'settled execute host div');
  ok(/hgOgPaintSettledExecute\(ui/.test(GOLD), 'painted after scan');
  ok(/SETTLED EXECUTE/.test(GOLD), 'panel names itself');
  ok(/Wilson 95% lower bound/.test(GOLD), 'states the bar honestly');
}

console.log('\nomnigold settled execute: ' + passed + ' checks passed');
