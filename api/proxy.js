/* HARDGATE /api/proxy — same-origin Vercel serverless function replacing the
   dead hardgate-proxy.onrender.com proxy (and the flaky public CORS proxies).
   The app calls GET /api/proxy?url=<encodedUrl>; we forward the GET server-side
   (no browser CORS) and pass the upstream status + text body straight through.
   CommonJS, zero deps, Node 18+ global fetch. Never throws at load. */

const ALLOWED_HOSTS = new Set([
  'api.india.delta.exchange',
  'api.coindcx.com',
  'public.coindcx.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  // news.js sources: ForexFactory weekly calendar + crypto headline RSS
  'nfs.faireconomy.media',
  'cointelegraph.com',
  'www.coindesk.com',
  // goldspot.js: gold-api.com spot XAU fallback when the direct CORS fetch fails
  'api.gold-api.com',
  // macro.js / goldpro.js: Frankfurter ECB FX fixes (DXY + gold/DXY correlation)
  'api.frankfurter.dev',
  'api.frankfurter.app',
  // gold COT — CFTC Public Reporting (weekly managed-money positioning)
  'publicreporting.cftc.gov',
  /* Binance. NOT here until now, which is why every Binance-dependent read
     failed for a user in a geo-blocked country: the browser gets HTTP 451,
     binance.js returns null without saying why, and the cards then reported
     "OI not published for this contract" — blaming the venue for a block.

     The whole point of a same-origin proxy is that the SERVER is not in the
     blocked country: this service runs in Singapore, where these hosts
     resolve normally. Read-only public market data, same as every other host
     on this list. */
  'api.binance.com',
  'fapi.binance.com',
  /* regime.js gauges — same story: fetched directly, blocked or CORS-refused
     for some clients, and the whole eight-gauge composite then reported
     "every gauge source failed" while the app fell back to a BTC daily proxy
     on every card in every tab. */
  'api.coingecko.com',
  'api.alternative.me',
  'stablecoins.llama.fi',
]);

const UPSTREAM_TIMEOUT_MS = 15000;
/* Scans fire parallel CoinDCX candle fetches — keep a generous ceiling so
   whole-exchange sweeps never 429 themselves; abuse is still bounded. */
const RATE_WINDOW_MS = 60000;
const RATE_MAX_DEFAULT = 300;
const RATE_MAX_COINDCX = 800;
/* An enriched sweep asks for OI, long/short, taker flow and depth on up to
   ENRICH_MAX contracts — four calls a name. The default 300/min would rate-
   limit the tab against itself long before Binance did. */
const RATE_MAX_BINANCE = 900;
/* DELTA IS A PRIMARY VENUE AND WAS THE ONLY ONE WITHOUT ITS OWN BUCKET.

   CoinDCX and Binance each got a named ceiling above; Delta India — the venue
   in this app's own title — fell through to RATE_MAX_DEFAULT, and that is the
   ONLY host the desk rate-limits itself against. Measured on the deployed
   desk, one QUICK RESCAN: 1,957 fetches, 219 rejected, and all 219 were
   429 api.india.delta.exchange from THIS proxy, not from Delta. Observed
   demand was ~430 Delta requests/min against a 300/min ceiling.

   The new ceiling is arithmetic, not a guess. Delta documents a quota of
   10,000 units per fixed 5-minute window, throttled by IP for unauthenticated
   requests — 2,000 units/min. /v2/history/candles and /v2/tickers, which is
   substantially all of what a scan asks for, cost 3 units each. So Delta
   itself starts refusing at roughly

       2,000 units/min ÷ 3 units  =  ~666 requests/min

   500 sits above the ~430/min the desk actually wants and at ~75% of Delta's
   own ceiling (1,500 of 2,000 units), so the desk stops rejecting its own
   traffic while the venue's real limit still has headroom. Raising this
   further would only move the refusal from our 429 to Delta's, which is the
   worse failure: theirs is IP-scoped and ours is not.

   Source: Delta Exchange API docs, rate-limit section (10,000 units / 5 min;
   "any endpoint not mentioned here has a cost of 1 unit"; OHLC candles and
   tickers listed at 3). */
const RATE_MAX_DELTA = 500;
const __rateBuckets = new Map();
const __responseCache = new Map();

function coindcxCacheTtl(urlStr){
  if (!urlStr || urlStr.indexOf('coindcx.com') === -1) return 0;
  if (urlStr.indexOf('active_instruments') !== -1) return 15 * 60 * 1000;
  if (urlStr.indexOf('current_prices/futures/rt') !== -1) return 90 * 1000;
  if (urlStr.indexOf('candlesticks') !== -1) return 45 * 1000;
  return 0;
}

function proxyCacheTtl(urlStr){
  var coindcx = coindcxCacheTtl(urlStr);
  if (coindcx) return coindcx;
  if (!urlStr) return 0;
  if (urlStr.indexOf('faireconomy.media') !== -1 && urlStr.indexOf('ff_calendar') !== -1) return 30 * 60 * 1000;
  if (urlStr.indexOf('cointelegraph.com') !== -1 || urlStr.indexOf('coindesk.com') !== -1) return 10 * 60 * 1000;
  if (urlStr.indexOf('publicreporting.cftc.gov') !== -1) return 7 * 24 * 3600 * 1000;
  return 0;
}

function proxyCacheStaleMax(urlStr){
  if (!urlStr) return 0;
  if (urlStr.indexOf('faireconomy.media') !== -1) return 7 * 24 * 3600 * 1000;
  if (urlStr.indexOf('cointelegraph.com') !== -1 || urlStr.indexOf('coindesk.com') !== -1) return 24 * 3600 * 1000;
  var ttl = proxyCacheTtl(urlStr);
  return ttl ? ttl * 4 : 0;
}

