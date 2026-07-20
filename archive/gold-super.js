/* SUPER GOLD MODULE v3.0 - parity with gold.js
   Patched: added 7 missing v3.0 indicators (S31-S37), fixed toTrade arity,
   cleaned dead updateSgDxy/updateSgTnx code.
   Data: getCandles (Delta India XAUTUSD). DXY/TNX are manual dropdowns. */
(function(){
'use strict';

/* =================== NEW: AUTOMATED MACRO (Yahoo Finance) =================== */
async function getAutomatedMacro(ticker){
  var url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)+'?range=10d&interval=1d';
  var _proxies=[function(u){return 'https://corsproxy.io/?url='+encodeURIComponent(u);},function(u){return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u);}];
  try{
    var r=null; for(var _pi=0;_pi<_proxies.length;_pi++){ try{ var _resp=await fetch(_proxies[_pi](url)); if(_resp&&_resp.ok){ r=_resp; break; } }catch(_pe){} }
    if(!r) return 'n/a';
    if(!r.ok) return 'n/a';
    var j=await r.json();
    var quote=j&&j.chart&&j.chart.result&&j.chart.result[0]&&j.chart.result[0].indicators&&j.chart.result[0].indicators.quote&&j.chart.result[0].indicators.quote[0];
    if(!quote||!quote.close) return 'n/a';
    var closes=quote.close.filter(function(c){return c!==null;});
    if(closes.length<5) return 'n/a';
    var cur=closes[closes.length-1], past=closes[closes.length-5];
    return cur>past?'up':'down';
  }catch(e){ if(typeof console!=='undefined') console.warn('Macro fetch failed for '+ticker,e); return 'n/a'; }
}
var _last = (typeof last==='function') ? last : function(a){ return a && a.length ? a[a.length-1] : NaN; };
var _ema = (typeof ema==='function') ? ema : function(src,n){ var out=[],k=2/(n+1),e=src[0]; for(var i=0;i<src.length;i++){ e=isFinite(src[i])?src[i]*k+e*(1-k):e; out.push(e);} return out; };
var _rsi = (typeof rsi==='function') ? rsi : function(src,n){ var out=[]; for(var i=0;i<src.length;i++) out.push(NaN); return out; };
var _atr = (typeof atr==='function') ? atr : function(rows,n){ var out=[]; for(var i=0;i<rows.length;i++){ out.push(i===0?rows[i].h-rows[i].l:Math.max(rows[i].h-rows[i].l,Math.abs(rows[i].h-rows[i-1].c),Math.abs(rows[i].l-rows[i-1].c))); } return out; };
var _adx = (typeof adx==='function') ? adx : function(rows,n){ return { adx:rows.map(function(){return NaN;}), plusDI:rows.map(function(){return NaN;}), minusDI:rows.map(function(){return NaN;}) }; };
var _roc = (typeof roc==='function') ? roc : function(src,n){ var out=[]; for(var i=0;i<src.length;i++){ out.push(i>=n&&src[i-n]?((src[i]-src[i-n])/src[i-n])*100:NaN); } return out; };
var _cusumLast = (typeof cusumLast==='function') ? cusumLast : function(){ return null; };
var _lastSwing = (typeof lastSwing==='function') ? lastSwing : function(rows,dir,n){ var idx=n||30; if(dir==='long'){ var lo=Infinity; for(var i=Math.max(0,rows.length-idx);i<rows.length;i++) lo=Math.min(lo,rows[i].l); return lo;} var hi=-Infinity; for(var j=Math.max(0,rows.length-idx);j<rows.length;j++) hi=Math.max(hi,rows[j].h); return hi; };
var _bollinger = (typeof bollinger==='function') ? bollinger : function(){ return {upper:[],mid:[],lower:[],widthPct:[]}; };
var _goldSession = (typeof goldSession==='function') ? goldSession : function(){ return {name:'OFF-SESSION',kz:false}; };
var _utcDayStart = (typeof utcDayStart==='function') ? utcDayStart : function(){ var d=new Date(); return Math.floor(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())/1000); };

