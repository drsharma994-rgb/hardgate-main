#!/usr/bin/env node
/**
 * P4 SOLIDITY FRAMEWORK TEST
 * Tests all three P4 scoring functions with realistic sample data
 *
 * P4 adds 34-37 points to the framework (12 + 10 + 12-15):
 *   - Liquidation Recovery Confidence (12 pts)
 *   - Volatility Term Structure Alignment (10 pts)
 *   - Risk-Adjusted Sizing Score (12-15 pts)
 *
 * Updated framework total: 173-176 pts (was 139 pts in P0-P3)
 *
 * Usage:
 *   node test_p4_solidity.js
 *   Or load in browser: omniroute.js + call hgOmniSolidityScore(testSetup)
 */

// Mock setup object for testing
const testScenarios = [];

/**
 * SCENARIO 1: STRONG LIQUIDATION RECOVERY EDGE
 * Setup: Historical data showing >60% recovery after liquidation sweeps
 */
testScenarios.push({
  name: 'SCENARIO 1: Liquidation Recovery — Strong Reversal Edge',
  setup: {
    kind: 'SPRING',
    dir: 'long',
    rows: generateRecoveryHistoryRows(80),  /* 80 bars of synthetic data with recovery patterns */
    plan: {
      entry: 100.80,
      stop: 100.40,
      t1: 102.80,
      t2: 104.80,
      rr1: 2.0,
      rr2: 4.0
    },
    hit: {
      kind: 'SPRING',
      dir: 'long',
      level: 100.80,
      why: 'spring with recovery edge'
    }
  },
  expectedRecoveryPts: 12,
  explanation: 'Historical data shows ≥60% recovery rate after liquidation sweeps. Strong predictive edge for reversal. 12pts + potential 2pt bonus if reversals occur within 15-bar window.'
});

/**
 * SCENARIO 2: OPTIMAL VOLATILITY REGIME
 * Setup: Entry at 25-50th percentile volatility (sweet spot)
 */
testScenarios.push({
  name: 'SCENARIO 2: Volatility Term Structure — Optimal Entry Zone',
  setup: {
    kind: 'ORB',
    dir: 'long',
    rows: generateVolatilityHistoryRows(60),  /* 60 bars with varied volatility profile */
    plan: {
      entry: 100.50,
      stop: 100.00,
      t1: 101.50,
      t2: 102.50,
      rr1: 1.0,
      rr2: 2.0
    },
    hit: {
      kind: 'ORB',
      dir: 'long',
      level: 100.50,
      why: 'orb with optimal vol regime'
    }
  },
  expectedVolPts: 10,
  explanation: 'Current realized volatility in 25-50th percentile of 50-bar history (sweet spot). 10pts for optimal entry timing relative to vol regime.'
});

/**
 * SCENARIO 3: PROFESSIONAL RISK-ADJUSTED SIZING
 * Setup: Portfolio risk <0.5% AND reward ≥3:1
 */
testScenarios.push({
  name: 'SCENARIO 3: Risk-Adjusted Sizing — Ideal Professional Criteria',
  setup: {
    kind: 'ABSORB',
    dir: 'long',
    rows: generateSampleRows(50),
    plan: {
      entry: 100.00,
      stop: 99.75,          /* 0.25% stop distance */
      t1: 101.00,           /* 1.0% reward = 4:1 ratio */
      t2: 102.00,
      rr1: 4.0,
      rr2: 8.0
    },
    account: {
      size: 50000           /* $50k account */
    },
    hit: {
      kind: 'ABSORB',
      dir: 'long',
      level: 100.00,
      why: 'absorption with ideal sizing'
    },
    expectancy: {
      winRate: 0.55         /* 55% win rate */
    }
  },
  expectedRiskPts: 15,
  explanation: 'Stop at 0.05% portfolio risk (25 = 50k * 0.25%) + 4:1 reward:risk ratio. 15pts for ideal sizing + 2pts bonus for 55% win rate alignment = capped at 15.'
});

/**
 * SCENARIO 4: MODERATE RISK-ADJUSTED SIZING
 * Setup: Portfolio risk <1.0% AND reward ≥2:1
 */
testScenarios.push({
  name: 'SCENARIO 4: Risk-Adjusted Sizing — Good Professional Criteria',
  setup: {
    kind: 'MMOVE',
    dir: 'short',
    rows: generateSampleRows(50),
    plan: {
      entry: 50.00,
      stop: 50.50,          /* 0.50% stop distance (~$250 risk on 50k account) */
      t1: 48.00,            /* 2.0% reward = 2:1 ratio */
      t2: 46.00,
      rr1: 2.0,
      rr2: 4.0
    },
    account: {
      size: 50000
    },
    hit: {
      kind: 'MMOVE',
      dir: 'short',
      level: 50.00,
      why: 'measured move with good sizing'
    }
  },
  expectedRiskPts: 8,
  explanation: 'Stop at 0.5% portfolio risk + 2:1 reward:risk ratio. 8pts for good sizing criteria.'
});

