/* HARDGATE — chart vision outcome prediction helpers (heuristic + normalize). */

function fin(v){ return typeof v === 'number' && isFinite(v); }

function avgRange(rows, n){
  if (!rows || !rows.length) return NaN;
  var start = Math.max(0, rows.length - (n || 10));
  var sum = 0, c = 0;
  for (var i = start; i < rows.length; i++){
    var r = rows[i].h - rows[i].l;
    if (fin(r) && r > 0){ sum += r; c++; }
  }
  return c ? sum / c : NaN;
}

/** Independent read on the bar about to form / just forming (from OHLCV context). */
export function chartVisionNextBarOpinion(dir, bias, pattern, rows, context){
  context = context || {};
  rows = rows || [];
  dir = String(dir || '').toLowerCase();
  bias = bias ? String(bias).toLowerCase() : null;
  pattern = String(pattern || 'range');
  if (rows.length < 5) return 'need more bars — next-bar read unavailable';

  var last = rows[rows.length - 1];
  var prev = rows[rows.length - 2];
  var p = last.c;
  var body = last.c - last.o;
  var rng = last.h - last.l;
  var avgR = avgRange(rows, 10);
  var tight = fin(avgR) && avgR > 0 && rng < avgR * 0.65;
  var aligned = !!(bias && dir && bias === dir);
  var conflict = !!(bias && dir && bias !== dir);

  if (pattern.indexOf('pullback') >= 0){
    if (dir === 'long'){
      return aligned
        ? 'next bar: likely lower wick / dip — pullback into support then resume long'
        : 'next bar: may probe lower — wait for reclaim before trusting long setup';
    }
    return aligned
      ? 'next bar: likely upper wick / pop into supply — fade then resume short'
      : 'next bar: may squeeze up — wait for rejection before trusting short setup';
  }
  if (pattern.indexOf('continuation') >= 0){
    if (dir === 'long'){
      return aligned
        ? (tight ? 'next bar: inside/compression bar — break up favors long continuation' : 'next bar: bias green close / higher low — drive toward T1')
        : 'next bar: choppy — structure not fully aligned with long';
    }
    return aligned
      ? (tight ? 'next bar: inside/compression bar — break down favors short continuation' : 'next bar: bias red close / lower high — drive toward T1')
      : 'next bar: choppy — structure not fully aligned with short';
  }
  if (pattern.indexOf('compression') >= 0){
    return 'next bar: coil / inside bar likely — direction of break decides setup validity';
  }
  if (conflict){
    return dir === 'long'
      ? 'next bar: headwind — favor lower wick or weak close vs long thesis'
      : 'next bar: headwind — favor upper wick or weak bounce vs short thesis';
  }
  if (!bias){
    return 'next bar: mixed — no cascade edge; wait for clarity';
  }
  if (body >= 0 && dir === 'long'){
    return aligned ? 'next bar: lean bullish follow-through or shallow dip' : 'next bar: bounce may fade vs short-bias structure';
  }
  if (body < 0 && dir === 'short'){
    return aligned ? 'next bar: lean bearish follow-through or shallow pop' : 'next bar: dip may bounce vs long-bias structure';
  }
  return aligned
    ? 'next bar: lean with setup direction — watch wick vs body'
    : 'next bar: range chop — no strong edge on incoming bar';
}

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
    nextBarOpinion: chartVisionNextBarOpinion(dir, bias, pattern, context.rows || context._rows, context),
  };
}

export function chartVisionMergePrediction(base, extra){
  base = base || {};
  extra = extra || {};
  var out = Object.assign({}, base);
  var keys = ['outcomeProb', 'outcomeLean', 'predictedPath', 'invalidation', 'horizonBars', 'targetHint', 'nextBarOpinion'];
  for (var i = 0; i < keys.length; i++){
    var k = keys[i];
    if (extra[k] != null && extra[k] !== '') out[k] = extra[k];
  }
  if (fin(+out.outcomeProb)) out.outcomeProb = Math.max(0, Math.min(1, +out.outcomeProb));
  if (fin(+out.horizonBars)) out.horizonBars = Math.max(1, Math.floor(+out.horizonBars));
  return out;
}

export function chartVisionNextBarLine(analysis){
  if (!analysis) return '';
  return analysis.nextBarOpinion || analysis.next_bar_opinion || '';
}

export function chartVisionPredictionLine(analysis){
  if (!analysis) return '';
  var parts = [];
  var nb = chartVisionNextBarLine(analysis);
  if (nb) parts.push(nb);
  if (analysis.predictedPath) parts.push(analysis.predictedPath);
  if (analysis.outcomeLean) parts.push(analysis.outcomeLean);
  if (fin(+analysis.outcomeProb)){
    parts.push(Math.round(+analysis.outcomeProb * 100) + '% setup edge');
  }
  if (analysis.horizonBars) parts.push('~' + analysis.horizonBars + ' bars');
  return parts.join(' · ');
}
