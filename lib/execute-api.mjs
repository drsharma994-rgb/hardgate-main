/* HARDGATE — same-origin bracket execution proxy (Node 18+, optional ccxt). */
import { hgBuildBracketPayload, hgExecuteBackendTarget, hgExecuteAuthHeader, hgParseExecuteFillResponse, hgExecuteCcxtConfigured } from './execute-core.mjs';
import { hgExecuteFillPollTarget, hgPollExecuteFill } from './execute-poll.mjs';
import { hgCcxtExecutePayload, hgCcxtExecutorFromEnv } from './hardgate-executor.mjs';
import { checkApiAuth, apiSecret } from './api-auth.mjs';
import { runRiskRules, riskRulesCfgFromEnv } from './risk-rules.mjs';
import { hgIdempotencyGet, hgIdempotencySet } from './idempotency.mjs';
import { hgPrepareExecutePayload, hgReleaseExecuteBudget, hgExecutePreflightFlags } from './execute-preflight.mjs';

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
  var ccxtOn = hgExecuteCcxtConfigured();
  var target = hgExecuteBackendTarget();
  var fillPoll = hgExecuteFillPollTarget();
  var preflight = hgExecutePreflightFlags();
  return {
    ok: true,
    authRequired: true,
    authConfigured: !!apiSecret(),
    ready: !!(ccxtOn || target),
    mode: ccxtOn ? 'ccxt' : (target ? 'proxy' : 'none'),
    ccxt: ccxtOn ? {
      exchange: process.env.EXECUTE_CCXT_EXCHANGE || '',
      sandbox: process.env.EXECUTE_CCXT_SANDBOX === '1' || process.env.EXECUTE_CCXT_SANDBOX === 'true',
    } : undefined,
    preflight: preflight,
    proxyPath: '/api/execute',
    bookLive: !!(ccxtOn || target),
    fillPoll: !!fillPoll,
    fillPollPath: fillPoll ? '/api/execute/fill-status' : undefined,
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

      if (method === 'GET' && u.pathname === '/api/execute/fill-status'){
        var pollTarget = hgExecuteFillPollTarget();
        if (!pollTarget){
          return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_BACKEND_URL or EXECUTE_FILL_POLL_URL to poll broker fills' });
        }
        var pollQuery = {
          positionId: u.searchParams.get('positionId') || undefined,
          idempotencyKey: u.searchParams.get('idempotencyKey') || undefined,
          sym: u.searchParams.get('sym') || u.searchParams.get('symbol') || undefined,
          side: u.searchParams.get('side') || u.searchParams.get('dir') || undefined,
          qty: u.searchParams.get('qty') ? +u.searchParams.get('qty') : undefined,
          mark: u.searchParams.get('mark') ? +u.searchParams.get('mark') : undefined,
          notionalUsd: u.searchParams.get('notionalUsd') ? +u.searchParams.get('notionalUsd') : undefined,
        };
        var pollRun = await hgPollExecuteFill(pollQuery);
        return sendJson(res, pollRun.ok ? 200 : (pollRun.status && pollRun.status < 500 ? pollRun.status : 502), pollRun);
      }

      if (method === 'POST' && u.pathname === '/api/execute'){
        var auth = checkApiAuth(req);
        if (!auth.ok) return sendJson(res, auth.status, { ok: false, reason: auth.reason });
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
          entry: plan.entry || plan.limitPrice,
          timestamp: plan.timestamp,
          source: plan.source || 'hardgate-trade-plan',
          idempotencyKey: plan.idempotencyKey || (body && body.idempotencyKey),
          positionId: plan.positionId,
        });
        if (!payload){
          return sendJson(res, 400, { ok: false, reason: 'sym, side, qty, stop, t1 required' });
        }
        if (plan.twapSlices != null) payload.twapSlices = plan.twapSlices;
        if (plan.twapIntervalMs != null) payload.twapIntervalMs = plan.twapIntervalMs;
        if (plan.chase != null) payload.chase = plan.chase;
        if (plan.vwapSizing != null) payload.vwapSizing = plan.vwapSizing;
        if (payload.idempotencyKey){
          var cached = hgIdempotencyGet(payload.idempotencyKey);
          if (cached) return sendJson(res, 200, cached);
        }
        var maxUsd = +(process.env.EXECUTE_MAX_NOTIONAL_USD || 0);
        var notional = (+payload.qty || 0) * (+payload.entry || 0);
        var riskRun = runRiskRules({
          manualHalt: process.env.HARDGATE_TRADING_HALT === '1',
          notionalUsd: notional,
        }, riskRulesCfgFromEnv());
        if (!riskRun.ok){
          return sendJson(res, 422, { ok: false, reason: riskRun.reason, violations: riskRun.violations });
        }
        if (maxUsd > 0 && notional > maxUsd){
          return sendJson(res, 422, { ok: false,
            reason: 'notional ' + Math.round(notional) +
                    ' exceeds EXECUTE_MAX_NOTIONAL_USD ' + maxUsd });
        }

        if (hgExecuteCcxtConfigured()){
          var exec = hgCcxtExecutorFromEnv();
          var pre = await hgPrepareExecutePayload(exec, payload);
          if (!pre.ok){
            return sendJson(res, 422, { ok: false, reason: pre.reason, violations: [{ rule: 'budget', reason: pre.reason }] });
          }
          payload = pre.payload;
          var budgetLockId = pre.budgetLockId;
          try{
            var ccxtRun = await hgCcxtExecutePayload(payload);
            var ccxtBody = {
              ok: ccxtRun.ok,
              status: ccxtRun.ok ? 200 : 502,
              payload: payload,
              idempotencyKey: payload.idempotencyKey,
              orderId: ccxtRun.orderId,
              response: ccxtRun.response || ccxtRun.reason || '',
              fill: ccxtRun.fill || undefined,
              reason: ccxtRun.ok ? undefined : ccxtRun.reason,
              preflight: pre.preflightNotes,
            };
            if (ccxtRun.ok && payload.idempotencyKey) hgIdempotencySet(payload.idempotencyKey, ccxtBody);
            return sendJson(res, ccxtRun.ok ? 200 : 502, ccxtBody);
          }finally{
            hgReleaseExecuteBudget(budgetLockId);
          }
        }

        var target = hgExecuteBackendTarget();
        if (!target){
          return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_CCXT_* or EXECUTE_BACKEND_URL on Render to enable bracket execution' });
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
