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

/* AND THE RUNG BETWEEN THEM, at the midline.

   With two mechanics the tab had a gap it could see and not name. On live
   gold the spec fired ZERO times on every rung of the ladder, because a
   market whose price is above its 50 EMA with the EMAs stacked up rarely
   lets RSI fall under 45 — the two conditions fight each other. So every
   firing the tab produced was WIDE, ten RSI points looser, and the reader
   had a choice between a mechanic that never fires and one that fires on a
   pullback most desks would not call a pullback.

   RSI 50 is the midline: the level the index is defined to sit at when
   average gain equals average loss. A long taken under it is being taken
   into weakness by the indicator's own definition, which is what a dip-buy
   is meant to be, and it is not a number fitted to this data — the census
   has been counting bars at 45, 50, 55 and 60 since the ladder shipped, so
   the 50 column was already on the page waiting to be traded.

   It is a mechanic, not a fix. It records under P80M, it is judged on its
   own record, and it lends nothing to the other two and borrows nothing
   from them. */
var P80_RSI_MID_LONG   = 50;        /* long pullback, midline: RSI below this */
var P80_RSI_MID_SHORT  = 50;        /* short pullback, midline: RSI above this */

/* Ordered TIGHTEST FIRST. hg80Scan takes the first that fires, which is what
   makes the populations disjoint, and it is only valid because each entry is
   a strict superset of the one before it — asserted in the tests, not
   assumed here. MID has to sit between the two on BOTH sides for that to
   hold: 45 < 50 < 55 going long, 55 > 50 > 45 going short. It does. */
var P80_VARIANTS = [
  { key: 'spec', label: 'SPEC', mech: 'P80',
    rsiLong: P80_RSI_LONG,      rsiShort: P80_RSI_SHORT },
  { key: 'mid',  label: 'MID',  mech: 'P80M',
    rsiLong: P80_RSI_MID_LONG,  rsiShort: P80_RSI_MID_SHORT },
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
var __p = { ui: null, busy: false, ranOnce: false, last: null, focus: null, view: 'simple',
            autoTimer: null, autoEl: null };

/* the focus as an array, whatever it is stored as */
function hg80FocusList(){
  if (!__p.focus) return [];
  return (typeof __p.focus === 'string') ? [__p.focus] : __p.focus.slice();
}
function hg80FocusHas(tf){ return hg80FocusList().indexOf(tf) >= 0; }

/* The rungs the focus wants DISPLAYED. Every rung is always scanned; this
   is the filter applied on the way to the page, and it is never applied to
   the forward-looking panel. */
function hg80Shown(rungs){
  var sel = hg80FocusList();
  if (!sel.length) return rungs;
  return rungs.filter(function(r){ return sel.indexOf(r.def.tf) >= 0; });
}

/* ---------------------------------------------------------------------
   THE TAB'S OWN STYLESHEET

   Everything this tab drew was inline, and every colour in it was a
   hard-coded Tailwind value: #10b981, #ef4444, #0ea5e9, #334155. This app
   runs data-theme="light" with --panel:#ffffff, so those were dark-theme
   greens and slate borders painted onto white cards. Sixteen of one, ten of
   another, forty in total, and not a single var(--...) anywhere in the file.

   It also hand-rolled a card that already exists. index.html ships .card,
   .card.long, .card.short, .chead, .sym, .dir, .mini and .plan — with a
   hover state and a left border in the right accent — and this tab drew its
   own out of inline borders instead.

   So: one stylesheet, injected once, built only out of the design tokens,
   and the app's own classes used wherever it already has one. The rule is
   that nothing here invents a colour. If a value is not in :root it does
   not belong in this file.
   --------------------------------------------------------------------- */
var P80_CSS = [
'.p80-strip{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;',
  'background:var(--panel2);border:1px solid var(--line);border-radius:6px;',
  'padding:9px 12px;margin-bottom:12px}',
'.p80-px{font-family:var(--mono);font-size:22px;font-weight:700;color:var(--txt);',
  'letter-spacing:-.01em;line-height:1}',
'.p80-px-k{font-size:9px;font-weight:700;letter-spacing:.16em;color:var(--mut);',
  'text-transform:uppercase}',
'.p80-strip .p80-sub{font-size:11px;color:var(--mut);font-weight:500}',
'.p80-strip.is-blind{background:transparent;border-style:dashed}',

/* a section lead: one sentence that says what the block beneath it is */
'.p80-lead{font-size:11px;color:var(--mut);font-weight:500;line-height:1.55;margin:10px 0 8px}',
'.p80-lead b{color:var(--txt);font-weight:700}',

/* band divider — SCALP / SWING */
'.p80-band{display:flex;align-items:center;gap:10px;margin:14px 0 8px}',
'.p80-band-k{font-family:var(--disp);font-size:10px;font-weight:800;letter-spacing:.16em;',
  'color:var(--mut);text-transform:uppercase;white-space:nowrap}',
'.p80-band-rule{flex:1;height:1px;background:var(--line)}',
'.p80-band-n{font-size:10px;color:var(--dim);font-weight:600;white-space:nowrap}',

/* the levels block: label, price, distance — three aligned columns */
'.p80-levels{display:grid;grid-template-columns:auto auto 1fr;gap:3px 16px;',
  'align-items:baseline;margin:10px 0 8px;max-width:440px}',
'.p80-lvl-k{font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--mut);',
  'text-transform:uppercase;white-space:nowrap}',
'.p80-lvl-v{font-family:var(--mono);font-size:17px;font-weight:700;color:var(--txt);',
  'text-align:right;font-variant-numeric:tabular-nums}',
'.p80-lvl-d{font-family:var(--mono);font-size:10px;color:var(--dim);',
  'white-space:nowrap;font-variant-numeric:tabular-nums}',
'.p80-levels.is-est .p80-lvl-v{color:var(--mut);font-weight:600}',

/* a metric line under a card — cost, risk:reward, the arithmetic */
'.p80-meta{font-size:11px;color:var(--mut);line-height:1.6;font-weight:500;',
  'border-top:1px solid var(--line);padding-top:7px;margin-top:8px}',
'.p80-meta b{color:var(--txt);font-weight:700}',
'.p80-meta.is-warn b{color:var(--veto)}',
'.p80-meta.is-ok b{color:var(--pass)}',

/* the caveat. Deliberately the quietest thing on the card: it has to be */
/* present on every one of them, and it stops being read the moment it */
/* shouts as loudly as the trade does. */
'.p80-caveat{font-size:10px;color:var(--dim);line-height:1.55;font-weight:500;',
  'margin-top:8px;padding-left:9px;border-left:2px solid var(--line)}',
'.p80-caveat b{color:var(--mut);font-weight:700}',

/* countdown / lean strip on an armed row */
'.p80-when{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:11px;',
  'color:var(--mut);font-weight:500;margin-top:4px}',
'.p80-when b{color:var(--txt);font-weight:700;font-family:var(--mono)}',
'.p80-lean{font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 7px;',
  'border-radius:3px;border:1px solid;white-space:nowrap}',
'.p80-lean.is-with{color:var(--pass);border-color:var(--pass);background:rgba(21,128,61,.07)}',
'.p80-lean.is-against{color:var(--veto);border-color:var(--veto);background:rgba(194,65,12,.07)}',

/* controls row */
'.p80-ctl{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 10px}',
'.p80-ctl-k{font-size:9px;font-weight:800;letter-spacing:.16em;color:var(--mut);',
  'text-transform:uppercase;margin-right:2px}',
'.p80-ctl .btn.ghost{padding:5px 11px;font-size:11px}',
'.btn.ghost.is-on{border-color:var(--gold-dim);color:var(--gold);font-weight:700;',
  'background:rgba(15,92,192,.06)}',
'.p80-ctl-note{font-size:10px;color:var(--dim);font-weight:500;flex-basis:100%;line-height:1.5}',

/* empty / waiting state */
'.p80-empty{background:var(--panel2);border:1px solid var(--line);border-radius:6px;',
  'padding:14px 16px;font-size:12px;color:var(--mut);line-height:1.6;font-weight:500}',
'.p80-empty b{color:var(--txt);font-weight:700}'
].join('');

function hg80InjectCss(){
  try {
    var d = W.document;
    if (!d || !d.createElement) return;
    if (d.getElementById && d.getElementById('hg-p80-css')) return;
    var el = d.createElement('style');
    el.id = 'hg-p80-css';
    el.textContent = P80_CSS;
    (d.head || d.documentElement).appendChild(el);
  } catch (e){}
}

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

/* ---------------------------------------------------------------------
   THE FORMING BAR IS NOT A CLOSED BAR, AND ON 5m IT WAS BEING READ AS ONE

   This tab's central claim is that a setup exists once a candle CLOSES and
   not before. On the 5m rung that was not true.

   The feed strips the unfinished bar through dropForming(rows, tf), which
   delegates to getClosedCandles(rows, tf, now). Both look the timeframe up
   in a table — and both tables list 15m, 1h, 2h, 4h and 1d. Neither lists
   5m. getClosedCandles hits `if (!sec) return clean` and hands back every
   row it was given, forming bar included; dropForming's own fallback map
   has the same hole. So four rungs of this ladder dropped it and the finest
   one did not.

   What that did to the 5m rung, every scan:
     - the trigger is "closed the right side of its open", read off a bar
       that had not closed, so it flipped as the bar moved
     - EMA, RSI and ATR all included a partial bar
     - ARMED is defined as "three conditions hold on the last CLOSED candle,
       only the trigger outstanding" — on 5m the last candle WAS the forming
       one, so the panel was describing a bar to itself
     - a firing recorded to the forward log carried a bar timestamp that had
       not settled

   OMNIGOLD's own v665 note describes this exact failure — "mechanics could
   pass on transient wick data that reversed before close, print a live
   ticket, then invalidate the next tick — exactly the 'setups are not good'
   experience a user reports" — and fixes it by calling dropForming. That
   fix inherits the same hole.

   So this rung does NOT look the timeframe up. It already knows its own
   seconds, from the ladder that defined it, and a bar whose open is less
   than one interval old has not closed. That is arithmetic on data the tab
   already holds, and it cannot acquire a missing-key bug later.

   It is idempotent: on the rungs where the feed already dropped the forming
   bar there is nothing to drop, and this returns them untouched.
   --------------------------------------------------------------------- */
function hg80SplitForming(rows, tfSec, nowSec){
  var out = { closed: rows || [], forming: null };
  var tf = fin(tfSec);
  if (!rows || !rows.length || !(tf > 0)) return out;
  var now = fin(nowSec);
  if (!isFinite(now)) now = Math.floor(Date.now() / 1000);
  var last = rows[rows.length - 1];
  var t = fin(last && last.t);
  if (!isFinite(t)) return out;
  if (t > 1e12) t = Math.floor(t / 1000);      /* ms feeds, same rule as the desk */
  if ((now - t) < tf){
    out.closed = rows.slice(0, -1);
    out.forming = last;
  }
  return out;
}

/* ---------------------------------------------------------------------
   WHERE GOLD ACTUALLY IS, RIGHT NOW

   Every number this tab printed came from the last CLOSED candle. That is
   correct for deciding whether a setup exists — a bar has to finish before
   its conditions can be read — and it is wrong for deciding whether one is
   still worth taking.

   The SETUPS panel has been labelling a firing from four bars ago "STILL
   OPEN — neither the stop nor the target has been touched yet" and counting
   it under "setups you could act on". Both statements are about the FETCHED
   BARS, which end at the last close. Between that close and now the market
   kept moving, and a setup whose stop price has since traded through is not
   open, not actionable, and offering it as either is the most dangerous
   sentence on the page.

   The gold desk already solved this twice and this tab used neither answer:
   hgGoldLiveSpot() reads spot from gold-api.com, and hgLivePriceGrade()
   sorts a plan against a live price into past-stop / past-t1 / fresh /
   past-entry / pending. One definition, more users.

   BOUNDED, AND NEVER LOAD-BEARING. The fetch races a timeout and resolves
   NaN on any failure, so a slow or blocked price endpoint delays nothing and
   removes nothing — the tab falls back to exactly what it printed before,
   and says that it is doing so rather than showing a stale grade.
   --------------------------------------------------------------------- */
var P80_SPOT_TIMEOUT_MS = 2500;
/* the desk's own floor for "the feed and spot have meaningfully diverged",
   from hgOgAlignPlansToSpot */
var P80_SPOT_DRIFT_PCT = 0.35;

function hg80LiveSpot(klineHint){
  var fn = gfn('hgGoldLiveSpot');
  if (!fn) return Promise.resolve(NaN);
  return Promise.race([
    Promise.resolve().then(function(){ return fn(klineHint); }).catch(function(){ return NaN; }),
    new Promise(function(r){ setTimeout(function(){ r(NaN); }, P80_SPOT_TIMEOUT_MS); })
  ]).then(function(px){
    var v = fin(px);
    return (isFinite(v) && v > 0) ? v : NaN;
  }).catch(function(){ return NaN; });
}

/* What the live price says about a plan. Delegates the geometry to the
   desk's shared grader so this tab, OMNIGOLD and OMNIROUTE cannot disagree
   about what "past the stop" means. */
function hg80LiveGrade(sig, px){
  var p = sig && sig.plan;
  var v = fin(px);
  if (!p || !isFinite(v) || !(v > 0)) return null;
  var fn = gfn('hgLivePriceGrade');
  if (!fn) return null;
  try {
    var g = fn(sig.dir, p.entry, p.stop, p.t1, null, v);
    return (g && g.grade) ? g.grade : null;
  } catch (e){ return null; }
}

/* THE FIVE GRADES, IN WORDS A DESK USES, and — the part that matters —
   whether each one is still a trade. `act` false is what keeps a dead setup
   out of the "you could act on" count. */
var P80_LIVE_STATE = {
  'fresh':      { act: true,  col: 'var(--pass)',
                  txt: 'AT ENTRY — gold is at this level right now' },
  'pending':    { act: true,  col: 'var(--pass)',
                  txt: 'WAITING — gold has not come back to the entry yet, so the fill is '
                       + 'still ahead of you' },
  'past-entry': { act: true,  col: 'var(--veto)',
                  txt: 'MOVED ON — gold is already past the entry, so part of the move is gone '
                       + 'and the rest of the target is closer than the card says' },
  'past-t1':    { act: false, col: 'var(--dim)',
                  txt: 'GONE — gold has already reached the target. There is nothing left to '
                       + 'take here' },
  'past-stop':  { act: false, col: 'var(--short)',
                  txt: 'DEAD — gold is already through the stop. This is not an open setup and '
                       + 'taking it now is taking the loss on purpose' }
};

function hg80LiveActs(grade){
  var st = P80_LIVE_STATE[grade];
  return st ? st.act === true : true;   /* no grade = no claim either way */
}

/* THE ONE THING WORTH SAYING ABOUT AN OVERLAPPING FIRING. Not "this is
   invalid" — the spec fired and the reader may be flat. What it says is
   what taking it would MEAN: a second position in the same direction on
   the same rung, not a second independent trade. */
function bookChipHtml(sig){
  if (!sig || sig.seq !== false || !sig.heldBy) return '';
  var held = sig.heldBy;
  var when = isFinite(fin(held.t)) ? hg80WhenTxt(fin(held.t)) : null;
  return '<div class="note" style="margin-top:4px;padding:3px 6px;border-left:3px solid '
    + 'var(--veto)"><b>DOUBLES AN OPEN TRADE.</b> The '
    + esc(String(held.dir || '').toUpperCase()) + (when ? ' from <b>' + esc(when) + '</b>' : '')
    + ' on this rung had not finished when this one fired. Taking both is one position twice '
    + 'over, not two trades — and it is why this firing is not counted in the book the '
    + 'measurements on this tab are made on.</div>';
}

function liveChipHtml(grade, px){
  var st = P80_LIVE_STATE[grade];
  if (!st) return '';
  return '<div class="note" style="margin-top:4px;padding:3px 6px;border-left:3px solid '
    + st.col + '"><b style="color:' + st.col + '">' + esc(st.txt) + '.</b> '
    + 'Gold is <b>' + num(px) + '</b> as this was drawn.</div>';
}

/* ---------------------------------------------------------------------
   IS THIS SETUP WORTH TAKING AT THIS VENUE

   "More setups" and "better setups" pull against each other, and the tab
   had no way to say which side of that line a given card fell on. The
   required-rate table in FULL had the arithmetic all along, per RUNG — but
   a reader looking at a 5m BUY card could not see that the 2.39 target it
   was offering came with a 0.87 round trip attached, which is 36% of the
   winner gone before the trade has an opinion.

   So every card now carries the same three numbers the table carries, for
   its own rung: what the target is worth, what the round trip costs, and
   what share of the win the second eats. The verdict is a LABEL ON THAT
   ARITHMETIC and not a recommendation — nothing here clears a gate, and a
   'clear' card is still a WATCH card.

   The 1/3 line is a display threshold and is stated as one. There is no
   measured basis for putting it at a third rather than a quarter; what is
   not arbitrary is 'gone' (the spread is the whole target — that is a
   fact, not a preference) and 'negative' (even at the rate the strategy
   claims for itself, the rung returns less than zero).
   --------------------------------------------------------------------- */
var P80_COST_HEAVY = 1 / 3;

function hg80CostVerdict(be){
  var out = { key: 'unknown', label: 'cost unknown', share: NaN, expR: NaN,
              cost: NaN, target: NaN };
  if (!be || !(fin(be.target) > 0) || !isFinite(fin(be.cost))) return out;
  out.cost = fin(be.cost);
  out.target = fin(be.target);
  out.share = out.cost / out.target;
  out.expR = hg80ExpectancyR(P80_CLAIMED, be);
  if (out.share >= 1)               { out.key = 'gone';     out.label = 'spread eats the target'; }
  else if (isFinite(out.expR) && out.expR <= 0)
                                    { out.key = 'negative'; out.label = 'negative even at the claimed rate'; }
  else if (out.share >= P80_COST_HEAVY)
                                    { out.key = 'heavy';    out.label = 'cost-heavy'; }
  else                              { out.key = 'clear';    out.label = 'cost is a small share'; }
  return out;
}

/* ---------------------------------------------------------------------
   WHAT IS KNOWABLE ABOUT A SETUP BEFORE IT RESOLVES

   The cost verdict has been printed on every card since hg-v782 and has
   never once decided anything. A 5m setup at XM whose round trip eats 36%
   of the target, and which returns a NEGATIVE expectancy even at the 85%
   the strategy claims for itself, was still counted under "setups you
   could act on" with an entry price beside it.

   That is the same untruth hg-v783 fixed for the live price, in a
   different place: the count asserting something the tab's own arithmetic
   contradicts two lines below. If the page computes that a rung cannot pay
   at this venue, that has to reach the count, or the computation is
   decoration.

   So three buckets now, not two:

     takeable      live price allows it AND the arithmetic does not refuse
     cannot pay    live price allows it, the arithmetic refuses
     no longer     live price has run past the level

   None are hidden. A setup that vanishes is one a reader asks about; a
   setup shown under a heading that says why is one they can learn from.

   THE STOP FLOOR IS A RANKING INPUT, NOT A GATE. P80_STOP_FLOOR is the
   0.50%-of-entry line under which noise dominates the stop. This tab's
   discipline is to implement the supplied spec exactly and disclose where
   it deviates, so a thin stop lowers a setup's rank and says so — it does
   not silently remove the trade the spec asked for.
   --------------------------------------------------------------------- */
function hg80Quality(sig, rung, grade){
  var v = hg80CostVerdict(rung && rung.be);
  var stopPct = (sig && sig.plan && isFinite(fin(sig.plan.stopPct)))
    ? fin(sig.plan.stopPct) : NaN;
  var underFloor = isFinite(stopPct) && stopPct < P80_STOP_FLOOR;

  /* 'unknown' makes NO claim in either direction. With the venue unreadable
     the tab cannot say a setup fails to pay, and refusing it on an unread
     input would be a worse error than showing it. */
  var pays = !(v.key === 'gone' || v.key === 'negative');

  /* A firing that lands while the previous trade on this rung is still
     running is not a second independent trade — taking it doubles the
     position. It is not refused (the spec fired, and a reader may well be
     flat), but it ranks below anything that stands on its own. */
  var doubles = (sig && sig.seq === false && sig.heldBy) ? true : false;

  var gradeRank = { 'fresh': 0, 'pending': 1, 'past-entry': 2 };
  var vi = 0, i;
  for (i = 0; i < P80_VARIANTS.length; i++){
    if (P80_VARIANTS[i].key === (sig && sig.variant)) { vi = i; break; }
  }

  /* Lower is better. Cost share leads because it is the one input that is
     both measured and decisive; the rest break ties. */
  var score = 0;
  score += isFinite(v.share) ? (v.share * 100) : 50;      /* % of the win the venue takes */
  score += (gradeRank[grade] == null ? 1 : gradeRank[grade]) * 8;
  score += vi * 4;                                        /* SPEC ahead of MID ahead of WIDE */
  score += underFloor ? 15 : 0;
  score += doubles ? 12 : 0;

  return { score: score, pays: pays, verdict: v, costShare: v.share,
           stopPct: stopPct, underFloor: underFloor, gradeRank: gradeRank[grade],
           doubles: doubles };
}

/* ---------------------------------------------------------------------
   WHICH RUNGS THE VENUE DOES NOT REFUSE

   A rung's breakeven is a property of the RUNG, not of any one firing:
   it is this timeframe's ATR-sized target against the venue's round trip.
   So when the arithmetic refuses a setup, the same arithmetic already
   knows which timeframes it would not have refused, and saying so is the
   only actionable thing on that card.

   Nothing here is a recommendation. A 4h rung whose target clears the
   spread is not thereby a good trade — it is a rung where the spread is
   not the reason to decline. That distinction is stated wherever this is
   rendered.
   --------------------------------------------------------------------- */
function hg80PayingRungs(rungs){
  var out = [], i;
  if (!rungs) return out;
  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r || !r.ok || !r.def) continue;
    var v = hg80CostVerdict(r.be);
    if (v.key === 'clear' || v.key === 'heavy') out.push({ tf: r.def.tf, share: v.share });
  }
  out.sort(function(a, b){ return a.share - b.share; });
  return out;
}

