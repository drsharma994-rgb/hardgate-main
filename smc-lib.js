/* HARDGATE — smc-lib.js — Smart Money Concepts, faithful browser port.

   Port of smartmoneyconcepts v0.0.27 (github.com/joshyattridge/smart-money-concepts,
   MIT — Copyright (c) 2020 NeuralNine). Same eight functions, same column names,
   same semantics, verified column-for-column against the library's own EURUSD
   golden fixtures in tests/test-smc-lib.mjs. Where the reference stores levels as
   float32, Math.fround mirrors it so break/mitigation ties resolve identically.

   Input is HARDGATE bars {t,o,h,l,c,v}. Output columns are arrays parallel to the
   input with null where the reference has NaN. window.hgSmc.context() is the
   HARDGATE-side digest that setups consume. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
var f32 = Math.fround;
var DAY_MS = 86400000;

function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
function col(rows, k){
  var out = new Array(rows.length);
  for (var i = 0; i < rows.length; i++){ var r = rows[i]; out[i] = (r && typeof r === 'object') ? num(r[k]) : NaN; }
  return out;
}
function inCol(a, n){
  var out = new Array(n);
  for (var i = 0; i < n; i++) out[i] = (a && a[i] != null) ? num(a[i]) : NaN;
  return out;
}
function nanArr(n){ var a = new Array(n); for (var i = 0; i < n; i++) a[i] = NaN; return a; }
function zeros(n){ var a = new Array(n); for (var i = 0; i < n; i++) a[i] = 0; return a; }
function falses(n){ var a = new Array(n); for (var i = 0; i < n; i++) a[i] = false; return a; }
function outCol(a){ var o = new Array(a.length); for (var i = 0; i < a.length; i++) o[i] = (typeof a[i] === 'number' && isNaN(a[i])) ? null : a[i]; return o; }
function bars(rows){ return Array.isArray(rows) ? rows : []; }
function lowerCount(sorted, x){
  var lo = 0, hi = sorted.length;
  while (lo < hi){ var mid = (lo + hi) >> 1; if (sorted[mid] < x) lo = mid + 1; else hi = mid; }
  return lo;
}
function tMs(t){ t = num(t); if (isNaN(t)) return NaN; return t < 1e12 ? t * 1000 : t; }

/* Python round(x, 1): exact-decimal rounding, ties to even. toFixed already rounds
   on the exact binary value; only true ties (x*20 an odd integer) need the even rule. */
function pyRound1(x){
  if (!isFinite(x)) return x;
  var t = x * 20;
  if (Number.isInteger(t) && Math.abs(t % 2) === 1){
    var lo = Math.floor(x * 10);
    return ((lo % 2) === 0 ? lo : lo + 1) / 10;
  }
  return parseFloat(x.toFixed(1));
}

/* ---------------------------------------------------------------- fvg */
function fvg(rows, opts){
  rows = bars(rows); opts = opts || {};
  var n = rows.length, o = col(rows, 'o'), h = col(rows, 'h'), l = col(rows, 'l'), c = col(rows, 'c');
  var FVG = nanArr(n), top = nanArr(n), bottom = nanArr(n), mit = nanArr(n), i, k;
  for (i = 0; i < n; i++){
    var bull = c[i] > o[i], bear = c[i] < o[i];
    var prevH = i > 0 ? h[i - 1] : NaN, prevL = i > 0 ? l[i - 1] : NaN;
    var nextL = i + 1 < n ? l[i + 1] : NaN, nextH = i + 1 < n ? h[i + 1] : NaN;
    if ((prevH < nextL && bull) || (prevL > nextH && bear)){
      FVG[i] = bull ? 1 : -1;
      top[i] = bull ? nextL : prevL;
      bottom[i] = bull ? prevH : nextH;
    }
  }
  if (opts.joinConsecutive){
    for (i = 0; i < n - 1; i++){
      if (!isNaN(FVG[i]) && FVG[i] === FVG[i + 1]){
        top[i + 1] = Math.max(top[i], top[i + 1]);
        bottom[i + 1] = Math.min(bottom[i], bottom[i + 1]);
        FVG[i] = NaN; top[i] = NaN; bottom[i] = NaN;
      }
    }
  }
  for (i = 0; i < n; i++){
    if (isNaN(FVG[i])) continue;
    var j = 0;
    for (k = i + 2; k < n; k++){
      if (FVG[i] === 1 ? (l[k] <= top[i]) : (h[k] >= bottom[i])){ j = k; break; }
    }
    mit[i] = j;
  }
  return { FVG: outCol(FVG), Top: outCol(top), Bottom: outCol(bottom), MitigatedIndex: outCol(mit) };
}

