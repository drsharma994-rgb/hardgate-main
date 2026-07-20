// finder.js \u2014 strategy finder & single-symbol evaluators (extracted from index.html, Phase 20)
// Call-time deps stay elsewhere: $, S, getCandles, getXAUCandles, searchBase, indicators, etc.
// Globals: findTickerForBase, evalSwingSingle, evalScalpSingle, evalGoldSwing, renderStrategy, finderTypeChanged, runFinder.

async function findTickerForBase(base){
  const B = base.toUpperCase();
  const dts = await loadTickersDelta();
  let hit = dts.find(t => searchBase(t.symbol,'delta')===B);
  if (hit) return {exch:'delta', sym:hit.symbol, fundingPct:hit.fundingPct, mark:hit.mark};
  const cts = await loadTickersCdcx();
  hit = cts.find(t => searchBase(t.symbol,'coindcx')===B);
  if (hit) return {exch:'coindcx', sym:hit.symbol, fundingPct:hit.fundingPct ?? null, mark:hit.mark};
  return null;
}

async function evalSwingSingle(sym, exch){
  const rows = exch==='delta' ? await candlesDelta(sym,'4h',260) : await candlesCdcx(sym,'4h',260);
  if (rows.length<210) return {error:'not enough 4H history'};
  const c=rows.map(r=>r.c);
  const e9=last(ema(c,9)), e21=last(ema(c,21)), e50=last(ema(c,50)), e200=last(ema(c,200));
  const p=last(c), r14=last(rsi(c,14)), vz=volZ(rows,20);
  const a4=last(atr(rows,14));
  let dir = e9>e21&&e21>e50 ? 'long' : (e9<e21&&e21<e50 ? 'short' : null);
  const g=[];
  const spreadOk = dir && isFinite(a4) && Math.abs(e21-e50)>=0.25*a4;
  g.push(['G1','4H EMA cascade with real spread', dir&&spreadOk?'pass':'veto', dir?`${dir.toUpperCase()} \u00B7 spread ${isFinite(a4)?fmt(Math.abs(e21-e50)/a4,2):'\u2014'}x ATR`:'no cascade']);
  if (!dir || !spreadOk) return {gates:g, veto:true};
  const htfOk = dir==='long'?p>e200:p<e200;
  g.push(['G2','HTF side (200EMA)', htfOk?'pass':'veto', `price ${px(p)} vs 200EMA ${px(e200)}`]);
  const rsiVeto = (dir==='long'&&r14>70)||(dir==='short'&&r14<30);
  g.push(['G3','RSI exhaustion guard', rsiVeto?'veto':'pass', `RSI14 ${fmt(r14,1)}`]);
  g.push(['G4','Funding clean','na','fetched from ticker separately']);
  if (!(vz>0.5)){ g.push(['G5','Vol + wick commit','veto',`vol z ${fmt(vz,2)} (need >0.5)`]); return {gates:g, veto:true}; }
  const currentBar=rows[rows.length-1]; const range=currentBar.h-currentBar.l; const closePos=range>0?(currentBar.c-currentBar.l)/range:0.5;
  const wickOk = dir==='long'?closePos>=0.60:closePos<=0.40;
  g.push(['G5','Vol + wick commit', wickOk?'pass':'veto', `vol z ${fmt(vz,2)} \u00B7 closePos ${fmt(closePos,2)}`]);
  if (!wickOk) return {gates:g, veto:true};
  const stop = lastSwing(rows, dir, 30);
  const distToAnchor = Math.abs(p-e21)/a4;
  const risk = Math.abs(p-stop);
  const expectedMove = a4*3.5;
  const dynamicRR = risk>0 ? expectedMove/risk : NaN;
  const rrOk = distToAnchor<=1.5 && risk>0 && dynamicRR>=2;
  g.push(['G6','Structural R:R \u2265 2', rrOk?'pass':'veto', risk>0?`dyn R:R ${fmt(dynamicRR,2)} \u00b7 dist/anchor ${fmt(distToAnchor,2)}`:'no structure']);
  if (!rrOk) return {gates:g, veto:true, entry:p, stop};
  const ev = cusumLast(c.slice(-120),1);
  const cusumVeto = ev && ev.barsAgo<=20 && ev.dir!==dir;
  g.push(['G7','CUSUM event alignment', cusumVeto?'veto':'pass', ev?`${ev.dir.toUpperCase()} event ${ev.barsAgo} bars ago`:'no recent event']); const mh8=last(macdHist(c)); const macdOk=dir==='long'?mh8>0:mh8<0; g.push(['G8','MACD zero-line agree (info)', macdOk?'ok':'na', `hist ${fmt(mh8,4)}`]); const vd9=vwapDev(rows,20); const vwapOk9=isFinite(vd9)?(dir==='long'?vd9>0:vd9<0):false; g.push(['G9','VWAP side agree (info)', isFinite(vd9)?(vwapOk9?'ok':'na'):'na', isFinite(vd9)?`${fmt(vd9,2)}% vs 20-bar VWAP`:'n/a']); const dRows=await getCandles(sym,'1d',60); const dCl=dRows.map(r=>r.c); const dOk=dRows.length>=52; const de20=dOk?last(ema(dCl,20)):NaN; const de50=dOk?last(ema(dCl,50)):NaN; const mtfAgree=dOk?(dir==='long'?de20>de50:de20<de50):false; g.push(['G10','1D structure agree (info)', dOk?(mtfAgree?'ok':'na'):'na', dOk?`1D EMA20 ${de20>de50?'>':'<'} EMA50`:'n/a']);
  const veto = g.some(x=>x[2]==='veto');
  const t2 = dir==='long'?p+a4*4.9:p-a4*4.9;
  const t1 = dir==='long'?p+expectedMove:p-expectedMove;
  return {gates:g, veto, dir, entry:p, stop, t1, t2};
}

