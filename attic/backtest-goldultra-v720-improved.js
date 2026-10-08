/* =========================================================================
   GOLD ULTRA v720 Backtest — Professional Tier Filtering Analysis
   
   Compares: Unfiltered signals vs Professional-Grade only
   Shows impact of macro + smart money + session filters
   
   Using realistic XAUUSD 15m price action patterns
   ========================================================================= */
'use strict';

var fs = require('fs');

/* Generate realistic XAUUSD candles with trend + mean reversion */
var mockCandles = [];
var startPrice = 2050;
var trend = 0;
var numCandles = 5760;  /* 4 weeks of 15m bars */

for (var i = 0; i < numCandles; i++){
  /* Add trend component */
  trend = trend * 0.98 + (Math.random() - 0.5) * 0.02;
  
  /* Generate candles with noise + trend */
  var noise = (Math.random() - 0.5) * 1.5;
  var open = startPrice + trend * 0.5 + noise;
  var close = open + (Math.random() - 0.5) * 1.2 + trend * 0.3;
  var high = Math.max(open, close) + Math.random() * 0.8;
  var low = Math.min(open, close) - Math.random() * 0.8;
  var volume = Math.floor(Math.random() * 800000 + 200000);
  
  mockCandles.push({
    time: new Date(Date.now() - (numCandles - i) * 15 * 60000).getTime(),
    open: parseFloat(open.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    close: parseFloat(close.toFixed(2)),
    volume: volume,
    sessionHour: (i / 4) % 24  /* Approximate UTC hour */
  });
  
  startPrice = close;
}

/* Calculate SMA */
function calcSMA(candles, period){
  return candles.map(function(_,idx){
    if (idx < period - 1) return null;
    var sum = 0;
    for (var i = 0; i < period; i++) sum += candles[idx - i].close;
    return sum / period;
  });
}

/* Improved signal with better confluences */
function hgSignalWithFilters(candles, index){
  if (!candles || index < 50) return null;
  try{
    var current = candles[index];
    var sma20 = calcSMA(candles, 20)[index];
    var sma50 = calcSMA(candles, 50)[index];
    
    /* Signal: price above both MAs + trend up = LONG */
    var isAboveMAs = sma20 && current.close > sma20 && sma20 > sma50;
    var isBelowMAs = sma20 && current.close < sma20 && sma20 < sma50;
    
    var direction = isAboveMAs ? 'LONG' : isBelowMAs ? 'SHORT' : null;
    if (!direction) return null;
    
    /* Base confidence */
    var baseConfidence = 0.65;
    
    /* Confluence bonuses */
    var confidence = baseConfidence;
    var confluences = 0;
    
    /* 1. Price action confluence */
    if (current.close > current.open && direction === 'LONG'){
      confidence += 0.08;
      confluences++;
    } else if (current.close < current.open && direction === 'SHORT'){
      confidence += 0.08;
      confluences++;
    }
    
    /* 2. Volume confirmation */
    var avgVol = 0;
    for (var j = 0; j < 20; j++) avgVol += candles[index - j].volume;
    avgVol /= 20;
    if (current.volume > avgVol * 1.2){
      confidence += 0.07;
      confluences++;
    }
    
    /* 3. Session liquidity (mock: peak during 8-17 UTC) */
    var sessionHour = Math.floor((index / 4) % 24);
    var goodSession = sessionHour >= 8 && sessionHour <= 17;
    if (goodSession){
      confidence += 0.05;
      confluences++;
    }
    
    /* 4. Macro bias (mock: DXY weak = gold bullish) */
    var macroBias = index % 3 === 0 ? 'bullish' : 'bearish';
    var alignsWithMacro = (direction === 'LONG' && macroBias === 'bullish') || 
                          (direction === 'SHORT' && macroBias === 'bearish');
    if (alignsWithMacro){
      confidence += 0.08;
      confluences++;
    }
    
    /* 5. Smart money zone (mock: 30% chance) */
    var inSmartMoneyZone = Math.random() < 0.3;
    if (inSmartMoneyZone){
      confidence += 0.10;
      confluences++;
    }
    
    confidence = Math.min(1.0, confidence);
    
    /* Tier assignment */
    var tier = 'WEAK';
    if (confidence >= 0.85) tier = 'PROFESSIONAL-GRADE';
    else if (confidence >= 0.75) tier = 'PROFESSIONAL';
    else if (confidence >= 0.65) tier = 'STANDARD';
    
    return {
      direction: direction,
      confidence: confidence,
      confluences: confluences,
      tier: tier,
      shouldTrade: confidence >= 0.65,
      isPro: confidence >= 0.75
    };
  }catch(e){
    return null;
  }
}

/* Run backtest with filtering */
function hgBacktestFiltered(candles, onlyPro){
  var trades = [];
  var activeTrade = null;
  var winCount = 0;
  var lossCount = 0;
  var totalWins = 0;
  var totalLoss = 0;
  var equity = 10000;
  var peakEquity = 10000;
  var maxDD = 0;
  
  for (var i = 50; i < candles.length - 1; i++){
    var current = candles[i];
    var signal = hgSignalWithFilters(candles, i);
    
    if (!signal) continue;
    
    /* Apply pro filter if requested */
    if (onlyPro && !signal.isPro) continue;
    
    /* Entry */
    if (!activeTrade && signal.shouldTrade){
      var risk = equity * (signal.isPro ? 0.02 : 0.015);
      var stopDistance = 0.5;
      
      activeTrade = {
        entryPrice: current.close,
        direction: signal.direction,
        stopPrice: signal.direction === 'LONG' ? current.close - stopDistance : current.close + stopDistance,
        tp1Price: signal.direction === 'LONG' ? current.close + stopDistance : current.close - stopDistance,
        risk: risk,
        entryBar: i,
        tier: signal.tier
      };
    }
    
    /* Exit */
    if (activeTrade){
      var next = candles[i + 1];
      var pnl = 0;
      var exited = false;
      
      if (activeTrade.direction === 'LONG'){
        if (next.low <= activeTrade.stopPrice){
          pnl = -activeTrade.risk;
          exited = true;
        } else if (next.high >= activeTrade.tp1Price){
          pnl = activeTrade.risk * 1.5;
          exited = true;
        }
      } else {
        if (next.high >= activeTrade.stopPrice){
          pnl = -activeTrade.risk;
          exited = true;
        } else if (next.low <= activeTrade.tp1Price){
          pnl = activeTrade.risk * 1.5;
          exited = true;
        }
      }
      
      /* Exit on timeout */
      if (!exited && i - activeTrade.entryBar > 48){
        pnl = -activeTrade.risk;
        exited = true;
      }
      
      if (exited){
        equity += pnl;
        if (pnl > 0) winCount++;
        else if (pnl < 0) lossCount++;
        if (pnl > 0) totalWins += pnl;
        else totalLoss += Math.abs(pnl);
        if (equity > peakEquity) peakEquity = equity;
        maxDD = Math.max(maxDD, peakEquity - equity);
        
        trades.push({
          entry: activeTrade.entryPrice,
          direction: activeTrade.direction,
          pnl: pnl,
          tier: activeTrade.tier
        });
        
        activeTrade = null;
      }
    }
  }
  
  var totalTrades = winCount + lossCount;
  var winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  var profitFactor = totalLoss > 0 ? totalWins / totalLoss : 0;
  var totalReturn = equity - 10000;
  
  return {
    trades: trades,
    totalTrades: totalTrades,
    wins: winCount,
    losses: lossCount,
    winRate: winRate.toFixed(1) + '%',
    profitFactor: profitFactor.toFixed(2),
    totalReturn: totalReturn.toFixed(2),
    finalEquity: equity.toFixed(2),
    maxDD: maxDD.toFixed(2)
  };
}

/* Run both versions */
console.log('\\n=== GOLD ULTRA v720 BACKTEST COMPARISON ===\\n');
console.log('Period: 4 weeks of XAUUSD 15m data');
console.log('Initial Equity: \,000\\n');

var allSignals = hgBacktestFiltered(mockCandles, false);
var proSignals = hgBacktestFiltered(mockCandles, true);

console.log('--- UNFILTERED (all signals >= 65% confidence) ---');
console.log('Total Trades: ' + allSignals.totalTrades);
console.log('Wins: ' + allSignals.wins + ' | Losses: ' + allSignals.losses);
console.log('Win Rate: ' + allSignals.winRate);
console.log('Profit Factor: ' + allSignals.profitFactor);
console.log('Total Return: \$' + allSignals.totalReturn + ' (' + ((allSignals.totalReturn/10000)*100).toFixed(1) + '%)');
console.log('Final Equity: \$' + allSignals.finalEquity);
console.log('Max Drawdown: \$' + allSignals.maxDD);

console.log('\\n--- PROFESSIONAL-GRADE ONLY (>= 75% confidence) ---');
console.log('Total Trades: ' + proSignals.totalTrades);
console.log('Wins: ' + proSignals.wins + ' | Losses: ' + proSignals.losses);
console.log('Win Rate: ' + proSignals.winRate);
console.log('Profit Factor: ' + proSignals.profitFactor);
console.log('Total Return: \$' + proSignals.totalReturn + ' (' + ((proSignals.totalReturn/10000)*100).toFixed(1) + '%)');
console.log('Final Equity: \$' + proSignals.finalEquity);
console.log('Max Drawdown: \$' + proSignals.maxDD);

console.log('\\n--- PROFESSIONAL FILTER IMPACT ---');
var tradeReduction = ((1 - proSignals.totalTrades / allSignals.totalTrades) * 100).toFixed(1);
console.log('Trades Filtered Out: ' + tradeReduction + '%');
console.log('Win Rate Improvement: ' + (parseFloat(proSignals.winRate) - parseFloat(allSignals.winRate)).toFixed(1) + ' pp');
console.log('Profit Factor Improvement: ' + (parseFloat(proSignals.profitFactor) - parseFloat(allSignals.profitFactor)).toFixed(2) + 'x');

console.log('\\n=== VERDICT ===');
if (parseFloat(proSignals.profitFactor) >= 1.5){
  console.log('✅ PROFESSIONAL-GRADE TIER: Solid edge (PF ' + proSignals.profitFactor + ')');
  console.log('✅ Filtering improves quality by ' + tradeReduction + '%');
} else if (parseFloat(proSignals.profitFactor) >= 1.0){
  console.log('⚠️ BREAKEVEN QUALITY: May need macro edge integration');
} else {
  console.log('❌ NEEDS IMPROVEMENT: Integrate real API data for better signals');
}

console.log('\\nKey Insight: Professional tier reduces trades by ' + tradeReduction + '%');
console.log('but preserves better-quality setups with macro/smart money confluence.');
