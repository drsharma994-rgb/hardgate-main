/* HARDGATE — OMNIGOLD tickets the named setup level, not the live print.

   The plan core still accepts a live override when a detector did not name
   a level (skipExact, so enrichers cannot drag entry to EMA21 / an edge).
   OMNIGOLD itself must not use that override to chase the market: a 4H FVG
   at 4429 on a 4535 tape is a 4429 limit, not ENTRY 4535 / STOP 3415.

   Contract:

     indicators and structure  ->  CLOSED bars only (no repainting)
     the ENTRY                 ->  hit.level when the detector named one,
                                   else the live print (or last closed close)
     the stop                  ->  beyond that setup (sweep) or structure
                                   from that entry (continuation), capped
     targets                   ->  R-multiples of that real risk
     skipExact                 ->  enrichers cannot hijack continuation

   Guarded here in source (hgOgPlanForHit + skipExact) and in behaviour
   (every planned card with a named level enters THERE).

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

console.log('== source: the plan is the setup, skipExact blocks enrichers ==');
{
  ok(/function hgOgPlanForHit\(/.test(GOLD), 'setup-native planner exists');
  ok(/skipExact:\s*true/.test(GOLD), 'skipExact keeps the enrichers from moving continuation entries');
  ok(/momentumOk:\s*!hgOgIsReversion\(hit\.kind\)/.test(GOLD), 'the momentum grant is still continuation-only');
}

console.log('\n== with a named setup level, every planned card enters THERE ==');
{
  const LIVE = CLOSED + 3.7;              /* the market has drifted since the close */
  const cards = W.hgOgEvaluate(ROWS, HITS, { livePx: LIVE }, CFG);
  ok(cards.length === 2, 'both hits evaluated');
  const planned = cards.filter(c => c.plan);
  ok(planned.length >= 1, 'at least one direction found a plan on this tape (' + planned.length + ' did)');
  for (const c of planned){
    ok(Math.abs(c.plan.entry - CLOSED) < 1e-9, c.dir + ' entry IS the setup level, not live gold (' + c.plan.entry.toFixed(2) + ')');
    ok(c.dir === 'long' ? c.plan.stop < c.plan.entry : c.plan.stop > c.plan.entry,
       c.dir + ' stop on the invalidation side of the setup entry');
    ok(c.dir === 'long' ? c.plan.t1 > c.plan.entry : c.plan.t1 < c.plan.entry,
       c.dir + ' target beyond the setup entry');
    const lf = c.gates.filter(g => g && g.key === 'level-fresh')[0];
    ok(lf && lf.pass !== false, c.dir + ' level-fresh does not veto a 3.7pt drift on this tape');
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
