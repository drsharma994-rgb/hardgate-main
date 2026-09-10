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
/* hg-v702 LOOSENED FIRE WINDOWS (user-directed; evidence-bounded). The
   original Pine fire demanded all three legs on ONE closed bar — the RSI
   cross is a one-bar event, so the triple coincidence fired ~9 times in
   5.5 months (scripts/backtest-newgold-results.json counters.fires=9).
   Two knobs, both named, both printed on any fire that used them:
     NG_RSI_CROSS_BARS  a cross within the last N closed bars still
                        triggers, provided RSI HOLDS the crossed side now;
                        a more recent opposite cross kills the window.
     NG_FVG_EDGE_ATR    a close within this many ATR(14) of the zone's NEAR
                        edge counts as tagging the zone (inside still
                        counts; the far side never does — that is the stop
                        side). ATR unreadable -> tolerance 0: fail closed
                        to the strict inside-only read.
   NOT loosened: FVG mitigation (a traded-through gap stays dead, hg-v700),
   the VWMA-50 side, the session-htf formation class, the composed stop
   floor, MIN_RR. The loosened config's replay ships with the change. */
var NG_RSI_CROSS_BARS = 3;
/* hg-v702 dial, measured before ship (scripts/backtest-newgold-results.json
   at the 0.25 trial): the RSI-window-only cohort (cross 1-2 bars ago, close
   INSIDE the zone) measured n=9 67% WR +0.58R net at XM — the best cohort
   this desk has produced — while every edge-tag cohort (price never closed
   inside the zone) measured negative (edge-only n=17 −0.29, window+edge
   n=41 −0.24). The knob and its machinery stay (tests pin the math), the
   DIAL is 0: a fire still requires a close inside the gap. Small-n honesty:
   the +0.58 is promising, not proven — the forward ledger decides from here. */
var NG_FVG_EDGE_ATR   = 0;
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
/* hg-v701: house feature-check — a shared helper is used only when it is
   actually a function; anything else reads as absent, never as a stub. */
function gfn(name){ try { return (W && typeof W[name] === 'function') ? W[name] : null; } catch(e){ return null; } }
/* hg-v701: deep-freeze for the ADDITIVE snapshot keys only (checklist /
   watch / hybridLaneStatus / sessionEdge / history are built fresh each
   scan from plain scalars+strings, so freezing them shares nothing with
   the mutable results[] the existing consumers already hold). */
function ngDeepFreeze(o){
  try{
    if (!o || typeof o !== 'object' || Object.isFrozen(o)) return o;
    Object.freeze(o);
    var ks = Object.keys(o), i;
    for (i = 0; i < ks.length; i++) ngDeepFreeze(o[ks[i]]);
  }catch(e){}
  return o;
}
/* hg-v701: the CLOSED signal bar's instant — the shared helper when loaded
   (gold-formation.js hgGoldSignalBarMs), else the same read done locally
   (last row's own timestamp). NEVER the wall clock: leg states are a
   property of the bar, and a wall-clock read would let the same closed bar
   answer differently on two auto-refresh ticks with no new data. */
function ngBarMs(rows){
  var fn = gfn('hgGoldSignalBarMs');
  if (fn){ try { var m = +fn(rows); if (isFinite(m)) return m; } catch(e){} }
  try{
    if (!rows || !rows.length) return NaN;
    var t = +rows[rows.length - 1].t;
    if (!isFinite(t)) return NaN;
    return (t < 1e12) ? t * 1000 : t;
  }catch(e2){ return NaN; }
}

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

/* --- pure leg reader (hg-v701) ----------------------------------------- */

/* ONE place that reads the three triple-confirmation legs on the LAST
   CLOSED bar. ngAssess decides fires from these exact reads and the
   always-on CONFIRMATION CHECKLIST renders them, so the board and the
   detector can never disagree on a threshold — the population of the tab
   is the detector's own reads, not a re-implementation of them.

   Returns (never throws):
     { ok, why, lastClose, atr,
       ml:  { baseline, side }                        side: 'bull'|'bear'|''
       fvg: { bullTop, bullBot, bullAge, bearTop, bearBot, bearAge,
              inBull, inBear, mitigationChecked }      (detectLastFvgs is
                                                       already hg-v700
                                                       mitigation-checked)
       rsi: { now, prev, sma, smaPrev, bullCross, bearCross, lastCross } }
   lastCross ({dir:'up'|'down', barsAgo}) is checklist CONTEXT only: a cross
   fires a signal only on the bar it happens, and the scan back is capped at
   20 bars so it stays a bounded, honest read. ok:false names the reason and
   nothing else is claimed (atr NaN = 'ATR unreadable', never 0). */
/* hg-v702 pure window rules — extracted so the loosened boundaries are
   directly testable with explicit series (the hgGoldScalpStopFloor test
   pattern). ngLegRead is their ONLY production caller; the detector and the
   checklist inherit them through it. Never throw. */
function ngRsiWindowFromSeries(rsi, sma){
  var out = { now: NaN, prev: NaN, sma: NaN, smaPrev: NaN,
              bullCross: false, bearCross: false, lastCross: null,
              bullCrossWin: false, bearCrossWin: false, bullCrossAge: null, bearCrossAge: null };
  try{
    if (!Array.isArray(rsi) || !Array.isArray(sma)) return out;
    var n = rsi.length;
    if (n < 2 || sma.length !== n) return out;
    out.now = rsi[n - 1]; out.prev = rsi[n - 2];
    out.sma = sma[n - 1]; out.smaPrev = sma[n - 2];
    var fin4 = isFinite(out.now) && isFinite(out.prev) && isFinite(out.sma) && isFinite(out.smaPrev);
    out.bullCross = fin4 && out.prev <= out.smaPrev && out.now > out.sma;
    out.bearCross = fin4 && out.prev >= out.smaPrev && out.now < out.sma;
    var lo = Math.max(RSI_LEN + RSI_SMA_LEN, n - 20);
    for (var i = n - 1; i >= lo; i--){
      var rN = rsi[i], rP = rsi[i - 1], sN = sma[i], sP = sma[i - 1];
      if (!isFinite(rN) || !isFinite(rP) || !isFinite(sN) || !isFinite(sP)) break;
      if (rP <= sP && rN > sN){ out.lastCross = { dir: 'up', barsAgo: n - 1 - i }; break; }
      if (rP >= sP && rN < sN){ out.lastCross = { dir: 'down', barsAgo: n - 1 - i }; break; }
    }
    var lc = out.lastCross;
    out.bullCrossAge = out.bullCross ? 0
      : ((lc && lc.dir === 'up' && lc.barsAgo <= NG_RSI_CROSS_BARS - 1) ? lc.barsAgo : null);
    out.bearCrossAge = out.bearCross ? 0
      : ((lc && lc.dir === 'down' && lc.barsAgo <= NG_RSI_CROSS_BARS - 1) ? lc.barsAgo : null);
    out.bullCrossWin = out.bullCrossAge !== null && fin4 && out.now > out.sma;
    out.bearCrossWin = out.bearCrossAge !== null && fin4 && out.now < out.sma;
    return out;
  }catch(e){ return out; }
}
function ngFvgNearFrom(fvgs, lastClose, atr){
  var out = { inBull: false, inBear: false, nearBull: false, nearBear: false,
              bullEdgeAtr: NaN, bearEdgeAtr: NaN };
  try{
    if (!fvgs || !isFinite(lastClose)) return out;
    out.inBull = isFinite(fvgs.bullTop) && lastClose <= fvgs.bullTop && lastClose >= fvgs.bullBot;
    out.inBear = isFinite(fvgs.bearTop) && lastClose <= fvgs.bearTop && lastClose >= fvgs.bearBot;
    var edgeTol = (isFinite(atr) && atr > 0) ? NG_FVG_EDGE_ATR * atr : 0;
    out.nearBull = out.inBull || (isFinite(fvgs.bullTop) && lastClose > fvgs.bullTop
      && (lastClose - fvgs.bullTop) <= edgeTol);
    out.nearBear = out.inBear || (isFinite(fvgs.bearBot) && lastClose < fvgs.bearBot
      && (fvgs.bearBot - lastClose) <= edgeTol);
    out.bullEdgeAtr = out.inBull ? 0
      : ((out.nearBull && isFinite(atr) && atr > 0) ? (lastClose - fvgs.bullTop) / atr : NaN);
    out.bearEdgeAtr = out.inBear ? 0
      : ((out.nearBear && isFinite(atr) && atr > 0) ? (fvgs.bearBot - lastClose) / atr : NaN);
    return out;
  }catch(e){ return out; }
}

