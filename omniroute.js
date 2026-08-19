/* =========================================================================
HARDGATE — omniroute.js
OMNIROUTE — setup scanner for the techniques the popular desks trade.

WHY THIS TAB EXISTS. The widely followed crypto desks trade a handful of
mechanics our ledger could not express: Wyckoff springs, the power-of-three
session model, opening-range breaks, effort-vs-result absorption, value-area
rejection, measured moves. This tab implements those as REAL GATES and scans
the Delta India + CoinDCX universe with them, so the techniques become
tickets on our own venues instead of a reading list.

THE LEDGER. Six setup families, each a pure detector over OHLCV:

  SPRING     Wyckoff spring / UTAD — price sweeps a established range
             extreme and closes back INSIDE the range. Failed breakdown.
  PO3        Power of three — session accumulation (tight range), then a
             sweep of the range low/high, then expansion + reclaim.
  ORB        Opening-range break — first N bars of the UTC day define the
             range; break and hold beyond it with the daily bias.
  ABSORB     Effort vs result — an outsized volume bar that produces a
             small range at a range edge: someone is absorbing.
  VALUE      Value-area rejection — price tags the volume-profile VAH/VAL
             (built from candle volume-at-price) and rejects back inside.
  MMOVE      Measured move — clean impulse leg, shallow pullback, the leg
             projected forward supplies a structural target.

COVERAGE. Both venues, EVERY futures contract — no top-N cap. That is
affordable because the scan is two-pass: pass 1 runs the detectors over
every contract (candles only, one linear sweep, no per-name network); pass 2
does the expensive work — walk-forward measurement, Binance confluence, book
depth — ONLY on contracts that actually fired, so cost tracks hits rather
than universe size. Pass 2 carries a stated ceiling; when it bites, the UI
says how many fired contracts were dropped rather than implying full cover.

SELF-MEASUREMENT (the point of this tab). Each detector is replayed across
the same bars the scan just read: every past firing is taken at the bar
close, stopped at the 10-bar structural extreme (ATR fallback), targeted at
MIN_RR, and given 20 bars to resolve. Results pool across all scanned
symbols, and the `measured-edge` gate VETOES setups from a detector whose
pooled expectancy is negative — the scanner refuses its own signal when its
own history says that signal has not paid. Under MIN_SAMPLES it reports
'too few to judge' instead of dressing up noise.
  Honesty constraints, because a backtest that flatters itself is worse than
  none: when a single bar spans BOTH stop and target it counts as a STOP
  (candles cannot say which printed first); results are IN-SAMPLE on a short
  window; and none of it is walk-forward-validated out of sample. Verified
  against a synthetic random walk, the harness returns ~26% T1-first against
  the 33% breakeven for 2R — pessimistic, as intended.

FREE CONFLUENCE. Binance's public key-less endpoints supply OI trend
(openInterestHist), retail crowding (globalLongShortAccountRatio), taker
aggression (takerlongshortRatio) and book depth (depth, for a real slippage
check); the daily timeframe is RESAMPLED from the same 4h bars rather than
refetched; regime and news blackout come from the app's own modules. All of
it is CONDITIONAL — a contract that is not on Binance simply reads UNCHECKED
and is never punished for its venue's API.

GATES, NOT SCORES. Every candidate runs the same ledger. Three HARD gates
(trend alignment, ATR vol-alive, participation) are computable from candles
on BOTH venues and must pass explicitly. Funding is CONDITIONAL: it vetoes
when the venue reports a crowded rate, and reports 'unchecked' when the venue
reports nothing at all — CoinDCX publishes no funding, and a blocking funding
gate would have meant CoinDCX could never produce a ticket. A single veto
stands the trade aside; the card still renders with the veto visible, marked
VETO or WATCH, never a ticket. No composite score anywhere; cards are ORDERED
by R:R (a fact about the plan's geometry), which is explicitly not a
prediction. Levels come from the house hgPlanLevels so entry/stop/T1/T2 obey
the same policy as every other tab.

ON "MAXIMUM PROFITABILITY". This ranks by reward-to-risk, requires a minimum
R:R, and refuses setups whose geometry does not clear it. That is the honest
lever available to a scanner. It is NOT a profitability claim: gate quality
is measurable, future returns are not, and no arrangement of these gates has
been walk-forward tested here. Size small until YOU have measured them.

DATA. window.xuUniverse() (combined Delta + CoinDCX, per-leg degradation)
and window.xuCandles(item, tf, n). Both are feature-checked; when either is
absent the tab says so and disables the scan rather than faking a universe.
Positioning (funding) via window.xuPositioning() where the venue reports it —
CoinDCX exposes none, so that gate reads 'unchecked', never 'pass'.

RESEARCH HALVES. The coverage matrix (which desk techniques we can now
express) and the optional OmniRoute-gateway ingest live BELOW the scanner.
The gateway is machine-local, so ingest works when running HARDGATE locally
and is unreachable from the deployed site; it says so rather than failing
silently. The scanner needs no gateway at all.

Classic script, IIFE. Exposes the pure detectors/graders (for tests) and the
window.HG_tabs registration. Never throws at load; every global is
feature-checked; every fetch carries a timeout and resolves [] on failure.

Hard refresh (index.html hardRefreshAll): refresh() is async, NEVER throws,
returns a terse status string. Before the first scan it reports
'skipped: not run yet' (a global refresh must never trigger an expensive
first-time whole-universe sweep); while a scan is in flight, 'busy'.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_omniroute_v1';
  var DEFAULT_ENDPOINT = 'http://localhost:20128';
  var DEFAULT_MODEL = 'auto/best-free';
  var LLM_TIMEOUT_MS = 90000;
  var PING_TIMEOUT_MS = 8000;

  /* Scan shape. TOP_N = 0 means EVERY futures contract on both venues; the
     scan is two-pass precisely so that is affordable. Pass 1 (detect) is one
     cheap linear sweep per contract. Pass 2 (enrich: walk-forward
     measurement + Binance confluence + book depth) runs ONLY on contracts
     that actually fired, so cost scales with hits, not with universe size. */
  var TOP_N = 0;
  var TF = '4h';
  var BARS = 180;
  var CHUNK = 4;          // venue-leg concurrency for pass 1 (gentle on /api/proxy)
  var CHUNK_DELAY_MS = 80; // pause between pass-1 batches — avoids 429 mid-scan
  var ENRICH_CHUNK = 4;   // pass 2 hits Binance (CORS-open, 60s cached)
  var ENRICH_MAX = 120;   // ceiling on NETWORKED enrichment, reported when it bites
  var MIN_RR = 2;
  var RANGE_LOOKBACK = 40;
  var ORB_BARS = 3;
  var MIN_SAMPLES = 20;   // below this a measured rate is not evidence
  /* A measured detector is only VETOED when it is clearly losing, not merely
     negative: the walk-forward is in-sample over a short window, so noise
     alone drifts a 2R system below breakeven. */
  /* Veto when the measured T1-first rate is this many standard errors below
     the breakeven rate for MIN_RR. -2 is the conventional two-sigma bar:
     tight enough to catch a real shortfall, loose enough that ordinary
     sampling noise does not silence a detector. */
  var EDGE_VETO_Z = -2;
  var EDGE_VETO_SAMPLES = 30;
  /* Settled out-of-sample trades needed before the forward record can be a
     verdict on its own. Below it the record can still contradict, but not
     conclude. */
  var FWD_MIN_JUDGE = 20;
  /* Daily EMA periods sized to the daily bars BARS x TF actually yields
     (180 x 4h ~= 31 days). Asking for a 50-period daily EMA silently
     disabled the gate on every card. */
  /* Which detector families trade AGAINST the prevailing trend. Used so the
     trend gates grade each setup against the right model. */
  var REVERSION_KINDS = { SPRING:true, UTAD:true, VALUE:true, ABSORB:true };

  var DAILY_FAST = 10;
  var DAILY_SLOW = 21;

  var __omni = { ui: null, busy: false, ran: false, snap: null, lastStat: '', xsRescued: 0 };

  /* ==================== pure: small numerics ==================== */

  function num(v){ var n = +v; return isFinite(n) ? n : NaN; }

  /* Strict numeric coercion for EXTERNAL payload fields.
     `isFinite(null)` is TRUE in JavaScript (null coerces to 0), so the
     natural-looking guard `isFinite(x) ? x.toFixed(2) : fallback` sails
     straight through for null and then throws on .toFixed. The venues do
     return nulls by design — xuPositioning reports fundingPct:null for every
     CoinDCX contract, which is ~494 of the ~500 scanned — so this crashed
     the scan on the first CoinDCX setup every time.
     fin() maps null/undefined/'' to NaN, and callers must convert FIRST and
     then use the converted number for both the test and the formatting. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  function emaOf(vals, n){
    if (!vals || vals.length < n || n <= 0) return NaN;
    var k = 2 / (n + 1), e = vals[0], i;
    for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
    return e;
  }

  function closesOf(rows){
    var out = [], i, c;
    for (i = 0; i < rows.length; i++){ c = num(rows[i].c); if (isFinite(c)) out.push(c); }
    return out;
  }

  /* Wilder-style ATR over the last n bars. NaN when there is not enough. */
  function atrOf(rows, n){
    if (!rows || rows.length < n + 1) return NaN;
    var sum = 0, cnt = 0, i, h, l, pc, tr;
    for (i = rows.length - n; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l); pc = num(rows[i - 1].c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      sum += tr; cnt++;
    }
    return cnt ? sum / cnt : NaN;
  }

  /* Moved to hg-gates.js. These two helpers were byte-identical in both desks
     (1,330 chars, verbatim) because the fix was written once and pasted; the
     shim keeps this file working if hg-gates.js somehow fails to load, rather
     than throwing a ReferenceError mid-scan. */
  function hgSlotMeanVol(rows, want){
    var w = ((typeof window !== 'undefined') ? window : null);
    return (w && typeof w.hgSlotMeanVol === 'function')
      ? w.hgSlotMeanVol(rows, want)
      : { mean: NaN, n: 0 };
  }

  function meanVol(rows, n){
    if (!rows || !rows.length) return NaN;
    var s = 0, c = 0, i, v;
    for (i = Math.max(0, rows.length - n); i < rows.length; i++){
      v = num(rows[i].v); if (isFinite(v)) { s += v; c++; }
    }
    return c ? s / c : NaN;
  }

  /* Bar-open seconds per timeframe, for forming-bar detection. */
  var TF_SEC = { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '1d':86400 };

  /* Drop the still-forming last bar. The house rule (engine.js
     dropFormingXu, edge.js, startradertab.js): "gates only ever see CLOSED
     candles — a still-forming bar repaints." omniroute was NOT doing this,
     and it corrupted live output in a way that looked like a gate bug:
     the partial bar carries partial VOLUME, so the participation gate saw
     0.08x the 20-bar mean and vetoed; and ORB reported "closed below the
     opening range" on a bar that had not closed. Pure given `now`. */
  function hgOmniDropForming(rows, tf, nowSec){
    if (!rows || !rows.length) return rows || [];

    /* SANITISE FIRST — this is the single ingestion point for the whole
       crypto scan, and every downstream reader assumes each entry is a bar.

       A venue that drops one candle returns an array with a null in it, and
       reaching through it threw from inside whichever detector happened to
       run first. Pass 1 catches that per contract, so the scan survived — but
       the contract was silently counted as FAILED and produced no card at
       all. Measured by fuzzing with feed-shaped input: a single null entry
       made 24 of 199 exported functions throw, hgOmniDetect among them.

       One guard here beats twenty-four defensive checks downstream, and it is
       the honest place for it: a hole in the data is a data problem, not
       something each detector should have an opinion about. */
    var clean = [], ci, r;
    for (ci = 0; ci < rows.length; ci++){
      r = rows[ci];
      if (!r || typeof r !== 'object') continue;
      /* fin(), NOT num(): +null is 0 and isFinite(0) is true, so num() lets a
         null close through as the price ZERO. That is the exact trap this
         audit was sweeping for, written into the sweep's own fix. */
      if (!isFinite(fin(r.c))) continue;      /* a bar with no close is not a bar */
      clean.push(r);
    }
    rows = clean;
    if (!rows.length) return rows;

    var sec = TF_SEC[tf] || 0;
    if (!sec) return rows;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT) || lastT <= 0) return rows;
    /* Same millisecond normalisation engine.js already does — a ms stamp
       would make this drop the newest CLOSED bar on every scan. */
    if (lastT > 1e12) lastT = Math.floor(lastT / 1000);
    var now = isFinite(nowSec) ? nowSec : (Date.now() / 1000);
    return ((now - lastT) < sec) ? rows.slice(0, -1) : rows;
  }

  /* ==================== pure: range + structure ==================== */

  /* The established range EXCLUDING the last bar (the bar under test must
     not define the level it is supposed to sweep). */
  function hgOmniRange(rows, lookback){
    if (!rows || rows.length < 5) return null;
    var n = Math.min(lookback || RANGE_LOOKBACK, rows.length - 1);
    var hi = -Infinity, lo = Infinity, i, h, l;
    for (i = rows.length - 1 - n; i < rows.length - 1; i++){
      if (i < 0) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var mid = (hi + lo) / 2;
    return { hi: hi, lo: lo, mid: mid, height: hi - lo, heightPct: (hi - lo) / mid * 100, bars: n };
  }

  /* SPRING / UTAD: last bar pierces a range extreme and CLOSES back inside.
     dir 'long' = swept the low (failed breakdown). Pure. */
  function hgOmniSpring(rows, rng){
    if (!rows || rows.length < 3 || !rng) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c), o = num(last.o);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c) || !isFinite(o)) return null;
    var depth;
    if (l < rng.lo && c > rng.lo){
      depth = (rng.lo - l) / (rng.height || 1) * 100;
      return { kind:'SPRING', dir:'long', level: rng.lo, pierce: rng.lo - l, depthPct: depth,
               why: 'swept range low ' + rng.lo.toFixed(6) + ' and closed back inside' };
    }
    if (h > rng.hi && c < rng.hi){
      depth = (h - rng.hi) / (rng.height || 1) * 100;
      return { kind:'UTAD', dir:'short', level: rng.hi, pierce: h - rng.hi, depthPct: depth,
               why: 'swept range high ' + rng.hi.toFixed(6) + ' and closed back inside' };
    }
    return null;
  }

  /* POWER OF THREE: a tight accumulation window, then a sweep of that
     window's extreme, then expansion + close back through the window.
     Looks at the last `win`+2 bars. Pure. */
  function hgOmniPo3(rows, win){
    if (!rows || rows.length < (win || 6) + 3) return null;
    var w = win || 6;
    var end = rows.length - 2;               // accumulation ends before sweep bar
    var start = end - w;
    if (start < 0) return null;
    var hi = -Infinity, lo = Infinity, i, h, l;
    for (i = start; i < end; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var accHeight = hi - lo, mid = (hi + lo) / 2;
    var atr = atrOf(rows, 14);
    /* accumulation must actually be TIGHT — otherwise every drift qualifies */
    if (!isFinite(atr) || accHeight > atr * 2.2) return null;
    var sweep = rows[rows.length - 2], last = rows[rows.length - 1];
    var sl = num(sweep.l), sh = num(sweep.h), lc = num(last.c);
    if (!isFinite(sl) || !isFinite(sh) || !isFinite(lc)) return null;
    if (sl < lo && lc > lo){
      return { kind:'PO3', dir:'long', level: lo, accPct: accHeight / mid * 100,
               why:'tight ' + w + '-bar accumulation, swept low, reclaimed' };
    }
    if (sh > hi && lc < hi){
      return { kind:'PO3', dir:'short', level: hi, accPct: accHeight / mid * 100,
               why:'tight ' + w + '-bar accumulation, swept high, rejected' };
    }
    return null;
  }

  /* OPENING RANGE: first ORB_BARS bars of the current UTC day set the range;
     a later bar closing beyond it with follow-through is the break. Needs
     bar-open times in SECONDS (xuCandles contract). Pure. */
  function hgOmniOrb(rows, orbBars){
    if (!rows || rows.length < 6) return null;
    var nb = orbBars || ORB_BARS;
    var last = rows[rows.length - 1];
    var t = num(last.t);
    if (!isFinite(t)) return null;
    var dayStart = Math.floor(t / 86400) * 86400;
    var day = [], i, ti;
    for (i = 0; i < rows.length; i++){
      ti = num(rows[i].t);
      if (isFinite(ti) && ti >= dayStart) day.push(rows[i]);
    }
    if (day.length < nb + 2) return null;      // need the range plus a break bar
    var hi = -Infinity, lo = Infinity, h, l;
    for (i = 0; i < nb; i++){
      h = num(day[i].h); l = num(day[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var c = num(last.c);
    if (!isFinite(c)) return null;
    if (c > hi) return { kind:'ORB', dir:'long', level: hi, why:'closed above the ' + nb + '-bar UTC opening range' };
    if (c < lo) return { kind:'ORB', dir:'short', level: lo, why:'closed below the ' + nb + '-bar UTC opening range' };
    return null;
  }

  /* EFFORT VS RESULT: outsized volume, undersized range, near a range edge.
     Absorption — heavy participation that failed to move price. Pure. */
  function hgOmniAbsorb(rows, rng){
    if (!rows || rows.length < 25 || !rng) return null;
    var last = rows[rows.length - 1];
    var v = num(last.v), h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(v) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var mv = meanVol(rows.slice(0, rows.length - 1), 20);
    var atr = atrOf(rows, 14);
    if (!isFinite(mv) || !isFinite(atr) || mv <= 0 || atr <= 0) return null;
    var volX = v / mv, rangeX = (h - l) / atr;
    if (!(volX >= 1.8 && rangeX <= 0.75)) return null;
    var nearLo = Math.abs(c - rng.lo) / (rng.height || 1) < 0.15;
    var nearHi = Math.abs(c - rng.hi) / (rng.height || 1) < 0.15;
    if (nearLo) return { kind:'ABSORB', dir:'long', level: rng.lo, volX: volX, rangeX: rangeX,
                         why:'vol ' + volX.toFixed(1) + '× with ' + rangeX.toFixed(2) + '× ATR range at range low' };
    if (nearHi) return { kind:'ABSORB', dir:'short', level: rng.hi, volX: volX, rangeX: rangeX,
                         why:'vol ' + volX.toFixed(1) + '× with ' + rangeX.toFixed(2) + '× ATR range at range high' };
    return null;
  }

  /* VOLUME PROFILE from candles: spread each bar's volume evenly across its
     high-low span into buckets, then take POC and the 70% value area. This
     is a candle approximation, NOT tick-level volume-at-price — labelled as
     such in the UI so it is never mistaken for exchange profile data. */
  function hgOmniProfile(rows, buckets){
    if (!rows || rows.length < 20) return null;
    var nb = buckets || 24, i, j;
    var hi = -Infinity, lo = Infinity, h, l;
    for (i = 0; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var step = (hi - lo) / nb, bins = [], total = 0;
    for (i = 0; i < nb; i++) bins.push(0);
    for (i = 0; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      var v = num(rows[i].v);
      if (!isFinite(h) || !isFinite(l) || !isFinite(v) || v <= 0) continue;
      var a = Math.max(0, Math.min(nb - 1, Math.floor((l - lo) / step)));
      var b = Math.max(0, Math.min(nb - 1, Math.floor((h - lo) / step)));
      var span = (b - a) + 1;
      for (j = a; j <= b; j++){ bins[j] += v / span; }
      total += v;
    }
    if (total <= 0) return null;
    var pocIdx = 0;
    for (i = 1; i < nb; i++) if (bins[i] > bins[pocIdx]) pocIdx = i;
    /* grow out from the POC until 70% of volume is enclosed */
    var acc = bins[pocIdx], loIdx = pocIdx, hiIdx = pocIdx, target = total * 0.7, guard = 0;
    while (acc < target && guard++ < nb * 2 && (loIdx > 0 || hiIdx < nb - 1)){
      var down = (loIdx > 0) ? bins[loIdx - 1] : -1;
      var up = (hiIdx < nb - 1) ? bins[hiIdx + 1] : -1;
      if (up >= down && hiIdx < nb - 1){ hiIdx++; acc += bins[hiIdx]; }
      else if (loIdx > 0){ loIdx--; acc += bins[loIdx]; }
      else break;
    }
    return {
      poc: lo + (pocIdx + 0.5) * step,
      val: lo + loIdx * step,
      vah: lo + (hiIdx + 1) * step,
      approx: true
    };
  }

  /* VALUE-AREA REJECTION: bar tags VAH/VAL and closes back inside. Pure. */
  function hgOmniValueReject(rows, prof){
    if (!rows || !rows.length || !prof) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    if (l < prof.val && c > prof.val){
      return { kind:'VALUE', dir:'long', level: prof.val, why:'tagged value-area low and closed back inside' };
    }
    if (h > prof.vah && c < prof.vah){
      return { kind:'VALUE', dir:'short', level: prof.vah, why:'tagged value-area high and closed back inside' };
    }
    return null;
  }

  /* MEASURED MOVE: impulse leg over `leg` bars, then a pullback of 30-70%
     of it. Projects the leg from the pullback low/high. Pure. */
  function hgOmniMeasuredMove(rows, leg){
    if (!rows || rows.length < (leg || 10) + 4) return null;
    var L = leg || 10;
    var seg = rows.slice(rows.length - L - 4, rows.length);
    var startC = num(seg[0].c), lastC = num(seg[seg.length - 1].c);
    if (!isFinite(startC) || !isFinite(lastC)) return null;
    var hi = -Infinity, lo = Infinity, i, h, l;
    for (i = 0; i < seg.length; i++){
      h = num(seg[i].h); l = num(seg[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var span = hi - lo;
    var atr = atrOf(rows, 14);
    if (!isFinite(atr) || span < atr * 2) return null;      // needs a real leg
    if (lastC > startC){
      var rt = (hi - lastC) / span;
      if (rt >= 0.3 && rt <= 0.7) return { kind:'MMOVE', dir:'long', level: lastC, projected: lastC + span, why:'impulse leg + ' + Math.round(rt*100) + '% pullback' };
    } else {
      var rt2 = (lastC - lo) / span;
      if (rt2 >= 0.3 && rt2 <= 0.7) return { kind:'MMOVE', dir:'short', level: lastC, projected: lastC - span, why:'impulse leg + ' + Math.round(rt2*100) + '% pullback' };
    }
    return null;
  }

  /* Run every detector; return all hits (a symbol can present more than one
     family, which is genuine confluence rather than a duplicate). Pure. */


  /* ============ cross-sectional: the one thing 530 contracts can say ============

     Every mechanic on this desk judges a contract ALONE. That is the same
     question a single-symbol tab asks, and the live pool says how it has gone:
     twenty-two price mechanics, roughly four thousand in-sample firings, and
     not one of them clears breakeven. A twenty-third candle formation is
     measurably not the missing piece.

     What a 530-contract sweep can say, and a single-symbol tab structurally
     cannot, is where THIS contract sits against every other one. Cross-
     sectional momentum is one of the few effects in crypto with support
     outside a backtest, and the tab already holds the bars needed to measure
     it — pass 1 fetches every contract and throws away everything that did
     not fire. Keeping four numbers per symbol costs no network at all.

     These are FORWARD-ONLY, for the same reason the positioning mechanics
     are: the walk-forward replays one symbol's candles, and the cross-section
     at a past bar cannot be reconstructed from them. They earn an
     out-of-sample record and say so. */

  /* Four numbers per contract, taken from bars already in hand. */
  function hgOmniXsSummary(sym, rows){
    if (!sym || !rows || rows.length < 61) return null;
    var n = rows.length - 1;
    var c = num(rows[n].c), c20 = num(rows[n - 20].c), c60 = num(rows[n - 60].c);
    if (!isFinite(c) || !isFinite(c20) || !isFinite(c60) || !(c20 > 0) || !(c60 > 0)) return null;
    return { sym: String(sym), ret20: (c - c20) / c20, ret60: (c - c60) / c60, last: c };
  }

  /* Percentile rank of every contract against the universe, plus the breadth
     of the sweep. Pure: summaries in, ranks out. */
  function hgOmniXsRanks(summaries){
    if (!summaries || !summaries.length) return null;
    var clean = [], i;
    for (i = 0; i < summaries.length; i++){
      if (summaries[i] && isFinite(summaries[i].ret20)) clean.push(summaries[i]);
    }
    /* Under about thirty names a percentile is not a percentile, it is a
       rounding of a handful of numbers. Refuse rather than mislead. */
    if (clean.length < 30) return null;
    var sorted = clean.slice().sort(function(a, b){ return a.ret20 - b.ret20; });
    var rank = {}, up = 0;
    for (i = 0; i < sorted.length; i++){
      rank[sorted[i].sym] = sorted.length > 1 ? (i / (sorted.length - 1)) : 0.5;
      if (sorted[i].ret20 > 0) up++;
    }
    var mid = sorted[Math.floor(sorted.length / 2)];
    return { rank: rank, n: sorted.length, breadthUp: up / sorted.length,
             medianRet20: mid ? mid.ret20 : NaN };
  }

  /* Cross-sectional momentum. Top of the universe and still going is the
     documented effect; the EMA check is there so this is not simply buying
     whatever has already run furthest. */
  function hgOmniXsLeader(rows, xs, sym){
    if (!rows || rows.length < 60 || !xs || !xs.rank) return null;
    var r = xs.rank[String(sym)];
    if (!isFinite(r)) return null;
    var closes = [], i;
    for (i = 0; i < rows.length; i++){ var cv = num(rows[i].c); if (isFinite(cv)) closes.push(cv); }
    if (closes.length < 60) return null;
    var e21 = emaOf(closes.slice(-60), 21);
    var last = closes[closes.length - 1];
    if (!isFinite(e21) || !isFinite(last)) return null;
    /* State the percentile, not "top N%": at the very top that arithmetic
       renders "top 0%", which reads as none of them. */
    var pct = ordinal(r * 100);
    if (r >= 0.9 && last > e21){
      return { kind:'XS-LEADER', dir:'long', level: last,
               why:'ranks ' + pct + ' percentile of ' + xs.n
                   + ' contracts by 20-bar return, and still above its 21-EMA' };
    }
    if (r <= 0.1 && last < e21){
      return { kind:'XS-LAGGARD', dir:'short', level: last,
               why:'ranks ' + pct + ' percentile of ' + xs.n
                   + ' contracts by 20-bar return, and still below its 21-EMA' };
    }
    return null;
  }

  /* ============ crypto-native mechanics ============

     These three cannot exist on spot gold: there is no funding rate, no open
     interest and no perpetual basis on a metal. They are the reason this desk
     is not just the gold desk pointed at BTC, and they read positioning
     rather than price — which is the only genuinely new information a
     seventeenth price pattern would not give.

     Each takes the SAME positioning object the perp gates already receive, so
     there is no new fetch: pass 2 already has funding, OI, taker flow and
     depth in hand for every fired contract. */

  /* Funding paid by one side for long enough, at a high enough rate, is a
     crowd paying rent to stay wrong. The squeeze is against the payer. */
  function hgOmniFundingSqueeze(rows, positioning){
    if (!rows || rows.length < 20 || !positioning) return null;
    var rate = fin(positioning.fundingPct);
    if (!isFinite(rate)) rate = fin(positioning.funding && positioning.funding.rate);
    if (!isFinite(rate) || rate === 0) return null;
    /* 0.05% per 8h is roughly 55% a year — a real cost, not a rounding. */
    var EXTREME = 0.05;
    if (Math.abs(rate) < EXTREME) return null;
    var n = rows.length - 1;
    var c = num(rows[n].c), pc = num(rows[n - 1].c);
    if (!isFinite(c) || !isFinite(pc)) return null;
    /* Only when price has STOPPED going the payer's way: funding alone is a
       cost, funding plus a stall is a squeeze setup. */
    if (rate > 0 && c < pc){
      return { kind:'FUND-SQUEEZE', dir:'short', level: c,
               why:'longs paying ' + rate.toFixed(3) + '% funding while price rolls over' };
    }
    if (rate < 0 && c > pc){
      return { kind:'FUND-SQUEEZE', dir:'long', level: c,
               why:'shorts paying ' + Math.abs(rate).toFixed(3) + '% funding while price turns up' };
    }
    return null;
  }

  /* Price up on FALLING open interest is short covering, not new buying: the
     move is fuelled by exits and has no one left to carry it. Price up on
     rising OI is real. The divergence is the signal. */
  function hgOmniOiDiverge(rows, positioning){
    if (!rows || rows.length < 20 || !positioning) return null;
    var oiPct = fin(positioning.oi && positioning.oi.changePct);
    if (!isFinite(oiPct)) oiPct = fin(positioning.oiChangePct);
    if (!isFinite(oiPct)) return null;
    if (Math.abs(oiPct) < 5) return null;              /* a real change in the book */
    var n = rows.length - 1;
    var look = Math.min(6, n);
    var c = num(rows[n].c), was = num(rows[n - look].c);
    if (!isFinite(c) || !isFinite(was) || !(was > 0)) return null;
    var movePct = (c - was) / was * 100;
    if (Math.abs(movePct) < 1) return null;            /* price has to have moved */
    if (movePct > 0 && oiPct < 0){
      return { kind:'OI-DIVERGE', dir:'short', level: c,
               why:'price +' + movePct.toFixed(1) + '% on ' + oiPct.toFixed(1)
                   + '% open interest — short covering, not new buying' };
    }
    if (movePct < 0 && oiPct < 0){
      return { kind:'OI-DIVERGE', dir:'long', level: c,
               why:'price ' + movePct.toFixed(1) + '% on ' + oiPct.toFixed(1)
                   + '% open interest — long liquidation exhausting, not new selling' };
    }
    return null;
  }

  /* Taker flow against the price move. Aggressive sellers hitting bids while
     price holds up means someone large is absorbing them, and vice versa. */
  function hgOmniFlowAbsorb(rows, positioning){
    if (!rows || rows.length < 20 || !positioning) return null;
    var ratio = fin(positioning.taker && positioning.taker.buySellRatio);
    if (!isFinite(ratio)) ratio = fin(positioning.takerRatio);
    if (!isFinite(ratio) || !(ratio > 0)) return null;
    var n = rows.length - 1;
    var look = Math.min(6, n);
    var c = num(rows[n].c), was = num(rows[n - look].c);
    if (!isFinite(c) || !isFinite(was) || !(was > 0)) return null;
    var movePct = (c - was) / was * 100;
    /* Sellers dominant but price refuses to fall = absorption under it. */
    if (ratio <= 0.8 && movePct >= -0.5 && movePct <= 1.5){
      return { kind:'FLOW-ABSORB', dir:'long', level: c,
               why:'takers ' + ratio.toFixed(2) + ' buy/sell (sellers dominant) yet price is holding — absorbed' };
    }
    if (ratio >= 1.25 && movePct <= 0.5 && movePct >= -1.5){
      return { kind:'FLOW-ABSORB', dir:'short', level: c,
               why:'takers ' + ratio.toFixed(2) + ' buy/sell (buyers dominant) yet price is capped — distributed into' };
    }
    return null;
  }

  function hgOmniDetect(rows, positioning, xs, sym){
    var out = [];
    if (!rows || rows.length < 30) return out;
    /* The shared, instrument-agnostic mechanics. Feature-checked: without
       hg-mechanics.js these simply do not fire, which shows in the pooled
       table, rather than throwing the scan. */
    var runAll = (typeof window !== 'undefined' && typeof window.hgMechRunAll === 'function')
      ? window.hgMechRunAll : null;
    if (runAll){
      try {
        var shared = runAll(rows) || [];
        for (var si = 0; si < shared.length; si++) out.push(shared[si]);
      } catch (eS) { /* one bad detector must not cost the scan */ }
    }
    /* Positioning mechanics, only where positioning exists. See the note on
       OMNI_FWD_ONLY: these can never be back-tested, because the walk-forward
       replays candles and there is no historical funding or open interest to
       replay with them. They earn a forward record and nothing else, and the
       pooled table says so rather than showing them as never having fired. */
    if (positioning){
      var pd;
      pd = hgOmniFundingSqueeze(rows, positioning); if (pd) out.push(pd);
      pd = hgOmniOiDiverge(rows, positioning);      if (pd) out.push(pd);
      pd = hgOmniFlowAbsorb(rows, positioning);     if (pd) out.push(pd);
    }
    /* Cross-sectional: needs the whole sweep, so it only runs where the
       universe ranks were computed. Forward-only, like the positioning
       mechanics — a past bar's cross-section cannot be replayed from one
       symbol's candles. */
    if (xs){
      var xd = hgOmniXsLeader(rows, xs, sym);
      if (xd) out.push(xd);
    }
    var rng = hgOmniRange(rows, RANGE_LOOKBACK);
    var prof = hgOmniProfile(rows, 24);
    var d;
    if (rng){
      d = hgOmniSpring(rows, rng); if (d) out.push(d);
      d = hgOmniAbsorb(rows, rng); if (d) out.push(d);
    }
    d = hgOmniPo3(rows, 6); if (d) out.push(d);
    d = hgOmniOrb(rows, ORB_BARS); if (d) out.push(d);
    if (prof){ d = hgOmniValueReject(rows, prof); if (d) out.push(d); }
    d = hgOmniMeasuredMove(rows, 10); if (d) out.push(d);
    return out;
  }

  /* ============ pure: higher timeframe by resampling ============ */

  /* 4h -> 1d without a second network call: 180 4h bars is 30 daily bars,
     and the venue legs are the expensive part of a scan. Buckets by UTC day
     from the bar-open seconds xuCandles guarantees. Pure. */
  function hgOmniResample(rows, secPerBucket){
    if (!rows || !rows.length) return [];
    var per = secPerBucket || 86400, out = [], cur = null, i, r, t, key;
    for (i = 0; i < rows.length; i++){
      r = rows[i]; t = num(r.t);
      if (!isFinite(t)) continue;
      key = Math.floor(t / per) * per;
      if (!cur || cur.t !== key){
        if (cur) out.push(cur);
        cur = { t: key, o: num(r.o), h: num(r.h), l: num(r.l), c: num(r.c), v: num(r.v) || 0 };
      } else {
        if (num(r.h) > cur.h) cur.h = num(r.h);
        if (num(r.l) < cur.l) cur.l = num(r.l);
        cur.c = num(r.c);
        cur.v += (num(r.v) || 0);
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  /* ============ pure: self-measurement (walk-forward) ============ */

  /* Simple structural stop for the backtest: the extreme of the last
     `look` bars on the wrong side of entry, else an ATR fallback. Kept
     independent of hgPlanLevels so the measurement is reproducible in a
     bare test runner and cannot drift with UI plan policy. Pure. */
  function hgOmniBtStop(dir, rows, idx, look){
    var lo = Infinity, hi = -Infinity, i, h, l;
    for (i = Math.max(0, idx - (look || 10)); i <= idx; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    var entry = num(rows[idx].c);
    if (!isFinite(entry)) return NaN;
    var stop = (dir === 'long') ? lo : hi;
    if (!isFinite(stop) || (dir === 'long' ? stop >= entry : stop <= entry)){
      var atr = atrOf(rows.slice(0, idx + 1), 14);
      if (!isFinite(atr) || atr <= 0) return NaN;
      stop = (dir === 'long') ? entry - atr * 1.5 : entry + atr * 1.5;
    }
    return stop;
  }

  /* Walk one historical signal forward and report which side paid first.
     INTRABAR AMBIGUITY: when a single bar's range spans BOTH the stop and
     the target we count it a STOP. Candle data cannot say which printed
     first, and the optimistic reading is exactly how backtests come out
     flattering. This makes the measured rate a floor, not a best case.
     Returns 't1' | 'stop' | 'open' (never resolved inside horizon). Pure. */
  function hgOmniWalkForward(rows, idx, dir, rMult, horizon, detail){
    var entry = num(rows[idx].c);
    var stop = hgOmniBtStop(dir, rows, idx, 10);
    if (!isFinite(entry) || !isFinite(stop)) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var tgt = (dir === 'long') ? entry + rMult * risk : entry - rMult * risk;
    var end = Math.min(rows.length - 1, idx + (horizon || 20)), i, h, l;
    for (i = idx + 1; i <= end; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(h) || !isFinite(l)) continue;
      var hitStop = (dir === 'long') ? (l <= stop) : (h >= stop);
      var hitT1   = (dir === 'long') ? (h >= tgt)  : (l <= tgt);
      if (hitStop && hitT1) return detail ? { res:'stop', at:i } : 'stop';   // conservative
      if (hitStop) return detail ? { res:'stop', at:i } : 'stop';
      if (hitT1) return detail ? { res:'t1', at:i } : 't1';
    }
    return detail ? { res:'open', at:end } : 'open';
  }

  /* Replay ONE detector across the fetched history and measure it.
     detectFn(prefixRows) -> hit|null, exactly the live detectors' shape, so
     what is measured is what is traded. Pure given rows. */
  function hgOmniBacktestOne(rows, detectFn, opts){
    opts = opts || {};
    var rMult = opts.rMult || MIN_RR, horizon = opts.horizon || 20;
    var warm = opts.warm || 45;
    var wins = 0, losses = 0, open = 0, i, hit, r;
    if (!rows || rows.length < warm + horizon + 2) return null;
    /* NON-OVERLAPPING trades. Advancing one bar at a time counted a mechanic
       that fires on 20 consecutive bars of ONE move as 20 samples sharing a
       single outcome — measured on synthetic data, 94% of firings overlapped
       the previous one's forward window, and the resulting sigma was
       inflated 3-4x (1.38 counted vs 0.39 independent). Since the
       measured-edge gate is a significance test, that inflation was the
       difference between "has paid" and "within noise".
       After a signal resolves, scanning resumes AFTER its resolution bar, so
       every counted sample is a trade that could actually have been taken
       sequentially by one account. */
    for (i = warm; i < rows.length - horizon; i++){
      try { hit = detectFn(rows.slice(0, i + 1)); } catch (e) { hit = null; }
      if (!hit) continue;
      r = hgOmniWalkForward(rows, i, hit.dir, rMult, horizon, true);
      if (!r) continue;
      if (r.res === 't1') wins++;
      else if (r.res === 'stop') losses++;
      else open++;
      /* FIXED cooldown, not "skip to where it resolved". Resolution depends on
         future bars, so resuming at r.at would make the sample SET
         future-dependent — the signal would still be clean, but which bars got
         sampled would not be. Deterministic beats squeezing out extra samples. */
      i += horizon;
    }
    var settled = wins + losses;
    if (!settled) return { samples: 0, wins: 0, losses: 0, open: open, hit: NaN, expR: NaN };
    var hitRate = wins / settled;
    /* expectancy per unit risk at this R multiple */
    var expR = hitRate * rMult - (1 - hitRate) * 1;
    return { samples: settled, wins: wins, losses: losses, open: open, hit: hitRate, expR: expR };
  }

  /* Measure every detector family on this symbol's own history. Pure. */
  function hgOmniBacktestAll(rows, opts){
    var out = {};
    var fns = {
      SPRING: function(r){ var g = hgOmniRange(r, RANGE_LOOKBACK); return g ? hgOmniSpring(r, g) : null; },
      PO3:    function(r){ return hgOmniPo3(r, 6); },
      ORB:    function(r){ return hgOmniOrb(r, ORB_BARS); },
      ABSORB: function(r){ var g = hgOmniRange(r, RANGE_LOOKBACK); return g ? hgOmniAbsorb(r, g) : null; },
      VALUE:  function(r){ var p = hgOmniProfile(r, 24); return p ? hgOmniValueReject(r, p) : null; },
      MMOVE:  function(r){ return hgOmniMeasuredMove(r, 10); }
    };
    /* The shared mechanics are pure functions of rows, so they backtest
       exactly like the six above. Registered by the SAME kind string the
       detect pass emits, or the in-sample pool and the live scan would be
       measuring different things under one name. */
    var mw = (typeof window !== 'undefined') ? window : null;
    function shared(fnName, kind){
      var f = mw && typeof mw[fnName] === 'function' ? mw[fnName] : null;
      if (!f) return null;
      return function(r){ var h = null; try { h = f(r); } catch (e) { h = null; }
                          return (h && (!kind || h.kind === kind)) ? h : null; };
    }
    var SHARED = [
      ['hgMechVwapRevert','VWAP-REVERT'], ['hgMechNr7Break','NR7-BREAK'],
      ['hgMechTrendReclaim','TREND-RECLAIM'], ['hgMechFvgFill','FVG-FILL'],
      ['hgMechBosRetest','BOS-RETEST'], ['hgMechPoolSweep','EQH-SWEEP'],
      ['hgMechPoolSweep','EQL-SWEEP'], ['hgMechSqueezeFire','SQUEEZE-FIRE'],
      ['hgMechRsiDiverge','RSI-DIVERGE'], ['hgMechAvwapReclaim','AVWAP-RECLAIM'],
      ['hgMechCusumShift','CUSUM-SHIFT'], ['hgMechVolExpansion','VOL-EXPANSION'],
      ['hgMechPinReject','PIN-REJECT'], ['hgMechEngulfLevel','ENGULF-LEVEL'],
      ['hgMechPocRevert','POC-REVERT'], ['hgMechThreeBar','THREE-BAR']
    ];
    for (var sh = 0; sh < SHARED.length; sh++){
      var fn = shared(SHARED[sh][0], SHARED[sh][1]);
      if (fn) fns[SHARED[sh][1]] = fn;
    }
    var k;
    for (k in fns) if (Object.prototype.hasOwnProperty.call(fns, k)){
      out[k] = hgOmniBacktestOne(rows, fns[k], opts);
    }
    return out;
  }

  /* Pool per-detector stats across every symbol scanned. A single symbol
     yields far too few samples to trust; the pooled number is the one worth
     reading, and both are shown so a thin pool is visible. Pure. */
  function hgOmniPoolStats(perSymbol){
    var pool = {}, i, k, s;
    for (i = 0; i < (perSymbol || []).length; i++){
      for (k in perSymbol[i]) if (Object.prototype.hasOwnProperty.call(perSymbol[i], k)){
        s = perSymbol[i][k];
        if (!s) continue;
        if (!pool[k]) pool[k] = { samples:0, wins:0, losses:0, open:0 };
        pool[k].samples += s.samples; pool[k].wins += s.wins;
        pool[k].losses += s.losses; pool[k].open += s.open;
      }
    }
    for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)){
      var p = pool[k];
      p.hit = p.samples ? (p.wins / p.samples) : NaN;
      p.expR = p.samples ? (p.hit * MIN_RR - (1 - p.hit)) : NaN;
    }
    return pool;
  }

  /* Daily EMA pair resampled from the intraday series. No network: 180 x 4h
     is ~31 daily bars, so periods must be ones that history supports (a
     50-period daily EMA silently returned NaN and disabled the gate). Pure. */
  function hgOmniDailyHtf(rows){
    var d1 = hgOmniResample(rows, 86400);
    if (!d1 || d1.length < DAILY_SLOW + 2) return null;
    var dc = closesOf(d1);
    var e21 = emaOf(dc.slice(-(DAILY_FAST * 2)), DAILY_FAST), e50 = emaOf(dc, DAILY_SLOW);
    if (!isFinite(e21) || !isFinite(e50)) return null;
    return { e21: e21, e50: e50, bars: d1.length };
  }

  /* Crypto regime from BTC's own daily trend. PURE given rows.
     Why this exists: regime.js runs an 8-gauge scan (CoinGecko, DeFiLlama,
     alternative.me, macro) and in the field its headless warm returned
     "unavailable: every gauge source failed" on every scan, leaving the gate
     permanently UNCHECKED. Rather than depend on eight third-party sources
     that demonstrably do not all resolve in this browser, derive the read
     that actually matters for alt perps — what BTC is doing — from Binance
     klines, an endpoint this very scan already proves reachable (OI, taker
     and depth all resolve against it).
     Deliberately narrower than regime.js: this is BTC trend only, so it is
     used as a FALLBACK and labelled as such, never presented as the full
     8-gauge verdict. */
  function hgOmniBtcRegime(dailyRows){
    if (!dailyRows || dailyRows.length < DAILY_SLOW + 2) return null;
    var c = closesOf(dailyRows);
    var fast = emaOf(c.slice(-(DAILY_FAST * 2)), DAILY_FAST), slow = emaOf(c, DAILY_SLOW);
    var last = c.length ? c[c.length - 1] : NaN;
    if (!isFinite(fast) || !isFinite(slow) || !isFinite(last)) return null;
    var up = fast >= slow && last >= slow;
    var down = fast < slow && last < slow;
    return {
      label: up ? 'RISK-ON' : (down ? 'RISK-OFF' : 'MIXED'),
      source: 'btc-daily-proxy',
      detail: 'BTC daily EMA' + DAILY_FAST + (fast >= slow ? ' ≥ ' : ' < ') + 'EMA' + DAILY_SLOW
    };
  }

  /* ==================== pure: the gate ledger ==================== */

  /* Each gate returns {key, hard, pass, why}. pass:null means UNKNOWN — the
     venue did not report the input.
       hard:true   computable from candles alone, so it is available on BOTH
                   venues. Must be an explicit pass; unknown blocks.
       hard:false  CONDITIONAL — vetoes when it can be evaluated and fails,
                   but an unevaluable one does not disqualify the setup. This
                   is the difference between "degrade honestly" and "punish
                   the venue for its API": CoinDCX publishes no funding, so a
                   blocking funding gate would mean CoinDCX could never
                   produce a ticket at all. The card still shows the check
                   did not run, so nobody mistakes silence for a pass. */
  /* Every mechanic this desk measures. ONE list: renderPooled shows these and
     the measured-edge bar divides its significance threshold by this many, so
     the multiple-comparisons correction cannot drift out of step with the
     number of mechanics actually being tried. UTAD is deliberately absent —
     it is measured under SPRING, so it is not a separate test. */
  /* Backtestable mechanics: pure functions of rows, so the walk-forward can
     replay them and the pooled table can show an in-sample record. */
  var OMNI_MECHANICS = ['SPRING','PO3','ORB','ABSORB','VALUE','MMOVE',
                        'VWAP-REVERT','NR7-BREAK','TREND-RECLAIM','FVG-FILL','BOS-RETEST',
                        'EQH-SWEEP','EQL-SWEEP','SQUEEZE-FIRE','RSI-DIVERGE','AVWAP-RECLAIM',
                        'CUSUM-SHIFT','VOL-EXPANSION','PIN-REJECT','ENGULF-LEVEL',
                        'POC-REVERT','THREE-BAR'];

  /* FORWARD-ONLY mechanics. These read positioning, and the walk-forward
     replays candles — there is no historical funding rate or open interest
     stored anywhere in the app to replay alongside them. They therefore
     CANNOT earn an in-sample record, ever.

     That is stated rather than hidden: the pooled table shows them as
     forward-only instead of "never fired here", which would read as a broken
     detector rather than an un-backtestable one. They still accumulate an
     out-of-sample record from their first firing, which is the number that
     matters anyway.

     They DO count toward the significance bar below. A search is a search
     whether or not it can be replayed, and leaving them out would understate
     how many ways this desk is looking. */
  var OMNI_FWD_ONLY = ['FUND-SQUEEZE','OI-DIVERGE','FLOW-ABSORB','XS-LEADER','XS-LAGGARD'];
  var OMNI_ALL_MECHANICS = OMNI_MECHANICS.concat(OMNI_FWD_ONLY);

  /* Mechanic families, for the consensus gate. Mechanics that read the same
     thing about the tape count once between them: SPRING and UTAD are one
     idea seen from either side of a range, and treating them as two
     independent confirmations would manufacture agreement out of redundancy. */
  var OMNI_FAMILY = {
    'SPRING':'SWEEP', 'UTAD':'SWEEP',
    'ORB':'TREND', 'MMOVE':'TREND', 'PO3':'TREND',
    'VALUE':'REVERSION', 'ABSORB':'REVERSION',
    /* Positioning is its own family. Funding, open interest and taker flow
       all read the same thing — what the crowd is carrying — so they agree
       with each other by construction and must count once between them. */
    'FUND-SQUEEZE':'POSITIONING', 'OI-DIVERGE':'POSITIONING', 'FLOW-ABSORB':'POSITIONING',
    /* Cross-sectional is its own family: it reads the contract against the
       universe, which no price mechanic on this ledger looks at. */
    'XS-LEADER':'CROSS-SECTIONAL', 'XS-LAGGARD':'CROSS-SECTIONAL'
  };
  /* The shared mechanics bring their own family map. Merged rather than
     retyped, so a kind cannot be classified one way here and another there. */
  (function(){
    var m = (typeof window !== 'undefined') ? window.HG_MECH_FAMILY : null;
    if (!m) return;
    for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k) && !OMNI_FAMILY[k]) OMNI_FAMILY[k] = m[k];
  })();
  function hgOmniFamilyOf(kind){ return OMNI_FAMILY[String(kind || '')] || 'OTHER'; }

  /* Standard normal CDF (Abramowitz & Stegun 26.2.17), inlined so a piece of
     pure arithmetic can never read "unavailable" because a script did not
     load. */
  function hgOmniNormCdf(z){
    if (!isFinite(z)) return NaN;
    var sgn = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sgn * y);
  }

  /* THE MULTIPLE-COMPARISONS BAR.

     This desk reports whichever of its mechanics looks best. Judging each
     against a lone 5% threshold answers the wrong question: with six
     mechanics tried, the best of them clears +1.6σ by chance most of the
     time. Sidak gives the per-mechanic threshold that holds the FAMILY-wise
     false positive rate at 5% across k tries.

     At six mechanics the bar is +2.44σ, not +1.64σ. On a 2R floor at 41
     samples that is the difference between needing a 45.4% hit rate and a
     51.3% one — and the gate was passing the first. */
  function hgOmniFamilyZ(k){
    var n = Math.floor(fin(k));
    if (!isFinite(n) || n < 1) n = 1;
    var target = Math.pow(0.95, 1 / n);
    var lo = 0, hi = 8, mid, i;
    for (i = 0; i < 64; i++){
      mid = (lo + hi) / 2;
      if (hgOmniNormCdf(mid) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* Families voting each way on this bar. A family that fires BOTH ways is
     internally divided and counts for NEITHER side — putting it on both
     inflates each count and manufactures ties out of a family that simply has
     no opinion. */
  function hgOmniConsensus(allHits, hit){
    if (!allHits || !allHits.length || !hit) return null;
    var seen = {}, i, h, fam, k;
    for (i = 0; i < allHits.length; i++){
      h = allHits[i];
      if (!h || !h.kind || (h.dir !== 'long' && h.dir !== 'short')) continue;
      fam = hgOmniFamilyOf(h.kind);
      if (!seen[fam]) seen[fam] = { mine: false, theirs: false };
      if (h.dir === hit.dir) seen[fam].mine = true; else seen[fam].theirs = true;
    }
    var agree = [], against = [], split = [];
    for (k in seen){
      if (!Object.prototype.hasOwnProperty.call(seen, k)) continue;
      if (seen[k].mine && seen[k].theirs) split.push(k);
      else if (seen[k].mine) agree.push(k);
      else against.push(k);
    }
    return { agree: agree.sort(), against: against.sort(), split: split.sort(),
             nAgree: agree.length, nAgainst: against.length, nSplit: split.length };
  }

  function hgOmniGates(rows, hit, positioning, extra){
    /* One reason string for every gate that depends on pass-2 enrichment,
       declared FIRST because the funding gate runs before `x` is assigned and
       a hoisted var read there is undefined — which is exactly what it did.

       A contract past the measurement ceiling has NOT been shown to lack the
       data; it was never asked. Saying "not published for this contract"
       there blames the venue for a decision this tab made. */
    var NOT_MEASURED = 'not measured — this contract was past the per-symbol confluence ceiling, so it was never requested';
    var wasEnriched = !(extra && extra.enriched === false);
    /* THREE reasons a perp read can be missing, and they are different facts:
         - never asked (past the confluence ceiling)
         - asked, but Binance is unreachable from this browser AND the proxy
         - asked and answered, and the venue genuinely publishes nothing
       Reporting the second as the third blames a venue for a geo-block. */
    var binVia = null;
    try {
      var bw = (typeof window !== 'undefined') ? window : null;
      if (bw && typeof bw.hgBinanceVia === 'function') binVia = bw.hgBinanceVia();
    } catch (eBv) { binVia = null; }
    var BIN_BLOCKED = (binVia === 'blocked');
    function perpWhy(genuine){
      if (!wasEnriched) return NOT_MEASURED;
      if (BIN_BLOCKED) return 'Binance is unreachable from this browser and via the proxy — not a statement about this contract';
      return genuine;
    }
    var gates = [];
    var closes = closesOf(rows);
    var e21 = emaOf(closes.slice(-60), 21), e50 = emaOf(closes.slice(-120), 50);
    var last = closes.length ? closes[closes.length - 1] : NaN;

    /* 1 — trend alignment, applied ACCORDING TO THE SETUP'S NATURE.
       Vetoing a counter-trend setup for being counter-trend is a category
       error, and it silenced the tab: SPRING is a failed breakdown, which by
       construction occurs in a downtrend, so 'EMA21 < EMA50 — against the
       setup' vetoed essentially every reversion card while claiming they had
       failed a quality check. They had not; they were being graded against
       the wrong model.
         CONTINUATION families (PO3, ORB, MMOVE) trade with the trend, so
       disagreement is a genuine hard veto.
         REVERSION families (SPRING, UTAD, VALUE, ABSORB) trade against it.
       For those the stack is reported as context and never vetoes. */
    /* PLAN-LEVELS — a TICKET with nothing to place is not a ticket.

       The desk's single ticket read:

         GOLD · SCALP · AVWAP-RECLAIM LONG   TICKET 29/32 checks
         no plan — structure could not clear the R floor, so no levels are shown.
         UNCHECKED cost-drag    no plan risk to cost
         UNCHECKED stop-width   no plan yet — stop width cannot be judged

       The plan engine had returned null, the card said so plainly, and the
       ledger graded it TICKET anyway. Nothing in thirty-two gates asked
       whether there was a trade to take. cost-drag and stop-width both
       noticed and both are soft, so their UNCHECKED could not block it.

       A ticket is the desk saying "this cleared, act on it". With no entry,
       no stop and no target there is nothing to act on, and calling it a
       ticket is the worst thing this ledger can do: every other veto tells
       you why to stand aside, and this one invited you in with no levels.

       THREE STATES, deliberately:
         plan present and complete -> PASS
         plan explicitly null      -> VETO. The engine ran and produced
                                      nothing; that is a decision, not a gap.
         no plan key at all        -> UNCHECKED and soft. The caller never
                                      offered one, so this gate has nothing to
                                      judge and must not invent a veto. */
    var plHas = !!(x && Object.prototype.hasOwnProperty.call(x, 'plan'));
    var plObj = plHas ? x.plan : undefined;
    var plOk = null, plWhy = 'no plan supplied to the ledger — not judged here';
    if (plHas){
      if (!plObj){
        plOk = false;
        plWhy = 'NO LEVELS — the plan engine produced no entry, stop or target, '
              + 'so there is nothing to place';
      } else {
        var pE = fin(plObj.entry), pS = fin(plObj.stop), pT = fin(plObj.t1);
        if (isFinite(pE) && isFinite(pS) && isFinite(pT) && pE !== pS){
          plOk = true;
          plWhy = 'entry, stop and target all present';
        } else {
          plOk = false;
          plWhy = 'INCOMPLETE LEVELS — '
                + (!isFinite(pE) ? 'no entry' : !isFinite(pS) ? 'no stop'
                   : !isFinite(pT) ? 'no target' : 'entry equals stop')
                + ', so there is nothing to place';
        }
      }
    }
    gates.push({ key:'plan-levels', hard:false, pass: plOk, why: plWhy });

    var reversion = REVERSION_KINDS[hit.kind] === true;
    var trendOk = null, trendWhy = 'EMA unavailable';
    if (isFinite(e21) && isFinite(e50) && isFinite(last)){
      var up = e21 >= e50;
      var agrees = (hit.dir === 'long') ? up : !up;
      if (reversion){
        trendOk = true;   // context only
        trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50 — '
                 + (agrees ? 'trend agrees' : 'counter-trend, which is what this setup IS')
                 + ' (context only for a reversion setup)';
      } else {
        trendOk = agrees;
        trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50' + (agrees ? ' — with the setup' : ' — against the setup');
      }
    }
    gates.push({ key:'trend', hard: !reversion, pass: trendOk, why: trendWhy });

    /* 2 — volatility alive: a dead tape cannot pay a 2R target */
    var atr = atrOf(rows, 14), atrPct = (isFinite(atr) && isFinite(last) && last > 0) ? (atr / last * 100) : NaN;
    var volOk = isFinite(atrPct) ? (atrPct >= 0.35) : null;
    gates.push({ key:'vol-alive', hard:true, pass: volOk,
      why: isFinite(atrPct) ? ('ATR ' + atrPct.toFixed(2) + '% of price' + (volOk ? '' : ' — too dead')) : 'ATR unavailable' });

    /* 3 — participation: the trigger bar should not be a volume vacuum */
    /* Same time-of-day correction as the gold desk, and for the same reason:
       a 20-bar mean on 4h bars spans three days and mixes the Asian and US
       sessions, so a quiet-hours bar is vetoed for being quiet-hours. fin,
       not num: +null is 0, which would score 0.00x and veto. */
    var lv = fin(rows[rows.length - 1].v);
    var slotV = hgSlotMeanVol(rows, 20);
    var usedSlot = isFinite(slotV.mean);
    var mv = usedSlot ? slotV.mean : meanVol(rows.slice(0, rows.length - 1), 20);
    var partOk = (isFinite(mv) && isFinite(lv) && mv > 0) ? (lv >= mv * 0.7) : null;
    gates.push({ key:'participation', hard:true, pass: partOk,
      why: (isFinite(mv) && isFinite(lv) && mv > 0) ? ('trigger vol ' + (lv/mv).toFixed(2) + '× 20-bar mean') : 'volume unavailable' });

    /* 4 — funding sanity: never add to the crowded side of an extreme.
       CoinDCX reports no funding, so this legitimately stays unknown. */
    var f = positioning ? fin(positioning.fundingPct) : NaN;
    var fundOk = null, fundWhy = perpWhy('funding not reported by venue');
    if (isFinite(f)){
      var crowded = (hit.dir === 'long' && f > 0.05) || (hit.dir === 'short' && f < -0.05);
      fundOk = !crowded;
      fundWhy = 'funding ' + f.toFixed(4) + '%' + (crowded ? ' — crowded on our side' : ' — not crowded');
    }
    gates.push({ key:'funding', hard:false, pass: fundOk, why: fundWhy });

    /* ---- CONDITIONAL confluence from free public data ----
       Everything below is optional context: present for names that trade on
       Binance (free, key-less endpoints) or when the app's own market-wide
       modules have run. Absent inputs read UNCHECKED and never block, so a
       CoinDCX-only listing is not punished for being absent from Binance. */
    var x = extra || {};

    /* 5 — daily-timeframe agreement, resampled from the same 4h bars */
    var d1 = null, d1Why = 'daily bars unavailable';
    var he21 = x.htf ? fin(x.htf.e21) : NaN, he50 = x.htf ? fin(x.htf.e50) : NaN;
    if (isFinite(he21) && isFinite(he50)){
      var upD = he21 >= he50;
      var dAgrees = (hit.dir === 'long') ? upD : !upD;
      /* Same reasoning as the 4h trend gate: a reversion setup is expected
         to disagree with the prevailing daily stack. */
      d1 = reversion ? true : dAgrees;
      d1Why = 'daily EMA21 ' + (upD ? '≥' : '<') + ' EMA50'
            + (reversion ? (dAgrees ? ' — agrees' : ' — counter-trend (expected for a reversion setup)')
                         : (dAgrees ? ' — agrees' : ' — disagrees with the setup'));
    }
    gates.push({ key:'htf-daily', hard:false, pass: d1, why: d1Why });

    /* 6 — open interest should BUILD into the move, not bleed out of it */
    var oi = null, oiWhy = perpWhy('OI not published for this contract');
    var oiCh = x.oi ? fin(x.oi.changePct) : NaN;
    if (isFinite(oiCh)){
      oi = oiCh > -3;              // collapsing OI = the move is being unwound
      oiWhy = 'OI ' + (oiCh >= 0 ? '+' : '') + oiCh.toFixed(1) + '% over the window'
            + (oi ? '' : ' — unwinding, not building');
    }
    gates.push({ key:'oi-build', hard:false, pass: oi, why: oiWhy });

    /* 7 — retail crowding as a CONTRARIAN read: when the retail account
       majority already sits on our side at an extreme, the fuel is spent. */
    var rc = null, rcWhy = perpWhy('retail long/short not published');
    var lp = x.retail ? fin(x.retail.longPct) : NaN;
    if (isFinite(lp)){
      var crowdedWithUs = (hit.dir === 'long' && lp >= 75) || (hit.dir === 'short' && lp <= 25);
      rc = !crowdedWithUs;
      rcWhy = 'retail ' + lp.toFixed(0) + '% long' + (crowdedWithUs ? ' — crowded on our side' : '');
    }
    gates.push({ key:'retail-contrarian', hard:false, pass: rc, why: rcWhy });

    /* 8 — taker aggression should not lean against the setup */
    var tk = null, tkWhy = perpWhy('taker flow not published');
    var br = x.taker ? fin(x.taker.buySellRatio) : NaN;
    if (isFinite(br)){
      tk = (hit.dir === 'long') ? (br >= 0.9) : (br <= 1.1);
      tkWhy = 'taker buy/sell ' + br.toFixed(2) + (tk ? '' : ' — aggression leans against us');
    }
    gates.push({ key:'taker-flow', hard:false, pass: tk, why: tkWhy });

    /* 9 — book depth vs the stop distance. A stop that sits inside the
       slippage envelope is not a stop, it is a donation. */
    /* Depth comes from BINANCE (binanceDepth on base+USDT), which is not the
       venue this contract trades on. That distinction matters more here than
       for the other Binance reads: OI, retail and taker are market-wide
       STATE, but book depth is about YOUR FILL, and CoinDCX/Delta books are
       typically far thinner than Binance's. The inference is only valid in
       one direction — if the deepest venue is thin the trade venue is
       certainly thin (a veto is sound), but a PASS says nothing about
       whether YOUR book can absorb the stop. The label now says so instead
       of implying the trade venue was measured. */
    var lq = null, lqWhy = perpWhy('reference order book not available for this contract');
    var dBid = x.depth ? fin(x.depth.bidUsd) : NaN, dAsk = x.depth ? fin(x.depth.askUsd) : NaN;
    var venue = String((x.exchange || '')).toLowerCase();
    var isBinanceVenue = venue === 'binance';
    if (isFinite(dBid) && isFinite(dAsk)){
      var side = (hit.dir === 'long') ? dBid : dAsk;
      lq = side >= 25000;                       // top-20 levels, USD notional
      lqWhy = (isBinanceVenue ? 'top-of-book ' : 'BINANCE reference top-of-book ')
            + Math.round(side).toLocaleString() + ' USD'
            + (lq ? (isBinanceVenue ? '' : ' — your ' + (venue || 'venue') + ' book was NOT measured and is likely thinner')
                  : ' — too thin even on Binance, slippage would eat the stop');
    }
    /* Key stays STABLE — it is an identifier that veto lists and any
       downstream consumer match on, so it must not vary with the payload.
       The venue caveat rides in `why` and in an explicit `source` field. */
    gates.push({ key:'book-depth', hard:false, pass: lq, why: lqWhy,
                 source: isBinanceVenue ? 'venue' : 'binance-reference' });

    /* 10 — market regime: do not buy dips in a risk-off tape */
    /* When the regime read is absent, say WHY. The scan warms regime.js's
       headless hook before sweeping, so "has not run" is no longer a
       sufficient explanation — if the warm ran and still produced nothing,
       that outcome is the useful information, not the absence. */
    var rg = null;
    var rgWhy = x.regimeWarm ? ('regime unavailable — warm reported: ' + x.regimeWarm)
                             : 'regime module has not run';
    var rgProxy = (x.regime && x.regime.source === 'btc-daily-proxy');
    if (x.regime && x.regime.label){
      var lbl = String(x.regime.label).toUpperCase();
      if (lbl.indexOf('RISK-ON') >= 0) { rg = (hit.dir === 'long'); }
      else if (lbl.indexOf('RISK-OFF') >= 0) { rg = (hit.dir === 'short'); }
      else rg = true;                            // neutral tape blocks nothing
      rgWhy = 'regime ' + x.regime.label
            + (rgProxy ? (' (BTC daily proxy — regime.js gauges unavailable' + (x.regime.detail ? '; ' + x.regime.detail : '') + ')') : '')
            + (rg ? '' : ' — against the setup side');
    }
    gates.push({ key:'regime', hard:false, pass: rg, why: rgWhy });

    /* 11 — event blackout: never open into a scheduled high-impact print */
    /* hgNewsRisk() returns {risk:'low', note:'news not loaded'} when the news
       module has never fetched — a DEFAULT, not a measurement. Reading that
       as PASS meant a card could claim "news risk low" while nothing had
       been checked, which is precisely the silent pass this ledger exists to
       prevent. An unloaded or errored module reads UNCHECKED. */
    /* Moved to hg-gates.js — the decision was byte-identical in both desks
       (2,730 chars, verbatim). It emptied BOTH tabs for days and the fix had
       to be written twice; that is what this module exists to stop. */
    var __nwG = ((typeof window !== 'undefined') ? window : null), __nw;
    if (__nwG && typeof __nwG.hgNewsGate === 'function'){
      __nw = __nwG.hgNewsGate(x.news);
    } else {
      /* hg-gates.js absent: UNCHECKED, never a quiet pass. */
      __nw = { pass: null, info: false, why: 'news gate module (hg-gates.js) not loaded' };
    }
    var nw = __nw.pass, nwWhy = __nw.why, nwInfo = __nw.info;
    gates.push({ key:'news-window', hard:false, info: nwInfo, pass: nw, why: nwWhy });

    /* 12 — measured edge: this detector's own pooled walk-forward result.
       Not a veto on thin evidence — under MIN_SAMPLES it stays UNCHECKED
       rather than pretending 3 trades mean anything. */
    var ed = null, edWhy = 'not yet measured', edInfo = false;
    var sExp = x.stats ? fin(x.stats.expR) : NaN;
    var sHit = x.stats ? fin(x.stats.hit) : NaN;
    var sN = x.stats ? fin(x.stats.samples) : NaN;
    if (isFinite(sExp) && isFinite(sHit) && isFinite(sN)){
      var stat = sN + ' samples · ' + (sHit * 100).toFixed(0) + '% T1-first · '
               + (sExp >= 0 ? '+' : '') + sExp.toFixed(2) + 'R';
      /* Significance, not a flat R threshold. A fixed cutoff ignores sample
         size, and got this exactly wrong on live data: SPRING at 26% over
         473 samples is 3.4 standard errors below the 33.3% breakeven for 2R
         — a real shortfall — yet -0.23R sat inside a -0.25R cutoff and was
         reported as "within noise". Meanwhile MMOVE at 33% over 2016 samples
         IS genuinely breakeven and must not be vetoed. Compare the observed
         T1-first rate against the breakeven rate for this R multiple,
         1/(1+R), in units of its own binomial standard error. */
      /* THE DESK'S OWN R FLOOR, NOT THE MODULE DEFAULT.

         The out-of-sample branch below already does this, and its comment
         says why: "a desk that supplies its own R floor (OMNIGOLD's 1.5R
         scalp) must be judged against ITS breakeven". The in-sample half
         above it was never given the same treatment, so the two halves of one
         gate could measure the same mechanic against two different breakevens
         and disagree on the same card.

         Dormant today — omniroute never sets ex.minRr, and the gold desk
         carries its own copy of this gate — which is exactly why it would
         have gone unnoticed. Anyone adding a second R floor to crypto (a 1.5R
         scalp horizon, say) would get a silently wrong significance bar: at
         1.5R breakeven is 40%, not 33.3%, so a losing detector would be
         measured against a bar it clears. */
      var edInRr = isFinite(fin(x.minRr)) && fin(x.minRr) > 0 ? fin(x.minRr) : MIN_RR;
      var pBreak = 1 / (1 + edInRr);
      var se = Math.sqrt(pBreak * (1 - pBreak) / Math.max(1, sN));
      var z = se > 0 ? ((sHit - pBreak) / se) : 0;
      /* two decimals: a z of -1.96 rendered as "-2.0sigma ... within noise"
         read as a contradiction against a -2 cutoff. */
      var zTxt = ' [' + (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ vs breakeven]';
      if (sN < MIN_SAMPLES){
        edWhy = 'only ' + sN + ' past samples — too few to judge';
      } else if (z <= EDGE_VETO_Z && sN >= EDGE_VETO_SAMPLES){
        /* Only a CLEARLY losing detector is vetoed. Earlier this vetoed on
           any expR <= 0, which silenced the whole tab: the measurement is
           in-sample over ~30 days, and a 2R system sitting near its 33%
           breakeven lands slightly negative on noise alone. Treating that
           as a veto is over-fitting a month of noise, and it produced a
           scanner that found setups and then refused every one of them.
           Marginal reads now PASS and say so — the number is still on the
           card, so a thin edge is visible rather than silently fatal. */
        ed = false;
        edWhy = stat + zTxt + ' — significantly below breakeven, this detector has not paid';
      } else if (z <= EDGE_VETO_Z){
        /* SIGNIFICANTLY NEGATIVE IS NOT A PASS.

           This branch showed a green PASS beside "-2.09 sigma vs breakeven"
           on the only ticket the gold desk was recommending, while the pool
           table three inches above read "has not paid" for the SAME mechanic
           on the SAME number. Two verdicts on one measurement: the table
           judges anything past MIN_SAMPLES (20), the gate refused to act
           under EDGE_VETO_SAMPLES (30), and the 20-29 window printed PASS.

           Being too thin to VETO on is not evidence of an edge, and the rest
           of this ledger is held to "unknown reads UNCHECKED, never PASS".
           So it stands the trade aside for nothing — info:true keeps it off
           the ticket's critical path — and reports AGAINST, which is what an
           adverse read the desk cannot act on actually is. */
        ed = false; edInfo = true;
        edWhy = stat + zTxt + ' — below breakeven; ' + sN + ' samples is under the '
              + EDGE_VETO_SAMPLES + ' this gate needs to veto on, so it counts AGAINST '
              + 'rather than standing the trade aside';
      } else if (z >= hgOmniFamilyZ(OMNI_ALL_MECHANICS.length)){
        ed = true;
        edWhy = stat + zTxt + ' — clears the ' + OMNI_ALL_MECHANICS.length
              + '-mechanic significance bar (+' + hgOmniFamilyZ(OMNI_ALL_MECHANICS.length).toFixed(2) + 'σ)';
      } else {
        /* UNCHECKED, not PASS. This desk reports whichever of its mechanics
           looks best, so a read that clears a lone 5% threshold but not the
           family-wise one is not a weak edge — it is what searching six ways
           looks like. The gate is soft, so the ticket still stands; what
           stops is the card claiming a measurement it has not got. */
        ed = null;
        edWhy = stat + zTxt + (z < 0 ? ' — below breakeven but within noise' : '')
              + ' · ' + OMNI_ALL_MECHANICS.length + ' mechanics scanned, so +'
              + hgOmniFamilyZ(OMNI_ALL_MECHANICS.length).toFixed(2)
              + 'σ is the bar before one this good means anything';
      }
      edWhy = 'in-sample ' + edWhy;
    }

    /* ---- OUT-OF-SAMPLE OVERRIDE ----------------------------------------

       Everything above is the walk-forward pool, re-read from the same window
       on every scan. It is the number this gate has always used, and on live
       data it passed a ticket reading

         'PASS measured-edge 41 samples · 51% T1-first · +0.54R [+1.47σ]'

       for ROUND-MAGNET, while the forward log for that same mechanic stood at
       0 wins in 5 settled trades. A gate that calls itself measured-edge
       cannot cite the number the forward log exists to distrust and ignore
       the forward log itself.

       Precedence, in order:
         - enough settled forward trades to judge -> the forward record IS the
           verdict, and a significant shortfall vetoes
         - some forward trades, too few to judge, but they CONTRADICT a
           positive in-sample read -> UNCHECKED, never PASS. The evidence is
           in conflict and the card must say so rather than quote the
           agreeable half
         - some forward trades that agree, or none at all -> in-sample stands,
           labelled as in-sample so it is never mistaken for realised results
    */
    var fwd = x.fwd || null;
    var fN = fwd ? fin(fwd.samples) : NaN;
    if (isFinite(fN) && fN > 0){
      var fHit = fin(fwd.hit);
      /* omniroute's in-sample z uses the module MIN_RR; a desk that supplies
         its own R floor (OMNIGOLD's 1.5R scalp) must be judged against ITS
         breakeven, not the module default. */
      var edMinRr = isFinite(fin(x.minRr)) && fin(x.minRr) > 0 ? fin(x.minRr) : MIN_RR;
      var fBreak = 1 / (1 + edMinRr);
      var fTxt = fN + ' settled out-of-sample · ' + (isFinite(fHit) ? (fHit * 100).toFixed(0) + '%' : '—') + ' T1-first';
      /* THE VETO USES THE TICKET-ONLY RECORD.

         The all-firings figure above is what the card reports, because it is
         the only one comparable with the in-sample pool. But standing a
         mechanic aside on it is circular: most firings are rejected by this
         very ledger, those rejects are recorded, they lose — and the mechanic
         is then condemned by trades the desk refused to take.

         So the veto asks the narrower question: when this ledger DID clear a
         setup, what happened? With too few cleared trades to judge, it does
         not veto at all — an unproven mechanic is unproven, not condemned. */
      var tix = fwd.ticketOnly;
      var tN = tix ? fin(tix.samples) : NaN;
      var tHit = tix ? fin(tix.hit) : NaN;
      var judgeN = (isFinite(tN) && tN >= FWD_MIN_JUDGE) ? tN : NaN;
      var judgeHit = isFinite(judgeN) ? tHit : NaN;

      if (isFinite(judgeN) && isFinite(judgeHit)){
        var fz = (judgeHit - fBreak) / Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / judgeN));
        var fzTxt = ' [' + (fz >= 0 ? '+' : '') + fz.toFixed(2) + 'σ vs breakeven]';
        var tixTxt = judgeN + ' settled TICKETS · ' + (judgeHit * 100).toFixed(0) + '% T1-first';
        if (fz <= EDGE_VETO_Z){
          ed = false;
          edWhy = tixTxt + fzTxt + ' — the trades this ledger actually cleared have not paid'
                + (fN > judgeN ? ' (of ' + fN + ' settled firings overall)' : '');
        } else {
          ed = true;
          edWhy = tixTxt + fzTxt + ' — measured out-of-sample on cleared setups';
        }
      } else if (fN >= FWD_MIN_JUDGE && isFinite(fHit)){
        /* Enough settled FIRINGS to describe, not enough cleared TICKETS to
           condemn. Report it and do not veto: this is the state the desk sits
           in for a long time after a mechanic is added. */
        var az = (fHit - fBreak) / Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / fN));
        ed = null;
        edWhy = fTxt + ' [' + (az >= 0 ? '+' : '') + az.toFixed(2) + 'σ vs breakeven]'
              + ' — but only ' + (isFinite(tN) ? tN : 0) + ' of those were setups this ledger cleared, '
              + 'too few to judge the mechanic on. Reported, not vetoed.';
      } else if (isFinite(fHit) && isFinite(z) && z > 0 && fHit < fBreak){
        /* The two disagree and neither is conclusive. Unknown reads
           UNCHECKED, never PASS — the same rule the rest of the ledger is
           held to. A conditional gate at null degrades the card without
           standing the trade aside. */
        ed = null;
        edWhy = fTxt + ' vs in-sample ' + stat + zTxt
              + ' — CONTRADICTORY: the walk-forward pool is positive while every settled '
              + 'out-of-sample trade has lost. Too few to judge either way, so this reads UNCHECKED.';
      } else {
        edWhy = fTxt + ' (too few to judge) · ' + edWhy;
      }
    } else if (fwd && fin(fwd.open) > 0){
      edWhy = fin(fwd.open) + ' out-of-sample trades still open · ' + edWhy;
    }

    gates.push({ key:'measured-edge', hard:false, info: edInfo, pass: ed, why: edWhy });

    /* CONSENSUS. The one gate that reads the rest of the scan on this
       contract.

       Measured over 300 tapes before this existed: 29% fired both directions
       on the same contract and 12% graded a LONG and a SHORT ticket at the
       same moment, each with a clean ledger, with nothing on the card saying
       which one the tab believed. Seven detectors each asked "is my own setup
       sound?" and not one asked whether anything else disagreed.

       Hard, and deliberately not soft: unlike the indicator reads this makes
       no claim about whether a mechanic works. It states a fact about this
       bar — the desk is pointing both ways and this setup is on the thinner
       side. A tie vetoes BOTH, because on a genuinely two-sided tape the
       honest output is no trade rather than a coin flip presented as a setup.

       With no scan supplied it goes SOFT and reads UNCHECKED, so a caller
       that cannot provide the other hits does not have every setup silently
       blocked by a gate that could not run. */
    var con = null, conWhy = 'no other mechanics to compare against';
    var conHard = false;
    var cons = x.allHits ? hgOmniConsensus(x.allHits, hit) : null;
    if (cons){
      conHard = true;
      var aTxt = cons.nAgree + ' famil' + (cons.nAgree === 1 ? 'y agrees' : 'ies agree')
               + (cons.agree.length ? ' (' + cons.agree.join(', ') + ')' : '');
      var splitTxt = cons.nSplit ? '; ' + cons.split.join(', ')
                   + (cons.nSplit === 1 ? ' is' : ' are') + ' split and counted for neither' : '';
      if (cons.nAgree === 0 && cons.nAgainst === 0){
        /* Every family that fired is internally divided, so not one of them
           has an opinion. Nothing agreeing is not the same as nothing
           disagreeing, and reading it as the latter passed BOTH directions. */
        con = false;
        conWhy = 'every mechanic family that fired is split (' + cons.split.join(', ')
               + ') — the desk has no directional opinion at all';
      } else if (cons.nAgainst === 0){
        con = true;
        conWhy = aTxt + ', nothing firing against it' + splitTxt;
      } else if (cons.nAgree > cons.nAgainst){
        con = true;
        conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt;
      } else if (cons.nAgree === cons.nAgainst){
        /* A TIE between TREND and REVERSION is not a contradiction — it is
           what those two families ARE. In any trending tape the continuation
           mechanics fire with the move and the fades fire against it, every
           time. Vetoing both made the tab go quiet exactly when there was a
           trend to trade: measured over 300 tapes, the veto rate ROSE from
           36% on a random walk to 56% on a trending one, and 87% of those
           were ties. That is the gate misreading its own design.

           The regime already says which family belongs. Let it break the tie:
           a trending tape favours the continuation side, a ranging tape the
           fade. Exactly one side can win, so this cannot reintroduce a
           contradictory pair. With no clear regime it is a genuine coin flip
           and both still stand aside. */
        /* The STRUCTURAL regime (trend vs range), not x.regime — that one is
           the RISK-ON/RISK-OFF macro read and answers a different question.
           Looked up defensively, like every other optional module here. */
        var tieReg = null;
        var tieW = (typeof window !== 'undefined') ? window : null;
        var tieFn = (tieW && typeof tieW.detectRegime === 'function') ? tieW.detectRegime : null;
        if (tieFn){ try { var tr = tieFn(rows); tieReg = tr ? String(tr.regime || '') : null; } catch (eT){ tieReg = null; } }
        var wantFam = /trend/i.test(tieReg || '') ? 'TREND'
                    : /range|chop|mean/i.test(tieReg || '') ? 'REVERSION' : null;
        var mineHas = wantFam && cons.agree.indexOf(wantFam) >= 0;
        var theirsHas = wantFam && cons.against.indexOf(wantFam) >= 0;
        if (wantFam && mineHas && !theirsHas){
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — tied, broken by the ' + tieReg + ' regime, which favours ' + wantFam;
        } else if (wantFam && theirsHas && !mineHas){
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — tied, and the ' + tieReg + ' regime favours the other side (' + wantFam + ')';
        } else {
          con = false;
          /* Say WHICH of the three tie-break failures happened. "No regime
             read" was printed for all of them, including on cards where
             regime-fit had just reported WEAK TREND three lines below — which
             sends the reader looking for a missing regime that is not
             missing. */
          var tieWhy = !wantFam
            ? 'no regime read to break it'
            : (cons.split.indexOf(wantFam) >= 0
                ? 'the ' + tieReg + ' regime favours ' + wantFam + ', and ' + wantFam
                  + ' is itself split — it cannot break its own tie'
                : (mineHas && theirsHas
                    ? wantFam + ' fired on BOTH sides, so the regime cannot separate them'
                    : wantFam + ' did not fire at all, so the ' + tieReg
                      + ' regime has nothing here to favour'));
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ')
                 + ')' + splitTxt + ' — tied, and ' + tieWhy + ': the desk cannot pick a side';
        }
      } else {
        con = false;
        conWhy = 'only ' + aTxt + ' vs ' + cons.nAgainst + ' against ('
               + cons.against.join(', ') + ')' + splitTxt + ' — this is the minority read';
      }
    }
    gates.push({ key:'consensus', hard: conHard, pass: con, why: conWhy });

    /* --- added indicator reads ------------------------------------------

       INFO gates: they report, they can argue against a setup on the card,
       and they never veto. Nothing here has a measured record on this desk,
       and a twelve-gate ledger does not need three more arbitrary vetoes.

       Every return shape was probed against the real function first. adx
       returns PARALLEL ARRAYS, hgAtrPercentile a bare number,
       hgVolFromCloses an object — getting that wrong is silent, the gate
       simply reads "unavailable" for ever, and that is how two dead gates
       shipped on the gold desk. */
    var idxW = (typeof window !== 'undefined') ? window : null;
    function idxFn(n){ return (idxW && typeof idxW[n] === 'function') ? idxW[n] : null; }
    var isRev = (hit.kind === 'SPRING' || hit.kind === 'UTAD' || hit.kind === 'VALUE'
              || hit.kind === 'ABSORB' || hit.kind === 'VWAP-REVERT' || hit.kind === 'RSI-DIVERGE'
              || hit.kind === 'POC-REVERT' || hit.kind === 'AVWAP-RECLAIM');

    /* ADX — is there a trend here at all, and does it point our way? */
    var adxOk = null, adxWhy = 'ADX unavailable';
    var adxFn = idxFn('adx');
    if (adxFn){
      try {
        var ax = adxFn(rows, 14);
        var aA = ax && ax.adx, pA = ax && ax.plusDI, mA = ax && ax.minusDI;
        var aV = (aA && aA.length) ? fin(aA[aA.length - 1]) : NaN;
        var pV = (pA && pA.length) ? fin(pA[pA.length - 1]) : NaN;
        var mV = (mA && mA.length) ? fin(mA[mA.length - 1]) : NaN;
        if (isFinite(aV) && isFinite(pV) && isFinite(mV)){
          var trending = aV >= 25, diUp = pV > mV;
          adxWhy = 'ADX ' + aV.toFixed(0) + (trending ? ' — trending' : ' — no trend')
                 + ', DI ' + (diUp ? 'up' : 'down');
          if (!trending){
            adxOk = isRev ? true : false;
            adxWhy += isRev ? ' — which is the tape a reversion mechanic wants'
                            : ' — a continuation mechanic with no trend behind it';
          } else {
            var diAgrees = (hit.dir === 'long') ? diUp : !diUp;
            adxOk = isRev ? true : diAgrees;
            adxWhy += diAgrees ? ' — agrees' : (isRev ? ' — counter-trend by design' : ' — DI points the other way');
          }
        }
      } catch (eA){ adxOk = null; adxWhy = 'ADX threw: ' + ((eA && eA.message) || eA); }
    }
    gates.push({ key:'adx-trend', hard:false, info:true, pass: adxOk, why: adxWhy });

    /* ATR percentile — both tails matter. A dead tape will not reach a 2R
       target inside the horizon; a top-decile tape puts the stop in noise. */
    var apOk = null, apWhy = 'ATR percentile unavailable';
    var apFn = idxFn('hgAtrPercentile');
    if (apFn){
      try {
        var pct = fin(apFn(rows, 14, 100));
        if (isFinite(pct)){
          apWhy = 'ATR in the ' + ordinal(pct) + ' percentile of the last 100 bars';
          if (pct < 15){ apOk = false; apWhy += ' — too quiet to reach the target inside the horizon'; }
          else if (pct > 90){ apOk = false; apWhy += ' — top-decile volatility, the stop sits inside the noise'; }
          else apOk = true;
        }
      } catch (eP){ apOk = null; apWhy = 'ATR percentile threw: ' + ((eP && eP.message) || eP); }
    }
    gates.push({ key:'atr-percentile', hard:false, info:true, pass: apOk, why: apWhy });

    /* Volatility FORECAST. Every target here is an R multiple of the stop, so
       whether it is reachable depends on volatility going forward, not on
       what it has just done. */
    var vfOk = null, vfWhy = 'volatility forecast unavailable';
    var vfFn = idxFn('hgVolFromCloses');
    if (vfFn){
      try {
        var vCl = [], vi;
        for (vi = 0; vi < rows.length; vi++){ var vc = fin(rows[vi].c); if (isFinite(vc)) vCl.push(vc); }
        var vpk = vfFn(vCl, {});
        var sNow = vpk ? fin(vpk.sigmaNow) : NaN;
        var sFwd = vpk ? fin(vpk.sigmaForecast) : NaN;
        if (isFinite(sNow) && isFinite(sFwd) && sNow > 0){
          var chg = (sFwd - sNow) / sNow;
          vfWhy = 'volatility forecast ' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(0)
                + '% vs now (' + (vpk.source || 'model') + ')';
          if (chg <= -0.35){ vfOk = false; vfWhy += ' — contracting hard, the target may not be reachable inside the horizon'; }
          else vfOk = true;
        }
      } catch (eV){ vfOk = null; vfWhy = 'volatility forecast threw: ' + ((eV && eV.message) || eV); }
    }
    gates.push({ key:'vol-forecast', hard:false, info:true, pass: vfOk, why: vfWhy });

    /* XS-RANK — where this contract sits against the whole sweep.

       No other gate on this ledger looks outside the symbol. A long in the
       bottom decile of a 500-contract universe is not the same trade as the
       identical setup in the top decile, and until now the card could not
       tell them apart. Info: cross-sectional momentum has support in the
       literature but none on THIS desk yet, so it argues and does not veto. */
    var xsOk = null, xsWhy = 'universe rank unavailable (sweep too small to rank)';
    var xsPack = x.xs;
    if (xsPack && xsPack.rank && x.sym){
      var xr = fin(xsPack.rank[String(x.sym)]);
      if (isFinite(xr)){
        var pctl = Math.round(xr * 100);
        xsWhy = 'ranks ' + ordinal(pctl) + ' percentile of ' + xsPack.n + ' contracts by 20-bar return';
        /* Buying the weakest of five hundred, or selling the strongest, is
           the case worth flagging. */
        if (hit.dir === 'long' && xr <= 0.1){ xsOk = false; xsWhy += ' — buying the weakest of the universe'; }
        else if (hit.dir === 'short' && xr >= 0.9){ xsOk = false; xsWhy += ' — selling the strongest of the universe'; }
        else xsOk = true;
      }
    }
    gates.push({ key:'xs-rank', hard:false, info:true, pass: xsOk, why: xsWhy });

    /* BREADTH — how much of the universe is going the same way.

       A short taken while 85% of contracts are up is fighting the whole tape,
       and no per-symbol read can see that. */
    var brOk = null, brWhy = 'breadth unavailable (sweep too small to measure)';
    if (xsPack && isFinite(fin(xsPack.breadthUp))){
      var up = fin(xsPack.breadthUp);
      brWhy = Math.round(up * 100) + '% of ' + xsPack.n + ' contracts are up over 20 bars';
      if (hit.dir === 'long' && up <= 0.15){ brOk = false; brWhy += ' — a long against a universe-wide selloff'; }
      else if (hit.dir === 'short' && up >= 0.85){ brOk = false; brWhy += ' — a short against a universe-wide rally'; }
      else brOk = true;
    }
    gates.push({ key:'breadth', hard:false, info:true, pass: brOk, why: brWhy });

    /* STOP-WIDTH — what this stop actually asks of the trade.

       The card has always PRINTED the risk percentage and never said anything
       about it: a live scan showed "risk 13.33%" and "risk 0.86%" rendered
       identically. They are not the same trade. A 13.3% stop on a 2R target
       needs the market to travel 26.7% before T1 pays, and at a fixed 1%
       account risk it buys a position 15x smaller than the 0.86% one — so the
       same "2R" means very different things.

       Info, not a veto: a wide stop on a volatile alt is often correct, and
       the previous gold work established that TRUNCATING a stop to make the
       number look better just relocates the risk. This states the
       consequence; it does not overrule the structure. */
    var sw = null, swWhy = 'no plan yet — stop width cannot be judged';
    var swPlan = x.plan;
    if (swPlan){
      var swE = fin(swPlan.entry), swS = fin(swPlan.stop), swT = fin(swPlan.t1);
      if (isFinite(swE) && isFinite(swS) && swE > 0){
        var swPct = Math.abs(swE - swS) / swE * 100;
        if (isFinite(swPct) && swPct > 0){
          /* The move T1 actually requires, from the plan's own numbers rather
             than an assumed multiple. */
          var needPct = isFinite(swT) ? (Math.abs(swT - swE) / swE * 100) : (swPct * fin(x.minRr || 2));
          swWhy = 'stop is ' + swPct.toFixed(2) + '% from entry; T1 needs a '
                + needPct.toFixed(1) + '% move';
          if (swPct >= 8){
            sw = false;
            swWhy += ' — a very wide stop: at fixed account risk this sizes to a small position, '
                   + 'and the target needs a large move to pay';
          } else if (swPct <= 0.25){
            sw = false;
            swWhy += ' — a very tight stop: ordinary noise and spread will take it out before the idea fails';
          } else {
            sw = true;
          }
        }
      }
    }
    gates.push({ key:'stop-width', hard:false, info:true, pass: sw, why: swWhy });

    /* NET-R — the R:R on the card is GROSS.

       Every card prints "R:R 2.00" and means 2R before fees. crypto-position-
       risk.js has computed the cost-adjusted figure since it was written and
       no ledger has ever read it. On a wide stop the difference is noise; on
       a 0.86% stop the round trip can take a fifth of the R, and the win rate
       the setup actually needs moves with it.

       Info: the cost is a fact about the venue and the stop, not a fault in
       the setup. It is stated so 2R stops meaning two different things. */
    var nr = null, nrWhy = 'net R unavailable (crypto-position-risk.js not loaded)';
    var nrFn = idxFn('hgCryptoNetRAtTarget');
    var beFn = idxFn('hgCryptoBreakevenWinRate');
    var costFn = idxFn('hgCryptoCostR');
    var nrPlan = x.plan;
    if (nrFn && nrPlan){
      try {
        var nrE = fin(nrPlan.entry), nrS = fin(nrPlan.stop), nrT = fin(nrPlan.t1);
        if (isFinite(nrE) && isFinite(nrS) && isFinite(nrT) && nrE > 0 && nrE !== nrS){
          /* DIRECTIONAL, like the library's own net figure. Computing gross
             as |t1-entry| while the library computes it signed made a short
             read "2.00R gross, -2.05R net" — two different questions answered
             in one sentence. Signed also means a target on the WRONG side of
             entry shows as negative rather than being hidden by Math.abs. */
            var nrRisk = Math.abs(nrE - nrS);
            var grossR = (hit.dir === 'long') ? (nrT - nrE) / nrRisk : (nrE - nrT) / nrRisk;
            var netR = fin(nrFn(nrE, nrS, nrT, hit.dir));
            if (isFinite(netR)){
              /* Same sides the library assumes, or the cost printed on the
                 card will not reconcile with the net figure beside it. */
              var costR = costFn ? fin(costFn(nrE, nrS, 'maker', 'maker')) : NaN;
              var beWin = beFn ? fin(beFn(grossR, isFinite(costR) ? costR : 0)) : NaN;
              nrWhy = 'T1 is ' + grossR.toFixed(2) + 'R gross, ' + netR.toFixed(2) + 'R net of fees'
                    + (isFinite(costR) ? ' (cost ' + costR.toFixed(2) + 'R)' : '')
                    + (isFinite(beWin) ? ' — needs ' + (beWin * 100).toFixed(0) + '% wins to break even' : '');
              if (!(grossR > 0)){
                /* The target is on the wrong side of entry for this direction.
                   That is a broken plan, not an expensive one. */
                nr = false;
                nrWhy = 'T1 is on the wrong side of entry for a ' + hit.dir + ' — the plan does not hold together';
              } else if ((grossR - netR) / grossR >= 0.25){
                nr = false;
                nrWhy += ' — fees take over a quarter of the reward';
              } else {
                nr = true;
              }
            }
        } else if (nrE === nrS){
          nrWhy = 'entry and stop are the same price — no R to cost';
        }
      } catch (eNr){ nr = null; nrWhy = 'net R threw: ' + ((eNr && eNr.message) || eNr); }
    } else if (!nrPlan && nrFn){
      nrWhy = 'no plan yet — net R cannot be costed';
    }
    gates.push({ key:'net-r', hard:false, info:true, pass: nr, why: nrWhy });

    /* LIQ-ROOM — the leverage at which liquidation reaches the stop.

       Above it the position is closed by the exchange before the idea is
       proved wrong, which is a different loss from the one the plan
       describes. A statement about sizing, so it argues and never vetoes:
       leverage is the user's decision and this desk does not place orders. */
    var lr2 = null, lr2Why = 'max leverage unavailable (crypto-position-risk.js not loaded)';
    var levFn = idxFn('hgCryptoMaxSurvivableLev');
    if (levFn && nrPlan){
      try {
        var lvE = fin(nrPlan.entry), lvS = fin(nrPlan.stop);
        if (isFinite(lvE) && isFinite(lvS) && lvE > 0 && lvE !== lvS){
          var maxLev = fin(levFn(lvE, lvS, null, null));
          if (isFinite(maxLev) && maxLev >= 1){
            lr2Why = 'liquidation clears the stop up to ' + maxLev.toFixed(0) + 'x leverage';
            /* Under 2x means the stop is so wide that almost any leverage puts
               liquidation inside it. */
            if (maxLev < 2){
              lr2 = false;
              lr2Why += ' — barely any room: this stop is wide enough that leverage liquidates before it';
            } else {
              lr2 = true;
            }
          }
        }
      } catch (eLr){ lr2 = null; lr2Why = 'max leverage threw: ' + ((eLr && eLr.message) || eLr); }
    } else if (!nrPlan && levFn){
      lr2Why = 'no plan yet — leverage room cannot be judged';
    }
    gates.push({ key:'liq-room', hard:false, info:true, pass: lr2, why: lr2Why });





    return gates;
  }

  /* Ticket requires: every HARD gate an explicit pass, and no evaluable veto
     anywhere. An unevaluable CONDITIONAL gate degrades the card (reported in
     `degraded`) but does not stand it aside — see the note on hgOmniGates.
     An unevaluable HARD gate still blocks, because those are computable on
     both venues and a missing one means the data itself was bad. Pure. */
  /* Out-of-sample stats for one mechanic, or null when the log is absent.
     Never throws: a missing forward log must leave the gate reading the
     in-sample number and saying so, not break the scan. */
  function hgOmniFwdFor(tab, mechanic){
    try{
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function' || !tab || !mechanic) return null;
      /* TWO records, and they answer different questions.

         'all' is every firing that carried a plan. It is what the in-sample
         pool measures, so it is the only one comparable with it, and it is
         what the card reports.

         'ticket' is the subset the ledger actually cleared. That is the only
         honest basis for a VETO: a mechanic fires, the ledger rejects most of
         them for reasons of its own — no trend, no participation, wrong
         regime — those rejects are recorded and they lose, and the mechanic
         is then condemned by trades this desk refused to take. Judging it
         that way is circular, and it is what emptied both tabs: every
         mechanic crossed twenty settled all-firings at zero wins and was
         vetoed, including on the setups the ledger had cleared.

         ticketOnly cannot be answered from the pruned aggregate, so it is a
         view of the recent window rather than of all time. That is a reason
         to require enough of it before acting, not a reason to ignore it. */
      var all = w.hgFwdStats(tab, mechanic, false);
      var tix = w.hgFwdStats(tab, mechanic, true);
      if (!all || !isFinite(fin(all.samples))) return null;
      all.ticketOnly = (tix && isFinite(fin(tix.samples))) ? tix : null;
      return all;
    }catch(e){ return null; }
  }

  /* COLLAPSE FIRST, THEN COUNT — AND LET THE CLEARED ONE KEEP THE CARD.

     The gold header read "12 setup(s) · 2 ticket(s)" and the desk rendered
     ONE ticket. Both numbers were counted over the pre-collapse list while
     the cards were rendered after it. Several mechanics firing the same bar
     produce the same entry, stop, direction and horizon — one trade with
     several names — and when two members of a group both graded TICKET the
     header counted two and the collapse showed one. A ticket count you cannot
     act on twice is a count of positions the reader might size twice.

     The owner rule was the worse half. The FIRST member kept the card, so a
     group holding one cleared setup and one vetoed setup showed whichever
     happened to sort first — and a ticket could be hidden behind a VETO card
     entirely, invisible on the desk while still being counted in the header.
     That is not hypothetical: mechanics on identical levels genuinely grade
     differently, because measured-edge is per mechanic and consensus is per
     family. A cleared member now takes the card. */
  function omniTradeKey(c){
    var pl = (c && c.plan) || {};
    var e = isFinite(fin(pl.entry)) ? fin(pl.entry).toPrecision(8) : 'na';
    var st = isFinite(fin(pl.stop)) ? fin(pl.stop).toPrecision(8) : 'na';
    return String(c && c.sym) + '|' + String(c && c.dir) + '|' + e + '|' + st;
  }
  /* PURE — see the gold desk's copy. */
  function omniDistinctCounts(list){
    var seen = {}, trades = 0, tickets = 0, i, k, c, t;
    for (i = 0; i < (list || []).length; i++){
      c = list[i]; if (!c) continue;
      k = omniTradeKey(c);
      t = !!(c.grade && c.grade.ticket);
      if (seen[k] === undefined){ seen[k] = t; trades++; if (t) tickets++; }
      else if (t && !seen[k]){ seen[k] = true; tickets++; }
    }
    return { trades: trades, tickets: tickets };
  }

  function hgOmniGrade(gates){
    var vetoes = [], hardUnknown = [], degraded = [], notes = [], i, g;
    for (i = 0; i < gates.length; i++){
      g = gates[i];
      /* An info gate REPORTS an adverse read without standing the trade
         aside. Until it has a record of its own, a gate that has never been
         measured on this desk has not earned a veto — and stacking unmeasured
         vetoes onto a twelve-gate ledger cuts tickets for arbitrary reasons.
         Gates without the flag behave exactly as before: pass===false vetoes. */
      if (g.pass === false){
        if (g.info) notes.push(g.key); else vetoes.push(g.key);
      }
      else if (g.pass === null){
        if (g.hard) hardUnknown.push(g.key); else degraded.push(g.key);
      }
    }
    var ticket = vetoes.length === 0 && hardUnknown.length === 0;
    /* How much of the ledger actually RAN. A ticket resting on 4 evaluated
       gates is far weaker evidence than one resting on 12, and the badge
       alone cannot show that difference — so count it and surface it. */
    var evaluated = 0;
    for (i = 0; i < gates.length; i++) if (gates[i].pass !== null) evaluated++;
    return {
      ticket: ticket,
      evaluated: evaluated,
      total: gates.length,
      vetoes: vetoes,
      unknown: hardUnknown,
      degraded: degraded,
      notes: notes,
      verdict: vetoes.length ? ('VETO — ' + vetoes.join(', '))
             : (hardUnknown.length ? ('WATCH — no data: ' + hardUnknown.join(', '))
             : ((degraded.length ? ('CLEAN · unchecked: ' + degraded.join(', ')) : 'CLEAN')
                /* An adverse context read never hides: the ticket stands, and
                   the card says what argued against it. */
                + (notes.length ? ' · against: ' + notes.join(', ') : '')))
    };
  }

  /* Whole per-symbol evaluation: detectors -> gates -> plan. Pure given
     rows; hgPlanLevels is looked up defensively and NaN-safe. */
  function hgOmniEvaluate(item, rows, positioning, extra){
    var hits = hgOmniDetect(rows, positioning, (extra && extra.xs) || null, item && item.sym), out = [], i;
    if (!hits.length) return out;
    var planFn = (typeof window !== 'undefined' && typeof window.hgPlanLevels === 'function')
      ? window.hgPlanLevels : null;
    for (i = 0; i < hits.length; i++){
      var hit = hits[i];
      var ex = extra || {};
      // per-detector measured stats select by this hit's family
      var exForHit = {};
      for (var kk in ex) if (Object.prototype.hasOwnProperty.call(ex, kk)) exForHit[kk] = ex[kk];
      /* UTAD is measured under SPRING — same detector family in the backtest pool */
      var statKey = (hit.kind === 'UTAD') ? 'SPRING' : hit.kind;
      exForHit.stats = (ex.stats && ex.stats[statKey]) ? ex.stats[statKey] : null;
      /* The OUT-OF-SAMPLE record for the same mechanic. The measured-edge gate
         used to see only the in-sample pool above, which is re-read from the
         same window on every scan — so it could pass a ticket on +1.47σ while
         the forward log said 0 of 5 on that exact mechanic. Both go to the
         gate now and the gate decides which one is evidence. */
      exForHit.fwd = hgOmniFwdFor(ex.fwdTab || 'OMNIROUTE', statKey);
      exForHit.exchange = item && item.exchange;
      exForHit.regimeWarm = ex.regimeWarm;
      exForHit.allHits = hits;      /* so the consensus gate can see the rest of the scan */
      exForHit.sym = item && item.sym;   /* so the cross-sectional gates can find this contract's rank */
      /* PLAN BEFORE GATES. The ledger could not see the stop it was judging:
         plan was derived after the gates ran, so no gate could say anything
         about how wide it is. A live card read "risk 13.33%" in exactly the
         same weight as one reading "risk 0.86%", and those are not the same
         trade. Gold has run in this order since the cost-drag gate landed for
         the same reason. */
      var plan = null;
      if (planFn){
        try { plan = planFn(hit.dir, rows, undefined, { minRr: MIN_RR, type: 'OMNI' }); }
        catch (e) { plan = null; }
      }
      if (plan) plan = hgOmniDerivePlan(plan);
      exForHit.plan = plan;
      var gates = hgOmniGates(rows, hit, positioning, exForHit);
      var grade = hgOmniGrade(gates);
      /* The global hgPlanLevels wrapper (index.html) forwards only
         {dir,entry,stop,t1,t2,risk,note,...} — it DROPS rr1/rr2/riskPct from
         hgPlanLevelsCore. Reading plan.rr1 therefore gave undefined, which
         rendered as "R:R —" and, worse, made hgOmniRank sort every card by
         NaN: the tab claimed to order by R:R while ordering by nothing.
         Derive both from fields the wrapper does provide. */
      out.push({
        sym: item && item.sym, base: item && item.base, exchange: item && item.exchange,
        kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        /* Carried so hgOmniRank can put the setup the rest of the scan agrees
           with above the one nothing supports. */
        consensus: hgOmniConsensus(hits, hit),
        family: hgOmniFamilyOf(hit.kind),
        rr: (plan && isFinite(fin(plan.rr1))) ? fin(plan.rr1) : NaN
      });
    }
    return out;
  }

  /* Fill in the reward/risk fields the plan wrapper strips. Never mutates
     the input; returns NaN rather than a guess when geometry is unusable. */
  function hgOmniDerivePlan(plan){
    if (!plan) return plan;
    var out = {}, k;
    for (k in plan) if (Object.prototype.hasOwnProperty.call(plan, k)) out[k] = plan[k];
    /* fin(), not num(). num(null) is 0 because +null is 0, so a missing entry
       would be read as price zero and produce a risk of |0 - stop| — a large,
       entirely invented number, and an R:R to match. fin() is the strict
       version already used for venue payloads in this file. */
    var entry = fin(out.entry), stop = fin(out.stop), t1 = fin(out.t1), t2 = fin(out.t2);
    /* Risk is derived from the levels the card actually PRINTS, never from
       plan.risk. Live cards showed R:R 14.72 / 11.35 / 9.57 whose true value
       was 2.00 in every case — a 5-7x overstatement that also drove the
       ranking. The wrapper's `risk` field is stale with respect to the entry
       it reports (hgPlanLevelsCore's exact-entry pass moves entry/t1/t2 and
       leaves risk behind), so entry/stop are the only self-consistent
       source. If the numbers on the card disagree with each other, the card
       is lying; deriving from what is shown makes that impossible. */
    var risk = Math.abs(entry - stop);
    var usable = isFinite(risk) && risk > 0;
    /* Every derived field is ASSIGNED on every path, never merely
       overwritten on the good one. The copy loop above brought the wrapper's
       stale rr1/rr2/risk/riskPct across with the rest of the plan, so leaving
       any of them untouched here let exactly the number this function exists
       to eliminate survive whenever the geometry was degenerate: entry equal
       to stop, or a target the plan did not supply. The comment used to claim
       these were "recomputed unconditionally" while they sat inside the
       risk > 0 guard. They are unconditional now, and a value that cannot be
       derived is null rather than inherited. */
    out.rr1 = (usable && isFinite(t1)) ? Math.abs(t1 - entry) / risk : null;
    out.rr2 = (usable && isFinite(t2)) ? Math.abs(t2 - entry) / risk : null;
    out.riskPct = (usable && isFinite(entry) && entry > 0) ? (risk / entry * 100) : null;
    out.risk = usable ? risk : null;
    return out;
  }

  /* Ordering: tickets first, then by R:R desc, then base alpha so the list
     is stable between runs. Setups with no computable plan sink. Pure. */
  function hgOmniRank(cands){
    var arr = (cands || []).slice();
    arr.sort(function(a, b){
      if (a.grade.ticket !== b.grade.ticket) return a.grade.ticket ? -1 : 1;
      /* EVIDENCE first, R:R second. The plan engine returns its 2R floor on
         essentially every setup, so R:R is pinned at 2.00 and discriminates
         nothing — sorting on it was sorting on a constant. How many gates
         actually ran is the real difference between two tickets. */
      /* CONSENSUS first where a desk supplies it. Between two tickets, how
         many independent mechanic families point the same way is stronger
         evidence than how many gates happened to be computable — and on a
         desk scanning 27 mechanics it is the difference between a setup the
         book agrees on and one that is simply alone. Desks that do not set
         it compare 0 to 0 and are ordered exactly as before. */
      var ac = (a.consensus && a.consensus.nAgree) || 0, bc = (b.consensus && b.consensus.nAgree) || 0;
      if (bc !== ac) return bc - ac;
      var ae = (a.grade && a.grade.evaluated) || 0, be = (b.grade && b.grade.evaluated) || 0;
      if (be !== ae) return be - ae;
      /* fin(), not isFinite: a cleared R:R is null, and isFinite(null) is true,
         so the raw test would rank an unknown R:R as a real 0 rather than
         sinking it below every setup that has one. */
      var ar = isFinite(fin(a.rr)) ? fin(a.rr) : -1, br = isFinite(fin(b.rr)) ? fin(b.rr) : -1;
      if (br !== ar) return br - ar;
      return String(a.base) < String(b.base) ? -1 : 1;
    });
    return arr;
  }

  /* ==================== coverage matrix (research half) ==================== */

  function hgOmniGateInventory(){
    return [
      { key:'ema_cascade',      label:'EMA cascade / trend stack',        tabs:['SWING SCAN','EDGE','TREND MATRIX'] },
      { key:'htf_alignment',    label:'higher-timeframe alignment',       tabs:['SWING SCAN','BIAS','EDGE'] },
      { key:'sweep_reclaim',    label:'liquidity sweep + reclaim',        tabs:['SCALP SCAN','LIQUIDITY TRAP','EDGE'] },
      { key:'fvg',              label:'fair value gap / imbalance',       tabs:['SMC (FVG)'] },
      { key:'order_block',      label:'order block + mitigation',         tabs:['ORDER BLOCKS'] },
      { key:'rsi_band',         label:'RSI band / guard',                 tabs:['SWING SCAN','SCALP SCAN'] },
      { key:'divergence',       label:'RSI divergence',                   tabs:['DIVERGENCE'] },
      { key:'squeeze',          label:'volatility squeeze / Donchian',    tabs:['SQUEEZE','COIL WATCHLIST'] },
      { key:'compression',      label:'range compression',                tabs:['COIL WATCHLIST'] },
      { key:'funding',          label:'funding rate + crowding',          tabs:['SMART $','OI FLOW','BASIS','CARRY'] },
      { key:'open_interest',    label:'open interest regime',             tabs:['OI FLOW','SMART $'] },
      { key:'taker_flow',       label:'taker buy/sell imbalance',         tabs:['SMART $','OI FLOW'] },
      { key:'tsmom',            label:'time-series momentum',             tabs:['BIAS'] },
      { key:'cusum',            label:'CUSUM structural break',           tabs:['BIAS','SWING SCAN'] },
      { key:'rel_strength',     label:'relative strength / rotation',     tabs:['APEX (RS)'] },
      { key:'regime',           label:'market regime risk-on/off',        tabs:['REGIME'] },
      { key:'macro',            label:'macro overlay',                    tabs:['GOLD','GOLD PRO','REGIME'] },
      { key:'atr_vol',          label:'ATR / volatility-alive check',     tabs:['SCALP SCAN','OMNIROUTE'] },
      { key:'structural_rr',    label:'structural R:R floor',             tabs:['SWING SCAN','EDGE','OMNIROUTE'] },
      { key:'session_killzone', label:'session / kill-zone time gating',  tabs:['GOLD'] },
      { key:'portfolio_heat',   label:'portfolio heat / risk cap',        tabs:['TRADE PLAN','RISK'] },
      /* newly implemented right here */
      { key:'spring_utad',      label:'Wyckoff spring / UTAD',            tabs:['OMNIROUTE'] },
      { key:'power_of_three',   label:'power of three (acc → sweep → expand)', tabs:['OMNIROUTE'] },
      { key:'opening_range',    label:'opening-range break',              tabs:['OMNIROUTE'] },
      { key:'effort_vs_result', label:'effort vs result (absorption)',    tabs:['OMNIROUTE'] },
      { key:'volume_profile',   label:'volume profile POC (candle approx)', tabs:['OMNIROUTE'] },
      { key:'value_area',       label:'value area VAH/VAL rejection',     tabs:['OMNIROUTE'] },
      { key:'measured_move',    label:'measured move projection',         tabs:['OMNIROUTE'] }
    ];
  }

  function hgOmniInventoryKeys(){
    var inv = hgOmniGateInventory(), out = {}, i;
    for (i = 0; i < inv.length; i++) out[inv[i].key] = inv[i];
    return out;
  }

  function hgOmniRoster(){
    return [
      { school:'ICT / smart-money liquidity model',
        taught:'liquidity sweeps, fair value gaps, order blocks, kill zones, power of three',
        needs:['sweep_reclaim','fvg','order_block','session_killzone','power_of_three'] },
      { school:'Wyckoff method',
        taught:'accumulation/distribution schematics, spring and upthrust, volume dry-up, effort vs result',
        needs:['compression','spring_utad','effort_vs_result','open_interest'] },
      { school:'TTM squeeze / volatility expansion',
        taught:'Bollinger-inside-Keltner compression, momentum fire, Donchian breakout',
        needs:['squeeze','compression','atr_vol'] },
      { school:'Perp positioning / funding desk',
        taught:'funding z-score extremes, OI divergence, taker imbalance, contrarian crowding',
        needs:['funding','open_interest','taker_flow'] },
      { school:'Quant trend following (TSMOM)',
        taught:'time-series momentum, volatility targeting, structural-break detection',
        needs:['tsmom','cusum','vol_targeting'] },
      { school:'Relative strength rotation',
        taught:'rank universe against a benchmark, hold leaders, rotate on rank decay',
        needs:['rel_strength','regime'] },
      { school:'Volume profile / auction market theory',
        taught:'point of control, value area, naked POC revisits, acceptance vs rejection',
        needs:['volume_profile','value_area'] },
      { school:'Order flow / CVD',
        taught:'cumulative volume delta, absorption at levels, liquidation cascades',
        needs:['cvd','taker_flow','liquidation_map'] },
      { school:'Classical price action (Brooks)',
        taught:'trend bars, measured moves, always-in direction, second-entry pullbacks',
        needs:['ema_cascade','htf_alignment','measured_move'] },
      { school:'Session / opening range',
        taught:'daily and weekly opening range, prior-session reference, Asia range break',
        needs:['session_killzone','opening_range'] }
    ];
  }

  function hgOmniCoverage(row, inv){
    if (!row || !row.needs || !row.needs.length) return null;
    var keys = inv || hgOmniInventoryKeys(), have = [], miss = [], i, k;
    for (i = 0; i < row.needs.length; i++){
      k = row.needs[i];
      if (keys[k]) have.push(k); else miss.push(k);
    }
    return { school: row.school, taught: row.taught, have: have, miss: miss,
             verdict: miss.length === 0 ? 'COVERED' : (have.length === 0 ? 'GAP' : 'PARTIAL') };
  }

  function hgOmniCoverageMatrix(){
    var inv = hgOmniInventoryKeys(), roster = hgOmniRoster(), out = [], i, c;
    for (i = 0; i < roster.length; i++){ c = hgOmniCoverage(roster[i], inv); if (c) out.push(c); }
    return out;
  }

  function hgOmniGaps(){
    var m = hgOmniCoverageMatrix(), tally = {}, out = [], i, j, k;
    for (i = 0; i < m.length; i++){
      for (j = 0; j < m[i].miss.length; j++){
        k = m[i].miss[j];
        if (!tally[k]) tally[k] = { key:k, schools:[] };
        tally[k].schools.push(m[i].school);
      }
    }
    for (k in tally) if (Object.prototype.hasOwnProperty.call(tally, k)) out.push(tally[k]);
    out.sort(function(a,b){
      if (b.schools.length !== a.schools.length) return b.schools.length - a.schools.length;
      return a.key < b.key ? -1 : 1;
    });
    return out;
  }

  /* ==================== gateway ingest (research half) ==================== */

  function hgOmniVocabulary(){
    var inv = hgOmniGateInventory(), out = [], i;
    for (i = 0; i < inv.length; i++) out.push(inv[i].key);
    var extra = ['vol_targeting','cvd','liquidation_map'];
    for (i = 0; i < extra.length; i++) if (out.indexOf(extra[i]) === -1) out.push(extra[i]);
    return out;
  }

  function hgOmniBuildPrompt(sourceText, kind){
    var what = kind === 'search'
      ? 'Search the web for how this trader or strategy actually works, then extract it.'
      : 'Extract the trading method described in the SOURCE below.';
    return [
      'You are a trading-strategy extractor. ' + what,
      'Return STRICT JSON only — no prose, no markdown fence. Shape:',
      '{"name":string,"timeframe":string,"trigger":string,"filters":[string],',
      '"invalidation":string,"target":string,"techniques":[string]}',
      '',
      '"techniques" MUST come from exactly this vocabulary (use only what the',
      'method genuinely relies on; omit the rest):',
      hgOmniVocabulary().join(', '),
      '',
      'Rules: if the source does not state something, use the empty string —',
      'never invent a number. Do not opine on whether the method is good.',
      '',
      'SOURCE:',
      String(sourceText || '').slice(0, 24000)
    ].join('\n');
  }

  function hgOmniParseModelJson(text){
    if (typeof text !== 'string' || !text) return null;
    var s = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var start = s.indexOf('{');
    if (start < 0) return null;
    var depth = 0, i, ch;
    for (i = start; i < s.length; i++){
      ch = s.charAt(i);
      if (ch === '{') depth++;
      else if (ch === '}'){
        depth--;
        if (depth === 0){ try { return JSON.parse(s.slice(start, i + 1)); } catch (e2) { return null; } }
      }
    }
    return null;
  }

  function hgOmniMapRules(rules){
    if (!rules || typeof rules !== 'object') return null;
    var keys = hgOmniInventoryKeys(), vocab = hgOmniVocabulary();
    var tech = Array.isArray(rules.techniques) ? rules.techniques : [];
    var covered = [], gaps = [], unknown = [], i, t;
    for (i = 0; i < tech.length; i++){
      t = String(tech[i] || '').trim();
      if (!t) continue;
      if (keys[t]) covered.push({ key:t, label:keys[t].label, tabs:keys[t].tabs });
      else if (vocab.indexOf(t) >= 0) gaps.push(t);
      else unknown.push(t);
    }
    return {
      name: String(rules.name || 'unnamed method'),
      timeframe: String(rules.timeframe || ''), trigger: String(rules.trigger || ''),
      filters: Array.isArray(rules.filters) ? rules.filters.map(String) : [],
      invalidation: String(rules.invalidation || ''), target: String(rules.target || ''),
      covered: covered, gaps: gaps, unknown: unknown,
      verdict: gaps.length === 0 && covered.length > 0 ? 'ALREADY COVERED'
             : (covered.length === 0 ? 'NOT EXPRESSIBLE TODAY' : 'PARTIAL — ' + gaps.length + ' new gate(s) needed')
    };
  }

  /* ==================== settings + gateway I/O ==================== */

  function hgOmniLoadCfg(){
    var cfg = { endpoint: DEFAULT_ENDPOINT, token: '', model: DEFAULT_MODEL };
    try {
      if (typeof localStorage === 'undefined') return cfg;
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return cfg;
      var j = JSON.parse(raw);
      if (j && typeof j === 'object'){
        if (j.endpoint) cfg.endpoint = String(j.endpoint);
        if (j.token) cfg.token = String(j.token);
        if (j.model) cfg.model = String(j.model);
      }
    } catch (e) {}
    return cfg;
  }

  function hgOmniSaveCfg(cfg){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(LS_KEY, JSON.stringify({
        endpoint: String(cfg.endpoint || ''), token: String(cfg.token || ''), model: String(cfg.model || '')
      }));
      return true;
    } catch (e) { return false; }
  }

  function hgOmniFetchJson(url, opts, timeoutMs){
    if (typeof fetch !== 'function' || typeof AbortController !== 'function') return Promise.resolve(null);
    var ctl = new AbortController();
    var timer = setTimeout(function(){ try { ctl.abort(); } catch (e) {} }, timeoutMs);
    var o = opts || {};
    o.signal = ctl.signal;
    return fetch(url, o).then(function(r){
      return r.text().then(function(t){
        var j = null;
        try { j = JSON.parse(t); } catch (e) {}
        return { ok: r.ok, status: r.status, json: j, text: t };
      });
    }).catch(function(){ return null; }).then(function(v){ clearTimeout(timer); return v; });
  }

  function hgOmniPing(cfg){
    var base = String(cfg.endpoint || '').replace(/\/+$/, '');
    if (!base) return Promise.resolve({ ok:false, msg:'no endpoint set' });
    var headers = { 'Content-Type':'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    return hgOmniFetchJson(base + '/v1/models', { method:'GET', headers:headers }, PING_TIMEOUT_MS)
      .then(function(r){
        if (!r) return { ok:false, msg:'unreachable — gateway not running, or this page is not on your machine' };
        if (r.status === 401 || r.status === 403) return { ok:false, msg:'auth rejected (' + r.status + ')' };
        if (!r.ok) return { ok:false, msg:'HTTP ' + r.status };
        var n = (r.json && r.json.data && r.json.data.length) ? r.json.data.length : 0;
        return { ok:true, msg:'gateway up · ' + n + ' models' };
      });
  }

  function hgOmniCompleteOnce(cfg, prompt){
    var base = String(cfg.endpoint || '').replace(/\/+$/, '');
    var headers = { 'Content-Type':'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    return hgOmniFetchJson(base + '/v1/chat/completions', {
      method:'POST', headers:headers,
      body: JSON.stringify({ model: cfg.model || DEFAULT_MODEL,
        messages:[{ role:'user', content: prompt }], max_tokens:1400, stream:false })
    }, LLM_TIMEOUT_MS).then(function(r){
      if (!r) return { ok:false, msg:'gateway unreachable or timed out', retryable:true };
      if (!r.ok){
        var em = (r.json && r.json.error && r.json.error.message) ? r.json.error.message : ('HTTP ' + r.status);
        return { ok:false, msg:em, retryable: r.status !== 401 && r.status !== 403 };
      }
      var txt = '';
      try { txt = r.json.choices[0].message.content; } catch (e) {}
      if (!txt){
        var em2 = (r.json && r.json.error && r.json.error.message) ? r.json.error.message : 'provider returned no completion';
        return { ok:false, msg:em2, retryable:true };
      }
      return { ok:true, text:txt, model:(r.json && r.json.model) || '' };
    });
  }

  /* Retry once: measured ~1-in-3 first-attempt misses on the free pool
     (HTTP 200 with no choices when auto/* draws a rejecting provider). */
  function hgOmniComplete(cfg, prompt, onRetry){
    return hgOmniCompleteOnce(cfg, prompt).then(function(r){
      if (r.ok || !r.retryable) return r;
      if (typeof onRetry === 'function') { try { onRetry(r.msg); } catch (e) {} }
      return hgOmniCompleteOnce(cfg, prompt).then(function(r2){
        return r2.ok ? r2 : { ok:false, msg: r2.msg + ' (retried once)' };
      });
    });
  }

  /* ==================== render ==================== */

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  /* isFinite(null) is TRUE and +null is 0, so formatting a null through the
     natural guard prints a confident "0.00" for a value that is absent. Every
     cleared R:R and every venue field that legitimately arrives as null went
     through here. fin() maps null/undefined/'' to NaN first. */
  function fmt(n, d){ var v = fin(n); return isFinite(v) ? v.toFixed(d == null ? 4 : d) : '—'; }

  /* Price formatting scaled to magnitude. A flat 4 decimals rendered
     1000BONK as ENTRY 0.0023 / STOP 0.0024 — one apparent tick apart, with
     the real distance rounded away. Sub-cent perps are most of the CoinDCX
     universe, so fixed precision is not a cosmetic problem: it made the
     plan unreadable exactly where the stop matters most. */
  function fmtPx(n){
    if (n === null || n === undefined || n === '') return '—';
    var v = +n;
    if (!isFinite(v)) return '—';
    var a = Math.abs(v);
    var d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9;
    return v.toFixed(d);
  }
  function pill(txt, cls){ return '<span class="gpip ' + (cls || '') + '">' + esc(txt) + '</span>'; }

  /* 62th, 23th, 2th. Ordinals are not "th" for everything. */
  function ordinal(n){
    var v = Math.round(n), t = v % 100, u = v % 10;
    var suf = (t >= 11 && t <= 13) ? 'th' : (u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
    return v + suf;
  }

  function gateLine(g){
    /* An INFO gate does not veto, so it must not print VETO on a card whose
       badge says TICKET — the row would flatly contradict the header, and the
       reader resolves that however they like. Live output showed exactly
       that: "MET · TREND-RECLAIM LONG TICKET" with "VETO adx-trend" and
       "VETO atr-percentile" underneath it. Fixed on the gold desk in v356 and
       not carried across; this is the carry-across.

       An unevaluable CONDITIONAL gate reads UNCHECKED, not UNKNOWN — the
       distinction matters: it did not fail, it never ran. */
    var vetoed  = (g.pass === false) && !g.info;
    var against = (g.pass === false) && g.info;
    var cls = g.pass === true ? 'ok' : (vetoed ? 'bad' : '');
    var mark = g.pass === true ? 'PASS'
             : vetoed ? 'VETO'
             : against ? 'AGAINST'
             : (g.hard ? 'NO DATA' : 'UNCHECKED');
    return '<li>' + pill(mark, cls) + ' <b>' + esc(g.key) + '</b> <span class="dim">' + esc(g.why) + '</span></li>';
  }

  function setupCard(c){
    var head = esc(c.base || c.sym) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase());
    var ev = (c.grade.evaluated || 0), tot = (c.grade.total || 0);
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (tot){
      /* Evidence coverage sits next to the verdict, not buried in the list:
         a 4/12 ticket and a 12/12 ticket are not the same claim. */
      badge += ' ' + pill(ev + '/' + tot + ' checks', ev * 2 >= tot ? '' : 'bad');
    }
    if (c.grade.ticket && c.grade.degraded && c.grade.degraded.length){
      badge += ' <span class="dim">· ' + esc(c.grade.degraded.join(', ')) + ' unchecked</span>';
    }
    var h = '<div class="card">';
    h += '<div class="ttl">' + head + ' ' + badge + ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span></div>';
    if (c.alsoKinds && c.alsoKinds.length){
      /* Same entry, same stop, same targets — so this is ONE trade that
         several mechanics found, not several trades. */
      h += '<div class="dim">also fired here on identical levels: ' + esc(c.alsoKinds.join(', '))
        +  ' — ' + (c.alsoKinds.length + 1) + ' mechanics, one trade</div>';
    }
    h += '<div class="dim">' + esc(c.why) + '</div>';
    if (c.plan){
      h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry) + ' · STOP ' + fmtPx(c.plan.stop)
        +  ' · T1 ' + fmtPx(c.plan.t1) + ' · T2 ' + fmtPx(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b>'
        +  ' · risk ' + fmt(c.plan.riskPct, 2) + '%</div>';
      if (c.plan.note) h += '<div class="dim">' + esc(c.plan.note) + '</div>';
    } else {
      h += '<div class="dim">no plan — structure could not clear the ' + MIN_RR + 'R floor, so no levels are shown.</div>';
    }
    h += '<ul class="lst">';
    for (var i = 0; i < c.gates.length; i++) h += gateLine(c.gates[i]);
    h += '</ul>';
    h += '</div>';
    return h;
  }

  /* Pooled verdict for one mechanic — PURE, exported, and shared by both
     tabs' tables so the wording cannot drift between them.
     Judged by SIGNIFICANCE and SYMMETRICALLY: the table used to read "has
     paid" on any positive expectancy while only calling failure at -2 sigma,
     so a +0.27 sigma result — noise — was presented as proven. A verdict
     must be as hard to earn as it is to lose.
     `need` answers the question a "within noise" row invites: how many
     NON-OVERLAPPING trades would settle this at 2 sigma, given the effect
     size observed so far. A tiny edge returns a huge number, which is itself
     the useful answer. */
  /* "(needs ~35379)" is arithmetically correct and tells the reader nothing.
     A required sample size that large is not a target, it is the statement
     that the observed edge is indistinguishable from zero — so say that
     instead of printing a number nobody can act on. */
  function needText(need){
    if (!need || !isFinite(need)) return '';
    if (need > 5000) return ' <span class="dim">(edge too small to confirm at any realistic sample size)</span>';
    return ' <span class="dim">(needs ~' + need + ')</span>';
  }

  /* THE TABLE AND THE GATE JUDGED THE SAME NUMBER AGAINST DIFFERENT BARS.

     This table said "has paid" at +2.00 sigma. The measured-edge gate credits
     a mechanic only at the FAMILY-WISE bar — +2.89 sigma across 27 crypto
     mechanics, +2.97 across 34 gold ones — and says so on the card: "34
     mechanics scanned, so +2.97 sigma is the bar before one this good means
     anything". So a mechanic between those two thresholds was printed in
     green as PAID in the summary the reader looks at first, while the ledger
     refused to credit it. That is the same contradiction fixed in v377 for
     the negative direction (the table read "has not paid" while the gate
     printed PASS); this is its mirror image, left behind.

     Worse, the "needs ~N" column solved for z = 2. The formula is
     n = z^2 * p(1-p) / edge^2, so aiming at 2.00 instead of 2.97 understates
     the sample by 2.2x. A live gold row read "AVWAP-RECLAIM 29 samples (needs
     ~42)" when the ledger will not credit it before ~94 — the column was
     coaching the reader toward a bar this desk does not accept.

     Both now take the same bar the gate uses. A desk that does not supply one
     gets the family-wise bar rather than the lone 5% threshold, because
     reporting whichever of N mechanics looks best and then judging it at
     +2 sigma is precisely the multiple-comparisons error this whole design
     exists to prevent. */
  function hgOmniPoolRead(p, minRr, minSamples, barZ){
    if (!p || !p.samples) return { z: NaN, read: 'never fired', need: null, cls: '', bar: NaN };
    var rr = isFinite(+minRr) ? +minRr : MIN_RR;
    var thin = p.samples < (isFinite(+minSamples) ? +minSamples : MIN_SAMPLES);
    var bar = (isFinite(+barZ) && +barZ > 0) ? +barZ : hgOmniFamilyZ(OMNI_ALL_MECHANICS.length);
    var pBreak = 1 / (1 + rr);
    var se = Math.sqrt(pBreak * (1 - pBreak) / Math.max(1, p.samples));
    var z = se > 0 ? ((p.hit - pBreak) / se) : 0;
    var read = thin ? 'too few to judge'
             : (z >= bar ? 'has paid' : (z <= EDGE_VETO_Z ? 'has not paid' : 'within noise'));
    var cls = thin ? '' : (z >= bar ? 'ok' : (z <= EDGE_VETO_Z ? 'bad' : ''));
    var need = null;
    if (!thin && z > 0 && z < bar){
      var edge = p.hit - pBreak;
      if (edge > 0){
        var n = Math.ceil(bar * bar * pBreak * (1 - pBreak) / (edge * edge));
        if (isFinite(n) && n > p.samples) need = n;
      }
    }
    return { z: z, read: read, need: need, cls: cls, bar: bar };
  }

  /* Forward column: settled count, hit rate, and how many are still open.
     Reads "—" until trades settle, which is the honest day-one state. */
  function fwdCell(f){
    if (!f || (!f.samples && !f.open && !f.stale)) return '<span class="dim">—</span>';
    /* STALE is shown apart from OPEN. A record whose bars were never going to
       arrive — the contract was delisted, renamed, or simply stopped being
       scanned — is not a trade still running, and counting the two together
       overstates how much evidence is still in flight. */
    var st = (f.stale > 0) ? (' <span class="dim">· ' + f.stale + ' stale</span>') : '';
    if (!f.samples) return '<span class="dim">' + (f.open || 0) + ' open</span>' + st;
    return '<b>' + f.samples + '</b> · ' + (f.hit * 100).toFixed(0) + '%'
         + (f.open ? (' <span class="dim">(+' + f.open + ' open)</span>') : '') + st;
  }

  /* Pooled walk-forward result per detector. This is the tab's honest
     self-assessment: which of the six mechanics actually resolved to T1
     before stop on the history just scanned. Thin pools are labelled rather
     than rounded into a confident-looking percentage. */
  function renderPooled(pool){
    if (!pool) return '';
    var keys = OMNI_ALL_MECHANICS.slice(), h, i, k, p;
    /* Out-of-sample counts for the same detectors. Unlike every other column
       here, these are not re-read from the current window — they accumulate
       one record per firing across scans. */
    var fwdPool = null;
    if (typeof window !== 'undefined' && typeof window.hgFwdPool === 'function'){
      try { fwdPool = window.hgFwdPool('OMNIROUTE'); } catch (e) { fwdPool = null; }
    }
    h = '<table class="tbl"><thead><tr><th>DETECTOR</th><th>SAMPLES</th><th>T1-FIRST</th><th>EXPECTANCY</th><th>σ</th><th>READ</th><th>FORWARD</th></tr></thead><tbody>';
    for (i = 0; i < keys.length; i++){
      k = keys[i]; p = pool[k];
      var fwdTxt = fwdCell(fwdPool ? fwdPool[k] : null);
      /* A forward-only mechanic has no in-sample row to show and never will.
         Saying "never fired here" would read as a broken detector. */
      if (OMNI_FWD_ONLY.indexOf(k) >= 0){
        h += '<tr><td><b>' + k + '</b></td><td class="dim">—</td><td class="dim">—</td><td class="dim">—</td>'
           + '<td class="dim">—</td><td class="dim">forward-only — no historical funding/OI to replay</td>'
           + '<td>' + fwdTxt + '</td></tr>';
        continue;
      }
      if (!p || !p.samples){
        h += '<tr><td><b>' + k + '</b></td><td class="dim">0</td><td class="dim">—</td><td class="dim">—</td><td class="dim">—</td><td class="dim">never fired in this history</td><td>' + fwdTxt + '</td></tr>';
        continue;
      }
      /* The same bar measured-edge uses, so the table and the card cannot
         disagree about one number. */
      var v = hgOmniPoolRead(p, MIN_RR, MIN_SAMPLES, hgOmniFamilyZ(OMNI_ALL_MECHANICS.length));
      var z = v.z, read = v.read, cls = v.cls;
      var needTxt = needText(v.need);
      h += '<tr><td><b>' + k + '</b></td>'
        + '<td>' + p.samples + needTxt + '</td>'
        + '<td>' + (p.hit * 100).toFixed(0) + '%</td>'
        + '<td>' + (p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R</td>'
        + '<td>' + (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ</td>'
        + '<td>' + pill(read, cls) + '</td>'
        + '<td>' + fwdTxt + '</td></tr>';
    }
    h += '</tbody></table>';
    h += '<div class="note">Walk-forward on the same bars the scan just read: each past firing is taken at the bar close, '
      +  'stopped at the ' + 10 + '-bar structural extreme (ATR fallback), targeted at ' + MIN_RR + 'R, and given 20 bars to resolve. '
      +  '<b>When one bar spans both stop and target it is counted a STOP</b> — candles cannot say which printed first, and the '
      +  'optimistic reading is how backtests flatter themselves. So these are floors. '
      +  'They are also in-sample on a short window: treat under ' + MIN_SAMPLES + ' samples as noise, and do not size on any of it '
      +  'until you have run it forward yourself.</div>';
    return h;
  }

  function renderMatrix(){
    var m = hgOmniCoverageMatrix(), h = '<table class="tbl"><thead><tr><th>SCHOOL</th><th>TEACHES</th><th>OURS</th><th>STILL MISSING</th></tr></thead><tbody>', i, r;
    for (i = 0; i < m.length; i++){
      r = m[i];
      h += '<tr><td><b>' + esc(r.school) + '</b></td><td class="dim">' + esc(r.taught) + '</td>'
        +  '<td>' + pill(r.verdict, r.verdict === 'COVERED' ? 'ok' : (r.verdict === 'GAP' ? 'bad' : ''))
        +  ' <span class="dim">' + r.have.length + '/' + (r.have.length + r.miss.length) + '</span></td>'
        +  '<td class="dim">' + (r.miss.length ? esc(r.miss.join(', ')) : '—') + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  function renderProposal(mapped, modelName){
    if (!mapped) return '<div class="empty">could not parse a strategy out of that source.</div>';
    var h = '<div class="panel-in"><h3>' + esc(mapped.name) + '</h3>';
    if (modelName) h += '<div class="note dim">extracted by ' + esc(modelName) + ' — the model’s reading of the source, not verified fact.</div>';
    h += '<table class="tbl"><tbody>';
    if (mapped.timeframe) h += '<tr><th>timeframe</th><td>' + esc(mapped.timeframe) + '</td></tr>';
    if (mapped.trigger) h += '<tr><th>trigger</th><td>' + esc(mapped.trigger) + '</td></tr>';
    if (mapped.filters.length) h += '<tr><th>filters</th><td>' + esc(mapped.filters.join(' · ')) + '</td></tr>';
    if (mapped.invalidation) h += '<tr><th>invalidation</th><td>' + esc(mapped.invalidation) + '</td></tr>';
    if (mapped.target) h += '<tr><th>target</th><td>' + esc(mapped.target) + '</td></tr>';
    h += '</tbody></table><h4>maps onto our gates</h4>';
    if (mapped.covered.length){
      h += '<ul class="lst">';
      for (var i = 0; i < mapped.covered.length; i++){
        h += '<li>' + pill('HAVE','ok') + ' ' + esc(mapped.covered[i].label) + ' <span class="dim">→ ' + esc(mapped.covered[i].tabs.join(', ')) + '</span></li>';
      }
      h += '</ul>';
    } else h += '<div class="empty">nothing here maps to an existing gate.</div>';
    if (mapped.gaps.length){
      h += '<h4>would need new gates</h4><ul class="lst">';
      for (var j = 0; j < mapped.gaps.length; j++) h += '<li>' + pill('BUILD','bad') + ' ' + esc(mapped.gaps[j]) + '</li>';
      h += '</ul>';
    }
    if (mapped.unknown.length) h += '<div class="note warn">off-vocabulary terms ignored: ' + esc(mapped.unknown.join(', ')) + '</div>';
    return h + '<div class="note">Research note. No rule becomes a gate until it is coded and backtested against our own data.</div></div>';
  }


  /* ==================== the parameter grid ====================

     THE QUESTION THIS ANSWERS: "why doesn't any of it work?"

     The pooled table measures every mechanic at ONE setting — a 2R target
     with a 20-bar horizon — because that is what MIN_RR and the scan config
     say. Twenty-two mechanics all sitting at breakeven there is not
     twenty-two broken mechanics; twenty-two independent things do not fail in
     one tidy gradient. It is one frame applied to all of them.

     Swept on synthetic tapes, the SAME six original detectors ran from
     -18.7 sigma at 3R/10 bars to +2.5 sigma at 1.5R/40 bars. Nothing about
     the detectors changed between those numbers. Target and horizon were
     doing all the work.

     This runs that sweep on the REAL bars the scan just fetched, so the
     question is answered with this desk's own data instead of a simulation.

     It is IN-SAMPLE and GROSS of costs, exactly like the pooled table, and it
     is a diagnostic rather than a recommendation: the best cell of nine is
     the best of nine searches, and the multiple-comparisons bar applies to
     picking a parameter set just as much as to picking a mechanic. It is
     labelled as such on the panel. */

  /* 25, not 60. Twelve settings x six detectors over sixty contracts is ~45
     seconds of arithmetic; the grid answers whether the PARAMETERS move the
     result, and twenty-five contracts of real bars answer that with several
     hundred settled trades per cell. */
  var GRID_SAMPLE = 25;
  var GRID_R = [1, 1.5, 2, 3];
  var GRID_H = [10, 20, 40];

  /* The SIX ORIGINAL detectors only, not all twenty-two.

     Two reasons, and neither is a shortcut. The shared mechanics carry
     genuinely expensive reads — volume profile, cointegration, a GARCH fit —
     and running all of them twelve times took 197 SECONDS on twenty-five
     contracts, which is a frozen tab, not a button. And the question here is
     whether the PARAMETERS move the result, which the six core detectors
     answer at least as well: they have by far the deepest pools, and holding
     the mechanic set fixed is what makes the rows comparable at all. */
  var GRID_MECHS = ['SPRING', 'PO3', 'ORB', 'ABSORB', 'VALUE', 'MMOVE'];

  function hgOmniGridFns(){
    return {
      SPRING: function(r){ var g = hgOmniRange(r, RANGE_LOOKBACK); return g ? hgOmniSpring(r, g) : null; },
      PO3:    function(r){ return hgOmniPo3(r, 6); },
      ORB:    function(r){ return hgOmniOrb(r, ORB_BARS); },
      ABSORB: function(r){ var g = hgOmniRange(r, RANGE_LOOKBACK); return g ? hgOmniAbsorb(r, g) : null; },
      VALUE:  function(r){ var g = hgOmniProfile(r, 24); return g ? hgOmniValueReject(r, g) : null; },
      MMOVE:  function(r){ return hgOmniMeasuredMove(r, 10); }
    };
  }

  function hgOmniGridRun(rowsList, rMult, horizon){
    var wins = 0, losses = 0, i, j, p;
    var fns = hgOmniGridFns();
    for (i = 0; i < rowsList.length; i++){
      for (j = 0; j < GRID_MECHS.length; j++){
        try { p = hgOmniBacktestOne(rowsList[i], fns[GRID_MECHS[j]], { rMult: rMult, horizon: horizon, warm: 45 }); }
        catch (e) { continue; }
        if (!p || !p.samples) continue;
        wins += (p.wins || 0); losses += (p.losses || 0);
      }
    }
    var settled = wins + losses;
    if (!settled) return null;
    var hit = wins / settled;
    var be = 1 / (1 + rMult);
    var se = Math.sqrt(be * (1 - be) / settled);
    return { settled: settled, hit: hit, be: be,
             expR: hit * rMult - (1 - hit),
             z: se > 0 ? (hit - be) / se : 0 };
  }

  /* PROGRESSIVE, not blocking. Twelve settings over sixty contracts is tens
     of seconds of pure arithmetic, and doing it in one synchronous pass
     freezes the tab for the duration — the scan itself chunks for exactly
     this reason. One cell per turn, rows appended as they land, so the table
     fills in front of the user and the page stays alive. */
  function hgOmniGridCells(){
    var out = [], ri, hi;
    for (ri = 0; ri < GRID_R.length; ri++)
      for (hi = 0; hi < GRID_H.length; hi++)
        out.push({ r: GRID_R[ri], h: GRID_H[hi] });
    return out;
  }

  function hgOmniGridRowHTML(cell, c){
    var live = (cell.r === MIN_RR && cell.h === 20);
    if (!c){
      return '<tr><td>' + cell.r + 'R</td><td>' + cell.h + '</td>'
           + '<td class="dim" colspan="5">no settled samples at this setting</td></tr>';
    }
    var cls = c.z >= 2 ? 'ok' : (c.z <= -2 ? 'bad' : '');
    return '<tr' + (live ? ' style="font-weight:600"' : '') + '>'
         + '<td>' + cell.r + 'R' + (live ? ' <span class="dim">&larr; live</span>' : '') + '</td>'
         + '<td>' + cell.h + '</td>'
         + '<td>' + c.settled + '</td>'
         + '<td>' + (c.hit * 100).toFixed(1) + '%</td>'
         + '<td class="dim">' + (c.be * 100).toFixed(1) + '%</td>'
         + '<td>' + (c.expR >= 0 ? '+' : '') + c.expR.toFixed(3) + 'R</td>'
         + '<td class="' + cls + '">' + (c.z >= 0 ? '+' : '') + c.z.toFixed(2) + 'σ</td></tr>';
  }

  function hgOmniGridNote(best){
    var n = GRID_R.length * GRID_H.length;
    var h = '<div class="note">Same detectors, same bars, same stop model &mdash; only the TARGET and '
      + 'the HORIZON change between rows. A gradient across them is the parameters doing the work, not '
      + 'the mechanics failing. The row marked <b>live</b> is what this tab actually trades and measures.'
      + '<br><br><b>This is a diagnostic, not a recommendation.</b> Every figure is IN-SAMPLE on the '
      + 'window just scanned and GROSS of spread and commission, exactly like the pooled table. The best '
      + 'of ' + n + ' cells is the best of ' + n + ' searches: the multiple-comparisons bar that applies '
      + 'to picking a mechanic applies to picking a parameter set, so a cell clearing +2σ here is not '
      + 'evidence on its own. Change the live setting only after the forward log has measured it.</div>';
    if (best){
      h += '<div class="note">Strongest cell on this window: <b>' + best.r + 'R / ' + best.h
         + ' bars</b> at ' + (best.z >= 0 ? '+' : '') + best.z.toFixed(2) + 'σ ('
         + (best.expR >= 0 ? '+' : '') + best.expR.toFixed(3) + 'R). Live is ' + MIN_RR + 'R / 20 bars.</div>';
    }
    return h;
  }

  /* Synchronous whole-grid build. Kept because it is what a test can call
     directly; the tab uses the progressive runner below. */
  function hgOmniGridHTML(rowsList){
    if (!rowsList || !rowsList.length){
      return '<div class="note warn">No bars retained &mdash; run a scan first, then the grid.</div>';
    }
    var cells = hgOmniGridCells(), best = null, body = '', i, c;
    for (i = 0; i < cells.length; i++){
      c = hgOmniGridRun(rowsList, cells[i].r, cells[i].h);
      if (c && (!best || c.z > best.z)) best = { r: cells[i].r, h: cells[i].h, z: c.z, expR: c.expR };
      body += hgOmniGridRowHTML(cells[i], c);
    }
    return hgOmniGridHead() + body + '</tbody></table>' + hgOmniGridNote(best);
  }

  function hgOmniGridHead(){
    return '<h4>PARAMETER GRID &mdash; the same mechanics at other targets and horizons</h4>'
         + '<table class="tbl"><thead><tr><th>TARGET</th><th>HORIZON</th><th>SETTLED</th>'
         + '<th>T1-FIRST</th><th>BREAKEVEN</th><th>EXPECTANCY</th><th>σ</th></tr></thead><tbody>';
  }

  /* One cell per turn. onProgress(html, done, total) after each. */
  function hgOmniGridProgressive(rowsList, onProgress, onDone){
    if (!rowsList || !rowsList.length){
      onDone('<div class="note warn">No bars retained &mdash; run a scan first, then the grid.</div>');
      return;
    }
    var cells = hgOmniGridCells(), i = 0, best = null, body = '';
    function step(){
      if (i >= cells.length){
        onDone(hgOmniGridHead() + body + '</tbody></table>' + hgOmniGridNote(best));
        return;
      }
      var cell = cells[i];
      var c = null;
      try { c = hgOmniGridRun(rowsList, cell.r, cell.h); } catch (e) { c = null; }
      if (c && (!best || c.z > best.z)) best = { r: cell.r, h: cell.h, z: c.z, expR: c.expR };
      body += hgOmniGridRowHTML(cell, c);
      i++;
      onProgress(hgOmniGridHead() + body + '</tbody></table>'
        + '<div class="note">measuring &hellip; ' + i + ' of ' + cells.length + ' settings</div>', i, cells.length);
      setTimeout(step, 0);
    }
    setTimeout(step, 0);
  }


  /* WHY ARE THERE NO TICKETS?

     A scan can report "230 setups, 0 tickets" and give no way to find out
     which gate is responsible. Every card carries its own ledger, but reading
     fifty cards to spot the common veto is not a diagnosis, it is a chore —
     and it is exactly the question that matters when the tab goes quiet.

     This reads the LAST SCAN already held in memory and tallies it: which
     gates vetoed, how often, and the reason each one gave most frequently.
     No refetch, no recompute — it is reporting on work already done.

     Deliberately blunt about the difference between "vetoed" and "could not
     be evaluated". A gate that never ran is not the reason a ticket failed,
     and conflating the two sends you chasing the wrong thing. */
  function hgWhyNoTicketsFrom(rows, label){
    if (!rows || !rows.length){
      return label + ': no scan in memory — run a scan first, then ask again.';
    }
    var vetoes = {}, whys = {}, unchecked = {}, tickets = 0, i, j, g, c;
    for (i = 0; i < rows.length; i++){
      c = rows[i];
      if (c && c.grade && c.grade.ticket) tickets++;
      if (!c || !c.gates) continue;
      for (j = 0; j < c.gates.length; j++){
        g = c.gates[j];
        if (!g) continue;
        if (g.pass === false && g.info !== true){
          vetoes[g.key] = (vetoes[g.key] || 0) + 1;
          if (!whys[g.key]) whys[g.key] = {};
          var w = String(g.why || '').slice(0, 90);
          whys[g.key][w] = (whys[g.key][w] || 0) + 1;
        } else if (g.pass === null && g.hard === true){
          /* hard + UNCHECKED also blocks a ticket, and is a DATA problem
             rather than a judgement — worth separating. */
          unchecked[g.key] = (unchecked[g.key] || 0) + 1;
        }
      }
    }
    var out = [];
    out.push('=== ' + label + ' ===');
    out.push('  candidates : ' + rows.length);
    out.push('  TICKETS    : ' + tickets);
    if (tickets === rows.length){
      out.push('  everything cleared — nothing to explain.');
      return out.join('\n');
    }
    var order = Object.keys(vetoes).sort(function(a, b){ return vetoes[b] - vetoes[a]; });
    if (!order.length){
      out.push('  no gate vetoed anything.');
    } else {
      out.push('');
      out.push('  VETOED BY (a single veto is enough to stop a ticket):');
      for (i = 0; i < order.length; i++){
        var k = order[i], n = vetoes[k];
        out.push('    ' + (k + '                    ').slice(0, 20)
               + String(n).padStart(4) + '  (' + (n / rows.length * 100).toFixed(0) + '% of candidates)');
        /* The reason it gave most often — that is the actual diagnosis. */
        var ws = Object.keys(whys[k]).sort(function(a, b){ return whys[k][b] - whys[k][a]; });
        if (ws.length) out.push('        most often: ' + ws[0]);
      }
    }
    var uOrder = Object.keys(unchecked).sort(function(a, b){ return unchecked[b] - unchecked[a]; });
    if (uOrder.length){
      out.push('');
      out.push('  HARD GATES THAT COULD NOT BE EVALUATED (a data problem, not a judgement):');
      for (i = 0; i < uOrder.length; i++){
        out.push('    ' + (uOrder[i] + '                    ').slice(0, 20)
               + String(unchecked[uOrder[i]]).padStart(4));
      }
    }
    out.push('');
    out.push('  A candidate needs EVERY veto-capable gate to pass. Fix the gate at the');
    out.push('  top of that list first: it is blocking the most setups.');
    return out.join('\n');
  }

  /* ==================== the scan ==================== */

  function omniSleep(ms){
    return new Promise(function(ok){ setTimeout(ok, ms); });
  }

  function omniErrMsg(e){
    return (e && e.message) ? e.message : String(e);
  }

  function omniSafeStat(ui, msg){
    try{ if (ui && ui.stat) ui.stat.textContent = msg; }catch(e){}
  }

  function runScan(ui){
    if (__omni.busy) return Promise.resolve();
    var W = (typeof window !== 'undefined') ? window : null;
    if (!W || typeof W.xuUniverse !== 'function' || typeof W.xuCandles !== 'function'){
      omniSafeStat(ui, 'xuniverse.js unavailable — no venue universe, scan disabled.');
      return Promise.resolve();
    }
    __omni.busy = true;
    ui.btn.disabled = true;
    ui.cards.innerHTML = '';
    omniSafeStat(ui, 'loading Delta + CoinDCX universe…');

    /* Warm the regime read once per scan. regimeState() stays null until the
       REGIME tab has run, which is why every live card reported "regime
       module has not run" — the gate was structurally unreachable for anyone
       who had not opened that tab first. regime.js registers a headless
       warmup on HG_warmups for exactly this; it returns 'fresh' when already
       computed, so this is cheap on repeat scans. Best-effort: a failure
       leaves the gate UNCHECKED, which is its honest previous state. */
    /* News is warmed the same way and for the same reason: its gate is
       otherwise stuck reporting a default. Best-effort and never fatal. */
    function warmNews(){
      return Promise.resolve().then(function(){
        var hooks = W.HG_warmups;
        if (!hooks || !hooks.length) return null;
        var nw = null, i;
        for (i = 0; i < hooks.length; i++) if (hooks[i] && hooks[i].id === 'news') nw = hooks[i];
        if (!nw || typeof nw.run !== 'function') return null;
        omniSafeStat(ui, 'warming news calendar…');
        return nw.run();
      }).catch(function(){ return null; });
    }

    function warmRegime(){
      return Promise.resolve().then(function(){
        if (typeof W.regimeState === 'function' && W.regimeState()) return 'fresh';
        var hooks = W.HG_warmups;
        if (!hooks || !hooks.length) return 'no warmup registered';
        var rg = null, i;
        for (i = 0; i < hooks.length; i++) if (hooks[i] && hooks[i].id === 'regime') rg = hooks[i];
        if (!rg || typeof rg.run !== 'function') return 'no regime warmup';
        omniSafeStat(ui, 'warming market regime…');
        return rg.run();
      }).then(function(r){
        __omni.regimeWarm = (r == null) ? 'no result' : String(r);
        return r;
      }).catch(function(e){
        __omni.regimeWarm = 'threw: ' + ((e && e.message) || e);
        return null;
      }).then(function(){
        /* If the 8-gauge module produced nothing, fall back to a BTC daily
           read off Binance klines — one request, an endpoint this scan
           already relies on. Failure here simply leaves the gate UNCHECKED. */
        __omni.regimeProxy = null;
        if (typeof W.regimeState === 'function' && W.regimeState()) return null;
        if (typeof W.binanceKlines !== 'function') return null;
        return Promise.resolve().then(function(){ return W.binanceKlines('BTCUSDT', '1d', 120); })
          .then(function(rows){ __omni.regimeProxy = hgOmniBtcRegime(rows); })
          .catch(function(){ __omni.regimeProxy = null; });
      });
    }

    /* A REJECTED xuUniverse() is the same situation as a returned [] — no
       universe — so route it to the same honest message instead of the
       generic catch. The distinction matters to the reader: "no contracts
       came back" is a data-source problem, not a quiet market. Also guards
       a synchronous throw, which .then() alone would not catch. */
    var uniErr = null;
    return warmRegime().then(warmNews).then(function(){ return W.xuUniverse(); })
      .catch(function(err){ uniErr = omniErrMsg(err); return null; })
      .then(function(uni){
      uni = uni || [];
      if (!uni.length){
        omniSafeStat(ui, 'universe empty — both venue legs failed'
          + (uniErr ? (' (' + uniErr + ')') : '')
          + '. Nothing to scan — this is a data-source problem, not a setup drought.');
        return null;
      }
      var note = (typeof W.xuUniverseNote === 'function') ? W.xuUniverseNote() : null;
      try{
        if (note){ ui.warn.textContent = note; ui.warn.style.display = 'block'; }
        else { ui.warn.style.display = 'none'; }
      }catch(eW){}

      /* Delta + CoinDCX desks only — skip extension legs the tab does not trade */
      var list = (TOP_N > 0) ? uni.slice(0, TOP_N) : uni.filter(function(item){
        return item && (item.exchange === 'delta' || item.exchange === 'coindcx');
      });
      var fired = [], done = 0, thin = 0, failed = 0, pass1Err = null;
      __omni.xsRescued = 0;   /* per scan, never carried over from the last one */
      /* Contracts that fired NOTHING in pass 1, held so the cross-sectional
         mechanics can still reach them once the universe ranks exist. See the
         rescue below. */
      var unfired = [];
      var xsAll = [], xsRanks = null;

      /* ---- PASS 1: detect over EVERY contract. Candles only, no extra
         network per name, so this stays linear in the universe size. ---- */
      function step(i){
        if (i >= list.length) return Promise.resolve();
        var slice = list.slice(i, i + CHUNK);
        return Promise.all(slice.map(function(item){
          return Promise.resolve().then(function(){
            return W.xuCandles(item, TF, BARS);
          }).then(function(rows){
            done++;
            if (done % 5 === 0 || done === list.length){
              omniSafeStat(ui, 'pass 1/2 · scanning ' + done + '/' + list.length
                + ' contracts — ' + fired.length + ' fired');
            }
            /* Closed candles only — see hgOmniDropForming. Applied HERE, at
               the single ingestion point, so every downstream consumer
               (detectors, gates, walk-forward measurement) sees the same
               closed set and none of them can disagree about the last bar. */
            rows = hgOmniDropForming(rows, TF);
            if (!rows || rows.length < 60){ thin++; return; }
            /* FORWARD LOG resolution. This sweep already holds fresh bars for
               every contract, so it is the cheapest place in the app to settle
               open forward records — BEST/SWING/SCALP record them, this pass
               resolves them, and neither tab needs to know about the other.
               Bars here are 4h; a 1h scalp record settled by a 4h bar is
               resolved more COARSELY, which under the "one bar spanning both
               levels counts as a stop" rule biases pessimistic. That is the
               safe direction, so it is allowed rather than skipped. */
            if (typeof W.hgFwdResolve === 'function'){
              try { W.hgFwdResolve(item.sym, null, rows); }
              catch (e) { try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('omniroute:resolve', e); } catch (eW) {} }
            }
            /* CROSS-SECTIONAL SUMMARY for every contract, fired or not.
               Four numbers, no network: pass 1 already holds these bars and
               was throwing away everything that did not fire, which is
               exactly the data a universe-relative read needs. */
            var xsSum = hgOmniXsSummary(item.sym, rows);
            if (xsSum) xsAll.push(xsSum);
            /* Detect WITHOUT the cross-section here: the ranks are not known
               until every contract has been seen. Pass 2 re-detects the fired
               names with the universe in hand. */
            var hits = hgOmniDetect(rows);
            if (hits.length) fired.push({ item: item, rows: rows, hits: hits });
            else unfired.push({ item: item, rows: rows });
          }).catch(function(){ done++; failed++; });
        })).then(function(){
          if (i + CHUNK >= list.length) return;
          return omniSleep(CHUNK_DELAY_MS).then(function(){ return step(i + CHUNK); });
        });
      }

      return step(0).catch(function(e1){
        pass1Err = omniErrMsg(e1);
        try{ console.warn('omniroute pass 1 error — continuing with partial', e1); }catch(eL){}
      }).then(function(){
        /* ---- PASS 2: enrich ONLY what fired. Walk-forward measurement is
           O(bars x detectors) per symbol, and the Binance/depth calls are
           per-symbol network — confining both to hits is what makes a
           full-universe scan viable at all. ---- */
        /* Universe ranks, once pass 1 has seen every contract. Refuses under
           30 names, because a percentile of a handful is not a percentile. */
        xsRanks = hgOmniXsRanks(xsAll);

        /* CROSS-SECTIONAL RESCUE.

           XS-LEADER and XS-LAGGARD are the only mechanics on this desk that
           cannot be evaluated in pass 1: a contract's rank is not known until
           every contract has been seen, which is the whole reason for two
           passes. But pass 1 decided who reached pass 2 on `hits.length`, and
           those hits were detected WITHOUT the cross-section. So a contract
           that is the strongest or weakest name in the universe, but happened
           to have no price mechanic firing on its own candles, was dropped
           before the cross-section was ever computed. It could never produce
           a card, however extreme it was.

           Measured on a 300-contract synthetic universe: XS fires on 20% of
           names, and 5% of those fires had no price mechanic alongside them —
           1% of the universe, silently gone. On a 524-contract live scan that
           is roughly five contracts, and they are by construction the tails.

           The rescue costs nothing to speak of. 93% of contracts already fire
           something and their bars were being retained anyway, so holding the
           remaining 7% adds a fraction to a list the scan already carries, and
           no network call: the cross-sectional read needs only bars pass 1 has
           already fetched. */
        try {
          var resc = 0, ru, rx;
          if (xsRanks){
            for (ru = 0; ru < unfired.length; ru++){
              var uc = unfired[ru];
              if (!uc || !uc.item || !uc.rows) continue;
              rx = hgOmniXsLeader(uc.rows, xsRanks, uc.item.sym);
              if (!rx) continue;
              fired.push({ item: uc.item, rows: uc.rows, hits: [rx] });
              resc++;
            }
          }
          if (resc) __omni.xsRescued = resc;
        } catch (eXs){
          try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('omniroute:xs-rescue', eXs); } catch (eW2) {}
        }
        /* Bars are only needed for the rescue; release them before pass 2
           holds a full universe of candles alongside its own working set. */
        unfired.length = 0;

        /* WHICH 120 GET THE FULL LEDGER.

           This was fired.slice(0, ENRICH_MAX) — the first 120 contracts to
           come back from the network, which is a race order, not a merit
           order. A live scan fired ~490 names: 120 got funding, open
           interest, retail, taker flow and book depth, and 370 got hard gates
           and a plan only. Which 370 was decided by whichever venue leg
           happened to answer slowest. That is the real reason most cards
           could not use most of the indicators.

           Ranked now, on evidence already in hand and costing nothing:

             1. how many independent mechanic FAMILIES agree on a direction —
                the same measure the consensus gate uses, and the one thing
                that most predicts whether a name will become a ticket
             2. how many mechanics fired at all
             3. how much cross-sectional conviction there is: a contract at
                either extreme of the universe is more worth measuring than
                one in the middle

           Names beyond the cap still get hard gates and a plan; they are just
           no longer chosen by network luck. */
        var xsRankOf = function(sym){
          if (!xsRanks || !xsRanks.rank) return 0.5;
          var r = fin(xsRanks.rank[String(sym)]);
          return isFinite(r) ? r : 0.5;
        };
        var enrichMerit = function(f){
          var fams = {}, i, h, best = 0, dir;
          for (i = 0; i < f.hits.length; i++){
            h = f.hits[i];
            if (!h || (h.dir !== 'long' && h.dir !== 'short')) continue;
            dir = h.dir;
            if (!fams[dir]) fams[dir] = {};
            fams[dir][hgOmniFamilyOf(h.kind)] = true;
          }
          for (dir in fams){
            if (!Object.prototype.hasOwnProperty.call(fams, dir)) continue;
            var n = 0, k;
            for (k in fams[dir]) if (Object.prototype.hasOwnProperty.call(fams[dir], k)) n++;
            if (n > best) best = n;
          }
          /* distance from the middle of the universe, 0 .. 0.5 */
          var edge = Math.abs(xsRankOf(f.item && f.item.sym) - 0.5);
          return best * 1000 + f.hits.length * 10 + edge * 10;
        };
        var meritOrder = fired.slice().sort(function(a, b){ return enrichMerit(b) - enrichMerit(a); });
        /* Keep the bars for the strongest names so the parameter grid can run
           on REAL data without a second fetch. Capped: the grid answers a
           question about the mechanics, not about every contract. */
        __omni.gridRows = meritOrder.slice(0, GRID_SAMPLE).map(function(f){ return f.rows; });

        var subset = meritOrder.slice(0, ENRICH_MAX);
        var perSymbolStats = [], enriched = [], e = 0;

        function enrichOne(f){
          var base = f.item.base || '';
          var binSym = base ? (base + 'USDT') : null;
          var jobs = [
            (typeof W.binanceOIHistory === 'function' && binSym) ? W.binanceOIHistory(binSym, '4h', 12).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.binanceLongShort === 'function' && binSym) ? W.binanceLongShort(binSym, '4h', 6).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.binanceTakerRatio === 'function' && binSym) ? W.binanceTakerRatio(binSym, '4h', 6).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.binanceDepth === 'function' && binSym) ? W.binanceDepth(binSym, 20).catch(function(){ return null; }) : Promise.resolve(null)
          ];
          return Promise.all(jobs).then(function(r){
            e++;
            omniSafeStat(ui, 'pass 2/2 · measuring ' + e + '/' + subset.length + ' fired contracts…');
            var oiH = r[0], ls = r[1], tk = r[2], dep = r[3];
            var oiChange = null;
            if (oiH && oiH.series && oiH.series.length >= 2){
              var a = oiH.series[0].oi, b = oiH.series[oiH.series.length - 1].oi;
              if (isFinite(a) && a > 0 && isFinite(b)) oiChange = (b - a) / a * 100;
            }
            /* 180 x 4h is ~30 calendar days, so ~31 daily bars. The old code
               asked emaOf() for a 50-period daily EMA, which needs 50 bars and
               returned NaN every time — that is exactly why every live card
               read "htf-daily UNCHECKED — daily bars unavailable". Use periods
               the available history can actually support. */
            var htf = hgOmniDailyHtf(f.rows);
            var stats = hgOmniBacktestAll(f.rows, { rMult: MIN_RR, horizon: 20, warm: 45 });
            perSymbolStats.push(stats);
            enriched.push({ f: f, extra: {
              htf: htf,
              oi: (oiChange === null) ? null : { changePct: oiChange },
              retail: (ls && ls.latest) ? ls.latest : null,
              taker: (tk && tk.latest) ? tk.latest : null,
              depth: dep,
              regime: (typeof W.regimeState === 'function') ? (function(){ try { return W.regimeState(); } catch (er) { return null; } })() : null,
              news: (typeof W.hgNewsRisk === 'function') ? (function(){ try { return W.hgNewsRisk(f.item.sym); } catch (er) { return null; } })() : null,
              /* The whole-universe read. Present only once pass 1 has ranked
                 every contract, and null on a sweep too small to rank. */
              xs: xsRanks,
              stats: stats
            }});
          }).catch(function(){ e++; });
        }

        function enrich(i){
          if (i >= subset.length) return Promise.resolve();
          var slice = subset.slice(i, i + ENRICH_CHUNK);
          return Promise.all(slice.map(enrichOne)).then(function(){
            if (i + ENRICH_CHUNK >= subset.length) return;
            return omniSleep(CHUNK_DELAY_MS).then(function(){ return enrich(i + ENRICH_CHUNK); });
          });
        }

        return enrich(0).catch(function(e2){
          try{ console.warn('omniroute pass 2 error — continuing with partial', e2); }catch(eL2){}
        }).then(function(){
          var pooled = hgOmniPoolStats(perSymbolStats);

          /* Evaluate EVERY contract that fired, not just the enriched
             subset. Previously a live scan reported "230 fired contracts
             beyond the measurement ceiling were dropped" — and those 230
             produced no card at all, so most of what the scan found was
             invisible. The ceiling exists to bound expensive per-symbol
             NETWORK enrichment, which is not a reason to hide the setup:
             detection and the plan need no network. Unenriched contracts
             still get the pooled measurement (it is global) and simply read
             UNCHECKED on the per-symbol confluence gates. */
          var exBySym = {}, j, k;
          for (j = 0; j < enriched.length; j++){
            var esym = enriched[j].f.item.sym;
            enriched[j].extra.stats = pooled;
            exBySym[esym] = enriched[j].extra;
          }
          var cands = [];
          for (j = 0; j < fired.length; j++){
            var fitem = fired[j].item;
            var ex = exBySym[fitem.sym] || { stats: pooled };
            /* WHY a per-symbol gate is unchecked matters. "OI not published
               for this contract" and "this contract was past the measurement
               ceiling" are different facts, and the card was printing the
               first for both — so a name that simply lost a race looked like
               a venue that publishes nothing. */
            ex.enriched = Object.prototype.hasOwnProperty.call(exBySym, fitem.sym);
            ex.xs = xsRanks;
            ex.sym = fitem.sym;
            /* The daily timeframe is RESAMPLED from bars already in hand — it
               costs no network — but it used to be computed only inside the
               enrichment step, so every contract past the enrich ceiling
               reported "htf-daily UNCHECKED — daily bars unavailable" even
               though the data was sitting right there. Compute it for every
               carded contract; only genuinely networked signals belong
               behind the ceiling. */
            if (!ex.htf) ex.htf = hgOmniDailyHtf(fired[j].rows);
            /* Re-read regime per contract: the warm may have completed after
               enrichment began, and it is a single shared market-wide value
               rather than anything per-symbol. */
            if (!ex.regime && typeof W.regimeState === 'function'){
              try { ex.regime = W.regimeState(); } catch (er) { ex.regime = null; }
            }
            if (!ex.regime && __omni.regimeProxy) ex.regime = __omni.regimeProxy;
            /* hgNewsRisk is a pure read of the news cache — it never fetches —
               so like the daily HTF it does not belong behind the network
               enrichment ceiling. */
            if (!ex.news && typeof W.hgNewsRisk === 'function'){
              try { ex.news = W.hgNewsRisk(fitem.sym); } catch (er) { ex.news = null; }
            }
            if (!ex.regime) ex.regimeWarm = __omni.regimeWarm || null;
            var pos = null;
            if (typeof W.xuPositioning === 'function'){
              try { pos = W.xuPositioning(fitem.base || fitem.sym); } catch (er) { pos = null; }
            }
            var found = hgOmniEvaluate(fitem, fired[j].rows, pos, ex);
            for (k = 0; k < found.length; k++) cands.push(found[k]);
            /* Record this contract's firings so OMNIROUTE accumulates the same
               out-of-sample evidence OMNIGOLD does. Every setup with a plan,
               not only tickets, so the forward pool measures the same thing
               the in-sample pool measures. */
            if (typeof W.hgFwdRecordScan === 'function'){
              var fwdRows = [];
              for (k = 0; k < found.length; k++){
                if (!found[k].plan) continue;
                fwdRows.push({ sym: fitem.sym, dir: found[k].dir,
                               entry: found[k].plan.entry, stop: found[k].plan.stop, t1: found[k].plan.t1,
                               mechanic: found[k].kind,
                               ticket: !!(found[k].grade && found[k].grade.ticket) });
              }
              if (fwdRows.length){
                try { W.hgFwdRecordScan('OMNIROUTE', TF, fwdRows, { horizonBars: 20 }); }
                catch (e) { try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('omniroute:record', e); } catch (eW) {} }
              }
            }
          }
          return { cands: cands, scanned: list.length, uni: uni.length,
                   fired: fired.length, enriched: subset.length, thin: thin,
                   failed: failed, pooled: pooled, pass1Err: pass1Err, pass1Done: done };
        });
      });
    }).then(function(res){
      if (!res) return;
      try{
        var ranked = hgOmniRank(res.cands || []);
        __omni.snap = { at: Date.now(), scanned: res.scanned, uni: res.uni, rows: ranked, pooled: res.pooled };
        __omni.ran = true;
        var tickets = 0, i;
        /* Over DISTINCT TRADES — see omniDistinctCounts. */
        var dcounts = omniDistinctCounts(ranked);
        tickets = dcounts.tickets;
        __omni.lastStat = ranked.length + ' setup(s) · ' + tickets + ' ticket(s) · ' + res.scanned + ' contracts scanned'
                        /* A rescued contract is one the old scan dropped outright, so
                           say how many rather than letting them appear from nowhere. */
                        + (__omni.xsRescued ? '  ·  ' + __omni.xsRescued
                            + ' cross-sectional rescue(s): universe extremes with no price mechanic of their own' : '');
        /* Same as gold: when nothing clears, name the gate responsible rather
           than leaving the reader to find it across fifty cards. */
        if (!tickets && ranked.length){
          var blockTally = {}, bi, bj, bg;
          for (bi = 0; bi < ranked.length; bi++){
            for (bj = 0; bj < (ranked[bi].gates || []).length; bj++){
              bg = ranked[bi].gates[bj];
              if (bg && bg.pass === false && bg.info !== true){
                blockTally[bg.key] = (blockTally[bg.key] || 0) + 1;
              }
            }
          }
          var bKeys = Object.keys(blockTally).sort(function(a, b){ return blockTally[b] - blockTally[a]; });
          if (bKeys.length){
            __omni.lastStat += '  ·  NO TICKETS: ' + bKeys[0] + ' vetoed '
                            + blockTally[bKeys[0]] + ' of ' + ranked.length + ' setups'
                            + (bKeys.length > 1 ? ' (then ' + bKeys.slice(1, 3).join(', ') + ')' : '')
                            + ' — run hgOmniWhyNoTickets() for the full tally';
          }
        }
        var caveat = '';
        if (res.pass1Err) caveat += '  · pass 1 interrupted (' + res.pass1Err + ') — partial cover at ' + res.pass1Done + '/' + res.scanned;
        if (res.fired > res.enriched) caveat += '  · ' + (res.fired - res.enriched) + ' of them show hard gates + plan only (per-symbol confluence capped at ' + ENRICH_MAX + ' names, and the ' + ENRICH_MAX + ' were chosen by how many mechanic families agree, not by which answered first)';
        if (res.thin) caveat += '  · ' + res.thin + ' contracts had too little history to scan';
        /* Distinct from `thin`: these contracts were asked and did not answer
           (rate limit, venue down). Folding them into "scanned" would let a
           dead data source read as a completed sweep. */
        if (res.failed) caveat += '  · ' + res.failed + ' candle fetches FAILED (rate limit or venue down)';
        if (__omni.regimeWarm && __omni.regimeWarm !== 'fresh' && __omni.regimeWarm !== 'warmed'){
          caveat += __omni.regimeProxy
            ? ('  · regime.js gauges unavailable (' + __omni.regimeWarm + ') — using BTC daily proxy')
            : ('  · regime gate unavailable (' + __omni.regimeWarm + ')');
        }
        omniSafeStat(ui, __omni.lastStat + caveat);
        try{ ui.pool.innerHTML = renderPooled(res.pooled); }catch(eP){
          try{ ui.pool.innerHTML = '<div class="note warn">measurement table failed to render.</div>'; }catch(eP2){}
        }
        if (!ranked.length){
          /* A scan where the candles never arrived is NOT a quiet market.
             Without this the two are indistinguishable on screen, and the
             honest reading (I could not look) is the one that gets lost. */
          var dead = (res.failed || 0) + (res.thin || 0);
          var deadPct = res.scanned ? (dead / res.scanned) : 0;
          ui.cards.innerHTML = (deadPct >= 0.5)
            ? ('<div class="note warn">No setups — but ' + dead + ' of ' + res.scanned
               + ' contracts returned no usable candles, so this is a DATA problem, not a quiet market. '
               + 'Check the venue legs / proxy rate limit and re-run before reading a market view into it.</div>')
            : '<div class="empty">no setup fired on any contract. That is a normal result — the detectors are meant to be quiet.</div>';
          return;
        }
        /* COLLAPSE DUPLICATE TRADES.

           Five mechanics firing on the same bar produce five candidates with
           the SAME symbol, direction, entry, stop and targets. That is one
           trade wearing five names, and rendering it five times told the user
           there were five opportunities: a live scan reported 147 tickets of
           which whole blocks were identical rows.

           Grouped by what actually distinguishes a TRADE — symbol, direction
           and the levels you would send to the exchange. The best-ranked
           member keeps the card; the rest are named on it, which is more
           useful than five copies anyway: several independent mechanics
           agreeing on one entry is the thing worth knowing. */
        var seenTrade = {}, collapsed = [];
        for (i = 0; i < ranked.length; i++){
          var cur2 = ranked[i], tk = omniTradeKey(cur2);
          if (seenTrade[tk] === undefined){
            seenTrade[tk] = collapsed.length;
            collapsed.push(cur2);
            continue;
          }
          var owner = collapsed[seenTrade[tk]];
          if ((cur2.grade && cur2.grade.ticket) && !(owner.grade && owner.grade.ticket)){
            /* A cleared setup takes the card from a vetoed one. */
            var also2 = (owner.alsoKinds || []).slice();
            if (also2.indexOf(owner.kind) < 0) also2.push(owner.kind);
            var drop2 = also2.indexOf(cur2.kind);
            if (drop2 >= 0) also2.splice(drop2, 1);
            cur2.alsoKinds = also2;
            collapsed[seenTrade[tk]] = cur2;
            continue;
          }
          if (!owner.alsoKinds) owner.alsoKinds = [];
          if (owner.alsoKinds.indexOf(cur2.kind) < 0 && cur2.kind !== owner.kind){
            owner.alsoKinds.push(cur2.kind);
          }
        }
        var dupHidden = ranked.length - collapsed.length;
        if (dupHidden > 0){
          __omni.lastStat += ' · ' + collapsed.length + ' distinct trade(s) after collapsing '
                          + dupHidden + ' duplicate card(s) on identical levels';
          omniSafeStat(ui, __omni.lastStat);
        }

        var h = '';
        for (i = 0; i < collapsed.length; i++){
          try { h += setupCard(collapsed[i]); }
          catch (eC){
            try{ console.warn('omniroute card render skipped', collapsed[i] && collapsed[i].sym, eC); }catch(eC2){}
          }
        }
        ui.cards.innerHTML = h || '<div class="empty">setups found but cards failed to render — see console.</div>';
      }catch(eRender){
        omniSafeStat(ui, 'scan finished but render failed: ' + omniErrMsg(eRender));
        try{ console.warn('omniroute render failed', eRender); }catch(eR2){}
      }
    }).catch(function(e){
      omniSafeStat(ui, 'scan failed: ' + omniErrMsg(e));
      try{ console.warn('omniroute scan failed', e); }catch(eF){}
    }).then(function(){
      __omni.busy = false;
      ui.btn.disabled = false;
    });
  }

  function readCfgFromUi(ui){
    return {
      endpoint: ui.ep ? String(ui.ep.value || '').trim() : DEFAULT_ENDPOINT,
      token: ui.tok ? String(ui.tok.value || '').trim() : '',
      model: ui.model ? String(ui.model.value || '').trim() : DEFAULT_MODEL
    };
  }

  function runIngest(ui){
    if (__omni.busy) return Promise.resolve();
    var cfg = readCfgFromUi(ui);
    var kind = ui.kind ? ui.kind.value : 'paste';
    var src = ui.src ? String(ui.src.value || '').trim() : '';
    if (!src){ ui.istat.textContent = 'nothing to analyse.'; return Promise.resolve(); }
    __omni.busy = true;
    ui.irun.disabled = true;
    ui.istat.textContent = 'asking the gateway…';
    ui.iout.innerHTML = '';
    hgOmniSaveCfg(cfg);
    return hgOmniComplete(cfg, hgOmniBuildPrompt(src, kind), function(why){
      ui.istat.textContent = 'provider missed (' + why + ') — retrying once…';
    }).then(function(r){
      if (!r.ok){
        ui.istat.textContent = 'gateway error: ' + r.msg;
        ui.iout.innerHTML = '<div class="note warn">The scanner above is unaffected — it never uses the gateway. '
          + 'Ingest needs OmniRoute reachable from this browser; on the deployed site it never will be.</div>';
        return;
      }
      var mapped = hgOmniMapRules(hgOmniParseModelJson(r.text));
      if (!mapped){
        ui.istat.textContent = 'model did not return usable JSON.';
        ui.iout.innerHTML = '<pre class="pre">' + esc(String(r.text).slice(0, 1500)) + '</pre>';
        return;
      }
      ui.istat.textContent = 'done — ' + mapped.verdict;
      ui.iout.innerHTML = renderProposal(mapped, r.model);
    }).catch(function(){
      ui.istat.textContent = 'ingest failed.';
    }).then(function(){
      __omni.busy = false;
      ui.irun.disabled = false;
    });
  }

  /* ==================== mount / refresh ==================== */

  function mountOmniroute(el){
    if (!el) return;
    var cfg = hgOmniLoadCfg();

    el.innerHTML =
      '<div class="panel">'
      + '<h2>OmniRoute — desk setups <span>delta + coindcx · spring · po3 · orb · absorption · value area · measured move</span></h2>'
      + '<div class="note" style="margin-bottom:10px">Scans <b>every futures contract</b> on Delta India + CoinDCX with the six mechanics the '
      + 'popular desks trade. Two passes: detect over the whole universe, then measure and enrich only what fired. '
      + 'Each candidate runs a ledger of 3 hard gates (trend · vol-alive · participation) plus conditional confluence from free public data — '
      + 'daily agreement, OI build, retail crowding, taker aggression, book depth, regime, news blackout, and the detector’s own measured edge. '
      + '<b>A single veto stands it aside</b>; vetoed cards still render so you can see why. A contract missing a data source reads UNCHECKED, never PASS. '
      + 'Levels come from the house plan engine at a ' + MIN_RR + 'R floor and cards order by R:R — geometry, <b>not</b> a profit forecast. '
      + 'The measurement below is in-sample on a short window: it tells you which detector has paid <i>on the bars just read</i>, which is a floor, not a promise.</div>'
      + '<div class="row"><button class="btn" id="omniRun">RUN FULL SCAN (ALL CONTRACTS)</button>'
      +   ' <button class="btn" id="omniGrid">PARAMETER GRID</button></div>'
      + '<div class="note" id="omniStat">idle — press RUN. Full coverage is ~200+ Delta contracts plus CoinDCX, so expect a few minutes; progress shows per pass.</div>'
      + '<div class="note warn" id="omniWarn" style="display:none"></div>'
      + '<div id="omniGridOut" style="margin-top:10px"></div>'
      + '<div id="omniPool" style="margin-top:10px"></div>'
      + '<div class="cards" id="omniCards" style="margin-top:12px"></div>'

      + '<hr class="sep">'
      + '<h3>coverage — what the desks teach vs what we can express</h3>'
      + '<div id="omniMatrix">' + renderMatrix() + '</div>'

      + '<hr class="sep">'
      + '<h3>ingest a source <span class="dim">(optional · needs the local OmniRoute gateway)</span></h3>'
      + '<div class="row" style="gap:8px;flex-wrap:wrap">'
      +   '<label class="f">GATEWAY<input id="omniEp" type="text" size="24" value="' + esc(cfg.endpoint) + '"></label>'
      +   '<label class="f">TOKEN<input id="omniTok" type="password" size="16" value="' + esc(cfg.token) + '" placeholder="oma_live_…"></label>'
      +   '<label class="f">MODEL<input id="omniModel" type="text" size="14" value="' + esc(cfg.model) + '"></label>'
      +   '<button class="btn" id="omniPing">PING</button>'
      + '</div>'
      + '<div class="note" id="omniPingStat">gateway not tested yet.</div>'
      + '<div class="row" style="gap:8px;margin-top:8px">'
      +   '<label class="f">SOURCE<select id="omniKind">'
      +     '<option value="paste">pasted text</option><option value="search">search query</option>'
      +   '</select></label><button class="btn" id="omniIngest">ANALYSE</button>'
      + '</div>'
      + '<textarea id="omniSrc" rows="5" style="width:100%;margin-top:8px" placeholder="Paste a transcript, article or README — or switch to search."></textarea>'
      + '<div class="note" id="omniIStat">idle.</div>'
      + '<div id="omniIOut" style="margin-top:10px"></div>'
      + '</div>';

    var ui = {
      btn: el.querySelector('#omniRun'), stat: el.querySelector('#omniStat'),
      warn: el.querySelector('#omniWarn'), cards: el.querySelector('#omniCards'),
      pool: el.querySelector('#omniPool'),
      matrix: el.querySelector('#omniMatrix'),
      ep: el.querySelector('#omniEp'), tok: el.querySelector('#omniTok'),
      model: el.querySelector('#omniModel'), ping: el.querySelector('#omniPing'),
      pingStat: el.querySelector('#omniPingStat'), kind: el.querySelector('#omniKind'),
      src: el.querySelector('#omniSrc'), irun: el.querySelector('#omniIngest'),
      istat: el.querySelector('#omniIStat'), iout: el.querySelector('#omniIOut'),
      grid: el.querySelector('#omniGrid'), gridOut: el.querySelector('#omniGridOut')
    };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __omni.ui = ui;

    /* The parameter grid runs on bars the scan already fetched, so it costs
       no network — but it does re-run the walk-forward nine times, so it is a
       button rather than part of every scan. */
    if (ui.grid){
      ui.grid.addEventListener('click', function(){
        if (!__omni.gridRows || !__omni.gridRows.length){
          ui.gridOut.innerHTML = '<div class="note warn">Run a scan first — the grid measures the bars '
                               + 'that scan fetched, and there are none yet.</div>';
          return;
        }
        ui.grid.disabled = true;
        ui.gridOut.innerHTML = '<div class="note">measuring ' + __omni.gridRows.length
                             + ' contracts at ' + (GRID_R.length * GRID_H.length) + ' settings…</div>';
        try {
          hgOmniGridProgressive(__omni.gridRows,
            function(html){ ui.gridOut.innerHTML = html; },
            function(html){ ui.gridOut.innerHTML = html; ui.grid.disabled = false; });
        } catch (e){
          ui.gridOut.innerHTML = '<div class="note warn">grid failed: ' + omniErrMsg(e) + '</div>';
          ui.grid.disabled = false;
        }
      });
    }

    var W = (typeof window !== 'undefined') ? window : null;
    var missing = [];
    if (typeof fetch !== 'function') missing.push('fetch');
    if (!W || typeof W.xuUniverse !== 'function') missing.push('xuUniverse');
    if (!W || typeof W.xuCandles !== 'function') missing.push('xuCandles');
    if (!W || typeof W.hgPlanLevels !== 'function') missing.push('hgPlanLevels (no entry/stop/target levels)');
    if (missing.length){
      ui.warn.textContent = 'missing globals: ' + missing.join(', ') + ' — the scan degrades honestly where it can.';
      ui.warn.style.display = 'block';
    }
    if (!W || typeof W.xuUniverse !== 'function' || typeof W.xuCandles !== 'function'){
      ui.btn.disabled = true;      // hard dependency: no universe, no setups
    } else {
      ui.btn.addEventListener('click', function(){ return runScan(ui); });
    }

    if (ui.ping && typeof fetch === 'function'){
      ui.ping.addEventListener('click', function(){
        var c = readCfgFromUi(ui); hgOmniSaveCfg(c);
        ui.pingStat.textContent = 'pinging…';
        return hgOmniPing(c).then(function(p){
          ui.pingStat.textContent = p.msg;
          ui.pingStat.className = p.ok ? 'note' : 'note warn';
        });
      });
    }
    if (ui.irun && typeof fetch === 'function'){
      ui.irun.addEventListener('click', function(){ return runIngest(ui); });
    } else if (ui.irun) ui.irun.disabled = true;
  }

  /* House contract: async, never throws, terse status. Never launches a
     first-time universe sweep on a global refresh. */
  function refreshOmniroute(){
    return Promise.resolve().then(function(){
      if (__omni.busy) return 'busy';
      if (!__omni.ran) return 'skipped: not run yet';
      var ui = __omni.ui;
      if (ui) return runScan(ui).then(function(){ return __omni.lastStat || 'rescanned'; });
      return __omni.lastStat || 'no ui mounted';
    }).catch(function(){ return 'refresh failed'; });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    /* pure detectors + graders — unit-testable, no globals touched */
    window.hgOmniRange = hgOmniRange;
    window.hgOmniSpring = hgOmniSpring;
    window.hgOmniPo3 = hgOmniPo3;
    window.hgOmniOrb = hgOmniOrb;
    window.hgOmniAbsorb = hgOmniAbsorb;
    window.hgOmniProfile = hgOmniProfile;
    window.hgOmniValueReject = hgOmniValueReject;
    window.hgOmniMeasuredMove = hgOmniMeasuredMove;
    /* Cross-sectional pieces are exported so the universe read is testable
       on its own — it is the only part of this desk that cannot be checked
       from a single symbol's bars. */
    /* The grid is exported so the sweep can be measured directly — it is the
       one piece here that answers a question about the STRATEGY rather than
       about a setup, and it deserves its own test. */
    window.hgWhyNoTicketsFrom = hgWhyNoTicketsFrom;   /* omnigold borrows it */
    window.hgOmniWhyNoTickets = function(){
      return hgWhyNoTicketsFrom(__omni.snap && __omni.snap.rows, 'OMNIROUTE');
    };
    window.hgOmniGridRun   = hgOmniGridRun;
    window.hgOmniGridHTML  = hgOmniGridHTML;
    window.hgOmniGridProgressive = hgOmniGridProgressive;
    window.hgOmniFamilyOf  = hgOmniFamilyOf;   /* the consensus family map, so the vote is testable */
    window.hgOmniXsSummary = hgOmniXsSummary;
    window.hgOmniXsRanks   = hgOmniXsRanks;
    window.hgOmniXsLeader  = hgOmniXsLeader;
    window.hgOmniDetect = hgOmniDetect;
    window.hgOmniResample = hgOmniResample;
    window.hgOmniDropForming = hgOmniDropForming;
    window.hgOmniDailyHtf = hgOmniDailyHtf;
    window.hgOmniBtcRegime = hgOmniBtcRegime;
    window.hgOmniDerivePlan = hgOmniDerivePlan;
    window.hgOmniBtStop = hgOmniBtStop;
    window.hgOmniWalkForward = hgOmniWalkForward;
    window.hgOmniBacktestOne = hgOmniBacktestOne;
    window.hgOmniBacktestAll = hgOmniBacktestAll;
    window.hgOmniPoolStats = hgOmniPoolStats;
    /* The family-wise bar every significance claim in the app turns on.
       Exported so it can be checked against an independent Sidak
       computation rather than only against itself. */
    window.hgOmniFamilyZ = hgOmniFamilyZ;
    window.hgOmniPoolRead = hgOmniPoolRead;
    /* Gold's table already calls hgOmniPoolRead; it printed the raw sample
       figure and so lacked the "too small to confirm" guard this has. */
    window.hgOmniNeedText = needText;
    window.hgOmniGates = hgOmniGates;
    window.hgOmniGrade = hgOmniGrade;
    window.hgOmniEvaluate = hgOmniEvaluate;
    window.hgOmniRank = hgOmniRank;
    /* research half */
    window.hgOmniGateInventory = hgOmniGateInventory;
    window.hgOmniRoster = hgOmniRoster;
    window.hgOmniCoverage = hgOmniCoverage;
    window.hgOmniCoverageMatrix = hgOmniCoverageMatrix;
    window.hgOmniGaps = hgOmniGaps;
    window.hgOmniVocabulary = hgOmniVocabulary;
    window.hgOmniBuildPrompt = hgOmniBuildPrompt;
    window.hgOmniParseModelJson = hgOmniParseModelJson;
    window.hgOmniMapRules = hgOmniMapRules;
    window.hgOmniState = function hgOmniState(){
      try { return __omni.snap ? JSON.parse(JSON.stringify(__omni.snap)) : null; } catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id:'omniroute', label:'OMNIROUTE', mount: mountOmniroute, refresh: refreshOmniroute });
  }

})();
