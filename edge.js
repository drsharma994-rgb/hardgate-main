/* =========================================================================
HARDGATE — edge.js
EDGE tab v6: SWING-aligned entry scanner + Institutional Order Flow
(Delta India + CoinDCX).
Finds high-quality continuation entries that AGREE with SWING SCAN
(cryptogates swingGateMatrix G1–G3 when loaded; G5/G6 scored in enrich):
  LONG  — 4H cascade bullish + HTF above EMA200 + pullback to value
          (LIMIT @ EMA21/EMA9/EMA50, sweep-reclaim or OTE 62–79%, Donchian edge)
  SHORT — 4H cascade bearish + HTF below EMA200 + rally into resistance
          (LIMIT @ EMA21/EMA9/EMA50, sweep-fail or OTE 62–79%, Donchian edge)
Sweep quality (2025/26 SMC): wick through level + reclaim close within 1–3 bars
with displacement (body > 0.8× ATR on reclaim); stop beyond sweep wick + 0.5 ATR.
INSTITUTIONAL UPGRADES V6:
- CVD (Cumulative Volume Delta) Trap Vetoes
- L2 Order Book Imbalance (OBI) Spoof Detection
- SMT Divergence Hard Vetoes (Gold/Silver correlation)
- US10Y Yield Macro Vetoes
- Volume decay validator (corrective pullback vs falling knife)
Pure exports (never throw):
  edgeSignal, edgeEnrich, edgeAssess, edgePlan, edgeBacktest,
  edgeMaxSafeLev, edgeUseLev, edgeSwingRead, edgeSwingBias,
  edgeEntryGuidance, edgeExactEntry, edgeOteZone, edgeSweepQuality,
  isCorrectivePullback
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : this;

var MIN_TURNOVER  = 100000;
var MAX_UNIVERSE  = 120;
var KL_LIMIT      = 300;
var DON_LEN       = 55;
var BB_LEN        = 20;
var BB_MULT       = 2;
var ATR_LEN       = 14;
var EXT_LEN       = 8;
var STOP_ATR      = 2.0;
var SWEEP_STOP_ATR = 0.5;
var PULL_ATR      = 0.4;
var EMA9_PULL_ATR = 0.25;
var SWEEP_RECLAIM_MAX = 3;
var SWEEP_RECLAIM_BODY_ATR = 0.8;
var OTE_LO        = 0.62;
var OTE_HI        = 0.79;
var OTE_MID       = 0.705;
var MIN_IMPULSE_ATR = 1.5;
var MIN_RR        = 2.0;
var MIN_TALLY     = 5;
var SIGNAL_LOOKBACK = 6;
var MAX_HOLD      = 12;
var MIN_RECORD    = 3;
var CHUNK         = 4;
var CHUNK_SLEEP_MS = 150;
var USE_LEV_FRAC  = 0.5;
var TF            = '4h';
var PULLBACK_VOL_LOOKBACK = 5;
var PULLBACK_VOL_RATIO = 1.25;

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function pxF(n){
  if (typeof px === 'function') return px(n);
  if (n === null || n === undefined || isNaN(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function') return fmt(n, d);
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function fmtSignedR(r){
  if (!isFinite(r)) return '—';
  return (r > 0 ? '+' : '') + r.toFixed(2) + 'R';
}
function fmtPF(pf){
  if (pf === Infinity) return '∞';
  if (!isFinite(pf)) return '—';
  return pf.toFixed(1);
}
function btZero(){ return { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 }; }

function edgeDropForming(rows, res){
  try{
    var sec = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400}[res];
    if (!rows || !rows.length || !sec) return rows || [];
    var now = Math.floor(Date.now() / 1000);
    return (now - rows[rows.length - 1].t < sec) ? rows.slice(0, -1) : rows;
  }catch(e){ return rows || []; }
}

function edgeMaxSafeLev(entry, stop){
  try{
    entry = +entry; stop = +stop;
    if (!(isFinite(entry) && isFinite(stop)) || entry <= 0 || entry === stop) return 1;
    var sd = Math.abs(entry - stop) / entry;
    return Math.max(1, Math.min(100, Math.floor(1 / (sd * 1.5 + 0.005))));
  }catch(e){ return 1; }
}

function edgeUseLev(entry, stop, frac){
  try{
    frac = (frac === undefined) ? USE_LEV_FRAC : +frac;
    if (!(frac > 0 && frac <= 1)) frac = USE_LEV_FRAC;
    var mx = edgeMaxSafeLev(entry, stop);
    return Math.max(1, Math.min(mx, Math.floor(mx * frac)));
  }catch(e){ return 1; }
}

function computeArrays(rows){
  if (typeof donchian !== 'function' || typeof atr !== 'function' ||
      typeof sma !== 'function' || typeof bollinger !== 'function' ||
      typeof ema !== 'function' || typeof lowest !== 'function' ||
      typeof highest !== 'function' || typeof rsi !== 'function') return null;
  var n = rows.length;
  var clean = new Array(n), closes = new Array(n), highs = new Array(n), lows = new Array(n), volumes = new Array(n);
  for (var i = 0; i < n; i++){
    var r = rows[i];
    clean[i] = r;
    closes[i] = (r && isFinite(r.c)) ? r.c : NaN;
    highs[i]  = (r && isFinite(r.h)) ? r.h : NaN;
    lows[i]   = (r && isFinite(r.l)) ? r.l : NaN;
    volumes[i]= (r && isFinite(r.v)) ? r.v : 0;
  }
  var bb = bollinger(closes, BB_LEN, BB_MULT);
  var pb = new Array(n);
  for (var j = 0; j < n; j++){
    var u = bb.upper[j], l = bb.lower[j];
    if (isFinite(u) && isFinite(l) && u !== l) pb[j] = (closes[j] - l) / (u - l);
    else pb[j] = NaN;
  }
  return { rows: clean, closes: closes, highs: highs, lows: lows, volumes: volumes,
           dc: donchian(clean, DON_LEN), pb: pb,
           atr: atr(clean, ATR_LEN), sma20: sma(closes, 20), rsi14: rsi(closes, 14),
           e9: ema(closes, 9), e21: ema(closes, 21), e50: ema(closes, 50), e200: ema(closes, 200),
           loExt: lowest(lows, EXT_LEN), hiExt: highest(highs, EXT_LEN) };
}

/* Volume decay validator — pullback bars should be lighter than prior impulse
   (blocks falling-knife / violent counter-trend volume into limit bids). */
function isCorrectivePullback(A, index, dir, lookback){
  try{
    lookback = (lookback === undefined || !isFinite(lookback)) ? PULLBACK_VOL_LOOKBACK : +lookback;
    if (!A || !A.volumes || index < lookback * 2) return true;
    var pullbackVol = 0, impulseVol = 0, vi;
    for (vi = index - lookback + 1; vi <= index; vi++){
      pullbackVol += A.volumes[vi] || 0;
    }
    for (vi = index - (lookback * 2) + 1; vi <= index - lookback; vi++){
      impulseVol += A.volumes[vi] || 0;
    }
    if (pullbackVol > impulseVol * PULLBACK_VOL_RATIO) return false;
    return true;
  }catch(e){ return true; }
}

/* SWING SCAN G1 — 4H EMA cascade + spread gate */
function edgeSwingRead(rows){
  var out = { dir: null, rawDir: null, label: 'SWING cascade n/a', htf: null, spreadOk: false };
  try{
    if (!rows || rows.length < 55 || typeof ema !== 'function' || typeof atr !== 'function') return out;
    var closes = new Array(rows.length);
    for (var i = 0; i < rows.length; i++) closes[i] = rows[i].c;
    var n = closes.length - 1;
    var e9a = ema(closes, 9), e21a = ema(closes, 21), e50a = ema(closes, 50), e200a = ema(closes, 200);
    var e9 = e9a[n], e21 = e21a[n], e50 = e50a[n], e200 = e200a[n], p = closes[n];
    if (!(isFinite(e9) && isFinite(e21) && isFinite(e50))) return out;
    var rawDir = null;
    if (e9 > e21 && e21 > e50) rawDir = 'long';
    else if (e9 < e21 && e21 < e50) rawDir = 'short';
    var a4a = atr(rows, 14), a4 = a4a[n];
    var spreadOk = isFinite(a4) && a4 > 0 && Math.abs(e21 - e50) >= 0.25 * a4;
    var htf = null;
    if (isFinite(e200) && isFinite(p)) htf = p > e200 ? 'long' : (p < e200 ? 'short' : null);
    out.rawDir = rawDir;
    out.spreadOk = spreadOk;
    out.dir = (rawDir && spreadOk) ? rawDir : null;
    out.htf = htf;
    if (!rawDir) out.label = 'SWING cascade mixed (no G1)';
    else {
      out.label = 'SWING 4H ' + rawDir.toUpperCase() + (spreadOk ? '' : ' · spread thin');
      if (htf && htf !== rawDir) out.label += ' · vs EMA200 ' + htf.toUpperCase();
    }
    return out;
  }catch(e){ return out; }
}

