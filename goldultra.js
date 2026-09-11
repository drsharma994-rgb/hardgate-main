/* HARDGATE — GOLD ULTRA tab (hg-v706)
   ================================================================================
   ONE plain scalp rule on gold, EVERY standard indicator fed in, VERIFIED.

   THE RULE (the whole strategy fits in one line)
   ----------------------------------------------
     On every CLOSED 15m bar, every directional indicator read votes LONG /
     SHORT / neutral. When at least RULE.minAvail reads are decisive and
     RULE.minPct of them agree on one side — and the REGIME gate (the
     non-directional reads: choppiness, ADX, VHF, Hilbert trend-mode) does not
     read CHOP — that side FIRES: entry at the close (market), stop
     RULE.stopAtr x ATR14(15m) widened to the venue cost floor when tighter,
     TP1 = RULE.t1R x risk, TP2 = RULE.t2R x risk, dead after RULE.timeoutBars.
     Nothing else. The card prints every read, its value, its vote and its
     rule, so the count can be audited by eye.

   THE UNIVERSE — the standard charting/TA-Lib directory, every entry named
   --------------------------------------------------------------------------
   Each read is one of four KINDS, printed on its row:
     vote    directional — counts toward the agreement
     regime  non-directional — prints, and feeds the REGIME gate
     print   informational, or a duplicate of another read's information
             (e.g. Aroon Oscillator IS Aroon Up-Down; AMA IS KAMA) — shown,
             never counted twice
     n/a     cannot be computed honestly from one instrument's bars (market
             breadth: A/D line, TRIN, McClellan; Beta / correlation need a
             second series) — shown as not applicable, never faked
   MOVING AVERAGES / OVERLAP: KAMA(AMA) · ALMA · Bollinger · displaced MA ·
   Donchian · DEMA · envelopes · EMA 9/21/50/200 + cascade · fractal chaos
   bands · GMMA · HMA · Ichimoku (cloud, Tenkan/Kijun, Chikou) · Keltner ·
   LSMA · MESA MAMA/FAMA · McGinley · MAVP · Parabolic SAR · pivots (standard,
   Fibonacci, Camarilla, Woodie, DeMark) · price channel · SMMA/RMA · SMA ·
   SuperTrend · TEMA · T3 · session VWAP · VWMA · WMA · Zig Zag
   MOMENTUM: APO · Awesome · Balance of Power · Center of Gravity · CMO · CCI ·
   Coppock · DPO · DMI/DX · Elder-Ray · Fisher · Forecast Osc · Gator/Alligator
   · IMI · KST · MACD (line, histogram) · Momentum · PPO · QQE · ROC · RMI ·
   RSI · RVI · Schaff Trend Cycle · SMI · Stochastic fast/slow/full · StochRSI
   · TRIX · TSI · Ultimate · Williams %R · 1H RSI (HTF)
   VOLATILITY: ADR · ATR · Bollinger bandwidth · %B · Chaikin volatility ·
   Choppiness · historical vol · Mass Index · NATR · std dev · true range ·
   Ulcer · volatility stop · Vortex
   VOLUME: A/D line · ASI · CMF · Chaikin osc · EOM · Elder force · Klinger ·
   BW Market Facilitation · MFI · NVI · OBV · PVI · PVT · volume osc · volume
   profile POC · VROC
   TREND: ADX · ADXR · Aroon up/down · Aroon osc · TII · VHF
   CYCLE / STAT: Beta · correlation · Elliott wave osc · Hilbert DC period,
   DC phase, phasor, sinewave, trend-vs-cycle · linreg angle / intercept /
   slope · std error · TSF · variance
   BREADTH: A/D line · TRIN · McClellan osc · McClellan summation
   PLUS the two HTF reads (1H EMA 50 slope, 1H price vs EMA 200) and
   candle reads (engulfing, pin bar, three-bar) the gold desks already use.
   AND the extended directories fed on request (each row says its kind):
   ADVANCED MA (FWMA, FRAMA, ZLEMA, SINWMA, JMA-public) · SMART MONEY (Asia
   sweep, CHoCH, EQH/EQL, MSS, order/breaker/mitigation blocks, liquidity
   voids, OTE, golden pocket, CRT, MSNR) · TV/ML (WaveTrend, Cipher B,
   Lorentzian, KNN, NWE, UT Bot, SuperTrend-AI-open, Trend Magic, HalfTrend,
   SSL, Chandelier, Didi, Trend Meter, LazyBear squeeze) · EHLERS/DSP (cyber
   cycle, decycler, EMD, inverse Fisher, instantaneous trendline, Laguerre
   RSI/filter, roofing, super smoother, Voss, DSMA) · BILL WILLIAMS (AC) ·
   MT4/MT5 (TDI, HA-smoothed, ASH, CCI arrows, TD Sequential, REI, Waddah
   Attar, TMA, ASO, Hoffman IRB) · SESSION BOXES / BANDS (London box, Asia
   box, Darvas, ATR bands, STARC, BBand stop, JVB, Hurst, ZigZag channel,
   synthetic VIX) · SPECIALISED MOMENTUM (Value Chart, SMIEO, TSI-MACD, PRO,
   SMA-MACD, Gioteen, Demand Index, Delta WPR) · VSA / FLOW (Better Volume,
   BSV, WAD, PFE, session VP, anchored VWAP, VW-MACD, CVD-proxy, TPO, value
   area) · HARMONICS (Gartley, Bat, Butterfly, Crab, Cypher, Shark, Wolfe) ·
   15 TA-Lib CANDLE PATTERNS. Named commercial products with undisclosed
   logic, tape/DOM tools, and intermarket overlays are listed as n/a rows —
   shown, never faked.
   PARTICIPATION (volume vs 20-bar avg) prints and never votes: OMNIGOLD
   measured volume-on-trigger pointing the wrong way on gold.

   SELF-CONTAINED MATH, ON PURPOSE
   -------------------------------
   Every indicator is computed by this file's own kernel (SMA-seeded EMA,
   Wilder RSI/ATR/ADX — goldind.js's documented fallback conventions). No
   window global is consulted for math. That lets scripts/backtest-goldultra.mjs
   boot THIS file alone in a vm sandbox and replay byte-identical arithmetic:
   the VERIFIED panel shows numbers this exact code produced.

   VERIFIED, NOT CLAIMED
   ---------------------
   HG_GOLD_ULTRA_EVIDENCE is baked from scripts/backtest-goldultra.mjs (zero
   lookahead, closed bars only, bar clock never wall clock, XM XAUUSD 0.020%
   RT primary / PAXG 0.26% RT sensitivity). RULE.minPct and RULE.regimeGate
   were CHOSEN on the first 70% of history; the panel reports the untouched
   last 30% and prints the stated limitations verbatim. No strategy measures
   100%. Until a full run is baked the panel says NOT YET MEASURED and the
   rule fires nothing as tradable.

   FEEDS: getGoldCandles('15m'/'1h'/'4h'/'1d') with the PAXGUSDT fallback;
   closed bars only (hg-v698). Venue cost via hgOgVenueCost() when mounted;
   absent -> the cost floor is skipped and SAID.

   SETUPS (hg-v707) — where the tickets come from
   -----------------------------------------------
   The plain vote measured negative, so it never issues a ticket (RECORD
   ONLY). scripts/backtest-goldultra-filter.mjs joined every GOLD SCALP trade
   to the ULTRA read of its own signal bar: the desk's PREFER rows (p6fail,
   p9volbar — reversal mechanics) paid MORE against the consensus and went
   flat with it, same sign in-sample / out-of-sample and in both book cuts.
   So this tab's SETUPS are the GOLD SCALP candidates (goldScalpSetups ->
   goldRankSetups -> hgFilterGoldPostGate, the desk's own pipeline, feature-
   checked), and the count is a contrarian confluence stamp: a prefer-row
   card reading AGAINST CONSENSUS is crowned (and recorded to the forward
   ledger as GOLDSCALP-<key>-AGAINST-ULTRA); WITH CONSENSUS is shown, never
   crowned; unproven / non-prefer / demoted cards are shown with their
   reasons. The measured record (with its small n) prints on every card and
   in the VERIFIED filter panel. HG_GOLD_ULTRA_FILTER holds the numbers.
   ================================================================================ */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'goldultra';
var KL_15M = 320, KL_1H = 400;
var MIN_15M = 230, MIN_1H = 210;

var RULE = {
  minAvail: 25, minPct: 0.85, regimeGate: true,
  stopAtr: 1.5, costFloorMult: 8, t1R: 1.5, t2R: 2.5, timeoutBars: 24
};
var HG_GOLD_ULTRA_EVIDENCE = {
 "generated": "2026-09-11T16:27:45.409Z",
 "symbol": "PAXGUSDT",
 "bars": 5999,
 "mode": "full",
 "rule": {
  "minPct": 0.85,
  "minAvail": 25,
  "regimeGate": true,
  "stopAtr": 1.5,
  "t1R": 1.5,
  "t2R": 2.5,
  "timeoutBars": 24,
  "costFloorMult": 8
 },
 "chosenBy": "best in-sample avg R net @XM at n>=80",
 "isShare": "70%",
 "oosShare": "30%",
 "isSpan": "2026-07-13 .. 2026-08-24",
 "oosSpan": "2026-08-24 .. 2026-09-11",
 "ins": {
  "n": 290,
  "unfilled": 0,
  "winRate": 0.372,
  "avgR_gross": 0.094,
  "avgR_net_xm": 0.001,
  "avgR_net_paxg": -1.103,
  "sumR_net_xm": 0.43,
  "bothTouch": 1,
  "timeouts": 40
 },
 "oos": {
  "n": 137,
  "unfilled": 0,
  "winRate": 0.299,
  "avgR_gross": -0.13,
  "avgR_net_xm": -0.215,
  "avgR_net_paxg": -1.236,
  "sumR_net_xm": -29.52,
  "bothTouch": 1,
  "timeouts": 17
 },
 "tradable": false,
 "verdict": "Out-of-sample the rule did NOT pay after XM costs (-0.215R per trade on n=137) — fires print for the record and are NOT tradable tickets.",
 "limitations": [
  "MARKET FILL AT THE SIGNAL CLOSE: the walk fills BUY/SELL on bar i+1 at the entry price (= the signal close), ignoring the i+1 open gap; PAXG 15m gaps are small but weekend proxy bars exist",
  "SAME-BAR FILL->TARGET OPTIMISM: 4 of 41 OOS wins settle on the fill bar (market fills, so OHLC cannot order open->stop->t1 within it); both-touch bars ARE losses (1)",
  "PORTFOLIO STATS NOT ATTAINABLE: one live trade per side, unlimited overlap between sides; read per-trade expectancy only",
  "THE RULE WAS PICKED ON THE FIRST 70% AND REPORTED ON THE LAST 30%: one split, one regime of gold history — a different quarter can measure differently; the grid rows show how sensitive the choice is",
  "PAXGUSDT proxy for XAUUSD: basis ~0.1-0.5%, 24/7 weekend bars a broker never printed; the tab quotes broker XAUUSD at XM costs (primary) with PAXG costs as the sensitivity row",
  "the 319 directional reads (of 492 fed) are heavily correlated (dozens are moving-average variants); agreement % is a count, not an independence-weighted probability — the backtest measures what the count is worth, nothing more"
 ],
 "rows": [
  {
   "label": "direction long",
   "n": 56,
   "unfilled": 0,
   "winRate": 0.268,
   "avgR_gross": -0.21,
   "avgR_net_xm": -0.301,
   "avgR_net_paxg": -1.383,
   "sumR_net_xm": -16.83,
   "bothTouch": 0,
   "timeouts": 8
  },
  {
   "label": "direction short",
   "n": 81,
   "unfilled": 0,
   "winRate": 0.321,
   "avgR_gross": -0.075,
   "avgR_net_xm": -0.157,
   "avgR_net_paxg": -1.134,
   "sumR_net_xm": -12.69,
   "bothTouch": 1,
   "timeouts": 9
  },
  {
   "label": "session ASIA(00-07)",
   "n": 50,
   "unfilled": 0,
   "winRate": 0.3,
   "avgR_gross": -0.196,
   "avgR_net_xm": -0.284,
   "avgR_net_paxg": -1.345,
   "sumR_net_xm": -14.2,
   "bothTouch": 0,
   "timeouts": 3
  },
  {
   "label": "session LONDON(07-12)",
   "n": 25,
   "unfilled": 0,
   "winRate": 0.32,
   "avgR_gross": -0.075,
   "avgR_net_xm": -0.165,
   "avgR_net_paxg": -1.241,
   "sumR_net_xm": -4.12,
   "bothTouch": 1,
   "timeouts": 3
  },
  {
   "label": "session NY-LATE(17-24)",
   "n": 25,
   "unfilled": 0,
   "winRate": 0.4,
   "avgR_gross": 0.065,
   "avgR_net_xm": -0.03,
   "avgR_net_paxg": -1.174,
   "sumR_net_xm": -0.75,
   "bothTouch": 0,
   "timeouts": 2
  },
  {
   "label": "session NY-OVERLAP(12-17)",
   "n": 37,
   "unfilled": 0,
   "winRate": 0.216,
   "avgR_gross": -0.212,
   "avgR_net_xm": -0.282,
   "avgR_net_paxg": -1.127,
   "sumR_net_xm": -10.44,
   "bothTouch": 0,
   "timeouts": 9
  },
  {
   "label": "agreement >=85%",
   "n": 137,
   "unfilled": 0,
   "winRate": 0.299,
   "avgR_gross": -0.13,
   "avgR_net_xm": -0.215,
   "avgR_net_paxg": -1.236,
   "sumR_net_xm": -29.52,
   "bothTouch": 1,
   "timeouts": 17
  },
  {
   "label": "regime mixed",
   "n": 88,
   "unfilled": 0,
   "winRate": 0.284,
   "avgR_gross": -0.146,
   "avgR_net_xm": -0.237,
   "avgR_net_paxg": -1.324,
   "sumR_net_xm": -20.82,
   "bothTouch": 1,
   "timeouts": 12
  },
  {
   "label": "regime trend",
   "n": 49,
   "unfilled": 0,
   "winRate": 0.327,
   "avgR_gross": -0.103,
   "avgR_net_xm": -0.178,
   "avgR_net_paxg": -1.077,
   "sumR_net_xm": -8.7,
   "bothTouch": 0,
   "timeouts": 5
  }
 ]
};

