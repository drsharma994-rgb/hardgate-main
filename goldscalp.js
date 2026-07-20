/* =========================================================================
HARDGATE — goldscalp.js
GOLD SCALP tab: expert gold scalping engine. RUN SCAN pulls multi-timeframe
gold klines (15m/1h/4h), runs the pure goldind.js composite
(window.goldScalpSetup) and renders one card per qualifying setup: direction
stamp, strategy, grade, ENTRY/STOP/TP1/TP2 with R:R, the confluence ledger,
killzone stamp, NEWS-FADE banner and seasonal context.

Feeds (in preference order):
  1) window.getGoldCandles (macro.js) — XAUUSDT TradFi perp first (tracks
     spot closer than tokenized gold), PAXGUSDT fallback, then Twelve Data /
     Yahoo. This is a better spot-gold source than a bare PAXGUSDT pull, so
     it wins when macro.js is loaded.
  2) binanceKlines('PAXGUSDT') — deepest free gold-proxy feed (fallback).
  3) Delta's XAUTUSD perp, when window.xuUniverse + window.xuCandles exist
     and XAUT is listed — scanned as a SECOND venue with its own card.

Classic script, no build step, loads AFTER goldind.js + binance.js (+macro.js
/xuniverse.js/news.js when present). Never throws at load, mount, scan or
refresh: every external global is feature-checked, every network leg is async
with its own try/catch, and every failure degrades to an honest stat line /
empty state — nothing is fabricated.

Registers window.HG_tabs.push({id:'goldscalp', label:'GOLD SCALP', mount,
refresh}) — refresh(): async, never throws, 'busy' | 'skipped: not run yet' |
'refreshed' | 'error: …', busy-guarded, and never triggers a first-time scan
on its own. Warm-up: window.HG_warmups.push({id:'goldscalp', run}) — 'fresh'
when a state snapshot exists, else a headless scan against inert stub
elements (oiflow.js oiflowWarm pattern) -> 'warmed' | 'busy' | 'unavailable: …'.

BRAIN STATE CONTRACT — after each SUCCESSFUL scan the qualifying setups are
cached module-locally and exposed as window.goldscalpState() for the BRAIN:
  { results: [{ venue, sym, dir, grade, strategy }], at } | null
Zero-arg getter, never throws, deep-frozen copies; a failed re-run keeps the
previous good snapshot with its original `at`.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var KL_15M = 240, KL_1H = 200, KL_4H = 220;

/* ---------------- tiny helpers ---------------- */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pxF(n){
  if (typeof px === 'function'){ try{ return px(n); }catch(e){} }
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function'){ try{ return fmt(n, d); }catch(e){} }
  return (n === null || n === undefined || !isFinite(n)) ? '—'
       : Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name]; }catch(e){}
  return null;
}

var SRC_LABEL = { 'binance-xau': 'BINANCE XAUUSDT', 'binance-paxg': 'BINANCE PAXGUSDT',
                  'twelvedata': 'TWELVE DATA XAU/USD', 'yahoo': 'YAHOO GC=F' };
function venueLabel(src){ return SRC_LABEL[src] || 'PAXGUSDT · BINANCE'; }

/* ---------------- BRAIN state snapshot ---------------- */
var __snap = null;
function __stateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = __stateView(v[k]);
  }
  Object.freeze(out);
  return out;
}
function publishState(results){
  try{
    var rows = [];
    for (var i = 0; i < results.length; i++){
      var r = results[i];
      if (!r || !r.setup) continue;
      rows.push({ venue: r.venue, sym: r.sym, dir: r.setup.dir, grade: r.setup.grade, strategy: r.setup.strategy });
    }
    __snap = { results: rows, at: Date.now() };
  }catch(e){ /* snapshotting must never break the scan */ }
}