async function evalScalpSingle(sym, exch, tickerFundingPct, minsToFunding){
  const h1 = exch==='delta' ? await candlesDelta(sym,'1h',120) : await candlesCdcx(sym,'1h',120);
  if (h1.length<60) return {error:'not enough 1H history'};
  const c1=h1.map(r=>r.c);
  const e9h=last(ema(c1,9)), e21h=last(ema(c1,21)), e50h=last(ema(c1,50));
  let dir = e9h>e21h&&e21h>e50h ? 'long' : (e9h<e21h&&e21h<e50h ? 'short' : null);
  const g=[];
  g.push(['G1','1H trend', dir?'pass':'veto', dir?dir.toUpperCase():'no clean 1H trend']);
  if (!dir) return {gates:g, veto:true};
  const m15 = exch==='delta' ? await candlesDelta(sym,'15m',160) : await candlesCdcx(sym,'15m',160);
  if (m15.length<60) return {gates:g, veto:true, error:'not enough 15m history'};
  const c15=m15.map(r=>r.c); const n=c15.length;
  const e9a=ema(c15,9), e21a=ema(c15,21);
  const priorWin = m15.slice(n-24,n-7);
  const localLow = Math.min(...priorWin.map(r=>r.l));
  const localHigh = Math.max(...priorWin.map(r=>r.h));
  const recentWin = m15.slice(n-7,n-1);
  const sweptLiquidity = dir==='long' ? Math.min(...recentWin.map(r=>r.l))<localLow : Math.max(...recentWin.map(r=>r.h))>localHigh;
  const reclaimed = dir==='long' ? (c15[n-1]>e9a[n-1]&&e9a[n-1]>e21a[n-1]) : (c15[n-1]<e9a[n-1]&&e9a[n-1]<e21a[n-1]);
  g.push(['G2','Judas sweep + reclaim', sweptLiquidity&&reclaimed?'pass':'veto', sweptLiquidity?(reclaimed?'swept + reclaimed':'swept, not reclaimed yet'):'no sweep of local low/high']);
  if (!(sweptLiquidity&&reclaimed)) return {gates:g, veto:true};
  const r15 = last(rsi(c15,14));
  const rsiOk = dir==='long'?(r15>=40&&r15<=65):(r15>=35&&r15<=60);
  g.push(['G3','15m RSI band', rsiOk?'pass':'veto', `RSI15 ${fmt(r15,1)}`]);
  if (!rsiOk) return {gates:g, veto:true};
  let g4='na', g4d='funding n/a';
  if (tickerFundingPct!=null){
    const bad = Math.abs(tickerFundingPct)>0.05-1e-9 || (dir==='long'&&tickerFundingPct>=0.04) || (dir==='short'&&tickerFundingPct<=-0.04);
    g4 = bad?'veto':'pass'; g4d = `${fmt(tickerFundingPct,4)}%/interval`;
  }
  g.push(['G4','Funding clean', g4, g4d]);
  if (g4==='veto') return {gates:g, veto:true};
  const settleOk = minsToFunding==null || minsToFunding>=25;
  g.push(['G5','\u2265 25 min to funding settlement', settleOk?'pass':'veto', minsToFunding!=null?`${fmt(minsToFunding,0)}m to settle`:'n/a']);
  if (!settleOk) return {gates:g, veto:true};
  const atrArr=atr(m15,14); const a=last(atrArr);
  const base=atrArr.slice(-96).filter(isFinite).sort((x,y)=>x-y);
  const aMed=base.length?base[Math.floor(base.length/2)]:NaN;
  const volAlive = isFinite(a)&&isFinite(aMed)&&a>=0.8*aMed;
  g.push(['G6','Volatility alive', volAlive?'pass':'veto', `ATR15 ${px(a)} \u00b7 med ${px(aMed)}`]);
  if (!volAlive) return {gates:g, veto:true};
  const entry=c15[n-1];
  const stop = dir==='long'?localLow-0.25*a:localHigh+0.25*a;
  const risk=Math.abs(entry-stop);
  const expectedMove=a*2.5, maxExcursion=a*4;
  const dynamicRR = risk>0?expectedMove/risk:NaN;
  const rrOk = risk>0 && dynamicRR>=1.5;
  g.push(['G7','1.5R vol-capped', rrOk?'pass':'veto', risk>0?`dyn R:R ${fmt(dynamicRR,2)}`:'no risk']); const vzS9=volZ(m15,20); const volExp9=isFinite(vzS9)&&vzS9>1.0; g.push(['G9','Volume expansion (info)', isFinite(vzS9)?(volExp9?'ok':'na'):'na', isFinite(vzS9)?`vol z ${fmt(vzS9,2)}`:'n/a']);
  const veto = g.some(x=>x[2]==='veto');
  const t1 = dir==='long'?entry+expectedMove:entry-expectedMove;
  const t2 = dir==='long'?entry+maxExcursion:entry-maxExcursion;
  return {gates:g, veto, dir, entry, stop, t1, t2};
}

