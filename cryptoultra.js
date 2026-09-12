/* CRYPTO ULTRA — one plain 15m scalp rule on BTCUSDT: every directional indicator
   read votes LONG / SHORT / neutral, and a side fires when enough agree.

   THE INDICATOR DIRECTORY (every category the user fed):
   ─ Moving averages: EMA, SMA, WMA, HMA, DEMA, TEMA, T3, KAMA, ALMA, McGinley,
     ZLEMA, GMMA, FRAMA, Smoothed HA, Bollinger, Donchian, Keltner, Ichimoku,
     SuperTrend, PSAR, Range Filter, MAMA/FAMA, LSMA, pivots (5 flavours), CPR
   ─ Momentum: RSI, MACD, Stochastic (3 speeds), StochRSI, CCI, Williams %R,
     MFI, TSI, AO, Coppock, ROC, RMI, Fisher, QQE, Schaff, Vortex, WaveTrend,
     CoG, CMO, Elder-Ray, KST, TRIX, UO, PPO, TD Sequential, VW-MACD, TDI,
     Gator, RVI, Ehlers Sine, Forecast Osc, SMI, IMI, DPO, BOP, Momentum
   ─ Volatility: ATR, BB width, Choppiness, HVP, FDI, TTM Squeeze, Mass Index,
     Ulcer, Williams VIX Fix, Gaussian Channel, Chandelier Exit, Std Dev
   ─ Volume: OBV, CMF, A/D, Elder Force, Klinger, Twiggs MF, RVOL, Weis Wave
   ─ Trend: ADX/DMI, Aroon, VHF, Hilbert mode
   ─ Structure: FVG, CHoCH, Order Blocks, Liquidity Sweeps, Darvas Box
   ─ Session: Asian Range, Killzones, Session VWAP, CPR, Silver Bullet
   ─ Candle patterns: 15 TA-Lib classics
   ─ Statistical: Kalman, Hurst, Spearman, Ehlers SS, Fractal Chaos, Gaussian
   ─ Crypto-native n/a: on-chain (SOPR, Puell, Hash Ribbons, MVRV, HODL Waves,
     NVT, …), derivatives (funding, OI, liquidation, GEX, max pain, …),
     order flow (footprint, CVD, delta, iceberg, VPIN, …), DeFi (AMM, MEV, …),
     ML/AI (Lorentzian, kNN, HMM, LSTM, …), macro (USDT.D, CME gap, …)

   Self-contained kernel: every indicator is computed with pure functions so the
   backtest harness (scripts/backtest-cryptoultra.mjs) replays byte-identical math.
   SMA-seeded EMA, Wilder RSI/ATR/ADX — goldind.js conventions.

   VERIFIED: the tab prints what it measured, never claims.                      */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'cryptoultra';
var KL_15M = 320, KL_1H = 400;
var MIN_15M = 230, MIN_1H = 210;

var RULE = { minAvail: 25, minPct: 0.70, regimeGate: true, stopAtr: 1.5, costFloorMult: 8, t1R: 1.5, t2R: 2.5, timeoutBars: 24 };

var HG_CRYPTO_ULTRA_EVIDENCE = {
  measured: true,
  symbol: 'BTCUSDT',
  bars: 5999,
  interval: '15m',
  span: '2026-07-11 .. 2026-09-12',
  rule: null,
  isAvgR: null,
  isN: 0,
  isWin: null,
  oosAvgR: null,
  oosN: 0,
  oosWin: null,
  tradable: false,
  verdict: 'NOT tradable — the rule is self-canceling. Tightened to 70% agreement (up from 55%) to filter noise; still fires ~3,600 candidates but merging/deduping reduces all to 0 settled trades. The indicator votes are too correlated and the merge logic cancels out every position. Nothing chosen, nothing baked.',
  limitations: [
    'MARKET FILL AT THE SIGNAL CLOSE: fills at the signal close, ignoring next-bar open gap',
    'BTCUSDT spot on Binance: 0.10% maker+taker each side = 0.20% round-trip',
    'the 127 directional reads are heavily correlated (dozens are MA variants); agreement % is a count, not an independence-weighted probability',
    'SELF-CANCELING RULE: long and short signals overlap on the same bars, causing the merge logic to net all trades to zero; tightening the threshold reduces noise but does not produce tradable outcomes',
    'THE RULE WAS PICKED ON THE FIRST 70% AND REPORTED ON THE LAST 30%: one split, one regime of BTC history'
  ]
};

/* =========================== kernel =========================== */
function nanArr(n){ var a = new Array(n); for (var i = 0; i < n; i++) a[i] = NaN; return a; }
function last(a){ return a[a.length - 1]; }
function at(a, k){ return a[a.length - 1 - k]; }
function closes(rows){ return rows.map(function(r){ return r.c; }); }
function fmt(n, d){ if (n !== null && n !== undefined && isFinite(n)) return n.toFixed(d === undefined ? 2 : d); return '—'; }
function pct(n){ if (n !== null && n !== undefined && isFinite(n)) return (100 * n).toFixed(1) + '%'; return '—'; }
function fmtR(n){ if (n !== null && n !== undefined && isFinite(n)) return (n >= 0 ? '+' : '') + n.toFixed(3) + 'R'; return '—'; }
function vs(a, b){ return (isFinite(a) && isFinite(b)) ? (a > b ? 1 : a < b ? -1 : 0) : 0; }
function sgn(x){ return x > 0 ? 1 : x < 0 ? -1 : 0; }
function fill0(a){ return a.map(function(x){ return isFinite(x) ? x : 0; }); }
function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function sma(v, p){ var o = nanArr(v.length), s = 0; for (var i = 0; i < v.length; i++){ s += (isFinite(v[i]) ? v[i] : 0); if (i >= p) s -= (isFinite(v[i - p]) ? v[i - p] : 0); if (i >= p - 1) o[i] = s / p; } return o; }
function ema(v, p){ var o = nanArr(v.length), k = 2 / (p + 1), s = 0, c = 0; for (var i = 0; i < v.length; i++){ if (!isFinite(v[i])) continue; if (c < p){ s += v[i]; c++; if (c === p) o[i] = s / p; } else { o[i] = v[i] * k + o[i - 1] * (1 - k); } } return o; }
function rma(v, p){ var o = nanArr(v.length), s = 0, c = 0; for (var i = 0; i < v.length; i++){ if (!isFinite(v[i])) continue; if (c < p){ s += v[i]; c++; if (c === p) o[i] = s / p; } else { o[i] = (o[i - 1] * (p - 1) + v[i]) / p; } } return o; }
function wma(v, p){ var o = nanArr(v.length), d = p * (p + 1) / 2; for (var i = p - 1; i < v.length; i++){ var s = 0; for (var j = 0; j < p; j++) s += v[i - j] * (p - j); o[i] = s / d; } return o; }
function hma(v, p){ var h = Math.max(Math.round(p / 2), 1), sq = Math.max(Math.round(Math.sqrt(p)), 1), a = wma(v, h), b = wma(v, p), d = a.map(function(x, k){ return 2 * x - b[k]; }); return wma(fill0(d), sq); }
function dema(v, p){ var e1 = ema(v, p), e2 = ema(fill0(e1), p); return e1.map(function(x, k){ return 2 * x - e2[k]; }); }
function tema(v, p){ var e1 = ema(v, p), e2 = ema(fill0(e1), p), e3 = ema(fill0(e2), p); return e1.map(function(x, k){ return 3 * x - 3 * e2[k] + e3[k]; }); }
function t3(v, p, b){ b = b || 0.7; var c1 = -b * b * b, c2 = 3 * b * b + 3 * b * b * b, c3 = -6 * b * b - 3 * b - 3 * b * b * b, c4 = 1 + 3 * b + b * b * b + 3 * b * b; var e1 = ema(v, p), e2 = ema(fill0(e1), p), e3 = ema(fill0(e2), p), e4 = ema(fill0(e3), p), e5 = ema(fill0(e4), p), e6 = ema(fill0(e5), p); return e1.map(function(_, k){ return c1 * e6[k] + c2 * e5[k] + c3 * e4[k] + c4 * e3[k]; }); }
function kama(v, p, f, s){ f = f || 2; s = s || 30; var o = nanArr(v.length), fsc = 2 / (f + 1), ssc = 2 / (s + 1); for (var i = p; i < v.length; i++){ var dir = Math.abs(v[i] - v[i - p]), vol = 0; for (var j = 0; j < p; j++) vol += Math.abs(v[i - j] - v[i - j - 1]); var er = vol ? dir / vol : 0, sc = er * (fsc - ssc) + ssc; sc *= sc; o[i] = isFinite(o[i - 1]) ? o[i - 1] + sc * (v[i] - o[i - 1]) : v[i]; } return o; }
function alma(v, p, off, sig){ off = off || 0.85; sig = sig || 6; var m = off * (p - 1), s2 = p / sig; s2 *= s2; var w = []; for (var j = 0; j < p; j++) w[j] = Math.exp(-((j - m) * (j - m)) / (2 * s2)); var o = nanArr(v.length); for (var i = p - 1; i < v.length; i++){ var num = 0, den = 0; for (var k = 0; k < p; k++){ num += w[k] * v[i - p + 1 + k]; den += w[k]; } o[i] = num / den; } return o; }
function linreg(v, p){ var o = { slope: nanArr(v.length), end: nanArr(v.length), r2: nanArr(v.length) }; for (var i = p - 1; i < v.length; i++){ var sx = 0, sy = 0, sxx = 0, sxy = 0; for (var j = 0; j < p; j++){ sx += j; sy += v[i - p + 1 + j]; sxx += j * j; sxy += j * v[i - p + 1 + j]; } var b = (p * sxy - sx * sy) / (p * sxx - sx * sx); var a = (sy - b * sx) / p; o.slope[i] = b; o.end[i] = a + b * (p - 1); } return o; }
function mcginley(v, p){ var o = nanArr(v.length); for (var i = 0; i < v.length; i++){ if (!isFinite(o[i - 1])){ o[i] = v[i]; continue; } var r = o[i - 1] ? v[i] / o[i - 1] : 1; o[i] = o[i - 1] + (v[i] - o[i - 1]) / (p * Math.pow(r, 4)); } return o; }
function vwmaArr(rows, p){ var o = nanArr(rows.length); for (var i = p - 1; i < rows.length; i++){ var pv = 0, sv = 0; for (var j = 0; j < p; j++){ pv += rows[i - j].c * rows[i - j].v; sv += rows[i - j].v; } o[i] = sv ? pv / sv : rows[i].c; } return o; }
function rsi(v, p){ var o = nanArr(v.length), gu = 0, gd = 0, c = 0; for (var i = 1; i < v.length; i++){ var d = v[i] - v[i - 1]; if (c < p){ if (d > 0) gu += d; else gd -= d; c++; if (c === p){ gu /= p; gd /= p; o[i] = gd ? 100 - 100 / (1 + gu / gd) : 100; } } else { if (d > 0){ gu = (gu * (p - 1) + d) / p; gd = gd * (p - 1) / p; } else { gu = gu * (p - 1) / p; gd = (gd * (p - 1) - d) / p; } o[i] = gd ? 100 - 100 / (1 + gu / gd) : 100; } } return o; }
function rmi(v, p, m){ m = m || 3; var o = nanArr(v.length), gu = 0, gd = 0, c = 0; for (var i = m; i < v.length; i++){ var d = v[i] - v[i - m]; if (c < p){ if (d > 0) gu += d; else gd -= d; c++; if (c === p){ gu /= p; gd /= p; o[i] = gd ? 100 - 100 / (1 + gu / gd) : 100; } } else { if (d > 0){ gu = (gu * (p - 1) + d) / p; gd = gd * (p - 1) / p; } else { gu = gu * (p - 1) / p; gd = (gd * (p - 1) - d) / p; } o[i] = gd ? 100 - 100 / (1 + gu / gd) : 100; } } return o; }
function trSeries(rows){ var o = [rows[0].h - rows[0].l]; for (var i = 1; i < rows.length; i++) o[i] = Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c)); return o; }
function atr(rows, p){ return rma(trSeries(rows), p); }
function adx(rows, p){ var n = rows.length, pdi = nanArr(n), mdi = nanArr(n), dx = nanArr(n), adxo = nanArr(n); var pdm = [], mdm = []; for (var i = 0; i < n; i++){ if (i === 0){ pdm[i] = 0; mdm[i] = 0; } else { var up = rows[i].h - rows[i - 1].h, dn = rows[i - 1].l - rows[i].l; pdm[i] = (up > dn && up > 0) ? up : 0; mdm[i] = (dn > up && dn > 0) ? dn : 0; } } var sp = rma(pdm, p), sm = rma(mdm, p), A = atr(rows, p); for (var j = 0; j < n; j++){ pdi[j] = A[j] ? 100 * sp[j] / A[j] : 0; mdi[j] = A[j] ? 100 * sm[j] / A[j] : 0; dx[j] = (pdi[j] + mdi[j]) ? 100 * Math.abs(pdi[j] - mdi[j]) / (pdi[j] + mdi[j]) : 0; } adxo = rma(dx, p); return { pdi: pdi, mdi: mdi, dx: dx, adx: adxo }; }
function stdev(v, p){ var m = sma(v, p), o = nanArr(v.length); for (var i = p - 1; i < v.length; i++){ var s = 0; for (var j = 0; j < p; j++){ var d = v[i - j] - m[i]; s += d * d; } o[i] = Math.sqrt(s / p); } return o; }
function macd(v, f, s, sig){ var ef = ema(v, f), es = ema(v, s), line = ef.map(function(x, k){ return x - es[k]; }); var signal = ema(fill0(line), sig), hist = line.map(function(x, k){ return x - signal[k]; }); return { line: line, signal: signal, hist: hist }; }
function hhll(rows, p, idx, isHigh){ var v = isHigh ? -Infinity : Infinity; for (var j = 0; j < p && idx - j >= 0; j++){ if (isHigh) v = Math.max(v, rows[idx - j].h); else v = Math.min(v, rows[idx - j].l); } return v; }
function stochRaw(rows, p, idx){ var hh = hhll(rows, p, idx, true), ll = hhll(rows, p, idx, false); return (hh > ll) ? 100 * (rows[idx].c - ll) / (hh - ll) : 50; }
function stochKD(rows, p, kS, dS){ var n = rows.length, raw = nanArr(n); for (var i = p - 1; i < n; i++) raw[i] = stochRaw(rows, p, i); var k = sma(fill0(raw), kS), d = sma(fill0(k), dS); return { k: k, d: d }; }
function stochRsi(v, p){ var r = rsi(v, p), n = v.length, o = nanArr(n); for (var i = p * 2 - 1; i < n; i++){ var hh = -Infinity, ll = Infinity; for (var j = 0; j < p; j++){ if (isFinite(r[i - j])){ hh = Math.max(hh, r[i - j]); ll = Math.min(ll, r[i - j]); } } o[i] = (hh > ll) ? 100 * (r[i] - ll) / (hh - ll) : 50; } return o; }
function cci(rows, p){ var n = rows.length, tp = rows.map(function(r){ return (r.h + r.l + r.c) / 3; }), ma = sma(tp, p), o = nanArr(n); for (var i = p - 1; i < n; i++){ var md = 0; for (var j = 0; j < p; j++) md += Math.abs(tp[i - j] - ma[i]); md /= p; o[i] = md ? (tp[i] - ma[i]) / (0.015 * md) : 0; } return o; }
function willr(rows, p){ var n = rows.length, o = nanArr(n); for (var i = p - 1; i < n; i++){ var hh = hhll(rows, p, i, true), ll = hhll(rows, p, i, false); o[i] = hh > ll ? -100 * (hh - rows[i].c) / (hh - ll) : -50; } return o; }
function mfi(rows, p){ var n = rows.length, o = nanArr(n); for (var i = p; i < n; i++){ var pf = 0, nf = 0; for (var j = 0; j < p; j++){ var tp = (rows[i - j].h + rows[i - j].l + rows[i - j].c) / 3, pp = (rows[i - j - 1].h + rows[i - j - 1].l + rows[i - j - 1].c) / 3; if (tp > pp) pf += tp * rows[i - j].v; else nf += tp * rows[i - j].v; } o[i] = (pf + nf) ? 100 * pf / (pf + nf) : 50; } return o; }
function tsi(v, p1, p2){ var d = v.map(function(x, k){ return k ? x - v[k - 1] : 0; }), a = ema(fill0(ema(fill0(d.map(Math.abs)), p1)), p2), b = ema(fill0(ema(d, p1)), p2); return b.map(function(x, k){ return a[k] ? 100 * x / a[k] : 0; }); }
function median(rows){ return rows.map(function(r){ return (r.h + r.l) / 2; }); }
function supertrend(rows, p, mult){ var A = atr(rows, p), n = rows.length, o = nanArr(n), dir = 1; for (var i = p; i < n; i++){ var m = (rows[i].h + rows[i].l) / 2, up = m - mult * A[i], dn = m + mult * A[i]; if (i > p){ up = Math.max(up, isFinite(o[i - 1]) && o[i - 1] === 1 ? up : -Infinity); } if (rows[i].c > dn) dir = 1; else if (rows[i].c < up) dir = -1; o[i] = dir; } return o; }
function psar(rows, af0, mx){ var n = rows.length, sar = nanArr(n), trend = nanArr(n), af = af0, ep, s; trend[0] = 1; sar[0] = rows[0].l; ep = rows[0].h; s = sar[0]; for (var i = 1; i < n; i++){ var p = s + af * (ep - s); if (trend[i - 1] === 1){ p = Math.min(p, rows[i - 1].l, i > 1 ? rows[i - 2].l : rows[i - 1].l); if (rows[i].l < p){ trend[i] = -1; sar[i] = ep; af = af0; ep = rows[i].l; } else { trend[i] = 1; sar[i] = p; if (rows[i].h > ep){ ep = rows[i].h; af = Math.min(af + af0, mx); } } } else { p = Math.max(p, rows[i - 1].h, i > 1 ? rows[i - 2].h : rows[i - 1].h); if (rows[i].h > p){ trend[i] = 1; sar[i] = ep; af = af0; ep = rows[i].h; } else { trend[i] = -1; sar[i] = p; if (rows[i].l < ep){ ep = rows[i].l; af = Math.min(af + af0, mx); } } } s = sar[i]; } return { sar: sar, trend: trend }; }
function midHL(rows, p, idx){ return (hhll(rows, p, idx, true) + hhll(rows, p, idx, false)) / 2; }
function ichimoku(rows){ var n = rows.length; if (n < 52) return null; var i = n - 1; var tenkan = midHL(rows, 9, i), kijun = midHL(rows, 26, i); var ssA = (tenkan + kijun) / 2, ssB = midHL(rows, 52, i); var cloudTop = Math.max(ssA, ssB), cloudBot = Math.min(ssA, ssB); var chikouRef = i >= 26 ? rows[i - 26].c : NaN; return { tenkan: tenkan, kijun: kijun, ssA: ssA, ssB: ssB, cloudTop: cloudTop, cloudBot: cloudBot, chikouRef: chikouRef }; }
function obv(rows){ var o = [0]; for (var i = 1; i < rows.length; i++) o[i] = o[i - 1] + (rows[i].c > rows[i - 1].c ? rows[i].v : rows[i].c < rows[i - 1].c ? -rows[i].v : 0); return o; }
function adl(rows){ var o = [0]; for (var i = 1; i < rows.length; i++){ var mfm = rows[i].h > rows[i].l ? ((rows[i].c - rows[i].l) - (rows[i].h - rows[i].c)) / (rows[i].h - rows[i].l) : 0; o[i] = o[i - 1] + mfm * rows[i].v; } return o; }
function cmf(rows, p){ var n = rows.length, o = nanArr(n); for (var i = p - 1; i < n; i++){ var mfv = 0, sv = 0; for (var j = 0; j < p; j++){ var r = rows[i - j], rng = r.h - r.l; mfv += rng ? ((r.c - r.l) - (r.h - r.c)) / rng * r.v : 0; sv += r.v; } o[i] = sv ? mfv / sv : 0; } return o; }
function sessionVwap(rows){ var n = rows.length, dayStart = -1, pv = 0, sv = 0; for (var i = 0; i < n; i++){ var d = new Date(rows[i].t * 1000).getUTCDate(); if (i === 0 || d !== new Date(rows[i - 1].t * 1000).getUTCDate()){ pv = 0; sv = 0; } var tp = (rows[i].h + rows[i].l + rows[i].c) / 3; pv += tp * rows[i].v; sv += rows[i].v; } return sv ? pv / sv : NaN; }
function priorDay(rows){ var n = rows.length; for (var i = n - 2; i >= 0; i--){ var d1 = new Date(rows[i].t * 1000).getUTCDate(), d0 = new Date(rows[n - 1].t * 1000).getUTCDate(); if (d1 !== d0){ var h = -Infinity, l = Infinity, o = NaN, c = NaN; for (var j = i; j >= 0; j--){ if (new Date(rows[j].t * 1000).getUTCDate() !== d1) break; h = Math.max(h, rows[j].h); l = Math.min(l, rows[j].l); if (isNaN(o)) o = rows[j].o; c = rows[j].c; } return { h: h, l: l, o: o, c: c }; } } return null; }
function dayRanges(rows){ var out = [], cur = null; for (var i = 0; i < rows.length; i++){ var d = new Date(rows[i].t * 1000).getUTCDate(); if (!cur || cur.d !== d){ if (cur) out.push(cur); cur = { d: d, h: rows[i].h, l: rows[i].l }; } else { cur.h = Math.max(cur.h, rows[i].h); cur.l = Math.min(cur.l, rows[i].l); } } if (cur) out.push(cur); return out; }
function fractals(rows, n){ n = n || 2; var hi = [], lo = []; for (var i = n; i < rows.length - n; i++){ var isH = true, isL = true; for (var j = 1; j <= n; j++){ if (rows[i].h <= rows[i - j].h || rows[i].h <= rows[i + j].h) isH = false; if (rows[i].l >= rows[i - j].l || rows[i].l >= rows[i + j].l) isL = false; } if (isH) hi.push({ i: i, v: rows[i].h }); if (isL) lo.push({ i: i, v: rows[i].l }); } return { hi: hi, lo: lo }; }
function zigzag(rows, threshold){ var n = rows.length, dir = 0, pivot = rows[0].c, since = 0; for (var i = 1; i < n; i++){ if (dir >= 0 && rows[i].l < pivot - threshold){ dir = -1; pivot = rows[i].l; since = 0; } else if (dir <= 0 && rows[i].h > pivot + threshold){ dir = 1; pivot = rows[i].h; since = 0; } else { since++; if (dir > 0) pivot = Math.max(pivot, rows[i].h); else if (dir < 0) pivot = Math.min(pivot, rows[i].l); } } return { dir: dir, since: since }; }
function freshFvg(rows){ var n = rows.length; for (var i = n - 2; i >= 2; i--){ if (rows[i - 1].l > rows[i + 1].h) return { dir: -1, top: rows[i - 1].l, bot: rows[i + 1].h, age: n - 1 - i }; if (rows[i - 1].h < rows[i + 1].l) return { dir: 1, top: rows[i + 1].l, bot: rows[i - 1].h, age: n - 1 - i }; } return null; }
function fisher(rows, p){ var n = rows.length, o = nanArr(n), v = 0; for (var i = p - 1; i < n; i++){ var hh = -Infinity, ll = Infinity; for (var j = 0; j < p; j++){ hh = Math.max(hh, rows[i - j].h); ll = Math.min(ll, rows[i - j].l); } var x = hh > ll ? 2 * ((rows[i].c - ll) / (hh - ll) - 0.5) : 0; x = Math.max(-0.999, Math.min(0.999, 0.66 * x + 0.67 * v)); v = x; o[i] = 0.5 * Math.log((1 + x) / (1 - x)) + (isFinite(o[i - 1]) ? o[i - 1] : 0); o[i] *= 0.5; } return o; }
function hilbert(v){ var n = v.length, period = nanArr(n), phase = nanArr(n), sine = nanArr(n), lead = nanArr(n), mama = nanArr(n), fama = nanArr(n), mode = nanArr(n); var sm = function(k){ return k >= 6 ? (v[k] - v[k - 6]) / 2 : 0; }; var prev = { dP: 0, q1: 0, i1: 0, re: 0, im: 0, per: 15, ph: 0, mama: v[0], fama: v[0] }; for (var i = 6; i < n; i++){ var adj = 0.075 * prev.per + 0.54, s0 = sm(i), s2 = sm(i - 2), s4 = sm(i - 4); var dI = 0.0962 * s0 + 0.5769 * s2 - 0.5769 * s4 - 0.0962 * sm(i - 6); dI *= adj; var q1 = 0.0962 * s0 + 0.5769 * s2 - 0.5769 * s4 - 0.0962 * sm(i - 6); q1 *= adj; var i1 = s2; var jI = 0.0962 * prev.i1 + 0.5769 * prev.i1 - 0.5769 * prev.i1 - 0.0962 * prev.i1; jI *= adj; var jQ = 0.0962 * prev.q1 + 0.5769 * prev.q1 - 0.5769 * prev.q1 - 0.0962 * prev.q1; jQ *= adj; var re = i1 * prev.i1 + q1 * prev.q1, im = i1 * prev.q1 - q1 * prev.i1; re = 0.2 * re + 0.8 * prev.re; im = 0.2 * im + 0.8 * prev.im; var per = (im && re) ? 2 * Math.PI / Math.atan(im / re) : prev.per; per = Math.max(6, Math.min(50, per)); per = 0.2 * per + 0.8 * prev.per; period[i] = per; var ph = i1 ? Math.atan(q1 / i1) * 180 / Math.PI : prev.ph; phase[i] = ph; var dP = prev.ph - ph; if (dP < 1) dP = 1; var alpha = Math.max(0.05, Math.min(0.5, 0.4 / per)); mama[i] = prev.mama + alpha * (v[i] - prev.mama); fama[i] = prev.fama + 0.5 * alpha * (mama[i] - prev.fama); sine[i] = Math.sin(ph * Math.PI / 180); lead[i] = Math.sin((ph + 45) * Math.PI / 180); mode[i] = Math.abs(sine[i] - lead[i]) < 0.1 ? 0 : 1; prev = { dP: dP, q1: q1, i1: i1, re: re, im: im, per: per, ph: ph, mama: mama[i], fama: fama[i] }; } return { period: period, phase: phase, sine: sine, lead: lead, mama: mama, fama: fama, mode: mode }; }

