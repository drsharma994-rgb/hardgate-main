/* =========================================================================
HARDGATE — macro.js
Macro context for the gold/crypto terminal. Classic script -> globals.

- DXY computed from Frankfurter (api.frankfurter.dev: ECB reference rates,
  CORS-open, no key, business days only) via the ICE DXY geometric formula.
- US10Y yield from the official US Treasury daily yield-curve CSV
  (home.treasury.gov, ACAO:*; the year is part of the URL — the current year
  is tried first, the previous year on failure/empty, i.e. January rollover).
- Spot gold + silver from gold-api.com (ACAO:*, no key, ~10s upstream cache).
- Gold candles with an ordered fallback chain:
    1) Binance XAUUSDT TradFi perp klines (free, CORS-open; tracks spot)
    2) Binance PAXGUSDT perp klines (tokenized gold, tracks spot ~0.5%)
    3) Twelve Data XAU/USD (global TWELVEDATA_KEY, if defined)
    4) Yahoo GC=F via the same-origin /api/proxy (last resort)
- getGoldMacro(): DXY + US10Y + silver -> realRateHint. Yahoo chart legs
  survive ONLY as last-resort fallbacks, routed through the same-origin
  Vercel function /api/proxy?url=<encoded> (allowlists query*.finance.yahoo.com);
  a missing proxy (dev) or a Yahoo failure simply yields null legs.

Discipline: never throw, 10s AbortController timeouts, in-memory cache
(5 min default; DXY 6h — the ECB fixes once per business day anyway).
Candle rows: {t:<unix seconds>, o,h,l,c,v} ascending, like everywhere else.
========================================================================= */
'use strict';

const FRANKFURTER_API = 'https://api.frankfurter.dev';
const __MACRO_CACHE = new Map();
const MACRO_CACHE_MS = 5*60*1000;
const DXY_CACHE_MS = 6*60*60*1000;
const __macroBucket = (typeof makeTokenBucket === 'function') ? makeTokenBucket(2, 2) : { take: function(){ return 0; } };

async function __macroFetchJson(url, timeoutMs, proxyTried){
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 10000);
  try{
    const w = __macroBucket.take();
    if (w > 0) await new Promise(function(r){ setTimeout(r, Math.min(w, 2000)); });
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.ok) return await res.json();
    if (!proxyTried && String(url).indexOf('frankfurter') !== -1){
      return __macroFetchJson('/api/proxy?url=' + encodeURIComponent(url), timeoutMs, true);
    }
    return null;
  }catch(e){
    if (!proxyTried && String(url).indexOf('frankfurter') !== -1){
      return __macroFetchJson('/api/proxy?url=' + encodeURIComponent(url), timeoutMs, true);
    }
    return null;
  }
  finally{ clearTimeout(timer); }
}

