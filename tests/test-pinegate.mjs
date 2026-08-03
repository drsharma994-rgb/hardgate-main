/* HARDGATE — pinegate.js unit tests (Node 18+, no network). */
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

const ctx = vm.createContext({ window: {}, console, Math, JSON, Date, isFinite, parseInt, String, Object, Array, module: { exports: {} } });
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'pinegate.js'), 'utf8'), ctx, { filename: 'pinegate.js' });
const G = ctx.window;

assert(typeof G.pineNormSym === 'function', 'pineNormSym exported');
assert(typeof G.pineGateIntersect === 'function', 'pineGateIntersect exported');

assert(G.pineNormSym('BTCUSDT') === 'BTC', 'BTCUSDT normalizes to BTC');
assert(G.pineNormSym('BTCUSD') === 'BTC', 'BTCUSD normalizes to BTC');

const baseCands = [
  { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tally: 4 },
  { sym: 'ETHUSD', dir: 'short', entry: 2000, stop: 2100, t1: 1800, tally: 5 }
];

const snap = {
  swingCands: baseCands,
  scalpCands: baseCands,
  edgeCands: baseCands,
  bestClean: baseCands,
  brainRows: [
    { sym: 'BTCUSD', dir: 'long', tier: 'HIGH' },
    { sym: 'ETHUSD', dir: 'short', tier: 'PRIME' }
  ],
  trendmxRows: [
    { sym: 'BTCUSDT', score: 3 },
    { sym: 'ETHUSDT', score: -3 }
  ],
  regime: { playbook: { bias: 'BOTH' } }
};

const res = G.pineGateIntersect(snap);
assert(res.eligible.length === 2, 'two sym+dir pairs pass all gates');
assert(res.funnel.eligible === 2, 'funnel counts eligible');

const block = G.pineGateIntersect(Object.assign({}, snap, {
  regime: { playbook: { bias: 'LONG-ONLY' } }
}));
assert(block.eligible.length === 1 && block.eligible[0].sym === 'BTCUSD', 'REGIME LONG-ONLY blocks ETH short');
assert(block.funnel.regimeBlocked === 1, 'regime blocked counted');

const empty = G.pineGateIntersect({ swingCands: [], scalpCands: baseCands });
assert(empty.eligible.length === 0 && empty.missing.indexOf('SWING') >= 0, 'missing swing reported');

const partial = {
  swingCands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tally: 4 }],
  scalpCands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tally: 4 }],
  edgeCands: [],
  bestClean: [],
  brainRows: [],
  trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
};
const relaxed = G.pineGateIntersect(partial, { mode: 'relaxed', minHits: 2 });
assert(relaxed.eligible.length === 1 && relaxed.eligible[0].sym === 'BTCUSD', 'relaxed: swing+scalp passes');
assert(relaxed.funnel.mode === 'relaxed', 'funnel records relaxed mode');
const strictPartial = G.pineGateIntersect(partial, { mode: 'strict' });
assert(strictPartial.eligible.length === 0, 'strict still requires all six gates');

const swingOnly = G.pineGateIntersect({
  swingCands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110 }],
  scalpCands: [],
  edgeCands: [],
  bestClean: [],
  brainRows: [],
  trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
}, { mode: 'swing' });
assert(swingOnly.eligible.length === 1, 'swing-only passes without brain/scalp');
assert(swingOnly.funnel.mode === 'swing', 'funnel records swing mode');
assert(swingOnly.missing.length === 0, 'swing-only does not list brain as missing');

const edgeOnly = G.pineGateIntersect({
  swingCands: [],
  scalpCands: [],
  edgeCands: [{ sym: 'ETHUSD', dir: 'short', entry: 2000, stop: 2100, t1: 1800, tally: 4 }],
  bestClean: [],
  brainRows: [],
  trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
}, { mode: 'edge' });
assert(edgeOnly.eligible.length === 1 && edgeOnly.eligible[0].sym === 'ETHUSD', 'edge-only passes without swing/brain');
assert(edgeOnly.funnel.mode === 'edge', 'funnel records edge mode');
assert(edgeOnly.missing.length === 0, 'edge-only does not list swing as missing');

const edgePlus = G.pineGateIntersect({
  swingCands: [{ sym: 'SOLUSD', dir: 'long', entry: 50, stop: 48, t1: 55 }],
  scalpCands: [],
  edgeCands: [],
  edgeForming: [{ sym: 'SOLUSD', dir: 'long', note: 'forming' }, { sym: 'AVAXUSD', dir: 'short' }],
  bestClean: [],
  brainRows: [],
  trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
}, { mode: 'edge' });
assert(edgePlus.eligible.length === 2, 'edge mode includes forming watchlist');
assert(edgePlus.funnel.edgeForming === 2, 'funnel counts forming');

const edgeFallback = G.pineGateIntersect({
  swingCands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110 }],
  scalpCands: [],
  edgeCands: [],
  edgeForming: [],
  bestClean: [],
  brainRows: [],
  trendmxRows: [],
  regime: { playbook: { bias: 'BOTH' } }
}, { mode: 'edge' });
assert(edgeFallback.eligible.length === 1 && edgeFallback.eligible[0].swingFallback, 'edge falls back to SWING CLEAN');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
