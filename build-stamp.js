/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v971',
  pack: 'THE QUOTE hg-v968 FED NEVER REACHED THE TWO MINTS IT WAS FED TO, AND THREE MORE DESKS BORROW THOSE MINTS UNFED. Two defects in my own packs, found by tracing the seam rather than trusting the guard that passed. (1) On GOLD SCALP and GOLD SWING the quote the hg-v968 perp handler put on ctx was NEVER copied into the bundle the mint reads - scalpBundle and microOpts read only the zero-writer globals - so the spread lock had STILL never received a quote on either desk: fed to a seam that dropped it, hg-v932 in my own pack for the third time. (2) goldScalpSetups and goldSwingSetups build the institutional-filter context WITHOUT THE VENUE, so a quote that had arrived would have LOCKED rather than been reported - the hg-v968 proxy rule was unreachable through the mints. Both are proved on the real mints: a wide quote naming delta-xaut moves NO board and lands a SPREAD WIDE note on every card, while the same quote unnamed or naming the broker locks every candidate. THREE DESKS BORROW THOSE MINTS AND FETCHED NO PAYLOAD AT ALL: GOLD PINE, GOLD ULTRA and GOLD DIRECTION call the mints with bars only, so the spread lock, the DOM rule and the OI and funding reads were unchecked there on every scan. Each now loads the feed once per scan, awaited, before its lanes, and each lane hands it to the mint - proved by lifting each lane out of the file and RUNNING it against a recording mint. ONE LOADER, ONE APPLIER, FIVE DESKS: hgGoldLiveFeed loads the payload through the existing loader and the two existing readers - no third parser - with a timeout so no desk waits forever on a quote; hgGoldApplyLiveFeed fills a mint input only where it carries nothing, so a named broker quote or book on the global still wins, proved on the applier and by lifting and running each fed desk real bundle block with a broker quote on the global. A grep-satisfiable assertion in this pack own guard was caught by its own mutation pass: the first cut matched the applier call in the source and an if-false in front of it survived on both desks; the bundle block is now executed instead. NOTHING LEAVES ANY BOARD: every quote and book delivered names the proxy venue, so on all five desks it is reported and never gated; the 0.25 bar is unchanged and asserted unchanged; no writer of the globals is added. Tests: tests/test-gold-live-feed-reaches-mints.mjs, 66 assertions, with 23/23 behavioural mutations caught across goldind.js, goldscalp.js, goldswing.js, golddirection.js, goldultra.js and goldpine.js, baseline verified green before every pass',
  built: '2026-09-24T00:00:00Z'
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

/* hg-v958: THE FRESHNESS CHECK HAD NO CLOCK.

   hgBuildInit ran hgBuildFreshness() once at DOMContentLoaded - the one
   moment a tab is current by definition - and after that only when the tab
   was hidden and shown again. This desk is built to sit open all day as the
   FOREGROUND tab (HG_GLOBAL_SCAN_MS re-scans it every ten minutes without
   ever hiding it), so visibilitychange never fires and the question "what is
   the server serving?" was asked exactly once per tab, at boot.

   Measured by driving the real file: zero timers installed, one fetch at
   boot, none in the eight hours after, and a second only after a tab switch.
   That is the hg-v957 defect in the OTHER update path - and it is why this
   path, which has no lockout bug of its own, still never recovered a pinned
   tab. Five minutes, deliberately the fastest of the three clocks (SW update
   15 min, desk re-scan 10 min), because it is one small GET of one file and
   it is the path that can recover a tab whose service worker is wedged. */
var HG_BUILD_POLL_MS = 5 * 60 * 1000;

/* Polling makes the automatic reload roughly a hundred times more frequent
   than a boot-only check, so it must not land on top of someone's typing -
   OMNIGOLD 1 takes a hand-pasted DATA BLOCK and a reload throws it away.
   An absent, throwing or unreadable document is NOT editing: this fails
   OPEN, because refusing an update on a document we cannot read would be a
   new lockout of exactly the kind hg-v957 removed. */
function hgBuildEditingNow(doc){
  try{
    var d = doc || (G.document || null);
    if (!d) return false;
    var el = d.activeElement;
    if (!el) return false;
    if (el.isContentEditable === true) return true;
    var tag = String(el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }catch(e){ return false; }
}

function hgBuildMaybeReload(res, storage, reloadFn, doc){
  try{
    if (!res || res.state !== 'stale' || !res.live) return false;
    var store = storage;
    if (!store && G.sessionStorage) store = G.sessionStorage;
    if (!store || typeof store.getItem !== 'function') return false;
    var key = 'hg_build_reload_' + String(res.live);
    if (store.getItem(key)) return false;
    /* deliberately BEFORE the key is written, so the next poll tries again
       the moment the field loses focus - the update is deferred, not lost */
    if (hgBuildEditingNow(doc)) return false;
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

/* ONE definition of "ask the server which build it is serving, and act on
   the answer". The boot check, the tab-switch check and the poll are the
   same question asked at three different times. */
function hgBuildPoll(){
  try{ return hgBuildFreshness().then(hgBuildApplyFreshness); }
  catch(e){ return null; }
}

var hgPollStarted = false;
function hgBuildStartPolling(setIntervalFn, ms){
  try{
    if (hgPollStarted) return null;                 /* one clock per page */
    var si = (typeof setIntervalFn === 'function') ? setIntervalFn
           : ((typeof G.setInterval === 'function') ? G.setInterval : null);
    if (!si) return null;
    var every = (typeof ms === 'number' && isFinite(ms) && ms > 0) ? ms : HG_BUILD_POLL_MS;
    var id = si(hgBuildPoll, every);
    hgPollStarted = true;
    return id;
  }catch(e){ return null; }
}

var hgInited = false;
function hgBuildInit(){
  try{
    if (hgInited) return false;                     /* one page, one init */
    hgInited = true;
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
          hgBuildPoll();
        }catch(e){}
      });
    }
    /* the clock the check never had */
    hgBuildStartPolling();
    return true;
  }catch(e){ return false; }
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
G.HG_BUILD_POLL_MS = HG_BUILD_POLL_MS;
G.hgBuildEditingNow = hgBuildEditingNow;
G.hgBuildPoll = hgBuildPoll;
G.hgBuildStartPolling = hgBuildStartPolling;

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
