/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v934',
  pack: 'A NEW DETECTOR HAS NO RECORD - SAY WHOSE RECORD IT IS. Two more OMNIGOLD mechanics ported to GOLD SCALP and GOLD SWING, a third REFUSED on its own measurement, and hg-v933s central claim corrected. THE CORRECTION FIRST. hg-v933 stamped all three of its detectors NO MEASURED RECORD. That was true of the idea and FALSE about the evidence: goldrounds OMNIGOLD twin ROUND-MAGNET has 587 settled firings in the committed walk and goldfixs twin LONDON-FIX has 69. Telling a reader nothing is known, when hundreds of measurements of the nearest thing exist, is the same failure as quoting them as if they were this desks. Every one of these detectors now names its twin and quotes that twins GATE-CLEAR record - the population that actually cleared OMNIGOLDs stack, which hg-v917 measured is the honest line and is worse than the unscoped one for 42 of 54 mechanics - ATTRIBUTED every time to OMNIGOLDs gates and its 1h horizon, never presented as this desks. WHAT IS NEW. goldwopen: the weekly open sweep and reclaim. Gold reopens Sunday 22:00 UTC after the only scheduled closure in its week and the level it opens at is the reference every desk marks for the next five days; OMNIGOLD has read it as WEEKLY-OPEN since round five and these two tabs never got it - the same gap hg-v933 closed for ROUND-MAGNET. Sweep and reclaim only: price merely trading above the weekly open is not a setup, it is Tuesday. goldfib: the 61.8 retrace hold. Two things stop it fitting itself - the impulse is measured on bars STRICTLY BEFORE the trigger bar, so the bar being judged cannot define the level it is judged against, and the trigger must have traded THROUGH the level and closed back on the impulse side. THE THIRD PORT IS REFUSED, and it is the point of the pack. PIVOT-REJECT is the last OMNIGOLD mechanic these tabs lack and it is not unmeasured - it is measured and it FAILS: 159 settled firings, 23.3% to T1 first against a 33.3% breakeven at 2R, gross -0.3026R, net -0.3727R at XM, -2.69 sigma naive and -2.63 cluster-robust. That is past EDGE_VETO_Z, the -2 sigma known-failure bar in omnigold.js that hg-v925 deliberately left untouched when it relaxed everything else. And it matters more than a bad-looking row: GOLD SCALP and GOLD SWING HAVE NO MEASURED-EDGE GATE. OMNIGOLD refuses to ticket this mechanic; these desks have nothing that would. Porting it would move a vetoed mechanic onto the one place in the gold stack that cannot veto it - laundering, not adding. The guard is behavioural, not the accident that nothing mints it: any detector whose twin sits at or below the bar is filtered out of the mint, proved by making a shipped twin fail and requiring the same bars to produce nothing. OMNIGOLD gets the disclosure this packs arithmetic exposed: 24 of the 78 registered mechanics have NEVER FIRED in the walk, and since hg-v925 an unknown mechanic no longer stands its setup aside, so they can reach a ticket on no evidence whatsoever. They are not free to the 54 that do have a record - the promotion bar is a Sidak correction over the whole REGISTER, so it sits at 3.2128 sigma across 78 rather than 3.1056 across the 54 that can actually be tested: +0.1072 sigma stricter for every measured mechanic, charged by mechanics no measurement can ever clear or fail. Narrowing the family to the observed subset is the defensible statistic - a hypothesis never evaluated is not a test - but it LOOSENS a bar, so it is PUBLISHED AND NOT ACTED ON; hgOgFamilyZ still corrects over all 78 and nothing is gated on the panel. Every figure in it is derived at render; no count is written into the string. GENERATED, NOT TRANSCRIBED. scripts/gold-sibling-records.mjs writes the record literal from scripts/omnigold-replay-evidence.json - the hg-v921 rule, after hg-v909 shipped a hand-transcribed block from the wrong file. A twin named in the source with no gate-clear record is FATAL, never skipped, because a missing record silently becomes no evidence, which is exactly the false statement this pack removes. npm run gold:siblings is the read-only drift check and the writer is folded into npm run gold:rebake. MEASURED EFFECT on the real mint, 120 scans through the shipped goldScalpSetups: candidates 100 to 108 (+5 goldfib, +3 goldwopen), ZERO throws, lead count UNCHANGED at 10. They still mint DEMOTED - a quoted twin record is not this desks record and does not promote anything. No threshold moves. Tests: tests/test-gold-sibling-records.mjs (123 assertions); 22 of 22 mutations caught across two passes after a first run left six survivors - five real gaps in my own fixtures and error paths, one mutation of mine too inert to test anything, which is recorded as re-targeted rather than counted as a pass',
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
