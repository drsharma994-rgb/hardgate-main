/* HARDGATE — sona.js
   SONA. One Pine strategy, nothing added: "HG Gold 81 every bar".

   Long or short only when both prints land on the same closed bar:
   an EMA 24 pullback inside the EMA 120 stack, and a UTC-session VWAP
   reclaim whose VWAP is sloping the same way. The slope is six bars of
   this UTC day with no missing bar — yesterday's VWAP and a hole are
   not a slope. The candle body must be at least 0.15×ATR(14), and
   EMA 120 must slope with the trade over four contiguous bars.
   Optional session gate is 07:00–17:00 UTC, off by default.

   The published prices are the trade. The close, the 2.5×ATR risk and
   the 0.35R target are rounded to the 0.01 gold tick in integer cents,
   and the stop and the target are measured from that ticked entry.
   Booked R is |target−entry| / |entry−stop| of those three prices.
   A target that rounds to zero cents is not a setup. A new signal
   replaces the open one only when the replacement bar did not already
   trade the stop or the target. Both in one bar stays unresolved:
   this tape has no lower timeframe, so the script's bar magnifier is
   not called. This desk writes no forward row and no ticket. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

var SPEC = {
  fastLen: 24,
  slowLen: 120,
  vwLook: 6,
  cool: 1,
  atrLen: 14,
  atrMult: 2.5,
  rewardR: 0.35,
  bodyMin: 0.15,
  slopeLen: 4,
  mintick: 0.01,
  sessStart: 7,
  sessEnd: 17,
  /* 500 is the script's max_bars_back. The extra bars are warmup so
     EMA 120 at the right edge is not still the SMA seed of a short window. */
  count: 1500
};