/* ---------------- card renderer ---------------- */
function cardHTML(r){
  var s = r.setup;
  var dirUp = s.dir.toUpperCase();
  var gradeCls = s.grade === 'A' ? 'ok' : '';
  var chips = s.confluence.map(function(c){ return '<span class="gpip ok">' + esc(c) + '</span>'; }).join('');
  var contra = (s.dir === 'long' ? s.reads.short : s.reads.long);
  if (contra > 0) chips += '<span class="gpip">' + contra + ' opposing read' + (contra === 1 ? '' : 's') + ' on the books</span>';
  var newsBanner = s.newsCaution
    ? '<div class="note warn" style="margin-top:8px">NEWS-FADE — ' + esc(s.newsStamp || '') + '</div>' : '';
  var notes = (s.notes && s.notes.length)
    ? '<div class="note" style="margin-top:6px">' + s.notes.map(esc).join(' · ') + '</div>' : '';
  var season = r.season ? '<div class="note" style="margin-top:6px">' + esc(r.season) + '</div>' : '';
  var tradeBtn = (typeof toTrade === 'function' && r.sym)
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  return '<div class="card ' + s.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(r.venue) + '</span>'
    + '<span class="dir">' + dirUp + ' · GRADE ' + s.grade + ' · ' + esc(s.strategy) + '</span></div>'
    + '<div class="mini">'
    + '<span class="k">venue</span><span>' + esc(r.venue) + '</span>'
    + '<span class="k">reads</span><span>' + s.reads.long + ' long / ' + s.reads.short + ' short</span>'
    + '<span class="k">killzone</span><span>' + esc(s.killzone) + '</span>'
    + '<span class="k">ATR14 15m</span><span>' + pxF(s.atr) + '</span>'
    + '<span class="k">R:R</span><span>1 : ' + fmtF(s.rr, 1) + ' (T1) · 1 : ' + fmtF(s.rr2, 1) + ' (T2)</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ' + gradeCls + '">GRADE ' + s.grade + '</span>'
    + '<span class="gpip">' + esc(s.killzone) + '</span>'
    + chips
    + '</div>'
    + '<div class="plan">ENTRY <b>$' + pxF(s.entry) + '</b>'
    + ' · STOP <b>$' + pxF(s.stop) + '</b>'
    + ' · TP1 <b>$' + pxF(s.t1) + '</b> (' + fmtF(s.rr, 1) + 'R)'
    + ' · TP2 <b>$' + pxF(s.t2) + '</b> (' + fmtF(s.rr2, 1) + 'R)'
    + '</div>'
    + newsBanner + notes + season
    + tradeBtn
    + '</div>';
}

/* ---------------- data legs (each catch-isolated) ---------------- */
async function fetchGoldKlines(){
  var out = { rows15m: [], rows1h: [], rows4h: [], source: null };
  var ggc = gfn('getGoldCandles');
  if (ggc){
    try{ var a = await ggc('15m', KL_15M); if (a && a.rows && a.rows.length){ out.rows15m = a.rows; out.source = a.source; } }catch(e){}
    try{ var b = await ggc('1h', KL_1H);  if (b && b.rows && b.rows.length){ out.rows1h = b.rows; if (!out.source) out.source = b.source; } }catch(e2){}
    try{ var c = await ggc('4h', KL_4H);  if (c && c.rows && c.rows.length){ out.rows4h = c.rows; if (!out.source) out.source = c.source; } }catch(e3){}
  }
  if (!out.rows15m.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length){ out.rows15m = p; out.source = 'binance-paxg'; } }catch(e4){}
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) out.rows1h = q; }catch(e5){}
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length) out.rows4h = z; }catch(e6){}
    }
  }
  return out;
}

/* Delta XAUTUSD perp leg — only when the xuniverse layer exists and lists it */
async function fetchDeltaXaut(){
  var out = { rows15m: [], rows1h: [], rows4h: [], item: null };
  var xu = gfn('xuUniverse'), xc = gfn('xuCandles');
  if (!xu || !xc) return out;
  var uni = null;
  try{ uni = await xu(); }catch(e){ uni = null; }
  if (!Array.isArray(uni) || !uni.length) return out;
  var item = null;
  for (var i = 0; i < uni.length; i++){
    var it = uni[i];
    if (!it) continue;
    if ((it.base === 'XAUT' || it.sym === 'XAUTUSD') && it.exchange === 'delta'){ item = it; break; }
  }
  if (!item) return out;
  out.item = item;
  try{ var a = await xc(item, '15m', KL_15M); if (a && a.length) out.rows15m = a; }catch(e2){}
  try{ var b = await xc(item, '1h', KL_1H);  if (b && b.length) out.rows1h = b; }catch(e3){}
  try{ var c = await xc(item, '4h', KL_4H);  if (c && c.length) out.rows4h = c; }catch(e4){}
  return out;
}

/* ---------------- scan ---------------- */
var __scan = { busy: false, hasRun: false, ui: null };

