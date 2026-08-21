/* HARDGATE — /api/xm/* XM / MT5 gold price proxy + OMNIGOLD order bot. */
import { xmFetchGoldCandles, xmFetchGoldTick, xmTraderStatus } from './xm-trader-fetch.mjs';
import { checkApiAuth } from './api-auth.mjs';
import {
  ogXmBotStatus,
  ogXmExecuteTickets,
  ogXmBotCfg,
} from './omnigold-xm-bot.mjs';

const MAX_BODY = 32 * 1024;

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

function readBody(req){
  return new Promise(function(resolve){
    var chunks = [];
    var size = 0;
    var overflow = false;
    req.on('data', function(c){
      size += c.length;
      if (size > MAX_BODY){
        overflow = true;
        return;
      }
      chunks.push(c);
    });
    req.on('end', function(){
      if (overflow) return resolve({ overflow: true });
      try{
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve({ body: raw ? JSON.parse(raw) : {} });
      }catch(e){ resolve({ body: null }); }
    });
    req.on('error', function(){ resolve({ body: null }); });
  });
}

function statusPayload(){
  var st = xmTraderStatus();
  st.bot = ogXmBotStatus();
  st.routes = ['/api/xm/status', '/api/xm/candles', '/api/xm/tick', '/api/xm/bot', '/api/xm/order'];
  return st;
}

export function createXmTraderApi(){
  return async function xmTraderHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method === 'GET' && u.pathname === '/api/xm/status'){
        return sendJson(res, 200, statusPayload(), 0);
      }

      if (method === 'GET' && u.pathname === '/api/xm/bot'){
        return sendJson(res, 200, ogXmBotStatus(), 0);
      }

      if (method === 'GET' && u.pathname === '/api/xm/candles'){
        var tf = u.searchParams.get('tf') || u.searchParams.get('res') || '15m';
        var count = +(u.searchParams.get('count') || 200);
        var out = await xmFetchGoldCandles(tf, count);
        if (!out.ok){
          return sendJson(res, out.reason === 'xm_not_configured' ? 503 : 502, out, 0);
        }
        return sendJson(res, 200, out, 45);
      }

      if (method === 'GET' && u.pathname === '/api/xm/tick'){
        var tick = await xmFetchGoldTick();
        if (!tick.ok){
          return sendJson(res, tick.reason === 'xm_not_configured' ? 503 : 502, tick, 0);
        }
        return sendJson(res, 200, tick, 15);
      }

      if (method === 'POST' && (u.pathname === '/api/xm/order' || u.pathname === '/api/xm/bot/send')){
        var auth = checkApiAuth(req);
        if (!auth.ok) return sendJson(res, auth.status, { ok: false, reason: auth.reason }, 0);
        var parsed = await readBody(req);
        if (parsed.overflow) return sendJson(res, 413, { ok: false, reason: 'payload too large' }, 0);
        var body = parsed.body;
        if (!body) return sendJson(res, 400, { ok: false, reason: 'invalid json' }, 0);
        var tickets = Array.isArray(body.tickets) ? body.tickets
                    : (body.ticket ? [body.ticket] : []);
        if (!tickets.length && body.plan && (body.dir || body.side)){
          tickets = [body];
        }
        if (!tickets.length){
          return sendJson(res, 400, { ok: false, reason: 'OMNIGOLD ticket required' }, 0);
        }
        var cfg = ogXmBotCfg();
        if (body.volume != null){
          tickets = tickets.map(function(t){
            var copy = Object.assign({}, t);
            copy.volume = body.volume;
            return copy;
          });
        }
        var run = await ogXmExecuteTickets(tickets, {
          dryRun: cfg.dryRun,
        });
        var code = run.ok ? 200 : (run.reason && /ticket/i.test(run.reason) ? 400 : 422);
        if (run.results && run.results.length && run.results.every(function(r){ return r && r.reason === 'not an OMNIGOLD ticket'; })){
          code = 422;
        }
        return sendJson(res, code, run, 0);
      }

      if (method !== 'GET' && method !== 'POST'){
        return sendJson(res, 405, { ok: false, reason: 'method not allowed' }, 0);
      }
      return sendJson(res, 404, { ok: false, reason: 'not found' }, 0);
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' }, 0);
    }
  };
}
