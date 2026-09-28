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

hg-v1005: the desk answers to the FUNDAMENTAL STACK (fundamental-stack.js).
Every lane's setups pass the shared scan gate before the board and the picks
are computed: a red-folder blackout refuses (and, refusing every directional
setup, leaves BOTH pick slots empty with the reason named) and a 2+-net-vote
headwind demotes — a demoted or refused setup never takes a BEST SCALP /
BEST SWING slot (ogTopPicks skips it) but still renders in its lane, chipped
with the stack's verdict. The full gold board panel renders above the board.

hg-v1006: the break itself now answers to a CONFIRMATION FLOOR. Until this
pack a bare close through a swing level could take a TOP PICK slot with no
cross-family evidence behind it — every other gold desk crowns only with
agreement from independent families, and this one crowned on structure alone.
Each setup is now read against three independent families on its OWN lane's
tape, sliced at the break bar so nothing after the signal informs the read
(ogConfirmRead): VOLUME participation (volZ over 20 bars at the house's 0.5,
engine.js's number, not a new fit), MOMENTUM (RSI-14 past the 50 midline and
sloping with the break over 3 bars, engine.js's span; a break into an
exhausted RSI does not confirm), and the PREVAILING TREND (the close beyond
EMA-50 with EMA-50 sloping the same way, the higher-horizon read the lane's
own tape carries). At least TWO of the CHECKED families must back the break
or it is UNCONFIRMED: it still renders in its lane with the evidence named,
but ogTopPicks never hands it a BEST SCALP / BEST SWING slot — the same
exclusion route the v1005 stack verdict takes. A family that cannot be read
(no volume leg on the tape, an EMA-50 not warmed up) is UNCHECKED — it
neither confirms nor vetoes — and when fewer than two families can even be
checked the setup is UNVERIFIED and stays eligible: the floor bites only
where evidence exists to judge. The rule is unchanged; what changed is which
setups the panel may LEAD with. The verdict is written into the forward
ledger with each order, so whether CONFIRMED breaks actually pay better is a
question the book will answer on evidence rather than one this desk asserts.

hg-v1007: the desk answers to the HOUSE REGIME (regime-stack.js) — one shared
read of what the 4h gold tape is DOING, so a breakout rule stops leading with
breaks in weather where breaks fade. The swing lane's own 4h rows feed
hgGoldRegime (no extra fetch — the 4h tape is already here): detectRegime's
structure read owns volatility and compression, the trend state uses
detectRegime's own ADX bar (30) with direction from the close beyond EMA-50
with EMA-50 sloping the same way. hgRegimePosture maps desk style x regime x
the setup's direction: a with-trend break is FAVORED, a break against the
trend or into a volatility expansion is CAUTION (informed, never barred), and
a break in a RANGING or COMPRESSED 4h tape is AGAINST — the population where
breaks fade — and never takes a BEST SCALP / BEST SWING slot (ogRegimeBlocked,
beside the v1005 and v1006 exclusions; the setup still renders, chipped, with
the reason named). The posture rides the forward ledger as row.regime so the
book can later measure whether regime-aligned breaks pay better — on evidence,
not assertion. An unreadable regime (thin tape, absent library, a failed swing
lane) bars nothing and says so once, on the panel above the board.

hg-v1009: the confirmation floor grows its fourth and fifth families — VWAP
and CVD — and both arrive with the independence the floor's logic requires.
FAMILY 4, VWAP (indicators.js's vwapAt / vwapReclaim, unused on gold until
now): the break bar must HOLD the volume-weighted mean — the close beyond the
rolling VWAP-20 on the break's side. The STATE read, deliberately, not the
reclaim event: counting "no reclaim printed" as a failure would penalise
exactly the strong trend breaks that never pierce the mean, and when a
reclaim DID print the note says so — the mean probed and defended is the
stronger form of the same evidence. FAMILY 5, CVD (omniroute.js's hgOmniCvd),
REAL Binance taker flow only: the candle-approximated stand-in is derived
from the same closes the momentum family already reads, so it is not
independent evidence and does not count. The taker series is fetched per
lane — only where the lane's own feed is a Binance gold perp ('binance-xau'
/ 'binance-paxg' -> XAUUSDT / PAXGUSDT) — and sliced at the break bar before
the read, so a break 200 bars back is judged on the flow that existed THEN.
The bar stays exactly where v1006 put it: at least TWO CHECKED families must
back the break. What widened is the evidence, not the threshold — with five
families an UNCONFIRMED verdict now means broader checked disagreement than
it did with three, and a volume-less feed (Twelve Data / Yahoo) checks
neither new family, degrading exactly as it did. The verdict enum is
unchanged, so every stored ledger row still groups with the new ones.
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
    /* hg-v950: did this break print while GOLD WAS SHUT? Stamped PER SETUP
       from the setup's own bar, because this rule walks 400-600 bars and
       emits breaks from across that whole window: a scan-level "is it the
       weekend now" would judge a Tuesday break by Saturday's clock. Null
       when the calendar cannot be read, and then nothing changes. */
    s.goldShut = ogWeekendVerdict(rows[t].t);
    /* hg-v965: and the OTHER gold calendar, read on the SAME instant
       expression as the weekend line above -- a tier-1 CPI / NFP / FOMC / GDP
       window bars NEW minting exactly as the weekend does, and two reads of
       two calendars at two different instants is the drift hg-v964 removed by
       construction. There is deliberately NO wrapper here: the "null unless
       it locks" rule lives once, in hgGoldNewsMark, because this file's
       weekend wrapper is byte-identical to two others and a third pair would
       be six copies of one rule (hg-v949). This line is a lookup guard and
       nothing else. Null when gold-formation.js is absent, and then nothing
       changes. */
    s.newsLock = (typeof W.hgGoldNewsMark === 'function') ? W.hgGoldNewsMark(rows[t].t) : null;
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

/* hg-v950: the shared gold calendar, resolved at call time, never re-derived
   here. Null when gold-formation.js is absent or the instant is unreadable,
   and the caller then changes nothing — a calendar this tab cannot read is
   not a reason to withhold a setup. */
