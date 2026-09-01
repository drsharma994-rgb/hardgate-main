/* HARDGATE — OMNIGOLD intelligent gold formation (hgOgFormTicket).

   Native detector tickets stay the mechanic: ENTRY is hit.level (ROUND /
   FVG / Asia). Formation then uses gold maths on the REST of the ticket:

     STOP  widen-only via structure, then re-clip at 2.5% of gold.
           Never tighten. Never a 1000-pt lastSwing.
     T1    OG_T1_R of the formed stop (walk-forward measures there). First
           gold magnet beyond that print is named on the card; T2 may sit
           on a magnet. Never a nowhere-print that disagrees with the pool.
     TYPE  MARKET when live is inside 0.25×ATR of the named entry; else LIMIT.
     SCORE conviction 0–100. Cost / thin fill / weekend DEMOTE. Never refuse
           a placeable plan (that is hgOgFormation's job).

   Must not send native tickets through hgApplyGoldBestLevels (that hijacks
   ROUND-MAGNET / FVG-FILL — the v423 gold defect) or generic hgFormTicket
   gold-style (hgFormGoldEnrich can move entry).

   Run: node tests/test-omnigold-formation.mjs */
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
                   'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function tape(n, seed, start){
  const out = []; let p = start || 4530, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.0018);
    const r = p * 0.0012 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return out;
}

const W = boot();
const CFG = { minRr: 1.5, label: 'SCALP', sessionHard: true };
const GOLD_STOP_MAX_PCT = 0.025;
const OG_T1_R = 2;

function formSlice(){
  const a = GOLD.indexOf('function hgOgFormTicket');
  const b = GOLD.indexOf('function hgOgEvaluate');
  return (a >= 0 && b > a) ? GOLD.slice(a, b) : '';
}

