// gold.js \u2014 XAU/gold trading scanners & cascade core (extracted from index.html, Phase 21)
// Call-time deps stay elsewhere: $, S, getXAUCandles, indicators, judasSweepCheck, etc.
// Globals: GOLD_SYM, goldSession, utcDayStart, runGold, runCascadeCore.

/* =============================================================================
   GOLD \u2014 XAUTUSD session + liquidity module.
   Swing: same hard gates as crypto. Scalp: Judas sweep-and-reclaim of Asian
   range / PDH/PDL inside London/NY kill zones only. Closed bars only.
   F&G deliberately NOT applied \u2014 it measures crypto sentiment, not gold.
   ============================================================================= */
const GOLD_SYM = 'XAUTUSD';
function goldSession(){
  const d = new Date();
  const h = d.getUTCHours() + d.getUTCMinutes()/60;
  if (h>=7  && h<10) return {name:'LONDON KZ', kz:true};   // 12:30\u201315:30 IST
  if (h>=12 && h<15) return {name:'NY KZ', kz:true};        // 17:30\u201320:30 IST
  if (h>=0  && h<7)  return {name:'ASIA (range builds)', kz:false};
  return {name:'OFF-SESSION', kz:false};
}
function utcDayStart(){ const d=new Date(); return Math.floor(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())/1000); }

/* runCascadeCore (used by best.js) - global scope, global indicators */
async function runCascadeCore(uni){
  const clean=[];
    let breadthBull=0, breadthTotal=0;
    const CHUNK1_SIZE=5;
    for (let ci=0; ci<uni.length; ci+=CHUNK1_SIZE){
      const chunk = uni.slice(ci, ci+CHUNK1_SIZE);
      await Promise.all(chunk.map(async function(t, idxInChunk){
      const i = ci+idxInChunk; setProg('bestProg',(i+1)/uni.length*0.65);
      $('bestStat').textContent=`gates ${i+1}/${uni.length} \u00B7 ${t.symbol}`;
      try{
        const rows=await getCandles(t.symbol,'4h',260);
        if (rows.length<210) return;
        const c=rows.map(r=>r.c);
        const e9=last(ema(c,9)), e21=last(ema(c,21)), e50=last(ema(c,50)), e200=last(ema(c,200));
        const p=last(c), r14=last(rsi(c,14)), vz=volZ(rows,20), a4=last(atr(rows,14));
      if (isFinite(e200)){ breadthTotal++; if (p>e200) breadthBull++; }
        let dir=null;
        if (e9>e21&&e21>e50) dir='long'; else if (e9<e21&&e21<e50) dir='short';
        if (!dir) return;
        if (!(isFinite(a4)&&Math.abs(e21-e50)>=0.25*a4)) return; const vr=volRegime(c); if (vr==='COMPRESSING') return;
        if (dir==='long' ? !(p>e200) : !(p<e200)) return;
        if ((dir==='long'&&r14>70)||(dir==='short'&&r14<30)) return;
        const fr=t.fundingPct;
        if (fr!==null){
          if (Math.abs(fr)>0.05-1e-9) return;
          if ((dir==='long'&&fr>=0.04)||(dir==='short'&&fr<=-0.04)) return;
        }
        if (!(vz > 0.5)) return; const currentBar = rows[rows.length-1]; const range = currentBar.h - currentBar.l; const closePos = range > 0 ? (currentBar.c - currentBar.l) / range : 0.5; if (dir === 'long' && closePos < 0.60) return; if (dir === 'short' && closePos > 0.40) return;
        const stop=lastSwing(rows,dir,30); const distToAnchor = Math.abs(p - e21) / a4; if (!(isFinite(distToAnchor) && distToAnchor <= 1.5)) return; let plannedEntry = p, entryType = 'MARKET'; const distToFast = Math.abs(p - e9) / a4; if (distToFast > 0.25){ plannedEntry = dir === 'long' ? Math.min(p, e9) : Math.max(p, e9); entryType = 'LIMIT @ EMA9'; } const entry = plannedEntry, risk=Math.abs(entry-stop);
if (!(risk>0)) return;
const expectedMove = a4 * 3.5; const maxExcursion = a4 * 4.9; const t1 = dir==='long' ? entry+expectedMove : entry-expectedMove; const t2 = dir==='long' ? entry+maxExcursion : entry-maxExcursion; const rr = expectedMove/risk; if (!(rr>=2)) return; const ev = cusumLast(c.slice(-120),1); if (ev && ev.barsAgo<=20 && ev.dir!==dir) return; clean.push({t,dir,rows,entry,entryType,distToAnchor,stop,risk,rr,t1,t2,vz,fr,ev});
      }catch(e){}
      }));
      await sleep(60);
    }
    
    /* Evidence FAMILIES for survivors \u2014 independence over count.
       Correlated indicators are grouped; each family yields at most ONE point,
       and the TREND family needs a 2-of-3 internal majority. This is the fix
       for triple-counting one fact (TSMOM, 1D side and CUSUM all measure trend).
       Plus two robustness checks: cross-timeframe stability and persistence. */
    const PF_CHUNK=5; for (let ci2=0; ci2<clean.length; ci2+=PF_CHUNK){ const chunk2=clean.slice(ci2,ci2+PF_CHUNK); await Promise.all(chunk2.map(async function(s){ try{ await getCandles(s.t.symbol,'1d',120); await getCandles(s.t.symbol,'2h',160); }catch(e){} })); } for (let i=0;i<clean.length;i++){
      const s=clean[i]; setProg('bestProg',0.65+((i+1)/clean.length)*0.3);
      $('bestStat').textContent=`evidence ${i+1}/${clean.length} \u00B7 ${s.t.symbol}`;
      const want=s.dir==='long'?1:-1;
      /* F1 TREND \u2014 members: TSMOM(MOP 2012), 1D side, CUSUM(your OOS top feature). Majority 2/3. */
      let mTs=false, mD1=false, tsD='1D fetch failed', d1D='1D fetch failed';
      try{
        const d1=await getCandles(s.t.symbol,'1d',120); const c1=d1.map(r=>r.c);
        const r30=roc(c1,30), r90=roc(c1,90);
        mTs = isFinite(r30)&&isFinite(r90)&&Math.sign(r30)===want&&Math.sign(r90)===want;
        tsD = `30d ${pct(r30,1)} \u00B7 90d ${pct(r90,1)}`;
        const e50d=last(ema(c1,50));
        mD1 = c1.length>=60 && (s.dir==='long'?last(c1)>e50d:last(c1)<e50d);
        d1D = `1D EMA50 ${px(e50d)}`;
      }catch(e){}
      const mCu = !!(s.ev&&s.ev.barsAgo<=20&&s.ev.dir===s.dir);
      const trendVotes=(mTs?1:0)+(mD1?1:0)+(mCu?1:0);
      const f1 = trendVotes>=2;
      /* F2 POSITIONING \u2014 funding tailwind: the crowd pays you to hold. */
      const f2 = s.fr!==null && (s.dir==='long'?s.fr<0:s.fr>0);
      /* F3 PARTICIPATION \u2014 strong volume expansion. */
      let vwapOk=false, vwapDetail='n/a';
      try{
        const dv = vwapDev(s.rows,20);
        if (isFinite(dv)){ vwapOk = want>0 ? dv>0 : dv<0; vwapDetail = fmt(dv,2)+'% vs 20-bar VWAP'; }
      }catch(e){}
      const f3 = s.vz>1.0 || vwapOk;
      /* F4 STRUCTURE \u2014 breakout location (Donchian-20, Turtle) or extra room (R:R\u22653). */
      const d20 = s.dir==='long' ? Math.max(...s.rows.slice(-20).map(r=>r.h)) : Math.min(...s.rows.slice(-20).map(r=>r.l));
      const mDc = Math.abs(s.entry-d20)/s.entry<=0.015, mRr=s.rr>=3;
      const f4 = mDc||mRr;
      /* F5 VOLATILITY/MOMENTUM \u2014 members: Bollinger(20,2) squeeze-to-breakout, ADX(14) trend
         strength+direction, StochRSI(14) not-exhausted. Majority 2/3 \u2014 grouped as one family
         because all three measure the same underlying fact: is momentum expanding in your
         favor right now, not three independent facts. No claim of profitability; this only
         changes which of the already-gated survivors gets ranked first. */
      let f5=false, f5Detail='insufficient history';
      try{
        const closesX = s.rows.map(function(r){return r.c;}); const nX = closesX.length;
        if (nX>=40){
          const bbX = bollinger(closesX,20,2);
          const priorWidths = bbX.widthPct.slice(Math.max(0,nX-50), nX-1).filter(function(v){return isFinite(v);});
          const wAvg = priorWidths.length ? priorWidths.reduce(function(a,b){return a+b;},0)/priorWidths.length : NaN;
          const bbBreak = (want>0 ? closesX[nX-1]>bbX.upper[nX-1] : closesX[nX-1]<bbX.lower[nX-1]) && isFinite(wAvg) && bbX.widthPct[nX-2]<=wAvg;
          const adxX = adx(s.rows,14);
          const adxAligned = adxX.adx[nX-1]>=23 && (want>0 ? adxX.plusDI[nX-1]>adxX.minusDI[nX-1] : adxX.minusDI[nX-1]>adxX.plusDI[nX-1]);
          const srsiX = stochRsi(closesX,14,14);
          const srsiOk = isFinite(srsiX[nX-1]) && (want>0 ? srsiX[nX-1]<80 : srsiX[nX-1]>20);
          const votes5 = (bbBreak?1:0)+(adxAligned?1:0)+(srsiOk?1:0);
          f5 = votes5>=2;
          f5Detail = 'BB '+(bbBreak?'breakout':'no breakout')+' \u00B7 ADX '+fmt(adxX.adx[nX-1],1)+' '+(adxAligned?'aligned':'not aligned')+' \u00B7 StochRSI '+fmt(srsiX[nX-1],0)+' '+(srsiOk?'not exhausted':'exhausted');
        }
      }catch(e){}
      /* R1 ROBUSTNESS \u2014 cascade must also hold on 2H: a signal living at exactly
         one timeframe is a curve-fit artifact, not a trend. */
      let r1=false, r1D='2H fetch failed';
      try{
        const h2=await getCandles(s.t.symbol,'2h',160); const c2=h2.map(r=>r.c);
        const a9=last(ema(c2,9)), a21=last(ema(c2,21)), a50=last(ema(c2,50));
        r1 = s.dir==='long' ? (a9>a21&&a21>a50) : (a9<a21&&a21<a50);
        r1D = `2H EMA9/21/50 ${r1?'aligned':'NOT aligned'}`;
      }catch(e){}
      /* R2 ROBUSTNESS \u2014 persistence: cascade held \u22653 consecutive closed 4H bars. */
      const age = cascadeAge(s.rows.map(r=>r.c), s.dir);
      const r2 = age>=3;
      s.fam=[
['G0','Anti-Chase Guard \u2014 price to EMA21 distance', true, `${fmt(s.distToAnchor,2)} ATR (limit \u2264 1.5, entry: ${s.entryType})`],
        ['F1','TREND family \u2014 2-of-3 majority: TSMOM \u00B7 1D side \u00B7 CUSUM', f1,
          `${trendVotes}/3 \u2192 TSMOM ${mTs?'\u2713':'\u2717'} (${tsD}) \u00B7 1D ${mD1?'\u2713':'\u2717'} \u00B7 CUSUM ${mCu?'\u2713':'\u2717'}${s.ev?` (${s.ev.dir.toUpperCase()} ${s.ev.barsAgo} bars ago)`:''}`],
        ['F2','POSITIONING family \u2014 funding tailwind (crowd pays you)', f2, s.fr!==null?`${fmt(s.fr,4)}%/interval`:'n/a'],
        ['F3','PARTICIPATION family \u2014 volume z > 1.0 or VWAP side', f3, `z ${fmt(s.vz,2)} \u00B7 ${vwapDetail}`],
        ['F4','STRUCTURE family \u2014 Donchian-20 breakout zone or R:R \u2265 3', f4, `Donchian ${mDc?'\u2713':'\u2717'} (${px(d20)}) \u00B7 R:R ${mRr?'\u2713':'\u2717'} (${fmt(s.rr,2)}R)`],
        ['F5','VOLATILITY/MOMENTUM family \u2014 2-of-3 majority: Bollinger breakout \u00B7 ADX trend+direction \u00B7 StochRSI not-exhausted', f5, f5Detail],
        ['R1','ROBUSTNESS \u2014 cascade also holds on 2H (anti curve-fit)', r1, r1D],
        ['R2','ROBUSTNESS \u2014 cascade age \u22653 closed 4H bars (anti flicker)', r2, `${age} bars`],
      ];
      s.famScore=(f1?1:0)+(f2?1:0)+(f3?1:0)+(f4?1:0)+(f5?1:0);
      s.robScore=(r1?1:0)+(r2?1:0);
      await sleep(60);
    }
    clean.sort((a,b)=> b.famScore-a.famScore || b.robScore-a.robScore || b.rr-a.rr);
  return {clean, breadth:{bull:breadthBull, total:breadthTotal}};
}