function ogWeekendVerdict(tSec){
  try{
    var f = W.hgGoldWeekendVerdict;
    if (typeof f !== 'function') return null;
    var t = fin(tSec);
    if (t === null) return null;
    var v = f(t);
    return (v && v.inWeekend === true) ? v : null;
  }catch(e){ return null; }
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

   hg-v948: THAT SECOND STEP HAD NO HORIZON IN IT, AND EVERY SETUP HERE EXPIRES.
   Gambler's ruin between two absorbing barriers is the INFINITE-horizon answer:
   it is the chance the target is reached before the stop GIVEN that one of them
   is reached at all. These setups die at horizonBars whether or not either was.
   So 1/(1+rr) is an UPPER BOUND on P(win|fill), never its value -- and the leg
   was also blind to HOW FAR the target is: a target 20xATR away and one 0.5xATR
   away both scored 0.333, while the fill leg beside it has been distance- and
   horizon-aware since it was written. One estimator was applied to one leg and
   omitted from the other.

   The direction of the error needs no measurement, only arithmetic: the target
   sits rr R away and the stop 1R, so truncating at a finite horizon removes
   winners at least as readily as losers, and the bound can only be too high.
   The repo's one real gold book quantifies it (OMNIGOLD, 9,897 plans at the
   same 2R): at a 16-bar horizon winners are censored more than losers in 4 of 4
   disjoint windows (30.1/22.0, 30.8/23.3, 26.7/22.7, 24.3/17.3 per cent), but
   at 32 and 48 bars it is 3 of 4 -- NOT unanimous. So the sign is arithmetic and
   the MAGNITUDE carries no verdict; no number from that walk is baked here or
   gated on, and that population is OMNIGOLD's gates, not this rule's.

   The fix is the file's OWN estimator on both legs: P(win|fill) is now
   min(1/(1+rr), P(travel to the target within the bars that remain)), the same
   reflection-principle form the fill leg uses. It is a BOUND made of two
   bounds, so it can only LOWER the number -- no setup can be made to look
   better than this desk already claimed -- and where the horizon is ample it
   returns exactly 1/(1+rr) and nothing moves. Using the full remaining bars
   rather than those left after a fill is deliberate: it is the generous
   choice, which is what keeps it a bound.

   WHAT THIS CHANGE MAKES WORSE, SAID PLAINLY. The driftless assumption used to
   bite only the fill leg, over short distances where it is nearly harmless. The
   travel term applies it over LONG distances, which is exactly where a
   driftless model is least like gold: a 20xATR move in 40 bars is a routine
   trend and this model calls it a 0.16% event. So where the horizon binds, the
   LEVEL is a bound and may sit far below the truth, and it must not be read as
   a forecast. What survives that objection is the ORDERING, which is the only
   thing this number is used for: between two setups that fill, the one whose
   target is reachable in the bars available is the better one under drift as
   well as without it. The infinite-horizon figure is kept on the row as
   condInf, so a reader always sees both numbers and the size of the gap rather
   than one number chosen for them.

   The model's other defects are known and they do not cancel: gold is not
   driftless, ATR understates tail moves, and OHLC cannot order two touches
   inside one bar. ATR is also used as the per-bar sigma while ATR runs ABOVE
   close-to-close sigma, so the travel term is over-generous in that respect --
   in the direction that keeps this a bound. Read the number as a RANKING KEY
   WITH AN ARGUMENT BEHIND IT, and an upper one, not as a probability anyone
   should size a position on. */

