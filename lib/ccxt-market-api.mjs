/* HARDGATE — /api/ccxt/* public market desk for formation analysis. */
import { fetchCcxtDesk, ccxtMarketConfigured } from './ccxt-market-fetch.mjs';
import { hgCcxtMarketExchangeId, hgCcxtDeskSymbols } from './ccxt-config.mjs';

const CACHE_MS = 3 * 60 * 1000;
let __cache = null;

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=180');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

export function ccxtCapabilities(){
  return {
    ok: true,
    marketExchange: hgCcxtMarketExchangeId(),
    symbols: hgCcxtDeskSymbols(),
    deskRoute: '/api/ccxt/desk',
    configured: ccxtMarketConfigured(),
  };
}

export function createCcxtApi(){
  return async function ccxtHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      if ((req.method || 'GET').toUpperCase() !== 'GET'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' });
      }
      if (u.pathname === '/api/ccxt/capabilities'){
        return sendJson(res, 200, ccxtCapabilities());
      }
      if (u.pathname === '/api/ccxt/desk'){
        var force = u.searchParams.get('refresh') === '1';
        var now = Date.now();
        if (!force && __cache && (now - __cache.at) < CACHE_MS){
          return sendJson(res, 200, { ok: true, desk: __cache.desk, cached: true, ms: 0 });
        }
        var t0 = Date.now();
        var desk = await fetchCcxtDesk();
        __cache = { at: now, desk: desk };
        return sendJson(res, 200, { ok: true, desk: desk, cached: false, ms: Date.now() - t0 });
      }
      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
