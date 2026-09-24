/* HARDGATE — hg-v933: three gold-native strategies the catalog did not have.

   ASKED FOR, AND THE PRIOR IS AGAINST IT. This desk already runs 78 OMNIGOLD
   mechanics and S0-S66 across Parts 4-9, and hg-v922 measured that NOTHING
   either gold desk ranks by separates outcomes on four disjoint windows at
   both fill bounds. hg-v925 measured the cohort freed by relaxing the
   evidence gate at 30.5% against a 33.3% breakeven. More detectors is not
   what the measurements say is missing.

   So these are added on the terms that follow from that, not in spite of it:

   1. THEY ARE GENUINELY NEW, not another member of a family already covered.
      Each uses gold-specific structure nothing in the catalog reads: the LBMA
      benchmark auctions, the dollar leg that normally prices gold, and the
      round-dollar levels the metal actually trades around. A fourth sweep
      variant would only split an existing family's sample.

   2. THEY MINT DEMOTED. A new mechanic has NO measured record, and this desk
      does not let an unmeasured setup lead — the same rule hgOgSiblingRecordNote
      applies to never-observed OMNIGOLD mechanics. They paint with full levels
      and reasoning and cannot be MOST PROBABLE until a bake gives them one.
      hgGoldExtraSetPromotable(true) lifts that, deliberately one call and not
      a default.

   3. THEY ARE NOT REGISTERED AS OMNIGOLD MECHANICS. That is not an oversight:
      hg-v923 showed registering one widens the Sidak family bar for every
      existing mechanic (77 -> 78 moved it 3.2091 -> 3.2128 sigma). Three more
      would make every OTHER mechanic's promotion bar stricter, on a desk where
      nothing currently clears it. The ask was GOLD SCALP and GOLD SWING, and
      that is exactly where these live.

   4. BARS ONLY. No new feed, so nothing here can be UNCHECKED for want of one.
      The DXY leg degrades to null when macro has no dollar rows, rather than
      inventing a correlation.

   Every detector returns null rather than a weak opinion; none invents a
   direction; none turns a NO ENTRY into an ENTER.
*/
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

/* ---------------------------------------------------------------- shared */

function num(x){ var n = +x; return isFinite(n) ? n : NaN; }
function last(rows){ return (rows && rows.length) ? rows[rows.length - 1] : null; }

/** Mean bar range over the last n bars — a cheap ATR stand-in, same shape the
    rest of goldind uses, so thresholds here read on the same scale. */
function barAtr(rows, n){
  if (!rows || rows.length < 2) return NaN;
  var k = Math.min(n || 14, rows.length - 1), s = 0, c = 0;
  for (var i = rows.length - k; i < rows.length; i++){
    var h = num(rows[i].h), l = num(rows[i].l);
    if (isFinite(h) && isFinite(l)){ s += (h - l); c++; }
  }
  return c ? (s / c) : NaN;
}

/** London local hour, DST-aware.

    Prefers the repo's own hgTzHourFrac (indicators2.js) so this file agrees
    with every other session read, but FALLS BACK TO ITS OWN Intl CALL rather
    than going silent. The first version of this depended on that helper
    alone, and in any context where indicators2.js is not loaded the fix
    detector was simply dead — a dependency failure that looks exactly like a
    quiet market, which is the worst way for a detector to fail. NaN only
    when the runtime really has no Intl timezone support at all. */
function lonHour(ms){
  try{
    if (typeof W.hgTzHourFrac === 'function'){
      var v = W.hgTzHourFrac(ms, 'Europe/London');
      if (isFinite(v)) return v;
    }
  }catch(e){}
  try{
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour12: false,
      hour: '2-digit', minute: '2-digit' });
    var parts = fmt.formatToParts(new Date(ms));
    var hh = NaN, mm = NaN;
    for (var i = 0; i < parts.length; i++){
      if (parts[i].type === 'hour') hh = +parts[i].value;
      else if (parts[i].type === 'minute') mm = +parts[i].value;
    }
    if (isFinite(hh) && isFinite(mm)) return (hh % 24) + mm / 60;
  }catch(e2){}
  return NaN;
}

/* =================================================================
   1. LBMA LONDON FIX  (goldfix)

   Gold is benchmarked twice a day in London — 10:30 and 15:00 LOCAL, which
   is the price the physical market actually clears against. Order flow
   concentrates into the auction and frequently unwinds straight after it,
   because the flow was an obligation to price rather than a directional
   view.

   NOTHING IN THE CATALOG READS THIS. The session tables here cover Asia,
   London open and the NY overlap; the two auctions inside them are not
   marked, and they are the most gold-specific clock events that exist.

   The detector is a FADE of the pre-fix drift, and it demands the drift was
   real (>= driftAtr x ATR) and that the bar after the window closed back
   through it. A drift that simply continues is NOT a setup here — that is a
   trend, and the desk has plenty of ways to read one.
   ================================================================= */

var HG_GOLD_FIX_HOURS = [10.5, 15.0];   /* LBMA AM and PM, London local */
var HG_GOLD_FIX_PRE_H = 0.75;           /* the run-in that builds the drift */
var HG_GOLD_FIX_POST_H = 0.75;          /* how long after it still counts */

/** Which fix window an instant sits in: 'pre' | 'post' | null, plus which. */
function hgGoldFixWindow(ms){
  var h = lonHour(ms);
  if (!isFinite(h)) return null;           /* no Intl -> no opinion, not a guess */
  for (var i = 0; i < HG_GOLD_FIX_HOURS.length; i++){
    var f = HG_GOLD_FIX_HOURS[i];
    if (h >= f - HG_GOLD_FIX_PRE_H && h < f) return { phase: 'pre', fix: f, which: i ? 'PM' : 'AM' };
    if (h >= f && h <= f + HG_GOLD_FIX_POST_H) return { phase: 'post', fix: f, which: i ? 'PM' : 'AM' };
  }
  return null;
}

/**
 * The fade. `rows` are execution-timeframe bars with ms or sec `t`.
 * Returns null unless we are POST-fix, the run-in drifted, and the last bar
 * closed back against it.
 */
