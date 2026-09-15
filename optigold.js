/* =========================================================================
HARDGATE — optigold.js
OPTI GOLD tab: breakout-and-retracement on gold, from a supplied rule.

THE RULE, as given:
  1. Mark swing highs/lows over a 5-bar window each side.
  2. A firm break of structure (BOS) is a close through the last swing level
     when the previous close was on the other side of it.
  3. On a BOS, place a LIMIT order back at the 50% equilibrium of the broken
     range, stop 1.5xATR beyond the opposite structural level, target 2R.

WHAT I CHANGED, AND WHY IT MATTERS
----------------------------------
The source computed swings with a CENTRED rolling window
(`.rolling(2*w+1, center=True)`), which reads w bars from the FUTURE: the
value at bar i is derived from bars i-5 .. i+5. Those levels were then
forward-filled and compared against the current close to detect the break, so
every signal was partly informed by candles that had not printed yet. That
backtests beautifully and cannot be traded.

Here a swing at bar i is stamped `confirmedAt = i + swingLength` and the signal
loop refuses to consult it before that bar. Same rule, honest clock. The
consequence is real and should be expected: OPTI GOLD fires LATER and LESS
OFTEN than the original code suggests, because a swing high genuinely is not
knowable at the moment it prints.

(smc-lib.js's own swingHighsLows carries the same centred window — deliberately,
since it is a faithful port of the reference library — which is why this file
does its own causal detection rather than reusing it.)

HONEST FRAMING OF THE SETUPS
----------------------------
These are RESTING LIMIT orders at the midpoint of the broken range, not market
entries. After an upside break, price is above the old resistance and the entry
sits well below it — so many will never fill, and the card says how far away it
is. Risk is roughly half the range plus 1.5xATR, which is a WIDE stop; R:R is
2.0 by construction, not by measurement. Nothing here is backtested: the tab
prints what the rule produced and records each setup to the forward log so it
can be judged later on evidence rather than on its geometry.
========================================================================= */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var __og = { ui: null, busy: false, ranOnce: false, last: null };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
/* +null and +'' are both 0 and isFinite(0) is true, so coercing BEFORE the
   guard makes an absent value render as a confident "0.00" on the card. The
   repo's own history records this trap being found five separate times, each
   after it had already printed a wrong number; tests/test-null-formatting.mjs
   exists to stop the sixth, and it caught this one. Reject the absent values
   first, then coerce — the same order ogFwdRows uses below. */
function fin(v){
  if (v === null || v === undefined || v === '') return null;
  var n = +v;
  return isFinite(n) ? n : null;
}
/* Guard on BOTH sentinels. A helper may signal "absent" as null or as NaN, and
   a formatter that only checks one prints the other verbatim — `NaN == null` is
   false, so an NaN-returning fin yields the string "NaN" on the card. Checking
   isFinite as well makes this correct whichever convention is in scope. Note
   isFinite(null) is true, so the null check must stay: neither test alone is
   sufficient. */
function fmt(v, d){
  var n = fin(v);
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return n.toFixed(d == null ? 2 : d);
}

/* ---------- pure rule core (exported for tests; runScan needs network) ---------- */

