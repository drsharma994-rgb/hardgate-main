    var lastHigh = null, lastLow = null, si;
    for (si = 0; si < swings.length; si++){
      if (swings[si].type === 'HH' || swings[si].type === 'LH') lastHigh = swings[si];
      if (swings[si].type === 'HL' || swings[si].type === 'LL') lastLow = swings[si];
    }
    if (dir === 'long' && (!(lastHigh && lastHigh.type === 'HH') || !(lastLow && lastLow.type === 'HL'))) hard.push('not HH/HL');
    if (dir === 'short' && (!(lastHigh && lastHigh.type === 'LH') || !(lastLow && lastLow.type === 'LL'))) hard.push('not LH/LL');
    if (!hs.lastBOS || hs.lastBOS.dir !== want || (n - hs.lastBOS.i) > 30) hard.push('no recent BOS');
  }
  var closes = rows4.map(function(r){ return r.c; });
  var e20 = tmEmaLast(closes, 20), e50 = tmEmaLast(closes, 50), e200 = tmEmaLast(closes, 200);
  if (dir === 'long' && !(px > e20 && e20 > e50 && px > e200)) hard.push('EMA 20/50/200 against');
  if (dir === 'short' && !(px < e20 && e20 < e50 && px < e200)) hard.push('EMA 20/50/200 against');
  var vwap = tmSessionVwap(row.rows1h);
  if (!isFinite(vwap)) hard.push('VWAP unread');
  else if (dir === 'long' && !(px > vwap)) hard.push('below VWAP');
  else if (dir === 'short' && !(px < vwap)) hard.push('above VWAP');
  var wave1 = rows1 ? tmWaveOk(rows1, dir) : null;
  var st4 = tmSuperTrend(rows4, 10, 3);
  var st1 = rows1 ? tmSuperTrend(rows1, 10, 3) : null;
  if (!st4 || !st1) hard.push('supertrend unread');
  else if (dir === 'long' && !(st4.up && st1.up)) hard.push('supertrend against');
  else if (dir === 'short' && (st4.up || st1.up)) hard.push('supertrend against');
  var cmf = rows1 ? tmCmf(rows1, 20) : null;
  if (cmf == null) hard.push('money flow unread');
  else if (dir === 'long' && cmf < 0.05) hard.push('money flow ' + cmf.toFixed(2) + ' is under 0.05');
  else if (dir === 'short' && cmf > -0.05) hard.push('money flow ' + cmf.toFixed(2) + ' is above -0.05');
  var ker = rows1 ? tmKernel(rows1, 24, 8) : null;
  if (!ker) hard.push('kernel unread');
  else if (dir === 'long' && !(ker.slopeUp && ker.above)) hard.push('kernel is not rising under price');
  else if (dir === 'short' && !(!ker.slopeUp && !ker.above)) hard.push('kernel is not falling over price');
  var coiled = rows1 ? tmSqueezeHigh(rows1) : null;
  if (coiled == null) hard.push('squeeze unread');
  else if (coiled) hard.push('still inside the high squeeze');
  var qqe = rows1 ? tmQqe(rows1, dir) : null;
  if (qqe == null) hard.push('qqe unread');
  else if (!qqe) hard.push('qqe is not with the trade');
  var hull = rows1 ? tmHullRising(rows1, 21) : null;
  if (hull == null) hard.push('hull unread');
  else if (dir === 'long' && !hull) hard.push('hull slope is down');
  else if (dir === 'short' && hull) hard.push('hull slope is up');
  var vfi = rows1 ? tmVfi(rows1, 20, 0.2) : null;
  if (vfi == null) hard.push('volume flow unread');
  else if (dir === 'long' && !(vfi > 0)) hard.push('volume flow is not in');
  else if (dir === 'short' && !(vfi < 0)) hard.push('volume flow is not out');
  var diverged = rows1 ? tmWtDiverging(rows1, dir) : null;
  if (diverged == null) hard.push('wavetrend divergence unread');
  else if (diverged) hard.push('wavetrend is diverging');
  var vz = (typeof volZ === 'function') ? volZ(rows4, 20) : NaN;
  if (!isFinite(vz)) hard.push('volume unread');
  else if (vz < 0) hard.push('volume declining');
  if (!tmAtLocation(rows4, rowsD, dir)) hard.push('no sweep, FVG or order block');
  var a = tmAtrLast(rows4);
  var risk = Math.abs(+ticket.entry - +ticket.stop);
  if (!(a > 0) || !(risk >= 0.8 * a && risk <= 2.5 * a)) hard.push('stop outside ATR');
  var hot = tmParkinsonHot(rows4);
  if (!hot) hard.push('volatility unread');
  else if (hot.hot && risk < 1.45 * a) hard.push('stop is inside 1.45 ATR while volatility is elevated');
  if (typeof row.fundingPct !== 'number' || !isFinite(row.fundingPct)) hard.push('funding unread');
  else if (dir === 'long' && row.fundingPct >= 0.04) hard.push('funding crowded long');
  else if (dir === 'short' && row.fundingPct <= -0.04) hard.push('funding crowded short');
  if (tmBaseOf(row) !== 'BTC'){
    var coinRet = tmFourHourReturn(row.rows4h);
    if (coinRet == null || !ctx || ctx.btcRet == null) hard.push('relative strength unread');
    else if (dir === 'long' && (coinRet - ctx.btcRet) < 0.015) hard.push('not leading BTC');
    else if (dir === 'short' && (ctx.btcRet - coinRet) < 0.015) hard.push('not lagging BTC');
    if (ctx && ctx.btcRows){
      var ratio = tmAltBtcLowerLow(rows4, ctx.btcRows);
      if (!ratio) hard.push('ALT/BTC unread');
      else if (dir === 'long' && ratio.lowerLow) hard.push('ALT/BTC made a lower low');
      else if (dir === 'short' && ratio.higherHigh) hard.push('ALT/BTC made a higher high');
    }
  }
  if (row.mark > 0 && px > 0){
    var basis = (row.mark - px) / px;
    if (dir === 'long' && basis > 0.0015) hard.push('perp basis rich');
    if (dir === 'short' && basis < -0.0015) hard.push('perp basis cheap');
  }
  var zones = tmSupplyDemand(rows4);
  if (zones && dir === 'long' && zones.supply && px >= zones.supply.lo && px <= zones.supply.hi) hard.push('inside supply');
  if (zones && dir === 'short' && zones.demand && px >= zones.demand.lo && px <= zones.demand.hi) hard.push('inside demand');
  if (!ctx || ctx.calendarOk !== true) hard.push('calendar unread');
  else if (ctx.eventBlock) hard.push('high-impact USD event');
  if (ctx && ctx.newsBook){
    var hit = tmCoinHeadline(ctx.newsBook, tmBaseOf(row));
    if (dir === 'long' && (hit.hack || hit.delist || hit.lawsuit)) hard.push('coin headline against');
    if (dir === 'long' && (ctx.newsBook.marketHack || ctx.newsBook.marketReg)) hard.push('market headline against longs');
    if (dir === 'short' && hit.listing) hard.push('fresh listing against a short');
  }
  if (ctx && ctx.unlockOk === true && ctx.unlockBases && ctx.unlockBases[tmBaseOf(row)]) hard.push('token unlock within 48h');
  if (tmBaseOf(row) !== 'BTC' && ctx && ctx.domOk === true && dir === 'long' && ctx.btcDomRising) hard.push('BTC.D rising');
  if (ctx && ctx.ethOk === true && dir === 'long' && ctx.ethStructure === 'down' && tmBaseOf(row) !== 'BTC' && tmBaseOf(row) !== 'ETH') hard.push('ETH structure down');
  if (ctx && ctx.stableOk === true && dir === 'long' && ctx.stableFalling) hard.push('stablecoin liquidity falling');
  if (ctx && ctx.totalOk === true && dir === 'long' && (ctx.totalFalling || ctx.altsFalling) && tmBaseOf(row) !== 'BTC') hard.push('TOTAL / alts falling');
  if (ctx && ctx.macroOk === true && dir === 'long' && ctx.riskOff) hard.push('macro risk-off');
  if (ctx && ctx.macroOk === true && dir === 'short' && ctx.riskOn) hard.push('macro risk-on');
  if (tmSettlementFreeze()) hard.push('funding settlement window');
  if (tmAsiaChop()) hard.push('asian session');
  var room = tmLiquidityRoom(rows4, dir, +ticket.entry, risk);
  if (room == null) hard.push('liquidity map unread');
  else if (!room.open) hard.push('next pool is only ' + room.room.toFixed(1) + 'R away');
  if (hard.length) return hard;

  var weeks = tmWeeklyRows(row.rows1d || rowsD);
  if (!weeks) vote('weekly unread', 0);
  else {
    var wst = (typeof hgStructure === 'function') ? hgStructure(weeks) : null;
    if (!wst) vote('weekly', 0);
    else vote('weekly structure', (wst.trend === (dir === 'long' ? 'down' : 'up')) ? -1 : 1);
  }
  var today = row.rows1d && row.rows1d[row.rows1d.length - 1];
  var dayOpen = today ? today.o : NaN;
  var weekOpen = weeks ? weeks[weeks.length - 1].o : NaN;
  if (!(dayOpen > 0)) vote('daily open', 0);
  else vote('daily open', (dir === 'long' ? px > dayOpen : px < dayOpen) ? 1 : -1);
  if (!(weekOpen > 0)) vote('weekly open', 0);
  else vote('weekly open', (dir === 'long' ? px > weekOpen : px < weekOpen) ? 1 : -1);
  var prof = tmVolumeProfile(rows4);
  if (!prof) vote('volume profile', 0);
  else if (dir === 'long' && px < prof.val) vote('below value area', -1);
  else if (dir === 'long' && px > prof.vah && !(vz > 0)) vote('VAH break on declining volume', -1);
  else if (dir === 'short' && px > prof.vah) vote('above value area', -1);
  else if (dir === 'short' && px < prof.val && !(vz > 0)) vote('VAL break on declining volume', -1);
  else vote('value area', 1);
  var node = tmNodeVeto(prof, px, dir, a, vz);
  vote(node || 'volume nodes', node ? -1 : 1);
  if (!zones) vote('supply/demand', 0);
  else if (dir === 'long' && zones.demand && px >= zones.demand.lo && px <= zones.demand.hi + a) vote('at demand', 1);
  else if (dir === 'short' && zones.supply && px <= zones.supply.hi && px >= zones.supply.lo - a) vote('at supply', 1);
  else vote('supply/demand', 0);
  if (!rows1 || rows1.length < 40 || typeof hgStructure !== 'function') vote('1h', 0);
  else {
    var h1 = hgStructure(rows1);
    vote('1h structure', (h1 && h1.trend === (dir === 'long' ? 'down' : 'up')) ? -1 : 1);
  }
  var localAgainst = votes.filter(function(v){ return v.v < 0; });
  if (localAgainst.length) return localAgainst.map(function(v){ return v.name; });

  var net = await Promise.all([
    tmCvdVerdict(row, dir),
    tmOiRead(row),
    tmFetch15(row),
    tmCrowdRatio(row),
    tmLiqRead(row),
    tm5mVolumeOk(row, dir),
    tmMicroOk(row, dir),
    tmTradingView(row),
    tmTopTrader(row),
    tmFundingZ(row),
    tmTakerShare(row),
    tmOiPercentile(row),
    tmPerpPremium(row),
    tmBookRatio(row, dir),
    tmFundingVelocity(row, dir),
    tmAbsorption(row, dir),
    tmCvdSlope(row, dir)
  ]);
  var cvd = net[0], oi = net[1], m15 = net[2], crowd = net[3], liq = net[4], m5 = net[5], micro = net[6], tv = net[7], top = net[8], fundZ = net[9], takerShare = net[10], oiPct = net[11], prem = net[12], book = net[13], fundVel = net[14], absorb = net[15], slope = net[16];
  if (cvd !== 'with') hard.push(cvd === 'against' ? 'CVD against' : 'CVD unread');
  if (!oi) hard.push('OI unread');
  else if (dir === 'long' && oi.priceUp && oi.oiDown) hard.push('OI falling, short covering not new longs');
  else if (dir === 'long' && !((oi.priceUp && oi.oiUp) || (oi.priceDown && oi.oiDown))) hard.push('OI not confirming the rise');
  else if (dir === 'short' && !(oi.priceDown && oi.oiUp)) hard.push('OI not confirming the drop');
  if (!m15) hard.push('15m unread');
  else if (!tm15Confirm(m15, dir)) hard.push('15m no sweep and CHOCH');
  else if (tm15HeavyAgainst(m15, dir)) hard.push('15m breaking against on volume');
  if (m15){
    var trig = tmTriggerRvol(m15);
    if (trig == null) hard.push('15m trigger volume unread');
    else if (trig < 1.6) hard.push('15m trigger volume ' + trig.toFixed(2) + 'x is under 1.6x');
    var body = tmBodyCommit(m15, dir);
    if (body == null) hard.push('15m body commit unread');
    else if (!body) hard.push('15m body did not close past the swing');
    var gap = tmDisplacementFvg(m15, dir);
    if (gap == null) hard.push('15m displacement unread');
    else if (!gap) hard.push('15m displacement gap missing');
    var soup = tmTurtleReclaim(m15, dir);
    if (soup == null) hard.push('sweep unread');
    else if (!soup) hard.push('no sweep and reclaim on the close');
    var stalled = tmStalled(m15, dir);
    if (stalled == null) hard.push('15m progress unread');
    else if (stalled) hard.push('15m has not expanded in 3 bars');
    var wave15 = tmWaveOk(m15, dir);
    if (wave1 !== true && wave15 !== true){
      if (wave1 == null && wave15 == null) hard.push('wavetrend unread');
      else hard.push('no wavetrend cross from the extreme');
    }
  }
  if (fundZ != null && dir === 'long' && fundZ > 2) hard.push('funding z ' + fundZ.toFixed(1) + ' is crowded');
  if (fundZ != null && dir === 'short' && fundZ < -2) hard.push('funding z ' + fundZ.toFixed(1) + ' is crowded');
  if (takerShare == null) hard.push('taker share unread');
  else if (dir === 'long' && takerShare < 0.60) hard.push('taker buy ' + (takerShare * 100).toFixed(0) + '% is under 60%');
  else if (dir === 'short' && (1 - takerShare) < 0.60) hard.push('taker sell ' + ((1 - takerShare) * 100).toFixed(0) + '% is under 60%');
  if (m15 && takerShare != null && typeof atr === 'function'){
    var a15 = atr(m15, 14);
    var atr15 = a15 && a15.length ? a15[a15.length - 1] : NaN;
    var trap = tmEffortTrap(m15[m15.length - 1], atr15, takerShare, dir);
    if (trap == null) hard.push('effort unread');
    else if (trap) hard.push('effort without result');
  }
  if (fundZ == null || oiPct == null) hard.push('crowding density unread');
  else if (dir === 'long' && fundZ * oiPct > 2.5) hard.push('crowding density ' + (fundZ * oiPct).toFixed(2) + ' is too long');
  else if (dir === 'short' && fundZ * oiPct < -2.5) hard.push('crowding density ' + (fundZ * oiPct).toFixed(2) + ' is too short');
  if (prem == null) hard.push('perp premium unread');
  else if (dir === 'long' && prem > 0.0012) hard.push('perp premium ' + (prem * 100).toFixed(2) + '% is rich');
  else if (dir === 'short' && prem < -0.0012) hard.push('perp premium ' + (prem * 100).toFixed(2) + '% is cheap');
  if (book == null) hard.push('book unread');
  else if (book < 1.35) hard.push('book ' + book.toFixed(2) + 'x is under 1.35x');
  if (fundVel == null) hard.push('funding velocity unread');
  else if (fundVel) hard.push('funding is accelerating against the trade');
  if (absorb == null) hard.push('absorption unread');
  else if (!absorb) hard.push('the pullback was not absorbed');
  if (slope == null) hard.push('delta slope unread');
  else if (!slope) hard.push('5-bar delta is against the trade');
  if (m15){
    var chand = tmChandelier(m15, dir, +ticket.entry);
    if (chand != null) ticket.chandelier = chand;
  }
  var syn = tmSynergy(row, dir, {
    body: m15 ? tmBodyCommit(m15, dir) === true : false,
    takerOk: takerShare != null && (dir === 'long' ? takerShare >= 0.60 : (1 - takerShare) >= 0.60)
  });
  row.tmSynergy = syn;
  if (syn < 85) hard.push('synergy ' + syn + '% is under 85%');
  if (hard.length) return hard;

  if (crowd == null) vote('positioning', 0);
  else if (dir === 'long' && crowd >= 1.8 && row.fundingPct > 0) vote('longs crowded', -1);
  else if (dir === 'short' && crowd <= 0.7 && row.fundingPct < 0) vote('shorts crowded', -1);
  else vote('positioning', 1);
  if (!liq) vote('liquidations', 0);
  else if (dir === 'long' && liq.shortLiq > liq.longLiq * 2 && liq.shortLiq > 0 && prof && px > prof.poc) vote('short-liquidation spike', -1);
  else if (dir === 'short' && liq.longLiq > liq.shortLiq * 2 && liq.longLiq > 0 && prof && px < prof.poc) vote('long-liquidation spike', -1);
  else if (liq.clusters && liq.clusters[0] && liq.clusters[0].price > 0 && Math.abs(px - liq.clusters[0].price) / px < 0.004) vote('inside liquidation cluster', -1);
  else vote(tmLiqSwept(rows4, liq, dir) ? 'liquidation sweep' : 'liquidation map', 1);
  if (m5 == null) vote('5m', 0);
  else vote('5m volume', m5 === true ? 1 : -1);
  if (!micro || micro.m3 == null) vote('3m', 0);
  else vote('3m structure', micro.m3 === true ? 1 : -1);
  if (!ctx || ctx.total2Ok !== true) vote('TOTAL2', 0);
  else if (dir === 'long' && ctx.total2Falling && tmBaseOf(row) !== 'BTC') vote('TOTAL2 falling', -1);
  else vote('TOTAL2', 1);
  if (!ctx || ctx.total3Ok !== true) vote('TOTAL3', 0);
  else if (dir === 'long' && ctx.total3Falling && tmBaseOf(row) !== 'BTC' && tmBaseOf(row) !== 'ETH') vote('TOTAL3 falling', -1);
  else vote('TOTAL3', 1);
  if (!ctx || ctx.etfOk !== true) vote('ETF', 0);
  else if (dir === 'long' && ctx.etfFalling && !(ctx.newsBook && ctx.newsBook.etfInflow)) vote('ETF proxies falling', -1);
  else vote('ETF', 1);
  if (!tv) vote('TradingView', 0);
  else if (dir === 'long' && tv.recommend < 0) vote('TradingView against', -1);
  else if (dir === 'short' && tv.recommend > 0) vote('TradingView against', -1);
  else vote('TradingView', 1);
  if (top == null) vote('top traders', 0);
  else if (dir === 'long' && top >= 2.2) vote('top traders crowded long', -1);
  else if (dir === 'short' && top <= 0.55) vote('top traders crowded short', -1);
  else if (dir === 'long' && top > 1) vote('top traders', 1);
  else if (dir === 'short' && top < 1) vote('top traders', 1);
  else vote('top traders flat', -1);
  if (!ctx || ctx.fngOk !== true) vote('fear and greed', 0);
  else if (dir === 'long' && ctx.fng >= 80) vote('extreme greed', -1);
  else if (dir === 'short' && ctx.fng <= 20) vote('extreme fear', -1);
  else vote('fear and greed', 1);

  var against = votes.filter(function(v){ return v.v < 0; });
  if (against.length) return against.map(function(v){ return v.name; });
  var got = votes.filter(function(v){ return v.v > 0; }).length;
  if (got < 8) return ['confluence ' + got + '/' + votes.length + ', need 8'];
  ticket.confluence = got + '/' + votes.length;
  ticket.synergy = row.tmSynergy;
  var atr4 = tmAtrLast(rows4);
  if (atr4 > 0 && isFinite(+ticket.entry)) ticket.trailBe = dir === 'long' ? +ticket.entry + 0.35 * atr4 : +ticket.entry - 0.35 * atr4;
  return [];
}

