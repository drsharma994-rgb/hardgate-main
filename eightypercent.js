/* =========================================================================
HARDGATE — eightypercent.js
80PERCENT tab (GOLD group): the High-Momentum Trend Dip-Buyer, implemented
exactly as specified, run across the whole scalp-to-swing ladder, and priced
honestly at every rung.

THE SPEC, IMPLEMENTED LITERALLY

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

All four conditions must hold on the SAME candle. Nothing is loosened,
tightened or "improved" — the indicator functions are the desk's own
(indicators.js ema / rsi / atr, Wilder-smoothed RSI and ATR), and the rules
are transcribed one to one so the tab can be checked against the spec line
by line.

WHY THIS TAB RUNS A LADDER AND NOT ONE TIMEFRAME

The spec was written for 5m. On 5m this desk found two things.

  1. The spec fires almost never. Its trend condition (close above the 50
     EMA) and its pullback condition (RSI(14) below 45) pull against each
     other: fourteen net-down bars usually leave the close under a 50-period
     EMA. On synthetic 5m the pair coincided ~60x LESS often than
     independence predicts. A tab that only ever showed 5m setups was
     therefore a tab that showed nothing, on most days, forever.

  2. It cannot pay on 5m anyway, and the reason is arithmetic. Risking
     4.00 ATR to make 0.75 ATR needs 4.00 / 4.75 = 84.2105% before a cent
     of cost. Cost is a fixed FRACTION OF PRICE; the target is a fraction
     of ATR. So the shorter the timeframe, the smaller the target in
     dollars, the larger the spread as a share of it, and the higher the
     rate the trade must hit. On 5m gold one round trip is a third of the
     entire winner.

Both problems point the same way: UP the ladder. A bigger ATR is a bigger
target in dollars against the same percentage cost, so the required rate
falls back towards the gross bar; and there are more distinct swings per
bar, so the conditions get a chance to coincide. The tab therefore runs the
identical protocol on 5m, 15m, 1h, 4h and 1d, prices each rung separately
from ITS OWN live ATR, and shows where the claim can and cannot survive.

Nothing is loosened to make setups appear. The four conditions are the same
four at every rung. What changes is only the bar the conditions are read on.

THE ONE DEVIATION, AND IT IS LABELLED

The session filter is 13:00-18:00 UTC — five hours. A bar can only be
inside a five-hour window if the WHOLE bar fits in it. At 4h the venue's
bars open 00/04/08/12/16/20 UTC and not one of them lies wholly inside
13:00-18:00; at 1d it is hopeless. So at those two rungs the filter is not
"passed", it is INAPPLICABLE, and applying it would have meant either
admitting bars that spend most of their life outside the session or firing
nothing at all for a reason the spec never intended.

hg80SessionApplies() decides that by arithmetic on the timeframe, not by a
hand-written list, and every card at 4h and 1d says in as many words that
the session rule was dropped there and why. A deviation you can read is a
deviation; one you cannot is a bug.

WHY EVERY SETUP IS A WATCH

hg-v756 made measured-edge a hard gate: a ticket needs a measured edge. This
strategy has no record on this desk — it has never been walked, and its 85%
is an assertion, not a measurement. Under the desk's own rule that makes
every 80PERCENT setup a WATCH, exactly as TAURIC is. Every fired setup is
written to the forward log under OMNIGOLD:P80, tagged with the rung it fired
on, so the claim becomes testable per timeframe rather than as one pooled
blur: 5m and 1d are not the same strategy and must not share a record.

WHAT IS ON THE TAB WHEN NOTHING HAS FIRED

Everything except a setup, because "nothing fired" is not the same as
"nothing to say":

  - the required-rate table, recomputed from each rung's live ATR
  - the ladder board: where price, RSI and ATR actually are right now, and
    how far each rung is from firing, by name and by number
  - near misses: bars that met three of the four and which one they missed
  - setups that fired inside the fetched window and are still unresolved
  - setups that fired and have since resolved, with their outcome

The near-miss list is labelled as such and is never a setup. The resolved
list carries outcomes and NO win rate: a handful of firings inside one
fetch is not a measurement, and this desk does not print rates it has not
earned. The forward log and scripts/walk-80percent.mjs are what answer that.

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
/* ---------------------------------------------------------------------
   THE SECOND MECHANIC

   hg-v773's census showed what the pullback threshold alone turns away: at
   RSI 55 instead of 45 the same three other conditions fire many times more
   often. This wires that column as a SEPARATE mechanic so it can be
   measured instead of argued about.

   IT IS NOT A LOOSENED SPEC. It is a second, named strategy that the tab
   scans alongside the first, renders under its own label and records under
   its own mechanic. The spec's 45 and 55 are untouched and are still what
   P80 means.

   THE TWO POPULATIONS ARE DISJOINT, AND THAT IS THE POINT. RSI < 45 implies
   RSI < 55, so every spec firing is also a wide firing — recording both
   under WIDE would fill its record with spec-quality trades and its measured
   rate would answer the wrong question. A bar is assigned to the TIGHTEST
   variant that fires it, so WIDE's record contains only the bars the spec
   rejected: exactly the marginal trades whose value is in question. Anyone
   who wants "wide as actually traded" pools the two records, which is
   arithmetic; nobody can un-mix them once they are mixed, which is not.

   What it does NOT change is the bar. The breakeven is set by 4.00 and 0.75
   and by nothing else, so WIDE needs the same 84.2105% gross that SPEC
   needs, on bars the spec judged not yet a pullback. That is the whole
   trade-off and it is printed on every WIDE card.
   --------------------------------------------------------------------- */
var P80_RSI_WIDE_LONG  = 55;        /* long pullback, loosened: RSI below this */
var P80_RSI_WIDE_SHORT = 45;        /* short pullback, loosened: RSI above this */

/* Ordered TIGHTEST FIRST. hg80Scan takes the first that fires, which is what
   makes the populations disjoint, and it is only valid because each entry is
   a strict superset of the one before it — asserted in the tests, not
   assumed here. */
var P80_VARIANTS = [
  { key: 'spec', label: 'SPEC', mech: 'P80',
    rsiLong: P80_RSI_LONG,      rsiShort: P80_RSI_SHORT },
  { key: 'wide', label: 'WIDE', mech: 'P80W',
    rsiLong: P80_RSI_WIDE_LONG, rsiShort: P80_RSI_WIDE_SHORT }
];

var P80_TAB         = 'OMNIGOLD:P80';
var P80_HORIZON_BARS = 48;          /* resolve within this many bars, then expire */
/* the rate the supplied strategy claims. An INPUT to the arithmetic, never
   a result of it — it is the thing being tested, and it is printed only
   ever beside the word "claim". */
var P80_CLAIMED     = 0.85;
/* this desk's own minimum stop distance, as a percent of entry */
var P80_STOP_FLOOR  = 0.50;
/* how far back the near-miss scan looks, in bars */
var P80_NEARMISS_BARS = 80;
/* how many near misses one rung may list */
var P80_NEARMISS_MAX  = 3;

/* ---------------------------------------------------------------------
   THE LADDER

   Two scalp rungs and three swing rungs, every one running the identical
   protocol. `bars` is what is asked for; EMA200 eats the first 200 of
   whatever comes back, so the usable scan window is what is left.

   The band is descriptive, not functional: nothing in the protocol reads
   it. It exists because "scalp" and "swing" are the words a desk uses and
   the required-rate table is easier to read when they are grouped.
   --------------------------------------------------------------------- */
var P80_LADDER = [
  { tf: '5m',  sec: 300,   bars: 500, band: 'scalp' },
  { tf: '15m', sec: 900,   bars: 500, band: 'scalp' },
  { tf: '1h',  sec: 3600,  bars: 500, band: 'swing' },
  { tf: '4h',  sec: 14400, bars: 400, band: 'swing' },
  { tf: '1d',  sec: 86400, bars: 400, band: 'swing' }
];

/* focus: null scans the whole ladder; an ARRAY of timeframes scans only
   those rungs and shows EVERY firing in their windows instead of just the
   latest on each.

   It is a set rather than a single choice because the useful comparisons on
   this ladder are between rungs, not within one. 4h and 1d are the two that
   carry no session gate, so they are the pair a desk watching gold outside
   13:00-18:00 UTC actually has; 5m/15m/1h are the three that share one. A
   control that could only hold one made you reload to compare them.

   Deliberately NOT persisted — the venue is desk-wide state that belongs in
   storage, a view filter is not, and this tab writing a second key would
   make "what is stored about the gold desk" two places instead of one. */
/* view: 'simple' shows setups as trades — direction, entry, stop, target,
   and what each is worth in points and percent. 'full' adds the arithmetic,
   the board, the census and the near misses.

   SIMPLE IS THE DEFAULT and that is a correction, not a preference. This tab
   grew required-rate tables, condition censuses, distance-to-firing columns
   and three panels of caveats, and somewhere in there stopped answering
   "what is the trade". Everything still exists; it is one click away instead
   of first. */
var __p = { ui: null, busy: false, ranOnce: false, last: null, focus: null, view: 'simple' };

/* the focus as an array, whatever it is stored as */
function hg80FocusList(){
  if (!__p.focus) return [];
  return (typeof __p.focus === 'string') ? [__p.focus] : __p.focus.slice();
}
function hg80FocusHas(tf){ return hg80FocusList().indexOf(tf) >= 0; }

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
function fin(v){ var n = Number(v); return isFinite(n) ? n : NaN; }
function num(v, d){ return isFinite(fin(v)) ? fin(v).toFixed(d == null ? 2 : d) : '—'; }
function pctTxt(v, d){ return isFinite(fin(v)) ? (fin(v) * 100).toFixed(d == null ? 2 : d) + '%' : '—'; }
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
/* ---------------------------------------------------------------------
   MAKE SURE THE DESK HAS A VENUE BEFORE PRICING ANYTHING

   hgOgVenueInit() — which applies the persisted choice, or the desk's XM
   default when nothing is stored — runs inside the OMNIGOLD tab's mount and
   nowhere else. Open this tab without having opened that one and
   __ogVenueSel is still '', so hgOgVenueCost() returns its conservative
   PAXG fallback: every rung priced at 0.26% round trip instead of XM's
   0.020%, which on 5m gold is the difference between "needs 89.74%" and
   "needs 178.16%, unreachable". A tab whose headline number depends on
   which OTHER tab you opened first is a tab reporting an accident.

   Called ONCE per page load. Repeating it would undo an in-session choice
   whenever localStorage is unavailable — hgOgVenueInit() resolves to '' in
   that case, and '' means PAXG — so a selection made on this tab would
   silently revert on the next scan.
   --------------------------------------------------------------------- */
var __p80VenueInit = false;

function hg80VenueEnsure(){
  if (__p80VenueInit) return;
  __p80VenueInit = true;
  try { if (typeof W.hgOgVenueInit === 'function') W.hgOgVenueInit(); } catch (e){}
}

