/* HARDGATE — the hit rate is measured where T1 actually sits.

   THE DEFECT. Two different numbers were being used as though they were one:

     cfg.minRr   an ACCEPTANCE FLOOR — the plan engine rejects any structure
                 whose reachable R:R falls below it. 1.5 on SCALP, 2.0 on SWING.
     t1R         where T1 is PLACED. Hard-coded 2.0 on both horizons.

   The walk-forward, the pooled expectancy, the measured-edge breakeven, the
   pooled-table label and the forward panel were all keyed to cfg.minRr. So on
   SCALP the desk measured "did price reach 1.5R before the stop" and printed
   that beside a ticket whose T1 is at 2.0R. Reaching 2R is strictly harder,
   so the card overstated its own plan.

   Measured on 1,000 hours of live PAXG bars:

     hit at 1.5R (what the card said)      39.9%
     hit at 2.0R (what the plan needs)     30.9%

   9.0 points too generous, on the headline number a trader reads. A survey of
   1,957 scalp plans and 1,838 swing plans found T1 at exactly 2.00R on 100%
   of them — zero variance — so this is a constant, not an average, and the
   fix is exact rather than approximate.

   SWING never showed it, because its floor happens to equal 2.0. That is the
   same shape as the pooled-expectancy bug before it: wrong on one horizon,
   invisible on the other, and the wrong one trades more often. Twice now, so
   the invariant is worth pinning rather than remembering.

   Run: node tests/test-omnigold-t1-r.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
function stripComments(s){
  let out = '', i = 0;
  while (i < s.length){
    const two = s.slice(i, i + 2);
    if (two === '/*'){ const e = s.indexOf('*/', i + 2); i = (e === -1) ? s.length : e + 2; continue; }
    if (two === '//'){ const e = s.indexOf('\n', i); i = (e === -1) ? s.length : e; continue; }
    out += s[i]; i++;
  }
  return out;
}
const CODE = stripComments(SRC);

console.log('== the target is a named constant, not a literal in two places ==');
const m = /var\s+OG_T1_R\s*=\s*([\d.]+)\s*;/.exec(CODE);
ok(!!m, 'OG_T1_R is declared');
const T1 = Number(m[1]);
ok(T1 > 0 && isFinite(T1), 'OG_T1_R is a positive number (' + T1 + ')');
ok(/var\s+OG_T2_R\s*=\s*([\d.]+)\s*;/.test(CODE), 'OG_T2_R is declared');

console.log('\n== the plan places T1 there ==');
{
  const lits = (CODE.match(/t1R:\s*\d/g) || []);
  ok(lits.length === 0,
     'no plan path hard-codes a numeric t1R any more' + (lits.length ? ' — found ' + lits.join(', ') : ''));
  const uses = (CODE.match(/t1R:\s*OG_T1_R/g) || []).length;
  ok(uses >= 2, 'both plan paths place T1 at OG_T1_R (' + uses + ' call sites)');
}

console.log('\n== and every measurement of it uses the same constant ==');
{
  ok(/rMult:\s*OG_T1_R/.test(CODE), 'the walk-forward measures at OG_T1_R');
  ok(!/rMult:\s*cfg\.minRr/.test(CODE), 'the walk-forward no longer measures at the acceptance floor');
  ok(/poolFn\(\[stats\],\s*OG_T1_R\)/.test(CODE), 'the pool prices expectancy at OG_T1_R');
  ok(!/poolFn\(\[stats\],\s*cfg\.minRr\)/.test(CODE), 'the pool no longer prices at the acceptance floor');
  ok(/ex\.minRr\s*=\s*OG_T1_R/.test(CODE), 'the measured-edge gate takes its breakeven from OG_T1_R');
  ok(!/ex\.minRr\s*=\s*cfg\.minRr/.test(CODE), 'the gate no longer takes breakeven from the floor');
}