/* --- additional kernel functions for crypto indicators --- */
function zlema(v, p){ var lag = Math.floor((p - 1) / 2), adj = v.map(function(x, k){ return k >= lag ? 2 * x - v[k - lag] : x; }); return ema(adj, p); }
function chandelierExit(rows, p, mult){ var n = rows.length, A = atr(rows, p), hi = nanArr(n), lo = nanArr(n); for (var i = p - 1; i < n; i++){ var hh = hhll(rows, p, i, true), ll = hhll(rows, p, i, false); hi[i] = hh - mult * A[i]; lo[i] = ll + mult * A[i]; } return { hi: hi, lo: lo }; }
function waveTrend(rows, chLen, avgLen){ var tp = rows.map(function(r){ return (r.h + r.l + r.c) / 3; }); var esa = ema(tp, chLen), d = ema(tp.map(function(x, k){ return Math.abs(x - (isFinite(esa[k]) ? esa[k] : x)); }), chLen); var ci = tp.map(function(x, k){ return d[k] ? (x - esa[k]) / (0.015 * d[k]) : 0; }); var wt1 = ema(ci, avgLen), wt2 = sma(fill0(wt1), 4); return { wt1: wt1, wt2: wt2 }; }
function rangeFilterCalc(v, p, mult){ var sm = ema(v.map(function(x, k){ return k ? Math.abs(x - v[k - 1]) : 0; }), p); var n = v.length, rf = nanArr(n); rf[0] = v[0]; for (var i = 1; i < n; i++){ var r = mult * (isFinite(sm[i]) ? sm[i] : 0); if (v[i] > rf[i - 1]){ rf[i] = Math.max(rf[i - 1], v[i] - r); } else if (v[i] < rf[i - 1]){ rf[i] = Math.min(rf[i - 1], v[i] + r); } else { rf[i] = rf[i - 1]; } } return rf; }
function tdSequential(rows){ var n = rows.length, count = 0; for (var i = 4; i < n; i++){ if (rows[i].c > rows[i - 4].c){ count = count > 0 ? count + 1 : 1; } else if (rows[i].c < rows[i - 4].c){ count = count < 0 ? count - 1 : -1; } else { count = 0; } } return count; }
function williamsVixFix(rows, p){ var n = rows.length, o = nanArr(n); for (var i = p - 1; i < n; i++){ var hc = -Infinity; for (var j = 0; j < p; j++) hc = Math.max(hc, rows[i - j].c); o[i] = hc > 0 ? (hc - rows[i].l) / hc * 100 : 0; } return o; }
function ehlersSuperSmoother(v, p){ var n = v.length, o = nanArr(n), a = Math.exp(-Math.PI * Math.SQRT2 / p), b = 2 * a * Math.cos(Math.SQRT2 * Math.PI / p), c2 = b, c3 = -a * a, c1 = 1 - c2 - c3; for (var i = 2; i < n; i++){ o[i] = c1 * (v[i] + (isFinite(v[i - 1]) ? v[i - 1] : v[i])) / 2 + c2 * (isFinite(o[i - 1]) ? o[i - 1] : v[i]) + c3 * (isFinite(o[i - 2]) ? o[i - 2] : v[i]); } return o; }
function elderForce(rows, p){ var n = rows.length, raw = nanArr(n); for (var i = 1; i < n; i++) raw[i] = (rows[i].c - rows[i - 1].c) * rows[i].v; return ema(fill0(raw), p); }
function spearmanRank(v, p){ var n = v.length, o = nanArr(n); for (var i = p - 1; i < n; i++){ var vals = []; for (var j = 0; j < p; j++) vals.push({ v: v[i - p + 1 + j], t: j }); vals.sort(function(a, b){ return a.v - b.v; }); var d2 = 0; for (var k = 0; k < p; k++) d2 += (vals[k].t - k) * (vals[k].t - k); o[i] = 1 - 6 * d2 / (p * (p * p - 1)); } return o; }
function framaCalc(v, p){ var n = v.length, o = nanArr(n), half = Math.floor(p / 2); for (var i = p - 1; i < n; i++){ var h1 = -Infinity, l1 = Infinity, h2 = -Infinity, l2 = Infinity, hA = -Infinity, lA = Infinity; for (var j = 0; j < half; j++){ h1 = Math.max(h1, v[i - j]); l1 = Math.min(l1, v[i - j]); } for (var j2 = half; j2 < p; j2++){ h2 = Math.max(h2, v[i - j2]); l2 = Math.min(l2, v[i - j2]); } for (var j3 = 0; j3 < p; j3++){ hA = Math.max(hA, v[i - j3]); lA = Math.min(lA, v[i - j3]); } var n1 = (h1 - l1) / half, n2 = (h2 - l2) / half, n3 = (hA - lA) / p; var D = (n1 > 0 && n2 > 0 && n3 > 0) ? (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2) : 1; var alpha = Math.max(0.01, Math.min(1, Math.exp(-4.6 * (D - 1)))); o[i] = isFinite(o[i - 1]) ? alpha * v[i] + (1 - alpha) * o[i - 1] : v[i]; } return o; }

/* =========================== the reads =========================== */
function R(id, group, name, kind, vote, read, why){ return { id: id, group: group, name: name, kind: kind, vote: kind === 'vote' ? vote : 0, read: read, why: why, regime: kind === 'regime' ? vote : undefined }; }
function countRegime(list, side){ var c = 0; for (var k = 0; k < list.length; k++) if (list[k].kind === 'regime' && ['chop', 'adx', 'vhf', 'ht_mode'].indexOf(list[k].id) >= 0 && list[k].regime === side) c++; return c; }
function regimeSummaryVote(list){ var ch = countRegime(list, -1), tr = countRegime(list, 1); return ch >= 3 ? -1 : (tr >= 2 && ch === 0) ? 1 : 0; }
function slopeVote(arr, k, tol){ var a = last(arr), b = at(arr, k); if (!isFinite(a) || !isFinite(b) || !b) return 0; var d = (a - b) / Math.abs(b); return d > tol ? 1 : d < -tol ? -1 : 0; }
function band(x, hi, lo){ return isFinite(x) ? (x > hi ? 1 : x < lo ? -1 : 0) : 0; }

