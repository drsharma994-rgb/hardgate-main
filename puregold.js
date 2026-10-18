/* HARDGATE — puregold.js
   PURE GOLD. One Pine strategy, nothing added.

   Gold Session Trend (IST): EMA 21 / EMA 55, ATR 14.
   Session 17:30–21:30 Asia/Kolkata, start included, end excluded — the
   Pine session string "1730-2130". A bar is in the session by its OPEN.
   Long only on ta.crossover (fast was at or below slow, and is now above).
   Short only on ta.crossunder. A standing stack is not a cross.
   Stop and target are measured from the signal bar's close:
   long stop = close − 1.5×ATR, long target = close + 3×ATR, mirrored short.
   The market entry fills at the NEXT bar's open (process_orders_on_close
   is off). If that bar is not in the tape, the entry is unread.
   Pyramiding is 0. An opposite cross reverses at the next open.
   A bar that trades both stop and target is the stop — there is no bar
   magnifier. The 5% equity size and the 0.02 commission are not prices.
   Unread tape, unread clock, unread session, unread EMA or unread ATR
   is not a setup and is not filled in. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

var SPEC = {
  tf: '15m',
  barMs: 15 * 60 * 1000,
  fast: 21,
  slow: 55,
  atr: 14,
  slMult: 1.5,
  tpMult: 3.0,
  sessionStart: 17 * 60 + 30,
  sessionEnd: 21 * 60 + 30,
  tz: 'Asia/Kolkata',
  session: '1730-2130',
  count: 400
};

function isNum(x){ return typeof x === 'number' && isFinite(x); }

function barOpenMs(row){
  if (!row || row.t == null) return null;
  var t = row.t;
  if (typeof t === 'string') t = Date.parse(t);
  if (!isNum(t)) return null;
  if (t < 1e12) t = t * 1000;
  return t;
}

function istMinutes(ms){
  if (!isNum(ms)) return null;
  try{
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: SPEC.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    var parts = fmt.formatToParts(new Date(ms));
    var h = NaN, m = NaN, i;
    for (i = 0; i < parts.length; i++){
      if (parts[i].type === 'hour') h = +parts[i].value;
      if (parts[i].type === 'minute') m = +parts[i].value;
    }
    if (h === 24) h = 0;
    if (!isNum(h) || !isNum(m)) return null;
    return h * 60 + m;
  }catch(e){
    return null;
  }
}

function inSessionMs(ms){
  var mins = istMinutes(ms);
  if (mins == null) return null;
  return mins >= SPEC.sessionStart && mins < SPEC.sessionEnd;
}

function istLabel(ms){
  if (!isNum(ms)) return null;
  try{
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: SPEC.tz, year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(ms)) + ' IST';
  }catch(e){
    return null;
  }
}

/* Pine ta.ema: na until `len` bars, first value is the SMA, then
   alpha = 2/(len+1). A non-finite close leaves everything after it unread. */
