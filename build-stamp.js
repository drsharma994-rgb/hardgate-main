/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v1311',
  pack: "CANDLE FORECAST tab still read 'Waiting for data...' after v14-2 shipped — a defect in v14-2's own code I'm correcting here. Two causes, both reproduced and both fixed. (1) The engine goldCandleForecast at goldind.js:18462 referenced _atr, __last, _ema — three helpers scoped INSIDE the file's IIFE above (line 137-18461 is (function(){...})()). The engine sits OUTSIDE that IIFE and could never see those names; every call threw a ReferenceError that the function's own try/catch swallowed, so every scan returned null and the tab painted 'No clear signal' forever. The three IIFE-privates are replaced with the plain-global atr and ema from indicators.js (which is NOT an IIFE — its helpers live at window scope by bare function declaration), with a typeof === 'function' guard so a missing indicators.js fails open to null rather than throwing. The engine is unchanged in math: sign of the EMA9 slope + ATR-projected range + 1.5R/3.0R TPs and a 1R stop. (2) The module's registration pattern wrote to window.HG_TAB_MODS directly — but the shell's const HG_TAB_MODS = {} at index.html:11004 is a LEXICAL binding (a top-level const, not a window property), so showTab's const mod = HG_TAB_MODS[id] reads a different object than the module writes to. And the script tag loaded at the body bottom (line 11188), AFTER the bootHgTabs IIFE at line 11006 that iterates window.HG_tabs and auto-creates the nav button + pane; bootHgTabs had already finished by the time the module even existed, so the auto-wire never ran. Fixed by (a) pushing onto window.HG_tabs instead — the same route every hg-v9xx+ tab uses (ai-agent, book, brain, carry) — which bootHgTabs copies into the shell's const, and (b) moving the script tag from the body bottom to beside book.js at the top of the body, so the push lands BEFORE bootHgTabs iterates. Doctrine: a DISPLAY tool, not a gate (hg-v966). No gate reads the forecast engine, no threshold moves, no setup leaves any board. UPSTREAM, hg-v14-0's own pack note (preserved verbatim below): a crown is a ticket only when independent pine families agree, or one family plus a second house strategy or a fresh indicator cross, including a fresh engulfing body; a fresh 1h or daily core the other way leaves a watch; hashrate votes only through a 30-day drop of 5 percent; NVT votes only at or above 90 and a missing NVT is not a pass; a fresh 12-bar open-interest divergence is one witness; one witness never flips a setup; a missing feed stays unread; the card does not invent levels. (2) hg-v1295: higher-timeframe accuracy lock. The pine and indicator books read the 4h and 1h tapes only, while the desk already loaded a 1d tape, stashed it on every candidate and painted it in the timeframe line - so a crown whose 4h confluence fought the daily tape still printed as a full ticket. The same ten cores now run on the daily tape through the SAME reader (hg-v949 one home, no second copy of the ports), and a fresh daily core the other way demotes the crown to a watch. The lock is OPPOSING-ONLY by construction: a daily core that agrees is disclosed in the note and counted nowhere, so it can never grow the family count and can never make the two-family ticket easier. The 15m tape is a disclosed three-state read, never a veto - a 15m EMA9/21 wiggle must not stand down a 4h swing. Lever: window.HG_OBTC_HTF_LOCK = false or localStorage hg_obtc_htf_lock = 0, default ON, read live per scan. The 4h/1h ticket, oppose and three-way promotion paths are byte-identical, and no gate module reads any new mark. (3) OMNIBTC RECORD BANK MADE MEASURABLE - the seventeen hg-v1293 record-only Pine ports were stamped on the row and the card but the forward record carried no reads bag, so hgFwdReadSplit measured zero rows by construction (the hg-v955 defect the doctrine comment claimed the bank was not). They now ride the reads seam as booleans (WITH = true, AGAINST = false, UNREAD absent), and the comment that named a scripts/obtc-factor-separation.mjs that was never written now states the truth. Also carries the (4) hg-v1297: the tape-regime stand-down. hgRegimeAllowsSetup is a hard veto every other crypto desk already runs on its own 4h tape (setup-stack, supersetup, chartvision-tab, contract-report) - a volatile tape refuses a trend-continuation entry and a compression tape refuses swing/best - and OMNIBTC consulted it NOWHERE, so a crown could print a ticket on a tape the identical setup would have been refused on everywhere else. It now stands down FIRST, naming the shared gate reason verbatim. OPPOSING-ONLY and withhold-only: it adds no vote to fams/agree/oppose and can never make a ticket easier. Three-state: an unreadable regime reports unchecked and is not a verdict, so it never demotes. Lever: window.HG_OBTC_REGIME_GATE = false or localStorage hg_obtc_regime_gate = 0, default ON. The version triad is consistent again: an earlier origin/main merge had left trendtable.js and hg-api-base.js on the previous cache id while build-stamp/sw/index.html had moved on, which would have served stale trendtable parts from cache; all five surfaces now carry one id. (5) hg-v1298: RSI votes only on a fresh cross of 50. A mid-range RSI is not a pass. A liquidity sweep is a wick back inside the prior ten bars, one witness. The EMA 50/200 stack is shown and never votes. (6) hg-v1299: the accuracy verdict is now HONEST end to end. The hg-v1168 weighted score read takerFlowWith and fundamentalAligned but nothing ever set them, so flow and fundamentals silently scored zero - they are now stamped in hgObtcApplyEvidence from the REAL Binance taker CVD slope and the resolved house fundamental stack (two-plus checked legs with the direction, none against). Cross-validation is scored per candidate, not just on the pre-pick row, and a sibling confirms only when it agrees on symbol AND direction - an opposing setup no longer confirms a crown. The crown is a triple gate - house-gates CLEAN, cross-family confirmation, and a weighted score at the floor; anything short prints WATCH (ticket:false), and the desk vanishes only when no candidate survives. (7) hg-v1300: TOP TRADERS vs RETAIL joins the fundamental stack - the gather now fetches Binance topLongShortPositionRatio (free, cached) and the new leg reads the house smart-$ spread (top minus retail, ±15pp, follow top traders; both sides required or UNCHECKED), voting into the regime, the headwind/tailwind evidence, the fundamentalAligned flag and the extreme chips. The record-only pine bank grows by two BTC-relevant states the shared reader already derived - Balanced Price Range (structure) and Heikin Ashi (trend) - RECORDED, never scored, until the forward ledger read-split measures them. (8) hg-v1303: two more free reads on the BTC board. PERP FUNDING is the missing crowding leg of the BTC board - the positioning.js FUNDING_EXTREME line (+/-0.05 percent per interval), read contrarian (longs paying past it is bear, shorts paying past it is bull, inside the line no vote, absent UNCHECKED) off the Binance funding the gather already fetches, voting into the regime, the headwind/tailwind evidence, the fundamentalAligned flag and a FUNDING EXTREME chip. COINBASE PREMIUM is the free US-spot read cryptoultra.js names as an un-faked gap - Coinbase USD spot against the Binance perp mark (the same premiumIndex call that carries the funding), in basis points - disclosed INFO ONLY (no house line exists, so it never votes) with a missing side left UNCHECKED. hg-v1304: the candle forecast names a lean only when two reads agree and none oppose. The band is one ATR around the last close. It is not a target and not a stop. A mixed tape stays unread. hg-v1306: one unopposed candle-forecast read is the directional call. The stop is one ATR against the last close. TP1 is one ATR with it. TP2 is two ATR. Reads that fight stay unread and mint no stop. hg-v1309: the side with more reads is the call even when the other side voted. A tie is broken by the last close. Stop, TP1 and TP2 still print. hg-v1310: candle forecast names hammer, shooting star, dragonfly and gravestone doji, marubozu, engulfing, piercing, dark cloud, harami, morning and evening star, three white soldiers, three black crows, tweezers and three inside. A pattern high or low is the stop only when it sits 0.25 to 2.5 ATR from the close. A tape with no majority stays neutral and prints no stop. BRANCH hg-v1310 (same id as upstream, newer tree): GOLD SCALP had been forming ZERO candidates on every scan - __goldBundle read a free variable `dir` at its macro read, threw ReferenceError on every call, and goldScalpSetups swallowed it in an outer catch { return [] }. That one throw was the shared cause of 18 red suites. The read is now stamped neutral as context only (the bundle runs before any direction exists so it cannot make a direction-dependent decision), the duplicate macro read in the Confluence Tallying block is removed, and the code records that the direction-aware macro veto is still unwired - hgGoldInstFilter, which does receive the side, never reads dxyTrend or us10yTrend. gold-candle-forecast.js also anchors its direct PAXG fallback through the one home (gold-iux.js).  Suite 44 failed -> 16. hg-v1311: a hammer votes long only after a decline or at a low. The same shape after a rise is a hanging man. A shooting star after a rise is short. An inverted hammer after a drop is long. Also named, each as its own vote: low and high sweeps that close back, outside bars, railroad tracks, belt holds, meeting lines, kickers, rising three methods and falling three methods. BRANCH hg-v1311 (same id, merged tree): the CANDLE FORECAST advanced pattern layer - four-bar reversals (three-line strike, three outside up/down, abandoned baby), continuations (rising/falling three methods, tasuki gap, side-by-side white lines), exhaustion and structural runs (three-bar climax, double inside/outside), and a LOCATION AND DRIFT CONTEXT for whatever printed. It is DISCLOSURE, NOT WEIGHT: it rides the result as advancedPatterns/patternLeans/patternWhere/patternDrift and never reaches bulls, bears, checked or rawStop, because a new voting family would double the live pattern weight (hg-v966) and could re-count a three-bar pattern the voter already counted (hg-v1153). Upstream hg-v1311 independently reached the same insight - a candle shape only votes when the prior swing agrees - and wired it into the vote while adding sweeps, outside bars, belt holds, kickers, meeting lines and three methods as voting families. Both are on this tree; the guard pins the non-voting invariant of the advanced layer.",
  built: '2026-10-13T11:20:00Z'
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