/* One line a reader can act on, from that verdict. */
function costLineHtml(be, venue){
  var v = hg80CostVerdict(be);
  if (v.key === 'unknown'){
    return '<div class="note" style="margin-top:4px">Cost not priced on this rung — the venue '
      + 'could not be read, so what the spread takes out of this target is unknown.</div>';
  }
  var bad = (v.key === 'gone' || v.key === 'negative');
  var col = bad ? 'var(--short)' : (v.key === 'heavy' ? 'var(--veto)' : 'var(--pass)');
  var h = '<div class="note" style="margin-top:4px;padding:3px 6px;border-left:3px solid ' + col + '">'
    + '<b>COST:</b> the round trip at ' + esc(venue || 'this venue') + ' is <b>' + num(v.cost)
    + '</b> against a <b>' + num(v.target) + '</b> target — <b style="color:' + col + '">'
    + (v.share * 100).toFixed(0) + '%</b> of the winner gone before the trade has an opinion. ';
  if (v.key === 'gone'){
    h += 'The spread is <b style="color:' + col + '">the whole target</b> — this rung cannot pay '
      + 'here however often it is right.';
  } else if (v.key === 'negative'){
    h += 'Even at the ' + (P80_CLAIMED * 100).toFixed(0) + '% the strategy claims for itself, '
      + 'that returns <b style="color:' + col + '">' + v.expR.toFixed(3) + 'R</b> per trade.';
  } else if (v.key === 'heavy'){
    /* the R figure needs a stop distance to be a ratio of; without one the
       share is still true and the expectancy is simply not available, which
       is said rather than printed as NaN */
    h += isFinite(v.expR)
      ? ('Taking the claimed rate at face value it still returns +' + v.expR.toFixed(3) + 'R, but '
         + 'over a third of every win is the venue\'s.')
      : 'Over a third of every win is the venue\'s.';
  } else {
    h += isFinite(v.expR)
      ? ('At the claimed rate that is +' + v.expR.toFixed(3) + 'R per trade.')
      : 'The per-trade expectancy needs a stop distance and is not available on this rung.';
  }
  return h + '</div>';
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

  /* AND WHEN LOCAL *IS* UTC, SAY IT ONCE. Every timestamp on this tab read
     "13:55 UTC · 13:55 UTC" for anyone at offset zero — London in winter,
     Lisbon, Accra, Reykjavik, and any browser or container with no zone
     set at all, which is not a rare case. The offset is the authoritative
     test; the abbreviation is a display string and can be either of two
     things at the same instant. */
  var off = 0;
  try { off = d.getTimezoneOffset(); } catch (e){ off = null; }
  if (loc && off === 0) return loc + ' UTC';

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

/* ---------------------------------------------------------------------
   WHAT IS ARMED, AND WHAT WOULD TRIP IT

   I have been answering "show me forthcoming setups" with "a setup exists
   once a candle closes, not before". That is true and it was not the whole
   truth, and the gap mattered.

   Of the four conditions, THREE are already settled on the last closed
   candle. The trend is known. The RSI pullback is known. The session is a
   clock. Only the trigger — did this candle close the right way — is decided
   at the close of the bar that has not finished yet.

   So a rung with trend, pullback and session all holding is ARMED: one
   candle from firing, and the thing that would fire it is precisely stated.
   A long needs a close above the bar's open; the open of the bar now forming
   is a price you can read off a chart. That is not a prediction, it is the
   condition written out.

   What is NOT promised: the trend and the RSI are recomputed on the new bar
   too, and either can drop out. Armed means one condition away on what is
   known now, not a trade that is going to happen. Every line says so.
   --------------------------------------------------------------------- */

/* Seconds until the bar now forming closes. Bars align to multiples of the
   timeframe from the epoch, which is the same rule the fetchers use. */
function hg80SecsToBarClose(tfSec, nowSec){
  var tf = fin(tfSec), t = fin(nowSec);
  if (!(tf > 0) || !isFinite(t)) return null;
  return (Math.floor(t / tf) + 1) * tf - t;
}

/* Every rung that is one CANDLE-DIRECTION away, across every mechanic.

   Only the trigger may be missing. A rung missing its trend is not armed in
   any useful sense — that is days of work on a 4h chart, and calling it
   "nearly there" would be the same flattery the ratio-printed-backwards bug
   was.

   This reads the WHOLE ladder and is deliberately not filtered by the rung
   focus. Focus is a filter on history — "show me every 4h firing" — and
   applying it here would let a view setting hide the one thing on the page
   that looks forward. A 5m bar arming while the reader has 1d selected is
   exactly the row they need to see. */
function hg80Armed(rungs){
  var out = [], i, vi, si;
  var sides = ['long', 'short'];
  var nowSec = Math.floor(Date.now() / 1000);
  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r.ok || !r.res || !r.res.ind || !r.rows || !r.rows.length) continue;
    var last = r.rows.length - 1;
    for (si = 0; si < sides.length; si++){
      var side = sides[si];
      for (vi = 0; vi < P80_VARIANTS.length; vi++){
        var v = P80_VARIANTS[vi];
        var sg = hg80SignalAt(r.rows, r.res.ind, last, r.cfg, v);
        if (!sg) continue;
        var sc = hg80Score(side === 'long' ? sg.longChecks : sg.shortChecks);
        /* armed = everything but the trigger */
        if (sc.missing.length !== 1 || sc.missing[0] !== 'trigger') continue;
        /* the bar now forming opens where the last one closed, near enough
           to name the level a reader should watch — and it is stated as the
           last close, not passed off as the live open */
        var lvl = fin(sg.close);
        var atr = fin(sg.atr);
        out.push({
          rung: r, band: r.def.band, variant: v, side: side, sig: sg,
          level: lvl, atr: atr,
          entryEst: lvl,
          stopEst: side === 'long' ? lvl - P80_SL_ATR * atr : lvl + P80_SL_ATR * atr,
          targetEst: side === 'long' ? lvl + P80_TP_ATR * atr : lvl - P80_TP_ATR * atr,
          closesIn: hg80SecsToBarClose(r.cfg.tfSec, nowSec)
        });
        break;     /* tightest variant armed on this side wins — one row per rung per side */
      }
    }
  }
  /* soonest decision first — a 5m bar closing in 90 seconds is more use than
     a daily one closing in nine hours */
  out.sort(function(a, b){ return fin(a.closesIn) - fin(b.closesIn); });
  return out;
}

/* ---------------------------------------------------------------------
   THE TIER BELOW ARMED

   Armed is a strict test and on a quiet ladder it is empty, which left the
   forward-looking half of the tab showing nothing at all — the complaint
   that produced it in the first place, one rung down.

   So this is what is TWO away, where the second one is a thing that can
   actually move: the RSI pullback, or the clock. Both resolve on their own
   without anybody's permission — RSI drifts every bar, the session opens at
   a time that is already known — so "what has to happen" can be written out
   exactly, with the distance attached.

   Trend is excluded on purpose, here as in hg80Armed. A rung needing its
   EMAs to recross is not two conditions from a trade in any sense a reader
   should be shown next to one that needs a red candle.

   A rung/side already ARMED is not listed again: the stronger row is the
   one that belongs on the page. */
