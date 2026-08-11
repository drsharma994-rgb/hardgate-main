/* HARDGATE — chart vision core: OHLCV → SVG/PNG + structured next-move + outcome prediction.
   Heuristic path works offline (tests/CI); GEMINI_API_KEY enables LLM refinement (PNG when Puppeteer available). */

import { chartVisionPredictOutcome, chartVisionMergePrediction } from './chart-vision-predict.mjs';
import { chartVisionSvgToPng } from './chart-vision-render.mjs';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function fin(v){ return typeof v === 'number' && isFinite(v); }

function last(arr){
  return (arr && arr.length) ? arr[arr.length - 1] : NaN;
}

function emaSeries(values, period){
  if (!values || values.length < period) return [];
  var k = 2 / (period + 1);
  var out = [];
  var sum = 0;
  for (var i = 0; i < period; i++) sum += values[i];
  var prev = sum / period;
  out[period - 1] = prev;
  for (var j = period; j < values.length; j++){
    prev = values[j] * k + prev * (1 - k);
    out[j] = prev;
  }
  return out;
}

function rsi(values, period){
  period = period || 14;
  if (!values || values.length < period + 1) return NaN;
  var gains = 0, losses = 0;
  for (var i = values.length - period; i < values.length; i++){
    var d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (!losses) return gains > 0 ? 99 : 50;
  var rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function chartVisionBiasFromEmas(e9, e21, e50){
  if (fin(e9) && fin(e21) && fin(e50)){
    if (e9 > e21 && e21 > e50) return 'long';
    if (e9 < e21 && e21 < e50) return 'short';
  }
  /* Partial cascade when history is shorter than EMA50 warmup (common on 15m). */
  if (fin(e9) && fin(e21)){
    if (e9 > e21) return 'long';
    if (e9 < e21) return 'short';
  }
  return null;
}

export function chartVisionVetoEnabled(env){
  env = env || process.env;
  if (env.CHART_VISION_VETO === '0' || env.CHART_VISION_VETO === 'false') return false;
  return true;
}

export function chartVisionCapabilities(env){
  env = env || process.env;
  var key = !!(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim());
  var pngDisabled = env.CHART_VISION_PNG === '0' || env.CHART_VISION_PNG === 'false';
  return {
    ok: true,
    gemini: key,
    model: env.GEMINI_MODEL || DEFAULT_MODEL,
    analyzeRoute: '/api/chart-vision/analyze',
    heuristicFallback: true,
    outcomePrediction: true,
    pngVisionRequested: !pngDisabled,
    vetoEnabled: chartVisionVetoEnabled(env),
  };
}

export function chartVisionEnrichWithPrediction(analysis, dir, context){
  if (!analysis) return analysis;
  context = context || {};
  var rows = context.rows || context._rows || (analysis.indicators ? null : null);
  var pred = chartVisionPredictOutcome(
    dir,
    analysis.bias,
    analysis.confidence,
    analysis.pattern,
    Object.assign({}, context || {}, {
      entry: analysis.entry != null ? analysis.entry : (context && context.entry),
      stop: analysis.stop != null ? analysis.stop : (context && context.stop),
      t1: analysis.t1 != null ? analysis.t1 : (context && context.t1),
      rows: rows,
      _rows: rows,
    })
  );
  return chartVisionMergePrediction(analysis, pred);
}

export function chartVisionNormalizeRows(rows){
  if (!Array.isArray(rows)) return [];
  return rows.map(function(r, i){
    return {
      t: fin(+r.t) ? +r.t : i,
      o: +r.o, h: +r.h, l: +r.l, c: +r.c,
      v: fin(+r.v) ? +r.v : 0,
    };
  }).filter(function(r){
    return fin(r.o) && fin(r.h) && fin(r.l) && fin(r.c);
  });
}

export function chartVisionRenderSvg(rows, plan){
  rows = chartVisionNormalizeRows(rows);
  if (rows.length < 8) return '';
  var slice = rows.slice(-80);
  var w = 780, h = 320, pad = 24;
  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i < slice.length; i++){
    if (slice[i].l < lo) lo = slice[i].l;
    if (slice[i].h > hi) hi = slice[i].h;
  }
  if (!(hi > lo)) return '';
  var span = hi - lo;
  function y(v){ return pad + (hi - v) / span * (h - pad * 2); }
  function x(i){ return pad + i / Math.max(1, slice.length - 1) * (w - pad * 2); }
  var body = '';
  for (var j = 0; j < slice.length; j++){
    var b = slice[j];
    var cx = x(j);
    var bw = Math.max(2, (w - pad * 2) / slice.length * 0.55);
    var yo = y(Math.max(b.o, b.c));
    var yc = y(Math.min(b.o, b.c));
    var col = b.c >= b.o ? '#22c55e' : '#ef4444';
    body += '<line x1="' + cx + '" y1="' + y(b.h) + '" x2="' + cx + '" y2="' + y(b.l)
      + '" stroke="' + col + '" stroke-width="1"/>';
    body += '<rect x="' + (cx - bw / 2) + '" y="' + yc + '" width="' + bw + '" height="' + Math.max(1, yo - yc)
      + '" fill="' + col + '"/>';
  }
  if (plan && fin(+plan.entry)){
    var ye = y(+plan.entry);
    body += '<line x1="' + pad + '" y1="' + ye + '" x2="' + (w - pad) + '" y2="' + ye
      + '" stroke="#38bdf8" stroke-dasharray="4 3" stroke-width="1.5"/>';
  }
  if (plan && fin(+plan.stop)){
    var ys = y(+plan.stop);
    body += '<line x1="' + pad + '" y1="' + ys + '" x2="' + (w - pad) + '" y2="' + ys
      + '" stroke="#f87171" stroke-dasharray="4 3" stroke-width="1.5"/>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h
    + '" viewBox="0 0 ' + w + ' ' + h + '" style="background:#0d1117">'
    + body + '</svg>';
}

export function chartVisionHeuristic(rows, dir, context){
  rows = chartVisionNormalizeRows(rows);
  context = context || {};
  dir = String(dir || '').toLowerCase();
  if (rows.length < 20){
    return {
      bias: null, nextMove: 'insufficient bars', confidence: 0,
      pattern: 'unknown', veto: false, note: 'need >= 20 bars', source: 'heuristic',
    };
  }
  var closes = rows.map(function(r){ return r.c; });
  var e9 = last(emaSeries(closes, 9));
  var e21 = last(emaSeries(closes, 21));
  var e50 = last(emaSeries(closes, 50));
  var p = last(closes);
  var r14 = rsi(closes, 14);
  var bias = chartVisionBiasFromEmas(e9, e21, e50);
  var partialCascade = !!(fin(e9) && fin(e21) && !fin(e50));
  var hi = -Infinity, lo = Infinity;
  for (var i = Math.max(0, rows.length - 20); i < rows.length; i++){
    if (rows[i].h > hi) hi = rows[i].h;
    if (rows[i].l < lo) lo = rows[i].l;
  }
  var pos = (hi > lo) ? (p - lo) / (hi - lo) : 0.5;
  var pattern = 'range';
  if (bias === 'long' && pos >= 0.55) pattern = 'bull continuation';
  else if (bias === 'long' && pos <= 0.35) pattern = 'bull pullback';
  else if (bias === 'short' && pos <= 0.45) pattern = 'bear continuation';
  else if (bias === 'short' && pos >= 0.65) pattern = 'bear pullback';
  else if (!bias) pattern = 'compression';

  var aligned = bias && dir && bias === dir;
  var confidence = 0.45;
  if (aligned) confidence += 0.2;
  if (aligned && ((dir === 'long' && fin(r14) && r14 >= 45 && r14 <= 68)
    || (dir === 'short' && fin(r14) && r14 >= 32 && r14 <= 55))) confidence += 0.12;
  if (context.gateClean) confidence += 0.08;
  if (fin(context.formationScore) && context.formationScore >= 70) confidence += 0.05;
  if (partialCascade) confidence = Math.max(0, confidence - 0.06);
  if (bias && dir && bias !== dir) confidence = Math.max(0.25, confidence - 0.25);
  confidence = Math.max(0, Math.min(0.92, confidence));

  var nextMove = aligned
    ? (pattern.indexOf('pullback') >= 0 ? 'pullback then resume ' + dir : 'continuation ' + dir)
    : (bias ? ('structure favors ' + bias + ' — conflicts with ' + (dir || 'setup')) : 'wait for cascade clarity');

  var base = {
    bias: bias,
    nextMove: nextMove,
    confidence: +confidence.toFixed(3),
    pattern: pattern,
    veto: false,
    note: 'EMA stack ' + (bias || 'mixed') + (partialCascade ? ' (9/21 partial)' : '')
      + ' · RSI ' + (fin(r14) ? r14.toFixed(1) : 'n/a')
      + ' · 20-bar position ' + Math.round(pos * 100) + '%',
    entry: fin(+context.entry) ? +context.entry : p,
    stop: fin(+context.stop) ? +context.stop : null,
    t1: fin(+context.t1) ? +context.t1 : null,
    source: 'heuristic',
    indicators: { ema9: e9, ema21: e21, ema50: e50, rsi14: r14, last: p },
  };
  return chartVisionEnrichWithPrediction(base, dir, context);
}

export function chartVisionParseModelText(text){
  if (!text) return null;
  var raw = String(text).trim();
  var m = raw.match(/\{[\s\S]*\}/);
  if (m) raw = m[0];
  try{
    var j = JSON.parse(raw);
    return {
      bias: j.bias != null ? String(j.bias).toLowerCase() : null,
      nextMove: j.nextMove || j.next_move || j.action || '',
      confidence: fin(+j.confidence) ? Math.max(0, Math.min(1, +j.confidence)) : 0.5,
      pattern: j.pattern || j.structure || 'unknown',
      veto: !!j.veto,
      note: j.note || j.reason || '',
      entry: fin(+j.entry) ? +j.entry : null,
      stop: fin(+j.stop) ? +j.stop : null,
      t1: fin(+j.t1) ? +j.t1 : null,
      outcomeProb: fin(+j.outcomeProb) ? Math.max(0, Math.min(1, +j.outcomeProb))
        : (fin(+j.outcome_prob) ? Math.max(0, Math.min(1, +j.outcome_prob)) : null),
      outcomeLean: j.outcomeLean || j.outcome_lean || j.lean || '',
      predictedPath: j.predictedPath || j.predicted_path || j.path || '',
      invalidation: fin(+j.invalidation) ? +j.invalidation : null,
      horizonBars: fin(+j.horizonBars) ? Math.max(1, Math.floor(+j.horizonBars))
        : (fin(+j.horizon_bars) ? Math.max(1, Math.floor(+j.horizon_bars)) : null),
      targetHint: fin(+j.targetHint) ? +j.targetHint : (fin(+j.target_hint) ? +j.target_hint : null),
      nextBarOpinion: j.nextBarOpinion || j.next_bar_opinion || j.nextBar || '',
      source: 'gemini',
    };
  }catch(e){
    return null;
  }
}

export function chartVisionFormationBoost(dir, analysis){
  if (!analysis || !dir) return 0;
  var side = String(dir).toLowerCase();
  var bias = analysis.bias ? String(analysis.bias).toLowerCase() : null;
  var c = fin(+analysis.confidence) ? +analysis.confidence : 0;
  if (!bias || c < 0.55) return 0;
  if (bias === side){
    if (c >= 0.82) return 12;
    if (c >= 0.68) return 8;
    if (c >= 0.55) return 4;
    return 0;
  }
  if (c >= 0.75) return -10;
  if (c >= 0.62) return -6;
  return -3;
}

export function chartVisionShouldVeto(dir, analysis, env){
  if (!chartVisionVetoEnabled(env)) return false;
  if (!analysis || !dir) return false;
  if (analysis.veto) return true;
  var bias = analysis.bias ? String(analysis.bias).toLowerCase() : null;
  var side = String(dir).toLowerCase();
  var c = fin(+analysis.confidence) ? +analysis.confidence : 0;
  return !!(bias && bias !== side && c >= 0.78);
}

export function chartVisionCacheKey(input){
  input = input || {};
  var rows = chartVisionNormalizeRows(input.rows || []);
  var lastT = rows.length ? rows[rows.length - 1].t : 0;
  return [
    input.asset || 'crypto',
    input.symbol || input.sym || '?',
    input.timeframe || input.tf || '?',
    input.dir || '?',
    lastT,
  ].join('|');
}

export function chartVisionBuildPrompt(input, stats){
  var ctx = input.context || {};
  return [
    'You are HARDGATE chart vision — read the candlestick context and return JSON ONLY.',
    'Asset: ' + (input.asset || 'crypto') + ' · Symbol: ' + (input.symbol || input.sym || '?'),
    'Timeframe: ' + (input.timeframe || input.tf || '?') + ' · Proposed setup direction: ' + (input.dir || 'unknown'),
    'Gate clean: ' + (ctx.gateClean ? 'yes' : 'no') + ' · Formation score: ' + (ctx.formationScore != null ? ctx.formationScore : 'n/a'),
    'Stats: ' + JSON.stringify(stats || {}),
    'Return strict JSON keys: bias (long|short|null), nextMove (string), confidence (0-1), pattern (string),',
    'veto (boolean, true only if setup direction is clearly wrong), note (string), entry, stop, t1 (numbers or null),',
    'outcomeProb (0-1 probability setup reaches TP1 before stop), outcomeLean (short string),',
    'predictedPath (expected path over next bars), invalidation (price level), horizonBars (integer),',
    'nextBarOpinion (string — independent read on the incoming/forming bar for the setup direction).',
    'When a PNG chart image is attached, read candle structure from the image; use stats as confirmation.',
  ].join('\n');
}

export async function chartVisionAnalyze(input, env, geminiFn){
  env = env || process.env;
  input = input || {};
  var rows = chartVisionNormalizeRows(input.rows || []);
  var dir = input.dir || (input.context && input.context.dir);
  var plan = {
    entry: input.entry || (input.context && input.context.entry),
    stop: input.stop || (input.context && input.context.stop),
    t1: input.t1 || (input.context && input.context.t1),
  };
  var ctx = Object.assign({}, input.context || {}, plan, { rows: rows, _rows: rows });
  var svg = chartVisionRenderSvg(rows, plan);
  var base = chartVisionHeuristic(rows, dir, ctx);
  var stats = base.indicators || {};
  var visionMode = 'heuristic';
  var pngBase64 = input.pngBase64 || null;
  var useGemini = !!(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim() && typeof geminiFn === 'function');

  if (useGemini && !pngBase64 && svg){
    try{
      pngBase64 = await chartVisionSvgToPng(svg, env);
    }catch(e){}
  }

  if (useGemini){
    try{
      var prompt = chartVisionBuildPrompt(input, Object.assign({}, stats, {
        heuristicBias: base.bias,
        heuristicPattern: base.pattern,
        heuristicConfidence: base.confidence,
        heuristicOutcomeProb: base.outcomeProb,
        heuristicPredictedPath: base.predictedPath,
      }));
      var gem = await geminiFn({
        apiKey: String(env.GEMINI_API_KEY).trim(),
        model: env.GEMINI_MODEL || DEFAULT_MODEL,
        prompt: prompt,
        svg: svg,
        pngBase64: pngBase64,
      });
      var parsed = chartVisionParseModelText(gem && gem.text);
      if (parsed){
        parsed.note = parsed.note || base.note;
        parsed.source = pngBase64 ? 'gemini-png' : 'gemini-svg';
        if (!parsed.bias) parsed.bias = base.bias;
        parsed = chartVisionEnrichWithPrediction(parsed, dir, ctx);
        parsed = chartVisionApplyVetoFlag(parsed, dir, env);
        visionMode = pngBase64 ? 'gemini-png' : 'gemini-svg';
        return {
          ok: true,
          analysis: parsed,
          svg: svg,
          visionMode: visionMode,
          pngUsed: !!pngBase64,
          ms: gem.ms || 0,
        };
      }
    }catch(e){
      base.note = (base.note || '') + ' · gemini: ' + ((e && e.message) || 'failed');
    }
  }

  return {
    ok: true,
    analysis: chartVisionApplyVetoFlag(base, dir, env),
    svg: svg,
    visionMode: visionMode,
    pngUsed: !!pngBase64,
    ms: 0,
  };
}

function chartVisionApplyVetoFlag(analysis, dir, env){
  if (!analysis) return analysis;
  var explicit = !!analysis.veto;
  if (!chartVisionVetoEnabled(env)){
    analysis.veto = false;
    return analysis;
  }
  analysis.veto = explicit || chartVisionShouldVeto(dir, Object.assign({}, analysis, { veto: false }), env);
  return analysis;
}
