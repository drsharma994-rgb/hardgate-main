// backtests.js \u2014 pure backtest/eval computation helpers (extracted from index.html, Phase 17)
// No DOM / storage / fetch. Call-time deps (ema, rsi, last, px, etc.) come from indicators.js / earlier scripts.
// Globals: backtestSwingTD, backtestSummaryHTML, judasSweepCheck, backtestScalpTD, backtestGoldSwingTD, backtestJudasTD

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
function backtestSummaryHTML(base, rows, results){
const fmtD = function(t){ return new Date(t*1000).toISOString().slice(0,10); };
const total = results.length;
const wins = results.filter(function(r){ return r.outcome==='target1'||r.outcome==='target2'; }).length;
const stops = results.filter(function(r){ return r.outcome==='stop'; }).length;
const openCt = results.filter(function(r){ return r.outcome==='unresolved'; }).length;
const resolved = results.filter(function(r){ return r.outcome!=='unresolved'; });
const winRate = total ? (wins/total*100) : NaN;
const avgR = resolved.length ? (resolved.reduce(function(a,r){return a+r.rMult;},0)/resolved.length) : NaN;
const rangeNote = rows.length ? (fmtD(rows[0].t)+' to '+fmtD(rows[rows.length-1].t)) : 'n/a';
const smallNote = total<10 ? '<div class="note warn">Sample size is small ('+total+' signals) \u2014 treat as directional evidence, not a reliable win rate.</div>' : '';
return '<div class="panel"><h2>'+base+' BACKTEST <span>4H swing gates on Twelve Data history \u00B7 '+rangeNote+'</span></h2>'
+ '<div class="note">Replays this app\'s own SWING gates (cascade+spread, HTF side, RSI band, structural R:R\u2265 2, CUSUM) bar-by-bar on real historical price data. Funding-rate and volume gates are NOT included \u2014 Twelve Data does not provide historical funding or reliable crypto volume, so those two live gates cannot be honestly replayed here. This is a frequency count of what already happened, not a prediction or guarantee.</div>'
+ '<div class="kv"><span class="k">Signals found</span><span class="v">'+total+'</span></div>'
+ '<div class="kv"><span class="k">Hit target first</span><span class="v">'+wins+' ('+(total?winRate.toFixed(1):'0.0')+'%)</span></div>'
+ '<div class="kv"><span class="k">Hit stop first</span><span class="v">'+stops+'</span></div>'
+ '<div class="kv"><span class="k">Still open at horizon end</span><span class="v">'+openCt+'</span></div>'
+ '<div class="kv"><span class="k">Avg R (resolved trades)</span><span class="v">'+(isFinite(avgR)?avgR.toFixed(2)+'R':'n/a')+'</span></div>'
+ smallNote + '</div>';
}

function judasSweepCheck(dir, d1rows, h1rows, m15rows){
  const pdc = d1rows[d1rows.length-1];
  const PDH = pdc.h, PDL = pdc.l;
  const nowT = m15rows[m15rows.length-1].t;
  const day0now = dayStartOf(nowT);
  const day0 = (nowT < day0now+7*3600) ? day0now-86400 : day0now;
  const asia = m15rows.filter(r=> r.t>=day0 && r.t<day0+7*3600);
  const asiaHi = asia.length ? Math.max(...asia.map(r=>r.h)) : NaN;
  const asiaLo = asia.length ? Math.min(...asia.map(r=>r.l)) : NaN;
  const sess = sessionAt(nowT);
  const c15 = m15rows.map(r=>r.c), n15 = c15.length;
  const lastClose = c15[n15-1];
  const atr15arr = atr(m15rows,14), a15 = atr15arr[atr15arr.length-1];
  const vbase = atr15arr.slice(-96).filter(isFinite).sort((x,y)=>x-y);
  const aMed = vbase.length ? vbase[Math.floor(vbase.length/2)] : NaN;
  const volAlive = isFinite(a15) && isFinite(aMed) && a15>=0.8*aMed;
  const e21h1 = ema(h1rows.map(r=>r.c),21); const e21h1v = e21h1[e21h1.length-1];
  const look = m15rows.slice(-12);
  const lvls = dir==='long' ? [['Asia low',asiaLo],['PDL',PDL]] : [['Asia high',asiaHi],['PDH',PDH]];
  let swept=null, sweptLvl=NaN, ext=NaN;
  for (const [nm,lv] of lvls){
    if (!isFinite(lv)) continue;
    if (dir==='long' && Math.min(...look.map(r=>r.l)) < lv){ swept=nm; sweptLvl=lv; ext=Math.min(...look.map(r=>r.l)); break; }
    if (dir==='short' && Math.max(...look.map(r=>r.h)) > lv){ swept=nm; sweptLvl=lv; ext=Math.max(...look.map(r=>r.h)); break; }
  }
  const reclaimed = swept && (dir==='long' ? lastClose>sweptLvl : lastClose<sweptLvl);
  const htfOk = dir==='long' ? lastClose>e21h1v : lastClose<e21h1v;
  const g=[];
  g.push(['JS1','Kill zone active (London/NY)', sess.kz?'pass':'veto', sess.name]);
  g.push(['JS2', `Liquidity sweep of ${dir==='long'?'Asia low / PDL':'Asia high / PDH'} (last 3h)`, swept?'pass':'veto', swept?`swept ${swept} ${px(sweptLvl)} \u00b7 extreme ${px(ext)}`:'no sweep']);
  g.push(['JS3','Closed 15m bar reclaimed the level', reclaimed?'pass':'veto', swept?`close ${px(lastClose)} vs ${px(sweptLvl)}`:'\u2014']);
  g.push(['JS4','1H context not fighting you (close vs 1H EMA21)', htfOk?'pass':'veto', `1H EMA21 ${px(e21h1v)}`]);
  g.push(['JS5','Volatility alive (15m ATR \u2265 0.8\u00d7 24h median)', volAlive?'pass':'veto', `ATR ${px(a15)} \u00b7 med ${px(aMed)}`]);
  let entry=null, stop=null, t1=null, room=null, risk=null, oppo=null;
  if (swept && reclaimed){
    stop = dir==='long' ? ext-0.25*a15 : ext+0.25*a15;
    entry = lastClose;
    risk = Math.abs(entry-stop);
    const oppoCands = (dir==='long'?[asiaHi,PDH]:[asiaLo,PDL]).filter(isFinite);
    oppo = oppoCands.length ? (dir==='long'?Math.min(...oppoCands):Math.max(...oppoCands)) : NaN;
    room = dir==='long' ? oppo-entry : entry-oppo;
    const rrOk = risk>0 && isFinite(room) && room>=2*risk;
    g.push(['JS6','2R fits before the opposite liquidity pool', rrOk?'pass':'veto', risk>0&&isFinite(room)?`room ${px(room)} vs 2R ${px(2*risk)} (pool ${px(oppo)})`:'\u2014']);
    if (rrOk) t1 = dir==='long'?entry+2*risk:entry-2*risk;
  } else {
    g.push(['JS6','2R fits before the opposite pool','na','needs a completed sweep + reclaim first']);
  }
  const veto = g.some(x=>x[2]==='veto');
  return { gates: g, veto, dir, entry, stop, t1, oppo };
}

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

