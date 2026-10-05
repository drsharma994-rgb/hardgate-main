  if (typeof W.hgDeskLoadUniverse !== 'function'
      && (typeof W.binancePerpUniverse !== 'function' || typeof W.binanceKlines !== 'function')){
    throw new Error('missing universe layer (hgDeskLoadUniverse or binancePerpUniverse)');
  }
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
  var items = uniPack.items || [];
  /* hg-v1048/hg-v1074: ALL COINDCX FUTURES - the floored universe drops
     small CoinDCX contracts, so the matrix re-reads the universe at floor 0
     and merges in every CoinDCX future it missed (deduped on venue+sym).
     hg-v1074 reads the RAW CoinDCX leg (hgDeskLoadCoinDCXAll), not the
     deduped merged universe: xuMergeLegs tags one 'exchange' per base and
     the higher-turnover venue wins, so a CoinDCX contract also listed on
     Delta/Startrader was invisible to a ['coindcx'] filter on the merged
     list. Every CoinDCX active_instruments contract now appears regardless.
     The other venues keep their floor. */
  try{
    /* Raw CoinDCX only makes sense when a CoinDCX data source exists
       (xuniverse.js). Guarding on xuCoinDCXRows also avoids a pointless
       second universe fetch on the Binance-only fallback path. */
    if (typeof W.xuCoinDCXRows === 'function' && typeof W.hgDeskLoadCoinDCXAll === 'function'){
      var allPack = await W.hgDeskLoadCoinDCXAll({ force: false, minTurnover: 0, includeUnknown: true });
      var cdcxAll = Array.isArray(allPack.items) ? allPack.items : [];
      var seenU = {};
      for (var ui = 0; ui < items.length; ui++) seenU[String(items[ui].exchange || '') + '|' + String(items[ui].sym || '')] = 1;
      for (var uj = 0; uj < cdcxAll.length; uj++){
        var uitem = cdcxAll[uj];
        var uk = String(uitem.exchange || '') + '|' + String(uitem.sym || '');
        if (!seenU[uk]){ items.push(uitem); seenU[uk] = 1; }
      }
    }
  }catch(eUni){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eUni); }catch(eWu){} }
  /* BATCH 1130 — the instrument list is the source of truth. Every active
     CoinDCX USDT future is on the board, including contracts the merged
     universe dropped because another venue won the base or the $5M floor
     cut them. A symbol already queued is not added twice. */
  try{
    var cdcxSyms = await tmLoadCoinDcxContracts();
    var seenSym = {};
    for (var si = 0; si < items.length; si++) seenSym[String(items[si].sym || '')] = 1;
    for (var ci2 = 0; ci2 < cdcxSyms.length; ci2++){
      var csym = cdcxSyms[ci2];
      if (seenSym[csym]) continue;
      items.push({
        sym: csym,
        base: csym.replace(/^B-/, '').replace(/_USDT$/, ''),
        exchange: 'coindcx',
        turnoverUsd: null, mark: null, fundingPct: null, alsoOn: null
      });
      seenSym[csym] = 1;
    }
    uniPack.cdcxListed = cdcxSyms.length;
  }catch(eCdx){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eCdx); }catch(eW2){} }
  if (!items.length) throw new Error('universe empty' + (uniPack.note ? ' — ' + uniPack.note : ''));
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return fetchK(item, '4h', 260).then(function(r4){
          if (r4 && r4.length >= 210) return r4;
          return tmBinanceTwin(item, '4h', 260).then(function(twin){
            if (twin && twin.length > ((r4 && r4.length) || 0)) return twin;
            return (r4 && r4.length) ? r4 : [];
          });
        }).then(function(r4){
          if (!r4 || !r4.length) return tmUnreadRow(item);
          return Promise.all([
            fetchK(item, '1d', 260).then(function(r1){ return (r1 && r1.length) ? r1 : tmBinanceTwin(item, '1d', 260); }),
            fetchK(item, '1h', 120).then(function(r1h){ return (r1h && r1h.length) ? r1h : tmBinanceTwin(item, '1h', 120); })
          ]).then(function(rr){
            var r1 = rr[0], r1h = rr[1];
            if (!r1 || !r1.length) return tmUnreadRow(item);
            var ts = trendScore(r1, r4);
            var row = {
              sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
              xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
              rsi: ts.rsi,   /* hg-v1019: the momentum witness rides the row — chips/tier/collector read the stamp, never recompute */
              volDiv: ts.volDiv, volConf: ts.volConf,   /* hg-v1020: the volume witness's stamps, same seam */
              price: r1[r1.length - 1].c, rows4h: r4, rows1d: r1, rows1h: (r1h && r1h.length) ? r1h : null,
              fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
            };
            var dir = tmDirOf(row);
            row.gate = dir ? trendmxGateEval(row, dir) : null;
            return row;
          });
        }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}


