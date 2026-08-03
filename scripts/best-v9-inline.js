/* =============================================================================
   BEST — all hard gates first (binary ticket), then rank CLEAN survivors by a
   visible tally of 9 independent aligned confirmations + Institutional Vetoes.
   Profit rank: scorecard expectancy boost when ledger has evidence.
   ============================================================================= */
function bestProfitBoost(s){
  try{
    if (typeof hgProfitRankHint !== 'function') return 0;
    var h = hgProfitRankHint({ sym: s.t.symbol, dir: s.dir, lane: 'crypto', rr1: s.rr });
    return (h && isFinite(h.boost)) ? h.boost : 0;
  }catch(e){ return 0; }
}

function bestSortPool(clean){
  const strong = clean.filter(s => s.famScore >= 5);
  return strong.length ? strong : clean;
}

function bestSessionActive(){
  try{
    const d = new Date();
    const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
    const mins = ist.getHours() * 60 + ist.getMinutes(), day = ist.getDay();
    if (day === 0 || (mins >= 60 && mins <= 390)) return false;
    return (mins >= 750 && mins <= 930) || (mins >= 1050 && mins <= 1230);
  }catch(e){ return false; }
}

async function runCascadeCore(uni){
  let clean=[];
  let breadthBull=0, breadthTotal=0;
  const CHUNK1_SIZE=5;
  for (let ci=0; ci<uni.length; ci+=CHUNK1_SIZE){
    const chunk = uni.slice(ci, ci+CHUNK1_SIZE);
    await Promise.all(chunk.map(async function(t, idxInChunk){
      const i = ci+idxInChunk; setProg('bestProg',(i+1)/uni.length*0.65);
      $('bestStat').textContent=`gates ${i+1}/${uni.length} · ${t.symbol}`;
      try{
        const rows=await getCandles(t.symbol,'4h',260);
        if (rows.length<210) return;
        if (typeof hgRegimeAllowsSetup === 'function'){
          const rg = hgRegimeAllowsSetup(rows, 'best');
          if (rg && !rg.allow) return;
        } else if (typeof detectRegime === 'function'){
          const dr = detectRegime(rows);
          if (dr && dr.regime === 'compression') return;
        }
        if (typeof swingTryClean !== 'function') return;
        const tc = swingTryClean(rows, t);
        if (!tc || !tc.dir) return;
        const c=rows.map(r=>r.c);
        const e21=last(ema(c,21)), p=last(c), a4=last(atr(rows,14));
        const distToAnchor = (isFinite(a4) && a4 > 0) ? Math.abs(p - e21) / a4 : NaN;
        const risk = Math.abs(tc.entry - tc.stop);
        if (!(risk > 0)) return;

        // Quick 200 EMA read for breadth
        const e200arr = ema(c,200);
        const e200 = e200arr.length ? last(e200arr) : NaN;
        if (isFinite(e200)){ breadthTotal++; if (p>e200) breadthBull++; }

        clean.push({t, dir: tc.dir, rows, entry: tc.entry, entryType: tc.entryType || 'MARKET',
          distToAnchor, stop: tc.stop, risk, rr: tc.rr, t1: tc.t1, t2: tc.t2,
          vz: tc.vz, fr: t.fundingPct, ev: tc.ev, veto: false,
          targetPolicy: 'ATR excursion (3.5×/4.9×)', planSrc: 'swingTryClean'});
      }catch(e){}
    }));
    await sleep(60);
  }

  /* Evidence FAMILIES & VETOES for survivors */
  for (let i=0;i<clean.length;i++){
    const s=clean[i]; setProg('bestProg',0.65+((i+1)/clean.length)*0.3);
    $('bestStat').textContent=`evidence ${i+1}/${clean.length} · ${s.t.symbol}`;
    const want=s.dir==='long'?1:-1;
    const c=s.rows.map(r=>r.c);
    const a4=last(atr(s.rows,14));

    /* F1 TREND */
    let mTs=false, mD1=false, tsD='1D fetch failed', d1D='1D fetch failed';
    try{
      const d1=await getCandles(s.t.symbol,'1d',120); const c1=d1.map(r=>r.c);
      const r30=roc(c1,30), r90=roc(c1,90);
      mTs = isFinite(r30)&&isFinite(r90)&&Math.sign(r30)===want&&Math.sign(r90)===want;
      tsD = `30d ${pct(r30,1)} · 90d ${pct(r90,1)}`;
      const e50d=last(ema(c1,50));
      mD1 = c1.length>=60 && (s.dir==='long'?last(c1)>e50d:last(c1)<e50d);
      d1D = `1D EMA50 ${px(e50d)}`;
    }catch(e){}
    const mCu = !!(s.ev&&s.ev.barsAgo<=20&&s.ev.dir===s.dir);
    const trendVotes=(mTs?1:0)+(mD1?1:0)+(mCu?1:0);
    const f1 = trendVotes>=2;

    /* F2 POSITIONING */
    const f2 = s.fr!==null && (s.dir==='long'?s.fr<0:s.fr>0);

    /* F3 PARTICIPATION */
    let vwapOk=false, vwapDetail='n/a';
    try{
      const dv = vwapDev(s.rows,20);
      if (isFinite(dv)){ vwapOk = want>0 ? dv>0 : dv<0; vwapDetail = fmt(dv,2)+'% vs 20-bar VWAP'; }
    }catch(e){}
    const f3 = s.vz>1.0 || vwapOk;

    /* F4 STRUCTURE */
    const d20High = Math.max(...s.rows.slice(-20).map(r=>r.h));
    const d20Low = Math.min(...s.rows.slice(-20).map(r=>r.l));
    const d20Edge = s.dir==='long' ? d20High : d20Low;
    const mDc = Math.abs(s.entry-d20Edge)/s.entry<=0.015, mRr=s.rr>=3;
    const f4 = mDc||mRr;
    function pxFmt(n){ return (typeof px === 'function') ? px(n) : Number(n).toFixed(2); }

    /* F6 SESSION */
    const f6 = bestSessionActive();

    /* F7 VALUE AREA */
    let f7=false, f7Detail='volume profile n/a', vpPoc=NaN;
    try{
      const vp = (typeof volumeProfile === 'function') ? volumeProfile(s.rows, 80, 24) : null;
      const pxLast = last(c);
      if (vp && isFinite(vp.poc) && isFinite(pxLast)){
        vpPoc = vp.poc;
        f7 = (want>0 && isFinite(vp.val) && pxLast <= vp.poc && pxLast >= vp.val)
          || (want<0 && isFinite(vp.vah) && pxLast >= vp.poc && pxLast <= vp.vah);
        f7Detail = 'POC ' + pxFmt(vp.poc) + ' · VA ' + pxFmt(vp.val) + '–' + pxFmt(vp.vah)
          + (f7 ? ' · aligned' : ' · not at edge');
      }
    }catch(e){}

    /* F5 VOLATILITY/MOMENTUM */
    let f5=false, f5Detail='insufficient history';
    try{
      const nX = c.length;
      if (nX>=40){
        const bbX = bollinger(c,20,2);
        const priorWidths = bbX.widthPct.slice(Math.max(0,nX-50), nX-1).filter(v=>isFinite(v));
        const wAvg = priorWidths.length ? priorWidths.reduce((a,b)=>a+b,0)/priorWidths.length : NaN;
        const bbBreak = (want>0 ? c[nX-1]>bbX.upper[nX-1] : c[nX-1]<bbX.lower[nX-1]) && isFinite(wAvg) && bbX.widthPct[nX-2]<=wAvg;
        const adxX = adx(s.rows,14);
        const adxAligned = adxX.adx[nX-1]>=20 && (want>0 ? adxX.plusDI[nX-1]>adxX.minusDI[nX-1] : adxX.minusDI[nX-1]>adxX.plusDI[nX-1]);
        const srsiX = stochRsi(c,14,14);
        const srsiOk = isFinite(srsiX[nX-1]) && (want>0 ? srsiX[nX-1]<80 : srsiX[nX-1]>20);
        const votes5 = (bbBreak?1:0)+(adxAligned?1:0)+(srsiOk?1:0);
        f5 = votes5>=2;
        f5Detail = 'BB '+(bbBreak?'breakout':'no breakout')+' · ADX '+fmt(adxX.adx[nX-1],1)+' '+(adxAligned?'aligned':'not aligned')+' · StochRSI '+fmt(srsiX[nX-1],0)+' '+(srsiOk?'not exhausted':'exhausted');
      }
    }catch(e){}

    /* F8 ORDER FLOW & MICROSTRUCTURE TRAP VETO (Binance Proxy) */
    let f8 = false, f8Detail = 'CVD/L2 unread', isCvdTrap = false, trapReason = '';
    try {
        if (typeof binanceTakerRatio === 'function' && typeof binanceDepth === 'function') {
            const symStr = s.t.symbol.replace(/USDT$/, '') + 'USDT';
            const [tk, bk] = await Promise.all([
                binanceTakerRatio(symStr, '1h', 25).catch(()=>null),
                binanceDepth(symStr, 20).catch(()=>null)
            ]);
            let cvdRatio = NaN, obiVal = NaN, cvdAligned = false, obiAligned = false;

            if (tk && tk.series && tk.series.length >= 16) {
                let recent = 0, prior = 0, tC = 0;
                for (let k = tk.series.length - 8; k < tk.series.length; k++) { recent += +tk.series[k].buySellRatio||0; tC++; }
                recent /= tC||1;
                for (let k = tk.series.length - 16; k < tk.series.length - 8; k++) prior += +tk.series[k].buySellRatio||0;
                prior /= 8;
                cvdRatio = recent;

                // Hard Veto Limits
                if (want > 0 && recent <= 0.85) { isCvdTrap = true; trapReason = 'SEVERE CVD DIVERGENCE: Sellers dumping into long'; }
                if (want < 0 && recent >= 1.15) { isCvdTrap = true; trapReason = 'SEVERE CVD DIVERGENCE: Buyers squeezing short'; }

                // Confirmations
                if (want > 0 && recent >= 1.05 && recent >= prior - 0.05) cvdAligned = true;
                if (want < 0 && recent <= 0.95 && recent <= prior + 0.05) cvdAligned = true;
            }
            if (bk && isFinite(+bk.bidUsd) && isFinite(+bk.askUsd)) {
                const bid = +bk.bidUsd, ask = +bk.askUsd, tot = bid + ask;
                if (tot > 200000) {
                    obiVal = (bid - ask) / tot;
                    if (want > 0 && obiVal >= 0.33) obiAligned = true;
                    if (want < 0 && obiVal <= -0.33) obiAligned = true;
                    if (want > 0 && obiVal <= -0.33) { isCvdTrap = true; trapReason = 'SPOOF TRAP: Heavy ASK wall blocking long'; }
                    if (want < 0 && obiVal >= 0.33) { isCvdTrap = true; trapReason = 'SPOOF TRAP: Heavy BID wall blocking short'; }
                }
            }
            f8 = cvdAligned || obiAligned;
            f8Detail = `CVD ${isFinite(cvdRatio)?fmt(cvdRatio,2):'n/a'} ${cvdAligned?'✓':'✗'} · OBI ${isFinite(obiVal)?fmt(obiVal,2):'n/a'} ${obiAligned?'✓':'✗'}`;
        }
    } catch(e) {}
    if (isCvdTrap) s.veto = true;

    /* F9 ANCHOR CLUSTERING */
    let f9 = false, f9Detail = 'no cluster';
    try {
        const dcMid = (d20High + d20Low) / 2;
        const e21 = last(ema(c, 21)), e50 = last(ema(c, 50));
        const atrTolerance = isFinite(a4) ? a4 * 0.3 : s.entry * 0.005;
        let clusterCount = 0;
        const anchors = [e21, e50, dcMid, vpPoc];
        for(let a=0; a<anchors.length; a++){
            if (isFinite(anchors[a]) && Math.abs(s.entry - anchors[a]) <= atrTolerance) clusterCount++;
        }
        f9 = clusterCount >= 2;
        f9Detail = `${clusterCount} structural anchors within 0.3 ATR of entry`;
    } catch(e) {}

    /* R1 ROBUSTNESS */
    let r1=false, r1D='2H fetch failed';
    try{
      const h2=await getCandles(s.t.symbol,'2h',160); const c2=h2.map(r=>r.c);
      const a9=last(ema(c2,9)), a21=last(ema(c2,21)), a50=last(ema(c2,50));
      r1 = s.dir==='long' ? (a9>a21&&a21>a50) : (a9<a21&&a21<a50);
      r1D = `2H EMA9/21/50 ${r1?'aligned':'NOT aligned'}`;
    }catch(e){}

    /* R2 ROBUSTNESS */
    const age = cascadeAge(c, s.dir);
    const r2 = age>=3;

    s.fam=[
      ['G0','Anti-Chase Guard — price to EMA21 distance', true, `${fmt(s.distToAnchor,2)} ATR (limit ≤ 1.5, entry: ${s.entryType})`],
      ['F1','TREND family — 2-of-3 majority: TSMOM · 1D side · CUSUM', f1, `${trendVotes}/3 → TSMOM ${mTs?'✓':'✗'} (${tsD}) · 1D ${mD1?'✓':'✗'} · CUSUM ${mCu?'✓':'✗'}${s.ev?` (${s.ev.dir.toUpperCase()} ${s.ev.barsAgo} bars ago)`:''}`],
      ['F2','POSITIONING family — funding tailwind (crowd pays you)', f2, s.fr!==null?`${fmt(s.fr,4)}%/interval`:'n/a'],
      ['F3','PARTICIPATION family — volume z > 1.0 or VWAP side', f3, `z ${fmt(s.vz,2)} · ${vwapDetail}`],
      ['F4','STRUCTURE family — Donchian-20 breakout zone or R:R ≥ 3', f4, `Donchian ${mDc?'✓':'✗'} (${px(d20Edge)}) · R:R ${mRr?'✓':'✗'} (${fmt(s.rr,2)}R)`],
      ['F5','VOLATILITY/MOMENTUM family — Bollinger breakout · ADX trend · StochRSI', f5, f5Detail],
      ['F6','SESSION family — London/NY ICT kill zone active', f6, f6 ? 'London 12:30–15:30 or NY 17:30–20:30 IST' : 'off-hours / mid-session — thinner liquidity'],
      ['F7','VALUE AREA family — price at 70% volume-profile edge', f7, f7Detail],
      ['F8','ORDER FLOW family — CVD / Order Book Imbalance aligned', f8, f8Detail],
      ['F9','ANCHOR CLUSTER family — ≥2 structure levels overlap', f9, f9Detail],
      ['R1','ROBUSTNESS — cascade also holds on 2H (anti curve-fit)', r1, r1D],
      ['R2','ROBUSTNESS — cascade age ≥3 closed 4H bars (anti flicker)', r2, `${age} bars`],
    ];
    s.famScore=(f1?1:0)+(f2?1:0)+(f3?1:0)+(f4?1:0)+(f5?1:0)+(f6?1:0)+(f7?1:0)+(f8?1:0)+(f9?1:0);
    s.robScore=(r1?1:0)+(r2?1:0);
    s.profitBoost = bestProfitBoost(s);
    if (isCvdTrap) {
        s.fam.unshift(['VETO', 'INSTITUTIONAL GUARD', false, trapReason]);
        console.log(`[BEST VETO] ${s.t.symbol} dropped: ${trapReason}`);
    }
    await sleep(60);
  }

  // Apply Master Vetoes
  clean = clean.filter(s => !s.veto);
  clean.sort((a,b)=> (b.profitBoost||0)-(a.profitBoost||0) || b.famScore-a.famScore || b.robScore-a.robScore || b.rr-a.rr);
  return {clean, breadth:{bull:breadthBull, total:breadthTotal}};
}