function hgGoldFixFade(rows, opts){
  var o = opts || {};
  if (!rows || rows.length < 12) return null;
  var lb = last(rows);
  var nowMs = isFinite(o.now) ? o.now : (num(lb.t) * (num(lb.t) > 1e11 ? 1 : 1000));
  var win = hgGoldFixWindow(nowMs);
  if (!win || win.phase !== 'post') return null;

  var atr = barAtr(rows, 14);
  if (!isFinite(atr) || !(atr > 0)) return null;
  var driftAtr = isFinite(o.driftAtr) ? o.driftAtr : 0.8;

  /* the run-in: bars whose own timestamp sat in the PRE window */
  var pre = [];
  for (var i = rows.length - 1; i >= 0 && pre.length < 40; i--){
    var t = num(rows[i].t);
    if (!isFinite(t)) continue;
    var w = hgGoldFixWindow(t > 1e11 ? t : t * 1000);
    if (w && w.phase === 'pre' && w.which === win.which) pre.unshift(rows[i]);
    else if (pre.length) break;               /* left the run-in going backwards */
  }
  if (pre.length < 2) return null;

  var start = num(pre[0].o), end = num(pre[pre.length - 1].c);
  if (!isFinite(start) || !isFinite(end)) return null;
  var drift = end - start;
  if (Math.abs(drift) < driftAtr * atr) return null;    /* no drift, no fade */

  var driftUp = drift > 0;
  var c = num(lb.c), h = num(lb.h), l = num(lb.l);
  if (!isFinite(c)) return null;
  /* the reclaim: the last closed bar must close back THROUGH the run-in's
     midpoint, against the drift. A stall is not a reversal. */
  var mid = (start + end) / 2;
  var reclaimed = driftUp ? (c < mid) : (c > mid);
  if (!reclaimed) return null;

  var dir = driftUp ? 'short' : 'long';
  var extreme = driftUp ? Math.max(h, end) : Math.min(l, end);
  var stop = driftUp ? (extreme + 0.15 * atr) : (extreme - 0.15 * atr);
  return {
    ok: true, dir: dir, kind: 'goldfix', which: win.which,
    entry: c, stop: stop, level: mid,
    driftAtr: +(Math.abs(drift) / atr).toFixed(2),
    why: 'LBMA ' + win.which + ' fix — price drifted ' + (driftUp ? 'up' : 'down') + ' '
       + (Math.abs(drift) / atr).toFixed(2) + 'x ATR into the ' + win.fix.toFixed(2)
       + ' London auction and closed back through the run-in midpoint after it',
    invalidates: 'a close beyond the pre-fix extreme, or leaving the post-fix window'
  };
}

/* =================================================================
   2. DOLLAR DIVERGENCE  (golddxy)

   Gold is priced in dollars, so the two normally move inversely. When they
   move TOGETHER with real magnitude, the usual pricing relationship is not
   what is driving the metal — the readings people reach for are central-bank
   or physical demand, or a risk event bidding both.

   THE DESK ALREADY HOLDS THE DOLLAR LEG and uses it only as a one-way veto
   (hgGoldDollarBias kills longs when DXY is bullish). The ANOMALY — both
   legs up — is not read at all, and it is the more informative state.

   This is deliberately a CONTINUATION read, not a fade: a gold rally the
   dollar is not fighting is the one with the fewest sellers in the way.
   Returns null with no dollar rows rather than assuming a correlation.
   ================================================================= */

function pctMove(rows, n){
  if (!rows || rows.length < n + 1) return NaN;
  var a = num(rows[rows.length - 1 - n].c), b = num(rows[rows.length - 1].c);
  if (!isFinite(a) || !isFinite(b) || !(a > 0)) return NaN;
  return (b - a) / a * 100;
}

function hgGoldDxyDivergence(rows, dxyRows, opts){
  var o = opts || {};
  if (!rows || rows.length < 12) return null;
  if (!dxyRows || dxyRows.length < 12) return null;    /* no leg -> no opinion */
  var n = isFinite(o.lookback) ? o.lookback : 10;
  var gm = pctMove(rows, n), dm = pctMove(dxyRows, n);
  if (!isFinite(gm) || !isFinite(dm)) return null;

  var goldMin = isFinite(o.goldMinPct) ? o.goldMinPct : 0.35;
  var dxyMin = isFinite(o.dxyMinPct) ? o.dxyMinPct : 0.20;
  if (Math.abs(gm) < goldMin || Math.abs(dm) < dxyMin) return null;
  /* the ANOMALY is agreement in sign; disagreement is the ordinary state */
  if ((gm > 0) !== (dm > 0)) return null;

  var atr = barAtr(rows, 14);
  if (!isFinite(atr) || !(atr > 0)) return null;
  var lb = last(rows);
  var c = num(lb.c);
  if (!isFinite(c)) return null;

  var dir = gm > 0 ? 'long' : 'short';
  var swing = dir === 'long' ? num(lb.l) : num(lb.h);
  var stop = dir === 'long' ? (swing - 0.25 * atr) : (swing + 0.25 * atr);
  return {
    ok: true, dir: dir, kind: 'golddxy',
    entry: c, stop: stop,
    goldPct: +gm.toFixed(2), dxyPct: +dm.toFixed(2),
    why: 'gold ' + (gm > 0 ? '+' : '') + gm.toFixed(2) + '% and DXY '
       + (dm > 0 ? '+' : '') + dm.toFixed(2) + '% over ' + n
       + ' bars — moving TOGETHER, so the dollar is not what is pricing the metal here',
    invalidates: 'the two legs re-invert, or a close beyond the anchor swing'
  };
}

/* =================================================================
   3. ROUND-DOLLAR MAGNET  (goldround)

   Gold trades around whole dollars — 4500, 4550, 4525 — and OMNIGOLD has had
   a ROUND-MAGNET mechanic since it was built. GOLD SCALP and GOLD SWING
   never got one, so the two tabs a trader actually works from cannot see the
   levels the tape is drawn to.

   This is the REJECTION half only: a bar that pushed through a round level
   and closed back off it. The magnet half (price drifting toward an untested
   level) is a target, not an entry, and issuing an entry for it would be
   inventing a trigger the tape never gave.
   ================================================================= */

var HG_GOLD_ROUND_STEPS = [100, 50, 25, 10];

/** The nearest round level to `px` at `step`, and how far the wick pierced. */
function hgGoldNearestRound(px, step){
  if (!isFinite(px) || !(step > 0)) return NaN;
  return Math.round(px / step) * step;
}