function cryptoUltraVotes(rows, rows1h){
  var out = [], n = rows.length, i = n - 1, px = rows[i].c, C = closes(rows), MD = median(rows), VOL = rows.map(function(r){ return r.v; });
  var e9 = ema(C, 9), e13 = ema(C, 13), e20 = ema(C, 20), e21 = ema(C, 21), e50 = ema(C, 50), e200 = ema(C, 200), S20 = sma(C, 20), S50 = sma(C, 50);
  var A14 = atr(rows, 14), a14 = last(A14), TR = trSeries(rows), D = adx(rows, 14), adxv = last(D.adx);
  var push = function(r){ out.push(r); };

  /* ───── TIER 1: MOVING AVERAGES & OVERLAP ───── */
  var G = 'MOVING AVERAGES';
  var ka = last(kama(C, 10, 2, 30));
  push(R('kama', G, 'KAMA 10,2,30 (Kaufman Adaptive)', 'vote', vs(px, ka), fmt(ka), 'close above the adaptive MA = long'));
  push(R('ama', G, 'Adaptive MA (AMA)', 'print', 0, 'same as KAMA', 'identical information to KAMA — counted once'));
  var al = last(alma(C, 9, 0.85, 6));
  push(R('alma', G, 'ALMA 9 (Arnaud Legoux)', 'vote', vs(px, al), fmt(al), 'close above ALMA = long'));
  var bbs = last(stdev(C, 20)), bbm = last(S20), bbu = bbm + 2 * bbs, bbl = bbm - 2 * bbs;
  push(R('bb', G, 'Bollinger 20,2 position', 'vote', vs(px, bbm), fmt(bbl) + ' · ' + fmt(bbm) + ' · ' + fmt(bbu), 'above the basis = long'));
  var dh = -Infinity, dl = Infinity; for (var q = 1; q <= 20 && i - q >= 0; q++){ dh = Math.max(dh, rows[i - q].h); dl = Math.min(dl, rows[i - q].l); }
  push(R('donchian', G, 'Donchian 20 break', 'vote', px > dh ? 1 : px < dl ? -1 : 0, fmt(dl) + ' – ' + fmt(dh), 'close beyond the prior 20-bar range'));
  var de = last(dema(C, 20));
  push(R('dema', G, 'DEMA 20', 'vote', vs(px, de), fmt(de), 'close above DEMA = long'));
  push(R('ema9_21', G, 'EMA 9 vs EMA 21', 'vote', vs(last(e9), last(e21)), fmt(last(e9)) + ' / ' + fmt(last(e21)), 'fast above slow = long'));
  push(R('ema21_50', G, 'EMA 21 vs EMA 50', 'vote', vs(last(e21), last(e50)), fmt(last(e21)) + ' / ' + fmt(last(e50)), 'mid above slow = long'));
  push(R('px_ema200', G, 'price vs EMA 200', 'vote', vs(px, last(e200)), fmt(last(e200)), 'close above 200 = long'));
  var casc = (last(e9) > last(e21) && last(e21) > last(e50) && last(e50) > last(e200)) ? 1 : (last(e9) < last(e21) && last(e21) < last(e50) && last(e50) < last(e200)) ? -1 : 0;
  push(R('cascade', G, 'EMA cascade 9>21>50>200', 'vote', casc, casc ? 'stacked' : 'mixed', 'fully stacked one way, else neutral'));
  var fr = fractals(rows.slice(0, n - 1), 2), fH = fr.hi.length ? fr.hi[fr.hi.length - 1].v : NaN, fL = fr.lo.length ? fr.lo[fr.lo.length - 1].v : NaN;
  push(R('fcb', G, 'Fractal Chaos Bands', 'vote', (isFinite(fH) && px > fH) ? 1 : (isFinite(fL) && px < fL) ? -1 : 0, fmt(fL) + ' – ' + fmt(fH), 'close outside the last fractal band'));
  var gS = 0, gL = 0, pS = [3, 5, 8, 10, 12, 15], pL = [30, 35, 40, 45, 50, 60];
  for (var gi = 0; gi < 6; gi++){ gS += last(ema(C, pS[gi])); gL += last(ema(C, pL[gi])); }
  push(R('gmma', G, 'GMMA (Guppy Multiple MA)', 'vote', vs(gS, gL), fmt(gS / 6) + ' / ' + fmt(gL / 6), 'traders\' group above investors\' group = long'));
  var H = hma(C, 20);
  push(R('hma', G, 'HMA 20 (Hull)', 'vote', slopeVote(H, 3, 0.0002), fmt(last(H)), 'Hull turning up = long'));
  var ich = ichimoku(rows);
  push(R('cloud', G, 'Ichimoku cloud', 'vote', ich ? (px > ich.cloudTop ? 1 : px < ich.cloudBot ? -1 : 0) : 0, ich ? fmt(ich.cloudBot) + '–' + fmt(ich.cloudTop) : '—', 'above the cloud = long, inside = neutral'));
  push(R('tk', G, 'Ichimoku Tenkan vs Kijun', 'vote', ich ? vs(ich.tenkan, ich.kijun) : 0, ich ? fmt(ich.tenkan) + ' / ' + fmt(ich.kijun) : '—', 'conversion above base = long'));
  push(R('chikou', G, 'Ichimoku Chikou', 'vote', ich ? vs(px, ich.chikouRef) : 0, ich ? fmt(ich.chikouRef) : '—', 'close above the close 26 bars ago = long'));
  var kem = last(e20);
  push(R('kc', G, 'Keltner 20,1.5 position', 'vote', vs(px, kem), fmt(kem - 1.5 * a14) + ' · ' + fmt(kem) + ' · ' + fmt(kem + 1.5 * a14), 'above the EMA basis = long'));
  var LR25 = linreg(C, 25);
  push(R('lsma', G, 'LSMA 25 (least squares)', 'vote', vs(px, last(LR25.end)), fmt(last(LR25.end)), 'close above the regression endpoint = long'));
  var HT = hilbert(C);
  push(R('mama', G, 'MESA MAMA vs FAMA', 'vote', vs(last(HT.mama), last(HT.fama)), fmt(last(HT.mama)) + ' / ' + fmt(last(HT.fama)), 'MAMA above FAMA = long'));
  var mg = last(mcginley(C, 14));
  push(R('mcginley', G, 'McGinley Dynamic 14', 'vote', vs(px, mg), fmt(mg), 'close above = long'));
  var ps = psar(rows, 0.02, 0.2);
  push(R('psar', G, 'Parabolic SAR', 'vote', isFinite(last(ps.trend)) ? last(ps.trend) : 0, fmt(last(ps.sar)), 'dots below price = long'));
  var pd = priorDay(rows);
  if (pd){
    var P = (pd.h + pd.l + pd.c) / 3, rngD = pd.h - pd.l;
    push(R('piv_std', G, 'Pivot — standard P', 'vote', vs(px, P), fmt(P), 'above yesterday\'s pivot = long'));
    push(R('piv_cam', G, 'Pivot — Camarilla H3/L3', 'vote', px > pd.c + rngD * 1.1 / 4 ? 1 : px < pd.c - rngD * 1.1 / 4 ? -1 : 0, fmt(pd.c - rngD * 1.1 / 4) + ' – ' + fmt(pd.c + rngD * 1.1 / 4), 'beyond H3 / L3 (breakout side)'));
    var cpT = (pd.h + pd.l + pd.c) / 3, cpB = (pd.h + pd.l) / 2, cpTop = 2 * cpT - cpB;
    push(R('cpr', G, 'Central Pivot Range', 'vote', px > cpTop ? 1 : px < cpB ? -1 : 0, fmt(cpB) + ' – ' + fmt(cpTop), 'above CPR = long, below = short'));
  } else {
    push(R('piv_std', G, 'Pivots / CPR', 'print', 0, '—', 'no completed prior day in the window'));
  }
  var sm14 = last(rma(C, 14));
  push(R('smma', G, 'SMMA / RMA 14', 'vote', vs(px, sm14), fmt(sm14), 'close above = long'));
  push(R('sma50', G, 'SMA 50', 'vote', vs(px, last(S50)), fmt(last(S50)), 'close above = long'));
  push(R('sma20_slope', G, 'SMA 20 slope (5 bars)', 'vote', slopeVote(S20, 5, 0.0003), fmt(last(S20)), 'rising > +0.03% = long'));
  var st = supertrend(rows, 10, 3);
  push(R('supertrend', G, 'SuperTrend 10,3', 'vote', isFinite(last(st)) ? last(st) : 0, last(st) === 1 ? 'up' : last(st) === -1 ? 'down' : '—', 'band side'));
  var te = last(tema(C, 20));
  push(R('tema', G, 'TEMA 20', 'vote', vs(px, te), fmt(te), 'close above = long'));
  var t3v = last(t3(C, 5, 0.7));
  push(R('t3', G, 'T3 5 (Tillson)', 'vote', vs(px, t3v), fmt(t3v), 'close above = long'));
  var vw = sessionVwap(rows);
  push(R('vwap', G, 'session VWAP (UTC day)', 'vote', isFinite(vw) ? vs(px, vw) : 0, fmt(vw), 'close above session VWAP = long'));
  var VW = vwmaArr(rows, 20);
  push(R('vwma', G, 'VWMA 20 vs SMA 20', 'vote', vs(last(VW), last(S20)), fmt(last(VW)) + ' / ' + fmt(last(S20)), 'volume-weighted above plain = buyers carry it'));
  var w20 = last(wma(C, 20));
  push(R('wma', G, 'WMA 20', 'vote', vs(px, w20), fmt(w20), 'close above = long'));
  var zl = last(zlema(C, 20));
  push(R('zlema', G, 'ZLEMA 20 (Zero-Lag EMA)', 'vote', vs(px, zl), fmt(zl), 'close above = long'));
  var fm = last(framaCalc(C, 20));
  push(R('frama', G, 'FRAMA 20 (Fractal Adaptive)', 'vote', vs(px, fm), fmt(fm), 'close above = long'));
  var ess = last(ehlersSuperSmoother(C, 20));
  push(R('ess', G, 'Ehlers Super Smoother 20', 'vote', vs(px, ess), fmt(ess), 'close above = long'));
  var zz = zigzag(rows, 2 * a14);
  push(R('zigzag', G, 'Zig Zag (2×ATR legs)', 'vote', zz.dir, zz.dir ? (zz.dir > 0 ? 'leg up' : 'leg down') + ' · ' + zz.since + ' bars' : '—', 'the confirmed current leg\'s direction'));
  var rf = last(rangeFilterCalc(C, 20, 2.6));
  push(R('rangefilter', G, 'Range Filter (DW) 20', 'vote', vs(px, rf), fmt(rf), 'close above = long'));
  var sha = (function(){ var ha = [{ o: rows[0].o, c: rows[0].c }]; for (var k = 1; k < n; k++){ ha[k] = { o: (ha[k-1].o + ha[k-1].c) / 2, c: (rows[k].o + rows[k].h + rows[k].l + rows[k].c) / 4 }; } var sc = ema(ha.map(function(h){ return h.c; }), 10); return last(sc); })();
  push(R('sha', G, 'Smoothed Heikin Ashi (EMA 10)', 'vote', vs(px, sha), fmt(sha), 'HA close smoothed above price = long'));
  var pcH = hhll(rows, 20, i, true), pcL = hhll(rows, 20, i, false);
  push(R('pchan', G, 'Price channel 20 (mid)', 'vote', vs(px, (pcH + pcL) / 2), fmt(pcL) + ' – ' + fmt(pcH), 'upper half of the channel = long'));
  push(R('env', G, 'Envelopes SMA 20 ±1%', 'vote', px > bbm * 1.01 ? 1 : px < bbm * 0.99 ? -1 : 0, fmt(bbm * 0.99) + ' – ' + fmt(bbm * 1.01), 'close outside the envelope, on that side'));

  /* ───── TIER 2: MOMENTUM ───── */
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
  push(R('elder', G, 'Elder-Ray (bull / bear power)', 'vote', (bull > 0 && bear > 0) ? 1 : (bull < 0 && bear < 0) ? -1 : 0, fmt(bull, 2) + ' / ' + fmt(bear, 2), 'both above the EMA 13 = long'));
  var fi = fisher(rows, 9);
  push(R('fisher', G, 'Fisher Transform 9', 'vote', (last(fi) > at(fi, 1) && last(fi) > 0) ? 1 : (last(fi) < at(fi, 1) && last(fi) < 0) ? -1 : 0, fmt(last(fi), 2), 'rising above 0 = long'));
  var LR14 = linreg(C, 14), fo = 100 * (px - at(LR14.end, 1)) / px;
  push(R('fosc', G, 'Forecast Oscillator 14', 'vote', band(fo, 0.02, -0.02), fmt(fo, 3) + '%', 'close above the prior forecast = long'));
  var jaw = at(rma(MD, 13), 8), teeth = at(rma(MD, 8), 5), lips = at(rma(MD, 5), 3);
  push(R('gator', G, 'Gator / Alligator', 'vote', (lips > teeth && teeth > jaw) ? 1 : (lips < teeth && teeth < jaw) ? -1 : 0, fmt(lips) + ' / ' + fmt(teeth) + ' / ' + fmt(jaw), 'lips > teeth > jaw = long'));
  var imU = 0, imD = 0; for (var ij = 0; ij < 14; ij++){ var rr = rows[i - ij]; if (rr.c > rr.o) imU += rr.c - rr.o; else imD += rr.o - rr.c; }
  var imi = (imU + imD) ? 100 * imU / (imU + imD) : 50;
  push(R('imi', G, 'Intraday Momentum Index 14', 'vote', band(imi, 55, 45), fmt(imi, 1), '>55 long · <45 short'));
  var kst = C.map(function(){ return NaN; });
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
  var qq = (function(){ var r = rsi(C, 14), rm = ema(fill0(r), 5), dr = rm.map(function(x, k){ return k ? Math.abs(x - rm[k - 1]) : 0; }), da = ema(fill0(ema(fill0(dr), 27)), 27).map(function(x){ return x * 4.236; }), tr2 = nanArr(n); for (var k = 1; k < n; k++){ var up = rm[k] - da[k], dn = rm[k] + da[k], p2 = isFinite(tr2[k - 1]) ? tr2[k - 1] : rm[k]; tr2[k] = rm[k] > p2 ? Math.max(up, p2 > rm[k - 1] ? p2 : up) : Math.min(dn, p2 < rm[k - 1] ? p2 : dn); if (rm[k - 1] < p2 && rm[k] > p2) tr2[k] = up; if (rm[k - 1] > p2 && rm[k] < p2) tr2[k] = dn; } return { rm: last(rm), tr: last(tr2) }; })();
  push(R('qqe', G, 'QQE (RSI 14 · 5)', 'vote', vs(qq.rm, qq.tr), fmt(qq.rm, 1) + ' / ' + fmt(qq.tr, 1), 'smoothed RSI above its trailing line = long'));
  var rc = 100 * (px - C[i - 10]) / C[i - 10];
  push(R('roc', G, 'ROC 10', 'vote', band(rc, 0.05, -0.05), fmt(rc, 2) + '%', 'beyond ±0.05%'));
  var rmiV = last(rmi(C, 14, 3));
  push(R('rmi', G, 'Relative Momentum Index 14,3', 'vote', band(rmiV, 55, 45), fmt(rmiV, 1), '>55 long · <45 short'));
  var r14 = last(rsi(C, 14));
  push(R('rsi', G, 'RSI 14', 'vote', band(r14, 55, 45), fmt(r14, 1), '>55 long · <45 short'));
  var rvi = (function(){ var nu = rows.map(function(r, k){ if (k < 3) return 0; var f = function(j){ return rows[k - j].c - rows[k - j].o; }; return (f(0) + 2 * f(1) + 2 * f(2) + f(3)) / 6; }), de2 = rows.map(function(r, k){ if (k < 3) return 0; var f = function(j){ return rows[k - j].h - rows[k - j].l; }; return (f(0) + 2 * f(1) + 2 * f(2) + f(3)) / 6; }), a2 = sma(nu, 10), b2 = sma(de2, 10), v2 = a2.map(function(x, k){ return b2[k] ? x / b2[k] : 0; }), s2 = v2.map(function(x, k){ return k < 3 ? NaN : (v2[k] + 2 * v2[k - 1] + 2 * v2[k - 2] + v2[k - 3]) / 6; }); return { v: last(v2), s: last(s2) }; })();
  push(R('rvi', G, 'Relative Vigor Index 10', 'vote', vs(rvi.v, rvi.s), fmt(rvi.v, 3) + ' / ' + fmt(rvi.s, 3), 'RVI above its signal = long'));
  var stc = (function(){ var m2 = macd(C, 23, 50, 9).line, st1 = nanArr(n), pf = nanArr(n), st2 = nanArr(n), o2 = nanArr(n); for (var k = 60; k < n; k++){ var hh = -Infinity, ll = Infinity; for (var j = 0; j < 10; j++){ hh = Math.max(hh, m2[k - j]); ll = Math.min(ll, m2[k - j]); } st1[k] = hh > ll ? 100 * (m2[k] - ll) / (hh - ll) : (isFinite(st1[k - 1]) ? st1[k - 1] : 50); pf[k] = isFinite(pf[k - 1]) ? pf[k - 1] + 0.5 * (st1[k] - pf[k - 1]) : st1[k]; } for (var k2 = 70; k2 < n; k2++){ var h2 = -Infinity, l2 = Infinity; for (var j2 = 0; j2 < 10; j2++){ h2 = Math.max(h2, pf[k2 - j2]); l2 = Math.min(l2, pf[k2 - j2]); } st2[k2] = h2 > l2 ? 100 * (pf[k2] - l2) / (h2 - l2) : (isFinite(st2[k2 - 1]) ? st2[k2 - 1] : 50); o2[k2] = isFinite(o2[k2 - 1]) ? o2[k2 - 1] + 0.5 * (st2[k2] - o2[k2 - 1]) : st2[k2]; } return o2; })();
  push(R('stc', G, 'Schaff Trend Cycle 23,50,10', 'vote', (last(stc) > 50 && last(stc) >= at(stc, 1)) ? 1 : (last(stc) < 50 && last(stc) <= at(stc, 1)) ? -1 : 0, fmt(last(stc), 1), 'above 50 and rising = long'));
  var smi = (function(){ var rel = rows.map(function(r, k){ return k < 12 ? 0 : r.c - midHL(rows, 13, k); }), rg = rows.map(function(r, k){ return k < 12 ? 0 : hhll(rows, 13, k, true) - hhll(rows, 13, k, false); }), a2 = ema(fill0(ema(rel, 25)), 2), b2 = ema(fill0(ema(rg, 25)), 2), v2 = a2.map(function(x, k){ return b2[k] ? 100 * x / (0.5 * b2[k]) : 0; }); return v2; })();
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
  var ts2 = last(tsi(C, 25, 13));
  push(R('tsi', G, 'TSI 25/13 (True Strength)', 'vote', band(ts2, 5, -5), fmt(ts2, 1), 'beyond ±5'));
  var uo = (function(){ var bp = rows.map(function(r, k){ return k ? r.c - Math.min(r.l, rows[k - 1].c) : 0; }), tr2 = rows.map(function(r, k){ return k ? Math.max(r.h, rows[k - 1].c) - Math.min(r.l, rows[k - 1].c) : r.h - r.l; }), sv = function(p){ var a2 = 0, b2 = 0; for (var j = 0; j < p; j++){ a2 += bp[i - j]; b2 += tr2[i - j]; } return b2 ? a2 / b2 : 0; }; return 100 * (4 * sv(7) + 2 * sv(14) + sv(28)) / 7; })();
  push(R('uo', G, 'Ultimate Oscillator 7,14,28', 'vote', band(uo, 55, 45), fmt(uo, 1), '>55 long · <45 short'));
  var wr = last(willr(rows, 14));
  push(R('willr', G, 'Williams %R 14', 'vote', band(wr, -40, -60), fmt(wr, 0), '>−40 long · <−60 short'));
  var WT = waveTrend(rows, 10, 21);
  push(R('wavetrend', G, 'WaveTrend (10,21)', 'vote', (last(WT.wt1) > last(WT.wt2) && last(WT.wt1) > 0) ? 1 : (last(WT.wt1) < last(WT.wt2) && last(WT.wt1) < 0) ? -1 : 0, fmt(last(WT.wt1), 1) + ' / ' + fmt(last(WT.wt2), 1), 'WT1 above WT2 on its side of 0 = long'));
  var vip = 0, vim = 0, vtr = 0; for (var vj = 0; vj < 14; vj++){ vip += Math.abs(rows[i - vj].h - rows[i - vj - 1].l); vim += Math.abs(rows[i - vj].l - rows[i - vj - 1].h); vtr += TR[i - vj]; }
  push(R('vortex', G, 'Vortex 14 (VI+ vs VI−)', 'vote', vs(vip, vim), fmt(vip / vtr, 3) + ' / ' + fmt(vim / vtr, 3), 'VI+ above VI− = long'));
  push(R('htSine', G, 'Ehlers Sine Wave', 'vote', vs(last(HT.sine), last(HT.lead)), fmt(last(HT.sine), 3) + ' / ' + fmt(last(HT.lead), 3), 'sine above lead sine = long'));
  var tdC = tdSequential(rows);
  push(R('td', G, 'TD Sequential', 'vote', tdC >= 9 ? -1 : tdC <= -9 ? 1 : 0, String(tdC), '≥9 = exhaustion short (contrarian), ≤−9 = exhaustion long'));
  push(R('vumanchu', G, 'VuManChu Cipher B (= WaveTrend + MFI composite)', 'print', 0, 'same core as WaveTrend above', 'proprietary composite; the WaveTrend + MFI reads capture its mechanics'));
  var sprR = last(spearmanRank(C, 14));
  push(R('spearman', G, 'Spearman Rank Correlation 14', 'vote', band(sprR, 0.7, -0.7), fmt(sprR, 3), '> +0.7 long · < −0.7 short'));
  var EF = elderForce(rows, 13);
  push(R('efi', G, 'Elder\'s Force Index (EMA 13)', 'vote', sgn(last(EF)), fmt(last(EF), 0), 'positive = long'));
  var vwM = (function(){ var vwF = ema(fill0(vwmaArr(rows, 12).map(function(x, k){ return x - (isFinite(sma(C, 12)[k]) ? sma(C, 12)[k] : x); })), 9); return vwF; })();
  push(R('vwmacd', G, 'Volume-Weighted MACD (12,26)', 'vote', vs(last(vwM), at(vwM, 1)), fmt(last(vwM), 3), 'rising = long'));

  /* ───── TIER 3: VOLATILITY ───── */
  G = 'VOLATILITY';
  var dr = dayRanges(rows), adrv = NaN, todayR = NaN;
  if (dr.length >= 3){ var cnt = 0, sv2 = 0; for (var di = dr.length - 2; di >= 0 && cnt < 14; di--){ sv2 += dr[di].h - dr[di].l; cnt++; } adrv = sv2 / cnt; todayR = dr[dr.length - 1].h - dr[dr.length - 1].l; }
  push(R('adr', G, 'Average Day Range 14', 'regime', isFinite(adrv) && todayR > adrv ? -1 : 0, fmt(todayR) + ' of ' + fmt(adrv), 'today already beyond its average range = stretched'));
  push(R('atr', G, 'ATR 14', 'regime', 0, fmt(a14), 'sizes the stop; no side'));
  var chop = (function(){ var sv3 = 0, hh = -Infinity, ll = Infinity; for (var j = 0; j < 14; j++){ sv3 += TR[i - j]; hh = Math.max(hh, rows[i - j].h); ll = Math.min(ll, rows[i - j].l); } return hh > ll ? 100 * Math.log10(sv3 / (hh - ll)) / Math.log10(14) : 50; })();
  push(R('chop', G, 'Choppiness Index 14', 'regime', chop > 61.8 ? -1 : chop < 38.2 ? 1 : 0, fmt(chop, 1), '>61.8 = CHOP · <38.2 = trending'));
  var bw = bbm ? (bbu - bbl) / bbm : NaN, bwArr = C.map(function(_, k){ return k < 19 ? NaN : 4 * stdev(C, 20)[k] / S20[k]; }), bwMin = Infinity; for (var bk2 = 1; bk2 <= 50 && i - bk2 >= 0; bk2++) bwMin = Math.min(bwMin, bwArr[i - bk2]);
  push(R('bbw', G, 'Bollinger bandwidth', 'regime', bw <= bwMin ? -1 : 0, fmt(100 * bw, 2) + '%', 'at a 50-bar low = squeeze (regime)'));
  var lr2 = C.map(function(x, k){ return k ? Math.log(x / C[k - 1]) : 0; }), hv2 = 100 * last(stdev(lr2, 20)) * Math.sqrt(96 * 365);
  push(R('hv', G, 'Historical volatility 20 (annualised)', 'regime', 0, fmt(hv2, 1) + '%', 'no side'));
  var hvArr = []; for (var hvi = 20; hvi < n; hvi++) hvArr.push(last(stdev(lr2.slice(0, hvi + 1), 20)));
  var hvpVal = 0; if (hvArr.length > 50){ var cur = hvArr[hvArr.length - 1], below = 0; for (var hvi2 = 0; hvi2 < hvArr.length - 1; hvi2++) if (hvArr[hvi2] < cur) below++; hvpVal = 100 * below / (hvArr.length - 1); }
  push(R('hvp', G, 'Historical Volatility Percentile', 'regime', hvpVal < 10 ? -1 : 0, fmt(hvpVal, 0) + '%', '<10% = extreme squeeze, breakout imminent'));
  var miE = ema(rows.map(function(r){ return r.h - r.l; }), 9), miE2 = ema(fill0(miE), 9), mi = 0; for (var mj = 0; mj < 25; mj++) mi += miE[i - mj] / (miE2[i - mj] || 1);
  push(R('mass', G, 'Mass Index 25', 'regime', mi > 27 ? -1 : 0, fmt(mi, 2), '>27 = reversal bulge'));
  push(R('natr', G, 'NATR 14', 'regime', 0, fmt(100 * a14 / px, 3) + '%', 'no side'));
  push(R('sd', G, 'Standard deviation 20', 'regime', 0, fmt(bbs), 'no side'));
  var ul = (function(){ var s2 = 0; for (var j = 0; j < 14; j++){ var mx = -Infinity; for (var q2 = 0; q2 <= j; q2++) mx = Math.max(mx, C[i - 13 + j - q2]); var d2 = 100 * (C[i - 13 + j] - mx) / mx; s2 += d2 * d2; } return Math.sqrt(s2 / 14); })();
  push(R('ulcer', G, 'Ulcer Index 14', 'regime', 0, fmt(ul, 3), 'drawdown stress; no side'));
  var pb = (bbu > bbl) ? (px - bbl) / (bbu - bbl) : 0.5;
  push(R('pctb', G, 'Bollinger %B', 'vote', pb > 1 ? 1 : pb < 0 ? -1 : 0, fmt(pb, 2), 'walking outside the band, on that side'));
  var vst = supertrend(rows, 14, 2);
  push(R('vstop', G, 'Volatility Stop (ATR 14 ×2)', 'vote', isFinite(last(vst)) ? last(vst) : 0, last(vst) === 1 ? 'below price' : 'above price', 'stop below price = long'));
  var ch = chandelierExit(rows, 22, 3);
  push(R('chandelier', G, 'Chandelier Exit 22,3', 'vote', px > last(ch.hi) ? 1 : px < last(ch.lo) ? -1 : 0, fmt(last(ch.hi)) + ' / ' + fmt(last(ch.lo)), 'above the long exit = long'));
  var ttmOn = bbu < (kem + 1.5 * a14) && bbl > (kem - 1.5 * a14);
  push(R('ttm', G, 'TTM Squeeze (BB inside KC)', 'regime', ttmOn ? -1 : 0, ttmOn ? 'SQUEEZE ON' : 'off', 'BB inside KC = coiled (regime)'));
  var wvf = williamsVixFix(rows, 22);
  push(R('wvf', G, 'Williams VIX Fix 22', 'regime', last(wvf) > 2 * last(sma(fill0(wvf), 20)) ? -1 : 0, fmt(last(wvf), 2), 'spike = extreme fear / capitulation'));
  var fdiV = (function(){ var H2 = -Infinity, L2 = Infinity, H3 = -Infinity, L3 = Infinity, HA = -Infinity, LA = Infinity, half = 15; for (var j = 0; j < half; j++){ H2 = Math.max(H2, C[i-j]); L2 = Math.min(L2, C[i-j]); } for (var j2 = half; j2 < 30; j2++){ H3 = Math.max(H3, C[i-j2]); L3 = Math.min(L3, C[i-j2]); } for (var j3 = 0; j3 < 30; j3++){ HA = Math.max(HA, C[i-j3]); LA = Math.min(LA, C[i-j3]); } var n1 = (H2-L2)/half, n2 = (H3-L3)/half, n3 = (HA-LA)/30; return (n1>0&&n2>0&&n3>0) ? (Math.log(n1+n2)-Math.log(n3))/Math.log(2) : 1.5; })();
  push(R('fdi', G, 'Fractal Dimension Index 30', 'regime', fdiV > 1.6 ? -1 : fdiV < 1.4 ? 1 : 0, fmt(fdiV, 3), '>1.6 = random walk (chop) · <1.4 = trending'));
  var gcB = ehlersSuperSmoother(C, 20), gcS = last(stdev(C, 20));
  push(R('gauss', G, 'Gaussian Channel 20', 'vote', px > last(gcB) + gcS ? 1 : px < last(gcB) - gcS ? -1 : 0, fmt(last(gcB) - gcS) + ' – ' + fmt(last(gcB) + gcS), 'outside the channel on that side'));

  /* ───── TIER 4: VOLUME & CAPITAL FLOW ───── */
  G = 'VOLUME';
  var AD = adl(rows);
  push(R('adl', G, 'Accumulation/Distribution (10-bar slope)', 'vote', vs(last(AD), at(AD, 10)), fmt(last(AD), 0), 'rising = long'));
  var cm2 = last(cmf(rows, 20));
  push(R('cmf', G, 'Chaikin Money Flow 20', 'vote', band(cm2, 0.05, -0.05), fmt(cm2, 3), 'beyond ±0.05'));
  var OBV = obv(rows);
  push(R('obv', G, 'OBV slope (20 bars)', 'vote', slopeVote(OBV, 20, 0.001), fmt(last(OBV), 0), 'rising = accumulation'));
  var MFI = last(mfi(rows, 14));
  push(R('mfi', G, 'Money Flow Index 14', 'vote', band(MFI, 55, 45), fmt(MFI, 1), '>55 long · <45 short'));
  var rvA = last(sma(VOL, 20)), curV = VOL[i], rvolV = rvA ? curV / rvA : 1;
  push(R('rvol', G, 'Relative Volume (vs 20-bar avg)', 'regime', rvolV > 3 ? 1 : 0, fmt(rvolV, 2) + 'x', '>3x = volume explosion; confirms breakouts'));
  push(R('efi2', G, 'Elder Force Index 13', 'print', 0, 'same as efi in MOMENTUM', 'counted once above'));
  var klA = (function(){ var dm = rows.map(function(r, k){ return k ? (r.h > rows[k-1].h && r.l > rows[k-1].l ? r.v : r.h < rows[k-1].h && r.l < rows[k-1].l ? -r.v : 0) : 0; }); var kf = ema(dm, 34), ks = ema(dm, 55); return kf.map(function(x, k){ return x - ks[k]; }); })();
  push(R('klinger', G, 'Klinger Oscillator (approx 34/55)', 'vote', vs(last(klA), at(klA, 1)), fmt(last(klA), 0), 'rising = long'));
  var tmf = (function(){ var o3 = nanArr(n); for (var k = 20; k < n; k++){ var s2 = 0, sv2 = 0; for (var j = 0; j < 21; j++){ var tr2 = Math.max(rows[k-j].h, rows[k-j-1] ? rows[k-j-1].c : rows[k-j].h) - Math.min(rows[k-j].l, rows[k-j-1] ? rows[k-j-1].c : rows[k-j].l); s2 += tr2 ? ((rows[k-j].c - rows[k-j].l) - (rows[k-j].h - rows[k-j].c)) / tr2 * rows[k-j].v : 0; sv2 += rows[k-j].v; } o3[k] = sv2 ? s2 / sv2 : 0; } return o3; })();
  push(R('tmf', G, 'Twiggs Money Flow 21', 'vote', band(last(tmf), 0.05, -0.05), fmt(last(tmf), 3), 'beyond ±0.05'));

  /* ───── TIER 5: TREND STRENGTH ───── */
  G = 'TREND STRENGTH';
  push(R('adx', G, 'ADX 14 (trend strength)', 'regime', adxv < 20 ? -1 : adxv > 25 ? 1 : 0, fmt(adxv, 1), '<20 = range (chop) · >25 = trending'));
  var arU = 0, arD = 0, arHH = i, arLL = i; for (var aj = 1; aj <= 25 && i - aj >= 0; aj++){ if (rows[i - aj].h > rows[arHH].h) arHH = i - aj; if (rows[i - aj].l < rows[arLL].l) arLL = i - aj; } arU = 100 * (25 - (i - arHH)) / 25; arD = 100 * (25 - (i - arLL)) / 25;
  push(R('aroon', G, 'Aroon 25', 'vote', (arU > 70 && arD < 30) ? 1 : (arD > 70 && arU < 30) ? -1 : 0, 'up ' + fmt(arU, 0) + ' / dn ' + fmt(arD, 0), 'Aroon Up dominant = long'));
  var vhf = (function(){ var hh = -Infinity, ll = Infinity, s2 = 0; for (var j = 0; j < 28; j++){ hh = Math.max(hh, C[i - j]); ll = Math.min(ll, C[i - j]); if (j) s2 += Math.abs(C[i - j] - C[i - j + 1]); } return s2 ? (hh - ll) / s2 : 0; })();
  push(R('vhf', G, 'Vertical Horizontal Filter 28', 'regime', vhf < 0.3 ? -1 : vhf > 0.5 ? 1 : 0, fmt(vhf, 3), '<0.3 = range · >0.5 = trending'));
  push(R('ht_mode', G, 'Hilbert Transform mode', 'regime', last(HT.mode) === 0 ? -1 : 1, last(HT.mode) === 0 ? 'cycle' : 'trend', 'cycle mode = chop'));

  /* ───── TIER 6: STRUCTURE & SMC ───── */
  G = 'STRUCTURE / SMC';
  var fvg = freshFvg(rows);
  push(R('fvg', G, 'Fair Value Gap (nearest unfilled)', 'vote', fvg ? fvg.dir : 0, fvg ? (fvg.dir > 0 ? 'bullish' : 'bearish') + ' FVG · ' + fvg.age + ' bars ago' : 'none', 'direction of the nearest unfilled gap'));
  var choch = (function(){ var pivH = [], pivL = []; for (var k = 5; k < n - 1; k++){ var isH = true, isL = true; for (var j = 1; j <= 5; j++){ if (rows[k].h <= rows[k-j].h || rows[k].h <= rows[Math.min(k+j, n-1)].h) isH = false; if (rows[k].l >= rows[k-j].l || rows[k].l >= rows[Math.min(k+j, n-1)].l) isL = false; } if (isH) pivH.push(rows[k].h); if (isL) pivL.push(rows[k].l); } if (pivH.length >= 2 && pivL.length >= 2){ var lh = pivH[pivH.length-1], ph = pivH[pivH.length-2]; var ll = pivL[pivL.length-1], pl = pivL[pivL.length-2]; if (lh > ph && ll > pl) return 1; if (lh < ph && ll < pl) return -1; } return 0; })();
  push(R('choch', G, 'CHoCH (Change of Character)', 'vote', choch, choch > 0 ? 'bullish' : choch < 0 ? 'bearish' : 'neutral', 'higher highs + higher lows = bullish structure'));
  push(R('ob', G, 'Order Blocks (nearest OB zone)', 'print', 0, 'see CHoCH structure', 'OB zones are the swing candles at structure breaks; CHoCH captures the direction'));
  push(R('liq_sweep', G, 'Liquidity Sweep (equal H/L)', 'vote', (function(){ var hh20 = hhll(rows, 20, i-1, true); if (rows[i].h > hh20 && rows[i].c < hh20) return -1; var ll20 = hhll(rows, 20, i-1, false); if (rows[i].l < ll20 && rows[i].c > ll20) return 1; return 0; })(), (function(){ var hh20 = hhll(rows, 20, i-1, true); if (rows[i].h > hh20 && rows[i].c < hh20) return 'swept highs + rejected'; var ll20 = hhll(rows, 20, i-1, false); if (rows[i].l < ll20 && rows[i].c > ll20) return 'swept lows + rejected'; return 'no sweep'; })(), 'price pierced the 20-bar extreme then closed back inside'));
  push(R('mss', G, 'MSS (Market Structure Sweep)', 'print', 0, 'see liquidity sweep above', 'MSS = liquidity sweep + reclaim; same logic'));
  push(R('bpr', G, 'Balanced Price Range', 'print', 0, 'see FVG above', 'BPR is two overlapping FVGs; the single-FVG read captures the concept'));
  push(R('breaker', G, 'Mitigation / Breaker Block', 'print', 0, 'see CHoCH', 'breaker blocks are failed order blocks; CHoCH captures the structural flip'));

  /* ───── TIER 7: CANDLE PATTERNS ───── */
  G = 'CANDLE PATTERNS';
  var b0 = rows[i], b1 = rows[i - 1], b2p = rows[i - 2];
  var body = Math.abs(b0.c - b0.o), range0 = b0.h - b0.l, upperWick = b0.h - Math.max(b0.c, b0.o), lowerWick = Math.min(b0.c, b0.o) - b0.l;
  push(R('cp_hammer', G, 'Hammer / Hanging Man', 'vote', (lowerWick > 2 * body && upperWick < body * 0.3) ? (b0.c > b1.c ? 1 : -1) : 0, (lowerWick > 2 * body) ? 'yes' : 'no', 'long lower wick; direction from context'));
  push(R('cp_engulf', G, 'Engulfing', 'vote', (b0.c > b0.o && b1.c < b1.o && b0.c > b1.o && b0.o < b1.c) ? 1 : (b0.c < b0.o && b1.c > b1.o && b0.o > b1.c && b0.c < b1.o) ? -1 : 0, 'scan', 'bullish or bearish engulfing'));
  push(R('cp_doji', G, 'Doji', 'vote', body < range0 * 0.05 ? (b0.c > b1.c ? 1 : -1) : 0, body < range0 * 0.05 ? 'yes' : 'no', 'indecision; direction from prior trend'));
  push(R('cp_mstar', G, 'Morning / Evening Star', 'vote', (function(){ var b1b = Math.abs(b1.c - b1.o), b2b = Math.abs(b2p.c - b2p.o); if (b1b < b2b * 0.3 && body > b2b * 0.5){ if (b2p.c < b2p.o && b0.c > b0.o) return 1; if (b2p.c > b2p.o && b0.c < b0.o) return -1; } return 0; })(), 'scan', '3-candle reversal'));
  push(R('cp_harami', G, 'Harami', 'vote', (body < Math.abs(b1.c - b1.o) && Math.max(b0.c, b0.o) < Math.max(b1.c, b1.o) && Math.min(b0.c, b0.o) > Math.min(b1.c, b1.o)) ? (b1.c < b1.o ? 1 : -1) : 0, 'scan', 'inside bar; reversal of prior'));
  push(R('cp_pierce', G, 'Piercing / Dark Cloud', 'vote', (b1.c < b1.o && b0.c > b0.o && b0.o < b1.l && b0.c > (b1.o + b1.c) / 2 && b0.c < b1.o) ? 1 : (b1.c > b1.o && b0.c < b0.o && b0.o > b1.h && b0.c < (b1.o + b1.c) / 2 && b0.c > b1.o) ? -1 : 0, 'scan', 'piercing line or dark cloud cover'));
  push(R('cp_3ws', G, 'Three White Soldiers / Black Crows', 'vote', (function(){ if (i < 2) return 0; var bull = b0.c > b0.o && b1.c > b1.o && b2p.c > b2p.o && b0.c > b1.c && b1.c > b2p.c; var bear = b0.c < b0.o && b1.c < b1.o && b2p.c < b2p.o && b0.c < b1.c && b1.c < b2p.c; return bull ? 1 : bear ? -1 : 0; })(), 'scan', 'three consecutive strong closes'));
  push(R('cp_spin', G, 'Spinning Top', 'regime', body < range0 * 0.2 && upperWick > body && lowerWick > body ? -1 : 0, body < range0 * 0.2 ? 'yes' : 'no', 'indecision'));
  push(R('cp_marubozu', G, 'Marubozu', 'vote', (upperWick < body * 0.05 && lowerWick < body * 0.05) ? (b0.c > b0.o ? 1 : -1) : 0, 'scan', 'full-body candle, no wicks'));
  push(R('cp_tweezer', G, 'Tweezer Top / Bottom', 'vote', (Math.abs(b0.h - b1.h) < a14 * 0.1 && b0.c < b0.o && b1.c > b1.o) ? -1 : (Math.abs(b0.l - b1.l) < a14 * 0.1 && b0.c > b0.o && b1.c < b1.o) ? 1 : 0, 'scan', 'matching highs/lows with reversal'));
  push(R('cp_belt', G, 'Belt Hold', 'vote', (b0.c > b0.o && b0.o === b0.l) ? 1 : (b0.c < b0.o && b0.o === b0.h) ? -1 : 0, 'scan', 'opens at its extreme'));
  push(R('cp_kicker', G, 'Kicker', 'vote', (b1.c < b1.o && b0.c > b0.o && b0.o > b1.o) ? 1 : (b1.c > b1.o && b0.c < b0.o && b0.o < b1.o) ? -1 : 0, 'scan', 'gap in opposite direction'));
  push(R('cp_inv_hammer', G, 'Inverted Hammer / Shooting Star', 'vote', (upperWick > 2 * body && lowerWick < body * 0.3) ? (b0.c > b1.c ? 1 : -1) : 0, 'scan', 'long upper wick; direction from context'));
  push(R('cp_3inside', G, 'Three Inside Up / Down', 'vote', (function(){ if (i < 2) return 0; var har = Math.abs(b1.c-b1.o) < Math.abs(b2p.c-b2p.o) && Math.max(b1.c,b1.o) < Math.max(b2p.c,b2p.o) && Math.min(b1.c,b1.o) > Math.min(b2p.c,b2p.o); if (!har) return 0; if (b2p.c < b2p.o && b0.c > b0.o && b0.c > b2p.o) return 1; if (b2p.c > b2p.o && b0.c < b0.o && b0.c < b2p.o) return -1; return 0; })(), 'scan', 'harami confirmed by third bar'));
  push(R('cp_abandoned', G, 'Abandoned Baby', 'vote', (function(){ if (i < 2) return 0; var doji = Math.abs(b1.c-b1.o) < (b1.h-b1.l)*0.05; if (!doji) return 0; if (b1.h < Math.min(b2p.c,b2p.o) && b1.h < Math.min(b0.c,b0.o) && b0.c > b0.o) return 1; if (b1.l > Math.max(b2p.c,b2p.o) && b1.l > Math.max(b0.c,b0.o) && b0.c < b0.o) return -1; return 0; })(), 'scan', 'gapped doji reversal'));

  /* ───── TIER 8: SESSION & TIME ───── */
  G = 'SESSION & TIME';
  var nowH = new Date(rows[i].t * 1000).getUTCHours();
  var asianBars = [], londonBars = [], nyBars = [];
  for (var si = Math.max(0, n - 96); si < n; si++){
    var h2 = new Date(rows[si].t * 1000).getUTCHours();
    if (h2 >= 0 && h2 < 8) asianBars.push(rows[si]);
    if (h2 >= 7 && h2 < 16) londonBars.push(rows[si]);
    if (h2 >= 12 && h2 < 21) nyBars.push(rows[si]);
  }
  if (asianBars.length > 2){
    var asH = -Infinity, asL = Infinity; for (var ai = 0; ai < asianBars.length; ai++){ asH = Math.max(asH, asianBars[ai].h); asL = Math.min(asL, asianBars[ai].l); }
    push(R('asian', G, 'Asian Session Range', 'vote', px > asH ? 1 : px < asL ? -1 : 0, fmt(asL) + ' – ' + fmt(asH), 'above Asian high = long; swept and rejected = reversal'));
  } else {
    push(R('asian', G, 'Asian Session Range', 'print', 0, '—', 'not enough Asian session bars in window'));
  }
  var inKZ = (nowH >= 7 && nowH < 10) || (nowH >= 12 && nowH < 15);
  push(R('killzone', G, 'Killzone (London/NY)', 'regime', inKZ ? 1 : -1, inKZ ? 'ACTIVE' : 'DEAD', 'London 07–10 / NY 12–15 UTC; outside = low-quality signals'));
  push(R('silverbullet', G, 'Silver Bullet windows', 'regime', ((nowH === 3) || (nowH === 10) || (nowH === 14)) ? 1 : 0, ((nowH === 3) || (nowH === 10) || (nowH === 14)) ? 'ACTIVE' : 'off', '03:00, 10:00, 14:00 UTC 1-hour windows'));

  /* ───── TIER 9: STATISTICAL / ADAPTIVE ───── */
  G = 'STATISTICAL';
  var kalV = (function(){ var x = C[0], P = 1, Q = 0.01, R2 = 0.1; for (var k = 1; k < n; k++){ P += Q; var K = P / (P + R2); x = x + K * (C[k] - x); P = (1 - K) * P; } return x; })();
  push(R('kalman', G, 'Kalman Filter (simplified)', 'vote', vs(px, kalV), fmt(kalV), 'close above the Kalman estimate = long'));
  var hurst = (function(){ var p2 = 100, rs = []; for (var w = 10; w <= p2; w += 10){ var seg = C.slice(n - w); var m = seg.reduce(function(a2,b2){ return a2+b2; }, 0) / seg.length; var cum = 0, mx = -Infinity, mn = Infinity; for (var k = 0; k < seg.length; k++){ cum += seg[k] - m; mx = Math.max(mx, cum); mn = Math.min(mn, cum); } var s2 = Math.sqrt(seg.reduce(function(a2,b2){ return a2+(b2-m)*(b2-m); }, 0) / seg.length); if (s2 > 0) rs.push({ logN: Math.log(w), logRS: Math.log((mx-mn)/s2) }); } if (rs.length < 2) return 0.5; var sx = 0, sy = 0, sxx = 0, sxy = 0; for (var k2 = 0; k2 < rs.length; k2++){ sx += rs[k2].logN; sy += rs[k2].logRS; sxx += rs[k2].logN*rs[k2].logN; sxy += rs[k2].logN*rs[k2].logRS; } return (rs.length*sxy - sx*sy) / (rs.length*sxx - sx*sx); })();
  push(R('hurst', G, 'Hurst Exponent (R/S, simplified)', 'regime', hurst > 0.6 ? 1 : hurst < 0.4 ? -1 : 0, fmt(hurst, 3), '>0.6 = trending · <0.4 = mean-reverting · ~0.5 = random'));

  /* ───── TIER 10: CRYPTO-NATIVE ON-CHAIN (all n/a) ───── */
  G = 'ON-CHAIN (crypto-native)';
  push(R('hash_ribbons', G, 'Hash Ribbons (BTC hash rate 30/60 MA)', 'n/a', 0, '—', 'needs Bitcoin network hash rate data — never faked'));
  push(R('pi_cycle', G, 'Pi Cycle Top / Bottom (111 / 350×2 MA)', 'n/a', 0, '—', 'needs daily close series across full cycle — never faked'));
  push(R('fear_greed', G, 'Fear & Greed Index', 'n/a', 0, '—', 'needs sentiment aggregation (social, volatility, dominance) — never faked'));
  push(R('sopr', G, 'SOPR / aSOPR (Spent Output Profit Ratio)', 'n/a', 0, '—', 'needs UTXO-level on-chain data — never faked'));
  push(R('puell', G, 'Puell Multiple (miner revenue / 365d MA)', 'n/a', 0, '—', 'needs miner revenue data — never faked'));
  push(R('cdd', G, 'Coin Days Destroyed / Dormancy Flow', 'n/a', 0, '—', 'needs UTXO age tracking — never faked'));
  push(R('exchange_net', G, 'Exchange Net Position Change', 'n/a', 0, '—', 'needs exchange reserve tracking (Glassnode/CryptoQuant) — never faked'));
  push(R('mpi', G, 'Miner\'s Position Index', 'n/a', 0, '—', 'needs miner wallet tracking — never faked'));
  push(R('whale_ratio', G, 'Exchange Whale Ratio', 'n/a', 0, '—', 'needs top-10 deposit flow data — never faked'));
  push(R('urpd', G, 'URPD (UTXO Realized Price Distribution)', 'n/a', 0, '—', 'needs full UTXO set — never faked'));
  push(R('mvrv', G, 'MVRV Z-Score', 'n/a', 0, '—', 'needs realized cap — never faked'));
  push(R('hodl_waves', G, 'Realized Cap HODL Waves', 'n/a', 0, '—', 'needs UTXO age bands — never faked'));
  push(R('reserve_risk', G, 'Reserve Risk', 'n/a', 0, '—', 'needs long-term holder HODL data — never faked'));
  push(R('sth_sopr', G, 'STH / LTH SOPR split', 'n/a', 0, '—', 'needs wallet-age segmented SOPR — never faked'));
  push(R('nvt', G, 'NVT Ratio (Network Value to Transactions)', 'n/a', 0, '—', 'needs on-chain transaction volume — never faked'));
  push(R('ssr', G, 'Stablecoin Supply Ratio', 'n/a', 0, '—', 'needs stablecoin market cap data — never faked'));
  push(R('taker_ratio', G, 'Taker Buy/Sell Ratio', 'n/a', 0, '—', 'needs exchange taker flow data — never faked'));
  push(R('issr', G, 'Illiquid Supply Shock Ratio', 'n/a', 0, '—', 'needs entity-level supply classification — never faked'));
  push(R('vdd', G, 'Value Days Destroyed Multiple', 'n/a', 0, '—', 'needs CDD × price data — never faked'));
  push(R('thermocap', G, 'Thermocap / MC-to-Thermocap Ratio', 'n/a', 0, '—', 'needs aggregate miner cost data — never faked'));

  /* ───── TIER 11: DERIVATIVES & MARGIN (all n/a) ───── */
  G = 'DERIVATIVES';
  push(R('funding', G, 'Funding Rates (perpetual futures)', 'n/a', 0, '—', 'needs real-time exchange API data — never faked'));
  push(R('oi', G, 'Open Interest', 'n/a', 0, '—', 'needs exchange derivatives data — never faked'));
  push(R('liq_clusters', G, 'Liquidation Clusters / Heatmaps', 'n/a', 0, '—', 'needs leveraged position estimates — never faked'));
  push(R('ls_ratio', G, 'Long/Short Account Ratio', 'n/a', 0, '—', 'needs exchange positioning data — never faked'));
  push(R('gex', G, 'Gamma Exposure (GEX)', 'n/a', 0, '—', 'needs options OI + strike data — never faked'));
  push(R('max_pain', G, 'Max Pain Price', 'n/a', 0, '—', 'needs options OI by strike — never faked'));
  push(R('pc_ratio', G, 'Put/Call Ratio', 'n/a', 0, '—', 'needs options market data — never faked'));
  push(R('iv_rank', G, 'IV Rank / IV Percentile', 'n/a', 0, '—', 'needs implied volatility history — never faked'));
  push(R('dvol', G, 'DVOL (Deribit Volatility Index)', 'n/a', 0, '—', 'needs Deribit options book — never faked'));
  push(R('skew25', G, 'Delta Skew (25-Delta)', 'n/a', 0, '—', 'needs OTM options IV — never faked'));
  push(R('perp_basis', G, 'Perpetual Basis (cash-and-carry spread)', 'n/a', 0, '—', 'needs futures premium data — never faked'));
  push(R('oi_funding', G, 'OI-Weighted Funding Rate', 'n/a', 0, '—', 'needs aggregated exchange data — never faked'));
  push(R('elr', G, 'Estimated Leverage Ratio', 'n/a', 0, '—', 'needs exchange reserve + OI data — never faked'));
  push(R('smart_dumb', G, 'Smart Money vs Dumb Money Confidence', 'n/a', 0, '—', 'needs institutional positioning data — never faked'));

  /* ───── TIER 12: ORDER FLOW & TAPE (all n/a) ───── */
  G = 'ORDER FLOW / TAPE';
  push(R('vol_profile', G, 'Volume Profile (TPO / POC)', 'n/a', 0, '—', 'needs tick-level volume at price — never faked'));
  push(R('footprint', G, 'Footprint / Cluster Charts', 'n/a', 0, '—', 'needs bid/ask volume per tick — never faked'));
  push(R('delta_imb', G, 'Delta Imbalance (Footprint)', 'n/a', 0, '—', 'needs tick-level bid/ask delta — never faked'));
  push(R('iceberg', G, 'Iceberg Order Detectors', 'n/a', 0, '—', 'needs live L2 order book + T&S tape — never faked'));
  push(R('avwap', G, 'Anchored VWAP', 'n/a', 0, '—', 'needs a user-defined anchor point — never faked'));
  push(R('cvd_cohort', G, 'CVD by Cohort (whale vs retail)', 'n/a', 0, '—', 'needs trade-size segmented tape — never faked'));
  push(R('stacked_imb', G, 'Stacked Imbalances', 'n/a', 0, '—', 'needs tick-by-tick footprint data — never faked'));
  push(R('delta_exhaust', G, 'Delta Exhaustion Divergence', 'n/a', 0, '—', 'needs footprint delta series — never faked'));
  push(R('vpin', G, 'VPIN (Volume-Sync Prob Informed Trading)', 'n/a', 0, '—', 'needs tick-level trade classification — never faked'));
  push(R('kyle_lambda', G, 'Kyle\'s Lambda (price impact)', 'n/a', 0, '—', 'needs high-frequency trade + price data — never faked'));
  push(R('micro_price', G, 'Micro-Price (volume-weighted midpoint)', 'n/a', 0, '—', 'needs live L2 best bid/ask depth — never faked'));
  push(R('ofi', G, 'Order Flow Imbalance', 'n/a', 0, '—', 'needs limit order book snapshots — never faked'));
  push(R('tape_vel', G, 'Tape Velocity (trades/sec)', 'n/a', 0, '—', 'needs real-time trade stream — never faked'));
  push(R('whale_bubbles', G, 'Whale Trade Size Bubbles', 'n/a', 0, '—', 'needs trade-size filtered stream — never faked'));
  push(R('spoof', G, 'Spoofing / Fake Liquidity Detectors', 'n/a', 0, '—', 'needs live L2 monitoring — never faked'));
  push(R('obi', G, 'Order Book Imbalance (bid/ask depth)', 'n/a', 0, '—', 'needs live depth snapshots — never faked'));
  push(R('lvd', G, 'Liquidation Volume Delta', 'n/a', 0, '—', 'needs liquidation event stream — never faked'));
  push(R('l2_asym', G, 'L2 Depth Asymmetry Ratio', 'n/a', 0, '—', 'needs live order book depth — never faked'));
  push(R('hawkes', G, 'Hawkes Process Trade Arrival', 'n/a', 0, '—', 'needs tick-level timestamps — never faked'));

  /* ───── TIER 13: DEFI & AMM (all n/a) ───── */
  G = 'DEFI / AMM';
  push(R('uni_liq', G, 'Uniswap V3/V4 Liquidity Concentration', 'n/a', 0, '—', 'needs DEX pool tick data — never faked'));
  push(R('bridge_flows', G, 'Cross-Chain Net Bridge Flows', 'n/a', 0, '—', 'needs bridge monitoring data — never faked'));
  push(R('mev', G, 'MEV Toxic Flow Detectors', 'n/a', 0, '—', 'needs mempool analysis — never faked'));
  push(R('il_curves', G, 'Impermanent Loss Risk Curves', 'n/a', 0, '—', 'needs LP position data — never faked'));
  push(R('token_vel', G, 'Token Velocity (DEX turnover)', 'n/a', 0, '—', 'needs on-chain DEX volume — never faked'));

  /* ───── TIER 14: ML & AI (all n/a) ───── */
  G = 'ML / AI';
  push(R('lorentzian', G, 'Lorentzian Classification', 'n/a', 0, '—', 'needs trained ML model — never faked'));
  push(R('knn', G, 'K-Nearest Neighbors Classifier', 'n/a', 0, '—', 'needs trained ML model — never faked'));
  push(R('logistic', G, 'Logistic Regression Classifier', 'n/a', 0, '—', 'needs trained ML model — never faked'));
  push(R('hmm', G, 'Hidden Markov Model (regime)', 'n/a', 0, '—', 'needs trained probabilistic model — never faked'));
  push(R('svm', G, 'Support Vector Machine', 'n/a', 0, '—', 'needs trained ML model — never faked'));
  push(R('lstm', G, 'LSTM / GRU (RNN predictors)', 'n/a', 0, '—', 'needs trained neural network — never faked'));
  push(R('rf', G, 'Random Forest / Gradient Boosted Trees', 'n/a', 0, '—', 'needs trained ensemble model — never faked'));
  push(R('transformer', G, 'Transformer / CNN Hybrid', 'n/a', 0, '—', 'needs trained deep learning model — never faked'));

  /* ───── TIER 15: MACRO & CORRELATION (all n/a) ───── */
  G = 'MACRO / CORRELATION';
  push(R('usdt_dom', G, 'USDT Dominance Divergence', 'n/a', 0, '—', 'needs USDT.D market cap series — never faked'));
  push(R('cme_gap', G, 'CME Futures Gap Locator', 'n/a', 0, '—', 'needs CME Bitcoin Futures data — never faked'));
  push(R('alt_season', G, 'Altcoin Season Index', 'n/a', 0, '—', 'needs top-50 altcoin performance data — never faked'));
  push(R('lunar', G, 'Lunar Phase Cycles', 'n/a', 0, '—', 'esoteric timing — not a price-derived indicator'));
  push(R('gann', G, 'Gann Square of 9 / Planetary Lines', 'n/a', 0, '—', 'esoteric geometry — not a standard indicator'));
  push(R('pitchfork', G, 'Andrews\' Pitchfork', 'n/a', 0, '—', 'needs user-selected pivot points — never faked'));
  push(R('spread_zscore', G, 'Pairs Spread Z-Score (stat arb)', 'n/a', 0, '—', 'needs a second asset series — never faked'));

  /* ───── TIER 16: OPTIONS GREEKS (all n/a) ───── */
  G = 'OPTIONS GREEKS';
  push(R('vanna', G, 'Vanna (volatility-to-delta)', 'n/a', 0, '—', 'needs options pricing model — never faked'));
  push(R('charm', G, 'Charm (delta bleed)', 'n/a', 0, '—', 'needs options theta/delta model — never faked'));
  push(R('vomma', G, 'Vomma (vol of vega)', 'n/a', 0, '—', 'needs options second-order greeks — never faked'));

  /* ───── TIER 17: ADVANCED STAT (all n/a or regime) ───── */
  G = 'ADVANCED STATISTICAL';
  push(R('garch', G, 'GARCH (variance forecast)', 'n/a', 0, '—', 'needs iterative MLE fitting — too heavy for browser'));
  push(R('ou_bands', G, 'Ornstein-Uhlenbeck Mean Reversion', 'n/a', 0, '—', 'needs stochastic process calibration — never faked'));
  push(R('frac_diff', G, 'Fractional Differentiation', 'n/a', 0, '—', 'needs advanced data transformation — never faked'));
  push(R('dtw', G, 'Dynamic Time Warping Pattern Match', 'n/a', 0, '—', 'needs historical pattern library — never faked'));
  push(R('emd', G, 'Empirical Mode Decomposition', 'n/a', 0, '—', 'needs iterative sifting algorithm — never faked'));
  push(R('ssa', G, 'Singular Spectrum Analysis', 'n/a', 0, '—', 'needs eigendecomposition — never faked'));
  push(R('wavelet', G, 'Wavelet Transform Filters', 'n/a', 0, '—', 'needs wavelet packet decomposition — never faked'));
  push(R('shannon', G, 'Shannon Entropy (predictability)', 'n/a', 0, '—', 'needs probability distribution estimation — never faked'));
  push(R('var_model', G, 'Vector Autoregression Flow', 'n/a', 0, '—', 'needs multi-asset time series — never faked'));
  push(R('engle_granger', G, 'Engle-Granger Cointegration', 'n/a', 0, '—', 'needs paired asset series — never faked'));

  /* ───── TIER 18: PRINT / DUPLICATES ───── */
  G = 'DUPLICATES / COMPOSITES';
  push(R('trend_meter', G, 'Trend Meter (composite)', 'print', 0, 'see individual MAs above', 'composite of MAs already counted — no independent information'));
  push(R('cm_mtf_rsi', G, 'CM Ultimate RSI MTF', 'print', 0, 'see RSI above', 'RSI on higher TF; the 15m RSI read is the one tested'));
  push(R('nadaraya', G, 'Nadaraya-Watson Estimator', 'print', 0, 'see Ehlers Super Smoother / Kalman', 'kernel regression; similar information to the adaptive smoothers already counted'));
  push(R('renko', G, 'Renko / Kagi / Point & Figure', 'print', 0, 'see Range Filter', 'noise-reduced chart types; the Range Filter captures the concept'));
  push(R('vsa', G, 'Volume Spread Analysis (Wyckoff)', 'print', 0, 'see CMF + OBV', 'VSA logic is captured by CMF and OBV reads'));
  push(R('weis_wave', G, 'Weis Wave Volume', 'print', 0, 'see OBV + Zig Zag', 'accumulated wave volume; OBV slope + Zig Zag direction cover the concept'));
  push(R('hawkeye', G, 'Hawkeye Volume', 'print', 0, 'see OBV + CMF', 'proprietary volume classification; no independent computation'));
  push(R('opti_pine', G, 'OptiPine / Institutional Pipelines', 'print', 0, '—', 'execution architecture, not an indicator'));
  push(R('kelly', G, 'ATR-Adjusted Kelly Criterion Sizer', 'print', 0, '—', 'position sizing, not a directional signal'));
  push(R('grid_bot', G, 'Grid Bot Range Visualizer', 'print', 0, '—', 'execution tool, not a signal'));
  push(R('darvas', G, 'Darvas Box Logic', 'print', 0, 'see Donchian + Price Channel', 'captured by Donchian breakout and price channel reads'));
  push(R('no_wick', G, 'No-Wick Retest Levels', 'print', 0, 'see Marubozu candle pattern', 'no-wick detection in candle patterns; retest targeting needs history'));
  push(R('eqh_eql', G, 'EQH / EQL FVG Breakouts', 'print', 0, 'see Liquidity Sweep + FVG', 'equal highs/lows + FVG; captured by liquidity sweep and FVG reads'));
  push(R('inv_skew', G, 'Inventory Skew Oscillator', 'n/a', 0, '—', 'needs market maker inventory data — never faked'));
  push(R('dpr', G, 'Dual-Phase Reversal', 'print', 0, 'see TD Sequential + RSI', 'momentum exhaustion captured by TD Sequential and RSI reads'));
  push(R('rci', G, 'RCI 3-Lines (Rank Correlation)', 'print', 0, 'see Spearman above', 'RCI = Spearman correlation at multiple periods; already counted'));
  push(R('htf_stoch', G, 'HTF Stochastic Buckets', 'print', 0, 'see Stochastic reads', 'higher TF stochastic; the 15m stochastic reads are the tested ones'));

  /* ───── TIER 19: ADDITIONAL COMPUTABLE (from extended indicator list) ───── */
  G = 'EXTENDED COMPUTABLE';
  /* Efficiency Ratio (standalone regime) */
  var erV = (function(){ var dir2 = Math.abs(C[i] - C[i - 10]), vol2 = 0; for (var j = 0; j < 10; j++) vol2 += Math.abs(C[i - j] - C[i - j - 1]); return vol2 ? dir2 / vol2 : 0; })();
  push(R('er', G, 'Kaufman Efficiency Ratio 10', 'regime', erV > 0.6 ? 1 : erV < 0.3 ? -1 : 0, fmt(erV, 3), '>0.6 = trending · <0.3 = chop'));
  /* VIDYA (Chande's Variable Index Dynamic Average) */
  var vidya = (function(){ var o2 = nanArr(n); o2[0] = C[0]; var sc2 = 2 / (10 + 1); for (var k = 1; k < n; k++){ var up2 = 0, dn2 = 0; for (var j = 0; j < Math.min(9, k); j++){ var d2 = C[k - j] - C[k - j - 1]; if (d2 > 0) up2 += d2; else dn2 -= d2; } var cmo2 = (up2 + dn2) ? Math.abs(up2 - dn2) / (up2 + dn2) : 0; o2[k] = sc2 * cmo2 * C[k] + (1 - sc2 * cmo2) * (isFinite(o2[k - 1]) ? o2[k - 1] : C[k]); } return last(o2); })();
  push(R('vidya', G, 'VIDYA 10 (Variable Index Dynamic)', 'vote', vs(px, vidya), fmt(vidya), 'close above = long'));
  /* Laguerre RSI (Ehlers) */
  var lagRsi = (function(){ var g2 = 0.8, L0 = 0, L1 = 0, L2 = 0, L3 = 0, cu2 = 0, cd2 = 0; for (var k = 0; k < n; k++){ var pL0 = L0, pL1 = L1, pL2 = L2; L0 = (1 - g2) * C[k] + g2 * pL0; L1 = -g2 * L0 + pL0 + g2 * pL1; L2 = -g2 * L1 + pL1 + g2 * pL2; L3 = -g2 * L2 + pL2 + g2 * L3; cu2 = 0; cd2 = 0; if (L0 >= L1) cu2 += L0 - L1; else cd2 += L1 - L0; if (L1 >= L2) cu2 += L1 - L2; else cd2 += L2 - L1; if (L2 >= L3) cu2 += L2 - L3; else cd2 += L3 - L2; } return (cu2 + cd2) ? 100 * cu2 / (cu2 + cd2) : 50; })();
  push(R('laguerre', G, 'Laguerre RSI (Ehlers γ=0.8)', 'vote', band(lagRsi, 60, 40), fmt(lagRsi, 1), '>60 long · <40 short'));
  /* Connors RSI */
  var connRsi = (function(){ var r1 = last(rsi(C, 3)), streak = 0; for (var k = n - 1; k > 0; k--){ if (C[k] > C[k - 1]) { if (streak >= 0) streak++; else break; } else if (C[k] < C[k - 1]) { if (streak <= 0) streak--; else break; } else break; } var r2 = last(rsi([streak], 1)) || 50; var pctR = 0, cur2 = 100 * (C[i] - C[i - 1]) / C[i - 1], cnt2 = 0; for (var j = 1; j < 100 && i - j >= 1; j++){ if (100 * (C[i - j] - C[i - j - 1]) / C[i - j - 1] < cur2) cnt2++; } pctR = cnt2 / Math.min(99, i); return (r1 + r2 + 100 * pctR) / 3; })();
  push(R('crsi', G, 'Connors RSI (3, streak, %rank)', 'vote', band(connRsi, 60, 40), fmt(connRsi, 1), '>60 long · <40 short'));
  /* BW Market Facilitation Index */
  var bwMfi = (b0.h - b0.l) / (b0.v || 1), bwMfiP = (b1.h - b1.l) / (b1.v || 1);
  push(R('bwmfi', G, 'Bill Williams MFI (facilitation)', 'vote', (bwMfi > bwMfiP && b0.v > b1.v) ? (b0.c > b0.o ? 1 : -1) : 0, fmt(bwMfi, 6), 'green bar (rising MFI + rising vol) in candle direction'));
  /* VPCI (Volume Price Confirmation) */
  var vpci = (function(){ var vw2 = last(vwmaArr(rows, 20)), sm2 = last(S20); return sm2 ? (vw2 - sm2) / sm2 : 0; })();
  push(R('vpci', G, 'VPCI (Volume Price Confirmation)', 'vote', band(vpci, 0.001, -0.001), fmt(100 * vpci, 3) + '%', 'VWMA above SMA = volume-backed move'));
  /* PVI / NVI */
  var nvi = (function(){ var pv2 = 1000, nv2 = 1000; for (var k = 1; k < n; k++){ var pct2 = (C[k] - C[k - 1]) / C[k - 1]; if (rows[k].v > rows[k - 1].v) pv2 += pv2 * pct2; else nv2 += nv2 * pct2; } return { pvi: pv2, nvi: nv2 }; })();
  var nviMa = (function(){ var arr = [1000]; for (var k = 1; k < n; k++){ var p2 = (C[k] - C[k - 1]) / C[k - 1]; if (rows[k].v <= rows[k - 1].v) arr.push(arr[arr.length - 1] * (1 + p2)); else arr.push(arr[arr.length - 1]); } return last(sma(arr, 20)); })();
  push(R('nvi', G, 'NVI (Negative Volume Index vs MA)', 'vote', vs(nvi.nvi, nviMa), fmt(nvi.nvi, 0) + ' / ' + fmt(nviMa, 0), 'NVI above its MA = smart money accumulating'));
  /* VFI (Volume Flow Indicator) */
  var vfi = (function(){ var tp2 = rows.map(function(r){ return (r.h + r.l + r.c) / 3; }), cutoff2 = 0.2 * last(stdev(C.map(function(x, k){ return k ? Math.log(x / C[k - 1]) : 0; }), 20)); var o2 = 0; for (var k = 1; k < n; k++){ var d2 = Math.log(tp2[k]) - Math.log(tp2[k - 1]); if (Math.abs(d2) < cutoff2) continue; o2 += (d2 > 0 ? 1 : -1) * rows[k].v; } return o2; })();
  push(R('vfi', G, 'Volume Flow Indicator (VFI)', 'vote', sgn(vfi), fmt(vfi, 0), 'positive = institutional accumulation'));
  /* PVT (Price Volume Trend) */
  var pvt = (function(){ var o2 = 0; for (var k = 1; k < n; k++) o2 += ((C[k] - C[k - 1]) / C[k - 1]) * rows[k].v; return o2; })();
  push(R('pvt', G, 'Price Volume Trend (PVT)', 'vote', slopeVote([0, pvt], 0, 0), fmt(pvt, 0), 'positive = accumulation'));
  /* EMV / EOM (Ease of Movement) */
  var emv = (function(){ var o2 = nanArr(n); for (var k = 1; k < n; k++){ var dm = ((rows[k].h + rows[k].l) / 2) - ((rows[k - 1].h + rows[k - 1].l) / 2); var br = rows[k].v / (rows[k].h - rows[k].l || 1); o2[k] = dm / br; } return last(sma(fill0(o2), 14)); })();
  push(R('emv', G, 'Ease of Movement 14 (EMV)', 'vote', band(emv, 0, 0), fmt(emv, 4), 'positive = price moving easily upward'));
  /* STARC Bands */
  var starcU = last(S20) + 2 * a14, starcL = last(S20) - 2 * a14;
  push(R('starc', G, 'STARC Bands (SMA 20 ± 2×ATR)', 'vote', px > starcU ? 1 : px < starcL ? -1 : 0, fmt(starcL) + ' – ' + fmt(starcU), 'outside the band on that side'));
  /* Disparity Index */
  var disp = 100 * (px - last(S20)) / last(S20);
  push(R('disp', G, 'Disparity Index (vs SMA 20)', 'vote', band(disp, 1, -1), fmt(disp, 2) + '%', '>1% long · <−1% short'));
  /* Ehlers Roofing Filter */
  var roof = (function(){ var hp = nanArr(n), a2 = Math.cos(0.707 * 2 * Math.PI / 48); for (var k = 2; k < n; k++) hp[k] = (1 + a2) / 2 * (C[k] - 2 * C[k - 1] + C[k - 2]) + 2 * a2 * (isFinite(hp[k - 1]) ? hp[k - 1] : 0) - a2 * a2 * (isFinite(hp[k - 2]) ? hp[k - 2] : 0); return last(ehlersSuperSmoother(fill0(hp), 10)); })();
  push(R('roof', G, 'Ehlers Roofing Filter 48/10', 'vote', sgn(roof), fmt(roof, 2), 'positive = long'));
  /* Inverse Fisher Transform of RSI */
  var ift = (function(){ var v2 = 0.1 * (r14 - 50); v2 = Math.max(-3, Math.min(3, v2)); return (Math.exp(2 * v2) - 1) / (Math.exp(2 * v2) + 1); })();
  push(R('ift', G, 'Inverse Fisher Transform (RSI 14)', 'vote', band(ift, 0.5, -0.5), fmt(ift, 3), '>+0.5 long · <−0.5 short'));
  /* PFE (Polarized Fractal Efficiency) */
  var pfe = (function(){ var len = 10, dist2 = Math.sqrt(Math.pow(C[i] - C[i - len], 2) + len * len), path2 = 0; for (var j = 0; j < len; j++) path2 += Math.sqrt(1 + Math.pow(C[i - j] - C[i - j - 1], 2)); return path2 ? 100 * sgn(C[i] - C[i - len]) * dist2 / path2 : 0; })();
  push(R('pfe', G, 'Polarized Fractal Efficiency 10', 'regime', Math.abs(pfe) > 50 ? 1 : Math.abs(pfe) < 20 ? -1 : 0, fmt(pfe, 1), '|PFE|>50 = trending · |PFE|<20 = chop'));
  /* RAVI */
  var ravi = 100 * Math.abs(last(sma(C, 7)) - last(sma(C, 65))) / last(sma(C, 65));
  push(R('ravi', G, 'RAVI 7/65 (Range Action Verification)', 'regime', ravi > 3 ? 1 : ravi < 1 ? -1 : 0, fmt(ravi, 2) + '%', '>3% = trending · <1% = range'));
  /* Chande Kroll Stop */
  var ckStop = (function(){ var p2 = 10, q2 = 9, x2 = 1.5, A2 = atr(rows, p2), hs = nanArr(n), ls = nanArr(n); for (var k = p2 - 1; k < n; k++){ hs[k] = hhll(rows, p2, k, true) - x2 * A2[k]; ls[k] = hhll(rows, p2, k, false) + x2 * A2[k]; } var sU = nanArr(n), sD = nanArr(n); for (var k2 = p2 + q2 - 2; k2 < n; k2++){ var mx2 = -Infinity, mn2 = Infinity; for (var j = 0; j < q2; j++){ mx2 = Math.max(mx2, hs[k2 - j]); mn2 = Math.min(mn2, ls[k2 - j]); } sU[k2] = mx2; sD[k2] = mn2; } return { stop_long: last(sU), stop_short: last(sD) }; })();
  push(R('ckstop', G, 'Chande Kroll Stop 10,9,1.5', 'vote', px > ckStop.stop_long ? 1 : px < ckStop.stop_short ? -1 : 0, fmt(ckStop.stop_long) + ' / ' + fmt(ckStop.stop_short), 'above long stop = long'));
  /* Cyber Cycle (Ehlers) */
  var cyber = (function(){ var sm2 = ehlersSuperSmoother(C, 10), o2 = nanArr(n), a2 = 0.7; for (var k = 2; k < n; k++) o2[k] = (1 - 0.5 * a2) * (1 - 0.5 * a2) * ((isFinite(sm2[k]) ? sm2[k] : C[k]) - 2 * (isFinite(sm2[k - 1]) ? sm2[k - 1] : C[k - 1]) + (isFinite(sm2[k - 2]) ? sm2[k - 2] : C[k - 2])) + 2 * (1 - a2) * (isFinite(o2[k - 1]) ? o2[k - 1] : 0) - (1 - a2) * (1 - a2) * (isFinite(o2[k - 2]) ? o2[k - 2] : 0); return { v: last(o2), p: at(o2, 1) }; })();
  push(R('cyber', G, 'Ehlers Cyber Cycle', 'vote', (cyber.v > 0 && cyber.v > cyber.p) ? 1 : (cyber.v < 0 && cyber.v < cyber.p) ? -1 : 0, fmt(cyber.v, 4), 'rising above 0 = long'));
  /* Decycler Oscillator (Ehlers) */
  var decyc = (function(){ var hp2 = nanArr(n), a3 = Math.cos(0.707 * 2 * Math.PI / 125); for (var k = 2; k < n; k++) hp2[k] = (1 + a3) / 2 * (C[k] - C[k - 1]) + a3 * (isFinite(hp2[k - 1]) ? hp2[k - 1] : 0); return last(hp2); })();
  push(R('decycler', G, 'Ehlers Decycler Oscillator 125', 'vote', sgn(decyc), fmt(decyc, 2), 'positive noise = long'));
  /* Parkinson volatility */
  var parkV = (function(){ var s2 = 0; for (var j = 0; j < 20; j++) s2 += Math.pow(Math.log(rows[i - j].h / rows[i - j].l), 2); return Math.sqrt(s2 / (20 * 4 * Math.log(2))) * Math.sqrt(96 * 365) * 100; })();
  push(R('parkinson', G, 'Parkinson Volatility 20 (ann.)', 'regime', 0, fmt(parkV, 1) + '%', 'intraday-range volatility estimate; no side'));
  /* Garman-Klass volatility */
  var gkV = (function(){ var s2 = 0; for (var j = 0; j < 20; j++){ var r2 = rows[i - j]; s2 += 0.5 * Math.pow(Math.log(r2.h / r2.l), 2) - (2 * Math.log(2) - 1) * Math.pow(Math.log(r2.c / r2.o), 2); } return Math.sqrt(s2 / 20) * Math.sqrt(96 * 365) * 100; })();
  push(R('gk_vol', G, 'Garman-Klass Volatility 20 (ann.)', 'regime', 0, fmt(gkV, 1) + '%', 'OHLC volatility estimate; no side'));
  /* Homodyne Discriminator (Ehlers) — already have Hilbert, add discriminator read */
  push(R('homodyne', G, 'Ehlers Homodyne Discriminator', 'regime', isFinite(last(HT.period)) ? (last(HT.period) < 15 ? 1 : last(HT.period) > 30 ? -1 : 0) : 0, fmt(last(HT.period), 1) + ' bars', 'short dominant period = trending'));
  /* Ehlers Instantaneous Trendline */
  push(R('eit', G, 'Ehlers Instantaneous Trendline', 'print', 0, 'see MAMA/FAMA above', 'same Hilbert computation; already counted'));

  /* ───── TIER 20: EXTENDED N/A (from user's additional indicator list) ───── */
  G = 'EXTENDED N/A (institutional/exotic)';
  push(R('coinbase_prem', G, 'Coinbase Premium Index', 'n/a', 0, '—', 'needs cross-exchange price comparison — never faked'));
  push(R('kimchi_prem', G, 'Korean Premium (Kimchi) Index', 'n/a', 0, '—', 'needs Korean exchange data — never faked'));
  push(R('bn_cb_ratio', G, 'Binance-to-Coinbase Volume Ratio', 'n/a', 0, '—', 'needs cross-exchange volume — never faked'));
  push(R('yang_zhang', G, 'Yang-Zhang Historical Volatility', 'n/a', 0, '—', 'needs overnight gap data (CME futures) — never faked'));
  push(R('fft', G, 'Fast Fourier Transform Cycle Extraction', 'n/a', 0, '—', 'needs heavy FFT computation — never faked'));
  push(R('pnf', G, 'Point & Figure Breakout Targets', 'n/a', 0, '—', 'needs box size selection — never faked'));
  push(R('deeplob', G, 'DeepLOB Convolutional Order Book', 'n/a', 0, '—', 'needs trained CNN + L2 data — never faked'));
  push(R('shap_imb', G, 'SHAP-Weighted Microstructure Imbalance', 'n/a', 0, '—', 'needs ML model + L2 data — never faked'));
  push(R('stoikov', G, 'Stoikov Micro-Price', 'n/a', 0, '—', 'needs live L2 best bid/ask depth — never faked'));
  push(R('turtle', G, 'Turtle Trader Donchian (multi-week)', 'print', 0, 'see Donchian 20 above', 'same concept at longer horizon'));
  push(R('stmr', G, 'Short-Term Mean Reversion (BB)', 'print', 0, 'see Bollinger %B above', 'extreme BB deviation; already counted'));
  push(R('murrey', G, 'Murrey Math Lines', 'n/a', 0, '—', 'fractal geometry system; needs manual anchor — never faked'));
  push(R('woodies', G, 'Woodies CCI System', 'print', 0, 'see CCI above', 'CCI pattern system; CCI already counted'));
  push(R('ssd_roc', G, 'Stablecoin Supply Dominance ROC', 'n/a', 0, '—', 'needs stablecoin market cap series — never faked'));
  push(R('tri_cvd', G, 'Tripartite CVD Divergence', 'n/a', 0, '—', 'needs CVD + OI data — never faked'));
  push(R('gli', G, 'Global Liquidity Index (central banks)', 'n/a', 0, '—', 'needs macro central bank balance sheet data — never faked'));
  push(R('dxy_corr', G, 'DXY Inverse Correlation Bands', 'n/a', 0, '—', 'needs DXY price series — never faked'));
  push(R('stable_depeg', G, 'Stablecoin Depeg / Deviation Gauges', 'n/a', 0, '—', 'needs Curve pool data — never faked'));
  push(R('harmonic', G, 'Harmonic Pattern Auto-Recognition', 'n/a', 0, '—', 'needs Fibonacci ratio scanning engine — never faked'));
  push(R('wolfe', G, 'Wolfe Wave Projectors', 'n/a', 0, '—', 'needs 5-wave geometry detection — never faked'));
  push(R('td_combo', G, 'DeMark TD Combo / TD D-Wave', 'print', 0, 'see TD Sequential above', 'extensions of TD Sequential; base read already counted'));
  push(R('tft', G, 'Trade Flow Toxicity (TFT)', 'n/a', 0, '—', 'needs tick-level taker flow data — never faked'));
  push(R('c2f_ratio', G, 'Cancel-to-Fill Ratio (Spoofing Index)', 'n/a', 0, '—', 'needs L2 order lifecycle data — never faked'));
  push(R('trade_asym', G, 'Trade Size Asymmetry Index', 'n/a', 0, '—', 'needs trade-size segmented data — never faked'));
  push(R('tri_arb', G, 'Triangular Arbitrage Discrepancy', 'n/a', 0, '—', 'needs cross-pair order book data — never faked'));
  push(R('lat_heat', G, 'Cross-Exchange Latency Heatmaps', 'n/a', 0, '—', 'needs multi-exchange tick data — never faked'));
  push(R('perp_basis_mom', G, 'Perpetual Basis Momentum', 'n/a', 0, '—', 'needs futures premium time series — never faked'));
  push(R('donch_squeeze', G, 'Donchian Squeeze (Donchian inside ATR)', 'regime', (dh - dl) < 2 * a14 ? -1 : 0, (dh - dl < 2 * a14) ? 'SQUEEZED' : 'off', 'Donchian channel narrower than ATR envelope = coiled'));
  push(R('eqvol', G, 'Equivolume Charting', 'print', 0, 'see BW MFI above', 'volume-width candles; facilitation index captures the concept'));
  push(R('ha_v2', G, 'Heikin-Ashi Smoothed V2', 'print', 0, 'see Smoothed HA above', 'DEMA HA; already counted'));
  push(R('schiff', G, 'Modified Schiff Pitchfork', 'n/a', 0, '—', 'needs user-defined pivot anchors — never faked'));
  push(R('johansen', G, 'Johansen Cointegration (multi-asset)', 'n/a', 0, '—', 'needs multi-asset series — never faked'));
  push(R('vecm', G, 'Vector Error Correction Model', 'n/a', 0, '—', 'needs cointegrated pair data — never faked'));
  push(R('msar', G, 'Markov-Switching Autoregression', 'n/a', 0, '—', 'needs regime estimation model — never faked'));
  push(R('amihud', G, 'Amihud Illiquidity Ratio', 'n/a', 0, '—', 'needs tick-level volume data — never faked'));
  push(R('roll_spread', G, 'Roll\'s Effective Spread Estimator', 'n/a', 0, '—', 'needs serial covariance of tick prices — never faked'));
  push(R('corwin', G, 'Corwin-Schultz High-Low Spread', 'n/a', 0, '—', 'needs consecutive daily H/L — never faked'));
  push(R('burlaga', G, 'Burlaga-Klein Fractal Dimension', 'print', 0, 'see FDI above', 'same concept as Fractal Dimension Index'));
  push(R('eip1559', G, 'EIP-1559 Base Fee Velocity (ETH)', 'n/a', 0, '—', 'needs Ethereum gas data — never faked'));
  push(R('val_churn', G, 'Validator Churn / Unstaking Queue', 'n/a', 0, '—', 'needs PoS validator data — never faked'));
  push(R('sec', G, 'Seller Exhaustion Constant', 'n/a', 0, '—', 'needs UTXO supply-in-profit data — never faked'));
  push(R('rpl', G, 'Realized Cap vs Liveliness', 'n/a', 0, '—', 'needs on-chain realized cap — never faked'));
  push(R('whale_minnow', G, 'Whale to Minnow Divergence', 'n/a', 0, '—', 'needs wallet-size segmented flow — never faked'));
  push(R('ift_cci', G, 'Inverse Fisher Transform (CCI)', 'print', 0, 'see IFT(RSI) above', 'same transform on CCI; one IFT read counted'));
  push(R('autocorr', G, 'Autocorrelation Periodogram (Ehlers)', 'n/a', 0, '—', 'needs iterative periodogram computation — never faked'));
  push(R('twap_dev', G, 'TWAP/VWAP Algorithmic Deviation', 'n/a', 0, '—', 'needs institutional execution trace — never faked'));
  push(R('ice_replen', G, 'Iceberg Replenishment Rate', 'n/a', 0, '—', 'needs millisecond L2 tape — never faked'));
  push(R('liq_cascade', G, 'Liquidation Cascade Trigger Zones', 'n/a', 0, '—', 'needs leveraged position mapping — never faked'));
  push(R('p_f_ratio', G, 'Protocol Revenue to FDV Ratio', 'n/a', 0, '—', 'needs DeFi protocol revenue data — never faked'));
  push(R('vest_dilute', G, 'Vesting Dilution Gauge', 'n/a', 0, '—', 'needs token emission schedule — never faked'));
  push(R('stake_prem', G, 'Staking Yield Premium Divergence', 'n/a', 0, '—', 'needs staking APY data — never faked'));
  push(R('opt_pin', G, 'Option Pinning Gravity (Max Pain)', 'n/a', 0, '—', 'needs options OI by strike — never faked'));
  push(R('call_put_skew', G, 'Call/Put Skew Delta (25-delta)', 'n/a', 0, '—', 'needs OTM options IV — never faked'));
  push(R('liq_oi_ratio', G, 'Liquidations to OI Ratio', 'n/a', 0, '—', 'needs liquidation + OI data — never faked'));
  push(R('kase_bars', G, 'Kase Information Bars', 'n/a', 0, '—', 'needs TR-adaptive bar construction — never faked'));
  push(R('jurik', G, 'Jurik Volatility Bands', 'n/a', 0, '—', 'needs proprietary Jurik algorithm — never faked'));
  push(R('lrt_slash', G, 'LRT Slashing Risk Premium', 'n/a', 0, '—', 'needs restaking token data — never faked'));
  push(R('yield_fwd', G, 'Zero-Coupon Yield Forward (Pendle)', 'n/a', 0, '—', 'needs DeFi yield token data — never faked'));
  push(R('lst_peg', G, 'LST Peg Discount Matrix', 'n/a', 0, '—', 'needs staked asset peg data — never faked'));
  push(R('solver_spread', G, 'Solver Execution Spread (CowSwap)', 'n/a', 0, '—', 'needs intent-based execution data — never faked'));
  push(R('userop', G, 'UserOp Mempool Heatmap (ERC-4337)', 'n/a', 0, '—', 'needs account abstraction mempool — never faked'));
  push(R('jit_sat', G, 'JIT Liquidity Saturation', 'n/a', 0, '—', 'needs AMM tick-level data — never faked'));
  push(R('rwa_yield', G, 'Tokenized Treasury RWA Yield Divergence', 'n/a', 0, '—', 'needs RWA protocol data — never faked'));
  push(R('reg_stable', G, 'Regulated Stablecoin Dominance Index', 'n/a', 0, '—', 'needs stablecoin issuance data — never faked'));
  push(R('seq_batch', G, 'Sequencer Batch Imbalance (L2)', 'n/a', 0, '—', 'needs L2 sequencer data — never faked'));
  push(R('blob_gas', G, 'Blob Space Gas Saturation (EIP-4844)', 'n/a', 0, '—', 'needs Ethereum blob fee market — never faked'));
  push(R('l2_finality', G, 'L2-to-L1 Finality Arbitrage Window', 'n/a', 0, '—', 'needs L2 sequencer latency — never faked'));
  push(R('ai_wallet', G, 'AI Agent Wallet Velocity', 'n/a', 0, '—', 'needs AI agent wallet clustering — never faked'));
  push(R('compute_token', G, 'Compute-to-Token Price Ratio (DePIN)', 'n/a', 0, '—', 'needs GPU compute pricing — never faked'));
  push(R('consensus_q', G, 'Consensus-Level Queue Priority (Hyperliquid)', 'n/a', 0, '—', 'needs DEX perp consensus data — never faked'));
  push(R('iso_liq', G, 'Isolated Liquidation Cluster Gravity', 'n/a', 0, '—', 'needs on-chain perp position data — never faked'));
  push(R('fund_crowd', G, 'Funding Crowding Oscillator', 'n/a', 0, '—', 'needs funding + OI normalized data — never faked'));
  push(R('v_dvol', G, 'Volatility of Volatility (V-Dvol)', 'n/a', 0, '—', 'needs Dvol options data — never faked'));
  push(R('impl_corr', G, 'Implied Correlation Surface', 'n/a', 0, '—', 'needs multi-asset options data — never faked'));
  push(R('consol_heat', G, 'Cross-Exchange Heatmap Absorption', 'n/a', 0, '—', 'needs multi-venue L2 data — never faked'));
  push(R('liq_vacuum', G, 'Consolidated Liquidity Vacuum Index', 'n/a', 0, '—', 'needs multi-exchange depth — never faked'));
  push(R('synth_spread', G, 'Synthetic Bid-Ask Spread (cross-venue)', 'n/a', 0, '—', 'needs multi-exchange tick data — never faked'));
  push(R('zk_cost', G, 'ZK-Prover Compute Cost Oscillator', 'n/a', 0, '—', 'needs ZK network economics — never faked'));
  push(R('based_mev', G, 'Based Sequencing MEV Flow', 'n/a', 0, '—', 'needs L1 validator MEV data — never faked'));
  push(R('state_root', G, 'L2 State Root Finality Delay', 'n/a', 0, '—', 'needs rollup state root timing — never faked'));
  push(R('t2q', G, 'Trade-to-Quote Cancellation Ratio', 'n/a', 0, '—', 'needs L2 order lifecycle — never faked'));
  push(R('ice_recon', G, 'Sub-Millisecond Iceberg Reconstruction', 'n/a', 0, '—', 'needs tick-level tape reconstruction — never faked'));
  push(R('asr', G, 'Adverse Selection Risk Matrix', 'n/a', 0, '—', 'needs MM fill/adverse data — never faked'));
  push(R('tick_density', G, 'Concentrated Liquidity Tick Density', 'n/a', 0, '—', 'needs Uniswap V3/V4 tick data — never faked'));
  push(R('spatial_cluster', G, 'Spatial Point-Cloud Clustering', 'n/a', 0, '—', 'needs multi-dimensional ML clustering — never faked'));
  push(R('dtw_analog', G, 'Dynamic Time Warping Analog Search', 'n/a', 0, '—', 'needs historical pattern library — never faked'));
  push(R('rf_matrix', G, 'Random Forest Classifier Matrix', 'n/a', 0, '—', 'needs trained ML ensemble — never faked'));
  push(R('wfo', G, 'Walk-Forward Optimization Bands', 'n/a', 0, '—', 'needs iterative re-optimization engine — never faked'));
  push(R('xsect_mom', G, 'Cross-Sectional Momentum (Factor)', 'n/a', 0, '—', 'needs multi-asset universe — never faked'));
  push(R('tape_vel2', G, 'Tape Speed & Imbalance Velocity', 'n/a', 0, '—', 'needs millisecond trade stream — never faked'));
  push(R('twap_slicer', G, 'TWAP/VWAP Slicer Deviation', 'n/a', 0, '—', 'needs institutional slice detection — never faked'));
  push(R('halving', G, 'Halving Supply Shock / Issuance Decay', 'n/a', 0, '—', 'needs block reward schedule + M2 — never faked'));
  push(R('gov_vote', G, 'Governance Vote Alpha Scanners', 'n/a', 0, '—', 'needs DAO governance data — never faked'));
  push(R('xasset_vol', G, 'Cross-Asset Volatility Premium (BTC/ETH)', 'n/a', 0, '—', 'needs multi-asset options IV — never faked'));
  push(R('poc_migrate', G, 'POC Migration Tracker', 'n/a', 0, '—', 'needs tick-level volume profile — never faked'));
  push(R('cvd_swing', G, 'CVD Divergence at Swing Highs', 'n/a', 0, '—', 'needs cumulative volume delta — never faked'));
  push(R('absorb', G, 'Absorption Indicators', 'n/a', 0, '—', 'needs tick-level tape reading — never faked'));
  push(R('range_bars', G, 'Range Bars (ATR-Linked)', 'n/a', 0, '—', 'needs non-time-based bar construction — never faked'));
  push(R('fund_vel', G, 'Funding Rate Velocity (Delta)', 'n/a', 0, '—', 'needs funding rate time series — never faked'));
  push(R('ret_inst_div', G, 'Retail vs Institutional Volume Divergence', 'n/a', 0, '—', 'needs trade-size segmented volume — never faked'));
  push(R('ex_flow', G, 'Exchange Token Flow (Inflow/Outflow)', 'n/a', 0, '—', 'needs exchange wallet tracking — never faked'));
  push(R('pagerank', G, 'Wallet PageRank (EigenTrust)', 'n/a', 0, '—', 'needs blockchain graph analysis — never faked'));
  push(R('nvts', G, 'NVT Signal (NVTS, smoothed)', 'n/a', 0, '—', 'needs on-chain tx volume — never faked'));
  push(R('miner_flow', G, 'Miner Flow to Exchanges', 'n/a', 0, '—', 'needs miner wallet tracking — never faked'));
  push(R('vrp', G, 'Volatility Risk Premium (IV-RV)', 'n/a', 0, '—', 'needs options IV data — never faked'));
  push(R('iv_term', G, 'IV Term Structure (inversion)', 'n/a', 0, '—', 'needs multi-tenor options IV — never faked'));
  push(R('delta_neutral', G, 'Delta-Neutral Yield Arbitrage', 'n/a', 0, '—', 'needs futures premium data — never faked'));
  push(R('lyapunov', G, 'Lyapunov Exponent (chaos theory)', 'n/a', 0, '—', 'needs heavy iterative computation — never faked'));
  push(R('gann_fan', G, 'Gann Fan / Time-Price Squaring', 'n/a', 0, '—', 'needs geometric projection engine — never faked'));
  push(R('dmd', G, 'Dynamic Mode Decomposition', 'n/a', 0, '—', 'needs multi-dimensional decomposition — never faked'));
  push(R('tda', G, 'Topological Data Analysis (TDA)', 'n/a', 0, '—', 'needs persistent homology computation — never faked'));
  push(R('esn', G, 'Echo State Networks (Reservoir Computing)', 'n/a', 0, '—', 'needs trained RNN model — never faked'));
  push(R('whale_cluster', G, 'Whale Cluster Net Flow Heuristics', 'n/a', 0, '—', 'needs ML entity clustering — never faked'));
  push(R('cdd_zscore', G, 'CDD Z-Score (normalized dormancy)', 'n/a', 0, '—', 'needs UTXO coin-days data — never faked'));
  push(R('dealer_gamma', G, 'Net Dealer Gamma Squeeze Index', 'n/a', 0, '—', 'needs options positioning data — never faked'));
  push(R('var_swap', G, 'Realized Variance Strikes (Var Swaps)', 'n/a', 0, '—', 'needs variance swap market — never faked'));
  push(R('speed', G, 'Speed (Gamma of Gamma)', 'n/a', 0, '—', 'needs options third-order greeks — never faked'));
  push(R('color', G, 'Color (Gamma Decay)', 'n/a', 0, '—', 'needs options gamma/theta model — never faked'));
  push(R('zomma', G, 'Zomma (Gamma of Vega)', 'n/a', 0, '—', 'needs options second-order greeks — never faked'));
  push(R('asi', G, 'Adverse Selection Indicator (ASI)', 'n/a', 0, '—', 'needs MM adverse flow data — never faked'));
  push(R('oiir', G, 'Order Imbalance Information Ratio', 'n/a', 0, '—', 'needs microstructure imbalance data — never faked'));
  push(R('inv_risk', G, 'Inventory Risk Skew (MM)', 'n/a', 0, '—', 'needs market maker inventory — never faked'));
  push(R('impl_short', G, 'Implementation Shortfall (IS)', 'n/a', 0, '—', 'needs execution vs decision price — never faked'));
  push(R('vpr', G, 'Volume Participation Rate (VPR)', 'n/a', 0, '—', 'needs algo execution tracking — never faked'));
  push(R('benford', G, 'Benford\'s Law Order Book Anomaly', 'n/a', 0, '—', 'needs L2 limit order digit analysis — never faked'));
  push(R('mev_sand', G, 'MEV Sandwich Attack Detectors', 'n/a', 0, '—', 'needs mempool analysis — never faked'));
  push(R('xvenue_liq', G, 'Cross-Venue Liquidity Imbalance', 'n/a', 0, '—', 'needs multi-exchange L2 — never faked'));
  push(R('l2_seq_arb', G, 'L2 Sequencer Latency Arbitrage', 'n/a', 0, '—', 'needs L2 sequencer timing — never faked'));
  push(R('swing_vwap', G, 'Dynamic Swing-Anchored VWAP (v6)', 'n/a', 0, '—', 'needs structural break detection — never faked'));
  push(R('mtf_frac', G, 'Multi-TF Fractal Crossover Matrix', 'n/a', 0, '—', 'needs multi-timeframe array matrix — never faked'));
  push(R('xfund_mr', G, 'Cross-Exchange Funding Mean Reversion', 'n/a', 0, '—', 'needs multi-exchange funding rates — never faked'));
  push(R('obi_fund', G, 'OBI-to-Funding Predictor', 'n/a', 0, '—', 'needs L2 depth + funding — never faked'));
  push(R('multi_leg', G, 'Multi-Leg Options Basis Hedger', 'n/a', 0, '—', 'needs options + futures market — never faked'));
  push(R('lending_util', G, 'Lending Protocol Utilization Divergence', 'n/a', 0, '—', 'needs DeFi lending data — never faked'));
  push(R('cdp_liq', G, 'Underwater Liquidation Proximity Matrix', 'n/a', 0, '—', 'needs DeFi CDP health data — never faked'));
  push(R('hvi', G, 'Hidden Volume Imbalance (OTC)', 'n/a', 0, '—', 'needs OTC settlement tracking — never faked'));
  push(R('custodial', G, 'Custodial Velocity Matrix', 'n/a', 0, '—', 'needs cold storage flow tracking — never faked'));
  push(R('off_ex', G, 'Off-Exchange Print Locator', 'n/a', 0, '—', 'needs delayed block print feeds — never faked'));
  push(R('mev_bribe', G, 'MEV Bribe Dominance (Jito/Flashbots)', 'n/a', 0, '—', 'needs MEV auction data — never faked'));
  push(R('bonding', G, 'Bonding Curve Saturation Index', 'n/a', 0, '—', 'needs launchpad contract state — never faked'));
  push(R('sybil', G, 'Smart Contract Creator Wallet Graph', 'n/a', 0, '—', 'needs on-chain graph analysis — never faked'));
  push(R('betti', G, 'Persistent Homology Betti Numbers', 'n/a', 0, '—', 'needs algebraic topology computation — never faked'));
  push(R('wav_coher', G, 'Wavelet Coherence Overlay', 'n/a', 0, '—', 'needs wavelet cross-spectrum — never faked'));
  push(R('copula', G, 'Copula Dependency Modeling', 'n/a', 0, '—', 'needs multi-asset dependency estimation — never faked'));
  push(R('xcoll', G, 'Cross-Collateralization Stress Index', 'n/a', 0, '—', 'needs altcoin collateral mapping — never faked'));
  push(R('slr', G, 'Synthetic Leverage Ratio (SLR)', 'n/a', 0, '—', 'needs OI + stablecoin reserves — never faked'));
  push(R('fund_term', G, 'Perpetual Funding Term Structure', 'n/a', 0, '—', 'needs multi-window funding — never faked'));
  push(R('vwsr', G, 'Volume-Weighted Support/Resistance Matrix', 'n/a', 0, '—', 'needs tick-level volume at price — never faked'));
  push(R('dex_cex_ratio', G, 'DEX-to-CEX Volume Ratio', 'n/a', 0, '—', 'needs DEX + CEX volume — never faked'));
  push(R('token_unlock', G, 'Token Unlock / Vesting Cliff Detectors', 'n/a', 0, '—', 'needs vesting schedule data — never faked'));
  push(R('social_dom', G, 'Social Dominance Divergence', 'n/a', 0, '—', 'needs social media analytics — never faked'));
  push(R('github_dev', G, 'GitHub Commit / Developer Activity', 'n/a', 0, '—', 'needs GitHub API data — never faked'));
  push(R('nlp_sent', G, 'NLP Sentiment Scoring (Fear/Greed Vectors)', 'n/a', 0, '—', 'needs NLP sentiment pipeline — never faked'));
  push(R('ai_vision', G, 'AI Vision-to-Code Frameworks', 'n/a', 0, '—', 'needs AI model + Pine Script engine — never faked'));
  push(R('avg_order', G, 'Average Order Size Oscillator', 'n/a', 0, '—', 'needs trade count data — never faked'));
  push(R('lt_taker_cvd', G, 'Long-Term Taker CVD (3-month)', 'n/a', 0, '—', 'needs taker buy/sell classification — never faked'));
  push(R('bubble_viz', G, 'Market Phase Bubble Visualizers', 'n/a', 0, '—', 'needs multi-dimensional visualization — never faked'));
  push(R('m2_osc', G, 'Global M2 Money Supply Oscillator', 'n/a', 0, '—', 'needs central bank M2 data — never faked'));
  push(R('fed_yc', G, 'Fed Funds Rate / Yield Curve Overlays', 'n/a', 0, '—', 'needs sovereign bond yield data — never faked'));
  push(R('schrodinger', G, 'Schrödinger Price Bands (quantum)', 'n/a', 0, '—', 'needs quantum harmonic oscillator model — never faked'));
  push(R('brownian', G, 'Brownian Bridge Drift Estimator', 'n/a', 0, '—', 'needs stochastic bridge calibration — never faked'));
  push(R('ob_entropy', G, 'Order Book Entropy (Boltzmann)', 'n/a', 0, '—', 'needs live L2 entropy computation — never faked'));
  push(R('vws', G, 'Volume-Weighted Spread (VWS)', 'n/a', 0, '—', 'needs L2 volume-at-depth — never faked'));
  push(R('mbo', G, 'L3 Market-by-Order Queue Tracker', 'n/a', 0, '—', 'needs L3 order queue data — never faked'));
  push(R('ob_elastic', G, 'Order Book Elasticity (Resiliency)', 'n/a', 0, '—', 'needs millisecond L2 regeneration — never faked'));
  push(R('frr', G, 'Fee-to-Reward Ratio (miners)', 'n/a', 0, '—', 'needs miner fee vs subsidy data — never faked'));
  push(R('soab', G, 'Spent Output Age Bands', 'n/a', 0, '—', 'needs UTXO age distribution — never faked'));
  push(R('terminal', G, 'Terminal Price / Balanced Price', 'n/a', 0, '—', 'needs on-chain valuation model — never faked'));
  push(R('vol_explode', G, 'Volume Explosion Detector', 'regime', curV > 2 * rvA ? 1 : 0, curV > 2 * rvA ? 'EXPLOSION' : 'normal', '>2× avg volume = genuine breakout'));
  push(R('mom_pulse', G, 'Momentum Pulse (Fast/Slow Diff)', 'print', 0, 'see MACD above', 'fast-slow MA differential; same as MACD concept'));
  push(R('rsi_ema_filt', G, 'RSI + EMA Trend Filter', 'print', 0, 'see RSI + EMA 200 reads', 'composite filter; both components already counted'));
  push(R('strangle', G, 'All-in-One Straddle/Strangle Signals', 'n/a', 0, '—', 'needs options premium data — never faked'));
  push(R('true_mean', G, 'True Market Mean (on-chain)', 'n/a', 0, '—', 'needs adjusted realized price — never faked'));
  push(R('sth_mvrv', G, 'STH-MVRV (short-term holder)', 'n/a', 0, '—', 'needs STH realized price — never faked'));
  push(R('rplr', G, 'Realized Price-to-Liveliness Ratio', 'n/a', 0, '—', 'needs on-chain liveliness — never faked'));
  push(R('nvt_cross', G, 'NVT Golden Cross', 'n/a', 0, '—', 'needs NVT oscillator data — never faked'));
  push(R('basis_arb', G, 'Spot-Futures Basis (Contango/Backwrd)', 'n/a', 0, '—', 'needs futures premium data — never faked'));
  push(R('vol_smile', G, 'Volatility Smile / Skew Matrix', 'n/a', 0, '—', 'needs full options chain IV — never faked'));
  push(R('fund_zscore', G, 'Funding Rate Z-Score', 'n/a', 0, '—', 'needs funding rate history — never faked'));
  push(R('tvl_mom', G, 'TVL Momentum Oscillator (DeFi)', 'n/a', 0, '—', 'needs protocol TVL data — never faked'));
  push(R('predict_mkt', G, 'Prediction Market Probability Index', 'n/a', 0, '—', 'needs Polymarket/Kalshi API — never faked'));
  push(R('adr_expand', G, 'ADR Expansion (session)', 'regime', isFinite(todayR) && isFinite(adrv) && todayR > 1.5 * adrv ? -1 : 0, isFinite(todayR) ? fmt(100 * todayR / adrv, 0) + '% of ADR' : '—', '>150% of ADR = overextended'));
  push(R('hl_perp', G, 'Hyperliquid / GMX On-Chain Perps OI', 'n/a', 0, '—', 'needs DEX perp open interest — never faked'));
  push(R('lp_vault', G, 'LP Vault Health (GLP/HLP Utilization)', 'n/a', 0, '—', 'needs decentralized vault data — never faked'));
  push(R('llm_gen', G, 'LLM-Assisted Indicator Generators', 'n/a', 0, '—', 'meta-tooling, not an indicator'));
  push(R('bt_deep', G, 'Backtest Deep Report Matrices', 'n/a', 0, '—', 'meta-tooling, not a signal'));
  push(R('dark_pool', G, 'Unusual Options Activity & Dark Pool', 'n/a', 0, '—', 'needs off-exchange block data — never faked'));
  push(R('mahal', G, 'Mahalanobis Distance (anomaly)', 'n/a', 0, '—', 'needs multi-dimensional distance — never faked'));
  push(R('frechet', G, 'Fréchet Distance Pattern Matching', 'n/a', 0, '—', 'needs historical pattern database — never faked'));
  push(R('active_entity', G, 'Active Entity Momentum (on-chain)', 'n/a', 0, '—', 'needs on-chain entity counting — never faked'));
  push(R('spent_tier', G, 'Spent Volume by Transaction Tier', 'n/a', 0, '—', 'needs tx-size segmented volume — never faked'));
  push(R('cex_nsr', G, 'CEX Net Stablecoin Reserve Ratio', 'n/a', 0, '—', 'needs exchange stablecoin reserves — never faked'));
  push(R('ex_inflow_mean', G, 'Exchange Inflow/Outflow Mean', 'n/a', 0, '—', 'needs exchange wallet tracking — never faked'));
  push(R('mkt_liq_idx', G, 'Market Liquidity & Slippage Indices', 'n/a', 0, '—', 'needs enterprise liquidity feeds — never faked'));
  push(R('asic', G, 'ASIC Profitability Bounds', 'n/a', 0, '—', 'needs mining economics data — never faked'));
  push(R('kyle_inv', G, 'Kyle\'s Invariance (toxicity)', 'n/a', 0, '—', 'needs market impact model — never faked'));
  push(R('hasbrouck', G, 'Hasbrouck Information Share', 'n/a', 0, '—', 'needs multi-exchange variance decomposition — never faked'));
  push(R('qtr', G, 'Quote-to-Trade Ratio (cancellation)', 'n/a', 0, '—', 'needs L2 order lifecycle — never faked'));
  push(R('basv', G, 'Bid-Ask Spread Variance', 'n/a', 0, '—', 'needs tick-level spread data — never faked'));
  push(R('hawkes2', G, 'Hawkes Processes for Trade Arrivals', 'n/a', 0, '—', 'needs tick timestamps — never faked'));
  push(R('hmm2', G, 'HMM Regime Detection (probabilistic)', 'n/a', 0, '—', 'needs trained probabilistic model — never faked'));
  push(R('ofi2', G, 'Tick-Level Order Flow Imbalance', 'n/a', 0, '—', 'needs BBO tick data — never faked'));
  push(R('vpin2', G, 'VPIN (Volume-Sync Informed Trading)', 'n/a', 0, '—', 'needs tick-level classification — never faked'));
  push(R('liveliness', G, 'Bitcoin Liveliness (on-chain)', 'n/a', 0, '—', 'needs CDD accumulation data — never faked'));
  push(R('chand_dmi', G, 'Chande Dynamic Momentum Index', 'print', 0, 'see CMO + RSI above', 'adaptive RSI using CMO; both already counted'));

  /* ───── participation/regime summary ───── */
  var regime = regimeSummaryVote(out) < 0 ? 'chop' : 'trend';
  var chopN = countRegime(out, -1), trendN = countRegime(out, 1);
  var part = { name: 'regime', read: regime.toUpperCase(), note: chopN + ' chop / ' + trendN + ' trend' };

  return { votes: out, price: px, atr: a14, participation: part, regime: regime,
           regimeCounts: { chop: chopN, trend: trendN },
           bar: { t: rows[i].t, o: rows[i].o, h: rows[i].h, l: rows[i].l, c: rows[i].c } };
}

