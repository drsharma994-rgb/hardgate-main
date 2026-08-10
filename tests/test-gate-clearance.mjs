/* HARDGATE — gate clearance: HOW a setup passed, not just THAT it passed.
   Two measurements drove this, both on the live gate code:
   1) G3 and ANCHOR block NOTHING the other six do not already block. Across
      20,910 aligned cascades the CLEAN count is 27 with all eight gates, 27
      with G3 dropped, 27 with ANCHOR dropped, and 27 with BOTH dropped. G6's
      risk cap already forces price to sit near structure, so "RSI not
      extended" and "price near EMA21" are CONSEQUENCES of G6, not independent
      confirmations. They stay visible but are flagged `implied` and kept out
      of the binding count.
   2) Among setups that DO go 7/7 + anchor, 58% scrape at least one binding
      gate, and G6 is the scraped one in 49% of them — half of all CLEAN
      setups have an R:R that only just clears the floor. The badge renders
      those identically to a setup that cleared everything with room.
   Run: node tests/test-gate-clearance.mjs                                    */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'cryptogates.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
ctx.hgStructureGate = () => ({ veto: false, bos: true });
ctx.detectRegime = () => ({ regime: 'trend', label: 'trend' });

function tape(seed){
  let s = seed;
  const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const out = []; let p = 100;
  for (let i = 0; i < 300; i++){
    const o = p; p = p * (1 + (r() - 0.5) * 0.02 + 0.0025);
    out.push({ t: i * 14400, o, h: Math.max(o, p) * (1 + r() * 0.008),
               l: Math.min(o, p) * (1 - r() * 0.008), c: p, v: 1000 + r() * 500 });
  }
  return out;
}
const T = { symbol: 'TESTUSD', fundingPct: 0.005 };

console.log('== every gate reports its distance to its own threshold ==');
{
  const m = ctx.swingGateMatrix(tape(11279156), T);
  ok(m && m.dir, 'fixture reads a direction');
  ok(Array.isArray(m.margins) && m.margins.length === 8, 'eight margins, one per gate + anchor');
  const names = m.margins.map(x => x.gate);
  ['G1','G2','G3','G4','G5','G6','ANCHOR'].forEach(g =>
    ok(names.indexOf(g) >= 0, g + ' has a margin entry'));
  m.margins.forEach(x => {
    ok(typeof x.unit === 'string' && x.unit.length > 3, x.gate + ' names its unit: ' + x.unit);
  });
}

console.log('== implied gates are excluded from the binding count ==');
{
  const m = ctx.swingGateMatrix(tape(11279156), T);
  const implied = m.margins.filter(x => x.implied).map(x => x.gate).sort();
  ok(implied.join(',') === 'ANCHOR,G3', 'G3 and ANCHOR are the implied pair, measured at 0 unique blocks');
  ok(m.bindingTotal === 6, 'binding total is 6, not 8 — the badge no longer overstates independence');
  ok(m.margins.length === 8, 'but both stay VISIBLE — an implied fact is still worth seeing');
  ok(m.tightGates.every(g => implied.indexOf(g) < 0), 'an implied gate can never be counted as tight');
}

console.log('== margins carry the right sign and unit ==');
{
  const m = ctx.swingGateMatrix(tape(11279156), T);
  const by = {}; m.margins.forEach(x => { by[x.gate] = x; });
  ok(by.G6.margin !== null, 'G6 margin is computed');
  ok(Math.abs((m.dynamicRR - by.G6.margin) - 2.0) < 1e-9,
     'G6 margin is dynamicRR minus the 2.0R floor, exactly');
  const anchorRoom = 1.5 - Math.abs(m.p - m.e21) / m.a4;
  ok(Math.abs(by.ANCHOR.margin - anchorRoom) < 1e-9, 'ANCHOR margin is room left before the cap');
  ok(by.G6.ok === (by.G6.margin >= 0), 'a non-negative margin means the gate passed');
  ok(by.G1.ok === (by.G1.margin >= 0), 'and the same holds for G1');
}

console.log('== a scraped gate is flagged, a comfortable one is not ==');
{
  let tightSeen = false, roomySeen = false;
  for (let s = 1; s <= 4000 && !(tightSeen && roomySeen); s++){
    const m = ctx.swingGateMatrix(tape(s * 7919), T);
    if (!m || !m.dir) continue;
    const g6 = m.margins.filter(x => x.gate === 'G6')[0];
    if (!g6.ok) continue;
    if (m.dynamicRR < 2.2 && !tightSeen){ tightSeen = true; ok(g6.tight === true, 'dynamicRR ' + m.dynamicRR.toFixed(3) + ' (< 2.2) is flagged tight'); }
    if (m.dynamicRR > 3.0 && !roomySeen){ roomySeen = true; ok(g6.tight === false, 'dynamicRR ' + m.dynamicRR.toFixed(3) + ' (> 3.0) is NOT flagged'); }
  }
  ok(tightSeen && roomySeen, 'both cases exist in the sample — the flag discriminates');
}

console.log('== the line degrades to silence, never to a fake all-clear ==');
{
  ok(typeof ctx.cgClearanceLine === 'function', 'cgClearanceLine is exported');
  ok(ctx.cgClearanceLine(null) === '', 'null ticket -> empty string');
  ok(ctx.cgClearanceLine({}) === '', 'a ticket with no margins -> empty string, NOT "all clear"');
  ok(ctx.cgClearanceLine({ margins: [] }) === '', 'an empty margin list -> empty string');
  const roomy = ctx.cgClearanceLine({ margins: [{}], bindingTotal: 6, tightCount: 0, tightGates: [] });
  ok(/all 6 binding gates cleared with room/.test(roomy), 'zero tight reads as a clean clearance');
  const thin = ctx.cgClearanceLine({ margins: [{}], bindingTotal: 6, tightCount: 2, tightGates: ['G6','G1'] });
  ok(/2 of 6/.test(thin) && /G6, G1/.test(thin), 'tight gates are named, not just counted');
  ok(/Same badge, thinner setup/.test(thin), 'and the consequence is spelled out');
}

console.log('== clearance travels with the ticket ==');
{
  let hit = null;
  for (let s = 1; s <= 8000 && !hit; s++) hit = ctx.swingTryClean(tape(s * 7919), T);
  ok(hit, 'a CLEAN ticket was produced');
  ok(Array.isArray(hit.margins) && hit.margins.length === 8, 'the ticket carries all eight margins');
  ok(hit.bindingTotal === 6, 'and the binding total');
  ok(typeof hit.tightCount === 'number', 'and the tight count');
  ok(ctx.cgClearanceLine(hit) !== '', 'so the line renders from the ticket alone: ' + ctx.cgClearanceLine(hit));
}

console.log('\n' + passed + ' passed, 0 failed');