function pgEma(vals, len){
  var n = vals ? vals.length : 0;
  var out = new Array(n);
  var i;
  for (i = 0; i < n; i++) out[i] = NaN;
  if (!(len >= 1) || n < len) return out;
  var sum = 0;
  for (i = 0; i < len; i++){
    if (!isNum(vals[i])) return out;
    sum += vals[i];
  }
  var e = sum / len;
  var k = 2 / (len + 1);
  out[len - 1] = e;
  for (i = len; i < n; i++){
    if (!isNum(vals[i]) || !isNum(e)) return out;
    e = vals[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

/* Pine ta.atr: RMA of true range. Bar 0 has no prior close, so it is not
   in the seed. The first value sits at index `len` and is the mean of the
   first `len` true ranges (bars 1..len). */
function trAt(rows, i){
  var r = rows[i], p = rows[i - 1];
  if (!r || !p) return null;
  if (!isNum(r.h) || !isNum(r.l) || !isNum(r.c) || !isNum(p.c)) return null;
  if (r.h < r.l) return null;
  return Math.max(r.h - r.l, Math.abs(r.h - p.c), Math.abs(r.l - p.c));
}

function pgAtr(rows, len){
  var n = rows ? rows.length : 0;
  var out = new Array(n);
  var i;
  for (i = 0; i < n; i++) out[i] = NaN;
  var a = null;
  for (i = 1; i < n; i++){
    var tr = trAt(rows, i);
    if (tr == null){ a = null; continue; }
    if (a === null){
      if (i >= len){
        var s = 0, k, ok = true, t;
        for (k = i - len + 1; k <= i; k++){
          t = trAt(rows, k);
          if (t == null){ ok = false; break; }
          s += t;
        }
        if (!ok) continue;
        a = s / len;
        out[i] = a;
      }
    } else {
      a = (a * (len - 1) + tr) / len;
      out[i] = a;
    }
  }
  return out;
}

/* ta.crossover / ta.crossunder. Equal on the new bar is not a cross.
   Already on that side is not a cross. A touch on the previous bar is. */
function pgCross(fastPrev, slowPrev, fastNow, slowNow){
  if (!isNum(fastPrev) || !isNum(slowPrev) || !isNum(fastNow) || !isNum(slowNow)) return null;
  if (fastPrev <= slowPrev && fastNow > slowNow) return 'long';
  if (fastPrev >= slowPrev && fastNow < slowNow) return 'short';
  return null;
}

function pathOk(row){
  if (!row) return false;
  if (!isNum(row.o) || !isNum(row.h) || !isNum(row.l) || !isNum(row.c)) return false;
  if (row.h < row.l) return false;
  if (row.h < row.o || row.h < row.c || row.l > row.o || row.l > row.c) return false;
  if (!(row.c > 0) || !(row.o > 0)) return false;
  return true;
}

function levelsOf(dir, close, atr){
  if (!isNum(close) || !isNum(atr) || !(atr > 0) || !(close > 0)) return null;
  var stop = dir === 'long' ? close - atr * SPEC.slMult : close + atr * SPEC.slMult;
  var target = dir === 'long' ? close + atr * SPEC.tpMult : close - atr * SPEC.tpMult;
  if (!isNum(stop) || !isNum(target)) return null;
  if (dir === 'long' && !(stop < close && target > close)) return null;
  if (dir === 'short' && !(stop > close && target < close)) return null;
  return { stop: stop, target: target };
}

/* Same-bar stop and target: the stop. A gap through the stop fills the
   exit at the open (worse than the stop). */
function hit(pos, row){
  var o = row.o, h = row.h, l = row.l;
  if (pos.dir === 'long'){
    if (o <= pos.stop) return { kind: 'stop', gap: true };
    if (o >= pos.target) return { kind: 'target', gap: true };
    var hs = l <= pos.stop, ht = h >= pos.target;
    if (hs && ht) return { kind: 'stop', both: true };
    if (hs) return { kind: 'stop' };
    if (ht) return { kind: 'target' };
    return null;
  }
  if (o >= pos.stop) return { kind: 'stop', gap: true };
  if (o <= pos.target) return { kind: 'target', gap: true };
  var hs2 = h >= pos.stop, ht2 = l <= pos.target;
  if (hs2 && ht2) return { kind: 'stop', both: true };
  if (hs2) return { kind: 'stop' };
  if (ht2) return { kind: 'target' };
  return null;
}

function blank(){
  return {
    status: 'aside',
    reason: 'tape unread',
    dir: null,
    entry: null,
    stop: null,
    target: null,
    signalClose: null,
    atr: null,
    fast: null,
    slow: null,
    signalMs: null,
    fillMs: null,
    inSession: null,
    lastClosedMs: null,
    stacked: null,
    lastEvent: null,
    pending: null,
    formingFill: false,
    barsHeld: null,
    weekend: null
  };
}

function eventOf(pos, ex, index){
  return {
    kind: ex.kind,
    dir: pos.dir,
    both: !!ex.both,
    gap: !!ex.gap,
    index: index,
    entry: pos.entry,
    stop: pos.stop,
    target: pos.target,
    signalClose: pos.signalClose,
    signalMs: pos.signalMs
  };
}

function pgRead(rows, nowMs){
  var out = blank();
  if (!rows || !rows.length){
    out.reason = 'tape unread';
    return out;
  }
  if (!isNum(nowMs)){
    out.reason = 'clock unread';
    return out;
  }

  var n = rows.length;
  var closes = new Array(n);
  var i;
  for (i = 0; i < n; i++){
    closes[i] = (rows[i] && isNum(rows[i].c)) ? rows[i].c : NaN;
  }
  var fast = pgEma(closes, SPEC.fast);
  var slow = pgEma(closes, SPEC.slow);
  var atr = pgAtr(rows, SPEC.atr);

  var last = -1;
  for (i = 0; i < n; i++){
    var oms = barOpenMs(rows[i]);
    if (oms != null && oms + SPEC.barMs <= nowMs) last = i;
  }
  if (last < 0){
    out.reason = 'no closed bar';
    return out;
  }
  out.lastClosedMs = barOpenMs(rows[last]);
  out.fast = isNum(fast[last]) ? fast[last] : null;
  out.slow = isNum(slow[last]) ? slow[last] : null;
  out.atr = isNum(atr[last]) ? atr[last] : null;
  if (out.fast != null && out.slow != null){
    out.stacked = out.fast > out.slow ? 'above' : (out.fast < out.slow ? 'below' : 'tied');
  }
  var lastMins = istMinutes(out.lastClosedMs);
  out.inSession = lastMins == null ? null : (lastMins >= SPEC.sessionStart && lastMins < SPEC.sessionEnd);

  var pos = null;
  var pending = null;
  var lastEvent = null;
  var pathBroken = false;

  for (i = 0; i < n; i++){
    var row = rows[i];
    var openMs = barOpenMs(row);
    var ok = pathOk(row);

    if (pending && pending.signalIndex < i){
      if (!ok){
        pending = null;
        pos = null;
        pathBroken = true;
      } else {
        pos = {
          dir: pending.dir,
          entry: row.o,
          stop: pending.stop,
          target: pending.target,
          signalIndex: pending.signalIndex,
          fillIndex: i,
          signalClose: pending.signalClose,
          atr: pending.atr,
          signalMs: pending.signalMs
        };
        pending = null;
        pathBroken = false;
        var ex = hit(pos, row);
        if (ex){
          lastEvent = eventOf(pos, ex, i);
          pos = null;
        }
      }
    } else if (pos){
      if (!ok){
        pos = null;
        pending = null;
        pathBroken = true;
      } else {
        var ex2 = hit(pos, row);
        if (ex2){
          lastEvent = eventOf(pos, ex2, i);
          pos = null;
        }
      }
    }

    if (!ok) continue;
    if (openMs == null || openMs + SPEC.barMs > nowMs) continue;
    var side = pgCross(fast[i - 1], slow[i - 1], fast[i], slow[i]);
    if (!side) continue;
    var mins = istMinutes(openMs);
    if (mins == null) continue;
    if (mins < SPEC.sessionStart || mins >= SPEC.sessionEnd) continue;
    var lv = levelsOf(side, row.c, atr[i]);
    if (!lv) continue;
    if (pos && pos.dir === side) continue;
    if (pending && pending.dir === side) continue;
    pending = {
      dir: side,
      stop: lv.stop,
      target: lv.target,
      signalIndex: i,
      signalClose: row.c,
      atr: atr[i],
      signalMs: openMs
    };
    pathBroken = false;
  }

  function weekendOf(ms){
    if (!isNum(ms)) return null;
    var d = new Date(ms).getUTCDay();
    return d === 0 || d === 6;
  }

  if (pos){
    out.status = 'working';
    out.reason = 'working';
    out.dir = pos.dir;
    out.entry = pos.entry;
    out.stop = pos.stop;
    out.target = pos.target;
    out.signalClose = pos.signalClose;
    out.atr = pos.atr;
    out.signalMs = pos.signalMs;
    out.fillMs = barOpenMs(rows[pos.fillIndex]);
    out.formingFill = (pos.fillIndex === n - 1) && (out.fillMs != null) && (out.fillMs + SPEC.barMs > nowMs);
    out.barsHeld = last - pos.fillIndex;
    out.weekend = weekendOf(pos.signalMs);
    out.lastEvent = null;
    if (pending && pending.dir !== pos.dir){
      out.pending = {
        dir: pending.dir,
        entry: null,
        stop: pending.stop,
        target: pending.target,
        signalClose: pending.signalClose,
        signalMs: pending.signalMs
      };
    }
    return out;
  }

  if (pending){
    out.status = 'armed';
    out.reason = 'entry not filled';
    out.dir = pending.dir;
    out.entry = null;
    out.stop = pending.stop;
    out.target = pending.target;
    out.signalClose = pending.signalClose;
    out.atr = pending.atr;
    out.signalMs = pending.signalMs;
    out.weekend = weekendOf(pending.signalMs);
    out.lastEvent = null;
    return out;
  }

  out.lastEvent = lastEvent;
  if (pathBroken){
    out.reason = 'path unread';
    return out;
  }
  if (lastEvent){
    out.reason = lastEvent.kind === 'target' ? 'target hit' : 'stopped';
    return out;
  }
  if (out.inSession == null){
    out.reason = 'bar time unread';
    return out;
  }
  if (out.fast == null || out.slow == null || out.atr == null){
    out.reason = 'ema unread';
    return out;
  }
  if (out.inSession === false){
    out.reason = 'outside session';
    return out;
  }
  out.reason = 'no fresh cross';
  return out;
}

function fmt(n){
  return isNum(n) ? n.toFixed(2) : '—';
}

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return c === '&' ? '&' : c === '<' ? '<' : c === '>' ? '>' : '"';
  });
}

