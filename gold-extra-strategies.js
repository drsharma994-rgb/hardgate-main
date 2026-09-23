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

/** The line every one of these cards carries until it has a record. */
function hgGoldExtraUncheckedNote(kind){
  return 'NO MEASURED RECORD — ' + String(kind || 'this mechanic').toUpperCase()
    + ' was added in hg-v933 and has never been through a bake, so nothing is '
    + 'known about whether it pays. It paints with its levels and cannot lead '
    + 'until a walk gives it one. That is the same rule this desk applies to '
    + 'its never-observed OMNIGOLD mechanics, and it is not a comment on the '
    + 'idea — it is the absence of evidence about it.';
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
  return out;
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

})();
