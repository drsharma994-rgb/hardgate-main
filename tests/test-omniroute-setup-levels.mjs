/* HARDGATE — OMNIROUTE tickets must be the setup's own levels.

   Same defect OMNIGOLD v423 closed: hgOmniEvaluate called
     hgPlanLevels(dir, rows, undefined, { minRr, type: 'OMNI' })
   so an ORB / FVG / VALUE at a named price printed last-close + enricher
   levels. The card stored hit.level and showed plan.entry with no SETUP line.

   Contract (crypto, not gold):
     1. entry IS hit.level when the detector named one
     2. sweep/reversion stop sits beyond that level
     3. continuation uses structure FROM that entry, skipExact
     4. the card names SETUP @ the detector price
     5. TREND hits the daily stack already disqualifies do not vote
     6. OMNIPRESENT is unchanged — TRIGGERED stays live after rejection

   Run: node tests/test-omniroute-setup-levels.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = read('omniroute.js');
const PRESENT = read('omnipresent.js');

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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

function tape(n, seed, start){
  const out = []; let p = start || 60000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1200 });
  }
  return out;
}
const ROWS = tape(180, 11, 60000);
const LIVE = ROWS[ROWS.length - 1].c;
const ITEM = { sym: 'BTCUSD', base: 'BTC', exchange: 'delta' };

console.log('== 1. planner exists and VALUE entry is the named level ==');
{
  ok(typeof W.hgOmniPlanForHit === 'function', 'hgOmniPlanForHit is exported');
  const lvl = LIVE - 420;
  const hit = { kind: 'VALUE', dir: 'long', level: lvl, why: 'VAL reject' };
  const pl = W.hgOmniPlanForHit(hit, ROWS, { livePx: LIVE });
  ok(!!pl, 'a reversion with a named level still produces a plan');
  ok(Math.abs(pl.entry - lvl) < 1e-6, 'ENTRY is the VALUE level ' + lvl.toFixed(2)
     + ', not live ' + LIVE.toFixed(2) + ' (got ' + (pl && pl.entry) + ')');
  ok(pl.stop < pl.entry, 'long stop is below the named level');
  ok(pl.entry - pl.stop < LIVE * 0.08, 'stop is this setup\'s invalidation, not a distant lastSwing (risk '
     + (pl.entry - pl.stop).toFixed(1) + ')');
  ok(pl.t1 > pl.entry, 'T1 is beyond the named level');
}

console.log('\n== 2. continuation FVG/ORB entry is the setup, skipExact ==');
{
  ok(/skipExact:\s*true/.test(ROUTE), 'skipExact is on the continuation path');
  ok(/momentumOk:\s*!hgOmniIsReversion\(hit\.kind\)/.test(ROUTE),
     'momentum grant is continuation-only');
  const setup = LIVE - 850;
  const hit = { kind: 'ORB', dir: 'long', level: setup, why: 'held above ORB' };
  const pl = W.hgOmniPlanForHit(hit, ROWS, { livePx: LIVE });
  ok(!!pl, 'continuation still plans');
  ok(Math.abs(pl.entry - setup) < 1e-6, 'ENTRY is the ORB ' + setup.toFixed(2)
     + ', not live ' + LIVE.toFixed(2) + ' (got ' + (pl && +pl.entry) + ')');
  ok(Math.abs(pl.entry - LIVE) > 50, 'the plan did not silently chase the last print');
}

console.log('\n== 3. evaluate + card name the setup price ==');
{
  const lvl = Math.round(LIVE / 10) * 10;
  const hit = { kind: 'VALUE', dir: 'long', level: lvl, why: 't' };
  const cards = W.hgOmniEvaluate(ITEM, ROWS, null, { livePx: LIVE + 12, allHits: [hit] });
  /* evaluate runs detect internally — we also assert the planner + card source. */
  ok(/SETUP /.test(ROUTE) && /fmtPx\(c\.level\)/.test(ROUTE),
     'the card prints SETUP @ the detector level');
  const planned = W.hgOmniPlanForHit(hit, ROWS, { livePx: LIVE + 12 });
  ok(planned && Math.abs(planned.entry - lvl) < 1e-6,
     'evaluate\'s planner stamps the setup entry (got ' + (planned && planned.entry) + ')');
}