async function tmProxyJson(url){
  try{
    var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!r || !r.ok) return null;
    return await r.json();
  }catch(e){ return null; }
}
async function tmProxyText(url){
  try{
    var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!r || !r.ok) return null;
    return await r.text();
  }catch(e){ return null; }
}
function tmYahooDir(j){
  try{
    var q = j.chart.result[0].indicators.quote[0].close.filter(function(v){ return isFinite(v); });
    if (q.length < 2) return null;
    return q[q.length - 1] > q[q.length - 2];
  }catch(e){ return null; }
}
function tmCapChange(j){
  var caps = j && j.market_caps;
  if (!caps || caps.length < 2) return null;
  var a = caps[0][1], b = caps[caps.length - 1][1];
  if (!(a > 0) || !(b > 0)) return null;
  return (b - a) / a;
}
function tmSessionVwap(rows1h){
  if (!rows1h || !rows1h.length) return NaN;
  var day = Math.floor(Date.now() / 1000 / 86400);
  var pv = 0, vv = 0, n = 0;
  for (var i = 0; i < rows1h.length; i++){
    var r = rows1h[i];
    if (!r) continue;
    var open = tmBarOpenSec(r);
    if (!isFinite(open) || Math.floor(open / 86400) !== day) continue;
    var v = r.v > 0 ? r.v : 0;
    if (!(v > 0)) continue;
    pv += ((r.h + r.l + r.c) / 3) * v;
    vv += v;
    n++;
  }
  return (n >= 2 && vv > 0) ? pv / vv : NaN;
}
function tmAtLocation(rows4, rowsD, dir){
  if (!rows4 || rows4.length < 20 || !rowsD || rowsD.length < 8) return false;
  var prev = rowsD[rowsD.length - 1];
  var week = rowsD.slice(-6, -1);
  var pdl = prev.l, pdh = prev.h;
  var pwl = Math.min.apply(null, week.map(function(r){ return r.l; }));
  var pwh = Math.max.apply(null, week.map(function(r){ return r.h; }));
  var recent = rows4.slice(-6);
  var last = rows4[rows4.length - 1];
  var sweepLow = recent.some(function(r){ return r.l < pdl && r.c > pdl; }) || recent.some(function(r){ return r.l < pwl && r.c > pwl; });
  var sweepHigh = recent.some(function(r){ return r.h > pdh && r.c < pdh; }) || recent.some(function(r){ return r.h > pwh && r.c < pwh; });
  var fvg = false, ob = false;
  var a = tmAtrLast(rows4);
  for (var k = Math.max(2, rows4.length - 12); k < rows4.length - 1; k++){
    if (dir === 'long' && rows4[k].l > rows4[k - 2].h && last.l <= rows4[k].l && last.c >= rows4[k - 2].h) fvg = true;
    if (dir === 'short' && rows4[k].h < rows4[k - 2].l && last.h >= rows4[k].h && last.c <= rows4[k - 2].l) fvg = true;
    if (a > 0 && (rows4[k].h - rows4[k].l) > 1.5 * a){
      var candle = rows4[k - 1];
      if (dir === 'long' && candle.c < candle.o && last.l <= candle.h && last.c >= candle.l) ob = true;
      if (dir === 'short' && candle.c > candle.o && last.h >= candle.l && last.c <= candle.h) ob = true;
    }
  }
  if (dir === 'long') return sweepLow || fvg || ob;
  return sweepHigh || fvg || ob;
}
function tm15Confirm(rows, dir){
  if (!rows || rows.length < 30 || typeof hgStructure !== 'function') return false;
  var hs = hgStructure(rows);
  if (!hs) return false;
  var want = dir === 'long' ? 'up' : 'down';
  var n = rows.length - 1;
  var shifted = (hs.lastCHoCH && hs.lastCHoCH.dir === want && (n - hs.lastCHoCH.i) <= 12)
    || (hs.lastBOS && hs.lastBOS.dir === want && (n - hs.lastBOS.i) <= 12);
  var sweep = false;
  for (var i = Math.max(10, rows.length - 12); i < rows.length; i++){
    var prior = rows.slice(i - 10, i);
    var lo = Math.min.apply(null, prior.map(function(r){ return r.l; }));
    var hi = Math.max.apply(null, prior.map(function(r){ return r.h; }));
    if (dir === 'long' && rows[i].l < lo && rows[i].c > lo) sweep = true;
    if (dir === 'short' && rows[i].h > hi && rows[i].c < hi) sweep = true;
  }
  return sweep && shifted;
}
function tmNewsVeto(text, base){
  if (!text || !base) return false;
  var hay = String(text).toLowerCase();
  var name = String(base).toLowerCase();
  if (hay.indexOf(name) < 0) return false;
  return /hack|exploit|unlock|delist|lawsuit|insolven|halt|sec charge|bank run/.test(hay);
}
async function trendmxLoadContext(rows){
  var ctx = { macroOk: false, calendarOk: false, domOk: false, ethOk: false, stableOk: false, newsOk: false, riskOff: false, riskOn: false, eventBlock: false, btcDomRising: false, ethStructure: null, stableFalling: false, headlines: '' };
  var yahoo = [
    ['dxy', 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d'],
    ['us10y', 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d'],
    ['us2y', 'https://query1.finance.yahoo.com/v8/finance/chart/2YY%3DF?interval=1d&range=5d'],
    ['nq', 'https://query1.finance.yahoo.com/v8/finance/chart/NQ%3DF?interval=1d&range=5d'],
    ['spx', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d'],
    ['vix', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d']
  ];
  var dirs = {};
  await Promise.all(yahoo.map(function(pair){
    return tmProxyJson(pair[1]).then(function(j){ dirs[pair[0]] = tmYahooDir(j); });
  }));
  var readable = yahoo.filter(function(pair){ return dirs[pair[0]] === true || dirs[pair[0]] === false; }).length;
  if (readable >= 4){
    ctx.macroOk = true;
    var against = 0, withRisk = 0;
    if (dirs.dxy === true) against++; if (dirs.dxy === false) withRisk++;
    if (dirs.us10y === true) against++; if (dirs.us10y === false) withRisk++;
    if (dirs.us2y === true) against++; if (dirs.us2y === false) withRisk++;
    if (dirs.nq === false) against++; if (dirs.nq === true) withRisk++;
    if (dirs.spx === false) against++; if (dirs.spx === true) withRisk++;
    if (dirs.vix === true) against++; if (dirs.vix === false) withRisk++;
    ctx.riskOff = against >= 3;
    ctx.riskOn = withRisk >= 3;
  }
  var cal = await tmProxyJson('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
  if (Array.isArray(cal)){
    ctx.calendarOk = true;
    var now = Date.now();
    for (var i = 0; i < cal.length; i++){
      var ev = cal[i] || {};
      if (String(ev.country || '') !== 'USD' || String(ev.impact || '').toLowerCase() !== 'high') continue;
      var title = String(ev.title || '').toLowerCase();
      if (!/cpi|nfp|fomc|fomc|ppi|gdp|powell|unemployment|payroll|fed rate|retail sales/.test(title)) continue;
      var when = Date.parse(ev.date);
      if (!isFinite(when)) continue;
      if (when - now <= 2 * 60 * 60 * 1000 && now - when <= 30 * 60 * 1000) ctx.eventBlock = true;
    }
  }
  var btcJ = await tmProxyJson('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2');
  var ethJ = await tmProxyJson('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=2');
  var btcChg = tmCapChange(btcJ), ethChg = tmCapChange(ethJ);
  if (btcChg != null && ethChg != null){
    ctx.domOk = true;
    ctx.btcDomRising = btcChg > 0.005 && ethChg < btcChg - 0.01;
  }
  if (Array.isArray(rows)){
    for (var ei = 0; ei < rows.length; ei++){
      if (tmBaseOf(rows[ei]) !== 'ETH') continue;
      try{ ctx.ethStructure = tmStructureDir(rows[ei].rows4h); }catch(eE){ ctx.ethStructure = null; }
      if (ctx.ethStructure) break;
    }
  }
  ctx.ethOk = ctx.ethStructure === 'up' || ctx.ethStructure === 'down';
  var stables = await tmProxyJson('https://stablecoins.llama.fi/stablecoincharts/all');
  if (Array.isArray(stables) && stables.length >= 2){
    var aS = stables[stables.length - 2], bS = stables[stables.length - 1];
    var aV = aS && aS.totalCirculatingUSD && +aS.totalCirculatingUSD.peggedUSD;
    var bV = bS && bS.totalCirculatingUSD && +bS.totalCirculatingUSD.peggedUSD;
    if (aV > 0 && bV > 0){ ctx.stableOk = true; ctx.stableFalling = bV < aV * 0.997; }
  }
  var news = await tmProxyText('https://cointelegraph.com/rss');
  if (!news) news = await tmProxyText('https://www.coindesk.com/arc/outboundfeeds/rss/');
  if (news && news.length > 80){ ctx.newsOk = true; ctx.headlines = news; }
  return ctx;
}
async function tmOiRead(row){
  if (typeof W.binanceOIHistory !== 'function') return null;
  var hist = await W.binanceOIHistory(tmBaseOf(row) + 'USDT', '4h', 8);
  if (!hist || !hist.series || hist.series.length < 3) return null;
  var series = hist.series;
  var oiNow = series[series.length - 1].oi, oiPrev = series[series.length - 3].oi;
  var rows = tmClosedRows(row.rows4h, 14400);
  if (!rows || rows.length < 3 || !(oiPrev > 0)) return null;
  var pxNow = rows[rows.length - 1].c, pxPrev = rows[rows.length - 3].c;
  return {
    priceUp: pxNow > pxPrev, priceDown: pxNow < pxPrev,
    oiUp: oiNow > oiPrev * 1.005, oiDown: oiNow < oiPrev * 0.995
  };
}
async function tmCvdVerdict(row, dir){
  if (row.flow && (row.flow.verdict === 'with' || row.flow.verdict === 'against')) return row.flow.verdict;
  if (typeof W.binanceTakerRatio !== 'function') return null;
  var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '4h', 12);
  var series = tk && tk.series;
  var rows = tmClosedRows(row.rows4h, 14400);
  if (!series || series.length < 6 || !rows || rows.length < 6) return null;
  var r1 = series[series.length - 6].buySellRatio, r2 = series[series.length - 1].buySellRatio;
  var p1 = rows[rows.length - 6].c, p2 = rows[rows.length - 1].c;
  if (dir === 'long'){
    if (p2 > p1 && r2 < r1 && r2 < 1) return 'against';
    return r2 > 1 ? 'with' : 'against';
  }
  if (p2 < p1 && r2 > r1 && r2 > 1) return 'against';
  return r2 < 1 ? 'with' : 'against';
}
async function tmFetch15(row){
  try{
    if (typeof W.hgDeskFetchKlines === 'function'){
      var got = await W.hgDeskFetchKlines(row.xu || row, '15m', 80);
      if (got && got.length >= 30) return tmClosedRows(got, 900);
    }
  }catch(e){}
  try{
    if (typeof W.binanceKlines === 'function'){
      var b = await W.binanceKlines(tmBaseOf(row) + 'USDT', '15m', 80);
      if (b && b.length >= 30) return tmClosedRows(b, 900);
    }
  }catch(e2){}
  return null;
}
async function trendmxFormOne(ticket, row, ctx){
  var bad = [];
  var dir = ticket.dir;
  var rows4 = tmClosedRows(row && row.rows4h, 14400);
  var rows1 = tmClosedRows(row && row.rows1h, 3600);
  var rowsD = tmClosedRows(row && row.rows1d, 86400);
  if (!row || !rows4 || rows4.length < 50) return ['4h history unread'];
  var hs = (typeof hgStructure === 'function') ? hgStructure(rows4) : null;
  if (!hs) bad.push('structure unread');
  else {
    var want = dir === 'long' ? 'up' : 'down';
    if (hs.trend !== want) bad.push('4h structure ' + (hs.trend || 'range'));
    var n = rows4.length - 1;
    if (hs.lastCHoCH && hs.lastCHoCH.dir && hs.lastCHoCH.dir !== want && (n - hs.lastCHoCH.i) <= 20) bad.push('CHOCH against');
    var swings = hs.swings || [];
    var lastHigh = null, lastLow = null;
    for (var s = 0; s < swings.length; s++){
      if (swings[s].type === 'HH' || swings[s].type === 'LH') lastHigh = swings[s];
      if (swings[s].type === 'HL' || swings[s].type === 'LL') lastLow = swings[s];
    }
    if (dir === 'long' && (!(lastHigh && lastHigh.type === 'HH') || !(lastLow && lastLow.type === 'HL'))) bad.push('not HH/HL');
    if (dir === 'short' && (!(lastHigh && lastHigh.type === 'LH') || !(lastLow && lastLow.type === 'LL'))) bad.push('not LH/LL');
  }
  var closes = rows4.map(function(r){ return r.c; });
  var px = closes[closes.length - 1];
  var e20 = tmEmaLast(closes, 20), e50 = tmEmaLast(closes, 50), e200 = tmEmaLast(closes, 200);
  if (dir === 'long' && !(px > e20 && e20 > e50 && px > e200)) bad.push('EMA 20/50/200 against');
  if (dir === 'short' && !(px < e20 && e20 < e50 && px < e200)) bad.push('EMA 20/50/200 against');
  var vwap = tmSessionVwap(row.rows1h);
  if (!isFinite(vwap)) bad.push('VWAP unread');
  else if (dir === 'long' && !(px > vwap)) bad.push('below VWAP');
  else if (dir === 'short' && !(px < vwap)) bad.push('above VWAP');
  var vz = (typeof volZ === 'function') ? volZ(rows4, 20) : NaN;
  if (!isFinite(vz)) bad.push('volume unread');
  else if (vz < 0) bad.push('volume declining');
