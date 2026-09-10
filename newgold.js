/* =========================================================================
HARDGATE — newgold.js (v690)
NEW GOLD tab: XAUUSD triple-confirmation setups from the user-supplied Pine
script "Triple Confirmation: SMC + ML + Momentum".

The Pine script combines:
  1. SMC: Fair Value Gap (FVG) mitigation zones
  2. ML proxy: VWMA-50 baseline as bullish/bearish regime
  3. Momentum: RSI(14) crossing its own SMA(9) as trigger

Long fires when: price is inside a bull FVG AND VWMA-50 baseline is above
price ceiling AND RSI crosses ABOVE its 9-SMA. Short: mirror.

Scan surface: XAUUSD 1H + XAUUSD 4H (user asked for both). Entry MARKET at
close, stop at FVG opposite edge, T1 = 1.5R, T2 = 2.5R (user picked the
tighter TP ladder).

Every card flows through hgPlanFromRisk (v681 ATR floor), gets graded via
hgSolidityGrade with tab='NEWGOLD:1H'|'NEWGOLD:4H' and kind='TRIPLE-CONF',
records to the forward log so v685 veto / v687 PRIME / v689 kill-list all
apply automatically.

Registers window.HG_tabs so the shell can render it.

Feature-checked throughout: missing getXAUCandles, missing plans helpers,
missing solidity — all degrade gracefully rather than crashing the tab.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* --- constants (mirror the Pine script) ------------------------------- */
var ML_LOOKBACK = 50;      /* VWMA-50 baseline */
var RSI_LEN     = 14;      /* RSI(14) momentum */
var RSI_SMA_LEN = 9;       /* SMA(9) of RSI */
var FVG_MAX_AGE = 30;      /* Bars to keep an unfilled FVG alive; older FVGs
                               are considered stale and no longer valid
                               mitigation targets. Pine keeps them until
                               overwritten; we cap to avoid ancient gaps. */
var KL_LIMIT    = 300;     /* Enough for ML_LOOKBACK (50) + FVG history */
var MIN_RR      = 1.5;     /* T1 floor (user chose 1.5R / 2.5R ladder) */
var T1_R        = 1.5;
var T2_R        = 2.5;

var HORIZONS = [
  { tf: '1h', label: '1H' },
  { tf: '4h', label: '4H' }
];

/* v691: auto-refresh cadence. RSI cross detection lives entirely on
   closed-bar semantics but intra-bar price motion still moves through
   FVG zones and updates the ML baseline, so a 5-minute re-scan keeps
   the trigger window responsive without waiting for a full 1H/4H bar
   close. Pattern mirrors omnigold's __og.__uniTimer (mount-time only,
   never module load) so Node test processes never hang on a stray
   interval. */
var NG_AUTO_REFRESH_MS = 5 * 60 * 1000;

/* --- state ------------------------------------------------------------ */
var __ng = { busy: false, snap: null, at: 0, __timer: null, __mountEl: null };

/* --- helpers ---------------------------------------------------------- */
/* Absent values must render as absent: +null coerces to 0, which printed
   "0.00" for missing measurements (test-null-formatting). Guard the empty
   shapes before coercion, matching the goldswing.js fmtF contract. */