function ngLegRead(rows){
  var out = { ok: false, why: '', lastClose: NaN, atr: NaN,
    ml: { baseline: NaN, side: '' },
    fvg: { bullTop: NaN, bullBot: NaN, bullAge: NaN,
           bearTop: NaN, bearBot: NaN, bearAge: NaN,
           inBull: false, inBear: false, mitigationChecked: false,
           nearBull: false, nearBear: false, bullEdgeAtr: NaN, bearEdgeAtr: NaN },
    rsi: { now: NaN, prev: NaN, sma: NaN, smaPrev: NaN,
           bullCross: false, bearCross: false, lastCross: null,
           bullCrossWin: false, bearCrossWin: false, bullCrossAge: null, bearCrossAge: null } };
  try{
    if (!Array.isArray(rows) || rows.length < ML_LOOKBACK + 5){
      out.why = 'feed too short (' + (Array.isArray(rows) ? rows.length : 0)
        + ' bars < ' + (ML_LOOKBACK + 5) + ' needed) — no leg can be read on a closed bar';
      return out;
    }
    var n = rows.length;
    var lastClose = +rows[n - 1].c;
    if (!isFinite(lastClose)){ out.why = 'last closed bar carries no finite close'; return out; }
    out.lastClose = lastClose;
    /* ATR(14) for DISPLAY distances only (shared indicators.js atr when
       loaded — it returns a PARALLEL SERIES, so read the last value);
       unreadable stays NaN and the renderer says so. */
    var atrFn = gfn('atr');
    if (atrFn){
      try {
        var aOut = atrFn(rows, 14);
        var aVal = Array.isArray(aOut) ? +aOut[aOut.length - 1] : +aOut;
        if (isFinite(aVal) && aVal > 0) out.atr = aVal;
      } catch(eA){}
    }

    /* 1. ML baseline (VWMA-50) — the same series ngAssess fires on */
    var ml = vwmaSeries(rows, ML_LOOKBACK);
    var mlLast = ml[n - 1];
    if (isFinite(mlLast)){
      out.ml.baseline = mlLast;
      out.ml.side = lastClose > mlLast ? 'bull' : (lastClose < mlLast ? 'bear' : '');
    }

    /* 2. STRUCTURE — the hg-v700 mitigation-checked FVG scan, and the SAME
       zone-membership test ngAssess fires on */
    var fvgs = detectLastFvgs(rows);
    out.fvg.bullTop = fvgs.bullTop; out.fvg.bullBot = fvgs.bullBot; out.fvg.bullAge = fvgs.bullAge;
    out.fvg.bearTop = fvgs.bearTop; out.fvg.bearBot = fvgs.bearBot; out.fvg.bearAge = fvgs.bearAge;
    /* hg-v702 loosened zone read via the exported pure rule (inside, OR
       within NG_FVG_EDGE_ATR of the NEAR edge; the far side never counts;
       no readable ATR -> zero tolerance, fail closed to inside-only). */
    var nearRead = ngFvgNearFrom(fvgs, lastClose, out.atr);
    out.fvg.inBull = nearRead.inBull;
    out.fvg.inBear = nearRead.inBear;
    out.fvg.nearBull = nearRead.nearBull;
    out.fvg.nearBear = nearRead.nearBear;
    out.fvg.bullEdgeAtr = nearRead.bullEdgeAtr;
    out.fvg.bearEdgeAtr = nearRead.bearEdgeAtr;
    out.fvg.mitigationChecked = true;

    /* 3. RSI(14) vs its 9-SMA — the hg-v702 windowed trigger via the
       exported pure rule (a cross within NG_RSI_CROSS_BARS closed bars
       still triggers when RSI HOLDS the crossed side now; a more recent
       opposite cross kills the window; age 0 = the original strict read). */
    var rsi = rsiSeries(rows, RSI_LEN);
    var rsiSma = smaSeries(rsi, RSI_SMA_LEN);
    out.rsi = ngRsiWindowFromSeries(rsi, rsiSma);
    out.ok = true;
    return out;
  }catch(e){
    out.ok = false;
    if (!out.why) out.why = 'leg read threw — nothing is claimed: ' + String(e && e.message || e);
    return out;
  }
}

/* --- signal assessment ----------------------------------------------- */

/* Given closed rows for a horizon, return a setup object when the triple
   confirmation fires; otherwise null. */
