#!/usr/bin/env node
/**
 * P5 SOLIDITY FRAMEWORK TEST — THE FINAL 24 POINTS
 * Tests all three P5 scoring functions with realistic sample data.
 *
 * P5 adds 24 points to the framework (8 + 10 + 6):
 *   - Sector + Market Momentum Alignment (8 pts)
 *   - Multi-Asset Macro Confirmation (10 pts)
 *   - News / Calendar Blackout (6 pts)
 *
 * Framework total: 200 pts — COMPLETE (was 176 pts in P0-P4)
 *
 * Unlike earlier phase tests, this one extracts the REAL P5 section out of
 * omniroute.js and executes it under node, so what is tested is the shipped
 * code, not a transcription of it.
 *
 * Usage:
 *   node test_p5_solidity.js
 *   Or load in browser: omniroute.js + call hgOmniSolidityScore(testSetup)
 */

var fs = require('fs');
var path = require('path');

/* ---------- helpers the P5 section depends on (verbatim from omniroute.js) ---------- */
function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
function fin(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}
function emaOf(vals, n){
  if (!vals || vals.length < n || n <= 0) return NaN;
  var k = 2 / (n + 1), e = vals[0], i;
  for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}
function closesOf(rows){
  var out = [], i, c;
  for (i = 0; i < rows.length; i++){ c = num(rows[i].c); if (isFinite(c)) out.push(c); }
  return out;
}

/* ---------- extract the P5 section from omniroute.js and evaluate it ---------- */
var src = fs.readFileSync(path.join(__dirname, '..', '..', 'omniroute.js'), 'utf8');
var startMark = 'P5 SOLIDITY FRAMEWORK (24 pts total)';
var endMark = 'end P5 solidity framework';
var startIdx = src.indexOf(startMark);
var endIdx = src.indexOf(endMark);
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx){
  console.error('FATAL: could not locate the P5 section markers in omniroute.js');
  process.exit(1);
}
var section = src.slice(startIdx + startMark.length, endIdx);
/* trim the trailing open-comment before the end marker */
section = section.replace(/\/\*\s*=*\s*$/, '');
/* drop the leading remainder of the header comment line */
section = section.slice(section.indexOf('*/') + 2);

/* DAILY_FAST/DAILY_SLOW live near the top of omniroute.js (outside the P5
   section) — the sector source label references them, so mirror them here */
var factory = new Function('num', 'fin', 'emaOf', 'closesOf', 'DAILY_FAST', 'DAILY_SLOW', section +
  '\nreturn { hgOmniSectorMomentumScore: hgOmniSectorMomentumScore,' +
  ' hgOmniMultiAssetScore: hgOmniMultiAssetScore,' +
  ' hgOmniNewsCalendarScore: hgOmniNewsCalendarScore };');
var P5 = factory(num, fin, emaOf, closesOf, 10, 21);

/* ---------- synthetic rows ---------- */
function generateTrendRows(count, upward){
  var rows = [], price = 100, i;
  for (i = 0; i < count; i++){
    var drift = (upward ? 0.15 : -0.15) + (Math.sin(i * 1.7) * 0.05);
    var o = price, c = price + drift;
    var h = Math.max(o, c) + 0.3, l = Math.min(o, c) - 0.3;
    rows.push({ t: 1000000 + i * 14400, o: o, h: h, l: l, c: c, v: 1000 + i });
    price = c;
  }
  return rows;
}

/* ---------- scenarios ---------- */
var results = [];
function check(name, got, expected, detail){
  var pass = (got >= expected[0] && got <= expected[1]);
  results.push({ name: name, got: got, expected: expected, pass: pass });
  console.log('  ' + (pass ? 'PASS' : 'FAIL') + '  ' + name + ': ' + got + ' pts (expected ' +
              (expected[0] === expected[1] ? expected[0] : expected[0] + '-' + expected[1]) + ')');
  if (detail) console.log('        detail: ' + detail);
}

console.log('='.repeat(90));
console.log('P5 SOLIDITY FRAMEWORK TEST SUITE — THE FINAL 24 POINTS');
console.log('='.repeat(90));

/* =========================================================================
   SCENARIO 1: FULL MACRO ALIGNMENT
   Long setup: sector trend up (daily EMA21 > EMA50), market RISK-ON,
   BTC RISK-ON, negative funding (shorts pay — contrarian long support),
   OI rising +6% with upward price drift, no calendar loaded (defaults clear).
   Expected: SECTOR 8, ASSET 10, NEWS 6 → P5 total 24/24.
   ========================================================================= */
