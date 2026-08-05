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
  tabAlertsShouldRun, tabAlertsMarkRun, LS_LAST_RUN, LS_CLEAN_ONLY, LS_GOLD_LAST_RUN,
  setupIsClean7, tabAlertsFilterClean7, tabAlertsCleanOnlyEnabled,
  tabAlertsGoldSeparateEnabled, tabAlertsGoldConvictedOnlyEnabled, goldIsMostConvinced } = lib;

assert(typeof hgTabAlertsFresh === 'function', 'hgTabAlertsFresh exported');
assert(GAP_MS === 15 * 60 * 1000, '15-min dedup gap');
assert(GOLD_MIN_TALLY === 10, 'gold min tally default 10');
assert(tabAlertsCleanOnlyEnabled({ localStorage: { getItem: () => null } }) === true,
       'clean-only Telegram default ON');
assert(tabAlertsGoldSeparateEnabled({ localStorage: { getItem: () => null } }) === true,
       'gold separate alert batch default ON');
assert(tabAlertsGoldConvictedOnlyEnabled({ localStorage: { getItem: () => null } }) === true,
       'gold convicted-only default ON');
assert(goldIsMostConvinced({ id: 'a', grade: 'A', locked: true, vetoed: false }, { bestId: 'b' }) === true,
       'grade-A locked counts as most convinced');
assert(!goldIsMostConvinced({ id: 'x', grade: 'B', tally: 8 }, { bestId: 'y' }), 'grade-B non-best excluded');

const goldThrottle = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
tabAlertsMarkRun({ localStorage: goldThrottle }, LS_GOLD_LAST_RUN);
assert(tabAlertsShouldRun({ localStorage: goldThrottle }, false, LS_GOLD_LAST_RUN) === false,
       'gold batch has its own 15-min throttle');

assert(setupIsClean7({ src: 'SWING', sym: 'X', dir: 'long', entry: 1, stop: 0.9, t1: 1.2 }), 'SWING rows are clean7');
assert(setupIsClean7({ src: 'EDGE', clean7: true, gatesPassed: 7, gatesTotal: 7 }), 'explicit clean7 passes');
assert(!setupIsClean7({ src: 'GOLD SCALP', tally: 11, entry: 1, stop: 0.9, t1: 1.2 }), 'gold tally-only is not clean7');
assert(tabAlertsFilterClean7([
  { src: 'SWING', sym: 'A', dir: 'long', entry: 1, stop: 0.9, t1: 1.1 },
  { src: 'EDGE', sym: 'B', dir: 'short', entry: 2, stop: 2.1, t1: 1.8, tally: 6 }
]).length === 1, 'clean7 filter keeps SWING only when EDGE lacks clean flag');

const throttleStore = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const nowT = 1_700_000_000_000;
tabAlertsMarkRun({ localStorage: throttleStore });
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false) === false, '15-min cycle throttle blocks immediate re-run');
assert(tabAlertsShouldRun({ localStorage: throttleStore }, true) === true, 'force bypasses cycle throttle');
throttleStore.setItem(LS_LAST_RUN, String(nowT - GAP_MS - 1));
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false) === true, 'cycle throttle opens after 15 min');

const now = 1_700_000_000_000;
const s1 = { src: 'SWING', sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean7: true };
const k1 = setupKey(s1);
const fr1 = hgTabAlertsFresh({}, [s1], now, GAP_MS);
assert(fr1.fresh.length === 1 && fr1.fresh[0].sym === 'BTCUSD', 'first sighting is fresh');
assert(fr1.keys[k1] === now, 'key stamped');

const fr2 = hgTabAlertsFresh(fr1.keys, [s1], now + 60000, GAP_MS);
assert(fr2.fresh.length === 0, 'same setup inside 15-min window is not re-alerted');

const fr3 = hgTabAlertsFresh(fr1.keys, [s1], now + GAP_MS + 1, GAP_MS);
assert(fr3.fresh.length === 1, 'same setup after 15 min can alert again');

const cleanBody = hgTabAlertsFormat([{ src: 'SWING', sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean7: true }]);
assert(cleanBody.indexOf('7/7 CLEAN SETUP') >= 0, 'clean header when all rows are 7/7');
assert(cleanBody.indexOf('COIN: BTCUSD') >= 0 && cleanBody.indexOf('ENTRY:') >= 0
       && cleanBody.indexOf('STOP LOSS:') >= 0 && cleanBody.indexOf('TAKE PROFIT 1:') >= 0,
       'format includes explicit COIN / ENTRY / STOP LOSS / TAKE PROFIT labels');

const body = hgTabAlertsFormat([{ src: 'BRAIN PRIME', sym: 'ETHUSD', dir: 'short', entry: 2000, stop: 2050, t1: 1900, prime: true, tier: 'PRIME', clean7: true }]);
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
  bestScan: () => ({ clean: [{ sym: 'AVAXUSD', dir: 'short', entry: 40, stop: 42, t1: 36, rr: 2 }] }),
  __hgBrainLast: () => ({
    rows: [{
      sym: 'XRPUSD', dir: 'short', tier: 'HIGH',
      evidence: ['SWING CLEAN SHORT — 7/7 gates + plan'],
      plan: { entry: 1, stop: 1.1, t1: 0.8 }
    }]
  }),
  goldscalpScan: () => null,
  goldswingScan: () => null,
  sendTelegram: async (t) => { W._tg = t; return true; }
});
W.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };

