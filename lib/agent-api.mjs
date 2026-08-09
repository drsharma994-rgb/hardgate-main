/* HARDGATE — /api/agents/* workforce desk + swarm control. */
import { agentCapabilities } from './agent-roster.mjs';
import { getAgentStateStore } from './agent-state.mjs';
import { buildDeskFromStore, buildFullDesk, finalizeAgentDesk } from './agent-workforce.mjs';
import { runAgentSwarm } from './agent-brain.mjs';

const CACHE_MS = 2 * 60 * 1000;
let __cache = null;

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function readJsonBody(req){
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

export function createAgentApi(){
  var store = getAgentStateStore();
  store.load();

  return async function agentHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (u.pathname === '/api/agents/capabilities' && method === 'GET'){
        return sendJson(res, 200, agentCapabilities(process.env));
      }

      if (u.pathname === '/api/agents/status' && method === 'GET'){
        return sendJson(res, 200, { ok: true, status: store.status() });
      }

      if (u.pathname === '/api/agents/desk' && method === 'GET'){
        var force = u.searchParams.get('refresh') === '1';
        var enrich = u.searchParams.get('enrich') === '1';
        var now = Date.now();
        if (!force && !enrich && __cache && (now - __cache.at) < CACHE_MS){
          return sendJson(res, 200, { ok: true, desk: __cache.desk, cached: true, ms: 0 });
        }
        var t0 = Date.now();
        var desk = enrich
          ? await buildFullDesk(process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:' + (process.env.PORT || 10000))
          : buildDeskFromStore(null);
        __cache = { at: now, desk: desk };
        return sendJson(res, 200, { ok: true, desk: desk, cached: false, ms: Date.now() - t0 });
      }

      if (u.pathname === '/api/agents/report' && method === 'POST'){
        var body = await readJsonBody(req);
        if (!body || typeof body !== 'object'){
          return sendJson(res, 400, { ok: false, reason: 'invalid json body' });
        }
        store.ingestReport(body);
        if (body.agents || body.desk){
          var desk = body.desk || finalizeAgentDesk({ agents: body.agents, at: body.at, source: 'browser' });
          store.recordSwarmResult({ ok: true, desk: desk, agents: body.agents || {} });
          __cache = { at: Date.now(), desk: desk };
        }
        return sendJson(res, 200, { ok: true, status: store.status() });
      }

      if (u.pathname === '/api/agents/swarm' && method === 'POST'){
        if (store.state.swarmBusy){
          return sendJson(res, 409, { ok: false, reason: 'swarm already running', status: store.status() });
        }
        store.setSwarmBusy(true);
        var siteUrl = process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:' + (process.env.PORT || 10000);
        var t1 = Date.now();
        var result = await runAgentSwarm(siteUrl);
        if (result && result.ok && result.desk){
          store.recordSwarmResult(result);
          __cache = { at: Date.now(), desk: result.desk };
        } else {
          store.setSwarmBusy(false);
        }
        return sendJson(res, 200, Object.assign({ ok: !!(result && result.ok), ms: Date.now() - t1 }, result || {}));
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
