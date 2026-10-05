        if (twin && twin.length > ((rows && rows.length) || 0)) return twin;
        return (rows && rows.length) ? rows : [];
      });
    }).catch(function(){ return []; });
  }
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return Promise.all([
        tmFetchTf(item, '4h', 260, 210),
        tmFetchTf(item, '1d', 260, 1),
        tmFetchTf(item, '1h', 72, 1)
      ]).then(function(got){
        var r4 = got[0], r1 = got[1], r1h = got[2];
        if (!r4 || !r4.length || !r1 || !r1.length) return tmUnreadRow(item);
        var ts = trendScore(r1, r4);
        var row = {
          sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
          xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
          rsi: ts.rsi,
          volDiv: ts.volDiv, volConf: ts.volConf,
          price: r1[r1.length - 1].c, rows4h: r4, rows1d: r1, rows1h: (r1h && r1h.length) ? r1h : null,
          fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
        };
        var dir = tmDirOf(row);
        row.gate = dir ? trendmxGateEval(row, dir) : null;
        return row;
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

function tmWeeklyRows(rowsD){
  if (!rowsD || rowsD.length < 20) return null;
  var weeks = [], cur = null;
  for (var i = 0; i < rowsD.length; i++){
    var r = rowsD[i];
    if (!r) continue;
    var open = tmBarOpenSec(r);
    if (!isFinite(open)) continue;
    var wk = Math.floor(open / (7 * 86400));
    if (!cur || cur.wk !== wk){
      if (cur) weeks.push(cur);
      cur = { wk: wk, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 };
    } else {
      if (r.h > cur.h) cur.h = r.h;
      if (r.l < cur.l) cur.l = r.l;
      cur.c = r.c;
      cur.v += r.v || 0;
    }
  }
  if (cur) weeks.push(cur);
  return weeks.length >= 8 ? weeks : null;
}
function tmVolumeProfile(rows){
  if (!rows || rows.length < 40) return null;
  var use = rows.slice(-120);
  var lo = Infinity, hi = -Infinity, k;
  for (k = 0; k < use.length; k++){
    if (use[k].l < lo) lo = use[k].l;
    if (use[k].h > hi) hi = use[k].h;
  }
  if (!(hi > lo)) return null;
  var bins = 24, vol = [], step = (hi - lo) / bins;
  for (k = 0; k < bins; k++) vol.push(0);
  for (k = 0; k < use.length; k++){
    var mid = (use[k].h + use[k].l + use[k].c) / 3;
    var b = Math.max(0, Math.min(bins - 1, Math.floor((mid - lo) / step)));
    vol[b] += use[k].v > 0 ? use[k].v : 0;
  }
  var total = 0, max = 0, pocI = 0, j;
  for (j = 0; j < bins; j++){
    total += vol[j];
    if (vol[j] > max){ max = vol[j]; pocI = j; }
  }
  if (!(total > 0)) return null;
  var need = total * 0.7, acc = vol[pocI], loI = pocI, hiI = pocI;
  while (acc < need && (loI > 0 || hiI < bins - 1)){
    var left = loI > 0 ? vol[loI - 1] : -1;
    var right = hiI < bins - 1 ? vol[hiI + 1] : -1;
    if (right >= left){ hiI++; acc += vol[hiI]; }
    else { loI--; acc += vol[loI]; }
  }
  return { poc: lo + (pocI + 0.5) * step, vah: lo + (hiI + 1) * step, val: lo + loI * step };
}
function tmEqualSweep(rows, dir){
  if (!rows || rows.length < 20) return false;
  var pivots = [];
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
    tmProxyJson('https://api.llama.fi/emissions')
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
  if (news && news.length > 80){ ctx.newsOk = true; ctx.headlines = news; }
  ctx.totalOk = false;
  ctx.totalFalling = false;
  ctx.altsFalling = false;
  try {
    var tot = pack[5];
    var caps = tot && (tot.market_cap || tot.market_caps);
    if (caps && caps.length >= 2 && caps[0][1] > 0){
      var tchg = (caps[caps.length - 1][1] - caps[0][1]) / caps[0][1];
      ctx.totalOk = true;
      ctx.totalFalling = tchg < -0.01;
      if (btcChg != null && ethChg != null) ctx.altsFalling = (tchg - btcChg) < -0.01 && ethChg < 0;
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
  var now = Date.now(), longLiq = 0, shortLiq = 0, i;
  for (i = 0; i < details.length; i++){
    var d = details[i] || {};
    var ts = +d.ts || +d.time;
    if (!(ts > 0) || now - ts > 6 * 60 * 60 * 1000) continue;
    var sz = +d.sz || 0;
    var side = String(d.posSide || d.side || '').toLowerCase();
    if (side === 'long' || side === 'sell') longLiq += sz;
    else if (side === 'short' || side === 'buy') shortLiq += sz;
  }
  return { longLiq: longLiq, shortLiq: shortLiq };
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
async function tmCrowdRatio(row){
  if (typeof W.binanceLongShort !== 'function') return null;
  try {
