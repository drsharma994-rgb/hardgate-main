/* HARDGATE — /api/coindcx/* cached CoinDCX desk routes (no public CORS proxies). */
import {
  coindcxCandlesUrl,
  coindcxFetchCached,
  coindcxInstrumentsUrl,
  coindcxMarksUrl,
} from './coindcx-fetch.mjs';

const TTL = {
  instruments: 15 * 60 * 1000,
  marks: 90 * 1000,
  candles: 45 * 1000,
};

function sendJson(res, status, obj, cacheSec){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cacheSec > 0){
    res.setHeader('Cache-Control', 's-maxage=' + cacheSec + ', stale-while-revalidate=' + (cacheSec * 2));
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

function parseJson(text){
  try{ return JSON.parse(text); }catch(e){ return null; }
}

async function serveCachedJson(res, url, ttlMs, cacheSec){
  var up = await coindcxFetchCached(url, ttlMs);
  if (!up.ok){
    return sendJson(res, up.status || 502, {
      ok: false,
      reason: up.reason || ('upstream HTTP ' + (up.status || '?')),
      cached: !!up.cached,
    }, 0);
  }
  var body = parseJson(up.text);
  if (body == null){
    return sendJson(res, 502, { ok: false, reason: 'invalid json from CoinDCX', cached: !!up.cached }, 0);
  }
  return sendJson(res, 200, { ok: true, data: body, cached: !!up.cached }, cacheSec);
}

export function coindcxApiStatus(){
  return {
    ok: true,
    routes: ['/api/coindcx/instruments', '/api/coindcx/marks', '/api/coindcx/candles'],
    ttlSec: {
      instruments: TTL.instruments / 1000,
      marks: TTL.marks / 1000,
      candles: TTL.candles / 1000,
    },
  };
}

export function createCoindcxApi(){
  return async function coindcxHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      if ((req.method || 'GET').toUpperCase() !== 'GET'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' }, 0);
      }

      if (u.pathname === '/api/coindcx/status'){
        return sendJson(res, 200, coindcxApiStatus(), 30);
      }

      if (u.pathname === '/api/coindcx/instruments'){
        return serveCachedJson(res, coindcxInstrumentsUrl(), TTL.instruments, TTL.instruments / 1000);
      }

      if (u.pathname === '/api/coindcx/marks'){
        return serveCachedJson(res, coindcxMarksUrl(), TTL.marks, TTL.marks / 1000);
      }

      if (u.pathname === '/api/coindcx/candles'){
        var pair = u.searchParams.get('pair') || '';
        var from = u.searchParams.get('from') || '';
        var to = u.searchParams.get('to') || '';
        var resolution = u.searchParams.get('resolution') || '';
        if (!pair || !from || !to || !resolution){
          return sendJson(res, 400, { ok: false, reason: 'pair, from, to, resolution required' }, 0);
        }
        var url = coindcxCandlesUrl(pair, from, to, resolution);
        return serveCachedJson(res, url, TTL.candles, TTL.candles / 1000);
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' }, 0);
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' }, 0);
    }
  };
}