console.log('\nSCENARIO 1: Full Macro Alignment (long, everything confirms)');
console.log('-'.repeat(90));
var setup1 = {
  hit: { kind: 'SPRING', dir: 'long', level: 100 },
  rows: generateTrendRows(80, true),
  btcRegime: { label: 'RISK-ON', source: 'btc-daily-proxy' },
  positioning: { fundingPct: -0.02 },
  extra: {
    htf: { e21: 105.2, e50: 101.4 },
    regime: { label: 'RISK-ON', source: 'regime.js' },
    oi: { changePct: 6.0 }
    /* no news, no redFlagNews: calendar defaults clear */
  }
};
var s1 = P5.hgOmniSectorMomentumScore(setup1);
var a1 = P5.hgOmniMultiAssetScore(setup1);
var n1 = P5.hgOmniNewsCalendarScore(setup1);
check('SECTOR (both tides aligned)', s1.score, [8, 8], s1.detail);
check('ASSET (3/3 macro aligned)', a1.score, [10, 10], a1.detail);
check('NEWS (no calendar — defaults clear)', n1.score, [6, 6], n1.detail);
check('P5 total', s1.score + a1.score + n1.score, [24, 24]);

/* =========================================================================
   SCENARIO 2: PARTIAL CONFIRMATION
   Long setup: sector trend up but market regime MIXED (sector aligned,
   market neutral → 5). No BTC read on the setup — the generic 8-gauge
   regime (source 'regime.js') must NOT be borrowed as the BTC leg (P5.1
   already scores it), so BTC reads n/a. Funding +0.02% (longs pay —
   against a long), OI rising with upward drift (aligned) → 1/3 → 4.
   Calendar shows a medium event more than 1 hour away → 3.
   Expected: SECTOR 5, ASSET 4, NEWS 3 → P5 total 12/24.
   ========================================================================= */
console.log('\nSCENARIO 2: Partial Confirmation (long, mixed macro picture)');
console.log('-'.repeat(90));
var setup2 = {
  hit: { kind: 'ORB', dir: 'long', level: 100 },
  rows: generateTrendRows(80, true),
  positioning: { fundingPct: 0.02 },
  extra: {
    htf: { e21: 104.0, e50: 102.5 },
    regime: { label: 'MIXED', source: 'regime.js' },
    oi: { changePct: 5.0 },
    news: { risk: 'med', blackout: false, events: [], note: 'high-impact USD event in 5h: CPI' }
  }
};
var s2 = P5.hgOmniSectorMomentumScore(setup2);
var a2 = P5.hgOmniMultiAssetScore(setup2);
var n2 = P5.hgOmniNewsCalendarScore(setup2);
check('SECTOR (sector aligned, market neutral)', s2.score, [5, 5], s2.detail);
check('ASSET (1/3 macro aligned)', a2.score, [4, 4], a2.detail);
check('ASSET BTC leg n/a (8-gauge regime NOT double-counted)',
      a2.detail.indexOf('BTC:n/a') >= 0 ? 1 : 0, [1, 1], a2.detail);
check('NEWS (medium event >1h away)', n2.score, [3, 3], n2.detail);
check('P5 total', s2.score + a2.score + n2.score, [12, 12]);

/* =========================================================================
   SCENARIO 3: NEWS BLACKOUT
   Short setup fighting a RISK-ON tape with an FOMC decision 15 minutes out.
   Sector up + market RISK-ON, trade short → against both → 0.
   BTC RISK-ON vs short (against), funding -0.03 vs short (against),
   OI falling (flat, no vote) → 0/3 → 0.
   redFlagNews: FOMC Rate Decision in 15 min → 0.
   Expected: SECTOR 0, ASSET 0, NEWS 0 → P5 total 0/24.
   ========================================================================= */