function hg80VenueRt(){
  try {
    if (typeof W.hgOgVenueCost !== 'function') return null;
    var v = W.hgOgVenueCost();
    if (!v) return null;
    /* THE CONTRACT IS rtCostPct, AND IT IS A PERCENT.
       hgOgVenueCost() returns { venue, rtCostPct, basis } with rtCostPct in
       PERCENT — 0.020 means 0.020%, not 2%. Reading a field called rtFrac
       here is what this function did from hg-v770 until hg-v774, and since
       no such field exists it returned null every time: the required-rate
       table, the one number on this tab worth reading, never rendered in the
       live app at all. It was invisible because the tests supplied their own
       mock in the shape this function expected instead of the shape omnigold
       actually returns, so both sides of a broken seam agreed with each
       other. The tests now call the real function. */
    var pct = fin(v.rtCostPct);
    if (isFinite(pct) && pct >= 0){
      return { rtFrac: pct / 100, rtCostPct: pct,
               venue: v.venue || v.name || null, basis: v.basis || null };
    }
    /* a provider that reports a fraction directly is still honoured, but it
       is the fallback, not the contract */
    var fr = fin(v.rtFrac);
    if (isFinite(fr) && fr >= 0){
      return { rtFrac: fr, rtCostPct: fr * 100,
               venue: v.venue || v.name || null, basis: v.basis || null };
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
   CAN THE SESSION RULE EVEN BE APPLIED AT THIS TIMEFRAME?

   A bar belongs to a five-hour window only if the WHOLE bar is inside it.
   Bars on every timeframe this desk fetches align to a multiple of the
   timeframe from midnight UTC, so the question is whether any such
   multiple opens at or after 13:00 and closes at or before 18:00.

     5m, 15m, 1h   yes  — 13:00 itself is an aligned open and the bar closes
                          well inside the window
     4h            NO   — opens are 00/04/08/12/16/20; 12:00 starts too
                          early and 16:00 ends at 20:00, four hours past
     1d            NO   — the bar is longer than the window

   Returned as a fact about the timeframe, computed here, so no rung has to
   carry a hand-written flag that can drift out of step with its seconds.
   --------------------------------------------------------------------- */
/* Seconds until 13:00 UTC next comes round, 0 while inside the window. The
   three intraday rungs are structurally unable to fire outside it, and "it
   is 05:00, the window opens in eight hours" is a better answer to "why is
   there nothing" than five rows of chips a reader has to decode. */
/* ---------------------------------------------------------------------
   THE CLOCK, IN THE READER'S OWN TIME

   Every rule in this spec is written in UTC and every time on this tab was
   printed in UTC, which is correct and unreadable. A desk in India reading
   "the window opens at 13:00 UTC" has to do arithmetic before it knows
   whether that is lunchtime or bedtime, and a five-and-a-half hour offset is
   exactly the kind you get wrong in your head.

   So times are shown in the BROWSER'S OWN zone with UTC kept beside them.
   Not a hardcoded IST: the offset comes from the runtime, so it is right in
   Mumbai, right in London, and right after a daylight-saving change that
   nobody remembered to code for.
   --------------------------------------------------------------------- */
function hg80TzName(){
  try {
    var n = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (n) return String(n);
  } catch (e){}
  var off = -(new Date().getTimezoneOffset());
  var sign = off >= 0 ? '+' : '-';
  var a = Math.abs(off);
  return 'UTC' + sign + Math.floor(a / 60) + (a % 60 ? ':' + (a % 60) : '');
}

/* Short local-zone abbreviation where the runtime offers one (IST, GMT,
   EDT...), otherwise the offset. */
function hg80TzShort(){
  try {
    var s = new Date().toLocaleTimeString('en-GB', { timeZoneName: 'short' });
    var m = s.match(/[A-Z]{2,5}$|GMT[+-][0-9:]+$/);
    if (m) return m[0];
  } catch (e){}
  return hg80TzName();
}

/* A bar's time, local first because that is the one a reader acts on, UTC
   second because that is the one the rules are written in. */
function hg80WhenTxt(tSec, withDate){
  var t = fin(tSec);
  if (!isFinite(t) || t <= 0) return '—';
  var d = new Date(t * 1000);
  var loc = '';
  try {
    loc = d.toLocaleString('en-GB', withDate
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e){ loc = ''; }
  /* the date is carried once, by the local half — repeating it in the UTC
     half doubles the length of every card header for no information */
  var utc = d.toISOString().slice(11, 16) + ' UTC';
  return loc ? (loc + ' ' + hg80TzShort() + ' · ' + utc)
             : (d.toISOString().replace('T', ' ').slice(withDate ? 0 : 11, 16) + ' UTC');
}

/* The session window expressed in local time. Built by formatting real
   instants rather than adding an offset by hand, so a half-hour zone and a
   window that crosses midnight both come out right. */
function hg80SessionLocalTxt(){
  try {
    var now = new Date();
    var y = now.getUTCFullYear(), m = now.getUTCMonth(), dd = now.getUTCDate();
    var a = new Date(Date.UTC(y, m, dd, P80_UTC_FROM, 0, 0));
    var b = new Date(Date.UTC(y, m, dd, P80_UTC_TO, 0, 0));
    var f = function(x){ return x.toLocaleString('en-GB',
      { hour: '2-digit', minute: '2-digit', hour12: false }); };
    var aDay = a.toLocaleDateString('en-GB', { day: '2-digit' });
    var bDay = b.toLocaleDateString('en-GB', { day: '2-digit' });
    return f(a) + '-' + f(b) + (aDay !== bDay ? ' (next day)' : '') + ' ' + hg80TzShort();
  } catch (e){ return ''; }
}

function hg80SecsToSession(nowSec){
  var t = fin(nowSec);
  if (!isFinite(t)) return null;
  var d = new Date(t * 1000);
  var secOfDay = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
  var from = P80_UTC_FROM * 3600, to = P80_UTC_TO * 3600;
  if (secOfDay >= from && secOfDay < to) return 0;
  return secOfDay < from ? (from - secOfDay) : (86400 - secOfDay + from);
}

function hg80SessionApplies(tfSec){
  var s = fin(tfSec);
  if (!(s > 0)) return false;
  var from = P80_UTC_FROM * 3600, to = P80_UTC_TO * 3600;
  if (s > (to - from)) return false;
  for (var open = 0; open < 86400; open += s){
    if (open >= from && (open + s) <= to) return true;
  }
  return false;
}

/* The variant a scan is reading. Defaults to the spec, so every caller that
   predates the second mechanic — the walk, the tests, anything calling
   hg80SignalAt directly — keeps measuring exactly what it measured before. */
function hg80Variant(key){
  for (var i = 0; i < P80_VARIANTS.length; i++){
    if (P80_VARIANTS[i].key === key) return P80_VARIANTS[i];
  }
  return P80_VARIANTS[0];
}

/* The config a rung runs under. Defaults to the spec's own 5m, so every
   caller that predates the ladder — the tests, the walk, anything reading
   hg80SignalAt directly — keeps the exact behaviour it had. */
function hg80Cfg(def){
  var d = def || {};
  var tf = d.tf || P80_TF;
  var sec = isFinite(fin(d.sec)) && fin(d.sec) > 0 ? fin(d.sec) : P80_TF_SEC;
  return { tf: tf, tfSec: sec, band: d.band || 'scalp', session: hg80SessionApplies(sec) };
}

/* ---------------------------------------------------------------------
   THE ENTRY PROTOCOL, TRANSCRIBED

   Returns a signal for bar i, or null. Every condition is reported by name
   whether it passed or failed, so the card can show WHY a bar did not fire
   instead of only showing the ones that did.

   The session key is PRESENT only where the filter applies. An absent key
   is how a 4h card avoids printing a green "13:00-18:00 UTC" chip for a
   rule it never ran — a chip like that is a lie the reader cannot detect.
   --------------------------------------------------------------------- */
function hg80SignalAt(rows, ind, i, cfg, variant){
  if (!rows || !ind || i < 0 || i >= rows.length) return null;
  var r = rows[i];
  if (!r) return null;
  var c = fin(r.c), o = fin(r.o);
  var e50 = fin(ind.ema50[i]), e200 = fin(ind.ema200[i]);
  var rs = fin(ind.rsi[i]), a = fin(ind.atr[i]);
  if (!isFinite(c) || !isFinite(o) || !isFinite(e50) || !isFinite(e200)
      || !isFinite(rs) || !(a > 0)) return null;

  var sessionOn = !cfg || cfg.session !== false;
  var inSess = hg80InSession(r.t);
  var v = variant || P80_VARIANTS[0];

  var longChecks = {
    trend:    (c > e50) && (e50 > e200),
    pullback: rs < v.rsiLong,
    trigger:  c > o
  };
  var shortChecks = {
    trend:    (c < e50) && (e50 < e200),
    pullback: rs > v.rsiShort,
    trigger:  c < o
  };
  if (sessionOn){ longChecks.session = inSess; shortChecks.session = inSess; }

  var allOf = function(x){
    return x.trend && x.pullback && x.trigger && (x.session !== false);
  };

  var dir = allOf(longChecks) ? 'long' : (allOf(shortChecks) ? 'short' : null);
  return {
    i: i, t: fin(r.t), dir: dir,
    variant: v.key, variantLabel: v.label, mech: v.mech,
    rsiLong: v.rsiLong, rsiShort: v.rsiShort,
    tf: cfg && cfg.tf ? cfg.tf : P80_TF,
    tfSec: cfg && cfg.tfSec ? cfg.tfSec : P80_TF_SEC,
    sessionApplies: sessionOn,
    close: c, open: o, ema50: e50, ema200: e200, rsi: rs, atr: a,
    longChecks: longChecks, shortChecks: shortChecks,
    /* which side was closer to firing, for the "why not" line */
    checks: dir === 'short' ? shortChecks : longChecks
  };
}

/* ---------------------------------------------------------------------
   HOW CLOSE IS THIS RUNG, ACROSS BOTH MECHANICS

   The board used to measure distance against the SPEC only, and to report
   whichever side had more conditions met. On real gold that hid the one
   thing worth knowing. A worked example from a live scan:

     4h — close BELOW EMA50, EMA50 BELOW EMA200, RSI 45.6

   Read against the spec that is a short missing its pullback (RSI must be
   above 55), so the board printed "LONG 1/3" — the other side, further away,
   because it happened to have one more box ticked. Read against WIDE, whose
   short pullback is RSI above 45, that bar had trend AND pullback and was
   ONE RED CANDLE from firing. "One candle away on the mechanic you are
   running" and "two conditions away on the one you are not" are not the same
   message, and the board was printing the second.

   So this walks every variant and both sides, and returns the CLOSEST — most
   conditions met, and on a tie the tighter mechanic, because a spec setup is
   worth more than a wide one at equal distance.
   --------------------------------------------------------------------- */
/* NOT ALL MISSING CONDITIONS ARE THE SAME DISTANCE, and counting them as if
   they were is how this went wrong a second time.

   Ranking by "how many held" put a LONG at 2 of 3 ahead of a SHORT at 2 of 3
   on a bar where the short had TREND and the long did not. Those are not
   equally close. The long was missing trend — price 3.26 ATR the wrong side
   of its 50 EMA with the EMAs crossed against it — which is days of work on
   a 4h chart. The short was missing only its pullback.

   So each missing condition is weighted by what it would take to satisfy it:

     trigger   1  one candle, and it can be the very next one
     pullback  2  an RSI move, which is several bars of drift
     session   3  a clock, so it costs whatever the clock costs
     trend     4  price back across its 50 EMA, or the EMAs recrossing

   Lowest total cost wins, ties break toward the tighter mechanic. That makes
   "missing a trigger and a pullback" (3) rank ahead of "missing trend
   alone" (4), which is right: both of the first two can resolve on the next
   bar, and a trend flip cannot. */
var P80_MISS_COST = { trigger: 1, pullback: 2, session: 3, trend: 4 };

function hg80MissCost(score){
  var c = 0;
  for (var i = 0; i < score.missing.length; i++){
    c += (P80_MISS_COST[score.missing[i]] != null) ? P80_MISS_COST[score.missing[i]] : 2;
  }
  return c;
}

function hg80Nearest(rows, ind, i, cfg){
  var best = null, vi, sides = ['long', 'short'];
  for (vi = 0; vi < P80_VARIANTS.length; vi++){
    var v = P80_VARIANTS[vi];
    var sg = hg80SignalAt(rows, ind, i, cfg, v);
    if (!sg) continue;
    for (var si = 0; si < sides.length; si++){
      var side = sides[si];
      var ch = side === 'long' ? sg.longChecks : sg.shortChecks;
      var sc = hg80Score(ch);
      var cand = { variant: v, side: side, score: sc, sig: sg, checks: ch,
                   cost: hg80MissCost(sc) };
      if (!best) { best = cand; continue; }
      if (cand.cost < best.cost) { best = cand; continue; }
      if (cand.cost === best.cost && vi < P80_VARIANTS.indexOf(best.variant)) best = cand;
    }
  }
  return best;
}

/* How many of a side's conditions held, and which one did not. Drives the
   near-miss list — a bar at three of four is not a setup and is never shown
   as one, but it is the honest answer to "how close is this rung?". */
function hg80Score(checks){
  var met = 0, total = 0, missing = [], k;
  for (k in checks) if (Object.prototype.hasOwnProperty.call(checks, k)){
    total++;
    if (checks[k]) met++; else missing.push(k);
  }
  return { met: met, total: total, missing: missing };
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
           tf: sig.tf || P80_TF, variant: sig.variant || 'spec',
           rr: tpDist > 0 ? (slDist / tpDist) : NaN,
           stopPct: (slDist / entry) * 100 };
}

/* ---------------------------------------------------------------------
   RESOLUTION — one implementation, shared with the walk

   scripts/walk-80percent.mjs loads this file and calls THIS function, so
   the tab and the walk can never drift into two different answers about
   what a bar did to a trade. Three cases, in the order they must be
   checked:

     GAP    the bar OPENS beyond a level. The open is the first print, so
            the fill is there, not at the level, and a gapped stop costs
            MORE than -1R. Unambiguous, and checked first because a gapped
            bar usually covers both levels too.

     BOTH   target and stop are inside one bar's range. OHLC cannot order
            them. Scored optimistically as the target AND flagged, so the
            interval machinery can strip it at the lower bound — never
            silently kept as a win. One of these resolved the wrong way is
            worth 5.33 winners at this R:R.

     ONE    the ordinary case.

   The signal bar itself never resolves the trade it created: entry is its
   close, and everything inside that bar already happened.
   --------------------------------------------------------------------- */
function hg80Resolve(rows, i, plan, horizon){
  if (!rows || !plan) return null;
  var long = plan.dir === 'long';
  var E = fin(plan.entry), T = fin(plan.t1), S = fin(plan.stop);
  var risk = Math.abs(E - S);
  if (!(risk > 0)) return null;
  var rMul = function(px){ return (long ? (px - E) : (E - px)) / risk; };

  for (var j = i + 1; j < rows.length && j <= i + horizon; j++){
    var b = rows[j];
    var hitT = long ? (fin(b.h) >= T) : (fin(b.l) <= T);
    var hitS = long ? (fin(b.l) <= S) : (fin(b.h) >= S);
    var gapS = long ? (fin(b.o) <= S) : (fin(b.o) >= S);
    var gapT = long ? (fin(b.o) >= T) : (fin(b.o) <= T);

    if (gapS) return { outcome: 'loss', exit: fin(b.o), rMultiple: rMul(fin(b.o)), bars: j - i,
                       exitT: fin(b.t), gapped: true, ambiguous: false };
    if (gapT) return { outcome: 'win', exit: fin(b.o), rMultiple: rMul(fin(b.o)), bars: j - i,
                       exitT: fin(b.t), gapped: true, ambiguous: false };
    if (hitT && hitS) return { outcome: 'win', exit: T, rMultiple: rMul(T), bars: j - i,
                               exitT: fin(b.t), gapped: false, ambiguous: true };
    if (hitT) return { outcome: 'win', exit: T, rMultiple: rMul(T), bars: j - i,
                       exitT: fin(b.t), gapped: false, ambiguous: false };
    if (hitS) return { outcome: 'loss', exit: S, rMultiple: rMul(S), bars: j - i,
                       exitT: fin(b.t), gapped: false, ambiguous: false };
  }
  var last = rows[Math.min(i + horizon, rows.length - 1)];
  return { outcome: 'expired', exit: fin(last.c), rMultiple: rMul(fin(last.c)),
           bars: Math.min(horizon, rows.length - 1 - i), exitT: fin(last.t),
           gapped: false, ambiguous: false };
}

/* ---------------------------------------------------------------------
   WHY SO FEW, AND WHAT THE THRESHOLD IS COSTING

   "Where are the setups" has a number for an answer, and this computes it.

   For every bar where the three NON-pullback conditions already hold — the
   trend is aligned, the candle closed the right way, the session allows it
   — it records where RSI actually was. Those are the bars that the pullback
   threshold alone turned away.

   Nothing here overrides a threshold and nothing here is a setup. It reads
   the RSI that hg80SignalAt already computed on bars hg80SignalAt already
   judged, and buckets them. The strategy has no knob and is offered none:
   this is a census of what the spec rejected, not a second spec.

   The point it makes is specific and is worth stating on the tab, because
   it is counter-intuitive: MOVING THE THRESHOLD DOES NOT CHANGE WHAT THE
   TRADE HAS TO HIT. The breakeven is set by 4.00 and 0.75 and by nothing
   else, so a looser pullback buys more trades at the SAME 84.21% bar, of
   unknown and probably worse quality — every extra trade is one the spec
   thought was not yet a pullback. That is a real trade-off with a number on
   each side, which is a better thing to hand someone than either a blank
   panel or a quietly loosened rule.
   --------------------------------------------------------------------- */
var P80_CENSUS_LEVELS = [45, 50, 55, 60];

function hg80PullbackCensus(rows, ind, cfg){
  var out = { armedLong: 0, armedShort: 0, levels: [], bars: 0 };
  if (!rows || !ind) return out;
  var i, k;
  var longAt = {}, shortAt = {};
  for (k = 0; k < P80_CENSUS_LEVELS.length; k++){ longAt[P80_CENSUS_LEVELS[k]] = 0; shortAt[P80_CENSUS_LEVELS[k]] = 0; }
  for (i = Math.max(P80_EMA_SLOW, 0); i < rows.length; i++){
    var sg = hg80SignalAt(rows, ind, i, cfg);
    if (!sg) continue;
    out.bars++;
    var lc = sg.longChecks, sc = sg.shortChecks;
    var lArmed = lc.trend && lc.trigger && (lc.session !== false);
    var sArmed = sc.trend && sc.trigger && (sc.session !== false);
    if (lArmed){
      out.armedLong++;
      for (k = 0; k < P80_CENSUS_LEVELS.length; k++) if (sg.rsi < P80_CENSUS_LEVELS[k]) longAt[P80_CENSUS_LEVELS[k]]++;
    }
    if (sArmed){
      out.armedShort++;
      for (k = 0; k < P80_CENSUS_LEVELS.length; k++) if (sg.rsi > (100 - P80_CENSUS_LEVELS[k])) shortAt[P80_CENSUS_LEVELS[k]]++;
    }
  }
  for (k = 0; k < P80_CENSUS_LEVELS.length; k++){
    var lv = P80_CENSUS_LEVELS[k];
    out.levels.push({ rsiLong: lv, rsiShort: 100 - lv,
                      longFires: longAt[lv], shortFires: shortAt[lv],
                      fires: longAt[lv] + shortAt[lv],
                      isSpec: lv === P80_RSI_LONG });
  }
  return out;
}

/* Scan a bar series for every setup the spec fires. Pure — takes rows,
   returns signals — so the whole protocol is testable without a network,
   a DOM or a clock. */
function hg80Scan(rows, opts){
  var o = opts || {};
  var cfg = o.cfg || hg80Cfg(null);
  var ind = hg80Indicators(rows);
  if (!ind) return { ok: false, why: 'need at least ' + (P80_EMA_SLOW + 2)
                        + ' bars and the desk\'s indicator functions', signals: [], cfg: cfg };
  /* SPEC ONLY unless a caller asks for more. The walk and every test that
     predates the second mechanic must keep measuring the population they
     were written against; widening a default is how a measurement quietly
     changes what it is a measurement OF. */
  var vars = o.variants && o.variants.length ? o.variants : [P80_VARIANTS[0]];
  var out = [], i, vi;
  var from = Math.max(P80_EMA_SLOW, 0);
  var lastOnly = o.lastOnly === true;
  var start = lastOnly ? Math.max(from, rows.length - 1) : from;
  for (i = start; i < rows.length; i++){
    /* tightest first, then STOP: a bar belongs to the strictest variant that
       fires it, which is what keeps the two records disjoint */
    for (vi = 0; vi < vars.length; vi++){
      var s = hg80SignalAt(rows, ind, i, cfg, vars[vi]);
      if (s && s.dir){ s.plan = hg80Plan(s); out.push(s); break; }
    }
  }
  return { ok: true, signals: out, bars: rows.length, ind: ind, cfg: cfg, variants: vars };
}

/* ---------------------------------------------------------------------
   ONE RUNG

   Scans it, prices it from ITS OWN live ATR, resolves what fired inside the
   fetched window, and collects the near misses. Everything the ladder board
   and the cards need for that timeframe, computed once.

   The open/expired distinction matters and is not the resolver's to make:
   hg80Resolve says "expired" both when the horizon elapsed with neither
   level touched AND when the series simply ran out of bars. Those are
   different facts. A trade whose horizon has not elapsed yet is STILL OPEN
   — it is the one a desk can act on — and calling it expired would retire a
   live setup on the page.
   --------------------------------------------------------------------- */
function hg80ScanTf(rows, def, venue){
  var cfg = hg80Cfg(def);
  var res = hg80Scan(rows, { cfg: cfg, variants: P80_VARIANTS });
  if (!res.ok) return { def: def, cfg: cfg, ok: false, why: res.why };

  var n = rows.length;
  var lastAtr = res.ind ? fin(res.ind.atr[n - 1]) : NaN;
  var lastPx = fin(rows[n - 1].c);
  var be = hg80Breakeven(lastAtr, lastPx, venue ? venue.rtFrac : NaN);

  var tally = { open: 0, win: 0, loss: 0, expired: 0, ambiguous: 0 };
  var i;
  for (i = 0; i < res.signals.length; i++){
    var s = res.signals[i];
    var barsLeft = n - 1 - s.i;
    var r = hg80Resolve(rows, s.i, s.plan, P80_HORIZON_BARS);
    s.res = r;
    if (!r) { s.status = 'unpriced'; continue; }
    s.status = (r.outcome === 'expired' && barsLeft < P80_HORIZON_BARS) ? 'open' : r.outcome;
    if (Object.prototype.hasOwnProperty.call(tally, s.status)) tally[s.status]++;
    if (r.ambiguous) tally.ambiguous++;
  }

  var lastSig = hg80SignalAt(rows, res.ind, n - 1, cfg);
  var nearest = hg80Nearest(rows, res.ind, n - 1, cfg);

  /* how fast this rung's firings actually resolved — the number that says
     whether a setup from N bars ago could still be live */
  var spans = [];
  for (var si2 = 0; si2 < res.signals.length; si2++){
    var sg2 = res.signals[si2];
    if (sg2.res && sg2.status !== 'open' && isFinite(fin(sg2.res.bars))) spans.push(fin(sg2.res.bars));
  }
  spans.sort(function(a, b){ return a - b; });
  var medianBars = spans.length ? spans[Math.floor(spans.length / 2)] : null;
  var live = res.signals.filter(function(x){ return x.i === n - 1; });

  /* THE MOST RECENT FIRING, whether or not it was the last candle. A setup
     that fired three bars ago is still the answer to "what has this rung
     given me" — burying it in a history table while the top of the page
     says NOTHING FIRED is how a populated tab reads as an empty one. */
  var latest = res.signals.length ? res.signals[res.signals.length - 1] : null;
  if (latest){
    latest.ageBars = (n - 1) - latest.i;
    latest.ageSec = latest.ageBars * cfg.tfSec;
  }

  /* near misses: three of the four (or two of three where the session rule
     is inapplicable), most recent first, capped so one quiet rung cannot
     flood the page */
  var misses = [], j;
  var from = Math.max(P80_EMA_SLOW, n - P80_NEARMISS_BARS);
  for (j = n - 1; j >= from && misses.length < P80_NEARMISS_MAX; j--){
    var m = hg80SignalAt(rows, res.ind, j, cfg);
    if (!m || m.dir) continue;
    var ls = hg80Score(m.longChecks), ss = hg80Score(m.shortChecks);
    var best = ls.met >= ss.met ? { side: 'long', sc: ls, ch: m.longChecks } : { side: 'short', sc: ss, ch: m.shortChecks };
    if (best.sc.met === best.sc.total - 1) misses.push({ sig: m, side: best.side, score: best.sc });
  }

  return { def: def, cfg: cfg, ok: true, rows: rows, res: res, be: be,
           lastAtr: lastAtr, lastPx: lastPx, lastSig: lastSig,
           live: live, latest: latest, tally: tally, misses: misses,
           nearest: nearest, medianBars: medianBars, resolvedN: spans.length,
           census: hg80PullbackCensus(rows, res.ind, cfg),
           scanned: Math.max(0, n - P80_EMA_SLOW) };
}

/* ---------------------------------------------------------------------
   RECORDING — so the claim stops being an assertion

   Same contract as every other instrumented tab: barT floored to the bar
   (the log's dedup rule AND what makes a record settleable), ticket false
   and gateClear false because this cleared no gate — it was never put to
   them. hgFwdRecord returns a REASON STRING; only 'recorded' is one.

   The mechanic carries the RUNG. A 1d dip-buy and a 5m dip-buy share four
   conditions and nothing else that matters: different cost ratio, different
   stop in percent, different holding period. Pooling them would build one
   record for two strategies, which is the exact mistake hg-v770 un-pooled
   SPRING and UTAD to stop making.
   --------------------------------------------------------------------- */
function hg80Record(sig, cfg){
  try {
    if (typeof W.hgFwdRecord !== 'function') return { ok: false, why: 'forward log not loaded' };
    if (!sig || !sig.dir || !sig.plan) return { ok: false, why: 'no fired setup to record' };
    var c = cfg || hg80Cfg({ tf: sig.tf, sec: sig.tfSec });
    var p = sig.plan;
    var barT = isFinite(fin(sig.t))
      ? Math.floor(fin(sig.t) / c.tfSec) * c.tfSec
      : Math.floor((Date.now() / 1000) / c.tfSec) * c.tfSec;
    /* built ONCE, here, and handed back to the caller. A second copy of this
       expression at the call site is how hg-v769 came to report a record it
       had not made — and how this version, before the fix, told the reader a
       WIDE firing had been written as P80. What the card says was recorded
       has to be the string that was recorded. */
    var mechanic = (sig.mech || P80_VARIANTS[0].mech) + '-' + String(c.tf).toUpperCase()
                 + '-' + sig.dir.toUpperCase();
    var reason = W.hgFwdRecord({
      tab: P80_TAB,
      mechanic: mechanic,
      sym: 'XAUUSD', tf: c.tf, dir: sig.dir,
      entry: fin(p.entry), stop: fin(p.stop), t1: fin(p.t1),
      barT: barT,
      horizonBars: P80_HORIZON_BARS,
      ticket: false,
      gateClear: false,
      shown: true
    });
    return { ok: reason === 'recorded', reason: reason, mechanic: mechanic,
             why: reason === 'recorded' ? null : ('the log refused it: ' + reason) };
  } catch (e){ return { ok: false, why: String((e && e.message) || e) }; }
}

/* ---------------------------------------------------------------------
   RENDERING
   --------------------------------------------------------------------- */

/* The arithmetic, once, for the whole ladder — and then per rung, because
   the required rate is the thing that CHANGES up the ladder and is the
   whole reason the ladder exists. */
function mathPanelHtml(rungs, venue, basis){
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  var h = '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #b45309;'
    + 'border-left:3px solid #b45309;border-radius:4px;background:rgba(180,83,9,0.08)">'
    + '<b>WHAT THIS CONFIGURATION HAS TO HIT TO BREAK EVEN</b><br>'
    + 'Risking ' + P80_SL_ATR.toFixed(2) + ' ATR to make ' + P80_TP_ATR.toFixed(2)
    + ' ATR is 1:' + (P80_SL_ATR / P80_TP_ATR).toFixed(3) + '. Before any cost at all, that needs '
    + '<b>' + (gross * 100).toFixed(2) + '%</b> — arithmetic, not an opinion. '
    + 'The strategy claims 85%, which clears it by '
    + (100 * (P80_CLAIMED - gross)).toFixed(2) + ' points.';

  h += '<br><span class="note">Cost is a fixed fraction of PRICE. The target is a fraction of '
    + 'ATR. So the bar moves with the timeframe — and that, not a change to any rule, is why '
    + 'this tab runs the ladder.</span>';

  var priced = rungs.filter(function(r){ return r.ok && r.be && r.be.net != null; });
  if (!priced.length){
    /* Name WHICH input is missing. "no live ATR or no venue cost" told a
       reader nothing and hid a seam bug for four versions — the rungs were
       reporting ATR on the board the whole time, so ATR was never the
       missing half. */
    var haveAtr = rungs.filter(function(r){ return r.ok && r.lastAtr > 0; }).length;
    return h + '<br><span class="note warn">The cost-adjusted bar is not shown because the '
      + 'venue cost could not be read from the gold desk (hgOgVenueCost). '
      + haveAtr + ' of ' + rungs.length + ' rungs DID report a live ATR, so the missing half is '
      + 'the venue, not the volatility. The gross bar below needs neither and still holds: '
      + '<b>' + (gross * 100).toFixed(2) + '%</b> on every rung, at every timeframe.</span></div>';
  }

  h += '<table class="tbl" style="margin-top:6px"><tr><th>rung</th><th>band</th><th>ATR</th>'
    + '<th>target</th><th>cost</th><th>cost / target</th><th>it needs</th><th>at the claimed rate</th></tr>';
  var i, cleared = [], failed = [];
  for (i = 0; i < priced.length; i++){
    var r = priced[i], be = r.be;
    var eR = hg80ExpectancyR(P80_CLAIMED, be);
    var pays = isFinite(eR) && eR > 0;
    if (pays) cleared.push(r.def.tf); else failed.push(r.def.tf);
    h += '<tr><td><b>' + esc(r.def.tf) + '</b></td><td>' + esc(r.def.band) + '</td>'
      + '<td class="hg-num">' + num(r.lastAtr, 3) + '</td>'
      + '<td class="hg-num">' + num(be.target) + '</td>'
      + '<td class="hg-num">' + num(be.cost) + '</td>'
      + '<td class="hg-num">' + (100 * be.cost / be.target).toFixed(1) + '%</td>'
      + '<td class="hg-num"><b>' + (be.net * 100).toFixed(2) + '%</b>'
      + (be.net >= 1 ? ' <span class="statuschip na">unreachable</span>' : '') + '</td>'
      + '<td class="hg-num ' + (pays ? 'ok' : 'na') + '">'
      + (isFinite(eR) ? (eR >= 0 ? '+' : '') + eR.toFixed(4) + 'R' : '—') + '</td></tr>';
  }
  h += '</table>';

  h += '<div class="note" style="margin-top:4px">Priced at <b>' + esc(venue || 'the selected venue')
    + '</b>' + (priced[0].be.rtFrac != null ? ' (' + (priced[0].be.rtFrac * 100).toFixed(3)
    + '% round trip)' : '') + ', from each rung\'s own live ATR, this scan.'
    + (basis ? '<br><span class="note">' + esc(basis) + '</span>' : '') + '</div>';

  if (cleared.length){
    h += '<div class="note ok" style="margin-top:4px"><b>Taking the claimed rate entirely at face '
      + 'value</b>, it is above the cost-adjusted bar on <b>' + esc(cleared.join(', '))
      + '</b> and below it on ' + (failed.length ? esc(failed.join(', ')) : 'nothing')
      + '. That is what the ladder is for: the identical rules, priced where they can and '
      + 'cannot survive their own spread.</div>';
  } else {
    h += '<div class="note warn" style="margin-top:4px"><b>The claimed rate clears the '
      + 'cost-adjusted bar on no rung at this venue.</b> Every rung listed needs more than the '
      + 'strategy claims, so at this venue the arithmetic says no timeframe saves it. Switching '
      + 'the desk to a cheaper venue changes this number and it will recompute on the next scan.</div>';
  }
  return h + '</div>';
}

/* The state of every rung right now: where the conditions stand and how far
   from firing. This is the part of the tab that is populated on every scan
   whether or not anything fired, because "how close is it" is a real
   answer and silence is not. */
function ladderBoardHtml(rungs){
  var h = '<div class="panel" style="margin-top:10px"><h3>THE LADDER RIGHT NOW '
    + '<span>identical rules, five timeframes</span></h3>'
    + '<table class="tbl"><tr><th>rung</th><th>band</th><th>last bar (UTC)</th><th>close</th>'
    + '<th>RSI(14)</th><th>ATR(14)</th><th>stop % of entry</th><th>state</th>'
    + '<th>fired</th><th>closest, either mechanic</th></tr>';
  var i;
  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r.ok){
      h += '<tr><td><b>' + esc(r.def.tf) + '</b></td><td>' + esc(r.def.band) + '</td>'
        + '<td colspan="8" class="note">' + esc(r.why || 'no bars') + '</td></tr>';
      continue;
    }
    var s = r.lastSig;
    var when = (s && isFinite(s.t)) ? new Date(s.t * 1000).toISOString().replace('T', ' ').slice(5, 16) : '—';
    var stopPct = (r.lastAtr > 0 && r.lastPx > 0) ? (P80_SL_ATR * r.lastAtr / r.lastPx) * 100 : NaN;
    var state = r.live.length
      ? variantChipHtml(r.live[0]) + ' <span class="statuschip ok">'
        + esc(r.live[0].dir.toUpperCase()) + ' FIRED</span>'
      : '<span class="statuschip na">no fire</span>';
    h += '<tr><td><b>' + esc(r.def.tf) + '</b></td><td>' + esc(r.def.band) + '</td>'
      + '<td>' + esc(when) + '</td>'
      + '<td class="hg-num">' + num(r.lastPx) + '</td>'
      + '<td class="hg-num">' + (s ? num(s.rsi, 1) : '—') + '</td>'
      + '<td class="hg-num">' + num(r.lastAtr, 3) + '</td>'
      + '<td class="hg-num">' + (isFinite(stopPct) ? stopPct.toFixed(3) + '%'
          + (stopPct < P80_STOP_FLOOR ? ' <span class="statuschip na">under floor</span>' : '') : '—') + '</td>'
      + '<td>' + state + '</td>'
      + '<td class="hg-num">' + firedSplitHtml(r) + '</td>'
      + '<td>' + nearestHtml(r.nearest, r.cfg) + '</td></tr>';
  }
  h += '</table><div class="note">"Closest" walks BOTH mechanics and BOTH sides and reports the '
    + 'one nearest to firing, on the last CLOSED bar, with the mechanic named. Reporting it '
    + 'against the spec alone printed "2 conditions away" for a rung that was one red candle from '
    + 'a ' + esc(P80_VARIANTS[1].label) + ' entry — the wrong message, about the wrong mechanic. '
    + 'A green chip means one condition short. It is not a forecast and not a setup — it is where '
    + 'the rung stands.</div></div>';
  return h;
}

/* What the nearer side still needs, by name and by number. */
/* The fired count, split by mechanic. One pooled number would hide the
   thing the split exists to show: how many of a rung's firings the spec
   actually produced, and how many are the loosened ones. */
function hg80CountByVariant(rung){
  var out = { spec: 0, wide: 0, total: 0 };
  if (!rung || !rung.ok) return out;
  for (var i = 0; i < rung.res.signals.length; i++){
    var k = rung.res.signals[i].variant === 'wide' ? 'wide' : 'spec';
    out[k]++; out.total++;
  }
  return out;
}

function firedSplitHtml(r){
  var c = hg80CountByVariant(r);
  var rate = r.scanned > 0 ? (100 * c.total / r.scanned).toFixed(2) + '%' : '—';
  return '<span class="statuschip ' + (c.spec ? 'ok' : 'na') + '">SPEC ' + c.spec + '</span> '
    + '<span class="statuschip na">WIDE ' + c.wide + '</span>'
    + '<div class="note">' + c.total + ' in ' + r.scanned + ' · ' + rate + '</div>';
}

/* The board cell: which mechanic and side is closest, what it still needs,
   and the numbers behind each failing condition. */
function nearestHtml(nr, cfg){
  if (!nr) return '<span class="note">not enough bars</span>';
  var sig = nr.sig, side = nr.side, sc = nr.score;
  if (sc.met === sc.total){
    return variantChipHtml({ variant: nr.variant.key }) + ' <span class="statuschip ok">'
      + esc(side.toUpperCase()) + ' all ' + sc.total + ' hold</span>';
  }
  var bits = [], i;
  for (i = 0; i < sc.missing.length; i++){
    var k = sc.missing[i];
    if (k === 'pullback'){
      var need = side === 'long' ? nr.variant.rsiLong : nr.variant.rsiShort;
      bits.push('RSI ' + num(sig.rsi, 1) + ' needs ' + (side === 'long' ? '&lt;' : '&gt;') + ' '
        + need + ' (' + num(Math.abs(sig.rsi - need), 1) + ' away)');
    } else if (k === 'trend'){
      var gap = (sig.close - sig.ema50) / (sig.atr > 0 ? sig.atr : 1);
      bits.push('trend: close is ' + num(gap, 2) + ' ATR from EMA50, EMA50 is '
        + (sig.ema50 > sig.ema200 ? 'above' : 'below') + ' EMA200');
    } else if (k === 'trigger'){
      bits.push('needs a ' + (side === 'long' ? 'green' : 'red') + ' close');
    } else if (k === 'session'){
      bits.push('outside ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC');
    }
  }
  /* green only when the single cheapest thing is missing — one candle. A
     bar missing its pullback is not "one away" in any sense a desk can act
     on, and colouring it as if it were is what a chip is for. */
  var one = nr.cost <= P80_MISS_COST.trigger;
  return variantChipHtml({ variant: nr.variant.key }) + ' '
    + '<span class="statuschip ' + (one ? 'ok' : 'na') + '">' + esc(side.toUpperCase())
    + ' ' + sc.met + '/' + sc.total + '</span> '
    + '<span class="note">' + bits.join(' · ')
    + (cfg && cfg.session === false ? ' <span class="statuschip na">session rule N/A here</span>' : '')
    + '</span>';
}

function distanceHtml(sig, cfg){
  if (!sig) return '<span class="note">not enough bars</span>';
  var ls = hg80Score(sig.longChecks), ss = hg80Score(sig.shortChecks);
  var side = ls.met >= ss.met ? 'long' : 'short';
  var sc = side === 'long' ? ls : ss;
  if (sc.met === sc.total) return '<span class="statuschip ok">all ' + sc.total + ' hold</span>';
  var bits = [], i;
  for (i = 0; i < sc.missing.length; i++){
    var k = sc.missing[i];
    if (k === 'pullback'){
      var need = side === 'long' ? P80_RSI_LONG : P80_RSI_SHORT;
      bits.push('RSI ' + num(sig.rsi, 1) + ' needs ' + (side === 'long' ? '&lt;' : '&gt;') + ' '
        + need + ' (' + num(Math.abs(sig.rsi - need), 1) + ' away)');
    } else if (k === 'trend'){
      var gap = (sig.close - sig.ema50) / (sig.atr > 0 ? sig.atr : 1);
      bits.push('trend: close is ' + num(gap, 2) + ' ATR from EMA50, and EMA50 is '
        + (sig.ema50 > sig.ema200 ? 'above' : 'below') + ' EMA200');
    } else if (k === 'trigger'){
      bits.push('needs a ' + (side === 'long' ? 'green' : 'red') + ' close');
    } else if (k === 'session'){
      bits.push('outside ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC');
    }
  }
  return '<span class="note">' + esc(side.toUpperCase()) + ' ' + sc.met + '/' + sc.total + ' — '
    + bits.join(' · ') + (cfg && cfg.session === false
        ? ' <span class="statuschip na">session rule N/A here</span>' : '') + '</span>';
}

/* ---------------------------------------------------------------------
   THE SETUPS, AT THE TOP, WHERE THEY WERE ASKED FOR

   The last closed candle fires roughly three times in a thousand bars, so a
   page that only promotes THAT reads as a page with no setups on it even
   while it is holding several. This panel answers "where are the setups"
   directly: the most recent firing on every rung, with its age, its levels
   and whether it has already resolved.

   Age is the whole point and is stated in the rung's own bars AND in wall
   time, because those diverge violently up the ladder: three bars old is
   fifteen minutes on 5m and twelve days on 1d. A number a reader has to
   convert in their head is a number that gets misread.
   --------------------------------------------------------------------- */
function variantChipHtml(sig){
  var wide = sig && sig.variant === 'wide';
  return '<span class="statuschip ' + (wide ? 'na' : 'ok') + '">'
    + esc(wide ? 'WIDE' : 'SPEC') + '</span>';
}

function ageTxt(sec){
  var s = fin(sec);
  if (!isFinite(s) || s < 0) return '—';
  if (s < 3600) return Math.round(s / 60) + 'm';
  if (s < 86400) return (s / 3600).toFixed(s < 36000 ? 1 : 0) + 'h';
  return (s / 86400).toFixed(s < 864000 ? 1 : 0) + 'd';
}

/* The venue picker, on THIS tab. The gold desk's own control lives in the
   OMNIGOLD tab and carries that tab's element ids, so reusing its markup
   would put duplicate ids on the page. This drives the same
   hgOgSetVenue() — one venue for the whole desk, one place it is stored —
   and re-scans, because every required rate on the page is a function of
   it.

   An HG_OG_VENUE override wins over any UI selection by design, so when one
   is set the buttons are disabled and say so rather than pretending to
   work. */
/* ---------------------------------------------------------------------
   RUNG FOCUS

   The ladder answers "where does this pay"; it is the wrong shape for
   "show me what 4h fires". Pooled across five rungs the history table is
   capped and interleaved, and SETUPS deliberately shows only the most
   recent firing each. Focusing a rung drops the cap and the pooling: one
   timeframe, every firing it produced in the window, with its outcome.

   It also stops fetching the other four, which is the difference between
   one request and five on a rung a desk is actually watching.
   --------------------------------------------------------------------- */
function hg80BandRungs(band){
  var out = [], i;
  for (i = 0; i < P80_LADDER.length; i++) if (P80_LADDER[i].band === band) out.push(P80_LADDER[i].tf);
  return out;
}

/* The rungs the session rule CANNOT gate, computed from the timeframe rather
   than read off the band label.

   This is not the same set as SWING and saying so was a false sentence on
   the page: 1h is banded swing by holding period and is still gated, because
   a 1h bar fits inside 13:00-18:00 UTC perfectly well. The set that can fire
   at 05:00 UTC is 4h and 1d, and it is the one a desk watching gold outside
   the London-NY overlap actually has. It earns its own button precisely
   because it is not a band. */
function hg80UngatedRungs(){
  var out = [], i;
  for (i = 0; i < P80_LADDER.length; i++){
    if (!hg80SessionApplies(P80_LADDER[i].sec)) out.push(P80_LADDER[i].tf);
  }
  return out;
}

function viewControlHtml(){
  function btn(v, label){
    var on = __p.view === v;
    return '<button type="button" class="btn ghost" data-p80-view="' + v + '"'
      + ' style="' + (on ? 'border-color:#10b981;color:#10b981;font-weight:bold' : '') + '">'
      + esc(label) + '</button> ';
  }
  return '<div class="row" style="margin:0 0 6px 0;align-items:center">'
    + '<span class="note" style="margin:0"><b>VIEW</b>: </span> '
    + btn('simple', 'SIMPLE') + btn('full', 'FULL')
    + '<span class="note dim" style="margin:0;font-size:11px">'
    + (__p.view === 'simple'
        ? 'setups only — entry, stop, target. FULL adds the cost arithmetic, the ladder board, '
          + 'the near misses and the census.'
        : 'everything. SIMPLE shows the setups and nothing else.')
    + '</span></div>';
}

function focusControlHtml(){
  var sel = hg80FocusList();
  var h = '<div class="row" style="margin:6px 0 0 0;align-items:center;flex-wrap:wrap">'
    + '<span class="note" style="margin:0"><b>RUNGS</b>: </span> ';
  function btn(attr, label, on){
    return '<button type="button" class="btn ghost" data-p80-focus="' + esc(attr) + '"'
      + ' style="' + (on ? 'border-color:#10b981;color:#10b981;font-weight:bold' : '') + '">'
      + esc(label) + '</button> ';
  }
  var scalp = hg80BandRungs('scalp'), swing = hg80BandRungs('swing');
  var ungated = hg80UngatedRungs();
  var sameAs = function(list){
    if (sel.length !== list.length) return false;
    for (var i = 0; i < list.length; i++) if (sel.indexOf(list[i]) < 0) return false;
    return true;
  };
  h += btn('', 'ALL', sel.length === 0);
  h += btn('band:scalp', 'SCALP', sameAs(scalp));
  h += btn('band:swing', 'SWING', sameAs(swing));
  h += btn('set:ungated', 'NO SESSION GATE', sameAs(ungated));
  h += '<span class="note dim" style="margin:0 6px">|</span> ';
  for (var i = 0; i < P80_LADDER.length; i++){
    h += btn(P80_LADDER[i].tf, P80_LADDER[i].tf, hg80FocusHas(P80_LADDER[i].tf));
  }
  h += '<span class="note dim" style="margin:0;font-size:11px">'
    + (sel.length
        ? esc(sel.join(' + ')) + ' — every firing in ' + (sel.length === 1 ? 'its' : 'their')
          + ' window, uncapped. Click a rung again to drop it.'
        : 'all five rungs — SETUPS shows the most recent firing on each. '
          + 'SCALP is ' + esc(scalp.join(' + ')) + ', SWING is ' + esc(swing.join(' + '))
          + ' by holding period. NO SESSION GATE is ' + esc(ungated.join(' + '))
          + ' — the only rungs that can fire outside ' + P80_UTC_FROM + ':00-' + P80_UTC_TO
          + ':00 UTC, which is not the same set as SWING.')
    + '</span></div>';
  return h;
}

function venueControlHtml(v){
  var ovr = '';
  try { ovr = String(W.HG_OG_VENUE || '').toUpperCase().replace(/^\s+|\s+$/g, ''); } catch (e){}
  var active = (v && v.venue) ? String(v.venue).toUpperCase() : '';
  function btn(id, name, label){
    var on = active === name;
    return '<button type="button" class="btn ghost" id="' + id + '" data-p80-venue="' + name + '"'
      + (ovr ? ' disabled' : '')
      + ' style="' + (on ? 'border-color:#10b981;color:#10b981;font-weight:bold' : '') + '">'
      + esc(label) + '</button>';
  }
  var h = '<div class="row" style="margin:8px 0 0 0;align-items:center">'
    + '<span class="note" style="margin:0"><b>EXECUTION VENUE</b>: </span> '
    + btn('p80VenueXm', 'XM', 'XM XAUUSD') + ' ' + btn('p80VenuePaxg', 'PAXG', 'PAXG')
    + ' <span class="note dim" style="margin:0;font-size:11px">';
  if (ovr){
    h += 'locked to ' + esc(ovr) + ' by HG_OG_VENUE — the override outranks any selection here';
  } else if (v){
    h += 'active: ' + esc(active) + ' · ' + fin(v.rtCostPct).toFixed(3) + '% round trip';
  } else {
    h += 'the desk\'s venue could not be read';
  }
  return h + '</span></div>';
}

/* ---------------------------------------------------------------------
   WHY THERE IS NOTHING TO TAKE RIGHT NOW

   Asked three times, so it gets its own panel and a computed answer rather
   than five rows of chips the reader has to decode.

   It names the binding constraint in the order it binds: the session clock
   first (three rungs CANNOT fire outside 13:00-18:00 UTC, whatever price
   does), then how close the closest rung is across BOTH mechanics, then the
   thing that explains why the list above is all history — how fast these
   setups resolve. A 0.75 ATR target is three quarters of a typical bar's
   range, so a firing is usually finished within a handful of bars. A setup
   from 134 bars ago is not waiting for anyone.
   --------------------------------------------------------------------- */
function hg80DurTxt(sec){
  var x = fin(sec);
  if (!isFinite(x) || x < 0) return '—';
  var h = Math.floor(x / 3600), m = Math.round((x % 3600) / 60);
  if (h <= 0) return m + 'm';
  return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
}

/* ---------------------------------------------------------------------
   A SETUP, WRITTEN AS A TRADE

   Direction, entry, stop, target, and what each is worth in points AND in
   percent, because a stop 77 points away means nothing until you know it is
   1.69% of the entry. One line of status, not a paragraph: this is what a
   desk reads before deciding, and everything that belongs in the decision
   AFTER that is in FULL.

   The WATCH tag stays on every card. It is one line, it is not negotiable,
   and it is the difference between a setup and a recommendation: nothing
   here has a measured record on this desk yet.
   --------------------------------------------------------------------- */
function simpleCardHtml(sig, rung, state){
  var p = sig.plan;
  if (!p) return '';
  var long = sig.dir === 'long';
  var col = long ? '#10b981' : '#ef4444';
  var when = hg80WhenTxt(sig.t, true);
  var age = rung ? (rung.rows.length - 1) - sig.i : null;

  function leg(label, px, from){
    /* distance from the ENTRY, as points and percent. The entry row itself
       gets no delta — "+0.00 (+0.00%)" against itself is noise in the one
       place the eye goes first. */
    var d = (from == null) ? NaN : fin(px) - fin(from);
    var pct = (d / fin(from)) * 100;
    return '<tr><td style="padding:3px 10px 3px 0"><b>' + esc(label) + '</b></td>'
      + '<td class="hg-num" style="font-size:1.35em;font-weight:bold;padding:3px 10px 3px 0">'
      + num(px) + '</td>'
      + '<td class="hg-num note" style="padding:3px 0">'
      + (isFinite(d) ? Math.abs(d).toFixed(2) + ' away  (' + Math.abs(pct).toFixed(2) + '%)' : '')
      + '</td></tr>';
  }

  var h = '<div class="panel" style="margin-top:8px;border-left:4px solid ' + col + '">'
    + '<h3 style="color:' + col + '">' + (long ? 'BUY' : 'SELL') + ' XAUUSD'
    + ' <span>' + esc((rung ? rung.def.tf + ' · ' : '')) + esc(when)
    + (age != null && age > 0 && rung
        ? ' · ' + age + ' bar' + (age === 1 ? '' : 's') + ' ago (' + ageTxt(age * rung.cfg.tfSec) + ')'
        : (age === 0 ? ' · just closed' : '')) + '</span></h3>';

  if (state) h += '<div style="margin-bottom:4px">' + state + '</div>';

  h += '<table style="border:0;margin:2px 0"><tbody>'
    + leg('ENTRY', p.entry, null)
    + leg(long ? 'STOP LOSS' : 'STOP LOSS', p.stop, p.entry)
    + leg('TAKE PROFIT', p.t1, p.entry)
    + '</tbody></table>';

  /* p.rr is risk/reward — 5.33 here. Printed as "1:0.19" it reads as though
     the reward were the 1, which is the flattering way round and the wrong
     one. Say it as a desk says it: what you risk, for what you stand to
     make. */
  h += '<div class="note"><b>You risk ' + num(p.risk) + ' to make ' + num(p.reward) + '</b> — '
    + num(p.rr, 2) + ' risked for every 1 gained. That is why it has to win '
    + ((P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR)) * 100).toFixed(1) + '% of the time just to break '
    + 'even, before any spread.</div>';

  h += '<div class="note warn" style="margin-top:4px;padding:3px 6px;border-left:3px solid #b45309">'
    + '<b>WATCH — not a signal to act on.</b> ' + esc(sig.variantLabel || 'SPEC')
    + ' has no measured record on this desk. It is logged so it can earn one.</div>';
  return h + '</div>';
}

