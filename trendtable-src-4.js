  for (var i = 2; i < rows.length - 2; i++){
    if (dir === 'long'){
      if (rows[i].l < rows[i-1].l && rows[i].l < rows[i-2].l && rows[i].l <= rows[i+1].l && rows[i].l <= rows[i+2].l) pivots.push(rows[i].l);
    } else if (rows[i].h > rows[i-1].h && rows[i].h > rows[i-2].h && rows[i].h >= rows[i+1].h && rows[i].h >= rows[i+2].h) pivots.push(rows[i].h);
  }
  var level = null;
  for (var a = 0; a < pivots.length; a++){
    for (var b = a + 1; b < pivots.length; b++){
      var mid = (pivots[a] + pivots[b]) / 2;
      if (mid > 0 && Math.abs(pivots[a] - pivots[b]) / mid < 0.0015) level = mid;
    }
  }
  if (!(level > 0)) return false;
  var recent = rows.slice(-6);
  for (var r = 0; r < recent.length; r++){
    if (dir === 'long' && recent[r].l < level && recent[r].c > level) return true;
    if (dir === 'short' && recent[r].h > level && recent[r].c < level) return true;
  }
  return false;
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
  if (dir === 'long') return sweepLow || fvg || ob || tmEqualSweep(rows4, dir);
  return sweepHigh || fvg || ob || tmEqualSweep(rows4, dir);
}
function tmSupplyDemand(rows){
  if (!rows || rows.length < 30) return null;
  var atr = tmAtrLast(rows);
  if (!(atr > 0)) return null;
  var demand = null, supply = null, k;
  for (k = 2; k < rows.length; k++){
    var impulse = rows[k], base = rows[k - 1];
    var move = impulse.c - impulse.o;
    if (move > 1.2 * atr && base.c < base.o){
      var broken = false, n;
      for (n = k + 1; n < rows.length; n++) if (rows[n].c < base.l) broken = true;
      if (!broken) demand = { lo: base.l, hi: base.h };
    }
    if (move < -1.2 * atr && base.c > base.o){
      var brokenS = false, m;
      for (m = k + 1; m < rows.length; m++) if (rows[m].c > base.h) brokenS = true;
      if (!brokenS) supply = { lo: base.l, hi: base.h };
    }
  }
  if (!demand && !supply) return null;
  return { demand: demand, supply: supply };
}
function tmNodeVeto(prof, px, dir, atr, vz){
  if (!prof || !prof.hvn || !prof.hvn.length) return 'HVN/LVN unread';
  var i, gap;
  for (i = 0; i < prof.lvn.length; i++){
    if (atr > 0 && Math.abs(px - prof.lvn[i]) <= 0.35 * atr && !(vz > 0.5)) return 'inside a low-volume node';
  }
  for (i = 0; i < prof.hvn.length; i++){
    gap = (dir === 'long') ? (prof.hvn[i] - px) : (px - prof.hvn[i]);
    if (atr > 0 && gap > 0 && gap <= 0.4 * atr) return dir === 'long' ? 'HVN overhead' : 'HVN underfoot';
  }
  return null;
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
  if (!(sweep && shifted)) return false;
  var shiftI = -1, level = null;
  if (hs.lastCHoCH && hs.lastCHoCH.dir === want && (n - hs.lastCHoCH.i) <= 12){ shiftI = hs.lastCHoCH.i; level = hs.lastCHoCH.level; }
  if (hs.lastBOS && hs.lastBOS.dir === want && (n - hs.lastBOS.i) <= 12 && hs.lastBOS.i >= shiftI){ shiftI = hs.lastBOS.i; level = hs.lastBOS.level; }
  if (!(level > 0) || shiftI < 0) return false;
  for (var j = shiftI; j < rows.length; j++){
    if (dir === 'long' && rows[j].l <= level && rows[j].c > level) return true;
    if (dir === 'short' && rows[j].h >= level && rows[j].c < level) return true;
  }
  return false;
}
function tmHeadlineBook(text){
  var items = String(text || '').split(/<item\b/i).slice(1);
  var book = { marketHack: false, marketReg: false, etfOutflow: false, etfInflow: false, items: [] };
  var i;
  for (i = 0; i < items.length && i < 40; i++){
    var title = items[i].replace(/<[^>]+>/g, ' ').toLowerCase();
    book.items.push(title);
    if (/etf outflow|outflows from .{0,20}etf|spot etf.{0,20}outflow/.test(title)) book.etfOutflow = true;
    if (/etf inflow|inflows into .{0,20}etf|spot etf.{0,20}inflow/.test(title)) book.etfInflow = true;
    if (/exchange hack|funds drained|stablecoin depeg|depegs/.test(title)) book.marketHack = true;
    if (/sec charges|sec sues|crypto ban|crackdown|doj charges/.test(title)) book.marketReg = true;
  }
  return book.items.length ? book : null;
}
function tmCoinHeadline(book, base){
  var hit = { hack: false, delist: false, listing: false, lawsuit: false };
  if (!book || !book.items) return hit;
  var name = String(base || '').toLowerCase();
  if (name.length < 2) return hit;
  var i;
  for (i = 0; i < book.items.length; i++){
    var title = book.items[i];
    if (title.indexOf(name) < 0) continue;
    if (/hack|exploit|drained/.test(title)) hit.hack = true;
    if (/delist/.test(title)) hit.delist = true;
    if (/will list|lists |listing /.test(title)) hit.listing = true;
    if (/lawsuit|sec charge|charged/.test(title)) hit.lawsuit = true;
  }
  return hit;
}
async function trendmxLoadContext(rows){
  var ctx = { macroOk: false, calendarOk: false, domOk: false, ethOk: false, stableOk: false, newsOk: false, riskOff: false, riskOn: false, eventBlock: false, btcDomRising: false, ethStructure: null, stableFalling: false, headlines: '' };
  var yahoo = [
    ['dxy', 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d'],
    ['us10y', 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d'],
    ['us2y', 'https://query1.finance.yahoo.com/v8/finance/chart/2YY%3DF?interval=1d&range=5d'],
    ['nq', 'https://query1.finance.yahoo.com/v8/finance/chart/NQ%3DF?interval=1d&range=5d'],
    ['spx', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d'],
    ['vix', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d'],
    ['gold', 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=5d']
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
    if (dirs.gold === true) against++; if (dirs.gold === false) withRisk++;
    ctx.riskOff = against >= 3;
    ctx.riskOn = withRisk >= 3;
  }
  var pack = await Promise.all([
    tmProxyJson('https://nfs.faireconomy.media/ff_calendar_thisweek.json'),
    tmProxyJson('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2'),
    tmProxyJson('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=2'),
    tmProxyJson('https://stablecoins.llama.fi/stablecoincharts/all'),
    tmProxyText('https://cointelegraph.com/rss').then(function(t){ return t || tmProxyText('https://www.coindesk.com/arc/outboundfeeds/rss/'); }),
    tmProxyJson('https://api.coingecko.com/api/v3/global/market_cap_chart?days=2'),
    tmProxyJson('https://api.llama.fi/emissions'),
    tmProxyJson('https://query1.finance.yahoo.com/v8/finance/chart/IBIT?interval=1d&range=5d'),
    tmProxyJson('https://query1.finance.yahoo.com/v8/finance/chart/FBTC?interval=1d&range=5d'),
    tmProxyJson('https://api.alternative.me/fng/?limit=1')
  ]);
  var cal = pack[0];
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
  var btcJ = pack[1], ethJ = pack[2];
  var btcChg = tmCapChange(btcJ), ethChg = tmCapChange(ethJ);
  if (btcChg != null && ethChg != null){
    ctx.domOk = true;
    ctx.btcDomRising = btcChg > 0.005 && ethChg < btcChg - 0.01;
  }
  ctx.ethOk = false;
  var stables = pack[3];
  if (Array.isArray(stables) && stables.length >= 2){
    var aS = stables[stables.length - 2], bS = stables[stables.length - 1];
    var aV = aS && aS.totalCirculatingUSD && +aS.totalCirculatingUSD.peggedUSD;
    var bV = bS && bS.totalCirculatingUSD && +bS.totalCirculatingUSD.peggedUSD;
    if (aV > 0 && bV > 0){ ctx.stableOk = true; ctx.stableFalling = bV < aV * 0.997; }
  }
  var news = pack[4];
  if (news && news.length > 80){
    ctx.newsOk = true;
    ctx.headlines = news;
    ctx.newsBook = tmHeadlineBook(news);
  }
  var ibitChg = tmYahooChange(pack[7]);
  var fbtcChg = tmYahooChange(pack[8]);
  ctx.etfOk = ibitChg != null && fbtcChg != null;
  ctx.etfFalling = ctx.etfOk && ibitChg < -0.02 && fbtcChg < -0.02;
  ctx.fngOk = false;
  ctx.fng = null;
  try {
    var fngJ = pack[9];
    var fngV = fngJ && fngJ.data && fngJ.data[0] && +fngJ.data[0].value;
    if (isFinite(fngV)){ ctx.fngOk = true; ctx.fng = fngV; }
  } catch (eFng) {}
  ctx.totalOk = false;
  ctx.totalFalling = false;
  ctx.altsFalling = false;
  ctx.total2Ok = false;
  ctx.total2Falling = false;
  ctx.total3Ok = false;
  ctx.total3Falling = false;
  try {
    var tot = pack[5];
    var caps = tot && (tot.market_cap || tot.market_caps);
    if (caps && caps.length >= 2 && caps[0][1] > 0){
      var tchg = (caps[caps.length - 1][1] - caps[0][1]) / caps[0][1];
      ctx.totalOk = true;
      ctx.totalFalling = tchg < -0.01;
      if (btcChg != null && ethChg != null) ctx.altsFalling = (tchg - btcChg) < -0.01 && ethChg < 0;
      var totEnds = tmSeriesEnds(tot, 'market_cap') || tmSeriesEnds(tot, 'market_caps');
      var btcEnds = tmSeriesEnds(btcJ, 'market_caps');
      var ethEnds = tmSeriesEnds(ethJ, 'market_caps');
      var t2 = tmSpreadChange(totEnds, [btcEnds]);
      var t3 = tmSpreadChange(totEnds, [btcEnds, ethEnds]);
      ctx.total2Ok = t2 != null;
      ctx.total2Falling = t2 != null && t2 < -0.01;
      ctx.total3Ok = t3 != null;
      ctx.total3Falling = t3 != null && t3 < -0.01;
    }
  } catch (eTot) {}
  if (!ctx.totalOk && btcChg != null && ethChg != null){
    ctx.totalOk = true;
    ctx.totalFalling = btcChg < 0 && ethChg < 0;
    ctx.altsFalling = ethChg < btcChg - 0.01;
  }
  ctx.unlockOk = false;
  ctx.unlockBases = {};
  try {
    var em = pack[6];
    var list = Array.isArray(em) ? em : (em && em.data);
    if (Array.isArray(list)){
      ctx.unlockOk = true;
      var soon = Date.now() + 48 * 60 * 60 * 1000;
      for (var ui = 0; ui < list.length; ui++){
        var item = list[ui] || {};
        var token = String(item.token || item.symbol || '').toUpperCase();
        var events = item.events || item.unlockEvents || [];
        if (!token || !events || !events.length) continue;
        for (var ev = 0; ev < events.length; ev++){
          var ts = +((events[ev] && (events[ev].timestamp || events[ev].unlockDate)) || 0);
          if (ts > 0 && ts < 1e12) ts *= 1000;
          if (ts > Date.now() && ts < soon) ctx.unlockBases[token] = true;
        }
      }
    }
  } catch (eUn) {}
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
async function tmTakerShare(row){
  if (typeof W.binanceTakerRatio !== 'function') return null;
  try {
    var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '15m', 3);
    var series = tk && tk.series;
    if (!series || !series.length) return null;
    var ratio = +series[series.length - 1].buySellRatio;
    if (!(ratio > 0)) return null;
    return ratio / (1 + ratio);
  } catch (e) { return null; }
}
async function tmOiPercentile(row){
  if (typeof W.binanceOIHistory !== 'function') return null;
  try {
    var hist = await W.binanceOIHistory(tmBaseOf(row) + 'USDT', '4h', 30);
    if (!hist || !hist.series || hist.series.length < 12) return null;
    var vals = [], i, v;
    for (i = 0; i < hist.series.length; i++){
      v = +hist.series[i].oi;
      if (v > 0) vals.push(v);
    }
    if (vals.length < 12) return null;
    var now = vals[vals.length - 1], below = 0;
    for (i = 0; i < vals.length; i++) if (vals[i] <= now) below++;
    return below / vals.length;
  } catch (e) { return null; }
}
async function tmPerpPremium(row){
  if (typeof W.binanceBasis !== 'function') return null;
  try {
    var b = await W.binanceBasis(tmBaseOf(row) + 'USDT', 'PERPETUAL', '15m', 1);
    var last = b && (b.latest || (b.series && b.series[b.series.length - 1]));
    if (!last || !(last.indexPrice > 0) || !isFinite(last.futuresPrice)) return null;
    return (last.futuresPrice - last.indexPrice) / last.indexPrice;
  } catch (e) { return null; }
}
async function tmBookRatio(row, dir){
  if (typeof W.binanceDepth !== 'function') return null;
  try {
    var book = await W.binanceDepth(tmBaseOf(row) + 'USDT', 20);
    if (!book || !(book.bidUsd > 0) || !(book.askUsd > 0)) return null;
    return dir === 'long' ? book.bidUsd / book.askUsd : book.askUsd / book.bidUsd;
  } catch (e) { return null; }
}
async function tmFundingVelocity(row, dir){
  if (typeof W.binanceFundingHist !== 'function') return null;
  try {
    var hist = await W.binanceFundingHist(tmBaseOf(row) + 'USDT', 12);
    if (!hist || hist.length < 2) return null;
    var prev = +hist[hist.length - 2].rate;
    var cur = +hist[hist.length - 1].rate;
    return tmFundingSpike(prev, cur, dir);
  } catch (e) { return null; }
}
async function tmAbsorption(row, dir){
  if (typeof W.binanceTakerRatio !== 'function') return null;
  try {
    var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '1h', 12);
    var series = tk && tk.series;
    var bars = tmClosedRows(row.rows1h, 3600);
    if (!series || series.length < 6 || !bars || bars.length < 6) return null;
    function ratioAt(ts){
      var best = null, i, dt, r;
      for (i = 0; i < series.length; i++){
        r = +series[i].buySellRatio;
        dt = Math.abs((+series[i].t) - ts);
        if (!isFinite(r)) continue;
        if (best == null || dt < best.dt) best = { dt: dt, r: r };
      }
      if (!best || best.dt > 3600) return NaN;
      return best.r;
    }
    var win = bars.slice(-6);
    var dip = win[0], i;
    for (i = 1; i < win.length; i++){
      if (dir === 'long' && win[i].l < dip.l) dip = win[i];
      if (dir === 'short' && win[i].h > dip.h) dip = win[i];
    }
    var before = null;
    for (i = 0; i < bars.length; i++) if (bars[i] === dip && i > 0) before = bars[i - 1];
    if (!before) return null;
    var atDip = ratioAt(dip.t);
    var atBefore = ratioAt(before.t);
    if (!isFinite(atDip) || !isFinite(atBefore)) return null;
    if (dir === 'long') return atDip > atBefore;
    return atDip < atBefore;
  } catch (e) { return null; }
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

async function tmLiqRead(row){
  var base = tmBaseOf(row);
  var j = await tmProxyJson('https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=' + encodeURIComponent(base + '-USDT') + '&state=filled&limit=100');
  var details = j && j.data && j.data[0] && j.data[0].details;
  if (!Array.isArray(details)) return null;
  var now = Date.now(), longLiq = 0, shortLiq = 0, buckets = {}, i;
  for (i = 0; i < details.length; i++){
    var d = details[i] || {};
    var ts = +d.ts || +d.time;
    if (!(ts > 0) || now - ts > 6 * 60 * 60 * 1000) continue;
    var sz = +d.sz || 0;
    var side = String(d.posSide || d.side || '').toLowerCase();
    var pxL = +d.bkPx || +d.px || +d.price;
    if (side === 'long' || side === 'sell') longLiq += sz;
    else if (side === 'short' || side === 'buy') shortLiq += sz;
    if (row && row.price > 0 && pxL > 0 && sz > 0){
      var key = Math.round(pxL / (row.price * 0.005));
      if (!buckets[key]) buckets[key] = { price: key * row.price * 0.005, long: 0, short: 0 };
      if (side === 'long' || side === 'sell') buckets[key].long += sz;
      else buckets[key].short += sz;
    }
  }
  var clusters = [];
  for (var key in buckets) clusters.push(buckets[key]);
  clusters.sort(function(x, y){ return (y.long + y.short) - (x.long + x.short); });
  return { longLiq: longLiq, shortLiq: shortLiq, clusters: clusters.slice(0, 8) };
}
async function tm5mVolumeOk(row, dir){
  var got = null;
  try {
    if (typeof W.binanceKlines === 'function') got = await W.binanceKlines(tmBaseOf(row) + 'USDT', '5m', 40);
  } catch (e) { got = null; }
  var rows = tmClosedRows(got, 300);
  if (!rows || rows.length < 15) return null;
  var last = rows[rows.length - 1], avg = 0, i;
  for (i = rows.length - 11; i < rows.length - 1; i++) avg += rows[i].v || 0;
  avg /= 10;
  if (!(avg > 0)) return null;
  if (dir === 'long') return last.c >= last.o && last.v > avg;
  return last.c <= last.o && last.v > avg;
}
async function tmMicroOk(row, dir){
  async function one(tf, n, sec){
    if (typeof W.binanceKlines !== 'function') return null;
    try {
      var got = await W.binanceKlines(tmBaseOf(row) + 'USDT', tf, n);
      var rows = tmClosedRows(got, sec);
      if (!rows || rows.length < 30 || typeof hgStructure !== 'function') return null;
      var hs = hgStructure(rows);
      if (!hs) return null;
      if (hs.trend === (dir === 'long' ? 'down' : 'up')) return false;
      var last = rows[rows.length - 1];
      if (dir === 'long' && last.c < last.o) return false;
      if (dir === 'short' && last.c > last.o) return false;
      return true;
    } catch (e) { return null; }
  }
  var both = await Promise.all([one('3m', 80, 180), one('1m', 60, 60)]);
  return { m3: both[0], m1: both[1] };
}
async function tmTradingView(row){
  var base = tmBaseOf(row);
  if (!base) return null;
  async function ask(ticker){
    var r = await fetch('/api/tv-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: { tickers: [ticker] } })
    });
    if (!r || !r.ok) return null;
    var j = await r.json();
    var d = j && j.data && j.data[0] && j.data[0].d;
    if (!d || !isFinite(+d[0])) return null;
    return { recommend: +d[0], rsi: +d[1] };
  }
  try {
    return await ask('BINANCE:' + base + 'USDT.P') || await ask('BINANCE:' + base + 'USDT');
  } catch (e) { return null; }
}
async function tmTopTrader(row){
  if (typeof W.binanceTopTraders !== 'function') return null;
  try {
    var ls = await W.binanceTopTraders(tmBaseOf(row) + 'USDT', '4h', 1);
    if (!ls || !ls.latest || !isFinite(+ls.latest.ratio)) return null;
    return +ls.latest.ratio;
  } catch (e) { return null; }
}
async function tmCrowdRatio(row){
  if (typeof W.binanceLongShort !== 'function') return null;
  try {
    var ls = await W.binanceLongShort(tmBaseOf(row) + 'USDT', '4h', 2);
    if (!ls || !ls.latest || !isFinite(+ls.latest.ratio)) return null;
    return +ls.latest.ratio;
  } catch (e) { return null; }
}

async function trendmxFormOne(ticket, row, ctx){
  var hard = [];
  var votes = [];
  function vote(name, state){
    votes.push({ name: name, v: state });
  }
  var dir = ticket.dir;
  var rows4 = tmClosedRows(row && row.rows4h, 14400);
  var rows1 = tmClosedRows(row && row.rows1h, 3600);
  var rowsD = tmClosedRows(row && row.rows1d, 86400);
  if (!row || !rows4 || rows4.length < 50) return ['4h history unread'];
  var valueGate = tmValueState(row, dir);
  if (valueGate && valueGate.reasons){
    for (var vg = 0; vg < valueGate.reasons.length; vg++) hard.push(valueGate.reasons[vg]);
  }
  var px = rows4[rows4.length - 1].c;
  var hs = (typeof hgStructure === 'function') ? hgStructure(rows4) : null;
  var want = dir === 'long' ? 'up' : 'down';
  if (!hs) hard.push('structure unread');
  else {
    if (hs.trend !== want) hard.push('4h structure ' + (hs.trend || 'range'));
    var n = rows4.length - 1;
    if (hs.lastCHoCH && hs.lastCHoCH.dir && hs.lastCHoCH.dir !== want && (n - hs.lastCHoCH.i) <= 20) hard.push('CHOCH against');
    var swings = hs.swings || [];
