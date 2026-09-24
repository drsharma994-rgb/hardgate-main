/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v961',
  pack: 'THE GOLD SWING EDGE TABLE DECIDED ITS VERDICTS ON A HEADLINE SAMPLE AS SMALL AS ONE, WHILE A 244-TRADE WALK OF ITS OWN SAT IN THE REPO UNREAD. hg-v916 gave every SCALP row a live block measured on the population that desk forms today, and hg-v960 made the verdict rule computable on it. The SWING half of the same table got neither: its fourteen rows carried the bridge replay headline n - as low as 1 - and the walk the desk has had since hg-v574, backtest-goldswing-results.json, was read by nothing. Two of those rows are PREFER, which grants a +2 rank boost on GOLD SWING. EVERY SWING ROW NOW CARRIES A LIVE BLOCK, derived by liveSwingPopulation from that walk: 244 settled trades, largest row n=44, and the verdicts now rest on populations between 1 and 44 rather than on a headline. IT IS NOT THE SCALP DERIVATION, and that distinction is the pack. goldswing calls the edge gate with demoteOnly true, so a suppressed kind still FORMS there and must not be removed from the population; the hg-v912 cost reject is not the gate this desk uses either. All three removals are modelled and asserted at zero - 0 under the cost bar, 0 under the 1.5xATR stop floor, 0 for a suppress - and the bake prints how many it checked, because a removal silently skipped and a removal measured at zero look identical from outside. TWO OF THE FOUR VERDICT TIERS ARE UNREACHABLE ON THIS DESK BY ARITHMETIC: the scalp bars require n at least 50 for both prefer and suppress, and the largest swing population is 44. That is the hg-v920 tier the arithmetic cannot produce, inside this table. WHAT IS NOT RECOVERABLE IS LEFT NULL AND NAMED: the swing prefer floor is bounded by the behaviour of the table itself to the interval above 23 and up to 32 - ribbon at n=23 is positive on both legs and is not preferred, weekly at n=32 is - and no value in that interval is written anywhere in the repo. Picking one would be fitting a bar to reproduce its own answers, which hg-v922 and hg-v935 refuse. So the rule returns null on those rows, a fourth bucket UNRECOVERABLE is reported beside follows-the-rule, declared and undeclared, and eight rows sit in it rather than being quietly ruled on. A CORRECTION TO MY OWN FIRST CUT, FOUND BEFORE SHIPPING: it gave the swing desk its own demote floor of n at least 12, taken from prose inside one why string. Twelve is a bar FITTED to reproduce the rows it judges - the table bounds the swing demote bar to the interval above 2 and up to 14, and 12 is a value picked inside it, which is exactly what the same pack refuses one field along for prefer. A bar searched to agree with the table it then validates is the same error with the search hidden. The demote bar is now SHARED with scalp and has no sample floor at all, and the single row where the rule and the table disagree, p6zfade at n=2, is DECLARED on its own row in the same form as the hg-v928 refusals at n=6 and n=1. The guard proves the interval a fitted bar would have hidden in and that the shipped bar is outside it. A REAL GAP THE PROVENANCE GUARD CAUGHT, NOT ME: the literal writer began reading the swing walk and npm run gold:rebake never ran it - a fresh instance of the hg-v959 orphan, one pack after that fix. The chain now walks GOLD SWING, the walk resolves its output from the one shared constant in lib/gold-artifacts.mjs and answers --print-out, and the produced set inside that guard is no longer HAND-TYPED: it is derived by asking each node step of the chain what it writes, because the hand-kept list inside the guard built to stop stale lists was itself the thing that went stale. Nothing is re-baked here - every data route is 403 CONNECT - and the committed tree round-trips to zero drift. NO GATE, THRESHOLD OR VERDICT MOVES ON ANY DESK, and no setup leaves any board. Tests: tests/test-gold-swing-edge-rule.mjs, 136 assertions, and tests/test-gold-artifact-provenance.mjs, 55 assertions, with 30 of 30 behavioural mutations caught across goldind.js, scripts/edge-live-population.mjs, scripts/rebake-gold-literals.mjs, scripts/backtest-goldswing.mjs and package.json, baseline verified green before every pass',
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
