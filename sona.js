/* HARDGATE — sona.js
   SONA. The prints are still HG Gold 81. The prices are not.

   Long or short only when both prints land on the same closed bar:
   an EMA 24 pullback inside the EMA 120 stack, and a UTC-session VWAP
   reclaim whose VWAP is sloping the same way. The slope is six bars of
   this UTC day with no missing bar — yesterday's VWAP and a hole are
   not a slope. The candle body must be at least 0.15×ATR(14), and
   EMA 120 must slope with the trade over four contiguous bars.

   Entry is that close, on the 0.01 tick. The stop is one tick beyond
   the pullback wick: the low on a long, the high on a short. That is
   where the idea is wrong. The trade is refused when that risk is
   under 0.75×ATR, under 4× the 0.02% XM round trip, or wider than
   2.5×ATR, and when the bar's volume is not above its 20-bar average.
   The studied window is 07:00–13:00 UTC. The target is 1.5R of the
   published risk. A coin-flip path between those two barriers no longer
   needs a 74% hit rate.
   One plan is open at a time and runs until the stop or the target.
   A later agreement is not a second setup. Both in one bar stays
   unresolved. 5m is not a book: there the ATR sits inside the cost.
   Friday UTC stands down — the measured worst day in both studied
   years. The UTC hour is printed and is not a filter.
   This desk writes no forward row and no ticket. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

var SPEC = {
  fastLen: 24,
  slowLen: 120,
  vwLook: 6,
  atrLen: 14,
  rewardR: 1.5,
  bodyMin: 0.15,
  slopeLen: 4,
  mintick: 0.01,
  sessStart: 7,
  /* hg-v1476 — THE VARIATION STUDY (scripts/sona-study.mjs, 24 months of
     PAXG 15m, in-sample 12m + out-of-sample 12m, both halves each):
     the London window 07:00-13:00 UTC with the 1.0-2.5xATR stop band and
     the volume>MA20 gate is the ONE configuration that is net-positive in
     BOTH windows (in-sample n=44 win 61.4% net +23.5R; out-of-sample n=86
     win 40.7% net +1.5R) against a baseline that is 39.6%/31.9% and
     -1.0R/-33.5R. Every other winner-in-sample (the 2.0R+ ladder, the
     overlap-only window, EMA-only prints) FAILED out of sample and is NOT
     shipped. The edge is a leak-remover, not a money printer, and it is
     stated as such. */
  sessEnd: 13,
  /* hg-v1478 — THE SUCCESSOR STUDY (desks/sona-study, ~2,700 variants on the
     same two windows, greedy staged sweep plus a refinement pass ON this
     incumbent): ONE new leg survived out-of-sample. Friday is the worst
     weekday in BOTH years (combined 18 settled, win 16.7%, net -10.5R —
     weekend position-squaring, not a trend day), so Friday UTC stands down.
     The stop floor loosens 1.0 -> 0.75xATR, admitting the tighter-wick
     prints the old floor refused (that notch alone was all-window-positive:
     OOS win 43.0% net +7.0R). Together, against the incumbent's
     61.4%/+23.5R IS and 40.5%/+1.0R OOS: IS n=42 win 66.7% net +28.0R,
     OOS n=82 win 47.6% net +15.5R, 24M n=124 win 54.0% net +43.5R,
     net-positive in ALL FOUR half-windows — the bar v1476 itself misses
     (OOS-H2 -0.5R). Honesty: the pair does not clear a naive Bonferroni
     over all ~2,700 runs; it clears the defensible bar — the Friday
     question is a 5-member family answered in an independent year, and
     every in-sample winner OUTSIDE this family failed out of sample. */
  stopAtrMin: 0.75,
  stopAtrMax: 2.5,
  volLook: 20,
  /* XM gold round trip. Four times that is the smallest risk that is
     not just the spread. 5m is absent because its ATR falls inside it. */
  rtFrac: 0.0002,
  rtMult: 4,
  /* 500 is the script's max_bars_back. The extra bars are warmup so
     EMA 120 at the right edge is not still the SMA seed of a short window. */
  count: 1500
};

var TF_MS = { '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000 };
var TF_OK = { '15m': 1, '1h': 1, '4h': 1 };

function isNum(x){ return typeof x === 'number' && isFinite(x); }

/* Integer cents. Math.round(x / 0.01) * 0.01 is wrong on values like
   1.005, which divide to 100.49999999999999 and round down. */
function centsOf(x){
  if (!isNum(x)) return NaN;
  var sign = x < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(x) / SPEC.mintick + 1e-8);
}
function tickPx(x){
  var c = centsOf(x);
  return isNum(c) ? c * SPEC.mintick : NaN;
}
function pxFromCents(c){ return c * SPEC.mintick; }
/* Round n/d to the nearest integer, half away from zero. n and d > 0. */
function divRound(n, d){
  return Math.floor((n + Math.floor(d / 2)) / d);
}

/* First tick strictly past the wick. A long stop sits below the low.
   A short stop sits above the high. A wick already on a tick steps one
   tick further, so the stop is not a price the signal bar traded. */
