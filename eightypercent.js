/* =========================================================================
HARDGATE — eightypercent.js
80PERCENT tab (GOLD group): the High-Momentum Trend Dip-Buyer, implemented
exactly as specified, and priced honestly.

THE SPEC, IMPLEMENTED LITERALLY

  timeframe   5-minute XAUUSD
  indicators  EMA(200), EMA(50), RSI(14), ATR(14)
  session     13:00-18:00 UTC only
  long        close > EMA50  AND  EMA50 > EMA200
              AND RSI(14) < 45
              AND close > open
  short       close < EMA50  AND  EMA50 < EMA200
              AND RSI(14) > 55
              AND close < open
  entry       the close of the trigger candle
  target      entry +/- 0.75 x ATR(14)
  stop        entry -/+ 4.00 x ATR(14)

All four conditions must hold on the SAME candle. Nothing here is loosened,
tightened or "improved" — the four indicator functions are the desk's own
(indicators.js ema / rsi / atr, Wilder-smoothed RSI and ATR), and the rules
are transcribed one to one so the tab can be checked against the spec line
by line.

THE ARITHMETIC THE SPEC CANNOT ESCAPE, AND WHY IT IS ON THE CARD

Risking 4.00 ATR to make 0.75 ATR is 1:5.333. The win rate that merely
breaks even, before a single cent of cost, is

    4.00 / (4.00 + 0.75) = 84.2105%

The strategy claims 85%+. That clears the gross bar by 0.79 points and is
worth +0.0375 ATR per trade — which sounds like an edge until it is priced.

On this desk's own numbers (gold ~4358, 15m ATR ~5.749 from the goldscalp
walk, so 5m ATR ~3.32 by sqrt-of-time) one round trip costs ~0.87 at XM's
0.020%. Against a 0.75 ATR target of ~2.49 that is 35% of the entire
winner. Solve for the win rate that breaks even AFTER cost:

    p = (cost + 4.00 x ATR) / (4.75 x ATR)

    at XM   (0.020% RT)   needs 89.74%   -> at 85% it nets -0.0563R/trade
    at PAXG (0.26%  RT)   needs 156.09%  -> arithmetically unreachable

So even taking 85% entirely at face value, this loses money at the venue
this desk actually trades. The claim is not far enough above breakeven to
survive its own spread. That is not a criticism of the entry logic — the
entries may well be 85% — it is that 85% is the wrong side of the line once
the line is drawn in the right place.

THE TAB DOES NOT ASSERT ANY OF THAT. It recomputes the required win rate
from the LIVE ATR and the venue currently selected, every scan, and shows it
beside the claim. If ATR widens enough that 0.75 ATR dwarfs the spread, the
number moves on its own and the card says so. Arithmetic on current
numbers, not an opinion baked in at build time.

WHY EVERY SETUP IS A WATCH

hg-v756 made measured-edge a hard gate: a ticket needs a measured edge. This
strategy has no record on this desk — it has never been walked, and its 85%
is an assertion, not a measurement. Under the desk's own rule that makes
every 80PERCENT setup a WATCH, exactly as TAURIC is. Every fired setup is
written to the forward log under OMNIGOLD:P80 so the claim becomes testable:
at 20 settled trades the log can say whether the win rate is anywhere near
84.21%, and that is the only thing that could ever change the verdict.

Classic script + HG_tabs, like every other module.
========================================================================= */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

/* ---- the spec's constants, in one place, named after the spec ---------- */
var P80_TF          = '5m';
var P80_TF_SEC      = 5 * 60;
var P80_BARS        = 500;          /* EMA200 needs 200; 500 gives real history */
var P80_EMA_FAST    = 50;
var P80_EMA_SLOW    = 200;
var P80_RSI_LEN     = 14;
var P80_ATR_LEN     = 14;
var P80_RSI_LONG    = 45;           /* long pullback: RSI drops BELOW this */
var P80_RSI_SHORT   = 55;           /* short pullback: RSI rallies ABOVE this */
var P80_TP_ATR      = 0.75;
var P80_SL_ATR      = 4.00;
/* "between 13:00 and 18:00 UTC" — read as [13:00, 18:00), so the last
   eligible 5m bar opens 17:55. Stated because "to" is ambiguous and a
   silent choice here shifts which bars qualify. */
var P80_UTC_FROM    = 13;
var P80_UTC_TO      = 18;
var P80_TAB         = 'OMNIGOLD:P80';
var P80_HORIZON_BARS = 48;          /* 4h of 5m bars to resolve, then expire */