function hgGoldRoundReject(rows, opts){
  var o = opts || {};
  if (!rows || rows.length < 20) return null;
  var lb = last(rows);
  var h = num(lb.h), l = num(lb.l), c = num(lb.c), op = num(lb.o);
  if (!isFinite(h) || !isFinite(l) || !isFinite(c) || !isFinite(op)) return null;
  var atr = barAtr(rows, 14);
  if (!isFinite(atr) || !(atr > 0)) return null;
  var minPierce = (isFinite(o.pierceAtr) ? o.pierceAtr : 0.12) * atr;
  var steps = Array.isArray(o.steps) ? o.steps : HG_GOLD_ROUND_STEPS;

  for (var i = 0; i < steps.length; i++){
    var step = steps[i];
    /* a high that pierced a round level and closed back below it */
    var up = hgGoldNearestRound(h, step);
    if (isFinite(up) && h >= up && (h - up) >= minPierce && c < up && op < up){
      return {
        ok: true, dir: 'short', kind: 'goldround', level: up, step: step,
        entry: c, stop: h + 0.15 * atr,
        pierceAtr: +((h - up) / atr).toFixed(2),
        why: 'wick pierced the $' + up.toFixed(0) + ' round level by '
           + ((h - up) / atr).toFixed(2) + 'x ATR and closed back under it',
        invalidates: 'a close above $' + up.toFixed(0)
      };
    }
    var dn = hgGoldNearestRound(l, step);
    if (isFinite(dn) && l <= dn && (dn - l) >= minPierce && c > dn && op > dn){
      return {
        ok: true, dir: 'long', kind: 'goldround', level: dn, step: step,
        entry: c, stop: l - 0.15 * atr,
        pierceAtr: +((dn - l) / atr).toFixed(2),
        why: 'wick pierced the $' + dn.toFixed(0) + ' round level by '
           + ((dn - l) / atr).toFixed(2) + 'x ATR and closed back above it',
        invalidates: 'a close below $' + dn.toFixed(0)
      };
    }
  }
  return null;
}

/* =================================================================
   4. WEEKLY OPEN SWEEP  (goldwopen)                          hg-v934

   Gold reopens at Sunday 22:00 UTC after the only scheduled closure in its
   week, and the price it opens at is the reference every desk marks for the
   next five days. OMNIGOLD has read it as WEEKLY-OPEN since round five.
   GOLD SCALP and GOLD SWING never got it — the same gap hg-v933 closed for
   ROUND-MAGNET, found the same way and closed the same way.

   IT ARRIVES WITH A RECORD, unlike hg-v933's three. Its OMNIGOLD twin has
   140 settled firings on the gate-clear population, and that record is
   negative and inside the noise (HG_GOLD_SIBLING_RECORD carries the
   numbers). So it still mints demoted — but the card now says what WAS
   measured instead of claiming nothing is known, which is what hg-v933's
   stamp wrongly said about two detectors whose twins had 593 and 87
   firings behind them.

   SWEEP AND RECLAIM ONLY. Price merely trading above the weekly open is not
   a setup, it is Tuesday. The bar has to pierce the level and close back
   through it, having opened on the far side.
   ================================================================= */

var HG_GOLD_WEEK_OPEN_UTC_H = 22;     /* Sunday 22:00 UTC — the gold reopen */

/** Timestamp of a row in ms, accepting the seconds form the gold feeds use. */
function tms(row){
  var t = num(row && row.t);
  if (!isFinite(t)) return NaN;
  return t > 1e11 ? t : t * 1000;
}

/** The most recent Sunday 22:00 UTC at or before `ms`. */
function hgGoldWeekOpenMs(ms){
  if (!isFinite(ms)) return NaN;
  var d = new Date(ms);
  var anchor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
                        HG_GOLD_WEEK_OPEN_UTC_H, 0, 0, 0);
  anchor -= d.getUTCDay() * 864e5;          /* back to Sunday */
  if (anchor > ms) anchor -= 7 * 864e5;     /* Sunday, but before the reopen */
  return anchor;
}

function hgGoldWeeklyOpen(rows, opts){
  var o = opts || {};
  if (!rows || rows.length < 20) return null;
  var lb = last(rows);
  var nowMs = isFinite(o.now) ? o.now : tms(lb);
  var woMs = isFinite(o.weekOpenMs) ? o.weekOpenMs : hgGoldWeekOpenMs(nowMs);
  if (!isFinite(woMs)) return null;

  /* The weekly open is the OPEN of the first bar at or after the reopen —
     not the close of the last bar before it. A feed that starts mid-week
     has no weekly open in it and gets no opinion. */
  var wo = NaN, woIdx = -1;
  for (var i = 0; i < rows.length; i++){
    var t = tms(rows[i]);
    if (isFinite(t) && t >= woMs){ wo = num(rows[i].o); woIdx = i; break; }
  }
  if (!isFinite(wo) || woIdx < 0) return null;
  var minBars = isFinite(o.minBars) ? o.minBars : 3;
  if ((rows.length - 1 - woIdx) < minBars) return null;   /* week has not traded away yet */

  var atr = barAtr(rows, 14);
  if (!isFinite(atr) || !(atr > 0)) return null;
  var minPierce = (isFinite(o.pierceAtr) ? o.pierceAtr : 0.12) * atr;
  var h = num(lb.h), l = num(lb.l), c = num(lb.c), op = num(lb.o);
  if (!isFinite(h) || !isFinite(l) || !isFinite(c) || !isFinite(op)) return null;

  if (h >= wo && (h - wo) >= minPierce && c < wo && op < wo){
    return {
      ok: true, dir: 'short', kind: 'goldwopen', level: wo,
      entry: c, stop: h + 0.15 * atr,
      pierceAtr: +((h - wo) / atr).toFixed(2),
      why: 'wick took the weekly open ' + wo.toFixed(2) + ' by '
         + ((h - wo) / atr).toFixed(2) + 'x ATR and closed back under it',
      invalidates: 'a close above the weekly open ' + wo.toFixed(2)
    };
  }
  if (l <= wo && (wo - l) >= minPierce && c > wo && op > wo){
    return {
      ok: true, dir: 'long', kind: 'goldwopen', level: wo,
      entry: c, stop: l - 0.15 * atr,
      pierceAtr: +((wo - l) / atr).toFixed(2),
      why: 'wick took the weekly open ' + wo.toFixed(2) + ' by '
         + ((wo - l) / atr).toFixed(2) + 'x ATR and closed back above it',
      invalidates: 'a close below the weekly open ' + wo.toFixed(2)
    };
  }
  return null;
}

/* =================================================================
   5. 61.8 RETRACE HOLD  (goldfib)                            hg-v934

   The other OMNIGOLD mechanic the two tabs lack. Same treatment, same
   demote, and its twin FIB-618 carries the same shape of record: negative,
   not significant.

   TWO THINGS KEEP THIS FROM FIRING ON EVERY PULLBACK. The impulse is
   measured on bars STRICTLY BEFORE the trigger bar, so the bar being judged
   cannot define the level it is judged against — the most common way a
   retrace detector fits itself. And the trigger bar has to have traded
   THROUGH the level and closed back on the impulse side; a bar that merely
   ends up near it is not a hold.
   ================================================================= */

