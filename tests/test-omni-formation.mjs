/* HARDGATE — OMNIROUTE / OMNIPRESENT house formation on named setups.

   Contract:
     1. OMNIROUTE ENTRY stays hit.level after hgOmniFormTicket
     2. OMNIPRESENT TRIGGERED ENTRY stays livePx (not a POI snap)
     3. keepLevels stamps formationScore + fill without moving levels
     4. live refuse is a hard formation gate, levels still named
     5. both desks warm formation-live and print FORMATION on cards

   Run: node tests/test-omni-formation.mjs */
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
const FORM = read('formation.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','formation-live.js',
                   'omniroute.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

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

console.log('== source wiring ==');
{
  ok(/keepLevels/.test(FORM) && /hgFormKeepLevels/.test(FORM),
     'formation.js has keepLevels path');
  ok(/hgOmniFormTicket/.test(ROUTE) && /keepLevels:\s*true/.test(ROUTE),
     'omniroute calls hgFormTicket with keepLevels');
  ok(/opFormCandidate/.test(PRESENT) && /hgOmniFormTicket/.test(PRESENT),
     'omnipresent forms candidates through hgOmniFormTicket');
  ok(/warming live formation context/.test(ROUTE) && /warming live formation context/.test(PRESENT),
     'both desks warm formation-live');
  ok(/FORMATION/.test(ROUTE) && /FORMATION/.test(PRESENT),
     'both desks print FORMATION on cards');
}

console.log('\n== OMNIROUTE named setup survives formation ==');
const W = boot();
{
  ok(typeof W.hgOmniFormTicket === 'function', 'hgOmniFormTicket exported');
  ok(typeof W.hgFormKeepLevels === 'function', 'hgFormKeepLevels exported');
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const lvl = LIVE - 420;
  const hit = { kind: 'VALUE', dir: 'long', level: lvl, why: 'VAL reject' };
  const pl = W.hgOmniPlanForHit(hit, rows, { livePx: LIVE });
  ok(!!pl && Math.abs(pl.entry - lvl) < 1e-6, 'planner still tickets the named level');
  const formed = W.hgOmniFormTicket(pl, hit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(formed && formed.ok === true, 'formation accepts (' + ((formed && formed.reason) || 'ok') + ')');
  ok(Math.abs(formed.plan.entry - lvl) < 1e-6, 'formed ENTRY is still the VALUE level');
  ok(isFinite(+formed.plan.formationScore), 'formationScore stamped');
  ok(formed.plan.fillProb != null, 'fillProb stamped');
}

console.log('\n== live refuse is a hard gate, levels not invented ==');
{
  const rows = tape(180, 7, 50000);
  const LIVE = rows[rows.length - 1].c;
  const lvl = LIVE - 200;
  const hit = { kind: 'VALUE', dir: 'long', level: lvl, why: 't' };
  const pl = W.hgOmniPlanForHit(hit, rows, { livePx: LIVE });
  const origApply = W.hgLiveFormationApply;
  W.hgLiveFormationApply = function(){
    return { ok: false, reason: 'event blackout', tag: 'event' };
  };
  const formed = W.hgOmniFormTicket(pl, hit, rows, { livePx: LIVE, sym: 'ETHUSD' });
  W.hgLiveFormationApply = origApply;
  ok(formed && formed.ok === false, 'live refuse reports not-ok');
  ok(Math.abs(formed.plan.entry - lvl) < 1e-6, 'refused plan still has the named entry');
  const g = (W.hgOmniGates(rows, hit, null, {
    plan: formed.plan, formation: formed, minRr: 2
  }) || []).filter(x => x && x.key === 'formation')[0];
  ok(g && g.pass === false && g.hard === true, 'formation gate VETOES on live refuse');
}

console.log('\n== OMNIPRESENT TRIGGERED entry stays live ==');
{
  const live = 107.4;
  const cand = {
    dir: 'long', status: 'TRIGGERED',
    entry: live, stop: 106.2, t1: 109.8, t2: 112, rr1: 2, rr2: 5,
    atr: 0.4, zone: { lo: 106.5, hi: 107.1, confluence: 3, srcs: ['swing low'] },
    evidence: ['RSI divergence', 'volume climax'],
    trigger: 'close back', score: 40, sym: 'ETHUSD'
  };
  W.opFormCandidate(cand, tape(160, 3, 107), live);
  ok(Math.abs(cand.entry - live) < 1e-9, 'TRIGGERED entry is still livePx (got ' + cand.entry + ')');
  ok(Math.abs(cand.stop - 106.2) < 1e-9, 'zone stop is unchanged');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNI FORMATION TESTS PASSED');
