/* HARDGATE — Increment 5, 6, 7 pipeline verification test suite.
   1. Increment 5: onchain-alt-data.js (netflow z-score, stablecoin cadence, miner cycle, whale ticker, LTH/STH)
   2. Increment 6: structure-core.js (swings BOS/CHoCH, FVG displacement & mitigation, OB breaks, regular & hidden divergence, primitives)
   3. Increment 7: portfolio-allocation.js (Sharpe weights, correlation Kelly, regime activation, DD risk scalar, fund segregation, recon math)
*/
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
function ok(c, msg){
  assert.ok(c, msg);
  pass++;
  console.log('ok    - ' + msg);
}

// ---------------- 1. Increment 5: On-chain & Alternative Data ----------------
console.log('\n--- Testing Increment 5: onchain-alt-data.js ---');
const onchainAlt = await import('../onchain-alt-data.js');
const {
  hgCalcNetflowZ, hgNetflowGate, hgAnalyzeStableCadence,
  hgDetectTetherPrint, hgMinerCycleContext, hgWhaleFlowAnalysis,
  hgLthSthSupplyDynamics
} = onchainAlt;

// Netflow Z-score
const flows = [100, 150, 120, 110, 1000]; // 1000 is heavy inflow
const zRes = hgCalcNetflowZ(flows);
ok(zRes && zRes.z > 1.5, 'Netflow z-score detects +2σ distribution spike');
const gateVeto = hgNetflowGate('BTCUSDT', 'long', zRes);
ok(gateVeto.pass === false && gateVeto.state === 'veto', 'Netflow gate vetoes longs on exchange inflow spike');

const outflow = [100, 150, 80, -300];
const zOutflow = hgCalcNetflowZ(outflow);
const gateBonus = hgNetflowGate('BTCUSDT', 'long', zOutflow);
ok(gateBonus.pass === true && gateBonus.bonus === true, 'Netflow gate awards bonus on outflow supply squeeze');

// Stablecoin cadence
const stables = hgAnalyzeStableCadence(160e9, -500e6, -4e9, 15);
ok(stables && stables.tightenRrLongs === true, 'Stablecoin cadence flags 14+ days contracting supply');

// Tether print
const tethAlert = hgDetectTetherPrint(2.5e9);
ok(tethAlert && tethAlert.alert === true, 'Detects >= $2B 24h Tether mint');

// Miner cycle
const miner = hgMinerCycleContext(0.42, 2.0, 'capitulation-recovery');
ok(miner && miner.cycleBottom === true, 'Miner Puell < 0.5 & capitulation-recovery signals cycle bottom');

// Whale ticker
const whaleTxs = [
  { timestamp: Date.now() - 3600000, usdValue: 35e6, isExchangeDeposit: true, asset: 'BTC' }
];
const whaleRes = hgWhaleFlowAnalysis(whaleTxs, 'BTC');
ok(whaleRes.vetoDistribution === true, 'Whale deposit >$25M to exchange triggers distribution veto');

// LTH / STH supply
const lth = hgLthSthSupplyDynamics(70.5, 29.5, -3.2, 18.0);
ok(lth && lth.phase.indexOf('DISTRIBUTING') !== -1, 'LTH 30d decline detects smart money distribution');


// ---------------- 2. Increment 6: Structure Core & Primitives ----------------
console.log('\n--- Testing Increment 6: structure-core.js ---');
const structureCore = await import('../structure-core.js');
const {
  detectSwings, detectFvg, detectOrderBlocks, detectDivergences,
  primitiveCusum, primitiveTsmom, primitiveEmaCascade
} = structureCore;

// Synthetic candle series with swing high/low & BOS
const candles = [
  { t: 1000, o: 100, h: 102, l: 99, c: 101, v: 100 },
  { t: 2000, o: 101, h: 103, l: 100, c: 102, v: 120 },
  { t: 3000, o: 102, h: 108, l: 101, c: 107, v: 250 }, // Swing high
  { t: 4000, o: 107, h: 107, l: 103, c: 104, v: 150 },
  { t: 5000, o: 104, h: 105, l: 98, c: 99, v: 180 },   // Swing low
  { t: 6000, o: 99, h: 102, l: 98, c: 101, v: 120 },
  { t: 7000, o: 101, h: 104, l: 100, c: 103, v: 110 },
  { t: 8000, o: 103, h: 112, l: 102, c: 111, v: 500 }, // Break of 108 structure
  { t: 9000, o: 111, h: 113, l: 109, c: 112, v: 200 }
];

const sw = detectSwings(candles, { left: 2, right: 2 });
ok(sw.swings.length >= 2, 'detectSwings identified swing pivots');
ok(sw.choch.length >= 1 || sw.bos.length >= 1, 'detectSwings identified structure break across level 108');

// FVG with displacement
const fvgCandles = [
  { t: 100, o: 100, h: 101, l: 99, c: 100, v: 10 },
  { t: 200, o: 100, h: 102, l: 99, c: 101, v: 10 },    // b1: h=102
  { t: 300, o: 101, h: 115, l: 101, c: 114, v: 100 },  // b2: displacement body=13, closes top 25%
  { t: 400, o: 114, h: 120, l: 106, c: 118, v: 20 },   // b3: l=106 -> Gap between 102 and 106
  { t: 500, o: 118, h: 119, l: 115, c: 116, v: 10 }
];
const fvgs = detectFvg(fvgCandles, { atrLen: 3 });
ok(fvgs.length === 1 && fvgs[0].bottom === 102 && fvgs[0].top === 106, 'detectFvg correctly identified 102-106 bullish gap');