function rFromFill(dir, entry, stop, target){
  if (!isNum(entry) || !isNum(stop) || !isNum(target)) return null;
  var risk = dir === 'long' ? entry - stop : stop - entry;
  var reward = dir === 'long' ? target - entry : entry - target;
  if (!(risk > 0) || !(reward > 0)) return null;
  return reward / risk;
}

function pgHtml(read, meta){
  read = read || blank();
  meta = meta || {};
  var feed = meta.feed ? esc(meta.feed) : 'unread';
  var head = '<div class="card"><div class="card-h">PURE GOLD · 15m · EMA 21/55 · IST 17:30–21:30</div>';
  var diag = '<div class="note">Last closed bar ' + esc(istLabel(read.lastClosedMs) || 'time unread')
    + ' · session ' + (read.inSession === true ? 'IN' : read.inSession === false ? 'OUT' : 'unread')
    + ' · fast ' + fmt(read.fast) + ' · slow ' + fmt(read.slow)
    + ' · ATR14 ' + fmt(read.atr)
    + ' · stack ' + esc(read.stacked || 'unread')
    + ' · feed ' + feed + '</div>';
  var rule = '<div class="note">Entry is the next bar open after a fresh cross, not the live print. Stop is 1.5×ATR and target is 3×ATR from the signal close. A stack without a new cross is not a setup. Size 5% and commission 0.02 are not prices.</div>';

  if (read.status === 'working' || read.status === 'armed'){
    var side = read.dir === 'short' ? 'SHORT' : 'LONG';
    var state = read.status === 'armed' ? 'ARMED — entry not filled' : (read.formingFill ? 'WORKING — fill bar still forming' : 'WORKING');
    var entryLine = read.status === 'armed'
      ? 'Entry — next open is not in the tape'
      : 'Entry ' + fmt(read.entry) + (read.formingFill ? ' (this bar\'s open; its close is not a signal)' : ' (next open after the cross, not the live print)');
    var rr = rFromFill(read.dir, read.entry, read.stop, read.target);
    var rrLine = rr == null ? '' : '<div>R from the fill ' + fmt(rr) + ' — the script\'s 2R is from the signal close, not from this open</div>';
    var held = (read.status === 'working' && isNum(read.barsHeld))
      ? '<div>Open for ' + String(Math.max(0, read.barsHeld)) + ' closed bars after the fill. The script has no timeout.</div>' : '';
    var wk = read.weekend === true
      ? '<div class="note">The signal bar falls on a weekend. The script has no weekend filter. A cash gold session may not have printed it.</div>' : '';
    var pend = '';
    if (read.pending){
      pend = '<div class="note">A reverse ' + (read.pending.dir === 'short' ? 'SHORT' : 'LONG')
        + ' cross is confirmed. That entry is the next open, which is not in the tape, so it is unread. Its stop '
        + fmt(read.pending.stop) + ' and target ' + fmt(read.pending.target)
        + ' are measured from its signal close ' + fmt(read.pending.signalClose) + '.</div>';
    }
    return head + '<div><b>' + side + '</b> · ' + state + '</div>'
      + '<div>' + entryLine + '</div>'
      + '<div>Stop ' + fmt(read.stop) + ' · target ' + fmt(read.target) + '</div>'
      + '<div>Signal close ' + fmt(read.signalClose) + ' at ' + esc(istLabel(read.signalMs) || 'time unread')
      + ' · ATR ' + fmt(read.atr) + '</div>'
      + rrLine + held + wk + pend + diag + rule + '</div>';
  }

  var why = {
    'tape unread': 'Tape unread. No entry, stop, or target.',
    'clock unread': 'Clock unread, so a closed bar cannot be told from a forming one. No setup.',
    'no closed bar': 'No closed 15m bar. The forming bar is not a signal.',
    'path unread': 'A bar after the cross has no usable high/low, so the stop cannot be checked. No setup.',
    'stopped': 'No live setup. The last cross was stopped'
      + (read.lastEvent && read.lastEvent.both ? ' — that bar also traded the target; with no bar magnifier the stop is the exit' : '')
      + (read.lastEvent && read.lastEvent.gap ? ' on the open' : '') + '.',
    'target hit': 'No live setup. The last cross reached its target.',
    'bar time unread': 'Bar time unread, so the IST session cannot be known. No setup.',
    'ema unread': 'EMA or ATR unread on the last closed bar. No setup.',
    'outside session': 'Outside 17:30–21:30 IST. A cross here is not a setup.',
    'no fresh cross': 'Inside the session, no fresh EMA 21/55 cross. A standing stack is not an entry.'
  };
  var line = why[read.reason] || 'No setup.';
  var closed = '';
  if (read.lastEvent && (read.reason === 'stopped' || read.reason === 'target hit')){
    closed = '<div class="note">Closed ' + (read.lastEvent.dir === 'short' ? 'SHORT' : 'LONG')
      + ' · entry was ' + fmt(read.lastEvent.entry)
      + ' · stop ' + fmt(read.lastEvent.stop)
      + ' · target ' + fmt(read.lastEvent.target)
      + ' · signal close ' + fmt(read.lastEvent.signalClose)
      + '. Those are the old trade, not a new order.</div>';
  }
  return head + '<div><b>STAND ASIDE</b></div><div>' + line + '</div>' + closed + diag + rule + '</div>';
}

