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
async function tmCrowdRatio(row){
  if (typeof W.binanceLongShort !== 'function') return null;
  try {
    var ls = await W.binanceLongShort(tmBaseOf(row) + 'USDT', '4h', 2);
    if (!ls || !ls.latest || !isFinite(+ls.latest.ratio)) return null;
    return +ls.latest.ratio;
  } catch (e) { return null; }
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
  if (!tmAtLocation(rows4, rowsD, dir)) bad.push('no sweep, FVG or order block');
  if (!rows1 || rows1.length < 40 || typeof hgStructure !== 'function') bad.push('1h unread');
  else {
    var h1 = hgStructure(rows1);
    if (h1 && h1.trend === (dir === 'long' ? 'down' : 'up')) bad.push('1h structure against');
  }
  if (!ctx || ctx.macroOk !== true) bad.push('macro unread');
  else if (dir === 'long' && ctx.riskOff) bad.push('macro risk-off');
  else if (dir === 'short' && ctx.riskOn) bad.push('macro risk-on');
  if (!ctx || ctx.calendarOk !== true) bad.push('calendar unread');
  else if (ctx.eventBlock) bad.push('high-impact USD event');
  if (tmBaseOf(row) !== 'BTC'){
    if (!ctx || ctx.domOk !== true) bad.push('BTC.D unread');
    else if (dir === 'long' && ctx.btcDomRising) bad.push('BTC.D rising');
  }
  if (!ctx || ctx.ethOk !== true) bad.push('ETH structure unread');
  else if (dir === 'long' && ctx.ethStructure === 'down' && tmBaseOf(row) !== 'BTC' && tmBaseOf(row) !== 'ETH') bad.push('ETH structure down');
  if (!ctx || ctx.stableOk !== true) bad.push('stablecoin liquidity unread');
  else if (dir === 'long' && ctx.stableFalling) bad.push('stablecoin liquidity falling');
  if (!ctx || ctx.newsOk !== true || !ctx.newsBook) bad.push('news unread');
  else {
    var hit = tmCoinHeadline(ctx.newsBook, tmBaseOf(row));
    if (dir === 'long' && (ctx.newsBook.marketHack || ctx.newsBook.marketReg || ctx.newsBook.etfOutflow)) bad.push('market headline against longs');
    if (dir === 'long' && (hit.hack || hit.delist || hit.lawsuit)) bad.push('coin headline against');
    if (dir === 'short' && hit.listing) bad.push('fresh listing against a short');
  }
  if (!ctx || ctx.etfOk !== true) bad.push('ETF unread');
  else if (dir === 'long' && ctx.etfFalling && !(ctx.newsBook && ctx.newsBook.etfInflow)) bad.push('ETF proxies falling');
  var a = tmAtrLast(rows4);
  var risk = Math.abs(+ticket.entry - +ticket.stop);
  if (!(a > 0) || !(risk >= 0.8 * a && risk <= 2.5 * a)) bad.push('stop outside ATR');
  if (!hs || !hs.lastBOS || hs.lastBOS.dir !== (dir === 'long' ? 'up' : 'down') || ((rows4.length - 1) - hs.lastBOS.i) > 30) bad.push('no recent BOS');
  var weeks = tmWeeklyRows(row.rows1d || rowsD);
  if (!weeks || typeof hgStructure !== 'function') bad.push('weekly unread');
  else {
    var wst = hgStructure(weeks);
    if (wst && wst.trend === (dir === 'long' ? 'down' : 'up')) bad.push('weekly structure against');
  }
  var today = row.rows1d && row.rows1d[row.rows1d.length - 1];
  var dayOpen = today ? today.o : NaN;
  var weekOpen = weeks ? weeks[weeks.length - 1].o : NaN;
  if (dir === 'long' && !(px > dayOpen)) bad.push('below daily open');
  if (dir === 'long' && !(px > weekOpen)) bad.push('below weekly open');
  if (dir === 'short' && !(px < dayOpen)) bad.push('above daily open');
  if (dir === 'short' && !(px < weekOpen)) bad.push('above weekly open');
  var prof = tmVolumeProfile(rows4);
  if (!prof) bad.push('volume profile unread');
  else if (dir === 'long' && px < prof.val) bad.push('below value area');
  else if (dir === 'long' && px > prof.vah && !(vz > 0)) bad.push('VAH break on declining volume');
  else if (dir === 'short' && px > prof.vah) bad.push('above value area');
  else if (dir === 'short' && px < prof.val && !(vz > 0)) bad.push('VAL break on declining volume');
  var node = tmNodeVeto(prof, px, dir, a, vz);
  if (node) bad.push(node);
  var zones = tmSupplyDemand(rows4);
  if (!zones) bad.push('supply/demand unread');
  else if (dir === 'long'){
    if (zones.supply && px >= zones.supply.lo && px <= zones.supply.hi) bad.push('inside supply');
    if (!zones.demand || px < zones.demand.lo || px > zones.demand.hi + a) bad.push('not at demand');
  } else {
    if (zones.demand && px >= zones.demand.lo && px <= zones.demand.hi) bad.push('inside demand');
    if (!zones.supply || px > zones.supply.hi || px < zones.supply.lo - a) bad.push('not at supply');
  }
  if (typeof row.fundingPct !== 'number' || !isFinite(row.fundingPct)) bad.push('funding unread');
  else if (dir === 'long' && row.fundingPct >= 0.04) bad.push('funding crowded long');
  else if (dir === 'short' && row.fundingPct <= -0.04) bad.push('funding crowded short');
  if (!ctx || ctx.totalOk !== true) bad.push('total market unread');
  else if (dir === 'long' && (ctx.totalFalling || ctx.altsFalling) && tmBaseOf(row) !== 'BTC') bad.push('TOTAL / alts falling');
  if (!ctx || ctx.total2Ok !== true) bad.push('TOTAL2 unread');
  else if (dir === 'long' && ctx.total2Falling && tmBaseOf(row) !== 'BTC') bad.push('TOTAL2 falling');
  if (!ctx || ctx.total3Ok !== true) bad.push('TOTAL3 unread');
  else if (dir === 'long' && ctx.total3Falling && tmBaseOf(row) !== 'BTC' && tmBaseOf(row) !== 'ETH') bad.push('TOTAL3 falling');
  if (!ctx || ctx.unlockOk !== true) bad.push('unlock calendar unread');
  else if (ctx.unlockBases && ctx.unlockBases[tmBaseOf(row)]) bad.push('token unlock within 48h');
  if (bad.length) return bad;
  var net = await Promise.all([
    tmCvdVerdict(row, dir),
    tmOiRead(row),
    tmFetch15(row),
    tmCrowdRatio(row),
    tmLiqRead(row),
    tm5mVolumeOk(row, dir),
    tmMicroOk(row, dir),
    tmTradingView(row)
  ]);
  var cvd = net[0], oi = net[1], m15 = net[2], crowd = net[3], liq = net[4], m5 = net[5], micro = net[6], tv = net[7];
  if (cvd !== 'with') bad.push(cvd === 'against' ? 'CVD against' : 'CVD unread');
  if (!oi) bad.push('OI unread');
  else if (dir === 'long' && !((oi.priceUp && oi.oiUp) || (oi.priceDown && oi.oiDown))) bad.push('OI not confirming the rise');
  else if (dir === 'short' && !(oi.priceDown && oi.oiUp)) bad.push('OI not confirming the drop');
  else if (dir === 'long' && oi.priceUp && oi.oiDown) bad.push('OI falling, short covering not new longs');
  if (!m15) bad.push('15m unread');
  else if (!tm15Confirm(m15, dir)) bad.push('15m no sweep and CHOCH');
  if (crowd == null) bad.push('long/short positioning unread');
  else if (dir === 'long' && crowd >= 1.8 && row.fundingPct > 0) bad.push('longs crowded');
  else if (dir === 'short' && crowd <= 0.7 && row.fundingPct < 0) bad.push('shorts crowded');
  if (!liq) bad.push('liquidations unread');
  else if (dir === 'long' && liq.shortLiq > liq.longLiq * 2 && liq.shortLiq > 0 && prof && px > prof.poc) bad.push('short-liquidation spike into strength');
  else if (dir === 'short' && liq.longLiq > liq.shortLiq * 2 && liq.longLiq > 0 && prof && px < prof.poc) bad.push('long-liquidation spike into weakness');
  if (liq && liq.clusters && liq.clusters.length){
    var top = liq.clusters[0];
    if (top.price > 0 && Math.abs(px - top.price) / px < 0.004) bad.push('inside liquidation cluster');
    var over = false, under = false, ci;
    for (ci = 0; ci < liq.clusters.length && !(over && under); ci++){
      var cl = liq.clusters[ci];
      if (!over && dir === 'long' && cl.long > cl.short * 2 && cl.price > px && a > 0 && (cl.price - px) <= 0.5 * a){ bad.push('long-liquidation cluster overhead'); over = true; }
      if (!under && dir === 'short' && cl.short > cl.long * 2 && cl.price < px && a > 0 && (px - cl.price) <= 0.5 * a){ bad.push('short-liquidation cluster underfoot'); under = true; }
    }
  }
  if (m5 == null) bad.push('5m unread');
  else if (m5 !== true) bad.push('5m volume not confirming');
  if (!micro || micro.m3 == null) bad.push('3m unread');
  else if (micro.m3 !== true) bad.push('3m structure against');
  if (!micro || micro.m1 == null) bad.push('1m unread');
  else if (micro.m1 !== true) bad.push('1m structure against');
  if (!tv) bad.push('TradingView unread');
  else if (dir === 'long' && tv.recommend < 0) bad.push('TradingView against');
  else if (dir === 'short' && tv.recommend > 0) bad.push('TradingView against');
  return bad;
}

