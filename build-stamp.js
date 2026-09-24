/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v942',
  pack: 'SIX MECHANICS THAT MEASURED PROFITABLE ON GOLD COULD NOT BE FORMED ON EITHER TAB A TRADER WORKS FROM. Asked again for more gold indicators and strategies, the honest first move was to look at what the evidence already names rather than invent more detectors - hg-v933 and hg-v934 added five gold-native ones and the lead count did not move. MILLI GOLD keeps a roster: the nine OMNIGOLD mechanics whose GATE-CLEAR record is net-positive at XM on at least MIN_SAMPLES firings, derived rather than chosen. SIX OF THE NINE HAVE NO MECHANIC ON GOLD SCALP OR GOLD SWING AT ALL: STRUCT-BOS, SQUEEZE-FIRE, CUSUM-SHIFT, MMOVE, TREND-RECLAIM and BOS-RETEST. A trader working from the two tabs could not form them whatever the tape did - and the records run n=32 to n=177 at plus 0.003R to plus 0.082R net at XM. WHAT IS AND IS NOT CLAIMED. A positive in-sample record is not a forecast, and this desk has measured that directly: hg-v937 rebuilt the same roster on the earlier part of the walk and judged it on what came after, and it beat the full OMNIGOLD book in 6 of 6 trials and PAID IN 0 OF 6. So the claim is narrow - these are the best-measured mechanics the two tabs lack, and they were absent - not that adding them makes either desk pay. They MINT DEMOTED, because the record on the card belongs to OMNIGOLD gates and a 1h horizon, not to this desk. NO SECOND COPY. Detection is the hgOgBtDetectors dispatch table OMNIGOLD already exports, the same pure rows-to-hit functions the live pass and the backtest call - rebuilding them here is the copy that drifts, the hg-v938 lesson. GATING IS THE TAB IN FULL: the hit becomes an ordinary candidate through the inst filter, the stop-width floor, the edge table, the confluence ledger and best-levels. ENTRY IS THE LEVEL THE MECHANIC NAMED, per hg-v423, and one shared stop rule is stated once rather than invented six times. A SECOND GAP FOUND WHILE WIRING IT: GOLD SWING never consumed hgGoldExtraDetect at all, so the London fix, dollar divergence, round-dollar, weekly open and 61.8 retrace mechanics have not existed on that tab since hg-v933. It consumes them now, on its own 4h execution series. COVERAGE IS EXHAUSTIVE BY CONSTRUCTION: every roster kind is either ported or has a named home on the tabs, and a re-bake that promotes a tenth mechanic is REPORTED rather than silently skipped. The roster is READ from MILLI GOLD at call time, so a re-bake changes what these tabs form with no second edit and no literal to drift. THE MEASURED-FAILURE VETO STILL RUNS ON THEM, so a re-bake that turns one negative stops it minting with no edit - and the guard proves that behaviourally rather than relying on nothing being negative today. MEASURED ON THE REAL MINT. GOLD SCALP over 120 scans: 108 to 165 candidates, 15 to 21 mechanics, 0 throws, and the LEAD COUNT UNCHANGED AT 10 - every new candidate mints demoted, as designed. GOLD SWING over 111 scans: 52 to 71 candidates, 6 to 9 mechanics, 0 throws, lead count unchanged. The swing desk rejects most of what it is now offered, on its own gates - confluence insufficient, and R:R under the 1.2R floor - which is the point: nothing is loosened. NO GATE, THRESHOLD OR VERDICT MOVES. AND THE FIRST MUTATION PASS FOR THIS PACK WAS WORTHLESS, WHICH THE FULL SUITE CAUGHT AND I HAD NOT. One assertion in the new guard read the edge tables with a regex demanding exactly one space before the brace and silently got 20 of the 27 scalp keys, so the test exited non-zero on every run. The mutation harness decides caught by the test process exiting non-zero, so a test that already fails reads EVERY mutation as caught - all 14 were false. The harness now refuses to run against a red baseline and says so, and the re-run found THREE REAL SURVIVORS: an unmapped roster kind was reported but never asserted un-ported, the two maps were never asserted disjoint, and an unreadable series was never tested. THE THIRD SURVIVOR WAS A REAL DEFECT IN MY OWN RULE: num() coerces, so plus null is 0, and a bar carrying null for its low read as a LOW OF ZERO and priced a stop against it - the same coercion trap hg-v941 hit on a null age, one pack later. A value that is not a number is now UNREADABLE and the stop is NaN. Tests: tests/test-gold-roster-ports.mjs (89 assertions), 17 of 17 behavioural mutations caught across two files, baseline verified green first. Suite: 594 files, 0 failed',
  built: '2026-09-23T00:00:00Z'
};

