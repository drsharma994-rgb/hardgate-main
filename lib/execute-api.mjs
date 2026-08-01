/* HARDGATE — same-origin bracket execution proxy (Node 18+, zero deps). */
import { hgBuildBracketPayload, hgExecuteBackendTarget, hgExecuteAuthHeader, hgParseExecuteFillResponse } from './execute-core.mjs';

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

function sleep(ms){
  return new Promise(function(resolve){ setTimeout(resolve, ms); });
}

async function forwardExecute(target, payload, headers){
  var last = { ok: false, status: 0, text: '' };
  for (var attempt = 0; attempt < 2; attempt++){
    if (attempt) await sleep(500);
    try{
      var fwd = await fetch(target, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });
      var text = '';
      try{ text = await fwd.text(); }catch(e){}
      last = { ok: fwd.ok, status: fwd.status, text: text };
      if (fwd.ok || (fwd.status !== 502 && fwd.status !== 503 && fwd.status !== 504)) break;
    }catch(e){
      last = { ok: false, status: 0, text: (e && e.message) || 'fetch error' };
    }
  }
  return last;
}

export function executeCapabilities(){
  var target = hgExecuteBackendTarget();
  return {
    ok: true,
    ready: !!target,
    mode: target ? 'proxy' : 'none',
    proxyPath: '/api/execute',
    bookLive: !!target,
    retries: 1,
    takeProfit2: true,
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
          t2: plan.bracket ? plan.bracket.takeProfit2 : plan.t2,
          timestamp: plan.timestamp,
          source: plan.source || 'hardgate-trade-plan',
          idempotencyKey: plan.idempotencyKey || (body && body.idempotencyKey),
          positionId: plan.positionId,
        });
        if (!payload){
          return sendJson(res, 400, { ok: false, reason: 'sym, side, qty, stop, t1 required' });
        }
        var headers = Object.assign({ 'Content-Type': 'application/json' }, hgExecuteAuthHeader());
        if (payload.idempotencyKey) headers['Idempotency-Key'] = payload.idempotencyKey;
        var fwd = await forwardExecute(target, payload, headers);
        var fill = hgParseExecuteFillResponse(fwd.text);
        return sendJson(res, fwd.ok ? 200 : 502, {
          ok: fwd.ok,
          status: fwd.status,
          payload: payload,
          idempotencyKey: payload.idempotencyKey,
          response: (fwd.text || '').slice(0, 500),
          fill: fill || undefined,
        });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