/* ---------------------------------------------------- swing_highs_lows */
function swingHighsLows(rows, opts){
  rows = bars(rows);
  var sl = (typeof opts === 'number') ? opts : ((opts && opts.swingLength != null) ? +opts.swingLength : 50);
  sl = Math.max(1, Math.floor(sl));
  var n = rows.length, h = col(rows, 'h'), l = col(rows, 'l');
  var L = sl * 2, shl = nanArr(n), i, k, p;
  /* reference: high == high.shift(-sl).rolling(2*sl).max() — window is [i-sl+1, i+sl]
     and rolling's full-window rule also requires i >= 2*sl-1 */
  for (i = 0; i < n; i++){
    if (i < L - 1 || i + sl > n - 1) continue;
    var mx = -Infinity, mn = Infinity, nanH = false, nanL = false;
    for (k = i - sl + 1; k <= i + sl; k++){
      if (isNaN(h[k])) nanH = true; else if (h[k] > mx) mx = h[k];
      if (isNaN(l[k])) nanL = true; else if (l[k] < mn) mn = l[k];
    }
    if (!nanH && h[i] === mx) shl[i] = 1;
    else if (!nanL && l[i] === mn) shl[i] = -1;
  }
  while (true){
    var pos = [];
    for (i = 0; i < n; i++) if (!isNaN(shl[i])) pos.push(i);
    if (pos.length < 2) break;
    var rem = falses(pos.length), any = false;
    for (p = 0; p < pos.length - 1; p++){
      var cur = shl[pos[p]], nxt = shl[pos[p + 1]];
      if (cur === 1 && nxt === 1){
        if (h[pos[p]] < h[pos[p + 1]]) rem[p] = true;
        else if (h[pos[p]] >= h[pos[p + 1]]) rem[p + 1] = true;
      }
      if (cur === -1 && nxt === -1){
        if (l[pos[p]] > l[pos[p + 1]]) rem[p] = true;
        else if (l[pos[p]] <= l[pos[p + 1]]) rem[p + 1] = true;
      }
    }
    for (p = 0; p < pos.length; p++) if (rem[p]){ shl[pos[p]] = NaN; any = true; }
    if (!any) break;
  }
  var pos2 = [];
  for (i = 0; i < n; i++) if (!isNaN(shl[i])) pos2.push(i);
  if (pos2.length){
    var first = pos2[0], last = pos2[pos2.length - 1];
    if (shl[first] === 1) shl[0] = -1;
    if (shl[first] === -1) shl[0] = 1;
    if (shl[last] === -1) shl[n - 1] = 1;
    if (shl[last] === 1) shl[n - 1] = -1;
  }
  var level = nanArr(n);
  for (i = 0; i < n; i++) if (!isNaN(shl[i])) level[i] = shl[i] === 1 ? h[i] : l[i];
  return { HighLow: outCol(shl), Level: outCol(level) };
}