/* =================== BASE INDICATORS =================== */
function heikinAshi(rows){ var ha=[]; for(var i=0;i<rows.length;i++){ var c=(rows[i].o+rows[i].h+rows[i].l+rows[i].c)/4; var o=i===0?rows[i].o:(ha[i-1].o+ha[i-1].c)/2; var h=Math.max(rows[i].h,o,c); var l=Math.min(rows[i].l,o,c); ha.push({o:o,h:h,l:l,c:c}); } return ha; }
function hullMA(vals,p){ p=p||20; function wma(src,len){ var out=new Array(src.length).fill(NaN); for(var i=len-1;i<src.length;i++){ var num=0,den=0; for(var j=0;j<len;j++){ num+=src[i-j]*(len-j); den+=(len-j);} out[i]=num/den; } return out; } var w1=wma(vals,Math.floor(p/2)); var w2=wma(vals,p); var raw=w1.map(function(v,i){ return isFinite(v)&&isFinite(w2[i])?2*v-w2[i]:NaN; }); return wma(raw,Math.floor(Math.sqrt(p))); }
function tema(vals,p){ p=p||20; var e1=_ema(vals,p); var e2=_ema(e1,p); var e3=_ema(e2,p); return e1.map(function(v,i){ return isFinite(v)&&isFinite(e2[i])&&isFinite(e3[i])?3*v-3*e2[i]+e3[i]:NaN; }); }
function donchian(rows,p){ p=p||20; var upper=new Array(rows.length).fill(NaN),lower=new Array(rows.length).fill(NaN),mid=new Array(rows.length).fill(NaN); for(var i=p-1;i<rows.length;i++){ var hh=Math.max.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.h;})); var ll=Math.min.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.l;})); upper[i]=hh;lower[i]=ll;mid[i]=(hh+ll)/2; } return {upper:upper,lower:lower,mid:mid}; }
function pivotPoints(d1){ if(!d1||d1.length<2) return {pp:NaN,r1:NaN,r2:NaN,r3:NaN,s1:NaN,s2:NaN,s3:NaN}; var p=d1[d1.length-2]; var pp=(p.h+p.l+p.c)/3; var range=p.h-p.l; return {pp:pp, r1:2*pp-p.l, r2:pp+range, r3:2*pp+range-2*p.l, s1:2*pp-p.h, s2:pp-range, s3:2*pp-range-2*p.h}; }
function camarilla(d1){ if(!d1||d1.length<2) return {h1:NaN,h2:NaN,h3:NaN,h4:NaN,l1:NaN,l2:NaN,l3:NaN,l4:NaN}; var p=d1[d1.length-2]; var range=p.h-p.l; return {h1:p.c+range*0.091,h2:p.c+range*0.183,h3:p.c+range*0.275,h4:p.c+range*0.55,l1:p.c-range*0.091,l2:p.c-range*0.183,l3:p.c-range*0.275,l4:p.c-range*0.55}; }
function williamsR(rows,p){ p=p||14; var out=new Array(rows.length).fill(NaN); for(var i=p-1;i<rows.length;i++){ var hh=Math.max.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.h;})),ll=Math.min.apply(null,rows.slice(i-p+1,i+1).map(function(r){return r.l;})); if(hh!==ll) out[i]=-100*(hh-rows[i].c)/(hh-ll); } return out; }
function keltner(rows,p,mult){ p=p||20;mult=mult||1.5; var emaArr=_ema(rows.map(function(r){return r.c;}),p); var atrArr=_atr(rows,p); return {upper:emaArr.map(function(v,i){return isFinite(v)&&isFinite(atrArr[i])?v+mult*atrArr[i]:NaN;}),lower:emaArr.map(function(v,i){return isFinite(v)&&isFinite(atrArr[i])?v-mult*atrArr[i]:NaN;}),mid:emaArr}; }
function parabolicSAR(rows,step,max){ step=step||0.02;max=max||0.2; var sar=new Array(rows.length).fill(NaN); var ep=rows[0].h,af=step,trend=1,prevSAR=rows[0].l; for(var i=1;i<rows.length;i++){ if(trend===1){ sar[i]=prevSAR+af*(ep-prevSAR); if(rows[i].l<sar[i]){ trend=-1;sar[i]=ep;prevSAR=ep;ep=rows[i].l;af=step; } else { if(rows[i].h>ep){ep=rows[i].h;af=Math.min(af+step,max);} prevSAR=sar[i]; } } else { sar[i]=prevSAR+af*(ep-prevSAR); if(rows[i].h>sar[i]){ trend=1;sar[i]=ep;prevSAR=ep;ep=rows[i].h;af=step; } else { if(rows[i].l<ep){ep=rows[i].l;af=Math.min(af+step,max);} prevSAR=sar[i]; } } } return {sar:sar,trend:trend}; }
function superTrend(rows,p,mult){ p=p||10;mult=mult||3; var atrArr=_atr(rows,p); var n=rows.length; var upperBasic=[],lowerBasic=[],upperBand=[],lowerBand=[],st=[]; for(var i=0;i<n;i++){ var mid=(rows[i].h+rows[i].l)/2; upperBasic[i]=mid+mult*atrArr[i];lowerBasic[i]=mid-mult*atrArr[i]; } upperBand[0]=upperBasic[0];lowerBand[0]=lowerBasic[0];st[0]=1; for(var j=1;j<n;j++){ upperBand[j]=upperBasic[j]<upperBand[j-1]||rows[j-1].c>upperBand[j-1]?upperBasic[j]:upperBand[j-1]; lowerBand[j]=lowerBasic[j]>lowerBand[j-1]||rows[j-1].c<lowerBand[j-1]?lowerBasic[j]:lowerBand[j-1]; st[j]=st[j-1]===1?(rows[j].c>upperBand[j-1]?1:-1):(rows[j].c<lowerBand[j-1]?-1:1); } return {upperBand:upperBand,lowerBand:lowerBand,trend:st,atr:atrArr}; }
function stochRsi(vals,p,k,d){ p=p||14;k=k||14;d=d||3; var rsiArr=_rsi(vals,p); var stoch=new Array(rsiArr.length).fill(NaN); for(var i=p+k-2;i<rsiArr.length;i++){ var slice=rsiArr.slice(i-k+1,i+1).filter(isFinite); if(!slice.length) continue; var hh=Math.max.apply(null,slice),ll=Math.min.apply(null,slice); if(hh!==ll) stoch[i]=100*(rsiArr[i]-ll)/(hh-ll); } return {stoch:stoch,k:_ema(stoch,3),d:_ema(_ema(stoch,3),3)}; }
function macdGold(vals){ var ef=_ema(vals,12),es=_ema(vals,26); var line=vals.map(function(_,i){return ef[i]-es[i];}); var sig=_ema(line.map(function(v){return isNaN(v)?0:v;}),9); var hist=vals.map(function(_,i){return line[i]-sig[i];}); return {line:line,sig:sig,hist:hist,momentum:hist}; }
function mfi(rows,p){ p=p||14; var tp=rows.map(function(r){return (r.h+r.l+r.c)/3;}); var out=new Array(rows.length).fill(NaN); var posFlow=0,negFlow=0; for(var i=1;i<rows.length;i++){ var rawMF=tp[i]*rows[i].v; posFlow+=tp[i]>tp[i-1]?rawMF:0; negFlow+=tp[i]<tp[i-1]?rawMF:0; if(i>=p){ var ratio=posFlow/negFlow; out[i]=isFinite(ratio)?100-100/(1+ratio):NaN; var oldMF=tp[i-p+1]*rows[i-p+1].v; posFlow-=tp[i-p+1]>tp[i-p]?oldMF:0; negFlow-=tp[i-p+1]<tp[i-p]?oldMF:0; } } return out; }
function cmf(rows,p){ p=p||20; var out=new Array(rows.length).fill(NaN); for(var i=p-1;i<rows.length;i++){ var mfm=0,mfv=0; for(var j=i-p+1;j<=i;j++){ var m=((rows[j].c-rows[j].l)-(rows[j].h-rows[j].c))/(rows[j].h-rows[j].l||1e-9); mfm+=m*rows[j].v;mfv+=rows[j].v; } if(mfv>0) out[i]=mfm/mfv; } return out; }
function obv(rows){ var out=new Array(rows.length).fill(0); for(var i=1;i<rows.length;i++){ out[i]=out[i-1]+(rows[i].c>rows[i-1].c?rows[i].v:(rows[i].c<rows[i-1].c?-rows[i].v:0)); } return out; }
function awesomeOscillator(rows){ var mp=rows.map(function(r){return (r.h+r.l)/2;}); var s5=_ema(mp,5),s34=_ema(mp,34); return mp.map(function(_,i){return s5[i]-s34[i];}); }
function elderRay(rows,p){ p=p||13; var emaArr=_ema(rows.map(function(r){return r.c;}),p); return rows.map(function(r,i){ var bp=r.h-emaArr[i],bm=r.l-emaArr[i]; return {bp:isFinite(bp)?bp:NaN,bm:isFinite(bm)?bm:NaN}; }); }
function aroon(rows,p){ p=p||14; var up=new Array(rows.length).fill(NaN),down=new Array(rows.length).fill(NaN),osc=new Array(rows.length).fill(NaN); for(var i=p;i<rows.length;i++){ var hh=-Infinity,ll=Infinity,hi=i,li=i; for(var j=i-p+1;j<=i;j++){ if(rows[j].h>=hh){hh=rows[j].h;hi=j;} if(rows[j].l<=ll){ll=rows[j].l;li=j;} } up[i]=100*(p-(i-hi))/p;down[i]=100*(p-(i-li))/p;osc[i]=up[i]-down[i]; } return {up:up,down:down,osc:osc}; }
function cci(rows,p){ p=p||20; var out=new Array(rows.length).fill(NaN); var tp=rows.map(function(r){return (r.h+r.l+r.c)/3;}); for(var i=p-1;i<rows.length;i++){ var slice=tp.slice(i-p+1,i+1); var m=slice.reduce(function(a,b){return a+b;},0)/slice.length; var md=slice.reduce(function(a,b){return a+Math.abs(b-m);},0)/slice.length; if(md>0) out[i]=(tp[i]-m)/(0.015*md); } return out; }
function ichimoku(rows){ var c=rows.map(function(r){return r.c;}),h=rows.map(function(r){return r.h;}),l=rows.map(function(r){return r.l;}),n=c.length; var tenkan=new Array(n).fill(NaN),kijun=new Array(n).fill(NaN),senkouA=new Array(n).fill(NaN),senkouB=new Array(n).fill(NaN),chikou=new Array(n).fill(NaN); for(var i=0;i<n;i++){ if(i>=8){ tenkan[i]=(Math.max.apply(null,h.slice(i-8,i+1))+Math.min.apply(null,l.slice(i-8,i+1)))/2; } if(i>=25){ kijun[i]=(Math.max.apply(null,h.slice(i-25,i+1))+Math.min.apply(null,l.slice(i-25,i+1)))/2; } if(i>=25){ senkouA[i]=(tenkan[i]+kijun[i])/2; } if(i>=52){ senkouB[i]=(Math.max.apply(null,h.slice(i-52,i+1))+Math.min.apply(null,l.slice(i-52,i+1)))/2; } chikou[i]=c[i]; } return {tenkan:tenkan,kijun:kijun,senkouA:senkouA,senkouB:senkouB,chikou:chikou}; }
function fibLevels(high,low){ var diff=high-low; return {"0":high,"23.6":high-diff*0.236,"38.2":high-diff*0.382,"50":high-diff*0.5,"61.8":high-diff*0.618,"78.6":high-diff*0.786,"100":low}; }
function vwap(rows,look){ look=look||rows.length; var n=rows.length; if(n<2) return new Array(n).fill(NaN); var out=new Array(n).fill(NaN); for(var i=0;i<n;i++){ var start=Math.max(0,i-look+1); var pv=0,vv=0; for(var j=start;j<=i;j++){ var typ=(rows[j].h+rows[j].l+rows[j].c)/3; pv+=typ*rows[j].v;vv+=rows[j].v; } if(vv>0) out[i]=pv/vv; } return out; }
function wyckoffPhase(rows){ if(rows.length<60) return {phase:"unknown",label:"UNKNOWN"}; var c=rows.map(function(r){return r.c;}),n=c.length; var bb=_bollinger(c,20,2); var vols=rows.slice(-20).map(function(r){return r.v;}).filter(function(v){return v>0;}); var avgVol=vols.length?vols.reduce(function(a,b){return a+b;},0)/vols.length:0; var recentVol=rows.slice(-5).map(function(r){return r.v;}).filter(function(v){return v>0;}); var rVol=recentVol.length?recentVol.reduce(function(a,b){return a+b;},0)/recentVol.length:0; var inRange=Math.abs(c[n-1]-bb.mid[n-1])/bb.mid[n-1]<0.02; var spring=c[n-1]<bb.lower[n-1]&&c[n-2]>c[n-1]&&c[n-1]>rows[n-1].l; if(spring) return {phase:"spring",label:"WYCKOFF SPRING"}; if(inRange&&rVol<avgVol*0.7) return {phase:"compression",label:"COMPRESSION"}; if(c[n-1]>bb.upper[n-1]&&rVol>avgVol*1.3) return {phase:"markup",label:"MARKUP"}; if(c[n-1]<bb.lower[n-1]&&rVol>avgVol*1.3) return {phase:"markdown",label:"MARKDOWN"}; return {phase:"neutral",label:"NEUTRAL"}; }
function isNFPWeek(){ var d=new Date(); var firstDay=new Date(d.getFullYear(),d.getMonth(),1); var firstFriday=1+((5-firstDay.getDay()+7)%7); var nfpDay=new Date(d.getFullYear(),d.getMonth(),firstFriday); var diff=Math.floor((d-nfpDay)/86400000); return diff>=-1&&diff<=1; }
function isEventWindow(){ var d=new Date(); var day=d.getUTCDay(),hour=d.getUTCHours(); if(day===5&&isNFPWeek()&&hour>=12&&hour<=15) return {active:true,event:"NFP WINDOW"}; if(day===3&&hour>=18&&hour<=21) return {active:false,event:"POSSIBLE FOMC"}; return {active:false,event:"none"}; }
function isLondonFix(){ var d=new Date(); return d.getUTCHours()===15&&d.getUTCMinutes()<=30; }
function isNYClose(){ var d=new Date(); return d.getUTCHours()===21&&d.getUTCMinutes()<=30; }
function volRegime(rows,p){ p=p||14; var a=_atr(rows,p); var valid=a.slice(-60).filter(isFinite); if(valid.length<20) return {regime:"unknown",label:"n/a"}; var now=_last(a); var pct2=valid.filter(function(v){return v<=now;}).length/valid.length; return pct2<=0.33?{regime:"low",label:"LOW volatility"}:pct2>=0.67?{regime:"high",label:"HIGH volatility"}:{regime:"medium",label:"MEDIUM volatility"}; }

