/* =========================================================================
HARDGATE — indicators.js
Pure math / indicator functions extracted from index.html. No DOM, no fetch.
Loaded as a plain global script before the main inline <script> so every
function below remains available as a global, exactly as before this split.
========================================================================= */
'use strict';

function ema(vals, p){
const out = new Array(vals.length).fill(NaN);
if (vals.length < p) return out;
const k = 2/(p+1);
let sum = 0;
for (let i=0;i<p;i++) sum += vals[i];
let e = sum/p;
out[p-1] = e;
for (let i=p;i<vals.length;i++){
e = vals[i]*k + e*(1-k);
out[i] = e;
}
return out;
}
function rsi(vals, p=14){
const out = new Array(vals.length).fill(NaN);
let g=0,l=0;
for (let i=1;i<vals.length;i++){
const d = vals[i]-vals[i-1];
// flat series (avgGain==0 && avgLoss==0) => neutral 50, not a maximally "oversold" 0
if (i<=p){ g += Math.max(d,0); l += Math.max(-d,0); if(i===p){ out[i]=(g===0&&l===0)?50:100-100/(1+(g/p)/((l/p)||1e-12)); g/=p; l/=p; } }
else { g = (g*(p-1)+Math.max(d,0))/p; l = (l*(p-1)+Math.max(-d,0))/p; out[i]=(g===0&&l===0)?50:100-100/(1+g/(l||1e-12)); }
}
return out;
}
function atr(rows, p=14){
const out = new Array(rows.length).fill(NaN); let a=null;
for (let i=1;i<rows.length;i++){
const tr = Math.max(rows[i].h-rows[i].l, Math.abs(rows[i].h-rows[i-1].c), Math.abs(rows[i].l-rows[i-1].c));
if (a===null){ if(i>=p){ let s=0; for(let k=i-p+1;k<=i;k++){ s+=Math.max(rows[k].h-rows[k].l, Math.abs(rows[k].h-rows[k-1].c), Math.abs(rows[k].l-rows[k-1].c)); } a=s/p; out[i]=a; } }
else { a=(a*(p-1)+tr)/p; out[i]=a; }
}
return out;
}
/* EMA that skips NaNs and seeds from the FIRST VALID value (nanEma-style).
   indicators2.js has the general version; indicators.js loads first, so the
   MACD signal line keeps its own local copy here. */
