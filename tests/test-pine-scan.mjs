/* HARDGATE — pine.js signal + render smoke tests (Node 18+, no network). */
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

const ctx = vm.createContext({
  window: {}, console, Math, JSON, Date, isFinite, parseInt, String, Object, Array,
  setTimeout, clearTimeout, Promise, localStorage: { getItem(){ return null; }, setItem(){} }
});
ctx.window = ctx;

for (const f of ['pinemath.js', 'pinegate.js', 'setup-stack.js', 'setup-ui.js', 'pine.js']){
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

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

assert(typeof W.pineEvalEligible === 'function', 'pineEvalEligible exported');
assert(typeof W.renderPineOut === 'function', 'renderPineOut exported');

const gate = W.pineGateIntersect({
  swingCands: [],
  scalpCands: [],
  edgeCands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tally: 4 }],
  edgeForming: [{ sym: 'ETHUSD', dir: 'short', note: 'forming' }],
  bestClean: [],
  brainRows: [],
  trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
}, { mode: 'edge' });

const rows = mkRows(300, 100, 0.05);
W.pineEvalEligible(gate.eligible, function(){
  return Promise.resolve(rows);
}).then(function(signals){
  assert(Array.isArray(signals), 'pineEvalEligible returns array');
  assert(signals.every(function(s){ return W.pineSignalVisible(s); }), 'all eval signals are visible tiers');

  const emptyHtml = W.renderPineOut([], gate);
  assert(/PINE UNIVERSE/.test(emptyHtml), 'empty render shows universe watch');
  assert(/No Pine script match/.test(emptyHtml), 'empty render explains no script match');

  if (signals.length){
    const html = W.renderPineOut(signals, gate);
    assert(/CLEAN|FORMING|ALIGNED/.test(html), 'non-empty render has tier section');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch(function(e){
  console.error(e);
  process.exit(1);
});
