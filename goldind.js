/* =========================================================================
HARDGATE — goldind.js
GOLD SCALP indicator engine: pure, DOM-free, fetch-free Smart-Money-Concept
and classical detectors for gold scalping, plus the confluence composite
goldScalpSetup. Loaded as a classic script BEFORE goldscalp.js.

Every export is TOTAL: never throws, tolerates null/empty/short/flat/garbage
input, and returns null (or a 'NONE' state) when there is no signal — nothing
is ever fabricated. Indicator math reuses indicators.js/indicators2.js globals
(ema/atr/rsi) when they are loaded and falls back to identical local copies
when they are not, so this file also works standalone in vm test contexts.

Candle rows everywhere: {t:<unix seconds>, o,h,l,c,v}, ascending.

Exports (all on window):
  goldFVG(rows)            — 3-candle Fair Value Gaps, unmitigated only
  goldOrderBlocks(rows)    — order blocks (last opposing candle before a
                             >=1.5xATR displacement through a 20-bar swing)
                             + breaker blocks (failed OB closed through ->
                             bias flip)
  goldSweeps(rows)         — liquidity sweeps: wick beyond a prior 25-bar
                             swing high/low, close back inside -> reversal
  goldKillzone(date|ms|s)  — ICT killzone stamp (London/NY overlap highest)
  goldVWAP(rows, anchor)   — anchored VWAP + 1 vol-sigma bands + close side
  goldRibbon(rows)         — EMA 20/50/200 mode; below 200 -> sellOnly
  goldIchimoku(rows)       — price vs cloud, cloud thickness = S/R strength
  goldMFI(rows)            — BW Market Facilitation Index bar colour
                             (GREEN = volume-driven trend, SQUAT/pink = high
                             volume + low range = manipulation/breakout watch)
  goldVolSqueeze(rows)     — Bollinger-inside-Keltner squeeze + the expansion
                             close outside the bands
  goldAsianRange(rows)     — 00:00-07:00 GMT box + London breakout state
  goldRSIGold(rows)        — RSI(14) with gold 75/25 extremes + price/RSI
                             divergence (exhaustion)
  goldCCI(rows)            — CCI(20) +/-100 extremes + zero-line cross
  goldStochRSI(rows)       — StochRSI pullback timer (only meaningful inside
                             an established trend — the composite enforces it)
  goldSeason(date|ms|s)    — seasonal bias note (Jan-Feb strongest, spring/
                             early-summer consolidation); context, never a vote
  goldScalpSetup({rows15m, rows1h, rows4h, now, news}) — the composite:
                             >=3 independent agreeing reads -> {dir, entry,
                             stop, t1, t2, rr, grade, strategy, confluence,
                             killzone, newsCaution}; stops 1.5-2x ATR(14) 15m
                             (never tighter), targets 1.5R/2.5R snapped to
                             opposing swept structure when one sits between
                             entry and target. Long/short symmetric.
  goldScalpSetups(same inp)  — MULTI-STRATEGY candidates: one candidate per
                             strategy trigger (sweep reversal, OB/breaker
                             retest, FVG fill, session-VWAP bounce/rejection,
                             EMA ribbon pullback, Asian-range breakout, RSI
                             75/25 divergence), each with ATR-stop levels,
                             1.5R/2.5R targets, a deterministic STRUCTURAL
                             conviction id (strategy|dir|structural anchor
                             rounded to whole dollars — swept level / OB edge
                             / FVG edge / session VWAP / 20-EMA / Asian box
                             edge / divergence pivot; entry drift INSIDE the
                             same zone reproduces the same id) and plain-
                             language why/invalidates. -> [] when nothing.
  goldRankSetups(cands, ctx) — transparent confluence tally ranker (reads +
                             killzone weight + news penalty + macro tilt +
                             PAXG-basis positioning + seasonality + F&G),
                             -> {ranked, best}. Pure, total.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

/* ---------------- local indicator fallbacks (identical math to indicators.js) ---------------- */
function __emaLocal(vals, p){
  var out = new Array(vals.length).fill(NaN);
  if (!vals || vals.length < p) return out;
  var k = 2/(p+1), sum = 0, i;
  for (i = 0; i < p; i++) sum += vals[i];
  var e = sum/p;
  out[p-1] = e;
  for (i = p; i < vals.length; i++){ e = vals[i]*k + e*(1-k); out[i] = e; }
  return out;
}
function __rsiLocal(vals, p){
  p = p || 14;
  var out = new Array(vals.length).fill(NaN);
  if (!vals || !vals.length) return out;
  var g = 0, l = 0;
  for (var i = 1; i < vals.length; i++){
    var d = vals[i] - vals[i-1];
    if (i <= p){
      g += Math.max(d, 0); l += Math.max(-d, 0);
      if (i === p){ out[i] = (g === 0 && l === 0) ? 50 : 100 - 100/(1 + (g/p)/((l/p) || 1e-12)); g /= p; l /= p; }
    } else {
      g = (g*(p-1) + Math.max(d, 0))/p; l = (l*(p-1) + Math.max(-d, 0))/p;
      out[i] = (g === 0 && l === 0) ? 50 : 100 - 100/(1 + g/(l || 1e-12));
    }
  }
  return out;
}
function __atrLocal(rows, p){
  p = p || 14;
  var out = new Array(rows.length).fill(NaN), a = null;
  for (var i = 1; i < rows.length; i++){
    var r = rows[i], q = rows[i-1];
    if (!r || !q) continue;
    var tr = Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
    if (!isFinite(tr)) continue;
    if (a === null){
      if (i >= p){
        var s = 0, ok = true;
        for (var k = i-p+1; k <= i; k++){
          var rk = rows[k], rj = rows[k-1];
          if (!rk || !rj){ ok = false; break; }
          var tk = Math.max(rk.h - rk.l, Math.abs(rk.h - rj.c), Math.abs(rk.l - rj.c));
          if (!isFinite(tk)){ ok = false; break; }
          s += tk;
        }
        if (ok){ a = s/p; out[i] = a; }
      }
    } else { a = (a*(p-1) + tr)/p; out[i] = a; }
  }
  return out;
}
/* reuse the house implementations when indicators.js is loaded */
var _ema = (typeof ema === 'function') ? ema : __emaLocal;
var _rsi = (typeof rsi === 'function') ? rsi : __rsiLocal;
var _atr = (typeof atr === 'function') ? atr : __atrLocal;

function __rows(rows){
  if (!Array.isArray(rows) || !rows.length) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (r && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c)) out.push(r);
  }
  return out.length ? out : null;
}
function __closes(rows){ return rows.map(function(r){ return r.c; }); }
function __last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }
function __toMs(d){
  try{
    if (d === null || d === undefined) return Date.now();
    if (d instanceof Date) return d.getTime();
    var n = +d;
    if (!isFinite(n)) return NaN;
    return (n < 1e12) ? n*1000 : n;   /* unix seconds -> ms */
  }catch(e){ return NaN; }
}
function __pivots(vals, win){
  var out = [];
  if (!vals || vals.length < 2*win + 1) return out;
  for (var i = win; i < vals.length - win; i++){
    var v = vals[i];
    if (!isFinite(v)) continue;
    var isH = true, isL = true;
    for (var k = 1; k <= win; k++){
      if (!(isFinite(vals[i-k]) && isFinite(vals[i+k]))){ isH = false; isL = false; break; }
      if (!(v > vals[i-k] && v > vals[i+k])) isH = false;
      if (!(v < vals[i-k] && v < vals[i+k])) isL = false;
    }
    if (isH) out.push({ i: i, type: 'high', v: v });
    if (isL) out.push({ i: i, type: 'low', v: v });
  }
  return out;
}

/* ============================ 1) Fair Value Gaps ============================
   3-candle imbalance: bullish gap when low[i+1] > high[i-1] (zone
   [high[i-1], low[i+1]]), bearish when high[i+1] < low[i-1]. Only UNMITIGATED
   gaps are returned (a later bar reaching fully through the zone fills it),
   most recent first. -> [{dir, top, bottom, mid, i, age}] | null. */
function goldFVG(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return null;
    var n = rows.length, out = [];
    var start = Math.max(1, n - 80);
    for (var i = start; i < n - 1; i++){
      var a = rows[i-1], b = rows[i+1];
      var dir = null, top = NaN, bottom = NaN;
      if (b.l > a.h){ dir = 'bullish'; bottom = a.h; top = b.l; }
      else if (b.h < a.l){ dir = 'bearish'; top = a.l; bottom = b.h; }
      if (!dir || !(top > bottom)) continue;
      var filled = false;
      for (var j = i + 2; j < n; j++){
        if (dir === 'bullish' && rows[j].l <= bottom){ filled = true; break; }
        if (dir === 'bearish' && rows[j].h >= top){ filled = true; break; }
      }
      if (!filled) out.push({ dir: dir, top: top, bottom: bottom, mid: (top+bottom)/2, i: i, age: n-1-i });
    }
    if (!out.length) return null;
    out.sort(function(x, y){ return x.age - y.age; });
    return out.slice(0, 5);
  }catch(e){ return null; }
}

/* ======================= 2) Order Blocks + Breakers =======================
   OB = last opposing candle before a displacement bar (range >= 1.5xATR14)
   that closes through the prior 20-bar swing. Unmitigated OBs are demand/
   supply; an OB later CLOSED through is a failed OB -> breaker, bias flips.
   -> {bullish:[{top,bottom,i,age}], bearish:[...], breakers:[{dir,top,bottom,i,age}]} | null. */
