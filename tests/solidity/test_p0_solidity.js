/**
 * P0 SOLIDITY FRAMEWORK TEST
 * Demonstrates the 4 scoring pillars totaling 50 points
 *
 * Usage:
 *   node test_p0_solidity.js
 *   Or load in browser console with omniroute.js and call hgOmniSolidityScore(testSetup)
 */

// Mock setup object for testing
const testSetup = {
  kind: 'SPRING',
  dir: 'long',

  // 20 bars of mock OHLCV data (4-hour timeframe)
  rows: [
    { t: 1000000, o: 100.50, h: 101.20, l: 100.40, c: 100.80, v: 1500 },
    { t: 1014400, o: 100.80, h: 101.50, l: 100.60, c: 101.00, v: 1600 },
    { t: 1028800, o: 101.00, h: 102.00, l: 100.90, c: 101.50, v: 1400 },
    { t: 1043200, o: 101.50, h: 102.20, l: 101.20, c: 101.80, v: 1700 },
    { t: 1057600, o: 101.80, h: 102.50, l: 101.60, c: 102.10, v: 1500 },
    { t: 1072000, o: 102.10, h: 102.80, l: 101.90, c: 102.40, v: 1800 },
    { t: 1086400, o: 102.40, h: 103.00, l: 102.20, c: 102.70, v: 1600 },
    { t: 1100800, o: 102.70, h: 103.20, l: 102.50, c: 102.90, v: 1900 },
    { t: 1115200, o: 102.90, h: 103.30, l: 102.70, c: 103.10, v: 1700 },
    { t: 1129600, o: 103.10, h: 103.50, l: 102.80, c: 103.30, v: 1800 },
    { t: 1144000, o: 103.30, h: 103.70, l: 103.00, c: 103.50, v: 1600 },
    { t: 1158400, o: 103.50, h: 103.90, l: 103.20, c: 103.70, v: 2000 },
    { t: 1172800, o: 103.70, h: 104.10, l: 103.40, c: 103.90, v: 1800 },
    { t: 1187200, o: 103.90, h: 104.30, l: 103.60, c: 104.10, v: 1900 },
    { t: 1201600, o: 104.10, h: 104.50, l: 103.80, c: 104.30, v: 2100 },
    // Order block setup: swing low then close above
    { t: 1216000, o: 104.30, h: 104.40, l: 103.50, c: 103.60, v: 1500 },  // swing low
    { t: 1230400, o: 103.60, h: 103.80, l: 103.55, c: 103.75, v: 1400 },  // close above
    { t: 1244800, o: 103.75, h: 103.95, l: 103.70, c: 103.85, v: 1300 },  // close above
    // FVG setup: bullish imbalance
    { t: 1259200, o: 103.85, h: 103.95, l: 103.80, c: 103.90, v: 1600 },
    { t: 1273600, o: 103.90, h: 104.20, l: 103.50, c: 104.00, v: 1800 }   // current
  ],

  // Plan with entry, stop, target (2.0R setup)
  plan: {
    entry: 103.85,
    stop: 103.40,
    t1: 104.55,
    t2: 105.25,
    rr1: 2.0,
    rr2: 2.86
  },

  // Hit details
  hit: {
    kind: 'SPRING',
    dir: 'long',
    level: 103.85,
    why: 'swept range low and closed back inside'
  }
};

/**
 * Utility functions (copied from omniroute.js for testing)
 */
function fin(v) {
  var n = +v;
  return isFinite(n) ? n : NaN;
}

function num(v) {
  var n = +v;
  return isFinite(n) ? n : NaN;
}

function emaOf(vals, n) {
  if (!vals || vals.length < n || n <= 0) return NaN;
  var k = 2 / (n + 1), e = vals[0], i;
  for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}

function closesOf(rows) {
  var out = [], i, c;
  for (i = 0; i < rows.length; i++) {
    c = num(rows[i].c);
    if (isFinite(c)) out.push(c);
  }
  return out;
}

