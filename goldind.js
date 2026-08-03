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
  goldAsianRange(rows)     — 00:00-07:00 GMT box + London breakout state
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
    else if (h >= 0 && h < 7){ zone = 'ASIAN'; weight = 0; label = 'ASIAN RANGE'; }
    return { zone: zone, weight: weight, hourGMT: Math.floor(h), label: label };
  }catch(e){ return { zone: 'OFF', weight: 0, hourGMT: NaN, label: 'OFF-HOURS' }; }
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
function goldMFI(rows){
  var out = { last: 'NONE', mfi: NaN, series: [] };
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
function goldVolSqueeze(rows){
  var out = { state: 'NONE', onRun: 0, firedAgo: null, dir: null };
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
   Box = 00:00-07:00 GMT high/low of the LAST bar's UTC day; trade the
   London-volume breakout. Needs candle timestamps.
   -> {hi, lo, mid, state:'LONG_BREAK'|'SHORT_BREAK'|'INSIDE'|'BUILDING', dayIso, bars} | null. */
function goldAsianRange(rows){
  try{
    rows = __rows(rows);
    if (!rows || rows.length < 3) return null;
    var n = rows.length, tl = rows[n-1].t;
    if (!isFinite(tl)) return null;
    var ds = Math.floor(tl/86400)*86400, boxEnd = ds + 7*3600;
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

    /* --- 4) session VWAP (anchored 00:00 GMT) --- */
    var anchor = -1, tl = lastBar.t;
    if (isFinite(tl)){
      var ds = Math.floor(tl/86400)*86400;
      for (var ai = n - 1; ai >= 0; ai--){
        var tt = rows[ai].t;
        if (!isFinite(tt) || tt < ds){ anchor = ai + 1; break; }
      }
      if (anchor < 0 || anchor >= n) anchor = 0;
    }
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
   (00:00-07:00 GMT) breakout, modified-RSI(75/25) divergence — with entry,
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
  hvn:      'HVN / VOLUME NODE RETEST'
};

/* shared ATR-survival level builder: stop 1.5-2x ATR14(15m) (never tighter),
   optionally extended to sit beyond a structure price; TP1 1.5R / TP2 2.5R
   with TP1 snapped to the NEAREST opposing structure between entry and TP1
   (any distance — the realized rr reports the honest structure-capped payoff;
   __gsCand then drops the candidate when that realized TP1 pays < 1.2R). */
function __gsLevels(dir, entry, a15, structStop, snapLvls){
  var stopDist = 1.5*a15, stopNote = 'stop 1.5×ATR14(15m)';
  if (isFinite(structStop)){
    var d = (dir === 'long') ? (entry - structStop) : (structStop - entry);
    if (d > 0){
      var want = d + 0.25*a15;
      if (want > 2*a15) want = 2*a15;
      if (want > stopDist){
        stopDist = want;
        stopNote = 'stop beyond structure ' + structStop.toFixed(2) + ' (' + (stopDist/a15).toFixed(2) + '×ATR14, capped 2×)';
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
   weight 0; the Asian-range strategy is allowed its own 00:00-07:00 GMT
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
    var lv = __gsLevels(dir, D.entry, D.a15, structStop, snapLvls);
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
      entry: D.entry, stop: lv.stop, t1: lv.t1, t2: lv.t2, rr: lv.rr, rr2: lv.rr2,
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
  var scalpCtx = { nearestStructure: null, entry: entry, atr15: a15 };
  if (bundleOpts.dxyCandles) scalpCtx.dxyCandles = bundleOpts.dxyCandles;
  if (bundleOpts.currentDxy) scalpCtx.currentDxy = bundleOpts.currentDxy;
  if (bundleOpts.macroHint) scalpCtx.macroHint = bundleOpts.macroHint;
  if (bundleOpts.paxgPrice) scalpCtx.paxgPrice = bundleOpts.paxgPrice;
  if (bundleOpts.spotXauPrice) scalpCtx.spotXauPrice = bundleOpts.spotXauPrice;
  if (bundleOpts.newsGuard) scalpCtx.newsGuard = bundleOpts.newsGuard;
  if (bundleOpts.news) scalpCtx.news = bundleOpts.news;
  if (bundleOpts.newsWindowMinutes) scalpCtx.newsWindowMinutes = bundleOpts.newsWindowMinutes;
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

  /* session VWAP anchored 00:00 GMT of the last bar's UTC day */
  var n = rows.length, anchor = -1, tl = rows[n-1].t;
  if (isFinite(tl)){
    var ds = Math.floor(tl/86400)*86400;
    for (var ai = n - 1; ai >= 0; ai--){
      var tt = rows[ai].t;
      if (!isFinite(tt) || tt < ds){ anchor = ai + 1; break; }
    }
    if (anchor < 0 || anchor >= n) anchor = 0;
  }
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

  var vsq = D.vsq = goldVolSqueeze(rows);
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
  var mfi = D.mfi = goldMFI(rows);
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
        if (entry >= nearH){
          add('long', 'hvn', 'price retesting HVN support at ' + nearH.toFixed(2) + ' — high-volume node holding');
        } else {
          add('short', 'hvn', 'price retesting HVN resistance at ' + nearH.toFixed(2) + ' — high-volume node capping');
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

    /* --- 6) Asian-range (00:00-07:00 GMT) breakout — robust: volume-validated --- */
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
          + ' (' + asian.dayIso + ', 00:00–07:00 GMT) — range expansion underway',
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
    if (D.vpOk && D.vprof && isFinite(D.nearestHVN) && Math.abs(entry - D.nearestHVN) <= 0.5*a15
        && (D.volSpike || D.volSpikeSweep)){
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
    function emit(key, state, level, condition, reason){
      out.push({ stratKey: key, strategy: GST_NAME[key] || key,
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
            + ') — fires on a wick ' + (nearLow ? 'below + reclaim close' : 'above + rejection close'), null);
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
            + obNear.top.toFixed(2) + ' — fires on a retest (price within 0.5×ATR of the zone)', null);
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
          + ' — fires on a retrace into the gap', null);
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
          + rb.mode + ' 20/50/200 ribbon', null);
    } else if (!rb || !isFinite(rb.e20)){
      emit('ribbon', 'idle', null, '', 'no levels available (20-EMA not computable on these bars)');
    } else {
      emit('ribbon', 'idle', null, '', 'ribbon ' + (rb.mode || 'NONE') + ' — no directional 20/50/200 stack to pull back into');
    }

    /* 6) Asian range — the 00:00–07:00 GMT box; fires on the London break
       + close outside. Honest idle when no box exists (e.g. 4h/1d rows). */
    var asian = D.asian;
    if (asian && isFinite(asian.hi) && isFinite(asian.lo)){
      var aNearLow = Math.abs(entry - asian.lo) <= Math.abs(asian.hi - entry);
      emit('asian', 'armed', aNearLow ? asian.lo : asian.hi,
        'armed 00:00–07:00 GMT: box ' + asian.lo.toFixed(2) + '–' + asian.hi.toFixed(2) + ' (' + asian.dayIso
          + (asian.state === 'BUILDING' ? ', still building' : '') + ') — fires on a London break + close outside', null);
    } else emit('asian', 'idle', null, '', 'no Asian-range box yet (needs >=3 bars inside 00:00–07:00 GMT) — no levels available');

    /* 7) RSI 75/25 divergence — always watching while RSI is computable;
       the pivot to beat is carried when one exists. */
    var rg = D.rg;
    if (rg && isFinite(rg.rsi)){
      var pivHi = (typeof rg.pivotHigh === 'number' && isFinite(rg.pivotHigh)) ? rg.pivotHigh : NaN;
      var pivLo = (typeof rg.pivotLow === 'number' && isFinite(rg.pivotLow)) ? rg.pivotLow : NaN;
      var piv = isFinite(pivHi) ? pivHi : pivLo;
      emit('rsidiv', 'armed', piv,
        'RSI now ' + rg.rsi.toFixed(1) + ' — fires on a fresh price extreme with a lower RSI extreme (75/25 divergence)'
          + (isFinite(piv) ? '; pivot to beat ' + piv.toFixed(2) : ' — no levels available yet (no confirmed pivot)'), null);
    } else emit('rsidiv', 'idle', null, '', 'no levels available (RSI(14) not computable on these bars)');

    /* 8) HVN / volume-node — nearest high-volume node from the session profile */
    if (D.vpOk && isFinite(D.nearestHVN)){
      emit('hvn', 'armed', D.nearestHVN,
        'watching HVN at ' + D.nearestHVN.toFixed(2) + ' (session volume profile) — fires on a retest within 0.5×ATR'
          + (D.volSpike ? ' with a volume-climax bar' : ''), null);
    } else if (D.vpOk && D.vprof && isFinite(D.vprof.pocPrice)){
      emit('hvn', 'armed', D.vprof.pocPrice,
        'watching session POC at ' + D.vprof.pocPrice.toFixed(2) + ' — fires on a retest within 0.75×ATR', null);
    } else emit('hvn', 'idle', null, '', 'no volume profile yet (needs >=3 bars with range and volume)');

    return out;
  }catch(e){ return []; }
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
   Sort: tally desc, then grade, then killzone weight, then agreeing reads
   (stable). -> {ranked:[cand + {tally, tallyParts:[{label,pts}]}], best} —
   {ranked:[], best:null} on any failure.
========================================================================= */
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
        parts.push({ label: 'macro ' + hint.toLowerCase() + (mWhy.length ? ' (' + mWhy.join(', ') + ')' : '')
                       + ' — ' + (mPts > 0 ? 'favors ' + c.dir + 's' : 'works against ' + c.dir + 's'), pts: mPts });
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
      var rrVal = isFinite(c.rr) ? +c.rr : (isFinite(c.rr1) ? +c.rr1 : NaN);
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
      /* (1) OFF-SESSION tally bar: demoted off-session candidates must clear
         +2 above the normal render bar or they are held back with a named
         reason line (never silently dropped). */
      if (c.demoted && c.offSession && tally < GS_OFFSESSION_BAR){
        out.rejected.push({ id: c.id || null, strategy: c.strategy || null, stratKey: c.stratKey || null,
                            dir: c.dir, venue: c.venue || null, sym: c.sym || null,
                            reason: 'OFF-SESSION — outside every ICT killzone; confluence tally '
                                    + (tally > 0 ? '+' : '') + tally + ' below the raised bar (+'
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
      var kx = isFinite(x.killzoneWeight) ? x.killzoneWeight : 0;
      var ky = isFinite(y.killzoneWeight) ? y.killzoneWeight : 0;
      if (ky !== kx) return ky - kx;
      var ax = isFinite(x.agree) ? x.agree : 0;
      var ay = isFinite(y.agree) ? y.agree : 0;
      if (ay !== ax) return ay - ax;
      var rrx = isFinite(x.rr) ? x.rr : (isFinite(x.rr1) ? x.rr1 : 0);
      var rry = isFinite(y.rr) ? y.rr : (isFinite(y.rr1) ? y.rr1 : 0);
      return rry - rrx;
    });
    out.ranked = ranked;
    out.best = null;
    for (i = 0; i < ranked.length; i++){   /* MOST PROBABLE = best non-demoted */
      if (!ranked[i].demoted){ out.best = ranked[i]; break; }
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
   00:00–07:00 GMT high/low. -> {asianHigh, asianLow, valid, hi, lo}. */
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
      if (hour >= 0 && hour < 7){
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
      return { action: 'FILLED', setup: activeSetup };
    }
    if (st === 'PARTIALLY_FILLED' || st === 'PARTIAL'){
      activeSetup.executionState = 'PARTIAL_RISK_ON';
      activeSetup.filledUnits = filled;
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
    for (i = 0; i < bins; i++){
      if (profile[i] > hvnThreshold){
        hvns.push(minPrice + i * binSize + binSize / 2);
      }
    }
    return { pocPrice: pocPrice, hvns: hvns, binSize: binSize,
             minPrice: minPrice, maxPrice: maxPrice, bars: slice.length, totalVol: totalVol };
  }catch(e){ return null; }
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

    return out;
  }catch(e){ return out; }
}

var HardgateGoldEngine = { evaluateScalp: evaluateScalp, evaluateSwing: evaluateSwing };

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
W.goldWatch = goldWatch;
W.goldRankSetups = goldRankSetups;
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
W.goldMarketSession = goldMarketSession;
W.goldAsianRangeAt = goldAsianRangeAt;
W.goldADRExhaustion = goldADRExhaustion;
W.goldAsianBreakout = goldAsianBreakout;
W.goldADRFade = goldADRFade;
W.detectAsianBreakout = detectAsianBreakout;
W.detectADRFade = detectADRFade;
W.goldDetectorReads = goldDetectorReads;
})();
