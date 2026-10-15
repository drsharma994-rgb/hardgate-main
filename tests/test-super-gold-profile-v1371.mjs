/* ==========================================================================
   HARDGATE — test-super-gold-v1371.mjs
   Automated verification suite for Super Gold hg-v1371 Intraday Volume Profile
   (POC/VAH/VAL/LVN), Cross-Venue Bullion SMT, Dynamic Regime-Adaptive TP Splits
   & 4-Stage Structural Stop-Ratchet Ladder:
   1. Intraday Volume Profile Engine (sgIntradayVolumeProfile):
      - Point of Control (poc), 70% Value Area High/Low (vah / val), and
        VAL_SPRING_RECLAIM / POC_MAGNET_RELOAD detection
   2. Cross-Venue Bullion SMT & Spot-Lead Confirmation (sgCrossVenueSmtRead):
      - SPOT_LEADING_BULL confirmation when physical spot leads PAXG within bounds
   3. Dynamic Regime-Adaptive 3-Tier TP Splits (sgAdaptiveTpSplits):
      - 40/30/30 RUNNER_HEAVY on 5/5 TF cascade vs 60/25/15 FRONT_LOADED on compression
   4. 4-Stage Structural Stop-Ratchet Ladder (sgBuildStopRatchetLadder):
      - Stage 0 (Initial), Stage 1 (+0.75R -> -0.40R), Stage 2 (TP1 -> BE+0.25R),
        Stage 3 (TP2 -> TP1 lock)
   ========================================================================== */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');

function createHarness(overrides = {}) {
  const now = Date.now();
  // Construct 30 15m bars with heavy institutional volume concentrated around 2650.0 (POC)
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i < 15) {
      return { t, o: 2649.5, h: 2651.2, l: 2648.8, c: 2650.1, v: 4200 };
    }
    if (i === 18) {
      // Sweep below Value Area Low down to 2642.2 and reclaim inside Value Area
      return { t, o: 2645.0, h: 2647.0, l: 2642.2, c: 2646.5, v: 2600 };
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
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2652.8 }),
    goldspotState: () => ({ spot: 2652.8, xm: 2652.6, paxg: 2651.9 }),
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

  // 1. Verify Intraday Volume Profile (POC / VAH / VAL) in sgIntradayVolumeProfile
  const vp = win.sgIntradayVolumeProfile(baseRows15, 'long', 2650.25);
  assert.equal(vp.ok, true);
  assert.ok(vp.poc >= 2648.5 && vp.poc <= 2651.5, `Expected POC near 2650.0, got ${vp.poc}`);
  assert.ok(vp.vah > vp.poc && vp.val < vp.poc, 'VAH should sit above POC and VAL below POC');
  assert.equal(vp.nearPoc, true, 'Entry at 2650.25 should be flagged nearPoc = true');
  console.log('PASS 1: sgIntradayVolumeProfile (POC, VAH, VAL & Value-Area Confluence)');

  // 2. Verify Cross-Venue Bullion SMT & Spot-Lead Confirmation (sgCrossVenueSmtRead)
  const crowned = win.sgCrownedRow(snap);
  assert.ok(crowned);
  const top = crowned.row;
  assert.ok(top.smtRead && top.smtRead.ok);
  assert.equal(top.smtRead.smtState, 'SPOT_LEADING_BULL');
  assert.equal(top.smtRead.smtConfirmed, true);
  assert.ok(top.smtRead.venueAlignmentScore >= 85);
  console.log('PASS 2: sgCrossVenueSmtRead (SPOT_LEADING_BULL & Cross-Venue Alignment Score)');

  // 3. Verify Dynamic Regime-Adaptive 3-Tier Take-Profit Splits (sgAdaptiveTpSplits)
  assert.equal(top.precision.splits.splitScheme, 'RUNNER_HEAVY_40_30_30', '5/5 TF bull cascade should select RUNNER_HEAVY_40_30_30 splits');
  assert.equal(top.precision.splits.t1Pct, 40);
  assert.equal(top.precision.splits.t2Pct, 30);
  assert.equal(top.precision.splits.t3Pct, 30);
  const compSplits = win.sgAdaptiveTpSplits({ volRegime: { regime: 'COMPRESSION' } }, {}, 'long');
  assert.equal(compSplits.splitScheme, 'FRONT_LOADED_60_25_15');
  assert.equal(compSplits.t1Pct, 60);
  console.log('PASS 3: sgAdaptiveTpSplits (40/30/30 Runner-Heavy vs 60/25/15 Front-Loaded)');

  // 4. Verify 4-Stage Structural Stop-Ratchet Ladder (sgBuildStopRatchetLadder)
  assert.ok(Array.isArray(top.ratchetLadder) && top.ratchetLadder.length === 4);
  assert.equal(top.ratchetLadder[0].code, 'INITIAL_SWEEP_SHIELD');
  assert.equal(top.ratchetLadder[1].code, 'MFE_0_75R_RISK_HALVED');
  assert.equal(top.ratchetLadder[2].code, 'TP1_HIT_BE_PLUS_0_25R');
  assert.equal(top.ratchetLadder[3].code, 'TP2_HIT_STRUCTURAL_LOCK');
  assert.ok(top.ratchetLadder[1].stopPx > top.ratchetLadder[0].stopPx, 'Stage 1 (+0.75R) stop should be tighter than Stage 0 initial stop for Long');
  assert.ok(top.ratchetLadder[2].stopPx > top.precision.entry, 'Stage 2 (TP1 hit) stop should lock above Entry (BE + 0.25R) for Long');
  console.log('PASS 4: sgBuildStopRatchetLadder (4-Stage Post-Trigger Stop Ratchet)');

  console.log('ALL hg-v1371 SUPER GOLD VOLUME PROFILE, SMT, ADAPTIVE TP & RATCHET TESTS PASSED');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

