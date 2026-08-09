/* HARDGATE — /api/tradeos/* HTTP handler (TradeOS MCP proxy). */
import {
  tradeosConfigured,
  TRADEOS_PRESETS,
  routeTradeosQuery,
} from './tradeos-mcp-core.mjs';
import { tradeosCallTool, tradeosHealth, tradeosListTools } from './tradeos-mcp-client.mjs';

const RATE_WINDOW_MS = 60000;
const RATE_MAX_PER_WINDOW = 30;
const __rateBuckets = new Map();

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

function clientKey(req){
  try{
    var xf = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
    if (xf) return String(xf).split(',')[0].trim();
    if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress);
  }catch(e){}
  return 'local';
}

function rateLimited(key){
  var now = Date.now();
  var bucket = __rateBuckets.get(key);
  if (!bucket){ bucket = []; __rateBuckets.set(key, bucket); }
  while (bucket.length && now - bucket[0] > RATE_WINDOW_MS) bucket.shift();
  if (bucket.length >= RATE_MAX_PER_WINDOW) return true;
  bucket.push(now);
  return false;
}

export function tradeosCapabilities(){
  return {
    ok: true,
    configured: tradeosConfigured(),
    url: 'https://ai.tradeos.xyz/api/agent/mcp/mcp-call',
    presets: Object.keys(TRADEOS_PRESETS).map(function(k){
      var p = TRADEOS_PRESETS[k];
      return { id: k, label: p.label, lane: p.lane, tool: p.tool, description: p.description };
    }),
  };
}

export function createTradeosMcpApi(){
  return async function tradeosHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();
      var path = u.pathname;

      if (method === 'GET' && path === '/api/tradeos/capabilities'){
        return sendJson(res, 200, tradeosCapabilities());
      }

      if (method === 'GET' && path === '/api/tradeos/tools'){
        if (!tradeosConfigured()){
          return sendJson(res, 503, { ok: false, reason: 'Set TRADEOS_ACCESS_TOKEN on the server' });
        }
        var listed = await tradeosListTools();
        return sendJson(res, listed.ok ? 200 : 502, listed);
      }

      if (method === 'GET' && path === '/api/tradeos/health'){
        if (!tradeosConfigured()){
          return sendJson(res, 503, { ok: false, configured: false, reason: 'Set TRADEOS_ACCESS_TOKEN on the server' });
        }
        if (rateLimited(clientKey(req))){
          return sendJson(res, 429, { ok: false, reason: 'rate limited — try again in a minute' });
        }
        var health = await tradeosHealth();
        return sendJson(res, health.ok ? 200 : 502, Object.assign({ configured: true }, health));
      }

      if (method === 'POST' && (path === '/api/tradeos/query' || path === '/api/tradeos/tool')){
        if (!tradeosConfigured()){
          return sendJson(res, 503, { ok: false, reason: 'Set TRADEOS_ACCESS_TOKEN on the server' });
        }
        if (rateLimited(clientKey(req))){
          return sendJson(res, 429, { ok: false, reason: 'rate limited — try again in a minute' });
        }

        var body = await readBody(req);
        if (body === null) return sendJson(res, 400, { ok: false, reason: 'invalid JSON body' });

        var routed;
        if (path === '/api/tradeos/tool'){
          var toolName = String((body && body.tool) || '').trim();
          if (!toolName) return sendJson(res, 400, { ok: false, reason: 'tool name required' });
          routed = { tool: toolName, arguments: (body && body.arguments) || {}, meta: { direct: true } };
        }else{
          routed = routeTradeosQuery({
            query: body && body.query,
            preset: body && body.preset,
            context: body && body.context,
          });
        }

        var started = Date.now();
        var out = await tradeosCallTool(routed.tool, routed.arguments);
        return sendJson(res, out.ok ? 200 : 502, {
          ok: out.ok,
          tool: routed.tool,
          meta: routed.meta || null,
          text: out.text || null,
          reason: out.reason || null,
          ms: Date.now() - started,
        });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