async function evalGoldSwing(){
  const d1 = await getXAUCandles('1d',260);
  const h4 = await getXAUCandles('4h',300);
  if (d1.length<60||h4.length<210) return {error:'not enough XAUTUSD history'};
  const c4=h4.map(r=>r.c), c1=d1.map(r=>r.c);
  const e9=last(ema(c4,9)), e21=last(ema(c4,21)), e50=last(ema(c4,50));
  const a4=last(atr(h4,14));
  const e50d=last(ema(c1,50)), pd=last(c1);
  const r4=last(rsi(c4,14));
  const casc = e9>e21&&e21>e50 ? 'long' : (e9<e21&&e21<e50 ? 'short' : 'mixed');
  const spreadOk = isFinite(a4) && Math.abs(e21-e50) >= 0.25*a4;
  const dSide = pd>e50d ? 'long' : 'short';
  const sg=[];
  sg.push(['GS1','4H EMA cascade with real spread', casc!=='mixed'&&spreadOk?'pass':'veto', `9/21/50 \u2192 ${casc.toUpperCase()}`]);
  sg.push(['GS2','1D side agrees', casc!=='mixed'&&casc===dSide?'pass':'veto', `1D \u2192 ${dSide.toUpperCase()}`]);
  const rsiVeto=(casc==='long'&&r4>70)||(casc==='short'&&r4<30);
  sg.push(['GS3','4H RSI exhaustion guard', rsiVeto?'veto':'pass', `RSI14 ${fmt(r4,1)}`]);
  sg.push(['GS4','Funding clean','na','funding n/a on this feed']);
  const r30g=roc(c1,30), r90g=roc(c1,90);
  let gs5='na';
  if (casc!=='mixed' && isFinite(r30g) && isFinite(r90g)){
    const want=casc==='long'?1:-1;
    const agree=(Math.sign(r30g)===want?1:0)+(Math.sign(r90g)===want?1:0);
    gs5 = agree===2?'pass':agree===0?'veto':'na';
  }
  sg.push(['GS5','TSMOM 30/90d sign', gs5, `30d ${pct(r30g,1)} \u00b7 90d ${pct(r90g,1)}`]);
  const evG = cusumLast(c4.slice(-120), 1);
  let gs6='na';
  if (evG && evG.barsAgo<=20 && casc!=='mixed') gs6 = evG.dir===casc?'pass':'veto';
  sg.push(['GS6','CUSUM event alignment', gs6, evG?`${evG.dir.toUpperCase()} event ${evG.barsAgo} bars ago`:'no recent event']);
  let entry=null, stop=null, t1=null, t2=null;
  if (casc!=='mixed'){
    stop=lastSwing(h4,casc,30); entry=last(c4);
    const risk=Math.abs(entry-stop);
    const room = casc==='long' ? Math.max(...h4.slice(-120).map(r=>r.h))-entry : entry-Math.min(...h4.slice(-120).map(r=>r.l));
    const rrOk = risk>0 && room/risk>=2;
    sg.push(['GS7','Structural R:R \u2265 2', rrOk?'pass':'veto', risk>0?`${fmt(room/risk,2)}R room`:'no structure']);
    if(rrOk){ t1=casc==='long'?entry+2*risk:entry-2*risk; t2=casc==='long'?entry+3*risk:entry-3*risk; }
  } else {
    sg.push(['GS7','Structural R:R \u2265 2','na','no direction']);
  }
  const veto = sg.some(x=>x[2]==='veto');
  return {gates:sg, veto, dir:casc!=='mixed'?casc:null, entry, stop, t1, t2};
}

