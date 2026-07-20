/* =========================================================================
HARDGATE — regime.js
Market-wide RISK-ON / RISK-OFF regime dashboard (tab id 'regime').

Eight gauges, rendered as a ledger with BULL/BEAR/N-A stamps:
  R1 BTC 1d trend       close vs EMA200 (+ EMA50/200 golden|death cross)  ±1
  R2 ETH/BTC 1d ratio   EMA20 slope over 5 bars (alt-strength proxy)      ±1
  R3 BTC dominance      <50% alt-favorable · >55% risk-off · else 0       ±1/0
  R4 Fear & Greed       >60 greed +1 · <25 fear -1 · 25-60 neutral        ±1/0
  R5 DXY                20d trend FALLING +1 · RISING -1                  ±1/0
  R6 US 10Y yield       20d trend FALLING +1 · RISING -1                  ±1/0
  R7 GOLD (XAU PERP)    close vs EMA200 — HEDGE DEMAND, informational only
  R8 STABLECOIN FLOWS   DeFiLlama total mcap, 7d delta vs ±0.5% band      ±1/0

Score >= +3 RISK-ON · <= -3 RISK-OFF · else MIXED — SELECTIVE.
Thresholds stay ±3 with 7 scored components: ±3/7 ≈ 43% agreement — a
clear plurality of gauges, same bar as before (±3/6 = 50%, N/A holes
already score 0). Jumping to ±4 (57%) would make regime calls too rare
on a dashboard whose sources fail often. N/A gauges score 0 — an honest
dashboard shows holes.

Classic script, no build step. Loads after indicators.js / indicators2.js /
binance.js / macro.js. Exposes ONLY window.regimeVerdict and
window.regimePlaybook (both pure, testable) plus the window.HG_tabs
registration (id/label/mount/refresh — refresh re-runs the gauge scan,
busy-guarded, skipping honestly when the tab was never opened). Never
throws at load time; every
external global is feature-checked before use; every fetch has a 10-15s
AbortController timeout and resolves null on failure.

PLAYBOOK: regimePlaybook(verdict) turns the detected regime into action —
directional bias (LONG-ONLY / SHORT-ONLY / BOTH / STAND-ASIDE), preferred
setup types (trend-follow vs mean-revert vs carry, conditioned on the R4/R8
gauge rows), position-size guidance (full / half / quarter from |score|),
and one explicit INVALIDATION line. Rendered as a card under the verdict.

BRAIN STATE CONTRACT — after each SUCCESSFUL gauge scan the verdict is
cached in a module-local snapshot and exposed as window.regimeState() for
the BRAIN meta-engine. Zero-arg, NEVER throws (try-catch -> null), returns
null before the first successful scan, otherwise a DEEP-FROZEN deep copy:
  { label: <regime word string>, score: <number>,
    playbook: <window.regimePlaybook output object | null>, at: <epochMs> }
An aborted/failed re-run keeps the PREVIOUS good snapshot with its original
`at` — good data is never replaced by a failed run.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window :
        (typeof globalThis !== 'undefined') ? globalThis : this;

/* ---------------- local dependency-free helpers ---------------- */