/* standard normal CDF - Abramowitz & Stegun 7.1.26 on erf, |error| < 1.5e-7 */
function ogNormCdf(z){
  if (!isFinite(z)) return z > 0 ? 1 : 0;
  var x = z / Math.SQRT2, sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  var t = 1 / (1 + 0.3275911 * x);
  var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/* hg-v948: ONE travel estimator, used by BOTH legs. The chance a driftless walk
   with per-bar scale sigma=ATR covers `distAtr` ATR within `bars` bars, by the
   reflection principle -- the same form the fill leg has always used, stated
   once instead of written twice. Returns null when it cannot be computed, and
   the caller then falls back to the infinite-horizon value rather than
   inventing one: a missing horizon term must not invent a smaller number any
   more than it may invent a larger one. */
function ogTravelP(distAtr, bars){
  /* fin() on BOTH arguments, and the two failure modes are NOT the same value.
     `bars` absent means the horizon is unreadable -> null, fall back. `bars`
     read as <= 0 means the setup has genuinely run out -> 0. Coercing instead
     of reading makes an absent horizon say "expired", which is the +null===0
     trap a second time, in the other argument -- the file's existing guard on
     a running position with no recorded barsLeft is what caught it. */
  var dR = fin(distAtr), bR = fin(bars);
  if (dR === null || bR === null) return null;
  var d = dR, n = Math.floor(bR);
  if (!isFinite(d) || d < 0) return null;
  if (n <= 0) return 0;
  var v = 2 * (1 - ogNormCdf(d / Math.sqrt(n)));
  if (!isFinite(v)) return null;
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

/* The horizon-bounded P(win|fill). `condInf` is the infinite-horizon gambler's
   ruin this desk quoted alone until hg-v948; `reach` is the chance the target
   is travelled to at all before the setup expires. The answer is the SMALLER --
   both are upper bounds on the same quantity, so their min is the tighter one,
   and it is still a bound rather than an estimate. */
function ogCondBound(condInf, distAtr, bars){
  var ci = +condInf;
  if (!isFinite(ci)) return null;
  var reach = ogTravelP(distAtr, bars);
  if (reach === null) return { cond: ci, reach: null, bounded: false };
  return { cond: Math.min(ci, reach), reach: reach, bounded: reach < ci };
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
    var condInfO = op.toStopR / den;
    /* hg-v948: a running position expires at the same horizon as a resting
       one, so its gambler's-ruin figure is an upper bound for the same reason.
       Distance to the target is measured from the MARK, which is where this
       position actually is. */
    var aO = fin(s.atr), t1O = fin(s.t1), nO = Math.floor(+s.barsLeft);
    var tAtrO = (aO !== null && aO > 0 && t1O !== null) ? Math.abs(t1O - p) / aO : NaN;
    var cbO = ogCondBound(condInfO, tAtrO, nO);
    if (!cbO) return null;
    var noteO = 'already filled — gambler\'s ruin between the stop and the target from where the mark sits';
    if (cbO.reach === null) noteO += '; ATR unreadable, so the travel-to-target term could not be computed and this is the infinite-horizon figure alone';
    else if (cbO.bounded) noteO += ', bounded down because the target is ' + tAtrO.toFixed(1) + '×ATR away with ' + nO + ' bar(s) left before it expires';
    else noteO += '; ' + nO + ' bar(s) left is ample for the ' + tAtrO.toFixed(1) + '×ATR still to travel, so the ruin figure binds';
    return { p: cbO.cond, kind: 'running', fill: 1, cond: cbO.cond,
             condInf: condInfO, reach: cbO.reach, horizonBound: !!cbO.bounded,
             targetAtr: isFinite(tAtrO) ? tAtrO : null, barsLeft: nO, note: noteO };
  }

  if (s.state !== 'waiting') return null;
  var d = ogDistance(s, p);
  if (!d || d.atr == null || !isFinite(d.atr)) return null;
  /* hg-v948: ABSENT and EXPIRED are not the same state, and `+undefined` made
     them one -- a setup whose barsLeft was never recorded read as "no bars
     left" and scored a confident zero. An unreadable horizon yields NO
     estimate, the same answer this function already gives when the distance
     cannot be computed; only a horizon that READS as zero or less is expired. */
  var nR = fin(s.barsLeft);
  if (nR === null) return null;
  var n = Math.floor(nR);
  if (n <= 0) return { p: 0, kind: 'resting', fill: 0, cond: 0,
    condInf: 1 / (1 + rr), reach: 0, horizonBound: true, targetAtr: null, barsLeft: 0,
    note: 'no bars left before this order expires — it can neither fill nor pay, so the bound is 0 rather than the '
          + Math.round(100 / (1 + rr)) + '% infinite-horizon figure' };
  var fill = ogTravelP(d.atr, n);
  if (fill === null) return null;
  /* hg-v948: the outcome leg gets the SAME horizon and the SAME distance the
     fill leg has always had. The target's distance is measured in ATR from the
     ENTRY, because that is where the trade starts once the limit fills. */
  var condInf = 1 / (1 + rr);
  /* fin() FIRST, then coerce. `+null` is 0 and isFinite(0) is true, so reading
     an absent t1 by coercion puts the target 575xATR from a $2300 entry and
     hands back a confident bound of 0 -- the trap this file's own header
     records being found five times, and the smoke check for this pack found a
     sixth. An unreadable leg yields NaN, ogTravelP returns null, and the bound
     falls back to the infinite-horizon figure with the reason said out loud. */
  var aR = fin(s.atr), t1R = fin(s.t1), enR = fin(s.entry);
  var tAtr = (aR !== null && aR > 0 && t1R !== null && enR !== null)
    ? Math.abs(t1R - enR) / aR : NaN;
  var cb = ogCondBound(condInf, tAtr, n);
  if (!cb) return null;
  var condR = cb.cond;
  var note = 'about ' + Math.round(fill * 100) + '% chance the mark reaches the limit within ' + n
           + ' bar(s), times an upper bound of ' + Math.round(condR * 100) + '% on paying from entry at ' + rr + 'R';
  if (cb.reach === null){
    note += ' — bound is the ' + Math.round(condInf * 100) + '% infinite-horizon figure alone; '
          + 'ATR unreadable, so the travel-to-target term could not be computed';
  } else if (cb.bounded){
    note += ' — the target is ' + tAtr.toFixed(1) + '×ATR away with ' + n + ' bar(s) left, so the '
          + 'horizon binds below the ' + Math.round(condInf * 100) + '% infinite-horizon figure this desk used to quote alone';
  } else {
    note += ' — ' + Math.round(condInf * 100) + '% is the binding bound here; the target is '
          + tAtr.toFixed(1) + '×ATR away and ' + n + ' bar(s) is ample for it';
  }
  return { p: fill * condR, kind: 'resting', fill: fill, cond: condR,
           condInf: condInf, reach: cb.reach, horizonBound: !!cb.bounded,
           targetAtr: isFinite(tAtr) ? tAtr : null, barsLeft: n, note: note };
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
  /* hg-v950: a break that printed while GOLD WAS SHUT is not an order you
     place. The structure it broke, and therefore the 50% equilibrium this
     setup rests at, were drawn on a bar XAUUSD never printed — it came from
     the 24/7 leg of the feed chain. The setup is NOT removed: it keeps its
     levels and its place in the list, and only its ACTIONABLE claim is
     withheld, which is the hg-v552/v572 rule. */
  if (s.goldShut){
    return { ok: false, why: 'GOLD WAS SHUT when this broke — '
      + String(s.goldShut.why || 'the bar printed inside the gold weekend')
      + ' The level came from the 24/7 leg of the feed chain, so it is not a level anyone traded.' };
  }
  /* hg-v965: the same withhold, for the other calendar. This desk's answer to
     the weekend is to keep the setup and remove only its ACTIONABLE claim
     (hg-v950), and a tier-1 news lock makes the same claim about the same
     instant -- that new minting is barred -- so it gets the same treatment
     rather than a new per-desk policy. ENTRY / STOP / T1 and the setup's place
     in the list are untouched. */
  if (s.newsLock){
    return { ok: false, why: 'TIER-1 GOLD NEWS LOCK — '
      + String(s.newsLock.why || 'this break printed inside a tier-1 gold news window')
      + ' The break itself stands and its levels are unchanged; what is withheld is the'
      + ' claim that it is actionable now.' };
  }
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

/* hg-v1005: the fundamental-stack seams. ogFundBlocked is the single
   predicate the pick loop reads; the chip renders the verdict the scan-time
   pass stamped; the panel is the same gold board every gold desk shows.
   All feature-checked — an absent stack blocks nothing and prints nothing. */
function ogFundBlocked(s){
  return !!(s && s.fundGate && (s.fundGate.refuse === true || s.fundGate.demote === true));
}
function ogFundChipHtml(s){
  try{
    var fn = (typeof W.hgFundamentalChipHtml === 'function') ? W.hgFundamentalChipHtml : null;
    var g = s && s.fundGate;
    if (!fn || !g || !Array.isArray(g.chips) || !g.chips.length) return '';
    return fn(g) || '';
  }catch(e){ return ''; }
}
function ogFundPanelHtml(){
  try{
    var rFn = (typeof W.hgFundamentalRegime === 'function') ? W.hgFundamentalRegime : null;
    var pFn = (typeof W.hgFundamentalPanelHtml === 'function') ? W.hgFundamentalPanelHtml : null;
    if (!rFn || !pFn) return '';
    return pFn(rFn('gold')) || '';
  }catch(e){ return ''; }
}

/* hg-v1006: THE CONFIRMATION FLOOR. The audit behind it: GOLDSCALP blends a
dozen detectors, GOLD SWING demands strictly more agreeing reads than
opposing ones, OMNIGOLD and OMNIGOLD1 demand a minimum of confirmation
classes, NEW GOLD demands three, and this desk demanded NOTHING — a close
through a swing level crowned itself. These are the three families every
breakout desk in the house already answers to, read on the lane's OWN rows
and sliced at the break bar (the hg-v950 per-shape rule: a 4h setup is
judged on 4h bars, never on the 15m tape, and never on a bar that had not
closed when the break printed).

   The thresholds are the house's own, reused rather than fitted here:
volZ(20) > 0.5 is engine.js's G2 participation floor and squeeze.js's fire
bar read; the RSI slope span of 3 bars is engine.js's; RSI > 70 / < 30 is
engine.js's never-chase-exhaustion veto, applied here only as "not a
confirm", never as a veto of the setup. Nothing existing moved.

   Degradation is honest in both directions. A family whose evidence is not
on the tape — the Twelve Data / Yahoo legs can carry no usable volume, an
EMA-50 needs 55 closed bars before its slope is readable — is UNCHECKED: it
neither confirms nor vetoes. When fewer than two families can even be
checked, the setup is UNVERIFIED and stays eligible for the picks, because a
floor that bites without evidence would be a veto dressed as a standard
(hg-v700's rule: never punish a setup for evidence the feed never carried).
Only a CHECKED failure — two or more families readable, fewer than two of
them backing the break — marks the setup UNCONFIRMED, and only then does
ogTopPicks refuse it a slot. */
var OG_VOLZ_MIN = 0.5;    /* the house participation floor (engine.js G2, squeeze.js) — reused, not refit */
var OG_VOLZ_LOOK = 20;    /* the house z-score lookback */
var OG_RSI_SLOPE = 3;     /* engine.js's own RSI slope span */
var OG_TREND_EMA = 50;    /* the prevailing-trend read on the lane's own tape */
var OG_TREND_SLOPE = 5;   /* the bars over which the EMA's slope is judged */
var OG_VWAP_LOOK = 20;    /* hg-v1009: vwapAt / vwapReclaim's own window (indicators.js) — reused, not refit */
var OG_CVD_LOOK = 30;     /* hg-v1009: hgOmniCvd's own default window (omniroute.js) — reused */
var OG_CVD_MIN_WIN = 10;  /* hg-v1009: hgOmniCvd's own minimum window count for a flow read — reused */

/* The read itself. Pure apart from the optional taker series the caller
   hands in: the lane's rows and a setup in, the family verdicts and the
   floor's answer out — never null-safe by coercion, every absent input
   returns null so junk can never fabricate a confirmation. hg-v1009: five
   families now (VWAP and real-flow CVD joined v1006's three); the THIRD
   argument is optional and old callers behave exactly as v1006 did. */
function ogConfirmRead(rows, s, extra){
  try{
    if (!Array.isArray(rows) || !rows.length || !s) return null;
    var dir = s.dir;
    if (dir !== 'long' && dir !== 'short') return null;
    var iR = fin(s.i);
    if (iR === null) return null;
    var i = Math.floor(iR);
    if (i < 0 || i >= rows.length) return null;
    var seg = rows.slice(0, i + 1);            /* the evidence stops at the break bar */
    var closes = seg.map(function(r){ return +r.c; });
    var vol = null, mom = null, trend = null, vwap = null, cvd = null;

    /* family 1 — VOLUME participation at the break bar. The all-zero and
       one-repeated-figure tapes are detected BEFORE the z-score is read:
       volZ returns 0 for both, and 0 would read as a checked failure where
       the truth is the feed carries no volume information at all. */
    var _volZ = (typeof volZ === 'function') ? volZ : null;
    if (_volZ && seg.length >= OG_VOLZ_LOOK + 1){
      var vwin = seg.slice(-(OG_VOLZ_LOOK + 1)), vArr = [], vi;
      for (vi = 0; vi < vwin.length; vi++){
        var vv = +vwin[vi].v;
        if (isFinite(vv)) vArr.push(vv);
      }
      var vTot = 0, vMin = Infinity, vMax = -Infinity;
      for (vi = 0; vi < vArr.length; vi++){
        vTot += vArr[vi];
        if (vArr[vi] < vMin) vMin = vArr[vi];
        if (vArr[vi] > vMax) vMax = vArr[vi];
      }
      if (vTot > 0 && (vMax - vMin) > 1e-8){
        var vz = _volZ(seg, OG_VOLZ_LOOK);
        if (isFinite(vz)){
          vol = { ok: vz > OG_VOLZ_MIN, val: vz,
                  note: 'volume z ' + (vz >= 0 ? '+' : '') + vz.toFixed(1)
                      + (vz > OG_VOLZ_MIN ? ' — the break printed on expanding participation'
                                          : ' — the break printed WITHOUT participation above the tape\'s norm') };
        }
      }
    }

    /* family 2 — MOMENTUM: RSI-14 past the 50 midline AND sloping with the
       break over engine.js's 3-bar span. A break into an exhausted RSI
       (>70 long, <30 short) is not momentum confirmation — it is the chase
       engine.js's G2 refuses; here it simply does not count. */
    var _rsi = (typeof rsi === 'function') ? rsi : null;
    if (_rsi && seg.length >= 14 + OG_RSI_SLOPE + 1){
      var ra = _rsi(closes, 14);
      var rNow = ra[ra.length - 1], rPrev = ra[ra.length - 1 - OG_RSI_SLOPE];
      if (isFinite(rNow) && isFinite(rPrev)){
        var rWith = dir === 'long' ? (rNow > 50 && rNow > rPrev) : (rNow < 50 && rNow < rPrev);
        var rExh = dir === 'long' ? (rNow > 70) : (rNow < 30);
        mom = { ok: rWith && !rExh, val: rNow,
                note: 'RSI ' + rNow.toFixed(0) + (rNow > rPrev ? ' and rising' : (rNow < rPrev ? ' and falling' : ' and flat'))
                    + (rExh ? (dir === 'long' ? ' — overbought: the break is chasing exhaustion, not confirmation'
                                              : ' — oversold: the break is chasing exhaustion, not confirmation')
                            : (rWith ? ' — momentum runs with the break'
                                     : ' — momentum does not run with the break')) };
      }
    }

    /* family 3 — the PREVAILING TREND on the lane's own tape: the close
       beyond EMA-50 with EMA-50 sloping the same way. On the 15m lane that
       is roughly a 12-hour trend against a 5-bar swing signal; on 4h, eight
       days. It is the higher-horizon read this single-tape desk can honestly
       carry, and it is read on the lane's own rows, never borrowed. */
    var _ema = (typeof ema === 'function') ? ema : null;
    if (_ema && seg.length >= OG_TREND_EMA + OG_TREND_SLOPE){
      var ea = _ema(closes, OG_TREND_EMA);
      var eNow = ea[ea.length - 1], ePrev = ea[ea.length - 1 - OG_TREND_SLOPE];
      var cNow = closes[closes.length - 1];
      if (isFinite(eNow) && isFinite(ePrev) && isFinite(cNow)){
        var tSide = dir === 'long' ? (cNow > eNow) : (cNow < eNow);
        var tSlope = dir === 'long' ? (eNow > ePrev) : (eNow < ePrev);
        trend = { ok: tSide && tSlope, val: eNow,
                  note: (tSide ? (dir === 'long' ? 'above' : 'below') : (dir === 'long' ? 'below' : 'above'))
                      + ' an EMA-50 that is ' + (eNow > ePrev ? 'rising' : (eNow < ePrev ? 'falling' : 'flat'))
                      + ((tSide && tSlope) ? ' — the prevailing trend backs the break'
                                           : ' — the prevailing trend does not back the break') };
      }
    }

    /* family 4 — VWAP: does the break HOLD the volume-weighted mean?
       (hg-v1009) The STATE read, built on indicators.js's own vwapAt — the
       primitive vwapReclaim is made of: the break bar's close beyond the
       rolling VWAP-20 on the break's side. Deliberately the state and not
       the reclaim EVENT: counting "no reclaim printed" as a failure would
       penalise exactly the strong trend breaks that never pierce the mean —
       the opposite of what a floor is for. When a reclaim DID print the
       note says so: the mean probed and defended is the stronger form of
       the same evidence. UNCHECKED where the tape carries no usable volume
       (vwapAt's NaN answer) — the Twelve Data / Yahoo legs, the same tapes
       where family 1 stands aside. */
    var _vwr = (typeof vwapReclaim === 'function') ? vwapReclaim : null;
    if (_vwr && seg.length >= OG_VWAP_LOOK + 2){
      var vr = _vwr(seg, OG_VWAP_LOOK, dir);
      if (vr && isFinite(vr.vwap)){
        var cLst = closes[closes.length - 1];
        if (isFinite(cLst)){
          var vSide = dir === 'long' ? (cLst > vr.vwap) : (cLst < vr.vwap);
          vwap = { ok: vSide, val: vr.vwap,
                   note: 'the break bar closed ' + (vSide ? (dir === 'long' ? 'ABOVE' : 'BELOW') : (dir === 'long' ? 'below' : 'above'))
                       + ' the rolling VWAP-20 (' + fmt(vr.vwap, 2) + ')'
                       + (vr.ok === true ? ' — and a VWAP reclaim printed into it: the mean was probed and defended'
                         : vSide ? ' — the volume-weighted mean sits behind the break'
                         : ' — the break never took the volume-weighted mean back') };
        }
      }
    }

    /* family 5 — CVD: the REAL order flow behind the break (hg-v1009), and
       only real flow. omniroute.js's hgOmniCvd reads a Binance taker series
       into a signed imbalance; its candle-approximated stand-in is derived
       from the SAME closes the momentum family already reads, so it is not
       an independent family and does not count here — the floor's whole
       logic is agreement from INDEPENDENT families. The series is sliced at
       the break bar (window stamps up to the bar's own open) before the
       read, so a setup whose break printed 200 bars back is judged on the
       flow that existed THEN, never on windows that had not printed yet.
       UNCHECKED without a taker series, with fewer than hgOmniCvd's own 10
       readable windows up to the break, or when the read falls back to the
       candle stand-in (junk ratios). */
    var _cvdFn = (typeof W.hgOmniCvd === 'function') ? W.hgOmniCvd : null;
    var _tk = (extra && extra.taker && Array.isArray(extra.taker.series)) ? extra.taker.series : null;
    if (_cvdFn && _tk && seg.length >= OG_CVD_LOOK){
      var bts = +rows[i].t;
      if (isFinite(bts)){
        if (bts > 1e12) bts = bts / 1000;   /* -> seconds, the taker series' own clock */
        var cut = [];
        for (var tw = 0; tw < _tk.length; tw++){
          var wt = +(_tk[tw] && _tk[tw].t);
          if (isFinite(wt) && wt <= bts) cut.push(_tk[tw]);
        }
        if (cut.length >= OG_CVD_MIN_WIN){
          var cv = _cvdFn(seg, OG_CVD_LOOK, { series: cut });
          if (cv && cv.source === 'taker' && isFinite(cv.delta)){
            var cWith = cv.dir === dir;
            cvd = { ok: cWith, val: cv.delta,
                    note: 'CVD ' + (cv.delta >= 0 ? '+' : '') + cv.delta.toFixed(2)
                        + ' of Binance taker flow over ' + cv.bars + ' windows to the break bar'
                        + (cWith ? ' — the order flow backs the break'
                                 : ' — the order flow runs AGAINST the break (the crowd filled the other side)')
                        + (cv.divergence ? (' · ' + cv.divergence + ' divergence across the window') : '') };
          }
        }
      }
    }

    var fams = [];
    if (vol) fams.push(vol);
    if (mom) fams.push(mom);
    if (trend) fams.push(trend);
    if (vwap) fams.push(vwap);
    if (cvd) fams.push(cvd);
    var checked = fams.length;
    var agreeN = 0, fi;
    for (fi = 0; fi < fams.length; fi++){ if (fams[fi].ok === true) agreeN++; }
    /* hg-v1009: the bar is EXACTLY where v1006 put it — two checked
       families or the break is UNCONFIRMED. What widened is the evidence:
       with five families an UNCONFIRMED verdict now means broader checked
       disagreement than it did with three, and a volume-less feed checks
       neither new family and degrades exactly as it did. */
    var verdict = checked < 2 ? 'unverified' : (agreeN >= 2 ? 'confirmed' : 'unconfirmed');
    var head = verdict === 'confirmed' ? ('CONFIRMED ' + agreeN + '/' + checked)
             : verdict === 'unconfirmed' ? ('UNCONFIRMED ' + agreeN + '/' + checked)
             : ('CONF UNCHECKED — only ' + checked + ' of 5 families readable');
    var line = head + ': ' + (vol ? vol.note : 'volume unreadable on this tape')
      + ' · ' + (mom ? mom.note : 'momentum unreadable on this tape')
      + ' · ' + (trend ? trend.note : 'the EMA-50 trend read is not warmed up on this tape')
      + ' · ' + (vwap ? vwap.note : 'VWAP unreadable on this tape (no usable volume leg)')
      + ' · ' + (cvd ? cvd.note : 'no real order-flow read on this lane')
      + (verdict === 'unconfirmed'
         ? '. Fewer than two checked families back this break, so it never takes a TOP PICK slot — it renders with its evidence, nothing more.'
         : verdict === 'confirmed'
         ? '. At least two checked families back the break — the confirmation floor is answered.'
         : '. The floor bites only where evidence exists to judge, so this setup stays eligible.');
    return { vol: vol, mom: mom, trend: trend, vwap: vwap, cvd: cvd,
             checked: checked, agree: agreeN, verdict: verdict, line: line };
  }catch(e){ return null; }
}

/* The single predicate the pick loop reads. Only a CHECKED failure blocks —
   an unreadable floor never does. */
function ogConfirmBlocked(s){
  return !!(s && s.confirm && s.confirm.verdict === 'unconfirmed');
}

/* The floor's verdict beside the state, the SMC read and the stack's chip —
   the evidence line under the stats names every family, so the chip only
   ever carries the answer and the count. */
function ogConfirmChipHtml(s){
  var c = s && s.confirm;
  if (!c || !c.verdict) return '';
  if (c.verdict === 'confirmed') return '<span class="stamp ok">CONFIRMED ' + c.agree + '/' + c.checked + '</span>';
  if (c.verdict === 'unconfirmed') return '<span class="stamp bad">UNCONFIRMED ' + c.agree + '/' + c.checked + ' — never a TOP PICK</span>';
  /* hg-v1009: five families now — VWAP and real-flow CVD joined v1006's three */
  return '<span class="stamp warn">CONF UNCHECKED — ' + c.checked + '/5 readable</span>';
}

/* hg-v1007: THE HOUSE REGIME seams. ogRegimeBlocked is the single predicate
   the pick loop reads — only 'against' bars a slot, because a ranging or
   compressed 4h tape is the population where breaks fade; favored, caution
   and neutral inform and never bar, and an unstamped setup (regime-stack.js
   absent or the tape unreadable) stays eligible. The chip is the shared
   renderer behind a call-time feature-check, exactly like the v1005 stack
   chip: an absent regime-stack.js blocks nothing and prints nothing. */
function ogRegimeBlocked(s){
  return !!(s && s.regime && s.regime.posture === 'against');
}
function ogRegimeChipHtml(s){
  try{
    var fn = (typeof W.hgRegimeChipHtml === 'function') ? W.hgRegimeChipHtml : null;
    if (!fn || !s || !s.regime) return '';
    return fn(s.regime) || '';
  }catch(e){ return ''; }
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
    /* hg-v1005: a setup the fundamental stack refused or demoted never
       takes a pick slot — it still renders in its lane list, chipped. */
    if (ogFundBlocked(s)) return;
    /* hg-v1006: nor does a break the CHECKED evidence fails to back — fewer
       than two of the confirmation families with it (five since hg-v1009:
       VWAP and real-flow CVD joined volume, momentum and trend). An
       UNVERIFIED setup (too little readable evidence to judge) stays
       eligible: the floor bites only where evidence exists to judge. */
    if (ogConfirmBlocked(s)) return;
    /* hg-v1007: nor does a break the house regime is positioned AGAINST — a
       ranging or compressed 4h tape is where breaks fade. Only that posture
       bars a slot; favored, caution and neutral inform and never bar, and an
       unstamped setup (module absent, tape unreadable) stays eligible. */
    if (ogRegimeBlocked(s)) return;
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
  var fundChip = ogFundChipHtml(s);   /* hg-v1005: the stack's verdict beside the state */
  var confChip = ogConfirmChipHtml(s); /* hg-v1006: and the confirmation floor's verdict beside both */
  var regimeChip = ogRegimeChipHtml(s); /* hg-v1007: and the house regime's posture beside all three */

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
    + '<div class="row" style="gap:6px;margin:4px 0"><span class="stamp ' + stateCls + '">' + esc(stateLabel) + '</span>' + smcChip + fundChip + confChip + regimeChip + '</div>'
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
    /* hg-v1006: the floor's EVIDENCE, not just its verdict — all three
       family reads with their numbers, so the chip above never has to be
       taken on trust. Printed for every state: the read is a property of
       the break bar, which is immutable history for a settled setup too. */
    + ((s.confirm && s.confirm.line) ? '<div class="note" style="margin:4px 0">' + esc(s.confirm.line) + '</div>' : '')
    /* hg-v1007: the regime's REASON when it speaks against or cautions —
       favored and neutral need no prose (the chip carries those), and an
       unreadable regime is reported once on the panel, not per card. */
    + ((s.regime && (s.regime.posture === 'against' || s.regime.posture === 'caution') && s.regime.why)
        ? '<div class="note" style="margin:4px 0">House regime: ' + esc(s.regime.why) + '</div>' : '')
    /* PRICE MAY HAVE WALKED THROUGH THIS PLAN ALREADY — the shared rule in
       hg-plan.js. Every OPTI GOLD ticket is a RESTING LIMIT at the midpoint
       of a broken range, so it is a retest by construction: the population
       the geometry defect lives in, and the one desk where asking the
       question is least optional. Only asked while the order is still
       pending — once it has filled the entry is history, and "the target is
       behind price" on an open position is called profit. */
    + ((!filled && typeof W.hgPlanGeometryLineHtml === 'function')
      ? (W.hgPlanGeometryLineHtml({ dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1 },
          mark, { cls: 'note warn', style: 'margin:4px 0' }) || '') : '')
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

  /* hg-v948: BOTH numbers, never one chosen for the reader. When the horizon
     binds, the figure this desk used to print alone is the infinite-horizon
     one, and the gap between them is the whole finding -- hiding it would
     replace an over-confident number with an unexplained one. */
  var boundNote = '';
  if (est && est.horizonBound && isFinite(est.condInf) && est.targetAtr != null){
    boundNote = '<div class="note warn" style="margin-bottom:4px">HORIZON BINDS — the target is '
      + esc(est.targetAtr.toFixed(1)) + '×ATR away with ' + esc(String(est.barsLeft))
      + ' bar(s) before this setup expires, so paying is bounded at '
      + esc(Math.round(est.cond * 100) + '%') + ' rather than the '
      + esc(Math.round(est.condInf * 100) + '%') + ' this desk quoted before hg-v948, which assumed no expiry at all. '
      + 'A bound, not a forecast: the driftless model behind it is least like gold over exactly these distances, '
      + 'so read the ordering it produces and not the level.</div>';
  } else if (est && est.reach === null && isFinite(est.condInf)){
    boundNote = '<div class="note warn" style="margin-bottom:4px">the travel-to-target term could not be computed '
      + '(a level or the ATR is unreadable), so this is the ' + esc(Math.round(est.condInf * 100) + '%')
      + ' infinite-horizon figure alone — an upper bound with its tighter half missing, never a smaller number invented in its place.</div>';
  }

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
    + '<span class="note">an UPPER BOUND, under the model stated below — not a measured win rate</span></div>'
    + (pk.why ? '<div class="note' + (pk.actionable ? '' : ' warn') + '" style="margin-bottom:4px">' + esc(pk.why) + '</div>' : '')
    + boundNote
    + (est && est.note ? '<div class="note" style="margin-bottom:4px">' + esc(est.note) + '</div>' : '')
    + quote
    + card(s, mark)
    + '</div>';
}

function render(ui, lanes, mark, note, opts){
  if (!ui || !ui.body) return;
  opts = opts || {};
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
        + (opts.fundBlackout
          ? '<div class="note"><b>EVENT BLACKOUT</b> — a red-folder macro print is inside its window; no fresh setup forms into it, so this slot stays empty until it clears.</div>'
          : '<div class="note">Nothing live in this lane — an empty slot rather than a setup promoted from another timeframe.</div>')
        + '</div>';
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
    + '<br>A pick must also clear the <b>confirmation floor</b> (hg-v1006, five families since hg-v1009): at least two of the checked families — '
    + 'volume participation, momentum (RSI-14), the prevailing EMA-50 trend, the VWAP-20 hold, and on Binance perp-fed lanes the real '
    + 'taker-flow CVD, all read on the lane\'s own tape at the break bar — must back the break. A break whose evidence cannot be read stays '
    + 'eligible as CONF UNCHECKED; a break the checked evidence does not back is UNCONFIRMED and never takes a slot, however well it scores.'
    + '<br>And a pick must not fight the <b>house regime</b> (hg-v1007): one shared read of what the 4h tape is '
    + 'doing — trending, ranging, compressed or exploding — from regime-stack.js, computed off the swing lane\'s '
    + 'own rows. A break with the 4h trend is favored; a break into a ranging or compressed 4h tape is in the '
    + 'population where breaks fade and never takes a slot, however well it scores. An unreadable regime bars nothing.'
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
  /* Pack 907: OPTI GOLD runs three lanes off three tapes, so it gets three
     answers, not an average of them. On a tape with one bar in twenty
     inverted this desk rendered roughly DOUBLE its clean output and said
     nothing; a lane drawn from impossible candles now says which lane. */
  /* hg-v913: this desk reads the records it writes. */
  var tapeNote = (typeof W.hgGoldFwdNote === 'function' ? W.hgGoldFwdNote('optigold') : '');
  if (typeof W.hgGoldTapeNotes === 'function'){
    (lanes || []).forEach(function(L){
      if (!L || !L.rows || !L.rows.length) return;
      tapeNote += W.hgGoldTapeNotes(L.rows,
        (L.cfg && L.cfg.interval ? L.cfg.interval : '') + (L.cfg && L.cfg.label ? ' ' + L.cfg.label : ''));
    });
  }
  /* hg-v1005: the blackout alarm first when it is live, then the full gold
     fundamental board — both ahead of everything drawn from the scan. */
  ui.body.innerHTML = (opts.fundBlackout
      ? '<div class="note warn" style="margin-bottom:10px;padding:8px 10px;border-left:3px solid #b45309">'
        + '<b>EVENT BLACKOUT</b> — a red-folder macro print is inside its window; no fresh setup forms into it. '
        + 'The rule\'s existing orders and settles still render below, chipped with the stack\'s verdict.</div>'
      : '')
    + ogFundPanelHtml()
    /* hg-v1007: the house regime line beside the gold board — one read for
       every lane, honest when unreadable rather than absent, and absent only
       when regime-stack.js itself is not loaded. */
    + ((typeof W.hgRegimePanelHtml === 'function' && opts.regime) ? (W.hgRegimePanelHtml(opts.regime) || '') : '')
    + tapeNote + h;
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
      /* hg-v1009: the CVD confirmation family reads REAL Binance taker
         flow, and only where the lane's OWN feed is a Binance gold perp —
         'binance-xau' is XAUUSDT and 'binance-paxg' is PAXGUSDT (macro.js's
         own source labels). Every other feed hands in nothing and the
         family stands aside: the candle-approximated stand-in is derived
         from the same closes the momentum family already reads, so it is
         not independent evidence and the floor does not count it. 500
         windows of the lane's own interval reach back across the whole
         loaded tape on 1h and 4h and most of it on 15m; a break older than
         that simply reads UNCHECKED. One cached call per lane, soft
         everywhere — a failed fetch is a null, never an error up. */
      var ogTaker = null;
      try{
        var ogTkSym = (got && got.source === 'binance-xau') ? 'XAUUSDT'
                    : (got && got.source === 'binance-paxg') ? 'PAXGUSDT' : null;
        var ogTkFn = (typeof W.binanceTakerRatio === 'function') ? W.binanceTakerRatio : null;
        if (ogTkSym && ogTkFn) ogTaker = await ogTkFn(ogTkSym, L.interval, 500);
      }catch(eTk){ ogTaker = null; }
      var setups = ogSignals(rows, L);
      setups.forEach(function(s){
        s.lane = L.key; s.laneLabel = L.label; s.interval = L.interval;
        s.horizonBars = L.horizonBars; s.sym = 'XAUUSD';
        /* hg-v1006: the confirmation floor, read on THIS lane's own tape and
           sliced at the break bar — never pooled across lanes, never read on
           a bar that had not closed when the break printed. Stamped for
           every state: it is a property of the break, like the weekend and
           news marks, not of the setup's current liveness. hg-v1009: and the
           lane's taker series rides along — the reader slices it at the
           break bar itself, so a stale break is judged on the flow that
           existed THEN, never on windows that had not printed. */
        s.confirm = ogConfirmRead(rows, s, { taker: ogTaker });
      });
      lanes.push({ cfg: L, rows: rows, setups: setups, src: (got && got.source) || 'gold',
                   /* hg-v1007: the feed, kept for the forward recording, which
                      moved below the regime pass — the ledger needs the feed
                      the levels were priced on, and `got` does not survive
                      the loop. Same value the old in-loop call passed. */
                   feed: (got && typeof got.source === 'string') ? got.source : null,
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

      /* hg-v1007: the forward recording moved OUT of this loop to below the
         regime pass — a ledger row now carries the house regime's posture
         (row.regime), and the regime is only knowable once the swing lane's
         4h tape has loaded, which is after the scalp and intraday lanes have
         already been walked. Same per-lane rows, same mechanic, same lane in
         the mechanic; only the WHEN moved. The per-lane split itself stands:
         pooling all three into one bucket would make it impossible to ask
         whether the same rule pays differently at different scales. */
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

    /* hg-v1005: the fundamental stack across every lane's setups, BEFORE
       the board and the picks are computed from them — a blackout refuses
       every directional setup (both pick slots stay empty and the board
       says why), a decisive headwind demotes. The pass needs s.sym, which
       the lane loop already stamps. */
    var ogFundBlackout = false;
    try{
      var ogFbFn = (typeof W.hgFundamentalBlackout === 'function') ? W.hgFundamentalBlackout : null;
      if (ogFbFn) ogFundBlackout = ogFbFn('XAUUSD') === true;
    }catch(eFB){ ogFundBlackout = false; }
    try{
      var ogFsFn = (typeof W.hgFundamentalScanCands === 'function') ? W.hgFundamentalScanCands : null;
      if (ogFsFn){
        var ogAll = [];
        for (var ogi = 0; ogi < lanes.length; ogi++){ ogAll = ogAll.concat(lanes[ogi].setups || []); }
        ogFsFn(ogAll, { scanner: 'optigold' });
      }
    }catch(eFS){}

    /* hg-v1007: THE HOUSE REGIME — one read of what the 4h gold tape is
       DOING, computed from the SWING lane's own rows (no extra fetch: the 4h
       tape is already here), then stamped on EVERY lane's setups, because
       every lane trades the same metal: a 15m break into a compressed 4h
       tape sits in the population where breaks fade whatever the 15m chart
       shows. When the swing lane failed, the tape is thin, or regime-stack.js
       is absent, the read is UNREADABLE — it bars nothing, and the panel
       says so once. Feature-checked throughout: an absent module stamps
       nothing and blocks nothing. */
    var ogRegime = null;
    try{
      var ogRgFn = (typeof W.hgGoldRegime === 'function') ? W.hgGoldRegime : null;
      if (ogRgFn){
        var ogSwingRows = null;
        for (var ogr = 0; ogr < lanes.length; ogr++){
          if (lanes[ogr] && lanes[ogr].cfg && lanes[ogr].cfg.key === 'swing'
              && lanes[ogr].rows && lanes[ogr].rows.length){ ogSwingRows = lanes[ogr].rows; break; }
        }
        /* an empty argument is deliberate: a failed swing lane is an
           unreadable regime with the reason named, never a fabricated one */
        ogRegime = ogRgFn(ogSwingRows || []);
      }
    }catch(eRG){ ogRegime = null; }
    try{
      var ogRsFn = (typeof W.hgRegimeScanCands === 'function') ? W.hgRegimeScanCands : null;
      if (ogRsFn && ogRegime){
        var ogAllR = [];
        for (var ogr2 = 0; ogr2 < lanes.length; ogr2++){ ogAllR = ogAllR.concat(lanes[ogr2].setups || []); }
        ogRsFn(ogAllR, { style: 'breakout', regime: ogRegime });
      }
    }catch(eRS){}

    /* hg-v1007: the forward log, per lane exactly as it ran inside the fetch
       loop, moved to here so every recorded row can carry row.regime beside
       row.conf — the book can then ask whether regime-ALIGNED breaks pay
       better, per lane, on evidence. Recording stays a no-op when the
       forward module is absent, exactly as before. */
    for (i = 0; i < lanes.length; i++){
      var fL = lanes[i];
      if (!fL || !fL.setups || !fL.setups.length || !fL.cfg) continue;
      try{
        if (typeof W.hgFwdRecordScan === 'function'){
          var fwd = ogFwdRows(fL.setups, fL.cfg.key, fL.rows, (typeof fL.feed === 'string') ? fL.feed : null);
          if (fwd.length) W.hgFwdRecordScan('OPTI GOLD', fL.cfg.interval, fwd, { horizonBars: fL.cfg.horizonBars });
        }
      }catch(eFwd){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('optigold', eFwd); }catch(eW){} }
    }
    var note = 'mark is the last closed ' + markLane.cfg.interval + ' bar from ' + esc(String(markLane.src || 'gold'))
      + ' · same rule on every lane: swing 5 · ATR 14 · stop 1.5×ATR · target 2R'
      + ' · ' + total + ' setup(s) across ' + lanes.length + ' lanes'
      + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC';
    render(ui, lanes, mark, note, { fundBlackout: ogFundBlackout, regime: ogRegime });
    /* hg-v1006: the floor's tally beside the count, over the LIVE setups —
       the number a reader checks first, named rather than left to be
       inferred card by card. Omitted when no setup carried a readable
       stamp at all, rather than printing three confident zeroes. */
    var ogFloor = { confirmed: 0, unconfirmed: 0, unverified: 0, stamped: 0 };
    (__og.last.setups || []).forEach(function(s){
      if (!s || (s.state !== 'waiting' && s.state !== 'open') || !s.confirm || !s.confirm.verdict) return;
      ogFloor.stamped++;
      if (s.confirm.verdict === 'confirmed') ogFloor.confirmed++;
      else if (s.confirm.verdict === 'unconfirmed') ogFloor.unconfirmed++;
      else ogFloor.unverified++;
    });
    if (ui && ui.stat) ui.stat.textContent = total + ' setup(s) · mark ' + fmt(mark)
      + (ogFloor.stamped ? ' · floor: ' + ogFloor.confirmed + ' confirmed · ' + ogFloor.unconfirmed + ' unconfirmed · ' + ogFloor.unverified + ' unchecked' : '')
      + (ogFundBlackout ? ' · EVENT BLACKOUT — no fresh setup forms' : '')
      /* hg-v1007: the house regime beside the count and the floor — one
         label, only when the 4h tape could actually be read. */
      + ((ogRegime && ogRegime.state && ogRegime.state !== 'unreadable' && ogRegime.label)
          ? ' · regime ' + ogRegime.label : '');
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
/* hg-v978: the break bar a setup fired on, in seconds, for the forward
   ledger -- the same bar the weekend and news marks are judged on (hg-v950 /
   hg-v965). Null when unreadable. */
function ogBreakBarSec(rows, s){
  try{
    if (!rows || !s) return null;
    var i = +s.i;
    if (!isFinite(i) || i < 0 || i >= rows.length) return null;
    var t = rows[i] && rows[i].t;
    if (t === null || t === undefined || t === '') return null;
    var n = +t;
    if (!isFinite(n) || n <= 0) return null;
    return Math.floor(n > 1e12 ? n / 1000 : n);
  }catch(e){ return null; }
}
/* hg-v980: the close of the setup's break bar (rows[s.i]); null on junk --
   +null is 0 and a mark of zero is not a mark */
function ogBreakBarClose(rows, s){
  if (!Array.isArray(rows) || !s) return null;
  var i = (typeof s.i === 'number' && isFinite(s.i)) ? s.i : NaN;
  if (!isFinite(i) || i < 0 || i >= rows.length || !rows[i]) return null;
  var c = +rows[i].c;   /* +null, +'' and +undefined all fail the > 0 test below */
  return (isFinite(c) && c > 0) ? c : null;
}

function ogFwdRows(setups, lane, rows, feed){
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
    var row = { sym: 'XAUUSD', dir: s.dir, entry: en, stop: st, t1: tp,
               mechanic: ('BOS-RETRACE-' + laneKey + '-' + (s.dir === 'long' ? 'LONG' : 'SHORT')).slice(0, 28),
               ticket: false };   /* never a ticket: unmeasured rule, by design */
    var bt = ogBreakBarSec(rows, s);   /* hg-v978: dated on the break bar */
    if (bt) row.barT = bt;
    if (typeof feed === 'string' && feed) row.feed = feed;   /* hg-v979: the feed the levels were priced on */
    /* hg-v980: these are RESTING orders (the file header says so), so the
       ledger's fill model is exactly the settlement they need -- and it needs
       the mark at the break bar to know which way the order rests */
    var mk = ogBreakBarClose(rows, s);
    if (mk !== null) row.mark = mk;
    /* hg-v1006: the floor's verdict rides the ledger row, so the forward
       book can later answer the only question that matters about the floor
       — do CONFIRMED breaks actually pay better than UNCONFIRMED ones — on
       evidence, rather than this desk asserting it. A separate field, never
       folded into the mechanic string: the mechanic's grouping must stay
       continuous with every row already logged. */
    if (s.confirm && typeof s.confirm.verdict === 'string') row.conf = s.confirm.verdict;
    /* hg-v1007: and the house regime's posture rides beside it — favored /
       neutral / caution / against — so the forward book can measure whether
       regime-ALIGNED breaks pay better. A separate field again, never folded
       into the mechanic string: the mechanic's grouping must stay continuous
       with every row already logged. An unstamped setup invents none. */
    if (s.regime && typeof s.regime.posture === 'string') row.regime = s.regime.posture;
    out.push(row);
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
W.__ogTravelP = ogTravelP;
W.__ogCondBound = ogCondBound;
W.__ogNormCdf = ogNormCdf;
W.__ogTopPicks = ogTopPicks;
W.__ogAtMark = ogAtMark;
W.__ogReach = ogReach;
W.__ogWeekendVerdict = ogWeekendVerdict;
W.__ogPending = ogPending;
/* exported so the rule can be tested: runOptiGold needs a live gold feed and is
   unreachable in a test sandbox, which is exactly how a previous activation in
   this repo shipped as dead code */
W.__ogSignals = ogSignals;
W.__ogSwings = ogSwings;
W.__ogAtr = ogAtr;
W.__ogFwdRows = ogFwdRows;

/* hg-v1006: the confirmation floor, drivable in tests without a feed —
   ogConfirmRead is the pure reader, ogConfirmBlocked the pick-loop
   predicate, ogConfirmChipHtml the card chip. */
W.__ogConfirmRead = ogConfirmRead;
W.__ogConfirmBlocked = ogConfirmBlocked;
W.__ogConfirmChipHtml = ogConfirmChipHtml;

/* hg-v1007: the house-regime seams — ogRegimeBlocked is the pure pick-loop
   predicate (drivable in tests without a feed, like the v1006 floor's),
   ogRegimeChipHtml the card chip behind its call-time feature-check. */
W.__ogRegimeBlocked = ogRegimeBlocked;
W.__ogRegimeChipHtml = ogRegimeChipHtml;

W.HG_tabs = W.HG_tabs || [];
/* hg-v1005: the stack seams, on the registration object and one export for
   the guard — ogFundBlocked is the predicate the pick loop reads. */
W.__ogFundBlocked = ogFundBlocked;
W.HG_tabs.push({ id: 'optigold', label: 'OPTI GOLD', mount: mountOptiGold, refresh: refreshOptiGold,
                 fundBlocked: ogFundBlocked, fundPanelHtml: ogFundPanelHtml,
                 confirmRead: ogConfirmRead, confirmBlocked: ogConfirmBlocked,
                 regimeBlocked: ogRegimeBlocked });

})();