function fmtF(n, d){ if (n === null || n === undefined || n === '') return '\u2014'; n = +n; if (!isFinite(n)) return '\u2014'; return n.toFixed(d != null ? d : 2); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function last(arr){ return (arr && arr.length) ? arr[arr.length - 1] : undefined; }

/* --- indicators ------------------------------------------------------- */

/* VWMA over `p` bars. Pine's ta.vwma weighs each close by its volume.
   Gold feeds often lack volume, so degrade to plain SMA when volume is
   absent or zero across the window. That is exactly what ta.vwma reduces
   to when all volumes are equal; it preserves the Pine semantics on
   volume-less feeds instead of returning NaN and killing the signal. */
function vwmaSeries(rows, p){
  if (!Array.isArray(rows) || rows.length < p) return [];
  var out = [];
  for (var i = 0; i < rows.length; i++){
    if (i < p - 1){ out.push(NaN); continue; }
    var sumPV = 0, sumV = 0, sawVol = false, sumC = 0;
    for (var j = i - p + 1; j <= i; j++){
      var c = +rows[j].c;
      var v = +rows[j].v;
      if (isFinite(v) && v > 0){ sumPV += c * v; sumV += v; sawVol = true; }
      sumC += c;
    }
    out.push(sawVol && sumV > 0 ? (sumPV / sumV) : (sumC / p));
  }
  return out;
}

/* RSI(p). Uses the shared W.rsi() when available (indicators.js), else
   Wilder-style computed inline. */
function rsiSeries(rows, p){
  var c = rows.map(function(r){ return +r.c; });
  if (typeof W.rsi === 'function'){
    try { return W.rsi(c, p) || []; } catch(e){}
  }
  /* Fallback inline. */
  if (c.length < p + 1) return c.map(function(){ return NaN; });
  var gains = 0, losses = 0, i, out = [];
  for (i = 1; i <= p; i++){
    var d = c[i] - c[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  var avgGain = gains / p, avgLoss = losses / p;
  for (i = 0; i < p; i++) out.push(NaN);
  out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (i = p + 1; i < c.length; i++){
    var d2 = c[i] - c[i - 1];
    var g = d2 > 0 ? d2 : 0;
    var l = d2 < 0 ? -d2 : 0;
    avgGain = (avgGain * (p - 1) + g) / p;
    avgLoss = (avgLoss * (p - 1) + l) / p;
    out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return out;
}

function smaSeries(vals, p){
  var out = [], i, j, sum;
  for (i = 0; i < vals.length; i++){
    if (i < p - 1){ out.push(NaN); continue; }
    sum = 0;
    for (j = i - p + 1; j <= i; j++){
      if (!isFinite(vals[j])){ sum = NaN; break; }
      sum += vals[j];
    }
    out.push(isFinite(sum) ? sum / p : NaN);
  }
  return out;
}

/* --- FVG detection ---------------------------------------------------- */

/* Bullish FVG (Pine): low[0] > high[2] AND close[1] > open[1].
   The gap is [high[2], low[0]] and is a valid buy zone until mitigated.

   Bearish FVG (Pine): high[0] < low[2] AND close[1] < open[1].
   The gap is [high[0], low[2]] and is a valid sell zone until mitigated.

   MITIGATION IS NOW ACTUALLY TESTED (hg-v700). Until this fix every card
   printed "unmitigated" while no code anywhere tested mitigation — the v536
   label class: a claim the data was never asked. The real check, from this
   module's own gap geometry above: a bull gap [gapLo=high[i-2], gapHi=low[i]]
   is MITIGATED once any LATER closed bar's low <= gapLo (price traded down
   through the whole gap); mirrored, a bear gap [gapLo=high[i], gapHi=low[i-2]]
   is mitigated once any later closed bar's high >= gapHi. A partial dip into
   the gap is not mitigation — the zone survives until fully covered. A
   mitigated FVG stops counting as the structure leg entirely (fail closed):
   it is skipped here, and an older unmitigated gap may take its place.

   Returns { bullTop, bullBot, bearTop, bearBot, bullAge, bearAge } as of
   the LAST bar — every gap returned has passed the mitigation check. Ages
   are bars-since-formation; FVGs older than FVG_MAX_AGE bars are dropped
   as stale. */
function detectLastFvgs(rows){
  var out = { bullTop: NaN, bullBot: NaN, bearTop: NaN, bearBot: NaN,
              bullAge: NaN, bearAge: NaN };
  if (!Array.isArray(rows) || rows.length < 3) return out;
  var lastIdx = rows.length - 1;
  /* Running extremes of every bar AFTER bar i (maintained as the scan walks
     newest -> oldest), so the mitigation check is O(1) per candidate gap. */
  var minLowAfter = Infinity, maxHighAfter = -Infinity;
  /* Scan from newest to oldest so we keep the freshest unmitigated FVG. */
  for (var i = lastIdx; i >= 2; i--){
    if (i < lastIdx){
      var rA = rows[i + 1];
      if (rA){
        var la = +rA.l, ha = +rA.h;
        if (isFinite(la) && la < minLowAfter) minLowAfter = la;
        if (isFinite(ha) && ha > maxHighAfter) maxHighAfter = ha;
      }
    }
    var r0 = rows[i], r1 = rows[i - 1], r2 = rows[i - 2];
    if (!r0 || !r1 || !r2) continue;
    var age = lastIdx - i;
    if (age > FVG_MAX_AGE) break;
    /* Bull FVG at bar i: low[i] > high[i-2] AND close[i-1] > open[i-1],
       and no later closed bar traded down through the gap (hg-v700). */
    if (!isFinite(out.bullTop)
        && r0.l > r2.h && r1.c > r1.o
        && !(minLowAfter <= r2.h)){
      out.bullTop = r0.l;
      out.bullBot = r2.h;
      out.bullAge = age;
    }
    /* Bear FVG at bar i: high[i] < low[i-2] AND close[i-1] < open[i-1],
       and no later closed bar traded up through the gap (hg-v700). */
    if (!isFinite(out.bearTop)
        && r0.h < r2.l && r1.c < r1.o
        && !(maxHighAfter >= r2.l)){
      out.bearTop = r2.l;
      out.bearBot = r0.h;
      out.bearAge = age;
    }
    if (isFinite(out.bullTop) && isFinite(out.bearTop)) break;
  }
  return out;
}

/* --- venue stop-floor leg (hg-v700) ------------------------------------ */

/* The venue round-trip stop-floor DISTANCE for this entry, derived the SAME
   way hgOgFormation rejects a stop (omnigold.js hgOgFormation/hgOgCostDrag):
   costR = rtCostPct / stopPct must stay <= HG_OG_FORM_COST_R_MAX (0.125),
   i.e. stop distance >= entry x rtCostPct% / HG_OG_FORM_COST_R_MAX = 8x the
   venue round trip. Both constants are READ from omnigold at call time
   (hgOgVenueCost / HG_OG_FORM_COST_R_MAX) and never restated here, so a
   venue or threshold change there moves this floor too. -> NaN when the
   cost machinery is not loaded: no floor is invented, and hgGoldFormation
   still fail-closes on the missing cost model. */
function ngVenueFloorDist(entry){
  try{
    entry = +entry;
    if (!isFinite(entry) || !(entry > 0)) return NaN;
    if (typeof W.hgOgVenueCost !== 'function') return NaN;
    var maxR = +W.HG_OG_FORM_COST_R_MAX;
    if (!isFinite(maxR) || !(maxR > 0)) return NaN;
    var vc = W.hgOgVenueCost();
    var rt = vc ? +vc.rtCostPct : NaN;
    if (!isFinite(rt) || !(rt > 0)) return NaN;
    /* 1e-6 relative headroom: the floor exists to MEET hgOgCostDrag's
       recomputed stopPct bar, not to round a hair under it in fp. */
    return entry * (rt / 100) / maxR * (1 + 1e-6);
  }catch(e){ return NaN; }
}

/* --- signal assessment ----------------------------------------------- */

/* Given closed rows for a horizon, return a setup object when the triple
   confirmation fires; otherwise null. */
function ngAssess(rows){
  if (!Array.isArray(rows) || rows.length < ML_LOOKBACK + 5) return null;
  var n = rows.length;
  var closes = rows.map(function(r){ return +r.c; });
  var lastClose = closes[n - 1];
  if (!isFinite(lastClose)) return null;

  /* 1. ML baseline regime */
  var ml = vwmaSeries(rows, ML_LOOKBACK);
  var mlLast = ml[n - 1];
  if (!isFinite(mlLast)) return null;
  var isMlBull = lastClose > mlLast;
  var isMlBear = lastClose < mlLast;

  /* 2. FVG zone check */
  var fvgs = detectLastFvgs(rows);
  var inBull = isFinite(fvgs.bullTop) && lastClose <= fvgs.bullTop && lastClose >= fvgs.bullBot;
  var inBear = isFinite(fvgs.bearTop) && lastClose <= fvgs.bearTop && lastClose >= fvgs.bearBot;

  /* 3. RSI momentum crossover */
  var rsi = rsiSeries(rows, RSI_LEN);
  var rsiSma = smaSeries(rsi, RSI_SMA_LEN);
  var rNow = rsi[n - 1], rPrev = rsi[n - 2];
  var sNow = rsiSma[n - 1], sPrev = rsiSma[n - 2];
  var bullCross = isFinite(rNow) && isFinite(rPrev) && isFinite(sNow) && isFinite(sPrev)
    && rPrev <= sPrev && rNow > sNow;
  var bearCross = isFinite(rNow) && isFinite(rPrev) && isFinite(sNow) && isFinite(sPrev)
    && rPrev >= sPrev && rNow < sNow;

  /* Triple-confirmation fire */
  var dir = null, stop = NaN, fvgHi = NaN, fvgLo = NaN, fvgAge = NaN;
  if (isMlBull && inBull && bullCross){
    dir = 'long';
    stop = fvgs.bullBot;
    fvgHi = fvgs.bullTop; fvgLo = fvgs.bullBot; fvgAge = fvgs.bullAge;
  } else if (isMlBear && inBear && bearCross){
    dir = 'short';
    stop = fvgs.bearTop;
    fvgHi = fvgs.bearTop; fvgLo = fvgs.bearBot; fvgAge = fvgs.bearAge;
  }
  if (!dir) return null;
  if (!isFinite(stop)) return null;

  var entry = lastClose;
  /* Pine's stop is the FVG opposite edge exactly. That can be very tight
     if the FVG is narrow. hgPlanFromRisk (v681) will widen to 0.5*ATR
     floor if needed; the flag flows through so the SOLIDITY G5 gate
     sees it. */
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;

  /* -- ONE composed stop floor, BEFORE the plan is built (hg-v700) --------
     Replay: 16 of 28 1H fires stood aside at the venue stop floor
     (scripts/backtest-newgold-results.json counters.horizons.1H
     stoodAsideStopFloor=16), 14 of them AFTER hgPlanFromRisk had already
     widened the stop (fireLog stopWidened:true + stopFloorCostR > 0.125):
     the plans-layer 0.5xATR floor and hgOgFormation's 8x-round-trip venue
     floor never compared notes, so the desk widened a stop and then stood
     aside from its own widening. The composed floor is
       max(v681 0.5xATR leg, venue 8x-round-trip leg)
     applied as: the venue leg is anchored HERE (ngVenueFloorDist \u2014 derived
     from omnigold's own constants, never restated) and hgPlanFromRisk's
     ATR leg applies on top in the SAME call below. Both legs only ever
     WIDEN a valid-side stop \u2014 risk > 0 is already proven above and the
     signal's own construction puts the stop on the correct side (the
     v681/v698 lesson: a floor never repairs sides) \u2014 so the sequential
     application equals the max. Venue unreadable (omnigold not loaded)
     -> NaN -> no leg is invented and hgGoldFormation still fail-closes on
     the missing cost model. Cohort note, informational only (n=6/5): the
     stop-widened cohort measured +0.573R net at XM vs natural -0.081R
     (backtest-newgold-results.json aggregates.byStopWidened). */
  var venueFloorD = ngVenueFloorDist(entry);
  var venueFloored = false;
  if (isFinite(venueFloorD) && venueFloorD > 0 && risk < venueFloorD){
    stop = (dir === 'long') ? entry - venueFloorD : entry + venueFloorD;
    risk = Math.abs(entry - stop);
    venueFloored = true;
  }

  var t1 = dir === 'long' ? entry + T1_R * risk : entry - T1_R * risk;
  var t2 = dir === 'long' ? entry + T2_R * risk : entry - T2_R * risk;

  /* Build a plan through the shared plans layer so it inherits the v681
     ATR-floor stop widening. */
  var plan = null;
  if (typeof W.hgPlanFromRisk === 'function'){
    try {
      plan = W.hgPlanFromRisk(dir, entry, stop, {
        t1R: T1_R, t2R: T2_R, minRr: MIN_RR,
        targetPolicy: 'R-multiples (1.5R/2.5R) \u00b7 FVG stop',
        rows: rows
      });
    } catch(ePl){ plan = null; }
  }
  if (plan){
    entry = plan.entry; stop = plan.stop; t1 = plan.t1; t2 = plan.t2;
  }

  /* -- every ratio prints against the FINAL geometry (hg-v700) ------------
     Until this fix rr1/rr2 divided by the pre-widening FVG risk while
     entry/stop/t1/t2 were reassigned from the hgPlanFromRisk result: every
     stop-widened settled trade printed rr1 > 1.5 against a T1 that pays
     exactly 1.5R of the FINAL stop (scripts/backtest-newgold-results.json
     trades[] rr1 = 3.96 / 36.55 / 6.39 / 2.90 / 2.43 / 1.92, all with
     stopWidened:true; all 5 natural trades printed 1.50). Downstream,
     solidity G4 (rr >= minRr + 0.25 headroom, hg-solidity.js hgSolGateRr)
     passed ONLY on those inflated cards \u2014 an honest 1.5R-ladder card can
     never print 1.75 \u2014 so the headroom gate rewarded exactly the cards
     whose geometry the detector got wrong. Derive from the levels the card
     actually carries; never inherit (the plans.js hgSyncPlanRatios rule). */
  risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  var rr1Final = Math.abs(t1 - entry) / risk;
  var rr2Final = Math.abs(t2 - entry) / risk;

  /* Fail closed (hg-v700): the composed floor must never ship a card whose
     FINAL T1 pays under the module's MIN_RR. The R-multiple ladder re-prices
     T1 from the final risk so this cannot trip today; if a future target
     hint or ladder change makes it possible, the fire is DROPPED with the
     reason stashed below \u2014 never widened into a ticket. hgGoldFormation
     already rejects this geometry class; the goal of the composed floor is
     ONE coherent floor, not more trades. */
  if (!(isFinite(rr1Final) && rr1Final >= MIN_RR - 1e-9)){
    try {
      W.__ngLastDrop = { at: Date.now(),
        reason: 'composed stop floor leaves T1 at '
          + (isFinite(rr1Final) ? rr1Final.toFixed(2) : '\u2014') + 'R < ' + MIN_RR
          + 'R minimum \u2014 fire dropped, not widened into a ticket (hg-v700 fail closed)' };
    } catch(eDrop){}
    return null;
  }

  return {
    dir: dir,
    entry: entry, stop: stop, t1: t1, t2: t2,
    rr1: rr1Final,
    rr2: rr2Final,
    risk: risk, riskPct: risk / entry * 100,
    stopWidened: (plan && plan.stopWidened === true) || venueFloored,
    /* hg-v700: the card names the leg that actually set the final stop
       (v536 \u2014 print only what happened). plans' ATR leg runs AFTER the
       venue leg and only ever widens further, so plan.stopWidened=true
       means the 0.5xATR leg bound; otherwise the venue leg did. */
    stopWidenedTo: (plan && plan.stopWidened === true) ? '0.5\u00d7ATR floor'
      : (venueFloored ? 'venue floor (8\u00d7 round trip)' : ''),
    /* mitigationChecked: detectLastFvgs (hg-v700) verified no later closed
       bar traded through this gap \u2014 the "unmitigated" label downstream
       prints ONLY when this flag is true (ngConfirmations). */
    fvg: { top: fvgHi, bot: fvgLo, ageBars: fvgAge, mitigationChecked: true },
    ml: { baseline: mlLast, regime: isMlBull ? 'bullish' : 'bearish' },
    rsi: { now: rNow, sma: sNow },
    kind: 'TRIPLE-CONF',
    /* hg-v700 (was: hard-coded 3). The v698 note here already conceded the
       three reads span only TWO independent classes — structure (FVG) and
       momentum (VWMA regime + RSI cross) — so 3 was a read count wearing a
       class-count name. The fallback is that honest 2; ngRunScan overwrites
       it with the MEASURED distinct-class count from the shared formation
       verdict on BOTH lanes (the OMNI lane has stamped it since v698). The
       tradable bar itself is still decided by gold-formation.js from
       ngConfirmations(). */
    confluenceCount: 2 /* structure + momentum — the classes the signal's own reads span */
  };
}

/* --- REAL higher-timeframe tape (hg-v698) -----------------------------

   Until this repair NEW GOLD passed `tape: setup.dir` into hgSolidityGrade
   (v690 lines 367 and 463): the card's own direction, handed to the gate that
   is supposed to check the card against the higher timeframe. G3 could not
   fail. That is a card confirming itself, and it is the only fabricated
   number the recon found on any gold desk.

   It is replaced with two REAL reads, both already available at scan time:

     1H horizon  the 4H VWMA-50 regime — the SAME indicator this desk already
                 trusts as its ML baseline, read one timeframe up. Genuinely
                 higher-timeframe and genuinely independent of the 1H close.
     4H horizon  OMNIGOLD's desk tape (hgOgUniformDebug().tape.stored.desk),
                 which is gold's own 1h + 4h EMA21/EMA50 stacks and only
                 speaks when both horizons agree (omnigold.js hgOgDeskTape).
                 A different indicator family from VWMA, so it is evidence and
                 not an echo.

   Neither is invented: when the read is unavailable the tape is '' and the
   solidity gate sees 'unknown' — which hgSolGateTape treats as no signal,
   not as agreement. Fail closed by returning nothing rather than a guess. */
function ngHtfVwmaRegime(rows){
  try{
    if (!Array.isArray(rows) || rows.length < ML_LOOKBACK + 1) return '';
    var ml = vwmaSeries(rows, ML_LOOKBACK);
    var n = rows.length;
    var base = ml[n - 1], px = +rows[n - 1].c;
    if (!isFinite(base) || !isFinite(px)) return '';
    if (px > base) return 'long';
    if (px < base) return 'short';
    return '';
  }catch(e){ return ''; }
}

function ngOmnigoldDeskTape(){
  try{
    if (typeof W.hgOgUniformDebug !== 'function') return '';
    var dbg = W.hgOgUniformDebug();
    var t = dbg && dbg.tape && dbg.tape.stored;
    var d = t && t.desk;
    return (d === 'long' || d === 'short') ? d : '';
  }catch(e){ return ''; }
}

/* -> { dir, src } for the horizon, or { dir: '', src: '' } when unread. */
function ngHtfTape(horizonLabel, rows4h){
  var lab = String(horizonLabel || '').toUpperCase();
  if (lab === '1H' || lab === 'OMNI-15M'){
    var d = ngHtfVwmaRegime(rows4h);
    if (d) return { dir: d, src: '4H VWMA-50 regime' };
  }
  var od = ngOmnigoldDeskTape();
  if (od) return { dir: od, src: 'OMNIGOLD desk tape (gold 1h+4h EMA21/50 stacks, both horizons agreeing)' };
  return { dir: '', src: '' };
}

/* --- confirmations for the shared >= 3-distinct-class contract ---------

   gold-formation.js decides FORMED vs WATCH; this only names what NEW GOLD
   can actually see on the closed bar, honestly, one entry per read:

     structure       price inside a fresh, unmitigated FVG (the SMC leg)
     momentum        RSI(14) crossing its own 9-SMA + the VWMA-50 regime
                     (one class, however many reads inside it agree)
     participation   NOTHING. This feed carries no order flow, no positioning
                     and no COT, and the trigger-bar volume read is NOT
                     substituted for one: OMNIGOLD measured that gate pointing
                     the wrong way on gold (SCALP passed 27.7% n=2,856 vs
                     vetoed 35.2% n=1,737, z=-5.38; omnigold.js hgOgGates
                     'participation'), so counting volume as a confirmation
                     here would import a rule its own evidence rejects. The
                     class is reported as unconfirmed, with that reason, so
                     the reader sees the hole rather than a fabricated fill.
     session-htf     the measured UTC session cohort AND/OR the real HTF tape
                     above. Either satisfies the class.

   SESSION RULE (recon 3.3, 7,270 settled): the clock confirms only where
   measured gross is >= 0 — ASIA 00-06 (+0.097R, n=2,082) and NY-PM 17-20
   (+0.053R, n=994). LONDON 07-11 (-0.080R, n=1,305), NY-OVERLAP 12-16
   (-0.061R, n=2,247) and OFF 21-23 (-0.011R, n=642) do not. */
function ngConfirmations(setup, opts){
  opts = opts || {};
  var out = [];
  try{
    if (!setup) return out;
    var dir = setup.dir;

    /* structure — the FVG mitigation zone the entry sits inside.

       INHERENT (hg-v698 audit closeout): a NEW GOLD card only exists because
       price is inside a fresh FVG — this read is the signal's own definition
       and is therefore true on ANY fire. It still counts toward the class bar
       (the read is real) but it is declared `inherent: true` so the shared
       renderer reports it apart from the revocable session-htf leg instead of
       dressing a tautology up as independent confirmation. Same for the two
       momentum reads below. The OMNI-lane structural read stays REVOCABLE:
       OMNIGOLD agreeing is external evidence, not the card's own premise. */
    var fvg = setup.fvg || {};
    out.push({ cls: 'structure', name: 'FVG mitigation zone', inherent: true,
      detail: (isFinite(fvg.bot) ? fvg.bot.toFixed(2) : '?') + '–'
            + (isFinite(fvg.top) ? fvg.top.toFixed(2) : '?')
            + (isFinite(fvg.ageBars)
                ? (' · ' + fvg.ageBars + ' bars old'
                   /* hg-v700: "unmitigated" prints ONLY when the module
                      actually ran the check (detectLastFvgs skips any gap
                      a later closed bar traded through, and ngAssess
                      stamps mitigationChecked). Until this fix the word
                      printed unconditionally while mitigation was never
                      tested anywhere — the v536 label class: labels print
                      what was checked, never an untested claim. */
                   + (fvg.mitigationChecked === true
                       ? ', unmitigated (no later closed bar traded through the gap)'
                       : ''))
                : ''),
      ok: isFinite(fvg.top) && isFinite(fvg.bot) });

    /* structure — OMNI lane only: OMNIGOLD's own mechanic agrees. Deliberately
       the SAME class as the FVG so a hybrid card gets no free class for what
       is another structural read. */
    if (setup.omni && setup.omni.kind){
      out.push({ cls: 'structure', name: 'OMNIGOLD ' + String(setup.omni.kind),
        detail: 'OMNIGOLD scored this mechanic ' + String(setup.omni.dir || '').toUpperCase()
              + ' on the same bars', ok: String(setup.omni.dir || '') === dir });
    }

    /* momentum — the RSI cross and the VWMA-50 regime; one class. Both
       INHERENT: they are the other two thirds of the triple-confirmation, so
       a fired card carries them by construction. Declared, not hidden. */
    var rsiOk = !!(setup.rsi && isFinite(setup.rsi.now) && isFinite(setup.rsi.sma)
      && ((dir === 'long' && setup.rsi.now > setup.rsi.sma) || (dir === 'short' && setup.rsi.now < setup.rsi.sma)));
    out.push({ cls: 'momentum', name: 'RSI(14) crossed its 9-SMA', inherent: true,
      detail: 'RSI ' + (setup.rsi && isFinite(setup.rsi.now) ? setup.rsi.now.toFixed(1) : '?')
            + ' vs SMA9 ' + (setup.rsi && isFinite(setup.rsi.sma) ? setup.rsi.sma.toFixed(1) : '?'),
      ok: rsiOk });
    var mlOk = !!(setup.ml && ((dir === 'long' && setup.ml.regime === 'bullish')
      || (dir === 'short' && setup.ml.regime === 'bearish')));
    out.push({ cls: 'momentum', name: 'VWMA-50 regime', inherent: true,
      detail: 'baseline ' + (setup.ml && isFinite(setup.ml.baseline) ? setup.ml.baseline.toFixed(2) : '?')
            + ' · ' + ((setup.ml && setup.ml.regime) || 'unknown'),
      ok: mlOk });

    /* participation — named absent, never fabricated. See the block comment. */
    out.push({ cls: 'participation', name: 'order flow / positioning',
      detail: 'this XAUUSD feed carries no taker delta, no OI and no COT; '
            + 'trigger-bar volume is NOT substituted — OMNIGOLD measured that read '
            + 'pointing the wrong way on gold (passed 27.7% n=2856 vs vetoed 35.2% n=1737)',
      ok: false });

    /* session-htf — the measured cohort, then the real HTF tape.

       THE COHORT IS READ ON THE CLOSED SIGNAL BAR, not on Date.now(). This
       used to fall back to the wall clock, and ngRunScan never passed an
       instant, so the wall clock is what every production card actually
       used. That is the one revocable class NEW GOLD has, and the tab
       re-scans every 5 minutes (NG_AUTO_REFRESH_MS): the same closed bar
       therefore printed FORMED on one refresh and WATCH on another with no
       new data. The measured cohorts are keyed on the signal bar's own
       timestamp (backtest-omnigold-results.json trades[].tISO), so the bar
       is also the only instant the evidence licenses. Unreadable bars ->
       fail closed, through the SAME shared helper the other two desks use. */
    var whenMs = (typeof W.hgGoldSignalBarMs === 'function') ? W.hgGoldSignalBarMs(opts.rows) : NaN;
    if (!isFinite(whenMs) && isFinite(+opts.nowMs)) whenMs = +opts.nowMs;
    var sedge = (typeof W.hgGoldSessionEdge === 'function' && isFinite(whenMs))
      ? W.hgGoldSessionEdge(whenMs) : null;
    out.push({ cls: 'session-htf', name: 'session window',
      detail: sedge ? sedge.why
        : 'session cohort unreadable on the closed signal bar — the clock cannot confirm (fail closed)',
      ok: !!(sedge && sedge.confirms === true) });
    var kz = null;
    try { kz = (typeof W.hgGoldKillzoneRead === 'function' && isFinite(whenMs))
      ? W.hgGoldKillzoneRead(new Date(whenMs)) : null; }
    catch(eKz){ kz = null; }
    if (kz && kz.label){
      /* killzone is CONTEXT, printed on the confirmation it belongs to and
         never a class of its own — it is the same clock read twice. Read on
         the same closed-bar instant as the cohort above, so the two cannot
         describe different moments. */
      out[out.length - 1].detail += ' · ' + String(kz.label);
    }
    var tape = opts.tape || { dir: '', src: '' };
    out.push({ cls: 'session-htf', name: 'higher-timeframe tape',
      detail: tape.dir ? (tape.src + ' reads ' + String(tape.dir).toUpperCase())
                       : 'no higher-timeframe read available on this scan',
      ok: !!tape.dir && tape.dir === dir });
  }catch(e){}
  return out;
}

/* --- fetch ------------------------------------------------------------ */

function fetchXau(tf, n){
  /* Prefer omnigold's shared fetcher when present, else the raw
     getXAUCandles global. */
  if (typeof W.hgOgFetchRows === 'function'){
    try {
      return W.hgOgFetchRows(tf, n).then(function(pack){
        return { rows: (pack && pack.rows) || [], source: (pack && pack.source) || 'unknown' };
      });
    } catch(e){ /* fall through */ }
  }
  if (typeof W.getXAUCandles === 'function'){
    try {
      return Promise.resolve(W.getXAUCandles(tf, n))
        .then(function(rows){ return { rows: rows || [], source: 'getXAUCandles' }; })
        .catch(function(){ return { rows: [], source: 'error' }; });
    } catch(e){}
  }
  return Promise.resolve({ rows: [], source: 'no-fetcher' });
}

/* --- scan runner ------------------------------------------------------ */

/* v695 (v696 fix): pull OMNIGOLD's already-scored gold candidates.

   OMNIGOLD is an IIFE and its per-scan rows live on the local __og
   binding, NOT on window. Only the ranked candidates are exposed via
   window.hgOgUniformDebug(). v695 assumed window.__og was accessible;
   in production it was not, so every OMNI lane had rowsLen=0 and every
   hybrid card was silently dropped by the ML_LOOKBACK+5 guard in
   ngRunScan.

   v696 fix: return ROWLESS metadata for each candidate. The caller
   (ngRunScan) fetches 4h + 15m rows ONCE via fetchXau (the same
   cascade OMNIGOLD used) and passes them into the OMNI-lane loop.
   Zero duplicate fetches vs. the primary horizons — fetchXau caches
   through the app-level candle cache OMNIGOLD populated.

   Returns [{ horizonLabel, tf, ogKind, ogDir, ogPlan }, ...] or [] when
   OMNIGOLD is not loaded / has no candidates yet. */
function ngPullOmniLanes(){
  var out = [];
  try {
    var dbg = (typeof W.hgOgUniformDebug === 'function') ? W.hgOgUniformDebug() : null;
    if (!dbg) return out;
    var lanes = [
      { tag: 'SWING', tf: '4h', label: 'OMNI-4H' },
      { tag: 'SCALP', tf: '15m', label: 'OMNI-15m' }
    ];
    for (var li = 0; li < lanes.length; li++){
      var lane = lanes[li];
      var cands = (lane.tag === 'SWING') ? dbg.swing : dbg.scalp;
      if (!Array.isArray(cands) || !cands.length) continue;
      for (var ci = 0; ci < cands.length; ci++){
        var c = cands[ci];
        if (!c || !c.dir) continue;
        out.push({
          horizonLabel: lane.label,
          tf: lane.tf,
          ogKind: c.kind || c.strategy || 'OMNI',
          ogDir: String(c.dir).toLowerCase(),
          ogPlan: c.plan || null
        });
      }
    }
  } catch(eOmni){}
  return out;
}

async function ngRunScan(){
  if (__ng.busy) return 'busy';
  __ng.busy = true;
  var results = [];
  var errors = [];
  try {
    /* v698: fetch BOTH horizons before assessing either, so the 1H card can
       read a REAL 4H tape instead of the fabricated `tape: setup.dir` that
       stood here until now. Same two fetches as before \u2014 only the order
       changed, and both still flow through the app-level candle cache. */
    var packsByTf = {}, hi, h, pack;
    for (hi = 0; hi < HORIZONS.length; hi++){
      h = HORIZONS[hi];
      try { pack = await fetchXau(h.tf, KL_LIMIT); }
      catch(eF){ pack = { rows: [], source: 'fetch-error' }; errors.push(h.label + ': fetch failed'); }
      packsByTf[h.tf] = pack || { rows: [], source: 'unknown' };
    }
    var rows4hForTape = (packsByTf['4h'] && packsByTf['4h'].rows) ? packsByTf['4h'].rows : [];

    for (hi = 0; hi < HORIZONS.length; hi++){
      h = HORIZONS[hi];
      pack = packsByTf[h.tf] || { rows: [], source: 'unknown' };
      var rows = pack && pack.rows ? pack.rows : [];
      if (!rows.length){ errors.push(h.label + ': no bars (source=' + (pack && pack.source) + ')'); continue; }
      var setup = ngAssess(rows);
      var tape = ngHtfTape(h.label, rows4hForTape);
      var record = {
        horizon: h.label,
        tf: h.tf,
        source: pack.source,
        setup: setup,
        tape: tape,
        rows: rows
      };
      /* SHARED GOLD FORMATION (hg-v698). NEW GOLD had no venue cost model at
         all, so a stop tighter than the round trip formed as a tradable
         ticket. It now runs the SAME hgOgFormation machinery OMNIGOLD does
         (8x the venue round trip, measured kind demotion, gold-setup-edge,
         catalog) plus the v689 KILL-LIST, the v685 measured-edge veto and the
         >= 3-distinct-class confluence bar \u2014 all through gold-formation.js.
         Fail closed: no verdict -> not tradable, reason named on the card. */
      if (setup){
        /* rows = the CLOSED bars this card fired on. The session leg is
           read on the signal bar, never on Date.now(). */
        record.confirmations = ngConfirmations(setup, { tape: tape, rows: rows });
        record.formation = (typeof W.hgGoldFormation === 'function')
          ? W.hgGoldFormation(
              /* rows deliberately NOT passed — see omnigold1.js og1Formation:
                 all three desks make the IDENTICAL rows-less hgOgFormation
                 call, so none of them gets a catalog verdict the others do not. */
              { kind: setup.kind, horizon: h.label, dir: setup.dir,
                plan: { entry: setup.entry, stop: setup.stop, t1: setup.t1, rr1: setup.rr1 },
                entry: setup.entry, stop: setup.stop, t1: setup.t1 },
              { tab: 'NEWGOLD:' + h.label, mechanic: setup.kind || 'TRIPLE-CONF',
                confirmations: record.confirmations,
                /* v698 audit closeout: structure + momentum are INHERENT here
                   (the triple-confirmation confirming itself), so session-htf
                   is this desk's only revocable class. FORMED must REQUIRE it
                   explicitly — with participation dark it already decided
                   every verdict in practice, and making it a named floor
                   means a future always-true read cannot silently weaken
                   the bar back to tautologies. */
                requireClasses: ['session-htf'] })
          : { formed: false, tradable: false, state: 'STOOD-ASIDE', confluence: null,
              reasons: ['shared gold formation unavailable \u2014 gold-formation.js is not loaded; fail closed'] };
        /* hg-v700: the primary lane never corrected ngAssess's minted
           confluenceCount while the OMNI lane has stamped the measured
           count since v698 \u2014 stamp the DISTINCT confirmation-class count
           the shared formation verdict actually measured (the ngAssess
           fallback of 2 stands only when the verdict carries none). */
        if (record.formation && record.formation.confluence
            && isFinite(+record.formation.confluence.classCount)){
          setup.confluenceCount = record.formation.confluence.classCount;
        }
      }
      /* Compute solidity via the shared helper so the same veto/promotion/
         kill pipeline applies. Kind is fixed at TRIPLE-CONF; the tab key
         is per-horizon (NEWGOLD:1H, NEWGOLD:4H) so measured evidence is
         separated by timeframe. */
      if (setup && typeof W.hgSolidityGrade === 'function'){
        try {
          var planForSol = {
            dir: setup.dir,
            entry: setup.entry, stop: setup.stop, t1: setup.t1, t2: setup.t2,
            rr1: setup.rr1, minRr: MIN_RR,
            /* v698: the REAL higher-timeframe read, or '' so hgSolGateTape
               reports 'unknown' \u2014 never the card's own direction. */
            tape: tape.dir || '',
            stopWidened: setup.stopWidened,
            /* v698: confluence is the count of DISTINCT confirmation classes
               the shared contract actually confirmed, not a hard-coded 3. */
            consensus: { nAgree: (record.formation && record.formation.confluence)
                                   ? record.formation.confluence.classCount : 0 },
            liveGrade: 'fresh' /* market fill = fresh by definition */
          };
          record.solidity = W.hgSolidityGrade(planForSol, {
            minRr: MIN_RR,
            tab: 'NEWGOLD:' + h.label,
            kind: 'TRIPLE-CONF'
          });
        } catch(eSol){}
      }
      results.push(record);
    }

    /* v695 (v696 fix): OMNIGOLD lane. Pull OMNIGOLD's already-scored
       candidates and re-gate each through the Pine triple-confirmation.
       A candidate survives only when BOTH agree: OMNIGOLD flagged this
       direction as a setup, AND ngAssess (FVG + VWMA-50 + RSI cross)
       fires the SAME direction on the same-tf rows.

       v696 fetches the tf rows itself instead of relying on the
       IIFE-scoped __og.lastRows that never reached window. Reuses rows
       already fetched for the primary 1H/4H horizons above when the tf
       matches, so 4h needs no extra fetch (results[1].rows) and only
       15m makes a new network call.

       The mechanic key is TRIPLE-CONF+OMNI:<ogKind> so the forward log
       tracks each hybrid separately from plain TRIPLE-CONF. */
    try {
      var omniLanes = ngPullOmniLanes();
      if (omniLanes.length){
        /* Cache tf->rows to avoid double-fetching. Seed from the primary
           horizons above (1H/4H). */
        var tfRows = {};
        var tfSource = {};
        for (var pi = 0; pi < results.length; pi++){
          var pr = results[pi];
          if (pr && pr.rows && pr.rows.length){
            tfRows[pr.tf] = pr.rows;
            tfSource[pr.tf] = pr.source;
          }
        }
        /* Fetch any missing tf rows the OMNI lanes need. 4h is almost
           always already in tfRows from the primary loop above; 15m is
           new territory. */
        var neededTfs = {};
        for (var oi0 = 0; oi0 < omniLanes.length; oi0++){
          if (!tfRows[omniLanes[oi0].tf]) neededTfs[omniLanes[oi0].tf] = true;
        }
        var missingList = Object.keys(neededTfs);
        for (var mi = 0; mi < missingList.length; mi++){
          var mtf = missingList[mi];
          try {
            var mpack = await fetchXau(mtf, KL_LIMIT);
            if (mpack && mpack.rows && mpack.rows.length){
              tfRows[mtf] = mpack.rows;
              tfSource[mtf] = mpack.source;
            }
          } catch(eFm){}
        }
        /* Deduplicate on (horizonLabel + ogKind + ogDir) so multiple
           OMNIGOLD ranked entries for the same mechanic in the same
           direction do not produce duplicate cards. */
        var seenOmni = {};
        for (var oi = 0; oi < omniLanes.length; oi++){
          var lane = omniLanes[oi];
          var laneRows = tfRows[lane.tf] || [];
          if (laneRows.length < ML_LOOKBACK + 5) continue;
          var dedupKey = lane.horizonLabel + '|' + lane.ogKind + '|' + lane.ogDir;
          if (seenOmni[dedupKey]) continue;
          seenOmni[dedupKey] = true;
          var ogSetup = null;
          try { ogSetup = ngAssess(laneRows); } catch(eA){ ogSetup = null; }
          if (!ogSetup) continue;
          /* Intersection guard: NEW GOLD triple-conf must match OMNIGOLD's
             own direction. If they disagree we drop the fire. */
          if (ogSetup.dir !== lane.ogDir) continue;
          var hybridKind = 'TRIPLE-CONF+OMNI:' + lane.ogKind;
          ogSetup.kind = hybridKind;
          ogSetup.omni = { kind: lane.ogKind, dir: lane.ogDir, ogPlan: lane.ogPlan };
          /* v698: confluenceCount is no longer forced to 4. OMNIGOLD agreeing
             is another STRUCTURAL read, not a fourth class — the shared
             contract counts distinct classes and a hybrid earns none for free.
             The real class count is stamped from the formation verdict below. */
          var laneTape = ngHtfTape(lane.horizonLabel, rows4hForTape);
          var omniRecord = {
            horizon: lane.horizonLabel,
            tf: lane.tf,
            source: tfSource[lane.tf] || 'omnigold',
            setup: ogSetup,
            tape: laneTape,
            rows: laneRows
          };
          omniRecord.confirmations = ngConfirmations(ogSetup, { tape: laneTape, rows: laneRows });
          /* Shared formation. alsoKinds carries the UNDERLYING OMNIGOLD
             mechanic so the measured kind-demotion table (which is keyed by
             OMNIGOLD kind, not by the hybrid label) is actually consulted —
             a hybrid built on a measured-negative kind stands aside for the
             same reason the OMNIGOLD card would. */
          omniRecord.formation = (typeof W.hgGoldFormation === 'function')
            ? W.hgGoldFormation(
                { kind: hybridKind, horizon: lane.horizonLabel, dir: ogSetup.dir,
                  plan: { entry: ogSetup.entry, stop: ogSetup.stop, t1: ogSetup.t1, rr1: ogSetup.rr1 },
                  entry: ogSetup.entry, stop: ogSetup.stop, t1: ogSetup.t1 },
                { tab: 'NEWGOLD:' + lane.horizonLabel, mechanic: hybridKind,
                  alsoKinds: [lane.ogKind], confirmations: omniRecord.confirmations,
                  /* same explicit floor as the primary lane: the revocable
                     session-htf leg must pass for FORMED (v698 closeout) */
                  requireClasses: ['session-htf'] })
            : { formed: false, tradable: false, state: 'STOOD-ASIDE', confluence: null,
                reasons: ['shared gold formation unavailable — gold-formation.js is not loaded; fail closed'] };
          ogSetup.confluenceCount = (omniRecord.formation && omniRecord.formation.confluence)
            ? omniRecord.formation.confluence.classCount : 0;
          if (typeof W.hgSolidityGrade === 'function'){
            try {
              var planForSol2 = {
                dir: ogSetup.dir,
                entry: ogSetup.entry, stop: ogSetup.stop,
                t1: ogSetup.t1, t2: ogSetup.t2,
                rr1: ogSetup.rr1, minRr: MIN_RR,
                /* v698: real HTF read, never the card's own direction */
                tape: laneTape.dir || '',
                stopWidened: ogSetup.stopWidened,
                consensus: { nAgree: ogSetup.confluenceCount },
                liveGrade: 'fresh'
              };
              omniRecord.solidity = W.hgSolidityGrade(planForSol2, {
                minRr: MIN_RR,
                tab: 'NEWGOLD:' + lane.horizonLabel,
                kind: hybridKind
              });
            } catch(eSol2){}
          }
          results.push(omniRecord);
        }
      }
    } catch(eOmniLane){}

    /* Forward log every firing so the accumulated evidence grows. */
    try {
      if (typeof W.hgFwdRecordScan === 'function'){
        for (var ri = 0; ri < results.length; ri++){
          var r = results[ri];
          if (!r.setup) continue;
          /* v695: mechanic is now r.setup.kind (TRIPLE-CONF for the
             primary horizons, TRIPLE-CONF+OMNI:<ogKind> for the
             OMNIGOLD lane) so the forward log measures each edge
             separately. */
          W.hgFwdRecordScan('NEWGOLD:' + r.horizon, r.tf, [{
            sym: 'XAUUSD', dir: r.setup.dir,
            entry: r.setup.entry, stop: r.setup.stop, t1: r.setup.t1,
            mechanic: r.setup.kind || 'TRIPLE-CONF',
            /* v698: a fire is a TICKET only when it FORMED — cleared the
               venue stop floor, the measured-evidence checks and the
               >= 3-distinct-class confluence bar — and still clears the
               shared solidity lead bar. Every fire is still RECORDED; the
               flag only says which ones the desk called tradable. */
            ticket: !!(r.formation && r.formation.tradable === true
                       && r.solidity && r.solidity.leadEligible)
          }], { horizonBars: 30 });
        }
        /* Also settle any prior open records for this scan's rows. */
        if (typeof W.hgFwdResolve === 'function'){
          for (var rj = 0; rj < results.length; rj++){
            var rr = results[rj];
            if (!rr.rows || !rr.rows.length) continue;
            try { W.hgFwdResolve('XAUUSD', rr.tf, rr.rows); } catch(eR){}
          }
        }
      }
    } catch(eFwd){ /* silent */ }

    /* Kill-list filter (v689): drop any record whose solidity says killed.
       v695: killedKinds tracks the actual setup.kind so the killed-note
       shows whether TRIPLE-CONF or TRIPLE-CONF+OMNI:<kind> got hidden. */
    var kept = [];
    var killedCount = 0;
    var killedKinds = {};
    for (var kli = 0; kli < results.length; kli++){
      var kr = results[kli];
      /* v698: the shared formation reads the SAME hgSolidityIsKilled the
         solidity grade does, so both stamps agree; honouring either keeps
         the filter correct when one of the two graders is unavailable. */
      if ((kr.solidity && kr.solidity.killed === true)
          || (kr.formation && kr.formation.state === 'KILLED')){
        killedCount++;
        var kk = (kr.setup && kr.setup.kind) || 'TRIPLE-CONF';
        killedKinds[kk] = (killedKinds[kk] || 0) + 1;
        continue;
      }
      kept.push(kr);
    }
    try {
      W.__hgSolKillLast = W.__hgSolKillLast || {};
      W.__hgSolKillLast['NEWGOLD'] = {
        killedCount: killedCount,
        killedKinds: killedKinds,
        at: Date.now()
      };
    } catch(eStash){}
    results = kept;

    __ng.snap = { at: Date.now(), results: results, errors: errors };
    return { status: results.length ? 'refreshed' : 'empty', results: results, errors: errors };
  } catch(e){
    return { status: 'error', results: [], errors: [String(e && e.message || e)] };
  } finally {
    __ng.busy = false;
  }
}

/* --- render ----------------------------------------------------------- */

function cardHtml(r){
  if (!r) return '';
  if (!r.setup){
    return '<div class="card" style="opacity:0.65">'
      + '<div class="chead"><span class="sym">XAUUSD</span>'
      + '<span class="dir">' + esc(r.horizon) + ' \u00b7 no triple-confirmation fire</span></div>'
      + '<div class="mini">'
      + '<span class="k">source</span><span>' + esc(r.source || '\u2014') + '</span>'
      + '<span class="k">wait for</span><span>price inside FVG, RSI cross, ML baseline confirmation</span>'
      + '</div>'
      + '</div>';
  }
  var s = r.setup;
  var solChip = '';
  try {
    if (r.solidity && typeof W.hgSolidityChipHtml === 'function'){
      solChip = W.hgSolidityChipHtml(r.solidity);
    }
  } catch(eSc){}

  var dirLabel = s.dir === 'long' ? 'LONG' : 'SHORT';
  var fm = r.formation || null;
  /* v698: only a FORMED card is a ticket. A card short of the shared
     confluence bar, or one the venue stop floor / measured evidence stood
     aside, keeps its evidence on screen and loses the tradable styling and
     its levels \u2014 a level on a card the desk declined to call tradable is an
     invitation. Nothing is hidden: the reason is printed underneath. */
  var tradable = !!(fm && fm.tradable === true);
  var isBest = tradable && r.solidity && r.solidity.leadEligible;
  var formChip = '';
  try {
    if (fm && typeof W.hgGoldFormationChipHtml === 'function') formChip = W.hgGoldFormationChipHtml(fm);
  } catch(eFc){}
  var confBlock = '';
  try {
    if (fm && fm.confluence && typeof W.hgGoldConfluenceHtml === 'function'){
      confBlock = W.hgGoldConfluenceHtml(fm.confluence);
    }
  } catch(eCb){}
  var tapeTxt = (r.tape && r.tape.dir)
    ? (String(r.tape.dir).toUpperCase() + ' \u00b7 ' + r.tape.src)
    : 'no higher-timeframe read this scan';

  var levels = tradable
    ? ('<div class="hg-mp-grid">'
      + '<div><i>ENTRY</i><b>' + fmtF(s.entry, 2) + '</b><u>' + (s.dir === 'long' ? 'MARKET BUY' : 'MARKET SELL') + '</u></div>'
      /* hg-v700: the widened note names the leg that actually set the stop
         (setup.stopWidenedTo) \u2014 until now it always said "0.5\u00d7ATR" even
         when the venue 8\u00d7-round-trip leg is what bound (v536: labels print
         what happened). */
      + '<div><i>STOP</i><b>' + fmtF(s.stop, 2) + '</b><u>FVG ' + (s.dir === 'long' ? 'bottom' : 'top') + (s.stopWidened ? ' \u00b7 widened to ' + esc(s.stopWidenedTo || 'floor') : '') + '</u></div>'
      + '<div><i>T1 (1.5R)</i><b>' + fmtF(s.t1, 2) + '</b><u>rr ' + fmtF(s.rr1, 2) + '</u></div>'
      + '<div><i>T2 (2.5R)</i><b>' + fmtF(s.t2, 2) + '</b><u>rr ' + fmtF(s.rr2, 2) + '</u></div>'
      + '</div>'
      + '<div class="note" style="margin-top:6px;font-size:11px;opacity:0.7">Risk ' + fmtF(s.riskPct, 2) + '% \u00b7 not a win probability</div>')
    : ('<div class="note warn" style="margin-top:6px;font-size:11px">NOT A TICKET \u2014 no levels printed. '
      + esc(((fm && fm.reasons) || ['formation verdict unavailable']).join(' \u00b7 ')) + '</div>');

  return '<div class="card ' + (s.dir === 'long' ? 'long' : 'short') + (isBest ? ' best' : '')
    + '" data-ng-form="' + esc((fm && fm.state) || 'UNKNOWN') + '">'
    + '<div class="chead"><span class="sym">XAUUSD</span>'
    + '<span class="dir">' + dirLabel + ' \u00b7 TRIPLE CONF \u00b7 ' + esc(r.horizon) + ' \u00b7 ' + esc(r.source || '') + '</span>'
    + (formChip ? ' ' + formChip : '')
    + (solChip ? ' ' + solChip : '')
    + '</div>'
    + '<div class="mini">'
    + '<span class="k">ml baseline</span><span>' + fmtF(s.ml.baseline, 2) + ' \u00b7 ' + esc(s.ml.regime) + '</span>'
    + '<span class="k">fvg zone</span><span>' + fmtF(s.fvg.bot, 2) + ' \u2192 ' + fmtF(s.fvg.top, 2) + ' \u00b7 ' + (isFinite(s.fvg.ageBars) ? s.fvg.ageBars + 'b old' : '?') + '</span>'
    + '<span class="k">rsi \u00b7 sma9</span><span>' + fmtF(s.rsi.now, 1) + ' \u00b7 ' + fmtF(s.rsi.sma, 1) + '</span>'
    + '<span class="k">htf tape</span><span>' + esc(tapeTxt) + '</span>'
    + '</div>'
    + confBlock
    + levels
    + '</div>';
}

function refreshKilledNote(el){
  try {
    var noteEl = el.querySelector('#ngKilledNote');
    if (!noteEl) return;
    if (typeof W.hgSolidityLastKilled !== 'function' || typeof W.hgSolidityKilledNoteHtml !== 'function') return;
    noteEl.innerHTML = W.hgSolidityKilledNoteHtml(W.hgSolidityLastKilled('NEWGOLD'));
  } catch(e){}
}

function refreshPerfPanels(el){
  try {
    var panelEl = el.querySelector('#ngPerf');
    if (!panelEl) return;
    if (typeof W.hgPerfPanelHtml !== 'function'){ panelEl.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < HORIZONS.length; i++){
      html += W.hgPerfPanelHtml('NEWGOLD:' + HORIZONS[i].label,
        { title: 'KIND PERFORMANCE \u00b7 NEW GOLD ' + HORIZONS[i].label });
    }
    panelEl.innerHTML = html;
  } catch(e){}
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<div class="panel">'
    + '<h2>New Gold <span>XAUUSD triple confirmation \u00b7 SMC (FVG) + ML (VWMA-50) + Momentum (RSI cross) \u00b7 1H + 4H + OMNIGOLD</span></h2>'
    + '<div class="note" style="margin-bottom:8px">Fires only when all three modules agree: '
    + 'price is inside a fresh FVG mitigation zone, VWMA-50 regime matches direction, and RSI(14) '
    + 'crosses its own 9-SMA in the trade direction. Entry MARKET at close; stop at FVG opposite '
    + 'edge (v681 ATR floor may widen tight stops); T1 = 1.5R, T2 = 2.5R. '
    + '<b>v695 OMNIGOLD lane</b>: reuses OMNIGOLD\'s already-scored 4h + 15m candidates and re-gates each through triple-confirmation. '
    + 'A hybrid card fires only when NEW GOLD and OMNIGOLD agree on direction; tracked as <code>TRIPLE-CONF+OMNI:&lt;kind&gt;</code> in the forward log. '
    + 'Cards graded through the shared 7-gate SOLIDITY pipeline; kinds with 30+ samples and expR &lt; -0.5R are auto-killed.</div>'
    + '<div class="row"><button class="btn" id="ngRun">SCAN NEW GOLD</button>'
    + '<span class="note" id="ngStat">idle \u00b7 XAUUSD 1H + 4H</span></div>'
    + '<div class="prog" id="ngProg"><i></i></div>'
    + '<div id="ngKilledNote"></div>'
    + '<div class="cards" id="ngCards"></div>'
    + '<div id="ngPerf"></div>'
    + '<div class="empty" id="ngEmpty" style="display:none">No triple-confirmation fires right now \u2014 wait for price to enter an FVG with ML baseline and RSI cross both aligned.</div>'
    + '</div>';

  var btn = el.querySelector('#ngRun');
  var statEl = el.querySelector('#ngStat');
  var progEl = el.querySelector('#ngProg');
  var cardsEl = el.querySelector('#ngCards');
  var emptyEl = el.querySelector('#ngEmpty');

  function setStat(t, warn){ if (statEl){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; } }
  function setProg(f){
    if (!progEl) return;
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  async function runScan(){
    setStat('scanning XAUUSD 1H + 4H \u2026');
    setProg(0.2);
    if (btn) btn.disabled = true;
    cardsEl.innerHTML = '';
    emptyEl.style.display = 'none';
    var pack = await ngRunScan();
    setProg(1.0);
    setTimeout(function(){ setProg(null); }, 300);
    if (btn) btn.disabled = false;

    var results = pack.results || [];
    var fires = results.filter(function(r){ return r.setup; });
    if (fires.length){
      cardsEl.innerHTML = fires.map(cardHtml).join('');
      /* v698: a fire is not a ticket. Every fire still renders; the tally
         says how many of them FORMED and how many are WATCH, so the reader
         can never mistake the one count for the other. */
      var nTicket = fires.filter(function(r){ return r.formation && r.formation.tradable === true; }).length;
      var nWatch = fires.length - nTicket;
      setStat(fires.length + ' fire' + (fires.length === 1 ? '' : 's')
        + ' \u00b7 ' + nTicket + ' formed'
        + (nWatch ? (' \u00b7 ' + nWatch + ' WATCH (short of 3 confirmation classes or stood aside)') : '')
        + ' \u00b7 ' + results.length + ' horizon' + (results.length === 1 ? '' : 's') + ' scanned'
        + ' \u00b7 ' + new Date().toISOString().slice(11, 19) + ' UTC');
    } else {
      /* Show the no-fire rows anyway so the user sees which horizons were scanned and why they didn't fire. */
      cardsEl.innerHTML = results.map(cardHtml).join('');
      emptyEl.style.display = results.length ? 'none' : 'block';
      setStat(results.length
        ? (results.length + ' horizon' + (results.length === 1 ? '' : 's') + ' scanned \u00b7 no triple-confirmation fires \u00b7 '
           + new Date().toISOString().slice(11, 19) + ' UTC')
        : 'scan failed \u00b7 ' + (pack.errors || []).join(' \u00b7 '), !results.length);
    }
    if (pack.errors && pack.errors.length){
      var current = statEl ? statEl.textContent : '';
      setStat(current + ' \u00b7 ' + pack.errors.length + ' warning' + (pack.errors.length === 1 ? '' : 's'), pack.errors.length > 0);
    }
    refreshKilledNote(el);
    refreshPerfPanels(el);
  }

  if (btn) btn.addEventListener('click', runScan);
  /* Auto-scan on mount. */
  refreshKilledNote(el);
  refreshPerfPanels(el);
  runScan();

  /* v691: auto-refresh every 5 minutes while the tab is mounted.
     Timer is stored on module state so a subsequent mount (tab close +
     reopen, hot reload) clears the prior timer instead of stacking.
     The interval calls the exact same runScan the button uses, so a
     manual click and an auto-tick are indistinguishable except for
     origin. Also self-heals: if runScan is busy (a slow fetch is in
     flight), the tick becomes a no-op via the __ng.busy guard inside
     ngRunScan; the next tick tries again 5 minutes later. */
  try {
    if (__ng.__timer){
      clearInterval(__ng.__timer);
      __ng.__timer = null;
    }
    __ng.__mountEl = el;
    if (typeof setInterval === 'function'){
      __ng.__timer = setInterval(function(){
        /* If the mount element has been removed from the document
           (user navigated away entirely, tab unmounted), stop ticking
           and clear the timer. Prevents scans on a dead tab. */
        try {
          if (__ng.__mountEl && !document.body.contains(__ng.__mountEl)){
            clearInterval(__ng.__timer);
            __ng.__timer = null;
            __ng.__mountEl = null;
            return;
          }
        } catch(eDoc){}
        try { runScan(); } catch(eTick){}
      }, NG_AUTO_REFRESH_MS);
    }
  } catch(eTimer){}
}

function ngRefresh(){
  var el = document.querySelector('[data-hg-tab="newgold"]');
  if (el) return null;
  /* Refresh path if the tab is already mounted \u2014 delegated to runScan
     via the button click. Callers can trigger via W.ngRunScan directly. */
  return null;
}

/* --- exports ---------------------------------------------------------- */
W.ngAssess = ngAssess;
W.ngRunScan = ngRunScan;
W.ngPullOmniLanes = ngPullOmniLanes; /* v695: exposed for test + inspection */
/* v698: the real HTF tape read and the confirmation builder, exported so the
   removal of the fabricated `tape: setup.dir` and the >= 3-class contract are
   testable without a mount. */
W.ngHtfTape = ngHtfTape;
W.ngHtfVwmaRegime = ngHtfVwmaRegime;
W.ngConfirmations = ngConfirmations;
/* hg-v700: the mitigation-checked FVG scan and the venue leg of the composed
   stop floor, exported so both honesty fixes are testable without a mount
   (tests/test-newgold-honesty.mjs). */
W.ngDetectLastFvgs = detectLastFvgs;
W.ngVenueFloorDist = ngVenueFloorDist;
W.newGoldScan = function(){ return __ng.snap; };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'newgold', label: 'NEW GOLD', mount: mount, refresh: ngRefresh });

})();
