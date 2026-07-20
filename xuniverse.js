/* =========================================================================
HARDGATE — xuniverse.js
CROSS-EXCHANGE UNIVERSE + CANDLE ROUTER (library module — registers NO tab).

One call returns the COMBINED Delta Exchange India + CoinDCX futures
universe so the EXECUTE gate engine (engine.js) and the BRAIN meta-engine
(brain.js) can scan every contract on both venues instead of the old ~30
Binance top-24 fallback. Liquidity gating is left to consumers — this
module NEVER silently truncates the list; it only merges, dedupes by base
asset and reports honestly.

EXPORTS (all on window, all feature-checkable, none ever throw):
  window.xuUniverse(force?) -> Promise<Array<{
      sym, base, exchange:'delta'|'coindcx',
      turnoverUsd:number|null, mark:number|null, fundingPct:number|null,
      oiUsd:number|null, oiContracts:number|null,   -- Delta-native OI when
      the venue reports it (oi_value_usd / oi_contracts); null on CoinDCX
      and on Delta rows that omit the fields — never fabricated --
      alsoOn:string|null }>>
      Fetches BOTH legs with per-leg Promise.allSettled degradation: one
      exchange down -> the other's full list with an honest note. Total
      outage -> the last good cached universe when one exists (stale-data
      note), else []. 15-minute cache; force === true bypasses it.
  window.xuCandles(item, tf, n) -> Promise<rows [{t,o,h,l,c,v}] asc>
      Routes by item.exchange. Delta: direct GET (CORS-proven by the app),
      t = bar-open time in SECONDS. CoinDCX: same-origin /api/proxy wrap,
      candle time ms -> floored to seconds. Unknown tf/exchange or any
      failure -> [] (never throws). Mirrors index.html candlesDelta /
      candlesCdcx field mapping verbatim; still-forming-bar dropping stays
      with consumers (same as the app's raw candle fetchers).
  window.xuMerge(deltaRows, cdcxRows) -> pure merge of normalized rows.
      Dedupe by base asset (BTCUSD/BTCUSDT and B-BTC_USDT are the same
      asset): the higher-known-turnover venue becomes the primary entry,
      alsoOn carries the other venue's symbol. Turnover known beats
      unknown; unknown on BOTH -> prefer delta. Sorted turnover-desc,
      unknowns last (base alpha tiebreak). Nothing is dropped — output
      length == number of unique base assets across both inputs.
  window.xuNormDelta(raw) / window.xuNormCdcx(raw) -> pure payload
      normalizers. Field names mirror index.html loadTickersDelta /
      loadTickersCdcx exactly (mark_price??close, funding_rate percent
      units NO *100, turnover_usd??turnover, oi_value_usd??oi_value,
      oi_contracts??oi; cdcx items string|{symbol}, funding/OI honestly
      null — CoinDCX exposes no such fields on its list endpoint).
      Unparseable numbers become null, rows are kept.
  window.xuMergeCdcxMarks(rows, body) -> pure {rows, count}. CoinDCX
      mark/turnover companion merge: takes normalized cdcx rows + the
      parsed current_prices/futures/rt body ({prices:{SYM:{mp,ls,v,...}}}
      or a bare {SYM:...} map; a plain string/number price per symbol is
      also accepted) and returns a NEW rows array with mark (mp??ls) and
      turnoverUsd (v) filled where the venue reports them. fundingPct
      stays null — the endpoint's fr units are unverified, so we never
      convert or invent them. Input rows are never mutated.
  window.xuPositioning(baseOrSym) -> {sym, base, fundingPct, oiUsd, mark,
      exchange} | null. Per-venue native positioning lookup against the
      CACHED universe (no network): accepts a base ('BTC'), a Delta sym
      ('BTCUSD') or a CoinDCX sym ('B-BTC_USDT'). Delta rows win (they
      carry native funding+OI); CoinDCX rows answer with mark only and
      fundingPct/oiUsd honestly null. null before the first completed
      fetch, for unknown assets, and on any error — never throws.
  window.xuState() -> {count, delta, cdcx, cdcxMarks, at, note} | null
      null before the first completed fetch attempt; otherwise the last
      attempt's merged count, raw per-leg fetch counts (delta/cdcx), how
      many CoinDCX rows got a live mark merged (cdcxMarks), the epoch-ms
      timestamp and the current honest note (or null).
  window.xuUniverseNote() -> string | null
      The degradation note from the last xuUniverse call, null when both
      legs were healthy.

DATA PATHS (verified against index.html ~line 744-786):
  Delta perps:   GET https://api.india.delta.exchange/v2/tickers?contract_types=perpetual_futures  (direct)
  Delta candles: GET https://api.india.delta.exchange/v2/history/candles?resolution=<DELTA_RES>&symbol=&start=&end=
                 -> {result:[{time,open,high,low,close,volume}]}, time seconds
  CoinDCX list:  GET https://api.coindcx.com/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT
                 via /api/proxy?url=<encoded>
  CoinDCX marks: GET https://public.coindcx.com/market_data/v3/current_prices/futures/rt
                 via /api/proxy -> {ts, vs, prices:{SYM:{mp,ls,v,fr,...}}}
                 Companion leg only — merged into cdcx rows when it works,
                 honest nulls + a note when it fails; never blocks the
                 universe. v = 24h USDT turnover (verified live), mp = mark.
  CoinDCX candles: GET https://public.coindcx.com/market_data/candlesticks?pair=&from=&to=&resolution=<CDCX_RES>&pcode=f
                 via /api/proxy -> {data:[{time(ms),open,high,low,close,volume}]}
  DELTA_RES = {'15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d'}
  CDCX_RES  = {'15m':'15','1h':'60','2h':'120','4h':'240','1d':'1D'}

Every fetch carries a 12s AbortController timeout (feature-checked — plain
fetch when AbortController is unavailable). Classic script, no build step.
Loads BEFORE engine.js / brain.js so they can feature-check
typeof window.xuUniverse === 'function' and degrade to today's behavior
when this module is absent. Never throws at load.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- constants mirrored from index.html ---------------- */
var DELTA    = 'https://api.india.delta.exchange';
var CDCX_PUB = 'https://public.coindcx.com';
var CDCX_API = 'https://api.coindcx.com';
var CDCX_PROXY = function(u){ return '/api/proxy?url=' + encodeURIComponent(u); };
var DELTA_RES = {'15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d'};
var CDCX_RES  = {'15m':'15','1h':'60','2h':'120','4h':'240','1d':'1D'};
var SEC_PER   = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400};

