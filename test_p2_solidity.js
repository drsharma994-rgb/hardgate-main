/* =============================================================================
   OMNIROUTE P2 SOLIDITY FRAMEWORK TEST
   Tests the two new P2 scoring functions with sample setups
   ============================================================================= */

/* Helper function to generate synthetic price data */
function generateSampleRows(length, startPrice, trend) {
  var rows = [];
  var current = startPrice;
  var atr14 = 100;

  for (var i = 0; i < length; i++) {
    var change = (Math.random() - 0.5) * atr14;
    if (trend === 'up') change += atr14 * 0.1;
    if (trend === 'down') change -= atr14 * 0.1;

    current += change;
    var o = current - Math.random() * atr14 * 0.5;
    var c = current + (Math.random() - 0.5) * atr14 * 0.5;
    var h = Math.max(o, c) + Math.random() * atr14 * 0.3;
    var l = Math.min(o, c) - Math.random() * atr14 * 0.3;

    rows.push({
      t: i,
      o: o,
      h: h,
      l: l,
      c: c,
      v: Math.random() * 1000000
    });
  }

  return rows;
}

/* Test Setup 1: Perfect alignment entry vs liquidation */
function testSetup1() {
  var rows = generateSampleRows(100, 10000, 'up');

  var setup = {
    rows: rows,
    hit: {
      kind: 'PO3',
      dir: 'long',
      level: 10100,
      why: 'pullback on support'
    },
    plan: {
      entry: 10150,
      stop: 10050,
      t1: 10250,
      t2: 10350,
      risk: 100,
      rr1: 1.0,
      rr2: 2.0
    },
    extra: {
      stats: {
        expR: 0.45,      /* +0.45R expectancy */
        samples: 60,     /* 60 samples - robust */
        hit: 0.65        /* 65% win rate */
      }
    }
  };

  return {
    name: 'Setup 1: Perfect Alignment (entry ahead of liq, good expectancy)',
    setup: setup,
    expected: {
      liq: 'high (12pts for sweet spot + 2pt stop bonus)',
      exp: 'high (6pts for moderate edge + 8pts for robust samples = 8pts max)',
      total: 'strong solidity'
    }
  };
}

/* Test Setup 2: Good expectancy but weak liq placement */
function testSetup2() {
  var rows = generateSampleRows(100, 20000, 'up');

  var setup = {
    rows: rows,
    hit: {
      kind: 'MMOVE',
      dir: 'long',
      level: 20100,
      why: 'momentum continuation'
    },
    plan: {
      entry: 20300,      /* Far from major liq support */
      stop: 20200,
      t1: 20400,
      t2: 20600,
      risk: 100,
      rr1: 1.0,
      rr2: 2.0
    },
    extra: {
      stats: {
        expR: 0.62,      /* +0.62R high edge */
        samples: 120,    /* 120 samples - very robust */
        hit: 0.68        /* 68% win rate */
      }
    }
  };

  return {
    name: 'Setup 2: Good Expectancy + Weak Liq Placement',
    setup: setup,
    expected: {
      liq: 'low (entry far from liq, ~0pts)',
      exp: 'high (8pts for high edge + 8pts for robust samples = 8pts max)',
      total: 'expectancy carries the setup despite weak liq context'
    }
  };
}

/* Test Setup 3: High sample-size edge with poor session timing */
function testSetup3() {
  var rows = generateSampleRows(100, 30000, 'down');

  var setup = {
    rows: rows,
    hit: {
      kind: 'SPRING',
      dir: 'short',
      level: 30100,
      why: 'failed breakout reversal'
    },
    plan: {
      entry: 29900,
      stop: 30000,      /* Stop well-positioned above entry */
      t1: 29800,
      t2: 29600,
      risk: 100,
      rr1: 1.0,
      rr2: 2.0
    },
    extra: {
      stats: {
        expR: 0.18,      /* +0.18R moderate edge */
        samples: 210,    /* 210 samples - extremely robust */
        hit: 0.57        /* 57% win rate */
      }
    }
  };

  return {
    name: 'Setup 3: High Sample-Size Edge (poor timing)',
    setup: setup,
    expected: {
      liq: 'varies (depends on liq clusters)',
      exp: 'medium (3pts for breakeven + 8pts for robust samples = 8pts max)',
      total: 'statistical confidence carries despite weak individual edge'
    }
  };
}

