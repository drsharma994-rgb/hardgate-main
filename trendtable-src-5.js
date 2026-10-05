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
  else if (dir === 'long' && !(oi.priceUp && oi.oiUp)) bad.push('OI not confirming the rise');
  else if (dir === 'short' && !(oi.priceDown && oi.oiUp)) bad.push('OI not confirming the drop');
  var m15 = await tmFetch15(row);
  if (!m15) bad.push('15m unread');
  else if (!tm15Confirm(m15, dir)) bad.push('15m no sweep and CHOCH');
  var a = tmAtrLast(rows4);
  var risk = Math.abs(+ticket.entry - +ticket.stop);
  if (!(a > 0) || !(risk >= 0.8 * a && risk <= 2.5 * a)) bad.push('stop outside ATR');
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
  var why = golden.length ? '' : ('<div class="note">No golden setup. Price has to clear structure, the 4h EMA cascade, 6/7 gates, the EMA tag, the TRADE grade, then the full stack: HH/HL, location, EMA 20/50/200, VWAP, rising volume, 1h, 15m sweep plus CHOCH, OI, CVD, macro, the calendar, BTC.D, ETH, stablecoin liquidity and the news feed.'
    + (held.waiting ? ' ' + held.waiting + ' waiting for the EMA tag.' : '')
    + (held.gates ? ' ' + held.gates + ' failed the gates.' : '')
    + (held.cascade ? ' ' + held.cascade + ' have no 4h cascade.' : '')
    + (held.grade ? ' ' + held.grade + ' failed the TRADE grade.' : '')
    + ((held.stack && held.stack.length) ? ' ' + held.stack.slice(0, 3).map(function(x){ return x.sym + ' blocked: ' + x.reasons.slice(0, 3).join(', '); }).join(' · ') + '.' : '')
    + '</div>');
  return '<div class="panel tier-clean" style="margin:12px 0;border-left:4px solid #047857">'
    + '<h2>⚡ GOLDEN CROSS DESK <span>full stack only · structure, location, volume, OI, CVD, VWAP, 15m, macro, calendar'
    + ((__tmMacro && __tmMacro.btcStructure === 'down') ? ' · alt longs stood down, BTC structure is down' : '')
    + '</span></h2>'
    + why
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
    + '</div>';
}

function trendmxDeathDeskHTML(death){
  death = death || [];
  if (!death.length) return '';
  var cards = '';
  for (var i = 0; i < Math.min(death.length, 4); i++) cards += trendmxCrossCardHTML(death[i]);
  return '<div class="panel" style="margin:12px 0;border-left:4px solid #b91c1c">'
    + '<h2>⚡ DEATH CROSS DESK <span>EMA50/200 BEAR cross ≤10 daily bars — fresh SHORTS · conviction + valid plan · Telegram every 15m</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
    + '</div>';
}

function trendmxLimitCardHTML(item){
  if (!item || !item.plan) return '';
  var p = item.plan, r = item.row, dir = item.dir;
  var col = dir === 'long' ? '#047857' : '#dc2626';
  var stHtml = '';
  if (typeof hgLimitState === 'function'){
    var a = (r.rows4h && typeof atr === 'function') ? atr(r.rows4h, TM_ATR_LEN) : null;
    var atrL = (a && a.length) ? a[a.length - 1] : NaN;
    var st = hgLimitState(p, r.price, atrL);
    if (st && st.label) stHtml = '<span class="stamp" style="margin-left:6px">' + escH(st.label) + '</span>';
  }
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(r.sym, dir, p.entry, p.stop, p.t1, { t2: p.t2, stack: item.stack, scanner: 'trendmx', strategy: 'trendmx' }) : '';
  /* hg-v1018: the card names its own formation class — the desks are
     separated by criteria now, and the stamp keeps the class legible where
     a card is screenshotted or shared off the desk. */
  /* hg-v1022: a PERFECT row carries its own stamp ahead of the class stamp —
     the strictest confluence read, distinguished so it survives a screenshot. */
  var perfectStamp = item.perfect
    ? '<span class="stamp pass" style="margin-left:6px;background:#fef3c7;color:#92400e">\u2605 PERFECT</span>'
    : '';
  var clsStamp = (r.gate && r.gate.clean7)
    ? '<span class="stamp" style="margin-left:6px">GATE-CLEAN 7/7</span>'
    : '<span class="stamp" style="margin-left:6px">CONVICTION ' + (r.score > 0 ? '+' : '') + r.score + '/5</span>';
  return '<div style="flex:1 1 260px;max-width:360px;border:1px solid #E2E8F0;border-left:3px solid ' + col + ';border-radius:8px;padding:10px 12px;background:#fff">'
    + '<div><b>' + escH(r.sym) + '</b>' + tmVenueChip(r) + ' · ' + dir.toUpperCase() + perfectStamp + clsStamp + stHtml + tmSmcChip(r)
    + trendmxFlowChipHtml(r)   /* hg-v1012: the flow verdict the scan stamped — reads the stamp, never recomputes */
    + trendmxMomChipHtml(r)    /* hg-v1019: the momentum witness's stamp — same read-the-stamp seam */
    + trendmxVolChipHtml(r)    /* hg-v1020: the volume witness's stamp — same seam */
    + trendmxFundingChipHtml(r)
    + trendmxAtrRegimeChipHtml(r) + '</div>'
    + '<div style="font-size:18px;font-weight:800;color:' + col + ';margin:4px 0">' + pxFmt(p.entry) + '</div>'
    + '<div class="note">' + trendmxPlanHTML(p) + '</div>'
    + (tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '')
    + '</div>';
}

/* hg-v1018: each desk caps at 4 cards — two desks x 4 = the old mixed
   board's 8. The split changes presentation, not exposure. */
var TM_LIMIT_DESK_CAP = 4;

/* hg-v1019: THE MOMENTUM WITNESS bands — the canonical RSI range read
   (Cardwell/Constance Brown): a bull momentum range holds RSI(14) above
   TM_MOM_BULL_FLOOR (the 40–50 pullback floor), a bear range caps it under
   TM_MOM_BEAR_CEIL. Stated PRIORS, not measurements — the forward log's
   momWith read-mark is how they earn a measured one. */
var TM_MOM_BULL_FLOOR = 40, TM_MOM_BEAR_CEIL = 60, TM_MOM_MID = 50;

/* trendmxMomState(row, dir) -> 'against' | 'with' | 'flat' | null.
   Pure read of the rsi stamp the scan put on the row (never recomputes):
     against — the momentum range has TURNED against the direction
       (long under the bull floor / short over the bear ceiling);
     with    — RSI on the regime side of the midline;
     flat    — the abstain zone: a pullback inside an INTACT regime, where
       momentum has nothing to add (no chip, no hold, no read);
     null    — no readable rsi: the witness cannot speak, and what cannot
       speak holds nothing off (the hg-v700 honest-degradation rule). */
function trendmxMomState(r, dir){
  var rv = (r && typeof r.rsi === 'number' && isFinite(r.rsi)) ? r.rsi : NaN;
  if (!isFinite(rv)) return null;
  if (dir === 'long'){