var HG_GOLD_FIB_LEVEL = 0.618;
var HG_GOLD_FIB_STOP = 0.786;         /* the next retrace, where the read dies */

function hgGoldFib618(rows, opts){
  var o = opts || {};
  var look = isFinite(o.lookback) ? o.lookback : 40;
  if (!rows || rows.length < 12) return null;
  var atr = barAtr(rows, 14);
  if (!isFinite(atr) || !(atr > 0)) return null;

  var to = rows.length - 2;                       /* EXCLUDES the trigger bar */
  var from = to - look + 1;
  if (from < 0) from = 0;
  if (to - from < 5) return null;

  var hi = -Infinity, lo = Infinity, hiI = -1, loI = -1;
  for (var i = from; i <= to; i++){
    var bh = num(rows[i].h), bl = num(rows[i].l);
    if (isFinite(bh) && bh > hi){ hi = bh; hiI = i; }
    if (isFinite(bl) && bl < lo){ lo = bl; loI = i; }
  }
  if (hiI < 0 || loI < 0 || hiI === loI) return null;
  var span = hi - lo;
  var minSpan = (isFinite(o.minSpanAtr) ? o.minSpanAtr : 1.5) * atr;
  if (!(span > 0) || span < minSpan) return null;

  var lb = last(rows);
  var h = num(lb.h), l = num(lb.l), c = num(lb.c);
  if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;

  if (hiI > loI){
    /* impulse UP — low first, then high. The retrace comes down into it. */
    var lvlU = hi - HG_GOLD_FIB_LEVEL * span;
    if (!(l <= lvlU && h >= lvlU)) return null;   /* must have traded into it */
    if (!(c > lvlU)) return null;                 /* and closed holding it */
    var stopU = Math.min(l, hi - HG_GOLD_FIB_STOP * span) - 0.15 * atr;
    return {
      ok: true, dir: 'long', kind: 'goldfib', level: lvlU,
      entry: c, stop: stopU,
      spanAtr: +(span / atr).toFixed(2),
      why: 'held the 61.8 retrace ' + lvlU.toFixed(2) + ' of the '
         + (span / atr).toFixed(2) + 'x ATR swing up from ' + lo.toFixed(2)
         + ' to ' + hi.toFixed(2),
      invalidates: 'a close below the 78.6 retrace ' + (hi - HG_GOLD_FIB_STOP * span).toFixed(2)
    };
  }
  /* impulse DOWN — high first, then low. The retrace comes up into it. */
  var lvlD = lo + HG_GOLD_FIB_LEVEL * span;
  if (!(h >= lvlD && l <= lvlD)) return null;
  if (!(c < lvlD)) return null;
  var stopD = Math.max(h, lo + HG_GOLD_FIB_STOP * span) + 0.15 * atr;
  return {
    ok: true, dir: 'short', kind: 'goldfib', level: lvlD,
    entry: c, stop: stopD,
    spanAtr: +(span / atr).toFixed(2),
    why: 'rejected the 61.8 retrace ' + lvlD.toFixed(2) + ' of the '
       + (span / atr).toFixed(2) + 'x ATR swing down from ' + hi.toFixed(2)
       + ' to ' + lo.toFixed(2),
    invalidates: 'a close above the 78.6 retrace ' + (lo + HG_GOLD_FIB_STOP * span).toFixed(2)
  };
}

/* =================================================================
   6. THE SIBLING RECORD, AND THE THIRD PORT THAT IS REFUSED   hg-v934

   hg-v933 stamped every one of its detectors NO MEASURED RECORD. That was
   true of the idea and WRONG about the evidence: goldround's OMNIGOLD twin
   ROUND-MAGNET has 587 settled firings in the committed walk and goldfix's
   twin LONDON-FIX has 69. Telling a reader nothing is known, when hundreds
   of measurements of the nearest thing exist, is the same failure as
   quoting them as if they were this desk's.

   So each detector names its twin, and the note carries that twin's
   GATE-CLEAR record — the population that cleared OMNIGOLD's stack, which
   hg-v917 showed is the honest one and is worse for 42 of 54 mechanics than
   the unscoped line. It is attributed every time: OMNIGOLD's gates,
   OMNIGOLD's 1h horizon, not a measurement of this desk.

   golddxy has NO twin. SMT-DIVERGE is the closest registered mechanic and
   it reads divergence where this reads agreement — and it is itself one of
   the 24 never-observed mechanics, so there is no record there to borrow
   even if the read matched. It keeps the honest empty note.

   THE THIRD PORT IS REFUSED. PIVOT-REJECT is the remaining OMNIGOLD
   mechanic these tabs lack, and it is not unmeasured — it is measured and
   it fails: 159 settled firings, 23.3% to T1 first against a 33.3%
   breakeven at 2R, gross -0.3026R, net -0.3727R at XM, -2.69 sigma on the
   naive sample and -2.63 cluster-robust. That is past EDGE_VETO_Z, the
   -2 sigma known-failure bar in omnigold.js that hg-v925 deliberately left
   untouched when it relaxed everything else.

   And the reason this matters more than "it looks bad": GOLD SCALP and
   GOLD SWING HAVE NO MEASURED-EDGE GATE. OMNIGOLD refuses to ticket
   PIVOT-REJECT; these desks have nothing that would. Porting it would move
   a vetoed mechanic onto the one place in the gold stack that cannot veto
   it — laundering, not adding. It is named here so nobody re-derives the
   gap and closes it.
   ================================================================= */

/* omnigold.js EDGE_VETO_Z. Duplicated deliberately — this file must be
   readable without loading that one — and test-gold-sibling-records.mjs
   fails if the two ever disagree, which is the hg-v921 rule for a literal
   that lives in two places. */
var HG_GOLD_EXTRA_VETO_Z = -2;

var HG_GOLD_SIBLING_TWIN = {
  goldfix:   'LONDON-FIX',
  golddxy:   null,
  goldround: 'ROUND-MAGNET',
  goldwopen: 'WEEKLY-OPEN',
  goldfib:   'FIB-618',
  goldpivot: 'PIVOT-REJECT',
  /* hg-v942 roster ports -- the twin IS the mechanic here, not a near
     relative, because detection is OMNIGOLD's own function. The record is
     still OMNIGOLD's gates and 1h horizon, so it is still quoted as a twin. */
  ogstructbos: 'STRUCT-BOS',
  ogsqueeze:   'SQUEEZE-FIRE',
  ogcusum:     'CUSUM-SHIFT',
  ogmmove:     'MMOVE',
  ogtrend:     'TREND-RECLAIM',
  ogbosretest: 'BOS-RETEST'
};