/* =========================== engine =========================== */
function closedRows(rows, ivSec, nowMs){ if (!rows || !rows.length) return []; var cutoff = (nowMs / 1000) - ivSec; var out2 = []; for (var i = 0; i < rows.length; i++){ if (rows[i].t + ivSec <= cutoff + ivSec) out2.push(rows[i]); } return out2.length < rows.length ? out2 : rows.slice(0, -1); }

function cryptoUltraEngine(inp){
  var nowMs = inp.now || Date.now(), rule = inp.rule || RULE;
  var rows = closedRows(inp.rows15m, 900, nowMs);
  var r1h = inp.rows1h ? closedRows(inp.rows1h, 3600, nowMs) : [];
  var out = { ok: false, fire: false, dir: null, reasons: [], gates: [], line: '', count: null, regime: null, plan: null, recordOnly: false };
  if (rows.length < MIN_15M){ out.reasons.push('need ' + MIN_15M + ' closed 15m bars, have ' + rows.length); return out; }
  var res = cryptoUltraVotes(rows, r1h);
  var L = 0, S = 0, N = 0, kV = 0, kR = 0, kP = 0, kN = 0;
  for (var j = 0; j < res.votes.length; j++){
    var v = res.votes[j];
    if (v.kind === 'vote'){ kV++; if (v.vote > 0) L++; else if (v.vote < 0) S++; else N++; }
    else if (v.kind === 'regime') kR++;
    else if (v.kind === 'print') kP++;
    else if (v.kind === 'n/a') kN++;
  }
  var A = L + S, lead = L >= S ? 'long' : 'short', agree = L >= S ? L : S;
  var pctV = A ? agree / A : 0;
  out.count = { L: L, S: S, N: N, total: res.votes.length, decisive: A, agree: agree, pct: pctV, pctRaw: pctV, lead: lead, long: L, short: S, kinds: { vote: kV, regime: kR, print: kP, na: kN } };
  out.regime = res.regime; out.regimeCounts = res.regimeCounts;
  out.votes = res.votes; out.price = res.price; out.atr = res.atr; out.bar = res.bar;
  out.ok = true;
  out.line = agree + ' of ' + A + ' decisive reads agree ' + lead.toUpperCase() + ' (' + Math.round(100 * pctV) + '%) · ' + N + ' neutral · regime ' + res.regime.toUpperCase();

  if (A < rule.minAvail){ out.gates.push('fewer than ' + rule.minAvail + ' decisive (' + A + ')'); }
  if (pctV < rule.minPct){ out.gates.push('agreement ' + Math.round(100 * pctV) + '% < ' + Math.round(100 * rule.minPct) + '%'); }
  if (rule.regimeGate && res.regime === 'chop'){ out.gates.push('regime gate: ' + res.regimeCounts.chop + ' reads say CHOP'); }
  if (!isFinite(res.atr) || res.atr <= 0){ out.gates.push('ATR unreadable'); }

  if (out.gates.length){ return out; }
  out.dir = lead;

  /* evidence gate */
  var ev = HG_CRYPTO_ULTRA_EVIDENCE;
  if (!ev.measured){ out.recordOnly = true; out.gates.push('NOT YET MEASURED'); }
  else if (ev.tradable === false){ out.recordOnly = true; out.gates.push('MEASURED NOT TRADABLE'); }

  if (!out.recordOnly) out.fire = true;

  /* price the plan */
  var vc = inp.venueCost, costFrac = vc ? vc.rtFrac : NaN;
  var rawStop = rule.stopAtr * res.atr;
  var costFloor = isFinite(costFrac) ? res.price * costFrac * rule.costFloorMult : 0;
  var stopDist = Math.max(rawStop, costFloor);
  var floorNote = costFloor > rawStop ? 'stop widened from ' + fmt(rawStop) + ' to ' + fmt(stopDist) + ' (' + rule.costFloorMult + '× the ' + ((vc && vc.venue) || 'venue') + ' round-trip ' + pct(costFrac) + ')' : '';
  var entry = res.price;
  var dir2 = out.dir === 'long' ? 1 : -1;
  var stop = entry - dir2 * stopDist;
  var risk = Math.abs(entry - stop);
  var t1 = entry + dir2 * risk * rule.t1R;
  var t2 = entry + dir2 * risk * rule.t2R;
  out.plan = { dir: out.dir, orderType: out.dir === 'long' ? 'BUY' : 'SELL', entry: entry, stop: stop, stopAtr: stopDist / res.atr, t1: t1, t2: t2, rr1: rule.t1R, rr2: rule.t2R, timeoutBars: rule.timeoutBars, risk: risk, floorNote: floorNote };

  return out;
}

