/* HARDGATE — pineHalfTrend unit tests (Node 18+, no network). */
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

assert(typeof G.pineHalfTrend === 'function', 'pineHalfTrend exported');

function bar(o, h, l, c){
  return { t: 0, o: o, h: h, l: l, c: c, v: 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 50; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineHalfTrend(rows) === null, 'short history returns null');
}

{
  const rows = [];
  for (let i = 0; i < 120; i++){
    const c = 100 + Math.sin(i / 8) * 3;
    rows.push(bar(c - 0.2, c + 1, c - 1, c));
  }
  const r = G.pineHalfTrend(rows, { amplitude: 2, atrMult: 2, atrLen: 14 });
  assert(r && isFinite(r.halftrend), 'returns halftrend line on sufficient bars');
  assert(typeof r.trend === 'number', 'returns trend state');
  assert('newLong' in r && 'newShort' in r, 'flip flags present');
}

{
  const rows = [];
  let c = 100;
  for (let i = 0; i < 110; i++){
    c += 0.05;
    rows.push(bar(c, c + 0.5, c - 0.5, c));
  }
  for (let j = 0; j < 5; j++){
    c -= 2;
    rows.push(bar(c + 1, c + 1.5, c - 1.5, c));
  }
  const r = G.pineHalfTrend(rows, { amplitude: 2, atrMult: 2, atrLen: 20 });
  assert(r === null || r.dir === null || r.dir === 'long' || r.dir === 'short', 'valid dir');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
