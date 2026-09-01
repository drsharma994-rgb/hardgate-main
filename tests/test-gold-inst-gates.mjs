/* HARDGATE — GOLD SCALP / GOLD SWING institutional filters.

   Execution TF is the desk's real tape (15m scalp, 4h swing) — not M1/M5.
   Stops stay a 1.5×ATR14 FLOOR (structure may widen). Missing DXY/TNX
   fail-open. Sweep-only without MSS+displacement+imbalance is rejected.

   Run: node tests/test-gold-inst-gates.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

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
  for (const f of ['indicators.js','indicators2.js','goldind.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function bars(n, start, step, seed){
  const out = []; let p = start, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.002);
    const r = p * 0.0015 * (0.4 + rnd());
    out.push({ t: 1700000000 + i * step, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 800 + rnd() * 200 });
  }
  return out;
}

function emaRows(n, start, drift, step){
  const out = []; let p = start;
  for (let i = 0; i < n; i++){
    const o = p; p = p + drift;
    out.push({ t: 1700000000 + i * step, o: o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p, v: 1000 });
  }
  return out;
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgGoldDisplacementBar === 'function', 'hgGoldDisplacementBar exported');
  ok(typeof W.hgGoldIfvg === 'function', 'hgGoldIfvg exported');
  ok(typeof W.hgGoldSweepConfirmed === 'function', 'hgGoldSweepConfirmed exported');
  ok(typeof W.hgGoldObVolumeOk === 'function', 'hgGoldObVolumeOk exported');
  ok(typeof W.hgGoldMacroLock === 'function', 'hgGoldMacroLock exported');
  ok(typeof W.hgGoldSessionGate === 'function', 'hgGoldSessionGate exported');
  ok(typeof W.hgGoldInstFilter === 'function', 'hgGoldInstFilter exported');
}

console.log('\n== volume-weighted OB: trap vs real displacement ==');
{
  const W = boot();
  const rows = bars(40, 2400, 900, 3);
  const i = rows.length - 1;
  rows[i].v = 400;
  for (let k = i - 5; k < i; k++) rows[k].v = 2000;
  const trap = W.hgGoldObVolumeOk(rows, i);
  ok(trap.ok === false, 'displacement vol below 5-bar average is a trap (got ' + trap.reason + ')');

  rows[i].v = 5000;
  const real = W.hgGoldObVolumeOk(rows, i);
  ok(real.ok === true, 'displacement vol above 5-bar average is accepted');
}

console.log('\n== macro conviction lock: DXY+TNX above EMA50 kills gold longs ==');
{
  const W = boot();
  const up = emaRows(80, 100, 0.15, 86400);
  const down = emaRows(80, 100, -0.15, 86400);
  const longLock = W.hgGoldMacroLock('long', { dxyRows: up, tnxRows: up });
  ok(longLock.lock === true && /CONVICTION LOCK/i.test(longLock.reason),
     'long + both above 50 EMA → lock (' + longLock.reason + ')');
  const shortOk = W.hgGoldMacroLock('short', { dxyRows: up, tnxRows: up });
  ok(shortOk.lock === false, 'short is not killed by a strong dollar/yield tape');
  const mixed = W.hgGoldMacroLock('long', { dxyRows: up, tnxRows: down });
  ok(mixed.lock === false, 'only one of DXY/TNX bullish does not lock');
  const missing = W.hgGoldMacroLock('long', {});
  ok(missing.lock === false && missing.unchecked === true, 'missing DXY/TNX fail-open');
}

console.log('\n== session: Asia blocked unless violent AH/AL sweep; London 08:00 + NY overlap weighted ==');
{
  const W = boot();
  const asia = Date.UTC(2024, 0, 16, 3, 0, 0);
  const lonOpen = Date.UTC(2024, 0, 16, 8, 5, 0);
  const ny12 = Date.UTC(2024, 0, 16, 12, 30, 0);
  const rows = bars(80, 2400, 900, 9);
  const blocked = W.hgGoldSessionGate(asia, rows, 'vwap');
  ok(blocked.ok === false && /ASIA BLOCK/i.test(blocked.reason),
     'standard Asia execution is blocked (' + blocked.reason + ')');
  const asianOk = W.hgGoldSessionGate(asia, rows, 'asian');
  ok(asianOk.ok === true, 'Asian-range strategy is allowed in its own window');
  const lo = W.hgGoldSessionGate(lonOpen, rows, 'ob');
  ok(lo.ok === true && lo.weight >= 3, 'London 08:00 GMT is priority-weighted (got ' + lo.weight + ')');
  const ny = W.hgGoldSessionGate(ny12, rows, 'ob');
  ok(ny.ok === true && ny.weight >= 3, 'NY overlap 12:00–16:00 GMT is priority-weighted (got ' + ny.weight + ')');
}

console.log('\n== ATR floor is 1.5×, never a cap ==');
{
  const W = boot();
  ok(typeof W.goldScalpLevels === 'function', 'scalp level builder exported');
  const lv = W.goldScalpLevels('long', 2400, 10, 2400 - 10 * 2.4, []);
  const risk = Math.abs(2400 - lv.stop);
  ok(risk >= 15 - 1e-9, 'stop is at least the 1.5×ATR floor (got ' + (risk / 10).toFixed(2) + '×)');
  ok(risk > 15 + 1e-6, 'structure wider than 1.5×ATR is allowed to widen (got ' + (risk / 10).toFixed(2) + '×)');
  ok(risk <= 35 + 1e-9, 'sanity ceiling still 3.5×ATR, not a 1.5× cap');
}

console.log('\n== inst filter: sweep without confirmation is rejected; OB trap rejected ==');
{
  const W = boot();
  const rows = bars(80, 2400, 900, 4);
  const sweepOnly = W.hgGoldInstFilter(
    { stratKey: 'sweep', dir: 'long', id: 'sweep|long|2400', strategy: 'SWEEP', stamps: [], gateNotes: [] },
    { rows: rows, nowMs: Date.UTC(2024, 0, 16, 14, 0, 0), scalp: true }
  );
  ok(sweepOnly && sweepOnly.dropped === true && /SWEEP BLOCK|MSS|IFVG/i.test(sweepOnly.reason),
     'sweep-only without MSS+IFVG is rejected (' + ((sweepOnly && sweepOnly.reason) || '') + ')');

  const trapRows = (function(){
    const r = bars(40, 2400, 900, 2);
    r[r.length - 1].v = 50;
    for (let i = r.length - 6; i < r.length - 1; i++) r[i].v = 3000;
    return r;
  })();
  const trapOb = W.hgGoldInstFilter(
    { stratKey: 'ob', dir: 'long', id: 'ob|long|2400', strategy: 'OB', stamps: [], gateNotes: [],
      obImpulseIndex: trapRows.length - 1 },
    { rows: trapRows, nowMs: Date.UTC(2024, 0, 16, 14, 0, 0), scalp: true }
  );
  ok(trapOb && trapOb.dropped === true && /OB TRAP/i.test(trapOb.reason),
     'thin-volume displacement OB is discarded (' + ((trapOb && trapOb.reason) || '') + ')');
}

console.log('\n== version + no guaranteed-win copy ==');
{
  const src = read('goldind.js');
  ok(!/surely win|guaranteed win|will surely/i.test(src), 'goldind never promises a sure win');
  ok(/^hg-v\d+$/.test(HG_VER), 'build stamp is hg-vN (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js matches build-stamp');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GOLD INSTITUTIONAL GATE TESTS PASSED');