function rgEsc(s){
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

/* Adaptive number format, self-contained (index.html's px/fmt/pct are NOT
   required here — the pure verdict function must stay test-deterministic). */
function rgNum(n, dp){
  n = +n;
  if (!isFinite(n)) return 'n/a';
  var a = Math.abs(n);
  var d = (dp !== undefined) ? dp : (a >= 1000 ? 1 : (a >= 100 ? 2 : (a >= 1 ? 3 : 5)));
  return n.toLocaleString('en-US', { maximumFractionDigits: d });
}

/* Strict numeric coercion: null/undefined/'' become NaN (unlike +null -> 0). */
function rgToNum(x){
  if (x === null || x === undefined || x === '') return NaN;
  return +x;
}

function rgSleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

/* Adaptive USD formatter for big money aggregates: $308.9B / $1.21T / $950M. */
function rgUsd(n){
  n = +n;
  if (!isFinite(n)) return 'n/a';
  function fixed(x, dp){ return x.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  var a = Math.abs(n);
  if (a >= 1e12) return '$' + fixed(n / 1e12, 2) + 'T';
  if (a >= 1e9)  return '$' + fixed(n / 1e9, 1) + 'B';
  if (a >= 1e6)  return '$' + fixed(n / 1e6, 1) + 'M';
  return '$' + fixed(n, 0);
}
function rgUsdSigned(n){ return (n >= 0 ? '+' : '-') + rgUsd(Math.abs(n)); }

/* ---------------- fetch plumbing (binance.js pattern) ---------------- */

var RG_CACHE_MS = 60*1000;
var __rgCache = new Map();
function rgCacheGet(key, ttl){
  var h = __rgCache.get(key);
  return (h && (Date.now() - h.at) < (ttl || RG_CACHE_MS)) ? h.val : undefined;
}
function rgCachePut(key, val){
  if (val !== null && val !== undefined) __rgCache.set(key, { at: Date.now(), val: val });
  return val;
}

var __rgBucket = (typeof makeTokenBucket === 'function') ? makeTokenBucket(2, 2) : null;

async function rgFetchJson(url, timeoutMs){
  try{
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 12000);
    try{
      if (__rgBucket){
        var w = __rgBucket.take();
        if (w > 0) await rgSleep(Math.min(w, 2000));
      }
      var res = await fetch(url, { signal: ctrl.signal });
      if (!res || !res.ok) return null;
      return await res.json();
    } finally { clearTimeout(timer); }
  }catch(e){ return null; }
}

/* ---------------- per-gauge async fetchers (null on any failure) -------- */

async function rgFetchBtc(){
  try{
    if (typeof binanceKlines !== 'function' || typeof ema !== 'function') return null;
    var key = 'rg|btc', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    var rows = await binanceKlines('BTCUSDT', '1d', 260);
    if (!rows || rows.length < 205) return null;
    var closes = rows.map(function(r){ return r.c; });
    var e200 = ema(closes, 200), e50 = ema(closes, 50), n = closes.length;
    var out = { close: +closes[n-1], ema50: +e50[n-1], ema200: +e200[n-1] };
    if (!isFinite(out.close) || !isFinite(out.ema50) || !isFinite(out.ema200)) return null;
    return rgCachePut(key, out);
  }catch(e){ return null; }
}

async function rgFetchEthBtc(){
  try{
    if (typeof ema !== 'function' || typeof fetch !== 'function') return null;
    var key = 'rg|ethbtc', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    var raw = await rgFetchJson('https://api.binance.com/api/v3/klines?symbol=ETHBTC&interval=1d&limit=120');
    if (!Array.isArray(raw)) return null;
    var closes = [];
    for (var i = 0; i < raw.length; i++){
      if (!raw[i]) continue;
      var c = +raw[i][4];
      if (isFinite(c)) closes.push(c);
    }
    if (closes.length < 26) return null;
    var e20 = ema(closes, 20), n = closes.length;
    var out = { ema20Now: +e20[n-1], ema20Prev: +e20[n-6], last: +closes[n-1] };
    if (!isFinite(out.ema20Now) || !isFinite(out.ema20Prev)) return null;
    return rgCachePut(key, out);
  }catch(e){ return null; }
}

async function rgFetchBtcDominance(){
  try{
    if (typeof fetch !== 'function') return null;
    var key = 'rg|btcd', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    var j = await rgFetchJson('https://api.coingecko.com/api/v3/global');
    var p = j && j.data && j.data.market_cap_percentage ? +j.data.market_cap_percentage.btc : NaN;
    if (!isFinite(p)) return null;
    return rgCachePut(key, { pct: p });
  }catch(e){ return null; }
}

async function rgFetchFng(){
  try{
    if (typeof fetch !== 'function') return null;
    var key = 'rg|fng', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    var j = await rgFetchJson('https://api.alternative.me/fng/?limit=2');
    var arr = j && j.data;
    if (!Array.isArray(arr) || !arr.length || !arr[0]) return null;
    var v = +arr[0].value;
    if (!isFinite(v)) return null;
    var prev = (arr.length > 1 && arr[1]) ? +arr[1].value : NaN;
    return rgCachePut(key, {
      value: v,
      classification: String(arr[0].value_classification || ''),
      change: isFinite(prev) ? v - prev : null
    });
  }catch(e){ return null; }
}

async function rgFetchDxy(){
  try{
    if (typeof getDXY !== 'function') return null;
    var key = 'rg|dxy', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    var d = await getDXY();
    if (!d || !isFinite(+d.value)) return null;
    return rgCachePut(key, {
      value: +d.value,
      trend20: d.trend20 || null,
      change20Pct: isFinite(+d.change20Pct) ? +d.change20Pct : null
    });
  }catch(e){ return null; }
}

async function rgFetchUs10y(){
  try{
    if (typeof getGoldMacro !== 'function') return null;
    var key = 'rg|tnx', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    var m = await getGoldMacro();
    if (!m) return null;
    var tnx = isFinite(+m.tnx) ? +m.tnx : null;
    var trend = m.tnxTrend || null;
    if (tnx === null && !trend) return null;
    return rgCachePut(key, { value: tnx, trend: trend });
  }catch(e){ return null; }
}

async function rgFetchGold(){
  try{
    if (typeof binanceKlines !== 'function' || typeof ema !== 'function') return null;
    var key = 'rg|gold', hit = rgCacheGet(key); if (hit !== undefined) return hit;
    /* XAUUSDT — Binance TradFi gold perp (deeper liquidity than PAXG spot) */
    var rows = await binanceKlines('XAUUSDT', '1d', 260);
    if (!rows || rows.length < 205) return null;
    var closes = rows.map(function(r){ return r.c; });
    var e200 = ema(closes, 200), n = closes.length;
    var out = { close: +closes[n-1], ema200: +e200[n-1] };
    if (!isFinite(out.close) || !isFinite(out.ema200)) return null;
    return rgCachePut(key, out);
  }catch(e){ return null; }
}

/* R8 — DeFiLlama stablecoin aggregate (dry-powder proxy).
   Payload: { peggedAssets: [ { circulating: { peggedUSD: n },
     circulatingPrevDay/Week/Month: { peggedUSD: n }, ... } ] } (~410 assets).
   Every level is parsed defensively: entries may be null, missing fields,
   or carry non-numeric values — malformed entries are skipped, never thrown. */
var RG_STABLE_URL = 'https://stablecoins.llama.fi/stablecoins?includePrices=true';
var RG_STABLE_CACHE_MS = 10*60*1000;

function rgPegUsd(obj){
  if (!obj || typeof obj !== 'object') return 0;
  var v = +obj.peggedUSD;
  if (isFinite(v)) return v;
  var s = 0;
  for (var k in obj){
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    var x = +obj[k];
    if (isFinite(x)) s += x;
  }
  return s;
}

async function rgFetchStablecoins(){
  try{
    if (typeof fetch !== 'function') return null;
    var key = 'rg|stable', hit = rgCacheGet(key, RG_STABLE_CACHE_MS); if (hit !== undefined) return hit;
    var j = await rgFetchJson(RG_STABLE_URL, 15000);
    var arr = j && (j.peggedAssets || j); /* tolerate wrapped and bare-array payloads */
    if (!Array.isArray(arr) || !arr.length) return null;
    var now = 0, wk = 0, mo = 0, n = 0;
    for (var i = 0; i < arr.length; i++){
      var a = arr[i];
      if (!a || typeof a !== 'object') continue;
      now += rgPegUsd(a.circulating);
      wk  += rgPegUsd(a.circulatingPrevWeek);
      mo  += rgPegUsd(a.circulatingPrevMonth);
      n++;
    }
    if (!n || !(now > 0)) return null;
    var out = { totalUSD: now, delta7dUSD: null, delta30dUSD: null };
    if (wk > 0) out.delta7dUSD = now - wk;   /* no valid week-ago baseline => null */
    if (mo > 0) out.delta30dUSD = now - mo;
    return rgCachePut(key, out);
  }catch(e){ return null; }
}

/* ---------------- PURE verdict / classifier ----------------
   components: { btc:{close,ema50,ema200}, ethbtc:{ema20Now,ema20Prev,last},
     btcd:{pct}, fng:{value,classification,change}, dxy:{value,trend20,change20Pct},
     us10y:{value,trend}, gold:{close,ema200},
     stable:{totalUSD,delta7dUSD,delta30dUSD} }  — every entry nullable.
   Returns { score, word, why, cls, rows, scoredTotal }. Never throws.     */
function regimeVerdict(components){
  components = components || {};
  var rows = [];

  function push(id, name, short, detail, stamp, score, scored){
    rows.push({
      id: id, name: name, short: short, detail: detail,
      stamp: stamp,
      stampClass: stamp === 'BULL' ? 'pass' : (stamp === 'BEAR' ? 'veto' : 'na'),
      score: score, scored: !!scored
    });
  }

  /* R1 — BTC trend vs 200EMA, with EMA50/200 cross context */
  (function(){
    var b = components.btc;
    if (!b){ push('R1','BTC TREND (1D)','BTC trend','data unavailable','NA',0,true); return; }
    var close = rgToNum(b.close), e200 = rgToNum(b.ema200), e50 = rgToNum(b.ema50);
    if (!isFinite(close) || !isFinite(e200) || !isFinite(e50)){
      push('R1','BTC TREND (1D)','BTC trend','data unavailable','NA',0,true); return;
    }
    var cross = e50 > e200 ? 'GOLDEN CROSS' : (e50 < e200 ? 'DEATH CROSS' : 'EMA50 AT 200EMA');
    var pxTxt = 'close ' + rgNum(close) + ' · ema200 ' + rgNum(e200);
    if (close > e200)      push('R1','BTC TREND (1D)','BTC trend up',  'BTC ABOVE 200EMA · ' + cross + ' · ' + pxTxt, 'BULL',  1, true);
    else if (close < e200) push('R1','BTC TREND (1D)','BTC trend down','BTC BELOW 200EMA · ' + cross + ' · ' + pxTxt, 'BEAR', -1, true);
    else                   push('R1','BTC TREND (1D)','BTC trend',     'BTC AT 200EMA · '    + cross + ' · ' + pxTxt, 'NA',    0, true);
  })();

  /* R2 — ETH/BTC EMA20 slope (5 bars), alt-strength proxy */
  (function(){
    var e = components.ethbtc;
    if (!e){ push('R2','ETH/BTC RATIO (1D)','ETH/BTC','data unavailable','NA',0,true); return; }
    var now = rgToNum(e.ema20Now), prev = rgToNum(e.ema20Prev);
    if (!isFinite(now) || !isFinite(prev)){
      push('R2','ETH/BTC RATIO (1D)','ETH/BTC','data unavailable','NA',0,true); return;
    }
    var pxTxt = 'ema20 ' + rgNum(now, 5) + ' vs ' + rgNum(prev, 5) + ' (5 bars)';
    if (now > prev)      push('R2','ETH/BTC RATIO (1D)','ETH/BTC rising', 'EMA20 RISING (5 BARS) · alts gaining on BTC · ' + pxTxt, 'BULL',  1, true);
    else if (now < prev) push('R2','ETH/BTC RATIO (1D)','ETH/BTC falling','EMA20 FALLING (5 BARS) · alts losing to BTC · ' + pxTxt, 'BEAR', -1, true);
    else                 push('R2','ETH/BTC RATIO (1D)','ETH/BTC',        'EMA20 FLAT (5 BARS) · no alt edge · ' + pxTxt, 'NA', 0, true);
  })();

  /* R3 — BTC dominance: <50% alt-favorable, >55% risk-off, between = 0 */
  (function(){
    var d = components.btcd;
    if (!d){ push('R3','BTC DOMINANCE','BTC.D','data unavailable','NA',0,true); return; }
    var p = rgToNum(d.pct);
    if (!isFinite(p)){ push('R3','BTC DOMINANCE','BTC.D','data unavailable','NA',0,true); return; }
    var txt = 'BTC.D ' + rgNum(p, 1) + '%';
    if (p < 50)      push('R3','BTC DOMINANCE','BTC.D alt-favorable', txt + ' · BELOW 50% — capital rotating toward alts', 'BULL',  1, true);
    else if (p > 55) push('R3','BTC DOMINANCE','BTC.D risk-off',      txt + ' · ABOVE 55% — risk-off for alts',          'BEAR', -1, true);
    else             push('R3','BTC DOMINANCE','BTC.D',               txt + ' · 50–55 mid-zone — no alt edge',           'NA',    0, true);
  })();

  /* R4 — Fear & Greed: >60 greed +1, <25 fear -1, 25-60 neutral */
  (function(){
    var f = components.fng;
    if (!f){ push('R4','FEAR & GREED','F&G','data unavailable','NA',0,true); return; }
    var v = rgToNum(f.value);
    if (!isFinite(v)){ push('R4','FEAR & GREED','F&G','data unavailable','NA',0,true); return; }
    var cls = f.classification ? String(f.classification).toUpperCase()
                               : (v > 60 ? 'GREED' : (v < 25 ? 'FEAR' : 'NEUTRAL'));
    var chg = rgToNum(f.change);
    var txt = cls + ' ' + rgNum(v, 0) + (isFinite(chg) ? ' (' + (chg >= 0 ? '+' : '') + rgNum(chg, 0) + ' d/d)' : '');
    if (v > 60)      push('R4','FEAR & GREED','greed ' + rgNum(v, 0), txt + ' · risk appetite high',    'BULL',  1, true);
    else if (v < 25) push('R4','FEAR & GREED','fear '  + rgNum(v, 0), txt + ' · risk appetite frozen',  'BEAR', -1, true);
    else             push('R4','FEAR & GREED','F&G',                  txt + ' · 25–60 neutral zone',    'NA',    0, true);
  })();

  /* R5 — DXY 20-day trend: FALLING +1 (tailwind), RISING -1 (headwind) */
  (function(){
    var x = components.dxy;
    if (!x){ push('R5','DXY (DOLLAR)','DXY','data unavailable','NA',0,true); return; }
    var val = rgToNum(x.value);
    var tr = x.trend20 ? String(x.trend20).toUpperCase() : '';
    var chg = rgToNum(x.change20Pct);
    var txt = 'DXY ' + (isFinite(val) ? rgNum(val, 2) : 'n/a') +
              (isFinite(chg) ? ' (' + (chg >= 0 ? '+' : '') + rgNum(chg, 1) + '% 20d)' : '');
    if (tr === 'FALLING')      push('R5','DXY (DOLLAR)','DXY falling', txt + ' · FALLING — dollar tailwind for risk', 'BULL',  1, true);
    else if (tr === 'RISING')  push('R5','DXY (DOLLAR)','DXY rising',  txt + ' · RISING — dollar headwind for risk',  'BEAR', -1, true);
    else                       push('R5','DXY (DOLLAR)','DXY',         txt + ' · ' + (tr || 'FLAT') + ' — no dollar edge', 'NA', 0, true);
  })();

  /* R6 — US 10Y yield 20-day trend: FALLING +1, RISING -1 */
  (function(){
    var y = components.us10y;
    if (!y){ push('R6','US 10Y YIELD','yields','data unavailable','NA',0,true); return; }
    var val = rgToNum(y.value);
    var tr = y.trend ? String(y.trend).toUpperCase() : '';
    var txt = '10Y ' + (isFinite(val) ? rgNum(val, 2) + '%' : 'n/a');
    if (tr === 'FALLING')      push('R6','US 10Y YIELD','yields falling', txt + ' · FALLING — yield tailwind for risk', 'BULL',  1, true);
    else if (tr === 'RISING')  push('R6','US 10Y YIELD','yields rising',  txt + ' · RISING — yield headwind for risk',  'BEAR', -1, true);
    else                       push('R6','US 10Y YIELD','yields',         txt + ' · ' + (tr || 'FLAT') + ' — no yield edge', 'NA', 0, true);
  })();

  /* R7 — GOLD (XAU PERP) vs 200EMA: HEDGE DEMAND, informational only, never scored */
  (function(){
    var g = components.gold;
    if (!g){ push('R7','HEDGE DEMAND · GOLD (XAU PERP)','gold','data unavailable · informational — not scored','NA',0,false); return; }
    var close = rgToNum(g.close), e200 = rgToNum(g.ema200);
    if (!isFinite(close) || !isFinite(e200)){
      push('R7','HEDGE DEMAND · GOLD (XAU PERP)','gold','data unavailable · informational — not scored','NA',0,false); return;
    }
    var pxTxt = 'XAU close ' + rgNum(close) + ' · ema200 ' + rgNum(e200) + ' · informational — not scored';
    if (close > e200)      push('R7','HEDGE DEMAND · GOLD (XAU PERP)','gold','XAU ABOVE 200EMA · hedge bid firm · ' + pxTxt, 'BULL', 0, false);
    else if (close < e200) push('R7','HEDGE DEMAND · GOLD (XAU PERP)','gold','XAU BELOW 200EMA · hedge bid soft · ' + pxTxt, 'BEAR', 0, false);
    else                   push('R7','HEDGE DEMAND · GOLD (XAU PERP)','gold','XAU AT 200EMA · ' + pxTxt, 'NA', 0, false);
  })();

  /* R8 — STABLECOIN FLOWS (DeFiLlama aggregate): 7d mcap delta vs ±0.5% band.
     Dry powder IN = risk-on (+1), liquidity DRAINING = risk-off (-1). */
  (function(){
    var s = components.stable;
    if (!s){ push('R8','DRY POWDER','stables','data unavailable','NA',0,true); return; }
    var tot = rgToNum(s.totalUSD), d7 = rgToNum(s.delta7dUSD), d30 = rgToNum(s.delta30dUSD);
    var wk = (isFinite(tot) && isFinite(d7)) ? tot - d7 : NaN; /* week-ago baseline */
    if (!isFinite(tot) || !(tot > 0) || !isFinite(d7) || !(wk > 0)){
      push('R8','DRY POWDER','stables','data unavailable','NA',0,true); return;
    }
    var pct7 = (d7 / wk) * 100;
    var txt = 'STABLECOINS ' + rgUsd(tot) + ' · 7D ' + rgUsdSigned(d7);
    var tail = ' · 30D ' + (isFinite(d30) ? rgUsdSigned(d30) : 'n/a');
    if (pct7 > 0.5)       push('R8','DRY POWDER','dry powder in',  txt + ' (INFLOWS)'  + tail + ' — dry powder entering, risk-on',   'BULL',  1, true);
    else if (pct7 < -0.5) push('R8','DRY POWDER','dry powder out', txt + ' (DRAINING)' + tail + ' — liquidity draining, risk-off',  'BEAR', -1, true);
    else                  push('R8','DRY POWDER','stables flat',   txt + ' (FLAT)'     + tail + ' — inside ±0.5% band, no flow edge', 'NA',   0, true);
  })();

  /* ---------------- aggregate ---------------- */
  var score = 0, scoredTotal = 0, zeroCount = 0, drivers = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r.scored) continue;
    scoredTotal++;
    score += r.score;
    if (r.score !== 0) drivers.push((r.score > 0 ? '+1 ' : '-1 ') + r.short);
    else zeroCount++;
  }
  var word, cls;
  if (score >= 3){ word = 'RISK-ON';  cls = 'long'; }
  else if (score <= -3){ word = 'RISK-OFF'; cls = 'short'; }
  else { word = 'MIXED — SELECTIVE'; cls = 'aside'; }
  var why = 'score ' + (score > 0 ? '+' : '') + score + '/' + scoredTotal +
    (drivers.length ? ': ' + drivers.join(' · ') : ' — no directional drivers') +
    (zeroCount ? ' · ' + zeroCount + ' neutral/n-a' : '');
  return { score: score, word: word, why: why, cls: cls, rows: rows, scoredTotal: scoredTotal };
}