var __p = { ui: null, busy: false, ranOnce: false, last: null };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
function fin(v){ var n = Number(v); return isFinite(n) ? n : NaN; }
function num(v, d){ return isFinite(fin(v)) ? fin(v).toFixed(d == null ? 2 : d) : '—'; }
function gfn(name){ return (typeof W[name] === 'function') ? W[name] : null; }

/* ---------------------------------------------------------------------
   THE BREAKEVEN, COMPUTED — NEVER ASSERTED

   p_gross = SL / (SL + TP), which for this spec is a constant 84.2105%.
   p_net   = (cost + SL x ATR) / ((SL + TP) x ATR), which moves with ATR and
   with the venue, and is the one that decides whether the trade pays.

   Returns null rather than a number when ATR or price are unknown: a
   required win rate computed on a guessed ATR is worse than none.
   --------------------------------------------------------------------- */
function hg80Breakeven(atr, px, rtFrac){
  var a = fin(atr), p = fin(px);
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  var out = { gross: gross, net: null, cost: null, risk: null, target: null, rtFrac: null };
  if (!(a > 0) || !(p > 0)) return out;
  out.risk = P80_SL_ATR * a;
  out.target = P80_TP_ATR * a;
  var rt = fin(rtFrac);
  if (!(rt >= 0)) return out;
  out.rtFrac = rt;
  out.cost = p * rt;
  out.net = (out.cost + out.risk) / (out.risk + out.target);
  return out;
}

/* Expectancy in R at an assumed win rate, cost included. `hit` is an INPUT,
   never a measurement — the caller supplies the claim being tested. */
function hg80ExpectancyR(hit, be){
  var h = fin(hit);
  if (!be || !(be.risk > 0) || !isFinite(h)) return NaN;
  var cost = isFinite(fin(be.cost)) ? fin(be.cost) : 0;
  return (h * be.target - (1 - h) * be.risk - cost) / be.risk;
}

/* The venue round-trip fraction the desk is currently set to. Reuses the
   gold desk's own model so this tab and every other card price the same
   trade the same way; null when it cannot be read, which makes the net
   breakeven unavailable rather than wrong. */
function hg80VenueRt(){
  try {
    if (typeof W.hgOgVenueCost === 'function'){
      var v = W.hgOgVenueCost();
      if (v && isFinite(fin(v.rtFrac))) return { rtFrac: fin(v.rtFrac), venue: v.venue || v.name || null };
    }
  } catch (e){}
  return null;
}

/* ---------------------------------------------------------------------
   INDICATORS — the desk's own, not reimplementations

   indicators.js ships ema(vals,p), rsi(vals,p) and atr(rows,p) with Wilder
   smoothing on the latter two, which is what the spec's "14-period RSI /
   ATR" means. Computing a second copy here is how two tabs end up
   disagreeing about the same candle.
   --------------------------------------------------------------------- */
function hg80Indicators(rows){
  var emaFn = gfn('ema'), rsiFn = gfn('rsi'), atrFn = gfn('atr');
  if (!emaFn || !rsiFn || !atrFn) return null;
  if (!rows || rows.length < P80_EMA_SLOW + 2) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++) closes.push(fin(rows[i].c));
  return {
    ema50:  emaFn(closes, P80_EMA_FAST),
    ema200: emaFn(closes, P80_EMA_SLOW),
    rsi:    rsiFn(closes, P80_RSI_LEN),
    atr:    atrFn(rows, P80_ATR_LEN)
  };
}

/* The session filter, on the bar's OPEN time in UTC. Rows carry t in
   seconds (the desk's convention); a row with no usable timestamp is out of
   session rather than quietly in it. */
function hg80InSession(tSec){
  var t = fin(tSec);
  if (!isFinite(t) || t <= 0) return false;
  var h = new Date(t * 1000).getUTCHours();
  return h >= P80_UTC_FROM && h < P80_UTC_TO;
}

/* ---------------------------------------------------------------------
   THE ENTRY PROTOCOL, TRANSCRIBED

   Returns a signal for bar i, or null. Every one of the four conditions is
   reported by name whether it passed or failed, so the card can show WHY a
   bar did not fire instead of only showing the ones that did.
   --------------------------------------------------------------------- */