function goldOrderBlocks(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return null;
    var n = rows.length;
    var aArr = _atr(rows, 14);
    var bull = [], bear = [], breakers = [];
    var start = Math.max(21, n - 60);
    for (var j = start; j < n - 1; j++){
      var disp = rows[j], ob = rows[j-1], a = aArr[j];
      if (!isFinite(a) || !(a > 0)) continue;
      if (disp.h - disp.l < 1.5 * a) continue;
      var sH = -Infinity, sL = Infinity;
      for (var k = Math.max(0, j - 20); k < j; k++){ if (rows[k].h > sH) sH = rows[k].h; if (rows[k].l < sL) sL = rows[k].l; }
      var dir = null;
      if (disp.c > disp.o && disp.c > sH && ob.c < ob.o) dir = 'bullish';
      else if (disp.c < disp.o && disp.c < sL && ob.c > ob.o) dir = 'bearish';
      if (!dir) continue;
      var top = ob.h, bottom = ob.l, age = n - 1 - j;
      /* mitigation / failure walk */
      var mitigated = false, failedAt = -1;
      for (var m = j + 1; m < n; m++){
        if (dir === 'bullish'){
          if (rows[m].c < bottom){ failedAt = m; break; }        /* closed through -> breaker */
          if (rows[m].l <= bottom){ mitigated = true; break; }   /* wicked through -> filled */
        } else {
          if (rows[m].c > top){ failedAt = m; break; }
          if (rows[m].h >= top){ mitigated = true; break; }
        }
      }
      if (failedAt >= 0){
        breakers.push({ dir: dir === 'bullish' ? 'bearish' : 'bullish', top: top, bottom: bottom, i: j, age: n - 1 - failedAt });
      } else if (!mitigated){
        (dir === 'bullish' ? bull : bear).push({ top: top, bottom: bottom, i: j, age: age });
      }
    }
    bull.sort(function(x, y){ return x.age - y.age; });
    bear.sort(function(x, y){ return x.age - y.age; });
    breakers.sort(function(x, y){ return x.age - y.age; });
    if (!bull.length && !bear.length && !breakers.length) return null;
    return { bullish: bull.slice(0, 3), bearish: bear.slice(0, 3), breakers: breakers.slice(0, 3) };
  }catch(e){ return null; }
}

/* ============================ 3) Liquidity Sweeps ============================
   Wick beyond the prior 25-bar swing high/low, close back inside -> stop
   hunt + reversal. Bullish sweep = swept the swing LOW and reclaimed (long
   fuel); bearish = swept the swing HIGH and rejected.
   -> {dir, level, barsAgo, lowSweep, highSweep, all:[...]} | null (dir = most
   recent sweep within the last 10 bars). */
function goldSweeps(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 27) return null;
    var n = rows.length, all = [];
    var start = Math.max(25, n - 40);
    for (var i = start; i < n; i++){
      var pH = -Infinity, pL = Infinity;
      for (var k = Math.max(0, i - 25); k < i; k++){ if (rows[k].h > pH) pH = rows[k].h; if (rows[k].l < pL) pL = rows[k].l; }
      if (!isFinite(pH) || !isFinite(pL)) continue;
      var r = rows[i], ago = n - 1 - i;
      if (r.l < pL && r.c > pL) all.push({ dir: 'bullish', level: pL, barsAgo: ago });
      else if (r.h > pH && r.c < pH) all.push({ dir: 'bearish', level: pH, barsAgo: ago });
    }
    if (!all.length) return null;
    all.sort(function(x, y){ return x.barsAgo - y.barsAgo; });
    var recent = null, lowSweep = null, highSweep = null;
    for (var q = 0; q < all.length; q++){
      var s = all[q];
      if (recent === null && s.barsAgo <= 10) recent = s;
      if (lowSweep === null && s.dir === 'bullish' && s.barsAgo <= 25) lowSweep = s;
      if (highSweep === null && s.dir === 'bearish' && s.barsAgo <= 25) highSweep = s;
    }
    if (!recent) return { dir: null, level: NaN, barsAgo: null, lowSweep: lowSweep, highSweep: highSweep, all: all.slice(0, 5) };
    return { dir: recent.dir, level: recent.level, barsAgo: recent.barsAgo,
             lowSweep: lowSweep, highSweep: highSweep, all: all.slice(0, 5) };
  }catch(e){ return null; }
}

/* ============================ 4) ICT Killzones ============================
   Always returns a stamp object (never null): London/NY overlap 13:00-17:00
   GMT weights highest (3), London 07:00-10:00 (2), NY AM run-in 10:00-13:00
   (1), Asian range-building and off-hours (0). */
function goldKillzone(d){
  try{
    var ms = __toMs(d);
    if (!isFinite(ms)) return { zone: 'OFF', weight: 0, hourGMT: NaN, label: 'OFF-HOURS' };
    var dt = new Date(ms);
    var h = dt.getUTCHours() + dt.getUTCMinutes()/60;
    var zone = 'OFF', weight = 0, label = 'OFF-HOURS';
    if (h >= 13 && h < 17){ zone = 'OVERLAP'; weight = 3; label = 'LONDON/NY OVERLAP'; }
    else if (h >= 7 && h < 10){ zone = 'LONDON'; weight = 2; label = 'LONDON KILLZONE'; }
    else if (h >= 10 && h < 13){ zone = 'NY_AM'; weight = 1; label = 'NY AM'; }
    else if (h >= 0 && h < 7){ zone = 'ASIAN'; weight = 0; label = 'ASIAN RANGE'; }
    return { zone: zone, weight: weight, hourGMT: Math.floor(h), label: label };
  }catch(e){ return { zone: 'OFF', weight: 0, hourGMT: NaN, label: 'OFF-HOURS' }; }
}

/* ============================ 5) Anchored VWAP ============================
   Typical-price VWAP from anchorIndex to the last bar, +/-1 volume-weighted
   sigma bands; pos = last close vs value ('AT' within 0.25 sigma).
   -> {value, upper, lower, stdev, anchor, pos} | null. */
function goldVWAP(rows, anchorIndex){
  try{
    rows = __rows(rows);
    if (!rows) return null;
    var n = rows.length;
    var a = Math.floor(anchorIndex);
    if (!isFinite(a) || a < 0) a = 0;
    if (a >= n) return null;
    var sumWV = 0, sumV = 0, sumTP = 0, cnt = 0, i, r, tp, v;
    for (i = a; i < n; i++){
      r = rows[i]; tp = (r.h + r.l + r.c)/3;
      if (!isFinite(tp)) continue;
      v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      sumWV += tp*v; sumV += v; sumTP += tp; cnt++;
    }
    if (!cnt) return null;
    var val = sumV > 0 ? sumWV/sumV : sumTP/cnt;
    var varSum = 0;
    for (i = a; i < n; i++){
      r = rows[i]; tp = (r.h + r.l + r.c)/3;
      if (!isFinite(tp)) continue;
      v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      varSum += (sumV > 0 ? v : 1) * (tp - val) * (tp - val);
    }
    var sd = Math.sqrt(varSum/(sumV > 0 ? sumV : cnt));
    var c = rows[n-1].c;
    var pos = (sd > 0 && Math.abs(c - val) <= 0.25*sd) ? 'AT' : (c > val ? 'ABOVE' : (c < val ? 'BELOW' : 'AT'));
    return { value: val, upper: val + sd, lower: val - sd, stdev: sd, anchor: a, pos: pos };
  }catch(e){ return null; }
}

/* ============================ 6) EMA ribbon 20/50/200 ============================
   50/200 defines the macro mode; below the 200 -> sellOnly (longs suppressed).
   pullback20 = close within 0.5xATR of the 20 EMA (pullback entry zone).
   -> {mode:'BULL'|'BEAR'|'MIXED'|'NONE', above20, above50, above200, sellOnly,
       pullback20, e20, e50, e200}. */
function goldRibbon(rows){
  var out = { mode: 'NONE', above20: null, above50: null, above200: null,
              sellOnly: false, pullback20: false, e20: NaN, e50: NaN, e200: NaN };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 50) return out;
    var c = __closes(rows), n = c.length;
    var e20 = __last(_ema(c, 20)), e50 = __last(_ema(c, 50)), e200 = __last(_ema(c, 200));
    var cl = c[n-1], a = __last(_atr(rows, 14));
    out.e20 = e20; out.e50 = e50; out.e200 = e200;
    if (!isFinite(cl)) return out;
    if (isFinite(e20)) out.above20 = cl > e20;
    if (isFinite(e50)) out.above50 = cl > e50;
    if (isFinite(e200)){ out.above200 = cl > e200; out.sellOnly = cl < e200; }
    if (isFinite(e20) && isFinite(a) && a > 0) out.pullback20 = Math.abs(cl - e20) <= 0.5*a;
    if (isFinite(e200)){
      if (out.above200 === true && isFinite(e50) && e50 > e200) out.mode = 'BULL';
      else if (out.above200 === false && isFinite(e50) && e50 < e200) out.mode = 'BEAR';
      else out.mode = 'MIXED';
    } else if (isFinite(e20) && isFinite(e50)){
      if (cl > e20 && e20 > e50) out.mode = 'BULL';
      else if (cl < e20 && e20 < e50) out.mode = 'BEAR';
      else out.mode = 'MIXED';
    }
    return out;
  }catch(e){ return out; }
}

/* ============================ 7) Ichimoku cloud ============================
   Unshifted cloud (same convention as indicators2.js ichimoku). Price above/
   below = bull/bear; cloud thickness = S/R strength.
   -> {state:'ABOVE'|'BELOW'|'INSIDE'|'NONE', cloudTop, cloudBot, thickness,
       thickPct, cloudBull, tkCross}. */
function goldIchimoku(rows){
  var out = { state: 'NONE', cloudTop: NaN, cloudBot: NaN, thickness: NaN,
              thickPct: NaN, cloudBull: null, tkCross: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 52) return out;
    var n = rows.length, i, h, l;
    function mid(len, idx){
      var hh = -Infinity, ll = Infinity;
      for (var k = idx - len + 1; k <= idx; k++){
        h = rows[k].h; l = rows[k].l;
        if (!isFinite(h) || !isFinite(l)) return NaN;
        if (h > hh) hh = h; if (l < ll) ll = l;
      }
      return (hh + ll)/2;
    }
    i = n - 1;
    var t = mid(9, i), kj = mid(26, i), sb = mid(52, i);
    if (!isFinite(t) || !isFinite(kj) || !isFinite(sb)) return out;
    var sa = (t + kj)/2;
    var top = Math.max(sa, sb), bot = Math.min(sa, sb), c = rows[i].c;
    out.cloudTop = top; out.cloudBot = bot;
    out.thickness = top - bot;
    out.thickPct = (c > 0) ? (top - bot)/c*100 : NaN;
    out.cloudBull = sa > sb;
    out.tkCross = (t >= kj) ? 'BULL' : 'BEAR';
    out.state = (c > top) ? 'ABOVE' : ((c < bot) ? 'BELOW' : 'INSIDE');
    return out;
  }catch(e){ return out; }
}