function nanEmaLocal(vals, p){
const out = new Array(vals.length).fill(NaN);
const k = 2/(p+1);
let e = null;
for (let i=0;i<vals.length;i++){
const v = vals[i];
if (!isFinite(v)) continue;
e = (e===null) ? v : v*k + e*(1-k);
out[i] = e;
}
return out;
}
function macdHist(vals, f=12, s=26, sig=9){
const ef=ema(vals,f), es=ema(vals,s);
const line = vals.map((_,i)=> ef[i]-es[i]);
const sigline = nanEmaLocal(line, sig);   // seed from first valid MACD value — no forced zeros in warmup
return vals.map((_,i)=> line[i]-sigline[i]);
}
function volZ(rows, look=20){
const n=rows.length; if(n<look+1) return NaN;
const vs = rows.slice(n-1-look, n-1).map(r=>r.v);
const m = vs.reduce((a,b)=>a+b,0)/vs.length;
const sd = Math.sqrt(vs.reduce((a,b)=>a+(b-m)**2,0)/vs.length);
if (sd < 1e-8) return 0;
return (rows[n-1].v - m)/sd;
}
function lastSwing(rows, dir, look=30){
const seg = rows.slice(Math.max(0,rows.length-1-look), rows.length-1);
if (!seg.length) return NaN;
return dir==='long' ? Math.min(...seg.map(r=>r.l)) : Math.max(...seg.map(r=>r.h));
}
function findOrderBlock(rows, dir){
if (!rows || rows.length < 30) return null;
const aArr = atr(rows, 14);
let best = null;
const start = Math.max(2, rows.length - 40);
for (let j = start; j < rows.length - 1; j++){
const disp = rows[j], ob = rows[j-1];
const dispRange = disp.h - disp.l;
const avgAtr = aArr[j];
if (!avgAtr || dispRange < avgAtr * 1.5) continue;
const swingHigh = lastSwing(rows.slice(0, j+1), 'short', 20);
const swingLow = lastSwing(rows.slice(0, j+1), 'long', 20);
if (dir === 'long' && disp.c > disp.o && disp.c > swingHigh && ob.c < ob.o){
const top = ob.h, bottom = ob.l;
let mitigated = false;
for (let k = j+1; k < rows.length; k++){ if (rows[k].l <= bottom){ mitigated = true; break; } }
if (!mitigated) best = { top, bottom, age: rows.length-1-j };
} else if (dir === 'short' && disp.c < disp.o && disp.c < swingLow && ob.c > ob.o){
const top = ob.h, bottom = ob.l;
let mitigated = false;
for (let k = j+1; k < rows.length; k++){ if (rows[k].h >= top){ mitigated = true; break; } }
if (!mitigated) best = { top, bottom, age: rows.length-1-j };
}
}
return best;
}
function findLiquidityPools(rows){
if (!rows || rows.length < 25) return { buySide:null, sellSide:null };
const look = Math.min(40, rows.length-1);
const seg = rows.slice(rows.length-1-look, rows.length-1);
const tol = 0.0015;
let bestHigh = null, bestLow = null;
for (let i=0;i<seg.length;i++){
let cH=[seg[i].h], cL=[seg[i].l];
for (let j=0;j<seg.length;j++){
if (i===j) continue;
if (Math.abs(seg[j].h-seg[i].h)/seg[i].h <= tol) cH.push(seg[j].h);
if (Math.abs(seg[j].l-seg[i].l)/seg[i].l <= tol) cL.push(seg[j].l);
}
if (cH.length>=2){ const lvl=Math.max(...cH); if(!bestHigh||lvl>bestHigh.level) bestHigh={level:lvl,count:cH.length}; }
if (cL.length>=2){ const lvl=Math.min(...cL); if(!bestLow||lvl<bestLow.level) bestLow={level:lvl,count:cL.length}; }
}
if (bestHigh && seg.some(r=>r.c > bestHigh.level)) bestHigh = null;
if (bestLow && seg.some(r=>r.c < bestLow.level)) bestLow = null;
return { buySide: bestHigh, sellSide: bestLow };
}
function nearestOBText(rows, dir){
try{
const ob = findOrderBlock(rows, dir);
return ob ? (px(ob.bottom)+'–'+px(ob.top)+' ('+ob.age+' bars)') : 'none nearby';
}catch(e){ return 'n/a'; }
}
function liquidityTargetText(rows, dir){
try{
const lp = findLiquidityPools(rows);
const target = dir === 'long' ? lp.buySide : lp.sellSide;
return target ? (px(target.level)+' (x'+target.count+')') : 'none nearby';
}catch(e){ return 'n/a'; }
}

