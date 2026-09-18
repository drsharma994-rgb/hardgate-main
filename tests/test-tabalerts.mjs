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
  setupIsClean7, tabAlertsFilterClean7, tabAlertsFilterCryptoConvicted, tabAlertsCleanOnlyEnabled,
  tabAlertsGoldSeparateEnabled, tabAlertsGoldConvictedOnlyEnabled,
  tabAlertsCryptoConvictedOnlyEnabled, goldIsMostConvinced } = lib;

assert(typeof hgTabAlertsFresh === 'function', 'hgTabAlertsFresh exported');
assert(GAP_MS === 5 * 60 * 1000, '5-min dedup gap');
assert(GOLD_MIN_TALLY === 10, 'gold min tally default 10');
assert(tabAlertsCleanOnlyEnabled({ localStorage: { getItem: () => null } }) === true,
       'clean-only Telegram default ON');
assert(tabAlertsGoldSeparateEnabled({ localStorage: { getItem: () => null } }) === true,
       'gold separate alert batch default ON');
assert(tabAlertsGoldConvictedOnlyEnabled({ localStorage: { getItem: () => null } }) === true,
       'gold convicted-only default ON');
assert(tabAlertsCryptoConvictedOnlyEnabled({ localStorage: { getItem: () => null } }) === true,
       'crypto convicted-only default ON');
assert(tabAlertsFilterCryptoConvicted([
  { src: 'SWING', sym: 'A', dir: 'long', entry: 1, stop: 0.9, t1: 1.1, clean7: true, cryptoConvicted: true },
  { src: 'SWING', sym: 'B', dir: 'long', entry: 2, stop: 1.9, t1: 2.2, clean7: true, cryptoConvicted: false },
  { src: 'SWING', sym: 'C', dir: 'long', entry: 3, stop: 2.9, t1: 3.2, nearClean: true, gatesPassed: 6 }
]).length === 1, 'crypto convicted keeps only MOST PROBABLE clean SWING, drops NEAR');

const WNearBlock = loadWithWindow({
  swingScan: () => ({
    cands: [],
    nearCands: [{ sym: 'NEARUSD', dir: 'long', entry: 100, stop: 98, t1: 106, nearClean: true, gatesPassed: 6, gatesTotal: 7 }]
  }),
  scalpScan: () => null,
  sendTelegram: async () => true
});
WNearBlock.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const nearBlockRun = await WNearBlock.hgTabAlertsRun({ force: true, sources: { swing: true } });
assert(nearBlockRun.pushed === 0, 'crypto convicted default blocks 6/7 NEAR from Telegram');
assert(goldIsMostConvinced({ id: 'a', grade: 'A', locked: true, vetoed: false }, { bestId: 'b' }) === true,
       'grade-A locked counts as most convinced');
assert(!goldIsMostConvinced({ id: 'x', grade: 'B', tally: 8 }, { bestId: 'y' }), 'grade-B non-best excluded');

const goldThrottle = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
tabAlertsMarkRun({ localStorage: goldThrottle }, LS_GOLD_LAST_RUN);
assert(tabAlertsShouldRun({ localStorage: goldThrottle }, false, LS_GOLD_LAST_RUN) === false,
       'gold batch has its own 5-min throttle');

assert(setupIsClean7({ src: 'SWING', sym: 'X', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, clean7: true }), 'SWING rows with clean7 flag pass');
assert(!setupIsClean7({ src: 'SWING', sym: 'X', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, nearClean: true, gatesPassed: 6 }), 'SWING near rows are not clean7');
assert(setupIsClean7({ src: 'EDGE', clean7: true, gatesPassed: 7, gatesTotal: 7 }), 'explicit clean7 passes');
assert(!setupIsClean7({ src: 'GOLD SCALP', tally: 11, entry: 1, stop: 0.9, t1: 1.2 }), 'gold tally-only is not clean7');
assert(tabAlertsFilterClean7([
  { src: 'SWING', sym: 'A', dir: 'long', entry: 1, stop: 0.9, t1: 1.1, clean7: true },
  { src: 'EDGE', sym: 'B', dir: 'short', entry: 2, stop: 2.1, t1: 1.8, tally: 6 }
]).length === 1, 'clean7 filter keeps flagged SWING when EDGE lacks clean flag');
assert(tabAlertsFilterClean7([
  { src: 'SWING', sym: 'A', dir: 'long', entry: 1, stop: 0.9, t1: 1.1, nearClean: true, gatesPassed: 6 }
]).length === 1, 'clean7 filter keeps 6/7 NEAR rows');

