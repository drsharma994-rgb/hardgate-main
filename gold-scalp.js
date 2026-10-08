/**
 * HARDGATE Gold Scalp Engine
 * 15m Judas sweep and reclaim of the Asian session extreme.
 * Idle outside London Open (07:00-10:00 UTC) and NY Open (12:30-15:30 UTC).
 */
(function (root) {
  'use strict';
  function GoldScalpEngine(){
    this.core = new root.HG_GoldCoreEngine();
  }
  GoldScalpEngine.prototype.evaluateScalp = function(klines15m, dayKlines15m, macroData){
    var rows = root.hgGoldBars(klines15m);
    if (rows.length < 20) return { active: false, veto: true, reason: 'Not enough 15m bars' };
    var when = new Date(rows[rows.length - 1].time);
    var timeVeto = this.core.checkTimeVeto(when);
    if (timeVeto.veto) return { active: false, veto: true, reason: timeVeto.reason };
    var session = this.core.getCurrentSession(when);
    if (session !== 'LONDON_OPEN' && session !== 'NY_OPEN'){
      return { active: false, veto: true, reason: 'Scalp engine idle: outside killzone (' + session + ')' };
    }
    var asiaRange = this.core.calculateAsianRange(dayKlines15m || klines15m);
    if (!asiaRange) return { active: false, veto: true, reason: 'Asian range could not be formed' };
    var current = rows[rows.length - 1];
    var prev = rows[rows.length - 2];
    var atr = this.core.calculateAtr(rows, 14);
    if (!(atr >= this.core.minAtrDollars)){
      return { active: false, veto: true, reason: '15m ATR $' + atr.toFixed(2) + ' under the $2.50 floor' };
    }
    var view = (macroData && macroData.dxyTrend) ? macroData : (root.hgGoldMacroView ? root.hgGoldMacroView(macroData) : (macroData || {}));
    var setup = null;
    var sweptAsl = (prev.low < asiaRange.asl || current.low < asiaRange.asl);
    var reclaimedAsl = current.close > asiaRange.asl && current.close > current.open;
    var lowerWick = (current.high > current.low) && (current.close - current.low) > (current.high - current.low) * 0.50;
    if (sweptAsl && reclaimedAsl && lowerWick){
      var macroL = this.core.evaluateMacroAlignment('BULL', view);
      var stopL = +(Math.min(current.low, prev.low) - (atr * 0.3)).toFixed(2);
      var riskL = current.close - stopL;
      setup = {
        symbol: 'XAUUSD', direction: 'BULL', type: 'JUDAS_SWEEP_RECLAIM_ASL', session: session,
        entryPrice: +current.close.toFixed(2), stopLoss: stopL, target: +(current.close + (riskL * 2.2)).toFixed(2),
        riskReward: 2.2, macroPass: macroL.pass, macroEvidence: macroL.reasons,
        evidence: 'Swept ASL $' + asiaRange.asl.toFixed(2) + ' and reclaimed on the close.'
      };
    }
    var sweptAsh = (prev.high > asiaRange.ash || current.high > asiaRange.ash);
    var reclaimedAsh = current.close < asiaRange.ash && current.close < current.open;
    var upperWick = (current.high > current.low) && (current.high - current.close) > (current.high - current.low) * 0.50;
    if (!setup && sweptAsh && reclaimedAsh && upperWick){
      var macroS = this.core.evaluateMacroAlignment('BEAR', view);
      var stopS = +(Math.max(current.high, prev.high) + (atr * 0.3)).toFixed(2);
      var riskS = stopS - current.close;
      setup = {
        symbol: 'XAUUSD', direction: 'BEAR', type: 'JUDAS_SWEEP_RECLAIM_ASH', session: session,
        entryPrice: +current.close.toFixed(2), stopLoss: stopS, target: +(current.close - (riskS * 2.2)).toFixed(2),
        riskReward: 2.2, macroPass: macroS.pass, macroEvidence: macroS.reasons,
        evidence: 'Swept ASH $' + asiaRange.ash.toFixed(2) + ' and closed back inside.'
      };
    }
    if (!setup) return { active: false, reason: 'No clean sweep and reclaim of the Asian boundaries' };
    if (!setup.macroPass) return { active: false, veto: true, reason: setup.macroEvidence };
    if (!(setup.direction === 'BULL' ? setup.stopLoss < setup.entryPrice : setup.stopLoss > setup.entryPrice)){
      return { active: false, veto: true, reason: 'Stop is on the wrong side of entry' };
    }
    return { active: true, setup: setup };
  };
  root.HG_GoldScalpEngine = GoldScalpEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
