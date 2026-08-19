/* HARDGATE — the desk ticketed a trade the market had already stopped out.

   "The omnigold tab doesn't give correct setup" — and this time the cards
   were not merely mislabelled. Checked against the live price:

     market 4499.23
     every SWING card: entry 4391.83        — 107 points from the chart
     ADR-FADE short:   stop  4449.29        — market FIFTY POINTS BEYOND IT
     and earlier that day the desk TICKETED a short at these levels.

   A ticket whose stop the market has already crossed is dead on arrival:
   filled at market, it is an instant stop-out presented as a 2R setup.

   THE CAUSE is a gap between two correct behaviours. The desk drops the
   forming candle before anything reads a bar — right, for every indicator.
   The plan then prices its entry at the last CLOSED bar — which on the 4h
   horizon is up to four hours stale, and in a market moving 2.9% a day that
   is a hundred points of drift. No gate ever compared the plan against the
   current price, so the staleness was invisible: thirty-two gates judged the
   setup and none of them knew where the market was.

   The forming candle's close IS the current price, and the scan already had
   it in hand before the sanitiser dropped it. level-fresh keeps it and
   judges:

     market beyond the stop           -> VETO, dead on arrival
     entry more than 1.5xATR away     -> AGAINST (info) — a resting-order
                                         plan around stale structure, named
                                         as such rather than presented as a
                                         market entry
     otherwise                        -> PASS, quoting the gap
     no live price supplied           -> UNCHECKED — unknown reads UNCHECKED,
                                         never PASS, and old harnesses keep
                                         working

   Both desks: omniroute prices from the same closed bars and had the same
   hole; its live price is captured at pass-1 ingestion and carried to the
   pass-2 ledger per contract.

   Run: node tests/test-level-fresh.mjs */
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
    p = p*(1+(rnd()-0.5)*0.003);
    const r = p*0.0014*(0.5+rnd());
    out.push({ t: 1700000000+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v:1000 });
  }
  return out;
}
const ROWS = tape(400, 7);
const atrOf = (() => {
  const a = W.atr(ROWS, 14);
  for (let i = a.length - 1; i >= 0; i--) if (isFinite(a[i])) return a[i];
})();
const PLAN_SHORT = { entry: 4391.83, stop: 4449.29, t1: 4306.16 };
const gate = (dir, ex) => W.hgOgGates(ROWS, { dir: dir, kind: 'ORB', mech: 'ORB' }, ex)
                           .filter(g => g && g.key === 'level-fresh')[0];

console.log('== THE DEFECT: a short whose stop the market has crossed is DOA ==');
{
  /* The live numbers, verbatim. */
  const g = gate('short', { plan: PLAN_SHORT, livePx: 4499.23 });
  ok(g.pass === false && g.info !== true, 'market 50 points beyond the stop is a real VETO');
  ok(/DEAD ON ARRIVAL/.test(g.why), 'named for what it is: ' + g.why.slice(0, 60));
  ok(/50 points beyond the stop/.test(g.why), 'quoting the distance beyond the stop');
  ok(/closed bar the market has left behind/.test(g.why), 'and the cause — stale closed-bar pricing');
  /* It must stop the ticket. */
  const graded = W.hgOmniGrade(W.hgOgGates(ROWS, { dir:'short', kind:'ORB', mech:'ORB' },
    { plan: PLAN_SHORT, livePx: 4499.23 }));
  ok(graded.ticket === false, 'and the card cannot grade to TICKET');
  ok(graded.vetoes.indexOf('level-fresh') >= 0, 'with level-fresh named in the vetoes');
}

console.log('\n== the long mirror: market below a long stop is equally dead ==');
{
  const g = gate('long', { plan: { entry: 4400, stop: 4360, t1: 4480 }, livePx: 4340 });
  ok(g.pass === false && g.info !== true, 'a long whose stop is above the market is vetoed');
  ok(/DEAD ON ARRIVAL/.test(g.why), 'same wording, symmetric rule');
}

