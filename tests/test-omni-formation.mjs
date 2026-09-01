/* HARDGATE — OMNIROUTE / OMNIPRESENT intelligent house formation.

   Contract:
     1. OMNIROUTE ENTRY stays hit.level after hgOmniFormTicket
     2. OMNIPRESENT TRIGGERED ENTRY stays livePx (not a POI snap)
     3. STOP never tighter than the named / zone invalidation
     4. T1/T2 may snap to structure when they still clear min R:R
     5. live refuse is a hard formation gate; thin LIMIT fill demotes, does not veto
     6. both desks warm formation-live, print FORMATION, rank by score

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
  ok(/formationScore/.test(ROUTE.slice(ROUTE.indexOf('function hgOmniRank'))),
     'hgOmniRank reads formationScore');
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
  ok(isFinite(+formed.plan.stop) && formed.plan.stop < formed.plan.entry,
     'formed STOP is still a long invalidation');
  ok(formed.plan.stop <= pl.stop + 1e-9, 'STOP never tighter than the planner');
  ok(isFinite(+formed.plan.t1) && formed.plan.t1 > formed.plan.entry, 'T1 is beyond entry');
  ok(isFinite(+formed.plan.rr1) && formed.plan.rr1 >= 2 - 1e-6, 'formed R:R still clears 2R');
  ok(/MARKET|LIMIT/.test(String(formed.plan.entryType || '')), 'entryType stamped');
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
  ok(Math.abs(cand.stop - 106.2) < 1e-9, 'zone stop stays squeezed (OMNIPRESENT invalidation)');
  ok(/MARKET/.test(String(cand.entryType || '')), 'TRIGGERED stamps MARKET');
  ok(isFinite(+cand.formationScore), 'OMNIPRESENT stamps formationScore');
}

console.log('\n== keepLevels never tightens a named stop ==');
{
  const rows = tape(180, 11, 60000);
  const mark = rows[rows.length - 1].c;
  const hit = { dir: 'long', entry: mark, stop: mark - mark * 0.08, t1: mark + mark * 0.16,
    t2: mark + mark * 0.24, rr: 2, mark: mark, planSrc: 'hgOmniPlanForHit', kind: 'VALUE' };
  const fm = W.hgFormTicket(hit, { rows, style: 'swing', a4: mark * 0.01, keepLevels: true });
  ok(fm.ok === true, 'wide named stop is accepted (' + ((fm && fm.reason) || 'ok') + ')');
  ok(Math.abs(fm.hit.entry - mark) < 1e-9, 'ENTRY locked on tighten-guard tape');
  ok(fm.hit.stop <= hit.stop + 1e-6, 'structure may widen, never pull the stop in');
}

console.log('\n== cost final-gate demotes, does not empty a VALUE ticket ==');
{
  const rows = tape(180, 11, 60000);
  const mark = rows[rows.length - 1].c;
  const hit = { dir: 'long', entry: mark - 200, stop: mark - 240, t1: mark + 200,
    t2: mark + 400, rr: 2, mark: mark, planSrc: 'hgOmniPlanForHit', kind: 'VALUE' };
  const orig = W.hgTicketFinalGates;
  W.hgTicketFinalGates = function(){
    return { ok: false, tag: 'cost', reason: 'VETO — cost 22 bps = 51% of a 43 bps R', chips: ['cost'] };
  };
  const fm = W.hgFormTicket(hit, { rows, style: 'swing', a4: mark * 0.01, keepLevels: true });
  W.hgTicketFinalGates = orig;
  ok(fm.ok === true, 'cost veto is a demote, not a refuse (' + ((fm && fm.reason) || 'ok') + ')');
  ok(Math.abs(fm.hit.entry - hit.entry) < 1e-9, 'ENTRY still locked after cost demote');
  ok(/cost/i.test(String(fm.hit.finalGateDemote || '')), 'cost reason is stamped on the plan');
}

console.log('\n== rank prefers higher formationScore after evidence ==');
{
  const ranked = W.hgOmniRank([
    { base: 'A', grade: { ticket: true, evaluated: 10 }, consensus: { nAgree: 2 }, rr: 2, formationScore: 12 },
    { base: 'B', grade: { ticket: true, evaluated: 10 }, consensus: { nAgree: 2 }, rr: 2, formationScore: 28 }
  ]);
  ok(ranked[0].base === 'B' && ranked[1].base === 'A',
     'higher formationScore ranks first (got ' + ranked.map(r => r.base).join('') + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNI FORMATION TESTS PASSED');
