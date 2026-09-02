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
      sym, base, exchange:'delta'|'coindcx'|'startrader'|'binance',
      turnoverUsd:number|null, mark:number|null, fundingPct:number|null,
      oiUsd:number|null, oiContracts:number|null,   -- Delta-native OI when
      the venue reports it (oi_value_usd / oi_contracts); null on CoinDCX
      and on Delta rows that omit the fields — never fabricated --
      alsoOn:string|null }>>
      Fetches BOTH legs with per-leg Promise.allSettled degradation: one
      exchange down -> the other's full list with an honest note. Delta
      abort/timeout with a prior cache.deltaRows reuses those rows and
      notes "last good Delta" — never invents contracts. Total outage ->
      the last good cached universe when one exists (stale-data note),
      else []. 15-minute cache; force === true bypasses it.
  window.xuCandles(item, tf, n) -> Promise<rows [{t,o,h,l,c,v}] asc>
      Routes by item.exchange. Delta: direct GET (CORS-proven by the app),
      t = bar-open time in SECONDS. CoinDCX: same-origin /api/proxy wrap,
      candle time ms -> floored to seconds. Unknown tf/exchange or any
      failure -> [] (never throws). Mirrors index.html candlesDelta /
      candlesCdcx field mapping verbatim; still-forming-bar dropping stays
      with consumers (same as the app's raw candle fetchers).
      BINANCE FALLBACK: when the venue leg fails or returns fewer rows
      than requested (thin listing) and the base asset trades as a Binance
      USDT perp, window.binanceKlines(base+'USDT', tf, n) serves instead —
      same {t(sec),o,h,l,c,v} asc shape (binance.js normalizes identically).
      Binance rows win ONLY when deeper than the venue's; Binance empty ->
      the venue's honest rows are kept, nothing is ever fabricated. The
      return stays BARE rows; the source is tagged on the debug-only field
      xuCandles.lastSource ('delta'|'coindcx'|'binance-fallback'|null) —
      per-call global state, it RACES under concurrent fetches. Membership:
      window.binancePerpUniverse() at most once per session (guarded);
      when unavailable the kline fetch itself is attempted and an empty
      result reads as "not on Binance". All module tfs map 1:1 onto
      Binance intervals (see BIN_RES).
  window.xuMerge(deltaRows, cdcxRows, ...) -> pure merge of normalized rows
      (2+ leg arrays; backward-compatible two-arg form).
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
  window.xuErrMsg(e) -> string
      Maps AbortError / "aborted without reason" to `timeout >Nms`. Other
      errors stay verbatim. Used by universe notes so Chromium abort noise
      never reaches the desk.

DATA PATHS (verified against index.html ~line 744-786):
  Delta perps:   GET https://api.india.delta.exchange/v2/tickers?contract_types=perpetual_futures
                 via /api/proxy?url=<encoded> (direct fallback in Node/tests)
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

Every fetch carries a 12s AbortController timeout (20s for the Delta tickers
list). AbortError is mapped to `timeout >Nms` — Chromium's "signal is aborted
without reason" never reaches the desk. Delta retries abort/timeout three
times; a live miss reuses last-good Delta rows when the cache has them.
Classic script, no build step.
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
var DELTA_PROXY = CDCX_PROXY;
function cdcxDeskPath(url){
  if (url.indexOf('/active_instruments') !== -1) return '/api/coindcx/instruments';
  if (url.indexOf('/current_prices/futures/rt') !== -1) return '/api/coindcx/marks';
  var q = url.split('?')[1];
  if (url.indexOf('/market_data/candlesticks') !== -1 && q) return '/api/coindcx/candles?' + q;
  return null;
}
async function cdcxFetchUrl(url){
  var desk = cdcxDeskPath(url);
  var paths = desk ? [desk, CDCX_PROXY(url)] : [CDCX_PROXY(url)];
  var lastErr = null;
  for (var pi = 0; pi < paths.length; pi++){
    for (var attempt = 0; attempt < 4; attempt++){
      try{
        var r = await timedFetch(paths[pi]);
        if (r && r.status === 429 && attempt < 3){
          await new Promise(function(ok){ setTimeout(ok, Math.min(6000, 350 * Math.pow(2, attempt))); });
          continue;
        }
        if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : '?'));
        var j = await r.json();
        if (j && j.ok === true && j.data != null) return j.data;
        return j;
      }catch(e){
        lastErr = e;
        if (attempt < 3) await new Promise(function(ok){ setTimeout(ok, Math.min(6000, 350 * Math.pow(2, attempt))); });
      }
    }
  }
  throw lastErr || new Error('CoinDCX fetch failed');
}
var DELTA_RES = {'15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d'};
var CDCX_RES  = {'15m':'15','1h':'60','2h':'120','4h':'240','1d':'1D'};
var SEC_PER   = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400};

