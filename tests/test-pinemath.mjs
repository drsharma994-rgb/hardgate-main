/* HARDGATE — pinemath.js unit tests (Node 18+, no network). */
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

function mkRows(n, start, step){
  const rows = [];
  let prev = start;
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    rows.push({ t: i * 3600, o: prev, h: Math.max(prev, c) + 1, l: Math.min(prev, c) - 1, c, v: 1000 + i });
    prev = c;
  }
  return rows;
}

assert(typeof G.pineLorentzianKernel === 'function', 'pineLorentzianKernel exported');

{
  const short = mkRows(50, 100, 0.1);
  assert(G.pineLorentzianKernel(short) === null, 'short history returns null');
}

{
  const rows = mkRows(300, 100, 0.05);
  const r = G.pineLorentzianKernel(rows);
  assert(r && typeof r.smoothedScore === 'number', 'returns smoothedScore on sufficient bars');
  assert(typeof r.longCondition === 'boolean' && typeof r.shortCondition === 'boolean', 'condition flags');
  assert('newLong' in r && 'newShort' in r, 'edge-trigger flags present');
}

{
  const rows = mkRows(300, 200, -0.08);
  const r = G.pineLorentzianKernel(rows, { scoreLimit: 0.01 });
  assert(r && (r.dir === 'long' || r.dir === 'short' || r.dir === null), 'dir is long/short/null');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