var __el = null;
var __seq = 0;

function paint(el, html, stat){
  if (!el) return;
  var box = el.querySelector('#pgCards');
  var st = el.querySelector('#pgStat');
  if (box) box.innerHTML = html;
  if (st) st.textContent = stat || '';
}

async function loadTape(){
  var fn = (typeof W.getGoldCandles === 'function') ? W.getGoldCandles : null;
  if (!fn) return { rows: null, feed: null, why: 'gold candle layer not loaded' };
  var pack;
  try { pack = await fn(SPEC.tf, SPEC.count); }
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
  paint(el, '', 'reading 15m gold…');
  var tape;
  try { tape = await loadTape(); }
  catch (e) { tape = { rows: null, feed: null, why: 'tape unread' }; }
  if (seq !== __seq) return 'stale';
  var now = Date.now();
  var read;
  if (!tape || !tape.rows){
    read = blank();
    read.reason = 'tape unread';
  } else {
    try { read = pgRead(tape.rows, now); }
    catch (e2) {
      read = blank();
      read.reason = 'tape unread';
    }
  }
  var html = pgHtml(read, { feed: tape && tape.feed });
  var stat = read.status === 'working' ? 'working — entry is the next open, not the live print'
    : read.status === 'armed' ? 'armed — next open is not in the tape'
    : 'stand aside — ' + read.reason;
  paint(el, html, stat);
  return read.reason;
}