function hgBuildLabel(b){
  b = b || HG_BUILD;
  var v = String(b.version || '').replace(/^hg-/, '');
  var p = b.pack ? ' · ' + b.pack : '';
  return v ? v + p : 'unknown build';
}

function hgBuildParseVersion(text){
  try{
    if (typeof text !== 'string' || !text) return null;
    var m = text.match(/version\s*:\s*['"]([A-Za-z0-9._-]{1,64})['"]/);
    return m ? m[1] : null;
  }catch(e){ return null; }
}

function hgBuildCompare(loaded, live){
  if (!loaded || !live) return { state: 'unknown', reason: 'could not read one side' };
  if (String(loaded) === String(live)) return { state: 'fresh', reason: 'matches server' };
  return { state: 'stale', reason: 'server is on ' + live + ', this tab loaded ' + loaded };
}

function hgBuildDistance(loaded, live){
  try{
    var a = String(loaded || '').match(/(\d+)\s*$/);
    var b = String(live || '').match(/(\d+)\s*$/);
    if (!a || !b) return null;
    return (+b[1]) - (+a[1]);
  }catch(e){ return null; }
}

function hgBuildChipState(res, b){
  b = b || HG_BUILD;
  var label = hgBuildLabel(b);
  if (!res || res.state === 'pending') return { text: label, cls: 'ok', title: 'checking for newer build' };
  if (res.state === 'fresh') return { text: label, cls: 'ok', title: 'running current build (' + res.live + ')' };
  if (res.state === 'stale'){
    var d = hgBuildDistance(res.loaded, res.live);
    var behind = (d != null && d > 0) ? ' (' + d + ' behind)' : '';
    return { text: label + ' · STALE' + behind, cls: 'bad', title: res.reason + ' — hard-reload to pick it up' };
  }
  return { text: label + ' · ?', cls: 'warn', title: (res.reason || 'freshness unknown') + ' — offline or blocked' };
}

function hgBuildFreshness(fetchImpl){
  var f = (typeof fetchImpl === 'function') ? fetchImpl : (typeof G.fetch === 'function' ? G.fetch.bind(G) : null);
  var loaded = HG_BUILD.version;
  if (!f) return Promise.resolve({ state: 'unknown', loaded: loaded, live: null, reason: 'no fetch' });
  var url = './build-stamp.js?fresh=' + Date.now();
  return f(url, { cache: 'no-store' }).then(function(res){
    if (!res || !res.ok) throw new Error('http ' + (res && res.status));
    return res.text();
  }).then(function(text){
    var live = hgBuildParseVersion(text);
    var cmp = hgBuildCompare(loaded, live);
    return { state: cmp.state, loaded: loaded, live: live, reason: cmp.reason };
  }).catch(function(e){
    return { state: 'unknown', loaded: loaded, live: null, reason: (e && e.message) || 'network failed' };
  });
}

function hgBuildSwWaiting(){
  try{
    var sw = G.navigator && G.navigator.serviceWorker;
    if (!sw || !sw.controller) return Promise.resolve(false);
    return sw.getRegistration().then(function(reg){
      return !!(reg && reg.waiting);
    }).catch(function(){ return false; });
  }catch(e){ return Promise.resolve(false); }
}

function hgRenderBuildChip(el, res){
  try{
    var node = el || (G.document && G.document.getElementById('chipBuild'));
    if (!node) return null;
    var st = hgBuildChipState(res);
    node.textContent = '';
    var b = G.document.createElement('b');
    b.textContent = st.text;
    node.appendChild(b);
    node.title = st.title;
    node.className = 'statuschip hg-build-' + st.cls;
    return st;
  }catch(e){ return null; }
}

function hgRenderVerBadge(res){
  try{
    var node = G.document && G.document.getElementById('hgVerBadge');
    if (!node) return null;
    var v = String(HG_BUILD.version || '').replace(/^hg-/, '');
    if (!v){ node.style.display = 'none'; return null; }
    if (res && res.state === 'stale'){
      var d = hgBuildDistance(res.loaded, res.live);
      var behind = (d != null && d > 0) ? ' (' + d + ' behind)' : '';
      node.textContent = v + ' · STALE' + behind;
      node.className = 'verbadge verbadge-stale';
      node.title = (res.reason || 'stale') + ' — reloading…';
      return { stale: true };
    }
    node.textContent = v;
    node.className = 'verbadge';
    node.title = HG_BUILD.version + (HG_BUILD.pack ? (' · ' + HG_BUILD.pack) : '');
    return { stale: false };
  }catch(e){ return null; }
}

function hgBuildMaybeReload(res, storage, reloadFn){
  try{
    if (!res || res.state !== 'stale' || !res.live) return false;
    var store = storage;
    if (!store && G.sessionStorage) store = G.sessionStorage;
    if (!store || typeof store.getItem !== 'function') return false;
    var key = 'hg_build_reload_' + String(res.live);
    if (store.getItem(key)) return false;
    var reload = reloadFn;
    if (!reload && G.location && typeof G.location.reload === 'function') reload = G.location.reload.bind(G.location);
    if (typeof reload !== 'function') return false;
    store.setItem(key, '1');
    reload();
    return true;
  }catch(e){}
  return false;
}

function hgBuildApplyFreshness(res){
  try{
    if (!res) return res;
    hgRenderBuildChip(null, res);
    hgRenderVerBadge(res);
    G.HG_BUILD_FRESHNESS = res;
    hgBuildMaybeReload(res);
    return res;
  }catch(e){ return res; }
}

function hgBuildInit(){
  try{
    hgRenderBuildChip(null, null);
    hgRenderVerBadge(null);
    hgBuildFreshness().then(function(res){
      return hgBuildSwWaiting().then(function(waiting){
        if (waiting && res.state === 'fresh'){
          res = { state: 'stale', loaded: res.loaded, live: res.live, reason: 'new build downloaded' };
        }
        return hgBuildApplyFreshness(res);
      });
    });
    if (G.document && typeof G.document.addEventListener === 'function'){
      G.document.addEventListener('visibilitychange', function(){
        try{
          if (!G.document || G.document.visibilityState !== 'visible') return;
          hgBuildFreshness().then(hgBuildApplyFreshness);
        }catch(e){}
      });
    }
  }catch(e){}
}

G.HG_BUILD = HG_BUILD;
G.hgBuildLabel = hgBuildLabel;
G.hgBuildParseVersion = hgBuildParseVersion;
G.hgBuildCompare = hgBuildCompare;
G.hgBuildDistance = hgBuildDistance;
G.hgBuildChipState = hgBuildChipState;
G.hgBuildFreshness = hgBuildFreshness;
G.hgBuildSwWaiting = hgBuildSwWaiting;
G.hgRenderBuildChip = hgRenderBuildChip;
G.hgRenderVerBadge = hgRenderVerBadge;
G.hgBuildMaybeReload = hgBuildMaybeReload;
G.hgBuildApplyFreshness = hgBuildApplyFreshness;
G.hgBuildInit = hgBuildInit;

try{
  if (G.document){
    if (G.document.readyState === 'loading'){
      G.document.addEventListener('DOMContentLoaded', hgBuildInit);
    } else {
      hgBuildInit();
    }
  }
}catch(e){}

})();