/* Mandatory bias: SWING G1 cascade+spread + G2 HTF + G3 RSI (cryptogates parity) */
function edgeSwingBias(rows){
  try{
    if (!rows || rows.length < 210) return null;
    var sw = edgeSwingRead(rows);
    if (!sw.dir) return null;
    if (sw.htf && sw.htf !== sw.dir) return null;
    var passed = null, clean = false, anchorLevel = null;
    var g5 = null, g6 = null, dynamicRR = null;
    if (typeof swingGateMatrix === 'function'){
      var m = swingGateMatrix(rows, null);
      if (!m || !m.dir || m.dir !== sw.dir) return null;
      if (!m.gates[0][1] || !m.gates[1][1] || !m.gates[2][1]) return null;
      passed = m.passed;
      clean = m.clean === true;
      anchorLevel = isFinite(m.level) ? m.level : null;
      g5 = m.gates[4] ? m.gates[4][1] : null;
      g6 = m.gates[5] ? m.gates[5][1] : null;
      dynamicRR = isFinite(m.dynamicRR) ? m.dynamicRR : null;
    }
    var reg = (typeof detectRegime === 'function') ? detectRegime(rows) : null;
    if (reg && reg.regime === 'volatile') return null;
    return {
      dir: sw.dir, swing: sw, regime: reg ? reg.label : 'n/a',
      swingPassed: passed, swingClean: clean, anchorLevel: anchorLevel,
      g5: g5, g6: g6, dynamicRR: dynamicRR
    };
  }catch(e){ return null; }
}

/* OTE band (62–79% retrace, 70.5% sweet spot) of an impulse leg — ICT/SMC 2025+ */
function edgeOteZone(impulseLo, impulseHi, dir){
  try{
    if (typeof hgOteZone === 'function') return hgOteZone(impulseLo, impulseHi, dir);
    var span = impulseHi - impulseLo;
    if (!(span > 0)) return null;
    if (dir === 'long'){
      return {
        lo: impulseHi - OTE_HI * span, hi: impulseHi - OTE_LO * span,
        mid: impulseHi - OTE_MID * span, entry: impulseHi - OTE_MID * span
      };
    }
    return {
      lo: impulseLo + OTE_LO * span, hi: impulseLo + OTE_HI * span,
      mid: impulseLo + OTE_MID * span, entry: impulseLo + OTE_MID * span
    };
  }catch(e){ return null; }
}

/* Wick through level + reclaim close with displacement (body > 0.8× ATR). */
function edgeSweepQuality(A, i, dir, priorLevel){
  try{
    if (typeof hgDetectLiquiditySweep === 'function'){
      return hgDetectLiquiditySweep(A, i, dir, priorLevel, {
        maxBars: SWEEP_RECLAIM_MAX,
        minBodyAtr: SWEEP_RECLAIM_BODY_ATR,
      });
    }
    var maxBack = Math.min(SWEEP_RECLAIM_MAX, i);
    var sweepBar = -1, sweepExtreme = NaN, reclaimBar = -1;
    for (var b = 0; b <= maxBack; b++){
      var j = i - b;
      var lj = A.lows[j], hj = A.highs[j];
      if (dir === 'long'){
        if (!(isFinite(lj) && lj < priorLevel)) continue;
        sweepBar = j;
        sweepExtreme = lj;
        for (var r = j; r <= i && r - j <= SWEEP_RECLAIM_MAX; r++){
          var cr = A.closes[r], or = A.rows[r].o, atrr = A.atr[r];
          var bodySize = Math.abs(cr - or);
          if (isFinite(cr) && cr > priorLevel && isFinite(atrr) && bodySize > SWEEP_RECLAIM_BODY_ATR * atrr){
            reclaimBar = r;
            break;
          }
        }
        if (reclaimBar >= 0) break;
      } else {
        if (!(isFinite(hj) && hj > priorLevel)) continue;
        sweepBar = j;
        sweepExtreme = hj;
        for (var r2 = j; r2 <= i && r2 - j <= SWEEP_RECLAIM_MAX; r2++){
          var cr2 = A.closes[r2], or2 = A.rows[r2].o, atrr2 = A.atr[r2];
          var bodySize2 = Math.abs(cr2 - or2);
          if (isFinite(cr2) && cr2 < priorLevel && isFinite(atrr2) && bodySize2 > SWEEP_RECLAIM_BODY_ATR * atrr2){
            reclaimBar = r2;
            break;
          }
        }
        if (reclaimBar >= 0) break;
      }
    }
    if (sweepBar < 0 || reclaimBar < 0) return null;
    return { swept: true, sweepBar: sweepBar, reclaimBar: reclaimBar,
             priorLevel: priorLevel, sweepExtreme: sweepExtreme };
  }catch(e){ return null; }
}

function edgeSweepStop(dir, sweepExtreme, at){
  try{
    if (typeof hgSweepStop === 'function'){
      var s = hgSweepStop(dir, sweepExtreme, at, { atrMult: SWEEP_STOP_ATR });
      if (isFinite(s)) return s;
    }
    if (!isFinite(sweepExtreme) || !isFinite(at)) return NaN;
    return (dir === 'long')
      ? sweepExtreme - SWEEP_STOP_ATR * at
      : sweepExtreme + SWEEP_STOP_ATR * at;
  }catch(e){ return NaN; }
}

/* Exact resting entry + zone from the trigger bar — never the close when a
   structure level is the honest fill price. */