function hg80Arming(rungs, armed){
  var out = [], i, vi, si;
  var sides = ['long', 'short'];
  var nowSec = Math.floor(Date.now() / 1000);
  var taken = {}, k;
  for (k = 0; k < (armed || []).length; k++){
    taken[armed[k].rung.def.tf + '|' + armed[k].side] = true;
  }
  var toOpen = hg80SecsToSession(nowSec);

  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r.ok || !r.res || !r.res.ind || !r.rows || !r.rows.length) continue;
    var last = r.rows.length - 1;
    for (si = 0; si < sides.length; si++){
      var side = sides[si];
      if (taken[r.def.tf + '|' + side]) continue;
      /* THE NEAREST THRESHOLD, NOT THE TIGHTEST MECHANIC.

         hg80Armed breaks on the first (tightest) variant that qualifies,
         and there that is right: an armed SPEC row is better news than an
         armed WIDE row on the same bar. Here nothing is armed and the
         question is a different one — what is closest to happening — so
         breaking first printed "RSI is 85.7 and has to get below 45, 40.7
         points away" when WIDE's 55 was 10 points nearer and would trip
         first. That is the same mistake the board made before hg80Nearest
         was weighted: the right distance, measured to the wrong place.

         So every variant is evaluated and the smallest gap wins, ties
         breaking toward the tighter mechanic. */
      var best = null;
      for (vi = 0; vi < P80_VARIANTS.length; vi++){
        var v = P80_VARIANTS[vi];
        var sg = hg80SignalAt(r.rows, r.res.ind, last, r.cfg, v);
        if (!sg) continue;
        var sc = hg80Score(side === 'long' ? sg.longChecks : sg.shortChecks);
        if (sc.missing.length !== 2) continue;
        if (sc.missing.indexOf('trigger') < 0) continue;
        var other = sc.missing[0] === 'trigger' ? sc.missing[1] : sc.missing[0];
        if (other !== 'pullback' && other !== 'session') continue;

        var need;
        if (other === 'pullback'){
          var want = side === 'long' ? v.rsiLong : v.rsiShort;
          need = { kind: 'pullback', rsi: fin(sg.rsi), want: want,
                   gap: Math.abs(fin(sg.rsi) - want),
                   txt: 'RSI is ' + num(sg.rsi, 1) + ' and has to get '
                        + (side === 'long' ? 'below ' : 'above ') + want
                        + ' — ' + num(Math.abs(fin(sg.rsi) - want), 1) + ' points away' };
        } else {
          /* "it opens in 0m" is what this said for the whole five hours the
             window is actually open — the exact time the row matters most,
             and the one moment the sentence reads as though nothing can
             happen. The bar that failed the session check failed it on ITS
             timestamp; whether the window is open NOW is a different fact,
             and when it is, the next candle is already inside it. */
          need = { kind: 'session', secs: toOpen, gap: 0,
                   txt: (toOpen > 0)
                     ? ('the ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC window has to be '
                        + 'open — it opens in ' + hg80DurTxt(toOpen))
                     : ('the ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC window is open '
                        + 'NOW — the candle forming is already inside it') };
        }
        var cand = { rung: r, band: r.def.band, variant: v, side: side, sig: sg,
                     need: need, level: fin(sg.close), atr: fin(sg.atr),
                     closesIn: hg80SecsToBarClose(r.cfg.tfSec, nowSec) };
        if (!best || fin(cand.need.gap) < fin(best.need.gap)) best = cand;
      }
      if (best) out.push(best);
    }
  }
  /* the clock is a known quantity and RSI is not, so session-blocked rows
     sort by how long the wait is and pullback rows by how far RSI has to
     travel — within each kind, nearest first; session before pullback
     because "wait four hours" is a more certain statement than "RSI has to
     fall six points" */
  out.sort(function(a, b){
    if (a.need.kind !== b.need.kind) return a.need.kind === 'session' ? -1 : 1;
    if (a.need.kind === 'session') return fin(a.need.secs) - fin(b.need.secs);
    return fin(a.need.gap) - fin(b.need.gap);
  });
  return out;
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
/* `opts` lets a caller price the SAME signal at a different target/stop pair
   without re-coding the geometry. It defaults to the supplied spec, so every
   existing caller — the tab, the tests, the walk's normal run — is
   unchanged.

   It exists for the geometry sweep. The spec's 4.00 / 0.75 needs 84.2105%
   before costs, which is the tab's binding constraint and the one thing no
   entry rule can fix. Asking "what would a different pair have needed, and
   what would it have got, on these same entries" is a question about data,
   and answering it with a second copy of the plan arithmetic is how a sweep
   ends up measuring a strategy nobody is running. */
