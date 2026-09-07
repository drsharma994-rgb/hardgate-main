/* HARDGATE — onchain-alt-data.js (Increment 5)
   On-chain and alternative data engine:
   1. Exchange netflow (BTC/ETH netflow tracking, 7d z-score, distribution vs accumulation)
   2. Stablecoin printing cadence & 30d slope (DeFiLlama aggregate tracking, Tether print detection)
   3. Miner behavior & cycle context (Puell multiple, miner reserve change, hash ribbons)
   4. Whale wallet cluster alerts (>=$10M ticker, >=$25M exchange inflow veto / outflow accumulation)
   5. Long-term holder / Short-term holder (LTH/STH) supply distribution & gold comparison
*/
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

function fin(v){ return typeof v === 'number' && isFinite(v); }
function num(v){
  if (v === null || v === undefined || v === '') return null;
  var n = +v;
  return isFinite(n) ? n : null;
}

// ---------------- 1. Exchange Netflows ----------------
/** Parse or compute 7-day z-score of net exchange flows.
    Positive netflow = inflow to exchange (sell pressure / distribution).
    Negative netflow = outflow from exchange (accumulation / supply squeeze). */
function hgCalcNetflowZ(flows7d){
  if (!Array.isArray(flows7d) || flows7d.length < 3) return null;
  var valid = flows7d.map(num).filter(fin);
  if (valid.length < 3) return null;
  var mean = valid.slice(0, -1).reduce(function(a, b){ return a + b; }, 0) / (valid.length - 1);
  var variance = valid.slice(0, -1).reduce(function(a, b){ return a + Math.pow(b - mean, 2); }, 0) / (valid.length - 1);
  var sd = Math.sqrt(variance);
  var latest = valid[valid.length - 1];
  if (!(sd > 0)) return { mean: mean, sd: 0, latest: latest, z: 0 };
  var z = (latest - mean) / sd;
  return {
    mean: mean,
    sd: sd,
    latest: latest,
    z: z,
    tilt: z > 2.0 ? 'risk-off' : (z < -2.0 ? 'risk-on' : 'neutral'),
    regimeLabel: z > 2.0 ? 'EXCHANGE INFLOW HEAVY (+2σ)' : (z < -2.0 ? 'EXCHANGE OUTFLOW ACCUMULATION (-2σ)' : 'NETFLOW BALANCED')
  };
}

/** Netflow gate for setups: long side bonus on heavy outflow, veto/tighten on heavy inflow */
function hgNetflowGate(sym, dir, netflowZ){
  if (!netflowZ || !fin(netflowZ.z)) return { pass: true, state: 'na', note: 'netflow unavailable' };
  dir = String(dir || '').toLowerCase();
  var z = netflowZ.z;
  if (dir === 'long'){
    if (z > 2.0) return { pass: false, state: 'veto', note: 'BTC/exchange inflow spike (z=' + z.toFixed(1) + 'σ) — heavy distribution risk' };
    if (z < -1.5) return { pass: true, state: 'pass', bonus: true, note: 'heavy exchange outflow (z=' + z.toFixed(1) + 'σ) — supply leaving exchanges' };
    return { pass: true, state: 'pass', note: 'netflow normal (z=' + z.toFixed(1) + 'σ)' };
  } else if (dir === 'short'){
    if (z < -2.0) return { pass: false, state: 'veto', note: 'exchange outflow squeeze (z=' + z.toFixed(1) + 'σ) — spot absorption' };
    if (z > 1.5) return { pass: true, state: 'pass', bonus: true, note: 'exchange inflow supply (z=' + z.toFixed(1) + 'σ) — coins moving to sell' };
    return { pass: true, state: 'pass', note: 'netflow normal (z=' + z.toFixed(1) + 'σ)' };
  }
  return { pass: true, state: 'na', note: 'neutral' };
}

// ---------------- 2. Stablecoin Supply & Printing Cadence ----------------
/** Analyzes stablecoin supply rate-of-change over 7d/30d and consecutive contraction days */
function hgAnalyzeStableCadence(totalUSD, delta7dUSD, delta30dUSD, consecutiveContractionDays){
  totalUSD = num(totalUSD);
  delta7dUSD = num(delta7dUSD);
  delta30dUSD = num(delta30dUSD);
  var daysContracting = num(consecutiveContractionDays) || 0;
  if (!fin(totalUSD) || totalUSD <= 0) return null;
  var d30Pct = (fin(delta30dUSD) && totalUSD > delta30dUSD) ? (delta30dUSD / (totalUSD - delta30dUSD)) * 100 : 0;
  var contracting14d = daysContracting >= 14;
  return {
    totalUSD: totalUSD,
    delta7dUSD: delta7dUSD,
    delta30dUSD: delta30dUSD,
    d30Pct: d30Pct,
    daysContracting: daysContracting,
    contracting14d: contracting14d,
    tightenRrLongs: contracting14d, // requires +0.5 R:R minimum on swing longs
    flowTilt: d30Pct > 1.0 ? 'expanding' : (d30Pct < -1.0 ? 'contracting' : 'flat')
  };
}

/** Check if large Tether mint (>=$2B in 24h) occurred */
function hgDetectTetherPrint(recentMintsUsd24h){
  var m = num(recentMintsUsd24h);
  if (!fin(m)) return null;
  if (m >= 2e9){
    return {
      alert: true,
      amountUsd: m,
      message: 'TETHER LARGE PRINT: $' + (m / 1e9).toFixed(1) + 'B minted in 24h — historically leads 3–7d market rallies'
    };
  }
  return { alert: false, amountUsd: m };
}