const last = a => a[a.length-1];
function roc(vals, n){ const L=vals.length; return L>n ? (vals[L-1]/vals[L-1-n]-1)*100 : NaN; }
function avgFinite(vals){ const f=vals.filter(function(v){return isFinite(v);}); return f.length ? f.reduce(function(a,b){return a+b;},0)/f.length : NaN; }
function bollinger(vals, p, mult){ p=p||20; mult=mult||2;
const out=new Array(vals.length).fill(NaN); const mid=new Array(vals.length).fill(NaN);
const upper=new Array(vals.length).fill(NaN); const lower=new Array(vals.length).fill(NaN);
for (let i=p-1;i<vals.length;i++){ let sum=0; for(let k=i-p+1;k<=i;k++) sum+=vals[k]; const m=sum/p;
let sq=0; for(let k=i-p+1;k<=i;k++) sq+=(vals[k]-m)*(vals[k]-m); const sd=Math.sqrt(sq/p);
mid[i]=m; upper[i]=m+mult*sd; lower[i]=m-mult*sd; }
const widthPct=vals.map(function(_,i){ return (isFinite(mid[i])&&mid[i]!==0) ? (upper[i]-lower[i])/mid[i]*100 : NaN; });
return {mid:mid, upper:upper, lower:lower, widthPct:widthPct}; }
function adx(rows, p){ p=p||14; const n=rows.length;
const plusDM=new Array(n).fill(0), minusDM=new Array(n).fill(0), tr=new Array(n).fill(0);
for (let i=1;i<n;i++){ const up=rows[i].h-rows[i-1].h, down=rows[i-1].l-rows[i].l;
plusDM[i]=(up>down&&up>0)?up:0; minusDM[i]=(down>up&&down>0)?down:0;
tr[i]=Math.max(rows[i].h-rows[i].l, Math.abs(rows[i].h-rows[i-1].c), Math.abs(rows[i].l-rows[i-1].c)); }
function wilder(vals){ const out=new Array(n).fill(NaN); let a=null;
for (let i=1;i<n;i++){ if(a===null){ if(i>=p){ let sum=0; for(let k=i-p+1;k<=i;k++) sum+=vals[k]; a=sum; out[i]=a; } }
else { a=a-a/p+vals[i]; out[i]=a; } } return out; }
const trS=wilder(tr), pdS=wilder(plusDM), mdS=wilder(minusDM);
const plusDI=trS.map(function(v,i){ return v?100*pdS[i]/v:NaN; });
const minusDI=trS.map(function(v,i){ return v?100*mdS[i]/v:NaN; });
const dx=plusDI.map(function(v,i){ const md=minusDI[i]; return (isFinite(v)&&isFinite(md)&&(v+md)!==0) ? 100*Math.abs(v-md)/(v+md) : NaN; });
// canonical Wilder: ADX seeds from the SMA of the first p DX values, then smooths
const out=new Array(n).fill(NaN); let a=null, seed=[];
for (let i=0;i<n;i++){
if (isNaN(dx[i])) continue;
if (a===null){
seed.push(dx[i]);
if (seed.length===p){ a=seed.reduce(function(x,y){return x+y;},0)/p; out[i]=a; }
continue;
}
a=(a*(p-1)+dx[i])/p; out[i]=a;
}
return {adx:out, plusDI:plusDI, minusDI:minusDI}; }
function stochRsi(vals, rsiP, stochP){ rsiP=rsiP||14; stochP=stochP||14; const r=rsi(vals,rsiP); const n=r.length;
const k=new Array(n).fill(NaN);
for (let i=0;i<n;i++){ if(i<stochP-1) continue; let lo=Infinity,hi=-Infinity,ok=true;
for (let j=i-stochP+1;j<=i;j++){ if(isNaN(r[j])){ ok=false; break; } lo=Math.min(lo,r[j]); hi=Math.max(hi,r[j]); }
if(!ok||hi===lo) continue; k[i]=100*(r[i]-lo)/(hi-lo); }
return k; }
function vwapDev(rows, look){ look=look||20; const n=rows.length; if (n<look) return NaN;
let pv=0, vv=0; for (let i=n-look;i<n;i++){ const typ=(rows[i].h+rows[i].l+rows[i].c)/3; pv+=typ*rows[i].v; vv+=rows[i].v; }
if (vv<=0) return NaN; const vwap=pv/vv; return (rows[n-1].c-vwap)/vwap*100; }
function cascadeAge(closes, dir){
const e9=ema(closes,9), e21=ema(closes,21), e50=ema(closes,50);
let n=0;
for (let i=closes.length-1;i>=0;i--){
if (!isFinite(e50[i])) break;
const ok = dir==='long' ? (e9[i]>e21[i]&&e21[i]>e50[i]) : (e9[i]<e21[i]&&e21[i]<e50[i]);
if (!ok) break;
n++;
}
return n;
}
function cusumLast(vals, k=1){
if (vals.length<30) return null;
const rets=[]; for(let i=1;i<vals.length;i++) rets.push(Math.log(vals[i]/vals[i-1]));
const m=rets.reduce((a,b)=>a+b,0)/rets.length;
const sd=Math.sqrt(rets.reduce((a,b)=>a+(b-m)**2,0)/rets.length)||1e-12;
const h=k*sd;
let sPos=0, sNeg=0, ev=null;
for(let i=0;i<rets.length;i++){
sPos=Math.max(0,sPos+rets[i]); sNeg=Math.min(0,sNeg+rets[i]);
if (sPos>h){ ev={dir:'long', i}; sPos=0; }
if (sNeg<-h){ ev={dir:'short', i}; sNeg=0; }
}
return ev ? {dir:ev.dir, barsAgo:rets.length-1-ev.i} : null;
}
function findPivots(vals, win){
win = win || 3;
const out = [];
for (let i=win;i<vals.length-win;i++){
let isHigh=true, isLow=true;
for (let k=1;k<=win;k++){
if (!(vals[i]>vals[i-k] && vals[i]>vals[i+k])) isHigh=false;
if (!(vals[i]<vals[i-k] && vals[i]<vals[i+k])) isLow=false;
}
if (isHigh) out.push({i:i, type:"high", v:vals[i]});
if (isLow) out.push({i:i, type:"low", v:vals[i]});
}
return out;
}
function detectRegime(rows){
if (!rows || rows.length < 60) return {regime:"unknown", label:"DATA THIN"};
const c = rows.map(function(r){ return r.c; });
const n = c.length;
const adxR = adx(rows,14);
const bb = bollinger(c,20,2);
const atrArr = atr(rows,14);
const adxNow = adxR.adx[n-1];
const wNow = bb.widthPct[n-1], wPrev = bb.widthPct[n-2];
const wHist = bb.widthPct.slice(Math.max(0,n-51), n-1).filter(function(v){ return isFinite(v); });
const wAvg = wHist.length ? wHist.reduce(function(a,b){ return a+b; },0)/wHist.length : NaN;
const atrNow = atrArr[n-1];
const atrHist = atrArr.slice(Math.max(0,n-51), n-1).filter(function(v){ return isFinite(v); }).slice().sort(function(a,b){ return a-b; });
const atrMedian = atrHist.length ? atrHist[Math.floor(atrHist.length/2)] : NaN;
const distMid = (isFinite(bb.mid[n-1]) && bb.mid[n-1]!==0) ? Math.abs(c[n-1]-bb.mid[n-1])/bb.mid[n-1] : NaN;
let regime="weak_trend", label="WEAK TREND";
if (isFinite(atrNow) && isFinite(atrMedian) && atrMedian>0 && atrNow > atrMedian*2){ regime="volatile"; label="VOLATILE EXPANSION"; }
else if (isFinite(wNow) && isFinite(wAvg) && wAvg>0 && wNow < wAvg*0.6){ regime="compression"; label="COMPRESSION"; }
else if (isFinite(adxNow) && adxNow>30 && isFinite(wNow) && isFinite(wPrev) && wNow>wPrev){ regime="trend"; label="STRONG TREND"; }
else if (isFinite(adxNow) && adxNow<20 && isFinite(distMid) && distMid<0.02){ regime="range"; label="RANGE"; }
return {regime:regime, label:label};
}

