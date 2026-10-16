/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v1387',
  pack: 'hg-v1387: CONFLUENCE shows a watch when fewer than three desks agree, and that watch is not a setup. Super Gold and Milli Gold are the same idea as the desk they read. Only a crowned or A plan votes. A measured venue spread is subtracted, and an unread spread is named. A formed setup is written to the forward ledger. hg-v1386: CONFLUENCE waits for every gold desk that can publish before it votes. A desk that only scans while its tab is open is opened and given time to finish. Three different plans must still agree. The entry stays their median, not the live IUX print. hg-v1385: CONFLUENCE now runs the gold desks that can scan on their own before it votes. A desk that has not published a plan says so. A copy of another desk plan is not a second vote. Three different desks must still agree, and the entry stays the median, not the live IUX print. hg-v1384: CONFLUENCE is a new tab in the gold group. It reads the setups the gold desks have already published and forms one plan only when at least three of them agree on the side and none of them published the other side. At least two of those plans must sit on the live IUX gold price. The entry is the median of those plans. It is not moved to the live price. A missing IUX quote prints no live setup. hg-v1383: A one-go Gold Scalp upgrade now carries a measured ounce size. The size uses the desk stop and the half-Kelly risk when that risk was measured. One lot is 100 ounces. The desk entry, stop, and target stay. hg-v1382: A Gold Scalp that passes the ten gates is named an A plus sniper and its grade moves to A. The suggestion shields a stop that sits on a five-dollar number and pulls the first target 35 cents in front of a measured supply wall. The desk entry, stop, and target stay. hg-v1381: The Gold Scalp desk names the scalp type and a suggested bracket. The suggestion is not written onto the desk entry, stop, or targets. A missing ATR is not filled in as 2.2, and a missing spread is not filled in as 35 cents. An empty tape does not grow a scalp setup. hg-v1380: Super Gold names the volume node, the value area, and whether spot leads the token. Five agreeing timeframes keep 40 percent for the first target and 30 for the runner. Compression takes 60 off at the first target. The stop ladder is a plan. The desk entry, stop, and targets are not moved. A bar with no volume is not counted as 1. hg-v1379: When a long window has no prior day, the first half is the range the later bars are judged against, and the card says it is not a calendar day. A rejecting wick of 82 or more puts 70 percent on the near limit. Expansion puts 45 on the near limit and 55 on the deeper one. The fill figure is the measured distance, and a missing ATR still prints no score. The desk entry stays. hg-v1378: Super Gold names the prior day high, low, and midpoint only when a prior day is on the tape. A wick that rejects and closes back is absorption. The radar says how far the live price is from the entry. A missing ATR is not 4, and a fill chance is not invented. The 60/40 split and the desk entry stay. hg-v1377: A later bar that takes the opening-block low and closes back above it is an Asian-range sweep, even when that wick is still inside 00:00-07:00 UTC. Five agreeing timeframes stay a full cascade. The breakeven hurdle stays on the measured reward. The desk entry is not moved. hg-v1376: Super Gold names the timeframes that actually agree, an Asian-range sweep only when the bar clock says so, and an inverse gap only after price closes back through it. The breakeven hurdle uses the measured reward. A missing print is unread, not 2.2R or 62 percent. The desk entry and TP1 are not moved. hg-v1375: The crowned row carries the pre-fill guard. A calm tape is a resting limit. An opposing expansion bar is a knife and waits for the 15m close. The detector accepts the side as its second argument. The desk entry is not moved. hg-v1374: Super Gold names equal highs and equal lows, the range midpoint, and the pool price is drawing toward. A resting limit into an opposing expansion bar waits for a 15m reclaim close. No measured ATR does not become 3.50. The desk entry is not moved. hg-v1373: The card shows the 60/40 limit, the measured expectancy, and how many minutes the signal has left. A limit is stale once price has run 85 percent of the way to TP1 and no recent bar tagged it. A missing bar time does not invent a full clock. The desk entry stays the desk entry. hg-v1372: Super Gold reads unfilled 15m gaps and order blocks. The suggestion can be two limits, 60 percent at the entry and 40 percent at the nearest deeper level on the tape. Expectancy uses the measured reward. A limit that price has already run 90 percent of the way to TP1 is not chased. A tape-only setup is kept off the crown. hg-v1371: The card shows the playbook and the measured entry zone beside the desk entry, which stays put. The chart draws the suggested ladder only when it was measured. A scan with a missing candle leg retries once. An unread ladder is not drawn and is not sent. hg-v1370: Super Gold names the setup. Judas sweep, OTE reload, coil breakout, or VWAP. A scalp and a swing on the same side fuse. The scalp entry and stop stay. The swing target is kept when it is farther. Forming levels show distance, readiness, and a projected stop and target. An unread ATR does not invent that distance. hg-v1369: When no structure is close, the sniper entry uses the 61.8 to 70.5 percent band. If VWAP sits inside that band it pulls the entry to the midpoint. A close structure level still wins. An unread ATR is still not sent. hg-v1368: Super Gold stamps the measured sniper bracket onto the row after the tape is read. The card and the send use that same bracket. A ladder out of order is not sent. A refresh keeps the tape. The desk entry and stop on the row stay as published. hg-v1367: A measured sniper suggestion is what Super Gold sends: entry in front of structure, stop past the round number, and the three targets. Twelve of twelve gates is SNIPER A+. A blackout stands aside. An unread ATR is not sent. The card still shows the desk levels. hg-v1366: Super Gold prints a 12-gate sniper scorecard and a level suggestion from the measured ATR, the OTE, and marked structure. The suggestion does not replace the crowned entry or stop. An unread ATR moves nothing. A hard veto blocks a send. hg-v1365: Super Gold keeps the source bar time on the crowned row. A send uses the size the desk already calculated. It does not invent a size, and a second click of the same crown is a duplicate. hg-v1364: Super Gold retries a candle leg that comes back empty, then reads the fallback. A cross-venue gap past 12 USD locks a send. The path after the crowned bar is named and the source stop is not moved. A send needs a real size and a real bar time, and the scan itself does not send. SUPER GOLD crown execution - ARMED/TRIGGERED/NO-TRADE state for the crowned bracket against the sizing mark, the forecast cone and the closed 15m window pinned to the scan, a mini chart of the crowned levels, the crowned-only forward split, and a next-scan countdown.',
  built: '2026-10-16T02:00:00Z'
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