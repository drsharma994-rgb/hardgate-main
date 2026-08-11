/* HARDGATE — /api/chart-vision/* OHLCV chart reading + next-move + outcome prediction. */
import {
  chartVisionCapabilities,
  chartVisionAnalyze,
  chartVisionCacheKey,
  chartVisionNormalizeRows,
} from './chart-vision-core.mjs';
import { chartVisionGeminiCall } from './chart-vision-gemini.mjs';
import { chartVisionRenderCapabilities } from './chart-vision-render.mjs';

const CACHE_MS = 8 * 60 * 1000;
const MAX_ROWS = 500;
const MIN_ROWS = 21;
const __cache = new Map();

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function readJsonBody(req){
  return new Promise(function(resolve, reject){
    var chunks = [];
    req.on('data', function(c){ chunks.push(c); });
    req.on('end', function(){
      try{
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      }catch(e){ reject(e); }
    });
    req.on('error', reject);
  });
}

export function createChartVisionApi(){
  return async function chartVisionHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method === 'GET' && u.pathname === '/api/chart-vision/capabilities'){
        var caps = chartVisionCapabilities(process.env);
        var pngCaps = await chartVisionRenderCapabilities(process.env);
        return sendJson(res, 200, Object.assign({}, caps, pngCaps));
      }

      if (method === 'POST' && u.pathname === '/api/chart-vision/analyze'){
        var body = await readJsonBody(req);
        var rows = chartVisionNormalizeRows(body.rows || []);
        if (rows.length < MIN_ROWS){
          return sendJson(res, 400, { ok: false, reason: 'need >= ' + MIN_ROWS + ' OHLCV rows' });
        }
        if (rows.length > MAX_ROWS){
          rows = rows.slice(-MAX_ROWS);
        }
        if (!body.dir && !(body.context && body.context.dir)){
          return sendJson(res, 400, { ok: false, reason: 'dir required' });
        }
        var input = {
          asset: body.asset || 'crypto',
          symbol: body.symbol || body.sym || null,
          timeframe: body.timeframe || body.tf || null,
          dir: body.dir || (body.context && body.context.dir),
          rows: rows,
          entry: body.entry,
          stop: body.stop,
          t1: body.t1,
          pngBase64: body.pngBase64 || null,
          context: body.context || {},
        };
        var key = chartVisionCacheKey(input);
        var force = body.refresh === true || body.refresh === 1 || u.searchParams.get('refresh') === '1';
        var now = Date.now();
        if (!force && __cache.has(key)){
          var hit = __cache.get(key);
          if (now - hit.at < CACHE_MS){
            return sendJson(res, 200, {
              ok: true,
              cached: true,
              key: key,
              analysis: hit.analysis,
              svg: hit.svg,
              visionMode: hit.visionMode || 'heuristic',
              pngUsed: !!hit.pngUsed,
              geminiError: hit.geminiError || null,
              geminiModel: hit.geminiModel || null,
              ms: 0,
            });
          }
        }
        var t0 = Date.now();
        var out = await chartVisionAnalyze(input, process.env, chartVisionGeminiCall);
        __cache.set(key, {
          at: now,
          analysis: out.analysis,
          svg: out.svg,
          visionMode: out.visionMode,
          pngUsed: out.pngUsed,
          geminiError: out.geminiError || null,
          geminiModel: out.geminiModel || null,
        });
        return sendJson(res, 200, {
          ok: true,
          cached: false,
          key: key,
          analysis: out.analysis,
          svg: out.svg,
          visionMode: out.visionMode || 'heuristic',
          pngUsed: !!out.pngUsed,
          geminiError: out.geminiError || null,
          geminiModel: out.geminiModel || null,
          ms: Date.now() - t0,
        });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
