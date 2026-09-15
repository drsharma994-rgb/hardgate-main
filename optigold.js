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
function ogResolve(rows, from, s, horizon){
  /* THE EXPIRY IS REAL. Every card prints "expires in N bars"; until this
     argument existed nothing enforced it, so a break from 70 bars ago stayed
     "live" forever and the panel led with orders whose entry price had long
     since been left behind. That is the whole reason the setups on screen sat
     a hundred points from the mark. A setup that has used up its horizon
     without hitting stop or target is EXPIRED, whether or not it filled. */
  var hz = Math.floor(+horizon);
  var end = (isFinite(hz) && hz > 0) ? Math.min(rows.length, from + hz) : rows.length;
  var filled = false, i;
  for (i = from; i < end; i++){
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
  /* ran out of horizon rather than out of data -> expired, not live */
  if (end < rows.length) return { state: 'expired', at: end - 1 };
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
    var r = ogResolve(rows, t + 1, s, opts.horizonBars);
    s.state = r.state; s.resolvedAt = r.at;
    /* how far price must travel BACK to fill — the number that decides whether
       this setup is realistic, and the one the source code never surfaced */
    s.retracePct = Math.abs(cur - eq) / (cur || 1) * 100;
    /* bars left before this setup expires, counted from the END of the loaded
       window. The reach estimate needs it: a limit 2xATR away with 30 bars to
       run is a different proposition from the same limit with 2 bars left, and
       distance alone cannot tell those apart. */
    var hz = (opts.horizonBars != null) ? Math.floor(opts.horizonBars) : 0;
    s.barsLeft = hz - (rows.length - 1 - t);
    out.push(s);
  }
  return out;
}

/* THE THREE LANES. Deliberately the SAME rule at three scales — identical swing
   window, ATR period, stop multiple and target. Only the timeframe and the
   expiry differ. Three lanes with three tuned parameter sets would be three
   separately-fitted rules wearing one name, and nothing here has the evidence
   to justify per-lane tuning. Horizons are chosen to match the trading style in
   wall-clock terms, not fitted: 32×15m ≈ 8h, 48×1h = 2 days, 42×4h = 7 days. */
var LANES = [
  { key: 'scalp',    label: 'SCALP',    interval: '15m', bars: 600, swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2, horizonBars: 32 },
  { key: 'intraday', label: 'INTRADAY', interval: '1h',  bars: 500, swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2, horizonBars: 48 },
  { key: 'swing',    label: 'SWING',    interval: '4h',  bars: 400, swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2, horizonBars: 42 },
];

/* Distance from the LIVE MARK to a resting entry, in three units.
   ATR is the one that compares across lanes: 0.4% is nothing on 4h gold and a
   long way on 15m, and a percentage hides exactly that difference. `side` says
   which way price must travel to fill. These are facts about where price is
   now — none of them is a probability that it gets there. */
function ogDistance(setup, px){
  /* +null and +'' are 0 — reject before coercing, or a missing mark reads as
     a real price of zero and every entry looks infinitely far away */
  var p = (px === null || px === undefined || px === '') ? NaN : +px;
  if (!setup || !isFinite(p) || !isFinite(+setup.entry)) return null;
  var entry = +setup.entry;
  var d = Math.abs(p - entry);
  var a = (+setup.atr > 0) ? +setup.atr : NaN;
  return {
    px: d,
    pct: p !== 0 ? (d / p * 100) : null,
    atr: isFinite(a) ? (d / a) : null,
    side: p > entry ? 'above' : (p < entry ? 'below' : 'at'),
  };
}

/* For a position that has already FILLED, distance-to-entry is meaningless —
   that order is done. What matters is where the mark sits between the stop and
   the target, and what the move is worth in R right now. Showing a filled
   position "how far to fill" is the kind of incoherent card this tab exists to
   avoid; it was on screen until the live page was actually read. */
function ogOpenRead(setup, px){
  var p = (px === null || px === undefined || px === '') ? NaN : +px;
  if (!setup || !isFinite(p)) return null;
  var entry = +setup.entry, stop = +setup.stop, t1 = +setup.t1, risk = +setup.risk;
  if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) || !(risk > 0)) return null;
  var long = setup.dir === 'long';
  return {
    unrealR: (long ? (p - entry) : (entry - p)) / risk,
    toStopR: Math.abs(p - stop) / risk,
    toTargetR: Math.abs(t1 - p) / risk,
    /* States are resolved on CLOSED bars, so the live mark can already sit past
       a barrier the walk has not registered yet. Say that plainly instead of
       printing a distance to a level price has gone through. */
    beyondStop: long ? (p <= stop) : (p >= stop),
    beyondTarget: long ? (p >= t1) : (p <= t1),
  };
}