function tmFourHourReturn(rows){
  var c = tmClosedRows(rows, 14400);
  if (!c || c.length < 7 || !(c[c.length - 7].c > 0)) return null;
  return (c[c.length - 1].c - c[c.length - 7].c) / c[c.length - 7].c;
}
function tmLiqSwept(rows4, liq, dir){
  if (!rows4 || !liq || !liq.clusters) return false;
  var recent = rows4.slice(-4), i, k;
  for (i = 0; i < liq.clusters.length; i++){
    var cl = liq.clusters[i];
    if (!(cl.price > 0)) continue;
    for (k = 0; k < recent.length; k++){
      if (dir === 'long' && cl.long >= cl.short && recent[k].l < cl.price && recent[k].c > cl.price) return true;
      if (dir === 'short' && cl.short >= cl.long && recent[k].h > cl.price && recent[k].c < cl.price) return true;
    }
  }
  return false;
}
function trendmxCryptoCandidates(rows){
  var bag = [];
  if (!Array.isArray(rows) || typeof hgStructure !== 'function'){
    bag.held = { stack: [] };
    return bag;
  }
  var i;
  for (i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.rows4h || !r.comps) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long' && dir !== 'short') continue;
    if (dir === 'long' && tmAltLongBlockedByBtc(r)) continue;
    if (dir === 'long' && !(r.score >= 2)) continue;
    if (dir === 'short' && !(r.score <= -2)) continue;
    var rows4 = tmClosedRows(r.rows4h, 14400);
    var rowsD = tmClosedRows(r.rows1d, 86400);
    if (!rows4 || rows4.length < 50 || !tmAtLocation(rows4, rowsD, dir)) continue;
    var hs = hgStructure(rows4);
    if (!hs || hs.trend !== (dir === 'long' ? 'up' : 'down')) continue;
    var plan = trendmxPlan({
      dir: dir, score: r.score, rows4h: rows4, rows1h: r.rows1h, entry: r.price,
      gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct,
      freshCross: r.freshCross, base: r.base
    });
    if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop) || !isFinite(+plan.t1)) continue;
    if (typeof tmValidSetup === 'function' && !tmValidSetup(plan)) continue;
    bag.push({
      sym: r.sym, dir: dir, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: isFinite(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      freshCross: r.freshCross || '', conviction: 'CRYPTO', tier: 'CRYPTO', comps: r.comps,
      rank: Math.abs(+r.score || 0) * 10 + (r.freshCross ? 8 : 0) + ((r.gate && r.gate.clean7) ? 6 : 0),
      note: 'crypto · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5' + (r.freshCross ? (' · ' + r.freshCross) : '')
    });
  }
  bag.sort(function(a, b){ return b.rank - a.rank; });
  var out = [], seen = {}, nL = 0, nS = 0;
  for (i = 0; i < bag.length; i++){
    var key = bag[i].sym + '|' + bag[i].dir;
    if (seen[key]) continue;
    if (bag[i].dir === 'long' && nL >= 6) continue;
    if (bag[i].dir === 'short' && nS >= 4) continue;
    seen[key] = 1;
    if (bag[i].dir === 'long') nL++; else nS++;
    out.push(bag[i]);
  }
  out.held = { stack: [] };
  return out;
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

