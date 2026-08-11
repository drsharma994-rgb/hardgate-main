/* HARDGATE — /api/trading-stack/* unified desk + gate status. */
import { tradingStackStatus } from './trading-stack-core.mjs';

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

export function tradingStackCapabilities(){
  return {
    ok: true,
    statusRoute: '/api/trading-stack/status',
    repos: tradingStackStatus().repos,
  };
}

export function createTradingStackApi(){
  return async function tradingStackHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      if ((req.method || 'GET').toUpperCase() !== 'GET'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' });
      }
      if (u.pathname === '/api/trading-stack/capabilities'){
        return sendJson(res, 200, tradingStackCapabilities());
      }
      if (u.pathname === '/api/trading-stack/status'){
        return sendJson(res, 200, tradingStackStatus());
      }
      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