/* ------------------------------------------------------------ bos_choch */
function bosChoch(rows, shl, opts){
  rows = bars(rows); shl = shl || {}; opts = opts || {};
  var closeBreak = opts.closeBreak !== false;
  var n = rows.length, h = col(rows, 'h'), l = col(rows, 'l'), c = col(rows, 'c');
  var HL = inCol(shl.HighLow, n), LV = inCol(shl.Level, n);
  var levelOrder = [], hlOrder = [], lastPositions = [];
  var bos = zeros(n), choch = zeros(n), level = zeros(n), i, k;
  for (i = 0; i < n; i++){
    if (isNaN(HL[i])) continue;
    levelOrder.push(LV[i]); hlOrder.push(HL[i]);
    var m = levelOrder.length;
    if (m >= 4){
      var p = lastPositions[lastPositions.length - 2];
      var L4 = levelOrder[m - 4], L3 = levelOrder[m - 3], L2 = levelOrder[m - 2], L1 = levelOrder[m - 1];
      var pat = hlOrder[m - 4] + ',' + hlOrder[m - 3] + ',' + hlOrder[m - 2] + ',' + hlOrder[m - 1];
      var bullPat = pat === '-1,1,-1,1', bearPat = pat === '1,-1,1,-1';
      bos[p] = (bullPat && L4 < L2 && L2 < L3 && L3 < L1) ? 1 : 0;
      level[p] = bos[p] !== 0 ? f32(L3) : 0;
      bos[p] = (bearPat && L4 > L2 && L2 > L3 && L3 > L1) ? -1 : bos[p];
      level[p] = bos[p] !== 0 ? f32(L3) : 0;
      choch[p] = (bullPat && L1 > L3 && L3 > L4 && L4 > L2) ? 1 : 0;
      level[p] = choch[p] !== 0 ? f32(L3) : level[p];
      choch[p] = (bearPat && L1 < L3 && L3 < L4 && L4 < L2) ? -1 : choch[p];
      level[p] = choch[p] !== 0 ? f32(L3) : level[p];
    }
    lastPositions.push(i);
  }
  var broken = zeros(n), idxs = [], a, b;
  for (i = 0; i < n; i++) if (bos[i] !== 0 || choch[i] !== 0) idxs.push(i);
  for (a = 0; a < idxs.length; a++){
    i = idxs[a];
    var j = 0;
    if (bos[i] === 1 || choch[i] === 1){
      for (k = i + 2; k < n; k++){ if ((closeBreak ? c[k] : h[k]) > level[i]){ j = k; break; } }
    } else if (bos[i] === -1 || choch[i] === -1){
      for (k = i + 2; k < n; k++){ if ((closeBreak ? c[k] : l[k]) < level[i]){ j = k; break; } }
    }
    if (j){
      broken[i] = j;
      for (b = 0; b < a; b++){
        var q = idxs[b];
        if ((bos[q] !== 0 || choch[q] !== 0) && broken[q] >= j){ bos[q] = 0; choch[q] = 0; level[q] = 0; }
      }
    }
  }
  for (a = 0; a < idxs.length; a++){
    i = idxs[a];
    if ((bos[i] !== 0 || choch[i] !== 0) && broken[i] === 0){ bos[i] = 0; choch[i] = 0; level[i] = 0; }
  }
  var BOS = nanArr(n), CH = nanArr(n), LEV = nanArr(n), BR = nanArr(n);
  for (i = 0; i < n; i++){
    if (bos[i] !== 0) BOS[i] = bos[i];
    if (choch[i] !== 0) CH[i] = choch[i];
    if (level[i] !== 0) LEV[i] = level[i];
    if (broken[i] !== 0) BR[i] = broken[i];
  }
  return { BOS: outCol(BOS), CHOCH: outCol(CH), Level: outCol(LEV), BrokenIndex: outCol(BR) };
}