/* =========================================================================
PURE PLAYBOOK — regimePlaybook(state) where state is a regimeVerdict()
result (or anything with {score, cls, word, rows}). Tells the operator what
to DO with the regime:

  bias         LONG-ONLY | SHORT-ONLY | BOTH | STAND-ASIDE
  size         full | half | quarter   (|score| >= 5 full, >= 3 half, else quarter)
  sizeNote     one-line justification
  setups       preferred setup types for this regime (trend-follow /
               mean-revert / carry), conditioned on the actual gauge rows
               (R4 F&G stretch, R8 dry-powder flows)
  invalidation one explicit line — always "This regime thesis dies if …"

Data-driven only from the verdict's own metrics — no globals, no fetch,
never throws. Returns null when the input is unusable (no rows array,
non-finite score) rather than fabricating guidance.
========================================================================= */
function regimePlaybook(state){
  try{
    if (!state || typeof state !== 'object' || !Array.isArray(state.rows)) return null;
    var score = +state.score;
    if (!isFinite(score)) return null;
    var cls = (state.cls === 'long' || state.cls === 'short' || state.cls === 'aside') ? state.cls
            : (score >= 3 ? 'long' : (score <= -3 ? 'short' : 'aside'));
    var word = (typeof state.word === 'string' && state.word) ? state.word
             : (cls === 'long' ? 'RISK-ON' : (cls === 'short' ? 'RISK-OFF' : 'MIXED — SELECTIVE'));

    var bulls = [], bears = [], r4 = null, r8 = null;
    for (var i = 0; i < state.rows.length; i++){
      var r = state.rows[i];
      if (!r) continue;
      if (r.id === 'R4') r4 = r;
      if (r.id === 'R8') r8 = r;
      if (r.scored === false) continue;
      var s = +r.score;
      if (!isFinite(s) || s === 0) continue;
      if (s > 0) bulls.push(r); else bears.push(r);
    }
    function drivers(list){
      var names = [];
      for (var j = 0; j < list.length && names.length < 2; j++){
        if (list[j].name) names.push(list[j].name);
      }
      return names.length ? names.join(' + ') : 'the leading gauges';
    }

    var abs = Math.abs(score);
    var size = (cls === 'aside') ? 'quarter' : (abs >= 5 ? 'full' : 'half');
    var bias, sizeNote, setups = [], invalidation;

    if (cls === 'long'){
      bias = 'LONG-ONLY';
      sizeNote = abs >= 5
        ? 'broad agreement (' + abs + '/' + (state.scoredTotal || 7) + ' gauges) — full risk on A-grade longs'
        : 'thin majority (score +' + abs + ') — half size until the score broadens toward +5';
      setups.push('trend-follow longs — 4h/1h pullbacks to rising EMA9/21 structure in leaders');
      setups.push('breakout continuation while BTC holds above the 200EMA (R1)');
      if (r8 && +r8.score > 0) setups.push('carry/basis — harvest funding while stablecoin dry powder expands (R8)');
      else setups.push('mean-revert dips only at higher-timeframe demand, never against a fresh breakdown');
      if (r4 && +r4.score > 0) setups.push('size discipline — F&G already in greed: add on pullbacks, not on stretched candles');
      invalidation = 'This regime thesis dies if the composite score closes back under +3 — watch ' +
        drivers(bulls) + ' to flip first; the first daily close back in MIXED cuts longs to probe size.';
    }else if (cls === 'short'){
      bias = 'SHORT-ONLY';
      sizeNote = abs >= 5
        ? 'broad risk-off agreement (' + abs + '/' + (state.scoredTotal || 7) + ' gauges) — full risk on A-grade shorts'
        : 'thin majority (score ' + score + ') — half size until the score broadens toward -5';
      setups.push('trend-follow shorts — rallies into falling 4h/1h EMA9/21 structure');
      setups.push('breakdown continuation while BTC stays under the 200EMA (R1)');
      if (r8 && +r8.score < 0) setups.push('carry/basis — short-side funding harvest while dry powder drains (R8)');
      else setups.push('hedged carry only — no naked dip-buying while liquidity is not expanding');
      if (r4 && +r4.score < 0) setups.push('mean-revert bounces allowed at quarter size only — F&G already in fear = capitulation stretch, not a long signal');
      invalidation = 'This regime thesis dies if the composite score closes back above -3 — watch ' +
        drivers(bears) + ' to flip first; the first daily close back in MIXED covers momentum shorts.';
    }else{
      if (score === 0){
        bias = 'STAND-ASIDE';
        sizeNote = 'no directional drivers scored — capital preservation IS the position; quarter size max on any probe';
        setups.push('stand aside — mixed tapes precede regime shifts; re-check after the next daily close');
        setups.push('if forced: mean-revert only at 1h/4h range extremes, both directions, quarter size, tight invalidation');
      }else{
        bias = 'BOTH';
        sizeNote = 'score ' + (score > 0 ? '+' : '') + score + ' leans ' + (score > 0 ? 'long' : 'short') +
          ' but sits inside the deadzone — quarter size, per-symbol gates decide';
        setups.push('mean-revert at range extremes in the direction of the lean (funding / volZ stretched)');
        setups.push('trend-follow only the single strongest symbols with clean per-symbol gates — never the index tape');
      }
      invalidation = 'This regime thesis dies if the score resolves to ±3 — when MIXED breaks, stop fading and follow the new regime direction at the new regime size.';
    }

    return {
      regime: word, cls: cls, score: score,
      bias: bias, size: size, sizeNote: sizeNote,
      setups: setups, invalidation: invalidation
    };
  }catch(e){ return null; }
}