function ngAssess(rows){
  /* hg-v701: the three legs are read through ngLegRead — the SAME reader
     the always-on checklist renders — so the detector and the board share
     one set of thresholds by construction. Behaviour is unchanged: the
     guards below are the exact pre-v701 expressions, now read from the
     shared leg object. */
  var leg = ngLegRead(rows);
  if (!leg || leg.ok !== true) return null;
  var lastClose = leg.lastClose;

  /* 1. ML baseline regime */
  var mlLast = leg.ml.baseline;
  if (!isFinite(mlLast)) return null;
  var isMlBull = leg.ml.side === 'bull';
  var isMlBear = leg.ml.side === 'bear';

  /* 2. FVG zone check (mitigation-checked hg-v700; hg-v702 loosened edge
     read — inside the gap, or a close within NG_FVG_EDGE_ATR of its near
     edge; the far side never counts) */
  var fvgs = leg.fvg;
  var inBull = leg.fvg.nearBull;
  var inBear = leg.fvg.nearBear;

  /* 3. RSI momentum crossover (hg-v702 loosened window — a cross within
     the last NG_RSI_CROSS_BARS closed bars, still held now) */
  var rNow = leg.rsi.now, sNow = leg.rsi.sma;
  var bullCross = leg.rsi.bullCrossWin;
  var bearCross = leg.rsi.bearCrossWin;

  /* Triple-confirmation fire */
  var dir = null, stop = NaN, fvgHi = NaN, fvgLo = NaN, fvgAge = NaN;
  var rsiCrossAge = null, fvgEdgeAtr = NaN;
  if (isMlBull && inBull && bullCross){
    dir = 'long';
    stop = fvgs.bullBot;
    fvgHi = fvgs.bullTop; fvgLo = fvgs.bullBot; fvgAge = fvgs.bullAge;
    rsiCrossAge = leg.rsi.bullCrossAge; fvgEdgeAtr = leg.fvg.bullEdgeAtr;
  } else if (isMlBear && inBear && bearCross){
    dir = 'short';
    stop = fvgs.bearTop;
    fvgHi = fvgs.bearTop; fvgLo = fvgs.bearBot; fvgAge = fvgs.bearAge;
    rsiCrossAge = leg.rsi.bearCrossAge; fvgEdgeAtr = leg.fvg.bearEdgeAtr;
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
    /* hg-v702: which loosened path (if any) this fire used — printed on the
       card's confirmation details (labels print what happened, v536). Age 0
       and edge 0 mean the original strict same-bar/inside-zone read fired. */
    loosened: { rsiCrossAge: isFinite(rsiCrossAge) ? rsiCrossAge : null,
                fvgEdgeAtr: isFinite(fvgEdgeAtr) ? fvgEdgeAtr : null,
                used: (isFinite(rsiCrossAge) && rsiCrossAge > 0)
                   || (isFinite(fvgEdgeAtr) && fvgEdgeAtr > 0) },
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
                : '')
            /* hg-v702: an edge-tag fire says so — the close tagged the zone
               from outside rather than closing inside it. */
            + ((setup.loosened && isFinite(setup.loosened.fvgEdgeAtr) && setup.loosened.fvgEdgeAtr > 0)
                ? (' · edge tag ' + setup.loosened.fvgEdgeAtr.toFixed(2) + ' ATR outside the zone (loosened window ≤ '
                   + NG_FVG_EDGE_ATR + ' ATR, hg-v702)')
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
            + ' vs SMA9 ' + (setup.rsi && isFinite(setup.rsi.sma) ? setup.rsi.sma.toFixed(1) : '?')
            /* hg-v702: a windowed cross says its age — the trigger was N
               bars ago and RSI still holds the crossed side now. */
            + ((setup.loosened && isFinite(setup.loosened.rsiCrossAge) && setup.loosened.rsiCrossAge > 0)
                ? (' · cross ' + setup.loosened.rsiCrossAge + ' bar'
                   + (setup.loosened.rsiCrossAge === 1 ? '' : 's')
                   + ' ago, still held (loosened window ≤ ' + NG_RSI_CROSS_BARS + ' bars, hg-v702)')
                : ''),
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

/* =========================================================================
   ALWAYS-ON BOARD (hg-v701) — the tab is POPULATED, never invented.

   Before this, the tab rendered one static line unless a triple-confirmation
   fire existed — 9 fires in 5.5 months of replay
   (scripts/backtest-newgold-results.json), so the user opened a blank tab.
   The population is the desk's OWN closed-bar reads, printed honestly:

     1  CONFIRMATION CHECKLIST  per horizon, every leg's state on the last
                                CLOSED bar + what each direction still needs.
                                A missing leg is NAMED; levels are NEVER
                                printed for anything short of FORMED (the
                                gold-formation WATCH philosophy).
     2  WATCH / NEAR-MISS       fires short of the bar, missing class named,
                                no levels; plus any composed-floor drop
                                (W.__ngLastDrop) surfaced instead of stashed.
     3  HYBRID LANE STATUS      why the OMNIGOLD lane produced nothing, with
                                counts — never a silent empty.
     4  SESSION CONTEXT STRIP   measured cohorts + htf tape chips, labeled
                                informational; leg verdicts read the closed
                                bar, never this strip's wall clock.
     5  PAID HISTORY            settled NEWGOLD forward-ledger records,
                                read-only; honest empty state.

   Every builder is pure, feature-checked and fail-soft: a section that
   cannot be read says so and claims nothing. Dark feeds/legs say DARK with
   the reason, never silently omitted, never counted as a pass.
   ========================================================================= */

/* Exact participation truth — one place, used by the checklist whether the
   feed is up or dark. Same substance as ngConfirmations' participation leg. */
function ngPartLeg(){
  return { key: 'participation', label: 'PARTICIPATION', dark: true,
    long: false, short: false,
    text: 'DARK by design — this XAUUSD feed carries no taker delta, no OI and no COT, '
        + 'and trigger-bar volume is NOT substituted: OMNIGOLD measured that read pointing '
        + 'the wrong way on gold (passed 27.7% n=2856 vs vetoed 35.2% n=1737). '
        + 'Reported dark, never counted as a pass.' };
}

/* One side's structure-context sentence. Distances in ATR when ATR is
   readable, absolute dollars (named as such) when it is not — never a
   silent unit swap. */
function ngFvgSideText(side, leg){
  var bull = side === 'bull';
  var top = bull ? leg.fvg.bullTop : leg.fvg.bearTop;
  var bot = bull ? leg.fvg.bullBot : leg.fvg.bearBot;
  var age = bull ? leg.fvg.bullAge : leg.fvg.bearAge;
  var zone = '[' + fmtF(bot, 2) + ' – ' + fmtF(top, 2) + ']';
  var head = 'nearest unmitigated ' + side + ' FVG ' + zone
    + (isFinite(age) ? ' · ' + age + ' bars old' : '');
  var inside = bull ? leg.fvg.inBull : leg.fvg.inBear;
  if (inside) return 'price is INSIDE the ' + head;
  var c = leg.lastClose;
  var above = c > top;
  var dist = above ? (c - top) : (bot - c);
  var distTxt = (isFinite(leg.atr) && leg.atr > 0)
    ? fmtF(dist / leg.atr, 1) + ' ATR'
    : fmtF(dist, 2) + ' abs (ATR unreadable on this feed)';
  return 'price is ' + distTxt + ' ' + (above ? 'above' : 'below') + ' the ' + head;
}

/* The per-horizon CONFIRMATION CHECKLIST — every leg of the triple
   confirmation on the last CLOSED bar, through the module's own reader
   (ngLegRead — the same thresholds ngAssess fires on), plus the session-htf
   read on the SIGNAL BAR instant and the participation truth. Ends with the
   needs verdict for BOTH directions; no direction is recommended.
   Pure and throw-safe; rows-less/short feeds come back ok:false with the
   reason and only the participation leg (which is true feed-up or dark). */
function ngBuildChecklist(rows, horizonLabel, tape, source){
  var cl = { horizon: String(horizonLabel || ''), source: String(source || ''),
             ok: false, why: '', barMs: NaN, barISO: '',
             legs: [], needs: { long: [], short: [] }, fireDir: '' };
  try{
    tape = tape || { dir: '', src: '' };
    var leg = ngLegRead(rows);
    if (!leg.ok){
      cl.why = (!Array.isArray(rows) || !rows.length)
        ? ('no bars from the feed' + (cl.source ? ' (source=' + cl.source + ')' : '')
           + ' — every leg is DARK; nothing is read, nothing is invented')
        : (leg.why || 'legs unreadable on this feed');
      cl.legs.push(ngPartLeg());
      return cl;
    }
    cl.ok = true;
    cl.barMs = ngBarMs(rows);
    if (isFinite(cl.barMs)){
      try { cl.barISO = new Date(cl.barMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch(eIso){}
    }

    /* STRUCTURE — context only, explicitly not an entry. */
    var hasBull = isFinite(leg.fvg.bullTop) && isFinite(leg.fvg.bullBot);
    var hasBear = isFinite(leg.fvg.bearTop) && isFinite(leg.fvg.bearBot);
    var st = { key: 'structure', label: 'STRUCTURE',
               context: 'structure context — not an entry',
               long: false, short: false, dark: false, text: '' };
    if (!hasBull && !hasBear){
      st.text = 'no unmitigated FVG in range — structure leg cannot fire '
        + '(gaps older than ' + FVG_MAX_AGE + ' bars are stale; traded-through gaps are excluded, hg-v700)';
    } else {
      var stParts = [];
      if (hasBull) stParts.push(ngFvgSideText('bull', leg));
      if (hasBear) stParts.push(ngFvgSideText('bear', leg));
      st.text = stParts.join(' · ');
      /* hg-v702: the leg state is the LOOSENED zone read — the same one
         ngAssess fires on (inside, or within the edge-tag tolerance). */
      st.long = leg.fvg.nearBull === true;
      st.short = leg.fvg.nearBear === true;
    }
    cl.legs.push(st);

    /* ML BASELINE (VWMA-50) */
    var mlLeg = { key: 'ml', label: 'ML BASELINE (VWMA-50)',
                  long: leg.ml.side === 'bull', short: leg.ml.side === 'bear',
                  dark: false, text: '' };
    if (!isFinite(leg.ml.baseline)){
      mlLeg.text = 'VWMA-50 unreadable on this feed — the ML leg cannot agree with either direction';
      mlLeg.long = false; mlLeg.short = false;
    } else {
      var rel = leg.ml.side === 'bull' ? 'above' : (leg.ml.side === 'bear' ? 'below' : 'exactly at');
      mlLeg.text = 'close ' + fmtF(leg.lastClose, 2) + ' ' + rel + ' VWMA-50 '
        + fmtF(leg.ml.baseline, 2) + ' — '
        + (leg.ml.side === 'bull' ? 'agrees with LONG only'
          : leg.ml.side === 'bear' ? 'agrees with SHORT only'
          : 'agrees with neither direction');
    }
    cl.legs.push(mlLeg);

    /* RSI CROSS — the trigger read. hg-v702: a cross within the last
       NG_RSI_CROSS_BARS closed bars still triggers when RSI HOLDS the
       crossed side now (the leg state = the SAME windowed read ngAssess
       fires on); a more recent opposite cross kills the window. */
    var rsiLeg = { key: 'rsi', label: 'RSI CROSS (RSI-14 vs 9-SMA)',
                   long: leg.rsi.bullCrossWin === true, short: leg.rsi.bearCrossWin === true,
                   dark: false, text: '' };
    var rsiBase = 'RSI ' + fmtF(leg.rsi.now, 1) + ' vs 9-SMA ' + fmtF(leg.rsi.sma, 1);
    if (leg.rsi.bullCross)      rsiLeg.text = rsiBase + ' — crossed UP on this closed bar (the trigger read)';
    else if (leg.rsi.bearCross) rsiLeg.text = rsiBase + ' — crossed DOWN on this closed bar (the trigger read)';
    else if (leg.rsi.bullCrossWin) rsiLeg.text = rsiBase + ' — crossed UP ' + leg.rsi.bullCrossAge + ' bar'
      + (leg.rsi.bullCrossAge === 1 ? '' : 's') + ' ago and still held (inside the loosened ≤'
      + NG_RSI_CROSS_BARS + '-bar window, hg-v702)';
    else if (leg.rsi.bearCrossWin) rsiLeg.text = rsiBase + ' — crossed DOWN ' + leg.rsi.bearCrossAge + ' bar'
      + (leg.rsi.bearCrossAge === 1 ? '' : 's') + ' ago and still held (inside the loosened ≤'
      + NG_RSI_CROSS_BARS + '-bar window, hg-v702)';
    else if (leg.rsi.lastCross) rsiLeg.text = rsiBase + ' — no live trigger; last cross '
      + leg.rsi.lastCross.dir + ' ' + leg.rsi.lastCross.barsAgo + ' bar'
      + (leg.rsi.lastCross.barsAgo === 1 ? '' : 's') + ' ago (outside the ≤'
      + NG_RSI_CROSS_BARS + '-bar window, or no longer held)';
    else rsiLeg.text = rsiBase + ' — no cross on this closed bar and none in the last 20';
    cl.legs.push(rsiLeg);

    /* SESSION-HTF — the desk's ONE revocable class (v698 closeout): the
       measured cohort on the SIGNAL BAR instant, or the real htf tape.
       Either can carry it; the row says which one would. */
    var sedgeFn = gfn('hgGoldSessionEdge');
    var sedge = (sedgeFn && isFinite(cl.barMs)) ? sedgeFn(cl.barMs) : null;
    var winTxt = !sedgeFn
      ? 'session cohort table unavailable (gold-formation.js not loaded) — the clock cannot confirm (fail closed)'
      : (sedge ? ('window: ' + String(sedge.why || sedge.label || ''))
               : 'session cohort unreadable on the closed signal bar — the clock cannot confirm (fail closed)');
    var tapeTxt = tape.dir
      ? ('htf tape: ' + String(tape.src || '') + ' reads ' + String(tape.dir).toUpperCase())
      : 'htf tape: no higher-timeframe read available on this scan';
    var carrier;
    if (sedge && sedge.confirms === true){
      carrier = 'the session window carries the revocable class — for either direction';
    } else if (tape.dir){
      carrier = 'the HTF tape alone would carry the revocable class — for '
        + String(tape.dir).toUpperCase() + ' only';
    } else {
      carrier = 'NEITHER read confirms — the desk’s one revocable class is unavailable, so no fire can FORM on this bar';
    }
    cl.legs.push({ key: 'session-htf', label: 'SESSION-HTF',
      long: !!(sedge && sedge.confirms === true) || tape.dir === 'long',
      short: !!(sedge && sedge.confirms === true) || tape.dir === 'short',
      dark: false,
      text: winTxt + ' · ' + tapeTxt + ' · ' + carrier });

    /* PARTICIPATION — dark by the module's own design. */
    cl.legs.push(ngPartLeg());

    /* The needs verdict, per direction, computed FROM the leg states. */
    var mkNeeds = function(side){
      var wantBull = side === 'long';
      var arr = [];
      var inZone = wantBull ? leg.fvg.nearBull : leg.fvg.nearBear;   /* hg-v702 loosened read */
      var hasZone = wantBull ? hasBull : hasBear;
      if (!inZone){
        if (hasZone){
          var zTop = wantBull ? leg.fvg.bullTop : leg.fvg.bearTop;
          var zBot = wantBull ? leg.fvg.bullBot : leg.fvg.bearBot;
          arr.push('price back inside the ' + (wantBull ? 'bull' : 'bear') + ' FVG ['
            + fmtF(zBot, 2) + ' – ' + fmtF(zTop, 2) + ']'
            + (NG_FVG_EDGE_ATR > 0
                ? ' (or within ' + NG_FVG_EDGE_ATR + ' ATR of its near edge — structure context, not an entry)'
                : ''));
        } else {
          arr.push('a fresh unmitigated ' + (wantBull ? 'bull' : 'bear') + ' FVG (none in range)');
        }
      }
      if (leg.ml.side !== (wantBull ? 'bull' : 'bear')){
        arr.push('close ' + (wantBull ? 'above' : 'below') + ' VWMA-50 ('
          + (isFinite(leg.ml.baseline) ? fmtF(leg.ml.baseline, 2) : 'unreadable') + ')');
      }
      if (!(wantBull ? leg.rsi.bullCrossWin : leg.rsi.bearCrossWin)){
        arr.push('RSI(14) cross ' + (wantBull ? 'above' : 'below') + ' its 9-SMA within the last '
          + NG_RSI_CROSS_BARS + ' closed bars (still held now)');
      }
      return arr;
    };
    cl.needs.long = mkNeeds('long');
    cl.needs.short = mkNeeds('short');
    if (!cl.needs.long.length) cl.fireDir = 'long';
    else if (!cl.needs.short.length) cl.fireDir = 'short';
    return cl;
  }catch(e){
    cl.ok = false;
    cl.why = 'checklist build threw — section fails soft, nothing is claimed: ' + String(e && e.message || e);
    return cl;
  }
}

/* WATCH / NEAR-MISS list — fires that exist but are NOT tradable, plus any
   composed-floor drop this scan stashed on W.__ngLastDrop (hg-v700 dropped
   the fire honestly but told nobody; now it is surfaced). Entries carry NO
   level fields at all — a card the desk declined to call tradable never
   gets numbers to lean on. */
function ngWatchList(results, sinceMs){
  var out = [];
  try{
    var list = Array.isArray(results) ? results : [];
    for (var i = 0; i < list.length; i++){
      var r = list[i];
      if (!r || !r.setup) continue;
      var fm = r.formation || null;
      if (fm && fm.tradable === true) continue;   /* FORMED fires are cards, not watches */
      var conf = fm && fm.confluence ? fm.confluence : null;
      var missing = [];
      if (conf && Array.isArray(conf.requiredMissing) && conf.requiredMissing.length){
        missing = conf.requiredMissing.slice();
      } else if (conf && Array.isArray(conf.missing)){
        missing = conf.missing.slice();
      }
      out.push({
        horizon: String(r.horizon || ''), dir: String(r.setup.dir || ''),
        kind: String(r.setup.kind || 'TRIPLE-CONF'),
        state: String((fm && fm.state) || 'WATCH'),
        missing: missing,
        reasons: (fm && Array.isArray(fm.reasons)) ? fm.reasons.slice(0, 4).map(String)
          : ['formation verdict unavailable — fail closed, not tradable']
      });
    }
    /* composed-floor drop from THIS scan (ngAssess stashes it when the
       final T1 would pay under MIN_RR — the fire is dropped, not widened) */
    var d = W.__ngLastDrop;
    if (d && isFinite(+d.at) && isFinite(+sinceMs) && +d.at >= +sinceMs){
      out.push({ horizon: '', dir: '', kind: 'TRIPLE-CONF', state: 'DROPPED',
        missing: [], reasons: [String(d.reason || 'fire dropped by the composed stop floor')] });
    }
  }catch(e){}
  return out;
}

/* HYBRID LANE STATUS — why ngPullOmniLanes() produced what it produced,
   with counts from the scan loop. Honest at every depth of absence. */
function ngOmniLaneStatus(stat){
  var out = { state: 'dark', lines: [],
    counts: stat ? { candidates: +stat.candidates || 0, rowsShort: +stat.rowsShort || 0,
                     dedup: +stat.dedup || 0, noFire: +stat.noFire || 0,
                     dirDrop: +stat.dirDrop || 0, emitted: +stat.emitted || 0 } : null };
  try{
    if (typeof W.hgOgUniformDebug !== 'function'){
      out.lines.push('OMNIGOLD is not loaded — the hybrid lane is DARK by design without its feeds; no candidates are invented');
      return out;
    }
    var dbg = null;
    try { dbg = W.hgOgUniformDebug(); } catch(eD){ dbg = null; }
    if (!dbg){
      out.lines.push('OMNIGOLD debug surface returned nothing — no OMNIGOLD scan to read this session');
      return out;
    }
    var nS = Array.isArray(dbg.swing) ? dbg.swing.length : 0;
    var nC = Array.isArray(dbg.scalp) ? dbg.scalp.length : 0;
    if (!nS && !nC){
      out.state = 'empty';
      out.lines.push('OMNIGOLD is loaded but has no ranked candidates this session — the hybrid lane '
        + 'reads OMNIGOLD’s own scan output and never re-scans or invents candidates'
        + (dbg.src ? '' : ' (no OMNIGOLD scan yet — open the OMNIGOLD tab or wait for its warmup)'));
      return out;
    }
    out.state = 'read';
    out.lines.push(nS + ' SWING + ' + nC + ' SCALP OMNIGOLD candidate' + ((nS + nC) === 1 ? '' : 's') + ' read');
    if (stat){
      if (stat.rowsShort) out.lines.push(stat.rowsShort + ' lane' + (stat.rowsShort === 1 ? '' : 's')
        + ' skipped — fewer than ' + (ML_LOOKBACK + 5) + ' bars on the lane timeframe');
      if (stat.dedup) out.lines.push(stat.dedup + ' duplicate (horizon·kind·dir) entr'
        + (stat.dedup === 1 ? 'y' : 'ies') + ' deduped');
      if (stat.noFire) out.lines.push(stat.noFire + ' dropped — no triple-confirmation fire on the lane '
        + 'timeframe (the hybrid requires BOTH engines to read the same bars)');
      if (stat.dirDrop) out.lines.push('direction intersection dropped ' + stat.dirDrop
        + ' — OMNIGOLD’s direction ≠ the triple-confirmation’s on the same rows');
      out.lines.push(stat.emitted + ' hybrid card' + (stat.emitted === 1 ? '' : 's') + ' emitted this scan');
    }
    return out;
  }catch(e){
    out.state = 'error';
    out.lines = ['hybrid lane status unreadable — fails soft, nothing claimed: ' + String(e && e.message || e)];
    return out;
  }
}

/* SESSION CONTEXT STRIP data — measured cohorts, informational only.
   The BAR line is the instant the session leg actually reads; the WALL
   line is labeled as the clock the legs never use. */
function ngSessionRead(tapes, barMsFirst){
  var out = { available: !!gfn('hgGoldSessionEdge'),
    barMs: isFinite(+barMsFirst) ? +barMsFirst : NaN, bar: null,
    wallMs: Date.now(), wall: null,
    tapes: [] };
  try{
    var list = Array.isArray(tapes) ? tapes : [];
    for (var i = 0; i < list.length; i++){
      var t = list[i];
      if (!t) continue;
      out.tapes.push({ horizon: String(t.horizon || ''), dir: String(t.dir || ''), src: String(t.src || '') });
    }
    var fn = gfn('hgGoldSessionEdge');
    if (fn){
      if (isFinite(out.barMs)){
        try { var b = fn(out.barMs); if (b) out.bar = { key: b.key, label: b.label, n: b.n, grossR: b.grossR, confirms: b.confirms === true, why: String(b.why || '') }; } catch(eB){}
      }
      try { var w = fn(out.wallMs); if (w) out.wall = { key: w.key, label: w.label, n: w.n, grossR: w.grossR, confirms: w.confirms === true, why: String(w.why || '') }; } catch(eW){}
    }
  }catch(e){}
  return out;
}

/* PAID HISTORY — settled NEWGOLD forward-ledger records (mechanic
   TRIPLE-CONF*), READ-ONLY: this never settles, re-settles or writes
   anything; it renders what hg-forward.js already resolved.
   -> array of settled entries (newest first, capped), [] when none,
      null when the ledger surface is not loaded (DARK, not empty). */
function ngHistoryRecords(limit){
  try{
    if (typeof W.hgFwdRecords !== 'function') return null;
    var all = null;
    try { all = W.hgFwdRecords(); } catch(eR){ return null; }
    if (!Array.isArray(all)) return null;
    var out = [];
    for (var i = 0; i < all.length; i++){
      var r = all[i];
      if (!r) continue;
      if (String(r.tab || '').indexOf('NEWGOLD') !== 0) continue;
      if (String(r.mechanic || '').indexOf('TRIPLE-CONF') !== 0) continue;
      if (r.state !== 't1' && r.state !== 'stop' && r.state !== 'expired') continue;
      var rGross = NaN;
      if (r.state === 't1') rGross = isFinite(+r.r) ? +r.r : (isFinite(+r.rr) ? +r.rr : NaN);
      else if (r.state === 'stop') rGross = isFinite(+r.r) ? +r.r : -1;
      out.push({
        mechanic: String(r.mechanic), horizon: String(r.tab).replace(/^NEWGOLD:?/, ''),
        dir: String(r.dir || ''), state: String(r.state),
        rGross: isFinite(rGross) ? rGross : null,
        barT: isFinite(+r.barT) ? +r.barT : null,
        settledT: isFinite(+r.settledT) ? +r.settledT : null,
        ticket: r.ticket === true
      });
    }
    out.sort(function(a, b){ return (b.settledT || 0) - (a.settledT || 0); });
    var cap = isFinite(+limit) && +limit > 0 ? Math.floor(+limit) : 12;
    return out.slice(0, cap);
  }catch(e){ return null; }
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
  /* hg-v701 board state — collected alongside the scan, never gating it */
  var scanStartAt = Date.now();
  var checklists = [];
  var stripTapes = [];
  var stripBarMs = NaN;
  var laneStat = { candidates: 0, rowsShort: 0, dedup: 0, noFire: 0, dirDrop: 0, emitted: 0 };
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
      if (!rows.length){
        errors.push(h.label + ': no bars (source=' + (pack && pack.source) + ')');
        /* hg-v701: the checklist still renders for a dead horizon — DARK
           with the reason, never silently missing from the board. */
        try { checklists.push(ngBuildChecklist([], h.label, { dir: '', src: '' }, (pack && pack.source) || 'unknown')); } catch(eCl0){}
        continue;
      }
      var setup = ngAssess(rows);
      var tape = ngHtfTape(h.label, rows4hForTape);
      /* hg-v701: per-horizon checklist + session-strip inputs, fail-soft */
      try { checklists.push(ngBuildChecklist(rows, h.label, tape, pack.source)); }
      catch(eCl){ checklists.push({ horizon: h.label, ok: false,
        why: 'checklist build threw — section fails soft: ' + String(eCl && eCl.message || eCl),
        legs: [], needs: { long: [], short: [] }, fireDir: '' }); }
      try {
        stripTapes.push({ horizon: h.label, dir: (tape && tape.dir) || '', src: (tape && tape.src) || '' });
        if (!isFinite(stripBarMs)) stripBarMs = ngBarMs(rows);
      } catch(eSt){}
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
      laneStat.candidates = omniLanes.length; /* hg-v701: hybrid-lane honesty counts */
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
          /* hg-v701: the counter lines sit BESIDE the original guards (which
             tests pin verbatim) so the hybrid-lane status can say how many
             candidates each guard dropped instead of a silent empty. */
          if (laneRows.length < ML_LOOKBACK + 5) laneStat.rowsShort++;
          if (laneRows.length < ML_LOOKBACK + 5) continue;
          var dedupKey = lane.horizonLabel + '|' + lane.ogKind + '|' + lane.ogDir;
          if (seenOmni[dedupKey]){ laneStat.dedup++; continue; }
          seenOmni[dedupKey] = true;
          var ogSetup = null;
          try { ogSetup = ngAssess(laneRows); } catch(eA){ ogSetup = null; }
          if (!ogSetup){ laneStat.noFire++; continue; }
          /* Intersection guard: NEW GOLD triple-conf must match OMNIGOLD's
             own direction. If they disagree we drop the fire. */
          if (ogSetup.dir !== lane.ogDir) laneStat.dirDrop++;
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
          laneStat.emitted++;
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

    /* -- hg-v701: ALWAYS-ON BOARD DATA ------------------------------------
       Built AFTER the kill filter so the watch list reflects what actually
       renders; each block fail-soft so the scan itself can never be broken
       by a board read. The snapshot is EXTENDED ADDITIVELY (new keys only,
       mirroring goldscalp.js publishScan's armed/whySilent addition): the
       existing { at, results, errors } contract is untouched, and the new
       keys are deep-frozen — they are read surfaces, not scan state. */
    var watch = [], hybridStatus = null, sessionEdge = null, history = null;
    try { watch = ngWatchList(results, scanStartAt); } catch(eWb){ watch = []; }
    try { hybridStatus = ngOmniLaneStatus(laneStat); }
    catch(eHb){ hybridStatus = { state: 'error', lines: ['hybrid lane status unreadable: ' + String(eHb && eHb.message || eHb)], counts: null }; }
    try { sessionEdge = ngSessionRead(stripTapes, stripBarMs); } catch(eSb){ sessionEdge = null; }
    try { history = ngHistoryRecords(12); } catch(eHi){ history = null; }

    __ng.snap = { at: Date.now(), results: results, errors: errors,
      checklist: ngDeepFreeze(checklists),
      watch: ngDeepFreeze(watch),
      hybridLaneStatus: ngDeepFreeze(hybridStatus),
      sessionEdge: ngDeepFreeze(sessionEdge),
      history: ngDeepFreeze(history) };
    return { status: results.length ? 'refreshed' : 'empty', results: results, errors: errors,
      checklist: __ng.snap.checklist, watch: __ng.snap.watch,
      hybridLaneStatus: __ng.snap.hybridLaneStatus,
      sessionEdge: __ng.snap.sessionEdge, history: __ng.snap.history };
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

/* --- always-on board render (hg-v701) ---------------------------------- */

/* Scoped house pane CSS, ng- prefixed, injected ONCE at mount (never at
   module load — Node test boots have no document). */
var NG_CSS = ''
+ '.ng-board{margin-top:14px}'
+ '.ng-sec{margin-top:12px;padding:9px 11px;border:1px solid #E2E8F0;border-radius:8px;background:#F8FAFC;font-size:11px;line-height:1.55;color:#0F172A}'
+ '.ng-sec .ng-h{font-size:10px;letter-spacing:.16em;font-weight:800;color:#1E293B;margin-bottom:6px}'
+ '.ng-dim{opacity:.65;font-weight:500}'
+ '.ng-leg{padding:5px 8px;border-left:3px solid #E2E8F0;margin:4px 0;background:#fff}'
+ '.ng-leg.ok{border-left-color:#059669}'
+ '.ng-leg.no{border-left-color:#DC2626}'
+ '.ng-leg.dark{border-left-color:#64748B;background:#F1F5F9;color:#334155}'
+ '.ng-leg b{letter-spacing:.08em}'
+ '.ng-ctx{font-size:9px;letter-spacing:.1em;color:#9A3412;font-weight:800;margin-left:6px}'
+ '.ng-chip{display:inline-block;font-size:8px;letter-spacing:.12em;border:1px solid;border-radius:4px;padding:1px 5px;margin-right:5px;font-weight:800}'
+ '.ng-chip.on{color:#047857;border-color:rgba(5,150,105,.5);background:rgba(5,150,105,.08)}'
+ '.ng-chip.off{color:#64748B;border-color:#CBD5E1;background:#F8FAFC}'
+ '.ng-needs{margin-top:6px;padding:6px 8px;border:1px dashed #FDE68A;background:#FFFBEB;border-radius:6px}'
+ '.ng-needs b{color:#A67C12;letter-spacing:.08em}'
+ '.ng-wrow{padding:5px 8px;border-left:3px solid #C9921A;background:#FFFBEB;margin:4px 0}'
+ '.ng-wrow b{letter-spacing:.08em}'
+ '.ng-hrow{padding:4px 8px;border-left:3px solid #E2E8F0;margin:3px 0;background:#fff}'
+ '.ng-hrow.t1{border-left-color:#059669}'
+ '.ng-hrow.stop{border-left-color:#DC2626}'
+ '.ng-hrow.expired{border-left-color:#A67C12}'
+ '.ng-err{border-color:rgba(220,38,38,.4);background:#FEF2F2;color:#B91C1C}';

function ngInjectCss(){
  try{
    if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return;
    if (typeof document.getElementById === 'function' && document.getElementById('hg-ng-styles')) return;
    var st = document.createElement('style');
    st.id = 'hg-ng-styles';
    st.textContent = NG_CSS;
    ((document.head) || document.documentElement || document.body).appendChild(st);
  }catch(e){}
}

function ngChip(on, lab){
  return '<span class="ng-chip ' + (on ? 'on' : 'off') + '">' + esc(lab) + (on ? ' ✓' : ' —') + '</span>';
}

/* One horizon's CONFIRMATION CHECKLIST. Levels NEVER appear here: the
   structure row is labeled context, and the needs line names what has to
   happen — no direction is recommended. */
function ngChecklistHtml(cl){
  if (!cl) return '';
  var h = '<div class="ng-sec ng-checklist" data-ng-horizon="' + esc(cl.horizon || '?') + '">'
    + '<div class="ng-h">CONFIRMATION CHECKLIST · ' + esc(cl.horizon || '?')
    + ' <span class="ng-dim">'
    + (cl.barISO ? 'closed bar ' + esc(cl.barISO) + ' · ' : '')
    + 'source ' + esc(cl.source || '—') + '</span></div>';
  if (cl.ok !== true){
    h += '<div class="ng-leg dark"><b>DARK</b> — ' + esc(cl.why || 'legs unreadable') + '</div>';
    /* the participation truth still prints (it is feed-independent) */
    var pl = (cl.legs || []).filter(function(l){ return l && l.key === 'participation'; })[0];
    if (pl) h += '<div class="ng-leg dark"><b>' + esc(pl.label) + '</b> — ' + esc(pl.text) + '</div>';
    return h + '</div>';
  }
  for (var i = 0; i < (cl.legs || []).length; i++){
    var l = cl.legs[i];
    if (!l) continue;
    var cls = l.dark ? 'dark' : ((l.long || l.short) ? 'ok' : 'no');
    h += '<div class="ng-leg ' + cls + '">'
      + (l.dark ? '' : (ngChip(l.long === true, 'LONG') + ngChip(l.short === true, 'SHORT')))
      + '<b>' + esc(l.label) + '</b>'
      + (l.context ? '<span class="ng-ctx">' + esc(l.context) + '</span>' : '')
      + ' — ' + esc(l.text) + '</div>';
  }
  var needsTxt = function(arr, dirLab){
    return '<b>' + esc(dirLab) + ' needs:</b> '
      + (arr && arr.length ? esc(arr.join(', '))
        : 'nothing — all three signal legs read ' + esc(dirLab) + ' on this closed bar (see the fire card above)');
  };
  h += '<div class="ng-needs">' + needsTxt(cl.needs && cl.needs.long, 'LONG')
    + ' · ' + needsTxt(cl.needs && cl.needs.short, 'SHORT') + '</div>'
    + '<div class="ng-dim">no direction is recommended — the checklist reads the closed bar both ways; '
    + 'a fire still only FORMS when the session-htf class confirms on the signal bar (see the SESSION-HTF row)</div>';
  return h + '</div>';
}

function ngWatchHtml(watch){
  var list = Array.isArray(watch) ? watch : [];
  var h = '<div class="ng-sec ng-watch"><div class="ng-h">WATCH / NEAR-MISS '
    + '<span class="ng-dim">fires short of the bar — NO levels by design (a level on a non-ticket is an invitation)</span></div>';
  if (!list.length){
    return h + '<div class="ng-dim">no near-miss fires this scan — the checklist above shows how far each leg is from firing</div></div>';
  }
  for (var i = 0; i < list.length; i++){
    var w = list[i];
    if (!w) continue;
    h += '<div class="ng-wrow"><b>' + esc(w.state || 'WATCH') + '</b> — '
      + (w.horizon ? esc(w.horizon) + ' ' : '')
      + (w.dir ? esc(String(w.dir).toUpperCase()) + ' ' : '')
      + esc(w.kind || 'TRIPLE-CONF')
      + (w.missing && w.missing.length ? ' · missing class: ' + esc(w.missing.join(', ')) : '')
      + (w.reasons && w.reasons.length ? '<br><span class="ng-dim">' + esc(w.reasons.join(' · ')) + '</span>' : '')
      + '</div>';
  }
  return h + '</div>';
}

function ngHybridHtml(st){
  var h = '<div class="ng-sec ng-hybrid"><div class="ng-h">HYBRID LANE STATUS '
    + '<span class="ng-dim">OMNIGOLD × triple-confirmation intersection</span></div>';
  if (!st || !Array.isArray(st.lines) || !st.lines.length){
    return h + '<div class="ng-dim">hybrid lane status unavailable this scan — nothing claimed</div></div>';
  }
  for (var i = 0; i < st.lines.length; i++){
    h += '<div>· ' + esc(st.lines[i]) + '</div>';
  }
  return h + '</div>';
}

function ngSessionStripHtml(se){
  var h = '<div class="ng-sec ng-session"><div class="ng-h">SESSION CONTEXT '
    + '<span class="ng-dim">measured cohorts · informational only — leg verdicts read the closed bar, never this strip</span></div>';
  if (!se){
    return h + '<div class="ng-dim">session context unreadable this scan — nothing claimed</div></div>';
  }
  if (!se.available){
    h += '<div class="ng-leg dark"><b>DARK</b> — session cohort table unavailable (gold-formation.js not loaded); no cohort is invented</div>';
  } else {
    if (se.bar){
      h += '<div>· signal-bar clock'
        + (isFinite(se.barMs) ? ' (' + esc(new Date(se.barMs).toISOString().slice(11, 16)) + ' UTC closed bar)' : '')
        + ': ' + esc(se.bar.why || se.bar.label || '') + ' <span class="ng-dim">— the instant the session leg reads (measured)</span></div>';
    } else {
      h += '<div class="ng-dim">· signal-bar cohort unreadable (no bars this scan) — fail closed, nothing claimed</div>';
    }
    if (se.wall){
      h += '<div>· wall clock now: ' + esc(se.wall.why || se.wall.label || '')
        + ' <span class="ng-dim">— informational only; no leg reads this clock (measured)</span></div>';
    }
  }
  var tp = Array.isArray(se.tapes) ? se.tapes : [];
  for (var i = 0; i < tp.length; i++){
    var t = tp[i];
    if (!t) continue;
    h += '<div>· htf tape ' + esc(t.horizon || '?') + ': '
      + (t.dir ? esc(String(t.dir).toUpperCase()) + ' <span class="ng-dim">(' + esc(t.src) + ')</span>'
               : '<span class="ng-dim">no read this scan — unread is unread, not neutral-bullish</span>')
      + '</div>';
  }
  return h + '</div>';
}

function ngHistoryHtml(history){
  var h = '<div class="ng-sec ng-history"><div class="ng-h">PAID HISTORY '
    + '<span class="ng-dim">NEWGOLD forward ledger · settled outcomes only · read-only (nothing is re-settled here)</span></div>';
  if (history === null || history === undefined){
    return h + '<div class="ng-leg dark"><b>DARK</b> — forward ledger unavailable (hg-forward.js not loaded); history is dark, not empty</div></div>';
  }
  var list = Array.isArray(history) ? history : [];
  if (!list.length){
    return h + '<div class="ng-dim">no settled TRIPLE-CONF records yet — the ledger fills as fires settle on later bars; nothing is claimed until an outcome exists</div></div>';
  }
  for (var i = 0; i < list.length; i++){
    var r = list[i];
    if (!r) continue;
    var when = '';
    try {
      var tMs = isFinite(+r.settledT) ? (+r.settledT < 1e12 ? +r.settledT * 1000 : +r.settledT) : NaN;
      if (isFinite(tMs)) when = new Date(tMs).toISOString().slice(0, 10);
    } catch(eD){}
    var outcome = r.state === 't1'
      ? ('TP1 hit · ' + (r.rGross !== null && isFinite(+r.rGross) ? '+' + fmtF(r.rGross, 2) + 'R gross' : 'R unreadable'))
      : r.state === 'stop'
        ? ('stopped · ' + (r.rGross !== null && isFinite(+r.rGross) ? fmtF(r.rGross, 2) + 'R gross' : '−1R gross'))
        : 'expired unsettled — no outcome claimed';
    h += '<div class="ng-hrow ' + esc(r.state) + '"><b>' + esc(r.mechanic) + '</b> '
      + esc(r.horizon || '?') + ' ' + esc(r.dir || '?')
      + ' · ' + outcome
      + (when ? ' · ' + esc(when) : '')
      + ' · <span class="ng-dim">' + (r.ticket ? 'ticket' : 'recorded fire, not a ticket') + '</span></div>';
  }
  return h + '</div>';
}

/* Per-section catch isolation: one broken section fails soft with its name
   and takes nothing else down. */
function ngSecSafe(fn, label){
  try { return fn() || ''; }
  catch(e){
    return '<div class="ng-sec ng-err"><div class="ng-h">' + esc(label) + '</div>'
      + 'section failed soft — ' + esc(String(e && e.message || e)) + ' (nothing invented)</div>';
  }
}

function ngBoardHtml(data){
  data = data || {};
  var h = '<div class="ng-board">';
  h += ngSecSafe(function(){
    var cls = Array.isArray(data.checklist) ? data.checklist : [];
    if (!cls.length){
      return '<div class="ng-sec ng-checklist"><div class="ng-h">CONFIRMATION CHECKLIST</div>'
        + '<div class="ng-dim">no horizons read this scan — the feeds returned nothing (see the status line); nothing is invented</div></div>';
    }
    var s = '';
    for (var i = 0; i < cls.length; i++) s += ngChecklistHtml(cls[i]);
    return s;
  }, 'CONFIRMATION CHECKLIST');
  h += ngSecSafe(function(){ return ngWatchHtml(data.watch); }, 'WATCH / NEAR-MISS');
  h += ngSecSafe(function(){ return ngHybridHtml(data.hybridLaneStatus); }, 'HYBRID LANE STATUS');
  h += ngSecSafe(function(){ return ngSessionStripHtml(data.sessionEdge); }, 'SESSION CONTEXT');
  h += ngSecSafe(function(){ return ngHistoryHtml(data.history); }, 'PAID HISTORY');
  return h + '</div>';
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
  ngInjectCss(); /* hg-v701: scoped ng- board styles, injected once */
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
    /* hg-v701: the always-on board \u2014 with feeds up this IS the content, so
       the old one-line empty state below survives ONLY for the
       feeds-failed case. */
    + '<div id="ngBoard"></div>'
    + '<div id="ngPerf"></div>'
    + '<div class="empty" id="ngEmpty" style="display:none">FEEDS DOWN \u2014 no XAUUSD bars returned for either horizon this scan, so the board stays dark rather than invented. The status line above names the source errors.</div>'
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
    /* hg-v701: the always-on board renders on EVERY scan outcome \u2014 fires,
       no fires, even feeds down (each section then says DARK with the
       reason). Isolated so a board failure can never break the cards. */
    try {
      var boardEl = el.querySelector('#ngBoard');
      /* a 'busy' tick returns a string, not a pack — keep the standing
         board instead of blanking it on no new data */
      if (boardEl && pack && typeof pack === 'object') boardEl.innerHTML = ngBoardHtml(pack);
    } catch(eBoard){}
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
/* hg-v701: the always-on board — pure builders + renderers exported so the
   population is testable without a mount (tests/test-newgold-populate.mjs).
   All ADDITIVE: nothing above changed shape. */
W.ngLegRead = ngLegRead;
W.ngRsiWindowFromSeries = ngRsiWindowFromSeries;   /* hg-v702 pure window rules, exported for direct-drive tests */
W.ngFvgNearFrom = ngFvgNearFrom;
/* hg-v702 knob readout (read-only copy): tests compute their expectations
   from the SHIPPED dials instead of pinning stale numbers. */
W.NG_LOOSEN = { rsiCrossBars: NG_RSI_CROSS_BARS, fvgEdgeAtr: NG_FVG_EDGE_ATR };
W.ngBuildChecklist = ngBuildChecklist;
W.ngChecklistHtml = ngChecklistHtml;
W.ngWatchList = ngWatchList;
W.ngWatchHtml = ngWatchHtml;
W.ngOmniLaneStatus = ngOmniLaneStatus;
W.ngHybridHtml = ngHybridHtml;
W.ngSessionRead = ngSessionRead;
W.ngSessionStripHtml = ngSessionStripHtml;
W.ngHistoryRecords = ngHistoryRecords;
W.ngHistoryHtml = ngHistoryHtml;
W.ngBoardHtml = ngBoardHtml;
W.ngCardHtml = cardHtml;
W.newGoldScan = function(){ return __ng.snap; };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'newgold', label: 'NEW GOLD', mount: mount, refresh: ngRefresh });

})();