function edgeExactEntry(biasDir, kind, A, i, ctx){
  try{
    ctx = ctx || {};
    var c = A.closes[i], h = A.highs[i], l = A.lows[i];
    var at = A.atr[i], tol = PULL_ATR * at;
    var e9 = A.e9[i], e21 = A.e21[i], e50 = A.e50[i];
    var dcLo = A.dc.lo[i], dcHi = A.dc.up[i];
    var mark = c, entry, zoneLo, zoneHi, entryType = 'LIMIT', anchor;

    if (biasDir === 'long'){
      if (kind === 'EMA21 PULLBACK' && isFinite(e21)){
        entry = e21;
        anchor = e21;
        zoneLo = e21 - tol * 0.5;
        zoneHi = e21 + tol * 0.25;
        if (mark > zoneHi + tol * 0.5) return null;
        entryType = (mark >= zoneLo && mark <= zoneHi + tol * 0.25) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'EMA9 PULLBACK' && isFinite(e9)){
        entry = e9;
        anchor = e9;
        zoneLo = e9 - tol * 0.5;
        zoneHi = e9 + tol * 0.25;
        if (mark > zoneHi + tol * 0.5) return null;
        entryType = (mark >= zoneLo && mark <= zoneHi + tol * 0.25) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'EMA50 RECLAIM' && isFinite(e50)){
        entry = e50;
        anchor = e50;
        zoneLo = e50 - tol * 0.35;
        zoneHi = e50 + tol * 0.25;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'SWEEP + RECLAIM' && isFinite(ctx.priorLo)){
        entry = ctx.priorLo;
        anchor = ctx.priorLo;
        zoneLo = ctx.priorLo - tol * 0.25;
        zoneHi = ctx.priorLo + tol * 0.5;
        entryType = mark >= entry ? 'MARKET' : 'LIMIT';
      } else if (kind === 'SWEEP + OTE' && ctx.ote){
        entry = ctx.ote.entry;
        anchor = ctx.ote.mid;
        zoneLo = ctx.ote.lo;
        zoneHi = ctx.ote.hi;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'RANGE BOTTOM (trend)' && isFinite(dcLo)){
        entry = dcLo;
        anchor = dcLo;
        zoneLo = dcLo - tol * 0.25;
        zoneHi = dcLo + tol * 0.5;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else return null;
      if (!(entry < mark + tol * 1.25)) return null;
    } else {
      if (kind === 'EMA21 REJECTION' && isFinite(e21)){
        entry = e21;
        anchor = e21;
        zoneLo = e21 - tol * 0.25;
        zoneHi = e21 + tol * 0.5;
        if (mark < zoneLo - tol * 0.5) return null;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'EMA9 REJECTION' && isFinite(e9)){
        entry = e9;
        anchor = e9;
        zoneLo = e9 - tol * 0.25;
        zoneHi = e9 + tol * 0.5;
        if (mark < zoneLo - tol * 0.5) return null;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'EMA50 RECLAIM' && isFinite(e50)){
        entry = e50;
        anchor = e50;
        zoneLo = e50 - tol * 0.25;
        zoneHi = e50 + tol * 0.35;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'SWEEP + FAIL' && isFinite(ctx.priorHi)){
        entry = ctx.priorHi;
        anchor = ctx.priorHi;
        zoneLo = ctx.priorHi - tol * 0.5;
        zoneHi = ctx.priorHi + tol * 0.25;
        entryType = mark <= entry ? 'MARKET' : 'LIMIT';
      } else if (kind === 'SWEEP + OTE' && ctx.ote){
        entry = ctx.ote.entry;
        anchor = ctx.ote.mid;
        zoneLo = ctx.ote.lo;
        zoneHi = ctx.ote.hi;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else if (kind === 'RANGE TOP (trend)' && isFinite(dcHi)){
        entry = dcHi;
        anchor = dcHi;
        zoneLo = dcHi - tol * 0.5;
        zoneHi = dcHi + tol * 0.25;
        entryType = (mark >= zoneLo && mark <= zoneHi) ? 'MARKET' : 'LIMIT';
      } else return null;
      if (!(entry > mark - tol * 1.25)) return null;
    }
    return {
      entry: entry, mark: mark, entryType: entryType, anchor: anchor,
      zone: { lo: zoneLo, hi: zoneHi }
    };
  }catch(e){ return null; }
}

function edgeEntryGuidance(mark, entry, zone, dir){
  try{
    mark = +mark; entry = +entry;
    if (!isFinite(mark) || !isFinite(entry)) return { inZone: false, text: 'mark unavailable' };
    var zLo = zone && isFinite(zone.lo) ? zone.lo : entry;
    var zHi = zone && isFinite(zone.hi) ? zone.hi : entry;
    var inZone = mark >= zLo && mark <= zHi;
    if (inZone) return { inZone: true, text: 'price in entry zone — market fill valid at ' + pxF(entry) };
    if (dir === 'long'){
      return mark < entry
        ? { inZone: false, text: 'LIMIT @ ' + pxF(entry) + ' — mark below entry, order working' }
        : { inZone: false, text: 'LIMIT @ ' + pxF(entry) + ' — wait for pullback to structure' };
    }
    return mark > entry
      ? { inZone: false, text: 'LIMIT @ ' + pxF(entry) + ' — mark above entry, order working' }
      : { inZone: false, text: 'LIMIT @ ' + pxF(entry) + ' — wait for rally into resistance' };
  }catch(e){ return { inZone: false, text: '' }; }
}

function finalizeSetup(biasDir, A, i, spec){
  try{
    var ex = edgeExactEntry(biasDir, spec.edge, A, i, spec.ctx);
    if (!ex) return null;
    var p = planFromRisk(biasDir, ex.entry, spec.stop, spec.t1Hint, spec.t2Hint);
    if (!p) return null;
    var guide = edgeEntryGuidance(ex.mark, ex.entry, ex.zone, biasDir);
    return Object.assign(p, {
      edge: spec.edge, swept: spec.swept, extreme: spec.extreme,
      mark: ex.mark, entry: ex.entry, entryType: ex.entryType,
      anchor: ex.anchor, zone: ex.zone, entryGuidance: guide.text, inZone: guide.inZone
    });
  }catch(e){ return null; }
}

function barClosePos(h, l, c){
  var range = (isFinite(h) && isFinite(l) && h > l) ? (h - l) : NaN;
  return (isFinite(range) && range > 0) ? (c - l) / range : NaN;
}

function planFromRisk(dir, entry, stop, t1Hint, t2Hint){
  var risk = (dir === 'long') ? (entry - stop) : (stop - entry);
  if (!(risk > 0)) return null;
  var t1 = t1Hint;
  var rew1 = (dir === 'long') ? (t1 - entry) : (entry - t1);
  if (!(rew1 > 0)) t1 = (dir === 'long') ? entry + MIN_RR * risk : entry - MIN_RR * risk;
  rew1 = (dir === 'long') ? (t1 - entry) : (entry - t1);
  if (!(rew1 > 0)) return null;
  var rr = rew1 / risk;
  if (rr < MIN_RR){
    t1 = (dir === 'long') ? entry + MIN_RR * risk : entry - MIN_RR * risk;
    rr = MIN_RR;
  }
  var t2 = t2Hint;
  if (!isFinite(t2) || (dir === 'long' ? t2 <= t1 : t2 >= t1)){
    t2 = (dir === 'long') ? entry + 3.5 * risk : entry - 3.5 * risk;
  }
  return { dir: dir, entry: entry, stop: stop, t1: t1, t2: t2, rr: rr, risk: risk };
}

function trySetupAt(A, i, biasDir){
  try{
    var row = A.rows[i];
    if (!row) return null;
    var c = A.closes[i], h = A.highs[i], l = A.lows[i], o = row.o;
    var at = A.atr[i], pb = A.pb[i], rsi = A.rsi14[i];
    var e9 = A.e9[i], e21 = A.e21[i], e50 = A.e50[i];
    var dcLo = A.dc.lo[i], dcHi = A.dc.up[i], dcMid = A.dc.mid[i];
    if (!isFinite(c) || !isFinite(at) || !(at > 0)) return null;
    var closePos = barClosePos(h, l, c);
    var tol = PULL_ATR * at;
    /* Volume validation — hard veto (falling knife / violent counter-trend vol) */
    if (!isCorrectivePullback(A, i, biasDir, PULLBACK_VOL_LOOKBACK)) return null;
    var k, extremeL, extremeH, stopL, stopS, pL, pS, sq, ote, impulseLo, impulseHi;

    if (biasDir === 'long'){
      if (!(isFinite(e50) && c > e50)) return null;
      if (isFinite(rsi) && (rsi > 68 || rsi < 32)) return null;

      /* 1) EMA21 pullback — primary trend entry */
      if (isFinite(e21) && l <= e21 + tol && c >= e21 - tol * 0.5){
        var hold = isFinite(closePos) && closePos >= 0.52 && isFinite(o) && c >= o;
        var pbOk = !isFinite(pb) || pb <= 0.55;
        if (hold && pbOk){
          extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
          stopL = Math.min(extremeL, l) - STOP_ATR * at;
          pL = finalizeSetup('long', A, i, {
            edge: 'EMA21 PULLBACK', swept: false, extreme: extremeL, stop: stopL,
            t1Hint: isFinite(e9) ? e9 + at : null, t2Hint: isFinite(dcHi) ? dcHi : null, ctx: {}
          });
          if (pL) return pL;
        }
      }

      /* 2) EMA9 pullback when extended from fast MA (swingTryClean parity) */
      if (isFinite(e9) && isFinite(e21) && Math.abs(c - e9) / at > EMA9_PULL_ATR){
        if (l <= e9 + tol && c >= e9 - tol * 0.5 && isFinite(closePos) && closePos >= 0.5){
          extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
          stopL = Math.min(extremeL, l) - STOP_ATR * at;
          pL = finalizeSetup('long', A, i, {
            edge: 'EMA9 PULLBACK', swept: false, extreme: extremeL, stop: stopL,
            t1Hint: isFinite(e21) ? e21 + at : null, t2Hint: isFinite(dcHi) ? dcHi : null, ctx: {}
          });
          if (pL) return pL;
        }
      }

      /* 3) EMA50 sweep + reclaim — trap filter in uptrend */
      if (isFinite(e50) && l < e50 && c > e50 && isFinite(closePos) && closePos >= 0.55){
        extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
        stopL = edgeSweepStop('long', l, at);
        if (!isFinite(stopL)) stopL = extremeL - STOP_ATR * at;
        pL = finalizeSetup('long', A, i, {
          edge: 'EMA50 RECLAIM', swept: true, extreme: extremeL, stop: stopL,
          t1Hint: isFinite(e21) ? e21 + at : null, t2Hint: isFinite(dcHi) ? dcHi : null, ctx: {}
        });
        if (pL) return pL;
      }

      /* 4) Sweep + reclaim of local low (1–3 bar quality filter) */
      var priorLo = Infinity;
      for (k = Math.max(0, i - 12); k < i; k++){
        if (isFinite(A.lows[k]) && A.lows[k] < priorLo) priorLo = A.lows[k];
      }
      sq = (priorLo < Infinity) ? edgeSweepQuality(A, i, 'long', priorLo) : null;
      if (sq && isFinite(closePos) && closePos >= 0.55){
        extremeL = isFinite(sq.sweepExtreme) ? sq.sweepExtreme : l;
        stopL = edgeSweepStop('long', extremeL, at);
        if (!isFinite(stopL)) stopL = extremeL - STOP_ATR * at;
        impulseLo = extremeL;
        impulseHi = h;
        for (k = sq.sweepBar; k <= i; k++){
          if (isFinite(A.highs[k]) && A.highs[k] > impulseHi) impulseHi = A.highs[k];
        }
        if (impulseHi - impulseLo >= MIN_IMPULSE_ATR * at){
          ote = edgeOteZone(impulseLo, impulseHi, 'long');
          if (ote && c > ote.hi){
            pL = finalizeSetup('long', A, i, {
              edge: 'SWEEP + OTE', swept: true, extreme: extremeL, stop: stopL,
              t1Hint: isFinite(dcMid) ? dcMid : null, t2Hint: isFinite(dcHi) ? dcHi : null,
              ctx: { priorLo: priorLo, ote: ote }
            });
            if (pL) return pL;
          }
        }
        pL = finalizeSetup('long', A, i, {
          edge: 'SWEEP + RECLAIM', swept: true, extreme: extremeL, stop: stopL,
          t1Hint: isFinite(dcMid) ? dcMid : null, t2Hint: isFinite(dcHi) ? dcHi : null,
          ctx: { priorLo: priorLo }
        });
        if (pL) return pL;
      }

      /* 5) Aligned range-bottom touch (only in uptrend — at lower Donchian) */
      if (isFinite(dcLo) && l <= dcLo + tol && c > dcLo && isFinite(pb) && pb <= 0.35){
        if (isFinite(closePos) && closePos >= 0.5){
          extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
          stopL = extremeL - STOP_ATR * at;
          pL = finalizeSetup('long', A, i, {
            edge: 'RANGE BOTTOM (trend)', swept: false, extreme: extremeL, stop: stopL,
            t1Hint: isFinite(dcMid) ? dcMid : null, t2Hint: isFinite(dcHi) ? dcHi : null, ctx: {}
          });
          if (pL) return pL;
        }
      }
    }

    if (biasDir === 'short'){
      if (!(isFinite(e50) && c < e50)) return null;
      if (isFinite(rsi) && (rsi < 32 || rsi > 68)) return null;

      /* 1) EMA21 rally rejection */
      if (isFinite(e21) && h >= e21 - tol && c <= e21 + tol * 0.5){
        var reject = isFinite(closePos) && closePos <= 0.48 && isFinite(o) && c <= o;
        var pbHiOk = !isFinite(pb) || pb >= 0.45;
        if (reject && pbHiOk){
          extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
          stopS = Math.max(extremeH, h) + STOP_ATR * at;
          pS = finalizeSetup('short', A, i, {
            edge: 'EMA21 REJECTION', swept: false, extreme: extremeH, stop: stopS,
            t1Hint: isFinite(e9) ? e9 - at : null, t2Hint: isFinite(dcLo) ? dcLo : null, ctx: {}
          });
          if (pS) return pS;
        }
      }

      /* 2) EMA9 rejection when extended from fast MA */
      if (isFinite(e9) && isFinite(e21) && Math.abs(c - e9) / at > EMA9_PULL_ATR){
        if (h >= e9 - tol && c <= e9 + tol * 0.5 && isFinite(closePos) && closePos <= 0.5){
          extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
          stopS = Math.max(extremeH, h) + STOP_ATR * at;
          pS = finalizeSetup('short', A, i, {
            edge: 'EMA9 REJECTION', swept: false, extreme: extremeH, stop: stopS,
            t1Hint: isFinite(e21) ? e21 - at : null, t2Hint: isFinite(dcLo) ? dcLo : null, ctx: {}
          });
          if (pS) return pS;
        }
      }

      /* 3) EMA50 sweep + fail in downtrend */
      if (isFinite(e50) && h > e50 && c < e50 && isFinite(closePos) && closePos <= 0.45){
        extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
        stopS = edgeSweepStop('short', h, at);
        if (!isFinite(stopS)) stopS = extremeH + STOP_ATR * at;
        pS = finalizeSetup('short', A, i, {
          edge: 'EMA50 RECLAIM', swept: true, extreme: extremeH, stop: stopS,
          t1Hint: isFinite(e21) ? e21 - at : null, t2Hint: isFinite(dcLo) ? dcLo : null, ctx: {}
        });
        if (pS) return pS;
      }

      /* 4) Sweep + fail at local high (1–3 bar quality filter) */
      var priorHi = -Infinity;
      for (k = Math.max(0, i - 12); k < i; k++){
        if (isFinite(A.highs[k]) && A.highs[k] > priorHi) priorHi = A.highs[k];
      }
      sq = (priorHi > -Infinity) ? edgeSweepQuality(A, i, 'short', priorHi) : null;
      if (sq && isFinite(closePos) && closePos <= 0.45){
        extremeH = isFinite(sq.sweepExtreme) ? sq.sweepExtreme : h;
        stopS = edgeSweepStop('short', extremeH, at);
        if (!isFinite(stopS)) stopS = extremeH + STOP_ATR * at;
        impulseHi = extremeH;
        impulseLo = l;
        for (k = sq.sweepBar; k <= i; k++){
          if (isFinite(A.lows[k]) && A.lows[k] < impulseLo) impulseLo = A.lows[k];
        }
        if (impulseHi - impulseLo >= MIN_IMPULSE_ATR * at){
          ote = edgeOteZone(impulseLo, impulseHi, 'short');
          if (ote && c < ote.lo){
            pS = finalizeSetup('short', A, i, {
              edge: 'SWEEP + OTE', swept: true, extreme: extremeH, stop: stopS,
              t1Hint: isFinite(dcMid) ? dcMid : null, t2Hint: isFinite(dcLo) ? dcLo : null,
              ctx: { priorHi: priorHi, ote: ote }
            });
            if (pS) return pS;
          }
        }
        pS = finalizeSetup('short', A, i, {
          edge: 'SWEEP + FAIL', swept: true, extreme: extremeH, stop: stopS,
          t1Hint: isFinite(dcMid) ? dcMid : null, t2Hint: isFinite(dcLo) ? dcLo : null,
          ctx: { priorHi: priorHi }
        });
        if (pS) return pS;
      }

      /* 5) Aligned range-top rejection */
      if (isFinite(dcHi) && h >= dcHi - tol && c < dcHi && isFinite(pb) && pb >= 0.65){
        if (isFinite(closePos) && closePos <= 0.5){
          extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
          stopS = extremeH + STOP_ATR * at;
          pS = finalizeSetup('short', A, i, {
            edge: 'RANGE TOP (trend)', swept: false, extreme: extremeH, stop: stopS,
            t1Hint: isFinite(dcMid) ? dcMid : null, t2Hint: isFinite(dcLo) ? dcLo : null, ctx: {}
          });
          if (pS) return pS;
        }
      }
    }
    return null;
  }catch(e){ return null; }
}

function setupAt(A, i){
  var bias = edgeSwingBias(A.rows.slice(0, i + 1));
  if (!bias) return null;
  return trySetupAt(A, i, bias.dir);
}

function edgeSignal(rows){
  try{
    if (!rows || rows.length < DON_LEN + 30) return null;
    var bias = edgeSwingBias(rows);
    if (!bias) return null;
    var A = computeArrays(rows);
    if (!A) return null;
    var i0 = rows.length - 1;
    for (var lb = 0; lb < SIGNAL_LOOKBACK; lb++){
      var i = i0 - lb;
      if (i < DON_LEN + 5) break;
      var s = trySetupAt(A, i, bias.dir);
      if (!s) continue;
      s.regime = bias.regime;
      s.rsi14 = isFinite(A.rsi14[i]) ? A.rsi14[i] : null;
      s.pctB = isFinite(A.pb[i]) ? A.pb[i] : null;
      s.dcLo = A.dc.lo[i];
      s.dcHi = A.dc.up[i];
      s.barAge = lb;
      s.swingAligned = true;
      s.volumeCorrective = isCorrectivePullback(A, i, bias.dir);
      return s;
    }
    return null;
  }catch(e){ return null; }
}

/* =========================================================================
   EDGE ENRICHMENT & INSTITUTIONAL ALPHA GUARDS
   Evaluates CVD Traps, SMT Divergence, Yield Correlation, and OBI.
========================================================================= */
function edgeEnrich(sig, rows, item, candleSrc){
  var out = { tally: 0, parts: [], notes: [], candleSrc: candleSrc || null, swingAligned: true, veto: false };
  try{
    if (!sig || !rows) return out;
    var dir = sig.dir;
    var bias = edgeSwingBias(rows);
    if (!bias || bias.dir !== dir) return out;
    var symStr = item ? String(item.sym || '').toUpperCase() : '';
    /* --- INSTITUTIONAL MACRO GUARDS --- */
    if (typeof W.hgSmtState === 'function') {
      var smt = W.hgSmtState();
      if (smt && smt.divergence === 'BEARISH' && dir === 'long') {
        out.parts.push({ label: 'BEARISH SMT Divergence — Trap VETO', pts: -99 });
        out.veto = true; return out;
      }
      if (smt && smt.divergence === 'BULLISH' && dir === 'short') {
        out.parts.push({ label: 'BULLISH SMT Divergence — Trap VETO', pts: -99 });
        out.veto = true; return out;
      }
    }
    if ((symStr.includes('XAU') || symStr.includes('GOLD')) && typeof W.hgYieldState === 'function') {
      var yd = W.hgYieldState();
      if (yd && yd.trend === 'spiking' && dir === 'long') {
        out.parts.push({ label: 'US10Y Yield Spiking — Macro VETO', pts: -99 });
        out.veto = true; return out;
      }
      if (yd && yd.trend === 'dropping' && dir === 'short') {
        out.parts.push({ label: 'US10Y Yield Dropping — Macro VETO', pts: -99 });
        out.veto = true; return out;
      }
    }
    /* --- ORDER FLOW & MICROSTRUCTURE GUARDS --- */
    var cvdFn = (typeof W.cvdAssess === 'function') ? W.cvdAssess : W.__hgBrainCvd;
    if (item && item.taker && typeof cvdFn === 'function') {
      var cvd = cvdFn(item.taker);
      if (cvd) {
        if (dir === 'long' && cvd.severeLongTrap) {
          out.parts.push({ label: 'SEVERE CVD Divergence — Sellers Absorbing (VETO)', pts: -99 });
          out.veto = true; return out;
        }
        if (dir === 'short' && cvd.severeShortTrap) {
          out.parts.push({ label: 'SEVERE CVD Divergence — Buyers Absorbing (VETO)', pts: -99 });
          out.veto = true; return out;
        }
        if ((dir === 'long' && cvd.confirmsLong) || (dir === 'short' && cvd.confirmsShort)) {
          out.parts.push({ label: 'CVD Order Flow Confirms Trend', pts: 2 });
          out.tally += 2;
        } else if ((dir === 'long' && cvd.ratio < 1.0) || (dir === 'short' && cvd.ratio > 1.0)){
          out.parts.push({ label: 'CVD Taker Flow Against Bias', pts: -1 });
          out.tally -= 1;
        }
      }
    }
    if (item && item.bookDepth && typeof W.calculateOrderBookImbalance === 'function') {
      var obi = W.calculateOrderBookImbalance(item.bookDepth);
      var spoofTrap = (dir === 'long' && obi.obiValue <= -0.33) || (dir === 'short' && obi.obiValue >= 0.33);
      if (spoofTrap) {
        out.parts.push({ label: 'L2 Book Stacked Against Limit (Spoof Trap)', pts: -1 });
        out.tally -= 1;
      } else if ((dir === 'long' && obi.obiValue >= 0.33) || (dir === 'short' && obi.obiValue <= -0.33)) {
        out.parts.push({ label: 'L2 Book Liquidity Supports Fill', pts: 1 });
        out.tally += 1;
      }
    }
    /* --- ANCHOR CLUSTERING REWARD --- */
    var entryPrice = +sig.entry;
    if (isFinite(entryPrice)){
      var Acluster = computeArrays(rows);
      if (Acluster && Acluster.atr){
        var lastIdx = rows.length - 1;
        var atCluster = Acluster.atr[lastIdx];
        if (isFinite(atCluster) && atCluster > 0){
          var clusterCount = 0;
          var atrClusterTolerance = atCluster * 0.3;
          if (Math.abs(entryPrice - Acluster.e9[lastIdx]) <= atrClusterTolerance) clusterCount++;
          if (Math.abs(entryPrice - Acluster.e21[lastIdx]) <= atrClusterTolerance) clusterCount++;
          if (Math.abs(entryPrice - Acluster.e50[lastIdx]) <= atrClusterTolerance) clusterCount++;
          if (Math.abs(entryPrice - Acluster.dc.mid[lastIdx]) <= atrClusterTolerance) clusterCount++;
          if (clusterCount >= 2){
            out.parts.push({ label: 'Golden Confluence: ' + clusterCount + ' anchors cluster at entry', pts: 2 });
            out.tally += 2;
          }
        }
      }
    }
    /* --- STANDARD ENRICHMENTS --- */
    out.parts.push({ label: 'SWING 4H cascade + HTF agree — ' + dir.toUpperCase(), pts: 2 });
    out.tally += 2;
    out.parts.push({ label: sig.edge + (sig.swept ? ' · liquidity sweep' : ' · value entry'), pts: 2 });
    out.tally += 2;
    if (sig.edge && sig.edge.indexOf('OTE') >= 0){
      out.parts.push({ label: 'OTE 62–79% limit (70.5% sweet spot)', pts: 1 });
      out.tally += 1;
    }
    if (sig.barAge > 0){
      out.parts.push({ label: 'trigger ' + sig.barAge + ' bar' + (sig.barAge === 1 ? '' : 's') + ' ago', pts: 0 });
    }

    if (bias && bias.swingClean){
      out.parts.push({ label: 'SWING clean (7/7 gates + EMA21 anchor)', pts: 1 });
      out.tally += 1;
    }
    if (bias && bias.g5 === true){
      out.parts.push({ label: 'G5 vol+wick commit (cryptogates)', pts: 1 });
      out.tally += 1;
    }
    if (bias && bias.g6 === true){
      out.parts.push({ label: 'G6 dynamic R:R ≥2.5 (cryptogates)', pts: 1 });
      out.tally += 1;
    }

    if (typeof W.detectRegime === 'function'){
      var regE = W.detectRegime(rows);
      if (regE && (regE.regime === 'trend' || regE.regime === 'weak_trend' || regE.regime === 'compression')){
        out.parts.push({ label: 'regime ' + regE.label + ' — continuation friendly', pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof W.volRegime === 'function'){
      var vr = W.volRegime(rows, 50);
      if (vr === 'COMPRESSING'){
        out.parts.push({ label: 'vol COMPRESSING — coil before expansion', pts: 1 });
        out.tally += 1;
      } else if (vr === 'NORMAL'){
        out.parts.push({ label: 'vol NORMAL — stable tape', pts: 0 });
      }
    }
    if (sig && sig.volumeCorrective === true){
      out.parts.push({ label: 'pullback volume corrective (not falling knife)', pts: 1 });
      out.tally += 1;
    }

    if (typeof W.hgStructureGate === 'function'){
      var sg = W.hgStructureGate(rows, dir);
      if (sg && sg.bos){
        out.parts.push({ label: sg.note || 'BOS confirms ' + dir.toUpperCase(), pts: 2 });
        out.tally += 2;
      } else if (sg && sg.veto){
        out.parts.push({ label: 'CHoCH against bias — skip', pts: -99 });
        out.veto = true;
        return out;
      }
    }

    if (typeof W.meanrevAssess === 'function'){
      var mr = W.meanrevAssess(rows);
      if (mr && mr.dir === dir){
        out.parts.push({ label: 'mean-reversion layer supports pullback direction', pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof W.findLiquidityPools === 'function'){
      W.findLiquidityPools(rows);
      var tgt = (typeof W.liquidityTargetText === 'function') ? W.liquidityTargetText(rows, dir) : null;
      if (tgt && tgt !== '—'){
        out.parts.push({ label: 'liquidity target — ' + tgt, pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof W.ttmSqueeze === 'function'){
      var sq = W.ttmSqueeze(rows);
      if (sq && sq.on){
        out.parts.push({ label: 'TTM squeeze ON', pts: 1 });
        out.tally += 1;
      }
    }

    if (item){
      if (isFinite(item.turnoverUsd) && item.turnoverUsd >= 5e6){
        out.parts.push({ label: 'liquidity $' + fmtF(item.turnoverUsd / 1e6, 1) + 'M 24h turnover', pts: 1 });
        out.tally += 1;
      }
      if (isFinite(item.fundingPct)){
        var f = item.fundingPct;
        var tail = (dir === 'long' && f < -0.02) || (dir === 'short' && f > 0.02);
        var crowd = (dir === 'long' && f > 0.05) || (dir === 'short' && f < -0.05);
        if (tail){
          out.parts.push({ label: 'funding tailwind ' + fmtF(f, 4) + '% (' + item.exchange + ')', pts: 1 });
          out.tally += 1;
        } else if (crowd){
          out.parts.push({ label: 'funding crowded against trade', pts: -1 });
          out.tally -= 1;
        }
      }
      if (item.alsoOn){
        out.parts.push({ label: 'listed on ' + String(item.alsoOn).split(' ')[0] + ' too', pts: 0 });
      }
    }

    if (candleSrc === 'binance-fallback') out.notes.push('candles via Binance twin');
    out.flowCvd = (item && item.taker) ? 'ok' : 'na';
    out.flowObi = (item && item.bookDepth) ? 'ok' : 'na';
    if (out.flowCvd === 'na' && out.flowObi === 'na'){
      out.parts.push({ label: 'CVD/OBI flow data unavailable — microstructure gates skipped', pts: 0 });
    }
    return out;
  }catch(e){ return out; }
}

function edgeFlowChip(en){
  en = en || {};
  if (en.flowCvd === 'ok' && en.flowObi === 'ok'){
    return '<span class="statuschip ok" title="Binance taker + L2 depth loaded">FLOW OK</span>';
  }
  if (en.flowCvd === 'ok' || en.flowObi === 'ok'){
    return '<span class="statuschip" title="Partial flow data — some microstructure gates skipped">FLOW PARTIAL</span>';
  }
  return '<span class="statuschip warn" title="No Binance taker/L2 — CVD and OBI vetoes not applied">FLOW N/A</span>';
}

function edgeAssess(rows, item, candleSrc){
  try{
    var sig = edgeSignal(rows);
    if (!sig) return null;
    if (isFinite(sig.barAge) && sig.barAge > 1) return null;
    var biasPre = edgeSwingBias(rows);
    if (biasPre && (biasPre.g5 !== true || biasPre.g6 !== true)) return null;
    var en = edgeEnrich(sig, rows, item, candleSrc);
    if (en.veto) return null;
    if (en.tally < MIN_TALLY) return null;
    var plan = edgePlan(sig);
    if (!plan) return null;
    return { sig: sig, enrich: en, plan: plan, tally: en.tally, parts: en.parts };
  }catch(e){ return null; }
}

function edgePlan(inp){
  try{
    if (!inp || (inp.dir !== 'long' && inp.dir !== 'short')) return null;
    var entry = +inp.entry, stop = +inp.stop, t1 = +inp.t1, t2 = +inp.t2;
    if (!(isFinite(entry) && isFinite(stop) && isFinite(t1))) return null;
    var risk = (inp.dir === 'long') ? (entry - stop) : (stop - entry);
    if (!(risk > 0)) return null;
    var rew1 = (inp.dir === 'long') ? (t1 - entry) : (entry - t1);
    if (!(rew1 > 0)) return null;
    var rew2 = (isFinite(t2))
      ? ((inp.dir === 'long') ? (t2 - entry) : (entry - t2))
      : NaN;
    return {
      dir: inp.dir, entry: entry, stop: stop, t1: t1, t2: isFinite(t2) ? t2 : null,
      risk: risk, riskPct: risk / entry * 100,
      rr1: rew1 / risk, rr2: isFinite(rew2) && rew2 > 0 ? rew2 / risk : null,
      maxLev: edgeMaxSafeLev(entry, stop),
      useLev: edgeUseLev(entry, stop)
    };
  }catch(e){ return null; }
}

function edgeBacktest(rows){
  try{
    var A = computeArrays(rows);
    if (!A || A.rows.length < DON_LEN + 40) return btZero();
    var rs = [], i = DON_LEN + 5;
    while (i <= A.rows.length - 2){
      var slice = A.rows.slice(0, i + 1);
      var bias = edgeSwingBias(slice);
      if (!bias){ i++; continue; }
      var s = trySetupAt(A, i, bias.dir);
      if (!s){ i++; continue; }
      var lastJ = Math.min(i + MAX_HOLD, A.rows.length - 1);
      var exitR = null, exitJ = lastJ;
      for (var j = i + 1; j <= lastJ; j++){
        var hj = A.highs[j], lj = A.lows[j];
        if (s.dir === 'long'){
          if (isFinite(lj) && lj <= s.stop){ exitR = -1; exitJ = j; break; }
          if (isFinite(hj) && hj >= s.t1){ exitR = (s.t1 - s.entry) / (s.entry - s.stop); exitJ = j; break; }
        } else {
          if (isFinite(hj) && hj >= s.stop){ exitR = -1; exitJ = j; break; }
          if (isFinite(lj) && lj <= s.t1){ exitR = (s.entry - s.t1) / (s.stop - s.entry); exitJ = j; break; }
        }
      }
      if (exitR === null && isFinite(A.closes[lastJ])){
        var c = A.closes[lastJ];
        exitR = (s.dir === 'long')
          ? (c - s.entry) / (s.entry - s.stop)
          : (s.entry - c) / (s.stop - s.entry);
      }
      if (isFinite(exitR)) rs.push(exitR);
      i = exitJ + 1;
    }
    if (!rs.length) return btZero();
    var wins = 0, grossWin = 0, grossLoss = 0, sum = 0, k;
    for (k = 0; k < rs.length; k++){
      sum += rs[k];
      if (rs[k] > 0){ wins++; grossWin += rs[k]; }
      else if (rs[k] < 0){ grossLoss += -rs[k]; }
    }
    return { n: rs.length, winPct: wins / rs.length * 100, avgR: sum / rs.length,
             pf: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0), expR: sum / rs.length };
  }catch(e){ return btZero(); }
}

function edgePlanHtml(p, sig){
  if (!p) return '';
  var head = (p.entryType === 'MARKET' || (sig && sig.entryType === 'MARKET'))
    ? 'MARKET @ <b>' + pxF(p.entry) + '</b>'
    : 'LIMIT @ <b>' + pxF(p.entry) + '</b>';
  if (sig && sig.anchor && isFinite(sig.anchor) && sig.anchor !== p.entry){
    head += ' <span style="color:var(--mut)">(anchor ' + pxF(sig.anchor) + ')</span>';
  }
  var levLine = ' · USE <b>' + p.useLev + 'x</b> (conservative · max safe ' + p.maxLev + 'x)';
  var t2 = (p.t2 !== null && isFinite(p.t2) && isFinite(p.rr2))
    ? ' · T2 ' + pxF(p.t2) + ' (' + fmtF(p.rr2, 1) + 'R)' : '';
  var guide = (sig && sig.entryGuidance)
    ? '<div class="note" style="margin-top:4px;font-size:11px">' + esc(sig.entryGuidance) + '</div>' : '';
  return head + ' · STOP <b>' + pxF(p.stop) + '</b>'
    + ' · T1 ' + pxF(p.t1) + ' (' + fmtF(p.rr1, 1) + 'R)' + t2
    + ' · risk ' + fmtF(p.riskPct, 2) + '%' + levLine
    + (typeof W.hgSafeLevChip === 'function' ? W.hgSafeLevChip(p.entry, p.stop) : '')
    + (typeof W.hgSessionChip === 'function' ? W.hgSessionChip() : '')
    + guide;
}

function venueLabel(item){
  if (!item) return '—';
  var ex = String(item.exchange || '').toLowerCase();
  if (ex === 'startrader'){
    var k = item.klass ? String(item.klass).toUpperCase() : 'CFD';
    return 'STARTRADER · ' + k + (item.label ? ' · ' + item.label : '');
  }
  var v = String(item.exchange || '').toUpperCase();
  if (v === 'COINDCX') v = 'CDCX';
  if (item.alsoOn) return v + ' · also ' + esc(String(item.alsoOn).split(',')[0]);
  return v;
}

function cardHTML(r){
  var sig = r.sig, bt = r.bt, p = r.plan, en = r.enrich || {};
  var turnover = (r.item && isFinite(r.item.turnoverUsd))
    ? '$' + fmtF(r.item.turnoverUsd / 1e6, 1) + 'M' : 'n/a';
  var edgeLbl = sig.edge + (sig.swept ? ' · SWEEP' : '');
  var record = bt.n >= MIN_RECORD
    ? 'SETUP RECORD: ' + bt.n + ' trades · ' + Math.round(bt.winPct) + '% win · avg ' + fmtSignedR(bt.avgR) + ' · PF ' + fmtPF(bt.pf)
    : (bt.n > 0 ? 'THIN RECORD: ' + bt.n + ' · avg ' + fmtSignedR(bt.avgR)
      : 'THIN RECORD: no historical trend-edge entries on these bars');
  var gates = (en.parts || []).filter(function(pt){ return pt.pts !== 0; }).slice(0, 8)
    .map(function(pt){
      var cssClass = (pt.pts > 0) ? 'gpip ok' : 'gpip warn';
      return '<span class="' + cssClass + '">' + esc(pt.label) + '</span>';
    }).join('');
  var planBlock = p
    ? '<div class="plan">' + edgePlanHtml(p, sig)
      + ' — SWING-aligned <b>' + esc(venueLabel(r.item)) + '</b>'
      + (r.candleSrc ? ' · ' + esc(r.candleSrc) : '')
      + '</div>' : '<div class="plan">levels unavailable</div>';
  var sym = r.item ? r.item.sym : r.sym;
  var btn = (p && typeof W.toTrade === 'function')
    ? '<button class="toTrade" onclick="toTrade(' + JSON.stringify(sym) + ',' + JSON.stringify(p.dir)
      + ',' + p.entry + ',' + p.stop + ',' + p.t1 + ')">SEND TO TRADE PLAN</button>' : '';
  var edgeKlass = (r.item && r.item.klass) || null;
  var edgeFund = (function(){
    var k = String(edgeKlass || '').toLowerCase();
    if (k === 'metal' || k === 'metals') return 'gold';
    if (k === 'fx' || k === 'index' || k === 'commodity') return 'macro';
    return 'swing';
  })();
  var bookBtn = (p && typeof W.bookBtnHTML === 'function')
    ? W.bookBtnHTML(sym, p.dir, p.entry, p.stop, p.t1, {
      scanner: 'edge',
      fund: edgeFund,
      strategy: 'edge', klass: edgeKlass, venue: (r.item && r.item.exchange) || 'delta',
      layers: ['EDGE', 'SWING'],
      t2: p.t2
    }) : '';
  return '<div class="card ' + sig.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(sym) + '</span>'
    + '<span class="dir"><span class="stamp pass">' + sig.dir.toUpperCase() + '</span>'
    + ' EDGE · tally ' + (r.tally || 0) + ' · exp ' + fmtSignedR(bt.expR) + ' '
    + edgeFreshnessChip(sig.barAge) + ' ' + edgeFlowChip(en) + '</span>'
    + (typeof W.hgBookStampHTML === 'function' ? W.hgBookStampHTML(sym, sig.dir, edgeFund) : '')
    + (typeof W.hgTripleStackChipHtml === 'function' ? W.hgTripleStackChipHtml(sym, sig.dir) : '')
    + '</div>'
    + '<div class="mini">'
    + '<span class="k">venue</span><span>' + venueLabel(r.item) + '</span>'
    + '<span class="k">strategy</span><span>' + esc(edgeLbl) + '</span>'
    + '<span class="k">regime</span><span>' + esc(sig.regime || 'n/a') + '</span>'
    + '<span class="k">%B</span><span>' + fmtF(sig.pctB, 2) + '</span>'
    + '<span class="k">turnover</span><span>' + turnover + '</span>'
    + '</div>'
    + '<div class="gates">' + gates
    + '<span class="gpip ok">SWING aligned</span>'
    + '<span class="gpip ok">R:R ' + fmtF(sig.rr, 2) + ' · USE ' + (p ? p.useLev : '—') + 'x</span></div>'
    + planBlock + '<div class="plan">' + record + '</div>' + btn + bookBtn + '</div>';
}

var __edge = { busy: false, ranOnce: false, run: null };
var __edgeScanSnap = null;

function edgeFreshnessChip(barAge){
  if (!isFinite(barAge)) return '';
  if (barAge === 0){
    return '<span class="statuschip ok" title="Trigger on the latest closed 4H bar">FRESH</span>';
  }
  if (barAge <= 2){
    return '<span class="statuschip" title="Trigger ' + barAge + ' closed 4H bar(s) ago">ACTIVE</span>';
  }
  return '<span class="statuschip warn" title="Trigger ' + barAge + ' closed 4H bars ago — consider stale">STALE</span>';
}

/** Distance from mark to EMA21 value zone — early watch copy for FORMING NOW rows. */
function edgeFormingApproach(rows, biasDir){
  try{
    if (!rows || rows.length < 55 || !biasDir) return null;
    var A = computeArrays(rows);
    if (!A) return null;
    var i = rows.length - 1;
    var c = A.closes[i], at = A.atr[i], e21 = A.e21[i];
    if (!isFinite(c) || !isFinite(at) || !(at > 0) || !isFinite(e21)) return null;
    var distAtr = biasDir === 'long' ? (c - e21) / at : (e21 - c) / at;
    var note;
    if (distAtr <= 0.35) note = 'at EMA21 value — wait 4H trigger bar';
    else if (distAtr <= 1.0) note = distAtr.toFixed(2) + '×ATR to EMA21 — approaching value';
    else note = distAtr.toFixed(2) + '×ATR from EMA21 — pullback needed';
    return { mark: c, level: e21, distAtr: distAtr, note: note };
  }catch(e){ return null; }
}

function publishEdgeScan(found, meta){
  meta = meta || {};
  try{
    var cands = [];
    for (var i = 0; i < (found || []).length; i++){
      var r = found[i], p = r.plan || {}, sig = r.sig || {};
      cands.push({
        sym: r.sym || (r.item && r.item.sym),
        dir: sig.dir || p.dir,
        entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2,
        rr: sig.rr, tally: r.tally, barAge: sig.barAge
      });
    }
    __edgeScanSnap = {
      at: Date.now(), cands: cands,
      stats: meta.stats || null,
      forming: meta.forming || [],
      funnel: meta.funnel || null
    };
  }catch(e){ __edgeScanSnap = { at: Date.now(), cands: [], stats: null, forming: [], funnel: null }; }
}

function edgeFormingHTML(forming){
  if (!forming || !forming.length) return '';
  var rows = forming.slice(0, 12).map(function(w){
    return '<div class="note" style="margin:4px 0;padding:6px 8px;border-left:3px solid var(--gold)">'
      + '<b>' + esc(w.sym || '—') + '</b> · ' + esc(String(w.dir || '').toUpperCase())
      + (w.regime ? ' · ' + esc(w.regime) : '')
      + ' · <span style="color:var(--mut)">' + esc(w.note || 'bias OK — waiting for trigger') + '</span></div>';
  }).join('');
  return '<details open style="margin:10px 0;padding:8px 12px;border:1px solid var(--line);border-radius:6px">'
    + '<summary><b>FORMING NOW</b> — SWING bias OK, no ticket yet (watch only)</summary>'
    + rows + '</details>';
}

function edgeFunnelHTML(stats, listLen){
  if (!stats || typeof W.hgFunnelPanelHTML !== 'function') return '';
  var rows = [
    { k: 'Universe scanned', v: String(listLen || '—') },
    { k: 'No SWING bias / volatile', v: String(stats.noBias || 0) },
    { k: 'Bias OK · no trigger', v: String(stats.noTrig || 0) },
    { k: 'Trigger · failed tally/trap', v: String(stats.tallyFail || 0) },
    { k: 'Thin history / errors', v: String(stats.skipped || 0) },
    { k: 'CLEAN EDGE tickets', v: String(stats.pass || 0) }
  ];
  return W.hgFunnelPanelHTML('WHY EMPTY — EDGE funnel', rows, 'edgeFunnelPanel');
}

/* Shared EDGE scan loop — same logic as the EDGE tab; callers supply universe
   rows + async candle fetcher (xuCandles, startraderCandles, etc.). */
function getBinanceSymFor(item) {
  if (!item) return null;
  var s = item.sym || '';
  if (s.includes('XAU') || s.includes('PAXG')) return 'PAXGUSDT';
  if (s.includes('B-')) s = s.split('_')[0].replace('B-', '');
  if (!s.endsWith('USDT')) s = s + 'USDT';
  return s;
}
async function edgeScanList(list, fetchCandles, hooks){
  hooks = hooks || {};
  var setProg = hooks.setProg || function(){};
  var setStat = hooks.setStat || function(){};
  var maxN = (hooks.maxUniverse > 0) ? hooks.maxUniverse : MAX_UNIVERSE;
  var minTurn = (hooks.minTurnover !== undefined) ? hooks.minTurnover : MIN_TURNOVER;
  var skipped = 0, noBias = 0, noTrig = 0, tallyFail = 0, t0 = Date.now();
  var found = [], forming = [];
  list = (list || []).filter(function(it){
    if (!it || !it.sym) return false;
    var t = it.turnoverUsd;
    if (t === null || t === undefined) return true;
    return t >= minTurn;
  });
  list.sort(function(a, b){ return ((b.turnoverUsd || 0) - (a.turnoverUsd || 0)); });
  if (maxN > 0) list = list.slice(0, maxN);
  if (!list.length) return { found: [], list: [], stats: { skipped: 0, noBias: 0, noTrig: 0, tallyFail: 0 } };

  for (var ci = 0; ci < list.length; ci += CHUNK){
    var chunk = list.slice(ci, ci + CHUNK);
    await Promise.all(chunk.map(async function(item, idx){
      var i = ci + idx;
      setProg((i + 1) / list.length);
      setStat('scanning ' + (i + 1) + '/' + list.length + ' · ' + item.sym + ' · '
        + Math.floor((Date.now() - t0) / 1000) + 's');
      try{
        var leg = await fetchCandles(item, TF, KL_LIMIT);
        var rows = leg && leg.rows;
        var src = (leg && leg.src) ? leg.src : (item.exchange || 'unknown');
        rows = edgeDropForming(rows, TF);
        if (!rows || rows.length < 210){ skipped++; return; }
        var bias = edgeSwingBias(rows);
        if (!bias){ noBias++; return; }
        if (!edgeSignal(rows)){
          noTrig++;
          if (forming.length < 16){
            var approach = edgeFormingApproach(rows, bias.dir);
            forming.push({
              sym: item.sym, dir: bias.dir,
              regime: bias.regime || (typeof W.hgTapeRegimeLabel === 'function' ? W.hgTapeRegimeLabel(rows) : ''),
              note: approach ? approach.note : 'SWING bias OK — waiting for Donchian/OTE/sweep trigger',
              mark: approach ? approach.mark : null,
              level: approach ? approach.level : null,
              distAtr: approach ? approach.distAtr : null
            });
          }
          return;
        }
        var binanceSym = getBinanceSymFor(item);
        if (typeof W.binanceTakerRatio === 'function') {
          try { item.taker = await W.binanceTakerRatio(binanceSym, '1h', 25); } catch(e){}
        }
        if (typeof W.binanceDepth === 'function') {
          try { item.bookDepth = await W.binanceDepth(binanceSym, 20); } catch(e){}
        }
        var assessed = edgeAssess(rows, item, src);
        if (!assessed){ tallyFail++; return; }
        var bt = edgeBacktest(rows);
        found.push({
          item: item, sym: item.sym, sig: assessed.sig, plan: assessed.plan,
          enrich: assessed.enrich, tally: assessed.tally, bt: bt, candleSrc: src
        });
      }catch(e){ skipped++; }
    }));
    await sleep(CHUNK_SLEEP_MS);
  }
  found.sort(function(a, b){
    return (b.tally - a.tally) || (b.bt.expR - a.bt.expR) || (b.sig.rr - a.sig.rr);
  });
  return {
    found: found, list: list, forming: forming,
    stats: { skipped: skipped, noBias: noBias, noTrig: noTrig, tallyFail: tallyFail, t0: t0, pass: found.length }
  };
}

function mount(el){
  if (!el) return;
  var missing = [];
  if (typeof W.xuUniverse !== 'function') missing.push('xuUniverse');
  if (typeof W.xuCandles !== 'function') missing.push('xuCandles');
  if (typeof W.donchian !== 'function') missing.push('donchian');

  el.innerHTML = '<div class="panel">'
    + '<h2>EDGE Scanner <span>SWING-aligned entries · Institutional Execution</span></h2>'
    + '<p class="note">Finds continuation setups that agree with SWING SCAN.'
    + ' Strategies: <b>LIMIT @ EMA21/EMA9/EMA50</b>, <b>sweep reclaim/fail</b>, <b>OTE 62–79%</b>.'
    + ' Confluence: structure BOS, vol regime, liquidity, TTM squeeze.'
    + ' <b>INSTITUTIONAL LAYER:</b> CVD/OBI vetoes when Binance flow legs load; SMT + yield traps always on. Cards show <b>FLOW OK / PARTIAL / N/A</b>.'
    + ' Min R:R ' + MIN_RR + ' · tally ≥ ' + MIN_TALLY + ' · <b>USE Nx</b> = 50% max-safe.</p>'
    + '<div class="row"><button class="btn" id="edgeRun">FIND EDGE SETUPS</button>'
    + '<span class="note" id="edgeStat">idle — SWING-aligned · top ' + MAX_UNIVERSE + '</span></div>'
    + '<div class="prog" id="edgeProg"><i></i></div>'
    + '<div id="edgeFunnel"></div>'
    + '<div id="edgeForming"></div>'
    + '<div class="cards" id="edgeCards"></div>'
    + '<div class="empty" id="edgeEmpty" style="display:none">No SWING-aligned edge entries right now — trend + value have not lined up.</div>'
    + '</div>';

  var btn = el.querySelector('#edgeRun'), statEl = el.querySelector('#edgeStat'),
      progEl = el.querySelector('#edgeProg'), cardsEl = el.querySelector('#edgeCards'),
      emptyEl = el.querySelector('#edgeEmpty'), funnelEl = el.querySelector('#edgeFunnel'),
      formingEl = el.querySelector('#edgeForming');
  if (!btn || !statEl) return;

  function setStat(t, warn){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; }
  function setProg(f){
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  if (missing.length){
    setStat('missing: ' + missing.join(', '), true);
    btn.disabled = true;
    return;
  }

  btn.addEventListener('click', function(){ runScan(); });

  async function runScan(){
    if (__edge.busy) return 'busy';
    __edge.busy = true;
    __edge.ranOnce = true;
    btn.disabled = true;
    cardsEl.innerHTML = '';
    emptyEl.style.display = 'none';
    if (funnelEl) funnelEl.innerHTML = '';
    if (formingEl) formingEl.innerHTML = '';
    setProg(0);
    try{
      var uni = await W.xuUniverse(true);
      var note = (typeof W.xuUniverseNote === 'function') ? W.xuUniverseNote() : null;
      if (!uni || !uni.length){
        publishEdgeScan([], { stats: { skipped: 0, noBias: 0, noTrig: 0, tallyFail: 0, pass: 0 } });
        setStat('universe empty — ' + (note || 'exchange fetch failed'), true);
        return;
      }
      var res = await edgeScanList(uni, function(item, tf, n){
        return W.xuCandles(item, tf, n).then(function(rows){
          return { rows: rows, src: W.xuCandles.lastSource || item.exchange };
        });
      }, { setProg: setProg, setStat: setStat });
      var found = res.found;
      var list = res.list;
      var st = res.stats;
      var forming = res.forming || [];
      publishEdgeScan(found, { stats: st, forming: forming });
      if (funnelEl) funnelEl.innerHTML = edgeFunnelHTML(st, list.length);
      if (formingEl) formingEl.innerHTML = edgeFormingHTML(forming);
      if (!found.length){
        emptyEl.style.display = 'block';
        setStat('done — 0 setups / ' + list.length + ' · ' + st.noBias + ' no SWING bias · '
          + st.noTrig + ' forming (no trigger) · ' + st.tallyFail + ' failed gates (inc. Traps) · ' + st.skipped + ' thin · '
          + Math.floor((Date.now() - st.t0) / 1000) + 's');
        return;
      }
      var longs = found.filter(function(x){ return x.sig.dir === 'long'; }).length;
      var shorts = found.length - longs;
      cardsEl.innerHTML = found.map(cardHTML).join('');
      setStat('done — ' + found.length + ' SWING-aligned (' + longs + 'L/' + shorts + 'S) · '
        + Math.floor((Date.now() - st.t0) / 1000) + 's');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) || e), true);
    }finally{
      setProg(null);
      btn.disabled = false;
      __edge.busy = false;
    }
    return 'refreshed';
  }

  __edge.run = runScan;
  setTimeout(function(){
    if (!__edge.ranOnce && typeof runScan === 'function') runScan();
  }, 500);
}

function edgeRefresh(){
  try{
    if (__edge.busy) return 'busy';
    if (!__edge.ranOnce || typeof __edge.run !== 'function') return 'skipped: not run yet';
    return __edge.run();
  }catch(e){ return 'refreshed'; }
}

function __edgeWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}
async function edgeWarm(opts){
  opts = (opts && typeof opts === 'object') ? opts : {};
  try{
    if (!opts.force && __edgeScanSnap && __edgeScanSnap.at
        && Date.now() - __edgeScanSnap.at < 14 * 60 * 1000) return 'fresh';
  }catch(e0){}
  if (__edge.busy) return 'busy';
  if (typeof W.xuUniverse !== 'function' || typeof W.xuCandles !== 'function') return 'unavailable';
  if (typeof __edge.run === 'function' && __edge.ranOnce){
    return await __edge.run();
  }
  var pane = document.createElement('div');
  pane.style.display = 'none';
  document.body.appendChild(pane);
  try{
    mount(pane);
    if (typeof __edge.run === 'function') return await __edge.run();
  }finally{
    try{ pane.remove(); }catch(e){}
  }
  return __edgeScanSnap ? 'warmed' : 'unavailable';
}

W.edgeSignal = edgeSignal;
W.edgeEnrich = edgeEnrich;
W.edgeFlowChip = edgeFlowChip;
W.edgeAssess = edgeAssess;
W.edgePlan = edgePlan;
W.edgeBacktest = edgeBacktest;
W.edgeMaxSafeLev = edgeMaxSafeLev;
W.edgeUseLev = edgeUseLev;
W.edgeSwingRead = edgeSwingRead;
W.edgeSwingBias = edgeSwingBias;
W.edgeEntryGuidance = edgeEntryGuidance;
W.edgeExactEntry = edgeExactEntry;
W.edgeOteZone = edgeOteZone;
W.edgeSweepQuality = edgeSweepQuality;
W.isCorrectivePullback = isCorrectivePullback;
W.edgeScanList = edgeScanList;
W.edgeCardHTML = cardHTML;
W.edgeDropForming = edgeDropForming;
W.edgeFreshnessChip = edgeFreshnessChip;
W.edgeFormingApproach = edgeFormingApproach;
W.edgeScan = function(){ try{ return __edgeScanSnap; }catch(e){ return null; } };
W.edgeWarm = edgeWarm;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'edge', label: 'EDGE', mount: mount, refresh: edgeRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'edge', label: 'EDGE', run: edgeWarm });

})();