/* ------------------------------------------------------------------- ob */
function ob(rows, shl, opts){
  rows = bars(rows); shl = shl || {}; opts = opts || {};
  var closeMit = !!opts.closeMitigation;
  var n = rows.length, o = col(rows, 'o'), h = col(rows, 'h'), l = col(rows, 'l'), c = col(rows, 'c'), v = col(rows, 'v');
  var i, k, s, idx;
  for (i = 0; i < n; i++) if (isNaN(v[i])) v[i] = 0;
  var HL = inCol(shl.HighLow, n);
  var crossed = falses(n), obA = zeros(n), top = zeros(n), bottom = zeros(n), obVol = zeros(n), lowVol = zeros(n), highVol = zeros(n), pct = zeros(n), mit = zeros(n), breaker = falses(n);
  var shi = [], sli = [];
  for (i = 0; i < n; i++){ if (HL[i] === 1) shi.push(i); else if (HL[i] === -1) sli.push(i); }
  function reset(x){ obA[x] = 0; top[x] = 0; bottom[x] = 0; obVol[x] = 0; lowVol[x] = 0; highVol[x] = 0; mit[x] = 0; pct[x] = 0; }
  function drop(list, x){ var at = list.indexOf(x); if (at >= 0) list.splice(at, 1); }
  function stamp(obIndex, dir, obTop, obBtm, ci){
    obA[obIndex] = dir; top[obIndex] = f32(obTop); bottom[obIndex] = f32(obBtm);
    var vc = v[ci], vp1 = ci >= 1 ? v[ci - 1] : 0, vp2 = ci >= 2 ? v[ci - 2] : 0;
    obVol[obIndex] = f32(vc + vp1 + vp2);
    if (dir === 1){ lowVol[obIndex] = f32(vp2); highVol[obIndex] = f32(vc + vp1); }
    else { lowVol[obIndex] = f32(vc + vp1); highVol[obIndex] = f32(vp2); }
    var maxVol = Math.max(highVol[obIndex], lowVol[obIndex]);
    pct[obIndex] = f32(maxVol !== 0 ? (Math.min(highVol[obIndex], lowVol[obIndex]) / maxVol * 100) : 100);
  }
  var active = [], snap;
  for (i = 0; i < n; i++){
    snap = active.slice();
    for (s = 0; s < snap.length; s++){
      idx = snap[s];
      if (breaker[idx]){
        if (h[i] > top[idx]){ reset(idx); drop(active, idx); }
      } else if ((!closeMit && l[i] < bottom[idx]) || (closeMit && Math.min(o[i], c[i]) < bottom[idx])){
        breaker[idx] = true; mit[idx] = i - 1;
      }
    }
    var posH = lowerCount(shi, i);
    if (posH > 0){
      var lt = shi[posH - 1];
      if (c[i] > h[lt] && !crossed[lt]){
        crossed[lt] = true;
        var di = i - 1, obBtm = h[di], obTop = l[di], obIndex = di;
        if (i - lt > 1){
          var minVal = Infinity, cand = -1;
          for (k = lt + 1; k < i; k++) if (l[k] < minVal) minVal = l[k];
          for (k = lt + 1; k < i; k++) if (l[k] === minVal) cand = k;
          if (cand >= 0){ obBtm = l[cand]; obTop = h[cand]; obIndex = cand; }
        }
        stamp(obIndex, 1, obTop, obBtm, i);
        active.push(obIndex);
      }
    }
  }
  active = [];
  for (i = 0; i < n; i++){
    snap = active.slice();
    for (s = 0; s < snap.length; s++){
      idx = snap[s];
      if (breaker[idx]){
        if (l[i] < bottom[idx]){ reset(idx); drop(active, idx); }
      } else if ((!closeMit && h[i] > top[idx]) || (closeMit && Math.max(o[i], c[i]) > top[idx])){
        breaker[idx] = true; mit[idx] = i;
      }
    }
    var posL = lowerCount(sli, i);
    if (posL > 0){
      var lb = sli[posL - 1];
      if (c[i] < l[lb] && !crossed[lb]){
        crossed[lb] = true;
        var di2 = i - 1, obTop2 = h[di2], obBtm2 = l[di2], obIndex2 = di2;
        if (i - lb > 1){
          var maxVal = -Infinity, cand2 = -1;
          for (k = lb + 1; k < i; k++) if (h[k] > maxVal) maxVal = h[k];
          for (k = lb + 1; k < i; k++) if (h[k] === maxVal) cand2 = k;
          if (cand2 >= 0){ obTop2 = h[cand2]; obBtm2 = l[cand2]; obIndex2 = cand2; }
        }
        stamp(obIndex2, -1, obTop2, obBtm2, i);
        active.push(obIndex2);
      }
    }
  }
  var OB = nanArr(n), T = nanArr(n), B = nanArr(n), V = nanArr(n), M = nanArr(n), P = nanArr(n);
  for (i = 0; i < n; i++){
    if (obA[i] === 0) continue;
    OB[i] = obA[i]; T[i] = top[i]; B[i] = bottom[i]; V[i] = obVol[i]; M[i] = mit[i]; P[i] = pct[i];
  }
  return { OB: outCol(OB), Top: outCol(T), Bottom: outCol(B), OBVolume: outCol(V), MitigatedIndex: outCol(M), Percentage: outCol(P) };
}

