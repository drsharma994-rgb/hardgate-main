/* HARDGATE backtest worker (Phase 9).
   Runs the CPU-bound backtest compute loops (Scalp/Swing/Judas) off the
   main thread. Depends on ema/rsi/atr/lastSwing/cusumLast from indicators.js
   (loaded via importScripts). The main thread keeps all network/DOM/cache
   work; this worker only computes and returns plain-data results. */
'use strict';
try { importScripts('indicators.js'); } catch (e) { /* reported on first message */ }

// Pure helpers copied from index.html (main thread) so the worker is standalone.
function fundingMinsAt(tSec){
  const d = new Date(tSec*1000);
  const secIn8h = (d.getUTCHours()%8)*3600 + d.getUTCMinutes()*60 + d.getUTCSeconds();
  return (8*3600 - secIn8h)/60;
}

function sessionAt(tSec){
  const d = new Date(tSec*1000);
  const h = d.getUTCHours() + d.getUTCMinutes()/60;
  if (h>=7 && h<10) return {name:'LONDON KZ', kz:true};
  if (h>=12 && h<15) return {name:'NY KZ', kz:true};
  if (h>=0 && h<7) return {name:'ASIA (range builds)', kz:false};
  return {name:'OFF-SESSION', kz:false};
}

function dayStartOf(tSec){
  const d = new Date(tSec*1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())/1000);
}

// Pure backtest compute loops, identical to the main-thread implementations.
function backtestScalpTD(h1rows, m15rows){
  const lastv = a => a[a.length-1];
  const MIN_M15 = 60, HORIZON = 80;
  const results = [];
  let hIdx = 0;
  let i = MIN_M15;
  while (i < m15rows.length - 1){
    const barT = m15rows[i].t;
    while (hIdx+1 < h1rows.length && h1rows[hIdx+1].t <= barT) hIdx++;
    if (hIdx < 55){ i++; continue; }
    const h1win = h1rows.slice(0, hIdx+1);
    const c1 = h1win.map(r=>r.c);
    const e9h=lastv(ema(c1,9)), e21h=lastv(ema(c1,21)), e50h=lastv(ema(c1,50));
    let dir=null;
    if (e9h>e21h && e21h>e50h) dir='long'; else if (e9h<e21h && e21h<e50h) dir='short';
    if (!dir){ i++; continue; }
    const win15 = m15rows.slice(0, i+1);
    const c15 = win15.map(r=>r.c);
    const n = c15.length;
    if (n<40){ i++; continue; }
    const e9a = ema(c15,9), e21a = ema(c15,21);
    const priorWin = win15.slice(n-24, n-7);
    const localLow = Math.min(...priorWin.map(r=>r.l));
    const localHigh = Math.max(...priorWin.map(r=>r.h));
    const recentWin = win15.slice(n-7, n-1);
    const sweptLiquidity = dir==='long' ? Math.min(...recentWin.map(r=>r.l)) < localLow : Math.max(...recentWin.map(r=>r.h)) > localHigh;
    const reclaimed = dir==='long' ? (c15[n-1]>e9a[n-1] && e9a[n-1]>e21a[n-1]) : (c15[n-1]<e9a[n-1] && e9a[n-1]<e21a[n-1]);
    if (!(sweptLiquidity && reclaimed)){ i++; continue; }
    const r15 = lastv(rsi(c15,14));
    if (dir==='long' ? !(r15>=40&&r15<=65) : !(r15>=35&&r15<=60)){ i++; continue; }
    const mins = fundingMinsAt(win15[n-1].t);
    if (mins<25){ i++; continue; }
    const atrArr = atr(win15,14);
    const a = lastv(atrArr);
    const base = atrArr.slice(-96).filter(isFinite).sort((x,y)=>x-y);
    const aMed = base.length? base[Math.floor(base.length/2)] : NaN;
    if (!(isFinite(a)&&isFinite(aMed)&&a>=0.8*aMed)){ i++; continue; }
    const currentBar = win15[n-1];
    const range = currentBar.h-currentBar.l;
    const closePos = range>0 ? (currentBar.c-currentBar.l)/range : 0.5;
    if (dir==='long'&&closePos<0.60){ i++; continue; }
    if (dir==='short'&&closePos>0.40){ i++; continue; }
    const entry = c15[n-1];
    const stop = dir==='long'? localLow-0.25*a : localHigh+0.25*a;
    const risk = Math.abs(entry-stop);
    if (!(risk>0)){ i++; continue; }
    const expectedMove = a*2.5;
    const maxExcursion = a*4;
    const dynamicRR = expectedMove/risk;
    if (!(dynamicRR>=1.5)){ i++; continue; }
    const t1 = dir==='long'? entry+expectedMove: entry-expectedMove;
    const t2 = dir==='long'? entry+maxExcursion: entry-maxExcursion;
    let outcome='unresolved', resolvedAt=null, rMult=0;
    for (let j=i+1;j<Math.min(m15rows.length, i+1+HORIZON); j++){
      const bar = m15rows[j];
      if (dir==='long'){
        if (bar.l<=stop){ outcome='stop'; resolvedAt=j; rMult=-1; break; }
        if (bar.h>=t2){ outcome='target2'; resolvedAt=j; rMult=(t2-entry)/risk; break; }
        if (bar.h>=t1){ outcome='target1'; resolvedAt=j; rMult=(t1-entry)/risk; break; }
      } else {
        if (bar.h>=stop){ outcome='stop'; resolvedAt=j; rMult=-1; break; }
        if (bar.l<=t2){ outcome='target2'; resolvedAt=j; rMult=(entry-t2)/risk; break; }
        if (bar.l<=t1){ outcome='target1'; resolvedAt=j; rMult=(entry-t1)/risk; break; }
      }
    }
    results.push({ t: win15[n-1].t, dir, entry, stop, t1, t2, outcome, rMult });
    i = (resolvedAt!==null?resolvedAt:i+HORIZON)+1;
  }
  return results;
}

