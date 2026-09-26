/* HARDGATE — 90PERCENT
   =====================================================================
   The four-step method, built exactly as specified:

     STEP 1  TREND          moving averages, MACD, Ichimoku
     STEP 2  SUPPORT/RES    horizontal levels and sloping trendlines
     STEP 3  MOMENTUM       RSI, Stochastic Oscillator, MACD
     STEP 4  ENTRY / EXIT   from the trend, the levels and the momentum

   and the three pairings, each of which must agree before anything fires:

     PAIR A  RSI + Stochastic      momentum, and whether it is stretched
     PAIR B  Bollinger + MA        volatility against trend
     PAIR C  MACD + Ichimoku       reversal against trend and cloud support

   ABOUT THE NAME
   --------------
   The tab is called 90PERCENT because that is what it was asked to be
   called. It does not claim 90%, and it is built so that nobody has to take
   its word either way: every setup is written to the shared forward log and
   settled by bars that had not printed when it fired, and the header prints
   the MEASURED hit rate beside the 90% the name implies. Until something
   settles it says so.

   That is not scepticism for its own sake. Six indicators over one price
   series are not six opinions -- RSI, Stochastic, MACD, Bollinger %B and the
   MA stack are all functions of the same closes, so agreement between them is
   substantially agreement of a series with itself. Requiring all three pairs
   to align makes the rule SELECTIVE, which is worth having; it does not make
   it six independent confirmations. The card says which pairs agreed and the
   log says whether it paid.

   Everything reads CLOSED bars only. Nothing is sent anywhere.
   ===================================================================== */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'ninetypercent';

var KL_15M = 400, KL_1H = 200;
var NP_MIN_15M = 210;        /* Ichimoku senkouB 52 + its 26-bar displacement + slack */
var NP_MIN_1H = 60;

/* indicator periods — the conventional defaults, named rather than inlined */
var NP_RSI = 14;
var NP_STOCH_K = 14, NP_STOCH_D = 3;
var NP_BB_LEN = 20, NP_BB_MULT = 2;
var NP_MA_FAST = 20, NP_MA_SLOW = 50, NP_MA_TREND = 200;
var NP_MACD_F = 12, NP_MACD_S = 26, NP_MACD_SIG = 9;
var NP_ICHI_T = 9, NP_ICHI_K = 26, NP_ICHI_B = 52;
var NP_ICHI_SHIFT = 26;      /* the cloud is plotted 26 bars FORWARD */

/* structure */
var NP_PIVOT = 5;            /* bars each side of a confirmed swing */
var NP_SR_TOL_ATR = 0.5;     /* pivots within this many ATR are one level */
var NP_SR_MIN_TOUCH = 2;     /* a level needs this many touches to count */
var NP_SR_MAX_ATR = 6;       /* a level further than this is not "nearby" */

/* the plan */
var NP_MIN_RR = 2.0;
var NP_STOP_PAD_ATR = 0.35;
var NP_COST_MULT = 8;
var NP_HORIZON = 24;
var NP_LABEL_V = 1;
var NP_TARGET_HIT = 0.90;    /* what the NAME implies — measured, never asserted */

var VENUE_COSTS = {
  delta:   { venue: 'Delta',   rtFrac: 0.001 },
  coindcx: { venue: 'CoinDCX', rtFrac: 0.002 },
  cdcx:    { venue: 'CoinDCX', rtFrac: 0.002 },
  binance: { venue: 'Binance', rtFrac: 0.002 }
};
function costFor(item){
  var ex = item && item.exchange ? String(item.exchange).toLowerCase() : 'binance';
  return VENUE_COSTS[ex] || VENUE_COSTS.binance;
}
function venueName(ex){
  var k = String(ex || '').toLowerCase();
  if (k === 'delta') return 'Delta';
  if (k === 'coindcx' || k === 'cdcx') return 'CoinDCX';
  if (k === 'binance') return 'Binance';
  return k ? (k.charAt(0).toUpperCase() + k.slice(1)) : 'unknown';
}
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n, d){ if (n == null || !isFinite(+n)) return '—'; d = d != null ? d : (Math.abs(+n) >= 100 ? 2 : Math.abs(+n) >= 1 ? 4 : 6); return (+n).toFixed(d); }

/* ------------------------------------------------------- closed bars */

/* No read anywhere in this file touches a bar that has not closed. Absent
   stamps are dropped rather than coerced: `+null` is 0 and isFinite(0) is
   true, so a missing stamp would otherwise read as 1970 and count as closed. */
function npClosedRows(rows, ivSec, nowMs){
  if (!Array.isArray(rows) || !rows.length) return [];
  var cutoff = (nowMs / 1000) - ivSec, out = [], i, t;
  for (i = 0; i < rows.length; i++){
    t = (rows[i] && rows[i].t !== null && rows[i].t !== undefined && rows[i].t !== '')
      ? +rows[i].t : NaN;
    if (isFinite(t) && t <= cutoff) out.push(rows[i]);
  }
  return out.length < rows.length ? out : rows.slice(0, -1);
}

/* ------------------------------------------------- indicator plumbing */

function npEma(vals, p){
  var out = new Array(vals.length).fill(NaN), k = 2 / (p + 1), i, prev = NaN;
  for (i = 0; i < vals.length; i++){
    var v = +vals[i];
    if (!isFinite(v)) continue;
    prev = isFinite(prev) ? (v - prev) * k + prev : v;
    if (i >= p - 1) out[i] = prev;
  }
  return out;
}
/* A RUNNING SUM CANNOT CROSS A NaN.

   This started as the usual rolling accumulator, and one `sum += NaN` makes
   every later value NaN forever. That is fine over closes, which are all
   finite -- and fatal over the Stochastic's %K, whose first kLen-1 entries
   are NaN by construction. %D came back NaN for every bar, so PAIR A
   (RSI + Stochastic) reported UNCHECKED on every contract and the third step
   could never reach 3 of 3. The tab ran clean and produced nothing.

   Summing the window itself is O(n·p) with p at most 200 here, which is
   nothing, and it yields NaN exactly where the window genuinely contains one
   rather than everywhere after the first. */