console.log('\n== 4. no setup level → live / last close, never an enricher hijack ==');
{
  const hit = { kind: 'ORB', dir: 'long', why: 'closed above ORB' };
  const pl = W.hgOmniPlanForHit(hit, ROWS, { livePx: LIVE });
  ok(pl == null || Math.abs(pl.entry - LIVE) < 1e-6,
     pl ? ('no setup level → live market is the honest proxy (got ' + pl.entry + ')')
        : 'no plan when structure cannot clear — not a hijacked EMA21');
}

console.log('\n== 5. counter-trend TREND hits do not vote against a with-trend setup ==');
{
  ok(typeof W.hgOmniConsensusVoters === 'function', 'voter filter is exported');
  const longs = [
    { kind: 'PO3', dir: 'long', level: LIVE, why: 't' },
    { kind: 'ORB', dir: 'long', level: LIVE, why: 't' }
  ];
  const shorts = [
    { kind: 'MMOVE', dir: 'short', level: LIVE, why: 't' },
    { kind: 'BOS-RETEST', dir: 'short', level: LIVE, why: 't' }
  ];
  const all = longs.concat(shorts);
  const voters = W.hgOmniConsensusVoters(all, ROWS, { htf: { e21: LIVE + 400, e50: LIVE } });
  const kinds = voters.map(h => h.kind + ':' + h.dir).sort().join(',');
  ok(!/MMOVE:short/.test(kinds) && !/BOS-RETEST:short/.test(kinds),
     'TREND shorts against a rising daily stack do not vote: ' + kinds);
  ok(/PO3:long/.test(kinds) && /ORB:long/.test(kinds), 'the with-trend continuation still votes');
  const g = (W.hgOmniGates(ROWS, longs[0], null, {
    allHits: all, htf: { e21: LIVE + 400, e50: LIVE }, minRr: 2,
    plan: { entry: LIVE, stop: LIVE * 0.99, t1: LIVE * 1.02 }
  }) || []).filter(x => x && x.key === 'consensus')[0];
  ok(g && g.pass === true, 'consensus PASSES for the with-trend long once rejected shorts stop voting (got '
     + (g && g.pass) + ' — ' + ((g && g.why) || '') + ')');
}

console.log('\n== 6. a genuine two-sided tape still vetoes — the gate is not gone ==');
{
  const all = [
    { kind: 'ORB', dir: 'long', level: LIVE, why: 't' },
    { kind: 'VALUE', dir: 'short', level: LIVE, why: 't' }
  ];
  const g = (W.hgOmniGates(ROWS, all[0], null, { allHits: all, minRr: 2 }) || [])
    .filter(x => x && x.key === 'consensus')[0];
  ok(g && (g.pass === false || /tie|favours|regime/i.test(String(g.why || ''))),
     'ORB long vs VALUE short is still judged, not silently dropped (pass='
     + (g && g.pass) + ' — ' + ((g && g.why) || '') + ')');
  ok(g.info !== true, 'consensus is still not an info gate');
}

console.log('\n== 7. OMNIPRESENT TRIGGERED still enters live, ARMED at the zone ==');
{
  ok(/status === 'TRIGGERED'\) \? livePx/.test(PRESENT)
     || /\(status === 'TRIGGERED'\) \? livePx/.test(PRESENT),
     'TRIGGERED entry is still the live print after rejection');
  ok(/ARMED is anticipation|ARMED — the zone is not yet swept/.test(PRESENT),
     'ARMED stays WATCH — not a ticket');
  ok(!/hgOmniPlanForHit/.test(PRESENT), 'OMNIPRESENT does not run through the OMNIROUTE planner');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIROUTE SETUP-LEVEL TESTS PASSED');