/* THE SETUP THAT HAS NOT FIRED YET — and the only thing this rule ever has
   near the current price.

   A retracement limit is placed BEHIND a break, so the further price travels
   after breaking, the further its entry falls behind: that is the strategy
   working as designed, not a defect, and no amount of ranking makes a stale
   limit reachable. What IS near the mark, always, is the structure price is
   currently trading inside. This reports it: the confirmed resistance and
   support as of the LAST CLOSED BAR, the close that would arm a setup in each
   direction, and the exact order that break would place.

   It uses the same causal clock as ogSignals — a swing is invisible until
   confirmedAt bars have closed — so the levels here are the ones the rule will
   actually use on the next bar. Nothing is a signal until price closes through
   a level; the panel says "not armed" and means it. */
function ogPending(rows, opts){
  rows = rows || []; opts = opts || {};
  var len = Math.max(1, Math.floor(opts.swingLength || 5));
  var atrP = Math.max(2, Math.floor(opts.atrPeriod || 14));
  var stopMult = (opts.stopAtr != null) ? +opts.stopAtr : 1.5;
  var rr = (opts.rr != null) ? +opts.rr : 2;
  if (rows.length < atrP + len * 2 + 2) return null;

  var last = rows.length - 1;
  var atr = ogAtr(rows, atrP);
  var sw = ogSwings(rows, len);
  var res = null, sup = null, i;
  /* only swings confirmed by the last closed bar — the same guard as ogSignals */
  for (i = 0; i < sw.length; i++){
    if (sw[i].confirmedAt > last) break;
    if (sw[i].kind === 'high') res = sw[i].px; else sup = sw[i].px;
  }
  var a = atr[last], cur = +rows[last].c;
  if (res == null || sup == null || !(res > sup) || !isFinite(a) || !(a > 0) || !isFinite(cur)) return null;

  var eq = (res + sup) / 2;
  function plan(dir){
    var stop = dir === 'long' ? (sup - stopMult * a) : (res + stopMult * a);
    var risk = dir === 'long' ? (eq - stop) : (stop - eq);
    if (!(risk > 0)) return null;
    var trigger = dir === 'long' ? res : sup;
    return { dir: dir, trigger: trigger, entry: eq, stop: stop, risk: risk,
             t1: dir === 'long' ? (eq + rr * risk) : (eq - rr * risk), rr: rr,
             /* distance from the mark to the TRIGGER, which is the number that
                matters here — the entry is only reachable once the break happens */
             toTrigger: Math.abs(cur - trigger), toTriggerAtr: Math.abs(cur - trigger) / a,
             /* has price already closed through it? then this side is not pending,
                it has fired, and ogSignals owns it */
             already: dir === 'long' ? (cur > trigger) : (cur < trigger) };
  }
  return { res: res, sup: sup, eq: eq, atr: a, mark: cur, inside: (cur <= res && cur >= sup),
           long: plan('long'), short: plan('short') };
}

/* What this setup is worth IF TAKEN NOW, at the mark, instead of at its planned
   limit. The plan's 2R is the R:R of an order that filled at the 50% level; once
   price has run past that level the plan's numbers describe a trade nobody can
   still take. The stop and target do not move - they are structural - so the
   honest quote at the current price is simply both distances measured from the
   mark. It is usually much worse than 2R, and saying so is the point. */
function ogAtMark(s, px){
  var p = (px === null || px === undefined || px === '') ? NaN : +px;
  if (!s || !isFinite(p)) return null;
  var stop = +s.stop, t1 = +s.t1;
  if (!isFinite(stop) || !isFinite(t1)) return null;
  var long = s.dir === 'long';
  /* past either barrier there is no trade left to quote */
  if (long ? (p <= stop || p >= t1) : (p >= stop || p <= t1)) return null;
  var risk = Math.abs(p - stop), reward = Math.abs(t1 - p);
  if (!(risk > 0)) return null;
  return { entry: p, risk: risk, reward: reward, rr: reward / risk,
           /* gambler's ruin from HERE, the same driftless model used elsewhere */
           odds: risk / (risk + reward) };
}

/* ---------- how likely, and on what grounds ----------

   READ THIS BEFORE TRUSTING THE NUMBER. There is no forward evidence for this
   rule yet, so no win rate here is MEASURED. What ogProb returns is an estimate
   under an explicitly stated model - a driftless random walk with per-bar scale
   equal to ATR - and nothing more. The method is written down because the
   alternative, sorting cards under a "most probable" heading with no method
   stated, is worse: it looks like evidence and it is not.

   Two cases, two textbook results:

   RUNNING (already filled). Gambler's ruin on a driftless walk between two
   absorbing barriers: P(target first) = distToStop / (distToStop + distToTarget),
   both in R. A position that has drifted toward its stop has less room left on
   that side and scores lower, which is the ordering a trader actually wants.

   RESTING (unfilled limit). Two steps, independent under the model:
     P(fill)     - reflection principle, the chance a driftless walk covers the
                   distance d within n bars: 2 * (1 - PHI(d / (sigma * sqrt(n)))),
                   with sigma taken as one ATR per bar.
     P(win|fill) - gambler's ruin FROM the entry, where the stop is 1R away and
                   the target rr R away: 1 / (1 + rr).
   Their product is the unconditional chance the order fills AND then pays.

   The model's defects are known and they do not cancel: gold is not driftless,
   ATR understates tail moves, and OHLC cannot order two touches inside one bar.
   Read the number as a RANKING KEY WITH AN ARGUMENT BEHIND IT, not as a
   probability anyone should size a position on. */