function backtestSwingTD(rows){
const lastv = function(a){ return a[a.length-1]; };
const MIN_LOOKBACK = 210, HORIZON = 120;
const results = [];
let i = MIN_LOOKBACK;
while (i < rows.length - 1){
const win = rows.slice(0, i+1);
const c = win.map(function(r){ return r.c; });
const e9=lastv(ema(c,9)), e21=lastv(ema(c,21)), e50=lastv(ema(c,50)), e200=lastv(ema(c,200));
const p=lastv(c), r14=lastv(rsi(c,14));
let dir=null;
if (e9>e21 && e21>e50) dir='long'; else if (e9<e21 && e21<e50) dir='short';
if (!dir){ i++; continue; }
const a4=lastv(atr(win,14));
if (!(isFinite(a4) && Math.abs(e21-e50) >= 0.25*a4)){ i++; continue; }
if (dir==='long' ? !(p>e200) : !(p<e200)){ i++; continue; }
if ((dir==='long'&&r14>70)||(dir==='short'&&r14<30)){ i++; continue; }
const currentBar=win[win.length-1]; const range=currentBar.h - currentBar.l; const closePos=range>0 ? (currentBar.c - currentBar.l) / range : 0.5; if (dir==='long' && closePos<0.60){ i++; continue; } if (dir==='short' && closePos>0.40){ i++; continue; }
const stop = lastSwing(win, dir, 30);
const entry = p;
const risk = Math.abs(entry-stop);
if (!(risk>0)){ i++; continue; }
const ev = cusumLast(c.slice(-120), 1);
if (ev && ev.barsAgo<=20 && ev.dir!==dir){ i++; continue; }
const expectedMove = a4*3.5;
const maxExcursion = a4*4.9;
const dynamicRR = expectedMove/risk;
if (!(dynamicRR>=2)){ i++; continue; }
const t1 = dir==='long'? entry+expectedMove : entry-expectedMove;
const t2 = dir==='long'? entry+maxExcursion : entry-maxExcursion;
let outcome='unresolved', resolvedAt=null, rMult=0;
for (let j=i+1; j<Math.min(rows.length, i+1+HORIZON); j++){
const bar = rows[j];
if (dir==='long'){
if (bar.l<=stop){ outcome='stop'; resolvedAt=j; rMult=-1; break; }
if (bar.h>=t2){ outcome='target2'; resolvedAt=j; rMult=3; break; }
if (bar.h>=t1){ outcome='target1'; resolvedAt=j; rMult=2; break; }
} else {
if (bar.h>=stop){ outcome='stop'; resolvedAt=j; rMult=-1; break; }
if (bar.l<=t2){ outcome='target2'; resolvedAt=j; rMult=3; break; }
if (bar.l<=t1){ outcome='target1'; resolvedAt=j; rMult=2; break; }
}
}
results.push({ t: rows[i].t, dir: dir, entry: entry, stop: stop, t1: t1, t2: t2, outcome: outcome, rMult: rMult });
i = (resolvedAt!==null ? resolvedAt : i+HORIZON) + 1;
}
return results;
}

