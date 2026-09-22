/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v923',
  pack: 'SWEEP->OB IS NOW AN OMNIGOLD MECHANIC, AND THE RECORD IT WOULD HAVE INHERITED WAS NEVER ITS OWN. Asked to add a triple-confirmation gold strategy (15m macro bias, SMC zone on 5m, momentum confirm on 1m, hard stop outside the OB, min 1:2 RRR) to OMNIGOLD for a 90% win rate. Three findings and one wire. FIRST, THE STRATEGY WAS ALREADY THERE: hgGoldSweepOb has run on every gold scan since hg-v560 and is the same model - HTF location via hgGoldMtfMatrix, liquidity raid and MSS via the SMC port, entry on a fresh OB/FVG retrace, stop beyond the sweep extreme + 0.15xATR, quality >=7/10 and R:R >= 2.0, tier-1 news lockout. It mints on GOLD SCALP and stamps on GOLD SWING, but it was never REGISTERED as an OMNIGOLD mechanic - every other library model got an explicit wire pack (VP v567, P4 v568, P5 v569, P6 v570, P7 v571) and this one was missed. It is now wired at six sites and forms on the CONFIRMED path only, because an OMNIGOLD card is a ticket candidate and the watch tier has no target and no R:R to ticket with. SECOND, AND THIS IS THE DEFECT: the detector has four early returns that hand back tier watch with NO quality score, and in two of them no targets and no R:R either. They are the honest pre-trigger states - the sweep has happened, the entry has not - but nothing downstream could tell them apart from a confirmed setup, because the GOLD SCALP mint accepts tier watch and mints them under the same stratKey. MEASURED on the committed replay: ALL 62 sweepob firings carry a falsy quality, so 62 of 62 came from an early return and ZERO from the confirmed path. The +0.427 gross / +0.162 net on HG_GOLD_SETUP_EDGE.scalp.sweepob, and the live +0.301R on 29 rows, are the PRECURSOR record. The confirmed SWEEP->OB has never once fired in the walk and has no record at all. Every card printed Q?/10 for five months and read as a scored setup with a missing number. Each watch return now carries a `stage` naming the missing leg, the stamp prints SWEEP->OB WAITING with that leg in English, and the edge row says PRECURSOR in its own why. The precursorOnly flag is DERIVED from the replay, not annotated: a kind stamps a quality on every row and not one is numeric. Hand-writing it broke the hg-v921 byte-identical guard on the first full-suite run, which is exactly what that guard is for - the literal writer now emits it and a re-bake that finally sees one scored firing drops the flag on its own. THIRD, A SECOND WRONG ATTRIBUTION FOUND WHILE FIXING THE FIRST: hgOgKindToInstKey falls back to `vwap` for any unmapped kind, which is right for GATING and wrong for ATTRIBUTION - a caller looking up a record by that key hands the mechanic the vwap row (-0.314R over n=132) as if it were its own. A strict mode returns null instead, and the new sibling-record note uses it: the card says NEVER OBSERVED, then names the GOLD SCALP record under sweepob, attributes it to that desk, and says it measures pre-trigger states rather than the confirmed setup. REFUSED: the session claim in the pasted strategy. The London/NY overlap 13:00-16:00 UTC is n=233 win 42.9% net -0.047 against n=972 win 43.4% net -0.014 OUTSIDE it - worse inside, and 2 of 4 disjoint windows on win, gross and net, so no verdict either way. No session gate ships. Also refused: promoting sweepob to prefer on a record that is not its, and removing the precursor mint - those 29 live rows are the best cohort in the scalp book at +0.30R and deleting them is not this pack call. This pack RE-LABELLED, it did not re-measure. 90% is arithmetic-impossible here: at the book mean planned R:R of 1.50 a 90% win rate is +1.25R per trade, against an actual 43.3% on a 40.1% gross breakeven. The register goes 77 -> 78 mechanics and 12 -> 13 never-observed, both derived rather than written. REGISTERING A MECHANIC WIDENS THE MULTIPLE-COMPARISON CORRECTION, and the code already derived it from OG_MECHANICS.length: the Sidak one-sided family bar moves 3.2091 -> 3.2128 sigma and the expected false promotions per bake 1.93 -> 1.95, so every OTHER mechanic now has a slightly STRICTER promotion bar. That is the correct direction and the reason the number was never written into the page. Tests: tests/test-omnigold-sweepob-wire.mjs (63 assertions) re-derives the 62-of-62 finding from the replay rather than trusting the comment; test-omnigold-unobserved updated. 32 of 33 mutations caught, the survivor documented and proven equivalent by the test. G1-G7, the cost ceilings, the min-loss vetoes, the stop floors and every suppress/demote/prefer bar are unchanged',
  built: '2026-09-22T00:00:00Z'
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