/* ------------------------------------------------------------ liquidity */
function liquidity(rows, shl, opts){
  rows = bars(rows); shl = shl || {}; opts = opts || {};
  var rp = (opts.rangePercent != null) ? +opts.rangePercent : 0.01;
  var n = rows.length, h = col(rows, 'h'), l = col(rows, 'l');
  var HL = inCol(shl.HighLow, n), LV = inCol(shl.Level, n), i, k, a, b, j;
  var maxH = -Infinity, minL = Infinity;
  for (i = 0; i < n; i++){ if (h[i] > maxH) maxH = h[i]; if (l[i] < minL) minL = l[i]; }
  var pipRange = (maxH - minL) * rp;
  var liq = nanArr(n), lvl = nanArr(n), end = nanArr(n), swept = nanArr(n);
  function pass(sign){
    var cands = [];
    for (i = 0; i < n; i++) if (HL[i] === sign) cands.push(i);
    for (a = 0; a < cands.length; a++){
      i = cands[a];
      if (HL[i] !== sign) continue;
      var base = LV[i], rlo = base - pipRange, rhi = base + pipRange, group = [base], gend = i, sw = 0;
      for (k = i + 1; k < n; k++){
        if (sign === 1 ? (h[k] >= rhi) : (l[k] <= rlo)){ sw = k; break; }
      }
      for (b = 0; b < cands.length; b++){
        j = cands[b];
        if (j <= i) continue;
        if (sw && j >= sw) break;
        if (HL[j] === sign && rlo <= LV[j] && LV[j] <= rhi){ group.push(LV[j]); gend = j; HL[j] = 0; }
      }
      if (group.length > 1){
        var sum = 0;
        for (k = 0; k < group.length; k++) sum += group[k];
        liq[i] = sign; lvl[i] = f32(sum / group.length); end[i] = gend; swept[i] = sw;
      }
    }
  }
  pass(1);
  pass(-1);
  return { Liquidity: outCol(liq), Level: outCol(lvl), End: outCol(end), Swept: outCol(swept) };
}

/* ---------------------------------------------------- previous_high_low */
function parseTf(tf){
  var m = String(tf || '1D').trim().match(/^(\d*)\s*([A-Za-z]+)/);
  if (!m) return null;
  var k = m[1] ? +m[1] : 1, u = m[2];
  if (/^(min|T|m)$/.test(u)) return { kind: 'tick', ms: k * 60000 };
  if (/^(h|H)$/.test(u)) return { kind: 'tick', ms: k * 3600000 };
  if (/^(d|D)$/.test(u)) return { kind: 'tick', ms: k * DAY_MS };
  if (/^(w|W)/.test(u)) return { kind: 'week' };
  if (/^(M|ME)$/.test(u)) return { kind: 'month' };
  return null;
}
/* pandas resample labels: Tick rules bin left-closed from the first day's midnight;
   W and M are right-closed with right labels (Sunday 00:00 / month-end 00:00). */
function binLabel(t, tf, origin){
  if (tf.kind === 'tick') return origin + Math.floor((t - origin) / tf.ms) * tf.ms;
  var dayStart = Math.floor(t / DAY_MS) * DAY_MS;
  if (tf.kind === 'week'){
    var dow = new Date(dayStart).getUTCDay();
    var ahead = (7 - dow) % 7;
    if (ahead === 0 && t !== dayStart) ahead = 7;
    return dayStart + ahead * DAY_MS;
  }
  var d = new Date(dayStart), y = d.getUTCFullYear(), mo = d.getUTCMonth();
  var monthEnd = Date.UTC(y, mo + 1, 0);
  if (t <= monthEnd) return monthEnd;
  return Date.UTC(y, mo + 2, 0);
}
function previousHighLow(rows, opts){
  rows = bars(rows);
  var tfStr = (typeof opts === 'string') ? opts : ((opts && opts.timeFrame) || '1D');
  var tf = parseTf(tfStr);
  var n = rows.length, h = col(rows, 'h'), l = col(rows, 'l'), i;
  var PH = nanArr(n), PL = nanArr(n), BH = zeros(n), BL = zeros(n);
  var empty = { PreviousHigh: outCol(PH), PreviousLow: outCol(PL), BrokenHigh: BH, BrokenLow: BL };
  if (!tf || !n) return empty;
  var t = new Array(n);
  for (i = 0; i < n; i++) t[i] = tMs(rows[i] && rows[i].t);
  var origin = Math.floor(t[0] / DAY_MS) * DAY_MS;
  var byLabel = {}, labels = [];
  for (i = 0; i < n; i++){
    if (isNaN(t[i])) continue;
    var lb = binLabel(t[i], tf, origin);
    var bin = byLabel[lb];
    if (!bin){ bin = byLabel[lb] = { hi: -Infinity, lo: Infinity, any: false }; labels.push(lb); }
    if (!isNaN(h[i]) && h[i] > bin.hi) bin.hi = h[i];
    if (!isNaN(l[i]) && l[i] < bin.lo) bin.lo = l[i];
    if (!isNaN(h[i]) && !isNaN(l[i])) bin.any = true;
  }
  labels.sort(function(a, b){ return a - b; });
  var RT = [], RH = [], RL = [];
  for (i = 0; i < labels.length; i++){
    var bn = byLabel[labels[i]];
    if (!bn.any) continue;
    RT.push(labels[i]); RH.push(bn.hi); RL.push(bn.lo);
  }
  if (RT.length < 2) return empty;
  var prevIdx = new Array(n), valid = falses(n);
  for (i = 0; i < n; i++){
    var before = lowerCount(RT, t[i]);
    prevIdx[i] = before - 2;
    valid[i] = before > 1;
    if (valid[i]){ PH[i] = f32(RH[prevIdx[i]]); PL[i] = f32(RL[prevIdx[i]]); }
  }
  var runHi = NaN, runLo = NaN;
  for (i = 0; i < n; i++){
    if (i === 0 || prevIdx[i] !== prevIdx[i - 1]){ runHi = NaN; runLo = NaN; }
    if (!isNaN(h[i]) && !(runHi >= h[i])) runHi = h[i];
    if (!isNaN(l[i]) && !(runLo <= l[i])) runLo = l[i];
    if (valid[i]){
      BH[i] = (runHi > PH[i]) ? 1 : 0;
      BL[i] = (runLo < PL[i]) ? 1 : 0;
    }
  }
  return { PreviousHigh: outCol(PH), PreviousLow: outCol(PL), BrokenHigh: BH, BrokenLow: BL };
}

