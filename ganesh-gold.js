/**
 * HARDGATE Ganesh Gold Setup Engine (GS1-GS7)
 * Seven sequential gates. A ticket needs every one.
 */
(function (root) {
  'use strict';
  function GaneshGoldEngine(){
    this.core = new root.HG_GoldCoreEngine();
  }
  GaneshGoldEngine.prototype.auditSevenSteps = function(klines15m, klines1h, macroData){
    var rows = root.hgGoldBars(klines15m);
    if (rows.length < 30) return null;
    var ledger = [];
    var current = rows[rows.length - 1];
    var atr = this.core.calculateAtr(rows, 14);
    var asia = this.core.calculateAsianRange(rows);
    var step1 = !!(asia && asia.rangeDollars <= 22.0);
    ledger.push({ step: 'GS1_ACCUMULATION', name: 'Asian Range Compression', pass: step1,
      evidence: asia ? ('Range: $' + asia.rangeDollars.toFixed(2) + ' (max $22.00)') : 'No Asia data' });
    var when = new Date(current.time);
    var session = this.core.getCurrentSession(when);
    var step2 = (session === 'LONDON_OPEN' || session === 'NY_OPEN');
    ledger.push({ step: 'GS2_KILLZONE', name: 'Institutional Killzone Active', pass: step2,
      evidence: 'Session is ' + session });
    var swept = null;
    if (asia){
      if (current.low < asia.asl) swept = 'BULL';
      else if (current.high > asia.ash) swept = 'BEAR';
    }
    ledger.push({ step: 'GS3_LIQUIDITY_HUNT', name: 'External Liquidity Grabbed', pass: swept !== null,
      evidence: swept ? ('Swept ' + (swept === 'BULL' ? 'ASL sell-stops' : 'ASH buy-stops')) : 'Inside Asian bounds' });
    var step4 = false, i, body, k;
    for (i = Math.max(0, rows.length - 4); i < rows.length; i++){
      k = rows[i];
      body = Math.abs(k.close - k.open);
      if (body < atr * 1.5) continue;
      if (swept === 'BULL' && k.close > k.open) step4 = true;
      if (swept === 'BEAR' && k.close < k.open) step4 = true;
    }
    ledger.push({ step: 'GS4_DISPLACEMENT', name: 'Institutional Displacement Body', pass: step4,
      evidence: 'Need a $' + (atr * 1.5).toFixed(2) + ' body in the sweep direction inside 4 bars' });
    var slice = rows.slice(-8);
    var rangeHigh = -Infinity, rangeLow = Infinity;
    for (i = 0; i < slice.length; i++){
      if (slice[i].high > rangeHigh) rangeHigh = slice[i].high;
      if (slice[i].low < rangeLow) rangeLow = slice[i].low;
    }
    var fib = rangeHigh - rangeLow;
    var oteTop = rangeHigh - (fib * 0.618);
    var oteBottom = rangeHigh - (fib * 0.705);
    var insideOte = current.close >= Math.min(oteBottom, oteTop) && current.close <= Math.max(oteBottom, oteTop);
    ledger.push({ step: 'GS5_SACRED_OTE', name: '0.618-0.705 Golden Pocket Entry', pass: insideOte || step4,
      evidence: 'Price $' + current.close.toFixed(2) + ' | OTE $' + Math.min(oteBottom, oteTop).toFixed(2) + ' - $' + Math.max(oteBottom, oteTop).toFixed(2) });
    var view = (macroData && macroData.dxyTrend) ? macroData : root.hgGoldMacroView(macroData);
    var macro = this.core.evaluateMacroAlignment(swept || 'BULL', view);
    ledger.push({ step: 'GS6_MACRO_TAILWIND', name: 'Macro Yield / DXY Alignment', pass: macro.pass, evidence: macro.reasons });
    var stopBuffer = Math.max(atr * 1.2, 3.50);
    var reward = stopBuffer * 2.5;
    var step7 = reward >= 8.00;
    ledger.push({ step: 'GS7_RISK_REWARD', name: 'Structural 2.5R Feasibility', pass: step7,
      evidence: 'Risk $' + stopBuffer.toFixed(2) + ' | target move $' + reward.toFixed(2) });
    var failed = ledger.filter(function(s){ return !s.pass; });
    var ok = failed.length === 0 && !!swept;
    return {
      setupName: 'GANESH_GOLD_GS7', symbol: 'XAUUSD', direction: swept, qualified: ok,
      passedCount: ledger.length - failed.length, totalSteps: ledger.length,
      entryPrice: ok ? +current.close.toFixed(2) : null,
      stopLoss: ok ? +(swept === 'BULL' ? current.close - stopBuffer : current.close + stopBuffer).toFixed(2) : null,
      takeProfit: ok ? +(swept === 'BULL' ? current.close + reward : current.close - reward).toFixed(2) : null,
      failedSteps: failed, ledger: ledger
    };
  };
  function hgGaneshAuditHtml(audit){
    if (!audit) return '';
    var rows = (audit.ledger || []).map(function(step){
      return '<div class="kv"><span class="k">' + step.step + ' ' + step.name + '</span><span class="v">'
        + (step.pass ? 'PASS' : 'VETO') + ' — ' + String(step.evidence) + '</span></div>';
    }).join('');
    return '<div class="panel" data-hg-gs7="1" style="margin-top:10px"><h3>GS1-GS7 <span>'
      + audit.passedCount + '/' + audit.totalSteps + (audit.qualified ? ' ARMED' : ' not a ticket')
      + '</span></h3>' + rows + '</div>';
  }
  root.HG_GaneshGoldEngine = GaneshGoldEngine;
  root.hgGaneshAuditHtml = hgGaneshAuditHtml;
})(typeof globalThis !== 'undefined' ? globalThis : this);
