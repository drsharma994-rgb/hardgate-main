/* HARDGATE — supersetup.js v1.3 unit tests (Node 18+, no network). */
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
ok(typeof W.superSetupBuildSnap === 'function', 'superSetupBuildSnap exported');
ok(typeof W.superSetupRunScan === 'function', 'superSetupRunScan exported');

const passLong = W.superSetupCalc({ balance: 1000, riskPct: 1, entry: 100, stop: 98, rr: 2, maxLeverage: 10 });
ok(passLong.ok === true, 'long 2% stop 1% risk passes');

const chart = { lastPrice: 100, ema21: 101, ema50: 99, swingLow: 95, swingHigh: 105, atr: 2 };
ok(Math.abs(W.superSetupPickEntry('Long', chart, null) - 100) < 1e-9, 'pickEntry long uses lastPrice in bull EMA stack');

const idle = W.superSetupEvaluate(W, {});
ok(idle.ready === false && idle.idle === true, 'idle when no scanner or structure');

const now = Date.now();
W.swingScan = function(){
  return {
    at: now,
    cands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, rr: 2, venueTag: 'Delta India' }],
    nearCands: [{ sym: 'B-ETH_USDT', dir: 'short', entry: 2000, stop: 2050, rr: 1.8, nearClean: true, gatesPassed: 6, venueTag: 'CoinDCX' }],
    audit: { uniLen: 120 }
  };
};
const snap = W.superSetupBuildSnap(W, { balance: 1000, riskPct: 1, maxLeverage: 10 });
ok(snap.cands.length === 2, 'desk snap merges CLEAN + NEAR from swingScan');
ok(snap.cands.some(function(c){ return c.tier === 'clean'; }), 'snap includes CLEAN row');
ok(snap.cands.some(function(c){ return c.tier === 'near'; }), 'snap includes NEAR row');

W.superSetupScan = function(){ return snap; };
const ready = W.superSetupEvaluate(W, {});
ok(ready.ready === true && ready.mode === 'scanner', 'evaluate opens on universe desk snap');

delete W.superSetupScan;
delete W.swingScan;
W.HG_chart = {
  lastPrice: 100, ema21: 102, ema50: 98, swingLow: 94, swingHigh: 106, atr: 2,
  lastBOS: { dir: 'up', level: 105, i: 90 }
};
const structReady = W.superSetupEvaluate(W, {});
ok(structReady.ready === true && structReady.mode === 'structure', 'structure path when no scan snap');

const src = fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8');
ok(/Super Setup v1\.3\.0/.test(src), 'badge shows v1.3.0');
ok(/SCAN_INTERVAL_MS = 15 \* 60 \* 1000/.test(src), '15 minute scan interval');
ok(/ss-desk/.test(src) && /cryptoScanWarm/.test(src), 'universe desk + dual venue warm');

const warm = (W.HG_warmups || []).find(function(w){ return w && w.id === 'super-setup'; });
ok(!!warm && typeof warm.run === 'function', 'HG_warmups super-setup registered');

const tab = (W.HG_tabs || []).find(function(t){ return t && t.id === 'super-setup'; });
ok(!!tab && typeof tab.refresh === 'function', 'HG_tabs refresh hook');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