var CACHE_MS     = 15 * 60 * 1000; // 15-minute universe cache
var FETCH_TIMEOUT = 12000;         // 12s abort per network leg
var DELTA_TICKER_TIMEOUT = 20000;  // tickers payload is ~270KB; 12s was aborting under proxy load
var DELTA_FETCH_TRIES = 3;

/* ---------------- module-local state ---------------- */
var cache = null;   // {rows, at, deltaCount, cdcxCount, note}
var lastNote = null;
var inflight = null; // busy-guard: concurrent xuUniverse calls share one fetch

function nowSec(){ return Math.floor(Date.now()/1000); }

/* A CANDLE WINDOW THAT MOVES EVERY SECOND CAN NEVER BE CACHED.

   Candle URLs carried end=nowSec(), so every request was a unique URL. That
   silently defeated THREE layers at once: the proxy's response cache (keyed
   by URL), the in-flight coalescing added in v431 (keyed by URL), and the
   browser's own HTTP cache. CoinDCX candles even had a 45s TTL configured at
   the proxy that could essentially never hit.

   Measured on a cold load: ~2,900 Delta requests for ~393 distinct
   (symbol, timeframe) reads — a 7x amplification, because SWING, SCALP, BEST,
   BRAIN and EDGE each scan the same universe and not one of their identical
   reads could collapse into another's.

   Quantising the window to a minute makes identical logical reads produce an
   identical URL, so all three layers work as intended. It is a floor, never a
   round-up: the window never claims data that does not exist yet. Sub-minute
   freshness is not lost anywhere that matters — live price comes from the
   ticker and mark feeds, not from candles, and the forming bar is still
   returned, just addressed by a stable name. */
var CANDLE_WINDOW_GRAIN_SEC = 60;
function hgCandleWindowEnd(){
  var n = nowSec();
  return Math.floor(n / CANDLE_WINDOW_GRAIN_SEC) * CANDLE_WINDOW_GRAIN_SEC;
}
function numOrNull(x){
  var n = parseFloat(x);
  return isFinite(n) ? n : null;
}

/* Abort timeout, feature-checked; plain fetch when AbortController or
   fetch itself is missing (missing fetch rejects so allSettled degrades).
   abort(reason) when the runtime accepts it so the rejection is "timeout >Nms"
   instead of Chromium's empty-reason AbortError. */
function timedFetch(url, ms){
  if (typeof fetch !== 'function') return Promise.reject(new Error('fetch unavailable'));
  var wait = (isFinite(+ms) && +ms > 0) ? Math.floor(+ms) : FETCH_TIMEOUT;
  if (typeof AbortController !== 'function') return fetch(url);
  var ctl = new AbortController();
  var to = setTimeout(function(){
    try{
      var reason = new Error('timeout >' + wait + 'ms');
      try{ ctl.abort(reason); }catch(e){ ctl.abort(); }
    }catch(e){}
  }, wait);
  return fetch(url, { signal: ctl.signal }).then(function(r){
    clearTimeout(to);
    return r;
  }, function(err){
    clearTimeout(to);
    throw err;
  });
}

