/* =========================================================================
HARDGATE — indicators2.js
Extended indicator library. Same conventions as indicators.js: classic-script
globals, function declarations, arrays aligned to input length with the latest
value at [n-1], NaN-tolerant, and never throws on short arrays (returns
NaN-filled arrays or null instead). Candle rows are {t,o,h,l,c,v}, ascending.
Depends on indicators.js (ema / atr / bollinger) being loaded first.

Backtest-staple exports consumed by gate engines / scanners (hg-prefixed; also
attached to window at the bottom of this file, guarded so vm test contexts
without a window stub still load cleanly):

- hgStructure(rows, opts) — swing-point market structure, ICT/LuxAlgo
  convention. Pivots need opts.left/opts.right (default 3/3) strictly
  lower/higher bars on BOTH sides (ties or NaN holes disqualify), so a pivot at
  index p is only actionable from bar p+right (no repaint). Swing labels are
  relative to the previous same-kind swing: highs -> HH/LH, lows -> HL/LL; the
  first swing of each kind defaults to HH / HL. BOS = a CLOSE beyond the last
  confirmed swing in the CURRENT trend direction (continuation); CHoCH = a
  close beyond the last confirmed OPPOSING swing (reversal, flips trend). From
  the initial 'range' state the first break is recorded as a BOS that
  establishes the trend. Each swing level fires at most once. Returns
  {swings:[{i,px,type}], lastBOS:{dir,level,i}|null,
   lastCHoCH:{dir,level,i}|null, trend:'up'|'down'|'range'} with dir 'up'|'down'.

- hgAVWAP(rows, anchorIndex) — anchored VWAP from anchorIndex to the last bar
  using typical price tp=(h+l+c)/3 and volume weights; bands are +/- 1
  volume-weighted population sigma around the anchor VWAP. Bars with non-finite
  tp are skipped; negative/non-finite volume counts as 0; if total volume is 0
  all valid bars are weighted equally. Returns {value, upper, lower, stdev};
  all NaN when nothing valid is anchored.

- hgAtrPercentile(rows, len, lookback) — percentile rank of the latest ATR(len)
  vs its own trailing history (up to `lookback` finite ATR values, current
  included). Convention: pct = 100 * (# window values STRICTLY below current) /
  (m-1), m = window size, so a flat ATR series ranks 0 and a unique maximum
  ranks 100 exactly. Defaults len=14, lookback=100. Returns NaN when fewer than
  2 finite ATR values exist. Engines use it as a volatility-regime filter
  (avoid low-percentile chop and >95th-percentile blowoff).
========================================================================= */
'use strict';

/* Simple moving average, aligned to input; NaN until index len-1 and whenever the trailing window holds a non-finite value. */
function sma(arr, len){
const out = new Array(arr.length).fill(NaN);
if (!arr || arr.length < len || len < 1) return out;
for (let i=len-1;i<arr.length;i++){
let sum=0, ok=true;
for (let k=i-len+1;k<=i;k++){ const v=arr[k]; if (!isFinite(v)){ ok=false; break; } sum+=v; }
if (ok) out[i]=sum/len;
}
return out;
}

/* Population (divide-by-N) standard deviation over the trailing len bars; NaN until len-1 or on non-finite windows. */
function stdev(arr, len){
const out = new Array(arr.length).fill(NaN);
if (!arr || arr.length < len || len < 1) return out;
for (let i=len-1;i<arr.length;i++){
let sum=0, ok=true;
for (let k=i-len+1;k<=i;k++){ const v=arr[k]; if (!isFinite(v)){ ok=false; break; } sum+=v; }
if (!ok) continue;
const m=sum/len; let sq=0;
for (let k=i-len+1;k<=i;k++) sq+=(arr[k]-m)*(arr[k]-m);
out[i]=Math.sqrt(sq/len);
}
return out;
}

/* Rolling max over the trailing len bars (current bar INCLUDED). Plain number arrays only — pass rows.map(r=>r.h) yourself. */
function highest(arr, len){
const out = new Array(arr.length).fill(NaN);
if (!arr || arr.length < len || len < 1) return out;
for (let i=len-1;i<arr.length;i++){
let m=-Infinity, ok=true;
for (let k=i-len+1;k<=i;k++){ const v=arr[k]; if (!isFinite(v)){ ok=false; break; } if (v>m) m=v; }
if (ok) out[i]=m;
}
return out;
}