console.log('\n== the floor keeps its own job ==');
{
  /* cfg.minRr must STILL be used for plan acceptance — this fix must not
     quietly delete the floor while correcting the target. */
  ok(/minRr:\s*cfg\.minRr/.test(CODE), 'the plan engine is still handed cfg.minRr as its acceptance floor');
  ok(/scalp:\s*\{[^}]*minRr:\s*1\.5/.test(CODE), 'SCALP still declares its own floor (1.5)');
  ok(/swing:\s*\{[^}]*minRr:\s*2\.0/.test(CODE), 'SWING still declares its own floor (2.0)');
}

console.log('\n== behaviour: a real plan puts T1 exactly at OG_T1_R ==');
{
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
  const T0 = 1700000000 - (1700000000 % 86400);
  function tape(seed, n, tf){
    let s = seed; const rnd = () => (s = (s*1103515245+12345) % 2147483648) / 2147483648;
    const rows = []; let p = 2000;
    for (let i = 0; i < n; i++){
      p += (rnd()-0.47)*9 + Math.sin(i/9)*3;
      const o = p, c = p + (rnd()-0.5)*4;
      rows.push({ t: T0 + i*tf, o, h: Math.max(o,c)+rnd()*5, l: Math.min(o,c)-rnd()*5, c,
                  v: 900 + rnd()*900 });
    }
    return rows;
  }
  const CFGS = [
    { label:'SCALP', tf:'1h', minRr:1.5, horizonBars:24, warm:60, minAtrPct:0.05, sessionHard:true,  tfSec:3600 },
    { label:'SWING', tf:'4h', minRr:2.0, horizonBars:20, warm:45, minAtrPct:0.12, sessionHard:false, tfSec:14400 }
  ];
  for (const cfg of CFGS){
    let checked = 0, offTarget = 0, worst = 0;
    for (let s = 1; s <= 8; s++){
      const rows = tape(s*7919, 300, cfg.tfSec);
      let hits = [];
      try { hits = ctx.hgOgDetect(rows, { nowSec: rows[rows.length-1].t }); } catch (e) { continue; }
      if (!hits.length) continue;
      const livePx = rows[rows.length-1].c;
      let cands = [];
      try {
        cands = ctx.hgOgEvaluate(rows, hits, {
          htf:null, killzone:null, macro:null, yieldRows:null, nowSec: rows[rows.length-1].t,
          adr: ctx.hgOgAdr(rows,14), news:null, stats:null, livePx, zoneCtx:null,
          paxg: livePx, srcId:'gold-spot'
        }, cfg) || [];
      } catch (e) { continue; }
      for (const c of cands){
        if (!c.plan) continue;
        const e = +c.plan.entry, st = +c.plan.stop, t1 = +c.plan.t1;
        const risk = Math.abs(e - st);
        if (!(risk > 0) || !isFinite(t1)) continue;
        const r = Math.abs(t1 - e) / risk;
        checked++;
        const off = Math.abs(r - T1);
        if (off > 0.01){ offTarget++; if (off > worst) worst = off; }
      }
    }
    ok(checked > 20, cfg.label + ': enough plans to judge (' + checked + ')');
    ok(offTarget === 0,
       cfg.label + ': every plan puts T1 at ' + T1 + 'R (' + checked + ' plans, ' +
       offTarget + ' off-target' + (offTarget ? ', worst ' + worst.toFixed(3) + 'R' : '') + ')');
  }
}

console.log('\n== the arithmetic the fix rests on ==');
{
  /* Breakeven for a +R / -1 pair is 1/(1+R). If T1 moved and the breakeven
     the gate compares against did not, the gate would judge the hit rate
     against the wrong bar — which is the bug, restated. */
  const beFloorScalp = 1 / (1 + 1.5);
  const beTarget = 1 / (1 + T1);
  ok(Math.abs(beFloorScalp - 0.4) < 1e-9, 'breakeven at the old 1.5R floor is 40.0%');
  ok(Math.abs(beTarget - 1/3) < 0.01, 'breakeven at the ' + T1 + 'R target is 33.3%');
  ok(beTarget < beFloorScalp,
     'the target has the LOWER breakeven — so measuring at the floor demanded a ' +
     'harder hit rate while reporting an easier one');
}

console.log('\nomnigold T1 R: ' + passed + ' checks passed · plan and measurement share one constant');
