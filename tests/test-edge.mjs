/* HARDGATE — edge.js unit tests (Node 18+, builtins only).
   Run: node tests/test-edge.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};
for (const f of ['indicators.js', 'indicators2.js', 'meanrev.js', 'edge.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function mkRows(closes, spread){
  var s = (spread === undefined) ? 0.4 : spread;
  return closes.map(function(c, i){
    return { t: i * 14400, o: c, h: c + s, l: c - s, c: c, v: 1000 + i * 10 };
  });
}

function trendSeries(dir, n){
  var closes = [];
  var i, base = 100;
  for (i = 0; i < n; i++){
    base += (dir === 'long') ? (0.15 + Math.sin(i / 9) * 0.05) : (-0.15 - Math.sin(i / 9) * 0.05);
    closes.push(base);
  }
  return mkRows(closes, 0.35);
}

assert(/xuniverse\.js[\s\S]*edge\.js/.test(readFileSync(path.join(root, 'index.html'), 'utf8')),
  'index.html loads xuniverse.js before edge.js');

console.log('== edge exports ==');
assert(typeof W.edgeSignal === 'function', 'edgeSignal exported');
assert(typeof W.edgeSwingBias === 'function', 'edgeSwingBias exported');
assert(typeof W.edgeSwingRead === 'function', 'edgeSwingRead exported');
assert(typeof W.edgeEnrich === 'function', 'edgeEnrich exported');
assert(typeof W.edgeAssess === 'function', 'edgeAssess exported');
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.some(function(t){ return t.id === 'edge'; }),
  'HG_tabs registers edge tab');

console.log('== SWING bias gate ==');
{
  var bull = trendSeries('long', 260);
  var bear = trendSeries('short', 260);
  var bBias = W.edgeSwingBias(bull);
  var sBias = W.edgeSwingBias(bear);
  assert(bBias && bBias.dir === 'long', 'uptrend -> long bias');
  assert(sBias && sBias.dir === 'short', 'downtrend -> short bias');
}

console.log('== counter-trend range fade blocked ==');
{
  var bear = trendSeries('short', 260);
  var n = bear.length;
  bear[n - 1].l = bear[n - 1].c - 2;
  bear[n - 1].c = bear[n - 1].l + 0.1;
  var sig = W.edgeSignal(bear);
  assert(sig === null || sig.dir === 'short', 'bear trend does not emit counter-trend long');
}

console.log('== edgePlan geometry ==');
{
  var p = W.edgePlan({ dir: 'short', entry: 100, stop: 103, t1: 94, t2: 89.5, rr: 2 });
  assert(p && p.stop > p.entry && p.t1 < p.entry && p.rr1 >= 2, 'short plan min 2R');
}

console.log('== edgeBacktest never throws ==');
{
  var bt = W.edgeBacktest(trendSeries('long', 280));
  assert(bt && typeof bt.n === 'number', 'backtest shape');
}

console.log('== refresh contract ==');
{
  var tab = W.HG_tabs.filter(function(t){ return t.id === 'edge'; })[0];
  assert(tab.refresh() === 'skipped: not run yet', 'refresh before scan skipped');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
