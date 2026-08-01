/* HARDGATE /api/fred — server-side FRED observations proxy.
   Reads FRED_API_KEY from the environment; never exposes the key to the browser.
   GET /api/fred?series=DGS10&limit=30 -> { observations: [{date, value}] }
   CommonJS, zero deps, Node 18+ global fetch. Never throws at load. */

const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';
const UPSTREAM_TIMEOUT_MS = 15000;
const ALLOWED_SERIES = new Set([
  'DGS10', 'DGS2', 'DFII10', 'T10YIE', 'DTWEXBGS', 'DTWEXAFEGS', 'FEDFUNDS'
]);

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
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

  const key = process.env.FRED_API_KEY;
  if (!key) return sendJson(res, 503, { error: 'fred not configured — set FRED_API_KEY on the server' });

  let series = req.query && req.query.series;
  if (Array.isArray(series)) series = series[0];
  if (!series && req.url){
    try { series = new URL(req.url, 'http://localhost').searchParams.get('series'); } catch (e) {}
  }
  series = String(series || 'DGS10').toUpperCase();
  if (!ALLOWED_SERIES.has(series)) return sendJson(res, 400, { error: 'series not allowed' });

  let limit = +(req.query && req.query.limit);
  if (!isFinite(limit) || limit <= 0) limit = 30;
  limit = Math.max(5, Math.min(100, Math.floor(limit)));

  const url = FRED_API + '?series_id=' + encodeURIComponent(series)
    + '&api_key=' + encodeURIComponent(key)
    + '&file_type=json&sort_order=desc&limit=' + limit;

  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try{
    const upstream = await fetch(url, { method: 'GET', signal: ctrl.signal });
    const j = await upstream.json().catch(function(){ return null; });
    if (!upstream.ok || !j || !Array.isArray(j.observations)){
      return sendJson(res, upstream.ok ? 502 : upstream.status, { error: 'fred upstream failed', series: series });
    }
    const observations = j.observations.map(function(d){
      return { date: d.date, value: (d.value === '.' ? null : +d.value) };
    }).filter(function(d){ return d.value !== null && isFinite(d.value); });
    return sendJson(res, 200, { series: series, observations: observations });
  }catch(e){
    const msg = (e && e.name === 'AbortError') ? 'fred timeout' : String((e && e.message) || e);
    return sendJson(res, 502, { error: msg });
  }finally{
    clearTimeout(timer);
  }
};
