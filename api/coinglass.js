/* HARDGATE /api/coinglass — server-side CoinGlass proxy.
   GET /api/coinglass?path=aggregated-heatmap&symbol=BTC&range=3d
   Requires COINGLASS_API_KEY (CG-API-KEY header upstream).
   CommonJS, zero deps, Node 18+ global fetch. */

const COINGLASS_API = 'https://open-api-v4.coinglass.com';
const UPSTREAM_TIMEOUT_MS = 15000;
const ALLOWED_PATHS = new Set([
  'aggregated-history',
  'aggregated-heatmap',
  'aggregated-map',
  'heatmap',
  'history',
  'order',
  'max-pain',
]);

const PATH_MAP = {
  'aggregated-history': '/api/futures/liquidation/aggregated-history',
  'aggregated-heatmap': '/api/futures/liquidation/aggregated-heatmap/model3',
  'aggregated-map': '/api/futures/liquidation/aggregated-map',
  'heatmap': '/api/futures/liquidation/heatmap/model3',
  'history': '/api/futures/liquidation/history',
  'order': '/api/futures/liquidation/order',
  'max-pain': '/api/futures/liquidation/max-pain',
};

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS'){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });

  const key = process.env.COINGLASS_API_KEY;
  if (!key) return sendJson(res, 503, { error: 'coinglass not configured — set COINGLASS_API_KEY on the server' });

  let path = req.query && req.query.path;
  if (Array.isArray(path)) path = path[0];
  if (!path && req.url){
    try { path = new URL(req.url, 'http://localhost').searchParams.get('path'); } catch (e) {}
  }
  path = String(path || 'aggregated-heatmap');
  if (!ALLOWED_PATHS.has(path)) return sendJson(res, 400, { error: 'path not allowed' });

  const upstreamPath = PATH_MAP[path];
  const qs = new URLSearchParams();
  if (req.url){
    try{
      const u = new URL(req.url, 'http://localhost');
      u.searchParams.forEach(function(v, k){
        if (k !== 'path') qs.set(k, v);
      });
    }catch(e){}
  }
  const url = COINGLASS_API + upstreamPath + (qs.toString() ? '?' + qs.toString() : '');
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try{
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { 'CG-API-KEY': key, accept: 'application/json' },
      signal: ctrl.signal,
    });
    const j = await upstream.json().catch(function(){ return null; });
    if (!upstream.ok || !j) return sendJson(res, upstream.ok ? 502 : upstream.status, { error: 'coinglass upstream failed', detail: j });
    return sendJson(res, 200, { path: path, data: j });
  }catch(e){
    const msg = (e && e.name === 'AbortError') ? 'coinglass timeout' : String((e && e.message) || e);
    return sendJson(res, 502, { error: msg });
  }finally{
    clearTimeout(timer);
  }
};