/* WHICH TAB can form each roster kind. hg-v942 asserted coverage was
   exhaustive because every kind "is ported or has a named home" -- and the
   home check never asked WHICH TAB the home was on. EQH-SWEEP's home is
   smcliq, GOLD SCALP has minted it since hg-v564, and GOLD SWING only ever
   STAMPED it, so one of the nine measured-positive gold mechanics could not
   be formed on that tab at all. A per-kind claim cannot see a per-tab hole;
   this table can, and hgGoldRosterTabGaps() reports it. */
var HG_GOLD_TABS = ['goldscalp', 'goldswing'];
var HG_GOLD_ROSTER_TABS = {
  'P5-DRIVE':      ['goldscalp', 'goldswing'],
  'P6-COMP':       ['goldscalp', 'goldswing'],
  'EQH-SWEEP':     ['goldscalp', 'goldswing'],   /* swing added hg-v945 */
  'STRUCT-BOS':    ['goldscalp', 'goldswing'],
  'SQUEEZE-FIRE':  ['goldscalp', 'goldswing'],
  'CUSUM-SHIFT':   ['goldscalp', 'goldswing'],
  'MMOVE':         ['goldscalp', 'goldswing'],
  'TREND-RECLAIM': ['goldscalp', 'goldswing'],
  'BOS-RETEST':    ['goldscalp', 'goldswing']
};

/** Every [kind, tab] pair on the derived roster that the tab cannot form.
    Empty is the claim; a non-empty list is the next hg-v942 hole, named. A
    kind with no entry at all is EVERY tab's gap, never silently skipped. */
function hgGoldRosterTabGaps(){
  var all = hgGoldRosterAll(), out = [], i, j, kind, tabs;
  for (i = 0; i < all.length; i++){
    kind = all[i] && all[i].kind;
    if (!kind) continue;
    tabs = HG_GOLD_ROSTER_TABS[kind] || [];
    for (j = 0; j < HG_GOLD_TABS.length; j++){
      if (tabs.indexOf(HG_GOLD_TABS[j]) < 0) out.push([kind, HG_GOLD_TABS[j]]);
    }
  }
  return out;
}

/* --- BEGIN GENERATED HG_GOLD_SIBLING_RECORD (scripts/gold-sibling-records.mjs) ---
   Every field is re-derived from scripts/omnigold-replay-evidence.json by that
   script. Do not hand-edit: hg-v909 shipped a hand-transcribed block from the
   wrong file, and hg-v921 made the literals write themselves for exactly this
   reason. `npm run gold:siblings` is the read-only drift check. */
var HG_GOLD_SIBLING_RECORD = {
  'BOS-RETEST': { n: 83, settled: 74, winRate: 0.3378, grossR: 0.0367, netXm: 0.0027, tCluster: 0.3, zBreakeven: 0.08, minRr: 2, breakevenPct: 33.3 },
  'CUSUM-SHIFT': { n: 44, settled: 32, winRate: 0.3438, grossR: 0.0918, netXm: 0.0707, tCluster: 0.58, zBreakeven: 0.13, minRr: 2, breakevenPct: 33.3 },
  'EQH-SWEEP': { n: 41, settled: 41, winRate: 0.3659, grossR: 0.0976, netXm: 0.0159, tCluster: 0.36, zBreakeven: 0.44, minRr: 2, breakevenPct: 33.3 },
  'FIB-618': { n: 132, settled: 127, winRate: 0.2992, grossR: -0.0872, netXm: -0.1306, tCluster: -0.9, zBreakeven: -0.82, minRr: 2, breakevenPct: 33.3 },
  'LONDON-FIX': { n: 87, settled: 69, winRate: 0.2464, grossR: -0.2052, netXm: -0.2332, tCluster: -1.76, zBreakeven: -1.53, minRr: 2, breakevenPct: 33.3 },
  'MMOVE': { n: 204, settled: 177, winRate: 0.3559, grossR: 0.0836, netXm: 0.0587, tCluster: 1.54, zBreakeven: 0.64, minRr: 2, breakevenPct: 33.3 },
  'P5-DRIVE': { n: 48, settled: 41, winRate: 0.3902, grossR: 0.2146, netXm: 0.1796, tCluster: 1.55, zBreakeven: 0.77, minRr: 2, breakevenPct: 33.3 },
  'P6-COMP': { n: 98, settled: 82, winRate: 0.3293, grossR: 0.0421, netXm: 0.0186, tCluster: 0.32, zBreakeven: -0.08, minRr: 2, breakevenPct: 33.3 },
  'PIVOT-REJECT': { n: 161, settled: 159, winRate: 0.2327, grossR: -0.3026, netXm: -0.3727, tCluster: -2.63, zBreakeven: -2.69, minRr: 2, breakevenPct: 33.3 },
  'ROUND-MAGNET': { n: 593, settled: 587, winRate: 0.3169, grossR: -0.043, netXm: -0.1095, tCluster: -0.85, zBreakeven: -0.84, minRr: 2, breakevenPct: 33.3 },
  'SQUEEZE-FIRE': { n: 50, settled: 45, winRate: 0.3556, grossR: 0.1082, netXm: 0.0746, tCluster: 0.55, zBreakeven: 0.32, minRr: 2, breakevenPct: 33.3 },
  'STRUCT-BOS': { n: 103, settled: 87, winRate: 0.3448, grossR: 0.1085, netXm: 0.0816, tCluster: 1.22, zBreakeven: 0.23, minRr: 2, breakevenPct: 33.3 },
  'TREND-RECLAIM': { n: 106, settled: 99, winRate: 0.3636, grossR: 0.0923, netXm: 0.0549, tCluster: 0.83, zBreakeven: 0.64, minRr: 2, breakevenPct: 33.3 },
  'WEEKLY-OPEN': { n: 143, settled: 140, winRate: 0.3, grossR: -0.0904, netXm: -0.1591, tCluster: -1.14, zBreakeven: -0.84, minRr: 2, breakevenPct: 33.3 }
};
/* --- END GENERATED HG_GOLD_SIBLING_RECORD --- */

/** The twin's measured record for a scalp/swing kind, or null when it has no
    twin (golddxy) or the twin was never observed. */
