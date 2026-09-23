/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v935',
  pack: 'SELECTING MECHANICS BY THEIR OWN RECORD - MEASURED, AND REFUSED. Asked for more profitable setups, this pack tested the one lever nobody had tested: OMNIGOLD forms setups from every registered mechanic and its measured-edge gate only vetoes at -2 sigma, which almost nothing reaches, so a mechanic whose own record is negative still tickets. GOLD SCALP got a suppress/demote table in hg-v928; OMNIGOLD never did. THE OBVIOUS TEST IS WORTHLESS AND THAT IS THE DESIGN PROBLEM. Ranking 54 mechanics on the whole book and keeping the winners, then scoring on that same book, cannot fail - the selection has already seen every outcome it is judged on. hg-v920 caught that exact shape once already, where grade A beat B/C at all three NESTED splits and was worse in three of four DISJOINT windows. So the selection never sees the window it is judged on: the book is cut into four disjoint windows, the mechanics are ranked on the OTHER THREE, and the chosen set is scored on the held-out one. Four independent out-of-sample trials, at both fill bounds, sixteen agreements needed. THE OBVIOUS RULE FAILS. Keep the gross-positive mechanics scores 13-14 of 16 at every sample floor and never once unanimous, in either the gross or the net column, with or without dropping the mechanics too thin to judge. The premise that this desk can pick its own winners is NOT SUPPORTED. THE WEAK RULE IS UNANIMOUS AND IS STILL REFUSED. Dropping only the mechanics measured at or below a bar IS unanimous at some bars - and sweeping the bar shows it switching ON and OFF between NEIGHBOURING thresholds: -0.05 yes, -0.10 yes, -0.15 NO, -0.20 NO, -0.25 yes, -0.30 yes, -0.40 no, -0.50 no. Four unanimous cells in TWO SEPARATE RUNS. A real effect fades as the bar moves; one that flickers is the output of a search over bars, which is hg-v922s stop-width finding restated, and this refusal stands for the same reason. Unanimity alone does not ship: the verdict requires it to be CONTIGUOUS in the threshold, and that requirement is in the code, not in the commentary. AND THE CEILING IS THE ANSWER TO THE QUESTION THAT PROMPTED IT. The best unanimous cell in the entire sweep lifts net expectancy by +0.0299R and leaves the book at -0.0861R on 8132 filled plans. Mechanic selection, read as generously as the evidence allows, does not make this desk pay - it makes it less negative. Anyone hoping detector selection is the profitability lever now has the number instead of the hope. NOTHING IS GATED ON ANY OF IT. No mechanic is dropped, no threshold moves, the Sidak family bar still corrects over the whole register, and G1-G7 are untouched. HG_OG_SELECTION is GENERATED from the replay by scripts/mechanic-selection.mjs - the hg-v921 rule, after hg-v909 shipped a hand-transcribed block from the wrong file - because a refusal quoted from memory drifts exactly as a promotion does, and this one exists to stop the idea being re-derived and shipped. hgOgSelectionRefusedHtml branches on the verdict rather than hardcoding it, so a future bake that DOES find a contiguous rule is announced instead of being hidden behind todays answer. Re-derive: node scripts/mechanic-selection.mjs (npm run og:selection). Tests: tests/test-mechanic-selection.mjs (69 assertions) - which proves the leave-one-window-out procedure BEHAVIOURALLY, with a mechanic that wins only inside one window and must not be selected for it, and the mirror showing it WOULD be kept if trained on that window. 11 of 11 mutations caught. A GUARD THAT WRITES A SHARED SOURCE FILE CAN CORRUPT THE THING IT GUARDS, and this pack proved it on itself. The first version of the test wrote the real omnigold.js to prove the generator rebuilds a corrupted block byte-identically, restoring it in a finally. Under the mutation harness - which runs that test with the generator DELIBERATELY BROKEN - one run wrote a literal computed by the mutated generator and the restore did not survive whatever ended that process. The repository was left carrying unanimousCells 6, runs 1, contiguous true: numbers no measurement produced, and precisely what the single-window-is-enough mutation computes. THE COMMITTED REFUSAL HAD BEEN SILENTLY TURNED INTO AN APPROVAL, and the only reason it surfaced is that the full suite failed while the test passed standalone. splice and renderLiteral are pure, so both this packs guard and hg-v934s now prove the rebuild ON STRINGS and never touch disk, each asserting that it contains no write to the file it checks. Two further holes closed on the way: the committed literal was not at the generators fixed point because the markers were placed by hand with different whitespace than splice emits - a round-trip check does not imply idempotence, so idempotence is now asserted and mutated - and the CLI guard used endsWith, which the test filename also satisfies, so importing the module ran the whole CLI inside someone elses test. Suite: 589 files, 0 failed',
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
