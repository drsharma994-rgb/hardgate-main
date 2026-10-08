/**
 * HARDGATE Quantitative Setup Formation Engine v2.0
 * Pure Vanilla JavaScript — Zero-build compatible
 *
 * Disciplines:
 * 1. 4-Stage State Machine: STALKING -> PRIMED -> ARMED -> INVALIDATED
 * 2. Institutional Displacement Validation (ATR body ratio + Volume SMA)
 * 3. Microstructure Reclaim on Close (Eliminates front-running mid-candle wicks)
 * 4. Perp Order Flow Guards (CVD Absorption + Funding Rate Z-score)
 * 5. Structural Net Risk-to-Reward (>= 2.2R after taker fees & slippage)
 *
 * Bars may be {open,high,low,close,volume} or Hardgate {o,h,l,c,v}.
 */
(function (root) {
  'use strict';

  var SetupStatus = {
    STALKING: 'STALKING',
    PRIMED: 'PRIMED',
    ARMED: 'ARMED',
    INVALIDATED: 'INVALIDATED'
  };

  function num(v){ return (typeof v === 'number') ? v : +v; }
  function fin(v){ return typeof v === 'number' && isFinite(v); }

  function bar(k){
    if (!k) return null;
    var open = num(k.open != null ? k.open : k.o);
    var high = num(k.high != null ? k.high : k.h);
    var low = num(k.low != null ? k.low : k.l);
    var close = num(k.close != null ? k.close : k.c);
    var volume = num(k.volume != null ? k.volume : k.v);
    if (![open, high, low, close].every(fin)) return null;
    var out = { open: open, high: high, low: low, close: close, volume: fin(volume) ? volume : 0 };
    if (k.t != null && fin(num(k.t))) out.t = num(k.t);
    return out;
  }

  function FormationEngine(config) {
    this.config = Object.assign({
      minDisplacementAtr: 1.75,
      minVolumeMultiplier: 1.80,
      minRiskReward: 2.2,
      maxBarsValid: 48,
      fundingCrowdingZScore: 2.0,
      feeBufferPct: 0.0012
    }, config || {});
  }

  FormationEngine.prototype.qualifyDisplacement = function(c0, c1, c2, atr, volSma){
    c0 = bar(c0); c1 = bar(c1); c2 = bar(c2);
    if (!c0 || !c1 || !c2 || !(atr > 0)) return null;

    var isBullish = c1.close > c1.open && c2.low > c0.high;
    var isBearish = c1.close < c1.open && c2.high < c0.low;
    if (!isBullish && !isBearish) return null;

    var bodySize = Math.abs(c1.close - c1.open);
    var impulseValid = bodySize >= (atr * this.config.minDisplacementAtr);
    var volumeValid = !(volSma > 0) || c1.volume >= (volSma * this.config.minVolumeMultiplier);
    if (!impulseValid || !volumeValid) return null;

    return {
      direction: isBullish ? 'BULL' : 'BEAR',
      gapTop: isBullish ? c2.low : c0.low,
      gapBottom: isBullish ? c0.high : c2.high,
      gapSize: isBullish ? (c2.low - c0.high) : (c0.low - c2.high),
      displacementRatio: +(bodySize / atr).toFixed(2),
      volumeFactor: +((volSma > 0) ? (c1.volume / volSma) : 0).toFixed(2)
    };
  };

  FormationEngine.prototype.evaluateSetupCandidate = function(params){
    params = params || {};
    var symbol = params.symbol;
    var timeframe = params.timeframe;
    var raw = params.klines;
    var zone = params.zone;
    var orderFlowData = params.orderFlowData || {};
    var macroContext = params.macroContext || {};

    var klines = [];
    if (raw && raw.length){
      for (var i = 0; i < raw.length; i++){
        var b = bar(raw[i]);
        if (b) klines.push(b);
      }
    }
    if (klines.length < 20 || !zone) return null;

    var gates = [];
    var currentBar = klines[klines.length - 1];
    var atr = this.calculateATR(klines, 14);
    var dir = zone.direction;

    var biasVerdict = macroContext.biasVerdict || 'NEUTRAL';
    var biasAligned = (dir === 'BULL' && biasVerdict !== 'BEAR') ||
                      (dir === 'BEAR' && biasVerdict !== 'BULL');
    gates.push({
      id: 'G1_REGIME',
      name: 'HTF Regime Alignment',
      pass: biasAligned,
      evidence: 'Bias: ' + biasVerdict + ' | Direction: ' + dir
    });

    var ageInBars = klines.length - (zone.createdBarIndex || 0);
    var notExpired = ageInBars <= this.config.maxBarsValid && ageInBars >= 0;
    gates.push({
      id: 'G2_LIFECYCLE',
      name: 'Zone Shelf-Life',
      pass: notExpired,
      evidence: 'Age: ' + ageInBars + ' bars (Max: ' + this.config.maxBarsValid + ')'
    });

    var fundingPass = true;
    var fundingReason = 'Funding clean';
    var fundingZ = fin(num(orderFlowData.fundingZScore)) ? num(orderFlowData.fundingZScore) : 0;
    if (macroContext.nearSettlement) {
      fundingPass = false;
      fundingReason = 'Within 10m of 8-hour perp funding settlement';
    } else if (dir === 'BULL' && fundingZ > this.config.fundingCrowdingZScore) {
      fundingPass = false;
      fundingReason = 'Long crowding extreme (Funding Z: +' + fundingZ.toFixed(2) + ')';
    } else if (dir === 'BEAR' && fundingZ < -this.config.fundingCrowdingZScore) {
      fundingPass = false;
      fundingReason = 'Short crowding extreme (Funding Z: ' + fundingZ.toFixed(2) + ')';
    }
    gates.push({
      id: 'G3_FUNDING',
      name: 'Funding Crowding Guard',
      pass: fundingPass,
      evidence: fundingReason
    });

    var tapped = false;
    var invalidated = false;
    if (dir === 'BULL') {
      tapped = currentBar.low <= zone.gapTop;
      invalidated = currentBar.close < zone.gapBottom;
    } else {
      tapped = currentBar.high >= zone.gapBottom;
      invalidated = currentBar.close > zone.gapTop;
    }
    gates.push({
      id: 'G4_ZONE_INTEGRITY',
      name: 'Zone Integrity & Tap',
      pass: tapped && !invalidated,
      evidence: invalidated ? 'Zone breached on close' :
               tapped ? 'Zone accurately mitigated' : 'Price approaching zone'
    });

    var triggerArmed = false;
    var triggerEvidence = '';
    var range = currentBar.high - currentBar.low;
    if (dir === 'BULL') {
      var swept = currentBar.low <= zone.gapTop;
      var reclaimed = currentBar.close > zone.gapTop ||
        (currentBar.close > currentBar.open && range > 0 && (currentBar.close - currentBar.low) > range * 0.55);
      triggerArmed = swept && reclaimed;
      triggerEvidence = triggerArmed
        ? 'Bullish wick rejection. Low: ' + currentBar.low.toFixed(2) + ', Close: ' + currentBar.close.toFixed(2)
        : 'Awaiting lower wick rejection and reclaim candle close';
    } else {
      var sweptS = currentBar.high >= zone.gapBottom;
      var reclaimedS = currentBar.close < zone.gapBottom ||
        (currentBar.close < currentBar.open && range > 0 && (currentBar.high - currentBar.close) > range * 0.55);
      triggerArmed = sweptS && reclaimedS;
      triggerEvidence = triggerArmed
        ? 'Bearish wick rejection. High: ' + currentBar.high.toFixed(2) + ', Close: ' + currentBar.close.toFixed(2)
        : 'Awaiting upper wick rejection and reclaim candle close';
    }
    gates.push({
      id: 'G5_TRIGGER',
      name: 'Reclaim & Wick Commitment',
      pass: triggerArmed,
      evidence: triggerEvidence
    });

    var deltaAbsorbed = true;
    var cvdKnown = orderFlowData && Object.prototype.hasOwnProperty.call(orderFlowData, 'cvdDelta') && fin(num(orderFlowData.cvdDelta)) && num(orderFlowData.cvdDelta) !== 0;
    var cvdDelta = cvdKnown ? num(orderFlowData.cvdDelta) : 0;
    if (cvdKnown && dir === 'BULL' && cvdDelta < 0) {
      deltaAbsorbed = currentBar.close > currentBar.open;
    } else if (cvdKnown && dir === 'BEAR' && cvdDelta > 0) {
      deltaAbsorbed = currentBar.close < currentBar.open;
    }
    gates.push({
      id: 'G6_ABSORPTION',
      name: 'Delta CVD Absorption',
      pass: deltaAbsorbed,
      evidence: cvdKnown
        ? ('CVD Delta: ' + cvdDelta + ' | Absorption: ' + (deltaAbsorbed ? 'Confirmed' : 'Pending'))
        : 'CVD unread — gate open'
    });

    var entryPrice = currentBar.close;
    var stopLoss = dir === 'BULL' ? (zone.gapBottom - (atr * 0.25)) : (zone.gapTop + (atr * 0.25));
    var stopOk = dir === 'BULL' ? stopLoss < entryPrice : stopLoss > entryPrice;
    var riskDist = Math.abs(entryPrice - stopLoss);
    var fee = Math.abs(entryPrice) * this.config.feeBufferPct;
    var rewardDist = (riskDist + fee) * this.config.minRiskReward;
    var targetPrice = dir === 'BULL' ? entryPrice + rewardDist : entryPrice - rewardDist;
    var netRR = (riskDist + fee) > 0 ? +(rewardDist / (riskDist + fee)).toFixed(2) : 0;
    var rrPass = stopOk && netRR >= this.config.minRiskReward;
    gates.push({
      id: 'G7_RR_RATIO',
      name: 'Risk:Reward Feasibility',
      pass: rrPass,
      evidence: 'Net R:R: ' + netRR + 'R (Target: ' + targetPrice.toFixed(2) + ', Stop: ' + stopLoss.toFixed(2) + ')'
    });

    var failedGates = gates.filter(function(g){ return !g.pass; });
    var isQualified = failedGates.length === 0;
    var status = SetupStatus.STALKING;
    if (invalidated || !notExpired) status = SetupStatus.INVALIDATED;
    else if (isQualified) status = SetupStatus.ARMED;
    else if (tapped && !triggerArmed) status = SetupStatus.PRIMED;

    return {
      symbol: symbol,
      timeframe: timeframe,
      status: status,
      direction: dir,
      entryPrice: isQualified ? entryPrice : null,
      stopLoss: isQualified ? stopLoss : null,
      targetPrice: isQualified ? targetPrice : null,
      netRR: netRR,
      gapTop: zone.gapTop,
      gapBottom: zone.gapBottom,
      displacementRatio: zone.displacementRatio,
      gatesPassed: gates.filter(function(g){ return g.pass; }).length,
      totalGates: gates.length,
      allPassed: isQualified,
      failedGates: failedGates,
      ledger: gates,
      timestamp: Date.now()
    };
  };

  FormationEngine.prototype.calculateATR = function(klines, period){
    period = period || 14;
    if (!klines || klines.length < period + 1) return 1.0;
    var trSum = 0;
    for (var i = klines.length - period; i < klines.length; i++){
      var h = klines[i].high, l = klines[i].low, prevC = klines[i - 1].close;
      trSum += Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    }
    var atr = trSum / period;
    return atr > 0 ? +atr.toFixed(6) : 1.0;
  };

  FormationEngine.prototype.calculateVolumeSMA = function(klines, period){
    period = period || 20;
    if (!klines || klines.length < period) return 0;
    var sum = 0;
    for (var i = klines.length - period; i < klines.length; i++) sum += (klines[i].volume || 0);
    return +(sum / period).toFixed(4);
  };

  if (typeof root !== 'undefined') {
    root.HG_FormationEngine = FormationEngine;
    root.HG_SetupStatus = SetupStatus;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FormationEngine: FormationEngine, SetupStatus: SetupStatus };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
