/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v949',
  pack: 'GOLD IS SHUT ON THE WEEKEND AND THE DESKS ROUTING THROUGH THE SHARED FORMATION HAD NEVER HEARD OF IT. Working the gold desk list again. XAUUSD prints no bar from Friday 22:00 UTC to Sunday 22:00 UTC, DST-aware; the repo has encoded that since hg-v186 as hgInGoldWeekend and OMNIGOLD has VETOED inside it since hg-v420. NEW GOLD and OMNIGOLD 1 minted straight through. IT IS LIVE, NOT ONLY HISTORICAL: getXAUCandles walks a feed chain ending in Delta XAUTUSD and Binance PAXG, both 24/7 crypto tokens, so on a Saturday a desk on that chain is handed bars and mints an XAUUSD ticket at a price no broker quoted. MEASURED, AND IT IS HALF THE RECORD: NEW GOLD only settled walk is run on PAXGUSDT, and the artifact own meta says what that means - 24/7 weekend bars a broker never printed. Judged with the repo own DST-aware rule rather than a re-implementation, NINE of its NINETEEN trades formed inside the gold weekend, and the desk entire positive reading is those nine at plus 0.2403R net at XM. The TRADEABLE subset is n=10, gross plus 0.0000R, net minus 0.0568R, win 40.0 per cent against exactly the 40.0 per cent its own 1.5R ladder demands. 15 of 33 fireLog fires are weekend fires. NO VERDICT IS CLAIMED FROM n=10 and none is offered: the finding is that the quoted figure was not measured on a population the desk can trade, NOT that the desk loses. The gross reading exactly 0.0000R over ten trades is a small-sample coincidence and is said to be one. Re-derive: node scripts/gold-weekend-population.mjs, which CALLS the repo calendar and contains no calendar arithmetic of its own, and quotes the artifact universe line rather than asserting the claim itself. THE RULE LIVES ONCE, in gold-formation.js, and DELEGATES to hgInGoldWeekend rather than re-deriving the edges: a second copy of a calendar is a second calendar, and a guard proves that with indicators2.js absent the verdict is null rather than falling back to its own idea of a weekend. THE INSTANT IS THE SIGNAL BAR, NEVER Date.now(): a scan re-run on Monday over Friday bars must give Friday answer, and the guard drives the same call under two wall clocks to prove the answer does not move. Callers pass atMs; there is deliberately no rows fallback because the three desks here make an identical rows-less call by design. IT WITHHOLDS TRADABLE AND NOTHING ELSE - the confluence read, the venue read and the evidence all survive, the card stands aside rather than being deleted, which is the hg-v552 and hg-v572 rule that a hard drop empties a board and a demote does not. FAILS OPEN at every seam: no atMs, an unreadable atMs, or the calendar absent and the setup stands exactly as before. A calendar the desk cannot read is not a reason to withhold a setup. A COVERAGE REPORTER, because a list kept in prose goes stale silently (hg-v945): hgGoldWeekendCoverage probes the live globals, PARTITIONS the desk list into covered, uncovered and not-loaded, and a desk absent from the page reports NOT LOADED rather than covered. OPTI GOLD, GOLD PINE, GOLD PRO and 80PERCENT report UNCOVERED - they mint from raw bars and do not route through the shared formation, so they are named by the reporter rather than by my memory. ONE HONEST GAP, RECORDED IN THE GUARD RATHER THAN IN PROSE: OMNIGOLD 1 call site is wired identically to NEW GOLD, but reaching it needs a fixture clearing its 4-family spread rule, which this one does not. The first cut asserted over an EMPTY array and passed vacuously - the same failure this session has corrected four times - so reachability is now asserted FIRST and the rest is conditional on it, and the engine must have RUN and declined for a NAMED reason. A FIFTH +null===0 INSTANCE, this time in my own guard: a finiteness check let a lane passing null read as wired, and mutation caught it. No gate, threshold or verdict moves on any other desk, and no setup leaves any board. Tests: tests/test-gold-weekend-formation.mjs, 46 assertions, 13 of 13 behavioural mutations caught across gold-formation.js and newgold.js with the baseline verified green first',
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