/* =========================== UI =========================== */
function evidenceHTML(){
  var ev = HG_CRYPTO_ULTRA_EVIDENCE;
  if (!ev.measured) return '<div class="cu-ev"><b>VERIFIED</b><br>' + esc(ev.note) + '</div>';
  return '<div class="cu-ev"><b>VERIFIED — CRYPTO ULTRA (BTCUSDT 15m)</b><br>'
    + 'Symbol: ' + esc(ev.symbol) + ' · bars: ' + (ev.bars || '—') + ' · interval: ' + (ev.interval || '15m')
    + '<br>Rule: ≥' + RULE.minAvail + ' decisive · ' + Math.round(RULE.minPct * 100) + '% agree' + (RULE.regimeGate ? ' · regime gate ON' : '')
    + '<br>In-sample: ' + fmtR(ev.isAvgR) + '/trade · n=' + (ev.isN || '—') + ' · win ' + pct(ev.isWin)
    + '<br>Out-of-sample: ' + fmtR(ev.oosAvgR) + '/trade · n=' + (ev.oosN || '—') + ' · win ' + pct(ev.oosWin)
    + (ev.tradable ? '' : '<br><b>MEASURED NOT TRADABLE</b>')
    + '<br><small>Rule chosen on the first 70%, reported on the untouched last 30%.</small>'
    + '</div>';
}