console.log('\nSCENARIO 3: News Blackout (short into FOMC, against every tide)');
console.log('-'.repeat(90));
var setup3 = {
  hit: { kind: 'MMOVE', dir: 'short', level: 100 },
  rows: generateTrendRows(80, true),
  btcRegime: { label: 'RISK-ON', source: 'btc-daily-proxy' },
  positioning: { fundingPct: -0.03 },
  extra: {
    htf: { e21: 106.0, e50: 102.0 },
    regime: { label: 'RISK-ON', source: 'regime.js' },
    oi: { changePct: -1.0 },
    redFlagNews: { minutesUntil: 15, event: 'FOMC Rate Decision' }
  }
};
var s3 = P5.hgOmniSectorMomentumScore(setup3);
var a3 = P5.hgOmniMultiAssetScore(setup3);
var n3 = P5.hgOmniNewsCalendarScore(setup3);
check('SECTOR (against both tides)', s3.score, [0, 0], s3.detail);
check('ASSET (0/3 macro aligned)', a3.score, [0, 0], a3.detail);
check('NEWS (FOMC-class event in 15min → blackout)', n3.score, [0, 0], n3.detail);
check('P5 total', s3.score + a3.score + n3.score, [0, 0]);

/* =========================================================================
   GRACEFUL DEGRADATION: bare setups must never throw and never veto
   ========================================================================= */
console.log('\nGRACEFUL DEGRADATION: empty / bare setups');
console.log('-'.repeat(90));
var bare = { hit: { kind: 'X', dir: 'long' } };
check('SECTOR (no data)', P5.hgOmniSectorMomentumScore(bare).score, [0, 0]);
check('ASSET (no data)', P5.hgOmniMultiAssetScore(bare).score, [0, 0]);
check('NEWS (no data — defaults clear)', P5.hgOmniNewsCalendarScore(bare).score, [6, 6]);
check('SECTOR (null setup)', P5.hgOmniSectorMomentumScore(null).score, [0, 0]);
check('ASSET (null setup)', P5.hgOmniMultiAssetScore(null).score, [0, 0]);
check('NEWS (null setup — defaults clear)', P5.hgOmniNewsCalendarScore(null).score, [6, 6]);

/* ---------- framework summary ---------- */
console.log('\n' + '='.repeat(90));
console.log('FRAMEWORK SUMMARY — COMPLETE AT 200 POINTS (18 PILLARS)');
console.log('='.repeat(90));
console.log('\nP0 (55 pts):');
console.log('   1. Order Block Quality ............ 15 pts');
console.log('   2. Fair Value Gap ................. 10 pts');
console.log('   3. Multi-TF EMA Cascade ........... 10 pts');
console.log('   4. Risk:Reward .................... 20 pts');
console.log('P1 (25 pts):');
console.log('   5. Regime Classification .......... 10 pts');
console.log('   6. ATR Expansion ..................  8 pts');
console.log('   7. Session Timing .................  7 pts');
console.log('P2 (20 pts):');
console.log('   8. Liquidation Map ................ 12 pts');
console.log('   9. Expectancy / Statistical Edge ..  8 pts');
console.log('P3 (39 pts):');
console.log('  10. Order Flow Confluence .......... 12 pts');
console.log('  11. Structural Confluence .......... 15 pts');
console.log('  12. Momentum Convergence ........... 12 pts');
console.log('P4 (37 pts):');
console.log('  13. Liquidation Recovery ........... 12 pts');
console.log('  14. Vol Term Structure ............. 10 pts');
console.log('  15. Risk-Adjusted Sizing ........... 15 pts');
console.log('P5 (24 pts) — FINAL:');
console.log('  16. Sector + Market Momentum .......  8 pts');
console.log('  17. Multi-Asset Confirmation ....... 10 pts');
console.log('  18. News / Calendar Blackout .......  6 pts');
console.log('\nTOTAL: 200 POINTS');
console.log('\nTier Mapping (200-point scale):');
console.log('  170+ pts    -> extremely_solid');
console.log('  140-169 pts -> solid');
console.log('  105-139 pts -> fair');
console.log('  <105 pts    -> weak');

/* ---------- verdict ---------- */
var failed = results.filter(function(r){ return !r.pass; });
console.log('\n' + '='.repeat(90));
console.log('RESULT: ' + (results.length - failed.length) + '/' + results.length + ' checks passed' +
            (failed.length ? ' — ' + failed.length + ' FAILED' : ' — ALL GREEN'));
console.log('='.repeat(90));
console.log('\nBrowser exports:');
console.log('  window.hgOmniSectorMomentumScore(setup)');
console.log('  window.hgOmniMultiAssetScore(setup)');
console.log('  window.hgOmniNewsCalendarScore(setup)');
console.log('  window.hgOmniSolidityScore(setup)  // full 18-pillar, 200-pt breakdown');
if (failed.length) process.exit(1);