function tmStampEth(ctx, rows){
  if (!ctx) return ctx;
  ctx.ethStructure = null;
  if (Array.isArray(rows)){
    for (var ei = 0; ei < rows.length; ei++){
      if (tmBaseOf(rows[ei]) !== 'ETH') continue;
      try { ctx.ethStructure = tmStructureDir(rows[ei].rows4h); } catch (eE) { ctx.ethStructure = null; }
      if (ctx.ethStructure) break;
    }
  }
  ctx.ethOk = ctx.ethStructure === 'up' || ctx.ethStructure === 'down';
  return ctx;
}

async function trendmxFormationPass(golden, death, rows, ctxReady){
  var ctx = ctxReady || await trendmxLoadContext(rows);
  if (!ctx.ethOk) tmStampEth(ctx, rows);
  async function keep(list){
    var out = [];
    out.held = (list && list.held) ? list.held : { waiting: 0, grade: 0, cascade: 0, gates: 0 };
    out.held.stack = [];
    var bySym = {};
    for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].sym) bySym[rows[i].sym] = rows[i];
    var jobs = [];
    for (var k = 0; k < list.length; k++) jobs.push(list[k]);
    var cursor = 0;
    async function worker(){
      while (cursor < jobs.length){
        var ticket = jobs[cursor++];
        var row = bySym[ticket.sym];
        var bad = [];
        try{ bad = await trendmxFormOne(ticket, row, ctx); }catch(eOne){ bad = ['formation unread']; }
        if (bad.length) out.held.stack.push({ sym: ticket.sym, reasons: bad });
        else { ticket.note = (ticket.note || '') + ' · full stack'; out.push(ticket); }
      }
    }
    var workers = [];
    var lanes = Math.min(6, jobs.length);
    for (var w = 0; w < lanes; w++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }
  var both = await Promise.all([keep(golden || []), keep(death || [])]);
  return { golden: both[0], death: both[1] };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
  var ctxP = trendmxLoadContext([]);
  var core = await trendmxScanCore(opts);
  trendmxStampBtcStructure(core.rows);
  var golden = trendmxGoldenCrossSetups(core.rows);
  var death = trendmxDeathCrossSetups(core.rows);   /* hg-v1014: the mirrored desk */
  tmSmcScanPass(core.rows, golden, death);
  /* hg-v1012: the evidence layer — one capped, paced pass over the promoted
     slice, AFTER the tier inputs (score/gate/conviction) exist and BEFORE
     the snap the boards read. Never throws; what it cannot read it leaves
     unstamped, and an unstamped row is an unjudged row. */
  var flow = null;
  try{ flow = await trendmxFlowScan(core.rows); }catch(eFl){ flow = null; }
  /* hg-v1067: the shared-perfect evidence pass — the OMNIBTC read stack */
  try{ await trendmxPerfectEvidencePass(core.rows); }catch(ePf3){ }
  try{
    var ctx = await ctxP;
    tmStampEth(ctx, core.rows);
    var formed = await trendmxFormationPass(golden, death, core.rows, ctx);
    golden = formed.golden;
    death = formed.death;
  }catch(eForm){
    golden = [];
    golden.held = { waiting: 0, grade: 0, cascade: 0, gates: 0, stack: [{ sym: 'desk', reasons: ['formation pass failed'] }] };
    death = [];
    death.held = { stack: [] };
  }
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, deathCross: death, note: core.note, source: core.source, venueCounts: core.venueCounts,
    flow: flow
  };
  publishTrendmxSnap(core.rows);
  return __tmScanSnap;
}