/* ===================== GOLD v3.0 module (scoped IIFE) ===================== */
(function(){
/* underscore aliases -> global indicators (parity with SUPER GOLD) */
var _last = last, _ema = ema, _rsi = rsi, _atr = atr, _bollinger = bollinger;

/* ---------- indicators scoped to GOLD v3.0 (gold-super parity) ---------- */
function heikinAshi(rows){ var ha=[]; for(var i=0;i<rows.length;i++){ var c=(rows[i].o+rows[i].h+rows[i].l+rows[i].c)/4; var o=i===0?rows[i].o:(ha[i-1].o+ha[i-1].c)/2; var h=Math.max(rows[i].h,o,c); var l=Math.min(rows[i].l,o,c); ha.push({o:o,h:h,l:l,c:c}); } return ha; }

function stochRsi(vals,p,k,d){ p=p||14;k=k||14;d=d||3; var rsiArr=_rsi(vals,p); var stoch=new Array(rsiArr.length).fill(NaN); for(var i=p+k-2;i<rsiArr.length;i++){ var slice=rsiArr.slice(i-k+1,i+1).filter(isFinite); if(!slice.length) continue; var hh=Math.max.apply(null,slice),ll=Math.min.apply(null,slice); if(hh!==ll) stoch[i]=100*(rsiArr[i]-ll)/(hh-ll); } return {stoch:stoch,k:_ema(stoch,3),d:_ema(_ema(stoch,3),3)}; }

function volRegime(rows,p){ p=p||14; var a=_atr(rows,p); var valid=a.slice(-60).filter(isFinite); if(valid.length<20) return {regime:"unknown",label:"n/a"}; var now=_last(a); var pct2=valid.filter(function(v){return v<=now;}).length/valid.length; return pct2<=0.33?{regime:"low",label:"LOW volatility"}:pct2>=0.67?{regime:"high",label:"HIGH volatility"}:{regime:"medium",label:"MEDIUM volatility"}; }

function vwap(rows,look){ look=look||rows.length; var n=rows.length; if(n<2) return new Array(n).fill(NaN); var out=new Array(n).fill(NaN); for(var i=0;i<n;i++){ var start=Math.max(0,i-look+1); var pv=0,vv=0; for(var j=start;j<=i;j++){ var typ=(rows[j].h+rows[j].l+rows[j].c)/3; pv+=typ*rows[j].v;vv+=rows[j].v; } if(vv>0) out[i]=pv/vv; } return out; }

/* ---------- advanced indicators (shared logic, scoped) ---------- */
function hullMA(vals,p){ p=p||20; function wma(src,len){ var out=new Array(src.length).fill(NaN); for(var i=len-1;i<src.length;i++){ var num=0,den=0; for(var j=0;j<len;j++){ num+=src[i-j]*(len-j); den+=(len-j);} out[i]=num/den; } return out; } var w1=wma(vals,Math.floor(p/2)); var w2=wma(vals,p); var raw=w1.map(function(v,i){ return isFinite(v)&&isFinite(w2[i])?2*v-w2[i]:NaN; }); return wma(raw,Math.floor(Math.sqrt(p))); }

function tema(vals,p){ p=p||20; var e1=_ema(vals,p); var e2=_ema(e1,p); var e3=_ema(e2,p); return e1.map(function(v,i){ return isFinite(v)&&isFinite(e2[i])&&isFinite(e3[i])?3*v-3*e2[i]+e3[i]:NaN; }); }

function donchian(rows,p){ p=p||20; var upper=new Array(rows.length).fill(NaN),lower=new Array(rows.length).fill(NaN),mid=new Array(rows.length).fill(NaN); for(var i=p-1;i<rows.length;i++){ var hh=Math.max.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.h;})); var ll=Math.min.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.l;})); upper[i]=hh;lower[i]=ll;mid[i]=(hh+ll)/2; } return {upper:upper,lower:lower,mid:mid}; }

function parabolicSAR(rows,step,max){ step=step||0.02;max=max||0.2; var sar=new Array(rows.length).fill(NaN); var ep=rows[0].h,af=step,trend=1,prevSAR=rows[0].l; for(var i=1;i<rows.length;i++){ if(trend===1){ sar[i]=prevSAR+af*(ep-prevSAR); if(rows[i].l<sar[i]){ trend=-1;sar[i]=ep;prevSAR=ep;ep=rows[i].l;af=step; } else { if(rows[i].h>ep){ep=rows[i].h;af=Math.min(af+step,max);} prevSAR=sar[i]; } } else { sar[i]=prevSAR+af*(ep-prevSAR); if(rows[i].h>sar[i]){ trend=1;sar[i]=ep;prevSAR=ep;ep=rows[i].h;af=step; } else { if(rows[i].l<ep){ep=rows[i].l;af=Math.min(af+step,max);} prevSAR=sar[i]; } } } return {sar:sar,trend:trend}; }

function superTrend(rows,p,mult){ p=p||10;mult=mult||3; var atrArr=_atr(rows,p); var n=rows.length; var upperBasic=[],lowerBasic=[],upperBand=[],lowerBand=[],st=[]; for(var i=0;i<n;i++){ var mid=(rows[i].h+rows[i].l)/2; upperBasic[i]=mid+mult*atrArr[i];lowerBasic[i]=mid-mult*atrArr[i]; } upperBand[0]=upperBasic[0];lowerBand[0]=lowerBasic[0];st[0]=1; for(var j=1;j<n;j++){ upperBand[j]=upperBasic[j]<upperBand[j-1]||rows[j-1].c>upperBand[j-1]?upperBasic[j]:upperBand[j-1]; lowerBand[j]=lowerBasic[j]>lowerBand[j-1]||rows[j-1].c<lowerBand[j-1]?lowerBasic[j]:lowerBand[j-1]; st[j]=st[j-1]===1?(rows[j].c>upperBand[j-1]?1:-1):(rows[j].c<lowerBand[j-1]?-1:1); } return {upperBand:upperBand,lowerBand:lowerBand,trend:st,atr:atrArr}; }

function ichimoku(rows){ var c=rows.map(function(r){return r.c;}),h=rows.map(function(r){return r.h;}),l=rows.map(function(r){return r.l;}),n=c.length; var tenkan=new Array(n).fill(NaN),kijun=new Array(n).fill(NaN),senkouA=new Array(n).fill(NaN),senkouB=new Array(n).fill(NaN),chikou=new Array(n).fill(NaN); for(var i=0;i<n;i++){ if(i>=8){ tenkan[i]=(Math.max.apply(null,h.slice(i-8,i+1))+Math.min.apply(null,l.slice(i-8,i+1)))/2; } if(i>=25){ kijun[i]=(Math.max.apply(null,h.slice(i-25,i+1))+Math.min.apply(null,l.slice(i-25,i+1)))/2; } if(i>=25){ senkouA[i]=(tenkan[i]+kijun[i])/2; } if(i>=52){ senkouB[i]=(Math.max.apply(null,h.slice(i-52,i+1))+Math.min.apply(null,l.slice(i-52,i+1)))/2; } chikou[i]=c[i]; } return {tenkan:tenkan,kijun:kijun,senkouA:senkouA,senkouB:senkouB,chikou:chikou}; }