const throttleStore = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const nowT = 1_700_000_000_000;
tabAlertsMarkRun({ localStorage: throttleStore });
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false) === false, '5-min cycle throttle blocks immediate re-run');
assert(tabAlertsShouldRun({ localStorage: throttleStore }, true) === true, 'force bypasses cycle throttle');
throttleStore.setItem(LS_LAST_RUN, String(nowT - GAP_MS - 1));
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false) === true, 'cycle throttle opens after 5 min');

const now = 1_700_000_000_000;
const s1 = { src: 'SWING', sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean7: true };
const k1 = setupKey(s1);
const fr1 = hgTabAlertsFresh({}, [s1], now, GAP_MS);
assert(fr1.fresh.length === 1 && fr1.fresh[0].sym === 'BTCUSD', 'first sighting is fresh');
assert(fr1.keys[k1] === now, 'key stamped');

const fr2 = hgTabAlertsFresh(fr1.keys, [s1], now + 60000, GAP_MS);
assert(fr2.fresh.length === 0, 'same setup inside 5-min window is not re-alerted');

const fr3 = hgTabAlertsFresh(fr1.keys, [s1], now + GAP_MS + 1, GAP_MS);
assert(fr3.fresh.length === 1, 'same setup after 5 min can alert again');

const nearBody = hgTabAlertsFormat([{ src: 'SWING', sym: 'NEARUSD', dir: 'long', entry: 50, stop: 48, t1: 55, nearClean: true, gatesPassed: 6, tier: '6/7 NEAR', note: 'missing: G7 CUSUM — watch only' }]);
assert(nearBody.indexOf('6/7 NEAR') >= 0, 'near-clean header labels 6/7 honestly');
assert(!/· 7\/7 CLEAN/.test(nearBody), 'near row extra line is not tagged 7/7 CLEAN');

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
assert(collected.some(c => c.src === 'BEST' && c.clean7 && c.tier === 'MOST PROBABLE #1'), 'best collect is #1 only with tier tag');

const WDual = loadWithWindow({
  swingScan: () => ({
    bestId: 'Delta India|BTCUSD|long@95000',
    cands: [
      { id: 'Delta India|BTCUSD|long@95000', sym: 'BTCUSD', dir: 'long', entry: 95000, stop: 94000, t1: 97500, rr: 2.5 },
      { id: 'CoinDCX|ETHUSD|long@3500', sym: 'ETHUSD', dir: 'long', entry: 3500, stop: 3400, t1: 3700, rr: 2 }
    ]
  }),
  scalpScan: () => null,
  edgeScan: () => null,
  bestScan: () => ({ clean: [] }),
  __hgBrainLast: () => null,
  goldscalpScan: () => null,
  goldswingScan: () => null
});
assert(WDual.hgTabAlertsCollect().some(c => c.src === 'SWING' && c.tier === 'MOST PROBABLE'),
       'swing MOST PROBABLE tier from bestId');
assert(typeof W.hgTabAlertsCheckLive === 'function', 'hgTabAlertsCheckLive exported');
assert(collected.some(c => c.src.indexOf('BRAIN') >= 0 && c.clean7), 'brain 7/7 evidence included');
assert(!collected.some(c => c.src.indexOf('GOLD') >= 0), 'gold excluded from unified collect when separate');