function backtestJudasTD(d1rows, h1rows, m15rows){
  const MIN_LOOKBACK = 150, HORIZON = 40;
  const results = [];
  let hIdx = 0, dIdx = 0;
  let i = MIN_LOOKBACK;
  while (i < m15rows.length - 1){
    const t = m15rows[i].t;
    const sess = sessionAt(t);
    if (!sess.kz){ i++; continue; }
    const day0now = dayStartOf(t);
    while (dIdx+1 < d1rows.length && d1rows[dIdx+1].t < day0now) dIdx++;
    if (d1rows[dIdx].t >= day0now){ i++; continue; }
    const PDH = d1rows[dIdx].h, PDL = d1rows[dIdx].l;
    while (hIdx+1 < h1rows.length && h1rows[hIdx+1].t <= t) hIdx++;
    if (hIdx < 25){ i++; continue; }
    const h1win = h1rows.slice(0, hIdx+1);
    const e21h1arr = ema(h1win.map(r=>r.c),21);
    const e21h1v = e21h1arr[e21h1arr.length-1];
    const day0 = (t < day0now+7*3600) ? day0now-86400 : day0now;
    const win15 = m15rows.slice(0, i+1);
    const asia = win15.filter(r=> r.t>=day0 && r.t<day0+7*3600);
    const asiaHi = asia.length ? Math.max(...asia.map(r=>r.h)) : NaN;
    const asiaLo = asia.length ? Math.min(...asia.map(r=>r.l)) : NaN;
    const c15 = win15.map(r=>r.c), n15=c15.length;
    const lastClose = c15[n15-1];
    const atr15arr = atr(win15,14);
    const a15 = atr15arr[atr15arr.length-1];
    const vbase = atr15arr.slice(-96).filter(isFinite).sort((x,y)=>x-y);
    const aMed = vbase.length? vbase[Math.floor(vbase.length/2)] : NaN;
    const volAlive = isFinite(a15)&&isFinite(aMed)&&a15>=0.8*aMed;
    const look = win15.slice(-12);
    let resolvedAt=null;
    for (const dir of ['long','short']){
      const lvls = dir==='long'?[['Asia low',asiaLo],['PDL',PDL]]:[['Asia high',asiaHi],['PDH',PDH]];
      let swept=null, sweptLvl=NaN, ext=NaN;
      for (const [nm,lv] of lvls){
        if (!isFinite(lv)) continue;
        if (dir==='long' && Math.min(...look.map(r=>r.l)) < lv){ swept=nm; sweptLvl=lv; ext=Math.min(...look.map(r=>r.l)); break; }
        if (dir==='short' && Math.max(...look.map(r=>r.h)) > lv){ swept=nm; sweptLvl=lv; ext=Math.max(...look.map(r=>r.h)); break; }
      }
      if (!swept) continue;
      const reclaimed = dir==='long' ? lastClose>sweptLvl : lastClose<sweptLvl;
      if (!reclaimed) continue;
      const htfOk = dir==='long' ? lastClose>e21h1v : lastClose<e21h1v;
      if (!htfOk) continue;
      if (!volAlive) continue;
      const stop = dir==='long' ? ext-0.25*a15 : ext+0.25*a15;
      const entry = lastClose;
      const risk = Math.abs(entry-stop);
      if (!(risk>0)) continue;
      const oppoCands = (dir==='long'?[asiaHi,PDH]:[asiaLo,PDL]).filter(isFinite);
      const oppo = oppoCands.length ? (dir==='long'?Math.min(...oppoCands):Math.max(...oppoCands)) : NaN;
      const room = dir==='long' ? oppo-entry : entry-oppo;
      if (!(isFinite(room) && room>=2*risk)) continue;
      const t1 = dir==='long'?entry+2*risk:entry-2*risk;
      let outcome='unresolved', rMult=0;
      for (let j=i+1;j<Math.min(m15rows.length,i+1+HORIZON); j++){
        const bar=m15rows[j];
        if (dir==='long'){
          if (bar.l<=stop){outcome='stop';resolvedAt=j;rMult=-1;break;}
          if (bar.h>=t1){outcome='target1';resolvedAt=j;rMult=2;break;}
        } else {
          if (bar.h>=stop){outcome='stop';resolvedAt=j;rMult=-1;break;}
          if (bar.l<=t1){outcome='target1';resolvedAt=j;rMult=2;break;}
        }
      }
      results.push({t, dir, entry, stop, t1, outcome, rMult});
      if (resolvedAt===null) resolvedAt = i+HORIZON;
      break;
    }
    i = resolvedAt!==null ? resolvedAt+1 : i+1;
  }
  return results;
}

self.onmessage = function(ev){
  const msg = ev.data || {};
  const id = msg.id;
  try {
    if (typeof ema !== "function" || typeof rsi !== "function" || typeof atr !== "function"){
      throw new Error("indicators.js not loaded in worker");
    }
    let res;
    if (msg.type === "scalp")      res = backtestScalpTD(msg.h1, msg.m15);
    else if (msg.type === "swing") res = backtestSwingTD(msg.c4);
    else if (msg.type === "judas") res = backtestJudasTD(msg.d1, msg.h1, msg.m15);
    else throw new Error("unknown backtest type: " + msg.type);
    self.postMessage({ id: id, ok: true, res: res });
  } catch (err) {
    self.postMessage({ id: id, ok: false, error: String((err && err.message) || err) });
  }
};