function williamsR(rows,p){ p=p||14; var out=new Array(rows.length).fill(NaN); for(var i=p-1;i<rows.length;i++){ var hh=Math.max.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.h;})),ll=Math.min.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.l;})); if(hh!==ll) out[i]=-100*(hh-rows[i].c)/(hh-ll); } return out; }

function cci(rows,p){ p=p||20; var out=new Array(rows.length).fill(NaN); var tp=rows.map(function(r){return (r.h+r.l+r.c)/3;}); for(var i=p-1;i<rows.length;i++){ var slice=tp.slice(i-p+1,i+1); var m=slice.reduce(function(a,b){return a+b;},0)/slice.length; var md=slice.reduce(function(a,b){return a+Math.abs(b-m);},0)/slice.length; if(md>0) out[i]=(tp[i]-m)/(0.015*md); } return out; }

function keltner(rows,p,mult){ p=p||20;mult=mult||1.5; var emaArr=_ema(rows.map(function(r){return r.c;}),p); var atrArr=_atr(rows,p); return {upper:emaArr.map(function(v,i){return isFinite(v)&&isFinite(atrArr[i])?v+mult*atrArr[i]:NaN;}),lower:emaArr.map(function(v,i){return isFinite(v)&&isFinite(atrArr[i])?v-mult*atrArr[i]:NaN;}),mid:emaArr}; }

function macdGold(vals){ var ef=_ema(vals,12),es=_ema(vals,26); var line=vals.map(function(_,i){return ef[i]-es[i];}); var sig=_ema(line.map(function(v){return isNaN(v)?0:v;}),9); var hist=vals.map(function(_,i){return line[i]-sig[i];}); return {line:line,sig:sig,hist:hist,momentum:hist}; }

function mfi(rows,p){ p=p||14; var tp=rows.map(function(r){return (r.h+r.l+r.c)/3;}); var out=new Array(rows.length).fill(NaN); var posFlow=0,negFlow=0; for(var i=1;i<rows.length;i++){ var rawMF=tp[i]*rows[i].v; posFlow+=tp[i]>tp[i-1]?rawMF:0; negFlow+=tp[i]<tp[i-1]?rawMF:0; if(i>=p){ var ratio=posFlow/negFlow; out[i]=isFinite(ratio)?100-100/(1+ratio):NaN; var oldMF=tp[i-p+1]*rows[i-p+1].v; posFlow-=tp[i-p+1]>tp[i-p]?oldMF:0; negFlow-=tp[i-p+1]<tp[i-p]?oldMF:0; } } return out; }

function cmf(rows,p){ p=p||20; var out=new Array(rows.length).fill(NaN); for(var i=p-1;i<rows.length;i++){ var mfm=0,mfv=0; for(var j=i-p+1;j<=i;j++){ var m=((rows[j].c-rows[j].l)-(rows[j].h-rows[j].c))/(rows[j].h-rows[j].l||1e-9); mfm+=m*rows[j].v;mfv+=rows[j].v; } if(mfv>0) out[i]=mfm/mfv; } return out; }

function elderRay(rows,p){ p=p||13; var emaArr=_ema(rows.map(function(r){return r.c;}),p); return rows.map(function(r,i){ var bp=r.h-emaArr[i],bm=r.l-emaArr[i]; return {bp:isFinite(bp)?bp:NaN,bm:isFinite(bm)?bm:NaN}; }); }

function obv(rows){ var out=new Array(rows.length).fill(0); for(var i=1;i<rows.length;i++){ out[i]=out[i-1]+(rows[i].c>rows[i-1].c?rows[i].v:(rows[i].c<rows[i-1].c?-rows[i].v:0)); } return out; }

function awesomeOscillator(rows){ var mp=rows.map(function(r){return (r.h+r.l)/2;}); var s5=_ema(mp,5),s34=_ema(mp,34); return mp.map(function(_,i){return s5[i]-s34[i];}); }

function aroon(rows,p){ p=p||14; var up=new Array(rows.length).fill(NaN),down=new Array(rows.length).fill(NaN),osc=new Array(rows.length).fill(NaN); for(var i=p;i<rows.length;i++){ var hh=-Infinity,ll=Infinity,hi=i,li=i; for(var j=i-p+1;j<=i;j++){ if(rows[j].h>=hh){hh=rows[j].h;hi=j;} if(rows[j].l<=ll){ll=rows[j].l;li=j;} } up[i]=100*(p-(i-hi))/p;down[i]=100*(p-(i-li))/p;osc[i]=up[i]-down[i]; } return {up:up,down:down,osc:osc}; }

function pivotPoints(d1){ if(!d1||d1.length<2) return {pp:NaN,r1:NaN,r2:NaN,r3:NaN,s1:NaN,s2:NaN,s3:NaN}; var p=d1[d1.length-2]; var pp=(p.h+p.l+p.c)/3; var range=p.h-p.l; return {pp:pp, r1:2*pp-p.l, r2:pp+range, r3:2*pp+range-2*p.l, s1:2*pp-p.h, s2:pp-range, s3:2*pp-range-2*p.h}; }

function camarilla(d1){ if(!d1||d1.length<2) return {h1:NaN,h2:NaN,h3:NaN,h4:NaN,l1:NaN,l2:NaN,l3:NaN,l4:NaN}; var p=d1[d1.length-2]; var range=p.h-p.l; return {h1:p.c+range*0.091,h2:p.c+range*0.183,h3:p.c+range*0.275,h4:p.c+range*0.55,l1:p.c-range*0.091,l2:p.c-range*0.183,l3:p.c-range*0.275,l4:p.c-range*0.55}; }

function wyckoffPhase(rows){ if(rows.length<60) return {phase:"unknown",label:"UNKNOWN"}; var c=rows.map(function(r){return r.c;}),n=c.length; var bb=_bollinger(c,20,2); var vols=rows.slice(-20).map(function(r){return r.v;}).filter(function(v){return v>0;}); var avgVol=vols.length?vols.reduce(function(a,b){return a+b;},0)/vols.length:0; var recentVol=rows.slice(-5).map(function(r){return r.v;}).filter(function(v){return v>0;}); var rVol=recentVol.length?recentVol.reduce(function(a,b){return a+b;},0)/recentVol.length:0; var inRange=Math.abs(c[n-1]-bb.mid[n-1])/bb.mid[n-1]<0.02; var spring=c[n-1]<bb.lower[n-1]&&c[n-2]>c[n-1]&&c[n-1]>rows[n-1].l; if(spring) return {phase:"spring",label:"WYCKOFF SPRING"}; if(inRange&&rVol<avgVol*0.7) return {phase:"compression",label:"COMPRESSION"}; if(c[n-1]>bb.upper[n-1]&&rVol>avgVol*1.3) return {phase:"markup",label:"MARKUP"}; if(c[n-1]<bb.lower[n-1]&&rVol>avgVol*1.3) return {phase:"markdown",label:"MARKDOWN"}; return {phase:"neutral",label:"NEUTRAL"}; }

function fibLevels(high,low){ var diff=high-low; return {"0":high,"23.6":high-diff*0.236,"38.2":high-diff*0.382,"50":high-diff*0.5,"61.8":high-diff*0.618,"78.6":high-diff*0.786,"100":low}; }

function isNFPWeek(){ var d=new Date(); var firstDay=new Date(d.getFullYear(),d.getMonth(),1); var firstFriday=1+((5-firstDay.getDay()+7)%7); var nfpDay=new Date(d.getFullYear(),d.getMonth(),firstFriday); var diff=Math.floor((d-nfpDay)/86400000); return diff>=-1&&diff<=1; }

function isEventWindow(){ var d=new Date(); var day=d.getUTCDay(),hour=d.getUTCHours(); if(day===5&&isNFPWeek()&&hour>=12&&hour<=15) return {active:true,event:"NFP WINDOW"}; if(day===3&&hour>=18&&hour<=21) return {active:false,event:"POSSIBLE FOMC"}; return {active:false,event:"none"}; }

function isLondonFix(){ var d=new Date(); return d.getUTCHours()===15&&d.getUTCMinutes()<=30; }

function isNYClose(){ var d=new Date(); return d.getUTCHours()===21&&d.getUTCMinutes()<=30; }

/* ---------- NEW INDICATORS v3.0 ---------- */
function bollingerBB(vals, p, mult){
  p = p || 20; mult = mult || 2;
  const bb = bollinger(vals, p, mult);
  const n = vals.length;
  const up = bb.upper[n-1], lo = bb.lower[n-1], mid = bb.mid[n-1];
  const pctB = (isFinite(up) && isFinite(lo) && up !== lo) ? (vals[n-1] - lo) / (up - lo) : NaN;
  const widths = bb.widthPct.filter(isFinite);
  const bw = widths.length ? widths[widths.length - 1] : NaN;
  const avgW = widths.length > 20 ? widths.slice(-20).reduce((a, b) => a + b, 0) / 20 : NaN;
  return { pctB, bw, avgW, squeeze: isFinite(bw) && isFinite(avgW) && bw < avgW * 0.8 };
}
function stochastic(vals, highs, lows, p, k, d){
  p = p || 14; k = k || 3; d = d || 3;
  const n = vals.length;
  const kRaw = new Array(n).fill(NaN);
  for (let i = p - 1; i < n; i++){
    const hh = Math.max(...highs.slice(i - p + 1, i + 1));
    const ll = Math.min(...lows.slice(i - p + 1, i + 1));
    if (hh !== ll) kRaw[i] = 100 * (vals[i] - ll) / (hh - ll);
  }
  const kLine = ema(kRaw, k);
  const dLine = ema(kLine, d);
  return { k: kLine, d: dLine };
}
function fisherTransform(vals, p){
  p = p || 10;
  const n = vals.length;
  const out = new Array(n).fill(NaN);
  let v1 = 0;
  for (let i = 0; i < n; i++){
    const hi = Math.max(...vals.slice(Math.max(0, i - p + 1), i + 1));
    const lo = Math.min(...vals.slice(Math.max(0, i - p + 1), i + 1));
    if (hi !== lo){
      const v = 0.5 * 2 * ((vals[i] - lo) / (hi - lo) - 0.5) + 0.5 * v1;
      v1 = Math.max(-0.999, Math.min(0.999, v));
      out[i] = 0.5 * Math.log((1 + v1) / (1 - v1));
    }
  }
  return out;
}
function linearRegSlope(vals, p){
  p = p || 20;
  const n = vals.length;
  const out = new Array(n).fill(NaN);
  for (let i = p - 1; i < n; i++){
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < p; j++){
      const x = j; const y = vals[i - p + 1 + j];
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    }
    const den = p * sumX2 - sumX * sumX;
    if (den !== 0) out[i] = (p * sumXY - sumX * sumY) / den;
  }
  return out;
}

