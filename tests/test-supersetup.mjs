/* HARDGATE — supersetup.js v2.0 unit tests (Node 18+, no network). */
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

ok(typeof W.superSetupBuildSnap === 'function', 'superSetupBuildSnap exported');
ok(typeof W.superSetupSyncDesk === 'function', 'superSetupSyncDesk exported');
ok(typeof W.superSetupRunScan === 'function', 'superSetupRunScan exported');
ok(typeof W.calcSafeMaxLeverage === 'function', 'calcSafeMaxLeverage exported');
ok(typeof W.superSetupDeskPill === 'function', 'superSetupDeskPill exported');
var watchPill = W.superSetupDeskPill({ tier: 'near', nearClean: true, sizingPass: false, nearWatch: true });
ok(watchPill.label === 'WATCH ONLY' && watchPill.cls === 'watch', 'NEAR 6/7 always WATCH ONLY');
var unsafePill = W.superSetupDeskPill({ tier: 'near', levUnsafe: true });
ok(unsafePill.label === 'LEV UNSAFE', 'NEAR lev above safe max → LEV UNSAFE');

ok(W.calcSafeMaxLeverage(100, 98) === 28, 'safe max lev matches hgSafeLevChip formula');

const now = Date.now();
W.swingScan = function(){
  return {
    at: now - 60 * 60 * 1000,
    cands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, rr: 2, t1: 104, t2: 106, venueTag: 'Delta India' }],
    nearCands: [],
    audit: { uniLen: 120 }
  };
};
W.bestScan = function(){
  return {
    at: now - 30 * 60 * 1000,
    clean: [{ sym: 'B-ETH_USDT', dir: 'short', entry: 2000, stop: 2050, rr: 2.2, t1: 1900, venueTag: 'CoinDCX' }],
    meta: { uniLen: 80, dual: true }
  };
};

const staleSnap = W.superSetupBuildSnap(W, { balance: 1000, riskPct: 1, maxLeverage: 10 });
ok(staleSnap.cands.length === 0, 'strict build ignores stale swing snap');

const hydrated = W.superSetupSyncDesk(W, { balance: 1000, riskPct: 1, maxLeverage: 10 });
ok(hydrated.cands.length === 2, 'syncDesk hydrates from stale swing + best snaps');
ok(hydrated.hydrated === true, 'hydrated flag set');
ok(hydrated.cands.every(function(r){ return Number.isFinite(r.safeMaxLev); }), 'rows carry safeMaxLev');
ok(hydrated.cands.some(function(r){ return r.minimalLossPass === true; }), 'at least one minimalLossPass row');

const ready = W.superSetupEvaluate(W, {});
ok(ready.ready === true && ready.mode === 'scanner', 'evaluate opens after hydrate');
ok(Number.isFinite(ready.safeMaxLev), 'evaluate passes safeMaxLev');

const src = fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8');
ok(/Super Setup v2\.0\.2/.test(src), 'badge shows v2.0.2');
ok(/refineSuperSetupLevels/.test(src) && /hgBestLevels/.test(src), 'exact entry pipeline wired');
ok(/minimalLossPass/.test(src) && /calcSafeMaxLeverage/.test(src), 'minimal-loss gate + safe lev');
ok(/syncDeskFromExisting/.test(src) && /bestScan/.test(src), 'instant hydrate + best desk');
ok(/scanPromise/.test(src), 'scan queue prevents busy drop');
ok(/ss-send-trade/.test(src), 'Send to Trade Plan button');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blIdx = html.indexOf('best-levels.js');
const ssIdx = html.indexOf('supersetup.js');
ok(blIdx >= 0 && ssIdx > blIdx, 'supersetup.js loads after best-levels.js');
ok(/supersetup\.js\?v=277/.test(html), 'supersetup.js cache-busted in index.html');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
