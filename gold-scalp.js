/**
 * HARDGATE Gold Scalp Engine v3
 * Apex-window Judas only. An expanding Asian session is not faded.
 * Silver SMT and a breaker block are stamped, not invented.
 */
(function (root) {
  'use strict';
  function GoldScalpEngine(){
    this.core = new root.HG_GoldCoreEngine();
  }
  GoldScalpEngine.prototype.evaluateScalp = function(klines15m, dayKlines15m, macroData, silverKlines){
    var rows = root.hgGoldBars(klines15m);
    if (rows.length < 20) return { active: false, veto: true, reason: 'Not enough 15m bars' };
    var current = rows[rows.length - 1];
    var prev = rows[rows.length - 2];
    var when = new Date(current.time);
    var timeVeto = this.core.checkTimeVeto(when);
    if (timeVeto.veto) return { active: false, veto: true, reason: timeVeto.reason };
    var sess = this.core.getInstitutionalSession(when);
    if (!sess.isApex) return { active: false, veto: true, reason: 'Scalp idle outside the apex window (' + sess.sessionName + ')' };
    var atr = this.core.calculateAtr(rows, 14);
    if (!(atr >= this.core.minAtrDollars)) return { active: false, veto: true, reason: '15m ATR $' + atr.toFixed(2) + ' under the $2.50 floor' };
    var asia = this.core.classifyAsianRegime(dayKlines15m || klines15m, current.close);
    if (!asia.ash || !asia.asl) return { active: false, veto: true, reason: 'Asian range could not be formed' };
    var view = (macroData && macroData.dxyTrend) ? macroData : (root.hgGoldMacroView ? root.hgGoldMacroView(macroData) : (macroData || {}));
    var smt = this.core.evaluateTripleSmt(rows, silverKlines || root.__hgSilverRows);
    var breaker = this.core.detectBreakerBlock(rows);
    var setup = null;
    var range = current.high - current.low;
    var sweptAsl = prev.low < asia.asl || current.low < asia.asl;
    var reclaimed = current.close > asia.asl && current.close > current.open;
    var lowerWick = range > 0 && (current.close - current.low) > range * 0.55;
    var fadeLong = asia.regime === 'EXPANSION_TREND' && asia.drift !== 'UP';
    if (sweptAsl && reclaimed && lowerWick && !fadeLong){
      var macroL = this.core.evaluateMacroAlignment('BULL', view);
      if (macroL.pass && !(smt.tripleSmtBearish)){
        var stopL = +(Math.min(current.low, prev.low) - Math.max(atr * 0.35, 2.80)).toFixed(2);
        var riskL = current.close - stopL;
        if (stopL < current.close && riskL > 0){
          setup = {
            symbol: 'XAUUSD', direction: 'BULL', type: 'JUDAS_SWEEP_RECLAIM_ASL',
            model: 'APEX_KILLZONE_JUDAS_SWEEP', session: sess.sessionName,
            entryPrice: +current.close.toFixed(2), stopLoss: stopL,
            target: +(current.close + riskL * 2.5).toFixed(2), riskReward: 2.5,
            asianRegime: asia.regime, tripleSmtConfirmed: !!smt.tripleSmtBullish,
            breakerConfirmed: !!(breaker && breaker.type === 'BULLISH_BREAKER'),
            macroPass: true,
            evidence: 'Swept ASL $' + asia.asl.toFixed(2) + ' and reclaimed on the close. Asia ' + asia.regime + ' ' + asia.rangePct + '%.'
          };
        }
      } else if (!macroL.pass) {
        return { active: false, veto: true, reason: macroL.reasons };
      } else if (smt.tripleSmtBearish) {
        return { active: false, veto: true, reason: 'Silver confirmed the high: bearish SMT' };
      }
    }
    var sweptAsh = prev.high > asia.ash || current.high > asia.ash;
    var reclaimedS = current.close < asia.ash && current.close < current.open;
    var upperWick = range > 0 && (current.high - current.close) > range * 0.55;
    var fadeShort = asia.regime === 'EXPANSION_TREND' && asia.drift !== 'DOWN';
    if (!setup && sweptAsh && reclaimedS && upperWick && !fadeShort){
      var macroS = this.core.evaluateMacroAlignment('BEAR', view);
      if (!macroS.pass) return { active: false, veto: true, reason: macroS.reasons };
      if (smt.tripleSmtBullish) return { active: false, veto: true, reason: 'Silver refused the low: bullish SMT' };
      var stopS = +(Math.max(current.high, prev.high) + Math.max(atr * 0.35, 2.80)).toFixed(2);
      var riskS = stopS - current.close;
      if (stopS > current.close && riskS > 0){
        setup = {
          symbol: 'XAUUSD', direction: 'BEAR', type: 'JUDAS_SWEEP_RECLAIM_ASH',
          model: 'APEX_KILLZONE_JUDAS_SWEEP', session: sess.sessionName,
          entryPrice: +current.close.toFixed(2), stopLoss: stopS,
          target: +(current.close - riskS * 2.5).toFixed(2), riskReward: 2.5,
          asianRegime: asia.regime, tripleSmtConfirmed: !!smt.tripleSmtBearish,
          breakerConfirmed: !!(breaker && breaker.type === 'BEARISH_BREAKER'),
          macroPass: true,
          evidence: 'Swept ASH $' + asia.ash.toFixed(2) + ' and closed back inside. Asia ' + asia.regime + ' ' + asia.rangePct + '%.'
        };
      }
    }
    if (!setup){
      if (asia.regime === 'EXPANSION_TREND') return { active: false, veto: true, reason: 'Asian expansion ' + asia.rangePct + '% (' + asia.drift + '): the fade is vetoed' };
      return { active: false, reason: 'Awaiting an apex sweep and reclaim on the close' };
    }
    return { active: true, setup: setup };
  };
  root.HG_GoldScalpEngine = GoldScalpEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
