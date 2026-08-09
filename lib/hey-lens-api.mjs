/* HARDGATE — /api/hey/* Lens social desk for formation sentiment. */
import { fetchHeyLensDesk, heyLensConfigured, heyLensAuthorsFromEnv, HEY_LENS_API_URL } from './hey-lens-fetch.mjs';

const CACHE_MS = 5 * 60 * 1000;
let __cache = null;

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

export function heyLensCapabilities(){
  return {
    ok: true,
    lensApi: process.env.HEY_LENS_API_URL || HEY_LENS_API_URL,
    authors: heyLensAuthorsFromEnv(),
    deskRoute: '/api/hey/desk',
    configured: heyLensConfigured(),
  };
}

export function createHeyLensApi(){
  return async function heyHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      if ((req.method || 'GET').toUpperCase() !== 'GET'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' });
      }
      if (u.pathname === '/api/hey/capabilities'){
        return sendJson(res, 200, heyLensCapabilities());
      }
      if (u.pathname === '/api/hey/desk'){
        var force = u.searchParams.get('refresh') === '1';
        var now = Date.now();
        if (!force && __cache && (now - __cache.at) < CACHE_MS){
          return sendJson(res, 200, { ok: true, desk: __cache.desk, cached: true, ms: 0 });
        }
        var t0 = Date.now();
        var desk = await fetchHeyLensDesk();
        __cache = { at: now, desk: desk };
        return sendJson(res, 200, { ok: true, desk: desk, cached: false, ms: Date.now() - t0 });
      }
      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