function backtestGoldSwingTD(d1rows, h4rows){
  const lastv = a => a[a.length-1];
  const MIN_H4 = 210, HORIZON = 180;
  const results = [];
  let dIdx = 0;
  let i = MIN_H4;
  while (i < h4rows.length - 1){
    const win4 = h4rows.slice(0, i+1);
    const t = win4[win4.length-1].t;
    const c4 = win4.map(r=>r.c);
    const e9=lastv(ema(c4,9)), e21=lastv(ema(c4,21)), e50=lastv(ema(c4,50));
    const a4 = lastv(atr(win4,14));
    const casc = e9>e21&&e21>e50 ? 'long' : (e9<e21&&e21<e50 ? 'short':'mixed');
    if (casc==='mixed'){ i++; continue; }
    const spreadOk = isFinite(a4) && Math.abs(e21-e50) >= 0.25*a4;
    if (!spreadOk){ i++; continue; }
    while (dIdx+1 < d1rows.length && d1rows[dIdx+1].t <= t) dIdx++;
    if (dIdx < 55){ i++; continue; }
    const d1win = d1rows.slice(0, dIdx+1);
    const c1 = d1win.map(r=>r.c);
    const e50d = lastv(ema(c1,50)), pd = lastv(c1);
    const dSide = pd>e50d ? 'long':'short';
    if (casc!==dSide){ i++; continue; }
    const r4 = lastv(rsi(c4,14));
    if ((casc==='long'&&r4>70)||(casc==='short'&&r4<30)){ i++; continue; }
    const r30g = roc(c1,30), r90g = roc(c1,90);
    if (isFinite(r30g)&&isFinite(r90g)){
      const want = casc==='long'?1:-1;
      const agree = (Math.sign(r30g)===want?1:0)+(Math.sign(r90g)===want?1:0);
      if (agree===0){ i++; continue; }
    }
    const evG = cusumLast(c4.slice(-120),1);
    if (evG && evG.barsAgo<=20 && evG.dir!==casc){ i++; continue; }
    const stop = lastSwing(win4, casc, 30);
    const entry = lastv(c4);
    const risk = Math.abs(entry-stop);
    if (!(risk>0)){ i++; continue; }
    const recentWin = win4.slice(-120);
    const room = casc==='long' ? Math.max(...recentWin.map(r=>r.h))-entry : entry-Math.min(...recentWin.map(r=>r.l));
    const rrOk = risk>0 && room/risk>=2;
    if (!rrOk){ i++; continue; }
    const t1 = casc==='long'?entry+2*risk:entry-2*risk;
    const t2 = casc==='long'?entry+3*risk:entry-3*risk;
    let outcome='unresolved', resolvedAt=null, rMult=0;
    for (let j=i+1;j<Math.min(h4rows.length,i+1+HORIZON); j++){
      const bar=h4rows[j];
      if (casc==='long'){
        if (bar.l<=stop){outcome='stop';resolvedAt=j;rMult=-1;break;}
        if (bar.h>=t2){outcome='target2';resolvedAt=j;rMult=3;break;}
        if (bar.h>=t1){outcome='target1';resolvedAt=j;rMult=2;break;}
      } else {
        if (bar.h>=stop){outcome='stop';resolvedAt=j;rMult=-1;break;}
        if (bar.l<=t2){outcome='target2';resolvedAt=j;rMult=3;break;}
        if (bar.l<=t1){outcome='target1';resolvedAt=j;rMult=2;break;}
      }
    }
    results.push({t, dir:casc, entry, stop, t1, t2, outcome, rMult});
    i = (resolvedAt!==null?resolvedAt:i+HORIZON)+1;
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