function npSma(vals, p){
  var out = new Array(vals.length).fill(NaN), i, j;
  for (i = p - 1; i < vals.length; i++){
    var sum = 0, whole = true;
    for (j = i - p + 1; j <= i; j++){
      var v = +vals[j];
      if (!isFinite(v)){ whole = false; break; }
      sum += v;
    }
    if (whole) out[i] = sum / p;
  }
  return out;
}
function npStdev(vals, p, i){
  if (i < p - 1) return NaN;
  var m = 0, j;
  for (j = i - p + 1; j <= i; j++) m += +vals[j];
  m /= p;
  var s = 0;
  for (j = i - p + 1; j <= i; j++) s += Math.pow(+vals[j] - m, 2);
  return Math.sqrt(s / p);
}
function npRsi(vals, p){
  var out = new Array(vals.length).fill(NaN), g = 0, l = 0, i;
  if (vals.length <= p) return out;
  for (i = 1; i <= p; i++){ var d = vals[i] - vals[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= p; l /= p;
  out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (i = p + 1; i < vals.length; i++){
    var d2 = vals[i] - vals[i - 1];
    g = (g * (p - 1) + (d2 > 0 ? d2 : 0)) / p;
    l = (l * (p - 1) + (d2 < 0 ? -d2 : 0)) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
function npAtr(rows, len){
  var n = rows.length, tr = [], i;
  if (n < len + 1) return NaN;
  for (i = 1; i < n; i++){
    var h = +rows[i].h, l = +rows[i].l, pc = +rows[i - 1].c;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  var sum = 0;
  for (i = tr.length - len; i < tr.length; i++) sum += tr[i];
  var v = sum / len;
  return isFinite(v) && v > 0 ? v : NaN;
}

/* THE CLASSIC STOCHASTIC OSCILLATOR, which is what the brief describes:
   "compares the closing price to its price RANGE over a given period".

   indicators.js ships `stochRsi`, which is a stochastic OF RSI -- a different
   instrument on a different input, and it would have quietly answered a
   question nobody asked. %K is the close inside the high-low range; %D is its
   3-period average. */
function npStoch(rows, kLen, dLen){
  var n = rows.length, k = new Array(n).fill(NaN), i, j;
  for (i = kLen - 1; i < n; i++){
    var hi = -Infinity, lo = Infinity;
    for (j = i - kLen + 1; j <= i; j++){ hi = Math.max(hi, +rows[j].h); lo = Math.min(lo, +rows[j].l); }
    k[i] = (hi > lo) ? 100 * (+rows[i].c - lo) / (hi - lo) : 50;
  }
  var d = npSma(k, dLen);
  return { k: k, d: d };
}

function npMacd(vals, f, s, sig){
  var ef = npEma(vals, f), es = npEma(vals, s), n = vals.length;
  var line = new Array(n).fill(NaN), i;
  for (i = 0; i < n; i++) if (isFinite(ef[i]) && isFinite(es[i])) line[i] = ef[i] - es[i];
  var signal = npEma(line.map(function(v){ return isFinite(v) ? v : 0; }), sig);
  var hist = new Array(n).fill(NaN);
  for (i = 0; i < n; i++) if (isFinite(line[i]) && isFinite(signal[i])) hist[i] = line[i] - signal[i];
  return { line: line, signal: signal, hist: hist };
}

/* ICHIMOKU, WITH THE CLOUD WHERE IT ACTUALLY BELONGS.

   indicators2.js exports an ichimoku whose senkou spans are UNSHIFTED -- its
   own comment says "senkouA/B at index i describe the cloud as of bar i". The
   standard indicator plots the cloud 26 bars FORWARD, so the cloud a trader
   reads under today's price was computed 26 bars ago. Comparing price to an
   unshifted span is a different indicator wearing the same name.

   Taking the shift the right way round costs nothing in safety: the cloud at
   bar i comes from bar i - 26, which is OLDER data, never newer. */
function npIchimoku(rows, tLen, kLen, bLen, shift){
  var n = rows.length;
  var tenkan = new Array(n).fill(NaN), kijun = new Array(n).fill(NaN);
  var spanA = new Array(n).fill(NaN), spanB = new Array(n).fill(NaN);
  function midAt(i, len){
    if (i < len - 1) return NaN;
    var hi = -Infinity, lo = Infinity, j;
    for (j = i - len + 1; j <= i; j++){ hi = Math.max(hi, +rows[j].h); lo = Math.min(lo, +rows[j].l); }
    return (hi + lo) / 2;
  }
  var rawA = new Array(n).fill(NaN), rawB = new Array(n).fill(NaN), i;
  for (i = 0; i < n; i++){
    tenkan[i] = midAt(i, tLen);
    kijun[i] = midAt(i, kLen);
    rawB[i] = midAt(i, bLen);
    if (isFinite(tenkan[i]) && isFinite(kijun[i])) rawA[i] = (tenkan[i] + kijun[i]) / 2;
  }
  /* the cloud under bar i was computed `shift` bars ago */
  for (i = 0; i < n; i++){
    if (i - shift >= 0){ spanA[i] = rawA[i - shift]; spanB[i] = rawB[i - shift]; }
  }
  return { tenkan: tenkan, kijun: kijun, spanA: spanA, spanB: spanB };
}

/* ---------------------------------------------- STEP 1: TREND */

/* UP, DOWN or SIDEWAYS from three trend reads. SIDEWAYS is a real verdict and
   the commonest one -- the brief lists it first, and a rule that never says
   "no trend" has not identified one. A read that cannot be computed is
   UNCHECKED and votes for nothing. */
function npTrend(rows){
  var n = rows.length;
  var closes = rows.map(function(r){ return +r.c; });
  var out = { dir: 'sideways', votes: [], up: 0, down: 0, unchecked: 0 };
  if (n < NP_MIN_15M) return out;
  var i = n - 1;

  var maF = npEma(closes, NP_MA_FAST), maS = npEma(closes, NP_MA_SLOW), maT = npSma(closes, NP_MA_TREND);
  var stack = null;
  if (isFinite(maF[i]) && isFinite(maS[i]) && isFinite(maT[i])){
    if (closes[i] > maF[i] && maF[i] > maS[i] && maS[i] > maT[i]) stack = 'up';
    else if (closes[i] < maF[i] && maF[i] < maS[i] && maS[i] < maT[i]) stack = 'down';
    else stack = 'flat';
  }
  out.votes.push({ name: 'MA stack ' + NP_MA_FAST + '/' + NP_MA_SLOW + '/' + NP_MA_TREND,
    vote: stack, read: stack === null ? 'unchecked'
      : (fmt(maF[i]) + ' / ' + fmt(maS[i]) + ' / ' + fmt(maT[i])) });

  var mac = npMacd(closes, NP_MACD_F, NP_MACD_S, NP_MACD_SIG);
  var macVote = isFinite(mac.hist[i]) ? (mac.hist[i] > 0 ? 'up' : mac.hist[i] < 0 ? 'down' : 'flat') : null;
  out.votes.push({ name: 'MACD histogram', vote: macVote,
    read: isFinite(mac.hist[i]) ? fmt(mac.hist[i], 4) : 'unchecked' });

  var ic = npIchimoku(rows, NP_ICHI_T, NP_ICHI_K, NP_ICHI_B, NP_ICHI_SHIFT);
  var icVote = null, icRead = 'unchecked';
  if (isFinite(ic.spanA[i]) && isFinite(ic.spanB[i])){
    var top = Math.max(ic.spanA[i], ic.spanB[i]), bot = Math.min(ic.spanA[i], ic.spanB[i]);
    icVote = closes[i] > top ? 'up' : closes[i] < bot ? 'down' : 'flat';
    icRead = 'cloud ' + fmt(bot) + '–' + fmt(top);
  }
  out.votes.push({ name: 'Ichimoku price vs cloud (shifted ' + NP_ICHI_SHIFT + ')',
    vote: icVote, read: icRead });

  for (var v = 0; v < out.votes.length; v++){
    var vt = out.votes[v].vote;
    if (vt === null) out.unchecked++;
    else if (vt === 'up') out.up++;
    else if (vt === 'down') out.down++;
  }
  /* a majority of the reads that could be computed, and never a tie */
  if (out.up > out.down && out.up >= 2) out.dir = 'up';
  else if (out.down > out.up && out.down >= 2) out.dir = 'down';
  else out.dir = 'sideways';
  out.ichimoku = ic; out.macd = mac; out.ma = { fast: maF, slow: maS, trend: maT };
  return out;
}

/* -------------------------------- STEP 2: SUPPORT AND RESISTANCE */

/* CONFIRMED pivots only: a swing at p is not a level until the `right` bars
   that prove it have themselves closed. */
function npPivots(rows, left, right){
  var out = { highs: [], lows: [] }, n = rows.length, p, i, isH, isL;
  for (p = left; p + right < n; p++){
    isH = true; isL = true;
    for (i = p - left; i <= p + right; i++){
      if (i === p) continue;
      if (+rows[i].h >= +rows[p].h) isH = false;
      if (+rows[i].l <= +rows[p].l) isL = false;
    }
    if (isH) out.highs.push({ i: p, price: +rows[p].h });
    if (isL) out.lows.push({ i: p, price: +rows[p].l });
  }
  return out;
}

/* HORIZONTAL LEVELS: pivots within NP_SR_TOL_ATR of each other are one level,
   and a level needs NP_SR_MIN_TOUCH touches. One pivot is not a level -- it is
   a single bar's extreme, and treating it as support is how a chart ends up
   with a line under every wick. */
function npLevels(pivots, atr){
  var all = pivots.highs.concat(pivots.lows).slice().sort(function(a, b){ return a.price - b.price; });
  var tol = atr * NP_SR_TOL_ATR, out = [], cur = null, i;
  if (!isFinite(tol) || tol <= 0) return out;
  for (i = 0; i < all.length; i++){
    if (cur && (all[i].price - cur.lo) <= tol){
      cur.touches.push(all[i]); cur.hi = all[i].price;
    } else {
      if (cur && cur.touches.length >= NP_SR_MIN_TOUCH) out.push(cur);
      cur = { lo: all[i].price, hi: all[i].price, touches: [all[i]] };
    }
  }
  if (cur && cur.touches.length >= NP_SR_MIN_TOUCH) out.push(cur);
  for (i = 0; i < out.length; i++){
    var s = 0, lastI = 0;
    for (var j = 0; j < out[i].touches.length; j++){
      s += out[i].touches[j].price;
      lastI = Math.max(lastI, out[i].touches[j].i);
    }
    out[i].price = s / out[i].touches.length;
    out[i].n = out[i].touches.length;
    out[i].lastBar = lastI;
  }
  return out;
}

/* SLOPING LINES: least squares through the last `take` confirmed pivots, with
   the fit projected to the latest bar. A line through fewer than three points
   is not a trendline, it is two points and a ruler. */
function npTrendline(pivots, atBar, take){
  var pts = pivots.slice(-(take || 4));
  if (pts.length < 3) return null;
  var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0, i;
  for (i = 0; i < n; i++){ sx += pts[i].i; sy += pts[i].price; sxy += pts[i].i * pts[i].price; sxx += pts[i].i * pts[i].i; }
  var den = n * sxx - sx * sx;
  if (!den) return null;
  var slope = (n * sxy - sx * sy) / den;
  var intercept = (sy - slope * sx) / n;
  var at = slope * atBar + intercept;
  if (!isFinite(at)) return null;
  return { slope: slope, at: at, points: n, rising: slope > 0 };
}

function npStructure(rows, atr){
  var n = rows.length, price = +rows[n - 1].c;
  var piv = npPivots(rows, NP_PIVOT, NP_PIVOT);
  var levels = npLevels(piv, atr);
  var above = null, below = null, i;
  for (i = 0; i < levels.length; i++){
    var L = levels[i];
    if (L.price > price && (!above || L.price < above.price)) above = L;
    if (L.price < price && (!below || L.price > below.price)) below = L;
  }
  return {
    price: price, levels: levels,
    resistance: above, support: below,
    resistAtr: above ? (above.price - price) / atr : NaN,
    supportAtr: below ? (price - below.price) / atr : NaN,
    lineHigh: npTrendline(piv.highs, n - 1, 4),
    lineLow: npTrendline(piv.lows, n - 1, 4),
    pivots: piv
  };
}

/* ------------------------------------------- STEP 3: MOMENTUM */

function npMomentum(rows, trend){
  var closes = rows.map(function(r){ return +r.c; }), i = rows.length - 1;
  var r = npRsi(closes, NP_RSI);
  var st = npStoch(rows, NP_STOCH_K, NP_STOCH_D);
  var bbMid = npSma(closes, NP_BB_LEN);
  var sd = npStdev(closes, NP_BB_LEN, i);
  var bb = null;
  if (isFinite(bbMid[i]) && isFinite(sd) && sd > 0){
    var up = bbMid[i] + NP_BB_MULT * sd, dn = bbMid[i] - NP_BB_MULT * sd;
    bb = { mid: bbMid[i], upper: up, lower: dn,
           pctB: (closes[i] - dn) / (up - dn),
           widthAtr: (up - dn) };
  }
  return { rsi: r[i], stochK: st.k[i], stochD: st.d[i], bb: bb,
           macdHist: trend.macd ? trend.macd.hist[i] : NaN,
           macdLine: trend.macd ? trend.macd.line[i] : NaN,
           macdSignal: trend.macd ? trend.macd.signal[i] : NaN };
}

/* -------------------------------------- THE THREE PAIRINGS */

/* Each pairing is a named, auditable verdict for one direction. `null` means
   a leg could not be computed, which is UNCHECKED -- it agrees with nothing.

   These are not three independent confirmations. RSI, the Stochastic, MACD
   and Bollinger %B are all functions of the same closes, so their agreement
   is largely a series agreeing with itself. What the pairing buys is
   SELECTIVITY, and the card says so rather than dressing it up as
   confluence. */
function npPairs(mom, trend, structure, dir){
  var want = dir === 'long';
  var out = [];

  /* PAIR A — RSI + Stochastic: momentum with the trade, and not already
     stretched into the zone the move usually ends in. */
  var a = null, aWhy;
  if (!isFinite(mom.rsi) || !isFinite(mom.stochK) || !isFinite(mom.stochD)){
    aWhy = 'UNCHECKED — RSI or Stochastic not computable';
  } else {
    var rsiOk = want ? mom.rsi > 50 : mom.rsi < 50;
    var stOk = want ? mom.stochK > mom.stochD : mom.stochK < mom.stochD;
    var notStretched = want ? mom.rsi < 75 && mom.stochK < 85 : mom.rsi > 25 && mom.stochK > 15;
    a = rsiOk && stOk && notStretched;
    aWhy = 'RSI ' + fmt(mom.rsi, 1) + (rsiOk ? ' with' : ' against') + ' · Stoch %K '
      + fmt(mom.stochK, 1) + '/' + fmt(mom.stochD, 1) + (stOk ? ' crossing with' : ' crossing against')
      + (notStretched ? '' : ' · already stretched');
  }
  out.push({ pair: 'A', name: 'RSI + Stochastic', ok: a, why: aWhy });

  /* PAIR B — Bollinger + MA: price on the trend side of the band middle, and
     not pinned to the outer band, which is where a continuation is already
     paid for. */
  var b = null, bWhy;
  var maF = trend.ma ? trend.ma.fast[trend.ma.fast.length - 1] : NaN;
  if (!mom.bb || !isFinite(maF)){
    bWhy = 'UNCHECKED — Bollinger or moving average not computable';
  } else {
    var maOk = want ? structure.price > maF : structure.price < maF;
    var bandOk = want ? (mom.bb.pctB > 0.5 && mom.bb.pctB < 1.0)
                      : (mom.bb.pctB < 0.5 && mom.bb.pctB > 0.0);
    b = maOk && bandOk;
    bWhy = 'price ' + (maOk ? 'on the trend side of' : 'against') + ' EMA' + NP_MA_FAST
      + ' · %B ' + fmt(mom.bb.pctB, 2) + (bandOk ? '' : ' outside the usable half-band');
  }
  out.push({ pair: 'B', name: 'Bollinger + MA', ok: b, why: bWhy });

  /* PAIR C — MACD + Ichimoku: the momentum cross agrees, and the cloud plus
     the kijun agree it is the right side of the trend. */
  var c = null, cWhy;
  var ic = trend.ichimoku, j = ic ? ic.kijun.length - 1 : -1;
  if (!isFinite(mom.macdHist) || !ic || !isFinite(ic.spanA[j]) || !isFinite(ic.spanB[j]) || !isFinite(ic.kijun[j])){
    cWhy = 'UNCHECKED — MACD or Ichimoku not computable';
  } else {
    var macOk = want ? mom.macdHist > 0 : mom.macdHist < 0;
    var cloudTop = Math.max(ic.spanA[j], ic.spanB[j]), cloudBot = Math.min(ic.spanA[j], ic.spanB[j]);
    var cloudOk = want ? structure.price > cloudTop : structure.price < cloudBot;
    var kijunOk = want ? structure.price > ic.kijun[j] : structure.price < ic.kijun[j];
    c = macOk && cloudOk && kijunOk;
    cWhy = 'MACD hist ' + fmt(mom.macdHist, 4) + (macOk ? ' with' : ' against')
      + ' · price ' + (cloudOk ? 'clear of' : 'inside or against') + ' the cloud'
      + ' · ' + (kijunOk ? 'above' : 'below') + ' kijun ' + fmt(ic.kijun[j]);
  }
  out.push({ pair: 'C', name: 'MACD + Ichimoku', ok: c, why: cWhy });

  return out;
}

/* -------------------------------------- STEP 4: ENTRY AND EXIT */

/** the hit rate an R:R has to beat merely to break even */
function npBreakeven(rr){ return (isFinite(rr) && rr > 0) ? 1 / (1 + rr) : NaN; }

function npEvaluate(inp){
  inp = inp || {};
  var rows = inp.rows15 || [];
  var out = { ok: false, ledger: [], setup: null, bar: null, price: NaN, atr: NaN, gates: [] };
  if (rows.length < NP_MIN_15M){
    out.gates.push('need ' + NP_MIN_15M + ' closed 15m bars, have ' + rows.length);
    return out;
  }
  var n = rows.length;
  out.bar = { t: +rows[n - 1].t, c: +rows[n - 1].c };
  out.price = +rows[n - 1].c;
  var atr = npAtr(rows, 14);
  out.atr = atr;
  if (!isFinite(atr)){ out.gates.push('ATR unreadable'); return out; }

  /* STEP 1 */
  var trend = npTrend(rows);
  out.trend = trend;
  out.ledger.push({ step: '1 TREND', pass: trend.dir !== 'sideways',
    why: trend.dir.toUpperCase() + ' — ' + trend.up + ' up / ' + trend.down + ' down'
       + (trend.unchecked ? ' / ' + trend.unchecked + ' unchecked' : '')
       + ' · ' + trend.votes.map(function(v){ return v.name + ' ' + (v.vote || 'unchecked'); }).join(', ') });
  if (trend.dir === 'sideways'){ out.gates.push('TREND: sideways — no trade'); return out; }
  var dir = trend.dir === 'up' ? 'long' : 'short';
  out.dir = dir;

  /* STEP 2 */
  var st = npStructure(rows, atr);
  out.structure = st;
  var nearest = dir === 'long' ? st.resistance : st.support;
  var backstop = dir === 'long' ? st.support : st.resistance;
  var room = dir === 'long' ? st.resistAtr : st.supportAtr;
  /* THE TARGET IS THE FIRST LEVEL THAT PAYS, NOT THE NEAREST ONE.

     Stopping beyond the nearest level behind and targeting the nearest level
     in front sounds like the method and is almost never a trade. Measured
     over 300 tapes: 43 confirmed pivots and 11 clustered levels apiece, 94
     trending tapes with a level on both sides -- and a median structural R:R
     of 0.42, p90 1.43, with only 5 of 94 reaching 2R. Adjacent levels sit
     roughly equidistant from price, so nearest-to-nearest is a coin flip
     paying less than evens.

     So the exit is chosen the way a person reads a chart: walk the levels in
     the trade's direction and take the first one that clears the R:R floor.
     Every candidate is a real measured level with its own touch count --
     nothing is invented, and no multiple of ATR is substituted for structure.
     If no level in front pays, there is no trade and the card says what the
     best available was. */
  var barrier = null, bestRr = NaN;
  if (backstop && isFinite(atr)){
    var entryNow = out.price;
    var padNow = NP_STOP_PAD_ATR * atr;
    var stopNow = dir === 'long' ? (backstop.price - padNow) : (backstop.price + padNow);
    var riskNow = Math.abs(entryNow - stopNow);
    if (riskNow > 0){
      var cands = st.levels.filter(function(L){
        var ahead = dir === 'long' ? (L.price > entryNow) : (L.price < entryNow);
        if (!ahead) return false;
        return Math.abs(L.price - entryNow) / atr <= NP_SR_MAX_ATR;
      }).sort(function(a, b){
        return Math.abs(a.price - entryNow) - Math.abs(b.price - entryNow);
      });
      for (var ci = 0; ci < cands.length; ci++){
        var rrC = Math.abs(cands[ci].price - entryNow) / riskNow;
        if (!isFinite(bestRr) || rrC > bestRr) bestRr = rrC;
        if (rrC >= NP_MIN_RR){ barrier = cands[ci]; break; }
      }
    }
  }
  var haveRoom = !!barrier;
  out.ledger.push({ step: '2 SUPPORT / RESISTANCE', pass: !!(barrier && backstop),
    why: (backstop ? ((dir === 'long' ? 'support ' : 'resistance ') + fmt(backstop.price)
            + ' (' + backstop.n + ' touches)') : 'no level behind the trade')
       + ' · ' + (nearest ? ('nearest ' + (dir === 'long' ? 'resistance ' : 'support ')
            + fmt(nearest.price) + ' at ' + fmt(room, 1) + ' ATR') : 'no level in front')
       + ' · ' + (barrier ? ('targeting ' + fmt(barrier.price) + ' (' + barrier.n + ' touches)')
            : ('no level in front pays ' + NP_MIN_RR + 'R'
               + (isFinite(bestRr) ? ' — best available ' + fmt(bestRr, 2) + 'R' : '')))
       + (st.lineHigh || st.lineLow ? ' · sloping line'
            + (st.lineHigh ? ' high ' + fmt(st.lineHigh.at) : '')
            + (st.lineLow ? ' low ' + fmt(st.lineLow.at) : '') : '') });
  if (!backstop){ out.gates.push('STRUCTURE: nothing behind the trade to stop against'); return out; }
  if (!haveRoom){
    out.gates.push('STRUCTURE: no level in front pays ' + NP_MIN_RR + 'R'
      + (isFinite(bestRr) ? ' (best available ' + fmt(bestRr, 2) + 'R)' : ''));
    return out;
  }

  /* STEP 3 + the three pairings */
  var mom = npMomentum(rows, trend);
  out.momentum = mom;
  var pairs = npPairs(mom, trend, st, dir);
  out.pairs = pairs;
  var agreed = pairs.filter(function(p){ return p.ok === true; }).length;
  var unchecked = pairs.filter(function(p){ return p.ok === null; }).length;
  out.ledger.push({ step: '3 MOMENTUM — three pairings', pass: agreed === 3,
    why: agreed + ' of 3 agree' + (unchecked ? ', ' + unchecked + ' unchecked' : '') + ' · '
       + pairs.map(function(p){ return p.pair + ' ' + (p.ok === null ? 'UNCHECKED' : p.ok ? 'agree' : 'no'); }).join(' · ') });
  if (agreed !== 3){ out.gates.push('PAIRS: ' + agreed + ' of 3 agreed'); return out; }

  /* STEP 4 — the plan comes off the structure, not off a fixed multiple */
  var entry = out.price;
  var pad = NP_STOP_PAD_ATR * atr;
  var stop = dir === 'long' ? (backstop.price - pad) : (backstop.price + pad);
  var risk = Math.abs(entry - stop);
  var vc = inp.venueCost, costFrac = vc ? vc.rtFrac : NaN;
  var costFloor = isFinite(costFrac) ? entry * costFrac * NP_COST_MULT : 0;
  var floorNote = '';
  if (risk < costFloor){
    risk = costFloor;
    stop = dir === 'long' ? entry - risk : entry + risk;
    floorNote = 'stop widened to ' + NP_COST_MULT + '× the ' + ((vc && vc.venue) || 'venue') + ' round-trip';
  }
  if (!(risk > 0)){ out.gates.push('PLAN: zero risk'); return out; }
  /* NO WRONG-SIDE CHECK HERE, deliberately. `backstop` is by construction the
     nearest level BEHIND price -- support under a long, resistance over a
     short -- so `backstop.price ∓ pad` is always on the correct side, and the
     cost floor only ever rewrites the stop as `entry ∓ risk`, which is too.
     A guard for a state that cannot be reached is not defence, it is a line
     that will never be exercised and will therefore never be right. (In
     CRYPTOVERSE the equivalent check IS load-bearing, because a sweep extreme
     can fall either side of entry.) The property test asserts the sides on
     every setup that reaches a card, which is where it would show. */
  /* TP1 is the level in front — the exit the structure actually offers */
  var t1 = barrier.price;
  var reward = Math.abs(t1 - entry);
  var rr = reward / risk;
  out.ledger.push({ step: '4 ENTRY / EXIT', pass: rr >= NP_MIN_RR,
    why: 'entry ' + fmt(entry) + ' · stop beyond the level behind it ' + fmt(stop)
       + ' · target the level in front ' + fmt(t1) + ' — ' + fmt(rr, 2) + 'R'
       + (rr >= NP_MIN_RR ? '' : ', under the ' + NP_MIN_RR + 'R floor') });
  if (rr < NP_MIN_RR){
    out.gates.push('R:R ' + fmt(rr, 2) + ' under the ' + NP_MIN_RR + 'R floor');
    return out;
  }
  var d = dir === 'long' ? 1 : -1;
  out.ok = true;
  out.setup = {
    dir: dir, entry: entry, stop: stop, t1: t1, t2: entry + d * risk * (rr + 1),
    risk: risk, rr1: rr, breakeven: npBreakeven(rr),
    stopAtr: risk / atr, floorNote: floorNote,
    supportLevel: backstop.price, supportTouches: backstop.n,
    targetLevel: barrier.price, targetTouches: barrier.n,
    nearestLevel: nearest ? nearest.price : NaN,
    nearestAtr: isFinite(room) ? room : NaN,
    trend: trend.dir, horizonBars: NP_HORIZON,
    orderType: dir === 'long' ? 'BUY' : 'SELL'
  };
  return out;
}

/* -------------------------------------------- the crypto macro read */

/* hg-v984: the same read CRYPTOVERSE takes, for the same reason -- see
   cvMacroMark. Six indicators over one price series never asked whether BTC
   dominance or the dollar was against an alt long; the shared filter that
   asks is applied on SWING, SCALP, EDGE and BEST and measured on none. Read,
   printed, recorded; never gated here. */
function npMacroMark(sym, dir){
  try{
    if (typeof W.hgMacroAltMark !== 'function') return null;
    var m = W.hgMacroAltMark(sym, dir);
    if (!m || !(m.block === true || m.block === false)) return null;
    return { block: m.block, why: m.why || null };
  }catch(e){ return null; }
}

/* hg-v985: the same funding read CRYPTOVERSE takes -- see cvFundingMark. */
function npFundingMark(item, dir){
  try{
    if (typeof W.hgFundingAgainstMark !== 'function') return null;
    var m = W.hgFundingAgainstMark(item && item.fundingPct, dir);
    if (!m || !(m.against === true || m.against === false)) return null;
    return { against: m.against, fundingPct: m.fundingPct, why: m.why || null };
  }catch(e){ return null; }
}

function npFundingChipHTML(row){
  var m = row && row.funding;
  if (!m || m.against !== true) return '';
  return '<span class="np-chip" style="background:#FEE2E2;color:#991B1B" title="'
    + esc(m.why || '') + '">FUNDING AGAINST ' + esc(fmt(m.fundingPct, 4)) + '%</span>';
}

function npFundingNoteHTML(row){
  var m = row && row.funding;
  if (!m || m.against !== true) return '';
  return '<div class="np-note"><b>FUNDING RUNS AGAINST THIS TRADE.</b> The venue prints '
    + esc(fmt(m.fundingPct, 4)) + '% per interval, which the SWING and SCALP matrices veto at the G4 bar (0.04% against the side). '
    + 'This desk read price alone and never asked; it does not gate on it here because the rule is measured on no desk. '
    + 'The rate and the verdict ride on this setup\'s forward record, so the FORWARD panel below can say whether it should have. Reported, not gated.</div>';
}

function npMacroChipHTML(row){
  var m = row && row.macro;
  if (!m || m.block !== true) return '';
  return '<span class="np-chip" style="background:#FEF3C7;color:#92400E" title="'
    + esc(m.why || '') + '">MACRO FILTER WOULD BLOCK</span>';
}

function npMacroNoteHTML(row){
  var m = row && row.macro;
  if (!m || m.block !== true) return '';
  return '<div class="np-note"><b>THE SHARED CRYPTO MACRO FILTER WOULD HAVE BLOCKED THIS.</b> '
    + esc(m.why || 'BTC dominance or the dollar reads risk-off for alt longs') + '. '
    + 'SWING, SCALP, EDGE and BEST refuse an alt long on that read; this desk has never asked it, '
    + 'and does not gate on it here because the filter is measured on no desk. '
    + 'The verdict rides on this setup\'s forward record, so the FORWARD panel below can say '
    + 'whether the setups it would have removed paid. Reported, not gated.</div>';
}

/* --------------------------------------------------- forward log */

function npFwdRows(setups){
  if (!Array.isArray(setups)) return [];
  function lvl(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }
  var out = [], i;
  for (i = 0; i < setups.length; i++){
    var s = setups[i], p = s && s.setup;
    if (!s || !s.sym || !p) continue;
    var en = lvl(p.entry), st = lvl(p.stop), tp = lvl(p.t1);
    if (!isFinite(en) || !isFinite(st) || !isFinite(tp) || en === st) continue;
    out.push({
      sym: String(s.sym), dir: p.dir, entry: en, stop: st, t1: tp,
      mark: isFinite(+s.price) && +s.price > 0 ? +s.price : undefined,
      barT: (s.bar && isFinite(+s.bar.t) && +s.bar.t > 0) ? +s.bar.t : undefined,
      /* the mechanic carries the TREND the setup was taken in, so the log can
         answer whether this rule works in both directions or only one */
      mechanic: ('NP90-' + String(p.dir) + '@v' + NP_LABEL_V).toUpperCase().slice(0, 28),
      ticket: true,
      /* hg-v984: the macro read the card shows, or NOT RECORDED */
      macroBlock: (s.macro && (s.macro.block === true || s.macro.block === false)) ? s.macro.block : undefined,
      /* hg-v985: the funding the card read, or NOT RECORDED. Only the RATE is
         handed in: the ledger derives the verdict from it through the same
         rule the card used, so the two agree by construction and a second
         hand-in of the verdict would be a duplicated check (unkillable, and
         a place for the two to drift). */
      fundingPct: (s.funding && typeof s.funding.fundingPct === 'number' && isFinite(s.funding.fundingPct)) ? s.funding.fundingPct : undefined
    });
  }
  return out;
}

/* THE TAB AUDITS ITS OWN NAME.

   Reads this desk's settled records and reports the measured hit rate beside
   the 90% the name implies, with the overlap correction the rest of the app
   uses. Returns null when nothing has settled, so the header says that rather
   than filling the gap with the number in the title. */
function npSelfAudit(){
  try{
    if (typeof W.hgFwdPool !== 'function') return null;
    var pool = W.hgFwdPool('90PERCENT') || {};
    var keys = Object.keys(pool);
    if (!keys.length) return null;
    var wins = 0, settled = 0, open = 0, i, st;
    for (i = 0; i < keys.length; i++){
      st = pool[keys[i]];
      if (!st) continue;
      wins += (st.wins || 0); settled += (st.samples || 0); open += (st.open || 0);
    }
    var out = { settled: settled, open: open, hit: settled ? wins / settled : NaN,
                effN: NaN, target: NP_TARGET_HIT };
    if (!settled) return out;
    var ov = (typeof W.hgFwdOverlap === 'function') ? W.hgFwdOverlap('90PERCENT', null, {}) : null;
    if (ov && isFinite(ov.effN)) out.effN = ov.effN;
    return out;
  }catch(e){ return null; }
}

/** the header sentence — measured, or an honest silence */
function npAuditText(a){
  var target = Math.round(NP_TARGET_HIT * 100) + '%';
  if (!a || !a.settled){
    return 'This tab is named for a ' + target + ' target. Nothing of its own has settled yet'
      + (a && a.open ? ' (' + a.open + ' still open)' : '')
      + ', so no hit rate is claimed — the forward panel below will answer it.';
  }
  var got = Math.round(a.hit * 100) + '%';
  var eff = isFinite(a.effN) ? (a.effN >= 10 ? a.effN.toFixed(0) : a.effN.toFixed(1)) : null;
  return 'Named for a ' + target + ' target. MEASURED on its own settled records: '
    + got + ' over ' + a.settled + ' settled'
    + (eff ? ' (' + eff + ' independent after correcting for overlap)' : '')
    + ' — ' + (a.hit >= NP_TARGET_HIT ? 'at or above the name'
              : 'below the name, which is what the name is for');
}

W.__npClosedRows = npClosedRows;
W.__npMacroMark = npMacroMark;   /* hg-v984 */
W.__npFundingMark = npFundingMark;   /* hg-v985 */
W.__npTrend = npTrend;
W.__npPivots = npPivots;
W.__npLevels = npLevels;
W.__npTrendline = npTrendline;
W.__npStructure = npStructure;
W.__npMomentum = npMomentum;
W.__npPairs = npPairs;
W.__npEvaluate = npEvaluate;
W.__npBreakeven = npBreakeven;
W.__npFwdRows = npFwdRows;
W.__npSelfAudit = npSelfAudit;
W.__npAuditText = npAuditText;
W.__npStoch = npStoch;
W.__npIchimoku = npIchimoku;
W.__npMacd = npMacd;
W.__npRsi = npRsi;
W.__npAtr = npAtr;
W.HG_NINETY_RULE = {
  rsi: NP_RSI, stochK: NP_STOCH_K, stochD: NP_STOCH_D,
  bbLen: NP_BB_LEN, bbMult: NP_BB_MULT,
  maFast: NP_MA_FAST, maSlow: NP_MA_SLOW, maTrend: NP_MA_TREND,
  macd: [NP_MACD_F, NP_MACD_S, NP_MACD_SIG],
  ichimoku: [NP_ICHI_T, NP_ICHI_K, NP_ICHI_B], ichimokuShift: NP_ICHI_SHIFT,
  pivot: NP_PIVOT, srTolAtr: NP_SR_TOL_ATR, srMinTouch: NP_SR_MIN_TOUCH,
  srMaxAtr: NP_SR_MAX_ATR, minRr: NP_MIN_RR, horizon: NP_HORIZON,
  minBars15m: NP_MIN_15M, targetHit: NP_TARGET_HIT, labelVersion: NP_LABEL_V
};

/* =====================================================================
   UI
   ===================================================================== */

var NP_CSS = ''
  + '.np-wrap{padding:10px;font-family:system-ui,-apple-system,sans-serif}'
  + '.np-hdr{font-size:15px;font-weight:800;letter-spacing:.04em;margin:0 0 4px}'
  + '.np-hdr span{font-weight:400;font-size:10px;color:#64748B;letter-spacing:0}'
  + '.np-audit{font-size:10px;color:#3730A3;background:#EEF2FF;border:1px solid #C7D2FE;'
  + 'border-radius:6px;padding:8px;margin:8px 0}'
  + '.np-stat{font-size:10px;color:#64748B;margin-left:6px}'
  + '.np-bar{height:3px;background:#E2E8F0;border-radius:2px;overflow:hidden;margin:6px 0}'
  + '.np-bar-fill{height:100%;background:#6366F1;width:0%;transition:width .2s}'
  + '.np-card{border:1px solid #E2E8F0;border-radius:8px;margin:8px 0;overflow:hidden;background:#fff}'
  + '.np-long{border-left:3px solid #16A34A}.np-short{border-left:3px solid #DC2626}'
  + '.np-head{padding:8px 10px;cursor:pointer;display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
  + '.np-sym{font-weight:800;font-size:12px}'
  + '.np-chip{font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 5px;border-radius:3px;background:#F1F5F9;color:#475569}'
  + '.np-up{background:#DCFCE7;color:#166534}.np-dn{background:#FEE2E2;color:#991B1B}'
  + '.np-meta{flex-basis:100%;font-size:10px;color:#64748B}'
  + '.np-body{display:none;padding:0 10px 10px}.np-body.np-show{display:block}'
  + '.np-lv{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}'
  + '.np-lv div{border:1px solid #E2E8F0;border-radius:5px;padding:5px;text-align:center}'
  + '.np-lv small{display:block;font-size:8px;color:#94A3B8;letter-spacing:.06em}'
  + '.np-lv b{font-size:11px}'
  + '.np-tbl{width:100%;border-collapse:collapse;font-size:10px;margin:6px 0}'
  + '.np-tbl th{text-align:left;font-size:8px;letter-spacing:.06em;color:#94A3B8;border-bottom:1px solid #E2E8F0;padding:3px}'
  + '.np-tbl td{border-bottom:1px solid #F1F5F9;padding:3px;vertical-align:top}'
  + '.np-ok{color:#166534;font-weight:700}.np-no{color:#B91C1C;font-weight:700}'
  + '.np-unk{color:#94A3B8;font-weight:700}'
  + '.np-note{font-size:10px;color:#475569;border:1px solid #E2E8F0;border-radius:6px;padding:8px;margin:10px 0;background:#F8FAFC}';

var __ui = null, __busy = false, __results = null;

function setStat(t, bad){
  try{ if (__ui && __ui.stat){ __ui.stat.textContent = t; __ui.stat.style.color = bad ? '#DC2626' : ''; } }catch(e){}
}
function setProgress(p){
  try{ if (__ui && __ui.bar) __ui.bar.style.width = Math.min(100, Math.max(0, p)) + '%'; }catch(e){}
}

function npStepsHTML(ledger){
  if (!Array.isArray(ledger) || !ledger.length) return '';
  var h = '<table class="np-tbl"><tr><th>step</th><th></th><th>what it read</th></tr>';
  for (var i = 0; i < ledger.length; i++){
    var g = ledger[i];
    h += '<tr><td><b>' + esc(g.step) + '</b></td><td class="' + (g.pass ? 'np-ok' : 'np-no') + '">'
      + (g.pass ? 'PASS' : 'STOP') + '</td><td>' + esc(g.why || '') + '</td></tr>';
  }
  return h + '</table>';
}

function npPairsHTML(pairs){
  if (!Array.isArray(pairs) || !pairs.length) return '';
  var h = '<table class="np-tbl"><tr><th>pairing</th><th></th><th>reading</th></tr>';
  for (var i = 0; i < pairs.length; i++){
    var p = pairs[i];
    var cls = p.ok === null ? 'np-unk' : p.ok ? 'np-ok' : 'np-no';
    var word = p.ok === null ? 'UNCHECKED' : p.ok ? 'AGREE' : 'no';
    h += '<tr><td><b>' + esc(p.pair) + '</b> ' + esc(p.name) + '</td><td class="' + cls + '">'
      + word + '</td><td>' + esc(p.why || '') + '</td></tr>';
  }
  return h + '</table>';
}

function npCardHTML(row, idx){
  var s = row.setup, id = 'np_' + idx;
  var h = '<div class="np-card ' + (s.dir === 'long' ? 'np-long' : 'np-short') + '">';
  h += '<div class="np-head" onclick="__npToggle(' + idx + ')">';
  h += '<span class="np-sym">' + esc(row.sym) + '</span>';
  h += '<span class="np-chip">' + esc(venueName(row.exchange)) + '</span>';
  h += '<span class="np-chip ' + (s.dir === 'long' ? 'np-up' : 'np-dn') + '">' + s.dir.toUpperCase() + '</span>';
  h += '<span class="np-chip">TREND ' + esc(s.trend.toUpperCase()) + '</span>';
  h += '<span class="np-chip">3/3 PAIRS</span>';
  h += '<span class="np-chip">RECORD ONLY</span>';
  h += npMacroChipHTML(row);   /* hg-v984 */
  h += npFundingChipHTML(row);   /* hg-v985 */
  h += '<span class="np-meta">entry ' + fmt(s.entry) + ' · stop ' + fmt(s.stop)
    + ' · target ' + fmt(s.t1) + ' (' + fmt(s.rr1, 2) + 'R) · breakeven '
    + Math.round(s.breakeven * 100) + '%'
    + '<br>closed 15m bar ' + new Date(row.bar.t * 1000).toISOString().replace('T', ' ').slice(0, 16)
    + ' UTC · stop beyond a level with ' + s.supportTouches + ' touches · target a level with '
    + s.targetTouches + '</span>';
  h += '<span id="' + id + '_a">&#9654;</span></div>';

  h += '<div class="np-body" id="' + id + '">';
  h += '<div class="np-lv">'
    + '<div><small>ENTRY</small><b>' + fmt(s.entry) + '</b></div>'
    + '<div><small>STOP</small><b style="color:#DC2626">' + fmt(s.stop) + '</b></div>'
    + '<div><small>TARGET (' + fmt(s.rr1, 2) + 'R)</small><b style="color:#166534">' + fmt(s.t1) + '</b></div>'
    + '<div><small>RUNNER</small><b style="color:#166534">' + fmt(s.t2) + '</b></div>'
    + '</div>';
  h += npStepsHTML(row.ledger);
  h += npPairsHTML(row.pairs);
  h += npMacroNoteHTML(row);   /* hg-v984 */
  h += npFundingNoteHTML(row);   /* hg-v985 */
  h += '<div class="np-note"><b>WHAT THE THREE PAIRINGS ARE AND ARE NOT.</b> '
    + 'RSI, the Stochastic, MACD and Bollinger %B are all computed from the same closes, '
    + 'so their agreement is largely one price series agreeing with itself — it is not six '
    + 'independent confirmations. What requiring all three buys is SELECTIVITY, which is '
    + 'worth having on its own. Whether it pays is the forward panel\'s question, not this card\'s. '
    + 'At ' + fmt(s.rr1, 2) + 'R this only has to be right ' + Math.round(s.breakeven * 100)
    + '% of the time to break even before costs.'
    + (s.floorNote ? '<br>' + esc(s.floorNote) : '') + '</div>';
  h += '</div></div>';
  return h;
}

function npToggle(idx){
  var b = document.getElementById('np_' + idx);
  if (b) b.classList.toggle('np-show');
}
W.__npToggle = npToggle;

function npCoverageHTML(run){
  if (!run || !run.scanned) return '';
  var read = Math.max(0, run.scanned - run.skipped - run.unread - run.errors);
  var t = read + ' of ' + run.universe + ' contracts read';
  if (run.skipped) t += ' · ' + run.skipped + ' skipped (fewer than ' + NP_MIN_15M + ' closed 15m bars)';
  if (run.unread) t += ' · ' + run.unread + ' never fetched';
  if (run.errors) t += ' · ' + run.errors + ' threw';
  var mix = [], k;
  for (k in (run.venueCounts || {})) if (run.venueCounts[k] > 0) mix.push(venueName(k) + ' ' + run.venueCounts[k]);
  if (mix.length) t += ' · from ' + mix.join(' · ');
  if (run.note) t += ' · universe: ' + run.note;
  return '<div style="font-size:10px;color:' + (run.note ? '#92400E' : '#64748B')
    + ';margin:4px 0">COVERAGE · ' + esc(t) + '</div>';
}

function npEmptyHTML(run){
  if (!run || !run.scanned) return '<div class="np-note">90PERCENT has not run in this session yet.</div>';
  var read = Math.max(0, run.scanned - run.skipped - run.unread - run.errors);
  var h = '<div class="np-note"><b>No setups.</b> ' + read + ' of ' + run.universe
    + ' contracts were read and none passed all four steps. The commonest stop is step 1: '
    + 'most contracts, most of the time, are SIDEWAYS — which the method treats as a verdict '
    + 'rather than a failure.</div>';
  var tally = run.stepTally || {}, keys = Object.keys(tally).sort(function(a, b){ return tally[b] - tally[a]; });
  if (keys.length){
    h += '<table class="np-tbl"><tr><th>first step that stopped it</th><th>contracts</th></tr>';
    for (var i = 0; i < keys.length; i++)
      h += '<tr><td>' + esc(keys[i]) + '</td><td>' + tally[keys[i]] + '</td></tr>';
    h += '</table>';
  }
  return h;
}

function renderCards(rows, run){
  if (!__ui || !__ui.cards) return;
  var h = npCoverageHTML(run);
  if (!rows || !rows.length){ __ui.cards.innerHTML = h + npEmptyHTML(run); return; }
  h += '<div style="font-size:11px;font-weight:700;color:#3730A3;background:#EEF2FF;'
    + 'padding:6px 8px;border-radius:6px;margin:8px 0">' + rows.length + ' setup'
    + (rows.length === 1 ? '' : 's') + ' passed all four steps with all three pairings agreeing</div>';
  for (var i = 0; i < rows.length; i++) h += npCardHTML(rows[i], i);
  __ui.cards.innerHTML = h;
  npPaintFwd();
}

function npPaintFwd(){
  try{
    if (__ui && __ui.fwd && typeof W.hgFwdPanelHTML === 'function')
      __ui.fwd.innerHTML = W.hgFwdPanelHTML('90PERCENT', { minRr: NP_MIN_RR,
        title: 'FORWARD — what this rule actually hits' }) || '';
  }catch(e){}
  try{ if (__ui && __ui.audit) __ui.audit.innerHTML = esc(npAuditText(npSelfAudit())); }catch(e2){}
}

async function runScan(ui){
  if (__busy) return 'busy';
  __busy = true;
  var loadUni = W.hgDeskLoadDeltaCoinDCX || W.hgDeskLoadUniverse;
  var fetchKl = W.hgDeskFetchKlines;
  var fetchRes = W.hgDeskFetchKlinesResult;
  if (typeof loadUni !== 'function' || typeof fetchKl !== 'function'){
    setStat('desk-scan-universe.js not loaded — universe helpers missing', true);
    __busy = false; return 'error: universe missing';
  }
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    setStat('loading universe (Delta + CoinDCX futures)…');
    setProgress(0);
    var prevVenues = (__results && __results.venueCounts) ? __results.venueCounts : null;
    var pack = await loadUni({ minTurnover: 0, includeUnknown: true });
    var items = pack.items || [];
    if (!items.length){ setStat('universe empty', true); return 'error: empty universe'; }
    var vc = pack.venueCounts || {};
    var now = Date.now();
    var rows = [], scanned = 0, skipped = 0, unread = 0, errors = 0, stepTally = {};

    for (var i = 0; i < items.length; i++){
      var item = items[i];
      try{
        var got = fetchRes ? await fetchRes(item, '15m', KL_15M)
          : { rows: (await fetchKl(item, '15m', KL_15M)) || [], ok: true, reason: null };
        scanned++; setProgress((scanned / items.length) * 100);
        if (!got.ok){ unread++; continue; }
        var closed = npClosedRows(got.rows || [], 900, now);
        if (closed.length < NP_MIN_15M){ skipped++; continue; }

        var res = npEvaluate({ rows15: closed, venueCost: costFor(item) });
        if (!res.ok){
          var stopped = res.ledger.length ? 'too few closed bars' : 'too few closed bars';
          for (var g = 0; g < res.ledger.length; g++){
            if (!res.ledger[g].pass){ stopped = res.ledger[g].step; break; }
          }
          stepTally[stopped] = (stepTally[stopped] || 0) + 1;
          continue;
        }
        rows.push({ sym: item.sym, exchange: item.exchange, bar: res.bar, price: res.price,
                    setup: res.setup, ledger: res.ledger, pairs: res.pairs,
                    macro: npMacroMark(item.sym, res.setup.dir),
                    funding: npFundingMark(item, res.setup.dir) });
        setStat('scanned ' + scanned + '/' + items.length + ' · ' + rows.length + ' setup(s) so far…');
      }catch(eC){ errors++; }
    }

    rows.sort(function(a, b){ return b.setup.rr1 - a.setup.rr1; });

    try{
      if (typeof W.hgFwdRecordScan === 'function'){
        var fwd = npFwdRows(rows);
        if (fwd.length) W.hgFwdRecordScan('90PERCENT', '15m', fwd, { horizonBars: NP_HORIZON });
      }
    }catch(eF){}

    __results = { at: now, setups: rows, universe: items.length, scanned: scanned,
                  skipped: skipped, unread: unread, errors: errors, stepTally: stepTally,
                  venueCounts: vc, prevVenueCounts: prevVenues, note: pack.note || null };
    renderCards(rows, __results);
    setStat(rows.length + ' setup(s) from ' + scanned + ' scanned · ' + skipped
      + ' skipped (too few closed bars) · ' + unread + ' unread · ' + errors + ' errors · '
      + new Date().toISOString().slice(11, 19) + ' UTC');
    setProgress(100);
    return 'refreshed';
  }catch(e){
    setStat('scan failed: ' + ((e && e.message) || e), true);
    return 'error: ' + ((e && e.message) || e);
  }finally{
    __busy = false;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
  }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML = '<style>' + NP_CSS + '</style><div class="np-wrap">'
      + '<h2 class="np-hdr">90PERCENT <span>· Delta + CoinDCX futures · trend → support/resistance → momentum → entry · '
      + 'RSI · Stochastic · Bollinger · MA · MACD · Ichimoku · closed bars only · record only</span></h2>'
      + '<div class="np-audit" id="npAudit">' + esc(npAuditText(npSelfAudit())) + '</div>'
      + '<div style="margin:8px 0"><button class="btn" id="npRun">SCAN 90PERCENT</button>'
      + '<span class="np-stat" id="npStat">idle</span></div>'
      + '<div class="np-bar"><div class="np-bar-fill" id="npBar"></div></div>'
      + '<div id="npCards"></div><div id="npFwd" style="margin-top:14px"></div></div>';
    __ui = { cards: el.querySelector('#npCards'), stat: el.querySelector('#npStat'),
             btn: el.querySelector('#npRun'), bar: el.querySelector('#npBar'),
             fwd: el.querySelector('#npFwd'), audit: el.querySelector('#npAudit') };
    if (__ui.btn) __ui.btn.addEventListener('click', function(){ runScan(__ui); });
    if (__results) renderCards(__results.setups, __results);
    npPaintFwd();
  }catch(e){}
}

function refresh(){ return runScan(__ui); }
function ninetyPercentState(){ return __results || null; }

W.ninetyPercentState = ninetyPercentState;
W.__npCardHTML = npCardHTML;
W.__npPairsHTML = npPairsHTML;
W.__npStepsHTML = npStepsHTML;
W.__npEmptyHTML = npEmptyHTML;
W.__npCoverageHTML = npCoverageHTML;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: '90PERCENT', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: '90PERCENT', run: async function(){ return runScan(__ui); } });

})();