/* ======================= 8) Market Facilitation Index =======================
   BW MFI = (h-l)/v. vs the prior bar: GREEN = mfi up + volume up (volume-
   driven trend), SQUAT (pink) = volume up + mfi down (high volume, low range
   = manipulation/breakout watch), FAKE = mfi up + volume down, FADE = both down.
   -> {last, mfi, series:[last <=5 labels]}. */
function goldMFI(rows){
  var out = { last: 'NONE', mfi: NaN, series: [] };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 2) return out;
    var n = rows.length, labels = [], mfiLast = NaN;
    for (var i = 1; i < n; i++){
      var r = rows[i], q = rows[i-1];
      var v = (isFinite(r.v) && r.v > 0) ? r.v : NaN;
      var vq = (isFinite(q.v) && q.v > 0) ? q.v : NaN;
      if (!isFinite(v) || !isFinite(vq)){ labels.push('NONE'); continue; }
      var m = (r.h - r.l)/v, mq = (q.h - q.l)/vq;
      var up = m > mq, vup = v > vq;
      var lab = (up && vup) ? 'GREEN' : ((!up && vup) ? 'SQUAT' : ((up && !vup) ? 'FAKE' : 'FADE'));
      labels.push(lab);
      if (i === n - 1) mfiLast = m;
    }
    out.mfi = mfiLast;
    out.series = labels.slice(-5);
    out.last = labels.length ? labels[labels.length - 1] : 'NONE';
    return out;
  }catch(e){ return out; }
}

/* ======================= 9) Bollinger-in-Keltner squeeze =======================
   BB(20,2) fully inside KC(20,1.5) = squeeze ON; the first bar back outside
   after >=3 on-bars = FIRED — trade the expansion close outside the bands.
   -> {state:'ON'|'FIRED'|'OFF'|'NONE', onRun, firedAgo, dir:'UP'|'DOWN'|null}. */
function goldVolSqueeze(rows){
  var out = { state: 'NONE', onRun: 0, firedAgo: null, dir: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var n = rows.length, c = __closes(rows);
    /* local bollinger + keltner (indicators2 math) */
    var mid = _ema(c, 20), a20 = _atr(rows, 20);
    var on = new Array(n).fill(false);
    var bbU = new Array(n).fill(NaN), bbL = new Array(n).fill(NaN), bbM = new Array(n).fill(NaN);
    for (var i = 19; i < n; i++){
      var s = 0, k;
      for (k = i - 19; k <= i; k++) s += c[k];
      var m = s/20, sq = 0;
      for (k = i - 19; k <= i; k++) sq += (c[k] - m)*(c[k] - m);
      var sd = Math.sqrt(sq/20);
      bbM[i] = m; bbU[i] = m + 2*sd; bbL[i] = m - 2*sd;
    }
    for (i = 0; i < n; i++){
      if (!isFinite(mid[i]) || !isFinite(a20[i]) || !isFinite(bbU[i])) continue;
      var kU = mid[i] + 1.5*a20[i], kL = mid[i] - 1.5*a20[i];
      on[i] = (bbL[i] > kL) && (bbU[i] < kU);
    }
    var run = 0, firedIdx = -1;
    for (i = 0; i < n; i++){
      if (on[i]) run++;
      else { if (run >= 3 && i > 0) firedIdx = i; run = 0; }
    }
    run = 0;
    for (i = n - 1; i >= 0 && on[i]; i--) run++;
    out.onRun = run;
    if (on[n-1]){ out.state = 'ON'; return out; }
    if (firedIdx >= 0 && (n - 1 - firedIdx) <= 3){
      out.state = 'FIRED';
      out.firedAgo = n - 1 - firedIdx;
      var fc = rows[firedIdx].c;
      if (isFinite(bbU[firedIdx]) && fc > bbU[firedIdx]) out.dir = 'UP';
      else if (isFinite(bbL[firedIdx]) && fc < bbL[firedIdx]) out.dir = 'DOWN';
      else if (isFinite(bbM[firedIdx])) out.dir = (fc >= bbM[firedIdx]) ? 'UP' : 'DOWN';
      return out;
    }
    out.state = 'OFF';
    return out;
  }catch(e){ return out; }
}

/* ======================= 10) Asian Range Breakout =======================
   Box = 00:00-07:00 GMT high/low of the LAST bar's UTC day; trade the
   London-volume breakout. Needs candle timestamps.
   -> {hi, lo, mid, state:'LONG_BREAK'|'SHORT_BREAK'|'INSIDE'|'BUILDING', dayIso, bars} | null. */
function goldAsianRange(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return null;
    var n = rows.length, tl = rows[n-1].t;
    if (!isFinite(tl)) return null;
    var ds = Math.floor(tl/86400)*86400, boxEnd = ds + 7*3600;
    var hi = -Infinity, lo = Infinity, bars = 0;
    for (var i = 0; i < n; i++){
      var t = rows[i].t;
      if (!isFinite(t) || t < ds || t >= boxEnd) continue;
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      bars++;
    }
    if (bars < 3 || !(hi > lo)) return null;
    var c = rows[n-1].c;
    var state = (tl < boxEnd) ? 'BUILDING'
              : (c > hi) ? 'LONG_BREAK'
              : (c < lo) ? 'SHORT_BREAK' : 'INSIDE';
    return { hi: hi, lo: lo, mid: (hi + lo)/2, state: state,
             dayIso: new Date(ds*1000).toISOString().slice(0, 10), bars: bars };
  }catch(e){ return null; }
}

/* ======================= 11) RSI(14) gold 75/25 + divergence =======================
   Gold respects wider extremes than stocks: 75/25, not 70/30. Divergence =
   price higher-high + RSI lower-high (bearish exhaustion) or price lower-low
   + RSI higher-low (bullish exhaustion) across the last two swing pivots.
   -> {rsi, zone:'OVERBOUGHT'|'OVERSOLD'|'NEUTRAL'|'NONE', div, detail}. */
function goldRSIGold(rows){
  var out = { rsi: NaN, zone: 'NONE', div: null, detail: '', pivotLow: null, pivotHigh: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 20) return out;
    var n = rows.length, c = __closes(rows);
    var r = _rsi(c, 14), rv = r[n-1];
    out.rsi = rv;
    if (!isFinite(rv)) return out;
    out.zone = (rv >= 75) ? 'OVERBOUGHT' : ((rv <= 25) ? 'OVERSOLD' : 'NEUTRAL');
    /* divergence on price swing pivots (win 2) within the last 60 bars */
    var lows = new Array(n), highs = new Array(n), i;
    for (i = 0; i < n; i++){ lows[i] = rows[i].l; highs[i] = rows[i].h; }
    var segStart = Math.max(0, n - 60);
    var pl = __pivots(lows.slice(segStart), 2), ph = __pivots(highs.slice(segStart), 2);
    var lowPivots = [], highPivots = [];
    for (i = 0; i < pl.length; i++){ if (pl[i].type === 'low') lowPivots.push({ i: pl[i].i + segStart, v: pl[i].v }); }
    for (i = 0; i < ph.length; i++){ if (ph[i].type === 'high') highPivots.push({ i: ph[i].i + segStart, v: ph[i].v }); }
    var bullDiv = null, bearDiv = null;
    if (lowPivots.length >= 2){
      var p1 = lowPivots[lowPivots.length - 2], p2 = lowPivots[lowPivots.length - 1];
      if (p2.v < p1.v && isFinite(r[p2.i]) && isFinite(r[p1.i]) && r[p2.i] > r[p1.i] && (n - 1 - p2.i) <= 20)
        bullDiv = { i: p2.i, barsAgo: n - 1 - p2.i };
    }
    if (highPivots.length >= 2){
      var q1 = highPivots[highPivots.length - 2], q2 = highPivots[highPivots.length - 1];
      if (q2.v > q1.v && isFinite(r[q2.i]) && isFinite(r[q1.i]) && r[q2.i] < r[q1.i] && (n - 1 - q2.i) <= 20)
        bearDiv = { i: q2.i, barsAgo: n - 1 - q2.i };
    }
    if (bullDiv && (!bearDiv || bullDiv.barsAgo <= bearDiv.barsAgo)){
      out.div = 'BULLISH';
      out.pivotLow = p2.v;                 /* price of the 2nd (lower) low — divergence stop structure */
      out.detail = 'price lower-low, RSI higher-low (' + bullDiv.barsAgo + ' bars ago) — bullish exhaustion divergence';
    } else if (bearDiv){
      out.div = 'BEARISH';
      out.pivotHigh = q2.v;                /* price of the 2nd (higher) high — divergence stop structure */
      out.detail = 'price higher-high, RSI lower-high (' + bearDiv.barsAgo + ' bars ago) — bearish exhaustion divergence';
    }
    return out;
  }catch(e){ return out; }
}

/* ======================= 12) CCI(20) =======================
   +/-100 extremes with zero-line cross confirmation (cross within the last
   5 bars reported with barsAgo).
   -> {cci, zone:'EXTREME_HIGH'|'EXTREME_LOW'|'NEUTRAL'|'NONE', zeroCross}. */