/* Same discipline as __macroFetchJson, for text/CSV endpoints. */
async function __macroFetchText(url, timeoutMs){
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 10000);
  try{
    const w = __macroBucket.take();
    if (w > 0) await new Promise(function(r){ setTimeout(r, Math.min(w, 2000)); });
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

function __macroCacheGet(key, ttlMs){
  const h = __MACRO_CACHE.get(key);
  return (h && (Date.now() - h.at) < (ttlMs || MACRO_CACHE_MS)) ? h.val : undefined;
}
function __macroCachePut(key, val){
  if (val !== null && val !== undefined) __MACRO_CACHE.set(key, { at: Date.now(), val: val });
  return val;
}

function fmtNum(n, dp){
  dp = (dp === undefined) ? 2 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (+n).toFixed(dp);
}

/* ICE DXY: 50.14348112 × EURUSD^-0.576 × USDJPY^0.136 × GBPUSD^-0.119
   × USDCAD^0.091 × USDSEK^0.042 × USDCHF^0.036
   Frankfurter rates are USD-based (1 USD = x CCY), so EURUSD = 1/rates.EUR etc. */
function computeDXYfromRates(rates){
  try{
    if (!rates) return null;
    const need = ['EUR','JPY','GBP','CAD','SEK','CHF'];
    for (let i = 0; i < need.length; i++){ if (!(+rates[need[i]] > 0)) return null; }
    const EURUSD = 1/(+rates.EUR), USDJPY = +rates.JPY, GBPUSD = 1/(+rates.GBP);
    const USDCAD = +rates.CAD, USDSEK = +rates.SEK, USDCHF = +rates.CHF;
    const v = 50.14348112 *
      Math.pow(EURUSD, -0.576) * Math.pow(USDJPY, 0.136) * Math.pow(GBPUSD, -0.119) *
      Math.pow(USDCAD, 0.091) * Math.pow(USDSEK, 0.042) * Math.pow(USDCHF, 0.036);
    return isFinite(v) ? v : null;
  }catch(e){ return null; }
}

/* {value, date, trend20, change20Pct} — trend over ~20 business days
   (range endpoint, first vs last fix; ±0.3% band = FLAT). Cached 6h. */
async function getDXY(){
  try{
    const hit = __macroCacheGet('dxy', DXY_CACHE_MS); if (hit !== undefined) return hit;
    const SYMS = 'EUR,JPY,GBP,CAD,SEK,CHF';
    const latest = await __macroFetchJson(FRANKFURTER_API + '/v1/latest?base=USD&symbols=' + SYMS);
    if (!latest || !latest.rates || !latest.date) return null;
    const value = computeDXYfromRates(latest.rates);
    if (value === null) return null;
    let trend20 = 'FLAT', change20Pct = null;
    const toD = new Date(latest.date + 'T00:00:00Z');
    if (!isNaN(toD)){
      const fromIso = new Date(toD.getTime() - 31*86400000).toISOString().slice(0, 10); // ~21 business days
      const range = await __macroFetchJson(FRANKFURTER_API + '/v1/' + fromIso + '..' + latest.date +
                                           '?base=USD&symbols=' + SYMS);
      if (range && range.rates){
        const dates = Object.keys(range.rates).sort();
        if (dates.length >= 2){
          const first = computeDXYfromRates(range.rates[dates[0]]);
          const lastR = computeDXYfromRates(range.rates[dates[dates.length - 1]]);
          if (first !== null && lastR !== null && first > 0){
            change20Pct = (lastR/first - 1)*100;
            trend20 = change20Pct > 0.3 ? 'RISING' : (change20Pct < -0.3 ? 'FALLING' : 'FLAT');
          }
        }
      }
    }
    return __macroCachePut('dxy', { value: value, date: latest.date, trend20: trend20, change20Pct: change20Pct });
  }catch(e){ return null; }
}

/* Aggregate 1h rows into aligned 2h/4h buckets (UTC-aligned, like exchange bars) */
function resampleRows(rows, sec){
  if (!rows || !rows.length || !(sec > 0)) return rows || [];
  const buckets = new Map();
  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    const b = Math.floor(r.t/sec)*sec;
    const cur = buckets.get(b);
    if (!cur) buckets.set(b, { t: b, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; cur.v += (r.v || 0); }
  }
  return Array.from(buckets.values()).sort(function(a,b){ return a.t - b.t; });
}

/* Yahoo chart API -> rows. Response: chart.result[0].timestamp + indicators.quote[0] */
function __parseYahooChart(j){
  try{
    const r = j && j.chart && j.chart.result && j.chart.result[0];
    const ts = r && r.timestamp;
    const q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
    if (!ts || !q || !q.close) return [];
    const out = [];
    for (let i = 0; i < ts.length; i++){
      const o = q.open && q.open[i], h = q.high && q.high[i], l = q.low && q.low[i], c = q.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      out.push({ t: +ts[i], o: +o, h: +h, l: +l, c: +c, v: (q.volume && q.volume[i] != null) ? +q.volume[i] : 0 });
    }
    return out.sort(function(a,b){ return a.t - b.t; });
  }catch(e){ return []; }
}

/* Yahoo chart API, last-resort only, via the same-origin Vercel function
   /api/proxy?url=<encoded> (allowlists query*.finance.yahoo.com — built
   separately). Tolerates the proxy being absent (dev) or Yahoo failing;
   a direct fetch is attempted last (works outside the browser, e.g. tests). */
async function __yahooViaProxy(url){
  try{
    const j = await __macroFetchJson('/api/proxy?url=' + encodeURIComponent(url));
    if (j) return j;
  }catch(e){}
  try{ return await __macroFetchJson(url); }catch(e){ return null; }
}

/* "FRED IS NOT CONFIGURED" IS AN ANSWER, AND IT DOES NOT CHANGE.

   /api/fred replies 503 {error:'fred not configured'} when the server has no
   FRED_API_KEY. __macroCachePut only stores truthy values, so that answer was
   never remembered: five call sites × repeated warms re-asked on every pass
   and a single page load fired ~25 requests at an endpoint that had already
   said no. Every one of them logged a console error, which buried the real
   failures underneath.

   FRED_API_KEY is read from the process environment at boot, so within one
   browser session the answer genuinely cannot change — the latch is sticky
   for the session, the same discipline binance.js uses for its geo-block.
   A 503 latches; any other failure does not, because those are transient and
   the next warm should try again. Nothing is fabricated either way: an
   unconfigured FRED still returns null and the macro cards still say so. */
const __FRED = { unconfigured: false };

async function __fredFetch(url, timeoutMs){
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 10000);
  try{
    const w = __macroBucket.take();
    if (w > 0) await new Promise(function(r){ setTimeout(r, Math.min(w, 2000)); });
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 503){ __FRED.unconfigured = true; return null; }
    if (!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

/* FRED observations via same-origin /api/fred (server holds FRED_API_KEY).
   Returns ascending [{date, value}] or null when unconfigured/unavailable. */
async function __fredSeries(series, limit){
  try{
    if (__FRED.unconfigured) return null;
    series = String(series || 'DGS10').toUpperCase();
    limit = Math.max(5, Math.min(100, limit || 30));
    const key = 'fred|' + series + '|' + limit;
    const hit = __macroCacheGet(key, DXY_CACHE_MS); if (hit !== undefined) return hit;
    const j = await __fredFetch('/api/fred?series=' + encodeURIComponent(series) + '&limit=' + limit);
    if (!j || !Array.isArray(j.observations) || !j.observations.length) return null;
    const rows = j.observations.slice().reverse();
    return __macroCachePut(key, rows);
  }catch(e){ return null; }
}

function __trendFromFredRows(rows, relBandPct){
  relBandPct = (typeof relBandPct === 'number' && isFinite(relBandPct)) ? relBandPct : 2;
  if (!rows || rows.length < 2) return { value: null, date: null, trend20: 'FLAT', change20Pct: null };
  const last = rows[rows.length - 1];
  const back = rows[Math.max(0, rows.length - 1 - 20)];
  let trend20 = 'FLAT', change20Pct = null;
  if (back && isFinite(back.value) && back.value > 0 && isFinite(last.value)){
    change20Pct = (last.value/back.value - 1)*100;
    trend20 = change20Pct > relBandPct ? 'RISING' : (change20Pct < -relBandPct ? 'FALLING' : 'FLAT');
  }
  return { value: last.value, date: last.date, trend20: trend20, change20Pct: change20Pct };
}

/* ---------- US Treasury daily yield-curve CSV -> US10Y ----------
   Year is part of the URL; rows arrive newest-first with a quoted header
   (Date,"1 Mo",...,"10 Yr",...) and MM/DD/YYYY dates. ACAO:*, no key. */
const TREASURY_CSV_BASE = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/';
function __treasuryCsvUrl(year){
  return TREASURY_CSV_BASE + year + '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + year + '&page&_format=csv';
}
/* The REAL (TIPS) yield curve — the keyless stand-in for FRED's DFII10.
   Same host and same shape as the nominal curve above, which the app has
   fetched directly under CSP since v431, so this adds no new origin and no
   new failure mode. Its header says "10 YR" where the nominal one says
   "10 Yr", hence the case-insensitive match in the parser. */
function __treasuryRealCsvUrl(year){
  return TREASURY_CSV_BASE + year + '/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=' + year + '&page&_format=csv';
}
/* Minimal RFC-4180-ish CSV line splitter (quoted fields, "" escapes). */
function __parseCsvLine(line){
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (inQ){
      if (ch === '"'){ if (line[i + 1] === '"'){ cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ','){ out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
/* CSV text -> [{t:<unix sec>, date:'YYYY-MM-DD', y10:<number>}] ascending. */
/* Ten-year REAL yield rows from the TIPS curve CSV, oldest-first, in the
   {value,date} shape __trendFromFredRows already consumes — so the trend read
   is computed by exactly the same code whether the numbers came from FRED or
   from Treasury, and the two cannot drift apart. */
function __parseTreasuryReal10Y(csvText){
  try{
    if (!csvText || typeof csvText !== 'string') return [];
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = __parseCsvLine(lines[0]).map(function(h){ return h.trim().toUpperCase(); });
    let ci = -1;
    for (let i = 0; i < header.length; i++){ if (header[i] === '10 YR'){ ci = i; break; } }
    if (ci < 0) return [];
    const rows = [];
    for (let k = 1; k < lines.length; k++){
      if (!lines[k] || !lines[k].trim()) continue;
      const cells = __parseCsvLine(lines[k]);
      if (cells.length <= ci) continue;
      const v = parseFloat(cells[ci]);
      const d = (cells[0] || '').trim();
      if (!isFinite(v) || !d) continue;
      const t = Date.parse(d);
      if (!isFinite(t)) continue;
      rows.push({ value: v, date: d, t: t });
    }
    /* Treasury serves newest-first; every consumer here expects oldest-first. */
    rows.sort(function(a, b){ return a.t - b.t; });
    return rows;
  }catch(e){ return []; }
}

function __parseTreasury10Y(csvText){
  try{
    if (!csvText || typeof csvText !== 'string') return [];
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = __parseCsvLine(lines[0]).map(function(h){ return h.trim(); });
    let ci = -1;
    for (let i = 0; i < header.length; i++){ if (header[i] === '10 Yr'){ ci = i; break; } }
    if (ci < 0) return [];
    const rows = [];
    for (let k = 1; k < lines.length; k++){
      if (!lines[k] || !lines[k].trim()) continue;
      const cells = __parseCsvLine(lines[k]);
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(cells[0] || '').trim());
      const y10 = parseFloat(cells[ci]);
      if (!m || !isFinite(y10)) continue;
      rows.push({
        t: Math.floor(Date.UTC(+m[3], (+m[1]) - 1, +m[2])/1000),
        date: m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2),
        y10: y10
      });
    }
    return rows.sort(function(a,b){ return a.t - b.t; });
  }catch(e){ return []; }
}
/* {value, date, trend20, change20Pct} — trend over ~20 business days
   (±2% relative band = FLAT, same band the legacy Yahoo ^TNX leg used).
   Tries the current year first, the previous year on failure/empty
   (January rollover). Cached 6h — the curve publishes once per business day. */
async function getUST10Y(){
  try{
    const hit = __macroCacheGet('tnx', DXY_CACHE_MS); if (hit !== undefined) return hit;
    const fredRows = await __fredSeries('DGS10', 30);
    if (fredRows && fredRows.length){
      const ft = __trendFromFredRows(fredRows, 2);
      if (isFinite(ft.value)){
        return __macroCachePut('tnx', { value: ft.value, date: ft.date, trend20: ft.trend20, change20Pct: ft.change20Pct, source: 'fred' });
      }
    }
    const yr = new Date().getUTCFullYear();
    let rows = __parseTreasury10Y(await __macroFetchText(__treasuryCsvUrl(yr)));
    if (!rows.length) rows = __parseTreasury10Y(await __macroFetchText(__treasuryCsvUrl(yr - 1)));
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    const back = rows[Math.max(0, rows.length - 1 - 20)]; // ~20 business days back
    let trend20 = 'FLAT', change20Pct = null;
    if (back && back.y10 > 0 && back.t < last.t){
      change20Pct = (last.y10/back.y10 - 1)*100; // relative move in the yield itself
      trend20 = change20Pct > 2 ? 'RISING' : (change20Pct < -2 ? 'FALLING' : 'FLAT');
    }
    return __macroCachePut('tnx', { value: last.y10, date: last.date, trend20: trend20, change20Pct: change20Pct, source: 'treasury' });
  }catch(e){ return null; }
}

/* Official Fed trade-weighted broad dollar index (DTWEXBGS) when /api/fred is configured. */
async function getDXYOfficial(){
  try{
    const hit = __macroCacheGet('dxyOfficial', DXY_CACHE_MS); if (hit !== undefined) return hit;
    const rows = await __fredSeries('DTWEXBGS', 30);
    if (rows && rows.length){
      const t = __trendFromFredRows(rows, 0.3);
      if (isFinite(t.value))
        return __macroCachePut('dxyOfficial', { value: t.value, date: t.date, trend20: t.trend20, change20Pct: t.change20Pct, source: 'fred' });
    }
    /* KEYLESS FALLBACK — ICE DXY off Yahoo, through the same allowlisted proxy
       the other Yahoo legs use. NOT the same index as FRED's DTWEXBGS: that is
       the Fed's trade-weighted BROAD dollar, this is the six-currency ICE
       basket. They move together and the gate only reads the DIRECTION, which
       is why substituting is honest — but the source is NAMED on the card so a
       reader is never told "Fed broad dollar" when they are looking at ICE. */
    const yj = await __yahooViaProxy('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=3mo');
    const yr2 = __parseYahooChart(yj);
    if (!yr2 || yr2.length < 21) return null;
    /* __parseYahooChart yields {t,o,h,l,c}; there is no .date on it, and an
       empty date reads on the card as "source unknown when". Derive it from
       the bar's own timestamp. */
    const rows2 = yr2.map(function(r){
                       var d = '';
                       try { d = new Date((+r.t) * 1000).toISOString().slice(0, 10); } catch (eD) { d = ''; }
                       return { value: r.c, date: d };
                     })
                     .filter(function(r){ return isFinite(r.value); });
    if (rows2.length < 21) return null;
    const t2 = __trendFromFredRows(rows2, 0.3);
    if (!isFinite(t2.value)) return null;
    return __macroCachePut('dxyOfficial', { value: t2.value, date: t2.date, trend20: t2.trend20,
                                            change20Pct: t2.change20Pct, source: 'ice-dxy' });
  }catch(e){ return null; }
}

/* 10Y TIPS real yield (DFII10) — true real-rate leg when FRED is configured. */
async function getRealYield10Y(){
  try{
    const hit = __macroCacheGet('real10y', DXY_CACHE_MS); if (hit !== undefined) return hit;
    const rows = await __fredSeries('DFII10', 30);
    if (rows && rows.length){
      const t = __trendFromFredRows(rows, 2);
      if (isFinite(t.value))
        return __macroCachePut('real10y', { value: t.value, date: t.date, trend20: t.trend20, change20Pct: t.change20Pct, source: 'fred' });
    }
    /* KEYLESS FALLBACK. Real rates are gold's primary fundamental driver, and
       without FRED_API_KEY this read returned null — leaving macro-realrate
       permanently UNCHECKED on a live desk. Treasury publishes the same TIPS
       curve as a CSV, same host the nominal fallback already uses, no key.
       Trend is computed by __trendFromFredRows either way, so FRED and
       Treasury cannot disagree about what RISING means. */
    const yr = new Date().getUTCFullYear();
    let tr = __parseTreasuryReal10Y(await __macroFetchText(__treasuryRealCsvUrl(yr)));
    if (!tr.length) tr = __parseTreasuryReal10Y(await __macroFetchText(__treasuryRealCsvUrl(yr - 1)));
    if (!tr.length) return null;
    const tt = __trendFromFredRows(tr, 2);
    if (!isFinite(tt.value)) return null;
    return __macroCachePut('real10y', { value: tt.value, date: tt.date, trend20: tt.trend20,
                                        change20Pct: tt.change20Pct, source: 'treasury-tips' });
  }catch(e){ return null; }
}

/* ---------- gold-api.com spot prices (XAU / XAG) ----------
   {name, price, symbol, updatedAt}; ACAO:*, no key, ~10s upstream cache. */
const GOLD_API_BASE = 'https://api.gold-api.com';
async function __goldApiPrice(symbol){ // 'XAU' | 'XAG' -> {price, updatedAt} | null
  try{
    const j = await __macroFetchJson(GOLD_API_BASE + '/price/' + symbol);
    const p = j && +j.price;
    if (!isFinite(p) || !(p > 0)) return null;
    return { price: p, updatedAt: (j && j.updatedAt) || null };
  }catch(e){ return null; }
}

const GOLD_RES_BINANCE = { '15m': '15m', '1h': '1h', '2h': '2h', '4h': '4h', '1d': '1d' };
const GOLD_RES_TD      = { '15m': '15min', '1h': '1h', '2h': '2h', '4h': '4h', '1d': '1day' };
const GOLD_RES_YAHOO   = {
  '15m': { i: '15m', r: '1mo', agg: 0 },
  '1h':  { i: '1h',  r: '3mo', agg: 0 },
  '2h':  { i: '1h',  r: '3mo', agg: 7200 },
  '4h':  { i: '1h',  r: '3mo', agg: 14400 },
  '1d':  { i: '1d',  r: '1y',  agg: 0 }
};

/* hg-v1161: every gold pack leaves this chain on the IUX anchor, through the
   ONE home (gold-iux.js) -- a pure scale of o/h/l/c onto gold-api spot when
   the feed sits 0.05%..2.5% off it, nothing otherwise, never a mutation of
   the fetcher's own rows. The anchored pack is what is cached, and a pack
   already carrying `iux` is never anchored twice. With the module absent or
   the anchor unreadable the pack is the feed's own bars, as before. */
async function __goldIuxApply(pack){
  try{
    const f = (typeof hgGoldIuxApply === 'function') ? hgGoldIuxApply
            : ((typeof globalThis !== 'undefined' && typeof globalThis.hgGoldIuxApply === 'function') ? globalThis.hgGoldIuxApply : null);
    if (!f) return pack;
    const out = await f(pack);
    return (out && Array.isArray(out.rows) && out.rows.length) ? out : pack;
  }catch(e){ return pack; }
}

/* Gold candles, ordered fallback:
     Binance XAUUSDT TradFi perp -> Binance PAXGUSDT -> Twelve Data XAU/USD
     -> Yahoo GC=F via /api/proxy.
   res in {'15m','1h','2h','4h','1d'}; returns {rows, source} (source null when all fail). */
async function getGoldCandles(res, count){
  try{
    res = res || '1h';
    count = Math.max(10, Math.min(5000, count || 200));
    const key = 'gold|' + res + '|' + count;
    const hit = __macroCacheGet(key); if (hit !== undefined) return hit;

    // 1) Binance XAUUSDT TradFi perp — primary free gold feed (tracks spot)
    try{
      if (typeof binanceKlines === 'function' && GOLD_RES_BINANCE[res]){
        const rows = await binanceKlines('XAUUSDT', GOLD_RES_BINANCE[res], count);
        if (rows && rows.length) return __macroCachePut(key, await __goldIuxApply({ rows: rows.slice(-count), source: 'binance-xau' }));
      }
    }catch(e){}

    // 2) Binance PAXGUSDT perp — tokenized gold fallback (tracks spot within ~0.5%)
    try{
      if (typeof binanceKlines === 'function' && GOLD_RES_BINANCE[res]){
        const rows = await binanceKlines('PAXGUSDT', GOLD_RES_BINANCE[res], count);
        if (rows && rows.length) return __macroCachePut(key, await __goldIuxApply({ rows: rows.slice(-count), source: 'binance-paxg' }));
      }
    }catch(e){}

    // 3) Twelve Data XAU/USD spot (values arrive newest-first; datetime is UTC; volume may be absent)
    try{
      if (typeof TWELVEDATA_KEY !== 'undefined' && TWELVEDATA_KEY && GOLD_RES_TD[res]){
        const url = 'https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=' + GOLD_RES_TD[res] +
                    '&outputsize=' + Math.min(count + 5, 5000) + '&apikey=' + TWELVEDATA_KEY;
        if (typeof tdThrottle === 'function') await tdThrottle();   // inline 8/min bucket lives in index.html; no-op when standalone
        if (typeof trackCall === 'function') trackCall('td');       // count the ACTUAL network call, never a cache hit
        const j = await __macroFetchJson(url);
        if (j && Array.isArray(j.values)){
          const rows = j.values.map(function(d){
            const ds = String(d.datetime || '');
            const iso = (ds.length <= 10) ? ds + 'T00:00:00Z' : ds.replace(' ', 'T') + 'Z';
            return {
              t: Math.floor(Date.parse(iso)/1000),
              o: +d.open, h: +d.high, l: +d.low, c: +d.close,
              v: (d.volume !== undefined && d.volume !== null) ? +d.volume : 0
            };
          }).filter(function(r){
            return isFinite(r.t) && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c);
          }).sort(function(a,b){ return a.t - b.t; });
          if (rows.length) return __macroCachePut(key, await __goldIuxApply({ rows: rows.slice(-count), source: 'twelvedata' }));
        }
      }
    }catch(e){}

    // 4) Yahoo GC=F via the same-origin /api/proxy (last resort; 2h/4h resampled from 1h)
    try{
      const ymap = GOLD_RES_YAHOO[res];
      if (ymap){
        const yurl = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=' + ymap.i + '&range=' + ymap.r;
        let rows = __parseYahooChart(await __yahooViaProxy(yurl));
        if (rows.length && ymap.agg) rows = resampleRows(rows, ymap.agg);
        if (rows.length) return __macroCachePut(key, await __goldIuxApply({ rows: rows.slice(-count), source: 'yahoo' }));
      }
    }catch(e){}

    return { rows: [], source: null };
  }catch(e){ return { rows: [], source: null }; }
}

/* Silver candles for gold–silver SMT (Brain macro-feeds + gold engine).
   Binance XAGUSDT (when listed) -> Twelve Data XAG/USD -> Yahoo SI=F. */
async function getSilverCandles(res, count){
  try{
    res = res || '15m';
    count = Math.max(10, Math.min(5000, count || 50));
    const key = 'silver|' + res + '|' + count;
    const hit = __macroCacheGet(key); if (hit !== undefined) return hit;

    try{
      if (typeof binanceKlines === 'function' && GOLD_RES_BINANCE[res]){
        const rows = await binanceKlines('XAGUSDT', GOLD_RES_BINANCE[res], count);
        if (rows && rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'binance-xag' });
      }
    }catch(e){}

    try{
      if (typeof TWELVEDATA_KEY !== 'undefined' && TWELVEDATA_KEY && GOLD_RES_TD[res]){
        const url = 'https://api.twelvedata.com/time_series?symbol=XAG/USD&interval=' + GOLD_RES_TD[res] +
                    '&outputsize=' + Math.min(count + 5, 5000) + '&apikey=' + TWELVEDATA_KEY;
        if (typeof tdThrottle === 'function') await tdThrottle();
        const j = await __macroFetchJson(url);
        const vals = j && j.values;
        if (Array.isArray(vals) && vals.length){
          const rows = vals.map(function(v){
            const t = Date.parse(v.datetime + 'Z');
            return { t: Math.floor(t/1000), o: +v.open, h: +v.high, l: +v.low, c: +v.close,
                     v: isFinite(+v.volume) ? +v.volume : 0 };
          }).filter(function(r){
            return isFinite(r.t) && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c);
          }).sort(function(a,b){ return a.t - b.t; });
          if (rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'twelvedata' });
        }
      }
    }catch(e){}

    try{
      const ymap = GOLD_RES_YAHOO[res];
      if (ymap){
        const yurl = 'https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=' + ymap.i + '&range=' + ymap.r;
        let rows = __parseYahooChart(await __yahooViaProxy(yurl));
        if (rows.length && ymap.agg) rows = resampleRows(rows, ymap.agg);
        if (rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'yahoo-si' });
      }
    }catch(e){}

    return { rows: [], source: null };
  }catch(e){ return { rows: [], source: null }; }
}

