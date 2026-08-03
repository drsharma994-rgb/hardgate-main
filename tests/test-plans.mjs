/* HARDGATE — plans.js unit tests. Run: node tests/test-plans.mjs */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};
for (const f of ['indicators.js', 'cryptogates.js', 'plans.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function mkRows(n, lastClose){
  var rows = [];
  for (var i = 0; i < n; i++){
    var c = lastClose - 0.1 * (n - 1 - i);
    rows.push({ t: i * 14400, o: c, h: c + 0.5, l: c - 0.5, c: c, v: 1000 });
  }
  return rows;
}

console.log('== plans exports ==');
assert(typeof W.hgStructureStop === 'function', 'hgStructureStop');
assert(typeof W.hgPlanFromRisk === 'function', 'hgPlanFromRisk');
assert(typeof W.hgPlanLevelsCore === 'function', 'hgPlanLevelsCore');
assert(typeof W.hgDetectLiquiditySweep === 'function', 'hgDetectLiquiditySweep');
assert(typeof W.hgConfirmedCascade === 'function', 'hgConfirmedCascade');
assert(typeof W.hgRegimeAllowsSetup === 'function', 'hgRegimeAllowsSetup');
assert(typeof W.hgSwingParity === 'function', 'hgSwingParity');
assert(typeof W.hgPlanSwingTargets === 'function', 'hgPlanSwingTargets');
assert(typeof W.hgEnrichSwingClean === 'function', 'hgEnrichSwingClean');
assert(typeof W.hgApplyExactEntry === 'function', 'hgApplyExactEntry');
assert(typeof W.hgPlanMeta === 'function', 'hgPlanMeta');

console.log('== structure stop ==');
{
  var rows = mkRows(80, 110);
  var st = W.hgStructureStop('long', 110, rows, {});
  assert(st && st.stop < 110 && st.risk > 0, 'long structure stop below entry');
}

console.log('== plan from risk ==');
{
  var p = W.hgPlanFromRisk('long', 100, 97, { t1R: 2, t2R: 3.5, minRr: 2 });
  assert(p && p.rr1 >= 2 && p.t1 > 100, '2R min long plan');
}

console.log('== confirmed cascade ==');
{
  var rows = mkRows(80, 110);
  var sw = W.hgConfirmedCascade(rows, 'swing');
  assert(sw && typeof sw.confirmed === 'boolean', 'swing cascade shape');
  var sm = W.hgConfirmedCascade(rows, 'smart');
  assert(sm && typeof sm.confirmed === 'boolean', 'smart cascade shape');
}

console.log('== liquidity sweep ==');
{
  var rows = mkRows(30, 100);
  var n = rows.length;
  rows[n - 3].l = 95;
  rows[n - 3].o = 95.5;
  rows[n - 3].c = 96;
  rows[n - 2].c = 98;
  rows[n - 1].o = 97;
  rows[n - 1].c = 99;
  var priorLo = 97;
  var atrArr = rows.map(function(){ return 1; });
  var A = { rows: rows, lows: rows.map(function(r){ return r.l; }), highs: rows.map(function(r){ return r.h; }),
            closes: rows.map(function(r){ return r.c; }), atr: atrArr };
  var sq = W.hgDetectLiquiditySweep(A, n - 1, 'long', priorLo);
  assert(sq && sq.swept === true, 'displacement reclaim detects sweep');
  rows[n - 2].o = 97.95;
  rows[n - 2].c = 98;
  rows[n - 1].o = 98.95;
  rows[n - 1].c = 99;
  sq = W.hgDetectLiquiditySweep(A, n - 1, 'long', priorLo);
  assert(sq === null, 'weak reclaim body rejected without displacement');
}

console.log('== swing parity ==');
{
  var bull = mkRows(260, 120);
  for (var i = 0; i < bull.length; i++){ bull[i].c += i * 0.08; bull[i].h = bull[i].c + 0.4; bull[i].l = bull[i].c - 0.4; }
  var sp = W.hgSwingParity(bull, null, 'long');
  assert(sp === null || typeof sp.aligned === 'boolean', 'swing parity shape');
}

console.log('== unified swing targets ==');
{
  var tg = W.hgPlanSwingTargets('long', 100, 97, 2, {});
  assert(tg && tg.t1 > 100 && tg.t2 > tg.t1, 'long unified targets above entry');
  assert(tg.targetPolicy && tg.targetPolicy.indexOf('unified') >= 0, 'target policy label');
  assert(tg.rr1 >= 2, 'floor R:R on t1');
}

console.log('== enrich swing clean ==');
{
  var hit = { dir: 'long', entry: 110, stop: 107, t1: 116, t2: 120, rr: 2, mark: 105 };
  var rows = mkRows(80, 110);
  var enriched = W.hgEnrichSwingClean(hit, rows, { e21: 108, e9: 109, a4: 2, p: 105 });
  assert(enriched && enriched.entryType && enriched.targetPolicy, 'enriched hit carries entry + target metadata');
  assert(enriched.t1 > hit.t1 || enriched.rr >= hit.rr, 'unified targets applied');
}

console.log('== apply exact entry ==');
{
  var plan = { dir: 'long', type: 'SWING', entry: 110, stop: 107, t1: 116, t2: 120 };
  var rows = mkRows(80, 110);
  var exact = W.hgApplyExactEntry(plan, rows, { style: 'swing', preferEdge: false });
  assert(exact && exact.entryType && exact.entryGuidance, 'exact entry adds type + guidance');
  assert(exact.entry !== 110 || exact.entryType.indexOf('MARKET') >= 0, 'EMA21 limit or in-zone market');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
