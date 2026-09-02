/* =========================================================================
HARDGATE — goldind.js
GOLD SCALP indicator engine: pure, DOM-free, fetch-free Smart-Money-Concept
and classical detectors for gold scalping, plus the confluence composite
goldScalpSetup. Loaded as a classic script BEFORE goldscalp.js.

Every export is TOTAL: never throws, tolerates null/empty/short/flat/garbage
input, and returns null (or a 'NONE' state) when there is no signal — nothing
is ever fabricated. Indicator math reuses indicators.js/indicators2.js globals
(ema/atr/rsi) when they are loaded and falls back to identical local copies
when they are not, so this file also works standalone in vm test contexts.

Candle rows everywhere: {t:<unix seconds>, o,h,l,c,v}, ascending.

Exports (all on window):
  goldFVG(rows)            — 3-candle Fair Value Gaps, unmitigated only
  goldOrderBlocks(rows)    — order blocks (last opposing candle before a
                             >=1.5xATR displacement through a 20-bar swing)
                             + breaker blocks (failed OB closed through ->
                             bias flip)
  goldSweeps(rows)         — liquidity sweeps: wick beyond a prior 25-bar
                             swing high/low, close back inside -> reversal
  goldKillzone(date|ms|s)  — ICT killzone stamp (London/NY overlap highest)
  goldVWAP(rows, anchor)   — anchored VWAP + 1 vol-sigma bands + close side
  goldRibbon(rows)         — EMA 20/50/200 mode; below 200 -> sellOnly
  goldIchimoku(rows)       — price vs cloud, cloud thickness = S/R strength
  goldMFI(rows)            — BW Market Facilitation Index bar colour
                             (GREEN = volume-driven trend, SQUAT/pink = high
                             volume + low range = manipulation/breakout watch)
  goldVolSqueeze(rows)     — Bollinger-inside-Keltner squeeze + the expansion
                             close outside the bands
  goldAsianRange(rows)     — 00:00-08:00 UTC box + London breakout state
  goldRSIGold(rows)        — RSI(14) with gold 75/25 extremes + price/RSI
                             divergence (exhaustion)
  goldCCI(rows)            — CCI(20) +/-100 extremes + zero-line cross
  goldStochRSI(rows)       — StochRSI pullback timer (only meaningful inside
                             an established trend — the composite enforces it)
  goldSeason(date|ms|s)    — seasonal bias note (Jan-Feb strongest, spring/
                             early-summer consolidation); context, never a vote
  goldScalpSetup({rows15m, rows1h, rows4h, now, news}) — the composite:
                             >=3 independent agreeing reads -> {dir, entry,
                             stop, t1, t2, rr, grade, strategy, confluence,
                             killzone, newsCaution}; stops 1.5-2x ATR(14) 15m
                             (never tighter), targets 1.5R/2.5R snapped to
                             opposing swept structure when one sits between
                             entry and target. Long/short symmetric.
  goldScalpSetups(same inp)  — MULTI-STRATEGY candidates: one candidate per
                             strategy trigger (sweep reversal, OB/breaker
                             retest, FVG fill, session-VWAP bounce/rejection,
                             EMA ribbon pullback, Asian-range breakout, RSI
                             75/25 divergence), each with ATR-stop levels,
                             1.5R/2.5R targets, a deterministic STRUCTURAL
                             conviction id (strategy|dir|structural anchor
                             rounded to whole dollars — swept level / OB edge
                             / FVG edge / session VWAP / 20-EMA / Asian box
                             edge / divergence pivot; entry drift INSIDE the
                             same zone reproduces the same id) and plain-
                             language why/invalidates. QUALITY GATES: a
                             realized TP1 < 1.2R after snapping to opposing
                             structure drops the candidate onto the returned
                             array's .rejected side-channel with a named
                             reason ('structure too close — R:R
                             insufficient'); counter-trend (beyond a sloping
                             200-EMA-15m, 4H-stack confirmed; sweep triggers
                             exempt), off-session (killzone weight 0; the
                             Asian-range strategy keeps its own session) and
                             chop (Kaufman ER(20) < 0.25; VWAP/OB/FVG only)
                             DEMOTE candidates (demoted/stamps/gateNotes on
                             the candidate) — demoted setups can never be
                             MOST PROBABLE. -> [] when nothing.
  goldRankSetups(cands, ctx) — transparent confluence tally ranker (reads +
                             killzone weight + news penalty + macro tilt +
                             PAXG-basis positioning + seasonality + F&G).
                             Demoted candidates sink below non-demoted and
                             can never be best; OFF-SESSION-demoted
                             candidates must clear tally >= +2 (normal bar 0
                             + 2) or they land in .rejected with the reason
                             named. -> {ranked, best, rejected}. Pure, total.
  goldNewsCaution(news, now) — shared ±30-min high-impact news-window check
                             -> {caution, title}; the tab vetoes NEW
                             convictions inside the window.
  goldVolumeSpike(rows, index?, lookback?, mult?) — absorption/climax bar:
                             current bar volume > lookback SMA × mult (default
                             20 bars, 1.5×); false on thin/missing volume
  goldVolumeProfile(rows, lookback?, bins?) — volume profile POC + HVNs
                             (mean + 1σ threshold); null when range/volume thin
  goldSweepV2(rows, index?, sweepLb?, volLb?, mult?) — V2 liquidity sweep:
                             wick beyond prior-N-bar extreme + reclaim + volume
                             climax; -> {trigger, dir, anchor, type, level} | {trigger:false}
  goldFVGV2(rows, index?, vprof?) — V2 FVG: 3-candle gap with HVN launchpad
                             inside/near the gap zone; -> {trigger,...}|{trigger:false}
  goldFVGHasHVNSupport(gap, vprof) — true when an HVN sits at/below/inside gap
  isVolumeSpike / buildVolumeProfile — aliases of goldVolumeSpike / goldVolumeProfile
  detectLiquiditySweep_V2 / detectFVG_V2 — aliases of goldSweepV2 / goldFVGV2
  HardgateGoldEngine.evaluateScalp(m15, ctx?) — vol profile + V2 triggers + OB retest
                             + Asian breakout + ADR fade on the last bar
                             -> {volProfile, sweepData, fvgData, obSetup, asianSetup,
                             adrFade, adrData, session, asianRange, swings, structure,
                             activeOrderBlocks, activeTriggers, agreeingReads, macroHint,
                             ker, paxgBasis, newsState, confluenceTally, valid, vetoReason,
                             isChop, context, reads}
  HardgateGoldEngine.evaluateSwing(h4, ctx?) — 4h swing evaluator (structure + OB retest)
  goldSwings(rows, left?, right?) — fractal swing highs/lows -> {highs, lows}
  goldMarketStructure(rows, swings?, left?, right?) — HH/HL BOS + CHOCH vs swings
  goldOrderBlockAt(rows, index?, atr?) — displacement OB at one bar index
  goldActiveOrderBlocks(rows, atr?, endIndex?) — unmitigated OB zones through end bar
  goldUpdateActiveZones(rows, index?, atr?) — {activeOrderBlocks} at index (stateless scan)
  goldOrderBlockRetest(rows, index?, structure?, activeObs?) — structure-aligned OB retest
  detectSwings / detectMarketStructure / detectOrderBlocks — SMC aliases
  updateActiveZones / detectOrderBlockRetest — robust OB retest aliases
  getMarketSession(ts) / calculateAsianRange(rows, index?) / calculateADRExhaustion(daily, current?, lb?)
                             — session weights, Asian H/L tracker, daily ADR exhaustion (≥80%)
  calculateMacroHint(dxyCandles, currentDxy?) — intraday DXY open/close hint for gold:
                             bearish DXY bar -> TAILWIND (weak dollar favors longs);
                             bullish DXY bar -> HEADWIND; else NEUTRAL
  goldCalculateMacroHint — alias of calculateMacroHint
  calculateGoldSpotBasis(paxg, spotXau) — PAXG vs spot basis state + tally (±0.15%)
  calculateKaufmanER(candles, lookback?) — {er, isChop} Kaufman ER (chop < 0.25)
  NewsWindowGuard — high-impact ±30m news window checker (setUpcomingEvents)
  calculatePositionSize(balance, riskPct, entry, stop) — risk-based position sizing
  goldAttachPositionSize(setup, balance, riskPct) — attach positionSize to a setup
  evaluateFundingRate(rate, direction) — perp funding ±1 tally for swing holds (>0.03%/interval)
  TickBuffer — live trade tick buffer with CVD (15m rolling window)
  handleOrderUpdate(setup, exchangeStatus) — partial-fill state machine for limit orders
  detectSMTDivergence(xau, xag, index?, lb?) — gold–silver SMT sweep divergence
  validateYieldCorrelation(us10y, direction) — macro veto when gold fights US10Y trend
  validateOBWithCVD(obSetup, tickBuffer) — order-flow veto on OB retest via CVD
  calculateOrderBookImbalance(l2Book, depth?) — L2 OBI + bullish/bearish liquidity flags
  validateDomLiquidity(direction, l2Book, depth?) — L2 veto when book skews against trade
  evaluateTimeDecay(setup, candle, barIndex?, maxBars?) — scalp momentum decay manager
  calculateDynamicThresholds(daily, lookback?) — rolling vol/ATR z-score regime thresholds
  goldAsianBreakout / goldADRFade — volume-validated Asian breakout + ADR exhaustion fade
  detectAsianBreakout / detectADRFade — session & exhaustion trigger aliases
  goldMarketSession / goldAsianRangeAt / goldADRExhaustion — session module aliases
  goldDetectorReads({rows15m,...}) — full confluence ledger reads from __goldBundle
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

/* ---------------- local indicator fallbacks (identical math to indicators.js) ---------------- */
function __emaLocal(vals, p){
  var out = new Array(vals.length).fill(NaN);
  if (!vals || vals.length < p) return out;
  var k = 2/(p+1), sum = 0, i;
  for (i = 0; i < p; i++) sum += vals[i];
  var e = sum/p;
  out[p-1] = e;
  for (i = p; i < vals.length; i++){ e = vals[i]*k + e*(1-k); out[i] = e; }
  return out;
}
function __rsiLocal(vals, p){
  p = p || 14;
  var out = new Array(vals.length).fill(NaN);
  if (!vals || !vals.length) return out;
  var g = 0, l = 0;
  for (var i = 1; i < vals.length; i++){
    var d = vals[i] - vals[i-1];
    if (i <= p){
      g += Math.max(d, 0); l += Math.max(-d, 0);
      if (i === p){ out[i] = (g === 0 && l === 0) ? 50 : 100 - 100/(1 + (g/p)/((l/p) || 1e-12)); g /= p; l /= p; }
    } else {
      g = (g*(p-1) + Math.max(d, 0))/p; l = (l*(p-1) + Math.max(-d, 0))/p;
      out[i] = (g === 0 && l === 0) ? 50 : 100 - 100/(1 + g/(l || 1e-12));
    }
  }
  return out;
}
function __atrLocal(rows, p){
  p = p || 14;
  var out = new Array(rows.length).fill(NaN), a = null;
  for (var i = 1; i < rows.length; i++){
    var r = rows[i], q = rows[i-1];
    if (!r || !q) continue;
    var tr = Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
    if (!isFinite(tr)) continue;
    if (a === null){
      if (i >= p){
        var s = 0, ok = true;
        for (var k = i-p+1; k <= i; k++){
          var rk = rows[k], rj = rows[k-1];
          if (!rk || !rj){ ok = false; break; }
          var tk = Math.max(rk.h - rk.l, Math.abs(rk.h - rj.c), Math.abs(rk.l - rj.c));
          if (!isFinite(tk)){ ok = false; break; }
          s += tk;
        }
        if (ok){ a = s/p; out[i] = a; }
      }
    } else { a = (a*(p-1) + tr)/p; out[i] = a; }
  }
  return out;
}
/* reuse the house implementations when indicators.js is loaded */
var _ema = (typeof ema === 'function') ? ema : __emaLocal;
var _rsi = (typeof rsi === 'function') ? rsi : __rsiLocal;
var _atr = (typeof atr === 'function') ? atr : __atrLocal;

function __rows(rows){
  if (!Array.isArray(rows) || !rows.length) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (r && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c)) out.push(r);
  }
  return out.length ? out : null;
}
function __closes(rows){ return rows.map(function(r){ return r.c; }); }
function __last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }
function __toMs(d){
  try{
    if (d === null || d === undefined) return Date.now();
    if (d instanceof Date) return d.getTime();
    var n = +d;
    if (!isFinite(n)) return NaN;
    return (n < 1e12) ? n*1000 : n;   /* unix seconds -> ms */
  }catch(e){ return NaN; }
}
function __pivots(vals, win){
  var out = [];
  if (!vals || vals.length < 2*win + 1) return out;
  for (var i = win; i < vals.length - win; i++){
    var v = vals[i];
    if (!isFinite(v)) continue;
    var isH = true, isL = true;
    for (var k = 1; k <= win; k++){
      if (!(isFinite(vals[i-k]) && isFinite(vals[i+k]))){ isH = false; isL = false; break; }
      if (!(v > vals[i-k] && v > vals[i+k])) isH = false;
      if (!(v < vals[i-k] && v < vals[i+k])) isL = false;
    }
    if (isH) out.push({ i: i, type: 'high', v: v });
    if (isL) out.push({ i: i, type: 'low', v: v });
  }
  return out;
}
/* Kaufman Efficiency Ratio over the last `win` closes: |net change| divided
   by the sum of absolute bar-to-bar changes. ER -> 1 = clean directional
   move, ER -> 0 = overlapping chop. NaN when there aren't enough closes. */
function __kaufmanER(closes, win){
  try{
    win = win || 20;
    if (!closes || closes.length < win + 1) return NaN;
    var n = closes.length, sum = 0;
    for (var i = n - win; i < n; i++){
      var d = Math.abs(closes[i] - closes[i-1]);
      if (!isFinite(d)) return NaN;
      sum += d;
    }
    var net = Math.abs(closes[n-1] - closes[n-1-win]);
    if (!isFinite(net)) return NaN;
    return sum > 0 ? net/sum : 0;
  }catch(e){ return NaN; }
}

/* ============================ 1) Fair Value Gaps ============================
   3-candle imbalance: bullish gap when low[i+1] > high[i-1] (zone
   [high[i-1], low[i+1]]), bearish when high[i+1] < low[i-1]. Only UNMITIGATED
   gaps are returned (a later bar reaching fully through the zone fills it),
   most recent first. -> [{dir, top, bottom, mid, i, age}] | null. */
function goldFVG(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return null;
    var n = rows.length, out = [];
    var start = Math.max(1, n - 80);
    for (var i = start; i < n - 1; i++){
      var a = rows[i-1], b = rows[i+1];
      var dir = null, top = NaN, bottom = NaN;
      if (b.l > a.h){ dir = 'bullish'; bottom = a.h; top = b.l; }
      else if (b.h < a.l){ dir = 'bearish'; top = a.l; bottom = b.h; }
      if (!dir || !(top > bottom)) continue;
      var filled = false;
      for (var j = i + 2; j < n; j++){
        if (dir === 'bullish' && rows[j].l <= bottom){ filled = true; break; }
        if (dir === 'bearish' && rows[j].h >= top){ filled = true; break; }
      }
      if (!filled) out.push({ dir: dir, top: top, bottom: bottom, mid: (top+bottom)/2, i: i, age: n-1-i });
    }
    if (!out.length) return null;
    out.sort(function(x, y){ return x.age - y.age; });
    return out.slice(0, 5);
  }catch(e){ return null; }
}

/* ======================= 2) Order Blocks + Breakers =======================
   OB = last opposing candle before a displacement bar (range >= 1.5xATR14)
   that closes through the prior 20-bar swing. Unmitigated OBs are demand/
   supply; an OB later CLOSED through is a failed OB -> breaker, bias flips.
   -> {bullish:[{top,bottom,i,age}], bearish:[...], breakers:[{dir,top,bottom,i,age}]} | null. */
function goldOrderBlocks(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return null;
    var n = rows.length;
    var aArr = _atr(rows, 14);
    var bull = [], bear = [], breakers = [];
    var start = Math.max(21, n - 60);
    for (var j = start; j < n - 1; j++){
      var disp = rows[j], ob = rows[j-1], a = aArr[j];
      if (!isFinite(a) || !(a > 0)) continue;
      if (disp.h - disp.l < 1.5 * a) continue;
      var sH = -Infinity, sL = Infinity;
      for (var k = Math.max(0, j - 20); k < j; k++){ if (rows[k].h > sH) sH = rows[k].h; if (rows[k].l < sL) sL = rows[k].l; }
      var dir = null;
      if (disp.c > disp.o && disp.c > sH && ob.c < ob.o) dir = 'bullish';
      else if (disp.c < disp.o && disp.c < sL && ob.c > ob.o) dir = 'bearish';
      if (!dir) continue;
      var top = ob.h, bottom = ob.l, age = n - 1 - j;
      /* mitigation / failure walk */
      var mitigated = false, failedAt = -1;
      for (var m = j + 1; m < n; m++){
        if (dir === 'bullish'){
          if (rows[m].c < bottom){ failedAt = m; break; }        /* closed through -> breaker */
          if (rows[m].l <= bottom){ mitigated = true; break; }   /* wicked through -> filled */
        } else {
          if (rows[m].c > top){ failedAt = m; break; }
          if (rows[m].h >= top){ mitigated = true; break; }
        }
      }
      if (failedAt >= 0){
        breakers.push({ dir: dir === 'bullish' ? 'bearish' : 'bullish', top: top, bottom: bottom, i: j, age: n - 1 - failedAt });
      } else if (!mitigated){
        (dir === 'bullish' ? bull : bear).push({ top: top, bottom: bottom, i: j, age: age });
      }
    }
    bull.sort(function(x, y){ return x.age - y.age; });
    bear.sort(function(x, y){ return x.age - y.age; });
    breakers.sort(function(x, y){ return x.age - y.age; });
    if (!bull.length && !bear.length && !breakers.length) return null;
    return { bullish: bull.slice(0, 3), bearish: bear.slice(0, 3), breakers: breakers.slice(0, 3) };
  }catch(e){ return null; }
}

/* ============================ 3) Liquidity Sweeps ============================
   Wick beyond the prior 25-bar swing high/low, close back inside -> stop
   hunt + reversal. Bullish sweep = swept the swing LOW and reclaimed (long
   fuel); bearish = swept the swing HIGH and rejected.
   -> {dir, level, barsAgo, lowSweep, highSweep, all:[...]} | null (dir = most
   recent sweep within the last 10 bars). */
function goldSweeps(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 27) return null;
    var n = rows.length, all = [];
    var start = Math.max(25, n - 40);
    for (var i = start; i < n; i++){
      var pH = -Infinity, pL = Infinity;
      for (var k = Math.max(0, i - 25); k < i; k++){ if (rows[k].h > pH) pH = rows[k].h; if (rows[k].l < pL) pL = rows[k].l; }
      if (!isFinite(pH) || !isFinite(pL)) continue;
      var r = rows[i], ago = n - 1 - i;
      if (r.l < pL && r.c > pL) all.push({ dir: 'bullish', level: pL, barsAgo: ago });
      else if (r.h > pH && r.c < pH) all.push({ dir: 'bearish', level: pH, barsAgo: ago });
    }
    if (!all.length) return null;
    all.sort(function(x, y){ return x.barsAgo - y.barsAgo; });
    var recent = null, lowSweep = null, highSweep = null;
    for (var q = 0; q < all.length; q++){
      var s = all[q];
      if (recent === null && s.barsAgo <= 10) recent = s;
      if (lowSweep === null && s.dir === 'bullish' && s.barsAgo <= 25) lowSweep = s;
      if (highSweep === null && s.dir === 'bearish' && s.barsAgo <= 25) highSweep = s;
    }
    if (!recent) return { dir: null, level: NaN, barsAgo: null, lowSweep: lowSweep, highSweep: highSweep, all: all.slice(0, 5) };
    return { dir: recent.dir, level: recent.level, barsAgo: recent.barsAgo,
             lowSweep: lowSweep, highSweep: highSweep, all: all.slice(0, 5) };
  }catch(e){ return null; }
}

/* ============================ 4) ICT Killzones ============================
   Always returns a stamp object (never null): London/NY overlap 13:00-17:00
   GMT weights highest (3), London 07:00-10:00 (2), NY AM run-in 10:00-13:00
   (1), Asian range-building and off-hours (0). */
function goldKillzone(d){
  try{
    var ms = __toMs(d);
    if (!isFinite(ms)) return { zone: 'OFF', weight: 0, hourGMT: NaN, label: 'OFF-HOURS' };
    var dt = new Date(ms);
    var h = dt.getUTCHours() + dt.getUTCMinutes()/60;
    var zone = 'OFF', weight = 0, label = 'OFF-HOURS';
    if (h >= 13 && h < 17){ zone = 'OVERLAP'; weight = 3; label = 'LONDON/NY OVERLAP'; }
    else if (h >= 7 && h < 10){ zone = 'LONDON'; weight = 2; label = 'LONDON KILLZONE'; }
    else if (h >= 10 && h < 13){ zone = 'NY_AM'; weight = 1; label = 'NY AM'; }
    else if (h >= 0 && h < 8){ zone = 'ASIAN'; weight = 0; label = 'ASIAN RANGE'; }
    return { zone: zone, weight: weight, hourGMT: Math.floor(h), label: label };
  }catch(e){ return { zone: 'OFF', weight: 0, hourGMT: NaN, label: 'OFF-HOURS' }; }
}

/** Prefer London-open (07:00 UTC) anchor when in window; else UTC session day. */
function goldSessionAnchor(rows){
  try{
    rows = __rows(rows);
    if (!rows || !rows.length) return -1;
    var G = (typeof window !== 'undefined') ? window : globalThis;
    if (typeof G.hgAnchorIndex === 'function'){
      var londonIdx = G.hgAnchorIndex(rows, 'london');
      if (londonIdx >= 0 && londonIdx < rows.length) return londonIdx;
      var sessIdx = G.hgAnchorIndex(rows, 'session');
      if (sessIdx >= 0 && sessIdx < rows.length) return sessIdx;
    }
    var n = rows.length, tl = rows[n - 1].t;
    if (!isFinite(tl)) return 0;
    var ds = Math.floor(tl / 86400) * 86400;
    for (var ai = n - 1; ai >= 0; ai--){
      var tt = rows[ai].t;
      if (!isFinite(tt) || tt < ds) return Math.min(n - 1, ai + 1);
    }
    return 0;
  }catch(e){ return -1; }
}

/* ============================ 5) Anchored VWAP ============================
   Typical-price VWAP from anchorIndex to the last bar, +/-1 volume-weighted
   sigma bands; pos = last close vs value ('AT' within 0.25 sigma).
   -> {value, upper, lower, stdev, anchor, pos} | null. */
function goldVWAP(rows, anchorIndex){
  try{
    rows = __rows(rows);
    if (!rows) return null;
    var n = rows.length;
    var a = Math.floor(anchorIndex);
    if (!isFinite(a) || a < 0) a = 0;
    if (a >= n) return null;
    var sumWV = 0, sumV = 0, sumTP = 0, cnt = 0, i, r, tp, v;
    for (i = a; i < n; i++){
      r = rows[i]; tp = (r.h + r.l + r.c)/3;
      if (!isFinite(tp)) continue;
      v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      sumWV += tp*v; sumV += v; sumTP += tp; cnt++;
    }
    if (!cnt) return null;
    var val = sumV > 0 ? sumWV/sumV : sumTP/cnt;
    var varSum = 0;
    for (i = a; i < n; i++){
      r = rows[i]; tp = (r.h + r.l + r.c)/3;
      if (!isFinite(tp)) continue;
      v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      varSum += (sumV > 0 ? v : 1) * (tp - val) * (tp - val);
    }
    var sd = Math.sqrt(varSum/(sumV > 0 ? sumV : cnt));
    var c = rows[n-1].c;
    var pos = (sd > 0 && Math.abs(c - val) <= 0.25*sd) ? 'AT' : (c > val ? 'ABOVE' : (c < val ? 'BELOW' : 'AT'));
    return { value: val, upper: val + sd, lower: val - sd, stdev: sd, anchor: a, pos: pos };
  }catch(e){ return null; }
}

/* ============================ 6) EMA ribbon 20/50/200 ============================
   50/200 defines the macro mode; below the 200 -> sellOnly (longs suppressed).
   pullback20 = close within 0.5xATR of the 20 EMA (pullback entry zone).
   -> {mode:'BULL'|'BEAR'|'MIXED'|'NONE', above20, above50, above200, sellOnly,
       pullback20, e20, e50, e200}. */
function goldRibbon(rows){
  var out = { mode: 'NONE', above20: null, above50: null, above200: null,
              sellOnly: false, pullback20: false, e20: NaN, e50: NaN, e200: NaN };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 50) return out;
    var c = __closes(rows), n = c.length;
    var e20 = __last(_ema(c, 20)), e50 = __last(_ema(c, 50)), e200 = __last(_ema(c, 200));
    var cl = c[n-1], a = __last(_atr(rows, 14));
    out.e20 = e20; out.e50 = e50; out.e200 = e200;
    if (!isFinite(cl)) return out;
    if (isFinite(e20)) out.above20 = cl > e20;
    if (isFinite(e50)) out.above50 = cl > e50;
    if (isFinite(e200)){ out.above200 = cl > e200; out.sellOnly = cl < e200; }
    if (isFinite(e20) && isFinite(a) && a > 0) out.pullback20 = Math.abs(cl - e20) <= 0.5*a;
    if (isFinite(e200)){
      if (out.above200 === true && isFinite(e50) && e50 > e200) out.mode = 'BULL';
      else if (out.above200 === false && isFinite(e50) && e50 < e200) out.mode = 'BEAR';
      else out.mode = 'MIXED';
    } else if (isFinite(e20) && isFinite(e50)){
      if (cl > e20 && e20 > e50) out.mode = 'BULL';
      else if (cl < e20 && e20 < e50) out.mode = 'BEAR';
      else out.mode = 'MIXED';
    }
    return out;
  }catch(e){ return out; }
}

/* ============================ 7) Ichimoku cloud ============================
   Unshifted cloud (same convention as indicators2.js ichimoku). Price above/
   below = bull/bear; cloud thickness = S/R strength.
   -> {state:'ABOVE'|'BELOW'|'INSIDE'|'NONE', cloudTop, cloudBot, thickness,
       thickPct, cloudBull, tkCross}. */
function goldIchimoku(rows){
  var out = { state: 'NONE', cloudTop: NaN, cloudBot: NaN, thickness: NaN,
              thickPct: NaN, cloudBull: null, tkCross: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 52) return out;
    var n = rows.length, i, h, l;
    function mid(len, idx){
      var hh = -Infinity, ll = Infinity;
      for (var k = idx - len + 1; k <= idx; k++){
        h = rows[k].h; l = rows[k].l;
        if (!isFinite(h) || !isFinite(l)) return NaN;
        if (h > hh) hh = h; if (l < ll) ll = l;
      }
      return (hh + ll)/2;
    }
    i = n - 1;
    var t = mid(9, i), kj = mid(26, i), sb = mid(52, i);
    if (!isFinite(t) || !isFinite(kj) || !isFinite(sb)) return out;
    var sa = (t + kj)/2;
    var top = Math.max(sa, sb), bot = Math.min(sa, sb), c = rows[i].c;
    out.cloudTop = top; out.cloudBot = bot;
    out.thickness = top - bot;
    out.thickPct = (c > 0) ? (top - bot)/c*100 : NaN;
    out.cloudBull = sa > sb;
    out.tkCross = (t >= kj) ? 'BULL' : 'BEAR';
    out.state = (c > top) ? 'ABOVE' : ((c < bot) ? 'BELOW' : 'INSIDE');
    return out;
  }catch(e){ return out; }
}

/* ======================= 8) Market Facilitation Index =======================
   BW MFI = (h-l)/v. vs the prior bar: GREEN = mfi up + volume up (volume-
   driven trend), SQUAT (pink) = volume up + mfi down (high volume, low range
   = manipulation/breakout watch), FAKE = mfi up + volume down, FADE = both down.
   -> {last, mfi, series:[last <=5 labels]}. */
function goldMFI(rows, opts){
  opts = opts || {};
  var out = { last: 'NONE', mfi: NaN, series: [] };
  if (opts.volumeTrusted === false) return out;
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 2) return out;
    var n = rows.length, labels = [], mfiLast = NaN;
    for (var i = 1; i < n; i++){
      var r = rows[i], q = rows[i-1];
      var v = (isFinite(r.v) && r.v > 0) ? r.v : NaN;
      var vq = (isFinite(q.v) && q.v > 0) ? q.v : NaN;
      if (!isFinite(v) || !isFinite(vq)){ labels.push('NONE'); continue; }
      var m = (r.h - r.l)/v, mq = (q.h - q.l)/vq;
      var up = m > mq, vup = v > vq;
      var lab = (up && vup) ? 'GREEN' : ((!up && vup) ? 'SQUAT' : ((up && !vup) ? 'FAKE' : 'FADE'));
      labels.push(lab);
      if (i === n - 1) mfiLast = m;
    }
    out.mfi = mfiLast;
    out.series = labels.slice(-5);
    out.last = labels.length ? labels[labels.length - 1] : 'NONE';
    return out;
  }catch(e){ return out; }
}

/* ======================= 9) Bollinger-in-Keltner squeeze =======================
   BB(20,2) fully inside KC(20,1.5) = squeeze ON; the first bar back outside
   after >=3 on-bars = FIRED — trade the expansion close outside the bands.
   -> {state:'ON'|'FIRED'|'OFF'|'NONE', onRun, firedAgo, dir:'UP'|'DOWN'|null}. */
function goldVolSqueeze(rows, opts){
  opts = opts || {};
  var out = { state: 'NONE', onRun: 0, firedAgo: null, dir: null };
  if (opts.volumeTrusted === false) return out;
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var n = rows.length, c = __closes(rows);
    /* local bollinger + keltner (indicators2 math) */
    var mid = _ema(c, 20), a20 = _atr(rows, 20);
    var on = new Array(n).fill(false);
    var bbU = new Array(n).fill(NaN), bbL = new Array(n).fill(NaN), bbM = new Array(n).fill(NaN);
    for (var i = 19; i < n; i++){
      var s = 0, k;
      for (k = i - 19; k <= i; k++) s += c[k];
      var m = s/20, sq = 0;
      for (k = i - 19; k <= i; k++) sq += (c[k] - m)*(c[k] - m);
      var sd = Math.sqrt(sq/20);
      bbM[i] = m; bbU[i] = m + 2*sd; bbL[i] = m - 2*sd;
    }
    for (i = 0; i < n; i++){
      if (!isFinite(mid[i]) || !isFinite(a20[i]) || !isFinite(bbU[i])) continue;
      var kU = mid[i] + 1.5*a20[i], kL = mid[i] - 1.5*a20[i];
      on[i] = (bbL[i] > kL) && (bbU[i] < kU);
    }
    var run = 0, firedIdx = -1;
    for (i = 0; i < n; i++){
      if (on[i]) run++;
      else { if (run >= 3 && i > 0) firedIdx = i; run = 0; }
    }
    run = 0;
    for (i = n - 1; i >= 0 && on[i]; i--) run++;
    out.onRun = run;
    if (on[n-1]){ out.state = 'ON'; return out; }
    if (firedIdx >= 0 && (n - 1 - firedIdx) <= 3){
      out.state = 'FIRED';
      out.firedAgo = n - 1 - firedIdx;
      var fc = rows[firedIdx].c;
      if (isFinite(bbU[firedIdx]) && fc > bbU[firedIdx]) out.dir = 'UP';
      else if (isFinite(bbL[firedIdx]) && fc < bbL[firedIdx]) out.dir = 'DOWN';
      else if (isFinite(bbM[firedIdx])) out.dir = (fc >= bbM[firedIdx]) ? 'UP' : 'DOWN';
      return out;
    }
    out.state = 'OFF';
    return out;
  }catch(e){ return out; }
}

/* ======================= 10) Asian Range Breakout =======================
   Box = 00:00-08:00 UTC high/low of the LAST bar's UTC day (forming-layer
   Asia window); trade the London-volume breakout. Needs candle timestamps.
   -> {hi, lo, mid, state:'LONG_BREAK'|'SHORT_BREAK'|'INSIDE'|'BUILDING', dayIso, bars} | null. */
function goldAsianRange(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return null;
    var n = rows.length, tl = rows[n-1].t;
    if (!isFinite(tl)) return null;
    var ds = Math.floor(tl/86400)*86400, boxEnd = ds + 8*3600;
    var hi = -Infinity, lo = Infinity, bars = 0;
    for (var i = 0; i < n; i++){
      var t = rows[i].t;
      if (!isFinite(t) || t < ds || t >= boxEnd) continue;
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      bars++;
    }
    if (bars < 3 || !(hi > lo)) return null;
    var c = rows[n-1].c;
    var state = (tl < boxEnd) ? 'BUILDING'
              : (c > hi) ? 'LONG_BREAK'
              : (c < lo) ? 'SHORT_BREAK' : 'INSIDE';
    return { hi: hi, lo: lo, mid: (hi + lo)/2, state: state,
             dayIso: new Date(ds*1000).toISOString().slice(0, 10), bars: bars };
  }catch(e){ return null; }
}

/* ======================= 11) RSI(14) gold 75/25 + divergence =======================
   Gold respects wider extremes than stocks: 75/25, not 70/30. Divergence =
   price higher-high + RSI lower-high (bearish exhaustion) or price lower-low
   + RSI higher-low (bullish exhaustion) across the last two swing pivots.
   -> {rsi, zone:'OVERBOUGHT'|'OVERSOLD'|'NEUTRAL'|'NONE', div, detail}. */
function goldRSIGold(rows){
  var out = { rsi: NaN, zone: 'NONE', div: null, detail: '', pivotLow: null, pivotHigh: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 20) return out;
    var n = rows.length, c = __closes(rows);
    var r = _rsi(c, 14), rv = r[n-1];
    out.rsi = rv;
    if (!isFinite(rv)) return out;
    out.zone = (rv >= 75) ? 'OVERBOUGHT' : ((rv <= 25) ? 'OVERSOLD' : 'NEUTRAL');
    /* divergence on price swing pivots (win 2) within the last 60 bars */
    var lows = new Array(n), highs = new Array(n), i;
    for (i = 0; i < n; i++){ lows[i] = rows[i].l; highs[i] = rows[i].h; }
    var segStart = Math.max(0, n - 60);
    var pl = __pivots(lows.slice(segStart), 2), ph = __pivots(highs.slice(segStart), 2);
    var lowPivots = [], highPivots = [];
    for (i = 0; i < pl.length; i++){ if (pl[i].type === 'low') lowPivots.push({ i: pl[i].i + segStart, v: pl[i].v }); }
    for (i = 0; i < ph.length; i++){ if (ph[i].type === 'high') highPivots.push({ i: ph[i].i + segStart, v: ph[i].v }); }
    var bullDiv = null, bearDiv = null;
    if (lowPivots.length >= 2){
      var p1 = lowPivots[lowPivots.length - 2], p2 = lowPivots[lowPivots.length - 1];
      if (p2.v < p1.v && isFinite(r[p2.i]) && isFinite(r[p1.i]) && r[p2.i] > r[p1.i] && (n - 1 - p2.i) <= 20)
        bullDiv = { i: p2.i, barsAgo: n - 1 - p2.i };
    }
    if (highPivots.length >= 2){
      var q1 = highPivots[highPivots.length - 2], q2 = highPivots[highPivots.length - 1];
      if (q2.v > q1.v && isFinite(r[q2.i]) && isFinite(r[q1.i]) && r[q2.i] < r[q1.i] && (n - 1 - q2.i) <= 20)
        bearDiv = { i: q2.i, barsAgo: n - 1 - q2.i };
    }
    if (bullDiv && (!bearDiv || bullDiv.barsAgo <= bearDiv.barsAgo)){
      out.div = 'BULLISH';
      out.pivotLow = p2.v;                 /* price of the 2nd (lower) low — divergence stop structure */
      out.detail = 'price lower-low, RSI higher-low (' + bullDiv.barsAgo + ' bars ago) — bullish exhaustion divergence';
    } else if (bearDiv){
      out.div = 'BEARISH';
      out.pivotHigh = q2.v;                /* price of the 2nd (higher) high — divergence stop structure */
      out.detail = 'price higher-high, RSI lower-high (' + bearDiv.barsAgo + ' bars ago) — bearish exhaustion divergence';
    }
    return out;
  }catch(e){ return out; }
}

/* ======================= 12) CCI(20) =======================
   +/-100 extremes with zero-line cross confirmation (cross within the last
   5 bars reported with barsAgo).
   -> {cci, zone:'EXTREME_HIGH'|'EXTREME_LOW'|'NEUTRAL'|'NONE', zeroCross}. */
function goldCCI(rows){
  var out = { cci: NaN, zone: 'NONE', zeroCross: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 21) return out;
    var n = rows.length, tp = new Array(n), i, k;
    for (i = 0; i < n; i++) tp[i] = (rows[i].h + rows[i].l + rows[i].c)/3;
    var cci = new Array(n).fill(NaN);
    for (i = 19; i < n; i++){
      var s = 0;
      for (k = i - 19; k <= i; k++) s += tp[k];
      var m = s/20, md = 0;
      for (k = i - 19; k <= i; k++) md += Math.abs(tp[k] - m);
      md /= 20;
      if (md > 0) cci[i] = (tp[i] - m)/(0.015*md);
    }
    var last = cci[n-1];
    out.cci = last;
    if (isFinite(last)) out.zone = (last >= 100) ? 'EXTREME_HIGH' : ((last <= -100) ? 'EXTREME_LOW' : 'NEUTRAL');
    for (i = Math.max(1, n - 5); i < n; i++){
      if (!isFinite(cci[i]) || !isFinite(cci[i-1])) continue;
      if (cci[i-1] <= 0 && cci[i] > 0){ out.zeroCross = { dir: 'UP', barsAgo: n - 1 - i }; }
      else if (cci[i-1] >= 0 && cci[i] < 0){ out.zeroCross = { dir: 'DOWN', barsAgo: n - 1 - i }; }
    }
    return out;
  }catch(e){ return out; }
}

/* ======================= 13) StochRSI (pullback timer only) =======================
   Stoch of RSI(14) over 14 bars. Timing pullbacks INSIDE an established trend
   only — the composite gates this read on the ribbon mode.
   -> {k, state:'OVERBOUGHT'|'OVERSOLD'|'NEUTRAL'|'NONE', crossUp, crossDown}. */
function goldStochRSI(rows){
  var out = { k: NaN, state: 'NONE', crossUp: false, crossDown: false };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var c = __closes(rows), n = c.length;
    var r = _rsi(c, 14), kArr = new Array(n).fill(NaN);
    for (var i = 13; i < n; i++){
      var lo = Infinity, hi = -Infinity, ok = true;
      for (var j = i - 13; j <= i; j++){
        if (!isFinite(r[j])){ ok = false; break; }
        if (r[j] < lo) lo = r[j];
        if (r[j] > hi) hi = r[j];
      }
      if (ok && hi > lo) kArr[i] = 100*(r[i] - lo)/(hi - lo);
    }
    var kv = kArr[n-1];
    out.k = kv;
    if (!isFinite(kv)) return out;
    out.state = (kv >= 80) ? 'OVERBOUGHT' : ((kv <= 20) ? 'OVERSOLD' : 'NEUTRAL');
    for (var i2 = Math.max(1, n - 2); i2 < n; i2++){
      if (!isFinite(kArr[i2]) || !isFinite(kArr[i2-1])) continue;
      if (kArr[i2-1] <= 20 && kArr[i2] > 20) out.crossUp = true;
      if (kArr[i2-1] >= 80 && kArr[i2] < 80) out.crossDown = true;
    }
    return out;
  }catch(e){ return out; }
}

/* ======================= 14) Seasonal bias (context only) =======================
   Jan-Feb historically strongest for gold; spring/early-summer consolidation.
   A note, NEVER a vote. */
function goldSeason(d){
  try{
    var ms = __toMs(d);
    if (!isFinite(ms)) return { month: NaN, bias: 'NEUTRAL', note: 'seasonal context unavailable' };
    var m = new Date(ms).getUTCMonth();
    if (m === 0 || m === 1)
      return { month: m, bias: 'STRONG', note: 'Seasonal: Jan–Feb is historically gold\'s strongest stretch — context only, not a vote.' };
    if (m >= 3 && m <= 5)
      return { month: m, bias: 'CONSOLIDATION', note: 'Seasonal: spring/early-summer is historically a consolidation zone for gold — context only, not a vote.' };
    return { month: m, bias: 'NEUTRAL', note: 'Seasonal: no strong historical bias this month — context only, not a vote.' };
  }catch(e){ return { month: NaN, bias: 'NEUTRAL', note: 'seasonal context unavailable' }; }
}

/* =========================================================================
   COMPOSITE — goldScalpSetup({rows15m, rows1h, rows4h, now, news})
   Confluence-driven: >=3 independent agreeing reads on one side (and strictly
   more than the other side) -> setup. Grade = read count + killzone weight,
   downgraded one letter inside a high-impact NEWS WINDOW (+/-30 min) — never
   hidden. Stops 1.5-2x ATR(14) 15m, never tighter; targets 1.5R/2.5R snapped
   to opposing swept structure when one sits between entry and target.
   -> null | {dir, entry, stop, t1, t2, rr, rr2, grade, strategy, confluence,
              notes, killzone, killzoneWeight, newsCaution, newsStamp,
              reads:{long,short}, atr}
========================================================================= */
var NEWS_WINDOW_MS = 30*60*1000;
var NEWS_STAMP = 'NEWS WINDOW — wait 15–30 min after release, let the sweep complete first';
/* quality-gate bars: any candidate renders when its confluence tally clears
   the normal bar (0); an OFF-SESSION-demoted candidate must clear +2 above
   the normal bar to render at all. */
var GS_TALLY_BAR = 0;
var GS_OFFSESSION_BAR = GS_TALLY_BAR + 2;

function __newsCaution(news, nowMs){
  try{
    if (!news || typeof news !== 'object') return { caution: false, title: null };
    /* goldswing passes a pre-shaped {caution, title} leg; honour it directly */
    if (!Array.isArray(news.events)){
      if ('caution' in news) return { caution: !!news.caution, title: news.title || null };
      return { caution: false, title: null };
    }
    for (var i = 0; i < news.events.length; i++){
      var ev = news.events[i];
      if (!ev || ev.impact !== 'high') continue;
      var t = (+ev.t < 1e12) ? (+ev.t)*1000 : +ev.t;
      if (!isFinite(t)) continue;
      if (Math.abs(t - nowMs) <= NEWS_WINDOW_MS)
        return { caution: true, title: ev.title || null };
    }
    return { caution: false, title: null };
  }catch(e){ return { caution: false, title: null }; }
}

function goldScalpSetup(inp){
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m);
    if (!rows || rows.length < 30) return null;
    var n = rows.length, lastBar = rows[n-1];
    var a15 = __last(_atr(rows, 14));
    if (!isFinite(a15) || !(a15 > 0)) return null;
    var entry = lastBar.c;
    if (!isFinite(entry) || !(entry > 0)) return null;

    var nowMs = __toMs(inp.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var kz = goldKillzone(nowMs);
    var newsState = inp.news;
    if (newsState === undefined && typeof W.hgNewsState === 'function'){
      try{ newsState = W.hgNewsState(); }catch(eN){ newsState = null; }
    }
    var news = __newsCaution(newsState, nowMs);

    var reads = [];   /* {side:'long'|'short', tag, label} */
    var notes = [];   /* neutral observations — never counted */
    function add(side, tag, label){ reads.push({ side: side, tag: tag, label: label }); }

    /* --- 1) liquidity sweep (15m) --- */
    var sw = goldSweeps(rows);
    var sweptLow = (sw && sw.lowSweep) ? sw.lowSweep.level : NaN;
    var sweptHigh = (sw && sw.highSweep) ? sw.highSweep.level : NaN;
    if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
      if (sw.dir === 'bullish') add('long', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + reclaim (' + sw.barsAgo + 'b ago)');
      else add('short', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + rejection (' + sw.barsAgo + 'b ago)');
    }

    /* --- 2) order blocks + breakers (15m) --- */
    var ob = goldOrderBlocks(rows);
    if (ob){
      var i, z, tol = 0.5*a15;
      for (i = 0; i < ob.bullish.length; i++){
        z = ob.bullish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){ add('long', 'ob', 'bullish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
      }
      for (i = 0; i < ob.bearish.length; i++){
        z = ob.bearish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){ add('short', 'ob', 'bearish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
      }
      for (i = 0; i < ob.breakers.length; i++){
        z = ob.breakers[i];
        if (z.dir === 'bullish' && entry > z.top) { add('long', 'breaker', 'breaker block — failed supply ' + z.top.toFixed(2) + ' flipped to demand'); break; }
        if (z.dir === 'bearish' && entry < z.bottom){ add('short', 'breaker', 'breaker block — failed demand ' + z.bottom.toFixed(2) + ' flipped to supply'); break; }
      }
    }

    /* --- 3) FVG (15m, then 1h when provided) --- */
    var fvg = goldFVG(rows);
    if (fvg && fvg.length){
      var g = fvg[0];
      if (g.age <= 25){
        if (g.dir === 'bullish' && entry >= g.bottom) add('long', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' holding');
        else if (g.dir === 'bearish' && entry <= g.top) add('short', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2) + ' capping');
      }
    }
    var rows1h = __rows(inp.rows1h);
    if (rows1h && rows1h.length >= 30){
      var fvg1 = goldFVG(rows1h);
      if (fvg1 && fvg1.length){
        var g1 = fvg1[0];
        if (g1.age <= 25){
          if (g1.dir === 'bullish' && entry >= g1.bottom) add('long', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2));
          else if (g1.dir === 'bearish' && entry <= g1.top) add('short', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2));
        }
      }
    }

    /* --- 4) session VWAP (London-open anchor when available) --- */
    var anchor = goldSessionAnchor(rows);
    if (anchor >= 0){
      var vw = goldVWAP(rows, anchor);
      if (vw){
        if (vw.pos === 'ABOVE') add('long', 'vwap', 'holding above session VWAP ' + vw.value.toFixed(2));
        else if (vw.pos === 'BELOW') add('short', 'vwap', 'capped below session VWAP ' + vw.value.toFixed(2));
      }
    }

    /* --- 5) EMA ribbon 20/50/200 (15m) --- */
    var rb = goldRibbon(rows);
    if (rb.mode === 'BULL') add('long', 'ribbon', rb.pullback20 ? 'EMA ribbon bull + 20-EMA pullback zone' : 'EMA ribbon bull (20>50, above 200)');
    else if (rb.mode === 'BEAR') add('short', 'ribbon', rb.pullback20 ? 'EMA ribbon bear + 20-EMA pullback zone' : 'EMA ribbon bear (20<50, below 200)');

    /* --- 6) Ichimoku (15m) --- */
    var ich = goldIchimoku(rows);
    if (ich.state === 'ABOVE') add('long', 'ichimoku', 'price above the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');
    else if (ich.state === 'BELOW') add('short', 'ichimoku', 'price below the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');

    /* --- 7) volatility squeeze expansion (15m) --- */
    var vsq = goldVolSqueeze(rows);
    if (vsq.state === 'FIRED' && vsq.dir){
      add(vsq.dir === 'UP' ? 'long' : 'short', 'squeeze', 'BB/KC squeeze fired ' + vsq.dir.toLowerCase() + ' (' + vsq.firedAgo + 'b ago) — expansion');
    } else if (vsq.state === 'ON' && vsq.onRun >= 3){
      notes.push('BB inside KC ×' + vsq.onRun + ' — squeeze building, expansion coming');
    }

    /* --- 8) Asian range breakout --- */
    var asian = goldAsianRange(rows);
    if (asian){
      if (asian.state === 'LONG_BREAK') add('long', 'asian', 'Asian-range breakout above ' + asian.hi.toFixed(2));
      else if (asian.state === 'SHORT_BREAK') add('short', 'asian', 'Asian-range breakdown below ' + asian.lo.toFixed(2));
    }

    /* --- 9) RSI gold 75/25 + divergence --- */
    var rg = goldRSIGold(rows);
    if (rg.zone === 'OVERSOLD') add('long', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≤ 25 — gold oversold extreme');
    else if (rg.zone === 'OVERBOUGHT') add('short', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≥ 75 — gold overbought extreme');
    if (rg.div === 'BULLISH') add('long', 'rsidiv', 'RSI bullish divergence — ' + rg.detail);
    else if (rg.div === 'BEARISH') add('short', 'rsidiv', 'RSI bearish divergence — ' + rg.detail);

    /* --- 10) CCI(20) --- */
    var cc = goldCCI(rows);
    if (cc.zone === 'EXTREME_LOW') add('long', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≤ -100 extreme');
    else if (cc.zone === 'EXTREME_HIGH') add('short', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≥ +100 extreme');
    else if (cc.zeroCross && cc.zeroCross.barsAgo <= 2){
      add(cc.zeroCross.dir === 'UP' ? 'long' : 'short', 'cci', 'CCI zero-line cross ' + cc.zeroCross.dir.toLowerCase() + ' (' + cc.zeroCross.barsAgo + 'b ago)');
    }

    /* --- 11) StochRSI — pullbacks inside an established trend only --- */
    var sr = goldStochRSI(rows);
    if (rb.mode === 'BULL' && (sr.state === 'OVERSOLD' || sr.crossUp))
      add('long', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' washed out inside a bull ribbon — pullback timed');
    else if (rb.mode === 'BEAR' && (sr.state === 'OVERBOUGHT' || sr.crossDown))
      add('short', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' stretched inside a bear ribbon — pullback timed');

    /* --- 12) MFI bar colour --- */
    var mfi = goldMFI(rows);
    if (mfi.last === 'GREEN') add(lastBar.c >= lastBar.o ? 'long' : 'short', 'mfi', 'MFI green bar — volume-driven trend');
    else if (mfi.last === 'SQUAT') notes.push('MFI pink bar — high volume + low range: manipulation / breakout watch, confirmation required');

    /* --- 13) 4H macro mode --- */
    var rows4h = __rows(inp.rows4h);
    if (rows4h && rows4h.length >= 50){
      var rb4 = goldRibbon(rows4h);
      if (rb4.mode === 'BULL') add('long', 'macro4h', '4H ribbon bull — macro tailwind');
      else if (rb4.mode === 'BEAR') add('short', 'macro4h', '4H ribbon bear — macro headwind');
    }

    /* --- tally --- */
    var longEv = [], shortEv = [], i3;
    for (i3 = 0; i3 < reads.length; i3++) (reads[i3].side === 'long' ? longEv : shortEv).push(reads[i3]);
    var dir = (longEv.length > shortEv.length) ? 'long' : ((shortEv.length > longEv.length) ? 'short' : null);
    var count = (dir === 'long') ? longEv.length : ((dir === 'short') ? shortEv.length : 0);
    if (!dir || count < 3) return null;

    /* 200-EMA macro gate: below the 200 -> sell-only (longs suppressed) */
    if (dir === 'long' && rb.sellOnly) return null;

    /* --- levels: ATR survival stop 1.5-2x, never tighter --- */
    var stopDist = 1.5 * a15, stopNote = 'stop 1.5×ATR14(15m)';
    var structLvl = (dir === 'long') ? sweptLow : sweptHigh;
    if (isFinite(structLvl)){
      var dStruct = (dir === 'long') ? (entry - structLvl) : (structLvl - entry);
      if (dStruct > 1.5*a15 && dStruct <= 2*a15){
        stopDist = Math.min(2*a15, dStruct + 0.25*a15);
        stopNote = 'stop beyond swept ' + (dir === 'long' ? 'low' : 'high') + ' ' + structLvl.toFixed(2) + ' (1.5–2×ATR)';
      }
    }
    var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
    var risk = stopDist;
    var t1 = (dir === 'long') ? entry + 1.5*risk : entry - 1.5*risk;
    var t2 = (dir === 'long') ? entry + 2.5*risk : entry - 2.5*risk;
    /* snap targets to opposing swept structure sitting between entry and target */
    var oppLvl = (dir === 'long') ? sweptHigh : sweptLow;
    if (isFinite(oppLvl)){
      var onSide = (dir === 'long') ? (oppLvl > entry && oppLvl < t1) : (oppLvl < entry && oppLvl > t1);
      if (onSide){
        var rrSnap = Math.abs(oppLvl - entry)/risk;
        if (rrSnap >= 1.2){ t1 = oppLvl; stopNote += '; T1 snapped to swept ' + (dir === 'long' ? 'high' : 'low') + ' ' + oppLvl.toFixed(2); }
      }
    }
    var rr = Math.abs(t1 - entry)/risk, rr2 = Math.abs(t2 - entry)/risk;

    /* --- strategy name: strongest structural read first --- */
    var PRIORITY = ['sweep', 'breaker', 'ob', 'asian', 'openrange', 'adrfade', 'bosalign', 'vwapband', 'squeeze', 'fvg', 'vwap', 'stochrsi', 'rsidiv'];
    var NAMES = { sweep: 'LIQUIDITY SWEEP REVERSAL', breaker: 'BREAKER BLOCK REVERSAL',
                  ob: 'ORDER BLOCK RETRACE', asian: 'ASIAN RANGE BREAKOUT',
                  openrange: 'OPENING RANGE BREAKOUT', adrfade: 'ADR EXHAUSTION FADE',
                  bosalign: 'BOS ALIGNMENT ENTRY', vwapband: 'VWAP BAND MEAN-REVERSION',
                  squeeze: 'SQUEEZE EXPANSION', fvg: 'FVG RECLAIM', vwap: 'VWAP BOUNCE',
                  stochrsi: 'EMA20 PULLBACK', rsidiv: 'RSI DIVERGENCE' };
    var myTags = {};
    var myEv = (dir === 'long') ? longEv : shortEv;
    for (i3 = 0; i3 < myEv.length; i3++) myTags[myEv[i3].tag] = true;
    var strategy = 'CONFLUENCE BLEND';
    for (i3 = 0; i3 < PRIORITY.length; i3++){
      if (myTags[PRIORITY[i3]]){ strategy = NAMES[PRIORITY[i3]]; break; }
    }

    /* --- grade: read count + killzone weight; news downgrades one letter --- */
    var score = count + kz.weight;
    var grade = (score >= 8) ? 'A' : ((score >= 5) ? 'B' : 'C');
    if (news.caution) grade = (grade === 'A') ? 'B' : 'C';

    var confluence = [];
    for (i3 = 0; i3 < myEv.length; i3++) confluence.push(myEv[i3].label);

    var hh = isFinite(kz.hourGMT) ? ('0' + kz.hourGMT).slice(-2) + ':00 GMT' : 'n/a';
    return {
      dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
      rr: rr, rr2: rr2, grade: grade, strategy: strategy,
      confluence: confluence, notes: notes.concat(stopNote ? [stopNote] : []),
      killzone: kz.label + ' · ' + hh,
      killzoneWeight: kz.weight,
      newsCaution: news.caution,
      newsStamp: news.caution ? NEWS_STAMP + (news.title ? ' (' + news.title + ')' : '') : null,
      reads: { long: longEv.length, short: shortEv.length },
      atr: a15
    };
  }catch(e){ return null; }
}

/* =========================================================================
   MULTI-STRATEGY CANDIDATES — goldScalpSetups({rows15m, rows1h, rows4h, now,
   news}) -> [candidate, ...] (possibly empty, NEVER null, never throws).
   Each candidate is ONE strategy-specific setup composed from the detectors
   above — liquidity-sweep reversal, order-block/breaker retest, FVG fill,
   session-VWAP bounce/rejection, EMA 20/50/200 ribbon pullback, Asian-range
   (00:00-08:00 UTC) breakout, modified-RSI(75/25) divergence — with entry,
   an ATR-based stop (1.5-2x ATR14 15m, never tighter), TP1 1.5R / TP2 2.5R
   snapped to opposing structure when one sits between entry and target
   (>=1.2R), a deterministic STRUCTURAL conviction id (strategy|dir|anchor:
   the strategy's structural price — swept level / OB edge / FVG edge /
   session VWAP / 20-EMA / Asian box edge / divergence pivot — rounded to
   whole dollars, so price drifting INSIDE the same structural zone
   reproduces the identical id), the agreeing-reads ledger and plain-
   language why/invalidates text. A candidate needs its structural trigger
   PLUS >=2 independent agreeing reads (strictly more than opposing).
   QUALITY GATES (win-rate first, every gate names its reason): TP1 snaps
   to the NEAREST opposing structure at any distance and a realized TP1
   < 1.2R drops the candidate to the .rejected side-channel ('structure
   too close — R:R insufficient'); TREND ALIGNMENT demotes longs below a
   FALLING 200-EMA-15m with a bearish 4H EMA50/200 stack (mirrored for
   shorts; liquidity-sweep triggers are the sanctioned counter-trend
   exception); OFF-SESSION demotes anything detected outside every ICT
   killzone (weight 0) except the Asian-range strategy in its own session;
   CHOP (Kaufman ER(20) < 0.25) demotes mean-reversion retests (VWAP/OB/
   FVG). Demoted candidates carry demoted/stamps/gateNotes and can never
   be MOST PROBABLE; the ranker holds OFF-SESSION demotions to a +2 tally
   bar. Levels always come from structure + ATR — nothing is fabricated.
   -> [{id, strategy, stratKey, dir, entry, stop, t1, t2, rr, rr2, grade,
        confluence, agree, oppose, reads:{long,short}, killzone,
        killzoneWeight, newsCaution, newsStamp, atr, anchor (the numeric
        structural price behind the id bucket — the tab merges duplicate
        convictions whose anchors sit within 0.5×ATR), demoted, offSession,
        stamps, gateNotes, zone:{lo,hi}, why, invalidates, notes}] with a
        .rejected side-channel [{dropped, id, strategy, stratKey, dir,
        reason}] for hard-gated setups.
========================================================================= */
var GST_NAME = {
  sweep:  'LIQUIDITY SWEEP REVERSAL',
  ob:     'ORDER BLOCK / BREAKER RETEST',
  fvg:    'FVG FILL',
  vwap:   'SESSION VWAP BOUNCE / REJECTION',
  ribbon: 'EMA RIBBON PULLBACK',
  asian:  'ASIAN RANGE BREAKOUT',
  rsidiv: 'RSI 75/25 DIVERGENCE',
  vwapband: 'VWAP BAND MEAN-REVERSION',
  openrange: 'OPENING RANGE BREAKOUT',
  adrfade: 'ADR EXHAUSTION FADE',
  bosalign: 'BOS ALIGNMENT ENTRY',
  hvn:      'HVN / VOLUME NODE RETEST',
  pdraid: 'PRIOR-DAY LIQUIDITY RAID',
  eqhi:   'EQUAL HIGHS (STOP CLUSTER)',
  eqlo:   'EQUAL LOWS (STOP CLUSTER)',
  smcliq: 'SMC LIQUIDITY POOL (CLUSTER + SWEPT)',
  oitrap: 'OI-TRAP REVERSAL',
  fundext: 'FUNDING EXTREME',
  liqsweep: 'GOLD LIQUIDITY SWEEP',
  nyexh: 'NY VOLUME EXHAUSTION',
  sweepob: 'SWEEP→OB (MSS + FRESH OB/FVG)',
  silverb: 'SESSION SILVER BULLET (ASIA→LONDON)',
  p4disc: 'S9 DISCOUNT/PREMIUM NODE',
  p4nr7: 'S12 NR7 / RANGE CONTRACTION BREAKOUT',
  p4adrx: 'S14 ADR EXHAUSTION FADE (PART4)',
  p4poor: 'S15 POOR HIGH/LOW REVISIT',
  p4laf: 'S17 LOOK-ABOVE-AND-FAIL',
  p4asiasd: 'S18 ASIA SD TARGET / SWEEP DEPTH',
  p4gap: 'S11 WEEKEND/SESSION GAP FILL',
  vpbook: 'VP PLAYBOOK AMD (ENTER/WAIT)',
  p5wyck: 'S19 WYCKOFF SPRING/UPTHRUST TEST',
  p5turt: 'S20 TURTLE-SOUP FAILED EXTREME',
  p5vwap: 'S22 SESSION VWAP 2σ REVERSION',
  p5drive: 'S24 THREE-DRIVE EXHAUSTION',
  p5open: 'S25 OPEN-TYPE RECOGNITION',
  p5news: 'S27 POST-NEWS SPIKE FADE',
  p5ker: 'S23 KER REGIME GATE',
  p5bias: 'S28 PHYSICAL WEEKLY BIAS'
};

/* limit-at-zone entry: when price has extended beyond the setup zone, anchor
   the entry at the structural edge instead of the last 15m close. */
function __gsEntryFromZone(dir, mark, zone, anchor){
  try{
    dir = (dir === 'short') ? 'short' : 'long';
    mark = +mark;
    if (!isFinite(mark)) return { entry: NaN, inZone: false };
    var entry = mark, inZone = true;
    if (zone && isFinite(zone.lo) && isFinite(zone.hi)){
      if (mark >= zone.lo && mark <= zone.hi){ entry = mark; inZone = true; }
      else if (isFinite(anchor)){
        entry = anchor;
        if (dir === 'long' && mark > zone.hi) entry = Math.min(anchor, zone.hi);
        else if (dir === 'short' && mark < zone.lo) entry = Math.max(anchor, zone.lo);
        inZone = false;
      } else {
        entry = (dir === 'long') ? (mark > zone.hi ? zone.hi : zone.lo) : (mark < zone.lo ? zone.lo : zone.hi);
        inZone = false;
      }
    }
    return { entry: entry, inZone: inZone };
  }catch(e){ return { entry: mark, inZone: true }; }
}

/* shared ATR-survival level builder: stop 1.5-2x ATR14(15m) (never tighter),
   optionally extended to sit beyond a structure price; TP1 1.5R / TP2 2.5R
   with TP1 snapped to the NEAREST opposing structure between entry and TP1
   (any distance — the realized rr reports the honest structure-capped payoff;
   __gsCand then drops the candidate when that realized TP1 pays < 1.2R). */
/* Gold risk model: the stop goes BEHIND the level that invalidates the idea.

   This used to hard-cap the stop at 2xATR14(15m), whatever the structure said:

     var want = d + 0.25*a;
     if (want > 2*a) want = 2*a;          // truncated, regardless of structure

   Gold routinely travels 2-3 ATR through a session open or a release, so on
   ~71% of setups the cap bound and the stop was placed ~42% short of the
   level that would actually prove the trade wrong — inside ordinary noise.
   The note even read "stop beyond structure ... capped 2x", which describes
   a stop past the structure while placing one in front of it.

   Truncating the stop does not reduce risk, it relocates it: the loss is
   smaller but far likelier, and the 1.5R/2.5R/4R ladder is then measured
   against a risk that never reached invalidation, so the R:R on the card
   overstates the trade.

   The stop now clears the structure. MAX is a sanity ceiling for broken
   structure, not a risk policy — beyond it the geometry is not a stop but a
   different trade, and the R:R gate declines it on its own. Position size
   follows from the wider risk, so the dollars risked are unchanged. */
function __gsLevels(dir, entry, a15, structStop, snapLvls){
  var GOLD_STOP_MAX_ATR = 3.5;
  var stopDist = 1.5*a15, stopNote = 'stop 1.5×ATR14(15m)';
  if (isFinite(structStop)){
    var d = (dir === 'long') ? (entry - structStop) : (structStop - entry);
    if (d > 0){
      var want = d + 0.25*a15;
      if (want > GOLD_STOP_MAX_ATR*a15) want = GOLD_STOP_MAX_ATR*a15;
      if (want > stopDist){
        stopDist = want;
        stopNote = 'stop BEHIND structure ' + structStop.toFixed(2) + ' (' + (stopDist/a15).toFixed(2) + '×ATR14)'
          + (want >= GOLD_STOP_MAX_ATR*a15 ? ' — at the ' + GOLD_STOP_MAX_ATR + '× sanity ceiling, structure may be broken' : '');
      }
    }
  }
  var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
  var risk = stopDist;
  var t1 = (dir === 'long') ? entry + 1.5*risk : entry - 1.5*risk;
  var t2 = (dir === 'long') ? entry + 2.5*risk : entry - 2.5*risk;
  if (snapLvls && snapLvls.length){
    var bestLvl = NaN, bestR = Infinity;
    for (var si = 0; si < snapLvls.length; si++){
      var L = snapLvls[si];
      if (!isFinite(L)) continue;
      var onSide = (dir === 'long') ? (L > entry && L < t1) : (L < entry && L > t1);
      if (!onSide) continue;
      var rL = Math.abs(L - entry)/risk;
      if (rL < bestR){ bestR = rL; bestLvl = L; }
    }
    if (isFinite(bestLvl)){ t1 = bestLvl; stopNote += '; TP1 snapped to opposing structure ' + bestLvl.toFixed(2); }
  }
  return { stop: stop, t1: t1, t2: t2,
           rr: Math.abs(t1 - entry)/risk, rr2: Math.abs(t2 - entry)/risk,
           stopNote: stopNote };
}

/* opposing-structure levels for TP snapping: the opposing swept level plus
   the near edge of opposing unmitigated order blocks. */
function __gsSnapLvls(D, dir){
  var out = [], sw = D.sw, ob = D.ob, entry = D.entry;
  if (sw){
    var L = (dir === 'long') ? (sw.highSweep ? sw.highSweep.level : NaN)
                             : (sw.lowSweep ? sw.lowSweep.level : NaN);
    if (isFinite(L)) out.push(L);
  }
  if (ob){
    var zones = (dir === 'long') ? ob.bearish : ob.bullish;
    for (var i = 0; i < zones.length; i++){
      var edge = (dir === 'long') ? zones[i].bottom : zones[i].top;
      if (isFinite(edge) && ((dir === 'long' && edge > entry) || (dir === 'short' && edge < entry))) out.push(edge);
    }
  }
  return out;
}

/* candidate assembly + quality gates. Hard pass/fail: >=2 independent
   agreeing reads, strictly more agreeing than opposing. MIN R:R: after TP1
   snaps to the nearest opposing structure, a realized TP1 < 1.2R drops the
   candidate — returned as a {dropped, reason} object so the tab can render
   the reason line (never a silent drop). Soft demotions (never MOST
   PROBABLE, reason stamped on the card): COUNTER-TREND — long below a
   FALLING 200-EMA-15m with a bearish 4H EMA50/200 stack (mirrored for
   shorts; a liquidity-sweep trigger is the only sanctioned counter-trend
   play); OFF-SESSION — detected outside every ICT killzone (killzone
   weight 0; the Asian-range strategy is allowed its own 00:00-08:00 UTC
   session) and held to a +2 higher tally bar in goldRankSetups; CHOP —
   Kaufman ER(20) < 0.25 demotes mean-reversion retests (VWAP/OB/FVG).
   Grade = agreeing reads + killzone weight with a one-letter news
   downgrade. Returns null when the hard gates fail.
   CONVICTION ID: keyed on STRUCTURE, never the live entry — `key|dir|anchor`
   where anchor is the strategy's structural price (swept level / OB edge /
   FVG edge / session VWAP / 20-EMA / Asian box edge / divergence pivot)
   rounded to whole dollars. Price drifting INSIDE the same structural zone
   reproduces the identical id, so the tab's conviction lock restores the
   original levels verbatim; only a genuinely different structure mints a
   new id. */
function __gsCand(key, dir, D, structStop, snapLvls, why, invalidates, zone, anchor){
  try{
    /* v54: context reads (zone state, trend strength, session structure)
       inform but NEVER veto — excluded from the oppose count. A strategy
       candidate still counts its own trigger read; the remaining ctx reads
       sit in D.reads for the audit trail without touching the gates. */
    var longEv = [], shortEv = [], i;
    for (i = 0; i < D.reads.length; i++){
      var rd = D.reads[i];
      if (rd.ctx && !(rd.tag === key && rd.side === dir)) continue;
      (rd.side === 'long' ? longEv : shortEv).push(rd);
    }
    var myEv = (dir === 'long') ? longEv : shortEv;
    var oppose = (dir === 'long') ? shortEv.length : longEv.length;
    if (myEv.length < 2 || myEv.length <= oppose) return null;
    var mark = D.entry;
    var entRef = __gsEntryFromZone(dir, mark, zone, anchor);
    var useEntry = entRef.entry;
    if (!isFinite(useEntry) || !(useEntry > 0)) return null;
    var lv = __gsLevels(dir, useEntry, D.a15, structStop, snapLvls);
    var bucket = String(isFinite(anchor) ? Math.round(anchor) : Math.round(D.entry));
    /* (3) MIN R:R AFTER SNAPPING — opposing structure too close to pay for
       the trade: dropped with a named reason, never silently. */
    if (lv.rr < 1.2){
      return { dropped: true, id: key + '|' + dir + '|' + bucket,
               strategy: GST_NAME[key] || key, stratKey: key, dir: dir,
               reason: 'structure too close — R:R insufficient (opposing structure caps TP1 at '
                       + lv.rr.toFixed(1) + 'R < 1.2R minimum)' };
    }
    var demoted = false, offSess = false, stamps = [], gateNotes = [];
    /* (2) TREND ALIGNMENT — counter-trend when price sits beyond a 200-EMA-15m
       that is falling (longs) / rising (shorts) and the 4H EMA50/200 stack
       agrees (or is unavailable); sweep triggers are the sanctioned
       counter-trend exception and are never demoted by this gate. */
    if (key !== 'sweep' && isFinite(D.e200v) && isFinite(D.e200Slope)){
      if (dir === 'long' && D.entry < D.e200v && D.e200Slope < 0 && D.stack4 !== 'bull'){
        demoted = true; stamps.push('COUNTER-TREND');
        gateNotes.push('long below a falling 200-EMA-15m'
          + (D.stack4 === 'bear' ? ' with a bearish 4H EMA50/200 stack' : '')
          + ' — counter-trend; only sweep-reclaim entries are sanctioned here');
      } else if (dir === 'short' && D.entry > D.e200v && D.e200Slope > 0 && D.stack4 !== 'bear'){
        demoted = true; stamps.push('COUNTER-TREND');
        gateNotes.push('short above a rising 200-EMA-15m'
          + (D.stack4 === 'bull' ? ' with a bullish 4H EMA50/200 stack' : '')
          + ' — counter-trend; only sweep-rejection entries are sanctioned here');
      }
    }
    /* (1) OFF-SESSION — outside every ICT killzone (killzone weight 0). The
       Asian-range strategy trades its own session; everything else is
       demoted and held to a +2 higher tally bar in goldRankSetups. */
    var inKillzone = !!(D.kz && D.kz.weight > 0);
    if (!inKillzone && !(key === 'asian' && D.kz && D.kz.zone === 'ASIAN')){
      demoted = true; offSess = true; stamps.push('OFF-SESSION');
      gateNotes.push('detected ' + (D.kz ? (D.kz.label || 'OFF-HOURS') : 'OFF-HOURS')
        + ' — outside every ICT killzone; held to a +2 higher confluence-tally bar');
    }
    /* (4) CHOP FILTER — Kaufman ER(20) < 0.25 = overlapping chop; mean-
       reversion retests (VWAP/OB/FVG) demoted, breakout triggers exempt. */
    if ((key === 'vwap' || key === 'ob' || key === 'fvg') && isFinite(D.er) && D.er < 0.25){
      demoted = true; stamps.push('CHOP');
      gateNotes.push('Kaufman ER ' + D.er.toFixed(2) + ' < 0.25 — overlapping chop; mean-reversion retests demoted');
    }
    var score = myEv.length + D.kz.weight;
    var grade = (score >= 8) ? 'A' : ((score >= 5) ? 'B' : 'C');
    if (D.news.caution) grade = (grade === 'A') ? 'B' : 'C';
    var conf = [];
    for (i = 0; i < myEv.length; i++) conf.push(myEv[i].label);
    var hh = isFinite(D.kz.hourGMT) ? ('0' + D.kz.hourGMT).slice(-2) + ':00 GMT' : 'n/a';
    return {
      id: key + '|' + dir + '|' + bucket,
      strategy: GST_NAME[key] || key, stratKey: key, dir: dir,
      entry: useEntry, pxNow: mark, mark: mark, stop: lv.stop, t1: lv.t1, t2: lv.t2, rr: lv.rr, rr2: lv.rr2,
      structStop: structStop, snapLvls: snapLvls,
      grade: grade, confluence: conf, agree: myEv.length, oppose: oppose,
      reads: { long: longEv.length, short: shortEv.length },
      killzone: D.kz.label + ' · ' + hh, killzoneWeight: D.kz.weight,
      newsCaution: D.news.caution,
      newsStamp: D.news.caution ? NEWS_STAMP + (D.news.title ? ' (' + D.news.title + ')' : '') : null,
      atr: D.a15, anchor: isFinite(anchor) ? anchor : D.entry,
      pdZone: (D.pd && D.pd.zone) ? D.pd.zone : null,
      demoted: demoted, offSession: offSess, stamps: stamps, gateNotes: gateNotes,
      zone: zone || { lo: D.entry - 0.25*D.a15, hi: D.entry + 0.25*D.a15 },
      why: why, invalidates: invalidates,
      macroHint: D.macroHint || null,
      stopFloorAtr: 1.5,
      notes: (D.notes || []).concat([lv.stopNote])
    };
  }catch(e){ return null; }
}

/* detector bundle + the shared agreeing-reads ledger (same read logic as the
   goldScalpSetup composite, exposed once for all strategy candidates). */
function __goldBundle(rows, rows1h, rows4h, entry, a15, bundleOpts){
  var D = { entry: entry, a15: a15, reads: [], notes: [] };
  function add(side, tag, label, ctx){ D.reads.push({ side: side, tag: tag, label: label, ctx: !!ctx }); }
  var i, z;

  var n = rows.length;
  var lastT = rows[n - 1].t;
  D.marketSession = getMarketSession(isFinite(lastT) ? lastT : Date.now());
  D.asianAt = calculateAsianRange(rows, n - 1);

  var sw = D.sw = goldSweeps(rows);
  /* microstructure landscape + V2 triggers (HardgateGoldEngine.evaluateScalp) */
  bundleOpts = bundleOpts || {};
  var volSrc = bundleOpts.candleSource || bundleOpts.source || null;
  var volTrusted = !(volSrc && /paxg|xaut|binance-paxg|binance-xaut/i.test(String(volSrc)));
  var volOpts = { volumeTrusted: volTrusted };
  var scalpCtx = { nearestStructure: null, entry: entry, atr15: a15 };
  if (bundleOpts.dxyCandles) scalpCtx.dxyCandles = bundleOpts.dxyCandles;
  if (bundleOpts.currentDxy) scalpCtx.currentDxy = bundleOpts.currentDxy;
  if (bundleOpts.macroHint) scalpCtx.macroHint = bundleOpts.macroHint;
  if (bundleOpts.paxgPrice) scalpCtx.paxgPrice = bundleOpts.paxgPrice;
  if (bundleOpts.spotXauPrice) scalpCtx.spotXauPrice = bundleOpts.spotXauPrice;
  if (bundleOpts.newsGuard) scalpCtx.newsGuard = bundleOpts.newsGuard;
  if (bundleOpts.news) scalpCtx.news = bundleOpts.news;
  if (bundleOpts.newsWindowMinutes) scalpCtx.newsWindowMinutes = bundleOpts.newsWindowMinutes;
  if (bundleOpts.us10yCandles) scalpCtx.us10yCandles = bundleOpts.us10yCandles;
  if (bundleOpts.tickBuffer) scalpCtx.tickBuffer = bundleOpts.tickBuffer;
  if (bundleOpts.l2OrderBook) scalpCtx.l2OrderBook = bundleOpts.l2OrderBook;
  if (isFinite(bundleOpts.domDepth)) scalpCtx.domDepth = bundleOpts.domDepth;
  if (bundleOpts.dailyCandles) scalpCtx.dailyCandles = bundleOpts.dailyCandles;
  if (bundleOpts.xauCandles) scalpCtx.xauCandles = bundleOpts.xauCandles;
  if (bundleOpts.xagCandles) scalpCtx.xagCandles = bundleOpts.xagCandles;
  D.scalpEval = evaluateScalp(rows, scalpCtx);
  D.macroHint = D.scalpEval.macroHint || bundleOpts.macroHint || null;
  D.ker = D.scalpEval.ker || calculateKaufmanER(rows, 20);
  D.paxgBasis = D.scalpEval.paxgBasis || null;
  D.newsState = D.scalpEval.newsState || { inNewsWindow: false };
  D.scalpValid = D.scalpEval.valid !== false;
  D.vprof = D.scalpEval.volProfile || goldVolumeProfile(rows, 100, 50);
  D.volSpike = goldVolumeSpike(rows);
  D.volSpikeSweep = false;
  D.nearestHVN = NaN;
  D.activeTriggers = D.scalpEval.activeTriggers ? D.scalpEval.activeTriggers.slice() : [];
  if (isFinite(D.scalpEval.context.nearestStructure)) D.nearestStructure = D.scalpEval.context.nearestStructure;
  var sei;
  for (sei = 0; sei < D.scalpEval.reads.length; sei++){
    var er = D.scalpEval.reads[sei];
    add(er.side, er.tag, er.label);
  }
  var vpRange0 = (D.vprof && isFinite(D.vprof.maxPrice) && isFinite(D.vprof.minPrice))
    ? (D.vprof.maxPrice - D.vprof.minPrice) : NaN;
  D.vpOk = isFinite(vpRange0) && vpRange0 >= 2.5*a15;
  if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
    var swIdx0 = rows.length - 1 - sw.barsAgo;
    if (swIdx0 >= 0 && goldVolumeSpike(rows, swIdx0)) D.volSpikeSweep = true;
    var curV2 = D.activeTriggers.indexOf('LIQUIDITY_SWEEP_VOL_VALIDATED') >= 0 && sw.barsAgo === 0;
    if (D.volSpikeSweep && !curV2){
      if (sw.dir === 'bullish'){
        add('long', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + reclaim (' + sw.barsAgo + 'b ago) — volume-validated');
        add('long', 'volspike', 'volume climax on the liquidity sweep bar — absorption confirms sell-side liquidity taken');
      } else {
        add('short', 'sweep', 'liquidity sweep of ' + sw.level.toFixed(2) + ' + rejection (' + sw.barsAgo + 'b ago) — volume-validated');
        add('short', 'volspike', 'volume climax on the liquidity sweep bar — absorption confirms buy-side liquidity taken');
      }
    }
  }

  var ob = D.ob = goldOrderBlocks(rows);
  if (ob){
    var tol = 0.5*a15;
    for (i = 0; i < ob.bullish.length; i++){
      z = ob.bullish[i];
      if (entry >= z.bottom - tol && entry <= z.top + tol){ add('long', 'ob', 'bullish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
    }
    for (i = 0; i < ob.bearish.length; i++){
      z = ob.bearish[i];
      if (entry >= z.bottom - tol && entry <= z.top + tol){ add('short', 'ob', 'bearish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)); break; }
    }
    for (i = 0; i < ob.breakers.length; i++){
      z = ob.breakers[i];
      if (z.dir === 'bullish' && entry > z.top) { add('long', 'breaker', 'breaker block — failed supply ' + z.top.toFixed(2) + ' flipped to demand'); break; }
      if (z.dir === 'bearish' && entry < z.bottom){ add('short', 'breaker', 'breaker block — failed demand ' + z.bottom.toFixed(2) + ' flipped to supply'); break; }
    }
  }

  var fvg = D.fvg = goldFVG(rows);
  if (fvg && fvg.length){
    var g = fvg[0];
    if (g.age <= 25){
      var fvgV2ok = !D.vpOk || goldFVGHasHVNSupport(g, D.vprof);
      if (fvgV2ok){
        if (g.dir === 'bullish' && entry >= g.bottom){
          add('long', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2)
              + ' holding' + (D.vpOk ? ' — HVN defends the gap' : ''));
        } else if (g.dir === 'bearish' && entry <= g.top){
          add('short', 'fvg', 'unmitigated 15m FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2)
              + ' capping' + (D.vpOk ? ' — HVN defends the gap' : ''));
        }
      }
    }
  }
  D.fvg1 = null;
  if (rows1h && rows1h.length >= 30){
    var fvg1 = D.fvg1 = goldFVG(rows1h);
    var vprof1 = goldVolumeProfile(rows1h, 100, 50);
    var vpOk1 = false;
    if (vprof1 && isFinite(vprof1.maxPrice) && isFinite(vprof1.minPrice)){
      vpOk1 = (vprof1.maxPrice - vprof1.minPrice) >= 2.5*a15;
    }
    if (fvg1 && fvg1.length){
      var g1 = fvg1[0];
      if (g1.age <= 25){
        var fvg1V2 = !vpOk1 || goldFVGHasHVNSupport(g1, vprof1);
        if (fvg1V2){
          if (g1.dir === 'bullish' && entry >= g1.bottom){
            add('long', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2)
                + (vpOk1 ? ' — HVN defends the gap' : ''));
          } else if (g1.dir === 'bearish' && entry <= g1.top){
            add('short', 'fvg1h', 'unmitigated 1H FVG ' + g1.bottom.toFixed(2) + '–' + g1.top.toFixed(2)
                + (vpOk1 ? ' — HVN defends the gap' : ''));
          }
        }
      }
    }
  }

  /* session VWAP — London-open anchor when available */
  var anchor = goldSessionAnchor(rows);
  D.anchor = anchor;
  var vw = D.vw = (anchor >= 0) ? goldVWAP(rows, anchor) : null;
  if (vw){
    if (vw.pos === 'ABOVE') add('long', 'vwap', 'holding above session VWAP ' + vw.value.toFixed(2));
    else if (vw.pos === 'BELOW') add('short', 'vwap', 'capped below session VWAP ' + vw.value.toFixed(2));
  }

  var rb = D.rb = goldRibbon(rows);
  if (rb.mode === 'BULL') add('long', 'ribbon', rb.pullback20 ? 'EMA ribbon bull + 20-EMA pullback zone' : 'EMA ribbon bull (20>50, above 200)');
  else if (rb.mode === 'BEAR') add('short', 'ribbon', rb.pullback20 ? 'EMA ribbon bear + 20-EMA pullback zone' : 'EMA ribbon bear (20<50, below 200)');

  var ich = D.ich = goldIchimoku(rows);
  if (ich.state === 'ABOVE') add('long', 'ichimoku', 'price above the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');
  else if (ich.state === 'BELOW') add('short', 'ichimoku', 'price below the cloud (thickness ' + (isFinite(ich.thickness) ? ich.thickness.toFixed(2) : 'n/a') + ')');

  var vsq = D.vsq = goldVolSqueeze(rows, volOpts);
  if (vsq.state === 'FIRED' && vsq.dir){
    add(vsq.dir === 'UP' ? 'long' : 'short', 'squeeze', 'BB/KC squeeze fired ' + vsq.dir.toLowerCase() + ' (' + vsq.firedAgo + 'b ago) — expansion');
  } else if (vsq.state === 'ON' && vsq.onRun >= 3){
    D.notes.push('BB inside KC ×' + vsq.onRun + ' — squeeze building, expansion coming');
  }

  var asian = D.asian = goldAsianRange(rows);
  if (asian){
    if (asian.state === 'LONG_BREAK') add('long', 'asian', 'Asian-range breakout above ' + asian.hi.toFixed(2));
    else if (asian.state === 'SHORT_BREAK') add('short', 'asian', 'Asian-range breakdown below ' + asian.lo.toFixed(2));
  }

  var rg = D.rg = goldRSIGold(rows);
  if (rg.zone === 'OVERSOLD') add('long', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≤ 25 — gold oversold extreme');
  else if (rg.zone === 'OVERBOUGHT') add('short', 'rsi', 'RSI ' + rg.rsi.toFixed(1) + ' ≥ 75 — gold overbought extreme');
  if (rg.div === 'BULLISH') add('long', 'rsidiv', 'RSI bullish divergence — ' + rg.detail);
  else if (rg.div === 'BEARISH') add('short', 'rsidiv', 'RSI bearish divergence — ' + rg.detail);

  var cc = D.cc = goldCCI(rows);
  if (cc.zone === 'EXTREME_LOW') add('long', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≤ -100 extreme');
  else if (cc.zone === 'EXTREME_HIGH') add('short', 'cci', 'CCI ' + cc.cci.toFixed(0) + ' ≥ +100 extreme');
  else if (cc.zeroCross && cc.zeroCross.barsAgo <= 2){
    add(cc.zeroCross.dir === 'UP' ? 'long' : 'short', 'cci', 'CCI zero-line cross ' + cc.zeroCross.dir.toLowerCase() + ' (' + cc.zeroCross.barsAgo + 'b ago)');
  }

  var sr = D.sr = goldStochRSI(rows);
  if (rb.mode === 'BULL' && (sr.state === 'OVERSOLD' || sr.crossUp))
    add('long', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' washed out inside a bull ribbon — pullback timed');
  else if (rb.mode === 'BEAR' && (sr.state === 'OVERBOUGHT' || sr.crossDown))
    add('short', 'stochrsi', 'StochRSI ' + (isFinite(sr.k) ? sr.k.toFixed(0) : 'n/a') + ' stretched inside a bear ribbon — pullback timed');

  var lastBar = rows[n-1];
  var mfi = D.mfi = goldMFI(rows, volOpts);
  if (mfi.last === 'GREEN') add(lastBar.c >= lastBar.o ? 'long' : 'short', 'mfi', 'MFI green bar — volume-driven trend');
  else if (mfi.last === 'SQUAT') D.notes.push('MFI pink bar — high volume + low range: manipulation / breakout watch, confirmation required');

  /* volume profile POC / HVN proximity reads (vprof computed at bundle start) */
  if (D.vprof && D.vpOk && isFinite(D.vprof.pocPrice)){
    var pocPx = D.vprof.pocPrice;
    if (Math.abs(entry - pocPx) <= 0.75*a15){
      if (entry >= pocPx){
        add('short', 'poc', 'price at session POC ' + pocPx.toFixed(2) + ' — fair-value magnet from above', true);
      } else {
        add('long', 'poc', 'price at session POC ' + pocPx.toFixed(2) + ' — fair-value magnet from below', true);
      }
    }
    var hvns = D.vprof.hvns;
    if (hvns && hvns.length){
      var nearH = NaN, nearD = Infinity, hi;
      for (hi = 0; hi < hvns.length; hi++){
        var dH = Math.abs(entry - hvns[hi]);
        if (dH < nearD){ nearD = dH; nearH = hvns[hi]; }
      }
      D.nearestHVN = nearH;
      if (isFinite(nearH) && nearD <= 0.5*a15){
        var hvnTouch = nearD <= 0.25*a15;
        if (entry >= nearH){
          add('long', 'hvn', 'price retesting HVN support at ' + nearH.toFixed(2) + ' — high-volume node holding');
          if (hvnTouch){
            add('long', 'hvn', 'inside the HVN retest band (≤0.25×ATR) — session volume node actively defending', true);
          }
        } else {
          add('short', 'hvn', 'price retesting HVN resistance at ' + nearH.toFixed(2) + ' — high-volume node capping');
          if (hvnTouch){
            add('short', 'hvn', 'inside the HVN retest band (≤0.25×ATR) — session volume node actively capping', true);
          }
        }
        if (D.volSpike && hvnTouch){
          var hSide = (entry >= nearH) ? 'long' : 'short';
          add(hSide, 'hvn', 'volume climax on the HVN retest bar — absorption confirms institutional defense at the node', true);
        }
      }
    }
  }
  if (D.volSpike && !(sw && sw.barsAgo !== null && sw.barsAgo <= 2)){
    D.notes.push('volume spike on the current bar — climax/absorption watch; confirm direction before entry');
  }

  D.rb4 = null;
  if (rows4h && rows4h.length >= 50){
    var rb4 = D.rb4 = goldRibbon(rows4h);
    if (rb4.mode === 'BULL') add('long', 'macro4h', '4H ribbon bull — macro tailwind');
    else if (rb4.mode === 'BEAR') add('short', 'macro4h', '4H ribbon bear — macro headwind');
  }

  /* === v54 GOLD MASTERCLASS detectors ===
     Every read added below is a CONTEXT read (ctx:true): zone state, trend
     strength, session structure. Context informs the confluence ledger but
     NEVER vetoes — __gsCand excludes ctx reads from the oppose count, and a
     v54 strategy candidate counts its own trigger read plus the independent
     classic reads, so the masterclass layer cannot silence the legacy setups. */
  var vwb = D.vwb = goldVWAPBands(rows, anchor >= 0 ? anchor : 0);
  if (vwb){
    if (vwb.band === 'AT_2σ' || vwb.band === 'AT_3σ'){
      if (vwb.pos === 'ABOVE') add('short', 'vwapband', 'price at VWAP ' + vwb.band + ' (' + vwb.distSig.toFixed(1) + 'σ) — mean-reversion short', true);
      else if (vwb.pos === 'BELOW') add('long', 'vwapband', 'price at VWAP ' + vwb.band + ' (' + vwb.distSig.toFixed(1) + 'σ) — mean-reversion long', true);
    }
  }
  var bos = D.bos = goldBOS(rows);
  if (bos && bos.bos){
    if (bos.bos === 'bullish') add('long', 'bosalign', 'BOS bullish — structure break with ' + (bos.strength || 'moderate') + ' displacement', true);
    else add('short', 'bosalign', 'BOS bearish — structure break with ' + (bos.strength || 'moderate') + ' displacement', true);
  }
  if (bos && bos.choch){
    if (bos.choch === 'bullish') add('long', 'bosalign', 'CHoCH bullish — bias flip to demand', true);
    else add('short', 'bosalign', 'CHoCH bearish — bias flip to supply', true);
  }
  /* fractal SMC — BOS/CHOCH as independent ledger reads (count toward confluence) */
  D.swings = goldSwings(rows, 5, 5);
  D.mstruct = goldMarketStructure(rows, D.swings);
  if (D.mstruct && D.mstruct.bos && isFinite(D.mstruct.level)){
    if (D.mstruct.trend === 'bullish'){
      add('long', 'bos', 'fractal BOS bullish — close above swing high '
          + D.mstruct.level.toFixed(2) + ' (higher-high structure)');
    } else if (D.mstruct.trend === 'bearish'){
      add('short', 'bos', 'fractal BOS bearish — close below swing low '
          + D.mstruct.level.toFixed(2) + ' (lower-low structure)');
    }
  } else if (D.mstruct && D.mstruct.choch && isFinite(D.mstruct.level)){
    if (D.mstruct.trend === 'bullish'){
      add('long', 'choch', 'fractal CHOCH bullish — character shift above swing high '
          + D.mstruct.level.toFixed(2));
    } else if (D.mstruct.trend === 'bearish'){
      add('short', 'choch', 'fractal CHOCH bearish — character shift below swing low '
          + D.mstruct.level.toFixed(2));
    }
  }
  D.activeOBs = goldActiveOrderBlocks(rows, a15);
  D.obRetest = goldOrderBlockRetest(rows, rows.length - 1, D.mstruct, D.activeOBs);
  if (D.obRetest && D.obRetest.trigger){
    var obrSide = D.obRetest.direction;
    add(obrSide, 'ob', 'structure-aligned order block retest — price inside unmitigated '
        + (D.obRetest.obType === 'bullish_ob' ? 'bullish' : 'bearish') + ' OB '
        + D.obRetest.base.toFixed(2) + '–' + D.obRetest.top.toFixed(2)
        + ' with ' + D.mstruct.trend + ' fractal structure');
  }
  var pd = D.pd = goldPremiumDiscount(rows);
  if (pd){
    if (pd.zone === 'PREMIUM') add('short', 'premium', 'price in daily PREMIUM zone (top 25%) — sells favored', true);
    else if (pd.zone === 'DISCOUNT') add('long', 'premium', 'price in daily DISCOUNT zone (bottom 25%) — buys favored', true);
  }
  var adr = D.adr = goldADR(rows, 14);
  if (adr && adr.exhausted === 'YES'){
    if (adr.bias === 'short') add('short', 'adrfade', 'ADR ' + (adr.pctOfADR*100).toFixed(0) + '% consumed — exhaustion fade short', true);
    else add('long', 'adrfade', 'ADR ' + (adr.pctOfADR*100).toFixed(0) + '% consumed — exhaustion fade long', true);
  }
  var orL = D.orL = goldOpeningRange(rows, 'london');
  var orN = D.orN = goldOpeningRange(rows, 'ny');
  if (orL && (orL.state === 'LONG_BREAK' || orL.state === 'SHORT_BREAK')){
    var odir = (orL.state === 'LONG_BREAK') ? 'long' : 'short';
    add(odir, 'openrange', 'London opening-range breakout ' + (odir==='long'?'above':'below') + ' $' + (odir==='long'?orL.hi:orL.lo).toFixed(2), true);
  }
  if (orN && (orN.state === 'LONG_BREAK' || orN.state === 'SHORT_BREAK')){
    var odir2 = (orN.state === 'LONG_BREAK') ? 'long' : 'short';
    add(odir2, 'openrange', 'NY opening-range breakout ' + (odir2==='long'?'above':'below') + ' $' + (odir2==='long'?orN.hi:orN.lo).toFixed(2), true);
  }
  var eq = D.eq = goldEqualLevels(rows);
  if (eq && eq.nearestHigh && eq.nearestHigh.touches >= 2){
    D.notes.push('equal highs liquidity pool at $' + eq.nearestHigh.level.toFixed(2) + ' (×' + eq.nearestHigh.touches + ') — sweep target above');
  }
  if (eq && eq.nearestLow && eq.nearestLow.touches >= 2){
    D.notes.push('equal lows liquidity pool at $' + eq.nearestLow.level.toFixed(2) + ' (×' + eq.nearestLow.touches + ') — sweep target below');
  }
  var adxR = D.adxR = goldADX(rows);
  if (adxR){
    if (adxR.state === 'TRENDING') D.notes.push('ADX ' + adxR.adx.toFixed(1) + ' — trending market, ride the move');
    else if (adxR.state === 'CHOP') D.notes.push('ADX ' + adxR.adx.toFixed(1) + ' — chop regime, mean-reversion favored');
  }
  var rbD = D.rbD = goldRangeBound(rows);
  if (rbD && rbD.isRangeBound){
    D.notes.push('RANGE-BOUND (' + rbD.confidence + ' confidence) — fade the edges, avoid breakouts');
  }
  var ha = D.ha = goldHeikinAshi(rows);
  if (ha && ha.strength === 'STRONG'){
    if (ha.dir === 'bull') add('long', 'ha', 'Heikin-Ashi STRONG bull — ' + ha.consecutive + ' consecutive bull candles', true);
    else if (ha.dir === 'bear') add('short', 'ha', 'Heikin-Ashi STRONG bear — ' + ha.consecutive + ' consecutive bear candles', true);
  }

  return D;
}

/* Expose the detector ledger for BRAIN / diagnostics (same reads as setup candidates). */
function goldDetectorReads(inp){
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m);
    if (!rows || rows.length < 30) return [];
    var a15 = __last(_atr(rows, 14));
    if (!isFinite(a15) || !(a15 > 0)) return [];
    var entry = rows[rows.length - 1].c;
    if (!isFinite(entry)) return [];
    var D = __goldBundle(rows, __rows(inp.rows1h), __rows(inp.rows4h), entry, a15);
    return D.reads ? D.reads.slice() : [];
  }catch(e){ return []; }
}

function goldScalpSetups(inp){
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m);
    if (!rows || rows.length < 30) return [];
    var n = rows.length;
    var a15 = __last(_atr(rows, 14));
    if (!isFinite(a15) || !(a15 > 0)) return [];
    var entry = rows[n-1].c;
    if (!isFinite(entry) || !(entry > 0)) return [];
    var nowMs = __toMs(inp.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var kz = goldKillzone(nowMs);
    var newsState = inp.news;
    if (newsState === undefined && typeof W.hgNewsState === 'function'){
      try{ newsState = W.hgNewsState(); }catch(eN){ newsState = null; }
    }
    var news = __newsCaution(newsState, nowMs);

    var bundleOpts = {};
    if (inp.dxyCandles) bundleOpts.dxyCandles = inp.dxyCandles;
    if (inp.currentDxy) bundleOpts.currentDxy = inp.currentDxy;
    if (inp.macroHint) bundleOpts.macroHint = inp.macroHint;
    if (isFinite(inp.paxgPrice)) bundleOpts.paxgPrice = inp.paxgPrice;
    if (isFinite(inp.spotXauPrice)) bundleOpts.spotXauPrice = inp.spotXauPrice;
    if (inp.newsGuard) bundleOpts.newsGuard = inp.newsGuard;
    if (inp.news) bundleOpts.news = inp.news;
    if (inp.us10yCandles) bundleOpts.us10yCandles = inp.us10yCandles;
    if (inp.tickBuffer) bundleOpts.tickBuffer = inp.tickBuffer;
    if (inp.l2OrderBook) bundleOpts.l2OrderBook = inp.l2OrderBook;
    if (isFinite(inp.domDepth)) bundleOpts.domDepth = inp.domDepth;
    if (inp.dailyCandles) bundleOpts.dailyCandles = inp.dailyCandles;
    if (inp.xauCandles) bundleOpts.xauCandles = inp.xauCandles;
    if (inp.xagCandles) bundleOpts.xagCandles = inp.xagCandles;
    if (isFinite(inp.newsWindowMinutes)) bundleOpts.newsWindowMinutes = inp.newsWindowMinutes;
    if (inp.candleSource) bundleOpts.candleSource = inp.candleSource;
    else if (inp.source) bundleOpts.candleSource = inp.source;
    var D = __goldBundle(rows, __rows(inp.rows1h), __rows(inp.rows4h), entry, a15, bundleOpts);
    D.kz = kz; D.news = news;

    /* quality-gate context shared by every strategy candidate:
       200-EMA-15m value + 5-bar slope (trend alignment), the 4H EMA50/200
       stack ('bull' | 'bear' | null when unknowable), Kaufman ER(20) chop. */
    var closes15 = __closes(rows);
    var e2arr = _ema(closes15, 200);
    D.e200v = __last(e2arr);
    var e2back = (e2arr && e2arr.length >= 6) ? e2arr[e2arr.length - 6] : NaN;
    D.e200Slope = (isFinite(D.e200v) && isFinite(e2back)) ? (D.e200v - e2back) : NaN;
    var rb4s = D.rb4;
    D.stack4 = (rb4s && isFinite(rb4s.e50) && isFinite(rb4s.e200))
      ? (rb4s.e50 > rb4s.e200 ? 'bull' : (rb4s.e50 < rb4s.e200 ? 'bear' : null)) : null;
    var kerObj = calculateKaufmanER(rows, 20);
    D.ker = kerObj;
    D.er = kerObj.er;

    /* dropped candidates (e.g. structure too close — R:R insufficient) ride
       the .rejected side-channel so the tab can render named reason lines;
       the main array keeps its established shape/semantics. */
    var out = [], rejected = [], seen = {};
    out.rejected = rejected;
    function push(c){
      if (!c) return;
      if (c.dropped){ rejected.push(c); return; }
      var inst = hgGoldInstFilter(c, {
        rows: rows, nowMs: nowMs, scalp: true,
        /* Asia demotes (ASIA SESSION stamp) instead of hard-dropping — demoted
           cards still paint on GOLD SCALP; they can never lead. OMNIGOLD native
           tickets keep sessionHard hard-reject via hgOgInstFilterHit. */
        hardReject: false,
        macro: inp.macro || null,
        dxyRows: inp.dxyRows || inp.dxyCandles || null,
        tnxRows: inp.tnxRows || inp.us10yCandles || null,
        news: newsState,
        rows4h: inp.rows4h,
        rows1d: inp.dailyCandles || inp.rows1d,
        l2OrderBook: inp.l2OrderBook,
        spreadUsd: inp.spreadUsd,
        spread: inp.spread,
        bid: inp.bid,
        ask: inp.ask
      });
      if (inst && inst.dropped){ rejected.push(inst); return; }
      try{
        if (!D.__formingRegime){
          D.__formingRegime = hgGoldFormingRegime({
            rows: rows, macro: inp.macro || null,
            dxyRows: inp.dxyRows || inp.dxyCandles || (inp.macro && inp.macro.dxyRows) || null
          });
        }
        hgGoldApplyFormingRegime(c, D.__formingRegime);
        if (!D.__oiTrap && (inp.oiRows || inp.deltaOi || (inp.perpNative && inp.perpNative.oi))){
          D.__oiTrap = hgGoldOiTrap(rows, inp.oiRows || inp.deltaOi || inp.perpNative.oi, {});
        }
        if (!D.__fundExt && (inp.fundingRows || inp.deltaFunding || (inp.perpNative && inp.perpNative.funding))){
          D.__fundExt = hgGoldFundingExtreme(inp.fundingRows || inp.deltaFunding || inp.perpNative.funding, {});
        }
        hgGoldApplyPerpNative(c, D.__oiTrap, D.__fundExt);
      }catch(eFr){}
      var mv = __gsMicroVeto(c.dir, c.stratKey, D, bundleOpts);
      if (mv){
        if (mv.demote){
          c.demoted = true;
          if (!Array.isArray(c.stamps)) c.stamps = [];
          if (c.stamps.indexOf('MACRO YIELD') < 0) c.stamps.push('MACRO YIELD');
          var gnMv = Array.isArray(c.gateNotes) ? c.gateNotes.slice() : [];
          gnMv.push(mv.reason || 'macro yield conflict — demoted, can never lead');
          c.gateNotes = gnMv;
        } else {
          rejected.push({ dropped: true, id: c.id || null, strategy: c.strategy || null,
                          stratKey: c.stratKey || null, dir: c.dir,
                          reason: mv.reason || 'microstructure veto' });
          return;
        }
      }
      if (!seen[c.id]){ seen[c.id] = true; out.push(c); }
    }
    var tol = 0.5*a15;

    /* --- 1) liquidity-sweep reversal (V2: volume climax required) --- */
    var sw = D.sw;
    if (sw && sw.dir && sw.barsAgo !== null && sw.barsAgo <= 10){
      var sdir = (sw.dir === 'bullish') ? 'long' : 'short';
      if (!D.volSpikeSweep){
        rejected.push({ dropped: true, id: 'sweep|' + sdir + '|' + Math.round(sw.level),
          strategy: GST_NAME.sweep, stratKey: 'sweep', dir: sdir,
          reason: 'liquidity sweep without volume climax — V2 gate requires institutional absorption on the sweep bar' });
      } else {
        var swWhy = 'swept ' + (sdir === 'long' ? 'sell-side liquidity at ' : 'buy-side liquidity at ') + sw.level.toFixed(2)
            + ' and reclaimed within ' + sw.barsAgo + ' bar(s) — volume-validated stop hunt, reversal fuel is loaded'
            + ' — volume climax on the sweep bar confirms absorption at the liquidity pool';
        push(__gsCand('sweep', sdir, D, sw.level, __gsSnapLvls(D, sdir),
          swWhy,
          'a 15m close back beyond ' + sw.level.toFixed(2) + ' (the swept ' + (sdir === 'long' ? 'low' : 'high') + ') negates the reclaim',
          undefined, sw.level));
      }
    }

    /* --- 1b) five-leg GOLD SWEEP ENGINE (map·wick·MSS·VWAP·RVOL) --- */
    try{
      if (!D.__sweepEngine){
        D.__sweepEngine = hgGoldSweepEngine(rows, {
          regime: D.__formingRegime || hgGoldFormingRegime({ rows: rows, macro: inp.macro }),
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null,
          scalp: true,
          mode: 'scalp'
        });
      }
      var eng = D.__sweepEngine;
      if (eng && (eng.confirmed || eng.tier === 'alert' || eng.tier === 'watch') && eng.dir){
        var engCand = __gsCand('liqsweep', eng.dir, D, eng.level, __gsSnapLvls(D, eng.dir),
          eng.why + ' — five-leg liquidity sweep engine',
          'a 15m close back beyond ' + (isFinite(eng.level) ? eng.level.toFixed(2) : 'the swept level') + ' negates the reclaim',
          undefined, eng.level);
        if (engCand){
          engCand.sweepScore = eng.score;
          engCand.sweepTier = eng.tier;
          if (!Array.isArray(engCand.stamps)) engCand.stamps = [];
          engCand.stamps.push('SWEEP ' + String(eng.score) + '/' + String(eng.tier || '').toUpperCase());
          try{
            var vpSw = typeof hgGoldVpBundle === 'function' ? hgGoldVpBundle(rows, {}) : null;
            var vpSwProf = (vpSw && vpSw.session) || goldVolumeProfile(rows, 100, 50);
            if (vpSwProf){
              var tgSw = hgGoldVpTargets({
                dir: eng.dir, entry: entry,
                stop: isFinite(eng.level) ? eng.level + (eng.dir === 'long' ? -1 : 1) * a15 : NaN,
                vprof: vpSwProf, bundle: vpSw, thin: true,
                mssOk: !!(eng.mss && eng.mss.ok) || !!eng.confirmed,
                vwap: (D.vw && isFinite(D.vw.vwap)) ? D.vw.vwap : NaN,
                sweepExtreme: eng.level, atr: a15,
                auction: vpSw && vpSw.auction,
                external: {
                  asiaHi: D.asian && D.asian.hi, asiaLo: D.asian && D.asian.lo
                }
              });
              if (tgSw && tgSw.ok){
                engCand.vpTargets = tgSw;
                if (isFinite(tgSw.tp1)) engCand.t1 = tgSw.tp1;
                if (isFinite(tgSw.tp2)) engCand.t2 = tgSw.tp2;
                if (tgSw.stopPlan && isFinite(tgSw.stopPlan.stop)) engCand.stop = tgSw.stopPlan.stop;
                if (tgSw.confirmed) engCand.stamps.push('VP TARGET CONFIRMED');
                else engCand.stamps.push('VP TARGETS');
                engCand.stamps.push('THIN VP');
              }
            }
          }catch(_vpSw){}
          if (eng.tier === 'watch' && !eng.confirmed) engCand.demoted = true;
          push(engCand);
        }
      }
    }catch(eEng){}

    /* --- 1c) NY VOLUME EXHAUSTION (two-volume test · session RVOL · MSS) --- */
    try{
      if (!D.__nyExh){
        D.__nyExh = hgGoldNyExhaustion(rows, {
          regime: D.__formingRegime || hgGoldFormingRegime({ rows: rows, macro: inp.macro }),
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null,
          now: nowMs
        });
      }
      var nyx = D.__nyExh;
      if (nyx && (nyx.confirmed || nyx.tier === 'alert' || nyx.tier === 'watch') && nyx.dir){
        var nyStop = (nyx.plan && isFinite(nyx.plan.stop)) ? nyx.plan.stop : nyx.level;
        var nyCand = __gsCand('nyexh', nyx.dir, D, nyStop, __gsSnapLvls(D, nyx.dir),
          nyx.why + ' — NY two-volume exhaustion (raid RVOL≥1.5 + takeover)',
          're-accept beyond swept level or 5m close through far side of reversal OB cancels',
          undefined, nyx.level);
        if (nyCand){
          nyCand.nyExhScore = nyx.score;
          nyCand.nyExhTier = nyx.tier;
          if (nyx.plan){
            if (isFinite(nyx.plan.t1)) nyCand.t1 = nyx.plan.t1;
            if (isFinite(nyx.plan.stop)) nyCand.stop = nyx.plan.stop;
          }
          try{
            var vpNyB = typeof hgGoldVpBundle === 'function' ? hgGoldVpBundle(rows, { now: nowMs }) : null;
            var vpNy = (vpNyB && vpNyB.session) || goldVolumeProfile(rows, 100, 50);
            if (vpNy){
              var tgNy = hgGoldVpTargets({
                dir: nyx.dir, entry: entry, stop: nyStop, vprof: vpNy, bundle: vpNyB, thin: true,
                mssOk: !!(nyx.takeover && nyx.takeover.mss && nyx.takeover.mss.ok) || !!nyx.confirmed,
                vwap: (D.vw && isFinite(D.vw.vwap)) ? D.vw.vwap : NaN,
                sweepExtreme: (nyx.raid && isFinite(nyx.level)) ? nyx.level : nyx.level,
                atr: a15,
                auction: vpNyB && vpNyB.auction,
                external: {
                  asiaHi: D.asian && D.asian.hi, asiaLo: D.asian && D.asian.lo,
                  pdh: D.__priorDay && D.__priorDay.hi, pdl: D.__priorDay && D.__priorDay.lo
                }
              });
              if (tgNy && tgNy.ok){
                nyCand.vpTargets = tgNy;
                if (isFinite(tgNy.tp1)) nyCand.t1 = tgNy.tp1;
                if (isFinite(tgNy.tp2)) nyCand.t2 = tgNy.tp2;
                if (tgNy.stopPlan && isFinite(tgNy.stopPlan.stop)) nyCand.stop = tgNy.stopPlan.stop;
                if (!Array.isArray(nyCand.stamps)) nyCand.stamps = [];
                if (tgNy.confirmed) nyCand.stamps.push('VP TARGET CONFIRMED');
                else nyCand.stamps.push('VP TARGETS');
                nyCand.stamps.push('THIN VP');
              }
            }
          }catch(_vpNy){}
          if (!Array.isArray(nyCand.stamps)) nyCand.stamps = [];
          nyCand.stamps.push('NY EXH ' + String(nyx.score) + '/' + String(nyx.tier || '').toUpperCase());
          if (nyx.cvdNote) nyCand.stamps.push('CVD PROXY');
          if (nyx.tier === 'watch' && !nyx.confirmed) nyCand.demoted = true;
          push(nyCand);
        }
      }
    }catch(eNy){}

    /* --- 1d) ADVANCED SWEEP→OB (HTF location + raid + MSS + fresh OB/FVG) --- */
    try{
      if (!D.__sweepOb){
        D.__sweepOb = hgGoldSweepOb(rows, {
          regime: D.__formingRegime || hgGoldFormingRegime({ rows: rows, macro: inp.macro }),
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null,
          now: nowMs,
          rows4h: __rows(inp.rows4h),
          rows1h: __rows(inp.rows1h),
          sweep: D.__sweepEngine || null
        });
      }
      var sob = D.__sweepOb;
      if (sob && (sob.confirmed || sob.tier === 'alert' || sob.tier === 'watch') && sob.dir){
        var sobStop = (sob.plan && isFinite(sob.plan.stop)) ? sob.plan.stop
          : (isFinite(sob.stop) ? sob.stop : sob.sweepLevel);
        var sobZone = sob.obZone ? { lo: sob.obZone.lo, hi: sob.obZone.hi } : null;
        var sobCand = __gsCand('sweepob', sob.dir, D, sobStop, __gsSnapLvls(D, sob.dir),
          sob.why + ' — HTF + liquidity raid + MSS then fresh OB/FVG (Q≥7 · R:R≥2)',
          'close through far side of OB or re-accept beyond swept level cancels',
          sobZone, isFinite(sob.entry) ? sob.entry : undefined);
        if (sobCand){
          sobCand.sweepObScore = sob.quality ? sob.quality.score : Math.round((sob.score || 0) / 10);
          sobCand.sweepObTier = sob.tier;
          sobCand.sweepObMode = sob.mode;
          if (isFinite(sob.entry)) sobCand.entry = sob.entry;
          if (isFinite(sob.t1)) sobCand.t1 = sob.t1;
          if (isFinite(sob.t2)) sobCand.t2 = sob.t2;
          if (isFinite(sob.stop)) sobCand.stop = sob.stop;
          if (!Array.isArray(sobCand.stamps)) sobCand.stamps = [];
          sobCand.stamps.push('SWEEP→OB Q'
            + (sob.quality ? sob.quality.score : '?') + '/10'
            + (sob.mode ? (' · ' + String(sob.mode).toUpperCase()) : ''));
          if (sob.tier === 'watch' && !sob.confirmed) sobCand.demoted = true;
          push(sobCand);
        }
      }
    }catch(eSob){}

    /* --- 1d2) SESSION SILVER BULLET (Asia→London / NY open window) --- */
    try{
      if (!D.__sessionBound){
        D.__sessionBound = hgGoldSessionBoundSweep(rows, {
          asia: D.asian || goldAsianRange(rows),
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null,
          now: nowMs
        });
      }
      var sbb = D.__sessionBound;
      if (sbb && sbb.ok && sbb.dir && (sbb.confirmed || sbb.tier === 'alert' || sbb.reclaimOk)){
        var sbbStop = (sbb.plan && isFinite(sbb.plan.stop)) ? sbb.plan.stop
          : (isFinite(sbb.stop) ? sbb.stop : sbb.sweepLevel);
        var sbbZone = sbb.entryZone ? { lo: sbb.entryZone.lo, hi: sbb.entryZone.hi } : null;
        var sbbCand = __gsCand('silverb', sbb.dir, D, sbbStop, __gsSnapLvls(D, sbb.dir),
          sbb.why + ' — session-bounded sweep→OB/FVG (Silver Bullet twin)',
          'close beyond sweep extreme or leave SB window cancels',
          sbbZone, isFinite(sbb.entry) ? sbb.entry : undefined);
        if (sbbCand){
          sbbCand.silverBTier = sbb.tier;
          sbbCand.silverBWindow = sbb.window;
          if (isFinite(sbb.entry)) sbbCand.entry = sbb.entry;
          if (isFinite(sbb.t1)) sbbCand.t1 = sbb.t1;
          if (isFinite(sbb.t2)) sbbCand.t2 = sbb.t2;
          if (isFinite(sbb.stop)) sbbCand.stop = sbb.stop;
          if (!Array.isArray(sbbCand.stamps)) sbbCand.stamps = [];
          sbbCand.stamps.push('SILVER BULLET'
            + (sbb.window ? (' · ' + sbb.window) : '')
            + (sbb.confirmed ? ' · ALERT' : ' · WATCH'));
          if (!sbb.confirmed) sbbCand.demoted = true;
          push(sbbCand);
        }
      }
    }catch(eSb){}

    /* --- 1e) PART4 S9–S18 advanced strategies --- */
    try{
      if (!D.__part4){
        D.__part4 = hgGoldPart4Engine(rows, {
          asia: D.asian || goldAsianRange(rows),
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null
        });
      }
      var p4 = D.__part4;
      if (p4 && p4.strategies && p4.strategies.length){
        var p4j, p4hit;
        for (p4j = 0; p4j < p4.strategies.length; p4j++){
          p4hit = p4.strategies[p4j];
          if (!p4hit.dir || (p4hit.grade !== 'forming' && p4hit.grade !== 'confirmed')) continue;
          if (p4hit.key === 'p4disc' || p4hit.key === 'p4asiasd') continue; /* frame-only */
          var p4Stop = (p4hit.plan && isFinite(p4hit.plan.stop)) ? p4hit.plan.stop
            : (p4hit.dir === 'long' ? entry - 1.2 * a15 : entry + 1.2 * a15);
          var p4Cand = __gsCand(p4hit.key, p4hit.dir, D, p4Stop, __gsSnapLvls(D, p4hit.dir),
            p4hit.why, 'Part4 invalidation — structure break against the setup',
            undefined, isFinite(p4hit.level) ? p4hit.level : undefined);
          if (p4Cand){
            if (p4hit.plan){
              if (isFinite(p4hit.plan.t1)) p4Cand.t1 = p4hit.plan.t1;
              if (isFinite(p4hit.plan.t2)) p4Cand.t2 = p4hit.plan.t2;
              if (isFinite(p4hit.plan.stop)) p4Cand.stop = p4hit.plan.stop;
            }
            if (!Array.isArray(p4Cand.stamps)) p4Cand.stamps = [];
            p4Cand.stamps.push('PART4 ' + String(p4hit.key).toUpperCase());
            if (p4.pd) hgGoldPart4ApplyDiscountFilter(p4Cand, p4.pd);
            push(p4Cand);
          }
        }
      }
    }catch(eP4){}

    /* --- 1e2) PART5 S19–S28 regime / Wyckoff / turtle / VWAP / drives --- */
    try{
      if (!D.__part5){
        D.__part5 = hgGoldPart5Engine(rows, {
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null,
          now: nowMs,
          physical: (opts && opts.physical) || null
        });
      }
      var p5 = D.__part5;
      if (p5 && p5.strategies && p5.strategies.length){
        var p5Live = { p5wyck: 1, p5turt: 1, p5vwap: 1, p5drive: 1, p5news: 1 };
        var p5j, p5hit;
        for (p5j = 0; p5j < p5.strategies.length; p5j++){
          p5hit = p5.strategies[p5j];
          if (!p5hit || !p5hit.dir || !p5Live[p5hit.key]) continue;
          if (p5hit.grade !== 'forming' && p5hit.grade !== 'confirmed') continue;
          var p5Stop = (p5hit.plan && isFinite(p5hit.plan.stop)) ? p5hit.plan.stop
            : (p5hit.dir === 'long' ? entry - 1.2 * a15 : entry + 1.2 * a15);
          var p5Cand = __gsCand(p5hit.key, p5hit.dir, D, p5Stop, __gsSnapLvls(D, p5hit.dir),
            p5hit.why, 'Part5 invalidation — structure break against the setup',
            undefined, isFinite(p5hit.level) ? p5hit.level : undefined);
          if (p5Cand){
            if (p5hit.plan){
              if (isFinite(p5hit.plan.t1)) p5Cand.t1 = p5hit.plan.t1;
              if (isFinite(p5hit.plan.t2)) p5Cand.t2 = p5hit.plan.t2;
              if (isFinite(p5hit.plan.stop)) p5Cand.stop = p5hit.plan.stop;
            }
            if (!Array.isArray(p5Cand.stamps)) p5Cand.stamps = [];
            p5Cand.stamps.push('PART5 ' + String(p5hit.key).toUpperCase());
            if (p5.ker) hgGoldPart5ApplyRegimeFilter(p5Cand, p5.ker);
            if (p5.bias) hgGoldPart5ApplyWeeklyBiasFilter(p5Cand, p5.bias);
            push(p5Cand);
          }
        }
      }
    }catch(eP5){}

    /* --- 1f) SMC liquidity cluster + swept index (smart-money-concepts port) --- */
    try{
      if (!D.__smcLiq){
        D.__smcLiq = hgGoldSmcLiquidity(rows, {});
        D.__smcHit = hgGoldSmcLiquidityHit(rows, { smc: D.__smcLiq, closeBreak: true });
      }
      var smcHit = D.__smcHit;
      if (smcHit && smcHit.ok && smcHit.dir && isFinite(smcHit.level)){
        var smcStop = smcHit.dir === 'long'
          ? smcHit.level - 1.2 * a15
          : smcHit.level + 1.2 * a15;
        var smcCand = __gsCand('smcliq', smcHit.dir, D, smcStop, __gsSnapLvls(D, smcHit.dir),
          smcHit.why + ' — SMC liquidity() cluster + Swept index + close reclaim',
          'a 15m close back beyond ' + smcHit.level.toFixed(2) + ' negates the SMC reclaim',
          undefined, smcHit.level);
        if (smcCand){
          smcCand.smcSweptAge = smcHit.sweptAge;
          smcCand.smcPoolCount = smcHit.pool ? smcHit.pool.count : NaN;
          if (!Array.isArray(smcCand.stamps)) smcCand.stamps = [];
          smcCand.stamps.push('SMC LIQ'
            + (isFinite(smcHit.sweptAge) ? (' · age ' + smcHit.sweptAge) : '')
            + (smcHit.pool && smcHit.pool.count ? (' · n=' + smcHit.pool.count) : ''));
          push(smcCand);
        }
      }
    }catch(eSmc){}

    /* --- 1g) VP PLAYBOOK §10 gates (ENTER only) --- */
    try{
      if (!D.__vpPlaybook){
        D.__vpPlaybook = hgGoldVpPlaybook(rows, {
          scalp: true, now: nowMs,
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null,
          regime: D.__formingRegime,
          sweep: D.__sweepEngine || null,
          rows4h: __rows(inp.rows4h),
          asia: D.asian || goldAsianRange(rows),
          obOk: !!(D.obRetest && D.obRetest.trigger),
          mssOk: !!(D.__sweepEngine && D.__sweepEngine.mss && D.__sweepEngine.mss.ok)
        });
      }
      var vpb = D.__vpPlaybook;
      if (vpb && vpb.decision === 'ENTER' && vpb.dir && isFinite(vpb.entry)){
        var vpbStop = isFinite(vpb.stop) ? vpb.stop
          : (vpb.dir === 'long' ? vpb.entry - 1.2 * a15 : vpb.entry + 1.2 * a15);
        var vpbCand = __gsCand('vpbook', vpb.dir, D, vpbStop, __gsSnapLvls(D, vpb.dir),
          vpb.why + ' — VP playbook gates ' + vpb.gatesPass + '/12',
          'close beyond stop or acceptance against the swept pool cancels',
          undefined, vpb.entry);
        if (vpbCand){
          if (isFinite(vpb.t1)) vpbCand.t1 = vpb.t1;
          if (isFinite(vpb.t2)) vpbCand.t2 = vpb.t2;
          if (isFinite(vpb.entry)) vpbCand.entry = vpb.entry;
          if (vpb.halfSize) vpbCand.demoted = true;
          if (!Array.isArray(vpbCand.stamps)) vpbCand.stamps = [];
          vpbCand.stamps.push('VP ' + vpb.decision + ' ' + vpb.gatesPass + '/12'
            + (vpb.halfSize ? ' · HALF' : '')
            + (vpb.grade && vpb.grade.grade ? (' · ' + vpb.grade.grade) : ''));
          vpbCand.vpPlaybook = vpb;
          push(vpbCand);
        }
      }
    }catch(eVp){}

    /* --- 2) order-block / breaker retest (robust: active zones + structure alignment) --- */
    var obRetestDone = false;
    if (D.obRetest && D.obRetest.trigger){
      var rd = D.obRetest.direction;
      var zLo = D.obRetest.base, zHi = D.obRetest.top, stp = D.obRetest.anchor;
      push(__gsCand('ob', rd, D, stp, __gsSnapLvls(D, rd),
        'structure-aligned OB retest — price dipped into unmitigated '
          + (rd === 'long' ? 'bullish' : 'bearish') + ' order block '
          + zLo.toFixed(2) + '–' + zHi.toFixed(2)
          + ' during ' + (D.mstruct && D.mstruct.trend ? D.mstruct.trend : 'aligned') + ' fractal structure (close held inside the zone)',
        'a 15m close ' + (rd === 'long' ? 'below the order-block base ' : 'above the order-block top ')
          + stp.toFixed(2) + ' mitigates the zone',
        { lo: zLo, hi: zHi }, stp));
      obRetestDone = true;
    }
    var ob = D.ob;
    if (!obRetestDone && ob){
      var i, z;
      for (i = 0; i < ob.bullish.length; i++){
        z = ob.bullish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){
          push(__gsCand('ob', 'long', D, z.bottom, __gsSnapLvls(D, 'long'),
            'price retesting the bullish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2) + ' — unmitigated demand from the displacement origin',
            'a 15m close below the order-block base ' + z.bottom.toFixed(2) + ' fails the demand zone (it becomes a breaker)',
            { lo: z.bottom, hi: z.top }, z.bottom));
          break;
        }
      }
      for (i = 0; i < ob.bearish.length; i++){
        z = ob.bearish[i];
        if (entry >= z.bottom - tol && entry <= z.top + tol){
          push(__gsCand('ob', 'short', D, z.top, __gsSnapLvls(D, 'short'),
            'price retesting the bearish order block ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2) + ' — unmitigated supply from the displacement origin',
            'a 15m close above the order-block top ' + z.top.toFixed(2) + ' fails the supply zone (it becomes a breaker)',
            { lo: z.bottom, hi: z.top }, z.top));
          break;
        }
      }
      for (i = 0; i < ob.breakers.length; i++){
        z = ob.breakers[i];
        if (z.dir === 'bullish' && entry > z.top && entry <= z.top + 2*a15){
          push(__gsCand('ob', 'long', D, z.bottom, __gsSnapLvls(D, 'long'),
            'failed supply at ' + z.top.toFixed(2) + ' flipped to demand (breaker) — price holding above the flip',
            'a 15m close back below the breaker base ' + z.bottom.toFixed(2) + ' negates the flip',
            { lo: z.bottom, hi: z.top }, z.bottom));
          break;
        }
        if (z.dir === 'bearish' && entry < z.bottom && entry >= z.bottom - 2*a15){
          push(__gsCand('ob', 'short', D, z.top, __gsSnapLvls(D, 'short'),
            'failed demand at ' + z.bottom.toFixed(2) + ' flipped to supply (breaker) — price holding below the flip',
            'a 15m close back above the breaker top ' + z.top.toFixed(2) + ' negates the flip',
            { lo: z.bottom, hi: z.top }, z.top));
          break;
        }
      }
    }

    /* --- 3) FVG fill (15m first, then 1H) — V2: HVN launchpad when profile range is wide --- */
    function fvgCand(g, label, vprof, vpOk){
      if (!g || g.age > 25) return;
      if (entry < g.bottom - tol || entry > g.top + tol) return;
      if (vpOk && !goldFVGHasHVNSupport(g, vprof)){
        rejected.push({ dropped: true,
          id: 'fvg|' + (g.dir === 'bullish' ? 'long' : 'short') + '|' + Math.round(g.dir === 'bullish' ? g.bottom : g.top),
          strategy: GST_NAME.fvg, stratKey: 'fvg', dir: (g.dir === 'bullish' ? 'long' : 'short'),
          reason: 'FVG without HVN structural support — V2 gate requires a high-volume node defending the gap' });
        return;
      }
      var hvnNote = (vpOk && goldFVGHasHVNSupport(g, vprof))
        ? ' — session HVN defends the gap as a launchpad' : '';
      if (g.dir === 'bullish'){
        push(__gsCand('fvg', 'long', D, g.bottom, __gsSnapLvls(D, 'long'),
          'price retraced into the unmitigated ' + label + ' FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2)
            + ' — the imbalance fill zone is acting as demand' + hvnNote,
          'a 15m close below the gap base ' + g.bottom.toFixed(2) + ' fills-and-fails the imbalance',
          { lo: g.bottom, hi: g.top }, g.bottom));
      } else {
        push(__gsCand('fvg', 'short', D, g.top, __gsSnapLvls(D, 'short'),
          'price rallied into the unmitigated ' + label + ' FVG ' + g.bottom.toFixed(2) + '–' + g.top.toFixed(2)
            + ' — the imbalance fill zone is acting as supply' + hvnNote,
          'a 15m close above the gap top ' + g.top.toFixed(2) + ' fills-and-fails the imbalance',
          { lo: g.bottom, hi: g.top }, g.top));
      }
    }
    var gotFvg = false;
    if (D.fvg && D.fvg.length){
      var before = out.length;
      fvgCand(D.fvg[0], '15m', D.vprof, D.vpOk);
      gotFvg = out.length > before;
    }
    if (!gotFvg && D.fvg1 && D.fvg1.length){
      var vprof1c = goldVolumeProfile(__rows(inp.rows1h), 100, 50);
      var vpOk1c = false;
      if (vprof1c && isFinite(vprof1c.maxPrice) && isFinite(vprof1c.minPrice)){
        vpOk1c = (vprof1c.maxPrice - vprof1c.minPrice) >= 2.5*a15;
      }
      fvgCand(D.fvg1[0], '1H', vprof1c, vpOk1c);
    }

    /* --- 4) session-VWAP bounce / rejection --- */
    var vw = D.vw;
    if (vw && isFinite(vw.value) && Math.abs(entry - vw.value) <= 0.75*a15){
      var vZone = { lo: vw.value - 0.25*a15, hi: vw.value + 0.25*a15 };
      if (vw.pos === 'ABOVE'){
        push(__gsCand('vwap', 'long', D, vw.lower, __gsSnapLvls(D, 'long'),
          'price bouncing off session VWAP ' + vw.value.toFixed(2) + ' — holding the bid side of fair value',
          'a 15m close back below session VWAP ' + vw.value.toFixed(2) + ' loses fair value',
          vZone, vw.value));
      } else if (vw.pos === 'BELOW'){
        push(__gsCand('vwap', 'short', D, vw.upper, __gsSnapLvls(D, 'short'),
          'price rejected at session VWAP ' + vw.value.toFixed(2) + ' — capped under fair value',
          'a 15m close back above session VWAP ' + vw.value.toFixed(2) + ' reclaims fair value',
          vZone, vw.value));
      }
    }

    /* --- 5) EMA 20/50/200 ribbon pullback --- */
    var rb = D.rb;
    if (rb && rb.pullback20 && (rb.mode === 'BULL' || rb.mode === 'BEAR')){
      var rdir = (rb.mode === 'BULL') ? 'long' : 'short';
      push(__gsCand('ribbon', rdir, D, (isFinite(rb.e50) ? rb.e50 : NaN), __gsSnapLvls(D, rdir),
        'pullback into the 20-EMA (' + (isFinite(rb.e20) ? rb.e20.toFixed(2) : 'n/a') + ') inside a ' + rb.mode.toLowerCase()
          + ' 20/50/200 ribbon — trend-continuation entry with the flow',
        'a 15m close through the 50-EMA ' + (isFinite(rb.e50) ? rb.e50.toFixed(2) : 'n/a') + ' breaks the pullback structure',
        { lo: (isFinite(rb.e20) ? rb.e20 - 0.25*a15 : entry - 0.25*a15), hi: (isFinite(rb.e20) ? rb.e20 + 0.25*a15 : entry + 0.25*a15) },
        rb.e20));
    }

    /* --- 6) Asian-range (00:00-08:00 UTC) breakout — robust: volume-validated --- */
    var asianDone = false;
    if (D.scalpEval && D.scalpEval.asianSetup && D.scalpEval.asianSetup.trigger){
      var ab = D.scalpEval.asianSetup;
      var abDir = ab.direction;
      push(__gsCand('asian', abDir, D, ab.anchor, __gsSnapLvls(D, abDir),
        'volume-validated Asian-range breakout ' + (abDir === 'long' ? 'above' : 'below')
          + ' the box ' + ab.asianLow.toFixed(2) + '–' + ab.asianHigh.toFixed(2)
          + ' — displacement with volume expansion (1.3× avg)',
        'a 15m close back inside the Asian range (' + ab.asianLow.toFixed(2) + '–' + ab.asianHigh.toFixed(2) + ') negates the breakout',
        { lo: ab.asianLow, hi: ab.asianHigh }, abDir === 'long' ? ab.asianHigh : ab.asianLow));
      asianDone = true;
    }
    var asian = D.asian;
    if (!asianDone && asian && (asian.state === 'LONG_BREAK' || asian.state === 'SHORT_BREAK')){
      var adir = (asian.state === 'LONG_BREAK') ? 'long' : 'short';
      push(__gsCand('asian', adir, D, (adir === 'long' ? asian.hi : asian.lo), __gsSnapLvls(D, adir),
        'London-volume breakout ' + (adir === 'long' ? 'above' : 'below') + ' the Asian box ' + asian.lo.toFixed(2) + '–' + asian.hi.toFixed(2)
          + ' (' + asian.dayIso + ', 00:00–08:00 UTC) — range expansion underway',
        'a 15m close back inside the Asian range (' + asian.lo.toFixed(2) + '–' + asian.hi.toFixed(2) + ') negates the breakout',
        undefined, (adir === 'long' ? asian.hi : asian.lo)));
    }

    /* --- 7) modified-RSI (75/25) divergence --- */
    var rg = D.rg;
    if (rg && rg.div){
      var ddir = (rg.div === 'BULLISH') ? 'long' : 'short';
      var piv = (ddir === 'long') ? rg.pivotLow : rg.pivotHigh;
      push(__gsCand('rsidiv', ddir, D, (isFinite(piv) ? piv : NaN), __gsSnapLvls(D, ddir),
        rg.detail + ' — momentum is exhausting at the extreme, mean-reversion ' + (ddir === 'long' ? 'long' : 'short'),
        'a 15m close beyond the divergence pivot ' + (isFinite(piv) ? piv.toFixed(2) : 'extreme') + ' confirms continuation instead of exhaustion',
        undefined, piv));
    }

    /* --- 7b) Delta OI-trap reversal (perp-native) --- */
    try{
      var oiSeries = inp.oiRows || inp.deltaOi || (inp.perpNative && inp.perpNative.oi) || null;
      var oiHit = hgGoldOiTrap(rows, oiSeries, {});
      D.__oiTrap = oiHit;
      if (oiHit && oiHit.ok && oiHit.dir){
        push(__gsCand('oitrap', oiHit.dir, D, oiHit.level, __gsSnapLvls(D, oiHit.dir),
          oiHit.why + ' — Delta XAUT OI history (perp-native edge)',
          'a 15m close back beyond the failed extreme ' + (isFinite(oiHit.level) ? oiHit.level.toFixed(2) : '') + ' re-opens the trap',
          undefined, oiHit.level));
      }
      var fundSeries = inp.fundingRows || inp.deltaFunding || (inp.perpNative && inp.perpNative.funding) || null;
      D.__fundExt = hgGoldFundingExtreme(fundSeries, {});
    }catch(eOi){}

    /* === v54 GOLD MASTERCLASS strategy candidates === */
    /* --- 8) VWAP Band mean-reversion (2σ/3σ) — ONLY in chop or when ADX<25 --- */
    var vwb = D.vwb;
    if (vwb && (vwb.band === 'AT_2σ' || vwb.band === 'AT_3σ')){
      var chopOk = !D.rbD || !D.rbD.isRangeBound;
      var adxOk = !D.adxR || D.adxR.adx < 25 || D.adxR.state !== 'TRENDING';
      if (chopOk && adxOk){
        var vdir = (vwb.pos === 'ABOVE') ? 'short' : ((vwb.pos === 'BELOW') ? 'long' : null);
        if (vdir){
          var vwapStop = (vdir === 'long') ? vwb.lower3 : vwb.upper3;
          push(__gsCand('vwapband', vdir, D, vwapStop, __gsSnapLvls(D, vdir),
            'VWAP ' + vwb.band + ' mean-reversion (' + vwb.distSig.toFixed(1) + 'σ from fair value) — price stretched, reversion to VWAP $' + vwb.value.toFixed(2) + ' expected',
            'a 15m close beyond VWAP 3σ band (' + (vdir==='long'?vwb.lower3:vwb.upper3).toFixed(2) + ') negates the mean-reversion edge',
            { lo: vwb.value - 0.25*D.a15, hi: vwb.value + 0.25*D.a15 }, vwb.value));
        }
      }
    }
    /* --- 9) Opening Range Breakout (London/NY) --- */
    var orL = D.orL, orN = D.orN;
    function orCand(orr){
      if (!orr || !(orr.state === 'LONG_BREAK' || orr.state === 'SHORT_BREAK')) return;
      var odir = (orr.state === 'LONG_BREAK') ? 'long' : 'short';
      var oLvl = (odir === 'long') ? orr.hi : orr.lo;
      push(__gsCand('openrange', odir, D, oLvl, __gsSnapLvls(D, odir),
        orr.session.toUpperCase() + ' opening-range breakout ' + (odir==='long'?'above':'below') + ' $' + oLvl.toFixed(2)
          + ' — first-hour momentum, volume-confirmed expansion',
        'a 15m close back inside the opening range (' + orr.lo.toFixed(2) + '–' + orr.hi.toFixed(2) + ') negates the breakout',
        undefined, oLvl));
    }
    orCand(orL); orCand(orN);
    /* --- 10) ADR Exhaustion Fade — robust VWAP-band fade or legacy confluence --- */
    var adrDone = false;
    if (D.scalpEval && D.scalpEval.adrFade && D.scalpEval.adrFade.trigger){
      var af = D.scalpEval.adrFade;
      var afPct = (D.scalpEval.adrData && isFinite(D.scalpEval.adrData.percentageConsumed))
        ? (D.scalpEval.adrData.percentageConsumed * 100).toFixed(0) : '80+';
      push(__gsCand('adrfade', af.direction, D, af.anchor, __gsSnapLvls(D, af.direction),
        'ADR exhaustion fade — ' + afPct + '% of daily range consumed, price stretched beyond session VWAP '
          + (af.direction === 'short' ? 'upper' : 'lower') + ' band — mean-reversion fade',
        'a fresh 15m high/low beyond the exhaustion wick (' + af.anchor.toFixed(2) + ') confirms continuation, not exhaustion',
        undefined, af.anchor));
      adrDone = true;
    }
    var adr = D.adr;
    if (!adrDone && adr && adr.exhausted === 'YES' && isFinite(adr.pctOfADR)){
      var adir = (adr.bias === 'short') ? 'short' : 'long';
      var adrOk = false;
      if (adir === 'short' && D.pd && D.pd.zone === 'PREMIUM') adrOk = true;
      if (adir === 'long' && D.pd && D.pd.zone === 'DISCOUNT') adrOk = true;
      if (adir === 'short' && D.vwb && D.vwb.pos === 'ABOVE') adrOk = true;
      if (adir === 'long' && D.vwb && D.vwb.pos === 'BELOW') adrOk = true;
      if (adrOk){
        var adrStop = (adir === 'long') ? entry + 1.2*D.a15 : entry - 1.2*D.a15;
        push(__gsCand('adrfade', adir, D, adrStop, __gsSnapLvls(D, adir),
          'ADR exhaustion fade — ' + (adr.pctOfADR*100).toFixed(0) + '% of daily range consumed, momentum stretched. '
            + (adir==='long'?'Buy the dip':'Sell the rip') + ' with tight stop.',
          'a fresh 15m high/low beyond the exhaustion point confirms continuation, not exhaustion',
          undefined, entry));
      }
    }
    /* --- 11) BOS Alignment — multi-timeframe structure confirmation --- */
    var bos = D.bos;
    var ms = D.mstruct;
    var hasFractalBos = ms && ms.bos;
    var hasLegacyBos = bos && bos.bos;
    if (hasFractalBos || hasLegacyBos){
      var bdir = hasFractalBos
        ? (ms.trend === 'bullish' ? 'long' : 'short')
        : (bos.bos === 'bullish' ? 'long' : 'short');
      var htAlign = D.rb4 && ((bdir==='long' && D.rb4.mode==='BULL') || (bdir==='short' && D.rb4.mode==='BEAR'));
      var mtAlign = D.rb && ((bdir==='long' && D.rb.mode==='BULL') || (bdir==='short' && D.rb.mode==='BEAR'));
      if (htAlign || mtAlign){
        var bosLvl = (hasFractalBos && isFinite(ms.level)) ? ms.level
          : ((bdir==='long') ? bos.lastSwingLow : bos.lastSwingHigh);
        var bosKind = hasFractalBos ? 'fractal BOS' : 'BOS';
        push(__gsCand('bosalign', bdir, D, bosLvl, __gsSnapLvls(D, bdir),
          'BOS alignment — ' + (bdir==='long'?'bullish':'bearish') + ' ' + bosKind + ' on 15m '
            + (htAlign?'with 4H trend confirmation':'with 15m trend confirmation')
            + (isFinite(bosLvl) ? ' at $' + bosLvl.toFixed(2) : '')
            + ' — trade the pullback into the broken structure',
          'a 15m close back through the BOS level $' + (isFinite(bosLvl) ? bosLvl.toFixed(2) : 'structure') + ' invalidates the break',
          undefined, bosLvl));
      }
    }

    /* --- 12) HVN / volume-node retest (session volume profile) --- */
    var hvnDist = isFinite(D.nearestHVN) ? Math.abs(entry - D.nearestHVN) : Infinity;
    var hvnTouch = hvnDist <= 0.25*a15;
    if (D.vpOk && D.vprof && isFinite(D.nearestHVN) && hvnDist <= 0.5*a15
        && (D.volSpike || D.volSpikeSweep || hvnTouch)){
      var hvn = D.nearestHVN;
      var hdir = (entry >= hvn) ? 'long' : 'short';
      var hWhy = 'price retesting the high-volume node at ' + hvn.toFixed(2);
      if (D.volSpike){
        hWhy += ' on a volume-climax bar — absorption at the node';
      } else {
        hWhy += ' — session volume profile support/resistance';
      }
      push(__gsCand('hvn', hdir, D, hvn, __gsSnapLvls(D, hdir),
        hWhy,
        'a 15m close ' + (hdir === 'long' ? 'below' : 'above') + ' the HVN at ' + hvn.toFixed(2) + ' negates the node',
        { lo: hvn - 0.25*a15, hi: hvn + 0.25*a15 }, hvn));
    }

    return out;
  }catch(e){ return []; }
}

/* =========================================================================
   FORMING-NOW WATCH — goldWatch({rows15m, rows1h, rows4h, now, tf}): per-
   strategy ARMED/IDLE state with the EXACT live trigger condition and the
   REAL price level the strategy is watching, all from the same detector
   math (__goldBundle) the candidates are built from — nothing fabricated.
   'armed' = the structural trigger level exists and is watchable; it is a
   WATCH ITEM, NOT an entry (a candidate still needs the trigger PLUS >=2
   independent agreeing reads). 'idle' carries the honest reason (and the
   text 'no levels available' when the level is uncomputable). tf labels the
   timeframe in the condition text ('15m' scalp; other callers pass their
   own). -> [{stratKey, strategy, state:'armed'|'idle', level:number|null,
   condition:string, reason:string|null}] — always one entry per strategy,
   [] on garbage input, never throws.
========================================================================= */
function goldWatch(inp){
  var out = [];
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m);
    if (!rows || rows.length < 30) return [];
    var n = rows.length;
    var a15 = __last(_atr(rows, 14));
    if (!isFinite(a15) || !(a15 > 0)) return [];
    var entry = rows[n-1].c;
    if (!isFinite(entry) || !(entry > 0)) return [];
    var tf = (typeof inp.tf === 'string' && inp.tf) ? inp.tf : '15m';
    var D = __goldBundle(rows, __rows(inp.rows1h), __rows(inp.rows4h), entry, a15);
    function emit(key, state, level, condition, reason, dir){
      out.push({ stratKey: key, strategy: GST_NAME[key] || key,
                 dir: dir || null,
                 state: (state === 'armed') ? 'armed' : 'idle',
                 level: (typeof level === 'number' && isFinite(level)) ? level : null,
                 condition: condition || '', reason: reason || null });
    }

    /* 1) liquidity sweep — the prior-25-bar swing high/low is the watched
       liquidity pool; the trigger is a wick beyond it + a reclaim close. */
    if (n >= 26){
      var sH = -Infinity, sL = Infinity;
      for (var i = Math.max(0, n - 25); i < n; i++){
        if (rows[i].h > sH) sH = rows[i].h;
        if (rows[i].l < sL) sL = rows[i].l;
      }
      if (isFinite(sH) && isFinite(sL)){
        var nearLow = Math.abs(entry - sL) <= Math.abs(sH - entry);
        emit('sweep', 'armed', nearLow ? sL : sH,
          'watching ' + (nearLow ? sL : sH).toFixed(2) + ' (last ' + tf + ' swing ' + (nearLow ? 'low' : 'high')
            + ') — fires on a wick ' + (nearLow ? 'below + reclaim close' : 'above + rejection close'), null,
          nearLow ? 'long' : 'short');
      } else emit('sweep', 'idle', null, '', 'no levels available (swing high/low not computable)');
    } else emit('sweep', 'idle', null, '', 'not enough bars for a 25-bar swing — no levels available');

    /* 2) order block / breaker — nearest unmitigated zone; armed only when
       it sits within 1.5×ATR (the retest itself triggers inside 0.5×ATR). */
    var ob = D.ob, obZones = [];
    if (ob){
      var oi, oz;
      for (oi = 0; oi < ob.bullish.length; oi++){ oz = ob.bullish[oi]; obZones.push({ dir: 'bullish', top: oz.top, bottom: oz.bottom }); }
      for (oi = 0; oi < ob.bearish.length; oi++){ oz = ob.bearish[oi]; obZones.push({ dir: 'bearish', top: oz.top, bottom: oz.bottom }); }
    }
    if (obZones.length){
      var obNear = null, obDist = Infinity;
      for (oi = 0; oi < obZones.length; oi++){
        oz = obZones[oi];
        var dz = (entry > oz.top) ? (entry - oz.top) : ((entry < oz.bottom) ? (oz.bottom - entry) : 0);
        if (dz < obDist){ obDist = dz; obNear = oz; }
      }
      if (obNear && obDist <= 1.5*a15){
        var obEdge = (entry >= obNear.bottom && entry <= obNear.top)
          ? ((obNear.dir === 'bullish') ? obNear.bottom : obNear.top)
          : ((entry > obNear.top) ? obNear.top : obNear.bottom);
        emit('ob', 'armed', obEdge,
          'watching the unmitigated ' + obNear.dir + ' ' + tf + ' order block ' + obNear.bottom.toFixed(2) + '–'
            + obNear.top.toFixed(2) + ' — fires on a retest (price within 0.5×ATR of the zone)', null,
          obNear.dir === 'bullish' ? 'long' : 'short');
      } else {
        emit('ob', 'idle', null, '', 'no unmitigated ' + tf + ' order block within 1.5×ATR of price');
      }
    } else emit('ob', 'idle', null, '', 'no unmitigated ' + tf + ' order block on the chart — no levels available');

    /* 3) FVG — nearest unfilled gap (age <= 25), 15m first then 1H; armed
       when within 1.5×ATR (the fill triggers AT/IN the gap). */
    var fvgNear = null, fvgDist = Infinity, fvgTf = tf;
    function scanGaps(gaps, label){
      if (!gaps || !gaps.length) return;
      for (var gi = 0; gi < gaps.length; gi++){
        var g = gaps[gi];
        if (!g || g.age > 25) continue;
        var dg = (entry > g.top) ? (entry - g.top) : ((entry < g.bottom) ? (g.bottom - entry) : 0);
        if (dg < fvgDist){ fvgDist = dg; fvgNear = g; fvgTf = label; }
      }
    }
    scanGaps(D.fvg, tf);
    if (fvgDist > 1.5*a15){ fvgNear = null; fvgDist = Infinity; }   /* 15m too far -> try the 1H gap */
    scanGaps(D.fvg1, '1H');
    if (fvgNear && fvgDist <= 1.5*a15){
      var fEdge = (entry >= fvgNear.bottom && entry <= fvgNear.top)
        ? ((fvgNear.dir === 'bullish') ? fvgNear.bottom : fvgNear.top)
        : ((entry > fvgNear.top) ? fvgNear.top : fvgNear.bottom);
      emit('fvg', 'armed', fEdge,
        'watching the unmitigated ' + fvgTf + ' FVG ' + fvgNear.bottom.toFixed(2) + '–' + fvgNear.top.toFixed(2)
          + ' — fires on a retrace into the gap', null,
        fvgNear.dir === 'bullish' ? 'long' : 'short');
    } else emit('fvg', 'idle', null, '', 'no unfilled ' + tf + ' imbalance nearby (within 1.5×ATR)');

    /* 4) session VWAP — always armed when computable: fair value is always
       a live magnet; the trigger is a touch (within 0.75×ATR). */
    var vw = D.vw;
    if (vw && isFinite(vw.value)){
      emit('vwap', 'armed', vw.value,
        'watching session VWAP ' + vw.value.toFixed(2) + ' — fires on a touch (within 0.75×ATR): bounce/rejection at fair value', null);
    } else emit('vwap', 'idle', null, '', 'no levels available (session VWAP not computable)');

    /* 5) EMA ribbon — armed on the 20-EMA only inside a directional stack;
       MIXED/NONE ribbons have no pullback trade to watch. */
    var rb = D.rb;
    if (rb && (rb.mode === 'BULL' || rb.mode === 'BEAR') && isFinite(rb.e20)){
      emit('ribbon', 'armed', rb.e20,
        'watching the 20-EMA ' + rb.e20.toFixed(2) + ' — fires on a pullback into it (within 0.5×ATR) inside a '
          + rb.mode + ' 20/50/200 ribbon', null,
        rb.mode === 'BULL' ? 'long' : 'short');
    } else if (!rb || !isFinite(rb.e20)){
      emit('ribbon', 'idle', null, '', 'no levels available (20-EMA not computable on these bars)');
    } else {
      emit('ribbon', 'idle', null, '', 'ribbon ' + (rb.mode || 'NONE') + ' — no directional 20/50/200 stack to pull back into');
    }

    /* 6) Asian range — the 00:00–08:00 UTC box; fires on London sweep + reclaim
       + displacement/RVOL (forming-layer primary). Honest idle when no box exists
       (e.g. 4h/1d rows). */
    var asian = D.asian;
    if (asian && isFinite(asian.hi) && isFinite(asian.lo)){
      var aNearLow = Math.abs(entry - asian.lo) <= Math.abs(asian.hi - entry);
      emit('asian', 'armed', aNearLow ? asian.lo : asian.hi,
        'armed 00:00–08:00 UTC: box ' + asian.lo.toFixed(2) + '–' + asian.hi.toFixed(2) + ' (' + asian.dayIso
          + (asian.state === 'BUILDING' ? ', still building' : '') + ') — fires on a London sweep + reclaim (displacement + RVOL)', null,
        aNearLow ? 'long' : 'short');
    } else emit('asian', 'idle', null, '', 'no Asian-range box yet (needs >=3 bars inside 00:00–08:00 UTC) — no levels available');

    /* 7) RSI 75/25 divergence — FOLKLORE: shown as idle/info only.
       Does not arm a forming entry (no defended mechanism; double-counts momentum). */
    var rg = D.rg;
    if (rg && isFinite(rg.rsi)){
      emit('rsidiv', 'idle', null, '',
        'FOLKLORE — RSI ' + rg.rsi.toFixed(1) + ' is informational only; not a forming confluence leg');
    } else emit('rsidiv', 'idle', null, '', 'FOLKLORE — RSI unread; excluded from forming confluence');

    /* 8) HVN / volume-node — thin-venue informational only (not a forming lead) */
    if (D.vpOk && isFinite(D.nearestHVN)){
      emit('hvn', 'idle', D.nearestHVN,
        '',
        'THIN VP — HVN ' + D.nearestHVN.toFixed(2) + ' is a target hint only on this venue feed');
    } else if (D.vpOk && D.vprof && isFinite(D.vprof.pocPrice)){
      emit('hvn', 'idle', D.vprof.pocPrice,
        '',
        'THIN VP — session POC ' + D.vprof.pocPrice.toFixed(2) + ' is informational only');
    } else emit('hvn', 'idle', null, '', 'no volume profile yet (needs >=3 bars with range and volume)');

    /* 9) Forming-layer structure watches (Asia 00–08 / PDH-PDL / equal extremes) */
    try{
      var stack = hgGoldFormingStack({
        rows15m: rows, rows4h: __rows(inp.rows4h), macro: inp.macro,
        dxyRows: inp.dxyRows, now: inp.now
      });
      var wi;
      for (wi = 0; wi < (stack.watches || []).length; wi++){
        var ww = stack.watches[wi];
        if (!ww || ww.stratKey === 'asian') continue; /* asian already emitted above */
        out.push({
          stratKey: ww.stratKey, strategy: ww.strategy || ww.stratKey,
          dir: ww.dir || null, state: ww.state === 'armed' ? 'armed' : 'idle',
          level: ww.level, condition: ww.condition || '', reason: ww.reason || null,
          formingLayer: true
        });
      }
    }catch(eFs){}

    return out;
  }catch(e){ return []; }
}

/* Per-direction microstructure vetoes (yield / DOM / OB-CVD). News windows are
   handled at tab conviction level — never veto the whole bundle here. */
function __gsMicroVeto(dir, stratKey, D, opts){
  try{
    opts = opts || {};
    if (dir !== 'long' && dir !== 'short') return null;
    if (opts.us10yCandles){
      var yg = validateYieldCorrelation(opts.us10yCandles, dir);
      if (yg && !yg.valid) return { demote: true, reason: yg.reason };
    } else if (D.scalpEval && D.scalpEval.yieldGuard && !D.scalpEval.yieldGuard.valid){
      var yg2 = D.scalpEval.yieldGuard;
      if ((dir === 'long' && /Do not buy Gold/.test(yg2.reason || ''))
          || (dir === 'short' && /Do not short Gold/.test(yg2.reason || ''))){
        return { demote: true, reason: yg2.reason };
      }
    }
    if (opts.l2OrderBook){
      var dom = validateDomLiquidity(dir, opts.l2OrderBook, opts.domDepth);
      if (dom && !dom.triggerValid) return { reason: dom.reason };
    }
    if (stratKey === 'ob' && D.obRetest && D.obRetest.trigger && D.obRetest.direction === dir){
      var cvd = D.scalpEval && D.scalpEval.obCvdCheck;
      if (cvd && !cvd.triggerValid) return { reason: cvd.reason };
    }
    return null;
  }catch(e){ return null; }
}

/* swing-horizon mirror of __gsMicroVeto for evaluateSwing wiring. */
function __swMicroVeto(dir, stratKey, swingEval, opts){
  try{
    opts = opts || {};
    if (dir !== 'long' && dir !== 'short') return null;
    if (opts.us10yCandles){
      var yg = validateYieldCorrelation(opts.us10yCandles, dir);
      if (yg && !yg.valid) return { reason: yg.reason };
    } else if (swingEval && swingEval.yieldGuard && !swingEval.yieldGuard.valid){
      var yg3 = swingEval.yieldGuard;
      if ((dir === 'long' && /Do not buy Gold/.test(yg3.reason || ''))
          || (dir === 'short' && /Do not short Gold/.test(yg3.reason || ''))){
        return { reason: yg3.reason };
      }
    }
    if (opts.l2OrderBook){
      var dom = validateDomLiquidity(dir, opts.l2OrderBook, opts.domDepth);
      if (dom && !dom.triggerValid) return { reason: dom.reason };
    }
    if (stratKey === 'ob' && swingEval && swingEval.obSetup && swingEval.obSetup.trigger
        && swingEval.obSetup.direction === dir){
      var cvd2 = swingEval.obCvdCheck;
      if (cvd2 && !cvd2.triggerValid) return { reason: cvd2.reason };
    }
    return null;
  }catch(e){ return null; }
}

/* Count how many venues print the same structural conviction id. */
function goldCrossVenueMap(cands){
  var map = {};
  try{
    if (!Array.isArray(cands)) return map;
    var i, c, rec;
    for (i = 0; i < cands.length; i++){
      c = cands[i];
      if (!c || !c.id || c.dropped) continue;
      rec = map[c.id];
      if (!rec) rec = map[c.id] = { venues: 0, names: [] };
      rec.venues++;
      if (c.venue && rec.names.indexOf(c.venue) < 0) rec.names.push(c.venue);
    }
  }catch(e){}
  return map;
}

/* When an ARMED watch item's strategy fired as a qualifying candidate, mark
   it promoted (still not an entry — the candidate card carries the plan). */
function goldWatchPromote(cands, armed){
  try{
    if (!Array.isArray(armed) || !armed.length) return armed || [];
    var fired = {}, i, c, k;
    for (i = 0; i < (cands || []).length; i++){
      c = cands[i];
      if (!c || !c.stratKey || c.dropped || c.demoted || c.vetoed) continue;
      k = c.stratKey + '|' + String(c.dir || '').toLowerCase();
      fired[k] = true;
    }
    return armed.map(function(w){
      if (!w || w.state !== 'armed' || !w.stratKey) return w;
      var wd = w.dir ? String(w.dir).toLowerCase() : null;
      var match = wd ? fired[w.stratKey + '|' + wd] : fired[w.stratKey + '|long'] || fired[w.stratKey + '|short'];
      if (!match) return w;
      var nw = {};
      for (var kk in w){ if (Object.prototype.hasOwnProperty.call(w, kk)) nw[kk] = w[kk]; }
      nw.state = 'promoted';
      nw.promoteNote = 'trigger fired this scan — see the qualifying candidate card above';
      return nw;
    });
  }catch(e){ return armed || []; }
}

/* Inline GOLD / Deep Scan bridge — same tab engines, read-only summary. */
function hgGoldInlineBridge(inp){
  var empty = { scalp: null, swing: null, at: Date.now() };
  try{
    inp = inp || {};
    var out = { scalp: null, swing: null, at: Date.now() };
    var nowMs = __toMs(inp.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var setupsFn = goldScalpSetups;
    var rankFn = goldRankSetups;
    if (typeof setupsFn === 'function'){
      var got = setupsFn(inp);
      var cands = Array.isArray(got) ? got : [];
      var ctx = { now: nowMs, macro: inp.macro || null, goldPro: inp.goldPro || null,
                  crossVenue: goldCrossVenueMap(cands) };
      var rk = rankFn ? rankFn(cands, ctx) : { ranked: cands, best: cands[0] || null };
      out.scalp = {
        count: (rk.ranked || []).length,
        best: rk.best ? { dir: rk.best.dir, strategy: rk.best.strategy, tally: rk.best.tally, grade: rk.best.grade } : null,
        rejected: (got.rejected || []).length + ((rk.rejected || []).length)
      };
    }
    if (typeof W.goldSwingSetups === 'function'){
      try{
        var sw = W.goldSwingSetups(inp);
        if (sw && sw.best){
          out.swing = { count: (sw.ranked || []).length, best: { dir: sw.best.dir, strategy: sw.best.strategy,
            tally: sw.best.tally, grade: sw.best.grade } };
        }
      }catch(eSw){}
    }
    return out;
  }catch(e){ return empty; }
}

/* =========================================================================
   RANKER — goldRankSetups(cands, ctx): transparent, human-readable confluence
   tally per candidate. Pure + total: every ctx leg is optional and degrades
   to a zero-point omission. Tally parts (pts):
     +N    independent agreeing reads (candidate's own ledger)
     +0..3 ICT killzone weight (London/NY overlap 13:00-17:00 GMT = 3, highest)
     -2    high-impact news window (+/-30 min via the hgNewsState-shaped ctx.news)
     +/-2  fundamentals tilt ctx.macro.realRateHint (TAILWIND favors longs,
           HEADWIND favors shorts; DXY/US10Y trends quoted in the label)
     +/-1  positioning ctx.spot.verdict (PAXG basis: longs-crowding fades
           longs / backs shorts; shorts-crowding = squeeze fuel for longs)
     +1    seasonality ctx.season.bias STRONG (Jan-Feb) behind a long
     +1    crypto risk sentiment ctx.fng ({v,c}: extreme fear <=25 backs a
           risk-off gold long; extreme greed >=75 backs a short)
     +0..2 structural R:R bonus (≥2R = +1, ≥2.5R = +2) when c.rr is finite
     +/-N  scorecard expectancy boost via window.hgProfitRankHint (gold lane)
   OFF-SESSION render bar uses STRUCTURAL tally only (agreeing reads +
   killzone weight >= +2); macro/news/positioning shrink the displayed tally
   but never suppress the card.
   Sort: tally desc, then grade, then killzone weight, then agreeing reads
   (stable). -> {ranked:[cand + {tally, tallyParts:[{label,pts}]}], best} —
   {ranked:[], best:null} on any failure.
========================================================================= */
/* isFinite(null) is true and +null is 0, so a CLEARED R:R (set to null by
   hgSyncPlanRr when the levels cannot produce one) would read here as a
   confident 0.0R and be printed into the tally as if it had been measured.
   This reader rejects null/undefined/'' before the numeric test. */
function gdRr(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return (typeof n === 'number' && isFinite(n)) ? n : NaN;
}

/* =========================================================================
   GOLD CONFLUENCE SCORE (hg-v559) — 100-pt core stack, not an indicator pile.
   HTF structure 25 · Location 20 · Momentum 15 · Vol regime 10 ·
   Volume/OF 10 · Macro 10 · Entry trigger 10.
   Tiers: A 85–100 · GOOD 75–84 · WATCH 65–74 · NO TRADE <65.
   COT is weekly sentiment only (lagged) — never a live entry trigger.
========================================================================= */
var HG_GOLD_CONF_A = 85;
var HG_GOLD_CONF_GOOD = 75;
var HG_GOLD_CONF_WATCH = 65;

function hgGoldConfluenceTier(score){
  if (!(isFinite(score))) return 'NO_TRADE';
  if (score >= HG_GOLD_CONF_A) return 'A';
  if (score >= HG_GOLD_CONF_GOOD) return 'GOOD';
  if (score >= HG_GOLD_CONF_WATCH) return 'WATCH';
  return 'NO_TRADE';
}

/**
 * Score one gold candidate against the core confluence stack.
 * ctx may include: rows15m/rows4h/rows1h, macro, news, cot, adx, vwap, vprof, regime.
 */
function hgGoldConfluenceScore(cand, ctx){
  var out = {
    ok: false, score: 0, tier: 'NO_TRADE', alertOk: false, parts: {},
    why: '', tools: [], cotNote: 'COT is weekly CFTC positioning (lagged) — risk filter only, not an entry'
  };
  try{
    cand = cand || {};
    ctx = ctx || {};
    var dir = (cand.dir === 'short') ? 'short' : ((cand.dir === 'long') ? 'long' : null);
    if (!dir){ out.why = 'need long/short direction'; return out; }

    var p = { htf: 0, location: 0, momentum: 0, volRegime: 0, volume: 0, macro: 0, trigger: 0 };
    var tools = [];

    /* --- HTF structure (25) --- */
    var rows4h = __rows(ctx.rows4h);
    var rows1h = __rows(ctx.rows1h);
    var rows = __rows(ctx.rows15m || ctx.rows);
    var mstruct = ctx.mstruct || (rows4h && rows4h.length >= 30 ? goldMarketStructure(rows4h) : null);
    var rb4 = ctx.rb4 || (rows4h && rows4h.length ? goldRibbon(rows4h) : null);
    var trendOk = false;
    if (mstruct && mstruct.trend){
      if ((dir === 'long' && /bull/i.test(mstruct.trend)) || (dir === 'short' && /bear/i.test(mstruct.trend))){
        p.htf += 12; trendOk = true; tools.push('structure ' + mstruct.trend);
      } else if (mstruct.trend === 'neutral'){
        p.htf += 4;
      }
    }
    if (rb4 && rb4.mode){
      var rbBull = rb4.mode === 'BULL' || (rb4.above50 === true && rb4.above200 === true)
        || (isFinite(rb4.e50) && isFinite(rb4.e200) && rb4.e50 > rb4.e200 && rb4.above50);
      var rbBear = rb4.mode === 'BEAR' || (rb4.above50 === false && rb4.above200 === false)
        || (isFinite(rb4.e50) && isFinite(rb4.e200) && rb4.e50 < rb4.e200 && rb4.above50 === false);
      if ((dir === 'long' && rbBull) || (dir === 'short' && rbBear)){
        p.htf += 8; tools.push('EMA50/200 bias');
      } else if (rb4.sellOnly && dir === 'long'){
        p.htf = Math.max(0, p.htf - 4);
      } else if (rb4.mode === 'MIXED' && ((dir === 'long' && rb4.above50) || (dir === 'short' && rb4.above50 === false))){
        p.htf += 4; tools.push('EMA50 bias');
      }
    }
    if (cand.agree >= 2) p.htf += 5;
    else if (cand.agree >= 1) p.htf += 2;
    p.htf = Math.min(25, p.htf);

    /* --- Location (20) — VWAP, S/R, VP, Fib overlap --- */
    var vw = ctx.vwap || (rows ? goldVWAP(rows) : null);
    if (vw && isFinite(vw.vwap) && isFinite(cand.entry)){
      var aboveVw = cand.entry >= vw.vwap;
      if ((dir === 'long' && aboveVw) || (dir === 'short' && !aboveVw)){
        p.location += 7; tools.push('VWAP align');
      } else p.location += 2;
    }
    var key = cand.stratKey || '';
    if (/sweep|liqsweep|nyexh|sweepob|silverb|smcliq|ob|asian|pdraid|eqhi|eqlo|hvn|vwap|fvg/i.test(key)){
      p.location += 7; tools.push('S/R / liquidity location');
    } else p.location += 2;
    if (cand.vpTargets && cand.vpTargets.ok){
      p.location += cand.vpTargets.confirmed ? 6 : 3;
      tools.push('VP targets');
    } else if (ctx.vprof && isFinite(ctx.vprof.pocPrice)){
      p.location += 2;
    }
    p.location = Math.min(20, p.location);

    /* --- Momentum (15) — EMA align, RSI regime, MACD --- */
    var rb = ctx.rb || (rows ? goldRibbon(rows) : null);
    if (rb && rb.mode){
      var mBull = /bull|up|buy/i.test(rb.mode);
      var mBear = /bear|down|sell/i.test(rb.mode);
      if ((dir === 'long' && mBull) || (dir === 'short' && mBear)){
        p.momentum += 6; tools.push('EMA ribbon');
      } else p.momentum += 1;
    }
    var rsiRows = rows || rows1h;
    if (rsiRows && typeof _rsi === 'function'){
      try{
        var rs = _rsi(rsiRows.map(function(r){ return r.c; }), (key === 'stochrsi' || /scalp/i.test(cand.tf || '')) ? 5 : 14);
        var rv = rs && rs.length ? rs[rs.length - 1] : NaN;
        if (isFinite(rv)){
          if ((dir === 'long' && rv >= 50 && rv < 75) || (dir === 'short' && rv <= 50 && rv > 25)){
            p.momentum += 5; tools.push('RSI regime');
          } else if ((dir === 'long' && rv >= 40) || (dir === 'short' && rv <= 60)){
            p.momentum += 2;
          }
        }
      }catch(_r){}
    }
    /* MACD zero-line direction if available via goldScalpEval / ctx */
    if (ctx.macd){
      var md = ctx.macd;
      if ((dir === 'long' && md.hist > 0) || (dir === 'short' && md.hist < 0)){
        p.momentum += 4; tools.push('MACD');
      }
    } else if (cand.agree >= 2){
      p.momentum += 2;
    }
    p.momentum = Math.min(15, p.momentum);

    /* --- Volatility regime (10) — ADX trend vs chop --- */
    var adx = ctx.adx || (rows ? goldADX(rows) : null);
    var adxV = adx && isFinite(adx.adx) ? adx.adx : (adx && isFinite(adx.value) ? adx.value : NaN);
    var mrevKeys = { vwap:1, vwapband:1, adrfade:1, fvg:1, sweep:1, liqsweep:1, nyexh:1, sweepob:1, silverb:1, smcliq:1 };
    var contKeys = { ribbon:1, bosalign:1, openrange:1, asian:1 };
    if (isFinite(adxV)){
      tools.push('ADX ' + adxV.toFixed(0));
      if (adxV >= 20 && contKeys[key]) p.volRegime += 10;
      else if (adxV >= 20 && !mrevKeys[key]) p.volRegime += 8;
      else if (adxV < 15 && mrevKeys[key]) p.volRegime += 10; /* range strategies */
      else if (adxV < 15 && contKeys[key]) p.volRegime += 2; /* trend strat in chop */
      else p.volRegime += 5;
    } else {
      p.volRegime += 5; /* unread — neutral */
    }
    p.volRegime = Math.min(10, p.volRegime);

    /* --- Volume / order flow (10) --- */
    if (cand.sweepScore >= 75 || cand.nyExhScore >= 75) p.volume += 8;
    else if (cand.sweepScore >= 65 || cand.nyExhScore >= 65) p.volume += 5;
    else if (/sweep|liqsweep|nyexh|sweepob|silverb|smcliq|oitrap/i.test(key)) p.volume += 4;
    if (cand.vpTargets && cand.vpTargets.confirmed) p.volume += 2;
    if (ctx.rvol && ctx.rvol >= 1.25) p.volume += 2;
    p.volume = Math.min(10, p.volume);
    if (p.volume > 0) tools.push('volume/participation');

    /* --- Macro (10) — DXY / real yields / news / COT caution --- */
    var macro = ctx.macro || null;
    var newsLock = !!(ctx.newsGate && ctx.newsGate.lock) || !!(ctx.news && ctx.news.caution);
    if (newsLock){
      p.macro = 0; tools.push('news lockout');
    } else {
      p.macro += 4; /* no lockout baseline */
      var hint = macro && macro.realRateHint;
      if (hint === 'TAILWIND' || hint === 'HEADWIND'){
        var favors = (hint === 'TAILWIND') ? 'long' : 'short';
        p.macro += (dir === favors) ? 4 : 0;
        tools.push('real-yield ' + hint.toLowerCase());
      } else {
        p.macro += 2; /* unchecked */
      }
      var cot = ctx.cot || (typeof window !== 'undefined' ? window.__hgGoldCot : null);
      if (cot && cot.crowding){
        if ((cot.crowding === 'SPEC CROWDED LONG' && dir === 'long')
            || (cot.crowding === 'SPEC CROWDED SHORT' && dir === 'short')){
          p.macro = Math.max(0, p.macro - 3); /* weekly caution — not an entry */
          tools.push('COT crowded (caution)');
        } else {
          p.macro += 1;
        }
      }
    }
    p.macro = Math.min(10, p.macro);

    /* --- Entry trigger (10) --- */
    if (/sweep|liqsweep|nyexh|sweepob|silverb|smcliq/i.test(key) && (cand.confirmed || cand.sweepTier === 'alert' || cand.nyExhTier === 'alert' || cand.sweepObTier === 'alert' || cand.silverBTier === 'alert' || isFinite(cand.smcSweptAge)))
      p.trigger += 10;
    else if (/sweep|liqsweep|nyexh|sweepob|silverb|smcliq|ob|fvg|openrange|asian|bosalign/i.test(key))
      p.trigger += 7;
    else if (/ribbon|vwap|stochrsi|hvn/i.test(key))
      p.trigger += 5;
    else p.trigger += 3;
    if (cand.demoted) p.trigger = Math.max(0, p.trigger - 3);
    p.trigger = Math.min(10, p.trigger);

    out.parts = p;
    out.tools = tools;
    out.score = Math.max(0, Math.min(100,
      p.htf + p.location + p.momentum + p.volRegime + p.volume + p.macro + p.trigger));
    out.tier = hgGoldConfluenceTier(out.score);
    out.alertOk = out.score >= HG_GOLD_CONF_GOOD && out.tier !== 'NO_TRADE' && !newsLock;
    out.ok = true;
    out.why = 'CONF ' + out.score + '/' + out.tier
      + ' · HTF ' + p.htf + ' · loc ' + p.location + ' · mom ' + p.momentum
      + ' · vol ' + p.volRegime + ' · flow ' + p.volume + ' · macro ' + p.macro
      + ' · trig ' + p.trigger;
    if (out.alertOk) out.why += ' · ALERT OK';
    else if (out.tier === 'WATCH') out.why += ' · watchlist only';
    else if (out.tier === 'NO_TRADE') out.why += ' · below trade bar';
    return out;
  }catch(e){ out.why = 'confluence score error'; return out; }
}

function hgGoldConfluenceHtml(sc){
  try{
    if (!sc || !sc.ok) return '';
    var h = '<div class="note" data-hg-gold-conf="1" style="margin-top:8px">';
    h += '<b>GOLD CONFLUENCE</b> · ' + (isFinite(sc.score) ? sc.score : '—') + '/100 · '
      + String(sc.tier || '').replace(/_/g, ' ');
    if (sc.alertOk) h += ' · <b>ALERT</b>';
    if (sc.parts){
      h += '<div class="dim" style="margin-top:2px">HTF ' + (sc.parts.htf || 0)
        + ' · loc ' + (sc.parts.location || 0)
        + ' · mom ' + (sc.parts.momentum || 0)
        + ' · vol ' + (sc.parts.volRegime || 0)
        + ' · flow ' + (sc.parts.volume || 0)
        + ' · macro ' + (sc.parts.macro || 0)
        + ' · trig ' + (sc.parts.trigger || 0) + '</div>';
    }
    if (sc.tools && sc.tools.length){
      h += '<div class="dim" style="margin-top:2px">core: '
        + sc.tools.slice(0, 6).map(function(t){ return String(t).replace(/[<>&]/g, ''); }).join(' · ')
        + '</div>';
    }
    h += '<div class="dim" style="margin-top:2px">' + String(sc.cotNote || '').replace(/[<>&]/g, '') + '</div>';
    if (sc.why) h += '<div class="dim" style="margin-top:2px">' + String(sc.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/**
 * Apply confluence score onto a candidate (mutates). Stamps tiers.
 * Does NOT hard-demote — NO_TRADE only blocks alerts (confAlertOk=false).
 * Existing quality-gate demotions remain authoritative for MOST PROBABLE.
 */
function hgGoldApplyConfluence(cand, ctx){
  try{
    if (!cand) return cand;
    var sc = hgGoldConfluenceScore(cand, ctx);
    cand.confScore = sc.score;
    cand.confTier = sc.tier;
    cand.confAlertOk = !!sc.alertOk;
    cand.confluenceScore = sc;
    if (!Array.isArray(cand.stamps)) cand.stamps = [];
    var stamp = 'CONF ' + sc.score + '/' + sc.tier;
    if (cand.stamps.indexOf(stamp) < 0) cand.stamps.push(stamp);
    if (sc.tier === 'NO_TRADE'){
      if (cand.stamps.indexOf('CONF NO TRADE') < 0) cand.stamps.push('CONF NO TRADE');
    } else if (sc.tier === 'WATCH'){
      if (cand.stamps.indexOf('CONF WATCH') < 0) cand.stamps.push('CONF WATCH');
    } else if ((sc.tier === 'A' || sc.tier === 'GOOD') && sc.alertOk){
      if (cand.stamps.indexOf('CONF ALERT') < 0) cand.stamps.push('CONF ALERT');
    }
    return cand;
  }catch(e){ return cand; }
}

function goldRankSetups(cands, ctx){
  var out = { ranked: [], best: null, rejected: [] };
  try{
    if (!Array.isArray(cands) || !cands.length) return out;
    ctx = ctx || {};
    var nowMs = __toMs(ctx.now);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var news = __newsCaution(ctx.news, nowMs);
    var macro = (ctx.macro && typeof ctx.macro === 'object') ? ctx.macro : null;
    var hint = macro ? macro.realRateHint : null;
    var spot = (ctx.spot && typeof ctx.spot === 'object') ? ctx.spot : null;
    var verdict = spot ? spot.verdict : null;
    var basisTxt = (spot && isFinite(spot.basisPct)) ? ((spot.basisPct > 0 ? '+' : '') + Number(spot.basisPct).toFixed(3) + '%') : 'n/a';
    var season = (ctx.season && typeof ctx.season === 'object') ? ctx.season : null;
    var fng = (ctx.fng && typeof ctx.fng === 'object') ? ctx.fng : null;
    var fngV = (fng && isFinite(+fng.v)) ? +fng.v : null;

    var ranked = [], i, k;
    for (i = 0; i < cands.length; i++){
      var c = cands[i];
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
      if (c.dropped){   /* hard quality-gate drop (e.g. min R:R) -> named reason line */
        out.rejected.push({ id: c.id || null, strategy: c.strategy || null, stratKey: c.stratKey || null,
                            dir: c.dir, venue: c.venue || null, sym: c.sym || null,
                            reason: c.reason || 'failed a quality gate' });
        continue;
      }
      var parts = [], tally = 0;
      var agree = isFinite(c.agree) ? c.agree
                : (c.reads ? ((c.dir === 'long') ? c.reads.long : c.reads.short) : 0);
      if (agree > 0){
        parts.push({ label: agree + ' independent agreeing read' + (agree === 1 ? '' : 's'), pts: agree });
        tally += agree;
      }
      var kzw = isFinite(c.killzoneWeight) ? c.killzoneWeight : 0;
      if (kzw > 0){
        var kzName = c.killzone ? String(c.killzone).split(' · ')[0] : 'KILLZONE';
        parts.push({ label: kzName + ' — ICT killzone weight', pts: kzw });
        tally += kzw;
      }
      var sessW = isFinite(c.sessionWeight) ? c.sessionWeight : 0;
      if (isFinite(c.killzoneWeight) && sessW > kzw){
        var extraSess = sessW - kzw;
        var sessName = (c.sessionGate && c.sessionGate.session === 'LONDON_OPEN')
          ? 'London open 08:00 GMT priority'
          : ((c.sessionGate && c.sessionGate.session === 'NY_OVERLAP')
            ? 'NY overlap 12:00–16:00 GMT priority'
            : 'session priority');
        parts.push({ label: sessName, pts: extraSess, leg: 'session' });
        tally += extraSess;
      }
      if (news.caution){
        parts.push({ label: 'high-impact news window ±30 min' + (news.title ? ' — ' + news.title : '') + ' (fade risk)', pts: -2 });
        tally -= 2;
      }
      if (hint === 'TAILWIND' || hint === 'HEADWIND'){
        var favors = (hint === 'TAILWIND') ? 'long' : 'short';
        var mPts = (c.dir === favors) ? 2 : -2;
        var mWhy = [];
        if (macro.dxy && macro.dxy.trend20) mWhy.push('DXY ' + String(macro.dxy.trend20).toLowerCase());
        if (macro.tnxTrend) mWhy.push('US10Y ' + String(macro.tnxTrend).toLowerCase());
        var macroLabel = 'macro ' + hint.toLowerCase();
        if (macro.realRateSource === 'fred-dfii10' && macro.realRateMeasured && macro.realRateMeasured.measured){
          macroLabel = 'FRED DFII10 ' + (macro.realRateMeasured.trend || '').toLowerCase()
            + (macro.realRateMeasured.asOf ? (' (asOf ' + macro.realRateMeasured.asOf + ')') : '');
          if (macro.realRateMeasured.stale) macroLabel += ' STALE';
        } else if (macro.realRateSource !== 'fred-dfii10'){
          macroLabel += ' [fallback hint — not measured]';
        }
        parts.push({ label: macroLabel + (mWhy.length ? ' (' + mWhy.join(', ') + ')' : '')
                       + ' — ' + (mPts > 0 ? 'favors ' + c.dir + 's' : 'works against ' + c.dir + 's'), pts: mPts, leg: 'macro' });
        tally += mPts;
      }
      if (verdict === 'longs-crowding' || verdict === 'shorts-crowding'){
        var pPts, pLab;
        if (verdict === 'longs-crowding'){
          pPts = (c.dir === 'short') ? 1 : -1;
          pLab = 'PAXG basis ' + basisTxt + ' — leveraged longs crowding (fade risk for longs)';
        } else {
          pPts = (c.dir === 'long') ? 1 : -1;
          pLab = 'PAXG basis ' + basisTxt + ' — shorts crowding (squeeze fuel for longs)';
        }
        parts.push({ label: pLab, pts: pPts });
        tally += pPts;
      }
      var fundRate = (ctx.fundingRate !== undefined && ctx.fundingRate !== null)
        ? __normFundingPct(ctx.fundingRate) : NaN;
      if (isFinite(fundRate)){
        var fPts = evaluateFundingRate(fundRate, c.dir);
        if (fPts !== 0){
          var fLab = (fPts > 0)
            ? ('perp funding tailwind — crowd pays you to hold ' + c.dir + 's')
            : ('perp funding headwind — you pay the crowd on ' + c.dir + 's');
          parts.push({ label: fLab + ' (' + fundRate.toFixed(4) + '%/interval)', pts: fPts });
          tally += fPts;
        }
      }
      if (season && season.bias === 'STRONG' && c.dir === 'long'){
        parts.push({ label: 'seasonal tailwind — Jan–Feb is historically gold\'s strongest stretch', pts: 1 });
        tally += 1;
      }
      if (fngV !== null){
        if (fngV <= 25 && c.dir === 'long'){
          parts.push({ label: 'crypto fear & greed ' + fngV + ' — extreme fear, risk-off bid for gold', pts: 1 });
          tally += 1;
        } else       if (fngV >= 75 && c.dir === 'short'){
          parts.push({ label: 'crypto fear & greed ' + fngV + ' — extreme greed, risk-on weighs on gold', pts: 1 });
          tally += 1;
        }
      }
      if (c.pdZone === 'DISCOUNT' && c.dir === 'long'){
        parts.push({ label: 'premium/discount — price in discount zone of the 20-bar range (buy-the-dip bias)', pts: 1 });
        tally += 1;
      } else if (c.pdZone === 'PREMIUM' && c.dir === 'short'){
        parts.push({ label: 'premium/discount — price in premium zone of the 20-bar range (sell-the-rip bias)', pts: 1 });
        tally += 1;
      } else if (c.pdZone === 'PREMIUM' && c.dir === 'long'){
        parts.push({ label: 'premium/discount — long from premium zone (chase risk)', pts: -1 });
        tally -= 1;
      } else if (c.pdZone === 'DISCOUNT' && c.dir === 'short'){
        parts.push({ label: 'premium/discount — short from discount zone (fade risk)', pts: -1 });
        tally -= 1;
      }
      var pro = (ctx.goldPro && typeof ctx.goldPro === 'object') ? ctx.goldPro : null;
      if (pro && (pro.word === 'STRUCTURAL BULL' || pro.word === 'STRUCTURAL BEAR')){
        var favors = (pro.word === 'STRUCTURAL BULL') ? 'long' : 'short';
        var pPts = (c.dir === favors) ? 2 : -2;
        parts.push({ label: 'GOLD PRO ' + pro.word.replace('STRUCTURAL ', '').toLowerCase()
                       + ' — institutional structure/macro alignment', pts: pPts });
        tally += pPts;
      }
      /* GOLD PRO alignment gate — structural bear/bull demotes counter-structure
         plays (never MOST PROBABLE) except sanctioned sweep / exhaustion fades. */
      var proExempt = { sweep: 1, adrfade: 1, wkbreak: 1, macro: 1 };
      if (pro && pro.word === 'STRUCTURAL BULL' && c.dir === 'short'
          && !proExempt[c.stratKey]){
        c.demoted = true;
        if (!Array.isArray(c.stamps)) c.stamps = [];
        if (c.stamps.indexOf('GOLD PRO CONFLICT') < 0) c.stamps.push('GOLD PRO CONFLICT');
        var gnPro = Array.isArray(c.gateNotes) ? c.gateNotes.slice() : [];
        gnPro.push('GOLD PRO structural bull — counter-structure short demoted (sweep / ADR exhaustion fades still lead-eligible)');
        c.gateNotes = gnPro;
        parts.push({ label: 'GOLD PRO structural bull — counter-structure short demoted', pts: 0 });
      }
      if (pro && pro.word === 'STRUCTURAL BEAR' && c.dir === 'long'
          && !proExempt[c.stratKey]){
        c.demoted = true;
        if (!Array.isArray(c.stamps)) c.stamps = [];
        if (c.stamps.indexOf('GOLD PRO CONFLICT') < 0) c.stamps.push('GOLD PRO CONFLICT');
        var gnPro2 = Array.isArray(c.gateNotes) ? c.gateNotes.slice() : [];
        gnPro2.push('GOLD PRO structural bear — counter-structure long demoted (sweep / ADR exhaustion fades still lead-eligible)');
        c.gateNotes = gnPro2;
        parts.push({ label: 'GOLD PRO structural bear — counter-structure long demoted', pts: 0 });
      }
      var cvMap = (ctx.crossVenue && typeof ctx.crossVenue === 'object') ? ctx.crossVenue : null;
      if (cvMap && cvMap[c.id] && cvMap[c.id].venues >= 2){
        var cvN = cvMap[c.id].venues;
        parts.push({ label: 'cross-venue confirmation — ' + cvN + ' feed' + (cvN === 1 ? '' : 's')
                       + ' printing the same structure (' + (cvMap[c.id].names || []).join(' · ') + ')', pts: 2 });
        tally += 2;
      }
      var rrVal = isFinite(gdRr(c.rr)) ? gdRr(c.rr) : gdRr(c.rr1);
      if (isFinite(rrVal) && rrVal >= 2){
        var rrPts = rrVal >= 2.5 ? 2 : 1;
        parts.push({ label: 'structural R:R ' + rrVal.toFixed(1) + 'R — reward/risk geometry', pts: rrPts });
        tally += rrPts;
      }
      try{
        var gfn = (typeof window !== 'undefined' && window.hgProfitRankHint) ? window.hgProfitRankHint : null;
        if (gfn){
          var gh = gfn({ sym: c.sym || 'XAUUSD', dir: c.dir, tier: c.grade, lane: 'gold', rr1: rrVal });
          if (gh && gh.enough && isFinite(gh.boost) && gh.boost !== 0){
            var gPts = Math.max(-3, Math.min(3, Math.round(gh.boost / 8)));
            if (gPts !== 0){
              parts.push({ label: 'scorecard expectancy ' + (gh.expectancy > 0 ? '+' : '') + gh.expectancy.toFixed(2) + 'R/trade (gold ledger)', pts: gPts });
              tally += gPts;
            }
          }
        }
      }catch(e){}
      try{
        var cotCtx = (typeof window !== 'undefined') ? window.__hgGoldCot : null;
        if (cotCtx && cotCtx.crowding === 'SPEC CROWDED LONG' && c.dir === 'long'){
          parts.push({ label: 'COT spec crowded long — weekly positioning caution (informational)', pts: -1 });
          tally -= 1;
        } else if (cotCtx && cotCtx.crowding === 'SPEC CROWDED SHORT' && c.dir === 'short'){
          parts.push({ label: 'COT spec crowded short — weekly positioning caution (informational)', pts: -1 });
          tally -= 1;
        }
      }catch(eCot){}
      /* (1) OFF-SESSION tally bar: demoted off-session candidates must clear
         +2 on STRUCTURAL confluence (agreeing reads + killzone weight only).
         Macro/news/positioning penalties shrink the displayed tally and can
         never lead (demoted) but must not suppress the card entirely — users
         still need to see forming off-hours structure. */
      var structTally = agree + kzw;
      if (c.demoted && c.offSession && structTally < GS_OFFSESSION_BAR){
        out.rejected.push({ id: c.id || null, strategy: c.strategy || null, stratKey: c.stratKey || null,
                            dir: c.dir, venue: c.venue || null, sym: c.sym || null,
                            reason: 'OFF-SESSION — outside every ICT killzone; structural confluence '
                                    + (structTally > 0 ? '+' : '') + structTally + ' below the raised bar (+'
                                    + GS_OFFSESSION_BAR + ')' });
        continue;
      }
      /* quality-gate demotions are transparent on the card (0-pt chips) */
      if (c.demoted && Array.isArray(c.stamps)){
        for (var st = 0; st < c.stamps.length; st++)
          parts.push({ label: c.stamps[st] + ' — quality-gate demotion, can never lead', pts: 0 });
      }
      var rc = {};
      for (k in c){ if (Object.prototype.hasOwnProperty.call(c, k)) rc[k] = c[k]; }
      rc.tally = tally;
      rc.tallyParts = parts;
      try{
        var gradeFn = (typeof window !== 'undefined' && window.hgGoldGradeFromScore) ? window.hgGoldGradeFromScore : null;
        if (gradeFn){
          rc.grade = gradeFn(tally, !!(news.caution || c.newsCaution));
        } else {
          rc.grade = (tally >= 8) ? 'A' : ((tally >= 5) ? 'B' : 'C');
          if ((news.caution || c.newsCaution) && rc.grade === 'A') rc.grade = 'B';
          else if ((news.caution || c.newsCaution) && rc.grade === 'B') rc.grade = 'C';
        }
      }catch(eGr){}
      try{
        if (typeof window !== 'undefined' && typeof window.hgSetupSolidityApply === 'function'){
          window.hgSetupSolidityApply(rc, { asset: 'gold', tally: tally, grade: rc.grade });
        }
      }catch(eSol){}
      try{
        hgGoldApplyConfluence(rc, {
          rows15m: ctx.rows15m || ctx.rows, rows4h: ctx.rows4h, rows1h: ctx.rows1h,
          macro: macro, news: news, newsGate: ctx.newsGate,
          cot: ctx.cot || (typeof window !== 'undefined' ? window.__hgGoldCot : null),
          vwap: ctx.vwap, vprof: ctx.vprof, adx: ctx.adx, rb: ctx.rb, rb4: ctx.rb4,
          mstruct: ctx.mstruct, rvol: ctx.rvol, macd: ctx.macd
        });
        if (rc.confluenceScore && rc.confluenceScore.ok){
          parts.push({
            label: 'core confluence ' + rc.confScore + '/' + rc.confTier
              + (rc.confAlertOk ? ' · alert ok' : ''),
            pts: 0, leg: 'confluence'
          });
          rc.tallyParts = parts;
        }
      }catch(eConf){}
      try{
        if (!ctx.__p4pd && typeof hgGoldPart4PremiumDiscount === 'function'){
          ctx.__p4pd = hgGoldPart4PremiumDiscount(ctx.rows15m || ctx.rows || ctx.rows4h);
        }
        if (ctx.__p4pd) hgGoldPart4ApplyDiscountFilter(rc, ctx.__p4pd);
      }catch(eP4f){}
      try{
        if (!ctx.__p5eng && typeof hgGoldPart5Engine === 'function'){
          ctx.__p5eng = hgGoldPart5Engine(ctx.rows15m || ctx.rows || ctx.rows4h, {
            newsGate: ctx.newsGate || null,
            physical: ctx.physical || null,
            now: ctx.now || Date.now()
          });
        }
        if (ctx.__p5eng){
          if (ctx.__p5eng.ker) hgGoldPart5ApplyRegimeFilter(rc, ctx.__p5eng.ker);
          if (ctx.__p5eng.bias) hgGoldPart5ApplyWeeklyBiasFilter(rc, ctx.__p5eng.bias);
        }
      }catch(eP5f){}
      ranked.push(rc);
    }
    var gOrd = { A: 0, B: 1, C: 2 };
    ranked.sort(function(x, y){
      var dx = x.demoted ? 1 : 0, dy = y.demoted ? 1 : 0;
      if (dx !== dy) return dx - dy;                 /* demoted can never lead */
      if (y.tally !== x.tally) return y.tally - x.tally;
      var gx = (gOrd[x.grade] === undefined) ? 9 : gOrd[x.grade];
      var gy = (gOrd[y.grade] === undefined) ? 9 : gOrd[y.grade];
      if (gx !== gy) return gx - gy;
      var sx = isFinite(x.solidityScore) ? x.solidityScore : 0;
      var sy = isFinite(y.solidityScore) ? y.solidityScore : 0;
      if (sy !== sx) return sy - sx;
      var cx = isFinite(x.confScore) ? x.confScore : 0;
      var cy = isFinite(y.confScore) ? y.confScore : 0;
      if (cy !== cx) return cy - cx;
      var kx = isFinite(x.killzoneWeight) ? x.killzoneWeight : 0;
      var ky = isFinite(y.killzoneWeight) ? y.killzoneWeight : 0;
      if (ky !== kx) return ky - kx;
      var ax = isFinite(x.agree) ? x.agree : 0;
      var ay = isFinite(y.agree) ? y.agree : 0;
      if (ay !== ax) return ay - ax;
      var rrx = isFinite(gdRr(x.rr)) ? gdRr(x.rr) : (isFinite(gdRr(x.rr1)) ? gdRr(x.rr1) : 0);
      var rry = isFinite(gdRr(y.rr)) ? gdRr(y.rr) : (isFinite(gdRr(y.rr1)) ? gdRr(y.rr1) : 0);
      return rry - rrx;
    });
    out.ranked = ranked;
    out.best = null;
    for (i = 0; i < ranked.length; i++){   /* MOST PROBABLE = best non-demoted, solid first */
      if (!ranked[i].demoted && ranked[i].solidityBookOk !== false){ out.best = ranked[i]; break; }
    }
    if (!out.best){
      for (i = 0; i < ranked.length; i++){
        if (!ranked[i].demoted){ out.best = ranked[i]; break; }
      }
    }
    return out;
  }catch(e){ return { ranked: [], best: null }; }
}

/* =========================================================================
   v54 GOLD MASTERCLASS — new detectors for choppy-market precision
   ========================================================================= */

/* 15) VWAP with Standard-Deviation Bands (1σ / 2σ / 3σ) */
function goldVWAPBands(rows, anchorIndex){
  try{
    rows = __rows(rows);
    if (!rows) return null;
    var n = rows.length;
    var a = Math.floor(anchorIndex);
    if (!isFinite(a) || a < 0) a = 0;
    if (a >= n) return null;
    var sumWV = 0, sumV = 0, sumTP = 0, cnt = 0, i, r, tp, v;
    for (i = a; i < n; i++){
      r = rows[i]; tp = (r.h + r.l + r.c)/3;
      if (!isFinite(tp)) continue;
      v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      sumWV += tp*v; sumV += v; sumTP += tp; cnt++;
    }
    if (!cnt) return null;
    var val = sumV > 0 ? sumWV/sumV : sumTP/cnt;
    var varSum = 0;
    for (i = a; i < n; i++){
      r = rows[i]; tp = (r.h + r.l + r.c)/3;
      if (!isFinite(tp)) continue;
      v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      varSum += (sumV > 0 ? v : 1) * (tp - val) * (tp - val);
    }
    var sd = Math.sqrt(varSum/(sumV > 0 ? sumV : cnt));
    var c = rows[n-1].c;
    var pos = (sd > 0 && Math.abs(c - val) <= 0.25*sd) ? 'AT' : (c > val ? 'ABOVE' : (c < val ? 'BELOW' : 'AT'));
    var d = Math.abs(c - val), band = 'INSIDE';
    if (sd > 0){
      if (d >= 3*sd) band = 'AT_3σ';
      else if (d >= 2*sd) band = 'AT_2σ';
      else if (d >= 1*sd) band = 'AT_1σ';
    }
    return { value: val, upper1: val + sd, upper2: val + 2*sd, upper3: val + 3*sd,
             lower1: val - sd, lower2: val - 2*sd, lower3: val - 3*sd,
             stdev: sd, pos: pos, band: band, distSig: sd > 0 ? d/sd : NaN };
  }catch(e){ return null; }
}

/* 16) BOS / CHoCH */
function goldBOS(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return null;
    var n = rows.length;
    var sH = -Infinity, sL = Infinity;
    for (var i = n - 21; i < n - 1; i++){
      if (i < 0) continue;
      if (rows[i].h > sH) sH = rows[i].h;
      if (rows[i].l < sL) sL = rows[i].l;
    }
    if (!isFinite(sH) || !isFinite(sL)) return null;
    var last = rows[n-1], pre = rows[n-2];
    if (!last || !pre) return null;
    var aArr = _atr(rows, 14);
    var atr = __last(aArr);
    var out = { bos: null, choch: null, lastSwingHigh: sH, lastSwingLow: sL, bosAge: null, chochAge: null, strength: null };
    if (last.c > sH && pre.c <= sH){
      out.bos = 'bullish'; out.bosAge = 0;
      out.strength = (last.c - sH >= 0.5*atr) ? 'STRONG' : 'WEAK';
    } else if (last.c < sL && pre.c >= sL){
      out.bos = 'bearish'; out.bosAge = 0;
      out.strength = (sL - last.c >= 0.5*atr) ? 'STRONG' : 'WEAK';
    }
    if (!out.bos && last.c < sH && pre.c >= sH && pre.h >= sH){
      out.choch = 'bearish'; out.chochAge = 0;
      out.strength = (sH - last.c >= 0.3*atr) ? 'STRONG' : 'WEAK';
    } else if (!out.bos && last.c > sL && pre.c <= sL && pre.l <= sL){
      out.choch = 'bullish'; out.chochAge = 0;
      out.strength = (last.c - sL >= 0.3*atr) ? 'STRONG' : 'WEAK';
    }
    return out;
  }catch(e){ return null; }
}

/* 17) Premium / Discount Zones */
function goldPremiumDiscount(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 20) return null;
    var n = rows.length, hh = -Infinity, ll = Infinity, i;
    for (i = Math.max(0, n - 20); i < n; i++){
      if (rows[i].h > hh) hh = rows[i].h;
      if (rows[i].l < ll) ll = rows[i].l;
    }
    if (!isFinite(hh) || !isFinite(ll) || hh <= ll) return null;
    var c = rows[n-1].c, r = hh - ll;
    var pct = (c - ll)/r;
    var zone = (pct >= 0.75) ? 'PREMIUM' : ((pct <= 0.25) ? 'DISCOUNT' : 'NEUTRAL');
    var adxCtx = null;
    var adxR = goldADX(rows);
    if (adxR && isFinite(adxR.adx)) adxCtx = adxR.adx >= 25 ? 'TRENDING' : 'CHOP';
    return { zone: zone, rangeHi: hh, rangeLo: ll, range: r, pct: pct, adxContext: adxCtx };
  }catch(e){ return null; }
}

/* 18) Average Daily Range with Exhaustion Detection */
function goldADR(rows, lookback){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 50) return null;
    lookback = lookback || 14;
    var n = rows.length, c = rows[n-1], todayR = c.h - c.l;
    var days = {}, i, t, ds, key;
    for (i = 0; i < n; i++){
      t = rows[i].t; if (!isFinite(t)) continue;
      ds = Math.floor(t/86400)*86400;
      key = String(ds);
      if (!days[key]) days[key] = { hi: rows[i].h, lo: rows[i].l };
      else { if (rows[i].h > days[key].hi) days[key].hi = rows[i].h; if (rows[i].l < days[key].lo) days[key].lo = rows[i].l; }
    }
    var ranges = [];
    var keys = Object.keys(days).map(Number).sort(function(a,b){ return a-b; });
    for (i = 0; i < keys.length; i++){
      var d = days[String(keys[i])];
      if (d.hi > d.lo) ranges.push(d.hi - d.lo);
    }
    if (ranges.length < 3) return null;
    var use = ranges.slice(-lookback);
    var sum = 0; for (i = 0; i < use.length; i++) sum += use[i];
    var adr = sum/use.length;
    var pct = adr > 0 ? todayR/adr : NaN;
    var ex = null, bias = null;
    if (isFinite(pct)){
      if (pct >= 0.85){ ex = 'YES'; bias = (c.c > c.o) ? 'short' : 'long'; }
      else if (pct >= 0.60){ ex = 'BUILDING'; bias = (c.c > c.o) ? 'long' : 'short'; }
      else { ex = 'NO'; bias = (c.c > c.o) ? 'long' : 'short'; }
    }
    return { adr: adr, todayRange: todayR, pctOfADR: pct, exhausted: ex, bias: bias };
  }catch(e){ return null; }
}

/* ======================= Session & Volatility Module =======================
   Session killzone weights, Asian-range tracker (index lookback), and daily ADR
   exhaustion (≥80% consumed). Never throws; accepts {t,o,h,l,c,v} rows. */

function getMarketSession(timestampGMT){
  var off = { isAsianRange: false, isLondonOpen: false, isNYOverlap: false, weight: 0,
              hourGMT: NaN, timeDecimal: NaN };
  try{
    var ms = __toMs(timestampGMT);
    if (!isFinite(ms)) return off;
    var dt = new Date(ms);
    var hour = dt.getUTCHours();
    var min = dt.getUTCMinutes();
    var timeDecimal = hour + (min / 60);
    var session = {
      isAsianRange: timeDecimal >= 0 && timeDecimal < 7,
      isLondonOpen: timeDecimal >= 7 && timeDecimal <= 10,
      isNYOverlap: timeDecimal >= 13 && timeDecimal <= 17,
      weight: 0,
      hourGMT: hour,
      timeDecimal: timeDecimal
    };
    if (session.isNYOverlap) session.weight = 3;
    else if (session.isLondonOpen) session.weight = 2;
    else if (session.isAsianRange) session.weight = 0;
    return session;
  }catch(e){ return off; }
}

/* Walk back from `currentIndex` (default last) up to 50 bars for today's
   00:00–08:00 UTC high/low. -> {asianHigh, asianLow, valid, hi, lo}. */
function calculateAsianRange(candles, currentIndex){
  var invalid = { asianHigh: NaN, asianLow: NaN, valid: false, hi: NaN, lo: NaN };
  try{
    candles = __rows(candles);
    if (!candles || !candles.length) return invalid;
    if (currentIndex === undefined || currentIndex === null) currentIndex = candles.length - 1;
    currentIndex = Math.floor(currentIndex);
    if (currentIndex < 0 || currentIndex >= candles.length) return invalid;
    var asianHigh = -Infinity, asianLow = Infinity, inRange = false, i;
    var start = Math.max(0, currentIndex - 50);
    for (i = currentIndex; i >= start; i--){
      var r = candles[i];
      if (!r || !isFinite(r.t)) continue;
      var hour = new Date(__toMs(r.t)).getUTCHours();
      if (hour >= 0 && hour < 8){
        inRange = true;
        if (isFinite(r.h) && r.h > asianHigh) asianHigh = r.h;
        if (isFinite(r.l) && r.l < asianLow) asianLow = r.l;
      } else if (inRange) break;
    }
    if (!inRange || !(asianHigh > asianLow) || !isFinite(asianHigh)) return invalid;
    return { asianHigh: asianHigh, asianLow: asianLow, valid: true,
             hi: asianHigh, lo: asianLow };
  }catch(e){ return invalid; }
}

/* Daily ADR exhaustion on explicit daily bars. >=80% of lookback ADR consumed
   -> isExhausted. -> {adr, currentRange, percentageConsumed, isExhausted, ...}. */
function calculateADRExhaustion(dailyCandles, currentDailyCandle, lookback){
  var no = { exhausted: false, isExhausted: false, percentage: 0,
             percentageConsumed: 0, adr: NaN, currentRange: NaN };
  try{
    dailyCandles = __rows(dailyCandles);
    lookback = lookback || 14;
    if (!dailyCandles || dailyCandles.length < lookback) return no;
    if (!currentDailyCandle) currentDailyCandle = dailyCandles[dailyCandles.length - 1];
    if (!currentDailyCandle || !isFinite(currentDailyCandle.h) || !isFinite(currentDailyCandle.l)) return no;
    var sumRange = 0, i;
    var start = dailyCandles.length - lookback;
    for (i = start; i < dailyCandles.length; i++){
      var r = dailyCandles[i];
      if (!r || !isFinite(r.h) || !isFinite(r.l)) continue;
      sumRange += (r.h - r.l);
    }
    var adr = sumRange / lookback;
    var currentRange = currentDailyCandle.h - currentDailyCandle.l;
    if (!isFinite(adr) || !(adr > 0) || !isFinite(currentRange)) return no;
    var pct = currentRange / adr;
    return {
      adr: adr,
      currentRange: currentRange,
      percentageConsumed: pct,
      percentage: pct,
      isExhausted: pct >= 0.80,
      exhausted: pct >= 0.80
    };
  }catch(e){ return no; }
}

var goldMarketSession = getMarketSession;
var goldAsianRangeAt = calculateAsianRange;
var goldADRExhaustion = calculateADRExhaustion;

/* Intraday DXY open/close hint for gold positioning. Weak dollar (close < open)
   -> TAILWIND for gold longs; strong dollar -> HEADWIND. Never throws. */
function calculateMacroHint(dxyCandles, currentDxy){
  try{
    var candles = __rows(dxyCandles);
    if (!candles || candles.length < 2) return 'NEUTRAL';
    var cur = currentDxy;
    if (!cur) cur = candles[candles.length - 1];
    if (!cur) return 'NEUTRAL';
    var o = isFinite(cur.o) ? cur.o : cur.open;
    var c = isFinite(cur.c) ? cur.c : cur.close;
    if (!isFinite(o) || !isFinite(c)) return 'NEUTRAL';
    if (c < o) return 'TAILWIND';
    if (c > o) return 'HEADWIND';
    return 'NEUTRAL';
  }catch(e){ return 'NEUTRAL'; }
}

var goldCalculateMacroHint = calculateMacroHint;

/* PAXG / spot XAU basis — premium/discount vs ±0.15% band. Never throws. */
function calculateGoldSpotBasis(paxgPrice, spotXauPrice){
  var neutral = { basisState: 'NEUTRAL', basisTally: 0, basisSpread: NaN, basisPercent: NaN };
  try{
    var paxg = +paxgPrice, spot = +spotXauPrice;
    if (!isFinite(paxg) || !(paxg > 0) || !isFinite(spot) || !(spot > 0)) return neutral;
    var basisSpread = paxg - spot;
    var basisPercent = (basisSpread / spot) * 100;
    var basisState = 'PARITY', basisTally = 0;
    if (basisPercent > 0.15){
      basisState = 'PREMIUM_BULLISH';
      basisTally = 1;
    } else if (basisPercent < -0.15){
      basisState = 'DISCOUNT_BEARISH';
      basisTally = -1;
    }
    return {
      basisSpread: basisSpread,
      basisPercent: basisPercent,
      basisState: basisState,
      basisTally: basisTally
    };
  }catch(e){ return neutral; }
}

/* Kaufman Efficiency Ratio on candle rows — {er, isChop}. Never throws. */
function calculateKaufmanER(candles, lookback){
  var trending = { er: 1.0, isChop: false };
  try{
    lookback = lookback || 20;
    var rows = __rows(candles);
    if (!rows || rows.length < lookback + 1) return trending;
    var closes = __closes(rows);
    var er = __kaufmanER(closes, lookback);
    if (!isFinite(er)) return trending;
    return { er: er, isChop: er < 0.25 };
  }catch(e){ return trending; }
}

/** High-impact news window guard (±windowMinutes). Never throws. */
function NewsWindowGuard(){
  this.scheduledEvents = [];
}
NewsWindowGuard.prototype.setUpcomingEvents = function(eventsList){
  try{
    this.scheduledEvents = [];
    if (!Array.isArray(eventsList)) return;
    var i, e, imp;
    for (i = 0; i < eventsList.length; i++){
      e = eventsList[i];
      if (!e) continue;
      imp = String(e.impact || '').toUpperCase();
      if (imp === 'HIGH') this.scheduledEvents.push(e);
    }
  }catch(err){ this.scheduledEvents = []; }
};
NewsWindowGuard.prototype.checkNewsWindow = function(currentTimestampGMT, windowMinutes){
  try{
    windowMinutes = windowMinutes || 30;
    var windowMs = windowMinutes * 60 * 1000;
    var nowMs = __toMs(currentTimestampGMT);
    if (!isFinite(nowMs)) nowMs = Date.now();
    var i, event, ts, timeDiff;
    for (i = 0; i < this.scheduledEvents.length; i++){
      event = this.scheduledEvents[i];
      ts = (event.timestamp !== undefined && event.timestamp !== null) ? event.timestamp : event.t;
      ts = __toMs(ts);
      if (!isFinite(ts)) continue;
      timeDiff = Math.abs(nowMs - ts);
      if (timeDiff <= windowMs){
        return {
          inNewsWindow: true,
          eventName: event.title || event.name || 'High-impact event',
          minutesToEvent: Math.round((ts - nowMs) / 60000)
        };
      }
    }
    return { inNewsWindow: false };
  }catch(e){ return { inNewsWindow: false }; }
};

/* Risk-based position sizing in fine gold ounces / contract units. Never throws. */
function calculatePositionSize(accountBalanceUSD, riskPercent, entryPrice, stopLossPrice){
  try{
    var bal = +accountBalanceUSD, riskPct = +riskPercent;
    var entry = +entryPrice, stop = +stopLossPrice;
    if (!isFinite(bal) || !(bal > 0) || !isFinite(riskPct) || !(riskPct > 0)
        || !isFinite(entry) || !(entry > 0) || !isFinite(stop)){
      return { error: 'Invalid inputs' };
    }
    var riskAmountUSD = bal * (riskPct / 100);
    var priceRiskPerUnit = Math.abs(entry - stop);
    if (!(priceRiskPerUnit > 0)) return { error: 'Invalid SL distance' };
    var rawPositionSize = riskAmountUSD / priceRiskPerUnit;
    var notionalValue = rawPositionSize * entry;
    return {
      riskAmountUSD: riskAmountUSD,
      stopDistanceUSD: priceRiskPerUnit,
      positionSizeUnits: Number(rawPositionSize.toFixed(3)),
      notionalValueUSD: Number(notionalValue.toFixed(2))
    };
  }catch(e){ return { error: 'Invalid inputs' }; }
}

function goldAttachPositionSize(setup, accountBalanceUSD, riskPercent){
  try{
    if (!setup || typeof setup !== 'object') return setup;
    var entry = isFinite(setup.entry) ? setup.entry
      : (setup.levels && isFinite(setup.levels.entry) ? setup.levels.entry : NaN);
    var stop = isFinite(setup.stop) ? setup.stop
      : (setup.levels && isFinite(setup.levels.stopLoss) ? setup.levels.stopLoss : NaN);
    var pos = calculatePositionSize(accountBalanceUSD, riskPercent, entry, stop);
    if (pos && !pos.error) setup.positionSize = pos;
    return setup;
  }catch(e){ return setup; }
}

var EXTREME_FUNDING_PCT = 0.03; /* percent units per interval; >0.03% = extreme imbalance */

/* Normalize funding input: Hardgate binanceFunding uses percent units (0.01 = 0.01%).
   Raw decimal rates (|r| < 0.001) are scaled to percent. Never throws. */
function __normFundingPct(rate){
  var r = +rate;
  if (!isFinite(r)) return NaN;
  if (Math.abs(r) > 0 && Math.abs(r) < 0.001) r = r * 100;
  return r;
}

/** Perp funding tally for multi-day swing holds on PAXG/XAUT. -> -1 | 0 | +1 */
function evaluateFundingRate(currentFundingRate, positionDirection){
  try{
    var rate = __normFundingPct(currentFundingRate);
    if (!isFinite(rate)) return 0;
    var dir = String(positionDirection || '').toLowerCase();
    if (dir === 'long'){
      if (rate > EXTREME_FUNDING_PCT) return -1;
      if (rate < -EXTREME_FUNDING_PCT) return 1;
    } else if (dir === 'short'){
      if (rate < -EXTREME_FUNDING_PCT) return -1;
      if (rate > EXTREME_FUNDING_PCT) return 1;
    }
    return 0;
  }catch(e){ return 0; }
}

/** Live WebSocket trade buffer — rolling CVD for sweep validation. Never throws. */
function TickBuffer(){
  this.ticks = [];
  this.buyVolume = 0;
  this.sellVolume = 0;
}
TickBuffer.prototype.onTrade = function(price, size, isBuyerMaker){
  try{
    var sz = +size;
    if (!isFinite(sz) || !(sz > 0)) return;
    this.ticks.push({ price: price, size: sz, isBuyerMaker: !!isBuyerMaker, time: Date.now() });
    if (isBuyerMaker) this.sellVolume += sz;
    else this.buyVolume += sz;
    this.cleanOldTicks(15 * 60 * 1000);
  }catch(e){ /* never throw */ }
};
TickBuffer.prototype.cleanOldTicks = function(maxAgeMs){
  try{
    if (!isFinite(maxAgeMs) || maxAgeMs <= 0) return;
    var cutoff = Date.now() - maxAgeMs, i, tick;
    while (this.ticks.length && this.ticks[0].time < cutoff){
      tick = this.ticks.shift();
      if (!tick) continue;
      if (tick.isBuyerMaker) this.sellVolume -= tick.size;
      else this.buyVolume -= tick.size;
    }
    if (this.buyVolume < 0) this.buyVolume = 0;
    if (this.sellVolume < 0) this.sellVolume = 0;
  }catch(e){ /* never throw */ }
};
TickBuffer.prototype.getCVD = function(){
  try{ return this.buyVolume - this.sellVolume; }catch(e){ return 0; }
};
TickBuffer.prototype.reset = function(){
  this.ticks = [];
  this.buyVolume = 0;
  this.sellVolume = 0;
};

/** Exchange partial-fill handler for limit entries. Never throws. */
function handleOrderUpdate(activeSetup, exchangeOrderStatus){
  try{
    if (!activeSetup || !exchangeOrderStatus) return null;
    var st = String(exchangeOrderStatus.status || '').toUpperCase();
    var filled = exchangeOrderStatus.filledSize;
    if (st === 'FILLED'){
      activeSetup.executionState = 'FULL_RISK_ON';
      activeSetup.filledUnits = filled;
      if (isFinite(exchangeOrderStatus.barIndex)){
        activeSetup.executionBarIndex = exchangeOrderStatus.barIndex;
      }
      return { action: 'FILLED', setup: activeSetup };
    }
    if (st === 'PARTIALLY_FILLED' || st === 'PARTIAL'){
      activeSetup.executionState = 'PARTIAL_RISK_ON';
      activeSetup.filledUnits = filled;
      if (isFinite(exchangeOrderStatus.barIndex)){
        activeSetup.executionBarIndex = exchangeOrderStatus.barIndex;
      }
      var levels = activeSetup.levels || {};
      var entry = isFinite(levels.entryPrice) ? levels.entryPrice
        : (isFinite(levels.entry) ? levels.entry : (isFinite(activeSetup.entry) ? activeSetup.entry : NaN));
      var stop = isFinite(levels.stopLoss) ? levels.stopLoss
        : (isFinite(activeSetup.stop) ? activeSetup.stop : NaN);
      var currentPrice = +exchangeOrderStatus.lastPrice;
      var riskDistance = Math.abs(entry - stop);
      var distanceMoved = Math.abs(currentPrice - entry);
      if (isFinite(riskDistance) && riskDistance > 0 && isFinite(distanceMoved)
          && distanceMoved > riskDistance * 0.5){
        return {
          action: 'CANCEL_REMAINDER',
          setup: activeSetup,
          reason: 'Price escaped zone — cancel remainder of partially filled limit order'
        };
      }
      return { action: 'PARTIAL', setup: activeSetup };
    }
    return null;
  }catch(e){ return null; }
}

/* ================= gold–silver SMT · yield guard · CVD/OB ===================
   Logical modules: gold-silver-smt.js · yield-guard.js · CVD divergence. */

function detectSMTDivergence(xauCandles, xagCandles, index, lookback){
  var no = { smtActive: false };
  try{
    lookback = lookback || 15;
    var xau = __rows(xauCandles), xag = __rows(xagCandles);
    if (!xau || !xag || xau.length < 2 || xag.length < 2) return no;
    if (index === undefined || index === null){
      index = Math.min(xau.length, xag.length) - 1;
    }
    index = Math.floor(index);
    if (index < 1 || index >= xau.length || index >= xag.length) return no;
    var start = Math.max(0, index - lookback);
    if (start >= index) return no;
    var xauCur = xau[index], xagCur = xag[index];
    if (!xauCur || !xagCur || !isFinite(xauCur.h) || !isFinite(xagCur.h)) return no;
    var xauPriorHigh = -Infinity, xagPriorHigh = -Infinity;
    var xauPriorLow = Infinity, xagPriorLow = Infinity;
    var i;
    for (i = start; i < index; i++){
      if (xau[i] && isFinite(xau[i].h)) xauPriorHigh = Math.max(xauPriorHigh, xau[i].h);
      if (xag[i] && isFinite(xag[i].h)) xagPriorHigh = Math.max(xagPriorHigh, xag[i].h);
      if (xau[i] && isFinite(xau[i].l)) xauPriorLow = Math.min(xauPriorLow, xau[i].l);
      if (xag[i] && isFinite(xag[i].l)) xagPriorLow = Math.min(xagPriorLow, xag[i].l);
    }
    if (!isFinite(xauPriorHigh) || !isFinite(xagPriorHigh)
        || !isFinite(xauPriorLow) || !isFinite(xagPriorLow)) return no;
    if (xauCur.h > xauPriorHigh && xagCur.h <= xagPriorHigh){
      return { smtActive: true, type: 'BEARISH_SMT', signal: 'SHORT_GOLD', direction: 'short' };
    }
    if (xauCur.l < xauPriorLow && xagCur.l >= xagPriorLow){
      return { smtActive: true, type: 'BULLISH_SMT', signal: 'LONG_GOLD', direction: 'long' };
    }
    return no;
  }catch(e){ return no; }
}

function validateYieldCorrelation(us10yCandles, goldSetupDirection){
  var ok = { valid: true };
  try{
    var rows = __rows(us10yCandles);
    if (!rows || rows.length < 5) return ok;
    var cur = rows[rows.length - 1].c;
    var prior = rows[rows.length - 5].c;
    if (!isFinite(cur) || !isFinite(prior)) return ok;
    var dir = String(goldSetupDirection || '').toLowerCase();
    if (dir === 'long' && cur > prior){
      return { valid: false, reason: 'MACRO VETO: US10Y Yields are spiking. Do not buy Gold.' };
    }
    if (dir === 'short' && cur < prior){
      return { valid: false, reason: 'MACRO VETO: US10Y Yields are dropping. Do not short Gold.' };
    }
    return ok;
  }catch(e){ return ok; }
}

function validateOBWithCVD(orderBlockSetup, tickBuffer){
  var ok = { triggerValid: true };
  try{
    if (!orderBlockSetup || !orderBlockSetup.trigger) return ok;
    if (!tickBuffer || typeof tickBuffer.getCVD !== 'function') return ok;
    var cvd = tickBuffer.getCVD();
    var dir = orderBlockSetup.direction || orderBlockSetup.dir;
    if (dir === 'long' && cvd < 0){
      return {
        triggerValid: false,
        reason: 'ORDER FLOW VETO: Negative CVD. Sellers are absorbing the Order Block.'
      };
    }
    if (dir === 'short' && cvd > 0){
      return {
        triggerValid: false,
        reason: 'ORDER FLOW VETO: Positive CVD. Buyers are pushing through the Order Block.'
      };
    }
    return ok;
  }catch(e){ return ok; }
}

function __applyObCvdGate(obSetup, tickBuffer){
  try{
    if (!obSetup || !obSetup.trigger){
      return { setup: obSetup || { trigger: false }, check: { triggerValid: true } };
    }
    var check = validateOBWithCVD(obSetup, tickBuffer);
    if (check.triggerValid) return { setup: obSetup, check: check };
    return {
      setup: {
        trigger: false, veto: check.reason, direction: obSetup.direction,
        type: obSetup.type, obType: obSetup.obType
      },
      check: check
    };
  }catch(e){ return { setup: obSetup, check: { triggerValid: true } }; }
}

function __yieldTrendFromRows(rows){
  try{
    if (!rows || rows.length < 5) return null;
    var cur = rows[rows.length - 1].c;
    var prior = rows[rows.length - 5].c;
    if (!isFinite(cur) || !isFinite(prior)) return null;
    if (cur > prior) return 'spiking';
    if (cur < prior) return 'dropping';
    return 'flat';
  }catch(e){ return null; }
}

function __publishBrainGoldMacro(ctx, out){
  try{
    if (ctx && ctx.us10yCandles){
      var yRows = __rows(ctx.us10yCandles);
      var yt = __yieldTrendFromRows(yRows);
      if (yt) W.__hgGoldYieldState = { trend: yt, at: Date.now() };
    }
    if (out && out.smt){
      var div = null;
      if (out.smt.smtActive){
        div = out.smt.type === 'BEARISH_SMT' ? 'BEARISH' : 'BULLISH';
      }
      W.__hgGoldSmtState = {
        divergence: div,
        smtActive: !!out.smt.smtActive,
        type: out.smt.type || null,
        at: Date.now()
      };
    }
  }catch(e){ /* never throw */ }
}

function hgYieldState(){
  try{
    if (W.__hgGoldYieldState && typeof W.__hgGoldYieldState === 'object'
        && typeof W.__hgGoldYieldState.trend === 'string'){
      return W.__hgGoldYieldState;
    }
    if (W.__hgYieldState && typeof W.__hgYieldState === 'object'
        && typeof W.__hgYieldState.trend === 'string'){
      return W.__hgYieldState;
    }
    if (W.__hgUs10yCandles){
      var yt = __yieldTrendFromRows(__rows(W.__hgUs10yCandles));
      if (yt) return { trend: yt, source: 'us10y-stash' };
    }
    var m = (typeof W.getGoldMacroCached === 'function') ? W.getGoldMacroCached() : null;
    if (m && m.tnxTrend){
      var trend = m.tnxTrend === 'RISING' ? 'spiking'
        : (m.tnxTrend === 'FALLING' ? 'dropping' : 'flat');
      return { trend: trend, tnx: m.tnx, source: 'macro-cache' };
    }
    return null;
  }catch(e){ return null; }
}

function hgSmtState(){
  try{
    if (W.__hgGoldSmtState && typeof W.__hgGoldSmtState === 'object'){
      return W.__hgGoldSmtState;
    }
    if (W.__hgSmtState && typeof W.__hgSmtState === 'object'){
      return W.__hgSmtState;
    }
    var xau = W.__hgXauCandles || W.__hgGoldXauCandles;
    var xag = W.__hgXagCandles || W.__hgGoldXagCandles;
    if (xau && xag){
      var smt = detectSMTDivergence(xau, xag);
      if (smt && smt.smtActive){
        return {
          divergence: smt.type === 'BEARISH_SMT' ? 'BEARISH' : 'BULLISH',
          smtActive: true,
          type: smt.type,
          source: 'candle-stash'
        };
      }
      return { divergence: null, smtActive: false, source: 'candle-stash' };
    }
    return null;
  }catch(e){ return null; }
}

function __wireSmtYieldGuards(ctx, index, out, obSetup){
  try{
    ctx = ctx || {};
    if (ctx.xauCandles && ctx.xagCandles){
      var xauN = __rows(ctx.xauCandles).length;
      var xagN = __rows(ctx.xagCandles).length;
      var smtIdx = Math.min(index, xauN - 1, xagN - 1);
      out.smt = detectSMTDivergence(ctx.xauCandles, ctx.xagCandles, smtIdx, ctx.smtLookback);
      if (out.smt.smtActive){
        var smtSide = out.smt.direction
          || (out.smt.signal === 'LONG_GOLD' ? 'long' : 'short');
        out.reads.push({
          side: smtSide,
          tag: 'smt',
          label: (out.smt.type === 'BULLISH_SMT' ? 'bullish' : 'bearish')
            + ' gold–silver SMT — correlated metal failed to confirm the liquidity sweep'
        });
      }
    } else {
      out.smt = out.smt || { smtActive: false };
    }
    var setupDir = ctx.setupDirection || ctx.positionDirection
      || (obSetup && obSetup.trigger ? obSetup.direction : null);
    if (ctx.us10yCandles && setupDir){
      out.yieldGuard = validateYieldCorrelation(ctx.us10yCandles, setupDir);
      if (out.yieldGuard && !out.yieldGuard.valid){
        out.valid = false;
        out.vetoReason = out.vetoReason
          ? (out.vetoReason + ' | ' + out.yieldGuard.reason)
          : out.yieldGuard.reason;
      }
    }
    __publishBrainGoldMacro(ctx, out);
  }catch(e){ /* never throw */ }
}

/* ================= DOM imbalance · time decay · dynamic regime ================= */

function __l2LevelSize(level){
  if (!level) return 0;
  var s = level.size;
  if (!isFinite(s)) s = level.qty;
  if (!isFinite(s)) s = level.amount;
  return (isFinite(s) && s > 0) ? +s : 0;
}

function calculateOrderBookImbalance(l2OrderBook, depthTicks){
  var neutral = {
    obiValue: 0, isBullishLiquidity: false, isBearishLiquidity: false,
    totalBidVol: 0, totalAskVol: 0
  };
  try{
    depthTicks = depthTicks || 20;
    if (!l2OrderBook || typeof l2OrderBook !== 'object') return neutral;
    var bids = l2OrderBook.bids || l2OrderBook.bid || [];
    var asks = l2OrderBook.asks || l2OrderBook.ask || [];
    if (!Array.isArray(bids) || !Array.isArray(asks)) return neutral;
    var totalBidVol = 0, totalAskVol = 0, i, n;
    n = Math.min(depthTicks, bids.length, asks.length);
    if (n <= 0){
      n = Math.min(depthTicks, Math.max(bids.length, asks.length));
    }
    for (i = 0; i < depthTicks; i++){
      if (bids[i]) totalBidVol += __l2LevelSize(bids[i]);
      if (asks[i]) totalAskVol += __l2LevelSize(asks[i]);
    }
    var denom = totalBidVol + totalAskVol;
    if (!(denom > 0)) return neutral;
    var obi = (totalBidVol - totalAskVol) / denom;
    return {
      obiValue: obi,
      isBullishLiquidity: obi > 0.20,
      isBearishLiquidity: obi < -0.20,
      totalBidVol: totalBidVol,
      totalAskVol: totalAskVol
    };
  }catch(e){ return neutral; }
}

function validateDomLiquidity(direction, l2OrderBook, depthTicks){
  var ok = { triggerValid: true };
  try{
    var obi = calculateOrderBookImbalance(l2OrderBook, depthTicks);
    ok.obi = obi;
    var dir = String(direction || '').toLowerCase();
    if (dir === 'long' && !obi.isBullishLiquidity){
      return {
        triggerValid: false,
        reason: 'L2 VETO: Order book heavily skewed to sellers.',
        obi: obi
      };
    }
    if (dir === 'short' && !obi.isBearishLiquidity){
      return {
        triggerValid: false,
        reason: 'L2 VETO: Order book heavily skewed to buyers.',
        obi: obi
      };
    }
    return ok;
  }catch(e){ return ok; }
}

function evaluateTimeDecay(activeSetup, currentCandle, barIndex, maxBars){
  var hold = { action: 'HOLD' };
  try{
    if (!activeSetup) return hold;
    maxBars = maxBars || 8;
    if (!isFinite(barIndex) || !isFinite(activeSetup.executionBarIndex)) return hold;
    var barsInTrade = barIndex - activeSetup.executionBarIndex;
    var type = activeSetup.type || 'scalp';
    if (type !== 'scalp' || barsInTrade < maxBars) return hold;
    var state = activeSetup.executionState;
    if (state !== 'FULL_RISK_ON' && state !== 'PARTIAL_RISK_ON') return hold;
    var c = currentCandle || {};
    var close = isFinite(c.c) ? c.c : c.close;
    if (!isFinite(close)) return hold;
    var levels = activeSetup.levels || {};
    var entry = isFinite(levels.entryPrice) ? levels.entryPrice
      : (isFinite(levels.entry) ? levels.entry : activeSetup.entry);
    if (!isFinite(entry)) return hold;
    var dir = activeSetup.direction || activeSetup.dir;
    var pnl = (dir === 'long') ? (close - entry) : (entry - close);
    if (pnl <= 0){
      return { action: 'MARKET_CLOSE_FULL', reason: 'MOMENTUM_DECAY' };
    }
    return { action: 'TRAIL_SL_TIGHT', reason: 'MOMENTUM_WARNING' };
  }catch(e){ return hold; }
}

function calculateDynamicThresholds(dailyCandles, lookback){
  var defaults = {
    requiredVolumeForSpike: NaN,
    requiredMinRR: 1.2,
    regime: 'CONTRACTION',
    meanVolume: NaN,
    meanATR: NaN,
    stdDevVolume: NaN
  };
  try{
    lookback = lookback || 30;
    var rows = __rows(dailyCandles);
    if (!rows || rows.length < lookback) return defaults;
    var slice = rows.slice(-lookback);
    var volumes = [], atrs = [], i, r, v, rng;
    for (i = 0; i < slice.length; i++){
      r = slice[i];
      v = isFinite(r.v) ? r.v : r.volume;
      if (isFinite(v) && v > 0) volumes.push(v);
      if (isFinite(r.h) && isFinite(r.l)) atrs.push(r.h - r.l);
    }
    if (volumes.length < 2 || atrs.length < 2) return defaults;
    var meanVol = 0, meanATR = 0;
    for (i = 0; i < volumes.length; i++) meanVol += volumes[i];
    for (i = 0; i < atrs.length; i++) meanATR += atrs[i];
    meanVol /= volumes.length;
    meanATR /= atrs.length;
    var varVol = 0;
    for (i = 0; i < volumes.length; i++){
      varVol += Math.pow(volumes[i] - meanVol, 2);
    }
    var stdDevVol = Math.sqrt(varVol / volumes.length);
    var last = slice[slice.length - 1];
    var lastRange = (isFinite(last.h) && isFinite(last.l)) ? (last.h - last.l) : NaN;
    var isHighVolRegime = isFinite(lastRange) && isFinite(meanATR) && lastRange > meanATR;
    return {
      requiredVolumeForSpike: meanVol + (2 * stdDevVol),
      requiredMinRR: isHighVolRegime ? 1.5 : 1.2,
      regime: isHighVolRegime ? 'EXPANSION' : 'CONTRACTION',
      meanVolume: meanVol,
      meanATR: meanATR,
      stdDevVolume: stdDevVol
    };
  }catch(e){ return defaults; }
}

function __wireDomAndRegime(ctx, out){
  try{
    ctx = ctx || {};
    if (ctx.l2OrderBook){
      out.domImbalance = calculateOrderBookImbalance(ctx.l2OrderBook, ctx.domDepth);
      var domDir = ctx.setupDirection || ctx.positionDirection;
      if (domDir){
        out.domCheck = validateDomLiquidity(domDir, ctx.l2OrderBook, ctx.domDepth);
        if (out.domCheck && !out.domCheck.triggerValid){
          out.valid = false;
          out.vetoReason = out.vetoReason
            ? (out.vetoReason + ' | ' + out.domCheck.reason)
            : out.domCheck.reason;
        }
      }
    }
    if (ctx.dailyCandles){
      out.regimeThresholds = calculateDynamicThresholds(ctx.dailyCandles, ctx.regimeLookback);
    }
  }catch(e){ /* never throw */ }
}

function __aggregateDailyFromRows(rows){
  var out = [], days = {}, keys = [], i, r, t, sec, ds, key, d;
  try{
    rows = __rows(rows);
    if (!rows || !rows.length) return out;
    for (i = 0; i < rows.length; i++){
      r = rows[i]; t = r.t; if (!isFinite(t)) continue;
      sec = (t >= 1e12) ? Math.floor(t / 1000) : t;
      ds = Math.floor(sec / 86400) * 86400;
      key = String(ds);
      if (!days[key]){
        days[key] = { t: ds, o: r.o, h: r.h, l: r.l, c: r.c, v: isFinite(r.v) ? r.v : 0 };
        keys.push(ds);
      } else {
        d = days[key];
        if (isFinite(r.h) && r.h > d.h) d.h = r.h;
        if (isFinite(r.l) && r.l < d.l) d.l = r.l;
        d.c = r.c;
        d.v += (isFinite(r.v) ? r.v : 0);
      }
    }
    keys.sort(function(a, b){ return a - b; });
    for (i = 0; i < keys.length; i++) out.push(days[String(keys[i])]);
    return out;
  }catch(e){ return out; }
}

/* Strategy 6: Asian range breakout — Asian or London session only, close
   outside the box with volume expansion (1.3× avg). */
function goldAsianBreakout(candles, index, sessionData, asianRangeData){
  var no = { trigger: false };
  try{
    candles = __rows(candles);
    if (!candles || !candles.length) return no;
    if (index === undefined || index === null) index = candles.length - 1;
    index = Math.floor(index);
    if (index < 0 || index >= candles.length) return no;
    sessionData = sessionData || {};
    if (!sessionData.isAsianRange && !sessionData.isLondonOpen) return no;
    if (!asianRangeData || !asianRangeData.valid) return no;
    if (!isFinite(asianRangeData.asianHigh) || !isFinite(asianRangeData.asianLow)) return no;
    var current = candles[index];
    if (!current || !isFinite(current.c)) return no;
    var isBullBreakout = current.c > asianRangeData.asianHigh;
    var isBearBreakout = current.c < asianRangeData.asianLow;
    var hasVolume = goldVolumeSpike(candles, index, 20, 1.3);
    if (isBullBreakout && hasVolume){
      return { trigger: true, direction: 'long', anchor: asianRangeData.asianLow, type: 'asian_breakout',
               asianHigh: asianRangeData.asianHigh, asianLow: asianRangeData.asianLow };
    }
    if (isBearBreakout && hasVolume){
      return { trigger: true, direction: 'short', anchor: asianRangeData.asianHigh, type: 'asian_breakout',
               asianHigh: asianRangeData.asianHigh, asianLow: asianRangeData.asianLow };
    }
    return no;
  }catch(e){ return no; }
}

/* Strategy 10: ADR exhaustion fade — >80% ADR consumed and price stretched
   beyond session VWAP 2σ bands. */
function goldADRFade(candles, index, adrData, vwap){
  var no = { trigger: false };
  try{
    candles = __rows(candles);
    if (!candles || !candles.length) return no;
    if (index === undefined || index === null) index = candles.length - 1;
    index = Math.floor(index);
    if (index < 0 || index >= candles.length) return no;
    if (!adrData || !adrData.isExhausted) return no;
    if (!vwap || !isFinite(vwap.upperBand) || !isFinite(vwap.lowerBand)) return no;
    var current = candles[index];
    if (!current || !isFinite(current.c)) return no;
    if (current.c > vwap.upperBand){
      return { trigger: true, direction: 'short', anchor: current.h, type: 'adr_fade_short',
               percentageConsumed: adrData.percentageConsumed };
    }
    if (current.c < vwap.lowerBand){
      return { trigger: true, direction: 'long', anchor: current.l, type: 'adr_fade_long',
               percentageConsumed: adrData.percentageConsumed };
    }
    return no;
  }catch(e){ return no; }
}

var detectAsianBreakout = goldAsianBreakout;
var detectADRFade = goldADRFade;

/* 19) Opening Range Breakout */
function goldOpeningRange(rows, session){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 5) return null;
    var n = rows.length, tl = rows[n-1].t;
    if (!isFinite(tl)) return null;
    var ds = Math.floor(tl/86400)*86400;
    var startH = (session === 'london') ? 7 : 13;
    var endH = (session === 'london') ? 8 : 14;
    var boxStart = ds + startH*3600, boxEnd = ds + endH*3600;
    var nowSec = tl;
    if (nowSec >= 1e12) nowSec = Math.floor(nowSec/1000);
    var hi = -Infinity, lo = Infinity, bars = 0;
    for (var i = 0; i < n; i++){
      var t = rows[i].t; if (!isFinite(t)) continue;
      if (t >= 1e12) t = Math.floor(t/1000);
      if (t < boxStart || t >= boxEnd) continue;
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      bars++;
    }
    if (bars < 2 || !(hi > lo)) return null;
    var c = rows[n-1].c, ct = rows[n-1].t;
    if (ct >= 1e12) ct = Math.floor(ct/1000);
    var state = (ct < boxEnd) ? 'BUILDING'
              : (c > hi) ? 'LONG_BREAK'
              : (c < lo) ? 'SHORT_BREAK' : 'INSIDE';
    return { session: session || 'unknown', hi: hi, lo: lo, mid: (hi+lo)/2,
             state: state, barsInBox: bars,
             dayIso: new Date(ds*1000).toISOString().slice(0, 10) };
  }catch(e){ return null; }
}

/* 20) Equal Highs / Equal Lows */
function goldEqualLevels(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return null;
    var n = rows.length;
    var aArr = _atr(rows, 14);
    var atr = __last(aArr);
    if (!isFinite(atr) || !(atr > 0)) return null;
    var tol = 0.3*atr;
    var highs = [], lows = [], i;
    for (i = 5; i < n - 5; i++){
      var isH = true, isL = true, k;
      for (k = 1; k <= 5; k++){
        if (rows[i].h <= rows[i-k].h || rows[i].h <= rows[i+k].h) isH = false;
        if (rows[i].l >= rows[i-k].l || rows[i].l >= rows[i+k].l) isL = false;
      }
      if (isH) highs.push({ level: rows[i].h, i: i });
      if (isL) lows.push({ level: rows[i].l, i: i });
    }
    function cluster(levels){
      var groups = [], g, j;
      for (j = 0; j < levels.length; j++){
        var placed = false;
        for (g = 0; g < groups.length; g++){
          if (Math.abs(levels[j].level - groups[g].level) <= tol){
            groups[g].level = (groups[g].level*groups[g].touches + levels[j].level)/(groups[g].touches + 1);
            groups[g].touches++; placed = true; break;
          }
        }
        if (!placed) groups.push({ level: levels[j].level, touches: 1 });
      }
      return groups.filter(function(x){ return x.touches >= 2; }).sort(function(a,b){ return a.level - b.level; });
    }
    var eH = cluster(highs), eL = cluster(lows);
    var c = rows[n-1].c;
    var nH = null, nL = null, dH = Infinity, dL = Infinity;
    for (i = 0; i < eH.length; i++){ var d = Math.abs(eH[i].level - c); if (d < dH){ dH = d; nH = eH[i]; } }
    for (i = 0; i < eL.length; i++){ var d2 = Math.abs(eL[i].level - c); if (d2 < dL){ dL = d2; nL = eL[i]; } }
    return { equalHighs: eH, equalLows: eL, nearestHigh: nH, nearestLow: nL };
  }catch(e){ return null; }
}

/* 21) ADX(14) with +DI / -DI */
function goldADX(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 28) return null;
    var n = rows.length, i;
    var tr = [], pDM = [], mDM = [];
    for (i = 1; i < n; i++){
      var up = rows[i].h - rows[i-1].h, down = rows[i-1].l - rows[i].l;
      var trv = Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i-1].c), Math.abs(rows[i].l - rows[i-1].c));
      tr.push(trv);
      pDM.push((up > down && up > 0) ? up : 0);
      mDM.push((down > up && down > 0) ? down : 0);
    }
    var m = tr.length;
    if (m < 14) return null;
    var atr14 = 0, p14 = 0, m14 = 0;
    for (i = 0; i < 14; i++){ atr14 += tr[m-14+i]; p14 += pDM[m-14+i]; m14 += mDM[m-14+i]; }
    atr14 /= 14; p14 /= 14; m14 /= 14;
    for (i = 14; i < m; i++){
      atr14 = (atr14*13 + tr[i])/14;
      p14 = (p14*13 + pDM[i])/14;
      m14 = (m14*13 + mDM[i])/14;
    }
    var pDI = 100*p14/atr14, mDI = 100*m14/atr14;
    var dx = 100*Math.abs(pDI - mDI)/(pDI + mDI);
    var adx = dx;
    var state = adx >= 25 ? 'TRENDING' : (adx < 20 ? 'CHOP' : 'TRANSITION');
    return { adx: adx, plusDI: pDI, minusDI: mDI, state: state, dir: pDI > mDI ? 'bull' : (pDI < mDI ? 'bear' : null) };
  }catch(e){ return null; }
}

/* 22) Range-Bound Market Detector */
function goldRangeBound(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 50) return null;
    var n = rows.length, c = __closes(rows);
    var adxR = goldADX(rows);
    var adxOk = adxR && adxR.adx < 20;
    var sum = 0, k;
    for (k = n-20; k < n; k++) sum += c[k];
    var mid = sum/20, sq = 0;
    for (k = n-20; k < n; k++) sq += (c[k]-mid)*(c[k]-mid);
    var sd = Math.sqrt(sq/20);
    var bbWidthPct = mid > 0 ? (2*sd*2)/mid*100 : NaN;
    var bbOk = isFinite(bbWidthPct) && bbWidthPct < 5.0;
    var aArr = _atr(rows, 14);
    var atrNow = __last(aArr);
    var atrHist = [];
    for (k = 19; k < n; k++) if (isFinite(aArr[k])) atrHist.push(aArr[k]);
    atrHist.sort(function(a,b){ return a-b; });
    var med = atrHist.length ? atrHist[Math.floor(atrHist.length/2)] : NaN;
    var atrOk = isFinite(atrNow) && isFinite(med) && atrNow < med;
    var atrPct = med > 0 ? atrNow/med : NaN;
    var conf = (adxOk && bbOk && atrOk) ? 'HIGH' : ((adxOk && bbOk) || (adxOk && atrOk) || (bbOk && atrOk)) ? 'MEDIUM' : 'LOW';
    return { isRangeBound: adxOk && bbOk && atrOk, adxOk: !!adxOk, bbOk: !!bbOk, atrOk: !!atrOk,
             bbWidthPct: bbWidthPct, atrPctOfMedian: atrPct, confidence: conf,
             adx: adxR ? adxR.adx : NaN };
  }catch(e){ return null; }
}

/* 23) Heikin-Ashi Trend Strength */
function goldHeikinAshi(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 5) return null;
    var n = rows.length, ha = [];
    var prevO = rows[0].o, prevC = rows[0].c;
    for (var i = 1; i < n; i++){
      var o = (prevO + prevC)/2;
      var c = (rows[i].o + rows[i].h + rows[i].l + rows[i].c)/4;
      var h = Math.max(rows[i].h, o, c);
      var l = Math.min(rows[i].l, o, c);
      ha.push({ o: o, h: h, l: l, c: c, body: c-o });
      prevO = o; prevC = c;
    }
    var m = ha.length;
    if (m < 3) return null;
    var last = ha[m-1];
    var consec = 0, j;
    for (j = m-1; j >= 0; j--){
      if ((last.body > 0 && ha[j].body > 0) || (last.body < 0 && ha[j].body < 0)) consec++;
      else break;
    }
    var dir = last.body > 0 ? 'bull' : (last.body < 0 ? 'bear' : null);
    var bodyPct = Math.abs(last.body)/(last.h - last.l);
    var strength = (consec >= 4 && bodyPct > 0.6) ? 'STRONG' : (consec >= 2 && bodyPct > 0.4) ? 'MODERATE' : 'WEAK';
    return { dir: dir, strength: strength, consecutive: consec, lastBody: last.body, lastSize: bodyPct };
  }catch(e){ return null; }
}

/* 24) Smart Exit Engine */
function goldSmartExit(dir, entry, stop, t1, t2, rows, opts){
  try{
    opts = opts || {};
    var isScalp = opts.scalp !== false;
    var notes = [];
    var a = _atr(rows, 14);
    var atr = __last(a);
    if (!isFinite(atr) || !(atr > 0)) atr = Math.abs(entry - stop)/1.5;
    var trail = null;
    if (dir === 'long') trail = entry + 1.5*atr; else trail = entry - 1.5*atr;
    notes.push('Trailing stop activates after TP1 hit — trails at 1.5×ATR (' + (isFinite(trail)?trail.toFixed(2):'n/a') + ')');
    var timeBars = isScalp ? 6 : 24;
    notes.push('Time exit: close full position after ' + timeBars + ' bars if neither TP nor SL hit');
    var mfi = goldMFI(rows);
    var volSignal = null;
    if (mfi.last === 'SQUAT'){
      volSignal = 'MFI SQUAT — high volume + low range at target area: take profit now';
      notes.push(volSignal);
    }
    var n = rows.length, lastC = rows[n-1].c;
    var structBreak = false, structNote = '';
    if (dir === 'long' && lastC < entry - 0.25*atr){ structBreak = true; structNote = 'price broke back below entry — structure failed, exit early'; }
    else if (dir === 'short' && lastC > entry + 0.25*atr){ structBreak = true; structNote = 'price broke back above entry — structure failed, exit early'; }
    if (structBreak) notes.push(structNote);
    var partials = [
      { pct: 0.30, at: t1, note: 'Close 30% at TP1 (' + (isFinite(t1)?t1.toFixed(2):'n/a') + '), move stop to breakeven' },
      { pct: 0.30, at: t2, note: 'Close 30% at TP2 (' + (isFinite(t2)?t2.toFixed(2):'n/a') + '), trail remainder' },
      { pct: 0.40, at: null, note: 'Runner 40% — trail with 1.5×ATR stop until trailing stop or time exit' }
    ];
    var runnerStop = trail;
    return {
      trailingStop: trail, timeExitBars: timeBars, volExitSignal: volSignal,
      structBreak: structBreak, structNote: structNote,
      partials: partials, runnerStop: runnerStop, notes: notes
    };
  }catch(e){ return { trailingStop: null, timeExitBars: isScalp?6:24, volExitSignal: null, structBreak: false, partials:[], notes:[] }; }
}

/* ---------------- microstructure & volume analysis ---------------- */

/* Absorption / climax: true when bar `index` volume exceeds the prior
   `lookback` bars' average by `thresholdMultiplier` (default 1.5×).
   Index defaults to the last bar. Missing/zero volume bars are skipped
   in the average; returns false when unknowable. */
function goldVolumeSpike(rows, index, lookback, thresholdMultiplier){
  try{
    rows = __rows(rows);
    if (!rows) return false;
    var n = rows.length;
    if (index === undefined || index === null) index = n - 1;
    index = Math.floor(index);
    lookback = (lookback === undefined || lookback === null) ? 20 : Math.max(1, Math.floor(lookback));
    thresholdMultiplier = (thresholdMultiplier === undefined || thresholdMultiplier === null)
      ? 1.5 : +thresholdMultiplier;
    if (!isFinite(thresholdMultiplier) || thresholdMultiplier <= 0) thresholdMultiplier = 1.5;
    if (index < lookback || index < 0 || index >= n) return false;
    var sumVol = 0, cnt = 0, i;
    for (i = index - lookback; i < index; i++){
      var v = rows[i].v;
      if (isFinite(v) && v > 0){ sumVol += v; cnt++; }
    }
    if (!cnt) return false;
    var avgVol = sumVol / cnt;
    var cur = rows[index].v;
    if (!(isFinite(cur) && cur > 0) || !(avgVol > 0)) return false;
    return cur > avgVol * thresholdMultiplier;
  }catch(e){ return false; }
}

/* Volume profile over the last `lookback` bars (default 100) split into
   `bins` price buckets (default 50). Returns POC and HVNs (bins with
   volume > mean + 1σ). null when range or total volume is unusable. */
function goldVolumeProfile(rows, lookback, bins){
  try{
    rows = __rows(rows);
    if (!rows) return null;
    lookback = (lookback === undefined || lookback === null) ? 100 : Math.max(5, Math.floor(lookback));
    bins = (bins === undefined || bins === null) ? 50 : Math.max(5, Math.floor(bins));
    var slice = rows.slice(-lookback);
    if (slice.length < 3) return null;
    var maxPrice = -Infinity, minPrice = Infinity, i, r;
    for (i = 0; i < slice.length; i++){
      r = slice[i];
      if (isFinite(r.h) && r.h > maxPrice) maxPrice = r.h;
      if (isFinite(r.l) && r.l < minPrice) minPrice = r.l;
    }
    if (!(isFinite(maxPrice) && isFinite(minPrice)) || !(maxPrice > minPrice)) return null;
    var binSize = (maxPrice - minPrice) / bins;
    if (!(binSize > 0)) return null;
    var profile = new Array(bins);
    for (i = 0; i < bins; i++) profile[i] = 0;
    var totalVol = 0;
    for (i = 0; i < slice.length; i++){
      r = slice[i];
      var v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
      var avgPrice = (r.h + r.l + r.c) / 3;
      if (!isFinite(avgPrice)) continue;
      var binIndex = Math.min(Math.floor((avgPrice - minPrice) / binSize), bins - 1);
      if (binIndex < 0) binIndex = 0;
      profile[binIndex] += v;
      totalVol += v;
    }
    if (!(totalVol > 0)) return null;
    var maxVol = 0, pocIndex = 0;
    for (i = 0; i < bins; i++){
      if (profile[i] > maxVol){ maxVol = profile[i]; pocIndex = i; }
    }
    var pocPrice = minPrice + pocIndex * binSize + binSize / 2;
    var meanVol = 0;
    for (i = 0; i < bins; i++) meanVol += profile[i];
    meanVol /= bins;
    var varSum = 0;
    for (i = 0; i < bins; i++) varSum += Math.pow(profile[i] - meanVol, 2);
    var stdDev = Math.sqrt(varSum / bins);
    /* Playbook §4.1 quantitative nodes (not mean±σ folklore):
         HVN: local max, V≥1.5×Vavg AND V≥0.40×Vmax, separated by ≥1 LVN
         LVN: local min, V≤0.50×Vavg, trough spans ≥2 consecutive rows */
    var hvnMinAvg = 1.5 * meanVol;
    var hvnMinMax = 0.40 * maxVol;
    var lvnMax = 0.50 * meanVol;
    var isLocalMax = new Array(bins);
    var isLocalMin = new Array(bins);
    for (i = 0; i < bins; i++){
      var left = i > 0 ? profile[i - 1] : profile[i];
      var right = i < bins - 1 ? profile[i + 1] : profile[i];
      isLocalMax[i] = profile[i] >= left && profile[i] >= right && profile[i] > 0;
      isLocalMin[i] = profile[i] <= left && profile[i] <= right;
    }
    var lvns = [];
    var lvnMask = new Array(bins);
    for (i = 0; i < bins; i++) lvnMask[i] = false;
    i = 0;
    while (i < bins){
      if (profile[i] > 0 && profile[i] <= lvnMax && isLocalMin[i]){
        var j = i;
        while (j + 1 < bins && profile[j + 1] > 0 && profile[j + 1] <= lvnMax) j++;
        if ((j - i + 1) >= 2 || (isLocalMin[i] && profile[i] <= lvnMax * 0.85)){
          /* Require ≥2 consecutive rows when possible; allow single deep trough
             only when flanked by higher bins (local min already true). Playbook
             prefers ≥2 — mark contiguous run when length≥2. */
          if ((j - i + 1) >= 2){
            var k;
            for (k = i; k <= j; k++){
              lvnMask[k] = true;
              lvns.push(minPrice + k * binSize + binSize / 2);
            }
          }
        }
        i = j + 1;
        continue;
      }
      i++;
    }
    /* If no 2-row troughs found, fall back to single-bin local mins ≤0.5×avg
       so thin profiles still expose LVN corridors for gate 8. */
    if (!lvns.length){
      for (i = 0; i < bins; i++){
        if (profile[i] > 0 && profile[i] <= lvnMax && isLocalMin[i]){
          lvnMask[i] = true;
          lvns.push(minPrice + i * binSize + binSize / 2);
        }
      }
    }
    var hvns = [];
    var lastHvnI = -999;
    for (i = 0; i < bins; i++){
      if (!isLocalMax[i]) continue;
      if (!(profile[i] >= hvnMinAvg && profile[i] >= hvnMinMax)) continue;
      /* Separated from nearest prior HVN by at least one LVN bin
         (empty / zero-volume bins also count — no-trade corridors). */
      if (lastHvnI >= 0){
        var sep = false, s;
        for (s = lastHvnI + 1; s < i; s++){
          if (lvnMask[s] || !(profile[s] > 0)){ sep = true; break; }
        }
        if (!sep) continue;
      }
      hvns.push(minPrice + i * binSize + binSize / 2);
      lastHvnI = i;
    }
    /* Soft HVNs (mean+σ local peaks) always merged for FVG launchpad /
       support helpers. Playbook ENTER uses hvnsStrict (§4.1 only). */
    var hvnsStrict = hvns.slice();
    var softThresh = meanVol + stdDev;
    for (i = 0; i < bins; i++){
      if (!isLocalMax[i]) continue;
      if (!(profile[i] > softThresh)) continue;
      var softMid = minPrice + i * binSize + binSize / 2;
      var nearStrict = false, hi;
      for (hi = 0; hi < hvns.length; hi++){
        if (Math.abs(hvns[hi] - softMid) < binSize){ nearStrict = true; break; }
      }
      if (!nearStrict) hvns.push(softMid);
    }

    /* Value area (~70% of volume) expanding from POC — standard VP convention */
    var targetVol = totalVol * 0.70;
    var loI = pocIndex, hiI = pocIndex, covered = profile[pocIndex];
    while (covered < targetVol && (loI > 0 || hiI < bins - 1)){
      var addLo = (loI > 0) ? profile[loI - 1] : -1;
      var addHi = (hiI < bins - 1) ? profile[hiI + 1] : -1;
      if (addHi >= addLo){
        if (hiI >= bins - 1){ if (loI <= 0) break; loI--; covered += profile[loI]; }
        else { hiI++; covered += profile[hiI]; }
      } else {
        if (loI <= 0){ if (hiI >= bins - 1) break; hiI++; covered += profile[hiI]; }
        else { loI--; covered += profile[loI]; }
      }
    }
    var vah = minPrice + (hiI + 1) * binSize;
    var val = minPrice + loI * binSize;

    return {
      pocPrice: pocPrice, hvns: hvns, hvnsStrict: hvnsStrict, lvns: lvns, binSize: binSize,
      minPrice: minPrice, maxPrice: maxPrice, bars: slice.length, totalVol: totalVol,
      profileHigh: maxPrice, profileLow: minPrice,
      vah: vah, val: val, valueAreaPct: 0.70,
      bins: bins, profile: profile,
      venueNote: 'VP from this feed is venue activity (XAUT/PAXG/spot/proxy) — not full COMEX GC'
    };
  }catch(e){ return null; }
}

/** Slice rows for a named profile window. */
function hgGoldVpSlice(rows, mode, opts){
  opts = opts || {};
  rows = __rows(rows);
  if (!rows || !rows.length) return [];
  var nowMs = opts.now || (isFinite(rows[rows.length - 1].t) ? rows[rows.length - 1].t * 1000 : Date.now());
  var lastT = rows[rows.length - 1].t;
  var i, out = [];
  if (mode === 'session'){
    /* Session: from 00:00 UTC of the current gold day (Globex-aligned day key) */
    var day0 = Math.floor(lastT / 86400) * 86400;
    for (i = 0; i < rows.length; i++){
      if (rows[i].t >= day0) out.push(rows[i]);
    }
    return out.length >= 3 ? out : rows.slice(-Math.min(96, rows.length));
  }
  if (mode === 'weekly'){
    var week0 = lastT - 5 * 86400;
    for (i = 0; i < rows.length; i++){
      if (rows[i].t >= week0) out.push(rows[i]);
    }
    return out.length >= 10 ? out : rows.slice(-Math.min(480, rows.length));
  }
  if (mode === 'anchored'){
    /* Anchor from prior-day extreme or last large impulse (≥1.2×ATR body) */
    var atrs = _atr(rows, 14);
    var atr = atrs && atrs.length ? atrs[atrs.length - 1] : NaN;
    var anchorIdx = Math.max(0, rows.length - 40);
    var pd = typeof hgGoldPriorDayLevels === 'function' ? hgGoldPriorDayLevels(rows) : null;
    if (pd && pd.ok){
      for (i = rows.length - 2; i >= Math.max(0, rows.length - 120); i--){
        if (isFinite(pd.hi) && Math.abs(rows[i].h - pd.hi) < (atr || 1) * 0.15){ anchorIdx = i; break; }
        if (isFinite(pd.lo) && Math.abs(rows[i].l - pd.lo) < (atr || 1) * 0.15){ anchorIdx = i; break; }
      }
    }
    if (isFinite(atr) && atr > 0){
      for (i = rows.length - 2; i >= Math.max(0, rows.length - 80); i--){
        var body = Math.abs(rows[i].c - rows[i].o);
        if (body >= 1.2 * atr){ anchorIdx = i; break; }
      }
    }
    return rows.slice(anchorIdx);
  }
  return rows.slice(-100);
}

/**
 * Triple gold VP bundle: session · weekly composite · anchored event.
 * Also finds naked POC (prior-session POC not revisited).
 */
function hgGoldVpBundle(rows, opts){
  var out = {
    ok: false, session: null, weekly: null, anchored: null,
    nakedPoc: null, singlePrints: [], auction: null, why: '',
    venueNote: 'VP from this feed is venue activity — not full COMEX GC'
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 20){ out.why = 'need ≥20 bars'; return out; }

    var sessRows = hgGoldVpSlice(rows, 'session', opts);
    var weekRows = hgGoldVpSlice(rows, 'weekly', opts);
    var ancRows = hgGoldVpSlice(rows, 'anchored', opts);

    out.session = goldVolumeProfile(sessRows, sessRows.length, opts.bins || 40);
    out.weekly = goldVolumeProfile(weekRows, weekRows.length, opts.bins || 50);
    out.anchored = goldVolumeProfile(ancRows, ancRows.length, opts.bins || 40);
    if (out.session) out.session.kind = 'session';
    if (out.weekly) out.weekly.kind = 'weekly';
    if (out.anchored) out.anchored.kind = 'anchored';

    /* Naked POC: prior-day session POC not traded through on the current day */
    try{
      var lastT = rows[rows.length - 1].t;
      var prevDay0 = Math.floor(lastT / 86400) * 86400 - 86400;
      var prevDay1 = prevDay0 + 86400;
      var prior = [];
      var i;
      for (i = 0; i < rows.length; i++){
        if (rows[i].t >= prevDay0 && rows[i].t < prevDay1) prior.push(rows[i]);
      }
      if (prior.length >= 8){
        var priorVp = goldVolumeProfile(prior, prior.length, 40);
        if (priorVp && isFinite(priorVp.pocPrice)){
          var touched = false;
          var day0 = prevDay1;
          for (i = 0; i < rows.length; i++){
            if (rows[i].t < day0) continue;
            if (rows[i].l <= priorVp.pocPrice && rows[i].h >= priorVp.pocPrice){ touched = true; break; }
          }
          if (!touched){
            out.nakedPoc = {
              level: priorVp.pocPrice, kind: 'naked-poc',
              label: 'NAKED POC (prior session)', untested: true
            };
          }
        }
      }
    }catch(_np){}

    /* Single prints: consecutive LVN bins (thin auction corridor) */
    try{
      var vp = out.session || out.weekly;
      if (vp && vp.lvns && vp.lvns.length){
        out.singlePrints = vp.lvns.slice(0, 6).map(function(l){
          return { level: l, label: 'single-print / LVN corridor' };
        });
      }
    }catch(_sp){}

    out.auction = hgGoldVpAuction(rows, out.session || out.weekly, opts);
    out.ok = !!(out.session || out.weekly || out.anchored);
    out.why = out.ok
      ? ('VP bundle · sess ' + (out.session ? 'ok' : '—')
        + ' · week ' + (out.weekly ? 'ok' : '—')
        + ' · anc ' + (out.anchored ? 'ok' : '—')
        + (out.nakedPoc ? ' · naked POC' : '')
        + (out.auction && out.auction.key ? (' · ' + out.auction.key) : ''))
      : 'no usable profiles';
    return out;
  }catch(e){ out.why = 'vp-bundle error'; return out; }
}

/**
 * Auction scenario: value-to-value · value-breakout · failed-auction.
 */
function hgGoldVpAuction(rows, vprof, opts){
  var out = { key: 'none', label: 'no auction read', dir: null, why: '' };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || !vprof || !isFinite(vprof.vah) || !isFinite(vprof.val)) return out;
    var n = rows.length;
    var cur = rows[n - 1];
    var prev = rows[n - 2] || cur;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    var rvol = typeof hgGoldSessionRvol === 'function'
      ? hgGoldSessionRvol(rows, n - 1, opts).rvol
      : (typeof hgGoldBarRvol === 'function' ? hgGoldBarRvol(rows, n - 1, 20) : NaN);

    var outsideHigh = cur.h > vprof.vah;
    var outsideLow = cur.l < vprof.val;
    var closeInside = cur.c <= vprof.vah && cur.c >= vprof.val;
    var closeAbove = cur.c > vprof.vah;
    var closeBelow = cur.c < vprof.val;
    var holdOut = false;
    if (n >= 3){
      holdOut = (closeAbove && rows[n - 2].c > vprof.vah) || (closeBelow && rows[n - 2].c < vprof.val);
    }

    /* Failed auction: wick outside value, close back inside, preferably high RVOL */
    if ((outsideHigh || outsideLow) && closeInside){
      out.key = 'failed-auction';
      out.dir = outsideLow ? 'long' : 'short';
      out.label = 'FAILED AUCTION — reclaim inside value';
      out.why = (outsideLow ? 'swept below VAL' : 'swept above VAH')
        + ' · close back inside'
        + (isFinite(rvol) ? (' · RVOL ' + rvol.toFixed(2)) : '');
      out.targetHint = 'POC first, then opposite value edge';
      return out;
    }

    /* Value breakout acceptance: close + hold outside with participation */
    if ((closeAbove || closeBelow) && holdOut && isFinite(rvol) && rvol >= 1.5){
      out.key = 'value-breakout';
      out.dir = closeAbove ? 'long' : 'short';
      out.label = 'VALUE BREAKOUT — do not fade';
      out.why = 'held outside ' + (closeAbove ? 'VAH' : 'VAL') + ' · RVOL ' + rvol.toFixed(2);
      out.targetHint = 'next HVN / LVN far edge / profile extreme / external liquidity';
      return out;
    }

    /* Value-to-value rotation: rejection at edge back toward POC (range) */
    var adxOk = true;
    try{
      if (typeof goldADX === 'function'){
        var adx = goldADX(rows);
        if (adx && isFinite(adx.adx) && adx.adx >= 25) adxOk = false; /* trend — skip V2V */
      }
    }catch(_a){}
    if (adxOk && closeInside){
      if (prev.h > vprof.vah && cur.c < vprof.vah){
        out.key = 'value-to-value'; out.dir = 'short';
        out.label = 'VALUE-TO-VALUE — reject VAH → POC';
        out.why = 'rejected above VAH · rotation toward POC/VAL';
        out.targetHint = 'POC first, then VAL if POC accepts';
        return out;
      }
      if (prev.l < vprof.val && cur.c > vprof.val){
        out.key = 'value-to-value'; out.dir = 'long';
        out.label = 'VALUE-TO-VALUE — reject VAL → POC';
        out.why = 'rejected below VAL · rotation toward POC/VAH';
        out.targetHint = 'POC first, then VAH if POC accepts';
        return out;
      }
    }

    out.why = 'inside value / no clear auction model';
    return out;
  }catch(e){ return out; }
}

/**
 * Profile-aware invalidation: stop beyond sweep extreme (not merely VAH/VAL)
 * plus 0.10–0.25×ATR buffer.
 */
function hgGoldVpStop(opts){
  var out = { stop: NaN, buffer: NaN, why: '' };
  try{
    opts = opts || {};
    var dir = (opts.dir === 'short') ? 'short' : 'long';
    var extreme = +opts.extreme;
    var atr = +opts.atr;
    if (!(isFinite(extreme) && isFinite(atr) && atr > 0)){ out.why = 'need extreme + ATR'; return out; }
    var mult = isFinite(opts.bufferMult) ? opts.bufferMult : 0.15;
    if (opts.lateSession) mult = 0.25;
    out.buffer = atr * mult;
    out.stop = (dir === 'long') ? (extreme - out.buffer) : (extreme + out.buffer);
    out.why = 'stop beyond sweep extreme + ' + mult.toFixed(2) + '×ATR (not merely VAH/VAL)';
    return out;
  }catch(e){ return out; }
}

/**
 * Post-sweep / directional target ladder from volume profile + external liquidity.
 * Prefer nearest opposing profile/liquidity level; require ≥1.5R for "confirmed" badge.
 */
function hgGoldVpTargets(opts){
  var out = {
    ok: false, dir: null, confirmed: false, thin: true,
    tp1: NaN, tp2: NaN, tp3: NaN, labels: [], why: '', parts: {},
    auction: null, stopPlan: null, dashboard: null,
    venueNote: 'VP from this feed is venue activity — map COMEX levels when available'
  };
  try{
    opts = opts || {};
    var dir = (opts.dir === 'short') ? 'short' : 'long';
    out.dir = dir;
    var entry = +opts.entry, stop = +opts.stop;
    var bundle = opts.bundle || null;
    var vprof = opts.vprof || (bundle && (bundle.session || bundle.weekly)) || null;
    var weekly = (bundle && bundle.weekly) || opts.weekly || null;
    if (!vprof || !isFinite(vprof.pocPrice)){ out.why = 'no volume profile'; return out; }
    out.thin = opts.thin !== false;
    out.venueNote = vprof.venueNote || out.venueNote;
    out.auction = opts.auction || (bundle && bundle.auction) || null;

    var risk = (isFinite(entry) && isFinite(stop)) ? Math.abs(entry - stop) : NaN;
    var candidates = [];
    function add(level, label, pri){
      if (!isFinite(level)) return;
      if (dir === 'long' && isFinite(entry) && !(level > entry)) return;
      if (dir === 'short' && isFinite(entry) && !(level < entry)) return;
      candidates.push({ level: level, label: label, pri: pri || 50 });
    }

    var ext = opts.external || {};
    var auctionKey = out.auction && out.auction.key;

    /* Failed auction / VAL reclaim → POC first (playbook) */
    var sweepBelowVal = isFinite(vprof.val) && isFinite(opts.sweepExtreme) && opts.sweepExtreme < vprof.val;
    var sweepAboveVah = isFinite(vprof.vah) && isFinite(opts.sweepExtreme) && opts.sweepExtreme > vprof.vah;

    if (dir === 'long'){
      /* Priority order from playbook */
      if (auctionKey === 'failed-auction' || sweepBelowVal){
        /* Next magnet above entry: POC → VAH → profile high */
        if (isFinite(vprof.pocPrice) && vprof.pocPrice > entry + 1e-9)
          add(vprof.pocPrice, 'session POC (VAL reclaim)', 5);
        else if (isFinite(vprof.vah) && vprof.vah > entry + 1e-9)
          add(vprof.vah, 'VAH (past POC)', 5);
        add(opts.vwap, 'session VWAP', 6);
      } else {
        add(opts.vwap, 'session VWAP', 8);
        add(vprof.pocPrice, 'session POC', 10);
      }
      if (vprof.hvns && vprof.hvns.length){
        var hn, nearestHvn = NaN;
        for (hn = 0; hn < vprof.hvns.length; hn++){
          if (vprof.hvns[hn] > entry && (!isFinite(nearestHvn) || vprof.hvns[hn] < nearestHvn))
            nearestHvn = vprof.hvns[hn];
        }
        add(nearestHvn, 'nearest HVN (brake)', 12);
      }
      add(vprof.vah, 'VAH', 16);
      if (vprof.lvns && vprof.lvns.length){
        var ln, farLvn = NaN;
        for (ln = 0; ln < vprof.lvns.length; ln++){
          if (vprof.lvns[ln] > entry && (!isFinite(farLvn) || vprof.lvns[ln] > farLvn))
            farLvn = vprof.lvns[ln];
        }
        add(farLvn, 'LVN far edge (corridor)', 22);
      }
      if (bundle && bundle.nakedPoc) add(bundle.nakedPoc.level, 'naked POC', 14);
      if (weekly && isFinite(weekly.pocPrice)) add(weekly.pocPrice, 'weekly composite POC', 18);
      add(ext.asiaHi || ext.londonHi, 'Asia/London high', 24);
      add(ext.pdh, 'prior-day high', 26);
      add(ext.eqHi, 'equal highs', 28);
      add(vprof.profileHigh, 'profile high', 30);
    } else {
      if (auctionKey === 'failed-auction' || sweepAboveVah){
        if (isFinite(vprof.pocPrice) && vprof.pocPrice < entry - 1e-9)
          add(vprof.pocPrice, 'session POC (VAH reclaim)', 5);
        else if (isFinite(vprof.val) && vprof.val < entry - 1e-9)
          add(vprof.val, 'VAL (past POC)', 5);
        add(opts.vwap, 'session VWAP', 6);
      } else {
        add(opts.vwap, 'session VWAP', 8);
        add(vprof.pocPrice, 'session POC', 10);
      }
      if (vprof.hvns && vprof.hvns.length){
        var hn2, nearestHvn2 = NaN;
        for (hn2 = 0; hn2 < vprof.hvns.length; hn2++){
          if (vprof.hvns[hn2] < entry && (!isFinite(nearestHvn2) || vprof.hvns[hn2] > nearestHvn2))
            nearestHvn2 = vprof.hvns[hn2];
        }
        add(nearestHvn2, 'nearest HVN (brake)', 12);
      }
      add(vprof.val, 'VAL', 16);
      if (vprof.lvns && vprof.lvns.length){
        var ln2, farLvn2 = NaN;
        for (ln2 = 0; ln2 < vprof.lvns.length; ln2++){
          if (vprof.lvns[ln2] < entry && (!isFinite(farLvn2) || vprof.lvns[ln2] < farLvn2))
            farLvn2 = vprof.lvns[ln2];
        }
        add(farLvn2, 'LVN far edge (corridor)', 22);
      }
      if (bundle && bundle.nakedPoc) add(bundle.nakedPoc.level, 'naked POC', 14);
      if (weekly && isFinite(weekly.pocPrice)) add(weekly.pocPrice, 'weekly composite POC', 18);
      add(ext.asiaLo || ext.londonLo, 'Asia/London low', 24);
      add(ext.pdl, 'prior-day low', 26);
      add(ext.eqLo, 'equal lows', 28);
      add(vprof.profileLow, 'profile low', 30);
    }

    /* Do not fade value-breakout — retarget continuation instead */
    if (auctionKey === 'value-breakout' && out.auction && out.auction.dir === dir){
      candidates = candidates.filter(function(c){
        return !/POC \(VA[LH] reclaim\)|VALUE-TO-VALUE/i.test(c.label);
      });
    }

    candidates.sort(function(a, b){
      var da = Math.abs(a.level - entry), db = Math.abs(b.level - entry);
      if (a.pri !== b.pri) return a.pri - b.pri;
      return da - db;
    });

    var picked = [], pi, pj, tooClose;
    for (pi = 0; pi < candidates.length && picked.length < 3; pi++){
      tooClose = false;
      for (pj = 0; pj < picked.length; pj++){
        if (Math.abs(candidates[pi].level - picked[pj].level) < (vprof.binSize || 0.5)){
          tooClose = true; break;
        }
      }
      if (!tooClose) picked.push(candidates[pi]);
    }

    if (!picked.length){ out.why = 'no opposing profile/liquidity targets beyond entry'; return out; }

    out.tp1 = picked[0].level;
    out.tp2 = picked.length > 1 ? picked[1].level : NaN;
    out.tp3 = picked.length > 2 ? picked[2].level : NaN;
    out.labels = picked.map(function(p){ return p.label + ' @ ' + p.level.toFixed(2); });
    out.ok = true;
    out.parts = {
      poc: vprof.pocPrice, vah: vprof.vah, val: vprof.val,
      profileHigh: vprof.profileHigh, profileLow: vprof.profileLow,
      weeklyPoc: weekly && weekly.pocPrice, nakedPoc: bundle && bundle.nakedPoc && bundle.nakedPoc.level
    };

    if (isFinite(opts.sweepExtreme) && isFinite(opts.atr)){
      out.stopPlan = hgGoldVpStop({
        dir: dir, extreme: opts.sweepExtreme, atr: opts.atr, lateSession: opts.lateSession
      });
      if (out.stopPlan && isFinite(out.stopPlan.stop) && !isFinite(stop)) stop = out.stopPlan.stop;
    }

    var rr1 = (isFinite(risk) && risk > 0) ? Math.abs(out.tp1 - entry) / risk
      : (out.stopPlan && isFinite(out.stopPlan.stop)
        ? Math.abs(out.tp1 - entry) / Math.abs(entry - out.stopPlan.stop) : NaN);
    var mssOk = !!opts.mssOk;
    out.confirmed = !!(mssOk && isFinite(rr1) && rr1 >= 1.5 && !opts.newsLock
      && auctionKey !== 'value-breakout');
    out.why = (out.confirmed ? 'PROFILE TARGET CONFIRMED' : 'PROFILE TARGETS')
      + ' ' + dir.toUpperCase()
      + ' · TP1 ' + out.labels[0]
      + (isFinite(rr1) ? (' · ' + rr1.toFixed(2) + 'R') : '')
      + (out.thin ? ' · THIN VP hint' : '');
    if (auctionKey && auctionKey !== 'none') out.why += ' · ' + auctionKey;
    if (!mssOk) out.why += ' · need MSS agree for confirmed badge';

    out.dashboard = {
      session: 'POC ' + (isFinite(vprof.pocPrice) ? vprof.pocPrice.toFixed(2) : '—')
        + ' / VAH ' + (isFinite(vprof.vah) ? vprof.vah.toFixed(2) : '—')
        + ' / VAL ' + (isFinite(vprof.val) ? vprof.val.toFixed(2) : '—')
        + ' / Hi ' + (isFinite(vprof.profileHigh) ? vprof.profileHigh.toFixed(2) : '—')
        + ' / Lo ' + (isFinite(vprof.profileLow) ? vprof.profileLow.toFixed(2) : '—'),
      weekly: weekly
        ? ('Composite POC ' + (isFinite(weekly.pocPrice) ? weekly.pocPrice.toFixed(2) : '—')
          + ' · HVN ' + ((weekly.hvns && weekly.hvns[0]) ? weekly.hvns[0].toFixed(2) : '—')
          + ' · LVN ' + ((weekly.lvns && weekly.lvns[0]) ? weekly.lvns[0].toFixed(2) : '—'))
        : '—',
      liquidity: 'PDH/PDL · Asia H-L · London H-L · Equal H-L'
        + (bundle && bundle.nakedPoc ? (' · naked POC ' + bundle.nakedPoc.level.toFixed(2)) : ''),
      confirmation: 'Session VWAP / RVOL / MSS / Sweep'
        + (auctionKey && auctionKey !== 'none' ? (' / ' + auctionKey) : ''),
      targets: out.labels.join(' · ')
    };
    return out;
  }catch(e){ out.why = 'vp-targets error'; return out; }
}

function hgGoldVpTargetsHtml(tg){
  try{
    if (!tg || !tg.ok) return '';
    var h = '<div class="note" data-hg-gold-vp-tg="1" style="margin-top:8px">';
    h += '<b>VP TARGETS</b>';
    if (tg.confirmed) h += ' · <b>CONFIRMED</b>';
    else h += ' · hint';
    if (tg.dir) h += ' · ' + String(tg.dir).toUpperCase();
    if (tg.auction && tg.auction.key && tg.auction.key !== 'none')
      h += ' · ' + String(tg.auction.label || tg.auction.key).replace(/[<>&]/g, '');
    if (tg.dashboard){
      h += '<div class="dim" style="margin-top:4px"><b>SESSION</b> '
        + String(tg.dashboard.session).replace(/[<>&]/g, '') + '</div>';
      h += '<div class="dim"><b>WEEKLY</b> '
        + String(tg.dashboard.weekly).replace(/[<>&]/g, '') + '</div>';
      h += '<div class="dim"><b>LIQUIDITY</b> '
        + String(tg.dashboard.liquidity).replace(/[<>&]/g, '') + '</div>';
      h += '<div class="dim"><b>CONFIRMATION</b> '
        + String(tg.dashboard.confirmation).replace(/[<>&]/g, '') + '</div>';
      h += '<div style="margin-top:4px"><b>TARGETS</b> '
        + String(tg.dashboard.targets).replace(/[<>&]/g, '') + '</div>';
    } else if (tg.labels && tg.labels.length){
      h += '<div style="margin-top:4px">';
      var i;
      for (i = 0; i < tg.labels.length; i++){
        h += (i ? ' · ' : '') + '<b>TP' + (i + 1) + '</b> ' + String(tg.labels[i]).replace(/[<>&]/g, '');
      }
      h += '</div>';
    }
    if (tg.stopPlan && isFinite(tg.stopPlan.stop)){
      h += '<div class="dim" style="margin-top:2px">stop '
        + (+tg.stopPlan.stop).toFixed(2) + ' — ' + String(tg.stopPlan.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    if (tg.why) h += '<div class="dim" style="margin-top:2px">' + String(tg.why).replace(/[<>&]/g, '') + '</div>';
    h += '<div class="dim" style="margin-top:2px">' + String(tg.venueNote || '').replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* =========================================================================
   VP PLAYBOOK GATES (hg-v565) — Gold Volume Profile Playbook §10 checklist.
   Explicit ENTER / WAIT / NO ENTRY — not a blended confidence %.
   Sacred contracts unchanged. Thin-perp VP remains informational when labeled.
========================================================================= */

var HG_GOLD_VP_RR_ENTER = 2.0;
var HG_GOLD_VP_RR_HALF = 1.5;
var HG_GOLD_VP_R_ATR_MAX = 0.6;
var HG_GOLD_VP_SWEEP_USD = 1.0; /* GC $1 wick floor (also ≥0.10×ATR) */
var HG_GOLD_VP_SWEEP_MAX_AGE = 3; /* 1H bars; on 15m treat as ≤12 bars */
var HG_GOLD_VP_GC_POINT = 100;   /* $ per $1 move on GC (100 oz) */
var HG_GOLD_VP_MGC_POINT = 10;   /* $ per $1 move on MGC (10 oz) */
var HG_GOLD_VP_DEFAULT_EQUITY = 50000;
var HG_GOLD_VP_RISK_PCT = 0.01;

/**
 * Playbook §9.3 — contracts from fixed $ risk ÷ (stop distance × point value).
 * Leverage is an OUTPUT, never an input.
 * -> { riskUsd, riskPts, gc, mgc, pick, why }
 */
function hgGoldVpContractSize(riskPts, opts){
  var out = {
    ok: false, riskUsd: NaN, riskPts: NaN, gc: 0, mgc: 0,
    pick: null, notionalGc: NaN, notionalMgc: NaN, why: ''
  };
  try{
    opts = opts || {};
    var equity = isFinite(opts.equity) ? opts.equity : HG_GOLD_VP_DEFAULT_EQUITY;
    var riskPct = isFinite(opts.riskPct) ? opts.riskPct : HG_GOLD_VP_RISK_PCT;
    if (opts.halfSize) riskPct *= 0.5;
    var riskUsd = isFinite(opts.riskUsd) ? opts.riskUsd : (equity * riskPct);
    riskPts = Math.abs(+riskPts);
    if (!(riskPts > 0) || !(riskUsd > 0)){
      out.why = 'need positive risk distance and $ risk';
      out.pick = '—';
      return out;
    }
    var gc = riskUsd / (riskPts * HG_GOLD_VP_GC_POINT);
    var mgc = riskUsd / (riskPts * HG_GOLD_VP_MGC_POINT);
    out.ok = true;
    out.riskUsd = riskUsd;
    out.riskPts = riskPts;
    out.gc = Math.floor(gc * 100) / 100;
    out.mgc = Math.floor(mgc);
    out.pick = (gc >= 1) ? ('GC×' + Math.floor(gc))
      : (out.mgc >= 1 ? ('MGC×' + out.mgc) : 'sub-lot — reduce risk or widen? no: use smaller account risk');
    if (gc < 1 && out.mgc >= 1) out.pick = 'MGC×' + out.mgc + ' (GC fractional ' + out.gc.toFixed(2) + ')';
    var px = isFinite(opts.entry) ? opts.entry : NaN;
    if (isFinite(px)){
      out.notionalGc = Math.floor(gc) * 100 * px;
      out.notionalMgc = out.mgc * 10 * px;
    }
    out.why = 'risk $' + riskUsd.toFixed(0) + ' ÷ R $' + riskPts.toFixed(2)
      + ' → ' + out.pick;
    return out;
  }catch(e){ out.why = 'size error'; return out; }
}

/**
 * 4H bias from weekly/anchored/session profile position + POC migration.
 * Returns { bias:'LONG'|'SHORT'|'BOTH'|'NO_TRADE', why }.
 */
function hgGoldVpBias4h(rows, bundle, opts){
  var out = { bias: 'BOTH', why: 'balanced value — both sides allowed at VA edges' };
  try{
    opts = opts || {};
    rows = __rows(rows);
    bundle = bundle || hgGoldVpBundle(rows, opts);
    var vp = (bundle && (bundle.weekly || bundle.anchored || bundle.session)) || null;
    if (!vp || !isFinite(vp.pocPrice)){
      out.bias = 'NO_TRADE'; out.why = 'no 4H/composite profile — bias undefined';
      return out;
    }
    var px = rows[rows.length - 1].c;
    if (isFinite(vp.vah) && px > vp.vah){
      out.bias = 'LONG'; out.why = 'price above VAH — imbalance bullish; longs at pullbacks';
      return out;
    }
    if (isFinite(vp.val) && px < vp.val){
      out.bias = 'SHORT'; out.why = 'price below VAL — imbalance bearish; shorts at rallies';
      return out;
    }
    /* Mid-LVN with no HVN nearby → NO TRADE */
    if (vp.lvns && vp.lvns.length){
      var i, midLvn = false;
      for (i = 0; i < vp.lvns.length; i++){
        if (isFinite(vp.lvns[i]) && Math.abs(px - vp.lvns[i]) < (vp.binSize || 1) * 2){
          midLvn = true; break;
        }
      }
      if (midLvn && !(vp.hvns && vp.hvns.some(function(h){
        return isFinite(h) && Math.abs(px - h) < (vp.binSize || 1) * 3;
      }))){
        out.bias = 'NO_TRADE'; out.why = 'price sitting mid-LVN — no node to react from';
        return out;
      }
    }
    return out;
  }catch(e){ out.bias = 'NO_TRADE'; out.why = 'bias error'; return out; }
}

/**
 * Location grade: A / B+ / B / C per playbook confluence matrix.
 * Needs node (HVN/POC/VA) + optional OB + pool beyond.
 */
function hgGoldVpLocationGrade(opts){
  var out = { grade: 'C', why: 'no 4H node', node: false, ob: false, pool: false };
  try{
    opts = opts || {};
    var vprof = opts.vprof || null;
    var entry = +opts.entry;
    var dir = opts.dir === 'short' ? 'short' : 'long';
    if (!vprof || !isFinite(entry)){ out.why = 'profile/entry unread'; return out; }
    var atr = isFinite(opts.atr) ? opts.atr : (vprof.binSize || 1) * 4;
    var tol = Math.max(atr * 0.35, (vprof.binSize || 1) * 2);
    var atHvn = false, atPoc = false, atVa = false, atLvn = false;
    if (isFinite(vprof.pocPrice) && Math.abs(entry - vprof.pocPrice) <= tol) atPoc = true;
    if (isFinite(vprof.vah) && Math.abs(entry - vprof.vah) <= tol) atVa = true;
    if (isFinite(vprof.val) && Math.abs(entry - vprof.val) <= tol) atVa = true;
    var i;
    var playbookHvns = (Array.isArray(vprof.hvnsStrict)) ? vprof.hvnsStrict : vprof.hvns;
    if (playbookHvns){
      for (i = 0; i < playbookHvns.length; i++){
        if (Math.abs(entry - playbookHvns[i]) <= tol){ atHvn = true; break; }
      }
    }
    if (vprof.lvns){
      for (i = 0; i < vprof.lvns.length; i++){
        if (Math.abs(entry - vprof.lvns[i]) <= tol){ atLvn = true; break; }
      }
    }
    out.node = atHvn || atPoc || atVa;
    out.ob = !!opts.obOk;
    out.pool = !!opts.poolNear;
    if (atLvn && out.ob){
      out.grade = 'C'; out.why = 'OB inside LVN — watch only (no volume backing)';
      return out;
    }
    if ((atHvn || atPoc) && out.ob && out.pool){
      out.grade = 'A'; out.why = '4H HVN/POC + unmitigated OB + pool beyond';
      return out;
    }
    if (atVa && out.ob && out.pool){
      out.grade = 'B+'; out.why = 'VA edge + OB + pool — fade-the-edge location';
      return out;
    }
    if ((atHvn || atPoc) && out.ob){
      out.grade = 'B'; out.why = '4H HVN/POC + OB — needs clear rejection';
      return out;
    }
    if (!out.node && out.ob && out.pool){
      out.grade = 'C'; out.why = 'no 4H node — scalp location at most';
      return out;
    }
    if (out.pool && !out.ob){
      out.grade = 'C'; out.why = 'pool without OB — sweep with nowhere to react';
      return out;
    }
    out.why = out.node ? 'node without full confluence' : 'no tradeable location';
    return out;
  }catch(e){ return out; }
}

/** True when an LVN sits strictly between entry and T1 (clean traversal). */
function hgGoldVpLvnBetween(entry, t1, vprof){
  try{
    if (!vprof || !vprof.lvns || !vprof.lvns.length) return false;
    if (!isFinite(entry) || !isFinite(t1) || entry === t1) return false;
    var lo = Math.min(entry, t1), hi = Math.max(entry, t1);
    var pad = (vprof.binSize || 0.5);
    var i;
    for (i = 0; i < vprof.lvns.length; i++){
      var lv = vprof.lvns[i];
      if (isFinite(lv) && lv > lo + pad && lv < hi - pad) return true;
    }
    return false;
  }catch(e){ return false; }
}

/**
 * Full §10 checklist → ENTER / WAIT / NO ENTRY + levels block.
 */
function hgGoldVpPlaybook(rows, opts){
  var out = {
    ok: false, decision: 'NO ENTRY', gatesPass: 0, gatesTotal: 12,
    halfSize: false, dir: null, entry: NaN, stop: NaN, t1: NaN, t2: NaN,
    rr1: NaN, risk: NaN, grade: null, bias: null, gates: [], why: '',
    block: '', targets: null, sessionOk: false
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40){
      out.why = 'need ≥40 bars for VP playbook'; return out;
    }
    var nowMs = opts.now || Date.now();
    var newsGate = opts.newsGate || (opts.news ? hgGoldNewsGate(opts.news, nowMs) : null);
    var bundle = opts.bundle || hgGoldVpBundle(rows, { now: nowMs });
    var vprof = opts.vprof || (bundle && (bundle.weekly || bundle.session)) || goldVolumeProfile(rows, 100, 50);
    var rows4h = __rows(opts.rows4h) || rows;
    var atrs4 = _atr(rows4h, 14);
    var atr4h = atrs4[atrs4.length - 1];
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    var px = rows[rows.length - 1].c;
    var bias = hgGoldVpBias4h(rows4h.length >= 30 ? rows4h : rows, bundle, opts);
    out.bias = bias;

    /* Prefer live sweep engine / Asia reclaim as trigger */
    var sweep = opts.sweep || null;
    if (!sweep && typeof hgGoldSweepEngine === 'function'){
      try{
        sweep = hgGoldSweepEngine(rows, {
          regime: opts.regime, newsGate: newsGate, scalp: !!opts.scalp
        });
      }catch(_s){}
    }
    var asia = opts.asia || goldAsianRange(rows);
    var dir = null, level = NaN, sweepAge = NaN, closeReclaim = false, breachUsd = NaN;
    if (sweep && sweep.dir && (sweep.confirmed || sweep.tier === 'alert' || sweep.ok)){
      dir = sweep.dir;
      level = sweep.level;
      closeReclaim = !!(sweep.wick && sweep.wick.closeReclaim) || !!sweep.confirmed;
      if (isFinite(sweep.breachAtr) && isFinite(atr)) breachUsd = sweep.breachAtr * atr;
      else if (isFinite(level) && isFinite(atr)) breachUsd = Math.max(HG_GOLD_VP_SWEEP_USD, 0.1 * atr);
      sweepAge = 0;
    } else if (asia && isFinite(asia.lo)){
      var sdL = hgGoldSweepDisplacement(rows, asia.lo, 'long', {});
      var sdH = hgGoldSweepDisplacement(rows, asia.hi, 'short', {});
      if (sdL.ok){ dir = 'long'; level = asia.lo; closeReclaim = true; breachUsd = (sdL.breachAtr || 0) * atr; sweepAge = 0; }
      else if (sdH.ok){ dir = 'short'; level = asia.hi; closeReclaim = true; breachUsd = (sdH.breachAtr || 0) * atr; sweepAge = 0; }
    }
    if (!dir && opts.dir) dir = opts.dir === 'short' ? 'short' : 'long';
    out.dir = dir;

    var sess = (typeof hgGoldSessionGate === 'function')
      ? hgGoldSessionGate(nowMs, rows, 'vpbook', {})
      : (typeof goldMarketSession === 'function' ? goldMarketSession(nowMs) : null);
    var sessName = (sess && (sess.session || sess.zone)) || '';
    var sessionOk = /LONDON|NY|OVERLAP|COMEX/i.test(String(sessName))
      && !/ASIAN|^OFF$/i.test(String(sessName));
    /* Also allow UTC hour windows from playbook */
    var utcH = new Date(nowMs).getUTCHours();
    if ((utcH >= 7 && utcH < 10) || (utcH >= 12 && utcH < 14)) sessionOk = true;
    if (utcH >= 0 && utcH < 7) sessionOk = false;
    if (utcH >= 16) sessionOk = false;
    /* NY_PM is manage-only per playbook */
    if (/NY_PM/i.test(String(sessName))) sessionOk = false;
    out.sessionOk = sessionOk;

    var entry = isFinite(opts.entry) ? opts.entry : px;
    var stopBuf = Math.max(HG_GOLD_VP_SWEEP_USD * 2, 0.25 * (atr || 1));
    var stop = isFinite(opts.stop) ? opts.stop
      : (isFinite(level) ? (dir === 'long' ? level - stopBuf : level + stopBuf) : NaN);
    if (sweep && sweep.plan && isFinite(sweep.plan.stop)) stop = sweep.plan.stop;

    var loc = hgGoldVpLocationGrade({
      vprof: vprof, entry: entry, dir: dir, atr: atr,
      obOk: !!(opts.obOk || (opts.obZone && isFinite(opts.obZone.lo))),
      poolNear: !!(isFinite(level) || (asia && isFinite(asia.hi)))
    });
    out.grade = loc;

    var tg = null;
    if (dir && isFinite(entry) && isFinite(stop) && vprof){
      tg = hgGoldVpTargets({
        dir: dir, entry: entry, stop: stop, vprof: vprof, bundle: bundle,
        thin: true, mssOk: !!(opts.mssOk || (sweep && sweep.mss && sweep.mss.ok)),
        newsLock: !!(newsGate && newsGate.lock),
        sweepExtreme: isFinite(opts.sweepExtreme) ? opts.sweepExtreme : level,
        atr: atr,
        auction: bundle && bundle.auction,
        external: {
          asiaHi: asia && asia.hi, asiaLo: asia && asia.lo,
          pdh: opts.pdh, pdl: opts.pdl
        }
      });
      out.targets = tg;
      if (tg && tg.ok){
        out.t1 = tg.tp1; out.t2 = tg.tp2;
        if (tg.stopPlan && isFinite(tg.stopPlan.stop)) stop = tg.stopPlan.stop;
      }
    }
    out.entry = entry; out.stop = stop;
    out.risk = (isFinite(entry) && isFinite(stop)) ? Math.abs(entry - stop) : NaN;
    out.rr1 = (isFinite(out.risk) && out.risk > 0 && isFinite(out.t1))
      ? Math.abs(out.t1 - entry) / out.risk : NaN;

    var minBreach = Math.max(HG_GOLD_VP_SWEEP_USD, isFinite(atr) ? 0.1 * atr : HG_GOLD_VP_SWEEP_USD);
    var maxAge = opts.scalp ? 12 : HG_GOLD_VP_SWEEP_MAX_AGE;

    function gate(n, name, pass, note){
      out.gates.push({ n: n, name: name, pass: !!pass, note: note || '' });
      if (pass) out.gatesPass++;
    }

    gate(1, '4H bias defined', bias.bias !== 'NO_TRADE', bias.why);
    var dirMatch = !dir ? false
      : (bias.bias === 'BOTH' || bias.bias === (dir === 'long' ? 'LONG' : 'SHORT')
        || (bias.bias === 'BOTH' && loc.grade === 'B+'));
    gate(2, 'Direction matches 4H bias', dirMatch,
      dir ? (dir.toUpperCase() + ' vs bias ' + bias.bias) : 'no direction');
    var locOk = loc.grade === 'A' || loc.grade === 'B+';
    gate(3, 'Location A or B+', locOk, loc.why + ' (' + loc.grade + ')');
    var wickOk = isFinite(breachUsd) && breachUsd >= minBreach;
    gate(4, 'Liquidity pool swept', wickOk,
      isFinite(breachUsd) ? ('breach $' + breachUsd.toFixed(2) + ' vs min $' + minBreach.toFixed(2)) : 'no sweep');
    var reclaimOk = closeReclaim && (isFinite(sweepAge) ? sweepAge <= maxAge : false);
    gate(5, 'Close back inside ≤3 bars', reclaimOk,
      closeReclaim ? ('reclaim age ' + sweepAge) : 'no reclaim');
    var obOverlap = !!(opts.obOk || loc.ob || (opts.obZone && isFinite(entry)
      && entry >= opts.obZone.lo && entry <= opts.obZone.hi));
    gate(6, 'Rejection overlaps OB', obOverlap, obOverlap ? 'OB overlap' : 'no OB overlap');
    var newsOk = !(newsGate && newsGate.lock);
    gate(7, 'Session London/NY · no news lock', sessionOk && newsOk,
      (sessionOk ? sessName || 'session ok' : 'wrong session') + (newsOk ? '' : ' · NEWS LOCK'));
    var lvnPath = hgGoldVpLvnBetween(entry, out.t1, vprof);
    gate(8, 'LVN between entry and T1', lvnPath, lvnPath ? 'LVN corridor' : 'no LVN path / same node');
    var rrOk = isFinite(out.rr1) && out.rr1 >= HG_GOLD_VP_RR_ENTER;
    var rrHalf = isFinite(out.rr1) && out.rr1 >= HG_GOLD_VP_RR_HALF && out.rr1 < HG_GOLD_VP_RR_ENTER;
    gate(9, 'RR to T1 ≥ 2.0', rrOk || rrHalf,
      isFinite(out.rr1) ? (out.rr1.toFixed(2) + 'R' + (rrHalf ? ' (half-size band)' : '')) : 'no RR');
    var rOk = isFinite(out.risk) && isFinite(atr4h) && out.risk <= HG_GOLD_VP_R_ATR_MAX * atr4h;
    gate(10, 'R ≤ 0.6×4H ATR', rOk,
      isFinite(out.risk) && isFinite(atr4h)
        ? ('R=' + out.risk.toFixed(2) + ' vs cap ' + (HG_GOLD_VP_R_ATR_MAX * atr4h).toFixed(2))
        : 'ATR unread');
    var feedOk = !(opts.badTick === true);
    gate(11, 'Price feed sane', feedOk, feedOk ? (bundle && bundle.venueNote ? 'PROXY/venue noted' : 'ok') : 'bad tick');
    var lossOk = opts.dayStops !== 2; /* when unknown, pass with note */
    gate(12, 'Not second loss of day', lossOk,
      opts.dayStops === 2 ? 'two stops — done' : (isFinite(opts.dayStops) ? ('stops today ' + opts.dayStops) : 'unchecked'));

    out.ok = true;
    var failing = out.gates.filter(function(g){ return !g.pass; }).map(function(g){ return g.n; });
    if (out.gatesPass === 12){
      out.decision = 'ENTER'; out.halfSize = false;
    } else if (out.gatesPass === 11 && rrHalf && failing.length === 1 && failing[0] === 9){
      out.decision = 'ENTER'; out.halfSize = true;
    } else if (out.gatesPass >= 8 && (failing.indexOf(4) >= 0 || failing.indexOf(5) >= 0 || failing.indexOf(7) >= 0)){
      out.decision = 'WAIT';
    } else if (out.gatesPass >= 9 && !rrOk && !rrHalf){
      out.decision = 'WAIT';
    } else {
      out.decision = 'NO ENTRY';
    }

    out.why = out.decision + ' · ' + out.gatesPass + '/12'
      + (out.halfSize ? ' · HALF SIZE' : '')
      + (dir ? (' · ' + dir.toUpperCase()) : '')
      + (failing.length ? (' · fail G' + failing.join(',')) : '');

    out.size = hgGoldVpContractSize(out.risk, {
      halfSize: out.halfSize, entry: entry,
      equity: opts.equity, riskPct: opts.riskPct, riskUsd: opts.riskUsd
    });

    var ist = '';
    try{
      ist = new Date(nowMs).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    }catch(_i){ ist = String(nowMs); }
    out.block = 'XAUUSD  |  ' + new Date(nowMs).toISOString().slice(0, 16).replace('T', ' ')
      + ' UTC  |  ' + (sessName || 'session') + '\n'
      + 'DECISION : ' + out.decision + (out.halfSize ? ' (half size)' : '')
      + '            (gates ' + out.gatesPass + '/12)\n'
      + 'ENTRY    : ' + (isFinite(entry) ? entry.toFixed(2) : '—') + '\n'
      + 'STOP     : ' + (isFinite(stop) ? stop.toFixed(2) : '—')
      + (isFinite(out.risk) ? ('  (R = $' + out.risk.toFixed(2) + ')') : '') + '\n'
      + 'T1       : ' + (isFinite(out.t1) ? out.t1.toFixed(2) : '—')
      + (isFinite(out.rr1) ? ('        RR ' + out.rr1.toFixed(2)) : '') + '\n'
      + 'T2       : ' + (isFinite(out.t2) ? out.t2.toFixed(2) : '—') + '\n'
      + 'SIZE     : ' + (out.size && out.size.pick ? out.size.pick : '—')
      + (out.size && isFinite(out.size.riskUsd) ? ('  (risk $' + out.size.riskUsd.toFixed(0) + ')') : '') + '\n'
      + 'CONTEXT  : bias ' + bias.bias + '; grade ' + loc.grade
      + '; ' + String(out.why);
    return out;
  }catch(e){ out.why = 'vp-playbook error'; return out; }
}

function hgGoldVpPlaybookHtml(pb){
  try{
    if (!pb || !pb.ok) return '';
    var h = '<div class="note" data-hg-gold-vp-playbook="1" style="margin-top:8px">';
    h += '<b>VP PLAYBOOK</b> · <b>' + String(pb.decision || '').replace(/[<>&]/g, '') + '</b>';
    h += ' · ' + pb.gatesPass + '/' + pb.gatesTotal;
    if (pb.halfSize) h += ' · HALF';
    if (pb.dir) h += ' · ' + String(pb.dir).toUpperCase();
    if (pb.bias && pb.bias.bias) h += ' · bias ' + pb.bias.bias;
    if (pb.grade && pb.grade.grade) h += ' · loc ' + pb.grade.grade;
    if (isFinite(pb.entry)) h += '<div style="margin-top:4px">ENTRY ' + (+pb.entry).toFixed(2)
      + (isFinite(pb.stop) ? (' · SL ' + (+pb.stop).toFixed(2)) : '')
      + (isFinite(pb.t1) ? (' · T1 ' + (+pb.t1).toFixed(2)) : '')
      + (isFinite(pb.rr1) ? (' · ' + (+pb.rr1).toFixed(2) + 'R') : '')
      + '</div>';
    if (pb.size && pb.size.ok && pb.size.pick){
      h += '<div class="dim" style="margin-top:2px">SIZE ' + String(pb.size.pick).replace(/[<>&]/g, '')
        + (isFinite(pb.size.riskUsd) ? (' · risk $' + (+pb.size.riskUsd).toFixed(0)) : '')
        + '</div>';
    }
    var i, g, fails = [];
    for (i = 0; i < (pb.gates || []).length; i++){
      g = pb.gates[i];
      if (!g.pass) fails.push('G' + g.n + ' ' + g.name);
    }
    if (fails.length){
      h += '<div class="dim" style="margin-top:2px">failing: '
        + fails.slice(0, 6).join(' · ').replace(/[<>&]/g, '') + '</div>';
    }
    if (pb.why) h += '<div class="dim" style="margin-top:2px">' + String(pb.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* V2 trigger helpers — volume-validated sweep + HVN-backed FVG (never throw). */

function goldFVGHasHVNSupport(g, vprof){
  try{
    if (!g || !vprof || !vprof.hvns || !vprof.hvns.length) return false;
    if (!(isFinite(g.bottom) && isFinite(g.top))) return false;
    var binSize = vprof.binSize;
    if (!(isFinite(binSize) && binSize > 0)) return false;
    var lo = g.bottom - 2 * binSize;
    var hi = g.top + binSize;
    for (var i = 0; i < vprof.hvns.length; i++){
      var h = vprof.hvns[i];
      if (isFinite(h) && h >= lo && h <= hi) return true;
    }
    return false;
  }catch(e){ return false; }
}

function goldSweepV2(rows, index, sweepLookback, volLookback, mult){
  try{
    rows = __rows(rows);
    if (!rows) return { trigger: false };
    var n = rows.length;
    if (index === undefined || index === null) index = n - 1;
    index = Math.floor(index);
    sweepLookback = (sweepLookback === undefined || sweepLookback === null)
      ? 10 : Math.max(2, Math.floor(sweepLookback));
    if (index < sweepLookback || index < 0 || index >= n) return { trigger: false };
    var cur = rows[index];
    if (!cur || !isFinite(cur.l) || !isFinite(cur.h) || !isFinite(cur.c)) return { trigger: false };
    var priorLow = Infinity, priorHigh = -Infinity, i;
    for (i = index - sweepLookback; i < index; i++){
      if (rows[i].l < priorLow) priorLow = rows[i].l;
      if (rows[i].h > priorHigh) priorHigh = rows[i].h;
    }
    var volOk = goldVolumeSpike(rows, index, volLookback, mult);
    if (cur.l < priorLow && cur.c > priorLow && volOk){
      return { trigger: true, dir: 'long', anchor: cur.l, type: 'long_sweep',
               level: priorLow, index: index };
    }
    if (cur.h > priorHigh && cur.c < priorHigh && volOk){
      return { trigger: true, dir: 'short', anchor: cur.h, type: 'short_sweep',
               level: priorHigh, index: index };
    }
    return { trigger: false };
  }catch(e){ return { trigger: false }; }
}

function goldFVGV2(rows, index, vprof){
  try{
    rows = __rows(rows);
    if (!rows) return { trigger: false };
    var n = rows.length;
    if (index === undefined || index === null) index = n - 1;
    index = Math.floor(index);
    if (index < 2 || index >= n) return { trigger: false };
    if (!vprof) vprof = goldVolumeProfile(rows, 100, 50);
    var c1 = rows[index - 2], c3 = rows[index];
    if (!c1 || !c3) return { trigger: false };
    if (c1.h < c3.l){
      var gapBase = c1.h, gapTop = c3.l;
      if (goldFVGHasHVNSupport({ bottom: gapBase, top: gapTop, dir: 'bullish' }, vprof)){
        return { trigger: true, dir: 'long', anchor: gapBase, type: 'long_fvg',
                 bottom: gapBase, top: gapTop, index: index };
      }
    }
    if (c1.l > c3.h){
      var bBot = c3.h, bTop = c1.l;
      if (goldFVGHasHVNSupport({ bottom: bBot, top: bTop, dir: 'bearish' }, vprof)){
        return { trigger: true, dir: 'short', anchor: bTop, type: 'short_fvg',
                 bottom: bBot, top: bTop, index: index };
      }
    }
    return { trigger: false };
  }catch(e){ return { trigger: false }; }
}

/* ---------------- SMC & market structure (fractal swings, BOS/CHOCH, OB@bar) ---------------- */

/* Fractal swing highs/lows (default 5 left + 5 right). -> {highs, lows} with
   {index, price, barsAgo}; empty arrays when unknowable — never throws. */
function goldSwings(rows, leftBars, rightBars){
  var empty = { highs: [], lows: [] };
  try{
    rows = __rows(rows);
    if (!rows) return empty;
    var n = rows.length;
    leftBars = (leftBars === undefined || leftBars === null) ? 5 : Math.max(1, Math.floor(leftBars));
    rightBars = (rightBars === undefined || rightBars === null) ? 5 : Math.max(1, Math.floor(rightBars));
    if (n < leftBars + rightBars + 1) return empty;
    var highs = [], lows = [], i, j, r, isHigh, isLow;
    for (i = leftBars; i < n - rightBars; i++){
      isHigh = true;
      isLow = true;
      r = rows[i];
      if (!isFinite(r.h) || !isFinite(r.l)) continue;
      for (j = 1; j <= leftBars; j++){
        if (rows[i - j].h >= r.h) isHigh = false;
        if (rows[i - j].l <= r.l) isLow = false;
      }
      for (j = 1; j <= rightBars; j++){
        if (rows[i + j].h >= r.h) isHigh = false;
        if (rows[i + j].l <= r.l) isLow = false;
      }
      var ago = n - 1 - i;
      if (isHigh) highs.push({ index: i, price: r.h, barsAgo: ago });
      if (isLow) lows.push({ index: i, price: r.l, barsAgo: ago });
    }
    return { highs: highs, lows: lows };
  }catch(e){ return empty; }
}

/* BOS / CHOCH vs the last two fractal swings per side. Optional precomputed
   swings; computes fractals when omitted. -> {trend, bos, choch, level,
   lastHigh, prevHigh, lastLow, prevLow} — neutral when unknowable. */
function goldMarketStructure(rows, swings, leftBars, rightBars){
  var neutral = { trend: 'neutral', bos: false, choch: false, level: null,
                  lastHigh: null, prevHigh: null, lastLow: null, prevLow: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return neutral;
    if (!swings || typeof swings !== 'object'){
      swings = goldSwings(rows, leftBars, rightBars);
    }
    if (!swings.highs || !swings.lows) return neutral;
    if (swings.highs.length < 2 || swings.lows.length < 2) return neutral;
    var lastHigh = swings.highs[swings.highs.length - 1];
    var prevHigh = swings.highs[swings.highs.length - 2];
    var lastLow = swings.lows[swings.lows.length - 1];
    var prevLow = swings.lows[swings.lows.length - 2];
    var cur = rows[rows.length - 1].c;
    if (!isFinite(cur)) return neutral;
    var out = {
      trend: 'neutral', bos: false, choch: false, level: null,
      lastHigh: lastHigh, prevHigh: prevHigh, lastLow: lastLow, prevLow: prevLow
    };
    if (cur > lastHigh.price && lastHigh.price > prevHigh.price){
      out.trend = 'bullish';
      out.bos = true;
      out.level = lastHigh.price;
      return out;
    }
    if (cur < lastLow.price && lastLow.price < prevLow.price){
      out.trend = 'bearish';
      out.bos = true;
      out.level = lastLow.price;
      return out;
    }
    if (cur > lastHigh.price && lastHigh.price <= prevHigh.price){
      out.trend = 'bullish';
      out.choch = true;
      out.level = lastHigh.price;
      return out;
    }
    if (cur < lastLow.price && lastLow.price >= prevLow.price){
      out.trend = 'bearish';
      out.choch = true;
      out.level = lastLow.price;
      return out;
    }
    return out;
  }catch(e){ return neutral; }
}

/* Displacement order block at bar `index` (default last): opposing candle
   before a >=1.5×ATR impulse that engulfs it. -> {type, top, base,
   mitigated} | {type:'none'}. */
function goldOrderBlockAt(rows, index, atr){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 6) return { type: 'none' };
    var n = rows.length;
    if (index === undefined || index === null) index = n - 1;
    index = Math.floor(index);
    if (index < 5 || index >= n) return { type: 'none' };
    var cur = rows[index], prev = rows[index - 1];
    if (!cur || !prev) return { type: 'none' };
    if (!isFinite(atr) || !(atr > 0)){
      atr = __last(_atr(rows, 14));
    }
    if (!isFinite(atr) || !(atr > 0)) return { type: 'none' };
    var bodyUp = cur.c - cur.o;
    var bodyDn = cur.o - cur.c;
    var mitigated = false, k;
    if (prev.c < prev.o && bodyUp > 1.5 * atr && cur.c > prev.h){
      for (k = index + 1; k < n; k++){
        if (rows[k].l <= prev.l){ mitigated = true; break; }
      }
      return { type: 'bullish_ob', top: prev.h, base: prev.l, mitigated: mitigated,
               index: index - 1, impulseIndex: index };
    }
    if (prev.c > prev.o && bodyDn > 1.5 * atr && cur.c < prev.l){
      for (k = index + 1; k < n; k++){
        if (rows[k].h >= prev.h){ mitigated = true; break; }
      }
      return { type: 'bearish_ob', top: prev.h, base: prev.l, mitigated: mitigated,
               index: index - 1, impulseIndex: index };
    }
    return { type: 'none' };
  }catch(e){ return { type: 'none' }; }
}

/* Stateful scan of unmitigated displacement OBs through `endIndex` (default
   last bar). Close-based mitigation: bullish fails below base; bearish above
   top. Stateless — no global mutable array. */
function goldActiveOrderBlocks(rows, atr, endIndex){
  var empty = [];
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 6) return empty;
    var n = rows.length;
    if (endIndex === undefined || endIndex === null) endIndex = n - 1;
    endIndex = Math.floor(endIndex);
    if (endIndex < 5) return empty;
    if (endIndex >= n) endIndex = n - 1;
    if (!isFinite(atr) || !(atr > 0)) atr = __last(_atr(rows, 14));
    if (!isFinite(atr) || !(atr > 0)) return empty;
    var active = [], i, ob, cur, j, dup;
    for (i = 5; i <= endIndex; i++){
      ob = goldOrderBlockAt(rows, i, atr);
      if (ob && ob.type !== 'none' && !ob.mitigated){
        dup = false;
        for (j = 0; j < active.length; j++){
          if (active[j].index === ob.index && active[j].type === ob.type){ dup = true; break; }
        }
        if (!dup){
          active.push({ type: ob.type, top: ob.top, base: ob.base,
                        index: ob.index, impulseIndex: ob.impulseIndex });
        }
      }
      cur = rows[i].c;
      if (!isFinite(cur)) continue;
      active = active.filter(function(z){
        if (z.type === 'bullish_ob' && cur < z.base) return false;
        if (z.type === 'bearish_ob' && cur > z.top) return false;
        return true;
      });
    }
    return active;
  }catch(e){ return empty; }
}

/* Incremental active-zone update at `index` (alias-friendly wrapper). Caches the
   last result so detectOrderBlockRetest(rows, index, structure) can omit activeObs. */
var _lastActiveZones = null;
function goldUpdateActiveZones(rows, index, atr){
  try{
    rows = __rows(rows);
    if (!rows || !rows.length) return { activeOrderBlocks: [] };
    if (index === undefined || index === null) index = rows.length - 1;
    var blocks = goldActiveOrderBlocks(rows, atr, index);
    _lastActiveZones = blocks;
    return { activeOrderBlocks: blocks };
  }catch(e){ _lastActiveZones = null; return { activeOrderBlocks: [] }; }
}

/* Structure-aligned OB retest on bar `index`. Requires non-neutral trend;
   long inside bullish OB in bullish trend, short mirror for bearish. */
function goldOrderBlockRetest(rows, index, structure, activeObs){
  var no = { trigger: false };
  try{
    rows = __rows(rows);
    if (!rows || !rows.length) return no;
    var n = rows.length;
    if (index === undefined || index === null) index = n - 1;
    index = Math.floor(index);
    if (index < 0 || index >= n) return no;
    structure = structure || { trend: 'neutral' };
    if (!structure.trend || structure.trend === 'neutral') return no;
    if (!activeObs || !activeObs.length){
      activeObs = (_lastActiveZones && _lastActiveZones.length) ? _lastActiveZones
        : goldActiveOrderBlocks(rows, undefined, index);
    }
    var current = rows[index], ob, i;
    for (i = 0; i < activeObs.length; i++){
      ob = activeObs[i];
      if (ob.type === 'bullish_ob' && structure.trend === 'bullish'){
        if (current.l <= ob.top && current.c >= ob.base){
          return { trigger: true, direction: 'long', anchor: ob.base, type: 'ob_retest',
                   top: ob.top, base: ob.base, obType: ob.type, index: ob.index };
        }
      }
      if (ob.type === 'bearish_ob' && structure.trend === 'bearish'){
        if (current.h >= ob.base && current.c <= ob.top){
          return { trigger: true, direction: 'short', anchor: ob.top, type: 'ob_retest',
                   top: ob.top, base: ob.base, obType: ob.type, index: ob.index };
        }
      }
    }
    return no;
  }catch(e){ return no; }
}

/* HardgateGoldEngine — scalp microstructure evaluator (volume profile first,
   then strict V2 triggers on the evaluation bar). Never throws. */
function evaluateScalp(m15Data, ctx){
  var out = {
    volProfile: null,
    sweepData: { trigger: false },
    fvgData: { trigger: false },
    obSetup: { trigger: false },
    asianSetup: { trigger: false },
    adrFade: { trigger: false },
    adrData: null,
    session: null,
    asianRange: null,
    macroHint: 'NEUTRAL',
    ker: { er: 1.0, isChop: false },
    isChop: false,
    paxgBasis: null,
    newsState: { inNewsWindow: false },
    confluenceTally: 0,
    valid: true,
    vetoReason: null,
    smt: { smtActive: false },
    yieldGuard: null,
    obCvdCheck: null,
    domImbalance: null,
    domCheck: null,
    regimeThresholds: null,
    swings: null,
    structure: null,
    activeOrderBlocks: [],
    activeTriggers: [],
    agreeingReads: 0,
    context: ctx || {},
    reads: []
  };
  try{
    var rows = __rows(m15Data);
    if (!rows || rows.length < 3) return out;
    if (!out.context || typeof out.context !== 'object') out.context = {};
    var index = rows.length - 1;

    out.ker = calculateKaufmanER(rows, 20);
    out.isChop = out.ker.isChop;
    out.confluenceTally = 0;
    out.valid = true;
    out.vetoReason = null;

    out.volProfile = goldVolumeProfile(rows, 100, 50);

    var sweepData = goldSweepV2(rows, index, 10, 20, 1.5);
    out.sweepData = sweepData;
    if (sweepData && sweepData.trigger){
      out.activeTriggers.push('LIQUIDITY_SWEEP_VOL_VALIDATED');
      out.agreeingReads++;
      if (isFinite(sweepData.anchor)) out.context.nearestStructure = sweepData.anchor;
      out.reads.push({
        side: sweepData.dir,
        tag: 'sweep_v2',
        label: 'V2 liquidity sweep — volume-validated reclaim at '
          + (isFinite(sweepData.level) ? sweepData.level.toFixed(2) : 'n/a')
          + ' (stop anchor ' + (isFinite(sweepData.anchor) ? sweepData.anchor.toFixed(2) : 'n/a') + ')'
      });
    }

    var fvgData = goldFVGV2(rows, index, out.volProfile);
    out.fvgData = fvgData;
    if (fvgData && fvgData.trigger){
      out.activeTriggers.push('FVG_HVN_DEFENDED');
      out.agreeingReads++;
      if (isFinite(fvgData.anchor)) out.context.nearestStructure = fvgData.anchor;
      out.reads.push({
        side: fvgData.dir,
        tag: 'fvg_v2',
        label: 'V2 FVG — HVN-defended gap '
          + (isFinite(fvgData.bottom) ? fvgData.bottom.toFixed(2) : 'n/a') + '–'
          + (isFinite(fvgData.top) ? fvgData.top.toFixed(2) : 'n/a')
          + ' (stop anchor ' + (isFinite(fvgData.anchor) ? fvgData.anchor.toFixed(2) : 'n/a') + ')'
      });
    }

    /* Maintain market structure & active OB zones, then evaluate OB retest. */
    var atr15 = out.context.atr15;
    if (!isFinite(atr15) || !(atr15 > 0)) atr15 = __last(_atr(rows, 14));
    if (isFinite(atr15) && atr15 > 0) out.context.atr15 = atr15;

    var swings = goldSwings(rows, 5, 5);
    var structure = goldMarketStructure(rows, swings);
    out.swings = swings;
    out.structure = structure;

    var zoneUpd = goldUpdateActiveZones(rows, index, atr15);
    out.activeOrderBlocks = zoneUpd.activeOrderBlocks || [];

    var obSetup = goldOrderBlockRetest(rows, index, structure);
    var obGate = __applyObCvdGate(obSetup, out.context.tickBuffer);
    out.obSetup = obGate.setup;
    out.obCvdCheck = obGate.check;
    obSetup = obGate.setup;
    if (obSetup && obSetup.trigger){
      out.activeTriggers.push('ORDER_BLOCK_RETEST');
      out.agreeingReads++;
      if (isFinite(obSetup.anchor)) out.context.nearestStructure = obSetup.anchor;
      out.reads.push({
        side: obSetup.direction,
        tag: 'ob_retest',
        label: 'structure-aligned OB retest — '
          + (obSetup.obType === 'bullish_ob' ? 'bullish' : 'bearish') + ' zone '
          + obSetup.base.toFixed(2) + '–' + obSetup.top.toFixed(2)
          + ' with ' + structure.trend + ' fractal structure (stop anchor '
          + obSetup.anchor.toFixed(2) + ')'
      });
    }

    /* Session & exhaustion triggers — Asian breakout + ADR fade. */
    var lastT = rows[index].t;
    var sessionData = getMarketSession(isFinite(lastT) ? lastT : Date.now());
    out.session = sessionData;

    var asianRangeData = calculateAsianRange(rows, index);
    out.asianRange = asianRangeData;

    var asianSetup = goldAsianBreakout(rows, index, sessionData, asianRangeData);
    out.asianSetup = asianSetup;
    if (asianSetup && asianSetup.trigger){
      out.activeTriggers.push('ASIAN_RANGE_BREAKOUT');
      out.agreeingReads++;
      if (isFinite(asianSetup.anchor)) out.context.nearestStructure = asianSetup.anchor;
      out.reads.push({
        side: asianSetup.direction,
        tag: 'asian_breakout',
        label: 'volume-validated Asian-range breakout '
          + (asianSetup.direction === 'long' ? 'above' : 'below') + ' the box '
          + asianSetup.asianLow.toFixed(2) + '–' + asianSetup.asianHigh.toFixed(2)
          + ' (stop anchor ' + asianSetup.anchor.toFixed(2) + ')'
      });
    }

    var dailyBars = __aggregateDailyFromRows(rows);
    var adrData = calculateADRExhaustion(dailyBars,
      dailyBars.length ? dailyBars[dailyBars.length - 1] : null, 14);
    out.adrData = adrData;

    var vwapAnchor = 0;
    if (isFinite(lastT)){
      var ds0 = Math.floor(lastT / 86400) * 86400;
      var ai0;
      for (ai0 = index; ai0 >= 0; ai0--){
        var tt0 = rows[ai0].t;
        if (!isFinite(tt0) || tt0 < ds0){ vwapAnchor = ai0 + 1; break; }
      }
      if (vwapAnchor < 0 || vwapAnchor >= rows.length) vwapAnchor = 0;
    }
    var vwbEval = goldVWAPBands(rows, vwapAnchor);
    var vwap = vwbEval ? {
      value: vwbEval.value,
      upperBand: vwbEval.upper2,
      lowerBand: vwbEval.lower2
    } : null;

    var adrFade = goldADRFade(rows, index, adrData, vwap);
    out.adrFade = adrFade;
    if (adrFade && adrFade.trigger){
      out.activeTriggers.push(adrFade.type === 'adr_fade_short' ? 'ADR_FADE_SHORT' : 'ADR_FADE_LONG');
      out.agreeingReads++;
      if (isFinite(adrFade.anchor)) out.context.nearestStructure = adrFade.anchor;
      out.reads.push({
        side: adrFade.direction,
        tag: 'adr_fade',
        label: 'ADR exhaustion fade — '
          + (isFinite(adrData.percentageConsumed) ? (adrData.percentageConsumed * 100).toFixed(0) : '80+')
          + '% of daily range consumed, price beyond VWAP '
          + (adrFade.direction === 'short' ? 'upper' : 'lower') + ' band (stop anchor '
          + adrFade.anchor.toFixed(2) + ')'
      });
    }

    /* Macro hint — intraday DXY open/close (ctx override or computed from DXY bars). */
    if (out.context.macroHint === 'TAILWIND' || out.context.macroHint === 'HEADWIND'
        || out.context.macroHint === 'NEUTRAL'){
      out.macroHint = out.context.macroHint;
    } else if (out.context.dxyCandles || out.context.currentDxy){
      out.macroHint = calculateMacroHint(out.context.dxyCandles, out.context.currentDxy);
      out.context.macroHint = out.macroHint;
    }

    /* PAXG basis + news veto + confluence tally injection. */
    var paxgPx = out.context.paxgPrice, spotPx = out.context.spotXauPrice;
    if (isFinite(paxgPx) && isFinite(spotPx)){
      out.paxgBasis = calculateGoldSpotBasis(paxgPx, spotPx);
      out.confluenceTally += out.paxgBasis.basisTally;
    }
    var newsGuard = out.context.newsGuard, newsState;
    var evalMs = isFinite(lastT) ? __toMs(lastT) : Date.now();
    var winMin = isFinite(out.context.newsWindowMinutes) ? out.context.newsWindowMinutes : 30;
    if (newsGuard && typeof newsGuard.checkNewsWindow === 'function'){
      newsState = newsGuard.checkNewsWindow(evalMs, winMin);
    } else if (out.context.news){
      var nc = __newsCaution(out.context.news, evalMs);
      newsState = nc.caution
        ? { inNewsWindow: true, eventName: nc.title || 'High-impact event', minutesToEvent: null }
        : { inNewsWindow: false };
    } else {
      newsState = { inNewsWindow: false };
    }
    out.newsState = newsState;
    if (newsState.inNewsWindow){
      out.valid = false;
      out.vetoReason = 'NEWS VETO: High-Impact Event (' + (newsState.eventName || 'release')
        + ') within ±' + winMin + ' min window.';
    }

    var tickBuf = out.context.tickBuffer;
    if (tickBuf && typeof tickBuf.getCVD === 'function') out.cvd = tickBuf.getCVD();

    __wireSmtYieldGuards(out.context, index, out, obSetup);
    __wireDomAndRegime(out.context, out);

    return out;
  }catch(e){ return out; }
}

/* 4h swing evaluator — structure + active OB zones + OB retest trigger. */
function evaluateSwing(h4Data, ctx){
  var out = {
    volProfile: null,
    obSetup: { trigger: false },
    swings: null,
    structure: null,
    activeOrderBlocks: [],
    activeTriggers: [],
    agreeingReads: 0,
    fundingTally: 0,
    confluenceTally: 0,
    cvd: null,
    smt: { smtActive: false },
    yieldGuard: null,
    obCvdCheck: null,
    valid: true,
    vetoReason: null,
    context: ctx || {},
    reads: []
  };
  try{
    var rows = __rows(h4Data);
    if (!rows || rows.length < 3) return out;
    if (!out.context || typeof out.context !== 'object') out.context = {};
    var index = rows.length - 1;

    out.volProfile = goldVolumeProfile(rows, 100, 50);

    var atr4 = out.context.atr4;
    if (!isFinite(atr4) || !(atr4 > 0)) atr4 = __last(_atr(rows, 14));
    if (isFinite(atr4) && atr4 > 0) out.context.atr4 = atr4;

    var swings = goldSwings(rows, 5, 5);
    var structure = goldMarketStructure(rows, swings);
    out.swings = swings;
    out.structure = structure;

    var zoneUpd = goldUpdateActiveZones(rows, index, atr4);
    out.activeOrderBlocks = zoneUpd.activeOrderBlocks || [];

    var obSetup = goldOrderBlockRetest(rows, index, structure);
    var obGateSw = __applyObCvdGate(obSetup, out.context.tickBuffer);
    out.obSetup = obGateSw.setup;
    out.obCvdCheck = obGateSw.check;
    obSetup = obGateSw.setup;
    if (obSetup && obSetup.trigger){
      out.activeTriggers.push('ORDER_BLOCK_RETEST');
      out.agreeingReads++;
      if (isFinite(obSetup.anchor)) out.context.nearestStructure = obSetup.anchor;
      out.reads.push({
        side: obSetup.direction,
        tag: 'ob_retest',
        label: '4h structure-aligned OB retest — '
          + (obSetup.obType === 'bullish_ob' ? 'bullish' : 'bearish') + ' zone '
          + obSetup.base.toFixed(2) + '–' + obSetup.top.toFixed(2)
          + ' with ' + structure.trend + ' fractal structure (stop anchor '
          + obSetup.anchor.toFixed(2) + ')'
      });
    }

    var fundRate = out.context.fundingRate;
    if (fundRate !== undefined && fundRate !== null && isFinite(__normFundingPct(fundRate))){
      var posDir = out.context.positionDirection;
      if (!posDir && obSetup && obSetup.trigger) posDir = obSetup.direction;
      if (!posDir) posDir = 'long';
      out.fundingTally = evaluateFundingRate(fundRate, posDir);
      out.confluenceTally = out.fundingTally;
    }
    var tickBuf = out.context.tickBuffer;
    if (tickBuf && typeof tickBuf.getCVD === 'function') out.cvd = tickBuf.getCVD();

    __wireSmtYieldGuards(out.context, index, out, obSetup);
    __wireDomAndRegime(out.context, out);

    return out;
  }catch(e){ return out; }
}

var HardgateGoldEngine = { evaluateScalp: evaluateScalp, evaluateSwing: evaluateSwing };

/* =========================================================================
   Institutional gold filters (GOLD SCALP 15m / GOLD SWING 4h execution tape).
   Not a crypto G1–G7 matrix and not M1/M5. Missing DXY/TNX / news / spread
   / HTF rows fail-open. 1.5×ATR14 is the STOP FLOOR (structure may widen).
   ========================================================================= */

/* 250 gold points at 0.001 = $0.25 = 2.5 pips at a 0.10 pip size. */
var HG_GOLD_SPREAD_MAX_USD = 0.25;
var HG_GOLD_SPREAD_POINT = 0.001;
var HG_GOLD_NEWS_BEFORE_MS = 30 * 60 * 1000;
var HG_GOLD_NEWS_AFTER_MS = 15 * 60 * 1000;

function hgGoldNewsIsTier1(title){
  try{
    var s = String(title || '').toUpperCase();
    if (!s) return false;
    if (/\bCPI\b/.test(s) || /CONSUMER PRICE/.test(s)) return true;
    if (/\bNFP\b/.test(s) || /NON[\s-]?FARM/.test(s) || /PAYROLLS/.test(s)) return true;
    if (/\bFOMC\b/.test(s) || /FED(ERAL)?\s+(FUNDS|RATE|DECISION|MEETING)/.test(s)
        || /INTEREST RATE DECISION/.test(s)) return true;
    if (/\bGDP\b/.test(s) || /GROSS DOMESTIC/.test(s)) return true;
    return false;
  }catch(e){ return false; }
}

function hgGoldNewsEvents(news){
  try{
    if (!news) return [];
    if (Array.isArray(news.events)) return news.events;
    if (Array.isArray(news)) return news;
    return [];
  }catch(e){ return []; }
}

function hgGoldNewsGate(news, nowMs){
  var out = { lock: false, title: null, reason: null, unchecked: false };
  try{
    if (!isFinite(nowMs)) nowMs = Date.now();
    if (!news){ out.unchecked = true; return out; }
    var evs = hgGoldNewsEvents(news);
    /* Official Fed calendar FOMC decision/press events (merged by callers). */
    if (Array.isArray(news.fomc)){
      for (var fi = 0; fi < news.fomc.length; fi++){
        if (news.fomc[fi]) evs.push(news.fomc[fi]);
      }
    }
    if (!evs.length){
      if (!Array.isArray(news) && !('events' in news) && !('fomc' in news)) out.unchecked = true;
      return out;
    }
    var i, ev, t, dt, title;
    for (i = 0; i < evs.length; i++){
      ev = evs[i];
      if (!ev) continue;
      title = ev.title || ev.name || ev.event || '';
      if (!hgGoldNewsIsTier1(title) && !ev.fomcDecision) continue;
      t = (ev.t != null) ? ev.t : ev.timestamp;
      t = (+t < 1e12) ? (+t) * 1000 : +t;
      if (!isFinite(t)) continue;
      dt = nowMs - t;
      if (dt >= -HG_GOLD_NEWS_BEFORE_MS && dt <= HG_GOLD_NEWS_AFTER_MS){
        out.lock = true;
        out.title = title || null;
        out.reason = (ev.fomcDecision ? 'FOMC GATE — Fed calendar hard block' : 'NEWS GATE — no new entries, wait 15 min after release')
          + (out.title ? ' (' + out.title + ')' : '');
        return out;
      }
    }
    return out;
  }catch(e){ return { lock: false, title: null, reason: null, unchecked: true }; }
}

/** Merge Fed calendar FOMC decision events into a news object for hgGoldNewsGate. */
function hgGoldMergeFedFomc(news, fedCal){
  try{
    var base = news && typeof news === 'object' && !Array.isArray(news)
      ? Object.assign({}, news) : { events: hgGoldNewsEvents(news) };
    var fomc = [];
    if (fedCal && Array.isArray(fedCal.fomc)) fomc = fedCal.fomc.slice();
    else if (Array.isArray(fedCal)) fomc = fedCal.slice();
    base.fomc = fomc;
    return base;
  }catch(e){ return news; }
}

function hgGoldSpreadUsd(src){
  try{
    if (src == null) return NaN;
    if (typeof src === 'number') return +src;
    if (typeof src !== 'object') return NaN;
    if (isFinite(src.spreadUsd)) return +src.spreadUsd;
    if (isFinite(src.spreadPoints)) return +src.spreadPoints * HG_GOLD_SPREAD_POINT;
    if (isFinite(src.spread)){
      if (src.spreadUnit === 'points') return +src.spread * HG_GOLD_SPREAD_POINT;
      return +src.spread;
    }
    if (isFinite(src.bid) && isFinite(src.ask)) return Math.abs(+src.ask - +src.bid);
    var book = src.l2OrderBook || src.book || src;
    var bids = book.bids || book.bid;
    var asks = book.asks || book.ask;
    if (Array.isArray(bids) && Array.isArray(asks) && bids.length && asks.length){
      var b0 = bids[0], a0 = asks[0];
      var bp = (typeof b0 === 'number') ? +b0
        : (b0 && (isFinite(b0.price) ? +b0.price : +b0[0]));
      var ap = (typeof a0 === 'number') ? +a0
        : (a0 && (isFinite(a0.price) ? +a0.price : +a0[0]));
      if (isFinite(bp) && isFinite(ap)) return Math.abs(ap - bp);
    }
    return NaN;
  }catch(e){ return NaN; }
}

function hgGoldSpreadLock(src){
  var out = { lock: false, spread: NaN, max: HG_GOLD_SPREAD_MAX_USD, unchecked: false, reason: null };
  try{
    var sp = hgGoldSpreadUsd(src);
    out.spread = sp;
    if (!isFinite(sp)){ out.unchecked = true; return out; }
    if (sp > HG_GOLD_SPREAD_MAX_USD){
      out.lock = true;
      out.reason = 'SPREAD LOCK — live bid/ask ' + sp.toFixed(3) + ' > '
        + HG_GOLD_SPREAD_MAX_USD.toFixed(2) + ' (250 points / 2.5 pips)';
    }
    return out;
  }catch(e){
    return { lock: false, spread: NaN, max: HG_GOLD_SPREAD_MAX_USD, unchecked: true, reason: null };
  }
}

function hgGoldMtfBias(rows){
  var out = { bull: false, bear: false, stacked: null, px: NaN, ema20: NaN, ema50: NaN, unchecked: true };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 55) return out;
    var closes = __closes(rows);
    var e20 = __last(_ema(closes, 20));
    var e50 = __last(_ema(closes, 50));
    var px = closes[closes.length - 1];
    out.px = px; out.ema20 = e20; out.ema50 = e50;
    if (!isFinite(px) || !isFinite(e20) || !isFinite(e50)) return out;
    out.unchecked = false;
    if (px > e20 && e20 > e50){ out.bull = true; out.stacked = 'bull'; }
    else if (px < e20 && e20 < e50){ out.bear = true; out.stacked = 'bear'; }
    return out;
  }catch(e){ return out; }
}

function hgGoldMtfMatrix(inp){
  inp = inp || {};
  var h4 = hgGoldMtfBias(inp.rows4h);
  var d1 = hgGoldMtfBias(inp.rows1d);
  var out = {
    h4: h4, d1: d1,
    scalpLongOk: true,
    scalpShortOk: true,
    scalpLocked: false,
    swingOnly: false,
    conflict: false,
    unchecked: !!(h4.unchecked || d1.unchecked),
    reason: null
  };
  try{
    if (h4.unchecked || d1.unchecked) return out;
    out.conflict = !!(h4.bull && d1.bear) || !!(h4.bear && d1.bull);
    if (out.conflict){
      out.scalpLocked = true;
      out.swingOnly = true;
      out.scalpLongOk = false;
      out.scalpShortOk = false;
      out.reason = 'MTF CONFLICT — Daily and H4 disagree; scalp locked, Gold Wing only';
      return out;
    }
    out.scalpLongOk = !!(h4.bull && d1.bull);
    if (!out.scalpLongOk)
      out.reason = 'MTF BIAS — scalp longs need H4 and Daily price > EMA20 > EMA50';
    return out;
  }catch(e){ return out; }
}

function hgGoldEma50Above(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 52) return null;
    var closes = __closes(rows);
    var e = _ema(closes, 50);
    var last = closes[closes.length - 1];
    var ev = e[e.length - 1];
    if (!isFinite(last) || !isFinite(ev)) return null;
    return last > ev;
  }catch(e){ return null; }
}

function hgGoldDisplacementBar(rows, dir, look){
  var out = { ok: false, index: null, range: 0, atr: 0, bars: 0 };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 16) return out;
    look = isFinite(look) ? look : 16;
    var n = rows.length;
    var aArr = _atr(rows, 14);
    var lastAtr = aArr[n - 1];
    if (!isFinite(lastAtr) || !(lastAtr > 0)) return out;
    out.atr = lastAtr;
    var start = Math.max(1, n - look);
    var best = null;
    var i, len, j, hi, lo, first, last, rng;
    for (i = start; i < n; i++){
      for (len = 1; len <= 3; len++){
        if (i + len > n) continue;
        hi = -Infinity; lo = Infinity;
        for (j = i; j < i + len; j++){
          if (rows[j].h > hi) hi = rows[j].h;
          if (rows[j].l < lo) lo = rows[j].l;
        }
        rng = hi - lo;
        if (!(rng >= lastAtr * 1.5)) continue;
        first = rows[i]; last = rows[i + len - 1];
        var bull = dir === 'long' && last.c > first.o;
        var bear = dir === 'short' && last.c < first.o;
        if (!bull && !bear) continue;
        var cand = { ok: true, index: i + len - 1, startIndex: i, range: rng, atr: lastAtr, bars: len };
        if (!best || rng > best.range) best = cand;
      }
    }
    if (best) return best;
    return out;
  }catch(e){ return out; }
}

function hgGoldIfvg(rows, dir, afterIndex){
  var miss = { ok: false, kind: null };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 5) return miss;
    var n = rows.length;
    var start = Math.max(1, isFinite(afterIndex) ? afterIndex : n - 14);
    var wantBull = dir === 'long';
    var gaps = goldFVG(rows) || [];
    var gi, g;
    for (gi = 0; gi < gaps.length; gi++){
      g = gaps[gi];
      if (!g) continue;
      var aligned = wantBull ? (g.dir === 'bullish') : (g.dir === 'bearish');
      if (aligned) return { ok: true, kind: 'FVG', gap: g };
    }
    for (var i = start; i < n - 1; i++){
      var a = rows[i - 1], b = rows[i + 1];
      if (!a || !b) continue;
      if (wantBull && b.l > a.h) return { ok: true, kind: 'FVG', i: i, top: b.l, bottom: a.h };
      if (!wantBull && b.h < a.l) return { ok: true, kind: 'FVG', i: i, top: a.l, bottom: b.h };
    }
    var last = rows[n - 1];
    var scanFrom = Math.max(1, n - 18);
    for (i = scanFrom; i < n - 1; i++){
      a = rows[i - 1]; b = rows[i + 1];
      if (!a || !b || !last) continue;
      if (wantBull && b.h < a.l && last.c > a.l)
        return { ok: true, kind: 'IFVG', i: i, top: a.l, bottom: b.h };
      if (!wantBull && b.l > a.h && last.c < a.h)
        return { ok: true, kind: 'IFVG', i: i, top: b.l, bottom: a.h };
    }
    return miss;
  }catch(e){ return miss; }
}

function hgGoldSweepConfirmed(rows, dir){
  var out = { ok: false, mss: false, displacement: false, ifvg: false, reason: '' };
  try{
    rows = __rows(rows);
    if (!rows){
      out.reason = 'SWEEP BLOCK — need MSS+displacement+IFVG (missing tape)';
      return out;
    }
    var ms = goldMarketStructure(rows);
    var want = dir === 'long' ? 'bullish' : 'bearish';
    var mssStruct = !!(ms && (ms.bos || ms.choch) && ms.trend === want);
    var sw = goldSweeps(rows);
    var sweepDir = sw && sw.dir ? (sw.dir === 'bullish' ? 'long' : 'short') : null;
    var sweepReclaim = sweepDir === dir && sw.barsAgo !== null && sw.barsAgo <= 12;
    var disp = hgGoldDisplacementBar(rows, dir, 16);
    out.displacement = !!disp.ok;
    /* A sweep reclaim is the structure shift; it is not enough by itself —
       displacement + IFVG still have to print after the grab. */
    out.mss = mssStruct || sweepReclaim;
    var after = disp.ok ? (isFinite(disp.startIndex) ? disp.startIndex : disp.index) : (rows.length - 10);
    var ifvg = hgGoldIfvg(rows, dir, after);
    out.ifvg = !!ifvg.ok;
    out.ok = out.mss && out.displacement && out.ifvg;
    if (!out.ok){
      var miss = [];
      if (!out.mss) miss.push('MSS');
      if (!out.displacement) miss.push('displacement');
      if (!out.ifvg) miss.push('IFVG');
      out.reason = 'SWEEP BLOCK — need MSS+displacement+IFVG (missing ' + miss.join('+') + ')';
    }
    return out;
  }catch(e){
    out.reason = 'SWEEP BLOCK — need MSS+displacement+IFVG';
    return out;
  }
}

function hgGoldObVolumeOk(rows, impulseIndex, lookback){
  var out = { ok: false, trap: false, vol: 0, avg: 0, reason: '', unchecked: false };
  try{
    rows = __rows(rows);
    lookback = lookback || 5;
    if (!rows || impulseIndex == null || impulseIndex < 0 || impulseIndex >= rows.length){
      out.trap = true;
      out.reason = 'OB TRAP — no displacement bar';
      return out;
    }
    var vol = +rows[impulseIndex].v || 0;
    out.vol = vol;
    var start = Math.max(0, impulseIndex - lookback);
    var sum = 0, n = 0, minV = Infinity, maxV = -Infinity;
    for (var i = start; i < impulseIndex; i++){
      var v = +rows[i].v || 0;
      sum += v; n++;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    out.avg = n ? sum / n : 0;
    if (n < 3 || !(out.avg > 0)){
      out.unchecked = true;
      out.ok = true;
      return out;
    }
    if (isFinite(minV) && isFinite(maxV) && (maxV - minV) < 1e-9 && Math.abs(vol - out.avg) < 1e-9){
      out.unchecked = true;
      out.ok = true;
      return out;
    }
    if (vol > out.avg){
      out.ok = true;
      return out;
    }
    out.trap = true;
    out.reason = 'OB TRAP — displacement volume ≤ 5-bar average';
    return out;
  }catch(e){
    out.unchecked = true;
    out.ok = true;
    return out;
  }
}

function hgGoldImpulseVolIndex(rows, disp){
  try{
    if (!disp || !disp.ok || !rows) return disp && disp.index;
    var lo = isFinite(disp.startIndex) ? disp.startIndex : disp.index;
    var hi = disp.index;
    if (!isFinite(lo) || !isFinite(hi)) return disp.index;
    if (lo > hi){ var tmp = lo; lo = hi; hi = tmp; }
    var maxIdx = hi, maxV = -1;
    for (var i = lo; i <= hi && i < rows.length; i++){
      var v = +rows[i].v || 0;
      if (v >= maxV){ maxV = v; maxIdx = i; }
    }
    return maxIdx;
  }catch(e){ return disp && disp.index; }
}

function hgGoldMacroLock(dir, ctx){
  var out = { lock: false, reason: '', dxyBull: null, tnxBull: null, unchecked: false };
  try{
    if (dir !== 'long') return out;
    ctx = ctx || {};
    var dxyBull = null, tnxBull = null;
    if (ctx.dxyRows && ctx.dxyRows.length >= 52) dxyBull = hgGoldEma50Above(ctx.dxyRows);
    else if (ctx.macro && ctx.macro.dxy && ctx.macro.dxy.trend20 === 'RISING') dxyBull = true;
    else if (ctx.macro && ctx.macro.dxy && ctx.macro.dxy.trend20 === 'FALLING') dxyBull = false;
    else if (ctx.macro && ctx.macro.trend20 === 'RISING') dxyBull = true;
    else if (ctx.macro && ctx.macro.trend20 === 'FALLING') dxyBull = false;

    if (ctx.tnxRows && ctx.tnxRows.length >= 52) tnxBull = hgGoldEma50Above(ctx.tnxRows);
    else if (ctx.macro && ctx.macro.tnxTrend === 'RISING') tnxBull = true;
    else if (ctx.macro && ctx.macro.tnxTrend === 'FALLING') tnxBull = false;

    out.dxyBull = dxyBull;
    out.tnxBull = tnxBull;
    if (dxyBull == null && tnxBull == null){
      out.unchecked = true;
      return out;
    }
    if (dxyBull === true && tnxBull === true){
      out.lock = true;
      out.reason = 'CONVICTION LOCK — DXY+TNX bullish vs gold long';
    }
    return out;
  }catch(e){
    out.unchecked = true;
    return out;
  }
}

function hgGoldSessionGate(nowMs, rows, stratKey, opt){
  var out = { ok: true, reject: false, demote: false, weight: 1, reason: '', session: 'OFF', asianSweep: false };
  try{
    opt = opt || {};
    var ms = __toMs(nowMs);
    if (!isFinite(ms)) ms = Date.now();
    var d = new Date(ms);
    var h = d.getUTCHours() + d.getUTCMinutes() / 60;
    if (h >= 8 && h < 9){ out.session = 'LONDON_OPEN'; out.weight = 3; }
    else if (h >= 12 && h < 16){ out.session = 'NY_OVERLAP'; out.weight = 3; }
    else if (h >= 7 && h < 10){ out.session = 'LONDON'; out.weight = 2; }
    else if (h >= 10 && h < 12){ out.session = 'NY_AM'; out.weight = 2; }
    else if (h >= 16 && h < 20){ out.session = 'NY_PM'; out.weight = 1; }
    else if (h >= 0 && h < 8){ out.session = 'ASIAN'; out.weight = 0; }
    else { out.session = 'OFF'; out.weight = 0; }

    if (out.session !== 'ASIAN') return out;

    var asianStrat = stratKey === 'asian';
    var violent = !!opt.violentAsianSweep || stratKey === 'sweep';
    if (asianStrat){
      out.weight = 1;
      return out;
    }
    if (violent){
      var box = goldAsianRange(rows);
      var last = rows && rows.length ? rows[rows.length - 1] : null;
      var hit = !box || !last || (last.l <= box.lo) || (last.h >= box.hi) || stratKey === 'sweep';
      if (hit){
        out.asianSweep = true;
        out.weight = 1;
        return out;
      }
    }
    var hard = opt.hardReject !== false;
    if (!hard){
      out.demote = true;
      out.reason = 'ASIA SESSION — standard execution demoted (4h bars span the Asian box)';
      return out;
    }
    out.ok = false;
    out.reject = true;
    out.reason = 'ASIA BLOCK — no violent AH/AL sweep';
    return out;
  }catch(e){ return out; }
}

function hgGoldInstFilter(cand, ctx){
  try{
    if (!cand) return cand;
    ctx = ctx || {};
    var rows = ctx.rows;
    var dir = cand.dir;
    var key = cand.stratKey;
    var scalp = ctx.scalp !== false;
    var newsG = hgGoldNewsGate(ctx.news, ctx.nowMs);
    cand.newsGate = newsG;
    if (newsG.lock){
      cand.dropped = true;
      cand.reason = newsG.reason;
      return cand;
    }
    var spr = hgGoldSpreadLock({
      spreadUsd: ctx.spreadUsd,
      spread: ctx.spread,
      spreadPoints: ctx.spreadPoints,
      spreadUnit: ctx.spreadUnit,
      bid: ctx.bid,
      ask: ctx.ask,
      l2OrderBook: ctx.l2OrderBook
    });
    cand.spreadLock = spr;
    if (spr.lock){
      cand.dropped = true;
      cand.reason = spr.reason;
      return cand;
    }
    if (scalp){
      var mtf = hgGoldMtfMatrix({
        rows4h: ctx.rows4h,
        rows1d: ctx.rows1d || ctx.dailyCandles
      });
      cand.mtf = mtf;
      if (mtf.scalpLocked){
        cand.dropped = true;
        cand.reason = mtf.reason;
        return cand;
      }
      if (dir === 'long' && mtf.scalpLongOk === false){
        cand.dropped = true;
        cand.reason = mtf.reason;
        return cand;
      }
    }
    var sess = hgGoldSessionGate(ctx.nowMs, rows, key, {
      hardReject: scalp && ctx.hardReject !== false,
      violentAsianSweep: ctx.violentAsianSweep
    });
    cand.sessionGate = sess;
    if (isFinite(sess.weight)) cand.sessionWeight = sess.weight;
    cand.stopFloorAtr = 1.5;
    if (sess.ok === false){
      cand.dropped = true;
      cand.reason = sess.reason;
      return cand;
    }
    if (sess.demote){
      cand.demoted = true;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      if (cand.stamps.indexOf('ASIA SESSION') < 0) cand.stamps.push('ASIA SESSION');
      var gn = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
      gn.push(sess.reason);
      cand.gateNotes = gn;
    }
    var macro = hgGoldMacroLock(dir, {
      dxyRows: ctx.dxyRows || (ctx.macro && ctx.macro.dxyRows),
      tnxRows: ctx.tnxRows || (ctx.macro && ctx.macro.tnxRows),
      macro: ctx.macro
    });
    cand.macroLock = macro;
    if (macro.lock){
      cand.dropped = true;
      cand.reason = macro.reason;
      return cand;
    }
    if (key === 'sweep'){
      var sw = hgGoldSweepConfirmed(rows, dir);
      cand.sweepConfirm = sw;
      if (!sw.ok){
        cand.dropped = true;
        cand.reason = sw.reason;
        return cand;
      }
      var disp = hgGoldDisplacementBar(rows, dir, 16);
      if (disp.ok){
        var volIdx = hgGoldImpulseVolIndex(rows, disp);
        var volSw = hgGoldObVolumeOk(rows, volIdx, 5);
        cand.obVol = volSw;
        if (!volSw.ok){
          cand.dropped = true;
          cand.reason = volSw.reason;
          return cand;
        }
      }
    }
    if (key === 'ob'){
      var idx = cand.obImpulseIndex;
      if (idx == null || idx < 0 || !rows || idx >= rows.length){
        var d2 = hgGoldDisplacementBar(rows, dir, 20);
        idx = hgGoldImpulseVolIndex(rows, d2);
      }
      var obv = hgGoldObVolumeOk(rows, idx, 5);
      cand.obVol = obv;
      if (!obv.ok){
        cand.dropped = true;
        cand.reason = obv.reason;
        return cand;
      }
    }
    return cand;
  }catch(e){ return cand; }
}

/* =========================================================================
   FORMING LAYERS (hg-v553) — shared stack for GOLD SCALP / GOLD SWING /
   OMNIGOLD. Regime gates everything. Structure + sweep+displacement triggers
   mint forming watches. RSI divergence is FOLKLORE (never confluence). Thin
   venue volume-profile is informational only. Fix-time reversion is demoted.
   Asia box is 00:00–08:00 UTC. Redundancy: Kaufman ER is the sole regime
   separator (vol percentile labels only; ADX/BB not co-scored).
========================================================================= */

var HG_GOLD_FORM_ER_MR = 0.30;
var HG_GOLD_FORM_ER_TREND = 0.60;
var HG_GOLD_FORM_SWEEP_ATR = 0.15;
var HG_GOLD_FORM_RVOL_MIN = 1.25;
var HG_GOLD_FORM_RVOL_ASIA = 1.50;

function hgGoldAtrVolPercentile(rows, period, trail){
  var out = { atr: NaN, pctile: NaN, regime: 'unchecked' };
  try{
    rows = __rows(rows);
    period = period || 14;
    trail = trail || 100;
    if (!rows || rows.length < period + 5) return out;
    var atrs = _atr(rows, period);
    var cur = atrs[atrs.length - 1];
    if (!isFinite(cur) || !(cur > 0)) return out;
    out.atr = cur;
    var start = Math.max(period, atrs.length - trail);
    var below = 0, n = 0, i;
    for (i = start; i < atrs.length; i++){
      if (!isFinite(atrs[i]) || !(atrs[i] > 0)) continue;
      n++;
      if (atrs[i] <= cur) below++;
    }
    if (!n) return out;
    out.pctile = below / n;
    out.regime = (out.pctile >= 0.75) ? 'expansion' : ((out.pctile <= 0.25) ? 'drift' : 'normal');
    return out;
  }catch(e){ return out; }
}

function hgGoldReturns(rows){
  var out = [];
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return out;
    var i, a, b;
    for (i = 1; i < rows.length; i++){
      a = rows[i - 1].c; b = rows[i].c;
      if (isFinite(a) && a > 0 && isFinite(b) && b > 0) out.push((b - a) / a);
    }
  }catch(e){}
  return out;
}

function hgGoldRollingCorr(a, b, win){
  try{
    win = win || 20;
    if (!a || !b || a.length < win || b.length < win) return NaN;
    var n = Math.min(a.length, b.length);
    var xa = a.slice(n - win), xb = b.slice(n - win);
    var i, ma = 0, mb = 0;
    for (i = 0; i < win; i++){ ma += xa[i]; mb += xb[i]; }
    ma /= win; mb /= win;
    var num = 0, da = 0, db = 0;
    for (i = 0; i < win; i++){
      var va = xa[i] - ma, vb = xb[i] - mb;
      num += va * vb; da += va * va; db += vb * vb;
    }
    if (!(da > 0) || !(db > 0)) return NaN;
    return num / Math.sqrt(da * db);
  }catch(e){ return NaN; }
}

function hgGoldDxyCorr(goldRows, dxyRows, win){
  var out = { corr: NaN, prior: NaN, breakdown: false, unchecked: true };
  try{
    win = win || 20;
    var g = hgGoldReturns(goldRows), d = hgGoldReturns(dxyRows);
    if (g.length < win + 5 || d.length < win + 5) return out;
    out.corr = hgGoldRollingCorr(g, d, win);
    out.prior = hgGoldRollingCorr(g.slice(0, g.length - 5), d.slice(0, d.length - 5), win);
    out.unchecked = !(isFinite(out.corr));
    /* Breakdown: |corr| was meaningful and collapsed, or sign flipped hard. */
    if (isFinite(out.corr) && isFinite(out.prior)){
      out.breakdown = (Math.abs(out.prior) >= 0.35 && Math.abs(out.corr) < 0.15)
        || (out.prior * out.corr < 0 && Math.abs(out.prior) >= 0.30);
    }
    return out;
  }catch(e){ return out; }
}

function hgGoldRealYieldBias(macro){
  var out = { bias: 'neutral', dir: null, unchecked: true, reason: '', source: null };
  try{
    macro = macro || {};
    /* Prefer measured FRED DFII10 when present (daily bias gate). */
    var rr = macro.realRateMeasured;
    if (rr && rr.measured && rr.trend){
      var tr0 = String(rr.trend).toUpperCase();
      out.source = 'fred-dfii10';
      if (tr0.indexOf('FALL') >= 0){
        out.bias = 'gold-supportive'; out.dir = 'long'; out.unchecked = false;
        out.reason = 'FRED DFII10 falling — real-yield opportunity cost easing';
        return out;
      }
      if (tr0.indexOf('RISE') >= 0){
        out.bias = 'gold-headwind'; out.dir = 'short'; out.unchecked = false;
        out.reason = 'FRED DFII10 rising — gold opportunity cost rising';
        return out;
      }
    }
    var tip = macro.dfii10Trend || macro.tipsTrend || '';
    tip = String(tip).toUpperCase();
    if (tip.indexOf('FALL') >= 0 || tip === 'DOWN'){
      out.bias = 'gold-supportive'; out.dir = 'long'; out.unchecked = false;
      out.source = 'dfii10Trend';
      out.reason = 'real yields falling — opportunity-cost headwind easing';
      return out;
    }
    if (tip.indexOf('RISE') >= 0 || tip === 'UP'){
      out.bias = 'gold-headwind'; out.dir = 'short'; out.unchecked = false;
      out.source = 'dfii10Trend';
      out.reason = 'real yields rising — gold opportunity cost rising';
      return out;
    }
    var trend = String(macro.tnxTrend || macro.realYieldTrend || macro.us10yTrend || '').toUpperCase();
    if (trend.indexOf('FALL') >= 0){
      out.bias = 'gold-supportive'; out.dir = 'long'; out.unchecked = false;
      out.source = 'us10y-proxy';
      out.reason = 'US10Y trend falling (proxy when TIPS unread)';
      return out;
    }
    if (trend.indexOf('RISE') >= 0){
      out.bias = 'gold-headwind'; out.dir = 'short'; out.unchecked = false;
      out.source = 'us10y-proxy';
      out.reason = 'US10Y trend rising (proxy when TIPS unread)';
      return out;
    }
    return out;
  }catch(e){ return out; }
}

/** Fed trade-weighted dollar (DTWEXBGS) daily bias — slow filter, not a trigger. */
function hgGoldDollarBias(macro){
  var out = { bias: 'neutral', dir: null, unchecked: true, reason: '', source: null };
  try{
    macro = macro || {};
    var off = macro.dxyOfficial || macro.dtwexbgs || null;
    var trend = '';
    if (off && off.trend20){ trend = String(off.trend20).toUpperCase(); out.source = 'fred-dtwexbgs'; }
    else if (macro.dxy && macro.dxy.trend20){ trend = String(macro.dxy.trend20).toUpperCase(); out.source = 'dxy-proxy'; }
    else if (macro.dxyTrend){ trend = String(macro.dxyTrend).toUpperCase(); out.source = 'dxyTrend'; }
    if (trend.indexOf('FALL') >= 0 || trend === 'DOWN'){
      out.bias = 'gold-supportive'; out.dir = 'long'; out.unchecked = false;
      out.reason = 'dollar softening (' + out.source + ') — gold long bias';
      return out;
    }
    if (trend.indexOf('RIS') >= 0 || trend === 'UP'){
      out.bias = 'gold-headwind'; out.dir = 'short'; out.unchecked = false;
      out.reason = 'dollar firming (' + out.source + ') — gold long headwind';
      return out;
    }
    return out;
  }catch(e){ return out; }
}

/* Sole regime separator = Kaufman ER. Vol percentile is a label only. */
function hgGoldFormingRegime(inp){
  inp = inp || {};
  var out = {
    er: NaN, style: 'mixed', vol: null, dxy: null, yieldBias: null, dollarBias: null,
    allowContinuation: true, allowMeanRev: true, ok: true, why: '', stamps: []
  };
  try{
    var rows = __rows(inp.rows || inp.rows15m || inp.rows4h);
    var ker = calculateKaufmanER(rows, 20);
    out.er = ker && isFinite(ker.er) ? ker.er : NaN;
    out.vol = hgGoldAtrVolPercentile(rows, 14, 100);
    out.dxy = hgGoldDxyCorr(rows, inp.dxyRows || (inp.macro && inp.macro.dxyRows), 20);
    out.yieldBias = hgGoldRealYieldBias(inp.macro);
    out.dollarBias = hgGoldDollarBias(inp.macro);
    if (isFinite(out.er)){
      if (out.er < HG_GOLD_FORM_ER_MR){
        out.style = 'mean-rev';
        out.allowContinuation = false;
        out.why = 'ER ' + out.er.toFixed(2) + ' < ' + HG_GOLD_FORM_ER_MR + ' — mean-reversion setups only';
        out.stamps.push('REGIME MR');
      } else if (out.er >= HG_GOLD_FORM_ER_TREND){
        out.style = 'trend';
        out.allowMeanRev = false;
        out.why = 'ER ' + out.er.toFixed(2) + ' ≥ ' + HG_GOLD_FORM_ER_TREND + ' — continuation setups only';
        out.stamps.push('REGIME TREND');
      } else {
        out.style = 'mixed';
        out.why = 'ER ' + out.er.toFixed(2) + ' mixed — both families allowed with demotion';
      }
    } else {
      out.why = 'ER unread — fail-open';
      out.stamps.push('REGIME UNCHECKED');
    }
    if (out.vol && out.vol.regime === 'expansion') out.stamps.push('VOL EXPANSION');
    if (out.vol && out.vol.regime === 'drift') out.stamps.push('VOL DRIFT');
    if (out.dxy && out.dxy.breakdown){
      out.stamps.push('DXY DECOUPLE');
      out.why += (out.why ? ' · ' : '') + 'gold–DXY correlation broke down — dollar signals quiet';
    }
    if (out.yieldBias && !out.yieldBias.unchecked && out.yieldBias.reason){
      out.stamps.push(out.yieldBias.bias === 'gold-supportive' ? 'REAL YIELD FALLING' : 'REAL YIELD RISING');
    }
    if (out.dollarBias && !out.dollarBias.unchecked && out.dollarBias.reason){
      out.stamps.push(out.dollarBias.bias === 'gold-supportive' ? 'DOLLAR SOFT' : 'DOLLAR FIRM');
    }
    return out;
  }catch(e){ return out; }
}

function hgGoldPriorDayLevels(rows){
  var out = { hi: NaN, lo: NaN, close: NaN, ok: false };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 10) return out;
    var last = rows[rows.length - 1];
    if (!last || !isFinite(last.t)) return out;
    var day = Math.floor(last.t / 86400);
    var prev = day - 1;
    var hi = -Infinity, lo = Infinity, c = NaN, i, saw = false;
    for (i = 0; i < rows.length; i++){
      var r = rows[i];
      if (!r || !isFinite(r.t)) continue;
      if (Math.floor(r.t / 86400) !== prev) continue;
      saw = true;
      if (r.h > hi) hi = r.h;
      if (r.l < lo) lo = r.l;
      c = r.c;
    }
    if (!saw || !(hi > lo)) return out;
    out.hi = hi; out.lo = lo; out.close = c; out.ok = true;
    return out;
  }catch(e){ return out; }
}

function hgGoldEqualExtremes(rows, atrMul){
  var out = { highs: [], lows: [] };
  try{
    rows = __rows(rows);
    atrMul = isFinite(atrMul) ? atrMul : 0.12;
    if (!rows || rows.length < 40) return out;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!isFinite(atr) || !(atr > 0)) return out;
    var tol = atr * atrMul;
    var pivH = [], pivL = [], i, j;
    for (i = 2; i < rows.length - 2; i++){
      if (rows[i].h >= rows[i-1].h && rows[i].h >= rows[i-2].h
          && rows[i].h >= rows[i+1].h && rows[i].h >= rows[i+2].h)
        pivH.push({ i: i, v: rows[i].h });
      if (rows[i].l <= rows[i-1].l && rows[i].l <= rows[i-2].l
          && rows[i].l <= rows[i+1].l && rows[i].l <= rows[i+2].l)
        pivL.push({ i: i, v: rows[i].l });
    }
    function cluster(list, dest){
      for (i = 0; i < list.length; i++){
        for (j = i + 1; j < list.length; j++){
          if (Math.abs(list[i].v - list[j].v) <= tol && Math.abs(list[i].i - list[j].i) >= 3){
            dest.push({ level: (list[i].v + list[j].v) / 2, a: list[i].i, b: list[j].i });
            return;
          }
        }
      }
    }
    cluster(pivH.slice(-8), out.highs);
    cluster(pivL.slice(-8), out.lows);
    return out;
  }catch(e){ return out; }
}

/* =========================================================================
   SMC LIQUIDITY (hg-v564) — port of joshyattridge/smart-money-concepts
   `swing_highs_lows` + `liquidity` (browser JS; no Python import).
   Clusters swing highs/lows within rangePercent of the full H–L range;
   returns Level · End · Swept index (0 = unswept).
   bos_choch close_break: displacement vs wick — see hgGoldSmcBosChoch.
========================================================================= */

var HG_GOLD_SMC_RANGE_PCT = 0.01;
var HG_GOLD_SMC_SWING_LEN = 50;
var HG_GOLD_SMC_SWEPT_MAX_AGE = 8; /* bars since Swept for live reclaim setups */

/**
 * Fractal swings matching SMC swing_highs_lows(swing_length).
 * Returns { highLow: Float32Array|null[], level: Float32Array|null[], swings: [{i,highLow,level}] }.
 * highLow: +1 swing high, −1 swing low.
 */
function hgGoldSmcSwingHighsLows(rows, swingLength){
  var empty = { highLow: [], level: [], swings: [] };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 10) return empty;
    var n = rows.length;
    var win = Math.max(2, Math.floor(isFinite(swingLength) ? swingLength : HG_GOLD_SMC_SWING_LEN) * 2);
    var half = Math.floor(win / 2);
    if (n < win + 1) return empty;
    var highLow = new Array(n);
    var level = new Array(n);
    var i, j, k, hiMax, loMin, ok;
    for (i = 0; i < n; i++){ highLow[i] = NaN; level[i] = NaN; }
    for (i = half; i < n - half; i++){
      hiMax = -Infinity; loMin = Infinity;
      for (j = i - half; j <= i + half; j++){
        if (rows[j].h > hiMax) hiMax = rows[j].h;
        if (rows[j].l < loMin) loMin = rows[j].l;
      }
      if (rows[i].h === hiMax){ highLow[i] = 1; level[i] = rows[i].h; }
      else if (rows[i].l === loMin){ highLow[i] = -1; level[i] = rows[i].l; }
    }
    /* Drop consecutive same-side swings, keep the more extreme */
    while (true){
      var positions = [];
      for (i = 0; i < n; i++) if (!isNaN(highLow[i])) positions.push(i);
      if (positions.length < 2) break;
      var remove = new Array(positions.length);
      for (i = 0; i < remove.length; i++) remove[i] = false;
      var changed = false;
      for (k = 0; k < positions.length - 1; k++){
        var a = positions[k], b = positions[k + 1];
        if (highLow[a] === 1 && highLow[b] === 1){
          if (rows[a].h < rows[b].h){ remove[k] = true; changed = true; }
          else { remove[k + 1] = true; changed = true; }
        } else if (highLow[a] === -1 && highLow[b] === -1){
          if (rows[a].l > rows[b].l){ remove[k] = true; changed = true; }
          else { remove[k + 1] = true; changed = true; }
        }
      }
      if (!changed) break;
      for (k = 0; k < positions.length; k++){
        if (remove[k]){ highLow[positions[k]] = NaN; level[positions[k]] = NaN; }
      }
    }
    /* SMC end-point flip (same as upstream) */
    positions = [];
    for (i = 0; i < n; i++) if (!isNaN(highLow[i])) positions.push(i);
    if (positions.length){
      if (highLow[positions[0]] === 1){ highLow[0] = -1; level[0] = rows[0].l; }
      if (highLow[positions[0]] === -1){ highLow[0] = 1; level[0] = rows[0].h; }
      /* re-read after possible overwrite of index 0 */
      positions = [];
      for (i = 0; i < n; i++) if (!isNaN(highLow[i])) positions.push(i);
      if (positions.length){
        var lastP = positions[positions.length - 1];
        if (highLow[lastP] === -1){ highLow[n - 1] = 1; level[n - 1] = rows[n - 1].h; }
        if (highLow[lastP] === 1){ highLow[n - 1] = -1; level[n - 1] = rows[n - 1].l; }
      }
    }
    var swings = [];
    for (i = 0; i < n; i++){
      if (!isNaN(highLow[i])){
        swings.push({ i: i, highLow: highLow[i], level: level[i] });
      }
    }
    return { highLow: highLow, level: level, swings: swings };
  }catch(e){ return empty; }
}

/**
 * Cluster equal highs/lows within rangePercent of full chart range.
 * Liquidity +1 = buy-side (equal highs); −1 = sell-side (equal lows).
 * Swept = candle index that took the pool (0 = still unswept).
 */
function hgGoldSmcLiquidity(rows, opts){
  var out = {
    ok: false, pools: [], unswept: [], swept: [],
    rangePercent: HG_GOLD_SMC_RANGE_PCT, pipRange: NaN, swingLength: HG_GOLD_SMC_SWING_LEN
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40) return out;
    var rangePct = isFinite(opts.rangePercent) ? opts.rangePercent : HG_GOLD_SMC_RANGE_PCT;
    var swingLen = isFinite(opts.swingLength) ? opts.swingLength : HG_GOLD_SMC_SWING_LEN;
    out.rangePercent = rangePct;
    out.swingLength = swingLen;
    var shl = opts.swings || hgGoldSmcSwingHighsLows(rows, swingLen);
    if (!shl || !shl.highLow || !shl.highLow.length) return out;
    var n = rows.length;
    var hiMax = -Infinity, loMin = Infinity, i;
    for (i = 0; i < n; i++){
      if (rows[i].h > hiMax) hiMax = rows[i].h;
      if (rows[i].l < loMin) loMin = rows[i].l;
    }
    if (!(hiMax > loMin)) return out;
    var pipRange = (hiMax - loMin) * rangePct;
    out.pipRange = pipRange;
    var shlHL = shl.highLow.slice();
    var shlLevel = shl.level.slice();

    function collect(sideSign){
      var indices = [];
      for (i = 0; i < n; i++) if (shlHL[i] === sideSign) indices.push(i);
      var ii, jj, start, group, groupEnd, swept, cStart, rangeLow, rangeHigh, anchor;
      for (ii = 0; ii < indices.length; ii++){
        i = indices[ii];
        if (shlHL[i] !== sideSign) continue;
        anchor = shlLevel[i];
        rangeLow = anchor - pipRange;
        rangeHigh = anchor + pipRange;
        group = [anchor];
        groupEnd = i;
        swept = 0;
        cStart = i + 1;
        if (cStart < n){
          if (sideSign === 1){
            for (jj = cStart; jj < n; jj++){
              if (rows[jj].h >= rangeHigh){ swept = jj; break; }
            }
          } else {
            for (jj = cStart; jj < n; jj++){
              if (rows[jj].l <= rangeLow){ swept = jj; break; }
            }
          }
        }
        for (jj = 0; jj < indices.length; jj++){
          var j = indices[jj];
          if (j <= i) continue;
          if (swept && j >= swept) break;
          if (shlHL[j] === sideSign && shlLevel[j] >= rangeLow && shlLevel[j] <= rangeHigh){
            group.push(shlLevel[j]);
            groupEnd = j;
            shlHL[j] = 0;
          }
        }
        if (group.length > 1){
          var sum = 0, g;
          for (g = 0; g < group.length; g++) sum += group[g];
          var avg = sum / group.length;
          var pool = {
            liquidity: sideSign,
            side: sideSign === 1 ? 'buy-side' : 'sell-side',
            level: avg,
            startIdx: i,
            endIdx: groupEnd,
            sweptIdx: swept || 0,
            count: group.length,
            unswept: !(swept > 0),
            dirAfterSweep: sideSign === 1 ? 'short' : 'long'
          };
          out.pools.push(pool);
          if (pool.unswept) out.unswept.push(pool);
          else out.swept.push(pool);
        }
      }
    }
    collect(1);
    collect(-1);
    out.ok = out.pools.length > 0;
    return out;
  }catch(e){ return out; }
}

/**
 * Live setup from a recently swept SMC pool + close reclaim.
 * closeBreak mirrors bos_choch: when true, reclaim needs close back inside;
 * when false, a wick back inside is enough (weaker).
 */
function hgGoldSmcLiquidityHit(rows, opts){
  var out = {
    ok: false, potential: false, dir: null, level: NaN, pool: null,
    sweptAge: NaN, closeReclaim: false, closeBreak: true, why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40){ out.why = 'need ≥40 bars'; return out; }
    var closeBreak = opts.closeBreak !== false;
    out.closeBreak = closeBreak;
    var maxAge = isFinite(opts.maxAge) ? opts.maxAge : HG_GOLD_SMC_SWEPT_MAX_AGE;
    var smc = opts.smc || hgGoldSmcLiquidity(rows, opts);
    if (!smc || !smc.swept || !smc.swept.length){
      out.why = 'no swept SMC liquidity cluster';
      return out;
    }
    var n = rows.length;
    var best = null, bi, age, pool, px = rows[n - 1];
    for (bi = 0; bi < smc.swept.length; bi++){
      pool = smc.swept[bi];
      if (!(pool.sweptIdx > 0)) continue;
      age = n - 1 - pool.sweptIdx;
      if (age < 0 || age > maxAge) continue;
      if (!best || age < best.sweptAge){
        best = {
          pool: pool, sweptAge: age, dir: pool.dirAfterSweep, level: pool.level
        };
      }
    }
    if (!best){
      out.why = 'swept pools older than ' + maxAge + ' bars';
      return out;
    }
    out.potential = true;
    out.dir = best.dir;
    out.level = best.level;
    out.pool = best.pool;
    out.sweptAge = best.sweptAge;
    /* close_break=true → displacement reclaim (close back inside).
       close_break=false → wick reclaim (weaker — high/low only). */
    if (best.dir === 'long'){
      out.closeReclaim = closeBreak
        ? (px.c > best.level)
        : (px.l < best.level && px.h > best.level);
    } else {
      out.closeReclaim = closeBreak
        ? (px.c < best.level)
        : (px.h > best.level && px.l < best.level);
    }
    if (!out.closeReclaim){
      out.why = (closeBreak ? 'close' : 'wick') + ' has not reclaimed SMC pool '
        + best.level.toFixed(2) + ' after sweep (age ' + best.sweptAge + ')';
      return out;
    }
    out.ok = true;
    out.why = 'SMC ' + best.pool.side + ' pool ~' + best.level.toFixed(2)
      + ' · n=' + best.pool.count
      + ' · swept ' + best.sweptAge + ' bar(s) ago'
      + ' · ' + (closeBreak ? 'close' : 'wick') + ' reclaim → ' + String(best.dir).toUpperCase();
    return out;
  }catch(e){ out.why = 'SMC liquidity hit error'; return out; }
}

/**
 * Lightweight BOS/CHoCH break-mode helper (SMC bos_choch close_break flag).
 * closeBreak=true → structure break by close (displacement).
 * closeBreak=false → structure break by high/low wick (weaker).
 */
function hgGoldSmcBosChoch(rows, opts){
  var out = {
    ok: false, bos: null, choch: null, level: NaN, brokenIdx: -1,
    closeBreak: true, mode: 'close', why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 30){ out.why = 'need ≥30 bars'; return out; }
    var closeBreak = opts.closeBreak !== false;
    out.closeBreak = closeBreak;
    out.mode = closeBreak ? 'close' : 'wick';
    var swingLen = isFinite(opts.swingLength) ? opts.swingLength : 20;
    var shl = opts.swings || hgGoldSmcSwingHighsLows(rows, swingLen);
    var swings = (shl && shl.swings) ? shl.swings : [];
    if (swings.length < 4){ out.why = 'need ≥4 SMC swings'; return out; }
    var n = rows.length;
    var last4 = swings.slice(-4);
    var hl = last4.map(function(s){ return s.highLow; });
    var lv = last4.map(function(s){ return s.level; });
    var bullSeq = hl[0] === -1 && hl[1] === 1 && hl[2] === -1 && hl[3] === 1;
    var bearSeq = hl[0] === 1 && hl[1] === -1 && hl[2] === 1 && hl[3] === -1;
    var breakLevel = NaN, kind = null, sign = 0;
    if (bullSeq && lv[0] < lv[2] && lv[2] < lv[1] && lv[1] < lv[3]){
      /* HH + HL continuation → bullish BOS of prior swing high */
      kind = 'bos'; sign = 1; breakLevel = lv[1];
    } else if (bearSeq && lv[0] > lv[2] && lv[2] > lv[1] && lv[1] > lv[3]){
      kind = 'bos'; sign = -1; breakLevel = lv[1];
    } else if (bullSeq && lv[3] > lv[1] && lv[1] > lv[0] && lv[0] > lv[2]){
      kind = 'choch'; sign = 1; breakLevel = lv[1];
    } else if (bearSeq && lv[3] < lv[1] && lv[1] < lv[0] && lv[0] < lv[2]){
      kind = 'choch'; sign = -1; breakLevel = lv[1];
    }
    if (!kind || !isFinite(breakLevel)){
      out.why = 'no SMC BOS/CHoCH pattern in last 4 swings';
      return out;
    }
    var start = last4[2].i + 1, bi, broken = -1;
    for (bi = start; bi < n; bi++){
      if (sign > 0){
        if (closeBreak ? (rows[bi].c > breakLevel) : (rows[bi].h > breakLevel)){ broken = bi; break; }
      } else {
        if (closeBreak ? (rows[bi].c < breakLevel) : (rows[bi].l < breakLevel)){ broken = bi; break; }
      }
    }
    if (broken < 0){
      out.why = 'SMC ' + kind.toUpperCase() + ' level ' + breakLevel.toFixed(2)
        + ' not yet broken (' + out.mode + ')';
      out.level = breakLevel;
      return out;
    }
    out.ok = true;
    out.level = breakLevel;
    out.brokenIdx = broken;
    if (kind === 'bos') out.bos = sign > 0 ? 'bullish' : 'bearish';
    else out.choch = sign > 0 ? 'bullish' : 'bearish';
    out.why = 'SMC ' + (out.bos || out.choch) + ' ' + kind.toUpperCase()
      + ' @ ' + breakLevel.toFixed(2) + ' · ' + out.mode + ' break'
      + ' · age ' + (n - 1 - broken);
    return out;
  }catch(e){ out.why = 'SMC BOS/CHoCH error'; return out; }
}

function hgGoldSmcLiquidityHtml(smc){
  try{
    smc = smc || {};
    var h = '<div class="note" data-hg-gold-smcliq="1" style="margin-top:8px">';
    h += '<b>SMC LIQUIDITY</b>';
    if (isFinite(smc.rangePercent))
      h += ' · band ' + (smc.rangePercent * 100).toFixed(1) + '% of range';
    if (isFinite(smc.pipRange))
      h += ' · ±' + smc.pipRange.toFixed(2);
    if (!(smc.pools && smc.pools.length)){
      h += '<div class="dim" style="margin-top:4px">no clustered swing pools</div></div>';
      return h;
    }
    var i, p, shown = 0;
    for (i = 0; i < smc.pools.length && shown < 4; i++){
      p = smc.pools[i];
      h += '<div style="margin-top:4px">'
        + String(p.side || '').toUpperCase()
        + ' · n=' + p.count
        + ' · ' + (+p.level).toFixed(2)
        + (        p.unswept
          ? ' · <b>UNSWEPT</b>'
          : (' · <b>SWEPT</b> idx ' + p.sweptIdx
            + (isFinite(smc._n) ? (' (age ' + (smc._n - 1 - p.sweptIdx) + ')') : '')))
        + (p.dirAfterSweep ? (' → ' + String(p.dirAfterSweep).toUpperCase() + ' on reclaim') : '')
        + '</div>';
      shown++;
    }
    if (smc.hit && smc.hit.ok){
      h += '<div style="margin-top:4px"><b>HIT ' + String(smc.hit.dir || '').toUpperCase() + '</b> — '
        + String(smc.hit.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

function hgGoldBarRvol(rows, idx, win){
  try{
    rows = __rows(rows);
    win = win || 20;
    if (!rows || idx < 0 || idx >= rows.length) return NaN;
    var v = rows[idx].v;
    if (!isFinite(v) || !(v > 0)) return NaN;
    var start = Math.max(0, idx - win), sum = 0, n = 0, i;
    for (i = start; i < idx; i++){
      if (isFinite(rows[i].v) && rows[i].v > 0){ sum += rows[i].v; n++; }
    }
    if (!n) return NaN;
    return v / (sum / n);
  }catch(e){ return NaN; }
}

/* Sweep + displacement: wick through pool, close back inside, RVOL gate.
   Displacement counted once (FVG created by the same bar is not a second vote). */
function hgGoldSweepDisplacement(rows, level, dir, opt){
  var out = {
    ok: false, potential: false, rvol: NaN, breachAtr: NaN,
    disp: false, closeReclaim: false, why: ''
  };
  try{
    opt = opt || {};
    rows = __rows(rows);
    if (!rows || rows.length < 25 || !isFinite(level)) return out;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!isFinite(atr) || !(atr > 0)) return out;
    var minBreach = (isFinite(opt.minAtr) ? opt.minAtr : HG_GOLD_FORM_SWEEP_ATR) * atr;
    var rvolMin = isFinite(opt.rvolMin) ? opt.rvolMin : HG_GOLD_FORM_RVOL_MIN;
    var bar = rows[rows.length - 1];
    var rvol = hgGoldBarRvol(rows, rows.length - 1, 20);
    out.rvol = rvol;
    var long = String(dir).toLowerCase() === 'long';
    var breach = long ? (level - bar.l) : (bar.h - level);
    out.breachAtr = breach / atr;
    if (!(breach >= minBreach)){
      out.why = 'wick breach < ' + (isFinite(opt.minAtr) ? opt.minAtr : HG_GOLD_FORM_SWEEP_ATR) + '×ATR — not a stop raid';
      return out;
    }
    out.potential = true;
    out.closeReclaim = long ? (bar.c > level) : (bar.c < level);
    if (!out.closeReclaim){
      out.why = 'wick through level but close accepted outside — breakout risk, not a reclaim';
      return out;
    }
    var range = bar.h - bar.l;
    out.disp = isFinite(range) && range >= 1.2 * atr
      && (long ? (bar.c > bar.o) : (bar.c < bar.o));
    if (isFinite(rvol) && rvol < rvolMin){
      out.why = 'RVOL ' + rvol.toFixed(2) + ' < ' + rvolMin + ' — low-participation wick';
      return out;
    }
    if (!out.disp){
      out.why = 'reclaim without displacement body — wait for wide-range close';
      return out;
    }
    out.ok = true;
    out.why = 'sweep + displacement'
      + (isFinite(rvol) ? (' · RVOL ' + rvol.toFixed(2)) : '')
      + ' · breach ' + out.breachAtr.toFixed(2) + '×ATR';
    return out;
  }catch(e){ return out; }
}

/* =========================================================================
   GOLD LIQUIDITY SWEEP ENGINE (hg-v555) — five components for SCALP/SWING/
   OMNIGOLD: liquidity map · ATR wick reclaim · MSS/CHoCH · VWAP · RVOL.
   RSI stays FOLKLORE (not scored). Thin-perp VP is location hint only.
   Confidence: 75+ alert · 65–74 watch · <65 ignore.
========================================================================= */

var HG_GOLD_SWEEP_ATR_MIN = 0.10;
var HG_GOLD_SWEEP_ATR_IDEAL = 0.25;
var HG_GOLD_SWEEP_ATR_SCALP = 0.15; /* Gold Ultra Scalp playbook */
var HG_GOLD_SWEEP_RVOL_MIN = 1.25; /* swing/general meaningful floor */
var HG_GOLD_SWEEP_RVOL_SCALP = 1.30; /* scalp alert floor */
var HG_GOLD_SWEEP_RVOL_ASIA = 1.50; /* raise Asia baseline */
var HG_GOLD_SWEEP_RVOL_RESPONSE = 1.10; /* stage-2 follow-through */
var HG_GOLD_SWEEP_RVOL_STRONG = 1.80;
var HG_GOLD_SWEEP_RVOL_BLOWOFF = 2.50;
var HG_GOLD_SWEEP_ALERT = 75;
var HG_GOLD_SWEEP_WATCH = 65;
var HG_GOLD_SWEEP_EQ_TOL = 0.12;
var HG_GOLD_SWEEP_RVOL_PROXY_NOTE =
  'RVOL from XAUT/PAXG/spot tick volume is PROXY — prefer COMEX GC when available';

function hgGoldRoundLevels(px, atr){
  var out = [];
  try{
    if (!isFinite(px) || !(px > 0)) return out;
    var step = (isFinite(atr) && atr > 5) ? 10 : 5;
    var base = Math.round(px / step) * step;
    out.push({ level: base, kind: 'round', label: 'ROUND ' + base.toFixed(0) });
    out.push({ level: base + step, kind: 'round', label: 'ROUND ' + (base + step).toFixed(0) });
    out.push({ level: base - step, kind: 'round', label: 'ROUND ' + (base - step).toFixed(0) });
    return out;
  }catch(e){ return out; }
}

function hgGoldPivotLevels(rows, leftBars, rightBars){
  var out = { highs: [], lows: [] };
  try{
    rows = __rows(rows);
    leftBars = leftBars || 3;
    rightBars = rightBars || 3;
    if (!rows || rows.length < leftBars + rightBars + 3) return out;
    var i, j, okH, okL;
    for (i = leftBars; i < rows.length - rightBars; i++){
      okH = true; okL = true;
      for (j = 1; j <= leftBars; j++){
        if (!(rows[i].h >= rows[i - j].h)) okH = false;
        if (!(rows[i].l <= rows[i - j].l)) okL = false;
      }
      for (j = 1; j <= rightBars; j++){
        if (!(rows[i].h >= rows[i + j].h)) okH = false;
        if (!(rows[i].l <= rows[i + j].l)) okL = false;
      }
      if (okH) out.highs.push({ level: rows[i].h, i: i, kind: 'pivot', label: '15m/1h PIVOT H' });
      if (okL) out.lows.push({ level: rows[i].l, i: i, kind: 'pivot', label: '15m/1h PIVOT L' });
    }
    out.highs = out.highs.slice(-6);
    out.lows = out.lows.slice(-6);
    return out;
  }catch(e){ return out; }
}

/** Liquidity-level map: Asia · PDH/PDL · equals · SMC clusters · pivots · round numbers. */
function hgGoldLiquidityMap(rows, opts){
  var out = { levels: [], atr: NaN, asia: null, priorDay: null, equals: null, smc: null };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var atrs = _atr(rows, 14);
    out.atr = atrs[atrs.length - 1];
    var px = rows[rows.length - 1].c;
    out.asia = goldAsianRange(rows);
    out.priorDay = hgGoldPriorDayLevels(rows);
    out.equals = hgGoldEqualExtremes(rows, opts.eqTol || HG_GOLD_SWEEP_EQ_TOL);
    out.smc = hgGoldSmcLiquidity(rows, {
      rangePercent: opts.smcRangePercent || HG_GOLD_SMC_RANGE_PCT,
      swingLength: opts.smcSwingLength || HG_GOLD_SMC_SWING_LEN
    });
    out.smc._n = rows.length;
    var piv = hgGoldPivotLevels(rows, opts.pivotL || 3, opts.pivotR || 3);
    function add(level, kind, label, side, extra){
      if (!isFinite(level)) return;
      var row = { level: level, kind: kind, label: label, side: side || null };
      if (extra) for (var ek in extra) if (Object.prototype.hasOwnProperty.call(extra, ek)) row[ek] = extra[ek];
      out.levels.push(row);
    }
    if (out.asia && isFinite(out.asia.hi)){
      add(out.asia.hi, 'asia', 'ASIA HIGH', 'buy-side');
      add(out.asia.lo, 'asia', 'ASIA LOW', 'sell-side');
    }
    if (out.priorDay && out.priorDay.ok){
      add(out.priorDay.hi, 'pdh', 'PRIOR DAY HIGH', 'buy-side');
      add(out.priorDay.lo, 'pdl', 'PRIOR DAY LOW', 'sell-side');
    }
    var ei;
    for (ei = 0; ei < (out.equals.highs || []).length; ei++)
      add(out.equals.highs[ei].level, 'equal', 'EQUAL HIGHS', 'buy-side');
    for (ei = 0; ei < (out.equals.lows || []).length; ei++)
      add(out.equals.lows[ei].level, 'equal', 'EQUAL LOWS', 'sell-side');
    if (out.smc && out.smc.pools){
      for (ei = 0; ei < out.smc.pools.length; ei++){
        var sp = out.smc.pools[ei];
        add(sp.level, 'smc',
          'SMC ' + (sp.side === 'buy-side' ? 'EQ HIGH' : 'EQ LOW')
            + (sp.unswept ? ' UNSWEPT' : ' SWEPT'),
          sp.side,
          { sweptIdx: sp.sweptIdx, endIdx: sp.endIdx, count: sp.count, unswept: sp.unswept });
      }
    }
    for (ei = 0; ei < piv.highs.length; ei++)
      add(piv.highs[ei].level, 'pivot', piv.highs[ei].label, 'buy-side');
    for (ei = 0; ei < piv.lows.length; ei++)
      add(piv.lows[ei].level, 'pivot', piv.lows[ei].label, 'sell-side');
    var rnd = hgGoldRoundLevels(px, out.atr);
    for (ei = 0; ei < rnd.length; ei++)
      add(rnd[ei].level, 'round', rnd[ei].label, null);
    /* Deduplicate near-identical levels within 0.05×ATR */
    var tol = (isFinite(out.atr) ? out.atr : 1) * 0.05;
    var uniq = [], ui, uj, keep;
    for (ui = 0; ui < out.levels.length; ui++){
      keep = true;
      for (uj = 0; uj < uniq.length; uj++){
        if (Math.abs(uniq[uj].level - out.levels[ui].level) <= tol){
          /* Prefer session/prior-day / SMC over round/pivot duplicates */
          var rank = { asia: 5, pdh: 5, pdl: 5, smc: 5, equal: 4, pivot: 3, round: 1 };
          if ((rank[out.levels[ui].kind] || 0) > (rank[uniq[uj].kind] || 0))
            uniq[uj] = out.levels[ui];
          keep = false; break;
        }
      }
      if (keep) uniq.push(out.levels[ui]);
    }
    out.levels = uniq;
    return out;
  }catch(e){ return out; }
}

/** Post-sweep MSS/CHoCH: break nearest opposing swing after reclaim. */
function hgGoldSweepMss(rows, dir){
  var out = { ok: false, kind: null, why: '' };
  try{
    rows = __rows(rows);
    dir = (dir === 'short') ? 'short' : 'long';
    if (!rows || rows.length < 30){ out.why = 'need ≥30 bars for MSS'; return out; }
    var bos = goldBOS(rows);
    var ms = (typeof goldMarketStructure === 'function') ? goldMarketStructure(rows) : null;
    if (dir === 'long'){
      if (bos && (bos.bos === 'bullish' || bos.choch === 'bullish')){
        out.ok = true; out.kind = bos.bos === 'bullish' ? 'BOS' : 'CHoCH';
        out.why = out.kind + ' bullish after sell-side sweep';
        return out;
      }
      if (ms && (ms.bos === 'bullish' || ms.choch === 'bullish' || ms.trend === 'bullish')){
        out.ok = true; out.kind = 'MSS';
        out.why = 'market structure bullish after sell-side sweep';
        return out;
      }
    } else {
      if (bos && (bos.bos === 'bearish' || bos.choch === 'bearish')){
        out.ok = true; out.kind = bos.bos === 'bearish' ? 'BOS' : 'CHoCH';
        out.why = out.kind + ' bearish after buy-side sweep';
        return out;
      }
      if (ms && (ms.bos === 'bearish' || ms.choch === 'bearish' || ms.trend === 'bearish')){
        out.ok = true; out.kind = 'MSS';
        out.why = 'market structure bearish after buy-side sweep';
        return out;
      }
    }
    out.why = 'no post-sweep MSS/CHoCH yet — wick is potential only';
    return out;
  }catch(e){ out.why = 'MSS unread'; return out; }
}

function hgGoldSweepVwap(rows, dir){
  var out = { ok: false, vwap: NaN, why: '', unchecked: false };
  try{
    rows = __rows(rows);
    dir = (dir === 'short') ? 'short' : 'long';
    var ai = goldSessionAnchor(rows);
    var vw = goldVWAP(rows, ai >= 0 ? ai : 0);
    if (!vw || !isFinite(vw.value)){
      out.unchecked = true; out.why = 'session VWAP unread — skip VWAP leg'; return out;
    }
    out.vwap = vw.value;
    var px = rows[rows.length - 1].c;
    if (dir === 'long'){
      out.ok = px >= vw.value;
      out.why = out.ok
        ? ('reclaimed/holds session VWAP ' + vw.value.toFixed(2))
        : ('still below session VWAP ' + vw.value.toFixed(2) + ' — no acceptance');
    } else {
      out.ok = px <= vw.value;
      out.why = out.ok
        ? ('rejects/holds below session VWAP ' + vw.value.toFixed(2))
        : ('still above session VWAP ' + vw.value.toFixed(2) + ' — no rejection');
    }
    return out;
  }catch(e){ out.unchecked = true; out.why = 'VWAP error'; return out; }
}

/**
 * Classify sweep RVOL into playbook bands.
 * <0.70 ignore · 0.70–1.00 watch · 1.00–1.25 mild · 1.25–1.80 good ·
 * 1.80–2.50 strong · >2.50 blowoff/news.
 */
function hgGoldSweepRvolBand(rvol){
  var out = { key: 'unread', label: 'RVOL unread', minEntry: false, caution: false };
  try{
    if (!isFinite(rvol)) return out;
    if (rvol < 0.70){ out.key = 'weak'; out.label = 'weak participation (<0.70)'; out.minEntry = false; }
    else if (rvol < 1.00){ out.key = 'quiet'; out.label = 'quiet/normal (0.70–1.00)'; out.minEntry = false; }
    else if (rvol < HG_GOLD_SWEEP_RVOL_MIN){ out.key = 'mild'; out.label = 'mildly above avg (1.00–1.25)'; out.minEntry = false; out.caution = true; }
    else if (rvol < HG_GOLD_SWEEP_RVOL_STRONG){ out.key = 'good'; out.label = 'meaningful participation (1.25–1.80)'; out.minEntry = true; }
    else if (rvol < HG_GOLD_SWEEP_RVOL_BLOWOFF){ out.key = 'strong'; out.label = 'strong stop-run (1.80–2.50)'; out.minEntry = true; }
    else { out.key = 'blowoff'; out.label = 'blowoff/news spike (>2.50)'; out.minEntry = false; out.caution = true; }
    return out;
  }catch(e){ return out; }
}

/**
 * Average RVOL across bars after the sweep (stage-2 follow-through).
 * Prefer session-slot RVOL when history allows; else rolling 20.
 */
function hgGoldSweepResponseRvol(rows, sweepIdx, look){
  var out = { rvol: NaN, bars: 0, pending: true, mode: 'none', why: '' };
  try{
    rows = __rows(rows);
    look = look || 3;
    if (!rows || sweepIdx < 0 || sweepIdx >= rows.length){ out.why = 'no sweep idx'; return out; }
    var end = Math.min(rows.length - 1, sweepIdx + look);
    if (end <= sweepIdx){
      out.pending = true;
      out.why = 'awaiting 1–3 response bars after sweep';
      return out;
    }
    var sum = 0, n = 0, i, rv, sr;
    for (i = sweepIdx + 1; i <= end; i++){
      sr = typeof hgGoldSessionRvol === 'function' ? hgGoldSessionRvol(rows, i, {}) : null;
      rv = (sr && isFinite(sr.rvol)) ? sr.rvol : hgGoldBarRvol(rows, i, 20);
      if (isFinite(rv)){ sum += rv; n++; }
    }
    if (!n){ out.why = 'response volume unread'; return out; }
    out.rvol = sum / n;
    out.bars = n;
    out.pending = false;
    out.mode = 'avg';
    out.why = 'response RVOL ' + out.rvol.toFixed(2) + ' over ' + n + ' bar(s)';
    return out;
  }catch(e){ out.why = 'response RVOL error'; return out; }
}

/**
 * Two-stage RVOL filter for gold liquidity sweeps.
 * Stage 1: sweep candle RVOL + ATR breach + close reclaim (ideally close in
 *   upper/lower third). Scalp mode uses RVOL≥1.30 and breach≥0.15×ATR.
 * Stage 2: next 1–3 bars avg RVOL ≥1.10 + structure/VWAP when available.
 * Distinguishes reversal vs breakout acceptance (incl. multi-bar acceptance).
 * Volume is labeled PROXY unless opts.comexVolume is true.
 */
function hgGoldSweepTwoStageRvol(rows, hit, opts){
  var out = {
    ok: false, stage1: false, stage2: false, pending: false,
    band: null, sweepRvol: NaN, responseRvol: NaN, profile: null,
    fake: false, fakeReason: '', why: '',
    closeThird: false, atrMin: HG_GOLD_SWEEP_ATR_MIN, rvolMin: HG_GOLD_SWEEP_RVOL_MIN,
    volumeNote: HG_GOLD_SWEEP_RVOL_PROXY_NOTE, scalp: false
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!hit){ out.why = 'no hit'; return out; }
    var scalp = !!(opts.scalp || opts.mode === 'scalp');
    out.scalp = scalp;
    if (opts.comexVolume) out.volumeNote = 'RVOL using COMEX GC volume';

    var rvolMin = isFinite(opts.rvolMin) ? opts.rvolMin
      : (scalp ? HG_GOLD_SWEEP_RVOL_SCALP : HG_GOLD_SWEEP_RVOL_MIN);
    var atrMin = isFinite(opts.atrMin) ? opts.atrMin
      : (scalp ? HG_GOLD_SWEEP_ATR_SCALP : HG_GOLD_SWEEP_ATR_MIN);
    out.atrMin = atrMin;
    out.rvolMin = rvolMin;

    /* Asia session: raise floor */
    var nowMs = opts.now || (rows && rows.length && isFinite(rows[rows.length-1].t)
      ? rows[rows.length-1].t * 1000 : Date.now());
    var hUTC = new Date(nowMs).getUTCHours();
    if (hUTC < 8) rvolMin = Math.max(rvolMin, HG_GOLD_SWEEP_RVOL_ASIA);
    out.rvolMin = rvolMin;

    var sweepIdx = rows.length - 1;
    var bi, atr = hit.atr || NaN;
    if (!isFinite(atr)){
      var atrs = _atr(rows, 14);
      atr = atrs && atrs.length ? atrs[atrs.length - 1] : NaN;
    }
    for (bi = rows.length - 1; bi >= Math.max(0, rows.length - 6); bi--){
      if (hit.dir === 'long' && isFinite(hit.level) && rows[bi].l < hit.level){ sweepIdx = bi; break; }
      if (hit.dir === 'short' && isFinite(hit.level) && rows[bi].h > hit.level){ sweepIdx = bi; break; }
    }

    var sr = typeof hgGoldSessionRvol === 'function' ? hgGoldSessionRvol(rows, sweepIdx, {}) : null;
    var sweepRvol = (sr && isFinite(sr.rvol)) ? sr.rvol
      : (isFinite(hit.rvol) ? hit.rvol : hgGoldBarRvol(rows, sweepIdx, 20));
    out.sweepRvol = sweepRvol;
    out.band = hgGoldSweepRvolBand(sweepRvol);
    out.rvolMode = (sr && sr.mode) ? sr.mode : 'rolling';

    var breachAtr = hit.wick && isFinite(hit.wick.breachAtr) ? hit.wick.breachAtr : NaN;
    /* Recompute breach from sweep bar when missing */
    if (!isFinite(breachAtr) && isFinite(hit.level) && isFinite(atr) && atr > 0){
      var sb0 = rows[sweepIdx];
      breachAtr = (hit.dir === 'long') ? ((hit.level - sb0.l) / atr) : ((sb0.h - hit.level) / atr);
    }
    var breachOk = isFinite(breachAtr) && breachAtr >= atrMin;
    var reclaimOk = (hit.wick && typeof hit.wick.closeReclaim === 'boolean')
      ? !!hit.wick.closeReclaim
      : false;
    if (hit.wick && typeof hit.wick.closeReclaim !== 'boolean' && isFinite(hit.level)){
      var sbR = rows[sweepIdx];
      reclaimOk = (hit.dir === 'long') ? (sbR.c > hit.level) : (sbR.c < hit.level);
    } else if (!hit.wick && isFinite(hit.level)){
      var sbR2 = rows[sweepIdx];
      reclaimOk = (hit.dir === 'long') ? (sbR2.c > hit.level) : (sbR2.c < hit.level);
    }

    /* Close in upper (long) / lower (short) third of sweep candle */
    var sb = rows[sweepIdx];
    var rng = sb.h - sb.l;
    if (isFinite(rng) && rng > 0){
      var thirdPos = (sb.c - sb.l) / rng;
      out.closeThird = (hit.dir === 'long') ? (thirdPos >= 0.66) : (thirdPos <= 0.34);
    }

    /* Multi-bar breakout acceptance: ≥2 closes outside after breach */
    var outsideCloses = 0, oi;
    if (isFinite(hit.level)){
      for (oi = sweepIdx; oi < Math.min(rows.length, sweepIdx + 4); oi++){
        if (hit.dir === 'long' && rows[oi].c < hit.level) outsideCloses++;
        if (hit.dir === 'short' && rows[oi].c > hit.level) outsideCloses++;
      }
    }
    if (outsideCloses >= 2 && isFinite(sweepRvol) && sweepRvol >= 1.5){
      out.fake = true;
      out.fakeReason = 'breakout acceptance — ' + outsideCloses
        + ' closes outside level with RVOL ' + sweepRvol.toFixed(2) + ' (do not fade)';
      out.profile = 'breakout';
      out.why = out.fakeReason;
      return out;
    }

    /* Single-bar breakout: high RVOL, no reclaim */
    if (breachOk && !reclaimOk && isFinite(sweepRvol) && sweepRvol >= rvolMin){
      out.fake = true;
      out.fakeReason = 'breakout acceptance — RVOL high but close outside level (do not fade)';
      out.profile = 'breakout';
      out.why = out.fakeReason;
      return out;
    }

    /* Drift through: several small candles, RVOL near average, shallow breach */
    if (isFinite(sweepRvol) && sweepRvol < 1.15 && isFinite(breachAtr) && breachAtr < atrMin * 1.2){
      var smallBodies = 0, si;
      for (si = Math.max(0, sweepIdx - 3); si <= sweepIdx; si++){
        var br = Math.abs(rows[si].c - rows[si].o);
        if (isFinite(atr) && br < 0.35 * atr) smallBodies++;
      }
      if (smallBodies >= 3){
        out.fake = true;
        out.fakeReason = 'drift through level — small bodies + RVOL near avg (not a stop raid)';
        out.profile = 'drift';
        out.why = out.fakeReason;
        return out;
      }
    }

    /* Stage 1 */
    out.stage1 = !!(breachOk && reclaimOk && isFinite(sweepRvol) && sweepRvol >= rvolMin
      && out.band && out.band.key !== 'blowoff');
    if (out.band && out.band.key === 'blowoff'){
      if (opts.newsGate && opts.newsGate.lock){
        out.fake = true;
        out.fakeReason = 'news blowoff RVOL >2.5 — wait 15–30m for a stable range';
        out.why = out.fakeReason;
        return out;
      }
      out.stage1 = !!(breachOk && reclaimOk);
    }
    if (!out.stage1){
      if (isFinite(sweepRvol) && sweepRvol < 1.0){
        out.fake = true;
        out.fakeReason = 'low-volume wick (RVOL ' + sweepRvol.toFixed(2) + ' < 1.0) — ignore';
      } else if (!reclaimOk){
        out.fakeReason = 'no reclaim close — not a valid reversal sweep yet';
      } else if (!breachOk){
        out.fakeReason = 'breach < ' + atrMin.toFixed(2) + '×ATR — not a stop raid'
          + (scalp ? ' (scalp needs ≥0.15)' : '');
      } else {
        out.fakeReason = 'stage-1 RVOL ' + (isFinite(sweepRvol) ? sweepRvol.toFixed(2) : '—')
          + ' < ' + rvolMin + ' floor' + (scalp ? ' (scalp)' : '');
      }
      out.why = out.fakeReason;
      if (out.fake) out.profile = 'fake-weak';
      return out;
    }

    /* Stage 2 — response bars */
    var resp = hgGoldSweepResponseRvol(rows, sweepIdx, scalp ? 2 : 3);
    out.responseRvol = resp.rvol;
    if (resp.pending){
      out.pending = true;
      out.stage2 = false;
      out.profile = 'awaiting-response';
      out.why = 'stage-1 OK (RVOL ' + sweepRvol.toFixed(2)
        + (out.closeThird ? ' · close-in-third' : '')
        + ') · ' + resp.why;
      out.ok = !!(hit.mss && hit.mss.ok && hit.vwap && (hit.vwap.ok || hit.vwap.unchecked)
        && sweepRvol >= HG_GOLD_SWEEP_RVOL_STRONG && out.closeThird);
      return out;
    }
    out.stage2 = isFinite(resp.rvol) && resp.rvol >= HG_GOLD_SWEEP_RVOL_RESPONSE;
    if (!out.stage2){
      out.fake = true;
      out.fakeReason = 'absorption uncertainty — sweep RVOL high but response RVOL '
        + (isFinite(resp.rvol) ? resp.rvol.toFixed(2) : '—') + ' < ' + HG_GOLD_SWEEP_RVOL_RESPONSE;
      out.profile = 'dead-response';
      out.why = out.fakeReason;
      return out;
    }

    /* Structure / VWAP when present */
    if (hit.mss && !hit.mss.ok){
      out.fakeReason = 'high RVOL but no MSS/CHoCH — no entry';
      out.profile = 'no-structure';
      out.why = out.fakeReason + ' · stages ok';
      out.ok = false;
      return out;
    }
    if (hit.vwap && !(hit.vwap.ok || hit.vwap.unchecked)){
      out.why = 'stages ok but VWAP not confirmed — lower confidence';
      out.profile = 'vwap-weak';
      out.ok = false;
      out.stage2 = true;
      return out;
    }

    out.ok = true;
    out.profile = 'reversal';
    out.why = 'two-stage RVOL OK · sweep ' + sweepRvol.toFixed(2)
      + ' (' + out.band.key + ')'
      + (out.closeThird ? ' · close-in-third' : '')
      + ' · response ' + resp.rvol.toFixed(2)
      + (hit.mss && hit.mss.ok ? ' · MSS' : '')
      + (hit.vwap && hit.vwap.ok ? ' · VWAP' : '')
      + (scalp ? ' · SCALP' : '');
    return out;
  }catch(e){ out.why = 'two-stage RVOL error'; return out; }
}

function hgGoldSweepTwoStageHtml(ts){
  try{
    if (!ts || !(ts.ok || ts.stage1 || ts.fake || ts.pending)) return '';
    var h = '<div class="note" data-hg-gold-rvol2="1" style="margin-top:6px">';
    h += '<b>RVOL 2-STAGE</b>';
    if (ts.scalp) h += ' · SCALP';
    if (ts.profile) h += ' · ' + String(ts.profile).toUpperCase();
    if (ts.ok) h += ' · PASS';
    else if (ts.fake) h += ' · FAKE/REJECT';
    else if (ts.pending) h += ' · PENDING';
    if (isFinite(ts.sweepRvol)) h += ' · sweep ' + (+ts.sweepRvol).toFixed(2);
    if (isFinite(ts.responseRvol)) h += ' · resp ' + (+ts.responseRvol).toFixed(2);
    if (ts.closeThird) h += ' · ⅓-close';
    if (ts.band && ts.band.label) h += '<div class="dim" style="margin-top:2px">' + String(ts.band.label).replace(/[<>&]/g, '') + '</div>';
    if (ts.volumeNote) h += '<div class="dim" style="margin-top:2px">' + String(ts.volumeNote).replace(/[<>&]/g, '') + '</div>';
    if (ts.why) h += '<div class="dim" style="margin-top:2px">' + String(ts.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

function hgGoldSweepFalseFilters(rows, hit, opts){
  var out = { reject: false, reasons: [], rvol2: null };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!hit) return out;
    /* Mid-range sweeps are weak (centre of broad range). */
    var pd = goldPremiumDiscount(rows);
    if (pd && pd.zone === 'NEUTRAL' && hit.levelKind !== 'asia' && hit.levelKind !== 'pdh' && hit.levelKind !== 'pdl' && hit.levelKind !== 'equal'){
      out.reasons.push('mid-range sweep away from session/HTF liquidity');
    }
    var regime = opts.regime || null;
    if (regime && regime.vol && regime.vol.regime === 'drift' && isFinite(hit.rvol) && hit.rvol < HG_GOLD_SWEEP_RVOL_MIN){
      out.reject = true;
      out.reasons.push('low ATR drift + weak RVOL — random wick, not a stop raid');
    }
    if (opts.newsGate && opts.newsGate.lock){
      out.reject = true;
      out.reasons.push(opts.newsGate.reason || 'news/FOMC window — headline spike risk');
    }
    /* Level already repeatedly tested (3+ touches in last 40 bars). */
    if (rows && isFinite(hit.level)){
      var touches = 0, ti, atr = hit.atr || 1, tol = 0.15 * atr;
      for (ti = Math.max(0, rows.length - 40); ti < rows.length - 1; ti++){
        if (Math.abs(rows[ti].h - hit.level) <= tol || Math.abs(rows[ti].l - hit.level) <= tol) touches++;
      }
      if (touches >= 4){
        out.reasons.push('level repeatedly tested (' + touches + '×) — resting liquidity may be thin');
      }
    }

    /* Two-stage RVOL fake-sweep gate */
    var rvol2 = hgGoldSweepTwoStageRvol(rows, hit, opts);
    out.rvol2 = rvol2;
    if (rvol2.fake){
      out.reject = true;
      out.reasons.push(rvol2.fakeReason || rvol2.why || 'two-stage RVOL reject');
    } else if (rvol2.band && rvol2.band.key === 'mild'){
      out.reasons.push('mild RVOL — demand MSS/CHoCH + VWAP before entry');
    } else if (rvol2.pending){
      out.reasons.push('awaiting response-bar RVOL (≥1.10 avg over next 1–3)');
    }
    return out;
  }catch(e){ return out; }
}

/**
 * Full five-leg sweep engine. A wick alone is potential; confirmed needs
 * reclaim + MSS + (VWAP when readable) + RVOL.
 */
function hgGoldSweepEngine(rows, opts){
  var out = {
    ok: false, confirmed: false, potential: false, dir: null, level: NaN,
    levelKind: null, label: null, score: 0, tier: 'ignore', parts: {},
    why: '', map: null, wick: null, mss: null, vwap: null, rvol: NaN, atr: NaN
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 35){ out.why = 'need ≥35 bars'; return out; }
    var map = hgGoldLiquidityMap(rows, opts);
    out.map = map;
    out.atr = map.atr;
    if (!map.levels.length){ out.why = 'no marked liquidity levels'; return out; }

    var best = null, li;
    for (li = 0; li < map.levels.length; li++){
      var L = map.levels[li];
      var tryDirs = [];
      if (L.side === 'sell-side' || L.kind === 'pdl' || L.kind === 'asia' && /LOW/i.test(L.label))
        tryDirs.push('long');
      else if (L.side === 'buy-side' || L.kind === 'pdh' || /HIGH/i.test(L.label))
        tryDirs.push('short');
      else {
        /* Round / ambiguous — try both; nearest side wins via breach */
        var bar0 = rows[rows.length - 1];
        if (bar0.l <= L.level) tryDirs.push('long');
        if (bar0.h >= L.level) tryDirs.push('short');
      }
      var di;
      for (di = 0; di < tryDirs.length; di++){
        var dir = tryDirs[di];
        var wick = hgGoldSweepDisplacement(rows, L.level, dir, {
          minAtr: (opts.scalp || opts.mode === 'scalp') ? HG_GOLD_SWEEP_ATR_SCALP : HG_GOLD_SWEEP_ATR_MIN,
          rvolMin: 0 /* score RVOL separately so potential wicks still surface */
        });
        if (!wick.potential && !wick.ok) continue;
        var mss = hgGoldSweepMss(rows, dir);
        var vwap = hgGoldSweepVwap(rows, dir);
        var rvol = wick.rvol;
        var cand = {
          dir: dir, level: L.level, levelKind: L.kind, label: L.label,
          wick: wick, mss: mss, vwap: vwap, rvol: rvol, atr: map.atr,
          potential: !!wick.potential, reclaim: !!wick.closeReclaim
        };
        var conf = hgGoldSweepConfidence(cand, {
          regime: opts.regime, newsGate: opts.newsGate, rows: rows,
          scalp: !!(opts.scalp || opts.mode === 'scalp'),
          mode: opts.mode || (opts.scalp ? 'scalp' : null),
          now: opts.now
        });
        cand.score = conf.score;
        cand.tier = conf.tier;
        cand.parts = conf.parts;
        cand.confirmed = conf.confirmed;
        cand.why = conf.why;
        cand.filters = conf.filters;
        cand.rvol2 = conf.rvol2;
        if (!best || cand.score > best.score) best = cand;
      }
    }
    if (!best){ out.why = 'no ATR-sized sweep of a marked level this bar'; return out; }
    out.dir = best.dir;
    out.level = best.level;
    out.levelKind = best.levelKind;
    out.label = best.label;
    out.wick = best.wick;
    out.mss = best.mss;
    out.vwap = best.vwap;
    out.rvol = best.rvol;
    out.rvol2 = best.rvol2;
    out.score = best.score;
    out.tier = best.tier;
    out.parts = best.parts;
    out.potential = !!best.potential;
    out.confirmed = !!best.confirmed;
    out.ok = out.confirmed || (out.tier === 'watch' || out.tier === 'alert');
    out.why = best.why;
    out.filters = best.filters;
    return out;
  }catch(e){ out.why = 'sweep engine error'; return out; }
}

/**
 * 100-pt Gold Sweep Confidence.
 * Liquidity 25 · Sweep quality 20 · Structure 20 · VWAP/location 15 ·
 * Participation 10 · Regime/news 10. RSI not scored (FOLKLORE).
 */
function hgGoldSweepConfidence(hit, opts){
  var out = {
    score: 0, tier: 'ignore', confirmed: false, parts: {}, why: '', filters: null
  };
  try{
    opts = opts || {};
    if (!hit || !hit.dir){ out.why = 'no sweep hit'; return out; }
    var p = {
      liquidity: 0, sweep: 0, structure: 0, vwapLoc: 0, participation: 0, regimeNews: 0
    };
    /* Liquidity quality — 25 */
    var k = hit.levelKind || '';
    if (k === 'asia' || k === 'pdh' || k === 'pdl') p.liquidity = 25;
    else if (k === 'equal') p.liquidity = 22;
    else if (k === 'pivot') p.liquidity = 16;
    else if (k === 'round') p.liquidity = 10;
    else p.liquidity = 8;

    /* Sweep quality — 20 */
    var ba = hit.wick && hit.wick.breachAtr;
    if (hit.wick && hit.wick.closeReclaim && isFinite(ba)){
      if (ba >= HG_GOLD_SWEEP_ATR_IDEAL) p.sweep = 20;
      else if (ba >= HG_GOLD_SWEEP_ATR_MIN) p.sweep = 14;
      else p.sweep = 6;
      if (hit.wick.disp) p.sweep = Math.min(20, p.sweep + 3);
    } else if (hit.wick && hit.wick.potential){
      p.sweep = 8;
    }

    /* Structure — 20 */
    if (hit.mss && hit.mss.ok) p.structure = 20;
    else if (hit.wick && hit.wick.closeReclaim) p.structure = 6;

    /* VWAP / location — 15 (VP thin = hint only, small bump if near Asia/PDH) */
    if (hit.vwap && hit.vwap.ok) p.vwapLoc = 15;
    else if (hit.vwap && hit.vwap.unchecked) p.vwapLoc = 8; /* fail-open half credit */
    else if (k === 'asia' || k === 'pdh' || k === 'pdl' || k === 'equal') p.vwapLoc = 6;

    /* Participation — 10 (two-stage RVOL bands) */
    var rvol2pre = null;
    try{
      if (opts.rows) rvol2pre = hgGoldSweepTwoStageRvol(opts.rows, hit, opts);
    }catch(_r){}
    if (rvol2pre && rvol2pre.ok) p.participation = 10;
    else if (rvol2pre && rvol2pre.stage1 && rvol2pre.pending) p.participation = 7;
    else if (isFinite(hit.rvol)){
      if (hit.rvol >= HG_GOLD_SWEEP_RVOL_STRONG) p.participation = 10;
      else if (hit.rvol >= HG_GOLD_SWEEP_RVOL_MIN) p.participation = 8;
      else if (hit.rvol >= 1.0) p.participation = 4;
      else p.participation = 0;
    } else {
      p.participation = 5; /* unread volume — neutral, not a free pass */
    }

    /* Regime / news — 10 */
    var regime = opts.regime;
    var newsOk = !(opts.newsGate && opts.newsGate.lock);
    if (newsOk){
      if (regime && regime.vol && regime.vol.regime === 'expansion') p.regimeNews = 10;
      else if (regime && regime.style === 'mean-rev') p.regimeNews = 9; /* sweeps like MR */
      else if (regime && regime.vol && regime.vol.regime === 'drift') p.regimeNews = 3;
      else p.regimeNews = 7;
    } else {
      p.regimeNews = 0;
    }

    var filters = hgGoldSweepFalseFilters(opts.rows, hit, opts);
    out.filters = filters;
    out.rvol2 = (filters && filters.rvol2) || rvol2pre;
    if (filters && filters.reject){
      out.parts = p;
      out.score = Math.min(64, p.liquidity + p.sweep + p.structure + p.vwapLoc + p.participation + p.regimeNews);
      out.tier = 'ignore';
      out.why = 'filtered — ' + (filters.reasons || []).join('; ');
      return out;
    }
    /* Soft penalties for caution reasons */
    var soft = (filters && filters.reasons && filters.reasons.length) ? Math.min(8, filters.reasons.length * 3) : 0;

    out.parts = p;
    out.score = Math.max(0, Math.min(100,
      p.liquidity + p.sweep + p.structure + p.vwapLoc + p.participation + p.regimeNews - soft));
    var rvolGateOk = !isFinite(hit.rvol) || hit.rvol >= HG_GOLD_SWEEP_RVOL_MIN;
    if (out.rvol2){
      if (out.rvol2.fake) rvolGateOk = false;
      else if (out.rvol2.ok) rvolGateOk = true;
      else if (out.rvol2.stage1 && out.rvol2.pending && hit.mss && hit.mss.ok
        && isFinite(hit.rvol) && hit.rvol >= HG_GOLD_SWEEP_RVOL_STRONG)
        rvolGateOk = true;
      else if (out.rvol2.stage1 && !out.rvol2.pending && !out.rvol2.stage2)
        rvolGateOk = false;
    }
    out.confirmed = !!(hit.wick && hit.wick.closeReclaim && hit.mss && hit.mss.ok
      && (hit.vwap && (hit.vwap.ok || hit.vwap.unchecked))
      && rvolGateOk
      && out.score >= HG_GOLD_SWEEP_WATCH);
    if (out.score >= HG_GOLD_SWEEP_ALERT && out.confirmed) out.tier = 'alert';
    else if (out.score >= HG_GOLD_SWEEP_WATCH) out.tier = 'watch';
    else out.tier = 'ignore';

    out.why = (out.confirmed ? 'CONFIRMED ' : (hit.wick && hit.wick.closeReclaim ? 'POTENTIAL ' : ''))
      + String(hit.dir || '').toUpperCase() + ' sweep @ ' + (isFinite(hit.level) ? hit.level.toFixed(2) : '—')
      + ' (' + (hit.label || hit.levelKind || 'level') + ') · score ' + out.score
      + '/' + out.tier.toUpperCase();
    if (hit.mss && hit.mss.ok) out.why += ' · ' + hit.mss.why;
    if (hit.vwap && hit.vwap.ok) out.why += ' · VWAP ok';
    if (isFinite(hit.rvol)) out.why += ' · RVOL ' + hit.rvol.toFixed(2);
    if (out.rvol2 && out.rvol2.profile) out.why += ' · rvol2=' + out.rvol2.profile;
    if (soft) out.why += ' · caution −' + soft;
    return out;
  }catch(e){ out.why = 'confidence error'; return out; }
}

function hgGoldSweepEngineHtml(eng){
  try{
    if (!eng || !(eng.ok || eng.potential || eng.score > 0)) return '';
    var h = '<div class="note" data-hg-gold-sweep="1" style="margin-top:8px">';
    h += '<b>GOLD SWEEP</b> · ' + String(eng.tier || 'ignore').toUpperCase()
      + ' · score ' + (isFinite(eng.score) ? eng.score : '—') + '/100';
    if (eng.dir) h += ' · ' + String(eng.dir).toUpperCase();
    if (isFinite(eng.level)) h += ' @ ' + (+eng.level).toFixed(2);
    if (eng.label) h += ' · ' + String(eng.label).replace(/[<>&]/g, '');
    if (eng.why) h += '<div class="dim" style="margin-top:4px">' + String(eng.why).replace(/[<>&]/g, '') + '</div>';
    if (eng.rvol2 && typeof hgGoldSweepTwoStageHtml === 'function'){
      h += hgGoldSweepTwoStageHtml(eng.rvol2);
    }
    if (eng.parts){
      h += '<div class="dim" style="margin-top:2px">liq ' + (eng.parts.liquidity || 0)
        + ' · wick ' + (eng.parts.sweep || 0)
        + ' · mss ' + (eng.parts.structure || 0)
        + ' · vwap ' + (eng.parts.vwapLoc || 0)
        + ' · rvol ' + (eng.parts.participation || 0)
        + ' · regime ' + (eng.parts.regimeNews || 0) + '</div>';
    }
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* =========================================================================
   ADVANCED SWEEP → ORDER BLOCK (hg-v560)
   HTF location + liquidity raid + MSS, then entry on fresh OB/FVG retrace.
   Modes: reversal · continuation · london-trap · ny-rev / ny-cont.
   Quality ≥7/10 to alert; R:R ≥2.0 for alert path. News lockout vetoes.
========================================================================= */

var HG_GOLD_SWEEPOB_ALERT_Q = 7;
var HG_GOLD_SWEEPOB_RR_ALERT = 2.0;
var HG_GOLD_SWEEPOB_BUF_ATR = 0.15;

function hgGoldHtfBias(rows4h, rows1h){
  var out = { dir: null, label: 'no HTF bias', atDemand: false, atSupply: false };
  try{
    var rows = __rows(rows4h) || __rows(rows1h);
    if (!rows || rows.length < 40) return out;
    var ms = goldMarketStructure(rows);
    var rb = goldRibbon(rows);
    if (ms && /bull/i.test(ms.trend || '')){ out.dir = 'long'; out.label = 'HTF bullish'; }
    else if (ms && /bear/i.test(ms.trend || '')){ out.dir = 'short'; out.label = 'HTF bearish'; }
    if (rb && rb.mode === 'BULL' && out.dir !== 'short'){ out.dir = 'long'; out.label = (out.label === 'no HTF bias') ? 'EMA bullish' : out.label + '+EMA'; }
    if (rb && rb.mode === 'BEAR' && out.dir !== 'long'){ out.dir = 'short'; out.label = (out.label === 'no HTF bias') ? 'EMA bearish' : out.label + '+EMA'; }
    /* Premium/discount via mid of recent range */
    var i, hi = -Infinity, lo = Infinity;
    for (i = Math.max(0, rows.length - 40); i < rows.length; i++){
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
    }
    var mid = (hi + lo) / 2, px = rows[rows.length - 1].c;
    if (isFinite(mid) && isFinite(px)){
      out.atDemand = px <= mid;
      out.atSupply = px >= mid;
    }
    return out;
  }catch(e){ return out; }
}

/** Fresh displacement OB: last opposing candle before BOS displacement, unmitigated. */
function hgGoldFreshOb(rows, dir){
  var out = { ok: false, zone: null, entry50: NaN, bodyLo: NaN, bodyHi: NaN, why: '' };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30){ out.why = 'short series'; return out; }
    var obs = goldOrderBlocks(rows);
    if (!obs){ out.why = 'no OB'; return out; }
    var list = (dir === 'long') ? obs.bullish : obs.bearish;
    if (!list || !list.length){ out.why = 'no fresh ' + dir + ' OB'; return out; }
    /* Prefer youngest unmitigated (already filtered) with age ≤ 12 bars */
    var z = null, i;
    for (i = 0; i < list.length; i++){
      if (list[i].age <= 12){ z = list[i]; break; }
    }
    if (!z) z = list[0];
    if (z.age > 20){ out.why = 'OB too old (' + z.age + ' bars)'; return out; }
    var obBar = rows[z.i];
    var bodyLo = Math.min(obBar.o, obBar.c);
    var bodyHi = Math.max(obBar.o, obBar.c);
    out.ok = true;
    out.zone = { lo: z.bottom, hi: z.top, age: z.age, i: z.i };
    out.bodyLo = bodyLo;
    out.bodyHi = bodyHi;
    out.entry50 = (bodyLo + bodyHi) / 2; /* refined 50% of body */
    out.why = 'fresh ' + dir + ' OB ' + z.bottom.toFixed(2) + '–' + z.top.toFixed(2)
      + ' (age ' + z.age + ')';
    return out;
  }catch(e){ out.why = 'ob error'; return out; }
}

function hgGoldFreshFvg(rows, dir){
  var out = { ok: false, zone: null, why: '' };
  try{
    var gaps = typeof goldFVG === 'function' ? goldFVG(rows) : null;
    if (!gaps || !gaps.length){ out.why = 'no FVG'; return out; }
    var want = (dir === 'long') ? 'bullish' : 'bearish';
    var i, g;
    for (i = 0; i < gaps.length; i++){
      g = gaps[i];
      if (g.dir === want || g.type === want || (dir === 'long' && g.bullish) || (dir === 'short' && g.bearish)){
        var lo = isFinite(g.bottom) ? g.bottom : g.lo;
        var hi = isFinite(g.top) ? g.top : g.hi;
        if (isFinite(lo) && isFinite(hi)){
          out.ok = true;
          out.zone = { lo: lo, hi: hi };
          out.why = 'fresh ' + dir + ' FVG ' + lo.toFixed(2) + '–' + hi.toFixed(2);
          return out;
        }
      }
    }
    out.why = 'no matching FVG';
    return out;
  }catch(e){ return out; }
}

/**
 * 10-filter quality score for sweep→OB (alert at ≥7).
 */
function hgGoldSweepObQuality(hit, opts){
  var out = { score: 0, max: 10, pass: false, parts: {}, why: '' };
  try{
    opts = opts || {};
    var p = {
      htf: 0, liquidity: 0, reclaim: 0, mss: 0, entryLoc: 0,
      vwap: 0, volatility: 0, volume: 0, macro: 0, rr: 0
    };
    if (hit.htfOk) p.htf = 1;
    if (hit.sweepOk) p.liquidity = 1;
    if (hit.reclaimOk) p.reclaim = 1;
    if (hit.mssOk) p.mss = 1;
    if (hit.entryOk) p.entryLoc = 1;
    if (hit.vwapOk) p.vwap = 1;
    if (hit.volOk) p.volatility = 1;
    if (hit.volumeOk) p.volume = 1;
    if (hit.macroOk) p.macro = 1;
    if (hit.rrOk) p.rr = 1;
    out.parts = p;
    out.score = p.htf + p.liquidity + p.reclaim + p.mss + p.entryLoc
      + p.vwap + p.volatility + p.volume + p.macro + p.rr;
    out.pass = out.score >= HG_GOLD_SWEEPOB_ALERT_Q;
    out.why = out.score + '/10'
      + (out.pass ? ' PASS' : ' below alert bar')
      + (hit.mode ? (' · ' + hit.mode) : '');
    return out;
  }catch(e){ return out; }
}

/**
 * Advanced sweep→OB detector.
 */
function hgGoldSweepOb(rows, opts){
  var out = {
    ok: false, confirmed: false, dir: null, mode: null, score: 0, tier: 'ignore',
    sweepLevel: NaN, sweepLabel: null, obZone: null, entry: NaN, stop: NaN,
    t1: NaN, t2: NaN, rr: NaN, quality: null, plan: null, why: '', alertFields: null
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40){ out.why = 'need ≥40 bars'; return out; }
    var nowMs = opts.now || (isFinite(rows[rows.length - 1].t) ? rows[rows.length - 1].t * 1000 : Date.now());
    var newsGate = opts.newsGate || (opts.news ? hgGoldNewsGate(opts.news, nowMs) : null);
    if (newsGate && newsGate.lock){
      out.why = 'tier-1 US news lockout — skip sweep-OB';
      out.tier = 'ignore';
      return out;
    }

    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(isFinite(atr) && atr > 0)){ out.why = 'ATR unread'; return out; }

    var htf = hgGoldHtfBias(opts.rows4h || rows, opts.rows1h);
    var sweep = opts.sweep || hgGoldSweepEngine(rows, {
      regime: opts.regime, newsGate: newsGate
    });
    if (!sweep || !sweep.dir || !(sweep.confirmed || sweep.tier === 'alert' || sweep.tier === 'watch')){
      out.why = 'no confirmed/watch liquidity sweep';
      return out;
    }

    var dir = sweep.dir;
    var mode = 'reversal';

    /* London trap: Asia box swept during London hours */
    var asia = goldAsianRange(rows);
    var sess = typeof goldKillzone === 'function' ? goldKillzone(nowMs) : null;
    var hUTC = new Date(nowMs).getUTCHours() + new Date(nowMs).getUTCMinutes() / 60;
    var isLondon = hUTC >= 7 && hUTC < 12;
    var isNy = hUTC >= 12 && hUTC < 17;
    if (asia && isFinite(asia.hi) && isFinite(asia.lo) && isLondon){
      if ((dir === 'long' && Math.abs(sweep.level - asia.lo) < atr * 0.35)
          || (dir === 'short' && Math.abs(sweep.level - asia.hi) < atr * 0.35)){
        mode = 'london-trap';
      }
    }
    /* Continuation: sweep against HTF then MSS back with trend */
    if (htf.dir && sweep.mss && sweep.mss.ok){
      if (htf.dir === dir && mode === 'reversal'){
        /* sweep direction matches HTF → continuation after counter-sweep reclaim */
        mode = isNy ? 'ny-cont' : 'continuation';
      } else if (htf.dir !== dir && isNy){
        mode = 'ny-rev';
      }
    }
    /* NY open: require completed reclaim (already in sweep) — demote first-spike */
    if (isNy && hUTC < 13.5 && !(sweep.mss && sweep.mss.ok)){
      out.why = 'NY open — wait completed MSS before sweep-OB';
      out.tier = 'watch';
      out.dir = dir;
      out.mode = 'ny-open-wait';
      return out;
    }

    /* ADX: reject weak chop for reversal/continuation (range MR exempt — not this model) */
    var adx = goldADX(rows);
    var adxV = adx && isFinite(adx.adx) ? adx.adx : NaN;
    var volOk = !(isFinite(adxV) && adxV < 15);
    if (!volOk && mode !== 'london-trap'){
      /* still allow watch but not alert */
    }

    var ob = hgGoldFreshOb(rows, dir);
    var fvg = hgGoldFreshFvg(rows, dir);
    var entryZone = ob.ok ? ob : fvg;
    if (!entryZone.ok){
      out.why = 'sweep ok but no fresh OB/FVG for entry — ' + (ob.why || fvg.why || '');
      out.dir = dir;
      out.mode = mode;
      out.sweepLevel = sweep.level;
      out.tier = 'watch';
      return out;
    }

    var extreme = (dir === 'long')
      ? (sweep.wick && isFinite(sweep.wick.extreme) ? sweep.wick.extreme : sweep.level - atr * 0.2)
      : (sweep.wick && isFinite(sweep.wick.extreme) ? sweep.wick.extreme : sweep.level + atr * 0.2);
    /* Prefer actual bar extreme from last sweep */
    var bi, bar;
    for (bi = rows.length - 1; bi >= Math.max(0, rows.length - 6); bi--){
      bar = rows[bi];
      if (dir === 'long' && bar.l < sweep.level){ extreme = Math.min(extreme, bar.l); break; }
      if (dir === 'short' && bar.h > sweep.level){ extreme = Math.max(extreme, bar.h); break; }
    }
    var buf = atr * HG_GOLD_SWEEPOB_BUF_ATR;
    var stop = (dir === 'long') ? (extreme - buf) : (extreme + buf);

    var entry = ob.ok && isFinite(ob.entry50) ? ob.entry50
      : ((entryZone.zone.lo + entryZone.zone.hi) / 2);
    /* Price must be interacting with zone or just displaced from it */
    var px = rows[rows.length - 1].c;
    var inZone = px >= entryZone.zone.lo - atr * 0.15 && px <= entryZone.zone.hi + atr * 0.15;
    var nearZone = dir === 'long'
      ? (px >= entryZone.zone.lo - atr * 0.5 && px <= entryZone.zone.hi + atr)
      : (px <= entryZone.zone.hi + atr * 0.5 && px >= entryZone.zone.lo - atr);
    if (!inZone && !nearZone){
      out.why = 'waiting for retrace into OB/FVG ' + entryZone.zone.lo.toFixed(2) + '–' + entryZone.zone.hi.toFixed(2);
      out.dir = dir;
      out.mode = mode;
      out.sweepLevel = sweep.level;
      out.obZone = entryZone.zone;
      out.entry = entry;
      out.stop = stop;
      out.tier = 'watch';
      out.ok = true;
      return out;
    }

    var vw = goldVWAP(rows);
    var vwapOk = false;
    if (vw && isFinite(vw.vwap)){
      vwapOk = (dir === 'long' && px >= vw.vwap) || (dir === 'short' && px <= vw.vwap);
    } else {
      vwapOk = true; /* fail-open half — mark unchecked via quality soft */
    }

    /* Targets */
    var map = sweep.map || hgGoldLiquidityMap(rows, opts);
    var t1 = (vw && isFinite(vw.vwap)) ? vw.vwap : NaN;
    var t2 = NaN;
    if (dir === 'long'){
      if (!isFinite(t1) || (dir === 'long' && t1 <= entry)) t1 = entry + atr * 1.0;
      if (asia && isFinite(asia.hi)) t2 = asia.hi;
      if (map && map.priorDay && isFinite(map.priorDay.hi)) t2 = map.priorDay.hi;
      if (mode === 'london-trap' && asia && isFinite(asia.lo) && isFinite(asia.hi)){
        t1 = (asia.lo + asia.hi) / 2;
        t2 = asia.hi;
      }
    } else {
      if (!isFinite(t1) || t1 >= entry) t1 = entry - atr * 1.0;
      if (asia && isFinite(asia.lo)) t2 = asia.lo;
      if (map && map.priorDay && isFinite(map.priorDay.lo)) t2 = map.priorDay.lo;
      if (mode === 'london-trap' && asia && isFinite(asia.lo) && isFinite(asia.hi)){
        t1 = (asia.lo + asia.hi) / 2;
        t2 = asia.lo;
      }
    }

    var risk = Math.abs(entry - stop);
    var rr = (risk > 0 && isFinite(t1)) ? Math.abs(t1 - entry) / risk : NaN;
    var rr2 = (risk > 0 && isFinite(t2)) ? Math.abs(t2 - entry) / risk : rr;
    var rrUse = Math.max(rr || 0, rr2 || 0);

    /* HTF: reversal needs location agreement; continuation needs trend agree */
    var htfOk = false;
    if (mode === 'continuation' || mode === 'ny-cont'){
      htfOk = !!(htf.dir && htf.dir === dir);
    } else {
      htfOk = !!(htf.dir === dir || (dir === 'long' && htf.atDemand) || (dir === 'short' && htf.atSupply) || !htf.dir);
    }

    var volumeOk = isFinite(sweep.rvol) ? sweep.rvol >= 1.2 : true;
    var hit = {
      mode: mode,
      htfOk: htfOk,
      sweepOk: !!(sweep.confirmed || sweep.tier === 'alert' || sweep.tier === 'watch'),
      reclaimOk: !!(sweep.wick && sweep.wick.closeReclaim) || !!sweep.confirmed,
      mssOk: !!(sweep.mss && sweep.mss.ok),
      entryOk: !!(entryZone.ok && (inZone || nearZone)),
      vwapOk: vwapOk,
      volOk: volOk || mode === 'london-trap',
      volumeOk: volumeOk,
      macroOk: !(newsGate && newsGate.lock),
      rrOk: isFinite(rrUse) && rrUse >= HG_GOLD_SWEEPOB_RR_ALERT
    };
    var q = hgGoldSweepObQuality(hit, opts);

    out.dir = dir;
    out.mode = mode;
    out.sweepLevel = sweep.level;
    out.sweepLabel = sweep.label || sweep.levelKind;
    out.obZone = entryZone.zone;
    out.entry = entry;
    out.stop = stop;
    out.t1 = t1;
    out.t2 = t2;
    out.rr = rrUse;
    out.quality = q;
    out.score = q.score * 10; /* 0–100 mirror */
    out.confirmed = !!(q.pass && hit.mssOk && hit.reclaimOk && hit.entryOk && hit.rrOk);
    out.ok = out.confirmed || q.score >= 5;
    out.tier = out.confirmed ? 'alert' : (q.score >= 5 ? 'watch' : 'ignore');
    out.plan = {
      entryModel: 'balanced — retrace into OB/FVG after MSS (50% body preferred)',
      stop: stop,
      stopNote: 'beyond sweep extreme + ' + HG_GOLD_SWEEPOB_BUF_ATR + '×ATR',
      t1: t1, t2: t2,
      cancel: 'close through far side of OB or re-accept beyond swept level'
    };
    out.alertFields = {
      direction: dir,
      sweepLevel: sweep.level,
      sweptLiquidity: sweep.label || sweep.levelKind,
      htfOb: htf.label,
      entryOb: entryZone.zone,
      invalidation: stop,
      atrBuffer: buf,
      tp1: t1, tp2: t2,
      liveScore: q.score + '/10',
      session: isNy ? 'NY' : (isLondon ? 'LONDON' : 'OTHER'),
      mode: mode,
      rr: isFinite(rrUse) ? +rrUse.toFixed(2) : null
    };
    out.why = (out.confirmed ? 'SWEEP-OB ALERT ' : 'SWEEP-OB ')
      + dir.toUpperCase() + ' · ' + mode
      + ' · Q ' + q.score + '/10'
      + ' · sweep @ ' + (isFinite(sweep.level) ? sweep.level.toFixed(2) : '—')
      + ' · entry OB/FVG ' + entryZone.zone.lo.toFixed(2) + '–' + entryZone.zone.hi.toFixed(2)
      + (isFinite(rrUse) ? (' · ' + rrUse.toFixed(2) + 'R') : '');
    return out;
  }catch(e){ out.why = 'sweep-ob error'; return out; }
}

function hgGoldSweepObHtml(sob){
  try{
    if (!sob || !(sob.ok || sob.score > 0 || sob.tier === 'watch')) return '';
    var h = '<div class="note" data-hg-gold-sweepob="1" style="margin-top:8px">';
    h += '<b>SWEEP→OB</b> · ' + String(sob.tier || 'ignore').toUpperCase();
    if (sob.quality) h += ' · Q ' + sob.quality.score + '/10';
    if (sob.dir) h += ' · ' + String(sob.dir).toUpperCase();
    if (sob.mode) h += ' · ' + String(sob.mode);
    if (isFinite(sob.sweepLevel)) h += ' · sweep ' + (+sob.sweepLevel).toFixed(2);
    if (sob.obZone){
      h += '<div class="dim" style="margin-top:4px">entry zone '
        + (+sob.obZone.lo).toFixed(2) + '–' + (+sob.obZone.hi).toFixed(2);
      if (isFinite(sob.entry)) h += ' · entry ~' + (+sob.entry).toFixed(2);
      if (isFinite(sob.stop)) h += ' · stop ' + (+sob.stop).toFixed(2);
      if (isFinite(sob.t1)) h += ' · TP1 ' + (+sob.t1).toFixed(2);
      if (isFinite(sob.t2)) h += ' · TP2 ' + (+sob.t2).toFixed(2);
      if (isFinite(sob.rr)) h += ' · ' + (+sob.rr).toFixed(2) + 'R';
      h += '</div>';
    }
    if (sob.quality && sob.quality.parts){
      var p = sob.quality.parts;
      h += '<div class="dim" style="margin-top:2px">htf ' + p.htf
        + ' · liq ' + p.liquidity + ' · reclaim ' + p.reclaim
        + ' · mss ' + p.mss + ' · entry ' + p.entryLoc
        + ' · vwap ' + p.vwap + ' · vol ' + p.volatility
        + ' · rvol ' + p.volume + ' · macro ' + p.macro
        + ' · rr ' + p.rr + '</div>';
    }
    if (sob.why) h += '<div class="dim" style="margin-top:2px">' + String(sob.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* =========================================================================
   SESSION-BOUNDED SWEEP REVERSAL (hg-v566) — ICT Silver Bullet structural twin.
   Time-windowed Asia (or prior-hour) sweep → close reclaim → OB/FVG entry.
   London open 07:00–09:30 UTC primary; NY open 12:00–13:30 UTC secondary.
   Algorithm reference only — no third-party import into HARDGATE.
========================================================================= */

var HG_GOLD_SB_LON_START = 7.0;   /* UTC hours */
var HG_GOLD_SB_LON_END = 9.5;     /* 09:30 — first 60–90 min after London open */
var HG_GOLD_SB_NY_START = 12.0;
var HG_GOLD_SB_NY_END = 13.5;
var HG_GOLD_SB_LOOKBACK = 8;      /* bars to search for sweep+reclaim */
var HG_GOLD_SB_MIN_BREACH = 0.15; /* ×ATR wick beyond pool */
var HG_GOLD_SB_BUF_ATR = 0.15;
var HG_GOLD_SB_RR_ALERT = 1.8;

/** UTC fractional hour from epoch ms. */
function hgGoldUtcHourFrac(ms){
  try{
    var d = new Date(ms);
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }catch(e){ return NaN; }
}

/**
 * Which Silver-Bullet-style window contains nowMs.
 * -> { name:'LONDON_SB'|'NY_SB'|null, inWindow, grade:'A'|'B'|null, why }
 */
function hgGoldSessionBoundWindow(nowMs){
  var out = { name: null, inWindow: false, grade: null, why: '' };
  try{
    var h = hgGoldUtcHourFrac(nowMs);
    if (!isFinite(h)){ out.why = 'bad clock'; return out; }
    if (h >= HG_GOLD_SB_LON_START && h < HG_GOLD_SB_LON_END){
      out.name = 'LONDON_SB'; out.inWindow = true; out.grade = 'A';
      out.why = 'London open Silver Bullet window 07:00–09:30 UTC';
      return out;
    }
    if (h >= HG_GOLD_SB_NY_START && h < HG_GOLD_SB_NY_END){
      out.name = 'NY_SB'; out.inWindow = true; out.grade = 'A';
      out.why = 'NY open Silver Bullet window 12:00–13:30 UTC';
      return out;
    }
    out.why = 'outside session-bound windows (London 07:00–09:30 / NY 12:00–13:30 UTC)';
    return out;
  }catch(e){ out.why = 'window error'; return out; }
}

/** Prior complete UTC clock-hour H/L (Silver Bullet prior-hour pool). */
function hgGoldPriorHourRange(rows, nowMs){
  var out = { ok: false, hi: NaN, lo: NaN, mid: NaN, hourIso: '', bars: 0, why: '' };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 4 || !isFinite(nowMs)){ out.why = 'need bars + now'; return out; }
    var hourStart = Math.floor(nowMs / 3600000) * 3600000 - 3600000; /* prior hour */
    var hourEnd = hourStart + 3600000;
    var hi = -Infinity, lo = Infinity, bars = 0, i;
    for (i = 0; i < rows.length; i++){
      var ms = isFinite(rows[i].t) ? rows[i].t * 1000 : NaN;
      if (!isFinite(ms) || ms < hourStart || ms >= hourEnd) continue;
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      bars++;
    }
    if (bars < 1 || !(hi > lo)){ out.why = 'prior hour empty'; return out; }
    out.ok = true; out.hi = hi; out.lo = lo; out.mid = (hi + lo) / 2;
    out.bars = bars;
    out.hourIso = new Date(hourStart).toISOString().slice(0, 13) + 'Z';
    out.why = 'prior hour ' + out.hourIso + ' ' + lo.toFixed(2) + '–' + hi.toFixed(2);
    return out;
  }catch(e){ out.why = 'prior-hour error'; return out; }
}

/**
 * Session-bounded Asia→London (Silver Bullet twin) detector.
 * Sweep of Asia box (preferred) or prior-hour H/L inside the open window,
 * close reclaim, then fresh OB/FVG for entry.
 */
function hgGoldSessionBoundSweep(rows, opts){
  var out = {
    ok: false, confirmed: false, dir: null, tier: 'idle', window: null,
    inWindow: false, pool: null, sweepLevel: NaN, sweepLabel: null,
    sweepIdx: -1, extreme: NaN, reclaimOk: false, entryZone: null,
    entry: NaN, stop: NaN, t1: NaN, t2: NaN, rr: NaN,
    asia: null, priorHour: null, why: '', plan: null
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 30){ out.why = 'need ≥30 bars'; return out; }
    var nowMs = opts.now || (isFinite(rows[rows.length - 1].t) ? rows[rows.length - 1].t * 1000 : Date.now());
    var win = hgGoldSessionBoundWindow(nowMs);
    out.window = win.name;
    out.inWindow = !!win.inWindow;
    if (!win.inWindow && !opts.ignoreWindow){
      out.why = win.why;
      out.tier = 'idle';
      return out;
    }

    var newsGate = opts.newsGate || (opts.news ? hgGoldNewsGate(opts.news, nowMs) : null);
    if (newsGate && newsGate.lock){
      out.why = 'tier-1 news lockout — skip session-bound sweep';
      out.tier = 'idle';
      return out;
    }

    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(isFinite(atr) && atr > 0)){ out.why = 'ATR unread'; return out; }

    var asia = opts.asia || goldAsianRange(rows);
    out.asia = asia;
    var prior = opts.priorHour || hgGoldPriorHourRange(rows, nowMs);
    out.priorHour = prior;

    var pools = [];
    if (asia && isFinite(asia.lo) && isFinite(asia.hi)){
      pools.push({ label: 'Asia low', level: asia.lo, dir: 'long', kind: 'asia' });
      pools.push({ label: 'Asia high', level: asia.hi, dir: 'short', kind: 'asia' });
    }
    if (prior && prior.ok){
      pools.push({ label: 'Prior-hour low', level: prior.lo, dir: 'long', kind: 'priorHour' });
      pools.push({ label: 'Prior-hour high', level: prior.hi, dir: 'short', kind: 'priorHour' });
    }
    if (!pools.length){
      out.why = 'no Asia box or prior-hour pool';
      return out;
    }

    var look = Math.max(3, Math.min(rows.length - 2,
      isFinite(opts.lookback) ? opts.lookback : HG_GOLD_SB_LOOKBACK));
    var minBreach = (isFinite(opts.minBreachAtr) ? opts.minBreachAtr : HG_GOLD_SB_MIN_BREACH) * atr;
    var best = null;
    var pi, bi, pool, bar, breach, reclaim, extreme, barMs, barH;

    for (pi = 0; pi < pools.length; pi++){
      pool = pools[pi];
      for (bi = rows.length - 1; bi >= rows.length - look; bi--){
        bar = rows[bi];
        if (!bar) continue;
        barMs = isFinite(bar.t) ? bar.t * 1000 : NaN;
        barH = isFinite(barMs) ? hgGoldUtcHourFrac(barMs) : NaN;
        /* sweep bar should land in the same class of window (or ignoreWindow) */
        if (!opts.ignoreWindow && isFinite(barH)){
          var barInLon = barH >= HG_GOLD_SB_LON_START && barH < HG_GOLD_SB_LON_END;
          var barInNy = barH >= HG_GOLD_SB_NY_START && barH < HG_GOLD_SB_NY_END;
          if (win.name === 'LONDON_SB' && !barInLon) continue;
          if (win.name === 'NY_SB' && !barInNy) continue;
        }
        if (pool.dir === 'long'){
          breach = pool.level - bar.l;
          reclaim = bar.c > pool.level;
          extreme = bar.l;
        } else {
          breach = bar.h - pool.level;
          reclaim = bar.c < pool.level;
          extreme = bar.h;
        }
        if (!(breach >= minBreach) || !reclaim) continue;
        var cand = {
          pool: pool, idx: bi, breach: breach, extreme: extreme,
          age: rows.length - 1 - bi, rvol: hgGoldBarRvol(rows, bi, 20)
        };
        /* Prefer Asia pools over prior-hour; prefer fresher bars */
        var rank = (pool.kind === 'asia' ? 100 : 0) - cand.age
          + (isFinite(cand.rvol) ? Math.min(5, cand.rvol) : 0);
        cand.rank = rank;
        if (!best || cand.rank > best.rank) best = cand;
      }
    }

    if (!best){
      out.why = (win.name || 'SB') + ' armed — waiting for Asia/prior-hour wick+close reclaim';
      out.tier = 'watch';
      out.ok = true;
      return out;
    }

    out.pool = best.pool;
    out.dir = best.pool.dir;
    out.sweepLevel = best.pool.level;
    out.sweepLabel = best.pool.label;
    out.sweepIdx = best.idx;
    out.extreme = best.extreme;
    out.reclaimOk = true;

    var ob = hgGoldFreshOb(rows, out.dir);
    var fvg = hgGoldFreshFvg(rows, out.dir);
    var entryZone = ob.ok ? ob : fvg;
    var buf = atr * HG_GOLD_SB_BUF_ATR;
    var stop = (out.dir === 'long') ? (best.extreme - buf) : (best.extreme + buf);
    var px = rows[rows.length - 1].c;
    var entry = px;
    if (entryZone.ok){
      out.entryZone = entryZone.zone;
      entry = ob.ok && isFinite(ob.entry50) ? ob.entry50
        : ((entryZone.zone.lo + entryZone.zone.hi) / 2);
    }

    var t1 = NaN, t2 = NaN;
    if (out.dir === 'long'){
      if (asia && isFinite(asia.mid)) t1 = asia.mid;
      if (asia && isFinite(asia.hi)) t2 = asia.hi;
      if (!isFinite(t1)) t1 = entry + atr;
      if (!isFinite(t2)) t2 = entry + atr * 2;
    } else {
      if (asia && isFinite(asia.mid)) t1 = asia.mid;
      if (asia && isFinite(asia.lo)) t2 = asia.lo;
      if (!isFinite(t1)) t1 = entry - atr;
      if (!isFinite(t2)) t2 = entry - atr * 2;
    }
    var risk = Math.abs(entry - stop);
    var rr = (risk > 0 && isFinite(t1)) ? Math.abs(t1 - entry) / risk : NaN;

    out.entry = entry;
    out.stop = stop;
    out.t1 = t1;
    out.t2 = t2;
    out.rr = rr;
    out.plan = {
      entryModel: 'session-bound reclaim — retrace into OB/FVG after Asia/prior-hour sweep',
      stop: stop,
      t1: t1, t2: t2,
      cancel: 'close back beyond sweep extreme or outside SB window'
    };

    var zoneOk = !!(entryZone && entryZone.ok);
    var rrOk = isFinite(rr) && rr >= HG_GOLD_SB_RR_ALERT;
    out.confirmed = !!(out.reclaimOk && zoneOk && rrOk && out.inWindow);
    out.ok = true;
    out.tier = out.confirmed ? 'alert' : (zoneOk ? 'watch' : 'watch');
    out.why = (out.confirmed ? 'SILVER BULLET ALERT ' : 'SILVER BULLET ')
      + String(out.dir).toUpperCase()
      + ' · ' + (win.name || 'SB')
      + ' · ' + best.pool.label + ' @ ' + best.pool.level.toFixed(2)
      + ' · age ' + best.age
      + (zoneOk ? (' · ' + (ob.ok ? 'OB' : 'FVG') + ' entry') : ' · waiting OB/FVG')
      + (isFinite(rr) ? (' · ' + rr.toFixed(2) + 'R') : '')
      + (isFinite(best.rvol) ? (' · RVOL ' + best.rvol.toFixed(2)) : '');
    return out;
  }catch(e){ out.why = 'session-bound sweep error'; return out; }
}

function hgGoldSessionBoundSweepHtml(sb){
  try{
    if (!sb || !(sb.ok || sb.tier === 'watch' || sb.tier === 'alert')) return '';
    var h = '<div class="note" data-hg-gold-silverb="1" style="margin-top:8px">';
    h += '<b>SILVER BULLET</b> · ' + String(sb.tier || 'idle').toUpperCase();
    if (sb.window) h += ' · ' + String(sb.window);
    if (sb.dir) h += ' · ' + String(sb.dir).toUpperCase();
    if (isFinite(sb.sweepLevel)) h += ' · sweep ' + (+sb.sweepLevel).toFixed(2);
    if (sb.sweepLabel) h += ' (' + String(sb.sweepLabel).replace(/[<>&]/g, '') + ')';
    if (sb.entryZone){
      h += '<div class="dim" style="margin-top:4px">entry zone '
        + (+sb.entryZone.lo).toFixed(2) + '–' + (+sb.entryZone.hi).toFixed(2);
      if (isFinite(sb.entry)) h += ' · entry ~' + (+sb.entry).toFixed(2);
      if (isFinite(sb.stop)) h += ' · stop ' + (+sb.stop).toFixed(2);
      if (isFinite(sb.t1)) h += ' · TP1 ' + (+sb.t1).toFixed(2);
      if (isFinite(sb.rr)) h += ' · ' + (+sb.rr).toFixed(2) + 'R';
      h += '</div>';
    }
    if (sb.why) h += '<div class="dim" style="margin-top:2px">' + String(sb.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* =========================================================================
   GOLD PART 4 — Advanced strategies S9–S18 (hg-v562)
   One vote per family still applies via confluence. Footprint/S16 and silver
   S13 stay UNCHECKED without COMEX bid-ask / XAG feeds.
========================================================================= */

var HG_GOLD_P4_EQ_BAND = 0.15;
var HG_GOLD_P4_ADR_FADE = 1.20;
var HG_GOLD_P4_NR_LOOK = 7;
var HG_GOLD_P4_GAP_MIN_ADR = 0.30;

function hgGoldPart4PremiumDiscount(rows){
  var out = {
    ok: false, eq: NaN, hi: NaN, lo: NaN, range: NaN, pct: NaN,
    half: null, nearEq: false, longOk: false, shortOk: false, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30){ out.why = 'short series'; return out; }
    var ms = goldMarketStructure(rows);
    var hi = -Infinity, lo = Infinity, i0 = Math.max(0, rows.length - 40), i;
    for (i = i0; i < rows.length; i++){
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
    }
    if (!(isFinite(hi) && isFinite(lo) && hi > lo)){ out.why = 'no dealing range'; return out; }
    var eq = (hi + lo) / 2;
    var range = hi - lo;
    var px = rows[rows.length - 1].c;
    var pct = (px - lo) / range;
    out.ok = true;
    out.hi = hi; out.lo = lo; out.eq = eq; out.range = range; out.pct = pct;
    out.half = pct >= 0.5 ? 'PREMIUM' : 'DISCOUNT';
    out.nearEq = Math.abs(pct - 0.5) <= HG_GOLD_P4_EQ_BAND;
    out.longOk = false; out.shortOk = false;
    if (out.half === 'DISCOUNT' && !out.nearEq) out.longOk = true;
    if (out.half === 'PREMIUM' && !out.nearEq) out.shortOk = true;
    out.why = out.half + ' · EQ ' + eq.toFixed(2)
      + (out.nearEq ? ' · NEAR EQ — WAIT' : '')
      + (ms && ms.trend ? (' · struct ' + ms.trend) : '');
    return out;
  }catch(e){ out.why = 'P/D error'; return out; }
}

function hgGoldPart4ApplyDiscountFilter(cand, pd){
  try{
    if (!cand || !pd || !pd.ok) return cand;
    if (!Array.isArray(cand.stamps)) cand.stamps = [];
    if (pd.nearEq){
      cand.demoted = true;
      if (cand.stamps.indexOf('NEAR EQ') < 0) cand.stamps.push('NEAR EQ');
      return cand;
    }
    if (cand.dir === 'long' && !pd.longOk){
      cand.demoted = true;
      if (cand.stamps.indexOf('PREMIUM LONG') < 0) cand.stamps.push('PREMIUM LONG');
    } else if (cand.dir === 'short' && !pd.shortOk){
      cand.demoted = true;
      if (cand.stamps.indexOf('DISCOUNT SHORT') < 0) cand.stamps.push('DISCOUNT SHORT');
    } else if ((cand.dir === 'long' && pd.longOk) || (cand.dir === 'short' && pd.shortOk)){
      if (cand.stamps.indexOf('S9 P/D OK') < 0) cand.stamps.push('S9 P/D OK');
    }
    return cand;
  }catch(e){ return cand; }
}

function hgGoldPart4PoorExtreme(rows){
  var out = { ok: false, poorHigh: null, poorLow: null, excessHigh: null, excessLow: null, why: '' };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 20) return out;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var tol = 0.15 * atr;
    var i, hi = -Infinity, lo = Infinity, hiI = -1, loI = -1;
    for (i = Math.max(0, rows.length - 12); i < rows.length; i++){
      if (rows[i].h >= hi){ hi = rows[i].h; hiI = i; }
      if (rows[i].l <= lo){ lo = rows[i].l; loI = i; }
    }
    var shareH = 0, shareL = 0;
    for (i = Math.max(0, rows.length - 12); i < rows.length; i++){
      if (Math.abs(rows[i].h - hi) <= tol) shareH++;
      if (Math.abs(rows[i].l - lo) <= tol) shareL++;
    }
    var hiBar = rows[hiI], loBar = rows[loI];
    var hiWick = hiBar.h - Math.max(hiBar.o, hiBar.c);
    var loWick = Math.min(loBar.o, loBar.c) - loBar.l;
    if (shareH >= 2){ out.poorHigh = { level: hi, bars: shareH }; out.ok = true; }
    else if (hiWick >= 0.6 * (hiBar.h - hiBar.l) && hiWick >= 0.35 * atr){
      out.excessHigh = { level: hi, wick: hiWick }; out.ok = true;
    }
    if (shareL >= 2){ out.poorLow = { level: lo, bars: shareL }; out.ok = true; }
    else if (loWick >= 0.6 * (loBar.h - loBar.l) && loWick >= 0.35 * atr){
      out.excessLow = { level: lo, wick: loWick }; out.ok = true;
    }
    out.why = (out.poorHigh ? ('poor high ' + hi.toFixed(2) + ' ') : '')
      + (out.excessHigh ? ('excess high ' + hi.toFixed(2) + ' ') : '')
      + (out.poorLow ? ('poor low ' + lo.toFixed(2) + ' ') : '')
      + (out.excessLow ? ('excess low ' + lo.toFixed(2)) : '');
    return out;
  }catch(e){ return out; }
}

function hgGoldPart4Nr7(rows){
  var out = { ok: false, nr7: false, inside: false, hi: NaN, lo: NaN, why: '' };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 80){ out.why = 'need more bars for NR7'; return out; }
    var days = {}, i, key;
    for (i = 0; i < rows.length; i++){
      if (!isFinite(rows[i].t)) continue;
      key = String(Math.floor(rows[i].t / 86400));
      if (!days[key]) days[key] = { hi: rows[i].h, lo: rows[i].l };
      else {
        if (rows[i].h > days[key].hi) days[key].hi = rows[i].h;
        if (rows[i].l < days[key].lo) days[key].lo = rows[i].l;
      }
    }
    var keys = Object.keys(days).sort();
    if (keys.length < HG_GOLD_P4_NR_LOOK + 1){ out.why = 'not enough sessions'; return out; }
    var recent = keys.slice(-(HG_GOLD_P4_NR_LOOK + 1));
    var today = days[recent[recent.length - 1]];
    var todayR = today.hi - today.lo;
    var minR = Infinity, j, r;
    for (j = 0; j < recent.length - 1; j++){
      r = days[recent[j]].hi - days[recent[j]].lo;
      if (r < minR) minR = r;
    }
    out.nr7 = todayR <= minR;
    var yday = days[recent[recent.length - 2]];
    out.inside = today.hi < yday.hi && today.lo > yday.lo;
    out.hi = today.hi; out.lo = today.lo;
    out.ok = out.nr7 || out.inside;
    out.why = (out.nr7 ? 'NR7 ' : '') + (out.inside ? 'inside-day ' : '')
      + 'box ' + today.lo.toFixed(2) + '–' + today.hi.toFixed(2);
    return out;
  }catch(e){ return out; }
}

function hgGoldPart4AsiaSd(rows, asia){
  var out = {
    ok: false, mid: NaN, height: NaN,
    p1: NaN, p2: NaN, p25: NaN, m1: NaN, m2: NaN, m25: NaN, why: ''
  };
  try{
    asia = asia || goldAsianRange(rows);
    if (!asia || !isFinite(asia.hi) || !isFinite(asia.lo) || asia.hi <= asia.lo){
      out.why = 'Asia box unread'; return out;
    }
    var hgt = asia.hi - asia.lo;
    var mid = (asia.hi + asia.lo) / 2;
    out.ok = true;
    out.mid = mid; out.height = hgt;
    out.p1 = asia.hi + 1.0 * hgt; out.p2 = asia.hi + 2.0 * hgt; out.p25 = asia.hi + 2.5 * hgt;
    out.m1 = asia.lo - 1.0 * hgt; out.m2 = asia.lo - 2.0 * hgt; out.m25 = asia.lo - 2.5 * hgt;
    out.why = 'Asia SD · mid ' + mid.toFixed(2) + ' · H ' + hgt.toFixed(2)
      + ' · ±1 ' + out.m1.toFixed(2) + '/' + out.p1.toFixed(2);
    return out;
  }catch(e){ return out; }
}

function hgGoldPart4LookAboveFail(rows){
  var out = {
    ok: false, dir: null, balHi: NaN, balLo: NaN, probe: NaN,
    entry: NaN, stop: NaN, t1: NaN, t2: NaN, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 60){ out.why = 'short series'; return out; }
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var look = Math.min(rows.length - 4, 48);
    var i0 = rows.length - look - 3;
    var balHi = -Infinity, balLo = Infinity, i;
    for (i = i0; i < rows.length - 3; i++){
      if (rows[i].h > balHi) balHi = rows[i].h;
      if (rows[i].l < balLo) balLo = rows[i].l;
    }
    if (!(balHi > balLo)) return out;
    var probeBar = null;
    for (i = rows.length - 3; i < rows.length; i++){
      if (rows[i].h > balHi && rows[i].c < balHi){ probeBar = rows[i]; break; }
      if (rows[i].l < balLo && rows[i].c > balLo){ probeBar = rows[i]; break; }
    }
    if (!probeBar){ out.why = 'no failed probe of balance edge'; return out; }
    var longFail = probeBar.l < balLo && probeBar.c > balLo;
    var shortFail = probeBar.h > balHi && probeBar.c < balHi;
    if (!longFail && !shortFail){ out.why = 'probe not a fail'; return out; }
    var ext = longFail ? probeBar.l : probeBar.h;
    var breach = longFail ? (balLo - ext) : (ext - balHi);
    if (breach > 0.4 * atr){ out.why = 'probe too deep — possible breakdown'; return out; }
    out.ok = true;
    out.dir = longFail ? 'long' : 'short';
    out.balHi = balHi; out.balLo = balLo; out.probe = ext;
    out.entry = probeBar.c;
    out.stop = longFail ? (ext - 0.2 * atr) : (ext + 0.2 * atr);
    out.t1 = (balHi + balLo) / 2;
    out.t2 = longFail ? balHi : balLo;
    out.why = 'look-' + (longFail ? 'below' : 'above') + '-and-fail · balance '
      + balLo.toFixed(2) + '–' + balHi.toFixed(2);
    return out;
  }catch(e){ return out; }
}

function hgGoldPart4Gap(rows, adr){
  var out = { ok: false, dir: null, gapLo: NaN, gapHi: NaN, fill: NaN, why: '' };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 5) return out;
    var a = adr && isFinite(adr.adr) ? adr.adr : NaN;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    var minGap = isFinite(a) ? HG_GOLD_P4_GAP_MIN_ADR * a : 0.5 * atr;
    var prev = rows[rows.length - 2], cur = rows[rows.length - 1];
    if (!prev || !cur) return out;
    if (cur.l > prev.h + minGap){
      out.ok = true; out.dir = 'short';
      out.gapLo = prev.h; out.gapHi = cur.l; out.fill = prev.c;
      out.why = 'gap UP ' + out.gapLo.toFixed(2) + '→' + out.gapHi.toFixed(2) + ' — fill ' + out.fill.toFixed(2);
    } else if (cur.h < prev.l - minGap){
      out.ok = true; out.dir = 'long';
      out.gapLo = cur.h; out.gapHi = prev.l; out.fill = prev.c;
      out.why = 'gap DOWN ' + out.gapHi.toFixed(2) + '→' + out.gapLo.toFixed(2) + ' — fill ' + out.fill.toFixed(2);
    }
    return out;
  }catch(e){ return out; }
}

function hgGoldPart4Engine(rows, opts){
  var out = {
    ok: false, pd: null, nr7: null, poor: null, asiaSd: null, laf: null,
    gap: null, adr: null, strategies: [], unchecked: ['S13 silver', 'S16 footprint'],
    why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40){ out.why = 'need ≥40 bars'; return out; }
    if (opts.newsGate && opts.newsGate.lock){
      out.why = 'news lockout — Part4 entries paused';
      return out;
    }
    out.pd = hgGoldPart4PremiumDiscount(rows);
    out.nr7 = hgGoldPart4Nr7(rows);
    out.poor = hgGoldPart4PoorExtreme(rows);
    out.asiaSd = hgGoldPart4AsiaSd(rows, opts.asia);
    out.laf = hgGoldPart4LookAboveFail(rows);
    out.adr = goldADR(rows, 10);
    out.gap = hgGoldPart4Gap(rows, out.adr);

    function pushS(key, dir, level, grade, why, plan){
      out.strategies.push({
        key: key, dir: dir, level: level, grade: grade || 'watch', why: why, plan: plan || null
      });
    }

    if (out.pd && out.pd.ok && !out.pd.nearEq){
      pushS('p4disc', out.pd.longOk ? 'long' : (out.pd.shortOk ? 'short' : null),
        out.pd.eq, 'frame', 'S9 ' + out.pd.why);
    }

    if (out.nr7 && out.nr7.ok){
      var px = rows[rows.length - 1].c;
      if (px > out.nr7.hi){
        pushS('p4nr7', 'long', out.nr7.hi, 'forming',
          'S12 NR7/inside break UP — ' + out.nr7.why,
          { stop: out.nr7.lo, t1: out.nr7.hi + (out.nr7.hi - out.nr7.lo) });
      } else if (px < out.nr7.lo){
        pushS('p4nr7', 'short', out.nr7.lo, 'forming',
          'S12 NR7/inside break DOWN — ' + out.nr7.why,
          { stop: out.nr7.hi, t1: out.nr7.lo - (out.nr7.hi - out.nr7.lo) });
      } else {
        pushS('p4nr7', null, out.nr7.hi, 'watch', 'S12 compression watch — ' + out.nr7.why);
      }
    }

    if (out.adr && isFinite(out.adr.pctOfADR) && out.adr.pctOfADR >= HG_GOLD_P4_ADR_FADE){
      var fadeDir = out.adr.bias === 'short' ? 'short' : 'long';
      if (out.pd && ((fadeDir === 'short' && out.pd.shortOk) || (fadeDir === 'long' && out.pd.longOk))){
        pushS('p4adrx', fadeDir, rows[rows.length - 1].c, 'forming',
          'S14 ADR ' + (out.adr.pctOfADR * 100).toFixed(0) + '% used — fade in ' + out.pd.half);
      }
    }

    if (out.poor && out.poor.ok){
      if (out.poor.poorHigh)
        pushS('p4poor', 'long', out.poor.poorHigh.level, 'frame',
          'S15 poor high magnet ' + out.poor.poorHigh.level.toFixed(2));
      if (out.poor.poorLow)
        pushS('p4poor', 'short', out.poor.poorLow.level, 'frame',
          'S15 poor low magnet ' + out.poor.poorLow.level.toFixed(2));
      if (out.poor.excessHigh && out.pd && out.pd.shortOk)
        pushS('p4poor', 'short', out.poor.excessHigh.level, 'watch',
          'S15 excess high fade ' + out.poor.excessHigh.level.toFixed(2));
      if (out.poor.excessLow && out.pd && out.pd.longOk)
        pushS('p4poor', 'long', out.poor.excessLow.level, 'watch',
          'S15 excess low fade ' + out.poor.excessLow.level.toFixed(2));
    }

    if (out.laf && out.laf.ok){
      pushS('p4laf', out.laf.dir, out.laf.entry, 'forming', out.laf.why, {
        stop: out.laf.stop, t1: out.laf.t1, t2: out.laf.t2
      });
    }

    if (out.gap && out.gap.ok)
      pushS('p4gap', out.gap.dir, out.gap.fill, 'watch', 'S11 ' + out.gap.why);

    if (out.asiaSd && out.asiaSd.ok){
      pushS('p4asiasd', null, out.asiaSd.mid, 'frame', 'S18 ' + out.asiaSd.why);
      var last = rows[rows.length - 1];
      if (isFinite(out.asiaSd.m25) && last.l < out.asiaSd.m25)
        pushS('p4asiasd', 'short', out.asiaSd.m25, 'watch',
          'S18 beyond −2.5 SD — breakdown not fade');
      if (isFinite(out.asiaSd.p25) && last.h > out.asiaSd.p25)
        pushS('p4asiasd', 'long', out.asiaSd.p25, 'watch',
          'S18 beyond +2.5 SD — breakout not fade');
    }

    out.ok = out.strategies.length > 0;
    out.why = out.ok
      ? (out.strategies.length + ' Part4 hit(s) · unchecked: ' + out.unchecked.join(', '))
      : ('no Part4 trigger · unchecked: ' + out.unchecked.join(', '));
    return out;
  }catch(e){ out.why = 'Part4 engine error'; return out; }
}

function hgGoldPart4Html(p4){
  try{
    if (!p4 || !(p4.ok || (p4.pd && p4.pd.ok) || (p4.asiaSd && p4.asiaSd.ok))) return '';
    var h = '<div class="note" data-hg-gold-part4="1" style="margin-top:8px">';
    h += '<b>PART4 S9–S18</b>';
    if (p4.pd && p4.pd.ok) h += ' · ' + p4.pd.half + (p4.pd.nearEq ? ' · NEAR EQ' : '');
    if (p4.adr && isFinite(p4.adr.pctOfADR)) h += ' · ADR ' + (p4.adr.pctOfADR * 100).toFixed(0) + '%';
    if (p4.unchecked && p4.unchecked.length)
      h += '<div class="dim" style="margin-top:2px">unchecked: ' + p4.unchecked.join(', ') + '</div>';
    var i, s, n = Math.min(4, (p4.strategies || []).length);
    for (i = 0; i < n; i++){
      s = p4.strategies[i];
      h += '<div style="margin-top:4px"><b>' + String(s.key).toUpperCase() + '</b>'
        + (s.dir ? (' ' + String(s.dir).toUpperCase()) : '')
        + (isFinite(s.level) ? (' @ ' + (+s.level).toFixed(2)) : '')
        + ' — ' + String(s.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    if (p4.why) h += '<div class="dim" style="margin-top:4px">' + String(p4.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}


/* =========================================================================
   GOLD PART 5 — Physical / regime / S19–S28 (hg-v569)
   One vote per family. Nothing here turns NO ENTRY into ENTER.
   Physical feeds (Shanghai/Indian/COMEX/EFP/FedWatch/GVZ/options OI) stay
   UNCHECKED without opts — S28 scores only when fields are supplied.
========================================================================= */

var HG_GOLD_P5_KER_TREND = 0.60;
var HG_GOLD_P5_KER_CHOP = 0.30;
var HG_GOLD_P5_KER_N = 20;
/* ≥72×1H so composite covers ≥3 UTC sessions; excludeTail keeps spring out of range. */
var HG_GOLD_P5_SPRING_LOOK = 120;
var HG_GOLD_P5_TEST_MIN = 3;
var HG_GOLD_P5_TEST_MAX = 12;
var HG_GOLD_P5_TURTLE_SESS = 20;
var HG_GOLD_P5_DRIVE_BARS = 12;

function hgGoldPart5KerRegime(rows){
  var out = {
    ok: false, er: NaN, regime: 'MIXED', adx: NaN, adxAgree: false,
    enabled: {}, disabled: {}, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < HG_GOLD_P5_KER_N + 2){ out.why = 'short series'; return out; }
    var ker = calculateKaufmanER(rows, HG_GOLD_P5_KER_N);
    var er = ker && isFinite(ker.er) ? ker.er : NaN;
    out.er = er;
    if (!(isFinite(er))){ out.why = 'KER unread'; return out; }
    out.ok = true;
    if (er > HG_GOLD_P5_KER_TREND) out.regime = 'TREND';
    else if (er < HG_GOLD_P5_KER_CHOP) out.regime = 'CHOP';
    else out.regime = 'MIXED';
    try{
      var adxR = goldADX(rows);
      if (adxR && isFinite(adxR.adx)){
        out.adx = adxR.adx;
        if (out.regime === 'TREND' && adxR.adx > 25) out.adxAgree = true;
        if (out.regime === 'CHOP' && adxR.adx < 20) out.adxAgree = true;
      }
    }catch(eA){}
    /* S23 enable/disable classes (strategy keys) */
    if (out.regime === 'TREND'){
      out.enabled = { p5wyck: 0, p5turt: 1, p5vwap: 0, p5drive: 0, p5open: 1, p5news: 1, cont: 1 };
      out.disabled = { p5vwap: 1, p5drive: 1, fade: 1 };
    } else if (out.regime === 'CHOP'){
      out.enabled = { p5wyck: 1, p5turt: 1, p5vwap: 1, p5drive: 1, p5open: 0, p5news: 1, rot: 1 };
      out.disabled = { cont: 1 };
    } else {
      out.enabled = { p5wyck: 1, p5turt: 1, p5vwap: 1, p5drive: 1, p5open: 1, p5news: 1 };
      out.disabled = {};
    }
    out.why = 'KER ' + er.toFixed(2) + ' · ' + out.regime
      + (isFinite(out.adx) ? (' · ADX ' + out.adx.toFixed(0) + (out.adxAgree ? ' agree' : '')) : '');
    return out;
  }catch(e){ out.why = 'KER error'; return out; }
}

function hgGoldPart5SessionAnchor(rows, nowMs){
  try{
    rows = __rows(rows);
    if (!rows || !rows.length) return 0;
    var lastT = rows[rows.length - 1].t;
    var ms = isFinite(nowMs) ? __toMs(nowMs) : ((lastT < 1e12) ? lastT * 1000 : lastT);
    if (!isFinite(ms)) ms = Date.now();
    var d = new Date(ms);
    var hour = d.getUTCHours() + d.getUTCMinutes() / 60;
    var start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22, 0, 0);
    if (hour < 22) start -= 86400000;
    var startSec = start / 1000;
    var i;
    for (i = 0; i < rows.length; i++){
      if (isFinite(rows[i].t) && rows[i].t >= startSec) return i;
    }
    return Math.max(0, rows.length - 48);
  }catch(e){ return 0; }
}

function hgGoldPart5SessionVwap(rows, opts){
  var out = {
    ok: false, vwap: NaN, sd: NaN, u1: NaN, u2: NaN, l1: NaN, l2: NaN,
    band: null, distSig: NaN, anchor: 0, why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 10){ out.why = 'short series'; return out; }
    var a = hgGoldPart5SessionAnchor(rows, opts.now);
    var bands = goldVWAPBands(rows, a);
    if (!bands || !isFinite(bands.value) || !(bands.stdev > 0)){
      out.why = 'session VWAP unread'; return out;
    }
    out.ok = true;
    out.vwap = bands.value; out.sd = bands.stdev;
    out.u1 = bands.upper1; out.u2 = bands.upper2;
    out.l1 = bands.lower1; out.l2 = bands.lower2;
    out.band = bands.band; out.distSig = bands.distSig; out.anchor = a;
    out.why = 'sess VWAP ' + out.vwap.toFixed(2) + ' · σ ' + out.sd.toFixed(2)
      + (out.band ? (' · ' + out.band) : '');
    return out;
  }catch(e){ out.why = 'VWAP error'; return out; }
}

function hgGoldPart5CompositeRange(rows, look, excludeTail){
  var out = { ok: false, hi: NaN, lo: NaN, poc: NaN, i0: 0, i1: 0, sessions: 0 };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 20) return out;
    look = look || HG_GOLD_P5_SPRING_LOOK;
    excludeTail = Math.max(0, excludeTail | 0);
    var i1 = Math.max(1, rows.length - excludeTail);
    var i0 = Math.max(0, i1 - look);
    if (i1 - i0 < 16) return out;
    var hi = -Infinity, lo = Infinity, i;
    var days = {};
    for (i = i0; i < i1; i++){
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      if (isFinite(rows[i].t)) days[String(Math.floor(rows[i].t / 86400))] = 1;
    }
    if (!(hi > lo)) return out;
    out.ok = true; out.hi = hi; out.lo = lo; out.i0 = i0; out.i1 = i1;
    out.poc = (hi + lo) / 2;
    out.sessions = Object.keys(days).length;
    return out;
  }catch(e){ return out; }
}

/** S19 — Wyckoff spring/upthrust + secondary test (enter on the test).
    Range is measured on bars BEFORE the spring/test zone so a sweep can
    actually print below/above the composite edges. */
function hgGoldPart5Wyckoff(rows){
  var out = {
    ok: false, dir: null, grade: 'watch', springI: -1, testI: -1,
    springExt: NaN, testExt: NaN, entry: NaN, stop: NaN, t1: NaN, t2: NaN,
    rangeHi: NaN, rangeLo: NaN, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 40){ out.why = 'short series'; return out; }
    /* Exclude spring+test window from the composite so extremes remain sweepable */
    var exclude = HG_GOLD_P5_TEST_MAX + HG_GOLD_P5_TEST_MIN + 2;
    var rng = hgGoldPart5CompositeRange(rows, HG_GOLD_P5_SPRING_LOOK, exclude);
    if (!rng.ok || rng.sessions < 3){ out.why = 'composite range < 3 sessions'; return out; }
    out.rangeHi = rng.hi; out.rangeLo = rng.lo;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var i, springI = -1, springDir = null, springExt = NaN, springVol = 0;
    var searchFrom = Math.max(rng.i1, rows.length - 36);
    var searchTo = rows.length - HG_GOLD_P5_TEST_MIN;
    for (i = searchFrom; i < searchTo; i++){
      var b = rows[i], pen;
      if (b.l < rng.lo && b.c > rng.lo){
        pen = rng.lo - b.l;
        if (pen >= 0.05 * atr){
          springI = i; springDir = 'long'; springExt = b.l;
          springVol = (isFinite(b.v) && b.v > 0) ? b.v : 1;
        }
      } else if (b.h > rng.hi && b.c < rng.hi){
        pen = b.h - rng.hi;
        if (pen >= 0.05 * atr){
          springI = i; springDir = 'short'; springExt = b.h;
          springVol = (isFinite(b.v) && b.v > 0) ? b.v : 1;
        }
      }
    }
    if (springI < 0 || !springDir){ out.why = 'no spring/upthrust of composite range'; return out; }
    var testI = -1, testExt = NaN;
    var maxI = Math.min(rows.length - 1, springI + HG_GOLD_P5_TEST_MAX);
    var minI = springI + HG_GOLD_P5_TEST_MIN;
    for (i = minI; i <= maxI; i++){
      var tb = rows[i];
      var tVol = (isFinite(tb.v) && tb.v > 0) ? tb.v : 1;
      if (tVol > 0.6 * springVol) continue;
      if (springDir === 'long'){
        var springPen = rng.lo - springExt;
        if (!(springPen > 0)) continue;
        if (tb.l < rng.lo && tb.l > springExt + 0.2 * springPen && tb.c > rng.lo){
          testI = i; testExt = tb.l;
        }
      } else {
        var springPenS = springExt - rng.hi;
        if (!(springPenS > 0)) continue;
        if (tb.h > rng.hi && tb.h < springExt - 0.2 * springPenS && tb.c < rng.hi){
          testI = i; testExt = tb.h;
        }
      }
    }
    if (testI < 0){
      out.ok = true; out.dir = springDir; out.grade = 'forming';
      out.springI = springI; out.springExt = springExt;
      out.entry = rows[springI].c;
      out.stop = springDir === 'long' ? springExt - 0.2 * atr : springExt + 0.2 * atr;
      out.t1 = rng.poc; out.t2 = springDir === 'long' ? rng.hi : rng.lo;
      out.why = 'S19 spring ' + springDir + ' @ ' + springExt.toFixed(2)
        + ' — waiting secondary test (shallower, ≤0.6× vol)';
      return out;
    }
    out.ok = true; out.dir = springDir;
    out.springI = springI; out.testI = testI;
    out.springExt = springExt; out.testExt = testExt;
    out.entry = rows[testI].c;
    out.stop = springDir === 'long' ? springExt - 0.2 * atr : springExt + 0.2 * atr;
    out.t1 = rng.poc; out.t2 = springDir === 'long' ? rng.hi : rng.lo;
    out.grade = (testI >= rows.length - 3) ? 'confirmed' : 'forming';
    out.why = 'S19 ' + (springDir === 'long' ? 'spring' : 'upthrust')
      + ' + secondary test @ ' + testExt.toFixed(2)
      + ' · entry ' + out.entry.toFixed(2);
    return out;
  }catch(e){ out.why = 'Wyckoff error'; return out; }
}

/** Aggregate session highs/lows (UTC day) for turtle extremes. */
function hgGoldPart5SessionExtremes(rows, nSess){
  var out = [];
  try{
    rows = __rows(rows);
    if (!rows || !rows.length) return out;
    var map = {}, keys = [], i, k;
    for (i = 0; i < rows.length; i++){
      if (!isFinite(rows[i].t)) continue;
      k = String(Math.floor(rows[i].t / 86400));
      if (!map[k]){ map[k] = { hi: rows[i].h, lo: rows[i].l, i: i }; keys.push(k); }
      else {
        if (rows[i].h > map[k].hi) map[k].hi = rows[i].h;
        if (rows[i].l < map[k].lo) map[k].lo = rows[i].l;
        map[k].i = i;
      }
    }
    keys.sort();
    nSess = nSess || HG_GOLD_P5_TURTLE_SESS;
    var slice = keys.slice(-(nSess + 2));
    for (i = 0; i < slice.length; i++) out.push(map[slice[i]]);
    return out;
  }catch(e){ return out; }
}

/** S20 — Turtle-soup failed 20-session extreme. */
function hgGoldPart5TurtleSoup(rows){
  var out = {
    ok: false, dir: null, grade: 'watch', extreme: NaN, prior: NaN,
    entry: NaN, stop: NaN, t1: NaN, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 80){ out.why = 'short series'; return out; }
    var sess = hgGoldPart5SessionExtremes(rows, HG_GOLD_P5_TURTLE_SESS);
    if (sess.length < HG_GOLD_P5_TURTLE_SESS){ out.why = 'need 20 sessions'; return out; }
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var cur = sess[sess.length - 1];
    var prior = sess.slice(0, -1);
    var priorLo = Infinity, priorHi = -Infinity, priorLoAge = -1, priorHiAge = -1, j;
    for (j = 0; j < prior.length; j++){
      if (prior[j].lo < priorLo){ priorLo = prior[j].lo; priorLoAge = prior.length - 1 - j; }
      if (prior[j].hi > priorHi){ priorHi = prior[j].hi; priorHiAge = prior.length - 1 - j; }
    }
    var last = rows[rows.length - 1];
    var prev = rows[rows.length - 2];
    var vprof = goldVolumeProfile(rows, 100, 50);
    function nearNode(px){
      if (!vprof) return false;
      var tol = Math.max(atr * 0.35, (vprof.binSize || 1) * 2);
      if (isFinite(vprof.pocPrice) && Math.abs(px - vprof.pocPrice) <= tol) return true;
      if (isFinite(vprof.vah) && Math.abs(px - vprof.vah) <= tol) return true;
      if (isFinite(vprof.val) && Math.abs(px - vprof.val) <= tol) return true;
      var hv = vprof.hvns || [];
      var hi;
      for (hi = 0; hi < hv.length; hi++){
        if (Math.abs(px - hv[hi]) <= tol) return true;
      }
      return false;
    }
    /* New 20-session low + reclaim */
    if (cur.lo < priorLo && priorLoAge >= 4){
      var sweptLo = cur.lo;
      if ((last.l <= priorLo && last.c > priorLo) || (prev && prev.l <= priorLo && last.c > priorLo)){
        if (!nearNode(priorLo)){
          out.ok = true; out.dir = 'long'; out.grade = 'watch';
          out.extreme = sweptLo; out.prior = priorLo;
          out.why = 'S20 turtle low but LVN/no HVN — grade C skip location';
          return out;
        }
        out.ok = true; out.dir = 'long'; out.grade = 'confirmed';
        out.extreme = sweptLo; out.prior = priorLo;
        out.entry = last.c; out.stop = sweptLo - 0.2 * atr;
        out.t1 = isFinite(vprof && vprof.pocPrice) ? vprof.pocPrice : priorLo + 1.5 * atr;
        out.why = 'S20 turtle-soup LONG — new 20s low ' + sweptLo.toFixed(2)
          + ' reclaimed prior ' + priorLo.toFixed(2);
        return out;
      }
    }
    if (cur.hi > priorHi && priorHiAge >= 4){
      var sweptHi = cur.hi;
      if ((last.h >= priorHi && last.c < priorHi) || (prev && prev.h >= priorHi && last.c < priorHi)){
        if (!nearNode(priorHi)){
          out.ok = true; out.dir = 'short'; out.grade = 'watch';
          out.extreme = sweptHi; out.prior = priorHi;
          out.why = 'S20 turtle high but LVN/no HVN — grade C skip location';
          return out;
        }
        out.ok = true; out.dir = 'short'; out.grade = 'confirmed';
        out.extreme = sweptHi; out.prior = priorHi;
        out.entry = last.c; out.stop = sweptHi + 0.2 * atr;
        out.t1 = isFinite(vprof && vprof.pocPrice) ? vprof.pocPrice : priorHi - 1.5 * atr;
        out.why = 'S20 turtle-soup SHORT — new 20s high ' + sweptHi.toFixed(2)
          + ' rejected prior ' + priorHi.toFixed(2);
        return out;
      }
    }
    out.why = 'no turtle-soup reclaim';
    return out;
  }catch(e){ out.why = 'turtle error'; return out; }
}

/** S22 — Session VWAP ±2σ reversion on CHOP days. */
function hgGoldPart5VwapFade(rows, vwap, ker){
  var out = {
    ok: false, dir: null, grade: 'watch', entry: NaN, stop: NaN, t1: NaN, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || !vwap || !vwap.ok || !ker || !ker.ok) return out;
    if (ker.regime !== 'CHOP'){ out.why = 'S22 needs KER < 0.3 (got ' + ker.regime + ')'; return out; }
    var last = rows[rows.length - 1];
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var vprof = goldVolumeProfile(rows, 80, 40);
    var tol = Math.max(3, atr * 0.25);
    function hvnNear(px){
      if (!vprof || !vprof.hvns) return false;
      var i;
      for (i = 0; i < vprof.hvns.length; i++){
        if (Math.abs(px - vprof.hvns[i]) <= tol) return true;
      }
      if (isFinite(vprof.vah) && Math.abs(px - vprof.vah) <= tol) return true;
      if (isFinite(vprof.val) && Math.abs(px - vprof.val) <= tol) return true;
      return false;
    }
    var body = Math.abs(last.c - last.o);
    var rng = last.h - last.l;
    var reject = rng > 0 && body <= 0.55 * rng;
    if (last.h >= vwap.u2 && last.c < vwap.u2 && reject && hvnNear(vwap.u2)){
      out.ok = true; out.dir = 'short'; out.grade = 'forming';
      out.entry = last.c; out.stop = last.h + 0.2 * atr; out.t1 = vwap.vwap;
      out.why = 'S22 VWAP +2σ fade SHORT → VWAP ' + vwap.vwap.toFixed(2);
      if (Math.abs(out.entry - out.stop) > 0 && Math.abs(out.t1 - out.entry) / Math.abs(out.entry - out.stop) >= 2)
        out.grade = 'confirmed';
      return out;
    }
    if (last.l <= vwap.l2 && last.c > vwap.l2 && reject && hvnNear(vwap.l2)){
      out.ok = true; out.dir = 'long'; out.grade = 'forming';
      out.entry = last.c; out.stop = last.l - 0.2 * atr; out.t1 = vwap.vwap;
      out.why = 'S22 VWAP −2σ fade LONG → VWAP ' + vwap.vwap.toFixed(2);
      if (Math.abs(out.entry - out.stop) > 0 && Math.abs(out.t1 - out.entry) / Math.abs(out.entry - out.stop) >= 2)
        out.grade = 'confirmed';
      return out;
    }
    out.why = 'no ±2σ rejection into HVN';
    return out;
  }catch(e){ return out; }
}

/** S24 — Three-drive exhaustion into a node. */
function hgGoldPart5ThreeDrive(rows){
  var out = {
    ok: false, dir: null, grade: 'watch', drives: [], entry: NaN, stop: NaN,
    t1: NaN, t2: NaN, why: ''
  };
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var i0 = Math.max(0, rows.length - HG_GOLD_P5_DRIVE_BARS - 1);
    var highs = [], lows = [], i;
    for (i = i0; i < rows.length; i++){
      highs.push({ i: i, h: rows[i].h, v: rows[i].v || 1, c: rows[i].c, l: rows[i].l });
      lows.push({ i: i, l: rows[i].l, v: rows[i].v || 1, c: rows[i].c, h: rows[i].h });
    }
    /* Find three successive higher highs with decreasing volume */
    function findDrives(side){
      var pts = side === 'short' ? highs : lows;
      var d = [], j, k;
      for (j = 0; j < pts.length; j++){
        if (!d.length){ d.push(pts[j]); continue; }
        var prev = d[d.length - 1];
        if (side === 'short'){
          if (pts[j].h > prev.h && (pts[j].h - prev.h) <= 0.3 * atr && pts[j].v < prev.v)
            d.push(pts[j]);
          else if (pts[j].h > prev.h + 0.3 * atr) d = [pts[j]];
        } else {
          if (pts[j].l < prev.l && (prev.l - pts[j].l) <= 0.3 * atr && pts[j].v < prev.v)
            d.push(pts[j]);
          else if (pts[j].l < prev.l - 0.3 * atr) d = [pts[j]];
        }
        if (d.length >= 3) return d.slice(-3);
      }
      return d.length >= 3 ? d.slice(-3) : null;
    }
    var vprof = goldVolumeProfile(rows, 80, 40);
    var tol = Math.max(atr * 0.35, (vprof && vprof.binSize) || 1);
    function atHvn(px){
      if (!vprof || !vprof.hvns) return false;
      var hi;
      for (hi = 0; hi < vprof.hvns.length; hi++){
        if (Math.abs(px - vprof.hvns[hi]) <= tol) return true;
      }
      return isFinite(vprof.pocPrice) && Math.abs(px - vprof.pocPrice) <= tol;
    }
    var last = rows[rows.length - 1];
    var shortD = findDrives('short');
    if (shortD && atHvn(shortD[2].h)){
      var rejS = last.h <= shortD[2].h + 0.05 * atr && last.c < last.o;
      if (rejS || shortD[2].i >= rows.length - 2){
        out.ok = true; out.dir = 'short'; out.drives = shortD;
        out.entry = last.c; out.stop = shortD[2].h + 0.25 * atr;
        out.t1 = shortD[0].l; out.t2 = NaN;
        out.grade = rejS ? 'confirmed' : 'forming';
        out.why = 'S24 three-drive SHORT exhaustion into HVN @ ' + shortD[2].h.toFixed(2);
        return out;
      }
    }
    var longD = findDrives('long');
    if (longD && atHvn(longD[2].l)){
      var rejL = last.l >= longD[2].l - 0.05 * atr && last.c > last.o;
      if (rejL || longD[2].i >= rows.length - 2){
        out.ok = true; out.dir = 'long'; out.drives = longD;
        out.entry = last.c; out.stop = longD[2].l - 0.25 * atr;
        out.t1 = longD[0].h; out.t2 = NaN;
        out.grade = rejL ? 'confirmed' : 'forming';
        out.why = 'S24 three-drive LONG exhaustion into HVN @ ' + longD[2].l.toFixed(2);
        return out;
      }
    }
    out.why = 'no three-drive exhaustion';
    return out;
  }catch(e){ out.why = 'drive error'; return out; }
}

/** S25 — Open-type recognition (frame / join hint). */
function hgGoldPart5OpenType(rows, opts){
  var out = {
    ok: false, type: null, dir: null, grade: 'frame', rvol: NaN, why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 20) return out;
    var a = hgGoldPart5SessionAnchor(rows, opts.now);
    /* Prefer NY open ~13:00 UTC when available; else first two bars of session */
    var nyI = a;
    var i, t;
    for (i = a; i < rows.length; i++){
      t = rows[i].t;
      var ms = t < 1e12 ? t * 1000 : t;
      var h = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
      if (h >= 13 && h < 15){ nyI = i; break; }
    }
    if (nyI + 1 >= rows.length){ out.why = 'need 2 open bars'; return out; }
    var b1 = rows[nyI], b2 = rows[nyI + 1];
    var overlap = Math.min(b1.h, b2.h) - Math.max(b1.l, b2.l);
    var r1 = b1.h - b1.l;
    var avgV = 0, cnt = 0;
    for (i = Math.max(0, nyI - 20); i < nyI; i++){
      if (isFinite(rows[i].v)){ avgV += rows[i].v; cnt++; }
    }
    avgV = cnt ? avgV / cnt : 0;
    out.rvol = (avgV > 0 && isFinite(b1.v)) ? b1.v / avgV : NaN;
    out.ok = true;
    if (overlap < 0 && ((b2.c > b1.h && b1.c > b1.o) || (b2.c < b1.l && b1.c < b1.o))){
      out.type = 'OPEN-DRIVE';
      out.dir = b2.c > b1.h ? 'long' : 'short';
      out.grade = (isFinite(out.rvol) && out.rvol >= 1.3) ? 'forming' : 'watch';
      out.why = 'S25 OPEN-DRIVE ' + out.dir + (isFinite(out.rvol) ? (' RVOL ' + out.rvol.toFixed(2)) : ' thin');
    } else if (b1.l < (rows[Math.max(0, nyI - 1)].l || b1.l) && b2.c > b1.h){
      out.type = 'OPEN-TEST-DRIVE'; out.dir = 'long'; out.grade = 'frame';
      out.why = 'S25 OPEN-TEST-DRIVE long — sweep then drive';
    } else if (b1.h > (rows[Math.max(0, nyI - 1)].h || b1.h) && b2.c < b1.l){
      out.type = 'OPEN-TEST-DRIVE'; out.dir = 'short'; out.grade = 'frame';
      out.why = 'S25 OPEN-TEST-DRIVE short — sweep then drive';
    } else if (b2.l < b1.l && b2.h > b1.h && ((b1.c > b1.o && b2.c < b2.o) || (b1.c < b1.o && b2.c > b2.o))){
      out.type = 'OPEN-REJECTION-REVERSE'; out.dir = b2.c > b1.c ? 'long' : 'short';
      out.grade = 'frame'; out.why = 'S25 OPEN-REJECTION-REVERSE — rotational';
    } else {
      out.type = 'OPEN-AUCTION'; out.grade = 'frame';
      out.why = 'S25 OPEN-AUCTION — balanced / overlapping';
    }
    return out;
  }catch(e){ out.why = 'open-type error'; return out; }
}

/** S27 — Post-news spike fade (needs newsGate + reclaim). */
function hgGoldPart5NewsSpike(rows, opts){
  var out = {
    ok: false, dir: null, grade: 'watch', entry: NaN, stop: NaN, t1: NaN, why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 30) return out;
    var ng = opts.newsGate;
    /* Only when news was recently locking or opts.forceNewsSpike */
    if (!opts.forceNewsSpike && !(ng && (ng.lock || ng.caution || ng.recent))){
      out.why = 'S27 needs post-Tier1 window'; return out;
    }
    if (ng && ng.lock){ out.why = 'S27 lockout still active'; return out; }
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(atr > 0)) return out;
    var i0 = Math.max(0, rows.length - 8);
    var hi = -Infinity, lo = Infinity, hiI = -1, loI = -1, i;
    for (i = i0; i < rows.length - 1; i++){
      if (rows[i].h >= hi){ hi = rows[i].h; hiI = i; }
      if (rows[i].l <= lo){ lo = rows[i].l; loI = i; }
    }
    var last = rows[rows.length - 1];
    var preHi = -Infinity, preLo = Infinity;
    for (i = Math.max(0, i0 - 12); i < i0; i++){
      if (rows[i].h > preHi) preHi = rows[i].h;
      if (rows[i].l < preLo) preLo = rows[i].l;
    }
    if (hi > preHi + 1 && last.c < preHi && last.c > preLo){
      out.ok = true; out.dir = 'short'; out.grade = 'forming';
      out.entry = last.c; out.stop = hi + 0.35 * atr; out.t1 = (preHi + preLo) / 2;
      out.why = 'S27 post-news spike fade SHORT — swept ' + hi.toFixed(2) + ' reclaimed';
      return out;
    }
    if (lo < preLo - 1 && last.c > preLo && last.c < preHi){
      out.ok = true; out.dir = 'long'; out.grade = 'forming';
      out.entry = last.c; out.stop = lo - 0.35 * atr; out.t1 = (preHi + preLo) / 2;
      out.why = 'S27 post-news spike fade LONG — swept ' + lo.toFixed(2) + ' reclaimed';
      return out;
    }
    out.why = 'no post-news reclaim';
    return out;
  }catch(e){ return out; }
}

/** S28 — Physical-demand weekly bias score (opts.physical fields only). */
function hgGoldPart5WeeklyBias(opts){
  var out = {
    ok: false, score: 0, permission: 'none', parts: [], why: '',
    unchecked: ['Shanghai premium', 'Indian premium', 'COMEX registered',
      'Official-sector', 'FedWatch', 'COT MM', 'EFP', 'GVZ']
  };
  try{
    opts = opts || {};
    var p = opts.physical || opts.weeklyBias || null;
    if (!p || typeof p !== 'object'){
      out.why = 'S28 physical/rate feeds unread — 4H bias governs';
      return out;
    }
    out.ok = true;
    out.unchecked = [];
    var score = 0;
    function add(cond, pts, label){
      if (!cond) return;
      score += pts;
      out.parts.push((pts > 0 ? '+' : '') + pts + ' ' + label);
    }
    if (isFinite(p.shanghaiPremium5d)){
      if (p.shanghaiPremium5d > 0.5 && p.shanghaiRising) add(true, 1, 'Shanghai bid');
      if (p.shanghaiPremium5d < -0.5) add(true, -1, 'Shanghai discount');
    } else out.unchecked.push('Shanghai premium');
    if (p.indianPremium === true || p.indianFlippedToPremium === true)
      add(true, 1, 'Indian premium');
    else if (p.indianPremium == null && p.indianFlippedToPremium == null)
      out.unchecked.push('Indian premium');
    if (p.comexRegisteredFalling === true && p.priceRising === true)
      add(true, 1, 'COMEX tightness');
    else if (p.comexRegisteredRising === true && p.priceRising === true)
      add(true, -1, 'COMEX warranting');
    else if (p.comexRegisteredFalling == null && p.comexRegisteredRising == null)
      out.unchecked.push('COMEX registered');
    if (p.officialBuying === true) add(true, 1, 'official bid');
    else if (p.officialBuying == null) out.unchecked.push('Official-sector');
    if (isFinite(p.fedwatchDeltaCuts)){
      if (p.fedwatchDeltaCuts > 0) add(true, 1, 'FedWatch more cuts');
      if (p.fedwatchDeltaCuts < 0) add(true, -1, 'FedWatch fewer cuts');
    } else out.unchecked.push('FedWatch');
    if (isFinite(p.cotMmPct)){
      if (p.cotMmPct > 90) add(true, -1, 'COT crowded long');
      if (p.cotMmPct < 10) add(true, 1, 'COT crowded short');
    } else out.unchecked.push('COT MM');
    out.score = score;
    if (score >= 3) out.permission = 'long-full';
    else if (score <= -3) out.permission = 'short-full';
    else out.permission = 'none';
    out.why = 'S28 score ' + score + ' · ' + out.permission
      + (out.parts.length ? (' · ' + out.parts.join(', ')) : '');
    return out;
  }catch(e){ out.why = 'S28 error'; return out; }
}

function hgGoldPart5ApplyRegimeFilter(cand, regime){
  try{
    if (!cand || !regime || !regime.ok) return cand;
    if (!Array.isArray(cand.stamps)) cand.stamps = [];
    var key = cand.stratKey || cand.key;
    if (regime.disabled && regime.disabled[key]){
      cand.demoted = true;
      if (cand.stamps.indexOf('S23 KER BLOCK') < 0) cand.stamps.push('S23 KER BLOCK');
    } else if (regime.regime === 'TREND' && (key === 'p5vwap' || key === 'p5drive')){
      cand.demoted = true;
      if (cand.stamps.indexOf('S23 TREND NO FADE') < 0) cand.stamps.push('S23 TREND NO FADE');
    } else if (regime.why && cand.stamps.indexOf('S23 ' + regime.regime) < 0){
      cand.stamps.push('S23 ' + regime.regime);
    }
    return cand;
  }catch(e){ return cand; }
}

function hgGoldPart5ApplyWeeklyBiasFilter(cand, bias){
  try{
    if (!cand || !bias || !bias.ok) return cand;
    if (!Array.isArray(cand.stamps)) cand.stamps = [];
    if (bias.permission === 'long-full' && cand.dir === 'short'){
      cand.demoted = true;
      if (cand.stamps.indexOf('S28 LONG-SIDE WEEK') < 0) cand.stamps.push('S28 LONG-SIDE WEEK');
    } else if (bias.permission === 'short-full' && cand.dir === 'long'){
      cand.demoted = true;
      if (cand.stamps.indexOf('S28 SHORT-SIDE WEEK') < 0) cand.stamps.push('S28 SHORT-SIDE WEEK');
    } else if (bias.permission !== 'none'){
      if (cand.stamps.indexOf('S28 ' + bias.permission.toUpperCase()) < 0)
        cand.stamps.push('S28 ' + bias.permission.toUpperCase());
    }
    return cand;
  }catch(e){ return cand; }
}

function hgGoldPart5Engine(rows, opts){
  var out = {
    ok: false, ker: null, vwap: null, wyck: null, turt: null, vfade: null,
    drive: null, open: null, news: null, bias: null, strategies: [],
    unchecked: ['Shanghai/Indian premium', 'COMEX/EFP', 'FedWatch/GVZ', 'S21 implied-move', 'S26 expiry pin'],
    why: ''
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40){ out.why = 'need ≥40 bars'; return out; }
    if (opts.newsGate && opts.newsGate.lock){
      out.why = 'news lockout — Part5 entries paused';
      return out;
    }
    out.ker = hgGoldPart5KerRegime(rows);
    out.vwap = hgGoldPart5SessionVwap(rows, opts);
    out.wyck = hgGoldPart5Wyckoff(rows);
    out.turt = hgGoldPart5TurtleSoup(rows);
    out.vfade = hgGoldPart5VwapFade(rows, out.vwap, out.ker);
    out.drive = hgGoldPart5ThreeDrive(rows);
    out.open = hgGoldPart5OpenType(rows, opts);
    out.news = hgGoldPart5NewsSpike(rows, opts);
    out.bias = hgGoldPart5WeeklyBias(opts);

    function pushS(key, dir, level, grade, why, plan){
      if (!dir && grade !== 'frame' && grade !== 'watch') return;
      out.strategies.push({
        key: key, dir: dir, level: level, grade: grade || 'watch', why: why, plan: plan || null
      });
    }

    /* S23 frame always */
    if (out.ker && out.ker.ok)
      pushS('p5ker', null, NaN, 'frame', 'S23 ' + out.ker.why);

    if (out.wyck && out.wyck.ok && out.wyck.dir){
      pushS('p5wyck', out.wyck.dir, out.wyck.entry, out.wyck.grade, out.wyck.why, {
        stop: out.wyck.stop, t1: out.wyck.t1, t2: out.wyck.t2
      });
    }
    if (out.turt && out.turt.ok && out.turt.dir && out.turt.grade !== 'watch'){
      pushS('p5turt', out.turt.dir, out.turt.entry, out.turt.grade, out.turt.why, {
        stop: out.turt.stop, t1: out.turt.t1
      });
    } else if (out.turt && out.turt.ok && out.turt.grade === 'watch'){
      pushS('p5turt', out.turt.dir, out.turt.prior, 'watch', out.turt.why);
    }
    if (out.vfade && out.vfade.ok && out.vfade.dir){
      pushS('p5vwap', out.vfade.dir, out.vfade.entry, out.vfade.grade, out.vfade.why, {
        stop: out.vfade.stop, t1: out.vfade.t1
      });
    }
    if (out.drive && out.drive.ok && out.drive.dir){
      pushS('p5drive', out.drive.dir, out.drive.entry, out.drive.grade, out.drive.why, {
        stop: out.drive.stop, t1: out.drive.t1, t2: out.drive.t2
      });
    }
    if (out.open && out.open.ok){
      pushS('p5open', out.open.dir, NaN, out.open.grade || 'frame', out.open.why);
    }
    if (out.news && out.news.ok && out.news.dir){
      pushS('p5news', out.news.dir, out.news.entry, out.news.grade, out.news.why, {
        stop: out.news.stop, t1: out.news.t1
      });
    }
    if (out.bias && (out.bias.ok || out.bias.why))
      pushS('p5bias', null, NaN, 'frame', out.bias.why || 'S28');

    /* Apply S23 disable on live strategies in-place */
    var si, s;
    for (si = 0; si < out.strategies.length; si++){
      s = out.strategies[si];
      if (!s || !s.dir) continue;
      if (out.ker && out.ker.regime === 'TREND' && (s.key === 'p5vwap' || s.key === 'p5drive')){
        s.grade = 'watch';
        s.why = (s.why || '') + ' · S23 TREND disables fade';
      }
      if (out.ker && out.ker.regime === 'CHOP' && s.key === 'p5open' && /OPEN-DRIVE/.test(s.why || '')){
        s.grade = 'watch';
        s.why = (s.why || '') + ' · S23 CHOP — open-drive join demoted';
      }
    }

    out.ok = out.strategies.some(function(x){
      return x && (x.grade === 'forming' || x.grade === 'confirmed' || x.grade === 'frame');
    });
    out.why = out.ok
      ? (out.strategies.length + ' Part5 hit(s) · unchecked: ' + out.unchecked.join(', '))
      : ('no Part5 trigger · unchecked: ' + out.unchecked.join(', '));
    return out;
  }catch(e){ out.why = 'Part5 engine error'; return out; }
}

function hgGoldPart5Html(p5){
  try{
    if (!p5 || !(p5.ok || (p5.ker && p5.ker.ok) || (p5.bias && p5.bias.why))) return '';
    var h = '<div class="note" data-hg-gold-part5="1" style="margin-top:8px">';
    h += '<b>PART5 S19–S28</b>';
    if (p5.ker && p5.ker.ok) h += ' · KER ' + p5.ker.er.toFixed(2) + ' ' + p5.ker.regime;
    if (p5.vwap && p5.vwap.ok) h += ' · VWAP σ ' + (isFinite(p5.vwap.distSig) ? p5.vwap.distSig.toFixed(1) : '—');
    if (p5.unchecked && p5.unchecked.length)
      h += '<div class="dim" style="margin-top:2px">unchecked: ' + p5.unchecked.join(', ') + '</div>';
    var i, s, n = Math.min(5, (p5.strategies || []).length);
    for (i = 0; i < n; i++){
      s = p5.strategies[i];
      h += '<div style="margin-top:4px"><b>' + String(s.key).toUpperCase() + '</b>'
        + (s.dir ? (' ' + String(s.dir).toUpperCase()) : '')
        + (s.grade ? (' · ' + s.grade) : '')
        + (isFinite(s.level) ? (' @ ' + (+s.level).toFixed(2)) : '')
        + ' — ' + String(s.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    if (p5.why) h += '<div class="dim" style="margin-top:4px">' + String(p5.why).replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* =========================================================================
   NY VOLUME EXHAUSTION (hg-v556) — two-volume test for New York gold sweeps.
   Raid RVOL≥1.5 + reclaim, then takeover RVOL≥1.2 + MSS + VWAP. Same-session
   RVOL baseline (not just last-20). CVD labeled PROXY when not COMEX.
========================================================================= */

var HG_GOLD_NY_RAID_ATR = 0.15;
var HG_GOLD_NY_RAID_RVOL = 1.50;
var HG_GOLD_NY_TAKE_RVOL = 1.20;
var HG_GOLD_NY_BLOWOFF_RVOL = 2.50;
var HG_GOLD_NY_ALERT = 75;
var HG_GOLD_NY_WATCH = 65;
var HG_GOLD_NY_SESSIONS = 20;

/** New York gold blocks in UTC (aligns with existing NY_OVERLAP ~12–16/17). */
function hgGoldNyBlock(nowMs){
  var out = { block: 'OFF', label: 'outside NY', weight: 0, hourUTC: NaN };
  try{
    var ms = __toMs(nowMs); if (!isFinite(ms)) ms = Date.now();
    var h = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
    out.hourUTC = h;
    if (h >= 12 && h < 13.5){
      out.block = 'OPEN'; out.weight = 1;
      out.label = 'NY open — wait completed close + MSS; do not fade first spike';
    } else if (h >= 13.5 && h < 15.5){
      out.block = 'MID'; out.weight = 3;
      out.label = 'NY mid — preferred sweep-reclaim / OB-FVG window';
    } else if (h >= 15.5 && h < 17.5){
      out.block = 'LATE'; out.weight = 2;
      out.label = 'NY late — require stronger structure; liquidity thins';
    } else {
      out.block = 'OFF'; out.weight = 0;
      out.label = 'outside NY session window';
    }
    return out;
  }catch(e){ return out; }
}

/**
 * Same-session RVOL: compare bar volume to the average of the same UTC
 * time-of-day slot over the preceding N sessions (not a rolling 20-bar mean).
 */
function hgGoldSessionRvol(rows, idx, opts){
  var out = { rvol: NaN, baseline: NaN, samples: 0, unchecked: true, mode: 'session' };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || idx < 0 || idx >= rows.length) return out;
    var v = +rows[idx].v;
    if (!isFinite(v) || !(v > 0)) return out;
    var barSec = opts.barSec;
    if (!isFinite(barSec) || barSec <= 0){
      barSec = (rows.length >= 3 && isFinite(rows[idx].t) && isFinite(rows[idx - 1].t))
        ? Math.max(60, Math.abs(rows[idx].t - rows[idx - 1].t)) : 900;
    }
    var t = rows[idx].t;
    if (!isFinite(t)) return out;
    var slot = ((t % 86400) + 86400) % 86400;
    var maxSessions = opts.sessions || HG_GOLD_NY_SESSIONS;
    var sum = 0, n = 0, i, ti, si, daySeen = {}, dayKey, days = 0;
    for (i = idx - 1; i >= 0 && days < maxSessions; i--){
      ti = rows[i].t;
      if (!isFinite(ti) || !(rows[i].v > 0)) continue;
      si = ((ti % 86400) + 86400) % 86400;
      if (Math.abs(si - slot) > barSec * 0.55 && Math.abs(si - slot) < 86400 - barSec * 0.55) continue;
      dayKey = String(Math.floor(ti / 86400));
      if (daySeen[dayKey]) continue;
      daySeen[dayKey] = true;
      days++;
      sum += +rows[i].v;
      n++;
    }
    if (n < 3){
      /* Fall back to rolling 20-bar mean so thin history still works. */
      var roll = hgGoldBarRvol(rows, idx, 20);
      out.rvol = roll;
      out.mode = 'rolling-fallback';
      out.unchecked = !isFinite(roll);
      out.samples = 0;
      return out;
    }
    out.baseline = sum / n;
    out.samples = n;
    out.rvol = v / out.baseline;
    out.unchecked = false;
    return out;
  }catch(e){ return out; }
}

function hgGoldNyRvolSignature(raidRvol, takeRvol, extended, mssOk){
  if (isFinite(raidRvol) && raidRvol < 1.2)
    return { key: 'weak-fake', label: 'WEAK FAKE WICK', fade: false };
  if (extended && isFinite(raidRvol) && raidRvol >= 1.5)
    return { key: 'breakout', label: 'REAL BREAKOUT — do not fade', fade: false };
  if (isFinite(raidRvol) && raidRvol >= HG_GOLD_NY_BLOWOFF_RVOL)
    return { key: 'blowoff', label: 'BLOW-OFF EXHAUSTION — wait structure', fade: !!mssOk };
  if (isFinite(raidRvol) && raidRvol >= HG_GOLD_NY_RAID_RVOL
      && isFinite(takeRvol) && takeRvol >= HG_GOLD_NY_TAKE_RVOL && mssOk)
    return { key: 'genuine', label: 'GENUINE REVERSAL SWEEP', fade: true };
  if (isFinite(raidRvol) && raidRvol >= HG_GOLD_NY_RAID_RVOL
      && (!isFinite(takeRvol) || takeRvol < 1.0) && !mssOk)
    return { key: 'dead', label: 'DEAD RESPONSE — stand aside', fade: false };
  if (isFinite(raidRvol) && raidRvol >= 1.5 && !extended)
    return { key: 'absorption', label: 'ABSORPTION / FAILED AUCTION', fade: !!mssOk };
  return { key: 'mixed', label: 'MIXED — incomplete two-volume test', fade: false };
}

/**
 * NY volume-exhaustion detector (two-volume test) + 100-pt score + plan.
 */
function hgGoldNyExhaustion(rows, opts){
  var out = {
    ok: false, confirmed: false, dir: null, level: NaN, score: 0, tier: 'ignore',
    block: null, signature: null, raid: null, takeover: null, plan: null,
    parts: {}, why: '', cvdNote: 'CVD/order-flow is PROXY on XAUT/PAXG/spot — not COMEX GC'
  };
  try{
    opts = opts || {};
    rows = __rows(rows);
    if (!rows || rows.length < 40){ out.why = 'need ≥40 bars'; return out; }
    var nowMs = opts.now || (isFinite(rows[rows.length - 1].t) ? rows[rows.length - 1].t * 1000 : Date.now());
    out.block = hgGoldNyBlock(nowMs);
    var atrs = _atr(rows, 14);
    var atr = atrs[atrs.length - 1];
    if (!(isFinite(atr) && atr > 0)){ out.why = 'ATR unread'; return out; }

    var map = opts.map || hgGoldLiquidityMap(rows, opts);
    if (!map.levels || !map.levels.length){ out.why = 'no marked liquidity'; return out; }

    /* Prefer London high/low + PDH/PDL + equals for NY raids */
    var prefer = map.levels.filter(function(L){
      return L.kind === 'pdh' || L.kind === 'pdl' || L.kind === 'equal'
        || L.kind === 'asia' || L.kind === 'pivot';
    });
    if (!prefer.length) prefer = map.levels;

    var n = rows.length;
    var look = Math.min(6, n - 2);
    var best = null;
    var li, bi, L, dir, raidIdx, takeIdx, bar, breach, raidR, takeR, wickFrac, closeInside;
    var failExtend, mss, vwap, sig, extended;

    for (li = 0; li < prefer.length; li++){
      L = prefer[li];
      var dirs = [];
      if (L.side === 'sell-side' || /LOW/i.test(L.label || '') || L.kind === 'pdl') dirs = ['long'];
      else if (L.side === 'buy-side' || /HIGH/i.test(L.label || '') || L.kind === 'pdh') dirs = ['short'];
      else dirs = ['long', 'short'];

      for (var di = 0; di < dirs.length; di++){
        dir = dirs[di];
        for (bi = n - look; bi < n; bi++){
          if (bi < 1) continue;
          bar = rows[bi];
          breach = (dir === 'long') ? (L.level - bar.l) : (bar.h - L.level);
          if (!(breach >= HG_GOLD_NY_RAID_ATR * atr)) continue;
          closeInside = (dir === 'long') ? (bar.c > L.level) : (bar.c < L.level);
          if (!closeInside) continue;
          var range = bar.h - bar.l;
          wickFrac = range > 0
            ? ((dir === 'long') ? ((Math.min(bar.o, bar.c) - bar.l) / range)
                               : ((bar.h - Math.max(bar.o, bar.c)) / range))
            : 0;
          raidR = hgGoldSessionRvol(rows, bi, opts);
          if (!(isFinite(raidR.rvol) && raidR.rvol >= HG_GOLD_NY_RAID_RVOL)) continue;

          raidIdx = bi;
          /* Takeover window: next 1–3 bars after raid (or raid itself if last) */
          takeIdx = Math.min(n - 1, raidIdx + 1);
          var takeEnd = Math.min(n - 1, raidIdx + 3);
          failExtend = true;
          var extreme = (dir === 'long') ? bar.l : bar.h;
          var tj;
          for (tj = raidIdx + 1; tj <= takeEnd; tj++){
            if (dir === 'long' && rows[tj].l < extreme - 0.05 * atr) failExtend = false;
            if (dir === 'short' && rows[tj].h > extreme + 0.05 * atr) failExtend = false;
          }
          /* If raid is the last bar, treat fail-extend as pending (soft pass) */
          if (raidIdx === n - 1) failExtend = true;

          takeR = hgGoldSessionRvol(rows, takeIdx, opts);
          /* Prefer highest RVOL takeover bar in window */
          for (tj = raidIdx; tj <= takeEnd; tj++){
            var tr = hgGoldSessionRvol(rows, tj, opts);
            if (isFinite(tr.rvol) && (!isFinite(takeR.rvol) || tr.rvol > takeR.rvol)){
              takeR = tr; takeIdx = tj;
            }
          }

          mss = hgGoldSweepMss(rows, dir);
          vwap = hgGoldSweepVwap(rows, dir);
          extended = !failExtend && !closeInside;
          /* Breakout: closes and holds outside */
          if (!closeInside && isFinite(raidR.rvol) && raidR.rvol >= 1.5) extended = true;

          sig = hgGoldNyRvolSignature(raidR.rvol, takeR.rvol, !failExtend && (takeIdx > raidIdx && (
            (dir === 'long' && rows[takeIdx].c < L.level) ||
            (dir === 'short' && rows[takeIdx].c > L.level)
          )), !!(mss && mss.ok));

          var cand = {
            dir: dir, level: L.level, label: L.label, levelKind: L.kind,
            raidIdx: raidIdx, takeIdx: takeIdx,
            raidRvol: raidR.rvol, takeRvol: takeR.rvol,
            raidMode: raidR.mode, breachAtr: breach / atr,
            wickFrac: wickFrac, failExtend: failExtend,
            mss: mss, vwap: vwap, atr: atr, signature: sig,
            extreme: extreme
          };
          var sc = hgGoldNyExhaustionScore(cand, {
            block: out.block, regime: opts.regime, newsGate: opts.newsGate
          });
          cand.score = sc.score; cand.tier = sc.tier; cand.parts = sc.parts;
          cand.confirmed = sc.confirmed; cand.why = sc.why; cand.plan = sc.plan;
          if (!best || cand.score > best.score) best = cand;
        }
      }
    }

    if (!best){
      out.why = (out.block.block === 'OFF')
        ? 'outside NY window / no climactic raid'
        : 'no NY two-volume exhaustion this bar (need raid RVOL≥1.5 + reclaim)';
      out.block = out.block;
      return out;
    }

    out.dir = best.dir;
    out.level = best.level;
    out.score = best.score;
    out.tier = best.tier;
    out.parts = best.parts;
    out.confirmed = !!best.confirmed;
    out.ok = out.confirmed || out.tier === 'watch' || out.tier === 'alert';
    out.signature = best.signature;
    out.raid = {
      idx: best.raidIdx, rvol: best.raidRvol, mode: best.raidMode,
      breachAtr: best.breachAtr, wickFrac: best.wickFrac
    };
    out.takeover = {
      idx: best.takeIdx, rvol: best.takeRvol,
      failExtend: best.failExtend, mss: best.mss, vwap: best.vwap
    };
    out.plan = best.plan;
    out.why = best.why;
    /* Opening block: never alert without MSS even if score high */
    if (out.block.block === 'OPEN' && !(best.mss && best.mss.ok) && out.tier === 'alert'){
      out.tier = 'watch';
      out.confirmed = false;
      out.why += ' · NY OPEN — demoted to watch until MSS prints';
    }
    return out;
  }catch(e){ out.why = 'ny-exhaustion error'; return out; }
}

function hgGoldNyExhaustionScore(hit, opts){
  var out = { score: 0, tier: 'ignore', confirmed: false, parts: {}, why: '', plan: null };
  try{
    opts = opts || {};
    var p = { liquidity: 0, raid: 0, rejection: 0, failExtend: 0, takeover: 0, vwapLoc: 0, safety: 0 };
    var k = hit.levelKind || '';
    if (k === 'pdh' || k === 'pdl' || k === 'asia') p.liquidity = 20;
    else if (k === 'equal') p.liquidity = 18;
    else if (k === 'pivot') p.liquidity = 14;
    else p.liquidity = 8;

    if (isFinite(hit.breachAtr) && hit.breachAtr >= HG_GOLD_NY_RAID_ATR
        && isFinite(hit.raidRvol) && hit.raidRvol >= HG_GOLD_NY_RAID_RVOL){
      p.raid = (hit.raidRvol >= HG_GOLD_NY_BLOWOFF_RVOL) ? 20 : 16;
    } else if (isFinite(hit.raidRvol) && hit.raidRvol >= 1.2){
      p.raid = 8;
    }

    if (isFinite(hit.wickFrac) && hit.wickFrac >= 0.45) p.rejection = 15;
    else if (isFinite(hit.wickFrac) && hit.wickFrac >= 0.30) p.rejection = 10;
    else p.rejection = 4;

    if (hit.failExtend) p.failExtend = 10;
    else p.failExtend = 0;

    var takeOk = isFinite(hit.takeRvol) && hit.takeRvol >= HG_GOLD_NY_TAKE_RVOL;
    var mssOk = !!(hit.mss && hit.mss.ok);
    if (takeOk && mssOk) p.takeover = 20;
    else if (takeOk || mssOk) p.takeover = 10;
    else p.takeover = 0;

    if (hit.vwap && hit.vwap.ok) p.vwapLoc = 10;
    else if (hit.vwap && hit.vwap.unchecked) p.vwapLoc = 5;
    else if (k === 'pdh' || k === 'pdl' || k === 'equal' || k === 'asia') p.vwapLoc = 4;

    var newsLock = !!(opts.newsGate && opts.newsGate.lock);
    var block = opts.block || {};
    if (!newsLock){
      if (block.block === 'MID') p.safety = 5;
      else if (block.block === 'LATE') p.safety = 4;
      else if (block.block === 'OPEN') p.safety = 2;
      else p.safety = 1;
      if (opts.regime && opts.regime.style === 'trend' && opts.regime.vol && opts.regime.vol.regime === 'expansion')
        p.safety = Math.max(0, p.safety - 2); /* fade caution in powerful trend */
    } else {
      p.safety = 0;
    }

    out.parts = p;
    out.score = Math.max(0, Math.min(100,
      p.liquidity + p.raid + p.rejection + p.failExtend + p.takeover + p.vwapLoc + p.safety));

    var sigOk = hit.signature && (hit.signature.key === 'genuine' || hit.signature.key === 'blowoff' || hit.signature.key === 'absorption');
    out.confirmed = !!(sigOk && takeOk && mssOk && hit.failExtend && out.score >= HG_GOLD_NY_WATCH && !newsLock);
    if (hit.signature && hit.signature.key === 'breakout'){
      out.tier = 'ignore';
      out.confirmed = false;
      out.why = 'REAL BREAKOUT — RVOL stayed elevated outside level; do not fade';
      return out;
    }
    if (hit.signature && hit.signature.key === 'dead'){
      out.tier = 'ignore';
      out.why = hit.signature.label;
      return out;
    }
    if (out.score >= HG_GOLD_NY_ALERT && out.confirmed) out.tier = 'alert';
    else if (out.score >= HG_GOLD_NY_WATCH) out.tier = 'watch';
    else out.tier = 'ignore';

    /* Plan geometry */
    var buf = hit.atr * ((block.block === 'LATE') ? 0.25 : 0.15);
    var stop = (hit.dir === 'long') ? (hit.extreme - buf) : (hit.extreme + buf);
    var vwapPx = (hit.vwap && isFinite(hit.vwap.vwap)) ? hit.vwap.vwap : NaN;
    out.plan = {
      entry: 'retest of 1–5m OB/FVG from reversal displacement (not chase)',
      stop: stop,
      t1: isFinite(vwapPx) ? vwapPx : hit.level,
      t2Label: 'opposing session liquidity (Asia/London/PDH-PDL)',
      cancel: 're-accept beyond swept level or 5m close through far side of reversal OB',
      bufferAtr: buf / hit.atr
    };

    out.why = (out.confirmed ? 'NY EXHAUSTION CONFIRMED ' : 'NY EXHAUSTION ')
      + String(hit.dir || '').toUpperCase() + ' @ ' + (isFinite(hit.level) ? hit.level.toFixed(2) : '—')
      + ' · score ' + out.score + '/' + out.tier.toUpperCase()
      + (hit.signature ? (' · ' + hit.signature.label) : '')
      + ' · raid RVOL ' + (isFinite(hit.raidRvol) ? hit.raidRvol.toFixed(2) : '—')
      + ' · take RVOL ' + (isFinite(hit.takeRvol) ? hit.takeRvol.toFixed(2) : '—');
    if (block.label) out.why += ' · ' + block.block;
    return out;
  }catch(e){ out.why = 'score error'; return out; }
}

function hgGoldNyExhaustionHtml(exh){
  try{
    if (!exh || !(exh.ok || exh.score > 0)) return '';
    var h = '<div class="note" data-hg-gold-ny-exh="1" style="margin-top:8px">';
    h += '<b>NY EXHAUSTION</b> · ' + String(exh.tier || 'ignore').toUpperCase()
      + ' · score ' + (isFinite(exh.score) ? exh.score : '—') + '/100';
    if (exh.dir) h += ' · ' + String(exh.dir).toUpperCase();
    if (isFinite(exh.level)) h += ' @ ' + (+exh.level).toFixed(2);
    if (exh.signature && exh.signature.label)
      h += ' · ' + String(exh.signature.label).replace(/[<>&]/g, '');
    if (exh.block && exh.block.block)
      h += ' · ' + exh.block.block;
    if (exh.why) h += '<div class="dim" style="margin-top:4px">' + String(exh.why).replace(/[<>&]/g, '') + '</div>';
    if (exh.raid || exh.takeover){
      h += '<div class="dim" style="margin-top:2px">raid RVOL '
        + (exh.raid && isFinite(exh.raid.rvol) ? exh.raid.rvol.toFixed(2) : '—')
        + (exh.raid && exh.raid.mode === 'session' ? ' (session)' : ' (fallback)')
        + ' · take RVOL '
        + (exh.takeover && isFinite(exh.takeover.rvol) ? exh.takeover.rvol.toFixed(2) : '—')
        + '</div>';
    }
    if (exh.plan && isFinite(exh.plan.stop)){
      h += '<div class="dim" style="margin-top:2px">stop beyond extreme '
        + (+exh.plan.stop).toFixed(2)
        + ' · TP1 VWAP/level · ' + String(exh.plan.entry || '').replace(/[<>&]/g, '')
        + '</div>';
    }
    h += '<div class="dim" style="margin-top:2px">' + String(exh.cvdNote || '').replace(/[<>&]/g, '') + '</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

function hgGoldSessionAtrBuffer(rows, nowMs){
  var out = { atr: NaN, session: 'OFF', bufferMult: 0.20, stopBuffer: NaN };
  try{
    rows = __rows(rows);
    var atrs = _atr(rows, 14);
    out.atr = atrs && atrs.length ? atrs[atrs.length - 1] : NaN;
    var ms = __toMs(nowMs); if (!isFinite(ms)) ms = Date.now();
    var h = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
    if (h >= 0 && h < 8){ out.session = 'ASIAN'; out.bufferMult = 0.10; }
    else if (h >= 12 && h < 16){ out.session = 'NY_OVERLAP'; out.bufferMult = 0.25; }
    else if (h >= 7 && h < 12){ out.session = 'LONDON'; out.bufferMult = 0.20; }
    else { out.session = 'OFF'; out.bufferMult = 0.15; }
    if (isFinite(out.atr)) out.stopBuffer = out.atr * out.bufferMult;
    return out;
  }catch(e){ return out; }
}

/* ---- Perp-native edge (Delta OI / funding history) ----
   Price extreme + sharp OI build, then fail back inside → trapped OI fuels
   the reversal. Funding extreme frames the day (slow), not a bar trigger. */

var HG_GOLD_OI_TRAP_LOOK = 8;
var HG_GOLD_OI_TRAP_BUILD_PCT = 0.04;   /* +4% OI over look window */
var HG_GOLD_OI_TRAP_FAIL_ATR = 0.15;    /* reclaim inside prior extreme by ≥0.15×ATR */
var HG_GOLD_FUND_EXT_ABS = 0.05;        /* |funding %| mean extreme (Delta percent units) */
var HG_GOLD_FUND_EXT_BARS = 24;         /* ~1 day of 1h funding candles */

function hgGoldSeriesCloseAt(series, tSec){
  try{
    if (!series || !series.length || !isFinite(tSec)) return NaN;
    var best = NaN, bestDt = Infinity, i, dt;
    for (i = 0; i < series.length; i++){
      dt = Math.abs(series[i].t - tSec);
      if (dt < bestDt){ bestDt = dt; best = series[i].c; }
    }
    /* Allow up to 2h mismatch when aligning 15m price to 1h OI. */
    return (bestDt <= 7200 && isFinite(best)) ? best : NaN;
  }catch(e){ return NaN; }
}

/**
 * OI-trap reversal: price prints a new extreme while OI builds sharply, then
 * fails back inside. dir = reversal direction (fade the failed extreme).
 */
function hgGoldOiTrap(priceRows, oiRows, opts){
  var out = {
    ok: false, dir: null, level: NaN, oiBuildPct: NaN, why: '', unchecked: false
  };
  try{
    opts = opts || {};
    priceRows = __rows(priceRows);
    oiRows = __rows(oiRows);
    var look = opts.look || HG_GOLD_OI_TRAP_LOOK;
    var buildMin = isFinite(opts.buildPct) ? opts.buildPct : HG_GOLD_OI_TRAP_BUILD_PCT;
    if (!priceRows || priceRows.length < look + 3){
      out.unchecked = true; out.why = 'need ≥' + (look + 3) + ' price bars'; return out;
    }
    if (!oiRows || oiRows.length < 3){
      out.unchecked = true; out.why = 'OI history unread (Delta OI:SYMBOL)'; return out;
    }
    var n = priceRows.length;
    var atrs = _atr(priceRows, 14);
    var atr = atrs && atrs.length ? atrs[n - 1] : NaN;
    if (!(isFinite(atr) && atr > 0)){ out.why = 'ATR unread'; return out; }

    var win = priceRows.slice(n - look - 1, n - 1);
    var priorHi = -Infinity, priorLo = Infinity, wi;
    for (wi = 0; wi < win.length; wi++){
      if (win[wi].h > priorHi) priorHi = win[wi].h;
      if (win[wi].l < priorLo) priorLo = win[wi].l;
    }
    if (!(priorHi > priorLo)){ out.why = 'prior window flat'; return out; }

    var bar = priceRows[n - 1];
    var oiNow = hgGoldSeriesCloseAt(oiRows, bar.t);
    var oiPrev = hgGoldSeriesCloseAt(oiRows, priceRows[n - 1 - look].t);
    if (!(isFinite(oiNow) && isFinite(oiPrev) && oiPrev > 0)){
      out.unchecked = true; out.why = 'OI not alignable to price timestamps'; return out;
    }
    out.oiBuildPct = (oiNow - oiPrev) / oiPrev;
    if (!(out.oiBuildPct >= buildMin)){
      out.why = 'OI build ' + (100 * out.oiBuildPct).toFixed(1) + '% < '
        + (100 * buildMin).toFixed(0) + '% — no trapped fuel';
      return out;
    }

    /* High extreme + OI build + close back below prior high → short trap */
    if (bar.h >= priorHi && bar.c < priorHi - HG_GOLD_OI_TRAP_FAIL_ATR * atr){
      out.ok = true; out.dir = 'short'; out.level = priorHi;
      out.why = 'OI-trap short — new high on +'
        + (100 * out.oiBuildPct).toFixed(1) + '% OI, failed back inside '
        + priorHi.toFixed(2);
      return out;
    }
    /* Low extreme + OI build + close back above prior low → long trap */
    if (bar.l <= priorLo && bar.c > priorLo + HG_GOLD_OI_TRAP_FAIL_ATR * atr){
      out.ok = true; out.dir = 'long'; out.level = priorLo;
      out.why = 'OI-trap long — new low on +'
        + (100 * out.oiBuildPct).toFixed(1) + '% OI, failed back inside '
        + priorLo.toFixed(2);
      return out;
    }
    out.why = 'OI built but price has not failed back inside the prior extreme';
    return out;
  }catch(e){ out.why = 'oi-trap error'; return out; }
}

/**
 * Funding extreme — slow day-frame signal from Delta FUNDING:SYMBOL history.
 * Positive extreme → longs crowded → favor shorts; negative → favor longs.
 */
function hgGoldFundingExtreme(fundingRows, opts){
  var out = {
    ok: false, dir: null, meanPct: NaN, extreme: false, why: '', unchecked: false
  };
  try{
    opts = opts || {};
    fundingRows = __rows(fundingRows);
    var bars = opts.bars || HG_GOLD_FUND_EXT_BARS;
    var thr = isFinite(opts.threshold) ? opts.threshold : HG_GOLD_FUND_EXT_ABS;
    if (!fundingRows || fundingRows.length < Math.min(6, bars)){
      out.unchecked = true; out.why = 'funding history unread (Delta FUNDING:SYMBOL)'; return out;
    }
    var slice = fundingRows.slice(-bars);
    var sum = 0, n = 0, i;
    for (i = 0; i < slice.length; i++){
      if (isFinite(slice[i].c)){ sum += slice[i].c; n++; }
    }
    if (!n){ out.unchecked = true; out.why = 'funding closes empty'; return out; }
    out.meanPct = sum / n;
    if (out.meanPct >= thr){
      out.ok = true; out.extreme = true; out.dir = 'short';
      out.why = 'funding extreme +' + out.meanPct.toFixed(3)
        + '% — longs crowded; fade / short bias for the session';
      return out;
    }
    if (out.meanPct <= -thr){
      out.ok = true; out.extreme = true; out.dir = 'long';
      out.why = 'funding extreme ' + out.meanPct.toFixed(3)
        + '% — shorts crowded; long bias for the session';
      return out;
    }
    out.why = 'funding mean ' + out.meanPct.toFixed(3) + '% inside ±' + thr + '% — no crowd extreme';
    return out;
  }catch(e){ out.why = 'funding-extreme error'; return out; }
}

/** Demote candidates fighting a live OI-trap or funding-extreme bias. */
function hgGoldApplyPerpNative(cand, oiTrap, fundExt){
  try{
    if (!cand) return cand;
    if (!Array.isArray(cand.stamps)) cand.stamps = [];
    var gn = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
    if (oiTrap && oiTrap.ok && oiTrap.dir && cand.dir && oiTrap.dir !== cand.dir
        && cand.stratKey !== 'oitrap'){
      cand.demoted = true;
      if (cand.stamps.indexOf('OI TRAP OPPOSE') < 0) cand.stamps.push('OI TRAP OPPOSE');
      gn.push(oiTrap.why || 'against live OI-trap reversal');
    }
    if (fundExt && fundExt.ok && fundExt.dir && cand.dir && fundExt.dir !== cand.dir
        && cand.stratKey !== 'fundext' && cand.stratKey !== 'oitrap'){
      cand.demoted = true;
      if (cand.stamps.indexOf('FUNDING EXTREME') < 0) cand.stamps.push('FUNDING EXTREME');
      gn.push(fundExt.why || 'against crowded funding extreme');
    }
    if (oiTrap && oiTrap.ok && oiTrap.dir === cand.dir){
      if (cand.stamps.indexOf('OI TRAP') < 0) cand.stamps.push('OI TRAP');
    }
    cand.gateNotes = gn;
    return cand;
  }catch(e){ return cand; }
}

/**
 * Browser helper — GET /api/delta/perp-history (same-origin; no third-party SDK).
 */
function hgGoldLoadDeltaPerp(opts){
  opts = opts || {};
  var symbol = String(opts.symbol || 'XAUTUSD').toUpperCase();
  var resolution = String(opts.resolution || '1h');
  var lookbackHours = isFinite(opts.lookbackHours) ? opts.lookbackHours : 168;
  var url = '/api/delta/perp-history?symbol=' + encodeURIComponent(symbol)
    + '&resolution=' + encodeURIComponent(resolution)
    + '&lookbackHours=' + encodeURIComponent(String(lookbackHours));
  return fetch(url, { method: 'GET', credentials: 'same-origin' })
    .then(function(r){ return r.json(); })
    .then(function(j){ return j || { ok: false }; })
    .catch(function(e){ return { ok: false, error: (e && e.message) || String(e) }; });
}

function hgGoldLoadFedCalendar(){
  return fetch('/api/fed-calendar', { method: 'GET', credentials: 'same-origin' })
    .then(function(r){ return r.json(); })
    .then(function(j){ return j || { ok: false }; })
    .catch(function(e){ return { ok: false, error: (e && e.message) || String(e) }; });
}

function hgGoldApplyFormingRegime(cand, regime){
  try{
    if (!cand || !regime) return cand;
    var key = cand.stratKey || '';
    var cont = { ribbon:1, bosalign:1, macro:1, wkbreak:1, pullback:1, openrange:1 };
    var mrev = { vwap:1, vwapband:1, adrfade:1, fvg:1, stochrsi:1, sweep:1, liqsweep:1, nyexh:1, sweepob:1, silverb:1, smcliq:1, oitrap:1 };
    if (key === 'rsidiv'){
      cand.demoted = true;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      if (cand.stamps.indexOf('FOLKLORE') < 0) cand.stamps.push('FOLKLORE');
      var gn = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
      gn.push('RSI divergence — no defended mechanism; excluded from confluence (forming-layer drop)');
      cand.gateNotes = gn;
      return cand;
    }
    if (key === 'hvn' || key === 'poc'){
      cand.demoted = true;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      if (cand.stamps.indexOf('THIN VP') < 0) cand.stamps.push('THIN VP');
      var gn2 = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
      gn2.push('volume-profile on a thin perp/spot proxy — informational target only, not confluence');
      cand.gateNotes = gn2;
      return cand;
    }
    if (!regime.allowContinuation && cont[key]){
      cand.demoted = true;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      if (cand.stamps.indexOf('REGIME MR') < 0) cand.stamps.push('REGIME MR');
      var gn3 = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
      gn3.push(regime.why || 'continuation blocked in mean-reversion regime');
      cand.gateNotes = gn3;
    }
    if (!regime.allowMeanRev && mrev[key]){
      cand.demoted = true;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      if (cand.stamps.indexOf('REGIME TREND') < 0) cand.stamps.push('REGIME TREND');
      var gn4 = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
      gn4.push(regime.why || 'mean-reversion blocked in trend regime');
      cand.gateNotes = gn4;
    }
    /* HTF pullback continuation: require yield agreement when ER is trending */
    if (regime.style === 'trend' && regime.yieldBias && !regime.yieldBias.unchecked
        && regime.yieldBias.dir && cand.dir && regime.yieldBias.dir !== cand.dir
        && cont[key]){
      cand.demoted = true;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      if (cand.stamps.indexOf('REAL YIELD OPPOSE') < 0) cand.stamps.push('REAL YIELD OPPOSE');
    }
    return cand;
  }catch(e){ return cand; }
}

/* Unified forming readout for SCALP / SWING / OMNIGOLD panels. */
function hgGoldFormingStack(inp){
  var out = {
    regime: null, priorDay: null, asia: null, equals: null, sessionBuf: null,
    watches: [], strategies: [], note: ''
  };
  try{
    inp = inp || {};
    var rows = __rows(inp.rows15m || inp.rows || inp.rows4h);
    if (!rows || rows.length < 30){
      out.note = 'need ≥30 bars for forming stack';
      return out;
    }
    out.regime = hgGoldFormingRegime({
      rows: rows, macro: inp.macro, dxyRows: inp.dxyRows || (inp.macro && inp.macro.dxyRows)
    });
    out.priorDay = hgGoldPriorDayLevels(rows);
    out.asia = goldAsianRange(rows);
    out.equals = hgGoldEqualExtremes(rows, 0.12);
    out.sessionBuf = hgGoldSessionAtrBuffer(rows, inp.now || Date.now());
    out.oiTrap = hgGoldOiTrap(rows, inp.oiRows || inp.deltaOi || (inp.perpNative && inp.perpNative.oi), {});
    out.fundingExtreme = hgGoldFundingExtreme(
      inp.fundingRows || inp.deltaFunding || (inp.perpNative && inp.perpNative.funding), {});
    out.sweepEngine = hgGoldSweepEngine(rows, {
      regime: out.regime,
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      scalp: !!(inp.scalp || inp.tf === '15m' || inp.tf === '5m' || inp.tf === '1m'),
      mode: (inp.scalp || inp.tf === '15m' || inp.tf === '5m' || inp.tf === '1m') ? 'scalp' : (inp.mode || null)
    });
    out.nyExhaustion = hgGoldNyExhaustion(rows, {
      regime: out.regime,
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      now: inp.now || Date.now()
    });
    out.sweepOb = hgGoldSweepOb(rows, {
      regime: out.regime,
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      now: inp.now || Date.now(),
      rows4h: __rows(inp.rows4h),
      rows1h: __rows(inp.rows1h),
      sweep: out.sweepEngine
    });
    out.sessionBound = hgGoldSessionBoundSweep(rows, {
      asia: out.asia,
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      now: inp.now || Date.now()
    });
    out.part4 = hgGoldPart4Engine(rows, {
      asia: out.asia,
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null)
    });
    out.part5 = hgGoldPart5Engine(rows, {
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      now: inp.now || Date.now(),
      physical: inp.physical || null
    });
    out.smcLiq = hgGoldSmcLiquidity(rows, {});
    out.smcLiq._n = rows.length;
    out.smcHit = hgGoldSmcLiquidityHit(rows, {
      smc: out.smcLiq, closeBreak: true,
      maxAge: (inp.scalp || inp.tf === '15m') ? HG_GOLD_SMC_SWEPT_MAX_AGE : 12
    });
    out.smcBos = hgGoldSmcBosChoch(rows, { closeBreak: true, swingLength: 20 });
    out.smcLiq.hit = out.smcHit;
    out.vprof = goldVolumeProfile(rows, 100, 50);
    out.vpBundle = typeof hgGoldVpBundle === 'function' ? hgGoldVpBundle(rows, { now: inp.now }) : null;
    out.vpPlaybook = hgGoldVpPlaybook(rows, {
      scalp: !!(inp.scalp || inp.tf === '15m'),
      now: inp.now || Date.now(),
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      regime: out.regime,
      sweep: out.sweepEngine,
      rows4h: __rows(inp.rows4h),
      asia: out.asia,
      bundle: out.vpBundle,
      mssOk: !!(out.sweepEngine && out.sweepEngine.mss && out.sweepEngine.mss.ok)
    });
    out.vpTargets = null;
    try{
      var lead = null;
      if (out.sweepOb && out.sweepOb.ok && out.sweepOb.dir && (out.sweepOb.confirmed || out.sweepOb.tier === 'alert'))
        lead = out.sweepOb;
      else if (out.sessionBound && out.sessionBound.confirmed && out.sessionBound.dir)
        lead = out.sessionBound;
      else if (out.nyExhaustion && out.nyExhaustion.ok && out.nyExhaustion.dir) lead = out.nyExhaustion;
      else if (out.sweepEngine && out.sweepEngine.dir && (out.sweepEngine.ok || out.sweepEngine.score > 0))
        lead = out.sweepEngine;
      var vpSrc = (out.vpBundle && out.vpBundle.session) || out.vprof;
      if (lead && vpSrc){
        var px = rows[rows.length - 1].c;
        var stopGuess = (lead.plan && isFinite(lead.plan.stop)) ? lead.plan.stop
          : (isFinite(lead.level) ? lead.level + (lead.dir === 'long' ? -1 : 1) * (out.sessionBuf.stopBuffer || 0) : NaN);
        var vw = null;
        try{ vw = goldVWAP(rows); }catch(_v){}
        var atrsVp = _atr(rows, 14);
        out.vpTargets = hgGoldVpTargets({
          dir: lead.dir,
          entry: px,
          stop: stopGuess,
          vprof: vpSrc,
          bundle: out.vpBundle,
          thin: true,
          mssOk: !!(lead.mss && lead.mss.ok) || !!(lead.takeover && lead.takeover.mss && lead.takeover.mss.ok)
            || !!(lead.confirmed),
          newsLock: !!(inp.newsGate && inp.newsGate.lock),
          vwap: vw && isFinite(vw.vwap) ? vw.vwap : NaN,
          sweepExtreme: (lead.raid && isFinite(lead.raid.extreme)) ? lead.raid.extreme
            : (lead.takeover && isFinite(lead.extreme) ? lead.extreme : lead.level),
          atr: atrsVp && atrsVp.length ? atrsVp[atrsVp.length - 1] : NaN,
          auction: out.vpBundle && out.vpBundle.auction,
          external: {
            asiaHi: out.asia && out.asia.hi, asiaLo: out.asia && out.asia.lo,
            pdh: out.priorDay && out.priorDay.hi, pdl: out.priorDay && out.priorDay.lo,
            eqHi: out.equals && out.equals.highs && out.equals.highs[0] && out.equals.highs[0].level,
            eqLo: out.equals && out.equals.lows && out.equals.lows[0] && out.equals.lows[0].level
          }
        });
      }
    }catch(_vp){}

    function watch(key, state, level, condition, reason, dir, family){
      out.watches.push({
        stratKey: key, strategy: GST_NAME[key] || key, family: family || 'structure',
        state: state, level: level, condition: condition || '', reason: reason || null, dir: dir || null
      });
    }

    /* Layer 2 — Asia / PDH-PDL / equal extremes */
    if (out.asia && isFinite(out.asia.hi)){
      var aNear = Math.abs(rows[rows.length-1].c - out.asia.lo) <= Math.abs(out.asia.hi - rows[rows.length-1].c);
      watch('asian', 'armed', aNear ? out.asia.lo : out.asia.hi,
        'Asia 00:00–08:00 UTC box ' + out.asia.lo.toFixed(2) + '–' + out.asia.hi.toFixed(2)
          + ' — London sweep→reclaim is the primary gold forming setup',
        null, aNear ? 'long' : 'short', 'structure');
    } else watch('asian', 'idle', null, '', 'Asia box not ready', null, 'structure');

    if (out.priorDay && out.priorDay.ok){
      var px = rows[rows.length-1].c;
      var useLo = Math.abs(px - out.priorDay.lo) <= Math.abs(out.priorDay.hi - px);
      watch('pdraid', 'armed', useLo ? out.priorDay.lo : out.priorDay.hi,
        'Prior-day ' + (useLo ? 'low' : 'high') + ' ' + (useLo ? out.priorDay.lo : out.priorDay.hi).toFixed(2)
          + ' — NY 13:00–16:00 UTC liquidity raid watch',
        null, useLo ? 'long' : 'short', 'structure');
    } else watch('pdraid', 'idle', null, '', 'prior-day H/L unread', null, 'structure');

    if (out.equals.highs.length){
      watch('eqhi', 'armed', out.equals.highs[0].level,
        'Equal highs ~' + out.equals.highs[0].level.toFixed(2) + ' — clustered stops',
        null, 'short', 'structure');
    }
    if (out.equals.lows.length){
      watch('eqlo', 'armed', out.equals.lows[0].level,
        'Equal lows ~' + out.equals.lows[0].level.toFixed(2) + ' — clustered stops',
        null, 'long', 'structure');
    }
    if (out.smcLiq && out.smcLiq.ok){
      var smcWatch = (out.smcLiq.unswept && out.smcLiq.unswept[0])
        || (out.smcLiq.pools && out.smcLiq.pools[0]);
      if (smcWatch){
        watch('smcliq', out.smcHit && out.smcHit.ok ? 'armed' : 'armed', smcWatch.level,
          'SMC liquidity cluster n=' + smcWatch.count + ' @ ' + smcWatch.level.toFixed(2)
            + (smcWatch.unswept ? ' UNSWEPT' : ' SWEPT')
            + ' · band ' + ((out.smcLiq.rangePercent || 0) * 100).toFixed(1) + '%',
          null, smcWatch.dirAfterSweep || null, 'structure');
      }
    } else {
      watch('smcliq', 'idle', null, '', 'no SMC swing clusters', null, 'structure');
    }

    /* Layer 3/5 — Asia sweep→London + PDH raid confirmation status */
    if (out.asia && isFinite(out.asia.lo)){
      var sdL = hgGoldSweepDisplacement(rows, out.asia.lo, 'long', {
        rvolMin: (out.sessionBuf && out.sessionBuf.session === 'ASIAN') ? HG_GOLD_FORM_RVOL_ASIA : HG_GOLD_FORM_RVOL_MIN
      });
      var sdH = hgGoldSweepDisplacement(rows, out.asia.hi, 'short', {
        rvolMin: (out.sessionBuf && out.sessionBuf.session === 'ASIAN') ? HG_GOLD_FORM_RVOL_ASIA : HG_GOLD_FORM_RVOL_MIN
      });
      if (sdL.ok){
        out.strategies.push({
          key: 'asia-london', dir: 'long', level: out.asia.lo, grade: 'forming',
          why: 'Asia low swept + displacement reclaim — ' + sdL.why,
          invalidates: out.asia.lo - (out.sessionBuf.stopBuffer || 0),
          t1: out.asia.hi, t2: (out.priorDay && out.priorDay.ok) ? out.priorDay.hi : NaN
        });
      } else if (sdH.ok){
        out.strategies.push({
          key: 'asia-london', dir: 'short', level: out.asia.hi, grade: 'forming',
          why: 'Asia high swept + displacement reclaim — ' + sdH.why,
          invalidates: out.asia.hi + (out.sessionBuf.stopBuffer || 0),
          t1: out.asia.lo, t2: (out.priorDay && out.priorDay.ok) ? out.priorDay.lo : NaN
        });
      }
    }
    /* Session-bounded Silver Bullet twin (London/NY open window) */
    if (out.sessionBound && out.sessionBound.ok && out.sessionBound.dir
        && (out.sessionBound.confirmed || out.sessionBound.tier === 'alert' || out.sessionBound.reclaimOk)){
      out.strategies.push({
        key: 'silverb', dir: out.sessionBound.dir,
        level: out.sessionBound.sweepLevel,
        grade: out.sessionBound.confirmed ? 'confirmed' : 'forming',
        why: out.sessionBound.why,
        invalidates: out.sessionBound.stop,
        t1: out.sessionBound.t1, t2: out.sessionBound.t2
      });
      watch('silverb', out.sessionBound.confirmed ? 'armed' : 'armed',
        out.sessionBound.sweepLevel, out.sessionBound.why,
        null, out.sessionBound.dir, 'trigger');
    } else if (out.sessionBound && out.sessionBound.inWindow){
      watch('silverb', 'armed', out.asia && out.asia.lo, out.sessionBound.why || 'SB window live',
        null, null, 'trigger');
    } else {
      watch('silverb', 'idle', null, '',
        (out.sessionBound && out.sessionBound.why) || 'outside SB windows', null, 'trigger');
    }
    if (out.priorDay && out.priorDay.ok){
      var pdL = hgGoldSweepDisplacement(rows, out.priorDay.lo, 'long');
      var pdH = hgGoldSweepDisplacement(rows, out.priorDay.hi, 'short');
      if (pdL.ok || pdH.ok){
        var pdOk = pdL.ok ? pdL : pdH;
        out.strategies.push({
          key: 'pdh-pdl-ny', dir: pdL.ok ? 'long' : 'short',
          level: pdL.ok ? out.priorDay.lo : out.priorDay.hi, grade: 'forming',
          why: 'Prior-day liquidity raid — ' + pdOk.why,
          invalidates: (pdL.ok ? out.priorDay.lo : out.priorDay.hi)
            + (pdL.ok ? -1 : 1) * (out.sessionBuf.stopBuffer || 0)
        });
      }
    }

    /* Layer 3 — perp-native OI trap + funding extreme (Delta history) */
    if (out.oiTrap && out.oiTrap.ok){
      out.strategies.push({
        key: 'oi-trap', dir: out.oiTrap.dir, level: out.oiTrap.level, grade: 'forming',
        why: out.oiTrap.why,
        invalidates: isFinite(out.oiTrap.level)
          ? (out.oiTrap.level + (out.oiTrap.dir === 'long' ? -1 : 1) * (out.sessionBuf.stopBuffer || 0))
          : NaN
      });
      watch('oitrap', 'armed', out.oiTrap.level, out.oiTrap.why, null, out.oiTrap.dir, 'trigger');
    } else if (out.oiTrap && out.oiTrap.unchecked){
      watch('oitrap', 'idle', null, '', out.oiTrap.why || 'OI unread', null, 'trigger');
    } else {
      watch('oitrap', 'idle', null, '', (out.oiTrap && out.oiTrap.why) || 'no OI-trap this bar', null, 'trigger');
    }
    if (out.fundingExtreme && out.fundingExtreme.ok){
      out.strategies.push({
        key: 'funding-extreme', dir: out.fundingExtreme.dir, level: NaN, grade: 'frame',
        why: out.fundingExtreme.why
      });
      watch('fundext', 'armed', null, out.fundingExtreme.why, null, out.fundingExtreme.dir, 'trigger');
    } else {
      watch('fundext', 'idle', null, '',
        (out.fundingExtreme && out.fundingExtreme.why) || 'funding not extreme', null, 'trigger');
    }

    if (out.sweepEngine && (out.sweepEngine.confirmed || out.sweepEngine.tier === 'watch' || out.sweepEngine.tier === 'alert')){
      out.strategies.push({
        key: 'liq-sweep', dir: out.sweepEngine.dir, level: out.sweepEngine.level,
        grade: out.sweepEngine.confirmed ? 'confirmed' : 'watch',
        score: out.sweepEngine.score, tier: out.sweepEngine.tier,
        why: out.sweepEngine.why,
        invalidates: isFinite(out.sweepEngine.level)
          ? (out.sweepEngine.level + (out.sweepEngine.dir === 'long' ? -1 : 1) * (out.sessionBuf.stopBuffer || 0))
          : NaN
      });
      watch('liqsweep', out.sweepEngine.confirmed ? 'armed' : 'armed', out.sweepEngine.level,
        out.sweepEngine.why, null, out.sweepEngine.dir, 'trigger');
    }

    if (out.nyExhaustion && (out.nyExhaustion.confirmed || out.nyExhaustion.tier === 'watch' || out.nyExhaustion.tier === 'alert')){
      var nyInv = (out.nyExhaustion.plan && isFinite(out.nyExhaustion.plan.stop))
        ? out.nyExhaustion.plan.stop
        : (isFinite(out.nyExhaustion.level)
          ? (out.nyExhaustion.level + (out.nyExhaustion.dir === 'long' ? -1 : 1) * (out.sessionBuf.stopBuffer || 0))
          : NaN);
      out.strategies.push({
        key: 'ny-exhaustion', dir: out.nyExhaustion.dir, level: out.nyExhaustion.level,
        grade: out.nyExhaustion.confirmed ? 'confirmed' : 'watch',
        score: out.nyExhaustion.score, tier: out.nyExhaustion.tier,
        why: out.nyExhaustion.why,
        invalidates: nyInv,
        plan: out.nyExhaustion.plan || null
      });
      watch('nyexh', 'armed', out.nyExhaustion.level,
        out.nyExhaustion.why, null, out.nyExhaustion.dir, 'trigger');
    }

    if (out.sweepOb && (out.sweepOb.confirmed || out.sweepOb.tier === 'watch' || out.sweepOb.tier === 'alert')){
      var sobInv = (out.sweepOb.plan && isFinite(out.sweepOb.plan.stop))
        ? out.sweepOb.plan.stop
        : (isFinite(out.sweepOb.stop) ? out.sweepOb.stop : NaN);
      out.strategies.push({
        key: 'sweep-ob', dir: out.sweepOb.dir,
        level: isFinite(out.sweepOb.entry) ? out.sweepOb.entry : out.sweepOb.sweepLevel,
        grade: out.sweepOb.confirmed ? 'confirmed' : 'watch',
        score: out.sweepOb.quality ? out.sweepOb.quality.score : out.sweepOb.score,
        tier: out.sweepOb.tier,
        why: out.sweepOb.why,
        invalidates: sobInv,
        plan: out.sweepOb.plan || null,
        mode: out.sweepOb.mode
      });
      watch('sweepob', 'armed',
        isFinite(out.sweepOb.entry) ? out.sweepOb.entry : out.sweepOb.sweepLevel,
        out.sweepOb.why, null, out.sweepOb.dir, 'trigger');
    }

    out.note = (out.regime && out.regime.why) || '';
    if (out.strategies.length){
      out.note = (out.note ? out.note + ' · ' : '') + out.strategies.length + ' forming strategy hit(s)';
    }
    if (out.sweepEngine && out.sweepEngine.score >= HG_GOLD_SWEEP_WATCH){
      out.note = (out.note ? out.note + ' · ' : '') + 'sweep ' + out.sweepEngine.score + '/' + out.sweepEngine.tier;
    }
    if (out.nyExhaustion && out.nyExhaustion.score >= HG_GOLD_NY_WATCH){
      out.note = (out.note ? out.note + ' · ' : '') + 'ny-exh ' + out.nyExhaustion.score + '/' + out.nyExhaustion.tier;
    }
    if (out.sweepOb && out.sweepOb.quality && out.sweepOb.quality.score >= 5){
      out.note = (out.note ? out.note + ' · ' : '') + 'sweep→ob Q' + out.sweepOb.quality.score + '/10/' + out.sweepOb.tier;
    }
    if (out.part4 && out.part4.ok){
      out.note = (out.note ? out.note + ' · ' : '') + 'part4 ' + out.part4.strategies.length;
      var p4i;
      for (p4i = 0; p4i < out.part4.strategies.length && p4i < 3; p4i++){
        var p4s = out.part4.strategies[p4i];
        if (p4s.grade === 'forming' || p4s.grade === 'confirmed'){
          out.strategies.push({
            key: p4s.key, dir: p4s.dir, level: p4s.level,
            grade: p4s.grade, why: p4s.why, plan: p4s.plan || null
          });
          watch(p4s.key, 'armed', p4s.level, p4s.why, null, p4s.dir, 'trigger');
        }
      }
    }
    if (out.smcHit && out.smcHit.ok){
      out.strategies.push({
        key: 'smc-liq', dir: out.smcHit.dir, level: out.smcHit.level,
        grade: 'forming', why: out.smcHit.why,
        invalidates: isFinite(out.smcHit.level)
          ? (out.smcHit.level + (out.smcHit.dir === 'long' ? -1 : 1)
            * (out.sessionBuf && out.sessionBuf.stopBuffer || 0))
          : NaN
      });
      out.note = (out.note ? out.note + ' · ' : '') + 'smc-liq '
        + String(out.smcHit.dir || '').toUpperCase();
    }
    if (out.smcBos && out.smcBos.ok){
      out.note = (out.note ? out.note + ' · ' : '') + 'smc-'
        + (out.smcBos.bos ? 'bos' : 'choch') + '/' + out.smcBos.mode;
    }
    if (out.vpPlaybook && out.vpPlaybook.ok){
      out.note = (out.note ? out.note + ' · ' : '') + 'vp '
        + out.vpPlaybook.decision + ' ' + out.vpPlaybook.gatesPass + '/12';
      if (out.vpPlaybook.decision === 'ENTER'){
        out.strategies.push({
          key: 'vp-playbook', dir: out.vpPlaybook.dir,
          level: out.vpPlaybook.entry, grade: 'confirmed',
          why: out.vpPlaybook.why,
          invalidates: out.vpPlaybook.stop,
          plan: {
            entry: out.vpPlaybook.entry, stop: out.vpPlaybook.stop,
            t1: out.vpPlaybook.t1, t2: out.vpPlaybook.t2
          }
        });
        watch('vpbook', 'armed', out.vpPlaybook.entry, out.vpPlaybook.why,
          null, out.vpPlaybook.dir, 'trigger');
      } else {
        watch('vpbook', 'idle', null, '', out.vpPlaybook.why, null, 'trigger');
      }
    }

    /* Core confluence score for the lead forming strategy */
    try{
      var leadCand = null;
      if (out.strategies && out.strategies.length){
        leadCand = {
          dir: out.strategies[0].dir,
          stratKey: (out.strategies[0].key || '').replace(/-/g, ''),
          entry: rows[rows.length - 1].c,
          agree: 2,
          confirmed: out.strategies[0].grade === 'confirmed',
          sweepScore: out.sweepEngine && out.sweepEngine.score,
          nyExhScore: out.nyExhaustion && out.nyExhaustion.score,
          sweepObScore: out.sweepOb && out.sweepOb.quality && out.sweepOb.quality.score,
          vpTargets: out.vpTargets
        };
        if (/liq.?sweep/i.test(out.strategies[0].key || '')) leadCand.stratKey = 'liqsweep';
        if (/ny.?exh/i.test(out.strategies[0].key || '')) leadCand.stratKey = 'nyexh';
        if (/sweep.?ob/i.test(out.strategies[0].key || '')) leadCand.stratKey = 'sweepob';
        if (/silver|sess.?bound/i.test(out.strategies[0].key || '')) leadCand.stratKey = 'silverb';
        if (/smc.?liq/i.test(out.strategies[0].key || '')) leadCand.stratKey = 'smcliq';
        if (/vp.?playbook/i.test(out.strategies[0].key || '')) leadCand.stratKey = 'vpbook';
      }
      if (leadCand && leadCand.dir){
        out.confluence = hgGoldConfluenceScore(leadCand, {
          rows15m: rows, rows4h: __rows(inp.rows4h), macro: inp.macro,
          newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
          cot: inp.cot || (typeof window !== 'undefined' ? window.__hgGoldCot : null),
          vprof: out.vprof, regime: out.regime
        });
        if (out.confluence && out.confluence.ok){
          out.note = (out.note ? out.note + ' · ' : '')
            + 'conf ' + out.confluence.score + '/' + out.confluence.tier;
        }
      }
    }catch(_cf){}

    return out;
  }catch(e){
    out.note = 'forming stack error';
    return out;
  }
}

function hgGoldFormingStackHtml(stack){
  try{
    stack = stack || {};
    var h = '<div class="note" data-hg-gold-forming="1" style="margin-top:10px">';
    h += '<b>FORMING LAYERS</b>';
    if (stack.regime){
      h += ' · ER ' + (isFinite(stack.regime.er) ? stack.regime.er.toFixed(2) : '—')
        + ' · ' + String(stack.regime.style || 'mixed').toUpperCase();
      if (stack.regime.vol && stack.regime.vol.regime)
        h += ' · vol ' + stack.regime.vol.regime;
      if (stack.regime.stamps && stack.regime.stamps.length)
        h += ' · ' + stack.regime.stamps.join(' · ');
    }
    if (stack.oiTrap && stack.oiTrap.ok){
      h += '<div style="margin-top:4px"><b>OI-TRAP ' + String(stack.oiTrap.dir || '').toUpperCase() + '</b> — '
        + String(stack.oiTrap.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    if (stack.fundingExtreme && stack.fundingExtreme.ok){
      h += '<div style="margin-top:4px"><b>FUNDING EXTREME</b> — '
        + String(stack.fundingExtreme.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    if (stack.sweepEngine){
      h += hgGoldSweepEngineHtml(stack.sweepEngine);
    }
    if (stack.nyExhaustion){
      h += hgGoldNyExhaustionHtml(stack.nyExhaustion);
    }
    if (stack.sweepOb){
      h += hgGoldSweepObHtml(stack.sweepOb);
    }
    if (stack.sessionBound){
      h += hgGoldSessionBoundSweepHtml(stack.sessionBound);
    }
    if (stack.part4){
      h += hgGoldPart4Html(stack.part4);
    }
    if (stack.part5){
      h += hgGoldPart5Html(stack.part5);
    }
    if (stack.smcLiq){
      h += hgGoldSmcLiquidityHtml(stack.smcLiq);
    }
    if (stack.smcBos && stack.smcBos.ok){
      h += '<div style="margin-top:4px"><b>SMC BOS/CHoCH</b> ('
        + String(stack.smcBos.mode || 'close') + ') — '
        + String(stack.smcBos.why || '').replace(/[<>&]/g, '') + '</div>';
    }
    if (stack.vpPlaybook){
      h += hgGoldVpPlaybookHtml(stack.vpPlaybook);
    }
    if (stack.vpTargets && typeof hgGoldVpTargetsHtml === 'function'){
      h += hgGoldVpTargetsHtml(stack.vpTargets);
    }
    if (stack.confluence && typeof hgGoldConfluenceHtml === 'function'){
      h += hgGoldConfluenceHtml(stack.confluence);
    }
    if (stack.note) h += '<div class="dim" style="margin-top:4px">' + String(stack.note).replace(/[<>&]/g, '') + '</div>';
    var i, s;
    for (i = 0; i < (stack.strategies || []).length && i < 3; i++){
      s = stack.strategies[i];
      h += '<div style="margin-top:6px"><b>' + String(s.key).toUpperCase() + ' ' + String(s.dir || '').toUpperCase() + '</b>'
        + (isFinite(s.level) ? (' @ ' + (+s.level).toFixed(2)) : '')
        + ' — ' + String(s.why || '').replace(/[<>&]/g, '')
        + (isFinite(s.invalidates) ? (' · invalidation ' + (+s.invalidates).toFixed(2)) : '')
        + '</div>';
    }
    if (!(stack.strategies && stack.strategies.length)){
      h += '<div class="dim" style="margin-top:4px">no Asia/London or prior-day raid confirmed this bar — watches stay armed below</div>';
    }
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

/* ---------------- exports ---------------- */

W.goldFVG = goldFVG;
W.goldOrderBlocks = goldOrderBlocks;
W.goldSweeps = goldSweeps;
W.goldKillzone = goldKillzone;
W.goldVWAP = goldVWAP;
W.goldRibbon = goldRibbon;
W.goldIchimoku = goldIchimoku;
W.goldMFI = goldMFI;
W.goldVolSqueeze = goldVolSqueeze;
W.goldAsianRange = goldAsianRange;
W.goldRSIGold = goldRSIGold;
W.goldCCI = goldCCI;
W.goldStochRSI = goldStochRSI;
W.goldSeason = goldSeason;
W.goldScalpSetup = goldScalpSetup;
W.goldScalpSetups = goldScalpSetups;
W.goldScalpLevels = __gsLevels;
W.goldWatch = goldWatch;
W.goldRankSetups = goldRankSetups;
W.goldCrossVenueMap = goldCrossVenueMap;
W.goldWatchPromote = goldWatchPromote;
W.hgGoldInlineBridge = hgGoldInlineBridge;
W.__gsMicroVeto = __gsMicroVeto;
W.__swMicroVeto = __swMicroVeto;
W.goldNewsCaution = __newsCaution;
/* v54 GOLD MASTERCLASS exports */
W.goldVWAPBands = goldVWAPBands;
W.goldBOS = goldBOS;
W.goldPremiumDiscount = goldPremiumDiscount;
W.goldADR = goldADR;
W.goldOpeningRange = goldOpeningRange;
W.goldEqualLevels = goldEqualLevels;
W.goldADX = goldADX;
W.goldRangeBound = goldRangeBound;
W.goldHeikinAshi = goldHeikinAshi;
W.goldSmartExit = goldSmartExit;   /* shared ±30-min high-impact window check */
W.goldVolumeSpike = goldVolumeSpike;
W.goldVolumeProfile = goldVolumeProfile;
W.goldFVGHasHVNSupport = goldFVGHasHVNSupport;
W.goldSweepV2 = goldSweepV2;
W.goldFVGV2 = goldFVGV2;
W.isVolumeSpike = goldVolumeSpike;
W.buildVolumeProfile = goldVolumeProfile;
W.detectLiquiditySweep_V2 = goldSweepV2;
W.detectFVG_V2 = goldFVGV2;
W.evaluateScalp = evaluateScalp;
W.evaluateSwing = evaluateSwing;
W.HardgateGoldEngine = HardgateGoldEngine;
W.goldSwings = goldSwings;
W.goldMarketStructure = goldMarketStructure;
W.goldOrderBlockAt = goldOrderBlockAt;
W.goldActiveOrderBlocks = goldActiveOrderBlocks;
W.goldUpdateActiveZones = goldUpdateActiveZones;
W.goldOrderBlockRetest = goldOrderBlockRetest;
W.detectSwings = goldSwings;
W.detectMarketStructure = goldMarketStructure;
W.detectOrderBlocks = goldOrderBlockAt;
W.updateActiveZones = goldUpdateActiveZones;
W.detectOrderBlockRetest = goldOrderBlockRetest;
W.getMarketSession = getMarketSession;
W.calculateAsianRange = calculateAsianRange;
W.calculateADRExhaustion = calculateADRExhaustion;
W.calculateMacroHint = calculateMacroHint;
W.goldCalculateMacroHint = goldCalculateMacroHint;
W.calculateGoldSpotBasis = calculateGoldSpotBasis;
W.calculateKaufmanER = calculateKaufmanER;
W.NewsWindowGuard = NewsWindowGuard;
W.calculatePositionSize = calculatePositionSize;
W.goldAttachPositionSize = goldAttachPositionSize;
W.evaluateFundingRate = evaluateFundingRate;
W.TickBuffer = TickBuffer;
W.handleOrderUpdate = handleOrderUpdate;
W.EXTREME_FUNDING_PCT = EXTREME_FUNDING_PCT;
W.detectSMTDivergence = detectSMTDivergence;
W.goldSMTDivergence = detectSMTDivergence;
W.validateYieldCorrelation = validateYieldCorrelation;
W.goldYieldGuard = validateYieldCorrelation;
W.validateOBWithCVD = validateOBWithCVD;
W.calculateOrderBookImbalance = calculateOrderBookImbalance;
W.validateDomLiquidity = validateDomLiquidity;
W.evaluateTimeDecay = evaluateTimeDecay;
W.calculateDynamicThresholds = calculateDynamicThresholds;
W.hgYieldState = hgYieldState;
W.hgSmtState = hgSmtState;
W.goldMarketSession = goldMarketSession;
W.goldAsianRangeAt = goldAsianRangeAt;
W.goldADRExhaustion = goldADRExhaustion;
W.goldAsianBreakout = goldAsianBreakout;
W.goldADRFade = goldADRFade;
W.detectAsianBreakout = detectAsianBreakout;
W.detectADRFade = detectADRFade;
W.goldDetectorReads = goldDetectorReads;
W.hgGoldDisplacementBar = hgGoldDisplacementBar;
W.hgGoldIfvg = hgGoldIfvg;
W.hgGoldSweepConfirmed = hgGoldSweepConfirmed;
W.hgGoldObVolumeOk = hgGoldObVolumeOk;
W.hgGoldMacroLock = hgGoldMacroLock;
W.hgGoldSessionGate = hgGoldSessionGate;
W.hgGoldInstFilter = hgGoldInstFilter;
W.hgGoldAtrVolPercentile = hgGoldAtrVolPercentile;
W.hgGoldDxyCorr = hgGoldDxyCorr;
W.hgGoldFormingRegime = hgGoldFormingRegime;
W.hgGoldPriorDayLevels = hgGoldPriorDayLevels;
W.hgGoldEqualExtremes = hgGoldEqualExtremes;
W.hgGoldSmcSwingHighsLows = hgGoldSmcSwingHighsLows;
W.hgGoldSmcLiquidity = hgGoldSmcLiquidity;
W.hgGoldSmcLiquidityHit = hgGoldSmcLiquidityHit;
W.hgSmcLiquidityHit = hgGoldSmcLiquidityHit;
W.hgGoldSmcBosChoch = hgGoldSmcBosChoch;
W.hgGoldSmcLiquidityHtml = hgGoldSmcLiquidityHtml;
W.HG_GOLD_SMC_RANGE_PCT = HG_GOLD_SMC_RANGE_PCT;
W.HG_GOLD_SMC_SWING_LEN = HG_GOLD_SMC_SWING_LEN;
W.HG_GOLD_SMC_SWEPT_MAX_AGE = HG_GOLD_SMC_SWEPT_MAX_AGE;
W.hgGoldSweepDisplacement = hgGoldSweepDisplacement;
W.hgGoldLiquidityMap = hgGoldLiquidityMap;
W.hgGoldSweepEngine = hgGoldSweepEngine;
W.hgGoldSweepConfidence = hgGoldSweepConfidence;
W.hgGoldSweepEngineHtml = hgGoldSweepEngineHtml;
W.hgGoldSweepMss = hgGoldSweepMss;
W.hgGoldSweepFalseFilters = hgGoldSweepFalseFilters;
W.hgGoldSweepRvolBand = hgGoldSweepRvolBand;
W.hgGoldSweepResponseRvol = hgGoldSweepResponseRvol;
W.hgGoldSweepTwoStageRvol = hgGoldSweepTwoStageRvol;
W.hgGoldSweepTwoStageHtml = hgGoldSweepTwoStageHtml;
W.HG_GOLD_SWEEP_RVOL_MIN = HG_GOLD_SWEEP_RVOL_MIN;
W.HG_GOLD_SWEEP_RVOL_SCALP = HG_GOLD_SWEEP_RVOL_SCALP;
W.HG_GOLD_SWEEP_ATR_SCALP = HG_GOLD_SWEEP_ATR_SCALP;
W.HG_GOLD_SWEEP_RVOL_ASIA = HG_GOLD_SWEEP_RVOL_ASIA;
W.HG_GOLD_SWEEP_RVOL_RESPONSE = HG_GOLD_SWEEP_RVOL_RESPONSE;
W.HG_GOLD_SWEEP_RVOL_STRONG = HG_GOLD_SWEEP_RVOL_STRONG;
W.HG_GOLD_SWEEP_RVOL_BLOWOFF = HG_GOLD_SWEEP_RVOL_BLOWOFF;
W.HG_GOLD_SWEEP_RVOL_PROXY_NOTE = HG_GOLD_SWEEP_RVOL_PROXY_NOTE;
W.HG_GOLD_NY_RAID_ATR = HG_GOLD_NY_RAID_ATR;
W.HG_GOLD_NY_RAID_RVOL = HG_GOLD_NY_RAID_RVOL;
W.HG_GOLD_NY_TAKE_RVOL = HG_GOLD_NY_TAKE_RVOL;
W.HG_GOLD_NY_ALERT = HG_GOLD_NY_ALERT;
W.HG_GOLD_NY_WATCH = HG_GOLD_NY_WATCH;
W.hgGoldNyBlock = hgGoldNyBlock;
W.hgGoldSessionRvol = hgGoldSessionRvol;
W.hgGoldNyRvolSignature = hgGoldNyRvolSignature;
W.hgGoldNyExhaustion = hgGoldNyExhaustion;
W.hgGoldNyExhaustionScore = hgGoldNyExhaustionScore;
W.hgGoldNyExhaustionHtml = hgGoldNyExhaustionHtml;
W.HG_GOLD_SWEEPOB_ALERT_Q = HG_GOLD_SWEEPOB_ALERT_Q;
W.HG_GOLD_SWEEPOB_RR_ALERT = HG_GOLD_SWEEPOB_RR_ALERT;
W.HG_GOLD_SWEEPOB_BUF_ATR = HG_GOLD_SWEEPOB_BUF_ATR;
W.hgGoldHtfBias = hgGoldHtfBias;
W.hgGoldFreshOb = hgGoldFreshOb;
W.hgGoldFreshFvg = hgGoldFreshFvg;
W.hgGoldSweepObQuality = hgGoldSweepObQuality;
W.hgGoldSweepOb = hgGoldSweepOb;
W.hgGoldSweepObHtml = hgGoldSweepObHtml;
W.HG_GOLD_SB_LON_START = HG_GOLD_SB_LON_START;
W.HG_GOLD_SB_LON_END = HG_GOLD_SB_LON_END;
W.HG_GOLD_SB_NY_START = HG_GOLD_SB_NY_START;
W.HG_GOLD_SB_NY_END = HG_GOLD_SB_NY_END;
W.HG_GOLD_SB_LOOKBACK = HG_GOLD_SB_LOOKBACK;
W.HG_GOLD_SB_MIN_BREACH = HG_GOLD_SB_MIN_BREACH;
W.HG_GOLD_SB_RR_ALERT = HG_GOLD_SB_RR_ALERT;
W.hgGoldUtcHourFrac = hgGoldUtcHourFrac;
W.hgGoldSessionBoundWindow = hgGoldSessionBoundWindow;
W.hgGoldPriorHourRange = hgGoldPriorHourRange;
W.hgGoldSessionBoundSweep = hgGoldSessionBoundSweep;
W.hgGoldSessionBoundSweepHtml = hgGoldSessionBoundSweepHtml;
W.HG_GOLD_P4_EQ_BAND = HG_GOLD_P4_EQ_BAND;
W.HG_GOLD_P4_ADR_FADE = HG_GOLD_P4_ADR_FADE;
W.hgGoldPart4PremiumDiscount = hgGoldPart4PremiumDiscount;
W.hgGoldPart4ApplyDiscountFilter = hgGoldPart4ApplyDiscountFilter;
W.hgGoldPart4PoorExtreme = hgGoldPart4PoorExtreme;
W.hgGoldPart4Nr7 = hgGoldPart4Nr7;
W.hgGoldPart4AsiaSd = hgGoldPart4AsiaSd;
W.hgGoldPart4LookAboveFail = hgGoldPart4LookAboveFail;
W.hgGoldPart4Gap = hgGoldPart4Gap;
W.hgGoldPart4Engine = hgGoldPart4Engine;
W.hgGoldPart4Html = hgGoldPart4Html;
W.HG_GOLD_P5_KER_TREND = HG_GOLD_P5_KER_TREND;
W.HG_GOLD_P5_KER_CHOP = HG_GOLD_P5_KER_CHOP;
W.hgGoldPart5KerRegime = hgGoldPart5KerRegime;
W.hgGoldPart5SessionAnchor = hgGoldPart5SessionAnchor;
W.hgGoldPart5SessionVwap = hgGoldPart5SessionVwap;
W.hgGoldPart5CompositeRange = hgGoldPart5CompositeRange;
W.hgGoldPart5Wyckoff = hgGoldPart5Wyckoff;
W.hgGoldPart5TurtleSoup = hgGoldPart5TurtleSoup;
W.hgGoldPart5VwapFade = hgGoldPart5VwapFade;
W.hgGoldPart5ThreeDrive = hgGoldPart5ThreeDrive;
W.hgGoldPart5OpenType = hgGoldPart5OpenType;
W.hgGoldPart5NewsSpike = hgGoldPart5NewsSpike;
W.hgGoldPart5WeeklyBias = hgGoldPart5WeeklyBias;
W.hgGoldPart5ApplyRegimeFilter = hgGoldPart5ApplyRegimeFilter;
W.hgGoldPart5ApplyWeeklyBiasFilter = hgGoldPart5ApplyWeeklyBiasFilter;
W.hgGoldPart5Engine = hgGoldPart5Engine;
W.hgGoldPart5Html = hgGoldPart5Html;
W.hgGoldVpTargets = hgGoldVpTargets;
W.hgGoldVpTargetsHtml = hgGoldVpTargetsHtml;
W.hgGoldVpBundle = hgGoldVpBundle;
W.hgGoldVpAuction = hgGoldVpAuction;
W.hgGoldVpStop = hgGoldVpStop;
W.hgGoldVpSlice = hgGoldVpSlice;
W.hgGoldVpBias4h = hgGoldVpBias4h;
W.hgGoldVpLocationGrade = hgGoldVpLocationGrade;
W.hgGoldVpLvnBetween = hgGoldVpLvnBetween;
W.hgGoldVpPlaybook = hgGoldVpPlaybook;
W.hgGoldVpPlaybookHtml = hgGoldVpPlaybookHtml;
W.hgGoldVpContractSize = hgGoldVpContractSize;
W.HG_GOLD_VP_RR_ENTER = HG_GOLD_VP_RR_ENTER;
W.HG_GOLD_VP_RR_HALF = HG_GOLD_VP_RR_HALF;
W.HG_GOLD_VP_R_ATR_MAX = HG_GOLD_VP_R_ATR_MAX;
W.HG_GOLD_VP_GC_POINT = HG_GOLD_VP_GC_POINT;
W.HG_GOLD_VP_MGC_POINT = HG_GOLD_VP_MGC_POINT;
W.HG_GOLD_CONF_A = HG_GOLD_CONF_A;
W.HG_GOLD_CONF_GOOD = HG_GOLD_CONF_GOOD;
W.HG_GOLD_CONF_WATCH = HG_GOLD_CONF_WATCH;
W.hgGoldConfluenceTier = hgGoldConfluenceTier;
W.hgGoldConfluenceScore = hgGoldConfluenceScore;
W.hgGoldConfluenceHtml = hgGoldConfluenceHtml;
W.hgGoldApplyConfluence = hgGoldApplyConfluence;
W.hgGoldSessionAtrBuffer = hgGoldSessionAtrBuffer;
W.hgGoldApplyFormingRegime = hgGoldApplyFormingRegime;
W.hgGoldFormingStack = hgGoldFormingStack;
W.hgGoldFormingStackHtml = hgGoldFormingStackHtml;
W.hgGoldBarRvol = hgGoldBarRvol;
W.hgGoldRealYieldBias = hgGoldRealYieldBias;
W.hgGoldDollarBias = hgGoldDollarBias;
W.hgGoldNewsIsTier1 = hgGoldNewsIsTier1;
W.hgGoldNewsGate = hgGoldNewsGate;
W.hgGoldMergeFedFomc = hgGoldMergeFedFomc;
W.hgGoldOiTrap = hgGoldOiTrap;
W.hgGoldFundingExtreme = hgGoldFundingExtreme;
W.hgGoldApplyPerpNative = hgGoldApplyPerpNative;
W.hgGoldLoadDeltaPerp = hgGoldLoadDeltaPerp;
W.hgGoldLoadFedCalendar = hgGoldLoadFedCalendar;
W.hgGoldSpreadUsd = hgGoldSpreadUsd;
W.hgGoldSpreadLock = hgGoldSpreadLock;
W.hgGoldMtfBias = hgGoldMtfBias;
W.hgGoldMtfMatrix = hgGoldMtfMatrix;
W.HG_GOLD_SPREAD_MAX_USD = HG_GOLD_SPREAD_MAX_USD;
})();
