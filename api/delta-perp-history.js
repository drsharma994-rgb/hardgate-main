/* HARDGATE /api/delta/perp-history — cached Delta India OI / funding / mark / price.
   Public market data only (no auth). Used by gold forming OI-trap + funding extreme. */

const { fetchDeltaPerpHistory, DELTA_PERP_DEFAULT_SYMBOL } =
  require('../lib/delta-perp-history.cjs');

const CACHE_MS = 60 * 1000;
const __cache = Object.create(null);

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.end(JSON.stringify(obj));
}

function q(req, key, fallback){
  let v = req.query && req.query[key];
  if (Array.isArray(v)) v = v[0];
  if ((v == null || v === '') && req.url){
    try { v = new URL(req.url, 'http://localhost').searchParams.get(key); } catch (e) {}
  }
  return (v == null || v === '') ? fallback : v;
}

module.exports = async function deltaPerpHistory(req, res){
  if (req.method === 'OPTIONS'){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });

  const symbol = String(q(req, 'symbol', DELTA_PERP_DEFAULT_SYMBOL) || DELTA_PERP_DEFAULT_SYMBOL).toUpperCase();
  const resolution = String(q(req, 'resolution', '1h') || '1h');
  const lookbackHours = Math.min(720, Math.max(24, +(q(req, 'lookbackHours', '168')) || 168));
  const cacheKey = symbol + '|' + resolution + '|' + lookbackHours;
  const hit = __cache[cacheKey];
  if (hit && (Date.now() - hit.at) < CACHE_MS){
    res.setHeader('X-HG-Cache', 'HIT');
    return sendJson(res, 200, hit.body);
  }

  try{
    const body = await fetchDeltaPerpHistory({ symbol, resolution, lookbackHours });
    __cache[cacheKey] = { at: Date.now(), body };
    res.setHeader('X-HG-Cache', 'MISS');
    return sendJson(res, body.ok ? 200 : 502, body);
  }catch(e){
    return sendJson(res, 502, {
      ok: false,
      error: (e && e.message) ? e.message : 'delta perp history failed',
      symbol
    });
  }
};