/* Rolling min over the trailing len bars (current bar INCLUDED). Plain number arrays only — pass rows.map(r=>r.l) yourself. */
function lowest(arr, len){
const out = new Array(arr.length).fill(NaN);
if (!arr || arr.length < len || len < 1) return out;
for (let i=len-1;i<arr.length;i++){
let m=Infinity, ok=true;
for (let k=i-len+1;k<=i;k++){ const v=arr[k]; if (!isFinite(v)){ ok=false; break; } if (v<m) m=v; }
if (ok) out[i]=m;
}
return out;
}

/* Keltner channels: mid = ema(close,len), up/lo = mid +/- mult*atr(len); NaN until both inputs are computable. */
function keltner(rows, len, mult){
len = len||20; mult = mult||1.5;
const n = rows.length;
const mid = ema(rows.map(function(r){ return r.c; }), len);
const a = atr(rows, len);
const up = new Array(n).fill(NaN), lo = new Array(n).fill(NaN);
for (let i=0;i<n;i++){
if (isFinite(mid[i]) && isFinite(a[i])){ up[i]=mid[i]+mult*a[i]; lo[i]=mid[i]-mult*a[i]; }
}
return {mid:mid, up:up, lo:lo};
}

/* Donchian channel EXCLUDING the current bar: up[i] = max(high[i-len..i-1]), lo[i] = min(low[i-len..i-1]),
   so a close above up[i] is a measurable breakout; NaN until index len. */
function donchian(rows, len){
len = len||20;
const n = rows.length;
const up = new Array(n).fill(NaN), lo = new Array(n).fill(NaN), mid = new Array(n).fill(NaN);
for (let i=len;i<n;i++){
let h=-Infinity, l=Infinity;
for (let k=i-len;k<i;k++){ if (rows[k].h>h) h=rows[k].h; if (rows[k].l<l) l=rows[k].l; }
up[i]=h; lo[i]=l; mid[i]=(h+l)/2;
}
return {up:up, lo:lo, mid:mid};
}

/* Ichimoku lines (tenkan/kijun midpoints, senkouA=(tenkan+kijun)/2, senkouB=senkouBLen midpoint).
   Values are UNSHIFTED (no +26 displacement): senkouA/B at index i describe the cloud as of bar i. */
function ichimoku(rows, tenkanLen, kijunLen, senkouBLen){
tenkanLen = tenkanLen||9; kijunLen = kijunLen||26; senkouBLen = senkouBLen||52;
const n = rows.length;
const highs = rows.map(function(r){ return r.h; }), lows = rows.map(function(r){ return r.l; });
const hT = highest(highs, tenkanLen), lT = lowest(lows, tenkanLen);
const hK = highest(highs, kijunLen), lK = lowest(lows, kijunLen);
const hB = highest(highs, senkouBLen), lB = lowest(lows, senkouBLen);
const tenkan = new Array(n).fill(NaN), kijun = new Array(n).fill(NaN);
const senkouA = new Array(n).fill(NaN), senkouB = new Array(n).fill(NaN);
for (let i=0;i<n;i++){
if (isFinite(hT[i]) && isFinite(lT[i])) tenkan[i]=(hT[i]+lT[i])/2;
if (isFinite(hK[i]) && isFinite(lK[i])) kijun[i]=(hK[i]+lK[i])/2;
if (isFinite(hB[i]) && isFinite(lB[i])) senkouB[i]=(hB[i]+lB[i])/2;
if (isFinite(tenkan[i]) && isFinite(kijun[i])) senkouA[i]=(tenkan[i]+kijun[i])/2;
}
return {tenkan:tenkan, kijun:kijun, senkouA:senkouA, senkouB:senkouB};
}

