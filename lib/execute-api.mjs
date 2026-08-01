/* HARDGATE — same-origin bracket execution proxy (Node 18+, zero deps). */
import { hgBuildBracketPayload, hgExecuteBackendTarget, hgExecuteAuthHeader } from './execute-core.mjs';

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function readBody(req){
  return new Promise(function(resolve){
    var chunks = [];
    req.on('data', function(c){ chunks.push(c); });
    req.on('end', function(){
      try{
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      }catch(e){ resolve(null); }
    });
    req.on('error', function(){ resolve(null); });
  });
}

export function executeCapabilities(){
  var target = hgExecuteBackendTarget();
  return {
    ok: true,
    ready: !!target,
    mode: target ? 'proxy' : 'none',
    proxyPath: '/api/execute',
    bookLive: !!target,
  };
}

export function createExecuteApi(){
  return async function executeHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method === 'GET' && u.pathname === '/api/execute/capabilities'){
        return sendJson(res, 200, executeCapabilities());
      }

      if (method === 'POST' && u.pathname === '/api/execute'){
        var target = hgExecuteBackendTarget();
        if (!target){
          return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_BACKEND_URL on Render to enable bracket execution' });
        }
        var body = await readBody(req);
        var plan = body && (body.plan || body);
        var payload = hgBuildBracketPayload({
          sym: plan.symbol || plan.sym,
          side: plan.side || plan.dir,
          qty: plan.qty,
          lev: plan.leverage || plan.lev,
          stop: plan.bracket ? plan.bracket.stop : plan.stop,
          t1: plan.bracket ? plan.bracket.takeProfit : plan.t1,
          timestamp: plan.timestamp,
          source: plan.source || 'hardgate-trade-plan',
        });
        if (!payload){
          return sendJson(res, 400, { ok: false, reason: 'sym, side, qty, stop, t1 required' });
        }
        var headers = Object.assign({ 'Content-Type': 'application/json' }, hgExecuteAuthHeader());
        var fwd = await fetch(target, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
        });
        var text = '';
        try{ text = await fwd.text(); }catch(e){}
        return sendJson(res, fwd.ok ? 200 : 502, {
          ok: fwd.ok,
          status: fwd.status,
          payload: payload,
          response: text.slice(0, 500),
        });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