/* When this strategy CAN produce a trade, in the reader's own clock. It is
   the only schedulable thing about it: whether the four conditions line up
   inside the window is not knowable in advance, but the window itself is. */
function sessionClockHtml(rungs){
  var usable = rungs.filter(function(r){ return r.ok; });
  if (!usable.length) return '';
  var gated = usable.filter(function(r){ return r.cfg.session !== false; });
  var free = usable.filter(function(r){ return r.cfg.session === false; });
  var toOpen = hg80SecsToSession(Math.floor(Date.now() / 1000));
  var loc = hg80SessionLocalTxt();

  var h = '<div class="note" style="margin-top:8px;padding:6px 8px;border-left:3px solid #64748b">'
    + '<b>WHEN THESE CAN FIRE</b> <span class="dim">(your clock: ' + esc(hg80TzName()) + ')</span><br>';
  if (gated.length){
    h += esc(gated.map(function(r){ return r.def.tf; }).join(', '))
      + ' — only inside <b>' + esc(loc || (P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC')) + '</b>'
      + ' (' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC), '
      + (toOpen > 0 ? 'which opens in <b>' + hg80DurTxt(toOpen) + '</b>'
                    : '<b>open now</b>') + '.<br>';
  }
  if (free.length){
    h += esc(free.map(function(r){ return r.def.tf; }).join(', '))
      + ' — <b>any time</b>, no session rule applies at those timeframes.<br>';
  }
  h += '<span class="note">The window is the only part that can be put in a diary. Whether the '
    + 'conditions actually line up inside it is not something this or any tab can know ahead of '
    + 'time — a setup exists once a candle closes, not before.</span></div>';
  return h;
}

function simpleSetupsHtml(rungs){
  var usable = rungs.filter(function(r){ return r.ok; });
  var live = [], open = [], recent = [], i, j;
  for (i = 0; i < usable.length; i++){
    var r = usable[i];
    for (j = 0; j < r.res.signals.length; j++){
      var sg = r.res.signals[j];
      if (sg.i === r.rows.length - 1) live.push({ r: r, s: sg });
      else if (sg.status === 'open') open.push({ r: r, s: sg });
    }
    if (r.latest) recent.push({ r: r, s: r.latest });
  }

  var h = '<div class="panel"><h2>SETUPS <span>XAUUSD</span></h2>';

  if (live.length || open.length){
    h += '<div class="note ok" style="margin-bottom:4px"><b>' + (live.length + open.length)
      + ' setup' + ((live.length + open.length) === 1 ? '' : 's') + ' you could act on.</b></div>';
    for (i = 0; i < live.length; i++){
      h += simpleCardHtml(live[i].s, live[i].r,
        '<span class="statuschip ok">FIRED ON THE LAST CLOSED CANDLE</span>');
    }
    for (i = 0; i < open.length; i++){
      h += simpleCardHtml(open[i].s, open[i].r,
        '<span class="statuschip ok">STILL OPEN</span> <span class="note">neither the stop nor '
        + 'the target has been touched yet</span>');
    }
    return h + '</div>';
  }

  /* nothing to act on. Say that in one sentence, then show the last one that
     DID fire on each rung, clearly marked finished — a card labelled "closed"
     is honest; an empty panel just gets asked about again. */
  h += '<div class="note warn"><b>Nothing to act on right now.</b> ';
  var nowSec = Math.floor(Date.now() / 1000);
  var toOpen = hg80SecsToSession(nowSec);
  var gated = usable.filter(function(r){ return r.cfg.session !== false && toOpen > 0; });
  if (gated.length){
    var loc = hg80SessionLocalTxt();
    h += gated.length + ' of ' + usable.length + ' rung'
      + (usable.length === 1 ? '' : 's') + ' cannot fire until the trading window opens'
      + ' — <b>' + hg80DurTxt(toOpen) + ' from now</b>'
      + (loc ? ', at <b>' + esc(loc) + '</b>' : '')
      + ' (' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC). ';
  }
  var closest = null;
  for (i = 0; i < usable.length; i++){
    var nr = usable[i].nearest;
    if (nr && (!closest || nr.cost < closest.n.cost)) closest = { r: usable[i], n: nr };
  }
  if (closest){
    var need = closest.n.score.missing.map(function(k){
      return k === 'trigger' ? 'a ' + (closest.n.side === 'long' ? 'green' : 'red') + ' candle'
           : k === 'pullback' ? 'RSI to reach ' + (closest.n.side === 'long'
               ? 'below ' + closest.n.variant.rsiLong : 'above ' + closest.n.variant.rsiShort)
           : k === 'trend' ? 'the trend to line up' : 'the session window';
    });
    h += 'Closest is ' + esc(closest.r.def.tf) + ' ' + (closest.n.side === 'long' ? 'BUY' : 'SELL')
      + ', waiting on ' + esc(need.join(' and ')) + '.';
  }
  h += '</div>';

  if (recent.length){
    h += '<div class="note" style="margin-top:8px">The last setup each rung produced — '
      + '<b>these are finished</b>, shown so you can see what they look like:</div>';
    for (i = 0; i < recent.length; i++){
      var st = recent[i].s.status;
      var chip = st === 'win' ? '<span class="statuschip">CLOSED — reached its target</span>'
               : st === 'loss' ? '<span class="statuschip na">CLOSED — hit its stop</span>'
               : '<span class="statuschip na">CLOSED — ' + esc(st || 'expired') + '</span>';
      h += simpleCardHtml(recent[i].s, recent[i].r, chip);
    }
  }
  return h + '</div>';
}

