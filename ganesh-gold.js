/**
 * HARDGATE Ganesh Gold Setup Engine (GS1-GS7)
 * Seven sequential gates. A ticket needs every one.
 */
(function (root) {
  'use strict';
  function GaneshGoldEngine(){
    this.core = new root.HG_GoldCoreEngine();
  }
  GaneshGoldEngine.prototype.auditSevenSteps = function(klines15m, klines1h, macroData, silverKlines){
    var rows = root.hgGoldBars(klines15m);
    if (rows.length < 30) return null;
    var ledger = [];
    var current = rows[rows.length - 1];
    var atr = this.core.calculateAtr(rows, 14);
    var when = new Date(current.time);
    var sess = this.core.getInstitutionalSession(when);
    var asia = this.core.classifyAsianRegime(rows, current.close);
    var silver = silverKlines || root.__hgSilverRows || [];
    var smt = this.core.evaluateTripleSmt(rows, silver);
    var breaker = this.core.detectBreakerBlock(rows);
    var view = (macroData && macroData.dxyTrend) ? macroData : (root.hgGoldMacroView ? root.hgGoldMacroView(macroData) : {});
    var gs1 = asia.regime === 'CONSOLIDATION' || asia.regime === 'NORMAL_VARIANCE';
    ledger.push({ step: 'GS1_ACCUMULATION', name: 'Asian Sacred Accumulation', pass: gs1,
      evidence: 'Regime: ' + asia.regime + ' (' + (asia.rangePct || 0) + '% of spot, drift ' + (asia.drift || 'FLAT') + ')' });
    ledger.push({ step: 'GS2_KILLZONE', name: 'Apex Liquidity Window', pass: !!sess.isApex,
      evidence: 'Session: ' + sess.sessionName + (sess.isApex ? ' APEX' : (sess.isIbWindow ? ' — Initial Balance still forming' : ' — outside 07:30-08:45 and 14:00-15:15 UTC')) });
    var direction = null, sweepEvidence = 'Price inside the Asian box and no breaker';
    if (asia.asl && current.low <= asia.asl){ direction = 'BULL'; sweepEvidence = 'Harvested sell stops below $' + asia.asl.toFixed(2); }
    else if (asia.ash && current.high >= asia.ash){ direction = 'BEAR'; sweepEvidence = 'Harvested buy stops above $' + asia.ash.toFixed(2); }
    else if (breaker && breaker.retesting){ direction = breaker.type === 'BULLISH_BREAKER' ? 'BULL' : 'BEAR'; sweepEvidence = 'Retesting ' + breaker.type; }
    ledger.push({ step: 'GS3_LIQUIDITY_HARVEST', name: 'Liquidity Pool Harvest', pass: direction !== null, evidence: sweepEvidence });
    var macro = this.core.evaluateMacroAlignment(direction || 'BULL', view);
    var gs4 = false;
    var gs4Why = 'No silver print';
    if (!direction) gs4Why = 'No harvest, so SMT has nothing to confirm';
    else if (!smt.unread && direction === 'BULL' && smt.tripleSmtBearish) gs4Why = 'Silver confirmed the high';
    else if (!smt.unread && direction === 'BEAR' && smt.tripleSmtBullish) gs4Why = 'Silver refused the low';
    else if (!macro.pass) gs4Why = macro.reasons;
    else {
      gs4 = true;
      gs4Why = smt.unread ? ('Silver unread. ' + macro.reasons) : (smt.silverConfirmed ? 'Silver SMT agrees' : 'Silver does not oppose. ' + macro.reasons);
    }
    ledger.push({ step: 'GS4_TRIPLE_SMT', name: 'Gold versus Silver SMT', pass: gs4, evidence: gs4Why });
    var body = Math.abs(current.close - current.open);
    var minBody = +(atr * 1.4).toFixed(2);
    var gs5 = body >= minBody || !!(breaker && ((direction === 'BULL' && breaker.type === 'BULLISH_BREAKER') || (direction === 'BEAR' && breaker.type === 'BEARISH_BREAKER')));
    ledger.push({ step: 'GS5_DISPLACEMENT', name: 'Displacement or Breaker', pass: gs5,
      evidence: 'Body $' + body.toFixed(2) + ' vs $' + minBody + (breaker ? (' · ' + breaker.type) : '') });
    var slice = rows.slice(-12), hi = -Infinity, lo = Infinity, i;
    for (i = 0; i < slice.length; i++){ if (slice[i].high > hi) hi = slice[i].high; if (slice[i].low < lo) lo = slice[i].low; }
    var span = hi - lo;
    var ote = direction === 'BEAR' ? (lo + span * 0.705) : (hi - span * 0.705);
    var inOte = Math.abs(current.close - ote) <= atr * 0.6;
    ledger.push({ step: 'GS6_SACRED_OTE', name: '0.705 OTE', pass: inOte || gs5,
      evidence: 'Price $' + current.close.toFixed(2) + ' · 0.705 $' + ote.toFixed(2) });
    var risk = Math.max(atr * 0.5, 3.20);
    var reward = +(risk * 2.6).toFixed(2);
    var gs7 = reward >= 8.50;
    ledger.push({ step: 'GS7_GOLDEN_EXPANSION', name: '2.6R and at least $8.50', pass: gs7,
      evidence: 'Risk $' + risk.toFixed(2) + ' · target move $' + reward });
    var last6 = rows.slice(-6);
    var three = false;
    if (last6.length === 6 && direction === 'BULL') three = last6[1].low > last6[3].low && last6[3].low > last6[5].low;
    if (last6.length === 6 && direction === 'BEAR') three = last6[1].high < last6[3].high && last6[3].high < last6[5].high;
    var gs3 = ledger.filter(function(s){ return s.step === 'GS3_LIQUIDITY_HARVEST'; })[0];
    if (gs3){
      gs3.pass = gs3.pass || three;
      if (three) gs3.evidence = 'Three-drive exhaustion. ' + gs3.evidence;
    }
    var deal = this.core.calculateDealingRange(rows, current.close);
    var zoneOk = !direction ? false : (direction === 'BULL' ? deal.percentile <= 0.48 : deal.percentile >= 0.52);
    var gs1 = ledger.filter(function(s){ return s.step === 'GS1_ACCUMULATION'; })[0];
    if (gs1){
      gs1.pass = gs1.pass && zoneOk;
      gs1.evidence += ' · ' + deal.zone + ' ' + Math.round(deal.percentile * 100) + '%';
    }
    var wick = this.core.calculateFootprintAbsorption(current, direction || 'BULL');
    var gs5 = ledger.filter(function(s){ return s.step === 'GS5_DISPLACEMENT'; })[0];
    if (gs5){
      gs5.evidence += ' · wick ' + Math.round(wick.absorptionRatio * 100) + '%';
      if (!gs5.pass && wick.absorptionRatio >= 0.65) gs5.pass = true;
    }
    var failed = ledger.filter(function(s){ return !s.pass; });
    var ok = failed.length === 0 && !!direction;
    return {
      setupName: 'GANESH_GOLD_GS7_v3', symbol: 'XAUUSD', direction: direction, qualified: ok,
      passedCount: ledger.length - failed.length, totalSteps: ledger.length,
      entryPrice: ok ? +current.close.toFixed(2) : null,
      stopLoss: ok ? +((direction === 'BULL' ? current.close - risk : current.close + risk).toFixed(2)) : null,
      takeProfit: ok ? +((direction === 'BULL' ? current.close + reward : current.close - reward).toFixed(2)) : null,
      tp1_1_5R: ok ? +((direction === 'BULL' ? current.close + risk * 1.5 : current.close - risk * 1.5).toFixed(2)) : null,
      tp2_2_6R: ok ? +((direction === 'BULL' ? current.close + reward : current.close - reward).toFixed(2)) : null,
      tp3_3_5R: ok ? +((direction === 'BULL' ? current.close + risk * 3.5 : current.close - risk * 3.5).toFixed(2)) : null,
      threeDrive: three,
      failedSteps: failed, ledger: ledger
    };
  };
  function hgGaneshAuditHtml(audit){
    if (!audit) return '';
    var rows = (audit.ledger || []).map(function(step){
      return '<div class="kv"><span class="k">' + step.step + ' ' + step.name + '</span><span class="v">'
        + (step.pass ? 'PASS' : 'VETO') + ' — ' + String(step.evidence) + '</span></div>';
    }).join('');
    var plan = '';
    if (audit.qualified && audit.tp1_1_5R != null){
      plan = '<div class="note">Scale out · TP1 $' + audit.tp1_1_5R + ' (1.5R) · TP2 $' + audit.tp2_2_6R + ' (2.6R) · TP3 $' + audit.tp3_3_5R + ' (3.5R)</div>';
    }
    return '<div class="panel" data-hg-gs7="1" style="margin-top:10px"><h3>GS1-GS7 <span>'
      + audit.passedCount + '/' + audit.totalSteps + (audit.qualified ? ' ARMED' : ' not a ticket')
      + '</span></h3>' + rows + plan + '</div>';
  }
  root.HG_GaneshGoldEngine = GaneshGoldEngine;
  root.hgGaneshAuditHtml = hgGaneshAuditHtml;
})(typeof globalThis !== 'undefined' ? globalThis : this);
