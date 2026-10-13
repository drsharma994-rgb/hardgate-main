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

/** Anatomy of one closed bar. Null when the bar has no measurable range. */
function barAnatomy(bar){
  if (!bar) return null;
  var o = +bar.o, h = +bar.h, l = +bar.l, c = +bar.c;
  if (!fin(o) || !fin(h) || !fin(l) || !fin(c) || !(h > l)) return null;
  var rng = h - l;
  var top = Math.max(o, c);
  var bot = Math.min(o, c);
  return {
    rng: rng,
    body: c - o,
    upper: h - top,
    lower: bot - l,
    closeLoc: (c - l) / rng,
    bull: c >= o,
  };
}

/** Independent read on the bar about to form. Measured from the last closed
    candle. It does not name a price and it does not claim a hit rate. */
export function chartVisionNextBarOpinion(dir, bias, pattern, rows, context){
  context = context || {};
  rows = rows || [];
  dir = String(dir || '').toLowerCase();
  bias = bias ? String(bias).toLowerCase() : null;
  pattern = String(pattern || 'range');
  if (rows.length < 5) return 'need more bars — next-bar read unavailable';

  var last = rows[rows.length - 1];
  var prev = rows[rows.length - 2];
  var a = barAnatomy(last);
  if (!a) return 'next bar unread — the last candle has no range, so it casts no lean';
  var prevA = barAnatomy(prev);
  var avgR = avgRange(rows, 10);
  var tight = fin(avgR) && avgR > 0 && a.rng < avgR * 0.65;
  var wide = fin(avgR) && avgR > 0 && a.rng > avgR * 1.6;
  var inside = !!(prevA && last.h <= prev.h && last.l >= prev.l);
  var engulf = !!(prevA && (
    (a.bull && prev.c < prev.o && last.c >= prev.o && last.o <= prev.c) ||
    (!a.bull && prev.c > prev.o && last.c <= prev.o && last.o >= prev.c)
  ));
  var longLower = a.lower >= a.rng * 0.45 && a.lower > Math.abs(a.body);
  var longUpper = a.upper >= a.rng * 0.45 && a.upper > Math.abs(a.body);
  var conflict = !!(bias && dir && bias !== dir);

  var facts = [];
  if (a.closeLoc >= 0.75) facts.push('close in the top quarter');
  else if (a.closeLoc <= 0.25) facts.push('close in the bottom quarter');
  else facts.push('close mid-range');
  if (longLower) facts.push('long lower wick');
  if (longUpper) facts.push('long upper wick');
  if (inside) facts.push('inside the prior bar');
  if (tight) facts.push('range under 0.65 of the last ten');
  if (wide) facts.push('range over 1.6 of the last ten');
  if (engulf) facts.push(a.bull ? 'bullish engulf of the prior body' : 'bearish engulf of the prior body');

  var lean;
  if (inside || (tight && a.closeLoc > 0.25 && a.closeLoc < 0.75)){
    lean = 'the incoming bar is unread until it leaves the coil';
  } else if (longLower && longUpper){
    lean = 'two-sided wick, so the next bar is not a one-way call';
  } else if (longLower && a.closeLoc >= 0.5){
    lean = 'the low was rejected — a rejection, not a promise the next bar is green';
  } else if (longUpper && a.closeLoc <= 0.5){
    lean = 'the high was rejected — a rejection, not a promise the next bar is red';
  } else if (a.closeLoc >= 0.7){
    lean = (dir === 'short' && conflict)
      ? 'the high close fights the short'
      : 'a high close is a continuation lean, not a measured probability';
  } else if (a.closeLoc <= 0.3){
    lean = (dir === 'long' && conflict)
      ? 'the low close fights the long'
      : 'a low close is a continuation lean, not a measured probability';
  } else {
    lean = 'no directional lean on the incoming bar';
  }

  var ctx = '';
  if (pattern.indexOf('pullback') >= 0 && dir === 'long'){
    ctx = ' Pullback context: a dip that reclaims this close is the long; a close under this low is not.';
  } else if (pattern.indexOf('pullback') >= 0 && dir === 'short'){
    ctx = ' Pullback context: a pop that fails this close is the short; a close over this high is not.';
  } else if (pattern.indexOf('continuation') >= 0 && !inside){
    ctx = dir === 'short'
      ? ' Continuation context still needs the next close to hold under this high.'
      : ' Continuation context still needs the next close to hold over this low.';
  }

  return 'next bar: ' + facts.join(', ') + '. ' + lean + '.' + ctx;
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

  var stop = fin(+context.stop) ? +context.stop : null;
  var t1 = fin(+context.t1) ? +context.t1 : null;
  var invalidation = stop;

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
