/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v943',
  pack: 'TWO MEASURED RECORDS OF THE SAME GOLD MECHANIC DISAGREE IN SIGN, AND THE TABS WERE PROMOTING ON THE SMALLER ONE. Asked again for better gold setup formation, the additive half shipped in hg-v942; this is the other direction - what these tabs already form that the evidence argues against. Several mechanics here are WIRED OMNIGOLD MECHANICS, the same detector registered deliberately in hg-v567 through hg-v576, so each carries TWO measured records. Nothing had ever compared them. FOR TWO OF THEM THE RECORDS DISAGREE IN SIGN, and the tab holds the smaller sample. p8range, the S52 range-bar S0 sweep: this desk measured n=91 at plus 0.038R and calls it NEUTRAL, which can lead; its twin P8-RANGE measures n=323 at MINUS 0.613R. p9volbar, the S62 volume-bar sweep: this desk measured n=72 at plus 0.155R and calls it PREFER, a plus 2 RANK BOOST; its twin P9-VOLBAR measures n=274 at MINUS 0.499R. Both twins sit past OMNIGOLD EDGE_VETO_Z of minus 2 - the bar at which OMNIGOLD refuses to ticket a mechanic at all. hg-v934 refused to port PIVOT-REJECT on exactly that reasoning, that these desks have no measured-edge gate of their own, and applied it only to a NEW port. Their own mechanics were never checked. THE NUMBERS QUOTED ARE THE CONSERVATIVE ONES. Naive z reads minus 5.98 and minus 4.66; OMNIGOLD own cluster-corrected statistic, reused rather than reimplemented, reads MINUS 3.81 and MINUS 2.97 on effective n of 131 and 111. Both still clear the bar, and quoting the naive pair would have overstated the case by about two sigma. Breakeven is one third because the twin record was measured on 2R plans, not on this desk 1.5R. WHAT THIS DOES NOT DO IS THE POINT. It does NOT demote and does NOT suppress. The two records measure DIFFERENT POPULATIONS - this desk replay on its own gates and its own 15m and 4h horizons, against the gate-clear population of the OMNIGOLD 35-gate stack on 1h - and importing a foreign population verdict wholesale is the hg-v923 attribution error, with hg-v920 having measured what acting on a whole-book read does out of sample. WHAT IT DOES is refuse to ACTIVELY PROMOTE on the smaller of two contradicting records: a prefer row whose exact twin is past the bar loses its plus 2 rank boost and falls back to neutral. The setup still forms, still paints, keeps its levels, and can still lead on its own merits. AND EVERY AFFECTED CARD SAYS SO, naming both samples, attributing the foreign record to OMNIGOLD gates and a 1h horizon, stating that neither supersedes the other while naming which way the weight of evidence points, and saying plainly that nothing is demoted on it. A neutral row has no boost to withhold, so it discloses and changes nothing. LOOSE ANALOGIES ARE NOT TWINS and the guard proves it behaviourally: nyexh is not NY-OPEN-DRIVE, liqsweep is not PDL-SWEEP, silverb is not KZ-JUDAS, hvn is not FVG-HVN. A record is borrowable only for the same mechanic. MEASURED ON THE REAL MINT. GOLD SWING over 111 scans: candidates UNCHANGED at 72, boosted rows 22 to 11, ELEVEN RANK BOOSTS WITHHELD and 22 cards now carrying the disclosure. GOLD SCALP over 120 scans: 173 candidates, 10 boosted, and zero effect on this series because neither mechanic formed on it - the rule is live on both tabs, the measured bite here is on swing. The read is LIVE, not baked: a re-bake that turns a twin positive restores the boost with no edit, and the guard proves that too. Fails open - no OMNIGOLD, no check. Reversible with hgGoldSetTwinCheck(false). NO GATE, THRESHOLD OR VERDICT MOVES, and no setup is removed from either board. Tests: tests/test-gold-twin-conflict.mjs (68 assertions), 12 of 12 behavioural mutations caught, baseline verified green first. Suite: 595 files, 0 failed',
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
