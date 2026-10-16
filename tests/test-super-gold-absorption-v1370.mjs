
/* ==========================================================================
   HARDGATE — test-super-gold-v1370.mjs
   Automated verification suite for Super Gold hg-v1370 Order-Flow Absorption,
   PDH/PDL/PDM & Power-of-Three (AMD) Benchmarks, Adaptive Tranche Weighting &
   Execution Readiness Radar:
   1. Order-Flow Wick Absorption & CLV (sgDetectMicrostructureZones):
      - absorptionDetected, wickRejectionScore, and clvScore
   2. Previous-Day High/Low/Mid (PDH/PDL/PDM) & Power-of-Three (AMD)
      Benchmark Engine (sgDailyBenchmarkLevels):
      - PDL_SWEEP_RECLAIM and MANIPULATION_JUDAS_RAID detection
   3. Adaptive Split-Tranche Weighting (70/30 on high-absorption NORMAL vol vs
      45/55 on EXPANSION vol) in sgPrecisionGoldLevels
   4. Setup Execution Readiness & Trigger Proximity Radar (sgSetupExecutionRadar)
   ========================================================================== */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');

function createHarness(overrides = {}) {
  const now = Date.now();
  // Construct 30 15m bars:
  // - First 15 bars establish prior range: PDL = 2644.0, PDH = 2656.0, PDM = 2650.0
  // - Bar 18 sweeps below PDL (2644.0) down to 2642.2 and closes at 2646.5 (PDL_SWEEP_RECLAIM)
  // - Bar 28 prints a deep bullish hammer rejection wick (o: 2653.5, l: 2649.0, h: 2655.0, c: 2654.6) -> absorptionDetected = true, high wickRejectionScore
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i < 15) {
      return { t, o: 2648.0, h: 2656.0, l: 2644.0, c: 2650.0, v: 1100 };
    }
    if (i === 18) {
      return { t, o: 2645.0, h: 2647.0, l: 2642.2, c: 2646.5, v: 2600 };
    }
    if (i === 24) {
      return { t, o: 2649.8, h: 2650.0, l: 2648.0, c: 2648.2, v: 1500 };
    }
    if (i === 25) {
      return { t, o: 2648.2, h: 2655.5, l: 2648.1, c: 2655.0, v: 3500 };
    }
    if (i === 28) {
      // Bullish hammer with 4.5 pt lower wick in 6.0 pt range (75% lower wick) closing near high
      return { t, o: 2653.5, h: 2655.0, l: 2649.0, c: 2654.6, v: 2900 };
    }
    return {
      t,
      o: 2651.0,
      h: 2655.2,
      l: 2650.5,
      c: 2654.8,
      v: 1400
    };
  });

  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({
        aligned: 'BULL', bull: 5, bear: 0, why: '5/5 BULL',
        rows: [
          { tf: '5m', dir: 'BULL' },
          { tf: '15m', dir: 'BULL' },
          { tf: '1h', dir: 'BULL' },
          { tf: '4h', dir: 'BULL' },
          { tf: '1d', dir: 'BULL' }
        ]
      }),
      volRegime: () => ({ ok: true, regime: 'NORMAL', label: 'NORMAL (ATR 4.0)', atrNow: 4.0 }),
      forecastCone: () => ({ ok: true, why: '3-bar cone', steps: [{ bar: 1, low: 2650, high: 2666 }] }),
      structure: () => ({ ok: true, items: [{ label: '15m OB', px: 2650.0 }, { label: '4H Supply Wall', px: 2672.0 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2654.8 }),
    goldspotState: () => ({ spot: 2654.8, xm: 2654.6, paxg: 2654.5 }),
    getGoldMacroCached: () => ({ realRateHint: 'TAILWIND' }),
    goldscalpScan: () => ({
      at: now,
      cands: [{
        id: 'scalp-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2670.0, rr: 1.9,
        mark: 2651.2, killzone: 'NY_OPEN',
        barT: Math.floor((now - 900_000) / 1000),
        strategy: 'Judas Sweep Long'
      }]
    }),
    goldswingScan: () => ({
      at: now,
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2678.0, t2: 2692.0, rr: 2.6,
        mark: 2651.2, killzone: 'NY_OPEN',
        barT: Math.floor((now - 900_000) / 1000),
        strategy: 'GS1 4H Cascade'
      }]
    }),
    ...overrides
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  return { win, baseRows15, now };
}