var TF_MS = { '5m': 5 * 60 * 1000, '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000 };
var TF_OK = { '5m': 1, '15m': 1, '1h': 1, '4h': 1 };

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
    vv: vw.vv
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
  var lastTaken = null;
  var signals = [];
  var decisions = new Array(closed.length);
  var i;
  for (i = 0; i < closed.length; i++){
    var r = closed[i];
    var ms = barMs(r);
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
    var body = (r.c - r.o) * agreed;
    var bodyOk = agreed !== 0 && (SPEC.bodyMin <= 0 || (isNum(atr) && body >= SPEC.bodyMin * atr));
    var slowI = i - SPEC.slopeLen;
    var slowPrev = slowI >= 0 ? series.emaSlow[slowI] : NaN;
    var slowMs = slowI >= 0 ? barMs(closed[slowI]) : null;
    var slopeSpan = isSpan(slowMs, ms, SPEC.slopeLen, step);
    var slopeOk = agreed !== 0 && slopeSpan && isNum(slowPrev) && isNum(emaS) && (emaS - slowPrev) * agreed > 0;
    var slopeGap = agreed !== 0 && !slopeSpan;
    var dir = (bodyOk && slopeOk) ? agreed : 0;
    var hm = utcHm(ms);
    var inSess = hm >= SPEC.sessStart && hm < SPEC.sessEnd;
    var sessionOk = !sessOnly || inSess;
    var cooled = lastTaken == null || (i - lastTaken) >= SPEC.cool;
    var geometry = null;
    if (dir !== 0 && sessionOk && cooled && isNum(atr) && atr > 0){
      var entryC = centsOf(r.c);
      var riskC = centsOf(SPEC.atrMult * atr);
      var rewardC = (isNum(riskC) && riskC >= 1) ? divRound(riskC * 35, 100) : 0;
      if (isNum(entryC) && riskC >= 1 && rewardC >= 1){
        var stopC = entryC - dir * riskC;
        var tpC = entryC + dir * rewardC;
        geometry = {
          entry: pxFromCents(entryC),
          stop: pxFromCents(stopC),
          tp: pxFromCents(tpC),
          risk: pxFromCents(riskC),
          realizedR: rewardC / riskC
        };
      }
    }
    var d = {
      ms: ms, close: r.c, pull: pull, vw: vw, vwGap: vwGap, slopeGap: slopeGap,
      bodyOk: bodyOk, slopeOk: slopeOk, inSess: inSess, cooled: cooled,
      emaFast: emaF, emaSlow: emaS, atr: atr, vwap: vwap, take: false
    };
    if (geometry){
      d.take = true;
      signals.push({
        i: i, dir: dir, side: dir === 1 ? 'LONG' : 'SHORT',
        entry: geometry.entry, stop: geometry.stop, tp: geometry.tp,
        atr: atr, risk: geometry.risk, realizedR: geometry.realizedR,
        ms: ms, emaFast: emaF, emaSlow: emaS, vwap: vwap,
        state: 'live', resolveMs: null
      });
      lastTaken = i;
    }
    decisions[i] = d;
  }
  for (i = 0; i < signals.length; i++){
    var sig = signals[i];
    var nextI = (i + 1 < signals.length) ? signals[i + 1].i : null;
    var lastJ = nextI == null ? closed.length - 1 : nextI;
    var state = 'live';
    var at = null;
    var j;
    for (j = sig.i + 1; j <= lastJ; j++){
      var hit = hitOf(closed[j], sig);
      if (hit){ state = hit; at = j; break; }
    }
    if (state === 'live' && nextI != null) state = 'replaced';
    sig.state = state;
    sig.resolveMs = at == null ? null : barMs(closed[at]);
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
      emaFast: tail.emaFast, emaSlow: tail.emaSlow, atr: tail.atr, vwap: tail.vwap
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
  if (sessOnly && !d.inSess) return 'outside session';
  if (!d.cooled) return 'cooldown';
  return 'target unread';
}

function stateWord(st){
  if (st === 'live') return 'LIVE';
  if (st === 'stopped') return 'STOPPED';
  if (st === 'target') return 'TARGET';
  if (st === 'both') return 'BOTH IN BAR';
  if (st === 'replaced') return 'REPLACED';
  return '—';
}

function rWord(s){
  if (!isNum(s.realizedR)) return 'target unread';
  var booked = fmtR(s.realizedR);
  if (booked === '0.35') return 'booked 0.35R';
  return 'booked ' + booked + 'R after the 0.35R tick round';
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
  if (read.reason === 'outside session') return 'The print is outside 07:00–17:00 UTC, and that filter is on. No setup.';
  if (read.reason === 'cooldown') return 'Both prints agreed inside the cooldown. No second setup.';
  if (read.reason === 'target unread') return 'The 0.35R target rounds to nothing on the 0.01 tick. No setup.';
  if (read.live) return 'Both prints agreed on the last open setup. Entry, stop and target are on the 0.01 tick, and the booked R is the ratio of those prices.';
  if (read.last && read.last.state === 'stopped') return 'No live setup. The last one was stopped.';
  if (read.last && read.last.state === 'target') return 'No live setup. The last one reached its target.';
  if (read.last && read.last.state === 'both') return 'No live setup. The last one traded both the stop and the target on one bar. This tape has no lower timeframe, so that bar is not called a win.';
  if (read.last && read.last.state === 'replaced') return 'No live setup. A later bar replaced the previous one without trading its stop or target, and that later one has already resolved.';
  return 'No setup on the last closed bar.';
}

function recentHtml(recent){
  if (!recent || !recent.length) return '';
  var rows = '';
  var i, s, cls;
  for (i = 0; i < recent.length; i++){
    s = recent[i];
    cls = s.dir === 1 ? 'pos' : 'neg';
    rows += '<tr><td>' + esc(utcLabel(s.ms)) + '</td><td class="' + cls + '">' + esc(s.side) + '</td><td>'
      + fmt(s.entry) + '</td><td>' + fmt(s.stop) + '</td><td>' + fmt(s.tp) + '</td><td>' + esc(fmtR(s.realizedR)) + 'R</td><td>' + esc(stateWord(s.state)) + '</td></tr>';
  }
  return '<div class="note" style="margin-top:12px">RECENT SETUPS — newest first. A later signal replaces the one before it only if that bar did not already trade the stop or the target.</div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">'
    + '<thead><tr class="note"><th align="left">TIME</th><th align="left">SIDE</th><th align="left">ENTRY</th><th align="left">STOP</th><th align="left">TAKE PROFIT</th><th align="left">R</th><th align="left">STATE</th></tr></thead>'
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
    + (read.sessOnly ? ' · in 07:00–17:00 UTC ' + mark(d.inSess, true) : '')
    + '</div>';
}

function sonaHtml(read, meta){
  meta = meta || {};
  var head = '<div class="card">';
  var feed = meta.feed ? (' · ' + esc(meta.feed)) : '';
  var sess = read.sessOnly ? ' · 07:00–17:00 UTC only' : ' · session filter off';
  var rule = '<div class="note" style="margin-top:8px">HG Gold 81 every bar · ' + esc(read.tf || '15m') + feed + sess
    + ' · ' + (read.bars || 0) + ' closed bars. Entry is the signal close on the 0.01 tick. Stop is 2.5×ATR(14) from that entry. '
    + 'Target is 0.35R of that stop, on the same tick, and the booked R is the ratio of the three prices. '
    + 'EMA 24 pullback and UTC VWAP reclaim must agree inside one session, body at least 0.15×ATR, EMA 120 sloping with the trade.</div>';
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
  return !!(s && s.checked);
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
    try { read = hgSonaEval(tape.rows, Date.now(), { tf: tf, sessOnly: sessOnly }); }
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
  el.innerHTML = '<div class="panel"><h2>SONA <span>HG Gold 81 · EMA 24/120 · UTC VWAP · every bar</span></h2>'
    + '<div class="note">A setup prints only when an EMA 24 pullback and a UTC VWAP reclaim agree on the same closed bar, the body is at least 0.15×ATR, and EMA 120 slopes with the trade over four contiguous bars of the same session. Entry, stop and take profit are on the 0.01 tick. The booked R is the ratio of those three prices.</div>'
    + '<div class="row" style="margin-top:8px;gap:8px;align-items:center">'
    + '<select id="sonaTf" aria-label="SONA timeframe">'
    + '<option value="5m">5m</option><option value="15m" selected>15m</option><option value="1h">1h</option><option value="4h">4h</option>'
    + '</select>'
    + '<label class="note"><input id="sonaSess" type="checkbox"> 07:00–17:00 UTC only</label>'
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