function cacheGet(urlStr, allowStale){
  var ttl = proxyCacheTtl(urlStr);
  if (!ttl) return null;
  var hit = __responseCache.get(urlStr);
  if (!hit) return null;
  var age = Date.now() - hit.at;
  if (age <= ttl) return hit;
  if (allowStale && proxyCacheStaleMax(urlStr) && age <= proxyCacheStaleMax(urlStr)) return hit;
  return null;
}

function cacheSet(urlStr, status, text, contentType){
  if (!proxyCacheTtl(urlStr)) return;
  __responseCache.set(urlStr, { at: Date.now(), status: status, text: text, contentType: contentType });
}

const ALLOWED_ORIGINS = new Set([
  'https://hardgate-main.onrender.com',
  'http://localhost:10000',
  'http://127.0.0.1:10000',
]);

function corsOrigin(req){
  try{
    var o = req.headers && (req.headers.origin || req.headers.Origin);
    if (o && ALLOWED_ORIGINS.has(String(o))) return String(o);
  }catch(e){}
  return null;
}

function clientKey(req){
  try{
    const xf = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
    if (xf) return String(xf).split(',')[0].trim();
    if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress);
  }catch(e){}
  return 'local';
}

function rateLimited(key, hostname){
  const now = Date.now();
  const bucketKey = key + '|' + (hostname || '*');
  const max = (hostname && hostname.indexOf('coindcx.com') !== -1) ? RATE_MAX_COINDCX
            : (hostname && hostname.indexOf('binance.com') !== -1) ? RATE_MAX_BINANCE
            : (hostname && hostname.indexOf('delta.exchange') !== -1) ? RATE_MAX_DELTA
            : RATE_MAX_DEFAULT;
  let bucket = __rateBuckets.get(bucketKey);
  if (!bucket){ bucket = []; __rateBuckets.set(bucketKey, bucket); }
  while (bucket.length && now - bucket[0] > RATE_WINDOW_MS) bucket.shift();
  if (bucket.length >= max) return true;
  bucket.push(now);
  return false;
}

function send(res, status, body, extraHeaders, req){
  const origin = req ? corsOrigin(req) : null;
  const headers = Object.assign({
    'Access-Control-Allow-Origin': origin || 'null',
    'Vary': 'Origin',
    'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
  }, extraHeaders || {});
  if (!origin) delete headers['Access-Control-Allow-Origin'];
  for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.statusCode = status;
  res.end(body);
}

function sendJson(res, status, obj, req){
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' }, req);
}

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS'){
    var o = corsOrigin(req);
    if (o) res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' }, req);

  // target url: Vercel parses req.query; fall back to a manual parse so the
  // handler also works under a plain Node http server (and in tests).
  let raw = req.query && req.query.url;
  if (raw == null && req.url){
    try { raw = new URL(req.url, 'http://localhost').searchParams.get('url'); } catch (e) {}
  }
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw) return sendJson(res, 400, { error: 'missing url param' }, req);

  let target;
  try { target = new URL(raw); } catch (e) { return sendJson(res, 400, { error: 'invalid url param' }, req); }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)){
    return sendJson(res, 403, { error: 'host not allowed' }, req);
  }

  const cached = cacheGet(target.toString(), false);
  if (cached){
    return send(res, cached.status, cached.text, {
      'Content-Type': cached.contentType || 'application/json; charset=utf-8',
      'X-HG-Cache': 'hit',
    }, req);
  }

  if (rateLimited(clientKey(req), target.hostname)){
    /* SAY HOW LONG, SO THE CLIENT STOPS GUESSING.
       This bucket is a 60-second window. The browser was retrying a rejected
       request 400ms later — measured on a cold load: 387 of 406 rejected URLs
       were asked exactly twice, a median 408ms apart — which cannot possibly
       find room and simply doubles the pressure that caused the rejection.
       Retry-After carries the real number: the age of the oldest entry still
       in the window is exactly when a slot frees. */
    var wait = 1;
    try{
      var b = __rateBuckets.get(clientKey(req) + '|' + target.hostname);
      if (b && b.length) wait = Math.max(1, Math.ceil((RATE_WINDOW_MS - (Date.now() - b[0])) / 1000));
    }catch(e){}
    res.setHeader('Retry-After', String(wait));
    return sendJson(res, 429, { error: 'rate limit exceeded — try again shortly', retryAfterSec: wait }, req);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try{
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Yahoo in particular 403s bare node fetch UAs — present a plain browser UA
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': '*/*',
      },
    });
    const text = await upstream.text();
    const ctype = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
    const urlKey = target.toString();
    if (upstream.ok) cacheSet(urlKey, upstream.status, text, ctype);
    if (!upstream.ok && (upstream.status === 429 || upstream.status >= 500)){
      const stale = cacheGet(urlKey, true);
      if (stale){
        return send(res, stale.status, stale.text, {
          'Content-Type': stale.contentType || ctype,
          'X-HG-Cache': 'stale',
        }, req);
      }
    }
    // pass through status + body; forward only content-type (fetch already
    // decoded any gzip, so content-length/encoding must NOT be forwarded)
    send(res, upstream.status, text, {
      'Content-Type': ctype,
    }, req);
  }catch(e){
    const msg = e && e.name === 'AbortError'
      ? 'upstream timeout after ' + UPSTREAM_TIMEOUT_MS + 'ms'
      : String((e && e.message) || e);
    sendJson(res, 502, { error: msg }, req);
  }finally{
    clearTimeout(timer);
  }
};