function whyNothingHtml(rungs){
  var usable = rungs.filter(function(r){ return r.ok; });
  if (!usable.length) return '';
  var i, gated = [], open = [], closest = null;
  var nowSec = Math.floor(Date.now() / 1000);
  var toOpen = hg80SecsToSession(nowSec);

  /* Candidates are split by whether the rung can fire AT ALL right now. A
     "closest" that names a session-gated rung is worse than useless: it
     invites someone to watch a chart that cannot produce a trade for another
     eight hours. Gated rungs are only considered when nothing else is. */
  var live = [], held = [];
  for (i = 0; i < usable.length; i++){
    var r = usable[i];
    if (r.live.length) return '';                 /* something fired; nothing to explain */
    var isGated = (r.cfg.session !== false && toOpen > 0);
    if (isGated) gated.push(r.def.tf); else open.push(r.def.tf);
    if (r.nearest) (isGated ? held : live).push({ r: r, n: r.nearest, gated: isGated });
  }
  function nearestOf(list){
    var b = null;
    for (var j = 0; j < list.length; j++){
      if (!b || list[j].n.cost < b.n.cost) b = list[j];
    }
    return b;
  }
  closest = nearestOf(live) || nearestOf(held);

  var h = '<div class="note warn" style="margin:8px 0;padding:8px 10px;border-left:3px solid #b45309">'
    + '<b>WHY THERE IS NOTHING TO TAKE RIGHT NOW</b>';

  if (gated.length){
    h += '<br>· <b>' + gated.length + ' of ' + usable.length + ' rungs cannot fire at all</b> ('
      + esc(gated.join(', ')) + '): it is outside ' + P80_UTC_FROM + ':00-' + P80_UTC_TO
      + ':00 UTC and the window opens in <b>' + hg80DurTxt(toOpen) + '</b>. No price action '
      + 'changes that — the session gate is a clock, not a condition.';
  }
  if (open.length){
    h += '<br>· ' + open.length + ' rung' + (open.length === 1 ? '' : 's') + ' ('
      + esc(open.join(', ')) + ') can fire now and did not.';
  }
  if (closest){
    var miss = closest.n.score.missing.map(function(k){
      return k === 'trigger' ? 'a ' + (closest.n.side === 'long' ? 'green' : 'red') + ' close'
           : k === 'pullback' ? 'the RSI pullback'
           : k === 'trend' ? 'trend alignment' : 'the session window';
    });
    var away = closest.n.score.total - closest.n.score.met;
    h += '<br>· <b>Closest' + (closest.gated ? ' (and still session-gated)' : ' that can fire now')
      + ': ' + esc(closest.r.def.tf) + ' ' + esc(closest.n.side.toUpperCase())
      + ' on ' + esc(closest.n.variant.label) + '</b> — ' + closest.n.score.met + ' of '
      + closest.n.score.total + ', '
      + (away === 1 ? 'waiting only on <b>' + esc(miss[0]) + '</b>'
                    : 'still needs ' + esc(miss.join(' and ')))
      + '. Measured across BOTH mechanics, so a rung one candle from a ' + esc(P80_VARIANTS[1].label)
      + ' entry is not reported as two conditions from a ' + esc(P80_VARIANTS[0].label) + ' one.';
  }

  /* the part that explains the history list */
  var spans = [], nRes = 0;
  for (i = 0; i < usable.length; i++){
    if (usable[i].medianBars != null){ spans.push(usable[i].medianBars); nRes += usable[i].resolvedN; }
  }
  if (spans.length){
    spans.sort(function(a, b){ return a - b; });
    var med = spans[Math.floor(spans.length / 2)];
    h += '<br>· <b>And these do not wait.</b> Across ' + nRes + ' firings in the fetched windows '
      + 'the typical one finished in about <b>' + med + ' bars</b> — a ' + P80_TP_ATR
      + ' ATR target is three quarters of one bar\'s range, so it is reached or stopped quickly. '
      + 'That is why the list below is history: this strategy is actionable ON the bar it fires, '
      + 'and a firing from a hundred bars ago is not a setup that is still standing.';
  }
  return h + '</div>';
}

