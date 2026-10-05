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
  if (!ctx || ctx.newsOk !== true) bad.push('news unread');
  else if (tmNewsVeto(ctx.headlines, tmBaseOf(row))) bad.push('adverse headline');
  var cvd = await tmCvdVerdict(row, dir);
  if (cvd !== 'with') bad.push(cvd === 'against' ? 'CVD against' : 'CVD unread');
  var oi = await tmOiRead(row);
  if (!oi) bad.push('OI unread');
  else if (dir === 'long' && !((oi.priceUp && oi.oiUp) || (oi.priceDown && oi.oiDown))) bad.push('OI not confirming the rise');
  else if (dir === 'short' && !(oi.priceDown && oi.oiUp)) bad.push('OI not confirming the drop');
  var m15 = await tmFetch15(row);
  if (!m15) bad.push('15m unread');
  else if (!tm15Confirm(m15, dir)) bad.push('15m no sweep and CHOCH');
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
  if (typeof row.fundingPct !== 'number' || !isFinite(row.fundingPct)) bad.push('funding unread');
  else if (dir === 'long' && row.fundingPct >= 0.04) bad.push('funding crowded long');
  else if (dir === 'short' && row.fundingPct <= -0.04) bad.push('funding crowded short');
  var crowd = await tmCrowdRatio(row);
  if (crowd == null) bad.push('long/short positioning unread');
  else if (dir === 'long' && crowd >= 1.8 && row.fundingPct > 0) bad.push('longs crowded');
  else if (dir === 'short' && crowd <= 0.7 && row.fundingPct < 0) bad.push('shorts crowded');
  var liq = await tmLiqRead(row);
  if (!liq) bad.push('liquidations unread');
  else if (dir === 'long' && liq.shortLiq > liq.longLiq * 2 && liq.shortLiq > 0 && prof && px > prof.poc) bad.push('short-liquidation spike into strength');
  else if (dir === 'short' && liq.longLiq > liq.shortLiq * 2 && liq.longLiq > 0 && prof && px < prof.poc) bad.push('long-liquidation spike into weakness');
  var m5 = await tm5mVolumeOk(row, dir);
  if (m5 == null) bad.push('5m unread');
  else if (m5 !== true) bad.push('5m volume not confirming');
  if (!ctx || ctx.totalOk !== true) bad.push('total market unread');
  else if (dir === 'long' && (ctx.totalFalling || ctx.altsFalling) && tmBaseOf(row) !== 'BTC') bad.push('TOTAL / alts falling');
  if (!ctx || ctx.unlockOk !== true) bad.push('unlock calendar unread');
  else if (ctx.unlockBases && ctx.unlockBases[tmBaseOf(row)]) bad.push('token unlock within 48h');
  if (ctx && oi && dir === 'long' && oi.priceUp && oi.oiDown) bad.push('OI falling, short covering not new longs');
  return bad;
}
async function trendmxFormationPass(golden, death, rows){
  var ctx = await trendmxLoadContext(rows);
  async function keep(list){
    var out = [];
    out.held = (list && list.held) ? list.held : { waiting: 0, grade: 0, cascade: 0, gates: 0 };
    out.held.stack = [];
    var bySym = {};
    for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].sym) bySym[rows[i].sym] = rows[i];
    for (var k = 0; k < list.length; k++){
      var ticket = list[k];
      var row = bySym[ticket.sym];
      var bad = [];
      try{ bad = await trendmxFormOne(ticket, row, ctx); }catch(eOne){ bad = ['formation unread']; }
      if (bad.length){ out.held.stack.push({ sym: ticket.sym, reasons: bad }); continue; }
      ticket.note = (ticket.note || '') + ' · full stack';
      out.push(ticket);
    }
    return out;
  }
  return { golden: await keep(golden || []), death: await keep(death || []) };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
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
    var formed = await trendmxFormationPass(golden, death, core.rows);
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
    else if (r.flow && r.flow.verdict === 'against') flowA++;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean++;
    else if (tier === 'near') near++;
  }
  var vc = venueCounts || {};
  var cdxN = 0;
  for (var ci = 0; ci < rows.length; ci++) if (rows[ci] && String(rows[ci].exchange || '').toLowerCase() === 'coindcx') cdxN++;
  var ven = ' · Δ' + (vc.delta || 0) + ' · CDX ' + cdxN + ' contracts · BN' + (vc.binance || 0);
  return 'scanned ' + rows.length + ven
    + ' · golden ' + golden.length
    + ' · strong +' + sl + '/−' + ss + ' · fresh crosses ' + fx
    + ' · CLEAN ' + clean + ' · NEAR ' + near
    + ((flowW + flowA) > 0 ? ' · taker flow ' + flowW + ' with / ' + flowA + ' held off' : '');
}