function setStat(ui, t, warn){
  if (!ui || !ui.stat) return;
  ui.stat.textContent = t;
  ui.stat.className = warn ? 'note warn' : 'note';
}
function setProg(ui, f){
  if (!ui || !ui.prog) return;
  ui.prog.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && ui.prog.firstElementChild) ui.prog.firstElementChild.style.width = (f*100).toFixed(1) + '%';
}

async function runScan(ui){
  if (__scan.busy) return 'busy';
  __scan.busy = true;
  var t0 = Date.now();
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    if (ui && ui.cards) ui.cards.innerHTML = '';
    if (ui && ui.empty) ui.empty.style.display = 'none';
    setProg(ui, 0);
    var setupFn = gfn('goldScalpSetup');
    if (!setupFn){ setStat(ui, 'goldind.js not loaded — the detector engine is missing (check script order).', true); return 'error: goldind missing'; }

    setStat(ui, 'pulling gold klines 15m/1h/4h…');
    var now = Date.now();
    var news = null;
    var ns = gfn('hgNewsState');
    if (ns){ try{ news = ns(); }catch(eN){ news = null; } }
    var seasonFn = gfn('goldSeason');
    var season = seasonFn ? seasonFn(now).note : null;

    var results = [], legs = [];

    /* leg 1: primary gold feed (getGoldCandles chain -> PAXGUSDT fallback) */
    var gold = await fetchGoldKlines();
    setProg(ui, 0.45);
    if (gold.rows15m.length){
      var v = venueLabel(gold.source);
      var setup = null;
      try{ setup = setupFn({ rows15m: gold.rows15m, rows1h: gold.rows1h, rows4h: gold.rows4h, now: now, news: news }); }catch(eS){ setup = null; }
      if (setup) results.push({ venue: v, sym: (gold.source === 'binance-paxg') ? 'PAXGUSDT' : 'XAUUSDT', setup: setup, season: season });
      legs.push(v + ': ' + gold.rows15m.length + ' 15m bars' + (setup ? ' — setup ' + setup.dir.toUpperCase() + ' grade ' + setup.grade : ' — no qualifying confluence'));
    } else {
      legs.push('primary gold feed: no 15m klines from any source (macro chain + PAXGUSDT both failed)');
    }

    /* leg 2: Delta XAUTUSD perp (best-effort second venue) */
    setStat(ui, 'checking Delta XAUTUSD perp…');
    var dx = await fetchDeltaXaut();
    setProg(ui, 0.8);
    if (dx.item && dx.rows15m.length){
      var setup2 = null;
      try{ setup2 = setupFn({ rows15m: dx.rows15m, rows1h: dx.rows1h, rows4h: dx.rows4h, now: now, news: news }); }catch(eS2){ setup2 = null; }
      if (setup2) results.push({ venue: 'DELTA XAUTUSD', sym: 'XAUTUSD', setup: setup2, season: season });
      legs.push('DELTA XAUTUSD: ' + dx.rows15m.length + ' 15m bars' + (setup2 ? ' — setup ' + setup2.dir.toUpperCase() + ' grade ' + setup2.grade : ' — no qualifying confluence'));
    } else if (dx.item){
      legs.push('DELTA XAUTUSD: listed but candles unavailable');
    } else {
      var xu = gfn('xuUniverse');
      legs.push(xu ? 'DELTA XAUTUSD: not listed in the cross-venue universe' : 'DELTA XAUTUSD: xuniverse layer not loaded');
    }

    /* grade A first, then B, then C */
    var order = { A: 0, B: 1, C: 2 };
    results.sort(function(x, y){ return (order[x.setup.grade] || 9) - (order[y.setup.grade] || 9); });

    if (ui && ui.cards && ui.empty){
      if (!results.length) ui.empty.style.display = 'block';
      else ui.cards.innerHTML = results.map(cardHTML).join('');
    }
    var secs = ((Date.now() - t0)/1000).toFixed(1);
    setStat(ui, legs.join(' · ') + ' · ' + secs + 's · ' + new Date().toISOString().slice(11, 19) + ' UTC',
            !gold.rows15m.length && !dx.rows15m.length);
    setProg(ui, null);
    if (gold.rows15m.length || dx.rows15m.length) publishState(results);  /* only a real data run overwrites the snapshot */
    return 'refreshed';
  }catch(e){
    setStat(ui, 'scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    __scan.busy = false;
    __scan.hasRun = true;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
    setProg(ui, null);
  }
}