/* Every firing on the focused rung, newest first, with what became of it.
   No cap: on one timeframe the whole list IS the answer to "show me what
   fires", and truncating it would be the same mistake as showing only the
   most recent one. */
/* ---------------------------------------------------------------------
   THE FOCUSED ROWS AS PLAIN TEXT

   This tab runs in a browser; anything wanting to look at its output —
   another desk, a spreadsheet, a colleague, an assistant being asked why a
   rung is quiet — gets it by copy and paste. Pasting the rendered table
   drops exactly the things needed to read it: which venue priced it, which
   mechanic fired each row, what the required rate was. Twice now that has
   meant answering a question about this tab by inferring its own settings
   back out of its prose.

   So the copy is built here, self-describing, with the header a reader needs
   to interpret the rows and nothing they have to take on trust. Pure and
   returned as a string, so it is testable without a clipboard.
   --------------------------------------------------------------------- */
function hg80FocusText(list, venue){
  var ok = (list || []).filter(function(r){ return r && r.ok; });
  var L = [];
  var ver = '';
  try { ver = (W.HG_BUILD && W.HG_BUILD.version) ? String(W.HG_BUILD.version) : ''; } catch (e){}
  L.push('HARDGATE 80PERCENT' + (ver ? ' · ' + ver : '') + ' · ' + new Date().toISOString().slice(0, 16) + 'Z');
  L.push('venue: ' + ((venue && venue.venue) ? venue.venue : 'unknown')
    + (venue && isFinite(fin(venue.rtCostPct)) ? ' @ ' + fin(venue.rtCostPct).toFixed(3) + '% round trip' : ''));
  L.push('spec: EMA' + P80_EMA_FAST + '/' + P80_EMA_SLOW + ', RSI(' + P80_RSI_LEN + ') < '
    + P80_RSI_LONG + ' / > ' + P80_RSI_SHORT + ', TP ' + P80_TP_ATR + 'xATR, SL ' + P80_SL_ATR
    + 'xATR, session ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC');
  L.push('wide: same rules, RSI < ' + P80_RSI_WIDE_LONG + ' / > ' + P80_RSI_WIDE_SHORT
    + ' (bars the spec turned away; recorded under ' + P80_VARIANTS[1].mech + ')');
  L.push('gross breakeven: ' + ((P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR)) * 100).toFixed(4) + '%');

  if (!ok.length){
    L.push('');
    L.push('no rung returned usable bars');
    return L.join('\n');
  }

  var i, j;
  L.push('');
  for (i = 0; i < ok.length; i++){
    var r = ok[i], c = hg80CountByVariant(r);
    L.push(r.def.tf + ' (' + r.def.band + '): SPEC ' + c.spec + ' WIDE ' + c.wide
      + ' in ' + r.scanned + ' bars'
      + (r.medianBars != null ? ', typical hold ' + r.medianBars + ' bars' : '')
      + ', ATR ' + num(r.lastAtr, 3) + ', last close ' + num(r.lastPx)
      + ', needs ' + (r.be && r.be.net != null ? (r.be.net * 100).toFixed(2) + '%' : 'n/a')
      + (r.cfg.session === false ? ', no session gate' : ', session-gated')
      + (r.nearest ? ', closest: ' + r.nearest.variant.label + ' ' + r.nearest.side.toUpperCase()
          + ' ' + r.nearest.score.met + '/' + r.nearest.score.total
          + ' missing ' + (r.nearest.score.missing.join('+') || 'nothing') : ''));
  }

  var rows = [];
  for (i = 0; i < ok.length; i++){
    for (j = 0; j < ok[i].res.signals.length; j++) rows.push({ r: ok[i], s: ok[i].res.signals[j] });
  }
  rows.sort(function(a, b){ return fin(b.s.t) - fin(a.s.t); });

  L.push('');
  L.push(['rung', 'when_utc', 'mech', 'age_bars', 'dir', 'entry', 'stop', 'target',
          'rsi', 'atr', 'outcome', 'R', 'bars_held'].join('\t'));
  for (i = 0; i < rows.length; i++){
    var rg = rows[i].r, sg = rows[i].s, p = sg.plan, rs = sg.res;
    L.push([
      rg.def.tf,
      isFinite(sg.t) ? new Date(sg.t * 1000).toISOString().replace('T', ' ').slice(0, 16) : '-',
      sg.variantLabel || 'SPEC',
      (rg.rows.length - 1) - sg.i,
      sg.dir,
      num(p.entry), num(p.stop), num(p.t1),
      num(sg.rsi, 1), num(sg.atr, 2),
      sg.status || '-',
      rs ? num(rs.rMultiple, 3) : '-',
      (rs && sg.status !== 'open') ? rs.bars : '-'
    ].join('\t'));
  }
  if (!rows.length) L.push('(nothing fired on these rungs in the bars evaluated)');
  L.push('');
  L.push('Outcomes resolved inside this fetch only. Not a backtest, not sequential, no win rate.');
  L.push('Both mechanics are a WATCH: no measured record on this desk yet.');
  return L.join('\n');
}