/* US10Y yield as ascending OHLC rows (flat bars) for short-term trend reads. */
async function getUST10YCandles(count){
  try{
    count = Math.max(5, Math.min(60, count || 10));
    const key = 'ust10y|' + count;
    const hit = __macroCacheGet(key, DXY_CACHE_MS); if (hit !== undefined) return hit;

    try{
      const yurl = 'https://query1.finance.yahoo.com/v8/finance/chart/^TNX?interval=1d&range=1mo';
      let yrows = __parseYahooChart(await __yahooViaProxy(yurl));
      if (yrows && yrows.length >= 5){
        const rows = yrows.slice(-count).map(function(r){
          const y = (r.c > 20) ? r.c / 10 : r.c;
          return { t: r.t, o: y, h: y, l: y, c: y, v: 0 };
        });
        return __macroCachePut(key, rows);
      }
    }catch(e){}

    const yr = new Date().getUTCFullYear();
    let trows = __parseTreasury10Y(await __macroFetchText(__treasuryCsvUrl(yr)));
    if (!trows.length) trows = __parseTreasury10Y(await __macroFetchText(__treasuryCsvUrl(yr - 1)));
    if (!trows.length) return null;
    const rows = trows.slice(-count).map(function(r){
      return { t: r.t, o: r.y10, h: r.y10, l: r.y10, c: r.y10, v: 0 };
    });
    return __macroCachePut(key, rows);
  }catch(e){ return null; }
}