const collected = W.hgTabAlertsCollect();
assert(collected.length === 3, 'collects swing + best + brain(7/7); gold separate by default');
assert(collected.some(c => c.src === 'SWING' && c.clean7), 'swing marked clean7');
assert(collected.some(c => c.src === 'BEST' && c.clean7), 'best clean rows marked clean7');
assert(collected.some(c => c.src.indexOf('BRAIN') >= 0 && c.clean7), 'brain 7/7 evidence included');
assert(!collected.some(c => c.src.indexOf('GOLD') >= 0), 'gold excluded from unified collect when separate');

const WGold = loadWithWindow({
  goldscalpScan: () => ({
    bestId: 'gs1',
    cands: [
      { id: 'gs1', sym: 'XAUUSD', dir: 'long', entry: 2400, stop: 2390, t1: 2420, tally: 11, grade: 'A', locked: true },
      { id: 'gs2', sym: 'XAUUSD', dir: 'short', entry: 2410, stop: 2420, t1: 2390, tally: 9, grade: 'B' }
    ]
  }),
  goldswingScan: () => ({
    bestId: 'gw1',
    cands: [{ id: 'gw1', sym: 'XAUUSD', dir: 'long', entry: 2380, stop: 2360, t1: 2440, tally: 12, grade: 'A' }]
  }),
  sendTelegram: async (t) => { WGold._tg = t; return true; }
});
WGold.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const goldCollected = WGold.hgTabAlertsCollectGold();
assert(goldCollected.length === 2 && goldCollected.every(c => c.goldConvicted),
       'gold collect keeps only MOST PROBABLE scalp + swing');
assert(!goldCollected.some(c => c.id === 'gs2'), 'non-convicted grade-B scalp skipped');
const goldRun = await WGold.hgTabAlertsRunGold({ force: true });
assert(goldRun.pushed === 2 && WGold._tg.indexOf('GOLD CONVICTION') >= 0
       && WGold._tg.indexOf('COIN:') >= 0 && WGold._tg.indexOf('STOP LOSS:') >= 0
       && WGold._tg.indexOf('GOLD SCALP') >= 0,
       'gold conviction telegram batch with explicit COIN / ENTRY / SL / TP');

const WBrainNoClean = loadWithWindow({
  __hgBrainLast: () => ({
    rows: [{ sym: 'SKIP', dir: 'long', tier: 'HIGH', evidence: ['partial'], plan: { entry: 1, stop: 0.9, t1: 1.2 } }]
  })
});
assert(WBrainNoClean.hgTabAlertsCollect().length === 0, 'brain without 7/7 evidence skipped');

const WE = loadWithWindow({
  swingScan: () => null,
  scalpScan: () => null,
  edgeScan: () => ({ cands: [{ sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9, t1: 12, tally: 6, rr: 2, clean: true, gatesPassed: 7, gatesTotal: 7 }] }),
  __hgBrainLast: () => null,
  goldscalpScan: () => null,
  goldswingScan: () => null,
  sendTelegram: async (t) => { WE._tg = t; return true; }
});
WE.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const edgeOnly = WE.hgTabAlertsCollect();
assert(edgeOnly.length === 1 && edgeOnly[0].src === 'EDGE' && edgeOnly[0].clean7 === true,
       'collectEdge marks 7/7 EDGE tickets clean7');
const edgeRun = await WE.hgTabAlertsRunEdge({ force: true });
assert(edgeRun.pushed === 1 && WE._tg && WE._tg.indexOf('7/7 CLEAN') >= 0,
       'hgTabAlertsRunEdge pushes 7/7 EDGE to Telegram');

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
const pineRun = await WP.hgTabAlertsRunPine({ force: true, cleanOnly: false });
assert(pineRun.pushed === 2 && WP._tg && WP._tg.indexOf('Tab/source: PINE') >= 0,
       'hgTabAlertsRunPine pushes pine when cleanOnly off');

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
const smartRun = await WS.hgTabAlertsRun({ sources: { smart: true }, force: true, cleanOnly: false });
assert(smartRun.pushed === 1 && WS._tg && WS._tg.indexOf('SMART') >= 0, 'smart alerts when cleanOnly off');

const run = await W.hgTabAlertsRun({ force: true, cleanOnly: true });
assert(run.pushed === 3 && W._tg && W._tg.indexOf('SOLUSD') >= 0 && W._tg.indexOf('XAUUSD') < 0,
       'clean-only telegram skips gold tally-only, includes swing/best/brain');
assert(W._tg.indexOf('7/7 CLEAN') >= 0, 'telegram body tags 7/7 clean batch');

const runAll = await W.hgTabAlertsRun({ force: true, cleanOnly: false, prevKeys: {} });
assert(runAll.pushed === 3, 'unified batch without gold when separate mode on');

const WI = loadWithWindow({
  swingScan: () => null,
  scalpScan: () => null,
  edgeScan: () => null,
  __hgBrainLast: () => ({ rows: [{ sym: 'BOOKED', dir: 'long', tier: 'ASIDE', evidence: [] }] }),
  brainInvAlertsOn: () => true,
  hgBrainInvAlertsFromLast: function(){
    WI._invCalled = true;
    return 1;
  },
  sendTelegram: async () => true
});
WI.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const invRun = await WI.hgTabAlertsRun({ force: true });
assert(WI._invCalled === true, 'hgTabAlertsRun calls hgBrainInvAlertsFromLast when inv alerts ON');
assert(invRun.invalidation === 1, 'invalidation count returned on cycle run');

const WOff = loadWithWindow({
  brainInvAlertsOn: () => false,
  hgBrainInvAlertsFromLast: function(){ WOff._invCalled = true; return 1; },
  sendTelegram: async () => true
});
WOff.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
await WOff.hgTabAlertsRun({ force: true });
assert(WOff._invCalled !== true, 'brainInvAlertsOn false skips invalidation hook');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
