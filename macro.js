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
        if (rows && rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'binance-xau' });
      }
    }catch(e){}

    // 2) Binance PAXGUSDT perp — tokenized gold fallback (tracks spot within ~0.5%)
    try{
      if (typeof binanceKlines === 'function' && GOLD_RES_BINANCE[res]){
        const rows = await binanceKlines('PAXGUSDT', GOLD_RES_BINANCE[res], count);
        if (rows && rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'binance-paxg' });
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
          if (rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'twelvedata' });
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
        if (rows.length) return __macroCachePut(key, { rows: rows.slice(-count), source: 'yahoo' });
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
async function __yahooLastClose(symbol, range){
  try{
    const rows = __parseYahooChart(await __yahooViaProxy(
      'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?interval=1d&range=' + (range || '1mo')));
    return rows.length ? rows : null;
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
        var lvl = dfii10Rows[0].value;
        var chg20 = (dfii10Rows.length > 20) ? lvl - dfii10Rows[20].value : null;
        var tr = 'FLAT';
        if (chg20 !== null){ if (chg20 <= -0.05) tr = 'FALLING'; else if (chg20 >= 0.05) tr = 'RISING'; }
        realRateMeasured = { level: lvl, chg20d: chg20, trend: tr, asOf: dfii10Rows[0].date, measured: true, stale: false, source: 'fred-dfii10' };
      }
      if (realRateMeasured && realRateMeasured.measured){
        realRateSource = 'fred-dfii10';
        if (realRateMeasured.trend === 'FALLING') realRateHint = 'TAILWIND';
        else if (realRateMeasured.trend === 'RISING') realRateHint = 'HEADWIND';
        else realRateHint = 'NEUTRAL';
      }
    }catch(eRR){ realRateMeasured = null; }

    return __macroCachePut('macro', {
      dxy: dxy,
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
      dfii10Rows: dfii10Rows
    });
  }catch(e){
    return { dxy: null, dxyOfficial: null, tnx: null, tnxTrend: null, tnxChange20Pct: null,
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
  window.getSilverCandles = getSilverCandles;
  window.getUST10YCandles = getUST10YCandles;
}