/* hg-v1014: one card serves both cross kinds — golden (bull, green) and
   death (bear, red). The stamp, the strategy tag and the palette read the
   ticket's own freshCross/dir; everything else is identical, because the
   desks are the same bar in both directions. */
function trendmxCrossCardHTML(g){
  if (!g || !fin(+g.entry) || !fin(+g.stop) || !fin(+g.t1)) return '';
  var isDeath = (g.freshCross === 'DEATH') || (g.dir === 'short');
  var col = isDeath ? '#b91c1c' : '#047857';
  var strat = isDeath ? 'trendmx-death' : 'trendmx-golden';
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(g.sym, g.dir, g.entry, g.stop, g.t1, { t2: g.t2, scanner: 'trendmx', strategy: strat })
    : '';
  var tradeBtn = tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function')
    ? bookBtnHTML(g.sym, g.dir, g.entry, g.stop, g.t1, { scanner: 'trendmx', strategy: strat, t2: g.t2 }) : '';
  return '<div style="flex:1 1 280px;max-width:380px;border:1px solid ' + (isDeath ? 'rgba(185,28,28,.45)' : 'rgba(5,150,105,.45)') + ';border-left:4px solid ' + col + ';border-radius:8px;padding:12px;background:' + (isDeath ? 'rgba(185,28,28,.06)' : 'rgba(5,150,105,.06)') + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
    + '<span style="font-size:14px;font-weight:800">' + escH(g.sym) + tmVenueChip(g) + '</span>'
    + '<span class="stamp ' + (isDeath ? 'bad' : 'pass') + '">' + (isDeath ? '⚡DEATH' : '⚡GOLDEN') + '</span>'
    + '<span class="stamp pass">' + escH(g.conviction || g.tier || 'CONVICTION') + '</span>'
    + '<span class="stamp ' + (isDeath ? 'bad' : 'pass') + '">' + (isDeath ? 'SHORT' : 'LONG') + '</span>'
    + tmSmcChip(g)
    + '</div>'
    + '<div style="margin-top:6px;font-size:10px;color:#64748B">' + escH(g.note || '') + '</div>'
    + '<div style="font-size:22px;font-weight:800;color:' + col + ';margin-top:6px">' + pxFmt(g.entry) + '</div>'
    + '<div class="plan" style="margin-top:6px">' + trendmxPlanHTML(g) + '</div>'
    + tradeBtn + bookBtn
    + '</div>';
}

/* hg-v1015: TWO CROSS DESKS — the v1014 combined panel is split at the
   operator's ask: the bull desk and the bear desk stand on their own, each
   its own panel, its own palette, its own sub-line. The card renderer
   stays the shared dir-aware one (hg-v1014); a desk differs only in which
   bag it renders. The 4-card cap is the cap each half already had — the
   split changes no exposure. A desk with no tickets renders nothing. */
function trendmxGoldenDeskHTML(golden){
  golden = golden || [];
  var held = golden.held || {};
  var cards = '';
  for (var i = 0; i < Math.min(golden.length, 4); i++) cards += trendmxCrossCardHTML(golden[i]);
  var why = golden.length ? '' : ('<div class="note">No golden setup. Price has to clear structure, the 4h EMA cascade, 6/7 gates, the EMA tag, the TRADE grade, then the full stack: weekly and 4h structure, BOS, equal highs/lows, daily and weekly open, volume profile, EMA 20/50/200, VWAP, 1h, 15m sweep CHOCH and retest, 5m volume, OI, funding, positioning, liquidations, CVD, DXY yields Nasdaq S&P gold VIX, the calendar, BTC ETH BTC.D TOTAL, stables, news and the unlock calendar.'
    + (held.waiting ? ' ' + held.waiting + ' waiting for the EMA tag.' : '')
    + (held.gates ? ' ' + held.gates + ' failed the gates.' : '')
