/* HARDGATE — supersetup.js v2.3 unit tests (Node 18+, no network). */
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
ok(typeof W.runExternalSourceAudit === 'function', 'runExternalSourceAudit exported');
ok(typeof W.runFullMinimalLossAudit === 'function', 'runFullMinimalLossAudit exported');
ok(typeof W.superSetupFqsGate === 'function', 'superSetupFqsGate exported');
ok(typeof W.runPrecisionSourceAudit === 'function', 'runPrecisionSourceAudit exported');
ok(typeof W.applySuperSetupPostGate === 'function', 'applySuperSetupPostGate exported');
ok(typeof W.superSetupSortCands === 'function', 'superSetupSortCands exported');

var _newsMock = function(){ return { risk: 'high', blackout: true, note: 'FOMC test' }; };
W.hgNewsRisk = _newsMock;
var extBlock = W.runExternalSourceAudit(W, {}, { sym: 'ETHUSD', dir: 'long', tier: 'clean' });
ok(extBlock.pass === false && /News blackout/.test((extBlock.reasons || []).join(' ')), 'news blackout blocks external audit');
delete W.hgNewsRisk;

var auditPass = W.runMinimalLossAudit(W, {}, { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tier: 'clean', scanner: 'swing' }, {});
ok(auditPass && typeof auditPass.pass === 'boolean', 'audit returns pass boolean');

var fqsStrong = W.superSetupFqsGate({
  sym: 'BTCUSD', gatesPassed: 7, entry: 100, stop: 95, t1: 110, tier: 'clean', refined: true
}, {});
ok(fqsStrong.ok === true && fqsStrong.fqs >= 62, 'FQS passes strong CLEAN BTC');

var fqsWeak = W.superSetupFqsGate({
  sym: 'SOLUSD', gatesPassed: 5, entry: 100, stop: 98, t1: 101, tier: 'clean'
}, { nearClean: true });
ok(fqsWeak.ok === false, 'FQS blocks weak alt below floor');

W.hgPostGateSetupVeto = async function(){ return { ok: true }; };
var precPending = W.runPrecisionSourceAudit(W, {}, {
  tier: 'clean', rows: [{ c: 1 }], sym: 'ETHUSD', dir: 'long', entry: 100, stop: 95, gatesPassed: 7
}, {});
ok(/Post-gate pending/.test((precPending.reasons || []).join('')), 'post-gate pending until async veto runs');
delete W.hgPostGateSetupVeto;

W.deribitVolState = function(){ return { regime: 'extreme', dvol: 90 }; };
var precDvol = W.runPrecisionSourceAudit(W, {}, { tier: 'clean', sym: 'BTCUSD', dir: 'long' }, {});
ok(/DVOL extreme/.test((precDvol.reasons || []).join('')), 'DVOL extreme blocks precision audit');
delete W.deribitVolState;

var watchPill = W.superSetupDeskPill({ tier: 'near', nearClean: true, sizingPass: false, nearWatch: true });
ok(watchPill.label === 'WATCH ONLY' && watchPill.cls === 'watch', 'NEAR 6/7 always WATCH ONLY');
var unsafePill = W.superSetupDeskPill({ tier: 'near', levUnsafe: true });
ok(unsafePill.label === 'LEV UNSAFE', 'NEAR lev above safe max → LEV UNSAFE');

ok(W.calcSafeMaxLeverage(100, 98) === 28, 'safe max lev matches hgSafeLevChip formula');

const now = Date.now();
W.swingScan = function(){
  return {
    at: now - 60 * 60 * 1000,
    cands: [{ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, rr: 2, t1: 104, t2: 106, gatesPassed: 7, venueTag: 'Delta India' }],
    nearCands: [],
    audit: { uniLen: 120 }
  };
};
W.bestScan = function(){
  return {
    at: now - 30 * 60 * 1000,
    clean: [{ sym: 'B-ETH_USDT', dir: 'short', entry: 2000, stop: 2050, rr: 2.2, t1: 1900, gatesPassed: 7, venueTag: 'CoinDCX' }],
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
ok(/Super Setup v2\.3\.0/.test(src), 'badge shows v2.3.0');
ok(/runExternalSourceAudit/.test(src) && /runPrecisionSourceAudit/.test(src), 'external + precision audits wired');
ok(/superSetupFqsGate/.test(src) && /hgMetaLabel/.test(src), 'FQS + meta-label gates wired');
ok(/applySuperSetupPostGate/.test(src) && /hgPostGateSetupVeto/.test(src), 'post-gate flow/BTC RS wired');
ok(/deribitVolWarm/.test(src), 'DVOL warm in scan cycle');
ok(/refineSuperSetupLevels/.test(src) && /hgBestLevels/.test(src), 'exact entry pipeline wired');
ok(/minimalLossPass/.test(src) && /calcSafeMaxLeverage/.test(src), 'minimal-loss gate + safe lev');
ok(/syncDeskFromExisting/.test(src) && /bestScan/.test(src), 'instant hydrate + best desk');
ok(/scanPromise/.test(src), 'scan queue prevents busy drop');
ok(/ss-send-trade/.test(src), 'Send to Trade Plan button');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blIdx = html.indexOf('best-levels.js');
const ssIdx = html.indexOf('supersetup.js');
ok(blIdx >= 0 && ssIdx > blIdx, 'supersetup.js loads after best-levels.js');
ok(new RegExp('supersetup\\.js\\?v=' + HG_VER.replace('hg-v', '')).test(html), 'supersetup.js cache-busted in index.html');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