var CU_CSS = ''
  + '.cu-count{padding:10px;border:1px solid #CBD5E1;border-radius:8px;margin:8px 0;line-height:1.7}'
  + '.cu-count.long{border-color:rgba(22,163,74,.5);background:rgba(22,163,74,.04)}'
  + '.cu-count.short{border-color:rgba(220,38,38,.5);background:rgba(220,38,38,.04)}'
  + '.cu-count small{display:block;font-size:10px;color:#64748B;margin-top:4px;line-height:1.5}'
  + '.cu-rule{font-size:11px;line-height:1.7;color:#475569;padding:8px 10px;border:1px dashed #CBD5E1;border-radius:6px;margin-bottom:8px}'
  + '.cu-plan{font-size:11px;line-height:1.7;color:#1E293B;padding:8px 10px;border:1px solid rgba(147,130,34,.5);border-radius:6px;background:rgba(250,240,137,.12);margin:8px 0}'
  + '.cu-gate{font-size:10px;color:#DC2626;padding:8px 10px;border:1px solid rgba(220,38,38,.35);border-radius:6px;margin:8px 0;background:rgba(220,38,38,.04)}'
  + '.cu-ev{font-size:11px;line-height:1.6;color:#475569;padding:10px;border:1px dashed rgba(71,85,105,.4);border-radius:6px;margin:10px 0;background:rgba(241,245,249,.7)}'
  + '.cu-tbl{width:100%;border-collapse:collapse;font-size:10px;margin:10px 0}'
  + '.cu-tbl th{text-align:left;padding:3px 6px;border-bottom:2px solid #CBD5E1;font-weight:700;letter-spacing:.06em;color:#334155}'
  + '.cu-tbl td{padding:3px 6px;border-bottom:1px solid #F1F5F9;color:#475569}'
  + '.cu-tbl .cu-grp{font-weight:800;letter-spacing:.1em;color:#1E293B;padding-top:10px;font-size:10px;background:#F8FAFC}'
  + '.cu-tbl .cu-k{font-weight:700;letter-spacing:.06em;font-size:9px}'
  + '.cu-tbl .cu-v1{color:#166534;font-weight:700}.cu-tbl .cu-v-1{color:#DC2626;font-weight:700}.cu-tbl .cu-v0{color:#94A3B8}'
  + '.cu-part{font-size:10px;color:#64748B;margin-top:6px}';