console.log('\n== a far-but-valid entry is AGAINST, not a veto ==');
{
  /* 107 points at 2.9xATR — the live longs. A resting order at real structure
     is a legitimate plan; the card must say what it is, not kill it. */
  const far = 4391.83 + 3 * atrOf;
  const g = gate('long', { plan: { entry: 4391.83, stop: 4322.81, t1: 4530 }, livePx: far });
  ok(g.pass === false && g.info === true, 'a 3xATR gap reads AGAINST — info, not a veto');
  ok(/resting-order plan around stale structure/.test(g.why), 'named as a resting-order plan');
  ok(/×ATR/.test(g.why), 'with the gap in ATR multiples');
  const graded = W.hgOmniGrade([{ key:'trend', hard:true, pass:true, why:'ok' },
    W.hgOgGates(ROWS, { dir:'long', kind:'ORB', mech:'ORB' },
      { plan: { entry: 4391.83, stop: 4322.81, t1: 4530 }, livePx: far })
      .filter(x => x.key === 'level-fresh')[0]]);
  ok(graded.ticket === true, 'and it does not kill the ticket on its own');
}

console.log('\n== levels near the market PASS, quoting the gap ==');
{
  const g = gate('long', { plan: { entry: 4400, stop: 4380, t1: 4440 }, livePx: 4405 });
  ok(g.pass === true, 'an entry 5 points from the market passes');
  ok(/5 points from entry/.test(g.why), 'and says how far: ' + g.why);
}

console.log('\n== no live price reads UNCHECKED — never PASS, and old callers work ==');
{
  const g = gate('long', { plan: { entry: 4400, stop: 4380, t1: 4440 } });
  ok(g.pass === null, 'absent livePx is UNCHECKED');
  ok(/not judged/.test(g.why), 'and says so');
  for (const bad of [NaN, 0, -5, null, 'x']){
    const gb = gate('long', { plan: { entry: 4400, stop: 4380, t1: 4440 }, livePx: bad });
    ok(gb.pass === null, 'livePx=' + bad + ' is UNCHECKED, not a fake verdict');
  }
  /* And no plan means nothing to judge either. */
  ok(gate('long', { livePx: 4400 }).pass === null, 'a live price with no plan is UNCHECKED');
}

console.log('\n== both desks capture the live price at ingestion ==');
{
  ok(/var livePx = rows\.length \? fin\(rows\[rows\.length - 1\]\.c\) : NaN;/.test(GOLD),
     'gold keeps the forming close before dropping it');
  ok(GOLD.indexOf('var livePx = rows.length') < GOLD.indexOf('if (dropFn) rows = dropFn(rows, cfg.tf)'),
     'BEFORE the sanitiser runs, or it would be gone');
  ok(/livePx: livePx/.test(GOLD), 'and passes it into the ledger extras');
  ok(/var livePx = \(rows && rows\.length\) \? fin\(rows\[rows\.length - 1\]\.c\) : NaN;/.test(ROUTE),
     'omniroute does the same at its single ingestion point');
  ok(/fired\.push\(\{ item: item, rows: rows, hits: hits, livePx: livePx \}\);/.test(ROUTE),
     'carried per contract from pass 1');
  ok(/ex\.livePx = fired\[j\]\.livePx;/.test(ROUTE), 'and handed to the pass-2 ledger');
  ok((GOLD.match(/key:'level-fresh'/g) || []).length === 1
     && (ROUTE.match(/key:'level-fresh'/g) || []).length === 1,
     'one level-fresh gate per desk');
  ok(/fin\(x\.livePx\)/.test(GOLD), 'read with fin — a null price is missing, not price zero');
}

console.log('\n== a dead card is not RENDERED as a trade ==');
{
  /* The gate vetoed, but the tab still drew the card full size — ENTRY, STOP
     and T1 in large type a hundred points from the chart. The veto badge was
     there; the numbers were what registered, and "a short trade with not even
     close levels" was reported three times before this landed. */
  ok(/levels dead on arrival: /.test(GOLD), 'a DOA card collapses to one dim line');
  ok(/card not rendered/.test(GOLD), 'saying explicitly that the card was withheld');
  ok(/DEAD LEVELS — priced off a closed bar the market has left behind/.test(GOLD),
     'under a heading naming the cause');
  ok(/lfG\.pass === false && lfG\.info !== true/.test(GOLD),
     'only a REAL veto collapses — AGAINST resting-order plans still render in full');
  ok(GOLD.indexOf('levels dead on arrival') > GOLD.indexOf('var ogSeen'),
     'applied after the duplicate collapse, so the surviving card is the one judged');
  ok(/'level-fresh': 'the market has moved past the levels/.test(GOLD),
     'and the desk read can name it when it dominates');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL LEVEL-FRESH TESTS PASSED');
