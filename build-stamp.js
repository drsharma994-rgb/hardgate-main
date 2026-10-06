/* hg-v1101: IUX XAUUSD. The gold desks fall through to Yahoo GC=F, which
   is the COMEX future, about $28 above the XAUUSD.iux chart. Shift that
   payload (and any other gold candle whose last close sits $8 to $80 above
   live spot) onto api.gold-api.com XAU before a tab parses it. A feed
   already on spot is left alone. DXY, TNX and silver are not touched. */
(function(){
  var G = (typeof window !== 'undefined') ? window : globalThis;
  if (typeof G.fetch !== 'function' || G.fetch.__hgIux) return;
  var orig = G.fetch.bind(G);
  var spotPx = NaN, spotAt = 0, spotInflight = null;
  function loadSpot(){
    var now = Date.now();
    if (spotPx > 1000 && (now - spotAt) < 45000) return Promise.resolve(spotPx);
    if (spotInflight) return spotInflight;
    spotInflight = orig('https://api.gold-api.com/price/XAU', { cache: 'no-store' }).then(function(r){
      return r && r.json ? r.json() : null;
    }).then(function(j){
      var p = j && +j.price;
      if (p > 1000 && p < 20000){ spotPx = p; spotAt = Date.now(); }
      return spotPx;
    }).catch(function(){ return spotPx; }).then(function(p){
      spotInflight = null;
      return p;
    });
    return spotInflight;
  }
  function goldUrl(url){
    return /GC=F|GC%3DF|GC%253DF|symbol=XAU|symbol=PAXG|XAU%2FUSD|XAU\/USD|\/api\/xm\/candles/i.test(url);
  }
  function lastClose(j){
    try{
      var q = j.chart.result[0].indicators.quote[0].close;
      for (var i = q.length - 1; i >= 0; i--) if (q[i] != null && +q[i] > 0) return +q[i];
    }catch(e){}
    try{
      var rows = j.rows;
      if (Array.isArray(rows) && rows.length){
        var b = rows[rows.length - 1];
        var c = +(b.c != null ? b.c : b.close);
        if (c > 0) return c;
      }
    }catch(e2){}
    try{
      if (Array.isArray(j) && j.length && Array.isArray(j[j.length - 1])){
        var c2 = +j[j.length - 1][4];
        if (c2 > 0) return c2;
      }
    }catch(e3){}
    return NaN;
  }
  function shiftNum(v, d){
    var n = +v;
    if (!(n > 0)) return v;
    return Math.round((n - d) * 100) / 100;
  }
  function apply(j, d){
    try{
      if (j && j.chart && j.chart.result && j.chart.result[0]){
        var r = j.chart.result[0];
        var q = r.indicators && r.indicators.quote && r.indicators.quote[0];
        if (q){
          ['open','high','low','close'].forEach(function(k){
            if (!q[k]) return;
            for (var i = 0; i < q[k].length; i++) if (q[k][i] != null) q[k][i] = shiftNum(q[k][i], d);
          });
        }
        if (r.meta && r.meta.regularMarketPrice != null) r.meta.regularMarketPrice = shiftNum(r.meta.regularMarketPrice, d);
        return true;
      }
    }catch(e){}
    try{
      if (j && Array.isArray(j.rows)){
        j.rows.forEach(function(b){
          if (!b) return;
          ['o','h','l','c','open','high','low','close'].forEach(function(k){
            if (b[k] != null) b[k] = shiftNum(b[k], d);
          });
        });
        j.symbol = 'XAUUSD.iux';
        j.iux = true;
        return true;
      }
    }catch(e2){}
    try{
      if (Array.isArray(j) && j.length && Array.isArray(j[0])){
        for (var i = 0; i < j.length; i++){
          var row = j[i];
          if (!row || row.length < 5) continue;
          row[1] = String(shiftNum(row[1], d));
          row[2] = String(shiftNum(row[2], d));
          row[3] = String(shiftNum(row[3], d));
          row[4] = String(shiftNum(row[4], d));
        }
        return true;
      }
    }catch(e3){}
    return false;
  }
  function wrapped(input, init){
    var url = '';
    try{ url = (typeof input === 'string') ? input : ((input && input.url) || ''); }catch(e){ url = ''; }
    var pending = orig(input, init);
    if (!goldUrl(url)) return pending;
    return pending.then(function(res){
      if (!res || !res.ok || typeof res.clone !== 'function') return res;
      var copy;
      try{ copy = res.clone(); }catch(e){ return res; }
      return copy.json().then(function(j){
        var last = lastClose(j);
        return loadSpot().then(function(spot){
          var gap = last - spot;
          if (!(spot > 1000) || !(last > 1000) || gap < 8 || gap > 80) return res;
          if (!apply(j, gap)) return res;
          G.__hgIux = { spot: spot, gap: Math.round(gap * 100) / 100, at: Date.now() };
          return new Response(JSON.stringify(j), {
            status: res.status,
            statusText: res.statusText || 'OK',
            headers: { 'Content-Type': 'application/json' }
          });
        });
      }).catch(function(){ return res; });
    });
  }
  wrapped.__hgIux = true;
  G.fetch = wrapped;
})();

