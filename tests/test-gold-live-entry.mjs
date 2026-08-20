/* HARDGATE — the gold desk prices its entry at the CURRENT market.

   "Why don't omnigold tab use current gold levels and make a scalp setup
   out of it?" Because two engines moved the entry away from the market.
   The plan core defaulted entry to the last CLOSED bar — an hour stale on
   SCALP, four on SWING. Then hgApplyExactEntry moved it further: the
   edgeSignal path replaces entry, stop and targets wholesale with a
   resting order at a structure edge, and the scalp enricher re-anchors to
   EMA21 or a sweep level. Measured live before the fix: entry 4454.92
   against a 4519.51 market — 65 points away — and the override the desk
   passed was simply ignored.

   The contract, GOLD PRO's v398 split, now on the gold desk proper:

     indicators and structure  ->  CLOSED bars only (no repainting)
     the ENTRY                 ->  the LIVE price (where a trade starts)
     the stop                  ->  closed-bar structure, from the real entry
     targets                   ->  R-multiples of that real risk
     no live price supplied    ->  last closed close as the market proxy,
                                   entry NEVER moved to an enricher's level

   Guarded here in source (the call passes the live override and
   skipExact) and in behaviour (every planned card enters exactly at the
   live price, level-fresh PASSES by construction, and the labelled
   momentum stop survives the skipExact path).

   Run: node tests/test-gold-live-entry.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');

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
const CLOSED = ROWS[ROWS.length - 1].c;
const HITS = [ { kind:'ORB', dir:'long',  level: CLOSED, why:'t' },
               { kind:'ORB', dir:'short', level: CLOSED, why:'t' } ];
const CFG = { minRr: 1.5, label: 'SCALP' };

console.log('== source: the call passes the live price and pins skipExact ==');
{
  const i = GOLD.indexOf('plan = planFn(hit.dir, rows,');
  ok(i >= 0, 'the plan call is where the contract says');
  const call = GOLD.slice(i, GOLD.indexOf(');', i));
  ok(/fin\(ex\.livePx\)/.test(GOLD.slice(Math.max(0, i - 300), i)), 'the override is the live price the scan captured');
  ok(/skipExact:\s*true/.test(call), 'and skipExact keeps the enrichers from moving it');
  ok(/momentumOk:\s*!hgOgIsReversion\(hit\.kind\)/.test(call), 'the momentum grant is untouched');
}

console.log('\n== with a live price, every planned card enters exactly there ==');
{
  const LIVE = CLOSED + 3.7;              /* the market has drifted since the close */
  const cards = W.hgOgEvaluate(ROWS, HITS, { livePx: LIVE }, CFG);
  ok(cards.length === 2, 'both hits evaluated');
  const planned = cards.filter(c => c.plan);
  ok(planned.length >= 1, 'at least one direction found a plan on this tape (' + planned.length + ' did)');
  for (const c of planned){
    ok(Math.abs(c.plan.entry - LIVE) < 1e-9, c.dir + ' entry IS the live price, not the closed bar (' + c.plan.entry.toFixed(2) + ')');
    ok(c.dir === 'long' ? c.plan.stop < c.plan.entry : c.plan.stop > c.plan.entry,
       c.dir + ' stop on the invalidation side of the real entry');
    ok(c.dir === 'long' ? c.plan.t1 > c.plan.entry : c.plan.t1 < c.plan.entry,
       c.dir + ' target beyond the real entry');
    const lf = c.gates.filter(g => g && g.key === 'level-fresh')[0];
    ok(lf && lf.pass === true, c.dir + ' level-fresh PASSES by construction — entry is at market');
  }
}

console.log('\n== without one, the last closed close is the proxy — never an enricher level ==');
{
  const cards = W.hgOgEvaluate(ROWS, HITS, {}, CFG);
  const planned = cards.filter(c => c.plan);
  ok(planned.length >= 1, 'plans still form on harness tapes with no live feed');
  for (const c of planned){
    ok(Math.abs(c.plan.entry - CLOSED) < 1e-9,
       c.dir + ' entry is the last closed close exactly (' + c.plan.entry.toFixed(2) + '), not EMA21 or an edge');
  }
}

console.log('\n== a junk live price falls back to the proxy instead of poisoning the plan ==');
{
  for (const junk of [NaN, 0, -4500, null, 'oops']){
    const cards = W.hgOgEvaluate(ROWS, HITS, { livePx: junk }, CFG);
    const planned = cards.filter(c => c.plan);
    for (const c of planned)
      ok(Math.abs(c.plan.entry - CLOSED) < 1e-9, 'livePx=' + String(junk) + ' -> closed-close proxy, plan intact');
  }
}

console.log('\n== the labelled momentum stop survives the skipExact path ==');
{
  /* A tape whose last swing sits far beneath the market: structure risk
     blows past the 6xATR cap, so only the momentum grant can plan it. */
  const far = tape(400, 7).map(r => ({ ...r }));
  for (let i = 340; i < 400; i++){          /* 60-bar vertical rally, no pullback */
    const prev = i === 340 ? far[339].c : far[i-1].c;
    const p = prev * 1.004;
    far[i] = { t: far[i].t, o: prev, h: p * 1.0005, l: prev * 0.9998, c: p, v: 1000 };
  }
  const LIVE = far[far.length-1].c * 1.001;
  const pl = W.hgPlanLevels('long', far, LIVE, { minRr: 1.5, capMode: 'structure', momentumOk: true, skipExact: true });
  ok(pl && pl.momentumStop === true, 'the volatility stop keeps its name through skipExact');
  ok(Math.abs(pl.entry - LIVE) < 1e-9, 'and the entry is still the live price');
  ok(/MOMENTUM STOP/.test(String(pl.note || '')), 'with the note that says what it is, not [structure]');
  const none = W.hgPlanLevels('long', far, LIVE, { minRr: 1.5, capMode: 'structure', momentumOk: false, skipExact: true });
  ok(none === null, 'and a fade on the same tape still gets NO plan — no premise, no levels');
}

console.log('\npassed: ' + passed);
