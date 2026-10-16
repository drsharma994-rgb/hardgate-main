import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');

function createHarness(overrides = {}) {
  const now = Date.now();
  // Construct 30 15m bars with:
  // - Equal Highs (BSL) near 2666.00 (bars 10 and 18)
  // - Bullish Order Block + Bullish FVG + Market Structure Shift (MSS) + Impulse Z-Score > 1.25
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i === 10 || i === 18) {
      return { t, o: 2663.0, h: 2666.0, l: 2662.0, c: 2663.2, v: 1800 };
    }
    if (i === 24) {
      return { t, o: 2649.8, h: 2650.0, l: 2648.0, c: 2648.2, v: 1500 };
    }
    if (i === 25) {
      return { t, o: 2648.2, h: 2656.5, l: 2648.1, c: 2656.0, v: 3500 };
    }
    if (i === 26) {
      return { t, o: 2655.5, h: 2659.0, l: 2652.0, c: 2658.2, v: 2400 };
    }
    return {
      t,
      o: 2644 + i * 0.4,
      h: 2646 + i * 0.4,
      l: 2643 + i * 0.4,
      c: 2645 + i * 0.4,
      v: 1000 + i * 20
    };
  });

  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: 'BULL', bull: 4, bear: 1, why: '4/5 BULL', rows: [{ tf: '15m', dir: 'BULL' }] }),
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

  // 1. Verify Session & Intraday Liquidity Map (EQH/EQL, 50% Equilibrium Discount/Premium, Draw on Liquidity)
  const liqMap = win.sgSessionLiquidityMap(baseRows15, 'long', 2650.25);
  assert.equal(liqMap.ok, true);
  assert.ok(liqMap.eqHighs.includes(2666.0), 'Should detect Equal Highs (BSL_EQH) at 2666.0');
  assert.equal(liqMap.zonePricing, 'DISCOUNT', 'Entry at 2650.25 inside [2643..2666] range should be in DISCOUNT (<48%)');
  assert.equal(liqMap.inFavorableZone, true, 'Long entry in Discount should be marked inFavorableZone = true');
  assert.equal(liqMap.drawOnLiquidity.type, 'BSL_EQH');
  assert.equal(liqMap.drawOnLiquidity.px, 2666.0);
  console.log('PASS 1: sgSessionLiquidityMap (Equal Highs BSL, 50% Equilibrium Discount, Draw on Liquidity)');

  // 2. Verify Market Structure Shift (MSS / CHOCH) & Impulse Z-Score in sgDetectMicrostructureZones
  const micro = win.sgDetectMicrostructureZones(baseRows15, 'long');
  assert.equal(micro.ok, true);
  assert.equal(micro.mssConfirmed, true, 'Should confirm bullish Market Structure Shift (MSS / CHOCH)');
  assert.ok(micro.impulseZScore >= 1.25, `Expected impulseZScore >= 1.25, got ${micro.impulseZScore}`);
  console.log('PASS 2: sgDetectMicrostructureZones (MSS/CHOCH confirmation & Impulse Z-Score)');

  // 3. Verify Pre-Fill Adverse-Selection ("Falling Knife") Guard
  const crowned = win.sgCrownedRow(snap);
  assert.ok(crowned);
  const top = crowned.row;
  assert.equal(top.adverseSelection.status, 'SAFE_LIMIT');
  assert.equal(top.adverseSelection.executionMode, 'RESTING_LIMIT');

  // Simulate a violent 2.2x ATR bearish crash bar closing on its low right into a Long limit
  const knifeIntel = {
    ...snap.intel,
    rows15: [
      ...baseRows15.slice(0, -1),
      { t: Math.floor(Date.now() / 1000), o: 2660.0, h: 2660.2, l: 2650.0, c: 2650.4 } // 10.2 pt drop (2.55x ATR), close 96% near low
    ]
  };
  const knifeGuard = win.sgAdverseSelectionGuard(top, top.precision, knifeIntel);
  assert.equal(knifeGuard.status, 'KNIFE_HAZARD', 'Violent opposing expansion bar should trigger KNIFE_HAZARD');
  assert.equal(knifeGuard.executionMode, 'CONFIRMATION_CLOSE_ONLY', 'Should switch execution mode from RESTING_LIMIT to CONFIRMATION_CLOSE_ONLY');
  console.log('PASS 3: sgAdverseSelectionGuard (SAFE_LIMIT vs KNIFE_HAZARD / CONFIRMATION_CLOSE_ONLY)');

  console.log('ALL hg-v1368 SUPER GOLD INSTITUTIONAL SETUP FORMATION TESTS PASSED');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

