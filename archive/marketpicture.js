/* marketpicture.js -- market-picture banner UI extracted from index.html
   marketPictureCheck + runMarketPictureUI. No credentials, no network. Call-time dep
   getXAUCandles (kept inline). runMarketPictureUI is a window global; module loads
   before the inline boot script so its top-level boot call resolves. */
async function marketPictureCheck(){
  const assets = [['BTC','BTCUSD'],['ETH','ETHUSD'],['SOL','SOLUSD']];
  let longs=0, shorts=0, mixed=0; const detail=[];
  for (const [label, sym] of assets){
    try{
      const rows = await candlesDelta(sym, '4h', 260);
      const c = rows.map(r=>r.c);
      const e9=last(ema(c,9)), e21=last(ema(c,21)), e50=last(ema(c,50));
      let dir = e9>e21&&e21>e50 ? 'long' : (e9<e21&&e21<e50 ? 'short' : 'mixed');
      if (dir==='long') longs++; else if (dir==='short') shorts++; else mixed++;
      detail.push(label+':'+dir);
    }catch(e){ mixed++; detail.push(label+':err'); }
  }
  try{
    const g = await getXAUCandles('4h',300);
    const c = g.map(r=>r.c);
    const e9=last(ema(c,9)), e21=last(ema(c,21)), e50=last(ema(c,50));
    let dir = e9>e21&&e21>e50 ? 'long' : (e9<e21&&e21<e50 ? 'short' : 'mixed');
    if (dir==='long') longs++; else if (dir==='short') shorts++; else mixed++;
    detail.push('GOLD:'+dir);
  }catch(e){ mixed++; detail.push('GOLD:err'); }
  const total = longs+shorts+mixed;
  let verdict;
  if (longs>shorts && longs>=Math.ceil(total/2)+1) verdict='LONG-LEANING';
  else if (shorts>longs && shorts>=Math.ceil(total/2)+1) verdict='SHORT-LEANING';
  else verdict='MIXED \u2014 no clear lean';
  return {verdict, longs, shorts, mixed, total, detail};
}

async function runMarketPictureUI(){
  const el = document.getElementById('mpVerdict');
  const detailEl = document.getElementById('mpDetail');
  if (el) el.textContent = 'checking\u2026';
  try{
    const r = await marketPictureCheck();
    if (el) el.textContent = r.verdict;
    if (detailEl) detailEl.textContent = '(' + r.detail.join(' \u00b7 ') + ' \u2014 4H EMA cascade breadth across BTC/ETH/SOL/GOLD, informational only, not a trade signal)';
  }catch(e){
    if (el) el.textContent = 'unavailable';
  }
}