function goldCCI(rows){
  var out = { cci: NaN, zone: 'NONE', zeroCross: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 21) return out;
    var n = rows.length, tp = new Array(n), i, k;
    for (i = 0; i < n; i++) tp[i] = (rows[i].h + rows[i].l + rows[i].c)/3;
    var cci = new Array(n).fill(NaN);
    for (i = 19; i < n; i++){
      var s = 0;
      for (k = i - 19; k <= i; k++) s += tp[k];
      var m = s/20, md = 0;
      for (k = i - 19; k <= i; k++) md += Math.abs(tp[k] - m);
      md /= 20;
      if (md > 0) cci[i] = (tp[i] - m)/(0.015*md);
    }
    var last = cci[n-1];
    out.cci = last;
    if (isFinite(last)) out.zone = (last >= 100) ? 'EXTREME_HIGH' : ((last <= -100) ? 'EXTREME_LOW' : 'NEUTRAL');
    for (i = Math.max(1, n - 5); i < n; i++){
      if (!isFinite(cci[i]) || !isFinite(cci[i-1])) continue;
      if (cci[i-1] <= 0 && cci[i] > 0){ out.zeroCross = { dir: 'UP', barsAgo: n - 1 - i }; }
      else if (cci[i-1] >= 0 && cci[i] < 0){ out.zeroCross = { dir: 'DOWN', barsAgo: n - 1 - i }; }
    }
    return out;
  }catch(e){ return out; }
}

/* ======================= 13) StochRSI (pullback timer only) =======================
   Stoch of RSI(14) over 14 bars. Timing pullbacks INSIDE an established trend
   only — the composite gates this read on the ribbon mode.
   -> {k, state:'OVERBOUGHT'|'OVERSOLD'|'NEUTRAL'|'NONE', crossUp, crossDown}. */
function goldStochRSI(rows){
  var out = { k: NaN, state: 'NONE', crossUp: false, crossDown: false };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var c = __closes(rows), n = c.length;
    var r = _rsi(c, 14), kArr = new Array(n).fill(NaN);
    for (var i = 13; i < n; i++){
      var lo = Infinity, hi = -Infinity, ok = true;
      for (var j = i - 13; j <= i; j++){
        if (!isFinite(r[j])){ ok = false; break; }
        if (r[j] < lo) lo = r[j];
        if (r[j] > hi) hi = r[j];
      }
      if (ok && hi > lo) kArr[i] = 100*(r[i] - lo)/(hi - lo);
    }
    var kv = kArr[n-1];
    out.k = kv;
    if (!isFinite(kv)) return out;
    out.state = (kv >= 80) ? 'OVERBOUGHT' : ((kv <= 20) ? 'OVERSOLD' : 'NEUTRAL');
    for (var i2 = Math.max(1, n - 2); i2 < n; i2++){
      if (!isFinite(kArr[i2]) || !isFinite(kArr[i2-1])) continue;
      if (kArr[i2-1] <= 20 && kArr[i2] > 20) out.crossUp = true;
      if (kArr[i2-1] >= 80 && kArr[i2] < 80) out.crossDown = true;
    }
    return out;
  }catch(e){ return out; }
}

/* ======================= 14) Seasonal bias (context only) =======================
   Jan-Feb historically strongest for gold; spring/early-summer consolidation.
   A note, NEVER a vote. */
function goldSeason(d){
  try{
    var ms = __toMs(d);
    if (!isFinite(ms)) return { month: NaN, bias: 'NEUTRAL', note: 'seasonal context unavailable' };
    var m = new Date(ms).getUTCMonth();
    if (m === 0 || m === 1)
      return { month: m, bias: 'STRONG', note: 'Seasonal: Jan–Feb is historically gold\'s strongest stretch — context only, not a vote.' };
    if (m >= 3 && m <= 5)
      return { month: m, bias: 'CONSOLIDATION', note: 'Seasonal: spring/early-summer is historically a consolidation zone for gold — context only, not a vote.' };
    return { month: m, bias: 'NEUTRAL', note: 'Seasonal: no strong historical bias this month — context only, not a vote.' };
  }catch(e){ return { month: NaN, bias: 'NEUTRAL', note: 'seasonal context unavailable' }; }
}

/* =========================================================================
   COMPOSITE — goldScalpSetup({rows15m, rows1h, rows4h, now, news})
   Confluence-driven: >=3 independent agreeing reads on one side (and strictly
   more than the other side) -> setup. Grade = read count + killzone weight,
   downgraded one letter inside a high-impact NEWS WINDOW (+/-30 min) — never
   hidden. Stops 1.5-2x ATR(14) 15m, never tighter; targets 1.5R/2.5R snapped
   to opposing swept structure when one sits between entry and target.
   -> null | {dir, entry, stop, t1, t2, rr, rr2, grade, strategy, confluence,
              notes, killzone, killzoneWeight, newsCaution, newsStamp,
              reads:{long,short}, atr}
========================================================================= */
var NEWS_WINDOW_MS = 30*60*1000;
var NEWS_STAMP = 'NEWS WINDOW — wait 15–30 min after release, let the sweep complete first';

function __newsCaution(news, nowMs){
  try{
    if (!news || !Array.isArray(news.events)) return { caution: false, title: null };
    for (var i = 0; i < news.events.length; i++){
      var ev = news.events[i];
      if (!ev || ev.impact !== 'high') continue;
      var t = (+ev.t < 1e12) ? (+ev.t)*1000 : +ev.t;
      if (!isFinite(t)) continue;
      if (Math.abs(t - nowMs) <= NEWS_WINDOW_MS)
        return { caution: true, title: ev.title || null };
    }
    return { caution: false, title: null };
  }catch(e){ return { caution: false, title: null }; }
}