const WNear = loadWithWindow({
  swingScan: () => ({
    cands: [],
    nearCands: [{
      sym: 'NEARUSD', dir: 'long', entry: 100, stop: 98, t1: 106, rr: 2.5,
      nearClean: true, gatesPassed: 6, gatesTotal: 7, missing: ['G7 CUSUM']
    }]
  }),
  scalpScan: () => null,
  bestScan: () => ({ clean: [] }),
  __hgBrainLast: () => null,
  goldscalpScan: () => null,
  goldswingScan: () => null,
  sendTelegram: async (t) => { WNear._tg = t; return true; }
});
WNear.localStorage = { _m: { hgAlertCryptoConvictedOnly: '0' }, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
const nearCol = WNear.hgTabAlertsCollect();
assert(nearCol.length === 1 && nearCol[0].nearClean === true && nearCol[0].entry === 100,
       'collectCrypto pulls 6/7 nearCands from swingScan snap with levels');
const nearRun = await WNear.hgTabAlertsRun({ force: true, allSources: false, sources: { swing: true, scalp: false, brain: false, gold: false, edge: false, pine: false, smart: false, oiflow: false, liqs: false, squeeze: false, carry: false, termbasis: false, watch: false, best: false } });
assert(nearRun.pushed === 1 && WNear._tg.indexOf('ENTRY:') >= 0 && WNear._tg.indexOf('STOP LOSS:') >= 0
       && WNear._tg.indexOf('TAKE PROFIT 1:') >= 0 && WNear._tg.indexOf('6/7') >= 0,
       '6/7 NEAR Telegram includes COIN entry stop tp');

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
WP.localStorage = { _m: { hgAlertCryptoConvictedOnly: '0' }, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
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
WS.localStorage = { _m: { hgAlertCryptoConvictedOnly: '0' }, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
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


/* ---------------------------------------------------------------------
   80PERCENT ladder rows (hg-v813)

   The tab publishes __hg80Alerts; this file only formats and de-duplicates
   it. The tests that matter are the ones that would have caught the change
   shipping as a silent no-op: both default-on filters are allowlists that
   reject what they do not recognise.
   --------------------------------------------------------------------- */
const { setupIsP80, setupIsTelegramEligible, collectP80, p80CandleLive,
  p80Note, P80_MAX_AGE_MS, P80_KEY_TTL_MS, tabAlertSourcesAll } = lib;

assert(typeof collectP80 === 'function', 'collectP80 exported');
assert(tabAlertSourcesAll().p80 === true, 'p80 is a source in tabAlertSourcesAll');

const p80Row = { src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', entry: 3900,
  stop: 3880, t1: 3904, p80: true, p80Key: '5m:1000', tier: '80% TAKEABLE' };
assert(setupIsP80(p80Row) === true, 'p80 row recognised by its own mark');
assert(setupIsClean7(p80Row) === false, 'a p80 row does NOT claim 7/7 CLEAN');
assert(setupIsTelegramEligible(p80Row) === true, 'p80 row survives the clean-only filter');
assert(tabAlertsFilterClean7([p80Row]).length === 1, 'clean-only filter keeps a p80 row');
assert(tabAlertsFilterCryptoConvicted([p80Row]).length === 1,
       'crypto-convicted filter keeps a p80 row');
const p80Watch = Object.assign({}, p80Row, { watch: true, tier: '80% ARMED' });
assert(tabAlertsFilterCryptoConvicted([p80Watch]).length === 1,
       'crypto-convicted filter keeps a p80 ARMED row (it rejects every other watch row)');
assert(tabAlertsFilterCryptoConvicted([
  { src: 'SWING WATCH', sym: 'A', dir: 'long', entry: 1, stop: 0.9, t1: 1.1, watch: true }
]).length === 0, 'and still rejects a non-p80 watch row');
/* the format line that would have lied */
assert(hgTabAlertsFormat([Object.assign({ tally: null, rr: null, note: 'x' }, p80Row)])
         .indexOf('7/7 CLEAN') < 0, 'a p80 row never prints a gate count it does not keep');

/* THE KEY. One rung, one side, one candle — and it must not collapse the
   ladder the way the default watch key would. */
const k5 = setupKey({ src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', p80: true, p80Key: '5m:600', watch: true });
const k15 = setupKey({ src: '80PERCENT 15m', sym: 'XAUUSD', dir: 'long', p80: true, p80Key: '15m:600', watch: true });
const k5b = setupKey({ src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', p80: true, p80Key: '5m:900', watch: true });
assert(k5 !== k15, '5m and 15m armed longs are different keys');
assert(k5 !== k5b, 'a later candle on the same rung is a new key');
assert(k5.indexOf(':p80:') >= 0, 'p80 keys are marked so the expiry can exempt them');
/* The rung separation above comes from src, not from this branch. What the
   branch is FOR is the candle: without it these two claims — different
   bars, different levels to come — share one key and the second is read as
   a repeat of the first. */
assert(setupKey({ src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', watch: true })
       === setupKey({ src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', watch: true }),
       'default watch key is identical across two different candles');
assert(setupKey({ src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', watch: true, p80: true, p80Key: '5m:600' })
       !== setupKey({ src: '80PERCENT 5m', sym: 'XAUUSD', dir: 'long', watch: true, p80: true, p80Key: '5m:900' }),
       'the p80 branch is what separates them');

/* THE EXPIRY. A still-armed 4h row must not be pushed every five minutes. */
const p80now0 = 1_700_000_000_000;
const armedList = [{ src: '80PERCENT 4h', sym: 'XAUUSD', dir: 'long', entry: 3900, stop: 3880,
  t1: 3904, watch: true, p80: true, p80Key: '4h:1', tally: null, rr: null }];
const p80fr1 = hgTabAlertsFresh({}, armedList, p80now0, GAP_MS);
assert(p80fr1.fresh.length === 1, 'an armed p80 row is fresh the first time');
const p80fr2 = hgTabAlertsFresh(p80fr1.keys, armedList, p80now0 + 40 * 60 * 1000, GAP_MS);
assert(p80fr2.fresh.length === 0, 'the same armed candle is NOT re-pushed 40 minutes later');
const p80fr3 = hgTabAlertsFresh(p80fr1.keys, armedList, p80now0 + P80_KEY_TTL_MS + 1000, GAP_MS);
assert(p80fr3.fresh.length === 1, 'past the p80 TTL the key is dropped so the map cannot grow forever');
/* and the exemption is confined to p80 — every other source keeps the gap */
const otherList = [{ src: 'SWING', sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9, t1: 12, tally: null, rr: null }];
const p80of1 = hgTabAlertsFresh({}, otherList, p80now0, GAP_MS);
assert(hgTabAlertsFresh(p80of1.keys, otherList, p80now0 + GAP_MS + 1000, GAP_MS).fresh.length === 1,
       'a non-p80 key still expires on the 5-minute gap');

/* AN UNREAD VENUE MAKES NO CLAIM.

   hg80Breakeven returns net:null when the venue could not be priced, and
   fin(+null) is fin(0) is true — so the first draft of this note told a
   reader their setup 'needs 0.0% at this venue', which is both the most
   flattering number available and arithmetic that was never done. */
const unpriced = p80Note({ tf: '5m', variant: 'SPEC',
  be: { gross: 0.842105, net: null, cost: null } }, 'setup');
assert(unpriced.indexOf('0.0%') < 0, 'an unpriced venue never reports a 0.0% breakeven');
assert(unpriced.indexOf('84.2% gross') >= 0 && unpriced.indexOf('venue cost unread') >= 0,
       'it falls back to the gross breakeven and says the cost was not read');
assert(p80Note({ tf: '5m', variant: 'SPEC', be: { gross: 0.842, net: 0.861 } }, 'setup')
         .indexOf('86.1% at this venue') >= 0,
       'and reports the net breakeven when the venue WAS priced');
assert(p80Note({ tf: '5m', variant: 'SPEC', be: null }, 'setup').indexOf('needs') < 0,
       'no breakeven at all claims nothing');
assert(p80Note({ tf: '5m', variant: 'MID', be: null, closesIn: null }, 'watch')
         .indexOf('closed in 0m') < 0, 'and a null countdown is not printed as 0m');
assert(p80Note({ tf: '5m', variant: 'MID', be: null, closesIn: 240 }, 'watch')
         .indexOf('closed in 4m') >= 0, 'a real countdown is');

/* THE TWO AGE TESTS. */
const nowSec = 1_700_000;
assert(p80CandleLive({ candleT: nowSec - 100, tfSec: 300 }, nowSec) === true,
       'a candle still open is live');
assert(p80CandleLive({ candleT: nowSec - 400, tfSec: 300 }, nowSec) === false,
       'a candle that already closed is dead — its claim is settled');
assert(p80CandleLive({ candleT: nowSec, tfSec: null }, nowSec) === false,
       'no timeframe means no claim about liveness');

function p80Win(pub, extra){
  const w = Object.assign({ sendTelegram: async () => true }, extra || {});
  if (pub !== undefined) w.__hg80Alerts = pub;
  const loaded = loadWithWindow(w);
  loaded.localStorage = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
  return loaded;
}

const nowMs = Date.now();
const freshPub = {
  t: nowMs,
  setups: [{ sym: 'XAUUSD', tf: '15m', tfSec: 900, band: 'scalp', variant: 'SPEC', dir: 'long',
             entry: 3900, stop: 3880, t1: 3904, candleT: Math.floor(nowMs / 1000) - 60,
             be: { gross: 0.842, net: 0.861, cost: 0.4, risk: 20, target: 3.75 } }],
  watch: [{ sym: 'XAUUSD', tf: '5m', tfSec: 300, band: 'scalp', variant: 'MID', dir: 'short',
            entry: 3900, stop: 3920, t1: 3896, candleT: Math.floor(nowMs / 1000) - 60,
            closesIn: 240, be: { gross: 0.842, net: 0.858 } }]
};
const W80 = p80Win(freshPub);
const p80Collected = W80.hgTabAlertsCollect().filter(x => x.p80);
assert(p80Collected.length === 2, 'collectP80 emits the takeable setup and the armed row');
assert(p80Collected.every(x => x.sym === 'XAUUSD'), 'p80 rows carry the ladder symbol');
assert(p80Collected.some(x => x.watch === true), 'the armed row is marked watch');
assert(p80Collected.every(x => x.src.indexOf('SCALP') < 0 && x.src.indexOf('SWING') < 0),
       'no p80 src carries a band name that the crypto source rules would claim');
assert(p80Collected.every(x => x.clean7 !== true), 'no p80 row is marked 7/7 clean');
assert(p80Collected.every(x => x.rr === null),
       'rr is left unset — this desk risks more than it targets and an R multiple would misread');
assert(p80Collected.every(x => /84\.2|86\.1|85\.8/.test(String(x.note))),
       'every p80 note states the hit rate the geometry needs');

const p80Run = await W80.hgTabAlertsRun({ force: true, dryRun: true });
assert(p80Run.pushed === 2, 'both p80 rows survive the default filters end to end');
assert(p80Run.body.indexOf('80PERCENT 15m') >= 0, 'the message names the rung');
assert(p80Run.body.indexOf('7/7 CLEAN') < 0, 'and claims no gate count');

/* the source switch */
const p80Off = await p80Win(freshPub).hgTabAlertsRun({ force: true, dryRun: true, sources: { swing: true } });
assert(p80Off.pushed === 0, 'p80 rows are withheld when the p80 source is off');
const p80Only = await p80Win(freshPub).hgTabAlertsRun({ force: true, dryRun: true, sources: { p80: true } });
assert(p80Only.pushed === 2, 'and sent when it is the only source on');

/* a stale publication is not a state */
const stalePub = JSON.parse(JSON.stringify(freshPub));
stalePub.t = nowMs - P80_MAX_AGE_MS - 1000;
assert(p80Win(stalePub).hgTabAlertsCollect().filter(x => x.p80).length === 0,
       'a publication older than the age cap contributes nothing');

/* a dead candle inside a fresh publication — the case the age cap misses */
const deadPub = JSON.parse(JSON.stringify(freshPub));
deadPub.t = nowMs - 4 * 60 * 1000;
deadPub.watch[0].candleT = Math.floor(nowMs / 1000) - 3000;
const deadRows = p80Win(deadPub).hgTabAlertsCollect().filter(x => x.p80);
assert(deadRows.length === 1 && deadRows[0].watch !== true,
       'a fresh scan carrying a closed armed candle sends the setup and drops the armed row');

/* nothing published at all */
assert(p80Win(undefined).hgTabAlertsCollect().filter(x => x.p80).length === 0,
       'no publication contributes nothing rather than throwing');
assert(p80Win({ t: nowMs, setups: [], watch: [] }).hgTabAlertsCollect().filter(x => x.p80).length === 0,
       'an empty publication contributes nothing');

/* A ROW WHOSE CANDLE CANNOT BE NAMED IS NOT SENT. Without this, String(NaN)
   would give every such row on a rung one key, and the dedup that makes an
   armed candle one message would silently stop working. */
const { p80Key } = lib;
assert(p80Key({ tf: '5m', candleT: 600 }) === '5m:600', 'a nameable candle keys on rung and time');
assert(p80Key({ tf: '5m', candleT: NaN }) === null, 'an unnameable candle has no key');
assert(p80Key({ tf: '5m', candleT: null }) === null, 'and null is not coerced to candle zero');
assert(p80Key({ candleT: 600 }) === null, 'a row with no rung has no key either');
const namelessPub = { t: nowMs, setups: [{ sym: 'XAUUSD', tf: '5m', tfSec: 300, dir: 'long',
  entry: 3900, stop: 3880, t1: 3904, candleT: null }], watch: [] };
assert(p80Win(namelessPub).hgTabAlertsCollect().filter(x => x.p80).length === 0,
       'and a row without one is dropped rather than sent under a shared key');

/* a row the tab published without usable levels must not become a ticket */
assert(p80Win({ t: nowMs, setups: [{ sym: 'XAUUSD', tf: '5m', tfSec: 300, dir: 'long',
  entry: 3900, stop: 3900, t1: 3904, candleT: Math.floor(nowMs / 1000) }], watch: [] })
  .hgTabAlertsCollect().filter(x => x.p80).length === 0,
  'a zero-width stop is rejected by pushSetup like any other source');


console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