/* ------------------------------------------------------------- sessions */
var SESSIONS = {
  'Sydney': { start: '21:00', end: '06:00' },
  'Tokyo': { start: '00:00', end: '09:00' },
  'London': { start: '07:00', end: '16:00' },
  'New York': { start: '13:00', end: '22:00' },
  'Asian kill zone': { start: '00:00', end: '04:00' },
  'London open kill zone': { start: '6:00', end: '9:00' },
  'New York kill zone': { start: '11:00', end: '14:00' },
  'london close kill zone': { start: '14:00', end: '16:00' }
};
function hm(s){
  var m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return (+m[1]) * 60 + (+m[2]);
}
function minuteOfDay(t){ return Math.floor(t / 60000) % 1440; }
function sessionWindow(session, startTime, endTime){
  var def = (session === 'Custom') ? { start: startTime, end: endTime } : SESSIONS[session];
  if (!def) throw new Error('unknown session ' + session);
  var s = hm(def.start), e = hm(def.end);
  if (isNaN(s) || isNaN(e)) throw new Error('Custom session requires a start and end time');
  return { s: s, e: e };
}
function inWindow(m, w){
  return (w.s < w.e && w.s <= m && m <= w.e) || (w.s >= w.e && (w.s <= m || m <= w.e));
}
function sessions(rows, opts){
  rows = bars(rows);
  if (typeof opts === 'string') opts = { session: opts };
  opts = opts || {};
  var w = sessionWindow(opts.session, opts.startTime, opts.endTime);
  var n = rows.length, h = col(rows, 'h'), l = col(rows, 'l');
  var active = zeros(n), hi = zeros(n), lo = zeros(n), i;
  for (i = 0; i < n; i++){
    var t = tMs(rows[i] && rows[i].t);
    if (isNaN(t) || !inWindow(minuteOfDay(t), w)) continue;
    active[i] = 1;
    hi[i] = f32(Math.max(h[i], i > 0 ? hi[i - 1] : 0));
    lo[i] = f32(Math.min(l[i], (i > 0 && lo[i - 1] !== 0) ? lo[i - 1] : Infinity));
  }
  return { Active: active, High: outCol(hi), Low: outCol(lo) };
}