function focusedFiringsHtml(list){
  var ok = (list || []).filter(function(r){ return r && r.ok; });
  if (!ok.length){
    var why = (list || []).map(function(r){ return (r && r.def ? r.def.tf + ': ' : '')
      + ((r && r.why) || 'no bars'); });
    return '<div class="panel" style="margin-top:10px"><h3>SETUPS</h3>'
      + '<div class="note warn">' + esc(why.join(' · ') || 'no rung returned bars') + '</div></div>';
  }

  var label = ok.map(function(r){ return r.def.tf; }).join(' + ');
  var multi = ok.length > 1;

  /* One merged table, newest first ACROSS rungs. Two tables would make the
     comparison the reader is here for into a scroll. */
  var rows = [], i, j, total = 0, scanned = 0;
  for (i = 0; i < ok.length; i++){
    var r = ok[i];
    scanned += r.scanned;
    for (j = 0; j < r.res.signals.length; j++){
      rows.push({ r: r, s: r.res.signals[j] });
      total++;
    }
  }
  rows.sort(function(a, b){ return fin(b.s.t) - fin(a.s.t); });

  var h = '<div class="panel" style="margin-top:10px"><h3>EVERYTHING ' + esc(label)
    + ' FIRED <span>' + total + ' in ' + scanned + ' evaluable bars</span></h3>'
    + '<div class="row" style="margin:0 0 6px 0;align-items:center">'
    + '<button type="button" class="btn ghost" id="p80Copy">COPY THESE ROWS</button>'
    + ' <span class="note dim" style="margin:0;font-size:11px">tab-separated, with the venue, '
    + 'both mechanics\' thresholds and the breakeven in the header — so a paste can be read '
    + 'without knowing how this tab was set</span></div>'
    + '<textarea id="p80CopyBox" style="display:none;width:100%;height:160px;font-family:monospace;'
    + 'font-size:11px"></textarea>';

  /* a summary line per rung, because a merged count hides which rung
     produced what — the whole reason for holding two at once */
  for (i = 0; i < ok.length; i++){
    var rr = ok[i], c = hg80CountByVariant(rr);
    h += '<div class="note"><b>' + esc(rr.def.tf) + '</b> (' + esc(rr.def.band) + ') — SPEC '
      + c.spec + ' · WIDE ' + c.wide + ' in ' + rr.scanned + ' bars'
      + (rr.medianBars != null ? ' · typical hold ' + rr.medianBars + ' bar'
          + (rr.medianBars === 1 ? '' : 's') + ' (' + ageTxt(rr.medianBars * rr.cfg.tfSec) + ')' : '')
      + (rr.cfg.session === false
          ? ' · no session gate here, so three conditions ran, not four'
          : ' · only bars inside ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC could fire')
      + '</div>';
  }

  if (!rows.length){
    return h + '<div class="note warn" style="margin-top:6px">Nothing fired on '
      + esc(multi ? 'either rung' : 'this rung') + ' in the ' + scanned + ' bars evaluated — not on '
      + 'the spec and not on the loosened mechanic. The board below says how far each stood at its '
      + 'last close, and the census says which condition was doing the turning away.</div></div>';
  }

  h += '<table class="tbl" style="margin-top:6px"><tr>'
    + (multi ? '<th>rung</th>' : '')
    + '<th>when (UTC)</th><th>mechanic</th>'
    + '<th>age</th><th>dir</th><th>entry</th><th>stop</th><th>target</th><th>RSI</th>'
    + '<th>ATR</th><th>outcome</th><th>R</th><th>bars held</th></tr>';
  for (i = 0; i < rows.length; i++){
    var rg = rows[i].r, sg = rows[i].s, p = sg.plan, rs = sg.res;
    var age = (rg.rows.length - 1) - sg.i;
    var flag = '';
    if (rs && rs.ambiguous) flag += ' <span class="statuschip na">ambiguous</span>';
    if (rs && rs.gapped) flag += ' <span class="statuschip na">gapped</span>';
    h += '<tr>' + (multi ? '<td><b>' + esc(rg.def.tf) + '</b></td>' : '')
      + '<td>' + esc(isFinite(sg.t)
          ? new Date(sg.t * 1000).toISOString().replace('T', ' ').slice(0, 16) : '—') + '</td>'
      + '<td>' + variantChipHtml(sg) + '</td>'
      + '<td class="hg-num">' + (age === 0 ? 'now' : age + ' · ' + ageTxt(age * rg.cfg.tfSec)) + '</td>'
      + '<td>' + esc(sg.dir) + '</td>'
      + '<td class="hg-num">' + num(p.entry) + '</td>'
      + '<td class="hg-num">' + num(p.stop) + '</td>'
      + '<td class="hg-num">' + num(p.t1) + '</td>'
      + '<td class="hg-num">' + num(sg.rsi, 1) + '</td>'
      + '<td class="hg-num">' + num(sg.atr, 2) + '</td>'
      + '<td>' + esc(sg.status || '—') + flag + '</td>'
      + '<td class="hg-num">' + (rs ? (rs.rMultiple >= 0 ? '+' : '') + num(rs.rMultiple, 3) : '—') + '</td>'
      + '<td class="hg-num">' + (rs && sg.status !== 'open' ? rs.bars : '—') + '</td></tr>';
  }
  h += '</table>';

  h += '<div class="note warn" style="margin-top:6px">Outcomes are resolved against the bars that '
    + 'followed each firing inside THIS fetch. That is not a backtest and no win rate is shown '
    + 'from it: the book here is not sequential, one fetch is not a sample, and rows marked '
    + 'ambiguous covered both the target and the stop in a single bar, which OHLC cannot order. '
    + (multi ? 'Rows from different rungs are NOT a common population either — they have different '
             + 'cost ratios, different stops in percent and different holding periods, and they are '
             + 'recorded under different mechanics for that reason. '
             : '')
    + 'Every mechanic here remains a WATCH until the forward log or scripts/walk-80percent.mjs says '
    + 'otherwise.</div>';

  /* anything still live gets a full card underneath */
  var live = 0;
  for (i = 0; i < ok.length; i++){
    var r2 = ok[i];
    for (j = 0; j < r2.res.signals.length; j++){
      var x = r2.res.signals[j];
      if (x.i === r2.rows.length - 1 || x.status === 'open'){
        h += setupCardHtml(x, r2.be, r2.cfg,
          x.i === r2.rows.length - 1 ? 'last closed candle' : 'still open');
        live++;
      }
    }
  }
  if (!live){
    var meds = ok.filter(function(r3){ return r3.medianBars != null; })
                 .map(function(r3){ return r3.def.tf + ' ' + r3.medianBars; });
    h += '<div class="note" style="margin-top:6px">None of these is live now — every one reached '
      + 'its target, its stop or its horizon. At typical holding times of '
      + esc(meds.length ? meds.join(' bars, ') + ' bars' : 'a few bars')
      + ' that is what a list of past firings looks like.</div>';
  }
  return h + '</div>';
}

function latestSetupsHtml(rungs){
  var have = [], i;
  for (i = 0; i < rungs.length; i++){
    if (rungs[i].ok && rungs[i].latest) have.push(rungs[i]);
  }
  if (!have.length){
    var scanned = 0;
    for (i = 0; i < rungs.length; i++) if (rungs[i].ok) scanned += rungs[i].scanned;
    return '<div class="panel" style="margin-top:10px"><h3>SETUPS</h3>'
      + '<div class="note warn">Not one rung fired anywhere in ' + scanned + ' evaluable bars. '
      + 'That is the supplied strategy\'s own rarity, not a missing feed — the census below '
      + 'counts the bars it turned away and says which condition did it. Every rung\'s data '
      + 'arrived; see the board above for where each one stands.</div></div>';
  }

  var h = '<div class="panel" style="margin-top:10px"><h3>SETUPS '
    + '<span>the most recent firing on each rung</span></h3>'
    + '<table class="tbl"><tr><th>rung</th><th>mechanic</th><th>when (UTC)</th><th>age</th><th>dir</th>'
    + '<th>entry</th><th>stop</th><th>target</th><th>state</th></tr>';
  for (i = 0; i < have.length; i++){
    var r = have[i], s = r.latest, p = s.plan;
    var fresh = s.ageBars === 0;
    var st = fresh ? '<span class="statuschip ok">last closed candle</span>'
      : s.status === 'open' ? '<span class="statuschip ok">still open</span>'
      : '<span class="statuschip na">' + esc(s.status || '—') + '</span>';
    h += '<tr><td><b>' + esc(r.def.tf) + '</b></td>'
      + '<td>' + variantChipHtml(s) + '</td>'
      + '<td>' + esc(isFinite(s.t) ? new Date(s.t * 1000).toISOString().replace('T', ' ').slice(5, 16) : '—') + '</td>'
      + '<td class="hg-num">' + (s.ageBars === 0 ? 'now' : s.ageBars + ' bars · ' + ageTxt(s.ageSec)) + '</td>'
      + '<td>' + esc(s.dir) + '</td>'
      + '<td class="hg-num">' + num(p.entry) + '</td>'
      + '<td class="hg-num">' + num(p.stop) + '</td>'
      + '<td class="hg-num">' + num(p.t1) + '</td>'
      + '<td>' + st + '</td></tr>';
  }
  h += '</table>';

  /* the actionable ones get a full card; a resolved firing from 200 bars
     ago gets a row and nothing more, because it is history, not a setup */
  var actionable = have.filter(function(r){
    return r.latest.ageBars === 0 || r.latest.status === 'open';
  });
  for (i = 0; i < actionable.length; i++){
    var a = actionable[i];
    h += setupCardHtml(a.latest, a.be, a.cfg,
      a.latest.ageBars === 0 ? 'last closed candle' : ('still open · ' + a.latest.ageBars + ' bars old'));
  }
  if (!actionable.length){
    h += '<div class="note warn">None of these is actionable now: every one has already reached '
      + 'its target, its stop or its horizon. They are listed because they are what the strategy '
      + 'produced, not because they can be taken.</div>';
  }
  return h + '</div>';
}

/* ---------------------------------------------------------------------
   WHAT THE PULLBACK THRESHOLD IS TURNING AWAY

   Rendered as a trade-off with both sides priced, never as a recommendation
   and never as a set of setups.
   --------------------------------------------------------------------- */