function beyondWickCents(price, dir){
  if (!isNum(price)) return NaN;
  var scaled = price / SPEC.mintick;
  var c;
  if (dir === 1){
    c = Math.floor(scaled + 1e-8);
    if (c >= scaled - 1e-6) c -= 1;
  } else {
    c = Math.ceil(scaled - 1e-8);
    if (c <= scaled + 1e-6) c += 1;
  }
  return c;
}

function centsAtLeast(x){
  if (!isNum(x) || !(x > 0)) return NaN;
  return Math.ceil(x / SPEC.mintick - 1e-8);
}

function centsAtMost(x){
  if (!isNum(x) || !(x > 0)) return NaN;
  return Math.floor(x / SPEC.mintick + 1e-8);
}

/* Stop beyond the wick. Refuse a risk the spread would eat, and a risk
   so wide the 1.5R target is no longer the pullback. Target is 1.5R of
   the published risk, rounded half away from zero. */
function planOf(row, dir, atr){
  var entryC = centsOf(row.c);
  var wick = dir === 1 ? row.l : row.h;
  var stopC = beyondWickCents(wick, dir);
  if (!isNum(entryC) || !isNum(stopC)) return { block: 'stop unread' };
  var riskC = dir === 1 ? (entryC - stopC) : (stopC - entryC);
  if (!(riskC >= 1)) return { block: 'stop unread' };
  var entryPx = pxFromCents(entryC);
  var floorAtr = centsAtLeast(SPEC.stopAtrMin * atr);
  var floorCost = centsAtLeast(SPEC.rtFrac * SPEC.rtMult * entryPx);
  var floorC = Math.max(isNum(floorAtr) ? floorAtr : 0, isNum(floorCost) ? floorCost : 0);
  var ceilC = centsAtMost(SPEC.stopAtrMax * atr);
  if (riskC < floorC) return { block: 'stop under floor' };
  if (!isNum(ceilC) || riskC > ceilC) return { block: 'stop wide' };
  var rewardC = divRound(riskC * 3, 2);
  if (!(rewardC >= 1)) return { block: 'target unread' };
  return {
    block: null,
    entry: entryPx,
    stop: pxFromCents(stopC),
    tp: pxFromCents(entryC + dir * rewardC),
    risk: pxFromCents(riskC),
    realizedR: rewardC / riskC,
    breakeven: riskC / (riskC + rewardC),
    costR: (SPEC.rtFrac * entryPx) / (riskC * SPEC.mintick)
  };
}

function barMs(row){
  if (!row || row.t == null) return null;
  var t = row.t;
  if (typeof t === 'string') t = Date.parse(t);
  if (!isNum(t)) return null;
  if (t < 1e12) t = t * 1000;
  return t;
}

