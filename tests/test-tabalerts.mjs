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
const { hgTabAlertsFresh, hgTabAlertsFormat, setupKey, GAP_MS, GOLD_MIN_TALLY,
  tabAlertsShouldRun, tabAlertsMarkRun, LS_LAST_RUN } = lib;

assert(typeof hgTabAlertsFresh === 'function', 'hgTabAlertsFresh exported');
assert(GAP_MS === 15 * 60 * 1000, '15-min dedup gap');
assert(GOLD_MIN_TALLY === 10, 'gold min tally default 10');

const throttleStore = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const nowT = 1_700_000_000_000;
tabAlertsMarkRun({ localStorage: throttleStore });
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false) === false, '15-min cycle throttle blocks immediate re-run');
assert(tabAlertsShouldRun({ localStorage: throttleStore }, true) === true, 'force bypasses cycle throttle');
throttleStore.setItem(LS_LAST_RUN, String(nowT - GAP_MS - 1));
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false) === true, 'cycle throttle opens after 15 min');

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
assert(body.indexOf('Tab/source: BRAIN PRIME') >= 0, 'format names tab/source per row');

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
  swingScan: () => ({ cands: [{ sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9, t1: 12.6, rr: 2.6 }] }),
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
  edgeScan: () => ({ cands: [{ sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9, t1: 12, tally: 5, rr: 2 }] }),
  __hgBrainLast: () => null,
  goldscalpScan: () => null,
  goldswingScan: () => null,
  sendTelegram: async (t) => { WE._tg = t; return true; }
});
WE.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const edgeOnly = WE.hgTabAlertsCollect();
assert(edgeOnly.length === 1 && edgeOnly[0].src === 'EDGE' && edgeOnly[0].sym === 'SOLUSD',
       'collectEdge picks up edgeScan cands with tally >= 5');
const edgeRun = await WE.hgTabAlertsRunEdge({ force: true });
assert(edgeRun.pushed === 1 && WE._tg && WE._tg.indexOf('Tab/source: EDGE') >= 0,
       'hgTabAlertsRunEdge pushes only EDGE setups to Telegram');

const WF = loadWithWindow({
  edgeScan: () => ({
    cands: [{ sym: 'OLDUSD', dir: 'long', entry: 10, stop: 9, t1: 12, tally: 5, barAge: 4 }],
    forming: [{ sym: 'NEARUSD', dir: 'short', mark: 100, level: 101, distAtr: 0.5, note: '0.50×ATR to EMA21' }]
  }),
  sendTelegram: async (t) => { WF._tg = t; return true; }
});
WF.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const edgeFilter = WF.hgTabAlertsCollect();
assert(edgeFilter.length === 1 && edgeFilter[0].src === 'EDGE FORMING' && edgeFilter[0].sym === 'NEARUSD',
       'collectEdge skips stale tickets and includes near forming watch');
assert(!edgeFilter.some(c => c.sym === 'OLDUSD'), 'stale EDGE (barAge>2) excluded from alerts');

const WP = loadWithWindow({
  pineScan: () => ({
    signals: [
      { sym: 'BTCUSD', dir: 'long', isNew: true, entry: 100, stop: 95, t1: 110, rr: 2, smoothedScore: 2.1 },
      { sym: 'ETHUSD', dir: 'short', isRecent: true, barsAgo: 2, entry: 50, stop: 52, t1: 45, rr: 2.5 }
    ]
  }),
  sendTelegram: async (t) => { WP._tg = t; return true; }
});
WP.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const pineCollected = WP.hgTabAlertsCollect();
assert(pineCollected.length === 2, 'collectPine includes NEW and RECENT forming signals');
assert(pineCollected.some(c => c.src === 'PINE' && c.sym === 'BTCUSD'), 'pine NEW collected');
assert(pineCollected.some(c => c.sym === 'ETHUSD' && String(c.tier || '').indexOf('FORMING') >= 0),
       'pine RECENT tagged as FORMING tier');
const pineRun = await WP.hgTabAlertsRunPine({ force: true });
assert(pineRun.pushed === 2 && WP._tg && WP._tg.indexOf('Tab/source: PINE') >= 0,
       'hgTabAlertsRunPine pushes pine setups to Telegram');

const WS = loadWithWindow({
  __hgSmartResults: {
    results: [{
      sym: 'SOLUSD',
      setup: { dir: 'long', confirmed: true, entry: 10, stop: 9, t1: 12, rr1: 2 }
    }]
  },
  sendTelegram: async (t) => { WS._tg = t; return true; }
});
WS.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const smartCollected = WS.hgTabAlertsCollect();
assert(smartCollected.length === 1 && smartCollected[0].src === 'SMART $' && smartCollected[0].prime === true,
       'collectSmart includes confirmed SMART setups');
const smartRun = await WS.hgTabAlertsRun({ sources: { smart: true }, force: true });
assert(smartRun.pushed === 1 && WS._tg && WS._tg.indexOf('SMART') >= 0, 'hgTabAlertsRun smart source filter');

const run = await W.hgTabAlertsRun({ force: true });
assert(run.pushed === 3 && W._tg && W._tg.indexOf('SOLUSD') >= 0, 'telegram push on fresh setups');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
