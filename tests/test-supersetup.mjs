/* HARDGATE — supersetup.js v1.2 unit tests (Node 18+, no network). */
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
ok(typeof W.superSetupEvaluate === 'function', 'superSetupEvaluate exported');
ok(typeof W.superSetupCollectScanHits === 'function', 'superSetupCollectScanHits exported');

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

const idle = W.superSetupEvaluate(W, {});
ok(idle.ready === false && idle.idle === true, 'idle when no scanner or structure');

W.HG_bestSetup = { entry: 50, stop: 48, rr: 3, symbol: 'ETHUSDT', dir: 'long' };
const scanCtx = W.superSetupGetScannerContext(W, null);
ok(scanCtx && scanCtx.entry === 50 && scanCtx.source === 'selected', 'scanner context from HG_bestSetup hit');
ok(W.superSetupPickRR(W.HG_bestSetup) === 3, 'pickRR reads scanner rr');

delete W.HG_bestSetup;
delete W.HG_selectedSetup;
W.bestScan = function(){
  return { at: Date.now(), clean: [{ sym: 'BTCUSDT', dir: 'short', entry: 60000, stop: 61000, rr: 2.5 }] };
};
const ready = W.superSetupEvaluate(W, {});
ok(ready.ready === true && ready.mode === 'scanner' && ready.side === 'Short', 'opens on CLEAN bestScan ticket');
ok(Math.abs(ready.entry - 60000) < 1e-9, 'scanner entry populated');

delete W.bestScan;
delete W.HG_chart;
const chartBos = {
  lastPrice: 100, ema21: 102, ema50: 98, swingLow: 94, swingHigh: 106, atr: 2,
  lastBOS: { dir: 'up', level: 105, i: 90 }
};
W.HG_chart = chartBos;
const structReady = W.superSetupEvaluate(W, {});
ok(structReady.ready === true && structReady.mode === 'structure', 'opens on chart BOS + EMA alignment');
ok(structReady.trigger === 'bos', 'BOS trigger recorded');

W.hgStructureGate = function(rows, dir){
  return dir === 'long' ? { veto: true, choch: true, note: 'CHoCH against long' } : { bos: true, note: 'ok' };
};
const rows = Array.from({ length: 80 }, function(_, i){
  return { o: 100, h: 101, l: 99, c: 100 + (i > 70 ? 0.5 : 0) };
});
const veto = W.superSetupEvaluateStructure(W, 'Long', rows, chartBos);
ok(veto.valid === false && /CHoCH/.test(veto.reason), 'structure CHoCH veto blocks long');

const store = { _m: {}, getItem(k){ return this._m[k] || null; }, setItem(k,v){ this._m[k] = v; } };
store.setItem('HG_signal', JSON.stringify({ symbol: 'SOLUSDT', dir: 'long', entry: 10, stop: 9 }));
ok(W.superSetupGetScannerContext({}, store).sym === 'SOLUSDT', 'scanner context from localStorage fallback');

const src = fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8');
ok(/Super Setup v1\.2\.0/.test(src), 'badge shows v1.2.0');
ok(/ss-idle/.test(src) && /evaluateSetup/.test(src), 'idle gate + evaluateSetup present');
ok(/bestScan/.test(src) && /swingScan/.test(src), 'wired to Hardgate scan publishers');

const tab = (W.HG_tabs || []).find(function(t){ return t && t.id === 'super-setup'; });
ok(!!tab && typeof tab.refresh === 'function', 'HG_tabs refresh hook');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