/* Last daily closes of a Yahoo symbol, via the /api/proxy last-resort path. Nullable. */
/* hg-v1163: the Pearson correlation of the last N daily log returns two
   Yahoo series share, ALIGNED BY UTC DATE (BTC prints on days gold does not;
   an unaligned zip would pair Saturday's bitcoin with Friday's gold). Null
   under 10 shared returns, on a non-finite close, or on a flat series (a
   zero variance is no correlation, not a correlation of zero). Pure. */
function __corrDailyReturns(a, b, n){
  try{
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    const dayOf = r => Math.floor(+r.t / 86400);
    const mapB = new Map();
    for (const r of b){ if (r && isFinite(+r.c) && +r.c > 0) mapB.set(dayOf(r), +r.c); }
    const pa = [], pb = [];
    for (const r of a){
      if (!r || !isFinite(+r.c) || !(+r.c > 0)) continue;
      const cb = mapB.get(dayOf(r));
      if (cb === undefined) continue;
      pa.push(+r.c); pb.push(cb);
    }
    const ra = [], rb = [];
    for (let i = 1; i < pa.length; i++){ ra.push(Math.log(pa[i] / pa[i - 1])); rb.push(Math.log(pb[i] / pb[i - 1])); }
    const k = Math.min(ra.length, n || 20);
    if (k < 10) return null;
    const xa = ra.slice(-k), xb = rb.slice(-k);
    const ma = xa.reduce((s, v) => s + v, 0) / k, mb = xb.reduce((s, v) => s + v, 0) / k;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < k; i++){ const dx = xa[i] - ma, dy = xb[i] - mb; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    if (!(sxx > 0) || !(syy > 0)) return null;
    const c = sxy / Math.sqrt(sxx * syy);
    return isFinite(c) ? Math.max(-1, Math.min(1, c)) : null;
  }catch(e){ return null; }
}