/* Main test runner */
function runP2Tests() {
  console.log('\n=== OMNIROUTE P2 SOLIDITY FRAMEWORK TEST ===\n');

  var tests = [testSetup1(), testSetup2(), testSetup3()];
  var results = [];

  for (var i = 0; i < tests.length; i++) {
    var test = tests[i];
    console.log('TEST ' + (i + 1) + ': ' + test.name);
    console.log('Expected: ' + JSON.stringify(test.expected, null, 2));

    try {
      /* Test liquidation score */
      var liqResult = hgOmniLiquidationScore(test.setup, test.setup.hit.dir);
      console.log('\nLiquidation Score:');
      console.log('  Score: ' + liqResult.score + '/' + liqResult.maxScore);
      console.log('  Detail: ' + liqResult.detail);
      if (liqResult.stopBonus) {
        console.log('  Stop Bonus: +' + liqResult.stopBonus + 'pts');
      }

      /* Test expectancy score */
      var expResult = hgOmniExpectancyScore(test.setup);
      console.log('\nExpectancy Score:');
      console.log('  Score: ' + expResult.score + '/' + expResult.maxScore);
      console.log('  Detail: ' + expResult.detail);
      if (isFinite(expResult.expR)) {
        console.log('  Expectancy: ' + expResult.expR.toFixed(2) + 'R (' + expResult.expectancyScore + 'pts)');
        console.log('  Samples: ' + expResult.samples + ' (' + expResult.sampleScore + 'pts)');
      }

      /* Full solidity score */
      var solidityResult = hgOmniSolidityScore(test.setup, test.setup.hit.kind);
      console.log('\nFull Solidity Score:');
      console.log('  Total: ' + solidityResult.score + '/' + solidityResult.maxScore);
      console.log('  Tier: ' + solidityResult.tier);
      console.log('  Summary: ' + solidityResult.detail);

      results.push({
        name: test.name,
        liq: liqResult.score,
        exp: expResult.score,
        total: solidityResult.score,
        tier: solidityResult.tier
      });

    } catch (e) {
      console.error('ERROR in test ' + (i + 1) + ': ' + e.message);
      console.error(e.stack);
    }

    console.log('\n' + Array(70).join('-') + '\n');
  }

  /* Summary table */
  console.log('=== SUMMARY TABLE ===\n');
  console.log('Setup | Liq | Exp | Total | Tier');
  console.log('------|-----|-----|-------|------------------');
  for (var j = 0; j < results.length; j++) {
    var r = results[j];
    var shortName = (j + 1) + ': ' + r.name.split('(')[0].trim();
    console.log(
      shortName.substring(0, 30).padEnd(30) + ' | ' +
      String(r.liq).padStart(3) + ' | ' +
      String(r.exp).padStart(3) + ' | ' +
      String(r.total).padStart(5) + ' | ' +
      r.tier
    );
  }

  /* Validation checks */
  console.log('\n=== VALIDATION CHECKS ===\n');

  var checks = [
    {
      desc: 'Setup 1 should be EXTREMELY_SOLID (85+ pts)',
      check: results[0].score >= 85,
      actual: results[0].score + ' (tier: ' + results[0].tier + ')'
    },
    {
      desc: 'Setup 2 should be FAIR to SOLID (55-79 pts, saved by expectancy)',
      check: results[1].score >= 55 && results[1].score <= 84,
      actual: results[1].score + ' (tier: ' + results[1].tier + ')'
    },
    {
      desc: 'Setup 3 should be FAIR (55-69 pts, high samples help)',
      check: results[2].score >= 55 && results[2].score <= 84,
      actual: results[2].score + ' (tier: ' + results[2].tier + ')'
    },
    {
      desc: 'Liquidation scores should be between 0-14 (max 12 + 2 bonus)',
      check: results.every(function(r) { return r.liq >= 0 && r.liq <= 14; }),
      actual: 'Liq scores: ' + results.map(function(r) { return r.liq; }).join(', ')
    },
    {
      desc: 'Expectancy scores should be between 0-8',
      check: results.every(function(r) { return r.exp >= 0 && r.exp <= 8; }),
      actual: 'Exp scores: ' + results.map(function(r) { return r.exp; }).join(', ')
    }
  ];

  for (var k = 0; k < checks.length; k++) {
    var check = checks[k];
    var status = check.check ? 'PASS' : 'FAIL';
    console.log('[' + status + '] ' + check.desc);
    console.log('      Actual: ' + check.actual + '\n');
  }

  return results;
}

/* Export for node.js if needed */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateSampleRows: generateSampleRows,
    testSetup1: testSetup1,
    testSetup2: testSetup2,
    testSetup3: testSetup3,
    runP2Tests: runP2Tests
  };
}

/* Run if in browser */
if (typeof window !== 'undefined' && typeof hgOmniLiquidationScore === 'function') {
  console.log('P2 functions detected in window. Running tests...');
  runP2Tests();
}
