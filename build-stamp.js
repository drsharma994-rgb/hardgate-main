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
  version: 'hg-v1106',
  pack: 'BATCH 1106 — every gold tab also filters the setup with USDJPY, the gold/silver ratio, the 2s10s curve, the session volume profile, Heikin Ashi, Renko and KAMA. June and July stay range trades. January and February do not take a short continuation. GLD tonnage stays unread. BATCH 1102 — GOLD PRO, GOLD PINE and OMNIGOLD name the feed IUX XAUUSD. Every gold tab now uses that spot tape, not the COMEX future. BATCH 1101 — GOLD SCALP, OMNIGOLD and GOLD SWING read IUX XAUUSD. A COMEX GC=F candle is shifted by the live spot gap before any gold tab sees it, so the board matches the XAUUSD.iux chart instead of the futures print. BATCH 1100 — Telegram sends only a Trend Matrix golden cross and a Gold Scalp. Crypto, death crosses, and Gold Swing are not delivered. BATCH 1099 — OmniGold crowns a lead only from its own ledger. The mechanic must be positive after the spread, at the 2R printed on the card, and clear of the family bar. A Gold Scalp or Gold Swing grade is not the lead. A past winner against the tape is not put on top. BATCH 1098 — a Gold Scalp leads only when it is a failed-break reversal or a volume-bar sweep. Every other card stays visible and cannot lead. BATCH 1097 — an accuracy failure stays on the Gold Scalp board as a card. It cannot lead, and it is not hidden. BATCH 1096 — a Gold Scalp lock lasts 90 minutes, not 6 hours. A setup that fails the accuracy bar is released instead of being shown again. BATCH 1095 — Gold Scalp judges the last closed bar only. A walk-forward that did not hold, a tiny sample, wrong-side levels, or a dollar and 10-year both against the side cannot lead. BATCH 1094 — opening Gold Scalp runs the scan on the visible tab. Feeds no longer hold the scan for half a minute. BATCH 1093 — Gold Scalp COT reads COMEX gold, not the first contract whose name contains gold. BATCH 1092 — Gold Scalp loads the feeds it was leaving unread: CFTC COT, spot versus perp basis, Fear and Greed, and the last macro snapshot if the live read is slow. The 10-year and dollar series now reach the yield guard. BATCH 1091 — real yield uses the free Treasury TIPS curve when FRED is missing, so Gold Scalp no longer reports an unread real yield. BATCH 1090 — GOLD SCALP shows setups again. A missing calendar, quote, higher timeframe, or real yield no longer blocks the card or the lead. A yield that is measured against the trade still cannot lead. The scan no longer waits on the calendar. BATCH 1089 — GOLD SCALP keeps the card when the dollar or the 10-year does not agree. The card is stamped GOLD FEED and cannot lead. It is no longer removed from the board. BATCH 1088 — GOLD SCALP now waits for the free USD calendar and will not lead on an empty cache or a FRED real yield that is missing or against the trade. A flat real yield is a real read and can still lead. BATCH 1087 — GOLD SCALP cannot lead when the live bid/ask was not read. A missing quote is not a tight spread. The card still paints. BATCH 1086 — GOLD SCALP no longer treats an unread H4 or Daily stack as permission. The card can still paint, but it cannot lead until both higher timeframes are readable and stacked with the trade. BATCH 1085 — GOLD TICKETS on OMNIGOLD, GOLD SCALP and GOLD SWING need the live dollar and the live 10-year both with the trade. A missing feed is not a yes. OMNIGOLD no longer invents a DXY of 103 or a real rate of 2.1 when those internet feeds are down. BATCH 1084 — version badge restored. A stray quote in the stamp script stopped it loading, so the badge read v?. BATCH 1083 — OMNIBTC TICKET only when structure, ATR, trend quality, the crown grid, cost, funding, taker flow, RVOL, R:R and macro tilt are positive reads. Otherwise the crown stays a WATCH. BATCH 1082 — FULL STACK technical WITH now requires the the rows own 4h structure (EMA50 vs EMA200) to agree. A missing structure is not a yes. BATCH 1081 — FULL STACK WITH is a positive read. Unread ATR, a mixed tape, and BTC funding that is only not crowded no longer stamp WITH. BATCH 1080 — TREND MATRIX TAB RESTORED. The desk script is served as one classic script again (the eval loader never ran under the page CSP, so the tab did not register). BATCH 1079 — TREND MATRIX FULL STACK: a row prints on the FULL STACK desk only when it is already PERFECT and technical, fundamental, sentiment, macro and micro are all readable and all WITH the majority. A dark pillar stays unread, not a yes. Empty is the honest result. Shape filter, not a profit claim. REVERSAL SNIPER RELAXED FINAL TUNING — the relaxed mode is pinned to logically-sound floors: min RR 1.5 -> 1.3 (a real net edge after ~0.2R round-trip cost, instead of the proposed 1.2 which nets barely 1R); min drawdown 2% -> 1.5% (a real dip, instead of the proposed 1% noise); and the dead opts.relaxDrawdown escape is removed so rsMinDrawdown() is the single source of truth for the drawdown floor. Also carries: REVERSAL SNIPER RELAXED TAPE-PENALTY RATIONALE — the proposed relaxed mode is reviewed and pinned: the stop cap 1.88% -> 3.0% is the single knob that also derives the leverage floor (min lev 30 -> 20 is the same change, not two); the against-tape penalty is set to -2 instead of the proposed -1 so the \"deprioritise against-tape, don\'t veto\" penalty stays proportional to the relaxed conviction floor (-2 vs floor 3 = 2/3, mirroring sniper -3 vs floor 4 = 3/4 — -1 would collapse to a 1/3 step too weak to matter). Relaxed rows remain WATCH-only, never tickets. Also carries: TREND MATRIX RAW COINDCX SCAN — the matrix\'s floor-0 CoinDCX pass now reads the RAW CoinDCX leg (new xuCoinDCXRows + hgDeskLoadCoinDCXAll) instead of filtering the deduped merged universe, so a CoinDCX contract that is also listed on Delta/Startrader with higher turnover no longer hides behind the winning venue\'s tag — every CoinDCX active_instruments contract now appears in the matrix regardless of the dedup\'s exchange tag. Also carries: FULL COINDCX UNIVERSE — Reversal Sniper and Chart Vision no longer let a $5M turnover floor (or an includeUnknown:false rule) shrink the CoinDCX leg; turnover is a witness on the card, never a scan gate. Also carries: REVERSAL SNIPER RELAXED MODE + EMPTY-BOARD DIAGNOSIS — a non-default opt-in RELAXED toggle (min lev 20, stop cap 3%, conviction 3, against-tape −1, RR 1.2) surfaces lower-grade post-drop long bounces as clearly-labelled WATCH rows while sniper-grade stays the default and the PIN-REJECT suppression is never overridden; the empty board now diagnoses per-gate drops (drawdown / trigger / stop-width / conviction) plus universe + fetch counts. Also carries: RS + CV CROWNS — the OMNIBTC treatment reaches the last two list-style desks. REVERSAL SNIPER crowns its leading bounce (LONG-only by design, TICKET or WATCH-ONLY under the PIN-REJECT policy) and CHART VISION crowns its strongest read (7/7 CLEAN leads as TICKET, 6/7 NEAR stays WATCH) — each with THE CALL, CROWN VERDICT, a COMPLETE ANALYSIS (technical - macro - micro, world tilt), a SETUP CARD with the automation JSON and the MEASURED EDGE chip. An empty scan prints no crown. Also carries the FEED FRESHNESS + KILL-ZONE LABELS — both crowns now stamp the AGE of the world feeds (WM + regime, in minutes) so a stale macro read is visible as stale, and the ASIA session on the scalp witnesses carries its quiet-hours kill-zone label. The prompt document gained its final two sections (Risk Management + Constraints). Also carries the TREND MATRIX FULL PARITY — the crown now carries the last OMNIBTC pieces: the ANCHOR panel (day VWAP + Bollinger state on the row\'s own tape), a SWING SETUP on the 4h grid, a SCALP SETUP on the 1h grid (honest DRAFT ATR14 ladder) and the SCALP SETUP - ALT SIDE stamped AGAINST THE CALL. The two desks are now feature-identical. Also carries the TREND MATRIX FINAL MILE — the matrix crown now reaches the operator: W.trendmxCrownState + a pure crown-of-rows seam feed a Telegram collector (clean tier only, PERFECT badges in the note, convicted-filter seat), the background auto-scan cycle force-scans the desk so records accumulate with the tab closed, and the crown MICRO gains the accuracy witnesses (fill odds + stop sensitivity). Also carries the TREND MATRIX SHARED PERFECT STACK — the matrix\'s eight strongest rows now run through the SAME reads bag and the SAME enrichment + predicate OMNIBTC consumes (hgObtcPerfectFormation), fed by the SAME external data: real Binance taker flow, Binance funding, the ATR-percentile regime, EMA50/200 structure, session RVOL and the news calendar. A PERFECT / PERFECT+ badge on a matrix row now means byte-identically what it means on OMNIBTC, and the crown verdict shows the shared badge. Evidence, never a gate. Also carries the TREND MATRIX CROWN — the OMNIBTC treatment on the matrix: a single bold THE CALL for the strongest majority row with a minted plan, a CROWN VERDICT line, a COMPLETE ANALYSIS (technical/sentimental/fundamental/macro/micro with the world tilt), a SETUP CARD (market thesis, bias, entry zone, SL, TP1-3 with the ungraded extension, automation JSON) and the MEASURED EDGE chip for the TRENDMX pool. An honest empty when no plan is minted. Also carries the PERFECT COHORT + WORLD TILT SPLITS — the shared forward panel now answers the desk\'s core question outright: the PERFECT COHORT split grades settled records by their badge (PERFECT+ / PERFECT / REST, n-hit-expR each) and the WORLD TILT ODDS split grades them by the fire-time macro tilt (RISK-ON / RISK-OFF / NEITHER). Both render on every recording desk and are reported, never gated - the marks the desks have written for months finally have their split. Also carries the OMNIBTC WORLD FEEDS — the desk now reads the world: the World Monitor macro verdict (QQQ/XLP/BTC/F+G + FRED economic stress), the REGIME playbook bias (LONG-ONLY/SHORT-ONLY/BOTH/STAND-ASIDE), the DXY 20d trend and the fed-liquidity w/w change, once per scan. The MACRO dimension prints a WORLD TILT chip (RISK-ON / RISK-OFF / NEUTRAL) with every feed line measured, and the tilt + verdicts ride the forward record so the ledger can later split on it. Evidence, never a gate. Also carries the OMNIBTC BOTH SCALP SIDES — the 15m grid now prints BOTH directions with the same structure: the side the matrix backs gets its real levels (CLEAN/NEAR), the opposite side gets the honest DRAFT ATR15 ladder stamped AGAINST THE CALL and names when the matrix reads the other way. A long scalp is always shown beside the short one. Also carries the OMNIBTC COMPLETE ANALYSIS — five dimensions in one panel, rendered BEFORE the setup: FUNDAMENTAL (netflow, carry, term basis), TECHNICAL (MTF agreement, structure, ATR regime, trend quality, Bollinger, VWAP), SENTIMENTAL (taker flow incl. absorption, F+G, 25d RR, funding crowd, DVOL, CVD context), MACRO (BTC.D, news, leverage cycle, basis momentum) and MICRO (liq clusters, volume budget, fill odds, stop sensitivity, mark distance, cost, venues, session) — each with its own verdict chip ALIGNED / CAUTION / AGAINST / UNREAD. Also carries the OMNIBTC SCALP WITNESSES + DVOL — the SCALP SETUP block now prints its own witnesses (fire-bar RVOL on the 15m tape, session, funding), and the Deribit options-vol read (DVOL + regime, already gathered every scan) finally renders in the witnesses panel. External resources are surfaced, never faked. Also carries the OMNIBTC DUAL GRID SETUPS — the desk now prints TWO distinct setups: a SWING SETUP on the 4h grid and a SCALP SETUP on the 15m grid, each standing on its own direction, tier (7/7 CLEAN from the real matrix, n/7 NEAR, or the honest DRAFT ATR ladder) and levels, with AGAINST THE CALL stamped when a grid disagrees with the crowned call. Also carries the SCALP-ANCHOR MARKS + SESSION-ODDS COMPLETION — the forward ledger records the signed VWAP deviation % and the Bollinger squeeze state on the winner tape (folding into the aggregate so the splits survive pruning), the OMNIBTC session-odds split and liquidation-magnitude capture complete the ACCURACY PACK wiring, and the cycle-context bag rides the snap. Desk state files refreshed. Also carries the OMNIBTC THE CALL + SCALP TARGET — the direction is now unambiguous: a bold THE CALL line prints first (LONG/SHORT - TICKET/WATCH with the counter-cascade and stand-aside caveats, or STAND ASIDE with no crown), and a SCALP TARGET block prints on the 15m grid (the real 15m scalp matrix when it agrees with the call, otherwise the honest DRAFT ATR15 ladder, never shown against the call). Also carries the ACCURACY PACK — the research-driven upgrade set for OMNIBTC + TREND MATRIX (hardgate-omnibtc-trendmx-accuracy-research.md): the TREND-QUALITY leg (Choppiness Index + Kaufman Efficiency Ratio) feeds the PERFECT formation and caps choppy TREND MATRIX rows at NEAR (never CLEAN), with CHOP vs EARLY FORMING stamps on the CoinDCX board; taker-flow ACCEPTANCE distinguishes absorption from distribution (against-but-absorbed no longer vetoes PERFECT); the LEVERAGE-CYCLE leg (OI change + funding reset) reads RESET / EXTENDED / FLAT; liquidation-map magnitudes (fuel + cluster USD) ride the record; the on-chain netflow verdict joins the evidence bag; a CYCLE CONTEXT panel prints MVRV-Z / SOPR / miner / netflow reads (UNREAD - never faked when data is absent); SESSION ODDS split the desk own settled record by session; spot-vs-perp CVD context (BOTH-WITH / PERP-ONLY / SPOT-ONLY / AGAINST) and basis momentum are read on the winner tape; and three new measured WATCH mechanics join the candidate pool: TSI CROSS (13/25 double-smoothed momentum), ADAPTIVE TREND (KAMA 10,2,30 + SuperTrend 10,3) and SPRING (range-bound liquidity sweep + springboard volume). Every new leg records forward marks the ledger splits later. Evidence first, never a gate.',
  built: '2026-10-05T12:50:00.000Z'
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
  try{
    if (!res || res.state !== 'stale' || !res.live) return false;
    var store = storage;
    if (!store && G.sessionStorage) store = G.sessionStorage;
    if (!store || typeof store.getItem !== 'function') return false;
    var key = 'hg_build_reload_' + String(res.live);
    if (store.getItem(key)) return false;
    /* deliberately BEFORE the key is written, so the next poll tries again
       the moment the field loses focus - the update is deferred, not lost */
    if (hgBuildEditingNow(doc)) return false;
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

(function(){
  try{
    var d = document;
    if (!d || !d.head || d.getElementById('hgGoldCombined')) return;
    var s = d.createElement('script');
    s.id = 'hgGoldCombined';
    s.src = 'gold-combined.js?v=1106';
    s.async = false;
    d.head.appendChild(s);
  }catch(e){}
})();
