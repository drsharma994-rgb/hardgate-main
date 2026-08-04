/* HARDGATE — goldpine / pinegoldmath unit tests (Node 18+, no network). */
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

function mkRows(n, start, step){
  const rows = [];
  let prev = start;
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    rows.push({ t: i * 3600, o: prev, h: Math.max(prev, c) + 2, l: Math.min(prev, c) - 2, c, v: 1000 + i * 10 });
    prev = c;
  }
  return rows;
}

const ctx = vm.createContext({
  window: {}, console, Math, JSON, Date, isFinite, NaN, Array, Object, String,
  module: { exports: {} }
});
ctx.window = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'pinemath.js'), 'utf8'), ctx, { filename: 'pinemath.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'pinegoldmath.js'), 'utf8'), ctx, { filename: 'pinegoldmath.js' });
const G = ctx.window;

assert(typeof G.pineGoldConfluence === 'function', 'pineGoldConfluence exported');
assert(typeof G.pineGoldGrade === 'function', 'pineGoldGrade exported');
assert(G.pineGoldGrade(12, 16) === 'A+', 'grade A+ at 75%');

{
  const rows4h = mkRows(300, 2400, 0.5);
  const rows1d = mkRows(280, 2200, 2);
  const res = G.pineGoldConfluence(rows4h, { mode: 'swing', htfRows: rows1d, levels: {} });
  assert(res && res.long && res.short, 'returns long and short eval');
  assert(typeof res.long.score === 'number', 'long has numeric score');
  assert(res.layers && res.layers.halftrend !== undefined, 'layer results populated');
}

{
  const rows15m = mkRows(250, 2650, 0.08);
  const rows1h = mkRows(220, 2600, 0.3);
  const res = G.pineGoldConfluence(rows15m, { mode: 'scalp', htfRows: rows1h, levels: { pdh: 2700, pdl: 2600 } });
  assert(res.long && res.short, 'scalp mode evaluates both directions');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