/* hg-v1167: the last COMPLETE daily bar's volume against the mean of the
   `len` complete bars before it. Yahoo prints the current session's bar while
   it is still open, with a partial volume that would read LOW on every scan,
   so a bar dated on today's UTC date is not read. null under len+1 complete
   bars, on a non-positive volume in the base, or on an unreadable volume. */
function __lastCompleteVolumeRel(rows, len, nowMs){
  try{
    if (!Array.isArray(rows) || rows.length < len + 1) return null;
    const now = new Date(isFinite(+nowMs) ? +nowMs : Date.now());
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const done = rows.filter(function(r){ const ms = (+r.t < 1e12 ? +r.t * 1000 : +r.t); return isFinite(ms) && ms < today; });
    if (done.length < len + 1) return null;
    const last = +done[done.length - 1].v;
    if (!isFinite(last) || last < 0) return null;
    let base = 0;
    for (let i = done.length - 1 - len; i < done.length - 1; i++){ const v = +done[i].v; if (!(v > 0)) return null; base += v; }
    base /= len;
    return base > 0 ? last / base : null;
  }catch(e){ return null; }
}

async function __yahooLastClose(symbol, range){
  try{
    const rows = __parseYahooChart(await __yahooViaProxy(
      'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?interval=1d&range=' + (range || '1mo')));
    return rows.length ? rows : null;
  }catch(e){ return null; }
}

/* hg-v966 -- THE SERIES THE GOLD MACRO LOCK DOCUMENTS AND NEVER RECEIVED.

   hgGoldMacroLock offers two reads of "is the dollar bullish": an EMA50 LEVEL
   test (hgGoldEma50Above) and a 20-day CHANGE band. Both call sites of the
   first sit behind ctx.dxyRows / ctx.tnxRows, and getGoldMacro() -- the only
   macro supplier on every gold desk -- returned NEITHER field. So the read
   this repo documents in goldind.js, in AGENTS.md and on the card had never
   run on a live scan, and the band was silently the rule in force.

   These two functions supply the series. They are DELIBERATELY SEPARATE
   fetches from the trend20 legs above: folding a longer window into those
   would move change20Pct and therefore the rule that is actually deciding,
   which is the one thing hg-v966 refuses to do. getDXY / getTNX are untouched.

   Close-only by construction -- a DXY computed from FX rates per date has no
   open, high or low, and fabricating them would be putting made-up numbers in
   a feed. goldind's hgGoldEma50Above reads closes and only closes.

   Every leg is individually nullable and this never throws: a missing series
   simply leaves the EMA50 read unavailable, exactly as before. */
async function getDXYRows(days){
  try{
    const n = (isFinite(+days) && +days > 0) ? Math.floor(+days) : 270;
    const hit = __macroCacheGet('dxyRows', DXY_CACHE_MS); if (hit !== undefined) return hit;
    const SYMS = 'EUR,JPY,GBP,CAD,SEK,CHF';
    const to = new Date();
    if (isNaN(to)) return null;
    const toIso = to.toISOString().slice(0, 10);
    const fromIso = new Date(to.getTime() - n * 86400000).toISOString().slice(0, 10);
    const range = await __macroFetchJson(FRANKFURTER_API + '/v1/' + fromIso + '..' + toIso +
                                         '?base=USD&symbols=' + SYMS);
    if (!range || !range.rates) return null;
    const dates = Object.keys(range.rates).sort();
    const rows = [];
    for (let i = 0; i < dates.length; i++){
      const v = computeDXYfromRates(range.rates[dates[i]]);
      if (v === null || !isFinite(v)) continue;
      const t = Date.parse(dates[i] + 'T00:00:00Z');
      if (!isFinite(t)) continue;
      rows.push({ t: Math.floor(t / 1000), c: v });
    }
    return __macroCachePut('dxyRows', rows.length ? rows : null);
  }catch(e){ return null; }
}

async function getTNXRows(range){
  try{
    const hit = __macroCacheGet('tnxRows', DXY_CACHE_MS); if (hit !== undefined) return hit;
    const rows = await __yahooLastClose('^TNX', range || '1y');
    if (!rows || !rows.length) return __macroCachePut('tnxRows', null);
    /* ^TNX quotes the yield x10 on some feeds -- the same normalisation the
       scalar leg above applies, kept identical so the two cannot disagree
       about what a 10-year yield is. A monotone scale does not move an
       above/below-EMA50 test, but a series that disagrees with its own scalar
       is a trap for the next reader. */
    const out = [];
    for (let i = 0; i < rows.length; i++){
      const c = +rows[i].c;
      if (!isFinite(c)) continue;
      out.push({ t: rows[i].t, c: (c > 20) ? c / 10 : c });
    }
    return __macroCachePut('tnxRows', out.length ? out : null);
  }catch(e){ return null; }
}

