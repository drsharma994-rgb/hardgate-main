/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD.

   Two jobs:
     1. Say what version this tab loaded.
     2. Say whether that is actually the version the server is serving right now.

   (2) is the one that matters. A version number alone cannot tell you the tab is
   current — a stale service worker or an HTTP-cached shell will happily show you
   yesterday's number and look perfectly healthy. So the chip compares the loaded
   stamp against a cache-busted network read and calls STALE when they differ.

   WHEN YOU SHIP: bump VERSION here and HG_CACHE in sw.js to the same value.
   tests/test-build-stamp.mjs fails the suite if they ever drift apart. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

/* ---- the stamp -------------------------------------------------------- */
var HG_BUILD = {
  version: 'hg-v613',
  pack: 'OMNIBTC applies OMNIROUTE principal then one BTC result',
  built: '2026-09-05T17:55:00Z',
  note: 'gold-seven-step.js: Playbook Parts 1–9 + Master Catalog seven-step readout — closed 1H/4H bars (4H derived @22:00 UTC), VP POC/VAH/VAL/HVN/LVN, Asia/PDH/PDL/PWH/PWL/EQ pools, fresh OBs, ATR/ADR/RSI/EMA/KER, DST sessions, news lockout, strategy eligibility, 4H bias, rule-based confluence rank, 12 core gates + G14, entry/stop/T1/T2/size/venue basis, TRIGGERED/WAIT/EXPIRED. IST with UTC. No win rates. Against-tape candidates HELD.'
};

/* ---- pure helpers (unit-tested) -------------------------------------- */

/** Short human label, e.g. "v269 · pack 17". */
function hgBuildLabel(b){
  b = b || HG_BUILD;
  var v = String(b.version || '').replace(/^hg-/, '');
  var p = b.pack ? ' · ' + b.pack : '';
  return v ? v + p : 'unknown build';
}

/** Pull the VERSION string out of a build-stamp.js source text.
    Returns null when absent/unrecognisable — never throws. */
function hgBuildParseVersion(text){
  try{
    if (typeof text !== 'string' || !text) return null;
    var m = text.match(/version\s*:\s*['"]([A-Za-z0-9._-]{1,64})['"]/);
    return m ? m[1] : null;
  }catch(e){ return null; }
}

/** Compare loaded vs live. Conservative: only says 'stale' when it is certain. */
function hgBuildCompare(loaded, live){
  if (!loaded || !live) return { state: 'unknown', reason: 'could not read one side' };
  if (String(loaded) === String(live)) return { state: 'fresh', reason: 'matches server' };
  return { state: 'stale', reason: 'server is on ' + live + ', this tab loaded ' + loaded };
}

/** Numeric tail of hg-vNNN, for "how many builds behind" — null if not comparable. */
function hgBuildDistance(loaded, live){
  try{
    var a = String(loaded || '').match(/(\d+)\s*$/);
    var b = String(live || '').match(/(\d+)\s*$/);
    if (!a || !b) return null;
    return (+b[1]) - (+a[1]);
  }catch(e){ return null; }
}

/** Chip text + severity from a freshness result. Pure, so the UI is testable. */
function hgBuildChipState(res, b){
  b = b || HG_BUILD;
  var label = hgBuildLabel(b);
  if (!res || res.state === 'pending') return { text: label, cls: 'ok', title: 'checking for a newer build…' };
  if (res.state === 'fresh') return { text: label, cls: 'ok', title: 'running the current build (' + res.live + ')' };
  if (res.state === 'stale'){
    var d = hgBuildDistance(res.loaded, res.live);
    var behind = (d != null && d > 0) ? ' (' + d + ' behind)' : '';
    return {
      text: label + ' · STALE' + behind,
      cls: 'bad',
      title: res.reason + ' — hard-reload to pick it up'
    };
  }
  return { text: label + ' · ?', cls: 'warn', title: (res.reason || 'freshness unknown') + ' — offline or blocked' };
}

/* ---- network freshness check ----------------------------------------- */

/** Async: is this tab running what the server serves?
    fetchImpl injectable for tests. Never throws, never rejects. */
function hgBuildFreshness(fetchImpl){
  /* typeof, not truthiness: any non-null value passed here used to be
     accepted as a fetch and then called, throwing "f is not a function"
     instead of returning the honest 'unknown' this function exists to give. */
  var f = (typeof fetchImpl === 'function') ? fetchImpl
        : (typeof G.fetch === 'function' ? G.fetch.bind(G) : null);
  var loaded = HG_BUILD.version;
  if (!f) return Promise.resolve({ state: 'unknown', loaded: loaded, live: null, reason: 'no fetch available' });
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

/** Is a new service worker sitting in waiting state? (update downloaded, needs reload) */
function hgBuildSwWaiting(){
  try{
    var sw = G.navigator && G.navigator.serviceWorker;
    if (!sw || !sw.controller) return Promise.resolve(false);
    return sw.getRegistration().then(function(reg){
      return !!(reg && reg.waiting);
    }).catch(function(){ return false; });
  }catch(e){ return Promise.resolve(false); }
}

/* ---- paint ----------------------------------------------------------- */

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
      node.title = (res.reason || 'stale build') + ' — reloading…';
      return { stale: true };
    }
    node.textContent = v;
    node.className = 'verbadge';
    var b = HG_BUILD;
    node.title = HG_BUILD.version + (b.pack ? (' — ' + b.pack) : '') + (b.built ? (' · built ' + b.built) : '');
    return { stale: false };
  }catch(e){ return null; }
}

/** Reload once when the server is ahead. storage + reloadFn injectable for tests. */
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
          res = { state: 'stale', loaded: res.loaded, live: res.live,
                  reason: 'a newer build is downloaded and waiting' };
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
