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
  oitrap: 'OI-TRAP REVERSAL',
  fundext: 'FUNDING EXTREME',
  liqsweep: 'GOLD LIQUIDITY SWEEP',
  nyexh: 'NY VOLUME EXHAUSTION'
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
          newsGate: newsState ? hgGoldNewsGate(newsState, nowMs) : null
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
            var vpSw = goldVolumeProfile(rows, 100, 50);
            if (vpSw){
              var tgSw = hgGoldVpTargets({
                dir: eng.dir, entry: entry,
                stop: isFinite(eng.level) ? eng.level + (eng.dir === 'long' ? -1 : 1) * a15 : NaN,
                vprof: vpSw, thin: true,
                mssOk: !!(eng.mss && eng.mss.ok) || !!eng.confirmed,
                vwap: (D.vw && isFinite(D.vw.vwap)) ? D.vw.vwap : NaN,
                external: {
                  asiaHi: D.asian && D.asian.hi, asiaLo: D.asian && D.asian.lo
                }
              });
              if (tgSw && tgSw.ok){
                engCand.vpTargets = tgSw;
                if (isFinite(tgSw.tp1)) engCand.t1 = tgSw.tp1;
                if (isFinite(tgSw.tp2)) engCand.t2 = tgSw.tp2;
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
            var vpNy = goldVolumeProfile(rows, 100, 50);
            if (vpNy){
              var tgNy = hgGoldVpTargets({
                dir: nyx.dir, entry: entry, stop: nyStop, vprof: vpNy, thin: true,
                mssOk: !!(nyx.takeover && nyx.takeover.mss && nyx.takeover.mss.ok) || !!nyx.confirmed,
                vwap: (D.vw && isFinite(D.vw.vwap)) ? D.vw.vwap : NaN,
                external: {
                  asiaHi: D.asian && D.asian.hi, asiaLo: D.asian && D.asian.lo,
                  pdh: D.__priorDay && D.__priorDay.hi, pdl: D.__priorDay && D.__priorDay.lo
                }
              });
              if (tgNy && tgNy.ok){
                nyCand.vpTargets = tgNy;
                if (isFinite(tgNy.tp1)) nyCand.t1 = tgNy.tp1;
                if (isFinite(tgNy.tp2)) nyCand.t2 = tgNy.tp2;
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
    var hvnThreshold = meanVol + stdDev;
    var hvns = [];
    var lvns = [];
    var lvnThreshold = Math.max(0, meanVol - 0.5 * stdDev);
    for (i = 0; i < bins; i++){
      var mid = minPrice + i * binSize + binSize / 2;
      if (profile[i] > hvnThreshold) hvns.push(mid);
      else if (profile[i] > 0 && profile[i] <= lvnThreshold) lvns.push(mid);
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
      pocPrice: pocPrice, hvns: hvns, lvns: lvns, binSize: binSize,
      minPrice: minPrice, maxPrice: maxPrice, bars: slice.length, totalVol: totalVol,
      profileHigh: maxPrice, profileLow: minPrice,
      vah: vah, val: val, valueAreaPct: 0.70,
      bins: bins, profile: profile,
      venueNote: 'VP from this feed is venue activity (XAUT/PAXG/spot/proxy) — not full COMEX GC'
    };
  }catch(e){ return null; }
}

/**
 * Post-sweep / directional target ladder from volume profile + external liquidity.
 * Prefer nearest opposing profile/liquidity level; require ≥1.5R for "confirmed" badge.
 */
function hgGoldVpTargets(opts){
  var out = {
    ok: false, dir: null, confirmed: false, thin: true,
    tp1: NaN, tp2: NaN, tp3: NaN, labels: [], why: '', parts: {},
    venueNote: 'VP from this feed is venue activity — map COMEX levels when available'
  };
  try{
    opts = opts || {};
    var dir = (opts.dir === 'short') ? 'short' : 'long';
    out.dir = dir;
    var entry = +opts.entry, stop = +opts.stop;
    var vprof = opts.vprof;
    if (!vprof || !isFinite(vprof.pocPrice)){ out.why = 'no volume profile'; return out; }
    out.thin = opts.thin !== false; /* default thin-venue caution */
    out.venueNote = vprof.venueNote || out.venueNote;

    var risk = (isFinite(entry) && isFinite(stop)) ? Math.abs(entry - stop) : NaN;
    var candidates = [];
    function add(level, label, pri){
      if (!isFinite(level)) return;
      if (dir === 'long' && isFinite(entry) && !(level > entry)) return;
      if (dir === 'short' && isFinite(entry) && !(level < entry)) return;
      candidates.push({ level: level, label: label, pri: pri || 50 });
    }

    /* Priority: external liquidity → major profile → LVN far edge → HTF */
    var ext = opts.external || {};
    if (dir === 'long'){
      add(ext.asiaHi || ext.londonHi, 'Asia/London high', 10);
      add(ext.pdh, 'prior-day high', 12);
      add(ext.eqHi, 'equal highs', 14);
      add(vprof.pocPrice, 'session POC', 20);
      if (vprof.hvns && vprof.hvns.length){
        var hn, nearestHvn = NaN;
        for (hn = 0; hn < vprof.hvns.length; hn++){
          if (vprof.hvns[hn] > entry && (!isFinite(nearestHvn) || vprof.hvns[hn] < nearestHvn))
            nearestHvn = vprof.hvns[hn];
        }
        add(nearestHvn, 'nearest HVN', 22);
      }
      add(vprof.vah, 'VAH', 24);
      if (vprof.lvns && vprof.lvns.length){
        var ln, farLvn = NaN;
        for (ln = 0; ln < vprof.lvns.length; ln++){
          if (vprof.lvns[ln] > entry && (!isFinite(farLvn) || vprof.lvns[ln] > farLvn))
            farLvn = vprof.lvns[ln];
        }
        add(farLvn, 'LVN far edge', 30);
      }
      add(vprof.profileHigh, 'profile high', 35);
      add(opts.vwap, 'session VWAP', 18);
    } else {
      add(ext.asiaLo || ext.londonLo, 'Asia/London low', 10);
      add(ext.pdl, 'prior-day low', 12);
      add(ext.eqLo, 'equal lows', 14);
      add(vprof.pocPrice, 'session POC', 20);
      if (vprof.hvns && vprof.hvns.length){
        var hn2, nearestHvn2 = NaN;
        for (hn2 = 0; hn2 < vprof.hvns.length; hn2++){
          if (vprof.hvns[hn2] < entry && (!isFinite(nearestHvn2) || vprof.hvns[hn2] > nearestHvn2))
            nearestHvn2 = vprof.hvns[hn2];
        }
        add(nearestHvn2, 'nearest HVN', 22);
      }
      add(vprof.val, 'VAL', 24);
      if (vprof.lvns && vprof.lvns.length){
        var ln2, farLvn2 = NaN;
        for (ln2 = 0; ln2 < vprof.lvns.length; ln2++){
          if (vprof.lvns[ln2] < entry && (!isFinite(farLvn2) || vprof.lvns[ln2] < farLvn2))
            farLvn2 = vprof.lvns[ln2];
        }
        add(farLvn2, 'LVN far edge', 30);
      }
      add(vprof.profileLow, 'profile low', 35);
      add(opts.vwap, 'session VWAP', 18);
    }

    candidates.sort(function(a, b){
      var da = Math.abs(a.level - entry), db = Math.abs(b.level - entry);
      if (a.pri !== b.pri) return a.pri - b.pri;
      return da - db;
    });

    /* Deduplicate near-identical levels */
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
      profileHigh: vprof.profileHigh, profileLow: vprof.profileLow
    };

    var rr1 = (isFinite(risk) && risk > 0) ? Math.abs(out.tp1 - entry) / risk : NaN;
    var mssOk = !!opts.mssOk;
    out.confirmed = !!(mssOk && isFinite(rr1) && rr1 >= 1.5 && !opts.newsLock);
    out.why = (out.confirmed ? 'PROFILE TARGET CONFIRMED' : 'PROFILE TARGETS')
      + ' ' + dir.toUpperCase()
      + ' · TP1 ' + out.labels[0]
      + (isFinite(rr1) ? (' · ' + rr1.toFixed(2) + 'R') : '')
      + (out.thin ? ' · THIN VP hint' : '');
    if (!mssOk) out.why += ' · need MSS agree for confirmed badge';
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
    if (tg.parts){
      h += '<div class="dim" style="margin-top:2px">POC '
        + (isFinite(tg.parts.poc) ? (+tg.parts.poc).toFixed(2) : '—')
        + ' · VAH ' + (isFinite(tg.parts.vah) ? (+tg.parts.vah).toFixed(2) : '—')
        + ' · VAL ' + (isFinite(tg.parts.val) ? (+tg.parts.val).toFixed(2) : '—')
        + '</div>';
    }
    if (tg.labels && tg.labels.length){
      h += '<div style="margin-top:4px">';
      var i;
      for (i = 0; i < tg.labels.length; i++){
        h += (i ? ' · ' : '') + '<b>TP' + (i + 1) + '</b> ' + String(tg.labels[i]).replace(/[<>&]/g, '');
      }
      h += '</div>';
    }
    if (tg.why) h += '<div class="dim" style="margin-top:2px">' + String(tg.why).replace(/[<>&]/g, '') + '</div>';
    h += '<div class="dim" style="margin-top:2px">' + String(tg.venueNote || '').replace(/[<>&]/g, '') + '</div>';
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
var HG_GOLD_SWEEP_RVOL_MIN = 1.20;
var HG_GOLD_SWEEP_ALERT = 75;
var HG_GOLD_SWEEP_WATCH = 65;
var HG_GOLD_SWEEP_EQ_TOL = 0.12;

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

/** Liquidity-level map: Asia · PDH/PDL · equals · pivots · round numbers. */
function hgGoldLiquidityMap(rows, opts){
  var out = { levels: [], atr: NaN, asia: null, priorDay: null, equals: null };
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
    var piv = hgGoldPivotLevels(rows, opts.pivotL || 3, opts.pivotR || 3);
    function add(level, kind, label, side){
      if (!isFinite(level)) return;
      out.levels.push({ level: level, kind: kind, label: label, side: side || null });
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
          /* Prefer session/prior-day over round/pivot duplicates */
          var rank = { asia: 5, pdh: 5, pdl: 5, equal: 4, pivot: 3, round: 1 };
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

function hgGoldSweepFalseFilters(rows, hit, opts){
  var out = { reject: false, reasons: [] };
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
          minAtr: HG_GOLD_SWEEP_ATR_MIN,
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
          regime: opts.regime, newsGate: opts.newsGate, rows: rows
        });
        cand.score = conf.score;
        cand.tier = conf.tier;
        cand.parts = conf.parts;
        cand.confirmed = conf.confirmed;
        cand.why = conf.why;
        cand.filters = conf.filters;
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

    /* Participation — 10 */
    if (isFinite(hit.rvol)){
      if (hit.rvol >= 1.5) p.participation = 10;
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
    out.confirmed = !!(hit.wick && hit.wick.closeReclaim && hit.mss && hit.mss.ok
      && (hit.vwap && (hit.vwap.ok || hit.vwap.unchecked))
      && (!isFinite(hit.rvol) || hit.rvol >= HG_GOLD_SWEEP_RVOL_MIN)
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
    var mrev = { vwap:1, vwapband:1, adrfade:1, fvg:1, stochrsi:1, sweep:1, liqsweep:1, nyexh:1, oitrap:1 };
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
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null)
    });
    out.nyExhaustion = hgGoldNyExhaustion(rows, {
      regime: out.regime,
      newsGate: inp.newsGate || (inp.news ? hgGoldNewsGate(inp.news, inp.now || Date.now()) : null),
      now: inp.now || Date.now()
    });
    out.vprof = goldVolumeProfile(rows, 100, 50);
    out.vpTargets = null;
    try{
      var lead = null;
      if (out.nyExhaustion && out.nyExhaustion.ok && out.nyExhaustion.dir) lead = out.nyExhaustion;
      else if (out.sweepEngine && out.sweepEngine.dir && (out.sweepEngine.ok || out.sweepEngine.score > 0))
        lead = out.sweepEngine;
      if (lead && out.vprof){
        var px = rows[rows.length - 1].c;
        var stopGuess = (lead.plan && isFinite(lead.plan.stop)) ? lead.plan.stop
          : (isFinite(lead.level) ? lead.level + (lead.dir === 'long' ? -1 : 1) * (out.sessionBuf.stopBuffer || 0) : NaN);
        var vw = null;
        try{ vw = goldVWAP(rows); }catch(_v){}
        out.vpTargets = hgGoldVpTargets({
          dir: lead.dir,
          entry: px,
          stop: stopGuess,
          vprof: out.vprof,
          thin: true,
          mssOk: !!(lead.mss && lead.mss.ok) || !!(lead.takeover && lead.takeover.mss && lead.takeover.mss.ok)
            || !!(lead.confirmed),
          newsLock: !!(inp.newsGate && inp.newsGate.lock),
          vwap: vw && isFinite(vw.vwap) ? vw.vwap : NaN,
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
    if (stack.vpTargets && typeof hgGoldVpTargetsHtml === 'function'){
      h += hgGoldVpTargetsHtml(stack.vpTargets);
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
W.hgGoldSweepDisplacement = hgGoldSweepDisplacement;
W.hgGoldLiquidityMap = hgGoldLiquidityMap;
W.hgGoldSweepEngine = hgGoldSweepEngine;
W.hgGoldSweepConfidence = hgGoldSweepConfidence;
W.hgGoldSweepEngineHtml = hgGoldSweepEngineHtml;
W.hgGoldSweepMss = hgGoldSweepMss;
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
W.hgGoldVpTargets = hgGoldVpTargets;
W.hgGoldVpTargetsHtml = hgGoldVpTargetsHtml;
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