/* Latest-bar ichimoku snapshot vs the UNSHIFTED cloud; defaults to INSIDE/'BEAR'/false when lines are not computable. */
function ichimokuState(rows){
const ic = ichimoku(rows);
const i = rows.length-1;
const c = rows[i].c, a = ic.senkouA[i], b = ic.senkouB[i];
let priceVsCloud = 'INSIDE';
if (isFinite(a) && isFinite(b)){
const top=Math.max(a,b), bot=Math.min(a,b);
if (c>top) priceVsCloud='ABOVE'; else if (c<bot) priceVsCloud='BELOW';
}
const t = ic.tenkan[i], k = ic.kijun[i];
const tkCross = (isFinite(t) && isFinite(k) && t>=k) ? 'BULL' : 'BEAR';
const cloudBull = isFinite(a) && isFinite(b) ? a>b : false;
return {priceVsCloud:priceVsCloud, tkCross:tkCross, cloudBull:cloudBull};
}

/* Least-squares slope (price units per bar) of the trailing len closes; NaN until len-1. */
function linregSlope(closes, len){
const out = new Array(closes.length).fill(NaN);
if (!closes || closes.length < len || len < 2) return out;
const sx = len*(len-1)/2, sxx = len*(len-1)*(2*len-1)/6, denom = len*sxx - sx*sx;
for (let i=len-1;i<closes.length;i++){
let sy=0, sxy=0, ok=true;
for (let k=0;k<len;k++){ const y=closes[i-len+1+k]; if (!isFinite(y)){ ok=false; break; } sy+=y; sxy+=k*y; }
if (ok) out[i]=(len*sxy - sx*sy)/denom;
}
return out;
}

/* Fitted (regression-line) value at the last bar of each trailing len window — the TTM-style momentum curve. */
function linregCurve(closes, len){
const out = new Array(closes.length).fill(NaN);
if (!closes || closes.length < len || len < 2) return out;
const sx = len*(len-1)/2, sxx = len*(len-1)*(2*len-1)/6, denom = len*sxx - sx*sx;
for (let i=len-1;i<closes.length;i++){
let sy=0, sxy=0, ok=true;
for (let k=0;k<len;k++){ const y=closes[i-len+1+k]; if (!isFinite(y)){ ok=false; break; } sy+=y; sxy+=k*y; }
if (!ok) continue;
const slope=(len*sxy - sx*sy)/denom, intercept=(sy - slope*sx)/len;
out[i]=intercept + slope*(len-1);
}
return out;
}

/* Rolling z-score (population sd); a zero-variance window maps to 0, matching volZ's flat-series convention. */
function zscoreArr(arr, len){
const out = new Array(arr.length).fill(NaN);
const m = sma(arr, len), sd = stdev(arr, len);
for (let i=0;i<arr.length;i++){
if (!isFinite(arr[i]) || !isFinite(m[i]) || !isFinite(sd[i])) continue;
out[i] = sd[i]>0 ? (arr[i]-m[i])/sd[i] : 0;
}
return out;
}

/* Scalar z-score at the latest bar; NaN when not computable. */
function zscoreLast(arr, len){
const z = zscoreArr(arr, len);
return z[z.length-1];
}

