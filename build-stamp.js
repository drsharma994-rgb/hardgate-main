/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v909',
  pack: 'EVERY GOLD TAB NOW ACTS ON MEASUREMENTS THAT WERE ALREADY ON DISK. Every gold tab that forms a scalp or swing setup runs its candidates through hgGoldSetupEdgeApply, which suppresses, demotes or prefers a mechanic on replay evidence. Cross-referencing the applied table against the analysis it is baked from (scripts/gold-scalp-bt-analysis-floor.json byStrategy) found 25 mechanics measured, 15 carrying a row, and TEN carrying nothing at all. TWO OF THE TEN ARE MEASURED NEGATIVE AT THE DESK OWN VENUE and clear this table OWN documented demote bar (netXm < 0): p5drive S24 THREE-DRIVE EXHAUSTION n=17 gross -0.045 netXm -0.224, and p6comp S30 SESSION-COMPOSITE PULLBACK n=28 gross +0.121 netXm -0.039. Together they are 45 of the 2,193 settled scalp trades (2.1%) and -4.90R net at XM, and until now they were free to lead the board. NO NEW THRESHOLD IS INTRODUCED: the bar is the one the table already documents, applied to rows that were simply left out of the transcription. THE OTHER FOURTEEN CLEARED NO BAR, and that is the second half. An absent row used to mean two different things - a mechanic measured 49 times and mildly positive, and a mechanic nobody has ever measured - and neither the desk nor a reader could tell them apart. Sixteen rows (ten scalp, six swing) are now action neutral and CARRY their measurement, stamped EDGE MEASURED, changing nothing about rank or eligibility by design. Swing ribbon and ob were already neutral in the bake but the applied copy had DROPPED the rows, which threw the measurement away and put them back among the never-measured. WHAT IS DELIBERATELY NOT DONE: no prefer boost is invented - sweepob (n=49, +0.162) misses the n>=50 prefer bar by a single settle and gets nothing for it, and swing p5turt (+3.09R on TWO settles) gets nothing either, because a large number on no sample is still no sample. vpbook (n=1, -0.011) and swing p6zfade (n=2, -0.753) are negative and are NOT demoted: the swing bar carries an n>=12 floor and the scalp bar carries none, so acting on one or two settles would be the table demoting on a coin flip. A mechanic nobody has measured still carries no edge at all, which is what makes the distinction real rather than cosmetic. NOTHING WAS RE-BAKED: the replay cannot run in this environment because the bar sources are refused at the gateway, so every number is transcribed from a committed file, never recomputed and never typed. TWO STALE CITATIONS CORRECTED: goldind and its test both quoted swing bos at n=8 +0.542R while naming the current bake, which says n=9 +0.369R - the figure came from the PRE-v700 file, and a comment citing a file for a number it does not contain is how a stale figure survives a re-bake. AN ERROR THIS PACK CAUGHT IN ITSELF: an interim draft derived the new scalp rows from gold-scalp-bt-analysis.json rather than its post-stop-floor twin, which the other scalp rows match 24 times out of 25; the row-by-row source check caught it and p6comp went from n=29 -0.074 to n=28 -0.039. The sync guard changed with the contract: a neutral row used to be allowed to be absent from the code, and now every baked row must be transcribed WITH its n and net. G1-G7, the gold stop floors and ceilings, the suppress and prefer bars, the Wilson lower bound and the 80% accuracy floor are unchanged. Record only, nothing fetched or sent',
  built: '2026-09-20T00:00:00Z'
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