function goldScalpSetup(inp){
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m);
    if (!rows || rows.length < 30) return null;
    var n = rows.length, lastBar = rows[n-1];
    var a15 = __last(_atr(rows, 14));
    if (!isFinite(a15) || !(a15 > 0)) return null;
    var entry = lastBar.c;
    if (!isFinite(entry) || !(entry > 0)) return null;

    var nowMs = __toMs(inp.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var kz = goldKillzone(nowMs);
    var newsState = inp.news;
    if (newsState === undefined && typeof W.hgNewsState === 'function'){
      try{ newsState = W.hgNewsState(); }catch(eN){ newsState = null; }
    }
    var news = __newsCaution(newsState, nowMs);

    var reads = [];   /* {side:'long'|'short', tag, label} */
    var notes = [];   /* neutral observations — never counted */
    function add(side, tag, label){ reads.push({ side: side, tag: tag, label: label }); }

    /* --- 1) liquidity sweep (15m) --- */
    var sw = goldSweeps(rows);
    var sweptLow = (sw && sw.lowSweep) ? sw.lowSweep.level : NaN;
    var sweptHigh = (sw && sw.highSweep) ? sw.highSweep.level : NaN;
    if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
      if (sw.dir === 'bullish') add('long', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + reclaim (' + sw.barsAgo + 'b ago)');
      else add('short', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + rejection (' + sw.barsAgo + 'b ago)');
    }

    /* --- 2) order blocks + breakers (15m) --- */
    var ob = goldOrderBlocks(rows);
    if (ob){
      var i, z, tol = 0.5*a15;
      for (i = 0; i < ob.bullish.length; i++){
        z = ob.bullish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){ add('long', 'ob', 'bullish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
      }
      for (i = 0; i < ob.bearish.length; i++){
        z = ob.bearish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){ add('short', 'ob', 'bearish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
      }
      for (i = 0; i < ob.breakers.length; i++){
        z = ob.breakers[i];
        if (z.dir === 'bullish' && entry > z.top) { add('long', 'breaker', 'breaker block — failed supply ' + z.top.toFixed(2) + ' flipped to demand'); break; }
        if (z.dir === 'bearish' && entry < z.bottom){ add('short', 'breaker', 'breaker block — failed demand ' + z.bottom.toFixed(2) + ' flipped to supply'); break; }
      }
    }

    /* --- 3) FVG (15m, then 1h when provided) --- */
    var fvg = goldFVG(rows);
    if (fvg && fvg.length){
      var g = fvg[0];
      if (g.age <= 25){
        if (g.dir === 'bullish' && entry >= g.bottom) add('long', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' holding');
        else if (g.dir === 'bearish' && entry <= g.top) add('short', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' capping');
      }
    }
    var rows1h = __rows(inp.rows1h);
    if (rows1h && rows1h.length >= 30){
      var fvg1 = goldFVG(rows1h);
      if (fvg1 && fvg1.length){
        var g1 = fvg1[0];
        if (g1.age <= 25){
          if (g1.dir === 'bullish' && entry >= g1.bottom) add('long', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2));
          else if (g1.dir === 'bearish' && entry <= g1.top) add('short', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2));
        }
      }
    }

    /* --- 4) session VWAP (anchored 00:00 GMT) --- */
    var anchor = -1, tl = lastBar.t;
    if (isFinite(tl)){
      var ds = Math.floor(tl/86400)*86400;
      for (var ai = n - 1; ai >= 0; ai--){
        var tt = rows[ai].t;
        if (!isFinite(tt) || tt < ds){ anchor = ai + 1; break; }
      }
      if (anchor < 0 || anchor >= n) anchor = 0;
    }
    if (anchor >= 0){
      var vw = goldVWAP(rows, anchor);
      if (vw){
        if (vw.pos === 'ABOVE') add('long', 'vwap', 'holding above session VWAP ' + vw.value.toFixed(2));
        else if (vw.pos === 'BELOW') add('short', 'vwap', 'capped below session VWAP ' + vw.value.toFixed(2));
      }
    }

    /* --- 5) EMA ribbon 20/50/200 (15m) --- */
    var rb = goldRibbon(rows);
    if (rb.mode === 'BULL') add('long', 'ribbon', rb.pullback20 ? 'EMA ribbon bull + 20-EMA pullback zone' : 'EMA ribbon bull (20>50, above 200)');
    else if (rb.mode === 'BEAR') add('short', 'ribbon', rb.pullback20 ? 'EMA ribbon bear + 20-EMA pullback zone' : 'EMA ribbon bear (20<50, below 200)');

    /* --- 6) Ichimoku (15m) --- */
    var ich = goldIchimoku(rows);
    if (ich.state === 'ABOVE') add('long', 'ichimoku', 'price above the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');
    else if (ich.state === 'BELOW') add('short', 'ichimoku', 'price below the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');

    /* --- 7) volatility squeeze expansion (15m) --- */
    var vsq = goldVolSqueeze(rows);
    if (vsq.state === 'FIRED' && vsq.dir){
      add(vsq.dir === 'UP' ? 'long' : 'short', 'squeeze', 'BB/KC squeeze fired ' + vsq.dir.toLowerCase() + ' (' + vsq.firedAgo + 'b ago) — expansion');
    } else if (vsq.state === 'ON' && vsq.onRun >= 3){
      notes.push('BB inside KC ×' + vsq.onRun + ' — squeeze building, expansion coming');
    }

    /* --- 8) Asian range breakout --- */
    var asian = goldAsianRange(rows);
    if (asian){
      if (asian.state === 'LONG_BREAK') add('long', 'asian', 'Asian-range breakout above ' + asian.hi.toFixed(2));
      else if (asian.state === 'SHORT_BREAK') add('short', 'asian', 'Asian-range breakdown below ' + asian.lo.toFixed(2));
    }

    /* --- 9) RSI gold 75/25 + divergence --- */
    var rg = goldRSIGold(rows);
    if (rg.zone === 'OVERSOLD') add('long', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≤ 25 — gold oversold extreme');
    else if (rg.zone === 'OVERBOUGHT') add('short', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≥ 75 — gold overbought extreme');
    if (rg.div === 'BULLISH') add('long', 'rsidiv', 'RSI bullish divergence — ' + rg.detail);
    else if (rg.div === 'BEARISH') add('short', 'rsidiv', 'RSI bearish divergence — ' + rg.detail);

    /* --- 10) CCI(20) --- */
    var cc = goldCCI(rows);
    if (cc.zone === 'EXTREME_LOW') add('long', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≤ -100 extreme');
    else if (cc.zone === 'EXTREME_HIGH') add('short', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≥ +100 extreme');
    else if (cc.zeroCross && cc.zeroCross.barsAgo <= 2){
      add(cc.zeroCross.dir === 'UP' ? 'long' : 'short', 'cci', 'CCI zero-line cross ' + cc.zeroCross.dir.toLowerCase() + ' (' + cc.zeroCross.barsAgo + 'b ago)');
    }

    /* --- 11) StochRSI — pullbacks inside an established trend only --- */
    var sr = goldStochRSI(rows);
    if (rb.mode === 'BULL' && (sr.state === 'OVERSOLD' || sr.crossUp))
      add('long', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' washed out inside a bull ribbon — pullback timed');
    else if (rb.mode === 'BEAR' && (sr.state === 'OVERBOUGHT' || sr.crossDown))
      add('short', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' stretched inside a bear ribbon — pullback timed');

    /* --- 12) MFI bar colour --- */
    var mfi = goldMFI(rows);
    if (mfi.last === 'GREEN') add(lastBar.c >= lastBar.o ? 'long' : 'short', 'mfi', 'MFI green bar — volume-driven trend');
    else if (mfi.last === 'SQUAT') notes.push('MFI pink bar — high volume + low range: manipulation / breakout watch, confirmation required');

    /* --- 13) 4H macro mode --- */
    var rows4h = __rows(inp.rows4h);
    if (rows4h && rows4h.length >= 50){
      var rb4 = goldRibbon(rows4h);
      if (rb4.mode === 'BULL') add('long', 'macro4h', '4H ribbon bull — macro tailwind');
      else if (rb4.mode === 'BEAR') add('short', 'macro4h', '4H ribbon bear — macro headwind');
    }

    /* --- tally --- */
    var longEv = [], shortEv = [], i3;
    for (i3 = 0; i3 < reads.length; i3++) (reads[i3].side === 'long' ? longEv : shortEv).push(reads[i3]);
    var dir = (longEv.length > shortEv.length) ? 'long' : ((shortEv.length > longEv.length) ? 'short' : null);
    var count = (dir === 'long') ? longEv.length : ((dir === 'short') ? shortEv.length : 0);
    if (!dir || count < 3) return null;

    /* 200-EMA macro gate: below the 200 -> sell-only (longs suppressed) */
    if (dir === 'long' && rb.sellOnly) return null;

    /* --- levels: ATR survival stop 1.5-2x, never tighter --- */
    var stopDist = 1.5 * a15, stopNote = 'stop 1.5×ATR14(15m)';
    var structLvl = (dir === 'long') ? sweptLow : sweptHigh;
    if (isFinite(structLvl)){
      var dStruct = (dir === 'long') ? (entry - structLvl) : (structLvl - entry);
      if (dStruct > 1.5*a15 && dStruct <= 2*a15){
        stopDist = Math.min(2*a15, dStruct + 0.25*a15);
        stopNote = 'stop beyond swept ' + (dir === 'long' ? 'low' : 'high') + ' ' + structLvl.toFixed(2) + ' (1.5–2×ATR)';
      }
    }
    var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
    var risk = stopDist;
    var t1 = (dir === 'long') ? entry + 1.5*risk : entry - 1.5*risk;
    var t2 = (dir === 'long') ? entry + 2.5*risk : entry - 2.5*risk;
    /* snap targets to opposing swept structure sitting between entry and target */
    var oppLvl = (dir === 'long') ? sweptHigh : sweptLow;
    if (isFinite(oppLvl)){
      var onSide = (dir === 'long') ? (oppLvl > entry && oppLvl < t1) : (oppLvl < entry && oppLvl > t1);
      if (onSide){
        var rrSnap = Math.abs(oppLvl - entry)/risk;
        if (rrSnap >= 1.2){ t1 = oppLvl; stopNote += '; T1 snapped to swept ' + (dir === 'long' ? 'high' : 'low') + ' ' + oppLvl.toFixed(2); }
      }
    }
    var rr = Math.abs(t1 - entry)/risk, rr2 = Math.abs(t2 - entry)/risk;

    /* --- strategy name: strongest structural read first --- */
    var PRIORITY = ['sweep', 'breaker', 'ob', 'asian', 'squeeze', 'fvg', 'vwap', 'stochrsi', 'rsidiv'];
    var NAMES = { sweep: 'LIQUIDITY SWEEP REVERSAL', breaker: 'BREAKER BLOCK REVERSAL',
                  ob: 'ORDER BLOCK RETRACE', asian: 'ASIAN RANGE BREAKOUT',
                  squeeze: 'SQUEEZE EXPANSION', fvg: 'FVG RECLAIM', vwap: 'VWAP BOUNCE',
                  stochrsi: 'EMA20 PULLBACK', rsidiv: 'RSI DIVERGENCE' };
    var myTags = {};
    var myEv = (dir === 'long') ? longEv : shortEv;
    for (i3 = 0; i3 < myEv.length; i3++) myTags[myEv[i3].tag] = true;
    var strategy = 'CONFLUENCE BLEND';
    for (i3 = 0; i3 < PRIORITY.length; i3++){
      if (myTags[PRIORITY[i3]]){ strategy = NAMES[PRIORITY[i3]]; break; }
    }

    /* --- grade: read count + killzone weight; news downgrades one letter --- */
    var score = count + kz.weight;
    var grade = (score >= 8) ? 'A' : ((score >= 5) ? 'B' : 'C');
    if (news.caution) grade = (grade === 'A') ? 'B' : 'C';

    var confluence = [];
    for (i3 = 0; i3 < myEv.length; i3++) confluence.push(myEv[i3].label);

    var hh = isFinite(kz.hourGMT) ? ('0' + kz.hourGMT).slice(-2) + ':00 GMT' : 'n/a';
    return {
      dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
      rr: rr, rr2: rr2, grade: grade, strategy: strategy,
      confluence: confluence, notes: notes.concat(stopNote ? [stopNote] : []),
      killzone: kz.label + ' · ' + hh,
      killzoneWeight: kz.weight,
      newsCaution: news.caution,
      newsStamp: news.caution ? NEWS_STAMP + (news.title ? ' (' + news.title + ')' : '') : null,
      reads: { long: longEv.length, short: shortEv.length },
      atr: a15
    };
  }catch(e){ return null; }
}

/* =========================================================================
   MULTI-STRATEGY CANDIDATES — goldScalpSetups({rows15m, rows1h, rows4h, now,
   news}) -> [candidate, ...] (possibly empty, NEVER null, never throws).
   Each candidate is ONE strategy-specific setup composed from the detectors
   above — liquidity-sweep reversal, order-block/breaker retest, FVG fill,
   session-VWAP bounce/rejection, EMA 20/50/200 ribbon pullback, Asian-range
   (00:00-07:00 GMT) breakout, modified-RSI(75/25) divergence — with entry,
   an ATR-based stop (1.5-2x ATR14 15m, never tighter), TP1 1.5R / TP2 2.5R
   snapped to opposing structure when one sits between entry and target
   (>=1.2R), a deterministic STRUCTURAL conviction id (strategy|dir|anchor:
   the strategy's structural price — swept level / OB edge / FVG edge /
   session VWAP / 20-EMA / Asian box edge / divergence pivot — rounded to
   whole dollars, so price drifting INSIDE the same structural zone
   reproduces the identical id), the agreeing-reads ledger and plain-
   language why/invalidates text. A candidate needs its structural trigger
   PLUS >=2 independent agreeing reads (strictly more than opposing); the
   200-EMA sell-only gate suppresses longs below the 200. Levels always come
   from structure + ATR — nothing is fabricated.
   -> [{id, strategy, stratKey, dir, entry, stop, t1, t2, rr, rr2, grade,
        confluence, agree, oppose, reads:{long,short}, killzone,
        killzoneWeight, newsCaution, newsStamp, atr, zone:{lo,hi}, why,
        invalidates, notes}]
========================================================================= */
var GST_NAME = {
  sweep:  'LIQUIDITY SWEEP REVERSAL',
  ob:     'ORDER BLOCK / BREAKER RETEST',
  fvg:    'FVG FILL',
  vwap:   'SESSION VWAP BOUNCE / REJECTION',
  ribbon: 'EMA RIBBON PULLBACK',
  asian:  'ASIAN RANGE BREAKOUT',
  rsidiv: 'RSI 75/25 DIVERGENCE'
};

/* shared ATR-survival level builder: stop 1.5-2x ATR14(15m) (never tighter),
   optionally extended to sit beyond a structure price; TP1 1.5R / TP2 2.5R
   with TP1 snapped to the nearest opposing structure between entry and TP1
   when that snap still pays >= 1.2R. */
function __gsLevels(dir, entry, a15, structStop, snapLvls){
  var stopDist = 1.5*a15, stopNote = 'stop 1.5×ATR14(15m)';
  if (isFinite(structStop)){
    var d = (dir === 'long') ? (entry - structStop) : (structStop - entry);
    if (d > 0){
      var want = d + 0.25*a15;
      if (want > 2*a15) want = 2*a15;
      if (want > stopDist){
        stopDist = want;
        stopNote = 'stop beyond structure ' + structStop.toFixed(2) + ' (' + (stopDist/a15).toFixed(2) + '×ATR14, capped 2×)';
      }
    }
  }
  var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
  var risk = stopDist;
  var t1 = (dir === 'long') ? entry + 1.5*risk : entry - 1.5*risk;
  var t2 = (dir === 'long') ? entry + 2.5*risk : entry - 2.5*risk;
  if (snapLvls && snapLvls.length){
    var bestLvl = NaN, bestR = Infinity;
    for (var si = 0; si < snapLvls.length; si++){
      var L = snapLvls[si];
      if (!isFinite(L)) continue;
      var onSide = (dir === 'long') ? (L > entry && L < t1) : (L < entry && L > t1);
      if (!onSide) continue;
      var rL = Math.abs(L - entry)/risk;
      if (rL >= 1.2 && rL < bestR){ bestR = rL; bestLvl = L; }
    }
    if (isFinite(bestLvl)){ t1 = bestLvl; stopNote += '; TP1 snapped to opposing structure ' + bestLvl.toFixed(2); }
  }
  return { stop: stop, t1: t1, t2: t2,
           rr: Math.abs(t1 - entry)/risk, rr2: Math.abs(t2 - entry)/risk,
           stopNote: stopNote };
}

/* opposing-structure levels for TP snapping: the opposing swept level plus
   the near edge of opposing unmitigated order blocks. */
function __gsSnapLvls(D, dir){
  var out = [], sw = D.sw, ob = D.ob, entry = D.entry;
  if (sw){
    var L = (dir === 'long') ? (sw.highSweep ? sw.highSweep.level : NaN)
                             : (sw.lowSweep ? sw.lowSweep.level : NaN);
    if (isFinite(L)) out.push(L);
  }
  if (ob){
    var zones = (dir === 'long') ? ob.bearish : ob.bullish;
    for (var i = 0; i < zones.length; i++){
      var edge = (dir === 'long') ? zones[i].bottom : zones[i].top;
      if (isFinite(edge) && ((dir === 'long' && edge > entry) || (dir === 'short' && edge < entry))) out.push(edge);
    }
  }
  return out;
}

/* candidate assembly + quality gates (>=2 agreeing reads, majority, 200-EMA
   sell-only gate for longs, grade = agreeing reads + killzone weight with a
   one-letter news downgrade). Returns null when the gates fail.
   CONVICTION ID: keyed on STRUCTURE, never the live entry — `key|dir|anchor`
   where anchor is the strategy's structural price (swept level / OB edge /
   FVG edge / session VWAP / 20-EMA / Asian box edge / divergence pivot)
   rounded to whole dollars. Price drifting INSIDE the same structural zone
   reproduces the identical id, so the tab's conviction lock restores the
   original levels verbatim; only a genuinely different structure mints a
   new id. */
function __gsCand(key, dir, D, structStop, snapLvls, why, invalidates, zone, anchor){
  try{
    var longEv = [], shortEv = [], i;
    for (i = 0; i < D.reads.length; i++) (D.reads[i].side === 'long' ? longEv : shortEv).push(D.reads[i]);
    var myEv = (dir === 'long') ? longEv : shortEv;
    var oppose = (dir === 'long') ? shortEv.length : longEv.length;
    if (myEv.length < 2 || myEv.length <= oppose) return null;
    if (dir === 'long' && D.rb && D.rb.sellOnly) return null;
    var lv = __gsLevels(dir, D.entry, D.a15, structStop, snapLvls);
    var score = myEv.length + D.kz.weight;
    var grade = (score >= 8) ? 'A' : ((score >= 5) ? 'B' : 'C');
    if (D.news.caution) grade = (grade === 'A') ? 'B' : 'C';
    var conf = [];
    for (i = 0; i < myEv.length; i++) conf.push(myEv[i].label);
    var bucket = String(isFinite(anchor) ? Math.round(anchor) : Math.round(D.entry));
    var hh = isFinite(D.kz.hourGMT) ? ('0' + D.kz.hourGMT).slice(-2) + ':00 GMT' : 'n/a';
    return {
      id: key + '|' + dir + '|' + bucket,
      strategy: GST_NAME[key] || key, stratKey: key, dir: dir,
      entry: D.entry, stop: lv.stop, t1: lv.t1, t2: lv.t2, rr: lv.rr, rr2: lv.rr2,
      grade: grade, confluence: conf, agree: myEv.length, oppose: oppose,
      reads: { long: longEv.length, short: shortEv.length },
      killzone: D.kz.label + ' · ' + hh, killzoneWeight: D.kz.weight,
      newsCaution: D.news.caution,
      newsStamp: D.news.caution ? NEWS_STAMP + (D.news.title ? ' (' + D.news.title + ')' : '') : null,
      atr: D.a15,
      zone: zone || { lo: D.entry - 0.25*D.a15, hi: D.entry + 0.25*D.a15 },
      why: why, invalidates: invalidates,
      notes: (D.notes || []).concat([lv.stopNote])
    };
  }catch(e){ return null; }
}

/* detector bundle + the shared agreeing-reads ledger (same read logic as the
   goldScalpSetup composite, exposed once for all strategy candidates). */
function __goldBundle(rows, rows1h, rows4h, entry, a15){
  var D = { entry: entry, a15: a15, reads: [], notes: [] };
  function add(side, tag, label){ D.reads.push({ side: side, tag: tag, label: label }); }
  var i, z;

  var sw = D.sw = goldSweeps(rows);
  if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
    if (sw.dir === 'bullish') add('long', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + reclaim (' + sw.barsAgo + 'b ago)');
    else add('short', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + rejection (' + sw.barsAgo + 'b ago)');
  }

  var ob = D.ob = goldOrderBlocks(rows);
  if (ob){
    var tol = 0.5*a15;
    for (i = 0; i < ob.bullish.length; i++){
      z = ob.bullish[i];
      if (entry >= z.bottom - tol && entry <= z.top + tol){ add('long', 'ob', 'bullish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
    }
    for (i = 0; i < ob.bearish.length; i++){
      z = ob.bearish[i];
      if (entry >= z.bottom - tol && entry <= z.top + tol){ add('short', 'ob', 'bearish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
    }
    for (i = 0; i < ob.breakers.length; i++){
      z = ob.breakers[i];
      if (z.dir === 'bullish' && entry > z.top) { add('long', 'breaker', 'breaker block — failed supply ' + z.top.toFixed(2) + ' flipped to demand'); break; }
      if (z.dir === 'bearish' && entry < z.bottom){ add('short', 'breaker', 'breaker block — failed demand ' + z.bottom.toFixed(2) + ' flipped to supply'); break; }
    }
  }

  var fvg = D.fvg = goldFVG(rows);
  if (fvg && fvg.length){
    var g = fvg[0];
    if (g.age <= 25){
      if (g.dir === 'bullish' && entry >= g.bottom) add('long', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' holding');
      else if (g.dir === 'bearish' && entry <= g.top) add('short', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' capping');
    }
  }
  D.fvg1 = null;
  if (rows1h && rows1h.length >= 30){
    var fvg1 = D.fvg1 = goldFVG(rows1h);
    if (fvg1 && fvg1.length){
      var g1 = fvg1[0];
      if (g1.age <= 25){
        if (g1.dir === 'bullish' && entry >= g1.bottom) add('long', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2));
        else if (g1.dir === 'bearish' && entry <= g1.top) add('short', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2));
      }
    }
  }

  /* session VWAP anchored 00:00 GMT of the last bar's UTC day */
  var n = rows.length, anchor = -1, tl = rows[n-1].t;
  if (isFinite(tl)){
    var ds = Math.floor(tl/86400)*86400;
    for (var ai = n - 1; ai >= 0; ai--){
      var tt = rows[ai].t;
      if (!isFinite(tt) || tt < ds){ anchor = ai + 1; break; }
    }
    if (anchor < 0 || anchor >= n) anchor = 0;
  }
  D.anchor = anchor;
  var vw = D.vw = (anchor >= 0) ? goldVWAP(rows, anchor) : null;
  if (vw){
    if (vw.pos === 'ABOVE') add('long', 'vwap', 'holding above session VWAP ' + vw.value.toFixed(2));
    else if (vw.pos === 'BELOW') add('short', 'vwap', 'capped below session VWAP ' + vw.value.toFixed(2));
  }

  var rb = D.rb = goldRibbon(rows);
  if (rb.mode === 'BULL') add('long', 'ribbon', rb.pullback20 ? 'EMA ribbon bull + 20-EMA pullback zone' : 'EMA ribbon bull (20>50, above 200)');
  else if (rb.mode === 'BEAR') add('short', 'ribbon', rb.pullback20 ? 'EMA ribbon bear + 20-EMA pullback zone' : 'EMA ribbon bear (20<50, below 200)');

  var ich = D.ich = goldIchimoku(rows);
  if (ich.state === 'ABOVE') add('long', 'ichimoku', 'price above the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');
  else if (ich.state === 'BELOW') add('short', 'ichimoku', 'price below the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');

  var vsq = D.vsq = goldVolSqueeze(rows);
  if (vsq.state === 'FIRED' && vsq.dir){
    add(vsq.dir === 'UP' ? 'long' : 'short', 'squeeze', 'BB/KC squeeze fired ' + vsq.dir.toLowerCase() + ' (' + vsq.firedAgo + 'b ago) — expansion');
  } else if (vsq.state === 'ON' && vsq.onRun >= 3){
    D.notes.push('BB inside KC ×' + vsq.onRun + ' — squeeze building, expansion coming');
  }

  var asian = D.asian = goldAsianRange(rows);
  if (asian){
    if (asian.state === 'LONG_BREAK') add('long', 'asian', 'Asian-range breakout above ' + asian.hi.toFixed(2));
    else if (asian.state === 'SHORT_BREAK') add('short', 'asian', 'Asian-range breakdown below ' + asian.lo.toFixed(2));
  }

  var rg = D.rg = goldRSIGold(rows);
  if (rg.zone === 'OVERSOLD') add('long', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≤ 25 — gold oversold extreme');
  else if (rg.zone === 'OVERBOUGHT') add('short', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≥ 75 — gold overbought extreme');
  if (rg.div === 'BULLISH') add('long', 'rsidiv', 'RSI bullish divergence — ' + rg.detail);
  else if (rg.div === 'BEARISH') add('short', 'rsidiv', 'RSI bearish divergence — ' + rg.detail);

  var cc = D.cc = goldCCI(rows);
  if (cc.zone === 'EXTREME_LOW') add('long', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≤ -100 extreme');
  else if (cc.zone === 'EXTREME_HIGH') add('short', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≥ +100 extreme');
  else if (cc.zeroCross && cc.zeroCross.barsAgo <= 2){
    add(cc.zeroCross.dir === 'UP' ? 'long' : 'short', 'cci', 'CCI zero-line cross ' + cc.zeroCross.dir.toLowerCase() + ' (' + cc.zeroCross.barsAgo + 'b ago)');
  }

  var sr = D.sr = goldStochRSI(rows);
  if (rb.mode === 'BULL' && (sr.state === 'OVERSOLD' || sr.crossUp))
    add('long', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' washed out inside a bull ribbon — pullback timed');
  else if (rb.mode === 'BEAR' && (sr.state === 'OVERBOUGHT' || sr.crossDown))
    add('short', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' stretched inside a bear ribbon — pullback timed');

  var lastBar = rows[n-1];
  var mfi = D.mfi = goldMFI(rows);
  if (mfi.last === 'GREEN') add(lastBar.c >= lastBar.o ? 'long' : 'short', 'mfi', 'MFI green bar — volume-driven trend');
  else if (mfi.last === 'SQUAT') D.notes.push('MFI pink bar — high volume + low range: manipulation / breakout watch, confirmation required');

  D.rb4 = null;
  if (rows4h && rows4h.length >= 50){
    var rb4 = D.rb4 = goldRibbon(rows4h);
    if (rb4.mode === 'BULL') add('long', 'macro4h', '4H ribbon bull — macro tailwind');
    else if (rb4.mode === 'BEAR') add('short', 'macro4h', '4H ribbon bear — macro headwind');
  }
  return D;
}

function goldScalpSetups(inp){
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m);
    if (!rows || rows.length < 30) return [];
    var n = rows.length;
    var a15 = __last(_atr(rows, 14));
    if (!isFinite(a15) || !(a15 > 0)) return [];
    var entry = rows[n-1].c;
    if (!isFinite(entry) || !(entry > 0)) return [];
    var nowMs = __toMs(inp.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var kz = goldKillzone(nowMs);
    var newsState = inp.news;
    if (newsState === undefined && typeof W.hgNewsState === 'function'){
      try{ newsState = W.hgNewsState(); }catch(eN){ newsState = null; }
    }
    var news = __newsCaution(newsState, nowMs);

    var D = __goldBundle(rows, __rows(inp.rows1h), __rows(inp.rows4h), entry, a15);
    D.kz = kz; D.news = news;

    var out = [], seen = {};
    function push(c){ if (c && !seen[c.id]){ seen[c.id] = true; out.push(c); } }
    var tol = 0.5*a15;

    /* --- 1) liquidity-sweep reversal --- */
    var sw = D.sw;
    if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
      var sdir = (sw.dir === 'bullish') ? 'long' : 'short';
      push(__gsCand('sweep', sdir, D, sw.level, __gsSnapLvls(D, sdir),
        'swept ' + (sdir === 'long' ? 'sell-side liquidity at ' : 'buy-side liquidity at ') + sw.level.toFixed(2)
          + ' and reclaimed within ' + sw.barsAgo + ' bar(s) — the stop hunt is complete, reversal fuel is loaded',
        'a 15m close back beyond ' + sw.level.toFixed(2) + ' (the swept ' + (sdir === 'long' ? 'low' : 'high') + ') negates the reclaim',
        undefined, sw.level));
    }

    /* --- 2) order-block / breaker retest --- */
    var ob = D.ob;
    if (ob){
      var i, z;
      for (i = 0; i < ob.bullish.length; i++){
        z = ob.bullish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){
          push(__gsCand('ob', 'long', D, z.bottom, __gsSnapLvls(D, 'long'),
            'price retesting the bullish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2) + ' — unmitigated demand from the displacement origin',
            'a 15m close below the order-block base ' + z.bottom.toFixed(2) + ' fails the demand zone (it becomes a breaker)',
            { lo: z.bottom, hi: z.top }, z.bottom));
          break;
        }
      }
      for (i = 0; i < ob.bearish.length; i++){
        z = ob.bearish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){
          push(__gsCand('ob', 'short', D, z.top, __gsSnapLvls(D, 'short'),
            'price retesting the bearish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2) + ' — unmitigated supply from the displacement origin',
            'a 15m close above the order-block top ' + z.top.toFixed(2) + ' fails the supply zone (it becomes a breaker)',
            { lo: z.bottom, hi: z.top }, z.top));
          break;
        }
      }
      for (i = 0; i < ob.breakers.length; i++){
        z = ob.breakers[i];
        if (z.dir === 'bullish' && entry > z.top && entry <= z.top + 2*a15){
          push(__gsCand('ob', 'long', D, z.bottom, __gsSnapLvls(D, 'long'),
            'failed supply at ' + z.top.toFixed(2) + ' flipped to demand (breaker) — price holding above the flip',
            'a 15m close back below the breaker base ' + z.bottom.toFixed(2) + ' negates the flip',
            { lo: z.bottom, hi: z.top }, z.bottom));
          break;
        }
        if (z.dir === 'bearish' && entry < z.bottom && entry >= z.bottom - 2*a15){
          push(__gsCand('ob', 'short', D, z.top, __gsSnapLvls(D, 'short'),
            'failed demand at ' + z.bottom.toFixed(2) + ' flipped to supply (breaker) — price holding below the flip',
            'a 15m close back above the breaker top ' + z.top.toFixed(2) + ' negates the flip',
            { lo: z.bottom, hi: z.top }, z.top));
          break;
        }
      }
    }

    /* --- 3) FVG fill (15m first, then 1H) --- */
    function fvgCand(g, label){
      if (!g || g.age > 25) return;
      if (entry < g.bottom - tol || entry > g.top + tol) return;   /* must be AT/IN the gap */
      if (g.dir === 'bullish'){
        push(__gsCand('fvg', 'long', D, g.bottom, __gsSnapLvls(D, 'long'),
          'price retraced into the unmitigated ' + label + ' FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' — the imbalance fill zone is acting as demand',
          'a 15m close below the gap base ' + g.bottom.toFixed(2) + ' fills-and-fails the imbalance',
          { lo: g.bottom, hi: g.top }, g.bottom));
      } else {
        push(__gsCand('fvg', 'short', D, g.top, __gsSnapLvls(D, 'short'),
          'price rallied into the unmitigated ' + label + ' FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' — the imbalance fill zone is acting as supply',
          'a 15m close above the gap top ' + g.top.toFixed(2) + ' fills-and-fails the imbalance',
          { lo: g.bottom, hi: g.top }, g.top));
      }
    }
    var gotFvg = false;
    if (D.fvg && D.fvg.length){ var before = out.length; fvgCand(D.fvg[0], '15m'); gotFvg = out.length > before; }
    if (!gotFvg && D.fvg1 && D.fvg1.length) fvgCand(D.fvg1[0], '1H');

    /* --- 4) session-VWAP bounce / rejection --- */
    var vw = D.vw;
    if (vw && isFinite(vw.value) && Math.abs(entry - vw.value) <= 0.75*a15){
      var vZone = { lo: vw.value - 0.25*a15, hi: vw.value + 0.25*a15 };
      if (vw.pos === 'ABOVE'){
        push(__gsCand('vwap', 'long', D, vw.lower, __gsSnapLvls(D, 'long'),
          'price bouncing off session VWAP ' + vw.value.toFixed(2) + ' — holding the bid side of fair value',
          'a 15m close back below session VWAP ' + vw.value.toFixed(2) + ' loses fair value',
          vZone, vw.value));
      } else if (vw.pos === 'BELOW'){
        push(__gsCand('vwap', 'short', D, vw.upper, __gsSnapLvls(D, 'short'),
          'price rejected at session VWAP ' + vw.value.toFixed(2) + ' — capped under fair value',
          'a 15m close back above session VWAP ' + vw.value.toFixed(2) + ' reclaims fair value',
          vZone, vw.value));
      }
    }

    /* --- 5) EMA 20/50/200 ribbon pullback --- */
    var rb = D.rb;
    if (rb && rb.pullback20 && (rb.mode === 'BULL' || rb.mode === 'BEAR')){
      var rdir = (rb.mode === 'BULL') ? 'long' : 'short';
      push(__gsCand('ribbon', rdir, D, (isFinite(rb.e50) ? rb.e50 : NaN), __gsSnapLvls(D, rdir),
        'pullback into the 20-EMA (' + (isFinite(rb.e20) ? rb.e20.toFixed(2) : 'n/a') + ') inside a ' + rb.mode.toLowerCase()
          + ' 20/50/200 ribbon — trend-continuation entry with the flow',
        'a 15m close through the 50-EMA ' + (isFinite(rb.e50) ? rb.e50.toFixed(2) : 'n/a') + ' breaks the pullback structure',
        { lo: (isFinite(rb.e20) ? rb.e20 - 0.25*a15 : entry - 0.25*a15), hi: (isFinite(rb.e20) ? rb.e20 + 0.25*a15 : entry + 0.25*a15) },
        rb.e20));
    }

    /* --- 6) Asian-range (00:00-07:00 GMT) breakout --- */
    var asian = D.asian;
    if (asian && (asian.state === 'LONG_BREAK' || asian.state === 'SHORT_BREAK')){
      var adir = (asian.state === 'LONG_BREAK') ? 'long' : 'short';
      push(__gsCand('asian', adir, D, (adir === 'long' ? asian.hi : asian.lo), __gsSnapLvls(D, adir),
        'London-volume breakout ' + (adir === 'long' ? 'above' : 'below') + ' the Asian box ' + asian.lo.toFixed(2) + '–' + asian.hi.toFixed(2)
          + ' (' + asian.dayIso + ', 00:00–07:00 GMT) — range expansion underway',
        'a 15m close back inside the Asian range (' + asian.lo.toFixed(2) + '–' + asian.hi.toFixed(2) + ') negates the breakout',
        undefined, (adir === 'long' ? asian.hi : asian.lo)));
    }

    /* --- 7) modified-RSI (75/25) divergence --- */
    var rg = D.rg;
    if (rg && rg.div){
      var ddir = (rg.div === 'BULLISH') ? 'long' : 'short';
      var piv = (ddir === 'long') ? rg.pivotLow : rg.pivotHigh;
      push(__gsCand('rsidiv', ddir, D, (isFinite(piv) ? piv : NaN), __gsSnapLvls(D, ddir),
        rg.detail + ' — momentum is exhausting at the extreme, mean-reversion ' + (ddir === 'long' ? 'long' : 'short'),
        'a 15m close beyond the divergence pivot ' + (isFinite(piv) ? piv.toFixed(2) : 'extreme') + ' confirms continuation instead of exhaustion',
        undefined, piv));
    }

    return out;
  }catch(e){ return []; }
}

/* =========================================================================
   RANKER — goldRankSetups(cands, ctx): transparent, human-readable confluence
   tally per candidate. Pure + total: every ctx leg is optional and degrades
   to a zero-point omission. Tally parts (pts):
     +N    independent agreeing reads (candidate's own ledger)
     +0..3 ICT killzone weight (London/NY overlap 13:00-17:00 GMT = 3, highest)
     -2    high-impact news window (+/-30 min via the hgNewsState-shaped ctx.news)
     +/-2  fundamentals tilt ctx.macro.realRateHint (TAILWIND favors longs,
           HEADWIND favors shorts; DXY/US10Y trends quoted in the label)
     +/-1  positioning ctx.spot.verdict (PAXG basis: longs-crowding fades
           longs / backs shorts; shorts-crowding = squeeze fuel for longs)
     +1    seasonality ctx.season.bias STRONG (Jan-Feb) behind a long
     +1    crypto risk sentiment ctx.fng ({v,c}: extreme fear <=25 backs a
           risk-off gold long; extreme greed >=75 backs a short)
   Sort: tally desc, then grade, then killzone weight, then agreeing reads
   (stable). -> {ranked:[cand + {tally, tallyParts:[{label,pts}]}], best} —
   {ranked:[], best:null} on any failure.
========================================================================= */
function goldRankSetups(cands, ctx){
  var out = { ranked: [], best: null };
  try{
    if (!Array.isArray(cands) || !cands.length) return out;
    ctx = ctx || {};
    var nowMs = __toMs(ctx.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var news = __newsCaution(ctx.news, nowMs);
    var macro = (ctx.macro && typeof ctx.macro === 'object') ? ctx.macro : null;
    var hint = macro ? macro.realRateHint : null;
    var spot = (ctx.spot && typeof ctx.spot === 'object') ? ctx.spot : null;
    var verdict = spot ? spot.verdict : null;
    var basisTxt = (spot && isFinite(spot.basisPct)) ? ((spot.basisPct > 0 ? '+' : '') + Number(spot.basisPct).toFixed(3) + '%') : 'n/a';
    var season = (ctx.season && typeof ctx.season === 'object') ? ctx.season : null;
    var fng = (ctx.fng && typeof ctx.fng === 'object') ? ctx.fng : null;
    var fngV = (fng && isFinite(+fng.v)) ? +fng.v : null;

    var ranked = [], i, k;
    for (i = 0; i < cands.length; i++){
      var c = cands[i];
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
      var parts = [], tally = 0;
      var agree = isFinite(c.agree) ? c.agree
                : (c.reads ? ((c.dir === 'long') ? c.reads.long : c.reads.short) : 0);
      if (agree > 0){
        parts.push({ label: agree + ' independent agreeing read' + (agree === 1 ? '' : 's'), pts: agree });
        tally += agree;
      }
      var kzw = isFinite(c.killzoneWeight) ? c.killzoneWeight : 0;
      if (kzw > 0){
        var kzName = c.killzone ? String(c.killzone).split(' · ')[0] : 'KILLZONE';
        parts.push({ label: kzName + ' — ICT killzone weight', pts: kzw });
        tally += kzw;
      }
      if (news.caution){
        parts.push({ label: 'high-impact news window ±30 min' + (news.title ? ' — ' + news.title : '') + ' (fade risk)', pts: -2 });
        tally -= 2;
      }
      if (hint === 'TAILWIND' || hint === 'HEADWIND'){
        var favors = (hint === 'TAILWIND') ? 'long' : 'short';
        var mPts = (c.dir === favors) ? 2 : -2;
        var mWhy = [];
        if (macro.dxy && macro.dxy.trend20) mWhy.push('DXY ' + String(macro.dxy.trend20).toLowerCase());
        if (macro.tnxTrend) mWhy.push('US10Y ' + String(macro.tnxTrend).toLowerCase());
        parts.push({ label: 'macro ' + hint.toLowerCase() + (mWhy.length ? ' (' + mWhy.join(', ') + ')' : '')
                       + ' — ' + (mPts > 0 ? 'favors ' + c.dir + 's' : 'works against ' + c.dir + 's'), pts: mPts });
        tally += mPts;
      }
      if (verdict === 'longs-crowding' || verdict === 'shorts-crowding'){
        var pPts, pLab;
        if (verdict === 'longs-crowding'){
          pPts = (c.dir === 'short') ? 1 : -1;
          pLab = 'PAXG basis ' + basisTxt + ' — leveraged longs crowding (fade risk for longs)';
        } else {
          pPts = (c.dir === 'long') ? 1 : -1;
          pLab = 'PAXG basis ' + basisTxt + ' — shorts crowding (squeeze fuel for longs)';
        }
        parts.push({ label: pLab, pts: pPts });
        tally += pPts;
      }
      if (season && season.bias === 'STRONG' && c.dir === 'long'){
        parts.push({ label: 'seasonal tailwind — Jan–Feb is historically gold\'s strongest stretch', pts: 1 });
        tally += 1;
      }
      if (fngV !== null){
        if (fngV <= 25 && c.dir === 'long'){
          parts.push({ label: 'crypto fear & greed ' + fngV + ' — extreme fear, risk-off bid for gold', pts: 1 });
          tally += 1;
        } else if (fngV >= 75 && c.dir === 'short'){
          parts.push({ label: 'crypto fear & greed ' + fngV + ' — extreme greed, risk-on weighs on gold', pts: 1 });
          tally += 1;
        }
      }
      var rc = {};
      for (k in c){ if (Object.prototype.hasOwnProperty.call(c, k)) rc[k] = c[k]; }
      rc.tally = tally;
      rc.tallyParts = parts;
      ranked.push(rc);
    }
    var gOrd = { A: 0, B: 1, C: 2 };
    ranked.sort(function(x, y){
      if (y.tally !== x.tally) return y.tally - x.tally;
      var gx = (gOrd[x.grade] === undefined) ? 9 : gOrd[x.grade];
      var gy = (gOrd[y.grade] === undefined) ? 9 : gOrd[y.grade];
      if (gx !== gy) return gx - gy;
      var kx = isFinite(x.killzoneWeight) ? x.killzoneWeight : 0;
      var ky = isFinite(y.killzoneWeight) ? y.killzoneWeight : 0;
      if (ky !== kx) return ky - kx;
      var ax = isFinite(x.agree) ? x.agree : 0;
      var ay = isFinite(y.agree) ? y.agree : 0;
      return ay - ax;
    });
    out.ranked = ranked;
    out.best = ranked.length ? ranked[0] : null;
    return out;
  }catch(e){ return { ranked: [], best: null }; }
}

/* ---------------- exports ---------------- */
W.goldFVG = goldFVG;
W.goldOrderBlocks = goldOrderBlocks;
W.goldSweeps = goldSweeps;
W.goldKillzone = goldKillzone;
W.goldVWAP = goldVWAP;
W.goldRibbon = goldRibbon;
W.goldIchimoku = goldIchimoku;
W.goldMFI = goldMFI;
W.goldVolSqueeze = goldVolSqueeze;
W.goldAsianRange = goldAsianRange;
W.goldRSIGold = goldRSIGold;
W.goldCCI = goldCCI;
W.goldStochRSI = goldStochRSI;
W.goldSeason = goldSeason;
W.goldScalpSetup = goldScalpSetup;
W.goldScalpSetups = goldScalpSetups;
W.goldRankSetups = goldRankSetups;
})();