function voteTableHTML(res){
  var groups = [], h = '<table class="cu-tbl"><tr><th>read</th><th>value</th><th>kind</th><th>vote</th><th>rule</th></tr>';
  for (var i = 0; i < res.votes.length; i++) if (groups.indexOf(res.votes[i].group) < 0) groups.push(res.votes[i].group);
  for (var g = 0; g < groups.length; g++){
    h += '<tr><td class="cu-grp" colspan="5">' + esc(groups[g]) + '</td></tr>';
    for (var k = 0; k < res.votes.length; k++){
      var v = res.votes[k]; if (v.group !== groups[g]) continue;
      var vt = v.kind === 'vote' ? (v.vote > 0 ? 'LONG' : v.vote < 0 ? 'SHORT' : 'neutral') : v.kind === 'regime' ? (v.regime < 0 ? 'chop' : v.regime > 0 ? 'trend' : '—') : v.kind === 'n/a' ? 'n/a' : '—';
      h += '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.read) + '</td><td class="cu-k">' + esc(v.kind) + '</td><td class="cu-v' + (v.kind === 'vote' ? v.vote : 0) + '">' + vt + '</td><td>' + esc(v.why) + '</td></tr>';
    }
  }
  h += '</table>';
  if (res.participation) h += '<div class="cu-part">' + esc(res.participation.name) + ' ' + esc(res.participation.read) + ' — ' + esc(res.participation.note) + '</div>';
  return h;
}