async function trendmxFormationPass(golden, death, rows, ctxReady, crypto){
  var ctx = ctxReady || await trendmxLoadContext(rows);
  if (!ctx.ethOk) tmStampEth(ctx, rows);
  ctx.btcRet = null;
  ctx.btcRows = null;
  if (Array.isArray(rows)){
    for (var bi = 0; bi < rows.length; bi++){
      if (tmBaseOf(rows[bi]) !== 'BTC') continue;
      ctx.btcRows = tmClosedRows(rows[bi].rows4h, 14400);
      ctx.btcRet = tmFourHourReturn(rows[bi].rows4h);
      if (ctx.btcRet != null) break;
    }
  }
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
        else {
          ticket.note = (ticket.note || '') + (ticket.confluence ? (' · confluence ' + ticket.confluence) : ' · full stack');
          if (isFinite(ticket.synergy)) ticket.note += ' · synergy ' + ticket.synergy + '%';
          if (isFinite(ticket.trailBe)) ticket.note += ' · after the first target, example stop ' + ticket.trailBe;
          if (isFinite(ticket.chandelier)) ticket.note += ' · chandelier ' + ticket.chandelier;
          out.push(ticket);
        }
      }
    }
    var workers = [];
    var lanes = Math.min(6, jobs.length);
    for (var w = 0; w < lanes; w++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }
  var both = await Promise.all([keep(golden || []), keep(death || []), keep(crypto || [])]);
  return { golden: both[0], death: both[1], crypto: both[2] };
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
    var crypto = trendmxCryptoCandidates(core.rows);
    var formed = await trendmxFormationPass(golden, death, core.rows, ctx, crypto);
    golden = formed.golden;
    death = formed.death;
    crypto = formed.crypto;
  }catch(eForm){
    golden = [];
    golden.held = { waiting: 0, grade: 0, cascade: 0, gates: 0, stack: [{ sym: 'desk', reasons: ['formation pass failed'] }] };
    death = [];
    death.held = { stack: [] };
    crypto = [];
    crypto.held = { stack: [] };
  }
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, deathCross: death, cryptoSetups: crypto, note: core.note, source: core.source, venueCounts: core.venueCounts,
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
  /* hg-v1154: the SWING post-gate policy on the gates this desk borrows -- a vetoed
     row keeps its levels and is watch-only (the shared card prints no handoff there) */
  if (tmPostGateVeto(r)) return 'near';
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
  var chopSt = trendmxChopState(r);
  if (chopSt && chopSt.state === 'chop') return 'near';
  if (plan && tmValidSetup(plan) && r.gate && r.gate.clean7) return 'clean';
  if (r.gate && r.gate.nearClean) return 'near';
  return 'forming';
}

function trendmxSummaryLine(rows, golden, venueCounts){
  rows = rows || [];
  golden = golden || [];
  var sl = 0, ss = 0, fx = 0, clean = 0, near = 0, flowW = 0, flowA = 0;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    if (r.score >= 4) sl++;
    if (r.score <= -4) ss++;
    if (r.freshCross) fx++;
    /* hg-v1012: the flow split, read off the stamps the scan left — the
       summary names the evidence the same way the cards do */
    if (r.flow && r.flow.verdict === 'with') flowW++;