/* =================== NEW v3.0 INDICATORS =================== */
function bollingerBB(vals, p, mult){
  p = p || 20; mult = mult || 2;
  const bb = _bollinger(vals, p, mult);
  const n = vals.length;
  const up = bb.upper[n-1], lo = bb.lower[n-1], mid = bb.mid[n-1];
  const pctB = (isFinite(up) && isFinite(lo) && up !== lo) ? (vals[n-1] - lo) / (up - lo) : NaN;
  const widths = bb.widthPct.filter(isFinite);
  const bw = widths.length ? widths[widths.length - 1] : NaN;
  const avgW = widths.length > 20 ? widths.slice(-20).reduce(function(a,b){return a+b;},0) / 20 : NaN;
  return { pctB: pctB, bw: bw, avgW: avgW, squeeze: isFinite(bw) && isFinite(avgW) && bw < avgW * 0.8 };
}
function stochastic(vals, highs, lows, p, k, d){
  p = p || 14; k = k || 3; d = d || 3;
  const n = vals.length;
  const kRaw = new Array(n).fill(NaN);
  for (let i = p - 1; i < n; i++){
    const hh = Math.max.apply(null, highs.slice(i - p + 1, i + 1));
    const ll = Math.min.apply(null, lows.slice(i - p + 1, i + 1));
    if (hh !== ll) kRaw[i] = 100 * (vals[i] - ll) / (hh - ll);
  }
  const kLine = _ema(kRaw, k);
  const dLine = _ema(kLine, d);
  return { k: kLine, d: dLine };
}
function fisherTransform(vals, p){
  p = p || 10;
  const n = vals.length;
  const out = new Array(n).fill(NaN);
  let v1 = 0;
  for (let i = 0; i < n; i++){
    const hi = Math.max.apply(null, vals.slice(Math.max(0, i - p + 1), i + 1));
    const lo = Math.min.apply(null, vals.slice(Math.max(0, i - p + 1), i + 1));
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
function rsiDivergenceSG(vals, rsiArr, p){
  p = p || 14;
  const n = vals.length;
  let regDiv = null, hidDiv = null;
  for (let i = p + 10; i < n; i++){
    const w1 = i - p - 5, w2 = i - 5;
    const pl1 = Math.min.apply(null, vals.slice(Math.max(0, w1 - 10), w1 + 1));
    const pl2 = Math.min.apply(null, vals.slice(Math.max(0, w2 - 10), w2 + 1));
    const rl1 = Math.min.apply(null, rsiArr.slice(Math.max(0, w1 - 10), w1 + 1).filter(isFinite));
    const rl2 = Math.min.apply(null, rsiArr.slice(Math.max(0, w2 - 10), w2 + 1).filter(isFinite));
    if (pl2 < pl1 && isFinite(rl2) && isFinite(rl1) && rl2 > rl1) regDiv = 'bull';
    if (pl2 > pl1 && isFinite(rl2) && isFinite(rl1) && rl2 < rl1) hidDiv = 'bull';
    const ph1 = Math.max.apply(null, vals.slice(Math.max(0, w1 - 10), w1 + 1));
    const ph2 = Math.max.apply(null, vals.slice(Math.max(0, w2 - 10), w2 + 1));
    const rh1 = Math.max.apply(null, rsiArr.slice(Math.max(0, w1 - 10), w1 + 1).filter(isFinite));
    const rh2 = Math.max.apply(null, rsiArr.slice(Math.max(0, w2 - 10), w2 + 1).filter(isFinite));
    if (ph2 > ph1 && isFinite(rh2) && isFinite(rh1) && rh2 < rh1) regDiv = 'bear';
    if (ph2 < ph1 && isFinite(rh2) && isFinite(rh1) && rh2 > rh1) hidDiv = 'bear';
  }
  return { regular: regDiv, hidden: hidDiv };
}
function atrTrailingStop(rows, p, mult){
  p = p || 14; mult = mult || 3;
  const a = _atr(rows, p);
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
  return { stop: stop, trend: trend };
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
  return { engulfing: bullEng ? 'bull' : (bearEng ? 'bear' : false), pinBar: pin, doji: doji };
}
function openingRange(rows, startMin, durMin){
  const start = (typeof nowSec === 'function' ? nowSec() : Math.floor(Date.now()/1000)) - startMin * 60;
  const dur = durMin * 60;
  const or = rows.filter(function(r){ return r.t >= start && r.t < start + dur; });
  if (!or.length) return null;
  const hi = Math.max.apply(null, or.map(function(r){ return r.h; }));
  const lo = Math.min.apply(null, or.map(function(r){ return r.l; }));
  return { hi: hi, lo: lo, mid: (hi + lo) / 2 };
}

/* =================== MAIN EVALUATION =================== */
async function runSuperGold(){
  var btn=$("superGoldRun"); if(btn) btn.disabled=true; setProg("sgProg",0.05);
  var st=$("sgStat"); if(st) st.textContent="loading XAUUSD...";
  var _exPrev=(typeof S!=="undefined")?S.exchange:null;
  try{
    if(typeof S!=="undefined") S.exchange="delta";
    var res=await Promise.all([
      getCandles("XAUTUSD","1d",1500).catch(function(){return [];}),
      getCandles("XAUTUSD","1d",260).catch(function(){return [];}),
      getCandles("XAUTUSD","4h",300).catch(function(){return [];}),
      getCandles("XAUTUSD","1h",200).catch(function(){return [];}),
      getCandles("XAUTUSD","15m",200).catch(function(){return [];})
    ]);
    var w1=res[0],d1=res[1],h4=res[2],h1=res[3],m15=res[4];
    setProg("sgProg",0.25);
    if(d1.length<60||h4.length<210||m15.length<40){ if(st) st.textContent="not enough XAUUSD history"; return; }
    var sess=_goldSession();
    if($("sgSess")) $("sgSess").innerHTML="session <b>"+sess.name+"</b>";
    var nfp=isNFPWeek();
    if($("sgNfp")) $("sgNfp").innerHTML="NFP <b>"+(nfp?"THIS WEEK":"clear")+"</b>";
    /* NEW: auto-fill DXY/TNX dropdowns from Yahoo Finance when left unset (manual override preserved) */
    try{
      var _dxyEl=$("sgDxySelect"), _tnxEl=$("sgTnxSelect");
      var _dxyUnset=!_dxyEl||_dxyEl.value===''||_dxyEl.value==='n/a';
      var _tnxUnset=!_tnxEl||_tnxEl.value===''||_tnxEl.value==='n/a';
      if(_dxyUnset||_tnxUnset){
        var _macro=await Promise.all([_dxyUnset?getAutomatedMacro('DX-Y.NYB'):Promise.resolve(null),_tnxUnset?getAutomatedMacro('^TNX'):Promise.resolve(null)]);
        if(_dxyEl&&_macro[0]&&_macro[0]!=='n/a') _dxyEl.value=(_macro[0]==='up'?'bullish':'bearish');
        if(_tnxEl&&_macro[1]&&_macro[1]!=='n/a') _tnxEl.value=(_macro[1]==='up'?'rising':'falling');
      }
    }catch(_e){ if(typeof console!=='undefined') console.warn('Auto-macro skipped',_e); }
    var dxySelect=$("sgDxySelect"); var dxyDir=dxySelect?dxySelect.value:"n/a";
    if($("sgDxy")) $("sgDxy").innerHTML="DXY <b>"+dxyDir.toUpperCase()+"</b>";
    var tnxSelect=$("sgTnxSelect"); var tnxDir=tnxSelect?tnxSelect.value:"n/a";
    if($("sgTnx")) $("sgTnx").innerHTML="TNX <b>"+tnxDir.toUpperCase()+"</b>";
    setProg("sgProg",0.35);
    var wStruct="mixed",wHigh=NaN,wLow=NaN;
    if(w1.length>=100){
      var weeks=[]; var curWeek={h:-Infinity,l:Infinity,c:null};
      for(var wi=0;wi<w1.length;wi++){ curWeek.h=Math.max(curWeek.h,w1[wi].h);curWeek.l=Math.min(curWeek.l,w1[wi].l);curWeek.c=w1[wi].c; if(wi%5===4||wi===w1.length-1){ weeks.push({h:curWeek.h,l:curWeek.l,c:curWeek.c}); curWeek={h:-Infinity,l:Infinity,c:null}; } }
      if(weeks.length>=10){
        var wc=weeks.map(function(w){return w.c;});
        wStruct=_last(wc)>_last(_ema(wc,9))&&_last(_ema(wc,9))>_last(_ema(wc,21))?"long":(_last(wc)<_last(_ema(wc,9))&&_last(_ema(wc,9))<_last(_ema(wc,21))?"short":"mixed");
        wHigh=Math.max.apply(null,weeks.slice(-4).map(function(w){return w.h;})); wLow=Math.min.apply(null,weeks.slice(-4).map(function(w){return w.l;}));
      }
    }
    var pdc=d1[d1.length-1],PDH=pdc.h,PDL=pdc.l;
    var day0now=_utcDayStart(),day0=(nowSec()<day0now+7*3600)?day0now-86400:day0now;
    var asia=m15.filter(function(r){return r.t>=day0&&r.t<day0+7*3600;});
    var asiaHi=asia.length?Math.max.apply(null,asia.map(function(r){return r.h;})):NaN;
    var asiaLo=asia.length?Math.min.apply(null,asia.map(function(r){return r.l;})):NaN;
    var eventWin=isEventWindow();
    var piv=pivotPoints(d1),cam=camarilla(d1);
    var vreg=volRegime(h4,14);
    var c4=h4.map(function(r){return r.c;}),c1=d1.map(function(r){return r.c;});
    var h4h=h4.map(function(r){return r.h;}), h4l=h4.map(function(r){return r.l;});
    var e9=_last(_ema(c4,9)),e21=_last(_ema(c4,21)),e50=_last(_ema(c4,50));
    var a4=_last(_atr(h4,14));
    var e50d=_last(_ema(c1,50)),pd=_last(c1);
    var r4=_last(_rsi(c4,14));
    var casc=e9>e21&&e21>e50?"long":(e9<e21&&e21<e50?"short":"mixed");
    var spreadOk=isFinite(a4)&&Math.abs(e21-e50)>=0.25*a4;
    var dSide=pd>e50d?"long":"short";
    var n=c4.length-1;
    var haOk=false,haDetail="n/a";
    if(h4.length>=10){ var ha=heikinAshi(h4); var last3=ha.slice(-3); var allG=last3.every(function(b){return b.c>b.o;}),allR=last3.every(function(b){return b.c<b.o;}); haDetail=allG?"all green":(allR?"all red":"mixed"); haOk=(casc==="long"&&allG)||(casc==="short"&&allR); }
    var hullOk=false,hullDetail="n/a";
    if(c4.length>=30){ var hma=hullMA(c4,20); var hn=_last(hma),hp=hma[hma.length-2]; hullOk=(casc==="long"&&hn>hp)||(casc==="short"&&hn<hp); hullDetail="Hull "+px(hn)+" slope "+(hn>hp?"rising":"falling"); }
    var temaOk=false,temaDetail="n/a";
    if(c4.length>=30){ var tma=tema(c4,20); var tn=_last(tma),tp2=tma[tma.length-2]; temaOk=(casc==="long"&&tn>tp2)||(casc==="short"&&tn<tp2); temaDetail="TEMA "+px(tn)+" slope "+(tn>tp2?"rising":"falling"); }
    var donOk=false,donDetail="n/a";
    if(h4.length>=25){ var dch=donchian(h4,20); var pNow=c4[n]; donOk=(casc==="long"&&pNow>=dch.upper[n]-0.3*a4)||(casc==="short"&&pNow<=dch.lower[n]+0.3*a4); donDetail="Donchian up "+px(dch.upper[n])+" low "+px(dch.lower[n])+" price "+px(pNow); }
    var psarOk=false,psarDetail="n/a";
    if(h4.length>=10){ var ps=parabolicSAR(h4,0.02,0.2); psarOk=(casc==="long"&&ps.trend===1)||(casc==="short"&&ps.trend===-1); psarDetail="SAR "+px(ps.sar[ps.sar.length-1])+" trend "+(ps.trend===1?"UP":"DOWN"); }
    var stOk=false,stDetail="n/a";
    if(h4.length>=15){ var stt=superTrend(h4,10,3); stOk=(casc==="long"&&stt.trend[n]===1)||(casc==="short"&&stt.trend[n]===-1); stDetail="SuperTrend "+px(stt.upperBand[n])+"/"+px(stt.lowerBand[n])+" -> "+(stt.trend[n]===1?"UP":"DOWN"); }
    var ichiOk=false,ichiDetail="n/a";
    if(h4.length>=60){ var ic=ichimoku(h4); var pAk=isFinite(ic.senkouA[n-26])&&isFinite(ic.senkouB[n-26])&&c4[n]>Math.max(ic.senkouA[n-26],ic.senkouB[n-26]); var pBk=isFinite(ic.senkouA[n-26])&&isFinite(ic.senkouB[n-26])&&c4[n]<Math.min(ic.senkouA[n-26],ic.senkouB[n-26]); var tk=ic.tenkan[n]>ic.kijun[n]; ichiDetail="TK "+(tk?"bull":"bear")+" Kumo "+(pAk?"above":(pBk?"below":"inside")); if(casc==="long") ichiOk=tk&&pAk; if(casc==="short") ichiOk=!tk&&pBk; }
    var adx4=_adx(h4,14); var adxVal=adx4.adx[n],diPlus=adx4.plusDI[n],diMinus=adx4.minusDI[n];
    var adxOk=isFinite(adxVal)&&adxVal>=25&&((casc==="long"&&diPlus>diMinus)||(casc==="short"&&diMinus>diPlus));
    var fibDetail="n/a",fibOk=false;
    if(isFinite(wHigh)&&isFinite(wLow)&&casc!=="mixed"){ var fib=fibLevels(wHigh,wLow); var pNow2=c4[n]; fibOk=pNow2>=fib["38.2"]&&pNow2<=fib["61.8"]; fibDetail="38.2pct "+px(fib["38.2"])+" 50pct "+px(fib["50"])+" 61.8pct "+px(fib["61.8"]); }
    var wyk=wyckoffPhase(h4);
    var dxyOk="na",dxyGateDetail="manual input";
    if(dxyDir!=="n/a"&&casc!=="mixed"){ dxyOk=(casc==="long"&&dxyDir==="bearish")||(casc==="short"&&dxyDir==="bullish")?"pass":"veto"; dxyGateDetail=dxyDir.toUpperCase()+(casc==="long"?" (gold wants weak DXY)":" (gold wants strong DXY)"); }
    var tnxOk="na",tnxGateDetail="manual input";
    if(tnxDir!=="n/a"&&casc!=="mixed"){ tnxOk=(casc==="long"&&tnxDir==="falling")||(casc==="short"&&tnxDir==="rising")?"pass":"veto"; tnxGateDetail=tnxDir.toUpperCase()+(casc==="long"?" (gold wants yields falling)":" (gold wants yields rising)"); }
    var rsiVeto=(casc==="long"&&r4>70)||(casc==="short"&&r4<30);
    var willOk=false,willDetail="n/a";
    if(h4.length>=14){ var wr=williamsR(h4,14); var wNow=_last(wr); willOk=(casc==="long"&&wNow>-20)||(casc==="short"&&wNow<-80)?false:true; willDetail="W%R "+fmt(wNow,1)+(willOk?" not extreme":" EXHAUSTED"); }
    var cciOk=false,cciDetail="n/a";
    if(h4.length>=20){ var cc=cci(h4,20); var ccNow=_last(cc); cciOk=(casc==="long"&&ccNow>100)||(casc==="short"&&ccNow<-100)?true:(((casc==="long"&&ccNow<-100)||(casc==="short"&&ccNow>100))?false:true); cciDetail="CCI "+fmt(ccNow,1)+(cciOk?" momentum aligned":" momentum AGAINST"); }
    var keltOk=false,keltDetail="n/a";
    if(h4.length>=25){ var kc=keltner(h4,20,1.5); keltOk=(casc==="long"&&c4[n]>kc.mid[n])||(casc==="short"&&c4[n]<kc.mid[n]); keltDetail="price "+px(c4[n])+" mid "+px(kc.mid[n]); }
    var srsiOk=false,srsiDetail="n/a";
    if(c4.length>=40){ var sr=stochRsi(c4,14,14,3); var kNow=_last(sr.k); srsiOk=isFinite(kNow)&&((casc==="long"&&kNow<80)||(casc==="short"&&kNow>20)); srsiDetail="StochRSI K "+fmt(kNow,1)+(srsiOk?" not extreme":" EXHAUSTED"); }
    var macdOk=false,macdDetail="n/a";
    if(c4.length>=40){ var md=macdGold(c4); var hNow=_last(md.hist),hPrev=md.hist[md.hist.length-2]; macdOk=(casc==="long"&&hNow>hPrev&&hNow>0)||(casc==="short"&&hNow<hPrev&&hNow<0); macdDetail="MACD hist "+fmt(hNow,4)+" slope "+(hNow>hPrev?"rising":"falling"); }
    var mfiOk=false,mfiDetail="n/a";
    if(h4.length>=20){ var mf=mfi(h4,14); var mfNow=_last(mf); mfiOk=isFinite(mfNow)&&((casc==="long"&&mfNow>50)||(casc==="short"&&mfNow<50)); mfiDetail="MFI "+fmt(mfNow,1)+(mfiOk?" flow aligned":" flow AGAINST"); }
    var cmfOk=false,cmfDetail="n/a";
    if(h4.length>=20){ var cf=cmf(h4,20); var cfNow=_last(cf); cmfOk=isFinite(cfNow)&&((casc==="long"&&cfNow>0)||(casc==="short"&&cfNow<0)); cmfDetail="CMF "+fmt(cfNow,4)+(cmfOk?" buying pressure":" selling pressure"); }
    var elderOk=false,elderDetail="n/a";
    if(h4.length>=20){ var er=elderRay(h4,13); var bp=_last(er.map(function(r){return r.bp;})),bm=_last(er.map(function(r){return r.bm;})); elderOk=(casc==="long"&&bp>0)||(casc==="short"&&bm<0); elderDetail="bull "+fmt(bp,2)+" bear "+fmt(bm,2); }
    var obvOk=false,obvDetail="n/a";
    if(h4.length>=20){ var ob=obv(h4); var oNow=_last(ob),oPrev=ob[ob.length-2]; obvOk=(casc==="long"&&oNow>oPrev)||(casc==="short"&&oNow<oPrev); obvDetail="OBV "+fmt(oNow,0)+" slope "+(oNow>oPrev?"rising":"falling"); }
    var aoOk=false,aoDetail="n/a";
    if(h4.length>=40){ var ao=awesomeOscillator(h4); var aoNow=_last(ao),aoPrev=ao[ao.length-2]; aoOk=(casc==="long"&&aoNow>aoPrev&&aoNow>0)||(casc==="short"&&aoNow<aoPrev&&aoNow<0); aoDetail="AO "+fmt(aoNow,2)+" slope "+(aoNow>aoPrev?"rising":"falling"); }
    var aroonOk=false,aroonDetail="n/a";
    if(h4.length>=20){ var ar=aroon(h4,14); var oscNow=_last(ar.osc); aroonOk=(casc==="long"&&oscNow>0)||(casc==="short"&&oscNow<0); aroonDetail="Aroon "+fmt(oscNow,1)+(aroonOk?" trend aligned":" trend AGAINST"); }
    var r30g=_roc(c1,30),r90g=_roc(c1,90); var r30v=_last(r30g),r90v=_last(r90g);
    var tsmom="na";
    if(casc!=="mixed"&&isFinite(r30v)&&isFinite(r90v)){ var want=casc==="long"?1:-1; var agree=(Math.sign(r30v)===want?1:0)+(Math.sign(r90v)===want?1:0); tsmom=agree===2?"pass":agree===0?"veto":"na"; }
    var evG=_cusumLast(c4.slice(-120),1);
    var cusum="na"; if(evG&&evG.barsAgo<=20&&casc!=="mixed") cusum=evG.dir===casc?"pass":"veto";
    var lfix=isLondonFix(),nyClose=isNYClose();
    var timeNote=(lfix?"London Fix active - expect volatility":"")+(nyClose?" NY Close active - expect volatility":"");
    /* ---- NEW v3.0 indicators ---- */
    var bbOk=false, bbSqueeze=false, bbDetail="n/a";
    if(c4.length>=40){ var bb=bollingerBB(c4,20,2); bbOk=isFinite(bb.pctB)&&((casc==="long"&&bb.pctB>0.2)||(casc==="short"&&bb.pctB<0.8)); bbSqueeze=bb.squeeze; bbDetail="%B "+fmt(bb.pctB,2)+(bbSqueeze?" · SQUEEZE":" · expanded"); }
    var stochOk=false, stochDetail="n/a";
    if(c4.length>=40){ var stx=stochastic(c4,h4h,h4l,14,3,3); var kNow2=_last(stx.k), dNow=_last(stx.d); stochOk=isFinite(kNow2)&&isFinite(dNow)&&((casc==="long"&&kNow2>dNow)||(casc==="short"&&kNow2<dNow)); stochDetail="Stoch K "+fmt(kNow2,1)+" / D "+fmt(dNow,1); }
    var fishOk=false, fishDetail="n/a";
    if(c4.length>=30){ var ft=fisherTransform(c4,10); var fNow=_last(ft), fPrev=ft[ft.length-2]; fishOk=(casc==="long"&&fNow>fPrev)||(casc==="short"&&fNow<fPrev); fishDetail="Fisher "+fmt(fNow,2)+" slope "+(fNow>fPrev?"up":"down"); }
    var lrsOk=false, lrsDetail="n/a";
    if(c4.length>=30){ var lrs=linearRegSlope(c4,20); var sNow=_last(lrs); lrsOk=isFinite(sNow)&&((casc==="long"&&sNow>0)||(casc==="short"&&sNow<0)); lrsDetail="LReg slope "+fmt(sNow,4); }
    var divOk=false, divDetail="n/a";
    if(c4.length>=60){ var rArr=_rsi(c4,14); var div=rsiDivergenceSG(c4,rArr,14); var reg=div.regular, hid=div.hidden; divOk=(casc==="long"&&(reg==="bull"||hid==="bull"))||(casc==="short"&&(reg==="bear"||hid==="bear")); divDetail="reg "+(reg||"none")+" · hid "+(hid||"none"); }
    var atrStopOk=false, atrStopDetail="n/a", atrStopVal=NaN;
    if(h4.length>=20){ var ats=atrTrailingStop(h4,14,3); var tNow=ats.trend; atrStopOk=(casc==="long"&&tNow===1)||(casc==="short"&&tNow===-1); atrStopVal=ats.stop[ats.stop.length-1]; atrStopDetail="ATR-TS "+px(atrStopVal)+" trend "+(tNow===1?"UP":"DOWN"); }
    /* ---- build gate ledger ---- */
    var sg=[];
    sg.push(["S1","Weekly EMA9/21 structure",wStruct!=="mixed"&&wStruct===dSide?"pass":"veto",wStruct.toUpperCase()+" · 1D "+dSide.toUpperCase()]);
    sg.push(["S2","4H EMA cascade spread",casc!=="mixed"&&spreadOk?"pass":"veto",casc.toUpperCase()]);
    sg.push(["S3","1D side agrees",casc!=="mixed"&&casc===dSide?"pass":"veto",dSide.toUpperCase()]);
    sg.push(["S4","Heikin Ashi",haOk?"pass":"veto",haDetail]);
    sg.push(["S5","Hull MA",hullOk?"pass":"veto",hullDetail]);
    sg.push(["S6","TEMA",temaOk?"pass":"veto",temaDetail]);
    sg.push(["S7","Donchian-20",donOk?"pass":"veto",donDetail]);
    sg.push(["S8","Parabolic SAR",psarOk?"pass":"veto",psarDetail]);
    sg.push(["S9","Super Trend",stOk?"pass":"veto",stDetail]);
    sg.push(["S10","Ichimoku",ichiOk?"pass":"veto",ichiDetail]);
    sg.push(["S11","ADX 25+ DI aligned",adxOk?"pass":"veto","ADX "+fmt(adxVal,1)]);
    sg.push(["S12","DXY anti-correlation",dxyOk,dxyGateDetail]);
    sg.push(["S13","TNX aligned",tnxOk,tnxGateDetail]);
    sg.push(["S14","RSI exhaustion",rsiVeto?"veto":"pass","RSI14 "+fmt(r4,1)]);
    sg.push(["S15","Williams %R",willOk?"pass":"veto",willDetail]);
    sg.push(["S16","CCI",cciOk?"pass":"veto",cciDetail]);
    sg.push(["S17","Keltner",keltOk?"pass":"veto",keltDetail]);
    sg.push(["S18","StochRSI",srsiOk?"pass":"veto",srsiDetail]);
    sg.push(["S19","MACD hist",macdOk?"pass":"veto",macdDetail]);
    sg.push(["S20","MFI",mfiOk?"pass":"veto",mfiDetail]);
    sg.push(["S21","CMF",cmfOk?"pass":"veto",cmfDetail]);
    sg.push(["S22","Elder Ray",elderOk?"pass":"veto",elderDetail]);
    sg.push(["S23","OBV",obvOk?"pass":"veto",obvDetail]);
    sg.push(["S24","Awesome Oscillator",aoOk?"pass":"veto",aoDetail]);
    sg.push(["S25","Aroon",aroonOk?"pass":"veto",aroonDetail]);
    sg.push(["S26","TSMOM 30/90d",tsmom,"30d "+pct(r30v,1)+" · 90d "+pct(r90v,1)]);
    sg.push(["S27","CUSUM",cusum,evG?evG.dir.toUpperCase()+" "+evG.barsAgo+" bars ago":"no event"]);
    sg.push(["S28","Volatility regime",vreg.regime!=="unknown"?"pass":"na",vreg.label]);
    sg.push(["S29","NFP/Event stand-aside",!eventWin.active?"pass":"veto",eventWin.active?eventWin.event+" - no new positions":"calendar clear"]);
    sg.push(["S30","London Fix / NY Close",(!lfix&&!nyClose)?"pass":"na",timeNote||"quiet window"]);
    /* NEW v3.0 gates */
    sg.push(["S31","Bollinger %B + Squeeze",bbOk?"pass":"veto",bbDetail]);
    sg.push(["S32","Stochastic K/D",stochOk?"pass":"veto",stochDetail]);
    sg.push(["S33","Fisher Transform",fishOk?"pass":"veto",fishDetail]);
    sg.push(["S34","Linear Reg Slope",lrsOk?"pass":"veto",lrsDetail]);
    sg.push(["S35","RSI Divergence",divOk?"pass":"veto",divDetail]);
    sg.push(["S36","ATR Trailing Stop",atrStopOk?"pass":"veto",atrStopDetail]);
    sg.push(["S37","Bollinger Squeeze Alert",bbSqueeze?"pass":"na",bbSqueeze?"squeeze active - expansion likely":"no squeeze"]);
    var passCount=sg.filter(function(x){return x[2]==="pass";}).length;
    var vetoCount=sg.filter(function(x){return x[2]==="veto";}).length;
    var naCount=sg.filter(function(x){return x[2]==="na";}).length;
    var totalScored=passCount+vetoCount;
    var score=totalScored>0?(passCount/totalScored)*100:0;
    var entry=null,stop=null,t1=null,t2=null,risk=null,rr=0;
    if(casc!=="mixed"){
      stop=_lastSwing(h4,casc,30); entry=_last(c4);
      risk=Math.abs(entry-stop);
      var room=casc==="long"?Math.max.apply(null,h4.slice(-120).map(function(r){return r.h;}))-entry:entry-Math.min.apply(null,h4.slice(-120).map(function(r){return r.l;}));
      rr=risk>0?room/risk:0;
      if(risk>0){ t1=casc==="long"?entry+2*risk:entry-2*risk; t2=casc==="long"?entry+3*risk:entry-3*risk; }
    }
    if(casc==="mixed"||!(risk>0)){
      entry=_last(c4); stop=casc==="long"?entry-1.5*a4:entry+1.5*a4; risk=Math.abs(entry-stop);
      t1=casc==="long"?entry+2*risk:entry-2*risk; t2=casc==="long"?entry+3*risk:entry-3*risk; rr=2;
    }
    /* Use ATR trailing stop if tighter and valid */
    if(isFinite(atrStopVal)&&Math.abs(entry-atrStopVal)>0&&Math.abs(entry-atrStopVal)<risk){
      stop=atrStopVal; risk=Math.abs(entry-stop);
      t1=casc==="long"?entry+2*risk:entry-2*risk; t2=casc==="long"?entry+3*risk:entry-3*risk;
    }
    var verdictLabel,verdictColor,verdictWhy;
    if(score>=80&&vetoCount===0){ verdictLabel="STRONG "+casc.toUpperCase(); verdictColor=casc; verdictWhy="All active gates cleared. Highest conviction this framework can claim."; }
    else if(score>=60){ verdictLabel="MODERATE "+casc.toUpperCase(); verdictColor=casc; verdictWhy=passCount+"/"+totalScored+" gates passed. Some vetoes present - verify macro inputs manually."; }
    else if(score>=40){ verdictLabel="WEAK "+casc.toUpperCase(); verdictColor=casc; verdictWhy=passCount+"/"+totalScored+" gates passed. More vetoes than confirmations. Reduce size or wait."; }
    else if(casc!=="mixed"){ verdictLabel="BIAS ONLY - "+casc.toUpperCase(); verdictColor="aside"; verdictWhy=passCount+"/"+totalScored+" gates passed. Structural edge is weak. Do not size. Use for directional bias only."; }
    else{ verdictLabel="MIXED / NO EDGE"; verdictColor="aside"; verdictWhy="No clear direction. 4H EMAs are mixed. Consider range-bound strategies or wait for a cascade."; }
    if(casc!=="mixed"&&risk>0&&entry!=null&&stop!=null&&t1!=null){ logSetup("XAUUSD",casc,"supergold-swing",entry,stop,t1); }
    var dirForTrade=(casc!=="mixed")?casc:"long";
    var swingPlanHtml="<div class=\"plan\">"+planBlock(casc,entry,stop,t1,t2||t1)+"</div>"
      +"<button class=\"toTrade\" onclick=\"toTrade('XAUUSD','"+dirForTrade+"',"+entry+","+stop+")\">SEND TO TRADE PLAN (XM 360)</button>"
      +"<div class=\"note\" style=\"margin-top:6px\">XM 360: copy to MT4/MT5. Verify spread &lt; 35 pips. Set SL+TP. Max 1pct risk. "+verdictLabel+" means "+verdictWhy+"</div>";
    if($("sgSwingOut")) $("sgSwingOut").innerHTML="<div class=\"note warn\" style=\"margin-bottom:8px\">Integration only - trading logic, scoring and broker handoff are NOT endorsed. Verify everything manually.</div>"
      +"<div class=\"ledger\">"+sg.map(function(x){return gateRow(x[0],x[1],x[2],x[3]);}).join("")+"</div>"
      +"<div class=\"verdict "+verdictColor+"\"><div class=\"vword\">"+verdictLabel+"</div>"
      +"<div class=\"vwhy\">Score: "+fmt(score,0)+"pct · "+passCount+" pass · "+vetoCount+" veto · "+naCount+" n/a · "+verdictWhy+"</div></div>"
      +swingPlanHtml;
    setProg("sgProg",0.65);
    /* ================= SCALP ================= */
    var c15=m15.map(function(r){return r.c;}),n15=c15.length;
    var m15h=m15.map(function(r){return r.h;}), m15l=m15.map(function(r){return r.l;});
    var lastClose=c15[n15-1];
    var atr15arr=_atr(m15,14),a15=_last(atr15arr);
    var vbase=atr15arr.slice(-96).filter(isFinite).sort(function(x,y){return x-y;});
    var aMed=vbase.length?vbase[Math.floor(vbase.length/2)]:NaN;
    var volAlive=isFinite(a15)&&isFinite(aMed)&&a15>=0.8*aMed;
    var e21h1=_last(_ema(h1.map(function(r){return r.c;}),21));
    var look=m15.slice(-12);
    var haScalpOk=false,haScalpDetail="n/a";
    if(m15.length>=5){ var ha15=heikinAshi(m15); var last2=ha15.slice(-2); haScalpOk=(casc==="long"&&last2.every(function(b){return b.c>b.o;}))||(casc==="short"&&last2.every(function(b){return b.c<b.o;})); haScalpDetail="HA(15m) "+(haScalpOk?"trend aligned":"mixed"); }
    var will15Ok=false,will15Detail="n/a";
    if(m15.length>=14){ var wr15=williamsR(m15,14); var w15=_last(wr15); will15Ok=(casc==="long"&&w15>-20)?false:((casc==="short"&&w15<-80)?false:true); will15Detail="W%R(15m) "+fmt(w15,1); }
    var st15Ok=false,st15Detail="n/a";
    if(m15.length>=15){ var st15=superTrend(m15,10,3); st15Ok=(casc==="long"&&st15.trend[n15-1]===1)||(casc==="short"&&st15.trend[n15-1]===-1); st15Detail="SuperTrend(15m) "+(st15.trend[n15-1]===1?"UP":"DOWN"); }
    var macd15Ok=false,macd15Detail="n/a";
    if(c15.length>=40){ var md15=macdGold(c15); var h15Now=_last(md15.hist),h15Prev=md15.hist[md15.hist.length-2]; macd15Ok=(casc==="long"&&h15Now>h15Prev&&h15Now>0)||(casc==="short"&&h15Now<h15Prev&&h15Now<0); macd15Detail="MACD(15m) "+fmt(h15Now,4); }
    var svwapOk=false,svwapDetail="n/a";
    if(sess.kz&&h1.length>=30){ var kzStart=nowSec()-3*3600; var kzRows=m15.filter(function(r){return r.t>=kzStart;}); if(kzRows.length>=4){ var sv=vwap(kzRows,kzRows.length); var svNow=_last(sv); var dist=Math.abs(lastClose-svNow)/svNow*100; svwapOk=dist<0.15; svwapDetail="VWAP "+px(svNow)+" dist "+fmt(dist,3)+"pct"; } }
    var aroon15Ok=false,aroon15Detail="n/a";
    if(m15.length>=20){ var ar15=aroon(m15,14); var osc15=_last(ar15.osc); aroon15Ok=(casc==="long"&&osc15>0)||(casc==="short"&&osc15<0); aroon15Detail="Aroon(15m) "+fmt(osc15,1); }
    var cci15Ok=false,cci15Detail="n/a";
    if(m15.length>=20){ var cc15=cci(m15,20); var cc15Now=_last(cc15); cci15Ok=(casc==="long"&&cc15Now>100)||(casc==="short"&&cc15Now<-100)?true:(((casc==="long"&&cc15Now<-100)||(casc==="short"&&cc15Now>100))?false:true); cci15Detail="CCI(15m) "+fmt(cc15Now,1); }
    /* NEW v3.0 scalp indicators */
    var bb15Ok=false, bb15Detail="n/a";
    if(c15.length>=40){ var bb15=bollingerBB(c15,20,2); bb15Ok=isFinite(bb15.pctB)&&((casc==="long"&&bb15.pctB>0.2)||(casc==="short"&&bb15.pctB<0.8)); bb15Detail="BB %B "+fmt(bb15.pctB,2)+(bb15.squeeze?" · squeeze":""); }
    var stoch15Ok=false, stoch15Detail="n/a";
    if(c15.length>=40){ var stx15=stochastic(c15,m15h,m15l,14,3,3); var k15=_last(stx15.k), d15=_last(stx15.d); stoch15Ok=isFinite(k15)&&isFinite(d15)&&((casc==="long"&&k15>d15)||(casc==="short"&&k15<d15)); stoch15Detail="Stoch K "+fmt(k15,1)+" / D "+fmt(d15,1); }
    var fish15Ok=false, fish15Detail="n/a";
    if(c15.length>=30){ var ft15=fisherTransform(c15,10); var f15Now=_last(ft15), f15Prev=ft15[ft15.length-2]; fish15Ok=(casc==="long"&&f15Now>f15Prev)||(casc==="short"&&f15Now<f15Prev); fish15Detail="Fisher(15m) "+fmt(f15Now,2)+" slope "+(f15Now>f15Prev?"up":"down"); }
    var pat15Ok=false, pat15Detail="n/a";
    if(m15.length>=3){ var pat=candlePattern(m15); var eng=pat.engulfing, pin=pat.pinBar; pat15Ok=(casc==="long"&&(eng==="bull"||pin))||(casc==="short"&&(eng==="bear"||pin)); pat15Detail=(eng?eng+" engulf":"")+(eng&&pin?" · ":"")+(pin?"pin bar":"none"); }
    var or15Ok=false, or15Detail="n/a";
    if(sess.kz){ var or=sess.name==="LONDON KZ"?openingRange(m15,180,60):(sess.name==="NY KZ"?openingRange(m15,360,60):null); if(or){ or15Ok=(casc==="long"&&lastClose>or.hi)||(casc==="short"&&lastClose<or.lo); or15Detail="OR hi "+px(or.hi)+" lo "+px(or.lo); } }
    function sgScalpLedger(dir){
      var lvls=dir==="long"?[["Asia low",asiaLo],["PDL",PDL]]:[["Asia high",asiaHi],["PDH",PDH]];
      var swept=null,sweptLvl=NaN,ext=NaN;
      for(var li=0;li<lvls.length;li++){ var nm2=lvls[li][0],lv=lvls[li][1]; if(!isFinite(lv)) continue; if(dir==="long"&&Math.min.apply(null,look.map(function(r){return r.l;}))<lv){ swept=nm2;sweptLvl=lv;ext=Math.min.apply(null,look.map(function(r){return r.l;}));break; } if(dir==="short"&&Math.max.apply(null,look.map(function(r){return r.h;}))>lv){ swept=nm2;sweptLvl=lv;ext=Math.max.apply(null,look.map(function(r){return r.h;}));break; } }
      var reclaimed=swept&&(dir==="long"?lastClose>sweptLvl:lastClose<sweptLvl);
      var htfOk=dir==="long"?lastClose>e21h1:lastClose<e21h1;
      var g=[];
      g.push(["C1","Kill zone",sess.kz?"pass":"veto",sess.name]);
      g.push(["C2","Liquidity sweep",swept?"pass":"veto",swept?"swept "+swept+" "+px(sweptLvl)+" extreme "+px(ext):"no sweep"]);
      g.push(["C3","Reclaimed",reclaimed?"pass":"veto",swept?px(lastClose)+" vs "+px(sweptLvl):"-"]);
      g.push(["C4","1H EMA21 aligned",htfOk?"pass":"veto","1H EMA21 "+px(e21h1)]);
      g.push(["C5","Vol alive",volAlive?"pass":"veto","ATR "+px(a15)+" med "+px(aMed)]);
      g.push(["C6","HA(15m)",haScalpOk?"pass":"veto",haScalpDetail]);
      g.push(["C7","W%R(15m)",will15Ok?"pass":"veto",will15Detail]);
      g.push(["C8","SuperTrend(15m)",st15Ok?"pass":"veto",st15Detail]);
      g.push(["C9","MACD(15m)",macd15Ok?"pass":"veto",macd15Detail]);
      g.push(["C10","Session VWAP",svwapOk?"pass":"na",svwapDetail]);
      g.push(["C11","Aroon(15m)",aroon15Ok?"pass":"veto",aroon15Detail]);
      g.push(["C12","CCI(15m)",cci15Ok?"pass":"veto",cci15Detail]);
      g.push(["C13","DXY aligned",dxyOk,dxyGateDetail]);
      g.push(["C14","NFP/Event",!eventWin.active?"pass":"veto",eventWin.active?eventWin.event:"clear"]);
      /* NEW v3.0 scalp gates */
      g.push(["C15","BB %B (15m)",bb15Ok?"pass":"veto",bb15Detail]);
      g.push(["C16","Stoch K/D (15m)",stoch15Ok?"pass":"veto",stoch15Detail]);
      g.push(["C17","Fisher (15m)",fish15Ok?"pass":"veto",fish15Detail]);
      g.push(["C18","Candle pattern",pat15Ok?"pass":"veto",pat15Detail]);
      g.push(["C19","Opening range",or15Ok?"pass":"na",or15Detail]);
      var scalpEntry=lastClose,scalpStop,scalpRisk,scalpT1,scalpT2,scalpRr=0;
      if(swept&&reclaimed){
        scalpStop=dir==="long"?ext-0.25*a15:ext+0.25*a15;
        scalpRisk=Math.abs(scalpEntry-scalpStop);
        var oppoCands=(dir==="long"?[asiaHi,PDH]:[asiaLo,PDL]).filter(isFinite);
        var oppo=oppoCands.length?(dir==="long"?Math.min.apply(null,oppoCands):Math.max.apply(null,oppoCands)):NaN;
        var room2=dir==="long"?oppo-scalpEntry:scalpEntry-oppo;
        scalpRr=scalpRisk>0&&isFinite(room2)?room2/scalpRisk:0;
        if(scalpRisk>0){ scalpT1=dir==="long"?scalpEntry+2*scalpRisk:scalpEntry-2*scalpRisk; scalpT2=dir==="long"?scalpEntry+3*scalpRisk:scalpEntry-3*scalpRisk; }
        g.push(["C20","2R to opposite pool",scalpRr>=2?"pass":"veto",isFinite(room2)?"room "+px(room2)+" 2R "+px(2*scalpRisk):"-"]);
      }else{
        scalpStop=dir==="long"?lastClose-1.5*a15:lastClose+1.5*a15;
        scalpRisk=Math.abs(scalpEntry-scalpStop);
        if(scalpRisk>0){ scalpT1=dir==="long"?scalpEntry+2*scalpRisk:scalpEntry-2*scalpRisk; scalpT2=dir==="long"?scalpEntry+3*scalpRisk:scalpEntry-3*scalpRisk; }
        g.push(["C20","2R to opposite pool","na","no sweep - using ATR structure. Watch for sweep."]);
      }
      var passC=g.filter(function(x){return x[2]==="pass";}).length,vetoC=g.filter(function(x){return x[2]==="veto";}).length,totalC=g.filter(function(x){return x[2]!=="na";}).length;
      var scoreC=totalC>0?(passC/totalC)*100:0;
      var scalpLabel,scalpColor;
      if(scoreC>=70&&vetoC===0){ scalpLabel=dir.toUpperCase()+" STRONG"; scalpColor=dir; }
      else if(scoreC>=50){ scalpLabel=dir.toUpperCase()+" MODERATE"; scalpColor=dir; }
      else if(scoreC>=30){ scalpLabel=dir.toUpperCase()+" WEAK"; scalpColor=dir; }
      else{ scalpLabel=dir.toUpperCase()+" BIAS ONLY"; scalpColor="aside"; }
      var planHtml="";
      if(scalpRisk>0){
        logSetup("XAUUSD",dir,"supergold-scalp",scalpEntry,scalpStop,scalpT1);
        planHtml="<div class=\"plan\">"+planBlock(dir,scalpEntry,scalpStop,scalpT1,scalpT2||scalpT1)+"</div>"
          +"<button class=\"toTrade\" onclick=\"toTrade('XAUUSD','"+dir+"',"+scalpEntry+","+scalpStop+")\">SEND TO TRADE PLAN (XM 360)</button>"
          +"<div class=\"note\" style=\"margin-top:6px\">XM 360 scalp: 15m or 5m chart. "+scalpLabel+". Score "+fmt(scoreC,0)+"pct. Spread check mandatory.</div>";
      }
      return "<div style=\"margin:2px 0 6px;font-size:11px;letter-spacing:.12em;color:var(--"+(dir==="long"?"long":"short")+")\">"+scalpLabel+"</div>"
        +"<div class=\"ledger\" style=\"margin-bottom:10px\">"+g.map(function(x){return gateRow(x[0],x[1],x[2],x[3]);}).join("")+"</div>"
        +"<div class=\"verdict "+scalpColor+"\" style=\"margin:0 0 16px\"><div class=\"vword\" style=\"font-size:16px\">"+scalpLabel+"</div>"
        +"<div class=\"vwhy\" style=\"font-size:10px\">Score "+fmt(scoreC,0)+"pct · "+passC+" pass · "+vetoC+" veto</div></div>"+planHtml;
    }
    if($("sgScalpOut")) $("sgScalpOut").innerHTML=sgScalpLedger("long")+sgScalpLedger("short");
    setProg("sgProg",0.85);
    var dxyChipVal=dxyDir,tnxChipVal=tnxDir;
    if($("sgMacroOut")) $("sgMacroOut").innerHTML=
      "<div class=\"panel\"><div class=\"kv\"><span class=\"k\">Weekly</span><span class=\"v\">"+wStruct.toUpperCase()+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Range</span><span class=\"v\">"+px(wLow)+" - "+px(wHigh)+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Wyckoff</span><span class=\"v\">"+wyk.label+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Vol Regime</span><span class=\"v\">"+vreg.label+"</span></div></div>"
      +"<div class=\"panel\"><div class=\"kv\"><span class=\"k\">DXY</span><span class=\"v\">"+dxyChipVal.toUpperCase()+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">TNX</span><span class=\"v\">"+tnxChipVal.toUpperCase()+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">NFP</span><span class=\"v\" style=\"color:"+(nfp?"var(--short)":"var(--pass)")+"\">"+(nfp?"YES":"No")+"</span></div></div>"
      +"<div class=\"panel\"><div class=\"kv\"><span class=\"k\">Session</span><span class=\"v\">"+sess.name+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Event</span><span class=\"v\" style=\"color:"+(eventWin.active?"var(--short)":"var(--pass)")+"\">"+(eventWin.active?eventWin.event:"Clear")+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">London Fix</span><span class=\"v\">"+(isLondonFix()?"ACTIVE":"inactive")+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">NY Close</span><span class=\"v\">"+(isNYClose()?"ACTIVE":"inactive")+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Pivot</span><span class=\"v\">PP "+px(piv.pp)+" R1 "+px(piv.r1)+" S1 "+px(piv.s1)+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Camarilla</span><span class=\"v\">H4 "+px(cam.h4)+" L4 "+px(cam.l4)+"</span></div>"
      +"<div class=\"kv\"><span class=\"k\">Spread</span><span class=\"v\">Verify &lt; 35 pips on XM 360</span></div></div>";
    if(st) st.textContent="evaluated · score "+fmt(score,0)+"pct · "+new Date().toTimeString().slice(0,5)+" IST";
  }catch(e){
    if(st) st.textContent="Super Gold eval failed: "+e.message;
    console.error(e);
  }finally{
    if(typeof S!=="undefined"&&_exPrev!=null) S.exchange=_exPrev;
    setProg("sgProg",null);
    setTimeout(function(){ if(btn) btn.disabled=false; },1200);
  }
}
/* Expose */
window.runSuperGold=runSuperGold;
})();
