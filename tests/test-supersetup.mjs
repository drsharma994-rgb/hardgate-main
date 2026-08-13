/* HARDGATE — supersetup.js v1.1 unit tests (Node 18+, no network). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({
  window: {},
  document: { head: { appendChild: function(){} }, createElement: function(){ return { id: '', textContent: '' }; } }
});
ctx.window = ctx;
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8'), ctx, { filename: 'supersetup.js' });
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

ok(typeof W.superSetupCalc === 'function', 'superSetupCalc exported');
ok(typeof W.superSetupPickEntry === 'function', 'superSetupPickEntry exported');
ok(typeof W.superSetupGetScannerContext === 'function', 'superSetupGetScannerContext exported');

const passLong = W.superSetupCalc({ balance: 1000, riskPct: 1, entry: 100, stop: 98, rr: 2, maxLeverage: 10 });
ok(passLong.ok === true, 'long 2% stop 1% risk passes');
ok(Math.abs(passLong.riskUsd - 10) < 1e-9, 'riskUsd alias populated');
ok(Math.abs(passLong.tp - 104) < 1e-9, 'TP at 2R for long');

const badStop = W.superSetupCalc({ balance: 1000, riskPct: 1, entry: 100, stop: 100 });
ok(badStop.ok === false && /Stop-loss/.test(badStop.reason), 'equal entry/stop blocked');

const highLev = W.superSetupCalc({ balance: 1000, riskPct: 5, entry: 100, stop: 99.9, rr: 2, maxLeverage: 2 });
ok(highLev.ok === false && /Leverage/.test(highLev.reason), 'excessive leverage blocked');

const chart = { lastPrice: 100, ema21: 101, ema50: 99, swingLow: 95, swingHigh: 105, atr: 2 };
ok(Math.abs(W.superSetupPickEntry('Long', chart, null) - 100) < 1e-9, 'pickEntry long uses lastPrice in bull EMA stack');
ok(Math.abs(W.superSetupPickStop('Long', chart, null, 100) - (95 - 0.4)) < 1e-9, 'pickStop long uses swingLow - 0.2×ATR');

W.HG_bestSetup = { entry: 50, stop: 48, rr: 3, symbol: 'ETHUSDT' };
ok(W.superSetupGetScannerContext(W, null) === W.HG_bestSetup, 'scanner context from window global');
ok(W.superSetupPickRR(W.HG_bestSetup) === 3, 'pickRR reads scanner rr');
ok(Math.abs(W.superSetupPickEntry('Long', chart, W.HG_bestSetup) - 50) < 1e-9, 'pickEntry prefers scanner entry');

const store = { _m: {}, getItem(k){ return this._m[k] || null; }, setItem(k,v){ this._m[k] = v; } };
store.setItem('HG_signal', JSON.stringify({ symbol: 'SOLUSDT', entry: 10, stop: 9 }));
ok(W.superSetupGetScannerContext({}, store).symbol === 'SOLUSDT', 'scanner context from localStorage');

const src = fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8');
ok(/Super Setup v1\.1\.0/.test(src), 'badge shows v1.1.0');
ok(/ss-use-chart/.test(src) && /ss-use-scan/.test(src), 'chart + scanner fill buttons');
ok(/getScannerContext/.test(src) && /pickEntry/.test(src), 'structure helpers present');

const tab = (W.HG_tabs || []).find(function(t){ return t && t.id === 'super-setup'; });
ok(!!tab && typeof tab.refresh === 'function', 'HG_tabs refresh hook');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