/* Macro dashboard for gold. Every leg is individually nullable. Never throws.
   Legs: DXY (Frankfurter) · US10Y (Treasury CSV, Yahoo ^TNX via /api/proxy as
   last resort) · silver (gold-api.com XAG, Yahoo SI=F as last resort) ·
   gold/silver ratio (gold = candle-chain last close, else gold-api.com XAU).
   realRateHint: falling DXY + falling yields = TAILWIND for gold;
   both rising = HEADWIND; anything else (or missing data) = NEUTRAL. */
async function getGoldMacro(){
  try{
    const hit = __macroCacheGet('macro'); if (hit !== undefined) return hit;

    const dxy = await getDXY(); // {value, date, trend20, change20Pct} | null
    const dxyOfficial = await getDXYOfficial();
    const realYield = await getRealYield10Y();
    let dfii10Rows = null;
    try{
      dfii10Rows = await __fredSeries('DFII10', 30);
    }catch(eDf){ dfii10Rows = null; }
    let t10yieRows = null;
    try{
      t10yieRows = await __fredSeries('T10YIE', 30);
    }catch(eBe){ t10yieRows = null; }

    // US10Y: FRED DGS10 primary (in getUST10Y); Treasury CSV; Yahoo ^TNX last resort.
    let tnx = null, tnxTrend = null, tnxChange20Pct = null;
    const ust = await getUST10Y();
    if (ust && isFinite(ust.value)){
      tnx = ust.value; tnxTrend = ust.trend20; tnxChange20Pct = ust.change20Pct;
    } else {
      try{
        // Legacy Yahoo served yield x10 (45.4 -> 4.54%); the current v8 chart API
        // serves the yield directly (4.543). Scale adaptively: values > 20 are
        // treated as x10, anything else is already the yield.
        const tnxRows = await __yahooLastClose('^TNX', '1mo');
        if (tnxRows && tnxRows.length){
          const lastC = tnxRows[tnxRows.length - 1].c;
          if (isFinite(lastC)) tnx = (lastC > 20) ? lastC/10 : lastC;
          if (tnxRows.length >= 5){
            const firstC = tnxRows[0].c; // ~20 trading days back on a 1mo pull
            if (isFinite(firstC) && firstC > 0 && isFinite(lastC)){
              tnxChange20Pct = (lastC/firstC - 1)*100; // relative move in the yield itself
              tnxTrend = tnxChange20Pct > 2 ? 'RISING' : (tnxChange20Pct < -2 ? 'FALLING' : 'FLAT');
            }
          }
        }
      }catch(e){}
    }

    // Silver: gold-api.com XAG primary; Yahoo SI=F via /api/proxy last resort.
    let silver = null;
    const xag = await __goldApiPrice('XAG');
    if (xag) silver = xag.price;
    if (silver === null){
      try{
        const siRows = await __yahooLastClose('SI=F', '5d');
        if (siRows && siRows.length){
          const c = siRows[siRows.length - 1].c;
          if (isFinite(c)) silver = c;
        }
      }catch(e){}
    }

    // Gold for the ratio: candle-chain last close (XAUUSDT -> PAXG -> TD -> Yahoo),
    // else gold-api.com XAU spot.
    let goldPx = null;
    try{
      const g = await getGoldCandles('1d', 5);
      if (g && g.rows && g.rows.length){
        const c = g.rows[g.rows.length - 1].c;
        if (isFinite(c) && c > 0) goldPx = c;
      }
    }catch(e){}
    if (goldPx === null){
      const xau = await __goldApiPrice('XAU');
      if (xau) goldPx = xau.price;
    }
    const goldSilverRatio = (goldPx !== null && silver !== null && silver > 0) ? goldPx/silver : null;

    const dxyDown = !!(dxy && dxy.trend20 === 'FALLING'), dxyUp = !!(dxy && dxy.trend20 === 'RISING');
    const tnxDown = (tnxTrend === 'FALLING'), tnxUp = (tnxTrend === 'RISING');
    const realDown = !!(realYield && realYield.trend20 === 'FALLING');
    const realUp = !!(realYield && realYield.trend20 === 'RISING');
    let realRateHint = 'NEUTRAL';
    if ((realDown && (dxyDown || tnxDown)) || (dxyDown && tnxDown)) realRateHint = 'TAILWIND';
    else if ((realUp && (dxyUp || tnxUp)) || (dxyUp && tnxUp)) realRateHint = 'HEADWIND';

    var realRateMeasured = null;
    var realRateSource = 'hint';
    try{
      if (typeof hgRealRate === 'function'){
        realRateMeasured = hgRealRate({ dfii10Rows: dfii10Rows, t10yieRows: t10yieRows });
      }else if (dfii10Rows && dfii10Rows.length){
        /* __fredSeries reverses FRED (newest-first) to oldest-first, so the
           LATEST observation is the LAST element — read from the end. */
        var dfLast = dfii10Rows.length - 1;
        var lvl = dfii10Rows[dfLast].value;
        var chg20 = (dfii10Rows.length > 20) ? lvl - dfii10Rows[dfLast - 20].value : null;
        var tr = 'FLAT';
        if (chg20 !== null){ if (chg20 <= -0.05) tr = 'FALLING'; else if (chg20 >= 0.05) tr = 'RISING'; }
        realRateMeasured = { level: lvl, chg20d: chg20, trend: tr, asOf: dfii10Rows[dfLast].date, measured: true, stale: false, source: 'fred-dfii10' };
      }
      if (realRateMeasured && realRateMeasured.measured){
        realRateSource = 'fred-dfii10';
        if (realRateMeasured.trend === 'FALLING') realRateHint = 'TAILWIND';
        else if (realRateMeasured.trend === 'RISING') realRateHint = 'HEADWIND';
        else realRateHint = 'NEUTRAL';
      }
    }catch(eRR){ realRateMeasured = null; }

    /* FRED DFII10 is often unconfigured. getRealYield10Y already read the
       keyless Treasury TIPS curve into realYield. Copy that measured print
       so a missing FRED key is not reported as an unread real yield. */
    if (!(realRateMeasured && realRateMeasured.measured) && realYield && isFinite(+realYield.value) && realYield.trend20){
      realRateMeasured = {
        level: +realYield.value,
        chg20d: null,
        trend: String(realYield.trend20),
        asOf: realYield.date || null,
        measured: true,
        stale: false,
        source: realYield.source || 'treasury-tips'
      };
      realRateSource = realRateMeasured.source;
      if (realRateMeasured.trend === 'FALLING') realRateHint = 'TAILWIND';
      else if (realRateMeasured.trend === 'RISING') realRateHint = 'HEADWIND';
      else realRateHint = 'NEUTRAL';
    }

    /* Free Yahoo reads. Used when FRED and the Treasury CSV are both dark,
       and always for silver, the gold/silver ratio, VIX and USDJPY. */
    let silverTrend = null, gsRatioTrend = null, vixTrend = null, usdjpyTrend = null;
    /* hg-v1163: the three free Yahoo legs hg-v1158's census named as "free
       on Yahoo and not fetched" -- the gold vol index ^GVZ (its level and 20d
       trend; a 1-sigma one-day move follows from the level), the gold-SPX
       20-day return correlation (^GSPC against GC=F: positive reads gold as
       a risk asset, negative as the haven) and the gold-BTC 20-day return
       correlation (BTC-USD, which trades the days gold does not; aligned by
       UTC date). Reads, never scores: the ranker marks them and tallies
       nothing on them until the forward ledger has measured whether any of
       them separates. */
    let gvzTrend = null, gvzLast = null, vixLast = null, goldSpxCorr20 = null, goldBtcCorr20 = null;
    /* hg-v1165: four more free Yahoo legs a gold trader reads and this stack
       never fetched -- the gold miners against gold (GDX / GC=F, the miners
       lead the metal when the bid is real), gold against copper (GC=F / HG=F,
       the haven-versus-growth ratio), gold against crude (GC=F / CL=F) and
       EURUSD (the dollar's other side). Each is a 20-day ratio or level trend
       through the same band every other leg reads; reads, never scores. */
    let minersGoldTrend = null, goldCopperTrend = null, goldOilTrend = null, eurusdTrend = null;
    /* hg-v1166: four more. TIP (the iShares TIPS ETF: its price rises as real
       yields fall, the one free daily real-rate read beside FRED), gold
       against platinum (GC=F / PL=F, the haven-versus-industrial-metal ratio
       the copper leg reads from the other side), USDCNY=X (the yuan, the
       largest physical bid's currency) and the 10y-minus-3m slope (^TNX -
       ^IRX: 10y/2y is not free on Yahoo; said in the catalog). */
    let tipTrend = null, goldPlatinumTrend = null, usdcnyTrend = null, curveSlopeTrend = null, curveSlopeChg = null;
    /* hg-v1167: three more. Credit appetite (HYG / LQD, high yield against
       investment grade: the ratio rises when risk is being bought), gold
       against palladium (GC=F / PA=F, the other platinum-group ratio) and the
       GLD volume print -- the SPDR gold ETF's last COMPLETE session against
       its prior 20 sessions. Volume is participation, not tonnage; the
       catalog's ETF-flows row stays unchecked and says so. */
    let creditTrend = null, goldPalladiumTrend = null, gldVolumeRel = null, gldVolumeState = null;
    /* hg-v1171: three more free Yahoo legs beside the hg-v1167 set. TLT
       is the iShares 20+Y Treasury ETF -- its price rises when long yields
       fall, which lifts gold (WITH a long when RISING); DIFFERENT from the
       hg-v1166 TIP, which is TIPS (real yields), so no duplicated port
       (hg-v949). UUP is the dollar bull ETF -- rising dollar is AGAINST a
       gold long (WITH when FALLING), a direct-market read of the dollar
       distinct from the Frankfurter DXY calculation above and from the
       USDJPY / USDCNY crosses (which are single pairs, not the index).
       AUD=X is USD/AUD -- Australia is the world's largest gold producer,
       so AUD strength (USD/AUD FALLING) is a producer-currency bid WITH a
       gold long. */
    let tltTrend = null, uupTrend = null, audusdTrend = null;
    try{
      const free = await Promise.all([
        __yahooLastClose('SI=F', '1mo'),
        __yahooLastClose('GC=F', '1mo'),
        __yahooLastClose('^VIX', '5d'),
        __yahooLastClose('JPY=X', '5d'),
        __yahooLastClose('^TNX', '1mo'),
        __yahooLastClose('^T10YIE', '1mo'),
        __yahooLastClose('^GVZ', '1mo'),
        __yahooLastClose('^GSPC', '1mo'),
        __yahooLastClose('BTC-USD', '1mo'),
        __yahooLastClose('GDX', '1mo'),
        __yahooLastClose('HG=F', '1mo'),
        __yahooLastClose('CL=F', '1mo'),
        __yahooLastClose('EURUSD=X', '1mo'),
        __yahooLastClose('TIP', '1mo'),
        __yahooLastClose('PL=F', '1mo'),
        __yahooLastClose('USDCNY=X', '1mo'),
        __yahooLastClose('^IRX', '1mo'),
        __yahooLastClose('HYG', '1mo'),
        __yahooLastClose('LQD', '1mo'),
        __yahooLastClose('PA=F', '1mo'),
        __yahooLastClose('GLD', '3mo'),
        /* hg-v1171: TLT (long bonds), UUP (dollar ETF), AUD=X (producer currency) */
        __yahooLastClose('TLT', '1mo'),
        __yahooLastClose('UUP', '1mo'),
        __yahooLastClose('AUD=X', '1mo')
      ]);
      function chgOf(rows){
        if (!rows || rows.length < 5) return null;
        const a = +rows[0].c, b = +rows[rows.length - 1].c;
        if (!(a > 0) || !isFinite(b)) return null;
        const chg = (b - a) / a;
        return { chg: chg, trend: chg > 0.01 ? 'RISING' : (chg < -0.01 ? 'FALLING' : 'FLAT'), last: b, first: a };
      }
      function yld(v){ return v > 20 ? v / 10 : v; }
      const si = chgOf(free[0]);
      const gc = chgOf(free[1]);
      const vx = chgOf(free[2]);
      const jy = chgOf(free[3]);
      if (si) silverTrend = si.trend;
      if (vx){ vixTrend = vx.trend; vixLast = vx.last; }
      if (jy) usdjpyTrend = jy.trend;
      const gz = chgOf(free[6]);
      if (gz){ gvzTrend = gz.trend; gvzLast = gz.last; }
      goldSpxCorr20 = __corrDailyReturns(free[1], free[7], 20);
      goldBtcCorr20 = __corrDailyReturns(free[1], free[8], 20);
      /* hg-v1165: a ratio's 20-day change through the one band (the gold/
         silver ratio's own arithmetic, stated once); null when either leg is
         dark or a first close is not positive */
      function ratioTrendOf(num, den){
        const a = chgOf(num), b = chgOf(den);
        if (!a || !b || !(a.first > 0) || !(b.first > 0) || !(a.last > 0) || !(b.last > 0)) return null;
        const thenR = a.first / b.first, nowR = a.last / b.last;
        const rchg = (nowR - thenR) / thenR;
        return rchg > 0.01 ? 'RISING' : (rchg < -0.01 ? 'FALLING' : 'FLAT');
      }
      minersGoldTrend = ratioTrendOf(free[9], free[1]);
      goldCopperTrend = ratioTrendOf(free[1], free[10]);
      goldOilTrend = ratioTrendOf(free[1], free[11]);
      const eu = chgOf(free[12]);
      if (eu) eurusdTrend = eu.trend;
      /* hg-v1166 */
      const tp = chgOf(free[13]);
      if (tp) tipTrend = tp.trend;
      goldPlatinumTrend = ratioTrendOf(free[1], free[14]);
      const cn = chgOf(free[15]);
      if (cn) usdcnyTrend = cn.trend;
      /* the slope in yield points: a 20-day change of a tenth of a point or
         more steepens or flattens; inside it the curve read is FLAT. ^IRX is
         a discount yield in percent like ^TNX; both pass the same yld() */
      if (free[4] && free[16] && free[4].length >= 5 && free[16].length >= 5){
        const t0 = yld(+free[4][0].c), t1 = yld(+free[4][free[4].length - 1].c);
        const i0 = yld(+free[16][0].c), i1 = yld(+free[16][free[16].length - 1].c);
        if ([t0, t1, i0, i1].every(function(v){ return isFinite(v); })){
          curveSlopeChg = (t1 - i1) - (t0 - i0);
          curveSlopeTrend = curveSlopeChg >= 0.10 ? 'STEEPENING' : (curveSlopeChg <= -0.10 ? 'FLATTENING' : 'FLAT');
        }
      }
      /* hg-v1167 */
      creditTrend = ratioTrendOf(free[17], free[18]);
      goldPalladiumTrend = ratioTrendOf(free[1], free[19]);
      const gv = __lastCompleteVolumeRel(free[20], 20, Date.now());
      if (gv !== null){
        gldVolumeRel = gv;
        gldVolumeState = gv >= 1.5 ? 'HIGH' : (gv <= 0.5 ? 'LOW' : 'NORMAL');
      }
      /* hg-v1171: TLT, UUP, AUD=X -- each a 20-day trend through the one
         chgOf band (+/-1% / FLAT inside), null when the leg is dark or the
         first close is not positive */
      const tl = chgOf(free[21]);
      if (tl) tltTrend = tl.trend;
      const uu = chgOf(free[22]);
      if (uu) uupTrend = uu.trend;
      const ad = chgOf(free[23]);
      if (ad) audusdTrend = ad.trend;
      if (si && gc && si.first > 0 && si.last > 0){
        const thenR = gc.first / si.first, nowR = gc.last / si.last;
        const rchg = (nowR - thenR) / thenR;
        gsRatioTrend = rchg > 0.01 ? 'RISING' : (rchg < -0.01 ? 'FALLING' : 'FLAT');
      }
      if (!(realRateMeasured && realRateMeasured.measured) && free[4] && free[5] && free[4].length >= 5 && free[5].length >= 5){
        const n0 = yld(+free[4][0].c), n1 = yld(+free[4][free[4].length - 1].c);
        const b0 = yld(+free[5][0].c), b1 = yld(+free[5][free[5].length - 1].c);
        if ([n0, n1, b0, b1].every(function(v){ return isFinite(v); })){
          const chg = (n1 - b1) - (n0 - b0);
          const trend = chg <= -0.05 ? 'FALLING' : (chg >= 0.05 ? 'RISING' : 'FLAT');
          realRateMeasured = { level: n1 - b1, chg20d: chg, trend: trend, asOf: null, measured: true, stale: false, source: 'yahoo-tnx-breakeven' };
          realRateSource = 'yahoo-tnx-breakeven';
          if (trend === 'FALLING') realRateHint = 'TAILWIND';
          else if (trend === 'RISING') realRateHint = 'HEADWIND';
          else realRateHint = 'NEUTRAL';
        }
      }
    }catch(eFree){}

    /* hg-v966: the series for the EMA50 read. Fetched in parallel and fully
       fail-open -- a null here restores exactly the pre-hg-v966 situation, in
       which the level test simply cannot be taken. */
    let dxyRows = null, tnxRows = null;
    try{
      const pair = await Promise.all([
        getDXYRows(270).catch(function(){ return null; }),
        getTNXRows('1y').catch(function(){ return null; })
      ]);
      dxyRows = pair[0] || null;
      tnxRows = pair[1] || null;
    }catch(eRows){ dxyRows = null; tnxRows = null; }

    return __macroCachePut('macro', {
      dxy: dxy,
      dxyRows: dxyRows,
      tnxRows: tnxRows,
      dxyOfficial: dxyOfficial,
      tnx: tnx,
      tnxTrend: tnxTrend,
      tnxChange20Pct: tnxChange20Pct,
      tnxSource: (ust && ust.source) ? ust.source : (tnx !== null ? 'yahoo' : null),
      realYield10Y: realYield ? realYield.value : null,
      realYieldTrend: realYield ? realYield.trend20 : null,
      realYieldChange20Pct: realYield ? realYield.change20Pct : null,
      silver: silver,
      goldPx: goldPx,
      goldSilverRatio: goldSilverRatio,
      realRateHint: realRateHint,
      realRateMeasured: realRateMeasured,
      realRateSource: realRateSource,
      dfii10Rows: dfii10Rows,
      silverTrend: silverTrend,
      gsRatioTrend: gsRatioTrend,
      vixTrend: vixTrend,
      usdjpyTrend: usdjpyTrend,
      /* hg-v1163 */
      gvzTrend: gvzTrend,
      gvzLast: gvzLast,
      vixLast: vixLast,
      goldSpxCorr20: goldSpxCorr20,
      goldBtcCorr20: goldBtcCorr20,
      /* hg-v1165 */
      minersGoldTrend: minersGoldTrend,
      goldCopperTrend: goldCopperTrend,
      goldOilTrend: goldOilTrend,
      eurusdTrend: eurusdTrend,
      /* hg-v1166 */
      tipTrend: tipTrend,
      goldPlatinumTrend: goldPlatinumTrend,
      usdcnyTrend: usdcnyTrend,
      curveSlopeTrend: curveSlopeTrend,
      curveSlopeChg: curveSlopeChg,
      /* hg-v1167 */
      creditTrend: creditTrend,
      goldPalladiumTrend: goldPalladiumTrend,
      gldVolumeRel: gldVolumeRel,
      gldVolumeState: gldVolumeState,
      /* hg-v1171 */
      tltTrend: tltTrend,
      uupTrend: uupTrend,
      audusdTrend: audusdTrend
    });
  }catch(e){
    return { dxy: null, dxyRows: null, tnxRows: null,
             dxyOfficial: null, tnx: null, tnxTrend: null, tnxChange20Pct: null,
             tnxSource: null, realYield10Y: null, realYieldTrend: null, realYieldChange20Pct: null,
             silver: null, goldPx: null, goldSilverRatio: null, realRateHint: 'NEUTRAL',
             realRateMeasured: null, realRateSource: 'hint' };
  }
}

