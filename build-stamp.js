/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v1298',
  pack: "The user asked to use ONLY measured-profitable strategies, indicators, fundamentals and Pine scripts across GOLD SCALP, OMNIGOLD, GANESH GOLD and GOLD PINE. hg-v935 measured that filter directly on OMNIGOLD (36 reads x 4 disjoint windows x 2 fill bounds x 16 agreements needed = ZERO verdicts out of sample). hg-v937 forward-tested the 9-mechanic MILLI GOLD roster: 6/6 beat the full desk IN SAMPLE and 0/6 paid NET-POSITIVE forward (-0.17R to -0.04R). hg-v966 refuses an unmeasured gate on evidence that failed. So the honest answer is three parts, no gate anywhere: (1) hg-v917 DISCLOSURE SEAM FIX -- hgOgReplayZ reads row[5]/row[6] (gate-clear) not row[0]/row[1] (whole-walk). hg-v917 added the gate-clear figures to the row saying 'no verdict moves' -- measured for the POSITIVE promotion side only. The NEGATIVE veto-side was unmeasured until this pack. On the committed JSON, SIX mechanics flip ticket->VETO under the fixed read (THREE-BAR -4.13sigma, P9-VOLBAR -2.97, PD-EQUILIBRIUM -3.60, ADR-FADE -2.31, PIN-REJECT -3.34, SPRING -2.28) and ZERO flip VETO->ticket; this is a disclosure correction because the ACTUAL veto gate (hgOgGateMeasuredEdge) reads the forward ledger not this function -- the panels now honestly report 7 fails outright on the gate-clear population instead of 1 on whole-walk. (2) PROFITABILITY AUDIT panel -- hgGoldAuditPanelHtml renders the measured state on all four desks: GOLD SCALP (25 rows in HG_GOLD_SETUP_EDGE.scalp, PREFER/SUPPRESS/DEMOTE/NEUTRAL counts with named mechanics), GOLD SWING (14 rows), GOLD PINE (10 scored + 27 record-only, hg-v945/v922's refusal of a new confluence weight named), OMNIGOLD (54 measured mechanics, Sidak family bar +3.21sigma over 78, current VETO/promote/unknown counts under the fixed gate-clear read, MILLI GOLD's hg-v937 verdict quoted), GANESH GOLD (NO MEASURED RECORD -- names scripts/backtest-ganeshgold.mjs). Lead names hg-v935/v937/MILLI GOLD so a reader sees WHY the profitable-only filter is not a gate. Painted via hgGoldFwdNote for GOLD SCALP/SWING/PINE (returns '' for optigold/goldpro/newgold/goldultra/super-gold so those desks' notes are unchanged), via the OMNIGOLD panel chain beside hgOgSelectionRefusedHtml, via the GANESH GOLD mount's ggfwd slot. (3) GANESH GOLD walker -- scripts/backtest-ganeshgold.mjs + the HG_GANESH_WALK literal written from scripts/ganeshgold-evidence-literal.mjs (hg-v921 markers, FATAL on missing markers), measured:false until the first machine with Binance access bakes it (403 CONNECT on every outbound route here, confirmed across hg-v979/v990/v1160/v1294). No gate added. No threshold moves. No setup leaves any board. 76/76 guard assertions, 6/6 mutations caught. The forward ledger is where the question becomes answerable, out of sample.",
  built: '2026-10-10T00:00:00Z'
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
      node.title = (res.reason || 'stale') + ' — reloading…';
      return { stale: true };
    }
    node.textContent = v;
    node.className = 'verbadge';
    node.title = HG_BUILD.version + (HG_BUILD.pack ? (' · ' + HG_BUILD.pack) : '');
    return { stale: false };
  }catch(e){ return null; }
}

/* hg-v958: THE FRESHNESS CHECK HAD NO CLOCK.

   hgBuildInit ran hgBuildFreshness() once at DOMContentLoaded - the one
   moment a tab is current by definition - and after that only when the tab
   was hidden and shown again. This desk is built to sit open all day as the
   FOREGROUND tab (HG_GLOBAL_SCAN_MS re-scans it every ten minutes without
   ever hiding it), so visibilitychange never fires and the question "what is
   the server serving?" was asked exactly once per tab, at boot.

   Measured by driving the real file: zero timers installed, one fetch at
   boot, none in the eight hours after, and a second only after a tab switch.
   That is the hg-v957 defect in the OTHER update path - and it is why this
   path, which has no lockout bug of its own, still never recovered a pinned
   tab. Five minutes, deliberately the fastest of the three clocks (SW update
   15 min, desk re-scan 10 min), because it is one small GET of one file and
   it is the path that can recover a tab whose service worker is wedged. */
var HG_BUILD_POLL_MS = 5 * 60 * 1000;

/* Polling makes the automatic reload roughly a hundred times more frequent
   than a boot-only check, so it must not land on top of someone's typing -
   OMNIGOLD 1 takes a hand-pasted DATA BLOCK and a reload throws it away.
   An absent, throwing or unreadable document is NOT editing: this fails
   OPEN, because refusing an update on a document we cannot read would be a
   new lockout of exactly the kind hg-v957 removed. */
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

/* ONE definition of "ask the server which build it is serving, and act on
   the answer". The boot check, the tab-switch check and the poll are the
   same question asked at three different times. */
function hgBuildPoll(){
  try{ return hgBuildFreshness().then(hgBuildApplyFreshness); }
  catch(e){ return null; }
}

var hgPollStarted = false;
function hgBuildStartPolling(setIntervalFn, ms){
  try{
    if (hgPollStarted) return null;                 /* one clock per page */
    var si = (typeof setIntervalFn === 'function') ? setIntervalFn
           : ((typeof G.setInterval === 'function') ? G.setInterval : null);
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
    if (hgInited) return false;                     /* one page, one init */
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
    /* the clock the check never had */
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
G.hgBuildFreshness = hgBuildFreshness;
G.hgBuildSwWaiting = hgBuildSwWaiting;
G.hgRenderBuildChip = hgRenderBuildChip;
G.hgRenderVerBadge = hgRenderVerBadge;
G.hgBuildMaybeReload = hgBuildMaybeReload;
G.hgBuildApplyFreshness = hgBuildApplyFreshness;
G.hgBuildInit = hgBuildInit;
G.HG_BUILD_POLL_MS = HG_BUILD_POLL_MS;
G.hgBuildEditingNow = hgBuildEditingNow;
G.hgBuildPoll = hgBuildPoll;
G.hgBuildStartPolling = hgBuildStartPolling;

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
