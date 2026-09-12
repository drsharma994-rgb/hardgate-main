/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD.

   Two jobs:
     1. Say what version this tab loaded.
     2. Say whether that is actually the version the server is serving right now.

   (2) is the one that matters. A version number alone cannot tell you the tab is
   current — a stale service worker or an HTTP-cached shell will happily show you
   yesterday's number and look perfectly healthy. So the chip compares the loaded
   stamp against a cache-busted network read and calls STALE when they differ.

   WHEN YOU SHIP: bump VERSION here and HG_CACHE in sw.js to the same value.
   tests/test-build-stamp.mjs fails the suite if they ever drift apart. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

/* ---- the stamp -------------------------------------------------------- */
var HG_BUILD = {
  version: 'hg-v713',
  pack: 'CRYPTO ULTRA & CRYPTO SCAN: Tightened rule to 80% agreement + 40 votes + volatility floor; honest evidence explains fundamental limitation — indicator votes too correlated, long/short overlap cancels every trade on BTCUSDT 15m. Cleaner but still not tradable. Setups shown are audit-only record.',
  built: '2026-09-13T00:00:00Z',
  note: 'GOLD ULTRA now has SETUPS. The plain 492-read vote measured negative on its own (hg-v706) and stays RECORD ONLY — the would-be plan is priced and shown, stamped NOT A TICKET. scripts/backtest-goldultra-filter.mjs then joined every GOLD SCALP trade (the desk’s own 15m harness at XM costs) to the ULTRA read of its own signal bar: the two edge-table PREFER strategies the desk crowns (S30 failed-break reversal, S62 volume-bar sweep — both reversal mechanics) paid MORE when they traded AGAINST the consensus (+0.36R in-sample n=37, +0.37R out-of-sample n=15; +0.20R / +0.31R on the wider not-discredited book n=66 / 34) and went flat-to-negative WITH it (+0.13R / −0.08R), the same sign in both windows and both cuts. So the tab’s tickets are the GOLD SCALP prefer-book candidates, sourced through the desk’s own pipeline (goldScalpSetups → goldRankSetups → hgFilterGoldPostGate, feature-checked), and the count is a contrarian confluence stamp: AGAINST CONSENSUS crowns and is recorded to the forward ledger as GOLDSCALP-<key>-AGAINST-ULTRA; WITH CONSENSUS is shown and never crowned; unproven, non-prefer and demoted cards are shown with their reasons; held-back reasons are listed. The measured record prints on every card with its small n, and the VERIFIED filter panel prints the whole cohort table and the stated limitations (out-of-sample AGAINST n=15 — a consistent-sign preference, not a settled edge). Order words follow lib/xm-order-type.mjs, pinned by test. No win rates claimed. No invented thresholds. --- hg-v706: GOLD ULTRA (new tab under GOLD): one plain 15m scalp rule — every directional indicator read votes LONG / SHORT / neutral, and a side fires when >=25 reads are decisive and the chosen share agree — with the whole standard indicator directory fed in: 492 reads, 319 of them able to vote (moving averages, momentum, volatility, volume, trend strength, cycle/statistical, Ehlers DSP, Bill Williams, SMC/ICT structure, TradingView community and ML scripts, MT4/MT5 systems, session boxes and bands, harmonics, 15 TA-Lib candle patterns, Renko/Kagi/three-line-break, multi-timeframe syncs, and the forum / marketplace composites fed on request across seventeen directories), each row printing its value, its kind, its vote and its rule so the count can be audited by eye. Reads that cannot vote a side feed a REGIME gate; reads that cannot be computed from one instrument (market breadth, intermarket overlays, tape/DOM tools) or whose logic is proprietary are shown as n/a — never faked. Self-contained kernel so scripts/backtest-goldultra.mjs replays byte-identical math. VERIFIED, honestly: 5,769 closed 15m bars of PAXGUSDT at XM costs, rule chosen on the first 70% and reported on the untouched last 30% — the least-bad rule (85% agreement, regime gate on) was break-even in-sample (+0.001R) and measured -0.215R per trade after costs on n=137 out-of-sample (win 30%); every rule on the grid lost, and no session, direction or regime cohort was positive. So the tab fires NOTHING as a ticket: the count and every read print for the record, the VERIFIED panel prints the out-of-sample numbers and the stated limitations verbatim, and the engine gate says MEASURED NOT TRADABLE. No win rates claimed. No invented thresholds. --- hg-v705: GOLD DIRECTION printed a flat BUY/SELL beside every entry, so a long whose entry rested $95 under the last trade read "BUY $4,295" — a market order at a price gold had already left. The card now prints the order the reader can actually place (BUY / BUY LIMIT / BUY STOP and the SELL twins) by the same rule as lib/xm-order-type.mjs — the module the live gold-lot sender and the OMNIGOLD bot walk already share — with the gap from the last trade named beside it ("$95 below the last trade ($4,390) — resting order, not a fill you have now"), and the crowned banner labelled the same way. Second defect in the same ship: OMNIGOLD\'s detector can emit one hit TWICE on a single bar (proved live: two THREE-BAR longs on one timestamp with an identical plan, two ENGULF-LEVELs likewise); its own desk hides that behind a per-(kind,dir) dedup and this board had none, so the reader saw one setup as two independent reads. Duplicates are now collapsed once at the lane merge on (desk, horizon, strategy, side, levels) and COUNTED in the status line — two genuinely different plans from one strategy still both stand. tests/test-golddirection.mjs drives the rendered card against lib/xm-order-type.mjs case-for-case so the browser copy can never grow a third behaviour; all six order-word cases and the collapse assertions were confirmed RED against the old code before the fix. Prices themselves were never wrong: GOLD DIRECTION, GOLD SCALP and OMNIGOLD were cross-checked live against Binance PAXGUSDT and gold-api.com XAU and agreed inside $10. No win rates. No invented thresholds. --- hg-v704 (previous): All five gold desk backtests (GOLD SCALP, GOLD SWING, NEW GOLD, OMNIGOLD, OMNIGOLD 1) re-run serially through 2026-09-11 on a clean, race-free evidence snapshot — running them concurrently with --refresh had raced on the shared scripts/.bt-cache/ klines files. backtest-omnigold1.mjs fixed: its tab-lane replay hardcoded cachedKlines fetch sizes (m15 1200 / h1 1200 / h4 500) regardless of --bars/--scan-bars, silently capping LANE 1 and the tab-lane walk at ~12.5 days of history — masked whenever the shared 15m cache already held a bigger series left over from goldscalp. Fetch sizes now scale off SWEEP_BARS and the per-horizon DEPTH constants (h1 now ~2450 bars, ~84 days), and the console log reports actual fetched counts instead of a misleading claim. Every refreshed result was diffed against the pre-refresh baseline: all four other desks reproduce prior cohort win rates/expectancy within noise (one extra trading day, no sign flips, no new significant cohorts) — no live-app evidence table needed re-baking this cycle; the existing GOLD SCALP / GOLD SWING / NEW GOLD / OMNIGOLD / GOLD DIRECTION setups remain correct and current. No win rates. No invented thresholds.'
};