/**
 * Generate synthetic recovery history for liquidation testing
 */
function generateRecoveryHistoryRows(count) {
  const rows = [];
  let price = 100;
  let isSwing = true;

  for (let i = 0; i < count; i++) {
    const volatility = 0.3 + Math.random() * 0.5;
    const trend = (i % 15 < 10) ? 0.05 : -0.05;

    /* Create sweep-like patterns: lows touched then reversals */
    let o = price;
    let h = price + volatility;
    let l = price - volatility;
    let c = price + trend;

    if (i % 20 === 10) {
      /* Create liquidation sweep: touch low, close up (reversal) */
      l = price - volatility * 1.5;
      c = price + volatility * 0.5;
    }

    rows.push({
      t: 1000000 + (i * 14400),
      o: o,
      h: h,
      l: l,
      c: c,
      v: 1000 + Math.random() * 1000
    });

    price = c;
  }

  return rows;
}

/**
 * Generate synthetic volatility history for vol term testing
 */
function generateVolatilityHistoryRows(count) {
  const rows = [];
  let price = 100;
  const volatilityHistory = [];

  for (let i = 0; i < count; i++) {
    /* Create varying volatility: quiet periods, elevated periods */
    let volMultiplier;
    if (i < 15) {
      volMultiplier = 0.3;  /* quiet phase (low vol) */
    } else if (i < 30) {
      volMultiplier = 0.6;  /* moderate vol */
    } else if (i < 45) {
      volMultiplier = 0.5;  /* back to moderate (25-50th percentile zone) */
    } else {
      volMultiplier = 0.8;  /* elevated vol */
    }

    const volatility = volMultiplier;
    const change = (Math.random() - 0.5) * volatility * 2;

    let o = price;
    let c = price + change;
    let h = Math.max(o, c) + volatility * 0.5;
    let l = Math.min(o, c) - volatility * 0.5;

    rows.push({
      t: 1000000 + (i * 3600),
      o: o,
      h: h,
      l: l,
      c: c,
      v: 500 + Math.random() * 500
    });

    price = c;
  }

  return rows;
}

/**
 * Generate generic sample rows (for risk-adjusted tests that mainly use plan)
 */
function generateSampleRows(count) {
  const rows = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 1.0;
    let o = price;
    let c = price + change;
    let h = Math.max(o, c) + 0.5;
    let l = Math.min(o, c) - 0.5;

    rows.push({
      t: 1000000 + (i * 3600),
      o: o,
      h: h,
      l: l,
      c: c,
      v: 1000 + Math.random() * 1000
    });

    price = c;
  }

  return rows;
}

/**
 * Helper: ATR calculation (same as in omniroute.js)
 */
function atrOf(rows, n) {
  if (!rows || rows.length < n + 1) return NaN;
  var sum = 0, i, h, l, c, cPrev, tr;
  for (i = rows.length - n; i < rows.length; i++) {
    h = num(rows[i].h);
    l = num(rows[i].l);
    c = num(rows[i].c);
    cPrev = i > 0 ? num(rows[i - 1].c) : c;
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
    tr = Math.max(h - l, Math.abs(h - cPrev), Math.abs(l - cPrev));
    sum += tr;
  }
  return sum / n;
}

/**
 * Helper: Safe number coercion
 */
function num(x) {
  if (x === null || x === undefined) return NaN;
  var n = +x;
  return isFinite(n) ? n : NaN;
}

/**
 * Helper: Finite coercion
 */
function fin(x) {
  var n = num(x);
  return isFinite(n) ? n : NaN;
}

/**
 * Run tests (if omniroute.js functions are available)
 */
console.log('='.repeat(90));
console.log('P4 SOLIDITY FRAMEWORK TEST SUITE');
console.log('='.repeat(90));
console.log('\nTesting three P4 scoring functions:\n');
console.log('  1. Liquidation Recovery Confidence (12 pts)');
console.log('  2. Volatility Term Structure Alignment (10 pts)');
console.log('  3. Risk-Adjusted Sizing Score (12-15 pts)');
console.log('\n' + '='.repeat(90) + '\n');

/* Check if functions are available */
const hasFunctions = (typeof window !== 'undefined') &&
                     window.hgOmniLiquidationRecoveryScore &&
                     window.hgOmniVolTermScore &&
                     window.hgOmniRiskAdjustedScore;