/* ---------------- UI ---------------- */

var RG_MEANING = {
  long:  '<b>What this means:</b> the backdrop favors alt longs and trend-following — liquidity (dollar/yields) and/or sentiment lean risk-on. Give longs more room and demand more from shorts. Regime is context, not a signal: per-symbol gates still decide entries.',
  short: '<b>What this means:</b> the backdrop favors shorts, hedges and reduced size — the dollar/yields/dominance mix is draining alt risk appetite. Tighten invalidations and treat counter-trend longs as suspect until the score improves.',
  aside: '<b>What this means:</b> no clean market-wide edge — trade selectively at reduced size and let per-symbol gates decide. Mixed tapes often precede regime shifts; re-check after the next daily close.'
};

function rgSetProg(el, f){
  if (!el) return;
  el.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && el.firstElementChild) el.firstElementChild.style.width = (f*100).toFixed(1) + '%';
}

function rgPlaybookHTML(v){
  var pb = null;
  try{ pb = regimePlaybook(v); }catch(e){ pb = null; }
  if (!pb) return '';
  var cardCls = (pb.cls === 'long') ? 'card long' : (pb.cls === 'short' ? 'card short' : 'card');
  return '<div class="' + cardCls + '" style="margin-top:12px">'
    + '<div class="chead"><span class="sym">PLAYBOOK</span>'
    + '<span class="dir">' + rgEsc(pb.regime) + ' · ' + rgEsc(pb.bias) + '</span></div>'
    + '<div class="kv"><span>directional bias</span><b>' + rgEsc(pb.bias) + '</b></div>'
    + '<div class="kv"><span>position size</span><b>' + rgEsc(pb.size.toUpperCase()) + '</b></div>'
    + '<div class="note" style="margin-top:2px">' + rgEsc(pb.sizeNote) + '</div>'
    + '<div class="gates">'
    + pb.setups.map(function(s){ return '<span class="gpip ok">' + rgEsc(s) + '</span>'; }).join('')
    + '</div>'
    + '<div class="plan">INVALIDATION — ' + rgEsc(pb.invalidation) + '</div>'
    + '</div>';
}