var CACHE_MS     = 15 * 60 * 1000; // 15-minute universe cache
var FETCH_TIMEOUT = 12000;         // 12s abort per network leg

/* ---------------- module-local state ---------------- */
var cache = null;   // {rows, at, deltaCount, cdcxCount, note}
var lastNote = null;
var inflight = null; // busy-guard: concurrent xuUniverse calls share one fetch

function nowSec(){ return Math.floor(Date.now()/1000); }
function numOrNull(x){
  var n = parseFloat(x);
  return isFinite(n) ? n : null;
}

/* 12s abort timeout, feature-checked; plain fetch when AbortController or
   fetch itself is missing (missing fetch rejects so allSettled degrades). */
function timedFetch(url){
  if (typeof fetch !== 'function') return Promise.reject(new Error('fetch unavailable'));
  if (typeof AbortController !== 'function') return fetch(url);
  var ctl = new AbortController();
  var to = setTimeout(function(){ try{ ctl.abort(); }catch(e){} }, FETCH_TIMEOUT);
  return fetch(url, { signal: ctl.signal }).then(function(r){
    clearTimeout(to);
    return r;
  }, function(err){
    clearTimeout(to);
    throw err;
  });
}

/* ---------------- base-asset mapping ----------------
   index.html searchBase: delta sym.replace(/USD$/,''), cdcx
   sym.replace(/^B-/,'').replace(/_USDT$/,''). Extended to also strip a
   USDT suffix so 'BTCUSDT' and 'BTCUSD' map to the same base. */
function baseOf(sym, exchange){
  var s = String(sym == null ? '' : sym).toUpperCase();
  if (exchange === 'coindcx') return s.replace(/^B-/, '').replace(/_USDT$/, '');
  return s.replace(/USD(T)?$/, '');
}

