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
  /* Daily EMA periods sized to the daily bars BARS x TF actually yields
     (180 x 4h ~= 31 days). Asking for a 50-period daily EMA silently
     disabled the gate on every card. */
  /* Which detector families trade AGAINST the prevailing trend. Used so the
     trend gates grade each setup against the right model. */
  var REVERSION_KINDS = { SPRING:true, UTAD:true, VALUE:true, ABSORB:true };

  var DAILY_FAST = 10;
  var DAILY_SLOW = 21;

  var __omni = { ui: null, busy: false, ran: false, snap: null, lastStat: '' };

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
    var sec = TF_SEC[tf] || 0;
    if (!sec) return rows;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return rows;
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
  function hgOmniDetect(rows){
    var out = [];
    if (!rows || rows.length < 30) return out;
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
  function hgOmniWalkForward(rows, idx, dir, rMult, horizon){
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
      if (hitStop && hitT1) return 'stop';       // conservative, see above
      if (hitStop) return 'stop';
      if (hitT1) return 't1';
    }
    return 'open';
  }

  /* Replay ONE detector across the fetched history and measure it.
     detectFn(prefixRows) -> hit|null, exactly the live detectors' shape, so
     what is measured is what is traded. Pure given rows. */
  function hgOmniBacktestOne(rows, detectFn, opts){
    opts = opts || {};
    var rMult = opts.rMult || MIN_RR, horizon = opts.horizon || 20;
    var warm = opts.warm || 45;
    var wins = 0, losses = 0, open = 0, i, hit, res;
    if (!rows || rows.length < warm + horizon + 2) return null;
    for (i = warm; i < rows.length - horizon; i++){
      try { hit = detectFn(rows.slice(0, i + 1)); } catch (e) { hit = null; }
      if (!hit) continue;
      res = hgOmniWalkForward(rows, i, hit.dir, rMult, horizon);
      if (res === 't1') wins++;
      else if (res === 'stop') losses++;
      else if (res === 'open') open++;
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
  function hgOmniGates(rows, hit, positioning, extra){
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
    var mv = meanVol(rows.slice(0, rows.length - 1), 20), lv = num(rows[rows.length - 1].v);
    var partOk = (isFinite(mv) && isFinite(lv) && mv > 0) ? (lv >= mv * 0.7) : null;
    gates.push({ key:'participation', hard:true, pass: partOk,
      why: (isFinite(mv) && isFinite(lv) && mv > 0) ? ('trigger vol ' + (lv/mv).toFixed(2) + '× 20-bar mean') : 'volume unavailable' });

    /* 4 — funding sanity: never add to the crowded side of an extreme.
       CoinDCX reports no funding, so this legitimately stays unknown. */
    var f = positioning ? fin(positioning.fundingPct) : NaN;
    var fundOk = null, fundWhy = 'funding not reported by venue';
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
    var oi = null, oiWhy = 'OI not published for this contract';
    var oiCh = x.oi ? fin(x.oi.changePct) : NaN;
    if (isFinite(oiCh)){
      oi = oiCh > -3;              // collapsing OI = the move is being unwound
      oiWhy = 'OI ' + (oiCh >= 0 ? '+' : '') + oiCh.toFixed(1) + '% over the window'
            + (oi ? '' : ' — unwinding, not building');
    }
    gates.push({ key:'oi-build', hard:false, pass: oi, why: oiWhy });

    /* 7 — retail crowding as a CONTRARIAN read: when the retail account
       majority already sits on our side at an extreme, the fuel is spent. */
    var rc = null, rcWhy = 'retail long/short not published';
    var lp = x.retail ? fin(x.retail.longPct) : NaN;
    if (isFinite(lp)){
      var crowdedWithUs = (hit.dir === 'long' && lp >= 75) || (hit.dir === 'short' && lp <= 25);
      rc = !crowdedWithUs;
      rcWhy = 'retail ' + lp.toFixed(0) + '% long' + (crowdedWithUs ? ' — crowded on our side' : '');
    }
    gates.push({ key:'retail-contrarian', hard:false, pass: rc, why: rcWhy });

    /* 8 — taker aggression should not lean against the setup */
    var tk = null, tkWhy = 'taker flow not published';
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
    var lq = null, lqWhy = 'reference order book not available for this contract';
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
    var nw = null, nwWhy = 'news module has not run';
    if (x.news && x.news.risk){
      nw = !(x.news.blackout === true || String(x.news.risk) === 'high');
      nwWhy = 'news risk ' + x.news.risk + (nw ? '' : ' — blackout window');
    }
    gates.push({ key:'news-window', hard:false, pass: nw, why: nwWhy });

    /* 12 — measured edge: this detector's own pooled walk-forward result.
       Not a veto on thin evidence — under MIN_SAMPLES it stays UNCHECKED
       rather than pretending 3 trades mean anything. */
    var ed = null, edWhy = 'not yet measured';
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
      var pBreak = 1 / (1 + MIN_RR);
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
        /* Significantly negative, but on too thin a pool to act on. */
        ed = true;
        edWhy = stat + zTxt + ' — below breakeven, but only ' + sN + ' samples: too few to veto on';
      } else {
        ed = true;
        edWhy = stat + zTxt + (z < 0 ? ' — below breakeven but within noise' : '');
      }
    }
    gates.push({ key:'measured-edge', hard:false, pass: ed, why: edWhy });

    return gates;
  }

  /* Ticket requires: every HARD gate an explicit pass, and no evaluable veto
     anywhere. An unevaluable CONDITIONAL gate degrades the card (reported in
     `degraded`) but does not stand it aside — see the note on hgOmniGates.
     An unevaluable HARD gate still blocks, because those are computable on
     both venues and a missing one means the data itself was bad. Pure. */
  function hgOmniGrade(gates){
    var vetoes = [], hardUnknown = [], degraded = [], i, g;
    for (i = 0; i < gates.length; i++){
      g = gates[i];
      if (g.pass === false) vetoes.push(g.key);
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
      verdict: vetoes.length ? ('VETO — ' + vetoes.join(', '))
             : (hardUnknown.length ? ('WATCH — no data: ' + hardUnknown.join(', '))
             : (degraded.length ? ('CLEAN · unchecked: ' + degraded.join(', ')) : 'CLEAN'))
    };
  }

  /* Whole per-symbol evaluation: detectors -> gates -> plan. Pure given
     rows; hgPlanLevels is looked up defensively and NaN-safe. */
  function hgOmniEvaluate(item, rows, positioning, extra){
    var hits = hgOmniDetect(rows), out = [], i;
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
      exForHit.exchange = item && item.exchange;
      exForHit.regimeWarm = ex.regimeWarm;
      var gates = hgOmniGates(rows, hit, positioning, exForHit);
      var grade = hgOmniGrade(gates);
      var plan = null;
      if (planFn){
        try { plan = planFn(hit.dir, rows, undefined, { minRr: MIN_RR, type: 'OMNI' }); }
        catch (e) { plan = null; }
      }
      /* The global hgPlanLevels wrapper (index.html) forwards only
         {dir,entry,stop,t1,t2,risk,note,...} — it DROPS rr1/rr2/riskPct from
         hgPlanLevelsCore. Reading plan.rr1 therefore gave undefined, which
         rendered as "R:R —" and, worse, made hgOmniRank sort every card by
         NaN: the tab claimed to order by R:R while ordering by nothing.
         Derive both from fields the wrapper does provide. */
      if (plan) plan = hgOmniDerivePlan(plan);
      out.push({
        sym: item && item.sym, base: item && item.base, exchange: item && item.exchange,
        kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        rr: (plan && isFinite(plan.rr1)) ? plan.rr1 : NaN
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
    var entry = num(out.entry), stop = num(out.stop), t1 = num(out.t1), t2 = num(out.t2);
    /* Risk is derived from the levels the card actually PRINTS, never from
       plan.risk. Live cards showed R:R 14.72 / 11.35 / 9.57 whose true value
       was 2.00 in every case — a 5-7x overstatement that also drove the
       ranking. The wrapper's `risk` field is stale with respect to the entry
       it reports (hgPlanLevelsCore's exact-entry pass moves entry/t1/t2 and
       leaves risk behind), so entry/stop are the only self-consistent
       source. If the numbers on the card disagree with each other, the card
       is lying; deriving from what is shown makes that impossible. */
    var risk = Math.abs(entry - stop);
    if (isFinite(risk) && risk > 0){
      /* Recomputed unconditionally — a stale rr1/riskPct from the wrapper
         must not win over the geometry actually displayed. */
      if (isFinite(t1)) out.rr1 = Math.abs(t1 - entry) / risk;
      if (isFinite(t2)) out.rr2 = Math.abs(t2 - entry) / risk;
      if (isFinite(entry) && entry > 0) out.riskPct = risk / entry * 100;
      out.risk = risk;
    }
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
      var ae = (a.grade && a.grade.evaluated) || 0, be = (b.grade && b.grade.evaluated) || 0;
      if (be !== ae) return be - ae;
      var ar = isFinite(a.rr) ? a.rr : -1, br = isFinite(b.rr) ? b.rr : -1;
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
  function fmt(n, d){ return isFinite(n) ? (+n).toFixed(d == null ? 4 : d) : '—'; }

  /* Price formatting scaled to magnitude. A flat 4 decimals rendered
     1000BONK as ENTRY 0.0023 / STOP 0.0024 — one apparent tick apart, with
     the real distance rounded away. Sub-cent perps are most of the CoinDCX
     universe, so fixed precision is not a cosmetic problem: it made the
     plan unreadable exactly where the stop matters most. */
  function fmtPx(n){
    var v = +n;
    if (!isFinite(v)) return '—';
    var a = Math.abs(v);
    var d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9;
    return v.toFixed(d);
  }
  function pill(txt, cls){ return '<span class="gpip ' + (cls || '') + '">' + esc(txt) + '</span>'; }

  function gateLine(g){
    var cls = g.pass === true ? 'ok' : (g.pass === false ? 'bad' : '');
    /* an unevaluable CONDITIONAL gate reads UNCHECKED, not UNKNOWN — the
       distinction matters: it did not fail, it never ran. */
    var mark = g.pass === true ? 'PASS'
             : (g.pass === false ? 'VETO' : (g.hard ? 'NO DATA' : 'UNCHECKED'));
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

  /* Pooled walk-forward result per detector. This is the tab's honest
     self-assessment: which of the six mechanics actually resolved to T1
     before stop on the history just scanned. Thin pools are labelled rather
     than rounded into a confident-looking percentage. */
  function renderPooled(pool){
    if (!pool) return '';
    var keys = ['SPRING','PO3','ORB','ABSORB','VALUE','MMOVE'], h, i, k, p;
    h = '<table class="tbl"><thead><tr><th>DETECTOR</th><th>SAMPLES</th><th>T1-FIRST</th><th>EXPECTANCY</th><th>READ</th></tr></thead><tbody>';
    for (i = 0; i < keys.length; i++){
      k = keys[i]; p = pool[k];
      if (!p || !p.samples){
        h += '<tr><td><b>' + k + '</b></td><td class="dim">0</td><td class="dim">—</td><td class="dim">—</td><td class="dim">never fired in this history</td></tr>';
        continue;
      }
      var thinPool = p.samples < MIN_SAMPLES;
      var read = thinPool ? 'too few to judge' : (p.expR > 0 ? 'has paid' : 'has not paid');
      var cls = thinPool ? '' : (p.expR > 0 ? 'ok' : 'bad');
      h += '<tr><td><b>' + k + '</b></td>'
        + '<td>' + p.samples + '</td>'
        + '<td>' + (p.hit * 100).toFixed(0) + '%</td>'
        + '<td>' + (p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R</td>'
        + '<td>' + pill(read, cls) + '</td></tr>';
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
    return warmRegime().then(function(){ return W.xuUniverse(); })
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
            var hits = hgOmniDetect(rows);
            if (hits.length) fired.push({ item: item, rows: rows, hits: hits });
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
        var subset = fired.slice(0, ENRICH_MAX);
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
            if (!ex.regime) ex.regimeWarm = __omni.regimeWarm || null;
            var pos = null;
            if (typeof W.xuPositioning === 'function'){
              try { pos = W.xuPositioning(fitem.base || fitem.sym); } catch (er) { pos = null; }
            }
            var found = hgOmniEvaluate(fitem, fired[j].rows, pos, ex);
            for (k = 0; k < found.length; k++) cands.push(found[k]);
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
        for (i = 0; i < ranked.length; i++) if (ranked[i].grade && ranked[i].grade.ticket) tickets++;
        __omni.lastStat = ranked.length + ' setup(s) · ' + tickets + ' ticket(s) · ' + res.scanned + ' contracts scanned';
        var caveat = '';
        if (res.pass1Err) caveat += '  · pass 1 interrupted (' + res.pass1Err + ') — partial cover at ' + res.pass1Done + '/' + res.scanned;
        if (res.fired > res.enriched) caveat += '  · ' + (res.fired - res.enriched) + ' of them show hard gates + plan only (per-symbol confluence capped at ' + ENRICH_MAX + ' names)';
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
        var h = '';
        for (i = 0; i < ranked.length; i++){
          try { h += setupCard(ranked[i]); }
          catch (eC){
            try{ console.warn('omniroute card render skipped', ranked[i] && ranked[i].sym, eC); }catch(eC2){}
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
      + '<div class="row"><button class="btn" id="omniRun">RUN FULL SCAN (ALL CONTRACTS)</button></div>'
      + '<div class="note" id="omniStat">idle — press RUN. Full coverage is ~200+ Delta contracts plus CoinDCX, so expect a few minutes; progress shows per pass.</div>'
      + '<div class="note warn" id="omniWarn" style="display:none"></div>'
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
      istat: el.querySelector('#omniIStat'), iout: el.querySelector('#omniIOut')
    };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __omni.ui = ui;

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