function hg80SignalAt(rows, ind, i){
  if (!rows || !ind || i < 0 || i >= rows.length) return null;
  var r = rows[i];
  if (!r) return null;
  var c = fin(r.c), o = fin(r.o);
  var e50 = fin(ind.ema50[i]), e200 = fin(ind.ema200[i]);
  var rs = fin(ind.rsi[i]), a = fin(ind.atr[i]);
  if (!isFinite(c) || !isFinite(o) || !isFinite(e50) || !isFinite(e200)
      || !isFinite(rs) || !(a > 0)) return null;

  var inSess = hg80InSession(r.t);

  var longChecks = {
    trend:    (c > e50) && (e50 > e200),
    pullback: rs < P80_RSI_LONG,
    trigger:  c > o,
    session:  inSess
  };
  var shortChecks = {
    trend:    (c < e50) && (e50 < e200),
    pullback: rs > P80_RSI_SHORT,
    trigger:  c < o,
    session:  inSess
  };
  var allOf = function(x){ return x.trend && x.pullback && x.trigger && x.session; };

  var dir = allOf(longChecks) ? 'long' : (allOf(shortChecks) ? 'short' : null);
  return {
    i: i, t: fin(r.t), dir: dir,
    close: c, open: o, ema50: e50, ema200: e200, rsi: rs, atr: a,
    longChecks: longChecks, shortChecks: shortChecks,
    /* which side was closer to firing, for the "why not" line */
    checks: dir === 'short' ? shortChecks : longChecks
  };
}

/* The exit protocol. Entry is the trigger candle's CLOSE, per the spec. */
function hg80Plan(sig){
  if (!sig || !sig.dir || !(sig.atr > 0)) return null;
  var entry = sig.close;
  var tpDist = P80_TP_ATR * sig.atr, slDist = P80_SL_ATR * sig.atr;
  var t1   = sig.dir === 'long' ? entry + tpDist : entry - tpDist;
  var stop = sig.dir === 'long' ? entry - slDist : entry + slDist;
  return { dir: sig.dir, entry: entry, stop: stop, t1: t1,
           risk: slDist, reward: tpDist, atr: sig.atr,
           rr: tpDist > 0 ? (slDist / tpDist) : NaN,
           stopPct: (slDist / entry) * 100 };
}

/* Scan a bar series for every setup the spec fires. Pure — takes rows,
   returns signals — so the whole protocol is testable without a network,
   a DOM or a clock. */
function hg80Scan(rows, opts){
  var o = opts || {};
  var ind = hg80Indicators(rows);
  if (!ind) return { ok: false, why: 'need at least ' + (P80_EMA_SLOW + 2)
                        + ' bars and the desk\'s indicator functions', signals: [] };
  var out = [], i;
  var from = Math.max(P80_EMA_SLOW, 0);
  var lastOnly = o.lastOnly === true;
  var start = lastOnly ? Math.max(from, rows.length - 1) : from;
  for (i = start; i < rows.length; i++){
    var s = hg80SignalAt(rows, ind, i);
    if (s && s.dir){ s.plan = hg80Plan(s); out.push(s); }
  }
  return { ok: true, signals: out, bars: rows.length, ind: ind };
}

/* ---------------------------------------------------------------------
   RECORDING — so the 85% stops being an assertion

   Same contract as every other instrumented tab: barT floored to the bar
   (the log's dedup rule AND what makes a record settleable), ticket false
   and gateClear false because this cleared no gate — it was never put to
   them. hgFwdRecord returns a REASON STRING; only 'recorded' is one.
   --------------------------------------------------------------------- */
function hg80Record(sig){
  try {
    if (typeof W.hgFwdRecord !== 'function') return { ok: false, why: 'forward log not loaded' };
    if (!sig || !sig.dir || !sig.plan) return { ok: false, why: 'no fired setup to record' };
    var p = sig.plan;
    var barT = isFinite(fin(sig.t))
      ? Math.floor(fin(sig.t) / P80_TF_SEC) * P80_TF_SEC
      : Math.floor((Date.now() / 1000) / P80_TF_SEC) * P80_TF_SEC;
    var reason = W.hgFwdRecord({
      tab: P80_TAB,
      mechanic: 'P80-DIP-' + sig.dir.toUpperCase(),
      sym: 'XAUUSD', tf: P80_TF, dir: sig.dir,
      entry: fin(p.entry), stop: fin(p.stop), t1: fin(p.t1),
      barT: barT,
      horizonBars: P80_HORIZON_BARS,
      ticket: false,
      gateClear: false,
      shown: true
    });
    return { ok: reason === 'recorded', reason: reason,
             why: reason === 'recorded' ? null : ('the log refused it: ' + reason) };
  } catch (e){ return { ok: false, why: String((e && e.message) || e) }; }
}