/* --------------------------------------------------------- retracements */
function retracements(rows, shl){
  rows = bars(rows); shl = shl || {};
  var n = rows.length, h = col(rows, 'h'), l = col(rows, 'l');
  var HL = inCol(shl.HighLow, n), LV = inCol(shl.Level, n);
  var dir = zeros(n), cur = zeros(n), deep = zeros(n), i;
  if (!n) return { Direction: dir, 'CurrentRetracement%': cur, 'DeepestRetracement%': deep };
  var top = 0, bottom = 0;
  for (i = 0; i < n; i++){
    if (HL[i] === 1){ dir[i] = 1; top = LV[i]; }
    else if (HL[i] === -1){ dir[i] = -1; bottom = LV[i]; }
    else dir[i] = i > 0 ? dir[i - 1] : 0;
    var prevDir = dir[(i - 1 + n) % n];
    if (prevDir === 1){
      var d1 = top - bottom;
      cur[i] = pyRound1(d1 !== 0 ? 100 - (((l[i] - bottom) / d1) * 100) : 0);
      deep[i] = Math.max((i > 0 && dir[i - 1] === 1) ? deep[i - 1] : 0, cur[i]);
    }
    if (dir[i] === -1){
      var d2 = bottom - top;
      cur[i] = pyRound1(d2 !== 0 ? 100 - ((h[i] - top) / d2) * 100 : 0);
      deep[i] = Math.max((i > 0 && dir[i - 1] === -1) ? deep[i - 1] : 0, cur[i]);
    }
  }
  var dirR = new Array(n), curR = new Array(n), deepR = new Array(n);
  for (i = 0; i < n; i++){ var src = (i - 1 + n) % n; dirR[i] = dir[src]; curR[i] = cur[src]; deepR[i] = deep[src]; }
  var changes = 0;
  for (i = 0; i < n; i++){
    if (i + 1 === n) break;
    if (dirR[i] !== dirR[i + 1]) changes++;
    dirR[i] = 0; curR[i] = 0; deepR[i] = 0;
    if (changes === 3){ dirR[i + 1] = 0; curR[i + 1] = 0; deepR[i + 1] = 0; break; }
  }
  return { Direction: dirR, 'CurrentRetracement%': outCol(curR), 'DeepestRetracement%': outCol(deepR) };
}

/* ------------------------------------------------- HARDGATE setup digest */
function context(rows, opts){
  rows = bars(rows); opts = opts || {};
  var n = rows.length;
  var sl = (opts.swingLength != null) ? Math.max(1, Math.floor(+opts.swingLength)) : 10;
  if (n < 2 * sl + 2) return null;
  var shl = swingHighsLows(rows, { swingLength: sl });
  var bc = bosChoch(rows, shl, { closeBreak: opts.closeBreak !== false });
  var f = fvg(rows, { joinConsecutive: !!opts.joinConsecutive });
  var o = ob(rows, shl, { closeMitigation: !!opts.closeMitigation });
  var lq = liquidity(rows, shl, { rangePercent: (opts.rangePercent != null) ? +opts.rangePercent : 0.01 });
  var rt = retracements(rows, shl);
  var ph = null;
  try{ ph = previousHighLow(rows, { timeFrame: opts.prevTf || '1D' }); }catch(e){ ph = null; }
  var last = n - 1, i;
  var structure = null, bestBroken = -1;
  for (i = 0; i < n; i++){
    var isBos = bc.BOS[i] != null, isCh = bc.CHOCH[i] != null;
    if (!isBos && !isCh) continue;
    var br = bc.BrokenIndex[i] != null ? bc.BrokenIndex[i] : -1;
    if (br >= bestBroken){
      bestBroken = br;
      structure = { i: i, type: isBos ? 'BOS' : 'CHOCH', dir: isBos ? bc.BOS[i] : bc.CHOCH[i], level: bc.Level[i], brokenIndex: bc.BrokenIndex[i] };
    }
  }
  var fvgActive = [], obActive = [], obBreakers = [], unswept = [];
  for (i = 0; i < n; i++){
    if (f.FVG[i] != null && f.MitigatedIndex[i] === 0) fvgActive.push({ i: i, dir: f.FVG[i], top: f.Top[i], bottom: f.Bottom[i] });
    if (o.OB[i] != null){
      var blk = { i: i, dir: o.OB[i], top: o.Top[i], bottom: o.Bottom[i], volume: o.OBVolume[i], pct: o.Percentage[i], mitigatedIndex: o.MitigatedIndex[i] };
      if (o.MitigatedIndex[i] === 0) obActive.push(blk); else obBreakers.push(blk);
    }
    if (lq.Liquidity[i] != null && lq.Swept[i] === 0) unswept.push({ i: i, dir: lq.Liquidity[i], level: lq.Level[i], end: lq.End[i] });
  }
  var lastT = tMs(rows[last] && rows[last].t), active = [], name;
  if (!isNaN(lastT)){
    for (name in SESSIONS){
      if (Object.prototype.hasOwnProperty.call(SESSIONS, name) && inWindow(minuteOfDay(lastT), sessionWindow(name))) active.push(name);
    }
  }
  return {
    n: n, lastT: isNaN(lastT) ? null : lastT, lastClose: num(rows[last] && rows[last].c),
    swingLength: sl,
    structure: structure,
    bias: structure ? (structure.dir === 1 ? 'bull' : 'bear') : null,
    fvg: { active: fvgActive },
    ob: { active: obActive, breakers: obBreakers },
    liquidity: { unswept: unswept },
    retrace: { direction: rt.Direction[last], current: rt['CurrentRetracement%'][last], deepest: rt['DeepestRetracement%'][last] },
    prevHL: ph ? { high: ph.PreviousHigh[last], low: ph.PreviousLow[last], brokenHigh: ph.BrokenHigh[last], brokenLow: ph.BrokenLow[last] } : null,
    sessions: active
  };
}

