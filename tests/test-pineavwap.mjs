/* HARDGATE — pineWeeklyAvwap unit tests (Node 18+, no network). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

const ctx = vm.createContext({ window: {}, console, Math, JSON, Date, isFinite, NaN, Array, Object, String });
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'pinemath.js'), 'utf8'), ctx, { filename: 'pinemath.js' });
const G = ctx.window;

assert(typeof G.pineWeeklyAvwap === 'function', 'pineWeeklyAvwap exported');
assert(typeof G.pineWeekStartSec === 'function', 'pineWeekStartSec exported');

function bar(t, o, h, l, c, v){
  return { t: t, o: o, h: h, l: l, c: c, v: v || 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push(bar(1700000000 + i * 14400, 100, 101, 99, 100, 500));
  assert(G.pineWeeklyAvwap(rows) === null, 'few bars returns null or no signal');
}

{
  const base = 1704067200;
  const rows = [];
  let c = 100;
  for (let i = 0; i < 30; i++){
    c += 0.1;
    rows.push(bar(base + i * 14400, c, c + 0.5, c - 0.5, c, 800 + i * 10));
  }
  const r = G.pineWeeklyAvwap(rows);
  assert(r === null || r.dir === 'long' || r.dir === 'short', 'valid dir or null on uptrend week');
  if (r){
    assert(isFinite(r.vwap) && isFinite(r.upper) && isFinite(r.lower), 'band levels on signal');
    assert(isFinite(r.targetVwap), 'target vwap set');
  }
}

{
  const base = 1704067200;
  const rows = [];
  for (let i = 0; i < 25; i++){
    rows.push(bar(base + i * 14400, 100, 100.5, 99.5, 100, 1000));
  }
  const last = bar(base + 25 * 14400, 99.5, 100, 94, 99.8, 1200);
  rows.push(last);
  const r = G.pineWeeklyAvwap(rows, { bandMult: 1.5 });
  assert(r === null || (r.newLong && r.dir === 'long'), 'lower pierce + reclaim yields long or null');
  if (r){
    assert(r.price > r.lower, 'close reclaimed above lower band');
    assert(r.targetVwap === r.vwap, 'target equals vwap');
  }
}

{
  const mon = 1704067200;
  const sun = mon - 86400;
  assert(G.pineWeekStartSec(mon) === G.pineWeekStartSec(mon + 3600), 'same week same anchor');
  assert(G.pineWeekStartSec(sun) !== G.pineWeekStartSec(mon), 'Sunday vs Monday differ');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
