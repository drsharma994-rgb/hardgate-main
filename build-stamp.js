/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v922',
  pack: 'WHAT ACTUALLY SEPARATES WINNERS ON BOTH GOLD DESKS, AND WHY IT IS NOT WHAT EITHER DESK RANKS BY. Asked how to raise the win rate. The first thing the measurement does is refuse the easy version of the question: a win rate can be raised arbitrarily by shrinking the target, so every factor is reported with win%, gross R and net R TOGETHER, plus mean planned R:R on both sides of each split. Nothing here bought one with another - every split sits at rr 1.49-1.52 on both sides. TWENTY SIGNAL-TIME FACTORS, TEN PER DESK, each judged on FOUR DISJOINT WINDOWS (hg-v920: nested splits made five earlier packs read one window three times) at BOTH FILL BOUNDS (hg-v918: the lower bound deletes unprovable wins and keeps unprovable losses, which punishes tight-stop rows hardest - exactly the cohort a stop-width claim is about, so the as-recorded end is the conservative one here). A factor carries a verdict only when all four windows agree on win AND gross AND net, at both ends. FOUR OF TWENTY DO. WHAT THE DESKS RANK BY IS NOT AMONG THEM. On the 1,205 trades GOLD SCALP forms today: tally >= 8 is -7.3 pts of win rate and -0.186R, grade A -3.5 pts and -0.072R, not-demoted -3.0 pts and -0.068R - and NONE of the three is unanimous in either direction. That is not a claim that a low tally is better; 1 of 4 is noise in the same way 3 of 4 is. It is the stronger claim that the ordering carries no information about the outcome. OMNIGOLD says the same of its own score: tier STRONG 2 of 4, confluence >= 50 1 of 4, checksPass >= 4 2 of 4. THE STOP IS WHAT SEPARATES. stop >= 0.28% and >= 0.50% are unanimous on all three columns at both bounds on GOLD SCALP; stop >= 0.50% likewise on OMNIGOLD. And it is NOT hg-v919 arithmetic restated: 69% of the scalp 0.28% net difference is GROSS, unanimous on its own. THE LIMIT ORDER IS THE UNCOMFORTABLE ONE, AND IT CARRIES A CAVEAT THE OTHER ROWS DO NOT. On OMNIGOLD a pending entry is unanimously WORSE in every window - -3.2 pts win, -0.0737 gross - across 4,988 of 8,132 settled rows. But the lower bound is NOT NEUTRAL for this one split: ambiguousSameBarWin is set only on a PENDING fill (457 of 4,988 limit rows, 5 of 269 stop rows, 0 of 2,875 market rows), because a market touch never needs proving - so that end demotes one side of the comparison and is not independent evidence for it. The verdict rests on the as-recorded end alone, which is the conservative one here and is enough. Adverse selection is the EXPLANATION OFFERED, not a measured one; the walk own fill model is the competing explanation and nothing in this table separates them. Published as loudly as the positives; nothing changed on it, because the alternative pays the spread twice and that is not what this measured. NO THRESHOLD MOVES, AND THE REFUSAL IS THE POINT. The DIRECTION holds and a NUMBER does not: scalp unanimity runs 0.20 no, 0.24 no, 0.28 YES, 0.32 no, 0.40 no, 0.50 YES, 0.60 YES. A property that appears, vanishes and returns is a threshold being searched for, not measured - shipping 0.28% would be the hg-v920 mistake with a new number on it. And OMNIGOLD at 0.50% goes from -0.116R to -0.005R, losing to FLAT not to positive, while deleting 52% of its volume. ONE MORE TRAP DECLINED: tier FAIR, 77% of the OMNIGOLD settled book, is unanimously worse at the lower bound and only 2 of 4 on gross at the as-recorded end - so it carries no verdict, and reading one end alone would have retired three quarters of the desk on the end hg-v918 built to stop that. Re-derive with node scripts/factor-separation.mjs; tests/test-factor-separation.mjs re-runs it against both committed replays so neither table can drift. 440 assertions, 57 of 58 mutations caught, the survivor proven equivalent by the test rather than argued. G1-G7, the cost gate at 8x the venue round trip, the lead invariant, the gold stop floors and ceilings, the min-loss vetoes and the suppress/demote/prefer bars are all unchanged',
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
