/* hg-v1373 Gold Scalp Deep Setup Formation & Micro-Orderflow Engine */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.parse('2026-10-15T14:30:00Z'); // 14:30 UTC = NY Open + ICT Silver Bullet window
  // 30 15m bars with POC near 2650.0, bullish OB + FVG + IFVG + hammer wick absorption
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i < 15) {
      return { t, o: 2649.5, h: 2651.2, l: 2648.8, c: 2650.1, v: 4200 };
    }
    if (i === 18) {
      return { t, o: 2645.0, h: 2647.0, l: 2642.2, c: 2646.5, v: 2600 };
    }
    if (i === 20) {
      return { t, o: 2652.0, h: 2652.5, l: 2650.8, c: 2651.0, v: 1300 };
    }
    if (i === 21) {
      return { t, o: 2650.8, h: 2651.0, l: 2648.2, c: 2648.4, v: 1400 };
    }
    if (i === 22) {
      // Bearish FVG [2649.2..2650.8] later reclaimed upward by bar 25 -> Bullish IFVG (CE = 2650.0)
      return { t, o: 2648.4, h: 2649.2, l: 2647.8, c: 2648.1, v: 1200 };
    }
    if (i === 24) {
      return { t, o: 2649.8, h: 2650.0, l: 2648.0, c: 2648.2, v: 1500 };
    }
    if (i === 25) {
      return { t, o: 2648.2, h: 2655.5, l: 2648.1, c: 2655.0, v: 3500 };
    }
    if (i === 28) {
      return { t, o: 2653.5, h: 2655.0, l: 2649.0, c: 2654.6, v: 2900 };
    }
    return {
      t,
      o: 2650.0,
      h: 2653.5,
      l: 2649.2,
      c: 2652.8,
      v: 1800
    };
  });
  // 30 5m bars with ORB in first 6 bars, followed by sweep & bullish CVD accumulation + unmitigated 5m FVG
  const baseRows5 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 300_000) / 1000);
    if (i < 6) {
      // Opening Range: ORB Low = 2646.0, ORB High = 2648.5
      return { t, o: 2646.8, h: 2648.5, l: 2646.0, c: 2647.4, v: 1100 };
    }
    if (i === 8) {
      // Sweep below ORB Low to 2645.2 and close back inside ORB at 2647.2
      return { t, o: 2646.5, h: 2647.5, l: 2645.2, c: 2647.2, v: 2200 };
    }
    if (i === 24) {
      return { t, o: 2649.6, h: 2650.2, l: 2649.1, c: 2650.0, v: 950 };
    }
    if (i === 25) {
      return { t, o: 2650.0, h: 2652.6, l: 2649.9, c: 2652.4, v: 2400 };
    }
    if (i === 26) {
      return { t, o: 2652.2, h: 2653.2, l: 2651.0, c: 2652.9, v: 1800 };
    }
    if (i === 28) {
      // Deep lower wick rejection bar on 5m with strong high close (CVD absorption)
      return { t, o: 2651.8, h: 2653.0, l: 2649.2, c: 2652.8, v: 2600 };
    }
    const base = 2647.0 + (i - 6) * 0.25;
    return {
      t,
      o: +(base - 0.25).toFixed(2),
      h: +(base + 0.45).toFixed(2),
      l: +(base - 0.35).toFixed(2),
      c: +(base + 0.30).toFixed(2),
      v: 1200
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
      structure: () => ({ ok: true, items: [{ label: '15m OB', px: 2650.0 }, { label: '15m Supply Wall', px: 2662.0 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2652.8 }),
    goldspotState: () => ({ spot: 2652.8, xm: 2652.5, paxg: 2651.9 }),
    getGoldMacroCached: () => ({ realRateHint: 'TAILWIND' }),
    goldscalpScan: () => ({
      at: now,
      armed: [
        { strategy: '5m FVG Reload Watch', level: 2650.6, dir: 'long' }
      ],
      cands: [
        {
          id: 'scalp-judas-1', sym: 'XAUUSD', dir: 'long', grade: 'B',
          entry: 2650.5, stop: 2645.0, t1: 2661.8, rr: 2.05,
          mark: 2651.2, killzone: 'NY_OPEN',
          barT: Math.floor(now / 1000),
          rows15m: baseRows15,
          rows5m: baseRows5,
          strategy: 'Judas Sweep Long'
        },
        {
          id: 'scalp-sb-2', sym: 'XAUUSD', dir: 'long', grade: 'B',
          entry: 2650.8, stop: 2646.0, t1: 2660.0, rr: 1.92,
          mark: 2651.2, killzone: 'NY_OPEN',
          barT: Math.floor(now / 1000),
          rows15m: baseRows15,
          rows5m: baseRows5,
          strategy: 'Silver Bullet FVG Pullback'
        }
      ]
    }),
    goldswingScan: () => ({
      at: now,
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2678.0, t2: 2692.0, rr: 2.6,
        mark: 2651.2, killzone: 'NY_OPEN',
        barT: Math.floor(now / 1000),
        strategy: 'GS1 4H Cascade'
      }]
    }),
    ...overrides
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  return { win, baseRows15, baseRows5, now };
}
async function runTests() {
  const { win, baseRows15, baseRows5 } = createHarness();
  win.getGoldCandles = async (tf) => ({ rows: tf === '5m' ? baseRows5 : baseRows15 });
  await win.superGoldRunScan({ force: true });
  const gsSnap = win.goldscalpScan();
  assert.equal(gsSnap.hgUpgradedVersion, 'hg-v1373');
  assert.equal(gsSnap.oneGoUpgraded, true);
  assert.ok(gsSnap.scalpSummary.topVelocityRPerHour > 0, 'Scalp summary should include topVelocityRPerHour');
  const judasCand = gsSnap.cands.find(c => c.id === 'scalp-judas-1');
  assert.ok(judasCand);
  // 1. Verify 5m/15m Cumulative Volume Delta (CVD), Absorption & Trap Reversal Engine (sgGoldScalpOrderFlowEngine)
  const oflow = judasCand.scalpOrderFlow;
  assert.ok(oflow && oflow.ok, 'Candidate should carry scalpOrderFlow');
  assert.equal(oflow.cvdTrend, 'BULL_ACCUMULATION');
  assert.equal(oflow.cvdAligned, true);
  assert.ok(oflow.cvdDeltaScore >= 70, `Expected cvdDeltaScore >= 70, got ${oflow.cvdDeltaScore}`);
  assert.ok(oflow.trapReversalScore >= 70, `Expected trapReversalScore >= 70, got ${oflow.trapReversalScore}`);
  console.log('PASS 1: sgGoldScalpOrderFlowEngine (5m/15m CVD Pressure, Absorption & Trap Reversal Score)');
  // 2. Verify Session Opening Range (ORB) & 5m Micro-Liquidity Pool Mapper (sgGoldScalpSessionPools)
  const pools = judasCand.scalpPools;
  assert.ok(pools && pools.ok, 'Candidate should carry scalpPools');
  assert.equal(pools.orbLow, 2646.0);
  assert.equal(pools.orbHigh, 2648.5);
  assert.equal(pools.orbState, 'ORB_SWEEP_RECLAIM_LONG');
  assert.ok(pools.nextPoolPx > 2650.0, 'Should map next opposing 5m liquidity pool above entry');
  console.log('PASS 2: sgGoldScalpSessionPools (ORB High/Low/Mid, ORB_SWEEP_RECLAIM_LONG & Next Pool Target)');
  // 3. Verify 3-Ladder Micro-Limit Matrix (50/35/15) & 5m Candle-Close Soft Invalidation (-0.55R)
  const sb = judasCand.scalpPrecision;
  assert.ok(Array.isArray(sb.microLadder) && sb.microLadder.length === 3, 'Should build 3-rung micro-limit ladder');
  assert.equal(sb.microLadder[0].weightPct, 50);
  assert.equal(sb.microLadder[1].weightPct, 35);
  assert.equal(sb.microLadder[2].weightPct, 15);
  assert.ok(sb.softInvalidationPx > sb.stop && sb.softInvalidationPx < sb.entry, 'Soft invalidation (-0.55R) must sit between entry and hard SL');
  assert.ok(sb.softInvalidationRule.includes('-0.55R'));
  console.log('PASS 3: sgRefineGoldScalpBracket (3-Ladder 50/35/15 Micro-Limit Matrix & -0.55R Soft Invalidation)');
  // 4. Verify Gold Scalp Capital Velocity & Soft-Invalidation Expectancy Profiler (sgGoldScalpVelocityProfile)
  const vel = judasCand.scalpVelocity;
  assert.ok(vel && vel.ok, 'Candidate should carry scalpVelocity');
  assert.ok(vel.estMinutesToTp1 >= 5 && vel.estMinutesToTp1 <= 45, `Expected estMinutesToTp1 in 5..45m, got ${vel.estMinutesToTp1}`);
  assert.ok(vel.velocityAdjustedEvR > judasCand.scalpEnhancement.netExpectedValueR, 'Soft invalidation should boost velocity-adjusted E[R]');
  assert.ok(vel.rPerHourVelocity >= 2.0, `Expected rPerHourVelocity >= 2.0 R/hr, got ${vel.rPerHourVelocity}`);
  console.log('PASS 4: sgGoldScalpVelocityProfile (Minutes-to-TP1, Velocity-Adjusted E[R] & R/Hour Velocity)');
  // 5. Verify 4-Vector Autonomous Gold Scalp Setup Synthesizer (sgSynthesizeGoldScalpSetups)
  const synthSetups = win.sgSynthesizeGoldScalpSetups(win.superGoldScan().intel, { balance: 10000, riskPct: 1 }, win);
  assert.equal(synthSetups.length, 4, `Expected 4 distinct synthesized scalp vectors, got ${synthSetups.length}`);
  assert.ok(synthSetups.every(s => s.scalpEnhancement && s.scalpEnhancement.version === 'hg-v1373'));
  console.log('PASS 5: sgSynthesizeGoldScalpSetups (4-Vector Autonomous 5m/15m Gold Scalp Synthesis)');
  console.log('ALL hg-v1373 GOLD SCALP TAB DEEP SETUP FORMATION & MICRO-ORDERFLOW TESTS PASSED');
}
runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
