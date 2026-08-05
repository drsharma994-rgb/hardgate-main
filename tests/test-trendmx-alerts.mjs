/* HARDGATE — TREND MATRIX golden-cross Telegram alerts (tabalerts.js). */
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
    module: { exports: {} }, console, Math, JSON, Date, Promise,
    isFinite, parseInt, String, Object, Array,
    localStorage: { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'tabalerts.js'), 'utf8'), sandbox, { filename: 'tabalerts.js' });
  return sandbox;
}

const lib = loadTabAlerts().module.exports;
const {
  trendmxCrossSetupKey, trendmxCrossFreshKeys, hgTrendmxCrossAlertFormat,
  hgTrendmxCrossAlertsRun, TRENDMX_CROSS_GAP_MS, TRENDMX_ALERT_CYCLE_MS,
  LS_TRENDMX_LAST_RUN, tabAlertsShouldRun, tabAlertsMarkRun
} = lib;

assert(typeof hgTrendmxCrossAlertsRun === 'function', 'hgTrendmxCrossAlertsRun exported');
assert(TRENDMX_CROSS_GAP_MS === 10 * 24 * 60 * 60 * 1000, '10-day golden-cross dedup window');
assert(TRENDMX_ALERT_CYCLE_MS === 15 * 60 * 1000, '15-min trend matrix alert cycle');

const setup = {
  sym: 'SOLUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, t2: 117.5,
  score: 4, adx: 28, conviction: 'STRONG CONVICTION', tier: 'STRONG', prime: true,
  freshCross: 'GOLDEN', note: '⚡GOLDEN CROSS test'
};
const key = trendmxCrossSetupKey(setup);
assert(key === 'TRENDMX:GOLDEN:SOLUSDT:long', 'cross setup key is per symbol');

const now = 1_700_000_000_000;
const fr1 = trendmxCrossFreshKeys({}, [setup], now, TRENDMX_CROSS_GAP_MS);
assert(fr1.fresh.length === 1, 'first golden cross is fresh');

const fr2 = trendmxCrossFreshKeys(fr1.keys, [setup], now + 60000, TRENDMX_CROSS_GAP_MS);
assert(fr2.fresh.length === 0, 'same symbol inside dedup window is held');

const body = hgTrendmxCrossAlertFormat(setup);
assert(body.indexOf('TREND MATRIX GOLDEN CROSS') >= 0, 'format names golden cross');
assert(body.indexOf('COIN: SOLUSDT') >= 0 && body.indexOf('STOP LOSS:') >= 0
       && body.indexOf('TAKE PROFIT 1:') >= 0, 'format includes plan levels');
assert(body.indexOf('STRONG CONVICTION') >= 0, 'format includes conviction');

assert(body.indexOf('15-min alert cycle') >= 0, 'format states 15-min cycle');

const throttleStore = { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } };
tabAlertsMarkRun({ localStorage: throttleStore }, LS_TRENDMX_LAST_RUN);
assert(tabAlertsShouldRun({ localStorage: throttleStore }, false, LS_TRENDMX_LAST_RUN, TRENDMX_ALERT_CYCLE_MS) === false,
       'trendmx 15-min cycle throttle blocks immediate re-run');

const W = loadTabAlerts();
W.window.trendmxCrossState = () => ({
  at: Date.now(),
  goldenCross: [setup, {
    sym: 'AVAXUSDT', dir: 'long', entry: 40, stop: 38, t1: 44, t2: 47,
    score: 3, adx: 26, conviction: 'CONVICTION', tier: 'CONVICTION', prime: false,
    freshCross: 'GOLDEN', note: '⚡GOLDEN CROSS'
  }]
});
W.window.sendTelegram = async (t) => { W._msgs = W._msgs || []; W._msgs.push(t); return true; };

const run = await W.window.hgTrendmxCrossAlertsRun({ skipWarm: true, window: W.window });
assert(run.pushed === 2 && W._msgs.length === 2, 'sends one Telegram per fresh golden cross');
assert(W._msgs[0] !== W._msgs[1], 'each alert is a separate message');

const run2 = await W.window.hgTrendmxCrossAlertsRun({ skipWarm: true, window: W.window });
assert(run2.pushed === 0 && run2.status === 'throttled-15m', 'second call inside 15-min cycle is throttled');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