function hgGoldSiblingRecord(kind){
  var twin = HG_GOLD_SIBLING_TWIN[String(kind || '')];
  if (!twin) return null;
  var rec = HG_GOLD_SIBLING_RECORD[twin];
  if (!rec) return null;
  var out = { twin: twin };
  for (var k in rec){ if (Object.prototype.hasOwnProperty.call(rec, k)) out[k] = rec[k]; }
  return out;
}

/** Is this kind's twin a MEASURED FAILURE by omnigold's own veto bar? */
function hgGoldSiblingVetoed(kind){
  var rec = hgGoldSiblingRecord(kind);
  if (!rec || !isFinite(rec.zBreakeven)) return false;
  return rec.zBreakeven <= HG_GOLD_EXTRA_VETO_Z;
}

function sgn(n){ return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(4); }

/** The stamp the card carries — record-aware, so it stops saying NO RECORD
    about a detector whose twin has hundreds of firings. */
function hgGoldExtraStamp(kind){
  var name = String(kind || 'mechanic').toUpperCase();
  var rec = hgGoldSiblingRecord(kind);
  if (!rec) return name + ' · NO RECORD';
  return name + ' · ' + rec.twin + ' RECORD ' + sgn(rec.netXm) + 'R';
}

/* ------------------------------------------------ promotion, off by default */

var HG_GOLD_EXTRA_LS_KEY = 'hg_gold_extra_promotable';
var HG_GOLD_EXTRA_PROMOTABLE = false;

function hgGoldExtraInit(){
  try{
    var ovr = W.HG_GOLD_EXTRA_PROMOTABLE;
    if (ovr === true || ovr === false){ HG_GOLD_EXTRA_PROMOTABLE = ovr; return HG_GOLD_EXTRA_PROMOTABLE; }
    var v = null;
    try { v = localStorage.getItem(HG_GOLD_EXTRA_LS_KEY); } catch (e){ v = null; }
    HG_GOLD_EXTRA_PROMOTABLE = (v === '1' || v === 'true');
  }catch(e){ HG_GOLD_EXTRA_PROMOTABLE = false; }
  return HG_GOLD_EXTRA_PROMOTABLE;
}
function hgGoldExtraSetPromotable(on){
  HG_GOLD_EXTRA_PROMOTABLE = (on === true);
  try { localStorage.setItem(HG_GOLD_EXTRA_LS_KEY, HG_GOLD_EXTRA_PROMOTABLE ? '1' : '0'); } catch (e){}
  return HG_GOLD_EXTRA_PROMOTABLE;
}
function hgGoldExtraPromotable(){ return HG_GOLD_EXTRA_PROMOTABLE === true; }

/** The line every one of these cards carries until it has a record OF ITS OWN.

    hg-v933's version of this said NO MEASURED RECORD unconditionally. For
    goldround and goldfix that was false — see section 6. It now names the
    twin and quotes the twin's gate-clear record, attributed, or says plainly
    that there is no twin at all. */
function hgGoldExtraUncheckedNote(kind){
  var name = String(kind || 'this mechanic').toUpperCase();
  var rec = hgGoldSiblingRecord(kind);
  if (!rec){
    return 'NO MEASURED RECORD — ' + name + ' has never been through a bake, and no '
      + 'OMNIGOLD mechanic reads the same thing, so there is not even a sibling '
      + 'record to borrow. It paints with its levels and cannot lead until a walk '
      + 'gives it one. That is the same rule this desk applies to its never-observed '
      + 'OMNIGOLD mechanics, and it is not a comment on the idea — it is the absence '
      + 'of evidence about it.';
  }
  return 'NO RECORD ON THIS DESK — ' + name + ' has never been through a GOLD SCALP or '
    + 'GOLD SWING bake. Its OMNIGOLD twin ' + rec.twin + ' has one: ' + rec.settled
    + ' settled firings on the gate-clear population, ' + (rec.winRate * 100).toFixed(1)
    + '% to T1 first against a ' + (rec.breakevenPct).toFixed(1) + '% breakeven at '
    + rec.minRr + 'R, ' + sgn(rec.grossR) + 'R gross, ' + sgn(rec.netXm)
    + 'R net at XM, ' + sgn(rec.zBreakeven) + ' sigma. That is OMNIGOLD\'s record on '
    + 'OMNIGOLD\'s gates and its 1h horizon — the nearest measurement that exists, not '
    + 'a measurement of this. Below breakeven and inside the noise, which is why this '
    + 'paints with its levels and still cannot lead.';
}

/* ================= hg-v942 — THE ROSTER MECHANICS THESE TABS CANNOT FORM =====
   MILLI GOLD's roster is the nine OMNIGOLD mechanics whose GATE-CLEAR record is
   net-positive at XM on at least MIN_SAMPLES firings. It is derived, not
   chosen (scripts/milli-gold-roster.mjs). Six of those nine have no mechanic on
   GOLD SCALP or GOLD SWING at all: a trader working from the two tabs cannot
   form them, whatever the tape does.

   WHAT THIS IS NOT. A positive in-sample record is not a forecast, and this
   desk has measured that directly: hg-v937 rebuilt the roster on the earlier
   part of the walk and judged it on what came after, and it beat the full
   OMNIGOLD book in 6 of 6 trials and PAID IN 0 OF 6. So the claim here is the
   narrow one -- these six are the best-measured mechanics the two tabs lack,
   and they are absent -- not that adding them makes the desks pay.

   NO SECOND COPY. Detection is OMNIGOLD's own dispatch table, hgOgBtDetectors(),
   which is already exported and is the same pure rows->hit|null function the
   live pass and the backtest call. Rebuilding these here is the copy that
   drifts (hg-v938's lesson). GATING is the tab's, in full: the hit becomes an
   ordinary candidate and goes through the inst filter, the stop-width floor,
   the edge table, the confluence ledger and best-levels like every other.

   AND THEY MINT DEMOTED, because the record quoted on the card is OMNIGOLD's,
   on OMNIGOLD's gates and its 1h horizon -- not this desk's. Same rule the
   hg-v933 extras carry. hgGoldExtraSetPromotable(true) lifts it. */

/* Roster kinds whose mechanic the gold tabs ALREADY mint, with the tab key that
   is its home. Kept explicit so the guard can assert the roster is covered
   EXHAUSTIVELY: every kind is either ported or homed, and a re-bake that adds a
   kind fails loudly here instead of being silently skipped. */