function isTimeoutErr(e){
  if (!e) return false;
  if (e.name === 'AbortError' || e.code === 20) return true;
  var msg = e.message ? String(e.message) : String(e);
  return /timeout\s*>|aborted without reason|The user aborted|AbortError|The operation was aborted/i.test(msg);
}
function errMsg(e){
  if (!e) return 'unknown error';
  var msg = e.message ? String(e.message) : String(e);
  var already = msg.match(/timeout\s*>(\d+)ms/i);
  if (already) return 'timeout >' + already[1] + 'ms';
  if (isTimeoutErr(e)) return 'timeout >' + FETCH_TIMEOUT + 'ms';
  return msg;
}

/* ---------------- base-asset mapping ----------------
   index.html searchBase: delta sym.replace(/USD$/,''), cdcx
   sym.replace(/^B-/,'').replace(/_USDT$/,''). Extended to also strip a
   USDT suffix so 'BTCUSDT' and 'BTCUSD' map to the same base. */
function baseOf(sym, exchange){
  var s = String(sym == null ? '' : sym).toUpperCase();
  if (exchange === 'coindcx') return s.replace(/^B-/, '').replace(/_USDT$/, '');
  if (exchange === 'startrader' && typeof G.startraderBaseOf === 'function') return G.startraderBaseOf(s);
  if (exchange === 'binance') return s.replace(/USDT$/, '');
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

function xuAlsoOnAdd(cur, sym){
  if (!sym || cur.sym === sym) return;
  if (!cur.alsoOn) cur.alsoOn = sym;
  else if (String(cur.alsoOn).indexOf(sym) < 0) cur.alsoOn = cur.alsoOn + ',' + sym;
}

/* ---------------- pure cross-exchange merge (vm-testable) ----------------
   Dedupe by base asset across N venue legs. Known turnover beats unknown;
   both known -> higher venue wins; both unknown -> earlier leg wins (delta
   before cdcx before startrader before binance). alsoOn carries alternate
   venue symbols (comma-separated when >1). Output sorted turnover-desc. */
function xuMergeLegs(){
  try{
    var legArgs = arguments;
    var byBase = {};
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
        if (otherVenue) cur.alsoOn = cur.sym; /* displaced primary symbol (old code path) */
        cur.sym = row.sym; cur.exchange = row.exchange;
        cur.turnoverUsd = rt;
        cur.mark = num(row.mark);
        cur.fundingPct = num(row.fundingPct);
        cur.oiUsd = num(row.oiUsd);
        cur.oiContracts = num(row.oiContracts);
      } else if (cur.sym !== row.sym){
        if (otherVenue) xuAlsoOnAdd(cur, row.sym);
        if (cur.mark === null && num(row.mark) !== null) cur.mark = num(row.mark);
        if (cur.fundingPct === null && num(row.fundingPct) !== null) cur.fundingPct = num(row.fundingPct);
        if (cur.oiUsd === null && num(row.oiUsd) !== null) cur.oiUsd = num(row.oiUsd);
        if (cur.oiContracts === null && num(row.oiContracts) !== null) cur.oiContracts = num(row.oiContracts);
        if (ct === null && rt !== null) cur.turnoverUsd = rt;
      }
    }
    for (var L = 0; L < legArgs.length; L++){
      (legArgs[L] || []).forEach(consider);
    }
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
function xuMerge(deltaRows, cdcxRows){
  try{
    if (arguments.length <= 2) return xuMergeLegs(deltaRows, cdcxRows);
    return xuMergeLegs.apply(null, arguments);
  }catch(e){ return []; }
}

/* Binance USD-M perps not already covered by base — "everything else" leg */
function xuNormBinanceExt(tickers, coveredBases){
  try{
    if (!tickers || typeof tickers !== 'object') return [];
    var seen = {};
    if (coveredBases){
      for (var k in coveredBases) if (coveredBases[k]) seen[String(k).toUpperCase()] = true;
    }
    var out = [];
    for (var sym in tickers){
      if (!sym || !/USDT$/.test(sym)) continue;
      var base = sym.replace(/USDT$/, '');
      if (!base || seen[base]) continue;
      var t = tickers[sym];
      out.push({
        sym: sym,
        base: base,
        exchange: 'binance',
        turnoverUsd: numOrNull(t && t.turnoverUsd),
        mark: numOrNull(t && t.mark),
        fundingPct: null,
        oiUsd: null,
        oiContracts: null,
        alsoOn: null
      });
      seen[base] = true;
    }
    out.sort(function(a, b){
      var ta = (a.turnoverUsd === null) ? -1 : a.turnoverUsd;
      var tb = (b.turnoverUsd === null) ? -1 : b.turnoverUsd;
      return tb - ta;
    });
    return out;
  }catch(e){ return []; }
}

/* Same-origin proxy first — browser CORS blocks direct Delta REST on Render.
   Abort/timeout retries (3) with backoff. HTTP 429/4xx/5xx fail fast — the
   proxy bucket is 60s, so a short retry only doubles the pressure. */
function isDeltaTickersUrl(url){
  return String(url).indexOf('/v2/tickers') >= 0;
}
async function deltaFetch(url){
  var wait = isDeltaTickersUrl(url) ? DELTA_TICKER_TIMEOUT : FETCH_TIMEOUT;
  var lastErr = null;
  for (var attempt = 0; attempt < DELTA_FETCH_TRIES; attempt++){
    try{
      var r = await timedFetch(DELTA_PROXY(url), wait);
      if (r && r.ok) return r;
    }catch(e){ lastErr = e; }
    try{
      var r2 = await timedFetch(url, wait);
      if (r2 && r2.ok) return r2;
      lastErr = new Error('Delta HTTP ' + (r2 ? r2.status : '?'));
    }catch(e2){ lastErr = e2; }
    if (attempt < DELTA_FETCH_TRIES - 1 && isTimeoutErr(lastErr)){
      await new Promise(function(ok){ setTimeout(ok, Math.min(4000, 300 * Math.pow(2, attempt))); });
      continue;
    }
    throw lastErr || new Error('Delta fetch failed');
  }
  throw lastErr || new Error('Delta fetch failed');
}

/* ---------------- network legs ---------------- */
async function fetchDeltaLeg(){
  var r = await deltaFetch(DELTA + '/v2/tickers?contract_types=perpetual_futures');
  return xuNormDelta(await r.json());
}
async function fetchCdcxLeg(){
  return xuNormCdcx(await cdcxFetchUrl(CDCX_API + '/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT'));
}
/* Companion marks leg — CoinDCX futures realtime prices (mark + 24h USDT
   turnover per B-XXX_USDT). Optional by design: its failure must NEVER
   block or empty the universe; callers merge it with xuMergeCdcxMarks and
   surface an honest note instead. */
async function fetchCdcxMarksLeg(){
  return cdcxFetchUrl(CDCX_PUB + '/market_data/v3/current_prices/futures/rt');
}
async function fetchStartraderLeg(){
  if (typeof G.startraderUniverseRows === 'function') return G.startraderUniverseRows();
  return [];
}
async function fetchBinanceTickersLeg(){
  if (typeof G.binanceTickers24h !== 'function') return null;
  return G.binanceTickers24h();
}

/* ---------------- the combined universe ---------------- */
async function xuUniverse(force){
  try{
    if (!force && cache && (Date.now() - cache.at) < CACHE_MS) return cache.rows;
    if (inflight) return inflight; // busy-guard: share the in-flight fetch
    inflight = (async function(){
      var legs = await Promise.allSettled([
        fetchDeltaLeg(), fetchCdcxLeg(), fetchCdcxMarksLeg(),
        fetchStartraderLeg(), fetchBinanceTickersLeg()
      ]);
      var d = legs[0], c = legs[1], mk = legs[2], st = legs[3], bn = legs[4];
      var dRows = d.status === 'fulfilled' ? d.value : [];
      var cRows = c.status === 'fulfilled' ? c.value : [];
      var stRows = st.status === 'fulfilled' ? st.value : [];
      var tickers = (bn.status === 'fulfilled') ? bn.value : null;
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
          return cache.rows;
        }
        note = 'both exchange legs failed (' + errMsg(d.reason) + '; ' + errMsg(c.reason) + ') — universe empty';
        cache = { rows: [], deltaRows: [], cdcxRows: [], startraderRows: [], binanceRows: [], at: Date.now(), deltaCount: 0, cdcxCount: 0, startraderCount: 0, binanceCount: 0, cdcxMarks: 0, note: note };
        lastNote = note;
        return [];
      }
      if (d.status !== 'fulfilled'){
        if (cache && cache.deltaRows && cache.deltaRows.length){
          dRows = cache.deltaRows.slice();
          note = 'delta leg failed: ' + errMsg(d.reason) + ' — using last good Delta universe from ' + new Date(cache.at).toISOString();
        } else {
          note = 'delta leg failed: ' + errMsg(d.reason) + ' — CoinDCX contracts only, no Delta funding/OI data';
        }
      }
      if (c.status !== 'fulfilled') note = 'coindcx leg failed: ' + errMsg(c.reason) + ' — Delta India contracts only';
      if (st.status !== 'fulfilled') note = (note ? note + '; ' : '') + 'startrader leg failed: ' + errMsg(st.reason);
      if (bn.status !== 'fulfilled') note = (note ? note + '; ' : '') + 'binance extension leg failed: ' + errMsg(bn.reason);
      if (marksNote) note = note ? (note + '; ' + marksNote) : marksNote;
      var preMerge = xuMergeLegs(dRows, cRows, stRows);
      var covered = {};
      for (var ci = 0; ci < preMerge.length; ci++) covered[preMerge[ci].base] = true;
      var bnRows = xuNormBinanceExt(tickers, covered);
      var rows = xuMergeLegs(dRows, cRows, stRows, bnRows);
      cache = { rows: rows, deltaRows: dRows, cdcxRows: cRows, startraderRows: stRows, binanceRows: bnRows,
        at: Date.now(), deltaCount: dRows.length, cdcxCount: cRows.length,
        startraderCount: stRows.length, binanceCount: bnRows.length, cdcxMarks: cdcxMarks, note: note };
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
/* ---------------- Binance candle fallback ----------------
   Thin venue listings (mostly CoinDCX) often return empty/too-few candles,
   which excludes them from every gate/vote. When the venue leg cannot fill
   the request and the same BASE asset trades as a Binance USDT perp, serve
   window.binanceKlines(base+'USDT') instead. Contract preserved exactly:
   Promise<[{t(sec),o,h,l,c,v}] asc>, [] on failure, never throws, rows
   never fabricated. Feature-checked: no binance.js -> venue rows pass
   through untouched, exactly as before. */
var BIN_RES = {'15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d'};
/* Every tf this module accepts is Binance-native 1:1 today; the map is the
   single point where a FUTURE venue tf Binance lacks must be mapped to the
   nearest Binance interval (Binance: 1m 3m 5m 15m 30m 1h 2h 4h 6h 8h 12h
   1d 1w). */

var binPerps = undefined;   // undefined=never attempted; null=unavailable; {}=symbol->true
var binPerpsInflight = null;
/* window.binancePerpUniverse() at most ONCE per session, guarded, never
   throwing; concurrent fallbacks share the single in-flight attempt. */
async function binancePerpMap(){
  if (binPerps !== undefined) return binPerps;
  if (binPerpsInflight) return binPerpsInflight;
  binPerpsInflight = (async function(){
    try{
      if (typeof G.binancePerpUniverse === 'function'){
        var list = await G.binancePerpUniverse();
        if (Array.isArray(list) && list.length){
          var m = {};
          for (var i = 0; i < list.length; i++) m[String(list[i]).toUpperCase()] = true;
          binPerps = m;
          return binPerps;
        }
      }
    }catch(e){}
    binPerps = null; // unavailable -> membership probed by direct kline attempt
    return binPerps;
  })();
  try{ return await binPerpsInflight; }finally{ binPerpsInflight = null; }
}

/* Returns Binance rows when they BEAT the venue's (deeper series), else
   null — the caller keeps the venue rows. Never throws, never fabricates. */
async function binanceCandleFallback(item, tf, count, venueRows){
  try{
    if (typeof G.binanceKlines !== 'function') return null;
    var base = (item.base && typeof item.base === 'string') ? item.base.toUpperCase()
             : baseOf(item.sym, item.exchange); // module convention when base is absent
    if (!base) return null;
    var bSym = base + 'USDT';
    var perps = await binancePerpMap();
    if (perps && !perps[bSym]) return null; // verified NOT a Binance perp — no wasted kline call
    /* perps null -> universe unavailable: attempt directly, empty = not on Binance */
    var rows = await G.binanceKlines(bSym, BIN_RES[tf] || tf, count);
    if (Array.isArray(rows) && rows.length > venueRows.length) return rows;
    return null;
  }catch(e){ return null; }
}

/* ---------------- candle router ---------------- */

/* IN-FLIGHT COALESCING — see the same note in binance.js.

   xuCandles had no cache and no coalescing at all: every caller that wanted
   4h BTC candles opened its own request. A BRAIN synthesis fans dozens of
   candidates out at once and several layers ask for the same contract in the
   same instant, so the network log showed the identical Delta and CoinDCX
   candle URL two and three times per millisecond — which is what pushed the
   Delta proxy into 429 and Binance into an outright IP ban.

   Deliberately in-flight ONLY, not a TTL cache: candles must stay live, and
   callers already re-poll on their own schedule. The entry is dropped the
   moment the request settles, so the ONLY thing collapsed is the burst of
   duplicates that a single fan-out creates.

   Each caller gets its own array (rows.slice()) because that is what the
   uncoalesced version handed out — strats.js pops the unclosed tail bar off
   the rows it receives, and sharing one array between layers would let one
   caller's trim silently shorten another's series. The row objects inside are
   read-only everywhere and stay shared. */
var __XU_CANDLES_INFLIGHT = new Map();

function xuCandles(item, tf, n){
  var count = (isFinite(+n) && +n > 0) ? Math.floor(+n) : 200;
  var key = (item && item.exchange ? item.exchange : '?') + '|' +
            (item && item.sym ? item.sym : '?') + '|' + tf + '|' + count;
  var live = __XU_CANDLES_INFLIGHT.get(key);
  if (!live){
    live = xuCandlesOnce(item, tf, n).finally(function(){
      __XU_CANDLES_INFLIGHT.delete(key);
    });
    __XU_CANDLES_INFLIGHT.set(key, live);
  }
  return live.then(function(rows){ return Array.isArray(rows) ? rows.slice() : []; });
}

async function xuCandlesOnce(item, tf, n){
  try{
    xuCandles.lastSource = null; // debug-only tag, see the fallback note above
    if (!item || !item.sym) return [];
    var res = DELTA_RES[tf]; // same tf key set on both maps
    var secPer = SEC_PER[tf];
    if (!res || !secPer) return [];
    var count = (isFinite(+n) && +n > 0) ? Math.floor(+n) : 200;
    var rows = [], src = null;
    if (item.exchange === 'coindcx'){
      src = 'coindcx';
      try{
        var to = hgCandleWindowEnd(), from = to - secPer * (count + 3);
        var url = CDCX_PUB + '/market_data/candlesticks?pair=' + encodeURIComponent(item.sym) +
                  '&from=' + from + '&to=' + to + '&resolution=' + CDCX_RES[tf] + '&pcode=f';
        var j = await cdcxFetchUrl(url);
        var arr = (j && j.data) ? j.data : j;
        if (Array.isArray(arr)){
          rows = arr.map(function(c){
            return { t: Math.floor((c.time !== undefined && c.time !== null ? c.time : c.t) / 1000),
                     o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +(c.volume !== undefined && c.volume !== null ? c.volume : 0) };
          }).filter(function(c){ return isFinite(c.t); });
          rows.sort(function(a, b){ return a.t - b.t; });
        }
      }catch(e){ rows = []; } // venue leg down -> [] -> Binance fallback below
    }
    else if (item.exchange === 'delta'){
      src = 'delta';
      try{
        var end = hgCandleWindowEnd(), start = end - secPer * (count + 3);
        var r2 = await deltaFetch(DELTA + '/v2/history/candles?resolution=' + DELTA_RES[tf] +
                                  '&symbol=' + encodeURIComponent(item.sym) + '&start=' + start + '&end=' + end);
        if (r2 && r2.ok){
          var j2 = await r2.json();
          rows = ((j2 && j2.result) || []).map(function(c){
            return { t: c.time, o: +c.open, h: +c.high, l: +c.low, c: +c.close, v: +c.volume };
          }).filter(function(c){ return isFinite(c.t); });
          rows.sort(function(a, b){ return a.t - b.t; });
        }
      }catch(e){ rows = []; }
    }
    else if (item.exchange === 'startrader' || item.exchange === 'binance'){
      src = item.exchange;
      try{
        if (typeof G.binanceKlines === 'function'){
          var bSym = (item.exchange === 'binance') ? item.sym
            : ((typeof G.startraderBinanceSym === 'function') ? G.startraderBinanceSym(item.base) : (item.base + 'USDT'));
          if (bSym) rows = await G.binanceKlines(bSym, BIN_RES[tf] || tf, count);
          if (!Array.isArray(rows)) rows = [];
        }
      }catch(e){ rows = []; }
    }
    else return [];
    /* Venue could not fill the request (outage or thin listing): reroute to
       the base asset's Binance USDT perp when one exists. Binance rows win
       only when deeper; the venue's honest rows are never hidden. */
    if (rows.length < count && item.exchange !== 'startrader' && item.exchange !== 'binance'){
      var fb = await binanceCandleFallback(item, tf, count, rows);
      if (fb){ rows = fb; src = 'binance-fallback'; }
    }
    xuCandles.lastSource = src;
    return rows;
  }catch(e){ return []; }
}

/* ---------------- state / note accessors (never throw) ---------------- */
function xuState(){
  try{
    if (!cache) return null;
    return { count: cache.rows.length, delta: cache.deltaCount, cdcx: cache.cdcxCount,
      startrader: (cache.startraderCount || 0), binance: (cache.binanceCount || 0),
      cdcxMarks: (cache.cdcxMarks || 0), at: cache.at, note: cache.note };
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
    var stRows = cache.startraderRows || [], bnRows = cache.binanceRows || [];
    for (i = 0; i < stRows.length; i++){
      r = stRows[i];
      if (r.sym === X || r.base === X || r.base === bD || r.base === bC){
        return { sym: r.sym, base: r.base, fundingPct: (typeof r.fundingPct === 'number' ? r.fundingPct : null),
                 oiUsd: null, mark: (typeof r.mark === 'number' ? r.mark : null), exchange: 'startrader' };
      }
    }
    for (i = 0; i < bnRows.length; i++){
      r = bnRows[i];
      if (r.sym === X || r.base === X || r.base === bD || r.base === bC){
        return { sym: r.sym, base: r.base, fundingPct: (typeof r.fundingPct === 'number' ? r.fundingPct : null),
                 oiUsd: null, mark: (typeof r.mark === 'number' ? r.mark : null), exchange: 'binance' };
      }
    }
    return null;
  }catch(e){ return null; }
}

/* ---------------- exports ---------------- */
try{
  G.xuUniverse = xuUniverse;
  G.xuCandles = xuCandles;
  G.hgCandleWindowEnd = hgCandleWindowEnd;
  G.xuMerge = xuMerge;
  G.xuMergeLegs = xuMergeLegs;
  G.xuNormDelta = xuNormDelta;
  G.xuNormCdcx = xuNormCdcx;
  G.xuNormBinanceExt = xuNormBinanceExt;
  G.xuMergeCdcxMarks = xuMergeCdcxMarks;
  G.xuPositioning = xuPositioning;
  G.xuState = xuState;
  G.xuUniverseNote = xuUniverseNote;
  G.xuErrMsg = errMsg;
}catch(e){}

})();
