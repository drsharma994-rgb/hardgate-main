/* =========================================================================
HARDGATE — edge.js
EDGE tab v3: SWING-aligned entry scanner (Delta India + CoinDCX).

Finds high-quality continuation entries that AGREE with SWING SCAN:
  LONG  — 4H cascade bullish + HTF above EMA200 + pullback to value
          (EMA21 hold, sweep-reclaim, or aligned range-bottom touch)
  SHORT — 4H cascade bearish + HTF below EMA200 + rally into resistance
          (EMA21 reject, sweep-fail, or aligned range-top touch)

Technical: Donchian, %B, RSI, EMA stack, structure gate, liquidity pools,
TTM squeeze, vol regime, mean-reversion layer.
Fundamental: venue turnover, native funding (Delta), cross-venue listing.

Pure exports (never throw):
  edgeSignal, edgeEnrich, edgeAssess, edgePlan, edgeBacktest,
  edgeMaxSafeLev, edgeUseLev, edgeSwingRead, edgeSwingBias
========================================================================= */
(function(){
'use strict';

var MIN_TURNOVER  = 100000;
var MAX_UNIVERSE  = 120;
var KL_LIMIT      = 300;
var DON_LEN       = 55;
var BB_LEN        = 20;
var BB_MULT       = 2;
var ATR_LEN       = 14;
var EXT_LEN       = 8;
var STOP_ATR      = 1.5;
var PULL_ATR      = 0.4;
var MIN_RR        = 2.0;
var MIN_TALLY     = 3;
var SIGNAL_LOOKBACK = 6;
var MAX_HOLD      = 12;
var MIN_RECORD    = 3;
var CHUNK         = 4;
var CHUNK_SLEEP_MS = 150;
var USE_LEV_FRAC  = 0.5;
var TF            = '4h';

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
  var clean = new Array(n), closes = new Array(n), highs = new Array(n), lows = new Array(n);
  for (var i = 0; i < n; i++){
    var r = rows[i];
    clean[i] = r;
    closes[i] = (r && isFinite(r.c)) ? r.c : NaN;
    highs[i]  = (r && isFinite(r.h)) ? r.h : NaN;
    lows[i]   = (r && isFinite(r.l)) ? r.l : NaN;
  }
  var bb = bollinger(closes, BB_LEN, BB_MULT);
  var pb = new Array(n);
  for (var j = 0; j < n; j++){
    var u = bb.upper[j], l = bb.lower[j];
    if (isFinite(u) && isFinite(l) && u !== l) pb[j] = (closes[j] - l) / (u - l);
    else pb[j] = NaN;
  }
  return { rows: clean, closes: closes, highs: highs, lows: lows,
           dc: donchian(clean, DON_LEN), pb: pb,
           atr: atr(clean, ATR_LEN), sma20: sma(closes, 20), rsi14: rsi(closes, 14),
           e9: ema(closes, 9), e21: ema(closes, 21), e50: ema(closes, 50), e200: ema(closes, 200),
           loExt: lowest(lows, EXT_LEN), hiExt: highest(highs, EXT_LEN) };
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

/* Mandatory bias: SWING G1 + G2 HTF + not volatile */
function edgeSwingBias(rows){
  try{
    if (!rows || rows.length < 210) return null;
    var sw = edgeSwingRead(rows);
    if (!sw.dir) return null;
    if (sw.htf && sw.htf !== sw.dir) return null;
    var reg = (typeof detectRegime === 'function') ? detectRegime(rows) : null;
    if (reg && reg.regime === 'volatile') return null;
    return { dir: sw.dir, swing: sw, regime: reg ? reg.label : 'n/a' };
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

    if (biasDir === 'long'){
      if (!(isFinite(e50) && c > e50)) return null;
      if (isFinite(rsi) && (rsi > 68 || rsi < 32)) return null;

      /* 1) EMA21 pullback — primary trend entry */
      if (isFinite(e21) && l <= e21 + tol && c >= e21 - tol * 0.5){
        var hold = isFinite(closePos) && closePos >= 0.52 && isFinite(o) && c >= o;
        var pbOk = !isFinite(pb) || pb <= 0.55;
        if (hold && pbOk){
          var extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
          var stopL = Math.min(extremeL, l) - STOP_ATR * at;
          var pL = planFromRisk('long', c, stopL, isFinite(e9) ? e9 + at : c + 2 * (c - stopL),
            isFinite(dcHi) ? dcHi : null);
          if (pL) return Object.assign(pL, { edge: 'EMA21 PULLBACK', swept: false, extreme: extremeL });
        }
      }

      /* 2) Sweep + reclaim of local low (with-trend liquidity grab) */
      var priorLo = Infinity, k;
      for (k = Math.max(0, i - 12); k < i; k++){
        if (isFinite(A.lows[k]) && A.lows[k] < priorLo) priorLo = A.lows[k];
      }
      var sweptLo = isFinite(l) && isFinite(priorLo) && priorLo < Infinity && l < priorLo && c > priorLo;
      if (sweptLo && isFinite(closePos) && closePos >= 0.55){
        extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
        stopL = extremeL - STOP_ATR * at;
        pL = planFromRisk('long', c, stopL, isFinite(dcMid) ? dcMid : c + 2 * (c - stopL), dcHi);
        if (pL) return Object.assign(pL, { edge: 'SWEEP + RECLAIM', swept: true, extreme: extremeL });
      }

      /* 3) Aligned range-bottom touch (only in uptrend — at lower Donchian) */
      if (isFinite(dcLo) && l <= dcLo + tol && c > dcLo && isFinite(pb) && pb <= 0.35){
        if (isFinite(closePos) && closePos >= 0.5){
          extremeL = isFinite(A.loExt[i]) ? A.loExt[i] : l;
          stopL = extremeL - STOP_ATR * at;
          pL = planFromRisk('long', c, stopL, dcMid, dcHi);
          if (pL) return Object.assign(pL, { edge: 'RANGE BOTTOM (trend)', swept: false, extreme: extremeL });
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
          var extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
          var stopS = Math.max(extremeH, h) + STOP_ATR * at;
          var pS = planFromRisk('short', c, stopS, isFinite(e9) ? e9 - at : c - 2 * (stopS - c),
            isFinite(dcLo) ? dcLo : null);
          if (pS) return Object.assign(pS, { edge: 'EMA21 REJECTION', swept: false, extreme: extremeH });
        }
      }

      /* 2) Sweep + fail at local high */
      var priorHi = -Infinity;
      for (k = Math.max(0, i - 12); k < i; k++){
        if (isFinite(A.highs[k]) && A.highs[k] > priorHi) priorHi = A.highs[k];
      }
      var sweptHi = isFinite(h) && isFinite(priorHi) && priorHi > -Infinity && h > priorHi && c < priorHi;
      if (sweptHi && isFinite(closePos) && closePos <= 0.45){
        extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
        stopS = extremeH + STOP_ATR * at;
        pS = planFromRisk('short', c, stopS, isFinite(dcMid) ? dcMid : c - 2 * (stopS - c), dcLo);
        if (pS) return Object.assign(pS, { edge: 'SWEEP + FAIL', swept: true, extreme: extremeH });
      }

      /* 3) Aligned range-top rejection */
      if (isFinite(dcHi) && h >= dcHi - tol && c < dcHi && isFinite(pb) && pb >= 0.65){
        if (isFinite(closePos) && closePos <= 0.5){
          extremeH = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
          stopS = extremeH + STOP_ATR * at;
          pS = planFromRisk('short', c, stopS, dcMid, dcLo);
          if (pS) return Object.assign(pS, { edge: 'RANGE TOP (trend)', swept: false, extreme: extremeH });
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
      return s;
    }
    return null;
  }catch(e){ return null; }
}

function edgeEnrich(sig, rows, item, candleSrc){
  var out = { tally: 0, parts: [], notes: [], candleSrc: candleSrc || null, swingAligned: true };
  try{
    if (!sig || !rows) return out;
    var dir = sig.dir;
    var bias = edgeSwingBias(rows);
    if (!bias || bias.dir !== dir) return out;

    out.parts.push({ label: 'SWING 4H cascade + HTF agree — ' + dir.toUpperCase(), pts: 2 });
    out.tally += 2;
    out.parts.push({ label: sig.edge + (sig.swept ? ' · liquidity sweep' : ' · value entry'), pts: 2 });
    out.tally += 2;
    if (sig.barAge > 0){
      out.parts.push({ label: 'trigger ' + sig.barAge + ' bar' + (sig.barAge === 1 ? '' : 's') + ' ago', pts: 0 });
    }

    if (typeof detectRegime === 'function'){
      var regE = detectRegime(rows);
      if (regE && (regE.regime === 'trend' || regE.regime === 'weak_trend' || regE.regime === 'compression')){
        out.parts.push({ label: 'regime ' + regE.label + ' — continuation friendly', pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof volRegime === 'function'){
      var vr = volRegime(rows, 50);
      if (vr === 'COMPRESSING'){
        out.parts.push({ label: 'vol COMPRESSING — coil before expansion', pts: 1 });
        out.tally += 1;
      } else if (vr === 'NORMAL'){
        out.parts.push({ label: 'vol NORMAL — stable tape', pts: 0 });
      }
    }

    if (typeof hgStructureGate === 'function'){
      var sg = hgStructureGate(rows, dir);
      if (sg && sg.bos){
        out.parts.push({ label: sg.note || 'BOS confirms ' + dir.toUpperCase(), pts: 2 });
        out.tally += 2;
      } else if (sg && sg.veto){
        out.parts.push({ label: 'CHoCH against bias — skip', pts: -99 });
        out.veto = true;
        return out;
      }
    }

    if (typeof meanrevAssess === 'function'){
      var mr = meanrevAssess(rows);
      if (mr && mr.dir === dir){
        out.parts.push({ label: 'mean-reversion layer supports pullback direction', pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof findLiquidityPools === 'function'){
      findLiquidityPools(rows);
      var tgt = (typeof liquidityTargetText === 'function') ? liquidityTargetText(rows, dir) : null;
      if (tgt && tgt !== '—'){
        out.parts.push({ label: 'liquidity target — ' + tgt, pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof ttmSqueeze === 'function'){
      var sq = ttmSqueeze(rows);
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
    return out;
  }catch(e){ return out; }
}

function edgeAssess(rows, item, candleSrc){
  try{
    var sig = edgeSignal(rows);
    if (!sig) return null;
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

function edgePlanHtml(p){
  if (!p) return '';
  var levLine = ' · USE <b>' + p.useLev + 'x</b> (conservative · max safe ' + p.maxLev + 'x)';
  var t2 = (p.t2 !== null && isFinite(p.t2) && isFinite(p.rr2))
    ? ' · T2 ' + pxF(p.t2) + ' (' + fmtF(p.rr2, 1) + 'R)' : '';
  return 'ENTRY <b>' + pxF(p.entry) + '</b> · STOP <b>' + pxF(p.stop) + '</b>'
    + ' · T1 ' + pxF(p.t1) + ' (' + fmtF(p.rr1, 1) + 'R)' + t2
    + ' · risk ' + fmtF(p.riskPct, 2) + '%' + levLine
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(p.entry, p.stop) : '')
    + (typeof hgSessionChip === 'function' ? hgSessionChip() : '');
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
  var gates = (en.parts || []).filter(function(pt){ return pt.pts > 0; }).slice(0, 6)
    .map(function(pt){ return '<span class="gpip ok">' + esc(pt.label) + '</span>'; }).join('');
  var planBlock = p
    ? '<div class="plan">' + edgePlanHtml(p)
      + ' — SWING-aligned <b>' + esc(venueLabel(r.item)) + '</b>'
      + (r.candleSrc ? ' · ' + esc(r.candleSrc) : '')
      + '</div>' : '<div class="plan">levels unavailable</div>';
  var sym = r.item ? r.item.sym : r.sym;
  var btn = (p && typeof toTrade === 'function')
    ? '<button class="toTrade" onclick="toTrade(' + JSON.stringify(sym) + ',' + JSON.stringify(p.dir)
      + ',' + p.entry + ',' + p.stop + ',' + p.t1 + ')">SEND TO TRADE PLAN</button>' : '';
  var bookBtn = (p && typeof bookBtnHTML === 'function')
    ? bookBtnHTML(sym, p.dir, p.entry, p.stop, p.t1, {
      strategy: 'edge', klass: (r.item && r.item.klass) || null, venue: 'startrader',
      layers: ['EDGE', 'SWING']
    }) : '';
  return '<div class="card ' + sig.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(sym) + '</span>'
    + '<span class="dir"><span class="stamp pass">' + sig.dir.toUpperCase() + '</span>'
    + ' EDGE · tally ' + (r.tally || 0) + ' · exp ' + fmtSignedR(bt.expR) + '</span></div>'
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

function publishEdgeScan(found){
  try{
    var cands = [];
    for (var i = 0; i < (found || []).length; i++){
      var r = found[i], p = r.plan || {}, sig = r.sig || {};
      cands.push({
        sym: r.sym || (r.item && r.item.sym),
        dir: sig.dir || p.dir,
        entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2,
        rr: sig.rr, tally: r.tally
      });
    }
    __edgeScanSnap = { at: Date.now(), cands: cands };
  }catch(e){ __edgeScanSnap = { at: Date.now(), cands: [] }; }
}

/* Shared EDGE scan loop — same logic as the EDGE tab; callers supply universe
   rows + async candle fetcher (xuCandles, startraderCandles, etc.). */
async function edgeScanList(list, fetchCandles, hooks){
  hooks = hooks || {};
  var setProg = hooks.setProg || function(){};
  var setStat = hooks.setStat || function(){};
  var maxN = (hooks.maxUniverse > 0) ? hooks.maxUniverse : MAX_UNIVERSE;
  var minTurn = (hooks.minTurnover !== undefined) ? hooks.minTurnover : MIN_TURNOVER;
  var skipped = 0, noBias = 0, noTrig = 0, tallyFail = 0, t0 = Date.now();
  var found = [];
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
        if (!edgeSwingBias(rows)){ noBias++; return; }
        if (!edgeSignal(rows)){ noTrig++; return; }
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
  return { found: found, list: list, stats: { skipped: skipped, noBias: noBias, noTrig: noTrig, tallyFail: tallyFail, t0: t0 } };
}

function mount(el){
  if (!el) return;
  var missing = [];
  if (typeof xuUniverse !== 'function') missing.push('xuUniverse');
  if (typeof xuCandles !== 'function') missing.push('xuCandles');
  if (typeof donchian !== 'function') missing.push('donchian');

  el.innerHTML = '<div class="panel">'
    + '<h2>EDGE Scanner <span>SWING-aligned entries · Delta + CoinDCX</span></h2>'
    + '<p class="note">Only shows setups that <b>agree with SWING SCAN</b> (4H EMA cascade G1 + price vs EMA200 G2).'
    + ' Strategies: <b>EMA21 pullback</b>, <b>sweep+reclaim/fail</b>, <b>aligned range edge</b>.'
    + ' Confluence: structure BOS, vol regime, liquidity, TTM squeeze, funding, turnover.'
    + ' Min R:R ' + MIN_RR + ' · tally ≥ ' + MIN_TALLY + ' · <b>USE Nx</b> = 50% max-safe.</p>'
    + '<div class="row"><button class="btn" id="edgeRun">FIND EDGE SETUPS</button>'
    + '<span class="note" id="edgeStat">idle — SWING-aligned · top ' + MAX_UNIVERSE + '</span></div>'
    + '<div class="prog" id="edgeProg"><i></i></div>'
    + '<div class="cards" id="edgeCards"></div>'
    + '<div class="empty" id="edgeEmpty" style="display:none">No SWING-aligned edge entries right now — trend + value have not lined up.</div>'
    + '</div>';

  var btn = el.querySelector('#edgeRun'), statEl = el.querySelector('#edgeStat'),
      progEl = el.querySelector('#edgeProg'), cardsEl = el.querySelector('#edgeCards'),
      emptyEl = el.querySelector('#edgeEmpty');
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
    setProg(0);
    try{
      var uni = await xuUniverse(true);
      var note = (typeof xuUniverseNote === 'function') ? xuUniverseNote() : null;
      if (!uni || !uni.length){
        publishEdgeScan([]);
        setStat('universe empty — ' + (note || 'exchange fetch failed'), true);
        return;
      }
      var res = await edgeScanList(uni, function(item, tf, n){
        return xuCandles(item, tf, n).then(function(rows){
          return { rows: rows, src: xuCandles.lastSource || item.exchange };
        });
      }, { setProg: setProg, setStat: setStat });
      var found = res.found;
      var list = res.list;
      var st = res.stats;
      publishEdgeScan(found);
      if (!found.length){
        emptyEl.style.display = 'block';
        setStat('done — 0 setups / ' + list.length + ' · ' + st.noBias + ' no SWING bias · '
          + st.noTrig + ' no trigger · ' + st.tallyFail + ' below tally · ' + st.skipped + ' thin · '
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
  if (typeof xuUniverse !== 'function' || typeof xuCandles !== 'function') return 'unavailable';
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

var W = (typeof window !== 'undefined') ? window : this;
W.edgeSignal = edgeSignal;
W.edgeEnrich = edgeEnrich;
W.edgeAssess = edgeAssess;
W.edgePlan = edgePlan;
W.edgeBacktest = edgeBacktest;
W.edgeMaxSafeLev = edgeMaxSafeLev;
W.edgeUseLev = edgeUseLev;
W.edgeSwingRead = edgeSwingRead;
W.edgeSwingBias = edgeSwingBias;
W.edgeScanList = edgeScanList;
W.edgeCardHTML = cardHTML;
W.edgeDropForming = edgeDropForming;
W.edgeScan = function(){ try{ return __edgeScanSnap; }catch(e){ return null; } };
W.edgeWarm = edgeWarm;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'edge', label: 'EDGE', mount: mount, refresh: edgeRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'edge', label: 'EDGE', run: edgeWarm });

})();