function censusHtml(rungs){
  var rows = rungs.filter(function(r){ return r.ok && r.census && r.census.bars; });
  if (!rows.length) return '';
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  var lv = P80_CENSUS_LEVELS;
  var h = '<div class="panel" style="margin-top:10px"><h3>WHY SO FEW '
    + '<span>what the pullback threshold turns away</span></h3>'
    + '<div class="note">On these bars the trend, the candle direction and the session already '
    + 'agreed. RSI alone decided. The first column is the spec.</div>'
    + '<table class="tbl"><tr><th>rung</th><th>bars armed</th>';
  var k;
  for (k = 0; k < lv.length; k++){
    h += '<th>RSI &lt;' + lv[k] + ' / &gt;' + (100 - lv[k]) + (lv[k] === P80_RSI_LONG ? ' <b>(spec)</b>' : '') + '</th>';
  }
  h += '</tr>';
  var i;
  for (i = 0; i < rows.length; i++){
    var c = rows[i].census;
    h += '<tr><td><b>' + esc(rows[i].def.tf) + '</b></td>'
      + '<td class="hg-num">' + (c.armedLong + c.armedShort) + ' of ' + c.bars + '</td>';
    for (k = 0; k < c.levels.length; k++){
      h += '<td class="hg-num' + (c.levels[k].isSpec ? ' ok' : '') + '">' + c.levels[k].fires + '</td>';
    }
    h += '</tr>';
  }
  h += '</table>';
  h += '<div class="note ok" style="margin-top:4px"><b>The '
    + P80_RSI_WIDE_LONG + ' / ' + P80_RSI_WIDE_SHORT + ' column is wired.</b> It runs as the '
    + '<b>' + esc(P80_VARIANTS[1].mech) + '</b> mechanic, scanned on every rung beside the spec '
    + 'and recorded separately. The counts in that column are CUMULATIVE — they include the spec '
    + 'firings, because RSI below ' + P80_RSI_LONG + ' is also below ' + P80_RSI_WIDE_LONG
    + '. What ' + esc(P80_VARIANTS[1].mech) + ' records is the DIFFERENCE: only the bars the spec '
    + 'turned away, so its record answers what the extra trades are worth rather than being '
    + 'diluted by the spec\'s. Pooling the two records gives the loosened strategy as actually '
    + 'traded; nothing can un-pool them once they are pooled, which is why they start apart.</div>';
  h += '<div class="note warn" style="margin-top:4px"><b>Moving the threshold does not change '
    + 'what the trade has to hit.</b> The breakeven is set by ' + P80_SL_ATR.toFixed(2) + ' and '
    + P80_TP_ATR.toFixed(2) + ' and by nothing else, so it stays ' + (gross * 100).toFixed(2)
    + '% gross at every column. A looser pullback buys more trades at the SAME bar, and every '
    + 'extra one is a bar the spec judged not yet a pullback — so their quality is unknown and '
    + 'there is a good reason to think it is worse. That is precisely why it is a separate '
    + 'mechanic with a separate record and not a widened spec: the claim that these trades are '
    + 'worth taking is now a measurable one, and until it is measured both mechanics are a '
    + 'WATCH.</div>';
  return h + '</div>';
}

/* On a WIDE card, the one thing a reader has to know before acting on it:
   this bar is one the supplied spec REJECTED, and loosening the entry bought
   it nothing on the exit — the rate it has to hit did not move. */
function variantNoteHtml(sig){
  if (!sig || sig.variant !== 'wide') return '';
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  return '<div class="note warn" style="margin-top:4px;border-left:3px solid #b45309">'
    + '<b>THIS IS THE WIDE MECHANIC, NOT THE SUPPLIED SPEC.</b> The spec wants RSI below '
    + P80_RSI_LONG + ' for a long and above ' + P80_RSI_SHORT + ' for a short; this fired at '
    + num(sig.rsi, 1) + ', which the spec turned away. Everything else — trend, candle '
    + 'direction, session, target, stop — is identical.<br>'
    + 'And that is the trade-off in one line: the entry got easier and <b>the bar did not move</b>. '
    + 'This still has to hit ' + (gross * 100).toFixed(2) + '% gross, because the breakeven is set '
    + 'by ' + P80_SL_ATR.toFixed(2) + ' and ' + P80_TP_ATR.toFixed(2) + ' alone. It is recorded '
    + 'under its own mechanic so it is judged on its own record and never lends its numbers to '
    + 'the spec\'s — or borrows them.</div>';
}

function sessionNoteHtml(cfg){
  if (!cfg || cfg.session !== false) return '';
  return '<div class="note warn" style="margin-top:4px">The ' + P80_UTC_FROM + ':00-'
    + P80_UTC_TO + ':00 UTC session filter is <b>not applied at ' + esc(cfg.tf) + '</b>, and this '
    + 'is a stated deviation from the spec rather than a rule that passed. No ' + esc(cfg.tf)
    + ' bar lies wholly inside a five-hour window at this venue\'s bar alignment, so the filter '
    + 'could only have admitted bars spending most of their life outside the session, or excluded '
    + 'every bar for a reason the spec never intended. Three conditions ran here, not four.</div>';
}

function setupCardHtml(sig, be, cfg, kind){
  var p = sig.plan;
  var when = isFinite(fin(sig.t)) ? new Date(fin(sig.t) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';
  var h = '<div class="panel" style="margin-top:8px"><h3>'
    + (sig.dir === 'long' ? 'LONG' : 'SHORT') + ' XAUUSD ' + esc(sig.tf || '')
    + ' ' + variantChipHtml(sig)
    + ' <span>' + esc(when) + (kind ? ' · ' + esc(kind) : '') + '</span></h3>';
  h += '<table class="tbl"><tr><th>entry</th><th>stop</th><th>target</th><th>risk</th><th>reward</th><th>R:R</th></tr>'
    + '<tr><td class="hg-num">' + num(p.entry) + '</td><td class="hg-num">' + num(p.stop) + '</td>'
    + '<td class="hg-num">' + num(p.t1) + '</td><td class="hg-num">' + num(p.risk) + '</td>'
    + '<td class="hg-num">' + num(p.reward) + '</td><td class="hg-num">1:' + num(p.rr, 2)
    + '</td></tr></table>';
  h += '<div class="note">ATR(14) ' + num(sig.atr, 3) + ' · RSI(14) ' + num(sig.rsi, 1)
    + ' · EMA50 ' + num(sig.ema50) + ' · EMA200 ' + num(sig.ema200)
    + ' · stop is ' + num(p.stopPct, 3) + '% of entry</div>';

  /* the desk's own stop floor, stated where it is contradicted rather than
     silently bypassed — 4 ATR is WIDE in ATR and can be NARROW in percent,
     and those are not the same thing */
  var floor = P80_STOP_FLOOR;
  if (p.stopPct < floor){
    h += '<div class="note warn" style="margin-top:4px">This stop is '
      + num(p.stopPct, 3) + '% of entry, below this desk\'s ' + floor.toFixed(2)
      + '% floor. The floor exists because a stop too tight to carry a spread turns cost into '
      + 'the dominant term — which is exactly what the arithmetic above shows happening on the '
      + 'short rungs. Shown, not suppressed: the spec asked for 4 ATR and 4 ATR is what is printed.</div>';
  }

  h += variantNoteHtml(sig);
  h += sessionNoteHtml(cfg);

  /* the shared geometry verdict, like every other plan-publishing tab */
  try {
    if (typeof W.hgPlanGeometryLineHtml === 'function'){
      h += W.hgPlanGeometryLineHtml(p, sig.close, { style: 'margin-top:4px' }) || '';
    }
  } catch (e){}

  if (be && be.net != null){
    h += '<div class="note" style="margin-top:4px">Needs ' + (be.net * 100).toFixed(2)
      + '% to pay at this rung\'s ATR and this venue.</div>';
  }
  if (sig.res && sig.status && sig.status !== 'open'){
    h += resultLineHtml(sig);
  }
  h += '<div class="note warn" style="margin-top:6px;padding:4px 6px;border-left:3px solid #b45309">'
    + '<b>WATCH, NOT A TICKET.</b> This strategy has no measured record on this desk — the claimed '
    + 'rate is an assertion, and hg-v756 made measured-edge hard. Recorded to the forward log so '
    + 'it can earn one.</div>';
  return h + '</div>';
}

function resultLineHtml(sig){
  var r = sig.res;
  if (!r) return '';
  var cls = r.outcome === 'win' ? 'ok' : (r.outcome === 'loss' ? 'warn' : '');
  return '<div class="note ' + cls + '" style="margin-top:4px">Inside the fetched window this one '
    + esc(r.outcome === 'win' ? 'reached its target' : r.outcome === 'loss' ? 'was stopped' : 'expired unresolved')
    + ' after ' + r.bars + ' bar' + (r.bars === 1 ? '' : 's') + ' at ' + num(r.exit)
    + ' (' + (r.rMultiple >= 0 ? '+' : '') + num(r.rMultiple, 3) + 'R)'
    + (r.gapped ? ' — filled at a GAPPED open, not at the level' : '')
    + (r.ambiguous ? ' — <b>ambiguous</b>: one bar covered both the target and the stop and OHLC '
        + 'cannot order them, so this is the optimistic read, not an established one' : '')
    + '.</div>';
}

function whyNotHtml(sig, cfg, tf){
  var lead = '<b>' + esc(tf || (cfg && cfg.tf) || '') + '</b> ';
  if (!sig) return '<div class="note" style="margin-top:4px">' + lead
    + 'not enough bars to evaluate the last candle</div>';
  var name = { trend: 'trend alignment', pullback: 'RSI pullback', trigger: 'candle direction',
               session: P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC' };
  var side = function(label, ch){
    var bits = [], k;
    for (k in ch) if (Object.prototype.hasOwnProperty.call(ch, k)){
      bits.push('<span class="statuschip ' + (ch[k] ? 'ok' : 'na') + '">' + esc(name[k]) + '</span>');
    }
    return '<b>' + label + '</b> ' + bits.join(' ');
  };
  var total = hg80Score(sig.longChecks).total;
  return '<div class="note" style="margin-top:4px">' + lead + '<span class="statuschip na">'
    + total + ' needed</span> ' + side('LONG', sig.longChecks) + ' &nbsp; '
    + side('SHORT', sig.shortChecks)
    + (cfg && cfg.session === false
        ? ' <span class="statuschip na">session rule N/A at this rung</span>' : '') + '</div>';
}

function nearMissHtml(rungs){
  var rows = [], i, j;
  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r.ok) continue;
    for (j = 0; j < r.misses.length; j++) rows.push({ tf: r.def.tf, m: r.misses[j] });
  }
  if (!rows.length) return '';
  var name = { trend: 'trend alignment', pullback: 'RSI pullback', trigger: 'candle direction',
               session: 'session window' };
  var h = '<div class="panel" style="margin-top:10px"><h3>NEAR MISSES '
    + '<span>one condition short, and which one</span></h3>'
    + '<table class="tbl"><tr><th>rung</th><th>time (UTC)</th><th>side</th><th>held</th>'
    + '<th>missed</th><th>RSI</th><th>close</th></tr>';
  for (i = 0; i < rows.length; i++){
    var x = rows[i], s = x.m.sig;
    var missed = x.m.score.missing.map(function(k){ return name[k] || k; }).join(', ');
    h += '<tr><td><b>' + esc(x.tf) + '</b></td>'
      + '<td>' + esc(isFinite(s.t) ? new Date(s.t * 1000).toISOString().replace('T', ' ').slice(5, 16) : '—') + '</td>'
      + '<td>' + esc(x.m.side) + '</td>'
      + '<td class="hg-num">' + x.m.score.met + '/' + x.m.score.total + '</td>'
      + '<td>' + esc(missed) + '</td>'
      + '<td class="hg-num">' + num(s.rsi, 1) + '</td>'
      + '<td class="hg-num">' + num(s.close) + '</td></tr>';
  }
  return h + '</table><div class="note"><b>These did NOT fire and are not setups.</b> The spec '
    + 'requires every condition on the same candle and none of these had them. The held count is '
    + 'out of THREE at 4h and 1d, where the session rule is inapplicable, and out of four '
    + 'everywhere else — the column says which. They are listed because a rung that keeps missing '
    + 'on one named condition is telling you something a blank panel cannot.</div></div>';
}

function firedHtml(rungs){
  var open = [], settled = [], i, j;
  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r.ok) continue;
    for (j = 0; j < r.res.signals.length; j++){
      var s = r.res.signals[j];
      /* the SETUPS panel carded the most recent firing on this rung already;
         showing it again here is the same setup twice on one page */
      if (r.latest && s.i === r.latest.i) continue;
      if (s.status === 'open') open.push({ r: r, s: s });
      else settled.push({ r: r, s: s });
    }
  }
  var h = '';
  if (open.length){
    h += '<div class="panel" style="margin-top:10px"><h3>STILL OPEN '
      + '<span>fired inside the window, neither level reached yet</span></h3>';
    var shown = open.slice(-6).reverse();
    for (i = 0; i < shown.length; i++){
      h += setupCardHtml(shown[i].s, shown[i].r.be, shown[i].r.cfg, 'still open');
    }
    h += '<div class="note">These are the firings whose horizon has not elapsed and whose target '
      + 'and stop are both still untouched on the bars fetched. That is the only sense in which '
      + 'they are live — nothing here has been checked against a tick the fetch did not include.</div></div>';
  }
  if (settled.length){
    var recent = settled.slice(-14).reverse();
    h += '<div class="panel" style="margin-top:10px"><h3>FIRED AND RESOLVED IN THIS WINDOW</h3>'
      + '<table class="tbl"><tr><th>rung</th><th>time (UTC)</th><th>dir</th><th>entry</th><th>stop</th>'
      + '<th>target</th><th>outcome</th><th>R</th><th>bars</th></tr>';
    for (i = 0; i < recent.length; i++){
      var s2 = recent[i].s, p = s2.plan, res = s2.res;
      var flag = (res && res.ambiguous) ? ' <span class="statuschip na">ambiguous</span>' : '';
      if (res && res.gapped) flag += ' <span class="statuschip na">gapped</span>';
      h += '<tr><td><b>' + esc(recent[i].r.def.tf) + '</b></td>'
        + '<td>' + esc(isFinite(s2.t) ? new Date(s2.t * 1000).toISOString().replace('T', ' ').slice(5, 16) : '—')
        + '</td><td>' + esc(s2.dir) + '</td><td class="hg-num">' + num(p.entry)
        + '</td><td class="hg-num">' + num(p.stop) + '</td><td class="hg-num">' + num(p.t1)
        + '</td><td>' + esc(s2.status) + flag + '</td>'
        + '<td class="hg-num">' + (res ? (res.rMultiple >= 0 ? '+' : '') + num(res.rMultiple, 3) : '—')
        + '</td><td class="hg-num">' + (res ? res.bars : '—') + '</td></tr>';
    }
    h += '</table><div class="note">Historical firings on the bars fetched, resolved against the '
      + 'bars that followed them — NOT a backtest: one fetch is not a sample, the book here is not '
      + 'sequential, and rows marked ambiguous cannot be established from OHLC at all. '
      + 'That is why no win rate is shown from this table however many rows it has. '
      + 'scripts/walk-80percent.mjs and the forward log are what answer that question.</div></div>';
  }
  return h;
}

