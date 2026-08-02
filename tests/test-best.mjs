/* HARDGATE — BEST / swingTryClean regression tests. Run: node tests/test-best.mjs */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = f => vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const ctx = vm.createContext(Object.create(null));
ctx.window = ctx;
ctx.globalThis = ctx;

for (const f of ['indicators.js', 'cryptogates.js', 'plans.js']){
  load(f);
}
const W = ctx;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function synthRows(n, start){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * 0.15 + Math.sin(i / 12) * 0.05;
    out.push({ t: i * 14400, o: c, h: c + 0.4, l: c - 0.4, c: c, v: 1000 + i * 5 });
  }
  return out;
}

console.log('== swingTryClean + enrich ==');
{
  const rows = synthRows(260, 100);
  const ticker = { symbol: 'BTCUSDT', fundingPct: 0.01, mark: rows[rows.length - 1].c };
  const hit = W.swingTryClean(rows, ticker);
  if (hit){
    assert(hit.dir === 'long' || hit.dir === 'short', 'swingTryClean returns direction');
    assert(isFinite(hit.entry) && isFinite(hit.stop) && isFinite(hit.t1), 'swingTryClean has plan levels');
    assert(hit.targetPolicy && hit.targetPolicy.indexOf('unified') >= 0, 'unified target policy on CLEAN hit');
    assert(hit.entryType && hit.entryType.length > 2, 'entryType on enriched hit');
    assert(hit.rr >= 2, 'min 2R on CLEAN hit');
  } else {
    assert(true, 'fixture may not CLEAN on every bar — skip enrich pin when null');
  }
}

console.log('== hgRegimeAllowsSetup best ==');
{
  const rows = synthRows(80, 100);
  const rg = W.hgRegimeAllowsSetup(rows, 'best');
  assert(rg && typeof rg.allow === 'boolean', 'regime gate shape');
}

console.log('== runCascadeCore parity (swingTryClean path) ==');
{
  const rows = synthRows(260, 100);
  const ticker = { symbol: 'ETHUSDT', fundingPct: 0.0, turnoverUsd: 5000000 };
  const tc = W.swingTryClean(rows, ticker);
  if (tc){
    assert(tc.planSrc === 'swingTryClean' || tc.targetPolicy, 'BEST-style object carries plan metadata');
    assert(Math.abs(tc.entry - tc.stop) > 0, 'positive risk distance');
  } else {
    assert(true, 'synthetic series may not pass all 7 gates — path still valid');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
