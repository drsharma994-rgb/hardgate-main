/* HARDGATE — pineSqueezeMomentum unit tests (Node 18+, no network). */
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

assert(typeof G.pineSqueezeMomentum === 'function', 'pineSqueezeMomentum exported');

function bar(o, h, l, c){
  return { t: 0, o: o, h: h, l: l, c: c, v: 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 15; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineSqueezeMomentum(rows) === null, 'short history returns null');
}

{
  const rows = [];
  for (let i = 0; i < 80; i++){
    const c = 100 + Math.sin(i / 5) * 0.5;
    rows.push(bar(c, c + 0.3, c - 0.3, c));
  }
  const r = G.pineSqueezeMomentum(rows);
  assert(r && typeof r.sqzOn === 'boolean', 'returns sqzOn flag');
  assert(typeof r.momentum === 'number' || isNaN(r.momentum), 'returns momentum');
  assert('sqzFired' in r && 'newLong' in r && 'newShort' in r, 'fire flags present');
}

{
  const rows = [];
  let c = 100;
  for (let i = 0; i < 60; i++){
    c += (i < 40 ? 0.01 : 0.5);
    rows.push(bar(c - 0.1, c + 0.5, c - 0.5, c));
  }
  const r = G.pineSqueezeMomentum(rows, { length: 10, bbMult: 2, kcMult: 1.5 });
  assert(r !== null, 'breakout series computes');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