/* ---------------- pure normalizers (vm-testable) ---------------- */
/* raw = parsed Delta /v2/tickers body ({result:[...]}) or a bare array.
   Field names mirror index.html loadTickersDelta verbatim; rows whose
   numbers won't parse are KEPT with nulls (consumers gate, we never drop).
   oiUsd mirrors loadTickersDelta's oi_value_usd ?? oi_value precedence —
   null (never 0) when the venue omits it. oiContracts = oi_contracts ?? oi. */
function xuNormDelta(raw){
  try{
    var arr = Array.isArray(raw) ? raw
            : (raw && Array.isArray(raw.result)) ? raw.result : [];
    var out = [];
    for (var i = 0; i < arr.length; i++){
      var t = arr[i];
      if (!t || !t.symbol) continue;
      var sym = String(t.symbol);
      out.push({
        sym: sym,
        base: baseOf(sym, 'delta'),
        exchange: 'delta',
        turnoverUsd: numOrNull(t.turnover_usd !== undefined && t.turnover_usd !== null ? t.turnover_usd : t.turnover),
        mark: numOrNull(t.mark_price !== undefined && t.mark_price !== null ? t.mark_price : t.close),
        fundingPct: (t.funding_rate !== undefined && t.funding_rate !== null) ? numOrNull(t.funding_rate) : null, // Delta India: percent units per interval. NO *100.
        oiUsd: numOrNull(t.oi_value_usd !== undefined && t.oi_value_usd !== null ? t.oi_value_usd : t.oi_value),
        oiContracts: numOrNull(t.oi_contracts !== undefined && t.oi_contracts !== null ? t.oi_contracts : t.oi),
        alsoOn: null
      });
    }
    return out;
  }catch(e){ return []; }
}

/* raw = parsed CoinDCX active_instruments body (bare array or
   {instruments:[...]}); items are symbol strings or {symbol}. CoinDCX
   exposes no mark/funding/turnover/OI on this endpoint — honest nulls;
   marks/turnover get merged in afterwards by xuMergeCdcxMarks when the
   companion current_prices leg succeeds. */
function xuNormCdcx(raw){
  try{
    var list = Array.isArray(raw) ? raw
             : (raw && Array.isArray(raw.instruments)) ? raw.instruments : [];
    var out = [];
    for (var i = 0; i < list.length; i++){
      var s = list[i];
      var sym = (typeof s === 'string') ? s : (s && s.symbol);
      if (!sym) continue;
      sym = String(sym);
      out.push({
        sym: sym,
        base: baseOf(sym, 'coindcx'),
        exchange: 'coindcx',
        turnoverUsd: null,
        mark: null,
        fundingPct: null,
        oiUsd: null,
        oiContracts: null,
        alsoOn: null
      });
    }
    return out;
  }catch(e){ return []; }
}

/* raw = parsed CoinDCX current_prices/futures/rt body. Pure companion
   merge: {prices:{SYM:{mp,ls,v,...}}} or a bare {SYM:{...}|number} map.
   mark <- mp ?? ls, turnoverUsd <- v (24h USDT turnover on this endpoint).
   fundingPct is NOT touched — the fr units there are unverified and the
   house rule is evidence, not guesses. Returns a NEW array; unmatched or
   unparseable symbols keep their honest nulls. Never throws. */