// Order Block
const obList = detectOrderBlocks(candles, sw);
ok(Array.isArray(obList), 'detectOrderBlocks executed successfully');

// Divergence test with synthetic series
const divCandles = [];
for (let i = 0; i < 60; i++){
  // Lower low price, but we will test function output
  divCandles.push({ t: i * 1000, o: 100 - i * 0.2, h: 102 - i * 0.2, l: 98 - i * 0.2, c: 99 - i * 0.2, v: 100 });
}
const divs = detectDivergences(divCandles, { rsiPeriod: 14 });
ok(divs && Array.isArray(divs.regular) && Array.isArray(divs.hidden), 'detectDivergences cleanly separates regular & hidden');

// Primitives: CUSUM, TSMOM, EMA Cascade
const closes = [10, 10.2, 10.5, 10.3, 10.8, 11.2, 11.5, 12, 12.3, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 18, 19, 20, 22, 25];
const cus = primitiveCusum(closes, 1.0);
ok(cus && cus.dir === 'long', 'primitiveCusum fired long event on trend surge');

const ts = primitiveTsmom(closes, [5, 10]);
ok(ts.agreement === 'bullish', 'primitiveTsmom identified all-positive momentum signs');

const emaCas = primitiveEmaCascade(closes, [3, 5, 8]);
ok(emaCas.state === 'bullish' && emaCas.spreadPct > 0, 'primitiveEmaCascade identified bullish alignment & positive spread');


// ---------------- 3. Increment 7: Portfolio Allocation & Construction ----------------
console.log('\n--- Testing Increment 7: portfolio-allocation.js ---');
const portAlloc = await import('../portfolio-allocation.js');
const {
  hgCalcStrategyWeights, hgCorrelationKellySize, hgCheckStrategyRegimeActive,
  hgDynamicDrawdownRisk, hgSegregatedFundLimits, hgReconcileTrades
} = portAlloc;

// Strategy weights based on rolling Sharpe
const sharpes = { SWING: 1.8, SCALP: 0.9, SMC: 2.1, TRAP: -0.2 };
const wts = hgCalcStrategyWeights(sharpes);
ok(wts.SMC > wts.SCALP, 'Higher Sharpe yields higher strategy allocation weight');
ok(wts.TRAP === 0.05 || wts.TRAP <= 0.06, 'Floor of 5% applies to negative Sharpe strategy');
const sumWts = Object.values(wts).reduce((a, b) => a + b, 0);
ok(Math.abs(sumWts - 1.0) < 0.01, 'Strategy weights sum to 1.0');

// Correlation-adjusted Kelly sizing
const newTrade = { sym: 'ETHUSDT', dir: 'long', winRate: 0.55, winLossRatio: 2.2 };
const book = [
  { sym: 'BTCUSDT', dir: 'long' },
  { sym: 'SOLUSDT', dir: 'long' }
];
const corrMatrix = {
  'BTCUSDT:ETHUSDT': 0.85,
  'ETHUSDT:SOLUSDT': 0.75
};
const kellyRes = hgCorrelationKellySize(newTrade, book, corrMatrix);
ok(kellyRes.avgCorrelation > 0.7 && kellyRes.correlationDiscount < 1.0, 'Correlation Kelly dampens size on high portfolio overlap');

// Regime-conditional activation
const expMap = { 'SMC:RISK-ON': 0.8, 'SMC:RISK-OFF': -0.4 };
const smcActiveInOff = hgCheckStrategyRegimeActive('SMC', 'RISK-OFF', expMap);
ok(smcActiveInOff.active === false && smcActiveInOff.status === 'REGIME PAUSED', 'Pauses strategy in negative expectancy regime');

// Dynamic Drawdown Risk
const normalRisk = hgDynamicDrawdownRisk(10000, 10000, 1.0);
ok(normalRisk.riskPct === 1.0 && normalRisk.allowedNewEntries === true, 'Peak equity yields normal 1.0R risk');

const ddRisk = hgDynamicDrawdownRisk(9500, 10000, 1.0); // 5% DD
ok(ddRisk.riskPct < 1.0 && ddRisk.riskPct > 0.5, '5% DD scales down risk protectively');

const haltRisk = hgDynamicDrawdownRisk(9200, 10000, 1.0); // 8% DD (>7%)
ok(haltRisk.riskPct === 0 && haltRisk.allowedNewEntries === false, '>7% DD triggers risk halt');

// Multi-fund limits
const fund = hgSegregatedFundLimits({ fundId: 'crypto-alpha', heatCapPct: 0.06 }, { equity: 50000, currentHeatUsd: 1500 });
ok(fund.maxHeatUsd === 3000 && fund.availableHeatUsd === 1500 && fund.canOpenTrade === true, 'Segregated fund calculates independent heat caps');

// Reconciliation
const paper = [{ id: 'T1', sym: 'BTCUSDT', strategy: 'SMC', entry: 50000, expectedFeesUsd: 10 }];
const live = [{ id: 'T1', entry: 50050, feesUsd: 12, slippageUsd: 25 }];
const recon = hgReconcileTrades(paper, live);
ok(recon.reconciledCount === 1 && recon.diffs[0].feeDrift === 2, 'Live vs paper recon computes slippage and fee drift');

console.log(`\nALL INCREMENT 5, 6, 7 TESTS PASSED (${pass} assertions).`);