/* =========================== kernel =========================== */
function nanArr(n){ var a = new Array(n); for (var i = 0; i < n; i++) a[i] = NaN; return a; }
function last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }
function at(a, k){ return (a && a.length > k) ? a[a.length - 1 - k] : NaN; }
function closes(rows){ return rows.map(function(r){ return r.c; }); }
function fmt(n, d){ return (n !== null && n !== undefined && isFinite(n)) ? Number(n).toFixed(d === undefined ? 2 : d) : '—'; }
function vs(a, b){ return (isFinite(a) && isFinite(b)) ? (a > b ? 1 : a < b ? -1 : 0) : 0; }
function sgn(x){ return isFinite(x) ? (x > 0 ? 1 : x < 0 ? -1 : 0) : 0; }
function fill0(a){ return a.map(function(x){ return isFinite(x) ? x : 0; }); }
function sma(v, p){ var out = nanArr(v.length), s = 0; for (var i = 0; i < v.length; i++){ s += v[i]; if (i >= p) s -= v[i - p]; if (i >= p - 1) out[i] = s / p; } return out; }
function ema(v, p){
  var out = nanArr(v.length), k = 2 / (p + 1), s = 0;
  for (var i = 0; i < v.length; i++){
    if (i < p - 1){ s += v[i]; continue; }
    if (i === p - 1){ s += v[i]; out[i] = s / p; continue; }
    out[i] = v[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}
function rma(v, p){ /* Wilder / SMMA */
  var out = nanArr(v.length), s = 0;
  for (var i = 0; i < v.length; i++){
    if (i < p){ s += v[i]; if (i === p - 1) out[i] = s / p; continue; }
    out[i] = (out[i - 1] * (p - 1) + v[i]) / p;
  }
  return out;
}
function wma(v, p){ var out = nanArr(v.length), den = p * (p + 1) / 2; for (var i = p - 1; i < v.length; i++){ var s = 0; for (var j = 0; j < p; j++) s += v[i - j] * (p - j); out[i] = s / den; } return out; }
function hma(v, p){
  var half = wma(v, Math.max(1, Math.round(p / 2))), full = wma(v, p), q = Math.max(1, Math.round(Math.sqrt(p)));
  return wma(fill0(v.map(function(_, i){ return 2 * half[i] - full[i]; })), q).map(function(x, i){ return i < p + q ? NaN : x; });
}
function dema(v, p){ var e = ema(v, p), ee = ema(fill0(e), p); return v.map(function(_, i){ return i < 2 * p ? NaN : 2 * e[i] - ee[i]; }); }
function tema(v, p){ var e = ema(v, p), ee = ema(fill0(e), p), eee = ema(fill0(ee), p); return v.map(function(_, i){ return i < 3 * p ? NaN : 3 * e[i] - 3 * ee[i] + eee[i]; }); }
function t3(v, p, b){
  var gd = function(x){ var e = ema(fill0(x), p), ee = ema(fill0(e), p); return x.map(function(_, i){ return e[i] * (1 + b) - ee[i] * b; }); };
  return gd(gd(gd(v))).map(function(x, i){ return i < 6 * p ? NaN : x; });
}
function kama(v, p, f, s){
  var out = nanArr(v.length), kf = 2 / (f + 1), ks = 2 / (s + 1);
  for (var i = p; i < v.length; i++){
    var vol = 0; for (var j = 0; j < p; j++) vol += Math.abs(v[i - j] - v[i - j - 1]);
    var er = vol ? Math.abs(v[i] - v[i - p]) / vol : 0, sc = Math.pow(er * (kf - ks) + ks, 2);
    out[i] = (i === p || !isFinite(out[i - 1])) ? v[i] : out[i - 1] + sc * (v[i] - out[i - 1]);
  }
  return out;
}
function alma(v, p, off, sig){
  var m = off * (p - 1), s = p / sig, w = [], ws = 0;
  for (var j = 0; j < p; j++){ w[j] = Math.exp(-((j - m) * (j - m)) / (2 * s * s)); ws += w[j]; }
  var out = nanArr(v.length);
  for (var i = p - 1; i < v.length; i++){ var acc = 0; for (var k = 0; k < p; k++) acc += v[i - (p - 1) + k] * w[k]; out[i] = acc / ws; }
  return out;
}
function linreg(v, p){ /* per-bar slope/intercept/endpoint/stderr over the trailing p */
  var n = v.length, slope = nanArr(n), icpt = nanArr(n), end = nanArr(n), se = nanArr(n), sx = 0, sxx = 0;
  for (var j = 0; j < p; j++){ sx += j; sxx += j * j; }
  for (var i = p - 1; i < n; i++){
    var sy = 0, sxy = 0;
    for (var k = 0; k < p; k++){ var y = v[i - p + 1 + k]; sy += y; sxy += k * y; }
    var b = (p * sxy - sx * sy) / (p * sxx - sx * sx), a = (sy - b * sx) / p, ss = 0;
    for (var m = 0; m < p; m++){ var e = v[i - p + 1 + m] - (a + b * m); ss += e * e; }
    slope[i] = b; icpt[i] = a; end[i] = a + b * (p - 1); se[i] = Math.sqrt(ss / Math.max(1, p - 2));
  }
  return { slope: slope, icpt: icpt, end: end, se: se };
}
function mcginley(v, p){ var out = nanArr(v.length); for (var i = 0; i < v.length; i++){ var m = out[i - 1]; out[i] = (i === 0 || !isFinite(m)) ? v[i] : m + (v[i] - m) / (p * Math.pow(v[i] / m, 4)); } return out; }
function vwmaArr(rows, p){ var out = nanArr(rows.length); for (var i = p - 1; i < rows.length; i++){ var pv = 0, vv = 0; for (var j = 0; j < p; j++){ pv += rows[i - j].c * rows[i - j].v; vv += rows[i - j].v; } out[i] = vv > 0 ? pv / vv : NaN; } return out; }
function rsi(v, p){
  var out = nanArr(v.length), g = 0, l = 0;
  for (var i = 1; i < v.length; i++){
    var d = v[i] - v[i - 1], up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
    if (i <= p){ g += up; l += dn; if (i === p){ g /= p; l /= p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } continue; }
    g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
function rmi(v, p, m){
  var out = nanArr(v.length), g = 0, l = 0, c = 0;
  for (var i = m; i < v.length; i++){
    var d = v[i] - v[i - m], up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
    if (c < p){ g += up; l += dn; c++; if (c === p){ g /= p; l /= p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } continue; }
    g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
function trSeries(rows){ return rows.map(function(r, i){ if (!i) return r.h - r.l; var pc = rows[i - 1].c; return Math.max(r.h - r.l, Math.abs(r.h - pc), Math.abs(r.l - pc)); }); }
function atr(rows, p){ return rma(trSeries(rows), p); }
function adx(rows, p){
  var n = rows.length, tr = trSeries(rows), pdm = nanArr(n), mdm = nanArr(n);
  for (var i = 1; i < n; i++){ var up = rows[i].h - rows[i - 1].h, dn = rows[i - 1].l - rows[i].l; pdm[i] = (up > dn && up > 0) ? up : 0; mdm[i] = (dn > up && dn > 0) ? dn : 0; }
  var sTr = 0, sP = 0, sM = 0, pdi = nanArr(n), mdi = nanArr(n), dx = nanArr(n), out = nanArr(n);
  for (var k = 1; k < n; k++){
    if (k <= p){ sTr += tr[k]; sP += pdm[k]; sM += mdm[k]; if (k < p) continue; }
    else { sTr = sTr - sTr / p + tr[k]; sP = sP - sP / p + pdm[k]; sM = sM - sM / p + mdm[k]; }
    pdi[k] = sTr ? 100 * sP / sTr : 0; mdi[k] = sTr ? 100 * sM / sTr : 0;
    var den = pdi[k] + mdi[k]; dx[k] = den ? 100 * Math.abs(pdi[k] - mdi[k]) / den : 0;
  }
  var s = 0, c = 0;
  for (var m = p; m < n; m++){ if (!isFinite(dx[m])) continue; if (c < p){ s += dx[m]; c++; if (c === p) out[m] = s / p; continue; } out[m] = (out[m - 1] * (p - 1) + dx[m]) / p; }
  return { adx: out, pdi: pdi, mdi: mdi, dx: dx };
}
function stdev(v, p){ var m = sma(v, p), out = nanArr(v.length); for (var i = p - 1; i < v.length; i++){ var s = 0; for (var j = 0; j < p; j++){ var d = v[i - j] - m[i]; s += d * d; } out[i] = Math.sqrt(s / p); } return out; }
function macd(v, f, s, sig){ var ef = ema(v, f), es = ema(v, s), line = v.map(function(_, i){ return ef[i] - es[i]; }), tail = ema(line.slice(s - 1), sig), signal = nanArr(v.length); for (var i = 0; i < tail.length; i++) signal[s - 1 + i] = tail[i]; return { line: line, signal: signal, hist: line.map(function(x, i){ return x - signal[i]; }) }; }
function hhll(rows, p, i, hi){ var hh = -Infinity, ll = Infinity; for (var j = 0; j < p; j++){ hh = Math.max(hh, rows[i - j].h); ll = Math.min(ll, rows[i - j].l); } return hi ? hh : ll; }
function stochRaw(rows, p){ var out = nanArr(rows.length); for (var i = p - 1; i < rows.length; i++){ var hh = hhll(rows, p, i, true), ll = hhll(rows, p, i, false); out[i] = hh > ll ? 100 * (rows[i].c - ll) / (hh - ll) : 50; } return out; }
function stochKD(rows, p, k, d){ var raw = stochRaw(rows, p), K = k > 1 ? sma(fill0(raw), k) : raw, D = sma(fill0(K), d); return { k: K.map(function(x, i){ return i < p + k - 2 ? NaN : x; }), d: D.map(function(x, i){ return i < p + k + d - 3 ? NaN : x; }) }; }
function stochRsi(v, p){ var r = rsi(v, p), out = nanArr(v.length); for (var i = 2 * p; i < v.length; i++){ var hh = -Infinity, ll = Infinity; for (var j = 0; j < p; j++){ hh = Math.max(hh, r[i - j]); ll = Math.min(ll, r[i - j]); } out[i] = hh > ll ? 100 * (r[i] - ll) / (hh - ll) : 50; } return out; }
function cci(rows, p){ var tp = rows.map(function(r){ return (r.h + r.l + r.c) / 3; }), m = sma(tp, p), out = nanArr(rows.length); for (var i = p - 1; i < rows.length; i++){ var md = 0; for (var j = 0; j < p; j++) md += Math.abs(tp[i - j] - m[i]); md /= p; out[i] = md ? (tp[i] - m[i]) / (0.015 * md) : 0; } return out; }
function willr(rows, p){ var out = nanArr(rows.length); for (var i = p - 1; i < rows.length; i++){ var hh = hhll(rows, p, i, true), ll = hhll(rows, p, i, false); out[i] = hh > ll ? -100 * (hh - rows[i].c) / (hh - ll) : -50; } return out; }
function mfi(rows, p){ var tp = rows.map(function(r){ return (r.h + r.l + r.c) / 3; }), out = nanArr(rows.length); for (var i = p; i < rows.length; i++){ var pos = 0, neg = 0; for (var j = 0; j < p; j++){ var k = i - j, f = tp[k] * rows[k].v; if (tp[k] > tp[k - 1]) pos += f; else if (tp[k] < tp[k - 1]) neg += f; } out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg); } return out; }
function tsi(v, r, s){ var m = v.map(function(x, i){ return i ? x - v[i - 1] : 0; }), a = ema(fill0(ema(m, r)), s), b = ema(fill0(ema(m.map(Math.abs), r)), s); return v.map(function(_, i){ return i < r + s ? NaN : (b[i] ? 100 * a[i] / b[i] : 0); }); }
function median(rows){ return rows.map(function(r){ return (r.h + r.l) / 2; }); }
function supertrend(rows, p, mult){
  var A = atr(rows, p), n = rows.length, up = nanArr(n), dn = nanArr(n), tr = nanArr(n);
  for (var i = 1; i < n; i++){
    if (!isFinite(A[i])) continue;
    var m = (rows[i].h + rows[i].l) / 2, bu = m + mult * A[i], bl = m - mult * A[i];
    var pu = isFinite(up[i - 1]) ? up[i - 1] : bu, pl = isFinite(dn[i - 1]) ? dn[i - 1] : bl;
    up[i] = (bu < pu || rows[i - 1].c > pu) ? bu : pu; dn[i] = (bl > pl || rows[i - 1].c < pl) ? bl : pl;
    var prev = isFinite(tr[i - 1]) ? tr[i - 1] : 1;
    tr[i] = prev === 1 ? (rows[i].c < dn[i] ? -1 : 1) : (rows[i].c > up[i] ? 1 : -1);
  }
  return tr;
}
function psar(rows, step, max){
  var n = rows.length, out = nanArr(n), trend = nanArr(n);
  if (n < 3) return { sar: out, trend: trend };
  var up = rows[1].c >= rows[0].c, af = step, ep = up ? rows[0].h : rows[0].l, sar = up ? rows[0].l : rows[0].h;
  for (var i = 1; i < n; i++){
    sar = sar + af * (ep - sar);
    if (up){ sar = Math.min(sar, rows[i - 1].l, i > 1 ? rows[i - 2].l : rows[i - 1].l); if (rows[i].l < sar){ up = false; sar = ep; ep = rows[i].l; af = step; } else if (rows[i].h > ep){ ep = rows[i].h; af = Math.min(max, af + step); } }
    else { sar = Math.max(sar, rows[i - 1].h, i > 1 ? rows[i - 2].h : rows[i - 1].h); if (rows[i].h > sar){ up = true; sar = ep; ep = rows[i].h; af = step; } else if (rows[i].l < ep){ ep = rows[i].l; af = Math.min(max, af + step); } }
    out[i] = sar; trend[i] = up ? 1 : -1;
  }
  return { sar: out, trend: trend };
}
function midHL(rows, p, i){ return (hhll(rows, p, i, true) + hhll(rows, p, i, false)) / 2; }
function ichimoku(rows){ var n = rows.length, i = n - 1; if (n < 52 + 26) return null; var j = i - 26, sa = (midHL(rows, 9, j) + midHL(rows, 26, j)) / 2, sb = midHL(rows, 52, j); return { tenkan: midHL(rows, 9, i), kijun: midHL(rows, 26, i), cloudTop: Math.max(sa, sb), cloudBot: Math.min(sa, sb), chikouRef: rows[j].c }; }
function obv(rows){ var out = nanArr(rows.length), s = 0; for (var i = 0; i < rows.length; i++){ if (i){ if (rows[i].c > rows[i - 1].c) s += rows[i].v; else if (rows[i].c < rows[i - 1].c) s -= rows[i].v; } out[i] = s; } return out; }
function adl(rows){ var out = nanArr(rows.length), s = 0; for (var i = 0; i < rows.length; i++){ var r = rows[i], rng = r.h - r.l; s += rng ? ((r.c - r.l) - (r.h - r.c)) / rng * r.v : 0; out[i] = s; } return out; }
function cmf(rows, p){ var out = nanArr(rows.length); for (var i = p - 1; i < rows.length; i++){ var mfv = 0, vol = 0; for (var j = 0; j < p; j++){ var r = rows[i - j], rng = r.h - r.l; mfv += rng ? ((r.c - r.l) - (r.h - r.c)) / rng * r.v : 0; vol += r.v; } out[i] = vol ? mfv / vol : 0; } return out; }
function sessionVwap(rows){ var i = rows.length - 1, day = Math.floor(rows[i].t / 86400), pv = 0, vv = 0; for (var k = i; k >= 0 && Math.floor(rows[k].t / 86400) === day; k--){ var tp = (rows[k].h + rows[k].l + rows[k].c) / 3; pv += tp * rows[k].v; vv += rows[k].v; } return vv > 0 ? pv / vv : NaN; }
function priorDay(rows){ /* prior completed UTC day OHLC */
  var i = rows.length - 1, day = Math.floor(rows[i].t / 86400), k = i;
  while (k >= 0 && Math.floor(rows[k].t / 86400) === day) k--;
  if (k < 0) return null;
  var prev = Math.floor(rows[k].t / 86400), h = -Infinity, l = Infinity, c = rows[k].c, o = NaN;
  for (; k >= 0 && Math.floor(rows[k].t / 86400) === prev; k--){ h = Math.max(h, rows[k].h); l = Math.min(l, rows[k].l); o = rows[k].o; }
  return isFinite(h) ? { h: h, l: l, c: c, o: o } : null;
}
function dayRanges(rows){ var out = [], cur = null; for (var i = 0; i < rows.length; i++){ var d = Math.floor(rows[i].t / 86400); if (!cur || cur.d !== d){ if (cur) out.push(cur); cur = { d: d, h: rows[i].h, l: rows[i].l }; } else { cur.h = Math.max(cur.h, rows[i].h); cur.l = Math.min(cur.l, rows[i].l); } } if (cur) out.push(cur); return out; }
function fractals(rows, win){ var hi = [], lo = []; for (var i = win; i < rows.length - win; i++){ var isH = true, isL = true; for (var j = 1; j <= win; j++){ if (rows[i].h <= rows[i - j].h || rows[i].h <= rows[i + j].h) isH = false; if (rows[i].l >= rows[i - j].l || rows[i].l >= rows[i + j].l) isL = false; } if (isH) hi.push({ i: i, v: rows[i].h }); if (isL) lo.push({ i: i, v: rows[i].l }); } return { hi: hi, lo: lo }; }
function zigzag(rows, dev){ /* last CONFIRMED leg direction: a reversal of >= dev from the running extreme */
  var dir = 0, ext = rows[0].c, extI = 0, legs = 0;
  for (var i = 1; i < rows.length; i++){
    var c = rows[i].c;
    if (dir >= 0 && c > ext){ ext = c; extI = i; if (!dir) dir = 1; }
    else if (dir <= 0 && c < ext){ ext = c; extI = i; if (!dir) dir = -1; }
    if (dir === 1 && ext - c >= dev){ dir = -1; ext = c; extI = i; legs++; }
    else if (dir === -1 && c - ext >= dev){ dir = 1; ext = c; extI = i; legs++; }
  }
  return { dir: legs ? dir : 0, since: rows.length - 1 - extI };
}
function freshFvg(rows, look){
  var i = rows.length - 1, px = rows[i].c;
  for (var k = i - 1; k >= Math.max(2, i - look); k--){
    var a = rows[k - 2], c = rows[k];
    if (a.h < c.l){ var f = false; for (var m = k + 1; m <= i; m++) if (rows[m].l <= a.h){ f = true; break; } if (!f && px >= a.h && px <= c.l) return { dir: 1, lo: a.h, hi: c.l, age: i - k }; }
    if (a.l > c.h){ var f2 = false; for (var m2 = k + 1; m2 <= i; m2++) if (rows[m2].h >= a.l){ f2 = true; break; } if (!f2 && px <= a.l && px >= c.h) return { dir: -1, lo: c.h, hi: a.l, age: i - k }; }
  }
  return null;
}
function cusum(v, k){
  var n = v.length, ret = v.map(function(x, i){ return i ? (x - v[i - 1]) / v[i - 1] : 0; }), sd = stdev(ret, 50), pos = 0, neg = 0, lastDir = 0, lastAt = -1;
  for (var i = 50; i < n; i++){ var s = sd[i] || 1e-9; pos = Math.max(0, pos + ret[i] - 0.5 * s); neg = Math.min(0, neg + ret[i] + 0.5 * s); if (pos > k * s){ lastDir = 1; lastAt = i; pos = 0; neg = 0; } if (neg < -k * s){ lastDir = -1; lastAt = i; pos = 0; neg = 0; } }
  return (lastAt >= n - 20) ? { dir: lastDir, barsAgo: n - 1 - lastAt } : null;
}
function fisher(rows, p){
  var n = rows.length, x = 0, f = 0, out = nanArr(n), md = median(rows);
  for (var i = p - 1; i < n; i++){
    var hh = -Infinity, ll = Infinity; for (var j = 0; j < p; j++){ hh = Math.max(hh, md[i - j]); ll = Math.min(ll, md[i - j]); }
    var r = hh > ll ? (md[i] - ll) / (hh - ll) : 0.5;
    x = 0.33 * 2 * (r - 0.5) + 0.67 * x; x = Math.max(-0.999, Math.min(0.999, x));
    f = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * f; out[i] = f;
  }
  return out;
}
function hilbert(v){
  /* Ehlers' Hilbert Transform cycle measurement (the TA-Lib HT_* family + MAMA/FAMA) */
  var n = v.length, sm = nanArr(n), det = nanArr(n), I1 = nanArr(n), Q1 = nanArr(n), I2 = nanArr(n), Q2 = nanArr(n), Re = nanArr(n), Im = nanArr(n);
  var per = nanArr(n), sper = nanArr(n), phase = nanArr(n), mama = nanArr(n), fama = nanArr(n), dcph = nanArr(n), sine = nanArr(n), lead = nanArr(n), mode = nanArr(n);
  var g = function(a, i){ return isFinite(a[i]) ? a[i] : 0; };
  for (var i = 0; i < n; i++){
    if (i < 6){ sm[i] = v[i]; per[i] = 6; sper[i] = 6; phase[i] = 0; mama[i] = v[i]; fama[i] = v[i]; I1[i] = Q1[i] = I2[i] = Q2[i] = Re[i] = Im[i] = det[i] = 0; continue; }
    sm[i] = (4 * v[i] + 3 * v[i - 1] + 2 * v[i - 2] + v[i - 3]) / 10;
    var k = 0.075 * per[i - 1] + 0.54;
    det[i] = (0.0962 * sm[i] + 0.5769 * g(sm, i - 2) - 0.5769 * g(sm, i - 4) - 0.0962 * g(sm, i - 6)) * k;
    Q1[i] = (0.0962 * det[i] + 0.5769 * g(det, i - 2) - 0.5769 * g(det, i - 4) - 0.0962 * g(det, i - 6)) * k;
    I1[i] = g(det, i - 3);
    var jI = (0.0962 * I1[i] + 0.5769 * g(I1, i - 2) - 0.5769 * g(I1, i - 4) - 0.0962 * g(I1, i - 6)) * k;
    var jQ = (0.0962 * Q1[i] + 0.5769 * g(Q1, i - 2) - 0.5769 * g(Q1, i - 4) - 0.0962 * g(Q1, i - 6)) * k;
    I2[i] = 0.2 * (I1[i] - jQ) + 0.8 * g(I2, i - 1); Q2[i] = 0.2 * (Q1[i] + jI) + 0.8 * g(Q2, i - 1);
    Re[i] = 0.2 * (I2[i] * g(I2, i - 1) + Q2[i] * g(Q2, i - 1)) + 0.8 * g(Re, i - 1);
    Im[i] = 0.2 * (I2[i] * g(Q2, i - 1) - Q2[i] * g(I2, i - 1)) + 0.8 * g(Im, i - 1);
    var p = per[i - 1];
    if (Im[i] !== 0 && Re[i] !== 0) p = 2 * Math.PI / Math.atan(Im[i] / Re[i]);
    if (!isFinite(p) || p <= 0) p = per[i - 1];
    p = Math.min(p, 1.5 * per[i - 1]); p = Math.max(p, 0.67 * per[i - 1]); p = Math.max(6, Math.min(50, p));
    per[i] = 0.2 * p + 0.8 * per[i - 1]; sper[i] = 0.33 * per[i] + 0.67 * sper[i - 1];
    /* MAMA / FAMA */
    var ph = I1[i] !== 0 ? Math.atan(Q1[i] / I1[i]) * 180 / Math.PI : 0, dph = phase[i - 1] - ph; if (dph < 1) dph = 1;
    var alpha = 0.5 / dph; alpha = Math.max(0.05, Math.min(0.5, alpha)); phase[i] = ph;
    mama[i] = alpha * v[i] + (1 - alpha) * mama[i - 1]; fama[i] = 0.5 * alpha * mama[i] + (1 - 0.5 * alpha) * fama[i - 1];
    /* DC phase + sinewave */
    var L = Math.floor(sper[i]), rp = 0, ip = 0;
    if (L > 0 && i - L >= 0){ for (var q = 0; q < L; q++){ rp += Math.sin(2 * Math.PI * q / L) * sm[i - q]; ip += Math.cos(2 * Math.PI * q / L) * sm[i - q]; } }
    var dp = Math.abs(ip) > 0.001 ? Math.atan(rp / ip) * 180 / Math.PI : 90 * (rp >= 0 ? 1 : -1);
    if (ip < 0) dp += 180; dp += 90; if (dp < 0) dp += 360; if (dp > 315) dp -= 360;
    dcph[i] = dp; sine[i] = Math.sin(dp * Math.PI / 180); lead[i] = Math.sin((dp + 45) * Math.PI / 180);
    /* trend vs cycle mode */
    var dd = dcph[i] - (isFinite(dcph[i - 1]) ? dcph[i - 1] : dcph[i]), tl = 0, cnt = 0;
    for (var z = 0; z < L && i - z >= 0; z++){ tl += v[i - z]; cnt++; }
    tl = cnt ? tl / cnt : v[i];
    var trend = 0;
    if (dd < 0.67 * 360 / sper[i] || dd > 1.5 * 360 / sper[i]) trend = 1;
    if (Math.abs(v[i] - tl) / tl >= 0.015) trend = 1;
    if (Math.abs(sine[i] - lead[i]) < 0.15 && i > 0 && isFinite(sine[i - 1]) && Math.abs(sine[i - 1] - lead[i - 1]) < 0.15) trend = 1;
    mode[i] = trend;
  }
  return { period: per, speriod: sper, dcphase: dcph, sine: sine, lead: lead, mode: mode, mama: mama, fama: fama, I1: I1, Q1: Q1 };
}

/* =========================== the reads =========================== */
function R(id, group, name, kind, vote, read, why){ return { id: id, group: group, name: name, kind: kind, vote: kind === 'vote' ? vote : 0, read: read, why: why, regime: kind === 'regime' ? vote : undefined }; }
function countRegime(list, side){ var c = 0; for (var k = 0; k < list.length; k++) if (list[k].kind === 'regime' && ['chop', 'adx', 'vhf', 'ht_mode'].indexOf(list[k].id) >= 0 && list[k].regime === side) c++; return c; }
function regimeSummaryVote(list){ var ch = countRegime(list, -1), tr = countRegime(list, 1); return ch >= 3 ? -1 : (tr >= 2 && ch === 0) ? 1 : 0; }
function slopeVote(arr, k, tol){ var a = last(arr), b = at(arr, k); if (!isFinite(a) || !isFinite(b) || !b) return 0; var d = (a - b) / Math.abs(b); return d > tol ? 1 : d < -tol ? -1 : 0; }
function band(x, hi, lo){ return isFinite(x) ? (x > hi ? 1 : x < lo ? -1 : 0) : 0; }

function goldUltraVotes(rows, rows1h){
  var out = [], n = rows.length, i = n - 1, px = rows[i].c, C = closes(rows), MD = median(rows), VOL = rows.map(function(r){ return r.v; });
  var e9 = ema(C, 9), e13 = ema(C, 13), e20 = ema(C, 20), e21 = ema(C, 21), e50 = ema(C, 50), e200 = ema(C, 200), S20 = sma(C, 20), S50 = sma(C, 50);
  var A14 = atr(rows, 14), a14 = last(A14), TR = trSeries(rows), D = adx(rows, 14), adxv = last(D.adx);
  var push = function(r){ out.push(r); };

  /* ---------------- MOVING AVERAGES / OVERLAP ---------------- */
  var G = 'MOVING AVERAGES';
  var ka = last(kama(C, 10, 2, 30));
  push(R('kama', G, 'KAMA 10,2,30 (= AMA)', 'vote', vs(px, ka), fmt(ka), 'close above the adaptive MA = long'));
  push(R('ama', G, 'Adaptive MA (AMA)', 'print', 0, 'same as KAMA', 'identical information to KAMA — counted once, above'));
  var al = last(alma(C, 9, 0.85, 6));
  push(R('alma', G, 'ALMA 9 (0.85, 6)', 'vote', vs(px, al), fmt(al), 'close above ALMA = long'));
  var bbs = last(stdev(C, 20)), bbm = last(S20), bbu = bbm + 2 * bbs, bbl = bbm - 2 * bbs;
  push(R('bb', G, 'Bollinger 20,2 position', 'vote', vs(px, bbm), fmt(bbl) + ' · ' + fmt(bbm) + ' · ' + fmt(bbu), 'above the basis = long'));
  push(R('dma', G, 'Displaced MA (SMA 20, +3)', 'vote', vs(px, at(S20, 3)), fmt(at(S20, 3)), 'close above the SMA drawn 3 bars back = long'));
  var dh = -Infinity, dl = Infinity; for (var q = 1; q <= 20 && i - q >= 0; q++){ dh = Math.max(dh, rows[i - q].h); dl = Math.min(dl, rows[i - q].l); }
  push(R('donchian', G, 'Donchian 20 break', 'vote', px > dh ? 1 : px < dl ? -1 : 0, fmt(dl) + ' – ' + fmt(dh), 'close beyond the prior 20-bar range'));
  var de = last(dema(C, 20));
  push(R('dema', G, 'DEMA 20', 'vote', vs(px, de), fmt(de), 'close above DEMA = long'));
  push(R('env', G, 'Envelopes SMA 20 ±1%', 'vote', px > bbm * 1.01 ? 1 : px < bbm * 0.99 ? -1 : 0, fmt(bbm * 0.99) + ' – ' + fmt(bbm * 1.01), 'close outside the envelope, on that side'));
  push(R('ema9_21', G, 'EMA 9 vs EMA 21', 'vote', vs(last(e9), last(e21)), fmt(last(e9)) + ' / ' + fmt(last(e21)), 'fast above slow = long'));
  push(R('ema21_50', G, 'EMA 21 vs EMA 50', 'vote', vs(last(e21), last(e50)), fmt(last(e21)) + ' / ' + fmt(last(e50)), 'mid above slow = long'));
  push(R('px_ema200', G, 'price vs EMA 200', 'vote', vs(px, last(e200)), fmt(last(e200)), 'close above 200 = long'));
  var casc = (last(e9) > last(e21) && last(e21) > last(e50) && last(e50) > last(e200)) ? 1 : (last(e9) < last(e21) && last(e21) < last(e50) && last(e50) < last(e200)) ? -1 : 0;
  push(R('cascade', G, 'EMA cascade 9>21>50>200', 'vote', casc, casc ? 'stacked' : 'mixed', 'fully stacked one way, else neutral'));
  var fr = fractals(rows.slice(0, n - 1), 2), fH = fr.hi.length ? fr.hi[fr.hi.length - 1].v : NaN, fL = fr.lo.length ? fr.lo[fr.lo.length - 1].v : NaN;
  push(R('fcb', G, 'Fractal Chaos Bands', 'vote', (isFinite(fH) && px > fH) ? 1 : (isFinite(fL) && px < fL) ? -1 : 0, fmt(fL) + ' – ' + fmt(fH), 'close outside the last fractal band'));
  var gS = 0, gL = 0, pS = [3, 5, 8, 10, 12, 15], pL = [30, 35, 40, 45, 50, 60];
  for (var gi = 0; gi < 6; gi++){ gS += last(ema(C, pS[gi])); gL += last(ema(C, pL[gi])); }
  push(R('gmma', G, 'GMMA (short group vs long group)', 'vote', vs(gS, gL), fmt(gS / 6) + ' / ' + fmt(gL / 6), 'traders’ group above investors’ group = long'));
  var H = hma(C, 20);
  push(R('hma', G, 'HMA 20 slope (3 bars)', 'vote', slopeVote(H, 3, 0.0002), fmt(last(H)), 'Hull turning up = long'));
  var ich = ichimoku(rows);
  push(R('cloud', G, 'Ichimoku cloud', 'vote', ich ? (px > ich.cloudTop ? 1 : px < ich.cloudBot ? -1 : 0) : 0, ich ? fmt(ich.cloudBot) + '–' + fmt(ich.cloudTop) : '—', 'above the cloud = long, inside = neutral'));
  push(R('tk', G, 'Ichimoku Tenkan vs Kijun', 'vote', ich ? vs(ich.tenkan, ich.kijun) : 0, ich ? fmt(ich.tenkan) + ' / ' + fmt(ich.kijun) : '—', 'conversion above base = long'));
  push(R('chikou', G, 'Ichimoku Chikou', 'vote', ich ? vs(px, ich.chikouRef) : 0, ich ? fmt(ich.chikouRef) : '—', 'close above the close 26 bars ago = long'));
  var kem = last(e20);
  push(R('kc', G, 'Keltner 20,1.5 position', 'vote', vs(px, kem), fmt(kem - 1.5 * a14) + ' · ' + fmt(kem) + ' · ' + fmt(kem + 1.5 * a14), 'above the EMA basis = long'));
  var LR25 = linreg(C, 25);
  push(R('lsma', G, 'LSMA 25', 'vote', vs(px, last(LR25.end)), fmt(last(LR25.end)), 'close above the regression endpoint = long'));
  var HT = hilbert(C);
  push(R('mama', G, 'MESA MAMA vs FAMA', 'vote', vs(last(HT.mama), last(HT.fama)), fmt(last(HT.mama)) + ' / ' + fmt(last(HT.fama)), 'MAMA above FAMA = long'));
  var mg = last(mcginley(C, 14));
  push(R('mcginley', G, 'McGinley Dynamic 14', 'vote', vs(px, mg), fmt(mg), 'close above = long'));
  var chop = (function(){ var s = 0, hh = -Infinity, ll = Infinity; for (var j = 0; j < 14; j++){ s += TR[i - j]; hh = Math.max(hh, rows[i - j].h); ll = Math.min(ll, rows[i - j].l); } return hh > ll ? 100 * Math.log10(s / (hh - ll)) / Math.log10(14) : 50; })();
  var mavpP = Math.round(5 + 25 * Math.max(0, Math.min(1, (chop - 30) / 50))), mv = last(sma(C, mavpP));
  push(R('mavp', G, 'MA variable period (' + mavpP + ' from choppiness)', 'vote', vs(px, mv), fmt(mv), 'period stretches with chop; close above = long'));
  var ps = psar(rows, 0.02, 0.2);
  push(R('psar', G, 'Parabolic SAR', 'vote', isFinite(last(ps.trend)) ? last(ps.trend) : 0, fmt(last(ps.sar)), 'dots below price = long'));
  var pd = priorDay(rows);
  if (pd){
    var P = (pd.h + pd.l + pd.c) / 3, rngD = pd.h - pd.l;
    push(R('piv_std', G, 'Pivot — standard P', 'vote', vs(px, P), fmt(P), 'above yesterday’s pivot = long'));
    push(R('piv_fib', G, 'Pivot — Fibonacci R1/S1', 'vote', px > P + 0.382 * rngD ? 1 : px < P - 0.382 * rngD ? -1 : 0, fmt(P - 0.382 * rngD) + ' – ' + fmt(P + 0.382 * rngD), 'outside the fib S1–R1 band, on that side'));
    push(R('piv_cam', G, 'Pivot — Camarilla H3/L3', 'vote', px > pd.c + rngD * 1.1 / 4 ? 1 : px < pd.c - rngD * 1.1 / 4 ? -1 : 0, fmt(pd.c - rngD * 1.1 / 4) + ' – ' + fmt(pd.c + rngD * 1.1 / 4), 'beyond H3 / L3 (breakout side)'));
    var Pw = (pd.h + pd.l + 2 * pd.c) / 4;
    push(R('piv_woo', G, 'Pivot — Woodie P', 'vote', vs(px, Pw), fmt(Pw), 'above Woodie’s pivot = long'));
    var X = pd.c < pd.o ? pd.h + 2 * pd.l + pd.c : pd.c > pd.o ? 2 * pd.h + pd.l + pd.c : pd.h + pd.l + 2 * pd.c, Pd = X / 4;
    push(R('piv_dem', G, 'Pivot — DeMark P', 'vote', vs(px, Pd), fmt(Pd), 'above DeMark’s pivot = long'));
  } else {
    push(R('piv_std', G, 'Pivots (5 flavours)', 'print', 0, '—', 'no completed prior day in the window'));
  }
  var pcH = hhll(rows, 20, i, true), pcL = hhll(rows, 20, i, false);
  push(R('pchan', G, 'Price channel 20 (mid)', 'vote', vs(px, (pcH + pcL) / 2), fmt(pcL) + ' – ' + fmt(pcH), 'upper half of the channel = long'));
  var sm14 = last(rma(C, 14));
  push(R('smma', G, 'SMMA / RMA 14', 'vote', vs(px, sm14), fmt(sm14), 'close above = long'));
  push(R('sma50', G, 'SMA 50', 'vote', vs(px, last(S50)), fmt(last(S50)), 'close above = long'));
  push(R('sma20_slope', G, 'SMA 20 slope (5 bars)', 'vote', slopeVote(S20, 5, 0.0003), fmt(last(S20)), 'rising > +0.03% = long'));
  var st = supertrend(rows, 10, 3);
  push(R('supertrend', G, 'SuperTrend 10,3', 'vote', isFinite(last(st)) ? last(st) : 0, last(st) === 1 ? 'up' : last(st) === -1 ? 'down' : '—', 'band side'));
  var te = last(tema(C, 20));
  push(R('tema', G, 'TEMA 20', 'vote', vs(px, te), fmt(te), 'close above = long'));
  var t3v = last(t3(C, 5, 0.7));
  push(R('t3', G, 'T3 5 (0.7)', 'vote', vs(px, t3v), fmt(t3v), 'close above = long'));
  var vw = sessionVwap(rows);
  push(R('vwap', G, 'session VWAP (UTC day)', 'vote', isFinite(vw) ? vs(px, vw) : 0, fmt(vw), 'close above session VWAP = long'));
  var VW = vwmaArr(rows, 20);
  push(R('vwma', G, 'VWMA 20 vs SMA 20', 'vote', vs(last(VW), last(S20)), fmt(last(VW)) + ' / ' + fmt(last(S20)), 'volume-weighted above plain = buyers carry it'));
  var w20 = last(wma(C, 20));
  push(R('wma', G, 'WMA 20', 'vote', vs(px, w20), fmt(w20), 'close above = long'));
  var zz = zigzag(rows, 2 * a14);
  push(R('zigzag', G, 'Zig Zag (2×ATR legs)', 'vote', zz.dir, zz.dir ? (zz.dir > 0 ? 'leg up' : 'leg down') + ' · ' + zz.since + ' bars' : '—', 'the confirmed current leg’s direction'));

  /* ---------------- MOMENTUM ---------------- */
  G = 'MOMENTUM';
  var e12 = ema(C, 12), e26 = ema(C, 26), apo = last(e12) - last(e26);
  push(R('apo', G, 'APO 12,26', 'vote', sgn(apo), fmt(apo, 3), 'positive = long'));
  var aoA = sma(MD, 5).map(function(x, k){ return x - sma(MD, 34)[k]; }), aov = last(aoA);
  push(R('ao', G, 'Awesome Oscillator', 'vote', (aov > 0 && aov >= at(aoA, 1)) ? 1 : (aov < 0 && aov <= at(aoA, 1)) ? -1 : 0, fmt(aov, 2), 'positive and rising = long'));
  var bop = last(sma(rows.map(function(r){ return r.h > r.l ? (r.c - r.o) / (r.h - r.l) : 0; }), 14));
  push(R('bop', G, 'Balance of Power (SMA 14)', 'vote', band(bop, 0.1, -0.1), fmt(bop, 3), 'beyond ±0.1'));
  var cogA = C.map(function(_, k){ if (k < 9) return NaN; var num = 0, den = 0; for (var j = 0; j < 10; j++){ num += (j + 1) * C[k - j]; den += C[k - j]; } return -num / den; });
  push(R('cog', G, 'Center of Gravity 10', 'vote', vs(last(cogA), at(cogA, 1)), fmt(last(cogA), 3), 'rising = long'));
  var cmoU = 0, cmoD = 0; for (var cj = 0; cj < 14; cj++){ var dd = C[i - cj] - C[i - cj - 1]; if (dd > 0) cmoU += dd; else cmoD -= dd; }
  var cmo = (cmoU + cmoD) ? 100 * (cmoU - cmoD) / (cmoU + cmoD) : 0;
  push(R('cmo', G, 'Chande Momentum 14', 'vote', band(cmo, 10, -10), fmt(cmo, 1), 'beyond ±10'));
  var cc = last(cci(rows, 20));
  push(R('cci', G, 'CCI 20', 'vote', band(cc, 50, -50), fmt(cc, 0), '>+50 long · <−50 short'));
  var rocA = function(p){ return C.map(function(x, k){ return k < p ? NaN : 100 * (x - C[k - p]) / C[k - p]; }); };
  var cop = last(wma(fill0(rocA(14).map(function(x, k){ return x + rocA(11)[k]; })), 10));
  push(R('coppock', G, 'Coppock Curve', 'vote', sgn(cop), fmt(cop, 3), 'positive = long'));
  var dpo = C[i - 11] - last(S20);
  push(R('dpo', G, 'DPO 20', 'vote', sgn(dpo), fmt(dpo, 2), 'positive = long'));
  push(R('dmi', G, 'DMI (+DI vs −DI, ADX>20)', 'vote', (isFinite(adxv) && adxv > 20) ? vs(last(D.pdi), last(D.mdi)) : 0, '+DI ' + fmt(last(D.pdi), 1) + ' / −DI ' + fmt(last(D.mdi), 1) + ' · DX ' + fmt(last(D.dx), 1), 'directional only when ADX > 20'));
  var bull = rows[i].h - last(e13), bear = rows[i].l - last(e13);
  push(R('elder', G, 'Elder-Ray (bull / bear power)', 'vote', (bull > 0 && bear > 0) ? 1 : (bull < 0 && bear < 0) ? -1 : 0, fmt(bull, 2) + ' / ' + fmt(bear, 2), 'both above the EMA 13 = long, both below = short'));
  var fi = fisher(rows, 9);
  push(R('fisher', G, 'Fisher Transform 9', 'vote', (last(fi) > at(fi, 1) && last(fi) > 0) ? 1 : (last(fi) < at(fi, 1) && last(fi) < 0) ? -1 : 0, fmt(last(fi), 2), 'rising above 0 = long'));
  var LR14 = linreg(C, 14), fo = 100 * (px - at(LR14.end, 1)) / px;
  push(R('fosc', G, 'Forecast Oscillator 14', 'vote', band(fo, 0.02, -0.02), fmt(fo, 3) + '%', 'close above the prior forecast = long'));
  var jaw = at(rma(MD, 13), 8), teeth = at(rma(MD, 8), 5), lips = at(rma(MD, 5), 3);
  push(R('gator', G, 'Gator / Alligator', 'vote', (lips > teeth && teeth > jaw) ? 1 : (lips < teeth && teeth < jaw) ? -1 : 0, fmt(lips) + ' / ' + fmt(teeth) + ' / ' + fmt(jaw), 'lips > teeth > jaw = long (mouth open)'));
  var imU = 0, imD = 0; for (var ij = 0; ij < 14; ij++){ var rr = rows[i - ij]; if (rr.c > rr.o) imU += rr.c - rr.o; else imD += rr.o - rr.c; }
  var imi = (imU + imD) ? 100 * imU / (imU + imD) : 50;
  push(R('imi', G, 'Intraday Momentum Index 14', 'vote', band(imi, 55, 45), fmt(imi, 1), '>55 long · <45 short'));
  var kst = C.map(function(_, k){ return NaN; });
  (function(){ var r1 = sma(fill0(rocA(10)), 10), r2 = sma(fill0(rocA(15)), 10), r3 = sma(fill0(rocA(20)), 10), r4 = sma(fill0(rocA(30)), 15); for (var k = 45; k < n; k++) kst[k] = r1[k] + 2 * r2[k] + 3 * r3[k] + 4 * r4[k]; })();
  var kstSig = sma(fill0(kst), 9);
  push(R('kst', G, 'Know Sure Thing', 'vote', (last(kst) > last(kstSig)) ? 1 : (last(kst) < last(kstSig)) ? -1 : 0, fmt(last(kst), 2) + ' / ' + fmt(last(kstSig), 2), 'KST above its signal = long'));
  var M = macd(C, 12, 26, 9);
  push(R('macd_line', G, 'MACD line vs signal', 'vote', vs(last(M.line), last(M.signal)), fmt(last(M.line), 3) + ' / ' + fmt(last(M.signal), 3), 'line above signal = long'));
  push(R('macd_hist', G, 'MACD histogram', 'vote', (last(M.hist) > 0 && last(M.hist) >= at(M.hist, 1)) ? 1 : (last(M.hist) < 0 && last(M.hist) <= at(M.hist, 1)) ? -1 : 0, fmt(last(M.hist), 3), 'positive and not shrinking = long'));
  var mom = px - C[i - 10];
  push(R('mom', G, 'Momentum 10', 'vote', sgn(mom), fmt(mom, 2), 'positive = long'));
  var ppo = 100 * (last(e12) - last(e26)) / last(e26);
  push(R('ppo', G, 'PPO 12,26', 'vote', band(ppo, 0.02, -0.02), fmt(ppo, 3) + '%', 'beyond ±0.02%'));
  var qq = (function(){ var r = rsi(C, 14), rm = ema(fill0(r), 5), dr = rm.map(function(x, k){ return k ? Math.abs(x - rm[k - 1]) : 0; }), da = ema(fill0(ema(fill0(dr), 27)), 27).map(function(x){ return x * 4.236; }), tr = nanArr(n); for (var k = 1; k < n; k++){ var up = rm[k] - da[k], dn = rm[k] + da[k], p = isFinite(tr[k - 1]) ? tr[k - 1] : rm[k]; tr[k] = rm[k] > p ? Math.max(up, p > rm[k - 1] ? p : up) : Math.min(dn, p < rm[k - 1] ? p : dn); if (rm[k - 1] < p && rm[k] > p) tr[k] = up; if (rm[k - 1] > p && rm[k] < p) tr[k] = dn; } return { rm: last(rm), tr: last(tr) }; })();
  push(R('qqe', G, 'QQE (RSI 14 · 5)', 'vote', vs(qq.rm, qq.tr), fmt(qq.rm, 1) + ' / ' + fmt(qq.tr, 1), 'smoothed RSI above its trailing line = long'));
  var rc = 100 * (px - C[i - 10]) / C[i - 10];
  push(R('roc', G, 'ROC 10', 'vote', band(rc, 0.05, -0.05), fmt(rc, 2) + '%', 'beyond ±0.05%'));
  var rmiV = last(rmi(C, 14, 3));
  push(R('rmi', G, 'Relative Momentum Index 14,3', 'vote', band(rmiV, 55, 45), fmt(rmiV, 1), '>55 long · <45 short'));
  var r14 = last(rsi(C, 14));
  push(R('rsi', G, 'RSI 14', 'vote', band(r14, 55, 45), fmt(r14, 1), '>55 long · <45 short'));
  var rvi = (function(){ var nu = rows.map(function(r, k){ if (k < 3) return 0; var f = function(j){ return rows[k - j].c - rows[k - j].o; }; return (f(0) + 2 * f(1) + 2 * f(2) + f(3)) / 6; }), de2 = rows.map(function(r, k){ if (k < 3) return 0; var f = function(j){ return rows[k - j].h - rows[k - j].l; }; return (f(0) + 2 * f(1) + 2 * f(2) + f(3)) / 6; }), a = sma(nu, 10), b = sma(de2, 10), v = a.map(function(x, k){ return b[k] ? x / b[k] : 0; }), s = v.map(function(x, k){ return k < 3 ? NaN : (v[k] + 2 * v[k - 1] + 2 * v[k - 2] + v[k - 3]) / 6; }); return { v: last(v), s: last(s) }; })();
  push(R('rvi', G, 'Relative Vigor Index 10', 'vote', vs(rvi.v, rvi.s), fmt(rvi.v, 3) + ' / ' + fmt(rvi.s, 3), 'RVI above its signal = long'));
  var stc = (function(){ var m = macd(C, 23, 50, 9).line, st1 = nanArr(n), pf = nanArr(n), st2 = nanArr(n), o = nanArr(n); for (var k = 60; k < n; k++){ var hh = -Infinity, ll = Infinity; for (var j = 0; j < 10; j++){ hh = Math.max(hh, m[k - j]); ll = Math.min(ll, m[k - j]); } st1[k] = hh > ll ? 100 * (m[k] - ll) / (hh - ll) : (isFinite(st1[k - 1]) ? st1[k - 1] : 50); pf[k] = isFinite(pf[k - 1]) ? pf[k - 1] + 0.5 * (st1[k] - pf[k - 1]) : st1[k]; } for (var k2 = 70; k2 < n; k2++){ var h2 = -Infinity, l2 = Infinity; for (var j2 = 0; j2 < 10; j2++){ h2 = Math.max(h2, pf[k2 - j2]); l2 = Math.min(l2, pf[k2 - j2]); } st2[k2] = h2 > l2 ? 100 * (pf[k2] - l2) / (h2 - l2) : (isFinite(st2[k2 - 1]) ? st2[k2 - 1] : 50); o[k2] = isFinite(o[k2 - 1]) ? o[k2 - 1] + 0.5 * (st2[k2] - o[k2 - 1]) : st2[k2]; } return o; })();
  push(R('stc', G, 'Schaff Trend Cycle 23,50,10', 'vote', (last(stc) > 50 && last(stc) >= at(stc, 1)) ? 1 : (last(stc) < 50 && last(stc) <= at(stc, 1)) ? -1 : 0, fmt(last(stc), 1), 'above 50 and rising = long'));
  var smi = (function(){ var rel = rows.map(function(r, k){ return k < 12 ? 0 : r.c - midHL(rows, 13, k); }), rg = rows.map(function(r, k){ return k < 12 ? 0 : hhll(rows, 13, k, true) - hhll(rows, 13, k, false); }), a = ema(fill0(ema(rel, 25)), 2), b = ema(fill0(ema(rg, 25)), 2), v = a.map(function(x, k){ return b[k] ? 100 * x / (0.5 * b[k]) : 0; }); return v; })();
  push(R('smi', G, 'Stochastic Momentum Index 13,25,2', 'vote', band(last(smi), 10, -10), fmt(last(smi), 1), 'beyond ±10'));
  var sF = stochKD(rows, 14, 1, 3), sS = stochKD(rows, 14, 3, 3), sU = stochKD(rows, 14, 5, 5);
  var stV = function(s){ var k = last(s.k), d = last(s.d); return (k > d && k > 50) ? 1 : (k < d && k < 50) ? -1 : 0; };
  push(R('stoch_fast', G, 'Stochastic fast 14,3', 'vote', stV(sF), fmt(last(sF.k), 1) + ' / ' + fmt(last(sF.d), 1), '%K over %D on its own side of 50'));
  push(R('stoch_slow', G, 'Stochastic slow 14,3,3', 'vote', stV(sS), fmt(last(sS.k), 1) + ' / ' + fmt(last(sS.d), 1), '%K over %D on its own side of 50'));
  push(R('stoch_full', G, 'Stochastic full 14,5,5', 'vote', stV(sU), fmt(last(sU.k), 1) + ' / ' + fmt(last(sU.d), 1), '%K over %D on its own side of 50'));
  var srs = last(stochRsi(C, 14));
  push(R('stochrsi', G, 'StochRSI 14', 'vote', band(srs, 60, 40), fmt(srs, 1), '>60 long · <40 short'));
  var trx = (function(){ var e3 = ema(fill0(ema(fill0(ema(C, 15)), 15)), 15); return e3.map(function(x, k){ return k < 46 ? NaN : 100 * (x - e3[k - 1]) / e3[k - 1]; }); })();
  push(R('trix', G, 'TRIX 15', 'vote', (last(trx) > 0 && last(trx) >= at(trx, 1)) ? 1 : (last(trx) < 0 && last(trx) <= at(trx, 1)) ? -1 : 0, fmt(last(trx), 4), 'positive and rising = long'));
  var ts = last(tsi(C, 25, 13));
  push(R('tsi', G, 'TSI 25/13', 'vote', band(ts, 5, -5), fmt(ts, 1), 'beyond ±5'));
  var uo = (function(){ var bp = rows.map(function(r, k){ return k ? r.c - Math.min(r.l, rows[k - 1].c) : 0; }), tr2 = rows.map(function(r, k){ return k ? Math.max(r.h, rows[k - 1].c) - Math.min(r.l, rows[k - 1].c) : r.h - r.l; }), s = function(p){ var a = 0, b = 0; for (var j = 0; j < p; j++){ a += bp[i - j]; b += tr2[i - j]; } return b ? a / b : 0; }; return 100 * (4 * s(7) + 2 * s(14) + s(28)) / 7; })();
  push(R('uo', G, 'Ultimate Oscillator 7,14,28', 'vote', band(uo, 55, 45), fmt(uo, 1), '>55 long · <45 short'));
  var wr = last(willr(rows, 14));
  push(R('willr', G, 'Williams %R 14', 'vote', band(wr, -40, -60), fmt(wr, 0), '>−40 long · <−60 short'));

  /* ---------------- VOLATILITY ---------------- */
  G = 'VOLATILITY';
  var dr = dayRanges(rows), adrv = NaN, todayR = NaN;
  if (dr.length >= 3){ var cnt = 0, s = 0; for (var di = dr.length - 2; di >= 0 && cnt < 14; di--){ s += dr[di].h - dr[di].l; cnt++; } adrv = s / cnt; todayR = dr[dr.length - 1].h - dr[dr.length - 1].l; }
  push(R('adr', G, 'Average Day Range 14', 'regime', isFinite(adrv) && todayR > adrv ? -1 : 0, fmt(todayR) + ' of ' + fmt(adrv), 'today already beyond its average range = stretched (regime), no side'));
  push(R('atr', G, 'ATR 14', 'regime', 0, fmt(a14), 'sizes the stop; no side'));
  var bw = bbm ? (bbu - bbl) / bbm : NaN, bwArr = C.map(function(_, k){ return k < 19 ? NaN : 4 * stdev(C, 20)[k] / S20[k]; }), bwMin = Infinity; for (var bk = 1; bk <= 50 && i - bk >= 0; bk++) bwMin = Math.min(bwMin, bwArr[i - bk]);
  push(R('bbw', G, 'Bollinger bandwidth', 'regime', bw <= bwMin ? -1 : 0, fmt(100 * bw, 2) + '%', 'at a 50-bar low = squeeze (regime); no side'));
  var pb = (bbu > bbl) ? (px - bbl) / (bbu - bbl) : 0.5;
  push(R('pctb', G, 'Bollinger %B', 'vote', pb > 1 ? 1 : pb < 0 ? -1 : 0, fmt(pb, 2), 'walking outside the band, on that side; inside = neutral'));
  var cvE = ema(rows.map(function(r){ return r.h - r.l; }), 10), cv = at(cvE, 10) ? 100 * (last(cvE) - at(cvE, 10)) / at(cvE, 10) : NaN;
  push(R('chv', G, 'Chaikin Volatility 10', 'regime', 0, fmt(cv, 1) + '%', 'range expansion/contraction; no side'));
  push(R('chop', G, 'Choppiness Index 14', 'regime', chop > 61.8 ? -1 : chop < 38.2 ? 1 : 0, fmt(chop, 1), '>61.8 = CHOP · <38.2 = trending'));
  var lr = C.map(function(x, k){ return k ? Math.log(x / C[k - 1]) : 0; }), hv = 100 * last(stdev(lr, 20)) * Math.sqrt(96 * 365);
  push(R('hv', G, 'Historical volatility 20 (annualised)', 'regime', 0, fmt(hv, 1) + '%', 'no side'));
  var miE = ema(rows.map(function(r){ return r.h - r.l; }), 9), miE2 = ema(fill0(miE), 9), mi = 0; for (var mj = 0; mj < 25; mj++) mi += miE[i - mj] / (miE2[i - mj] || 1);
  push(R('mass', G, 'Mass Index 25', 'regime', mi > 27 ? -1 : 0, fmt(mi, 2), '>27 = reversal bulge (regime); no side'));
  push(R('natr', G, 'NATR 14', 'regime', 0, fmt(100 * a14 / px, 3) + '%', 'no side'));
  push(R('sd', G, 'Standard deviation 20', 'regime', 0, fmt(bbs), 'no side'));
  push(R('tr', G, 'True range (last bar)', 'regime', 0, fmt(TR[i]), 'no side'));
  var ul = (function(){ var s2 = 0; for (var j = 0; j < 14; j++){ var mx = -Infinity; for (var q2 = 0; q2 <= j; q2++) mx = Math.max(mx, C[i - 13 + j - q2]); var d2 = 100 * (C[i - 13 + j] - mx) / mx; s2 += d2 * d2; } return Math.sqrt(s2 / 14); })();
  push(R('ulcer', G, 'Ulcer Index 14', 'regime', 0, fmt(ul, 3), 'drawdown stress; no side'));
  var vst = supertrend(rows, 14, 2);
  push(R('vstop', G, 'Volatility Stop (ATR 14 ×2)', 'vote', isFinite(last(vst)) ? last(vst) : 0, last(vst) === 1 ? 'below price' : last(vst) === -1 ? 'above price' : '—', 'stop below price = long'));
  var vip = 0, vim = 0, vtr = 0; for (var vj = 0; vj < 14; vj++){ vip += Math.abs(rows[i - vj].h - rows[i - vj - 1].l); vim += Math.abs(rows[i - vj].l - rows[i - vj - 1].h); vtr += TR[i - vj]; }
  push(R('vortex', G, 'Vortex 14 (VI+ vs VI−)', 'vote', vs(vip, vim), fmt(vip / vtr, 3) + ' / ' + fmt(vim / vtr, 3), 'VI+ above VI− = long'));

  /* ---------------- VOLUME ---------------- */
  G = 'VOLUME';
  var AD = adl(rows);
  push(R('adl', G, 'Accumulation/Distribution (10-bar slope)', 'vote', vs(last(AD), at(AD, 10)), fmt(last(AD), 0), 'rising = long'));
  var asi = (function(){ var s2 = 0, out2 = nanArr(n), lim = 0; for (var k = 1; k < n; k++){ lim = Math.max(lim, TR[k]); var r = rows[k], p = rows[k - 1], K = Math.max(Math.abs(r.h - p.c), Math.abs(r.l - p.c)), a = Math.abs(r.h - p.c), b = Math.abs(r.l - p.c), c = Math.abs(r.h - r.l), d = Math.abs(p.c - p.o), Rr = (a >= b && a >= c) ? a - 0.5 * b + 0.25 * d : (b >= a && b >= c) ? b - 0.5 * a + 0.25 * d : c + 0.25 * d; var si = Rr ? 50 * ((r.c - p.c) + 0.5 * (r.c - r.o) + 0.25 * (p.c - p.o)) / Rr * (K / (lim || 1)) : 0; s2 += si; out2[k] = s2; } return out2; })();
  push(R('asi', G, 'Accumulative Swing Index (10-bar slope)', 'vote', vs(last(asi), at(asi, 10)), fmt(last(asi), 1), 'rising = long'));
  var cm = last(cmf(rows, 20));
  push(R('cmf', G, 'Chaikin Money Flow 20', 'vote', band(cm, 0.05, -0.05), fmt(cm, 3), 'beyond ±0.05'));
  var chOsc = last(ema(AD, 3)) - last(ema(AD, 10));
  push(R('chosc', G, 'Chaikin Oscillator 3,10', 'vote', sgn(chOsc), fmt(chOsc, 0), 'positive = long'));
  var eom = last(sma(rows.map(function(r, k){ if (!k || !(r.h - r.l) || !r.v) return 0; return (((r.h + r.l) / 2) - ((rows[k - 1].h + rows[k - 1].l) / 2)) / (r.v / (r.h - r.l)); }), 14));
  push(R('eom', G, 'Ease of Movement 14', 'vote', sgn(eom), fmt(eom, 6), 'positive = long'));
  var efi = last(ema(rows.map(function(r, k){ return k ? (r.c - rows[k - 1].c) * r.v : 0; }), 13));
  push(R('efi', G, 'Elder Force Index 13', 'vote', sgn(efi), fmt(efi, 0), 'positive = long'));
  var kv = (function(){ var vf = nanArr(n), cmv = 0, dmP = 0, trP = 0; for (var k = 1; k < n; k++){ var r = rows[k], p = rows[k - 1], dm = r.h - r.l, t = (r.h + r.l + r.c) > (p.h + p.l + p.c) ? 1 : -1; cmv = (t === trP) ? cmv + dm : dmP + dm; vf[k] = cmv ? r.v * Math.abs(2 * (dm / cmv) - 1) * t * 100 : 0; dmP = dm; trP = t; } var kvo = ema(fill0(vf), 34).map(function(x, k){ return x - ema(fill0(vf), 55)[k]; }); return { k: last(kvo), s: last(ema(fill0(kvo), 13)) }; })();
  push(R('klinger', G, 'Klinger Oscillator 34,55,13', 'vote', vs(kv.k, kv.s), fmt(kv.k, 0) + ' / ' + fmt(kv.s, 0), 'KVO above its signal = long'));
  var bwm = rows[i].v ? (rows[i].h - rows[i].l) / rows[i].v : NaN, bwmP = rows[i - 1].v ? (rows[i - 1].h - rows[i - 1].l) / rows[i - 1].v : NaN;
  var bwState = (bwm > bwmP && rows[i].v > rows[i - 1].v) ? 'green (trend)' : (bwm < bwmP && rows[i].v < rows[i - 1].v) ? 'fade' : (bwm < bwmP && rows[i].v > rows[i - 1].v) ? 'squat (fight)' : 'fake';
  push(R('bwmfi', G, 'BW Market Facilitation Index', 'regime', bwState === 'squat (fight)' ? -1 : 0, bwState, 'Bill Williams’ four states; squat = regime warning, no side'));
  var mf = last(mfi(rows, 14));
  push(R('mfi', G, 'Money Flow Index 14', 'vote', band(mf, 55, 45), fmt(mf, 1), '>55 long · <45 short'));
  var nvi = (function(){ var a = [1000]; for (var k = 1; k < n; k++) a[k] = rows[k].v < rows[k - 1].v ? a[k - 1] * (1 + (C[k] - C[k - 1]) / C[k - 1]) : a[k - 1]; return { v: last(a), e: last(ema(a, 100)) }; })();
  push(R('nvi', G, 'Negative Volume Index vs EMA 100', 'vote', vs(nvi.v, nvi.e), fmt(nvi.v, 1) + ' / ' + fmt(nvi.e, 1), 'NVI above its average = long (smart money)'));
  var ob = obv(rows);
  push(R('obv', G, 'OBV (10-bar slope)', 'vote', vs(last(ob), at(ob, 10)), fmt(last(ob), 0), 'rising = long'));
  var pvi = (function(){ var a = [1000]; for (var k = 1; k < n; k++) a[k] = rows[k].v > rows[k - 1].v ? a[k - 1] * (1 + (C[k] - C[k - 1]) / C[k - 1]) : a[k - 1]; return { v: last(a), e: last(ema(a, 100)) }; })();
  push(R('pvi', G, 'Positive Volume Index vs EMA 100', 'vote', vs(pvi.v, pvi.e), fmt(pvi.v, 1) + ' / ' + fmt(pvi.e, 1), 'PVI above its average = long (crowd)'));
  var pvt = (function(){ var s2 = 0, a = [0]; for (var k = 1; k < n; k++){ s2 += (C[k] - C[k - 1]) / C[k - 1] * rows[k].v; a[k] = s2; } return a; })();
  push(R('pvt', G, 'Price Volume Trend (10-bar slope)', 'vote', vs(last(pvt), at(pvt, 10)), fmt(last(pvt), 0), 'rising = long'));
  var vo = last(ema(VOL, 10)) ? 100 * (last(ema(VOL, 5)) - last(ema(VOL, 10))) / last(ema(VOL, 10)) : NaN;
  push(R('volosc', G, 'Volume Oscillator 5,10', 'print', 0, fmt(vo, 1) + '%', 'participation only — never a side (the OMNIGOLD volume lesson)'));
  var vp = (function(){ var lo = Infinity, hi = -Infinity, look = Math.min(100, n); for (var k = n - look; k < n; k++){ lo = Math.min(lo, rows[k].l); hi = Math.max(hi, rows[k].h); } if (!(hi > lo)) return NaN; var bins = new Array(20).fill(0), w = (hi - lo) / 20; for (var k2 = n - look; k2 < n; k2++){ var b = Math.min(19, Math.floor((rows[k2].c - lo) / w)); bins[b] += rows[k2].v; } var best = 0; for (var b2 = 1; b2 < 20; b2++) if (bins[b2] > bins[best]) best = b2; return lo + (best + 0.5) * w; })();
  push(R('vprof', G, 'Volume Profile POC (100 bars)', 'vote', isFinite(vp) ? vs(px, vp) : 0, fmt(vp), 'close above the point of control = long'));
  var vroc = VOL[i - 14] ? 100 * (VOL[i] - VOL[i - 14]) / VOL[i - 14] : NaN;
  push(R('vroc', G, 'Volume ROC 14', 'print', 0, fmt(vroc, 1) + '%', 'participation only — never a side'));

  /* ---------------- TREND STRENGTH ---------------- */
  G = 'TREND STRENGTH';
  push(R('adx', G, 'ADX 14', 'regime', adxv < 20 ? -1 : adxv > 25 ? 1 : 0, fmt(adxv, 1), '<20 = no trend (CHOP) · >25 = trending; no side'));
  push(R('adxr', G, 'ADXR 14', 'regime', 0, fmt((adxv + at(D.adx, 14)) / 2, 1), 'smoothed trend strength; no side'));
  var hiAt = 0, loAt = 0; for (var aj = 0; aj <= 25; aj++){ if (rows[i - aj].h > rows[i - hiAt].h) hiAt = aj; if (rows[i - aj].l < rows[i - loAt].l) loAt = aj; }
  var arU = 100 * (25 - hiAt) / 25, arD = 100 * (25 - loAt) / 25;
  push(R('aroon', G, 'Aroon 25 (up vs down)', 'vote', (arU > 70 && arU > arD) ? 1 : (arD > 70 && arD > arU) ? -1 : 0, fmt(arU, 0) + ' / ' + fmt(arD, 0), 'the dominant side above 70'));
  push(R('aroon_osc', G, 'Aroon Oscillator', 'print', 0, fmt(arU - arD, 0), 'identical information to Aroon up/down — counted once, above'));
  var tii = (function(){ var s30 = sma(C, 30), pos = 0, neg = 0; for (var j = 0; j < 15; j++){ var d3 = C[i - j] - s30[i - j]; if (d3 > 0) pos += d3; else neg -= d3; } return (pos + neg) ? 100 * pos / (pos + neg) : 50; })();
  push(R('tii', G, 'Trend Intensity Index 30', 'vote', band(tii, 60, 40), fmt(tii, 1), '>60 long · <40 short'));
  var vhf = (function(){ var hh = -Infinity, ll = Infinity, s2 = 0; for (var j = 0; j < 28; j++){ hh = Math.max(hh, C[i - j]); ll = Math.min(ll, C[i - j]); s2 += Math.abs(C[i - j] - C[i - j - 1]); } return s2 ? (hh - ll) / s2 : 0; })();
  push(R('vhf', G, 'Vertical Horizontal Filter 28', 'regime', vhf < 0.25 ? -1 : vhf > 0.35 ? 1 : 0, fmt(vhf, 3), '<0.25 = CHOP · >0.35 = trending; no side'));

  /* ---------------- CYCLE / STATISTICAL ---------------- */
  G = 'CYCLE / STAT';
  push(R('beta', G, 'Beta', 'n/a', 0, '—', 'needs a benchmark series; one instrument cannot compute it — never faked'));
  push(R('corr', G, 'Correlation coefficient', 'n/a', 0, '—', 'needs a second series (DXY / yields) — offline none, never faked'));
  var ewo = last(sma(C, 5)) - last(sma(C, 35));
  push(R('ewo', G, 'Elliott Wave Oscillator 5/35', 'print', 0, fmt(ewo, 2), 'near-duplicate of the Awesome Oscillator (5/34 median) — counted once, there'));
  push(R('ht_dcp', G, 'Hilbert — dominant cycle period', 'print', 0, fmt(last(HT.speriod), 1) + ' bars', 'cycle length; no side'));
  push(R('ht_dcph', G, 'Hilbert — dominant cycle phase', 'print', 0, fmt(last(HT.dcphase), 0) + '°', 'phase; no side'));
  push(R('ht_phasor', G, 'Hilbert — phasor (I / Q)', 'print', 0, fmt(last(HT.I1), 3) + ' / ' + fmt(last(HT.Q1), 3), 'components; no side'));
  push(R('ht_sine', G, 'Hilbert — sinewave vs lead', 'vote', (last(HT.lead) > last(HT.sine) && at(HT.lead, 1) <= at(HT.sine, 1)) ? 1 : (last(HT.lead) < last(HT.sine) && at(HT.lead, 1) >= at(HT.sine, 1)) ? -1 : 0, fmt(last(HT.sine), 2) + ' / ' + fmt(last(HT.lead), 2), 'lead crossing the sine on this bar = the turn; else neutral'));
  push(R('ht_mode', G, 'Hilbert — trend vs cycle mode', 'regime', last(HT.mode) === 1 ? 1 : -1, last(HT.mode) === 1 ? 'TREND' : 'CYCLE', 'cycle mode = CHOP for the regime gate; no side'));
  var ang = Math.atan(last(LR14.slope)) * 180 / Math.PI;
  push(R('lr_angle', G, 'Linear regression angle 14', 'vote', band(ang, 5, -5), fmt(ang, 1) + '°', 'beyond ±5°'));
  push(R('lr_icpt', G, 'Linear regression intercept 14', 'print', 0, fmt(last(LR14.icpt)), 'no side'));
  push(R('lr_slope', G, 'Linear regression slope 14', 'print', 0, fmt(last(LR14.slope), 3), 'identical information to the angle — counted once, above'));
  push(R('stderr', G, 'Standard error 14', 'print', 0, fmt(last(LR14.se), 3), 'fit noise; no side'));
  push(R('tsf', G, 'Time Series Forecast 14', 'vote', vs(px, last(LR14.end)), fmt(last(LR14.end)), 'close above the forecast = long'));
  push(R('var', G, 'Variance 20', 'print', 0, fmt(bbs * bbs, 3), 'no side'));

  /* ---------------- MARKET BREADTH ---------------- */
  G = 'MARKET BREADTH';
  push(R('br_ad', G, 'Advance/Decline line', 'n/a', 0, '—', 'a market-wide count; one instrument has no advancers/decliners — never faked'));
  push(R('br_trin', G, 'Arms Index (TRIN)', 'n/a', 0, '—', 'market-wide; not computable from gold alone'));
  push(R('br_mcc', G, 'McClellan Oscillator', 'n/a', 0, '—', 'market-wide; not computable from gold alone'));
  push(R('br_mcs', G, 'McClellan Summation', 'n/a', 0, '—', 'market-wide; not computable from gold alone'));

  /* ---------------- ADVANCED MOVING AVERAGES ---------------- */
  G = 'ADVANCED MA';
  var fw = (function(){ var f = [1, 1]; for (var k = 2; k < 10; k++) f[k] = f[k - 1] + f[k - 2]; var s2 = 0, ws = 0; for (var j = 0; j < 10; j++){ s2 += C[i - 9 + j] * f[j]; ws += f[j]; } return s2 / ws; })();
  push(R('fwma', G, 'Fibonacci weighted MA 10', 'vote', vs(px, fw), fmt(fw), 'close above = long'));
  var frama = (function(){ var out2 = NaN, prev = C[i - 60]; for (var k = i - 59; k <= i; k++){ if (k < 16) continue; var n1 = (hhll(rows, 8, k - 8, true) - hhll(rows, 8, k - 8, false)) / 8, n2 = (hhll(rows, 8, k, true) - hhll(rows, 8, k, false)) / 8, n3 = (hhll(rows, 16, k, true) - hhll(rows, 16, k, false)) / 16; var Dm = (n1 + n2 > 0 && n3 > 0) ? (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2) : 1; var al = Math.exp(-4.6 * (Dm - 1)); al = Math.max(0.01, Math.min(1, al)); prev = al * C[k] + (1 - al) * prev; out2 = prev; } return out2; })();
  push(R('frama', G, 'FRAMA 16', 'vote', vs(px, frama), fmt(frama), 'close above the fractal-adaptive MA = long'));
  var zl = last(ema(C.map(function(x, k){ return k < 10 ? x : 2 * x - C[k - 10]; }), 20));
  push(R('zlema', G, 'Zero-lag EMA 20', 'vote', vs(px, zl), fmt(zl), 'close above = long'));
  var sw = (function(){ var s2 = 0, ws = 0; for (var j = 0; j < 14; j++){ var w = Math.sin(Math.PI * (j + 1) / 15); s2 += C[i - 13 + j] * w; ws += w; } return s2 / ws; })();
  push(R('sinwma', G, 'Sine-weighted MA 14', 'vote', vs(px, sw), fmt(sw), 'close above = long'));
  var jm = (function(){ var len = 7, pr = 2, beta = 0.45 * (len - 1) / (0.45 * (len - 1) + 2), al = Math.pow(beta, 2), e0 = C[0], e1 = 0, e2 = 0, j = C[0]; for (var k = 1; k < n; k++){ e0 = (1 - al) * C[k] + al * e0; e1 = (C[k] - e0) * (1 - beta) + beta * e1; e2 = (e0 + pr * e1 - j) * Math.pow(1 - al, 2) + Math.pow(al, 2) * e2; j = e2 + j; } return j; })();
  push(R('jma', G, 'Jurik MA 7 (public approximation)', 'vote', vs(px, jm), fmt(jm), 'JMA is proprietary — this is the open reimplementation (phase 50, power 2); close above = long'));
  push(R('adv_ma_dup', G, 'ALMA · HMA · KAMA · T3', 'print', 0, 'fed above', 'already counted in MOVING AVERAGES — never twice'));

  /* ---------------- SMART MONEY CONCEPTS ---------------- */
  G = 'SMART MONEY';
  var asia = (function(){ var day = Math.floor(rows[i].t / 86400), hi = -Infinity, lo = Infinity, done = false; for (var k = i; k >= 0 && Math.floor(rows[k].t / 86400) === day; k--){ var hr = Math.floor((rows[k].t % 86400) / 3600); if (hr < 7){ hi = Math.max(hi, rows[k].h); lo = Math.min(lo, rows[k].l); } } done = Math.floor((rows[i].t % 86400) / 3600) >= 7 && isFinite(hi); if (!done) return null; var v2 = 0; for (var m = 0; m < 4; m++){ var b = rows[i - m]; if (b.h > hi && px < hi) v2 = -1; if (b.l < lo && px > lo) v2 = 1; } return { hi: hi, lo: lo, v: v2 }; })();
  push(R('asia_sweep', G, 'Asia range sweep reversal', 'vote', asia ? asia.v : 0, asia ? fmt(asia.lo) + ' – ' + fmt(asia.hi) : 'range forming / none', 'a wick through the Asia range that closed back inside = fade that side'));
  var swings = (function(){ var pts = fr.hi.map(function(p){ return { i: p.i, v: p.v, t: 'H' }; }).concat(fr.lo.map(function(p){ return { i: p.i, v: p.v, t: 'L' }; })).sort(function(a, b){ return a.i - b.i; }); var H2 = pts.filter(function(p){ return p.t === 'H'; }).slice(-2), L2 = pts.filter(function(p){ return p.t === 'L'; }).slice(-2); return { H: H2, L: L2 }; })();
  var choch = 0, structDir = 0;
  if (swings.H.length === 2 && swings.L.length === 2){ if (swings.H[1].v > swings.H[0].v && swings.L[1].v > swings.L[0].v) structDir = 1; else if (swings.H[1].v < swings.H[0].v && swings.L[1].v < swings.L[0].v) structDir = -1; if (structDir === 1 && px < swings.L[1].v) choch = -1; if (structDir === -1 && px > swings.H[1].v) choch = 1; }
  push(R('choch', G, 'Change of Character (CHoCH)', 'vote', choch, structDir ? (structDir > 0 ? 'up structure' : 'down structure') + (choch ? ' · broken' : '') : 'no structure', 'a close through the protected swing against the prevailing structure'));
  var eq = (function(){ var v2 = 0, lvl = NaN; if (swings.H.length === 2 && Math.abs(swings.H[1].v - swings.H[0].v) <= 0.15 * a14){ lvl = Math.max(swings.H[0].v, swings.H[1].v); if (px > lvl) v2 = 1; } if (!v2 && swings.L.length === 2 && Math.abs(swings.L[1].v - swings.L[0].v) <= 0.15 * a14){ lvl = Math.min(swings.L[0].v, swings.L[1].v); if (px < lvl) v2 = -1; } return { v: v2, lvl: lvl }; })();
  push(R('eqhl', G, 'EQH / EQL breakout', 'vote', eq.v, isFinite(eq.lvl) ? fmt(eq.lvl) : 'none', 'a close through equal highs (long) / equal lows (short) — the liquidity pool taken'));
  var mss = (function(){ var v2 = 0; for (var m = 0; m < 5; m++){ var b = rows[i - m]; if (isFinite(fH) && b.h > fH && px < fH) v2 = -1; if (isFinite(fL) && b.l < fL && px > fL) v2 = 1; } return v2; })();
  push(R('mss', G, 'MSS sweep & reclaim', 'vote', mss, mss ? (mss > 0 ? 'low swept, reclaimed' : 'high swept, reclaimed') : 'none', 'a protected pivot swept by a wick and reclaimed by the close = fade the sweep'));
  var obr = (function(){ var ob = 0, br = 0, zone = null; for (var k = i - 3; k >= Math.max(5, i - 40); k--){ var mv = C[k + 3] - C[k]; if (Math.abs(mv) < 2 * a14) continue; var d = mv > 0 ? 1 : -1, cand = null; for (var q2 = k; q2 >= k - 5 && q2 >= 0; q2--){ var b = rows[q2]; if ((d > 0 && b.c < b.o) || (d < 0 && b.c > b.o)){ cand = b; break; } } if (!cand) continue; zone = { lo: cand.l, hi: cand.h, d: d, at: k }; var broken = false; for (var m = k + 3; m <= i; m++){ if ((d > 0 && rows[m].c < cand.l) || (d < 0 && rows[m].c > cand.h)) broken = true; } var inside = px >= cand.l && px <= cand.h; if (!broken && inside) ob = d; if (broken && inside) br = -d; break; } return { ob: ob, br: br, zone: zone }; })();
  push(R('ob', G, 'Order block retest', 'vote', obr.ob, obr.zone ? fmt(obr.zone.lo) + ' – ' + fmt(obr.zone.hi) : 'none', 'price back inside the last candle before a ≥2×ATR impulse, on the impulse side'));
  push(R('breaker', G, 'Breaker block', 'vote', obr.br, obr.br ? 'violated OB retested' : 'none', 'an order block that failed, retested from the other side = the other side'));
  push(R('smc_dup', G, 'FVG · BOS', 'print', 0, 'fed below', 'counted in STRUCTURE / HTF — never twice'));

  /* ---------------- ADVANCED MOMENTUM ---------------- */
  G = 'ADVANCED MOMENTUM';
  var e8 = ema(C, 8), amat = (slopeVote(e8, 3, 0.0001) > 0 && slopeVote(e21, 3, 0.0001) > 0) ? 1 : (slopeVote(e8, 3, 0.0001) < 0 && slopeVote(e21, 3, 0.0001) < 0) ? -1 : 0;
  push(R('amat', G, 'Archer MA Trends 8/21', 'vote', amat, fmt(last(e8)) + ' / ' + fmt(last(e21)), 'both averages rising = long, both falling = short'));
  var hst = (rows1h && rows1h.length >= 40) ? stochKD(rows1h, 14, 3, 3) : null;
  push(R('htf_stoch', G, 'HTF stochastic bucket (1H 14,3,3)', 'vote', hst ? (last(hst.k) < 20 ? 1 : last(hst.k) > 80 ? -1 : 0) : 0, hst ? fmt(last(hst.k), 1) : '—', 'exhaustion bucket: <20 = long, >80 = short (a counter-trend read, by design)'));
  push(R('adv_mom_dup', G, 'CG · Coppock · EFI · Fisher · KST · SMI · TSI', 'print', 0, 'fed above', 'counted in MOMENTUM / VOLUME — never twice'));

  /* ---------------- ADVANCED VOLATILITY ---------------- */
  G = 'ADVANCED VOLATILITY';
  var acU = last(sma(rows.map(function(r){ return (r.h + r.l) ? r.h * (1 + 4 * (r.h - r.l) / (r.h + r.l)) : r.h; }), 20)), acL = last(sma(rows.map(function(r){ return (r.h + r.l) ? r.l * (1 - 4 * (r.h - r.l) / (r.h + r.l)) : r.l; }), 20));
  push(R('accb', G, 'Acceleration Bands 20', 'vote', px > acU ? 1 : px < acL ? -1 : 0, fmt(acL) + ' – ' + fmt(acU), 'close outside the bands, on that side'));
  var nw = (function(){ for (var m = 1; m <= 30; m++){ var b = rows[i - m], rg = b.h - b.l; if (!(rg > 0)) continue; var body = Math.abs(b.c - b.o); if (body < 0.5 * rg) continue; if (b.c > b.o && (b.o - b.l) <= 0.05 * rg && Math.abs(px - b.o) <= 0.3 * a14) return { v: 1, lvl: b.o }; if (b.c < b.o && (b.h - b.o) <= 0.05 * rg && Math.abs(px - b.o) <= 0.3 * a14) return { v: -1, lvl: b.o }; } return { v: 0, lvl: NaN }; })();
  push(R('nowick', G, 'No-wick retest level', 'vote', nw.v, isFinite(nw.lvl) ? fmt(nw.lvl) : 'none', 'price retesting the open of a no-wick momentum candle, on that candle’s side'));
  push(R('adv_vol_dup', G, 'ADR · Donchian · Mass Index · NATR', 'print', 0, 'fed above', 'counted in VOLATILITY / MOVING AVERAGES — never twice'));

  /* ---------------- ADVANCED VOLUME ---------------- */
  G = 'ADVANCED VOLUME';
  push(R('adosc', G, 'A/D Oscillator (ADOSC)', 'print', 0, fmt(chOsc, 0), 'identical to the Chaikin Oscillator — counted once, in VOLUME'));
  var anchor = Math.max(fr.hi.length ? fr.hi[fr.hi.length - 1].i : 0, fr.lo.length ? fr.lo[fr.lo.length - 1].i : 0);
  var avp = (function(){ var lo = Infinity, hi = -Infinity; for (var k = anchor; k <= i; k++){ lo = Math.min(lo, rows[k].l); hi = Math.max(hi, rows[k].h); } if (!(hi > lo) || i - anchor < 5) return NaN; var bins = new Array(20).fill(0), w = (hi - lo) / 20; for (var k2 = anchor; k2 <= i; k2++){ var b = Math.min(19, Math.floor((rows[k2].c - lo) / w)); bins[b] += rows[k2].v; } var best = 0; for (var b2 = 1; b2 < 20; b2++) if (bins[b2] > bins[best]) best = b2; return lo + (best + 0.5) * w; })();
  push(R('avp', G, 'Anchored Volume Profile POC (from the last swing)', 'vote', isFinite(avp) ? vs(px, avp) : 0, fmt(avp), 'close above the anchored point of control = long'));
  var aobv = { f: last(ema(ob, 4)), s: last(ema(ob, 12)) };
  push(R('aobv', G, 'Archer OBV (EMA 4 vs 12)', 'vote', vs(aobv.f, aobv.s), fmt(aobv.f, 0) + ' / ' + fmt(aobv.s, 0), 'fast OBV average above slow = long'));
  var cvd = (function(){ var s2 = 0, a = []; for (var k = 0; k < n; k++){ var r = rows[k], rg = r.h - r.l, buy = rg > 0 ? r.v * (r.c - r.l) / rg : r.v / 2; s2 += buy - (r.v - buy); a[k] = s2; } return a; })();
  push(R('cvd', G, 'Cumulative Volume Delta (BVC proxy, 10-bar slope)', 'vote', vs(last(cvd), at(cvd, 10)), fmt(last(cvd), 0), 'no bid/ask tape offline — bulk-volume classification proxy; rising = long'));
  push(R('adv_nvipvi', G, 'NVI · PVI', 'print', 0, 'fed above', 'counted in VOLUME — never twice'));
  var tpo = (function(){ var lo = Infinity, hi = -Infinity, look = Math.min(100, n); for (var k = n - look; k < n; k++){ lo = Math.min(lo, rows[k].l); hi = Math.max(hi, rows[k].h); } if (!(hi > lo)) return NaN; var bins = new Array(20).fill(0), w = (hi - lo) / 20; for (var k2 = n - look; k2 < n; k2++){ var b = Math.min(19, Math.floor((rows[k2].c - lo) / w)); bins[b] += 1; } var best = 0; for (var b2 = 1; b2 < 20; b2++) if (bins[b2] > bins[best]) best = b2; return lo + (best + 0.5) * w; })();
  push(R('tpo', G, 'TPO / Market Profile POC (100 bars)', 'vote', isFinite(tpo) ? vs(px, tpo) : 0, fmt(tpo), 'close above the time-based point of control = long'));
  var va = (function(){ var lo = Infinity, hi = -Infinity, look = Math.min(100, n); for (var k = n - look; k < n; k++){ lo = Math.min(lo, rows[k].l); hi = Math.max(hi, rows[k].h); } if (!(hi > lo)) return null; var bins = new Array(20).fill(0), w = (hi - lo) / 20, tot = 0; for (var k2 = n - look; k2 < n; k2++){ var b = Math.min(19, Math.floor((rows[k2].c - lo) / w)); bins[b] += rows[k2].v; tot += rows[k2].v; } var poc = 0; for (var b2 = 1; b2 < 20; b2++) if (bins[b2] > bins[poc]) poc = b2; var acc = bins[poc], u = poc, d = poc; while (acc < 0.7 * tot && (u < 19 || d > 0)){ var up = u < 19 ? bins[u + 1] : -1, dn = d > 0 ? bins[d - 1] : -1; if (up >= dn){ u++; acc += up; } else { d--; acc += dn; } } return { vah: lo + (u + 1) * w, val: lo + d * w }; })();
  var vaRev = va ? ((C[i - 1] > va.vah && px <= va.vah) ? -1 : (C[i - 1] < va.val && px >= va.val) ? 1 : 0) : 0;
  push(R('va_rev', G, 'Value Area reversion', 'vote', vaRev, va ? fmt(va.val) + ' – ' + fmt(va.vah) : '—', 'a close back inside the 70% value area from outside = revert toward the POC'));

  /* ---------------- STATISTICAL MODELS ---------------- */
  G = 'STATISTICAL';
  var st20 = (function(){ var r2 = []; for (var k = i - 19; k <= i; k++) r2.push((C[k] - C[k - 1]) / C[k - 1]); var m = r2.reduce(function(a, b){ return a + b; }, 0) / 20, v2 = 0, s3 = 0, s4 = 0, mad = 0; for (var q2 = 0; q2 < 20; q2++){ var d2 = r2[q2] - m; v2 += d2 * d2; s3 += d2 * d2 * d2; s4 += d2 * d2 * d2 * d2; mad += Math.abs(d2); } v2 /= 20; var sdv = Math.sqrt(v2); return { skew: sdv ? (s3 / 20) / Math.pow(sdv, 3) : 0, kurt: v2 ? (s4 / 20) / (v2 * v2) - 3 : 0, mad: mad / 20 }; })();
  push(R('skew', G, 'Skew (20 returns)', 'vote', band(st20.skew, 0.5, -0.5), fmt(st20.skew, 2), 'positive tail = long, negative tail = short (beyond ±0.5)'));
  push(R('kurt', G, 'Kurtosis (20 returns, excess)', 'regime', st20.kurt > 3 ? -1 : 0, fmt(st20.kurt, 2), 'fat tails (>3) = jumpy regime; no side'));
  var lrc = (function(){ var ss = 0; for (var m = 0; m < 25; m++){ var e = C[i - 24 + m] - (last(LR25.icpt) + last(LR25.slope) * m); ss += e * e; } return Math.sqrt(ss / 25); })();
  push(R('lrchan', G, 'Linear regression channel 25 (±2σ)', 'vote', px > last(LR25.end) + 2 * lrc ? 1 : px < last(LR25.end) - 2 * lrc ? -1 : 0, fmt(last(LR25.end) - 2 * lrc) + ' – ' + fmt(last(LR25.end) + 2 * lrc), 'close outside the channel, on that side'));
  push(R('mad', G, 'Mean absolute deviation (20 returns)', 'regime', 0, fmt(100 * st20.mad, 3) + '%', 'dispersion; no side'));
  var LR21 = linreg(C, 21);
  push(R('seband', G, 'Standard error bands 21 (±2 SE)', 'vote', px > last(LR21.end) + 2 * last(LR21.se) ? 1 : px < last(LR21.end) - 2 * last(LR21.se) ? -1 : 0, fmt(last(LR21.end) - 2 * last(LR21.se)) + ' – ' + fmt(last(LR21.end) + 2 * last(LR21.se)), 'close outside the bands, on that side'));
  var z = bbs ? (px - bbm) / bbs : 0;
  push(R('zscore', G, 'Z-score 20', 'vote', z > 2 ? -1 : z < -2 ? 1 : 0, fmt(z, 2), 'stretched beyond ±2σ = revert (a counter-trend read, by design)'));

  /* ---------------- ICT / SMC (continued) ---------------- */
  G = 'ICT / SMC';
  var hrNow = Math.floor((rows[i].t % 86400) / 3600), kz = (hrNow >= 7 && hrNow < 10) ? 'LONDON' : (hrNow >= 12 && hrNow < 15) ? 'NEW YORK' : (hrNow >= 0 && hrNow < 4) ? 'ASIA' : null;
  push(R('killzone', G, 'ICT killzone (bar clock)', 'print', 0, kz || 'outside', 'London 07-10 · New York 12-15 · Asia 00-04 UTC — context only, never a side'));
  var mit = (function(){ if (!obr.zone) return 0; var zn = obr.zone, touched = 0; for (var m = zn.at + 3; m < i; m++) if (rows[m].l <= zn.hi && rows[m].h >= zn.lo) touched++; var inside = px >= zn.lo && px <= zn.hi; return (touched >= 1 && inside && obr.ob === 0 && obr.br === 0) ? zn.d : 0; })();
  push(R('mitigation', G, 'Mitigation block', 'vote', mit, mit ? 'retest of a mitigated block' : 'none', 'a block already visited once, retested again on the impulse side'));
  var lv = (function(){ for (var m = 1; m <= 40; m++){ var b = rows[i - m]; if ((b.h - b.l) < 2.5 * a14) continue; var lo = Math.min(b.o, b.c), hi = Math.max(b.o, b.c); if (px >= lo && px <= hi) return { v: b.c > b.o ? 1 : -1, lo: lo, hi: hi }; } return { v: 0 }; })();
  push(R('lqvoid', G, 'Liquidity void', 'vote', lv.v, lv.v ? fmt(lv.lo) + ' – ' + fmt(lv.hi) : 'none', 'price inside a single-bar ≥2.5×ATR displacement body, on the displacement side'));
  var ote = (function(){ if (!swings.H.length || !swings.L.length) return { v: 0 }; var Hh = swings.H[swings.H.length - 1], Ll = swings.L[swings.L.length - 1]; if (Ll.i < Hh.i){ var leg = Hh.v - Ll.v, lo = Hh.v - 0.79 * leg, hi = Hh.v - 0.62 * leg; return { v: (px >= lo && px <= hi) ? 1 : 0, lo: lo, hi: hi }; } var leg2 = Hh.v - Ll.v, lo2 = Ll.v + 0.62 * leg2, hi2 = Ll.v + 0.79 * leg2; return { v: (px >= lo2 && px <= hi2) ? -1 : 0, lo: lo2, hi: hi2 }; })();
  push(R('ote', G, 'Optimal Trade Entry (0.62–0.79)', 'vote', ote.v, isFinite(ote.lo) ? fmt(ote.lo) + ' – ' + fmt(ote.hi) : 'no leg', 'price inside the 62–79% retrace of the last swing leg, on the leg’s side'));
  var inst = Math.round(px / 50) * 50;
  push(R('instlvl', G, 'Institutional level ($50 handle)', 'print', 0, '$' + fmt(inst, 0) + ' · ' + fmt(Math.abs(px - inst)) + ' away', 'context only — never a side'));
  push(R('ict_dup', G, 'Asian range · BOS · CHoCH · breaker · FVG · EQH/EQL', 'print', 0, 'fed above', 'counted in SMART MONEY / STRUCTURE — never twice'));

  /* ---------------- TRADINGVIEW COMMUNITY / ML SCRIPTS ---------------- */
  G = 'TV / ML SCRIPTS';
  var hlc3 = rows.map(function(r){ return (r.h + r.l + r.c) / 3; });
  var wtA = (function(){ var esa = ema(hlc3, 10), dd = ema(fill0(hlc3.map(function(x, k){ return Math.abs(x - esa[k]); })), 10), ci = hlc3.map(function(x, k){ return dd[k] ? (x - esa[k]) / (0.015 * dd[k]) : 0; }), wt1 = ema(fill0(ci), 21), wt2 = sma(fill0(wt1), 4); return { wt1: wt1, wt2: wt2 }; })();
  push(R('wavetrend', G, 'WaveTrend 10,21', 'vote', vs(last(wtA.wt1), last(wtA.wt2)), fmt(last(wtA.wt1), 1) + ' / ' + fmt(last(wtA.wt2), 1), 'wt1 above wt2 = long'));
  var cipher = (last(wtA.wt1) > last(wtA.wt2) && at(wtA.wt1, 1) <= at(wtA.wt2, 1) && last(wtA.wt1) < 0) ? 1 : (last(wtA.wt1) < last(wtA.wt2) && at(wtA.wt1, 1) >= at(wtA.wt2, 1) && last(wtA.wt1) > 0) ? -1 : 0;
  push(R('cipherb', G, 'VuManChu Cipher B (WT cross + money flow)', 'vote', (cipher > 0 && cm > 0) ? 1 : (cipher < 0 && cm < 0) ? -1 : 0, cipher ? (cipher > 0 ? 'green dot' : 'red dot') : 'no dot', 'a WaveTrend cross below 0 / above 0 with money flow agreeing'));
  var lorentz = (function(){ var rs = rsi(C, 14), cc2 = cci(rows, 20), ad2 = D.adx, feat = function(k){ return [rs[k] / 100, Math.max(-3, Math.min(3, cc2[k] / 100)), (ad2[k] || 0) / 100, Math.max(-3, Math.min(3, wtA.wt1[k] / 100))]; }, cur = feat(i), ds = []; for (var k = i - 100; k <= i - 4; k++){ if (k < 60) continue; var f = feat(k), d2 = 0; for (var q2 = 0; q2 < 4; q2++) d2 += Math.log(1 + Math.abs(f[q2] - cur[q2])); ds.push({ d: d2, y: sgn(C[k + 4] - C[k]) }); } ds.sort(function(a, b){ return a.d - b.d; }); var s2 = 0; for (var m = 0; m < Math.min(8, ds.length); m++) s2 += ds[m].y; return { v: ds.length >= 8 ? sgn(s2) : 0, n: ds.length, s: s2 }; })();
  push(R('lorentzian', G, 'Lorentzian classification (kNN 8, 4-bar label)', 'vote', lorentz.v, 'vote sum ' + lorentz.s + ' of 8', 'nearest past bars by Lorentzian distance on RSI/CCI/ADX/WT; their 4-bar outcomes vote (labels only from bars ≥4 old)'));
  var nw2 = (function(){ var h = 8, look = 100, num = 0, den = 0, mae = 0, cnt = 0; for (var k = 0; k < look && i - k >= 0; k++){ var w = Math.exp(-(k * k) / (2 * h * h)); num += C[i - k] * w; den += w; } var est = num / den; for (var k2 = 1; k2 < look && i - k2 >= 0; k2++){ var n2 = 0, d2 = 0; for (var q2 = 0; q2 < look && i - k2 - q2 >= 0; q2++){ var w2 = Math.exp(-(q2 * q2) / (2 * h * h)); n2 += C[i - k2 - q2] * w2; d2 += w2; } mae += Math.abs(C[i - k2] - n2 / d2); cnt++; } mae = cnt ? mae / cnt : 0; return { est: est, up: est + 3 * mae, lo: est - 3 * mae }; })();
  push(R('nwe', G, 'Nadaraya-Watson envelope (h=8, ×3 MAE, non-repainting)', 'vote', px > nw2.up ? -1 : px < nw2.lo ? 1 : 0, fmt(nw2.lo) + ' – ' + fmt(nw2.up), 'outside the kernel envelope = revert (a counter-trend read, by design)'));
  var utb = (function(){ var A10 = atr(rows, 10), tsv = nanArr(n), pos = 0; for (var k = 10; k < n; k++){ var nl = A10[k] * 1, p = isFinite(tsv[k - 1]) ? tsv[k - 1] : C[k] - nl; if (C[k] > p && C[k - 1] > p) tsv[k] = Math.max(p, C[k] - nl); else if (C[k] < p && C[k - 1] < p) tsv[k] = Math.min(p, C[k] + nl); else tsv[k] = C[k] > p ? C[k] - nl : C[k] + nl; } return { line: last(tsv) }; })();
  push(R('utbot', G, 'UT Bot (key 1, ATR 10)', 'vote', vs(px, utb.line), fmt(utb.line), 'close above the trailing line = long'));
  var stai = (function(){ var best = null; for (var f = 1; f <= 5; f++){ var tr2 = supertrend(rows, 10, f), perf = 0; for (var k = n - 100; k < n - 1; k++){ if (!isFinite(tr2[k])) continue; perf += tr2[k] * (C[k + 1] - C[k]); } if (!best || perf > best.perf) best = { f: f, perf: perf, side: last(tr2) }; } return best; })();
  push(R('st_ai', G, 'SuperTrend AI (open version: best factor 1–5 by past 100-bar performance)', 'vote', stai ? stai.side : 0, stai ? 'factor ' + stai.f : '—', 'the factor that paid best recently sets the side (no proprietary model)'));
  push(R('qqe_mod', G, 'QQE Mod', 'print', 0, 'fed above', 'a second QQE on the same RSI — counted once, in MOMENTUM'));
  var A5 = atr(rows, 5), cci20 = cci(rows, 20), tmLine = last(cci20) > 0 ? rows[i].l - last(A5) : rows[i].h + last(A5);
  push(R('trendmagic', G, 'Trend Magic (CCI 20 · ATR 5)', 'vote', (last(cci20) > 0 && px > tmLine) ? 1 : (last(cci20) < 0 && px < tmLine) ? -1 : 0, fmt(tmLine), 'CCI side with price on the right side of the ATR line'));
  var ht2 = (function(){ var trend = 0, next = 0, maxLow = rows[2].l, minHigh = rows[2].h; for (var k = 3; k < n; k++){ var high2 = Math.max(rows[k - 1].h, rows[k - 2].h), low2 = Math.min(rows[k - 1].l, rows[k - 2].l), hma2 = (rows[k].h + rows[k - 1].h) / 2, lma2 = (rows[k].l + rows[k - 1].l) / 2; if (next === 1){ maxLow = Math.max(low2, maxLow); if (hma2 < maxLow && C[k] < rows[k - 1].l){ trend = 1; next = 0; minHigh = high2; } } else { minHigh = Math.min(high2, minHigh); if (lma2 > minHigh && C[k] > rows[k - 1].h){ trend = 0; next = 1; maxLow = low2; } } } return trend === 0 ? 1 : -1; })();
  push(R('halftrend', G, 'HalfTrend (amplitude 2)', 'vote', ht2, ht2 > 0 ? 'up' : 'down', 'the channel’s current side'));
  var ssl = (function(){ var sH = sma(rows.map(function(r){ return r.h; }), 10), sL = sma(rows.map(function(r){ return r.l; }), 10), hlv = 0; for (var k = 9; k < n; k++){ if (C[k] > sH[k]) hlv = 1; else if (C[k] < sL[k]) hlv = -1; } return hlv; })();
  push(R('ssl', G, 'SSL Channel 10', 'vote', ssl, ssl > 0 ? 'above' : ssl < 0 ? 'below' : '—', 'the last cross of the high/low SMA channel'));
  var chand = (function(){ var A22 = atr(rows, 22), dir = 0; for (var k = 22; k < n; k++){ var ls = hhll(rows, 22, k, true) - 3 * A22[k], ss2 = hhll(rows, 22, k, false) + 3 * A22[k]; if (dir >= 0 && C[k] < ls) dir = -1; else if (dir <= 0 && C[k] > ss2) dir = 1; else if (!dir) dir = C[k] > ss2 ? 1 : C[k] < ls ? -1 : 0; } return dir; })();
  push(R('chandelier', G, 'Chandelier Exit 22,3', 'vote', chand, chand > 0 ? 'long side' : chand < 0 ? 'short side' : '—', 'which exit line price last crossed'));
  var s3 = last(sma(C, 3)), s8 = last(sma(C, 8)), didiC = s3 / s8 - 1, didiL = last(S20) / s8 - 1;
  push(R('didi', G, 'Didi Index 3/8/20', 'vote', (didiC > 0 && didiL < 0) ? 1 : (didiC < 0 && didiL > 0) ? -1 : 0, fmt(100 * didiC, 3) + '% / ' + fmt(100 * didiL, 3) + '%', 'the needle: short above the 8, long below (agulhada)'));

  /* ---------------- EHLERS / DSP ---------------- */
  G = 'EHLERS / DSP';
  var cyc = (function(){ var a = 0.07, smo = C.map(function(x, k){ return k < 3 ? x : (C[k] + 2 * C[k - 1] + 2 * C[k - 2] + C[k - 3]) / 6; }), cy = nanArr(n); for (var k = 0; k < n; k++){ if (k < 7){ cy[k] = (C[k] - 2 * (C[k - 1] || C[k]) + (C[k - 2] || C[k])) / 4; continue; } cy[k] = Math.pow(1 - 0.5 * a, 2) * (smo[k] - 2 * smo[k - 1] + smo[k - 2]) + 2 * (1 - a) * cy[k - 1] - Math.pow(1 - a, 2) * cy[k - 2]; } return cy; })();
  push(R('cybercycle', G, 'Cyber Cycle (α 0.07)', 'vote', vs(last(cyc), at(cyc, 1)), fmt(last(cyc), 3), 'cycle turning up = long'));
  var decy = function(p){ var a1 = (Math.cos(2 * Math.PI / p) + Math.sin(2 * Math.PI / p) - 1) / Math.cos(2 * Math.PI / p), hp = nanArr(n); for (var k = 0; k < n; k++){ hp[k] = k < 2 ? 0 : Math.pow(1 - a1 / 2, 2) * (C[k] - 2 * C[k - 1] + C[k - 2]) + 2 * (1 - a1) * hp[k - 1] - Math.pow(1 - a1, 2) * hp[k - 2]; } return C.map(function(x, k){ return x - hp[k]; }); };
  var d60 = decy(60), d30 = decy(30);
  push(R('decycler', G, 'Decycler 60', 'vote', vs(px, last(d60)), fmt(last(d60)), 'close above the decycler = long'));
  push(R('decycler_osc', G, 'Decycler oscillator 30/60', 'vote', sgn(last(d30) - last(d60)), fmt(last(d30) - last(d60), 3), 'positive = long'));
  var emd = (function(){ var p = 20, dl = 0.5, beta = Math.cos(2 * Math.PI / p), gamma = 1 / Math.cos(4 * Math.PI * dl / p), alpha = gamma - Math.sqrt(gamma * gamma - 1), bp = nanArr(n); for (var k = 0; k < n; k++) bp[k] = k < 2 ? 0 : 0.5 * (1 - alpha) * (C[k] - C[k - 2]) + beta * (1 + alpha) * bp[k - 1] - alpha * bp[k - 2]; var mean = last(sma(bp, 2 * p)), pk = 0, vl = 0, pc = 0, vc = 0; for (var k2 = n - 50; k2 < n - 1; k2++){ if (bp[k2] > bp[k2 - 1] && bp[k2] > bp[k2 + 1]){ pk += bp[k2]; pc++; } if (bp[k2] < bp[k2 - 1] && bp[k2] < bp[k2 + 1]){ vl += bp[k2]; vc++; } } pk = pc ? pk / pc : 0; vl = vc ? vl / vc : 0; return { mean: mean, v: mean > 0.25 * pk ? 1 : mean < 0.25 * vl ? -1 : 0 }; })();
  push(R('emd', G, 'Empirical Mode Decomposition (20, 0.5)', 'vote', emd.v, fmt(emd.mean, 3), 'the band-pass mean beyond a quarter of the average peak/valley = trend on that side; inside = cycle'));
  var ift = (function(){ var r5 = rsi(C, 5).map(function(x){ return isFinite(x) ? 0.1 * (x - 50) : 0; }), w9 = last(wma(r5, 9)); return (Math.exp(2 * w9) - 1) / (Math.exp(2 * w9) + 1); })();
  push(R('ifisher', G, 'Inverse Fisher Transform (RSI 5, WMA 9)', 'vote', band(ift, 0.5, -0.5), fmt(ift, 2), 'beyond ±0.5'));
  var itl = (function(){ var a = 0.07, it = nanArr(n); for (var k = 0; k < n; k++){ it[k] = k < 7 ? (C[k] + 2 * (C[k - 1] || C[k]) + (C[k - 2] || C[k])) / 4 : (a - a * a / 4) * C[k] + 0.5 * a * a * C[k - 1] - (a - 0.75 * a * a) * C[k - 2] + 2 * (1 - a) * it[k - 1] - Math.pow(1 - a, 2) * it[k - 2]; } return last(it); })();
  push(R('itrend', G, 'Instantaneous Trendline (α 0.07)', 'vote', vs(px, itl), fmt(itl), 'close above = long'));
  var lag = (function(){ var g = 0.5, L0 = 0, L1 = 0, L2 = 0, L3 = 0, rsiL = 0.5, filt = C[0]; for (var k = 0; k < n; k++){ var p0 = L0, p1 = L1, p2 = L2; L0 = (1 - g) * C[k] + g * p0; L1 = -g * L0 + p0 + g * p1; L2 = -g * L1 + p1 + g * p2; L3 = -g * L2 + p2 + g * L3; var cu2 = 0, cd2 = 0; if (L0 >= L1) cu2 += L0 - L1; else cd2 += L1 - L0; if (L1 >= L2) cu2 += L1 - L2; else cd2 += L2 - L1; if (L2 >= L3) cu2 += L2 - L3; else cd2 += L3 - L2; rsiL = (cu2 + cd2) ? cu2 / (cu2 + cd2) : rsiL; filt = (L0 + 2 * L1 + 2 * L2 + L3) / 6; } return { rsi: rsiL, filt: filt }; })();
  push(R('lag_rsi', G, 'Laguerre RSI (γ 0.5)', 'vote', lag.rsi > 0.8 ? 1 : lag.rsi < 0.2 ? -1 : 0, fmt(lag.rsi, 2), '>0.8 = long · <0.2 = short'));
  push(R('lag_filt', G, 'Laguerre filter (γ 0.5)', 'vote', vs(px, lag.filt), fmt(lag.filt), 'close above = long'));
  var ssf = function(src, p){ var a1 = Math.exp(-1.414 * Math.PI / p), b1 = 2 * a1 * Math.cos(1.414 * Math.PI / p), c2 = b1, c3 = -a1 * a1, c1 = 1 - c2 - c3, out2 = nanArr(n); for (var k = 0; k < n; k++) out2[k] = k < 2 ? src[k] : c1 * (src[k] + src[k - 1]) / 2 + c2 * out2[k - 1] + c3 * out2[k - 2]; return out2; };
  var roof = (function(){ var a1 = (Math.cos(0.707 * 2 * Math.PI / 48) + Math.sin(0.707 * 2 * Math.PI / 48) - 1) / Math.cos(0.707 * 2 * Math.PI / 48), hp = nanArr(n); for (var k = 0; k < n; k++) hp[k] = k < 2 ? 0 : Math.pow(1 - a1 / 2, 2) * (C[k] - 2 * C[k - 1] + C[k - 2]) + 2 * (1 - a1) * hp[k - 1] - Math.pow(1 - a1, 2) * hp[k - 2]; return ssf(hp, 10); })();
  push(R('roofing', G, 'Roofing filter (48 / 10)', 'vote', (last(roof) > 0 && last(roof) >= at(roof, 1)) ? 1 : (last(roof) < 0 && last(roof) <= at(roof, 1)) ? -1 : 0, fmt(last(roof), 3), 'positive and rising = long'));
  var ss10 = ssf(C, 10);
  push(R('supersmoother', G, 'Super Smoother 10', 'vote', vs(px, last(ss10)), fmt(last(ss10)), 'close above = long'));
  var voss = (function(){ var p = 20, pr = 3, ord = 3 * pr, f = 1.5, bw = 0.25, g1 = Math.cos(2 * Math.PI / p), s1 = 1 / Math.cos(2 * Math.PI * bw / p) - Math.sqrt(1 / Math.pow(Math.cos(2 * Math.PI * bw / p), 2) - 1), filt = nanArr(n), vo = nanArr(n); for (var k = 0; k < n; k++){ filt[k] = k < 2 ? 0 : 0.5 * (1 - s1) * (C[k] - C[k - 2]) + g1 * (1 + s1) * filt[k - 1] - s1 * filt[k - 2]; var sumC = 0; for (var q2 = 1; q2 <= ord; q2++) sumC += (q2 / ord) * (vo[k - q2] || 0); vo[k] = (0.5 * (3 + ord)) * filt[k] - sumC; } return { v: last(vo), f: last(filt) }; })();
  push(R('voss', G, 'Voss predictive filter (20, predict 3)', 'vote', vs(voss.v, voss.f), fmt(voss.v, 3) + ' / ' + fmt(voss.f, 3), 'the predictor above the filter = long'));
  push(R('dsp_dup', G, 'CG · Fisher · FRAMA · MAMA/FAMA · sine wave', 'print', 0, 'fed above', 'counted in MOMENTUM / ADVANCED MA / CYCLE — never twice'));

  /* ---------------- BILL WILLIAMS ---------------- */
  G = 'BILL WILLIAMS';
  var acA = aoA.map(function(x, k){ return x - sma(fill0(aoA), 5)[k]; });
  push(R('ac', G, 'Accelerator/Decelerator (AC)', 'vote', (last(acA) > 0 && last(acA) >= at(acA, 1)) ? 1 : (last(acA) < 0 && last(acA) <= at(acA, 1)) ? -1 : 0, fmt(last(acA), 2), 'positive and rising = long'));
  push(R('bw_dup', G, 'Alligator · AO · fractals · Gator · BW MFI', 'print', 0, 'fed above', 'counted in MOMENTUM / MOVING AVERAGES / VOLUME — never twice'));

  /* ---------------- MT4 / MT5 CUSTOM ---------------- */
  G = 'MT4 / MT5';
  var tdi = (function(){ var r13 = fill0(rsi(C, 13)), pl = last(sma(r13, 2)), sl = last(sma(r13, 7)), base = last(sma(r13, 34)); return { pl: pl, sl: sl, base: base }; })();
  push(R('tdi', G, 'Traders Dynamic Index (RSI 13 · 2 / 7 / 34)', 'vote', (tdi.pl > tdi.sl && tdi.pl > 50) ? 1 : (tdi.pl < tdi.sl && tdi.pl < 50) ? -1 : 0, fmt(tdi.pl, 1) + ' / ' + fmt(tdi.sl, 1) + ' · base ' + fmt(tdi.base, 1), 'price line above the signal line on its own side of 50'));
  push(R('bsmagic', G, 'Buy Sell Magic', 'n/a', 0, '—', 'proprietary and undocumented — never approximated'));
  var has = (function(){ var eo = ema(rows.map(function(r){ return r.o; }), 6), ec = ema(C, 6), eh = ema(rows.map(function(r){ return r.h; }), 6), el2 = ema(rows.map(function(r){ return r.l; }), 6), hao = NaN, hac = NaN; for (var k = 6; k < n; k++){ var c2 = (eo[k] + eh[k] + el2[k] + ec[k]) / 4; hao = isFinite(hao) ? (hao + hac) / 2 : (eo[k] + ec[k]) / 2; hac = c2; } return { o: hao, c: hac }; })();
  push(R('ha_smooth', G, 'Heikin-Ashi smoothed (EMA 6)', 'vote', vs(has.c, has.o), fmt(has.o) + ' → ' + fmt(has.c), 'a green smoothed HA candle = long'));
  push(R('apo_dup', G, 'APO', 'print', 0, 'fed above', 'counted in MOMENTUM — never twice'));
  var ash = (function(){ var bulls = ema(fill0(C.map(function(x, k){ return k ? Math.max(x - C[k - 1], 0) : 0; })), 9), bears = ema(fill0(C.map(function(x, k){ return k ? Math.max(C[k - 1] - x, 0) : 0; })), 9); return { b: last(bulls), s: last(bears) }; })();
  push(R('ash', G, 'Absolute Strength Histogram 9', 'vote', vs(ash.b, ash.s), fmt(ash.b, 3) + ' / ' + fmt(ash.s, 3), 'bulls above bears = long'));
  var cci14 = cci(rows, 14), cciArrow = (at(cci14, 1) < -100 && last(cci14) >= -100) ? 1 : (at(cci14, 1) > 100 && last(cci14) <= 100) ? -1 : 0;
  push(R('cci_arrows', G, 'CCI Arrows (14, ±100 cross)', 'vote', cciArrow, cciArrow ? (cciArrow > 0 ? 'up arrow' : 'down arrow') : 'none', 'an arrow prints on the bar that crosses back through ±100'));
  push(R('zz_psar', G, 'ZigZagOnParabolic', 'print', 0, last(ps.trend) === 1 ? 'up leg' : 'down leg', 'identical information to Parabolic SAR — counted once, there'));
  var td = (function(){ var s2 = 0, b2 = 0; for (var k = i; k > 4; k--){ if (C[k] > C[k - 4]){ if (b2) break; s2++; } else if (C[k] < C[k - 4]){ if (s2) break; b2++; } else break; if (s2 >= 9 || b2 >= 9) break; } return s2 >= 9 ? { v: -1, txt: 'sell setup 9' } : b2 >= 9 ? { v: 1, txt: 'buy setup 9' } : { v: 0, txt: (s2 ? 'up count ' + s2 : b2 ? 'down count ' + b2 : '0') }; })();
  push(R('td_seq', G, 'TD Sequential (setup 9)', 'vote', td.v, td.txt, 'a completed 9-count is exhaustion — fade it (a counter-trend read, by design)'));
  push(R('mt_dup', G, 'STC · ZigZag · TzPivots', 'print', 0, 'fed above', 'counted in MOMENTUM / MOVING AVERAGES — never twice'));
  var rei = (function(){ var num = 0, den = 0; for (var k = i - 7; k <= i; k++){ var s1 = rows[k].h - rows[k - 2].h, s2 = rows[k].l - rows[k - 2].l, c1 = (rows[k - 2].h >= rows[k - 5].l || rows[k - 2].h >= rows[k - 6].l) && (rows[k - 2].l <= rows[k - 5].h || rows[k - 2].l <= rows[k - 6].h) ? 1 : 0, c2 = (rows[k].h >= rows[k - 5].l || rows[k].h >= rows[k - 6].l) && (rows[k].l <= rows[k - 5].h || rows[k].l <= rows[k - 6].h) ? 1 : 0; num += (s1 + s2) * c1 * c2; den += Math.abs(s1) + Math.abs(s2); } return den ? 100 * num / den : 0; })();
  push(R('rei', G, 'Range Expansion Index 8', 'vote', rei > 60 ? -1 : rei < -60 ? 1 : 0, fmt(rei, 0), 'beyond ±60 = exhaustion, fade it (a counter-trend read, by design)'));

  /* ---------------- ORDER FLOW (continued) ---------------- */
  G = 'ORDER FLOW';
  push(R('footprint', G, 'Footprint / number bars', 'n/a', 0, '—', 'needs bid/ask executions per price — no tape offline, never faked'));
  push(R('bidask_vp', G, 'Bid/Ask volume profile', 'n/a', 0, '—', 'needs bid/ask executions — never faked'));
  var vwm = (function(){ var a = vwmaArr(rows, 12), b = vwmaArr(rows, 26), line = a.map(function(x, k){ return x - b[k]; }), sig = ema(fill0(line), 9); return { l: last(line), s: last(sig) }; })();
  push(R('vwmacd', G, 'Volume-weighted MACD 12,26,9', 'vote', vs(vwm.l, vwm.s), fmt(vwm.l, 3) + ' / ' + fmt(vwm.s, 3), 'VW line above its signal = long'));
  push(R('of_dup', G, 'CVD · TPO · VAH/VAL · POC · Klinger · EOM', 'print', 0, 'fed above', 'counted in VOLUME / ADVANCED VOLUME — never twice'));

  /* ---------------- CANDLESTICK PATTERNS (TA-Lib set) ---------------- */
  G = 'CANDLE PATTERNS';
  var cb0 = rows[i], cb1 = rows[i - 1], cb2 = rows[i - 2], cb3 = rows[i - 3];
  var bodyOf = function(b){ return Math.abs(b.c - b.o); }, rngOf = function(b){ return b.h - b.l; }, isUp = function(b){ return b.c > b.o; }, isDn = function(b){ return b.c < b.o; };
  var avgBody = 0; for (var ab = 1; ab <= 10; ab++) avgBody += bodyOf(rows[i - ab]); avgBody /= 10;
  var longBody = function(b){ return bodyOf(b) > 1.2 * avgBody; }, smallBody = function(b){ return bodyOf(b) < 0.5 * avgBody; }, dojiB = function(b){ return rngOf(b) > 0 && bodyOf(b) <= 0.1 * rngOf(b); };
  var upW = function(b){ return b.h - Math.max(b.o, b.c); }, dnW = function(b){ return Math.min(b.o, b.c) - b.l; };
  var trendUp = C[i - 1] > C[i - 6], trendDn = C[i - 1] < C[i - 6];
  var pat = function(id, name, v, why){ push(R(id, G, 'candle: ' + name, 'vote', v, v ? (v > 0 ? 'bullish' : 'bearish') : 'none', why)); };
  var abBaby = (dojiB(cb1) && isDn(cb2) && longBody(cb2) && cb1.h < cb2.l && isUp(cb0) && cb0.l > cb1.h) ? 1 : (dojiB(cb1) && isUp(cb2) && longBody(cb2) && cb1.l > cb2.h && isDn(cb0) && cb0.h < cb1.l) ? -1 : 0;
  pat('cdl_abandoned', 'abandoned baby', abBaby, 'a gapped doji island between two opposite long bodies');
  pat('cdl_advblock', 'advance block', (isUp(cb0) && isUp(cb1) && isUp(cb2) && cb0.c > cb1.c && cb1.c > cb2.c && bodyOf(cb0) < bodyOf(cb1) && bodyOf(cb1) < bodyOf(cb2) && upW(cb0) > bodyOf(cb0)) ? -1 : 0, 'three whites with shrinking bodies and a growing upper wick = the advance is tiring');
  push(R('cdl_doji', G, 'candle: doji', 'print', 0, dojiB(cb0) ? 'doji' : 'none', 'indecision — no side'));
  pat('cdl_gravestone', 'gravestone doji', (dojiB(cb0) && upW(cb0) > 0.6 * rngOf(cb0) && dnW(cb0) < 0.1 * rngOf(cb0) && trendUp) ? -1 : 0, 'a doji with the whole range above, after a rise');
  pat('cdl_dragonfly', 'dragonfly doji', (dojiB(cb0) && dnW(cb0) > 0.6 * rngOf(cb0) && upW(cb0) < 0.1 * rngOf(cb0) && trendDn) ? 1 : 0, 'a doji with the whole range below, after a fall');
  push(R('cdl_engulf_dup', G, 'candle: engulfing', 'print', 0, 'fed below', 'counted in STRUCTURE / HTF — never twice'));
  var star = (isDn(cb2) && longBody(cb2) && smallBody(cb1) && Math.max(cb1.o, cb1.c) < cb2.c && isUp(cb0) && cb0.c > (cb2.o + cb2.c) / 2) ? 1 : (isUp(cb2) && longBody(cb2) && smallBody(cb1) && Math.min(cb1.o, cb1.c) > cb2.c && isDn(cb0) && cb0.c < (cb2.o + cb2.c) / 2) ? -1 : 0;
  pat('cdl_star', 'morning / evening star', star, 'long body, a small star, then a close deep into the first body');
  var hammerShape = rngOf(cb0) > 0 && bodyOf(cb0) < 0.35 * rngOf(cb0) && dnW(cb0) >= 2 * bodyOf(cb0) && upW(cb0) <= 0.1 * rngOf(cb0);
  var invShape = rngOf(cb0) > 0 && bodyOf(cb0) < 0.35 * rngOf(cb0) && upW(cb0) >= 2 * bodyOf(cb0) && dnW(cb0) <= 0.1 * rngOf(cb0);
  pat('cdl_hammer', 'hammer', (hammerShape && trendDn) ? 1 : 0, 'a long lower wick after a fall');
  pat('cdl_hanging', 'hanging man', (hammerShape && trendUp) ? -1 : 0, 'the hammer shape after a rise');
  pat('cdl_invhammer', 'inverted hammer', (invShape && trendDn) ? 1 : 0, 'a long upper wick after a fall');
  var harami = (isDn(cb1) && longBody(cb1) && isUp(cb0) && cb0.o > cb1.c && cb0.c < cb1.o) ? 1 : (isUp(cb1) && longBody(cb1) && isDn(cb0) && cb0.o < cb1.c && cb0.c > cb1.o) ? -1 : 0;
  pat('cdl_harami', 'harami', harami, 'a small opposite body inside the prior long body');
  pat('cdl_haramicross', 'harami cross', (harami && dojiB(cb0)) ? harami : 0, 'a harami whose inside candle is a doji');
  var maru = function(b){ return rngOf(b) > 0 && bodyOf(b) >= 0.9 * rngOf(b); };
  pat('cdl_kicking', 'kicking', (maru(cb1) && isDn(cb1) && maru(cb0) && isUp(cb0) && cb0.o > cb1.o) ? 1 : (maru(cb1) && isUp(cb1) && maru(cb0) && isDn(cb0) && cb0.o < cb1.o) ? -1 : 0, 'two opposite marubozu with a gap between them');
  pat('cdl_marubozu', 'marubozu', maru(cb0) ? (isUp(cb0) ? 1 : -1) : 0, 'a full-range body with no wicks');
  var closingMaru = rngOf(cb0) > 0 && bodyOf(cb0) >= 0.7 * rngOf(cb0) && ((isUp(cb0) && upW(cb0) <= 0.03 * rngOf(cb0)) || (isDn(cb0) && dnW(cb0) <= 0.03 * rngOf(cb0)));
  pat('cdl_closingmaru', 'closing marubozu', closingMaru ? (isUp(cb0) ? 1 : -1) : 0, 'a long body closing at its extreme');
  pat('cdl_piercing', 'piercing / dark cloud', (isDn(cb1) && longBody(cb1) && isUp(cb0) && cb0.o < cb1.l && cb0.c > (cb1.o + cb1.c) / 2 && cb0.c < cb1.o) ? 1 : (isUp(cb1) && longBody(cb1) && isDn(cb0) && cb0.o > cb1.h && cb0.c < (cb1.o + cb1.c) / 2 && cb0.c > cb1.o) ? -1 : 0, 'an open beyond the prior range that closes past the prior midpoint');
  pat('cdl_shootingstar', 'shooting star', (invShape && trendUp) ? -1 : 0, 'a long upper wick after a rise');
  push(R('cdl_spinning', G, 'candle: spinning top', 'print', 0, (rngOf(cb0) > 0 && bodyOf(cb0) < 0.3 * rngOf(cb0) && upW(cb0) > bodyOf(cb0) && dnW(cb0) > bodyOf(cb0)) ? 'spinning top' : 'none', 'indecision — no side'));
  pat('cdl_3crows', 'three black crows', (isDn(cb0) && isDn(cb1) && isDn(cb2) && cb0.c < cb1.c && cb1.c < cb2.c && cb0.o < cb1.o && cb0.o > cb1.c && cb1.o < cb2.o && cb1.o > cb2.c && longBody(cb0) && longBody(cb1)) ? -1 : 0, 'three long blacks stepping down, each opening inside the prior body');
  pat('cdl_3soldiers', 'three white soldiers', (isUp(cb0) && isUp(cb1) && isUp(cb2) && cb0.c > cb1.c && cb1.c > cb2.c && cb0.o > cb1.o && cb0.o < cb1.c && cb1.o > cb2.o && cb1.o < cb2.c && longBody(cb0) && longBody(cb1)) ? 1 : 0, 'three long whites stepping up, each opening inside the prior body');
  pat('cdl_3linestrike', 'three-line strike', (isDn(cb3) && isDn(cb2) && isDn(cb1) && cb2.c < cb3.c && cb1.c < cb2.c && isUp(cb0) && cb0.o < cb1.c && cb0.c > cb3.o) ? 1 : (isUp(cb3) && isUp(cb2) && isUp(cb1) && cb2.c > cb3.c && cb1.c > cb2.c && isDn(cb0) && cb0.o > cb1.c && cb0.c < cb3.o) ? -1 : 0, 'three in a row then one bar that engulfs all three');

  /* ---------------- SESSION BOXES & BANDS ---------------- */
  G = 'SESSION BOXES / BANDS';
  var boxOf = function(h0, h1){ var day = Math.floor(rows[i].t / 86400), hi = -Infinity, lo = Infinity; for (var k = i; k >= 0 && Math.floor(rows[k].t / 86400) === day; k--){ var hr = Math.floor((rows[k].t % 86400) / 3600); if (hr >= h0 && hr < h1){ hi = Math.max(hi, rows[k].h); lo = Math.min(lo, rows[k].l); } } return (isFinite(hi) && hrNow >= h1) ? { hi: hi, lo: lo } : null; };
  var lbox = boxOf(7, 8);
  push(R('london_box', G, 'London breakout box (07–08 UTC)', 'vote', lbox ? (px > lbox.hi ? 1 : px < lbox.lo ? -1 : 0) : 0, lbox ? fmt(lbox.lo) + ' – ' + fmt(lbox.hi) : 'box forming / not today', 'a close outside the first London hour’s range, on that side'));
  var abox = boxOf(0, 7);
  push(R('asia_box', G, 'Asian session box breakout', 'vote', abox ? (px > abox.hi ? 1 : px < abox.lo ? -1 : 0) : 0, abox ? fmt(abox.lo) + ' – ' + fmt(abox.hi) : 'box forming', 'a close outside the Asia box, on that side (the sweep-reversal read is separate)'));
  var darvas = (function(){ var top = NaN, topAt = -1; for (var k = i - 3; k >= i - 40 && k >= 3; k--){ var isTop = true; for (var q2 = 1; q2 <= 3; q2++) if (rows[k + q2].h > rows[k].h) isTop = false; if (isTop){ top = rows[k].h; topAt = k; break; } } if (!isFinite(top)) return { v: 0 }; var bot = Infinity; for (var m = topAt; m <= i - 1; m++) bot = Math.min(bot, rows[m].l); return { v: px > top ? 1 : px < bot ? -1 : 0, top: top, bot: bot }; })();
  push(R('darvas', G, 'Darvas box', 'vote', darvas.v, isFinite(darvas.top) ? fmt(darvas.bot) + ' – ' + fmt(darvas.top) : 'none', 'a close outside a box whose top has held three bars'));
  push(R('atr_bands', G, 'ATR bands (SMA 20 ± 2 ATR)', 'vote', px > bbm + 2 * a14 ? 1 : px < bbm - 2 * a14 ? -1 : 0, fmt(bbm - 2 * a14) + ' – ' + fmt(bbm + 2 * a14), 'close outside the bands, on that side'));
  var starcM = last(sma(C, 6)), A15 = last(atr(rows, 15));
  push(R('starc', G, 'STARC bands (SMA 6 ± 2 ATR 15)', 'vote', px > starcM + 2 * A15 ? 1 : px < starcM - 2 * A15 ? -1 : 0, fmt(starcM - 2 * A15) + ' – ' + fmt(starcM + 2 * A15), 'close outside the channel, on that side'));
  var bbstop = (function(){ var dir = 0, mS = sma(C, 20), sS = stdev(C, 20); for (var k = 20; k < n; k++){ if (C[k] > mS[k] + 2 * sS[k]) dir = 1; else if (C[k] < mS[k] - 2 * sS[k]) dir = -1; } return dir; })();
  push(R('bbstop', G, 'B-Bands Stop', 'vote', bbstop, bbstop > 0 ? 'long side' : bbstop < 0 ? 'short side' : '—', 'the side of the last Bollinger band breach'));
  var jvb = (function(){ var dev = 0; for (var k = 0; k < 20; k++) dev += Math.pow(C[i - k] - jm, 2); dev = Math.sqrt(dev / 20); return { up: jm + 2 * dev, lo: jm - 2 * dev }; })();
  push(R('jvb', G, 'Jurik volatility bands (JMA ± 2σ)', 'vote', px > jvb.up ? 1 : px < jvb.lo ? -1 : 0, fmt(jvb.lo) + ' – ' + fmt(jvb.up), 'close outside the bands, on that side'));
  var tma = (function(){ var s1 = sma(C, 10); return last(sma(fill0(s1), 11)); })();
  push(R('tma', G, 'Extreme TMA line (triangular MA 20 ± 2 ATR)', 'vote', px > tma + 2 * a14 ? -1 : px < tma - 2 * a14 ? 1 : 0, fmt(tma - 2 * a14) + ' – ' + fmt(tma + 2 * a14), 'a touch of the outer TMA band = revert (a counter-trend read, by design)'));
  var dsma = (function(){ var zeros = C.map(function(x, k){ return k < 2 ? 0 : x - C[k - 2]; }), f = ssf(zeros, 40), out2 = C[0]; for (var k = 40; k < n; k++){ var rms = 0; for (var q2 = 0; q2 < 40; q2++) rms += f[k - q2] * f[k - q2]; rms = Math.sqrt(rms / 40); var sc = rms ? f[k] / rms : 0, al = Math.min(1, Math.abs(sc) * 5 / 40); out2 = al * C[k] + (1 - al) * out2; } return out2; })();
  push(R('dsma', G, 'Ehlers deviation-scaled MA 40', 'vote', vs(px, dsma), fmt(dsma), 'close above = long'));
  var hurst = (function(){ var N = 100, r2 = []; for (var k = i - N + 1; k <= i; k++) r2.push(Math.log(C[k] / C[k - 1])); var m = r2.reduce(function(a, b){ return a + b; }, 0) / N, dev = 0, cum = 0, mx = -Infinity, mn = Infinity; for (var q2 = 0; q2 < N; q2++){ cum += r2[q2] - m; mx = Math.max(mx, cum); mn = Math.min(mn, cum); dev += (r2[q2] - m) * (r2[q2] - m); } var sd2 = Math.sqrt(dev / N); return sd2 ? Math.log((mx - mn) / sd2) / Math.log(N) : 0.5; })();
  push(R('hurst', G, 'Hurst exponent (R/S, 100 bars)', 'regime', hurst < 0.45 ? -1 : hurst > 0.55 ? 1 : 0, fmt(hurst, 2), '<0.45 = mean-reverting (CHOP-like) · >0.55 = persistent; no side'));
  push(R('sylvester', G, 'Sylvester bands', 'n/a', 0, '—', 'no public formula — never approximated'));
  var zzc = (function(){ var pts = fr.hi.concat(fr.lo).sort(function(a, b){ return a.i - b.i; }).slice(-2); if (pts.length < 2 || pts[1].i === pts[0].i) return NaN; var sl = (pts[1].v - pts[0].v) / (pts[1].i - pts[0].i); return pts[1].v + sl * (i - pts[1].i); })();
  push(R('zz_channel', G, 'ZigZag autochannel (mid)', 'vote', isFinite(zzc) ? vs(px, zzc) : 0, fmt(zzc), 'close above the channel drawn through the last two pivots = long'));
  var wvf = (function(){ var a = [], hc = 0; for (var k = i - 60; k <= i; k++){ hc = -Infinity; for (var q2 = 0; q2 < 22; q2++) hc = Math.max(hc, C[k - q2]); a.push(100 * (hc - rows[k].l) / hc); } var m = a.slice(-20).reduce(function(x, y){ return x + y; }, 0) / 20, sd2 = 0; for (var z2 = a.length - 20; z2 < a.length; z2++) sd2 += Math.pow(a[z2] - m, 2); sd2 = Math.sqrt(sd2 / 20); return { v: a[a.length - 1], up: m + 2 * sd2 }; })();
  push(R('synth_vix', G, 'Synthetic VIX (Williams VIX Fix 22)', 'vote', wvf.v > wvf.up ? 1 : 0, fmt(wvf.v, 2) + ' / band ' + fmt(wvf.up, 2), 'fear spiking above its band = a capitulation low forming = long; otherwise neutral'));
  push(R('bands_dup', G, 'FCB · ATR stop · volatility stop · Chaikin vol · TDI · SuperTrend trailing', 'print', 0, 'fed above', 'counted elsewhere — never twice'));

  /* ---------------- SPECIALISED MOMENTUM ---------------- */
  G = 'SPECIALISED MOMENTUM';
  var vch = (function(){ var fl = last(sma(MD, 5)), rg = 0; for (var k = 0; k < 5; k++) rg += rows[i - k].h - rows[i - k].l; rg = 0.2 * rg / 5; return rg ? (px - fl) / rg : 0; })();
  push(R('valuechart', G, 'Value Chart 5', 'vote', vch > 8 ? -1 : vch < -8 ? 1 : 0, fmt(vch, 1), 'beyond ±8 = extreme, fade it (a counter-trend read, by design)'));
  var smieo = (function(){ var t = tsi(C, 5, 20), s2 = ema(fill0(t), 5); return { t: last(t), s: last(s2) }; })();
  push(R('smieo', G, 'SMI Ergodic Oscillator (TSI 5/20 · 5)', 'vote', vs(smieo.t, smieo.s), fmt(smieo.t, 2) + ' / ' + fmt(smieo.s, 2), 'ergodic above its signal = long'));
  var tsiA = tsi(C, 25, 13), tsiSig = ema(fill0(tsiA), 13);
  push(R('tsi_macd', G, 'TSI MACD (TSI 25/13 vs EMA 13)', 'vote', vs(last(tsiA), last(tsiSig)), fmt(last(tsiA), 2) + ' / ' + fmt(last(tsiSig), 2), 'TSI above its signal = long'));
  var pro = (function(){ var hh = hhll(rows, 20, i, true), ll = hhll(rows, 20, i, false); return hh > ll ? 100 * (px - ll) / (hh - ll) : 50; })();
  push(R('pro', G, 'Percentage Retracement Oscillator 20', 'vote', band(pro, 70, 30), fmt(pro, 0), '>70 = long · <30 = short (position in the 20-bar range)'));
  push(R('macd3', G, '3-Color MACD', 'print', 0, last(M.hist) >= at(M.hist, 1) ? 'brightening' : 'fading', 'identical information to the MACD histogram read — counted once'));
  var smacd = (function(){ var l2 = sma(C, 12).map(function(x, k){ return x - sma(C, 26)[k]; }), s2 = ema(fill0(l2), 9); return { l: last(l2), s: last(s2) }; })();
  push(R('sma_macd', G, 'EMA-to-SMA MACD 12,26,9', 'vote', vs(smacd.l, smacd.s), fmt(smacd.l, 3) + ' / ' + fmt(smacd.s, 3), 'SMA-based line above its signal = long'));
  var gio = a14 ? (px - last(rma(C, 14))) / a14 : 0;
  push(R('gioteen', G, 'Gioteen Norm 14', 'vote', band(gio, 0.5, -0.5), fmt(gio, 2), 'deviation from the RMA in ATRs beyond ±0.5'));
  var demand = (function(){ var bp = 0, sp = 0; for (var k = 0; k < 10; k++){ var r = rows[i - k], rg = r.h - r.l, d2 = r.c - (rows[i - k - 1] ? rows[i - k - 1].c : r.o); if (d2 > 0) bp += r.v * (rg ? d2 / rg : 1); else sp += r.v * (rg ? -d2 / rg : 1); } return (bp + sp) ? (bp - sp) / (bp + sp) : 0; })();
  push(R('demand_idx', G, 'Demand Index (Sibbet, simplified 10)', 'vote', band(demand, 0.1, -0.1), fmt(demand, 3), 'buying pressure over selling pressure beyond ±0.1'));
  var dwpr = wr - last(willr(rows, 28));
  push(R('delta_wpr', G, 'Delta WPR (14 − 28)', 'vote', band(dwpr, 10, -10), fmt(dwpr, 0), 'the fast %R leading the slow beyond ±10'));
  var wae = (function(){ var t1 = (last(M.line) - at(M.line, 1)) * 150, t0 = (at(M.line, 1) - at(M.line, 2)) * 150, e1 = bbu - bbl; return { up: t1 > 0 ? t1 : 0, dn: t1 < 0 ? -t1 : 0, e: e1, rising: Math.abs(t1) > Math.abs(t0) }; })();
  push(R('waddah', G, 'Waddah Attar Explosion', 'vote', (wae.up > wae.e && wae.rising) ? 1 : (wae.dn > wae.e && wae.rising) ? -1 : 0, fmt(Math.max(wae.up, wae.dn), 2) + ' / ' + fmt(wae.e, 2), 'the explosion bar above the Bollinger-width line, on its side'));
  var asoV = (function(){ var s2 = 0; for (var k = 0; k < 10; k++){ var r = rows[i - k], rg = r.h - r.l; s2 += rg ? ((r.c - r.l) / rg - 0.5) : 0; } return 100 * s2 / 10; })();
  push(R('aso', G, 'ASO (average sentiment oscillator 10)', 'vote', band(asoV, 10, -10), fmt(asoV, 1), 'bars closing high in their range beyond ±10'));
  var hoff = (rngOf(cb0) > 0 && dnW(cb0) >= 0.45 * rngOf(cb0)) ? 1 : (rngOf(cb0) > 0 && upW(cb0) >= 0.45 * rngOf(cb0)) ? -1 : 0;
  push(R('hoffman_irb', G, 'Hoffman inventory retracement bar', 'vote', hoff, hoff ? (hoff > 0 ? 'bull IRB' : 'bear IRB') : 'none', 'a wick of ≥45% of the range = inventory retraced on that side'));
  var trendMeter = (last(M.hist) > 0 ? 1 : -1) + (r14 > 50 ? 1 : -1) + (last(ema(C, 5)) > last(ema(C, 11)) ? 1 : -1);
  push(R('trendmeter', G, 'Trend Meter (MACD · RSI · EMA 5/11)', 'vote', trendMeter >= 3 ? 1 : trendMeter <= -3 ? -1 : 0, trendMeter > 0 ? '+' + trendMeter : String(trendMeter), 'all three lights one colour = that side'));
  var knn = (function(){ var rs = rsi(C, 14), feat = function(k){ return [rs[k] / 100, (C[k] - C[k - 5]) / C[k - 5] * 100, (rows[k].h - rows[k].l) / (A14[k] || 1)]; }, cur = feat(i), ds = []; for (var k = i - 100; k <= i - 4; k++){ if (k < 60) continue; var f = feat(k), d2 = 0; for (var q2 = 0; q2 < 3; q2++) d2 += Math.pow(f[q2] - cur[q2], 2); ds.push({ d: Math.sqrt(d2), y: sgn(C[k + 4] - C[k]) }); } ds.sort(function(a, b){ return a.d - b.d; }); var s2 = 0; for (var m = 0; m < Math.min(8, ds.length); m++) s2 += ds[m].y; return { v: ds.length >= 8 ? sgn(s2) : 0, s: s2 }; })();
  push(R('knn', G, 'KNN classifier (Euclidean, 8 neighbours, 4-bar label)', 'vote', knn.v, 'vote sum ' + knn.s + ' of 8', 'nearest past bars by RSI / 5-bar return / range-in-ATR; their 4-bar outcomes vote'));
  var lbSq = (function(){ var vals = []; for (var k = i - 19; k <= i; k++) vals.push(C[k] - (hhll(rows, 20, k, true) + hhll(rows, 20, k, false) + S20[k]) / 3); var lr = linreg(vals, 20); return { v: last(lr.end), p: at(lr.end, 1) }; })();
  push(R('lazybear_sqz', G, 'Squeeze Momentum (LazyBear) histogram', 'vote', (lbSq.v > 0 && lbSq.v >= lbSq.p) ? 1 : (lbSq.v < 0 && lbSq.v <= lbSq.p) ? -1 : 0, fmt(lbSq.v, 2), 'histogram positive and growing = long (the release read is separate)'));
  push(R('mom_dup', G, 'QQE Mod · Laguerre · CMO · ASH · CM_MacD · WaveTrend crosses · NWE · SuperTrend AI · HalfTrend · Trend Magic · Buy Sell Magic', 'print', 0, 'fed above', 'counted elsewhere — never twice'));

  /* ---------------- VOLUME SPREAD / NICHE FLOW ---------------- */
  G = 'VSA / NICHE FLOW';
  var vsa = (function(){ var vAvgL = vAvg || 1, rg = rngOf(cb0), rgAvg = 0; for (var k = 1; k <= 20; k++) rgAvg += rngOf(rows[i - k]); rgAvg /= 20; var pos = rg ? (cb0.c - cb0.l) / rg : 0.5, hiVol = cb0.v > 1.8 * vAvgL, wide = rg > 1.5 * rgAvg, narrow = rg < 0.6 * rgAvg; if (hiVol && wide && pos < 0.3 && trendUp) return { v: -1, txt: 'climax up' }; if (hiVol && wide && pos > 0.7 && trendDn) return { v: 1, txt: 'stopping volume' }; if (hiVol && narrow) return { v: 0, txt: 'churn' }; return { v: 0, txt: cb0.v < 0.6 * vAvgL ? 'low volume' : 'normal' }; })();
  push(R('better_volume', G, 'Better Volume (VSA)', 'vote', vsa.v, vsa.txt, 'climax up after a rise = short · stopping volume after a fall = long · churn = neutral'));
  push(R('tradeguider', G, 'TradeGuider VSA', 'n/a', 0, '—', 'proprietary — the public VSA logic is fed as Better Volume'));
  var bsv = (function(){ var b = 0, s2 = 0; for (var k = 0; k < 10; k++){ var r = rows[i - k], rg = r.h - r.l, bv = rg ? r.v * (r.c - r.l) / rg : r.v / 2; b += bv; s2 += r.v - bv; } return { b: b, s: s2 }; })();
  push(R('bsv', G, 'Buy Sell Volume 10', 'vote', vs(bsv.b, bsv.s * 1.1) > 0 ? 1 : vs(bsv.s, bsv.b * 1.1) > 0 ? -1 : 0, fmt(bsv.b, 0) + ' / ' + fmt(bsv.s, 0), 'one side ≥10% heavier over ten bars'));
  var wad = (function(){ var s2 = 0, a = [0]; for (var k = 1; k < n; k++){ var r = rows[k], pc = C[k - 1], trh = Math.max(r.h, pc), trl = Math.min(r.l, pc); s2 += r.c > pc ? r.c - trl : r.c < pc ? r.c - trh : 0; a[k] = s2; } return a; })();
  push(R('wad', G, 'Williams Accumulation/Distribution (10-bar slope)', 'vote', vs(last(wad), at(wad, 10)), fmt(last(wad), 2), 'rising = long'));
  var pfe = (function(){ var p = 10, a = []; for (var k = i - 10; k <= i; k++){ var num = Math.sqrt(Math.pow(C[k] - C[k - p], 2) + p * p), den = 0; for (var q2 = 0; q2 < p; q2++) den += Math.sqrt(Math.pow(C[k - q2] - C[k - q2 - 1], 2) + 1); a.push(den ? 100 * (C[k] > C[k - p] ? 1 : -1) * num / den : 0); } return last(ema(a, 5)); })();
  push(R('xpfe', G, 'Polarized Fractal Efficiency 10 (EMA 5)', 'vote', band(pfe, 20, -20), fmt(pfe, 0), 'efficient movement beyond ±20, on that side'));
  var svp = (function(){ var day = Math.floor(rows[i].t / 86400), lo = Infinity, hi = -Infinity, start = i; for (var k = i; k >= 0 && Math.floor(rows[k].t / 86400) === day; k--){ start = k; lo = Math.min(lo, rows[k].l); hi = Math.max(hi, rows[k].h); } if (!(hi > lo) || i - start < 8) return NaN; var bins = new Array(20).fill(0), w = (hi - lo) / 20; for (var k2 = start; k2 <= i; k2++){ var b = Math.min(19, Math.floor((rows[k2].c - lo) / w)); bins[b] += rows[k2].v; } var best = 0; for (var b2 = 1; b2 < 20; b2++) if (bins[b2] > bins[best]) best = b2; return lo + (best + 0.5) * w; })();
  push(R('svp', G, 'Session Volume Profile POC (UTC day)', 'vote', isFinite(svp) ? vs(px, svp) : 0, fmt(svp), 'close above today’s point of control = long'));
  var avwap = (function(){ var pv = 0, vv = 0; for (var k = anchor; k <= i; k++){ pv += hlc3[k] * rows[k].v; vv += rows[k].v; } return vv ? pv / vv : NaN; })();
  push(R('avwap', G, 'Anchored VWAP (from the last swing)', 'vote', isFinite(avwap) ? vs(px, avwap) : 0, fmt(avwap), 'close above the anchored VWAP = long'));
  var stopClusters = (function(){ var hs = fr.hi.slice(-6).map(function(p){ return p.v; }), ls = fr.lo.slice(-6).map(function(p){ return p.v; }); var above = hs.filter(function(v2){ return v2 > px; }).sort(function(a, b){ return a - b; })[0], below = ls.filter(function(v2){ return v2 < px; }).sort(function(a, b){ return b - a; })[0]; return { above: above, below: below }; })();
  push(R('liq_engine', G, 'Liquidity engine (nearest stop clusters)', 'print', 0, 'above ' + fmt(stopClusters.above) + ' · below ' + fmt(stopClusters.below), 'where resting stops cluster (swing extremes) — targets, not a side'));
  var rcp = (function(){ var dr2 = dayRanges(rows); if (dr2.length < 5) return NaN; var cur = dr2[dr2.length - 1], curR = cur.h - cur.l, arr = dr2.slice(0, -1).map(function(d){ return d.h - d.l; }).sort(function(a, b){ return a - b; }), below = arr.filter(function(x){ return x < curR; }).length; return 100 * below / arr.length; })();
  push(R('range_pct', G, 'Range compression percentile (today vs prior days)', 'regime', 0, fmt(rcp, 0) + 'th pct', 'a low percentile = expansion is due; no side'));
  var spike = rngOf(cb0) > 3 * a14;
  push(R('spike', G, 'Boom & Crash spike detector (bar > 3×ATR)', 'regime', spike ? -1 : 0, spike ? 'SPIKE' : 'none', 'a spike bar = disorderly regime; no side'));
  push(R('of_na', G, 'Footprint · MarketDelta · order-flow CVD/VWAP · tape reader · DOM heatmap · order book · Order Flow Ticks', 'n/a', 0, '—', 'all need executions or resting orders — no tape offline, never faked'));
  push(R('flow_dup', G, 'CVD · SVP/TPO · POC heatmap · EMV/EOM · liquidity voids · ICT killzones · Session Golden Hours · Gold Order Block Finder', 'print', 0, 'fed above', 'counted elsewhere — never twice'));

  /* ---------------- HARMONIC & WAVE PATTERNS ---------------- */
  G = 'HARMONICS';
  var harm = (function(){ var pts = fr.hi.map(function(p){ return { i: p.i, v: p.v, t: 'H' }; }).concat(fr.lo.map(function(p){ return { i: p.i, v: p.v, t: 'L' }; })).sort(function(a, b){ return a.i - b.i; }); var alt = []; for (var k = 0; k < pts.length; k++){ if (!alt.length || alt[alt.length - 1].t !== pts[k].t) alt.push(pts[k]); else if ((pts[k].t === 'H' && pts[k].v > alt[alt.length - 1].v) || (pts[k].t === 'L' && pts[k].v < alt[alt.length - 1].v)) alt[alt.length - 1] = pts[k]; } if (alt.length < 5) return null; var X = alt[alt.length - 5], A = alt[alt.length - 4], B = alt[alt.length - 3], Cc = alt[alt.length - 2], Dd = alt[alt.length - 1]; var XA = Math.abs(A.v - X.v), AB = Math.abs(B.v - A.v), BC = Math.abs(Cc.v - B.v), CD = Math.abs(Dd.v - Cc.v), AD = Math.abs(Dd.v - A.v), XC = Math.abs(Cc.v - X.v); if (!XA || !AB || !BC) return null; var near = Math.abs(px - Dd.v) <= 0.5 * a14, bull = Dd.t === 'L'; return { ab: AB / XA, bc: BC / AB, cd: CD / BC, ad: AD / XA, cdxc: CD / XC, bcxa: BC / XA, near: near, dir: bull ? 1 : -1, X: X, A: A, B: B, C: Cc, D: Dd }; })();
  var inR = function(x, lo, hi){ return x >= lo * 0.92 && x <= hi * 1.08; };
  var hv = function(ok){ return (harm && harm.near && ok) ? harm.dir : 0; };
  var hread = harm ? 'AB ' + fmt(harm.ab, 2) + ' · BC ' + fmt(harm.bc, 2) + ' · CD ' + fmt(harm.cd, 2) + ' · AD ' + fmt(harm.ad, 2) : 'fewer than 5 swings';
  push(R('gartley', G, 'Gartley', 'vote', hv(harm && inR(harm.ab, 0.618, 0.618) && inR(harm.bc, 0.382, 0.886) && inR(harm.ad, 0.786, 0.786)), hread, 'AB 0.618 · BC 0.382–0.886 · D at 0.786 of XA, price at D'));
  push(R('bat', G, 'Bat', 'vote', hv(harm && inR(harm.ab, 0.382, 0.5) && inR(harm.bc, 0.382, 0.886) && inR(harm.ad, 0.886, 0.886)), hread, 'AB 0.382–0.5 · D at 0.886 of XA'));
  push(R('butterfly', G, 'Butterfly', 'vote', hv(harm && inR(harm.ab, 0.786, 0.786) && inR(harm.bc, 0.382, 0.886) && inR(harm.ad, 1.27, 1.618)), hread, 'AB 0.786 · D at 1.27–1.618 of XA'));
  push(R('crab', G, 'Crab / Deep Crab', 'vote', hv(harm && (inR(harm.ab, 0.382, 0.618) || inR(harm.ab, 0.886, 0.886)) && inR(harm.bc, 0.382, 0.886) && inR(harm.ad, 1.618, 1.618)), hread, 'D at 1.618 of XA'));
  push(R('cypher', G, 'Cypher', 'vote', hv(harm && inR(harm.ab, 0.382, 0.618) && inR(harm.bcxa, 1.13, 1.414) && inR(harm.cdxc, 0.786, 0.786)), hread, 'C beyond A (1.13–1.414 of XA) · D at 0.786 of XC'));
  push(R('shark', G, 'Shark', 'vote', hv(harm && inR(harm.ab, 0.446, 0.618) && inR(harm.bcxa, 1.13, 1.618) && inR(harm.ad, 0.886, 1.13)), hread, 'C beyond A · D at 0.886–1.13 of XA'));
  var wolfe = (function(){ if (!harm) return 0; var p1 = harm.X, p3 = harm.B, p5 = harm.D; if (p1.t !== p5.t || p3.t !== p5.t) return 0; var sl = (p3.v - p1.v) / (p3.i - p1.i), line5 = p3.v + sl * (p5.i - p3.i); if (p5.t === 'L' && p5.v < line5 && p5.v < p3.v && p3.v < p1.v && harm.near) return 1; if (p5.t === 'H' && p5.v > line5 && p5.v > p3.v && p3.v > p1.v && harm.near) return -1; return 0; })();
  push(R('wolfe', G, 'Wolfe Wave', 'vote', wolfe, wolfe ? (wolfe > 0 ? 'bullish (5 below the 1–3 line)' : 'bearish (5 above the 1–3 line)') : 'none', 'point 5 overshooting the 1–3 trendline = the wave, target the 1–4 line'));
  push(R('harm_dup', G, 'ZUP · Korah · auto-harmonic · Harmonic V5 filter', 'print', 0, 'the six patterns above', 'pattern scanners — the same XABCD ratios, counted once each'));

  /* ---------------- ICT (continued) ---------------- */
  G = 'ICT (CONTINUED)';
  var crt = (isDn(cb1) === false && cb1.l < cb2.l && cb1.c > cb2.l && cb0.c > cb2.l && cb0.c > cb1.c) ? 1 : (cb1.h > cb2.h && cb1.c < cb2.h && cb0.c < cb2.h && cb0.c < cb1.c) ? -1 : 0;
  push(R('crt', G, 'CRT (candle range theory)', 'vote', crt, crt ? (crt > 0 ? 'low swept, distributing up' : 'high swept, distributing down') : 'none', 'range bar → sweep of one side → close back inside and distribution the other way'));
  var goldenPocket = (function(){ if (!swings.H.length || !swings.L.length) return { v: 0 }; var Hh = swings.H[swings.H.length - 1], Ll = swings.L[swings.L.length - 1]; if (Ll.i < Hh.i){ var leg = Hh.v - Ll.v; return { v: (px >= Hh.v - 0.618 * leg && px <= Hh.v - 0.5 * leg) ? 1 : 0, lo: Hh.v - 0.618 * leg, hi: Hh.v - 0.5 * leg }; } var leg2 = Hh.v - Ll.v; return { v: (px >= Ll.v + 0.5 * leg2 && px <= Ll.v + 0.618 * leg2) ? -1 : 0, lo: Ll.v + 0.5 * leg2, hi: Ll.v + 0.618 * leg2 }; })();
  push(R('golden_fib', G, 'Auto Fibonacci golden pocket (0.5–0.618)', 'vote', goldenPocket.v, isFinite(goldenPocket.lo) ? fmt(goldenPocket.lo) + ' – ' + fmt(goldenPocket.hi) : 'no leg', 'price inside the golden pocket of the last leg, on the leg’s side'));
  var msnr = (rows1h && rows1h.length >= 60) ? (function(){ var f1 = fractals(rows1h.slice(0, rows1h.length - 1), 2), h2 = f1.hi.length ? f1.hi[f1.hi.length - 1].v : NaN, l2 = f1.lo.length ? f1.lo[f1.lo.length - 1].v : NaN; return { v: (isFinite(h2) && px > h2) ? 1 : (isFinite(l2) && px < l2) ? -1 : 0, h: h2, l: l2 }; })() : { v: 0 };
  push(R('msnr', G, 'MSNR key levels (1H swing S/R)', 'vote', msnr.v, isFinite(msnr.h) ? 'R ' + fmt(msnr.h) + ' · S ' + fmt(msnr.l) : '—', 'a 15m close through the last 1H swing level, on that side'));
  push(R('smart_tracker', G, 'SMART (session FVG retest tracker)', 'print', 0, fv ? 'FVG retest live' : 'none', 'identical information to the FVG read — counted once'));
  push(R('ict_dup2', G, 'EQH/EQL FVG breakouts · MSS sweeps · No-wick retest · Asia sweep · Value Area reversion · HTF stochastic buckets · Wejoy golden candle fib', 'print', 0, 'fed above', 'counted elsewhere — never twice'));

  /* ---------------- INTERMARKET / MACRO ---------------- */
  G = 'INTERMARKET';
  push(R('im_gsr', G, 'Gold/Silver ratio', 'n/a', 0, '—', 'needs the silver series — not fed to the vote; the GOLD tabs carry it live'));
  push(R('im_dxy', G, 'DXY correlation', 'n/a', 0, '—', 'needs the dollar index series'));
  push(R('im_us10y', G, 'US 10Y yield overlay', 'n/a', 0, '—', 'needs the yield series'));
  push(R('im_real', G, 'Real yields / TIPS spread', 'n/a', 0, '—', 'needs the TIPS series'));
  push(R('im_vix', G, 'VIX correlation', 'n/a', 0, '—', 'needs the VIX series'));
  push(R('im_cot', G, 'COT net positioning (gold futures)', 'n/a', 0, '—', 'weekly CFTC data — not a 15m read'));
  push(R('im_oil', G, 'Gold/Oil ratio', 'n/a', 0, '—', 'needs the crude series'));
  push(R('im_spx', G, 'S&P 500 / Gold ratio', 'n/a', 0, '—', 'needs the index series'));
  push(R('im_ccfp', G, 'CCFP currency power', 'n/a', 0, '—', 'needs a basket of pairs'));

  /* ---------------- RECENT MQL5 / NINJATRADER / TV FRAMEWORKS ---------------- */
  G = 'MQL5 / NINJA / TV FRAMEWORKS';
  var e10 = last(ema(C, 10)), ribbon = (e10 > last(e21) && last(e21) > last(e50) && last(e50) > last(e200)) ? 1 : (e10 < last(e21) && last(e21) < last(e50) && last(e50) < last(e200)) ? -1 : 0;
  push(R('ema_ribbon', G, 'EMA Ribbon XAUUSD Matrix (10/21/50/200)', 'vote', ribbon, ribbon ? 'stacked' : 'mixed', 'the four-EMA stack fully ordered one way'));
  push(R('atr_targets', G, 'Dynamic ATR target bands (1.5× / 2×)', 'print', 0, '±' + fmt(1.5 * a14) + ' / ±' + fmt(2 * a14), 'projected targets from the close — sizing, not a side'));
  var imacd = (function(){ var hi = rma(rows.map(function(r){ return r.h; }), 34), lo = rma(rows.map(function(r){ return r.l; }), 34), zl2 = ema(hlc3.map(function(x, k){ return k < 17 ? x : 2 * x - hlc3[k - 17]; }), 34), mi = zl2.map(function(x, k){ return x > hi[k] ? x - hi[k] : x < lo[k] ? x - lo[k] : 0; }), sig = sma(fill0(mi), 9); return { v: last(mi), s: last(sig) }; })();
  push(R('impulse_macd', G, 'Impulse MACD (LazyBear, 34 / 9)', 'vote', imacd.v > 0 && imacd.v > imacd.s ? 1 : imacd.v < 0 && imacd.v < imacd.s ? -1 : 0, fmt(imacd.v, 3) + ' / ' + fmt(imacd.s, 3), 'zero inside the SMMA high/low band (the whipsaw filter); outside it, on that side'));
  var hdiv = (function(){ var rs = rsi(C, 14), lows = fr.lo.slice(-2), highs = fr.hi.slice(-2), v2 = 0; if (lows.length === 2 && lows[1].v > lows[0].v && rs[lows[1].i] < rs[lows[0].i] && i - lows[1].i <= 6) v2 = 1; if (highs.length === 2 && highs[1].v < highs[0].v && rs[highs[1].i] > rs[highs[0].i] && i - highs[1].i <= 6) v2 = -1; return v2; })();
  push(R('hidden_div', G, 'Hidden divergence (RSI 14 vs fractal swings)', 'vote', hdiv, hdiv ? (hdiv > 0 ? 'bullish hidden' : 'bearish hidden') : 'none', 'price higher low with RSI lower low = continuation up (mirrored for shorts)'));
  var twc = (function(){ var up = 0, dn = 0; for (var k = 0; k < 10; k++){ var r = rows[i - k]; if (r.c > r.o) up += r.v; else if (r.c < r.o) dn += r.v; } return dn ? up / dn : (up ? 9 : 1); })();
  push(R('twc_ratio', G, 'TWC volume ratio (up/down, 10)', 'vote', twc > 1.25 ? 1 : twc < 0.8 ? -1 : 0, fmt(twc, 2), 'up-bar volume over down-bar volume beyond 1.25 / under 0.8'));
  push(R('trend_slope_delta', G, 'Trend Slope Delta Movement (TFLAB)', 'print', 0, fmt(ang, 1) + '°', 'identical information to the regression angle — counted once'));
  push(R('sessions7', G, '7 Market Sessions & Hours', 'print', 0, kz || 'outside the three killzones', 'session clock — context only'));
  push(R('candle_time', G, 'Candle Time', 'print', 0, 'closed bar (0:00 to close)', 'this desk reads closed bars only; the forming bar is never read'));
  push(R('autoclimate', G, 'AutoClimate statistical environment', 'print', 0, 'Hurst ' + fmt(hurst, 2) + ' · chop ' + fmt(chop, 0) + ' · ADX ' + fmt(adxv, 0), 'the regime reads, restated — counted once, in the REGIME gate'));
  push(R('smt_div', G, 'SMT double divergence', 'n/a', 0, '—', 'needs a correlated second series (silver / DXY) — never faked'));
  push(R('recent_na', G, 'Super Arrow · ScalpHunterPro · Intentional Trader RockStar · Orion Protocol / Order Flow · Daily Bias Pro · Money In/Out · ICT Liquidity Pool AI · Gold Signal Swing Pro · Gold Trader Pro · Gold Signal 15m', 'n/a', 0, '—', 'proprietary / undocumented — never approximated'));
  push(R('tools_na', G, 'Prop Firm Capital Protection · Break Even indicator · Binary Options screener · COT Display · Footprint Price Action / Orderflow · Volume Profile Pro (NT8)', 'n/a', 0, '—', 'account tools, tape tools or other markets — not a 15m gold read'));
  push(R('recent_dup', G, 'Session Box · Mean Reversion EA (z-score) · VW-MACD · LazyBear squeeze · SuperTrend trailing · NWE · SVP · TPO · CVD · value area · liquidity voids · no-wick · HTF stochastic · MSS · EQH/EQL FVG', 'print', 0, 'fed above', 'counted elsewhere — never twice'));

  /* ---------------- MT SYSTEMS / TV COMMUNITY (tier 6) ---------------- */
  G = 'MT SYSTEMS / TV COMMUNITY';
  var cci6 = last(cci(rows, 6));
  push(R('woodies', G, 'Woodies CCI (14 + turbo 6, chop zone)', 'vote', (last(cci14) > 100 && cci6 > 100) ? 1 : (last(cci14) < -100 && cci6 < -100) ? -1 : 0, fmt(last(cci14), 0) + ' / ' + fmt(cci6, 0), 'both CCIs beyond ±100 on one side; inside ±100 = chop zone, neutral'));
  push(R('adhl', G, 'Auto Day High/Low (prior day)', 'vote', pd ? (px > pd.h ? 1 : px < pd.l ? -1 : 0) : 0, pd ? fmt(pd.l) + ' – ' + fmt(pd.h) : '—', 'a close beyond yesterday’s high / low, on that side'));
  var tlb = (function(){ var hs = fr.hi.slice(-2), ls = fr.lo.slice(-2), v2 = 0, txt = ''; if (hs.length === 2 && hs[1].i > hs[0].i){ var sl = (hs[1].v - hs[0].v) / (hs[1].i - hs[0].i), line = hs[1].v + sl * (i - hs[1].i); txt += 'R ' + fmt(line); if (px > line) v2 = 1; } if (ls.length === 2 && ls[1].i > ls[0].i){ var sl2 = (ls[1].v - ls[0].v) / (ls[1].i - ls[0].i), line2 = ls[1].v + sl2 * (i - ls[1].i); txt += (txt ? ' · ' : '') + 'S ' + fmt(line2); if (px < line2) v2 = v2 === 1 ? 0 : -1; } return { v: v2, txt: txt || 'no lines' }; })();
  push(R('trendlines', G, 'Trendlines with Breaks (LuxAlgo-style, pivot lines)', 'vote', tlb.v, tlb.txt, 'a close through the trendline drawn on the last two pivot highs (long) / lows (short)'));
  var alpha = (function(){ var A2 = atr(rows, 14), mf = mfi(rows, 14), at2 = nanArr(n); for (var k = 14; k < n; k++){ var upT = rows[k].l - A2[k], dnT = rows[k].h + A2[k], p = isFinite(at2[k - 1]) ? at2[k - 1] : upT; at2[k] = (mf[k] >= 50) ? Math.max(upT, p) : Math.min(dnT, p); } return { v: last(at2), p2: at(at2, 2) }; })();
  push(R('alphatrend', G, 'AlphaTrend (ATR 14 · MFI filter)', 'vote', vs(alpha.v, alpha.p2), fmt(alpha.v), 'the line rising over two bars = long'));
  var ott = (function(){ var ma = ema(C, 2), pct2 = 0.014, ls = nanArr(n), dir = 1, o = nanArr(n); for (var k = 1; k < n; k++){ var m = ma[k]; if (!isFinite(m)) continue; var up = m * (1 - pct2), dn = m * (1 + pct2); up = (isFinite(ls[k - 1]) && m > ls[k - 1] && dir === 1) ? Math.max(up, ls[k - 1]) : up; dn = (isFinite(ls[k - 1]) && m < ls[k - 1] && dir === -1) ? Math.min(dn, ls[k - 1]) : dn; if (dir === 1 && m < up) dir = -1; else if (dir === -1 && m > dn) dir = 1; ls[k] = dir === 1 ? up : dn; o[k] = dir === 1 ? ls[k] * (1 + pct2 / 2) : ls[k] * (1 - pct2 / 2); } return { ma: last(ma), o: last(o) }; })();
  push(R('ott', G, 'Optimized Trend Tracker (2, 1.4%)', 'vote', vs(ott.ma, ott.o), fmt(ott.ma) + ' / ' + fmt(ott.o), 'the fast MA above the OTT line = long'));
  var rfilt = function(p, mult){ var wper = 2 * p - 1, ar = ema(C.map(function(x, k){ return k ? Math.abs(x - C[k - 1]) : 0; }), p), sr = ema(fill0(ar), wper).map(function(x){ return x * mult; }), f = nanArr(n), upc = 0, dnc = 0; for (var k = 0; k < n; k++){ var r2 = isFinite(sr[k]) ? sr[k] : 0, p2 = isFinite(f[k - 1]) ? f[k - 1] : C[k]; f[k] = C[k] > p2 ? (C[k] - r2 < p2 ? p2 : C[k] - r2) : (C[k] + r2 > p2 ? p2 : C[k] + r2); if (f[k] > p2){ upc++; dnc = 0; } else if (f[k] < p2){ dnc++; upc = 0; } } return { f: last(f), up: upc, dn: dnc }; };
  var rf1 = rfilt(27, 1.6), rf2 = rfilt(55, 2), rfv = (px > rf1.f && rf1.up > 0 && px > rf2.f) ? 1 : (px < rf1.f && rf1.dn > 0 && px < rf2.f) ? -1 : 0;
  push(R('twin_range', G, 'Twin Range Filter (27/1.6 · 55/2)', 'vote', rfv, fmt(rf1.f) + ' / ' + fmt(rf2.f), 'price above both filters with the fast one rising = long'));
  var rf3 = rfilt(100, 3);
  push(R('range_filter', G, 'Range Filter Buy/Sell (100 · 3)', 'vote', (px > rf3.f && rf3.up > 0) ? 1 : (px < rf3.f && rf3.dn > 0) ? -1 : 0, fmt(rf3.f), 'price above a rising filter = long'));
  var h55 = hma(C, 55);
  push(R('hull_suite', G, 'Hull Suite (HMA 55)', 'vote', slopeVote(h55, 2, 0.00005), fmt(last(h55)), 'the Hull turning up = long'));
  push(R('knn_strategy', G, 'ML kNN Strategy Classifier (Capissimo)', 'print', 0, 'vote sum ' + knn.s, 'identical method to the KNN read — counted once'));
  var nb = (function(){ var rs = rsi(C, 14), feat = function(k){ return [rs[k] > 50 ? 1 : 0, M.hist[k] > 0 ? 1 : 0, C[k] > S20[k] ? 1 : 0]; }, cnt = { up: 1, dn: 1 }, f1 = { up: [1, 1, 1], dn: [1, 1, 1] }; for (var k = i - 100; k <= i - 4; k++){ if (k < 60) continue; var y = C[k + 4] > C[k] ? 'up' : 'dn', f = feat(k); cnt[y]++; for (var q2 = 0; q2 < 3; q2++) if (f[q2]) f1[y][q2]++; } var cur = feat(i), pu = cnt.up / (cnt.up + cnt.dn), pdn = 1 - pu; for (var q3 = 0; q3 < 3; q3++){ var lu = f1.up[q3] / cnt.up, ld = f1.dn[q3] / cnt.dn; pu *= cur[q3] ? lu : 1 - lu; pdn *= cur[q3] ? ld : 1 - ld; } var p = pu / (pu + pdn); return { p: p, v: p > 0.6 ? 1 : p < 0.4 ? -1 : 0 }; })();
  push(R('naive_bayes', G, 'ML Naive Bayes classifier (3 binary features, 4-bar label)', 'vote', nb.v, 'P(up) ' + fmt(nb.p, 2), 'posterior beyond 0.6 / 0.4 from the last 100 labelled bars'));
  var lrc11 = (function(){ var lo2 = linreg(rows.map(function(r){ return r.o; }), 11), lc2 = linreg(C, 11); return { o: last(lo2.end), c: last(lc2.end) }; })();
  push(R('lr_candles', G, 'Linear Regression Candles 11', 'vote', vs(lrc11.c, lrc11.o), fmt(lrc11.o) + ' → ' + fmt(lrc11.c), 'a green regression candle = long'));
  var madrid = (function(){ var ups = 0, dns = 0; for (var p = 5; p <= 85; p += 5){ var a = last(ema(C, p)), b = last(ema(C, p + 5)); if (a > b) ups++; else if (a < b) dns++; } return { u: ups, d: dns }; })();
  push(R('madrid', G, 'Madrid Trend Squeezer (EMA 5…90 ribbon)', 'vote', madrid.u >= 16 ? 1 : madrid.d >= 16 ? -1 : 0, madrid.u + ' up / ' + madrid.d + ' down of 17', 'the whole ribbon ordered one way'));
  var coral = t3(C, 21, 0.4);
  push(R('coral', G, 'Coral Trend (T3 21, 0.4)', 'vote', slopeVote(coral, 1, 0.00002), fmt(last(coral)), 'the coral line rising = long'));
  var ppst = (function(){ var ctr = (isFinite(fH) && isFinite(fL)) ? (fH + fL) / 2 : NaN; if (!isFinite(ctr)) return 0; var up = ctr - 3 * a14, dn = ctr + 3 * a14; return px > dn ? 1 : px < up ? -1 : (px > ctr ? 1 : -1); })();
  push(R('pp_supertrend', G, 'Pivot Point SuperTrend (factor 3)', 'vote', ppst, ppst > 0 ? 'above the pivot centre' : ppst < 0 ? 'below the pivot centre' : '—', 'price relative to the pivot-centred ATR band'));
  var vfi = (function(){ var tp = hlc3, inter = tp.map(function(x, k){ return k ? Math.log(x) - Math.log(tp[k - 1]) : 0; }), vst = stdev(inter, 30), vave = sma(VOL, 30), out2 = nanArr(n); for (var k = 60; k < n; k++){ var s2 = 0; for (var q2 = 0; q2 < 30; q2++){ var kk = k - q2, cutoff = 0.2 * vst[kk] * C[kk], vc = Math.min(VOL[kk], 2.5 * vave[kk]), mf = tp[kk] - tp[kk - 1]; s2 += mf > cutoff ? vc : mf < -cutoff ? -vc : 0; } out2[k] = vave[k] ? s2 / vave[k] : 0; } return last(ema(fill0(out2), 3)); })();
  push(R('vfi', G, 'Volume Flow Indicator 30 (Katsanos)', 'vote', sgn(vfi), fmt(vfi, 2), 'positive = long'));
  var twiggs = (function(){ var num = 0, den = 0, a1 = 1 / 21; for (var k = 21; k < n; k++){ var r = rows[k], pc = C[k - 1], trh = Math.max(r.h, pc), trl = Math.min(r.l, pc), rg = trh - trl, adv = rg ? ((r.c - trl) - (trh - r.c)) / rg * r.v : 0; num = num + (adv - num) * a1; den = den + (r.v - den) * a1; } return den ? num / den : 0; })();
  push(R('twiggs', G, 'Twiggs Money Flow 21', 'vote', band(twiggs, 0.05, -0.05), fmt(twiggs, 3), 'beyond ±0.05'));
  push(R('tier6_dup', G, 'SMC (LuxAlgo) · Order Block Detector · SSL Hybrid · Williams VIX Fix · TDI Synergy · Spike Detector · B-Clock · Gann HiLo (= SSL) · Volume by Price · GMMA oscillator · Chaikin volatility · MotiveWave harmonics', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier6_na', G, 'Gold Signal Pro Scalp · AI Zone Radar · Forex Hacked Pro · Solar Winds Joy · Genesis Matrix · Symphonie Matrix · Modified Price Projector · Elliott Wave auto-analyser', 'n/a', 0, '—', 'proprietary / undocumented — never approximated'));

  /* ---------------- EHLERS (tier 6) ---------------- */
  G = 'EHLERS (CONTINUED)';
  var jdmx = last(ssf(fill0(D.pdi.map(function(x, k){ return x - D.mdi[k]; })), 10));
  push(R('jdmx', G, 'Jurik-smoothed DMX (+DI − −DI, super-smoothed 10)', 'vote', band(jdmx, 5, -5), fmt(jdmx, 1), 'beyond ±5'));
  push(R('aema', G, 'Adaptive EMA (efficiency-ratio alpha)', 'print', 0, fmt(ka), 'identical construction to KAMA — counted once'));
  var bpf = (function(){ var p = 20, dl = 0.3, beta = Math.cos(2 * Math.PI / p), gamma = 1 / Math.cos(4 * Math.PI * dl / p), al = gamma - Math.sqrt(gamma * gamma - 1), bp = nanArr(n); for (var k = 0; k < n; k++) bp[k] = k < 2 ? 0 : 0.5 * (1 - al) * (C[k] - C[k - 2]) + beta * (1 + al) * bp[k - 1] - al * bp[k - 2]; return bp; })();
  push(R('bandpass', G, 'Bandpass filter (20, 0.3)', 'vote', (last(bpf) > 0 && last(bpf) >= at(bpf, 1)) ? 1 : (last(bpf) < 0 && last(bpf) <= at(bpf, 1)) ? -1 : 0, fmt(last(bpf), 3), 'positive and rising = long'));
  var scc = (function(){ var hh = -Infinity, ll = Infinity; for (var k = 0; k < 20; k++){ hh = Math.max(hh, cyc[i - k]); ll = Math.min(ll, cyc[i - k]); } return hh > ll ? (last(cyc) - ll) / (hh - ll) : 0.5; })();
  push(R('stoch_cc', G, 'Stochastic CyberCycle 20', 'vote', scc > 0.8 ? -1 : scc < 0.2 ? 1 : 0, fmt(scc, 2), 'beyond 0.8 / 0.2 = the cycle turn (a counter-trend read, by design)'));
  var eot = (function(){ var q = ssf(fill0(roof.map(function(x){ return x; })), 10), pk = 0, out2 = 0; for (var k = 60; k < n; k++){ pk = 0.991 * pk; if (Math.abs(q[k]) > pk) pk = Math.abs(q[k]); var x = pk ? q[k] / pk : 0; out2 = (x + 0.85) / (0.85 * x + 1); } return out2; })();
  push(R('eot', G, 'Early Onset Trend (K 0.85)', 'vote', band(eot, 0.2, -0.2), fmt(eot, 2), 'beyond ±0.2'));
  var ebsw = (function(){ var a1 = (Math.cos(0.707 * 2 * Math.PI / 40) + Math.sin(0.707 * 2 * Math.PI / 40) - 1) / Math.cos(0.707 * 2 * Math.PI / 40), hp = nanArr(n); for (var k = 0; k < n; k++) hp[k] = k < 2 ? 0 : (1 - a1 / 2) * (C[k] - C[k - 1]) + (1 - a1) * hp[k - 1]; var f = ssf(hp, 10), wave = (f[i] + f[i - 1] + f[i - 2]) / 3, pwr = (f[i] * f[i] + f[i - 1] * f[i - 1] + f[i - 2] * f[i - 2]) / 3; return pwr ? wave / Math.sqrt(pwr) : 0; })();
  push(R('ebsw', G, 'Even Better Sinewave (40 / 10)', 'vote', band(ebsw, 0.3, -0.3), fmt(ebsw, 2), 'beyond ±0.3'));
  var acg = (function(){ var p = Math.max(5, Math.round(last(HT.speriod) / 2)), num = 0, den = 0, num1 = 0, den1 = 0; for (var j = 0; j < p; j++){ num += (j + 1) * C[i - j]; den += C[i - j]; num1 += (j + 1) * C[i - 1 - j]; den1 += C[i - 1 - j]; } var a = den ? -num / den : 0, b = den1 ? -num1 / den1 : 0; return { v: a, p: b, len: p }; })();
  push(R('adaptive_cg', G, 'Adaptive Center of Gravity (½ dominant cycle = ' + acg.len + ')', 'vote', vs(acg.v, acg.p), fmt(acg.v, 3), 'rising = long'));
  var frsi = (function(){ var r10 = rsi(C, 10), x = 0.1 * (last(r10) - 50); x = Math.max(-0.999, Math.min(0.999, x)); return 0.5 * Math.log((1 + x) / (1 - x)); })();
  push(R('fisherized_rsi', G, 'Fisherized RSI 10', 'vote', band(frsi, 0.5, -0.5), fmt(frsi, 2), 'beyond ±0.5'));
  var uni = (function(){ var wn = C.map(function(x, k){ return k ? (x - C[k - 1]) / 2 : 0; }), f = ssf(wn, 20), rms = 0; for (var k = 0; k < 100; k++) rms += f[i - k] * f[i - k]; rms = Math.sqrt(rms / 100); return rms ? f[i] / rms : 0; })();
  push(R('universal_osc', G, 'Universal Oscillator 20', 'vote', band(uni, 0.5, -0.5), fmt(uni, 2), 'beyond ±0.5'));
  var tflex = (function(){ var f = ssf(C, 10), s2 = 0; for (var k = 1; k <= 20; k++) s2 += f[i] - f[i - k]; s2 /= 20; var ms = 0; for (var q2 = 0; q2 < 50; q2++){ var s3 = 0; for (var k2 = 1; k2 <= 20; k2++) s3 += f[i - q2] - f[i - q2 - k2]; s3 /= 20; ms += s3 * s3; } ms = Math.sqrt(ms / 50); return ms ? s2 / ms : 0; })();
  push(R('trendflex', G, 'Trendflex 20', 'vote', band(tflex, 0.5, -0.5), fmt(tflex, 2), 'beyond ±0.5'));
  push(R('ehlers6_dup', G, 'Jurik filter · MESA sinewave · lead/real sine · EMD oscillator · Decycler II · HT dominant cycle', 'print', 0, 'fed above', 'counted elsewhere — never twice'));

  /* ---------------- GEOMETRIC / MATH (tier 6) ---------------- */
  G = 'GEOMETRIC / MATH';
  var gann = (function(){ var lows = fr.lo.slice(-1)[0], highs = fr.hi.slice(-1)[0]; if (!lows || !highs) return { v: 0 }; var useLow = lows.i > highs.i, base = useLow ? lows : highs, unit = a14 / 2, line = useLow ? base.v + unit * (i - base.i) : base.v - unit * (i - base.i); return { v: useLow ? (px > line ? 1 : -1) : (px < line ? -1 : 1), line: line }; })();
  push(R('gann_fan', G, 'Gann fan 1×1 (½ ATR per bar from the last pivot)', 'vote', gann.v, fmt(gann.line), 'price holding above the 1×1 from the last low = long (mirrored from a high)'));
  var mml = (function(){ var hh = hhll(rows, 64, i, true), ll = hhll(rows, 64, i, false), oct = (hh - ll) / 8; if (!(oct > 0)) return { v: 0, lvl: NaN }; var lvl = Math.round((px - ll) / oct); return { v: lvl >= 8 ? -1 : lvl <= 0 ? 1 : 0, lvl: lvl }; })();
  push(R('murrey', G, 'Murrey Math lines (64-bar octaves)', 'vote', mml.v, isFinite(mml.lvl) ? mml.lvl + '/8' : '—', 'at 8/8 = overbought (short) · at 0/8 = oversold (long); between = neutral'));
  var rvix = (function(){ var sd10 = stdev(C, 10), up = 0, dn = 0; for (var k = 0; k < 14; k++){ var kk = i - k; if (C[kk] > C[kk - 1]) up += sd10[kk]; else dn += sd10[kk]; } return (up + dn) ? 100 * up / (up + dn) : 50; })();
  push(R('rvi_vol', G, 'Relative Volatility Index 14', 'vote', band(rvix, 60, 40), fmt(rvix, 1), '>60 long · <40 short'));
  var therm = (function(){ var t = rows.map(function(r, k){ return k ? Math.max(r.h - rows[k - 1].h, rows[k - 1].l - r.l, 0) : 0; }), e22 = last(ema(t, 22)); return { t: t[i], e: e22 }; })();
  push(R('elder_thermo', G, 'Elder’s Thermometer 22', 'regime', therm.t > 3 * therm.e ? -1 : 0, fmt(therm.t) + ' / ' + fmt(therm.e), 'a reading above 3× its average = a hot, disorderly bar; no side'));
  var iii = (function(){ var num = 0, den = 0; for (var k = 0; k < 21; k++){ var r = rows[i - k], rg = r.h - r.l; num += rg ? (2 * r.c - r.h - r.l) / rg * r.v : 0; den += r.v; } return den ? num / den : 0; })();
  push(R('intraday_intensity', G, 'Intraday Intensity Index 21', 'vote', band(iii, 0.05, -0.05), fmt(iii, 3), 'beyond ±0.05'));
  var rainbow = (function(){ var s2 = sma(C, 2), above = 0, below = 0, cur = s2; for (var k = 0; k < 10; k++){ if (px > last(cur)) above++; else if (px < last(cur)) below++; cur = sma(fill0(cur), 2); } return { a: above, b: below }; })();
  push(R('rainbow', G, 'Rainbow Moving Averages (10 × SMA 2)', 'vote', rainbow.a === 10 ? 1 : rainbow.b === 10 ? -1 : 0, rainbow.a + ' above / ' + rainbow.b + ' below', 'price above the whole rainbow = long'));
  var t3v = last(t3(C, 5, 0.7)) - at(t3(C, 5, 0.7), 1);
  push(R('t3_velocity', G, 'T3 Velocity', 'vote', sgn(t3v), fmt(t3v, 3), 'the T3 line moving up = long'));
  push(R('geo_dup', G, 'Gann square / box (same 1×1 geometry) · Chaikin volatility · GMMA oscillator', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tape_na2', G, 'Bar delta · ClusterDelta · DOM surface · cluster search · big trades / block filter · speed of tape · iceberg detector · liquidity heatmap', 'n/a', 0, '—', 'all need executions or resting orders — never faked'));

  /* ---------------- SIERRA / MQL5 / COMMUNITY (tier 7) ---------------- */
  G = 'SIERRA / MQL5 / COMMUNITY';
  var prevProf = (function(){ var day = Math.floor(rows[i].t / 86400), k = i; while (k >= 0 && Math.floor(rows[k].t / 86400) === day) k--; if (k < 0) return null; var prev = Math.floor(rows[k].t / 86400), end = k; while (k >= 0 && Math.floor(rows[k].t / 86400) === prev) k--; var start = k + 1; if (end - start < 8) return null; var lo = Infinity, hi = -Infinity; for (var m = start; m <= end; m++){ lo = Math.min(lo, rows[m].l); hi = Math.max(hi, rows[m].h); } if (!(hi > lo)) return null; var bins = new Array(20).fill(0), w = (hi - lo) / 20, tot = 0; for (var m2 = start; m2 <= end; m2++){ var b = Math.min(19, Math.floor((rows[m2].c - lo) / w)); bins[b] += rows[m2].v; tot += rows[m2].v; } var poc = 0; for (var b2 = 1; b2 < 20; b2++) if (bins[b2] > bins[poc]) poc = b2; var acc = bins[poc], u = poc, d = poc; while (acc < 0.7 * tot && (u < 19 || d > 0)){ var up = u < 19 ? bins[u + 1] : -1, dn = d > 0 ? bins[d - 1] : -1; if (up >= dn){ u++; acc += up; } else { d--; acc += dn; } } return { poc: lo + (poc + 0.5) * w, vah: lo + (u + 1) * w, val: lo + d * w }; })();
  push(R('prev_refs', G, 'Previous References (prior-session POC / VAH / VAL)', 'vote', prevProf ? (px > prevProf.vah ? 1 : px < prevProf.val ? -1 : 0) : 0, prevProf ? 'VAL ' + fmt(prevProf.val) + ' · POC ' + fmt(prevProf.poc) + ' · VAH ' + fmt(prevProf.vah) : '—', 'trading above yesterday’s value area = long, below = short, inside = neutral'));
  var profVal = (va && prevProf) ? (va.val > prevProf.vah ? 'HIGHER' : va.vah < prevProf.val ? 'LOWER' : (Math.abs(va.vah - prevProf.vah) < a14 && Math.abs(va.val - prevProf.val) < a14) ? 'IN BALANCE' : 'OVERLAPPING') : '—';
  push(R('profile_value', G, 'Profile Value (auction state vs prior session)', 'vote', profVal === 'HIGHER' ? 1 : profVal === 'LOWER' ? -1 : 0, profVal, 'value area fully above yesterday’s = long, fully below = short; balance / overlap = neutral'));
  var bracket = String.fromCharCode(65 + Math.min(25, Math.floor(((rows[i].t % 86400) / 1800))));
  push(R('profile_periods', G, 'Profile Periods (30-minute TPO bracket)', 'print', 0, 'bracket ' + bracket, 'the letter of the current half-hour — context only'));
  var engV5 = (eng && cb0.v > 1.5 * (vAvg || 1) && ((eng > 0 && trendDn) || (eng < 0 && trendUp))) ? eng : 0;
  push(R('engulf_v5', G, 'Engulfing Trend Strategy v5 (volume + trend filter)', 'vote', engV5, engV5 ? (engV5 > 0 ? 'bullish, high volume' : 'bearish, high volume') : 'none', 'an engulfing bar on ≥1.5× average volume against the prior 5-bar drift'));
  var haCol = has.c > has.o ? 1 : has.c < has.o ? -1 : 0, goldenAlgo = (haCol === 1 && px > utb.line) ? 1 : (haCol === -1 && px < utb.line) ? -1 : 0;
  push(R('golden_algo', G, 'GOLDEN ALGO recipe (ATR trail + Heikin-Ashi)', 'vote', goldenAlgo, haCol > 0 ? 'HA green' : haCol < 0 ? 'HA red' : 'HA flat', 'the published recipe: a Heikin-Ashi colour agreeing with the ATR trailing line; the premium script itself is not public'));
  var snap = (function(){ var dev = (px - last(e20)) / a14, prev = (C[i - 1] - at(e20, 1)) / (at(A14, 1) || a14); if (prev > 2 && dev < prev) return -1; if (prev < -2 && dev > prev) return 1; return 0; })();
  push(R('reversnap', G, 'ReverSnap-style mean-reversion snap (EMA 20, 2 ATR)', 'vote', snap, snap ? (snap > 0 ? 'snapping up' : 'snapping down') : 'none', 'price more than 2 ATR from its baseline and turning back = the snap (a counter-trend read)'));
  push(R('tp_sl_matrix', G, 'ATR-calibrated TP/SL matrix (Swing Pro-style)', 'print', 0, 'SL ' + fmt(1.5 * a14) + ' · TP ' + fmt(2.25 * a14) + ' / ' + fmt(3.75 * a14) + ' (daily ATR ' + fmt(adrv) + ')', 'sizing, not a side'));
  push(R('tier7_na', G, 'Gold Trader Pro · Gold Signal (1m–15m) · XAU/USD Premium Signals · BigBeluga · EzAlgo · Mint Algo / Elite Algo · Prop Firm Capital Protection', 'n/a', 0, '—', 'proprietary / invite-only / account tools — never approximated'));
  push(R('tier7_tape', G, 'Large Volume Trade · Ask/Bid diagonal dominant marker · ChartDOM', 'n/a', 0, '—', 'tape and depth-of-market studies — no executions offline, never faked'));

  /* ---------------- PINE / MT SCALPERS / SMC (tier 8) ---------------- */
  G = 'PINE / MT / SMC (TIER 8)';
  var s200 = last(sma(C, 200));
  push(R('death_cross', G, 'Death / Golden Cross checker (SMA 50 vs 200)', 'vote', vs(last(S50), s200), fmt(last(S50)) + ' / ' + fmt(s200), '50 above 200 = golden (long), below = death (short)'));
  var rci = function(p){ var idx = [], vals = []; for (var k = 0; k < p; k++){ idx.push(k); vals.push(C[i - k]); } var rank = vals.map(function(v2){ var r2 = 1; for (var q2 = 0; q2 < p; q2++) if (vals[q2] > v2) r2++; return r2; }); var d2 = 0; for (var m = 0; m < p; m++) d2 += Math.pow((m + 1) - rank[m], 2); return 100 * (1 - 6 * d2 / (p * (p * p - 1))); };
  var rci9 = rci(9), rci26 = rci(26), rci52 = rci(52);
  push(R('rci3', G, 'RCI 3 lines (9 / 26 / 52)', 'vote', (rci9 > 0 && rci26 > 0 && rci52 > 0) ? 1 : (rci9 < 0 && rci26 < 0 && rci52 < 0) ? -1 : 0, fmt(rci9, 0) + ' / ' + fmt(rci26, 0) + ' / ' + fmt(rci52, 0), 'all three rank correlations on one side'));
  var gap = (function(){ for (var m = 0; m < 20; m++){ var b = rows[i - m], p = rows[i - m - 1], g = b.o - p.c; if (Math.abs(g) < 0.3 * a14) continue; var filled = false; for (var q2 = i - m; q2 <= i; q2++){ if (g > 0 && rows[q2].l <= p.c) filled = true; if (g < 0 && rows[q2].h >= p.c) filled = true; } var kind = m > 12 ? 'runaway' : (Math.abs(g) > a14 ? 'breakaway' : 'common'); return { v: filled ? 0 : sgn(g), txt: kind + (filled ? ' (filled)' : ' (open)') + ' ' + fmt(g) }; } return { v: 0, txt: 'none' }; })();
  push(R('gaps', G, 'Gaps (breakaway / runaway / common)', 'vote', gap.v, gap.txt, 'an unfilled gap holds its side; a filled gap is neutral'));
  push(R('cm_rsi_mtf', G, 'CM Ultimate RSI MTF', 'print', 0, 'see 1H RSI 14', 'identical information to the 1H RSI read — counted once'));
  push(R('pi_cycle', G, 'Pi Cycle Bottom', 'n/a', 0, '—', 'needs 350 daily bars — a macro tool, not a 15m read'));
  var dfma = ((last(D.pdi) > last(D.mdi)) && (e10 > last(e20))) ? 1 : ((last(D.pdi) < last(D.mdi)) && (e10 < last(e20))) ? -1 : 0;
  push(R('direction_force', G, 'Direction Force MA Cross (DMI + EMA 10/20)', 'vote', dfma, '+DI ' + fmt(last(D.pdi), 0) + ' / −DI ' + fmt(last(D.mdi), 0) + ' · EMA ' + fmt(e10) + ' / ' + fmt(last(e20)), 'directional side and the MA cross agreeing'));
  var rbr = (function(){ for (var k = i - 6; k >= Math.max(8, i - 40); k--){ var imp1 = C[k] - C[k - 3], base = true, bLo = Infinity, bHi = -Infinity; for (var m = k + 1; m <= k + 3; m++){ if (rngOf(rows[m]) > 0.8 * a14) base = false; bLo = Math.min(bLo, rows[m].l); bHi = Math.max(bHi, rows[m].h); } if (!base || k + 6 > i) continue; var imp2 = C[k + 6] - C[k + 3]; if (imp1 > 2 * a14 && imp2 > 2 * a14 && px >= bLo && px <= bHi) return { v: 1, txt: 'RBR base ' + fmt(bLo) + '–' + fmt(bHi) }; if (imp1 < -2 * a14 && imp2 < -2 * a14 && px >= bLo && px <= bHi) return { v: -1, txt: 'DBD base ' + fmt(bLo) + '–' + fmt(bHi) }; } return { v: 0, txt: 'none' }; })();
  push(R('rbr_dbd', G, 'RBR / DBD supply & demand mapper', 'vote', rbr.v, rbr.txt, 'price back inside a base flanked by two same-direction ≥2 ATR impulses, on their side'));
  var ttmPiv = (function(){ var hs = fr.hi.slice(-1)[0], ls = fr.lo.slice(-1)[0]; return 'target up ' + (hs ? fmt(hs.v) : '—') + ' · target down ' + (ls ? fmt(ls.v) : '—'); })();
  push(R('ttm_scalper', G, 'TTM Scalper pivot targets', 'print', 0, ttmPiv, 'the last 3-bar pivots as scalp targets — levels, not a side'));
  var cmi = (function(){ var hh = hhll(rows, 30, i, true), ll = hhll(rows, 30, i, false); return hh > ll ? 100 * Math.abs(px - C[i - 30]) / (hh - ll) : 0; })();
  push(R('cmi', G, 'Choppy Market Index 30', 'regime', cmi < 20 ? -1 : cmi > 60 ? 1 : 0, fmt(cmi, 0), '<20 = CHOP · >60 = trending; no side'));
  var lrr = Math.log(px / C[i - 1]), lrsd = last(stdev(lr, 20));
  push(R('log_return', G, 'Logarithmic rate of return (vs 20-bar σ)', 'regime', Math.abs(lrr) > 2 * lrsd ? -1 : 0, fmt(100 * lrr, 3) + '% · σ ' + fmt(100 * lrsd, 3) + '%', 'a >2σ bar = volatility expansion (regime); no side'));
  var dayOpen = (function(){ var day = Math.floor(rows[i].t / 86400), k = i; while (k > 0 && Math.floor(rows[k - 1].t / 86400) === day) k--; return rows[k].o; })();
  push(R('anchored_mom', G, 'Anchored momentum (from the UTC day open)', 'vote', band(px - dayOpen, 0.25 * a14, -0.25 * a14), fmt(px - dayOpen), 'price beyond ±¼ ATR from today’s open, on that side'));
  push(R('bar_spread', G, 'Full bar spread shadow', 'print', 0, 'range ' + fmt(rngOf(cb0)) + ' · vol ' + fmt(cb0.v, 0), 'spread and tick-volume intensity — context only'));
  push(R('peak_values', G, 'Peak price values (20-bar extremes)', 'print', 0, fmt(hhll(rows, 20, i, false)) + ' – ' + fmt(hhll(rows, 20, i, true)), 'reaction levels — not a side'));
  push(R('tier8_dup', G, 'WaveTrend (LazyBear) · Alpha Trend Spotter · Woodies CCI arrows · TFS Gann HiLo · Heiken-Ashi tape · LuxAlgo SMC set · Temporary Fair Value · P4l Candletime', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier8_na', G, 'Gold Digger 1H · Buy Sell Magic 2 · A-Gimat Reversal · Holy Grail 1.6 · Ultimate PRO Scalper · Instant Profit Scalper · Jjn Buy Sell Bee · SMT Double Div', 'n/a', 0, '—', 'proprietary / undocumented or needs a second series — never approximated'));

  /* ---------------- MULTI-TIMEFRAME (tier 9) ---------------- */
  G = 'MULTI-TIMEFRAME';
  var wkVwap = (function(){ var wk = Math.floor((rows[i].t + 4 * 86400) / (7 * 86400)), pv = 0, vv = 0; for (var k = i; k >= 0 && Math.floor((rows[k].t + 4 * 86400) / (7 * 86400)) === wk; k--){ pv += hlc3[k] * rows[k].v; vv += rows[k].v; } return vv ? pv / vv : NaN; })();
  push(R('vwap_mtf', G, 'VWAP multi-timeframe (weekly anchor)', 'vote', isFinite(wkVwap) ? vs(px, wkVwap) : 0, fmt(wkVwap), 'close above the week-anchored VWAP = long (the session VWAP is a separate read)'));
  var resample = function(src, mult){ var out2 = []; for (var k = 0; k + mult <= src.length; k += mult){ var seg = src.slice(k, k + mult); out2.push({ t: seg[0].t, o: seg[0].o, h: Math.max.apply(null, seg.map(function(r){ return r.h; })), l: Math.min.apply(null, seg.map(function(r){ return r.l; })), c: seg[seg.length - 1].c, v: seg.reduce(function(a, r){ return a + r.v; }, 0) }); } return out2; };
  var h1ok = rows1h && rows1h.length >= 120, r4h = h1ok ? resample(rows1h.slice(rows1h.length - Math.floor(rows1h.length / 4) * 4), 4) : [], rD = resample(rows.slice(rows.length - Math.floor(rows.length / 96) * 96), 96);
  var stSide = function(rr){ if (!rr || rr.length < 20) return 0; var s2 = stochKD(rr, 14, 3, 3), k = last(s2.k); return isFinite(k) ? (k > 50 ? 1 : k < 50 ? -1 : 0) : 0; };
  var q15 = stSide(rows), q1h = h1ok ? stSide(rows1h) : 0, q4h = stSide(r4h), qD = rD.length >= 20 ? stSide(rD) : 0, qs = [q15, q1h, q4h, qD].filter(function(x){ return x !== 0; });
  push(R('quad_stoch', G, 'Quad Stochastic (15m · 1H · 4H · D sync)', 'vote', (qs.length >= 3 && qs.every(function(x){ return x === 1; })) ? 1 : (qs.length >= 3 && qs.every(function(x){ return x === -1; })) ? -1 : 0, [q15, q1h, q4h, qD].map(function(x){ return x > 0 ? '↑' : x < 0 ? '↓' : '·'; }).join(' '), 'every available timeframe’s %K on the same side of 50 (≥3 needed)'));
  var rsSide = function(rr){ if (!rr || rr.length < 30) return 0; var r2 = last(rsi(closes(rr), 14)); return r2 > 55 ? 1 : r2 < 45 ? -1 : 0; };
  var m15r = rsSide(rows), m1hr = h1ok ? rsSide(rows1h) : 0, m4hr = rsSide(r4h), mrs = [m15r, m1hr, m4hr].filter(function(x){ return x !== 0; });
  push(R('mtf_rsi', G, 'MTF RSI (15m · 1H · 4H)', 'vote', (mrs.length >= 2 && mrs.every(function(x){ return x === 1; })) ? 1 : (mrs.length >= 2 && mrs.every(function(x){ return x === -1; })) ? -1 : 0, [m15r, m1hr, m4hr].map(function(x){ return x > 0 ? '↑' : x < 0 ? '↓' : '·'; }).join(' '), 'every available timeframe’s RSI on the same side (≥2 needed)'));
  var mmx = (r14 > 50 ? 1 : -1) + (last(M.hist) > 0 ? 1 : -1) + (rc > 0 ? 1 : -1) + (cc > 0 ? 1 : -1) + (last(sS.k) > 50 ? 1 : -1);
  push(R('momentum_matrix', G, 'Multi-source momentum matrix (RSI · MACD · ROC · CCI · Stoch)', 'vote', mmx >= 3 ? 1 : mmx <= -3 ? -1 : 0, (mmx > 0 ? '+' : '') + mmx + ' of 5', 'at least four of five sources on one side'));
  var eqLvl = (isFinite(fH) && isFinite(fL)) ? (fH + fL) / 2 : NaN;
  push(R('equilibrium', G, 'Dynamic equilibrium level (last swing range midpoint)', 'vote', isFinite(eqLvl) ? vs(px, eqLvl) : 0, fmt(eqLvl), 'trading in the upper half of the last swing range = long (premium/discount as structure)'));
  push(R('daily_ohlc_map', G, 'Daily OHLC market structure map', 'print', 0, 'open ' + fmt(dayOpen) + ' · prev H ' + (pd ? fmt(pd.h) : '—') + ' · prev L ' + (pd ? fmt(pd.l) : '—'), 'the reference levels — the anchored-momentum and ADHL reads vote on them'));
  push(R('dxy_bias', G, 'DXY bias filter overlay', 'n/a', 0, '—', 'needs the dollar index series — never faked'));
  var atrPct = (function(){ var arr = []; for (var k = 0; k < 200 && i - k >= 14; k++) arr.push(A14[i - k]); arr.sort(function(a, b){ return a - b; }); var below = arr.filter(function(x){ return x < a14; }).length; return 100 * below / arr.length; })();
  push(R('atr_killzones', G, 'ATR-adjusted institutional killzones', 'regime', (kz && atrPct > 60) ? 1 : 0, (kz || 'outside') + ' · ATR ' + fmt(atrPct, 0) + 'th pct', 'a killzone with expanded ATR = live conditions (regime); no side'));
  push(R('adr_pct', G, 'Session-adjusted ADR%', 'regime', isFinite(adrv) && todayR > adrv ? -1 : 0, isFinite(adrv) ? fmt(100 * todayR / adrv, 0) + '% of ADR' : '—', 'range already spent = stretched (regime); no side'));
  push(R('tier9_dup', G, 'Gold-suite repeats · GOLDEN ALGO · Hoffman · Engulfing v5 · ReverSnap · TWC ratio · Profile Value/Periods · AutoClimate · killzones', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier9_na', G, 'Gold Master v5 · Gold Net Strength · Gold Pro MT4 Trend · Gold Trader Pro · Mint/Elite Algo · Prop Firm Protection · DOM heatmap · iceberg · speed of tape · LVT · diagonal marker · Order Flow Ticks · SMT · ScalpHunterPro', 'n/a', 0, '—', 'proprietary / account tools / tape studies / second series — never faked'));

  /* ---------------- GOLD COMPOSITES (tier 10) ---------------- */
  G = 'GOLD COMPOSITES';
  var impulseOk = Math.abs(C[i] - C[i - 3]) >= a14, overlap = (hrNow >= 7 && hrNow < 16);
  var stob = (last(st) === 1 && (obr.ob === 1 || (isFinite(fH) && px > fH)) && (!fv || fv.dir >= 0) && impulseOk && overlap) ? 1 : (last(st) === -1 && (obr.ob === -1 || (isFinite(fL) && px < fL)) && (!fv || fv.dir <= 0) && impulseOk && overlap) ? -1 : 0;
  push(R('st_orderblocks', G, 'XAUUSD Supertrend + Order Blocks (BOS · FVG · ATR impulse · London/NY)', 'vote', stob, 'ST ' + (last(st) === 1 ? 'up' : 'down') + ' · impulse ' + (impulseOk ? 'yes' : 'no') + ' · session ' + (overlap ? 'in' : 'out'), 'SuperTrend side confirmed by an order-block retest or BOS, no opposing FVG, a ≥1 ATR impulse, inside London–NY'));
  var stack921 = (last(e9) > last(e21) && last(e21) > last(e50)) ? 1 : (last(e9) < last(e21) && last(e21) < last(e50)) ? -1 : 0, cdlAny = eng || pin || (hammerShape ? 1 : 0) || (invShape ? -1 : 0);
  var mccabe = (stack921 === 1 && r14 < 40 && cdlAny > 0) ? 1 : (stack921 === -1 && r14 > 60 && cdlAny < 0) ? -1 : 0;
  push(R('gold_signal_mccabe', G, 'Gold Signal (EMA 9/21/50 stack + RSI extreme + candle)', 'vote', mccabe, 'stack ' + (stack921 > 0 ? 'up' : stack921 < 0 ? 'down' : 'mixed') + ' · RSI ' + fmt(r14, 0), 'a pullback RSI extreme inside a stacked trend with a reversal candle'));
  var orb30 = (function(){ var day = Math.floor(rows[i].t / 86400), hi = -Infinity, lo = Infinity, openHr = hrNow >= 12 ? 12 : 7; for (var k = i; k >= 0 && Math.floor(rows[k].t / 86400) === day; k--){ var sec = rows[k].t % 86400; if (sec >= openHr * 3600 && sec < openHr * 3600 + 1800){ hi = Math.max(hi, rows[k].h); lo = Math.min(lo, rows[k].l); } } if (!isFinite(hi) || (rows[i].t % 86400) < openHr * 3600 + 1800) return { v: 0, txt: 'range forming / before the open' }; return { v: px > hi ? 1 : px < lo ? -1 : 0, txt: (openHr === 12 ? 'NY' : 'London') + ' ' + fmt(lo) + ' – ' + fmt(hi) }; })();
  push(R('orb30', G, '30-minute Opening Range Breakout', 'vote', orb30.v, orb30.txt, 'a close outside the first 30 minutes of the London / New York open, on that side'));
  var trap = (function(){ var hh20 = -Infinity, ll20 = Infinity; for (var k = 3; k <= 22; k++){ hh20 = Math.max(hh20, rows[i - k].h); ll20 = Math.min(ll20, rows[i - k].l); } var broke = 0; for (var m = 1; m <= 2; m++){ if (C[i - m] > hh20) broke = 1; if (C[i - m] < ll20) broke = -1; } if (broke === 1 && px < hh20) return -1; if (broke === -1 && px > ll20) return 1; return 0; })();
  push(R('liquidity_trap', G, 'Liquidity Traps (failed breakout)', 'vote', trap, trap ? (trap > 0 ? 'bear trap' : 'bull trap') : 'none', 'a close beyond the 20-bar range that is back inside within two bars = fade the trap'));
  push(R('marketcipher_a', G, 'MarketCipher A (EMA ribbon + diamond)', 'print', 0, 'see EMA cascade + Cipher B', 'the ribbon is the cascade read and the diamond is the Cipher B cross — counted once each'));
  push(R('tier10_dup', G, 'GOLDEN ALGO · XAU/USD Premium Signals · Price Action Toolkit (candle set) · MarketCipher B · EzSMC (FVG + sweeps)', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier10_na', G, 'Gold Confluence (DXY) · GOLD vs USD RSI/Geometric cross · MATADOR · WOLFPIPS · GainzAlgo · KUTOKA BLOCK · INEVITRADE · Zero Prints · GEX overlays', 'n/a', 0, '—', 'needs the dollar basket / options data / the tape, or is proprietary — never faked'));

  /* ---------------- SCALPING COMBINATIONS (tier 11) ---------------- */
  G = 'SCALPING COMBOS';
  push(R('vwap_bb_mr', G, 'VWAP + Bollinger mean-reversion', 'vote', (px > bbu && px > vw) ? -1 : (px < bbl && px < vw) ? 1 : 0, fmt(bbl) + ' / ' + fmt(vw) + ' / ' + fmt(bbu), 'outside the band AND on that side of VWAP = revert (a counter-trend read, by design)'));
  var kdCross = (last(sS.k) > last(sS.d) && at(sS.k, 1) <= at(sS.d, 1)) ? 1 : (last(sS.k) < last(sS.d) && at(sS.k, 1) >= at(sS.d, 1)) ? -1 : 0;
  push(R('stoch_cross_scalper', G, 'Stochastic %K / %D cross scalper', 'vote', kdCross, kdCross ? (kdCross > 0 ? 'crossed up' : 'crossed down') : 'no cross', 'the cross printed on this closed bar'));
  push(R('psar_sma50', G, 'Parabolic SAR + SMA 50 continuation', 'vote', (last(ps.trend) === 1 && px > last(S50)) ? 1 : (last(ps.trend) === -1 && px < last(S50)) ? -1 : 0, 'SAR ' + (last(ps.trend) === 1 ? 'below' : 'above') + ' · SMA50 ' + fmt(last(S50)), 'SAR side agreeing with price vs the 50 SMA'));
  push(R('dyn_sr', G, 'Dynamic support / resistance zones', 'print', 0, 'R ' + fmt(fH) + ' · S ' + fmt(fL), 'the fractal levels — the BOS / MSS / EQH-EQL reads vote on them'));
  push(R('vol_functions', G, 'Pine volatility functions overlay', 'print', 0, 'ATR ' + fmt(a14) + ' · σ ' + fmt(bbs) + ' · HV ' + fmt(hv, 0) + '%', 'the volatility reads restated — regime only'));
  push(R('tier11_dup', G, 'kNN classifier · Naive Bayes · LuxAlgo PriceAction Concepts · Hoffman · SuperTrend Buy/Sell · the ALGOX / Mayfair / Mint / NAS / MG / GG-SHOT / Punk / IMBA / DTC / SFX / Sniper / Eyops / Smart Money Algo / Harmonic V5 / EMA Stock Burner / Criptom4N rows', 'print', 0, 'fed above', 'counted or listed elsewhere — never twice'));
  push(R('tier11_na', G, 'Accurate Gold · Gold Trend MT4 · 100 Non Repaint · Simple Gold Level Signal · Master Buy/Sell & TP · Trend Signals TP/SL · Scalping Pro · TrendSpider Sidekick · ML Quanty Lab', 'n/a', 0, '—', 'proprietary / undocumented — never approximated'));

  /* ---------------- AI / COMMUNITY HYBRIDS (tier 12) ---------------- */
  G = 'AI / COMMUNITY HYBRIDS';
  var s9 = last(sma(C, 9)), cloudUp = last(e21) > last(e50), antiRep = (last(st) === 1 && px > s9 && last(ps.trend) === 1 && cloudUp) ? 1 : (last(st) === -1 && px < s9 && last(ps.trend) === -1 && !cloudUp) ? -1 : 0;
  push(R('anti_repaint', G, 'Gold Scalping anti-repaint (SuperTrend + SMA 9 + PSAR + EMA cloud)', 'vote', antiRep, 'ST ' + (last(st) === 1 ? 'up' : 'down') + ' · SMA9 ' + fmt(s9) + ' · cloud ' + (cloudUp ? 'up' : 'down'), 'all four legs on one side'));
  var gsp = (vs(last(VW), at(VW, 2)) > 0 && haCol === 1 && r14 < 70) ? 1 : (vs(last(VW), at(VW, 2)) < 0 && haCol === -1 && r14 > 30) ? -1 : 0;
  push(R('gsp', G, 'Gold Scalper Pro hybrid (VWMA + Heikin-Ashi + RSI filter)', 'vote', gsp, 'VWMA ' + fmt(last(VW)) + ' · HA ' + (haCol > 0 ? 'green' : haCol < 0 ? 'red' : 'flat') + ' · RSI ' + fmt(r14, 0), 'a rising VWMA with a green HA candle and RSI not overbought (mirrored)'));
  var haOsc = (function(){ var hao = NaN, hac = NaN, a = []; for (var k = 0; k < n; k++){ var c2 = (rows[k].o + rows[k].h + rows[k].l + rows[k].c) / 4; hao = isFinite(hao) ? (hao + hac) / 2 : (rows[k].o + rows[k].c) / 2; hac = c2; a.push(hac - hao); } return { v: last(a), p: at(a, 1) }; })();
  push(R('ha_osc', G, 'Heiken Ashi Algo Oscillator', 'vote', (haOsc.v > 0 && haOsc.v >= haOsc.p) ? 1 : (haOsc.v < 0 && haOsc.v <= haOsc.p) ? -1 : 0, fmt(haOsc.v, 2), 'HA body positive and growing = long'));
  var kamaOsc = a14 ? (px - ka) / a14 : 0;
  push(R('kama_osc', G, 'KAMA oscillator (distance in ATR)', 'vote', band(kamaOsc, 0.5, -0.5), fmt(kamaOsc, 2), 'beyond ±0.5 ATR from the adaptive average, on that side'));
  var dual = (isUp(cb0) && isUp(cb1) && isDn(cb2) && isDn(cb3)) ? 1 : (isDn(cb0) && isDn(cb1) && isUp(cb2) && isUp(cb3)) ? -1 : 0;
  push(R('dual_candle', G, 'Super Forex dual-candle repetition', 'vote', dual, dual ? (dual > 0 ? 'two greens after two reds' : 'two reds after two greens') : 'none', 'a colour pair flipping the prior pair = the transition'));
  var fibRsi = (function(){ var rs = rsi(C, 14), hh = -Infinity, ll = Infinity; for (var k = 0; k < 50; k++){ hh = Math.max(hh, rs[i - k]); ll = Math.min(ll, rs[i - k]); } var rg = hh - ll; if (!(rg > 0)) return { v: 0, txt: '—' }; var f382 = ll + 0.382 * rg, f618 = ll + 0.618 * rg; return { v: r14 > f618 ? 1 : r14 < f382 ? -1 : 0, txt: fmt(f382, 0) + ' / ' + fmt(f618, 0) }; })();
  push(R('fib_rsi', G, 'Fibonacci RSI levels (38.2 / 61.8 of the 50-bar RSI range)', 'vote', fibRsi.v, 'RSI ' + fmt(r14, 0) + ' · ' + fibRsi.txt, 'RSI above its own 61.8 = long, below its 38.2 = short'));
  var rsiPiv = (function(){ var rs = rsi(C, 14), pl = NaN, ph = NaN; for (var k = i - 3; k >= i - 40; k--){ if (!isFinite(pl) && rs[k] < rs[k - 1] && rs[k] < rs[k + 1] && rs[k] < rs[k - 2] && rs[k] < rs[k + 2]) pl = rs[k]; if (!isFinite(ph) && rs[k] > rs[k - 1] && rs[k] > rs[k + 1] && rs[k] > rs[k - 2] && rs[k] > rs[k + 2]) ph = rs[k]; } var v2 = 0; if (isFinite(pl) && at(rs, 1) < pl && r14 >= pl) v2 = 1; if (isFinite(ph) && at(rs, 1) > ph && r14 <= ph) v2 = -1; return { v: v2, txt: 'RSI S ' + fmt(pl, 0) + ' · R ' + fmt(ph, 0) }; })();
  push(R('rsi_pivot', G, 'RSI pivot reversal', 'vote', rsiPiv.v, rsiPiv.txt, 'RSI reclaiming its last pivot low (long) / losing its last pivot high (short)'));
  push(R('doji_ashi', G, 'Doji Ashi (doji inside a smoothed HA trend)', 'print', 0, (dojiB(cb0) && haCol) ? 'doji in an HA ' + (haCol > 0 ? 'up' : 'down') + 'trend' : 'none', 'indecision inside a trend — flagged, no side'));
  push(R('tier12_dup', G, 'Gold Signal (McCabe) · ZigZag Pro · VWAP Plus · 1-min VIX (Williams VIX Fix) · Vsapro (VSA)', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier12_na', G, 'AI Gold Scalping (AI Sandip) · Pro V3 SMRT · UltraScalperPro v2 · Profit Plus · 72s script', 'n/a', 0, '—', 'private / undocumented — never approximated'));

  /* ---------------- STRUCTURE PATTERNS (tier 13) ---------------- */
  G = 'STRUCTURE PATTERNS';
  var p123 = (function(){ var L2 = swings.L, H2 = swings.H; if (L2.length === 2 && H2.length >= 1){ var h2 = H2[H2.length - 1]; if (L2[0].i < h2.i && h2.i < L2[1].i && L2[1].v > L2[0].v && px > h2.v) return { v: 1, txt: '1 ' + fmt(L2[0].v) + ' · 2 ' + fmt(h2.v) + ' · 3 ' + fmt(L2[1].v) }; } if (H2.length === 2 && L2.length >= 1){ var l2 = L2[L2.length - 1]; if (H2[0].i < l2.i && l2.i < H2[1].i && H2[1].v < H2[0].v && px < l2.v) return { v: -1, txt: '1 ' + fmt(H2[0].v) + ' · 2 ' + fmt(l2.v) + ' · 3 ' + fmt(H2[1].v) }; } return { v: 0, txt: 'none' }; })();
  push(R('one23', G, '1-2-3 reversal', 'vote', p123.v, p123.txt, 'a higher low (3) after a swing low (1), then a close through point 2'));
  var trendy = (C[i] > C[i - 1] && C[i - 1] > C[i - 2] && C[i - 2] > C[i - 3]) ? 1 : (C[i] < C[i - 1] && C[i - 1] < C[i - 2] && C[i - 2] < C[i - 3]) ? -1 : 0;
  push(R('trendy', G, 'Trendy Scalper (close-to-close)', 'vote', trendy, trendy ? 'three rising closes' : 'mixed', 'three consecutive closes in one direction'));
  var r2dots = (function(){ var ups = 0, dns = 0; for (var k = 1; k <= 5; k++){ if (isUp(rows[i - k])) ups++; if (isDn(rows[i - k])) dns++; } if (ups === 5 && isDn(cb0)) return -1; if (dns === 5 && isUp(cb0)) return 1; return 0; })();
  push(R('r2_dots', G, 'R[2] exhaustion dots', 'vote', r2dots, r2dots ? (r2dots > 0 ? 'low dot' : 'high dot') : 'none', 'five same-colour bars then the first opposite close = exhaustion, fade it'));
  var obFib = (obr.ob && goldenPocket.v === obr.ob) ? obr.ob : 0;
  push(R('ob_fibo', G, 'OB Scalping / React Fibo zone', 'vote', obFib, obFib ? 'block inside the golden pocket' : 'none', 'an order-block retest that also sits in the 0.5–0.618 pocket'));
  var kong = (function(){ if (!mss) return 0; var m = 0; for (var k = 1; k <= 3; k++) if ((mss > 0 && rows[i - k].l <= (isFinite(fL) ? fL : Infinity) + 0.3 * a14 && rows[i - k].c > fL) || (mss < 0 && rows[i - k].h >= (isFinite(fH) ? fH : -Infinity) - 0.3 * a14 && rows[i - k].c < fH)) m++; return m ? mss : 0; })();
  push(R('kong_retest', G, 'KongTrade SMC retest (flush → reclaim → clean retest)', 'vote', kong, kong ? 'retest held' : 'none', 'a swept level reclaimed and retested from the right side within three bars'));
  var absorb = (cb0.v > 1.8 * (vAvg || 1) && rngOf(cb0) < 0.6 * a14) ? (cb0.l <= hhll(rows, 20, i, false) + 0.2 * a14 ? 1 : cb0.h >= hhll(rows, 20, i, true) - 0.2 * a14 ? -1 : 0) : 0;
  push(R('absorption', G, 'Institutional absorption filter', 'vote', absorb, absorb ? (absorb > 0 ? 'absorbed at the low' : 'absorbed at the high') : 'none', 'heavy volume with a tight range at a 20-bar extreme = orders absorbed there'));
  var orb1h = (function(){ var day = Math.floor(rows[i].t / 86400), hi = -Infinity, lo = Infinity; for (var k = i; k >= 0 && Math.floor(rows[k].t / 86400) === day; k--){ var sec = rows[k].t % 86400; if (sec >= 7 * 3600 && sec < 8 * 3600){ hi = Math.max(hi, rows[k].h); lo = Math.min(lo, rows[k].l); } } if (!isFinite(hi) || (rows[i].t % 86400) < 8 * 3600) return { v: 0, txt: 'forming / before 08:00' }; return { v: px > hi ? 1 : px < lo ? -1 : 0, txt: fmt(lo) + ' – ' + fmt(hi) }; })();
  push(R('orb1h', G, 'Open Range Breakout (1-hour London box)', 'vote', orb1h.v, orb1h.txt, 'identical box to the London breakout read but on the full first hour — a close outside it, on that side'));
  push(R('tier13_dup', G, 'Topg 15m levels (BOS/CHoCH) · EQH/EQL pockets · SMART · VWAP Plus · 1-min VIX · Market Profile value-area state · Profit Plus', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier13_na', G, 'JTC Smart Gold · FV Scalper · RPTrade Pro Line · Gold Confluence Sniper · AlphaTrendPro · Zero Prints · diagonal marker · GEX', 'n/a', 0, '—', 'proprietary, or needs the tape / options data — never faked'));

  /* ---------------- FORUM OVERLAYS (tier 14) ---------------- */
  G = 'FORUM OVERLAYS';
  var r30 = resample(rows.slice(rows.length - Math.floor(rows.length / 2) * 2), 2), r30n = r30.length;
  var low30 = (r30n >= 3) ? ((r30[r30n - 1].c < r30[r30n - 2].l) ? -1 : (r30[r30n - 1].c > r30[r30n - 2].h) ? 1 : 0) : 0;
  push(R('break30m', G, '30M low/high break confirmation', 'vote', low30, r30n >= 2 ? fmt(r30[r30n - 2].l) + ' – ' + fmt(r30[r30n - 2].h) : '—', 'a 30-minute close through the prior 30-minute bar’s extreme, on that side'));
  var fvgSweep = (mss && fv && fv.dir === mss) ? mss : 0;
  push(R('fvg_sweep', G, 'FVG liquidity sweep tracker', 'vote', fvgSweep, fvgSweep ? 'sweep + gap agree' : 'none', 'a swept-and-reclaimed pivot with price inside an FVG on the same side'));
  var sellArea = (function(){ for (var m = 1; m <= 30; m++){ var b = rows[i - m]; if (isDn(b) && longBody(b) && rows[i - m + 1] && rows[i - m + 1].c < b.l) return b.h; } return NaN; })();
  push(R('sell_area_15m', G, '15M institutional selling area line', 'vote', isFinite(sellArea) ? (px > sellArea ? 1 : (px <= sellArea && px >= sellArea - 0.5 * a14) ? -1 : 0) : 0, fmt(sellArea), 'the top of the last displacing bear bar: rejected there = short, reclaimed = long'));
  push(R('gold_regime_filter', G, 'Gold Market Regime Filter', 'regime', regimeSummaryVote(out), 'chop ' + countRegime(out, -1) + ' · trend ' + countRegime(out, 1), 'the regime reads summarised — the same gate, printed once more'));
  push(R('tier14_dup', G, 'SMC zone retest · IGT zone breakout (boxes) · WOLFPIPS · Lorentzian · NWE · EQH/EQL sweeper · KongTrade · Doji Ashi · Topg · OB Fibo · absorption · 1-2-3 · VWAP Plus · VIX · SMART · Vsapro · Pi Cycle · RCI3 · Death Cross · Naive Bayes · kNN · log return · anchored momentum · CMI · MSNR · TWC · AutoClimate · Trendy · R[2]', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier14_na', G, 'Gold Trader Pro (modes) · JTC · FV Scalper · RPTrade · Confluence Sniper · Super Arrow · AlphaTrendPro · Volumetric bars · order-flow delta / VWAP-SD / depth map / trade detector · tape filter · SMT', 'n/a', 0, '—', 'proprietary, or needs the tape / a second series — never faked'));

  /* ---------------- FOREXFACTORY / EA SYSTEMS (tier 15) ---------------- */
  G = 'FOREXFACTORY / EA SYSTEMS';
  var mmst = (px > dh && last(st) === 1) ? 1 : (px < dl && last(st) === -1) ? -1 : 0;
  push(R('maxmin_st', G, 'Maximas e Minimas + SuperTrend', 'vote', mmst, fmt(dl) + ' – ' + fmt(dh) + ' · ST ' + (last(st) === 1 ? 'up' : 'down'), 'a 20-bar high/low breakout agreeing with the SuperTrend side'));
  push(R('amt_alert', G, 'Auction Market Theory VAH/VAL alert', 'vote', va ? (px > va.vah ? 1 : px < va.val ? -1 : 0) : 0, va ? fmt(va.val) + ' – ' + fmt(va.vah) : '—', 'a close outside the value area, on that side (the reversion read is separate)'));
  var svx = (cb0.v > 2 * (vAvg || 1) && bodyOf(cb0) > 0.5 * rngOf(cb0)) ? (isUp(cb0) ? 1 : -1) : 0;
  push(R('scalpvolumex', G, 'ScalpVolumeX (volume spike + candle direction)', 'vote', svx, svx ? fmt(cb0.v / (vAvg || 1), 1) + 'x volume' : 'no spike', 'a ≥2× volume bar with a decisive body, on the body’s side'));
  var nova = (last(e9) > last(e21) && px > vw && px > last(e9)) ? 1 : (last(e9) < last(e21) && px < vw && px < last(e9)) ? -1 : 0;
  push(R('nova', G, 'Nova Entry System (EMA 9/21 + VWAP alignment)', 'vote', nova, 'EMA ' + fmt(last(e9)) + ' / ' + fmt(last(e21)) + ' · VWAP ' + fmt(vw), 'price, the fast EMA and VWAP all aligned one way'));
  var ema4h = (r4h.length >= 30) ? (function(){ var c4 = closes(r4h), a = ema(c4, 9), b = ema(c4, 21); return (last(a) > last(b)) ? 1 : 0; })() : 0;
  push(R('ema_cross_4h_buy', G, 'EMA Cross 4H buy-only filter', 'vote', ema4h, ema4h ? '4H 9 > 21' : '4H 9 ≤ 21 (no shorts by design)', 'long only when the 4H fast EMA is above the slow; never votes short — as the script is written'));
  push(R('ballestyan', G, 'Ballestyan System Calculator (risk % by hour)', 'print', 0, 'hour ' + hrNow + ' UTC', 'a position-sizing rule — needs account equity; not a side'));
  push(R('tier15_dup', G, 'Profit Plus · Crash & Boom spike · Gold Market Regime Filter · the tier-14 directory repeats', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier15_na', G, 'Gold Hunter V9 · Trend Following Gold EA · Kashi Recovery Grid · M1 Countertrend thread system · XAU Power PRO (velocity decoupling) · Harmonic Currency Strength', 'n/a', 0, '—', 'proprietary EAs, grid/recovery systems or dollar-basket inputs — never approximated'));

  /* ---------------- INSTITUTIONAL / FORUM FRAMEWORKS (tier 16) ---------------- */
  G = 'INSTITUTIONAL FRAMEWORKS';
  var eqSide = function(rr, p){ if (!rr || rr.length < p + 1) return 0; var j = rr.length - 1, hh = -Infinity, ll = Infinity; for (var k = 1; k <= p; k++){ hh = Math.max(hh, rr[j - k].h); ll = Math.min(ll, rr[j - k].l); } return vs(rr[j].c, (hh + ll) / 2); };
  var eqM1 = eqSide(rows, 20), eqM30 = eqSide(r30, 20), eqH1 = h1ok ? eqSide(rows1h, 20) : 0, eqH4 = eqSide(r4h, 20), eqD = rD.length >= 21 ? eqSide(rD, 20) : 0;
  var eqs = [eqM1, eqM30, eqH1, eqH4, eqD].filter(function(x){ return x !== 0; });
  push(R('eq_7tf', G, 'Gold Trader Pro signal bar (equilibrium across timeframes)', 'vote', (eqs.length >= 4 && eqs.every(function(x){ return x === 1; })) ? 1 : (eqs.length >= 4 && eqs.every(function(x){ return x === -1; })) ? -1 : 0, [eqM1, eqM30, eqH1, eqH4, eqD].map(function(x){ return x > 0 ? '↑' : x < 0 ? '↓' : '·'; }).join(' '), 'price on the same side of the 20-bar equilibrium on every available timeframe (≥4 needed; M1/M5 are not fed)'));
  var exh = isFinite(adrv) ? (px > dayOpen + adrv ? -1 : px < dayOpen - adrv ? 1 : 0) : 0;
  push(R('atr_exhaustion', G, 'ATR intraday exhaustion mapper (open ± ADR)', 'vote', exh, isFinite(adrv) ? fmt(dayOpen - adrv) + ' – ' + fmt(dayOpen + adrv) : '—', 'price beyond a full average day range from the open = statistically stretched, fade it'));
  var h1ob = h1ok ? (function(){ var rr = rows1h, j = rr.length - 1; for (var k = j - 2; k >= Math.max(3, j - 60); k--){ if (rr[k].c < rr[k].o && rr[k + 2].c < rr[k].l){ var mit2 = false; for (var m = k + 3; m <= j; m++) if (rr[m].h >= rr[k].l) mit2 = true; if (!mit2) return { lo: rr[k].l, hi: rr[k].h }; } } return null; })() : null;
  push(R('h1_supply', G, 'H1 supply roadblocks / reclaim tracker', 'vote', h1ob ? (px >= h1ob.lo && px <= h1ob.hi ? -1 : px > h1ob.hi ? 1 : 0) : 0, h1ob ? fmt(h1ob.lo) + ' – ' + fmt(h1ob.hi) : 'no unmitigated H1 supply', 'inside an unmitigated H1 supply zone = short; a close above it = reclaimed, long'));
  var pulse = (function(){ var hh = hhll(rows, 20, i, true), ll = hhll(rows, 20, i, false); if (!(hh - ll < 2.5 * a14)) return { v: 0, txt: 'not in a tight range' }; var up = 0, mid = (hh + ll) / 2; for (var k = 0; k < 20; k++) if (C[i - k] > mid) up++; return { v: up >= 14 ? 1 : up <= 6 ? -1 : 0, txt: up + ' of 20 closes above mid' }; })();
  push(R('bitefx_pulse', G, 'BiteFX Pulse (closes inside a tight range)', 'vote', pulse.v, pulse.txt, 'closes clustering in the upper half of a tight range = accumulation, lower half = distribution'));
  var itr = (function(){ var hh = hhll(rows, 30, i, true), ll = hhll(rows, 30, i, false); if (!(hh - ll < 3 * a14)) return { v: 0, txt: 'trending, no range' }; var d2 = last(cvd) - at(cvd, 20); return { v: d2 > 0 ? 1 : d2 < 0 ? -1 : 0, txt: 'delta ' + fmt(d2, 0) }; })();
  push(R('inside_range', G, 'Inside the Range (ROC) tracker', 'vote', itr.v, itr.txt, 'rising volume delta inside a consolidation = accumulation (long), falling = distribution'));
  var parab = (function(){ var dev = (px - last(e20)) / a14, volDown = cb0.v < rows[i - 1].v && rows[i - 1].v < rows[i - 2].v; if (dev > 3 && volDown) return -1; if (dev < -3 && volDown) return 1; return 0; })();
  push(R('parabolic_reject', G, 'Parabolic rally rejection zones', 'vote', parab, fmt((px - last(e20)) / a14, 1) + ' ATR from EMA 20', 'more than 3 ATR from the baseline with volume fading = fade the run'));
  var sessRet = function(h0, h1x){ var day = Math.floor(rows[i].t / 86400), o = NaN, c = NaN; for (var k = 0; k <= i && Math.floor(rows[i - k].t / 86400) === day; k++){ var hr = Math.floor((rows[i - k].t % 86400) / 3600); if (hr >= h0 && hr < h1x){ if (!isFinite(c)) c = rows[i - k].c; o = rows[i - k].o; } } return isFinite(o) && isFinite(c) ? sgn(c - o) : 0; };
  var sA = sessRet(0, 7), sL = sessRet(7, 12), sN = sessRet(12, 21), ss3 = [sA, sL, sN].filter(function(x){ return x !== 0; });
  push(R('session_matrix', G, 'Multi-Session Alignment Matrix (Asia · London · NY flow)', 'vote', (ss3.length >= 2 && ss3.every(function(x){ return x === 1; })) ? 1 : (ss3.length >= 2 && ss3.every(function(x){ return x === -1; })) ? -1 : 0, [sA, sL, sN].map(function(x){ return x > 0 ? '↑' : x < 0 ? '↓' : '·'; }).join(' '), 'every session traded so far today flowed the same way (≥2 needed)'));
  push(R('tier16_dup', G, 'ORB scanner (1H box) · TopG 15m levels · AlphaTrendPro (MTF bias = the HTF reads)', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier16_na', G, 'Quantum Titan · Quantum Queen X · Gold Reaper · Iron Stops EA · XANDER Grid · Gold Confluence Sniper', 'n/a', 0, '—', 'proprietary EAs / grid systems / risk managers — never approximated'));

  /* ---------------- ICT EXTRAS + EXOTIC CHARTS (tier 17) ---------------- */
  G = 'ICT EXTRAS / EXOTIC CHARTS';
  var judas = (function(){ if (!lbox || hrNow < 8 || hrNow >= 11) return 0; var swept = 0; for (var m = 0; m <= 8 && i - m >= 0; m++){ if (rows[i - m].h > lbox.hi) swept = 1; if (rows[i - m].l < lbox.lo) swept = -1; } if (swept === 1 && px < lbox.hi) return -1; if (swept === -1 && px > lbox.lo) return 1; return 0; })();
  push(R('judas', G, 'Judas Swing detector (London open)', 'vote', judas, judas ? (judas > 0 ? 'low swept, reversing up' : 'high swept, reversing down') : 'none', 'the first-hour London range faked one way and price came back through it — fade the fake'));
  var sbWin = (hrNow === 10 || hrNow === 14), silver = (sbWin && fv) ? fv.dir : 0;
  push(R('silver_bullet', G, 'ICT Silver Bullet (10–11 / 14–15 UTC + FVG)', 'vote', silver, sbWin ? 'window open' + (fv ? ', FVG live' : ', no FVG') : 'outside the windows', 'an FVG entry inside the Silver Bullet hour, on the gap’s side'));
  var regDiv = (function(){ var rs = rsi(C, 14), lows = fr.lo.slice(-2), highs = fr.hi.slice(-2); if (lows.length === 2 && lows[1].v < lows[0].v && rs[lows[1].i] > rs[lows[0].i] && i - lows[1].i <= 6) return 1; if (highs.length === 2 && highs[1].v > highs[0].v && rs[highs[1].i] < rs[highs[0].i] && i - highs[1].i <= 6) return -1; return 0; })();
  push(R('regular_div', G, 'Bullish / bearish divergence setup (RSI 14, regular)', 'vote', regDiv, regDiv ? (regDiv > 0 ? 'bullish' : 'bearish') : 'none', 'price lower low with RSI higher low = long (mirrored) — the hidden variant is a separate read'));
  var dragonH = last(ema(rows.map(function(r){ return r.h; }), 34)), dragonL = last(ema(rows.map(function(r){ return r.l; }), 34));
  push(R('sonic_r', G, 'Sonic R (EMA 34 dragon)', 'vote', px > dragonH ? 1 : px < dragonL ? -1 : 0, fmt(dragonL) + ' – ' + fmt(dragonH), 'close outside the dragon, on that side; inside = neutral'));
  var tmaM = (function(){ var a = last(sma(fill0(sma(C, 6)), 7)), b = last(sma(fill0(sma(C, 13)), 14)); return a - b; })();
  push(R('tma_macd', G, 'TMA-centred MACD (12 / 26)', 'vote', sgn(tmaM), fmt(tmaM, 3), 'positive = long'));
  push(R('kc_breakout', G, 'Keltner Channel breakout (20, 1.5)', 'vote', px > kem + 1.5 * a14 ? 1 : px < kem - 1.5 * a14 ? -1 : 0, fmt(kem - 1.5 * a14) + ' – ' + fmt(kem + 1.5 * a14), 'a close outside the channel, on that side (the position read is separate)'));
  var bricks = function(brick, useMid){ var b = [], lvl = C[0]; for (var k = 1; k < n; k++){ var p2 = C[k]; while (p2 >= lvl + brick){ b.push(1); lvl += brick; } while (p2 <= lvl - brick){ b.push(-1); lvl -= brick; } } return b; };
  var rk = bricks(a14, false), rkTrend = rk.length >= 2 && rk[rk.length - 1] === rk[rk.length - 2] ? rk[rk.length - 1] : 0;
  push(R('renko', G, 'Renko (1 ATR brick) trend', 'vote', rkTrend, rk.length ? rk.slice(-4).map(function(x){ return x > 0 ? '▲' : '▼'; }).join('') : '—', 'two consecutive bricks in one colour'));
  var mrk = bricks(0.5 * a14, true), mrkT = mrk.length >= 3 && mrk.slice(-3).every(function(x){ return x === mrk[mrk.length - 1]; }) ? mrk[mrk.length - 1] : 0;
  push(R('median_renko', G, 'Median Renko (½ ATR) gold scalper', 'vote', mrkT, mrk.length ? mrk.slice(-5).map(function(x){ return x > 0 ? '▲' : '▼'; }).join('') : '—', 'three consecutive half-bricks in one colour'));
  push(R('omnitrend_renko', G, 'OmniTrend Renko system (bricks + EMA 20)', 'vote', (rkTrend === 1 && px > last(e20)) ? 1 : (rkTrend === -1 && px < last(e20)) ? -1 : 0, 'bricks ' + (rkTrend > 0 ? 'up' : rkTrend < 0 ? 'down' : 'mixed') + ' · EMA20 ' + fmt(last(e20)), 'brick trend agreeing with price vs the EMA'));
  var kagi = (function(){ var rev = a14, dir = 0, ext = C[0], sh = -Infinity, sl = Infinity, thick = 0; for (var k = 1; k < n; k++){ var p2 = C[k]; if (dir >= 0){ if (p2 > ext){ ext = p2; if (!dir) dir = 1; } else if (ext - p2 >= rev){ sh = ext; dir = -1; ext = p2; } } if (dir < 0){ if (p2 < ext) ext = p2; else if (p2 - ext >= rev){ sl = ext; dir = 1; ext = p2; } } if (dir === 1 && isFinite(sh) && p2 > sh) thick = 1; if (dir === -1 && isFinite(sl) && p2 < sl) thick = -1; } return { dir: dir, thick: thick }; })();
  push(R('kagi', G, 'Kagi reversal tracker (1 ATR)', 'vote', kagi.thick || kagi.dir, (kagi.dir > 0 ? 'rising' : 'falling') + (kagi.thick ? ' · thick (' + (kagi.thick > 0 ? 'yang' : 'yin') + ')' : ''), 'a yang line (broke the prior shoulder) = long, yin = short'));
  var tlb3 = (function(){ var lines = [{ hi: rows[0].c, lo: rows[0].c }]; for (var k = 1; k < n; k++){ var p2 = C[k], L3 = lines.slice(-3), maxH = Math.max.apply(null, L3.map(function(l){ return l.hi; })), minL = Math.min.apply(null, L3.map(function(l){ return l.lo; })), lastL = lines[lines.length - 1]; if (p2 > maxH) lines.push({ hi: p2, lo: lastL.hi, d: 1 }); else if (p2 < minL) lines.push({ hi: lastL.lo, lo: p2, d: -1 }); } var lastLine = lines[lines.length - 1]; return { v: lastLine.d || 0, n: lines.length }; })();
  push(R('three_line_break', G, 'Three Line Break trend', 'vote', tlb3.v, tlb3.v > 0 ? 'white line' : tlb3.v < 0 ? 'black line' : '—', 'the colour of the last break line'));
  var pnf = (function(){ var box = 0.5 * a14, rk2 = bricks(box, false), col = 0, dir = rk2.length ? rk2[rk2.length - 1] : 0; for (var k = rk2.length - 1; k >= 0 && rk2[k] === dir; k--) col++; return { dir: dir, target: px + dir * col * box * 3, col: col }; })();
  push(R('pnf_target', G, 'Point & Figure target (vertical count, ½ ATR box, 3-box)', 'print', 0, pnf.dir ? (pnf.col + ' boxes → $' + fmt(pnf.target)) : '—', 'a projected target — sizing, not a side'));
  push(R('range_bar_rev', G, 'Range Bar reversal detector', 'vote', (rngOf(cb0) >= a14 && rngOf(cb1) >= a14 && isUp(cb0) !== isUp(cb1)) ? (isUp(cb0) ? 1 : -1) : 0, 'ranges ' + fmt(rngOf(cb1)) + ' → ' + fmt(rngOf(cb0)), 'two full-ATR bars flipping colour = the reversal bar’s side'));
  push(R('tier17_dup', G, 'Gold Market Regime Filter · Structure Pulse (BOS/CHoCH) · BSL/SSL sweeps (MSS) · KongTrade · IGT boxes · OTE · killzones · OB & imbalance mapper · Golden Algo ATR filter · PAT (candles) · ScalpPro fib · Chandelier · HalfTrend · Trend Meter · Cipher B · LazyBear squeeze · Madrid · SuperTrend AI · HA smoothed oscillator · F41 structure map', 'print', 0, 'fed above', 'counted elsewhere — never twice'));
  push(R('tier17_na', G, 'Gold XAUUSD Scalping Indicator · Golden Wolf EA / VWAP / Grid · SignalBots extension · PipFinite Trend Pro · Advanced Supply Demand · Pips Miner Gold · 100 Pips Today · Gold Confluence Sniper', 'n/a', 0, '—', 'proprietary / grid / bot products — never approximated'));

  /* ---------------- PROPRIETARY PRODUCTS (named, undisclosed logic) ---------------- */
  G = 'PROPRIETARY (NOT COMPUTABLE)';
  var props = ['Gold M5 Buy Sell Non-Repaint', 'Gold Scalper Pro', 'XAUUSD Scalping Master', 'Gold-Pro Template', 'Forex Gold Investor', 'Dark Venus', 'Pips Miner Gold', 'Goldmine', '100 Pips Daily Scalper',
    'XAUUSD Power (Velocity Matrix)', 'Gold Emperor', 'Gold-Vanguard Market Signals Pro', 'Reversal Probability Engine', 'Xmaster Formula', 'Pafx Secret', 'Blautvi',
    'Criptom4N', 'ALGOX v3/v6/v11', 'NAS Ultimate Algo 2.0', 'MG Algo', 'Mayfair FX Scalper AI', 'GG-SHOT', 'Smart Money Algo Pro', 'SFX Algo', 'DTC v1.35', 'Infinity Algo', 'IMBA Algo', 'Punk Algo', 'Sniper Entry Pro', 'EMA Stock Burner', 'Eyops FX Premium',
    'Gueta Position Sizer (needs account equity)', 'Trade Excursion MFE/MAE (needs a trade history)'];
  for (var pi = 0; pi < props.length; pi++) push(R('prop_' + pi, G, props[pi], 'n/a', 0, '—', 'proprietary / undocumented logic — never approximated, never faked'));

  /* ---------------- STRUCTURE + CANDLES + HTF (the gold desks’ own reads) ---------------- */
  G = 'STRUCTURE / HTF';
  push(R('bos', G, 'fractal break of structure', 'vote', (isFinite(fH) && px > fH) ? 1 : (isFinite(fL) && px < fL) ? -1 : 0, 'H ' + fmt(fH) + ' · L ' + fmt(fL), 'close through the last confirmed fractal'));
  var fv = freshFvg(rows, 40);
  push(R('fvg', G, 'fresh FVG touch', 'vote', fv ? fv.dir : 0, fv ? fmt(fv.lo) + '–' + fmt(fv.hi) + ' · ' + fv.age + ' bars' : 'none touched', 'inside an unfilled gap, on the gap’s side'));
  var cu = cusum(C, 3);
  push(R('cusum', G, 'CUSUM shift (≤20 bars)', 'vote', cu ? cu.dir : 0, cu ? (cu.dir > 0 ? 'up' : 'down') + ' ' + cu.barsAgo + ' bars ago' : 'none', 'last detected mean shift'));
  var tsm = (px - C[n - 21]) / C[n - 21];
  push(R('tsmom', G, 'TSMOM 20', 'vote', band(tsm, 0.001, -0.001), fmt(tsm * 100, 2) + '%', '20-bar return beyond ±0.1%'));
  var sqOn = (bbu < kem + 1.5 * a14 && bbl > kem - 1.5 * a14), sqPrev = false;
  (function(){ var C2 = C.slice(0, n - 1), m2 = last(sma(C2, 20)), s2 = last(stdev(C2, 20)), a2 = at(A14, 1), e2 = last(ema(C2, 20)); sqPrev = (m2 + 2 * s2 < e2 + 1.5 * a2) && (m2 - 2 * s2 > e2 - 1.5 * a2); })();
  var momS = px - (hhll(rows, 20, i, true) + hhll(rows, 20, i, false) + bbm) / 3;
  push(R('squeeze', G, 'TTM squeeze release', 'vote', (sqPrev && !sqOn) ? sgn(momS) : 0, sqOn ? 'squeezing' : sqPrev ? 'released' : 'open', 'fires only on the release bar, in the momentum direction'));
  var b0 = rows[i], b1 = rows[i - 1], b2 = rows[i - 2];
  var eng = (b0.c > b0.o && b1.c < b1.o && b0.c > b1.o && b0.o < b1.c) ? 1 : (b0.c < b0.o && b1.c > b1.o && b0.c < b1.o && b0.o > b1.c) ? -1 : 0;
  push(R('engulf', G, 'candle: engulfing', 'vote', eng, eng ? (eng > 0 ? 'bullish' : 'bearish') : 'none', 'last closed bar engulfs the prior body'));
  var rng = b0.h - b0.l, body = Math.abs(b0.c - b0.o), upW = b0.h - Math.max(b0.c, b0.o), dnW = Math.min(b0.c, b0.o) - b0.l;
  var pin = (rng > 0 && body < rng * 0.3 && dnW > rng * 0.6) ? 1 : (rng > 0 && body < rng * 0.3 && upW > rng * 0.6) ? -1 : 0;
  push(R('pin', G, 'candle: pin bar', 'vote', pin, pin ? (pin > 0 ? 'hammer' : 'shooting star') : 'none', 'a wick ≥60% of the range rejecting one side'));
  var tb = (b2.c < b2.o && b1.l < b2.l && b0.c > b1.h) ? 1 : (b2.c > b2.o && b1.h > b2.h && b0.c < b1.l) ? -1 : 0;
  push(R('threebar', G, 'candle: three-bar reversal', 'vote', tb, tb ? (tb > 0 ? 'bullish' : 'bearish') : 'none', 'extreme then a close back through the middle bar'));
  if (rows1h && rows1h.length >= MIN_1H){
    var C1 = closes(rows1h), e50h = ema(C1, 50), e200h = ema(C1, 200), r1 = last(rsi(C1, 14));
    push(R('h1_ema50', G, '1H EMA 50 slope (3 bars)', 'vote', slopeVote(e50h, 3, 0.0005), fmt(last(e50h)), 'higher-timeframe trend'));
    push(R('h1_ema200', G, '1H price vs EMA 200', 'vote', vs(last(C1), last(e200h)), fmt(last(C1)) + ' / ' + fmt(last(e200h)), 'higher-timeframe regime'));
    push(R('h1_rsi', G, '1H RSI 14', 'vote', band(r1, 55, 45), fmt(r1, 1), '>55 long · <45 short'));
  } else {
    push(R('h1_ema50', G, '1H EMA 50 slope', 'print', 0, '—', '1h leg not available — neutral, never guessed'));
    push(R('h1_ema200', G, '1H price vs EMA 200', 'print', 0, '—', '1h leg not available'));
    push(R('h1_rsi', G, '1H RSI 14', 'print', 0, '—', '1h leg not available'));
  }
  var vAvg = last(sma(VOL, 20));
  var part = { name: 'participation (15m volume vs 20-bar avg)', read: fmt(vAvg ? b0.v / vAvg : NaN, 2) + 'x', note: 'printed only — OMNIGOLD measured volume-on-trigger pointing the wrong way on gold (passed 27.7% n=2856 vs vetoed 35.2% n=1737); never a vote' };
  /* regime summary from the regime reads: chop when the chop-reading gates outnumber the trend-reading ones */
  var chopN = 0, trendN = 0;
  for (var ri = 0; ri < out.length; ri++){ if (out[ri].kind !== 'regime') continue; if (['chop', 'adx', 'vhf', 'ht_mode'].indexOf(out[ri].id) < 0) continue; if (out[ri].regime < 0) chopN++; else if (out[ri].regime > 0) trendN++; }
  var regime = chopN >= 3 ? 'chop' : (trendN >= 2 && chopN === 0) ? 'trend' : 'mixed';
  return { votes: out, price: px, atr: a14, participation: part, regime: regime, regimeCounts: { chop: chopN, trend: trendN }, bar: { t: b0.t, o: b0.o, h: b0.h, l: b0.l, c: b0.c } };
}

/* =========================== the engine =========================== */
function closedRows(rows, ivSec, nowMs){
  if (!Array.isArray(rows)) return [];
  var cut = Math.floor(nowMs / 1000), out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !isFinite(+r.t) || !isFinite(+r.o) || !isFinite(+r.h) || !isFinite(+r.l) || !isFinite(+r.c)) continue;
    if (+r.t + ivSec <= cut) out.push({ t: +r.t, o: +r.o, h: +r.h, l: +r.l, c: +r.c, v: isFinite(+r.v) ? +r.v : 0 });
  }
  return out;
}
function goldUltraEngine(inp){
  inp = inp || {};
  var nowMs = isFinite(+inp.now) ? +inp.now : Date.now();
  var rows = closedRows(inp.rows15m, 900, nowMs), r1h = closedRows(inp.rows1h, 3600, nowMs);
  var rule = Object.assign({}, RULE, inp.rule || {});
  var out = { ok: false, fire: false, dir: null, rule: rule, reasons: [], gates: [], votes: [], price: NaN, nowMs: nowMs,
              barMs: rows.length ? (rows[rows.length - 1].t + 900) * 1000 : null };
  if (rows.length < MIN_15M){ out.reasons.push('not enough closed 15m bars (' + rows.length + ' < ' + MIN_15M + ') — EMA 200 cannot be read; nothing is guessed'); return out; }
  var v = goldUltraVotes(rows, r1h);
  out.ok = true; out.price = v.price; out.atr = v.atr; out.votes = v.votes; out.participation = v.participation; out.bar = v.bar; out.regime = v.regime; out.regimeCounts = v.regimeCounts;
  var L = 0, S = 0, N = 0, K = { vote: 0, regime: 0, print: 0, na: 0 };
  for (var i = 0; i < v.votes.length; i++){
    var r = v.votes[i]; K[r.kind === 'n/a' ? 'na' : r.kind]++;
    if (r.kind !== 'vote') continue;
    if (r.vote > 0) L++; else if (r.vote < 0) S++; else N++;
  }
  var A = L + S, lead = L >= S ? 'long' : 'short', top = Math.max(L, S), pct = A ? top / A : 0;
  out.count = { long: L, short: S, neutral: N, decisive: A, directional: K.vote, total: v.votes.length, kinds: K, pct: pct, lead: lead };
  out.line = top + ' of ' + A + ' decisive reads agree ' + lead.toUpperCase() + ' (' + Math.round(pct * 100) + '%) · ' + N + ' neutral · regime ' + v.regime.toUpperCase();
  if (A < rule.minAvail) out.gates.push('only ' + A + ' decisive reads (< ' + rule.minAvail + ') — the count is too thin to mean anything');
  if (pct < rule.minPct) out.gates.push('agreement ' + Math.round(pct * 100) + '% < ' + Math.round(rule.minPct * 100) + '% — the reads do not agree enough');
  if (rule.regimeGate && v.regime === 'chop') out.gates.push('REGIME reads CHOP (' + v.regimeCounts.chop + ' of 4 strength reads) — the gate holds');
  if (!isFinite(v.atr) || v.atr <= 0) out.gates.push('ATR 14 unreadable — no stop can be priced');
  /* evidence gates are kept apart from the count gates: when the COUNT clears
     the rule but the evidence says it does not pay, the plan is still priced
     and shown as RECORD ONLY — the reader sees exactly what the rule would
     have done, and the card says plainly that it is not a ticket */
  var evGates = [];
  if (!HG_GOLD_ULTRA_EVIDENCE && !inp.allowUnverified) evGates.push('NOT YET MEASURED — no full backtest has been baked; the rule fires nothing as tradable until it is');
  if (HG_GOLD_ULTRA_EVIDENCE && HG_GOLD_ULTRA_EVIDENCE.tradable === false && !inp.allowUnverified) evGates.push('MEASURED NOT TRADABLE — out-of-sample the rule did not pay after costs (see VERIFIED); the count prints for the record, never as a ticket');
  if (out.gates.length){ out.reasons = out.gates.concat(evGates); out.gates = out.reasons.slice(); return out; }
  out.recordOnly = evGates.length > 0;
  if (out.recordOnly){ out.gates = evGates.slice(); out.reasons = evGates.slice(); }
  var entry = v.price, risk = rule.stopAtr * v.atr, floorNote = null, vc = inp.venueCost;
  if (vc && isFinite(+vc.rtFrac) && +vc.rtFrac > 0){
    var floorD = rule.costFloorMult * (+vc.rtFrac) * entry;
    if (risk < floorD){ floorNote = 'stop widened from ' + fmt(risk) + ' to the ' + (vc.venue || 'venue') + ' cost floor ' + fmt(floorD) + ' (' + rule.costFloorMult + ' x ' + (100 * +vc.rtFrac).toFixed(3) + '% RT)'; risk = floorD; }
  } else out.gates.push('venue cost unknown — cost floor not applied (said, not hidden)');
  var s = lead === 'long' ? 1 : -1;
  out.fire = !out.recordOnly; out.dir = lead;
  out.plan = { entry: entry, stop: entry - s * risk, t1: entry + s * rule.t1R * risk, t2: entry + s * rule.t2R * risk, risk: risk, rr1: rule.t1R, rr2: rule.t2R,
               orderType: lead === 'long' ? 'BUY' : 'SELL', stopAtr: risk / v.atr, floorNote: floorNote, timeoutBars: rule.timeoutBars };
  return out;
}

/* =========================== SETUPS — the paying desk, stamped by the count ===========================
   hg-v707. The plain vote lost on its own (VERIFIED). scripts/backtest-
   goldultra-filter.mjs then joined every GOLD SCALP trade to the ULTRA read
   of ITS OWN signal bar. The setups the scalp desk actually crowns — the
   edge-table PREFER rows, both reversal mechanics — paid MORE when they
   traded AGAINST the consensus and went flat when they traded WITH it, the
   same sign in-sample and out-of-sample and in both book cuts. So this tab's
   setups ARE the GOLD SCALP prefer-book candidates, and the count is a
   contrarian confluence stamp on them: AGAINST CONSENSUS crowns, WITH
   CONSENSUS is shown and never crowned, NEUTRAL (thin / under 55%) is shown
   unstamped. Numbers below are the measured ones; n is small and SAID. */
var GU_PREFER = ['p6fail', 'p9volbar'];              /* goldind HG_GOLD_SETUP_EDGE.scalp action:'prefer' */
var GU_SHOWN = GU_PREFER.concat(['sweepob', 'p8range']); /* unproven, not discredited — shown, never crowned */
var HG_GOLD_ULTRA_FILTER = {
  generated: '2026-09-11T18:22:52Z', source: 'scripts/backtest-goldultra-filter.mjs · GOLD SCALP trades (scripts/backtest-goldscalp-results.json, XM costs) joined to the ULTRA read of their signal bar',
  x: 0.55, minAvail: 25,
  book: 'GOLD SCALP prefer rows p6fail (S30 failed-break reversal) + p9volbar (S62 volume-bar sweep)',
  prefer: { baseline: { ins: { n: 109, net: 0.225 }, oos: { n: 48, net: 0.021, win: 0.44 } },
            against: { ins: { n: 37, net: 0.36 }, oos: { n: 15, net: 0.373 } },
            with: { ins: { n: 60, net: 0.125 }, oos: { n: 23, net: -0.078, win: 0.39 } } },
  notDiscredited: { baseline: { ins: { n: 207, net: 0.162 }, oos: { n: 90, net: 0.038, win: 0.43 } },
                    against: { ins: { n: 66, net: 0.199 }, oos: { n: 34, net: 0.306 } },
                    with: { ins: { n: 113, net: 0.132 }, oos: { n: 39, net: -0.042 } } },
  verdict: 'The prefer-book reversal setups pay more AGAINST the ULTRA consensus (+0.36R in-sample n=37, +0.37R out-of-sample n=15; +0.20R / +0.31R on the wider not-discredited book n=66 / 34) and go flat-to-negative WITH it (+0.13R / −0.08R). Same sign in both windows and both cuts — a contrarian confluence stamp, not a signal of its own. Out-of-sample n is small: read it as a ranking preference, size accordingly.',
  limitations: ['out-of-sample AGAINST n=15 on the prefer book (34 on the wider book) — a preference with a consistent sign, not a statistically settled edge',
                'offline every GOLD SCALP candidate carries a demote stamp (live feeds absent), so the cut is by strategy key, exactly the rows the live desk crowns',
                'the plain ULTRA vote itself measured −0.215R OOS and stays RECORD ONLY; only the desk’s own measured setups are ever crowned here',
                'one split of one regime of gold history; PAXGUSDT proxy at XM costs, as every gold harness']
};
function guConfluence(c, count){
  if (!count || count.decisive < HG_GOLD_ULTRA_FILTER.minAvail || count.pct < HG_GOLD_ULTRA_FILTER.x) return 'NEUTRAL';
  return count.lead === c.dir ? 'WITH' : 'AGAINST';
}
/* same rule as lib/xm-order-type.mjs (pinned by tests/test-goldultra.mjs) */
function guOrderWord(dir, entry, livePx){
  var long = dir !== 'short', e = +entry, live = +livePx;
  if (!isFinite(live) || live <= 0 || !isFinite(e) || e <= 0) return long ? 'BUY LIMIT' : 'SELL LIMIT';
  if (Math.abs(e - live) / live <= 0.0003) return long ? 'BUY' : 'SELL';
  if (long) return e < live ? 'BUY LIMIT' : 'BUY STOP';
  return e > live ? 'SELL LIMIT' : 'SELL STOP';
}
function guNorm(c){
  var f = function(x){ var v = +x; return isFinite(v) ? v : NaN; };
  return { source: 'GOLD SCALP', strategy: c.strategy || c.stratKey || 'SETUP', stratKey: c.stratKey || null, dir: c.dir, grade: typeof c.grade === 'string' ? c.grade : null,
           entry: f(c.entry), stop: f(c.stop), t1: f(c.t1), t2: f(c.t2), rr: f(isFinite(f(c.rr)) ? c.rr : c.rr1), rr2: f(c.rr2),
           tally: f(c.tally), confScore: f(c.confScore), demoted: !!c.demoted, vetoed: !!c.vetoed,
           stamps: Array.isArray(c.stamps) ? c.stamps.slice() : [], gateNotes: Array.isArray(c.gateNotes) ? c.gateNotes.slice() : [],
           why: c.why || null, edge: (c.edge && typeof c.edge === 'object') ? { action: c.edge.action || null, n: f(c.edge.n), net: f(c.edge.net), why: c.edge.why ? String(c.edge.why) : '' } : null };
}
function guSidesOk(c){
  if (!isFinite(c.entry) || !isFinite(c.stop) || !isFinite(c.t1)) return false;
  return c.dir === 'long' ? (c.stop < c.entry && c.t1 > c.entry) : (c.stop > c.entry && c.t1 < c.entry);
}
async function laneGoldScalp(gold, now){
  var out = { cands: [], held: [], dark: null };
  var setupsFn = gfn('goldScalpSetups');
  if (!setupsFn){ out.dark = 'GOLD SCALP engine dark — goldScalpSetups (goldind.js) not loaded; no setups can be sourced'; return out; }
  if (!gold.rows15m.length){ out.held.push('no 15m bars from any feed — lane skipped'); return out; }
  var cands = null;
  try{ cands = setupsFn({ rows15m: gold.rows15m, rows1h: gold.rows1h, rows4h: gold.rows4h, dailyCandles: (gold.rows1d && gold.rows1d.length) ? gold.rows1d : undefined, now: now, news: null }); }
  catch(e){ out.held.push('detector threw: ' + ((e && e.message) || e)); return out; }
  if (!Array.isArray(cands)) return out;
  var i, rj = cands.rejected || [];
  for (i = 0; i < rj.length; i++) if (rj[i]) out.held.push((rj[i].strategy || 'setup') + ' · ' + String(rj[i].dir || '').toUpperCase() + ' — ' + (rj[i].reason || 'failed a quality gate'));
  for (i = 0; i < cands.length; i++) if (cands[i]){ cands[i].venue = 'GOLD ULTRA'; cands[i].sym = 'XAUUSD'; }
  var ranked = cands, rankFn = gfn('goldRankSetups');
  if (rankFn){
    var ctx = { now: now, news: null, style: 'goldscalp', rows15m: gold.rows15m, rows1h: gold.rows1h, rows4h: gold.rows4h };
    try{ var sf = gfn('goldSeason'); if (sf) ctx.season = sf(now); }catch(eS){}
    try{ var cv = gfn('goldCrossVenueMap'); if (cv) ctx.crossVenue = cv(cands); }catch(eC){}
    var rk = null; try{ rk = rankFn(cands, ctx); }catch(eR){ rk = null; }
    if (rk && Array.isArray(rk.ranked)){ ranked = rk.ranked; var rr = rk.rejected || []; for (i = 0; i < rr.length; i++) if (rr[i]) out.held.push((rr[i].strategy || 'setup') + ' · ' + String(rr[i].dir || '').toUpperCase() + ' — ' + (rr[i].reason || 'failed a quality gate')); }
  }
  var pgFn = gfn('hgFilterGoldPostGate');
  if (pgFn){
    try{ ranked = await pgFn(ranked, { 'GOLD ULTRA': { rows15m: gold.rows15m } }, gold.rows4h, 'gold-scalp'); }
    catch(ePg){ var mk = gfn('hgMarkGateUnchecked'), why = 'post-gate filter threw: ' + ((ePg && ePg.message) || ePg); for (var q = 0; q < ranked.length; q++) if (mk && ranked[q]) mk(ranked[q], [why]); }
    if (!Array.isArray(ranked)) ranked = [];
  }
  for (i = 0; i < ranked.length; i++){ var c = ranked[i]; if (c && (c.dir === 'long' || c.dir === 'short')) out.cands.push(guNorm(c)); }
  return out;
}
function selectSetups(cands, count){
  var sel = { pick: null, cards: [], held: [] };
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (!guSidesOk(c)){ sel.held.push(c.strategy + ' · ' + c.dir.toUpperCase() + ' — levels incomplete or on the wrong side; never tradable'); continue; }
    c.confluence = guConfluence(c, count);
    c.book = GU_PREFER.indexOf(c.stratKey) >= 0 ? 'prefer' : GU_SHOWN.indexOf(c.stratKey) >= 0 ? 'unproven' : 'other';
    c.crownable = c.book === 'prefer' && !c.demoted && !c.vetoed && c.confluence === 'AGAINST';
    sel.cards.push(c);
  }
  sel.cards.sort(function(a, b){
    var ra = (a.crownable ? 0 : a.book === 'prefer' ? 1 : a.book === 'unproven' ? 2 : 3) - (b.crownable ? 0 : b.book === 'prefer' ? 1 : b.book === 'unproven' ? 2 : 3);
    if (ra) return ra;
    var ca = isFinite(a.confScore) ? a.confScore : -1, cb = isFinite(b.confScore) ? b.confScore : -1;
    return cb - ca || ((isFinite(b.tally) ? b.tally : 0) - (isFinite(a.tally) ? a.tally : 0));
  });
  for (var k = 0; k < sel.cards.length; k++) if (sel.cards[k].crownable){ sel.pick = sel.cards[k]; break; }
  return sel;
}
function measuredLine(kind, book){
  var F = HG_GOLD_ULTRA_FILTER, b = book === 'prefer' ? F.prefer : F.notDiscredited;
  if (kind === 'AGAINST') return 'MEASURED · against the consensus: ' + fmtR(b.against.ins.net) + ' in-sample (n=' + b.against.ins.n + ') · ' + fmtR(b.against.oos.net) + ' out-of-sample (n=' + b.against.oos.n + ') · baseline ' + fmtR(b.baseline.oos.net) + ' (n=' + b.baseline.oos.n + ')';
  if (kind === 'WITH') return 'MEASURED · with the consensus: ' + fmtR(b.with.ins.net) + ' in-sample (n=' + b.with.ins.n + ') · ' + fmtR(b.with.oos.net) + ' out-of-sample (n=' + b.with.oos.n + ') — flat, never crowned';
  return 'count thin or under ' + Math.round(F.x * 100) + '% — no confluence read; the desk’s own record stands';
}
function setupCardHTML(c, pxNow, crowned){
  var chips = '<span class="gu-chip">GOLD SCALP</span><span class="gu-chip">' + esc(c.strategy) + '</span>'
    + (c.grade ? '<span class="gu-chip">GRADE ' + esc(c.grade) + '</span>' : '')
    + (isFinite(c.confScore) ? '<span class="gu-chip">conf ' + fmt(c.confScore, 0) + '</span>' : '')
    + '<span class="gu-chip ' + (c.confluence === 'AGAINST' ? 'ok' : c.confluence === 'WITH' ? 'warn' : '') + '">' + (c.confluence === 'AGAINST' ? 'AGAINST CONSENSUS — crownable' : c.confluence === 'WITH' ? 'WITH CONSENSUS — never crowned' : 'NO CONFLUENCE READ') + '</span>'
    + (c.book === 'prefer' ? '<span class="gu-chip ok">PREFER ROW (measured fee-survivor)</span>' : c.book === 'unproven' ? '<span class="gu-chip warn">UNPROVEN — not discredited, never crowned</span>' : '<span class="gu-chip warn">NOT A PREFER ROW — never crowned</span>')
    + (c.demoted ? '<span class="gu-chip warn">DEMOTED by its desk</span>' : '') + (c.vetoed ? '<span class="gu-chip warn">VETOED</span>' : '');
  for (var s = 0; s < c.stamps.length; s++) chips += '<span class="gu-chip warn">' + esc(c.stamps[s]) + '</span>';
  var risk = Math.abs(c.entry - c.stop), t2 = isFinite(c.t2) ? c.t2 : (c.dir === 'long' ? c.entry + 2.5 * risk : c.entry - 2.5 * risk);
  var rr1 = isFinite(c.rr) ? c.rr : Math.abs(c.t1 - c.entry) / risk, away = isFinite(pxNow) ? (c.entry - pxNow) : NaN;
  return '<div class="gu-setup' + (crowned ? ' crowned' : '') + '">'
    + (crowned ? '<div class="gu-crown">BEST SETUP — GOLD SCALP prefer row, AGAINST the consensus</div>' : '')
    + '<div class="gu-chips">' + chips + '</div>'
    + '<div class="gu-plan">' + esc(guOrderWord(c.dir, c.entry, pxNow)) + ' <b>$' + esc(fmt(c.entry)) + '</b>'
    + (isFinite(away) ? ' <span class="gu-away">' + (Math.abs(away) / pxNow <= 0.0003 ? 'at the last trade' : '$' + esc(fmt(Math.abs(away))) + ' ' + (away < 0 ? 'below' : 'above') + ' the last trade ($' + esc(fmt(pxNow)) + ') — resting order') + '</span>' : '')
    + ' · STOP <b>$' + esc(fmt(c.stop)) + '</b> · TP1 <b>$' + esc(fmt(c.t1)) + '</b> (' + esc(fmt(rr1, 1)) + 'R) · TP2 <b>$' + esc(fmt(t2)) + '</b>'
    + '<br>At TP1 close 50%, stop to breakeven ($' + esc(fmt(c.entry)) + '); runner to TP2. A 15m close beyond the stop kills the idea.</div>'
    + '<div class="gu-measured">' + esc(measuredLine(c.confluence, c.book)) + (c.edge && c.edge.why ? ' · desk row: ' + esc(c.edge.why) : '') + '</div>'
    + (c.why ? '<div class="gu-why">' + esc(c.why) + '</div>' : '')
    + (c.demoted && c.gateNotes.length ? '<div class="gu-gate">' + esc(c.gateNotes.join(' · ')) + '</div>' : '')
    + '</div>';
}
function setupsHTML(sel, lane, pxNow, count){
  var h = '<div class="gu-sechead">SETUPS — the GOLD SCALP prefer book, stamped by the ULTRA count</div>';
  if (lane.dark){ h += '<div class="gu-gate"><b>ENGINE DARK</b> — ' + esc(lane.dark) + '</div>'; return h; }
  if (!sel.cards.length){ h += '<div class="gu-gate"><b>NO SETUPS</b> — GOLD SCALP produced no candidate this bar' + (lane.held.length ? ' (' + lane.held.length + ' held back below)' : '') + '. Nothing is fabricated.</div>'; }
  else {
    if (!sel.pick) h += '<div class="gu-demhead">no crowned setup — no prefer-row candidate reads AGAINST the consensus (count ' + (count ? Math.round(count.pct * 100) + '% ' + count.lead.toUpperCase() : '—') + '); the cards below are shown for the record</div>';
    for (var i = 0; i < sel.cards.length; i++) h += setupCardHTML(sel.cards[i], pxNow, sel.cards[i] === sel.pick);
  }
  var held = sel.held.concat(lane.held);
  if (held.length){ h += '<div class="gu-held"><b>HELD BACK (the desk’s own reasons)</b>'; for (var k = 0; k < Math.min(6, held.length); k++) h += '<div>✕ ' + esc(held[k]) + '</div>'; if (held.length > 6) h += '<div>… and ' + (held.length - 6) + ' more</div>'; h += '</div>'; }
  return h;
}
function filterEvidenceHTML(){
  var F = HG_GOLD_ULTRA_FILTER;
  return '<div class="gu-ev"><div class="gu-evhead">VERIFIED · the count as a CONFLUENCE STAMP on the GOLD SCALP prefer book</div>'
    + '<div class="gu-evline">' + esc(F.book) + ' · stamp threshold ' + Math.round(F.x * 100) + '% of ≥' + F.minAvail + ' decisive reads</div>'
    + '<table class="gu-tbl"><tr><th>cohort</th><th>in-sample n</th><th>avgR net @XM</th><th>out-of-sample n</th><th>avgR net @XM</th></tr>'
    + '<tr><td>prefer book · baseline</td><td>' + F.prefer.baseline.ins.n + '</td><td>' + fmtR(F.prefer.baseline.ins.net) + '</td><td>' + F.prefer.baseline.oos.n + '</td><td>' + fmtR(F.prefer.baseline.oos.net) + '</td></tr>'
    + '<tr><td>prefer book · AGAINST consensus</td><td>' + F.prefer.against.ins.n + '</td><td>' + fmtR(F.prefer.against.ins.net) + '</td><td>' + F.prefer.against.oos.n + '</td><td>' + fmtR(F.prefer.against.oos.net) + '</td></tr>'
    + '<tr><td>prefer book · WITH consensus</td><td>' + F.prefer.with.ins.n + '</td><td>' + fmtR(F.prefer.with.ins.net) + '</td><td>' + F.prefer.with.oos.n + '</td><td>' + fmtR(F.prefer.with.oos.net) + '</td></tr>'
    + '<tr><td>not-discredited book · AGAINST</td><td>' + F.notDiscredited.against.ins.n + '</td><td>' + fmtR(F.notDiscredited.against.ins.net) + '</td><td>' + F.notDiscredited.against.oos.n + '</td><td>' + fmtR(F.notDiscredited.against.oos.net) + '</td></tr>'
    + '<tr><td>not-discredited book · WITH</td><td>' + F.notDiscredited.with.ins.n + '</td><td>' + fmtR(F.notDiscredited.with.ins.net) + '</td><td>' + F.notDiscredited.with.oos.n + '</td><td>' + fmtR(F.notDiscredited.with.oos.net) + '</td></tr></table>'
    + '<div class="gu-evnote"><b>read it straight:</b> ' + esc(F.verdict) + '</div>'
    + '<div class="gu-evnote"><b>stated limitations</b><ul>' + F.limitations.map(function(l){ return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>'
    + '<div class="gu-evnote">generated ' + esc(F.generated) + ' · ' + esc(F.source) + '</div></div>';
}

/* =========================== evidence panel =========================== */
function esc(s){ return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pct(x){ return (x !== null && x !== undefined && isFinite(x)) ? (100 * x).toFixed(1) + '%' : '—'; }
function fmtR(x){ return (x !== null && x !== undefined && isFinite(x)) ? (x >= 0 ? '+' : '') + Number(x).toFixed(3) + 'R' : '—'; }
function evidenceHTML(){
  var E = HG_GOLD_ULTRA_EVIDENCE;
  if (!E) return '<div class="gu-ev"><b>VERIFIED RESULTS — NOT YET MEASURED.</b> No full run of scripts/backtest-goldultra.mjs has been baked into this file, so the rule fires nothing as tradable. The read table above still shows every read honestly.</div>';
  var o = E.oos || {}, ins = E.ins || {}, r = E.rows || [];
  var h = '<div class="gu-ev"><div class="gu-evhead">VERIFIED RESULTS · out-of-sample (last ' + esc(E.oosShare) + ' of history, untouched when the rule was chosen)</div>'
    + '<div class="gu-evline">chosen in-sample: <b>' + Math.round(E.rule.minPct * 100) + '% agreement</b> of ≥' + E.rule.minAvail + ' decisive reads · regime gate ' + (E.rule.regimeGate ? 'ON' : 'OFF') + ' · stop ' + E.rule.stopAtr + '×ATR · TP1 ' + E.rule.t1R + 'R · TP2 ' + E.rule.t2R + 'R</div>'
    + '<div class="gu-evline"><b>OOS · n=' + o.n + '</b> · win ' + pct(o.winRate) + ' · avg R net @XM <b>' + fmtR(o.avgR_net_xm) + '</b> · @PAXG ' + fmtR(o.avgR_net_paxg) + ' · span ' + esc(E.oosSpan) + '</div>'
    + '<div class="gu-evline">in-sample (where the rule was picked — NOT the claim): n=' + ins.n + ' · win ' + pct(ins.winRate) + ' · avg R net @XM ' + fmtR(ins.avgR_net_xm) + '</div>';
  if (r.length){
    h += '<table class="gu-tbl"><tr><th>cohort (OOS)</th><th>n</th><th>win</th><th>avgR net @XM</th><th>avgR net @PAXG</th></tr>';
    for (var i = 0; i < r.length; i++) h += '<tr><td>' + esc(r[i].label) + '</td><td>' + r[i].n + '</td><td>' + pct(r[i].winRate) + '</td><td>' + fmtR(r[i].avgR_net_xm) + '</td><td>' + fmtR(r[i].avgR_net_paxg) + '</td></tr>';
    h += '</table>';
  }
  h += '<div class="gu-evnote"><b>read it straight:</b> ' + esc(E.verdict) + '</div>';
  if (E.limitations && E.limitations.length) h += '<div class="gu-evnote"><b>stated limitations</b><ul>' + E.limitations.map(function(l){ return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>';
  h += '<div class="gu-evnote">generated ' + esc(E.generated) + ' · ' + esc(E.symbol) + ' · ' + esc(E.bars) + ' bars</div></div>';
  return h;
}

/* =========================== UI =========================== */
var GU_CSS = ''
+ '.gu-rule{font-size:11px;line-height:1.6;padding:8px 11px;border-radius:6px;background:#0F172A;color:#E2E8F0;border:1px solid #334155;margin-top:8px}.gu-rule b{color:#FCD34D}'
+ '.gu-count{font-size:15px;font-weight:800;letter-spacing:.04em;margin-top:10px;padding:10px 12px;border-radius:8px;border:1px solid #475569;background:#1E293B;color:#F8FAFC}'
+ '.gu-count.long{border-color:#16A34A;background:#052E16;color:#BBF7D0}.gu-count.short{border-color:#DC2626;background:#450A0A;color:#FECACA}'
+ '.gu-count small{display:block;font-size:10px;font-weight:600;letter-spacing:.06em;opacity:.85;margin-top:4px}'
+ '.gu-plan{font-size:11px;margin-top:8px;padding:8px 11px;border-radius:6px;background:#1E293B;border:1px solid #475569;color:#E2E8F0;line-height:1.7}.gu-plan b{color:#67E8F9}'
+ '.gu-gate{font-size:10px;color:#FDBA74;margin-top:6px;line-height:1.55;border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:6px 9px;background:rgba(234,88,12,.06)}'
+ '.gu-tbl{width:100%;border-collapse:collapse;font-size:10px;margin-top:8px}.gu-tbl th,.gu-tbl td{border-bottom:1px solid #334155;padding:4px 6px;text-align:left;vertical-align:top}.gu-tbl th{font-size:9px;letter-spacing:.08em;color:#94A3B8}'
+ '.gu-v1{color:#16A34A;font-weight:800}.gu-v-1{color:#DC2626;font-weight:800}.gu-v0{color:#94A3B8}.gu-k{font-size:9px;letter-spacing:.06em;color:#94A3B8}'
+ '.gu-grp{font-size:9px;letter-spacing:.1em;color:#94A3B8;font-weight:800;padding-top:8px}'
+ '.gu-ev{font-size:10px;margin-top:10px;padding:9px 11px;border-radius:6px;border:1px solid rgba(201,146,26,.5);background:rgba(201,146,26,.06);color:#FDE68A;line-height:1.6}'
+ '.gu-evhead{font-size:10px;letter-spacing:.1em;font-weight:800;color:#FBBF24}.gu-evline{margin-top:4px}.gu-evnote{margin-top:6px;color:#FCD34D}.gu-evnote ul{margin:4px 0 0 14px;padding:0}'
+ '.gu-part{font-size:9px;color:#94A3B8;margin-top:6px}'
+ '.gu-sechead{font-size:10px;letter-spacing:.12em;font-weight:800;color:#0F172A;margin:12px 0 4px}'
+ '.gu-setup{border:1px solid #CBD5E1;border-radius:8px;padding:9px 11px;margin-top:8px;background:#FFFFFF}'
+ '.gu-setup.crowned{border:2px solid #C9921A;background:#FFFBEB}'
+ '.gu-crown{font-size:10px;letter-spacing:.12em;font-weight:800;color:#92400E;margin-bottom:6px}'
+ '.gu-chips{display:flex;flex-wrap:wrap;gap:4px}'
+ '.gu-chip{font-size:9px;letter-spacing:.06em;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid #CBD5E1;color:#334155;background:#F8FAFC}'
+ '.gu-chip.ok{color:#166534;border-color:rgba(22,163,74,.5);background:rgba(22,163,74,.08)}.gu-chip.warn{color:#9A3412;border-color:rgba(234,88,12,.45);background:rgba(234,88,12,.08)}'
+ '.gu-away{display:inline-block;font-size:9px;letter-spacing:.04em;color:#FDBA74;font-weight:600}'
+ '.gu-measured{font-size:10px;color:#92400E;margin-top:6px;line-height:1.55;border:1px dashed rgba(201,146,26,.5);border-radius:6px;padding:5px 8px;background:rgba(201,146,26,.06)}'
+ '.gu-why{font-size:10px;color:#475569;margin-top:5px;line-height:1.5}'
+ '.gu-demhead{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:8px 11px;margin:8px 0;line-height:1.55;background:#FFF7ED;font-weight:600}'
+ '.gu-held{font-size:10px;color:#475569;margin-top:8px;line-height:1.6}.gu-held b{letter-spacing:.08em;font-size:9px}';

var __ui = null, __last = null, __busy = false;
function setStat(ui, s, bad){ try{ if (ui && ui.stat){ ui.stat.textContent = s; ui.stat.style.color = bad ? '#DC2626' : ''; } }catch(e){} }
function gfn(name){ try{ if (typeof W[name] === 'function') return W[name]; }catch(e){} return null; }
async function fetchRows(){
  var out = { rows15m: [], rows1h: [], rows4h: [], rows1d: [], src: null }, ggc = gfn('getGoldCandles'), bk = gfn('binanceKlines');
  if (ggc){
    try{ var a = await ggc('15m', KL_15M); if (a && a.rows && a.rows.length){ out.rows15m = a.rows; out.src = a.source || 'gold'; } }catch(e1){}
    try{ var b = await ggc('1h', KL_1H); if (b && b.rows && b.rows.length) out.rows1h = b.rows; }catch(e2){}
    try{ var c4 = await ggc('4h', 220); if (c4 && c4.rows && c4.rows.length) out.rows4h = c4.rows; }catch(e5){}
    try{ var d1 = await ggc('1d', 260); if (d1 && d1.rows && d1.rows.length) out.rows1d = d1.rows; }catch(e6){}
  }
  if (bk){
    if (!out.rows15m.length){ try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length){ out.rows15m = p; out.src = 'binance-paxg'; } }catch(e3){} }
    if (!out.rows1h.length){ try{ var q = await bk('PAXGUSDT', '1h', KL_1H); if (q && q.length) out.rows1h = q; }catch(e4){} }
    if (!out.rows4h.length){ try{ var z = await bk('PAXGUSDT', '4h', 220); if (z && z.length) out.rows4h = z; }catch(e7){} }
  }
  return out;
}
function venueCost(){ try{ var f = gfn('hgOgVenueCost'); if (!f) return null; var vc = f(); var rt = vc ? +vc.rtCostPct : NaN; if (!vc || !isFinite(rt)) return null; return { venue: vc.venue || 'venue', rtFrac: rt / 100 }; }catch(e){ return null; } }
function voteTableHTML(res){
  var groups = [], h = '<table class="gu-tbl"><tr><th>read</th><th>value</th><th>kind</th><th>vote</th><th>rule</th></tr>';
  for (var i = 0; i < res.votes.length; i++) if (groups.indexOf(res.votes[i].group) < 0) groups.push(res.votes[i].group);
  for (var g = 0; g < groups.length; g++){
    h += '<tr><td class="gu-grp" colspan="5">' + esc(groups[g]) + '</td></tr>';
    for (var k = 0; k < res.votes.length; k++){
      var v = res.votes[k]; if (v.group !== groups[g]) continue;
      var vt = v.kind === 'vote' ? (v.vote > 0 ? 'LONG' : v.vote < 0 ? 'SHORT' : 'neutral') : v.kind === 'regime' ? (v.regime < 0 ? 'chop' : v.regime > 0 ? 'trend' : '—') : v.kind === 'n/a' ? 'n/a' : '—';
      h += '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.read) + '</td><td class="gu-k">' + esc(v.kind) + '</td><td class="gu-v' + (v.kind === 'vote' ? v.vote : 0) + '">' + vt + '</td><td>' + esc(v.why) + '</td></tr>';
    }
  }
  h += '</table>';
  if (res.participation) h += '<div class="gu-part">' + esc(res.participation.name) + ' ' + esc(res.participation.read) + ' — ' + esc(res.participation.note) + '</div>';
  return h;
}
function renderResult(ui, res, src, sel, lane){
  var h = '';
  if (sel && lane) h += setupsHTML(sel, lane, res.price, res.ok ? res.count : null);
  if (!res.ok){ ui.cards.innerHTML = h + '<div class="gu-gate"><b>COUNT SILENT</b> — ' + esc(res.reasons.join(' · ')) + '</div>' + filterEvidenceHTML() + evidenceHTML(); return; }
  var cls = res.fire ? (res.dir === 'long' ? ' long' : ' short') : '', K = res.count.kinds;
  h += '<div class="gu-sechead">THE COUNT — every read, printed for the record</div>';
  h += '<div class="gu-count' + cls + '">' + esc(res.line)
    + '<small>' + (res.fire ? esc(res.dir.toUpperCase()) + ' FIRES — the rule is met' : res.recordOnly ? 'COUNT MET, RECORD ONLY — ' + esc(res.gates.join(' · ')) : 'NO FIRE — ' + esc(res.gates.join(' · '))) + '</small>'
    + '<small>' + res.count.total + ' reads fed: ' + K.vote + ' vote · ' + K.regime + ' regime · ' + K.print + ' print-only · ' + K.na + ' not applicable · closed 15m bar '
    + new Date(res.bar.t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC · close $' + esc(fmt(res.price)) + ' · ATR14 $' + esc(fmt(res.atr)) + ' · feed ' + esc(src || '—') + '</small></div>';
  if ((res.fire || res.recordOnly) && res.plan){
    var p = res.plan;
    h += '<div class="gu-plan">' + (res.recordOnly ? '<b>RECORD ONLY — NOT A TICKET</b> (measured negative out-of-sample; this is what the rule would have done)<br>' : '') + esc(p.orderType) + ' at the close <b>$' + esc(fmt(p.entry)) + '</b> · STOP <b>$' + esc(fmt(p.stop)) + '</b> (' + esc(fmt(p.stopAtr, 2)) + '×ATR) · TP1 <b>$' + esc(fmt(p.t1)) + '</b> (' + p.rr1 + 'R) · TP2 <b>$' + esc(fmt(p.t2)) + '</b> (' + p.rr2 + 'R) · expires after ' + p.timeoutBars + ' bars (6h)'
      + '<br>At TP1 close 50%, stop to breakeven ($' + esc(fmt(p.entry)) + '); runner to TP2. A 15m close beyond the stop kills the idea.' + (p.floorNote ? '<br>' + esc(p.floorNote) : '') + '</div>';
    if (res.gates.length) h += '<div class="gu-gate">' + esc(res.gates.join(' · ')) + '</div>';
  }
  ui.cards.innerHTML = h + voteTableHTML(res) + filterEvidenceHTML() + evidenceHTML();
}
async function runScan(ui){
  if (__busy) return 'busy';
  __busy = true;
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    setStat(ui, 'reading closed 15m + 1h gold bars…');
    var f = await fetchRows();
    if (!f.rows15m.length){ setStat(ui, 'feeds failed — no gold klines from any source; nothing fabricated', true); return 'error: no feed'; }
    var now = Date.now();
    var res = goldUltraEngine({ rows15m: f.rows15m, rows1h: f.rows1h, now: now, venueCost: venueCost() });
    /* the setups: the GOLD SCALP prefer book, stamped by the count */
    var lane = { cands: [], held: [], dark: null };
    try{ lane = await laneGoldScalp(f, now); }catch(eL){ lane = { cands: [], held: ['lane threw: ' + ((eL && eL.message) || eL)], dark: null }; }
    var sel = selectSetups(lane.cands, res.ok ? res.count : null);
    __last = { at: now, src: f.src, ok: res.ok, fire: res.fire, recordOnly: !!res.recordOnly, dir: res.dir, count: res.count || null, regime: res.regime || null, plan: res.plan || null, line: res.line || null, reasons: res.reasons,
               setups: { pick: sel.pick ? { strategy: sel.pick.strategy, stratKey: sel.pick.stratKey, dir: sel.pick.dir, entry: sel.pick.entry, stop: sel.pick.stop, t1: sel.pick.t1, confluence: sel.pick.confluence } : null,
                         cards: sel.cards.map(function(c){ return { strategy: c.strategy, stratKey: c.stratKey, dir: c.dir, confluence: c.confluence, book: c.book, crownable: c.crownable, demoted: c.demoted }; }),
                         held: sel.held.concat(lane.held).length, dark: lane.dark } };
    if (ui && ui.cards) renderResult(ui, res, f.src, sel, lane);
    setStat(ui, (sel.pick ? 'BEST: ' + sel.pick.strategy + ' ' + sel.pick.dir.toUpperCase() + ' (against the consensus) · ' : (sel.cards.length ? sel.cards.length + ' setup' + (sel.cards.length === 1 ? '' : 's') + ' shown, none crowned · ' : 'no GOLD SCALP setup this bar · ')) + (res.ok ? res.line : 'count silent') + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC', false);
    try{ if (sel.pick && typeof W.hgFwdRecordScan === 'function'){
      if (typeof W.hgFwdResolve === 'function') W.hgFwdResolve('XAUUSD', null, f.rows15m);
      W.hgFwdRecordScan('GOLDULTRA', '15m', [{ sym: 'XAUUSD', dir: sel.pick.dir, entry: sel.pick.entry, stop: sel.pick.stop, t1: sel.pick.t1, mechanic: 'GOLDSCALP-' + (sel.pick.stratKey || 'prefer') + '-AGAINST-ULTRA', ticket: true }], { horizonBars: RULE.timeoutBars });
    } }catch(eF){}
    return 'refreshed';
  }catch(e){ setStat(ui, 'scan failed: ' + ((e && e.message) || e), true); return 'error: ' + ((e && e.message) || e); }
  finally{ __busy = false; try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){} }
}
function mount(el){
  if (!el) return;
  try{
    el.innerHTML = '<style>' + GU_CSS + '</style>'
      + '<div class="panel"><h2>GOLD ULTRA <span>one plain scalp rule · every standard indicator fed in · verified out-of-sample</span></h2>'
      + '<div class="gu-rule"><b>THE RULE:</b> on every closed 15m bar, every directional indicator read votes LONG / SHORT / neutral. When ≥' + RULE.minAvail + ' reads are decisive, <b>' + Math.round(RULE.minPct * 100) + '%</b> of them agree'
      + (RULE.regimeGate ? ', and the REGIME reads do not say CHOP' : '') + ', that side fires: entry at the close, stop ' + RULE.stopAtr + '×ATR14 (never tighter than ' + RULE.costFloorMult + '× the venue round-trip), TP1 ' + RULE.t1R + 'R, TP2 ' + RULE.t2R + 'R, dead after ' + RULE.timeoutBars
      + ' bars. Every read, its value, its kind, its vote and its rule are printed so you can count them yourself. Reads that cannot vote a side (volatility, trend strength) feed the regime gate; reads that cannot be computed from one instrument (market breadth, beta) are shown as not applicable, never faked. No strategy measures 100% — the VERIFIED panel says what this one measured.'
      + '<br><b>THE SETUPS:</b> the count measured negative on its own, so it never issues a ticket. The tickets here are the GOLD SCALP desk’s own prefer-row setups (failed-break reversals, volume-bar sweeps); measured against every one of that desk’s trades, they paid <b>more when the ULTRA consensus leaned the other way</b> and went flat when it agreed — so a prefer-row card reading AGAINST CONSENSUS is crowned, a card reading WITH it is shown and never crowned. The record, with its small n, is printed on every card.</div>'
      + '<div style="margin-top:8px"><button class="btn" id="guRun">SCAN GOLD ULTRA</button> <span class="note" id="guStat">idle — closed bars only; the forming bar is never read.</span></div>'
      + '</div><div class="cards" id="guCards"></div>';
    var ui = { btn: el.querySelector('#guRun'), stat: el.querySelector('#guStat'), cards: el.querySelector('#guCards') };
    __ui = ui;
    if (ui.cards) ui.cards.innerHTML = filterEvidenceHTML() + evidenceHTML();
    if (ui.btn) ui.btn.addEventListener('click', function(){ return runScan(ui); });
  }catch(e){ try{ el.innerHTML = '<div class="panel">GOLD ULTRA failed to mount: ' + esc((e && e.message) || e) + '</div>'; }catch(e2){} }
}
async function refresh(){ if (!__ui) return 'skipped: not mounted'; return runScan(__ui); }

W.goldUltraEngine = goldUltraEngine;
W.goldUltraVotes = goldUltraVotes;
W.goldUltraState = function(){ return __last ? JSON.parse(JSON.stringify(__last)) : null; };
W.HG_GOLD_ULTRA_RULE = RULE;
W.HG_GOLD_ULTRA_EVIDENCE = HG_GOLD_ULTRA_EVIDENCE;
W.HG_GOLD_ULTRA_FILTER = HG_GOLD_ULTRA_FILTER;
W.goldUltraSelectSetups = selectSetups;   /* pure — exported for the tests */
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'GOLD ULTRA', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'GOLD ULTRA', run: async function(){ if (!__ui) return 'unavailable: not mounted'; return runScan(__ui); } });
})();
