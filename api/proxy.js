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
]);

const UPSTREAM_TIMEOUT_MS = 15000;
/* Scans fire parallel CoinDCX candle fetches — keep a generous ceiling so
   whole-exchange sweeps never 429 themselves; abuse is still bounded. */
const RATE_WINDOW_MS = 60000;
const RATE_MAX_DEFAULT = 300;
const RATE_MAX_COINDCX = 800;
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
  const max = (hostname && hostname.indexOf('coindcx.com') !== -1) ? RATE_MAX_COINDCX : RATE_MAX_DEFAULT;
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
    return sendJson(res, 429, { error: 'rate limit exceeded — try again shortly' }, req);
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
