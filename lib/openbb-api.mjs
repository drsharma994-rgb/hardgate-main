/* HARDGATE — /api/openbb/* desk macro for formation analysis. */
import { openbbConfigured, fetchDeskMacro } from './openbb-desk-fetch.mjs';

const CACHE_MS = 5 * 60 * 1000;
let __cache = null;

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

export function openbbCapabilities(){
  return {
    ok: true,
    openbbBackend: openbbConfigured(),
    url: process.env.OPENBB_API_URL || null,
    deskRoute: '/api/openbb/desk',
  };
}

export function createOpenbbApi(){
  return async function openbbHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      if ((req.method || 'GET').toUpperCase() !== 'GET'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' });
      }
      if (u.pathname === '/api/openbb/capabilities'){
        return sendJson(res, 200, openbbCapabilities());
      }
      if (u.pathname === '/api/openbb/desk'){
        var force = u.searchParams.get('refresh') === '1';
        var now = Date.now();
        if (!force && __cache && (now - __cache.at) < CACHE_MS){
          return sendJson(res, 200, { ok: true, desk: __cache.desk, cached: true, ms: 0 });
        }
        var t0 = Date.now();
        var desk = await fetchDeskMacro(null);
        __cache = { at: now, desk: desk };
        return sendJson(res, 200, { ok: true, desk: desk, cached: false, ms: Date.now() - t0 });
      }
      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