function mount(el){
  if (!el) return;
  __el = el;
  el.innerHTML = '<div class="panel"><h2>PURE GOLD <span>IST 17:30–21:30 · EMA 21 cross of EMA 55 · ATR stop and target</span></h2>'
    + '<div class="note">The script enters only when EMA 21 crosses EMA 55 inside 17:30–21:30 IST, on a closed 15m bar. Stop 1.5×ATR(14) and target 3×ATR(14) are taken from that bar\'s close. The fill is the next bar\'s open. Outside the session, or with the tape, the clock, the EMA or the ATR unread, there is no setup.</div>'
    + '<div style="margin-top:8px"><button class="btn" id="pgScan" type="button">SCAN PURE GOLD</button> <span class="note" id="pgStat">idle</span></div></div>'
    + '<div class="cards" id="pgCards"></div>';
  var btn = el.querySelector('#pgScan');
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

W.HG_PUREGOLD_SPEC = SPEC;
W.hgPureGoldEma = pgEma;
W.hgPureGoldAtr = pgAtr;
W.hgPureGoldCross = pgCross;
W.hgPureGoldInSession = inSessionMs;
W.hgPureGoldRead = pgRead;
W.hgPureGoldHtml = pgHtml;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'puregold', label: 'PURE GOLD', mount: mount, refresh: refresh });
})();
