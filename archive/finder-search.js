/* finder-search.js -- coin/symbol finder search UI extracted from index.html
   searchRow + runSearch. No credentials, no network. Call-time deps: setProg and
   runCryptoBacktest (kept inline). runSearch is a window global for the search button. */
function searchRow(ex, sym, price, chg, funding, turnover){
  const bits=[];
  bits.push(isFinite(price)&&price!=null ? px(price) : 'n/a');
  if (chg!=null && isFinite(chg)) bits.push('24h '+pct(chg,2));
  if (funding!=null && isFinite(funding)) bits.push('funding '+pct(funding,4));
  if (turnover!=null && isFinite(turnover) && turnover>0) bits.push('turnover $'+fmt(turnover,0));
  return '<div class="lrow"><span class="gid">'+(ex==='delta'?'DELTA':'CDCX')+'</span><span class="gname">'+sym+'</span><span class="gdetail">'+bits.join(' \u00b7 ')+'</span><span class="stamp na">'+(ex==='delta'?'Delta India':'CoinDCX')+'</span></div>';
}
async function runSearch(){
  const btn=$('searchRun'); btn.disabled=true; setProg('searchProg',0.08);
  const out=$('searchOut'); $('searchStat').textContent='';
  try{
    const raw=($('searchQ').value||'').trim().toUpperCase();
    if (!raw){ $('searchStat').textContent='type a coin symbol first'; setProg('searchProg',null); btn.disabled=false; return; }
    if (!S_SEARCH_CACHE || (nowSec()-S_SEARCH_CACHE.at)>60){
      $('searchStat').textContent='loading Delta India + CoinDCX symbol lists\u2026';
      const res = await Promise.all([ loadTickersDelta().catch(()=>[]), loadTickersCdcx().catch(()=>[]) ]);
      S_SEARCH_CACHE = {at:nowSec(), delta:res[0], cdcx:res[1]};
    }
    setProg('searchProg',0.35);
    const dHits = S_SEARCH_CACHE.delta.filter(x=> searchBase(x.symbol,'delta').includes(raw) || x.symbol.includes(raw));
    const cHits = S_SEARCH_CACHE.cdcx.filter(x=> searchBase(x.symbol,'cdcx').includes(raw) || x.symbol.includes(raw));
    if (!dHits.length && !cHits.length){
      out.innerHTML = '<div class="empty">No match for &quot;'+raw+'&quot; on either exchange\'s perpetual futures list.</div>';
      $('searchStat').textContent='0 matches';
      return;
    }
    setProg('searchProg',0.55);
    const cCap = cHits.slice(0,15);
    const cPrices={};
    for (let i=0;i<cCap.length;i++){
      const sym=cCap[i].symbol;
      try{ const rows=await candlesCdcx(sym,'15m',3); cPrices[sym]= rows.length? rows[rows.length-1].c : null; }
      catch(e){ cPrices[sym]=null; }
      setProg('searchProg', 0.55 + (i+1)/Math.max(1,cCap.length)*0.4);
    }
    const rowsHtml=[];
    dHits.forEach(t=> rowsHtml.push(searchRow('delta', t.symbol, t.mark, t.chg24, t.fundingPct, t.turnoverUsd)));
    cCap.forEach(t=> rowsHtml.push(searchRow('cdcx', t.symbol, cPrices[t.symbol], null, null, null)));
    let moreNote='';
    if (cHits.length>cCap.length) moreNote = '<div class="note">+'+(cHits.length-cCap.length)+' more CoinDCX matches \u2014 narrow your search to see prices for all of them.</div>';
    
const uniqBases = Array.from(new Set(dHits.map(function(t){ return searchBase(t.symbol,'delta'); }).concat(cHits.map(function(t){ return searchBase(t.symbol,'cdcx'); }))));
const idSafe = raw.replace(/[^A-Z0-9]/g,'_');
const btHtml = uniqBases.map(function(b,idx){
const btnId='btBtn_'+idSafe+'_'+idx, outId='btOut_'+idSafe+'_'+idx;
return '<div class="lrow"><span class="gid">TD</span><span class="gname">'+b+'</span><span class="gdetail">Historical swing-gate backtest via Twelve Data (separate feed, on demand)</span><button id="'+btnId+'" onclick="runCryptoBacktest(\''+b+'\',\''+btnId+'\',\''+outId+'\')" style="padding:4px 10px;font-size:11px;background:transparent;border:1px solid var(--line);color:var(--gold);border-radius:4px">BACKTEST</button></div><div id="'+outId+'"></div>';
}).join('');
out.innerHTML = '<div class="panel"><h2>'+raw+' <span>'+dHits.length+' Delta India match'+(dHits.length===1?'':'es')+' \u00b7 '+cHits.length+' CoinDCX match'+(cHits.length===1?'':'es')+'</span></h2><div class="ledger">'+rowsHtml.join('')+'</div>'+moreNote+btHtml+'</div>';
    $('searchStat').textContent=(dHits.length+cHits.length)+' total matches';
  } catch(e){
    $('searchStat').textContent = 'search failed: '+((e&&e.message)||e);
  } finally {
    btn.disabled=false; setProg('searchProg',1); setTimeout(()=>setProg('searchProg',null),400);
  }
}