/* Record-only read of a setup against the SMC digest — never touches solidity. */
function confluence(setup, ctx){
  setup = setup || {};
  var out = { score: 0, grade: 'NEUTRAL', tags: [], bias: ctx ? ctx.bias : null };
  if (!ctx) return out;
  var d = String(setup.dir || setup.direction || '').toLowerCase();
  var sign = (d === 'long' || d === 'buy') ? 1 : ((d === 'short' || d === 'sell') ? -1 : 0);
  if (!sign) return out;
  var entry = num(setup.entry), stop = num(setup.stop), t1 = num(setup.t1 != null ? setup.t1 : setup.tp1);
  var risk = (!isNaN(entry) && !isNaN(stop)) ? Math.abs(entry - stop) : NaN;
  function tag(id, pts, note){ out.tags.push({ id: id, pts: pts, note: note }); out.score += pts; }
  var i, z;
  if (ctx.structure){
    if (ctx.structure.dir === sign) tag('STRUCT_WITH', 2, ctx.structure.type + ' ' + (sign === 1 ? 'bullish' : 'bearish'));
    else tag('STRUCT_AGAINST', -2, ctx.structure.type + ' ' + (sign === 1 ? 'bearish' : 'bullish'));
  }
  if (!isNaN(entry)){
    for (i = 0; i < ctx.ob.active.length; i++){
      z = ctx.ob.active[i];
      if (z.dir === sign && z.bottom <= entry && entry <= z.top){ tag('OB_ENTRY', 1, 'entry inside ' + (sign === 1 ? 'bullish' : 'bearish') + ' order block'); break; }
    }
    for (i = 0; i < ctx.fvg.active.length; i++){
      z = ctx.fvg.active[i];
      if (z.dir === sign && z.bottom <= entry && entry <= z.top){ tag('FVG_ENTRY', 1, 'entry inside open fair value gap'); break; }
    }
    var liqTarget = false, stopBeyond = false, stopInside = false;
    for (i = 0; i < ctx.liquidity.unswept.length; i++){
      z = ctx.liquidity.unswept[i];
      var beyondEntry = sign === 1 ? z.level > entry : z.level < entry;
      if (z.dir === sign && beyondEntry && (isNaN(t1) || (sign === 1 ? z.level <= t1 : z.level >= t1))) liqTarget = true;
      if (z.dir === -sign && !isNaN(risk) && risk > 0){
        var betweenStopAndEntry = sign === 1 ? (stop < z.level && z.level < entry) : (entry < z.level && z.level < stop);
        var justPastStop = sign === 1 ? (z.level < stop && stop - z.level <= 0.5 * risk) : (z.level > stop && z.level - stop <= 0.5 * risk);
        if (betweenStopAndEntry) stopBeyond = true;
        if (justPastStop) stopInside = true;
      }
    }
    if (liqTarget) tag('LIQ_TARGET', 1, 'unswept liquidity between entry and target');
    if (stopBeyond) tag('STOP_BEYOND_LIQ', 1, 'stop sits past an unswept pool');
    if (stopInside) tag('STOP_INSIDE_SWEEP', -1, 'unswept pool just beyond the stop');
  }
  if (ctx.retrace && ctx.retrace.direction === sign && ctx.retrace.current >= 62 && ctx.retrace.current <= 79){
    tag('OTE', 1, 'retracement ' + ctx.retrace.current + '% (62–79 optimal entry)');
  }
  out.grade = out.score >= 3 ? 'STRONG' : (out.score >= 1 ? 'WITH' : (out.score < 0 ? 'AGAINST' : 'NEUTRAL'));
  return out;
}

G.hgSmc = {
  version: '0.0.27',
  fvg: fvg,
  swingHighsLows: swingHighsLows,
  bosChoch: bosChoch,
  ob: ob,
  liquidity: liquidity,
  previousHighLow: previousHighLow,
  sessions: sessions,
  retracements: retracements,
  context: context,
  confluence: confluence,
  SESSIONS: SESSIONS
};
})();
