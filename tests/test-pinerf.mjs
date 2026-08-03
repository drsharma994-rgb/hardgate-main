/* HARDGATE — pineRangeFilter unit tests (Node 18+, no network). */
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

assert(typeof G.pineRangeFilter === 'function', 'pineRangeFilter exported');

function bar(o, h, l, c){
  return { t: 0, o: o, h: h, l: l, c: c, v: 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 50; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineRangeFilter(rows) === null, 'short history returns null');
}

{
  const rows = [];
  let c = 100;
  for (let i = 0; i < 220; i++){
    c += (i % 40 < 20) ? 0.15 : -0.12;
    rows.push(bar(c - 0.2, c + 0.5, c - 0.5, c));
  }
  const r = G.pineRangeFilter(rows, { period: 100, mult: 3 });
  assert(r === null || r.dir === 'long' || r.dir === 'short', 'valid dir or null on oscillating data');
  if (r){
    assert(isFinite(r.filterLevel) && isFinite(r.rng), 'filterLevel and rng on signal');
    assert(typeof r.newLong === 'boolean' && typeof r.newShort === 'boolean', 'flip flags');
    assert(r.trend === 1 || r.trend === -1, 'trend state set');
  }
}

{
  const rows = [];
  let c = 200;
  for (let i = 0; i < 230; i++){
    c += 0.05;
    rows.push(bar(c, c + 0.3, c - 0.3, c));
  }
  for (let j = 0; j < 15; j++){
    c -= 1.5;
    rows.push(bar(c + 0.5, c + 1, c - 1, c));
  }
  const r = G.pineRangeFilter(rows, { period: 50, mult: 2.5 });
  assert(r === null || isFinite(r.price), 'returns price when flip fires or null');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