function utcDay(ms){
  var d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function utcHm(ms){
  var d = new Date(ms);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function pad2(n){ return n < 10 ? '0' + n : String(n); }

/* The hours and the stop band the engine actually uses. The card must
   print these, not a leftover sentence from an older band. */
function sessSpan(){
  return pad2(SPEC.sessStart) + ':00–' + pad2(SPEC.sessEnd) + ':00 UTC';
}

function utcLabel(ms){
  if (!isNum(ms)) return '—';
  var d = new Date(ms);
  var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  function p(n){ return n < 10 ? '0' + n : String(n); }
  return p(d.getUTCDate()) + ' ' + mon + ' ' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' UTC';
}

function fmt(n){
  if (!isNum(n)) return '—';
  var c = centsOf(n);
  if (!isNum(c)) return '—';
  var sign = c < 0 ? '-' : '';
  var a = Math.abs(c);
  var whole = Math.floor(a / 100);
  var frac = a % 100;
  return sign + String(whole) + '.' + (frac < 10 ? '0' : '') + String(frac);
}

function fmtR(r){
  if (!isNum(r)) return '—';
  var c = Math.round(r * 100);
  var sign = c < 0 ? '-' : '';
  var a = Math.abs(c);
  return sign + Math.floor(a / 100) + '.' + (a % 100 < 10 ? '0' : '') + (a % 100);
}

function esc(s){
  var amp = '&' + 'amp;';
  var lt = '&' + 'lt;';
  var gt = '&' + 'gt;';
  var quot = '&' + 'quot;';
  return String(s == null ? '' : s)
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot);
}

function pathOk(row){
  if (!row) return false;
  if (!isNum(row.o) || !isNum(row.h) || !isNum(row.l) || !isNum(row.c)) return false;
  if (row.h < row.l) return false;
  if (row.h < row.o || row.h < row.c || row.l > row.o || row.l > row.c) return false;
  if (!(row.c > 0) || !(row.o > 0)) return false;
  return true;
}

/* A lookback of N bars is N times the timeframe, not N rows with a hole
   or a session break hiding inside the index. Half a bar of timestamp
   noise is allowed. More than that is a different distance. */
function isSpan(ms0, ms1, bars, step){
  if (ms0 == null || ms1 == null || !step || !(bars > 0)) return false;
  var g = (ms1 - ms0) / step;
  return isNum(g) && g > 0 && Math.abs(g - bars) <= 0.51;
}

/* Pine: SMA seed on the first bar ta.sma is ready, then
   ema := close * k + ema * (1 - k). A non-finite close clears it and
   the next finite SMA reseeds, matching the script's na() branch. */
function emaSeries(closes, len){
  var n = closes.length;
  var out = new Array(n);
  var e = NaN;
  var k = 2 / (len + 1);
  var i, j, sum, sma, ok;
  for (i = 0; i < n; i++){
    if (!isNum(e)){
      if (i < len - 1 || !isNum(closes[i])){ out[i] = NaN; continue; }
      sum = 0; ok = true;
      for (j = i - len + 1; j <= i; j++){
        if (!isNum(closes[j])){ ok = false; break; }
        sum += closes[j];
      }
      sma = ok ? sum / len : NaN;
      out[i] = sma;
      e = sma;
    } else if (isNum(closes[i])){
      e = closes[i] * k + e * (1 - k);
      out[i] = e;
    } else {
      e = NaN;
      out[i] = NaN;
    }
  }
  return out;
}

function trSeries(rows){
  var n = rows.length;
  var out = new Array(n);
  var i, r, prev, hl;
  for (i = 0; i < n; i++){
    r = rows[i];
    if (!pathOk(r)){ out[i] = NaN; continue; }
    hl = r.h - r.l;
    if (i === 0 || !pathOk(rows[i - 1])){ out[i] = hl; continue; }
    prev = rows[i - 1].c;
    out[i] = Math.max(hl, Math.abs(r.h - prev), Math.abs(r.l - prev));
  }
  return out;
}

/* ta.rma: first value is the SMA of the first `len` inputs, then Wilder. */
function rmaSeries(src, len){
  var n = src.length;
  var out = new Array(n);
  var a = NaN;
  var sum = 0;
  var filled = 0;
  var i, x;
  for (i = 0; i < n; i++){
    x = src[i];
    if (!isNum(a)){
      if (!isNum(x)){ out[i] = NaN; sum = 0; filled = 0; continue; }
      sum += x;
      filled++;
      if (filled === len){ a = sum / len; out[i] = a; }
      else out[i] = NaN;
    } else if (!isNum(x)){
      a = NaN; out[i] = NaN; sum = 0; filled = 0;
    } else {
      a = (a * (len - 1) + x) / len;
      out[i] = a;
    }
  }
  return out;
}

/* One weight per UTC day. A day whose every bar has a positive volume
   is volume-weighted. A day with any missing or zero volume is
   equal-weight. Mixing a synthetic weight of 1 with a real volume
   pulls the VWAP onto the one bar that happened to lack a print. */
function dayUsesVolume(rows){
  var mode = {};
  var i, ms, day, v, bad;
  for (i = 0; i < rows.length; i++){
    ms = barMs(rows[i]);
    if (ms == null || !pathOk(rows[i])) continue;
    day = utcDay(ms);
    v = rows[i].v;
    bad = !(isNum(v) && v > 0);
    if (mode[day] === undefined) mode[day] = !bad;
    else if (bad) mode[day] = false;
  }
  return mode;
}

function vwapSeries(rows){
  var n = rows.length;
  var vwap = new Array(n);
  var pvA = new Array(n);
  var vvA = new Array(n);
  var mode = dayUsesVolume(rows);
  var pv = 0, vv = 0, day = null;
  var i, ms, today, qty, typical, r;
  for (i = 0; i < n; i++){
    r = rows[i];
    ms = barMs(r);
    if (ms == null || !pathOk(r)){
      vwap[i] = NaN; pvA[i] = NaN; vvA[i] = NaN;
      continue;
    }
    today = utcDay(ms);
    qty = mode[today] ? r.v : 1;
    typical = (r.h + r.l + r.c) / 3;
    if (day === null || today !== day){
      pv = typical * qty;
      vv = qty;
      day = today;
    } else {
      pv += typical * qty;
      vv += qty;
    }
    pvA[i] = pv;
    vvA[i] = vv;
    vwap[i] = vv > 0 ? pv / vv : r.c;
  }
  return { vwap: vwap, pv: pvA, vv: vvA };
}

function volMaSeries(rows, len){
  var n = rows.length, out = new Array(n), i, k, sum, okc;
  for (i = 0; i < n; i++){
    if (i + 1 < len){ out[i] = NaN; continue; }
    sum = 0; okc = true;
    for (k = i - len + 1; k <= i; k++){ var v = rows[k] && rows[k].v; if (!(isNum(v) && v >= 0)){ okc = false; break; } sum += v; }
    out[i] = okc ? sum / len : NaN;
  }
  return out;
}
function hgSonaSeries(rows){
  var n = rows ? rows.length : 0;
  var closes = new Array(n);
  var i;
  for (i = 0; i < n; i++) closes[i] = pathOk(rows[i]) ? rows[i].c : NaN;
  var vw = vwapSeries(rows || []);
  return {
    emaFast: emaSeries(closes, SPEC.fastLen),
    emaSlow: emaSeries(closes, SPEC.slowLen),
    atr: rmaSeries(trSeries(rows || []), SPEC.atrLen),
    vwap: vw.vwap,
    pv: vw.pv,
    vv: vw.vv,
    volMa: volMaSeries(rows || [], SPEC.volLook)
  };
}

function closedRows(rows, tf, now){
  var out = rows.slice();
  var step = TF_MS[tf];
  if (!out.length || !step || !isNum(now)) return out;
  var last = barMs(out[out.length - 1]);
  if (last != null && now < last + step) out.pop();
  return out;
}

/* Drop unusable bars, order by time, and keep one bar per timestamp.
   An out-of-order tape would run the EMA backwards. */
function normalizeRows(rows){
  var tmp = [];
  var i, ms;
  for (i = 0; i < rows.length; i++){
    if (!pathOk(rows[i])) continue;
    ms = barMs(rows[i]);
    if (ms == null) continue;
    tmp.push(rows[i]);
  }
  tmp.sort(function(a, b){ return barMs(a) - barMs(b); });
  var out = [];
  for (i = 0; i < tmp.length; i++){
    if (!out.length || barMs(out[out.length - 1]) !== barMs(tmp[i])) out.push(tmp[i]);
    else out[out.length - 1] = tmp[i];
  }
  return out;
}

function hitOf(row, sig){
  if (!pathOk(row)) return null;
  var lowC = centsOf(row.l);
  var highC = centsOf(row.h);
  var stopC = centsOf(sig.stop);
  var tpC = centsOf(sig.tp);
  if (!isNum(lowC) || !isNum(highC) || !isNum(stopC) || !isNum(tpC)) return null;
  var stopHit, tpHit;
  if (sig.dir === 1){
    stopHit = lowC <= stopC;
    tpHit = highC >= tpC;
  } else {
    stopHit = highC >= stopC;
    tpHit = lowC <= tpC;
  }
  if (stopHit && tpHit) return 'both';
  if (stopHit) return 'stopped';
  if (tpHit) return 'target';
  return null;
}

function hgSonaEval(rows, nowMs, opts){
  opts = opts || {};
  var tf = TF_OK[opts.tf] ? opts.tf : '15m';
  var sessOnly = !!opts.sessOnly;
  var step = TF_MS[tf];
  var blank = {
    ok: false, reason: 'tape unread', tf: tf, sessOnly: sessOnly,
    bars: 0, signals: [], live: null, last: null, recent: [], diag: null
  };
  if (!rows || !rows.length) return blank;
  var droppedForming = closedRows(rows, tf, nowMs);
  if (!droppedForming.length){
    blank.reason = 'no closed bar';
    return blank;
  }
  var closed = normalizeRows(droppedForming);
  if (!closed.length){
    blank.reason = 'path unread';
    blank.bars = droppedForming.length;
    return blank;
  }
  if (closed.length < SPEC.slowLen){
    blank.reason = 'tape short';
    blank.bars = closed.length;
    return blank;
  }
  var series = hgSonaSeries(closed);
  var signals = [];
  var decisions = new Array(closed.length);
  var open = null;
  var i;
  for (i = 0; i < closed.length; i++){
    var r = closed[i];
    var ms = barMs(r);
    if (open != null){
      var held = hitOf(r, signals[open]);
      if (held){
        signals[open].state = held;
        signals[open].resolveMs = ms;
        open = null;
      }
    }
    var emaF = series.emaFast[i];
    var emaS = series.emaSlow[i];
    var atr = series.atr[i];
    var vwap = series.vwap[i];
    var pull = 0;
    if (isNum(emaF) && isNum(emaS)){
      if (emaF > emaS && r.l <= emaF && r.c > emaF && r.c > r.o) pull = 1;
      else if (emaF < emaS && r.h >= emaF && r.c < emaF && r.c < r.o) pull = -1;
    }
    var vw = 0;
    var vwGap = false;
    var prevI = i - SPEC.vwLook;
    var prevVw = prevI >= 0 ? series.vwap[prevI] : NaN;
    var prevMs = prevI >= 0 ? barMs(closed[prevI]) : null;
    var vwSpan = isSpan(prevMs, ms, SPEC.vwLook, step);
    var vwSame = prevMs != null && utcDay(prevMs) === utcDay(ms);
    if (prevI >= 0 && isNum(prevVw) && isNum(vwap)){
      var up = r.c > vwap && vwap > prevVw && r.l <= vwap && r.c > r.o;
      var dn = r.c < vwap && vwap < prevVw && r.h >= vwap && r.c < r.o;
      if (up || dn){
        if (vwSpan && vwSame) vw = up ? 1 : -1;
        else vwGap = true;
      }
    }
    var agreed = (pull !== 0 && pull === vw) ? pull : 0;
    /* hg-v1476: the VOLUME gate — the signal bar's volume above its 20-bar
       mean. Enabled by the tab (opts.volGate); FAIL-OPEN when volume is
       unreadable on either side (a deaf feed is not a light tape). */
    var volOk = true;
    if (opts.volGate && agreed !== 0){
      var vma = series.volMa ? series.volMa[i] : NaN;
      var vb = r.v;
      if (isNum(vma) && vma > 0 && isNum(vb)) volOk = vb > vma;
    }
    var body = (r.c - r.o) * agreed;
    var bodyOk = agreed !== 0 && (SPEC.bodyMin <= 0 || (isNum(atr) && body >= SPEC.bodyMin * atr));
    var slowI = i - SPEC.slopeLen;
    var slowPrev = slowI >= 0 ? series.emaSlow[slowI] : NaN;
    var slowMs = slowI >= 0 ? barMs(closed[slowI]) : null;
    var slopeSpan = isSpan(slowMs, ms, SPEC.slopeLen, step);
    var slopeOk = agreed !== 0 && slopeSpan && isNum(slowPrev) && isNum(emaS) && (emaS - slowPrev) * agreed > 0;
    var slopeGap = agreed !== 0 && !slopeSpan;
    var dir = (bodyOk && slopeOk && volOk) ? agreed : 0;
    var hm = utcHm(ms);
    var inSess = hm >= SPEC.sessStart && hm < SPEC.sessEnd;
    /* hg-v1478: FRIDAY STAND-DOWN — unconditional, like the risk band, not
       tied to the session checkbox. Fail-open: a bar whose time does not
       read is not called a Friday. The hour is still printed, not filtered. */
    var friday = ms != null && new Date(ms).getUTCDay() === 5;
    var sessionOk = (!sessOnly || inSess) && !friday;
    var geometry = null;
    var block = null;
    if (agreed !== 0 && !volOk) block = 'volume light';
    else if (dir !== 0 && sessionOk && isNum(atr) && atr > 0){
      if (open != null) block = 'position open';
      else {
        geometry = planOf(r, dir, atr);
        if (geometry.block){
          block = geometry.block;
          geometry = null;
        }
      }
    }
    var d = {
      ms: ms, close: r.c, pull: pull, vw: vw, vwGap: vwGap, slopeGap: slopeGap,
      bodyOk: bodyOk, slopeOk: slopeOk, inSess: inSess, friday: friday, block: block,
      emaFast: emaF, emaSlow: emaS, atr: atr, vwap: vwap, take: false
    };
    if (geometry){
      d.take = true;
      signals.push({
        i: i, dir: dir, side: dir === 1 ? 'LONG' : 'SHORT',
        entry: geometry.entry, stop: geometry.stop, tp: geometry.tp,
        atr: atr, risk: geometry.risk, realizedR: geometry.realizedR,
        breakeven: geometry.breakeven, costR: geometry.costR,
        hour: new Date(ms).getUTCHours(),
        ms: ms, emaFast: emaF, emaSlow: emaS, vwap: vwap,
        state: 'live', resolveMs: null
      });
      open = signals.length - 1;
    }
    decisions[i] = d;
  }
  var last = signals.length ? signals[signals.length - 1] : null;
  var live = (last && last.state === 'live') ? last : null;
  var recent = signals.slice(-8).reverse();
  var tail = decisions[closed.length - 1];
  var reason = live ? 'live' : (last ? last.state : failReason(tail, sessOnly));
  return {
    ok: true, reason: reason, tf: tf, sessOnly: sessOnly,
    bars: closed.length, signals: signals, live: live, last: last, recent: recent,
    diag: {
      ms: tail.ms, close: tail.close, pull: tail.pull, vw: tail.vw,
      vwGap: tail.vwGap, slopeGap: tail.slopeGap,
      bodyOk: tail.bodyOk, slopeOk: tail.slopeOk, inSess: tail.inSess,
      friday: tail.friday,
      emaFast: tail.emaFast, emaSlow: tail.emaSlow, atr: tail.atr, vwap: tail.vwap,
      block: tail.block
    }
  };
}

function failReason(d, sessOnly){
  if (!d || !isNum(d.emaFast) || !isNum(d.emaSlow) || !isNum(d.atr)) return 'ema unread';
  if (d.pull === 0 && d.vw === 0 && !d.vwGap) return 'no print';
  if (d.pull === 0) return 'no ema pull';
  if (d.vw === 0 && d.vwGap) return 'vwap gap';
  if (d.vw === 0) return 'no vwap reclaim';
  if (d.pull !== d.vw) return 'prints disagree';
  if (!d.bodyOk) return 'body small';
  if (d.slopeGap) return 'ema gap';
  if (!d.slopeOk) return 'slope flat';
  if (d.friday) return 'friday stood down';
  if (sessOnly && !d.inSess) return 'outside session';
  if (d.block === 'position open') return 'position open';
  if (d.block === 'volume light') return 'volume light';
  if (d.block === 'stop under floor') return 'stop under floor';
  if (d.block === 'stop wide') return 'stop wide';
  return 'target unread';
}

function stateWord(st){
  if (st === 'live') return 'LIVE';
  if (st === 'stopped') return 'STOPPED';
  if (st === 'target') return 'TARGET';
  if (st === 'both') return 'BOTH IN BAR';
  return '—';
}

function rWord(s){
  if (!isNum(s.realizedR)) return 'target unread';
  var line = 'booked ' + fmtR(s.realizedR) + 'R';
  if (isNum(s.breakeven)) line += ' · breakeven ' + (Math.round(s.breakeven * 1000) / 10).toFixed(1) + '% before cost';
  if (isNum(s.costR)) line += ' · XM 0.02% round trip is ' + fmtR(s.costR) + 'R of this risk';
  return line;
}

function levelsHtml(s){
  var cls = s.dir === 1 ? 'pos' : 'neg';
  return '<div class="' + cls + '" style="font-size:13px;letter-spacing:.08em">' + esc(s.side) + ' · ' + esc(stateWord(s.state)) + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0">'
    + '<div style="border:1px solid var(--line);border-radius:6px;padding:8px 10px"><div class="note">ENTRY</div><div style="font-size:22px;font-weight:700">' + fmt(s.entry) + '</div></div>'
    + '<div style="border:1px solid var(--line);border-radius:6px;padding:8px 10px"><div class="note">STOP LOSS</div><div class="neg" style="font-size:22px">' + fmt(s.stop) + '</div></div>'
    + '<div style="border:1px solid var(--line);border-radius:6px;padding:8px 10px"><div class="note">TAKE PROFIT</div><div class="pos" style="font-size:22px">' + fmt(s.tp) + '</div></div>'
    + '</div>'
    + '<div class="note">Signal close on the 0.01 tick ' + fmt(s.entry) + ' · ' + esc(utcLabel(s.ms))
    + ' · hour ' + (isNum(s.hour) ? (s.hour < 10 ? '0' : '') + s.hour : '—') + ' UTC, recorded not filtered'
    + ' · ATR ' + fmt(s.atr) + ' · risk ' + fmt(s.risk) + ' · ' + esc(rWord(s))
    + ' · EMA 24 ' + fmt(s.emaFast) + ' · EMA 120 ' + fmt(s.emaSlow) + ' · VWAP ' + fmt(s.vwap) + '</div>';
}

function whyLine(read){
  if (!read.diag) return 'No closed gold bar.';
  if (read.reason === 'tape short') return 'Need ' + SPEC.slowLen + ' closed bars for EMA 120. This tape has ' + read.bars + '.';
  if (read.reason === 'path unread') return 'A bar on this tape has no usable open, high, low or close. No setup.';
  if (read.reason === 'ema unread') return 'EMA or ATR is not ready on the last closed bar. No setup.';
  if (read.reason === 'no print') return 'Last closed bar printed neither an EMA pullback nor a VWAP reclaim.';
  if (read.reason === 'no ema pull') return 'VWAP reclaim printed. The EMA 24 pullback did not. Both are required on the same bar.';
  if (read.reason === 'no vwap reclaim') return 'EMA pullback printed. The UTC VWAP reclaim did not. Both are required on the same bar.';
  if (read.reason === 'vwap gap') return 'Price reclaimed VWAP, but the six-bar slope is not inside this UTC day. A day break or a missing bar is not a slope.';
  if (read.reason === 'prints disagree') return 'EMA pullback and VWAP reclaim printed on opposite sides. No setup.';
  if (read.reason === 'body small') return 'Both prints agreed, and the body was under 0.15×ATR. No setup.';
  if (read.reason === 'ema gap') return 'Both prints agreed, but EMA 120 does not have four contiguous bars to measure a slope. No setup.';
  if (read.reason === 'slope flat') return 'Both prints agreed, and EMA 120 was not sloping with the trade over 4 bars. No setup.';
  if (read.reason === 'friday stood down') return 'Both prints agreed, and it is Friday UTC. Friday is the measured worst day in both studied years (16.7% win, net -10.5R), so the desk stands down. No setup.';
  if (read.reason === 'outside session') return 'The print is outside ' + sessSpan() + ', and that filter is on. No setup.';
  if (read.reason === 'position open') return 'Both prints agreed, and a plan is already open. It runs to its stop or its target. No second setup.';
  if (read.reason === 'volume light') return 'Both prints agreed, and the bar volume was not above its 20-bar average. No setup.';
  if (read.reason === 'stop under floor') return 'The wick stop is under ' + SPEC.stopAtrMin + '×ATR or under 4× the 0.02% round trip. That risk is the spread. No setup.';
  if (read.reason === 'stop wide') return 'The wick stop is wider than ' + SPEC.stopAtrMax + '×ATR. The pullback is not the risk. No setup.';
  if (read.reason === 'target unread') return 'The stop or the 1.5R target does not land on a 0.01 tick of risk. No setup.';
  if (read.live) return 'Both prints agreed. The stop is one tick beyond the pullback wick. The target is 1.5R of that risk.';
  if (read.last && read.last.state === 'stopped') return 'No live setup. The last one was stopped.';
  if (read.last && read.last.state === 'target') return 'No live setup. The last one reached its target.';
  if (read.last && read.last.state === 'both') return 'No live setup. The last one traded both the stop and the target on one bar. This tape has no lower timeframe, so that bar is not called a win.';
  return 'No setup on the last closed bar.';
}

function recentHtml(recent){
  if (!recent || !recent.length) return '';
  var rows = '';
  var i, s, cls;
  for (i = 0; i < recent.length; i++){
    s = recent[i];
    cls = s.dir === 1 ? 'pos' : 'neg';
    rows += '<tr><td>' + esc(utcLabel(s.ms)) + '</td><td>' + (isNum(s.hour) ? (s.hour < 10 ? '0' : '') + s.hour : '—') + '</td><td class="' + cls + '">' + esc(s.side) + '</td><td>'
      + fmt(s.entry) + '</td><td>' + fmt(s.stop) + '</td><td>' + fmt(s.tp) + '</td><td>' + esc(fmtR(s.realizedR)) + 'R</td><td>' + esc(stateWord(s.state)) + '</td></tr>';
  }
  return '<div class="note" style="margin-top:12px">RECENT SETUPS — newest first. One plan runs until the stop or the target. The hour is recorded and is not a filter.</div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">'
    + '<thead><tr class="note"><th align="left">TIME</th><th align="left">HOUR</th><th align="left">SIDE</th><th align="left">ENTRY</th><th align="left">STOP</th><th align="left">TAKE PROFIT</th><th align="left">R</th><th align="left">STATE</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table></div>';
}

function diagHtml(read){
  var d = read.diag;
  if (!d) return '';
  function mark(on, applicable){ return applicable ? (on ? 'yes' : 'no') : '—'; }
  var agreed = d.pull !== 0 && d.pull === d.vw;
  var pull = d.pull === 1 ? 'long' : (d.pull === -1 ? 'short' : 'no');
  var vw = d.vw === 1 ? 'long' : (d.vw === -1 ? 'short' : (d.vwGap ? 'gap' : 'no'));
  return '<div class="note" style="margin-top:8px">Last closed bar ' + esc(utcLabel(d.ms))
    + ' · close ' + fmt(d.close)
    + ' · EMA pull ' + pull
    + ' · VWAP reclaim ' + vw
    + ' · body ' + mark(d.bodyOk, agreed || d.bodyOk)
    + ' · EMA 120 slope ' + (d.slopeGap ? 'gap' : mark(d.slopeOk, agreed || d.slopeOk))
    + (d.block === 'volume light' ? ' · volume below its 20-bar average' : '')
    + (read.sessOnly ? ' · in ' + sessSpan() + ' ' + mark(d.inSess, true) : '')
    + '</div>';
}

function sonaHtml(read, meta){
  meta = meta || {};
  var head = '<div class="card">';
  var feed = meta.feed ? (' · ' + esc(meta.feed)) : '';
  var sess = read.sessOnly ? (' · ' + sessSpan() + ' only') : ' · session filter off';
  var rule = '<div class="note" style="margin-top:8px">HG Gold 81 prints · ' + esc(read.tf || '15m') + feed + sess
    + ' · ' + (read.bars || 0) + ' closed bars. Entry is the signal close on the 0.01 tick. Stop is one tick beyond the pullback wick. '
    + 'Refused under ' + SPEC.stopAtrMin + '×ATR, under 4× the 0.02% round trip, or wider than ' + SPEC.stopAtrMax + '×ATR. '
    + 'Volume must be above its 20-bar average. Target is 1.5R of that risk. '
    + 'Friday UTC stands down (the measured worst day, both studied years). '
    + 'One plan, held to the stop or the target. 5m is not a book.</div>';
  var tape = meta.tape || '';
  if (!read || !read.ok){
    var line = read && read.reason === 'no closed bar' ? 'The last bar is still forming. No setup.'
      : read && read.reason === 'tape short' ? ('Need ' + SPEC.slowLen + ' closed bars for EMA 120. Have ' + (read.bars || 0) + '.')
      : read && read.reason === 'path unread' ? 'The tape has no usable bar. No entry, stop, or target.'
      : 'Gold tape unread. No entry, stop, or target.';
    return head + '<div><b>STAND ASIDE</b></div><div>' + line + '</div>' + rule + tape + '</div>';
  }
  var featured = read.live || read.last;
  var banner = read.live ? '<div><b>SETUP</b></div>' : '<div><b>STAND ASIDE</b></div><div>' + whyLine(read) + '</div>';
  var card = featured ? levelsHtml(featured) : '';
  if (!read.live && featured){
    card = '<div class="note" style="margin-top:8px">Last setup — not an open order.</div>' + card;
  }
  return head + banner + card + diagHtml(read) + recentHtml(read.recent) + rule + tape + '</div>';
}

var __el = null;
var __seq = 0;

function paint(el, html, stat){
  if (!el) return;
  var box = el.querySelector('#sonaOut');
  var st = el.querySelector('#sonaStat');
  if (box) box.innerHTML = html;
  if (st) st.textContent = stat || '';
}

function readTf(el){
  var s = el && el.querySelector('#sonaTf');
  var v = s && s.value;
  return TF_OK[v] ? v : '15m';
}

function readSess(el){
  var s = el && el.querySelector('#sonaSess');
  /* hg-v1476: the studied window is the DEFAULT — the checkbox opts OUT */
  return s ? !!s.checked : true;
}

async function loadTape(tf){
  var fn = (typeof W.getGoldCandles === 'function') ? W.getGoldCandles : null;
  if (!fn) return { rows: null, feed: null, why: 'gold candle layer not loaded' };
  var pack;
  try { pack = await fn(tf, SPEC.count); }
  catch (e) { return { rows: null, feed: null, why: 'tape unread' }; }
  var rows = null, feed = null;
  if (pack && Array.isArray(pack.rows)){
    rows = pack.rows;
    feed = (typeof pack.source === 'string' && pack.source) ? pack.source : null;
  } else if (Array.isArray(pack)){
    rows = pack;
  }
  if (!rows || !rows.length) return { rows: null, feed: feed, why: 'tape unread' };
  return { rows: rows, feed: feed, why: null };
}

async function run(el){
  var seq = ++__seq;
  var tf = readTf(el);
  var sessOnly = readSess(el);
  paint(el, '', 'reading ' + tf + ' gold…');
  var tape;
  try { tape = await loadTape(tf); }
  catch (e) { tape = { rows: null, feed: null, why: 'tape unread' }; }
  if (seq !== __seq) return 'stale';
  var read;
  if (!tape || !tape.rows){
    read = { ok: false, reason: 'tape unread', tf: tf, sessOnly: sessOnly, bars: 0, signals: [], live: null, last: null, recent: [], diag: null };
  } else {
    try { read = hgSonaEval(tape.rows, Date.now(), { tf: tf, sessOnly: sessOnly, volGate: true }); }
    catch (e2) {
      read = { ok: false, reason: 'tape unread', tf: tf, sessOnly: sessOnly, bars: 0, signals: [], live: null, last: null, recent: [], diag: null };
    }
  }
  var tapeNote = '';
  try {
    if (tape && tape.rows && typeof W.hgGoldTapeNotes === 'function') tapeNote = W.hgGoldTapeNotes(tape.rows, tf) || '';
  } catch (eN) { tapeNote = ''; }
  var html = sonaHtml(read, { feed: tape && tape.feed, tape: tapeNote });
  var stat = read.live
    ? (read.live.side + ' live · entry ' + fmt(read.live.entry) + ' · stop ' + fmt(read.live.stop) + ' · target ' + fmt(read.live.tp) + ' · ' + rWord(read.live))
    : ('stand aside — ' + (read.reason || 'no setup'));
  paint(el, html, stat);
  return read.reason || 'done';
}

function mount(el){
  if (!el) return;
  __el = el;
  el.innerHTML = '<div class="panel"><h2>SONA <span>HG Gold 81 · wick stop · 1.5R · one plan</span></h2>'
    + '<div class="note">A setup prints only when an EMA 24 pullback and a UTC VWAP reclaim agree on the same closed bar, and that bar\'s volume is above its 20-bar average. The stop is one tick beyond that wick, and only when the risk is between ' + SPEC.stopAtrMin + '×ATR and ' + SPEC.stopAtrMax + '×ATR and at least 4× the 0.02% round trip. The target is 1.5R. A live plan is held. Friday UTC stands down — the measured worst day in both studied years. The hour is shown and does not filter unless the studied window is checked.</div>'
    + '<div class="row" style="margin-top:8px;gap:8px;align-items:center">'
    + '<select id="sonaTf" aria-label="SONA timeframe">'
    + '<option value="15m" selected>15m</option><option value="1h">1h</option><option value="4h">4h</option>'
    + '</select>'
    + '<label class="note"><input id="sonaSess" type="checkbox" checked> 07:00–13:00 UTC only (the studied window; uncheck for all hours)</label>'
    + '<button class="btn" id="sonaScan" type="button">SCAN SONA</button>'
    + '<span class="note" id="sonaStat">idle</span></div></div>'
    + '<div id="sonaOut"></div>';
  var btn = el.querySelector('#sonaScan');
  if (btn) btn.addEventListener('click', function(){
    var p = run(el);
    if (p && typeof p.then === 'function') p.catch(function(){});
    return p;
  });
}

function refresh(){
  if (!__el) return 'skipped: not mounted';
  return run(__el);
}

W.HG_SONA_SPEC = SPEC;
W.hgSonaTick = tickPx;
W.hgSonaSeries = hgSonaSeries;
W.hgSonaEval = hgSonaEval;
W.hgSonaHtml = sonaHtml;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'sona', label: 'SONA', mount: mount, refresh: refresh });
})();