/* ---------------- mount / refresh / warm-up ---------------- */
function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<div class="panel">'
      + '<h2>GOLD SCALP <span>SMC/ICT confluence engine · 15m execution · 1H/4H context</span></h2>'
      + '<div class="row"><button class="btn" id="gsRun">RUN SCAN</button>'
      + '<span class="note" id="gsStat">idle — scans spot-tracking gold perps on 15m/1h/4h for ≥3 independent agreeing reads.</span></div>'
      + '<div class="note" style="margin-top:8px">Desk note: gold respects levels. The engine reads <b>FVGs</b> (15m/1H), '
      + '<b>order blocks &amp; breakers</b>, <b>liquidity sweeps</b>, <b>ICT killzones</b> (London/NY overlap weights highest), '
      + '<b>session VWAP</b>, <b>EMA 20/50/200 ribbon</b> (below the 200 → sell-only), <b>Ichimoku cloud</b>, <b>MFI</b> '
      + '(pink bar = manipulation watch), <b>BB-in-KC squeeze</b>, the <b>Asian-range breakout</b> (00:00–07:00 GMT box), '
      + '<b>RSI 75/25 + divergence</b>, <b>CCI ±100</b> and <b>StochRSI</b> (pullback timing only). '
      + 'A setup needs ≥3 independent agreeing reads; grade = read count + killzone weight, downgraded one letter inside a '
      + 'high-impact <b>NEWS WINDOW</b> (±30 min) — flagged, never hidden. Stops are 1.5–2× ATR14(15m), never tighter; '
      + 'targets 1.5R / 2.5R snapped to opposing swept structure.</div>'
      + '<div class="prog" id="gsProg"><i></i></div>'
      + '</div>'
      + '<div class="cards" id="gsCards"></div>'
      + '<div class="empty" id="gsEmpty" style="display:none">no A-grade confluence right now — gold respects levels; wait for the sweep.</div>';

    var ui = {
      btn:   el.querySelector('#gsRun'),
      stat:  el.querySelector('#gsStat'),
      prog:  el.querySelector('#gsProg'),
      cards: el.querySelector('#gsCards'),
      empty: el.querySelector('#gsEmpty')
    };
    __scan.ui = ui;

    var missing = [];
    if (!gfn('goldScalpSetup')) missing.push('goldScalpSetup(goldind.js)');
    if (!gfn('getGoldCandles') && !gfn('binanceKlines')) missing.push('gold klines (macro.js getGoldCandles / binance.js binanceKlines)');
    if (missing.length) setStat(ui, 'missing: ' + missing.join(', ') + ' — check script load order.', true);

    if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(ui); });
  }catch(e){ /* never throw at mount */ }
}

async function goldscalpRefresh(){
  try{
    if (__scan.busy) return 'busy';
    if (!__scan.hasRun || !__scan.ui) return 'skipped: not run yet';
    return await runScan(__scan.ui);
  }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
}

/* BRAIN warm-up hook — headless scan against inert stub elements (oiflow.js
   oiflowWarm pattern). Shares __scan.busy with the mounted scan. Never throws. */
function __gsWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}
async function gsWarm(){
  try{
    if (W.goldscalpState && W.goldscalpState()) return 'fresh';
  }catch(e0){}
  if (__scan.busy) return 'busy';
  if (!gfn('goldScalpSetup')) return 'unavailable: goldind.js not loaded';
  if (!gfn('getGoldCandles') && !gfn('binanceKlines')) return 'unavailable: gold klines layer not loaded';
  var stubUi = { btn: __gsWarmShim(), stat: __gsWarmShim(), prog: __gsWarmShim(),
                 cards: __gsWarmShim(), empty: __gsWarmShim() };
  await runScan(stubUi);
  return (W.goldscalpState && W.goldscalpState()) ? 'warmed'
       : 'unavailable: scan did not complete (no gold klines from any source)';
}

/* ---------------- registration ---------------- */
W.goldscalpState = function(){
  try{ return __snap ? __stateView(__snap) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldscalp', label: 'GOLD SCALP', mount: mount, refresh: goldscalpRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldscalp', label: 'GOLD SCALP', run: gsWarm });
})();
