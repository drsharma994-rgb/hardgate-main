/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v945',
  pack: 'A MEASURED-POSITIVE GOLD MECHANIC COULD NOT BE FORMED ON GOLD SWING AT ALL, AND THE COVERAGE CLAIM THAT SHOULD HAVE CAUGHT IT NEVER ASKED WHICH TAB. Asked again for more gold indicators and strategies on these desks, and this time the additive well is measurably dry: ranked by gate-clear record at XM, exactly NINE of the 54 measured OMNIGOLD mechanics are net-positive, and after hg-v942 all nine are reachable. The best of the other 45 are P7-SCALP at minus 0.0099R and HA-FLIP at minus 0.0113R, falling away to PIN-REJECT at minus 0.9396R - so adding more MEASURED mechanics now means adding measured losers. What was missing was not a new detector but a tab. EQH-SWEEP is on that nine-strong derived roster, its home is smcliq, GOLD SCALP has minted it since hg-v564, and GOLD SWING ran the SAME detector on its own 4h series and only STAMPED candidates that already existed - inside a block guarded on got.length, so on a quiet tape, which is exactly when a desk is asked for a setup, an equal-highs sweep produced nothing there at all. hg-v942 called its coverage exhaustive because every roster kind is ported or has a named home; the home check never asked WHICH TAB the home was on, and a per-kind claim cannot see a per-tab hole. hgGoldRosterTabGaps reports it per tab now, and the guard proves the reporter is not vacuous by taking the tab back off and requiring the gap to come back. GOLD SWING MINTS IT: entry at the swept level per hg-v423, the stop from the one shared ported-mechanic rule rather than a second invention, and everything downstream is the tab own - mkCand still demands two agreeing reads and a majority, push still runs the inst filter, the stop-width floor, the edge table, the confluence ledger and the cost gate. It fails CLOSED: no detector, no hit, or no shared stop rule and it mints NOTHING rather than reaching for a local re-implementation. It mints DEMOTED, and THIS line demotes it, naming the record it lacks. TWO DEFECTS FOUND WHILE WIRING IT. First, the ported mechanics were gated on a plan the desk does not trade: mkCand prices through a helper that IGNORES the anchor when no zone is given and returns the live mark, so hg-v942 ran the 1.2R build gate against the mark and then overwrote entry with the mechanic level. Driven end to end, a port proposing a 1.500R plan was REJECTED at 0.614R. The five hg-v933 and hg-v934 extras set entry to the last close, so for THEM mark and entry coincide and nothing was wrong - the fault was the ports alone. Second, hg-v942 declared the home and never declared the twin, so the record lookup for smcliq returned null and the card would have told a reader that no OMNIGOLD mechanic reads the same thing while v942 own table named one - the hg-v934 failure exactly. The homes are now folded into the twin map FROM the home map so one list decides both, which also puts them under the measured-failure veto; the record generator reads that same list, because it had been writing a literal the runtime looked past. MEASURED, AND IT MOVES NOTHING HERE: over 120 scans of one 4h tape the swing mint is 109 candidates and 204 rejects with and without both changes, identical. The entry fix changes the R:R the gate computes on ported rows without flipping one in or out, and the SMC detector never fires on that tape. The tape is SYNTHETIC because every data route is 403 CONNECT, so it is weak evidence of frequency and is not offered as more. The behaviour is proved by driving the real goldSwingSetups. SEPARATELY, WHAT ACTUALLY WITHHOLDS GOLD SETUPS, MEASURED: of the nine demote stamps GOLD SCALP applies at scale on the 1,205 trades it still forms, judged on four DISJOINT windows at BOTH fill bounds, exactly ONE is supported - EDGE DEMOTE, unanimous on win AND gross AND net at both ends, n=824, minus 0.137 and minus 0.152 net. The desk LARGEST demote, CONF NO TRADE at n=953, carries no verdict, and five stamps LEAN the wrong way - the desk marking its better rows - without one of them being unanimous. A lean is not a verdict and the script reports them as different fields so the distinction cannot be lost in prose. NOTHING IS GATED ON ANY OF IT: hg-v920 refused three loosenings on this evidence and hg-v944 a fourth. Re-derive with node scripts/demote-separation.mjs. Tests: tests/test-gold-swing-smcliq.mjs, 50 assertions, 20 of 20 behavioural mutations caught across three files with the baseline verified green first',
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
