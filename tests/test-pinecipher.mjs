/* HARDGATE — pineVumanchuCipher unit tests (Node 18+, no network). */
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

assert(typeof G.pineVumanchuCipher === 'function', 'pineVumanchuCipher exported');

function bar(o, h, l, c){
  return { t: 0, o: o, h: h, l: l, c: c, v: 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineVumanchuCipher(rows) === null, 'short history returns null');
}

{
  const rows = [];
  for (let i = 0; i < 100; i++){
    const c = 100 + Math.sin(i / 5) * 4;
    rows.push(bar(c - 0.5, c + 1.5, c - 1.5, c));
  }
  const r = G.pineVumanchuCipher(rows);
  assert(r === null || r.dir === 'long' || r.dir === 'short', 'valid dir or null on oscillating data');
  if (r){
    assert(isFinite(r.wt1) && isFinite(r.wt2), 'wt1/wt2 on signal');
    assert(r.signalType === 'bull_div' || r.signalType === 'bear_div', 'signalType set');
    assert(typeof r.newLong === 'boolean' && typeof r.newShort === 'boolean', 'flip flags');
  }
}

{
  const rows = [];
  let c = 120;
  for (let i = 0; i < 90; i++){
    c -= 0.4 + (i % 7 === 0 ? 0.8 : 0);
    rows.push(bar(c + 0.3, c + 1.2, c - 1.5, c));
  }
  const r = G.pineVumanchuCipher(rows, { wtChannelLen: 9, wtAvgLen: 21, osLevel: -53, obLevel: 53 });
  assert(r === null || isFinite(r.price), 'returns price when div fires or null');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
