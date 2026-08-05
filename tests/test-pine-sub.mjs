/* HARDGATE — pine-sub.js smoke tests (Node 18+). */
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
  window: {}, console, Math, JSON, Date, isFinite, parseInt, String, Object, Array, Promise
});
ctx.window = ctx;
for (const f of ['pinemath.js', 'pinegate.js', 'setup-stack.js', 'setup-ui.js', 'pine.js', 'pine-sub.js']){
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

assert(typeof W.pineSubGate === 'function', 'pineSubGate exported');
assert(typeof W.pineSubEnrichSignal === 'function', 'pineSubEnrichSignal exported');
assert(typeof W.pineSubRunScan === 'function', 'pineSubRunScan exported');
assert(/EDGE\+/.test(W.PINE_EDGE_UNIVERSE_NOTE), 'EDGE+ universe note');

const item = { sym: 'BTCUSD', dir: 'long', edgeTicket: true, gates: { regime: 'BOTH' } };
const res = { dir: 'long', newLong: false, newShort: false, aligned: true, price: 100 };
const sig = W.pineSubEnrichSignal({ sym: 'BTCUSD', dir: 'long', isNew: false, entry: 100, stop: 95, t1: 110 }, item, res);
assert(sig && sig.isContext && sig.edgeTicket, 'enrich keeps edge ticket + context');

const gate = W.pineGateIntersect({
  edgeCands: [{ sym: 'ETHUSD', dir: 'short', entry: 2000, stop: 2100, t1: 1800, tally: 4 }],
  edgeForming: [], swingCands: [], scalpCands: [], bestClean: [], brainRows: [], trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
}, { mode: 'edge' });
const html = W.pineSubRenderOut([], gate, function(){ return '<div>X</div>'; }, 'test empty');
assert(/PINE UNIVERSE/.test(html), 'sub render shows universe watch');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
