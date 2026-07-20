/* best.js -- BEST-tab scanner extracted from index.html
   runBest (button-driven best-setups scan) + silentBestScan (background scan used by
   the alerts cycle). No credentials, no network. Call-time deps: setProg, gateRow,
   planBlock, toTrade (inline/other modules). Both are window globals; silentBestScan
   is called cross-module by alerts.js at call-time. */
async function runBest(){
  const btn=$('bestRun'); btn.disabled=true; setProg('bestProg',0.05);
  const out=$('bestOut'); out.innerHTML=''; $('bestStat').textContent='';
  try{
    const scanAll = $('bestAll').checked;
    const N = Math.max(5, Math.min(500, +$('bestN').value||30)); if (!S.tickers.length) S.tickers=await getTickers(); 
    if (!S.tickers.length) S.tickers=await getTickers();
    let uni = S.exchange==='delta'
      ? S.tickers.filter(t=> scanAll ? true : t.turnoverUsd>=200000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd)
      : S.tickers.slice();
    if (!scanAll) uni = uni.slice(0,N);
    const exLabel = S.exchange==='delta'?'Delta India':'CoinDCX';
    const universeLabel = scanAll ? `whole ${exLabel} futures universe` : `top ${N} by turnover`;
    const {clean, breadth} = await runCascadeCore(uni);
    if (!clean.length){
      out.innerHTML=`<div class="empty"><b>WAIT.</b> Nothing passed all seven hard gates across the ${universeLabel}. The best available trade right now is no trade \u2014 that verdict is the product working, not failing.</div>`;
      return;
    }
    const w=clean[0];
    const breadthPct = breadth.total>=10 ? (breadth.bull/breadth.total*100) : 50;
    const regimeDir = breadth.total>=10 ? (breadthPct<=20?'bear':(breadthPct>=80?'bull':null)) : null;
    if (regimeDir && ((regimeDir==='bear' && w.dir==='long') || (regimeDir==='bull' && w.dir==='short'))){
      $('bestStat').textContent = 'master veto: regime unsafe';
      out.innerHTML = `<div class="empty"><b style="color:var(--veto)">MASTER VETO: STAND ASIDE</b><br><br>Market breadth only ${fmt(breadthPct,0)}% bullish (${breadth.bull}/${breadth.total} coins above 200-EMA on 4H) \u2014 ${regimeDir} regime, ${w.dir} setups here are ${regimeDir==='bear'?'catching falling knives':'fighting a screaming uptrend'}. Scanning canceled to protect capital.</div>`;
      return;
    }
    const t1=w.t1; const t2=w.t2;
    logSetup(w.t.symbol,w.dir,'best',w.entry,w.stop,t1);
    const others = clean.slice(1,6).map(s=>`${s.t.symbol} ${s.dir.toUpperCase()} \u2014 ${s.famScore}/5 families \u00b7 ${s.robScore}/2 robustness \u00b7 ${fmt(s.rr,2)}R`).join('<br>') || 'none';
    out.innerHTML = `
      <div class="panel">
        <h2>${w.t.symbol} <span>${w.dir.toUpperCase()} \u00b7 ${w.entryType} \u00b7 mark ${px(w.t.mark||w.entry)} \u00b7 all 7 hard gates PASSED (ticket in \u2014 not part of the ranking)</span></h2>
        <div class="ledger">${w.fam.map(x=>gateRow(x[0], x[1], x[2]?'pass':'na', x[3])).join('')}</div>
        <div class="verdict ${w.dir}">
          <div class="vword">${w.dir.toUpperCase()} \u00b7 ${w.famScore}/5 FAMILIES \u00b7 ${w.robScore}/2 ROBUST</div>
          <div class="vwhy">Execution: ${w.entryType}. Ranked #1 of ${clean.length} CLEAN setups by independent evidence families, then robustness, then structural R:R. Families cannot be inflated by correlated indicators \u2014 trend counts once no matter how many trend indicators agree. 4/4 + 2/2 is the strongest evidence this framework can honestly claim, and it is still not a promise. Logged to LOG automatically.</div>
        </div>
        <div class="plan">${planBlock(w.dir,w.entry,w.stop,t1,t2)}</div><div class="note" style="margin-top:8px">Nearest OB: <b>${nearestOBText(w.rows,w.dir)}</b> \u00b7 Liquidity Target: <b>${liquidityTargetText(w.rows,w.dir)}</b></div>
        <button class="toTrade" onclick="toTrade('${w.t.symbol}','${w.dir}',${w.entry},${w.stop},${t1})">SEND TO TRADE PLAN \u2192</button>
        <hr class="sep">
        <div class="note"><b>Runners-up (also CLEAN):</b><br>${others}</div>
      </div>`;
    $('bestStat').textContent=`done \u00b7 ${clean.length} CLEAN of ${uni.length} scanned (${universeLabel})`;
  }catch(e){ out.innerHTML=`<div class="empty">best scan failed: ${e.message}</div>`; }
  finally{ setProg('bestProg',null); btn.disabled=false; }
}

async function silentBestScan(exchangeArg){
  const prevExchange = S.exchange;
  const prevTickers = S.tickers;
  S.exchange = exchangeArg;
  S.tickers = [];
  try{
    const scanAll = true;
    const N = 999999;
    if (!S.tickers.length) S.tickers=await getTickers();
    let uni = S.exchange==='delta'
      ? S.tickers.filter(t=> scanAll ? true : t.turnoverUsd>=200000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd)
      : S.tickers.slice();
    if (!scanAll) uni = uni.slice(0,N);
    const universeLabel = scanAll ? `whole ${S.exchange==='delta'?'Delta India':'CoinDCX'} futures universe` : `top ${N} by turnover`;
    const {clean} = await runCascadeCore(uni);
    return clean;
  }catch(e){ return []; }
  finally{ S.exchange = prevExchange; S.tickers = prevTickers; }
}
