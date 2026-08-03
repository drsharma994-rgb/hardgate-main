/* HARDGATE — pineSmartMoneyFlow unit tests (Node 18+, no network). */
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

assert(typeof G.pineSmartMoneyFlow === 'function', 'pineSmartMoneyFlow exported');

function bar(o, h, l, c, v){
  return { t: 0, o: o, h: h, l: l, c: c, v: v == null ? 1000 : v };
}

{
  const rows = [];
  for (let i = 0; i < 15; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineSmartMoneyFlow(rows) === null, 'short history returns null');
}

{
  const rows = [];
  for (let i = 0; i < 30; i++){
    rows.push(bar(100, 101, 99, 100.5, 1000));
  }
  for (let i = 0; i < 5; i++){
    rows.push(bar(100.5, 103, 100, 102.5, 5000));
  }
  const r = G.pineSmartMoneyFlow(rows, { length: 10, threshold: 0.05 });
  assert(r && typeof r.smf === 'number', 'returns smf ratio');
  assert('newLong' in r && 'newShort' in r, 'cross flags present');
}

{
  const rows = [];
  for (let i = 0; i < 25; i++) rows.push(bar(100, 101, 99, 100, 1000));
  rows.push(bar(100, 101, 99, 100.2, 1000));
  const r = G.pineSmartMoneyFlow(rows, { length: 5, threshold: 0.99 });
  assert(r === null || r.dir === null || r.dir === 'long' || r.dir === 'short', 'valid dir or null');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