function hg80Plan(sig, opts){
  if (!sig || !sig.dir || !(sig.atr > 0)) return null;
  var o = opts || {};
  var tpAtr = isFinite(fin(o.tpAtr)) && fin(o.tpAtr) > 0 ? fin(o.tpAtr) : P80_TP_ATR;
  var slAtr = isFinite(fin(o.slAtr)) && fin(o.slAtr) > 0 ? fin(o.slAtr) : P80_SL_ATR;
  var entry = sig.close;
  var tpDist = tpAtr * sig.atr, slDist = slAtr * sig.atr;
  var t1   = sig.dir === 'long' ? entry + tpDist : entry - tpDist;
  var stop = sig.dir === 'long' ? entry - slDist : entry + slDist;
  return { dir: sig.dir, entry: entry, stop: stop, t1: t1,
           risk: slDist, reward: tpDist, atr: sig.atr,
           tpAtr: tpAtr, slAtr: slAtr,
           tf: sig.tf || P80_TF, variant: sig.variant || 'spec',
           rr: tpDist > 0 ? (slDist / tpDist) : NaN,
           /* what this pair has to hit before any cost — a property of the
              geometry alone, carried so a sweep never has to re-derive it */
           grossBreakeven: slAtr / (slAtr + tpAtr),
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

   Every result also carries the EXCURSIONS — the worst the trade ever got
   (mae) and the best it ever got (mfe), in ATR and in R, over the bars it
   was open including the one that ended it. The outcome says what the
   supplied geometry paid; the excursions say whether that geometry was
   the thing being measured.
   --------------------------------------------------------------------- */
function hg80Resolve(rows, i, plan, horizon){
  if (!rows || !plan) return null;
  var long = plan.dir === 'long';
  var E = fin(plan.entry), T = fin(plan.t1), S = fin(plan.stop);
  var risk = Math.abs(E - S);
  if (!(risk > 0)) return null;
  var atr = fin(plan.atr);
  var rMul = function(px){ return (long ? (px - E) : (E - px)) / risk; };

  /* HOW FAR IT ACTUALLY TRAVELLED, both ways, up to and including the bar
     that ended it. The outcome alone cannot answer "was 4.00 ATR of stop
     doing anything?" — only the worst point the trade ever reached can.
     Measured in ATR because that is the unit the geometry is specified in;
     also in R, which is the same thing divided by the stop distance. */
  var advMax = 0, favMax = 0;
  var mark = function(b){
    var adv = long ? (E - fin(b.l)) : (fin(b.h) - E);
    var fav = long ? (fin(b.h) - E) : (E - fin(b.l));
    if (isFinite(adv) && adv > advMax) advMax = adv;
    if (isFinite(fav) && fav > favMax) favMax = fav;
  };
  var done = function(o){
    o.maeR = advMax / risk;
    o.mfeR = favMax / risk;
    o.maeAtr = (atr > 0) ? (advMax / atr) : NaN;
    o.mfeAtr = (atr > 0) ? (favMax / atr) : NaN;
    return o;
  };

  for (var j = i + 1; j < rows.length && j <= i + horizon; j++){
    var b = rows[j];
    var hitT = long ? (fin(b.h) >= T) : (fin(b.l) <= T);
    var hitS = long ? (fin(b.l) <= S) : (fin(b.h) >= S);
    var gapS = long ? (fin(b.o) <= S) : (fin(b.o) >= S);
    var gapT = long ? (fin(b.o) >= T) : (fin(b.o) <= T);
    mark(b);

    if (gapS) return done({ outcome: 'loss', exit: fin(b.o), rMultiple: rMul(fin(b.o)), bars: j - i,
                       exitT: fin(b.t), gapped: true, ambiguous: false });
    if (gapT) return done({ outcome: 'win', exit: fin(b.o), rMultiple: rMul(fin(b.o)), bars: j - i,
                       exitT: fin(b.t), gapped: true, ambiguous: false });
    if (hitT && hitS) return done({ outcome: 'win', exit: T, rMultiple: rMul(T), bars: j - i,
                               exitT: fin(b.t), gapped: false, ambiguous: true });
    if (hitT) return done({ outcome: 'win', exit: T, rMultiple: rMul(T), bars: j - i,
                       exitT: fin(b.t), gapped: false, ambiguous: false });
    if (hitS) return done({ outcome: 'loss', exit: S, rMultiple: rMul(S), bars: j - i,
                       exitT: fin(b.t), gapped: false, ambiguous: false });
  }
  var last = rows[Math.min(i + horizon, rows.length - 1)];
  return done({ outcome: 'expired', exit: fin(last.c), rMultiple: rMul(fin(last.c)),
           bars: Math.min(horizon, rows.length - 1 - i), exitT: fin(last.t),
           gapped: false, ambiguous: false });
}

/* ---------------------------------------------------------------------
   WHAT THE STOP AND THE TARGET ACTUALLY HAD TO BE

   The spec puts the stop at 4.00 ATR and the target at 0.75 ATR, and this
   tab has said since hg-v772 what that geometry costs: 5.33 risked for
   every 1 gained, so it has to be right 84.2% of the time before a single
   spread is paid. That number has been presented as the thing to beat.

   It has never been asked whether the 4.00 is doing anything. A stop is
   only risk if price goes there. If the deepest any firing in this window
   ever traded against its entry is 1.2 ATR, then two thirds of the stop is
   notional — the 84.2% is being paid for risk that did not occur, and the
   binding constraint is the geometry, not the market.

   That question is answerable from bars already on screen, so it is
   answered here rather than deferred to a walk that has never been run.

   THREE MEASUREMENTS, AND THEY ARE MEASUREMENTS:

     deepest adverse     the worst point ANY resolved firing reached
     the winners' worst  the tightest stop that would still have held
                         every winner in this window
     the failures' best  how close the ones that did not pay got to the
                         target before they died

   AND ONE ARITHMETIC CONSEQUENCE, WHICH IS WHERE THE CARE GOES. The
   breakeven at the winners' worst is a stop FITTED TO THE DATA IT IS
   MEASURED ON. That is the oldest way there is to manufacture an edge that
   does not survive out of sample, and it is stated as such everywhere it
   is shown. It is here to size the GAP between the spec's stop and
   anything that happened — not to be traded, and not to replace the
   sweep, which is the only thing that can answer it honestly.

   Below P80_EXC_MIN_N winners no fit is quoted at all. The measurement is
   still shown, because "3 firings resolved and here is what they did" is
   a true sentence; "so the stop should be 1.1 ATR" is not.
   --------------------------------------------------------------------- */
var P80_EXC_MIN_N = 10;

/* a reduce, not an apply: applying Math.max spreads the array as arguments
   and throws once it is long enough */
function hg80Max(arr){
  if (!arr || !arr.length) return NaN;
  var m = -Infinity, i;
  for (i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

function hg80Median(arr){
  if (!arr || !arr.length) return NaN;
  var a = arr.slice().sort(function(x, y){ return x - y; });
  var m = Math.floor(a.length / 2);
  return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
}

function hg80Excursions(rungs){
  var out = { n: 0, nWin: 0, nFail: 0, nOverlap: 0, maeAll: [], maeWin: [], mfeFail: [],
              deepest: NaN, medianMae: NaN, winnersWorst: NaN, failuresBest: NaN,
              fittedSlAtr: NaN, fittedBe: NaN, specBe: P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR),
              enough: false, byTf: [] };
  if (!rungs) return out;
  var i, j;
  for (i = 0; i < rungs.length; i++){
    var r = rungs[i];
    if (!r || !r.ok || !r.res || !r.res.signals) continue;
    var tfN = 0, tfMae = [];
    for (j = 0; j < r.res.signals.length; j++){
      var sg = r.res.signals[j];
      /* only what RESOLVED. An open trade has not finished travelling, and
         counting its excursion so far would understate every one of them. */
      if (!sg.res || sg.status === 'open' || sg.status === 'unpriced') continue;
      /* AND ONLY THE SEQUENTIAL BOOK. A firing that landed inside an open
         trade is largely a re-print of it: counting both inflates n with
         observations that are not independent, which is exactly the way a
         threshold guarding a fitted number gets cleared without the
         evidence to clear it. Counted separately, never silently. */
      if (sg.seq === false){ out.nOverlap++; continue; }
      var mae = fin(sg.res.maeAtr), mfe = fin(sg.res.mfeAtr);
      if (!isFinite(mae) || !isFinite(mfe)) continue;
      out.n++; tfN++;
      out.maeAll.push(mae); tfMae.push(mae);
      if (sg.status === 'win'){ out.nWin++; out.maeWin.push(mae); }
      else { out.nFail++; out.mfeFail.push(mfe); }
    }
    if (tfN) out.byTf.push({ tf: r.def.tf, n: tfN, deepest: hg80Max(tfMae),
                             median: hg80Median(tfMae) });
  }
  if (!out.n) return out;
  out.deepest = hg80Max(out.maeAll);
  out.medianMae = hg80Median(out.maeAll);
  if (out.maeWin.length) out.winnersWorst = hg80Max(out.maeWin);
  if (out.mfeFail.length) out.failuresBest = hg80Max(out.mfeFail);

  /* the fit, and ONLY above the threshold */
  out.enough = out.maeWin.length >= P80_EXC_MIN_N;
  if (out.enough && isFinite(out.winnersWorst) && out.winnersWorst > 0){
    out.fittedSlAtr = out.winnersWorst;
    out.fittedBe = out.fittedSlAtr / (out.fittedSlAtr + P80_TP_ATR);
  }
  return out;
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

/* ---------------------------------------------------------------------
   WHY THE SPEC IS SILENT, MEASURED RATHER THAN ASSERTED

   The tab has said for several versions that trend and pullback "fight each
   other" — a long needs price ABOVE its 50 EMA while RSI(14) says the last
   fourteen bars were net DOWN — and it has never put a number on it. The
   walk does, and the number is not a small effect:

     side   trend    pullback   together   if independent   rarer by
     long   48.97%   43.56%     0.07%      21.33%           312.9x

   Each condition holds about half the time. If they were unrelated they
   would coincide on a fifth of all bars. They coincide on one bar in 1400.

   That ratio is the honest answer to "why does the supplied spec never
   fire", and it is structural rather than a property of one sample, so it
   belongs on the page next to the counts rather than only in a script the
   reader has to run. Counted here on the same pass that builds the census,
   so it costs nothing extra.
   --------------------------------------------------------------------- */
function hg80PullbackCensus(rows, ind, cfg){
  var out = { armedLong: 0, armedShort: 0, levels: [], bars: 0,
              coincide: { long: null, short: null } };
  if (!rows || !ind) return out;
  var i, k;
  var longAt = {}, shortAt = {};
  var tally = { long: { trend: 0, pull: 0, both: 0 }, short: { trend: 0, pull: 0, both: 0 } };
  for (k = 0; k < P80_CENSUS_LEVELS.length; k++){ longAt[P80_CENSUS_LEVELS[k]] = 0; shortAt[P80_CENSUS_LEVELS[k]] = 0; }
  for (i = Math.max(P80_EMA_SLOW, 0); i < rows.length; i++){
    var sg = hg80SignalAt(rows, ind, i, cfg);
    if (!sg) continue;
    out.bars++;
    var lc = sg.longChecks, sc = sg.shortChecks;
    /* the two conditions on their own, and together — the SPEC's thresholds,
       because "why does the spec never fire" is the question being answered */
    if (lc.trend) tally.long.trend++;
    if (lc.pullback) tally.long.pull++;
    if (lc.trend && lc.pullback) tally.long.both++;
    if (sc.trend) tally.short.trend++;
    if (sc.pullback) tally.short.pull++;
    if (sc.trend && sc.pullback) tally.short.both++;
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
  /* how much rarer the pair is than independence would predict. Null rather
     than a number when the denominator is zero — a ratio against nothing is
     not a finding. */
  var sides = ['long', 'short'];
  for (k = 0; k < sides.length; k++){
    var t = tally[sides[k]];
    if (!out.bars) continue;
    var pT = t.trend / out.bars, pP = t.pull / out.bars, pB = t.both / out.bars;
    out.coincide[sides[k]] = {
      trend: pT, pullback: pP, both: pB,
      ifIndependent: pT * pP,
      rarerBy: (pB > 0) ? ((pT * pP) / pB) : null,
      nBoth: t.both
    };
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
   THE SEQUENTIAL BOOK — WHICH FIRINGS A DESK COULD ACTUALLY HAVE TAKEN

   scripts/walk-80percent.mjs has kept one position at a time since it was
   written: a firing that lands while the previous trade is still open is
   skipped, and the count it reports is the count of trades a desk could
   have held. The tab has never done this. It resolved every firing
   independently, so a rung the walk scores as 6 trades the tab scored as
   12 — the same bars, counted twice, because the second firing of a pair
   is very largely a re-print of the first.

   That divergence was invisible while the tab only reported outcomes. It
   stopped being invisible the moment hg-v791 started MEASURING on them:
   overlapping firings are not independent observations, so a sample of
   them is smaller than its count, and the 10-winner threshold guarding
   the fitted stop was being cleared with duplicates.

   NOTHING IS HIDDEN. Every firing still renders — the spec fired when it
   fired, and a reader looking for a live setup wants to see it. What
   changes is that a firing landing inside an open trade is MARKED, both
   so the counting can exclude it and because "this fires while the 14:20
   long is still running" is the single most useful thing that can be said
   about it: taking it means doubling the position, not taking a second
   independent trade.

   ONE BOOK PER RUNG, both directions, all three variants — exactly what
   the walk does. A long that fires while a short is open is still a
   second position.
   --------------------------------------------------------------------- */
function hg80MarkBook(signals){
  var openUntil = -1, heldBy = null, i;
  if (!signals) return;
  for (i = 0; i < signals.length; i++){
    var s = signals[i];
    if (!s.res){ s.seq = false; s.heldBy = null; continue; }
    if (s.i <= openUntil){
      s.seq = false;
      s.heldBy = heldBy;   /* the signal still running when this one fired */
      continue;
    }
    s.seq = true;
    s.heldBy = null;
    openUntil = s.i + s.res.bars;
    heldBy = s;
  }
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

  var tally = { open: 0, win: 0, loss: 0, expired: 0, ambiguous: 0, overlap: 0 };
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

  /* and which of them a desk could actually have taken — see hg80MarkBook */
  hg80MarkBook(res.signals);
  for (i = 0; i < res.signals.length; i++) if (res.signals[i].seq === false) tally.overlap++;

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
/* ---------------------------------------------------------------------
   THE LEDGER THIS TAB HAS BEEN WRITING TO AND NEVER READ

   Every scan calls hgFwdRecord. Nothing has ever called anything back. So
   the tab has been accumulating out-of-sample evidence under OMNIGOLD:P80
   since the ladder shipped and showing a reader none of it, while every
   card asserted "no measured record on this desk" whether or not that was
   still true.

   Eight modules read their ledger back — omnigold, omniroute, edge,
   squeeze, oiflow, omnipresent, reversalsniper and the forward layer
   itself. This one wrote and never read.

   It matters more now than it did before hg-v784. Until then the 5m rung
   was scanning an unfinished candle, so what it recorded on that rung was
   junk. Those records are trustworthy now, and this is the ONE evidence
   route that needs no export and no open network: it fills on its own,
   every scan, from bars that had not printed when the setup was logged.

   minRr is this strategy's own T1 in R — 0.75 ATR of target against 4.00
   ATR of stop — not the desk-wide 2R default, which would judge these
   trades against a target they never had. */
function hg80FwdMinRr(){ return P80_TP_ATR / P80_SL_ATR; }

/* What the ledger says about ONE mechanic, or null when it has nothing.
   Used by the card, so a WATCH line can stop claiming there is no record
   the moment there is one. */
/* ---------------------------------------------------------------------
   THE BAR THIS TAB IS ACTUALLY TESTING AGAINST

   hg-v789 read the ledger back through hgOmniPoolRead(p, minRr, 20, 2).
   The fourth argument is not a rounding constant. It is the FAMILY-WISE
   SIGNIFICANCE BAR — the z a mechanic has to clear once you account for
   how many mechanics are being tested at the same time — and every other
   consumer in the app computes it from the pool it just read:

     hgFwdPanelHTML   hgOmniFamilyZ(keys.length)
     hgOmni20xForwardPaid  hgOmniFamilyZ(keys.length)
     the ledger panel      hgOmniFamilyZ(ledgerRows)

   omniroute states the property in as many words — "the family-wise bar
   over the mechanics that pool actually holds. Nothing is reimplemented:
   the READ column and this gate cannot disagree." This tab reimplemented
   it as the literal 2, so the READ column and this gate COULD disagree,
   on the same mechanic, on the same page: the FORWARD panel judging it at
   one bar and the card's watch line at another.

   And the gap is not small. This tab can hold 3 variants x 5 rungs x 2
   directions = 30 mechanics. The single-hypothesis bar is z = 1.64; the
   correct bar at 30 is z = 2.93. Testing thirty things at a bar meant for
   one produces roughly one and a half "this works" verdicts out of pure
   noise, which is the exact failure this whole tab is built to avoid —
   and it would have produced them in the one place on the page that reads
   out-of-sample evidence.

   Computed from the pool's OWN keys, so it rises as the tab records more
   mechanics rather than being set once from a count that may never be
   reached. The literal 2 survives only as the fallback for a page where
   omniroute did not load, which is what every other call site does.
   --------------------------------------------------------------------- */
function hg80FwdBar(pool){
  var keys = [], k, n;
  if (pool) for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)) keys.push(k);
  /* the bar is taken at ONE hypothesis when the pool is empty — z at k=0
     is not defined, and a bar of zero would pass everything. `held` keeps
     the two cases apart so the page can say which it is. */
  n = Math.max(1, keys.length);
  var fz = gfn('hgOmniFamilyZ');
  return { n: n, held: keys.length, z: fz ? fin(fz(n)) : 2, measured: !!fz };
}

/* every mechanic this tab could ever record: one per variant, per rung,
   per direction. The ceiling the bar climbs toward — stated so a reader
   knows the number is going to get harder, not that it moved arbitrarily. */
function hg80MechanicCeiling(){
  return P80_VARIANTS.length * P80_LADDER.length * 2;
}

function hg80FwdRead(mechanic){
  try {
    var poolFn = gfn('hgFwdPool');
    if (!poolFn || !mechanic) return null;
    var pool = poolFn(P80_TAB);
    if (!pool) return null;
    var p = pool[mechanic];
    if (!p) return null;
    var bar = hg80FwdBar(pool);
    var readFn = gfn('hgOmniPoolRead');
    var read = readFn ? readFn(p, hg80FwdMinRr(), 20, bar.z) : null;
    return { pool: p, read: read, mechanic: mechanic, bar: bar };
  } catch (e){ return null; }
}

/* HOW MANY THINGS THIS TAB IS TESTING, AND WHAT THAT COSTS. A reader
   looking at a READ column has to know whether a verdict cleared a bar
   meant for one hypothesis or for thirty. Stated in trades rather than in
   statistics: at the single-hypothesis bar, testing thirty mechanics
   produces about one and a half "this works" verdicts from noise alone. */
function familyBarHtml(){
  var poolFn = gfn('hgFwdPool');
  var pool = null;
  try { pool = poolFn ? poolFn(P80_TAB) : null; } catch (e){ pool = null; }
  var bar = hg80FwdBar(pool);
  if (!bar.measured){
    return '<div class="note warn" style="margin-top:6px">The family-wise bar could not be '
      + 'computed (omniroute did not load), so the verdicts above fall back to z 2 — a bar for '
      + 'ONE hypothesis, not for the ' + bar.n + ' this tab holds. Read them as indicative '
      + 'only.</div>';
  }
  var ceil = hg80MechanicCeiling();
  var ceilZ = gfn('hgOmniFamilyZ');
  var lead;
  if (!bar.held){
    lead = '<b>Nothing recorded yet, so the bar is z ' + bar.z.toFixed(2) + '</b> — what a '
      + 'single pre-registered hypothesis faces. It rises as soon as this log holds more than '
      + 'one mechanic. ';
  } else if (bar.n === 1){
    lead = '<b>One mechanic in this pool, so the bar is z ' + bar.z.toFixed(2) + '</b> — the '
      + 'single-hypothesis bar, which is the right one while there is only one thing being '
      + 'tested. It rises with the second. ';
  } else {
    lead = '<b>' + bar.n + ' mechanics in this pool, so the bar is z ' + bar.z.toFixed(2)
      + '.</b> A single pre-registered hypothesis would face z '
      + (ceilZ ? fin(ceilZ(1)).toFixed(2) : '1.64') + '. ';
  }
  return '<div class="note" style="margin-top:6px;padding:6px 8px;border-left:3px solid '
    + 'var(--line)">' + lead
    + 'Thirty tested at the single-hypothesis bar would hand back about one and a half winners '
    + 'from noise alone, so the bar rises with the count — that is the correction, and it is '
    + 'computed from the mechanics this log actually holds rather than assumed. '
    + '<span class="note">This tab can reach <b>' + ceil + '</b> ('
    + P80_VARIANTS.length + ' variants x ' + P80_LADDER.length + ' rungs x 2 directions), '
    + 'where the bar is z ' + (gfn('hgOmniFamilyZ') ? fin(gfn('hgOmniFamilyZ')(ceil)).toFixed(2)
        : '—') + '. It gets harder as the tab records more, which is the right direction: every '
    + 'mechanic added is another chance for one of them to look good by accident.</span></div>';
}

function forwardPanelHtml(){
  var pf = gfn('hgFwdPanelHTML');
  if (!pf){
    return '<div class="note" style="margin-top:10px">The forward log (hg-forward.js) is not '
      + 'loaded, so what this tab has recorded cannot be shown.</div>';
  }
  var body = '';
  try {
    body = pf(P80_TAB, { minRr: hg80FwdMinRr(),
                         title: 'FORWARD — what this tab has actually recorded' }) || '';
  } catch (e){ body = ''; }
  if (!body) return '';
  return '<div class="panel" style="margin-top:10px">' + body
    + familyBarHtml()
    + '<div class="note" style="margin-top:6px">Recorded under <b>' + esc(P80_TAB) + '</b>, one '
    + 'mechanic per rung per direction, judged at this strategy\'s own T1 of '
    + hg80FwdMinRr().toFixed(4) + 'R — ' + P80_TP_ATR.toFixed(2) + ' ATR of target against '
    + P80_SL_ATR.toFixed(2) + ' ATR of stop. This is the only number on the tab that is not a '
    + 'property of the window just fetched: each row was logged when it fired and settled later '
    + 'by bars that had not printed at the time.</div></div>';
}

/* The measurement, with the fit kept on a very short leash — see
   hg80Excursions for why that leash is the whole point. */
function excursionHtml(rungs){
  var x = hg80Excursions(rungs);
  if (!x.n){
    return '<div class="panel" style="margin-top:10px"><h2>WHAT THE STOP HAD TO BE '
      + '<span>this window</span></h2>'
      + '<div class="p80-lead">Nothing in the bars fetched has resolved yet, so there is no '
      + 'excursion to measure. This panel fills as firings finish — it is a property of the '
      + 'window on screen, not of a record kept over time.</div></div>';
  }

  var h = '<div class="panel" style="margin-top:10px"><h2>WHAT THE STOP HAD TO BE '
    + '<span>this window</span></h2>'
    + '<div class="p80-lead">The spec puts the stop at <b>' + P80_SL_ATR.toFixed(2)
    + ' ATR</b> and the target at <b>' + P80_TP_ATR.toFixed(2) + ' ATR</b>, and the tab has said '
    + 'from the start what that costs: <b>' + (x.specBe * 100).toFixed(2) + '%</b> to break even '
    + 'before a single spread. What it has never asked is whether the '
    + P80_SL_ATR.toFixed(2) + ' is doing anything. A stop is only risk if price goes there.</div>';

  h += '<div class="p80-levels">'
    + '<span class="p80-lvl-k">Trades in the book</span>'
    + '<span class="p80-lvl-v">' + x.n + '</span>'
    + '<span class="p80-lvl-d">' + x.nWin + ' reached the target, ' + x.nFail + ' did not'
    + (x.nOverlap ? ' · ' + x.nOverlap + ' further firing'
        + (x.nOverlap === 1 ? '' : 's') + ' landed inside an open trade and '
        + (x.nOverlap === 1 ? 'is' : 'are') + ' not counted here' : '') + '</span>'
    + '<span class="p80-lvl-k">Deepest adverse</span>'
    + '<span class="p80-lvl-v">' + x.deepest.toFixed(2) + ' ATR</span>'
    + '<span class="p80-lvl-d">the worst point any of them reached — against a '
    + P80_SL_ATR.toFixed(2) + ' ATR stop, that is '
    + (100 * x.deepest / P80_SL_ATR).toFixed(0) + '% of it</span>'
    + '<span class="p80-lvl-k">Median adverse</span>'
    + '<span class="p80-lvl-v">' + x.medianMae.toFixed(2) + ' ATR</span>'
    + '<span class="p80-lvl-d">half of them never went further against the entry than this</span>';
  if (isFinite(x.winnersWorst)){
    h += '<span class="p80-lvl-k">The winners\' worst</span>'
      + '<span class="p80-lvl-v">' + x.winnersWorst.toFixed(2) + ' ATR</span>'
      + '<span class="p80-lvl-d">the tightest stop that would still have held every one of the '
      + x.nWin + ' that paid, in this window</span>';
  }
  if (isFinite(x.failuresBest)){
    h += '<span class="p80-lvl-k">The failures\' best</span>'
      + '<span class="p80-lvl-v">' + x.failuresBest.toFixed(2) + ' ATR</span>'
      + '<span class="p80-lvl-d">how close the ' + x.nFail + ' that did not pay got to the '
      + P80_TP_ATR.toFixed(2) + ' ATR target before they died</span>';
  }
  h += '</div>';

  /* THE ARITHMETIC CONSEQUENCE, AND THE WARNING THAT GOES WITH IT. */
  if (x.enough && isFinite(x.fittedBe)){
    var drop = (x.specBe - x.fittedBe) * 100;
    h += '<div class="note warn" style="margin-top:8px;padding:10px 12px;border:1px solid '
      + 'var(--line);border-left:3px solid var(--veto);border-radius:6px">'
      + '<b>AND THIS IS WHY THAT MATTERS — READ THE SECOND PARAGRAPH BEFORE THE FIRST.</b><br>'
      + 'A stop at <b>' + x.fittedSlAtr.toFixed(2) + ' ATR</b> would have held all ' + x.nWin
      + ' winners here. Against the same ' + P80_TP_ATR.toFixed(2) + ' ATR target that is 1:'
      + (x.fittedSlAtr / P80_TP_ATR).toFixed(3) + ', which breaks even at <b>'
      + (x.fittedBe * 100).toFixed(2) + '%</b> instead of ' + (x.specBe * 100).toFixed(2)
      + '% — <b>' + drop.toFixed(1) + ' points</b> of required accuracy, removed by changing '
      + 'nothing about which bars fire.<br>'
      + '<span class="note">That stop was FITTED TO THE DATA IT IS MEASURED ON. Choosing the '
      + 'stop that happens to have held this window\'s winners is the oldest way there is to '
      + 'manufacture an edge that does not survive out of sample, and the number above is very '
      + 'probably too good for that exact reason. More than that: it is a <b>maximum over a '
      + 'sample of ' + x.nWin + '</b> — ' + x.nWin + ' trades in the sequential book, not '
      + (x.nWin + x.nOverlap) + ' firings — and a maximum can only rise as the sample grows. So it is '
      + 'not merely uncertain — it is biased TIGHT, in a known direction, and the true figure is '
      + 'above it rather than scattered around it. It is here to size the GAP between the '
      + 'spec\'s stop and anything that actually happened — not to be traded. The thing that can '
      + 'answer it honestly is the sweep, on bars this tab has never seen: '
      + '<code>node scripts/walk-80percent.mjs --bars-file=&lt;your bars&gt; --sweep</code>.'
      + '</span></div>';
  } else {
    h += '<div class="note" style="margin-top:8px">' + x.nWin + ' winner'
      + (x.nWin === 1 ? '' : 's') + ' in the book have resolved in this window'
      + (x.nOverlap ? ' (the ' + x.nOverlap + ' overlapping firing'
          + (x.nOverlap === 1 ? '' : 's') + ' would not have been separate trades)' : '')
      + '. <b>No stop is fitted below '
      + P80_EXC_MIN_N + '</b> — "' + x.nWin + ' firings resolved and here is what they did" is a '
      + 'true sentence; "so the stop should be ' + (isFinite(x.winnersWorst)
          ? x.winnersWorst.toFixed(2) : 'X') + ' ATR" is not one, at this sample size. The '
      + 'measurements above stand on their own.</div>';
  }

  if (x.byTf.length > 1){
    h += '<table class="tbl" style="margin-top:8px"><tr><th>rung</th><th>resolved</th>'
      + '<th>deepest adverse</th><th>median adverse</th><th>of the stop</th></tr>';
    for (var i = 0; i < x.byTf.length; i++){
      var b = x.byTf[i];
      h += '<tr><td><b>' + esc(b.tf) + '</b></td>'
        + '<td class="hg-num">' + b.n + '</td>'
        + '<td class="hg-num">' + b.deepest.toFixed(2) + ' ATR</td>'
        + '<td class="hg-num">' + b.median.toFixed(2) + ' ATR</td>'
        + '<td class="hg-num">' + (100 * b.deepest / P80_SL_ATR).toFixed(0) + '%</td></tr>';
    }
    h += '</table>';
  }

  h += '<div class="p80-caveat">Measured over the SEQUENTIAL BOOK — one position at a time, '
    + 'which is what scripts/walk-80percent.mjs has always counted and what a desk could '
    + 'actually have held. A firing that lands while the previous trade is still open is '
    + 'largely a re-print of it, so counting both would inflate the sample with observations '
    + 'that are not independent. Every number here is a property of the bars currently on '
    + 'screen and changes on the next scan. It is not a record and it is not evidence of an '
    + 'edge — a window in which nothing went badly wrong is exactly the window in which a '
    + 'fitted stop looks best.</div></div>';
  return h;
}

function mathPanelHtml(rungs, venue, basis){
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  var h = '<div class="note warn" style="margin:8px 0;padding:10px 12px;'
    + 'border:1px solid var(--line);border-left:3px solid var(--veto);border-radius:6px;'
    + 'background:var(--panel2)">'
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
  h += '</table><div class="note">"Closest" walks ALL ' + P80_VARIANTS.length + ' mechanics and '
    + 'BOTH sides and reports the one nearest to firing, on the last CLOSED bar, with the '
    + 'mechanic named. Reporting it against the spec alone printed "2 conditions away" for a rung '
    + 'that was one red candle from a looser entry — the wrong message, about the wrong mechanic. '
    + 'A green chip means one condition short. It is not a forecast and not a setup — it is where '
    + 'the rung stands.</div></div>';
  return h;
}

/* What the nearer side still needs, by name and by number. */
/* The fired count, split by mechanic. One pooled number would hide the
   thing the split exists to show: how many of a rung's firings the spec
   actually produced, and how many are the loosened ones. */
/* Firings per mechanic, KEYED BY THE VARIANT TABLE.

   This used to read `variant === 'wide' ? 'wide' : 'spec'`, which is a
   two-mechanic assumption wearing a ternary. Adding a third would have
   filed every MID firing under SPEC — inflating the record of the one
   mechanic on this tab whose numbers are supposed to be untouched by the
   looser ones. Unknown keys are counted under their own name rather than
   folded into a neighbour. */
function hg80CountByVariant(rung){
  var out = { total: 0, by: {}, long: 0, short: 0 }, i;
  for (i = 0; i < P80_VARIANTS.length; i++) out.by[P80_VARIANTS[i].key] = 0;
  if (!rung || !rung.ok) return out;
  for (i = 0; i < rung.res.signals.length; i++){
    var sg = rung.res.signals[i], k = sg.variant;
    if (out.by[k] == null) out.by[k] = 0;
    out.by[k]++; out.total++;
    /* BOTH DIRECTIONS, COUNTED. Nothing in the protocol favours one — a bar
       cannot satisfy both trend tests, so the split is whatever the market
       gave — but a reader could not see that without auditing the rows, and
       "does this thing ever short?" deserves a number rather than a search. */
    if (sg.dir === 'long') out.long++; else if (sg.dir === 'short') out.short++;
  }
  return out;
}

/* "SPEC 0 · MID 3 · WIDE 7", built from the table so it grows with it. */
function hg80CountTxt(c, sep){
  var bits = [], i;
  for (i = 0; i < P80_VARIANTS.length; i++){
    var v = P80_VARIANTS[i];
    bits.push(v.label + ' ' + (c.by[v.key] || 0));
  }
  return bits.join(sep == null ? ' · ' : sep);
}

function firedSplitHtml(r){
  var c = hg80CountByVariant(r);
  var rate = r.scanned > 0 ? (100 * c.total / r.scanned).toFixed(2) + '%' : '—';
  var chips = '', i;
  for (i = 0; i < P80_VARIANTS.length; i++){
    var v = P80_VARIANTS[i], n = c.by[v.key] || 0;
    chips += '<span class="statuschip ' + (v.key === 'spec' && n ? 'ok' : 'na') + '">'
      + esc(v.label) + ' ' + n + '</span> ';
  }
  /* FIRINGS AND TRADES ARE DIFFERENT NUMBERS, and the board says so rather
     than printing one and letting it be read as the other. */
  var ovl = (r.tally && r.tally.overlap) || 0;
  return chips + '<div class="note">' + c.total + ' in ' + r.scanned + ' · ' + rate
    + '<br><span style="color:var(--long)">' + c.long + ' long</span> · '
    + '<span style="color:var(--short)">' + c.short + ' short</span>'
    + (ovl ? '<br><span class="warn">' + ovl + ' of them fired inside an open trade</span> '
        + '<span class="dim">— ' + (c.total - ovl) + ' trade'
        + ((c.total - ovl) === 1 ? '' : 's') + ' a desk could have held, one at a time</span>'
      : '') + '</div>';
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
  var v = hg80Variant(sig && sig.variant);
  /* SPEC is the supplied rule and reads as the pass state; everything
     looser is chipped as what it is, so no card can be mistaken for a spec
     firing at a glance */
  return '<span class="statuschip ' + (v.key === 'spec' ? 'ok' : 'na') + '">'
    + esc(v.label) + '</span>';
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

   It used to stop FETCHING the other four as well. That made one control do
   two jobs, and the second job quietly broke the first once the tab grew a
   panel that looks forward: an unfetched rung cannot be reported as arming,
   so a view filter was deciding what the reader was allowed to know was
   coming. Every rung is scanned on every pass now; this narrows the page,
   not the scan, and WHAT IS COMING ignores it entirely.
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
    return '<button type="button" class="btn ghost' + (on ? ' is-on' : '') + '"'
      + ' data-p80-view="' + v + '">' + esc(label) + '</button> ';
  }
  return '<div class="p80-ctl">'
    + '<span class="p80-ctl-k">View</span> '
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
    return '<button type="button" class="btn ghost' + (on ? ' is-on' : '') + '"'
      + ' data-p80-focus="' + esc(attr) + '">' + esc(label) + '</button> ';
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
          + ' window, uncapped. Click a rung again to drop it. The whole ladder is still '
          + 'scanned, and WHAT IS COMING still reports all five.'
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
    return '<button type="button" class="btn ghost' + (on ? ' is-on' : '') + '"'
      + ' id="' + id + '" data-p80-venue="' + name + '"'
      + (ovr ? ' disabled' : '') + '>' + esc(label) + '</button>';
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
  var when = hg80WhenTxt(sig.t, true);
  var age = rung ? (rung.rows.length - 1) - sig.i : null;

  /* .card / .card.long / .chead / .sym / .dir are the app's own, and they
     already carry the left accent, the hover state and the type scale this
     was reproducing by hand in inline styles. */
  var h = '<div class="card ' + (long ? 'long' : 'short') + '" style="margin-bottom:12px">'
    + '<div class="chead"><span class="sym">' + (long ? 'BUY' : 'SELL') + ' XAUUSD</span>'
    + '<span class="dir">' + esc(rung ? rung.def.tf : '') + '</span></div>';

  h += '<div class="p80-when">' + esc(when)
    + (age != null && age > 0 && rung
        ? '<span class="dim">· ' + age + ' bar' + (age === 1 ? '' : 's') + ' ago ('
          + ageTxt(age * rung.cfg.tfSec) + ')</span>'
        : (age === 0 ? '<span class="dim">· just closed</span>' : ''))
    + '</div>';

  if (state) h += '<div class="row" style="margin-top:7px">' + state + '</div>';

  /* THE THREE NUMBERS, aligned. Label, price, distance — tabular figures in
     one grid so the decimal points line up down the card, which is the
     difference between a price list you can scan and one you have to read. */
  function lvl(label, px, from){
    var d = (from == null) ? NaN : fin(px) - fin(from);
    var pct = (d / fin(from)) * 100;
    return '<span class="p80-lvl-k">' + esc(label) + '</span>'
      + '<span class="p80-lvl-v">' + num(px) + '</span>'
      + '<span class="p80-lvl-d">'
      + (isFinite(d) ? Math.abs(d).toFixed(2) + '  (' + Math.abs(pct).toFixed(2) + '%)' : '')
      + '</span>';
  }
  h += '<div class="p80-levels">'
    + lvl('Entry', p.entry, null)
    + lvl('Stop loss', p.stop, p.entry)
    + lvl('Take profit', p.t1, p.entry)
    + '</div>';

  /* p.rr is risk/reward — 5.33 here. Printed as "1:0.19" it reads as though
     the reward were the 1, which is the flattering way round and the wrong
     one. Say it as a desk says it: what you risk, for what you stand to
     make. */
  h += '<div class="p80-meta">You risk <b>' + num(p.risk) + '</b> to make <b>' + num(p.reward)
    + '</b> — ' + num(p.rr, 2) + ' risked for every 1 gained, so it has to win '
    + ((P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR)) * 100).toFixed(1)
    + '% of the time just to break even, before any spread.</div>';

  if (rung) h += costLineHtml(rung.be, __p.venue ? __p.venue.venue : null);

  h += watchLineHtml(sig);
  return h + '</div>';
}

/* THE WATCH LINE, ANSWERABLE TO THE LEDGER.

   It said "has no measured record on this desk" on every card, always,
   whether or not the forward log had one — which made it an assertion about
   the tab's own state that the tab never checked. Now it reads the ledger
   for that mechanic and says what is actually there.

   It stays a WATCH either way. A handful of settled trades is not a record
   that earns anything, and the shared reader is what decides when it is;
   the change is that the sentence is now true rather than merely cautious. */
function watchLineHtml(sig){
  var mech = sig && sig.mech ? sig.mech : null;
  var label = esc((sig && sig.variantLabel) || 'SPEC');
  var got = mech ? hg80FwdRead(mech) : null;
  var settled = got && got.pool ? fin(got.pool.settled) : NaN;

  if (!got || !(settled > 0)){
    return '<div class="p80-caveat"><b>WATCH — not a signal to act on.</b> ' + label
      + ' has nothing settled in the forward log yet. It is recorded on every firing, so this '
      + 'fills on its own — see FORWARD below for what has accumulated.</div>';
  }
  var readTxt = (got.read && got.read.read) ? String(got.read.read) : null;
  var bar = got.bar;
  return '<div class="p80-caveat"><b>WATCH — not a signal to act on.</b> ' + label
    + ' has <b>' + settled + '</b> settled in the forward log'
    + (readTxt ? ', which reads <b>' + esc(readTxt) + '</b>' : '')
    + (bar && bar.measured
        ? ' — judged at <b>z ' + bar.z.toFixed(2) + '</b>, the bar for testing '
          + bar.n + ' mechanic' + (bar.n === 1 ? '' : 's') + ' at once, not the z 1.64 a single '
          + 'pre-registered one would face'
        : '')
    + '. That is out-of-sample and it is the only measured thing on this card — but it is a '
    + 'record being built, not one that has been earned. See FORWARD below.</div>';
}

/* When this strategy CAN produce a trade, in the reader's own clock. It is
   the only schedulable thing about it: whether the four conditions line up
   inside the window is not knowable in advance, but the window itself is. */
/* The panel the whole tab was missing: what is one candle away, what would
   trip it, and when that candle closes — in the reader's own clock. */
function armedHtml(rungs, livePx){
  var armed = hg80Armed(rungs);
  var arming = hg80Arming(rungs, armed);
  if (!armed.length && !arming.length) return '';

  var nowSec = Math.floor(Date.now() / 1000);
  var h = '<div class="panel" style="border-left:3px solid var(--gold)">'
    + '<h2>WHAT IS COMING <span>'
    + armed.length + ' armed · ' + arming.length + ' one step behind</span></h3>';

  h += sideCountHtml(armed, arming);

  if (armed.length){
    h += '<div class="note" style="margin-top:6px"><b>ARMED — ONE CANDLE AWAY.</b> Three of the '
      + 'four conditions hold on the last closed candle. Only the candle\'s own direction is '
      + 'outstanding, and it is decided at the close named on each row.</div>';
    h += bandBlocksHtml(armed, function(x){ return armedRowHtml(x, livePx); });
  }

  if (arming.length){
    h += '<div class="note" style="margin-top:8px"><b>ONE STEP BEHIND.</b> These need the candle '
      + '<i>and</i> one more thing — an RSI level, or the session clock. Both move on their own, '
      + 'so what is outstanding is written out with the distance attached.</div>';
    h += bandBlocksHtml(arming, armingRowHtml);
  }

  h += '<div class="p80-caveat" style="margin-top:12px">'
    + '<b>Armed is not a promise.</b> The trend, the RSI pullback and — on the rungs where a bar '
    + 'can fit inside the window — the session are recomputed on the new candle, and any of them '
    + 'can drop out before it closes. Levels are worked from '
    + 'the last close and the current ATR — the real ones are set by whichever candle actually '
    + 'fires. This is the outstanding condition stated exactly; it is not a forecast that it '
    + 'will be met.</div>';
  return h + '</div>';
}

/* Long and short, scalp and swing, counted on the page. A reader asking
   "does this thing ever short?" should not have to audit the rows. */
function sideCountHtml(armed, arming){
  var all = armed.concat(arming);
  function n(band, side){
    var c = 0;
    for (var i = 0; i < all.length; i++){
      if (all[i].band === band && all[i].side === side) c++;
    }
    return c;
  }
  var bands = ['scalp', 'swing'], h = '', i;
  for (i = 0; i < bands.length; i++){
    var b = bands[i];
    h += '<span class="p80-band-k">' + esc(b.toUpperCase()) + '</span>'
      + '<span class="note" style="margin-right:16px">'
      + '<b style="color:var(--long)">' + n(b, 'long') + '</b> long · '
      + '<b style="color:var(--short)">' + n(b, 'short') + '</b> short</span>';
  }
  return '<div class="row" style="gap:7px;margin:2px 0 4px">' + h + '</div>';
}

/* Grouped SCALP then SWING, because those are the two different trades on
   this ladder — a 5m row and a 1d row share every rule and nothing about
   how long you sit in them. */
function bandBlocksHtml(list, rowFn){
  var bands = ['scalp', 'swing'], h = '', i, j;
  for (i = 0; i < bands.length; i++){
    var b = bands[i];
    var rows = list.filter(function(x){ return x.band === b; });
    if (!rows.length) continue;
    h += '<div class="p80-band"><span class="p80-band-k">' + esc(b.toUpperCase()) + '</span>'
      + '<span class="p80-band-rule"></span>'
      + '<span class="p80-band-n">' + esc(hg80BandRungs(b).join(' · ')) + '</span></div>';
    for (j = 0; j < rows.length; j++) h += rowFn(rows[j]);
  }
  return h;
}

function armedRowHtml(a, livePx){
  var long = a.side === 'long';
  var closesAt = isFinite(fin(a.closesIn))
    ? hg80WhenTxt(Math.floor(Date.now() / 1000) + fin(a.closesIn), false) : '';
  var h = '<div class="card ' + (long ? 'long' : 'short') + '" style="margin-bottom:10px">'
    + '<div class="chead"><span class="sym">' + (long ? 'BUY' : 'SELL') + ' XAUUSD</span>'
    + '<span class="dir">' + esc(a.rung.def.tf) + ' · ' + variantChipHtml({ variant: a.variant.key })
    + '</span></div>'
    + '<div class="p80-lead" style="margin-top:0"><b>Fires if this candle closes '
    + (long ? 'ABOVE' : 'BELOW') + ' its open.</b> The last one closed at <b>' + num(a.level)
    + '</b>, which is about where this one opened — so watch that level.</div>'
    + '<div class="p80-when">Candle closes in <b>' + hg80DurTxt(a.closesIn) + '</b>'
    + (closesAt ? '<span class="dim">at ' + esc(closesAt) + '</span>' : '') + '</div>'
    + armedLiveHtml(a, livePx);

  /* "is-est" greys the figures: these are worked from the last close and the
     current ATR, and the real ones are set by whichever candle fires. The
     card says so in words too, but a reader scanning prices should be able
     to see at a glance that these are not the same kind of number as the
     ones on a fired setup. */
  h += '<div class="p80-levels is-est">'
    + '<span class="p80-lvl-k">Likely entry</span>'
    + '<span class="p80-lvl-v">' + num(a.entryEst) + '</span><span class="p80-lvl-d"></span>'
    + '<span class="p80-lvl-k">Likely stop</span>'
    + '<span class="p80-lvl-v">' + num(a.stopEst) + '</span>'
    + '<span class="p80-lvl-d">' + num(Math.abs(a.entryEst - a.stopEst)) + ' away</span>'
    + '<span class="p80-lvl-k">Likely target</span>'
    + '<span class="p80-lvl-v">' + num(a.targetEst) + '</span>'
    + '<span class="p80-lvl-d">' + num(Math.abs(a.entryEst - a.targetEst)) + ' away</span>'
    + '</div>';
  h += costLineHtml(a.rung.be, __p.venue ? __p.venue.venue : null);
  return h + '</div>';
}

/* WHERE GOLD IS RELATIVE TO THE LEVEL THAT WOULD TRIP THIS.

   The trigger is "closes the right side of its open", and the open is what
   the last bar closed at. So the live price against that level says which
   way the forming candle is currently leaning — not whether it will finish
   there, which nothing can say, but which side it is on as the reader
   looks. A row that needs a green close while gold sits 3.20 BELOW the open
   is leaning the wrong way, and that is worth seeing next to the countdown. */
function armedLiveHtml(a, livePx){
  var px = fin(livePx), lvl = fin(a.level);
  if (!isFinite(px) || !(px > 0) || !isFinite(lvl)) return '';
  var long = a.side === 'long';
  var d = px - lvl;
  var leaning = long ? (d > 0) : (d < 0);
  /* The badge says whether the forming candle is currently going the way
     this setup needs; the line beside it says by how much and what it needs.
     "WITH YOU / AGAINST YOU" rather than naming a colour, because a badge
     reading "LEANING RED" is good news for a short and bad for a long, and a
     reader should not have to hold the direction in their head to decode
     it. */
  return '<div class="p80-when">Gold <b>' + num(px) + '</b>'
    + '<span class="p80-lean ' + (leaning ? 'is-with' : 'is-against') + '">'
    + (leaning ? 'WITH YOU' : 'AGAINST YOU') + '</span>'
    + '<span class="dim">' + num(Math.abs(d)) + ' ' + (d >= 0 ? 'above' : 'below')
    + ' that level · needs a ' + (long ? 'green' : 'red') + ' close</span></div>'
    + '<div class="p80-caveat" style="margin-top:5px">'
    + (leaning ? 'Leaning the right way' : 'Leaning the wrong way') + ' as of this scan. '
    + 'The candle is not finished; this is where it stands, not where it ends.</div>';
}

function armingRowHtml(a){
  var long = a.side === 'long';
  return '<div class="card" style="margin-bottom:8px;border-style:dashed">'
    + '<div class="chead"><span class="sym" style="font-size:13px">'
    + '<span style="color:var(--' + (long ? 'long' : 'short') + ')">' + (long ? 'BUY' : 'SELL')
    + '</span> XAUUSD</span>'
    + '<span class="dir">' + esc(a.rung.def.tf) + ' · '
    + variantChipHtml({ variant: a.variant.key }) + '</span></div>'
    + '<div class="p80-lead" style="margin:4px 0 0">Waiting on <b>' + esc(a.need.txt) + '</b>. '
    + 'Then a candle closing ' + (long ? 'ABOVE' : 'BELOW') + ' its open. '
    + '<span class="dim">Trend is already aligned; last close ' + num(a.level) + '.</span></div>'
    + '</div>';
}

/* ---------------------------------------------------------------------
   THE LIVE PRICE, AND HOW FAR THE BAR FEED IS FROM IT

   Two different numbers that both get called "the gold price", printed
   side by side because a reader comparing an entry to their broker's
   screen needs to know which one the entry came from.

   The levels on every card are computed from the BAR FEED — its closes and
   its ATR. They are deliberately NOT rescaled to spot. Rescaling would mix
   two sources inside one plan, and this tab writes those plans to the
   forward log, so a rescaled level would put a number in the record that no
   bar ever produced. The gap is disclosed instead, and above the desk's own
   0.35% floor it is disclosed as a warning.
   --------------------------------------------------------------------- */
/* The target, as a share of price, MEASURED on the rungs actually scanned
   rather than assumed from a constant. This number is the whole argument for
   why a foreign spot price cannot grade these cards, so it has to be the
   real one — an earlier draft of this panel multiplied two constants
   together and printed 3.000% for a target that is nearer 0.055%. */
function hg80TargetSharePct(rungs){
  var best = null, i;
  for (i = 0; i < (rungs || []).length; i++){
    var r = rungs[i];
    if (!r || !r.ok || !r.be || !(fin(r.be.target) > 0) || !(fin(r.lastPx) > 0)) continue;
    var share = 100 * fin(r.be.target) / fin(r.lastPx);
    if (best === null || share < best) best = share;
  }
  return best;
}

function livePriceHtml(gradePx, gradeTf, spot, feedRef, rungs){
  var gp = fin(gradePx), sp = fin(spot), ref = fin(feedRef);
  var live = isFinite(gp) && gp > 0;

  var h = '<div class="p80-strip' + (live ? '' : ' is-blind') + '">'
    + '<span class="p80-px-k">Live gold</span>';
  h += live
    ? ('<span class="p80-px">' + num(gp) + '</span>'
       + '<span class="p80-sub">from the <b>' + esc(gradeTf || '') + '</b> bar forming now, on '
       + 'the same feed the levels came from</span>')
    : ('<span class="p80-sub"><b>not available this scan.</b> No rung returned an unfinished '
       + 'bar, so there is no price on the same feed as the levels. Nothing below is graded '
       + 'against a live price — every status comes from the last closed candle, which is what '
       + 'this tab did before.</span>');
  if (isFinite(sp) && sp > 0){
    h += '<span class="p80-sub" style="flex-basis:100%">Spot cross-check <b>' + num(sp) + '</b>'
      + (isFinite(ref) && ref > 0
          ? ' (' + (((sp / ref) - 1) >= 0 ? '+' : '')
            + ((((sp / ref) - 1)) * 100).toFixed(3) + '% from the feed\'s last close)'
          : '')
      + ' — <b>it does not grade anything</b>, and that is arithmetic rather than caution. ';
    var share = hg80TargetSharePct(rungs);
    h += (share !== null)
      ? ('The tightest target on the ladder is <b>' + share.toFixed(3) + '% of price</b>'
         + (isFinite(ref) && ref > 0
             ? ', and these two feeds are ' + Math.abs(((sp / ref) - 1) * 100).toFixed(3)
               + '% apart' : '')
         + '. Two price sources routinely sit further apart than the whole target, so a '
         + 'cross-source comparison would decide every card on the gap between the feeds '
         + 'rather than on anything the market did.')
      : ('The targets here are a few hundredths of a percent of price, smaller than two price '
         + 'sources routinely differ by — so a cross-source comparison would decide every card '
         + 'on the gap between the feeds.');
    h += '</span>';
  }

  /* the basis the app itself measured for these bars, when it measured one */
  var bFn = gfn('hgGoldBasisNote');
  var bTxt = '';
  try { bTxt = bFn ? String(bFn() || '') : ''; } catch (e){ bTxt = ''; }
  if (bTxt){
    h += '<span class="p80-sub" style="flex-basis:100%;color:var(--veto)"><b>FEED BASIS:</b> '
      + esc(bTxt) + '</span>';
  }
  return h + '</div>';
}

function sessionClockHtml(rungs){
  var usable = rungs.filter(function(r){ return r.ok; });
  if (!usable.length) return '';
  var gated = usable.filter(function(r){ return r.cfg.session !== false; });
  var free = usable.filter(function(r){ return r.cfg.session === false; });
  var toOpen = hg80SecsToSession(Math.floor(Date.now() / 1000));
  var loc = hg80SessionLocalTxt();

  var h = '<div class="note" style="margin-top:8px;padding:6px 8px;border-left:3px solid var(--dim)">'
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

/* The one actionable line on a card the arithmetic has refused: where on
   this same ladder the spread is NOT the reason to decline. */
function payingRungsHtml(rungs){
  var pay = hg80PayingRungs(rungs);
  if (!pay.length){
    return ' <span class="warn">No rung on this ladder clears the round trip at this venue '
      + 'right now — on today\'s ATR the spread is the binding constraint at every timeframe '
      + 'scanned, not the setup.</span>';
  }
  var names = pay.map(function(p){
    return '<b>' + esc(p.tf) + '</b> (' + (p.share * 100).toFixed(0) + '%)';
  }).join(', ');
  return ' <span class="dim">On today\'s ATR the round trip does clear the target at '
    + names + ' — that is where the spread is not the reason to decline. It is not a reason '
    + 'to take a trade there; it is the rung where this one would have been priceable.</span>';
}

function simpleSetupsHtml(rungs, livePx){
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

  /* GRADE EVERY CANDIDATE AGAINST THE LIVE PRICE BEFORE COUNTING IT.

     "STILL OPEN — neither the stop nor the target has been touched yet" was
     a statement about the FETCHED BARS, which end at the last close. Between
     that close and now the market kept moving, so a firing from four bars
     ago could be through its stop already and this panel was still counting
     it under "setups you could act on" and printing an entry for it. The
     live grade is what decides actionability now; with no live price nothing
     is graded and the old wording is used unchanged, which is the honest
     fallback rather than a guess in either direction. */
  var spot = fin(livePx);
  var cands = [], k;
  for (k = 0; k < live.length; k++) cands.push({ r: live[k].r, s: live[k].s, fresh: true });
  for (k = 0; k < open.length; k++) cands.push({ r: open[k].r, s: open[k].s, fresh: false });
  for (k = 0; k < cands.length; k++){
    cands[k].grade = hg80LiveGrade(cands[k].s, spot);
    cands[k].act = hg80LiveActs(cands[k].grade);
    cands[k].q = hg80Quality(cands[k].s, cands[k].r, cands[k].grade);
  }
  /* THREE BUCKETS. The arithmetic is binding now: a rung the tab has already
     computed cannot pay at this venue does not get counted as one you could
     act on, any more than one price has run past does. */
  var actable = cands.filter(function(c){ return c.act && c.q.pays; });
  var noPay   = cands.filter(function(c){ return c.act && !c.q.pays; });
  var dead    = cands.filter(function(c){ return !c.act; });

  /* best first, by what is knowable before it resolves — see hg80Quality */
  actable.sort(function(a, b){ return a.q.score - b.q.score; });
  noPay.sort(function(a, b){ return a.q.score - b.q.score; });

  if (actable.length || noPay.length || dead.length){
    var otherN = noPay.length + dead.length;
    if (actable.length){
      h += '<div class="note ok" style="margin-bottom:4px"><b>' + actable.length
        + ' setup' + (actable.length === 1 ? '' : 's') + ' you could act on'
        + (isFinite(spot) ? ', checked against gold at <b>' + num(spot) + '</b>' : '')
        + '.</b> <span class="dim">Best first — by what the venue takes out of the win, then '
        + 'how close price is, then how tight the mechanic is.</span>'
        + (otherN ? ' <span class="warn">' + otherN + ' more fired and ' + (otherN === 1 ? 'is' : 'are')
            + ' listed below with the reason.</span>' : '')
        + '</div>';
    } else {
      h += '<div class="note warn" style="margin-bottom:4px"><b>Nothing here is takeable.</b> '
        + otherN + ' setup' + (otherN === 1 ? '' : 's') + ' fired'
        + (noPay.length ? ' — ' + noPay.length + ' the arithmetic refuses at this venue' : '')
        + (dead.length ? (noPay.length ? ', ' : ' — ') + dead.length + ' that gold has since moved '
            + 'past' : '')
        + '. They are shown so the reason is visible rather than the panel simply looking '
        + 'empty.</div>';
    }

    for (k = 0; k < actable.length; k++){
      var ca = actable[k];
      h += simpleCardHtml(ca.s, ca.r,
        (ca.fresh ? '<span class="stamp pass">FIRED ON THE LAST CLOSED CANDLE</span>'
                  : '<span class="stamp pass">STILL OPEN</span> <span class="note">neither '
                    + 'the stop nor the target was touched in the bars fetched</span>')
        + liveChipHtml(ca.grade, spot) + bookChipHtml(ca.s));
    }
    if (noPay.length){
      h += '<div class="p80-band"><span class="p80-band-k">Cannot pay here</span>'
        + '<span class="p80-band-rule"></span>'
        + '<span class="p80-band-n">' + noPay.length + '</span></div>'
        + '<div class="p80-lead" style="margin-top:0">Price still allows '
        + (noPay.length === 1 ? 'this one' : 'these') + '. The arithmetic does not: at <b>'
        + esc((__p.venue && __p.venue.venue) || 'this venue') + '</b> the round trip takes enough '
        + 'of the target that the trade returns less than nothing even at the '
        + (P80_CLAIMED * 100).toFixed(0) + '% the strategy claims for itself. Shown because a '
        + 'setup that vanishes is one you ask about.'
        + payingRungsHtml(usable) + '</div>';
      for (k = 0; k < noPay.length; k++){
        var cn = noPay[k];
        h += simpleCardHtml(cn.s, cn.r,
          '<span class="stamp veto">CANNOT PAY AT THIS VENUE</span>'
          + liveChipHtml(cn.grade, spot) + bookChipHtml(cn.s));
      }
    }
    if (dead.length){
      h += '<div class="p80-band"><span class="p80-band-k">Price has moved past</span>'
        + '<span class="p80-band-rule"></span>'
        + '<span class="p80-band-n">' + dead.length + '</span></div>';
      for (k = 0; k < dead.length; k++){
        var cd = dead[k];
        h += simpleCardHtml(cd.s, cd.r,
          '<span class="stamp veto">NO LONGER TAKEABLE</span>'
          + liveChipHtml(cd.grade, spot) + bookChipHtml(cd.s));
      }
    }
    return h + '</div>';
  }

  /* nothing to act on. Say that in one sentence, then show the last one that
     DID fire on each rung, clearly marked finished — a card labelled "closed"
     is honest; an empty panel just gets asked about again. */
  var armedNow = hg80Armed(rungs);
  h += '<div class="note warn"><b>Nothing to act on right now.</b> '
    + (armedNow.length ? '<b>' + armedNow.length + ' setup'
        + (armedNow.length === 1 ? ' is' : 's are') + ' armed above — one candle from firing.</b> '
        : '');
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
      var chip = st === 'win' ? '<span class="stamp pass">CLOSED — reached its target</span>'
               : st === 'loss' ? '<span class="stamp veto">CLOSED — hit its stop</span>'
               : '<span class="stamp na">CLOSED — ' + esc(st || 'expired') + '</span>';
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

  var h = '<div class="note warn" style="margin:8px 0;padding:8px 10px;border-left:3px solid var(--veto)">'
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
      + '. Measured across all ' + P80_VARIANTS.length + ' mechanics, so a rung one candle from '
      + 'a looser entry is not reported as two conditions from a '
      + esc(P80_VARIANTS[0].label) + ' one.';
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
  for (var vh = 1; vh < P80_VARIANTS.length; vh++){
    var vv = P80_VARIANTS[vh];
    L.push(vv.label.toLowerCase() + ': same rules, RSI < ' + vv.rsiLong + ' / > ' + vv.rsiShort
      + ' (bars the tighter mechanics turned away; recorded under ' + vv.mech + ')');
  }
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
    L.push(r.def.tf + ' (' + r.def.band + '): ' + hg80CountTxt(c, ' ')
      + ' | ' + c.long + ' long ' + c.short + ' short'
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
  L.push('All ' + P80_VARIANTS.length + ' mechanics are a WATCH: no measured record on this desk yet.');
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
    + 'every mechanic\'s thresholds and the breakeven in the header — so a paste can be read '
    + 'without knowing how this tab was set</span></div>'
    + '<textarea id="p80CopyBox" style="display:none;width:100%;height:160px;font-family:monospace;'
    + 'font-size:11px"></textarea>';

  /* a summary line per rung, because a merged count hides which rung
     produced what — the whole reason for holding two at once */
  for (i = 0; i < ok.length; i++){
    var rr = ok[i], c = hg80CountByVariant(rr);
    h += '<div class="note"><b>' + esc(rr.def.tf) + '</b> (' + esc(rr.def.band) + ') — '
      + esc(hg80CountTxt(c)) + ' · ' + c.long + ' long / ' + c.short + ' short'
      + ' in ' + rr.scanned + ' bars'
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
/* The measurement, in the one table it is worth. */
function coincideHtml(rows){
  var best = null, i;
  for (i = 0; i < rows.length; i++){
    var c = rows[i].census;
    if (!c || !c.coincide) continue;
    var lo = c.coincide.long, sh = c.coincide.short;
    if (!lo || !sh) continue;
    if (!best || c.bars > best.bars) best = { tf: rows[i].def.tf, bars: c.bars, lo: lo, sh: sh };
  }
  if (!best) return '';
  var pc = function(v){ return (100 * v).toFixed(2) + '%'; };
  var h = '<div class="note" style="margin-top:6px;padding:6px 8px;'
    + 'border-left:3px solid var(--veto)">'
    + '<b>WHY THE SPEC IS SILENT</b> — on ' + esc(best.tf) + '\'s ' + best.bars
    + ' evaluable bars. Trend and pullback are not independent; they fight each other, and this '
    + 'is by how much:'
    + '<table class="tbl" style="margin-top:4px"><tr><th>side</th><th>trend</th><th>pullback</th>'
    + '<th>together</th><th>if independent</th><th>rarer by</th></tr>';
  var sides = [['long', best.lo], ['short', best.sh]];
  for (i = 0; i < sides.length; i++){
    var x = sides[i][1];
    h += '<tr><td><b>' + sides[i][0] + '</b></td>'
      + '<td class="hg-num">' + pc(x.trend) + '</td>'
      + '<td class="hg-num">' + pc(x.pullback) + '</td>'
      + '<td class="hg-num">' + pc(x.both) + '</td>'
      + '<td class="hg-num">' + pc(x.ifIndependent) + '</td>'
      + '<td class="hg-num"><b>' + (x.rarerBy === null ? 'never' : x.rarerBy.toFixed(1) + '×')
      + '</b></td></tr>';
  }
  h += '</table>'
    + '<span class="note">A long needs price ABOVE its 50 EMA while RSI(14) says the last '
    + 'fourteen bars were net DOWN. Each holds about half the time; together they are rarer than '
    + 'chance by the factor in the last column. That is the structural reason the supplied spec '
    + 'fires as little as it does — not a bug, not a thin sample, and not something a looser '
    + 'threshold repairs so much as sidesteps.</span></div>';
  return h;
}

function censusHtml(rungs){
  var rows = rungs.filter(function(r){ return r.ok && r.census && r.census.bars; });
  if (!rows.length) return '';
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  var lv = P80_CENSUS_LEVELS;
  var h = '<div class="panel" style="margin-top:10px"><h3>WHY SO FEW '
    + '<span>what the pullback threshold turns away</span></h3>'
    + '<div class="note">On these bars the trend, the candle direction and the session already '
    + 'agreed. RSI alone decided. The first column is the spec.</div>'
    + coincideHtml(rows)
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
  /* WHICH COLUMNS ARE TRADED, read off the variant table rather than counted
     by hand. This paragraph named P80_VARIANTS[1] when there were two of
     them; adding a third silently made it print the wrong mechanic, which
     is the same bug class as the header that hand-counted its mechanics. */
  var wired = [], unwired = [], vk, lk;
  for (lk = 0; lk < lv.length; lk++){
    var hit = null;
    for (vk = 0; vk < P80_VARIANTS.length; vk++){
      if (P80_VARIANTS[vk].rsiLong === lv[lk]) { hit = P80_VARIANTS[vk]; break; }
    }
    if (hit) wired.push(hit.mech + ' at ' + hit.rsiLong + ' / ' + hit.rsiShort);
    else unwired.push(String(lv[lk]));
  }
  h += '<div class="note ok" style="margin-top:4px"><b>' + wired.length + ' of these columns are '
    + 'wired:</b> ' + esc(wired.join(', ')) + '. Each is scanned on every rung and recorded under '
    + 'its own mechanic.'
    + (unwired.length ? ' The ' + esc(unwired.join(', ')) + ' column' + (unwired.length === 1
        ? ' is counted here and not traded.' : 's are counted here and not traded.') : '')
    + '<br>The counts are CUMULATIVE — a looser column includes the tighter firings, because RSI '
    + 'below ' + P80_RSI_LONG + ' is also below ' + P80_RSI_MID_LONG + ' and below '
    + P80_RSI_WIDE_LONG + '. What each mechanic RECORDS is the difference: only the bars the '
    + 'tighter one turned away, so its record answers what its own extra trades are worth rather '
    + 'than being diluted by theirs. Pooling the records gives the loosened strategy as actually '
    + 'traded; nothing can un-pool them once they are pooled, which is why they start apart.</div>';
  h += '<div class="note warn" style="margin-top:4px"><b>Moving the threshold does not change '
    + 'what the trade has to hit.</b> The breakeven is set by ' + P80_SL_ATR.toFixed(2) + ' and '
    + P80_TP_ATR.toFixed(2) + ' and by nothing else, so it stays ' + (gross * 100).toFixed(2)
    + '% gross at every column. A looser pullback buys more trades at the SAME bar, and every '
    + 'extra one is a bar the spec judged not yet a pullback — so their quality is unknown and '
    + 'there is a good reason to think it is worse. That is precisely why it is a separate '
    + 'mechanic with a separate record and not a widened spec: the claim that these trades are '
    + 'worth taking is now a measurable one, and until it is measured all '
    + P80_VARIANTS.length + ' mechanics are a WATCH.</div>';
  return h + '</div>';
}

/* On a WIDE card, the one thing a reader has to know before acting on it:
   this bar is one the supplied spec REJECTED, and loosening the entry bought
   it nothing on the exit — the rate it has to hit did not move. */
function variantNoteHtml(sig){
  if (!sig || !sig.variant || sig.variant === 'spec') return '';
  var v = hg80Variant(sig.variant);
  var gross = P80_SL_ATR / (P80_SL_ATR + P80_TP_ATR);
  return '<div class="note warn" style="margin-top:4px;border-left:3px solid var(--veto)">'
    + '<b>THIS IS THE ' + esc(v.label) + ' MECHANIC, NOT THE SUPPLIED SPEC.</b> The spec wants '
    + 'RSI below ' + P80_RSI_LONG + ' for a long and above ' + P80_RSI_SHORT + ' for a short; '
    + esc(v.label) + ' asks for below ' + v.rsiLong + ' and above ' + v.rsiShort + '. This fired '
    + 'at ' + num(sig.rsi, 1) + ', which the spec turned away. Everything else — trend, candle '
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
  h += '<div class="note warn" style="margin-top:6px;padding:4px 6px;border-left:3px solid var(--veto)">'
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

  /* `rungs` is always the whole ladder. `shown` is what the focus admits —
     everything backward-looking reads the second, the forward-looking panel
     reads the first. */
  var shown = hg80Shown(rungs);
  var usable = shown.filter(function(r){ return r.ok; });
  /* the live price is an INPUT to the render, the same way the venue is —
     read once by the scan, passed down, never reached for out of module
     state by whichever renderer happens to want it */
  var spot = fin(__p.spot), spotRef = fin(__p.spotHint);
  /* the price the cards are GRADED against — feed-native, never spot */
  var gradePx = fin(__p.feedLive);
  var h = viewControlHtml();

  if (__p.view === 'simple'){
    if (!usable.length){
      var b0 = shown.map(function(r){ return r.def.tf + ': ' + ((r.why) || 'no bars'); });
      ui.body.innerHTML = h + livePriceHtml(gradePx, __p.feedLiveTf, spot, spotRef, rungs)
        + armedHtml(rungs, gradePx)
        + '<div class="note warn">No gold bars came back on the focused rungs — '
        + esc(b0.join(' · ')) + '</div>';
      wireViewButtons();
      wireFocusButtons();
      return;
    }
    h += livePriceHtml(gradePx, __p.feedLiveTf, spot, spotRef, rungs);
    h += armedHtml(rungs, gradePx);
    h += simpleSetupsHtml(shown, gradePx);
    h += sessionClockHtml(shown);
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
  h += livePriceHtml(gradePx, __p.feedLiveTf, spot, spotRef, rungs);
  h += armedHtml(rungs, gradePx);
  h += whyNothingHtml(shown);
  h += forwardPanelHtml();
  h += mathPanelHtml(shown, venue, basis);
  /* directly under the geometry it is about: the required rate, then what
     the window says that rate was paid for */
  h += excursionHtml(shown);

  if (!usable.length){
    var bits = shown.map(function(r){ return r.def.tf + ': ' + ((r.why) || 'no bars'); });
    ui.body.innerHTML = h + '<div class="note warn">No rung returned usable bars — '
      + esc(bits.join(' · ')) + '</div>';
    wireViewButtons();
    wireVenueButtons();
    wireFocusButtons();
    wireCopyButton();
    return;
  }

  h += hg80FocusList().length ? focusedFiringsHtml(shown) : latestSetupsHtml(shown);
  h += ladderBoardHtml(shown);

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

  if (!hg80FocusList().length) h += firedHtml(shown);  /* focused table has every row already */
  h += nearMissHtml(shown);
  h += censusHtml(shown);

  var scanned = 0, fired = 0, amb = 0;
  for (i = 0; i < usable.length; i++){
    scanned += usable[i].scanned;
    fired += usable[i].res.signals.length;
    amb += usable[i].tally.ambiguous;
  }
  h += '<div class="note" style="margin-top:8px">Scanned ' + scanned + ' evaluable bars across '
    + usable.length + ' of ' + shown.length + ' shown rungs · ' + fired + ' firing'
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
      /* THE ROWS ON SCREEN, not every rung scanned. __p.last.rungs became the
         whole ladder when focus stopped narrowing the fetch, and copying
         that would hand back rungs the reader never asked to see under a
         heading that names the ones they did. */
      txt = hg80FocusText(hg80Shown((__p.last && __p.last.rungs) || []), __p.venue);
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
  /* the unfinished bar from each rung, kept as the feed's own live price */
  var formingPx = [];
  var chain = Promise.resolve();

  /* THE WHOLE LADDER, ALWAYS. Focus used to narrow the fetch, which made it
     a performance control as well as a view control — and the moment the
     tab grew a forward-looking panel that was a bug: a reader focused on 1d
     could not be shown a 5m rung arming, because the 5m bars were never
     asked for. Arming is the one thing on this page a view filter must not
     be able to hide. Focus now filters what is DISPLAYED and nothing else;
     five sequential fetches is what this tab did before focus existed. */
  P80_LADDER.forEach(function(def){
    chain = chain.then(function(){
      if (ui && ui.stat) ui.stat.textContent = 'fetching ' + def.tf + ' bars…';
      return Promise.resolve().then(function(){ return fetchFn(def.tf, def.bars); })
        .then(function(got){
          var rows = (got && got.rows) ? got.rows : got;
          if (!rows || !rows.length){
            rungs.push({ def: def, ok: false, why: 'no ' + def.tf + ' gold bars came back' });
            return;
          }
          /* CLOSED BARS ONLY, by this rung's own seconds. See
             hg80SplitForming: the feed's table-driven strip has no 5m key,
             so the finest rung was scanning an unfinished candle. */
          var split = hg80SplitForming(rows, def.sec, Math.floor(Date.now() / 1000));
          rows = split.closed;
          if (!rows.length){
            rungs.push({ def: def, ok: false,
                         why: 'every ' + def.tf + ' bar returned was still forming' });
            return;
          }
          /* THE BAR WE JUST DROPPED IS THE FEED'S OWN LIVE PRICE — same
             instrument as the levels, so comparing them carries no basis at
             all. That is the only price this tab can honestly grade a
             0.055%-wide target against. */
          if (split.forming && isFinite(fin(split.forming.c)) && fin(split.forming.c) > 0){
            formingPx.push({ tf: def.tf, sec: def.sec, px: fin(split.forming.c),
                             t: fin(split.forming.t) });
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
    /* LIVE SPOT, ONCE, AFTER THE BARS. The hint is the finest rung's last
       close, which is what hgGoldLiveSpot uses to reject a price more than
       8% from the feed — a sanity bound, not an alignment. Bounded and
       non-fatal: NaN here costs the grades and nothing else. */
    var hint = NaN, hi;
    for (hi = 0; hi < rungs.length; hi++){
      if (rungs[hi].ok && isFinite(fin(rungs[hi].lastPx))){ hint = fin(rungs[hi].lastPx); break; }
    }
    /* THE PRICE THAT CAN ACTUALLY GRADE THESE LEVELS is the feed's own
       unfinished bar — the finest rung that has one, because it is the
       freshest. Spot from gold-api is a DIFFERENT instrument and is kept
       only as a cross-check; see hg80GradePx for why it cannot do this job. */
    formingPx.sort(function(a, b){ return fin(a.sec) - fin(b.sec); });
    var feedLive = formingPx.length ? formingPx[0] : null;
    if (ui && ui.stat) ui.stat.textContent = 'reading live gold…';
    return hg80LiveSpot(hint).then(function(spot){
      return { spot: spot, hint: hint, feedLive: feedLive };
    });
  })
  .then(function(live){
    __p.spot = fin(live.spot);
    __p.spotHint = fin(live.hint);
    __p.feedLive = live.feedLive ? fin(live.feedLive.px) : NaN;
    __p.feedLiveTf = live.feedLive ? live.feedLive.tf : null;

    /* EVERY RUNG THAT FIRED, not every rung on screen. This loop always read
       `rungs`, but `rungs` used to BE the focused subset — so the forward
       log's population silently depended on which rungs the reader happened
       to have selected, and a 5m firing went unrecorded whenever somebody
       was looking at 1d. A record that exists or not according to a view
       setting is not evidence of anything. */
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
        + (hg80FocusList().length
             ? (hg80FocusList().join(' + ') + ' shown of ' + rungs.length + ' scanned')
             : (okN + '/' + rungs.length + ' rungs')) + ' · '
        + (isFinite(fin(__p.feedLive))
             ? 'gold ' + num(__p.feedLive) + ' (' + __p.feedLiveTf + ' live) · '
             : 'no feed-native live price · ')
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

/* ---------------------------------------------------------------------
   AUTO-UPDATE, EVERY MINUTE, WHILE THE TAB IS ON SCREEN

   The header's AUTO control re-runs EVERY tab and its fastest cadence is
   two minutes, so it cannot do this. This is the tab's own timer, the same
   shape newgold.js has used since hg-v691, at sixty seconds.

   WHAT ACTUALLY CHANGES IN A MINUTE, since the finest rung is 5m and its
   closed bars do not: the live price does, and with it every card's grade
   — AT ENTRY, MOVED ON, DEAD — which is the one thing on this tab that
   goes stale in seconds rather than minutes. The forming candle the grade
   is read from is re-fetched each tick, the armed rows' countdown to bar
   close moves, and the session clock moves. The closed-bar scan is redone
   too because it is the same fetch; it simply returns the same answer four
   times out of five.

   THE TICK IS NOT UNCONDITIONAL, and this is the part that matters at a
   one-minute cadence: a scan is five bar fetches plus a spot read, so
   ticking while nobody is looking would be 300 requests an hour spent on a
   panel that is not on screen. Every skip reason is named rather than
   silent, because a tab that has quietly stopped updating is worse than
   one that never did.
   --------------------------------------------------------------------- */
var P80_AUTO_MS = 60000;

/* Is this element inside a tab pane that is currently showing? The shell
   marks the visible pane with `on` and hides the rest with display:none.
   Read off className rather than classList so this is a pure string
   decision — offsetParent would be more direct and cannot be exercised
   without a layout engine. No .tabpane ancestor means the tab is not
   inside the shell at all, and nothing has said it is hidden. */
function hg80PaneOn(el){
  var n = el, hops = 0;
  while (n && hops++ < 64){
    var cn = (typeof n.className === 'string') ? n.className : '';
    if (/(^|\s)tabpane(\s|$)/.test(cn)) return /(^|\s)on(\s|$)/.test(cn);
    n = n.parentNode;
  }
  return true;
}

/* WHY a tick would not run, or null to run it. Split out from the timer so
   every branch is testable without a clock. */
function hg80AutoWhy(el, doc, busy){
  if (!el) return 'unmounted';
  try {
    if (doc && doc.body && typeof doc.body.contains === 'function' && !doc.body.contains(el)){
      return 'unmounted';
    }
  } catch (e){}
  if (doc && doc.hidden === true) return 'background';
  if (!hg80PaneOn(el)) return 'other-tab';
  if (busy) return 'busy';
  return null;
}

var P80_AUTO_WHY = {
  'unmounted':  'the tab is no longer on the page',
  'background': 'this browser tab is in the background',
  'other-tab':  'you are looking at another tab',
  'busy':       'the previous scan is still running'
};

/* One line under SCAN saying whether the tab is updating itself, and if
   not, why not. */
function hg80AutoNote(why){
  if (!why){
    return 'auto-updating every ' + Math.round(P80_AUTO_MS / 1000) + 's while this tab is open';
  }
  return 'auto-update paused — ' + (P80_AUTO_WHY[why] || why)
    + (why === 'unmounted' ? '' : '; it resumes on its own');
}

function hg80AutoPaint(why){
  try {
    if (__p.ui && __p.ui.auto) __p.ui.auto.textContent = hg80AutoNote(why);
  } catch (e){}
}

function hg80AutoStop(){
  try { if (__p.autoTimer != null && typeof W.clearInterval === 'function'){ W.clearInterval(__p.autoTimer); } }
  catch (e){}
  __p.autoTimer = null;
}

/* Started by mount, and mount ALWAYS stops the previous one first — a tab
   closed and reopened must not end up with two timers scanning at once. */
function hg80AutoStart(el){
  hg80AutoStop();
  if (typeof W.setInterval !== 'function') return null;
  __p.autoEl = el;
  __p.autoTimer = W.setInterval(function(){
    var why = hg80AutoWhy(__p.autoEl, W.document, __p.busy);
    if (why === 'unmounted'){ hg80AutoStop(); __p.autoEl = null; hg80AutoPaint('unmounted'); return; }
    hg80AutoPaint(why);
    if (why) return;
    try { run(); } catch (e){}
  }, P80_AUTO_MS);
  hg80AutoPaint(null);
  return __p.autoTimer;
}

function mount(el){
  if (!el) return;
  hg80InjectCss();
  var rungTxt = P80_LADDER.map(function(d){ return d.tf; }).join(' · ');
  el.innerHTML = '<div class="panel">'
    + '<h2>80PERCENT <span>High-Momentum Trend Dip-Buyer · XAUUSD · ' + esc(rungTxt) + '</span></h2>'
    + '<div class="note">EMA' + P80_EMA_FAST + '/' + P80_EMA_SLOW + ' trend, RSI('
    + P80_RSI_LEN + ') pullback below ' + P80_RSI_LONG + ' / above ' + P80_RSI_SHORT
    + ', candle-direction trigger, ' + P80_UTC_FROM + ':00-' + P80_UTC_TO + ':00 UTC where a bar '
    + 'can fit inside it. Target ' + P80_TP_ATR + ' × ATR, stop ' + P80_SL_ATR + ' × ATR — '
    + 'implemented exactly as specified, and run unchanged on every rung from scalp to swing so '
    + 'the cost arithmetic can be read where it differs. '
    + P80_VARIANTS.slice(1).map(function(v){
        return '<b>' + esc(v.mech) + '</b> (' + v.rsiLong + ' / ' + v.rsiShort + ')';
      }).join(' and ')
    + ' run the identical rules at a looser pullback on the bars the tighter one turned away, '
    + 'each recorded apart so none lends another its numbers.</div>'
    + '<div class="row" style="margin-top:8px"><button class="btn" id="p80Run">SCAN</button>'
    + '<span class="note" id="p80Stat">auto-runs on open</span></div>'
    + '<div class="note dim" id="p80Auto" style="margin-top:2px"></div>'
    + '<div id="p80Body" style="margin-top:8px"></div></div>';
  __p.ui = { el: el, body: el.querySelector('#p80Body'),
             stat: el.querySelector('#p80Stat'), run: el.querySelector('#p80Run'),
             auto: el.querySelector('#p80Auto') };
  if (__p.ui.run) __p.ui.run.addEventListener('click', function(){ run(); });
  run();
  hg80AutoStart(el);
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
W.hg80SecsToBarClose = hg80SecsToBarClose;
W.hg80Armed          = hg80Armed;
W.hg80Arming         = hg80Arming;
W.hg80CountByVariant = hg80CountByVariant;
W.firedSplitHtml     = firedSplitHtml;
/* exported so the disclosure can be asserted by RENDERING it for every
   mechanic rather than grepping the source for one hard-coded label — a
   regex for 'THIS IS THE WIDE MECHANIC' went on passing while a MID card
   would have said nothing at all */
W.variantNoteHtml    = variantNoteHtml;
W.armedHtml          = armedHtml;
W.costLineHtml       = costLineHtml;
W.hg80Shown          = hg80Shown;
W.hg80CostVerdict    = hg80CostVerdict;
W.hg80Quality        = hg80Quality;
W.hg80LiveSpot       = hg80LiveSpot;
W.hg80LiveGrade      = hg80LiveGrade;
W.hg80LiveActs       = hg80LiveActs;
W.livePriceHtml      = livePriceHtml;
W.hg80TargetSharePct = hg80TargetSharePct;
W.hg80SplitForming   = hg80SplitForming;
W.hg80FwdRead        = hg80FwdRead;
W.coincideHtml       = coincideHtml;
W.hg80FwdMinRr       = hg80FwdMinRr;
W.forwardPanelHtml   = forwardPanelHtml;
W.watchLineHtml      = watchLineHtml;
W.HG_P80_CSS         = P80_CSS;
W.hg80InjectCss      = hg80InjectCss;
W.armedLiveHtml      = armedLiveHtml;
W.liveChipHtml       = liveChipHtml;
W.simpleSetupsHtml   = simpleSetupsHtml;
W.HG_P80_LIVE_STATE  = P80_LIVE_STATE;
W.HG_P80_SPOT_DRIFT_PCT = P80_SPOT_DRIFT_PCT;
W.HG_P80_COST_HEAVY  = P80_COST_HEAVY;
W.HG_P80_STOP_FLOOR  = P80_STOP_FLOOR;
W.hg80PayingRungs    = hg80PayingRungs;
W.hg80Excursions     = hg80Excursions;
W.hg80MarkBook       = hg80MarkBook;
W.hg80FwdBar         = hg80FwdBar;
W.hg80PaneOn         = hg80PaneOn;
W.hg80AutoWhy        = hg80AutoWhy;
W.hg80AutoNote       = hg80AutoNote;
W.hg80AutoStart      = hg80AutoStart;
W.hg80AutoStop       = hg80AutoStop;
W.HG_P80_AUTO_MS     = P80_AUTO_MS;
W.familyBarHtml      = familyBarHtml;
W.hg80MechanicCeiling = hg80MechanicCeiling;
W.hg80FwdRead        = hg80FwdRead;
W.bookChipHtml       = bookChipHtml;
W.excursionHtml      = excursionHtml;
W.hg80Median         = hg80Median;
W.HG_P80_EXC_MIN_N   = P80_EXC_MIN_N;
W.payingRungsHtml    = payingRungsHtml;
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
W.HG_P80_CENSUS_LEVELS = P80_CENSUS_LEVELS;
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