function atrOf(rows, n) {
  if (!rows || rows.length < n + 1) return NaN;
  var sum = 0, cnt = 0, i, h, l, pc, tr;
  for (i = rows.length - n; i < rows.length; i++) {
    h = num(rows[i].h);
    l = num(rows[i].l);
    pc = num(rows[i - 1].c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
    tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    sum += tr;
    cnt++;
  }
  return cnt ? sum / cnt : NaN;
}

function hgOmniResample(rows, secPerBucket) {
  if (!rows || !rows.length) return [];
  var per = secPerBucket || 86400, out = [], cur = null, i, r, t, key;
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    t = num(r.t);
    if (!isFinite(t)) continue;
    key = Math.floor(t / per);
    if (cur && cur.key !== key) {
      out.push(cur);
      cur = null;
    }
    if (!cur) {
      cur = {
        key: key,
        t: t,
        o: num(r.o),
        h: num(r.h),
        l: num(r.l),
        c: num(r.c),
        v: num(r.v)
      };
    } else {
      cur.h = Math.max(cur.h, num(r.h));
      cur.l = Math.min(cur.l, num(r.l));
      cur.c = num(r.c);
      cur.v += num(r.v) || 0;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * P0 SOLIDITY SCORING FUNCTIONS
 */

function hgOmniOrderBlockScore(setup) {
  if (!setup || !setup.rows || setup.rows.length < 5)
    return { score: 0, detail: 'insufficient data' };
  var rows = setup.rows, plan = setup.plan;
  if (!plan || !isFinite(fin(plan.entry)))
    return { score: 0, detail: 'no plan' };

  var atr = atrOf(rows, 14);
  if (!isFinite(atr) || atr <= 0)
    return { score: 0, detail: 'ATR unavailable' };

  var entry = fin(plan.entry);
  var i, score = 0, detail = '';

  var obLevel = null;
  if (rows.length >= 5) {
    for (i = rows.length - 5; i >= Math.max(0, rows.length - 15); i--) {
      var lo = num(rows[i].l), loMinus1 = num(rows[i - 1].l), loMinus2 = num(rows[i - 2].l);
      var close1 = num(rows[i + 1].c), close2 = num(rows[i + 2].c);
      if (isFinite(lo) && isFinite(loMinus1) && isFinite(loMinus2) &&
          isFinite(close1) && isFinite(close2) &&
          lo < loMinus1 && lo < loMinus2 && close1 > lo && close2 > lo) {
        obLevel = lo;
        break;
      }
    }
    if (!obLevel) {
      for (i = rows.length - 5; i >= Math.max(0, rows.length - 15); i--) {
        var hi = num(rows[i].h), hiMinus1 = num(rows[i - 1].h), hiMinus2 = num(rows[i - 2].h);
        var close1 = num(rows[i + 1].c), close2 = num(rows[i + 2].c);
        if (isFinite(hi) && isFinite(hiMinus1) && isFinite(hiMinus2) &&
            isFinite(close1) && isFinite(close2) &&
            hi > hiMinus1 && hi > hiMinus2 && close1 < hi && close2 < hi) {
          obLevel = hi;
          break;
        }
      }
    }
  }

  if (obLevel) {
    var distFromOb = Math.abs(entry - obLevel) / atr;
    if (distFromOb <= 0.5) {
      score = 15;
      detail = 'OB at ' + obLevel.toFixed(2) + ', entry within 0.5x ATR (' + distFromOb.toFixed(2) + 'x)';
    } else if (distFromOb <= 1.0) {
      score = 10;
      detail = 'OB at ' + obLevel.toFixed(2) + ', entry within 1.0x ATR (' + distFromOb.toFixed(2) + 'x)';
    } else if (distFromOb <= 1.5) {
      score = 5;
      detail = 'OB at ' + obLevel.toFixed(2) + ', entry within 1.5x ATR (' + distFromOb.toFixed(2) + 'x)';
    } else {
      score = 0;
      detail = 'OB at ' + obLevel.toFixed(2) + ', entry beyond 1.5x ATR';
    }
  } else {
    detail = 'no recent order block detected';
  }

  return { score: score, detail: detail, maxScore: 15 };
}

function hgOmniFvgScore(setup) {
  if (!setup || !setup.rows || setup.rows.length < 4)
    return { score: 0, detail: 'insufficient data' };
  var rows = setup.rows, plan = setup.plan;
  if (!plan || !isFinite(fin(plan.entry)))
    return { score: 0, detail: 'no plan' };

  var atr = atrOf(rows, 14);
  if (!isFinite(atr) || atr <= 0)
    return { score: 0, detail: 'ATR unavailable' };

  var entry = fin(plan.entry);
  var score = 0, detail = '', fvgLevel = null;

  if (rows.length >= 4) {
    for (var i = rows.length - 4; i >= Math.max(0, rows.length - 12); i--) {
      var h1 = num(rows[i].h), l1 = num(rows[i].l);
      var h2 = num(rows[i + 1].h), l2 = num(rows[i + 1].l);
      var h3 = num(rows[i + 2].h), l3 = num(rows[i + 2].l);

      if (!isFinite(h1) || !isFinite(l1) || !isFinite(h2) || !isFinite(l2) ||
          !isFinite(h3) || !isFinite(l3)) continue;

      if (l1 > h2 && h2 < l3) {
        fvgLevel = { type: 'bullish', level: h2, top: l1 };
        break;
      }
      if (h1 < l2 && l2 > h3) {
        fvgLevel = { type: 'bearish', level: l2, bottom: h1 };
        break;
      }
    }
  }

  if (fvgLevel) {
    var fvgMid = fvgLevel.type === 'bullish' ? (fvgLevel.level + fvgLevel.top) / 2 :
      (fvgLevel.level + fvgLevel.bottom) / 2;
    var distFromFvg = Math.abs(entry - fvgMid) / atr;

    if (distFromFvg <= 1.0) {
      score = 10;
      detail = fvgLevel.type + ' FVG near ' + fvgMid.toFixed(2) + ', entry within 1x ATR (' + distFromFvg.toFixed(2) + 'x)';
    } else if (distFromFvg <= 2.0) {
      score = 5;
      detail = fvgLevel.type + ' FVG near ' + fvgMid.toFixed(2) + ', entry within 2x ATR (' + distFromFvg.toFixed(2) + 'x)';
    } else {
      score = 0;
      detail = fvgLevel.type + ' FVG exists but entry beyond 2x ATR';
    }
  } else {
    detail = 'no fresh FVG detected';
  }

  return { score: score, detail: detail, maxScore: 10 };
}

function hgOmniMultiTfCascadeScore(setup) {
  if (!setup || !setup.rows || setup.rows.length < 120)
    return { score: 0, detail: 'insufficient data' };
  var rows = setup.rows, hit = setup.hit;
  if (!hit || !hit.dir)
    return { score: 0, detail: 'no hit' };

  var direction = hit.dir;
  var agreements = 0;

  var closes = closesOf(rows);
  if (closes.length < 50) {
    return { score: 0, detail: 'insufficient closes' };
  }

  var e8 = emaOf(closes.slice(-30), 8);
  var e21 = emaOf(closes.slice(-60), 21);
  var e50 = emaOf(closes.slice(-120), 50);
  var currentLast = closes[closes.length - 1];

  var tf1hAlign = false;
  if (isFinite(e8) && isFinite(e21) && isFinite(e50) && isFinite(currentLast)) {
    if (direction === 'long') {
      tf1hAlign = (e8 >= e21 * 0.998) && (e21 >= e50 * 0.998) && (currentLast >= e8 * 0.995);
    } else {
      tf1hAlign = (e8 <= e21 * 1.002) && (e21 <= e50 * 1.002) && (currentLast <= e8 * 1.005);
    }
  }
  if (tf1hAlign) agreements++;

  var tf4h = hgOmniResample(rows, 14400);
  var tf4hAlign = false;
  if (tf4h && tf4h.length >= 50) {
    var closes4h = closesOf(tf4h);
    if (closes4h.length >= 50) {
      var e8_4h = emaOf(closes4h.slice(-30), 8);
      var e21_4h = emaOf(closes4h.slice(-60), 21);
      var e50_4h = emaOf(closes4h.slice(-120), 50);
      var last4h = closes4h[closes4h.length - 1];

      if (isFinite(e8_4h) && isFinite(e21_4h) && isFinite(e50_4h) && isFinite(last4h)) {
        if (direction === 'long') {
          tf4hAlign = (e8_4h >= e21_4h * 0.998) && (e21_4h >= e50_4h * 0.998) && (last4h >= e8_4h * 0.995);
        } else {
          tf4hAlign = (e8_4h <= e21_4h * 1.002) && (e21_4h <= e50_4h * 1.002) && (last4h <= e8_4h * 1.005);
        }
      }
    }
  }
  if (tf4hAlign) agreements++;

  var tfDaily = hgOmniResample(rows, 86400);
  var tfDailyAlign = false;
  if (tfDaily && tfDaily.length >= 50) {
    var closesDaily = closesOf(tfDaily);
    if (closesDaily.length >= 50) {
      var e8_d = emaOf(closesDaily.slice(-30), 8);
      var e21_d = emaOf(closesDaily.slice(-60), 21);
      var e50_d = emaOf(closesDaily.slice(-120), 50);
      var lastDaily = closesDaily[closesDaily.length - 1];

      if (isFinite(e8_d) && isFinite(e21_d) && isFinite(e50_d) && isFinite(lastDaily)) {
        if (direction === 'long') {
          tfDailyAlign = (e8_d >= e21_d * 0.998) && (e21_d >= e50_d * 0.998) && (lastDaily >= e8_d * 0.995);
        } else {
          tfDailyAlign = (e8_d <= e21_d * 1.002) && (e21_d <= e50_d * 1.002) && (lastDaily <= e8_d * 1.005);
        }
      }
    }
  }
  if (tfDailyAlign) agreements++;

  var score = 0, detail = '';
  if (agreements === 3) {
    score = 10;
    detail = '1H/4H/daily all agree on ' + direction;
  } else if (agreements === 2) {
    score = 7;
    detail = '2 of 3 timeframes agree on ' + direction;
  } else if (agreements === 1) {
    score = 3;
    detail = '1 of 3 timeframes agrees on ' + direction;
  } else {
    score = 0;
    detail = 'no timeframe agreement';
  }

  return { score: score, detail: detail, maxScore: 10, agreements: agreements };
}

function hgOmniRiskRewardScore(setup) {
  if (!setup || !setup.plan)
    return { score: 0, detail: 'no plan' };

  var plan = setup.plan;
  var entry = fin(plan.entry);
  var stop = fin(plan.stop);
  var t1 = fin(plan.t1);

  if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) || entry === stop) {
    return { score: 0, detail: 'incomplete plan levels' };
  }

  var risk = Math.abs(entry - stop);
  var reward = Math.abs(t1 - entry);
  var rr = risk > 0 ? reward / risk : 0;

  var baseScore = 0;
  var rrDetail = '';

  if (rr >= 2.0) {
    baseScore = 15;
    rrDetail = 'R:R ' + rr.toFixed(2) + ' >= 2.0';
  } else if (rr >= 1.5) {
    baseScore = 12;
    rrDetail = 'R:R ' + rr.toFixed(2) + ' >= 1.5';
  } else if (rr >= 1.0) {
    baseScore = 8;
    rrDetail = 'R:R ' + rr.toFixed(2) + ' >= 1.0';
  } else {
    baseScore = 0;
    rrDetail = 'R:R ' + rr.toFixed(2) + ' < 1.0';
  }

  var stopPct = (risk / entry) * 100;
  var bonusScore = 0, bonusDetail = '';

  if (stopPct < 1.0) {
    bonusScore = 5;
    bonusDetail = ' + 5pt tight stop bonus (' + stopPct.toFixed(2) + '%)';
  } else if (stopPct < 1.5) {
    bonusScore = 3;
    bonusDetail = ' + 3pt stop precision bonus (' + stopPct.toFixed(2) + '%)';
  }

  var totalScore = Math.min(baseScore + bonusScore, 20);
  var detail = rrDetail + (bonusDetail || '') + (bonusScore > 0 ? ' total=' + totalScore : '');

  return { score: totalScore, detail: detail, maxScore: 20, rr: rr, stopPct: stopPct };
}

function hgOmniSolidityScore(setup) {
  if (!setup)
    return { score: 0, maxScore: 200, breakdown: {}, detail: 'no setup' };

  var ob = hgOmniOrderBlockScore(setup);
  var fvg = hgOmniFvgScore(setup);
  var mtf = hgOmniMultiTfCascadeScore(setup);
  var rr = hgOmniRiskRewardScore(setup);

  var totalScore = ob.score + fvg.score + mtf.score + rr.score;
  var maxStructuralScore = (ob.maxScore || 15) + (fvg.maxScore || 10) +
    (mtf.maxScore || 10) + (rr.maxScore || 20);

  return {
    score: totalScore,
    maxScore: maxStructuralScore,
    breakdown: {
      orderBlock: { score: ob.score, maxScore: ob.maxScore || 15, detail: ob.detail },
      fvg: { score: fvg.score, maxScore: fvg.maxScore || 10, detail: fvg.detail },
      multiTfCascade: { score: mtf.score, maxScore: mtf.maxScore || 10, detail: mtf.detail, agreements: mtf.agreements },
      riskReward: { score: rr.score, maxScore: rr.maxScore || 20, detail: rr.detail, rr: rr.rr }
    },
    detail: 'OB:' + ob.score + '/' + (ob.maxScore || 15) +
      ' FVG:' + fvg.score + '/' + (fvg.maxScore || 10) +
      ' MTF:' + mtf.score + '/' + (mtf.maxScore || 10) +
      ' RR:' + rr.score + '/' + (rr.maxScore || 20)
  };
}

/**
 * RUN TEST
 */
console.log('='.repeat(80));
console.log('P0 OMNIROUTE SOLIDITY FRAMEWORK TEST');
console.log('='.repeat(80));
console.log('\nSetup Details:');
console.log('  Kind: ' + testSetup.kind);
console.log('  Direction: ' + testSetup.dir);
console.log('  Entry: ' + testSetup.plan.entry);
console.log('  Stop: ' + testSetup.plan.stop);
console.log('  Target: ' + testSetup.plan.t1);
console.log('  Risk: ' + Math.abs(testSetup.plan.entry - testSetup.plan.stop).toFixed(2));
console.log('  Reward: ' + Math.abs(testSetup.plan.t1 - testSetup.plan.entry).toFixed(2));
console.log('  R:R: ' + (Math.abs(testSetup.plan.t1 - testSetup.plan.entry) / Math.abs(testSetup.plan.entry - testSetup.plan.stop)).toFixed(2));
console.log('  Bars: ' + testSetup.rows.length);

const atr = atrOf(testSetup.rows, 14);
console.log('  ATR(14): ' + atr.toFixed(4));

console.log('\n' + '='.repeat(80));
console.log('SCORING BREAKDOWN (50 POINTS TOTAL)');
console.log('='.repeat(80));

// Run individual scorers
const obScore = hgOmniOrderBlockScore(testSetup);
const fvgScore = hgOmniFvgScore(testSetup);
const mtfScore = hgOmniMultiTfCascadeScore(testSetup);
const rrScore = hgOmniRiskRewardScore(testSetup);

console.log('\n1. ORDER BLOCKS DETECTION (P0-1) — 15pts max');
console.log('   Score: ' + obScore.score + '/' + obScore.maxScore);
console.log('   Detail: ' + obScore.detail);

console.log('\n2. FVG (FAIR VALUE GAP) (P0-2) — 10pts max');
console.log('   Score: ' + fvgScore.score + '/' + fvgScore.maxScore);
console.log('   Detail: ' + fvgScore.detail);

console.log('\n3. MULTI-TF EMA CASCADE (P0-3) — 10pts max');
console.log('   Score: ' + mtfScore.score + '/' + mtfScore.maxScore);
console.log('   Detail: ' + mtfScore.detail);
if (mtfScore.agreements !== undefined) {
  console.log('   Timeframe Agreements: ' + mtfScore.agreements + '/3');
}

console.log('\n4. RISK:REWARD GEOMETRY (P0-4) — 20pts max (15 base + 5 bonus)');
console.log('   Score: ' + rrScore.score + '/' + rrScore.maxScore);
console.log('   Detail: ' + rrScore.detail);
if (rrScore.rr !== undefined) {
  console.log('   R:R Ratio: ' + rrScore.rr.toFixed(2));
  console.log('   Stop %: ' + rrScore.stopPct.toFixed(2) + '%');
}

// Run composite scorer
const solidityScore = hgOmniSolidityScore(testSetup);

console.log('\n' + '='.repeat(80));
console.log('TOTAL STRUCTURAL PILLAR SCORE');
console.log('='.repeat(80));
console.log('Score: ' + solidityScore.score + ' / ' + solidityScore.maxScore + ' points');
console.log('Percentage: ' + ((solidityScore.score / solidityScore.maxScore) * 100).toFixed(1) + '%');
console.log('Summary: ' + solidityScore.detail);

console.log('\n' + '='.repeat(80));
console.log('PILLAR CONTRIBUTION ANALYSIS');
console.log('='.repeat(80));
const br = solidityScore.breakdown;
const contributions = [
  { name: 'Order Blocks', score: br.orderBlock.score, max: br.orderBlock.maxScore },
  { name: 'FVG Detection', score: br.fvg.score, max: br.fvg.maxScore },
  { name: 'Multi-TF Cascade', score: br.multiTfCascade.score, max: br.multiTfCascade.maxScore },
  { name: 'Risk:Reward', score: br.riskReward.score, max: br.riskReward.maxScore }
];

contributions.forEach(function (c) {
  var pct = c.max > 0 ? ((c.score / c.max) * 100).toFixed(0) : '0';
  var bar = '█'.repeat(Math.round(c.score / 2)) + '░'.repeat(Math.round((c.max - c.score) / 2));
  console.log('  ' + c.name.padEnd(20) + ': ' + String(c.score).padEnd(2) + '/' + c.max +
    ' (' + pct.padStart(3) + '%) ' + bar);
});

console.log('\n' + '='.repeat(80));
console.log('EXPORT: These scoring functions can now be called from rendering layers');
console.log('  window.hgOmniOrderBlockScore(setup)');
console.log('  window.hgOmniFvgScore(setup)');
console.log('  window.hgOmniMultiTfCascadeScore(setup)');
console.log('  window.hgOmniRiskRewardScore(setup)');
console.log('  window.hgOmniSolidityScore(setup)  // returns full breakdown');
console.log('='.repeat(80));
