/* HARDGATE — server-side CoinDCX fetch with retry + shared cache.
   Replaces brittle public CORS proxies and reduces /api/proxy pressure. */

export const CDCX_PUB = 'https://public.coindcx.com';
export const CDCX_API = 'https://api.coindcx.com';

const UPSTREAM_TIMEOUT_MS = 15000;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

const __cache = new Map(); /* key -> { at, body, status } */
const __inflight = new Map();

export function coindcxCacheKey(url){
  return String(url || '');
}

export function coindcxCacheGet(key, ttlMs){
  if (!ttlMs) return null;
  var hit = __cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return hit;
}

export function coindcxCacheSet(key, status, body){
  __cache.set(key, { at: Date.now(), status: status, body: body });
}

export async function coindcxUpstream(url, opts){
  opts = opts || {};
  var retries = +(opts.retries != null ? opts.retries : 3);
  var timeoutMs = +(opts.timeoutMs != null ? opts.timeoutMs : UPSTREAM_TIMEOUT_MS);
  var lastErr = null;
  for (var attempt = 0; attempt <= retries; attempt++){
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
    try{
      var res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HARDGATE/1.0 (+https://hardgate-main.onrender.com)',
        },
      });
      clearTimeout(timer);
      var text = await res.text();
      if (res.ok) return { ok: true, status: res.status, text: text };
      if (RETRY_STATUSES.has(res.status) && attempt < retries){
        await sleep(Math.min(8000, 400 * Math.pow(2, attempt)));
        continue;
      }
      return { ok: false, status: res.status, text: text, reason: 'HTTP ' + res.status };
    }catch(e){
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries){
        await sleep(Math.min(8000, 400 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  return { ok: false, status: 0, text: '', reason: String((lastErr && lastErr.message) || lastErr || 'upstream failed').slice(0, 160) };
}

export async function coindcxFetchCached(url, ttlMs, opts){
  var key = coindcxCacheKey(url);
  var hit = coindcxCacheGet(key, ttlMs);
  if (hit) return { ok: hit.status >= 200 && hit.status < 300, status: hit.status, text: hit.body, cached: true };

  if (__inflight.has(key)) return __inflight.get(key);

  var p = (async function(){
    var up = await coindcxUpstream(url, opts);
    if (up.ok) coindcxCacheSet(key, up.status, up.text);
    return Object.assign({ cached: false }, up);
  })();

  __inflight.set(key, p);
  try{
    return await p;
  }finally{
    __inflight.delete(key);
  }
}

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

export function coindcxInstrumentsUrl(){
  return CDCX_API + '/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT';
}

export function coindcxMarksUrl(){
  return CDCX_PUB + '/market_data/v3/current_prices/futures/rt';
}

export function coindcxCandlesUrl(pair, from, to, resolution){
  return CDCX_PUB + '/market_data/candlesticks?pair=' + encodeURIComponent(pair)
    + '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)
    + '&resolution=' + encodeURIComponent(resolution) + '&pcode=f';
}