/* HARDGATE — build stamp. Single source of truth for "which version am I running?"
   Loaded FIRST so every later script can read G.HG_BUILD. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_BUILD = {
  version: 'hg-v1144',
  pack: 'FREE RESOURCES FOR PERFECT SETUPS — TREND MATRIX: the shared-perfect pass now also reads the Deribit options vol index (public), the Coinglass free-tier liquidation clusters and the venue premium (venue funding vs the Binance twin), stamped into every crowned row and printed in the crown\'s TECHNICAL/MICRO dimensions. GOLD SCALP: a zero-touch FREE RESOURCES panel shows silver, DXY, the US 10Y real yield + real-rate hint, XAUUSDT open interest and DVOL - every feed free and already fetched by the house, evidence never a gate. Also carries the TRUE VERSION STAMP — two modules were painting a fake stamp: shivagold.js overwrote W.HG_BUILD.version to hg-v1111 at boot, and shiva-nav.js then rewrote any STALE badge to v1112, so every fresh page showed an old version no cache wipe could fix. Both are neutralized; the badge now always paints the real build from build-stamp.js alone. Also carries the ONE-LINK CACHE NUKER - a client stuck on an old shell now recovers with a single link: the header carries a fix-old-version link that hits /?hgkill=1, which wipes every service-worker cache, unregisters the worker and reloads clean; the worker itself gained the HG_KILL message handler. Also carries the TREND MATRIX FULL STACK — a golden or death card prints only after structure, location, EMA 20/50/200, VWAP, volume, the 15m sweep, open interest, CVD, macro, the calendar, BTC.D, ETH, stablecoin liquidity and news all agree. GANESH GOLD TRADING FIRM — the complete 17-step SMC/ICT framework as a new gold desk: HTF bias, BOS/CHOCH/MSS structure, buy-side and sell-side liquidity (PDH/PDL/week/Asia), premium/discount, order blocks and FVGs, 1.5xATR displacement, volume profile (POC/VAH/VAL), VWAP, ATR regime, squeeze, DXY + yields, the news calendar and sessions - both models (LONG/SHORT) graded on 12 independent legs (A+ >= 10, A >= 8, B >= 5), the better grade crowns, entry on the FVG/OB retest, SL beyond the sweep extreme + 0.5xATR, TP1/TP2/TP3 at the opposing liquidity, R:R must clear the style minimum, TICKET mints write the forward record under GANESHGOLD, and the crown joins the Telegram batch. Merged on top of hg-v1110: SHIVA GOLD trading firm, IUX XAUUSD feed alignment, Hurst + GARCH(1,1) on every gold tab, the London fixes, the OmniGold ledger lead rules and the Gold Scalp accuracy locks. SETUP CONFIRM now reads fresh qualified gold and crypto desk snapshots; stale scans cannot vote, gold uses its own structural spine, ticket desks retain their macro checks, and no feed providers were added.',
  built: '2026-10-05T19:53:18.000Z'
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