if (hasFunctions) {
  console.log('Functions loaded. Running test scenarios...\n');

  testScenarios.forEach((test, idx) => {
    const setup = test.setup;

    console.log('='.repeat(90));
    if (idx === 0) {
      console.log('P4.1: LIQUIDATION RECOVERY CONFIDENCE SCORING');
      console.log('='.repeat(90));
      console.log('\nScoring Logic:');
      console.log('  ≥60% reversal rate: 12pts');
      console.log('  ≥40% reversal rate: 8pts');
      console.log('  ≥20% reversal rate: 4pts');
      console.log('  <20% reversal rate: 0pts');
      console.log('  Bonus: +2pts if reversals within 15-bar window\n');

      const result = window.hgOmniLiquidationRecoveryScore(setup, setup.hit.dir);
      console.log('Test: ' + test.name);
      console.log('Result Score: ' + result.score + '/' + result.maxScore + ' pts');
      console.log('Reverse Rate: ' + (result.reverseRate * 100).toFixed(1) + '%');
      console.log('Detail: ' + result.detail);
      console.log('Expected: ' + test.expectedRecoveryPts + ' pts');
      console.log('Explanation: ' + test.explanation);
    } else if (idx === 1) {
      console.log('P4.2: VOLATILITY TERM STRUCTURE ALIGNMENT SCORING');
      console.log('='.repeat(90));
      console.log('\nScoring Logic:');
      console.log('  25-50th percentile: 10pts (sweet spot)');
      console.log('  50-75th percentile: 7pts (elevated)');
      console.log('  <25th percentile: 4pts (quiet)');
      console.log('  >75th percentile: 0pts (chaos vol)\n');

      const result = window.hgOmniVolTermScore(setup);
      console.log('Test: ' + test.name);
      console.log('Result Score: ' + result.score + '/' + result.maxScore + ' pts');
      console.log('Current Vol: ' + result.currentVol);
      console.log('Percentile: ' + result.percentile);
      console.log('Detail: ' + result.detail);
      console.log('Expected: ' + test.expectedVolPts + ' pts');
      console.log('Explanation: ' + test.explanation);
    } else if (idx === 2) {
      console.log('P4.3: RISK-ADJUSTED SIZING SCORE');
      console.log('='.repeat(90));
      console.log('\nScoring Logic:');
      console.log('  <0.5% risk + ≥3:1 reward: 15pts (ideal)');
      console.log('  <0.75% risk + ≥2.5:1 reward: 12pts (excellent)');
      console.log('  <1.0% risk + ≥2:1 reward: 8pts (good)');
      console.log('  <1.5% risk OR ≥1.5:1 reward: 4pts (acceptable)');
      console.log('  Bonus: +2pts if win rate ≥50%\n');

      const result = window.hgOmniRiskAdjustedScore(setup);
      console.log('Test: ' + test.name);
      console.log('Result Score: ' + result.score + '/' + result.maxScore + ' pts');
      console.log('Portfolio Risk: ' + result.portfolioRiskPercent + '%');
      console.log('Reward:Risk: ' + result.rewardToRisk + ':1');
      console.log('Account Size: $' + result.accountSize);
      console.log('Detail: ' + result.detail);
      console.log('Expected: ' + test.expectedRiskPts + ' pts');
      console.log('Explanation: ' + test.explanation);
    } else if (idx === 3) {
      console.log('P4.3: RISK-ADJUSTED SIZING SCORE (Scenario 2)');
      console.log('='.repeat(90) + '\n');

      const result = window.hgOmniRiskAdjustedScore(setup);
      console.log('Test: ' + test.name);
      console.log('Result Score: ' + result.score + '/' + result.maxScore + ' pts');
      console.log('Portfolio Risk: ' + result.portfolioRiskPercent + '%');
      console.log('Reward:Risk: ' + result.rewardToRisk + ':1');
      console.log('Detail: ' + result.detail);
      console.log('Expected: ' + test.expectedRiskPts + ' pts');
      console.log('Explanation: ' + test.explanation);
    }

    console.log('\n');
  });
} else {
  console.log('INFO: Functions not yet available (omniroute.js not loaded).');
  console.log('In browser, call: window.hgOmniSolidityScore(testSetup)\n');
}

console.log('='.repeat(90));
console.log('FRAMEWORK SUMMARY - WITH P4 ADDITIONS');
console.log('='.repeat(90));
console.log('\nP0 (55 pts): Order Blocks, FVG, Multi-TF EMA Cascade, Risk:Reward');
console.log('P1 (25 pts): Regime Classification, ATR Expansion, Session Timing');
console.log('P2 (20 pts): Liquidation Scoring, Expectancy & Statistical Edge');
console.log('P3 (39 pts): Order Flow Confluence, Structural Confluence, Momentum Convergence');
console.log('P4 (34-37 pts): Liquidation Recovery, Vol Term, Risk-Adjusted Sizing');
console.log('\nTOTAL: 173-176 POINTS (P0-P4)');
console.log('\nUpdated Tier Mapping (176-point scale):');
console.log('  147+ pts → Extremely Solid');
console.log('  120-146 pts → Solid');
console.log('  88-119 pts → Fair');
console.log('  <88 pts → Weak');
console.log('\n' + '='.repeat(90));
console.log('EXPORT: These functions can be called from browser console:');
console.log('  window.hgOmniLiquidationRecoveryScore(setup, direction)');
console.log('  window.hgOmniVolTermScore(setup)');
console.log('  window.hgOmniRiskAdjustedScore(setup)');
console.log('  window.hgOmniSolidityScore(setup)  // returns full 15-pillar breakdown');
console.log('='.repeat(90));
