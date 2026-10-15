import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.now();
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i < 10) {
      return { t, o: 2646.0, h: 2651.5, l: 2644.0, c: 2648.0, v: 1100 };
    }
    if (i === 14) {
      return { t, o: 2645.0, h: 2646.5, l: 2642.5, c: 2645.8, v: 2200 };
    }
    if (i === 18) {
      return { t, o: 2652.5, h: 2653.0, l: 2651.0, c: 2651.2, v: 1200 };
    }
    if (i === 19) {
      return { t, o: 2651.0, h: 2651.1, l: 2648.2, c: 2648.5, v: 1400 };
    }
    if (i === 20) {
      return { t, o: 2648.5, h: 2649.0, l: 2647.5, c: 2648.0, v: 1200 };
    }
    if (i === 24) {
      return { t, o: 2649.8, h: 2650.0, l: 2648.0, c: 2648.2, v: 1500 };
    }
    if (i === 25) {
      return { t, o: 2648.2, h: 2656.5, l: 2648.1, c: 2656.0, v: 3800 };
    }
    if (i === 26) {
      return { t, o: 2655.5, h: 2659.0, l: 2652.0, c: 2658.2, v: 2400 };
    }
    return {
      t,
      o: 2646 + (i - 10) * 0.5,
      h: 2648 + (i - 10) * 0.5,
      l: 2645 + (i - 10) * 0.5,
      c: 2647 + (i - 10) * 0.5,
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
      structure: () => ({ ok: true, items: [{ label: '15m OB', px: 2650.0 }, { label: '4H Supply Wall', px: 2672.0 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2658.2 }),
    goldspotState: () => ({ spot: 2658.2, xm: 2658.0, paxg: 2657.8 }),
    getGoldMacroCached: () => ({ realRateHint: 'TAILWIND' }),
    goldscalpScan: () => ({
      at: now,
      cands: [{
        id: 'scalp-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2670.0, rr: 1.9,
        mark: 2658.2, killzone: 'NY_OPEN',
        barT: Math.floor((now - 900_000) / 1000),
        strategy: 'Judas Sweep Long'
      }]
    }),
    goldswingScan: () => ({
      at: now,
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2678.0, t2: 2692.0, rr: 2.6,
        mark: 2658.2, killzone: 'NY_OPEN',
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
  const micro = win.sgDetectMicrostructureZones(baseRows15, 'long');
  assert.equal(micro.ok, true);
  assert.ok(micro.nearestIfvg, 'Should detect reclaimed Bullish Inverse FVG (IFVG)');
  assert.ok(micro.ifvgs.some(z => z.ce === 2650.0), 'Should detect IFVG at 2650.0 CE');
  assert.equal(micro.nearestIfvg.ce, 2650.5, 'Most recent reclaimed IFVG [2650.0..2651.0] should have 50% CE = 2650.5');
  assert.ok(micro.volCommitmentRatio >= 2.0, `Expected volCommitmentRatio >= 2.0x, got ${micro.volCommitmentRatio}`);
  console.log('PASS 1: sgDetectMicrostructureZones (Inverse FVG 50% CE + Volume Commitment Ratio)');
  const crowned = win.sgCrownedRow(snap);
  assert.ok(crowned);
  const top = crowned.row;
  assert.ok(top.fractalCascade && top.fractalCascade.ok);
  assert.equal(top.fractalCascade.cascadeState, 'FULL_FRACTAL_CASCADE');
  assert.equal(top.fractalCascade.alignedCount, 5);
  assert.equal(top.fractalCascade.ibRaided, true, 'Post-IB sweep below 2644.0 to 2642.5 and reclaim should flag ibRaided = true');
  assert.equal(top.fractalCascade.sessionRaid, 'ASIAN_IB_LOW_SWEEP_RECLAIM');
  console.log('PASS 2: sgMultiTfFractalCascade (5/5 TF FULL_FRACTAL_CASCADE & ASIAN_IB_LOW_SWEEP_RECLAIM)');
  assert.ok(top.riskProfile && top.riskProfile.ok);
  assert.ok(top.riskProfile.breakevenWinPct < 30, `Expected breakevenWinPct < 30%, got ${top.riskProfile.breakevenWinPct}%`);
  assert.ok(top.riskProfile.edgeMarginPct >= 40, `Expected edgeMarginPct >= +40%, got +${top.riskProfile.edgeMarginPct}%`);
  assert.equal(top.riskProfile.ruinGrade, 'FORTRESS');
  console.log('PASS 3: sgSetupRiskProfile (Breakeven Hurdle, +40%+ Edge Cushion, FORTRESS grade)');
  console.log('ALL hg-v1369 SUPER GOLD FRACTAL CASCADE & IFVG SETUP TESTS PASSED');
}
runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