/* -------------------------------------------------------------------------
Appended (data-layer upgrade). These are referenced by the extracted modules
(scanners.js / scanrender.js / gold.js) and by macro/gold panels. Robust to
short arrays; accept candle rows ({o,h,l,c,v}) or plain close arrays.
------------------------------------------------------------------------- */

/* 'COMPRESSING'|'NORMAL'|'EXPANDING' — current ATR(14) vs its median over
lookback bars: <0.8x median => COMPRESSING, >1.3x => EXPANDING. Callers pass
either candle rows or closes; closes degrade to |dClose| as the TR proxy. */
function volRegime(rows, lookback){
lookback = lookback || 50;
if (!rows || rows.length < 20) return 'NORMAL';
let rr = rows;
if (typeof rows[0] === 'number') rr = rows.map(function(v){ return {h:v, l:v, c:v}; });
const a = atr(rr, 14);
const n = a.length;
const cur = a[n-1];
if (!isFinite(cur)) return 'NORMAL';
const hist = a.slice(Math.max(0, n-1-lookback), n-1).filter(function(v){ return isFinite(v); }).sort(function(x,y){ return x-y; });
if (hist.length < 10) return 'NORMAL';
const med = hist[Math.floor(hist.length/2)];
if (!(med > 0)) return 'NORMAL';
if (cur < 0.8*med) return 'COMPRESSING';
if (cur > 1.3*med) return 'EXPANDING';
return 'NORMAL';
}