// ---------------- 3. Miner Behavior & Cycle Context ----------------
/** Evaluates Puell multiple, miner reserve 30d change, and hash ribbon status */
function hgMinerCycleContext(puellMultiple, reserve30dChangePct, hashRibbonState){
  var puell = num(puellMultiple);
  var res30 = num(reserve30dChangePct);
  var state = String(hashRibbonState || 'neutral').toLowerCase();
  
  var cycleBottom = (fin(puell) && puell < 0.5) || state === 'capitulation-recovery';
  var cycleTop = (fin(puell) && puell > 2.05) || (fin(res30) && res30 < -5.0 && fin(puell) && puell > 1.5);

  return {
    puell: puell,
    reserve30dChangePct: res30,
    hashRibbonState: state,
    cycleBottom: cycleBottom,
    cycleTop: cycleTop,
    cycleSignal: cycleBottom ? 'CYCLE BOTTOM ACCUMULATION' : (cycleTop ? 'CYCLE TOP DISTRIBUTION' : 'MID-CYCLE NORMAL'),
    bestModifier: cycleBottom ? 'promote-btc-tier1' : (cycleTop ? 'veto-btc-longs-30d' : 'neutral')
  };
}

// ---------------- 4. Whale Ticker & Distribution Veto ----------------
/** Analyzes whale transaction history for a symbol against scanned setups */
function hgWhaleFlowAnalysis(transfers, sym){
  if (!Array.isArray(transfers) || !transfers.length) return { vetoDistribution: false, accumulateAlt: false, events: [] };
  var now = Date.now();
  var h24 = 24 * 3600 * 1000;
  var relevant = transfers.filter(function(tx){
    if (!tx || typeof tx !== 'object') return false;
    var symMatch = !sym || (String(tx.asset || tx.symbol || '').toUpperCase() === String(sym || '').toUpperCase());
    var timeOk = tx.timestamp ? (now - tx.timestamp <= h24) : true;
    return symMatch && timeOk;
  });
  
  var maxInflowToExchange = 0;
  var maxOutflowFromExchange = 0;
  var events = [];
  
  for (var i = 0; i < relevant.length; i++){
    var t = relevant[i];
    var usd = num(t.usdValue || t.amountUsd);
    if (!fin(usd) || usd < 10e6) continue; // >= $10M threshold for ticker
    events.push({
      time: t.timestamp || now,
      asset: t.asset || sym,
      usd: usd,
      from: t.fromLabel || 'whale wallet',
      to: t.toLabel || 'unknown',
      type: t.isExchangeDeposit ? 'DEPOSIT' : (t.isExchangeWithdrawal ? 'WITHDRAWAL' : 'TRANSFER')
    });
    if (t.isExchangeDeposit && usd > maxInflowToExchange) maxInflowToExchange = usd;
    if (t.isExchangeWithdrawal && usd > maxOutflowFromExchange) maxOutflowFromExchange = usd;
  }

  return {
    vetoDistribution: maxInflowToExchange >= 25e6, // >$25M inflow to exchange within 24h
    accumulateAlt: maxOutflowFromExchange >= 25e6,  // >$25M withdrawal to whale cluster
    maxInflow: maxInflowToExchange,
    maxOutflow: maxOutflowFromExchange,
    events: events
  };
}

// ---------------- 5. LTH/STH Supply Distribution ----------------
/** Compares LTH/STH supply dynamics and calculates gold reserve comparison */
function hgLthSthSupplyDynamics(lthSupplyPct, sthSupplyPct, lth30dChangePct, centralBankGoldSharePct){
  var lth = num(lthSupplyPct);
  var sth = num(sthSupplyPct);
  var d30 = num(lth30dChangePct);
  var goldShare = num(centralBankGoldSharePct);

  var phase = 'BALANCED';
  if (fin(d30)){
    if (d30 < -2.0) phase = 'SMART MONEY DISTRIBUTING TO RETAIL (CYCLE TOP RISK)';
    else if (d30 > 2.0) phase = 'SMART MONEY ACCUMULATING FROM RETAIL (CYCLE ACCUMULATION)';
  }

  return {
    lthSupplyPct: lth,
    sthSupplyPct: sth,
    lth30dChangePct: d30,
    phase: phase,
    centralBankGoldSharePct: goldShare,
    macroDigitalGoldConvergence: (fin(lth) && fin(goldShare)) ? {
      btcColdStorageShare: lth,
      globalGoldReservesShare: goldShare,
      narrative: 'BTC HODL base (' + lth.toFixed(1) + '%) vs Central Bank Gold (' + goldShare.toFixed(1) + '%)'
    } : null
  };
}

G.hgCalcNetflowZ = hgCalcNetflowZ;
G.hgNetflowGate = hgNetflowGate;
G.hgAnalyzeStableCadence = hgAnalyzeStableCadence;
G.hgDetectTetherPrint = hgDetectTetherPrint;
G.hgMinerCycleContext = hgMinerCycleContext;
G.hgWhaleFlowAnalysis = hgWhaleFlowAnalysis;
G.hgLthSthSupplyDynamics = hgLthSthSupplyDynamics;

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    hgCalcNetflowZ: hgCalcNetflowZ,
    hgNetflowGate: hgNetflowGate,
    hgAnalyzeStableCadence: hgAnalyzeStableCadence,
    hgDetectTetherPrint: hgDetectTetherPrint,
    hgMinerCycleContext: hgMinerCycleContext,
    hgWhaleFlowAnalysis: hgWhaleFlowAnalysis,
    hgLthSthSupplyDynamics: hgLthSthSupplyDynamics
  };
}
})();