var HG_GOLD_ROSTER_HOME = {
  'P5-DRIVE':  'p5drive',    /* S24 three-drive exhaustion, scalp + swing */
  'P6-COMP':   'p6comp',     /* S30 session-composite pullback */
  'EQH-SWEEP': 'smcliq'      /* SMC equal-high/low pool sweep (hg-v564) */
};

/* hg-v945: the three HOMED roster kinds belong in the twin map too, and they
   are ADDED FROM HG_GOLD_ROSTER_HOME rather than retyped, so one list decides
   both. hg-v942 declared the home -- "this tab already has a mechanic that
   reads this" -- and stopped there, so hgGoldSiblingRecord('smcliq') returned
   null and hgGoldExtraUncheckedNote would have told a reader that "no OMNIGOLD
   mechanic reads the same thing", while v942's own table named one. That is
   the hg-v934 failure exactly: claiming nothing is known where a measurement
   of the nearest thing exists.

   A home is not automatically a twin -- hg-v943 refused four loose analogies
   (nyexh is not NY-OPEN-DRIVE, liqsweep is not PDL-SWEEP). These three are not
   analogies: P5-DRIVE/p5drive and P6-COMP/p6comp are the same Part5/Part6
   mechanic, and EQH-SWEEP/smcliq both read a cluster of equal swing highs or
   lows, swept, with a close back through it. Wiring them here also puts them
   under the measured-failure veto, which is where a re-bake that turns one
   negative should reach them. */
for (var __rh in HG_GOLD_ROSTER_HOME){
  if (!Object.prototype.hasOwnProperty.call(HG_GOLD_ROSTER_HOME, __rh)) continue;
  if (HG_GOLD_SIBLING_TWIN[HG_GOLD_ROSTER_HOME[__rh]] === undefined)
    HG_GOLD_SIBLING_TWIN[HG_GOLD_ROSTER_HOME[__rh]] = __rh;
}


/* The tab key each ported kind mints under. `og` prefix says plainly whose
   mechanic it is; the name is not borrowed from a tab mechanic that already
   exists, because two things under one key is how a record gets attributed to
   the wrong mechanic (hg-v923). */
var HG_GOLD_ROSTER_KEY = {
  'STRUCT-BOS':    'ogstructbos',
  'SQUEEZE-FIRE':  'ogsqueeze',
  'CUSUM-SHIFT':   'ogcusum',
  'MMOVE':         'ogmmove',
  'TREND-RECLAIM': 'ogtrend',
  'BOS-RETEST':    'ogbosretest'
};

/* Stop distance floor for a ported hit, in ATR. The detectors name a LEVEL and
   no stop -- OMNIGOLD prices its own through hgOgPlanForHit, which these tabs
   must not use (hg-v420/v423). So one shared rule, stated once rather than
   invented per mechanic: the stop sits beyond the recent extreme on the wrong
   side of the level, pushed a further 0.15xATR, and never closer than this. */
var HG_GOLD_ROSTER_MIN_STOP_ATR = 0.35;
var HG_GOLD_ROSTER_STOP_PAD_ATR = 0.15;
var HG_GOLD_ROSTER_STOP_LOOK = 12;

/* The roster, read from MILLI GOLD at call time. ONE roster: a re-bake that
   changes which mechanics qualify changes what these tabs form, with no second
   edit and no literal to drift. Absent milligold.js is [] -- these tabs then
   behave exactly as they did before this pack. */
function hgGoldRosterAll(){
  try{
    var r = W && W.HG_MILLI_ROSTER;
    var k = (r && Array.isArray(r.kinds)) ? r.kinds : null;
    return k ? k.slice() : [];
  }catch(e){ return []; }
}

/* Roster entries this file will port: on the roster, and with no home on the
   tabs. Each carries the roster row so the card can quote the real record. */
function hgGoldRosterPorts(){
  var all = hgGoldRosterAll(), out = [], i, row, kind;
  for (i = 0; i < all.length; i++){
    row = all[i]; kind = row && row.kind;
    if (!kind || HG_GOLD_ROSTER_HOME[kind]) continue;
    if (!HG_GOLD_ROSTER_KEY[kind]) continue;
    out.push({ kind: kind, key: HG_GOLD_ROSTER_KEY[kind], row: row });
  }
  return out;
}

/* Roster kinds that are NEITHER homed NOR keyed -- always empty today, and the
   guard asserts it. A re-bake that promotes a tenth mechanic shows up here
   rather than vanishing, which is the whole point of keeping it. */
function hgGoldRosterUnmapped(){
  var all = hgGoldRosterAll(), out = [], i, kind;
  for (i = 0; i < all.length; i++){
    kind = all[i] && all[i].kind;
    if (!kind) continue;
    if (HG_GOLD_ROSTER_HOME[kind] || HG_GOLD_ROSTER_KEY[kind]) continue;
    out.push(kind);
  }
  return out;
}

/* The shared stop rule. dir/level/atr in, stop out, NaN when it cannot be
   computed -- a candidate with no stop is never minted. */
/* num() coerces: +null is 0, +'' is 0, +false is 0 — so a bar carrying null
   for its low reads as a LOW OF ZERO and the rule below happily prices a stop
   against it. That is the same coercion trap hg-v941 hit on a null age. Here a
   value that is not a number, and not a string that parses as one, is
   UNREADABLE, and an unreadable series yields NaN rather than a guess. */
function hgGoldRosterPx(x){
  if (x === null || x === undefined || x === '' || typeof x === 'boolean') return NaN;
  return num(x);
}

function hgGoldRosterStop(rows, dir, level, atr){
  if (!rows || !rows.length) return NaN;
  if (!isFinite(level) || !isFinite(atr) || !(atr > 0)) return NaN;
  var look = HG_GOLD_ROSTER_STOP_LOOK;
  var from = rows.length - look;
  if (from < 0) from = 0;
  var ext = NaN, i, v;
  for (i = from; i < rows.length; i++){
    v = (dir === 'long') ? hgGoldRosterPx(rows[i].l) : hgGoldRosterPx(rows[i].h);
    if (!isFinite(v)) continue;
    if (!isFinite(ext)) ext = v;
    else if (dir === 'long'){ if (v < ext) ext = v; }
    else if (v > ext) ext = v;
  }
  if (!isFinite(ext)) return NaN;
  var pad = HG_GOLD_ROSTER_STOP_PAD_ATR * atr;
  var stop = (dir === 'long') ? Math.min(ext, level) - pad : Math.max(ext, level) + pad;
  var floor = HG_GOLD_ROSTER_MIN_STOP_ATR * atr;
  if (dir === 'long' && level - stop < floor) stop = level - floor;
  if (dir === 'short' && stop - level < floor) stop = level + floor;
  return stop;
}