/* standard normal CDF - Abramowitz & Stegun 7.1.26 on erf, |error| < 1.5e-7 */
function ogNormCdf(z){
  if (!isFinite(z)) return z > 0 ? 1 : 0;
  var x = z / Math.SQRT2, sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  var t = 1 / (1 + 0.3275911 * x);
  var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function ogProb(s, px){
  var p = (px === null || px === undefined || px === '') ? NaN : +px;
  if (!s || !isFinite(p)) return null;
  var rr = (+s.rr > 0) ? +s.rr : 2;

  if (s.state === 'open'){
    var op = ogOpenRead(s, p);
    if (!op) return null;
    if (op.beyondTarget) return { p: 1, kind: 'running', fill: 1, cond: 1, note: 'the mark is already at or past the target' };
    if (op.beyondStop) return { p: 0, kind: 'running', fill: 1, cond: 0, note: 'the mark is already at or past the stop' };
    var den = op.toStopR + op.toTargetR;
    if (!(den > 0)) return null;
    var cond = op.toStopR / den;
    return { p: cond, kind: 'running', fill: 1, cond: cond,
             note: 'already filled — gambler\'s ruin between the stop and the target from where the mark sits' };
  }

  if (s.state !== 'waiting') return null;
  var d = ogDistance(s, p);
  if (!d || d.atr == null || !isFinite(d.atr)) return null;
  /* n <= 0 means no bars remain before expiry, so the order cannot fill at all */
  var n = Math.floor(+s.barsLeft);
  if (!isFinite(n) || n <= 0) return { p: 0, kind: 'resting', fill: 0, cond: 1 / (1 + rr), note: 'no bars left before this order expires' };
  var z = d.atr / Math.sqrt(n);
  var fill = 2 * (1 - ogNormCdf(z));
  if (!(fill > 0)) fill = 0;
  if (fill > 1) fill = 1;
  var condR = 1 / (1 + rr);
  return { p: fill * condR, kind: 'resting', fill: fill, cond: condR,
           note: 'about ' + Math.round(fill * 100) + '% chance the mark reaches the limit within ' + n
                 + ' bar(s), times the ' + Math.round(condR * 100) + '% odds from entry at ' + rr + 'R' };
}

/* CAN I ACT ON THIS, AT THIS PRICE, RIGHT NOW? Distance alone does not answer
   that, and neither do the odds: a position 120 points past its entry scores
   high precisely BECAUSE it has already run, which is the opposite of useful.
   Two different questions, one per state:

     a resting limit  - is the entry close enough that placing the order means
                        something? Measured in ATR so the lanes compare fairly,
                        and it must still have bars left to fill in.
     a running position - you missed the planned entry, so the only question is
                        whether joining AT THE MARK is still worth it. Risking
                        more than you stand to make is not, however high the
                        odds: those two always trade off.

   Both thresholds are judgement, not measurement, and are named on screen. */
var REACH_ATR = 2.0;   /* a limit further than this is not an order you place now */
var MIN_RR_NOW = 1.0;  /* never risk more than the trade can pay, at any odds */

function ogReach(s, px){
  if (!s) return null;
  if (s.state === 'waiting'){
    var d = ogDistance(s, px);
    if (!d || d.atr == null || !isFinite(d.atr)) return { ok: false, why: 'distance not computable' };
    var n = Math.floor(+s.barsLeft);
    if (!isFinite(n) || n <= 0) return { ok: false, why: 'expired before it could fill' };
    if (d.atr > REACH_ATR) return { ok: false, why: 'entry is ' + d.atr.toFixed(1) + '×ATR away — beyond the ' + REACH_ATR.toFixed(1) + '×ATR reach' };
    return { ok: true, why: 'limit sits ' + d.atr.toFixed(1) + '×ATR from the mark, within reach' };
  }
  if (s.state === 'open'){
    var am = ogAtMark(s, px);
    if (!am) return { ok: false, why: 'the mark is already past the stop or the target' };
    if (am.rr < MIN_RR_NOW) return { ok: false, why: 'joining at the mark pays only ' + am.rr.toFixed(2) + ':1 — it has already run' };
    return { ok: true, why: 'still worth joining at the mark: ' + am.rr.toFixed(2) + ':1 from here' };
  }
  return { ok: false, why: 'not live' };
}

/* The single best live setup in each of the two lanes the panel leads with.
   Deliberately ONE EACH and never "top two overall" - two scalps at the top
   would answer a different question than the one asked. A lane with nothing
   live yields null, and the header says so rather than quietly promoting the
   other lane's runner-up into a slot it was not picked for. */
function ogTopPicks(setups, px){
  var best = { scalp: null, swing: null };
  (setups || []).forEach(function(s){
    if (!s || (s.state !== 'waiting' && s.state !== 'open')) return;
    if (s.lane !== 'scalp' && s.lane !== 'swing') return;
    var e = ogProb(s, px);
    if (!e || !isFinite(e.p)) return;
    var reach = ogReach(s, px);
    var d = ogDistance(s, px);
    var cand = { setup: s, est: e, atMark: ogAtMark(s, px),
                 actionable: !!(reach && reach.ok), why: (reach && reach.why) || '',
                 distAtr: (d && d.atr != null && isFinite(d.atr)) ? d.atr : Infinity };
    var cur = best[s.lane];
    if (!cur || ogBetterPick(cand, cur)) best[s.lane] = cand;
  });
  return best;
}

/* ACTIONABLE ALWAYS OUTRANKS UNREACHABLE, whatever the odds say. This is the
   ordering the previous version got wrong: it sorted on the estimate alone, and
   the estimate rewards a position for having already moved. Within a group the
   nearer setup wins, and only then the better odds - "with the current price in
   mind" means proximity is the first question, not the last. */
function ogBetterPick(a, b){
  if (a.actionable !== b.actionable) return a.actionable;
  if (a.distAtr !== b.distAtr) return a.distAtr < b.distAtr;
  return a.est.p > b.est.p;
}

/* ---------- rendering ---------- */

function card(s, mark){
  var cls = s.dir === 'long' ? 'long' : 'short';
  var stateLabel = { waiting: 'WAITING — price has not retraced to entry',
                     open: 'FILLED — running',
                     target: 'TARGET reached',
                     stopped: 'STOPPED',
                     missed: 'MISSED — ran to target without filling',
                     expired: 'EXPIRED — the horizon ran out before stop or target' }[s.state] || s.state;
  var stateCls = s.state === 'target' ? 'ok' : (s.state === 'stopped' || s.state === 'missed' || s.state === 'expired') ? 'bad' : 'warn';
  var d = ogDistance(s, mark);
  var smcChip = '';
  try{ if (typeof W.hgSmcChipHtml === 'function') smcChip = W.hgSmcChipHtml(s) || ''; }catch(e){}

  /* The reading depends on whether the order has FILLED. A resting order is
     described by how far the mark is from its entry; a running position by
     where the mark sits between stop and target. Using the first for both puts
     "must fall to fill" on a position that filled hours ago. */
  var filled = (s.state === 'open');
  var op = filled ? ogOpenRead(s, mark) : null;
  var travel = '';
  if (filled && op){
    if (op.beyondTarget) travel = 'the mark is already at or past the target — the walk settles on closed bars and has not caught up';
    else if (op.beyondStop) travel = 'the mark is already at or past the stop — the walk settles on closed bars and has not caught up';
    else travel = 'running at ' + (op.unrealR >= 0 ? '+' : '') + fmt(op.unrealR, 2) + 'R · '
      + fmt(op.toStopR, 2) + 'R of room to the stop, ' + fmt(op.toTargetR, 2) + 'R left to the target';
  } else if (d && d.side !== 'at'){
    travel = 'price is ' + fmt(d.px) + ' ' + d.side + ' the entry — it must '
      + (s.dir === 'long' ? 'fall' : 'rise') + ' '
      + (d.atr != null ? fmt(d.atr, 1) + '×ATR' : fmt(d.pct, 2) + '%') + ' to fill';
  }

  return '<div class="card ' + cls + '">'
    + '<div class="chead"><span class="sym">XAUUSD</span>'
    + '<span class="stamp">' + esc(s.laneLabel || '') + '</span>'
    + '<span class="dir">' + (filled ? (s.dir === 'long' ? 'LONG — filled' : 'SHORT — filled')
                                     : (s.dir === 'long' ? 'BUY LIMIT' : 'SELL LIMIT')) + '</span></div>'
    + '<div class="row" style="gap:6px;margin:4px 0"><span class="stamp ' + stateCls + '">' + esc(stateLabel) + '</span>' + smcChip + '</div>'
    + '<div class="mini">'
    + (filled && op
        ? '<span class="k">unrealised</span><span><b>' + (op.unrealR >= 0 ? '+' : '') + fmt(op.unrealR, 2) + 'R</b></span>'
          + '<span class="k">room to stop</span><span>' + fmt(op.toStopR, 2) + 'R</span>'
          + '<span class="k">left to target</span><span>' + fmt(op.toTargetR, 2) + 'R</span>'
        : (d ? '<span class="k">distance to entry</span><span><b>' + (d.atr != null ? fmt(d.atr, 2) + '×ATR' : '—')
               + '</b> (' + fmt(d.pct, 2) + '% · ' + fmt(d.px) + ')</span>' : ''))
    + '<span class="k">entry (50% eq)</span><span>' + fmt(s.entry) + '</span>'
    + '<span class="k">stop</span><span>' + fmt(s.stop) + '</span>'
    + '<span class="k">target (' + fmt(s.rr, 1) + 'R)</span><span>' + fmt(s.t1) + '</span>'
    + '<span class="k">risk</span><span>' + fmt(s.risk) + '</span>'
    + '<span class="k">expires in</span><span>' + esc(String(s.horizonBars || '—')) + ' × ' + esc(String(s.interval || '')) + ' bars</span>'
    + '<span class="k">broken level</span><span>' + fmt(s.dir === 'long' ? s.res : s.sup) + '</span>'
    + '<span class="k">opposite level</span><span>' + fmt(s.dir === 'long' ? s.sup : s.res) + '</span>'
    + '</div>'
    + (travel ? '<div class="note" style="margin:4px 0">' + esc(travel) + '</div>' : '')
    + '<div class="plan">Break of structure at <b>' + fmt(s.brokeAt) + '</b>; the order rests at the midpoint '
    + 'of the broken range and is <b>not a market entry</b>. Stop is 1.5×ATR beyond the opposite structural level, '
    + 'so risk is roughly half the range plus the buffer — a wide stop by construction. '
    + 'R:R is fixed at ' + fmt(s.rr, 1) + ' by the rule, not measured.</div>'
    + '</div>';
}

function pickCard(pk, mark, badge){
  var s = pk.setup, est = pk.est;
  var pct = (est && isFinite(est.p)) ? Math.round(est.p * 100) + '%' : '—';
  var am = pk.atMark;

  /* the line that answers "this is far from the current price": what the same
     stop and target are worth if the trade is taken HERE instead */
  var quote = '';
  if (am){
    quote = '<div class="mini" style="margin:4px 0">'
      + '<span class="k">take it at the mark</span><span><b>' + fmt(am.entry) + '</b></span>'
      + '<span class="k">risk from here</span><span>' + fmt(am.risk) + '</span>'
      + '<span class="k">reward from here</span><span>' + fmt(am.reward) + '</span>'
      + '<span class="k">R:R from here</span><span><b>' + fmt(am.rr, 2) + ':1</b>'
      + (am.rr < MIN_RR_NOW ? ' — worse than 1:1, the plan\'s ' + fmt(s.rr, 1) + 'R is gone' : '') + '</span>'
      + '</div>';
  } else {
    quote = '<div class="note" style="margin:4px 0">No trade left to quote at the mark — price is already past the stop or the target.</div>';
  }

  return '<div style="border:1px solid var(--line,#333);border-radius:8px;padding:6px">'
    + '<div class="row" style="gap:8px;align-items:baseline;margin-bottom:4px">'
    + '<span class="statuschip ' + (pk.actionable ? 'ok' : 'warn') + '">' + esc(badge) + '</span>'
    + '<span class="statuschip ' + (pk.actionable ? 'ok' : 'bad') + '">'
    + (pk.actionable ? 'ACTIONABLE NOW' : 'OUT OF REACH') + '</span>'
    + '<span style="font-size:18px;font-weight:700">' + pct + '</span>'
    + '<span class="note">estimated, under the model stated below</span></div>'
    + (pk.why ? '<div class="note' + (pk.actionable ? '' : ' warn') + '" style="margin-bottom:4px">' + esc(pk.why) + '</div>' : '')
    + (est && est.note ? '<div class="note" style="margin-bottom:4px">' + esc(est.note) + '</div>' : '')
    + quote
    + card(s, mark)
    + '</div>';
}

function render(ui, lanes, mark, note){
  if (!ui || !ui.body) return;
  var all = [];
  lanes.forEach(function(L){ all = all.concat(L.setups || []); });
  var live = all.filter(function(s){ return s.state === 'waiting' || s.state === 'open'; });
  var settled = all.filter(function(s){ return s.state === 'target' || s.state === 'stopped'; });
  var missed = all.filter(function(s){ return s.state === 'missed'; });
  var expired = all.filter(function(s){ return s.state === 'expired'; });
  var wins = settled.filter(function(s){ return s.state === 'target'; }).length;

  /* RUNNING and RESTING are different questions and must not share a list.
     A filled position is judged by where the mark sits between its stop and
     target; a resting order by how far the mark is from its entry. Sorting them
     together on distance-to-entry ranks a position that filled hours ago as if
     it were still waiting. */
  var running = live.filter(function(s){ return s.state === 'open'; });
  var resting = live.filter(function(s){ return s.state === 'waiting'; });

  /* running: closest to resolution first — least room left to stop or target */
  running.sort(function(a, b){
    var oa = ogOpenRead(a, mark), ob = ogOpenRead(b, mark);
    var xa = oa ? Math.min(oa.toStopR, oa.toTargetR) : Infinity;
    var xb = ob ? Math.min(ob.toStopR, ob.toTargetR) : Infinity;
    return xa - xb;
  });

  /* resting: NEAREST FIRST — the ordering that respects "with the current price
     in mind". An order 0.3×ATR from the mark is actionable; one 6×ATR away is
     decoration, and burying the first under the second by recency would be
     useless. Sorted on ATR rather than percent so the three lanes compare
     fairly; anything without a usable ATR sinks last rather than sorting as 0. */
  resting.sort(function(a, b){
    var da = ogDistance(a, mark), db = ogDistance(b, mark);
    var xa = (da && da.atr != null) ? da.atr : Infinity;
    var xb = (db && db.atr != null) ? db.atr : Infinity;
    return xa - xb;
  });

  /* the two picks the panel leads with, removed from the lists below so the
     same card never appears twice under two different orderings */
  var picks = ogTopPicks(live, mark);
  var pickSet = [];
  ['scalp', 'swing'].forEach(function(k){ if (picks[k]) pickSet.push(picks[k].setup); });
  var notPicked = function(s){ return pickSet.indexOf(s) === -1; };
  running = running.filter(notPicked);
  resting = resting.filter(notPicked);

  var h = '';

  /* the mark, first and largest — every distance below is measured from it */
  h += '<div class="row" style="align-items:baseline;gap:10px;margin-bottom:6px">'
    + '<span style="font-size:20px;font-weight:700">' + fmt(mark) + '</span>'
    + '<span class="note">XAUUSD live mark · every distance below is measured from this</span>'
    + '</div>';

  h += '<div class="note" style="margin-bottom:8px">' + esc(note || '') + '</div>';

  h += '<div class="note warn" style="margin-bottom:10px">'
    + 'Swings are confirmed <b>5 bars after they print</b>, never centred on them. The rule as originally '
    + 'written read future bars to place its levels; this does not, which is why it fires later and less often. '
    + 'All three lanes run the <b>identical</b> rule — only timeframe and expiry differ, so nothing here is '
    + 'per-lane fitted. <b>No forward evidence yet</b>: this is rule output, not a measured edge.'
    + '</div>';

  /* TOP PICKS - one scalp, one swing, ranked by a STATED estimate. The method
     note under them is not decoration: a "most probable" heading with nothing
     behind it reads as measured evidence, and none of this is measured. */
  h += '<h3 style="font-size:12px;margin:10px 0 6px">TOP PICKS — best live setup in each lane, by estimated odds</h3>';
  h += '<div class="cards">';
  ['scalp', 'swing'].forEach(function(k){
    var pk = picks[k];
    if (!pk){
      h += '<div class="card"><div class="chead"><span class="sym">XAUUSD</span>'
        + '<span class="stamp">' + (k === 'scalp' ? 'SCALP 15m' : 'SWING 4h') + '</span></div>'
        + '<div class="note">Nothing live in this lane — an empty slot rather than a setup promoted from another timeframe.</div></div>';
      return;
    }
    h += pickCard(pk, mark, k === 'scalp' ? 'BEST SCALP' : 'BEST SWING');
  });
  h += '</div>';
  h += '<div class="note warn" style="margin:6px 0 12px">'
    + 'These odds are a <b>model, not a measurement</b>: a driftless random walk with per-bar scale equal to ATR. '
    + 'A filled position uses gambler\'s ruin between its stop and target; a resting limit uses the reflection-principle '
    + 'chance of reaching the entry before expiry, times the 33% odds from entry at 2R. Gold is not driftless and ATR '
    + 'understates tails, so read these as a ranking key with an argument behind it — not as a win rate.'
    + '<br>A pick is <b>ACTIONABLE</b> only if you can still do something about it at ' + fmt(mark) + ': a resting limit '
    + 'within ' + REACH_ATR.toFixed(1) + '×ATR that still has bars left to fill, or a running position that pays at least '
    + MIN_RR_NOW.toFixed(1) + ':1 joined at the mark. Anything else is shown badged OUT OF REACH rather than hidden — '
    + 'the rule found it, but price has left it behind.'
    + '</div>';

  h += '<div class="row" style="gap:14px;margin-bottom:10px;flex-wrap:wrap">'
    + '<span class="statuschip">live <b>' + live.length + '</b></span>'
    + '<span class="statuschip">settled <b>' + settled.length + '</b></span>'
    + '<span class="statuschip">hit target <b>' + wins + '</b></span>'
    + '<span class="statuschip">never filled <b>' + missed.length + '</b></span>'
    + '<span class="statuschip">expired <b>' + expired.length + '</b></span>'
    + '</div>';

  /* WHAT IS ACTUALLY NEAR THE PRICE. When every limit the rule has placed is
     out of reach, this is the honest answer to "show me something near the
     mark": the structure price is trading inside right now, and the close that
     would arm the next setup. It is not a signal and is labelled as one. */
  var pend = {};
  lanes.forEach(function(L){ if (L.pending) pend[L.cfg.key] = { p: L.pending, cfg: L.cfg }; });
  if (pend.scalp || pend.swing){
    h += '<h3 style="font-size:12px;margin:14px 0 6px">NEXT TO ARM — current structure, and the close that would trigger a setup</h3>';
    h += '<div class="cards">';
    ['scalp', 'swing'].forEach(function(k){
      var e = pend[k];
      if (!e){
        h += '<div class="card"><div class="chead"><span class="sym">XAUUSD</span>'
          + '<span class="stamp">' + esc(k.toUpperCase()) + '</span></div>'
          + '<div class="note">No confirmed structure on this lane yet — not enough closed bars since the last swing.</div></div>';
        return;
      }
      var P = e.p;
      h += '<div class="card"><div class="chead"><span class="sym">XAUUSD</span>'
        + '<span class="stamp">' + esc(e.cfg.label) + ' ' + esc(e.cfg.interval) + '</span>'
        + '<span class="dir">' + (P.inside ? 'INSIDE THE RANGE' : 'OUTSIDE — a break has already happened') + '</span></div>'
        + '<div class="mini">'
        + '<span class="k">resistance</span><span>' + fmt(P.res) + '</span>'
        + '<span class="k">support</span><span>' + fmt(P.sup) + '</span>'
        + '<span class="k">50% equilibrium</span><span><b>' + fmt(P.eq) + '</b></span>'
        + '<span class="k">ATR</span><span>' + fmt(P.atr) + '</span>'
        + '</div>';
      [P.long, P.short].forEach(function(pl){
        if (!pl) return;
        h += '<div class="note" style="margin:4px 0">'
          + '<b>' + (pl.dir === 'long' ? 'LONG' : 'SHORT') + '</b> arms on a close '
          + (pl.dir === 'long' ? 'above ' : 'below ') + '<b>' + fmt(pl.trigger) + '</b> — '
          + (pl.already ? 'price is already through it, so this side has fired and is listed above'
                        : fmt(pl.toTrigger) + ' away (' + fmt(pl.toTriggerAtr, 1) + '×ATR)')
          + '. It would then rest a limit at ' + fmt(pl.entry) + ', stop ' + fmt(pl.stop)
          + ', target ' + fmt(pl.t1) + '.'
          + '</div>';
      });
      h += '</div>';
    });
    h += '</div>';
    h += '<div class="note warn" style="margin:6px 0 12px">Nothing here is a setup. These are the levels the rule is '
      + 'watching on the last closed bar, shown because a retracement limit is placed <b>behind</b> a break — so once '
      + 'price runs, the entry is behind it by construction and no ranking can bring it closer. The trigger is the part '
      + 'that sits near the mark.</div>';
  }

  /* per-lane status, including lanes whose feed failed — a silent missing lane
     would read as "no setups on 4h" when it means "4h never loaded" */
  h += '<div class="row" style="gap:10px;margin-bottom:12px;flex-wrap:wrap">';
  lanes.forEach(function(L){
    var lv = (L.setups || []).filter(function(s){ return s.state === 'waiting' || s.state === 'open'; }).length;
    var cls = L.err ? 'bad' : 'ok';
    h += '<span class="statuschip ' + cls + '">' + esc(L.cfg.label) + ' ' + esc(L.cfg.interval) + ' — '
      + (L.err ? esc(L.err) : lv + ' live · ' + (L.rows ? L.rows.length : 0) + ' bars') + '</span>';
  });
  h += '</div>';

  if (!all.length){
    h += '<div class="note">No break of structure in any lane. With a 5-bar swing window and an honest '
      + 'confirmation lag this is normal on a quiet tape — the rule is waiting, not broken.</div>';
  } else {
    if (running.length){
      h += '<h3 style="font-size:12px;margin:10px 0 6px">RUNNING — already filled, closest to resolution first</h3><div class="cards">';
      running.slice(0, 6).forEach(function(s){ h += card(s, mark); });
      h += '</div>';
      if (running.length > 6) h += '<div class="note">' + (running.length - 6) + ' further running position(s) not shown.</div>';
    }
    if (resting.length){
      h += '<h3 style="font-size:12px;margin:14px 0 6px">RESTING — unfilled limits, nearest to the mark first</h3><div class="cards">';
      resting.slice(0, 6).forEach(function(s){ h += card(s, mark); });
      h += '</div>';
      if (resting.length > 6) h += '<div class="note">' + (resting.length - 6) + ' further resting order(s) hidden — they sit further from the mark.</div>';
    }
    if (!running.length && !resting.length){
      h += '<div class="note">Nothing live: every break in the window has already filled and resolved, or expired unfilled.</div>';
    }
    if (settled.length){
      h += '<h3 style="font-size:12px;margin:14px 0 6px">SETTLED — what the rule would have done</h3><div class="cards">';
      settled.slice(-6).reverse().forEach(function(s){ h += card(s, mark); });
      h += '</div>';
      h += '<div class="note" style="margin-top:8px">Settled counts are in-sample over the fetched window only — '
        + 'the same bars the levels were derived from. Read them as a description of the rule, not as evidence it pays. '
        + 'Forward records are written per lane so each timeframe can be judged separately later.</div>';
    }
  }
  ui.body.innerHTML = h;
}

/* ---------- scan ---------- */

async function runOptiGold(ui){
  if (__og.busy) return 'busy';
  __og.busy = true;
  try{
    var ggc = (typeof W.getGoldCandles === 'function') ? W.getGoldCandles : null;
    if (!ggc) throw new Error('getGoldCandles unavailable — gold feed not loaded');

    var lanes = [], i, markLane = null;
    for (i = 0; i < LANES.length; i++){
      var L = LANES[i];
      if (ui && ui.stat) ui.stat.textContent = 'fetching ' + L.label + ' (' + L.interval + ')…';
      var got = null, err = null;
      try{ got = await ggc(L.interval, L.bars); }
      catch(eF){ err = (eF && eF.message) || String(eF); }
      var rows = (got && got.rows) ? got.rows : [];
      /* a lane that fails is REPORTED, not dropped — a silently missing lane
         reads as "no setups on 4h" when it means "4h never loaded" */
      if (!rows.length){
        lanes.push({ cfg: L, rows: [], setups: [], err: err || ('no ' + L.interval + ' candles') });
        continue;
      }
      var setups = ogSignals(rows, L);
      setups.forEach(function(s){
        s.lane = L.key; s.laneLabel = L.label; s.interval = L.interval;
        s.horizonBars = L.horizonBars; s.sym = 'XAUUSD';
      });
      lanes.push({ cfg: L, rows: rows, setups: setups, src: (got && got.source) || 'gold',
                   pending: ogPending(rows, L) });

      /* SMC context on the live ones — the chip only, never a gate */
      try{
        if (typeof W.hgSmcEnrich === 'function'){
          setups.forEach(function(s){
            if (s.state === 'waiting' || s.state === 'open'){
              W.hgSmcEnrich(s, { rows: rows.slice(0, s.i + 1), tab: 'OPTI GOLD' });
            }
          });
        }
      }catch(eSmc){}

      /* forward log PER LANE, with the lane in the mechanic. Pooling all three
         into one bucket would make it impossible to ask the question that
         matters — whether the same rule pays differently at different scales. */
      try{
        if (typeof W.hgFwdRecordScan === 'function'){
          var fwd = ogFwdRows(setups, L.key);
          if (fwd.length) W.hgFwdRecordScan('OPTI GOLD', L.interval, fwd, { horizonBars: L.horizonBars });
        }
      }catch(eFwd){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('optigold', eFwd); }catch(eW){} }
    }

    /* THE MARK: the last close of the shortest lane that loaded — the freshest
       price this tab can honestly claim. It is a closed-bar close, not a tick,
       and the note says so rather than implying a live quote. */
    for (i = 0; i < lanes.length; i++){
      if (lanes[i].rows && lanes[i].rows.length){ markLane = lanes[i]; break; }
    }
    if (!markLane) throw new Error('no gold candles on any lane — feed unavailable');
    var mark = +markLane.rows[markLane.rows.length - 1].c;

    var total = lanes.reduce(function(n, L){ return n + (L.setups ? L.setups.length : 0); }, 0);
    __og.last = { at: Date.now(), mark: mark, lanes: lanes, setups: [].concat.apply([], lanes.map(function(L){ return L.setups || []; })) };

    var note = 'mark is the last closed ' + markLane.cfg.interval + ' bar from ' + esc(String(markLane.src || 'gold'))
      + ' · same rule on every lane: swing 5 · ATR 14 · stop 1.5×ATR · target 2R'
      + ' · ' + total + ' setup(s) across ' + lanes.length + ' lanes'
      + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC';
    render(ui, lanes, mark, note);
    if (ui && ui.stat) ui.stat.textContent = total + ' setup(s) · mark ' + fmt(mark);
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
function ogFwdRows(setups, lane){
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
    /* the LANE is part of the mechanic, so the forward log can answer whether
       the same rule pays differently at 15m, 1h and 4h. One pooled bucket
       would average that question away before it could be asked. */
    var laneKey = String(lane || s.lane || 'na').toUpperCase();
    out.push({ sym: 'XAUUSD', dir: s.dir, entry: en, stop: st, t1: tp,
               mechanic: ('BOS-RETRACE-' + laneKey + '-' + (s.dir === 'long' ? 'LONG' : 'SHORT')).slice(0, 28),
               ticket: false });   /* never a ticket: unmeasured rule, by design */
  }
  return out;
}

function mountOptiGold(el){
  if (!el) return;
  el.innerHTML = '<div class="panel"><h2>OPTI GOLD <span>break of structure → 50% retracement limit · scalp / intraday / swing · causal swings</span></h2>'
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

__og.lanes = LANES;

function optiGoldState(){ return __og.last || null; }

W.optiGoldState = optiGoldState;
W.__ogLanes = LANES;
W.__ogDistance = ogDistance;
W.__ogOpenRead = ogOpenRead;
W.__ogProb = ogProb;
W.__ogNormCdf = ogNormCdf;
W.__ogTopPicks = ogTopPicks;
W.__ogAtMark = ogAtMark;
W.__ogReach = ogReach;
W.__ogPending = ogPending;
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