/* Pearson correlation of the last len aligned finite pairs (scans back over any NaN holes); NaN if <2 pairs or zero variance. */
function correlation(a, b, len){
const n = Math.min(a.length, b.length);
const xs=[], ys=[];
for (let i=n-1;i>=0 && xs.length<len;i--){
if (isFinite(a[i]) && isFinite(b[i])){ xs.push(a[i]); ys.push(b[i]); }
}
if (xs.length<2) return NaN;
const m = xs.length;
let mx=0, my=0;
for (let k=0;k<m;k++){ mx+=xs[k]; my+=ys[k]; }
mx/=m; my/=m;
let sxy=0, sxx=0, syy=0;
for (let k=0;k<m;k++){ const dx=xs[k]-mx, dy=ys[k]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
if (sxx<=0 || syy<=0) return NaN;
return sxy/Math.sqrt(sxx*syy);
}

/* Rolling Pearson correlation over each trailing len-window (all pairs in the window must be finite); NaN until len-1. */
function rollingCorr(a, b, len){
const n = Math.min(a.length, b.length);
const out = new Array(n).fill(NaN);
if (n<len || len<2) return out;
for (let i=len-1;i<n;i++){
let mx=0, my=0, ok=true;
for (let k=i-len+1;k<=i;k++){ if (!isFinite(a[k]) || !isFinite(b[k])){ ok=false; break; } mx+=a[k]; my+=b[k]; }
if (!ok) continue;
mx/=len; my/=len;
let sxy=0, sxx=0, syy=0;
for (let k=i-len+1;k<=i;k++){ const dx=a[k]-mx, dy=b[k]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
if (sxx>0 && syy>0) out[i]=sxy/Math.sqrt(sxx*syy);
}
return out;
}

/* TTM squeeze: on[i] = Bollinger bands fully inside Keltner channels; fired[i] = first off-bar after >=3 consecutive
   on-bars. APPROXIMATION: momentum = linregSlope(close,20) * 20 (projected 20-bar move), NOT TradingView's exact
   linreg-of-(close - avg(donchian-mid, sma)) value. */
function ttmSqueeze(rows, bbLen, bbMult, kcLen, kcMult){
bbLen = bbLen||20; bbMult = bbMult||2; kcLen = kcLen||20; kcMult = kcMult||1.5;
const n = rows.length;
const closes = rows.map(function(r){ return r.c; });
const bb = bollinger(closes, bbLen, bbMult);
const kc = keltner(rows, kcLen, kcMult);
const on = new Array(n).fill(false), fired = new Array(n).fill(false);
for (let i=0;i<n;i++){
on[i] = isFinite(bb.lower[i]) && isFinite(bb.upper[i]) && isFinite(kc.lo[i]) && isFinite(kc.up[i])
&& bb.lower[i]>kc.lo[i] && bb.upper[i]<kc.up[i];
}
let run = 0;
for (let i=0;i<n;i++){
if (on[i]) run++;
else { if (run>=3 && i>0) fired[i]=true; run=0; }
}
const momLen = 20;
const slopes = linregSlope(closes, momLen);
const momentum = new Array(n).fill(NaN);
for (let i=0;i<n;i++){ if (isFinite(slopes[i])) momentum[i]=slopes[i]*momLen; }
return {on:on, fired:fired, momentum:momentum};
}

/* True at i where arrA crosses ABOVE arrB (prev <=, now >); both pairs must be finite. */
function crossOver(arrA, arrB){
const n = Math.min(arrA.length, arrB.length);
const out = new Array(n).fill(false);
for (let i=1;i<n;i++){
out[i] = isFinite(arrA[i]) && isFinite(arrB[i]) && isFinite(arrA[i-1]) && isFinite(arrB[i-1])
&& arrA[i-1]<=arrB[i-1] && arrA[i]>arrB[i];
}
return out;
}

/* True at i where arrA crosses BELOW arrB (prev >=, now <); both pairs must be finite. */
function crossUnder(arrA, arrB){
const n = Math.min(arrA.length, arrB.length);
const out = new Array(n).fill(false);
for (let i=1;i<n;i++){
out[i] = isFinite(arrA[i]) && isFinite(arrB[i]) && isFinite(arrA[i-1]) && isFinite(arrB[i-1])
&& arrA[i-1]>=arrB[i-1] && arrA[i]<arrB[i];
}
return out;
}

/* True if any of the last `within` entries of a cross bool-array is true. */
function crossedRecently(crossArr, within){
const n = crossArr.length;
for (let i=Math.max(0,n-within);i<n;i++){ if (crossArr[i]) return true; }
return false;
}

/* EMA tolerant of NaN warmups: skips non-finite inputs, seeds from the SMA of the first p finite values,
   then carries forward through any later NaN holes (out[i] holds the last EMA value across a hole). */
function nanEma(arr, p){
const out = new Array(arr.length).fill(NaN);
const k = 2/(p+1);
let buf = 0, cnt = 0, e = null;
for (let i=0;i<arr.length;i++){
const v = arr[i];
if (!isFinite(v)){ if (e!==null) out[i]=e; continue; }
if (e===null){
buf += v; cnt++;
if (cnt===p){ e = buf/p; out[i]=e; }
} else {
e = v*k + e*(1-k);
out[i] = e;
}
}
return out;
}

/* hgStructure(rows, opts) — swing-point market structure (ICT/LuxAlgo convention; see header).
   opts: {left, right} pivot confirmation bars each side (default 3/3). Pure, no DOM, never throws;
   short/dirty inputs degrade to {swings:[], lastBOS:null, lastCHoCH:null, trend:'range'}. */
function hgStructure(rows, opts){
const res = {swings:[], lastBOS:null, lastCHoCH:null, trend:'range'};
if (!Array.isArray(rows) || rows.length===0) return res;
opts = opts || {};
const left = (isFinite(opts.left) && opts.left>=1) ? Math.floor(opts.left) : 3;
const right = (isFinite(opts.right) && opts.right>=1) ? Math.floor(opts.right) : 3;
const n = rows.length;
function H(i){ const r = rows[i]; return r ? r.h : NaN; }
function L(i){ const r = rows[i]; return r ? r.l : NaN; }
function C(i){ const r = rows[i]; return r ? r.c : NaN; }
/* 1) confirmed pivots, strict inequality on both sides; labels vs previous same-kind swing */
const raw = [];
let prevH = null, prevL = null;
for (let p=left;p+right<n;p++){
const hp = H(p), lp = L(p);
if (isFinite(hp)){
let ok = true;
for (let k=1;k<=left && ok;k++){ const v=H(p-k); if (!isFinite(v) || v>=hp) ok=false; }
for (let k=1;k<=right && ok;k++){ const v=H(p+k); if (!isFinite(v) || v>=hp) ok=false; }
if (ok){
const type = prevH===null ? 'HH' : (hp>prevH ? 'HH' : 'LH');
prevH = hp;
raw.push({i:p, px:hp, type:type});
}
}
if (isFinite(lp)){
let ok = true;
for (let k=1;k<=left && ok;k++){ const v=L(p-k); if (!isFinite(v) || v<=lp) ok=false; }
for (let k=1;k<=right && ok;k++){ const v=L(p+k); if (!isFinite(v) || v<=lp) ok=false; }
if (ok){
const type = prevL===null ? 'HL' : (lp>prevL ? 'HL' : 'LL');
prevL = lp;
raw.push({i:p, px:lp, type:type});
}
}
}
res.swings = raw;
/* 2) chronological BOS/CHoCH walk; a pivot at p is actionable from bar p+right, each level fires once */
let trend = 'range', lastH = null, lastL = null, usedH = -1, usedL = -1, si = 0;
for (let i=0;i<n;i++){
while (si<raw.length && raw[si].i+right<=i){
const s = raw[si++];
if (s.type==='HH' || s.type==='LH') lastH = s; else lastL = s;
}
const c = C(i);
if (!isFinite(c)) continue;
if (lastH && c>lastH.px && lastH.i!==usedH){
if (trend==='down') res.lastCHoCH = {dir:'up', level:lastH.px, i:i};
else res.lastBOS = {dir:'up', level:lastH.px, i:i};
trend = 'up'; usedH = lastH.i;
}
if (lastL && c<lastL.px && lastL.i!==usedL){
if (trend==='up') res.lastCHoCH = {dir:'down', level:lastL.px, i:i};
else res.lastBOS = {dir:'down', level:lastL.px, i:i};
trend = 'down'; usedL = lastL.i;
}
}
res.trend = trend;
return res;
}

/* hgStructureGate(rows, dir, opts) — engine/BRAIN adapter over hgStructure.
   Maps lastBOS/lastCHoCH to veto/confirm for a cascade direction. Also
   accepts legacy test mocks {dir, bos, choch} booleans. Pure, never throws. */
function hgStructureGate(rows, dir, opts){
  var out = { veto: false, bos: false, choch: false, note: 'hgStructure: no read' };
  try{
    if (dir !== 'long' && dir !== 'short') return out;
    if (typeof hgStructure !== 'function'){ out.note = 'hgStructure absent'; return out; }
    var hs = null;
    try{ hs = hgStructure(rows, opts); }catch(e){ out.note = 'hgStructure errored (ignored)'; return out; }
    if (!hs || typeof hs !== 'object') return out;
    /* legacy mock shape (vm tests) */
    if (hs.choch === true && hs.dir){
      var chLegacy = (hs.dir === 'long' || hs.dir === 'up') ? 'long' : ((hs.dir === 'short' || hs.dir === 'down') ? 'short' : null);
      if (chLegacy && chLegacy !== dir){
        out.veto = true; out.choch = true;
        out.note = 'CHoCH ' + String(hs.dir).toUpperCase() + ' against the ' + dir.toUpperCase() + ' cascade (hgStructure)';
        return out;
      }
    }
    if (hs.bos === true && hs.dir === dir){
      out.bos = true;
      out.note = 'BOS confirms ' + dir.toUpperCase() + ' (hgStructure)';
      return out;
    }
    if (!Array.isArray(rows) || !rows.length) return out;
    var maxAge = (opts && isFinite(opts.maxBars) && opts.maxBars > 0) ? Math.floor(opts.maxBars) : 20;
    var n = rows.length - 1;
    var want = (dir === 'long') ? 'up' : 'down';
    var ch = hs.lastCHoCH, bo = hs.lastBOS;
    if (ch && ch.dir && isFinite(ch.i) && (n - ch.i) <= maxAge && ch.dir !== want){
      out.veto = true; out.choch = true;
      out.note = 'CHoCH ' + ch.dir.toUpperCase() + ' against the ' + dir.toUpperCase() + ' cascade (hgStructure)';
      return out;
    }
    if (bo && bo.dir && isFinite(bo.i) && (n - bo.i) <= maxAge && bo.dir === want){
      out.bos = true;
      out.note = 'BOS confirms ' + dir.toUpperCase() + ' (hgStructure)';
      return out;
    }
    out.note = 'structure trend ' + (hs.trend || 'range') + ' — no fresh opposing CHoCH';
    return out;
  }catch(e){ out.note = 'hgStructure gate failed (ignored)'; return out; }
}

/* hgAVWAP(rows, anchorIndex) — anchored VWAP with +/-1 volume-weighted sigma bands (see header).
   Pure, no DOM, never throws; returns {value, upper, lower, stdev}, all NaN when not computable. */
function hgAVWAP(rows, anchorIndex){
const bad = {value:NaN, upper:NaN, lower:NaN, stdev:NaN};
if (!Array.isArray(rows) || rows.length===0) return bad;
const n = rows.length;
let a = Math.floor(anchorIndex);
if (!isFinite(a) || a<0) a = 0;
if (a>=n) return bad;
let sumWV = 0, sumV = 0, sumTP = 0, cnt = 0;
for (let i=a;i<n;i++){
const r = rows[i]; if (!r) continue;
const tp = (r.h + r.l + r.c)/3;
if (!isFinite(tp)) continue;
let v = r.v; if (!isFinite(v) || v<0) v = 0;
sumWV += tp*v; sumV += v; sumTP += tp; cnt++;
}
if (cnt===0) return bad;
const val = sumV>0 ? sumWV/sumV : sumTP/cnt;   // zero-volume fallback: equal weights
let varSum = 0;
for (let i=a;i<n;i++){
const r = rows[i]; if (!r) continue;
const tp = (r.h + r.l + r.c)/3;
if (!isFinite(tp)) continue;
let v = r.v; if (!isFinite(v) || v<0) v = 0;
const w = sumV>0 ? v : 1;
varSum += w*(tp-val)*(tp-val);
}
const sd = Math.sqrt(varSum/(sumV>0 ? sumV : cnt));
return {value:val, upper:val+sd, lower:val-sd, stdev:sd};
}

/* Wilder ATR identical to indicators.js atr(); local fallback so hgAtrPercentile still works
   when indicators.js was not loaded (feature-checked via typeof atr). */
function hgAtrLocal(rows, p){
const out = new Array(rows.length).fill(NaN); let a = null;
for (let i=1;i<rows.length;i++){
const r = rows[i], q = rows[i-1];
if (!r || !q) continue;
const tr = Math.max(r.h-r.l, Math.abs(r.h-q.c), Math.abs(r.l-q.c));
if (!isFinite(tr)) continue;
if (a===null){
if (i>=p){
let s = 0, ok = true;
for (let k=i-p+1;k<=i;k++){
const rk = rows[k], rj = rows[k-1];
if (!rk || !rj){ ok = false; break; }
const tk = Math.max(rk.h-rk.l, Math.abs(rk.h-rj.c), Math.abs(rk.l-rj.c));
if (!isFinite(tk)){ ok = false; break; }
s += tk;
}
if (ok){ a = s/p; out[i] = a; }
}
} else { a = (a*(p-1)+tr)/p; out[i] = a; }
}
return out;
}

/* hgAtrPercentile(rows, len, lookback) — volatility-regime rank of the latest ATR vs its own
   trailing history (see header for the strict-below / (m-1) convention). 0..100, NaN-safe. */
function hgAtrPercentile(rows, len, lookback){
if (!Array.isArray(rows) || rows.length<2) return NaN;
len = (isFinite(len) && len>=1) ? Math.floor(len) : 14;
lookback = (isFinite(lookback) && lookback>=2) ? Math.floor(lookback) : 100;
const a = (typeof atr==='function') ? atr(rows, len) : hgAtrLocal(rows, len);
if (!a || !a.length) return NaN;
const vals = [];
for (let i=0;i<a.length;i++){ if (isFinite(a[i])) vals.push(a[i]); }
if (vals.length<2) return NaN;
const m = Math.min(lookback, vals.length);
const base = vals.length - m;
const cur = vals[vals.length-1];
let below = 0;
for (let k=base;k<vals.length-1;k++){ if (vals[k]<cur) below++; }
return 100*below/(m-1);
}

/* =============================================================================
   RELATIVE STRENGTH vs the benchmark (BTC).
   WHY THIS AND NOT MORE TREND EVIDENCE. The eight swing gates were measured
   for independence across 19,837 aligned cascades: they carry only ~6.0
   effective independent dimensions, and G3 x ANCHOR alone correlate at 0.923
   — the same "price is not extended" fact counted twice. Adding another trend
   confirmation raises the badge number without raising conviction.
   RS is the cheapest genuinely ORTHOGONAL fact available: an alt can be in a
   clean 4H cascade while still losing ground to BTC, which is exactly the
   setup that stalls. Measured max |r| against any existing gate:
       lookback   pass%   info      max|r|   partner
        6 bars    68.4%   0.900     0.353    ANCHOR   <- too short, tracks extension
       30 bars    86.0%   0.584     0.207    G2       <- chosen
      180 bars    80.6%   0.710     0.505    G2       <- collapses into trend
   30 x 4H = 5 days is the orthogonality minimum. Longer windows stop measuring
   relative strength and start re-measuring the trend G2 already owns.
   ============================================================================= */
var HG_RS_LOOK = 30;
function hgRelStrength(symRows, refRows, dir, look){
  look = (typeof look === 'number' && look > 1) ? Math.floor(look) : HG_RS_LOOK;
  var out = { ok: false, available: false, sym: null, ref: null, edge: null, look: look, note: '' };
  try{
    if (!Array.isArray(symRows) || !Array.isArray(refRows)){ out.note = 'no candles'; return out; }
    if (symRows.length < look + 1 || refRows.length < look + 1){
      out.note = 'needs ' + (look + 1) + ' bars on both legs';
      return out;
    }
    if (dir !== 'long' && dir !== 'short'){ out.note = 'no direction'; return out; }
    function ret(rows){
      var a = rows[rows.length - 1 - look], b = rows[rows.length - 1];
      if (!a || !b) return null;
      var pa = +a.c, pb = +b.c;
      if (!isFinite(pa) || !isFinite(pb) || pa <= 0) return null;
      return pb / pa - 1;
    }
    var rs = ret(symRows), rr = ret(refRows);
    if (rs === null || rr === null){ out.note = 'bad candle data'; return out; }
    var sign = (dir === 'long') ? 1 : -1;
    var edge = sign * (rs - rr);
    out.available = true;
    out.sym = rs; out.ref = rr; out.edge = edge;
    out.ok = edge > 0;
    out.note = (rs * 100).toFixed(2) + '% vs BTC ' + (rr * 100).toFixed(2) + '% over ' + look
      + ' bars → ' + (edge >= 0 ? '+' : '') + (edge * 100).toFixed(2) + '% '
      + (out.ok ? 'with' : 'against') + ' the trade';
    return out;
  }catch(e){ out.note = 'rs failed'; return out; }
}

/* window exports for the browser and for vm test contexts that stub window; the bare function
   declarations above already land on the global object in both environments, so this attach is
   guarded and never throws when window is absent. */
if (typeof window !== 'undefined' && window){
window.hgRelStrength = hgRelStrength;
window.HG_RS_LOOK = HG_RS_LOOK;
window.hgStructure = hgStructure;
window.hgStructureGate = hgStructureGate;
window.hgAVWAP = hgAVWAP;
window.hgAtrPercentile = hgAtrPercentile;
}