/* Paper-book plan from real-rate hint — TAILWIND long gold, HEADWIND short;
   1% price risk, 2R T1. Returns null when NEUTRAL or goldPx missing. */
function macroGoldPlan(macro){
  try{
    if (!macro || !macro.realRateHint || macro.realRateHint === 'NEUTRAL') return null;
    var goldPx = macro.goldPx;
    if (!isFinite(goldPx) || !(goldPx > 0)) return null;
    var dir = macro.realRateHint === 'TAILWIND' ? 'long' : 'short';
    var risk = goldPx * 0.01;
    var entry = goldPx;
    var stop = dir === 'long' ? entry - risk : entry + risk;
    var t1 = dir === 'long' ? entry + 2 * risk : entry - 2 * risk;
    var t2 = dir === 'long' ? entry + 3 * risk : entry - 3 * risk;
    return { sym: 'XAUUSD', dir: dir, entry: entry, stop: stop, t1: t1, t2: t2, hint: macro.realRateHint };
  }catch(e){ return null; }
}

/* Sync read of the last getGoldMacro() result — for brain snapshotLayers only. */
function getGoldMacroCached(){
  try{ return __macroCacheGet('macro') || null; }catch(e){ return null; }
}

if (typeof window !== 'undefined'){
  window.macroGoldPlan = macroGoldPlan;
  window.getGoldMacroCached = getGoldMacroCached;
  window.hgCorrDailyReturns = __corrDailyReturns;   /* hg-v1163: pure, exported for the guard */
  window.getSilverCandles = getSilverCandles;
  window.getUST10YCandles = getUST10YCandles;
}