async function trendmxWarm(opts){
  try{
    var r = await trendmxScan({ force: !!(opts && opts.force) });
    if (r && r.rows && r.rows.length) return 'warmed';
    return 'unavailable: trend matrix scan returned no rows';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

function trendmxCompPipsHtml(comps){
  comps = comps || {};
  return ''
    + '<span class="gpip ' + (comps.d1Trend > 0 ? 'ok' : (comps.d1Trend < 0 ? 'bad' : '')) + '" title="1D trend">1D</span>'
    + '<span class="gpip ' + (comps.d1Cross > 0 ? 'ok' : (comps.d1Cross < 0 ? 'bad' : '')) + '" title="EMA cross">X</span>'
    + '<span class="gpip ' + (comps.h4Cascade > 0 ? 'ok' : (comps.h4Cascade < 0 ? 'bad' : '')) + '" title="4H cascade">4H</span>'
    + '<span class="gpip ' + (comps.cloud > 0 ? 'ok' : (comps.cloud < 0 ? 'bad' : '')) + '" title="Cloud">CL</span>'
    + '<span class="gpip ' + (comps.adxPt !== 0 ? 'ok' : '') + '" title="ADX strength">ADX</span>';
}

function trendmxRowTier(r, plan){
  if (!r) return 'forming';
  if (plan && plan.omniDemoted) return 'near';
  if (r.gate && r.gate.veto) return 'forming';
  /* hg-v1012: real taker flow AGAINST the row's own majority caps the row
     at NEAR — it paints, the chip names why, it can never be CLEAN or sit
     on the LIMIT BOARD (the same leadership pattern as the omni principal
     above it). An unread flow caps nothing. */
  if (r.flow && r.flow.verdict === 'against') return 'near';
  /* hg-v1019: the momentum witness caps the same way — a row whose 1D RSI
     range has TURNED against its direction can never be CLEAN. An unread
     or abstaining witness caps nothing. */
  if (trendmxMomState(r, tmDirOf(r)) === 'against') return 'near';
  /* hg-v1020: and the volume witness — a swing rally the OBV trend refuses
     to confirm (or a fall it refuses to join) caps at NEAR the same way. */
  if (trendmxVolState(r, tmDirOf(r)) === 'against') return 'near';
  /* hg-v1034: the fundamental + sentiment witness caps the same way — a row
     whose coin sits in a red-folder blackout (refuse) or against a 2+ net
     checked headwind (against) can never be CLEAN. */
  var fundSt = trendmxFundState(r, tmDirOf(r));
  if (fundSt === 'refuse' || fundSt === 'against') return 'near';
  /* hg-v1057: the trend-quality witness caps the same way — a row whose own
     4h tape is CHOPPY (Choppiness >= 61.8 AND Efficiency Ratio < 0.3, the two
     instruments agreeing) can never be CLEAN: this desk trades trends and
     that tape has none to ride. Mixed or unreadable caps nothing (fail open
     — one instrument alone is not a verdict). */
