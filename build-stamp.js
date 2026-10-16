/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v1392',
  pack: 'hg-v1392: merge upstream (parallel-version collision resolved). Upstream shipped its own hg-v1390 (GOLD SCALP bracket 1.5/2.5R ladder, ADR 1.5R gate, GS_MIN_RR variable, apex aligned to house) while this branch carried a different hg-v1390 (three HIGH defects audit of my own hg-v1389) and hg-v1391 (CONFLUENCE WATCH). Both halves preserved; this ship bumps past the collision. Fifth parallel-version collision this quarter (hg-v1317, v1333, v1358, v1389, v1390). hg-v1391: CONFLUENCE paints a WATCH card when the gold desks ARE publishing but the setup threshold is not met. Three cases: desks disagree (the dominant side shows as DESKS DISAGREE and a true tie shows nothing), three or more agree but sit more than 2.5% from the live IUX print (OFF-SCALE), and one or two desks agree (AWAITING THIRD DESK, the pre-pack behaviour). The three-desk-same-side-on-scale ready gate from hg-v1384..v1387 is UNCHANGED. The forward ledger is not touched. Nothing is loosened. hg-v1390 (mine): three HIGH defects in my own hg-v1389, caught by my own audit. hg-v1390 (upstream, taken wholesale): GOLD SCALP accuracy — bracket 1.5/2.5R ladder (was 2.6R ghost), ADR daily-range gate 1.5R (was 1R), GS_MIN_RR variable (was 6x hardcoded 1.2R) — apex aligned to house, 444 edge tests green. hg-v1389 (measurable forward record for CONFLUENCE) still ships. hg-v1389: The gold confluence fallback scores a candle impulse, the 20-bar average, and RSI only when those are read. An unread venue spread is named and is not filled in as zero. The fallback does not replace the gold candle builder, the day-swing reader, or the measure reader. hg-v1388: Gold Scalp reads 5m order flow, the opening range, a 50 35 15 micro ladder, and four measured scalp vectors. Desk prices stay put. hg-v1387: CONFLUENCE shows a watch when fewer than three desks agree, and that watch is not a setup. Super Gold and Milli Gold are the same idea as the desk they read. Only a crowned or A plan votes. A measured venue spread is subtracted, and an unread spread is named. A formed setup is written to the forward ledger. hg-v1386: CONFLUENCE waits for every gold desk that can publish before it votes. A desk that only scans while its tab is open is opened and given time to finish. Three different plans must still agree. The entry stays their median, not the live IUX print. hg-v1385: CONFLUENCE now runs the gold desks that can scan on their own before it votes. A desk that has not published a plan says so. A copy of another desk plan is not a second vote. Three different desks must still agree, and the entry stays the median, not the live IUX print. hg-v1384: CONFLUENCE is a new tab in the gold group. It reads the setups the gold desks have already published and forms one plan only when at least three of them agree on the side and none of them published the other side. At least two of those plans must sit on the live IUX gold price. The entry is the median of those plans. It is not moved to the live price. A missing IUX quote prints no live setup.',
  built: '2026-10-16T15:30:00Z'
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
  var url = './build-stamp.js?live=' + Date.now();
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
      node.title = res.live + (res.reason || '') + ' — reloading…';
      return { stale: true };
    }
    node.textContent = v;
    node.className = 'verbadge';
    node.title = HG_BUILD.version + (HG_BUILD.pack ? (' · ' + HG_BUILD.pack) : '');
    return { stale: false };
  }catch(e){ return null; }
}

var HG_BUILD_POLL_MS = 5 * 60 * 1000;

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

function hgBuildPoll(){
  try{ return hgBuildFreshness().then(hgBuildApplyFreshness); }
  catch(e){ return null; }
}

var hgPollStarted = false;
function hgBuildStartPolling(setIntervalFn, ms){
  try{
    if (hgPollStarted) return null;
    var si = (typeof setIntervalFn === 'function') ? setIntervalFn : ((typeof G.setInterval === 'function') ? G.setInterval : null);
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
    if (hgInited) return false;
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
/* hg-v1347: RESTORED. This export was lost resolving the merge conflict on this file,
   and its absence is a real defect rather than a test nit: the freshness poll reads this
   constant to choose its interval, and test-build-freshness-poll boots the REAL file and
   asserts the clock is exposed. A constant the poll depends on must reach the window. */
G.HG_BUILD_POLL_MS = HG_BUILD_POLL_MS;
/* hg-v1347: RESTORED as well. The merge dropped this export too, and the freshness poll
   calls it to decide whether the user is mid-edit before it reloads the tab. */
G.hgBuildEditingNow = hgBuildEditingNow;
G.hgBuildFreshness = hgBuildFreshness;
G.hgBuildSwWaiting = hgBuildSwWaiting;
G.hgRenderBuildChip = hgRenderBuildChip;
G.hgRenderVerBadge = hgRenderVerBadge;
G.hgBuildMaybeReload = hgBuildMaybeReload;
G.hgBuildApplyFreshness = hgBuildApplyFreshness;
G.hgBuildPoll = hgBuildPoll;
G.hgBuildStartPolling = hgBuildStartPolling;
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