/* ---------------------------------------------------------------------
   RENDERING
   --------------------------------------------------------------------- */
function mathPanelHtml(be, venue){
  var h = '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #b45309;'
    + 'border-left:3px solid #b45309;border-radius:4px;background:rgba(180,83,9,0.08)">'
    + '<b>WHAT THIS CONFIGURATION HAS TO HIT TO BREAK EVEN</b><br>'
    + 'Risking ' + P80_SL_ATR.toFixed(2) + ' ATR to make ' + P80_TP_ATR.toFixed(2)
    + ' ATR is 1:' + (P80_SL_ATR / P80_TP_ATR).toFixed(3) + '. Before any cost at all, that needs '
    + '<b>' + (be.gross * 100).toFixed(2) + '%</b> — arithmetic, not an opinion. '
    + 'The strategy claims 85%, which clears it by '
    + (100 * (0.85 - be.gross)).toFixed(2) + ' points.';

  if (be.net == null){
    return h + '<br><span class="note">The cost-adjusted bar cannot be computed — no live ATR or no '
      + 'venue cost — so it is not shown rather than guessed.</span></div>';
  }

  var e85 = hg80ExpectancyR(0.85, be);
  var reachable = be.net < 1;
  h += '<br>Priced at <b>' + esc(venue || 'the selected venue') + '</b> ('
    + (be.rtFrac * 100).toFixed(3) + '% round trip = ' + num(be.cost) + ' on this price), '
    + 'against a target of ' + num(be.target) + ' and a stop of ' + num(be.risk) + ':';
  h += '<br><b style="font-size:1.1em">it needs ' + (be.net * 100).toFixed(2) + '%</b>'
    + (reachable ? '' : ' — which is above 100% and therefore unreachable at this venue');
  if (isFinite(e85)){
    h += '<br>At the claimed 85% it nets <b>' + (e85 >= 0 ? '+' : '') + e85.toFixed(4)
      + 'R per trade</b>' + (e85 < 0 ? ' — a loss.' : '.');
  }
  h += '<br><span class="note">The cost is ' + (100 * be.cost / be.target).toFixed(1)
    + '% of the entire winner, which is what closes the gap: the target is small in price '
    + 'even though the stop is wide in ATR. Recomputed from live ATR every scan — if '
    + 'volatility widens, this number falls on its own.</span>';
  return h + '</div>';
}

