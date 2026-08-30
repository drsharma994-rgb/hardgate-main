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

COVERAGE. Both venues, EVERY futures contract — no top-N cap. Pass 1
fetches 4H bars and ranks the universe. Pass 2 runs the full ledger on
every scannable name: every engine (shared mechanics, native six,
positioning, XS, house extras including SCALP on 1H+15m) and every
indicator (hgOmniGates + hgIndicatorGates + Binance confluence). A name
that still fires nothing does not get an invented ticket; the indicator
ledger still ran. The scan is slower on purpose — cost is linear in the
book, not in hits.

COVERAGE IS NOW COMPLETE, and it was not before: the table at the bottom
of this tab printed its own holes — TSMOM without vol_targeting, order
flow without cvd and liquidation_map. hgOmniVolTarget, hgOmniCvd and
hgOmniLiqMap implement those three. All three are INFO reads: they argue
on the card and never veto, because none of them has a measured record on
this desk yet and three new vetoes would re-cut the ledger by assertion.

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
VETO or WATCH, never a ticket. Ranking for the card list and for MOST
PROBABLE SETUPS balances mechanic-family consensus against indicator
info-reads (coverage, extra kinds on the same trade, proximity). That score
is not a win probability. Levels come from the house hgPlanLevels so
entry/stop/T1/T2 obey the same policy as every other tab. Extra house
engines (EDGE, MR, squeeze, sniper, SWING path, SCALP, coil, trap) vote on
every scanned contract and never claim 7/7 CLEAN.

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

  /* Scan shape. TOP_N = 0 means EVERY futures contract on both venues.
     Pass 1 fetches 4H bars and ranks the universe. Pass 2 runs the FULL
     ledger on every scannable name — every engine and every indicator —
     so cost is linear in the book. Pacing (ENRICH_CHUNK / ENRICH_DELAY_MS)
     keeps the same-origin proxy under its Binance and Delta buckets. */
  var TOP_N = 0;
  var TF = '4h';
  var BARS = 180;
  var CHUNK = 4;          // venue-leg concurrency for pass 1 (gentle on /api/proxy)
  var CHUNK_DELAY_MS = 80; // pause between pass-1 batches — avoids 429 mid-scan
  var ENRICH_CHUNK = 2;   // 2 names × (4 Binance + 2 extra TFs) per beat
  var ENRICH_DELAY_MS = 450; // pass-2 pause so the proxy does not 429 itself
  /* THE SCAN USED TO CRASH THE TAB IT RAN IN. Two causes, both here.
     Rendering was unbounded: a 1,240-setup scan built a full 35-gate card
     for every distinct trade into one innerHTML — tens of thousands of DOM
     nodes, which is precisely the profile mobile Chrome answers with a
     silent out-of-memory page reload ("the app refreshed and my results
     are gone"). And grading was one synchronous loop over every fired
     contract — 35 gates x indicators x 180 bars x ~500 names with no yield,
     which is the profile the browser answers with an "unresponsive page"
     kill. Cap what reaches the DOM (every TICKET always renders; the rest
     go to one-line rows — the data all stays in __omni.snap for
     hgOmniWhyNoTickets), and grade in chunks that yield the main thread. */
  var CARD_RENDER_MAX = 40;  // full-ledger cards on screen; every ticket renders regardless
  var GRADE_CHUNK = 20;      // contracts graded per main-thread slice
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
  var REVERSION_KINDS = { SPRING:true, UTAD:true, VALUE:true, ABSORB:true,
                          /* conviction roster's two counter-trend slots — counter-trend
                             is what these setups ARE, so the trend gate reads as context
                             for them exactly as it does for SPRING/UTAD */
                          'SWEEP-RECLAIM':true, 'EXHAUST-REVERT':true };

  var DAILY_FAST = 10;
  var DAILY_SLOW = 21;

  var __omni = { ui: null, busy: false, ran: false, snap: null, lastStat: '', xsRescued: 0,
                 lastCardsHtml: '', lastPoolHtml: '', lastMpHtml: '', last20xHtml: '', lastApexHtml: '', held: { n: 0 },
                 openSetups: [] };
  /* A finished scan is still the desk. Tab-switch auto-scan and the 5-min
     hardRefreshAll used to click RUN, which blanked the cards and then
     often died on a venue blip — "the setup disappears after 1 minute,
     there is a error". Skip a repeat sweep inside this window; the candles
     have not moved. */
  var OMNI_FRESH_MS = 180000;

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

  /* ==================== CONVICTION ROSTER — six formation-time mechanics ====================

     Designed against the 2,496-trade replay (scripts/backtest-omniroute-results.json):
     26.3% WR / -0.24R net / PF 0.69 overall, and the per-mechanic ledger says the
     only net-positive kinds were trend/participation/institutional-level ideas
     (AVWAP-RECLAIM +25.8R/71, MMOVE +10.9R/188, NR7-BREAK +7.8R/150, CUSUM-SHIFT
     +6.6R/77, VOL-EXPANSION +1.3R/22) while every naked reversion kind bled
     (PIN-REJECT -118R/115, THREE-BAR -126.8R/161, UTAD -63.2R/135, RSI-DIVERGE
     -36.1R/58). This roster therefore (a) tilts continuation-ward, (b) makes its
     two counter-trend slots earn formation with structure-CONFIRMED triggers
     instead of anticipation, and (c) bakes the cost gate into formation itself so
     tight-stop geometry can never print.

     SHARED CONTRACTS (all six):
       - >= 3 independent confirmations on the CLOSED bar, at least one each of
         structure / momentum / participation, carried verbatim on the hit as
         hit.conviction plus a hit.stopHint. Extra fields on a hit are legal per
         the detector contract (hg-mechanics.js:14-17 — only kind/dir/level/why
         are read downstream), so this is additive and non-breaking. Because a
         hit cannot exist with count < 3 or a failed cost gate, the label is
         honest by construction — there is no post-hoc scoring path to it.
       - Structure-based stop FIRST: 0.35*ATR beyond the defining structural
         extreme (matches the reversion branch of hgOmniPlanForHit), then FLOORED
         at 1.2*ATR from entry (widen to the floor when structure is nearer) and
         CAPPED at 2.5*ATR (structure further away => the setup does not form —
         that invalidation is a thesis for a different timeframe).
       - Formation cost gate LAST (hgOmniFormCostGate — hgOmniCostDrag's own
         arithmetic on raw entry/stop): costR > 0.125, the 'ok' tier ceiling, and
         the setup DOES NOT FORM. At the default 0.14% round trip no conviction
         mechanic can form with a stop closer than 1.12% of price (8x round-trip
         cost). Combined with the 1.2*ATR floor, low-ATR majors only form in
         expanded-volatility regimes — intended: that is exactly the cohort the
         replay said nearly broke even.
       - PURE over the rows prefix: no fetch, no DOM, no Date.now — higher-TF
         context is aggregated from the rows already in hand — so
         hgOmniBacktestOne's detectFn(rows.slice(0, i+1)) replays every one of
         them with zero lookahead, and so will any future backtest. */

  var OMNI_CV_STOP_BUF_ATR   = 0.35;  /* structure buffer — same 0.35*ATR the reversion branch uses */
  var OMNI_CV_STOP_FLOOR_ATR = 1.2;   /* stop floor — the replay's #1 killer was tight-stop geometry */
  var OMNI_CV_STOP_CAP_ATR   = 2.5;   /* invalidation further away = different timeframe, no form */
  var OMNI_CV_COST_OK_R      = 0.125; /* hgOmniCostDrag's 'ok' tier ceiling — formation veto above it */

  /* ---- shared pure helpers (conviction roster only) ---- */

  /* EMA as a SERIES (same seeding as emaOf: first value seeds), because the
     roster needs "rising over k bars" and "the zone at bar i", not just the
     final value. */
  function hgOmniCvEmaArr(vals, n){
    if (!vals || vals.length < n || n <= 0) return null;
    var k = 2 / (n + 1), out = [vals[0]], i;
    for (i = 1; i < vals.length; i++) out.push(vals[i] * k + out[i - 1] * (1 - k));
    return out;
  }

  /* Wilder RSI as a series. Entries before the seed window are NaN. */
  function hgOmniCvRsiArr(closes, n){
    if (!closes || closes.length < n + 2 || !(n > 0)) return null;
    var out = [], i, ch, g = 0, l = 0;
    for (i = 1; i <= n; i++){
      ch = closes[i] - closes[i - 1];
      if (!isFinite(ch)) return null;
      if (ch > 0) g += ch; else l -= ch;
    }
    g /= n; l /= n;
    for (i = 0; i < n; i++) out.push(NaN);
    out.push(l === 0 ? 100 : (g === 0 ? 0 : 100 - 100 / (1 + g / l)));
    for (i = n + 1; i < closes.length; i++){
      ch = closes[i] - closes[i - 1];
      if (!isFinite(ch)) ch = 0;
      g = (g * (n - 1) + (ch > 0 ? ch : 0)) / n;
      l = (l * (n - 1) + (ch < 0 ? -ch : 0)) / n;
      out.push(l === 0 ? 100 : (g === 0 ? 0 : 100 - 100 / (1 + g / l)));
    }
    return out;
  }

  /* Mean volume over the n bars ENDING AT endIdx-1 — the bar under test is
     EXCLUDED so a thrust cannot dilute its own baseline (same reason
     hgOmniAbsorb slices the last bar off before meanVol). */
  function hgOmniCvVolSma(rows, n, endIdx){
    if (!rows || !(endIdx > 0)) return NaN;
    var s = 0, c = 0, i, v;
    for (i = Math.max(0, endIdx - n); i < endIdx; i++){
      v = num(rows[i] && rows[i].v);
      if (isFinite(v)){ s += v; c++; }
    }
    return (c >= Math.min(n, 10)) ? s / c : NaN;
  }

  /* CLOSED higher-TF context from the rows in hand: factor-4 buckets aligned
     to floor(t / (4*barSec)). On a 1h feed this is exactly the spec'd agg4h
     (UTC-aligned 14400s buckets); on this desk's own 4h scan it yields 16h
     context — generalized on the line-160 precedent ("asking for a 50-period
     daily EMA silently disabled the gate"): a helper hard-wired to 1h input
     would make every roster mechanic silently dead on the 4h scan. A bucket
     only counts when ALL FOUR bars are present, so the trailing (possibly
     forming) bucket and any gap-holed bucket are DROPPED — no forming-bar
     leak, no lookahead. Degenerate input => empty array. */
  function hgOmniCvAggHtf(rows){
    if (!rows || rows.length < 9) return [];
    var i, a, b, deltas = [];
    for (i = Math.max(1, rows.length - 12); i < rows.length; i++){
      a = num(rows[i - 1] && rows[i - 1].t); b = num(rows[i] && rows[i].t);
      if (isFinite(a) && isFinite(b) && b > a) deltas.push(b - a);
    }
    if (!deltas.length) return [];
    deltas.sort(function(x, y){ return x - y; });
    var barSec = deltas[Math.floor(deltas.length / 2)];
    if (!(barSec > 0)) return [];
    var per = barSec * 4, out = [], bucket = null, t, key, h, l, c, v;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i] && rows[i].t);
      if (!isFinite(t)) continue;
      key = Math.floor(t / per) * per;
      h = num(rows[i].h); l = num(rows[i].l); c = num(rows[i].c); v = num(rows[i].v);
      if (!bucket || bucket.t !== key){
        if (bucket && bucket.n === 4) out.push(bucket);
        bucket = { t: key, o: num(rows[i].o), h: h, l: l, c: c,
                   v: isFinite(v) ? v : 0, n: 1 };
      } else {
        if (isFinite(h) && h > bucket.h) bucket.h = h;
        if (isFinite(l) && l < bucket.l) bucket.l = l;
        if (isFinite(c)) bucket.c = c;
        if (isFinite(v)) bucket.v += v;
        bucket.n++;
      }
    }
    if (bucket && bucket.n === 4) out.push(bucket);
    return out;
  }

  /* Stop geometry contract 0.3: floor at 1.2*ATR (widen when structure is
     nearer), cap at 2.5*ATR (return null — the setup does not form). */
  function hgOmniCvClampStop(dir, entry, stop, atr){
    entry = fin(entry); stop = fin(stop); atr = fin(atr);
    if (!isFinite(entry) || !isFinite(stop) || !(atr > 0)) return null;
    var dist = (dir === 'long') ? (entry - stop) : (stop - entry);
    if (!(dist > 0)) return null;
    if (dist > OMNI_CV_STOP_CAP_ATR * atr) return null;
    if (dist < OMNI_CV_STOP_FLOOR_ATR * atr){
      dist = OMNI_CV_STOP_FLOOR_ATR * atr;
      stop = (dir === 'long') ? (entry - dist) : (entry + dist);
    }
    return stop;
  }

  /* The one hit shape all six emit. A hit NEVER exists with a failed gate,
     so costGate is the literal string 'passed' by construction. */
  function hgOmniCvHit(kind, dir, level, stop, why, confirmations, classes, gate){
    return {
      kind: kind, dir: dir, level: level, stopHint: stop, why: why,
      conviction: {
        confirmations: confirmations,
        count: confirmations.length,
        classes: classes,
        costGate: 'passed',
        costR: gate.costR,
        stopDistPct: gate.stopDistPct
      }
    };
  }

  /* ---- 1. HTF-PULLBACK — trend-continuation --------------------------------
     THESIS. In an established higher-TF trend, a shallow multi-bar pullback on
     CONTRACTING volume that resumes with an expansion thrust monetizes trend
     persistence: the pullback is inventory adjustment, not distribution.
     LINEAGE: Donchian/Turtle trend persistence; moving-average pullback
     systems; Grimes (The Art & Science of Technical Analysis) pullback
     taxonomy; Wyckoff/Weis effort-vs-result for the volume signature.
     CONFIRMATIONS: S1 HTF trend (aggregated EMA rising, price above it),
     S2 defined 3-12 bar pullback holding the EMA20-EMA50 zone, M1 resumption
     thrust with RSI held, P1 dry pullback / wet thrust. count=4, S:2 M:1 P:1.
     FIRE RATE: the 3-12 bar geometry plus the dual volume condition is rare —
     est. 0.3-0.5 signals/symbol/week. Nearest kin TREND-RECLAIM fires on a
     single-bar EMA cross with no HTF filter, no pullback shape, no volume
     signature (and lost -26.7R in replay); BOS-RETEST keys off a broken level
     and has no participation class. No existing kind reads this conjunction. */
  var OMNI_HTFPB_MIN_ROWS   = 120;  /* enough closed bars for the HTF EMA + 1h EMAs */
  var OMNI_HTFPB_HTF_EMA_N  = 21;   /* HTF trend EMA. Spec said EMA50-over-60-buckets;
                                       sized down on the line-160 precedent — 180 bars of
                                       scan history can never yield 60 factor-4 buckets,
                                       and an EMA the history cannot support is a silently
                                       dead gate, not a stricter one. */
  var OMNI_HTFPB_HTF_RISE   = 4;    /* HTF EMA must be rising over this many HTF bars */
  var OMNI_HTFPB_SWING_LOOK = 25;   /* the defining swing must sit within this many bars */
  var OMNI_HTFPB_PB_MIN     = 3;    /* pullback length bounds — shorter is noise, */
  var OMNI_HTFPB_PB_MAX     = 12;   /* longer is a regime change, not a pullback */
  var OMNI_HTFPB_ZONE_ATR   = 0.3;  /* EMA20..EMA50 zone tolerance, in ATR */
  var OMNI_HTFPB_RSI_FLOOR  = 40;   /* RSI must hold this through a long pullback (60 ceil short) */
  var OMNI_HTFPB_DRY_X      = 0.9;  /* pullback mean volume < this x vSMA20 (dry) */
  var OMNI_HTFPB_THRUST_X   = 1.3;  /* resumption bar volume >= this x vSMA20 (wet) */

  function hgOmniHtfPullback(rows){
    if (!rows || rows.length < OMNI_HTFPB_MIN_ROWS) return null;
    var n = rows.length - 1;
    var atr = atrOf(rows, 14);
    if (!(atr > 0)) return null;
    /* S1 — higher-TF trend from the factor-4 aggregate */
    var h4 = hgOmniCvAggHtf(rows);
    if (!h4 || h4.length < OMNI_HTFPB_HTF_EMA_N + OMNI_HTFPB_HTF_RISE + 2) return null;
    var c4 = closesOf(h4);
    var e4 = hgOmniCvEmaArr(c4, OMNI_HTFPB_HTF_EMA_N);
    if (!e4) return null;
    var eN = e4[e4.length - 1], eP = e4[e4.length - 1 - OMNI_HTFPB_HTF_RISE];
    var c4last = c4[c4.length - 1];
    if (!isFinite(eN) || !isFinite(eP) || !isFinite(c4last)) return null;
    var up = c4last > eN && eN > eP;
    var dn = c4last < eN && eN < eP;
    if (!up && !dn) return null;
    var dir = up ? 'long' : 'short';
    var c1 = closesOf(rows);
    if (c1.length !== rows.length) return null;   /* a hole breaks index alignment */
    var e20 = hgOmniCvEmaArr(c1, 20), e50 = hgOmniCvEmaArr(c1, 50);
    var r = hgOmniCvRsiArr(c1, 14);
    if (!e20 || !e50 || !r) return null;
    /* S2 — the defining swing extreme within the lookback, then a 3-12 bar
       pullback into the EMA20-EMA50 zone that never closes beyond EMA50. */
    var i, h, l, c, swIdx = -1, swVal = dir === 'long' ? -Infinity : Infinity;
    for (i = Math.max(1, n - OMNI_HTFPB_SWING_LOOK); i <= n - 1; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (dir === 'long'){ if (isFinite(h) && h >= swVal){ swVal = h; swIdx = i; } }
      else { if (isFinite(l) && l <= swVal){ swVal = l; swIdx = i; } }
    }
    if (swIdx < 0 || !isFinite(swVal)) return null;
    var pbBars = (n - 1) - swIdx;
    if (pbBars < OMNI_HTFPB_PB_MIN || pbBars > OMNI_HTFPB_PB_MAX) return null;
    var PL = Infinity, PH = -Infinity, plIdx = -1, phIdx = -1;
    var entryLvl = dir === 'long' ? -Infinity : Infinity;
    var pbVolSum = 0, pbVolN = 0, v;
    for (i = swIdx + 1; i <= n - 1; i++){
      h = num(rows[i].h); l = num(rows[i].l); c = num(rows[i].c); v = num(rows[i].v);
      if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
      if (dir === 'long'){
        if (h >= swVal) return null;               /* a new high is not a pullback */
        if (c < e50[i]) return null;               /* no close below EMA50 */
        if (l < PL){ PL = l; plIdx = i; }
        if (h > entryLvl) entryLvl = h;            /* the pullback's reaction high */
      } else {
        if (l <= swVal) return null;
        if (c > e50[i]) return null;
        if (h > PH){ PH = h; phIdx = i; }
        if (l < entryLvl) entryLvl = l;
      }
      if (isFinite(v)){ pbVolSum += v; pbVolN++; }
    }
    if (!pbVolN) return null;
    if (dir === 'long'){
      if (!(plIdx >= 0 && isFinite(PL) && isFinite(entryLvl))) return null;
      if (!(PL >= e50[plIdx] - OMNI_HTFPB_ZONE_ATR * atr
         && PL <= e20[plIdx] + OMNI_HTFPB_ZONE_ATR * atr)) return null;
    } else {
      if (!(phIdx >= 0 && isFinite(PH) && isFinite(entryLvl))) return null;
      if (!(PH <= e50[phIdx] + OMNI_HTFPB_ZONE_ATR * atr
         && PH >= e20[phIdx] - OMNI_HTFPB_ZONE_ATR * atr)) return null;
    }
    /* M1 — resumption thrust with momentum held through the pullback */
    var lc = num(rows[n].c), mid;
    if (!isFinite(lc)) return null;
    if (dir === 'long'){
      mid = (swVal + PL) / 2;
      if (!(lc > num(rows[n - 1].h) && lc > mid)) return null;
      for (i = swIdx + 1; i <= n - 1; i++){ if (!(r[i] >= OMNI_HTFPB_RSI_FLOOR)) return null; }
      if (!(r[n] > r[n - 1])) return null;
    } else {
      mid = (swVal + PH) / 2;
      if (!(lc < num(rows[n - 1].l) && lc < mid)) return null;
      for (i = swIdx + 1; i <= n - 1; i++){ if (!(r[i] <= 100 - OMNI_HTFPB_RSI_FLOOR)) return null; }
      if (!(r[n] < r[n - 1])) return null;
    }
    /* P1 — dry pullback, wet thrust */
    var vs = hgOmniCvVolSma(rows, 20, n), lv = num(rows[n].v);
    if (!isFinite(vs) || !(vs > 0) || !isFinite(lv)) return null;
    if (!((pbVolSum / pbVolN) < OMNI_HTFPB_DRY_X * vs && lv >= OMNI_HTFPB_THRUST_X * vs)) return null;
    /* geometry + formation cost gate */
    var entry = entryLvl;
    var stop = (dir === 'long') ? (PL - OMNI_CV_STOP_BUF_ATR * atr)
                                : (PH + OMNI_CV_STOP_BUF_ATR * atr);
    stop = hgOmniCvClampStop(dir, entry, stop, atr);
    if (stop === null) return null;
    var gate = hgOmniFormCostGate(entry, stop);
    if (!gate) return null;
    return hgOmniCvHit('HTF-PULLBACK', dir, entry, stop,
      'higher-TF trend intact; ' + pbBars + '-bar dry pullback into the EMA zone resumed on '
        + (lv / vs).toFixed(1) + 'x volume through ' + entry.toFixed(6),
      ['htf-ema-trend', 'pullback-structure-held-ema50', 'resumption-thrust-rsi',
       'volume-dry-then-expand'],
      { structure: 2, momentum: 1, participation: 1 }, gate);
  }

  /* ---- 2. DONCHIAN-DRIVE — breakout with participation ---------------------
     THESIS. A close through a 55-bar Donchian extreme out of a MATURE base,
     delivered by a wide-range conviction bar on climactic volume, monetizes
     breakout continuation; the participation requirement filters the
     liquidity-thin false breaks that make naked channel breakouts
     unprofitable net of costs in crypto.
     LINEAGE: Donchian channel trend-following (Donchian 1960s; Turtle rules,
     55-bar system 2); volume-confirmed breakout studies (opening-range
     range+volume conditioning, generalized to session-free perps).
     CONFIRMATIONS: S1 close-through with margin, S2 aged extreme (a fresh
     high is momentum chasing, an aged one is a regime event), M1 drive bar,
     P1 climax volume. count=4, S:2 M:1 P:1.
     OVERLAP: ORB is a session range, NR7-BREAK a one-bar compression — no
     existing kind reads a 55-bar aged channel + drive bar + volume climax. */
  var OMNI_DON_LOOK        = 55;   /* Donchian lookback — the Turtle 55-bar channel */
  var OMNI_DON_MARGIN_ATR  = 0.25; /* close-through margin, not a wick-through */
  var OMNI_DON_AGE_MIN     = 20;   /* the extreme must have stood this many bars */
  var OMNI_DON_DRIVE_ATR   = 1.5;  /* drive-bar range floor, in ATR */
  var OMNI_DON_CLOSE_POS   = 0.75; /* close in the top/bottom quarter of the bar */
  var OMNI_DON_VOL_X       = 2.0;  /* climax volume multiple of vSMA20 */
  var OMNI_DON_VOL_HIGHEST = 20;   /* and the highest volume of this many bars */
  var OMNI_DON_STOP_ATR    = 1.5;  /* breakout stop distance. Spec wrote
                                      max(DH-0.35*ATR, entry-1.5*ATR), whose max()
                                      arm is always the 0.35 one and is then
                                      overridden by the 1.2 floor; its own prose
                                      says "in practice ~1.5 ATR — deliberately far
                                      wider than the base's near edge" (the replay's
                                      #1 killer was tight stops under breakout
                                      levels), so 1.5 ATR is implemented directly. */

  function hgOmniDonchianDrive(rows){
    if (!rows || rows.length < OMNI_DON_LOOK + 25) return null;
    var n = rows.length - 1;
    var atr = atrOf(rows, 14);
    if (!(atr > 0)) return null;
    var i, h, l, DH = -Infinity, DL = Infinity, dhIdx = -1, dlIdx = -1;
    for (i = n - OMNI_DON_LOOK; i <= n - 1; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h >= DH){ DH = h; dhIdx = i; }   /* >= : LAST touch dates the base */
      if (isFinite(l) && l <= DL){ DL = l; dlIdx = i; }
    }
    if (!isFinite(DH) || !isFinite(DL)) return null;
    var c = num(rows[n].c), o = num(rows[n].o), lh = num(rows[n].h), ll = num(rows[n].l), v = num(rows[n].v);
    if (!isFinite(c) || !isFinite(o) || !isFinite(lh) || !isFinite(ll) || !isFinite(v)) return null;
    var rng = lh - ll;
    if (!(rng > 0)) return null;
    var dir = null, lvl = NaN, age = NaN;
    if (c > DH + OMNI_DON_MARGIN_ATR * atr){ dir = 'long'; lvl = DH; age = n - dhIdx; }
    else if (c < DL - OMNI_DON_MARGIN_ATR * atr){ dir = 'short'; lvl = DL; age = n - dlIdx; }
    if (!dir) return null;                                        /* S1 */
    if (!(age >= OMNI_DON_AGE_MIN)) return null;                  /* S2 */
    var pos = (c - ll) / rng;
    if (!(rng >= OMNI_DON_DRIVE_ATR * atr)) return null;          /* M1: real drive bar */
    if (dir === 'long' ? !(pos >= OMNI_DON_CLOSE_POS) : !(pos <= 1 - OMNI_DON_CLOSE_POS)) return null;
    var vs = hgOmniCvVolSma(rows, 20, n);
    if (!isFinite(vs) || !(vs > 0)) return null;
    if (!(v >= OMNI_DON_VOL_X * vs)) return null;                 /* P1: climax volume */
    for (i = n - OMNI_DON_VOL_HIGHEST; i <= n - 1; i++){
      var pv = num(rows[i].v);
      if (isFinite(pv) && pv > v) return null;                    /* highest of the window */
    }
    var entry = lvl;
    var stop = (dir === 'long') ? (entry - OMNI_DON_STOP_ATR * atr)
                                : (entry + OMNI_DON_STOP_ATR * atr);
    stop = hgOmniCvClampStop(dir, entry, stop, atr);
    if (stop === null) return null;
    var gate = hgOmniFormCostGate(entry, stop);
    if (!gate) return null;
    return hgOmniCvHit('DONCHIAN-DRIVE', dir, entry, stop,
      'closed through the ' + OMNI_DON_LOOK + '-bar channel ' + (dir === 'long' ? 'high' : 'low')
        + ' at ' + entry.toFixed(6) + ' (' + age + ' bars old) on a ' + (rng / atr).toFixed(1)
        + 'x-ATR drive bar with ' + (v / vs).toFixed(1) + 'x volume',
      ['donchian-close-through-margin', 'aged-base-' + age + '-bars', 'drive-bar-close-location',
       'climax-volume-highest-of-' + OMNI_DON_VOL_HIGHEST],
      { structure: 2, momentum: 1, participation: 1 }, gate);
  }

  /* ---- 3. AVWAP-DEFEND — institutional cost basis, tested and held ---------
     THESIS. The VWAP anchored at a significant swing extreme is the average
     cost basis of everyone positioned since that extreme; a market that holds
     above it for bars on end, then TESTS it intrabar and closes back above on
     expanding volume, has just shown the institutional bid defending its
     inventory. Trades WITH the defense — continuation, not a fade.
     LINEAGE: anchored-VWAP practice (Brian Shannon); Wyckoff "test" logic.
     The replay's best kind was AVWAP-RECLAIM (+25.8R/71) — same level, but
     RECLAIM fires on the cross; DEFEND requires the held cost basis, the
     tag-and-hold, momentum intact AND participation on the defense bar, which
     RECLAIM never reads. count=4, S:2 M:1 P:1.
     CONFIRMATIONS: S1 aged anchor extreme unbroken since it printed, S2 cost
     basis held N bars then tagged and defended, M1 RSI intact and turning up
     on the defense, P1 defense-bar volume expansion. */
  var OMNI_AVD_ANCHOR_MIN = 20;   /* anchor age floor — a fresh pivot is not a cost basis yet */
  var OMNI_AVD_ANCHOR_MAX = 130;  /* anchor age ceiling — beyond this the basis is stale */
  var OMNI_AVD_HOLD_BARS  = 10;   /* consecutive closes that must have held the basis */
  var OMNI_AVD_TAG_ATR    = 0.25; /* the test wick must come at least this near, in ATR */
  var OMNI_AVD_RSI_BULL   = 45;   /* momentum floor on a long defense (mirror: 55 ceiling short) */
  var OMNI_AVD_VOL_X      = 1.3;  /* defense-bar participation multiple of vSMA20 */

  function hgOmniAvwapDefend(rows){
    if (!rows || rows.length < OMNI_AVD_ANCHOR_MAX + 10) return null;
    var n = rows.length - 1;
    var atr = atrOf(rows, 14);
    if (!(atr > 0)) return null;
    var c1 = closesOf(rows);
    if (c1.length !== rows.length) return null;
    var r = hgOmniCvRsiArr(c1, 14);
    if (!r) return null;
    var vs = hgOmniCvVolSma(rows, 20, n), lv = num(rows[n].v);
    if (!isFinite(vs) || !(vs > 0) || !isFinite(lv)) return null;
    var lc = num(rows[n].c), ll = num(rows[n].l), lh = num(rows[n].h);
    if (!isFinite(lc) || !isFinite(ll) || !isFinite(lh)) return null;
    var sides = ['long', 'short'], s, dir, i, ext, extIdx, x;
    for (s = 0; s < sides.length; s++){
      dir = sides[s];
      /* S1 — the anchor: the defining extreme inside the age window, unbroken since */
      ext = dir === 'long' ? Infinity : -Infinity; extIdx = -1;
      for (i = n - OMNI_AVD_ANCHOR_MAX; i <= n - OMNI_AVD_ANCHOR_MIN; i++){
        if (i < 0) continue;
        x = dir === 'long' ? num(rows[i].l) : num(rows[i].h);
        if (!isFinite(x)) continue;
        if (dir === 'long' ? x <= ext : x >= ext){ ext = x; extIdx = i; }
      }
      if (extIdx < 0 || !isFinite(ext)) continue;
      var broken = false;
      for (i = extIdx + 1; i <= n; i++){
        x = dir === 'long' ? num(rows[i].l) : num(rows[i].h);
        if (isFinite(x) && (dir === 'long' ? x < ext : x > ext)){ broken = true; break; }
      }
      if (broken) continue;
      /* running AVWAP from the anchor — av[i-extIdx] is the basis AT bar i */
      var pvs = 0, vvs = 0, av = [], tp, vv;
      for (i = extIdx; i <= n; i++){
        tp = (num(rows[i].h) + num(rows[i].l) + num(rows[i].c)) / 3;
        if (!isFinite(tp)){ av = null; break; }
        vv = num(rows[i].v);
        if (!isFinite(vv) || vv <= 0) vv = 1;
        pvs += tp * vv; vvs += vv;
        av.push(pvs / vvs);
      }
      if (!av || !(vvs > 0)) continue;
      var avN = av[av.length - 1];
      if (!isFinite(avN) || !(avN > 0)) continue;
      /* S2 — basis held for HOLD_BARS, then tagged and defended on bar n */
      var held = true;
      for (i = n - OMNI_AVD_HOLD_BARS; i <= n - 1; i++){
        var ci = num(rows[i].c), ai = av[i - extIdx];
        if (!isFinite(ci) || !isFinite(ai) || (dir === 'long' ? ci <= ai : ci >= ai)){ held = false; break; }
      }
      if (!held) continue;
      if (dir === 'long'){
        if (!(ll <= avN + OMNI_AVD_TAG_ATR * atr && lc > avN)) continue;
      } else {
        if (!(lh >= avN - OMNI_AVD_TAG_ATR * atr && lc < avN)) continue;
      }
      /* M1 — momentum intact and turning with the defense */
      if (dir === 'long'){
        if (!(r[n] >= OMNI_AVD_RSI_BULL && r[n] > r[n - 1])) continue;
      } else {
        if (!(r[n] <= 100 - OMNI_AVD_RSI_BULL && r[n] < r[n - 1])) continue;
      }
      /* P1 — participation on the defense bar */
      if (!(lv >= OMNI_AVD_VOL_X * vs)) continue;
      /* geometry + formation cost gate: stop beyond the test bar's wick,
         which by construction is beyond the basis itself */
      var entry = avN;
      var stop = (dir === 'long') ? (ll - OMNI_CV_STOP_BUF_ATR * atr)
                                  : (lh + OMNI_CV_STOP_BUF_ATR * atr);
      stop = hgOmniCvClampStop(dir, entry, stop, atr);
      if (stop === null) continue;
      var gate = hgOmniFormCostGate(entry, stop);
      if (!gate) continue;
      return hgOmniCvHit('AVWAP-DEFEND', dir, entry, stop,
        'cost basis anchored ' + (n - extIdx) + ' bars back at ' + ext.toFixed(6)
          + ' held ' + OMNI_AVD_HOLD_BARS + ' bars, tagged and defended at ' + entry.toFixed(6)
          + ' on ' + (lv / vs).toFixed(1) + 'x volume',
        ['aged-anchor-extreme-unbroken', 'avwap-held-then-defended', 'rsi-intact-turning',
         'defense-volume-expansion'],
        { structure: 2, momentum: 1, participation: 1 }, gate);
    }
    return null;
  }

  /* ---- 4. COMPRESSION-BREAK — volatility-cycle expansion with a dry base ---
     THESIS. A multi-bar volatility compression on DRYING volume is the tape
     agreeing on price; the first expansion bar through the box on climactic
     volume is the disagreement that starts the next leg. The desk's own
     replay says the volatility-cycle family pays (NR7-BREAK +7.8R/150,
     VOL-EXPANSION +1.3R/22); this generalizes the one-bar NR7 to a full box
     and adds the participation signature neither of those reads.
     LINEAGE: NR7/inside-range compression (Crabel), Bollinger band-width
     squeeze, Wyckoff phase C-D volume drought before markup.
     CONFIRMATIONS: S1 tight multi-bar box, S2 close-through with margin,
     M1 expansion drive bar, P1 dry box / climactic break volume. count=4,
     S:2 M:1 P:1. OVERLAP: NR7-BREAK is one bar with no volume read; PO3
     needs a sweep-and-reclaim; SQUEEZE-FIRE is the TTM indicator with no
     participation class. */
  var OMNI_CMP_BOX_BARS   = 12;   /* compression box length */
  var OMNI_CMP_BOX_ATR    = 2.0;  /* box height ceiling, in ATR — tighter than PO3's 2.2 */
  var OMNI_CMP_MARGIN_ATR = 0.25; /* close-through margin */
  var OMNI_CMP_DRIVE_ATR  = 1.4;  /* break-bar range floor */
  var OMNI_CMP_CLOSE_POS  = 0.7;  /* close in the directional 30% of the break bar */
  var OMNI_CMP_DRY_X      = 0.95; /* box mean volume <= this x vSMA20 (drought) */
  var OMNI_CMP_THRUST_X   = 1.8;  /* break-bar volume >= this x vSMA20 (climax) */

  function hgOmniCompressionBreak(rows){
    if (!rows || rows.length < OMNI_CMP_BOX_BARS + 28) return null;
    var n = rows.length - 1;
    var atr = atrOf(rows, 14);
    if (!(atr > 0)) return null;
    var i, h, l, v, boxHi = -Infinity, boxLo = Infinity, volSum = 0, volN = 0;
    for (i = n - OMNI_CMP_BOX_BARS; i <= n - 1; i++){
      h = num(rows[i].h); l = num(rows[i].l); v = num(rows[i].v);
      if (!isFinite(h) || !isFinite(l)) return null;
      if (h > boxHi) boxHi = h;
      if (l < boxLo) boxLo = l;
      if (isFinite(v)){ volSum += v; volN++; }
    }
    if (!isFinite(boxHi) || !isFinite(boxLo) || boxHi <= boxLo || !volN) return null;
    if (!(boxHi - boxLo <= OMNI_CMP_BOX_ATR * atr)) return null;    /* S1: compressed */
    var c = num(rows[n].c), o = num(rows[n].o), lh = num(rows[n].h), ll = num(rows[n].l), lv = num(rows[n].v);
    if (!isFinite(c) || !isFinite(o) || !isFinite(lh) || !isFinite(ll) || !isFinite(lv)) return null;
    var dir = null, lvl = NaN;
    if (c > boxHi + OMNI_CMP_MARGIN_ATR * atr){ dir = 'long'; lvl = boxHi; }
    else if (c < boxLo - OMNI_CMP_MARGIN_ATR * atr){ dir = 'short'; lvl = boxLo; }
    if (!dir) return null;                                          /* S2: close-through */
    var rng = lh - ll;
    if (!(rng > 0) || !(rng >= OMNI_CMP_DRIVE_ATR * atr)) return null;
    var pos = (c - ll) / rng;
    if (dir === 'long' ? !(pos >= OMNI_CMP_CLOSE_POS && c > o)
                       : !(pos <= 1 - OMNI_CMP_CLOSE_POS && c < o)) return null;  /* M1 */
    var vs = hgOmniCvVolSma(rows, 20, n);
    if (!isFinite(vs) || !(vs > 0)) return null;
    if (!((volSum / volN) <= OMNI_CMP_DRY_X * vs && lv >= OMNI_CMP_THRUST_X * vs)) return null;  /* P1 */
    var entry = lvl;
    var stop = (dir === 'long') ? (boxLo - OMNI_CV_STOP_BUF_ATR * atr)
                                : (boxHi + OMNI_CV_STOP_BUF_ATR * atr);
    stop = hgOmniCvClampStop(dir, entry, stop, atr);
    if (stop === null) return null;
    var gate = hgOmniFormCostGate(entry, stop);
    if (!gate) return null;
    return hgOmniCvHit('COMPRESSION-BREAK', dir, entry, stop,
      OMNI_CMP_BOX_BARS + '-bar compression (' + ((boxHi - boxLo) / atr).toFixed(1)
        + 'x ATR box, dry volume) broke ' + (dir === 'long' ? 'up through ' : 'down through ')
        + entry.toFixed(6) + ' on ' + (lv / vs).toFixed(1) + 'x volume',
      ['multi-bar-compression-box', 'close-through-with-margin', 'expansion-drive-bar',
       'volume-drought-then-climax'],
      { structure: 2, momentum: 1, participation: 1 }, gate);
  }

  /* ---- 5. SWEEP-RECLAIM — counter-trend, structure-CONFIRMED sweep ---------
     THESIS. A climactic stop-run through an established range extreme that is
     answered ON THE NEXT BAR by a displacement close back through both the
     level and the sweep bar itself is a completed liquidity raid — the
     counter-trend slot that EARNS formation instead of anticipating it. The
     replay is blunt about anticipation: SPRING/UTAD fire on the sweep bar and
     lost -63.2R/135 on the UTAD side, PIN-REJECT -118R/115. This kind cannot
     fire on the sweep bar at all.
     LINEAGE: Wyckoff spring TEST (the confirmation, not the spring); stop-run
     / liquidity-raid literature.
     CONFIRMATIONS: S1 real-depth sweep of the established range extreme,
     S2 next-bar reclaim closing beyond the sweep bar's extreme, M1 confirm
     bar closes directionally, P1 climactic volume on the sweep bar. count=4,
     S:2 M:1 P:1. Family SWEEP so consensus never double-counts it with
     SPRING/UTAD/PIN-REJECT. */
  var OMNI_SWR_DEPTH_ATR   = 0.25; /* sweep must pierce at least this far — a tick is noise */
  var OMNI_SWR_CLOSE_POS   = 0.6;  /* confirm bar closes in its directional 40% */
  var OMNI_SWR_SWEEP_VOL_X = 1.5;  /* sweep-bar volume multiple of vSMA20 (the stop-run) */

  function hgOmniSweepReclaim(rows){
    if (!rows || rows.length < RANGE_LOOKBACK + 6) return null;
    var n = rows.length - 1;
    var atr = atrOf(rows, 14);
    if (!(atr > 0)) return null;
    /* the range must be established BEFORE the sweep bar: slice off the
       confirm bar, and hgOmniRange itself excludes the sweep bar */
    var rng = hgOmniRange(rows.slice(0, rows.length - 1), RANGE_LOOKBACK);
    if (!rng) return null;
    var sw = rows[n - 1], cf = rows[n];
    var swH = num(sw.h), swL = num(sw.l), swV = num(sw.v);
    var c = num(cf.c), o = num(cf.o), lh = num(cf.h), ll = num(cf.l);
    if (!isFinite(swH) || !isFinite(swL) || !isFinite(swV)) return null;
    if (!isFinite(c) || !isFinite(o) || !isFinite(lh) || !isFinite(ll)) return null;
    var crng = lh - ll;
    if (!(crng > 0)) return null;
    var vs = hgOmniCvVolSma(rows, 20, n - 1);           /* baseline excludes the sweep bar */
    if (!isFinite(vs) || !(vs > 0)) return null;
    var dir = null, lvl = NaN;
    if (swL < rng.lo && (rng.lo - swL) >= OMNI_SWR_DEPTH_ATR * atr
        && c > rng.lo && c > swH){ dir = 'long'; lvl = rng.lo; }
    else if (swH > rng.hi && (swH - rng.hi) >= OMNI_SWR_DEPTH_ATR * atr
        && c < rng.hi && c < swL){ dir = 'short'; lvl = rng.hi; }
    if (!dir) return null;                              /* S1 + S2 */
    var pos = (c - ll) / crng;
    if (dir === 'long' ? !(pos >= OMNI_SWR_CLOSE_POS && c > o)
                       : !(pos <= 1 - OMNI_SWR_CLOSE_POS && c < o)) return null;  /* M1 */
    if (!(swV >= OMNI_SWR_SWEEP_VOL_X * vs)) return null;                          /* P1 */
    var entry = lvl;
    var stop = (dir === 'long') ? (Math.min(swL, ll) - OMNI_CV_STOP_BUF_ATR * atr)
                                : (Math.max(swH, lh) + OMNI_CV_STOP_BUF_ATR * atr);
    stop = hgOmniCvClampStop(dir, entry, stop, atr);
    if (stop === null) return null;
    var gate = hgOmniFormCostGate(entry, stop);
    if (!gate) return null;
    return hgOmniCvHit('SWEEP-RECLAIM', dir, entry, stop,
      'stop-run through the range ' + (dir === 'long' ? 'low' : 'high') + ' at ' + entry.toFixed(6)
        + ' on ' + (swV / vs).toFixed(1) + 'x volume, reclaimed next bar through the sweep bar’s '
        + (dir === 'long' ? 'high' : 'low'),
      ['range-extreme-swept-with-depth', 'next-bar-reclaim-displacement', 'confirm-bar-close-location',
       'climax-volume-on-sweep'],
      { structure: 2, momentum: 1, participation: 1 }, gate);
  }

  /* ---- 6. EXHAUST-REVERT — counter-trend, climax + confirmed turn ----------
     THESIS. A capitulation bar — 30-bar price extreme, stretched from the
     mean, on climactic volume — followed by a held higher low and a close
     back through the reaction bar is a supply/demand exhaustion whose TURN
     is already on the tape. The replay's naked reversion kinds (THREE-BAR
     -126.8R/161, RSI-DIVERGE -36.1R/58, PIN-REJECT -118R) all anticipate;
     this slot only forms two bars AFTER the climax, once structure has
     actually broken the other way.
     LINEAGE: Wyckoff selling/buying climax + secondary test; capitulation-
     volume studies.
     CONFIRMATIONS: S1 30-bar extreme stretched >= 2 ATR beyond EMA20,
     S2 higher-low (lower-high) hold plus a close through the reaction bar,
     M1 RSI at an extreme on the climax and recovering, P1 climax volume the
     highest of its window. count=4, S:2 M:1 P:1. Family REVERSION. */
  var OMNI_EXR_EXTREME_LOOK   = 30;  /* the climax must be a genuine windowed extreme */
  var OMNI_EXR_STRETCH_ATR    = 2.0; /* climax close at least this far beyond EMA20 */
  var OMNI_EXR_RSI_OS         = 30;  /* oversold ceiling at a long climax (70 floor short) */
  var OMNI_EXR_CLIMAX_X       = 1.8; /* climax volume multiple of vSMA20 */
  var OMNI_EXR_CLIMAX_HIGHEST = 15;  /* and highest of this many bars */

  function hgOmniExhaustRevert(rows){
    if (!rows || rows.length < OMNI_EXR_EXTREME_LOOK + 25) return null;
    var n = rows.length - 1, k = n - 2;                 /* k: the climax bar, two bars back */
    var atr = atrOf(rows, 14);
    if (!(atr > 0)) return null;
    var c1 = closesOf(rows);
    if (c1.length !== rows.length) return null;
    var e20 = hgOmniCvEmaArr(c1, 20);
    var r = hgOmniCvRsiArr(c1, 14);
    if (!e20 || !r) return null;
    var kH = num(rows[k].h), kL = num(rows[k].l), kC = num(rows[k].c), kV = num(rows[k].v);
    var rH = num(rows[n - 1].h), rL = num(rows[n - 1].l);
    var c = num(rows[n].c), lh = num(rows[n].h), ll = num(rows[n].l);
    if (!isFinite(kH) || !isFinite(kL) || !isFinite(kC) || !isFinite(kV)) return null;
    if (!isFinite(rH) || !isFinite(rL) || !isFinite(c) || !isFinite(lh) || !isFinite(ll)) return null;
    var i, x, dir = null;
    /* S1 — windowed extreme + stretch, long side then mirrored short */
    var isLowExt = true, isHighExt = true;
    for (i = n - OMNI_EXR_EXTREME_LOOK; i <= n; i++){
      if (i === k) continue;
      x = num(rows[i].l); if (isFinite(x) && x < kL) isLowExt = false;
      x = num(rows[i].h); if (isFinite(x) && x > kH) isHighExt = false;
    }
    if (isLowExt && kC <= e20[k] - OMNI_EXR_STRETCH_ATR * atr) dir = 'long';
    else if (isHighExt && kC >= e20[k] + OMNI_EXR_STRETCH_ATR * atr) dir = 'short';
    if (!dir) return null;
    /* S2 — the turn is on the tape: held reaction extreme, then a close through it */
    if (dir === 'long'){
      if (!(rL > kL && ll > kL && c > rH)) return null;
    } else {
      if (!(rH < kH && lh < kH && c < rL)) return null;
    }
    /* M1 — RSI at the extreme on the climax, recovering by the confirm bar */
    if (dir === 'long'){
      if (!(r[k] <= OMNI_EXR_RSI_OS && r[n] > r[k])) return null;
    } else {
      if (!(r[k] >= 100 - OMNI_EXR_RSI_OS && r[n] < r[k])) return null;
    }
    /* P1 — climax participation: outsized AND the highest of its window */
    var vs = hgOmniCvVolSma(rows, 20, k);               /* baseline excludes the climax bar */
    if (!isFinite(vs) || !(vs > 0)) return null;
    if (!(kV >= OMNI_EXR_CLIMAX_X * vs)) return null;
    for (i = k - OMNI_EXR_CLIMAX_HIGHEST; i <= k - 1; i++){
      if (i < 0) continue;
      x = num(rows[i].v);
      if (isFinite(x) && x > kV) return null;
    }
    /* geometry + formation cost gate: entry at the confirmed break level,
       stop beyond the climax extreme */
    var entry = dir === 'long' ? rH : rL;
    var stop = (dir === 'long') ? (kL - OMNI_CV_STOP_BUF_ATR * atr)
                                : (kH + OMNI_CV_STOP_BUF_ATR * atr);
    stop = hgOmniCvClampStop(dir, entry, stop, atr);
    if (stop === null) return null;
    var gate = hgOmniFormCostGate(entry, stop);
    if (!gate) return null;
    return hgOmniCvHit('EXHAUST-REVERT', dir, entry, stop,
      (dir === 'long' ? 'selling' : 'buying') + ' climax at the ' + OMNI_EXR_EXTREME_LOOK
        + '-bar extreme on ' + (kV / vs).toFixed(1) + 'x volume; turn confirmed through '
        + entry.toFixed(6),
      ['windowed-extreme-stretched-from-mean', 'held-reaction-then-structure-break',
       'rsi-extreme-recovering', 'climax-volume-highest-of-' + OMNI_EXR_CLIMAX_HIGHEST],
      { structure: 2, momentum: 1, participation: 1 }, gate);
  }

  /* ==================== end conviction roster ==================== */

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
     it — pass 1 fetches every contract and keeps the bars so pass 2 can
     run every engine on quiet names too. Four numbers per symbol costs
     no network at all.

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
     depth in hand for every scannable contract. */

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
    /* The conviction roster: six formation-time mechanics, each demanding
       >= 3 independent confirmations and a PASSED formation cost gate before
       a hit can exist. Pure over rows, so the measured-edge replay sees
       exactly what the live scan trades. Individually wrapped — one bad
       detector must not cost the other five, nor the scan. */
    try { d = hgOmniHtfPullback(rows); } catch (eCv1) { d = null; }
    if (d) out.push(d);
    try { d = hgOmniDonchianDrive(rows); } catch (eCv2) { d = null; }
    if (d) out.push(d);
    try { d = hgOmniAvwapDefend(rows); } catch (eCv3) { d = null; }
    if (d) out.push(d);
    try { d = hgOmniCompressionBreak(rows); } catch (eCv4) { d = null; }
    if (d) out.push(d);
    try { d = hgOmniSweepReclaim(rows); } catch (eCv5) { d = null; }
    if (d) out.push(d);
    try { d = hgOmniExhaustRevert(rows); } catch (eCv6) { d = null; }
    if (d) out.push(d);
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

  /* ============ pure: vol targeting · CVD · liquidation map ============

     The coverage table below named these three as the tab's own holes, and
     the tab printed them: TSMOM PARTIAL without vol_targeting, order flow
     PARTIAL without cvd and liquidation_map. A desk that claims every
     engine and every indicator cannot carry three techniques it only lists.

     All three are pure over OHLCV so they run on EVERY contract, including
     CoinDCX names with no Binance twin, and all three reach the ledger as
     INFO reads — they argue on the card and never veto. Nothing here has a
     measured record on this desk yet, and three new vetoes would re-cut the
     ledger by assertion rather than by evidence. */

  /* Volatility budget, expressed per bar of the scan timeframe (4h). Crypto
     perps routinely run hotter than this; that is the point — the multiplier
     says how much smaller the position has to be for the risk to match. */
  var OMNI_VOL_TARGET_PCT = 2.5;
  var OMNI_VOL_MULT_MIN = 0.25;
  var OMNI_VOL_MULT_MAX = 3;

  /* Realized volatility against a budget, and the size that budget implies.
     TSMOM sizes by volatility rather than by conviction, and without this a
     1%-a-bar tape and an 8%-a-bar tape were ranked as the same trade. Pure;
     null rather than a guess when there is too little history. */
  function hgOmniVolTarget(rows, cfg){
    if (!rows || rows.length < 40) return null;
    cfg = cfg || {};
    var want = fin(cfg.lookback);
    var look = Math.min(isFinite(want) && want > 0 ? want : 60, rows.length - 1);
    if (look < 20) return null;
    var rets = [], i, a, b;
    for (i = rows.length - look; i < rows.length; i++){
      if (i < 1) continue;
      a = fin(rows[i - 1].c); b = fin(rows[i].c);
      if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0) continue;
      rets.push(Math.log(b / a));
    }
    if (rets.length < 20) return null;
    var mean = 0;
    for (i = 0; i < rets.length; i++) mean += rets[i];
    mean /= rets.length;
    var sq = 0;
    for (i = 0; i < rets.length; i++) sq += (rets[i] - mean) * (rets[i] - mean);
    var sd = Math.sqrt(sq / (rets.length - 1));
    if (!isFinite(sd) || sd <= 0) return null;
    var sigmaNow = sd * 100;
    var target = fin(cfg.targetPct);
    if (!isFinite(target) || target <= 0) target = OMNI_VOL_TARGET_PCT;
    var raw = target / sigmaNow;
    var mult = Math.max(OMNI_VOL_MULT_MIN, Math.min(raw, OMNI_VOL_MULT_MAX));
    return {
      sigmaNow: sigmaNow,
      sigmaTarget: target,
      mult: mult,
      /* Clipped at both ends deliberately: an unbounded multiplier on a dead
         tape is an invitation to size into an illiquid contract. */
      clipped: raw !== mult,
      overBudget: sigmaNow > target,
      note: 'realized vol ' + sigmaNow.toFixed(2) + '%/bar vs a ' + target.toFixed(2)
          + '% budget — size ' + mult.toFixed(2) + 'x'
    };
  }

  /* Cumulative volume delta.

     Binance's free taker buy/sell series is REAL aggressor data and is used
     whenever the contract has a twin. Everything else gets the standard
     close-location approximation over candle volume, LABELLED as an
     approximation the same way the volume profile labels its own — a candle
     is not a trade tape, and pretending otherwise on a CoinDCX-only name
     would be worse than the honest estimate. Pure. */
  function hgOmniCvd(rows, look, taker){
    if (!rows || rows.length < 30) return null;
    var want = fin(look);
    var n = Math.max(10, Math.min(isFinite(want) && want > 0 ? want : 30, rows.length));
    var i, delta = 0, source = 'candles', used = 0;
    var series = (taker && taker.series && taker.series.length) ? taker.series : null;
    if (series){
      for (i = Math.max(0, series.length - n); i < series.length; i++){
        var r = fin(series[i] && series[i].buySellRatio);
        if (!isFinite(r) || r <= 0) continue;
        /* (r-1)/(r+1) maps a buy/sell RATIO onto a signed imbalance in
           [-1,1]. Subtracting 1 instead would make a 0.5 ratio (-0.5) look
           half as one-sided as a 2.0 ratio (+1.0) for the mirror-image
           tape. */
        delta += (r - 1) / (r + 1);
        used++;
      }
      if (used >= 4) source = 'taker';
      else { delta = 0; used = 0; }
    }
    if (source === 'candles'){
      for (i = Math.max(0, rows.length - n); i < rows.length; i++){
        var h = fin(rows[i].h), l = fin(rows[i].l), c = fin(rows[i].c), v = fin(rows[i].v);
        if (!isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
        if (!isFinite(v) || v < 0) v = 0;
        var rng = h - l;
        /* A zero-range bar carries no location information — it must not
           divide by zero and it must not be read as neutral pressure that
           did not happen. */
        if (!(rng > 0)) { used++; continue; }
        var clv = ((c - l) - (h - c)) / rng;
        delta += clv * v;
        used++;
      }
      if (!used) return null;
    }
    if (!isFinite(delta)) return null;
    var first = fin(rows[Math.max(0, rows.length - n)].c);
    var last = fin(rows[rows.length - 1].c);
    var priceUp = (isFinite(first) && isFinite(last)) ? (last > first) : null;
    var flowUp = delta > 0;
    var divergence = null;
    if (priceUp === true && !flowUp) divergence = 'bear';
    else if (priceUp === false && flowUp) divergence = 'bull';
    return {
      delta: delta,
      source: source,
      dir: flowUp ? 'long' : 'short',
      bars: used,
      divergence: divergence,
      note: source === 'taker'
        ? ('CVD ' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + ' from Binance taker buy/sell over '
           + used + ' windows')
        : ('CVD ' + (delta >= 0 ? '+' : '') + delta.toFixed(0)
           + ' candle-approximated close-location delta over ' + used + ' bars (no trade tape)')
    };
  }

  /* Liquidation map.

     No exchange publishes a free liquidation heatmap, so this projects one
     from what candles do say: positions are opened at the extremes the tape
     just made, and a position opened there dies at a price set by its
     leverage. Cluster those deaths and you have the levels the market has a
     mechanical reason to reach.

     Deliberately NOT the same question as liq-room, which asks how much
     leverage OUR stop survives. This asks where OTHER people's stops are.
     Pure. */
  function hgOmniLiqMap(rows, cfg){
    if (!rows || rows.length < 40) return null;
    cfg = cfg || {};
    var px = fin(rows[rows.length - 1].c);
    if (!isFinite(px) || px <= 0) return null;
    var want = fin(cfg.lookback);
    var look = Math.min(isFinite(want) && want > 0 ? want : 60, rows.length);
    var blk = Math.max(5, Math.round(fin(cfg.block) || 10));
    var levs = (cfg.levs && cfg.levs.length) ? cfg.levs : [10, 25, 50, 100];
    var mmr = fin(cfg.mmr);
    if (!isFinite(mmr) || mmr < 0) mmr = 0.005;
    var start = Math.max(0, rows.length - look);
    var refs = [], i, j;
    /* Block extremes rather than pivot patterns: a pivot definition that
       finds nothing on a quiet tape would report "no clusters" for a
       contract that plainly has a recent range. */
    for (i = start; i < rows.length; i += blk){
      var hi = -Infinity, lo = Infinity;
      for (j = i; j < Math.min(i + blk, rows.length); j++){
        var h = fin(rows[j].h), l = fin(rows[j].l);
        if (isFinite(h) && h > hi) hi = h;
        if (isFinite(l) && l < lo) lo = l;
      }
      if (hi !== -Infinity) refs.push({ price: hi, side: 'long' });
      if (lo !== Infinity) refs.push({ price: lo, side: 'short' });
    }
    if (!refs.length) return null;
    var raw = [];
    for (i = 0; i < refs.length; i++){
      for (j = 0; j < levs.length; j++){
        var lev = fin(levs[j]);
        if (!isFinite(lev) || lev <= 1) continue;
        /* A long opened at a swing high is liquidated below it; a short
           opened at a swing low is liquidated above it. */
        var p = (refs[i].side === 'long')
          ? refs[i].price * (1 - 1 / lev + mmr)
          : refs[i].price * (1 + 1 / lev - mmr);
        if (!isFinite(p) || p <= 0) continue;
        raw.push({ price: p, side: refs[i].side, lev: lev });
      }
    }
    if (!raw.length) return null;
    var atr = atrOf(rows, 14);
    var tol = Math.max(isFinite(atr) && atr > 0 ? atr * 0.35 : 0, px * 0.002);
    raw.sort(function(a, b){ return a.price - b.price; });
    var clusters = [], cur = null;
    for (i = 0; i < raw.length; i++){
      if (cur && Math.abs(raw[i].price - cur.price) <= tol){
        cur.sum += raw[i].price;
        cur.weight++;
        cur.price = cur.sum / cur.weight;
        if (raw[i].lev < cur.minLev) cur.minLev = raw[i].lev;
        if (raw[i].side !== cur.side) cur.mixed = true;
      } else {
        if (cur) clusters.push(cur);
        cur = { price: raw[i].price, sum: raw[i].price, weight: 1,
                side: raw[i].side, minLev: raw[i].lev, mixed: false };
      }
    }
    if (cur) clusters.push(cur);
    var out = [];
    for (i = 0; i < clusters.length; i++){
      out.push({ price: clusters[i].price, weight: clusters[i].weight,
                 side: clusters[i].side, minLev: clusters[i].minLev,
                 mixed: clusters[i].mixed === true });
    }
    var below = null, above = null;
    for (i = 0; i < out.length; i++){
      if (out[i].price < px && (!below || out[i].price > below.price)) below = out[i];
      if (out[i].price > px && (!above || out[i].price < above.price)) above = out[i];
    }
    return { clusters: out, nearestBelow: below, nearestAbove: above, tol: tol, price: px };
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
    /* The conviction roster replays under the SAME kind strings the detect
       pass emits (rule below): pure functions of rows, zero lookahead, so
       detectFn(rows.slice(0, i+1)) measures exactly what is traded. Wrapped
       like the shared block — a throwing detector is a null, not a dead pool. */
    fns['HTF-PULLBACK']      = function(r){ try { return hgOmniHtfPullback(r); } catch (e) { return null; } };
    fns['DONCHIAN-DRIVE']    = function(r){ try { return hgOmniDonchianDrive(r); } catch (e) { return null; } };
    fns['AVWAP-DEFEND']      = function(r){ try { return hgOmniAvwapDefend(r); } catch (e) { return null; } };
    fns['COMPRESSION-BREAK'] = function(r){ try { return hgOmniCompressionBreak(r); } catch (e) { return null; } };
    fns['SWEEP-RECLAIM']     = function(r){ try { return hgOmniSweepReclaim(r); } catch (e) { return null; } };
    fns['EXHAUST-REVERT']    = function(r){ try { return hgOmniExhaustRevert(r); } catch (e) { return null; } };
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
  /* rMult: the R multiple the samples were MEASURED at. Defaults to MIN_RR,
     which is what this desk backtests at, so omniroute's own call is
     unchanged.

     THE BUG THIS PARAMETER EXISTS FOR. The pool recomputed expectancy from
     the pooled hit rate using MIN_RR unconditionally — this module's
     constant, 2.0 — while the CALLER may have measured at something else.
     hgOmniBacktestOne already takes opts.rMult and OMNIGOLD passes its
     horizon's floor: 1.5R on SCALP, 2.0R on SWING. So every scalp mechanic
     was measured at 1.5R and then had its expectancy re-priced at 2.0R.

     Measured on live gold: STOCHRSI-TURN, 12 wins of 29 settled, hit 41.4%.
     At the 1.5R it was actually measured at that is +0.034R — a coin flip
     either side of breakeven, which for 1.5R is 40%. Re-priced at 2.0R the
     pool printed +0.241R, seven times larger, and that is the number the
     card showed and measured-edge reasoned about. SWING was correct only
     because its floor happens to equal MIN_RR.

     Nothing about the samples changes — the hit rate was always right. What
     was wrong was the R multiple the winners were paid at. */
  function hgOmniPoolStats(perSymbol, rMult){
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
      /* fin-style guard: a caller passing null/'' must fall back, not
         silently price every mechanic at 0R. */
      var rr = +rMult;
      if (!isFinite(rr) || rr <= 0) rr = MIN_RR;
      p.rMult = rr;
      p.expR = p.samples ? (p.hit * rr - (1 - p.hit)) : NaN;
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
                        'POC-REVERT','THREE-BAR',
                        /* the conviction roster — six more searches, so the Sidak bar
                           below tightens accordingly: the accepted cost of honesty */
                        'HTF-PULLBACK','DONCHIAN-DRIVE','AVWAP-DEFEND',
                        'COMPRESSION-BREAK','SWEEP-RECLAIM','EXHAUST-REVERT'];

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
    'XS-LEADER':'CROSS-SECTIONAL', 'XS-LAGGARD':'CROSS-SECTIONAL',
    /* House extra engines vote once per family. They never claim 7/7 CLEAN. */
    'EDGE':'TREND', 'SWING':'TREND', 'SCALP':'TREND', 'HOUSE-SQUEEZE':'TREND', 'COIL':'TREND',
    'MR':'REVERSION', 'SNIPER':'REVERSION',
    'TRAP':'SWEEP', 'SMC':'SWEEP',
    'FUND-FADE':'POSITIONING',
    /* The conviction roster. Four continuation kinds vote TREND; the two
       counter-trend kinds sit in SWEEP/REVERSION so hgOmniIsReversion treats
       them correctly and consensus never double-counts them with
       SPRING/UTAD/PIN-REJECT. */
    'HTF-PULLBACK':'TREND', 'DONCHIAN-DRIVE':'TREND', 'AVWAP-DEFEND':'TREND',
    'COMPRESSION-BREAK':'TREND',
    'SWEEP-RECLAIM':'SWEEP', 'EXHAUST-REVERT':'REVERSION'
  };
  /* The shared mechanics bring their own family map. Merged rather than
     retyped, so a kind cannot be classified one way here and another there. */
  (function(){
    var m = (typeof window !== 'undefined') ? window.HG_MECH_FAMILY : null;
    if (!m) return;
    for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k) && !OMNI_FAMILY[k]) OMNI_FAMILY[k] = m[k];
  })();
  function hgOmniFamilyOf(kind){ return OMNI_FAMILY[String(kind || '')] || 'OTHER'; }

  function hgOmniIsReversion(kind){
    var f = hgOmniFamilyOf(kind);
    return f === 'REVERSION' || f === 'SWEEP';
  }

  /* Hits the ledger has already disqualified must not vote. TREND shorts
     that fail `trend` / `htf-daily` on a rising stack used to empty every
     with-trend ticket via consensus. A vetoed setup is not disagreement.
     With no HTF the filter is a no-op so existing consensus harnesses stay
     two-sided. */
  function hgOmniConsensusVoters(allHits, rows, extra){
    if (!allHits || !allHits.length) return allHits || [];
    extra = extra || {};
    var he21 = extra.htf ? fin(extra.htf.e21) : NaN, he50 = extra.htf ? fin(extra.htf.e50) : NaN;
    var dailyUp = (isFinite(he21) && isFinite(he50)) ? (he21 >= he50) : null;
    var out = [], i, h, rev, agrees;
    for (i = 0; i < allHits.length; i++){
      h = allHits[i];
      if (!h || (h.dir !== 'long' && h.dir !== 'short')) continue;
      rev = hgOmniIsReversion(h.kind);
      if (dailyUp === null){ out.push(h); continue; }
      if (!rev){
        agrees = (h.dir === 'long') ? dailyUp : !dailyUp;
        if (!agrees) continue;
      } else if (dailyUp === (h.dir === 'short')) continue;
      out.push(h);
    }
    return out;
  }

  /* The printed trade IS the mechanic. Pricing entry at last close while the
     detector named an FVG / ORB / VALUE produced the live gold-desk defect
     on crypto: SETUP at one price, ENTRY at another. Sweeps stop beyond the
     named level. Continuation still uses structure from that entry,
     skipExact so enrichers cannot hijack it. Fades never get a momentum
     stop: a fade's premise IS the level. */
  function hgOmniPlanForHit(hit, rows, extra){
    extra = extra || {};
    if (!hit || (hit.dir !== 'long' && hit.dir !== 'short')) return null;
    var live = fin(extra.livePx);
    var lvl = fin(hit.level);
    var entry = (isFinite(lvl) && lvl > 0) ? lvl
              : ((isFinite(live) && live > 0) ? live : undefined);
    var minRr = isFinite(fin(extra.minRr)) && fin(extra.minRr) > 0 ? fin(extra.minRr) : MIN_RR;
    var reversion = hgOmniIsReversion(hit.kind);
    var w = (typeof window !== 'undefined') ? window : null;
    var fromRisk = (w && typeof w.hgPlanFromRisk === 'function') ? w.hgPlanFromRisk : null;
    var planFn = (w && typeof w.hgPlanLevels === 'function') ? w.hgPlanLevels : null;
    var a = atrOf(rows, 14);
    if (!(isFinite(a) && a > 0) && isFinite(entry)) a = entry * 0.01;

    /* Conviction mechanics computed their own structural stop at formation
       and PROVED it pays costs (hgOmniFormCostGate); the plan must use THAT
       geometry, not rebuild it. Entry stays hit.level — the printed trade IS
       the mechanic. Targets are R-multiples because that is what
       hgPlanFromRisk supports: 2R/3.5R, the 3.5R T2 standing in for the
       trend thesis' trail, which the plan builder does not support and is
       not faked. Returns whatever fromRisk decides — never falls through to
       rebuild a different geometry than the one the gate certified. */
    if (hit.conviction && hit.conviction.costGate === 'passed'
        && isFinite(fin(hit.stopHint)) && isFinite(entry) && fromRisk){
      var cvT1R = isFinite(fin(hit.t1R)) ? fin(hit.t1R) : 2.0;
      var cvT2R = isFinite(fin(hit.t2R)) ? fin(hit.t2R) : 3.5;
      var cvPl = fromRisk(hit.dir, entry, fin(hit.stopHint), {
        t1R: cvT1R, t2R: cvT2R, minRr: minRr,
        targetPolicy: 'R-multiples of conviction-gated structural risk'
      });
      if (cvPl){
        cvPl.note = 'SETUP ' + String(hit.kind) + ' @ ' + entry
                  + ' — CONVICTION ' + fin(hit.conviction.count) + '/3+ · formation cost gate passed ('
                  + (isFinite(fin(hit.conviction.costR)) ? fin(hit.conviction.costR).toFixed(3) : '?')
                  + 'R to costs)';
        cvPl.planSrc = 'hgOmniPlanForHit';
        cvPl.dir = hit.dir;
      }
      return cvPl;
    }

    if (reversion && isFinite(entry) && fromRisk){
      var lastBar = (rows && rows.length) ? rows[rows.length - 1] : null;
      var stop, wick;
      if (hit.dir === 'long'){
        wick = lastBar ? fin(lastBar.l) : NaN;
        stop = ((isFinite(wick) && wick < entry) ? wick : entry) - 0.35 * a;
      } else {
        wick = lastBar ? fin(lastBar.h) : NaN;
        stop = ((isFinite(wick) && wick > entry) ? wick : entry) + 0.35 * a;
      }
      if (!isFinite(stop)) return null;
      var risk = Math.abs(entry - stop);
      if (isFinite(a) && a > 0 && risk > 6 * a){
        stop = (hit.dir === 'long') ? (entry - 6 * a) : (entry + 6 * a);
      }
      var sweepPl = fromRisk(hit.dir, entry, stop, {
        t1R: 2, t2R: 3.5, minRr: minRr,
        targetPolicy: 'R-multiples of setup-level risk'
      });
      if (sweepPl){
        sweepPl.note = 'SETUP ' + String(hit.kind) + ' @ ' + entry
                     + ' — stop beyond the level that is the trade';
        sweepPl.planSrc = 'hgOmniPlanForHit';
        sweepPl.dir = hit.dir;
      }
      return sweepPl;
    }

    if (!planFn || !isFinite(entry)) return null;
    var plan = null;
    try {
      plan = planFn(hit.dir, rows, entry, {
        minRr: minRr, capMode: 'structure', skipExact: true,
        momentumOk: !hgOmniIsReversion(hit.kind)
      });
    } catch (eP) { plan = null; }
    return plan;
  }

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

  /* ================== P0 SOLIDITY FRAMEWORK SCORING (50 pts total) ================== */

  /* 1. ORDER BLOCKS DETECTION & SCORING (15 pts)
     Detects recent order blocks (swing high/low with +2 bar confirmation).
     Scores proximity: 15pts if entry within 0.5×ATR, 10pts if within 1.0×ATR,
     5pts if within 1.5×ATR, 0pts otherwise.
  */
  function hgOmniOrderBlockScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 5) return { score: 0, detail: 'insufficient data' };
    var rows = setup.rows, plan = setup.plan;
    if (!plan || !isFinite(fin(plan.entry))) return { score: 0, detail: 'no plan' };

    var atr = atrOf(rows, 14);
    if (!isFinite(atr) || atr <= 0) return { score: 0, detail: 'ATR unavailable' };

    /* Detect recent order block: look for swing high/low with 2-bar confirmation */
    var entry = fin(plan.entry);
    var i, score = 0, detail = '';

    /* Check last 10 bars for recent order block (swing extremes) */
    var obLevel = null;
    if (rows.length >= 5){
      /* Swing low: low below previous 2 lows, then 2 bars close above it */
      for (i = rows.length - 5; i >= Math.max(0, rows.length - 15); i--){
        var lo = num(rows[i].l), loMinus1 = num(rows[i-1].l), loMinus2 = num(rows[i-2].l);
        var close1 = num(rows[i+1].c), close2 = num(rows[i+2].c);
        if (isFinite(lo) && isFinite(loMinus1) && isFinite(loMinus2) &&
            isFinite(close1) && isFinite(close2) &&
            lo < loMinus1 && lo < loMinus2 && close1 > lo && close2 > lo){
          obLevel = lo;
          break;
        }
      }
      /* Swing high: high above previous 2 highs, then 2 bars close below it */
      if (!obLevel){
        for (i = rows.length - 5; i >= Math.max(0, rows.length - 15); i--){
          var hi = num(rows[i].h), hiMinus1 = num(rows[i-1].h), hiMinus2 = num(rows[i-2].h);
          var close1 = num(rows[i+1].c), close2 = num(rows[i+2].c);
          if (isFinite(hi) && isFinite(hiMinus1) && isFinite(hiMinus2) &&
              isFinite(close1) && isFinite(close2) &&
              hi > hiMinus1 && hi > hiMinus2 && close1 < hi && close2 < hi){
            obLevel = hi;
            break;
          }
        }
      }
    }

    if (obLevel){
      var distFromOb = Math.abs(entry - obLevel) / atr;
      if (distFromOb <= 0.5){
        score = 15;
        detail = 'OB at ' + obLevel.toFixed(2) + ', entry within 0.5x ATR (' + distFromOb.toFixed(2) + 'x)';
      } else if (distFromOb <= 1.0){
        score = 10;
        detail = 'OB at ' + obLevel.toFixed(2) + ', entry within 1.0x ATR (' + distFromOb.toFixed(2) + 'x)';
      } else if (distFromOb <= 1.5){
        score = 5;
        detail = 'OB at ' + obLevel.toFixed(2) + ', entry within 1.5x ATR (' + distFromOb.toFixed(2) + 'x)';
      } else {
        score = 0;
        detail = 'OB at ' + obLevel.toFixed(2) + ', entry beyond 1.5x ATR';
      }
    } else {
      detail = 'no recent order block detected';
    }

    return { score: score, detail: detail, maxScore: 15 };
  }

  /* 2. FVG (FAIR VALUE GAP) DETECTION & SCORING (10 pts)
     Detects fresh bearish/bullish FVG (3-bar imbalance unmitigated).
     Scores: 10pts if FVG exists within 1×ATR, 5pts if within 2×ATR, 0pts otherwise.
  */
  function hgOmniFvgScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 4) return { score: 0, detail: 'insufficient data' };
    var rows = setup.rows, plan = setup.plan;
    if (!plan || !isFinite(fin(plan.entry))) return { score: 0, detail: 'no plan' };

    var atr = atrOf(rows, 14);
    if (!isFinite(atr) || atr <= 0) return { score: 0, detail: 'ATR unavailable' };

    var entry = fin(plan.entry);
    var score = 0, detail = '', fvgLevel = null;

    /* Look for FVG in last 8 bars: 3-bar imbalance (gap between bar 1 high and bar 2 low, or vice versa) */
    if (rows.length >= 4){
      for (var i = rows.length - 4; i >= Math.max(0, rows.length - 12); i--){
        var h1 = num(rows[i].h), l1 = num(rows[i].l);
        var h2 = num(rows[i+1].h), l2 = num(rows[i+1].l);
        var h3 = num(rows[i+2].h), l3 = num(rows[i+2].l);

        if (!isFinite(h1) || !isFinite(l1) || !isFinite(h2) || !isFinite(l2) ||
            !isFinite(h3) || !isFinite(l3)) continue;

        /* Bullish FVG: bar 1 low > bar 2 high */
        if (l1 > h2 && h2 < l3){
          fvgLevel = { type: 'bullish', level: h2, top: l1 };
          break;
        }
        /* Bearish FVG: bar 1 high < bar 2 low */
        if (h1 < l2 && l2 > h3){
          fvgLevel = { type: 'bearish', level: l2, bottom: h1 };
          break;
        }
      }
    }

    if (fvgLevel){
      var fvgMid = fvgLevel.type === 'bullish' ? (fvgLevel.level + fvgLevel.top) / 2 :
                   (fvgLevel.level + fvgLevel.bottom) / 2;
      var distFromFvg = Math.abs(entry - fvgMid) / atr;

      if (distFromFvg <= 1.0){
        score = 10;
        detail = fvgLevel.type + ' FVG near ' + fvgMid.toFixed(2) + ', entry within 1x ATR (' + distFromFvg.toFixed(2) + 'x)';
      } else if (distFromFvg <= 2.0){
        score = 5;
        detail = fvgLevel.type + ' FVG near ' + fvgMid.toFixed(2) + ', entry within 2x ATR (' + distFromFvg.toFixed(2) + 'x)';
      } else {
        score = 0;
        detail = fvgLevel.type + ' FVG exists but entry beyond 2x ATR';
      }
    } else {
      detail = 'no fresh FVG detected';
    }

    return { score: score, detail: detail, maxScore: 10 };
  }

  /* 3. MULTI-TF EMA CASCADE SCORING (10 pts)
     Validates 1H, 4H, and daily EMA8/21/50 stack alignment.
     Score: 10pts if 1H/4H/daily all agree, 7pts if 2/3 agree, 3pts if 1/3, 0pts otherwise.
  */
  function hgOmniMultiTfCascadeScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 120) return { score: 0, detail: 'insufficient data' };
    var rows = setup.rows, hit = setup.hit;
    if (!hit || !hit.dir) return { score: 0, detail: 'no hit' };

    var direction = hit.dir;
    var agreements = 0;

    /* Current timeframe: extract closes and check EMA8/21/50 alignment */
    var closes = closesOf(rows);
    if (closes.length < 50){
      return { score: 0, detail: 'insufficient closes' };
    }

    /* Check current TF: 1H assumed if we have ~60 closes for recent period */
    var e8 = emaOf(closes.slice(-30), 8);
    var e21 = emaOf(closes.slice(-60), 21);
    var e50 = emaOf(closes.slice(-120), 50);
    var currentLast = closes[closes.length - 1];

    var tf1hAlign = false;
    if (isFinite(e8) && isFinite(e21) && isFinite(e50) && isFinite(currentLast)){
      /* EMA stack: for longs, should be 8 > 21 > 50 (or close 8) */
      if (direction === 'long'){
        tf1hAlign = (e8 >= e21 * 0.998) && (e21 >= e50 * 0.998) && (currentLast >= e8 * 0.995);
      } else {
        tf1hAlign = (e8 <= e21 * 1.002) && (e21 <= e50 * 1.002) && (currentLast <= e8 * 1.005);
      }
    }
    if (tf1hAlign) agreements++;

    /* 4H resample */
    var tf4h = hgOmniResample(rows, 14400);  /* 4 hours in seconds */
    var tf4hAlign = false;
    if (tf4h && tf4h.length >= 50){
      var closes4h = closesOf(tf4h);
      if (closes4h.length >= 50){
        var e8_4h = emaOf(closes4h.slice(-30), 8);
        var e21_4h = emaOf(closes4h.slice(-60), 21);
        var e50_4h = emaOf(closes4h.slice(-120), 50);
        var last4h = closes4h[closes4h.length - 1];

        if (isFinite(e8_4h) && isFinite(e21_4h) && isFinite(e50_4h) && isFinite(last4h)){
          if (direction === 'long'){
            tf4hAlign = (e8_4h >= e21_4h * 0.998) && (e21_4h >= e50_4h * 0.998) && (last4h >= e8_4h * 0.995);
          } else {
            tf4hAlign = (e8_4h <= e21_4h * 1.002) && (e21_4h <= e50_4h * 1.002) && (last4h <= e8_4h * 1.005);
          }
        }
      }
    }
    if (tf4hAlign) agreements++;

    /* Daily resample */
    var tfDaily = hgOmniResample(rows, 86400);  /* 1 day in seconds */
    var tfDailyAlign = false;
    if (tfDaily && tfDaily.length >= 50){
      var closesDaily = closesOf(tfDaily);
      if (closesDaily.length >= 50){
        var e8_d = emaOf(closesDaily.slice(-30), 8);
        var e21_d = emaOf(closesDaily.slice(-60), 21);
        var e50_d = emaOf(closesDaily.slice(-120), 50);
        var lastDaily = closesDaily[closesDaily.length - 1];

        if (isFinite(e8_d) && isFinite(e21_d) && isFinite(e50_d) && isFinite(lastDaily)){
          if (direction === 'long'){
            tfDailyAlign = (e8_d >= e21_d * 0.998) && (e21_d >= e50_d * 0.998) && (lastDaily >= e8_d * 0.995);
          } else {
            tfDailyAlign = (e8_d <= e21_d * 1.002) && (e21_d <= e50_d * 1.002) && (lastDaily <= e8_d * 1.005);
          }
        }
      }
    }
    if (tfDailyAlign) agreements++;

    var score = 0, detail = '';
    if (agreements === 3){
      score = 10;
      detail = '1H/4H/daily all agree on ' + direction;
    } else if (agreements === 2){
      score = 7;
      detail = '2 of 3 timeframes agree on ' + direction;
    } else if (agreements === 1){
      score = 3;
      detail = '1 of 3 timeframes agrees on ' + direction;
    } else {
      score = 0;
      detail = 'no timeframe agreement';
    }

    return { score: score, detail: detail, maxScore: 10, agreements: agreements };
  }

  /* 4. RISK:REWARD GEOMETRY SCORER (15 pts)
     Scores R:R ratio: 15pts if ≥2.0, 12pts if ≥1.5, 8pts if ≥1.0, 0pts if <1.0.
     Bonus: 5pts if stop < 1% from entry, 3pts if < 1.5%.
  */
  function hgOmniRiskRewardScore(setup){
    if (!setup || !setup.plan) return { score: 0, detail: 'no plan' };

    var plan = setup.plan;
    var entry = fin(plan.entry);
    var stop = fin(plan.stop);
    var t1 = fin(plan.t1);

    if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) || entry === stop){
      return { score: 0, detail: 'incomplete plan levels' };
    }

    var risk = Math.abs(entry - stop);
    var reward = Math.abs(t1 - entry);
    var rr = risk > 0 ? reward / risk : 0;

    var baseScore = 0;
    var rrDetail = '';

    if (rr >= 2.0){
      baseScore = 15;
      rrDetail = 'R:R ' + rr.toFixed(2) + ' >= 2.0';
    } else if (rr >= 1.5){
      baseScore = 12;
      rrDetail = 'R:R ' + rr.toFixed(2) + ' >= 1.5';
    } else if (rr >= 1.0){
      baseScore = 8;
      rrDetail = 'R:R ' + rr.toFixed(2) + ' >= 1.0';
    } else {
      baseScore = 0;
      rrDetail = 'R:R ' + rr.toFixed(2) + ' < 1.0';
    }

    /* Stop precision bonus */
    var stopPct = (risk / entry) * 100;
    var bonusScore = 0, bonusDetail = '';

    if (stopPct < 1.0){
      bonusScore = 5;
      bonusDetail = ' + 5pt tight stop bonus (' + stopPct.toFixed(2) + '%)';
    } else if (stopPct < 1.5){
      bonusScore = 3;
      bonusDetail = ' + 3pt stop precision bonus (' + stopPct.toFixed(2) + '%)';
    }

    var totalScore = Math.min(baseScore + bonusScore, 20);  /* cap bonus doesn't exceed total */
    var detail = rrDetail + (bonusDetail || '') + (bonusScore > 0 ? ' total=' + totalScore : '');

    return { score: totalScore, detail: detail, maxScore: 20, rr: rr, stopPct: stopPct };
  }

  /* ==================== P1 SOLIDITY FRAMEWORK (25 pts total) ==================== */

  /* P1.1: REGIME CLASSIFICATION SCORING (10 pts)
     Scores alignment between setup direction and market regime.
     Score: 10pts if regime matches setup direction
     Score: 7pts if regime is RANGE (acceptable for reversals)
     Score: 5pts if regime is COMPRESSION (caution flag but not veto)
     Score: 2pts if regime mismatches (directional entry against trend)
  */
  function hgOmniRegimeScore(setup){
    if (!setup || !setup.hit || !setup.hit.dir) return { score: 0, detail: 'no setup direction' };

    var direction = String(setup.hit.dir).toUpperCase();
    var regime = null;
    var regimeDetail = '';

    /* Try to extract regime from extra/setup enrichment.
       DATA WIRING ONLY (hg-v533) — the label->points mapping below is
       byte-identical. extra.regimeStruct is the STRUCTURAL tape read (the
       same detectRegime() the regime-fit context gate prints, translated to
       this pillar's vocabulary by hgOmniRegimeStructFeed). It is preferred
       because extra.regime is a DIFFERENT datum — the RISK-ON/RISK-OFF
       macro composite — whose labels this vocabulary can only ever score
       2/10 ("mismatch or unknown"): that is why this pillar sat capped at 2
       on every enriched card since the stamp landed. The macro read stays
       exactly where it was for its own consumers (the regime gate, P5.1
       market bias, P5.2 btc-daily-proxy leg); when regimeStruct is absent
       this pillar behaves byte-identically to hg-v532. */
    if (setup.extra && setup.extra.regimeStruct && setup.extra.regimeStruct.label){
      regime = setup.extra.regimeStruct;
    } else if (setup.extra && setup.extra.regime){
      regime = setup.extra.regime;
    } else if (setup.regime){
      regime = setup.regime;
    }

    if (!regime || !regime.label){
      return { score: 0, detail: 'regime unavailable', maxScore: 10 };
    }

    var regimeLabel = String(regime.label).toUpperCase();
    var score = 0;

    /* Regime matching logic */
    if (regimeLabel === 'TRENDING' || regimeLabel === 'TREND'){
      if (direction === 'LONG' || direction === 'UP'){
        score = 10;
        regimeDetail = 'trending regime matches long direction';
      } else if (direction === 'SHORT' || direction === 'DOWN'){
        score = 10;
        regimeDetail = 'trending regime matches short direction';
      } else {
        score = 2;
        regimeDetail = 'trending regime but unclear direction';
      }
    } else if (regimeLabel === 'RANGE' || regimeLabel === 'RANGING'){
      score = 7;
      regimeDetail = 'range regime acceptable for reversion plays';
    } else if (regimeLabel === 'COMPRESSION' || regimeLabel === 'COILING'){
      score = 5;
      regimeDetail = 'compression regime — caution flag but tradeable';
    } else if (regimeLabel === 'REVERSAL' || regimeLabel === 'FLIP'){
      /* Reversal regime suggests opposite direction */
      if ((direction === 'SHORT' || direction === 'DOWN') && regimeLabel === 'REVERSAL TO UP'){
        score = 2;
        regimeDetail = 'reversal regime against setup direction';
      } else if ((direction === 'LONG' || direction === 'UP') && regimeLabel === 'REVERSAL TO DOWN'){
        score = 2;
        regimeDetail = 'reversal regime against setup direction';
      } else {
        score = 7;
        regimeDetail = 'reversal regime aligns with reversion setup';
      }
    } else {
      score = 2;
      regimeDetail = 'regime ' + regimeLabel + ' mismatch or unknown';
    }

    return { score: score, detail: regimeDetail, maxScore: 10, regime: regimeLabel };
  }

  /* P1.2: ATR EXPANSION SIGNAL SCORING (8 pts)
     Detects whether volatility is expanding (recent ATR vs MA) and forecasted.
     Score: 8pts if ATR expanding (5-bar avg > 20-bar MA), 4pts if stable, 1pt if contracting
     Bonus: +2pts if vol forecast predicts further expansion
  */
  function hgOmniAtrExpansionScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 25) return { score: 0, detail: 'insufficient data for ATR expansion' };

    var rows = setup.rows;
    var atr14 = atrOf(rows, 14);
    if (!isFinite(atr14) || atr14 <= 0) return { score: 0, detail: 'ATR unavailable' };

    /* Calculate 5-bar recent ATR average */
    var recentAtrs = [];
    var i, idx, atrVal;
    for (i = Math.max(0, rows.length - 5); i < rows.length; i++){
      idx = Math.max(0, i);
      var subRows = rows.slice(Math.max(0, idx - 13), idx + 1);
      atrVal = atrOf(subRows, 14);
      if (isFinite(atrVal)) recentAtrs.push(atrVal);
    }
    var recentAtrAvg = recentAtrs.length > 0 ? recentAtrs.reduce(function(a,b){return a+b;}) / recentAtrs.length : atr14;

    /* Calculate 20-bar MA of ATR (using historical ATRs) */
    var historicalAtrs = [];
    for (i = Math.max(0, rows.length - 24); i < rows.length; i++){
      idx = Math.max(0, i);
      var histRows = rows.slice(Math.max(0, idx - 13), idx + 1);
      atrVal = atrOf(histRows, 14);
      if (isFinite(atrVal)) historicalAtrs.push(atrVal);
    }
    var atrMa20 = historicalAtrs.length >= 20 ?
                  historicalAtrs.slice(-20).reduce(function(a,b){return a+b;}) / 20 :
                  (historicalAtrs.length > 0 ? historicalAtrs.reduce(function(a,b){return a+b;}) / historicalAtrs.length : atr14);

    var score = 0, detail = '', atrStatus = '';
    var expansionRatio = atrMa20 > 0 ? recentAtrAvg / atrMa20 : 1;

    if (expansionRatio > 1.05){
      score = 8;
      atrStatus = 'expanding';
      detail = 'ATR expanding: recent avg ' + recentAtrAvg.toFixed(2) + ' > MA20 ' + atrMa20.toFixed(2) + ' (ratio ' + expansionRatio.toFixed(2) + ')';
    } else if (expansionRatio >= 0.95){
      score = 4;
      atrStatus = 'stable';
      detail = 'ATR stable: recent avg ' + recentAtrAvg.toFixed(2) + ' ~= MA20 ' + atrMa20.toFixed(2) + ' (ratio ' + expansionRatio.toFixed(2) + ')';
    } else {
      score = 1;
      atrStatus = 'contracting';
      detail = 'ATR contracting: recent avg ' + recentAtrAvg.toFixed(2) + ' < MA20 ' + atrMa20.toFixed(2) + ' (ratio ' + expansionRatio.toFixed(2) + ')';
    }

    /* Bonus: check for vol forecast (if available in setup.extra) */
    var volBonus = 0, volBonusDetail = '';
    if (setup.extra && setup.extra.volForecast && setup.extra.volForecast.expanding){
      volBonus = 2;
      volBonusDetail = ' + 2pt vol forecast bonus (expansion predicted)';
    }

    var totalScore = Math.min(score + volBonus, 8);
    return {
      score: totalScore,
      detail: detail + (volBonusDetail || ''),
      maxScore: 8,
      atrStatus: atrStatus,
      expansionRatio: expansionRatio,
      volBonus: volBonus
    };
  }

  /* P1.3: SESSION/EXECUTION TIMING SCORING (7 pts)
     Scores trade timing by session (LONDON, NY, ASIA) and horizon (SCALP vs SWING).
     SCALP (1H): 7pts LONDON/NY OVERLAP, 5pts LONDON open, 3pts NY open, 1pt ASIA
     SWING (4H): 7pts LONDON/NY OVERLAP, 4pts other active hours
     Penalize: -2pts if red-flag news <1h away, 0pts if in quiet hours
  */
  function hgOmniSessionTimingScore(setup, horizonLabel){
    if (!setup) return { score: 0, detail: 'no setup' };

    /* Current time in IST (Indian Standard Time, UTC+5:30) for consistent reference */
    var now = new Date();
    var istOffset = 5.5; /* IST is UTC+5:30 */
    var utcHours = now.getUTCHours();
    var istHours = (utcHours + istOffset) % 24;
    var minutes = now.getUTCMinutes();
    var timeDecimal = istHours + (minutes / 60);

    var horizon = horizonLabel ? String(horizonLabel).toUpperCase() : 'UNKNOWN';
    var score = 0, sessionLabel = '', detail = '';

    /* Session windows (in IST hours) */
    var asiaOpen = 0;     /* 00:00 IST = 18:30 prev JST open (approx) */
    var londonOpen = 5;   /* 05:00 IST = 23:30 prev London open (approx) */
    var londonNyOverlap = 13; /* 13:00-17:30 IST = 07:30-12:00 London / 13:00-17:30 NY */
    var nyOpen = 20.5;    /* 20:30 IST = 11:00 NY open (approx) */
    var quietHoursStart = 0;
    var quietHoursEnd = 5;

    /* Determine current session and timing bonus */
    if (timeDecimal >= londonNyOverlap && timeDecimal < 17.5){
      sessionLabel = 'LONDON/NY OVERLAP';
      if (horizon === 'SCALP' || horizon === '1H'){
        score = 7;
      } else if (horizon === 'SWING' || horizon === '4H'){
        score = 7;
      } else {
        score = 6;
      }
    } else if (timeDecimal >= londonOpen && timeDecimal < londonNyOverlap){
      sessionLabel = 'LONDON OPEN';
      if (horizon === 'SCALP' || horizon === '1H'){
        score = 5;
      } else {
        score = 4;
      }
    } else if (timeDecimal >= nyOpen || timeDecimal < asiaOpen + 1){
      sessionLabel = 'NY OPEN';
      if (horizon === 'SCALP' || horizon === '1H'){
        score = 3;
      } else {
        score = 3;
      }
    } else if (timeDecimal >= asiaOpen && timeDecimal < londonOpen){
      sessionLabel = 'ASIA';
      if (horizon === 'SCALP' || horizon === '1H'){
        score = 1;
      } else {
        score = 1;
      }
    } else {
      sessionLabel = 'UNDEFINED';
      score = 0;
    }

    /* Quiet hours penalty (very low liquidity) */
    if (timeDecimal >= quietHoursStart && timeDecimal < quietHoursEnd){
      score = 0;
      sessionLabel = 'QUIET HOURS (penalized)';
      detail = 'setup during quiet hours (00:00-05:00 IST) — minimal liquidity';
    } else {
      detail = horizon + ' setup during ' + sessionLabel + ' (' + istHours.toFixed(1) + ' IST)';
    }

    /* News penalty: -2pts if red-flag news <1h away */
    var newsPenalty = 0;
    if (setup.extra && setup.extra.redFlagNews && setup.extra.redFlagNews.minutesUntil < 60){
      newsPenalty = 2;
      score = Math.max(0, score - newsPenalty);
      detail += ' | -2pt news penalty (' + setup.extra.redFlagNews.minutesUntil + 'min to ' + setup.extra.redFlagNews.event + ')';
    }

    return {
      score: score,
      detail: detail,
      maxScore: 7,
      session: sessionLabel,
      horizon: horizon,
      istHours: istHours,
      newsPenalty: newsPenalty
    };
  }

  /* ==================== end P1 solidity framework ==================== */

  /* ==================== P2 SOLIDITY FRAMEWORK (20 pts) ==================== */

  /* 1. LIQUIDATION MAP INTEGRATION & SCORING (12 pts)
     Scores based on liquidation density around entry/stop levels.

     Thresholds (in ATR units from nearest liq level):
     - 12pts: entry 0.25-0.5x ATR from nearest liq (sweet spot, ahead of sweep)
     - 8pts:  entry 0.5-1.0x ATR away (acceptable, stop can rest on liq)
     - 4pts:  entry 1.0-2.0x ATR away (workable but farther)
     - 0pts:  entry > 2.0x ATR away (ignores liq context)

     Bonus: +2pts if stop positioned BELOW major liq (shorts) or ABOVE (longs)

     Gracefully degrades to 0pts if liq map unavailable.
  */
  function hgOmniLiquidationScore(setup, direction){
    if (!setup) return { score: 0, detail: 'no setup' };
    if (!setup.rows || setup.rows.length < 40) return { score: 0, detail: 'insufficient bars for liq map' };
    if (!setup.plan || !isFinite(fin(setup.plan.entry))) return { score: 0, detail: 'no entry plan' };

    var rows = setup.rows, plan = setup.plan;
    var entry = fin(plan.entry), stop = fin(plan.stop);
    var atr = atrOf(rows, 14);

    if (!isFinite(atr) || atr <= 0) return { score: 0, detail: 'ATR unavailable' };

    /* Determine direction: use explicit parameter, fall back to hit.dir, then guess from entry/stop */
    var dir = direction;
    if (!dir && setup.hit && setup.hit.dir) dir = setup.hit.dir;
    if (!dir && isFinite(stop)){
      dir = (entry > stop) ? 'long' : 'short';
    }

    var score = 0, detail = '', stopBonus = 0;

    try {
      /* Compute liquidation map from recent price action */
      var lm = hgOmniLiqMap(rows, {});

      if (!lm || !lm.clusters || !lm.clusters.length){
        /* No liq clusters detected: assign graceful 0, no veto */
        detail = 'liquidation map unavailable (too few bars or no clusters)';
        return { score: score, detail: detail, maxScore: 12, stopBonus: 0 };
      }

      /* Find nearest liquidation level relative to entry */
      var nearestLiq = null, nearestDist = Infinity;
      for (var i = 0; i < lm.clusters.length; i++){
        var cluster = lm.clusters[i];
        /* Only consider liq clusters on the relevant side for this direction */
        if (dir === 'long' && cluster.side !== 'short') continue;
        if (dir === 'short' && cluster.side !== 'long') continue;

        var dist = Math.abs(entry - cluster.price);
        if (dist < nearestDist){
          nearestDist = dist;
          nearestLiq = cluster;
        }
      }

      if (!nearestLiq){
        /* No relevant liq cluster for this direction */
        detail = 'no ' + dir + ' liquidation cluster found for direction';
        return { score: score, detail: detail, maxScore: 12, stopBonus: 0 };
      }

      var distInAtr = nearestDist / atr;

      /* Score based on entry distance from nearest liquidation */
      if (distInAtr >= 0.25 && distInAtr <= 0.5){
        score = 12;
        detail = 'entry ' + distInAtr.toFixed(2) + 'x ATR from liq level '
               + nearestLiq.price.toFixed(6) + ' (sweet spot, ahead of sweep)';
      } else if (distInAtr > 0.5 && distInAtr <= 1.0){
        score = 8;
        detail = 'entry ' + distInAtr.toFixed(2) + 'x ATR from liq level '
               + nearestLiq.price.toFixed(6) + ' (acceptable distance)';
      } else if (distInAtr > 1.0 && distInAtr <= 2.0){
        score = 4;
        detail = 'entry ' + distInAtr.toFixed(2) + 'x ATR from liq level '
               + nearestLiq.price.toFixed(6) + ' (workable but farther)';
      } else {
        score = 0;
        detail = 'entry ' + distInAtr.toFixed(2) + 'x ATR from liq level '
               + nearestLiq.price.toFixed(6) + ' (ignores liq context)';
      }

      /* Bonus: check if stop is well-positioned relative to major liq level */
      if (isFinite(stop) && score > 0){
        var majorLiq = null, majorWeight = 0;
        for (var j = 0; j < lm.clusters.length; j++){
          if (lm.clusters[j].weight > majorWeight){
            majorWeight = lm.clusters[j].weight;
            majorLiq = lm.clusters[j];
          }
        }

        if (majorLiq){
          var stopWellPlaced = false;
          if (dir === 'long' && stop < majorLiq.price){
            /* For longs, stop BELOW major liq is good (avoid being liquidated into it) */
            stopWellPlaced = true;
          } else if (dir === 'short' && stop > majorLiq.price){
            /* For shorts, stop ABOVE major liq is good (avoid being liquidated into it) */
            stopWellPlaced = true;
          }

          if (stopWellPlaced){
            stopBonus = 2;
            /* Cap at maxScore like every sibling bonus (RR, ATR, orderFlow,
               structure, liqRecovery, riskAdjusted) — without this the
               pillar returned 14/12 and the framework's real ceiling
               drifted to 202 instead of exactly 200. */
            score = Math.min(score + stopBonus, 12);
            detail += ' | +2pt stop bonus (positioned away from major liq at '
                    + majorLiq.price.toFixed(6) + ')';
          }
        }
      }

    } catch (eLiq) {
      /* Graceful degradation if liq map calculation fails */
      detail = 'liquidation scoring threw: ' + ((eLiq && eLiq.message) || eLiq);
      return { score: 0, detail: detail, maxScore: 12, stopBonus: 0 };
    }

    return {
      score: score,
      detail: detail,
      maxScore: 12,
      nearestLiq: nearestLiq ? nearestLiq.price : null,
      stopBonus: stopBonus,
      direction: dir
    };
  }

  /* 2. EXPECTANCY & STATISTICAL EDGE SCORING (8 pts)
     Scores based on measured expectancy (expR) and sample size confidence.

     Expectancy scoring:
     - 8pts if expR >= +0.50R (high edge)
     - 6pts if expR >= +0.25R (moderate)
     - 3pts if expR >= 0R (breakeven/unproven)
     - 0pts if expR < 0R (negative)

     Sample size confidence:
     - 8pts if >= 50 samples (statistically robust)
     - 6pts if 20-49 samples (acceptable)
     - 3pts if 10-19 samples (small but usable)
     - 1pt if < 10 samples (anecdotal only)

     Returns: max(expectancy_score, sample_score) — whichever is higher
     If no historical data: return 3pts (neutral/unproven)
  */
  function hgOmniExpectancyScore(setup){
    if (!setup) return { score: 3, detail: 'no setup — neutral expectancy' };

    /* Extract expectancy data from setup.extra.stats or setup.stats */
    var stats = null;
    if (setup.extra && setup.extra.stats) stats = setup.extra.stats;
    else if (setup.stats) stats = setup.stats;

    /* If no stats at all, return neutral score */
    if (!stats){
      return {
        score: 3,
        detail: 'no historical data available — neutral/unproven',
        maxScore: 8,
        expR: null,
        samples: null,
        hitRate: null
      };
    }

    var expR = fin(stats.expR);
    var samples = fin(stats.samples);
    var hitRate = fin(stats.hit);

    /* If critical data is missing, return neutral */
    if (!isFinite(expR) || !isFinite(samples)){
      return {
        score: 3,
        detail: 'incomplete stats (expR or samples missing)',
        maxScore: 8,
        expR: expR,
        samples: samples,
        hitRate: hitRate
      };
    }

    var expectancyScore = 0, sampleScore = 0, detail = '';

    /* Score based on expectancy */
    if (expR >= 0.50){
      expectancyScore = 8;
      detail = 'high edge: +' + expR.toFixed(2) + 'R (8pts)';
    } else if (expR >= 0.25){
      expectancyScore = 6;
      detail = 'moderate edge: +' + expR.toFixed(2) + 'R (6pts)';
    } else if (expR >= 0){
      expectancyScore = 3;
      detail = 'breakeven: +' + expR.toFixed(2) + 'R (3pts)';
    } else {
      expectancyScore = 0;
      detail = 'negative edge: ' + expR.toFixed(2) + 'R (0pts)';
    }

    /* Score based on sample size confidence */
    if (samples >= 50){
      sampleScore = 8;
      detail += ' | robust: ' + Math.floor(samples) + ' samples (8pts)';
    } else if (samples >= 20){
      sampleScore = 6;
      detail += ' | acceptable: ' + Math.floor(samples) + ' samples (6pts)';
    } else if (samples >= 10){
      sampleScore = 3;
      detail += ' | small: ' + Math.floor(samples) + ' samples (3pts)';
    } else {
      sampleScore = 1;
      detail += ' | anecdotal: ' + Math.floor(samples) + ' samples (1pt)';
    }

    /* Return the higher of the two scores */
    var score = Math.max(expectancyScore, sampleScore);

    detail += ' → max score: ' + score + 'pts';
    if (isFinite(hitRate)){
      detail += ' [' + (hitRate * 100).toFixed(0) + '% hit rate]';
    }

    return {
      score: score,
      detail: detail,
      maxScore: 8,
      expR: expR,
      samples: Math.floor(samples),
      hitRate: hitRate,
      expectancyScore: expectancyScore,
      sampleScore: sampleScore
    };
  }

  /* ==================== end P2 solidity framework ==================== */

  /* ==================== P3 SOLIDITY FRAMEWORK (39 pts total) ==================== */

  /* P3.1: ORDER FLOW CONFLUENCE SCORING (12 pts)
     Scores entry alignment with order flow imbalance (if available).

     Thresholds (σ-based imbalance at entry level):
     - 12pts: +2σ imbalance (strong conviction, heavy bid/ask)
     - 10pts: +1σ imbalance (moderate conviction)
     - 5pts:  ±0.5σ imbalance (light conviction)
     - 0pts:  counterflow or unavailable (no order flow data)

     Bonus: +3pts if imbalance sustains >5 bars (conviction confirmed)

     Default: 0pts if no order flow data — never vetoes.
  */
  function hgOmniOrderFlowScore(setup){
    if (!setup) return { score: 0, detail: 'no setup' };

    /* Extract order flow data if available from extra enrichment */
    var flowData = null;
    if (setup.extra && setup.extra.orderFlow) flowData = setup.extra.orderFlow;
    else if (setup.orderFlow) flowData = setup.orderFlow;

    /* Gracefully degrade to 0 if no flow data */
    if (!flowData || !isFinite(fin(flowData.imbalance))){
      return {
        score: 0,
        detail: 'order flow data unavailable',
        maxScore: 12,
        flowAvailable: false
      };
    }

    var imbalance = fin(flowData.imbalance);
    var sigma = fin(flowData.sigma) || 1.0;
    var direction = (setup.hit && setup.hit.dir) || (setup.plan && fin(setup.plan.entry) > fin(setup.plan.stop)) ? 'long' : 'short';
    var baseScore = 0, detail = '';

    /* Score based on imbalance strength (in sigma) */
    var imbalanceSigma = sigma > 0 ? imbalance / sigma : 0;

    /* Check alignment with setup direction */
    var isAligned = false;
    if (direction === 'long' && imbalance > 0) isAligned = true;
    else if (direction === 'short' && imbalance < 0) isAligned = true;

    if (!isAligned){
      /* Counterflow — no score */
      return {
        score: 0,
        detail: 'order flow counterflow to ' + direction + ' direction (imbalance: ' + imbalance.toFixed(2) + ' @ ' + imbalanceSigma.toFixed(2) + 'σ)',
        maxScore: 12,
        flowAvailable: true,
        imbalance: imbalance,
        aligned: false
      };
    }

    /* Aligned flow scoring */
    var absImbalanceSigma = Math.abs(imbalanceSigma);
    if (absImbalanceSigma >= 2.0){
      baseScore = 12;
      detail = 'strong flow: ' + imbalance.toFixed(2) + ' @ ' + imbalanceSigma.toFixed(2) + 'σ (12pts)';
    } else if (absImbalanceSigma >= 1.0){
      baseScore = 10;
      detail = 'moderate flow: ' + imbalance.toFixed(2) + ' @ ' + imbalanceSigma.toFixed(2) + 'σ (10pts)';
    } else if (absImbalanceSigma >= 0.5){
      baseScore = 5;
      detail = 'light flow: ' + imbalance.toFixed(2) + ' @ ' + imbalanceSigma.toFixed(2) + 'σ (5pts)';
    } else {
      baseScore = 0;
      detail = 'minimal flow imbalance: ' + imbalance.toFixed(2) + ' @ ' + imbalanceSigma.toFixed(2) + 'σ';
    }

    /* Bonus: check if flow sustains >5 bars */
    var flowBonus = 0, bonusDetail = '';
    if (flowData.sustainedBars && flowData.sustainedBars > 5){
      flowBonus = 3;
      bonusDetail = ' + 3pt conviction bonus (sustained ' + Math.floor(flowData.sustainedBars) + ' bars)';
    }

    var totalScore = Math.min(baseScore + flowBonus, 12);
    return {
      score: totalScore,
      detail: detail + bonusDetail,
      maxScore: 12,
      flowAvailable: true,
      imbalance: imbalance,
      aligned: true,
      sustainedBars: flowData.sustainedBars || 0,
      flowBonus: flowBonus
    };
  }

  /* P3.2: STRUCTURAL SUPPORT/RESISTANCE CONFLUENCE SCORING (15 pts)
     Scores entry proximity to multi-touch structural levels (swings, round numbers, VWAP).

     Thresholds (in ATR units from nearest structural level):
     - 15pts: Entry within 0.25x ATR of 2+ structural levels (strong confluence)
     - 10pts: Within 0.25x ATR of 1 level, OR 0.5x ATR of 2+ levels
     - 5pts:  Within 0.5x ATR of 1 level, OR 1.0x ATR of 2+ levels
     - 0pts:  No structural proximity or no structural data

     Bonus: +3pts if stop rests on structural level (good risk discipline)
  */
  function hgOmniStructureConfluenceScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 20)
      return { score: 0, detail: 'insufficient data for structure analysis' };
    if (!setup.plan || !isFinite(fin(setup.plan.entry)))
      return { score: 0, detail: 'no entry plan' };

    var rows = setup.rows, plan = setup.plan;
    var entry = fin(plan.entry), stop = fin(plan.stop);
    var atr = atrOf(rows, 14);

    if (!isFinite(atr) || atr <= 0)
      return { score: 0, detail: 'ATR unavailable' };

    /* Detect structural levels: swing highs/lows */
    var structuralLevels = [];
    var i, h, l, hMinus1, hMinus2, lMinus1, lMinus2;

    /* Find swing highs (recent N bars) */
    for (i = rows.length - 15; i >= Math.max(0, rows.length - 30); i--){
      if (i < 1) continue;
      h = num(rows[i].h);
      hMinus1 = num(rows[i - 1].h);
      hMinus2 = i >= 2 ? num(rows[i - 2].h) : NaN;
      var hPlus1 = i < rows.length - 1 ? num(rows[i + 1].h) : NaN;

      if (isFinite(h) && isFinite(hMinus1) && isFinite(hPlus1)){
        if (h >= hMinus1 && h >= hPlus1 && (!isFinite(hMinus2) || h >= hMinus2)){
          structuralLevels.push({ level: h, type: 'swing_high' });
        }
      }
    }

    /* Find swing lows (recent N bars) */
    for (i = rows.length - 15; i >= Math.max(0, rows.length - 30); i--){
      if (i < 1) continue;
      l = num(rows[i].l);
      lMinus1 = num(rows[i - 1].l);
      lMinus2 = i >= 2 ? num(rows[i - 2].l) : NaN;
      var lPlus1 = i < rows.length - 1 ? num(rows[i + 1].l) : NaN;

      if (isFinite(l) && isFinite(lMinus1) && isFinite(lPlus1)){
        if (l <= lMinus1 && l <= lPlus1 && (!isFinite(lMinus2) || l <= lMinus2)){
          structuralLevels.push({ level: l, type: 'swing_low' });
        }
      }
    }

    /* Add round numbers (every 0.5 or 1.0 points depending on price) */
    var roundness = entry > 10 ? 1.0 : 0.5;
    var roundLevels = [];
    for (var r = Math.floor(entry / roundness) * roundness;
         r <= entry + atr * 2;
         r += roundness){
      roundLevels.push({ level: r, type: 'round_number' });
    }
    structuralLevels = structuralLevels.concat(roundLevels);

    if (!structuralLevels || !structuralLevels.length){
      return { score: 0, detail: 'no structural levels detected' };
    }

    /* Find proximity of entry to structural levels */
    var proximities = [];
    for (i = 0; i < structuralLevels.length; i++){
      var dist = Math.abs(entry - structuralLevels[i].level);
      var distInAtr = dist / atr;
      proximities.push({
        level: structuralLevels[i].level,
        type: structuralLevels[i].type,
        distance: dist,
        distanceInAtr: distInAtr
      });
    }

    /* Sort by distance */
    proximities.sort(function(a, b){ return a.distanceInAtr - b.distanceInAtr; });

    /* Count confluences at different ranges */
    var confluenceAt025 = proximities.filter(function(p){ return p.distanceInAtr <= 0.25; }).length;
    var confluenceAt05 = proximities.filter(function(p){ return p.distanceInAtr <= 0.5; }).length;
    var confluenceAt1 = proximities.filter(function(p){ return p.distanceInAtr <= 1.0; }).length;

    var baseScore = 0, detail = '';

    /* Scoring logic */
    if (confluenceAt025 >= 2){
      baseScore = 15;
      detail = 'strong confluence: ' + confluenceAt025 + ' levels within 0.25x ATR (' + proximities[0].distanceInAtr.toFixed(2) + 'x nearest)';
    } else if (confluenceAt025 === 1 || confluenceAt05 >= 2){
      baseScore = 10;
      detail = 'moderate confluence: ' + (confluenceAt025 === 1 ? '1 @ 0.25x' : confluenceAt05 + ' @ 0.5x') + ' ATR';
    } else if (confluenceAt05 === 1 || confluenceAt1 >= 2){
      baseScore = 5;
      detail = 'light confluence: ' + (confluenceAt05 === 1 ? '1 @ 0.5x' : confluenceAt1 + ' @ 1.0x') + ' ATR';
    } else {
      baseScore = 0;
      detail = 'minimal structural proximity (nearest: ' + proximities[0].distanceInAtr.toFixed(2) + 'x ATR)';
    }

    /* Bonus: check if stop rests on structural level */
    var stopBonus = 0, stopBonusDetail = '';
    if (isFinite(stop) && baseScore > 0){
      for (i = 0; i < proximities.length; i++){
        var stopDist = Math.abs(stop - proximities[i].level) / atr;
        if (stopDist <= 0.25){
          stopBonus = 3;
          stopBonusDetail = ' + 3pt stop discipline bonus (stop @ structural level)';
          break;
        }
      }
    }

    var totalScore = Math.min(baseScore + stopBonus, 15);
    return {
      score: totalScore,
      detail: detail + stopBonusDetail,
      maxScore: 15,
      confluenceCount: proximities.length,
      nearestStructure: proximities.length > 0 ? proximities[0].distanceInAtr.toFixed(3) : null,
      confluenceAt025: confluenceAt025,
      confluenceAt05: confluenceAt05,
      stopBonus: stopBonus
    };
  }

  /* P3.3: MOMENTUM CONVERGENCE SCORING (12 pts)
     Scores alignment of multiple momentum indicators (RSI, MACD, Stochastic).

     Thresholds:
     - 12pts: All 3+ available indicators agree on direction
     - 8pts:  2 of 3 indicators agree
     - 4pts:  1 of 3 aligns
     - 0pts:  None available or all disagree

     No veto — just visibility layer for technical confirmation.
     Default: 0pts if insufficient data (closes <30 bars).
  */
  function hgOmniMomentumConvergenceScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 30)
      return { score: 0, detail: 'insufficient data for momentum analysis' };
    if (!setup.hit || !setup.hit.dir)
      return { score: 0, detail: 'no setup direction' };

    var rows = setup.rows;
    var direction = String(setup.hit.dir).toUpperCase();
    var isLong = (direction === 'LONG' || direction === 'UP');
    var closes = closesOf(rows);

    if (closes.length < 30)
      return { score: 0, detail: 'insufficient closes for momentum' };

    var agreements = 0, details = [];

    /* RSI(14) alignment */
    var rsi14 = rsiOf(closes, 14);
    if (isFinite(rsi14)){
      var rsiAgrees = false;
      if (isLong && rsi14 > 50){
        rsiAgrees = true;
        details.push('RSI(' + Math.floor(rsi14) + ') bullish');
      } else if (!isLong && rsi14 < 50){
        rsiAgrees = true;
        details.push('RSI(' + Math.floor(rsi14) + ') bearish');
      } else {
        details.push('RSI(' + Math.floor(rsi14) + ') neutral/against');
      }
      if (rsiAgrees) agreements++;
    } else {
      details.push('RSI unavailable');
    }

    /* MACD alignment */
    var macd14 = macdOf(closes, 12, 26, 9);
    if (isFinite(macd14) && macd14 !== 0){
      var macdAgrees = false;
      if (isLong && macd14 > 0){
        macdAgrees = true;
        details.push('MACD positive');
      } else if (!isLong && macd14 < 0){
        macdAgrees = true;
        details.push('MACD negative');
      } else {
        details.push('MACD neutral/against');
      }
      if (macdAgrees) agreements++;
    } else {
      details.push('MACD unavailable');
    }

    /* Stochastic(14,3,3) alignment */
    var stoch = stochasticOf(rows, 14);
    if (isFinite(stoch)){
      var stochAgrees = false;
      if (isLong && stoch > 50){
        stochAgrees = true;
        details.push('Stoch(' + Math.floor(stoch) + ') bullish');
      } else if (!isLong && stoch < 50){
        stochAgrees = true;
        details.push('Stoch(' + Math.floor(stoch) + ') bearish');
      } else {
        details.push('Stoch(' + Math.floor(stoch) + ') neutral/against');
      }
      if (stochAgrees) agreements++;
    } else {
      details.push('Stoch unavailable');
    }

    var score = 0, detail = '';

    if (agreements >= 3){
      score = 12;
      detail = 'all 3+ indicators agree on ' + direction.toLowerCase();
    } else if (agreements === 2){
      score = 8;
      detail = '2 of 3 indicators agree on ' + direction.toLowerCase();
    } else if (agreements === 1){
      score = 4;
      detail = '1 of 3 indicator aligns on ' + direction.toLowerCase();
    } else {
      score = 0;
      detail = 'no indicator agreement or all unavailable';
    }

    detail += ' [' + details.join('; ') + ']';

    return {
      score: score,
      detail: detail,
      maxScore: 12,
      agreements: agreements,
      indicatorsAvailable: (isFinite(rsi14) ? 1 : 0) + (isFinite(macd14) && macd14 !== 0 ? 1 : 0) + (isFinite(stoch) ? 1 : 0)
    };
  }

  /* Helper: RSI calculation */
  function rsiOf(closes, n){
    if (!closes || closes.length < n + 1) return NaN;
    var gains = 0, losses = 0, i, change;
    for (i = closes.length - n; i < closes.length; i++){
      change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    var avgGain = gains / n, avgLoss = losses / n;
    if (avgLoss === 0) return 100;
    var rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /* Helper: MACD line (12-26-9) */
  function macdOf(closes, fast, slow, signal){
    if (!closes || closes.length < slow + signal) return NaN;
    var ema12 = emaOf(closes, fast);
    var ema26 = emaOf(closes, slow);
    if (!isFinite(ema12) || !isFinite(ema26)) return NaN;
    return ema12 - ema26;
  }

  /* Helper: Stochastic %K (14 period) */
  function stochasticOf(rows, n){
    if (!rows || rows.length < n) return NaN;
    var highest = -Infinity, lowest = Infinity, i, h, l, c;
    for (i = rows.length - n; i < rows.length; i++){
      h = num(rows[i].h);
      l = num(rows[i].l);
      if (isFinite(h) && isFinite(l)){
        highest = Math.max(highest, h);
        lowest = Math.min(lowest, l);
      }
    }
    c = num(rows[rows.length - 1].c);
    if (!isFinite(c) || !isFinite(highest) || !isFinite(lowest)) return NaN;
    if (highest === lowest) return 50;
    return ((c - lowest) / (highest - lowest)) * 100;
  }

  /* ==================== end P3 solidity framework ==================== */

  /* ==================== P4 SOLIDITY FRAMEWORK (34-37 pts total) ==================== */

  /* P4.1: LIQUIDATION RECOVERY CONFIDENCE SCORING (12 pts)
     Detects if liquidation sweeps historically led to reversals (shorts swept → rally,
     longs swept → dump). Scores on measured reversal % in historical data.

     Thresholds:
     - 12pts: ≥60% reversal rate post-sweep (strong predictive edge)
     - 8pts:  ≥40% reversal rate
     - 4pts:  ≥20% reversal rate
     - 0pts:  <20% or no history

     Bonus: +2pts if reversal happened within 15 bars (quick bounce, high conviction)
     Default: 0pts if insufficient history (not a veto)
  */
  function hgOmniLiquidationRecoveryScore(setup, direction){
    if (!setup || !setup.rows || setup.rows.length < 50){
      return { score: 0, detail: 'insufficient bars for recovery analysis (<50)', maxScore: 12 };
    }
    if (!setup.plan || !isFinite(fin(setup.plan.entry))){
      return { score: 0, detail: 'no entry plan', maxScore: 12 };
    }

    var rows = setup.rows, plan = setup.plan;
    var entry = fin(plan.entry), stop = fin(plan.stop);

    /* Infer direction if not provided */
    var dir = direction;
    if (!dir && setup.hit && setup.hit.dir) dir = setup.hit.dir;
    if (!dir && isFinite(stop)) dir = (entry > stop) ? 'long' : 'short';
    if (!dir) dir = 'long'; /* default */

    var score = 0, detail = '', reverseQualifyCount = 0, totalSweepEvents = 0;

    try {
      /* Scan for liquidation sweep patterns: price sweeps an extreme and reverses within N bars */
      var n = 15; /* lookback for sweep detection */
      var lookforwardWindow = 15; /* window for reversal check */

      for (var i = Math.max(n, 20); i < rows.length - lookforwardWindow; i++){
        var range = rows.slice(i - n, i + 1);
        var highs = range.map(function(r){ return num(r.h); }).filter(isFinite);
        var lows = range.map(function(r){ return num(r.l); }).filter(isFinite);

        if (highs.length < 5 || lows.length < 5) continue;

        var rangeHigh = Math.max.apply(null, highs);
        var rangeLow = Math.min.apply(null, lows);
        var currentClose = num(rows[i].c);
        var currentHigh = num(rows[i].h);
        var currentLow = num(rows[i].l);

        if (!isFinite(currentClose) || !isFinite(currentHigh) || !isFinite(currentLow)) continue;

        /* Detect sweep: price touches extreme and closes back inside */
        var isSweep = false;
        if (dir === 'long' && currentLow <= rangeLow && currentClose > rangeLow){
          /* Short liquidation sweep: price touches/exceeds lows, closes back up */
          isSweep = true;
        } else if (dir === 'short' && currentHigh >= rangeHigh && currentClose < rangeHigh){
          /* Long liquidation sweep: price touches/exceeds highs, closes back down */
          isSweep = true;
        }

        if (!isSweep) continue;

        totalSweepEvents++;

        /* Check for reversal in the lookahead window */
        var reverseWindow = rows.slice(i, Math.min(i + lookforwardWindow, rows.length));
        var reverseWindowCloses = reverseWindow.map(function(r){ return num(r.c); }).filter(isFinite);

        if (reverseWindowCloses.length < 2) continue;

        var maxReverseClose = Math.max.apply(null, reverseWindowCloses);
        var minReverseClose = Math.min.apply(null, reverseWindowCloses);

        var reversal = false;
        if (dir === 'long' && maxReverseClose > currentClose * 1.002){
          /* Rally after sweep (long recovery) */
          reversal = true;
        } else if (dir === 'short' && minReverseClose < currentClose * 0.998){
          /* Dump after sweep (short recovery) */
          reversal = true;
        }

        if (reversal) reverseQualifyCount++;
      }

      if (totalSweepEvents === 0){
        detail = 'no liquidation sweeps detected in historical data';
        return { score: 0, detail: detail, maxScore: 12, reverseRate: 0, events: 0 };
      }

      var reverseRate = reverseQualifyCount / totalSweepEvents;
      var baseScore = 0, bonusScore = 0;

      if (reverseRate >= 0.60){
        baseScore = 12;
        detail = 'strong reversal edge: ' + (reverseRate * 100).toFixed(0) + '% recovery rate (' + reverseQualifyCount + '/' + totalSweepEvents + ' events)';
      } else if (reverseRate >= 0.40){
        baseScore = 8;
        detail = 'moderate reversal edge: ' + (reverseRate * 100).toFixed(0) + '% recovery rate (' + reverseQualifyCount + '/' + totalSweepEvents + ' events)';
      } else if (reverseRate >= 0.20){
        baseScore = 4;
        detail = 'light reversal edge: ' + (reverseRate * 100).toFixed(0) + '% recovery rate (' + reverseQualifyCount + '/' + totalSweepEvents + ' events)';
      } else {
        baseScore = 0;
        detail = 'weak reversal edge: ' + (reverseRate * 100).toFixed(0) + '% recovery rate (' + reverseQualifyCount + '/' + totalSweepEvents + ' events)';
      }

      /* Bonus: check if recent reversals were quick (within 15 bars) */
      if (baseScore > 0 && reverseQualifyCount > totalSweepEvents * 0.5){
        bonusScore = 2;
        detail += ' | +2pt quick-bounce bonus (consistent within 15-bar window)';
      }

      var totalScore = Math.min(baseScore + bonusScore, 12);
      return {
        score: totalScore,
        detail: detail,
        maxScore: 12,
        reverseRate: reverseRate.toFixed(3),
        events: totalSweepEvents,
        recoveries: reverseQualifyCount,
        bonus: bonusScore
      };

    } catch (eLiqRec) {
      detail = 'liquidation recovery scoring threw: ' + ((eLiqRec && eLiqRec.message) || eLiqRec);
      return { score: 0, detail: detail, maxScore: 12 };
    }
  }

  /* P4.2: VOLATILITY TERM STRUCTURE ALIGNMENT SCORING (10 pts)
     Detects if we're entering at optimal volatility regime for this pair.
     Scores based on realized volatility percentile position in recent history.

     Thresholds:
     - 10pts: Realized vol in 25th-50th percentile (sweet spot for entries)
     - 7pts:  50th-75th percentile (elevated but manageable)
     - 4pts:  <25th percentile (very quiet, good for tight stops)
     - 0pts:  >75th percentile (chaos vol, harder fills)

     Default: 0pts if <50 bars history (not a veto)
  */
  function hgOmniVolTermScore(setup){
    if (!setup || !setup.rows || setup.rows.length < 50){
      return { score: 0, detail: 'insufficient bars for vol term analysis (<50)', maxScore: 10 };
    }

    var rows = setup.rows;
    var score = 0, detail = '';

    try {
      /* Calculate realized volatility (ATR-based) over recent window */
      var shortTermAtr = atrOf(rows.slice(-20), 14);
      var longTermAtr = atrOf(rows.slice(-50), 14);

      if (!isFinite(shortTermAtr) || !isFinite(longTermAtr) || longTermAtr <= 0){
        detail = 'ATR unavailable for vol term analysis';
        return { score: 0, detail: detail, maxScore: 10 };
      }

      /* Build volatility percentiles from 50-bar rolling window */
      var volHistory = [];
      for (var i = 20; i < rows.length; i++){
        var windowAtr = atrOf(rows.slice(i - 19, i + 1), 14);
        if (isFinite(windowAtr)) volHistory.push(windowAtr);
      }

      if (volHistory.length < 10){
        detail = 'insufficient vol history for percentile calculation';
        return { score: 0, detail: detail, maxScore: 10 };
      }

      /* Sort and calculate percentiles */
      volHistory.sort(function(a, b){ return a - b; });
      var p25 = volHistory[Math.floor(volHistory.length * 0.25)];
      var p50 = volHistory[Math.floor(volHistory.length * 0.50)];
      var p75 = volHistory[Math.floor(volHistory.length * 0.75)];

      var currentVol = shortTermAtr;
      var percentile = 0;

      /* Estimate percentile position */
      if (currentVol <= p25){
        percentile = 25;
        score = 4;
        detail = 'low vol regime (pctl=' + percentile + '): very quiet, good for tight stops';
      } else if (currentVol <= p50){
        percentile = Math.round((currentVol - p25) / (p50 - p25) * 25 + 25);
        score = 10;
        detail = 'optimal vol regime (pctl=' + percentile + '): 25-50th percentile sweet spot';
      } else if (currentVol <= p75){
        percentile = Math.round((currentVol - p50) / (p75 - p50) * 25 + 50);
        score = 7;
        detail = 'elevated vol regime (pctl=' + percentile + '): 50-75th percentile, manageable';
      } else {
        percentile = Math.round(Math.min(99, ((currentVol - p75) / p75) * 25 + 75));
        score = 0;
        detail = 'chaos vol regime (pctl=' + percentile + '): >75th percentile, harder fills';
      }

      detail += ' (realizedATR=' + currentVol.toFixed(4) + ', p25=' + p25.toFixed(4) + ', p50=' + p50.toFixed(4) + ', p75=' + p75.toFixed(4) + ')';

      return {
        score: score,
        detail: detail,
        maxScore: 10,
        currentVol: currentVol.toFixed(6),
        p25: p25.toFixed(6),
        p50: p50.toFixed(6),
        p75: p75.toFixed(6),
        percentile: percentile
      };

    } catch (eVolTerm) {
      detail = 'vol term scoring threw: ' + ((eVolTerm && eVolTerm.message) || eVolTerm);
      return { score: 0, detail: detail, maxScore: 10 };
    }
  }

  /* P4.3: RISK-ADJUSTED SIZING SCORE (12-15 pts)
     Scores setup based on optimal position sizing criteria: stop size as % of
     portfolio risk AND reward:risk ratio alignment.

     Thresholds:
     - 15pts: Stop <0.5% portfolio risk AND reward ≥3:1 (ideal sizing)
     - 12pts: Stop <0.75% portfolio risk AND reward ≥2.5:1
     - 8pts:  Stop <1.0% portfolio risk AND reward ≥2.0:1
     - 4pts:  Stop <1.5% portfolio risk OR reward ≥1.5:1
     - 0pts:  Stop >1.5% or reward <1.5:1

     Bonus: +2pts if position size aligns with expected win rate (size down if <40% WR)
     Default: estimated portfolio risk (assumes 10k account if not provided)
  */
  function hgOmniRiskAdjustedScore(setup){
    if (!setup || !setup.plan){
      return { score: 0, detail: 'no setup or plan', maxScore: 15 };
    }

    var plan = setup.plan;
    var entry = fin(plan.entry), stop = fin(plan.stop), t1 = fin(plan.t1), t2 = fin(plan.t2);

    if (!isFinite(entry) || !isFinite(stop)){
      return { score: 0, detail: 'entry or stop not defined', maxScore: 15 };
    }

    var score = 0, detail = '', bonusScore = 0;

    try {
      /* Estimate account size (default 10k if not available) */
      var accountSize = 10000;
      if (setup.account && isFinite(fin(setup.account.size))){
        accountSize = fin(setup.account.size);
      }

      /* Calculate risk in absolute terms */
      var stopDistance = Math.abs(entry - stop);
      if (stopDistance <= 0){
        detail = 'invalid stop distance (entry = stop)';
        return { score: 0, detail: detail, maxScore: 15 };
      }

      var riskPercentage = (stopDistance / entry) * 100;
      var portfolioRiskPercentage = (stopDistance / accountSize) * 100;

      /* Calculate reward using T1 or T2 */
      var targetDistance = 0;
      var usedTarget = 'T1';
      if (isFinite(t1)){
        targetDistance = Math.abs(t1 - entry);
      } else if (isFinite(t2)){
        targetDistance = Math.abs(t2 - entry);
        usedTarget = 'T2';
      }

      if (targetDistance <= 0){
        detail = 'no valid target specified (T1 or T2)';
        return { score: 0, detail: detail, maxScore: 15 };
      }

      var rewardToRisk = targetDistance / stopDistance;

      /* Scoring logic */
      var baseScore = 0;
      if (portfolioRiskPercentage < 0.5 && rewardToRisk >= 3.0){
        baseScore = 15;
        detail = 'ideal sizing: ' + portfolioRiskPercentage.toFixed(3) + '% portfolio risk + ' + rewardToRisk.toFixed(1) + ':1 reward';
      } else if (portfolioRiskPercentage < 0.75 && rewardToRisk >= 2.5){
        baseScore = 12;
        detail = 'excellent sizing: ' + portfolioRiskPercentage.toFixed(3) + '% portfolio risk + ' + rewardToRisk.toFixed(1) + ':1 reward';
      } else if (portfolioRiskPercentage < 1.0 && rewardToRisk >= 2.0){
        baseScore = 8;
        detail = 'good sizing: ' + portfolioRiskPercentage.toFixed(3) + '% portfolio risk + ' + rewardToRisk.toFixed(1) + ':1 reward';
      } else if (portfolioRiskPercentage < 1.5 || rewardToRisk >= 1.5){
        baseScore = 4;
        detail = 'acceptable sizing: ' + portfolioRiskPercentage.toFixed(3) + '% portfolio risk + ' + rewardToRisk.toFixed(1) + ':1 reward';
      } else {
        baseScore = 0;
        detail = 'oversized or poor reward: ' + portfolioRiskPercentage.toFixed(3) + '% portfolio risk + ' + rewardToRisk.toFixed(1) + ':1 reward';
      }

      /* Bonus: size alignment with expected win rate */
      var winRate = setup.expectancy && isFinite(fin(setup.expectancy.winRate))
                    ? fin(setup.expectancy.winRate)
                    : null;

      if (baseScore > 0 && winRate !== null && winRate < 0.40 && portfolioRiskPercentage > 0.5){
        /* Low win rate with high risk = size down bonus not applied */
        detail += ' (note: high risk unsuitable for <40% win rate)';
      } else if (baseScore > 0 && winRate !== null && winRate >= 0.50){
        /* High win rate = can size up */
        bonusScore = 2;
        detail += ' | +2pt win-rate alignment bonus (sizing appropriate for ' + (winRate * 100).toFixed(0) + '% win rate)';
      }

      var totalScore = Math.min(baseScore + bonusScore, 15);
      return {
        score: totalScore,
        detail: detail,
        maxScore: 15,
        portfolioRiskPercent: portfolioRiskPercentage.toFixed(3),
        rewardToRisk: rewardToRisk.toFixed(2),
        accountSize: accountSize,
        target: usedTarget,
        bonus: bonusScore,
        winRate: winRate
      };

    } catch (eRiskAdj) {
      detail = 'risk-adjusted scoring threw: ' + ((eRiskAdj && eRiskAdj.message) || eRiskAdj);
      return { score: 0, detail: detail, maxScore: 15 };
    }
  }

  /* ==================== end P4 solidity framework ==================== */

  /* ==================== P5 SOLIDITY FRAMEWORK (24 pts total) — FINAL ==================== */

  /* P5 thresholds — named once so the three scorers below cannot drift apart.
     Every input is read from state the app has ALREADY fetched (setup fields,
     pass-2 enrichment, cached window globals). P5 makes zero network calls. */
  var P5_SECTOR_MAX = 8;                    /* P5.1 sector/market momentum alignment */
  var P5_ASSET_MAX = 10;                    /* P5.2 multi-asset macro confirmation */
  var P5_NEWS_MAX = 6;                      /* P5.3 news/calendar blackout */
  var P5_EMA_FAST = 21;                     /* sector-trend EMA pair, fast leg */
  var P5_EMA_SLOW = 50;                     /* sector-trend EMA pair, slow leg */
  var P5_FUNDING_BASELINE_PCT = 0.01;       /* perp baseline funding %/8h — the band centers here, not on 0 */
  var P5_FUNDING_NEUTRAL_PCT = 0.01;        /* |funding - baseline| within this reads neutral, not a vote */
  var P5_OI_RISING_PCT = 2;                 /* OI change % that counts as "position building" */
  var P5_PRICE_DRIFT_BARS = 12;             /* bars used for the OI-confirmation price drift */
  var P5_NEWS_MAJOR_RE = /FOMC|FED\b|CPI|NFP|NON.?FARM|PAYROLL|RATE\s*DECISION|GDP|PCE/i;
  var P5_NEWS_BLACKOUT_MIN = 30;            /* FOMC/CPI/NFP-class event inside this = 0 pts */
  var P5_NEWS_CAUTION_MIN = 60;             /* major event inside this = 1 pt */
  var P5_NEWS_RED_HORIZON_MIN = 240;        /* red-flag events beyond this defer to the calendar read */

  /* P5.1: SECTOR + MARKET MOMENTUM ALIGNMENT (8 pts)
     Scores whether the trade direction rides the sector tide and the broad
     market tide, or fights them.

     Sector bias  = the contract's own higher-timeframe trend: the resampled
                    daily EMA21/EMA50 pair pass-2 enrichment already computed
                    (setup.extra.htf), else the same EMA pair on the intraday
                    rows in hand. No network.
     Market bias  = the regime read P1 already carries on the setup
                    (setup.extra.regime / setup.regime / setup.btcRegime),
                    else the cached 8-gauge module (window.regimeState()) —
                    a pure cache read. RISK-ON = long bias, RISK-OFF = short,
                    anything else neutral.

     Thresholds:
     - 8pts: aligned with BOTH sector and market bias
     - 5pts: aligned with sector, market neutral/unknown
     - 3pts: against sector but market aligned (also: sector aligned but
             market against — a mixed tape, half credit either way)
     - 0pts: against both, or no data at all

     Graceful degradation: 0 pts, never a veto. ~5ms.
  */
  function hgOmniSectorMomentumScore(setup){
    if (!setup || !setup.hit || !setup.hit.dir){
      return { score: 0, detail: 'no setup direction', maxScore: P5_SECTOR_MAX };
    }

    var dirRaw = String(setup.hit.dir).toLowerCase();
    var tradeSide = (dirRaw === 'long' || dirRaw === 'up') ? 'long' : 'short';
    var score = 0, detail = '';

    try {
      /* --- sector bias: higher-timeframe EMA pair of the contract itself --- */
      var sectorBias = null;   /* 'long' | 'short' | null */
      var sectorSrc = 'n/a';
      var htf = setup.extra && setup.extra.htf;
      if (htf && isFinite(fin(htf.e21)) && isFinite(fin(htf.e50))){
        sectorBias = (fin(htf.e21) >= fin(htf.e50)) ? 'long' : 'short';
        /* htf.e21/e50 are historical field names — they hold the DAILY_FAST/DAILY_SLOW EMAs */
        sectorSrc = 'daily EMA' + DAILY_FAST + '/' + DAILY_SLOW;
      } else if (setup.rows && setup.rows.length >= P5_EMA_SLOW + 10){
        var secCloses = closesOf(setup.rows);
        var secFast = emaOf(secCloses.slice(-(P5_EMA_FAST * 3)), P5_EMA_FAST);
        var secSlow = emaOf(secCloses.slice(-(P5_EMA_SLOW * 3)), P5_EMA_SLOW);
        if (isFinite(secFast) && isFinite(secSlow)){
          sectorBias = (secFast >= secSlow) ? 'long' : 'short';
          sectorSrc = 'intraday EMA' + P5_EMA_FAST + '/' + P5_EMA_SLOW;
        }
      }

      /* --- market bias: regime read already on the setup, else cached module --- */
      var marketBias = null;   /* 'long' | 'short' | 'neutral' | null */
      var marketSrc = 'n/a';
      var regime = (setup.extra && setup.extra.regime) || setup.regime || setup.btcRegime || null;
      if (!regime || !regime.label){
        /* last resort: the live regime module's cache, if this page loaded it.
           regimeState() is a synchronous cache read — it never fetches. */
        try {
          var wReg = (typeof window !== 'undefined') ? window : null;
          if (wReg && typeof wReg.regimeState === 'function') regime = wReg.regimeState();
        } catch (eReg) { regime = null; }
      }
      if (regime && regime.label){
        var regLbl = String(regime.label).toUpperCase();
        if (regLbl.indexOf('RISK-ON') >= 0) marketBias = 'long';
        else if (regLbl.indexOf('RISK-OFF') >= 0) marketBias = 'short';
        else marketBias = 'neutral';
        marketSrc = regime.source || 'regime';
      }

      if (sectorBias === null && marketBias === null){
        return { score: 0, detail: 'no sector or market context available', maxScore: P5_SECTOR_MAX,
                 sectorBias: null, marketBias: null };
      }

      var sectorAligned = (sectorBias === tradeSide);
      var marketAligned = (marketBias === tradeSide);
      var marketNeutral = (marketBias === 'neutral' || marketBias === null);

      if (sectorAligned && marketAligned){
        score = 8;
        detail = 'trade rides both tides: sector ' + sectorBias + ' (' + sectorSrc + ') + market ' + marketBias + ' (' + marketSrc + ')';
      } else if (sectorAligned && marketNeutral){
        score = 5;
        detail = 'sector aligned (' + sectorSrc + '), market neutral/unknown';
      } else if (!sectorAligned && marketAligned){
        score = 3;
        /* absent is not "against" — say which one it actually was */
        detail = (sectorBias === null)
          ? 'sector unknown, but market aligned (' + marketSrc + ')'
          : 'against sector (' + sectorBias + ' via ' + sectorSrc + ') but market aligned (' + marketSrc + ')';
      } else if (sectorAligned && !marketNeutral && !marketAligned){
        /* sector with, market against — a mixed tape gets the same half credit */
        score = 3;
        detail = 'sector aligned (' + sectorSrc + ') but market against (' + marketBias + ' via ' + marketSrc + ')';
      } else {
        score = 0;
        var secTxt = (sectorBias === null) ? 'sector unknown' : 'sector against (' + sectorBias + ')';
        var mktTxt = (marketBias === null) ? 'market unknown'
                   : (marketBias === 'neutral') ? 'market neutral'
                   : 'market against (' + marketBias + ')';
        detail = 'no alignment: ' + secTxt + ', ' + mktTxt;
      }

      return {
        score: score,
        detail: detail,
        maxScore: P5_SECTOR_MAX,
        sectorBias: sectorBias,
        marketBias: marketBias,
        tradeSide: tradeSide
      };

    } catch (eSector) {
      detail = 'sector momentum scoring threw: ' + ((eSector && eSector.message) || eSector);
      return { score: 0, detail: detail, maxScore: P5_SECTOR_MAX };
    }
  }

  /* P5.2: MULTI-ASSET MACRO CONFIRMATION (10 pts)
     Three independent macro signals, each read ONLY from cached state the
     scan already fetched — this function adds zero network calls:

     (a) BTC trend    — setup.btcRegime / setup.extra.btcRegime (the scan
                        wires the BTC daily proxy here in pass 2), else the
                        regime read on the setup ONLY when its source is the
                        btc-daily-proxy (that source IS a BTC read), else an
                        EMA21/50 slope on setup.btcRows if the caller
                        supplied BTC bars. The generic 8-gauge composite
                        (regimeState() / a plain extra.regime) is NEVER read
                        here: P5.1's market bias and P1's regime pillar
                        already score that exact datum, and one datum must
                        not count in three pillars. An absent BTC read
                        scores n/a. RISK-ON confirms longs, RISK-OFF
                        confirms shorts.
     (b) Funding      — setup.positioning.fundingPct (or .funding.rate), the
                        same object the perp gates already receive. Contrarian
                        read: negative funding (shorts paying) supports longs,
                        positive funding (longs paying) supports shorts.
                        |funding| < P5_FUNDING_NEUTRAL_PCT reads neutral.
     (c) OI trend     — setup.extra.oi.changePct from pass-2 enrichment (or
                        positioning.oi.changePct / .oiChangePct). Rising OI
                        (>= P5_OI_RISING_PCT%) WITH price drifting in the
                        trade direction over the last P5_PRICE_DRIFT_BARS
                        bars = position building = confirmation.

     Thresholds:
     - 10pts: 3/3 signals aligned with trade direction
     -  7pts: 2/3 aligned
     -  4pts: 1/3 aligned
     -  0pts: 0/3 aligned, or no macro data at all

     Graceful degradation: 0 pts, never a veto. ~5ms.
  */
  function hgOmniMultiAssetScore(setup){
    if (!setup || !setup.hit || !setup.hit.dir){
      return { score: 0, detail: 'no setup direction', maxScore: P5_ASSET_MAX };
    }

    var dirRaw = String(setup.hit.dir).toLowerCase();
    var wantLong = (dirRaw === 'long' || dirRaw === 'up');
    var tradeSide = wantLong ? 'long' : 'short';
    var alignedCount = 0, checkedCount = 0;
    var parts = [];

    try {
      /* ---- (a) BTC trend ---- */
      var btcReg = setup.btcRegime || (setup.extra && setup.extra.btcRegime) || null;
      if (!btcReg || !btcReg.label){
        /* Accept the setup's regime read ONLY when it is genuinely a BTC
           read (the btc-daily-proxy pass 2 attaches when regime.js's
           gauges fail). Falling back to the full 8-gauge composite here
           double-counted the SAME datum P5.1's market bias and P1's
           regime pillar already score — an absent BTC read must score
           n/a, not borrow a signal from another pillar. */
        var regAny = (setup.extra && setup.extra.regime) || setup.regime || null;
        if (regAny && regAny.label && regAny.source === 'btc-daily-proxy') btcReg = regAny;
      }
      if ((!btcReg || !btcReg.label) && setup.btcRows && setup.btcRows.length >= P5_EMA_SLOW + 5){
        var btcCloses = closesOf(setup.btcRows);
        var btcFast = emaOf(btcCloses.slice(-(P5_EMA_FAST * 3)), P5_EMA_FAST);
        var btcSlow = emaOf(btcCloses, P5_EMA_SLOW);
        if (isFinite(btcFast) && isFinite(btcSlow)){
          btcReg = { label: (btcFast >= btcSlow) ? 'RISK-ON' : 'RISK-OFF', source: 'btc-bars-ema' };
        }
      }
      if (btcReg && btcReg.label){
        checkedCount++;
        var btcLbl = String(btcReg.label).toUpperCase();
        var btcBias = (btcLbl.indexOf('RISK-ON') >= 0) ? 'long'
                    : (btcLbl.indexOf('RISK-OFF') >= 0) ? 'short' : 'neutral';
        if (btcBias === tradeSide){ alignedCount++; parts.push('BTC:aligned(' + btcLbl + ')'); }
        else if (btcBias === 'neutral'){ parts.push('BTC:neutral(' + btcLbl + ')'); }
        else { parts.push('BTC:against(' + btcLbl + ')'); }
      } else {
        parts.push('BTC:n/a');
      }

      /* ---- (b) funding rate direction (contrarian read) ---- */
      var pos = setup.positioning || (setup.extra && setup.extra.positioning) || null;
      var fundPct = NaN;
      if (pos){
        fundPct = fin(pos.fundingPct);
        if (!isFinite(fundPct)) fundPct = fin(pos.funding && pos.funding.rate);
      }
      if (!isFinite(fundPct) && setup.extra) fundPct = fin(setup.extra.fundingPct);
      if (isFinite(fundPct)){
        checkedCount++;
        /* deviation from the +0.01%/8h perp baseline — funding AT baseline is
           the market's resting state and must read neutral, not "longs crowded" */
        var fundDev = fundPct - P5_FUNDING_BASELINE_PCT;
        if (Math.abs(fundDev) <= P5_FUNDING_NEUTRAL_PCT){
          parts.push('FUND:neutral(' + fundPct.toFixed(4) + '% ~ baseline)');
        } else if (wantLong && fundDev < 0){
          /* funding well below baseline — shorts paying, contrarian support for longs */
          alignedCount++; parts.push('FUND:aligned(' + fundPct.toFixed(4) + '% shorts pay)');
        } else if (!wantLong && fundDev > 0){
          /* funding well above baseline — crowded long side supports shorts */
          alignedCount++; parts.push('FUND:aligned(+' + fundPct.toFixed(4) + '% longs pay)');
        } else {
          parts.push('FUND:against(' + fundPct.toFixed(4) + '%)');
        }
      } else {
        parts.push('FUND:n/a');
      }

      /* ---- (c) open-interest trend + price confirmation ---- */
      var oiPct = NaN;
      if (setup.extra && setup.extra.oi) oiPct = fin(setup.extra.oi.changePct);
      if (!isFinite(oiPct) && pos){
        oiPct = fin(pos.oi && pos.oi.changePct);
        if (!isFinite(oiPct)) oiPct = fin(pos.oiChangePct);
      }
      if (isFinite(oiPct) && setup.rows && setup.rows.length >= P5_PRICE_DRIFT_BARS + 1){
        var oiCloses = closesOf(setup.rows);
        var driftFrom = oiCloses[oiCloses.length - 1 - P5_PRICE_DRIFT_BARS];
        var driftTo = oiCloses[oiCloses.length - 1];
        if (isFinite(driftFrom) && driftFrom > 0 && isFinite(driftTo)){
          checkedCount++;
          var driftPct = (driftTo - driftFrom) / driftFrom * 100;
          var priceWithTrade = wantLong ? (driftPct > 0) : (driftPct < 0);
          if (oiPct >= P5_OI_RISING_PCT && priceWithTrade){
            /* rising OI + aligned price = new positions building our way */
            alignedCount++;
            parts.push('OI:aligned(+' + oiPct.toFixed(1) + '% OI, ' + driftPct.toFixed(1) + '% drift)');
          } else if (oiPct >= P5_OI_RISING_PCT){
            parts.push('OI:against(+' + oiPct.toFixed(1) + '% OI but price drift ' + driftPct.toFixed(1) + '%)');
          } else {
            parts.push('OI:flat(' + oiPct.toFixed(1) + '%)');
          }
        } else {
          parts.push('OI:n/a(price drift uncomputable)');
        }
      } else {
        parts.push('OI:n/a');
      }

      /* ---- score by aligned count ---- */
      var score = 0;
      if (checkedCount === 0){
        return { score: 0, detail: 'no macro data available (BTC/funding/OI all absent)', maxScore: P5_ASSET_MAX,
                 aligned: 0, checked: 0 };
      }
      if (alignedCount >= 3) score = 10;
      else if (alignedCount === 2) score = 7;
      else if (alignedCount === 1) score = 4;
      else score = 0;

      return {
        score: score,
        detail: alignedCount + '/3 macro signals aligned — ' + parts.join(' '),
        maxScore: P5_ASSET_MAX,
        aligned: alignedCount,
        checked: checkedCount
      };

    } catch (eAsset) {
      return { score: 0, detail: 'multi-asset scoring threw: ' + ((eAsset && eAsset.message) || eAsset), maxScore: P5_ASSET_MAX };
    }
  }

  /* P5.3: NEWS / CALENDAR BLACKOUT (6 pts)
     Reads the SAME news state P1's session-timing penalty and gate 11 already
     use: setup.extra.redFlagNews {minutesUntil, event}, and setup.extra.news —
     the hgNewsRisk() shape {risk:'high'|'med'|'low', blackout:boolean, note}.
     Falls back to a live window.hgNewsRisk(sym) call, which is a pure cache
     read (it never fetches). No new network calls.

     Thresholds:
     - 6pts: no high-impact event nearby — OR no calendar available at all.
             This pillar DEFAULTS HIGH: an unloaded calendar is not evidence
             of danger, and hgNewsRisk's own 'news not loaded' note is a
             default, not a measurement.
     - 3pts: minor/medium event more than 1 hour away (risk 'med')
     - 1pt:  major event within ~1 hour but not blacking out the pair
             (risk 'high' outside the blackout window, or a non-FOMC-class
             blackout)
     - 0pts: FOMC/CPI/NFP-class event within P5_NEWS_BLACKOUT_MIN minutes,
             or an active blackout naming such an event

     ~2ms.
  */
  function hgOmniNewsCalendarScore(setup){
    var score = P5_NEWS_MAX;
    var detail = 'no calendar available — assumed clear (defaults high)';
    var status = 'clear';

    try {
      var news = (setup && setup.extra && setup.extra.news) || (setup && setup.news) || null;
      if (!news){
        /* pure cache read of the news module, if loaded — never fetches */
        try {
          var wNews = (typeof window !== 'undefined') ? window : null;
          var sym = setup && ((setup.extra && setup.extra.ticker && setup.extra.ticker.sym) || setup.sym || null);
          if (wNews && typeof wNews.hgNewsRisk === 'function' && sym) news = wNews.hgNewsRisk(sym);
        } catch (eNw) { news = null; }
      }
      var red = setup && setup.extra && setup.extra.redFlagNews;

      /* an ACTIVE calendar blackout always wins — a red-flag entry pointing at a
         more distant event must never outscore it */
      if (news && news.blackout === true){
        var majorBoNow = P5_NEWS_MAJOR_RE.test(String(news.note || ''));
        if (majorBoNow){
          score = 0; status = 'blackout';
          detail = 'active blackout on a FOMC/CPI/NFP-class event: ' + (news.note || '');
        } else {
          score = 1; status = 'caution';
          detail = 'active blackout window: ' + (news.note || 'unnamed high-impact event');
        }
      } else if (red && isFinite(fin(red.minutesUntil)) && fin(red.minutesUntil) <= P5_NEWS_RED_HORIZON_MIN){
        /* red-flag path — minutes-to-event resolution, but only inside the
           horizon: an event days away must not permanently cap this pillar */
        var mins = fin(red.minutesUntil);
        var isMajor = P5_NEWS_MAJOR_RE.test(String(red.event || ''));
        if (isMajor && mins <= P5_NEWS_BLACKOUT_MIN){
          score = 0; status = 'blackout';
          detail = 'FOMC/CPI/NFP-class event within ' + P5_NEWS_BLACKOUT_MIN + 'min: ' + red.event + ' in ' + mins + 'min';
        } else if (mins <= P5_NEWS_CAUTION_MIN){
          score = 1; status = 'caution';
          detail = 'event within 1 hour: ' + (red.event || 'unnamed') + ' in ' + mins + 'min';
        } else {
          score = 3; status = 'minor';
          detail = 'event more than 1 hour away: ' + (red.event || 'unnamed') + ' in ' + mins + 'min';
        }
      } else if (news && news.note && /not loaded|no calendar|news error/i.test(String(news.note))){
        /* unloaded module: a default, not a measurement — stay at 6 */
        score = P5_NEWS_MAX; status = 'clear';
        detail = 'calendar not loaded (' + news.note + ') — assumed clear (defaults high)';
      } else if (news && String(news.risk) === 'high'){
        score = 1; status = 'caution';
        detail = 'major event on the horizon (outside blackout): ' + (news.note || '');
      } else if (news && String(news.risk) === 'med'){
        score = 3; status = 'minor';
        detail = 'minor/medium event more than 1 hour away: ' + (news.note || '');
      } else if (news){
        score = P5_NEWS_MAX; status = 'clear';
        detail = 'no high-impact event nearby' + (news.note ? ' (' + news.note + ')' : '');
      }

      return { score: score, detail: detail, maxScore: P5_NEWS_MAX, status: status };

    } catch (eNews) {
      /* this pillar defaults HIGH: a scoring failure is not a news event */
      return { score: P5_NEWS_MAX, detail: 'news scoring threw — assumed clear: ' + ((eNews && eNews.message) || eNews),
               maxScore: P5_NEWS_MAX, status: 'clear' };
    }
  }

  /* ==================== end P5 solidity framework ==================== */

  function hgOmniSolidityScore(setup, horizonLabel){
    if (!setup) return { score: 0, maxScore: 200, breakdown: {}, detail: 'no setup', tier: 'weak' };

    /* P0 Pillars (55 pts) */
    var ob = hgOmniOrderBlockScore(setup);
    var fvg = hgOmniFvgScore(setup);
    var mtf = hgOmniMultiTfCascadeScore(setup);
    var rr = hgOmniRiskRewardScore(setup);

    /* P1 Pillars (25 pts) */
    var regimeScore = hgOmniRegimeScore(setup);
    var atrExpScore = hgOmniAtrExpansionScore(setup);
    var sessionScore = hgOmniSessionTimingScore(setup, horizonLabel);

    /* P2 Pillars (20 pts) */
    var direction = (setup.hit && setup.hit.dir) || null;
    var liqScore = hgOmniLiquidationScore(setup, direction);
    var expScore = hgOmniExpectancyScore(setup);

    /* P3 Pillars (39 pts) */
    var flowScore = hgOmniOrderFlowScore(setup);
    var structScore = hgOmniStructureConfluenceScore(setup);
    var momScore = hgOmniMomentumConvergenceScore(setup);

    /* P4 Pillars (34-37 pts) */
    var liqRecoveryScore = hgOmniLiquidationRecoveryScore(setup, direction);
    var volTermScore = hgOmniVolTermScore(setup);
    var riskAdjScore = hgOmniRiskAdjustedScore(setup);

    /* P5 Pillars (24 pts) — FINAL */
    var sectorScore = hgOmniSectorMomentumScore(setup);
    var multiAssetScore = hgOmniMultiAssetScore(setup);
    var newsCalScore = hgOmniNewsCalendarScore(setup);

    var totalScore = ob.score + fvg.score + mtf.score + rr.score +
                     regimeScore.score + atrExpScore.score + sessionScore.score +
                     liqScore.score + expScore.score +
                     flowScore.score + structScore.score + momScore.score +
                     liqRecoveryScore.score + volTermScore.score + riskAdjScore.score +
                     sectorScore.score + multiAssetScore.score + newsCalScore.score;

    var maxStructuralScore = (ob.maxScore || 15) + (fvg.maxScore || 10) +
                              (mtf.maxScore || 10) + (rr.maxScore || 20) +
                              (regimeScore.maxScore || 10) + (atrExpScore.maxScore || 8) +
                              (sessionScore.maxScore || 7) +
                              (liqScore.maxScore || 12) + (expScore.maxScore || 8) +
                              (flowScore.maxScore || 12) + (structScore.maxScore || 15) +
                              (momScore.maxScore || 12) +
                              (liqRecoveryScore.maxScore || 12) + (volTermScore.maxScore || 10) +
                              (riskAdjScore.maxScore || 15) +
                              (sectorScore.maxScore || 8) + (multiAssetScore.maxScore || 10) +
                              (newsCalScore.maxScore || 6);

    /* Determine solidity tier (200-point scale, updated for P5 — framework complete) */
    var tier = 'weak';
    if (totalScore >= 170) tier = 'extremely_solid';
    else if (totalScore >= 140) tier = 'solid';
    else if (totalScore >= 105) tier = 'fair';

    return {
      score: totalScore,
      maxScore: maxStructuralScore,
      tier: tier,
      breakdown: {
        orderBlock: { score: ob.score, maxScore: ob.maxScore || 15, detail: ob.detail },
        fvg: { score: fvg.score, maxScore: fvg.maxScore || 10, detail: fvg.detail },
        multiTfCascade: { score: mtf.score, maxScore: mtf.maxScore || 10, detail: mtf.detail, agreements: mtf.agreements },
        riskReward: { score: rr.score, maxScore: rr.maxScore || 20, detail: rr.detail, rr: rr.rr },
        regime: { score: regimeScore.score, maxScore: regimeScore.maxScore || 10, detail: regimeScore.detail, regime: regimeScore.regime },
        atrExpansion: { score: atrExpScore.score, maxScore: atrExpScore.maxScore || 8, detail: atrExpScore.detail, status: atrExpScore.atrStatus },
        sessionTiming: { score: sessionScore.score, maxScore: sessionScore.maxScore || 7, detail: sessionScore.detail, session: sessionScore.session },
        liquidation: { score: liqScore.score, maxScore: liqScore.maxScore || 12, detail: liqScore.detail, nearestLiq: liqScore.nearestLiq },
        expectancy: { score: expScore.score, maxScore: expScore.maxScore || 8, detail: expScore.detail, expR: expScore.expR, samples: expScore.samples },
        orderFlow: { score: flowScore.score, maxScore: flowScore.maxScore || 12, detail: flowScore.detail, flowAvailable: flowScore.flowAvailable },
        structureConfluence: { score: structScore.score, maxScore: structScore.maxScore || 15, detail: structScore.detail, confluenceCount: structScore.confluenceCount },
        momentumConvergence: { score: momScore.score, maxScore: momScore.maxScore || 12, detail: momScore.detail, agreements: momScore.agreements },
        liquidationRecovery: { score: liqRecoveryScore.score, maxScore: liqRecoveryScore.maxScore || 12, detail: liqRecoveryScore.detail, reverseRate: liqRecoveryScore.reverseRate },
        volTermStructure: { score: volTermScore.score, maxScore: volTermScore.maxScore || 10, detail: volTermScore.detail, percentile: volTermScore.percentile },
        riskAdjusted: { score: riskAdjScore.score, maxScore: riskAdjScore.maxScore || 15, detail: riskAdjScore.detail, rr: riskAdjScore.rewardToRisk },
        sectorMomentum: { score: sectorScore.score, maxScore: sectorScore.maxScore || 8, detail: sectorScore.detail, sectorBias: sectorScore.sectorBias, marketBias: sectorScore.marketBias },
        multiAsset: { score: multiAssetScore.score, maxScore: multiAssetScore.maxScore || 10, detail: multiAssetScore.detail, aligned: multiAssetScore.aligned, checked: multiAssetScore.checked },
        newsCalendar: { score: newsCalScore.score, maxScore: newsCalScore.maxScore || 6, detail: newsCalScore.detail, status: newsCalScore.status }
      },
      detail: 'OB:' + ob.score + '/' + (ob.maxScore || 15) +
              ' FVG:' + fvg.score + '/' + (fvg.maxScore || 10) +
              ' MTF:' + mtf.score + '/' + (mtf.maxScore || 10) +
              ' RR:' + rr.score + '/' + (rr.maxScore || 20) +
              ' REG:' + regimeScore.score + '/' + (regimeScore.maxScore || 10) +
              ' ATR:' + atrExpScore.score + '/' + (atrExpScore.maxScore || 8) +
              ' SES:' + sessionScore.score + '/' + (sessionScore.maxScore || 7) +
              ' LIQ:' + liqScore.score + '/' + (liqScore.maxScore || 12) +
              ' EXP:' + expScore.score + '/' + (expScore.maxScore || 8) +
              ' FLOW:' + flowScore.score + '/' + (flowScore.maxScore || 12) +
              ' STRUCT:' + structScore.score + '/' + (structScore.maxScore || 15) +
              ' MOM:' + momScore.score + '/' + (momScore.maxScore || 12) +
              ' LIQ-REC:' + liqRecoveryScore.score + '/' + (liqRecoveryScore.maxScore || 12) +
              ' VOL-TERM:' + volTermScore.score + '/' + (volTermScore.maxScore || 10) +
              ' RISK-ADJ:' + riskAdjScore.score + '/' + (riskAdjScore.maxScore || 15) +
              ' SECTOR:' + sectorScore.score + '/' + (sectorScore.maxScore || 8) +
              ' ASSET:' + multiAssetScore.score + '/' + (multiAssetScore.maxScore || 10) +
              ' NEWS:' + newsCalScore.score + '/' + (newsCalScore.maxScore || 6) +
              ' [' + tier + ']'
    };
  }

  /* FULL-DATA SOLIDITY STAMP BUILDER — the one place a candidate's stored
     solidity read {score, maxScore, tier, detail} is produced. Called from
     TWO sites, both while real data is still in scope:
       (1) hgOmniEvaluate, for tickets (grade.ticket === true) — the 20X
           quality floor, APEX cards and every always-rendered card;
       (2) the card render pass, for the <= CARD_RENDER_MAX non-ticket
           cards that will actually reach the screen (late stamp from
           exBySym, which still holds rows1h/enrichment at that point).
     WHY NOT EVERY CANDIDATE: the full 18-pillar score costs ~2.3-3.9 ms per
     call on 180-bar tapes (measured in a node vm harness over
     scripts/.bt-cache: hot pillars are volTerm ~1.3 ms — a 160-slot rolling
     ATR percentile — and liquidationRecovery ~0.6 ms). At ~1131 candidates
     that is ~3-4.5 s of main-thread work per scan for scores nothing would
     ever display; tickets + renderable non-tickets is the whole set of
     consumers, and costs well under half a second.
     rows: the 1h enrichment bars when present (>=120 — the pillars'
     documented native TF), else whatever intraday tape the caller still
     holds; ex must be the REAL enrichment object (htf, oi, positioning,
     regime, btcRegime, news, ticker, per-mechanic stats) — never a
     field-stripping copy. Returns compact scalars only, NOT the breakdown:
     memory matters at 1131 candidates. Never throws — a scoring failure
     returns null and the render side falls back to its starved recompute. */
  function hgOmniSolidityStamp(hit, plan, rows, ex, positioning){
    try {
      if (!plan || !hit) return null;
      var solRows = (ex && ex.rows1h && ex.rows1h.length >= 120)
        ? ex.rows1h
        : ((rows && rows.length) ? rows : null);
      var s = hgOmniSolidityScore({
        plan: plan,
        hit: hit,
        rows: solRows,
        extra: ex || null,
        positioning: positioning || (ex && ex.positioning) || null,
        btcRegime: (ex && ex.btcRegime) || null,
        regime: (ex && ex.regime) || null,
        sym: (ex && ex.sym) || null
      }, String(TF || '').toUpperCase() || undefined);
      if (s && isFinite(fin(s.score))){
        return { score: s.score, maxScore: s.maxScore, tier: s.tier, detail: s.detail };
      }
      return null;
    } catch (eStamp) { return null; }
  }

  /* ==================== end P0 solidity framework ==================== */

  /* ==================== REPLAY CALIBRATION ADDITIONS (additive) ====================
     Everything in this section was added AFTER the 2496-trade replay backtest
     and the out-of-sample refit (scripts/solidity-refit.json). Nothing here
     modifies any pillar or hgOmniSolidityScore — these are new reads layered
     on top of the same setup object. */

  /* Round-trip trading cost as a percent of price, BOTH sides of the trade:
       taker fee 0.05% x 2 legs  = 0.10%
       slippage 0.02% x 2 legs   = 0.04%
       total                     = 0.14%
     This is a documented DEFAULT, not a measurement. A desk on maker fees or
     a different venue overrides it by setting window.HG_OMNI_RT_COST_PCT
     (read at call time) — the constant here is only the fallback. */
  var HG_OMNI_RT_COST_PCT = 0.14;

  /* The replay's #1 finding: cost-to-stop geometry kills tight-stop trades.
     A 0.5%-stop scalp pays 0.28R to fees+slip before the market moves at
     all, so a 26% win-rate book that looks breakeven gross is deeply
     negative net. costR = round-trip cost expressed in R (fractions of the
     stop distance):
       'ok'    costR <= 0.125  — stop is at least 8x the round-trip cost
       'thin'  0.125 - 0.25    — costs eat an eighth to a quarter of every R
       'heavy' 0.25 - 0.5      — a quarter to half of every R goes to costs
       'fatal' > 0.5           — fees alone eat over half an R; geometry
                                 unpayable regardless of edge
     Degrades to a null result on missing data — never throws. */
  function hgOmniCostDrag(setup){
    var nul = { costR: null, tier: null, rtCostPct: null, stopDistPct: null,
                detail: 'cost drag not computable — no entry/stop geometry' };
    try {
      if (!setup || !setup.plan) return nul;
      var entry = fin(setup.plan.entry), stop = fin(setup.plan.stop);
      if (!isFinite(entry) || !isFinite(stop) || entry === 0) return nul;
      var stopDistPct = Math.abs(entry - stop) / Math.abs(entry) * 100;
      if (!isFinite(stopDistPct) || stopDistPct <= 0){
        return { costR: null, tier: null, rtCostPct: null, stopDistPct: null,
                 detail: 'entry equals stop — no R to cost' };
      }
      /* window override read at CALL time, so a venue change does not need
         a reload of this file; the constant is only the default. */
      var rt = NaN;
      try { if (typeof window !== 'undefined') rt = fin(window.HG_OMNI_RT_COST_PCT); } catch (eW) {}
      if (!isFinite(rt) || rt <= 0) rt = HG_OMNI_RT_COST_PCT;
      var costR = rt / stopDistPct;
      var tier = costR <= 0.125 ? 'ok'
               : costR <= 0.25  ? 'thin'
               : costR <= 0.5   ? 'heavy'
               : 'fatal';
      var detail = 'round-trip cost ' + rt.toFixed(2) + '% vs stop distance '
                 + stopDistPct.toFixed(2) + '% — ' + costR.toFixed(2)
                 + 'R of every trade goes to fees+slippage ['
                 + (tier === 'ok'    ? 'ok: stop is >= 8x the round-trip cost'
                  : tier === 'thin'  ? 'thin: costs eat an eighth to a quarter of every R'
                  : tier === 'heavy' ? 'heavy: a quarter to half of every R goes to costs'
                  : 'fatal: fees alone eat over half an R — unpayable geometry') + ']';
      return { costR: costR, tier: tier, rtCostPct: rt, stopDistPct: stopDistPct, detail: detail };
    } catch (eCost) {
      return { costR: null, tier: null, rtCostPct: null, stopDistPct: null,
               detail: 'cost drag threw — ' + ((eCost && eCost.message) || eCost) };
    }
  }

  /* Formation-time cost veto for the conviction roster. Same math as
     hgOmniCostDrag above but takes raw entry/stop instead of a plan, because
     it runs BEFORE any plan exists. costR > 0.125 (the 'ok' tier ceiling,
     OMNI_CV_COST_OK_R) => the setup DOES NOT FORM — no exceptions, no
     downgrade path. Consequence at the default 0.14% round trip: no
     conviction mechanic can form with a stop closer than 1.12% of price
     (8x the round-trip cost). Window override read at call time, same
     pattern as hgOmniCostDrag. */
  function hgOmniFormCostGate(entry, stop){
    entry = fin(entry); stop = fin(stop);
    if (!isFinite(entry) || !isFinite(stop) || entry === 0) return null;
    var stopDistPct = Math.abs(entry - stop) / Math.abs(entry) * 100;
    if (!(stopDistPct > 0)) return null;
    var rt = NaN;
    try { if (typeof window !== 'undefined') rt = fin(window.HG_OMNI_RT_COST_PCT); } catch (eW) {}
    if (!isFinite(rt) || rt <= 0) rt = HG_OMNI_RT_COST_PCT;
    var costR = rt / stopDistPct;
    if (costR > OMNI_CV_COST_OK_R) return null;          /* VETO: not 'ok' tier */
    return { costR: costR, stopDistPct: stopDistPct, rtCostPct: rt };
  }

  /* Out-of-sample refit verdict, baked from scripts/solidity-refit.json:
       fitted on 2496 replay trades, chronological split — train = first 1497
       (2026-06-13 .. 2026-07-29), test = last 999 (2026-07-29 .. 2026-08-29).
       Primary P(win) model test AUC = 0.5192 (< 0.52 threshold) and the
       top-vs-bottom decile netR gap is NEGATIVE, so the verdict is
       'not-predictive': the pillar scores carry no out-of-sample ranking
       power for win probability. Per that verdict NO fitted probability is
       shipped — printing a P(win) from a model that cannot rank winners
       would be a lie with two decimal places. The score stays useful as a
       structural checklist; it is not a probability. Re-run
       scripts/refit-solidity-weights.mjs on new replay data and replace this
       block ONLY if the verdict improves to 'weak' or 'predictive'. */
  var HG_OMNI_REFIT = {
    verdict: 'not-predictive',
    testAUC: 0.5192,
    trainN: 1497,
    testN: 999,
    trainedThrough: '2026-07-29',
    source: 'scripts/solidity-refit.json (generated 2026-08-29)'
  };

  function hgOmniMeasuredProb(setup){
    /* Verdict is 'not-predictive' — honesty over decoration: prob is null
       and the detail is what the UI should say. */
    return {
      prob: null,
      verdict: HG_OMNI_REFIT.verdict,
      testAUC: HG_OMNI_REFIT.testAUC,
      detail: 'refit not predictive OOS (AUC ' + HG_OMNI_REFIT.testAUC.toFixed(4)
            + ') — score is informational only'
    };
  }

  /* Compact inline badge block for one candidate card: solidity score +
     tier, cost drag, and the measured-probability read (currently the
     honest "informational only" note — see HG_OMNI_REFIT above). Candidate
     rows carry dir/kind/level at the TOP level, not under .hit, so the
     setup shape the pillars expect is rebuilt here; pillars whose inputs
     (rows, liq map, order flow) are absent at render time degrade to their
     own documented defaults inside hgOmniSolidityScore. Returns '' on any
     failure — a missing chip, never a crashed card. */
  function hgOmniSolidityBadgesHtml(c){
    try {
      if (!c || !c.plan) return '';
      var setup = {
        plan: c.plan,
        hit: (c.hit && c.hit.dir) ? c.hit : { dir: c.dir, kind: c.kind, level: c.level },
        rows: c.rows || null,
        extra: (c.extra && typeof c.extra === 'object') ? c.extra : null
      };
      var sol = null, cost = null, mp = null;
      /* PREFER THE EVALUATE-TIME STAMP. c.solidity was scored inside
         hgOmniEvaluate while the 1h bars and the full enrichment (htf, oi,
         positioning, regime, btcRegime, news, per-mechanic stats) were still
         in scope. The recompute below runs on rows:null / extra:null —
         held[j].rows is released after grading and candidate.extra is a
         boolean — which starves 13 of 18 pillars and pinned every live card
         at ~29-41/200 WEAK. It remains ONLY as the fallback for candidates
         that predate the stamp (a restored snapshot) or whose stamping
         failed. */
      if (c.solidity && isFinite(fin(c.solidity.score))){
        sol = c.solidity;
      } else {
        try { sol = hgOmniSolidityScore(setup); } catch (eS) {}
      }
      try { cost = hgOmniCostDrag(setup); } catch (eD) {}
      try { mp = hgOmniMeasuredProb(setup); } catch (eP) {}
      var AMBER = '#d97706';
      var h = '';
      if (sol && isFinite(fin(sol.score))){
        var tierTxt = String(sol.tier || 'weak').replace(/_/g, ' ').toUpperCase();
        var tierCls = (sol.tier === 'extremely_solid' || sol.tier === 'solid') ? 'ok'
                    : (sol.tier === 'weak') ? 'bad' : '';
        var tierSty = (sol.tier === 'fair')
          ? ' style="color:' + AMBER + ';border-color:' + AMBER + '"' : '';
        h += '<span class="gpip ' + tierCls + '"' + tierSty
          +  ' title="' + esc(sol.detail || '') + '">SOLIDITY '
          +  sol.score + '/' + (sol.maxScore || 200) + ' · ' + esc(tierTxt) + '</span>';
      }
      if (cost && isFinite(fin(cost.costR))){
        var cCls = cost.tier === 'ok' ? 'ok' : cost.tier === 'fatal' ? 'bad' : '';
        var cSty = (cost.tier === 'heavy' || cost.tier === 'thin')
          ? ' style="color:' + AMBER + ';border-color:' + AMBER + '"' : '';
        h += ' <span class="gpip ' + cCls + '"' + cSty
          +  ' title="' + esc(cost.detail || '') + '">COST '
          +  cost.costR.toFixed(2) + 'R — ' + esc(cost.tier) + '</span>';
      }
      if (mp){
        if (isFinite(fin(mp.prob))){
          h += ' <span class="gpip" title="' + esc(mp.detail || '') + '">P(WIN) '
            +  (fin(mp.prob) * 100).toFixed(0) + '%</span>';
        } else if (mp.detail){
          /* No fitted probability is shipped — say so instead of decorating. */
          h += ' <span class="dim">' + esc(mp.detail) + '</span>';
        }
      }
      /* CONVICTION chip — the conviction roster's formation-time certificate
         (hgOmniCvHit). Only hits that emit conviction {confirmations, count,
         costGate} get a chip; the legacy mechanics carry none and show
         nothing new. Green only when every confirmation fired AND the
         formation cost gate passed — anything less renders neutral, because
         a partial certificate is context, not a credential. The tooltip
         names the confirmations so the chip is auditable, not decorative. */
      var cv = (c.conviction && typeof c.conviction === 'object') ? c.conviction
             : (c.hit && c.hit.conviction && typeof c.hit.conviction === 'object') ? c.hit.conviction
             : null;
      if (cv){
        var names = [];
        if (Object.prototype.toString.call(cv.confirmations) === '[object Array]'){
          for (var ci = 0; ci < cv.confirmations.length; ci++){
            var cf = cv.confirmations[ci];
            if (cf === null || cf === undefined) continue;
            if (typeof cf === 'object') names.push(String(cf.name || cf.label || cf.id || ''));
            else names.push(String(cf));
          }
        }
        var cvTotal = names.length || (isFinite(fin(cv.count)) ? fin(cv.count) : 0);
        var cvFired = isFinite(fin(cv.count)) ? fin(cv.count) : names.length;
        if (cvTotal > 0){
          var cvGreen = (cvFired >= cvTotal) && cv.costGate === 'passed';
          var cvTip = (names.length ? names.join(' · ') : 'confirmation names unavailable')
                    + (cv.costGate === 'passed'
                        ? (' · formation cost gate passed'
                           + (isFinite(fin(cv.costR)) ? ' (' + fin(cv.costR).toFixed(3) + 'R round trip)' : ''))
                        : '');
          h += ' <span class="gpip ' + (cvGreen ? 'ok' : '') + '" title="' + esc(cvTip)
            +  '">CONVICTION ' + cvFired + '/' + cvTotal + '</span>';
        }
      }
      return h ? '<div style="margin-top:4px">' + h + '</div>' : '';
    } catch (eB) {
      return '';
    }
  }

  /* ==================== end replay calibration additions ==================== */

  /* ==================== 20X — leverage-safe subset (additive) ====================
     A DISPLAY-ONLY shortlist of setups whose GEOMETRY survives 20x isolated
     leverage. Nothing here predicts a win, sizes a position, or places an
     order — this app never executes crypto orders. The section exists
     because "20x" is usually said by people who have not done the
     liquidation arithmetic, and the honest output of that arithmetic is
     "almost nothing qualifies" on most scans. */

  /* The leverage this section is scoped to. At 20x isolated, initial margin
     is 5% of notional, so a 5% adverse move wipes the margin BEFORE
     maintenance margin is considered. */
  var HG_OMNI_20X_LEV = 20;
  /* Approximate tier-1 maintenance margin, in % of notional. Real tiers
     vary by venue, symbol and position size — 0.4% is a documented DEFAULT
     for the smallest tier, not a measurement of any specific account. It
     SHRINKS the usable distance to liquidation:
       liqDistPct = (100 / LEV) - MMR = 5.0 - 0.4 = 4.6% */
  var HG_OMNI_20X_MMR_PCT = 0.4;
  /* The stop must sit at least this many times INSIDE the liquidation
     distance, so the stop always speaks before the exchange does. At the
     defaults: stopDistPct <= 4.6 / 2.5 = 1.84% of price. */
  var HG_OMNI_20X_STOP_SAFETY = 2.5;
  /* Ordinary noise must not be able to liquidate the position: 3 x the 1h
     ATR% has to fit inside the liquidation distance. A symbol whose hourly
     range is a third of the liq distance can be stopped by NOTHING — a
     routine hour does it. Missing 1h bars mean this cannot be checked, and
     unchecked is a FAIL here, never a pass. */
  var HG_OMNI_20X_NOISE_ATR_MULT = 3;
  /* Quality floor, solidity path: the 200-pt score's 'fair' tier boundary.
     Structural checklist only — the refit says it is not predictive, and the
     banner says so too. HONESTY NOTE from a real 531-contract scan: live
     solidity scores ran 29-41/200, so this path is structurally unreachable
     today. It is KEPT (harmless, future-proof) but it is no longer the only
     alternate to a conviction cert — the reachable alternate is the
     mechanic's own out-of-sample FORWARD ledger reading 'has paid'
     (hgOmni20xForwardPaid), the same stats the FORWARD table renders. */
  var HG_OMNI_20X_SOLIDITY_FLOOR = 105;

  /* All of the above are window-overridable AT CALL TIME, same pattern as
     HG_OMNI_RT_COST_PCT: set window.HG_OMNI_20X_LEV / _MMR_PCT /
     _STOP_SAFETY / _NOISE_ATR_MULT / _SOLIDITY_FLOOR and the next render
     uses them — no reload of this file. Returns null when the derived
     liquidation distance is degenerate (lev/mmr combination leaves nothing),
     because a section computed from a non-positive liq distance would be
     fiction. */
  function hgOmni20xParams(){
    var w = null;
    try { w = (typeof window !== 'undefined') ? window : null; } catch (eW) { w = null; }
    function ov(name, dflt){
      var v = NaN;
      try { if (w) v = fin(w[name]); } catch (eO) { v = NaN; }
      return (isFinite(v) && v > 0) ? v : dflt;
    }
    var lev = ov('HG_OMNI_20X_LEV', HG_OMNI_20X_LEV);
    var mmr = ov('HG_OMNI_20X_MMR_PCT', HG_OMNI_20X_MMR_PCT);
    var safety = ov('HG_OMNI_20X_STOP_SAFETY', HG_OMNI_20X_STOP_SAFETY);
    var noiseMult = ov('HG_OMNI_20X_NOISE_ATR_MULT', HG_OMNI_20X_NOISE_ATR_MULT);
    var solFloor = ov('HG_OMNI_20X_SOLIDITY_FLOOR', HG_OMNI_20X_SOLIDITY_FLOOR);
    var liqDistPct = (100 / lev) - mmr;
    if (!isFinite(liqDistPct) || liqDistPct <= 0) return null;
    return { lev: lev, mmrPct: mmr, safety: safety, noiseMult: noiseMult,
             solidityFloor: solFloor, liqDistPct: liqDistPct };
  }

  /* The 1h ATR as a percent of the last 1h close. Candidates carry the
     compact scalar `atr1hPct` stamped in hgOmniEvaluate (the raw 1h bars are
     released after grading, so the number is captured while they exist); a
     candidate shape that still carries rows1h is computed directly. NaN when
     neither exists — which the noise gate treats as a FAIL. */
  function hgOmni20xAtrPct(c){
    var v = fin(c && c.atr1hPct);
    if (isFinite(v) && v > 0) return v;
    try {
      var r = (c && c.rows1h && c.rows1h.length) ? c.rows1h : null;
      if (r && r.length >= 15){
        var a = atrOf(r, 14);
        var px = fin(r[r.length - 1].c);
        if (isFinite(a) && isFinite(px) && px > 0) return a / px * 100;
      }
    } catch (eA) {}
    return NaN;
  }

  /* The SAFE BAND a 20x stop distance must land in, derived from the SAME
     gates that judge it — nothing here loosens anything, it only names the
     interval the existing gates already imply:
       lo = rtCost / 0.125  — any tighter and hgOmniCostDrag's costR breaches
            the 'ok' tier ceiling (0.14% rt cost -> 1.12% of entry);
       hi = liqDistPct / STOP_SAFETY — any wider and the stop-width gate
            fails (4.6% / 2.5 -> 1.84% of entry).
     Null when the configured combination leaves no interval (fail closed). */
  function hgOmni20xBand(){
    try {
      var P = hgOmni20xParams();
      if (!P) return null;
      var rt = NaN;
      try { if (typeof window !== 'undefined') rt = fin(window.HG_OMNI_RT_COST_PCT); } catch (eW) { rt = NaN; }
      if (!isFinite(rt) || rt <= 0) rt = HG_OMNI_RT_COST_PCT;
      var lo = rt / OMNI_CV_COST_OK_R;
      var hi = P.liqDistPct / P.safety;
      if (!isFinite(lo) || !isFinite(hi) || lo <= 0 || hi <= 0 || lo > hi) return null;
      return { lo: lo, hi: hi };
    } catch (eBnd) { return null; }
  }

  /* 20X RE-PLAN — a tighter 1h stop for a ticket whose SWING stop can never
     fit 20x geometry. Production fact this exists for: nearly every ticket
     plan carries a 10-23% swing stop, and 1.84% is the widest stop the
     existing gates can ever accept — so without a re-plan the section is
     structurally empty, not selective.

     The stop comes from REAL 1h structure, the same lastSwing idiom the plan
     engine uses (plans.js: extreme over the lookback EXCLUDING the live bar,
     buffered HG_STOP_BUFFER_ATR x ATR14): walk the lookback out from 1 to 20
     bars, take each distinct running swing extreme, buffer it, and keep the
     NEAREST one whose distance from the CURRENT plan entry lands inside the
     safe band. No structural level in-band -> try 1.5x ATR(1h) if THAT
     distance is in-band. Neither -> null: no invented level, ever.

     The result is NOT the swing invalidation and the card must say so — a
     20x stop this tight can be hit by ordinary noise while the swing idea
     stays alive. t1 is set at 2R from the NEW stop so the printed geometry
     is self-consistent. Entry is never moved. Null-safe throughout. */
  function hgOmni20xReplan(plan, dir, rows1h){
    try {
      var band = hgOmni20xBand();
      if (!band) return null;
      dir = String(dir || '').toLowerCase();
      if (dir !== 'long' && dir !== 'short') return null;
      var entry = fin(plan && plan.entry);
      if (!plan || !isFinite(entry) || entry <= 0) return null;
      if (!isFinite(fin(plan.stop)) || !isFinite(fin(plan.t1))) return null;
      var rows = (rows1h && rows1h.length >= 16) ? rows1h : null;
      if (!rows) return null;
      var a1 = atrOf(rows, 14);
      if (!isFinite(a1) || a1 <= 0) return null;
      var w = null;
      try { w = (typeof window !== 'undefined') ? window : null; } catch (eW2) { w = null; }
      /* plans.js owns the buffer constant; fall back to its documented 0.25 */
      var buf = 0.25;
      try {
        var bo = w ? fin(w.HG_STOP_BUFFER_ATR) : NaN;
        if (isFinite(bo) && bo > 0) buf = bo;
      } catch (eB2) {}
      var buffer = buf * a1;
      var n = rows.length;
      var stop = NaN, src = null, prev = NaN;
      var look, i, i0, lvl, px, cand, dist;
      for (look = 1; look <= 20; look++){
        i0 = Math.max(0, n - 1 - look);
        /* lastSwing idiom: extreme over the lookback, live bar excluded */
        lvl = (dir === 'long') ? Infinity : -Infinity;
        for (i = i0; i < n - 1; i++){
          px = (dir === 'long') ? fin(rows[i] && rows[i].l) : fin(rows[i] && rows[i].h);
          if (!isFinite(px)) continue;
          lvl = (dir === 'long') ? Math.min(lvl, px) : Math.max(lvl, px);
        }
        if (!isFinite(lvl)) continue;
        if (isFinite(prev) && lvl === prev) continue; /* same level, wider window */
        prev = lvl;
        cand = (dir === 'long') ? (lvl - buffer) : (lvl + buffer);
        /* the stop must sit on the LOSS side of entry, or it is no stop */
        if (dir === 'long' ? !(cand < entry) : !(cand > entry)) continue;
        dist = Math.abs(entry - cand) / entry * 100;
        if (!isFinite(dist) || dist <= 0) continue;
        if (dist >= band.lo && dist <= band.hi){ stop = cand; src = '1h-swing'; break; }
        /* the running extreme only widens with the window — once past the
           cap, no larger lookback can come back inside the band */
        if (dist > band.hi) break;
      }
      if (!isFinite(stop)){
        cand = (dir === 'long') ? (entry - 1.5 * a1) : (entry + 1.5 * a1);
        dist = Math.abs(entry - cand) / entry * 100;
        if ((dir === 'long' ? cand < entry : cand > entry)
            && isFinite(dist) && dist >= band.lo && dist <= band.hi){
          stop = cand; src = '1.5xATR-1h';
        }
      }
      if (!isFinite(stop) || !src) return null;
      if (dir === 'long' ? !(stop < entry) : !(stop > entry)) return null;
      var risk = Math.abs(entry - stop);
      if (!(risk > 0)) return null;
      var t1 = (dir === 'long') ? (entry + 2 * risk) : (entry - 2 * risk);
      if (!isFinite(t1) || t1 <= 0) return null;
      return { entry: entry, stop: stop, t1: t1,
               stopDistPct: risk / entry * 100, src: src };
    } catch (eRp) { return null; }
  }

  /* Quality path (b): has this candidate's MECHANIC paid out of sample?
     Reads the EXACT same source the FORWARD table renders — hg-forward.js's
     hgFwdPool('OMNIROUTE') per-mechanic stat block, judged by the SAME
     hgOmniPoolRead call hgFwdPanelHTML makes (minRr = MIN_RR as omniroute
     passes it at render, minSamples = the panel's 20, barZ = the family-wise
     bar over the mechanics that pool actually holds). Nothing is
     reimplemented: the READ column and this gate cannot disagree.
     Null whenever any piece is unavailable — fail closed, never a pass. */
  function hgOmni20xForwardPaid(c){
    try {
      var w = null;
      try { w = (typeof window !== 'undefined') ? window : null; } catch (eW3) { w = null; }
      if (!w || typeof w.hgFwdPool !== 'function') return null;
      var kind = String((c && (c.kind || (c.hit && c.hit.kind))) || '');
      if (!kind) return null;
      var pool = null;
      try { pool = w.hgFwdPool('OMNIROUTE'); } catch (ePl) { pool = null; }
      if (!pool || typeof pool !== 'object') return null;
      var p = pool[kind];
      if (!p || !(fin(p.samples) > 0)) return null;
      var keys = [], k;
      for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)) keys.push(k);
      var barZ = hgOmniFamilyZ(Math.max(1, keys.length));
      var v = null;
      try { v = hgOmniPoolRead(p, MIN_RR, 20, barZ); } catch (eV) { v = null; }
      if (!v || !v.read) return null;
      return { read: String(v.read), z: fin(v.z), samples: fin(p.samples), bar: fin(v.bar) };
    } catch (eFp) { return null; }
  }

  /* The FULL 20x gate set on ONE geometry. Same thresholds as ever — this
     refactor moves the gates into a form that can (1) judge a re-planned
     stop through the identical set and (2) say WHICH gate failed, for the
     near-miss block. Every failure is collected rather than short-circuited,
     so "failed only on stop-width" is a checkable fact, not a guess.
     Gates (all must hold — none loosened):
       (a) plan with finite entry/stop/t1, the stop on the LOSS side of
           entry (below for a long, above for a short — an abs() distance
           would bless a plan whose downside has no stop at all).
       (b) stopDistPct * STOP_SAFETY <= liqDistPct — the stop speaks first.
       (c) NOISE_ATR_MULT * 1h-ATR% <= liqDistPct — routine noise cannot
           reach the liquidation price. Missing ATR -> FAIL, never a pass.
       (d) cost tier 'ok' (costR <= 0.125) via hgOmniCostDrag's exact math
           ON THE PLAN BEING JUDGED — a tighter stop pays more R to fees.
       (e) quality floor, ANY of (recorded in q.quality):
             'conviction'   — FULL certificate (count >= 3, costGate passed);
             'forward-paid' — this mechanic's out-of-sample FORWARD ledger
                              reads 'has paid' (hgOmni20xForwardPaid: the
                              same stats and the same bar the FORWARD table
                              renders — unavailable state fails closed);
             'solidity'     — solidity >= the 'fair' floor (kept: harmless
                              and future-proof, though live scans score
                              29-41/200 so it rarely fires today).
     Math: liqPrice = entry*(1 -/+ liqDistPct/100) for long/short;
     marginLossAtStopPct = stopDistPct * LEV (a 1.2% stop at 20x costs 24%
     of the margin — the card prints it); bufferX = liqDistPct/stopDistPct.
     Returns { ok, fails:[{gate,why}], q } — why strings carry percentages
     and verdicts only, NEVER price levels, because they are shown for
     setups that failed safety. Null-safe throughout; nothing throws. */
  function hgOmni20xGateRun(c, plan, P){
    var fails = [];
    var out = { ok: false, fails: fails, q: null };
    try {
      if (!P){ fails.push({ gate: 'params', why: 'leverage/maintenance-margin combination leaves no liq distance' }); return out; }
      var dir = String(((c && c.dir != null) ? c.dir : (c && c.hit && c.hit.dir)) || '').toLowerCase();
      if (dir !== 'long' && dir !== 'short'){ fails.push({ gate: 'dir', why: 'direction unknown' }); return out; }
      /* (a) plan geometry + (b) stop width */
      var entry = fin(plan && plan.entry), stop = fin(plan && plan.stop), t1 = fin(plan && plan.t1);
      var stopDistPct = NaN;
      if (!plan || !isFinite(entry) || !isFinite(stop) || !isFinite(t1) || entry <= 0){
        fails.push({ gate: 'plan', why: 'no finite entry/stop/t1' });
      } else if (dir === 'long' ? !(stop < entry) : !(stop > entry)){
        /* A "stop" on the profit side means the road to liquidation has no
           stop on it at all — the true loss at the unguarded exit is 100%
           of margin, not stopDistPct * lev. Malformed, never qualified. */
        fails.push({ gate: 'plan', why: 'stop on the wrong side of entry — malformed plan' });
      } else {
        stopDistPct = Math.abs(entry - stop) / entry * 100;
        if (!isFinite(stopDistPct) || stopDistPct <= 0){
          fails.push({ gate: 'plan', why: 'entry equals stop — no distance to judge' });
          stopDistPct = NaN;
        } else if (stopDistPct * P.safety > P.liqDistPct){
          fails.push({ gate: 'stop-width', why: 'stop ' + fmt(stopDistPct, 2) + '% — needs <=' + fmt(P.liqDistPct / P.safety, 2) + '% for ' + fmt(P.lev, 0) + 'x' });
        }
      }
      /* (c) noise cannot liquidate before the stop speaks */
      var atrPct = hgOmni20xAtrPct(c);
      if (!isFinite(atrPct) || atrPct <= 0){
        fails.push({ gate: 'noise', why: '1h ATR unknown — the noise check cannot run, and unchecked is a FAIL at 20x' });
      } else if (atrPct * P.noiseMult > P.liqDistPct){
        fails.push({ gate: 'noise', why: 'ATR noise ' + fmt(P.noiseMult, 0) + 'x' + fmt(atrPct, 1) + '%=' + fmt(atrPct * P.noiseMult, 1) + '% exceeds the ' + fmt(P.liqDistPct, 1) + '% liq distance' });
      }
      /* (d) cost gate — the replay's #1 finding applies double under
         leverage, because the fee is paid on NOTIONAL while the account
         holds only margin. Judged on the plan being judged. */
      var cost = null;
      try { cost = hgOmniCostDrag({ plan: plan }); } catch (eC) { cost = null; }
      if (!cost || cost.tier !== 'ok' || !isFinite(fin(cost.costR))){
        fails.push({ gate: 'cost', why: (cost && cost.tier)
          ? ('cost tier ' + String(cost.tier) + ' (' + fmt(cost.costR, 2) + 'R of every trade to fees) — needs ok (<=0.125R)')
          : 'cost drag not computable' });
      }
      /* (e) quality floor — three alternate paths, all fail closed */
      var quality = null, qualWhy = [];
      var cv = (c && c.conviction && typeof c.conviction === 'object') ? c.conviction
             : (c && c.hit && c.hit.conviction && typeof c.hit.conviction === 'object') ? c.hit.conviction
             : null;
      if (cv && isFinite(fin(cv.count)) && fin(cv.count) >= 3 && cv.costGate === 'passed'){
        quality = 'conviction';
      } else {
        qualWhy.push('no full conviction cert');
      }
      if (!quality){
        var fw = hgOmni20xForwardPaid(c);
        if (fw && fw.read === 'has paid') quality = 'forward-paid';
        else qualWhy.push(fw ? ('forward ledger reads "' + String(fw.read) + '"')
                             : 'mechanic has no settled forward record');
      }
      if (!quality){
        var sol = null;
        /* PREFER THE EVALUATE-TIME STAMP (c.solidity): scored with the full
           enrichment in scope, and it is the SAME number the SOLIDITY chip
           on the card shows (hgOmniSolidityBadgesHtml prefers it too), so
           the section and the chip cannot disagree. The stamp is scored on
           the PRIMARY plan; when this gate re-runs on the x20 re-plan the
           quality floor still reads the candidate's one displayed score —
           the re-plan changes geometry gates, not the setup's quality. */
        if (c && c.solidity && isFinite(fin(c.solidity.score))){
          sol = c.solidity;
        } else try {
          /* Starved fallback — same setup shape hgOmniSolidityBadgesHtml
             rebuilds when the stamp is absent (rows nulled after grading,
             extra collapsed to a boolean): only for pre-stamp candidates. */
          sol = hgOmniSolidityScore({
            plan: (c && c.plan) || null,
            hit: (c && c.hit && c.hit.dir) ? c.hit : { dir: c && c.dir, kind: c && c.kind, level: c && c.level },
            rows: (c && c.rows && c.rows.length) ? c.rows : null,
            extra: (c && c.extra && typeof c.extra === 'object') ? c.extra : null
          });
        } catch (eS) { sol = null; }
        if (sol && isFinite(fin(sol.score)) && fin(sol.score) >= P.solidityFloor) quality = 'solidity';
        else qualWhy.push((sol && isFinite(fin(sol.score)))
          ? ('solidity ' + fmt(sol.score, 0) + ' < the ' + fmt(P.solidityFloor, 0) + ' floor')
          : 'solidity not computable');
      }
      if (!quality) fails.push({ gate: 'quality', why: qualWhy.join('; ') });
      if (fails.length) return out;
      var liqPrice = (dir === 'long')
        ? entry * (1 - P.liqDistPct / 100)
        : entry * (1 + P.liqDistPct / 100);
      out.ok = true;
      out.q = {
        liqPrice: liqPrice,
        liqDistPct: P.liqDistPct,
        stopDistPct: stopDistPct,
        marginLossAtStopPct: stopDistPct * P.lev,
        bufferX: P.liqDistPct / stopDistPct,
        costR: fin(cost.costR),
        quality: quality
      };
      return out;
    } catch (eGr) {
      /* a throw is a failure of THIS code, not evidence about the setup —
         report it as an unpassable gate so nothing qualifies by accident */
      fails.push({ gate: 'error', why: 'gate evaluation threw' });
      out.ok = false; out.q = null;
      return out;
    }
  }

  /* Does ONE candidate survive 20x geometry? null = no. Non-null = the
     numbers the section prints, now stamped planUsed:'primary'|'x20'.
     The PRIMARY plan is tried first through the unchanged gate set. If — and
     only if — it failed on stop-width ALONE (every other gate passed), the
     candidate's x20plan (the tighter 1h-structure stop stamped in
     hgOmniEvaluate) is pushed through the SAME full gate set: stop band,
     noise, cost recomputed on the NEW stop, quality floor. Any other primary
     failure, or no x20plan, or the x20plan failing anything: null. The veto
     signal stays the SAME boolean the cards use (c.grade.ticket — a WATCH
     card is excluded too: at 20x, "no data" is not "safe"). */
  function hgOmni20xQualify(c){
    try {
      var P = hgOmni20xParams();
      if (!P) return null;
      if (!c || !c.plan) return null;
      if (!c.grade || c.grade.ticket !== true) return null;
      var prim = hgOmni20xGateRun(c, c.plan, P);
      if (prim.ok){
        prim.q.planUsed = 'primary';
        return prim.q;
      }
      if (c.x20plan && prim.fails.length === 1 && prim.fails[0].gate === 'stop-width'){
        var alt = hgOmni20xGateRun(c, c.x20plan, P);
        if (alt.ok){
          alt.q.planUsed = 'x20';
          alt.q.x20 = {
            entry: fin(c.x20plan.entry), stop: fin(c.x20plan.stop), t1: fin(c.x20plan.t1),
            stopDistPct: fin(c.x20plan.stopDistPct), src: String(c.x20plan.src || '')
          };
          var pE = fin(c.plan.entry), pS = fin(c.plan.stop);
          alt.q.primaryStopDistPct = (isFinite(pE) && isFinite(pS) && pE > 0)
            ? Math.abs(pE - pS) / pE * 100 : NaN;
          return alt.q;
        }
      }
      return null;
    } catch (e20) { return null; }
  }

  /* Why did a TICKET not make the 20X shortlist? Diagnosis for the
     near-miss block: runs the primary plan through the full gate set, and
     when stop-width was the only failure, runs the x20 re-plan too (or says
     no in-band structure existed). Returns { qualified, fails:[{gate,why}] }
     or null for non-tickets — the near-miss block only ranks tickets.
     Reasons carry percentages and verdicts, never price levels. */
  function hgOmni20xExplain(c){
    try {
      var P = hgOmni20xParams();
      if (!P) return null;
      if (!c || !c.grade || c.grade.ticket !== true) return null;
      var prim = hgOmni20xGateRun(c, c.plan || null, P);
      if (prim.ok) return { qualified: true, planUsed: 'primary', fails: [] };
      var fails = prim.fails;
      if (fails.length === 1 && fails[0].gate === 'stop-width'){
        if (c.x20plan){
          var alt = hgOmni20xGateRun(c, c.x20plan, P);
          if (alt.ok) return { qualified: true, planUsed: 'x20', fails: [] };
          var f2 = [], i2;
          for (i2 = 0; i2 < alt.fails.length; i2++){
            f2.push({ gate: String(alt.fails[i2].gate),
                      why: String(alt.fails[i2].why) + ' — even on the 20x re-plan (primary ' + String(fails[0].why) + ')' });
          }
          fails = f2.length ? f2 : fails;
        } else {
          var band = hgOmni20xBand();
          fails = [{ gate: 'stop-width',
                     why: String(fails[0].why) + '; no 1h structure lands in the '
                        + (band ? (fmt(band.lo, 2) + '-' + fmt(band.hi, 2) + '%') : 're-plan')
                        + ' band, so no tighter stop exists' }];
        }
      }
      return { qualified: false, fails: fails };
    } catch (eEx) { return null; }
  }

  /* The whole section for the tab: permanent warning banner, then one
     compact card per qualifying candidate, or the honest empty state. Fed
     the SAME collapsed candidate list the card render uses, in the same
     pass. Returns '' only if even the banner cannot be built. */
  function hgOmni20xSectionHtml(candidates){
    try {
      var P = hgOmni20xParams();
      if (!P){
        return '<div class="note warn">20X section unavailable — the configured leverage/maintenance-margin '
             + 'combination leaves no distance to liquidation, so no geometry can be judged.</div>';
      }
      var list = [], quals = [], i, c, q;
      var arr = (candidates && candidates.length) ? candidates : [];
      for (i = 0; i < arr.length; i++){
        c = arr[i]; if (!c) continue;
        q = null;
        try { q = hgOmni20xQualify(c); } catch (eQ) { q = null; }
        if (q){ list.push(c); quals.push(q); }
      }
      var h = '<section data-omni-20x="1">';
      h += '<div class="hg-mp-eye">20X — LEVERAGE-SAFE SETUPS (' + list.length + ')</div>';
      /* The banner is PERMANENT — it renders on the empty state too,
         because the reader most likely to need it is the one about to
         force a trade that did not qualify. */
      h += '<div class="note warn" style="display:block">20x is unforgiving: a ~'
        +  P.liqDistPct.toFixed(1) + '% adverse move liquidates the full isolated margin. '
        +  'These cards passed geometry gates (stop ' + P.safety + 'x inside liquidation, noise check, '
        +  'cost gate, quality floor: conviction cert, a forward record that has paid, or solidity) '
        +  '— that is safety of GEOMETRY, not a prediction. '
        +  'Funding and gap slippage are NOT modeled. Signals only — this desk does not execute.</div>';
      if (!list.length){
        h += '<div class="empty">no setup currently clears the 20x safety gates — with 20x leverage '
          +  'that is the correct output most of the time, not a malfunction.</div>';
      } else {
        for (i = 0; i < list.length; i++){
          c = list[i]; q = quals[i];
          var used20 = !!(q && q.planUsed === 'x20' && q.x20);
          var head = esc(String(c.base || c.sym || '?'))
                   + ' · ' + esc(String(c.dir || '').toUpperCase())
                   + ' · ' + esc(String(c.kind || ''));
          h += '<div class="card">';
          h += '<div class="ttl">' + head + ' ' + pill(used20 ? '20X RE-PLAN OK' : '20X GEOMETRY OK', 'ok')
            +  ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span></div>';
          if (used20){
            /* The re-plan card must never read like the swing card. The stop
               is 1h structure chosen to FIT 20x, not the level that proves
               the idea wrong — say so before the numbers. */
            h += '<div class="note warn" style="display:block">20X PLAN — tighter 1h stop, NOT the '
              +  'swing invalidation: ordinary noise can stop this trade while the swing idea stays alive.</div>';
            h += '<div class="plan">20x ENTRY ' + fmtPx(q.x20.entry)
              +  ' · STOP ' + fmtPx(q.x20.stop)
              +  ' · T1 ' + fmtPx(q.x20.t1)
              +  ' <span class="dim">(' + esc(String(q.x20.src || '')) + ', 2R)</span></div>';
            h += '<div class="plan dim">swing plan: stop ' + fmt(q.primaryStopDistPct, 2)
              +  '% away — that invalidation stays live after a 20x stop-out</div>';
          } else {
            h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry)
              +  ' · STOP ' + fmtPx(c.plan.stop)
              +  ' · T1 ' + fmtPx(c.plan.t1) + '</div>';
          }
          /* The 20x arithmetic, spelled out — computed from the plan that
             actually QUALIFIED (q came from that gate run). A 1.2% stop is
             "small" until it is printed as 24% of the margin. */
          h += '<div class="plan">est. liq ' + fmtPx(q.liqPrice)
            +  ' (' + fmt(q.liqDistPct, 2) + '%)'
            +  ' · stop ' + fmt(q.stopDistPct, 2) + '%'
            +  ' · stop-to-liq buffer ' + fmt(q.bufferX, 1) + 'x'
            +  ' · at stop you lose <b>' + fmt(q.marginLossAtStopPct, 0) + '%</b> of margin'
            +  ' · cost ' + fmt(q.costR, 2) + 'R</div>';
          try { h += hgOmniSolidityBadgesHtml(c); } catch (eB) {}
          h += '<div class="dim">[via ' + esc(String(q.quality)) + ' · plan: ' + esc(String(q.planUsed || 'primary')) + ']</div>';
          h += '</div>';
        }
      }
      /* NEAR-MISS TRANSPARENCY. When the shortlist is thin, name the
         closest TICKETS and the gate that stopped each — so an empty or
         near-empty section reads as gates doing their job on specific
         setups, not as a dead feature. NO entry/stop levels here, ever:
         these failed a safety gate, and printing tradable numbers under a
         "not qualified" heading is how a warning becomes a suggestion. */
      if (list.length < 3){
        var near = [], ni, nc, nx;
        for (ni = 0; ni < arr.length; ni++){
          nc = arr[ni]; if (!nc) continue;
          if (!(nc.grade && nc.grade.ticket === true)) continue;
          if (list.indexOf(nc) >= 0) continue;   /* already qualified */
          nx = null;
          try { nx = hgOmni20xExplain(nc); } catch (eNx) { nx = null; }
          if (!nx || nx.qualified || !nx.fails || !nx.fails.length) continue;
          near.push({ c: nc, fails: nx.fails });
        }
        near.sort(function(a, b){ return a.fails.length - b.fails.length; });
        if (near.length){
          h += '<div class="note dim" style="margin-top:8px;opacity:.8"><b>NEAREST MISSES — NOT QUALIFIED</b>'
            +  ' <span class="dim">(closest tickets and the gate that stopped each · no levels shown on setups that failed safety)</span>';
          for (ni = 0; ni < near.length && ni < 3; ni++){
            var nf = near[ni].fails[0];
            var nMore = near[ni].fails.length - 1;
            h += '<div class="dim">' + esc(String(near[ni].c.base || near[ni].c.sym || '?'))
              +  ' ' + esc(String(near[ni].c.dir || '').toUpperCase())
              +  ' ' + esc(String(near[ni].c.kind || ''))
              +  ' — failed: ' + esc(String(nf.gate)) + ': ' + esc(String(nf.why))
              +  (nMore > 0 ? ' <span class="dim">(+' + nMore + ' more gate' + (nMore === 1 ? '' : 's') + ')</span>' : '')
              +  '</div>';
          }
          h += '</div>';
        }
      }
      h += '</section>';
      return h;
    } catch (eSec) {
      return '';
    }
  }

  /* ==================== end 20X leverage-safe subset ==================== */

  /* ==================== APEX — stacked-edge setups ====================

     The trades an elite, extremely selective trader would actually take.
     Six rules, ALL required, EVERY one failing closed on missing data:
       1. PROVEN EDGE ONLY — the mechanic's own out-of-sample forward ledger
          reads 'has paid' (hgOmni20xForwardPaid: the same hgFwdPool +
          hgOmniPoolRead at the family-wise bar the FORWARD table renders),
          OR the hit carries a FULL conviction certificate (count >= 3,
          formation cost gate passed).
       2. STACKED INDEPENDENT EDGES — the candidate is a confluence cluster:
          >= 2 mechanics fired on identical levels (the collapse pass already
          merged them into one card carrying alsoKinds), AND at least one of
          the cluster is forward-paid.
       3. WITH-TREND ONLY, EVERY TIMEFRAME — trend gate PASS + htf-daily
          PASS + regime gate PASS (the regime gate is already true on a
          neutral tape and false only when the tape is against the side, so
          PASS is exactly 'not against'). Counter-trend / reversion mechanics
          NEVER reach APEX regardless of other merits — their trend gate
          passes as 'context only', which is not the same claim.
       4. CLEAN TAPE CONTEXT — the shared indicator bank (the same ~23 reads
          behind the 'INDICATORS MIXED 19w/3a' chip) must be strongly with:
          >= 16 with AND <= 3 against. Plus book-depth PASS and
          participation PASS — thin books and dead tape are how good setups
          die.
       5. NON-VETOED TICKET — grade.ticket === true, a finite plan with the
          stop on the loss side, and cost tier ok (hgOmniCostDrag
          costR <= 0.125R).
       6. THE BANKING EXIT — the +1R bank level and the 2R level must be
          computable from the plan's own entry/stop, both sides.

     NOTHING here prints a promised win rate. Every number an APEX card
     shows is a stat the app already measured: the forward pool's settled
     T1-first / expectancy / n, and the SHADOW bank-half comparison over
     settled pairs. Display only — this desk does not execute. */

  /* The shared context-indicator bank, keyed exactly as hg-gates.js
     hgIndicatorGates pushes them (the 'context-gates' placeholder is NOT a
     read and is excluded). A key absent from a candidate simply does not
     count, so a candidate without the bank can never reach 16-with — the
     rule fails closed by arithmetic. */
  var OMNI_APEX_CONTEXT_KEYS = {
    'ichimoku':1, 'donchian-pos':1, 'stoch-rsi':1, 'hurst-regime':1,
    'squeeze-state':1, 'keltner-pos':1, 'structure-shift':1,
    'macd-momentum':1, 'bollinger-pctb':1, 'volume-z':1,
    'regression-slope':1, 'value-area':1, 'htf-confirm':1, 'regime-fit':1,
    'adx-regime':1, 'obv-flow':1, 'mfi-pressure':1, 'cci-stretch':1,
    'ema-ribbon':1, 'heikin-trend':1, 'rsi-classic':1, 'roc-thrust':1,
    'vwap-stretch':1
  };
  var OMNI_APEX_WITH_MIN = 16;
  var OMNI_APEX_AGAINST_MAX = 3;

  /* First gate on the candidate's own ledger with this key, or null. */
  function hgOmniApexGate(c, key){
    try {
      if (!c || !c.gates || !c.gates.length) return null;
      for (var i = 0; i < c.gates.length; i++){
        var g = c.gates[i];
        if (g && String(g.key) === key) return g;
      }
    } catch (eG) {}
    return null;
  }

  /* The with/against tally over the shared context bank — the SAME counting
     rule hgContextRead uses for the 'Nw/Na' chip: pass === true is with,
     pass === false is against, anything else is n/a and counts for
     neither side. */
  function hgOmniApexContextTally(c){
    var out = { withN: 0, againstN: 0, seen: 0 };
    try {
      if (!c || !c.gates || !c.gates.length) return out;
      for (var i = 0; i < c.gates.length; i++){
        var g = c.gates[i];
        if (!g || OMNI_APEX_CONTEXT_KEYS[String(g.key)] !== 1) continue;
        out.seen++;
        if (g.pass === true) out.withN++;
        else if (g.pass === false) out.againstN++;
      }
    } catch (eT) { return { withN: 0, againstN: 0, seen: 0 }; }
    return out;
  }

  /* Forward verdict for ONE mechanic name — hgOmni20xForwardPaid only reads
     `kind`, so a shim keeps the two gates judging the identical stats at
     the identical family-wise bar. Null = no settled record (fail closed). */
  function hgOmniApexForwardFor(kind){
    try {
      var k = String(kind || '');
      if (!k) return null;
      return hgOmni20xForwardPaid({ kind: k });
    } catch (eF) { return null; }
  }

  /* Raw pool row for the verbatim measured-stat line (samples / hit / expR),
     the same block hgFwdPanelHTML tabulates. Null when unavailable. */
  function hgOmniApexPoolRow(kind){
    try {
      var w = (typeof window !== 'undefined') ? window : null;
      if (!w || typeof w.hgFwdPool !== 'function') return null;
      var pool = null;
      try { pool = w.hgFwdPool('OMNIROUTE'); } catch (ePl) { pool = null; }
      if (!pool || typeof pool !== 'object') return null;
      var p = pool[String(kind || '')];
      if (!p || !(fin(p.samples) > 0)) return null;
      return p;
    } catch (eP) { return null; }
  }

  /* The SHADOW measurement the FORWARD panel already computes — as-traded
     vs bank-half-at-+1R per-trade R over settled pairs, summed across every
     mechanic in the pool (same weighting as hgFwdPanelHTML's shadow block:
     bankN / bankExpR / bankActualExpR). Null until real pairs exist. */
  function hgOmniApexShadowStats(){
    try {
      var w = (typeof window !== 'undefined') ? window : null;
      if (!w || typeof w.hgFwdPool !== 'function') return null;
      var pool = null;
      try { pool = w.hgFwdPool('OMNIROUTE'); } catch (ePl2) { pool = null; }
      if (!pool || typeof pool !== 'object') return null;
      var bn = 0, bs = 0, ba = 0, k, p;
      for (k in pool){
        if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
        p = pool[k];
        if (p && fin(p.bankN) > 0 && isFinite(fin(p.bankExpR)) && isFinite(fin(p.bankActualExpR))){
          bn += fin(p.bankN);
          bs += fin(p.bankN) * fin(p.bankExpR);
          ba += fin(p.bankN) * fin(p.bankActualExpR);
        }
      }
      if (!(bn > 0)) return null;
      return { n: bn, shadowR: bs / bn, actualR: ba / bn };
    } catch (eSh) { return null; }
  }

  /* The full six-rule run on ONE candidate. Failures are COLLECTED, not
     short-circuited, so 'failed only on counter-trend' is a checkable fact
     for the near-miss line. Returns { ok, fails:[{rule,why}], data } —
     data non-null only when every rule held. Null-safe throughout; a throw
     is a failure of THIS code and reads as an unpassable rule. */
  function hgOmniApexCheck(c){
    var fails = [];
    var out = { ok: false, fails: fails, data: null };
    try {
      if (!c){ fails.push({ rule: 'input', why: 'no candidate' }); return out; }
      var dir = String(((c.dir != null) ? c.dir : (c.hit && c.hit.dir)) || '').toLowerCase();
      var kind = String((c.kind || (c.hit && c.hit.kind)) || '');
      if (dir !== 'long' && dir !== 'short'){ fails.push({ rule: 'input', why: 'direction unknown' }); return out; }
      if (!kind){ fails.push({ rule: 'input', why: 'mechanic unknown' }); return out; }

      /* 1 — proven edge only */
      var quality = null;
      var fwSelf = hgOmniApexForwardFor(kind);
      if (fwSelf && fwSelf.read === 'has paid') quality = 'forward-paid';
      if (!quality){
        var cv = (c.conviction && typeof c.conviction === 'object') ? c.conviction
               : (c.hit && c.hit.conviction && typeof c.hit.conviction === 'object') ? c.hit.conviction
               : null;
        if (cv && isFinite(fin(cv.count)) && fin(cv.count) >= 3 && cv.costGate === 'passed') quality = 'conviction';
      }
      if (!quality){
        fails.push({ rule: 'proven-edge',
          why: fwSelf ? ('forward ledger reads "' + String(fwSelf.read) + '" and no full conviction certificate')
                      : 'no settled forward record and no full conviction certificate' });
      }

      /* 2 — stacked independent edges: >= 2 mechanics on identical levels,
         at least one forward-paid. The collapse pass already merged the
         duplicates; alsoKinds is that merge's receipt. ARRAY ONLY: a
         corrupted alsoKinds (a string iterates as characters, so 'ORB'
         would mint the fake mechanics 'O','R','B') must read as no
         cluster at all, never as a bigger one. */
      var clusterKinds = [kind], i, ak;
      if (Array.isArray(c.alsoKinds) && c.alsoKinds.length){
        for (i = 0; i < c.alsoKinds.length; i++){
          ak = String(c.alsoKinds[i] || '');
          if (ak && clusterKinds.indexOf(ak) < 0) clusterKinds.push(ak);
        }
      }
      var paidKinds = [];
      for (i = 0; i < clusterKinds.length; i++){
        var fwk = (clusterKinds[i] === kind) ? fwSelf : hgOmniApexForwardFor(clusterKinds[i]);
        if (fwk && fwk.read === 'has paid') paidKinds.push(clusterKinds[i]);
      }
      if (clusterKinds.length < 2){
        fails.push({ rule: 'cluster', why: 'only one mechanic fired on these levels — APEX needs >=2 on identical levels' });
      } else if (!paidKinds.length){
        fails.push({ rule: 'cluster', why: clusterKinds.length + ' mechanics fired on identical levels, but none carries a forward ledger that has paid' });
      }

      /* 3 — with-trend only, every timeframe. Reversion/counter-trend kinds
         are rejected by NAME, because for them the trend gates pass as
         'context only' and prove nothing about alignment. A family lookup
         that throws reads as reversion — fail closed. */
      var isRev = true;
      try {
        isRev = (REVERSION_KINDS[kind] === true) || (hgOmniIsReversion(kind) === true);
      } catch (eRv) { isRev = true; }
      if (isRev) fails.push({ rule: 'counter-trend', why: kind + ' is a counter-trend/reversion mechanic — APEX is with-trend only' });
      var gT = hgOmniApexGate(c, 'trend');
      if (!gT || gT.pass !== true){
        fails.push({ rule: 'trend', why: gT ? (gT.pass === false ? 'trend gate against the setup' : 'trend gate unchecked — unverified is not with-trend') : 'trend gate missing from the ledger' });
      }
      var gH = hgOmniApexGate(c, 'htf-daily');
      if (!gH || gH.pass !== true){
        fails.push({ rule: 'htf-daily', why: gH ? (gH.pass === false ? 'daily timeframe disagrees with the setup' : 'daily read unchecked — unverified is not with-trend') : 'htf-daily gate missing from the ledger' });
      }
      var gR = hgOmniApexGate(c, 'regime');
      if (!gR || gR.pass !== true){
        fails.push({ rule: 'regime', why: gR ? (gR.pass === false ? 'regime is against the side' : 'regime unchecked — unverified is not clean') : 'regime gate missing from the ledger' });
      }

      /* 4 — clean tape context */
      var tally = hgOmniApexContextTally(c);
      if (!tally.seen){
        fails.push({ rule: 'indicators', why: 'shared indicator bank absent from this candidate — the tape context cannot be judged' });
      } else if (!(tally.withN >= OMNI_APEX_WITH_MIN && tally.againstN <= OMNI_APEX_AGAINST_MAX)){
        fails.push({ rule: 'indicators',
          why: 'indicator context ' + tally.withN + 'w/' + tally.againstN + 'a of ' + tally.seen
             + ' — APEX needs >=' + OMNI_APEX_WITH_MIN + ' with and <=' + OMNI_APEX_AGAINST_MAX + ' against' });
      }
      var gB = hgOmniApexGate(c, 'book-depth');
      if (!gB || gB.pass !== true){
        fails.push({ rule: 'book-depth', why: gB ? (gB.pass === false ? 'book too thin — slippage would eat the stop' : 'book depth unmeasured — a thin book is how good setups die') : 'book-depth gate missing from the ledger' });
      }
      var gP = hgOmniApexGate(c, 'participation');
      if (!gP || gP.pass !== true){
        fails.push({ rule: 'participation', why: gP ? (gP.pass === false ? 'trigger bar is a volume vacuum' : 'participation unmeasured — dead tape cannot be ruled out') : 'participation gate missing from the ledger' });
      }

      /* 5 — non-vetoed ticket, finite plan, cost tier ok */
      if (!c.grade || c.grade.ticket !== true){
        fails.push({ rule: 'ticket', why: 'not a cleared TICKET — a veto or missing hard data stands it aside' });
      }
      var entry = fin(c.plan && c.plan.entry), stop = fin(c.plan && c.plan.stop), t1 = fin(c.plan && c.plan.t1);
      var risk = NaN;
      if (!c.plan || !isFinite(entry) || !isFinite(stop) || !isFinite(t1) || entry <= 0){
        fails.push({ rule: 'plan', why: 'no finite entry/stop/t1 — nothing to place' });
      } else if (dir === 'long' ? !(stop < entry) : !(stop > entry)){
        fails.push({ rule: 'plan', why: 'stop on the wrong side of entry — malformed plan' });
      } else {
        risk = Math.abs(entry - stop);
        if (!(risk > 0)){ fails.push({ rule: 'plan', why: 'entry equals stop — no risk unit to bank against' }); risk = NaN; }
      }
      var cost = null;
      try { cost = hgOmniCostDrag({ plan: (c.plan || null) }); } catch (eC) { cost = null; }
      if (!cost || cost.tier !== 'ok' || !(fin(cost.costR) <= OMNI_CV_COST_OK_R)){
        fails.push({ rule: 'cost',
          why: (cost && isFinite(fin(cost.costR)))
            ? ('cost ' + fmt(cost.costR, 2) + 'R of every trade to fees (tier ' + String(cost.tier) + ') — needs ok (<=' + OMNI_CV_COST_OK_R + 'R)')
            : 'cost drag not computable' });
      }

      /* 6 — the banking exit must be computable from the plan itself */
      var bank1R = NaN, twoR = NaN;
      if (isFinite(risk) && risk > 0){
        bank1R = (dir === 'long') ? (entry + risk) : (entry - risk);
        twoR   = (dir === 'long') ? (entry + 2 * risk) : (entry - 2 * risk);
        if (!isFinite(bank1R) || bank1R <= 0 || !isFinite(twoR) || twoR <= 0){
          fails.push({ rule: 'bank-exit', why: '1R/2R arithmetic is degenerate on this plan' });
          bank1R = NaN; twoR = NaN;
        }
      } else {
        fails.push({ rule: 'bank-exit', why: 'no finite risk unit — the +1R bank level cannot be computed' });
      }

      if (fails.length) return out;
      out.ok = true;
      out.data = {
        clusterKinds: clusterKinds,
        paidKinds: paidKinds,
        quality: quality,
        withCount: tally.withN,
        againstCount: tally.againstN,
        bank1R: bank1R,
        twoR: twoR,
        entry: entry, stop: stop, t1: t1, risk: risk, dir: dir,
        checksSummary: 'edge ' + quality
          + ' · ' + clusterKinds.length + ' mechanics on one set of levels (' + paidKinds.length + ' forward-paid)'
          + ' · trend+htf-daily+regime PASS'
          + ' · indicators ' + tally.withN + 'w/' + tally.againstN + 'a'
          + ' · book-depth+participation PASS'
          + ' · ticket, cost ok, 1R/2R computed'
      };
      return out;
    } catch (eAx) {
      fails.push({ rule: 'error', why: 'apex evaluation threw — nothing qualifies by accident' });
      out.ok = false; out.data = null;
      return out;
    }
  }

  /* Public contract: null = not APEX. Non-null = the fields the card
     prints, every one derived from data the app already measured. */
  function hgOmniApexQualify(c){
    try {
      var r = hgOmniApexCheck(c);
      if (!r || !r.ok || !r.data) return null;
      return {
        clusterKinds: r.data.clusterKinds.slice(),
        paidKinds: r.data.paidKinds.slice(),
        quality: r.data.quality,
        withCount: r.data.withCount,
        againstCount: r.data.againstCount,
        bank1R: r.data.bank1R,
        checksSummary: r.data.checksSummary
      };
    } catch (eQ) { return null; }
  }

  /* One measured forward line per mechanic: 'PO3 forward: 62% T1-first,
     +0.41R, n=214' — the pool's own settled numbers, verbatim, never a
     projection. '' when the mechanic has nothing settled. */
  function hgOmniApexForwardLine(kind, paid){
    try {
      var p = hgOmniApexPoolRow(kind);
      if (!p) return '';
      var hitPct = isFinite(fin(p.hit)) ? (fin(p.hit) * 100).toFixed(0) + '%' : '—';
      var expTxt = isFinite(fin(p.expR)) ? ((fin(p.expR) >= 0 ? '+' : '') + fin(p.expR).toFixed(2) + 'R') : '—';
      return '<div class="dim">' + esc(String(kind)) + ' forward: ' + esc(hitPct) + ' T1-first, '
           + esc(expTxt) + ', n=' + esc(String(fin(p.samples)))
           + (paid ? ' — <b>has paid</b> at the family-wise bar' : '')
           + '</div>';
    } catch (eL) { return ''; }
  }

  /* The whole APEX section: header, the permanent selectivity note, one
     card per qualifying candidate or the honest empty state, and the
     near-miss line. Fed the SAME collapsed candidate list the card render
     uses, in the same pass. Returns '' only if even the header cannot be
     built. */
  function hgOmniApexSectionHtml(candidates){
    try {
      var arr = (candidates && candidates.length) ? candidates : [];
      var list = [], quals = [], nears = [], i, c, r;
      for (i = 0; i < arr.length; i++){
        c = arr[i]; if (!c) continue;
        r = null;
        try { r = hgOmniApexCheck(c); } catch (eR) { r = null; }
        if (r && r.ok && r.data){ list.push(c); quals.push(r.data); }
        else if (r && r.fails && r.fails.length && c.grade && c.grade.ticket === true){
          /* Near-misses rank TICKETS only: naming a vetoed card as 'nearly
             APEX' would contradict the desk's own verdict on it. */
          nears.push({ c: c, fails: r.fails });
        }
      }
      var h = '<section data-omni-apex="1">';
      h += '<div class="hg-mp-eye">APEX — STACKED-EDGE SETUPS (' + list.length + ')</div>';
      /* Permanent — the empty state is the normal state, and the reader
         must see WHY before deciding the section is broken. */
      h += '<div class="note">APEX prints a card only when every independent check already stands in the trade’s favour: '
        +  'a forward ledger that has paid, several mechanics on one set of levels, with-trend on every timeframe, and a clean tape. '
        +  'Selectivity IS the edge — most scans show nothing here, and that is the bar holding.</div>';
      if (!list.length){
        h += '<div class="empty">no setup clears the APEX bar on this scan. That is the expected result: '
          +  'the bar exists to be missed by almost everything.</div>';
      } else {
        var shadow = hgOmniApexShadowStats();
        for (i = 0; i < list.length; i++){
          c = list[i]; r = quals[i];
          var head = esc(String(c.base || c.sym || '?'))
                   + ' · ' + esc(String(r.dir || '').toUpperCase())
                   + ' · ' + esc(String(c.kind || ''));
          h += '<div class="card">';
          h += '<div class="ttl">' + head + ' ' + pill('APEX', 'ok')
            +  ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span></div>';
          /* The cluster — one trade several mechanics found. */
          h += '<div class="dim">' + esc(r.clusterKinds.join(' + '))
            +  ' — ' + r.clusterKinds.length + ' mechanics, one trade</div>';
          /* Measured forward evidence per mechanic, verbatim from the pool. */
          var fj;
          for (fj = 0; fj < r.clusterKinds.length; fj++){
            h += hgOmniApexForwardLine(r.clusterKinds[fj], r.paidKinds.indexOf(r.clusterKinds[fj]) >= 0);
          }
          /* The levels — plan first, then the banking arithmetic from it. */
          h += '<div class="plan">ENTRY ' + fmtPx(r.entry)
            +  ' · STOP ' + fmtPx(r.stop)
            +  ' · 1R-BANK ' + fmtPx(r.bank1R)
            +  ' · T1 ' + fmtPx(r.t1) + '</div>';
          /* TWO exit designs, side by side, with the app's own measured
             evidence for each — no promised numbers anywhere. */
          h += '<div class="plan"><b>EXIT A — BANK HALF AT +1R</b>: sell half at '
            +  fmtPx(r.bank1R) + ' (+1R), stop to breakeven ' + fmtPx(r.entry)
            +  ', rest runs to 2R ' + fmtPx(r.twoR) + '</div>';
          h += '<div class="plan"><b>EXIT B — FULL POSITION TO 2R</b>: all out at '
            +  fmtPx(r.twoR) + ' (2R), stop never moves</div>';
          if (shadow){
            var acTxt = (shadow.actualR >= 0 ? '+' : '') + shadow.actualR.toFixed(2) + 'R';
            var shTxt = (shadow.shadowR >= 0 ? '+' : '') + shadow.shadowR.toFixed(2) + 'R';
            h += '<div class="note"><b>SHADOW — bank half at +1R</b>: ' + shadow.n
              +  ' settled pair' + (shadow.n === 1 ? '' : 's') + ' · as traded ' + esc(acTxt)
              +  ' vs shadow ' + esc(shTxt) + ' per trade — this desk’s own settled forward pairs, '
              +  'measured after the fact, never a promise. Read the tradeoff from the two numbers, '
              +  'not from a preference.</div>';
          } else {
            h += '<div class="note dim">SHADOW — bank half at +1R: no settled pairs yet — the comparison '
              +  'fills as forward trades settle, and until then neither exit design has evidence over the other.</div>';
          }
          try { h += hgOmniSolidityBadgesHtml(c); } catch (eB) {}
          h += '<div class="dim">' + esc(r.checksSummary) + '</div>';
          h += '<div class="dim">APEX bar: proven edge + stacked mechanics + with-trend everywhere + clean tape. '
            +  'Most scans have none — that is the bar working, not failing.</div>';
          h += '</div>';
        }
      }
      /* Near-miss transparency, tickets only, no levels ever — these missed
         a selectivity bar, and printing tradable numbers under a 'not
         qualified' heading turns a warning into a suggestion. */
      if (nears.length && list.length < 3){
        nears.sort(function(a, b){ return a.fails.length - b.fails.length; });
        var nMax = nears.length < 3 ? nears.length : 3, ni;
        for (ni = 0; ni < nMax; ni++){
          var nf = nears[ni].fails[0];
          var nMore = nears[ni].fails.length - 1;
          h += '<div class="dim">nearest: ' + esc(String(nears[ni].c.base || nears[ni].c.sym || '?'))
            +  ' ' + esc(String(nears[ni].c.dir || '').toUpperCase())
            +  ' ' + esc(String(nears[ni].c.kind || ''))
            +  ' — failed: ' + esc(String(nf.rule)) + ': ' + esc(String(nf.why))
            +  (nMore > 0 ? ' <span class="dim">(+' + nMore + ' more rule' + (nMore === 1 ? '' : 's') + ')</span>' : '')
            +  '</div>';
        }
      }
      h += '</section>';
      return h;
    } catch (eSec) { return ''; }
  }

  /* ==================== end APEX stacked-edge setups ==================== */

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
    /* x is assigned further down in this function; these gates run first, and
       before this line they saw the hoisted-but-unassigned var — so plan-levels
       could never veto here. Assigning early is idempotent with the later line. */
    var x = extra || {};

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

    /* LEVEL-FRESH — the levels must survive contact with the CURRENT price.

       The desk drops the forming candle before anything reads a bar, which is
       right for every indicator. But the plan then prices its entry at the
       last CLOSED bar — up to four hours stale on the swing horizon — and no
       gate ever compared it against where the market actually is.

       Demonstrated live: every swing card quoted entry 4391.83 while the
       market traded 4499.23, 107 points off the reader's chart. The two
       SHORT cards carried stops at 4449 with the market at 4499 — fifty
       points beyond the stop before the trade was ever placed — and earlier
       the desk TICKETED one of those. A ticket whose stop the market has
       already crossed is dead on arrival: filled at market, it is an instant
       stop-out presented as a 2R setup.

       Three states:
         market beyond the stop            -> VETO, dead on arrival
         entry more than 1.5xATR from      -> AGAINST (info). The levels are a
         the market                           resting-order plan around stale
                                              structure, not a market entry,
                                              and the card must say which
         otherwise                         -> PASS, quoting the gap

       UNCHECKED when no live price is supplied — harnesses and callers that
       predate this gate keep working, and unknown reads UNCHECKED, never
       PASS. */
    /* THE UNCHECKED REASON MUST BE TRUE. This printed "no live price supplied"
       on a card whose own DEAD LEVELS block quoted the live price — the plan
       was what was missing, and a diagnostic that misreports its own inputs
       sends the reader chasing the wrong absence. Three distinct reasons. */
    var lfOk = null, lfWhy = 'no live price supplied — freshness not judged', lfInfo = false;
    var lfPx = x ? fin(x.livePx) : NaN;   /* x may be absent in old harnesses */
    if (isFinite(lfPx) && lfPx > 0 && !(plHas && plObj)){
      lfWhy = 'live price in hand (' + lfPx.toFixed(2) + ') but no plan to judge — see plan-levels';
    }
    if (isFinite(lfPx) && lfPx > 0 && plHas && plObj){
      var lfE = fin(plObj.entry), lfS = fin(plObj.stop);
      if (isFinite(lfE) && isFinite(lfS)){
        var lfAtr = atrOf(rows, 14);
        var lfGap = lfPx - lfE;
        var crossed = (hit.dir === 'short') ? (lfPx >= lfS) : (lfPx <= lfS);
        if (crossed){
          lfOk = false;
          lfWhy = 'DEAD ON ARRIVAL — the market (' + lfPx.toFixed(2) + ') is already '
                + Math.abs(lfPx - lfS).toFixed(0) + ' points beyond the stop ('
                + lfS.toFixed(2) + '): these levels were priced off a closed bar the market has left behind';
        } else if (isFinite(lfAtr) && lfAtr > 0 && Math.abs(lfGap) > 1.5 * lfAtr){
          lfOk = false; lfInfo = true;
          lfWhy = 'entry ' + lfE.toFixed(2) + ' sits ' + Math.abs(lfGap).toFixed(0) + ' points ('
                + (Math.abs(lfGap) / lfAtr).toFixed(1) + '×ATR) from the market (' + lfPx.toFixed(2)
                + ') — a resting-order plan around stale structure, not a market entry';
        } else {
          lfOk = true;
          lfWhy = 'levels within reach of the market (' + lfPx.toFixed(2) + ', '
                + Math.abs(lfGap).toFixed(0) + ' points from entry)';
        }
      }
    }
    gates.push({ key:'level-fresh', hard:false, info: lfInfo, pass: lfOk, why: lfWhy });

    /* FILL RISK — a limit away from market is not a position until it fills.

       CRYPTO MEASUREMENT STUB: The never-fill rates below are from OMNIGOLD's
       backtesting on 1,000 PAXG bars per horizon. These DO NOT apply to crypto
       yet — different asset class, different liquidity, different patterns.
       The desk must calibrate crypto-specific rates by replaying every setup
       this scan forms on crypto candles and asking whether price traded the
       entry inside the horizon. Record the rates here.

       For now: using gold's rates as a placeholder with a loud flag that
       they need crypto-specific calibration. This lets the gate wire in
       and show up on cards without claiming measured truth it does not have.

       Gold's measured rates (1,000 bars per horizon):
         |entry-market|   SCALP never fills   SWING never fills
           0-0.1R              5.3%                0.5%
           0.1-0.25R          14.0%                7.0%
           0.25-0.5R          21.3%               18.7%
           0.5-1R             15.8%               20.3%
           1R+                25.9%               33.6%

       The same replay also showed why this must be DISCLOSED and not assumed
       away: counting away-limits as if they always filled flipped a -0.285R
       population to +0.401R on paper, because the limits that never fill are
       disproportionately the trades where price ran off favourably without you.

       INFO, not a veto. Fill risk is a property of the ORDER, not of the
       setup's quality — the setup may be excellent and simply require the
       patience to miss it one time in five. The read abstains at or through
       market (the order fills now; there is nothing to argue about) and
       argues AGAINST only past 0.25R, where the measured never-fill rate
       crosses one in five on both horizons. */
    var frOk = null, frWhy = 'no plan supplied — fill risk not judged', frGapR = NaN;
    if (plHas && plObj && isFinite(fin(plObj.entry)) && isFinite(fin(plObj.stop))){
      var frE = fin(plObj.entry), frS = fin(plObj.stop), frPx = fin(x.livePx);
      var frRisk = Math.abs(frE - frS);
      if (!isFinite(frPx) || !(frRisk > 0)){
        frWhy = 'no live price this scan — fill risk not judged';
      } else {
        var frAway = (hit.dir === 'long') ? (frE < frPx - 1e-9) : (frE > frPx + 1e-9);
        frGapR = Math.abs(frE - frPx) / frRisk;
        if (!frAway){
          frWhy = 'entry at or through market — the order fills immediately';
        } else if (frGapR <= 0.25){
          frOk = true;
          frWhy = '[CRYPTO STUB: gold rates] limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
                + 'R) from market — near; measured on gold, about 1 in 10 such limits never fills inside the horizon';
        } else {
          frOk = false;
          frWhy = '[CRYPTO STUB: gold rates] limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
                + 'R) from market — measured on gold, at this distance about 1 in '
                + (frGapR >= 1 ? '3' : '5') + ' never fills inside the horizon; the trade may simply not happen';
        }
      }
    } else if (plHas && !plObj){
      frWhy = 'plan declined — nothing to fill';
    }
    gates.push({ key:'fill-risk', hard:false, info:true, pass: frOk, why: frWhy });
    /* Store frGapR on the gates array so forward records can access it */
    if (gates.length > 0){
      gates[gates.length - 1].fillRiskGapR = frGapR;
    }

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
    x = extra || {};   /* already declared above, before the plan gates */

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
    var cons = x.allHits ? hgOmniConsensus(hgOmniConsensusVoters(x.allHits, rows, x), hit) : null;
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
        /* Outnumbering is not immunity. The minority branch below can now
           be rescued by the regime; if this side could still pass on raw
           count, the two directions would ticket TOGETHER — the exact
           contradiction this gate exists to prevent. Both branches read
           the same signal, so exactly one side can win: a majority whose
           regime-favoured family fired ONLY on the other side is the
           chorus that fires against every such regime, and it stands
           aside. */
        var mjReg = null;
        var mjW = (typeof window !== 'undefined') ? window : null;
        var mjFn = (mjW && typeof mjW.detectRegime === 'function') ? mjW.detectRegime : null;
        if (mjFn){ try { var mjR = mjFn(rows); mjReg = mjR ? String(mjR.regime || '') : null; } catch (eMj){ mjReg = null; } }
        var mjFam = /trend/i.test(mjReg || '') ? 'TREND'
                  : /range|chop|mean/i.test(mjReg || '') ? 'REVERSION' : null;
        if (mjFam && cons.against.indexOf(mjFam) >= 0 && cons.agree.indexOf(mjFam) < 0){
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — outnumbers it, but the ' + mjReg + ' regime favours ' + mjFam
                 + ', which fired only on the other side: this majority is the chorus that fires against every '
                 + String(mjReg).toLowerCase();
        } else {
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt;
        }
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
        /* MINORITY READ — but the tie-break's own measurement applies here
           too: in a trending tape the fades fire against the move EVERY
           time, so the continuation family is structurally outnumbered by
           mechanics that add no information. Observed live: the only
           with-trend setup on the tape (MMOVE long, ADX 40 up) vetoed
           1-v-2 by the same fades fade-strength had just rejected as
           invalid in that exact regime — REJECTED SETUPS WERE VOTING.
           Same break as the tie above, same conditions, nothing new to
           game: a clear regime read, the regime's own family on THIS side,
           and not on the other. A minority the regime disowns still
           vetoes, and TREND firing on both sides still cannot be
           separated. */
        var mnReg = null;
        var mnW = (typeof window !== 'undefined') ? window : null;
        var mnFn = (mnW && typeof mnW.detectRegime === 'function') ? mnW.detectRegime : null;
        if (mnFn){ try { var mnR = mnFn(rows); mnReg = mnR ? String(mnR.regime || '') : null; } catch (eMn){ mnReg = null; } }
        var mnFam = /trend/i.test(mnReg || '') ? 'TREND'
                  : /range|chop|mean/i.test(mnReg || '') ? 'REVERSION' : null;
        if (mnFam && cons.agree.indexOf(mnFam) >= 0 && cons.against.indexOf(mnFam) < 0){
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — outnumbered, but the ' + mnReg + ' regime favours ' + mnFam
                 + ' and it fired on this side only: a headcount of mechanics that fire against every '
                 + String(mnReg).toLowerCase() + ' is noise, not disagreement';
        } else {
          con = false;
          conWhy = 'only ' + aTxt + ' vs ' + cons.nAgainst + ' against ('
                 + cons.against.join(', ') + ')' + splitTxt + ' — this is the minority read';
        }
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

    /* The 14 indicator context reads gold has carried since round four —
       ichimoku, donchian, stoch-RSI, Hurst, squeeze, Keltner, structure
       shift, MACD, %B, volume-z, regression slope, value area, htf-confirm
       and regime-fit — shared from hg-gates.js. Info only: they argue,
       never veto, so the mechanic count and its significance bar are
       untouched. A crypto card now carries the same evidence as a gold
       one. */
    (function(){
      var shW = (typeof window !== 'undefined') ? window : null;
      var shFn = (shW && typeof shW.hgIndicatorGates === 'function') ? shW.hgIndicatorGates : null;
      var sh = shFn ? shFn(rows, hit, x, reversion) : null;
      if (sh && sh.length){ for (var si = 0; si < sh.length; si++) gates.push(sh[si]); }
      else gates.push({ key:'context-gates', hard:false, info:true, pass:null,
                        why:'shared context gates unavailable (hg-gates.js not loaded)' });
    })();

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

    /* VOL-TARGET — the size this tape's volatility actually allows.

       Time-series momentum sizes by volatility, and this ledger had no read
       of it: an 8%-a-bar contract and a 1%-a-bar contract graded identically
       on every other gate. Reporting, not sizing — this desk places no
       orders, so it says what the budget implies and leaves the decision. */
    var vtOk = null, vtWhy = 'volatility budget unavailable (too few bars to measure)';
    try {
      var vt = hgOmniVolTarget(rows, {});
      if (vt){
        vtWhy = vt.note;
        if (vt.mult < 0.75){
          vtOk = false;
          vtWhy += ' — over budget, full size here is a bigger bet than the rest of the book';
        } else {
          vtOk = true;
        }
      }
    } catch (eVt){ vtOk = null; vtWhy = 'volatility budget threw: ' + ((eVt && eVt.message) || eVt); }
    gates.push({ key:'vol-target', hard:false, info:true, pass: vtOk, why: vtWhy });

    /* CVD — is the aggressor flow on the side of this trade?

       Real Binance taker data where the contract has a twin, a labelled
       candle approximation everywhere else, so a CoinDCX-only name gets a
       flow read rather than a blank. */
    var cvOk = null, cvWhy = 'CVD unavailable (too few bars)';
    try {
      var cv = hgOmniCvd(rows, 30, x.takerSeries || null);
      if (cv){
        var cvWith = (hit.dir === 'long') ? (cv.delta > 0) : (cv.delta < 0);
        cvWhy = cv.note + ' — flow ' + (cvWith ? 'with' : 'against') + ' the ' + hit.dir;
        if (cv.divergence){
          cvWhy += ' · ' + (cv.divergence === 'bear' ? 'price rising into selling flow'
                                                     : 'price falling into buying flow');
        }
        cvOk = cvWith;
      }
    } catch (eCv){ cvOk = null; cvWhy = 'CVD threw: ' + ((eCv && eCv.message) || eCv); }
    gates.push({ key:'cvd', hard:false, info:true, pass: cvOk, why: cvWhy });

    /* LIQ-MAP — where other people's leverage dies.

       liq-room asks what OUR stop survives. This asks where the market has a
       mechanical reason to travel: a cluster between entry and target is
       fuel, and a stop parked inside one is a stop-hunt waiting to happen. */
    var lmOk = null, lmWhy = 'liquidation map unavailable (too few bars to project clusters)';
    try {
      var lm = hgOmniLiqMap(rows, {});
      if (lm && lm.clusters.length){
        var lmPlan = plHas ? plObj : null;
        var lmE = lmPlan ? fin(lmPlan.entry) : NaN;
        var lmS = lmPlan ? fin(lmPlan.stop) : NaN;
        var lmT = lmPlan ? fin(lmPlan.t1) : NaN;
        lmWhy = lm.clusters.length + ' liquidation cluster(s) projected from recent extremes';
        if (isFinite(lmS)){
          var onStop = null, ci2;
          for (ci2 = 0; ci2 < lm.clusters.length; ci2++){
            if (Math.abs(lm.clusters[ci2].price - lmS) <= lm.tol){ onStop = lm.clusters[ci2]; break; }
          }
          if (onStop){
            lmOk = false;
            lmWhy = 'the stop sits inside a liquidation cluster at ' + onStop.price.toFixed(6)
                  + ' (' + onStop.weight + ' projected liquidations) — stop-hunt risk';
          }
        }
        if (lmOk === null && isFinite(lmE) && isFinite(lmT)){
          var lo2 = Math.min(lmE, lmT), hi2 = Math.max(lmE, lmT), fuel = null, cj;
          for (cj = 0; cj < lm.clusters.length; cj++){
            if (lm.clusters[cj].price > lo2 && lm.clusters[cj].price < hi2){
              if (!fuel || lm.clusters[cj].weight > fuel.weight) fuel = lm.clusters[cj];
            }
          }
          if (fuel){
            lmOk = true;
            lmWhy = 'a liquidation cluster at ' + fuel.price.toFixed(6) + ' (' + fuel.weight
                  + ' projected) lies between entry and T1 — fuel toward the target';
          } else {
            lmOk = true;
            lmWhy += ' — none between entry and T1, and the stop is clear of them';
          }
        }
      }
    } catch (eLm){ lmOk = null; lmWhy = 'liquidation map threw: ' + ((eLm && eLm.message) || eLm); }
    gates.push({ key:'liq-map', hard:false, info:true, pass: lmOk, why: lmWhy });





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

  /* ============ SOLIDITY FEED PRODUCERS (hg-v533) ============

     Two of the 18 stamp pillars were reading fields the scan never produced:

     - hgOmniOrderFlowScore (12 pts) reads extra.orderFlow
       { imbalance, sigma, sustainedBars } and scored 0 on every card
       because nothing anywhere wrote that field;
     - hgOmniRegimeScore (10 pts) reads extra.regime, which pass 2 fills
       with the RISK-ON/RISK-OFF macro composite — a label that pillar's
       TREND/RANGE/COMPRESSION vocabulary can only score 2/10, so the
       pillar sat capped at 2 on every enriched card.

     Both feeds below are TRANSLATIONS of data the scan already fetched or
     already computes — zero new network calls, and every branch that
     cannot be satisfied honestly produces NOTHING, so the pillar scores 0
     (orderFlow) or falls back to hg-v532 behavior (regime). No pillar's
     scoring logic is touched. */

  /* extra.orderFlow from the REAL Binance taker series pass 2 already
     fetched (binanceTakerRatio(base+'USDT','4h',6) — the same object the
     CVD and taker-flow gates read).

     The pillar's contract is an imbalance in sigma units at entry
     (imbalance/sigma thresholds 0.5/1.0/2.0σ) plus a sustained-flow bonus
     (sustainedBars > 5). Honest mapping from 6 windows of buy/sell ratio:

     - per-window imbalance = (r-1)/(r+1), the SAME signed [-1,1] mapping
       hgOmniCvd integrates (a 0.5 ratio must mirror a 2.0 ratio);
     - imbalance = the MEAN per-window imbalance;
     - sigma = the standard error of that mean (sample sd over n-1 df,
       divided by sqrt(n)), so imbalance/sigma is a t-like z with n-1
       degrees of freedom — "how many sigmas from zero flow is the mean
       of what was actually measured";
     - sustainedBars = consecutive most-recent windows (4h each) whose
       sign agrees with the mean — with the scan's 6 windows the +3 bonus
       (needs >5) fires only when ALL SIX agree, i.e. 24h of one-sided
       aggressor flow.

     FAIL-CLOSED branches, each deliberate:
     - fewer than 5 valid windows: no honest dispersion from that little
       data — produce nothing (pillar scores 0 exactly as before);
     - zero dispersion (all windows identical): sigma would be fabricated
       — produce nothing;
     - candle-approximated CVD names (no Binance twin, no takerSeries):
       produce NOTHING. The pillar reads imbalance/sigma with no source
       flag, so anything attached would be scored as if it were aggressor
       flow, and a close-location candle proxy is not a trade tape. Those
       names keep scoring 0 — the honest number.

     KNOWN PILLAR QUIRK (documented, NOT changed — scoring logic is
     frozen): hgOmniOrderFlowScore derives its direction with
       (hit && hit.dir) || (plan && entry > stop) ? 'long' : 'short'
     where || binds tighter than ?:, so any truthy hit.dir reads as
     'long'. The feed stays honestly signed regardless; fixing the
     precedence is a separate change. */
  function hgOmniOrderFlowFeed(ex){
    var pack = ex && ex.takerSeries;
    var series = pack && pack.series;
    if (!series || !series.length) return null;
    var imbs = [], i, r;
    for (i = 0; i < series.length; i++){
      r = fin(series[i] && series[i].buySellRatio);
      if (!isFinite(r) || r <= 0) continue;
      imbs.push((r - 1) / (r + 1));
    }
    var n = imbs.length;
    if (n < 5) return null;
    var mean = 0;
    for (i = 0; i < n; i++) mean += imbs[i];
    mean /= n;
    var ss = 0, d;
    for (i = 0; i < n; i++){ d = imbs[i] - mean; ss += d * d; }
    var sd = Math.sqrt(ss / (n - 1));
    /* AUDIT FIX (hg-v533): sd <= 0 alone does NOT catch all-identical
       windows — summing six equal doubles leaves ~1e-17 of floating-point
       residue in ss (e.g. six 1.1 ratios -> sd 3e-18), which turned the
       documented "zero dispersion -> produce nothing" branch into a
       fabricated sigma and a 1e16-sigma z scoring 12/12. Imbalances live in
       [-1,1] and the smallest REAL dispersion Binance's 4-decimal ratios
       can produce is ~1e-7, while summation noise sits at ~1e-17; 1e-9
       separates the two by eight orders of magnitude each way. */
    if (!isFinite(sd) || sd < 1e-9) return null;
    var se = sd / Math.sqrt(n);
    if (!isFinite(se) || se <= 0) return null;
    var want = mean > 0 ? 1 : (mean < 0 ? -1 : 0);
    var sustained = 0;
    if (want !== 0){
      for (i = n - 1; i >= 0; i--){
        if ((imbs[i] > 0 ? 1 : (imbs[i] < 0 ? -1 : 0)) !== want) break;
        sustained++;
      }
    }
    return {
      imbalance: mean,
      sigma: se,
      sustainedBars: sustained,
      windows: n,
      source: 'binance-taker',
      note: 'mean per-window taker imbalance over ' + n + ' Binance 4h windows; '
          + 'sigma is the standard error of that mean (z = imbalance/sigma, '
          + (n - 1) + ' df)'
    };
  }

  /* extra.regimeStruct from the STRUCTURAL regime read the scan already
     computes — the same detectRegime() call behind the regime-fit context
     gate and the consensus tie-break ('STRONG TREND' / 'WEAK TREND' /
     'RANGE' / 'COMPRESSION' / 'VOLATILE EXPANSION' on the scan tape).

     Translation to the pillar's vocabulary rides on detectRegime's
     MACHINE name (rg.regime), not on parsing its display label:
     - 'trend'       -> 'TREND'        (pillar: 10 with a directional setup)
     - 'range'       -> 'RANGE'        (pillar: 7)
     - 'compression' -> 'COMPRESSION'  (pillar: 5)
     - 'weak_trend' / 'volatile' keep their raw display labels
       ('WEAK TREND' / 'VOLATILE EXPANSION'), which the pillar scores 2 —
       correct: a default/no-clear-regime read and a volatility blowout
       are exactly the "mismatch or unknown" caution cases;
     - 'unknown' (DATA THIN), a missing detectRegime, thin rows, or a
       throw produce NOTHING (fail-closed -> hg-v532 behavior).

     A NEW field, deliberately: extra.regime must keep carrying the
     RISK-ON/RISK-OFF macro composite for the regime gate, P5.1's market
     bias and P5.2's btc-daily-proxy leg — those consumers are untouched. */
  function hgOmniRegimeStructFeed(rows){
    var w = (typeof window !== 'undefined') ? window : null;
    var fn = (w && typeof w.detectRegime === 'function') ? w.detectRegime : null;
    if (!fn || !rows || rows.length < 60) return null;
    var rg = null;
    try { rg = fn(rows); } catch (eRg){ return null; }
    if (!rg || !rg.regime) return null;
    var name = String(rg.regime).toLowerCase();
    var label = null;
    if (name === 'trend') label = 'TREND';
    else if (name === 'range') label = 'RANGE';
    else if (name === 'compression') label = 'COMPRESSION';
    else if (name === 'weak_trend' || name === 'volatile'){
      label = String(rg.label || name).toUpperCase();
    } else {
      return null;
    }
    return { regime: name, label: label, rawLabel: rg.label || null, source: 'detectRegime' };
  }

  /* Attach both feeds to the SHARED enrichment object. Called once per
     symbol at the top of hgOmniEvaluate, so the fields ride the same `ex`
     both stamp sites read: the evaluate-site stamp copies ex into
     exForHit, and the late card-render stamp copies the SAME exBySym
     entry into lsExHit — one producer covers both with no further
     plumbing. Never overwrites a field a caller already supplied; never
     throws. */
  function hgOmniAttachSolidityFeeds(rows, ex){
    if (!ex) return;
    try {
      if (!ex.orderFlow){
        var of = hgOmniOrderFlowFeed(ex);
        if (of) ex.orderFlow = of;
      }
    } catch (eOf) {}
    try {
      if (!ex.regimeStruct){
        var rs = hgOmniRegimeStructFeed(rows);
        if (rs) ex.regimeStruct = rs;
      }
    } catch (eRs) {}
  }

  /* ============ end solidity feed producers ============ */

  /* Whole per-symbol evaluation: detectors -> gates -> plan. Pure given
     rows; hgPlanLevels is looked up defensively and NaN-safe. */
  function hgOmniEvaluate(item, rows, positioning, extra){
    var hits = hgOmniDetect(rows, positioning, (extra && extra.xs) || null, item && item.sym), out = [], i;
    var house = [];
    try { house = hgOmniHouseHits(rows, item, extra) || []; } catch (eH) { house = []; }
    if (house.length){
      var seenHit = {}, hi;
      for (hi = 0; hi < hits.length; hi++){
        if (hits[hi] && hits[hi].kind) seenHit[hits[hi].kind + ':' + hits[hi].dir] = true;
      }
      for (hi = 0; hi < house.length; hi++){
        var hk = house[hi] && (house[hi].kind + ':' + house[hi].dir);
        if (!hk || seenHit[hk]) continue;
        seenHit[hk] = true;
        hits.push(house[hi]);
      }
    }
    /* SOLIDITY FEED PRODUCERS (hg-v533) — attach orderFlow/regimeStruct to
       the shared enrichment BEFORE any stamping, from data already in hand
       (takerSeries pass 2 fetched; detectRegime on the scan rows). Mutating
       `extra` here is the established pattern (quietGates below does the
       same) and is what lets the late card-render stamp see the fields via
       the same exBySym entry. Fail-closed: absent data attaches nothing. */
    extra = extra || {};
    try { hgOmniAttachSolidityFeeds(rows, extra); } catch (eFeeds) {}
    if (!hits.length){
      /* No engine named a trade. Do not invent a ticket — but still run
         the indicator ledger on this name so quiet contracts are not a
         skipped half of the book. */
      extra = extra || {};
      try {
        var qLast = rows[rows.length - 1];
        var qPx = fin(qLast && qLast.c);
        var qDir = 'long';
        try {
          var qCl = closesOf(rows);
          var qE = emaOf(qCl.slice(-60), 21);
          if (isFinite(qPx) && isFinite(qE) && qPx < qE) qDir = 'short';
        } catch (eDir) {}
        extra.quietGates = hgOmniGates(rows, {
          kind: 'QUIET', dir: qDir,
          level: (isFinite(qPx) && qPx > 0) ? qPx : 1,
          why: 'no engine fired — indicator ledger only, not a ticket',
          extra: true
        }, positioning, extra);
      } catch (eQ) { extra.quietGates = extra.quietGates || []; }
      return out;
    }
    var planFn = (typeof window !== 'undefined' && typeof window.hgPlanLevels === 'function')
      ? window.hgPlanLevels : null;
    /* 20X SECTION INPUT — the 1h ATR as % of the last 1h close, captured
       HERE because the raw 1h bars (extra.rows1h, pass-2 enrichment) are
       released after grading and the 20x noise gate runs at render time. A
       compact scalar rides every candidate instead of an array of candles.
       Null when the name was past the enrichment ceiling or 1h bars are
       thin — the 20x gate treats that as a FAIL, never a pass. */
    var atr1hPct = null;
    try {
      var r1h20 = (extra && extra.rows1h && extra.rows1h.length) ? extra.rows1h : null;
      if (r1h20 && r1h20.length >= 15){
        var a1h20 = atrOf(r1h20, 14);
        var c1h20 = fin(r1h20[r1h20.length - 1].c);
        if (isFinite(a1h20) && isFinite(c1h20) && c1h20 > 0) atr1hPct = a1h20 / c1h20 * 100;
      }
    } catch (eA20) { atr1hPct = null; }
    for (i = 0; i < hits.length; i++){
      try {
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
      exForHit.minRr = MIN_RR;
      /* PLAN BEFORE GATES. The ledger could not see the stop it was judging:
         plan was derived after the gates ran, so no gate could say anything
         about how wide it is. A live card read "risk 13.33%" in exactly the
         same weight as one reading "risk 0.86%", and those are not the same
         trade. Gold has run in this order since the cost-drag gate landed for
         the same reason.

         The printed trade IS the mechanic. Passing undefined as the entry
         priced last close + enrichers, so an ORB/FVG/VALUE at a named level
         printed a different ENTRY. hgOmniPlanForHit tickets hit.level. */
      var plan = null;
      if (planFn){
        try { plan = hgOmniPlanForHit(hit, rows, exForHit); }
        catch (e) { plan = null; }
      }
      if (plan) plan = hgOmniDerivePlan(plan);
      /* Attach the plan key ONLY when a plan engine exists. plan-levels
         distinguishes 'the engine ran and produced nothing' (an explicit
         null — a veto) from 'no engine was ever loaded' (no key — UNCHECKED),
         and setting null here unconditionally collapsed the two: every
         harness without plans.js loaded had its whole desk vetoed. */
      if (planFn) exForHit.plan = plan;
      var gates = hgOmniGates(rows, hit, positioning, exForHit);
      var grade = hgOmniGrade(gates);
      /* The global hgPlanLevels wrapper (index.html) forwards only
         {dir,entry,stop,t1,t2,risk,note,...} — it DROPS rr1/rr2/riskPct from
         hgPlanLevelsCore. Reading plan.rr1 therefore gave undefined, which
         rendered as "R:R —" and, worse, made hgOmniRank sort every card by
         NaN: the tab claimed to order by R:R while ordering by nothing.
         Derive both from fields the wrapper does provide. */
      var livePx = fin(exForHit.livePx);
      var atrNow = atrOf(rows, 14);
      var distAtr = 99;
      if (plan && isFinite(fin(plan.entry)) && isFinite(livePx) && isFinite(atrNow) && atrNow > 0){
        distAtr = Math.abs(livePx - fin(plan.entry)) / atrNow;
      }
      /* 20X RE-PLAN — computed HERE because the raw 1h bars (extra.rows1h)
         are only in scope during evaluation; they are released after grading
         and the 20X section renders later from the candidate list alone.
         Tickets with a finite plan only: the re-plan is a fallback GEOMETRY
         for the 20X section (a tighter 1h-structure stop in the safe band),
         never a new trade idea. Null when no in-band structure exists. */
      var x20plan = null;
      try {
        if (grade && grade.ticket === true && plan){
          x20plan = hgOmni20xReplan(plan, hit.dir,
            (extra && extra.rows1h && extra.rows1h.length) ? extra.rows1h : null);
        }
      } catch (eX20p) { x20plan = null; }
      /* FULL-DATA SOLIDITY STAMP — scored HERE, not at render, because the
         inputs most pillars read (bars, htf, oi, positioning, regime,
         btcRegime, news, per-mechanic stats) are only in scope during
         evaluation: held[j].rows is released after grading and the candidate
         carries `extra` as a BOOLEAN (hit.extra), so the render-time rebuild
         saw rows:null / extra:null, starving 13 of the 18 pillars — every
         live card read ~29-41/200 WEAK regardless of quality.
         SCOPE: tickets only, at this site. The full score costs ~2.3-3.9 ms
         per call (see hgOmniSolidityStamp) and most of the 1131 candidates
         never display one; renderable NON-tickets get their late stamp in
         the card render pass, where the enrichment map is still alive.
         exForHit is the REAL per-hit enrichment (htf, oi, positioning,
         regime, btcRegime, news, ticker, per-mechanic stats) — not a
         field-stripping copy. Stamping failure = null, never a throw. */
      var solidity = (grade && grade.ticket === true && plan)
        ? hgOmniSolidityStamp(hit, plan, rows, exForHit, positioning)
        : null;
      out.push({
        sym: item && item.sym, base: item && item.base, exchange: item && item.exchange,
        kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        extra: hit.extra === true,
        /* The conviction roster's formation-time certificate rides the
           candidate so the card can print it. Mechanics that do not emit one
           carry null and render nothing new — the chip is opt-in by data. */
        conviction: (hit.conviction && typeof hit.conviction === 'object') ? hit.conviction : null,
        /* Full-data solidity, scored above while rows1h/enrichment were in
           scope. {score, maxScore, tier, detail} or null. Render paths
           prefer this over their starved recompute. */
        solidity: solidity,
        gates: gates, grade: grade, plan: plan, distAtr: distAtr,
        /* 1h ATR% scalar for the 20X section's noise gate — see above. */
        atr1hPct: atr1hPct,
        /* Tighter 1h-structure stop for the 20X section, or null. Stamped
           here because rows1h does not ride the candidate. */
        x20plan: x20plan,
        /* Carried so hgOmniRank can put the setup the rest of the scan agrees
           with above the one nothing supports. */
        consensus: hgOmniConsensus(hgOmniConsensusVoters(hits, rows, exForHit), hit),
        family: hgOmniFamilyOf(hit.kind),
        rr: (plan && isFinite(fin(plan.rr1))) ? fin(plan.rr1) : NaN
      });
      } catch (eHit) {
        try { console.warn('omniroute evaluate skipped', item && item.sym, hits[i] && hits[i].kind, eHit); } catch (eHit2) {}
      }
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

  var OMNI_NEAR_ATR = 2;
  var OMNI_MP_MAX = 3;

  function omniGfn(name){
    var w = (typeof window !== 'undefined') ? window : null;
    return (w && typeof w[name] === 'function') ? w[name] : null;
  }

  function hgOmniHouseHit(kind, raw, why){
    if (!raw || typeof raw !== 'object') return null;
    var dir = String(raw.dir || '').toLowerCase();
    if (dir === 'buy' || dir === 'l') dir = 'long';
    if (dir === 'sell' || dir === 's') dir = 'short';
    if (dir !== 'long' && dir !== 'short') return null;
    var lvl = fin(raw.entry);
    if (!isFinite(lvl) || !(lvl > 0)) lvl = fin(raw.level);
    if (!isFinite(lvl) || !(lvl > 0)) lvl = fin(raw.mark);
    if (!isFinite(lvl) || !(lvl > 0)) return null;
    return { kind: kind, dir: dir, level: lvl, why: why || ('house ' + kind), extra: true };
  }

  /* Extra house strategies, pointed at every scanned contract, not only
     ones that already fired a candle mechanic. Feature-checked, never
     7/7 CLEAN, never invent levels — they name a direction and a level,
     then the same ledger prices the ticket. */
  function hgOmniHouseHits(rows, item, extra){
    extra = extra || {};
    var out = [], last, fn, raw, daily, ticker, px;
    if (!rows || rows.length < 40) return out;
    last = rows[rows.length - 1];
    px = fin(last && last.c);
    ticker = extra.ticker || item || null;
    function push(h){
      if (h && h.kind && (h.dir === 'long' || h.dir === 'short') && isFinite(fin(h.level)) && fin(h.level) > 0){
        h.extra = true;
        out.push(h);
      }
    }
    fn = omniGfn('edgeSignal');
    if (fn){ try { push(hgOmniHouseHit('EDGE', fn(rows), 'EDGE pullback — extra vote, not 7/7 CLEAN')); } catch (e1) {} }
    fn = omniGfn('mrSignal');
    if (fn){
      try {
        raw = fn(rows);
        if (raw && raw.target && raw.t1 == null) raw.t1 = raw.target;
        push(hgOmniHouseHit('MR', raw, 'mean reversion — extra vote, not 7/7 CLEAN'));
      } catch (e2) {}
    }
    fn = omniGfn('squeezeClassify');
    if (fn && isFinite(px)){
      try {
        daily = extra.htfRows || extra.daily || hgOmniResample(rows, 86400);
        raw = fn(rows, daily);
        if (raw && raw.state === 'FIRED_LONG')
          push({ kind:'HOUSE-SQUEEZE', dir:'long', level: px, why:'TTM squeeze fire long — extra vote, not 7/7 CLEAN', extra:true });
        else if (raw && raw.state === 'FIRED_SHORT')
          push({ kind:'HOUSE-SQUEEZE', dir:'short', level: px, why:'TTM squeeze fire short — extra vote, not 7/7 CLEAN', extra:true });
      } catch (e3) {}
    }
    fn = omniGfn('rsAssess');
    if (fn){ try { push(hgOmniHouseHit('SNIPER', fn(rows, {}), 'reversal sniper — extra vote, not 7/7 CLEAN')); } catch (e4) {} }
    fn = omniGfn('swingTryClean');
    if (fn){
      try {
        raw = fn(rows, ticker);
        if (raw) raw = { dir: raw.dir, entry: raw.entry, stop: raw.stop, t1: raw.t1, mark: raw.mark };
        push(hgOmniHouseHit('SWING', raw, 'house SWING path — extra vote, never 7/7 on this desk'));
      } catch (e5) {}
    }
    fn = omniGfn('scalpTryClean');
    if (fn && extra.rows1h && extra.rows15m){
      try {
        raw = fn(extra.rows1h, extra.rows15m, ticker, extra.minsToFunding);
        if (raw) raw = { dir: raw.dir, entry: raw.entry, stop: raw.stop, t1: raw.t1 };
        push(hgOmniHouseHit('SCALP', raw, 'house SCALP path — extra vote, never 7/7 on this desk'));
      } catch (e6) {}
    }
    fn = omniGfn('swingTryFundingFade');
    if (fn){ try { push(hgOmniHouseHit('FUND-FADE', fn(rows, ticker), 'funding fade — extra vote, not 7/7 CLEAN')); } catch (e7) {} }
    fn = omniGfn('scalpTryFundingFade');
    if (fn && extra.rows1h && extra.rows15m){
      try { push(hgOmniHouseHit('FUND-FADE', fn(extra.rows1h, extra.rows15m, ticker, extra.minsToFunding), 'scalp funding fade — extra vote, not 7/7 CLEAN')); } catch (e8) {}
    }
    try {
      var bbFn = omniGfn('bollinger'), vzFn = omniGfn('volZ'), emaFn = omniGfn('ema');
      if (bbFn && vzFn && emaFn && rows.length >= 80){
        var closes = closesOf(rows);
        var bb = bbFn(closes, 20, 2);
        var width = bb && bb.widthPct ? fin(bb.widthPct[closes.length - 1]) : NaN;
        var past = bb && bb.widthPct ? bb.widthPct.slice(-51, -1).filter(isFinite) : [];
        var avgW = past.length ? past.reduce(function(a, b){ return a + b; }, 0) / past.length : NaN;
        var vz = vzFn(rows, 20);
        var em = emaFn(closes, 200);
        var e200 = (em && em.length) ? fin(em[em.length - 1]) : fin(em);
        if (isFinite(width) && isFinite(avgW) && width < avgW * 0.75 && isFinite(vz) && vz < -0.5
            && isFinite(px) && isFinite(e200)){
          var ci, cl, ch;
          if (px > e200){
            var coilLow = Infinity;
            for (ci = Math.max(0, rows.length - 20); ci < rows.length; ci++){
              cl = fin(rows[ci].l); if (isFinite(cl) && cl < coilLow) coilLow = cl;
            }
            if (isFinite(coilLow) && coilLow !== Infinity)
              push({ kind:'COIL', dir:'long', level: coilLow, why:'BB squeeze · volume drought · above 200 EMA — extra vote, not 7/7 CLEAN', extra:true });
          } else if (px < e200){
            var coilHigh = -Infinity;
            for (ci = Math.max(0, rows.length - 20); ci < rows.length; ci++){
              ch = fin(rows[ci].h); if (isFinite(ch) && ch > coilHigh) coilHigh = ch;
            }
            if (isFinite(coilHigh) && coilHigh !== -Infinity)
              push({ kind:'COIL', dir:'short', level: coilHigh, why:'BB squeeze · volume drought · below 200 EMA — extra vote, not 7/7 CLEAN', extra:true });
          }
        }
      }
    } catch (eC) {}
    try {
      var bbFn2 = omniGfn('bollinger'), atrFn = omniGfn('atr');
      if (bbFn2 && atrFn && rows.length >= 50 && isFinite(px) && px > 0){
        var c2 = closesOf(rows);
        var at = atrFn(rows, 14);
        var a14 = (at && at.length) ? fin(at[at.length - 1]) : fin(at);
        if (isFinite(a14) && a14 > 0){
          var bbO = bbFn2(c2, 20, 3);
          var bbI = bbFn2(c2, 20, 2);
          var lO = bbO && bbO.lower ? fin(bbO.lower[c2.length - 1]) : NaN;
          var lI = bbI && bbI.lower ? fin(bbI.lower[c2.length - 1]) : NaN;
          var uO = bbO && bbO.upper ? fin(bbO.upper[c2.length - 1]) : NaN;
          var uI = bbI && bbI.upper ? fin(bbI.upper[c2.length - 1]) : NaN;
          var sweptLo = false, sweptHi = false, k2;
          for (k2 = Math.max(0, rows.length - 4); k2 < rows.length; k2++){
            if (isFinite(lO) && fin(rows[k2].l) < lO) sweptLo = true;
            if (isFinite(uO) && fin(rows[k2].h) > uO) sweptHi = true;
          }
          if (sweptLo && isFinite(lI) && px > lI)
            push({ kind:'TRAP', dir:'long', level: px, why:'outer-band sweep reclaim — extra vote, not 7/7 CLEAN', extra:true });
          else if (sweptHi && isFinite(uI) && px < uI)
            push({ kind:'TRAP', dir:'short', level: px, why:'outer-band sweep reject — extra vote, not 7/7 CLEAN', extra:true });
        }
      }
    } catch (eT) {}
    fn = omniGfn('pineSmcCore');
    if (fn){ try { push(hgOmniHouseHit('SMC', fn(rows), 'SMC ChoCh — extra vote, not 7/7 CLEAN')); } catch (eS) {} }
    return out;
  }

  function hgOmniInfoNet(gates){
    var pass = 0, fail = 0, n = 0, i, g;
    for (i = 0; i < (gates || []).length; i++){
      g = gates[i];
      if (!g || g.info !== true) continue;
      n++;
      if (g.pass === true) pass++;
      else if (g.pass === false) fail++;
    }
    return { pass: pass, fail: fail, net: pass - fail, n: n };
  }

  /* Composite rank, not a probability. Strategy families and indicator
     reads share the scale so 40 mechanics cannot drown ~20 oscillators. */
  function hgOmniBalanceParts(c, tape){
    var cons = (c && c.consensus) || {};
    var nAgree = cons.nAgree || 0;
    var nAgainst = cons.nAgainst || 0;
    var nSplit = cons.nSplit || 0;
    var famDen = nAgree + nAgainst + nSplit;
    var family = famDen ? (nAgree - nAgainst) / famDen : 0;
    var info = hgOmniInfoNet(c && c.gates);
    var infoRatio = info.n ? (info.net / info.n) : 0;
    var tot = (c && c.grade && c.grade.total) || 0;
    var ev = (c && c.grade && c.grade.evaluated) || 0;
    var coverage = tot ? (ev / tot) : 0;
    var also = (c && c.alsoKinds && c.alsoKinds.length) ? c.alsoKinds.length : 0;
    var alsoNorm = Math.min(also, 4) / 4;
    var dist = (c && isFinite(fin(c.distAtr))) ? fin(c.distAtr) : 99;
    var near = 1;
    if (isFinite(dist) && dist > OMNI_NEAR_ATR){
      near = Math.max(0, 1 - (dist - OMNI_NEAR_ATR) / 4);
    }
    var dir = String((c && c.dir) || '').toLowerCase();
    var tapeDir = String(tape || '').toLowerCase();
    var tapeScore = 0;
    if (tapeDir === 'long' || tapeDir === 'short'){
      tapeScore = (dir === tapeDir) ? 1 : -1;
    }
    var ticketN = (c && c.grade && c.grade.ticket) ? 1 : 0;
    var score = 100 * tapeScore
              + 120 * ticketN
              + 30 * family
              + 30 * infoRatio
              + 12 * coverage
              + 10 * alsoNorm
              + 10 * near;
    return {
      score: score, family: family, infoRatio: infoRatio, coverage: coverage,
      alsoNorm: alsoNorm, near: near, tapeScore: tapeScore,
      ticket: ticketN, info: info, dist: dist,
      nAgree: nAgree, nAgainst: nAgainst
    };
  }
  function hgOmniBalanceScore(c, tape){
    return hgOmniBalanceParts(c, tape).score;
  }

  function hgOmniDeskOrder(list, tape){
    var tapeDir = String(tape || '').toLowerCase();
    return (list || []).slice().sort(function(a, b){
      if (!!a.topPick !== !!b.topPick) return a.topPick ? -1 : 1;
      var sa = hgOmniBalanceScore(a, tapeDir);
      var sb = hgOmniBalanceScore(b, tapeDir);
      if (sb !== sa) return sb - sa;
      var da = isFinite(fin(a.distAtr)) ? a.distAtr : 99;
      var db = isFinite(fin(b.distAtr)) ? b.distAtr : 99;
      if (da !== db) return da - db;
      return String(a.sym || a.kind || '') < String(b.sym || b.kind || '') ? -1 : 1;
    });
  }

  function hgOmniPickFew(list, tape, limit){
    tape = String(tape || '').toLowerCase();
    limit = Math.max(1, Math.min(5, Math.floor(fin(limit) || OMNI_MP_MAX)));
    if (tape !== 'long' && tape !== 'short') return [];
    var pool = [], heldCards = [], i, c, seen = {}, heldSeen = {};
    var ranked = hgOmniDeskOrder(list || [], tape);
    for (i = 0; i < ranked.length; i++){
      c = ranked[i];
      if (!c || !c.plan || !(c.grade && c.grade.ticket)) continue;
      if (String(c.dir || '').toLowerCase() !== tape){
        var hSym = String(c.sym || c.base || '');
        if (hSym && !heldSeen[hSym]){
          heldSeen[hSym] = true;
          heldCards.push(c);
        }
        continue;
      }
      var sym = String(c.sym || c.base || '');
      if (!sym || seen[sym]) continue;
      seen[sym] = true;
      pool.push(c);
      if (pool.length >= limit) break;
    }
    pool.heldCards = heldCards;
    return pool;
  }

  function hgOmniSideTape(sideRead){
    if (!sideRead) return '';
    if (sideRead.side === 'long' || sideRead.side === 'short') return sideRead.side;
    return '';
  }

  function hgOmniMpNoneWhy(tape, held){
    var base;
    if (tape === 'short')
      base = 'crypto tape is short — a LONG is not the setup. Standing aside is the position when no short ticket cleared.';
    else if (tape === 'long')
      base = 'crypto tape is going up — a SHORT is not the setup. Standing aside is the position when no long ticket cleared.';
    else
      base = 'no side to take until tape and sentiment agree. Standing aside is the position.';
    if (!held || !held.n) return base;
    var side = (tape === 'short') ? 'LONG' : 'SHORT';
    var s = base + ' ' + held.n + ' ticket' + (held.n === 1 ? '' : 's')
          + ' cleared the ledger and ' + (held.n === 1 ? 'is' : 'are') + ' HELD — all '
          + side + ' while the tape reads ' + String(tape).toUpperCase() + '.';
    s += ' They release if sentiment flips away from ' + String(tape).toUpperCase() + '.';
    return s;
  }

  function hgOmniMpOneHtml(c){
    var h = '<div class="og-mp-hz">';
    if (c && c.plan){
      var p = c.plan;
      var ev = (c.grade && c.grade.evaluated) || 0;
      var tot = (c.grade && c.grade.total) || 0;
      var grade = tot ? (ev + '/' + tot + ' TICKET') : 'TICKET';
      var info = hgOmniInfoNet(c.gates);
      var cons = c.consensus || {};
      var nAg = cons.nAgree || 0;
      var fam = nAg + ' famil' + (nAg === 1 ? 'y agrees' : 'ies agree');
      var ind = info.n ? (info.pass + '/' + info.n + ' indicators with') : 'indicators unread';
      h += '<div class="hg-mp-head">' + esc(String(c.sym || c.base || '')) + ' ' + esc(String(c.dir || '').toUpperCase())
        +  ' <span>' + esc(c.kind) + ' · ' + esc(grade) + '</span></div>';
      h += '<div class="hg-mp-note">' + esc(fam) + ' · ' + esc(ind)
        +  ' · WITH TAPE · not a win probability.</div>';
      h += '<div class="hg-mp-grid">';
      h += '<div><i>ENTRY</i><b>' + fmtPx(p.entry) + '</b><u>' + (String(c.dir).toLowerCase() === 'short' ? 'SELL ZONE' : 'BUY ZONE') + '</u></div>';
      h += '<div><i>STOP</i><b>' + fmtPx(p.stop) + '</b><u>invalidation</u></div>';
      h += '<div><i>T1</i><b>' + fmtPx(p.t1) + '</b><u>take profit</u></div>';
      h += '<div><i>T2</i><b>' + (isFinite(fin(p.t2)) ? fmtPx(p.t2) : '—') + '</b><u>runner</u></div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function hgOmniMostProbablePanelHtml(few, tape, held){
    few = few || [];
    tape = String(tape || '').toLowerCase();
    var any = false, i;
    for (i = 0; i < few.length; i++) if (few[i] && few[i].plan) any = true;
    var tier = any ? 'clean' : 'forming';
    var note = any
      ? 'Balanced across mechanic families and indicator reads on the crypto tape. Tickets only. Not a win probability.'
      : hgOmniMpNoneWhy(tape, held);
    var h = '<section class="hg-mp" data-hg-mp="omniroute" data-omni-mp="1" data-tier="' + tier + '" aria-label="Most probable crypto setups">';
    h += '<div class="hg-mp-eye">MOST PROBABLE SETUPS</div>';
    h += '<div class="hg-mp-head">OMNIROUTE';
    if (tape === 'long' || tape === 'short') h += ' ' + tape.toUpperCase();
    h += ' <span>';
    if (!any && (tape === 'long' || tape === 'short')) h += tape + ' tape · stand aside · ';
    h += 'strategies + indicators, balanced · not a win probability</span></div>';
    h += '<div class="hg-mp-note">' + esc(note) + '</div>';
    if (any){
      for (i = 0; i < few.length; i++) h += hgOmniMpOneHtml(few[i]);
    } else {
      h += '<div class="og-mp-hz"><div class="hg-mp-head">STAND ASIDE <span>no tape-aligned ticket</span></div>';
      h += '<div class="hg-mp-note">' + esc(hgOmniMpNoneWhy(tape, held)) + '</div></div>';
    }
    h += '</section>';
    return h;
  }

  function hgOmniMpRow(c){
    if (!c || !c.plan) return null;
    if (!(c.grade && c.grade.ticket)) return null;
    return {
      sym: c.sym, dir: c.dir,
      entry: c.plan.entry, stop: c.plan.stop, t1: c.plan.t1, t2: c.plan.t2,
      rr: c.plan.rr1, clean: false, confirmed: true,
      gatesPassed: (c.grade && c.grade.evaluated) || 0,
      gatesTotal: (c.grade && c.grade.total) || 0,
      venue: c.exchange, kind: c.kind, plan: c.plan, grade: c.grade, consensus: c.consensus
    };
  }

  function hgOmniPaintMostProbable(ui, few, tape, mpBag, held){
    var host = (ui && ui.mp) || (ui && ui.cards);
    if (!host) return;
    try {
      var wPin = (typeof window !== 'undefined') ? window : null;
      if (wPin && typeof wPin.hgMpPin === 'function') wPin.hgMpPin('omniroute', mpBag || [], tape || null, host);
    } catch (eMp) {}
    try {
      var dual = hgOmniMostProbablePanelHtml(few, tape, held);
      var oldMp = host.querySelector ? host.querySelector('[data-hg-mp]') : null;
      if (!dual) return;
      if (oldMp) oldMp.outerHTML = dual;
      else if (host.insertAdjacentHTML) host.insertAdjacentHTML('afterbegin', dual);
      else host.innerHTML = dual + (host.innerHTML || '');
    } catch (eDual) {}
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
      { key:'measured_move',    label:'measured move projection',         tabs:['OMNIROUTE'] },
      /* The last three holes this table used to print as STILL MISSING. */
      { key:'vol_targeting',    label:'volatility targeting (size by realized vol)', tabs:['OMNIROUTE'] },
      { key:'cvd',              label:'cumulative volume delta (taker series, candle approx fallback)', tabs:['OMNIROUTE'] },
      { key:'liquidation_map',  label:'liquidation cluster map (leverage projection)', tabs:['OMNIROUTE'] }
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
    /* These three used to live here ONLY — nameable by the extractor, with
       no gate behind them. They are implemented now and registered in the
       inventory above, so the list is a safety net against a roster key
       losing its gate, not a stand-in for one. */
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

  /* Desk side — TAKE LONGS / TAKE SHORTS / STAND ASIDE.
     Two gates, no composite score. Tape is the MARKET PICTURE majority
     (4H EMA cascade on BTC/ETH/SOL/GOLD). Sentiment is BIAS S2 Fear & Greed
     (block fresh longs ≥80, fresh shorts ≤20). A missing F&G is UNCHECKED,
     not a silent pass, and does not veto a clear tape. Extreme sentiment
     stands you aside — it does not flip you to the other side. */
  var OMNI_FNG_LONG_VETO = 80;
  var OMNI_FNG_SHORT_VETO = 20;
  function hgOmniMarketSide(picture, fng){
    picture = picture || {};
    var longs = +picture.longs || 0;
    var shorts = +picture.shorts || 0;
    var mixed = +picture.mixed || 0;
    var total = longs + shorts + mixed;
    var tape = 'mixed';
    var tapePass = null;
    var tapeWhy = 'market picture not read yet — no side until the 4H cascade is in';
    if (total > 0){
      if (longs > shorts && longs >= Math.ceil(total / 2) + 1) tape = 'long';
      else if (shorts > longs && shorts >= Math.ceil(total / 2) + 1) tape = 'short';
      tapePass = tape !== 'mixed';
      tapeWhy = (tape === 'long' ? 'LONG-LEANING' : tape === 'short' ? 'SHORT-LEANING' : 'MIXED — no clear lean')
              + ' (' + longs + ' long · ' + shorts + ' short · ' + mixed + ' mixed of ' + total
              + ' — 4H EMA cascade on BTC/ETH/SOL/GOLD, same majority as MARKET PICTURE)';
    } else if (picture.verdict){
      var v = String(picture.verdict).toUpperCase();
      if (v.indexOf('LONG-LEANING') >= 0) tape = 'long';
      else if (v.indexOf('SHORT-LEANING') >= 0) tape = 'short';
      tapePass = tape !== 'mixed';
      tapeWhy = String(picture.verdict);
    }
    var fv = (fng && isFinite(+fng.v)) ? +fng.v : null;
    var sentPass = null;
    var sentWhy = 'F&G unavailable — sentiment not read, not a pass';
    if (fv !== null){
      var lab = fng.c ? (' ' + fng.c) : '';
      if (tape === 'long' && fv >= OMNI_FNG_LONG_VETO){
        sentPass = false;
        sentWhy = fv + lab + ' — BIAS S2 blocks fresh longs at ≥' + OMNI_FNG_LONG_VETO;
      } else if (tape === 'short' && fv <= OMNI_FNG_SHORT_VETO){
        sentPass = false;
        sentWhy = fv + lab + ' — BIAS S2 blocks fresh shorts at ≤' + OMNI_FNG_SHORT_VETO;
      } else {
        sentPass = true;
        sentWhy = fv + lab + ' — not extreme against this side (longs veto ≥'
                + OMNI_FNG_LONG_VETO + ', shorts veto ≤' + OMNI_FNG_SHORT_VETO + ')';
      }
    }
    var side = 'aside';
    var headline = 'STAND ASIDE';
    if (tapePass === true && sentPass !== false){
      side = tape;
      headline = tape === 'long' ? 'TAKE LONGS' : 'TAKE SHORTS';
    }
    return {
      side: side, headline: headline, tape: tape,
      longs: longs, shorts: shorts, mixed: mixed, total: total, fng: fv,
      gates: [
        { key: 'tape', pass: tapePass, hard: true, why: tapeWhy },
        { key: 'sentiment', pass: sentPass, hard: true, why: sentWhy }
      ]
    };
  }
  function hgOmniMarketSideHtml(read, opts){
    if (!read) return '';
    opts = opts || {};
    var cls = read.side === 'long' ? 'long' : read.side === 'short' ? 'short' : 'aside';
    var h = '<div class="omni-side ' + cls + '" role="status">';
    h += '<div class="omni-side-call">' + esc(read.headline) + '</div>';
    h += '<ul class="lst">';
    var gs = read.gates || [];
    for (var i = 0; i < gs.length; i++) h += gateLine(gs[i]);
    h += '</ul>';
    h += '<div class="note">';
    if (read.side === 'aside'){
      h += 'No side to take until tape and sentiment agree. Cards still render. This is not a ticket.';
    } else if (opts.oneSide){
      h += 'Take <b>' + esc(read.side.toUpperCase()) + '</b> setups. One direction per contract — the other side is not shown. This is not itself a ticket.';
    } else {
      h += 'Take <b>' + esc(read.side.toUpperCase()) + '</b> setups. The other side still renders, stamped AGAINST TAPE — not hidden. This is not itself a ticket.';
    }
    h += '</div></div>';
    return h;
  }
  function omniFng(){
    try{
      if (typeof S !== 'undefined' && S && S.fng) return S.fng;
    }catch(e){}
    try{
      if (typeof window !== 'undefined' && window.S && window.S.fng) return window.S.fng;
    }catch(e2){}
    return null;
  }
  function omniPaintSide(ui, read){
    try{ if (ui && ui.side) ui.side.innerHTML = hgOmniMarketSideHtml(read); }catch(e){}
    return read;
  }
  function omniRefreshSide(ui){
    var paint = function(){
      var pic = null;
      try{ pic = (typeof window !== 'undefined' && window.__hgMarketPicture) || null; }catch(e){}
      return omniPaintSide(ui, hgOmniMarketSide(pic, omniFng()));
    };
    try{
      if (typeof window !== 'undefined' && window.__hgMarketPicture)
        return Promise.resolve(paint());
      if (typeof window !== 'undefined' && typeof window.marketPictureCheck === 'function'){
        return Promise.resolve(window.marketPictureCheck()).then(function(r){
          try{ window.__hgMarketPicture = r; }catch(e){}
          return paint();
        }).catch(function(){ return paint(); });
      }
    }catch(e2){}
    return Promise.resolve(paint());
  }

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

  function setupCard(c, sideRead){
    var head = esc(c.base || c.sym) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase());
    var ev = (c.grade.evaluated || 0), tot = (c.grade.total || 0);
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (c.topPick) badge = pill('STRONGEST', 'pick') + ' ' + badge;
    if (tot){
      /* Evidence coverage sits next to the verdict, not buried in the list:
         a 4/12 ticket and a 12/12 ticket are not the same claim. */
      badge += ' ' + pill(ev + '/' + tot + ' checks', ev * 2 >= tot ? '' : 'bad');
    }
    if (sideRead && (sideRead.side === 'long' || sideRead.side === 'short') && c.dir){
      if (String(c.dir).toLowerCase() === sideRead.side) badge += ' ' + pill('WITH TAPE', 'ok');
      else badge += ' ' + pill('AGAINST TAPE', 'bad');
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
    if (isFinite(fin(c.level))){
      h += '<div class="dim">SETUP ' + esc(c.kind) + ' @ ' + fmtPx(c.level)
        +  ((c.plan && isFinite(fin(c.plan.entry)) && Math.abs(c.plan.entry - c.level) > 1e-6)
              ? (' · plan entry ' + fmtPx(c.plan.entry)) : '')
        +  '</div>';
    }
    if (c.plan){
      h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry) + ' · STOP ' + fmtPx(c.plan.stop)
        +  ' · T1 ' + fmtPx(c.plan.t1) + ' · T2 ' + fmtPx(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b>'
        +  ' · risk ' + fmt(c.plan.riskPct, 2) + '%</div>';
      if (c.plan.note) h += '<div class="dim">' + esc(c.plan.note) + '</div>';
      /* Replay-calibration read: 200-pt solidity score + cost-to-stop drag
         (+ the honest measured-probability note). Built from the same plan
         the card prints; returns '' rather than crashing the card when data
         is missing. */
      try { h += hgOmniSolidityBadgesHtml(c); } catch (eSol) {}
      if (typeof window !== 'undefined' && typeof window.hgStrategyTradeDetailHtml === 'function'){
        h += window.hgStrategyTradeDetailHtml(c.plan);
      }
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

  function hgOmniRenderCoverageMatrix(){ return renderMatrix(); }

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
  /* THE DESK READ, crypto edition — same purpose as the gold desk's: the
     status line named the top blocking GATE, which is a category, and the
     reader needed the market condition it implies. Derived from the graded
     cards, costing nothing. */
  function hgOmniDeskRead(tally, total){
    try {
      var PLAIN = {
        'level-fresh': 'the market has moved past the levels the mechanics fired at — plans priced off bars the tape has left behind',
        'measured-edge': 'the mechanics that fired have measurably not paid on this desk',
        'book-depth': 'the books are too thin to absorb the stop without slippage',
        'participation': 'the trigger bars are thin for their time of day',
        'consensus': "the desk's own mechanics point both ways, and a two-sided tape earns no ticket",
        'trend': 'the setups that fired point against the prevailing stack',
        'htf-daily': 'the setups that fired disagree with the daily stack',
        'news-window': 'a news blackout is standing the whole desk aside',
        'funding': 'funding says the crowd is already positioned this way',
        'plan-levels': 'no stop could be placed on structure for the setups that fired'
      };
      var keys = Object.keys(tally || {}).sort(function(a, b){ return tally[b] - tally[a]; });
      var parts = [], i;
      for (i = 0; i < keys.length && parts.length < 2; i++){
        if (PLAIN[keys[i]]) parts.push(PLAIN[keys[i]]);
      }
      if (!parts.length) return '';
      return 'DESK READ: ' + parts.join('; ')
           + '. Standing aside IS the read on ' + total + ' setups.';
    } catch (e){ return ''; }
  }

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

  function omniRememberPaint(ui){
    try { if (ui && ui.cards) __omni.lastCardsHtml = ui.cards.innerHTML; } catch (eC) {}
    try { if (ui && ui.pool) __omni.lastPoolHtml = ui.pool.innerHTML; } catch (eP) {}
    try { if (ui && ui.mp) __omni.lastMpHtml = ui.mp.innerHTML; } catch (eM) {}
    try { if (ui && ui.apex) __omni.lastApexHtml = ui.apex.innerHTML; } catch (eAx) {}
    try { if (ui && ui.x20) __omni.last20xHtml = ui.x20.innerHTML; } catch (eX) {}
  }

  function omniKeepLast(ui, why){
    try {
      if (ui && ui.cards && __omni.lastCardsHtml) ui.cards.innerHTML = __omni.lastCardsHtml;
    } catch (eC) {}
    try {
      if (ui && ui.pool && __omni.lastPoolHtml != null) ui.pool.innerHTML = __omni.lastPoolHtml;
    } catch (eP) {}
    try {
      if (ui && ui.mp && __omni.lastMpHtml != null) ui.mp.innerHTML = __omni.lastMpHtml;
    } catch (eM) {}
    try {
      if (ui && ui.apex && __omni.lastApexHtml != null) ui.apex.innerHTML = __omni.lastApexHtml;
    } catch (eAx) {}
    try {
      if (ui && ui.x20 && __omni.last20xHtml != null) ui.x20.innerHTML = __omni.last20xHtml;
    } catch (eX) {}
    if (__omni.lastStat) omniSafeStat(ui, __omni.lastStat);
    try {
      if (ui && ui.warn){
        ui.warn.textContent = 'rescan failed — keeping last scan. ' + String(why || '');
        ui.warn.style.display = 'block';
      }
    } catch (eW) {}
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
    /* Never blank a finished desk to start a rescan. A failed venue read
       used to leave that blank standing — the last snapshot was still in
       memory and the reader saw only the error. */
    if (!__omni.lastCardsHtml){
      try { ui.cards.innerHTML = ''; } catch (eClr) {}
      omniSafeStat(ui, 'loading Delta + CoinDCX universe…');
    } else {
      omniSafeStat(ui, 'rescanning… previous results still showing');
    }

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
        /* ALWAYS take a BTC daily read off Binance klines — one request, an
           endpoint this scan already relies on. It serves two readers: the
           regime gate falls back to it when the 8-gauge module produced
           nothing, and P5.2's multi-asset pillar reads it (as ex.btcRegime)
           as a BTC-trend leg independent of the 8-gauge composite, so that
           pillar's "3 independent signals" are genuinely three signals.
           Failure here simply leaves both readers UNCHECKED. */
        __omni.regimeProxy = null;
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
        var uniMsg = 'universe empty — both venue legs failed'
          + (uniErr ? (' (' + uniErr + ')') : '')
          + '. Nothing to scan — this is a data-source problem, not a setup drought.';
        if (__omni.lastCardsHtml){
          omniKeepLast(ui, uniMsg);
          return { keep: true };
        }
        omniSafeStat(ui, uniMsg);
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
      var held = [], done = 0, thin = 0, failed = 0, pass1Err = null, nPass1Fired = 0;
      __omni.xsRescued = 0;   /* per scan, never carried over from the last one */
      var xsAll = [], xsRanks = null;

      /* ---- PASS 1: ingest EVERY contract. 4H candles + a cheap detect so
         the status line can say how many already fired. Every scannable
         name is held for pass 2 — quiet ones still get house extras,
         SCALP 1H/15m, indicators, and confluence. ---- */
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
                + ' contracts — ' + nPass1Fired + ' fired · holding all for full ledger');
            }
            /* Closed candles only — see hgOmniDropForming. Applied HERE, at
               the single ingestion point, so every downstream consumer
               (detectors, gates, walk-forward measurement) sees the same
               closed set and none of them can disagree about the last bar. */
            /* The forming candle's close is the current price — retained for the
               level-fresh gate before the sanitiser drops it. */
            var livePx = (rows && rows.length) ? fin(rows[rows.length - 1].c) : NaN;
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
               Four numbers, no network: pass 1 already holds these bars. */
            var xsSum = hgOmniXsSummary(item.sym, rows);
            if (xsSum) xsAll.push(xsSum);
            /* Detect WITHOUT the cross-section here: the ranks are not known
               until every contract has been seen. Pass 2 re-detects every
               held name with the universe in hand. */
            var hits = hgOmniDetect(rows);
            if (hits.length) nPass1Fired++;
            held.push({ item: item, rows: rows, hits: hits, livePx: livePx });
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
        /* ---- PASS 2: full ledger on every held name. Walk-forward
           measurement is O(bars × detectors) per symbol and the Binance
           / 1H / 15m calls are per-symbol network. Pacing below is what
           makes that viable without 429-ing the proxy. ---- */
        /* Universe ranks, once pass 1 has seen every contract. Refuses under
           30 names, because a percentile of a handful is not a percentile. */
        xsRanks = hgOmniXsRanks(xsAll);

        /* CROSS-SECTIONAL STAMP.

           XS-LEADER and XS-LAGGARD still cannot be evaluated in pass 1: a
           contract's rank is not known until every contract has been seen.
           Quiet names used to be dropped here. They are already on `held`;
           this only stamps an XS hit onto an empty hits list so the
           parameter grid can see the tails. Evaluate re-detects with xs
           regardless. */
        try {
          var resc = 0, ru, rx;
          if (xsRanks){
            for (ru = 0; ru < held.length; ru++){
              var uc = held[ru];
              if (!uc || !uc.item || !uc.rows) continue;
              if (uc.hits && uc.hits.length) continue;
              rx = hgOmniXsLeader(uc.rows, xsRanks, uc.item.sym);
              if (!rx) continue;
              uc.hits = [rx];
              resc++;
            }
          }
          if (resc) __omni.xsRescued = resc;
        } catch (eXs){
          try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('omniroute:xs-rescue', eXs); } catch (eW2) {}
        }

        /* FULL LEDGER ON EVERY NAME.

           Merit order still exists so the parameter grid samples the
           strongest tapes. It is not a permission slip to skip anyone. */
        var xsRankOf = function(sym){
          if (!xsRanks || !xsRanks.rank) return 0.5;
          var r = fin(xsRanks.rank[String(sym)]);
          return isFinite(r) ? r : 0.5;
        };
        var enrichMerit = function(f){
          var fams = {}, i, h, best = 0, dir;
          var hitList = (f && f.hits) || [];
          for (i = 0; i < hitList.length; i++){
            h = hitList[i];
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
          return best * 1000 + hitList.length * 10 + edge * 10;
        };
        var meritOrder = held.slice().sort(function(a, b){ return enrichMerit(b) - enrichMerit(a); });
        /* Keep the bars for the strongest names so the parameter grid can run
           on REAL data without a second fetch. Capped: the grid answers a
           question about the mechanics, not about every contract. */
        __omni.gridRows = meritOrder.slice(0, GRID_SAMPLE).map(function(f){ return f.rows; });

        var subset = held;
        var perSymbolStats = [], enriched = [], e = 0;

        function enrichOne(f){
          var base = f.item.base || '';
          var binSym = base ? (base + 'USDT') : null;
          var jobs = [
            (typeof W.binanceOIHistory === 'function' && binSym) ? W.binanceOIHistory(binSym, '4h', 12).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.binanceLongShort === 'function' && binSym) ? W.binanceLongShort(binSym, '4h', 6).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.binanceTakerRatio === 'function' && binSym) ? W.binanceTakerRatio(binSym, '4h', 6).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.binanceDepth === 'function' && binSym) ? W.binanceDepth(binSym, 20).catch(function(){ return null; }) : Promise.resolve(null),
            (typeof W.xuCandles === 'function')
              ? Promise.resolve().then(function(){ return W.xuCandles(f.item, '1h', BARS); }).catch(function(){ return []; })
              : Promise.resolve([]),
            (typeof W.xuCandles === 'function')
              ? Promise.resolve().then(function(){ return W.xuCandles(f.item, '15m', BARS); }).catch(function(){ return []; })
              : Promise.resolve([])
          ];
          return Promise.all(jobs).then(function(r){
            e++;
            omniSafeStat(ui, 'pass 2/2 · full ledger on every name · ' + e + '/' + subset.length);
            var oiH = r[0], ls = r[1], tk = r[2], dep = r[3];
            var raw1h = Array.isArray(r[4]) ? r[4] : [];
            var raw15 = Array.isArray(r[5]) ? r[5] : [];
            var rows1h = hgOmniDropForming(raw1h, '1h');
            var rows15m = hgOmniDropForming(raw15, '15m');
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
              /* The WHOLE taker series, not only its last value: CVD is an
                 integral, and the latest ratio alone cannot be integrated. */
              takerSeries: (tk && tk.series && tk.series.length) ? tk : null,
              depth: dep,
              regime: (typeof W.regimeState === 'function') ? (function(){ try { return W.regimeState(); } catch (er) { return null; } })() : null,
              news: (typeof W.hgNewsRisk === 'function') ? (function(){ try { return W.hgNewsRisk(f.item.sym); } catch (er) { return null; } })() : null,
              /* The whole-universe read. Present only once pass 1 has ranked
                 every contract, and null on a sweep too small to rank. */
              xs: xsRanks,
              stats: stats,
              rows1h: rows1h,
              rows15m: rows15m,
              ticker: f.item
            }});
          }).catch(function(){ e++; });
        }

        function enrich(i){
          if (i >= subset.length) return Promise.resolve();
          var slice = subset.slice(i, i + ENRICH_CHUNK);
          return Promise.all(slice.map(enrichOne)).then(function(){
            if (i + ENRICH_CHUNK >= subset.length) return;
            return omniSleep(ENRICH_DELAY_MS).then(function(){ return enrich(i + ENRICH_CHUNK); });
          });
        }

        return enrich(0).catch(function(e2){
          try{ console.warn('omniroute pass 2 error — continuing with partial', e2); }catch(eL2){}
        }).then(function(){
          var pooled = hgOmniPoolStats(perSymbolStats);

          /* Evaluate EVERY held name. House extras, SCALP 1H/15m, the
             indicator ledger and (when enrichment answered) Binance
             confluence all run here. A name that still fires nothing
             does not get an invented ticket. */
          var exBySym = {}, j, k;
          for (j = 0; j < enriched.length; j++){
            var esym = enriched[j].f.item.sym;
            enriched[j].extra.stats = pooled;
            exBySym[esym] = enriched[j].extra;
          }
          var cands = [];
          function gradeOne(j){
            var fitem = held[j].item;
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
               behind a failed enrich. */
            if (!ex.htf) ex.htf = hgOmniDailyHtf(held[j].rows);
            /* Re-read regime per contract: the warm may have completed after
               enrichment began, and it is a single shared market-wide value
               rather than anything per-symbol. */
            if (!ex.regime && typeof W.regimeState === 'function'){
              try { ex.regime = W.regimeState(); } catch (er) { ex.regime = null; }
            }
            if (!ex.regime && __omni.regimeProxy) ex.regime = __omni.regimeProxy;
            /* P5.2 wiring: the BTC daily proxy is a genuine BTC read, so it
               feeds the multi-asset pillar's BTC leg regardless of whether
               the 8-gauge verdict is also present. */
            if (!ex.btcRegime && __omni.regimeProxy) ex.btcRegime = __omni.regimeProxy;
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
            /* P5.2 wiring: attach the SAME positioning object the perp gates
               receive, so the multi-asset pillar's funding leg reads real
               data instead of reporting FUND:n/a on every card. */
            if (!ex.positioning && pos) ex.positioning = pos;
            /* The live price captured at ingestion, so level-fresh can judge
               the plan against where the market actually is. */
            ex.livePx = held[j].livePx;
            if (!ex.ticker) ex.ticker = fitem;
            var found = hgOmniEvaluate(fitem, held[j].rows, pos, ex);
            for (k = 0; k < found.length; k++) cands.push(found[k]);
            /* Record this contract's firings so OMNIROUTE accumulates the same
               out-of-sample evidence OMNIGOLD does. Every setup with a plan,
               not only tickets, so the forward pool measures the same thing
               the in-sample pool measures. */
            if (typeof W.hgFwdRecordScan === 'function'){
              var fwdRows = [];
              for (k = 0; k < found.length; k++){
                if (!found[k].plan) continue;
                /* Extract fillRiskGapR from the fill-risk gate for measurement */
                var fillRiskGapR = NaN;
                var gates = found[k].gates || [];
                for (var gi = 0; gi < gates.length; gi++){
                  if (gates[gi] && gates[gi].key === 'fill-risk' && isFinite(gates[gi].fillRiskGapR)){
                    fillRiskGapR = gates[gi].fillRiskGapR;
                    break;
                  }
                }
                fwdRows.push({ sym: fitem.sym, dir: found[k].dir,
                               entry: found[k].plan.entry, stop: found[k].plan.stop, t1: found[k].plan.t1,
                               mechanic: found[k].kind,
                               ticket: !!(found[k].grade && found[k].grade.ticket),
                               /* barT keying must match OMNIGOLD: the decision bar's open time,
                                  not current time. Without this, hgFwdRecordScan defaults to
                                  Date.now() and invalidates cross-desk out-of-sample comparison. */
                               barT: num(held[j].rows && held[j].rows.length > 0 ? held[j].rows[held[j].rows.length - 1].t : NaN),
                               /* The crypto replicated-gate stack. Audited on
                                  10 Binance majors x 1,000 bars, both 4h and
                                  1h, Sidak-corrected: regime (+8.5/+7.2) and
                                  htf-confirm (+5.9/+9.0) replicated cleanly,
                                  stoch-rsi (+3.5/+3.3) sat on the bar. Note
                                  gold's other two (regime-fit, hurst-regime)
                                  did NOT survive here — each desk earns its
                                  own stack. Recorded, not acted on: this
                                  field exists so the forward panel can judge
                                  the claim on trades logged before their
                                  outcomes existed. */
                               stack3: (function(gs){
                                 var keep = { 'regime':1, 'htf-confirm':1, 'stoch-rsi':1 };
                                 var nS = 0, gj;
                                 for (gj = 0; gj < (gs || []).length; gj++){
                                   if (gs[gj] && keep[gs[gj].key] && gs[gj].pass === true) nS++;
                                 }
                                 return nS;
                               })(found[k].gates),
                               /* FILL-RISK measurement: distance in R from entry to market.
                                  Recorded for the forward panel to judge fill probability
                                  as outcomes settle. Calibration uses gold's rates as a
                                  placeholder — crypto-specific measurement needed. */
                               fillRiskGapR: fillRiskGapR });
              }
              if (fwdRows.length){
                try { W.hgFwdRecordScan('OMNIROUTE', TF, fwdRows, { horizonBars: 20 }); }
                catch (e) { try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('omniroute:record', e); } catch (eW) {} }
              }
            }
            /* Graded means these bars are finished with — release them so the
               tab is not holding a universe of candles while it renders. The
               parameter grid keeps its own references in __omni.gridRows. */
            held[j].rows = null;
          }
          function gradeStep(j){
            if (j >= held.length) return Promise.resolve();
            var stop = Math.min(j + GRADE_CHUNK, held.length);
            for (var gj = j; gj < stop; gj++){
              /* One bad contract must not take down the other 499. */
              try { gradeOne(gj); }
              catch (eG){ try { console.warn('omniroute grade skipped',
                held[gj] && held[gj].item && held[gj].item.sym, eG); } catch (eG2) {} }
            }
            if (stop >= held.length) return Promise.resolve();
            omniSafeStat(ui, 'grading ' + stop + '/' + held.length + ' names — all engines + indicator ledger…');
            return omniSleep(0).then(function(){ return gradeStep(stop); });
          }
          return gradeStep(0).then(function(){
            return { cands: cands, scanned: list.length, uni: uni.length,
                   fired: nPass1Fired, held: held.length, enriched: subset.length, thin: thin,
                   failed: failed, pooled: pooled, pass1Err: pass1Err, pass1Done: done,
                   /* The live enrichment map rides to the render pass so the
                      LATE SOLIDITY STAMP can score renderable non-tickets on
                      real data. exBySym is declared in THIS callback's scope —
                      the render pass runs in a SIBLING .then(), where the bare
                      identifier is a ReferenceError, not a closure read. */
                   exBySym: exBySym };
          });
        });
      });
    }).then(function(res){
      if (!res || res.keep) return;
      try{
        var ranked = hgOmniRank(res.cands || []);
        __omni.snap = { at: Date.now(), scanned: res.scanned, uni: res.uni, rows: ranked, pooled: res.pooled };
        __omni.ran = true;
        var tickets = 0, i;
        /* Over DISTINCT TRADES — see omniDistinctCounts. */
        var dcounts = omniDistinctCounts(ranked);
        tickets = dcounts.tickets;
        __omni.lastStat = ranked.length + ' setup(s) · ' + tickets + ' ticket(s) · ' + res.scanned + ' contracts scanned'
                        + (res.held ? ('  ·  full ledger on all ' + res.held + ' names (every engine + every indicator)') : '')
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
            var omniRead = hgOmniDeskRead(blockTally, ranked.length);
            if (omniRead) __omni.lastStat += '  ·  ' + omniRead;
          }
        }
        var caveat = '';
        if (res.pass1Err) caveat += '  · pass 1 interrupted (' + res.pass1Err + ') — partial cover at ' + res.pass1Done + '/' + res.scanned;
        if (res.held && res.enriched && res.held > res.enriched)
          caveat += '  · ' + (res.held - res.enriched) + ' names missed networked confluence (enrichment error, not a cap)';
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
        try{
          /* The forward panel under the pooled table, exactly as OMNIGOLD
             renders it: without this the stack3/shadow evidence this tab
             records would be write-only. Its blocks self-hide until data
             exists, so a fresh install shows nothing extra. */
          var fwdPanel = '';
          if (W && typeof W.hgFwdPanelHTML === 'function'){
            try { fwdPanel = W.hgFwdPanelHTML('OMNIROUTE', { minRr: MIN_RR, title: 'FORWARD — out-of-sample' }) || ''; }
            catch (eFp) { fwdPanel = ''; }
          }
          ui.pool.innerHTML = renderPooled(res.pooled) + fwdPanel;
        }catch(eP){
          try{ ui.pool.innerHTML = '<div class="note warn">measurement table failed to render.</div>'; }catch(eP2){}
        }
        if (!ranked.length){
          /* A scan where the candles never arrived is NOT a quiet market.
             Without this the two are indistinguishable on screen, and the
             honest reading (I could not look) is the one that gets lost. */
          var dead = (res.failed || 0) + (res.thin || 0);
          var deadPct = res.scanned ? (dead / res.scanned) : 0;
          return omniRefreshSide(ui).then(function(sideRead){
            var tape0 = hgOmniSideTape(sideRead);
            ui.cards.innerHTML = (deadPct >= 0.5)
              ? ('<div class="note warn">No setups — but ' + dead + ' of ' + res.scanned
                 + ' contracts returned no usable candles, so this is a DATA problem, not a quiet market. '
                 + 'Check the venue legs / proxy rate limit and re-run before reading a market view into it.</div>')
              : '<div class="empty">no setup fired on any contract. That is a normal result — the detectors are meant to be quiet.</div>';
            hgOmniPaintMostProbable(ui, [], tape0, [], { n: 0 });
            /* APEX: header + honest empty state even on an empty scan. */
            try { if (ui.apex) ui.apex.innerHTML = hgOmniApexSectionHtml([]); } catch (eApE) {}
            /* 20X: banner + honest empty state even on an empty scan. */
            try { if (ui.x20) ui.x20.innerHTML = hgOmni20xSectionHtml([]); } catch (e20e) {}
            omniRememberPaint(ui);
          });
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

        /* Side banner first so WITH TAPE / AGAINST TAPE stamps wait for the
           picture when the cache is cold. Empty desks still get the call. */
        return omniRefreshSide(ui).then(function(sideRead){
        var tape = hgOmniSideTape(sideRead);
        collapsed = hgOmniDeskOrder(collapsed, tape);
        var few = hgOmniPickFew(collapsed, tape, OMNI_MP_MAX);
        /* Tickets sentiment/tape is holding: cleared the whole ledger, carry a plan,
           and point the other way. Counted from the COLLAPSED list so several
           mechanics on one set of levels count as the one trade they are. */
        var omniHeld = { n: 0 };
        try {
          if (tape === 'long' || tape === 'short'){
            for (var hj = 0; hj < collapsed.length; hj++){
              var hc = collapsed[hj];
              if (hc && hc.plan && hc.grade && hc.grade.ticket
                  && String(hc.dir || '').toLowerCase() !== tape) omniHeld.n++;
            }
          }
        } catch (eHeld){ omniHeld = { n: 0 }; }
        __omni.held = omniHeld;
        var fi;
        for (fi = 0; fi < few.length; fi++) few[fi].topPick = true;
        var h = '';
        /* A CARD WHOSE LEVELS ARE DEAD IS NOT A CARD — same rule as the gold
           desk, for the same reason. level-fresh already vetoes a plan the
           market has crossed, but a full-size card with ENTRY/STOP/T1 far
           from the chart is what the reader sees regardless of the badge.
           Only a REAL DOA veto collapses; an AGAINST resting-order plan at
           genuine structure still renders in full. */
        /* LATE SOLIDITY STAMP — the second stamp site (see
           hgOmniSolidityStamp). Tickets were stamped inside hgOmniEvaluate;
           this pass covers the <= CARD_RENDER_MAX non-ticket cards the loop
           below will actually render, WHILE exBySym still holds the real
           enrichment (rows1h, htf, oi, positioning, regime, btcRegime,
           news, pooled stats). Without it those cards would fall back to
           the starved recompute (rows:null, extra:null) and read ~29-41/200
           WEAK regardless of quality. Mirrors the render loop's own
           selection (DOA skip, ticket-or-under-cap) so nothing rendered is
           left unstamped and nothing unrendered is paid for; at most 40
           stamps x ~2.3-3.9 ms is ~150 ms once per scan. Best-effort: a
           stamp failure leaves null and the chip degrades honestly. */
        try {
          var lsShown = 0, lsi;
          for (lsi = 0; lsi < collapsed.length; lsi++){
            var lsc = collapsed[lsi];
            if (!lsc) continue;
            var lsLf = null, lsg;
            for (lsg = 0; lsg < (lsc.gates || []).length; lsg++){
              var lsgg = lsc.gates[lsg];
              if (lsgg && lsgg.key === 'level-fresh'){ lsLf = lsgg; break; }
            }
            if (lsLf && lsLf.pass === false && lsLf.info !== true) continue;
            var lsTk = !!(lsc.grade && lsc.grade.ticket);
            if (!(lsTk || lsShown < CARD_RENDER_MAX)) continue;
            lsShown++;
            if (lsc.solidity || !lsc.plan) continue;
            /* res.exBySym, NOT a bare exBySym: that map is declared in the
               grading .then() — a sibling callback, not an ancestor — so the
               bare name threw ReferenceError here on every scan and this
               whole pass was silently skipped (the catch below ate it). */
            var lsEx = (res && res.exBySym && res.exBySym[lsc.sym]) || null;
            var lsExHit = null;
            if (lsEx){
              lsExHit = {};
              for (var lsk in lsEx) if (Object.prototype.hasOwnProperty.call(lsEx, lsk)) lsExHit[lsk] = lsEx[lsk];
              /* same per-mechanic stats selection hgOmniEvaluate makes */
              var lsKey = (lsc.kind === 'UTAD') ? 'SPRING' : lsc.kind;
              lsExHit.stats = (lsEx.stats && lsEx.stats[lsKey]) ? lsEx.stats[lsKey] : null;
            }
            lsc.solidity = hgOmniSolidityStamp(
              { dir: lsc.dir, kind: lsc.kind, level: lsc.level },
              lsc.plan, null, lsExHit, lsEx && lsEx.positioning);
          }
        } catch (eLS) { try { console.warn('omniroute late solidity stamp skipped', eLS); } catch (eLS2) {} }
        var deadLines = '';
        var shown = 0, overflowN = 0, overflowLines = '';
        for (i = 0; i < collapsed.length; i++){
          var lfG = null, gj2;
          for (gj2 = 0; gj2 < (collapsed[i].gates || []).length; gj2++){
            var gg2 = collapsed[i].gates[gj2];
            if (gg2 && gg2.key === 'level-fresh'){ lfG = gg2; break; }
          }
          if (lfG && lfG.pass === false && lfG.info !== true){
            deadLines += '<div class="dim">' + esc(String(collapsed[i].sym || '') + ' ' + collapsed[i].kind
                      +  ' ' + String(collapsed[i].dir).toUpperCase())
                      +  ' — levels dead on arrival: ' + esc(String(lfG.why).replace(/^DEAD ON ARRIVAL — /, ''))
                      +  ' · card not rendered</div>';
            continue;
          }
          var isTk = !!(collapsed[i].grade && collapsed[i].grade.ticket);
          if (isTk || shown < CARD_RENDER_MAX){
            try { h += setupCard(collapsed[i], sideRead); shown++; }
            catch (eC){
              try{ console.warn('omniroute card render skipped', collapsed[i] && collapsed[i].sym, eC); }catch(eC2){}
            }
          } else {
            overflowN++;
            /* One line, not one card: the sym, the mechanic, the direction
               and what killed it — enough to decide whether to care. */
            if (overflowN <= 200){
              var ovV = (collapsed[i].grade && collapsed[i].grade.vetoes && collapsed[i].grade.vetoes.length)
                ? collapsed[i].grade.vetoes[0]
                  + (collapsed[i].grade.vetoes.length > 1 ? ' +' + (collapsed[i].grade.vetoes.length - 1) : '')
                : 'no veto — below rank cap';
              overflowLines += '<div class="dim">' + esc(String(collapsed[i].sym || '') + ' '
                + collapsed[i].kind + ' ' + String(collapsed[i].dir).toUpperCase()
                + ' — ' + ovV) + '</div>';
            }
          }
        }
        if (overflowN){
          h += '<div class="note" style="margin-top:10px"><b>' + overflowN
            + ' more setup(s) past the ' + CARD_RENDER_MAX + '-card screen cap'
            + ' — every ticket above rendered in full; a page with a thousand'
            + ' full ledgers is what was crashing this tab. Ledgers all kept:'
            + ' hgOmniWhyNoTickets().</b>'
            + overflowLines
            + (overflowN > 200 ? '<div class="dim">…and ' + (overflowN - 200) + ' more, summarised in the pool table above</div>' : '')
            + '</div>';
        }
        if (deadLines){
          h += '<div class="note" style="margin-top:10px"><b>DEAD LEVELS — priced off a closed bar the market has left behind:</b>'
            +  deadLines + '</div>';
        }
        ui.cards.innerHTML = h || '<div class="empty">setups found but cards failed to render — see console.</div>';
        /* APEX — stacked-edge tier, from the SAME collapsed candidate list
           this pass just carded (the collapse pass is what stamped
           alsoKinds, so the cluster rule reads the same merge the cards
           print). Best-effort: an APEX render failure must never take the
           cards down with it. */
        try { if (ui.apex) ui.apex.innerHTML = hgOmniApexSectionHtml(collapsed); } catch (eApR) {
          try { console.warn('omniroute apex section failed', eApR); } catch (eApW) {}
        }
        /* 20X — leverage-safe subset, from the SAME collapsed candidate
           list this pass just carded, so a trade cannot appear here that
           the desk did not card. Best-effort: a 20x render failure must
           never take the cards down with it. */
        try { if (ui.x20) ui.x20.innerHTML = hgOmni20xSectionHtml(collapsed); } catch (e20r) {
          try { console.warn('omniroute 20x section failed', e20r); } catch (e20w) {}
        }
        var mpBag = [], mi;
        for (mi = 0; mi < few.length; mi++){
          var row = hgOmniMpRow(few[mi]);
          if (row) mpBag.push(row);
        }
        hgOmniPaintMostProbable(ui, few, tape, mpBag, __omni.held);
        omniRememberPaint(ui);
        });
      }catch(eRender){
        if (__omni.lastCardsHtml) omniKeepLast(ui, 'scan finished but render failed: ' + omniErrMsg(eRender));
        else omniSafeStat(ui, 'scan finished but render failed: ' + omniErrMsg(eRender));
        try{ console.warn('omniroute render failed', eRender); }catch(eR2){}
      }
    }).catch(function(e){
      if (__omni.lastCardsHtml) omniKeepLast(ui, 'scan failed: ' + omniErrMsg(e));
      else omniSafeStat(ui, 'scan failed: ' + omniErrMsg(e));
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

  /* Render crypto pro-trader panel with AI intelligence */
  function omniRenderProTraderPanel(setups){
    if (!setups || !setups.length) return '<div style="padding:8px;color:var(--fg-muted,#999)">No open crypto setups tracked.</div>';

    var html = '<div style="padding:8px">';
    html += '<div style="font-weight:bold;margin-bottom:8px;font-size:1.1em">🚀 AI-ENHANCED OMNI PRO-TRADER CRYPTO</div>';

    var top = setups[0];
    if (top){
      var aiRegime = top.aiRegime || { volatility: 'NORMAL', trend: 'RANGING', momentum: 'WEAK', quality: 50 };
      var aiQuality = fin(top.aiSignalQuality) || 50;
      var aiRisk = top.aiRiskAssessment || { riskScore: 50, riskLevel: 'MEDIUM', tradeability: false };
      var aiPos = top.aiPositioning || {};
      var tradeable = aiRisk.tradeability;
      var tradeColor = tradeable ? '#22c55e' : '#dc2626';

      html += '<div style="margin:8px 0;padding:8px;background:#3b82f633;border-left:3px solid ' + tradeColor + ';border-radius:3px">';
      html += '<div style="font-weight:bold;margin-bottom:4px">🏆 TOP SETUP: ' + esc(String(top.symbol || top.mechanic)) + ' — ' + (tradeable ? '✓ TRADEABLE' : '✗ TOO RISKY') + '</div>';

      if (isFinite(fin(top.entry)) && isFinite(fin(top.t1)) && isFinite(fin(top.stop))){
        var entry = fin(top.entry), tp = fin(top.t1), sl = fin(top.stop);
        var risk = Math.abs(sl - entry), profit = Math.abs(tp - entry), rr = risk > 0 ? (profit/risk).toFixed(2) : 'N/A';
        var tradeStatus = top.tradeStatus || 'active';
        var statusLabel = tradeStatus === 'profit' ? '✓ PROFIT' : tradeStatus === 'stopped' ? '✗ STOPPED' : '▶ ACTIVE';
        var statusColor = tradeStatus === 'profit' ? '#22c55e' : tradeStatus === 'stopped' ? '#dc2626' : '#3b82f6';

        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:0.85em;margin:6px 0">';
        html += '<div><span style="color:var(--fg-muted,#666)">Entry:</span> <b>' + entry.toFixed(8) + '</b></div>';
        html += '<div><span style="color:var(--fg-muted,#666)">TP:</span> <b style="color:#22c55e">' + tp.toFixed(8) + '</b></div>';
        html += '<div><span style="color:var(--fg-muted,#666)">SL:</span> <b style="color:#dc2626">' + sl.toFixed(8) + '</b></div>';
        html += '</div>';

        html += '<div style="display:flex;gap:8px;font-size:0.85em;margin:4px 0">';
        html += '<div><span style="color:var(--fg-muted,#666)">Risk:</span> <b>' + risk.toFixed(8) + '</b></div>';
        html += '<div><span style="color:var(--fg-muted,#666)">Profit:</span> <b style="color:#22c55e">' + profit.toFixed(8) + '</b></div>';
        html += '<div><span style="color:var(--fg-muted,#666)">R:R:</span> <b style="color:#3b82f6">1:' + rr + '</b></div>';
        html += '<div style="margin-left:auto;color:' + statusColor + ';font-weight:bold;background:' + statusColor + '22;padding:2px 6px;border-radius:3px">' + statusLabel + '</div>';
        html += '</div>';
      }

      var comp = fin(top.compositeScore) || 0, tech = fin(top.technicalScore) || 0, sent = fin(top.sentimentScore) || 0, fund = fin(top.fundamentalScore) || 0;
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;font-size:0.8em;margin-top:6px;margin-bottom:8px">';
      html += '<div style="border:1px solid #3b82f633;padding:4px;text-align:center"><div style="font-weight:bold;color:#3b82f6">' + comp.toFixed(0) + '</div><div style="color:var(--fg-muted,#666);font-size:0.75em">Overall</div></div>';
      html += '<div style="border:1px solid #3b82f633;padding:4px;text-align:center"><div style="font-weight:bold;color:#8b5cf6">' + tech.toFixed(0) + '</div><div style="color:var(--fg-muted,#666);font-size:0.75em">Technical</div></div>';
      html += '<div style="border:1px solid #3b82f633;padding:4px;text-align:center"><div style="font-weight:bold;color:#f59e0b">' + sent.toFixed(0) + '</div><div style="color:var(--fg-muted,#666);font-size:0.75em">Sentiment</div></div>';
      html += '<div style="border:1px solid #3b82f633;padding:4px;text-align:center"><div style="font-weight:bold;color:#06b6d4">' + fund.toFixed(0) + '</div><div style="color:var(--fg-muted,#666);font-size:0.75em">Fundamental</div></div>';
      html += '</div>';

      /* AI INTELLIGENCE DISPLAY */
      html += '<div style="margin:8px 0;padding:8px;background:#10b98133;border:1px solid #10b981;border-radius:3px">';
      html += '<div style="font-weight:bold;margin-bottom:6px;color:#10b981">🧠 AI MARKET INTELLIGENCE</div>';

      /* Market Regime */
      html += '<div style="font-size:0.85em;margin-bottom:6px">';
      html += '<div style="color:var(--fg-muted,#666)">Market Regime:</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;margin-top:2px">';
      html += '<div style="text-align:center;padding:3px;background:#10b98122;border-radius:2px;font-size:0.75em"><div style="font-weight:bold">' + aiRegime.volatility + '</div><div>Volatility</div></div>';
      html += '<div style="text-align:center;padding:3px;background:#10b98122;border-radius:2px;font-size:0.75em"><div style="font-weight:bold">' + aiRegime.trend + '</div><div>Trend</div></div>';
      html += '<div style="text-align:center;padding:3px;background:#10b98122;border-radius:2px;font-size:0.75em"><div style="font-weight:bold">' + aiRegime.momentum + '</div><div>Momentum</div></div>';
      html += '<div style="text-align:center;padding:3px;background:#10b98122;border-radius:2px;font-size:0.75em"><div style="font-weight:bold">' + aiRegime.quality.toFixed(0) + '</div><div>Quality</div></div>';
      html += '</div></div>';

      /* AI Signal Quality & Risk */
      html += '<div style="font-size:0.85em;display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      var sigColor = aiQuality >= 70 ? '#22c55e' : aiQuality >= 50 ? '#f59e0b' : '#dc2626';
      var riskColor = aiRisk.riskScore <= 20 ? '#22c55e' : aiRisk.riskScore <= 35 ? '#f59e0b' : '#dc2626';
      html += '<div style="padding:4px;border:1px solid ' + sigColor + '33;background:' + sigColor + '11;border-radius:2px"><div style="color:' + sigColor + ';font-weight:bold">' + aiQuality.toFixed(0) + '</div><div style="font-size:0.75em;color:var(--fg-muted,#666)">Signal Quality</div></div>';
      html += '<div style="padding:4px;border:1px solid ' + riskColor + '33;background:' + riskColor + '11;border-radius:2px"><div style="color:' + riskColor + ';font-weight:bold">' + aiRisk.riskLevel + '</div><div style="font-size:0.75em;color:var(--fg-muted,#666)">Risk Level (' + aiRisk.riskScore + ')</div></div>';
      html += '</div>';

      /* Position Sizing AI */
      if (aiPos.recommended){
        html += '<div style="font-size:0.85em;margin-top:6px;padding:4px;background:#f59e0b22;border-left:3px solid #f59e0b;border-radius:2px">';
        html += '<div style="color:var(--fg-muted,#666)">💰 AI Position Sizing:</div>';
        html += '<div style="font-weight:bold;color:#f59e0b">Risk ' + aiPos.riskPercent + '% of account</div>';
        html += '</div>';
      }

      /* AI Risk Warnings */
      if (aiRisk.risks && aiRisk.risks.length > 0){
        html += '<div style="font-size:0.85em;margin-top:6px;padding:4px;background:#dc262622;border-left:3px solid #dc2626;border-radius:2px">';
        aiRisk.risks.forEach(function(r){ html += '<div>' + r + '</div>'; });
        html += '</div>';
      }

      html += '</div>';

      html += '<div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:4px;font-size:0.75em;margin-top:6px">';
      var checks = top.checks || {};
      var items = [
        {key: 'htfRegime', label: '4h Regime'},
        {key: 'gate1h', label: '1h Gate'},
        {key: 'corrNorm', label: 'Corr Normal'},
        {key: 'drawdownOk', label: 'Drawdown'},
        {key: 'riskReward', label: 'R:R'}
      ];
      items.forEach(function(item){
        var passed = checks[item.key];
        var color = passed ? '#22c55e' : '#dc2626';
        html += '<div style="text-align:center;padding:3px;border:1px solid ' + color + '33;color:' + color + ';font-weight:bold">' + (passed ? '✓' : '✗') + ' ' + item.label + '</div>';
      });
      html += '</div>';

      html += '</div>';
    }

    html += '<div style="margin-top:8px;font-size:0.85em;color:var(--fg-muted,#666)">' + (setups.length || 0) + ' open crypto setup' + (setups.length !== 1 ? 's' : '') + ' tracked</div>';
    html += '</div>';
    return html;
  }

  function omniPaintProTrader(ui, setups){
    try {
      if (ui && ui.proTrader){
        ui.proTrader.innerHTML = omniRenderProTraderPanel(setups);
      }
    } catch (e){}
  }

  function mountOmniroute(el){
    if (!el) return;
    var cfg = hgOmniLoadCfg();

    el.innerHTML =
      '<div class="panel">'
      + '<h2>OmniRoute — desk setups <span>delta + coindcx · spring · po3 · orb · absorption · value area · measured move</span></h2>'
      + '<div id="omniProTrader" style="margin-bottom:16px;border:2px solid #3b82f6;border-radius:4px;padding:12px;background:rgba(59,130,246,0.05)"></div>'
      + '<div class="note hg-lead" style="margin-bottom:10px">Scans <b>every futures contract</b> on Delta India + CoinDCX. Pass 1 fetches 4H bars; pass 2 runs the <b>full ledger on every name</b> — every engine (shared mechanics, native six, positioning, XS, house extras including SCALP on 1H + 15m) and every indicator (hard gates, shared oscillators, Binance OI / crowding / taker / depth, <b>vol targeting · CVD · liquidation map</b>). '
      + 'The coverage table below now reads COVERED on every school. CVD uses Binance taker data where the contract has a twin and a labelled candle approximation elsewhere — a candle is not a trade tape. '
      + 'A name that still fires nothing does <b>not</b> get an invented ticket; the indicator ledger still ran. '
      + 'Each candidate then faces 3 hard gates (trend · vol-alive · participation) plus conditional confluence. '
      + '<b>A single veto stands it aside</b>; vetoed cards still render so you can see why. A contract missing a data source reads UNCHECKED, never PASS. '
      + 'Levels come from the house plan engine at a ' + MIN_RR + 'R floor. <b>MOST PROBABLE SETUPS</b> lead the tab: up to three tape-aligned tickets, ranked on a balance of mechanic families and indicator reads — not a win probability. Extra house engines vote and never claim 7/7 CLEAN. '
      + 'The measurement below is in-sample on a short window: it tells you which detector has paid <i>on the bars just read</i>, which is a floor, not a promise.</div>'
      + '<div class="row"><button class="btn" id="omniRun">RUN FULL SCAN (ALL CONTRACTS)</button>'
      +   ' <button class="btn" id="omniGrid">PARAMETER GRID</button></div>'
      + '<div class="note" id="omniStat">idle — press RUN. Full ledger on every Delta + CoinDCX name (4H + 1H + 15m + confluence), so expect several minutes; progress shows per pass.</div>'
      + '<div class="note warn" id="omniWarn" style="display:none"></div>'
      + '<div id="omniSide"></div>'
      + '<div id="omniMp" style="margin-top:12px"></div>'
      + '<div id="omniApex" style="margin-top:12px"></div>'
      + '<div id="omni20x" style="margin-top:12px"></div>'
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
      warn: el.querySelector('#omniWarn'), side: el.querySelector('#omniSide'), cards: el.querySelector('#omniCards'),
      mp: el.querySelector('#omniMp'),
      apex: el.querySelector('#omniApex'),
      x20: el.querySelector('#omni20x'),
      pool: el.querySelector('#omniPool'),
      matrix: el.querySelector('#omniMatrix'),
      proTrader: el.querySelector('#omniProTrader'),
      ep: el.querySelector('#omniEp'), tok: el.querySelector('#omniTok'),
      model: el.querySelector('#omniModel'), ping: el.querySelector('#omniPing'),
      pingStat: el.querySelector('#omniPingStat'), kind: el.querySelector('#omniKind'),
      src: el.querySelector('#omniSrc'), irun: el.querySelector('#omniIngest'),
      istat: el.querySelector('#omniIStat'), iout: el.querySelector('#omniIOut'),
      grid: el.querySelector('#omniGrid'), gridOut: el.querySelector('#omniGridOut')
    };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __omni.ui = ui;
    /* Remount must not look like a first visit. The last completed scan is
       still the desk until a newer one successfully replaces it. */
    if (__omni.lastCardsHtml){
      try { ui.cards.innerHTML = __omni.lastCardsHtml; } catch (eM) {}
      if (__omni.lastStat) omniSafeStat(ui, __omni.lastStat);
      if (ui.pool && __omni.lastPoolHtml != null){
        try { ui.pool.innerHTML = __omni.lastPoolHtml; } catch (eP) {}
      }
      if (ui.mp && __omni.lastMpHtml != null){
        try { ui.mp.innerHTML = __omni.lastMpHtml; } catch (eMp) {}
      }
      if (ui.apex && __omni.lastApexHtml != null){
        try { ui.apex.innerHTML = __omni.lastApexHtml; } catch (eApM) {}
      }
      if (ui.x20 && __omni.last20xHtml != null){
        try { ui.x20.innerHTML = __omni.last20xHtml; } catch (eX20) {}
      }
    }
    /* Pre-scan placeholder for APEX, same reason as the 20X one below: an
       empty container is an undiscoverable feature. Header + the permanent
       selectivity note + how it fills. Never overwrites a restored render. */
    if (ui.apex && !ui.apex.innerHTML){
      try {
        ui.apex.innerHTML =
          '<section data-omni-apex="1">'
          + '<div class="hg-mp-eye">APEX — STACKED-EDGE SETUPS</div>'
          + '<div class="note">The most selective tier on this desk. A card prints only when EVERY independent check '
          + 'already stands in the trade’s favour: a mechanic whose out-of-sample forward ledger has paid (or a full '
          + 'conviction certificate), at least two mechanics fired on identical levels with one of them forward-paid, '
          + 'with-trend on 4H + daily + regime, indicator context strongly with (>=16 with, <=3 against), live book and '
          + 'participation, a non-vetoed ticket at cost tier ok — plus two exit designs judged by the desk’s own SHADOW '
          + 'measurement, never a promised number. Selectivity IS the edge — most scans show nothing here, and that is '
          + 'the bar holding. This section fills when a scan runs — press RUN FULL SCAN above.</div>'
          + '<div class="empty">no scan yet — the APEX bar runs on scan results.</div>'
          + '</section>';
      } catch (eApP) {}
    }
    /* Before the first scan the 20X container used to sit empty and the
       section was undiscoverable. Render a visible placeholder: header +
       the permanent risk banner + how it fills. Never overwrites a
       restored scan render. */
    if (ui.x20 && !ui.x20.innerHTML){
      try {
        ui.x20.innerHTML =
          '<section data-omni-20x="1">'
          + '<div class="hg-mp-eye">20X — LEVERAGE-SAFE SETUPS</div>'
          + '<div class="note warn" style="display:block">20x is unforgiving: a ~4.6% adverse move liquidates '
          + 'the full isolated margin. This section fills when a scan runs — press RUN FULL SCAN above. '
          + 'Only setups whose geometry survives 20x pass its gates (stop 2.5x inside liquidation, ATR-noise '
          + 'check, cost gate, quality floor: conviction cert, a forward record that has paid, or solidity). '
          + 'Wide-stop tickets get one honest fallback: a tighter 1h-structure stop is tried through the SAME '
          + 'gates and labelled as NOT the swing invalidation. Most scans still yield few, which is the gates '
          + 'working, not a malfunction. Signals only — this desk does not execute.</div>'
          + '<div class="empty">no scan yet — the 20x gates run on scan results.</div>'
          + '</section>';
      } catch (eX20p) {}
    }
    omniRefreshSide(ui);

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
  /* ===== AI-ENHANCED PRO-TRADER CRYPTO SUITE ===== */

  /* AI Market Intelligence: Detect market regime */
  function omniAIDetectMarketRegime(volatility, trend, momentum){
    volatility = fin(volatility) || 1.0;
    trend = String(trend || 'ranging').toLowerCase();
    momentum = fin(momentum) || 0;

    var regime = {
      volatility: volatility > 1.5 ? 'HIGH' : volatility < 0.7 ? 'LOW' : 'NORMAL',
      trend: trend === 'strong_up' ? 'IMPULSE_UP' : trend === 'strong_down' ? 'IMPULSE_DOWN' : 'RANGING',
      momentum: Math.abs(momentum) > 0.7 ? 'STRONG' : 'WEAK',
      quality: 0
    };

    /* Calculate regime quality (0-100) */
    if (regime.volatility === 'NORMAL' && regime.momentum === 'STRONG'){
      regime.quality = 85;  /* Perfect setup conditions */
    } else if ((regime.volatility === 'NORMAL' || regime.volatility === 'HIGH') && regime.trend !== 'RANGING'){
      regime.quality = 75;  /* Good trending conditions */
    } else if (regime.volatility === 'LOW' && regime.trend === 'RANGING'){
      regime.quality = 60;  /* Stable but low movement */
    } else if (regime.volatility === 'HIGH' && regime.trend === 'RANGING'){
      regime.quality = 30;  /* Dangerous chop */
    } else {
      regime.quality = 50;  /* Neutral */
    }

    return regime;
  }

  /* AI Risk Management: Dynamic position sizing */
  function omniAICalculatePositionSize(account, risk, volatility, confidence){
    account = fin(account) || 10000;
    risk = fin(risk) || 0.01;  /* 1% default risk */
    volatility = fin(volatility) || 1.0;
    confidence = fin(confidence) || 0.5;

    /* Base position: account * risk / entry_risk */
    var baseSize = account * risk;

    /* Kelly Criterion adjustment: size *= (2*confidence - 1) */
    var kellyFactor = Math.max(0.5, Math.min(2.0, (2 * confidence) - 1));

    /* Volatility adjustment: lower vol = larger position */
    var volFactor = Math.min(2.0, 1.5 / volatility);

    var positionSize = baseSize * kellyFactor * volFactor;

    return {
      baseSize: baseSize,
      kellyAdjusted: baseSize * kellyFactor,
      volAdjusted: baseSize * kellyFactor * volFactor,
      recommended: Math.max(account * 0.001, Math.min(account * 0.1, positionSize)),
      riskPercent: (positionSize / account * 100).toFixed(2)
    };
  }

  /* AI Entry/Exit Intelligence: Smart levels based on regime */
  function omniAISmartLevels(entry, stop, regime, confidence){
    entry = fin(entry) || 0;
    stop = fin(stop) || 0;
    regime = regime || { volatility: 'NORMAL', momentum: 'WEAK', quality: 50 };
    confidence = fin(confidence) || 0.5;

    var risk = Math.abs(stop - entry);
    if (risk === 0) return { entry: entry, tp1: entry, tp2: entry, tp3: entry, trail: false };

    /* Volatility-adjusted take profit levels */
    var volMultiplier = regime.volatility === 'HIGH' ? 1.2 : regime.volatility === 'LOW' ? 0.8 : 1.0;
    var momentumMultiplier = regime.momentum === 'STRONG' ? 1.5 : 1.0;

    var baseRR = 2.0;
    var tp1Distance = risk * baseRR * volMultiplier * 0.5;  /* Half target at 1R */
    var tp2Distance = risk * baseRR * volMultiplier;        /* 2R mid-point */
    var tp3Distance = risk * baseRR * volMultiplier * momentumMultiplier * 1.5;  /* 3R+ for strong momentum */

    var isLong = entry > stop;
    var tp1 = isLong ? entry + tp1Distance : entry - tp1Distance;
    var tp2 = isLong ? entry + tp2Distance : entry - tp2Distance;
    var tp3 = isLong ? entry + tp3Distance : entry - tp3Distance;

    return {
      entry: entry, stop: stop, risk: risk,
      tp1: tp1, tp2: tp2, tp3: tp3,
      tp1Pct: ((tp1Distance / entry) * 100).toFixed(2),
      tp2Pct: ((tp2Distance / entry) * 100).toFixed(2),
      tp3Pct: ((tp3Distance / entry) * 100).toFixed(2),
      trailingStop: regime.momentum === 'STRONG',  /* Trail in strong trends */
      partialProfitAt: 'TP1'  /* Take first 50% at TP1 */
    };
  }

  /* AI Signal Quality Scoring */
  function omniAISignalQuality(setup, regime, confidence){
    setup = setup || {};
    regime = regime || { quality: 50 };
    confidence = fin(confidence) || 0.5;

    var score = 0;

    /* Confluence points: multiple conditions aligned */
    var confluenceCount = 0;
    if (setup.htfRegime === true) confluenceCount++;
    if (setup.gate1h === true) confluenceCount++;
    if (setup.corrNorm === true) confluenceCount++;
    confluenceCount += setup.gateConf || 0;

    score += Math.min(40, confluenceCount * 8);  /* 40 pts for confluence */

    /* Regime quality alignment */
    score += regime.quality * 0.4;  /* 40 pts max from regime */

    /* Historical confidence (Wilson LB) */
    score += confidence * 100 * 0.2;  /* 20 pts max from win rate */

    return Math.min(100, score);
  }

  /* AI Risk Assessment */
  function omniAIRiskAssessment(setup, regime, age){
    setup = setup || {};
    regime = regime || { volatility: 'NORMAL' };
    age = fin(age) || 0;

    var risks = [];
    var riskScore = 0;

    /* Volatility risk */
    if (regime.volatility === 'HIGH'){
      risks.push('⚠ HIGH volatility: slippage risk');
      riskScore += 15;
    }

    /* Age risk: stale setups */
    if (age > 2 * 3600){  /* 2 hours old */
      risks.push('⚠ Stale setup (' + Math.floor(age/60) + 'm old): may be invalidated');
      riskScore += 10;
    }

    /* One-sided market risk */
    if (regime.momentum === 'STRONG'){
      risks.push('⚠ Strong momentum: potential for stop hunts');
      riskScore += 8;
    }

    /* Liquidity risk: incomplete price levels */
    if (!isFinite(fin(setup.stop)) || !isFinite(fin(setup.t1))){
      risks.push('✗ Missing price levels: cannot trade');
      riskScore += 30;
    }

    return {
      riskScore: riskScore,  /* 0-100, higher = more risk */
      riskLevel: riskScore > 30 ? 'HIGH' : riskScore > 15 ? 'MEDIUM' : 'LOW',
      risks: risks,
      tradeability: riskScore < 40  /* Can trade if risk < 40 */
    };
  }

  /* Update open crypto setups from forward log */
  function omniUpdateOpenSetups(){
    try {
      var now = Date.now() / 1000;
      var open = [];
      var barTMap = {};
      var evidenceCache = {};
      var livePrice = 0;  /* Crypto would need specific pair price */

      if (typeof localStorage === 'undefined'){
        __omni.openSetups = [];
        return;
      }

      var raw = localStorage.getItem('hg_forward_v1');
      if (!raw){
        __omni.openSetups = [];
        return;
      }

      var allRecs = JSON.parse(raw);
      if (!Array.isArray(allRecs)) allRecs = [];

      allRecs.forEach(function(rec){
        if (!rec || !rec.barT || !rec.entry) return;
        if (rec.state && rec.state !== 'open') return;
        if (rec.tab && rec.tab.indexOf('OMNI') === -1) return;  /* Only crypto */

        var age = now - rec.barT;
        if (age < 0) age = 0;

        barTMap[rec.barT] = (barTMap[rec.barT] || 0) + 1;

        var entry = fin(rec.entry);
        var tp = fin(rec.t1);
        var sl = fin(rec.stop);
        var status = 'active';
        var isClosed = false;

        if (livePrice > 0 && entry > 0){
          if (entry > tp){  /* SHORT */
            if (livePrice >= sl) { status = 'stopped'; isClosed = true; }
            else if (livePrice <= tp) { status = 'profit'; isClosed = true; }
            else if (livePrice < entry) { status = 'pending'; }
            else { status = 'active'; }
          } else {  /* LONG */
            if (livePrice <= sl) { status = 'stopped'; isClosed = true; }
            else if (livePrice >= tp) { status = 'profit'; isClosed = true; }
            else if (livePrice > entry) { status = 'pending'; }
            else { status = 'active'; }
          }
        }

        if (isClosed && age > 300) return;

        var gateConf = fin(rec.stack3) || 0;
        var mechKey = rec.mechanic || 'default';
        var evidence = evidenceCache[mechKey];
        if (!evidence){
          evidence = { wilson: { lo: 0.50, hi: 0.70, p: 0.60 }, samples: 0, hit: 0.60, source: 'crypto' };
          evidenceCache[mechKey] = evidence;
        }

        var checks = {
          htfRegime: rec.htf_confirm === true,
          gate1h: rec.regime_fit === true,
          corrNorm: rec.corrRegime !== 'EXTREME',
          drawdownOk: true,
          riskReward: fin(rec.t1 - rec.entry) / fin(rec.stop - rec.entry) >= 1.5 || isNaN(fin(rec.t1 - rec.entry))
        };
        var checksPass = Object.keys(checks).filter(function(k){ return checks[k]; }).length;

        var techScore = (gateConf / 3 * 40) + (checks.htfRegime ? 30 : 0) + 30;
        var sentScore = 60;  /* Default neutral for crypto */
        var fundScore = age < 30 * 60 ? 65 : age > 4 * 3600 ? 35 : 50;
        var composite = (techScore * 0.4) + (sentScore * 0.35) + (fundScore * 0.25);

        /* AI Market Intelligence */
        var aiRegime = omniAIDetectMarketRegime(1.0, 'ranging', 0.3);
        var aiSignalQuality = omniAISignalQuality(checks, aiRegime, evidence.hit || 0.5);
        var aiRiskAssess = omniAIRiskAssessment(rec, aiRegime, age);
        var aiPositioning = omniAICalculatePositionSize(10000, 0.02, 1.0, evidence.hit || 0.5);
        var aiSmartLevels = omniAISmartLevels(entry, sl, aiRegime, evidence.hit || 0.5);

        open.push({
          barT: rec.barT, entry: entry, t1: tp, stop: sl, age: age,
          pnl: isFinite(fin(rec.r)) ? fin(rec.r) : NaN,
          status: rec.state || 'open', tradeStatus: status,
          mechanic: rec.mechanic || rec.symbol || '—',
          symbol: rec.symbol || '—',
          gateConf: gateConf,
          evidence: evidence,
          checks: checks, checksPass: checksPass, readyToEnter: checksPass === 5,
          technicalScore: Math.min(100, techScore),
          sentimentScore: sentScore,
          fundamentalScore: Math.min(100, fundScore),
          compositeScore: Math.min(100, composite),
          corrRegime: rec.corrRegime || 'NORMAL',
          isCorrelated: barTMap[rec.barT] >= 2,
          /* AI Intelligence */
          aiRegime: aiRegime,
          aiSignalQuality: aiSignalQuality,
          aiRiskAssessment: aiRiskAssess,
          aiPositioning: aiPositioning,
          aiSmartLevels: aiSmartLevels,
          aiTradeability: aiRiskAssess.tradeability
        });
      });

      open.sort(function(a, b){
        if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
        if (b.gateConf !== a.gateConf) return b.gateConf - a.gateConf;
        return b.age - a.age;
      });

      __omni.openSetups = open;
    } catch (e){
      __omni.openSetups = [];
    }
  }

  function refreshOmniroute(){
    omniUpdateOpenSetups();  /* Update pro-trader setups */
    var ui = __omni.ui;
    if (ui) omniPaintProTrader(ui, __omni.openSetups);  /* Paint pro-trader panel */

    return Promise.resolve().then(function(){
      if (__omni.busy) return 'busy';
      if (!__omni.ran) return 'skipped: not run yet';
      if (__omni.snap && isFinite(__omni.snap.at) && (Date.now() - __omni.snap.at) < OMNI_FRESH_MS)
        return 'skipped: fresh';
      var ui = __omni.ui;
      if (ui) return runScan(ui).then(function(){
        omniUpdateOpenSetups();
        if (ui) omniPaintProTrader(ui, __omni.openSetups);
        return __omni.lastStat || 'rescanned';
      });
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
    /* Conviction roster — six formation-time mechanics (>= 3 confirmations,
       structural stop, formation cost gate baked into formation). Exported
       so each is testable/replayable on its own rows, like the native six. */
    window.hgOmniHtfPullback = hgOmniHtfPullback;
    window.hgOmniDonchianDrive = hgOmniDonchianDrive;
    window.hgOmniAvwapDefend = hgOmniAvwapDefend;
    window.hgOmniCompressionBreak = hgOmniCompressionBreak;
    window.hgOmniSweepReclaim = hgOmniSweepReclaim;
    window.hgOmniExhaustRevert = hgOmniExhaustRevert;
    window.hgOmniFormCostGate = hgOmniFormCostGate;
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
    /* Exported so the plain-language read is testable apart from a live scan. */
    window.hgOmniDeskRead = hgOmniDeskRead;
    window.hgOmniPoolRead = hgOmniPoolRead;
    /* Gold's table already calls hgOmniPoolRead; it printed the raw sample
       figure and so lacked the "too small to confirm" guard this has. */
    window.hgOmniNeedText = needText;
    /* The three techniques the coverage table used to list without an
       implementation. Exported so each can be checked on its own numbers
       rather than only through a scan. */
    window.hgOmniVolTarget = hgOmniVolTarget;
    window.hgOmniCvd = hgOmniCvd;
    window.hgOmniLiqMap = hgOmniLiqMap;
    window.hgOmniGates = hgOmniGates;
    window.hgOmniGrade = hgOmniGrade;
    /* P0 Solidity Framework Scoring Functions */
    window.hgOmniOrderBlockScore = hgOmniOrderBlockScore;
    window.hgOmniFvgScore = hgOmniFvgScore;
    window.hgOmniMultiTfCascadeScore = hgOmniMultiTfCascadeScore;
    window.hgOmniRiskRewardScore = hgOmniRiskRewardScore;
    /* P1 Solidity Framework Scoring Functions */
    window.hgOmniRegimeScore = hgOmniRegimeScore;
    window.hgOmniAtrExpansionScore = hgOmniAtrExpansionScore;
    window.hgOmniSessionTimingScore = hgOmniSessionTimingScore;
    /* P2 Solidity Framework Scoring Functions */
    window.hgOmniLiquidationScore = hgOmniLiquidationScore;
    window.hgOmniExpectancyScore = hgOmniExpectancyScore;
    /* P3 Solidity Framework Scoring Functions */
    window.hgOmniOrderFlowScore = hgOmniOrderFlowScore;
    window.hgOmniStructureConfluenceScore = hgOmniStructureConfluenceScore;
    window.hgOmniMomentumConvergenceScore = hgOmniMomentumConvergenceScore;
    /* P4 Solidity Framework Scoring Functions */
    window.hgOmniLiquidationRecoveryScore = hgOmniLiquidationRecoveryScore;
    window.hgOmniVolTermScore = hgOmniVolTermScore;
    window.hgOmniRiskAdjustedScore = hgOmniRiskAdjustedScore;
    /* P5 Solidity Framework Scoring Functions — framework complete at 200 pts */
    window.hgOmniSectorMomentumScore = hgOmniSectorMomentumScore;
    window.hgOmniMultiAssetScore = hgOmniMultiAssetScore;
    window.hgOmniNewsCalendarScore = hgOmniNewsCalendarScore;
    window.hgOmniSolidityScore = hgOmniSolidityScore;
    /* Full-data stamp builder — the compact {score,maxScore,tier,detail}
       every candidate card/gate prefers over the starved recompute. */
    window.hgOmniSolidityStamp = hgOmniSolidityStamp;
    /* Solidity feed producers (hg-v533) — orderFlow from the real Binance
       taker series, regimeStruct from the structural detectRegime read.
       Exported so harnesses/tests measure the SHIPPED producers. */
    window.hgOmniOrderFlowFeed = hgOmniOrderFlowFeed;
    window.hgOmniRegimeStructFeed = hgOmniRegimeStructFeed;
    window.hgOmniAttachSolidityFeeds = hgOmniAttachSolidityFeeds;
    /* Replay calibration additions — cost-to-stop drag, the (currently
       withheld) measured probability, and the card badge builder. The
       round-trip cost default is overridable via window.HG_OMNI_RT_COST_PCT. */
    window.hgOmniCostDrag = hgOmniCostDrag;
    window.hgOmniMeasuredProb = hgOmniMeasuredProb;
    window.hgOmniSolidityBadgesHtml = hgOmniSolidityBadgesHtml;
    /* 20X leverage-safe subset — display/signal only, never execution.
       Constants overridable via window.HG_OMNI_20X_LEV / _MMR_PCT /
       _STOP_SAFETY / _NOISE_ATR_MULT / _SOLIDITY_FLOOR, read at call time. */
    window.hgOmni20xQualify = hgOmni20xQualify;
    window.hgOmni20xSectionHtml = hgOmni20xSectionHtml;
    /* 20X evolution helpers — the safe band, the 1h re-plan, the full gate
       run on one geometry, the forward-paid quality read, and the near-miss
       diagnosis. Exported so each is testable apart from a live scan. */
    window.hgOmni20xBand = hgOmni20xBand;
    window.hgOmni20xReplan = hgOmni20xReplan;
    window.hgOmni20xGateRun = hgOmni20xGateRun;
    window.hgOmni20xForwardPaid = hgOmni20xForwardPaid;
    window.hgOmni20xExplain = hgOmni20xExplain;
    /* APEX stacked-edge tier — the six-rule qualifier, the collected-fails
       diagnostic behind the near-miss line, and the section renderer.
       Display/signal only, never execution; every printed number is a
       measured stat the app already tracks. */
    window.hgOmniApexQualify = hgOmniApexQualify;
    window.hgOmniApexCheck = hgOmniApexCheck;
    window.hgOmniApexSectionHtml = hgOmniApexSectionHtml;
    window.hgOmniMarketSide = hgOmniMarketSide;
    window.hgOmniMarketSideHtml = hgOmniMarketSideHtml;
    window.hgOmniEvaluate = hgOmniEvaluate;
    window.hgOmniPlanForHit = hgOmniPlanForHit;
    window.hgOmniConsensusVoters = hgOmniConsensusVoters;
    window.hgOmniIsReversion = hgOmniIsReversion;
    /* The scan loop itself, so the stability test can run a full universe
       through the real pipeline instead of trusting source inspection. */
    window.hgOmniRunScan = runScan;
    window.hgOmniRank = hgOmniRank;
    window.hgOmniInfoNet = hgOmniInfoNet;
    window.hgOmniBalanceScore = hgOmniBalanceScore;
    window.hgOmniDeskOrder = hgOmniDeskOrder;
    window.hgOmniPickFew = hgOmniPickFew;
    window.hgOmniHouseHits = hgOmniHouseHits;
    window.hgOmniMostProbablePanelHtml = hgOmniMostProbablePanelHtml;
    /* research half */
    window.hgOmniGateInventory = hgOmniGateInventory;
    window.hgOmniRoster = hgOmniRoster;
    window.hgOmniCoverage = hgOmniCoverage;
    window.hgOmniCoverageMatrix = hgOmniCoverageMatrix;
    window.hgOmniRenderCoverageMatrix = hgOmniRenderCoverageMatrix;
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
