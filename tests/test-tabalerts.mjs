/* HARDGATE — tabalerts.js unit tests (Node 18+, builtins only). */
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

function loadTabAlerts(){
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Math, JSON, Date, Promise, isFinite, parseInt, String, Object, Array
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'tabalerts.js'), 'utf8'), sandbox, { filename: 'tabalerts.js' });
  return sandbox.module.exports;
}

const lib = loadTabAlerts();
const { hgTabAlertsFresh, hgTabAlertsFormat, setupKey, GAP_MS, GOLD_MIN_TALLY } = lib;

assert(typeof hgTabAlertsFresh === 'function', 'hgTabAlertsFresh exported');
assert(GAP_MS === 15 * 60 * 1000, '15-min dedup gap');
assert(GOLD_MIN_TALLY === 10, 'gold min tally default 10');

const now = 1_700_000_000_000;
const s1 = { src: 'SWING', sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110 };
const k1 = setupKey(s1);
const fr1 = hgTabAlertsFresh({}, [s1], now, GAP_MS);
assert(fr1.fresh.length === 1 && fr1.fresh[0].sym === 'BTCUSD', 'first sighting is fresh');
assert(fr1.keys[k1] === now, 'key stamped');

const fr2 = hgTabAlertsFresh(fr1.keys, [s1], now + 60000, GAP_MS);
assert(fr2.fresh.length === 0, 'same setup inside 15-min window is not re-alerted');

const fr3 = hgTabAlertsFresh(fr1.keys, [s1], now + GAP_MS + 1, GAP_MS);
assert(fr3.fresh.length === 1, 'same setup after 15 min can alert again');

const body = hgTabAlertsFormat([{ src: 'BRAIN PRIME', sym: 'ETHUSD', dir: 'short', entry: 2000, stop: 2050, t1: 1900, prime: true, tier: 'PRIME' }]);
assert(body.indexOf('STRONG SETUP') >= 0 && body.indexOf('PRIME') >= 0, 'PRIME rows tagged strong');

function loadWithWindow(W){
  const sandbox = {
    module: { exports: {} },
    console, Math, JSON, Date, Promise, isFinite, parseInt, String, Object, Array,
    localStorage: { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } }
  };
  sandbox.window = W;
  sandbox.globalThis = sandbox;
  W.localStorage = sandbox.localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'tabalerts.js'), 'utf8'), sandbox, { filename: 'tabalerts.js' });
  return sandbox.window;
}

const W = loadWithWindow({
  swingScan: () => ({ cands: [{ sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9, t1: 12, rr: 2 }] }),
  scalpScan: () => null,
  edgeScan: () => null,
  __hgBrainLast: () => ({ rows: [{ sym: 'XRPUSD', dir: 'short', tier: 'HIGH', plan: { entry: 1, stop: 1.1, t1: 0.8 } }] }),
  goldscalpScan: () => ({ cands: [{ sym: 'XAUUSD', dir: 'long', entry: 2400, stop: 2390, t1: 2420, tally: 11 }] }),
  goldswingScan: () => ({ cands: [{ sym: 'XAUUSD', dir: 'long', entry: 2400, stop: 2380, t1: 2440, tally: 8 }] }),
  sendTelegram: async (t) => { W._tg = t; return true; }
});
W.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };

const collected = W.hgTabAlertsCollect();
assert(collected.length === 3, 'collects swing + brain + gold scalp (11 tally), skips gold swing (8)');
assert(collected.some(c => c.src === 'SWING'), 'swing included');
assert(collected.some(c => c.src.indexOf('BRAIN') >= 0), 'brain included');
assert(!collected.some(c => c.src === 'GOLD SWING'), 'gold swing below 10 excluded');

const WE = loadWithWindow({
  swingScan: () => null,
  scalpScan: () => null,
  edgeScan: () => ({ cands: [{ sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9, t1: 12, tally: 4, rr: 2 }] }),
  __hgBrainLast: () => null,
  goldscalpScan: () => null,
  goldswingScan: () => null,
  sendTelegram: async (t) => { WE._tg = t; return true; }
});
WE.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const edgeOnly = WE.hgTabAlertsCollect();
assert(edgeOnly.length === 1 && edgeOnly[0].src === 'EDGE' && edgeOnly[0].sym === 'SOLUSD',
       'collectEdge picks up edgeScan cands with tally >= 3');
const edgeRun = await WE.hgTabAlertsRunEdge();
assert(edgeRun.pushed === 1 && WE._tg && WE._tg.indexOf('[EDGE]') >= 0,
       'hgTabAlertsRunEdge pushes only EDGE setups to Telegram');

const run = await W.hgTabAlertsRun();
assert(run.pushed === 3 && W._tg && W._tg.indexOf('SOLUSD') >= 0, 'telegram push on fresh setups');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