function renderStrategy(label, result){
  if (result.error) return `<div class="panel"><h2>${label}</h2><div class="note warn">${result.error}</div></div>`;
  const ledger = result.gates.map(g=>gateRow(...g)).join('');
  const verdict = result.veto ? 'NO TRADE' : (result.dir ? result.dir.toUpperCase()+' VALID' : 'STAND ASIDE');
  const planHtml = (!result.veto && result.dir && result.entry!=null && result.stop!=null && result.t1!=null)
    ? `<div class="plan">${planBlock(result.dir, result.entry, result.stop, result.t1, result.t2||result.t1)}</div>`
    : '';
  return `<div class="panel"><h2>${label}</h2><div class="ledger">${ledger}</div><div class="verdict ${result.veto?'aside':(result.dir||'aside')}"><div class="vword">${verdict}</div></div>${planHtml}</div>`;
}

function finderTypeChanged(){
  const type = document.getElementById('finderType').value;
  document.getElementById('finderSymWrap').style.display = type==='crypto' ? '' : 'none';
}

async function runFinder(){
  const type = document.getElementById('finderType').value;
  const out = document.getElementById('finderOut');
  const stat = document.getElementById('finderStat');
  out.innerHTML=''; stat.textContent='evaluating\u2026';
  try{
    if (type==='gold'){
      const swing = await evalGoldSwing();
      const d1=await getXAUCandles('1d',60), h1=await getXAUCandles('1h',200), m15=await getXAUCandles('15m',200);
      const jl = judasSweepCheck('long', d1, h1, m15);
      const js = judasSweepCheck('short', d1, h1, m15);
      out.innerHTML = renderStrategy('GOLD SWING', swing) + renderStrategy('JUDAS SWEEP \u2014 LONG', jl) + renderStrategy('JUDAS SWEEP \u2014 SHORT', js)
        + `<div class="row"><button class="btn" onclick="runFinderGoldBacktest()">RUN BACKTEST CONTEXT</button></div><div id="finderBacktestOut"></div>`;
      stat.textContent = 'evaluated \u00b7 ' + new Date().toTimeString().slice(0,8);
    } else {
      const base = document.getElementById('finderSym').value.trim().toUpperCase();
      if (!base){ stat.textContent='enter a symbol'; return; }
      const t = await findTickerForBase(base);
      if (!t){ out.innerHTML = '<div class="note warn">No match for "'+base+'" on Delta India or CoinDCX futures.</div>'; stat.textContent=''; return; }
      const mins = tickClock();
      const swing = await evalSwingSingle(t.sym, t.exch);
      const scalp = await evalScalpSingle(t.sym, t.exch, t.fundingPct, mins);
      const d1 = t.exch==='delta'?await candlesDelta(t.sym,'1d',60):await candlesCdcx(t.sym,'1d',60);
      const h1 = t.exch==='delta'?await candlesDelta(t.sym,'1h',200):await candlesCdcx(t.sym,'1h',200);
      const m15 = t.exch==='delta'?await candlesDelta(t.sym,'15m',200):await candlesCdcx(t.sym,'15m',200);
      const jl = judasSweepCheck('long', d1, h1, m15);
      const js = judasSweepCheck('short', d1, h1, m15);
      out.innerHTML = `<div class="note">${t.sym} \u00b7 ${t.exch==='delta'?'Delta India':'CoinDCX'} \u00b7 mark ${px(t.mark)}</div>`
        + renderStrategy('SWING', swing) + renderStrategy('SCALP', scalp) + renderStrategy('JUDAS SWEEP \u2014 LONG', jl) + renderStrategy('JUDAS SWEEP \u2014 SHORT', js)
        + `<div class="row"><button class="btn" onclick="runFinderCryptoBacktest('${base}')">RUN BACKTEST CONTEXT</button></div><div id="finderBacktestOut"></div>`;
      stat.textContent = 'evaluated \u00b7 closed bars only \u00b7 ' + new Date().toTimeString().slice(0,8);
    }
  }catch(e){
    stat.textContent = 'evaluation failed: ' + e.message;
  }
}
