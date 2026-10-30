/* HARDGATE — sona.js
   SONA. One Pine strategy, nothing added: "HG Gold 81 every bar".

   Long or short only when both prints land on the same closed bar:
   an EMA 24 pullback inside the EMA 120 stack, and a UTC-session VWAP
   reclaim whose VWAP is sloping the same way (6 bars). The candle body
   must be at least 0.15×ATR(14), and EMA 120 must slope with the trade
   over 4 bars. Optional session gate is 07:00–17:00 UTC, off by default.
   Entry is that bar's close. Stop is 2.5×ATR from the close, target is
   0.35R, both rounded to the 0.01 gold tick the way the script's tick()
   rounds stop and target. A new signal replaces the open one. The stop
   and target are not active on the signal bar. This desk writes no
   forward row and no ticket — the card is the setup. */
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
  count: 500
};

var TF_MS = { '5m': 5 * 60 * 1000, '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000 };
var TF_OK = { '5m': 1, '15m': 1, '1h': 1, '4h': 1 };

function isNum(x){ return typeof x === 'number' && isFinite(x); }

function tickPx(x){
  if (!isNum(x)) return NaN;
  return Math.round(x / SPEC.mintick) * SPEC.mintick;
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
  return isNum(n) ? n.toFixed(2) : '—';
}

function esc(s){
  return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

function pathOk(row){
  if (!row) return false;
  if (!isNum(row.o) || !isNum(row.h) || !isNum(row.l) || !isNum(row.c)) return false;
  if (row.h < row.l) return false;
  if (row.h < row.o || row.h < row.c || row.l > row.o || row.l > row.c) return false;
  if (!(row.c > 0) || !(row.o > 0)) return false;
  return true;
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

function vwapSeries(rows){
  var n = rows.length;
  var vwap = new Array(n);
  var pvA = new Array(n);
  var vvA = new Array(n);
  var pv = 0, vv = 0, day = null;
  var i, ms, today, qty, typical, r;
  for (i = 0; i < n; i++){
    r = rows[i];
    ms = barMs(r);
    if (ms == null || !pathOk(r)){
      vwap[i] = NaN; pvA[i] = NaN; vvA[i] = NaN;
      day = null; pv = 0; vv = 0;
      continue;
    }
    today = utcDay(ms);
    qty = (isNum(r.v) && r.v > 0) ? r.v : 1;
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

function hitOf(row, sig){
  if (!pathOk(row)) return null;
  var stopHit, tpHit;
  if (sig.dir === 1){
    stopHit = row.l <= sig.stop;
    tpHit = row.h >= sig.tp;
  } else {
    stopHit = row.h >= sig.stop;
    tpHit = row.l <= sig.tp;
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
  var blank = {
    ok: false, reason: 'tape unread', tf: tf, sessOnly: sessOnly,
    bars: 0, signals: [], live: null, last: null, recent: [], diag: null
  };
  if (!rows || !rows.length) return blank;
  var closed = closedRows(rows, tf, nowMs);
  if (!closed.length){
    blank.reason = 'no closed bar';
    return blank;
  }
  var i;
  for (i = 0; i < closed.length; i++){
    if (!pathOk(closed[i]) || barMs(closed[i]) == null){
      blank.reason = 'path unread';
      blank.bars = closed.length;
      return blank;
    }
  }
  if (closed.length < SPEC.slowLen){
    blank.reason = 'tape short';
    blank.bars = closed.length;
    return blank;
  }
  var series = hgSonaSeries(closed);
  var lastPull = null;
  var lastVwap = null;
  var signals = [];
  for (i = 0; i < closed.length; i++){
    var r = closed[i];
    var emaF = series.emaFast[i];
    var emaS = series.emaSlow[i];
    var atr = series.atr[i];
    var vwap = series.vwap[i];
    var pull = 0;
    var pullCool = lastPull == null || (i - lastPull) >= SPEC.cool;
    if (isNum(emaF) && isNum(emaS) && pullCool){
      if (emaF > emaS && r.l <= emaF && r.c > emaF && r.c > r.o) pull = 1;
      else if (emaF < emaS && r.h >= emaF && r.c < emaF && r.c < r.o) pull = -1;
      if (pull !== 0) lastPull = i;
    }
    var vw = 0;
    var vwapCool = lastVwap == null || (i - lastVwap) >= SPEC.cool;
    var prevVw = (i >= SPEC.vwLook) ? series.vwap[i - SPEC.vwLook] : NaN;
    if (i >= SPEC.vwLook && vwapCool && isNum(prevVw) && isNum(vwap)){
      if (r.c > vwap && vwap > prevVw && r.l <= vwap && r.c > r.o) vw = 1;
      else if (r.c < vwap && vwap < prevVw && r.h >= vwap && r.c < r.o) vw = -1;
      if (vw !== 0) lastVwap = i;
    }
    var dir = (pull !== 0 && pull === vw) ? pull : 0;
    var body = (r.c - r.o) * dir;
    var bodyOk = SPEC.bodyMin <= 0 || (isNum(atr) && body >= SPEC.bodyMin * atr);
    var slowPrev = series.emaSlow[i - SPEC.slopeLen];
    var slopeOk = isNum(slowPrev) && isNum(emaS) && (emaS - slowPrev) * dir > 0;
    if (!bodyOk || !slopeOk) dir = 0;
    var hm = utcHm(barMs(r));
    var inSess = hm >= SPEC.sessStart && hm < SPEC.sessEnd;
    var sessionOk = !sessOnly || inSess;
    if (dir !== 0 && sessionOk && isNum(atr) && atr > 0){
      var risk = tickPx(SPEC.atrMult * atr);
      var stop = tickPx(dir === 1 ? r.c - risk : r.c + risk);
      var tp = tickPx(dir === 1 ? r.c + SPEC.rewardR * risk : r.c - SPEC.rewardR * risk);
      if (isNum(stop) && isNum(tp) && ((dir === 1 && stop < r.c && tp > r.c) || (dir === -1 && stop > r.c && tp < r.c))){
        signals.push({
          i: i, dir: dir, side: dir === 1 ? 'LONG' : 'SHORT',
          entry: r.c, stop: stop, tp: tp, atr: atr, risk: risk,
          ms: barMs(r), emaFast: emaF, emaSlow: emaS, vwap: vwap,
          state: 'live', resolveMs: null
        });
      }
    }
  }
  for (i = 0; i < signals.length; i++){
    var sig = signals[i];
    var end = (i + 1 < signals.length) ? signals[i + 1].i : closed.length;
    var state = 'live';
    var at = null;
    var j;
    for (j = sig.i + 1; j < end; j++){
      var hit = hitOf(closed[j], sig);
      if (hit){ state = hit; at = j; break; }
    }
    if (state === 'live' && i < signals.length - 1) state = 'replaced';
    sig.state = state;
    sig.resolveMs = at == null ? null : barMs(closed[at]);
  }
  var last = signals.length ? signals[signals.length - 1] : null;
  var live = (last && last.state === 'live') ? last : null;
  var recent = signals.slice(-8).reverse();
  var d = closed.length - 1;
  var dPull = 0;
  var dVw = 0;
  var dEmaF = series.emaFast[d];
  var dEmaS = series.emaSlow[d];
  var dAtr = series.atr[d];
  var dVwap = series.vwap[d];
  var dr = closed[d];
  if (isNum(dEmaF) && isNum(dEmaS)){
    if (dEmaF > dEmaS && dr.l <= dEmaF && dr.c > dEmaF && dr.c > dr.o) dPull = 1;
    else if (dEmaF < dEmaS && dr.h >= dEmaF && dr.c < dEmaF && dr.c < dr.o) dPull = -1;
  }
  var dPrev = (d >= SPEC.vwLook) ? series.vwap[d - SPEC.vwLook] : NaN;
  if (d >= SPEC.vwLook && isNum(dPrev) && isNum(dVwap)){
    if (dr.c > dVwap && dVwap > dPrev && dr.l <= dVwap && dr.c > dr.o) dVw = 1;
    else if (dr.c < dVwap && dVwap < dPrev && dr.h >= dVwap && dr.c < dr.o) dVw = -1;
  }
  var agreed = (dPull !== 0 && dPull === dVw) ? dPull : 0;
  var dBody = (dr.c - dr.o) * (agreed || 0);
  var dBodyOk = !agreed || SPEC.bodyMin <= 0 || (isNum(dAtr) && dBody >= SPEC.bodyMin * dAtr);
  var dSlowPrev = series.emaSlow[d - SPEC.slopeLen];
  var dSlopeOk = !agreed || (isNum(dSlowPrev) && isNum(dEmaS) && (dEmaS - dSlowPrev) * agreed > 0);
  var dHm = utcHm(barMs(dr));
  var dIn = dHm >= SPEC.sessStart && dHm < SPEC.sessEnd;
  var reason = live ? 'live' : (last ? last.state : 'no setup');
  if (!live && !last){
    if (!isNum(dEmaF) || !isNum(dEmaS) || !isNum(dAtr)) reason = 'ema unread';
    else if (dPull === 0 && dVw === 0) reason = 'no print';
    else if (dPull === 0) reason = 'no ema pull';
    else if (dVw === 0) reason = 'no vwap reclaim';
    else if (dPull !== dVw) reason = 'prints disagree';
    else if (!dBodyOk) reason = 'body small';
    else if (!dSlopeOk) reason = 'slope flat';
    else if (sessOnly && !dIn) reason = 'outside session';
    else reason = 'no setup';
  } else if (!live && last && sessOnly && !dIn && last.state !== 'live'){
    /* keep the resolved state's reason */
  }
  return {
    ok: true, reason: reason, tf: tf, sessOnly: sessOnly,
    bars: closed.length, signals: signals, live: live, last: last, recent: recent,
    diag: {
      ms: barMs(dr), close: dr.c, pull: dPull, vw: dVw,
      bodyOk: !!dBodyOk, slopeOk: !!dSlopeOk, inSess: !!dIn,
      emaFast: dEmaF, emaSlow: dEmaS, atr: dAtr, vwap: dVwap
    }
  };
}

function sideWord(dir){ return dir === -1 ? 'SHORT' : 'LONG'; }

function stateWord(st){
  if (st === 'live') return 'LIVE';
  if (st === 'stopped') return 'STOPPED';
  if (st === 'target') return 'TARGET';
  if (st === 'both') return 'BOTH IN BAR';
  if (st === 'replaced') return 'REPLACED';
  return '—';
}

function levelsHtml(s){
  var cls = s.dir === 1 ? 'pos' : 'neg';
  return '<div class="' + cls + '" style="font-size:13px;letter-spacing:.08em">' + esc(s.side) + ' · ' + esc(stateWord(s.state)) + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0">'
    + '<div style="border:1px solid var(--line);border-radius:6px;padding:8px 10px"><div class="note">ENTRY</div><div style="font-size:22px;font-weight:700">' + fmt(s.entry) + '</div></div>'
    + '<div style="border:1px solid var(--line);border-radius:6px;padding:8px 10px"><div class="note">STOP LOSS</div><div class="neg" style="font-size:22px">' + fmt(s.stop) + '</div></div>'
    + '<div style="border:1px solid var(--line);border-radius:6px;padding:8px 10px"><div class="note">TAKE PROFIT</div><div class="pos" style="font-size:22px">' + fmt(s.tp) + '</div></div>'
    + '</div>'
    + '<div class="note">Signal close ' + fmt(s.entry) + ' · ' + esc(utcLabel(s.ms))
    + ' · ATR ' + fmt(s.atr) + ' · risk ' + fmt(s.risk) + ' · target 0.35R'
    + ' · EMA 24 ' + fmt(s.emaFast) + ' · EMA 120 ' + fmt(s.emaSlow) + ' · VWAP ' + fmt(s.vwap) + '</div>';
}

function whyLine(read){
  var d = read.diag;
  if (!d) return 'No closed gold bar.';
  if (read.reason === 'tape short') return 'Need ' + SPEC.slowLen + ' closed bars for EMA 120. This tape has ' + read.bars + '.';
  if (read.reason === 'path unread') return 'A bar on this tape has no usable open, high, low or close. No setup.';
  if (read.reason === 'ema unread') return 'EMA or ATR is not ready on the last closed bar. No setup.';
  if (read.reason === 'no print') return 'Last closed bar printed neither an EMA pullback nor a VWAP reclaim.';
  if (read.reason === 'no ema pull') return 'VWAP reclaim printed. The EMA 24 pullback did not. Both are required on the same bar.';
  if (read.reason === 'no vwap reclaim') return 'EMA pullback printed. The UTC VWAP reclaim did not. Both are required on the same bar.';
  if (read.reason === 'prints disagree') return 'EMA pullback and VWAP reclaim printed on opposite sides. No setup.';
  if (read.reason === 'body small') return 'Both prints agreed, and the body was under 0.15×ATR. No setup.';
  if (read.reason === 'slope flat') return 'Both prints agreed, and EMA 120 was not sloping with the trade over 4 bars. No setup.';
  if (read.reason === 'outside session') return 'The print is outside 07:00–17:00 UTC, and that filter is on. No setup.';
  if (read.live) return 'Both prints agreed on the last open setup. Entry is that bar close.';
  if (read.last && read.last.state === 'stopped') return 'No live setup. The last one was stopped.';
  if (read.last && read.last.state === 'target') return 'No live setup. The last one reached its target.';
  if (read.last && read.last.state === 'both') return 'No live setup. The last one traded both the stop and the target on one bar. This tape has no lower timeframe, so the script bar magnifier is not called.';
  if (read.last && read.last.state === 'replaced') return 'No live setup. A later bar replaced the previous one, and that later one has already resolved.';
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
      + fmt(s.entry) + '</td><td>' + fmt(s.stop) + '</td><td>' + fmt(s.tp) + '</td><td>' + esc(stateWord(s.state)) + '</td></tr>';
  }
  return '<div class="note" style="margin-top:12px">RECENT SETUPS — newest first. A later signal replaces the one before it.</div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">'
    + '<thead><tr class="note"><th align="left">TIME</th><th align="left">SIDE</th><th align="left">ENTRY</th><th align="left">STOP</th><th align="left">TAKE PROFIT</th><th align="left">STATE</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table></div>';
}

function diagHtml(read){
  var d = read.diag;
  if (!d) return '';
  function mark(on){ return on ? 'yes' : 'no'; }
  var pull = d.pull === 1 ? 'long' : (d.pull === -1 ? 'short' : 'no');
  var vw = d.vw === 1 ? 'long' : (d.vw === -1 ? 'short' : 'no');
  return '<div class="note" style="margin-top:8px">Last closed bar ' + esc(utcLabel(d.ms))
    + ' · close ' + fmt(d.close)
    + ' · EMA pull ' + pull
    + ' · VWAP reclaim ' + vw
    + ' · body ' + mark(d.bodyOk)
    + ' · EMA 120 slope ' + mark(d.slopeOk)
    + (read.sessOnly ? ' · in 07:00–17:00 UTC ' + mark(d.inSess) : '')
    + '</div>';
}

function sonaHtml(read, meta){
  meta = meta || {};
  var head = '<div class="card">';
  var feed = meta.feed ? (' · ' + esc(meta.feed)) : '';
  var sess = read.sessOnly ? ' · 07:00–17:00 UTC only' : ' · session filter off';
  var rule = '<div class="note" style="margin-top:8px">HG Gold 81 every bar · ' + esc(read.tf || '15m') + feed + sess
    + ' · ' + (read.bars || 0) + ' closed bars. Entry is the signal close. Stop 2.5×ATR(14). Target 0.35R. '
    + 'EMA 24 pullback and UTC VWAP reclaim must agree, body at least 0.15×ATR, EMA 120 sloping with the trade.</div>';
  var tape = meta.tape || '';
  if (!read || !read.ok){
    var line = read && read.reason === 'no closed bar' ? 'The last bar is still forming. No setup.'
      : read && read.reason === 'tape short' ? ('Need ' + SPEC.slowLen + ' closed bars for EMA 120. Have ' + (read.bars || 0) + '.')
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
  var stat = read.live ? (read.live.side + ' live · entry ' + fmt(read.live.entry) + ' · stop ' + fmt(read.live.stop) + ' · target ' + fmt(read.live.tp))
    : ('stand aside — ' + (read.reason || 'no setup'));
  paint(el, html, stat);
  return read.reason || 'done';
}

function mount(el){
  if (!el) return;
  __el = el;
  el.innerHTML = '<div class="panel"><h2>SONA <span>HG Gold 81 · EMA 24/120 · UTC VWAP · every bar</span></h2>'
    + '<div class="note">A setup prints only when an EMA 24 pullback and a UTC VWAP reclaim agree on the same closed bar, the body is at least 0.15×ATR, and EMA 120 slopes with the trade. Entry is that close. Stop is 2.5×ATR. Take profit is 0.35R.</div>'
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
W.hgSonaSeries = hgSonaSeries;
W.hgSonaEval = hgSonaEval;
W.hgSonaHtml = sonaHtml;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'sona', label: 'SONA', mount: mount, refresh: refresh });
})();
