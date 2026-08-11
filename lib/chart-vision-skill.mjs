/* HARDGATE — crypto chart-reading skill layer.
   Hybrid pipeline inspired by open-source best practice (deterministic TA +
   multimodal LLM read): qrak/LLM_trader chart generator + claim validation,
   TauricResearch/TradingAgents technical-analyst separation.
   Heuristic stats always computed; Gemini refines when API key is present. */

function fin(v){ return typeof v === 'number' && isFinite(v); }

function last(arr){ return (arr && arr.length) ? arr[arr.length - 1] : NaN; }

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
  return 100 - (100 / (1 + (gains / period) / (losses / period)));
}

function volZ(rows, n){
  n = n || 20;
  if (!rows || rows.length < n + 1) return NaN;
  var vols = rows.map(function(r){ return fin(+r.v) ? +r.v : 0; });
  var slice = vols.slice(-n);
  var mean = slice.reduce(function(a, b){ return a + b; }, 0) / n;
  var varc = 0;
  for (var i = 0; i < slice.length; i++) varc += Math.pow(slice[i] - mean, 2);
  var sd = Math.sqrt(varc / n);
  if (!(sd > 0)) return 0;
  return (vols[vols.length - 1] - mean) / sd;
}

/** Deterministic TA bundle — LLM claims are cross-checked against this (LLM_trader-style). */
export function chartVisionTaStats(rows, plan){
  rows = rows || [];
  plan = plan || {};
  if (rows.length < 10) return { ok: false, reason: 'short history' };

  var closes = rows.map(function(r){ return r.c; });
  var e9s = emaSeries(closes, 9);
  var e21s = emaSeries(closes, 21);
  var e50s = emaSeries(closes, 50);
  var e9 = last(e9s), e21 = last(e21s), e50 = last(e50s);
  var p = last(closes);
  var r14 = rsi(closes, 14);
  var vz = volZ(rows, 20);

  var bias = null;
  if (fin(e9) && fin(e21) && fin(e50)){
    if (e9 > e21 && e21 > e50) bias = 'long';
    else if (e9 < e21 && e21 < e50) bias = 'short';
  } else if (fin(e9) && fin(e21)){
    bias = e9 > e21 ? 'long' : 'short';
  }

  var hi = -Infinity, lo = Infinity;
  for (var i = Math.max(0, rows.length - 20); i < rows.length; i++){
    if (rows[i].h > hi) hi = rows[i].h;
    if (rows[i].l < lo) lo = rows[i].l;
  }
  var pos20 = (hi > lo) ? (p - lo) / (hi - lo) : 0.5;

  var last3 = rows.slice(-3).map(function(b){
    return {
      o: b.o, h: b.h, l: b.l, c: b.c,
      body: b.c - b.o,
      closePos: (b.h > b.l) ? (b.c - b.l) / (b.h - b.l) : 0.5,
    };
  });

  var spreadAtr = null;
  if (rows.length >= 15){
    var trs = [];
    for (var ti = rows.length - 14; ti < rows.length; ti++){
      var cur = rows[ti], prevC = rows[ti - 1].c;
      trs.push(Math.max(cur.h - cur.l, Math.abs(cur.h - prevC), Math.abs(cur.l - prevC)));
    }
    var atr = trs.reduce(function(a, b){ return a + b; }, 0) / trs.length;
    if (fin(atr) && atr > 0 && fin(e21)) spreadAtr = Math.abs(p - e21) / atr;
  }

  return {
    ok: true,
    last: p,
    ema9: e9, ema21: e21, ema50: e50,
    rsi14: r14,
    volZ: vz,
    bias: bias,
    pos20: pos20,
    spreadAtr: spreadAtr,
    last3: last3,
    entry: fin(+plan.entry) ? +plan.entry : p,
    stop: fin(+plan.stop) ? +plan.stop : null,
    t1: fin(+plan.t1) ? +plan.t1 : null,
  };
}

function yPath(vals, lo, hi, yTop, yBot){
  return vals.map(function(v, i){
    if (!fin(v)) return null;
    var y = yTop + (hi - v) / (hi - lo) * (yBot - yTop);
    return { x: i, y: y };
  });
}

function polylinePts(pts, xFn){
  var s = '';
  for (var i = 0; i < pts.length; i++){
    if (!pts[i] || !fin(pts[i].y)) continue;
    s += (s ? ' ' : '') + xFn(i) + ',' + pts[i].y.toFixed(2);
  }
  return s;
}

