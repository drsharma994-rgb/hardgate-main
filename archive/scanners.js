// scanners.js \u2014 market scanner routines (extracted from index.html, Phase 19)
// Call-time deps stay elsewhere: $, S, getCandles, getTickers, searchBase, indicators (atr/rsi/bollinger/...), setProg, loadCoilWatch, etc.
// Globals: runCoilScan, runExpansionCheck, runDivScan, runBasisScan, runApexScan, runTrapScan, runSmcScan, runObScan.

async function runCoilScan(){
  const btn=$('coilRun'); const cardsEl=$('coilCards'); const emptyEl=$('coilEmpty'); const statEl=$('coilStat');
  btn.disabled=true; cardsEl.innerHTML=''; let __cardsHtml = []; emptyEl.style.display='none';
  try{
    if (!S.tickers.length) S.tickers=await getTickers();
    const uni = S.exchange==='delta' ? S.tickers.filter(t=>t.turnoverUsd>=100000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd) : S.tickers.slice();
    let found=0;
    let coilList = [];
    for (let i=0;i<uni.length;i++){
      const t=uni[i];
      setProg('coilProg',(i+1)/uni.length);
      statEl.textContent=`scanning ${i+1}/${uni.length} \u00B7 ${t.symbol}`;
      try{
        const rows=await getCandles(t.symbol,'4h',200);
        if (rows.length<80) continue;
        const c=rows.map(r=>r.c);
        const p=c[c.length-1];
        const bb=bollinger(c,20,2);
        const currentWidth=bb.widthPct[c.length-1];
        const pastWidths=bb.widthPct.slice(-50).filter(isFinite);
        if (!pastWidths.length) continue;
        const avgWidth=pastWidths.reduce((a,b)=>a+b,0)/pastWidths.length;
        if (!(currentWidth<avgWidth*0.75)) continue;
        const vz=volZ(rows,20);
        if (!(vz<-0.5)) continue;
        const e200=last(ema(c,200));
        if (!(p>e200)) continue;
        const recentRows=rows.slice(-20);
        const coilHigh=Math.max(...recentRows.map(r=>r.h));
        const coilLow=Math.min(...recentRows.map(r=>r.l));
        found++;
        coilList.push({symbol: t.symbol, dir: "long", coilLow: coilLow, coilHigh: coilHigh});
        __cardsHtml.push(cardHTML(t.symbol,'long',
          [['mark',px(t.mark||p)],['24h',t.chg24!=null?pct(t.chg24,2):'\u2014'],
           ['BB width',fmt(currentWidth,2)+'% (avg '+fmt(avgWidth,2)+'%)'],['vol z',fmt(vz,2)],
           ['coil low',px(coilLow)],['coil high',px(coilHigh)]],
          ['G1 BB squeeze','G2 vol drought','G3 >4H 200 EMA'],
          `Wait for price to sweep below ${px(coilLow)}, then manually bid the reclaim. Do not buy inside the chop.`,
          coilLow, coilLow*0.95, coilHigh));
      }catch(e){}
      await sleep(120);
    }
    saveCoilWatch(coilList);
    statEl.textContent=`done \u2014 ${found} coils found`;
    if (!found) emptyEl.style.display='block';
  }catch(e){
    statEl.textContent=`coil scan failed: ${e.message}`;
  }finally{
cardsEl.innerHTML = __cardsHtml.join('');
    setProg('coilProg', null);
    btn.disabled=false;
  }
}



