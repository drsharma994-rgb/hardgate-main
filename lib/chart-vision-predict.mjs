/* HARDGATE — chart vision outcome prediction helpers (heuristic + normalize). */

function fin(v){ return typeof v === 'number' && isFinite(v); }

export function chartVisionPredictOutcome(dir, bias, confidence, pattern, context){
  context = context || {};
  dir = String(dir || '').toLowerCase();
  bias = bias ? String(bias).toLowerCase() : null;
  pattern = String(pattern || 'range');
  var c = fin(+confidence) ? +confidence : 0.45;
  var aligned = !!(bias && dir && bias === dir);
  var conflict = !!(bias && dir && bias !== dir);

  var outcomeProb = 0.5;
  if (aligned) outcomeProb = Math.min(0.88, 0.42 + c * 0.5);
  else if (conflict) outcomeProb = Math.max(0.12, 0.58 - c * 0.45);
  else outcomeProb = 0.4 + c * 0.15;

  var outcomeLean = 'chop — no clear edge';
  if (aligned && c >= 0.72) outcomeLean = 'favors TP1 before stop';
  else if (aligned && c >= 0.58) outcomeLean = 'lean TP1 — watch pullback';
  else if (conflict && c >= 0.68) outcomeLean = 'favors stop before TP1';
  else if (conflict && c >= 0.55) outcomeLean = 'headwind — reduce size';
  else if (!bias) outcomeLean = 'wait — structure unclear';

  var predictedPath = 'sideways chop';
  if (pattern.indexOf('continuation') >= 0){
    predictedPath = dir === 'long' ? 'drive toward T1 (higher highs)' : 'drive toward T1 (lower lows)';
  } else if (pattern.indexOf('pullback') >= 0){
    predictedPath = dir === 'long' ? 'dip toward EMA zone then push up' : 'bounce into supply then roll down';
  } else if (pattern.indexOf('compression') >= 0){
    predictedPath = 'coil — breakout direction decides outcome';
  }

  var entry = fin(+context.entry) ? +context.entry : null;
  var stop = fin(+context.stop) ? +context.stop : null;
  var t1 = fin(+context.t1) ? +context.t1 : null;
  var invalidation = stop;
  if (!invalidation && entry && dir === 'long') invalidation = entry * 0.995;
  if (!invalidation && entry && dir === 'short') invalidation = entry * 1.005;

  var horizonBars = 8;
  if (pattern.indexOf('pullback') >= 0) horizonBars = 12;
  else if (pattern.indexOf('continuation') >= 0) horizonBars = 6;

  return {
    outcomeProb: +outcomeProb.toFixed(3),
    outcomeLean: outcomeLean,
    predictedPath: predictedPath,
    invalidation: invalidation,
    horizonBars: horizonBars,
    targetHint: fin(t1) ? t1 : null,
  };
}

export function chartVisionMergePrediction(base, extra){
  base = base || {};
  extra = extra || {};
  var out = Object.assign({}, base);
  var keys = ['outcomeProb', 'outcomeLean', 'predictedPath', 'invalidation', 'horizonBars', 'targetHint'];
  for (var i = 0; i < keys.length; i++){
    var k = keys[i];
    if (extra[k] != null && extra[k] !== '') out[k] = extra[k];
  }
  if (fin(+out.outcomeProb)) out.outcomeProb = Math.max(0, Math.min(1, +out.outcomeProb));
  if (fin(+out.horizonBars)) out.horizonBars = Math.max(1, Math.floor(+out.horizonBars));
  return out;
}

export function chartVisionPredictionLine(analysis){
  if (!analysis) return '';
  var parts = [];
  if (analysis.predictedPath) parts.push(analysis.predictedPath);
  if (analysis.outcomeLean) parts.push(analysis.outcomeLean);
  if (fin(+analysis.outcomeProb)){
    parts.push(Math.round(+analysis.outcomeProb * 100) + '% setup edge');
  }
  if (analysis.horizonBars) parts.push('~' + analysis.horizonBars + ' bars');
  return parts.join(' · ');
}
