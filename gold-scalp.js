/**
 * HARDGATE Gold Scalp Engine v4
 * Apex only, after the 30-minute Initial Balance. Discount for longs,
 * premium for shorts, and a 58% rejection wick. Three targets.
 */
(function (root) {
  'use strict';
  function GoldScalpEngine(){ this.core = new root.HG_GoldCoreEngine(); }
  function bracket(entry, risk, dir){
    var sign = dir === 'BULL' ? 1 : -1;
    return {
      target: +(entry + sign * risk * 2.6).toFixed(2),
      tp1_1_5R: +(entry + sign * risk * 1.5).toFixed(2),
      tp2_2_6R: +(entry + sign * risk * 2.6).toFixed(2),
      tp3_3_5R: +(entry + sign * risk * 3.5).toFixed(2),
      riskReward: 2.6
    };
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
    if (sess.isIbWindow) return { active: false, veto: true, reason: 'Initial Balance forming (07:00-07:30 or 13:30-14:00 UTC)' };
    if (!sess.isApex) return { active: false, veto: true, reason: 'Scalp idle outside the apex window (' + sess.sessionName + ')' };
    var atr = this.core.calculateAtr(rows, 14);
    if (!(atr >= this.core.minAtrDollars)) return { active: false, veto: true, reason: '15m ATR $' + atr.toFixed(2) + ' under the $2.50 floor' };
    var asia = this.core.classifyAsianRegime(dayKlines15m || klines15m, current.close);
    if (!asia.ash || !asia.asl) return { active: false, veto: true, reason: 'Asian range could not be formed' };
    var ib = this.core.calculateInitialBalance(dayKlines15m || klines15m);
    var activeIb = String(sess.sessionName).indexOf('NY') === 0 ? (ib.nyIb || ib.londonIb) : ib.londonIb;
    var levelLow = activeIb && activeIb.ibl ? activeIb.ibl : asia.asl;
    var levelHigh = activeIb && activeIb.ibh ? activeIb.ibh : asia.ash;
    var dealing = this.core.calculateDealingRange(dayKlines15m || klines15m, current.close);
    var view = (macroData && macroData.dxyTrend) ? macroData : (root.hgGoldMacroView ? root.hgGoldMacroView(macroData) : (macroData || {}));
    var smt = this.core.evaluateTripleSmt(rows, silverKlines || root.__hgSilverRows);
    var breaker = this.core.detectBreakerBlock(rows);
    var bullAbs = this.core.calculateFootprintAbsorption(current, 'BULL');
    var bearAbs = this.core.calculateFootprintAbsorption(current, 'BEAR');
    var setup = null;
    var sweptLow = prev.low < levelLow || current.low < levelLow;
    var reclaimed = current.close > levelLow && current.close > current.open;
    var fadeLong = asia.regime === 'EXPANSION_TREND' && asia.drift !== 'UP';
    var inDiscount = !dealing.unread && dealing.percentile <= 0.50;
    if (sweptLow && reclaimed && bullAbs.absorbed && inDiscount && !fadeLong){
      var macroL = this.core.evaluateMacroAlignment('BULL', view);
      if (!macroL.pass) return { active: false, veto: true, reason: macroL.reasons };
      if (smt.tripleSmtBearish) return { active: false, veto: true, reason: 'Silver confirmed the high: bearish SMT' };
      var stopL = +(Math.min(current.low, prev.low) - Math.max(atr * 0.40, 3.00)).toFixed(2);
      var riskL = current.close - stopL;
      if (stopL < current.close && riskL > 0){
        setup = Object.assign({
          symbol: 'XAUUSD', direction: 'BULL', type: 'IB_SWEEP_FOOTPRINT_ABSORPTION',
          model: 'IB_SWEEP_FOOTPRINT_ABSORPTION', session: sess.sessionName,
          entryPrice: +current.close.toFixed(2), stopLoss: stopL,
          dealingRangeZone: dealing.zone, absorptionRatio: Math.round(bullAbs.absorptionRatio * 100) + '%',
          asianRegime: asia.regime, tripleSmtConfirmed: !!smt.tripleSmtBullish,
          breakerConfirmed: !!(breaker && breaker.type === 'BULLISH_BREAKER'), macroPass: true,
          evidence: 'Swept $' + levelLow.toFixed(2) + ' with a ' + Math.round(bullAbs.absorptionRatio * 100) + '% rejection wick. ' + dealing.zone + ' ' + Math.round(dealing.percentile * 100) + '%.'
        }, bracket(current.close, riskL, 'BULL'));
      }
    }
    var sweptHigh = prev.high > levelHigh || current.high > levelHigh;
    var reclaimedS = current.close < levelHigh && current.close < current.open;
    var fadeShort = asia.regime === 'EXPANSION_TREND' && asia.drift !== 'DOWN';
    var inPremium = !dealing.unread && dealing.percentile >= 0.50;
    if (!setup && sweptHigh && reclaimedS && bearAbs.absorbed && inPremium && !fadeShort){
      var macroS = this.core.evaluateMacroAlignment('BEAR', view);
      if (!macroS.pass) return { active: false, veto: true, reason: macroS.reasons };
      if (smt.tripleSmtBullish) return { active: false, veto: true, reason: 'Silver refused the low: bullish SMT' };
      var stopS = +(Math.max(current.high, prev.high) + Math.max(atr * 0.40, 3.00)).toFixed(2);
      var riskS = stopS - current.close;
      if (stopS > current.close && riskS > 0){
        setup = Object.assign({
          symbol: 'XAUUSD', direction: 'BEAR', type: 'IB_SWEEP_FOOTPRINT_ABSORPTION',
          model: 'IB_SWEEP_FOOTPRINT_ABSORPTION', session: sess.sessionName,
          entryPrice: +current.close.toFixed(2), stopLoss: stopS,
          dealingRangeZone: dealing.zone, absorptionRatio: Math.round(bearAbs.absorptionRatio * 100) + '%',
          asianRegime: asia.regime, tripleSmtConfirmed: !!smt.tripleSmtBearish,
          breakerConfirmed: !!(breaker && breaker.type === 'BEARISH_BREAKER'), macroPass: true,
          evidence: 'Swept $' + levelHigh.toFixed(2) + ' with a ' + Math.round(bearAbs.absorptionRatio * 100) + '% rejection wick. ' + dealing.zone + ' ' + Math.round(dealing.percentile * 100) + '%.'
        }, bracket(current.close, riskS, 'BEAR'));
      }
    }
    if (!setup){
      if (sweptLow && !inDiscount) return { active: false, veto: true, reason: 'Sweep is in ' + dealing.zone + ' (' + Math.round(dealing.percentile * 100) + '%): longs need discount' };
      if (sweptHigh && !inPremium) return { active: false, veto: true, reason: 'Sweep is in ' + dealing.zone + ' (' + Math.round(dealing.percentile * 100) + '%): shorts need premium' };
      if (asia.regime === 'EXPANSION_TREND') return { active: false, veto: true, reason: 'Asian expansion ' + asia.rangePct + '% (' + asia.drift + '): the fade is vetoed' };
      return { active: false, reason: 'Awaiting an apex sweep, a 58% rejection wick, and the right half of the dealing range' };
    }
    var nymo = this.core.calculateTrueDayOpen(dayKlines15m || klines15m);
    if (!nymo.unread && nymo.nymo != null){
      if (setup.direction === 'BULL' && current.close > nymo.nymo) return { active: false, veto: true, reason: 'Above the New York midnight open ($' + nymo.nymo.toFixed(2) + '): the daily long is late' };
      if (setup.direction === 'BEAR' && current.close < nymo.nymo) return { active: false, veto: true, reason: 'Below the New York midnight open ($' + nymo.nymo.toFixed(2) + '): the daily short is late' };
      setup.nymo = nymo.nymo;
    }
    var kin = this.core.calculateKineticEnergy(rows, atr);
    if (setup.direction === 'BULL' && kin.downCascade) return { active: false, veto: true, reason: 'Arrival is still a waterfall (score ' + kin.velocityScore + '): do not catch the knife' };
    if (setup.direction === 'BEAR' && kin.upCascade) return { active: false, veto: true, reason: 'Arrival is still a rip (score ' + kin.velocityScore + '): do not catch the knife' };
    var poc = this.core.detectPocMigration(rows);
    if (!poc.unread && setup.direction === 'BULL' && poc.trappedSide === 'TRAPPED_LONGS') return { active: false, veto: true, reason: 'Developing POC migrated up and price is back under it: longs are trapped' };
    if (!poc.unread && setup.direction === 'BEAR' && poc.trappedSide === 'TRAPPED_SHORTS') return { active: false, veto: true, reason: 'Developing POC migrated down and price is back over it: shorts are trapped' };
    var be = this.core.calculateTrailingBreakeven(setup.entryPrice, setup.direction, atr);
    setup.trailingBreakevenStop = be.breakevenStop;
    setup.pocTrapped = poc.trappedSide;
    var adr = this.core.calculateAdrExhaustion(rows);
    if (!adr.unread && adr.exhausted && String(sess.sessionName).indexOf('NY') === 0){
      if (setup.direction === 'BULL' && adr.position >= 0.75) return { active: false, veto: true, reason: 'ADR ' + adr.pctUsed + '% used at the high: no New York continuation long' };
      if (setup.direction === 'BEAR' && adr.position <= 0.25) return { active: false, veto: true, reason: 'ADR ' + adr.pctUsed + '% used at the low: no New York continuation short' };
    }
    var cvd = this.core.calculateCvdAbsorption(rows, setup.direction);
    if (!cvd.unread && !cvd.confirmed) return { active: false, veto: true, reason: 'Estimated delta does not confirm the ' + setup.direction + '. This is candle location, not the exchange tape' };
    setup.cvdStatus = cvd.unread ? 'UNREAD' : (cvd.deltaDivergence ? 'ABSORPTION' : 'AGREES');
    var anchor = nymo && !nymo.unread ? nymo.nymo : (asia.ash && asia.asl ? (asia.ash + asia.asl) / 2 : current.close);
    var gann = this.core.calculateGannSquare9(anchor, current.close);
    if (!gann.unread){
      setup.gannLevel = gann.closestLevel;
      setup.gannDegree = gann.closestDegree;
      setup.gannDistance = gann.distanceToGann;
      if (gann.isAtGannPivot && setup.stamps) setup.stamps.push('GANN');
    }
    var vi = this.core.detectVolumeImbalance(rows);
    if (vi) setup.volumeImbalance = vi.type + ' $' + vi.gapSize;
    if (!adr.unread && adr.adrDollars > 0){
      var cap = setup.direction === 'BULL' ? +(adr.todayLow + adr.adrDollars).toFixed(2) : +(adr.todayHigh - adr.adrDollars).toFixed(2);
      if (adr.exhausted) cap = +((adr.todayHigh + adr.todayLow) / 2).toFixed(2);
      function pull(px){
        if (setup.direction === 'BULL') return Math.min(px, cap);
        return Math.max(px, cap);
      }
      setup.tp1_1_5R = pull(setup.tp1_1_5R);
      setup.tp2_2_6R = pull(setup.tp2_2_6R);
      setup.tp3_3_5R = pull(setup.tp3_3_5R);
      setup.target = setup.tp2_2_6R;
      var room = Math.abs(setup.target - setup.entryPrice);
      var riskNow = Math.abs(setup.entryPrice - setup.stopLoss);
      if (!(room >= riskNow)) return { active: false, veto: true, reason: 'The remaining daily range is under 1R, so the target is not worth the stop' };
      setup.adrRemaining = '$' + adr.remainingDollars;
    }
    var lots = this.core.calculateContractLots(10000, 0.01, setup.entryPrice, setup.stopLoss);
    if (!lots.unread) setup.lotExample = lots.lots + ' lots per $' + lots.exampleEquity + ' at 1%';
    var pool = setup.direction === 'BULL' ? asia.asl : asia.ash;
    var dset = this.core.detectDoubleSweepExhaustion(rows, pool, setup.direction);
    if (!dset.unread && dset.sweepStage === 'STAGE_1') return { active: false, veto: true, reason: 'First sweep only. A second stop hunt, about 20 cents deeper, is still likely' };
    if (dset.confirmedStage2 && setup.stamps) setup.stamps.push('DSET');
    setup.dsetStage = dset.sweepStage;
    return { active: true, setup: setup };
  };
  root.HG_GoldScalpEngine = GoldScalpEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