function rgRender(out, v, meta){
  if (!out) return;
  var html = '';
  if (meta && meta.total > 0 && meta.fails === meta.total){
    html += '<div class="note warn">All ' + meta.total + ' data sources unreachable — check network / ad-blocker, then REFRESH.</div>';
    html += '<div class="empty" style="margin-top:8px">No regime data available. Standing aside by default.</div>';
    out.innerHTML = html;
    return;
  }
  html += '<div class="ledger">';
  for (var i = 0; i < v.rows.length; i++){
    var r = v.rows[i];
    html += '<div class="lrow"><span class="gid">' + r.id + '</span>' +
            '<span class="gname">' + rgEsc(r.name) + '</span>' +
            '<span class="gdetail">' + rgEsc(r.detail) + '</span>' +
            '<span class="stamp ' + r.stampClass + '">' + (r.stamp === 'NA' ? 'N/A' : r.stamp) + '</span></div>';
  }
  html += '</div>';
  html += '<div class="verdict ' + v.cls + '"><div class="vword">' + rgEsc(v.word) + '</div>' +
          '<div class="vwhy">' + rgEsc(v.why) + '</div></div>';
  html += '<div class="note" style="margin-top:8px">' + (RG_MEANING[v.cls] || RG_MEANING.aside) + '</div>';
  html += rgPlaybookHTML(v);
  if (meta && meta.fails > 0){
    html += '<div class="note warn" style="margin-top:6px">' + meta.fails + ' of ' + meta.total +
            ' sources unavailable — those gauges show N/A and score 0.</div>';
  }
  out.innerHTML = html;
}