/* Latest Bollinger %B: (close - lower)/(upper - lower). 0..1 inside the
bands, can exceed. NaN when not computable. Accepts rows or closes. */
function bollingerPercentB(rows, len, mult){
len = len || 20; mult = mult || 2;
if (!rows || rows.length < len) return NaN;
const c = (typeof rows[0] === 'number') ? rows : rows.map(function(r){ return r.c; });
const bb = bollinger(c, len, mult);
const i = c.length - 1;
const u = bb.upper[i], l = bb.lower[i];
if (!isFinite(u) || !isFinite(l) || u === l) return NaN;
return (c[i] - l)/(u - l);
}

/* Volume profile over the window: typical price (h+l+c)/3 weighted by v.
Call as volumeProfile(rows, bins) or volumeProfile(rows, lookback, bins)
(the 3-arg form matches scanners.js). Returns {poc, vah, val, bins:[{price,vol}]}
where vah/val bound the 70% value area (expand from POC toward the larger
neighbour). null when data is degenerate (no range or no volume). */
function volumeProfile(rows, a, b){
let lookback = null, bins = 24;
if (typeof b === 'number'){ lookback = a; bins = b; }
else if (typeof a === 'number'){ bins = a; }
if (!rows || !rows.length) return null;
let seg = rows;
if (typeof lookback === 'number' && lookback > 0) seg = rows.slice(-lookback);
if (seg.length < 5) return null;
let lo = Infinity, hi = -Infinity, totV = 0;
for (let i=0;i<seg.length;i++){ lo = Math.min(lo, seg[i].l); hi = Math.max(hi, seg[i].h); totV += (seg[i].v || 0); }
if (!(hi > lo) || !(totV > 0)) return null;
bins = Math.max(4, Math.min(200, bins || 24));
const size = (hi - lo)/bins;
const vols = new Array(bins).fill(0);
for (let i=0;i<seg.length;i++){
const typ = (seg[i].h + seg[i].l + seg[i].c)/3;
let idx = Math.floor((typ - lo)/size);
if (idx < 0) idx = 0; if (idx >= bins) idx = bins-1;
vols[idx] += (seg[i].v || 0);
}
const outBins = vols.map(function(v, i){ return {price: lo + (i + 0.5)*size, vol: v}; });
let pocIdx = 0;
for (let i=1;i<bins;i++){ if (vols[i] > vols[pocIdx]) pocIdx = i; }
const target = totV * 0.7;
let covered = vols[pocIdx], loI = pocIdx, hiI = pocIdx;
while (covered < target && (loI > 0 || hiI < bins-1)){
const upV = (hiI < bins-1) ? vols[hiI+1] : -1;
const dnV = (loI > 0) ? vols[loI-1] : -1;
if (upV >= dnV){ hiI++; covered += upV; } else { loI--; covered += dnV; }
}
return { poc: outBins[pocIdx].price, vah: lo + (hiI+1)*size, val: lo + loI*size, bins: outBins };
}