/* Run the ported roster detectors on ONE series -- the desk's execution TF
   (15m on GOLD SCALP, 4h on GOLD SWING), passed by the caller. Never throws:
   a detector that throws costs its own mechanic and nothing else, and an
   absent dispatch table costs the whole block and leaves the desk as it was. */
function hgGoldRosterDetect(rows, opts){
  var o = opts || {};
  var out = [];
  if (!rows || rows.length < 20) return out;
  var D = null;
  try{ D = (W && typeof W.hgOgBtDetectors === 'function') ? W.hgOgBtDetectors() : null; }
  catch(eD){ D = null; }
  if (!D) return out;
  var atr = barAtr(rows, 14);
  if (!isFinite(atr) || !(atr > 0)) return out;

  var ports = hgGoldRosterPorts(), i, p, fn, hit, stop, lvl;
  for (i = 0; i < ports.length; i++){
    p = ports[i];
    fn = D[p.kind];
    if (typeof fn !== 'function') continue;
    hit = null;
    try{ hit = fn(rows); }catch(eF){ hit = null; }
    if (!hit || (hit.dir !== 'long' && hit.dir !== 'short')) continue;
    lvl = num(hit.level);
    if (!isFinite(lvl)) continue;
    stop = hgGoldRosterStop(rows, hit.dir, lvl, atr);
    if (!isFinite(stop)) continue;
    out.push({
      ok: true, dir: hit.dir, kind: p.key, level: lvl,
      entry: lvl,                       /* the ticket IS the setup (hg-v423) */
      stop: stop,
      rosterKind: p.kind,
      why: (hit.why ? String(hit.why) : p.kind.toLowerCase())
         + ' — OMNIGOLD ' + p.kind + ' detector, priced at its own level',
      invalidates: 'a close beyond ' + stop.toFixed(2) + ' breaks the level this setup is built on'
    });
  }
  return out;
}

/** Every detector behind one call, so the desks wire once. */
function hgGoldExtraDetect(inp){
  var o = inp || {};
  var rows = o.rows || o.rows15m || o.rows4h;
  var out = [];
  if (!rows || !rows.length) return out;
  try { var f = hgGoldFixFade(rows, o); if (f) out.push(f); }catch(e){}
  try { var d = hgGoldDxyDivergence(rows, o.dxyRows, o); if (d) out.push(d); }catch(e){}
  try { var r = hgGoldRoundReject(rows, o); if (r) out.push(r); }catch(e){}
  try { var w = hgGoldWeeklyOpen(rows, o); if (w) out.push(w); }catch(e){}
  try { var b = hgGoldFib618(rows, o); if (b) out.push(b); }catch(e){}
  /* hg-v942: the MILLI GOLD roster mechanics these tabs cannot form. Same
     series the caller handed us -- the desk's execution TF, not a second
     fetch. The veto below applies to these exactly as to the rest, so a
     re-bake that turns one of them measured-failing stops it minting here
     with no edit. */
  try {
    var rp = hgGoldRosterDetect(rows, o) || [];
    for (var ri = 0; ri < rp.length; ri++) out.push(rp[ri]);
  }catch(e){}
  /* A detector whose twin is a MEASURED FAILURE never reaches a card. Nothing
     in hgGoldExtraDetect mints goldpivot — this is the guard for the day
     someone adds one, because these desks have no measured-edge gate to
     catch it downstream. */
  var kept = [];
  for (var qi = 0; qi < out.length; qi++){
    if (!hgGoldSiblingVetoed(out[qi] && out[qi].kind)) kept.push(out[qi]);
  }
  return kept;
}

W.HG_GOLD_FIX_HOURS = HG_GOLD_FIX_HOURS;
W.hgGoldFixWindow = hgGoldFixWindow;
W.hgGoldFixFade = hgGoldFixFade;
W.hgGoldDxyDivergence = hgGoldDxyDivergence;
W.hgGoldNearestRound = hgGoldNearestRound;
W.hgGoldRoundReject = hgGoldRoundReject;
W.hgGoldExtraDetect = hgGoldExtraDetect;
W.hgGoldExtraInit = hgGoldExtraInit;
W.hgGoldExtraSetPromotable = hgGoldExtraSetPromotable;
W.hgGoldExtraPromotable = hgGoldExtraPromotable;
W.hgGoldExtraUncheckedNote = hgGoldExtraUncheckedNote;
W.HG_GOLD_ROUND_STEPS = HG_GOLD_ROUND_STEPS;
W.HG_GOLD_WEEK_OPEN_UTC_H = HG_GOLD_WEEK_OPEN_UTC_H;
W.hgGoldWeekOpenMs = hgGoldWeekOpenMs;
W.hgGoldWeeklyOpen = hgGoldWeeklyOpen;
W.hgGoldFib618 = hgGoldFib618;
W.HG_GOLD_FIB_LEVEL = HG_GOLD_FIB_LEVEL;
W.HG_GOLD_FIB_STOP = HG_GOLD_FIB_STOP;
W.HG_GOLD_SIBLING_TWIN = HG_GOLD_SIBLING_TWIN;
W.HG_GOLD_SIBLING_RECORD = HG_GOLD_SIBLING_RECORD;
W.HG_GOLD_EXTRA_VETO_Z = HG_GOLD_EXTRA_VETO_Z;
W.hgGoldSiblingRecord = hgGoldSiblingRecord;
W.hgGoldSiblingVetoed = hgGoldSiblingVetoed;
W.hgGoldExtraStamp = hgGoldExtraStamp;
W.HG_GOLD_ROSTER_HOME = HG_GOLD_ROSTER_HOME;
W.HG_GOLD_ROSTER_KEY = HG_GOLD_ROSTER_KEY;
W.HG_GOLD_ROSTER_MIN_STOP_ATR = HG_GOLD_ROSTER_MIN_STOP_ATR;
W.hgGoldRosterAll = hgGoldRosterAll;
W.hgGoldRosterPorts = hgGoldRosterPorts;
W.hgGoldRosterUnmapped = hgGoldRosterUnmapped;
W.HG_GOLD_TABS = HG_GOLD_TABS;
W.HG_GOLD_ROSTER_TABS = HG_GOLD_ROSTER_TABS;
W.hgGoldRosterTabGaps = hgGoldRosterTabGaps;
W.hgGoldRosterPx = hgGoldRosterPx;
W.hgGoldRosterStop = hgGoldRosterStop;
W.hgGoldRosterDetect = hgGoldRosterDetect;

})();