/* ---------------- hard-refresh contract state ----------------
   rgTab mirrors the mounted pane so the HG_tabs refresh() (4th registration
   field) can re-run the gauge scan the operator already opened. A global
   hard refresh must NEVER trigger the first 8-gauge fetch on a tab that was
   never opened — it skips honestly. busy makes rgRun re-entrant-safe and
   gives refresh its 'busy' status. */
var rgTab = { els: null, busy: false, hasRun: false };

/* ---------------- BRAIN state snapshot (window.regimeState) ----------------
   Last SUCCESSFUL scan's verdict, cached for the BRAIN meta-engine. Failed
   re-runs never touch it — the previous good snapshot keeps its original
   `at`. The getter hands out DEEP-FROZEN deep copies and never throws. */
var __rgSnap = null;
function __rgStateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = __rgStateView(v[k]);
  }
  Object.freeze(out);
  return out;
}
function setRgSnapshot(v){
  try{
    if (!v || typeof v !== 'object') return;
    var pb = null;
    try{ pb = regimePlaybook(v); }catch(ePb){ pb = null; }
    __rgSnap = {
      label: (typeof v.word === 'string' && v.word) ? v.word : 'UNKNOWN',
      score: (typeof v.score === 'number' && isFinite(v.score)) ? v.score : 0,
      playbook: pb,
      at: Date.now()
    };
  }catch(e){ /* snapshotting must never break the scan */ }
}