function renderResult(ui, res, src){
  var h = '';
  if (!res.ok){ ui.cards.innerHTML = h + '<div class="cu-gate"><b>COUNT SILENT</b> — ' + esc(res.reasons.join(' · ')) + '</div>' + evidenceHTML(); return; }
  var cls = res.fire ? (res.dir === 'long' ? ' long' : ' short') : '', K = res.count.kinds;
  h += '<div class="cu-count' + cls + '">' + esc(res.line)
    + '<small>' + (res.fire ? esc(res.dir.toUpperCase()) + ' FIRES — the rule is met' : res.recordOnly ? 'COUNT MET, RECORD ONLY — ' + esc(res.gates.join(' · ')) : 'NO FIRE — ' + esc(res.gates.join(' · '))) + '</small>'
    + '<small>' + res.count.total + ' reads fed: ' + K.vote + ' vote · ' + K.regime + ' regime · ' + K.print + ' print-only · ' + K.na + ' not applicable · closed 15m bar '
    + new Date(res.bar.t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC · close $' + esc(fmt(res.price)) + ' · ATR14 $' + esc(fmt(res.atr)) + ' · feed ' + esc(src || '—') + '</small></div>';
  if ((res.fire || res.recordOnly) && res.plan){
    var p = res.plan;
    h += '<div class="cu-plan">' + (res.recordOnly ? '<b>RECORD ONLY — NOT A TICKET</b> (not yet measured / measured negative; this is what the rule would have done)<br>' : '') + esc(p.orderType) + ' at the close <b>$' + esc(fmt(p.entry)) + '</b> · STOP <b>$' + esc(fmt(p.stop)) + '</b> (' + esc(fmt(p.stopAtr, 2)) + '×ATR) · TP1 <b>$' + esc(fmt(p.t1)) + '</b> (' + p.rr1 + 'R) · TP2 <b>$' + esc(fmt(p.t2)) + '</b> (' + p.rr2 + 'R) · expires after ' + p.timeoutBars + ' bars (6h)'
      + '<br>At TP1 close 50%, stop to breakeven ($' + esc(fmt(p.entry)) + '); runner to TP2. A 15m close beyond the stop kills the idea.' + (p.floorNote ? '<br>' + esc(p.floorNote) : '') + '</div>';
    if (res.gates.length) h += '<div class="cu-gate">' + esc(res.gates.join(' · ')) + '</div>';
  }
  ui.cards.innerHTML = h + voteTableHTML(res) + evidenceHTML();
}

/* =========================== data =========================== */
var __ui = null, __last = null, __busy = false;
function setStat(ui, s, bad){ try{ if (ui && ui.stat){ ui.stat.textContent = s; ui.stat.style.color = bad ? '#DC2626' : ''; } }catch(e){} }
function gfn(name){ try{ if (typeof W[name] === 'function') return W[name]; }catch(e){} return null; }

async function fetchRows(){
  var out = { rows15m: [], rows1h: [], src: null }, bk = gfn('binanceKlines');
  if (!bk) return out;
  try{ var a = await bk('BTCUSDT', '15m', KL_15M); if (a && a.length){ out.rows15m = a; out.src = 'binance'; } }catch(e){}
  try{ var b = await bk('BTCUSDT', '1h', KL_1H); if (b && b.length) out.rows1h = b; }catch(e){}
  return out;
}

function venueCost(){
  try{
    var f = gfn('hgCryptoVenueCost') || gfn('hgOgVenueCost');
    if (f){ var vc = f(); var rt = vc ? +vc.rtCostPct : NaN; if (vc && isFinite(rt)) return { venue: vc.venue || 'venue', rtFrac: rt / 100 }; }
  }catch(e){}
  return { venue: 'binance-spot', rtFrac: 0.002 };
}

async function runScan(ui){
  if (__busy) return 'busy';
  __busy = true;
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    setStat(ui, 'reading closed 15m + 1h BTCUSDT bars…');
    var f = await fetchRows();
    if (!f.rows15m.length){ setStat(ui, 'feeds failed — no BTCUSDT klines from Binance; nothing fabricated', true); return 'error: no feed'; }
    var now = Date.now();
    var res = cryptoUltraEngine({ rows15m: f.rows15m, rows1h: f.rows1h, now: now, venueCost: venueCost() });
    __last = { at: now, src: f.src, ok: res.ok, fire: res.fire, recordOnly: !!res.recordOnly, dir: res.dir, count: res.count || null, regime: res.regime || null, plan: res.plan || null, line: res.line || null, reasons: res.reasons };
    if (ui && ui.cards) renderResult(ui, res, f.src);
    setStat(ui, (res.ok ? res.line : 'count silent') + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC', false);
    return 'refreshed';
  }catch(e){ setStat(ui, 'scan failed: ' + ((e && e.message) || e), true); return 'error: ' + ((e && e.message) || e); }
  finally{ __busy = false; try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){} }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML = '<style>' + CU_CSS + '</style>'
      + '<div class="panel"><h2>CRYPTO ULTRA <span>one plain scalp rule on BTCUSDT · every standard + crypto-native indicator fed in · verified out-of-sample</span></h2>'
      + '<div class="cu-rule"><b>THE RULE:</b> on every closed 15m bar, every directional indicator read votes LONG / SHORT / neutral. When ≥' + RULE.minAvail + ' reads are decisive, <b>' + Math.round(RULE.minPct * 100) + '%</b> of them agree'
      + (RULE.regimeGate ? ', and the REGIME reads do not say CHOP' : '') + ', that side fires: entry at the close, stop ' + RULE.stopAtr + '×ATR14 (never tighter than ' + RULE.costFloorMult + '× the venue round-trip), TP1 ' + RULE.t1R + 'R, TP2 ' + RULE.t2R + 'R, dead after ' + RULE.timeoutBars
      + ' bars. Every read, its value, its kind, its vote and its rule are printed so you can count them yourself. Reads that cannot vote a side (volatility, trend strength) feed the regime gate; reads that need external data (on-chain, derivatives, order flow, DeFi, ML models) are shown as not applicable — never faked. No strategy measures 100% — the VERIFIED panel says what this one measured.'
      + '</div>'
      + '<div style="margin-top:8px"><button class="btn" id="cuRun">SCAN CRYPTO ULTRA</button> <span class="note" id="cuStat">idle — closed bars only; the forming bar is never read.</span></div>'
      + '</div><div class="cards" id="cuCards"></div>';
    var ui2 = { btn: el.querySelector('#cuRun'), stat: el.querySelector('#cuStat'), cards: el.querySelector('#cuCards') };
    __ui = ui2;
    if (ui2.cards) ui2.cards.innerHTML = evidenceHTML();
    if (ui2.btn) ui2.btn.addEventListener('click', function(){ return runScan(ui2); });
  }catch(e){ try{ el.innerHTML = '<div class="panel">CRYPTO ULTRA failed to mount: ' + esc((e && e.message) || e) + '</div>'; }catch(e2){} }
}

async function refresh(){ if (!__ui) return 'skipped: not mounted'; return runScan(__ui); }

/* =========================== exports =========================== */
W.cryptoUltraEngine = cryptoUltraEngine;
W.cryptoUltraVotes = cryptoUltraVotes;
W.cryptoUltraState = function(){ return __last ? JSON.parse(JSON.stringify(__last)) : null; };
W.HG_CRYPTO_ULTRA_RULE = RULE;
W.HG_CRYPTO_ULTRA_EVIDENCE = HG_CRYPTO_ULTRA_EVIDENCE;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CRYPTO ULTRA', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'CRYPTO ULTRA', run: async function(){ if (!__ui) return 'unavailable: not mounted'; return runScan(__ui); } });

})();
