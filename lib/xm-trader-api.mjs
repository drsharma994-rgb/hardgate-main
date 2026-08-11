/* HARDGATE — /api/xm/* XM / MT5 gold price proxy (same-origin for gold tabs). */
import { xmFetchGoldCandles, xmFetchGoldTick, xmTraderStatus } from './xm-trader-fetch.mjs';

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

export function createXmTraderApi(){
  return async function xmTraderHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      if ((req.method || 'GET').toUpperCase() !== 'GET'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' }, 0);
      }

      if (u.pathname === '/api/xm/status'){
        return sendJson(res, 200, xmTraderStatus(), 30);
      }

      if (u.pathname === '/api/xm/candles'){
        var tf = u.searchParams.get('tf') || u.searchParams.get('res') || '15m';
        var count = +(u.searchParams.get('count') || 200);
        var out = await xmFetchGoldCandles(tf, count);
        if (!out.ok){
          return sendJson(res, out.reason === 'xm_not_configured' ? 503 : 502, out, 0);
        }
        return sendJson(res, 200, out, 45);
      }

      if (u.pathname === '/api/xm/tick'){
        var tick = await xmFetchGoldTick();
        if (!tick.ok){
          return sendJson(res, tick.reason === 'xm_not_configured' ? 503 : 502, tick, 0);
        }
        return sendJson(res, 200, tick, 15);
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' }, 0);
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' }, 0);
    }
  };
}