/* refresh contract: async, NEVER throws, terse status string —
   'refreshed' | 'skipped: not run yet' | 'busy'. Safe before mount. */
async function refreshRegime(){
  try{
    if (rgTab.busy) return 'busy';
    if (!rgTab.hasRun || !rgTab.els) return 'skipped: not run yet';
    await rgRun(rgTab.els); /* rgRun is internally try-caught; defensive anyway */
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

async function rgRun(els){
  if (!els || !els.out) return;
  if (rgTab.busy) return; /* busy guard — no overlapping gauge scans */
  rgTab.busy = true;
  if (els.run) els.run.disabled = true;
  rgSetProg(els.prog, 0.08);
  if (els.stat) els.stat.textContent = 'scanning 8 gauges…';
  try{
    /* chunk 1: binance klines family + DXY (token-bucket paced upstream) */
    var c1 = await Promise.all([ rgFetchBtc(), rgFetchEthBtc(), rgFetchGold(), rgFetchDxy() ]);
    rgSetProg(els.prog, 0.45);
    await rgSleep(250); // gentle pacing before the external APIs
    /* chunk 2: CoinGecko + alternative.me + macro + DeFiLlama stablecoins */
    var c2 = await Promise.all([ rgFetchBtcDominance(), rgFetchFng(), rgFetchUs10y(), rgFetchStablecoins() ]);
    rgSetProg(els.prog, 0.85);

    var components = {
      btc: c1[0], ethbtc: c1[1], gold: c1[2], dxy: c1[3],
      btcd: c2[0], fng: c2[1], us10y: c2[2], stable: c2[3]
    };
    var fails = 0;
    Object.keys(components).forEach(function(k){ if (!components[k]) fails++; });

    var v = regimeVerdict(components);
    rgRender(els.out, v, { fails: fails, total: 8 });
    setRgSnapshot(v); /* BRAIN: cache the successful scan (catch path below never reaches here) */
    if (els.stat) els.stat.textContent = 'updated ' + new Date().toISOString().slice(11, 19) +
      ' UTC · ' + (8 - fails) + '/8 sources ok · cached 60s (stables 10m)';
    rgSetProg(els.prog, 1);
    setTimeout(function(){ rgSetProg(els.prog, null); }, 600);
  }catch(e){
    els.out.innerHTML = '<div class="note warn">regime scan failed: ' + rgEsc(e && e.message || e) + '</div>';
    if (els.stat) els.stat.textContent = 'scan failed';
    rgSetProg(els.prog, null);
  }finally{
    rgTab.busy = false;
    rgTab.hasRun = true; /* attempted counts as run — even a failed scan */
    if (els.run) els.run.disabled = false;
  }
}

function mountRegime(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">' +
      '<h2>MARKET REGIME <span>risk-on / risk-off composite · 8 gauges</span></h2>' +
      '<div class="row">' +
        '<button class="btn" id="regimeRun">REFRESH</button>' +
        '<span class="note" id="regimeStat">auto-runs on open</span>' +
      '</div>' +
      '<div class="prog" id="regimeProg"><i></i></div>' +
      '<div id="regimeOut" style="margin-top:10px"></div>' +
      '<div class="note" style="margin-top:10px">Scored gauges (±1 each): BTC vs 200EMA · ETH/BTC EMA20 slope · ' +
      'BTC dominance (&lt;50% alt-favorable, &gt;55% risk-off) · Fear &amp; Greed (&gt;60 / &lt;25) · ' +
      'DXY 20-day trend · US10Y 20-day trend · stablecoin flows (7d mcap Δ vs ±0.5% band — DeFiLlama dry powder). ' +
      'Gold (XAU perp) is informational (hedge demand). ' +
      'Score ≥ +3 RISK-ON · ≤ −3 RISK-OFF · between = MIXED. N/A scores 0 — an honest dashboard shows holes.</div>' +
    '</div>';
  var els = {
    run:  el.querySelector('#regimeRun'),
    stat: el.querySelector('#regimeStat'),
    prog: el.querySelector('#regimeProg'),
    out:  el.querySelector('#regimeOut')
  };
  if (els.run) els.run.addEventListener('click', function(){ rgRun(els); });
  rgTab.els = els; /* hand the pane to the hard-refresh contract */
  rgRun(els); // auto-run on mount
}

/* ---------------- exports + tab registration ---------------- */

W.regimeVerdict = regimeVerdict;
W.regimePlaybook = regimePlaybook;
W.regimeState = function(){
  try{ return __rgSnap ? __rgStateView(__rgSnap) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'regime', label: 'REGIME', mount: mountRegime, refresh: refreshRegime });

})();