async function runExpansionCheck(){
  const btn=$("expRun"); const cardsEl=$("expCards"); const emptyEl=$("expEmpty"); const statEl=$("expStat");
  btn.disabled=true; cardsEl.innerHTML=""; let __cardsHtml = []; emptyEl.style.display="none";
  try{
    const watch = loadCoilWatch();
    if (!watch || !watch.list || !watch.list.length){ statEl.textContent="no saved coil watchlist \u2014 run FIND COILS first"; return; }
    if (watch.ex !== S.exchange){ statEl.textContent="saved watchlist is for "+watch.ex.toUpperCase()+" \u2014 switch exchange or re-run FIND COILS"; return; }
    let found=0;
    for (let i=0;i<watch.list.length;i++){
      const w = watch.list[i];
      setProg("expProg",(i+1)/watch.list.length);
      statEl.textContent = "checking "+(i+1)+"/"+watch.list.length+" \u00B7 "+w.symbol;
      try{
        const rows = await getCandles(w.symbol,"4h",60);
        if (rows.length<25) continue;
        const cur = rows[rows.length-1];
        const vz = volZ(rows,20);
        const broke = cur.c > w.coilHigh && vz > 2;
        if (!broke) continue;
        found++;
        const entry = cur.c;
        const stop = w.coilLow;
        const risk = Math.abs(entry-stop);
        if (!(risk>0)) continue;
        const t1 = entry + 2*risk;
        const t2 = entry + 3*risk;
        __cardsHtml.push(cardHTML(w.symbol,"long",
          [["mark",px(entry)],["coil high",px(w.coilHigh)],["coil low",px(w.coilLow)],["vol z",fmt(vz,2)],["watch age",fmt((nowSec()-watch.at)/3600,1)+"h"]],
          ["G1 was on coil watchlist","G2 closed above range","G3 vol z>2"],
          planBlock("long",entry,stop,t1,t2), entry, stop, t1));
        logSetup(w.symbol,"long","coil-expansion",entry,stop,t1);
      }catch(e){}
      await sleep(120);
    }
    statEl.textContent = "done \u2014 "+found+" expansions triggered";
    if (!found) emptyEl.style.display="block";
  }catch(e){ statEl.textContent = "expansion check failed: "+e.message; }
  finally{
cardsEl.innerHTML = __cardsHtml.join(''); setProg("expProg", null); btn.disabled=false; }
}
async function runDivScan(){
  const btn=$("divRun"); const cardsEl=$("divCards"); const emptyEl=$("divEmpty"); const statEl=$("divStat");
  btn.disabled=true; cardsEl.innerHTML=""; let __cardsHtml = []; emptyEl.style.display="none";
  try{
    if (!S.tickers.length) S.tickers = await getTickers();
    const uni = S.exchange==="delta" ? S.tickers.filter(function(t){ return t.turnoverUsd>=100000; }).sort(function(a,b){ return b.turnoverUsd-a.turnoverUsd; }) : S.tickers.slice();
    let found=0;
    for (let i=0;i<uni.length;i++){
      const t = uni[i];
      setProg("divProg",(i+1)/uni.length);
      statEl.textContent = "scanning "+(i+1)+"/"+uni.length+" \u00B7 "+t.symbol;
      try{
        const rows = await getCandles(t.symbol,"4h",200);
        if (rows.length < 80) continue;
        const c = rows.map(function(r){ return r.c; });
        const n = c.length;
        const rv = rsi(c,14);
        const pivots = findPivots(c,3);
        const highs = pivots.filter(function(p){ return p.type==="high"; });
        const lows = pivots.filter(function(p){ return p.type==="low"; });
        let dir=null, kindLabel=null, pivA=null, pivB=null;
        if (highs.length>=2){
          const h1=highs[highs.length-2], h2=highs[highs.length-1];
          if (h2.i-h1.i>=10 && isFinite(rv[h1.i]) && isFinite(rv[h2.i])){
            if (h2.v>h1.v && rv[h2.i]<rv[h1.i]){ dir="short"; kindLabel="Regular Bearish"; pivA=h1; pivB=h2; }
            else if (h2.v<h1.v && rv[h2.i]>rv[h1.i]){ dir="short"; kindLabel="Hidden Bearish"; pivA=h1; pivB=h2; }
          }
        }
        if (!dir && lows.length>=2){
          const l1=lows[lows.length-2], l2=lows[lows.length-1];
          if (l2.i-l1.i>=10 && isFinite(rv[l1.i]) && isFinite(rv[l2.i])){
            if (l2.v<l1.v && rv[l2.i]>rv[l1.i]){ dir="long"; kindLabel="Regular Bullish"; pivA=l1; pivB=l2; }
            else if (l2.v>l1.v && rv[l2.i]<rv[l1.i]){ dir="long"; kindLabel="Hidden Bullish"; pivA=l1; pivB=l2; }
          }
        }
        if (!dir) continue;
        if ((n-1-pivB.i) > 15) continue;
        const ev = cusumLast(c,1);
        if (ev && ev.barsAgo<=10){
          if ((dir==="long" && ev.dir==="short") || (dir==="short" && ev.dir==="long")) continue;
        }
        if (t.fundingPct!==null){
          const fr = t.fundingPct;
          if (Math.abs(fr) > 0.05-1e-9) continue;
          if ((dir==="long" && fr>=0.04) || (dir==="short" && fr<=-0.04)) continue;
        }
        const p = c[n-1];
        const a4 = last(atr(rows,14));
        if (!isFinite(a4) || a4<=0) continue;
        const entry = p;
        const stop = dir==="long" ? pivB.v - 0.5*a4 : pivB.v + 0.5*a4;
        const risk = Math.abs(entry-stop);
        if (!(risk>0)) continue;
        const t1 = dir==="long" ? entry+2*risk : entry-2*risk;
        const t2 = dir==="long" ? entry+3*risk : entry-3*risk;
        const rr = Math.abs(t1-entry)/risk;
        if (!(rr>=2)) continue;
        found++;
        const reg = detectRegime(rows);
        __cardsHtml.push(cardHTML(t.symbol, dir,
          [["mark",px(t.mark||p)],["type",kindLabel],["RSI 4H",fmt(rv[n-1],1)],["span",(pivB.i-pivA.i)+" bars"],
           ["funding", t.fundingPct!==null?fmt(t.fundingPct,4)+"%":"n/a"],["regime",reg.label]],
          ["G1 pivot structure","G2 span>=10 bars","G3 funding","G4 no opposing CUSUM","G5 R:R>=2"],
          planBlock(dir,entry,stop,t1,t2), entry, stop, t1));
        logSetup(t.symbol, dir, "div", entry, stop, t1);
      }catch(e){}
      await sleep(120);
    }
    statEl.textContent = "done \u2014 "+found+" divergences found";
    if (!found) emptyEl.style.display="block";
  }catch(e){ statEl.textContent = "divergence scan failed: "+e.message; }
  finally{
cardsEl.innerHTML = __cardsHtml.join(''); setProg("divProg", null); btn.disabled=false; }
}
async function runBasisScan(){
  const btn=$("basisRun"); const cardsEl=$("basisCards"); const emptyEl=$("basisEmpty"); const statEl=$("basisStat");
  btn.disabled=true; cardsEl.innerHTML=""; let __cardsHtml = []; emptyEl.style.display="none";
  try{
    statEl.textContent = "loading Delta India + CoinDCX symbol lists\u2026";
    const res = await Promise.all([ loadTickersDelta().catch(function(){return [];}), loadTickersCdcx().catch(function(){return [];}) ]);
    const dTick = res[0], cTick = res[1];
    const dMap = {}; dTick.forEach(function(t){ dMap[searchBase(t.symbol,"delta")] = t; });
    const cByBase = {}; cTick.forEach(function(t){ const b=searchBase(t.symbol,"cdcx"); if(!cByBase[b]) cByBase[b]=[]; cByBase[b].push(t); });
    const bases = Object.keys(dMap).filter(function(b){ return cByBase[b] && cByBase[b].length; });
    let found=0;
    for (let i=0;i<bases.length;i++){
      const b = bases[i];
      setProg("basisProg",(i+1)/bases.length);
      statEl.textContent = "checking "+(i+1)+"/"+bases.length+" \u00B7 "+b;
      const dT = dMap[b];
      const cSym = cByBase[b][0].symbol;
      try{
        const rows = await candlesCdcx(cSym,"15m",3);
        if (!rows.length) continue;
        const cPrice = rows[rows.length-1].c;
        if (!isFinite(dT.mark) || !isFinite(cPrice) || cPrice<=0) continue;
        const basisPct = (dT.mark - cPrice)/cPrice*100;
        if (Math.abs(basisPct) < 0.15) continue;
        found++;
        const dir = basisPct>0 ? "short" : "long";
        const nomStop = dir==="long" ? dT.mark*0.995 : dT.mark*1.005;
        const nomT1 = dir==="long" ? dT.mark*1.01 : dT.mark*0.99;
        const planTxt = "Informational only \u2014 not a single-click executable trade. "+b+" shows a "+basisPct.toFixed(3)+"% gap between Delta ("+dT.symbol+") and CoinDCX ("+cSym+"). CoinDCX exposes no funding-rate field here, so this is NOT a confirmed funding arbitrage \u2014 it only flags a price disagreement. Verify funding, withdrawal/transfer friction and execution cost yourself before acting.";
        __cardsHtml.push(cardHTML(b, dir,
          [["Delta mark",px(dT.mark)],["CoinDCX px",px(cPrice)],["basis",fmt(basisPct,3)+"%"],["delta funding", dT.fundingPct!==null?fmt(dT.fundingPct,4)+"%":"n/a"]],
          ["G1 base asset on both venues","G2 |basis|>=0.15%"],
          planTxt, dT.mark, nomStop, nomT1));
      }catch(e){}
      await sleep(150);
    }
    statEl.textContent = "done \u2014 "+found+" basis gaps found";
    if (!found) emptyEl.style.display="block";
  }catch(e){ statEl.textContent = "basis scan failed: "+e.message; }
  finally{
cardsEl.innerHTML = __cardsHtml.join(''); setProg("basisProg", null); btn.disabled=false; }
}

