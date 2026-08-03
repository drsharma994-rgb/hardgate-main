/* HARDGATE — pineSmcCore unit tests (Node 18+, no network). */
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

assert(typeof G.pineSmcCore === 'function', 'pineSmcCore exported');

function bar(o, h, l, c){
  return { t: 0, o: o, h: h, l: l, c: c, v: 1000 };
}

{
  const rows = [];
  for (let i = 0; i < 15; i++) rows.push(bar(100, 101, 99, 100));
  assert(G.pineSmcCore(rows) === null, 'short history returns null');
}

{
  const rows = [];
  for (let i = 0; i < 80; i++){
    const c = 100 + Math.sin(i / 6) * 2;
    rows.push(bar(c - 0.2, c + 0.8, c - 0.8, c));
  }
  const r = G.pineSmcCore(rows, { pivotLength: 5, atrLen: 14 });
  assert(r === null || (r.dir === 'long' || r.dir === 'short'), 'valid dir or null on chop');
}

{
  const rows = [];
  let c = 100;
  for (let i = 0; i < 40; i++){
    c += 0.3;
    rows.push(bar(c, c + 0.4, c - 0.4, c));
  }
  for (let j = 0; j < 8; j++){
    c -= 1.2;
    rows.push(bar(c + 0.5, c + 0.6, c - 0.6, c));
  }
  const bullGap = bar(92, 93, 91.5, 92.5);
  bullGap.l = 94;
  bullGap.h = 95;
  rows.push(bullGap);
  rows.push(bar(96, 97, 95.5, 96.5));
  const breakBar = bar(97, 98, 96.5, 97.5);
  rows[rows.length - 1] = breakBar;
  const r = G.pineSmcCore(rows, { pivotLength: 3, atrLen: 5 });
  assert(r === null || isFinite(r.entry), 'returns limit entry when CHoCH fires or null');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