console.log('== source contract: gold-native, not a hijack ==');
{
  ok(/function hgOgFormTicket/.test(GOLD), 'hgOgFormTicket is declared');
  ok(/window\.hgOgFormTicket\s*=\s*hgOgFormTicket/.test(GOLD), 'hgOgFormTicket is exported');
  const slice = formSlice();
  ok(slice.length > 200, 'hgOgFormTicket sits before hgOgEvaluate');
  ok(!/hgApplyGoldBestLevels\s*\(/.test(slice),
     'native form does not call hgApplyGoldBestLevels (v423 ROUND-MAGNET hijack)');
  ok(!/hgFormTicket\s*\(/.test(slice) && !/hgFormGoldEnrich\s*\(/.test(slice),
     'native form does not call generic hgFormTicket / hgFormGoldEnrich');
  ok(/hgOgPlanForHit/.test(GOLD) && /hgOgFormTicket\(plan/.test(GOLD),
     'evaluate forms AFTER hgOgPlanForHit (named entry already priced)');
  ok(/og-form-line/.test(GOLD), 'native cards print a formation line');
  ok(/formationScore/.test(GOLD), 'conviction score is stamped for hgOmniRank');
}

console.log('\n== 1. ROUND-MAGNET ENTRY stays the round after formation ==');
const ROWS = tape(400, 9, 4500);
{
  const lvl = 4530;
  const rows = ROWS.map((r, i) => i < ROWS.length - 1 ? r : {
    t: r.t, o: 4532, h: 4536, l: 4526.4, c: 4534.9, v: 1200
  });
  const live = rows[rows.length - 1].c;
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl,
                why: 'reclaimed the $4530 round level from below' };
  ok(typeof W.hgOgFormTicket === 'function', 'hgOgFormTicket is on the window');
  const pl = W.hgOgPlanForHit(hit, rows, { livePx: live }, CFG);
  ok(!!pl, 'base plan exists');
  const formed = W.hgOgFormTicket(pl, hit, rows, {
    livePx: live, adr: W.hgOgAdr ? W.hgOgAdr(rows, 14) : null,
    killzone: { zone: 'london', label: 'London' }
  }, CFG);
  ok(!!formed, 'formation returns a plan (never empties a placeable ticket)');
  ok(Math.abs(formed.entry - lvl) < 1e-6,
     'ENTRY is still the round ' + lvl + ' (got ' + formed.entry + ')');
  const stop0 = pl.stop;
  const tighter = formed.stop > stop0 + 1e-9;
  ok(!tighter, 'long STOP never tighter than the setup-level stop (was '
     + stop0 + ', now ' + formed.stop + ')');
  const riskPct = Math.abs(formed.entry - formed.stop) / formed.entry;
  ok(riskPct <= GOLD_STOP_MAX_PCT + 1e-9,
     'STOP still inside 2.5% of gold (got ' + (riskPct * 100).toFixed(2) + '%)');
  const risk = Math.abs(formed.entry - formed.stop);
  const t1R = Math.abs(formed.t1 - formed.entry) / risk;
  ok(t1R + 1e-6 >= OG_T1_R, 'T1 still clears OG_T1_R=2 (got ' + t1R.toFixed(2) + 'R)');
  ok(formed.t1 > formed.entry, 'long T1 is above entry');
  ok(isFinite(formed.formationScore) && formed.formationScore >= 0
     && formed.formationScore <= 100,
     'conviction score is 0–100 (got ' + formed.formationScore + ')');
  ok(/MARKET|LIMIT/.test(String(formed.entryType || '')),
     'entryType is MARKET or LIMIT (got ' + formed.entryType + ')');
}

console.log('\n== 2. T1 stays at OG_T1_R; gold magnets are named beyond it ==');
{
  const lvl = 4530;
  const rows = tape(200, 4, 4520);
  rows[rows.length - 1] = { t: rows[rows.length - 1].t, o: 4531, h: 4534, l: 4527, c: 4532, v: 1100 };
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl, why: 'round' };
  const extra = { livePx: 4532, adr: { adr: 40, todayHi: 4560, todayLo: 4490, usedPct: 70 } };
  const pl = W.hgOgPlanForHit(hit, rows, extra, CFG);
  const formed = W.hgOgFormTicket(Object.assign({}, pl), hit, rows, extra, CFG);
  const risk = Math.abs(formed.entry - formed.stop);
  const t1R = Math.abs(formed.t1 - formed.entry) / risk;
  ok(Math.abs(t1R - OG_T1_R) < 0.02, 'T1 sits at OG_T1_R of formed risk (got ' + t1R.toFixed(3) + 'R)');
  ok(formed.t1Source && formed.t1Source !== 'unnamed',
     'T1 names its source (got ' + formed.t1Source + ')');
  ok(formed.t1Magnet || /toward|ROUND|ADR|week|prior|R-multiple/i.test(String(formed.t1Source)),
     'a gold magnet is named beyond T1 or the source is honest R-multiple (got '
     + formed.t1Source + (formed.t1Magnet ? ' magnet=' + formed.t1Magnet : '') + ')');
}

console.log('\n== 3. far LIMIT demotes conviction, does not refuse ==');
{
  const lvl = 4400;
  const rows = tape(180, 7, 4500);
  const live = rows[rows.length - 1].c;
  const hit = { kind: 'FVG-FILL', dir: 'long', level: lvl, why: 'fvg below' };
  const pl = W.hgOgPlanForHit(hit, rows, { livePx: live }, CFG);
  ok(!!pl, 'distant FVG still has a plan');
  const formed = W.hgOgFormTicket(Object.assign({}, pl), hit, rows, { livePx: live }, CFG);
  ok(!!formed && isFinite(formed.entry), 'formation does not refuse a distant LIMIT');
  ok(Math.abs(formed.entry - lvl) < 1e-6, 'ENTRY stays the FVG at ' + lvl);
  ok(/LIMIT/i.test(String(formed.entryType || '')),
     'far from live → LIMIT (got ' + formed.entryType + ')');
  ok(formed.fillDemote === true || formed.formationScore < 70,
     'thin fill demotes score (score=' + formed.formationScore + ', fillDemote=' + formed.fillDemote + ')');
}

console.log('\n== 4. evaluate stamps formationScore and keeps named ENTRY ==');
{
  const lvl = 4530;
  const rows = tape(220, 11, 4510);
  rows[rows.length - 1] = { t: rows[rows.length - 1].t, o: 4532, h: 4537, l: 4526, c: 4535, v: 1000 };
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl, why: 'round' };
  const extra = { livePx: 4535, nowSec: 1700000000 + 219 * 3600,
                  killzone: { zone: 'london', label: 'London' } };
  const cands = W.hgOgEvaluate(rows, [hit], extra, CFG);
  ok(cands && cands.length === 1, 'evaluate returns the hit');
  const c = cands[0];
  ok(c.plan && Math.abs(c.plan.entry - lvl) < 1e-6,
     'evaluated plan ENTRY is still the round');
  ok(isFinite(c.formationScore) || (c.plan && isFinite(c.plan.formationScore)),
     'candidate carries formationScore for hgOmniRank');
  ok(c.formation && typeof c.formation.formed === 'boolean',
     'hgOgFormation verdict still runs after geometry is formed');
}

console.log('\n== 5. cost demote never deletes the plan ==');
{
  const lvl = 4530;
  const rows = tape(160, 2, 4530);
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl, why: 'round' };
  const pl = W.hgOgPlanForHit(hit, rows, { livePx: 4534 }, CFG);
  const tight = Object.assign({}, pl, { stop: lvl - 0.4, t1: lvl + 0.8, t2: lvl + 1.4 });
  const formed = W.hgOgFormTicket(tight, hit, rows, { livePx: 4534 }, CFG);
  ok(!!formed && isFinite(formed.entry) && isFinite(formed.stop) && isFinite(formed.t1),
     'a tight-stop plan is formed, not emptied (cost is a demote)');
  ok(formed.costDemote === true || isFinite(formed.formationScore),
     'cost path stamps a demote or still scores (score=' + formed.formationScore + ')');
}

console.log('\n== 6. SHORT clip + never-tighten ==');
{
  const lvl = 4540;
  const rows = tape(180, 8, 4545);
  const last = rows[rows.length - 1];
  rows[rows.length - 1] = { t: last.t, o: 4538, h: 4546.2, l: 4535, c: 4537, v: 900 };
  const hit = { kind: 'ROUND-MAGNET', dir: 'short', level: lvl, why: 'rejected the round' };
  const pl = W.hgOgPlanForHit(hit, rows, { livePx: 4537 }, CFG);
  ok(!!pl, 'short round has a plan');
  const stop0 = pl.stop;
  const formed = W.hgOgFormTicket(Object.assign({}, pl), hit, rows, { livePx: 4537 }, CFG);
  ok(Math.abs(formed.entry - lvl) < 1e-6, 'short ENTRY stays the round');
  ok(!(formed.stop < stop0 - 1e-9),
     'short STOP never tighter (was ' + stop0 + ', now ' + formed.stop + ')');
  const riskPct = Math.abs(formed.entry - formed.stop) / formed.entry;
  ok(riskPct <= GOLD_STOP_MAX_PCT + 1e-9, 'short STOP still ≤ 2.5% of gold');
  ok(formed.t1 < formed.entry, 'short T1 is below entry');
}

console.log('\n' + passed + ' assertions passed');