async function runBest(opts){
  opts = opts || {};
  if (!opts._singleLeg && !opts.singleExchange && typeof hgDualScanEnabled === 'function' && hgDualScanEnabled()){
    if (!(await waitAlertIdle($('bestStat')))) return;
    const btn=$('bestRun'); btn.disabled=true; setProg('bestProg',0.05);
    const out=$('bestOut'); out.innerHTML=''; $('bestStat').textContent='Scanning Delta + CoinDCX…';
    try{
      let allClean = [], breadth = { bull: 0, total: 0 }, totalUni = 0;
      for (let ei = 0; ei < HG_DUAL_CRYPTO_EX.length; ei++){
        const ex = HG_DUAL_CRYPTO_EX[ei];
        await withExchange(ex, async function(){
          const scanAll = $('bestAll').checked;
          const N = Math.max(5, Math.min(500, +$('bestN').value||30));
          if (!S.tickers.length) S.tickers=await getTickers();
          let uni = S.exchange==='delta'
            ? S.tickers.filter(t=> scanAll ? true : t.turnoverUsd>=200000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd)
            : S.tickers.slice();
          const turnoverKnown = uni.some(function(t){ return (t.turnoverUsd||0) > 0; });
          if (!scanAll && turnoverKnown) uni = uni.slice(0,N);
          totalUni += uni.length;
          const leg = await runCascadeCore(uni);
          (leg.clean || []).forEach(function(c){ c._venueLabel = hgExLabel(ex); });
          allClean = allClean.concat(leg.clean || []);
          breadth.bull += (leg.breadth && leg.breadth.bull) || 0;
          breadth.total += (leg.breadth && leg.breadth.total) || 0;
        });
      }
      const clean = allClean;
      const universeLabel = 'both Delta India + CoinDCX futures';
      if (!clean.length){
        out.innerHTML=`<div class="empty"><b>WAIT.</b> Nothing passed all seven hard gates across ${universeLabel}. The best available trade right now is no trade — that verdict is the product working, not failing.</div>`;
        $('bestStat').textContent='done · 0 CLEAN · dual venue scan';
        return;
      }
      const pool = bestSortPool(clean);
      const w = pool[0];
      const symLabel = (w._venueLabel ? '[' + w._venueLabel + '] ' : '') + w.t.symbol;
      const breadthPct = breadth.total>=10 ? (breadth.bull/breadth.total*100) : 50;
      const regimeDir = breadth.total>=10 ? (breadthPct<=20?'bear':(breadthPct>=80?'bull':null)) : null;
      if (regimeDir && ((regimeDir==='bear' && w.dir==='long') || (regimeDir==='bull' && w.dir==='short'))){
        $('bestStat').textContent = 'master veto: regime unsafe';
        out.innerHTML = `<div class="empty"><b style="color:var(--veto)">MASTER VETO: STAND ASIDE</b><br><br>Market breadth only ${fmt(breadthPct,0)}% bullish (${breadth.bull}/${breadth.total} coins above 200-EMA on 4H) — ${regimeDir} regime, ${w.dir} setups here are ${regimeDir==='bear'?'catching falling knives':'fighting a screaming uptrend'}. Scanning canceled to protect capital.</div>`;
        return;
      }
      const t1=w.t1; const t2=w.t2;
      if (typeof logSetup === 'function') logSetup(w.t.symbol,w.dir,'best',w.entry,w.stop,t1);
      const others = pool.slice(1,6).map(s=>(s._venueLabel?'['+s._venueLabel+'] ':'')+`${s.t.symbol} ${s.dir.toUpperCase()} — ${s.famScore}/9 families · ${s.robScore}/2 robustness · ${fmt(s.rr,2)}R${s.profitBoost?` · +${fmt(s.profitBoost,1)} profit rank`:''}`).join('<br>') || 'none';
      const famGateNote = pool.length < clean.length ? ' · ≥5/9 families required for #1' : '';
      out.innerHTML = `
      <div class="panel">
        <h2>${symLabel} <span>${w.dir.toUpperCase()} · ${w.entryType} · mark ${px(w.t.mark||w.entry)} · all 7 hard gates PASSED (ticket in — not part of the ranking)</span></h2>
        <div class="ledger">${w.fam.map(x=>gateRow(x[0], x[1], x[2]?'pass':'na', x[3])).join('')}</div>
        <div class="verdict ${w.dir}">
          <div class="vword">${w.dir.toUpperCase()} · ${w.famScore}/9 FAMILIES · ${w.robScore}/2 ROBUST${w.profitBoost?` · +${fmt(w.profitBoost,1)} PROFIT RANK`:''}</div>
          <div class="vwhy">Execution: ${w.entryType}. Ranked #1 of ${pool.length} top setups (${clean.length} CLEAN total across Delta + CoinDCX) by scorecard expectancy when proven, then independent evidence families (CVD + Book spoof checks included), then robustness, then structural R:R${famGateNote}. 9/9 families + 2/2 robustness is the strongest evidence this framework can honestly claim. Logged to LOG automatically.</div>
        </div>
        <div class="plan">${planBlock(w.dir,w.entry,w.stop,t1,t2,w.planSrc||'', { entryType: w.entryType, entryGuidance: w.entryGuidance, targetPolicy: w.targetPolicy })}</div><div class="hgchart" id="bestChart"></div><div class="note" style="margin-top:8px">Nearest OB: <b>${typeof nearestOBText==='function'?nearestOBText(w.rows,w.dir):'n/a'}</b> · Liquidity Target: <b>${typeof liquidityTargetText==='function'?liquidityTargetText(w.rows,w.dir):'n/a'}</b></div>
        <button class="toTrade" onclick="toTrade('${w.t.symbol}','${w.dir}',${w.entry},${w.stop},${t1})">SEND TO TRADE PLAN →</button>
        ${typeof hgBookBtn==='function'?hgBookBtn(w.t.symbol, w.dir, w.entry, w.stop, t1, { scanner: 'best', strategy: 'best', t2: t2 }):''}
        <hr class="sep">
        <div class="note"><b>Runners-up (also CLEAN):</b><br>${others}</div>
      </div>`;
      if (typeof hgMiniChart === 'function') hgMiniChart($('bestChart'), w.rows, {dir:w.dir, entry:w.entry, stop:w.stop, t1:t1, t2:t2});
      $('bestStat').textContent=`done · ${clean.length} CLEAN of ${totalUni} scanned (${universeLabel})`;
    }catch(e){ out.innerHTML=`<div class="empty">best scan failed: ${e.message}</div>`; }
    finally{ setProg('bestProg',null); btn.disabled=false; }
    return;
  }

  // Single Exchange Fallback (Legacy)
  if (!(await waitAlertIdle($('bestStat')))) return;
  const btn=$('bestRun'); btn.disabled=true; setProg('bestProg',0.05);
  const out=$('bestOut'); out.innerHTML=''; $('bestStat').textContent='';
  try{
    const scanAll = $('bestAll').checked;
    const N = Math.max(5, Math.min(500, +$('bestN').value||30)); if (!S.tickers.length) S.tickers=await getTickers();
    let uni = S.exchange==='delta'
      ? S.tickers.filter(t=> scanAll ? true : t.turnoverUsd>=200000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd)
      : S.tickers.slice();
    const turnoverKnown = uni.some(function(t){ return (t.turnoverUsd||0) > 0; }); if (!scanAll && turnoverKnown) uni = uni.slice(0,N);
    const exLabel = S.exchange==='delta'?'Delta India':'CoinDCX';
    const universeLabel = scanAll ? `whole ${exLabel} futures universe` : `top ${N} by turnover`;
    const {clean, breadth} = await runCascadeCore(uni);
    if (!clean.length){
      out.innerHTML=`<div class="empty"><b>WAIT.</b> Nothing passed all seven hard gates across the ${universeLabel}. The best available trade right now is no trade — that verdict is the product working, not failing.</div>`;
      return;
    }
    const pool = bestSortPool(clean);
    const w = pool[0];
    const breadthPct = breadth.total>=10 ? (breadth.bull/breadth.total*100) : 50;
    const regimeDir = breadth.total>=10 ? (breadthPct<=20?'bear':(breadthPct>=80?'bull':null)) : null;
    if (regimeDir && ((regimeDir==='bear' && w.dir==='long') || (regimeDir==='bull' && w.dir==='short'))){
      $('bestStat').textContent = 'master veto: regime unsafe';
      out.innerHTML = `<div class="empty"><b style="color:var(--veto)">MASTER VETO: STAND ASIDE</b><br><br>Market breadth only ${fmt(breadthPct,0)}% bullish (${breadth.bull}/${breadth.total} coins above 200-EMA on 4H) — ${regimeDir} regime, ${w.dir} setups here are ${regimeDir==='bear'?'catching falling knives':'fighting a screaming uptrend'}. Scanning canceled to protect capital.</div>`;
      return;
    }
    const t1=w.t1; const t2=w.t2;
    if (typeof logSetup === 'function') logSetup(w.t.symbol,w.dir,'best',w.entry,w.stop,t1);
    const others = pool.slice(1,6).map(s=>`${s.t.symbol} ${s.dir.toUpperCase()} — ${s.famScore}/9 families · ${s.robScore}/2 robustness · ${fmt(s.rr,2)}R${s.profitBoost?` · +${fmt(s.profitBoost,1)} profit rank`:''}`).join('<br>') || 'none';
    const famGateNote = pool.length < clean.length ? ' · ≥5/9 families required for #1' : '';
    out.innerHTML = `
      <div class="panel">
        <h2>${w.t.symbol} <span>${w.dir.toUpperCase()} · ${w.entryType} · mark ${px(w.t.mark||w.entry)} · all 7 hard gates PASSED (ticket in — not part of the ranking)</span></h2>
        <div class="ledger">${w.fam.map(x=>gateRow(x[0], x[1], x[2]?'pass':'na', x[3])).join('')}</div>
        <div class="verdict ${w.dir}">
          <div class="vword">${w.dir.toUpperCase()} · ${w.famScore}/9 FAMILIES · ${w.robScore}/2 ROBUST${w.profitBoost?` · +${fmt(w.profitBoost,1)} PROFIT RANK`:''}</div>
          <div class="vwhy">Execution: ${w.entryType}. Ranked #1 of ${pool.length} top setups (${clean.length} CLEAN total) by scorecard expectancy when proven, then independent evidence families (CVD + Book spoof checks included), then robustness, then structural R:R${famGateNote}. 9/9 families + 2/2 robustness is the strongest evidence this framework can honestly claim. Logged to LOG automatically.</div>
        </div>
        <div class="plan">${planBlock(w.dir,w.entry,w.stop,t1,t2,w.planSrc||'', { entryType: w.entryType, entryGuidance: w.entryGuidance, targetPolicy: w.targetPolicy })}</div><div class="hgchart" id="bestChart"></div><div class="note" style="margin-top:8px">Nearest OB: <b>${typeof nearestOBText==='function'?nearestOBText(w.rows,w.dir):'n/a'}</b> · Liquidity Target: <b>${typeof liquidityTargetText==='function'?liquidityTargetText(w.rows,w.dir):'n/a'}</b></div>
        <button class="toTrade" onclick="toTrade('${w.t.symbol}','${w.dir}',${w.entry},${w.stop},${t1})">SEND TO TRADE PLAN →</button>
        ${typeof hgBookBtn==='function'?hgBookBtn(w.t.symbol, w.dir, w.entry, w.stop, t1, { scanner: 'best', strategy: 'best', t2: t2 }):''}
        <hr class="sep">
        <div class="note"><b>Runners-up (also CLEAN):</b><br>${others}</div>
      </div>`;
    if (typeof hgMiniChart === 'function') hgMiniChart($('bestChart'), w.rows, {dir:w.dir, entry:w.entry, stop:w.stop, t1:t1, t2:t2});
    $('bestStat').textContent=`done · ${clean.length} CLEAN of ${uni.length} scanned (${universeLabel})`;
  }catch(e){ out.innerHTML=`<div class="empty">best scan failed: ${e.message}</div>`; }
  finally{ setProg('bestProg',null); btn.disabled=false; }
}

async function silentBestScan(exchangeArg){
  try{
    return await withExchange(exchangeArg, async function(){
      const scanAll = true;
      const N = 999999;
      if (!S.tickers.length) S.tickers=await getTickers();
      let uni = S.exchange==='delta'
        ? S.tickers.filter(t=> scanAll ? true : t.turnoverUsd>=200000).sort((a,b)=>b.turnoverUsd-a.turnoverUsd)
        : S.tickers.slice();
      const turnoverKnown = uni.some(function(t){ return (t.turnoverUsd||0) > 0; }); if (!scanAll && turnoverKnown) uni = uni.slice(0,N);
      const {clean} = await runCascadeCore(uni);
      return clean;
    });
  }catch(e){ return []; }
}