function rsiDivergence(vals, rsiArr, p){
  p = p || 14;
  const n = vals.length;
  let regDiv = null, hidDiv = null;
  for (let i = p + 10; i < n; i++){
    const w1 = i - p - 5, w2 = i - 5;
    const pl1 = Math.min(...vals.slice(w1 - 10, w1 + 1));
    const pl2 = Math.min(...vals.slice(w2 - 10, w2 + 1));
    const rl1 = Math.min(...rsiArr.slice(w1 - 10, w1 + 1).filter(isFinite));
    const rl2 = Math.min(...rsiArr.slice(w2 - 10, w2 + 1).filter(isFinite));
    if (pl2 < pl1 && rl2 > rl1) regDiv = 'bull';
    if (pl2 > pl1 && rl2 < rl1) hidDiv = 'bull';
    const ph1 = Math.max(...vals.slice(w1 - 10, w1 + 1));
    const ph2 = Math.max(...vals.slice(w2 - 10, w2 + 1));
    const rh1 = Math.max(...rsiArr.slice(w1 - 10, w1 + 1).filter(isFinite));
    const rh2 = Math.max(...rsiArr.slice(w2 - 10, w2 + 1).filter(isFinite));
    if (ph2 > ph1 && rh2 < rh1) regDiv = 'bear';
    if (ph2 < ph1 && rh2 > rh1) hidDiv = 'bear';
  }
  return { regular: regDiv, hidden: hidDiv };
}
function atrTrailingStop(rows, p, mult){
  p = p || 14; mult = mult || 3;
  const a = atr(rows, p);
  const n = rows.length;
  const stop = new Array(n).fill(NaN);
  let trend = 1, stopVal = rows[0].c - mult * a[0];
  for (let i = 1; i < n; i++){
    if (trend === 1){
      stopVal = Math.max(stopVal, rows[i].c - mult * a[i]);
      if (rows[i].c < stopVal) trend = -1;
    } else {
      stopVal = Math.min(stopVal, rows[i].c + mult * a[i]);
      if (rows[i].c > stopVal) trend = 1;
    }
    stop[i] = stopVal;
  }
  return { stop, trend };
}
function candlePattern(rows){
  const n = rows.length;
  if (n < 3) return { engulfing: false, pinBar: false, doji: false };
  const c1 = rows[n - 1], c2 = rows[n - 2];
  const b1 = Math.abs(c1.c - c1.o), b2 = Math.abs(c2.c - c2.o);
  const r1 = c1.h - c1.l;
  const bullEng = c1.c > c1.o && c2.c < c2.o && c1.o < c2.c && c1.c > c2.o && b1 > b2;
  const bearEng = c1.c < c1.o && c2.c > c2.o && c1.o > c2.c && c1.c < c2.o && b1 > b2;
  const pin = b1 > 0 && ((Math.min(c1.c, c1.o) - c1.l) / b1 > 2 || (c1.h - Math.max(c1.c, c1.o)) / b1 > 2);
  const doji = r1 > 0 && b1 / r1 < 0.1;
  return { engulfing: bullEng ? 'bull' : (bearEng ? 'bear' : false), pinBar: pin, doji };
}
function openingRange(rows, startMin, durMin){
  const start = nowSec() - startMin * 60;
  const dur = durMin * 60;
  const or = rows.filter(r => r.t >= start && r.t < start + dur);
  if (!or.length) return null;
  const hi = Math.max(...or.map(r => r.h)), lo = Math.min(...or.map(r => r.l));
  return { hi, lo, mid: (hi + lo) / 2 };
}

/* =========================================================================
   GOLD TAB - MAIN EVALUATION (v3.0)  [integration only - not endorsed]
   ========================================================================= */
