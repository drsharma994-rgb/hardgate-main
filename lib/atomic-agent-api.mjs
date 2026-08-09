/* HARDGATE — /api/atomic/* Atomic Agents desk for Delta + CoinDCX. */
import { atomicCapabilities } from './atomic-agent-core.mjs';
import { getAtomicDesk, runAtomicPipeline } from './atomic-agent-scan.mjs';

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

export function createAtomicAgentApi(){
  return async function atomicHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (u.pathname === '/api/atomic/capabilities' && method === 'GET'){
        return sendJson(res, 200, atomicCapabilities(process.env));
      }

      if ((u.pathname === '/api/atomic/desk' || u.pathname === '/api/atomic/scan') && method === 'GET'){
        var force = u.searchParams.get('refresh') === '1';
        var topN = u.searchParams.get('top');
        var t0 = Date.now();
        var out = topN
          ? await runAtomicPipeline({ topN: +topN })
          : await getAtomicDesk(force);
        return sendJson(res, 200, Object.assign({ ok: true, ms: Date.now() - t0 }, out));
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
