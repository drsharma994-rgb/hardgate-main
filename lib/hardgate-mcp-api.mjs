/* HARDGATE — /api/hardgate/* MCP-style read tools + OOS replay helper. */
import { hardgateMcpCapabilities, hardgateMcpCallTool } from './hardgate-mcp-core.mjs';
import { hgReplaySweepOos } from './gate-replay-oos.mjs';
import { fetchCcxtDesk } from './ccxt-market-fetch.mjs';
import { hgFundingArbDeskFromLegs } from './ccxt-funding-arb.mjs';

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

export function createHardgateMcpApi(){
  return async function hardgateHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method === 'GET' && u.pathname === '/api/hardgate/capabilities'){
        return sendJson(res, 200, hardgateMcpCapabilities());
      }

      if (method === 'GET' && u.pathname === '/api/hardgate/funding-arb'){
        var desk = await fetchCcxtDesk();
        var arb = hgFundingArbDeskFromLegs(desk.legs || desk);
        return sendJson(res, 200, { ok: true, arb: arb, deskAt: desk.at });
      }

      if (method === 'POST' && u.pathname === '/api/hardgate/mcp'){
        var body = await readBody(req);
        if (!body || !body.tool){
          return sendJson(res, 400, { ok: false, reason: 'tool required' });
        }
        var result = hardgateMcpCallTool(body.tool, body.arguments || body.args || {}, body.context || {});
        return sendJson(res, 200, result);
      }

      if (method === 'POST' && u.pathname === '/api/hardgate/replay-oos'){
        var replayBody = await readBody(req);
        if (!replayBody || !replayBody.replay){
          return sendJson(res, 400, { ok: false, reason: 'replay object required' });
        }
        var sweep = hgReplaySweepOos(
          replayBody.replay,
          replayBody.gate || 'G6',
          replayBody.thresholds || [1.5, 1.75, 2, 2.25, 2.5],
          replayBody.cmp || 'min',
          replayBody.opts || {},
        );
        return sendJson(res, 200, { ok: true, sweep: sweep });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