async function runGold(){
  const btn = $('goldRun'); btn.disabled = true; setProg('goldProg', 0.05);
  $('goldStat').textContent = 'loading XAUUSD\u2026';
  try {
    const [d1, h4, h1, m15] = await Promise.all([
      getCandles('XAUTUSD', '1d', 260).catch(() => []),
      getCandles('XAUTUSD', '4h', 300).catch(() => []),
      getCandles('XAUTUSD', '1h', 200).catch(() => []),
      getCandles('XAUTUSD', '15m', 200).catch(() => []),
    ]);
    setProg('goldProg', 0.25);
    if (d1.length < 60 || h4.length < 210 || m15.length < 40) { $('goldStat').textContent = 'not enough XAUUSD history from Delta India'; return; }
    const sess = goldSession();
    $('goldSess').innerHTML = 'session <b>' + sess.name + '</b>';
    const nfp = isNFPWeek();
    $('goldNfp').innerHTML = 'NFP <b>' + (nfp ? 'THIS WEEK' : 'clear') + '</b>';
    const dxySelect = $('goldDxySelect'); const dxyDir = dxySelect ? dxySelect.value : 'n/a';
    $('goldDxy').innerHTML = 'DXY <b>' + dxyDir.toUpperCase() + '</b>';
    const tnxSelect = $('goldTnxSelect'); const tnxDir = tnxSelect ? tnxSelect.value : 'n/a';
    $('goldTnx').innerHTML = 'TNX <b>' + tnxDir.toUpperCase() + '</b>';
    const pdc = d1[d1.length - 1], PDH = pdc.h, PDL = pdc.l;
    const day0now = utcDayStart(), day0 = (nowSec() < day0now + 7 * 3600) ? day0now - 86400 : day0now;
    const asia = m15.filter(r => r.t >= day0 && r.t < day0 + 7 * 3600);
    const asiaHi = asia.length ? Math.max(...asia.map(r => r.h)) : NaN;
    const asiaLo = asia.length ? Math.min(...asia.map(r => r.l)) : NaN;
    $('goldLvl').innerHTML = 'PDH <b>' + px(PDH) + '</b> \u00b7 PDL <b>' + px(PDL) + '</b> \u00b7 Asia <b>' + (isFinite(asiaLo) ? px(asiaLo) : '\u2014') + '\u2013' + (isFinite(asiaHi) ? px(asiaHi) : '\u2014') + '</b>';
    const eventWin = isEventWindow();
    const piv = pivotPoints(d1), cam = camarilla(d1);
    const vreg = volRegime(h4, 14);
    /* ================= GOLD SWING (always-on) ================= */
    const c4 = h4.map(r => r.c), c1 = d1.map(r => r.c);
    const h4h = h4.map(r => r.h), h4l = h4.map(r => r.l);
    const e9 = last(ema(c4, 9)), e21 = last(ema(c4, 21)), e50 = last(ema(c4, 50)), e200 = last(ema(c4, 200));
    const a4 = last(atr(h4, 14));
    const e50d = last(ema(c1, 50)), pd = last(c1);
    const r4 = last(rsi(c4, 14));
    const casc = e9 > e21 && e21 > e50 ? 'long' : (e9 < e21 && e21 < e50 ? 'short' : 'mixed');
    const spreadOk = isFinite(a4) && Math.abs(e21 - e50) >= 0.25 * a4;
    const dSide = pd > e50d ? 'long' : 'short';
    const n = c4.length - 1;
    const wc = []; for (let i = 0; i < d1.length; i += 5) wc.push(d1[i].c);
    const wStruct = wc.length >= 10 ? (last(wc) > last(ema(wc, 9)) && last(ema(wc, 9)) > last(ema(wc, 21)) ? 'long' : (last(wc) < last(ema(wc, 9)) && last(ema(wc, 9)) < last(ema(wc, 21)) ? 'short' : 'mixed')) : 'mixed';
    let haOk = false, haDetail = 'n/a';
    if (h4.length >= 10) { const ha = heikinAshi(h4); const last3 = ha.slice(-3); const allG = last3.every(b => b.c > b.o), allR = last3.every(b => b.c < b.o); haDetail = allG ? 'all green' : (allR ? 'all red' : 'mixed'); haOk = (casc === 'long' && allG) || (casc === 'short' && allR); }
    let hullOk = false, hullDetail = 'n/a';
    if (c4.length >= 30) { const hma = hullMA(c4, 20); const hn = last(hma), hp = hma[hma.length - 2]; hullOk = (casc === 'long' && hn > hp) || (casc === 'short' && hn < hp); hullDetail = 'Hull ' + px(hn) + ' slope ' + (hn > hp ? 'rising' : 'falling'); }
    let temaOk = false, temaDetail = 'n/a';
    if (c4.length >= 30) { const tma = tema(c4, 20); const tn = last(tma), tp = tma[tma.length - 2]; temaOk = (casc === 'long' && tn > tp) || (casc === 'short' && tn < tp); temaDetail = 'TEMA ' + px(tn) + ' slope ' + (tn > tp ? 'rising' : 'falling'); }
    let donOk = false, donDetail = 'n/a';
    if (h4.length >= 25) { const dch = donchian(h4, 20); const pNow = c4[n]; donOk = (casc === 'long' && pNow >= dch.upper[n] - 0.3 * a4) || (casc === 'short' && pNow <= dch.lower[n] + 0.3 * a4); donDetail = 'Donchian up ' + px(dch.upper[n]) + ' low ' + px(dch.lower[n]); }
    let psarOk = false, psarDetail = 'n/a';
    if (h4.length >= 10) { const ps = parabolicSAR(h4, 0.02, 0.2); psarOk = (casc === 'long' && ps.trend === 1) || (casc === 'short' && ps.trend === -1); psarDetail = 'SAR trend ' + (ps.trend === 1 ? 'UP' : 'DOWN'); }
    let stOk = false, stDetail = 'n/a';
    if (h4.length >= 15) { const st = superTrend(h4, 10, 3); stOk = (casc === 'long' && st.trend[n] === 1) || (casc === 'short' && st.trend[n] === -1); stDetail = 'SuperTrend ' + (st.trend[n] === 1 ? 'UP' : 'DOWN'); }
    let ichiOk = false, ichiDetail = 'n/a';
    if (h4.length >= 60) { const ic = ichimoku(h4); const pAk = isFinite(ic.senkouA[n - 26]) && isFinite(ic.senkouB[n - 26]) && c4[n] > Math.max(ic.senkouA[n - 26], ic.senkouB[n - 26]); const pBk = isFinite(ic.senkouA[n - 26]) && isFinite(ic.senkouB[n - 26]) && c4[n] < Math.min(ic.senkouA[n - 26], ic.senkouB[n - 26]); const tk = ic.tenkan[n] > ic.kijun[n]; ichiDetail = 'TK ' + (tk ? 'bull' : 'bear') + ' Kumo ' + (pAk ? 'above' : (pBk ? 'below' : 'inside')); if (casc === 'long') ichiOk = tk && pAk; if (casc === 'short') ichiOk = !tk && pBk; }
    const adx4 = adx(h4, 14); const adxVal = adx4.adx[n], diPlus = adx4.plusDI[n], diMinus = adx4.minusDI[n];
    const adxOk = isFinite(adxVal) && adxVal >= 25 && ((casc === 'long' && diPlus > diMinus) || (casc === 'short' && diMinus > diPlus));
    let fibDetail = 'n/a', fibOk = false;
    if (isFinite(PDH) && isFinite(PDL) && casc !== 'mixed') { const fib = fibLevels(PDH, PDL); const pNow = c4[n]; fibOk = pNow >= fib['38.2'] && pNow <= fib['61.8']; fibDetail = '38.2% ' + px(fib['38.2']) + ' 50% ' + px(fib['50']) + ' 61.8% ' + px(fib['61.8']); }
    const wyk = wyckoffPhase(h4);
    let dxyOk = 'na', dxyGateDetail = 'manual input';
    if (dxyDir !== 'n/a' && casc !== 'mixed') { dxyOk = (casc === 'long' && dxyDir === 'bearish') || (casc === 'short' && dxyDir === 'bullish') ? 'pass' : 'veto'; dxyGateDetail = dxyDir.toUpperCase() + (casc === 'long' ? ' (gold wants weak DXY)' : ' (gold wants strong DXY)'); }
    let tnxOk = 'na', tnxGateDetail = 'manual input';
    if (tnxDir !== 'n/a' && casc !== 'mixed') { tnxOk = (casc === 'long' && tnxDir === 'falling') || (casc === 'short' && tnxDir === 'rising') ? 'pass' : 'veto'; tnxGateDetail = tnxDir.toUpperCase() + (casc === 'long' ? ' (gold wants yields falling)' : ' (gold wants yields rising)'); }
    const rsiVeto = (casc === 'long' && r4 > 70) || (casc === 'short' && r4 < 30);
    let willOk = false, willDetail = 'n/a';
    if (h4.length >= 14) { const wr = williamsR(h4, 14); const wNow = last(wr); willOk = (casc === 'long' && wNow > -20) || (casc === 'short' && wNow < -80) ? false : true; willDetail = 'W%R ' + fmt(wNow, 1); }
    let cciOk = false, cciDetail = 'n/a';
    if (h4.length >= 20) { const cc = cci(h4, 20); const ccNow = last(cc); cciOk = (casc === 'long' && ccNow > 100) || (casc === 'short' && ccNow < -100) ? true : ((casc === 'long' && ccNow < -100) || (casc === 'short' && ccNow > 100) ? false : true); cciDetail = 'CCI ' + fmt(ccNow, 1); }
    let keltOk = false, keltDetail = 'n/a';
    if (h4.length >= 25) { const kc = keltner(h4, 20, 1.5); keltOk = (casc === 'long' && c4[n] > kc.mid[n]) || (casc === 'short' && c4[n] < kc.mid[n]); keltDetail = 'price ' + px(c4[n]) + ' mid ' + px(kc.mid[n]); }
    let srsiOk = false, srsiDetail = 'n/a';
    if (c4.length >= 40) { const sr = stochRsi(c4, 14, 14, 3); const kNow = last(sr.k); srsiOk = isFinite(kNow) && ((casc === 'long' && kNow < 80) || (casc === 'short' && kNow > 20)); srsiDetail = 'StochRSI K ' + fmt(kNow, 1); }
    let macdOk = false, macdDetail = 'n/a';
    if (c4.length >= 40) { const md = macdGold(c4); const hNow = last(md.hist), hPrev = md.hist[md.hist.length - 2]; macdOk = (casc === 'long' && hNow > hPrev && hNow > 0) || (casc === 'short' && hNow < hPrev && hNow < 0); macdDetail = 'MACD hist ' + fmt(hNow, 4); }
    let mfiOk = false, mfiDetail = 'n/a';
    if (h4.length >= 20) { const mf = mfi(h4, 14); const mfNow = last(mf); mfiOk = isFinite(mfNow) && ((casc === 'long' && mfNow > 50) || (casc === 'short' && mfNow < 50)); mfiDetail = 'MFI ' + fmt(mfNow, 1); }
    let cmfOk = false, cmfDetail = 'n/a';
    if (h4.length >= 20) { const cf = cmf(h4, 20); const cfNow = last(cf); cmfOk = isFinite(cfNow) && ((casc === 'long' && cfNow > 0) || (casc === 'short' && cfNow < 0)); cmfDetail = 'CMF ' + fmt(cfNow, 4); }
    let elderOk = false, elderDetail = 'n/a';
    if (h4.length >= 20) { const er = elderRay(h4, 13); const bp = last(er.map(r => r.bp)), bm = last(er.map(r => r.bm)); elderOk = (casc === 'long' && bp > 0) || (casc === 'short' && bm < 0); elderDetail = 'bull ' + fmt(bp, 2) + ' bear ' + fmt(bm, 2); }
    let obvOk = false, obvDetail = 'n/a';
    if (h4.length >= 20) { const o = obv(h4); const oNow = last(o), oPrev = o[o.length - 2]; obvOk = (casc === 'long' && oNow > oPrev) || (casc === 'short' && oNow < oPrev); obvDetail = 'OBV ' + fmt(oNow, 0) + ' slope ' + (oNow > oPrev ? 'rising' : 'falling'); }
    let aoOk = false, aoDetail = 'n/a';
    if (h4.length >= 40) { const ao = awesomeOscillator(h4); const aoNow = last(ao), aoPrev = ao[ao.length - 2]; aoOk = (casc === 'long' && aoNow > aoPrev && aoNow > 0) || (casc === 'short' && aoNow < aoPrev && aoNow < 0); aoDetail = 'AO ' + fmt(aoNow, 2); }
    let aroonOk = false, aroonDetail = 'n/a';
    if (h4.length >= 20) { const ar = aroon(h4, 14); const oscNow = last(ar.osc); aroonOk = (casc === 'long' && oscNow > 0) || (casc === 'short' && oscNow < 0); aroonDetail = 'Aroon ' + fmt(oscNow, 1); }
    const r30g = roc(c1, 30), r90g = roc(c1, 90);
    let tsmom = 'na';
    if (casc !== 'mixed' && isFinite(r30g) && isFinite(r90g)) { const want = casc === 'long' ? 1 : -1; const agree = (Math.sign(r30g) === want ? 1 : 0) + (Math.sign(r90g) === want ? 1 : 0); tsmom = agree === 2 ? 'pass' : agree === 0 ? 'veto' : 'na'; }
    const evG = cusumLast(c4.slice(-120), 1);
    let cusum = 'na'; if (evG && evG.barsAgo <= 20 && casc !== 'mixed') cusum = evG.dir === casc ? 'pass' : 'veto';
    const lfix = isLondonFix(), nyClose = isNYClose();
    const timeNote = (lfix ? 'London Fix active' : '') + (nyClose ? ' NY Close active' : '');
    /* ---------- NEW v3.0 SWING INDICATORS ---------- */
    let bbOk = false, bbSqueeze = false, bbDetail = 'n/a';
    if (c4.length >= 40) { const bb = bollingerBB(c4, 20, 2); bbOk = isFinite(bb.pctB) && ((casc === 'long' && bb.pctB > 0.2) || (casc === 'short' && bb.pctB < 0.8)); bbSqueeze = bb.squeeze; bbDetail = '%B ' + fmt(bb.pctB, 2) + (bbSqueeze ? ' \u00b7 SQUEEZE' : ' \u00b7 expanded'); }
    let stochOk = false, stochDetail = 'n/a';
    if (c4.length >= 40) { const st = stochastic(c4, h4h, h4l, 14, 3, 3); const kNow = last(st.k), dNow = last(st.d); stochOk = isFinite(kNow) && isFinite(dNow) && ((casc === 'long' && kNow > dNow) || (casc === 'short' && kNow < dNow)); stochDetail = 'Stoch K ' + fmt(kNow, 1) + ' / D ' + fmt(dNow, 1); }
    let fishOk = false, fishDetail = 'n/a';
    if (c4.length >= 30) { const ft = fisherTransform(c4, 10); const fNow = last(ft), fPrev = ft[ft.length - 2]; fishOk = (casc === 'long' && fNow > fPrev) || (casc === 'short' && fNow < fPrev); fishDetail = 'Fisher ' + fmt(fNow, 2) + ' slope ' + (fNow > fPrev ? 'up' : 'down'); }
    let lrsOk = false, lrsDetail = 'n/a';
    if (c4.length >= 30) { const lrs = linearRegSlope(c4, 20); const sNow = last(lrs); lrsOk = isFinite(sNow) && ((casc === 'long' && sNow > 0) || (casc === 'short' && sNow < 0)); lrsDetail = 'LReg slope ' + fmt(sNow, 4); }
    let divOk = false, divDetail = 'n/a';
    if (c4.length >= 60) { const rArr = rsi(c4, 14); const div = rsiDivergence(c4, rArr, 14); const reg = div.regular, hid = div.hidden; divOk = (casc === 'long' && (reg === 'bull' || hid === 'bull')) || (casc === 'short' && (reg === 'bear' || hid === 'bear')); divDetail = 'reg ' + (reg || 'none') + ' \u00b7 hid ' + (hid || 'none'); }
    let atrStopOk = false, atrStopDetail = 'n/a', atrStopVal = NaN;
    if (h4.length >= 20) { const ats = atrTrailingStop(h4, 14, 3); const tNow = ats.trend; atrStopOk = (casc === 'long' && tNow === 1) || (casc === 'short' && tNow === -1); atrStopVal = ats.stop[ats.stop.length - 1]; atrStopDetail = 'ATR-TS ' + px(atrStopVal) + ' trend ' + (tNow === 1 ? 'UP' : 'DOWN'); }
    /* ---- build gate ledger ---- */
    const sg = [];
    sg.push(['G1', 'Weekly/Daily EMA structure', wStruct !== 'mixed' && wStruct === dSide ? 'pass' : 'veto', wStruct.toUpperCase() + ' \u00b7 1D ' + dSide.toUpperCase()]);
    sg.push(['G2', '4H EMA cascade spread', casc !== 'mixed' && spreadOk ? 'pass' : 'veto', casc.toUpperCase()]);
    sg.push(['G3', '1D side agrees', casc !== 'mixed' && casc === dSide ? 'pass' : 'veto', dSide.toUpperCase()]);
    sg.push(['G4', 'Heikin Ashi', haOk ? 'pass' : 'veto', haDetail]);
    sg.push(['G5', 'Hull MA', hullOk ? 'pass' : 'veto', hullDetail]);
    sg.push(['G6', 'TEMA', temaOk ? 'pass' : 'veto', temaDetail]);
    sg.push(['G7', 'Donchian-20', donOk ? 'pass' : 'veto', donDetail]);
    sg.push(['G8', 'Parabolic SAR', psarOk ? 'pass' : 'veto', psarDetail]);
    sg.push(['G9', 'Super Trend', stOk ? 'pass' : 'veto', stDetail]);
    sg.push(['G10', 'Ichimoku', ichiOk ? 'pass' : 'veto', ichiDetail]);
    sg.push(['G11', 'ADX \u226525 + DI', adxOk ? 'pass' : 'veto', 'ADX ' + fmt(adxVal, 1)]);
    sg.push(['G12', 'DXY anti-correl', dxyOk, dxyGateDetail]);
    sg.push(['G13', 'TNX aligned', tnxOk, tnxGateDetail]);
    sg.push(['G14', 'RSI exhaustion', rsiVeto ? 'veto' : 'pass', 'RSI14 ' + fmt(r4, 1)]);
    sg.push(['G15', 'Williams %R', willOk ? 'pass' : 'veto', willDetail]);
    sg.push(['G16', 'CCI', cciOk ? 'pass' : 'veto', cciDetail]);
    sg.push(['G17', 'Keltner', keltOk ? 'pass' : 'veto', keltDetail]);
    sg.push(['G18', 'StochRSI', srsiOk ? 'pass' : 'veto', srsiDetail]);
    sg.push(['G19', 'MACD hist', macdOk ? 'pass' : 'veto', macdDetail]);
    sg.push(['G20', 'MFI', mfiOk ? 'pass' : 'veto', mfiDetail]);
    sg.push(['G21', 'CMF', cmfOk ? 'pass' : 'veto', cmfDetail]);
    sg.push(['G22', 'Elder Ray', elderOk ? 'pass' : 'veto', elderDetail]);
    sg.push(['G23', 'OBV', obvOk ? 'pass' : 'veto', obvDetail]);
    sg.push(['G24', 'Awesome Osc', aoOk ? 'pass' : 'veto', aoDetail]);
    sg.push(['G25', 'Aroon', aroonOk ? 'pass' : 'veto', aroonDetail]);
    sg.push(['G26', 'TSMOM 30/90d', tsmom, '30d ' + pct(r30g, 1) + ' \u00b7 90d ' + pct(r90g, 1)]);
    sg.push(['G27', 'CUSUM', cusum, evG ? evG.dir.toUpperCase() + ' ' + evG.barsAgo + ' bars ago' : 'no event']);
    sg.push(['G28', 'Vol regime', vreg.regime !== 'unknown' ? 'pass' : 'na', vreg.label]);
    sg.push(['G29', 'NFP/Event', !eventWin.active ? 'pass' : 'veto', eventWin.active ? eventWin.event : 'clear']);
    sg.push(['G30', 'London Fix / NY Close', (!lfix && !nyClose) ? 'pass' : 'na', timeNote || 'quiet']);
    sg.push(['G31', 'Bollinger %B + Squeeze', bbOk ? 'pass' : 'veto', bbDetail]);
    sg.push(['G32', 'Stochastic K/D', stochOk ? 'pass' : 'veto', stochDetail]);
    sg.push(['G33', 'Fisher Transform', fishOk ? 'pass' : 'veto', fishDetail]);
    sg.push(['G34', 'Linear Reg Slope', lrsOk ? 'pass' : 'veto', lrsDetail]);
    sg.push(['G35', 'RSI Divergence', divOk ? 'pass' : 'veto', divDetail]);
    sg.push(['G36', 'ATR Trailing Stop', atrStopOk ? 'pass' : 'veto', atrStopDetail]);
    sg.push(['G37', 'Bollinger Squeeze Alert', bbSqueeze ? 'pass' : 'na', bbSqueeze ? 'squeeze active - expansion likely' : 'no squeeze']);
    const passCount = sg.filter(x => x[2] === 'pass').length;
    const vetoCount = sg.filter(x => x[2] === 'veto').length;
    const naCount = sg.filter(x => x[2] === 'na').length;
    const totalScored = passCount + vetoCount;
    const score = totalScored > 0 ? (passCount / totalScored) * 100 : 0;
    /* ALWAYS compute levels */
    let entry = null, stop = null, t1 = null, t2 = null, risk = null, rr = 0;
    if (casc !== 'mixed') {
      stop = lastSwing(h4, casc, 30); entry = last(c4);
      risk = Math.abs(entry - stop);
      const room = casc === 'long' ? Math.max(...h4.slice(-120).map(r => r.h)) - entry : entry - Math.min(...h4.slice(-120).map(r => r.l));
      rr = risk > 0 ? room / risk : 0;
      if (risk > 0) { t1 = casc === 'long' ? entry + 2 * risk : entry - 2 * risk; t2 = casc === 'long' ? entry + 3 * risk : entry - 3 * risk; }
    }
    if (casc === 'mixed' || risk <= 0) {
      entry = last(c4); stop = casc === 'long' ? entry - 1.5 * a4 : entry + 1.5 * a4; risk = Math.abs(entry - stop);
      t1 = casc === 'long' ? entry + 2 * risk : entry - 2 * risk; t2 = casc === 'long' ? entry + 3 * risk : entry - 3 * risk; rr = 2;
    }
    if (isFinite(atrStopVal) && Math.abs(entry - atrStopVal) > 0 && Math.abs(entry - atrStopVal) < risk) {
      stop = atrStopVal; risk = Math.abs(entry - stop);
      t1 = casc === 'long' ? entry + 2 * risk : entry - 2 * risk; t2 = casc === 'long' ? entry + 3 * risk : entry - 3 * risk;
    }
    let verdictLabel, verdictColor, verdictWhy;
    if (score >= 80 && vetoCount === 0) { verdictLabel = 'STRONG ' + casc.toUpperCase(); verdictColor = casc; verdictWhy = 'All gates cleared. Highest conviction.'; }
    else if (score >= 60) { verdictLabel = 'MODERATE ' + casc.toUpperCase(); verdictColor = casc; verdictWhy = passCount + '/' + totalScored + ' passed. Some vetoes.'; }
    else if (score >= 40) { verdictLabel = 'WEAK ' + casc.toUpperCase(); verdictColor = casc; verdictWhy = passCount + '/' + totalScored + ' passed. Reduce size.'; }
    else if (casc !== 'mixed') { verdictLabel = 'BIAS ONLY \u2014 ' + casc.toUpperCase(); verdictColor = 'aside'; verdictWhy = passCount + '/' + totalScored + ' passed. No edge.'; }
    else { verdictLabel = 'MIXED / NO EDGE'; verdictColor = 'aside'; verdictWhy = 'No clear direction. Consider range.'; }
    if (casc !== 'mixed' && risk > 0 && entry != null && stop != null && t1 != null) {
      logSetup(GOLD_SYM, casc, 'gold-swing', entry, stop, t1);
    }
    const swingPlanHtml = '<div class="plan">' + planBlock(casc, entry, stop, t1, t2 || t1) + '</div>'
      + '<button class="toTrade" onclick="toTrade(\'' + GOLD_SYM + '\',\'' + (casc !== 'mixed' ? casc : 'long') + '\',' + entry + ',' + stop + ')">SEND TO TRADE PLAN (XM 360) \u2192</button>'
      + '<div class="note" style="margin-top:6px">XM 360: copy to MT4/MT5. Verify spread &lt; 35 pips. ' + verdictLabel + ' \u2014 ' + verdictWhy + '</div>';
    $('goldSwingOut').innerHTML = '<div class="note" style="margin-bottom:8px;opacity:.75">Integration only - strategy/gates/scoring not endorsed. Your logic, your risk.</div>'
      + '<div class="ledger">' + sg.map(x => gateRow(x[0], x[1], x[2], x[3])).join('') + '</div>'
      + '<div class="verdict ' + verdictColor + '"><div class="vword">' + verdictLabel + '</div>'
      + '<div class="vwhy">Score: ' + fmt(score, 0) + '% \u00b7 ' + passCount + ' pass \u00b7 ' + vetoCount + ' veto \u00b7 ' + naCount + ' n/a \u00b7 ' + verdictWhy + '</div></div>'
      + swingPlanHtml;
    setProg('goldProg', 0.65);
    /* ================= GOLD SCALP (always shows both sides) ================= */
    const c15 = m15.map(r => r.c), n15 = c15.length;
    const m15h = m15.map(r => r.h), m15l = m15.map(r => r.l);
    const lastClose = c15[n15 - 1];
    const atr15arr = atr(m15, 14), a15 = last(atr15arr);
    const vbase = atr15arr.slice(-96).filter(isFinite).sort((x, y) => x - y);
    const aMed = vbase.length ? vbase[Math.floor(vbase.length / 2)] : NaN;
    const volAlive = isFinite(a15) && isFinite(aMed) && a15 >= 0.8 * aMed;
    const e21h1 = last(ema(h1.map(r => r.c), 21));
    const look = m15.slice(-12);
    let haScalpOk = false, haScalpDetail = 'n/a';
    if (m15.length >= 5) { const ha15 = heikinAshi(m15); const last2 = ha15.slice(-2); haScalpOk = (casc === 'long' && last2.every(b => b.c > b.o)) || (casc === 'short' && last2.every(b => b.c < b.o)); haScalpDetail = 'HA(15m) ' + (haScalpOk ? 'aligned' : 'mixed'); }
    let will15Ok = false, will15Detail = 'n/a';
    if (m15.length >= 14) { const wr15 = williamsR(m15, 14); const w15 = last(wr15); will15Ok = (casc === 'long' && w15 > -20) ? false : ((casc === 'short' && w15 < -80) ? false : true); will15Detail = 'W%R(15m) ' + fmt(w15, 1); }
    let st15Ok = false, st15Detail = 'n/a';
    if (m15.length >= 15) { const st15 = superTrend(m15, 10, 3); st15Ok = (casc === 'long' && st15.trend[n15 - 1] === 1) || (casc === 'short' && st15.trend[n15 - 1] === -1); st15Detail = 'SuperTrend(15m) ' + (st15.trend[n15 - 1] === 1 ? 'UP' : 'DOWN'); }
    let macd15Ok = false, macd15Detail = 'n/a';
    if (c15.length >= 40) { const md15 = macdGold(c15); const h15Now = last(md15.hist), h15Prev = md15.hist[md15.hist.length - 2]; macd15Ok = (casc === 'long' && h15Now > h15Prev && h15Now > 0) || (casc === 'short' && h15Now < h15Prev && h15Now < 0); macd15Detail = 'MACD(15m) ' + fmt(h15Now, 4); }
    let svwapOk = false, svwapDetail = 'n/a';
    if (sess.kz && h1.length >= 30) { const kzStart = nowSec() - 3 * 3600; const kzRows = m15.filter(r => r.t >= kzStart); if (kzRows.length >= 4) { const sv = vwap(kzRows, kzRows.length); const svNow = last(sv); const dist = Math.abs(lastClose - svNow) / svNow * 100; svwapOk = dist < 0.15; svwapDetail = 'VWAP ' + px(svNow) + ' dist ' + fmt(dist, 3) + '%'; } }
    let aroon15Ok = false, aroon15Detail = 'n/a';
    if (m15.length >= 20) { const ar15 = aroon(m15, 14); const osc15 = last(ar15.osc); aroon15Ok = (casc === 'long' && osc15 > 0) || (casc === 'short' && osc15 < 0); aroon15Detail = 'Aroon(15m) ' + fmt(osc15, 1); }
    let cci15Ok = false, cci15Detail = 'n/a';
    if (m15.length >= 20) { const cc15 = cci(m15, 20); const cc15Now = last(cc15); cci15Ok = (casc === 'long' && cc15Now > 100) || (casc === 'short' && cc15Now < -100) ? true : ((casc === 'long' && cc15Now < -100) || (casc === 'short' && cc15Now > 100) ? false : true); cci15Detail = 'CCI(15m) ' + fmt(cc15Now, 1); }
    let bb15Ok = false, bb15Detail = 'n/a';
    if (c15.length >= 40) { const bb15 = bollingerBB(c15, 20, 2); bb15Ok = isFinite(bb15.pctB) && ((casc === 'long' && bb15.pctB > 0.2) || (casc === 'short' && bb15.pctB < 0.8)); bb15Detail = 'BB %B ' + fmt(bb15.pctB, 2) + (bb15.squeeze ? ' \u00b7 squeeze' : ''); }
    let stoch15Ok = false, stoch15Detail = 'n/a';
    if (c15.length >= 40) { const stx15 = stochastic(c15, m15h, m15l, 14, 3, 3); const k15 = last(stx15.k), d15 = last(stx15.d); stoch15Ok = isFinite(k15) && isFinite(d15) && ((casc === 'long' && k15 > d15) || (casc === 'short' && k15 < d15)); stoch15Detail = 'Stoch K ' + fmt(k15, 1) + ' / D ' + fmt(d15, 1); }
    let fish15Ok = false, fish15Detail = 'n/a';
    if (c15.length >= 30) { const ft15 = fisherTransform(c15, 10); const f15Now = last(ft15), f15Prev = ft15[ft15.length - 2]; fish15Ok = (casc === 'long' && f15Now > f15Prev) || (casc === 'short' && f15Now < f15Prev); fish15Detail = 'Fisher(15m) ' + fmt(f15Now, 2) + ' slope ' + (f15Now > f15Prev ? 'up' : 'down'); }
    let pat15Ok = false, pat15Detail = 'n/a';
    if (m15.length >= 3) { const pat = candlePattern(m15); const eng = pat.engulfing, pin = pat.pinBar; pat15Ok = (casc === 'long' && (eng === 'bull' || pin)) || (casc === 'short' && (eng === 'bear' || pin)); pat15Detail = (eng ? eng + ' engulf' : '') + (eng && pin ? ' \u00b7 ' : '') + (pin ? 'pin bar' : 'none'); }
    let or15Ok = false, or15Detail = 'n/a';
    if (sess.kz) { const or = sess.name === 'LONDON KZ' ? openingRange(m15, 180, 60) : (sess.name === 'NY KZ' ? openingRange(m15, 360, 60) : null); if (or) { or15Ok = (casc === 'long' && lastClose > or.hi) || (casc === 'short' && lastClose < or.lo); or15Detail = 'OR hi ' + px(or.hi) + ' lo ' + px(or.lo); } }
    function goldScalpLedger(dir){
      const lvls = dir === 'long' ? [['Asia low', asiaLo], ['PDL', PDL]] : [['Asia high', asiaHi], ['PDH', PDH]];
      let swept = null, sweptLvl = NaN, ext = NaN;
      for (const pair of lvls) { const nm = pair[0], lv = pair[1]; if (!isFinite(lv)) continue; if (dir === 'long' && Math.min(...look.map(r => r.l)) < lv) { swept = nm; sweptLvl = lv; ext = Math.min(...look.map(r => r.l)); break; } if (dir === 'short' && Math.max(...look.map(r => r.h)) > lv) { swept = nm; sweptLvl = lv; ext = Math.max(...look.map(r => r.h)); break; } }
      const reclaimed = swept && (dir === 'long' ? lastClose > sweptLvl : lastClose < sweptLvl);
      const htfOk = dir === 'long' ? lastClose > e21h1 : lastClose < e21h1;
      const g = [];
      g.push(['C1', 'Kill zone', sess.kz ? 'pass' : 'veto', sess.name]);
      g.push(['C2', 'Liquidity sweep', swept ? 'pass' : 'veto', swept ? 'swept ' + swept + ' ' + px(sweptLvl) + ' extreme ' + px(ext) : 'no sweep']);
      g.push(['C3', 'Reclaimed', reclaimed ? 'pass' : 'veto', swept ? px(lastClose) + ' vs ' + px(sweptLvl) : '\u2014']);
      g.push(['C4', '1H EMA21', htfOk ? 'pass' : 'veto', '1H EMA21 ' + px(e21h1)]);
      g.push(['C5', 'Vol alive', volAlive ? 'pass' : 'veto', 'ATR ' + px(a15) + ' med ' + px(aMed)]);
      g.push(['C6', 'HA(15m)', haScalpOk ? 'pass' : 'veto', haScalpDetail]);
      g.push(['C7', 'W%R(15m)', will15Ok ? 'pass' : 'veto', will15Detail]);
      g.push(['C8', 'SuperTrend(15m)', st15Ok ? 'pass' : 'veto', st15Detail]);
      g.push(['C9', 'MACD(15m)', macd15Ok ? 'pass' : 'veto', macd15Detail]);
      g.push(['C10', 'Session VWAP', svwapOk ? 'pass' : 'na', svwapDetail]);
      g.push(['C11', 'Aroon(15m)', aroon15Ok ? 'pass' : 'veto', aroon15Detail]);
      g.push(['C12', 'CCI(15m)', cci15Ok ? 'pass' : 'veto', cci15Detail]);
      g.push(['C13', 'DXY aligned', dxyOk, dxyGateDetail]);
      g.push(['C14', 'NFP/Event', !eventWin.active ? 'pass' : 'veto', eventWin.active ? eventWin.event : 'clear']);
      g.push(['C15', 'BB %B(15m)', bb15Ok ? 'pass' : 'veto', bb15Detail]);
      g.push(['C16', 'Stoch K/D(15m)', stoch15Ok ? 'pass' : 'veto', stoch15Detail]);
      g.push(['C17', 'Fisher(15m)', fish15Ok ? 'pass' : 'veto', fish15Detail]);
      g.push(['C18', 'Candle pattern', pat15Ok ? 'pass' : 'veto', pat15Detail]);
      g.push(['C19', 'Opening Range', or15Ok ? 'pass' : 'na', or15Detail]);
      let scalpEntry = lastClose, scalpStop, scalpRisk, scalpT1, scalpT2, scalpRr = 0;
      if (swept && reclaimed) {
        scalpStop = dir === 'long' ? ext - 0.25 * a15 : ext + 0.25 * a15;
        scalpRisk = Math.abs(scalpEntry - scalpStop);
        const oppoCands = (dir === 'long' ? [asiaHi, PDH] : [asiaLo, PDL]).filter(isFinite);
        const oppo = oppoCands.length ? (dir === 'long' ? Math.min(...oppoCands) : Math.max(...oppoCands)) : NaN;
        const room = dir === 'long' ? oppo - scalpEntry : scalpEntry - oppo;
        scalpRr = scalpRisk > 0 && isFinite(room) ? room / scalpRisk : 0;
        if (scalpRisk > 0) { scalpT1 = dir === 'long' ? scalpEntry + 2 * scalpRisk : scalpEntry - 2 * scalpRisk; scalpT2 = dir === 'long' ? scalpEntry + 3 * scalpRisk : scalpEntry - 3 * scalpRisk; }
        g.push(['C20', '2R to pool', scalpRr >= 2 ? 'pass' : 'veto', isFinite(room) ? 'room ' + px(room) + ' 2R ' + px(2 * scalpRisk) : '\u2014']);
      } else {
        scalpStop = dir === 'long' ? lastClose - 1.5 * a15 : lastClose + 1.5 * a15;
        scalpRisk = Math.abs(scalpEntry - scalpStop);
        if (scalpRisk > 0) { scalpT1 = dir === 'long' ? scalpEntry + 2 * scalpRisk : scalpEntry - 2 * scalpRisk; scalpT2 = dir === 'long' ? scalpEntry + 3 * scalpRisk : scalpEntry - 3 * scalpRisk; }
        g.push(['C20', '2R to pool', 'na', 'no sweep - ATR structure. Watch for sweep.']);
      }
      const passC = g.filter(x => x[2] === 'pass').length, vetoC = g.filter(x => x[2] === 'veto').length, totalC = g.filter(x => x[2] !== 'na').length;
      const scoreC = totalC > 0 ? (passC / totalC) * 100 : 0;
      let scalpLabel, scalpColor;
      if (scoreC >= 70 && vetoC === 0) { scalpLabel = dir.toUpperCase() + ' STRONG'; scalpColor = dir; }
      else if (scoreC >= 50) { scalpLabel = dir.toUpperCase() + ' MODERATE'; scalpColor = dir; }
      else if (scoreC >= 30) { scalpLabel = dir.toUpperCase() + ' WEAK'; scalpColor = dir; }
      else { scalpLabel = dir.toUpperCase() + ' BIAS ONLY'; scalpColor = 'aside'; }
      let planHtml = '';
      if (scalpRisk > 0) {
        logSetup(GOLD_SYM, dir, 'gold-scalp', scalpEntry, scalpStop, scalpT1);
        planHtml = '<div class="plan">' + planBlock(dir, scalpEntry, scalpStop, scalpT1, scalpT2 || scalpT1) + '</div>'
          + '<button class="toTrade" onclick="toTrade(\'' + GOLD_SYM + '\',\'' + dir + '\',' + scalpEntry + ',' + scalpStop + ')">SEND TO TRADE PLAN (XM 360) \u2192</button>'
          + '<div class="note" style="margin-top:6px">XM 360 scalp: 15m or 5m chart. ' + scalpLabel + '. Score ' + fmt(scoreC, 0) + '%. Spread check mandatory.</div>';
      }
      return '<div style="margin:2px 0 6px;font-size:11px;letter-spacing:.12em;color:var(--' + (dir === 'long' ? 'long' : 'short') + ')">' + scalpLabel + '</div>'
        + '<div class="ledger" style="margin-bottom:10px">' + g.map(x => gateRow(x[0], x[1], x[2], x[3])).join('') + '</div>'
        + '<div class="verdict ' + scalpColor + '" style="margin:0 0 16px"><div class="vword" style="font-size:16px">' + scalpLabel + '</div>'
        + '<div class="vwhy" style="font-size:10px">Score ' + fmt(scoreC, 0) + '% \u00b7 ' + passC + ' pass \u00b7 ' + vetoC + ' veto</div></div>' + planHtml;
    }
    $('goldScalpOut').innerHTML = goldScalpLedger('long') + goldScalpLedger('short');
    setProg('goldProg', 0.85);
    /* ================= BREAKOUT & MEAN REVERSION (v3.0) ================= */
    let breakoutHtml = '', meanRevHtml = '';
    if (c4.length >= 40) {
      const bb = bollingerBB(c4, 20, 2);
      const adxRising = isFinite(adxVal) && adxVal >= 20;
      const priceNow = c4[n];
      const bbFull = bollinger(c4, 20, 2);
      const bbUp = bbFull.upper[n], bbLo = bbFull.lower[n];
      const bbMid = bbFull.mid[n];
      if (bb.squeeze && adxRising) {
        const breakDir = priceNow > bbUp ? 'long' : (priceNow < bbLo ? 'short' : null);
        if (breakDir) {
          const bRisk = Math.abs(priceNow - bbMid);
          const bT1 = breakDir === 'long' ? priceNow + 2 * bRisk : priceNow - 2 * bRisk;
          breakoutHtml = '<div class="panel"><h2>Breakout Strategy <span>Bollinger squeeze + expansion</span></h2>'
            + '<div class="note">Squeeze detected. ADX ' + fmt(adxVal, 1) + '. Price closed outside band. Momentum expansion play.</div>'
            + '<div class="plan">' + planBlock(breakDir, priceNow, bbMid, bT1, bT1) + '</div></div>';
        }
      }
      const pat = candlePattern(h4);
      const revDir = (priceNow >= bbUp - 0.5 * a4 && (pat.engulfing === 'bear' || pat.pinBar)) ? 'short' : ((priceNow <= bbLo + 0.5 * a4 && (pat.engulfing === 'bull' || pat.pinBar)) ? 'long' : null);
      if (revDir && ((revDir === 'long' && r4 < 35) || (revDir === 'short' && r4 > 65))) {
        const mRisk = Math.abs(priceNow - bbMid);
        const mT1 = revDir === 'long' ? priceNow + 1.5 * mRisk : priceNow - 1.5 * mRisk;
        meanRevHtml = '<div class="panel"><h2>Mean Reversion <span>Band touch + reversal candle + RSI extreme</span></h2>'
          + '<div class="note">Price at band edge. ' + (pat.engulfing || 'no engulf') + ' \u00b7 ' + (pat.pinBar ? 'pin bar' : 'no pin') + ' \u00b7 RSI ' + fmt(r4, 1) + '. Counter-trend scalp.</div>'
          + '<div class="plan">' + planBlock(revDir, priceNow, bbMid, mT1, mT1) + '</div></div>';
      }
    }
    $('goldBreakoutOut').innerHTML = breakoutHtml || '<div class="empty">No breakout setup - no squeeze + expansion right now.</div>';
    $('goldMeanRevOut').innerHTML = meanRevHtml || '<div class="empty">No mean reversion setup - no band touch + reversal candle.</div>';
    /* Macro panel + Cheat Sheet */
    const dxyChipVal = dxyDir, tnxChipVal = tnxDir;
    $('goldMacroOut').innerHTML = ''
      + '<div class="panel"><div class="kv"><span class="k">Vol Regime</span><span class="v">' + vreg.label + '</span></div>'
        + '<div class="kv"><span class="k">Wyckoff</span><span class="v">' + wyk.label + '</span></div></div>'
      + '<div class="panel"><div class="kv"><span class="k">DXY</span><span class="v">' + dxyChipVal.toUpperCase() + '</span></div>'
        + '<div class="kv"><span class="k">TNX</span><span class="v">' + tnxChipVal.toUpperCase() + '</span></div>'
        + '<div class="kv"><span class="k">NFP</span><span class="v" style="color:' + (nfp ? 'var(--short)' : 'var(--pass)') + '">' + (nfp ? 'YES' : 'No') + '</span></div></div>'
      + '<div class="panel"><div class="kv"><span class="k">Session</span><span class="v">' + sess.name + '</span></div>'
        + '<div class="kv"><span class="k">Event</span><span class="v" style="color:' + (eventWin.active ? 'var(--short)' : 'var(--pass)') + '">' + (eventWin.active ? eventWin.event : 'Clear') + '</span></div>'
        + '<div class="kv"><span class="k">London Fix</span><span class="v">' + (isLondonFix() ? 'ACTIVE' : 'inactive') + '</span></div>'
        + '<div class="kv"><span class="k">NY Close</span><span class="v">' + (isNYClose() ? 'ACTIVE' : 'inactive') + '</span></div>'
        + '<div class="kv"><span class="k">Pivot</span><span class="v">PP ' + px(piv.pp) + ' R1 ' + px(piv.r1) + ' S1 ' + px(piv.s1) + '</span></div>'
        + '<div class="kv"><span class="k">Camarilla</span><span class="v">H4 ' + px(cam.h4) + ' L4 ' + px(cam.l4) + '</span></div></div>'
      + '<div class="panel"><h2>Gold Cheat Sheet <span>behavioral notes for XM 360</span></h2>'
        + '<div class="note">\u2022 London open (07:00 UTC) often sweeps Asia range - watch for Judas reclaim.</div>'
        + '<div class="note">\u2022 NY morning (12:00-14:00 UTC) = highest liquidity + cleanest moves.</div>'
        + '<div class="note">\u2022 NY afternoon (15:00-21:00 UTC) = chop / low volume. Reduce size.</div>'
        + '<div class="note">\u2022 NFP week (first Friday): widen stops, expect false breaks Wed-Thu.</div>'
        + '<div class="note">\u2022 London Fix (15:00 UTC) and NY Close (21:00 UTC) = spike risk. Avoid entries 15 min before/after.</div>'
        + '<div class="note">\u2022 Gold is anti-correlated to DXY and real yields. When both rise together, gold is trapped - range likely.</div>'
        + '<div class="note">\u2022 Bollinger squeeze on 4H often precedes $15-$30 moves within 24h.</div>'
        + '<div class="note">\u2022 Mean reversion works best at Asia high/low + London kill zone. Trend continuation works best in NY morning.</div></div>';
    $('goldStat').textContent = 'evaluated \u00b7 score ' + fmt(score, 0) + '% \u00b7 ' + new Date().toTimeString().slice(0, 5) + ' IST';
  } catch (e) {
    $('goldStat').textContent = 'Gold eval failed: ' + e.message;
    console.error(e);
  } finally {
    setProg('goldProg', null);
    setTimeout(function () { btn.disabled = false; }, 10000);
  }
}
function updateGoldDxy(){
  const sel = $('goldDxySelect'); if (sel) $('goldDxy').innerHTML = 'DXY <b>' + sel.value.toUpperCase() + '</b>';
}
function updateGoldTnx(){
  const sel = $('goldTnxSelect'); if (sel) $('goldTnx').innerHTML = 'TNX <b>' + sel.value.toUpperCase() + '</b>';
}

/* ---------- expose to window ---------- */
window.runGold = runGold;
window.updateGoldDxy = updateGoldDxy;
window.updateGoldTnx = updateGoldTnx;
})();