function setupCardHtml(sig, be){
  var p = sig.plan;
  var when = isFinite(fin(sig.t)) ? new Date(fin(sig.t) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';
  var h = '<div class="panel" style="margin-top:8px"><h3>'
    + (sig.dir === 'long' ? 'LONG' : 'SHORT') + ' XAUUSD <span>' + esc(when) + '</span></h3>';
  h += '<table class="tbl"><tr><th>entry</th><th>stop</th><th>target</th><th>risk</th><th>reward</th><th>R:R</th></tr>'
    + '<tr><td class="hg-num">' + num(p.entry) + '</td><td class="hg-num">' + num(p.stop) + '</td>'
    + '<td class="hg-num">' + num(p.t1) + '</td><td class="hg-num">' + num(p.risk) + '</td>'
    + '<td class="hg-num">' + num(p.reward) + '</td><td class="hg-num">1:' + num(p.rr, 2)
    + '</td></tr></table>';
  h += '<div class="note">ATR(14) ' + num(sig.atr, 3) + ' · RSI(14) ' + num(sig.rsi, 1)
    + ' · EMA50 ' + num(sig.ema50) + ' · EMA200 ' + num(sig.ema200)
    + ' · stop is ' + num(p.stopPct, 3) + '% of entry</div>';

  /* the desk's own stop floor, stated where it is contradicted rather than
     silently bypassed — 4 ATR is WIDE in ATR and NARROW in percent on a 5m
     chart, and those are not the same thing */
  var floor = 0.50;
  if (p.stopPct < floor){
    h += '<div class="note warn" style="margin-top:4px">This stop is '
      + num(p.stopPct, 3) + '% of entry, below this desk\'s ' + floor.toFixed(2)
      + '% floor. The floor exists because a stop too tight to carry a spread turns cost into '
      + 'the dominant term — which is exactly what the arithmetic above shows happening here. '
      + 'Shown, not suppressed: the spec asked for 4 ATR and 4 ATR is what is printed.</div>';
  }

  /* the shared geometry verdict, like every other plan-publishing tab */
  try {
    if (typeof W.hgPlanGeometryLineHtml === 'function'){
      h += W.hgPlanGeometryLineHtml(p, sig.close, { style: 'margin-top:4px' }) || '';
    }
  } catch (e){}

  if (be && be.net != null){
    h += '<div class="note" style="margin-top:4px">Needs ' + (be.net * 100).toFixed(2)
      + '% to pay at this ATR and venue.</div>';
  }
  h += '<div class="note warn" style="margin-top:6px;padding:4px 6px;border-left:3px solid #b45309">'
    + '<b>WATCH, NOT A TICKET.</b> This strategy has no measured record on this desk — the 85% is '
    + 'an assertion, and hg-v756 made measured-edge hard. Recorded to the forward log so it can '
    + 'earn one.</div>';
  return h + '</div>';
}

function whyNotHtml(sig){
  if (!sig) return '<div class="note">not enough bars to evaluate the last candle</div>';
  var name = { trend: 'trend alignment', pullback: 'RSI pullback', trigger: 'candle direction', session: '13:00-18:00 UTC' };
  var side = function(label, ch){
    var bits = [], k;
    for (k in ch) if (Object.prototype.hasOwnProperty.call(ch, k)){
      bits.push('<span class="statuschip ' + (ch[k] ? 'ok' : 'na') + '">' + esc(name[k]) + '</span>');
    }
    return '<div style="margin-top:2px"><b>' + label + '</b> ' + bits.join(' ') + '</div>';
  };
  return '<div class="note">The last closed candle fired nothing. All four must hold on the '
    + 'same candle:</div>' + side('LONG', sig.longChecks) + side('SHORT', sig.shortChecks);
}

function render(res, be, venue, recNote){
  var ui = __p.ui;
  if (!ui || !ui.body) return;
  var h = mathPanelHtml(be, venue);

  if (!res || !res.ok){
    ui.body.innerHTML = h + '<div class="note warn">' + esc((res && res.why) || 'no bars') + '</div>';
    return;
  }

  h += '<div class="note">scanned ' + res.bars + ' × ' + P80_TF + ' bars · '
    + res.signals.length + ' setup' + (res.signals.length === 1 ? '' : 's')
    + ' fired across the whole series</div>';

  var live = res.signals.filter(function(s){ return s.i === res.bars - 1; });
  if (live.length){
    h += '<div class="note ok" style="margin-top:6px"><b>THE LAST CLOSED CANDLE FIRED.</b></div>';
    h += setupCardHtml(live[0], be);
    if (recNote) h += '<div class="note" style="margin-top:4px">' + esc(recNote) + '</div>';
  } else {
    h += '<div style="margin-top:6px">' + whyNotHtml(res.lastSig) + '</div>';
  }

  if (res.signals.length){
    var recent = res.signals.slice(-12).reverse();
    h += '<div class="panel" style="margin-top:10px"><h3>MOST RECENT SETUPS IN THIS WINDOW</h3>'
      + '<table class="tbl"><tr><th>time (UTC)</th><th>dir</th><th>entry</th><th>stop</th>'
      + '<th>target</th><th>ATR</th><th>RSI</th></tr>';
    for (var i = 0; i < recent.length; i++){
      var s = recent[i], p = s.plan;
      h += '<tr><td>' + esc(new Date(fin(s.t) * 1000).toISOString().replace('T', ' ').slice(5, 16))
        + '</td><td>' + s.dir + '</td><td class="hg-num">' + num(p.entry)
        + '</td><td class="hg-num">' + num(p.stop) + '</td><td class="hg-num">' + num(p.t1)
        + '</td><td class="hg-num">' + num(s.atr, 2) + '</td><td class="hg-num">'
        + num(s.rsi, 1) + '</td></tr>';
    }
    h += '</table><div class="note">Historical firings on the bars fetched — NOT a backtest. '
      + 'Nothing here has been resolved against what happened next, so no win rate is shown. '
      + 'The forward log is what will answer that.</div></div>';
  }

  ui.body.innerHTML = h;
}

function run(){
  if (__p.busy) return Promise.resolve('busy');
  var ui = __p.ui;
  __p.busy = true;
  if (ui && ui.stat) ui.stat.textContent = 'fetching ' + P80_TF + ' bars…';

  var fetchFn = W.hgOgFetchRows;
  if (typeof fetchFn !== 'function'){
    __p.busy = false;
    if (ui && ui.body) ui.body.innerHTML = '<div class="note warn">the gold bar fetcher '
      + '(hgOgFetchRows) is not loaded — this tab prices nothing without it</div>';
    if (ui && ui.stat) ui.stat.textContent = 'no fetcher';
    return Promise.resolve('error');
  }

  return Promise.resolve().then(function(){ return fetchFn(P80_TF, P80_BARS); })
    .then(function(got){
      var rows = (got && got.rows) ? got.rows : got;
      if (!rows || !rows.length) throw new Error('no ' + P80_TF + ' gold bars came back');
      var res = hg80Scan(rows);
      /* the last candle's checks, fired or not, so the card can say why */
      if (res.ok && res.ind) res.lastSig = hg80SignalAt(rows, res.ind, rows.length - 1);

      var lastAtr = res.ind ? fin(res.ind.atr[rows.length - 1]) : NaN;
      var lastPx = fin(rows[rows.length - 1].c);
      var v = hg80VenueRt();
      var be = hg80Breakeven(lastAtr, lastPx, v ? v.rtFrac : NaN);

      var recNote = null;
      var live = res.ok ? res.signals.filter(function(s){ return s.i === rows.length - 1; }) : [];
      if (live.length){
        var rec = hg80Record(live[0]);
        recNote = rec.ok ? ('Recorded to ' + P80_TAB + ' — the claim is now testable.')
                         : ('Not recorded: ' + (rec.why || 'unknown'));
      }

      __p.last = { res: res, be: be, venue: v };
      render(res, be, v ? v.venue : null, recNote);
      if (ui && ui.stat){
        ui.stat.textContent = 'updated ' + new Date().toISOString().slice(11, 19) + ' UTC · '
          + (live.length ? live[0].dir.toUpperCase() + ' fired' : 'no setup on the last candle');
      }
      __p.ranOnce = true;
      return 'ok';
    })
    .catch(function(e){
      if (ui && ui.body) ui.body.innerHTML = '<div class="note warn">'
        + esc(String((e && e.message) || e)) + '</div>';
      if (ui && ui.stat) ui.stat.textContent = 'failed';
      return 'error';
    })
    .finally(function(){ __p.busy = false; });
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<div class="panel">'
    + '<h2>80PERCENT <span>High-Momentum Trend Dip-Buyer · XAUUSD ' + P80_TF + '</span></h2>'
    + '<div class="note">EMA' + P80_EMA_FAST + '/' + P80_EMA_SLOW + ' trend, RSI('
    + P80_RSI_LEN + ') pullback below ' + P80_RSI_LONG + ' / above ' + P80_RSI_SHORT
    + ', candle-direction trigger, ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC only. '
    + 'Target ' + P80_TP_ATR + ' × ATR, stop ' + P80_SL_ATR + ' × ATR — implemented exactly '
    + 'as specified.</div>'
    + '<div class="row" style="margin-top:8px"><button class="btn" id="p80Run">SCAN</button>'
    + '<span class="note" id="p80Stat">auto-runs on open</span></div>'
    + '<div id="p80Body" style="margin-top:8px"></div></div>';
  __p.ui = { el: el, body: el.querySelector('#p80Body'),
             stat: el.querySelector('#p80Stat'), run: el.querySelector('#p80Run') };
  if (__p.ui.run) __p.ui.run.addEventListener('click', function(){ run(); });
  run();
}

function refresh(){
  if (__p.busy) return Promise.resolve('busy');
  if (!__p.ranOnce || !__p.ui) return Promise.resolve('skipped: not run yet');
  return run();
}

/* exported for the tests and for anything that wants the protocol without
   the markup — a gate, a log, a backtest */
W.hg80Breakeven   = hg80Breakeven;
W.hg80ExpectancyR = hg80ExpectancyR;
W.hg80Indicators  = hg80Indicators;
W.hg80InSession   = hg80InSession;
W.hg80SignalAt    = hg80SignalAt;
W.hg80Plan        = hg80Plan;
W.hg80Scan        = hg80Scan;
W.hg80Record      = hg80Record;
W.HG_P80_TAB      = P80_TAB;
W.HG_P80_SPEC     = { tf: P80_TF, emaFast: P80_EMA_FAST, emaSlow: P80_EMA_SLOW,
                      rsiLen: P80_RSI_LEN, atrLen: P80_ATR_LEN,
                      rsiLong: P80_RSI_LONG, rsiShort: P80_RSI_SHORT,
                      tpAtr: P80_TP_ATR, slAtr: P80_SL_ATR,
                      utcFrom: P80_UTC_FROM, utcTo: P80_UTC_TO };

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: '80percent', label: '80PERCENT', mount: mount, refresh: refresh });
})();