async function runApexScan(){
  const btn=$('apexRun'); const cardsEl=$('apexCards'); const emptyEl=$('apexEmpty'); const statEl=$('apexStat');
  btn.disabled=true; cardsEl.innerHTML=''; let __cardsHtml = []; emptyEl.style.display='none';
  try{
    if (!S.tickers.length) S.tickers=await getTickers();
    const btcSym = S.exchange==='delta' ? 'BTCUSD' : 'B-BTC_USDT';
    const btcRows = await getCandles(btcSym,'1h',72);
    if (btcRows.length<48) throw new Error('Insufficient BTC data for benchmark');
    const btcNow = btcRows[btcRows.length-1].c;
    const btc24h = btcRows[Math.max(0,btcRows.length-25)].c;
    const btcRet24 = ((btcNow-btc24h)/btc24h)*100;
    if (btcRet24>1.5){
      cardsEl.innerHTML = `<div class="empty">BTC is up ${fmt(btcRet24,2)}% in 24h. Relative Strength scans are invalid during macro uptrends because everything goes up. Wait for a BTC pullback to test for true Apex leaders.</div>`;
      statEl.textContent = `skipped \u2014 BTC bullish (+${fmt(btcRet24,2)}%)`;
      return;
    }
    const uni = S.exchange==='delta' ? S.tickers.filter(t=>t.turnoverUsd>=100000 && t.symbol!==btcSym) : S.tickers.filter(t=>t.symbol!==btcSym);
    let results=[];
    for (let i=0;i<uni.length;i++){
      const t=uni[i];
      setProg('apexProg',(i+1)/uni.length);
      statEl.textContent = `measuring ${i+1}/${uni.length} \u00B7 ${t.symbol}`;
      try{
        const rows=await getCandles(t.symbol,'1h',72);
        if (rows.length<50) continue;
        const c=rows.map(r=>r.c);
        const p=c[c.length-1];
        const p24=c[Math.max(0,c.length-25)];
        const ret24=((p-p24)/p24)*100;
        const spread24 = ret24 - btcRet24;
        if (spread24<5.0) continue;
        const e50=last(ema(c,50));
        if (p<e50) continue;
        results.push({sym:t.symbol, mark:p, ret24, spread24, e50, rows});
      }catch(e){}
      await sleep(100);
    }
    results.sort((a,b)=>b.spread24-a.spread24);
    results.forEach(r=>{
      __cardsHtml.push(cardHTML(r.sym,'long',
        [['mark',px(r.mark)],['BTC 24h',pct(btcRet24,2)],['asset 24h',pct(r.ret24,2)],['RS spread',pct(r.spread24,2)],['Nearest OB',nearestOBText(r.rows,'long')],['Liquidity Target',liquidityTargetText(r.rows,'long')]],
        ['G1 BTC headwind','G2 spread \u22655%','G3 1H EMA50 intact'],
        `MANUAL TRIGGER: do not buy yet. Pull up a 15m chart of BTC. The exact minute BTC prints a bullish reclaim or sweeps a local low, buy this asset.`,
        r.mark, r.e50, r.mark*1.05));
    });
    statEl.textContent = `done \u2014 ${results.length} Apex assets found`;
    if (!results.length) emptyEl.style.display='block';
  }catch(e){
 }finally{
cardsEl.innerHTML = __cardsHtml.join('');
    setProg('apexProg', null);
    btn.disabled=false;
  }
}
async function runTrapScan(){
const btn=$('trapRun'); const cardsEl=$('trapCards'); const emptyEl=$('trapEmpty'); const statEl=$('trapStat');
btn.disabled=true; cardsEl.innerHTML=''; let __cardsHtml = []; emptyEl.style.display='none';
try{
if (!S.tickers.length) S.tickers=await getTickers();
if (S.alertBusy){ while(S.alertBusy) await sleep(200); } const uni = S.exchange==='delta' ? S.tickers.filter(t=>t.turnoverUsd>=1000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd) : S.tickers.slice();
let found=0;
for (let i=0;i<uni.length;i++){
const t=uni[i];
setProg('trapProg',(i+1)/uni.length);
statEl.textContent = `hunting ${i+1}/${uni.length} \u00b7 ${t.symbol}`;
try{
const rows=await getCandles(t.symbol,'15m',100);
if (rows.length<50) continue;
const c=rows.map(r=>r.c);
const p=c[c.length-1];

const a14=last(atr(rows,14));
const atrPct=(a14/p)*100; const vr=volRegime(c); if (vr!=='EXPANDING') continue;
const outerSD=Math.min(4.5, Math.max(2.5, 3.0+(atrPct-0.5)*0.6));
const innerSD=Math.min(3.0, Math.max(1.8, 2.0+(atrPct-0.5)*0.3));

const bbOuter=bollinger(c,20,outerSD);
const bbInner=bollinger(c,20,innerSD);
const e20=bbInner.mid[c.length-1];
const rNow=last(rsi(c,14));

const lOuter=bbOuter.lower[c.length-1];
const lInner=bbInner.lower[c.length-1];
const uOuter=bbOuter.upper[c.length-1];
const uInner=bbInner.upper[c.length-1];

// Sweep can happen on any of the last 4 bars (not just this instant) - the reclaim
// (close back inside the inner band) is what confirms it right now. Momentum
// exhaustion (RSI) is checked AT THE SWEEP BAR itself, not after price has
// already partly recovered - by the time of reclaim RSI has typically normalized.
const N=20;
let sweptLowAt=-1, sweptHighAt=-1;
for (let k=Math.max(0,rows.length-N); k<rows.length; k++){
if (rows[k].l<lOuter) sweptLowAt=k;
if (rows[k].h>uOuter) sweptHighAt=k;
}
const reclaimLong = sweptLowAt>=0 && p>lInner;
const reclaimShort = sweptHighAt>=0 && p<uInner;

let dir=null, stop=NaN, rsiAtSweep=null;
if (reclaimLong){
const rAtSweep = last(rsi(c.slice(0,sweptLowAt+1),14));
if (rAtSweep<50){ dir='long'; stop=rows[sweptLowAt].l-(rows[sweptLowAt].l*0.001); rsiAtSweep=rAtSweep; }
}
if (!dir && reclaimShort){
const rAtSweep = last(rsi(c.slice(0,sweptHighAt+1),14));
if (rAtSweep>50){ dir='short'; stop=rows[sweptHighAt].h+(rows[sweptHighAt].h*0.001); rsiAtSweep=rAtSweep; }
}
if (!dir) continue;

const pctB=bollingerPercentB(c);
const risk=Math.abs(p-stop);
if (!(risk>0)) continue;
const t1=e20;
const room=Math.abs(t1-p);
const rr=room/risk;
if (rr<0.3) continue;

found++;
__cardsHtml.push(cardHTML(t.symbol, dir,
[['mark',px(p)],['RSI now',fmt(rNow,1)],['RSI at sweep',fmt(rsiAtSweep,1)],['%B (BB pos)',fmt(pctB,2)],['vol (ATR%)',fmt(atrPct,2)+'%'],
[fmt(outerSD,1)+' SD swept ('+(rows.length-1-(dir==='long'?sweptLowAt:sweptHighAt))+'b ago)', dir==='long'?px(rows[sweptLowAt].l):px(rows[sweptHighAt].h)],
[fmt(innerSD,1)+' SD reclaimed now', dir==='long'?px(lInner):px(uInner)],
['target (mean)',px(t1)]],
['G1 '+fmt(outerSD,1)+' SD extreme','G2 reclaimed '+fmt(innerSD,1)+' SD','G3 momentum exhausted at sweep'],
`Dynamic mean reversion: bands auto-scaled to ${fmt(outerSD,1)} SD based on this asset's volatility. Momentum exhaustion (RSI ${fmt(rsiAtSweep,1)}) is read at the moment of the extreme wick, not after price already reclaimed. Stop goes tight behind the wick at ${px(stop)}. Target the mean at ${px(t1)}.`,
p, stop, t1));
}catch(e){}
await sleep(100);
}
statEl.textContent = `done \u2014 ${found} traps found`;
if (!found) emptyEl.style.display='block';
}catch(e){
statEl.textContent = `trap scan failed: ${e.message}`;
}finally{
cardsEl.innerHTML = __cardsHtml.join('');
setProg('trapProg', null);
btn.disabled=false;
}
}
async function runSmcScan(){
  const btn = $('smcRun'); const cardsEl = $('smcCards'); const emptyEl = $('smcEmpty'); const statEl = $('smcStat');
  btn.disabled = true; cardsEl.innerHTML = ''; let __cardsHtml = []; emptyEl.style.display = 'none';
  try{
    if (!S.tickers.length) S.tickers = await getTickers();
    if (S.alertBusy){ while(S.alertBusy) await sleep(200); } let uni = S.exchange === 'delta' ? S.tickers.filter(t => t.turnoverUsd >= 1000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd) : S.tickers.slice();
    if (S.exchange === 'delta') uni.unshift({ symbol: 'XAUTUSD', mark: null, chg24: null, turnoverUsd: 0 });
    let found = 0;
    for (let i = 0; i < uni.length; i++){
      const t = uni[i];
      setProg('smcProg', (i+1)/uni.length);
      statEl.textContent = `hunting ${i+1}/${uni.length} - ${t.symbol}`;
      try{
        const isGold = t.symbol.includes('XAU');
        const rows = isGold ? await getXAUCandles('4h', 260) : await getCandles(t.symbol, '4h', 260);
        if (rows.length < 210) continue;
        const c = rows.map(r => r.c);
        const p = c[c.length-1];
        const e200 = last(ema(c, 200));
        const a14arr = atr(rows,14); let fvg = null, dir = null;
        for (let j = rows.length-200; j < rows.length-1; j++){
          const bar1 = rows[j-2], bar2 = rows[j-1], bar3 = rows[j];
          if (bar1.h < bar3.l && bar2.c > bar2.o){
            let gapHigh = bar3.l, gapLow = bar1.h, mitigated = false;
            for (let k = j+1; k < rows.length; k++){
              if (rows[k].l <= gapLow){ mitigated = true; break; }
              if (rows[k].l < gapHigh) gapHigh = rows[k].l;
            }
            if (!mitigated && p > e200){ const dispOkL=isFinite(a14arr[j-1])&&(bar2.h-bar2.l)>=1.5*a14arr[j-1]; const priorLowL=Math.min.apply(null, rows.slice(Math.max(0,j-12), Math.max(1,j-2)).map(function(r){return r.l;})); const sweepOkL=bar1.l<priorLowL||bar2.l<priorLowL; fvg = { top: gapHigh, bottom: gapLow, age: rows.length-1-j, dispOk: dispOkL, sweepOk: sweepOkL, bosOk: (bar2.c > Math.max.apply(null, rows.slice(Math.max(0,j-12), Math.max(1,j-2)).map(function(r){return r.h;}))) }; dir = 'long'; }
          } else if (bar1.l > bar3.h && bar2.c < bar2.o){
            let gapLow = bar3.h, gapHigh = bar1.l, mitigated = false;
            for (let k = j+1; k < rows.length; k++){
              if (rows[k].h >= gapHigh){ mitigated = true; break; }
              if (rows[k].h > gapLow) gapLow = rows[k].h;
            }
            if (!mitigated && p < e200){ const dispOkS=isFinite(a14arr[j-1])&&(bar2.h-bar2.l)>=1.5*a14arr[j-1]; const priorHighS=Math.max.apply(null, rows.slice(Math.max(0,j-12), Math.max(1,j-2)).map(function(r){return r.h;})); const sweepOkS=bar1.h>priorHighS||bar2.h>priorHighS; fvg = { top: gapHigh, bottom: gapLow, age: rows.length-1-j, dispOk: dispOkS, sweepOk: sweepOkS, bosOk: (bar2.c < Math.min.apply(null, rows.slice(Math.max(0,j-12), Math.max(1,j-2)).map(function(r){return r.l;}))) }; dir = 'short'; }
          }
        }
        if (!fvg) continue;
        const isTapping = p <= fvg.top && p >= fvg.bottom;
        if (!isTapping) continue;
        found++;
        const stop = dir === 'long' ? fvg.bottom - (fvg.bottom*0.002) : fvg.top + (fvg.top*0.002);
        const t1 = dir === 'long' ? Math.max(...rows.slice(-20).map(r=>r.h)) : Math.min(...rows.slice(-20).map(r=>r.l));
        const vp = volumeProfile(rows, 40, 24);
        const pocSide = vp ? (p > vp.poc ? 'above POC' : 'below POC') : 'n/a';
        __cardsHtml.push(cardHTML(t.symbol, dir, [
          ['mark', px(p)], ['Gap Age', `${fvg.age} bars (4H)`],
          ['POC (40b)', vp ? px(vp.poc)+' ('+pocSide+')' : 'n/a'], ['VA', vp ? px(vp.val)+'\u2013'+px(vp.vah) : 'n/a'],
          ['FVG Top', px(fvg.top)], ['FVG Bottom', px(fvg.bottom)],
          ['Struct Stop', px(stop)], ['Target Liq', px(t1)]
        ], ['G1 Displacement (FVG)', 'G2 Unmitigated', 'G3 Price inside POI', 'G4 HTF Trend Aligned', 'G5 Displacement magnitude (>=1.5x ATR)'+(fvg.dispOk?' ok':' n/a'), 'G6 Liquidity swept before impulse (breaker context)'+(fvg.sweepOk?' ok':' n/a'), 'G7 BOS confirmed (displacement broke recent structure)'+(fvg.bosOk?' ok':' n/a')],
        'SMC TAP: price has pulled back into a 4H institutional imbalance. Drop to a 5m/15m chart, wait for a local sweep or Change of Character (CHOCH) in your direction, then execute.', p, stop, t1));
      } catch(e) { /* skip this symbol */ }
      await sleep(100);
    }
    statEl.textContent = `done - ${found} SMC setups found`;
    if (!found) emptyEl.style.display = 'block';
  } catch(e){
    statEl.textContent = `smc scan failed: ${e.message}`;
  } finally {
cardsEl.innerHTML = __cardsHtml.join('');
    setProg('smcProg', null);
    btn.disabled = false;
  }
}
async function runObScan(){
  const btn = $('obRun'); const cardsEl = $('obCards'); const emptyEl = $('obEmpty'); const statEl = $('obStat');
  btn.disabled = true; cardsEl.innerHTML = ''; let __cardsHtml = []; emptyEl.style.display = 'none';
  try{
    if (!S.tickers.length) S.tickers = await getTickers();
    if (S.alertBusy){ while(S.alertBusy) await sleep(200); } let uni = S.exchange === 'delta' ? S.tickers.filter(t => t.turnoverUsd >= 1000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd) : S.tickers.slice();
    if (S.exchange === 'delta') uni.unshift({ symbol: 'XAUTUSD', mark: null, chg24: null, turnoverUsd: 0 });
    let found = 0;
    for (let i = 0; i < uni.length; i++){
      const t = uni[i];
      setProg('obProg', (i+1)/uni.length);
      statEl.textContent = `hunting ${i+1}/${uni.length} - ${t.symbol}`;
      try{
        const isGold = t.symbol.includes('XAU');
        const rows = isGold ? await getXAUCandles('4h', 260) : await getCandles(t.symbol, '4h', 260);
        if (rows.length < 210) continue;
        const c = rows.map(r => r.c);
        const p = c[c.length-1];
        const e200 = last(ema(c, 200));
        let dir = null, ob = null;
        const obLong = findOrderBlock(rows, 'long');
        const obShort = findOrderBlock(rows, 'short');
        if (obLong && p >= obLong.bottom && p <= obLong.top && p > e200){ dir = 'long'; ob = obLong; }
        else if (obShort && p >= obShort.bottom && p <= obShort.top && p < e200){ dir = 'short'; ob = obShort; }
        if (!dir) continue;
        found++;
        const lp = findLiquidityPools(rows);
        const target = dir === 'long' ? lp.buySide : lp.sellSide;
        const stop = dir === 'long' ? ob.bottom - (ob.bottom*0.002) : ob.top + (ob.top*0.002);
        const t1 = target ? target.level : (dir === 'long' ? Math.max(...rows.slice(-20).map(r=>r.h)) : Math.min(...rows.slice(-20).map(r=>r.l)));
        __cardsHtml.push(cardHTML(t.symbol, dir, [
          ['mark', px(p)], ['OB Age', `${ob.age} bars (4H)`],
          ['OB Top', px(ob.top)], ['OB Bottom', px(ob.bottom)],
          ['Struct Stop', px(stop)], ['Liquidity Target', target ? `${px(target.level)} (x${target.count})` : px(t1)]
        ], ['G1 Valid Order Block', 'G2 Unmitigated', 'G3 Price inside OB', 'G4 HTF Trend Aligned'],
        'ORDER BLOCK TAP: price has pulled back into an unmitigated 4H order block. Drop to a 5m/15m chart, wait for a local sweep or Change of Character (CHOCH) in your direction, then execute.', p, stop, t1));
      } catch(e) { /* skip this symbol */ }
      await sleep(100);
    }
    statEl.textContent = `done - ${found} Order Block setups found`;
    if (!found) emptyEl.style.display = 'block';
  } catch(e){
    statEl.textContent = `order block scan failed: ${e.message}`;
  } finally {
cardsEl.innerHTML = __cardsHtml.join('');
    setProg('obProg', null);
    btn.disabled = false;
  }
}