function xuMergeCdcxMarks(rows, body){
  try{
    var src = (body && body.prices && typeof body.prices === 'object') ? body.prices
            : (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
    var count = 0;
    var out = [];
    for (var i = 0; i < (rows || []).length; i++){
      var r = rows[i];
      var p = (r && r.sym) ? src[r.sym] : null;
      var mark = null, to = null;
      if (p !== null && p !== undefined){
        if (typeof p === 'object'){
          mark = numOrNull(p.mp !== undefined && p.mp !== null ? p.mp : p.ls);
          to = numOrNull(p.v);
        } else {
          mark = numOrNull(p); /* bare string/number price form */
        }
      }
      if (mark === null && to === null){ out.push(r); continue; }
      var o = {};
      for (var k in r) o[k] = r[k];
      if (mark !== null) o.mark = mark;
      if (to !== null) o.turnoverUsd = to;
      out.push(o);
      count++;
    }
    return { rows: out, count: count };
  }catch(e){ return { rows: rows || [], count: 0 }; }
}

/* ---------------- pure cross-exchange merge (vm-testable) ----------------
   Dedupe by base asset. Known turnover beats unknown; both known -> higher
   venue wins; both unknown -> prefer delta. alsoOn = other venue's symbol.
   Output sorted turnover-desc, unknowns last, base alpha tiebreak. */
function xuMerge(deltaRows, cdcxRows){
  try{
    var byBase = {}; // base -> entry
    var order = [];
    function num(x){ return (typeof x === 'number' && isFinite(x)) ? x : null; }
    function consider(row){
      if (!row || !row.base) return;
      var cur = byBase[row.base];
      if (!cur){
        byBase[row.base] = {
          sym: row.sym, base: row.base, exchange: row.exchange,
          turnoverUsd: num(row.turnoverUsd),
          mark: num(row.mark),
          fundingPct: num(row.fundingPct),
          oiUsd: num(row.oiUsd),
          oiContracts: num(row.oiContracts),
          alsoOn: null
        };
        order.push(row.base);
        return;
      }
      var ct = cur.turnoverUsd, rt = num(row.turnoverUsd);
      var rowWins = (rt !== null && ct === null) || (rt !== null && ct !== null && rt > ct);
      var otherVenue = cur.exchange !== row.exchange;
      if (rowWins){
        if (otherVenue) cur.alsoOn = cur.sym; // displaced primary becomes the alternate venue
        cur.sym = row.sym; cur.exchange = row.exchange;
        cur.turnoverUsd = rt;
        cur.mark = num(row.mark);
        cur.fundingPct = num(row.fundingPct);
        cur.oiUsd = num(row.oiUsd);
        cur.oiContracts = num(row.oiContracts);
      } else if (cur.sym !== row.sym){
        if (otherVenue && cur.alsoOn === null) cur.alsoOn = row.sym;
        /* fill gaps honestly from the secondary venue */
        if (cur.mark === null && num(row.mark) !== null) cur.mark = num(row.mark);
        if (cur.fundingPct === null && num(row.fundingPct) !== null) cur.fundingPct = num(row.fundingPct);
        if (cur.oiUsd === null && num(row.oiUsd) !== null) cur.oiUsd = num(row.oiUsd);
        if (cur.oiContracts === null && num(row.oiContracts) !== null) cur.oiContracts = num(row.oiContracts);
        if (ct === null && rt !== null) cur.turnoverUsd = rt;
      }
    }
    /* delta first: when turnover is unknown on BOTH, delta stays primary */
    (deltaRows || []).forEach(consider);
    (cdcxRows || []).forEach(consider);
    var out = order.map(function(b){ return byBase[b]; });
    out.sort(function(a, b){
      var ta = (a.turnoverUsd === null) ? -1 : a.turnoverUsd;
      var tb = (b.turnoverUsd === null) ? -1 : b.turnoverUsd;
      if (tb !== ta) return tb - ta;
      return a.base < b.base ? -1 : (a.base > b.base ? 1 : 0);
    });
    return out;
  }catch(e){ return []; }
}

/* ---------------- network legs ---------------- */
async function fetchDeltaLeg(){
  var r = await timedFetch(DELTA + '/v2/tickers?contract_types=perpetual_futures');
  if (!r || !r.ok) throw new Error('Delta tickers HTTP ' + (r ? r.status : '?'));
  return xuNormDelta(await r.json());
}
async function fetchCdcxLeg(){
  var r = await timedFetch(CDCX_PROXY(CDCX_API + '/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT'));
  if (!r || !r.ok) throw new Error('CoinDCX instruments HTTP ' + (r ? r.status : '?'));
  return xuNormCdcx(await r.json());
}
/* Companion marks leg — CoinDCX futures realtime prices (mark + 24h USDT
   turnover per B-XXX_USDT). Optional by design: its failure must NEVER
   block or empty the universe; callers merge it with xuMergeCdcxMarks and
   surface an honest note instead. */
async function fetchCdcxMarksLeg(){
  var r = await timedFetch(CDCX_PROXY(CDCX_PUB + '/market_data/v3/current_prices/futures/rt'));
  if (!r || !r.ok) throw new Error('CoinDCX marks HTTP ' + (r ? r.status : '?'));
  return r.json();
}

/* ---------------- the combined universe ---------------- */
async function xuUniverse(force){
  try{
    if (!force && cache && (Date.now() - cache.at) < CACHE_MS) return cache.rows;
    if (inflight) return inflight; // busy-guard: share the in-flight fetch
    inflight = (async function(){
      var legs = await Promise.allSettled([fetchDeltaLeg(), fetchCdcxLeg(), fetchCdcxMarksLeg()]);
      var d = legs[0], c = legs[1], mk = legs[2];
      var dRows = d.status === 'fulfilled' ? d.value : [];
      var cRows = c.status === 'fulfilled' ? c.value : [];
      var cdcxMarks = 0, marksNote = null;
      /* marks are a companion: merge when available, honest note when the
         leg failed AND there are cdcx rows that now lack marks. A 200 with
         an unusable payload simply merges nothing (nulls stay null). */
      if (c.status === 'fulfilled'){
        if (mk.status === 'fulfilled'){
          var mm = xuMergeCdcxMarks(cRows, mk.value);
          cRows = mm.rows;
          cdcxMarks = mm.count;
        } else {
          marksNote = 'coindcx marks leg failed: ' + errMsg(mk.reason) + ' — CoinDCX mark/turnover unavailable (nulls, never guesses)';
        }
      }
      var note = null;
      if (d.status !== 'fulfilled' && c.status !== 'fulfilled'){
        if (cache && cache.rows){
          note = 'both exchange legs failed (' + errMsg(d.reason) + '; ' + errMsg(c.reason) + ') — showing last good universe from ' + new Date(cache.at).toISOString();
          lastNote = note;
          return cache.rows; // good data is never replaced by a failed run
        }
        note = 'both exchange legs failed (' + errMsg(d.reason) + '; ' + errMsg(c.reason) + ') — universe empty';
        cache = { rows: [], deltaRows: [], cdcxRows: [], at: Date.now(), deltaCount: 0, cdcxCount: 0, cdcxMarks: 0, note: note };
        lastNote = note;
        return [];
      }
      if (d.status !== 'fulfilled') note = 'delta leg failed: ' + errMsg(d.reason) + ' — CoinDCX contracts only, no Delta funding/OI data';
      if (c.status !== 'fulfilled') note = 'coindcx leg failed: ' + errMsg(c.reason) + ' — Delta India contracts only';
      if (marksNote) note = note ? (note + '; ' + marksNote) : marksNote;
      var rows = xuMerge(dRows, cRows);
      cache = { rows: rows, deltaRows: dRows, cdcxRows: cRows, at: Date.now(), deltaCount: dRows.length, cdcxCount: cRows.length, cdcxMarks: cdcxMarks, note: note };
      lastNote = note;
      return rows;
    })();
    try{
      return await inflight;
    } finally {
      inflight = null;
    }
  }catch(e){
    lastNote = 'universe scan failed: ' + errMsg(e);
    return (cache && cache.rows) ? cache.rows : [];
  }
}
function errMsg(e){ return (e && e.message) ? e.message : String(e); }

/* ---------------- candle router ---------------- */
async function xuCandles(item, tf, n){
  try{
    if (!item || !item.sym) return [];
    var res = DELTA_RES[tf]; // same tf key set on both maps
    var secPer = SEC_PER[tf];
    if (!res || !secPer) return [];
    var count = (isFinite(+n) && +n > 0) ? Math.floor(+n) : 200;
    if (item.exchange === 'coindcx'){
      var to = nowSec(), from = to - secPer * (count + 3);
      var url = CDCX_PUB + '/market_data/candlesticks?pair=' + encodeURIComponent(item.sym) +
                '&from=' + from + '&to=' + to + '&resolution=' + CDCX_RES[tf] + '&pcode=f';
      var r = await timedFetch(CDCX_PROXY(url));
      if (!r || !r.ok) return [];
      var j = await r.json();
      var rows = ((j && j.data) || []).map(function(c){
        return { t: Math.floor((c.time !== undefined && c.time !== null ? c.time : c.t) / 1000),
                 o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +(c.volume !== undefined && c.volume !== null ? c.volume : 0) };
      }).filter(function(c){ return isFinite(c.t); });
      rows.sort(function(a, b){ return a.t - b.t; });
      return rows;
    }
    if (item.exchange === 'delta'){
      var end = nowSec(), start = end - secPer * (count + 3);
      var r2 = await timedFetch(DELTA + '/v2/history/candles?resolution=' + DELTA_RES[tf] +
                                '&symbol=' + encodeURIComponent(item.sym) + '&start=' + start + '&end=' + end);
      if (!r2 || !r2.ok) return [];
      var j2 = await r2.json();
      var rows2 = ((j2 && j2.result) || []).map(function(c){
        return { t: c.time, o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +c.volume };
      }).filter(function(c){ return isFinite(c.t); });
      rows2.sort(function(a, b){ return a.t - b.t; });
      return rows2;
    }
    return [];
  }catch(e){ return []; }
}

/* ---------------- state / note accessors (never throw) ---------------- */
function xuState(){
  try{
    if (!cache) return null;
    return { count: cache.rows.length, delta: cache.deltaCount, cdcx: cache.cdcxCount, cdcxMarks: (cache.cdcxMarks || 0), at: cache.at, note: cache.note };
  }catch(e){ return null; }
}
function xuUniverseNote(){
  try{ return lastNote; }catch(e){ return null; }
}

/* ---------------- per-venue native positioning (cache-only, no network) ----------------
   engine/brain/oiflow feature-check this to use DELTA-native funding+OI for
   a base asset instead of always leaning on Binance proxies. Accepts a base
   ('BTC'), a Delta sym ('BTCUSD') or a CoinDCX sym ('B-BTC_USDT'). Delta
   rows win (native funding + OI); CoinDCX answers mark-only with funding/OI
   honestly null. null before the first fetch, for unknown assets, on error. */
function xuPositioning(baseOrSym){
  try{
    if (!cache) return null;
    var X = String(baseOrSym === null || baseOrSym === undefined ? '' : baseOrSym).toUpperCase();
    if (!X) return null;
    var bD = baseOf(X, 'delta'), bC = baseOf(X, 'coindcx');
    var i, r, dRows = cache.deltaRows || [], cRows = cache.cdcxRows || [];
    for (i = 0; i < dRows.length; i++){
      r = dRows[i];
      if (r.sym === X || r.base === X || r.base === bD || r.base === bC){
        return { sym: r.sym, base: r.base, fundingPct: (typeof r.fundingPct === 'number' ? r.fundingPct : null),
                 oiUsd: (typeof r.oiUsd === 'number' ? r.oiUsd : null),
                 mark: (typeof r.mark === 'number' ? r.mark : null), exchange: 'delta' };
      }
    }
    for (i = 0; i < cRows.length; i++){
      r = cRows[i];
      if (r.sym === X || r.base === X || r.base === bD || r.base === bC){
        return { sym: r.sym, base: r.base, fundingPct: (typeof r.fundingPct === 'number' ? r.fundingPct : null),
                 oiUsd: (typeof r.oiUsd === 'number' ? r.oiUsd : null),
                 mark: (typeof r.mark === 'number' ? r.mark : null), exchange: 'coindcx' };
      }
    }
    return null;
  }catch(e){ return null; }
}

/* ---------------- exports ---------------- */
try{
  G.xuUniverse = xuUniverse;
  G.xuCandles = xuCandles;
  G.xuMerge = xuMerge;
  G.xuNormDelta = xuNormDelta;
  G.xuNormCdcx = xuNormCdcx;
  G.xuMergeCdcxMarks = xuMergeCdcxMarks;
  G.xuPositioning = xuPositioning;
  G.xuState = xuState;
  G.xuUniverseNote = xuUniverseNote;
}catch(e){}

})();