/* Wilder-style ATR. Returns an array aligned to rows, NaN until seeded. */
function ogAtr(rows, period){
  var n = (rows || []).length, out = new Array(n), i;
  for (i = 0; i < n; i++) out[i] = NaN;
  if (!n || !(period > 0)) return out;
  var trs = new Array(n);
  for (i = 0; i < n; i++){
    var h = +rows[i].h, l = +rows[i].l;
    if (!i){ trs[i] = h - l; continue; }
    var pc = +rows[i - 1].c;
    trs[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  var sum = 0;
  for (i = 0; i < n; i++){
    if (i < period){ sum += trs[i]; if (i === period - 1) out[i] = sum / period; continue; }
    out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

/* Swing points with an HONEST confirmation clock.
   A bar is a swing high if its high exceeds every high within `len` bars on
   BOTH sides — which cannot be known until `len` further bars have closed.
   confirmedAt records that instant; nothing may use the level before it. */
function ogSwings(rows, len){
  rows = rows || []; len = Math.max(1, Math.floor(len || 5));
  var n = rows.length, out = [], i, k;
  for (i = len; i < n - len; i++){
    var isHigh = true, isLow = true;
    for (k = i - len; k <= i + len; k++){
      if (k === i) continue;
      if (+rows[k].h >= +rows[i].h) isHigh = false;
      if (+rows[k].l <= +rows[i].l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ i: i, kind: 'high', px: +rows[i].h, confirmedAt: i + len });
    else if (isLow) out.push({ i: i, kind: 'low', px: +rows[i].l, confirmedAt: i + len });
  }
  return out;
}

/* Walk a placed setup forward and say what actually became of it.
   Order of checks inside one bar matters: a bar that spans both the entry and
   the stop is treated as filled-then-stopped, the pessimistic reading, because
   OHLC cannot order the touches within a bar. */
function ogResolve(rows, from, s){
  var filled = false, i;
  for (i = from; i < rows.length; i++){
    var h = +rows[i].h, l = +rows[i].l;
    if (!filled){
      var touched = s.dir === 'long' ? (l <= s.entry) : (h >= s.entry);
      if (touched){ filled = true; s.filledAt = i; }
      else {
        /* invalidated without ever filling: price ran past the stop the wrong way */
        var gone = s.dir === 'long' ? (h >= s.t1) : (l <= s.t1);
        if (gone) return { state: 'missed', at: i };
        continue;
      }
    }
    var hitStop = s.dir === 'long' ? (l <= s.stop) : (h >= s.stop);
    var hitT1 = s.dir === 'long' ? (h >= s.t1) : (l <= s.t1);
    if (hitStop) return { state: 'stopped', at: i };
    if (hitT1) return { state: 'target', at: i };
  }
  return { state: filled ? 'open' : 'waiting', at: null };
}

/* The rule. Pure: rows in, setups out. No DOM, no network, no globals. */
function ogSignals(rows, opts){
  rows = rows || []; opts = opts || {};
  var len = Math.max(1, Math.floor(opts.swingLength || 5));
  var atrP = Math.max(2, Math.floor(opts.atrPeriod || 14));
  var stopMult = (opts.stopAtr != null) ? +opts.stopAtr : 1.5;
  var rr = (opts.rr != null) ? +opts.rr : 2;
  if (rows.length < atrP + len * 2 + 2) return [];

  var atr = ogAtr(rows, atrP);
  var sw = ogSwings(rows, len);
  var out = [], p = 0, res = null, sup = null, t;

  for (t = 1; t < rows.length; t++){
    /* advance only past swings whose confirmation bar has already closed —
       this single guard is what separates the rule from the lookahead version */
    while (p < sw.length && sw[p].confirmedAt <= t){
      if (sw[p].kind === 'high') res = sw[p].px; else sup = sw[p].px;
      p++;
    }
    if (res == null || sup == null) continue;
    if (!(res > sup)) continue;
    var a = atr[t];
    if (!isFinite(a) || !(a > 0)) continue;

    var prev = +rows[t - 1].c, cur = +rows[t].c;
    if (!isFinite(prev) || !isFinite(cur)) continue;

    var eq = (res + sup) / 2, stop, risk, t1, dir = null;
    if (prev <= res && cur > res){
      dir = 'long';
      stop = sup - stopMult * a;
      risk = eq - stop;
      if (!(risk > 0)) continue;
      t1 = eq + rr * risk;
    } else if (prev >= sup && cur < sup){
      dir = 'short';
      stop = res + stopMult * a;
      risk = stop - eq;
      if (!(risk > 0)) continue;
      t1 = eq - rr * risk;
    } else continue;

    var s = { i: t, t: rows[t].t, dir: dir, entry: eq, stop: stop, t1: t1, risk: risk,
              rr: rr, res: res, sup: sup, atr: a, brokeAt: cur, filledAt: null };
    var r = ogResolve(rows, t + 1, s);
    s.state = r.state; s.resolvedAt = r.at;
    /* how far price must travel BACK to fill — the number that decides whether
       this setup is realistic, and the one the source code never surfaced */
    s.retracePct = Math.abs(cur - eq) / (cur || 1) * 100;
    out.push(s);
  }
  return out;
}

/* ---------- rendering ---------- */

function card(s, last){
  var live = s.state === 'waiting' || s.state === 'open';
  var cls = s.dir === 'long' ? 'long' : 'short';
  var stateLabel = { waiting: 'WAITING — price has not retraced to entry',
                     open: 'FILLED — running',
                     target: 'TARGET reached',
                     stopped: 'STOPPED',
                     missed: 'MISSED — ran to target without filling' }[s.state] || s.state;
  var stateCls = s.state === 'target' ? 'ok' : (s.state === 'stopped' || s.state === 'missed') ? 'bad' : 'warn';
  var away = last ? (Math.abs(last - s.entry) / last * 100) : null;
  var smcChip = '';
  try{ if (typeof W.hgSmcChipHtml === 'function') smcChip = W.hgSmcChipHtml(s) || ''; }catch(e){}

  return '<div class="card ' + cls + '">'
    + '<div class="chead"><span class="sym">XAUUSD</span>'
    + '<span class="dir">' + (s.dir === 'long' ? 'BUY LIMIT' : 'SELL LIMIT') + '</span></div>'
    + '<div class="row" style="gap:6px;margin:4px 0"><span class="stamp ' + stateCls + '">' + esc(stateLabel) + '</span>' + smcChip + '</div>'
    + '<div class="mini">'
    + '<span class="k">entry (50% eq)</span><span>' + fmt(s.entry) + '</span>'
    + '<span class="k">stop</span><span>' + fmt(s.stop) + '</span>'
    + '<span class="k">target (' + fmt(s.rr, 1) + 'R)</span><span>' + fmt(s.t1) + '</span>'
    + '<span class="k">risk</span><span>' + fmt(s.risk) + '</span>'
    + '<span class="k">broken level</span><span>' + fmt(s.dir === 'long' ? s.res : s.sup) + '</span>'
    + '<span class="k">opposite level</span><span>' + fmt(s.dir === 'long' ? s.sup : s.res) + '</span>'
    + (away != null ? '<span class="k">entry is</span><span>' + fmt(away, 2) + '% away</span>' : '')
    + '</div>'
    + '<div class="plan">Break of structure at <b>' + fmt(s.brokeAt) + '</b>; the order rests at the midpoint '
    + 'of the broken range and is <b>not a market entry</b>. Stop is 1.5×ATR beyond the opposite structural level, '
    + 'so risk is roughly half the range plus the buffer — a wide stop by construction. '
    + 'R:R is fixed at ' + fmt(s.rr, 1) + ' by the rule, not measured.</div>'
    + '</div>';
}

function render(ui, setups, rows, note){
  if (!ui || !ui.body) return;
  var last = rows && rows.length ? +rows[rows.length - 1].c : null;
  var live = setups.filter(function(s){ return s.state === 'waiting' || s.state === 'open'; });
  var done = setups.filter(function(s){ return s.state !== 'waiting' && s.state !== 'open'; });
  var settled = done.filter(function(s){ return s.state === 'target' || s.state === 'stopped'; });
  var wins = settled.filter(function(s){ return s.state === 'target'; }).length;

  var h = '';
  h += '<div class="note" style="margin-bottom:8px">'
    + esc(note || '') + '</div>';

  h += '<div class="note warn" style="margin-bottom:10px">'
    + 'Swings are confirmed <b>' + esc(String(__og.cfg.swingLength)) + ' bars after they print</b>, never centred on them. '
    + 'The rule as originally written read future bars to place its levels; this does not, which is why it '
    + 'fires later and less often. <b>No forward evidence yet</b> — these are rule output, not a measured edge.'
    + '</div>';

  h += '<div class="row" style="gap:14px;margin-bottom:10px">'
    + '<span class="statuschip">live <b>' + live.length + '</b></span>'
    + '<span class="statuschip">settled <b>' + settled.length + '</b></span>'
    + '<span class="statuschip">of those hit target <b>' + wins + '</b></span>'
    + '<span class="statuschip">never filled <b>' + done.filter(function(s){ return s.state === 'missed'; }).length + '</b></span>'
    + '</div>';

  if (!setups.length){
    h += '<div class="note">No break of structure in the fetched window. With a ' + esc(String(__og.cfg.swingLength))
      + '-bar swing window and an honest confirmation lag this is normal on a quiet tape.</div>';
  } else {
    if (live.length){
      h += '<h3 style="font-size:12px;margin:10px 0 6px">LIVE — resting orders</h3><div class="cards">';
      live.slice(-6).reverse().forEach(function(s){ h += card(s, last); });
      h += '</div>';
    }
    if (settled.length){
      h += '<h3 style="font-size:12px;margin:14px 0 6px">SETTLED — what the rule would have done</h3><div class="cards">';
      settled.slice(-6).reverse().forEach(function(s){ h += card(s, last); });
      h += '</div>';
      h += '<div class="note" style="margin-top:8px">Settled counts are in-sample over the fetched window only: '
        + 'the same bars the levels were derived from. Read them as a description of the rule, not as evidence it pays. '
        + 'Forward records are being written for a later, honest answer.</div>';
    }
  }
  ui.body.innerHTML = h;
}

/* ---------- scan ---------- */

async function runOptiGold(ui){
  if (__og.busy) return 'busy';
  __og.busy = true;
  try{
    if (ui && ui.stat) ui.stat.textContent = 'fetching gold candles…';
    var ggc = (typeof W.getGoldCandles === 'function') ? W.getGoldCandles : null;
    if (!ggc) throw new Error('getGoldCandles unavailable — gold feed not loaded');

    var got = await ggc(__og.cfg.interval, __og.cfg.bars);
    var rows = (got && got.rows) ? got.rows : [];
    if (!rows.length) throw new Error('no ' + __og.cfg.interval + ' gold candles returned');

    var setups = ogSignals(rows, __og.cfg);
    __og.last = { at: Date.now(), rows: rows.length, setups: setups, src: (got && got.source) || 'gold' };

    /* SMC context on the live ones, record-only here — the chip only */
    try{
      if (typeof W.hgSmcEnrich === 'function'){
        setups.forEach(function(s){
          if (s.state === 'waiting' || s.state === 'open'){
            s.sym = 'XAUUSD';
            W.hgSmcEnrich(s, { rows: rows.slice(0, s.i + 1), tab: 'OPTI GOLD' });
          }
        });
      }
    }catch(eSmc){}

    /* forward log: one record per setup, keyed to its BOS bar, so this tab
       accumulates real out-of-sample evidence instead of re-describing the
       window it was fitted on */
    try{
      if (typeof W.hgFwdRecordScan === 'function'){
        var fwd = ogFwdRows(setups);
        if (fwd.length) W.hgFwdRecordScan('OPTI GOLD', __og.cfg.interval, fwd, { horizonBars: __og.cfg.horizonBars });
      }
    }catch(eFwd){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('optigold', eFwd); }catch(eW){} }

    var note = rows.length + ' × ' + __og.cfg.interval + ' bars from ' + esc(String(__og.last.src))
      + ' · swing window ' + __og.cfg.swingLength + ' · ATR ' + __og.cfg.atrPeriod
      + ' · stop ' + __og.cfg.stopAtr + '×ATR · target ' + __og.cfg.rr + 'R'
      + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC';
    render(ui, setups, rows, note);
    if (ui && ui.stat) ui.stat.textContent = setups.length + ' setup(s) from ' + rows.length + ' bars';
    __og.ranOnce = true;
    return 'ok';
  }catch(e){
    if (ui && ui.body) ui.body.innerHTML = '<div class="note warn">' + esc((e && e.message) || e) + '</div>';
    if (ui && ui.stat) ui.stat.textContent = 'scan failed';
    return 'error';
  }finally{
    __og.busy = false;
  }
}

/* forward-log rows, pure and exported so the recording can be tested without
   a live scan — runOptiGold needs network and is unreachable offline */
function ogFwdRows(setups){
  if (!Array.isArray(setups)) return [];
  /* +null / +'' are 0 and isFinite(0) is true, so a missing level must be
     rejected BEFORE coercion or it records as a fabricated zero */
  function lvl(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }
  var out = [], i;
  for (i = 0; i < setups.length; i++){
    var s = setups[i];
    if (!s || !s.dir) continue;
    if (s.state !== 'waiting' && s.state !== 'open') continue;   /* only live orders */
    var en = lvl(s.entry), st = lvl(s.stop), tp = lvl(s.t1);
    if (!isFinite(en) || !isFinite(st) || !isFinite(tp)) continue;
    if (en === st) continue;
    out.push({ sym: 'XAUUSD', dir: s.dir, entry: en, stop: st, t1: tp,
               mechanic: 'BOS-RETRACE-' + (s.dir === 'long' ? 'LONG' : 'SHORT'),
               ticket: false });   /* never a ticket: unmeasured rule, by design */
  }
  return out;
}

function mountOptiGold(el){
  if (!el) return;
  el.innerHTML = '<div class="panel"><h2>OPTI GOLD <span>break of structure → 50% retracement limit · causal swings</span></h2>'
    + '<div class="row"><button class="btn" id="ogRun">RUN SCAN</button>'
    + '<span class="note" id="ogStat">auto-runs on open</span></div>'
    + '<div id="ogBody"></div></div>';
  __og.ui = { el: el, body: el.querySelector('#ogBody'), stat: el.querySelector('#ogStat'), run: el.querySelector('#ogRun') };
  if (__og.ui.run) __og.ui.run.addEventListener('click', function(){ runOptiGold(__og.ui); });
  runOptiGold(__og.ui);
}

async function refreshOptiGold(){
  if (__og.busy) return 'busy';
  if (!__og.ranOnce || !__og.ui) return 'skipped: not run yet';
  return runOptiGold(__og.ui);
}

__og.cfg = { interval: '1h', bars: 500, swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2, horizonBars: 48 };

function optiGoldState(){ return __og.last || null; }

W.optiGoldState = optiGoldState;
/* exported so the rule can be tested: runOptiGold needs a live gold feed and is
   unreachable in a test sandbox, which is exactly how a previous activation in
   this repo shipped as dead code */
W.__ogSignals = ogSignals;
W.__ogSwings = ogSwings;
W.__ogAtr = ogAtr;
W.__ogFwdRows = ogFwdRows;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'optigold', label: 'OPTI GOLD', mount: mountOptiGold, refresh: refreshOptiGold });

})();
