/* =========================================================================
HARDGATE — rotation.js
ROTATION tab: altseason index + dominance trend + retail-attention radar,
built entirely on CoinGecko's free CORS-open API (no key):
  1) ALTSEASON INDEX   /coins/markets (top-50 by mcap, 30d change) —
                       % of top-50 alts (BTC excluded) whose 30d return
                       beats BTC's 30d return. Zones: >=75% ALT SEASON
                       (favor alt setups), <=25% BTC SEASON (favor BTC),
                       between = rotation, mixed.
  2) DOMINANCE         /global — BTC + ETH dominance, total mcap 24h change.
                       A daily BTC/ETH dominance snapshot is persisted in
                       localStorage (key hg_dom_history, 90 points max, one
                       point per UTC day, deduped by day) and rendered as a
                       sparkline so rotation DIRECTION is visible, not just
                       a point reading.
  3) TRENDING          /search/trending — top-7 trending coins merged with
                       the top-50 markets call for their 30d change.
                       Retail attention tag per coin: FUEL (< +20% 30d —
                       attention can still push it), EXIT LIQUIDITY
                       (>= +20% 30d — already ran; late retail is someone's
                       exit), DISTRESS (<= -20% — trending because it is
                       dumping), UNRANKED (outside top-50 — thin cap).

Classic script, loaded after index.html's inline bundle. Never throws at
load or run time: every global is feature-checked, every fetch carries an
AbortController timeout, Promise.allSettled legs degrade independently, and
results are cached 5 minutes so re-polls do not hammer the free API.

Exports (and ONLY these): window.rotationSignal (pure altseason classifier),
window.rotationDomSnapshot (pure daily-dedupe history push),
window.rotationTrendTag (pure attention tag), window.rotationMergeTrending
(pure trending/markets merge), window.rotationLeaders (pure rank helper),
plus the window.HG_tabs registration below (with the house refresh contract:
async, never throws, skips before first run, busy-guarded, status string).

BRAIN STATE CONTRACT — after each SUCCESSFUL run (fresh fetch with any data,
or a live cache hit) the last window.rotationSignal result is cached in a
module-local snapshot and exposed as window.rotationState() for the BRAIN
meta-engine. Zero-arg, NEVER throws (try-catch -> null), returns null before
the first successful run, otherwise a DEEP-FROZEN deep copy:
  { season, altPct, evidence: [strings], at: <epochMs> }
(i.e. the rotationSignal result PLUS `at`). A failed re-run (every CoinGecko
leg down) keeps the PREVIOUS good snapshot with its original `at` — good
data is never replaced by a failed run.
========================================================================= */
(function(){
'use strict';

var CG_BASE   = 'https://api.coingecko.com/api/v3';
var CACHE_MS  = 5*60*1000;
var FETCH_TO  = 12000;
var DOM_KEY   = 'hg_dom_history';
var DOM_MAX   = 90;
/* zone thresholds (percent of top-50 alts beating BTC over 30d) */
var ALT_SEASON_MIN = 75, BTC_SEASON_MAX = 25;
/* trending attention thresholds (30d change, percent) */
var TREND_PUMP = 20, TREND_DUMP = -20;

/* ============================ tiny helpers ============================ */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function num(v){
  if (v === null || v === undefined || v === '') return null;
  var n = +v;
  return (isFinite(n) ? n : null);
}
function fnum(n, dp){
  dp = (dp === undefined) ? 2 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (+n).toFixed(dp);
}
function signed(n, dp){
  dp = (dp === undefined) ? 1 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : ((+n >= 0 ? '+' : '') + (+n).toFixed(dp));
}
function kv(k, vHtml){
  return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + vHtml + '</span></div>';
}
function lrow(gid, name, detail, stampCls, stampTxt){
  return '<div class="lrow"><span class="gid">' + esc(gid) + '</span><span class="gname">' + esc(name) + '</span>'
       + '<span class="gdetail">' + esc(detail) + '</span><span class="stamp ' + stampCls + '">' + esc(stampTxt) + '</span></div>';
}
function setNote(ui, msg, warn){
  if (!ui || !ui.note) return;
  ui.note.textContent = msg;
  ui.note.className = warn ? 'note warn' : 'note';
}
function lsGet(key){
  try{ if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(key); }catch(e){}
  return null;
}
function lsSet(key, val){
  try{ if (typeof localStorage !== 'undefined' && localStorage){ localStorage.setItem(key, val); return true; } }catch(e){}
  return false;
}

/* fetch JSON with timeout; null on any failure (never throws) */
async function fetchJson(url, timeoutMs){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || FETCH_TO);
  try{
    var res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    if (!res || !res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

/* ============================ pure logic (exported) ============================ */

/* ALTSEASON classifier. data = { markets:[], global:null|{} } (both optional).
   Index = % of top-50 alts (BTC excluded by symbol OR id) whose 30d change
   beats BTC's 30d change. Alts with a missing 30d change are excluded from
   the denominator and reported honestly. BTC missing/unusable -> altPct null.
   -> {season:'alt'|'btc'|'mixed', altPct:number|null, evidence:string[]}.
   Never throws. */
function rotationSignal(data){
  try{
    data = data || {};
    var mk = Array.isArray(data.markets) ? data.markets : [];
    var evidence = [];
    if (!mk.length){
      return { season: 'mixed', altPct: null,
               evidence: ['top-50 market list unavailable — altseason index cannot be computed'] };
    }
    var btcChg = null, btcSeen = false, alts = [];
    for (var i = 0; i < mk.length; i++){
      var c = mk[i]; if (!c) continue;
      var sym = String(c.symbol || '').toUpperCase();
      var id  = String(c.id || '').toLowerCase();
      var chg = num(c.price_change_percentage_30d_in_currency);
      if (sym === 'BTC' || id === 'bitcoin'){ btcSeen = true; if (chg !== null) btcChg = chg; continue; }
      alts.push({ symbol: sym || id.toUpperCase() || '?', chg: chg });
    }
    if (!alts.length){
      return { season: 'mixed', altPct: null,
               evidence: ['market list contains no alts — altseason index cannot be computed'] };
    }
    if (!btcSeen || btcChg === null){
      return { season: 'mixed', altPct: null,
               evidence: [(btcSeen ? 'BTC 30d change unavailable' : 'BTC missing from the top-50 list')
                          + ' — benchmark unknown, altseason index cannot be computed'] };
    }
    var usable = [], skipped = 0;
    for (var j = 0; j < alts.length; j++){
      if (alts[j].chg === null) skipped++; else usable.push(alts[j]);
    }
    if (!usable.length){
      return { season: 'mixed', altPct: null,
               evidence: ['no alt 30d changes available — altseason index cannot be computed'] };
    }
    var beats = 0;
    for (var k = 0; k < usable.length; k++){ if (usable[k].chg > btcChg) beats++; }
    var altPct = Math.round(beats / usable.length * 1000) / 10;
    var season = (altPct >= ALT_SEASON_MIN) ? 'alt' : ((altPct <= BTC_SEASON_MAX) ? 'btc' : 'mixed');
    evidence.push(beats + '/' + usable.length + ' top-50 alts beat BTC 30d (' + signed(btcChg, 1)
                  + '%) — index ' + fnum(altPct, 1) + '%');
    if (skipped) evidence.push(skipped + ' alt' + (skipped > 1 ? 's' : '')
                               + ' lacked a 30d change — excluded from the index');
    evidence.push(season === 'alt'
      ? 'zone >= ' + ALT_SEASON_MIN + '% — ALT SEASON: favor alt setups over BTC'
      : (season === 'btc'
         ? 'zone <= ' + BTC_SEASON_MAX + '% — BTC SEASON: favor BTC over alts'
         : 'between ' + BTC_SEASON_MAX + '%/' + ALT_SEASON_MIN + '% — ROTATION: mixed, no breadth edge'));
    var g = data.global;
    if (g && isFinite(+g.btcDom)){
      evidence.push('BTC dominance ' + fnum(+g.btcDom, 1) + '%'
        + (isFinite(+g.ethDom) ? ' · ETH ' + fnum(+g.ethDom, 1) + '%' : '')
        + (isFinite(+g.mcapChg24) ? ' · total mcap 24h ' + signed(+g.mcapChg24, 1) + '%' : ''));
    }
    return { season: season, altPct: altPct, evidence: evidence };
  }catch(e){
    return { season: 'mixed', altPct: null,
             evidence: ['signal error: ' + ((e && e.message) ? e.message : String(e))] };
  }
}

/* Daily dominance history push, PURE. hist: [{d:'YYYY-MM-DD', btc, eth}] (any
   order, tolerates junk entries). Adds/replaces the point for `day` (one
   point per UTC day — same-day rewrites replace, never duplicate), sorts
   ascending by day, caps at maxN (default 90) keeping the NEWEST points.
   Returns a fresh array; never throws. */
function rotationDomSnapshot(hist, day, btcDom, ethDom, maxN){
  try{
    maxN = Math.max(1, maxN || DOM_MAX);
    var byDay = {};
    if (Array.isArray(hist)){
      for (var i = 0; i < hist.length; i++){
        var h = hist[i];
        if (!h || typeof h.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(h.d)) continue;
        var b = num(h.btc); if (b === null) continue;
        byDay[h.d] = { d: h.d, btc: b, eth: num(h.eth) };
      }
    }
    if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)){
      var nb = num(btcDom);
      if (nb !== null) byDay[day] = { d: day, btc: nb, eth: num(ethDom) }; // replace = dedupe
    }
    var days = Object.keys(byDay).sort();
    if (days.length > maxN) days = days.slice(days.length - maxN);
    var out = [];
    for (var k = 0; k < days.length; k++) out.push(byDay[days[k]]);
    return out;
  }catch(e){ return []; }
}

/* Retail-attention tag for a trending coin, PURE. */
function rotationTrendTag(chg30){
  var c = num(chg30);
  if (c === null) return 'UNRANKED';
  if (c >= TREND_PUMP) return 'EXIT LIQUIDITY';
  if (c <= TREND_DUMP) return 'DISTRESS';
  return 'FUEL';
}

/* Merge /search/trending items (top-7) with the markets call for 30d change,
   PURE. Accepts either the raw {item:{...}} wrappers or bare coin objects.
   Match by symbol first, then id. -> [{rank, name, symbol, chg30, tag}]. */
function rotationMergeTrending(items, markets){
  var out = [];
  try{
    items = Array.isArray(items) ? items : [];
    markets = Array.isArray(markets) ? markets : [];
    var bySym = {}, byId = {};
    for (var i = 0; i < markets.length; i++){
      var c = markets[i]; if (!c) continue;
      if (c.symbol) bySym[String(c.symbol).toUpperCase()] = c;
      if (c.id) byId[String(c.id).toLowerCase()] = c;
    }
    var n = Math.min(7, items.length);
    for (var k = 0; k < n; k++){
      var it = items[k];
      var item = (it && it.item) ? it.item : (it || {});
      var sym = String(item.symbol || '').toUpperCase();
      var id  = String(item.id || '').toLowerCase();
      var m = bySym[sym] || byId[id] || null;
      var chg = m ? num(m.price_change_percentage_30d_in_currency) : null;
      out.push({
        rank: k + 1,
        name: item.name || sym || 'unknown',
        symbol: sym || id.toUpperCase() || '?',
        chg30: chg,
        tag: rotationTrendTag(chg)
      });
    }
  }catch(e){}
  return out;
}

/* Top-N leaders/laggards of the markets list by 30d change, PURE.
   -> {leaders:[{symbol,chg}], laggards:[{symbol,chg}]} (leaders desc, laggards asc). */
function rotationLeaders(markets, n){
  var res = { leaders: [], laggards: [] };
  try{
    n = Math.max(1, n || 5);
    var rows = [];
    var mk = Array.isArray(markets) ? markets : [];
    for (var i = 0; i < mk.length; i++){
      var c = mk[i]; if (!c) continue;
      var chg = num(c.price_change_percentage_30d_in_currency);
      if (chg === null) continue;
      rows.push({ symbol: String(c.symbol || c.id || '?').toUpperCase(), chg: chg });
    }
    rows.sort(function(a, b){ return b.chg - a.chg; });
    res.leaders = rows.slice(0, n);
    res.laggards = rows.slice(Math.max(0, rows.length - n)).reverse(); // worst first
  }catch(e){}
  return res;
}

/* ============================ data legs ============================ */
async function fetchCgMarkets(){
  var url = CG_BASE + '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1'
          + '&price_change_percentage=30d&sparkline=false';
  var j = await fetchJson(url);
  return (Array.isArray(j) && j.length) ? j : null;
}
async function fetchCgGlobal(){
  var j = await fetchJson(CG_BASE + '/global');
  var d = j && j.data;
  if (!d) return null;
  var pct = d.market_cap_percentage || {};
  var btc = num(pct.btc), eth = num(pct.eth), chg = num(d.market_cap_change_percentage_24h_usd);
  if (btc === null && eth === null && chg === null) return null;
  return { btcDom: btc, ethDom: eth, mcapChg24: chg };
}
async function fetchCgTrending(){
  var j = await fetchJson(CG_BASE + '/search/trending');
  var coins = j && Array.isArray(j.coins) ? j.coins : null;
  return (coins && coins.length) ? coins : null;
}

/* ============================ dominance history io ============================ */
function loadDomHist(){
  try{
    var raw = lsGet(DOM_KEY);
    if (!raw) return [];
    var j = JSON.parse(raw);
    return rotationDomSnapshot(Array.isArray(j) ? j : [], null, null, null, DOM_MAX);
  }catch(e){ return []; }
}
function saveDomHist(hist){
  try{ return lsSet(DOM_KEY, JSON.stringify(hist)); }catch(e){ return false; }
}

/* ============================ renderers ============================ */
function seasonWord(sig){
  return sig.season === 'alt' ? 'ALT SEASON' : (sig.season === 'btc' ? 'BTC SEASON' : 'ROTATION / MIXED');
}
function renderGaugePanel(sig){
  var h = '<div class="panel"><h2>ALTSEASON INDEX <span>% of top-50 alts beating BTC over 30d · CoinGecko</span></h2>';
  if (sig.altPct === null){
    return h + '<div class="note warn">' + esc(sig.evidence.join(' ')) + '</div></div>';
  }
  var cls = sig.season === 'alt' ? 'long' : (sig.season === 'btc' ? 'short' : 'aside');
  h += '<div class="row"><span class="big">' + fnum(sig.altPct, 1) + '%</span>'
     + '<span class="statuschip">season <b>' + esc(seasonWord(sig)) + '</b></span></div>';
  h += '<div style="position:relative;height:14px;border-radius:4px;overflow:hidden;background:var(--panel2);border:1px solid var(--line);margin-top:10px">'
     + '<div style="position:absolute;left:0;top:0;bottom:0;width:' + BTC_SEASON_MAX + '%;background:rgba(228,88,107,.13);border-right:1px dashed var(--dim)"></div>'
     + '<div style="position:absolute;left:' + ALT_SEASON_MIN + '%;top:0;bottom:0;width:' + (100 - ALT_SEASON_MIN) + '%;background:rgba(53,192,142,.13);border-left:1px dashed var(--dim)"></div>'
     + '<div style="position:absolute;top:-2px;bottom:-2px;width:3px;margin-left:-1px;background:var(--gold);left:'
       + Math.max(0, Math.min(100, sig.altPct)) + '%"></div>'
     + '</div>'
     + '<div class="row" style="justify-content:space-between;margin-top:4px">'
     + '<span class="note">&le;25% BTC SEASON</span><span class="note">25–75% ROTATION</span><span class="note">&ge;75% ALT SEASON</span>'
     + '</div>';
  h += '<div class="verdict ' + cls + '"><span class="vword" style="font-size:16px">' + esc(seasonWord(sig)) + '</span>'
     + '<span class="vwhy">' + esc(sig.evidence.join(' ')) + '</span></div>';
  return h + '</div>';
}

function renderLeadersPanel(markets){
  var r = rotationLeaders(markets, 5);
  var h = '<div class="panel"><h2>TOP-50 LEADERS / LAGGARDS <span>30d change · breadth behind the index</span></h2>';
  if (!r.leaders.length) return h + '<div class="note warn">30d changes unavailable — leaders/laggards cannot be ranked.</div></div>';
  var rows = [];
  for (var i = 0; i < r.leaders.length; i++){
    var L = r.leaders[i];
    rows.push(lrow('W' + (i + 1), L.symbol, '30d ' + signed(L.chg, 1) + '%', L.chg >= 0 ? 'pass' : 'veto', L.chg >= 0 ? 'UP' : 'DOWN'));
  }
  for (var k = 0; k < r.laggards.length; k++){
    var G = r.laggards[k];
    rows.push(lrow('L' + (k + 1), G.symbol, '30d ' + signed(G.chg, 1) + '%', G.chg < 0 ? 'veto' : 'pass', G.chg < 0 ? 'LAG' : 'UP'));
  }
  return h + '<div class="ledger">' + rows.join('') + '</div></div>';
}

function sparklineSvg(hist){
  var pts = [];
  for (var i = 0; i < hist.length; i++){ if (isFinite(hist[i].btc)) pts.push(hist[i].btc); }
  if (pts.length < 2) return '';
  var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  var span = (max - min) || 1;
  var W = 300, H = 56, pad = 4;
  var step = (W - 2 * pad) / (pts.length - 1);
  var d = '';
  for (var k = 0; k < pts.length; k++){
    var x = pad + k * step;
    var y = H - pad - ((pts[k] - min) / span) * (H - 2 * pad);
    d += (k ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  var lastX = pad + (pts.length - 1) * step;
  var lastY = H - pad - ((pts[pts.length - 1] - min) / span) * (H - 2 * pad);
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:56px;display:block;margin-top:8px">'
       + '<path d="' + d + '" fill="none" style="stroke:var(--gold);stroke-width:1.5"/>'
       + '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="2.5" style="fill:var(--gold)"/>'
       + '</svg>';
}

function renderDomPanel(g, hist){
  var h = '<div class="panel"><h2>DOMINANCE <span>BTC/ETH market-cap share · daily snapshot trend (90d max)</span></h2>';
  if (!g){
    h += '<div class="note warn">/global unavailable — dominance unknown'
       + (hist.length ? '; showing the persisted local history below.' : ' and no local history yet.') + '</div>';
  } else {
    var chgCls = isFinite(g.mcapChg24) ? (g.mcapChg24 >= 0 ? 'pos' : 'neg') : '';
    h += kv('BTC dominance', '<b>' + fnum(g.btcDom, 1) + '%</b>')
       + kv('ETH dominance', fnum(g.ethDom, 1) + '%')
       + kv('total mcap 24h', '<span class="' + chgCls + '">' + signed(g.mcapChg24, 2) + '%</span>');
  }
  if (hist.length >= 2){
    var first = hist[0], lastP = hist[hist.length - 1];
    var dBtc = lastP.btc - first.btc;
    var dir = dBtc > 0.15 ? 'rotating INTO BTC (defensive posture building)'
            : (dBtc < -0.15 ? 'rotating OUT of BTC into alts (risk appetite building)' : 'flat — no decisive rotation');
    var dirCls = dBtc > 0.15 ? 'neg' : (dBtc < -0.15 ? 'pos' : '');
    h += sparklineSvg(hist)
       + '<div class="note" style="margin-top:4px">BTC.D ' + fnum(first.btc, 1) + '% → ' + fnum(lastP.btc, 1) + '% ('
       + esc(first.d) + ' → ' + esc(lastP.d) + ', ' + hist.length + ' daily points): <span class="' + dirCls + '">'
       + signed(dBtc, 2) + 'pp — ' + esc(dir) + '</span></div>';
  } else {
    h += '<div class="note" style="margin-top:6px">dominance trend needs ≥2 daily snapshots (' + hist.length
       + ' so far) — one point is stored per UTC day as the tab runs.</div>';
  }
  return h + '</div>';
}

function renderTrendingPanel(merged){
  var h = '<div class="panel"><h2>RETAIL ATTENTION <span>CoinGecko top-7 trending · fuel or exit liquidity?</span></h2>';
  if (!merged || !merged.length) return h + '<div class="note warn">/search/trending unavailable — attention radar offline.</div></div>';
  var rows = [];
  for (var i = 0; i < merged.length; i++){
    var t = merged[i];
    var detail = (t.chg30 === null) ? 'not in top-50 — thin cap, handle with care' : '30d ' + signed(t.chg30, 1) + '%';
    var cls = t.tag === 'FUEL' ? 'pass' : (t.tag === 'UNRANKED' ? 'na' : 'veto');
    rows.push(lrow('T' + t.rank, t.name + ' (' + t.symbol + ')', detail, cls, t.tag));
  }
  return h + '<div class="ledger">' + rows.join('') + '</div>'
       + '<div class="note" style="margin-top:6px">FUEL = trending with &lt; +20% 30d (attention can still push it) · '
       + 'EXIT LIQUIDITY = already ≥ +20% 30d (late retail is someone&rsquo;s exit) · DISTRESS = ≤ -20% (trending because it is dumping) · UNRANKED = outside top-50.</div></div>';
}

/* ============================ scan orchestrator ============================ */
var __rot = { cache: null, busy: false, ranOnce: false, ui: null, stateSnap: null };

/* BRAIN state snapshot (window.rotationState): the last rotationSignal
   result + `at`, cached only on SUCCESSFUL runs — a failed re-run keeps the
   previous good snapshot with its original `at`. The getter hands out
   DEEP-FROZEN deep copies and never throws. */
function setRotSnapshot(sig){
  try{
    if (!sig || typeof sig !== 'object') return;
    __rot.stateSnap = {
      season: sig.season,
      altPct: (typeof sig.altPct === 'number' && isFinite(sig.altPct)) ? sig.altPct : null,
      evidence: Array.isArray(sig.evidence) ? sig.evidence.slice() : [],
      at: Date.now()
    };
  }catch(e){ /* snapshotting must never break the scan */ }
}
function rotStateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = rotStateView(v[k]);
  }
  Object.freeze(out);
  return out;
}

async function runRotation(ui, opts){
  if (__rot.busy) return 'busy';
  __rot.busy = true;
  var status = 'refreshed';
  try{
    opts = opts || {};
    ui = ui || __rot.ui;
    var force = opts.force === true;
    var data = null;
    if (!force && __rot.cache && (Date.now() - __rot.cache.at) < CACHE_MS){
      data = __rot.cache.val;
    } else {
      setNote(ui, 'fetching CoinGecko: top-50 markets · global dominance · trending…');
      var legs = await Promise.allSettled([fetchCgMarkets(), fetchCgGlobal(), fetchCgTrending()]);
      data = {
        markets:  (legs[0].status === 'fulfilled') ? legs[0].value : null,
        global:   (legs[1].status === 'fulfilled') ? legs[1].value : null,
        trending: (legs[2].status === 'fulfilled') ? legs[2].value : null
      };
      var anyData = (Array.isArray(data.markets) && data.markets.length)
                 || !!data.global
                 || (Array.isArray(data.trending) && data.trending.length);
      if (anyData) __rot.cache = { at: Date.now(), val: data };
      else status = 'failed: every CoinGecko leg unavailable';
    }
    __rot.ranOnce = true;

    /* persist one dominance snapshot per UTC day (dedupe by day, cap 90) */
    var hist = loadDomHist();
    if (data.global && isFinite(data.global.btcDom)){
      try{
        var day = new Date().toISOString().slice(0, 10);
        hist = rotationDomSnapshot(hist, day, data.global.btcDom, data.global.ethDom, DOM_MAX);
        saveDomHist(hist);
      }catch(e){}
    }
    data.domHist = hist;

    if (ui && ui.out){
      if (!data.markets && !data.global && !data.trending && !hist.length){
        ui.out.innerHTML = '<div class="empty">No rotation data available — CoinGecko is unreachable (markets, global and trending all failed) and no local dominance history exists yet. Check network, then re-run.</div>';
        setNote(ui, 'all sources unavailable — showing empty state.', true);
      } else {
        var sig = rotationSignal(data);
        if (status === 'refreshed') setRotSnapshot(sig); /* BRAIN: only a successful run overwrites the snapshot */
        var degraded = [];
        if (!data.markets) degraded.push('markets');
        if (!data.global) degraded.push('global');
        if (!data.trending) degraded.push('trending');
        ui.out.innerHTML = renderGaugePanel(sig)
                         + renderDomPanel(data.global, hist)
                         + renderLeadersPanel(data.markets || [])
                         + renderTrendingPanel(data.trending ? rotationMergeTrending(data.trending, data.markets || []) : []);
        setNote(ui, 'done · ' + new Date().toISOString().slice(11, 19) + ' UTC'
          + (degraded.length ? ' — degraded: ' + degraded.join(', ') + ' unavailable' : ''), degraded.length > 0);
      }
    }
  }catch(e){
    status = 'error: ' + ((e && e.message) ? e.message : String(e));
    try{ setNote(ui, 'unexpected error: ' + ((e && e.message) ? e.message : String(e)), true); }catch(_){}
  }finally{
    __rot.busy = false;
  }
  return status;
}

/* ============================ tab registration ============================ */
function mount(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">'
    + '<h2>ROTATION <span>altseason index · dominance trend · retail attention</span></h2>'
    + '<div class="row">'
    + '<button class="btn" data-rot="run">RUN ROTATION</button>'
    + '<span class="chip on" data-rot="srcchip">SRC: COINGECKO</span>'
    + '</div>'
    + '<div class="note" data-rot="note">idle — pulls CoinGecko top-50 markets (30d), global dominance and the trending list. '
    + 'Free CORS-open API, no key; results cached 5 min; one dominance snapshot stored per UTC day.</div>'
    + '<div data-rot="out"></div>'
    + '</div>';

  var ui = {
    btn:  el.querySelector('[data-rot="run"]'),
    note: el.querySelector('[data-rot="note"]'),
    out:  el.querySelector('[data-rot="out"]')
  };
  __rot.ui = ui;
  if (typeof fetch !== 'function') setNote(ui, 'fetch unavailable in this environment — all legs will fail gracefully.', true);
  if (ui.btn) ui.btn.addEventListener('click', function(){ return runRotation(ui); });
}

/* House refresh contract: async, NEVER throws, terse status string, busy
   guard, and — critically — it must NOT trigger a first-time scan from a
   global refresh: before the first user run it skips instead. */
async function refreshRotation(){
  try{
    if (__rot.busy) return 'busy';
    if (!__rot.ranOnce) return 'skipped: not run yet';
    return await runRotation(__rot.ui, { force: true }); // hard refresh bypasses the 5-min cache
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

/* BRAIN warm-up hook: run the CoinGecko scan headless (ui = null falls back
   to __rot.ui, and every ui touch is null-gated) so the BRAIN can warm this
   layer without mounting the tab. Never throws. */
async function rotationWarm(){
  try{
    if (window.rotationState && window.rotationState()) return 'fresh';
    var r = await runRotation(null, { force: true });
    if (r === 'busy') return 'busy';
    if (window.rotationState && window.rotationState()) return 'warmed';
    return (typeof r === 'string' && r.indexOf('failed') === 0) ? r : 'warmed — partial data';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

if (typeof window !== 'undefined'){
  window.rotationSignal = rotationSignal;
  window.rotationDomSnapshot = rotationDomSnapshot;
  window.rotationTrendTag = rotationTrendTag;
  window.rotationMergeTrending = rotationMergeTrending;
  window.rotationLeaders = rotationLeaders;
  window.rotationState = function(){
    try{ return __rot.stateSnap ? rotStateView(__rot.stateSnap) : null; }catch(e){ return null; }
  };
  window.HG_tabs = window.HG_tabs || [];
  window.HG_tabs.push({ id: 'rotation', label: 'ROTATION', mount: mount, refresh: refreshRotation });
  window.HG_warmups = window.HG_warmups || [];
  window.HG_warmups.push({ id: 'rotation', label: 'ROTATION', run: rotationWarm });
}
})();
