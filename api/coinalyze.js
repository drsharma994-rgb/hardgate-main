/* HARDGATE /api/coinalyze — server-side Coinalyze proxy (API key never in browser).
   GET /api/coinalyze?path=open-interest&symbols=BTCUSDT_PERP.A,BTCUSDT_PERP.6
   GET /api/coinalyze?path=open-interest-history&symbols=...&interval=1hour&from=&to=
   CommonJS, zero deps, Node 18+ global fetch. */

const COINALYZE_API = 'https://api.coinalyze.net/v1';
const UPSTREAM_TIMEOUT_MS = 15000;
const ALLOWED_PATHS = new Set([
  'exchanges', 'future-markets', 'open-interest', 'open-interest-history',
  'funding-rate', 'funding-rate-history',
]);

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
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

  const key = process.env.COINALYZE_API_KEY;
  if (!key) return sendJson(res, 503, { error: 'coinalyze not configured — set COINALYZE_API_KEY on the server' });

  let path = req.query && req.query.path;
  if (Array.isArray(path)) path = path[0];
  if (!path && req.url){
    try { path = new URL(req.url, 'http://localhost').searchParams.get('path'); } catch (e) {}
  }
  path = String(path || 'open-interest').replace(/^\//, '');
  if (!ALLOWED_PATHS.has(path)) return sendJson(res, 400, { error: 'path not allowed' });

  const qs = new URLSearchParams();
  if (req.url){
    try{
      const u = new URL(req.url, 'http://localhost');
      u.searchParams.forEach(function(v, k){
        if (k !== 'path') qs.set(k, v);
      });
    }catch(e){}
  }
  const url = COINALYZE_API + '/' + path + (qs.toString() ? '?' + qs.toString() : '');
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try{
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { api_key: key },
      signal: ctrl.signal,
    });
    const text = await upstream.text();
    let j = null;
    try { j = JSON.parse(text); } catch (e) { j = text; }
    if (!upstream.ok) return sendJson(res, upstream.status, { error: 'coinalyze upstream failed', detail: j });
    return sendJson(res, 200, { path: path, data: j });
  }catch(e){
    const msg = (e && e.name === 'AbortError') ? 'coinalyze timeout' : String((e && e.message) || e);
    return sendJson(res, 502, { error: msg });
  }finally{
    clearTimeout(timer);
  }
};
