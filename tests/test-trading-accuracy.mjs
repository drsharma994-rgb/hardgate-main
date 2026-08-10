/* HARDGATE — trading accuracy pack: structure veto, FTS clearance, gold formation */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok — ' + m); } else { fail++; console.error('  FAIL — ' + m); } }

function loadCtx(){
  const ctx = {
    console, Math, JSON, Number, String, Boolean, Array, Object, isFinite, NaN, Date,
    setTimeout, clearTimeout, parseFloat,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'cryptogates.js']){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

function fixtureTape(){
  let s = 11279156;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const drift = 0.0025, vol = 0.02;
  const rows = [];
  let p = 100;
  for (let i = 0; i < 300; i++){
    const o = p;
    p = p * (1 + (rnd() - 0.5) * vol + drift);
    rows.push({ t: i * 14400, o,
      h: Math.max(o, p) * (1 + rnd() * vol * 0.4),
      l: Math.min(o, p) * (1 - rnd() * vol * 0.4),
      c: p, v: 1000 + rnd() * 500 });
  }
  return rows;
}

console.log('== structure + regime veto in swingGateMatrix ==');
{
  const W = loadCtx();
  W.hgStructureGate = function(){ return { veto: true, choch: true, note: 'CHoCH against long' }; };
  const m = W.swingGateMatrix(fixtureTape(), { fundingPct: 0.01 });
  ok(m && m.dir === null && m.structureVeto === true, 'structure CHoCH vetoes before gates run');
}

{
  const W = loadCtx();
  W.hgStructureGate = function(){ return { veto: false, bos: true }; };
  W.detectRegime = function(){ return { regime: 'compression', label: 'COMPRESSION' }; };
  const m = W.swingGateMatrix(fixtureTape(), { fundingPct: 0.01 });
  ok(m && m.dir === null && m.regimeVeto === true, 'compression regime vetoes cascade setups');
}

console.log('== FTS tightCount downgrade ==');
{
  const ss = fs.readFileSync(path.join(root, 'setup-stack.js'), 'utf8');
  const ctx = vm.createContext({ console, Math, JSON, String, Number, Boolean, Array, Object, isFinite, G: {} });
  ctx.window = ctx;
  vm.runInContext(ss, ctx);
  const cleanTight = ctx.hgSetupStack({ dir: 'long', clean: true, gatesPassed: 7, gatesTotal: 7, tightCount: 3,
    rows4h: [], macro: {}, agents: {}, atomic: {} });
  ok(cleanTight && cleanTight.tierHint === 'near', '3 tight binding gates downgrade clean -> near');
  const nearTight = ctx.hgSetupStack({ dir: 'long', nearClean: true, gatesPassed: 6, gatesTotal: 7, tightCount: 3,
    rows4h: [], macro: {}, agents: {}, atomic: {} });
  ok(nearTight && nearTight.tierHint === 'forming', '3 tight gates downgrade near -> forming');
}

console.log('== gold swing formation wiring ==');
{
  const gs = fs.readFileSync(path.join(root, 'goldswing.js'), 'utf8');
  ok(gs.indexOf("style: 'gold-swing'") >= 0 && gs.indexOf('hgFormTicket') >= 0, 'goldswing uses hgFormTicket');
  const iForm = gs.indexOf('var formFn = gfn(\'hgFormTicket\')');
  const iWk = gs.indexOf('hgApplyGoldWeekendDemotes');
  ok(iForm > iWk && gs.indexOf('for (var fi = 0; fi < ranked.length; fi++)', iForm) >= 0,
    'formation runs on all ranked candidates after weekend demotes');
}

console.log('== gold formation enriches strategy setups ==');
{
  const ctx = vm.createContext({ console, Math, JSON, Number, String, Boolean, Array, Object, isFinite, NaN, Date, parseFloat });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'formation.js'), 'utf8'), ctx, { filename: 'formation.js' });
  const rows = [{ t: 0, o: 100, h: 101, l: 99, c: 100, v: 1 }];
  for (let i = 1; i < 80; i++){
    rows.push({ t: i * 900, o: 100 + i * 0.1, h: 100 + i * 0.1 + 1, l: 100 + i * 0.1 - 0.5, c: 100 + i * 0.1, v: 100 });
  }
  const hit = { dir: 'long', entry: 108, stop: 106, t1: 111, t2: 113, rr: 1.5, stratKey: 'ob', agree: 4, grade: 'B' };
  const r = ctx.hgFormTicket(hit, { rows: rows, style: 'gold-scalp', a4: 2 });
  ok(r && r.ok && r.hit && r.hit.entry === 108 && r.hit.stop === 106 && r.hit.t1 === 111,
    'gold-scalp formation keeps strategy entry/stop/t1 when price is in zone');
  ok(r.hit && r.hit.poi === 'fvg' && isFinite(r.formationScore),
    'gold formation stamps POI from stratKey and computes formation score');
}

console.log('== gold formation preserves strategy levels ==');
{
  const ctx = vm.createContext({ console, Math, JSON, Number, String, Boolean, Array, Object, isFinite, NaN, Date, parseFloat });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'formation.js'), 'utf8'), ctx, { filename: 'formation.js' });
  const rows = [{ t: 0, o: 100, h: 101, l: 99, c: 100, v: 1 }];
  for (let i = 1; i < 80; i++){
    rows.push({ t: i * 900, o: 100 + i * 0.1, h: 100 + i * 0.1 + 1, l: 100 + i * 0.1 - 0.5, c: 100 + i * 0.1, v: 100 });
  }
  const hit = { dir: 'long', entry: 108, stop: 106, t1: 111, t2: 113, rr: 1.5 };
  const r = ctx.hgFormTicket(hit, { rows: rows, style: 'gold-scalp', a4: 2 });
  ok(r && r.ok && r.hit && r.hit.entry === 108 && r.hit.stop === 106 && r.hit.t1 === 111,
    'gold-scalp formation keeps goldind strategy entry/stop/t1 verbatim');
}

ok(/hgStructureGate/.test(fs.readFileSync(path.join(root, 'cryptogates.js'), 'utf8')), 'cryptogates calls hgStructureGate');
ok(/tightCount/.test(fs.readFileSync(path.join(root, 'setup-stack.js'), 'utf8')), 'setup-stack reads tightCount');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