function render(rungs, venue, recNotes, basis){
  var ui = __p.ui;
  if (!ui || !ui.body) return;

  var usable = rungs.filter(function(r){ return r.ok; });
  var h = viewControlHtml();

  if (__p.view === 'simple'){
    if (!usable.length){
      var b0 = rungs.map(function(r){ return r.def.tf + ': ' + ((r.why) || 'no bars'); });
      ui.body.innerHTML = h + '<div class="note warn">No gold bars came back — '
        + esc(b0.join(' · ')) + '</div>';
      wireViewButtons();
      return;
    }
    h += simpleSetupsHtml(rungs);
    h += sessionClockHtml(rungs);
    h += '<div class="note" style="margin-top:8px">Priced at <b>'
      + esc((venue || 'the selected venue')) + '</b>. Switch to <b>FULL</b> for the cost '
      + 'arithmetic, the ladder board, the near misses and the census.</div>';
    h += focusControlHtml();
    ui.body.innerHTML = h;
    wireViewButtons();
    wireFocusButtons();
    return;
  }

  h += venueControlHtml(__p.venue);
  h += focusControlHtml();
  h += whyNothingHtml(rungs);
  h += mathPanelHtml(rungs, venue, basis);

  if (!usable.length){
    var bits = rungs.map(function(r){ return r.def.tf + ': ' + ((r.why) || 'no bars'); });
    ui.body.innerHTML = h + '<div class="note warn">No rung returned usable bars — '
      + esc(bits.join(' · ')) + '</div>';
    wireViewButtons();
    wireVenueButtons();
    wireFocusButtons();
    wireCopyButton();
    return;
  }

  h += hg80FocusList().length ? focusedFiringsHtml(rungs) : latestSetupsHtml(rungs);
  h += ladderBoardHtml(rungs);

  /* the SETUPS panel above already carries every card worth carrying, so
     this adds only what it cannot: what the log did with a fresh firing,
     and — for the rungs that did NOT fire on their last candle — which
     conditions held there */
  var live = [], quiet = [], i;
  for (i = 0; i < usable.length; i++){
    if (usable[i].live.length) live.push(usable[i]); else quiet.push(usable[i]);
  }
  for (i = 0; i < live.length; i++){
    if (recNotes && recNotes[live[i].def.tf]){
      h += '<div class="note" style="margin-top:4px"><b>' + esc(live[i].def.tf) + '</b> '
        + esc(recNotes[live[i].def.tf]) + '</div>';
    }
  }
  if (quiet.length){
    h += '<div class="panel" style="margin-top:10px"><h3>'
      + (live.length ? 'THE OTHER RUNGS DID NOT FIRE ON THEIR LAST CANDLE'
                     : 'NOTHING FIRED ON THE LAST CLOSED CANDLE') + '</h3>'
      + '<div class="note">Every condition has to hold on the SAME candle. Which ones did, per '
      + 'rung, on its own last closed bar:</div>';
    for (i = 0; i < quiet.length; i++){
      h += whyNotHtml(quiet[i].lastSig, quiet[i].cfg, quiet[i].def.tf);
    }
    h += '</div>';
  }

  if (!hg80FocusList().length) h += firedHtml(rungs);  /* focused table has every row already */
  h += nearMissHtml(rungs);
  h += censusHtml(rungs);

  var scanned = 0, fired = 0, amb = 0;
  for (i = 0; i < usable.length; i++){
    scanned += usable[i].scanned;
    fired += usable[i].res.signals.length;
    amb += usable[i].tally.ambiguous;
  }
  h += '<div class="note" style="margin-top:8px">Scanned ' + scanned + ' evaluable bars across '
    + usable.length + ' of ' + rungs.length + ' rungs · ' + fired + ' firing'
    + (fired === 1 ? '' : 's') + ' in the fetched windows'
    + (amb ? ' · ' + amb + ' of them resolved on a bar that covered both levels and cannot be '
        + 'established either way' : '') + '.</div>';

  ui.body.innerHTML = h;
  wireViewButtons();
  wireVenueButtons();
  wireFocusButtons();
  wireCopyButton();
}

/* The buttons live inside innerHTML that is replaced on every render, so the
   listeners are re-attached each time rather than bound once at mount. */
/* Clipboard where it exists, a selectable textarea where it does not. The
   API needs a secure context and a user gesture and is absent or refused in
   plenty of real browsers, so the fallback is not an edge case — it is the
   path a copy button has to have or it silently does nothing. */
function wireViewButtons(){
  var ui = __p.ui;
  if (!ui || !ui.body || !ui.body.querySelectorAll) return;
  var btns = ui.body.querySelectorAll('[data-p80-view]');
  for (var i = 0; i < btns.length; i++){
    (function(b){
      b.addEventListener('click', function(){
        var v = b.getAttribute && b.getAttribute('data-p80-view');
        if (v !== 'simple' && v !== 'full') return;
        if (v === __p.view) return;
        __p.view = v;
        /* a view change is a re-render, not a re-fetch — the bars in hand
           are the same bars either way */
        if (__p.last) render(__p.last.rungs, __p.last.venue ? __p.last.venue.venue : null, null,
                             __p.last.venue ? __p.last.venue.basis : null);
        else run();
      });
    })(btns[i]);
  }
}

function wireCopyButton(){
  var ui = __p.ui;
  if (!ui || !ui.body || !ui.body.querySelector) return;
  var btn = ui.body.querySelector('#p80Copy');
  var box = ui.body.querySelector('#p80CopyBox');
  if (!btn) return;
  btn.addEventListener('click', function(){
    var txt = '';
    try {
      txt = hg80FocusText((__p.last && __p.last.rungs) || [], __p.venue);
    } catch (e){ txt = 'could not build the copy: ' + String((e && e.message) || e); }
    function reveal(note){
      if (box){
        box.style.display = 'block';
        box.value = txt;
        try { box.focus(); if (box.select) box.select(); } catch (e2){}
      }
      if (ui.stat) ui.stat.textContent = note;
    }
    try {
      if (W.navigator && W.navigator.clipboard && W.navigator.clipboard.writeText){
        W.navigator.clipboard.writeText(txt).then(function(){
          if (ui.stat) ui.stat.textContent = 'copied ' + txt.split('\n').length + ' lines';
        }, function(){ reveal('clipboard refused — select the box below and copy'); });
        return;
      }
    } catch (e3){}
    reveal('no clipboard here — select the box below and copy');
  });
}

function wireFocusButtons(){
  var ui = __p.ui;
  if (!ui || !ui.body || !ui.body.querySelectorAll) return;
  var btns = ui.body.querySelectorAll('[data-p80-focus]');
  for (var i = 0; i < btns.length; i++){
    (function(b){
      b.addEventListener('click', function(){
        var tf = b.getAttribute && b.getAttribute('data-p80-focus');
        var sel = hg80FocusList();
        if (!tf){
          sel = [];                                   /* ALL */
        } else if (tf.indexOf('band:') === 0 || tf.indexOf('set:') === 0){
          var band = (tf === 'set:ungated') ? hg80UngatedRungs() : hg80BandRungs(tf.slice(5));
          /* a band button toggles: pressing the one already showing goes
             back to the whole ladder rather than doing nothing */
          var same = sel.length === band.length && band.every(function(x){ return sel.indexOf(x) >= 0; });
          sel = same ? [] : band;
        } else {
          var at = sel.indexOf(tf);
          if (at >= 0) sel.splice(at, 1); else sel.push(tf);
        }
        /* keep ladder order, so 4h + 1d never renders as 1d + 4h */
        __p.focus = sel.length
          ? P80_LADDER.map(function(d){ return d.tf; }).filter(function(x){ return sel.indexOf(x) >= 0; })
          : null;
        var now = hg80FocusList();
        if (ui.stat) ui.stat.textContent = now.length
          ? ('scanning ' + now.join(' + ') + '…') : 'scanning the whole ladder…';
        run();
      });
    })(btns[i]);
  }
}

function wireVenueButtons(){
  var ui = __p.ui;
  if (!ui || !ui.body || !ui.body.querySelectorAll) return;
  var btns = ui.body.querySelectorAll('[data-p80-venue]');
  for (var i = 0; i < btns.length; i++){
    (function(b){
      b.addEventListener('click', function(){
        var name = b.getAttribute && b.getAttribute('data-p80-venue');
        try {
          if (typeof W.hgOgSetVenue === 'function' && W.hgOgSetVenue(name)){
            if (ui.stat) ui.stat.textContent = 'venue -> ' + name + ', re-pricing every rung…';
            run();
          }
        } catch (e){}
      });
    })(btns[i]);
  }
}

function run(){
  if (__p.busy) return Promise.resolve('busy');
  var ui = __p.ui;
  __p.busy = true;

  var fetchFn = W.hgOgFetchRows;
  if (typeof fetchFn !== 'function'){
    __p.busy = false;
    if (ui && ui.body) ui.body.innerHTML = '<div class="note warn">the gold bar fetcher '
      + '(hgOgFetchRows) is not loaded — this tab prices nothing without it</div>';
    if (ui && ui.stat) ui.stat.textContent = 'no fetcher';
    return Promise.resolve('error');
  }

  hg80VenueEnsure();
  var venue = hg80VenueRt();
  var rungs = [];
  var chain = Promise.resolve();

  var sel = hg80FocusList();
  var ladder = sel.length
    ? P80_LADDER.filter(function(d){ return sel.indexOf(d.tf) >= 0; })
    : P80_LADDER;
  ladder.forEach(function(def){
    chain = chain.then(function(){
      if (ui && ui.stat) ui.stat.textContent = 'fetching ' + def.tf + ' bars…';
      return Promise.resolve().then(function(){ return fetchFn(def.tf, def.bars); })
        .then(function(got){
          var rows = (got && got.rows) ? got.rows : got;
          if (!rows || !rows.length){
            rungs.push({ def: def, ok: false, why: 'no ' + def.tf + ' gold bars came back' });
            return;
          }
          /* settle anything this rung already has open before recording
             today's, so the log's own resolution stays ahead of its input */
          try { if (typeof W.hgFwdResolve === 'function') W.hgFwdResolve('XAUUSD', def.tf, rows); }
          catch (e){}
          rungs.push(hg80ScanTf(rows, def, venue));
        })
        .catch(function(e){
          rungs.push({ def: def, ok: false, why: String((e && e.message) || e) });
        });
    });
  });

  return chain.then(function(){
    var recNotes = {}, i, fired = [];
    for (i = 0; i < rungs.length; i++){
      var r = rungs[i];
      if (!r.ok || !r.live.length) continue;
      fired.push(r.def.tf + ' ' + (r.live[0].variantLabel || 'SPEC') + ' '
                 + r.live[0].dir.toUpperCase());
      var rec = hg80Record(r.live[0], r.cfg);
      recNotes[r.def.tf] = rec.ok
        ? ('Recorded to ' + P80_TAB + ' as ' + rec.mechanic
           + ' — the claim is now testable on this rung, under this mechanic.')
        : ('Not recorded: ' + (rec.why || 'unknown'));
    }

    __p.last = { rungs: rungs, venue: venue };
    __p.venue = venue;
    render(rungs, venue ? venue.venue : null, recNotes, venue ? venue.basis : null);

    var okN = rungs.filter(function(x){ return x.ok; }).length;
    if (ui && ui.stat){
      ui.stat.textContent = 'updated ' + new Date().toISOString().slice(11, 19) + ' UTC · '
        + (hg80FocusList().length ? (hg80FocusList().join(' + ') + ' only')
                                  : (okN + '/' + rungs.length + ' rungs')) + ' · '
        + (fired.length ? fired.join(', ') + ' fired' : 'no rung fired on its last candle');
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
  var rungTxt = P80_LADDER.map(function(d){ return d.tf; }).join(' · ');
  el.innerHTML = '<div class="panel">'
    + '<h2>80PERCENT <span>High-Momentum Trend Dip-Buyer · XAUUSD · ' + esc(rungTxt) + '</span></h2>'
    + '<div class="note">EMA' + P80_EMA_FAST + '/' + P80_EMA_SLOW + ' trend, RSI('
    + P80_RSI_LEN + ') pullback below ' + P80_RSI_LONG + ' / above ' + P80_RSI_SHORT
    + ', candle-direction trigger, ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC where a bar '
    + 'can fit inside it. Target ' + P80_TP_ATR + ' × ATR, stop ' + P80_SL_ATR + ' × ATR — '
    + 'implemented exactly as specified, and run unchanged on every rung from scalp to swing so '
    + 'the cost arithmetic can be read where it differs. A second mechanic, <b>'
    + esc(P80_VARIANTS[1].mech) + '</b>, runs the identical rules at a loosened pullback ('
    + P80_RSI_WIDE_LONG + ' / ' + P80_RSI_WIDE_SHORT + ') on the bars the spec turned away, '
    + 'recorded apart so neither lends the other its numbers.</div>'
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
W.hg80Breakeven      = hg80Breakeven;
W.hg80ExpectancyR    = hg80ExpectancyR;
W.hg80Indicators     = hg80Indicators;
W.hg80InSession      = hg80InSession;
W.hg80SessionApplies = hg80SessionApplies;
W.hg80VenueRt        = hg80VenueRt;
W.hg80VenueEnsure    = hg80VenueEnsure;
W.hg80Cfg            = hg80Cfg;
W.hg80Variant        = hg80Variant;
W.hg80SignalAt       = hg80SignalAt;
W.hg80Score          = hg80Score;
W.hg80Nearest        = hg80Nearest;
W.hg80MissCost       = hg80MissCost;
W.hg80BandRungs      = hg80BandRungs;
W.hg80UngatedRungs   = hg80UngatedRungs;
W.hg80FocusText      = hg80FocusText;
W.HG_P80_MISS_COST   = P80_MISS_COST;
W.hg80SecsToSession  = hg80SecsToSession;
W.hg80WhenTxt        = hg80WhenTxt;
W.hg80TzName         = hg80TzName;
W.hg80TzShort        = hg80TzShort;
W.hg80SessionLocalTxt = hg80SessionLocalTxt;
W.hg80Plan           = hg80Plan;
W.hg80Resolve        = hg80Resolve;
W.hg80PullbackCensus = hg80PullbackCensus;
W.hg80Scan           = hg80Scan;
W.hg80ScanTf         = hg80ScanTf;
W.hg80Record         = hg80Record;
W.HG_P80_TAB         = P80_TAB;
W.HG_P80_LADDER      = P80_LADDER;
W.HG_P80_VARIANTS    = P80_VARIANTS;
W.HG_P80_SPEC     = { tf: P80_TF, emaFast: P80_EMA_FAST, emaSlow: P80_EMA_SLOW,
                      rsiLen: P80_RSI_LEN, atrLen: P80_ATR_LEN,
                      rsiLong: P80_RSI_LONG, rsiShort: P80_RSI_SHORT,
                      tpAtr: P80_TP_ATR, slAtr: P80_SL_ATR,
                      utcFrom: P80_UTC_FROM, utcTo: P80_UTC_TO,
                      horizonBars: P80_HORIZON_BARS, claimed: P80_CLAIMED };

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: '80percent', label: '80PERCENT', mount: mount, refresh: refresh });
})();