async function runTests() {
  const { win, baseRows15 } = createHarness();
  win.getGoldCandles = async () => ({ rows: baseRows15 });
  await win.superGoldRunScan({ force: true });
  const snap = win.superGoldScan();

  // 1. Verify Order-Flow Absorption, Wick-Rejection Score & CLV in sgDetectMicrostructureZones
  const micro = win.sgDetectMicrostructureZones(baseRows15, 'long');
  assert.equal(micro.ok, true);
  assert.equal(micro.absorptionDetected, true, 'Bullish hammer rejection bar should trigger absorptionDetected = true');
  assert.ok(micro.wickRejectionScore >= 65, `Expected wickRejectionScore >= 65, got ${micro.wickRejectionScore}`);
  assert.ok(micro.clvScore > 0.5, `Expected positive CLV > 0.5, got ${micro.clvScore}`);
  console.log('PASS 1: sgDetectMicrostructureZones (Order-Flow Absorption, Wick-Rejection Score & CLV)');

  // 2. Verify Previous-Day High/Low/Mid (PDH/PDL/PDM) & Power-of-Three (AMD) Benchmark Engine
  const crowned = win.sgCrownedRow(snap);
  assert.ok(crowned);
  const top = crowned.row;
  assert.ok(top.dailyBenchmarks && top.dailyBenchmarks.ok);
  assert.equal(top.dailyBenchmarks.pdl, 2644.0);
  assert.equal(top.dailyBenchmarks.pdh, 2656.0);
  assert.equal(top.dailyBenchmarks.pdm, 2650.0);
  assert.equal(top.dailyBenchmarks.benchmarkState, 'PDL_SWEEP_RECLAIM');
  assert.equal(top.dailyBenchmarks.amdPhase, 'MANIPULATION_JUDAS_RAID');
  console.log('PASS 2: sgDailyBenchmarkLevels (PDH/PDL/PDM & MANIPULATION_JUDAS_RAID)');

  // 3. Verify Adaptive Split-Tranche Weighting (70/30 on high-absorption NORMAL vol vs 45/55 on EXPANSION vol)
  assert.equal(top.precision.entryTranches[0].weightPct, 70, 'High-absorption NORMAL regime should allocate 70% to Tranche 1');
  assert.equal(top.precision.entryTranches[1].weightPct, 30, 'High-absorption NORMAL regime should allocate 30% to Tranche 2');
  const expPrec = win.sgPrecisionGoldLevels(top, {
    ...snap.intel,
    volRegime: { ok: true, regime: 'EXPANSION', atrNow: 4.0 }
  });
  assert.equal(expPrec.entryTranches[0].weightPct, 45, 'EXPANSION regime should shift to 45% Tranche 1 / 55% Tranche 2');
  assert.equal(expPrec.entryTranches[1].weightPct, 55);
  console.log('PASS 3: Adaptive Split-Tranche Weighting (70/30 High-Absorption vs 45/55 Expansion)');

  // 4. Verify Setup Execution Readiness & Trigger Proximity Radar (sgSetupExecutionRadar)
  assert.ok(top.executionRadar && top.executionRadar.ok);
  assert.ok(top.executionRadar.distToEntryAtr <= 0.35, `Expected distToEntryAtr <= 0.35, got ${top.executionRadar.distToEntryAtr}`);
  assert.ok(top.executionRadar.fillProbabilityPct >= 85, `Expected fillProbabilityPct >= 85%, got ${top.executionRadar.fillProbabilityPct}%`);
  assert.ok(top.executionRadar.actionDirective.includes('IMMINENT FILL'), `Expected IMMINENT FILL directive, got ${top.executionRadar.actionDirective}`);
  console.log('PASS 4: sgSetupExecutionRadar (Trigger Proximity, Fill Probability % & Action Directive)');

  console.log('ALL hg-v1370 SUPER GOLD ABSORPTION, BENCHMARKS & EXECUTION RADAR TESTS PASSED');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

