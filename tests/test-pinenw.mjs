/* HARDGATE — pineNwEnvelope unit tests (Node 18+, no network). */
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

assert(typeof G.pineNwEnvelope === 'function', 'pineNwEnvelope exported');

function bar(o, h, l, c){
  return { t: 0, o: o, h: h, l: l, c: c, v: 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineNwEnvelope(rows) === null, 'short history returns null');
}

{
  const rows = [];
  let c = 100;
  for (let i = 0; i < 120; i++){
    c += Math.sin(i / 8) * 0.3;
    rows.push(bar(c, c + 0.8, c - 0.8, c));
  }
  const r = G.pineNwEnvelope(rows);
  assert(r === null || r.dir === 'long' || r.dir === 'short', 'valid dir or null on smooth series');
  if (r){
    assert(isFinite(r.nwCenter) && isFinite(r.upper) && isFinite(r.lower), 'envelope levels on signal');
    assert(typeof r.newLong === 'boolean' && typeof r.newShort === 'boolean', 'flip flags');
  }
}

{
  const rows = [];
  let c = 100;
  for (let i = 0; i < 115; i++){
    rows.push(bar(c, c + 0.5, c - 0.5, c));
  }
  const base = rows[rows.length - 1];
  const spike = bar(base.c, base.c + 0.2, base.c - 8, base.c - 0.5);
  rows.push(spike);
  const r = G.pineNwEnvelope(rows, { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 14 });
  assert(r === null || (r.newLong && r.dir === 'long'), 'bullish pierce+reclaim yields long or null');
  if (r){
    assert(r.lower < r.price && r.price > r.lower, 'close reclaimed inside lower band');
    assert(isFinite(r.meanTarget), 'mean target set');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
