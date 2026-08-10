/* HARDGATE — chart vision API + core (offline heuristic + optional Gemini). */
import {
  chartVisionCapabilities,
  chartVisionAnalyze,
  chartVisionRenderSvg,
  chartVisionHeuristic,
  chartVisionFormationBoost,
  chartVisionShouldVeto,
  chartVisionParseModelText,
  chartVisionNormalizeRows,
  chartVisionCacheKey,
} from '../lib/chart-vision-core.mjs';
import { createChartVisionApi } from '../lib/chart-vision-api.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function synthUptrend(n){
  var out = [];
  var p = 100;
  for (var i = 0; i < n; i++){
    p += 0.35 + (i % 3 === 0 ? -0.1 : 0.15);
    out.push({ t: i * 900, o: p - 0.2, h: p + 0.5, l: p - 0.6, c: p, v: 1000 + i });
  }
  return out;
}

console.log('== chart vision core ==');
{
  var rows = synthUptrend(80);
  ok(chartVisionNormalizeRows(rows).length === 80, 'normalize rows');
  var svg = chartVisionRenderSvg(rows, { entry: rows[rows.length - 1].c, stop: rows[0].c });
  ok(svg.indexOf('<svg') >= 0 && svg.indexOf('rect') >= 0, 'render svg candlesticks');
  var h = chartVisionHeuristic(rows, 'long', { gateClean: true, formationScore: 72 });
  ok(h.bias === 'long', 'heuristic long bias on uptrend');
  ok(h.confidence >= 0.5, 'heuristic confidence >= 0.5');
  ok(chartVisionFormationBoost('long', h) >= 4, 'formation boost when aligned');
  ok(chartVisionFormationBoost('short', h) <= -3, 'formation penalty when against');
  ok(!chartVisionShouldVeto('long', h, {}), 'no veto by default env');
  ok(chartVisionShouldVeto('short', { bias: 'long', confidence: 0.85, veto: false }, { CHART_VISION_VETO: '1' }), 'veto high-conf conflict when enabled');
  var partial = chartVisionHeuristic(synthUptrend(30), 'long', {});
  ok(partial.bias === 'long', 'partial 9/21 cascade yields bias before EMA50 warmup');
}

console.log('== parse model json ==');
{
  var parsed = chartVisionParseModelText('{"bias":"long","nextMove":"pullback then long","confidence":0.81,"pattern":"flag","veto":false,"note":"ok"}');
  ok(parsed && parsed.bias === 'long' && parsed.confidence === 0.81, 'parse gemini json');
}

console.log('== analyze offline ==');
{
  var out = await chartVisionAnalyze({
    asset: 'gold',
    symbol: 'XAUTUSD',
    timeframe: '15m',
    dir: 'long',
    rows: synthUptrend(60),
    context: { gateClean: true },
  }, {});
  ok(out.ok && out.analysis && out.analysis.bias, 'analyze returns heuristic analysis offline');
  ok(out.svg && out.svg.indexOf('<svg') >= 0, 'analyze returns svg');
}

console.log('== wiring ==');
{
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(html.indexOf('chart-vision-desk.js') >= 0, 'index loads chart-vision-desk.js');
  ok(/chart-vision-desk\.js/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw shell chart vision desk');
  ok(/createChartVisionApi/.test(srv) && /\/api\/chart-vision\//.test(srv), 'server mounts chart vision api');
  ok(fs.existsSync(path.join(root, 'lib/chart-vision-core.mjs')), 'core module exists');
  ok(/hgChartVisionFormationBoost/.test(fs.readFileSync(path.join(root, 'chart-vision-desk.js'), 'utf8')), 'browser exports formation boost');
  ok(/G\.hgChartVisionFormationBoost\s=/.test(fs.readFileSync(path.join(root, 'chart-vision-desk.js'), 'utf8')), 'formation boost on window');
  ok(/hgChartVisionRefreshGoldCards/.test(fs.readFileSync(path.join(root, 'chart-vision-desk.js'), 'utf8')), 'browser gold card refresh helper');
  var caps = chartVisionCapabilities({});
  ok(caps.analyzeRoute === '/api/chart-vision/analyze', 'capabilities route');
}

console.log('== HTTP handler ==');
{
  var handler = createChartVisionApi();
  var body = JSON.stringify({
    asset: 'crypto',
    symbol: 'BTCUSDT',
    timeframe: '4h',
    dir: 'long',
    rows: synthUptrend(80),
  });
  var resObj = { statusCode: 0, headers: {}, body: '' };
  var req = {
    method: 'POST',
    url: '/api/chart-vision/analyze',
    on: function(ev, fn){
      if (ev === 'data') fn(Buffer.from(body));
      if (ev === 'end') fn();
    },
  };
  var res = {
    setHeader: function(k, v){ resObj.headers[k] = v; },
    end: function(s){ resObj.body = s; },
    get statusCode(){ return resObj.statusCode; },
    set statusCode(n){ resObj.statusCode = n; },
  };
  await handler(req, res);
  var j = JSON.parse(resObj.body);
  ok(resObj.statusCode === 200 && j.ok && j.analysis.bias, 'POST analyze 200');
}

console.log('\n' + pass + ' passed, 0 failed');