/** Rich OHLCV SVG — EMA stack, volume strip, entry/stop/T1 (qrak/LLM_trader-style chart generator). */
export function chartVisionRenderProSvg(rows, plan, stats){
  rows = rows || [];
  if (rows.length < 8) return '';
  stats = stats || chartVisionTaStats(rows, plan);
  var slice = rows.slice(-80);
  var w = 820, h = 420, pad = 28;
  var volH = 56;
  var priceTop = pad;
  var priceBot = h - pad - volH - 8;

  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i < slice.length; i++){
    if (slice[i].l < lo) lo = slice[i].l;
    if (slice[i].h > hi) hi = slice[i].h;
  }
  if (plan && fin(+plan.entry)){ lo = Math.min(lo, +plan.entry); hi = Math.max(hi, +plan.entry); }
  if (plan && fin(+plan.stop)){ lo = Math.min(lo, +plan.stop); hi = Math.max(hi, +plan.stop); }
  if (plan && fin(+plan.t1)){ lo = Math.min(lo, +plan.t1); hi = Math.max(hi, +plan.t1); }
  if (!(hi > lo)) return '';

  var span = hi - lo;
  function yPrice(v){ return priceTop + (hi - v) / span * (priceBot - priceTop); }
  function xBar(i){ return pad + i / Math.max(1, slice.length - 1) * (w - pad * 2); }
  var bw = Math.max(2, (w - pad * 2) / slice.length * 0.55);

  var body = '';
  var closes = slice.map(function(r){ return r.c; });
  var e9 = emaSeries(closes, 9);
  var e21 = emaSeries(closes, 21);
  var e50 = emaSeries(closes, 50);
  var off = rows.length - slice.length;

  function emaLine(series, color){
    var pts = [];
    for (var j = 0; j < slice.length; j++){
      var idx = off + j;
      if (!fin(series[idx])) continue;
      pts.push({ y: yPrice(series[idx]) });
    }
    var line = polylinePts(pts, function(j){ return xBar(j).toFixed(1); });
    if (line) body += '<polyline fill="none" stroke="' + color + '" stroke-width="1.2" opacity="0.85" points="' + line + '"/>';
  }
  emaLine(e9, '#fbbf24');
  emaLine(e21, '#38bdf8');
  emaLine(e50, '#a78bfa');

  for (var k = 0; k < slice.length; k++){
    var b = slice[k];
    var cx = xBar(k);
    var col = b.c >= b.o ? '#22c55e' : '#ef4444';
    body += '<line x1="' + cx + '" y1="' + yPrice(b.h) + '" x2="' + cx + '" y2="' + yPrice(b.l)
      + '" stroke="' + col + '" stroke-width="1"/>';
    var yo = yPrice(Math.max(b.o, b.c));
    var yc = yPrice(Math.min(b.o, b.c));
    body += '<rect x="' + (cx - bw / 2) + '" y="' + yc + '" width="' + bw + '" height="' + Math.max(1, yo - yc)
      + '" fill="' + col + '"/>';
  }

  var vmax = 0;
  for (var vi = 0; vi < slice.length; vi++) if (slice[vi].v > vmax) vmax = slice[vi].v;
  if (vmax > 0){
    var vBase = h - pad - 4;
    for (var vk = 0; vk < slice.length; vk++){
      var vh = (slice[vk].v / vmax) * (volH - 4);
      var vx = xBar(vk) - bw / 2;
      var vc = slice[vk].c >= slice[vk].o ? '#166534' : '#991b1b';
      body += '<rect x="' + vx + '" y="' + (vBase - vh) + '" width="' + bw + '" height="' + vh + '" fill="' + vc + '" opacity="0.7"/>';
    }
  }

  function hline(price, color, dash){
    if (!fin(+price)) return;
    var y = yPrice(+price);
    body += '<line x1="' + pad + '" y1="' + y + '" x2="' + (w - pad) + '" y2="' + y
      + '" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="' + (dash || '4 3') + '"/>';
  }
  hline(plan && plan.entry, '#38bdf8');
  hline(plan && plan.stop, '#f87171');
  hline(plan && plan.t1, '#4ade80', '2 2');

  var title = 'HARDGATE CHART VISION · EMA9/21/50 · vol · RSI ' + (fin(stats.rsi14) ? stats.rsi14.toFixed(1) : 'n/a');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h
    + '" viewBox="0 0 ' + w + ' ' + h + '" style="background:#0d1117">'
    + '<text x="' + pad + '" y="16" fill="#94a3b8" font-size="11" font-family="monospace">' + title + '</text>'
    + body + '</svg>';
}

export function chartVisionSkillPrompt(input, stats, heuristic){
  input = input || {};
  stats = stats || {};
  heuristic = heuristic || {};
  var ctx = input.context || {};
  return [
    'You are HARDGATE crypto chart vision — a technical analyst reading OHLCV candlesticks.',
    'Method: deterministic indicators are pre-computed (trust them over visual guess). Your job is structure + next-bar read.',
    'Asset: ' + (input.asset || 'crypto') + ' · Symbol: ' + (input.symbol || input.sym || '?'),
    'Timeframe: ' + (input.timeframe || input.tf || '?') + ' · Setup direction: ' + (input.dir || 'unknown'),
    'Gate: ' + (ctx.gateClean || ctx.gatesPassed >= 7 ? '7/7 CLEAN' : (ctx.gatesPassed >= 6 ? '6/7 NEAR' : 'forming')),
    'Plan entry/stop/t1: ' + [stats.entry, stats.stop, stats.t1].map(function(v){ return fin(v) ? v : 'n/a'; }).join(' / '),
    'Computed TA (authoritative): ' + JSON.stringify({
      emaStack: stats.bias,
      ema9: stats.ema9,
      ema21: stats.ema21,
      ema50: stats.ema50,
      rsi14: stats.rsi14,
      volZ: stats.volZ,
      pos20: stats.pos20,
      spreadAtr: stats.spreadAtr,
      last3Bars: stats.last3,
    }),
    'Heuristic read (confirm or refine, do not blindly copy): bias=' + (heuristic.bias || 'null')
      + ' pattern=' + (heuristic.pattern || '?') + ' conf=' + (heuristic.confidence || 0),
    'Return JSON ONLY with keys:',
    'bias (long|short|null), nextMove, confidence (0-1), pattern (e.g. bull flag, bear pullback, range, sweep reclaim),',
    'veto (true ONLY if setup direction clearly wrong vs structure), note, entry, stop, t1,',
    'outcomeProb (0-1 TP1 before stop), outcomeLean, predictedPath, horizonBars,',
    'nextBarOpinion (one sentence on the INCOMING bar: wick/body bias, independent of gate tally).',
    'When a PNG chart is attached: read candle structure, EMA stack, volume expansion, and proximity to entry/stop.',
    'Be honest when structure is mixed — lower confidence instead of guessing.',
  ].join('\n');
}

export const CHART_VISION_SKILL_REF = 'qrak/LLM_trader + TauricResearch/TradingAgents (hybrid TA + vision)';