/* ---- pure helpers (unit-tested) -------------------------------------- */

/** Short human label, e.g. "v269 · pack 17". */
function hgBuildLabel(b){
  b = b || HG_BUILD;
  var v = String(b.version || '').replace(/^hg-/, '');
  var p = b.pack ? ' · ' + b.pack : '';
  return v ? v + p : 'unknown build';
}

/** Pull the VERSION string out of a build-stamp.js source text.
    Returns null when absent/unrecognisable — never throws. */
function hgBuildParseVersion(text){
  try{
    if (typeof text !== 'string' || !text) return null;
    var m = text.match(/version\s*:\s*['"]([A-Za-z0-9._-]{1,64})['"]/);
    return m ? m[1] : null;
  }catch(e){ return null; }
}

/** Compare loaded vs live. Conservative: only says 'stale' when it is certain. */
function hgBuildCompare(loaded, live){
  if (!loaded || !live) return { state: 'unknown', reason: 'could not read one side' };
  if (String(loaded) === String(live)) return { state: 'fresh', reason: 'matches server' };
  return { state: 'stale', reason: 'server is on ' + live + ', this tab loaded ' + loaded };
}

/** Numeric tail of hg-vNNN, for "how many builds behind" — null if not comparable. */
function hgBuildDistance(loaded, live){
  try{
    var a = String(loaded || '').match(/(\d+)\s*$/);
    var b = String(live || '').match(/(\d+)\s*$/);
    if (!a || !b) return null;
    return (+b[1]) - (+a[1]);
  }catch(e){ return null; }
}

/** Chip text + severity from a freshness result. Pure, so the UI is testable. */
function hgBuildChipState(res, b){
  b = b || HG_BUILD;
  var label = hgBuildLabel(b);
  if (!res || res.state === 'pending') return { text: label, cls: 'ok', title: 'checking for a newer build…' };
  if (res.state === 'fresh') return { text: label, cls: 'ok', title: 'running the current build (' + res.live + ')' };
  if (res.state === 'stale'){
    var d = hgBuildDistance(res.loaded, res.live);
    var behind = (d != null && d > 0) ? ' (' + d + ' behind)' : '';
    return {
      text: label + ' · STALE' + behind,
      cls: 'bad',
      title: res.reason + ' — hard-reload to pick it up'
    };
  }
  return { text: label + ' · ?', cls: 'warn', title: (res.reason || 'freshness unknown') + ' — offline or blocked' };
}

/* ---- network freshness check ----------------------------------------- */

/** Async: is this tab running what the server serves?
    fetchImpl injectable for tests. Never throws, never rejects. */
function hgBuildFreshness(fetchImpl){
  /* typeof, not truthiness: any non-null value passed here used to be
     accepted as a fetch and then called, throwing "f is not a function"
     instead of returning the honest 'unknown' this function exists to give. */
  var f = (typeof fetchImpl === 'function') ? fetchImpl
        : (typeof G.fetch === 'function' ? G.fetch.bind(G) : null);
  var loaded = HG_BUILD.version;
  if (!f) return Promise.resolve({ state: 'unknown', loaded: loaded, live: null, reason: 'no fetch available' });
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

/** Is a new service worker sitting in waiting state? (update downloaded, needs reload) */
function hgBuildSwWaiting(){
  try{
    var sw = G.navigator && G.navigator.serviceWorker;
    if (!sw || !sw.controller) return Promise.resolve(false);
    return sw.getRegistration().then(function(reg){
      return !!(reg && reg.waiting);
    }).catch(function(){ return false; });
  }catch(e){ return Promise.resolve(false); }
}

/* ---- paint ----------------------------------------------------------- */

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
      node.title = (res.reason || 'stale build') + ' — reloading…';
      return { stale: true };
    }
    node.textContent = v;
    node.className = 'verbadge';
    var b = HG_BUILD;
    node.title = HG_BUILD.version + (b.pack ? (' — ' + b.pack) : '') + (b.built ? (' · built ' + b.built) : '');
    return { stale: false };
  }catch(e){ return null; }
}

/** Reload once when the server is ahead. storage + reloadFn injectable for tests. */
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
          res = { state: 'stale', loaded: res.loaded, live: res.live,
                  reason: 'a newer build is downloaded and waiting' };
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
